import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../auth/authStore';
import { fetchUserSummary } from '../profile/profileApi';
import {
    addMember,
    deleteRoom,
    fetchRoomDetails,
    fetchRoomMembers,
    removeMember,
    transferRoomOwnership,
    updateRoomSettings,
    type Member,
    type Room,
} from './roomApi';
import { useRoomStore } from './roomStore';
import { getInitials, resolveMediaUrl } from '../../shared/utils';
import './room-settings.css';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MUTE_STORAGE_KEY = 'whisprly-muted-rooms';

interface UserPreview {
    id: string;
    username: string;
    fullName?: string | null;
    avatarUrl: string | null;
    online: boolean;
}

function getMutedRoomMap(): Record<string, boolean> {
    try {
        const raw = localStorage.getItem(MUTE_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function setMutedRoomMap(map: Record<string, boolean>) {
    localStorage.setItem(MUTE_STORAGE_KEY, JSON.stringify(map));
}

export default function RoomSettingsPage() {
    const navigate = useNavigate();
    const { roomSlug } = useParams();
    const userId = useAuthStore((s) => s.userId);
    const { rooms, setRooms, setActiveRoom } = useRoomStore();

    const [room, setRoom] = useState<Room | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [name, setName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [description, setDescription] = useState('');
    const [membersCanMessage, setMembersCanMessage] = useState(true);
    const [membersCanAddMembers, setMembersCanAddMembers] = useState(false);
    const [selfDestructSeconds, setSelfDestructSeconds] = useState<number | null>(null);

    const [candidateUserId, setCandidateUserId] = useState('');
    const [previewing, setPreviewing] = useState(false);
    const [previewUser, setPreviewUser] = useState<UserPreview | null>(null);
    const [addingMember, setAddingMember] = useState(false);
    const [selectedNewOwnerId, setSelectedNewOwnerId] = useState('');
    const [transferring, setTransferring] = useState(false);

    const [isMuted, setIsMuted] = useState(false);

    const isOwner = room && userId && room.createdById === userId;
    const toDisplayName = (name?: string | null, username?: string) =>
        (name && name.trim()) ? name.trim() : (username || '');
    const otherMembers = useMemo(
        () => members.filter((member) => member.userId !== userId),
        [members, userId]
    );

    useEffect(() => {
        if (!roomSlug) return;
        const muted = getMutedRoomMap();
        setIsMuted(Boolean(muted[roomSlug]));
    }, [roomSlug]);

    useEffect(() => {
        if (!roomSlug) {
            setLoading(false);
            setError('Invalid room');
            return;
        }

        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const [roomData, memberData] = await Promise.all([
                    fetchRoomDetails(roomSlug),
                    fetchRoomMembers(roomSlug),
                ]);
                setRoom(roomData);
                setMembers(memberData);
                setName(roomData.name ?? '');
                setAvatarUrl(roomData.avatarUrl ?? '');
                setDescription(roomData.description ?? '');
                setMembersCanMessage(roomData.membersCanMessage ?? true);
                setMembersCanAddMembers(roomData.membersCanAddMembers ?? false);
                setSelfDestructSeconds(roomData.selfDestructSeconds ?? null);
            } catch (err: any) {
                setError(err.response?.data?.message || 'Failed to load room settings');
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [roomSlug]);

    const syncRoomInStore = (updated: Room) => {
        setRooms(rooms.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry)));
    };

    const handleSaveSettings = async (e: FormEvent) => {
        e.preventDefault();
        if (!roomSlug || !isOwner) return;

        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const updated = await updateRoomSettings(roomSlug, {
                name: name.trim(),
                avatarUrl: avatarUrl.trim(),
                description: description.trim(),
                membersCanMessage,
                membersCanAddMembers,
                selfDestructSeconds: selfDestructSeconds ?? 0,
            });
            setRoom(updated);
            syncRoomInStore(updated);
            setSuccess('Room settings saved');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to save room settings');
        } finally {
            setSaving(false);
        }
    };

    const handlePreviewUser = async () => {
        if (!candidateUserId.trim() || !UUID_REGEX.test(candidateUserId.trim())) {
            setError('Enter a valid user ID');
            return;
        }
        setPreviewing(true);
        setError('');
        try {
            const summary = await fetchUserSummary(candidateUserId.trim());
            setPreviewUser(summary);
        } catch (err: any) {
            setError(err.response?.data?.message || 'User not found');
            setPreviewUser(null);
        } finally {
            setPreviewing(false);
        }
    };

    const handleAddMember = async () => {
        if (!roomSlug || !previewUser || !isOwner) return;
        setAddingMember(true);
        setError('');
        try {
            const created = await addMember(roomSlug, previewUser.id);
            setMembers((prev) => [...prev, created]);
            setPreviewUser(null);
            setCandidateUserId('');
            setSuccess('Member added');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to add member');
        } finally {
            setAddingMember(false);
        }
    };

    const handleRemoveMember = async (member: Member) => {
        if (!roomSlug || !isOwner) return;
        const confirmed = window.confirm(`Remove ${toDisplayName(member.fullName, member.username)} from this room?`);
        if (!confirmed) return;

        setError('');
        try {
            await removeMember(roomSlug, member.userId);
            setMembers((prev) => prev.filter((entry) => entry.userId !== member.userId));
            setSuccess('Member removed');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to remove member');
        }
    };

    const handleMuteToggle = () => {
        if (!roomSlug) return;
        const map = getMutedRoomMap();
        const nextValue = !isMuted;
        map[roomSlug] = nextValue;
        setMutedRoomMap(map);
        setIsMuted(nextValue);
    };

    const handleLeaveRoom = async () => {
        if (!roomSlug || !userId) return;
        const confirmed = window.confirm('Leave this room?');
        if (!confirmed) return;

        try {
            await removeMember(roomSlug, userId);
            setRooms(rooms.filter((entry) => entry.slug !== roomSlug));
            setActiveRoom(null);
            navigate('/chat');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to leave room');
        }
    };

    const handleTransferOwnership = async () => {
        if (!roomSlug || !selectedNewOwnerId || !isOwner) return;
        const target = members.find((member) => member.userId === selectedNewOwnerId);
        const confirmed = window.confirm(`Transfer ownership to ${toDisplayName(target?.fullName, target?.username) || 'selected member'}?`);
        if (!confirmed) return;

        setTransferring(true);
        setError('');
        try {
            const updated = await transferRoomOwnership(roomSlug, selectedNewOwnerId);
            setRoom(updated);
            syncRoomInStore(updated);
            setSuccess('Ownership transferred');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to transfer ownership');
        } finally {
            setTransferring(false);
        }
    };

    const handleDeleteRoom = async () => {
        if (!roomSlug || !isOwner || !room) return;
        const confirmText = window.prompt(`Type "${room.name}" to delete this room permanently.`);
        if (confirmText !== room.name) return;

        try {
            await deleteRoom(roomSlug);
            setRooms(rooms.filter((entry) => entry.slug !== roomSlug));
            setActiveRoom(null);
            navigate('/chat');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to delete room');
        }
    };

    if (loading) {
        return <div className="room-settings"><div className="room-settings__status">Loading room settings...</div></div>;
    }

    if (error && !room) {
        return <div className="room-settings"><div className="room-settings__status room-settings__status--error">{error}</div></div>;
    }

    if (!room) {
        return <div className="room-settings"><div className="room-settings__status">Room not found</div></div>;
    }

    if (!isOwner) {
        return (
            <div className="room-settings">
                <div className="room-settings__permission-shell">
                    <div className="room-settings__permission-card">
                        <h3>Restricted Settings</h3>
                        <p>Only the room owner can modify room settings.</p>
                        <button type="button" className="room-settings__permission-btn" onClick={() => navigate('/chat')}>
                            Back to Chat
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <section className="room-settings">
            <header className="room-settings__header">
                <button type="button" className="room-settings__back-btn" onClick={() => navigate('/chat')}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 6L9 12L15 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="sr-only">Back to chat</span>
                </button>
                <div>
                    <h2>Room Settings</h2>
                    <p>Manage members, permissions, and room configuration.</p>
                </div>
            </header>

            {(error || success) && (
                <div className={`room-settings__alert ${error ? 'room-settings__alert--error' : 'room-settings__alert--success'}`}>
                    {error || success}
                </div>
            )}

            <form className="room-settings__card" onSubmit={handleSaveSettings}>
                <h3>Room Details</h3>
                <label>
                    Room slug
                    <input value={room.slug} readOnly />
                </label>
                <label>
                    Invite code
                    <input value={room.inviteCode} readOnly />
                </label>
                <label>
                    Room name
                    <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
                </label>
                <label>
                    Avatar URL
                    <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
                </label>
                <label>
                    Description
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} />
                </label>
                <div className="room-settings__avatar-preview">
                    {resolveMediaUrl(avatarUrl) ? <img src={resolveMediaUrl(avatarUrl) || ''} alt="Room avatar preview" /> : <span>{getInitials(name || room.name)}</span>}
                </div>
                <button type="submit" className="room-settings__primary-btn" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Settings'}
                </button>
            </form>

            <section className="room-settings__card">
                <h3>Permissions</h3>
                <label className="room-settings__switch">
                    <input type="checkbox" checked={membersCanMessage} onChange={(e) => setMembersCanMessage(e.target.checked)} />
                    <span>Members can send messages</span>
                </label>
                <label className="room-settings__switch">
                    <input type="checkbox" checked={membersCanAddMembers} onChange={(e) => setMembersCanAddMembers(e.target.checked)} />
                    <span>Members can add other members</span>
                </label>
                <label>
                    Self-destruct timer
                    <select
                        value={selfDestructSeconds ?? 0}
                        onChange={(e) => {
                            const value = Number(e.target.value);
                            setSelfDestructSeconds(value === 0 ? null : value);
                        }}
                    >
                        <option value={0}>Disabled</option>
                        <option value={30}>30 seconds</option>
                        <option value={60}>1 minute</option>
                        <option value={300}>5 minutes</option>
                        <option value={3600}>1 hour</option>
                    </select>
                </label>
            </section>

            <section className="room-settings__card">
                <h3>Member Management</h3>
                <div className="room-settings__add-member">
                    <input
                        value={candidateUserId}
                        onChange={(e) => {
                            setCandidateUserId(e.target.value);
                            setPreviewUser(null);
                        }}
                        placeholder="Enter user ID"
                    />
                    <button type="button" onClick={handlePreviewUser} disabled={previewing}>
                        {previewing ? 'Checking...' : 'Preview'}
                    </button>
                    {previewUser && (
                        <div className="room-settings__preview">
                            <span>{toDisplayName(previewUser.fullName, previewUser.username)} ({previewUser.online ? 'Online' : 'Offline'})</span>
                            <button type="button" onClick={handleAddMember} disabled={addingMember}>
                                {addingMember ? 'Adding...' : 'Add Member'}
                            </button>
                        </div>
                    )}
                </div>
                <ul className="room-settings__member-list">
                    {members.map((member) => (
                        <li key={member.id}>
                            <div>
                                <span className="room-settings__member-name">{toDisplayName(member.fullName, member.username)}</span>
                                <span className={`room-settings__role room-settings__role--${member.role.toLowerCase()}`}>{member.role}</span>
                            </div>
                            {member.role !== 'OWNER' && (
                                <button type="button" onClick={() => handleRemoveMember(member)}>
                                    Remove
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </section>

            <section className="room-settings__card">
                <h3>Notifications</h3>
                <label className="room-settings__switch">
                    <input type="checkbox" checked={isMuted} onChange={handleMuteToggle} />
                    <span>Mute this room</span>
                </label>
            </section>

            <section className="room-settings__card room-settings__danger">
                <h3>Danger Zone</h3>
                <div className="room-settings__danger-actions">
                    <button type="button" onClick={handleLeaveRoom}>Leave Room</button>
                    <div className="room-settings__transfer">
                        <select value={selectedNewOwnerId} onChange={(e) => setSelectedNewOwnerId(e.target.value)}>
                            <option value="">Select member to transfer ownership</option>
                            {otherMembers.map((member) => (
                                <option key={member.userId} value={member.userId}>{toDisplayName(member.fullName, member.username)}</option>
                            ))}
                        </select>
                        <button type="button" onClick={handleTransferOwnership} disabled={!selectedNewOwnerId || transferring}>
                            {transferring ? 'Transferring...' : 'Transfer Ownership'}
                        </button>
                    </div>
                    <button type="button" className="room-settings__delete-btn" onClick={handleDeleteRoom}>
                        Delete Room
                    </button>
                </div>
            </section>
        </section>
    );
}
