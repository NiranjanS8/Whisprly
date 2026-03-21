import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { useRoomStore } from '../rooms/roomStore';
import { fetchRoomMembers, markRoomRead } from '../rooms/roomApi';
import { useAuthStore } from '../auth/authStore';
import { useChatStore } from './chatStore';
import type { ChatMessage } from './chatStore';
import { wsService } from './websocket';
import {
    deleteMessage,
    editMessage,
    fetchMessageById,
    fetchMessages,
    pinMessage,
    searchMessagesInRoom,
    type MessageSearchResult,
    unpinMessage,
    uploadAttachmentMessage,
} from './messageApi';
import { generateIdempotencyKey, getInitials, resolveMediaUrl } from '../../shared/utils';
import { fetchUserSummary } from '../profile/profileApi';
import { useBlockStore } from '../profile/blockStore';
import { usePresenceStore } from '../presence/presenceStore';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import './chat.css';

interface DmParticipant {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
    blockedByCurrentUser: boolean;
    blocksCurrentUser: boolean;
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

function formatSelfDestructLabel(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
}

function formatSearchResultTime(dateString: string): string {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

export default function ChatPanel() {
    const navigate = useNavigate();
    const activeRoomId = useRoomStore((s) => s.activeRoomId);
    const activeRoom = useRoomStore((s) => s.rooms.find((r) => r.slug === s.activeRoomId));
    const onlineCountsByRoom = useRoomStore((s) => s.onlineCountsByRoom);
    const touchRoomActivity = useRoomStore((s) => s.touchRoomActivity);
    const setRoomUnreadCount = useRoomStore((s) => s.setRoomUnreadCount);
    const userId = useAuthStore((s) => s.userId);
    const username = useAuthStore((s) => s.username);
    const connectionStatus = useChatStore((s) => s.connectionStatus);
    const messagesByRoom = useChatStore((s) => s.messagesByRoom);
    const typingByRoom = useChatStore((s) => s.typingByRoom);
    const appendMessage = useChatStore((s) => s.appendMessage);
    const setHistoryMessages = useChatStore((s) => s.setHistoryMessages);
    const jumpTarget = useChatStore((s) => s.jumpTarget);
    const clearJumpTarget = useChatStore((s) => s.clearJumpTarget);
    const failMessage = useChatStore((s) => s.failMessage);
    const isUserOnline = usePresenceStore((s) => s.isUserOnline);
    const syncBlockSummary = useBlockStore((s) => s.syncSummary);

    const [loading, setLoading] = useState(false);
    const [dmParticipant, setDmParticipant] = useState<DmParticipant | null>(null);
    const [headerAvatarLoadFailed, setHeaderAvatarLoadFailed] = useState(false);
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
    const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
    const [pendingJumpMessageId, setPendingJumpMessageId] = useState<string | null>(null);
    const [activeMenuMessageKey, setActiveMenuMessageKey] = useState<string | null>(null);
    const [roomSearchOpen, setRoomSearchOpen] = useState(false);
    const [roomSearchQuery, setRoomSearchQuery] = useState('');
    const [roomSearchResults, setRoomSearchResults] = useState<MessageSearchResult[]>([]);
    const [roomSearchLoading, setRoomSearchLoading] = useState(false);
    const [activeSearchMatchIndex, setActiveSearchMatchIndex] = useState(0);
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const roomSearchRef = useRef<HTMLDivElement | null>(null);
    const [atBottom, setAtBottom] = useState(true);
    const dmBlockState = useBlockStore((s) => (dmParticipant ? s.byUserId[dmParticipant.id] : undefined));

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

    const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;

    const pinnedMessage = useMemo(() => {
        const pinned = messages
            .filter((msg) => !!msg.pinnedAt && !msg.deletedAt)
            .sort((a, b) => new Date(b.pinnedAt as string).getTime() - new Date(a.pinnedAt as string).getTime());
        return pinned[0] ?? null;
    }, [messages]);

    const typingUsers = useMemo(() => {
        if (!activeRoomId) return [];
        const roomTyping = typingByRoom[activeRoomId] ?? {};
        return Object.entries(roomTyping)
            .filter(([typingUserId]) => typingUserId !== userId)
            .map(([, typingUsername]) => typingUsername);
    }, [activeRoomId, typingByRoom, userId]);

    const typingStatusText = useMemo(() => {
        if (typingUsers.length === 0) return null;
        if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
        if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
        return `${typingUsers[0]} and others are typing...`;
    }, [typingUsers]);

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
        if (!activeRoomId || connectionStatus !== 'connected') return;
        markRoomRead(activeRoomId)
            .then((update) => {
                setRoomUnreadCount(update.roomSlug || activeRoomId, update.unreadCount ?? 0);
            })
            .catch(console.error);
    }, [activeRoomId, connectionStatus, setRoomUnreadCount]);

