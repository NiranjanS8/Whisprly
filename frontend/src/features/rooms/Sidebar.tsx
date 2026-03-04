import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoomStore } from './roomStore';
import { fetchRooms, createRoom, joinRoom, removeMember, deleteRoom, fetchRoomMembers, type Member, pinRoom, unpinRoom, markRoomRead } from './roomApi';
import { fetchIncomingDmRequests, sendDmRequest, acceptDmRequest, rejectDmRequest } from './dmRequestApi';
import type { DmRequest } from './dmRequestApi';
import type { Room } from './roomApi';
import { fetchUserSummary, type UserSummary } from '../profile/profileApi';
import { useAuthStore } from '../auth/authStore';
import { useChatStore } from '../chat/chatStore';
import { fetchMessages } from '../chat/messageApi';
import { wsService } from '../chat/websocket';
import { usePresenceStore } from '../presence/presenceStore';
import { getInitials, resolveMediaUrl } from '../../shared/utils';
import './sidebar.css';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

type ComposerMode = 'none' | 'create' | 'join' | 'chat';

interface DmConversationMenuProps {
    room: Room;
    muted: boolean;
    blocked: boolean;
    pinned: boolean;
    onViewProfile: (room: Room) => Promise<void>;
    onToggleMute: (roomId: string) => void;
    onTogglePin: (roomId: string) => void;
    onClearChat: (roomId: string) => void;
    onToggleBlockUser: (room: Room) => Promise<void>;
}

function DmConversationMenu({
    room,
    muted,
    blocked,
    pinned,
    onViewProfile,
    onToggleMute,
    onTogglePin,
    onClearChat,
    onToggleBlockUser,
}: DmConversationMenuProps) {
    return (
        <div className="room-menu" role="menu" aria-label="Direct message actions">
            <button type="button" className="room-menu__item" onClick={() => onTogglePin(room.id)}>
                {pinned ? 'Unpin Conversation' : 'Pin Conversation'}
            </button>
            <button type="button" className="room-menu__item" onClick={() => onViewProfile(room)}>
                View Profile
            </button>
            <button type="button" className="room-menu__item" onClick={() => onToggleMute(room.id)}>
                {muted ? 'Unmute Conversation' : 'Mute Conversation'}
            </button>
            <button type="button" className="room-menu__item" onClick={() => onClearChat(room.id)}>
                Clear Chat
            </button>
            <div className="room-menu__divider" aria-hidden="true" />
            <button type="button" className="room-menu__item room-menu__item--danger" onClick={() => onToggleBlockUser(room)}>
                {blocked ? 'Unblock User' : 'Block User'}
            </button>
        </div>
    );
}

interface RoomConversationMenuProps {
    room: Room;
    muted: boolean;
    pinned: boolean;
    onCopyRoomId: (roomId: string) => Promise<void>;
    onRoomInfo: (room: Room) => void;
    onToggleMute: (roomId: string) => void;
    onTogglePin: (roomId: string) => void;
    onLeaveRoom: (roomId: string) => Promise<void>;
    onDeleteRoom: (room: Room) => Promise<void>;
}

function RoomConversationMenu({
    room,
    muted,
    pinned,
    onCopyRoomId,
    onRoomInfo,
    onToggleMute,
    onTogglePin,
    onLeaveRoom,
    onDeleteRoom,
}: RoomConversationMenuProps) {
    return (
        <div className="room-menu" role="menu" aria-label="Room actions">
            <button type="button" className="room-menu__item" onClick={() => onTogglePin(room.id)}>
                {pinned ? 'Unpin Room' : 'Pin Room'}
            </button>
            <button type="button" className="room-menu__item" onClick={() => onCopyRoomId(room.id)}>
                Copy Room ID
            </button>
            <button type="button" className="room-menu__item" onClick={() => onRoomInfo(room)}>
                Room Settings
            </button>
            <button type="button" className="room-menu__item" onClick={() => onToggleMute(room.id)}>
                {muted ? 'Unmute' : 'Mute'}
            </button>
            <div className="room-menu__divider" aria-hidden="true" />
            <button type="button" className="room-menu__item" onClick={() => onLeaveRoom(room.id)}>
                Leave Room
            </button>
            <button type="button" className="room-menu__item room-menu__item--danger" onClick={() => onDeleteRoom(room)}>
                Delete
            </button>
        </div>
    );
}

