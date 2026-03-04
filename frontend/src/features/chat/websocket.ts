import { Client } from '@stomp/stompjs';
import type { IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useChatStore } from './chatStore';
import type { ChatMessage } from './chatStore';
import { normalizeApiPath } from '../../shared/utils';
import { usePresenceStore } from '../presence/presenceStore';
import { useRoomStore } from '../rooms/roomStore';
import { useAuthStore } from '../auth/authStore';

const backendOrigin = import.meta.env.VITE_BACKEND_ORIGIN;
const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL || `${backendOrigin || 'http://localhost:9090'}/ws`;

class WebSocketService {
    private client: Client | null = null;
    private subscriptions: Map<string, StompSubscription> = new Map();
    private typingSubscriptions: Map<string, StompSubscription> = new Map();
    private subscriptionRefCounts: Map<string, number> = new Map();
    private subscriptionQueue: Set<string> = new Set();
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private currentToken: string | null = null;
    private presenceTopicSub: StompSubscription | null = null;
    private presenceQueueSub: StompSubscription | null = null;

    connect(token: string) {
        if (this.client?.active) {
            this.disconnect();
        }

        this.currentToken = token;
        useChatStore.getState().setConnectionStatus('connecting');

        this.client = new Client({
            webSocketFactory: () => new SockJS(`${wsBaseUrl}?token=${token}`),
            reconnectDelay: 0, // we handle reconnection manually
            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,

            onConnect: () => {
                useChatStore.getState().setConnectionStatus('connected');
                useChatStore.getState().setReconnectAttempt(0);
                this.subscribePresenceChannels();

                // Re-subscribe active room topics after reconnect.
                this.subscriptionRefCounts.forEach((count, roomId) => {
                    if (count > 0) {
                        this.ensureRoomSubscription(roomId);
                        this.ensureTypingSubscription(roomId);
                    }
                });
                this.subscriptionQueue.clear();
            },

            onStompError: (frame) => {
                console.error('STOMP error:', frame.headers['message']);
            },

            onDisconnect: () => {
                useChatStore.getState().setConnectionStatus('disconnected');
                usePresenceStore.getState().markAllOffline();
            },

            onWebSocketClose: () => {
                useChatStore.getState().setConnectionStatus('disconnected');
                usePresenceStore.getState().markAllOffline();
                this.scheduleReconnect();
            },
        });

        this.client.activate();
    }

    private subscribePresenceChannels() {
        if (!this.client?.connected) return;

        if (!this.presenceTopicSub) {
            this.presenceTopicSub = this.client.subscribe('/topic/presence/snapshot', (message: IMessage) => {
                this.handlePresenceMessage(message);
            });
        }

        if (!this.presenceQueueSub) {
            this.presenceQueueSub = this.client.subscribe('/user/queue/presence', (message: IMessage) => {
                this.handlePresenceMessage(message);
            });
        }

        this.client.publish({
            destination: '/app/presence/snapshot',
            body: '{}',
        });
    }

    private handlePresenceMessage(message: IMessage) {
        try {
            const body = JSON.parse(message.body);
            const onlineUserIds: string[] = Array.isArray(body.onlineUserIds)
                ? body.onlineUserIds
                : [];
            usePresenceStore.getState().setPresenceSnapshot(onlineUserIds);
        } catch (e) {
            console.error('Failed to parse presence snapshot:', e);
        }
    }

    private scheduleReconnect() {
        if (!this.currentToken) return;

        const attempt = useChatStore.getState().reconnectAttempt;
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        const jitter = delay * 0.2 * (Math.random() * 2 - 1);
        const finalDelay = delay + jitter;

        useChatStore.getState().setConnectionStatus('reconnecting');
        useChatStore.getState().setReconnectAttempt(attempt + 1);

        this.reconnectTimer = setTimeout(() => {
            if (this.currentToken) {
                this.connect(this.currentToken);
            }
        }, finalDelay);
    }

    subscribeToRoom(roomId: string) {
        const nextRefCount = (this.subscriptionRefCounts.get(roomId) ?? 0) + 1;
        this.subscriptionRefCounts.set(roomId, nextRefCount);
        if (nextRefCount > 1) {
            if (this.client?.active && this.client.connected) {
                this.ensureTypingSubscription(roomId);
            } else {
                this.subscriptionQueue.add(roomId);
            }
            return;
        }

        if (!this.client?.active || !this.client.connected) {
            this.subscriptionQueue.add(roomId);
            return;
        }

        this.ensureRoomSubscription(roomId);
        this.ensureTypingSubscription(roomId);
    }

