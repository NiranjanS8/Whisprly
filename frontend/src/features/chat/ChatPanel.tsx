import { useEffect, useRef, useState, useMemo } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { useRoomStore } from '../rooms/roomStore';
import { useAuthStore } from '../auth/authStore';
import { useChatStore } from './chatStore';
import type { ChatMessage } from './chatStore';
import { wsService } from './websocket';
import { fetchMessages } from './messageApi';
import { generateIdempotencyKey } from '../../shared/utils';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import './chat.css';

export default function ChatPanel() {
    const activeRoomId = useRoomStore((s) => s.activeRoomId);
    const activeRoom = useRoomStore((s) => s.rooms.find((r) => r.id === s.activeRoomId));
    const userId = useAuthStore((s) => s.userId);
    const username = useAuthStore((s) => s.username);
    const connectionStatus = useChatStore((s) => s.connectionStatus);
    const messagesByRoom = useChatStore((s) => s.messagesByRoom);
    const appendMessage = useChatStore((s) => s.appendMessage);
    const setHistoryMessages = useChatStore((s) => s.setHistoryMessages);
    const failMessage = useChatStore((s) => s.failMessage);

    const [loading, setLoading] = useState(false);
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [atBottom, setAtBottom] = useState(true);

    const messages = useMemo(() => {
        if (!activeRoomId) return [];
        const msgs = messagesByRoom[activeRoomId] ?? [];
        // Deduplicate by id, keep latest
        const seen = new Map<string, ChatMessage>();
        msgs.forEach((m) => {
            const key = m.id || m.idempotencyKey;
            seen.set(key, m);
        });
        return Array.from(seen.values()).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
    }, [activeRoomId, messagesByRoom]);

    // Load history when room changes
    useEffect(() => {
        if (!activeRoomId) return;

        // Subscribe first, then fetch (per FRONTEND_DESIGN §3.5)
        wsService.subscribeToRoom(activeRoomId);

        setLoading(true);
        fetchMessages(activeRoomId)
            .then((history) => {
                setHistoryMessages(activeRoomId, history);
            })
            .catch(console.error)
            .finally(() => setLoading(false));

        return () => {
            wsService.unsubscribeFromRoom(activeRoomId);
        };
    }, [activeRoomId, setHistoryMessages]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (atBottom && messages.length > 0) {
            setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({
                    index: messages.length - 1,
                    behavior: 'smooth',
                });
            }, 50);
        }
    }, [messages.length, atBottom]);

    const handleSend = (content: string) => {
        if (!activeRoomId || !userId || !username) return;

        const idempotencyKey = generateIdempotencyKey();

        // Optimistic append
        const optimisticMsg: ChatMessage = {
            idempotencyKey,
            content,
            senderId: userId,
            senderUsername: username,
            createdAt: new Date().toISOString(),
            roomId: activeRoomId,
            status: 'sending',
        };
        appendMessage(activeRoomId, optimisticMsg);

        // Send via WebSocket
        wsService.sendMessage(activeRoomId, content, idempotencyKey);

        // Timeout: mark as failed if no confirmation in 5s
        setTimeout(() => {
            const msgs = useChatStore.getState().messagesByRoom[activeRoomId] ?? [];
            const msg = msgs.find((m) => m.idempotencyKey === idempotencyKey);
            if (msg && msg.status === 'sending') {
                failMessage(activeRoomId, idempotencyKey);
            }
        }, 5000);
    };

    if (!activeRoomId || !activeRoom) {
        return (
            <div className="chat-panel chat-panel--empty">
                <div className="chat-empty-state">
                    <div className="chat-empty-icon">💬</div>
                    <h3>Welcome to Whisprly</h3>
                    <p>Select a room to start chatting</p>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-panel">
            <header className="chat-header">
                <div className="chat-header__info">
                    <h3 className="chat-header__name">{activeRoom.name}</h3>
                    <span className="chat-header__meta">
                        {activeRoom.memberCount} member{activeRoom.memberCount !== 1 ? 's' : ''}
                    </span>
                </div>
                <div className={`connection-badge connection-badge--${connectionStatus}`}>
                    <span className="connection-dot" />
                    {connectionStatus === 'connected'
                        ? 'Connected'
                        : connectionStatus === 'reconnecting'
                            ? 'Reconnecting...'
                            : connectionStatus === 'connecting'
                                ? 'Connecting...'
                                : 'Disconnected'}
                </div>
            </header>

            <div className="chat-messages">
                {loading ? (
                    <div className="chat-loading">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className={`skeleton-msg ${i % 3 === 0 ? 'skeleton-msg--own' : ''}`}>
                                <div className="skeleton-avatar" />
                                <div className="skeleton-body">
                                    <div className="skeleton-line" style={{ width: `${60 + Math.random() * 30}%` }} />
                                    <div className="skeleton-line" style={{ width: `${30 + Math.random() * 40}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Virtuoso
                        ref={virtuosoRef}
                        data={messages}
                        initialTopMostItemIndex={Math.max(0, messages.length - 1)}
                        followOutput="smooth"
                        atBottomStateChange={setAtBottom}
                        itemContent={(_, msg) => (
                            <MessageBubble
                                key={msg.id || msg.idempotencyKey}
                                message={msg}
                                isOwn={msg.senderId === userId}
                            />
                        )}
                    />
                )}
            </div>

            <ChatInput onSend={handleSend} disabled={connectionStatus !== 'connected'} />
        </div>
    );
}
