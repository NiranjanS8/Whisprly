import httpClient from '../../shared/httpClient';

export interface Room {
    id: string;
    name: string;
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
    unreadCount: number;
    lastReadAt: string | null;
}

export async function fetchRooms(): Promise<Room[]> {
    const res = await httpClient.get<Room[]>('/rooms');
    return res.data;
}

export async function fetchRoomDetails(roomId: string): Promise<Room> {
    const res = await httpClient.get<Room>(`/rooms/${roomId}`);
    return res.data;
}

export async function createRoom(name: string): Promise<Room> {
    const res = await httpClient.post<Room>('/rooms', { name });
    return res.data;
}

export async function fetchRoomMembers(roomId: string): Promise<Member[]> {
    const res = await httpClient.get<Member[]>(`/rooms/${roomId}/members`);
    return res.data;
}

export async function addMember(roomId: string, userId: string): Promise<Member> {
    const res = await httpClient.post<Member>(`/rooms/${roomId}/members`, { userId });
    return res.data;
}

export async function joinRoom(roomId: string): Promise<Room> {
    const res = await httpClient.post<Room>(`/rooms/${roomId}/join`);
    return res.data;
}

export async function removeMember(roomId: string, userId: string): Promise<void> {
    await httpClient.delete(`/rooms/${roomId}/members/${userId}`);
}

export async function deleteRoom(roomId: string): Promise<void> {
    await httpClient.delete(`/rooms/${roomId}`);
}

export async function updateRoomSettings(roomId: string, payload: RoomSettingsPayload): Promise<Room> {
    const res = await httpClient.put<Room>(`/rooms/${roomId}/settings`, payload);
    return res.data;
}

export async function transferRoomOwnership(roomId: string, newOwnerUserId: string): Promise<Room> {
    const res = await httpClient.post<Room>(`/rooms/${roomId}/transfer-ownership`, { newOwnerUserId });
    return res.data;
}

export async function pinRoom(roomId: string): Promise<Room> {
    const res = await httpClient.post<Room>(`/rooms/${roomId}/pin`);
    return res.data;
}

export async function unpinRoom(roomId: string): Promise<Room> {
    const res = await httpClient.delete<Room>(`/rooms/${roomId}/pin`);
    return res.data;
}

export async function markRoomRead(roomId: string): Promise<RoomUnreadUpdate> {
    const res = await httpClient.post<RoomUnreadUpdate>(`/rooms/${roomId}/read`);
    return res.data;
}
