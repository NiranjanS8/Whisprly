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