function formatRoomTimestamp(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 60_000) return 'now';
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m`;
    if (diffMs < 86_400_000 && date.toDateString() === now.toDateString()) {
        return new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(date);
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }

    if (diffMs < 604_800_000) {
        return new Intl.DateTimeFormat([], { weekday: 'short' }).format(date);
    }

    const isSameYear = date.getFullYear() === now.getFullYear();
    return new Intl.DateTimeFormat([], isSameYear
        ? { month: 'short', day: 'numeric' }
        : { month: 'short', day: 'numeric', year: 'numeric' }
    ).format(date);
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const navigate = useNavigate();
    const {
        rooms,
        activeRoomId,
        setRooms,
        addRoom,
        setActiveRoom,
        setRoomUnreadCount,
        onlineCountsByRoom,
        setOnlineCountsByRoom,
        lastActivityByRoom,
        setLastActivityByRoom,
    } = useRoomStore();
    const clearRoomMessages = useChatStore((s) => s.clearRoom);
    const userId = useAuthStore((s) => s.userId);
    const username = useAuthStore((s) => s.username);
    const onlineByUserId = usePresenceStore((s) => s.onlineByUserId);

    const [composerMode, setComposerMode] = useState<ComposerMode>('none');
    const [actionMenuOpen, setActionMenuOpen] = useState(false);
    const [roomMenuOpenId, setRoomMenuOpenId] = useState<string | null>(null);

    const [newRoomName, setNewRoomName] = useState('');
    const [joinRoomId, setJoinRoomId] = useState('');
    const [targetUserId, setTargetUserId] = useState('');

    const [creating, setCreating] = useState(false);
    const [joining, setJoining] = useState(false);
    const [sendingDmRequest, setSendingDmRequest] = useState(false);

    const [composerError, setComposerError] = useState('');
    const [composerSuccess, setComposerSuccess] = useState('');
    const [copiedText, setCopiedText] = useState('');

    const [incomingRequests, setIncomingRequests] = useState<DmRequest[]>([]);
    const [loadingIncoming, setLoadingIncoming] = useState(false);
    const [search, setSearch] = useState('');
    const [mutedRoomIds, setMutedRoomIds] = useState<Record<string, boolean>>({});
    const [blockedDmRoomIds, setBlockedDmRoomIds] = useState<Record<string, boolean>>({});
    const [dmDisplayNameByRoom, setDmDisplayNameByRoom] = useState<Record<string, string>>({});
    const [dmAvatarUrlByRoom, setDmAvatarUrlByRoom] = useState<Record<string, string | null>>({});
    const [roomMemberIdsByRoom, setRoomMemberIdsByRoom] = useState<Record<string, string[]>>({});
    const [avatarLoadErrorByRoom, setAvatarLoadErrorByRoom] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchRooms().then(setRooms).catch(console.error);
    }, [setRooms]);

    useEffect(() => {
        if (rooms.length === 0) {
            setLastActivityByRoom({});
            return;
        }

        let cancelled = false;

        const loadLastActivity = async () => {
            const nextActivity: Record<string, string> = {};
            rooms.forEach((room) => {
                nextActivity[room.id] = room.createdAt;
            });

            const latestMessages = await Promise.all(
                rooms.map((room) => fetchMessages(room.id, 0, 20).catch(() => []))
            );

            for (let index = 0; index < rooms.length; index++) {
                const room = rooms[index];
                const latestForRoom = (latestMessages[index] ?? []).reduce<string | null>((latestAt, msg) => {
                    if (!latestAt) return msg.createdAt;
                    return new Date(msg.createdAt).getTime() > new Date(latestAt).getTime()
                        ? msg.createdAt
                        : latestAt;
                }, null);
                if (latestForRoom) {
                    nextActivity[room.id] = latestForRoom;
                }
            }

            if (!cancelled) {
                const current = useRoomStore.getState().lastActivityByRoom;
                const merged: Record<string, string> = { ...nextActivity };
                Object.entries(current).forEach(([roomId, currentValue]) => {
                    if (!(roomId in merged)) return;
                    const mergedValue = merged[roomId];
                    if (new Date(currentValue).getTime() > new Date(mergedValue).getTime()) {
                        merged[roomId] = currentValue;
                    }
                });
                setLastActivityByRoom(merged);
            }
        };

        loadLastActivity().catch(console.error);
        return () => {
            cancelled = true;
        };
    }, [rooms, setLastActivityByRoom]);

    useEffect(() => {
        if (rooms.length === 0) return;
        rooms.forEach((room) => wsService.subscribeToRoom(room.id));
        return () => {
            rooms.forEach((room) => wsService.unsubscribeFromRoom(room.id));
        };
    }, [rooms]);

    useEffect(() => {
        setLoadingIncoming(true);
        fetchIncomingDmRequests()
            .then(setIncomingRequests)
            .catch(console.error)
            .finally(() => setLoadingIncoming(false));
    }, []);

    useEffect(() => {
        if (rooms.length === 0) {
            setRoomMemberIdsByRoom({});
            setDmDisplayNameByRoom({});
            setDmAvatarUrlByRoom({});
            setOnlineCountsByRoom({});
            return;
        }

        let cancelled = false;

        const loadRoomMembers = async () => {
            try {
                const memberLists = await Promise.all(
                    rooms.map((room) => fetchRoomMembers(room.id).catch((): Member[] => []))
                );

                const memberIdsByRoom: Record<string, string[]> = {};
                const dmNames: Record<string, string> = {};
                const dmAvatars: Record<string, string | null> = {};

                for (let index = 0; index < rooms.length; index++) {
                    const room = rooms[index];
                    const members = memberLists[index] || [];
                    memberIdsByRoom[room.id] = members.map((member) => member.userId);

                    if (room.type === 'DM' && userId) {
                        const otherMember = members.find((member) => member.userId !== userId);
                        if (otherMember) {
                            const summary = await fetchUserSummary(otherMember.userId).catch((): UserSummary | null => null);
                            if (summary) {
                                dmNames[room.id] = summary.fullName?.trim() || summary.username;
                                dmAvatars[room.id] = summary.avatarUrl ?? null;
                            }
                        }
                    }
                }

                if (!cancelled) {
                    setRoomMemberIdsByRoom(memberIdsByRoom);
                    setDmDisplayNameByRoom(dmNames);
                    setDmAvatarUrlByRoom(dmAvatars);
                }
            } catch {
                if (!cancelled) {
                    setRoomMemberIdsByRoom({});
                    setDmDisplayNameByRoom({});
                    setDmAvatarUrlByRoom({});
                }
            }
        };

        loadRoomMembers();
        return () => {
            cancelled = true;
        };
    }, [rooms, userId, setOnlineCountsByRoom]);

    useEffect(() => {
        const counts: Record<string, number> = {};
        Object.entries(roomMemberIdsByRoom).forEach(([roomId, memberIds]) => {
            counts[roomId] = memberIds.reduce((total, memberId) => total + (onlineByUserId[memberId] ? 1 : 0), 0);
        });
        setOnlineCountsByRoom(counts);
    }, [roomMemberIdsByRoom, onlineByUserId, setOnlineCountsByRoom]);

    useEffect(() => {
        const handleDocClick = () => {
            setRoomMenuOpenId(null);
            setActionMenuOpen(false);
        };

        document.addEventListener('click', handleDocClick);
        return () => document.removeEventListener('click', handleDocClick);
    }, []);

    const normalizedSearch = search.trim().toLowerCase();

    const getRoomActivityAt = (room: Room): string => lastActivityByRoom[room.id] ?? room.createdAt;
    const byPinnedActivity = (a: Room, b: Room): number => {
        const aPinned = Boolean(a.pinnedAt);
        const bPinned = Boolean(b.pinnedAt);
        if (aPinned !== bPinned) return aPinned ? -1 : 1;
        const aUnread = (a.unreadCount ?? 0) > 0;
        const bUnread = (b.unreadCount ?? 0) > 0;
        if (aUnread !== bUnread) return aUnread ? -1 : 1;
        return new Date(getRoomActivityAt(b)).getTime() - new Date(getRoomActivityAt(a)).getTime();
    };

    const getDirectMessageName = (room: Room): string => {
        const knownDisplayName = dmDisplayNameByRoom[room.id];
        if (knownDisplayName && knownDisplayName.trim()) return knownDisplayName;

        const roomName = room.name?.trim() || 'Direct Message';
        if (!username) return roomName;

        const participants = roomName.split('&').map((part) => part.trim()).filter(Boolean);
        if (participants.length === 2) {
            const other = participants.find((part) => part.toLowerCase() !== username.toLowerCase());
            if (other) return other;
        }
        return roomName;
    };

    const matchesSearch = (room: Room): boolean => {
        if (!normalizedSearch) return true;
        const displayName = room.type === 'DM' ? getDirectMessageName(room) : room.name;
        return displayName.toLowerCase().includes(normalizedSearch);
    };

    const getRoomAvatarUrl = (room: Room): string | null => {
        const rawAvatar = room.type === 'DM'
            ? (dmAvatarUrlByRoom[room.id] ?? null)
            : (room.avatarUrl ?? null);
        const resolved = resolveMediaUrl(rawAvatar);
        if (!resolved) return null;
        return avatarLoadErrorByRoom[room.id] === resolved ? null : resolved;
    };

    const handleAvatarLoadError = (roomId: string, url: string) => {
        setAvatarLoadErrorByRoom((prev) => (prev[roomId] === url ? prev : { ...prev, [roomId]: url }));
    };

    const renderRoomAvatar = (room: Room, fallbackName: string) => {
        const avatarUrl = getRoomAvatarUrl(room);
        return (
            <div className="room-card__avatar">
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt=""
                        onError={() => handleAvatarLoadError(room.id, avatarUrl)}
                    />
                ) : (
                    getInitials(fallbackName)
                )}
            </div>
        );
    };

    const directMessages = rooms
        .filter((room) => room.type === 'DM')
        .filter(matchesSearch)
        .sort(byPinnedActivity);

    const groupRooms = rooms
        .filter((room) => room.type !== 'DM')
        .filter(matchesSearch)
        .sort(byPinnedActivity);

    const isDmPeerOnline = (room: Room): boolean => {
        const onlineCount = onlineCountsByRoom[room.id] ?? 0;
        return onlineCount > 1;
    };

    const copyText = async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedText(`${label} copied`);
            setTimeout(() => setCopiedText(''), 1500);
        } catch {
            setCopiedText(`Failed to copy ${label.toLowerCase()}`);
            setTimeout(() => setCopiedText(''), 1500);
        }
    };

    const openComposer = (mode: ComposerMode) => {
        setComposerMode(mode);
        setActionMenuOpen(false);
        setComposerError('');
        setComposerSuccess('');
    };

    const closeComposer = () => {
        setComposerMode('none');
        setComposerError('');
        setComposerSuccess('');
    };

    const handleCreateRoom = async (e: FormEvent) => {
        e.preventDefault();
        if (!newRoomName.trim() || creating) return;

        setCreating(true);
        setComposerError('');

        try {
            const room = await createRoom(newRoomName.trim());
            addRoom(room);
            setActiveRoom(room.id);
            setNewRoomName('');
            closeComposer();
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Failed to create room';
            setComposerError(msg);
        } finally {
            setCreating(false);
        }
    };

    const handleJoinRoom = async (e: FormEvent) => {
        e.preventDefault();
        if (!joinRoomId.trim() || joining) return;

        setJoining(true);
        setComposerError('');

        try {
            const room = await joinRoom(joinRoomId.trim());
            addRoom(room);
            setActiveRoom(room.id);
            setJoinRoomId('');
            closeComposer();
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Failed to join room';
            setComposerError(msg);
        } finally {
            setJoining(false);
        }
    };

    const handleSendDmRequest = async (e: FormEvent) => {
        e.preventDefault();
        if (!targetUserId.trim() || sendingDmRequest) return;

        setSendingDmRequest(true);
        setComposerError('');
        setComposerSuccess('');

        try {
            await sendDmRequest(targetUserId.trim());
            setTargetUserId('');
            setComposerSuccess('Request sent');
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Failed to send request';
            setComposerError(msg);
        } finally {
            setSendingDmRequest(false);
        }
    };

    const handleAcceptRequest = async (requestId: string) => {
        try {
            const room = await acceptDmRequest(requestId);
            addRoom(room);
            setActiveRoom(room.id);
            setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Failed to accept request';
            setComposerError(msg);
        }
    };

    const handleRejectRequest = async (requestId: string) => {
        try {
            await rejectDmRequest(requestId);
            setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Failed to reject request';
            setComposerError(msg);
        }
    };

    const selectRoom = (room: Room) => {
        setActiveRoom(room.id);
        setRoomUnreadCount(room.id, 0);
        markRoomRead(room.id)
            .then((update) => {
                setRoomUnreadCount(update.roomId, update.unreadCount ?? 0);
            })
            .catch(console.error);
        navigate('/chat');
        onClose();
    };

    const handleRoomInfo = (room: Room) => {
        setActiveRoom(room.id);
        navigate(`/chat/rooms/${room.id}/settings`);
        setRoomMenuOpenId(null);
        onClose();
    };

    const handleToggleMute = (roomId: string) => {
        const willMute = !mutedRoomIds[roomId];
        setMutedRoomIds((prev) => ({ ...prev, [roomId]: willMute }));
        setCopiedText(willMute ? 'Room muted' : 'Room unmuted');
        setTimeout(() => setCopiedText(''), 1800);
        setRoomMenuOpenId(null);
    };

    const handleTogglePin = async (roomId: string) => {
        const target = rooms.find((room) => room.id === roomId);
        if (!target) return;
        try {
            const updated = target.pinnedAt ? await unpinRoom(roomId) : await pinRoom(roomId);
            setRooms(rooms.map((room) => (room.id === roomId ? updated : room)));
            setCopiedText(updated.pinnedAt ? 'Room pinned' : 'Room unpinned');
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Failed to update pin';
            setCopiedText(msg);
        } finally {
            setTimeout(() => setCopiedText(''), 1800);
            setRoomMenuOpenId(null);
        }
    };

    const getDmParticipantSummary = async (room: Room): Promise<UserSummary | null> => {
        if (!userId) return null;
        const members = await fetchRoomMembers(room.id);
        const other = members.find((member) => member.userId !== userId);
        if (!other) return null;
        return fetchUserSummary(other.userId);
    };

    const handleViewDmProfile = async (room: Room) => {
        try {
            const summary = await getDmParticipantSummary(room);
            if (!summary) {
                setCopiedText('Participant profile not available');
                setTimeout(() => setCopiedText(''), 1800);
                return;
            }
            navigate(`/profile?userId=${summary.id}`);
            onClose();
        } catch {
            setCopiedText('Failed to open profile');
            setTimeout(() => setCopiedText(''), 1800);
        } finally {
            setRoomMenuOpenId(null);
        }
    };

    const handleToggleDmMute = (roomId: string) => {
        const willMute = !mutedRoomIds[roomId];
        setMutedRoomIds((prev) => ({ ...prev, [roomId]: willMute }));
        setCopiedText(willMute ? 'Conversation muted' : 'Conversation unmuted');
        setTimeout(() => setCopiedText(''), 1800);
        setRoomMenuOpenId(null);
    };

    const handleClearDmChat = (roomId: string) => {
        clearRoomMessages(roomId);
        setCopiedText('Chat cleared');
        setTimeout(() => setCopiedText(''), 1800);
        setRoomMenuOpenId(null);
    };

    const handleToggleBlockDmUser = async (room: Room) => {
        try {
            const summary = await getDmParticipantSummary(room);
            if (!summary) {
                setCopiedText('Participant not found');
                setTimeout(() => setCopiedText(''), 1800);
                return;
            }
            const willBlock = !blockedDmRoomIds[room.id];
            setBlockedDmRoomIds((prev) => ({ ...prev, [room.id]: willBlock }));
            const displayName = summary.fullName?.trim() || summary.username;
            setCopiedText(willBlock ? `${displayName} blocked` : `${displayName} unblocked`);
            setTimeout(() => setCopiedText(''), 1800);
        } catch {
            setCopiedText('Failed to update block state');
            setTimeout(() => setCopiedText(''), 1800);
        } finally {
            setRoomMenuOpenId(null);
        }
    };

    const handleLeaveRoom = async (roomId: string) => {
        if (!userId) return;
        try {
            await removeMember(roomId, userId);
            const nextRooms = rooms.filter((room) => room.id !== roomId);
            setRooms(nextRooms);
            if (activeRoomId === roomId) {
                setActiveRoom(nextRooms.length > 0 ? nextRooms[0].id : null);
            }
            setCopiedText('You left the room');
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Failed to leave room';
            setCopiedText(msg);
        } finally {
            setTimeout(() => setCopiedText(''), 1800);
            setRoomMenuOpenId(null);
        }
    };

    const handleDeleteRoom = async (room: Room) => {
        if (room.createdById !== userId) {
            setCopiedText('Only room owner can delete');
            setTimeout(() => setCopiedText(''), 1800);
            setRoomMenuOpenId(null);
            return;
        }

        try {
            await deleteRoom(room.id);
            const nextRooms = rooms.filter((item) => item.id !== room.id);
            setRooms(nextRooms);
            if (activeRoomId === room.id) {
                setActiveRoom(nextRooms.length > 0 ? nextRooms[0].id : null);
            }
            setCopiedText('Room deleted');
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Failed to delete room';
            setCopiedText(msg);
        } finally {
            setTimeout(() => setCopiedText(''), 1800);
            setRoomMenuOpenId(null);
        }
    };

    return (
        <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
            <div className="sidebar-search-wrap">
                <div className="sidebar-section-title">Search</div>
                <div className="sidebar-search-field">
                    <span className="search-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" stroke="currentColor" strokeWidth="2" />
                            <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        placeholder="Search rooms and direct messages"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Search rooms and direct messages"
                    />
                </div>
            </div>

            <div className="sidebar-rooms" role="listbox" aria-label="Chat rooms">
                <section className="chat-section" aria-label="Direct Messages">
                    <div className="chat-section-title">
                        <span>Direct Messages</span>
                        <span className="chat-section-count">{directMessages.length}</span>
                    </div>
                    {directMessages.map((room) => (
                        <div
                            key={room.id}
                            className={`room-card ${activeRoomId === room.id ? 'room-card--active' : ''} ${(room.unreadCount ?? 0) > 0 && activeRoomId !== room.id ? 'room-card--unread' : ''}`}
                            onClick={() => selectRoom(room)}
                            role="option"
                            aria-selected={activeRoomId === room.id}
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    selectRoom(room);
                                }
                            }}
                        >
                            {renderRoomAvatar(room, getDirectMessageName(room))}
                            <div className="room-card__content">
                            <div className="room-card__toprow">
                                <span className="room-card__name">
                                    {getDirectMessageName(room)}
                                    {(room.unreadCount ?? 0) > 0 && (
                                        <span className="room-card__unread-badge" aria-label={`${room.unreadCount} unread`}>
                                            {room.unreadCount! > 99 ? '99+' : room.unreadCount}
                                        </span>
                                    )}
                                    {room.pinnedAt && (
                                        <span className="room-card__pin" aria-label="Pinned">
                                            <svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M8 3h8l-2 6v3l3 3v2H7v-2l3-3V9L8 3z" fill="currentColor" />
                                                <path d="M12 21v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                            </svg>
                                        </span>
                                    )}
                                </span>
                                <span className="room-card__time">{formatRoomTimestamp(getRoomActivityAt(room))}</span>
                            </div>
                                <span className="room-card__meta">
                                    <span className={`room-card__online-dot ${isDmPeerOnline(room) ? 'room-card__online-dot--online' : 'room-card__online-dot--offline'}`} aria-hidden="true" />
                                    {isDmPeerOnline(room) ? 'Online' : 'Offline'}
                                </span>
                            </div>
                            <div className="room-card__actions" onClick={(e) => e.stopPropagation()}>
                                <button
                                    type="button"
                                    className="room-menu-trigger"
                                    aria-label="Room actions"
                                    onClick={() => setRoomMenuOpenId((prev) => (prev === room.id ? null : room.id))}
                                >
                                    <svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="12" cy="5" r="1.8" fill="currentColor" />
                                        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                                        <circle cx="12" cy="19" r="1.8" fill="currentColor" />
                                    </svg>
                                </button>
                                {roomMenuOpenId === room.id && (
                                    <DmConversationMenu
                                        room={room}
                                        muted={Boolean(mutedRoomIds[room.id])}
                                        blocked={Boolean(blockedDmRoomIds[room.id])}
                                        pinned={Boolean(room.pinnedAt)}
                                        onViewProfile={handleViewDmProfile}
                                        onToggleMute={handleToggleDmMute}
                                        onTogglePin={handleTogglePin}
                                        onClearChat={handleClearDmChat}
                                        onToggleBlockUser={handleToggleBlockDmUser}
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                    {directMessages.length === 0 && (
                        <div className="section-empty">{normalizedSearch ? 'No matching direct messages' : 'No direct messages'}</div>
                    )}
                </section>

                <section className="chat-section" aria-label="Rooms">
                    <div className="chat-section-title">
                        <span>Rooms</span>
                        <span className="chat-section-count">{groupRooms.length}</span>
                    </div>
                    {groupRooms.map((room) => (
                    <div
                        key={room.id}
                        className={`room-card ${activeRoomId === room.id ? 'room-card--active' : ''} ${(room.unreadCount ?? 0) > 0 && activeRoomId !== room.id ? 'room-card--unread' : ''}`}
                        onClick={() => selectRoom(room)}
                        role="option"
                        aria-selected={activeRoomId === room.id}
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                selectRoom(room);
                            }
                        }}
                    >
                        {renderRoomAvatar(room, room.name)}
                        <div className="room-card__content">
                            <div className="room-card__toprow">
                                <span className="room-card__name">
                                    {room.name}
                                    {(room.unreadCount ?? 0) > 0 && (
                                        <span className="room-card__unread-badge" aria-label={`${room.unreadCount} unread`}>
                                            {room.unreadCount! > 99 ? '99+' : room.unreadCount}
                                        </span>
                                    )}
                                    {room.pinnedAt && (
                                        <span className="room-card__pin" aria-label="Pinned">
                                            <svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M8 3h8l-2 6v3l3 3v2H7v-2l3-3V9L8 3z" fill="currentColor" />
                                                <path d="M12 21v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                            </svg>
                                        </span>
                                    )}
                                </span>
                                <span className="room-card__time">{formatRoomTimestamp(getRoomActivityAt(room))}</span>
                            </div>
                            <span className="room-card__meta">
                                <span className="room-card__online-dot room-card__online-dot--online" aria-hidden="true" />
                                {onlineCountsByRoom[room.id] ?? 0} online - {room.memberCount} member{room.memberCount !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="room-card__actions" onClick={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                className="room-menu-trigger"
                                aria-label="Room actions"
                                onClick={() => setRoomMenuOpenId((prev) => (prev === room.id ? null : room.id))}
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="5" r="1.8" fill="currentColor" />
                                    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                                    <circle cx="12" cy="19" r="1.8" fill="currentColor" />
                                </svg>
                            </button>
                            {roomMenuOpenId === room.id && (
                                <RoomConversationMenu
                                    room={room}
                                    muted={Boolean(mutedRoomIds[room.id])}
                                    pinned={Boolean(room.pinnedAt)}
                                    onCopyRoomId={(roomId) => copyText(roomId, 'Room ID')}
                                    onRoomInfo={handleRoomInfo}
                                    onToggleMute={handleToggleMute}
                                    onTogglePin={handleTogglePin}
                                    onLeaveRoom={handleLeaveRoom}
                                    onDeleteRoom={handleDeleteRoom}
                                />
                            )}
                        </div>
                    </div>
                    ))}
                    {groupRooms.length === 0 && (
                        <div className="section-empty">{normalizedSearch ? 'No matching rooms' : 'No rooms yet'}</div>
                    )}
                </section>

                {directMessages.length === 0 && groupRooms.length === 0 && (
                    <div className="sidebar-empty">{normalizedSearch ? 'No chats found' : 'No chats yet'}</div>
                )}
            </div>

            {(loadingIncoming || incomingRequests.length > 0) && (
                <div className="requests-section">
                    <div className="sidebar-section-title">Requests</div>
                    {loadingIncoming ? (
                        <div className="requests-empty">Loading...</div>
                    ) : (
                        incomingRequests.map((request) => (
                            <div key={request.id} className="request-card">
                                <div className="request-main">
                                    <div className="request-name">{request.requesterUsername}</div>
                                    <div className="request-sub">New chat request</div>
                                </div>
                                <div className="request-actions">
                                    <button type="button" className="request-accept" onClick={() => handleAcceptRequest(request.id)}>
                                        Accept
                                    </button>
                                    <button type="button" className="request-reject" onClick={() => handleRejectRequest(request.id)}>
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {composerMode !== 'none' && (
                <div className="composer-panel">
                    {composerMode === 'create' && (
                        <form className="composer-form" onSubmit={handleCreateRoom}>
                            <h4>Create Room</h4>
                            <input
                                type="text"
                                placeholder="Enter room name"
                                value={newRoomName}
                                onChange={(e) => {
                                    setNewRoomName(e.target.value);
                                    setComposerError('');
                                }}
                                maxLength={50}
                                autoFocus
                            />
                            {composerError && <div className="form-error">{composerError}</div>}
                            <div className="composer-actions">
                                <button type="button" className="secondary-btn" onClick={closeComposer}>Cancel</button>
                                <button type="submit" className="primary-btn" disabled={creating || !newRoomName.trim()}>
                                    {creating ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </form>
                    )}

                    {composerMode === 'join' && (
                        <form className="composer-form" onSubmit={handleJoinRoom}>
                            <h4>Join Room</h4>
                            <input
                                type="text"
                                placeholder="Paste Room ID"
                                value={joinRoomId}
                                onChange={(e) => {
                                    setJoinRoomId(e.target.value);
                                    setComposerError('');
                                }}
                                autoFocus
                            />
                            <div className="form-helper">Ask a friend to share their Room ID.</div>
                            {composerError && <div className="form-error">{composerError}</div>}
                            <div className="composer-actions">
                                <button type="button" className="secondary-btn" onClick={closeComposer}>Cancel</button>
                                <button type="submit" className="primary-btn" disabled={joining || !joinRoomId.trim()}>
                                    {joining ? 'Joining...' : 'Join'}
                                </button>
                            </div>
                        </form>
                    )}

                    {composerMode === 'chat' && (
                        <form className="composer-form" onSubmit={handleSendDmRequest}>
                            <h4>New Chat</h4>
                            <input
                                type="text"
                                placeholder="Paste User ID"
                                value={targetUserId}
                                onChange={(e) => {
                                    setTargetUserId(e.target.value);
                                    setComposerError('');
                                    setComposerSuccess('');
                                }}
                                autoFocus
                            />
                            <div className="form-helper">Ask a friend to share their User ID.</div>
                            {composerError && <div className="form-error">{composerError}</div>}
                            {composerSuccess && <div className="form-success">{composerSuccess}</div>}
                            <div className="composer-actions">
                                <button type="button" className="secondary-btn" onClick={closeComposer}>Cancel</button>
                                <button type="submit" className="primary-btn" disabled={sendingDmRequest || !targetUserId.trim()}>
                                    {sendingDmRequest ? 'Sending...' : 'Send Request'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            <div className="sidebar-action-bar" onClick={(e) => e.stopPropagation()}>
                <div className="sidebar-action-wrap">
                    {actionMenuOpen && (
                        <div className="room-menu sidebar-action-menu" role="menu" aria-label="Create or join actions">
                            <button type="button" className="room-menu__item" onClick={() => openComposer('create')}>Create Room</button>
                            <button type="button" className="room-menu__item" onClick={() => openComposer('join')}>Join Room</button>
                            <button type="button" className="room-menu__item" onClick={() => openComposer('chat')}>New Chat</button>
                            <div className="room-menu__divider" aria-hidden="true" />
                            <button
                                type="button"
                                className="room-menu__item"
                                onClick={() => {
                                    if (userId) {
                                        copyText(userId, 'User ID');
                                    }
                                    setActionMenuOpen(false);
                                }}
                                disabled={!userId}
                            >
                                Copy My User ID
                            </button>
                        </div>
                    )}
                    <button
                        type="button"
                        className="sidebar-action-btn"
                        aria-label="Create new room or chat"
                        aria-expanded={actionMenuOpen}
                        onClick={() => setActionMenuOpen((prev) => !prev)}
                    >
                        New Room
                    </button>
                </div>
            </div>

            {copiedText && <div className="floating-feedback">{copiedText}</div>}
        </aside>
    );
}