    useEffect(() => {
        if (!activeRoomId || !latestMessage || latestMessage.senderId === userId || connectionStatus !== 'connected') return;
        const timer = window.setTimeout(() => {
            markRoomRead(activeRoomId)
                .then((update) => {
                    setRoomUnreadCount(update.roomSlug || activeRoomId, update.unreadCount ?? 0);
                })
                .catch(console.error);
        }, 250);
        return () => window.clearTimeout(timer);
    }, [activeRoomId, latestMessage?.id, latestMessage?.senderId, connectionStatus, userId, setRoomUnreadCount]);

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
                    syncBlockSummary(summary);
                    setDmParticipant({
                        id: summary.id,
                        username: summary.username,
                        fullName: summary.fullName ?? null,
                        avatarUrl: summary.avatarUrl,
                        blockedByCurrentUser: summary.blockedByCurrentUser,
                        blocksCurrentUser: summary.blocksCurrentUser,
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
    }, [activeRoomId, activeRoom, userId, syncBlockSummary]);

    useEffect(() => {
        setHeaderMenuOpen(false);
        setEditingMessage(null);
        setHighlightedMessageId(null);
        setPendingJumpMessageId(null);
        setRoomSearchOpen(false);
        setRoomSearchQuery('');
        setRoomSearchResults([]);
        setRoomSearchLoading(false);
        setActiveSearchMatchIndex(0);
        setActiveMenuMessageKey(null);
    }, [activeRoomId]);

    useEffect(() => {
        setHeaderAvatarLoadFailed(false);
    }, [activeRoomId, dmParticipant?.avatarUrl, activeRoom?.avatarUrl]);

    useEffect(() => {
        if (!highlightedMessageId) return;
        const timer = window.setTimeout(() => setHighlightedMessageId(null), 1400);
        return () => window.clearTimeout(timer);
    }, [highlightedMessageId]);

