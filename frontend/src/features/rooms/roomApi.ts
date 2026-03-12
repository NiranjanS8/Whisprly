import httpClient from '../../shared/httpClient';

export interface Room {
    id: string;
    name: string;
    slug: string;
    inviteCode: string;
    type?: string;
    createdAt: string;
    createdById: string;
    createdByUsername: string;
    memberCount: number;
    avatarUrl?: string | null;
    description?: string | null;
    membersCanMessage?: boolean;
    membersCanAddMembers?: boolean;
    selfDestructSeconds?: number | null;
    maxMembers?: number | null;
    allowedMediaTypes?: string | null;
    pinnedAt?: string | null;
    unreadCount?: number;
}

export interface Member {
    id: string;
    userId: string;
    username: string;
    fullName?: string | null;
    email: string;
    role: string;
    joinedAt: string;
}

export interface RoomSettingsPayload {
    name?: string;
    avatarUrl?: string;
    description?: string;
    maxMembers?: number;
    allowedMediaTypes?: string;
    membersCanMessage?: boolean;
    membersCanAddMembers?: boolean;
    selfDestructSeconds?: number | null;
}

export interface RoomUnreadUpdate {
    userId: string;
    roomId: string;
    roomSlug: string;
    unreadCount: number;
    lastReadAt: string | null;
}

export async function fetchRooms(): Promise<Room[]> {
    const res = await httpClient.get<Room[]>('/rooms');
    return res.data;
}

export async function fetchRoomDetails(roomSlug: string): Promise<Room> {
    const res = await httpClient.get<Room>(`/rooms/${encodeURIComponent(roomSlug)}`);
    return res.data;
}

export async function createRoom(name: string): Promise<Room> {
    const res = await httpClient.post<Room>('/rooms', { name });
    return res.data;
}

export async function fetchRoomMembers(roomSlug: string): Promise<Member[]> {
    const res = await httpClient.get<Member[]>(`/rooms/${encodeURIComponent(roomSlug)}/members`);
    return res.data;
}

export async function addMember(roomSlug: string, userId: string): Promise<Member> {
    const res = await httpClient.post<Member>(`/rooms/${encodeURIComponent(roomSlug)}/members`, { userId });
    return res.data;
}

export async function joinRoom(inviteCode: string): Promise<Room> {
    const res = await httpClient.post<Room>(`/rooms/join/${encodeURIComponent(inviteCode)}`);
    return res.data;
}

export async function removeMember(roomSlug: string, userId: string): Promise<void> {
    await httpClient.delete(`/rooms/${encodeURIComponent(roomSlug)}/members/${userId}`);
}

export async function deleteRoom(roomSlug: string): Promise<void> {
    await httpClient.delete(`/rooms/${encodeURIComponent(roomSlug)}`);
}

export async function updateRoomSettings(roomSlug: string, payload: RoomSettingsPayload): Promise<Room> {
    const res = await httpClient.put<Room>(`/rooms/${encodeURIComponent(roomSlug)}/settings`, payload);
    return res.data;
}

export async function transferRoomOwnership(roomSlug: string, newOwnerUserId: string): Promise<Room> {
    const res = await httpClient.post<Room>(`/rooms/${encodeURIComponent(roomSlug)}/transfer-ownership`, { newOwnerUserId });
    return res.data;
}

export async function pinRoom(roomSlug: string): Promise<Room> {
    const res = await httpClient.post<Room>(`/rooms/${encodeURIComponent(roomSlug)}/pin`);
    return res.data;
}

export async function unpinRoom(roomSlug: string): Promise<Room> {
    const res = await httpClient.delete<Room>(`/rooms/${encodeURIComponent(roomSlug)}/pin`);
    return res.data;
}

export async function markRoomRead(roomSlug: string): Promise<RoomUnreadUpdate> {
    const res = await httpClient.post<RoomUnreadUpdate>(`/rooms/${encodeURIComponent(roomSlug)}/read`);
    return res.data;
}
