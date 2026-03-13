import httpClient from '../../shared/httpClient';

export interface UserProfile {
    id: string;
    username: string;
    email: string;
    fullName: string | null;
    bio: string | null;
    avatarUrl: string | null;
}

export interface UserSummary {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
    online: boolean;
    joinedAt: string;
    roomsInCommon: number;
    blockedByCurrentUser: boolean;
    blocksCurrentUser: boolean;
}

export interface UpdateUserProfileRequest {
    username?: string;
    email?: string;
    fullName?: string;
    bio?: string;
    avatarUrl?: string;
}

export async function fetchMyProfile(): Promise<UserProfile> {
    const res = await httpClient.get<UserProfile>('/users/me');
    return res.data;
}

export async function updateMyProfile(payload: UpdateUserProfileRequest): Promise<UserProfile> {
    const res = await httpClient.put<UserProfile>('/users/me', payload);
    return res.data;
}

export async function fetchUserSummary(userId: string): Promise<UserSummary> {
    const res = await httpClient.get<UserSummary>(`/users/${userId}/summary`);
    return res.data;
}

export async function fetchUserSummaryByUsername(username: string): Promise<UserSummary> {
    const res = await httpClient.get<UserSummary>(`/users/by-username/${encodeURIComponent(username)}/summary`);
    return res.data;
}

export async function blockUser(userId: string): Promise<void> {
    await httpClient.post(`/users/${encodeURIComponent(userId)}/block`);
}

export async function unblockUser(userId: string): Promise<void> {
    await httpClient.delete(`/users/${encodeURIComponent(userId)}/block`);
}
