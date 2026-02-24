import httpClient from '../../shared/httpClient';

export interface Room {
    id: string;
    name: string;
    createdAt: string;
    createdById: string;
    createdByUsername: string;
    memberCount: number;
}

export interface Member {
    id: string;
    userId: string;
    username: string;
    email: string;
    role: string;
    joinedAt: string;
}

export async function fetchRooms(): Promise<Room[]> {
    const res = await httpClient.get<Room[]>('/rooms');
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
