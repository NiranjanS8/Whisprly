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
    pinnedAt?: string | null;
    pinnedById?: string | null;
    pinnedByUsername?: string | null;
    roomId: string;
    status: MessageStatus;
}

interface ChatState {
    messagesByRoom: Record<string, ChatMessage[]>;
    connectionStatus: ConnectionStatus;
    reconnectAttempt: number;

    appendMessage: (roomId: string, msg: ChatMessage) => void;
    upsertMessage: (roomId: string, msg: ChatMessage) => void;
    confirmMessage: (roomId: string, idempotencyKey: string, serverMsg: ChatMessage) => void;
    failMessage: (roomId: string, idempotencyKey: string) => void;
    updateMessageStatus: (roomId: string, idempotencyKey: string, status: MessageStatus) => void;
    setHistoryMessages: (roomId: string, msgs: ChatMessage[]) => void;
    setConnectionStatus: (s: ConnectionStatus) => void;
    setReconnectAttempt: (n: number) => void;
    clearRoom: (roomId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
    messagesByRoom: {},
    connectionStatus: 'disconnected',
    reconnectAttempt: 0,

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
    clearRoom: (roomId) =>
        set((state) => {
            const copy = { ...state.messagesByRoom };
            delete copy[roomId];
            return { messagesByRoom: copy };
        }),
}));
