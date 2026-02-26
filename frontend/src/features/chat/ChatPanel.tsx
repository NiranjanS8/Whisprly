import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { useRoomStore } from '../rooms/roomStore';
import { fetchRoomMembers } from '../rooms/roomApi';
import { useAuthStore } from '../auth/authStore';
import { useChatStore } from './chatStore';
import type { ChatMessage } from './chatStore';
import { wsService } from './websocket';
import { deleteMessage, editMessage, fetchMessages, uploadAttachmentMessage } from './messageApi';
import { generateIdempotencyKey, getInitials, resolveMediaUrl } from '../../shared/utils';
import { fetchUserSummary } from '../profile/profileApi';
import { usePresenceStore } from '../presence/presenceStore';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import './chat.css';

interface DmParticipant {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
}

function getDmNameFallback(roomName: string, currentUsername: string | null): string {
    const normalized = roomName?.trim() || 'Direct Message';
    if (!currentUsername) return normalized;

    const participants = normalized.split('&').map((part) => part.trim()).filter(Boolean);
    if (participants.length === 2) {
        const other = participants.find((part) => part.toLowerCase() !== currentUsername.toLowerCase());
        if (other) return other;
    }

    return normalized;
}

export default function ChatPanel() {
    const navigate = useNavigate();
    const activeRoomId = useRoomStore((s) => s.activeRoomId);
    const activeRoom = useRoomStore((s) => s.rooms.find((r) => r.id === s.activeRoomId));
    const onlineCountsByRoom = useRoomStore((s) => s.onlineCountsByRoom);
    const touchRoomActivity = useRoomStore((s) => s.touchRoomActivity);
    const userId = useAuthStore((s) => s.userId);
    const username = useAuthStore((s) => s.username);
    const connectionStatus = useChatStore((s) => s.connectionStatus);
    const messagesByRoom = useChatStore((s) => s.messagesByRoom);
    const appendMessage = useChatStore((s) => s.appendMessage);
    const setHistoryMessages = useChatStore((s) => s.setHistoryMessages);
    const failMessage = useChatStore((s) => s.failMessage);
    const isUserOnline = usePresenceStore((s) => s.isUserOnline);

    const [loading, setLoading] = useState(false);
    const [dmParticipant, setDmParticipant] = useState<DmParticipant | null>(null);
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
    const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [atBottom, setAtBottom] = useState(true);

    const isDmRoom = activeRoom?.type === 'DM';
    const dmNameFallback = activeRoom ? getDmNameFallback(activeRoom.name, username) : 'Direct Message';

    const messages = useMemo(() => {
        if (!activeRoomId) return [];
        const msgs = messagesByRoom[activeRoomId] ?? [];
        const seen = new Map<string, ChatMessage>();
        msgs.forEach((m) => {
            const key = m.id || m.idempotencyKey;
            seen.set(key, m);
        });
        return Array.from(seen.values()).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
    }, [activeRoomId, messagesByRoom]);

    useEffect(() => {
        if (!activeRoomId) return;

        wsService.subscribeToRoom(activeRoomId);

        setLoading(true);
        fetchMessages(activeRoomId)
            .then((history) => {
                setHistoryMessages(activeRoomId, history);
                const latest = history.reduce<string | null>((latestAt, msg) => {
                    if (!latestAt) return msg.createdAt;
                    return new Date(msg.createdAt).getTime() > new Date(latestAt).getTime()
                        ? msg.createdAt
                        : latestAt;
                }, null);
                if (latest) {
                    touchRoomActivity(activeRoomId, latest);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));

        return () => {
            wsService.unsubscribeFromRoom(activeRoomId);
        };
    }, [activeRoomId, setHistoryMessages, touchRoomActivity]);

    useEffect(() => {
        if (!activeRoomId || !activeRoom || activeRoom.type !== 'DM' || !userId) {
            setDmParticipant(null);
            return;
        }

        let cancelled = false;
        const loadParticipant = async () => {
            try {
                const members = await fetchRoomMembers(activeRoomId);
                const otherMember = members.find((member) => member.userId !== userId);
                if (!otherMember) {
                    if (!cancelled) {
                        setDmParticipant(null);
                    }
                    return;
                }

                const summary = await fetchUserSummary(otherMember.userId);
                if (!cancelled) {
                    setDmParticipant({
                        id: summary.id,
                        username: summary.username,
                        fullName: summary.fullName ?? null,
                        avatarUrl: summary.avatarUrl,
                    });
                }
            } catch (error) {
                if (!cancelled) {
                    setDmParticipant(null);
                }
                console.error(error);
            }
        };

        loadParticipant();
        return () => {
            cancelled = true;
        };
    }, [activeRoomId, activeRoom, userId]);

    useEffect(() => {
        setHeaderMenuOpen(false);
        setEditingMessage(null);
    }, [activeRoomId]);

    const handleSend = (content: string) => {
        if (!activeRoomId || !userId || !username) return;

        if (editingMessage && editingMessage.id) {
            const nextContent = content.trim();
            if (!nextContent) return;
            editMessage(activeRoomId, editingMessage.id, nextContent)
                .then((updated) => {
                    useChatStore.getState().upsertMessage(activeRoomId, updated);
                    setEditingMessage(null);
                })
                .catch(console.error);
            return;
        }

        const idempotencyKey = generateIdempotencyKey();
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
        touchRoomActivity(activeRoomId, optimisticMsg.createdAt);
        wsService.sendMessage(activeRoomId, content, idempotencyKey);

        setTimeout(() => {
            const msgs = useChatStore.getState().messagesByRoom[activeRoomId] ?? [];
            const msg = msgs.find((m) => m.idempotencyKey === idempotencyKey);
            if (msg && msg.status === 'sending') {
                failMessage(activeRoomId, idempotencyKey);
            }
        }, 5000);
    };

    const handleUploadAttachment = async (
        file: File,
        content?: string,
        onProgress?: (progress: number) => void
    ) => {
        if (!activeRoomId || editingMessage) return;
        const message = await uploadAttachmentMessage(activeRoomId, file, content, onProgress);
        appendMessage(activeRoomId, message);
        touchRoomActivity(activeRoomId, message.createdAt);
    };

    const handleStartEdit = (message: ChatMessage) => {
        if (!message.id || message.deletedAt) return;
        setEditingMessage(message);
    };

    const handleCancelEdit = () => {
        setEditingMessage(null);
    };

    const handleDeleteMessage = (message: ChatMessage) => {
        if (!activeRoomId || !message.id) return;
        deleteMessage(activeRoomId, message.id)
            .then((updated) => {
                useChatStore.getState().upsertMessage(activeRoomId, updated);
                if (editingMessage?.id === message.id) {
                    setEditingMessage(null);
                }
            })
            .catch(console.error);
    };

    if (!activeRoomId || !activeRoom) {
        return (
            <div className="chat-panel chat-panel--empty">
                <div className="chat-empty-state">
                    <div className="chat-empty-icon">...</div>
                    <h3>Welcome to Whisprly</h3>
                    <p>Select a room to start chatting</p>
                </div>
            </div>
        );
    }

    const headerName = isDmRoom ? (dmParticipant?.fullName?.trim() || dmParticipant?.username || dmNameFallback) : activeRoom.name;
    const headerAvatar = isDmRoom ? resolveMediaUrl(dmParticipant?.avatarUrl ?? null) : null;
    const dmOnline = isUserOnline(dmParticipant?.id);
    const roomOnlineCount = activeRoom ? (onlineCountsByRoom[activeRoom.id] ?? 0) : 0;
    const headerStatusText = isDmRoom
        ? (dmOnline ? 'Online' : 'Offline')
        : `${roomOnlineCount} online Â· ${activeRoom.memberCount} member${activeRoom.memberCount !== 1 ? 's' : ''}`;

    return (
        <div className="chat-panel">
            <header className="chat-header">
                <div className="chat-header__identity">
                    <div className="chat-header__avatar" aria-hidden="true">
                        {headerAvatar ? (
                            <img src={headerAvatar} alt="" />
                        ) : (
                            getInitials(headerName)
                        )}
                    </div>
                    <div className="chat-header__info">
                        <h3 className="chat-header__name">{headerName}</h3>
                        <span className={`chat-header__meta ${isDmRoom ? 'chat-header__meta--presence' : ''}`}>
                            {isDmRoom && <span className={`presence-dot ${dmOnline ? 'presence-dot--online' : 'presence-dot--offline'}`} />}
                            {headerStatusText}
                        </span>
                    </div>
                </div>
                <div className="chat-header__actions">
                    {!isDmRoom && (
                        <div className="chat-header__menu-wrap">
                            <button
                                type="button"
                                className="chat-header__menu-btn"
                                aria-label="Chat actions"
                                onClick={() => setHeaderMenuOpen((prev) => !prev)}
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="5" r="1.8" fill="currentColor" />
                                    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                                    <circle cx="12" cy="19" r="1.8" fill="currentColor" />
                                </svg>
                            </button>
                            {headerMenuOpen && (
                                <div className="chat-header__menu">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setHeaderMenuOpen(false);
                                            navigate(`/chat/rooms/${activeRoomId}/settings`);
                                        }}
                                    >
                                        Room Settings
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
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
                        computeItemKey={(_, msg) => msg.id || msg.idempotencyKey}
                        initialTopMostItemIndex={Math.max(0, messages.length - 1)}
                        followOutput={atBottom ? 'smooth' : false}
                        atBottomStateChange={setAtBottom}
                        itemContent={(index, msg) => {
                            const prev = index > 0 ? messages[index - 1] : null;
                            const showAvatar = !prev || prev.senderId !== msg.senderId;
                            return (
                                <MessageBubble
                                    key={msg.id || msg.idempotencyKey}
                                    message={msg}
                                    isOwn={msg.senderId === userId}
                                    showAvatar={showAvatar}
                                    showSender={showAvatar}
                                    avatarUrl={isDmRoom ? dmParticipant?.avatarUrl : undefined}
                                    onEdit={handleStartEdit}
                                    onDelete={handleDeleteMessage}
                                />
                            );
                        }}
                    />
                )}
            </div>

            <ChatInput
                onSendText={handleSend}
                onUploadAttachment={handleUploadAttachment}
                disabled={connectionStatus !== 'connected'}
                editMode={
                    editingMessage
                        ? {
                            messageId: editingMessage.id ?? '',
                            initialContent: editingMessage.content,
                            onCancel: handleCancelEdit,
                        }
                        : undefined
                }
            />
        </div>
    );
}

