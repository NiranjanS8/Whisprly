import { create } from 'zustand';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ChatAttachment {
    fileName: string;
    contentType: string;
    fileSizeBytes: number;
    category: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
    url: string;
    inlinePreviewable: boolean;
}

export interface ChatMessage {
    id?: string;
    idempotencyKey: string;
    content: string;
    attachment?: ChatAttachment;
    senderId: string;
    senderUsername: string;
    senderFullName?: string | null;
    createdAt: string;
    editedAt?: string | null;
    deletedAt?: string | null;
    expiresAt?: string | null;
    pinnedAt?: string | null;
    pinnedById?: string | null;
    pinnedByUsername?: string | null;
    roomId: string;
    status: MessageStatus;
}

interface ChatState {
    messagesByRoom: Record<string, ChatMessage[]>;
    typingByRoom: Record<string, Record<string, string>>;
    connectionStatus: ConnectionStatus;
    reconnectAttempt: number;
    jumpTarget: { roomId: string; messageId: string } | null;

    appendMessage: (roomId: string, msg: ChatMessage) => void;
    upsertMessage: (roomId: string, msg: ChatMessage) => void;
    confirmMessage: (roomId: string, idempotencyKey: string, serverMsg: ChatMessage) => void;
    failMessage: (roomId: string, idempotencyKey: string) => void;
    updateMessageStatus: (roomId: string, idempotencyKey: string, status: MessageStatus) => void;
    setHistoryMessages: (roomId: string, msgs: ChatMessage[]) => void;
    setConnectionStatus: (s: ConnectionStatus) => void;
    setReconnectAttempt: (n: number) => void;
    setTypingState: (roomId: string, userId: string, username: string, isTyping: boolean) => void;
    clearTypingForRoom: (roomId: string) => void;
    clearRoom: (roomId: string) => void;
    setJumpTarget: (roomId: string, messageId: string) => void;
    clearJumpTarget: () => void;
}

const typingExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useChatStore = create<ChatState>((set) => ({
    messagesByRoom: {},
    typingByRoom: {},
    connectionStatus: 'disconnected',
    reconnectAttempt: 0,
    jumpTarget: null,

    appendMessage: (roomId, msg) =>
        set((state) => {
            const existing = state.messagesByRoom[roomId] ?? [];
            // Deduplicate by id or idempotencyKey
            const isDuplicate = existing.some(
                (m) =>
                    (msg.id && m.id === msg.id) ||
                    (msg.idempotencyKey
                        && m.idempotencyKey === msg.idempotencyKey
                        && (m.status === 'sent' || m.status === 'delivered' || m.status === 'read'))
            );
            if (isDuplicate) return state;
            return {
                messagesByRoom: {
                    ...state.messagesByRoom,
                    [roomId]: [...existing, msg],
                },
            };
        }),

    upsertMessage: (roomId, msg) =>
        set((state) => {
            const existing = state.messagesByRoom[roomId] ?? [];
            const index = existing.findIndex(
                (m) =>
                    (msg.id && m.id === msg.id) ||
                    (msg.idempotencyKey && m.idempotencyKey === msg.idempotencyKey)
            );
            if (index === -1) {
                return {
                    messagesByRoom: {
                        ...state.messagesByRoom,
                        [roomId]: [...existing, msg],
                    },
                };
            }

            const current = existing[index];
            const updated = [...existing];
            updated[index] = {
                ...current,
                ...msg,
                status: current.status,
            };
            return {
                messagesByRoom: {
                    ...state.messagesByRoom,
                    [roomId]: updated,
                },
            };
        }),

    confirmMessage: (roomId, idempotencyKey, serverMsg) =>
        set((state) => {
            const existing = state.messagesByRoom[roomId] ?? [];
            const updated = existing.map((m) =>
                m.idempotencyKey === idempotencyKey
                    ? { ...serverMsg, status: 'sent' as const }
                    : m
            );
            // If no optimistic message was found, append it (message from another user)
            const found = existing.some((m) => m.idempotencyKey === idempotencyKey);
            return {
                messagesByRoom: {
                    ...state.messagesByRoom,
                    [roomId]: found ? updated : [...existing, { ...serverMsg, status: 'sent' as const }],
                },
            };
        }),

    updateMessageStatus: (roomId, idempotencyKey, status) =>
        set((state) => {
            const existing = state.messagesByRoom[roomId] ?? [];
            return {
                messagesByRoom: {
                    ...state.messagesByRoom,
                    [roomId]: existing.map((m) =>
                        m.idempotencyKey === idempotencyKey ? { ...m, status } : m
                    ),
                },
            };
        }),

    failMessage: (roomId, idempotencyKey) =>
        set((state) => {
            const existing = state.messagesByRoom[roomId] ?? [];
            return {
                messagesByRoom: {
                    ...state.messagesByRoom,
                    [roomId]: existing.map((m) =>
                        m.idempotencyKey === idempotencyKey ? { ...m, status: 'failed' as const } : m
                    ),
                },
            };
        }),

    setHistoryMessages: (roomId, msgs) =>
        set((state) => {
            const live = state.messagesByRoom[roomId] ?? [];
            const historyIds = new Set(msgs.map((m) => m.id));
            const uniqueLive = live.filter((m) => !m.id || !historyIds.has(m.id));
            return {
                messagesByRoom: {
                    ...state.messagesByRoom,
                    [roomId]: [...msgs, ...uniqueLive],
                },
            };
        }),

    setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
    setReconnectAttempt: (reconnectAttempt) => set({ reconnectAttempt }),
    setTypingState: (roomId, userId, username, isTyping) =>
        set((state) => {
            const timerKey = `${roomId}:${userId}`;
            const existingTimer = typingExpiryTimers.get(timerKey);
            if (existingTimer) {
                clearTimeout(existingTimer);
                typingExpiryTimers.delete(timerKey);
            }

            const roomTyping = { ...(state.typingByRoom[roomId] ?? {}) };
            if (isTyping) {
                roomTyping[userId] = username;

                const timer = setTimeout(() => {
                    useChatStore.setState((innerState) => {
                        const activeRoomTyping = { ...(innerState.typingByRoom[roomId] ?? {}) };
                        delete activeRoomTyping[userId];
                        const nextTypingByRoom = { ...innerState.typingByRoom };
                        if (Object.keys(activeRoomTyping).length === 0) {
                            delete nextTypingByRoom[roomId];
                        } else {
                            nextTypingByRoom[roomId] = activeRoomTyping;
                        }
                        return { typingByRoom: nextTypingByRoom };
                    });
                    typingExpiryTimers.delete(timerKey);
                }, 2500);
                typingExpiryTimers.set(timerKey, timer);
            } else {
                delete roomTyping[userId];
            }

            const nextTypingByRoom = { ...state.typingByRoom };
            if (Object.keys(roomTyping).length === 0) {
                delete nextTypingByRoom[roomId];
            } else {
                nextTypingByRoom[roomId] = roomTyping;
            }

            return { typingByRoom: nextTypingByRoom };
        }),
    clearTypingForRoom: (roomId) =>
        set((state) => {
            Object.keys(state.typingByRoom[roomId] ?? {}).forEach((userId) => {
                const timerKey = `${roomId}:${userId}`;
                const timer = typingExpiryTimers.get(timerKey);
                if (timer) {
                    clearTimeout(timer);
                    typingExpiryTimers.delete(timerKey);
                }
            });
            const nextTypingByRoom = { ...state.typingByRoom };
            delete nextTypingByRoom[roomId];
            return { typingByRoom: nextTypingByRoom };
        }),
    clearRoom: (roomId) =>
        set((state) => {
            const messagesCopy = { ...state.messagesByRoom };
            delete messagesCopy[roomId];

            const typingCopy = { ...state.typingByRoom };
            delete typingCopy[roomId];
            return { messagesByRoom: messagesCopy, typingByRoom: typingCopy };
        }),
    setJumpTarget: (roomId, messageId) =>
        set({ jumpTarget: { roomId, messageId } }),
    clearJumpTarget: () => set({ jumpTarget: null }),
}));
