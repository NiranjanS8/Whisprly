import { Client } from '@stomp/stompjs';
import type { IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useChatStore } from './chatStore';
import type { ChatMessage } from './chatStore';
import { normalizeApiPath } from '../../shared/utils';
import { usePresenceStore } from '../presence/presenceStore';
import { useRoomStore } from '../rooms/roomStore';
import type { Room } from '../rooms/roomApi';
import { useAuthStore } from '../auth/authStore';
import { useDmRequestStore } from '../rooms/dmRequestStore';
import type { DmRequest } from '../rooms/dmRequestApi';
import { useToastStore } from '../notifications/toastStore';

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
    private unreadQueueSub: StompSubscription | null = null;
    private roomUpdatesQueueSub: StompSubscription | null = null;
    private dmRequestQueueSub: StompSubscription | null = null;

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
                this.subscribeUnreadChannel();
                this.subscribeRoomUpdatesChannel();
                this.subscribeDmRequestChannel();

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

    private subscribeUnreadChannel() {
        if (!this.client?.connected) return;
        if (this.unreadQueueSub) return;

        this.unreadQueueSub = this.client.subscribe('/user/queue/rooms/unread', (message: IMessage) => {
            try {
                const body = JSON.parse(message.body);
                const roomId = String(body.roomSlug ?? body.roomId ?? '');
                const unreadCount = Number(body.unreadCount ?? 0);
                if (!roomId) return;
                useRoomStore.getState().setRoomUnreadCount(roomId, Number.isNaN(unreadCount) ? 0 : unreadCount);
            } catch (error) {
                console.error('Failed to parse unread update:', error);
            }
        });
    }

    private subscribeRoomUpdatesChannel() {
        if (!this.client?.connected) return;
        if (this.roomUpdatesQueueSub) return;

        this.roomUpdatesQueueSub = this.client.subscribe('/user/queue/rooms/updates', (message: IMessage) => {
            try {
                const room = JSON.parse(message.body) as Room;
                if (!room?.slug) return;
                const existingRoom = useRoomStore.getState().rooms.find(
                    (entry) => entry.id === room.id || entry.slug === room.slug
                );
                useRoomStore.getState().upsertRoom(room);
                if (!existingRoom) {
                    useToastStore.getState().pushToast({
                        title: room.type === 'DM' ? 'New conversation ready' : 'Added to room',
                        message: room.type === 'DM' ? room.name : `${room.name} is now in your list`,
                        tone: 'success',
                    });
                }
            } catch (error) {
                console.error('Failed to parse room update:', error);
            }
        });
    }

    private subscribeDmRequestChannel() {
        if (!this.client?.connected) return;
        if (this.dmRequestQueueSub) return;

        this.dmRequestQueueSub = this.client.subscribe('/user/queue/dm-requests/incoming', (message: IMessage) => {
            try {
                const request = JSON.parse(message.body) as DmRequest;
                if (!request?.id) return;
                useDmRequestStore.getState().prependIncomingRequest(request);
                useToastStore.getState().pushToast({
                    title: 'New DM request',
                    message: `@${request.requesterUsername} wants to chat`,
                });
            } catch (error) {
                console.error('Failed to parse incoming DM request:', error);
            }
        });
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

        const sub = this.client.subscribe(`/topic/room/${encodeURIComponent(roomId)}`, (message: IMessage) => {
            try {
                const body = JSON.parse(message.body);
                const resolvedRoomId = String(body.roomSlug ?? roomId);
                const chatMsg: ChatMessage = {
                    id: body.id,
                    idempotencyKey: body.idempotencyKey ?? body.id,
                    messageType: body.messageType ?? 'USER',
                    content: body.content,
                    attachment: body.attachment
                        ? { ...body.attachment, url: normalizeApiPath(body.attachment.url) }
                        : undefined,
                    senderId: body.senderId,
                    senderUsername: body.senderUsername,
                    senderFullName: body.senderFullName ?? null,
                    senderAvatarUrl: body.senderAvatarUrl ?? null,
                    createdAt: body.createdAt,
                    editedAt: body.editedAt ?? null,
                    deletedAt: body.deletedAt ?? null,
                    expiresAt: body.expiresAt ?? null,
                    pinnedAt: body.pinnedAt ?? null,
                    pinnedById: body.pinnedById ?? null,
                    pinnedByUsername: body.pinnedByUsername ?? null,
                    roomId: resolvedRoomId,
                    status: 'sent',
                };
                const store = useChatStore.getState();
                const roomMessages = store.messagesByRoom[resolvedRoomId] ?? [];
                const existingById = chatMsg.id && roomMessages.find((m) => m.id === chatMsg.id);

                if (existingById) {
                    store.upsertMessage(resolvedRoomId, chatMsg);
                    return;
                }

                useRoomStore.getState().touchRoomActivity(resolvedRoomId, chatMsg.createdAt);
                const authState = useAuthStore.getState();
                const activeRoomId = useRoomStore.getState().activeRoomId;
                const sourceRoom = useRoomStore.getState().rooms.find((entry) => entry.slug === resolvedRoomId);
                const isIncomingUserMessage =
                    chatMsg.messageType !== 'SYSTEM' &&
                    authState.userId != null &&
                    chatMsg.senderId !== authState.userId;

                const isOwnOptimistic = roomMessages.some(
                    (m) => m.idempotencyKey === chatMsg.idempotencyKey && m.status === 'sending'
                );

                if (isOwnOptimistic) {
                    store.confirmMessage(resolvedRoomId, chatMsg.idempotencyKey, chatMsg);
                    window.setTimeout(() => {
                        const current = useChatStore.getState().messagesByRoom[resolvedRoomId] ?? [];
                        const target = current.find((m) => m.idempotencyKey === chatMsg.idempotencyKey);
                        if (target && target.status === 'sent') {
                            useChatStore.getState().updateMessageStatus(resolvedRoomId, chatMsg.idempotencyKey, 'read');
                        }
                    }, 900);
                } else {
                    store.appendMessage(resolvedRoomId, chatMsg);
                }

                if (isIncomingUserMessage && activeRoomId !== resolvedRoomId) {
                    const senderLabel = chatMsg.senderFullName?.trim() || chatMsg.senderUsername;
                    const roomLabel = sourceRoom?.name?.trim() || resolvedRoomId;
                    useToastStore.getState().pushToast({
                        title: sourceRoom?.type === 'DM' ? senderLabel : `${roomLabel} • ${senderLabel}`,
                        message: chatMsg.content?.trim() || (chatMsg.attachment ? 'Sent an attachment' : 'New message'),
                    });
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

        const sub = this.client.subscribe(`/topic/room/${encodeURIComponent(roomId)}/typing`, (message: IMessage) => {
            try {
                const body = JSON.parse(message.body);
                const userId = String(body.userId ?? '');
                const username = String(body.username ?? 'Someone');
                const isTyping = Boolean(body.typing);
                const resolvedRoomId = String(body.roomSlug ?? roomId);
                if (!userId) return;
                useChatStore.getState().setTypingState(resolvedRoomId, userId, username, isTyping);
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
            destination: `/app/chat/${encodeURIComponent(roomId)}`,
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
            destination: `/app/typing/${encodeURIComponent(roomId)}`,
            body: payload,
        });

        // Fallback path: broker-level topic publish in case app mapping fails.
        this.client.publish({
            destination: `/topic/room/${encodeURIComponent(roomId)}/typing`,
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
        if (this.unreadQueueSub) {
            this.unreadQueueSub.unsubscribe();
            this.unreadQueueSub = null;
        }
        if (this.roomUpdatesQueueSub) {
            this.roomUpdatesQueueSub.unsubscribe();
            this.roomUpdatesQueueSub = null;
        }
        if (this.dmRequestQueueSub) {
            this.dmRequestQueueSub.unsubscribe();
            this.dmRequestQueueSub = null;
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
