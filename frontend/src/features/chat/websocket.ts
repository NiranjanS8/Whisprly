import { Client } from '@stomp/stompjs';
import type { IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useChatStore } from './chatStore';
import type { ChatMessage } from './chatStore';

const backendOrigin = import.meta.env.VITE_BACKEND_ORIGIN;
const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL || `${backendOrigin || 'http://localhost:9090'}/ws`;

class WebSocketService {
    private client: Client | null = null;
    private subscriptions: Map<string, StompSubscription> = new Map();
    private subscriptionQueue: Set<string> = new Set();
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private currentToken: string | null = null;

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

                // Process queued subscriptions
                this.subscriptionQueue.forEach(roomId => {
                    this.subscribeToRoom(roomId);
                });
                this.subscriptionQueue.clear();
            },

            onStompError: (frame) => {
                console.error('STOMP error:', frame.headers['message']);
            },

            onDisconnect: () => {
                useChatStore.getState().setConnectionStatus('disconnected');
            },

            onWebSocketClose: () => {
                useChatStore.getState().setConnectionStatus('disconnected');
                this.scheduleReconnect();
            },
        });

        this.client.activate();
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
        if (!this.client?.active || !this.client.connected) {
            this.subscriptionQueue.add(roomId);
            return;
        }
        if (this.subscriptions.has(roomId)) return;

        const sub = this.client.subscribe(`/topic/room/${roomId}`, (message: IMessage) => {
            try {
                const body = JSON.parse(message.body);
                const chatMsg: ChatMessage = {
                    id: body.id,
                    idempotencyKey: body.idempotencyKey ?? body.id,
                    content: body.content,
                    senderId: body.senderId,
                    senderUsername: body.senderUsername,
                    createdAt: body.createdAt,
                    roomId: roomId,
                    status: 'sent',
                };

                const store = useChatStore.getState();
                // Check if this is a confirmation of our optimistic message
                const roomMessages = store.messagesByRoom[roomId] ?? [];
                const isOwnOptimistic = roomMessages.some(
                    (m) => m.idempotencyKey === chatMsg.idempotencyKey && m.status === 'sending'
                );

                if (isOwnOptimistic) {
                    store.confirmMessage(roomId, chatMsg.idempotencyKey, chatMsg);
                } else {
                    store.appendMessage(roomId, chatMsg);
                }
            } catch (e) {
                console.error('Failed to parse message:', e);
            }
        });

        this.subscriptions.set(roomId, sub);
    }

    unsubscribeFromRoom(roomId: string) {
        const sub = this.subscriptions.get(roomId);
        if (sub) {
            sub.unsubscribe();
            this.subscriptions.delete(roomId);
        }
    }

    sendMessage(roomId: string, content: string, idempotencyKey: string) {
        if (!this.client?.active) return;

        this.client.publish({
            destination: `/app/chat/${roomId}`,
            body: JSON.stringify({ content, idempotencyKey }),
        });
    }

    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.subscriptions.forEach((sub) => sub.unsubscribe());
        this.subscriptions.clear();
        this.currentToken = null;

        if (this.client?.active) {
            this.client.deactivate();
        }
        this.client = null;
        useChatStore.getState().setConnectionStatus('disconnected');
    }

    get isConnected() {
        return this.client?.active ?? false;
    }
}

export const wsService = new WebSocketService();
