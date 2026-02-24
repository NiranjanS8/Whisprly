import { type FormEvent, useState, useEffect } from 'react';
import { useRoomStore } from './roomStore';
import { fetchRooms, createRoom, joinRoom } from './roomApi';
import { fetchIncomingDmRequests, sendDmRequest, acceptDmRequest, rejectDmRequest } from './dmRequestApi';
import type { DmRequest } from './dmRequestApi';
import type { Room } from './roomApi';
import { useAuthStore } from '../auth/authStore';
import { getInitials, formatTime } from '../../shared/utils';
import './sidebar.css';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const { rooms, activeRoomId, setRooms, addRoom, setActiveRoom } = useRoomStore();
    const userId = useAuthStore((s) => s.userId);
    const [showCreate, setShowCreate] = useState(false);
    const [showJoin, setShowJoin] = useState(false);
    const [showDmRequest, setShowDmRequest] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');
    const [joinRoomId, setJoinRoomId] = useState('');
    const [targetUserId, setTargetUserId] = useState('');
    const [creating, setCreating] = useState(false);
    const [joining, setJoining] = useState(false);
    const [sendingDmRequest, setSendingDmRequest] = useState(false);
    const [createError, setCreateError] = useState('');
    const [joinError, setJoinError] = useState('');
    const [dmError, setDmError] = useState('');
    const [dmSuccess, setDmSuccess] = useState('');
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

    const handleCreateRoom = async (e: FormEvent) => {
        e.preventDefault();
        if (!newRoomName.trim() || creating) return;
        setCreating(true);
        setCreateError('');
        try {
            const room = await createRoom(newRoomName.trim());
            addRoom(room);
            setActiveRoom(room.id);
            setNewRoomName('');
            setSearch('');
            setShowCreate(false);
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Failed to create room';
            setCreateError(msg);
        } finally {
            setCreating(false);
        }
    };

    const handleJoinRoom = async (e: FormEvent) => {
        e.preventDefault();
        if (!joinRoomId.trim() || joining) return;
        setJoining(true);
        setJoinError('');
        try {
            const room = await joinRoom(joinRoomId.trim());
            addRoom(room);
            setActiveRoom(room.id);
            setJoinRoomId('');
            setShowJoin(false);
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Failed to join room';
            setJoinError(msg);
        } finally {
            setJoining(false);
        }
    };

    const handleSendDmRequest = async (e: FormEvent) => {
        e.preventDefault();
        if (!targetUserId.trim() || sendingDmRequest) return;

        setSendingDmRequest(true);
        setDmError('');
        setDmSuccess('');

        try {
            await sendDmRequest(targetUserId.trim());
            setDmSuccess('Request sent');
            setTargetUserId('');
            setShowDmRequest(false);
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Failed to send request';
            setDmError(msg);
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
            setDmError(msg);
        }
    };

    const handleRejectRequest = async (requestId: string) => {
        try {
            await rejectDmRequest(requestId);
            setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Failed to reject request';
            setDmError(msg);
        }
    };

    const selectRoom = (room: Room) => {
        setActiveRoom(room.id);
        onClose();
    };

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

    return (
        <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
            <div className="sidebar-header">
                <button className="sidebar-close" onClick={onClose} aria-label="Close sidebar">
                    X Close
                </button>
            </div>

            <div className="sidebar__search">
                <input
                    type="text"
                    placeholder="Search rooms..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search rooms"
                />
            </div>
            <div className="identity-panel">
                <div className="identity-label">My User ID</div>
                <div className="identity-row">
                    <code className="identity-value">{userId || 'Unavailable'}</code>
                    <button
                        type="button"
                        className="copy-btn"
                        disabled={!userId}
                        onClick={() => userId && copyText(userId, 'User ID')}
                    >
                        Copy
                    </button>
                </div>
                {copiedText && <div className="copy-feedback">{copiedText}</div>}
            </div>

            <div className="sidebar__rooms" role="listbox" aria-label="Chat rooms">
                {filteredRooms.map((room) => (
                    <button
                        key={room.id}
                        className={`room-card ${activeRoomId === room.id ? 'room-card--active' : ''}`}
                        onClick={() => selectRoom(room)}
                        role="option"
                        aria-selected={activeRoomId === room.id}
                    >
                        <div className="room-card__avatar">{getInitials(room.name)}</div>
                        <div className="room-card__info">
                            <span className="room-card__name">{room.name}</span>
                            <span className="room-card__meta">
                                {room.memberCount} member{room.memberCount !== 1 ? 's' : ''} - {formatTime(room.createdAt)}
                            </span>
                        </div>
                        <div className="room-card__actions">
                            <button
                                type="button"
                                className="copy-btn copy-btn--small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    copyText(room.id, 'Room ID');
                                }}
                            >
                                Copy ID
                            </button>
                        </div>
                    </button>
                ))}
                {filteredRooms.length === 0 && (
                    <div className="sidebar__empty">{search ? 'No rooms found' : 'No rooms yet'}</div>
                )}
            </div>

            <div className="dm-requests-panel">
                <div className="dm-requests-panel__title">New Chat Requests</div>
                {loadingIncoming ? (
                    <div className="dm-empty">Loading...</div>
                ) : incomingRequests.length === 0 ? (
                    <div className="dm-empty">No pending requests</div>
                ) : (
                    incomingRequests.map((request) => (
                        <div key={request.id} className="dm-request-card">
                            <div className="dm-request-meta">
                                <div className="dm-request-name">{request.requesterUsername}</div>
                                <div className="dm-request-id">{request.requesterId}</div>
                            </div>
                            <div className="dm-request-actions">
                                <button
                                    type="button"
                                    className="dm-accept-btn"
                                    onClick={() => handleAcceptRequest(request.id)}
                                >
                                    Accept
                                </button>
                                <button
                                    type="button"
                                    className="dm-reject-btn"
                                    onClick={() => handleRejectRequest(request.id)}
                                >
                                    Reject
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="sidebar__footer">
                {showCreate ? (
                    <form className="create-room-form" onSubmit={handleCreateRoom}>
                        <input
                            type="text"
                            placeholder="Room name"
                            value={newRoomName}
                            onChange={(e) => {
                                setNewRoomName(e.target.value);
                                setCreateError('');
                            }}
                            autoFocus
                            maxLength={50}
                        />
                        {createError && <div className="join-error">{createError}</div>}
                        <div className="create-room-actions">
                            <button
                                type="button"
                                className="btn-cancel"
                                onClick={() => {
                                    setShowCreate(false);
                                    setCreateError('');
                                }}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="btn-create" disabled={creating || !newRoomName.trim()}>
                                {creating ? '...' : 'Create'}
                            </button>
                        </div>
                    </form>
                ) : showJoin ? (
                    <form className="create-room-form" onSubmit={handleJoinRoom}>
                        <input
                            type="text"
                            placeholder="Paste Room ID (UUID)"
                            value={joinRoomId}
                            onChange={(e) => {
                                setJoinRoomId(e.target.value);
                                setJoinError('');
                            }}
                            autoFocus
                        />
                        <div className="form-helper">Ask a friend to share their Room ID.</div>
                        {joinError && <div className="join-error">{joinError}</div>}
                        <div className="create-room-actions">
                            <button
                                type="button"
                                className="btn-cancel"
                                onClick={() => {
                                    setShowJoin(false);
                                    setJoinError('');
                                }}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="btn-create" disabled={joining || !joinRoomId.trim()}>
                                {joining ? '...' : 'Join'}
                            </button>
                        </div>
                    </form>
                ) : showDmRequest ? (
                    <form className="create-room-form" onSubmit={handleSendDmRequest}>
                        <input
                            type="text"
                            placeholder="Target User ID (UUID)"
                            value={targetUserId}
                            onChange={(e) => {
                                setTargetUserId(e.target.value);
                                setDmError('');
                                setDmSuccess('');
                            }}
                            autoFocus
                        />
                        <div className="form-helper">Ask a friend to share their User ID.</div>
                        {dmError && <div className="join-error">{dmError}</div>}
                        {dmSuccess && <div className="join-success">{dmSuccess}</div>}
                        <div className="create-room-actions">
                            <button
                                type="button"
                                className="btn-cancel"
                                onClick={() => {
                                    setShowDmRequest(false);
                                    setDmError('');
                                    setDmSuccess('');
                                }}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="btn-create" disabled={sendingDmRequest || !targetUserId.trim()}>
                                {sendingDmRequest ? '...' : 'Send Chat Request'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="sidebar__footer-buttons">
                        <button className="sidebar__new-room sidebar__new-room--primary" onClick={() => setShowCreate(true)}>
                            <span className="sidebar__new-room-icon">+</span>
                            New Room
                        </button>
                        <button className="sidebar__join-room" onClick={() => setShowJoin(true)}>
                            <span className="sidebar__new-room-icon">-&gt;</span>
                            Join Room
                        </button>
                        <button className="sidebar__new-chat" onClick={() => setShowDmRequest(true)}>
                            <span className="sidebar__new-room-icon">+</span>
                            New Chat
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
}
