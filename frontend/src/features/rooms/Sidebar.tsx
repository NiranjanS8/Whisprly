import { type FormEvent, useEffect, useState } from 'react';
import { useRoomStore } from './roomStore';
import { fetchRooms, createRoom, joinRoom } from './roomApi';
import { fetchIncomingDmRequests, sendDmRequest, acceptDmRequest, rejectDmRequest } from './dmRequestApi';
import type { DmRequest } from './dmRequestApi';
import type { Room } from './roomApi';
import { useAuthStore } from '../auth/authStore';
import { getInitials } from '../../shared/utils';
import './sidebar.css';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

type ComposerMode = 'none' | 'create' | 'join' | 'chat';

function formatRoomTimestamp(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();

    if (sameDay) {
        return new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(date);
    }

    return new Intl.DateTimeFormat([], { month: 'short', day: 'numeric' }).format(date);
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const { rooms, activeRoomId, setRooms, addRoom, setActiveRoom } = useRoomStore();
    const userId = useAuthStore((s) => s.userId);

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

    useEffect(() => {
        fetchRooms().then(setRooms).catch(console.error);
    }, [setRooms]);

    useEffect(() => {
        setLoadingIncoming(true);
        fetchIncomingDmRequests()
            .then(setIncomingRequests)
            .catch(console.error)
            .finally(() => setLoadingIncoming(false));
    }, []);

    useEffect(() => {
        const handleDocClick = () => {
            setRoomMenuOpenId(null);
            setActionMenuOpen(false);
        };

        document.addEventListener('click', handleDocClick);
        return () => document.removeEventListener('click', handleDocClick);
    }, []);

    const filteredRooms = rooms.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));

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
        onClose();
    };

    return (
        <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
            <div className="sidebar-header">
                <button className="sidebar-close" onClick={onClose} aria-label="Toggle sidebar">
                    ?
                </button>
            </div>

            <div className="sidebar-search-wrap">
                <div className="sidebar-section-title">Rooms</div>
                <div className="sidebar-search-field">
                    <span className="search-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" stroke="currentColor" strokeWidth="2" />
                            <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        placeholder="Search by room name"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Search rooms"
                    />
                </div>
            </div>

            <div className="sidebar-rooms" role="listbox" aria-label="Chat rooms">
                {filteredRooms.map((room) => (
                    <div
                        key={room.id}
                        className={`room-card ${activeRoomId === room.id ? 'room-card--active' : ''}`}
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
                        <div className="room-card__avatar">{getInitials(room.name)}</div>
                        <div className="room-card__content">
                            <div className="room-card__toprow">
                                <span className="room-card__name">{room.name}</span>
                                <span className="room-card__time">{formatRoomTimestamp(room.createdAt)}</span>
                            </div>
                            <span className="room-card__meta">
                                {room.memberCount} member{room.memberCount !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="room-card__actions" onClick={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                className="room-menu-trigger"
                                aria-label="Room actions"
                                onClick={() => setRoomMenuOpenId((prev) => (prev === room.id ? null : room.id))}
                            >
                                ?
                            </button>
                            {roomMenuOpenId === room.id && (
                                <div className="room-menu">
                                    <button type="button" onClick={() => copyText(room.id, 'Room ID')}>
                                        Copy Room ID
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {filteredRooms.length === 0 && (
                    <div className="sidebar-empty">{search ? 'No matching rooms' : 'No rooms yet'}</div>
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

            <div className="sidebar-fab-wrap" onClick={(e) => e.stopPropagation()}>
                {actionMenuOpen && (
                    <div className="fab-menu">
                        <button type="button" onClick={() => openComposer('create')}>New Room</button>
                        <button type="button" onClick={() => openComposer('join')}>Join Room</button>
                        <button type="button" onClick={() => openComposer('chat')}>New Chat</button>
                        <button
                            type="button"
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
                    className="sidebar-fab"
                    aria-label="Open quick actions"
                    onClick={() => setActionMenuOpen((prev) => !prev)}
                >
                    +
                </button>
            </div>

            {copiedText && <div className="floating-feedback">{copiedText}</div>}
        </aside>
    );
}