    useEffect(() => {
        if (!roomSearchOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (roomSearchRef.current && !roomSearchRef.current.contains(event.target as Node)) {
                setRoomSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [roomSearchOpen]);

    useEffect(() => {
        if (!roomSearchOpen || !activeRoomId) return;
        const query = roomSearchQuery.trim();
        if (query.length < 2) {
            setRoomSearchResults([]);
            setRoomSearchLoading(false);
            setActiveSearchMatchIndex(0);
            return;
        }

        setRoomSearchLoading(true);
        const timer = window.setTimeout(() => {
            searchMessagesInRoom(activeRoomId, query, 50)
                .then((results) => {
                    setRoomSearchResults(results);
                    setActiveSearchMatchIndex(results.length > 0 ? 0 : 0);
                })
                .catch(() => setRoomSearchResults([]))
                .finally(() => setRoomSearchLoading(false));
        }, 180);

        return () => window.clearTimeout(timer);
    }, [roomSearchOpen, roomSearchQuery, activeRoomId, latestMessage?.id]);

    useEffect(() => {
        if (!pendingJumpMessageId) return;
        const targetIndex = messages.findIndex((msg) => msg.id === pendingJumpMessageId);
        if (targetIndex < 0) return;
        virtuosoRef.current?.scrollToIndex({
            index: targetIndex,
            align: 'center',
            behavior: 'smooth',
        });
        setHighlightedMessageId(pendingJumpMessageId);
        setPendingJumpMessageId(null);
    }, [pendingJumpMessageId, messages]);

    useEffect(() => {
        if (!jumpTarget || !activeRoomId) return;
        if (jumpTarget.roomId !== activeRoomId) return;
        setPendingJumpMessageId(jumpTarget.messageId);
        const exists = messages.some((msg) => msg.id === jumpTarget.messageId);
        if (!exists) {
            fetchMessageById(activeRoomId, jumpTarget.messageId)
                .then((message) => {
                    useChatStore.getState().upsertMessage(activeRoomId, message);
                })
                .catch(console.error);
        }
        clearJumpTarget();
    }, [jumpTarget, activeRoomId, clearJumpTarget, messages]);

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
        setActiveMenuMessageKey(null);
        setEditingMessage(message);
    };

    const handleCancelEdit = () => {
        setEditingMessage(null);
    };

    const handleDeleteMessage = (message: ChatMessage) => {
        if (!activeRoomId || !message.id) return;
        setActiveMenuMessageKey(null);
        deleteMessage(activeRoomId, message.id)
            .then((updated) => {
                useChatStore.getState().upsertMessage(activeRoomId, updated);
                if (editingMessage?.id === message.id) {
                    setEditingMessage(null);
                }
            })
            .catch(console.error);
    };

    const handleTogglePinMessage = (message: ChatMessage) => {
        if (!activeRoomId || !message.id) return;
        setActiveMenuMessageKey(null);
        const action = message.pinnedAt ? unpinMessage : pinMessage;
        action(activeRoomId, message.id)
            .then((updated) => {
                useChatStore.getState().upsertMessage(activeRoomId, updated);
            })
            .catch(console.error);
    };

    const handleTypingChange = useCallback((isTyping: boolean) => {
        if (!activeRoomId || connectionStatus !== 'connected') return;
        wsService.sendTyping(activeRoomId, isTyping);
    }, [activeRoomId, connectionStatus]);

    const getPinnedPreview = (message: ChatMessage): string => {
        const content = message.content?.trim();
        if (content) {
            return content.length > 88 ? `${content.slice(0, 88)}...` : content;
        }

        if (message.attachment?.fileName) {
            return `Attachment: ${message.attachment.fileName}`;
        }

        return 'Pinned message';
    };

    const handleJumpToPinnedMessage = () => {
        if (!pinnedMessage?.id) return;
        const targetIndex = messages.findIndex((msg) => msg.id === pinnedMessage.id);
        if (targetIndex < 0) return;
        virtuosoRef.current?.scrollToIndex({
            index: targetIndex,
            align: 'center',
            behavior: 'smooth',
        });
        setHighlightedMessageId(pinnedMessage.id);
    };

    const jumpToMessageById = useCallback((messageId: string) => {
        if (!activeRoomId) return;
        setPendingJumpMessageId(messageId);
        const exists = messages.some((msg) => msg.id === messageId);
        if (exists) return;
        fetchMessageById(activeRoomId, messageId)
            .then((message) => {
                useChatStore.getState().upsertMessage(activeRoomId, message);
            })
            .catch(console.error);
    }, [activeRoomId, messages]);

    const handleSelectSearchResult = (result: MessageSearchResult, index: number) => {
        setActiveSearchMatchIndex(index);
        jumpToMessageById(result.messageId);
        setRoomSearchOpen(false);
    };

    const handleCycleSearchResult = (direction: 1 | -1) => {
        if (roomSearchResults.length === 0) return;
        const total = roomSearchResults.length;
        const next = (activeSearchMatchIndex + direction + total) % total;
        setActiveSearchMatchIndex(next);
        jumpToMessageById(roomSearchResults[next].messageId);
    };

    if (!activeRoomId || !activeRoom) {
        return (
            <div className="chat-panel chat-panel--empty">
                <div className="chat-empty-state">
                    <div className="chat-empty-mark" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                    </div>
                    <h3 className="chat-empty-brand">
                        Whisprly<sup>™</sup>
                    </h3>
                    <p className="chat-empty-tagline">Whisper less. Connect more.</p>
                </div>
            </div>
        );
    }

    const headerName = isDmRoom ? (dmParticipant?.fullName?.trim() || dmParticipant?.username || dmNameFallback) : activeRoom.name;
    const headerAvatar = isDmRoom
        ? resolveMediaUrl(dmParticipant?.avatarUrl ?? null)
        : resolveMediaUrl(activeRoom.avatarUrl ?? null);
    const dmOnline = isUserOnline(dmParticipant?.id);
    const roomOnlineCount = activeRoom ? (onlineCountsByRoom[activeRoom.slug] ?? 0) : 0;
    const selfDestructSeconds = activeRoom?.selfDestructSeconds ?? null;
    const dmBlockedReason = isDmRoom
        ? (
            dmBlockState?.blocksCurrentUser
                ? 'You have been blocked by this user. You cannot send messages in this conversation.'
                : dmBlockState?.blockedByCurrentUser
                    ? 'You blocked this user. Unblock them from their profile to send messages again.'
                    : null
        )
        : null;
    const headerStatusText = isDmRoom
        ? (dmOnline ? 'Online' : 'Offline')
        : `${roomOnlineCount} online · ${activeRoom.memberCount} member${activeRoom.memberCount !== 1 ? 's' : ''}`;

    return (
        <div className="chat-panel">
            <header className="chat-header">
                <div className="chat-header__identity">
                    <div className="chat-header__avatar" aria-hidden="true">
                        {headerAvatar && !headerAvatarLoadFailed ? (
                            <img
                                src={headerAvatar}
                                alt=""
                                onError={() => setHeaderAvatarLoadFailed(true)}
                            />
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
                        {selfDestructSeconds && selfDestructSeconds > 0 && (
                            <span className="chat-header__ephemeral">
                                Auto-delete {formatSelfDestructLabel(selfDestructSeconds)}
                            </span>
                        )}
                    </div>
                </div>
                <div className="chat-header__actions">
                    <div className="chat-header__search" ref={roomSearchRef}>
                        <button
                            type="button"
                            className={`chat-header__search-btn ${roomSearchOpen ? 'is-open' : ''}`}
                            aria-label="Search in this conversation"
                            aria-expanded={roomSearchOpen}
                            onClick={() => {
                                setRoomSearchOpen((prev) => !prev);
                                setHeaderMenuOpen(false);
                            }}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" stroke="currentColor" strokeWidth="2" fill="none" />
                                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </button>
                        {roomSearchResults.length > 0 && (
                            <div className="chat-header__search-nav" aria-label="Search matches">
                                <button
                                    type="button"
                                    className="chat-header__search-nav-btn"
                                    onClick={() => handleCycleSearchResult(-1)}
                                    aria-label="Previous match"
                                >
                                    ↑
                                </button>
                                <span className="chat-header__search-nav-count">
                                    {activeSearchMatchIndex + 1}/{roomSearchResults.length}
                                </span>
                                <button
                                    type="button"
                                    className="chat-header__search-nav-btn"
                                    onClick={() => handleCycleSearchResult(1)}
                                    aria-label="Next match"
                                >
                                    ↓
                                </button>
                            </div>
                        )}
                        {roomSearchOpen && (
                            <div className="chat-header__search-popover" role="dialog" aria-label="Search this conversation">
                                <div className="chat-header__search-input-wrap">
                                    <input
                                        type="text"
                                        value={roomSearchQuery}
                                        onChange={(e) => setRoomSearchQuery(e.target.value)}
                                        placeholder="Search in this chat..."
                                        autoFocus
                                    />
                                </div>
                                <div className="chat-header__search-results">
                                    {roomSearchLoading && <div className="chat-header__search-empty">Searching...</div>}
                                    {!roomSearchLoading && roomSearchQuery.trim().length < 2 && (
                                        <div className="chat-header__search-empty">Type at least 2 characters</div>
                                    )}
                                    {!roomSearchLoading && roomSearchQuery.trim().length >= 2 && roomSearchResults.length === 0 && (
                                        <div className="chat-header__search-empty">No matches in this conversation</div>
                                    )}
                                    {roomSearchResults.map((result, index) => (
                                        <button
                                            key={result.messageId}
                                            type="button"
                                            className={`chat-header__search-item ${index === activeSearchMatchIndex ? 'is-active' : ''}`}
                                            onClick={() => handleSelectSearchResult(result, index)}
                                        >
                                            <span className="chat-header__search-item-preview">{result.preview}</span>
                                            <span className="chat-header__search-item-meta">
                                                {result.senderFullName?.trim() || result.senderUsername} · {formatSearchResultTime(result.createdAt)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
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
                                            navigate(`/chat/rooms/${encodeURIComponent(activeRoomId)}/settings`);
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

            {pinnedMessage && (
                <button
                    type="button"
                    className="chat-pinned-banner"
                    onClick={handleJumpToPinnedMessage}
                    aria-label="Jump to pinned message"
                >
                    <span className="chat-pinned-banner__icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 3h8l-2 6v3l3 3v2H7v-2l3-3V9L8 3z" fill="currentColor" />
                            <path d="M12 21v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </span>
                    <span className="chat-pinned-banner__content">
                        <span className="chat-pinned-banner__label">Pinned message</span>
                        <span className="chat-pinned-banner__preview">{getPinnedPreview(pinnedMessage)}</span>
                    </span>
                </button>
            )}

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
                            const next = index < messages.length - 1 ? messages[index + 1] : null;
                            const sameAsPrev = !!prev && prev.senderId === msg.senderId;
                            const sameAsNext = !!next && next.senderId === msg.senderId;
                            const groupPosition = sameAsPrev
                                ? (sameAsNext ? 'middle' : 'end')
                                : (sameAsNext ? 'start' : 'single');
                            const showAvatar = !prev || prev.senderId !== msg.senderId;
                            return (
                                <MessageBubble
                                    key={msg.id || msg.idempotencyKey}
                                    message={msg}
                                    isOwn={msg.senderId === userId}
                                    showAvatar={showAvatar}
                                    showSender={showAvatar}
                                    groupPosition={groupPosition}
                                    highlighted={msg.id === highlightedMessageId}
                                    showStatus
                                    menuOpen={activeMenuMessageKey === (msg.id || msg.idempotencyKey)}
                                    onMenuToggle={() => {
                                        const messageKey = msg.id || msg.idempotencyKey;
                                        setActiveMenuMessageKey((prev) => (prev === messageKey ? null : messageKey));
                                    }}
                                    onMenuClose={() => setActiveMenuMessageKey(null)}
                                    avatarUrl={isDmRoom ? dmParticipant?.avatarUrl : undefined}
                                    onEdit={handleStartEdit}
                                    onDelete={handleDeleteMessage}
                                    onTogglePin={handleTogglePinMessage}
                                />
                            );
                        }}
                    />
                )}
            </div>

            <div className="chat-composer">
                {typingStatusText && (
                    <div className="chat-presence-typing" aria-live="polite">
                        <span className="chat-presence-typing__dots" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                        </span>
                        <span>{typingStatusText}</span>
                    </div>
                )}

                {dmBlockedReason && (
                    <div className="chat-block-banner" role="status" aria-live="polite">
                        {dmBlockedReason}
                    </div>
                )}

                <ChatInput
                    onSendText={handleSend}
                    onTypingChange={handleTypingChange}
                    onUploadAttachment={handleUploadAttachment}
                    disabled={connectionStatus !== 'connected' || !!dmBlockedReason}
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
        </div>
    );
}