    private ensureRoomSubscription(roomId: string) {
        if (!this.client?.active || !this.client.connected) return;
        if (this.subscriptions.has(roomId)) return;

        const sub = this.client.subscribe(`/topic/room/${roomId}`, (message: IMessage) => {
            try {
                const body = JSON.parse(message.body);
                const chatMsg: ChatMessage = {
                    id: body.id,
                    idempotencyKey: body.idempotencyKey ?? body.id,
                    content: body.content,
                    attachment: body.attachment
                        ? { ...body.attachment, url: normalizeApiPath(body.attachment.url) }
                        : undefined,
                    senderId: body.senderId,
                    senderUsername: body.senderUsername,
                    senderFullName: body.senderFullName ?? null,
                    createdAt: body.createdAt,
                    editedAt: body.editedAt ?? null,
                    deletedAt: body.deletedAt ?? null,
                    expiresAt: body.expiresAt ?? null,
                    pinnedAt: body.pinnedAt ?? null,
                    pinnedById: body.pinnedById ?? null,
                    pinnedByUsername: body.pinnedByUsername ?? null,
                    roomId: roomId,
                    status: 'sent',
                };
                const store = useChatStore.getState();
                const roomMessages = store.messagesByRoom[roomId] ?? [];
                const existingById = chatMsg.id && roomMessages.find((m) => m.id === chatMsg.id);

                if (existingById) {
                    store.upsertMessage(roomId, chatMsg);
                    return;
                }

                useRoomStore.getState().touchRoomActivity(roomId, chatMsg.createdAt);

                const isOwnOptimistic = roomMessages.some(
                    (m) => m.idempotencyKey === chatMsg.idempotencyKey && m.status === 'sending'
                );

                if (isOwnOptimistic) {
                    store.confirmMessage(roomId, chatMsg.idempotencyKey, chatMsg);
                    window.setTimeout(() => {
                        const current = useChatStore.getState().messagesByRoom[roomId] ?? [];
                        const target = current.find((m) => m.idempotencyKey === chatMsg.idempotencyKey);
                        if (target && target.status === 'sent') {
                            useChatStore.getState().updateMessageStatus(roomId, chatMsg.idempotencyKey, 'read');
                        }
                    }, 900);
                } else {
                    store.appendMessage(roomId, chatMsg);
                }
            } catch (e) {
                console.error('Failed to parse message:', e);
            }
        });

        this.subscriptions.set(roomId, sub);
    }

    private ensureTypingSubscription(roomId: string) {
        if (!this.client?.active || !this.client.connected) return;
        if (this.typingSubscriptions.has(roomId)) return;

        const sub = this.client.subscribe(`/topic/room/${roomId}/typing`, (message: IMessage) => {
            try {
                const body = JSON.parse(message.body);
                const userId = String(body.userId ?? '');
                const username = String(body.username ?? 'Someone');
                const isTyping = Boolean(body.typing);
                if (!userId) return;
                useChatStore.getState().setTypingState(roomId, userId, username, isTyping);
            } catch (e) {
                console.error('Failed to parse typing event:', e);
            }
        });

        this.typingSubscriptions.set(roomId, sub);
    }

    unsubscribeFromRoom(roomId: string) {
        const currentRefCount = this.subscriptionRefCounts.get(roomId) ?? 0;
        if (currentRefCount <= 1) {
            this.subscriptionRefCounts.delete(roomId);
        } else {
            this.subscriptionRefCounts.set(roomId, currentRefCount - 1);
            return;
        }

        const sub = this.subscriptions.get(roomId);
        if (sub) {
            sub.unsubscribe();
            this.subscriptions.delete(roomId);
        }
        const typingSub = this.typingSubscriptions.get(roomId);
        if (typingSub) {
            typingSub.unsubscribe();
            this.typingSubscriptions.delete(roomId);
        }
        useChatStore.getState().clearTypingForRoom(roomId);
        this.subscriptionQueue.delete(roomId);
    }

    sendMessage(roomId: string, content: string, idempotencyKey: string) {
        if (!this.client?.active) return;

        this.client.publish({
            destination: `/app/chat/${roomId}`,
            body: JSON.stringify({ content, idempotencyKey }),
        });
    }

    sendTyping(roomId: string, typing: boolean) {
        if (!this.client?.active || !this.client.connected) return;
        const userId = useAuthStore.getState().userId;
        const username = useAuthStore.getState().username;
        const payload = JSON.stringify({
            roomId,
            userId,
            username,
            typing,
        });

        // Primary path via app mapping (server validates membership and re-broadcasts).
        this.client.publish({
            destination: `/app/typing/${roomId}`,
            body: payload,
        });

        // Fallback path: broker-level topic publish in case app mapping fails.
        this.client.publish({
            destination: `/topic/room/${roomId}/typing`,
            body: payload,
        });
    }

    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.subscriptions.forEach((sub) => sub.unsubscribe());
        this.subscriptions.clear();
        this.typingSubscriptions.forEach((sub) => sub.unsubscribe());
        this.typingSubscriptions.clear();
        this.subscriptionRefCounts.clear();
        this.subscriptionQueue.clear();
        if (this.presenceTopicSub) {
            this.presenceTopicSub.unsubscribe();
            this.presenceTopicSub = null;
        }
        if (this.presenceQueueSub) {
            this.presenceQueueSub.unsubscribe();
            this.presenceQueueSub = null;
        }
        this.currentToken = null;

        if (this.client?.active) {
            this.client.deactivate();
        }
        this.client = null;
        useChatStore.getState().setConnectionStatus('disconnected');
        usePresenceStore.getState().markAllOffline();
    }

    get isConnected() {
        return this.client?.active ?? false;
    }
}

export const wsService = new WebSocketService();
