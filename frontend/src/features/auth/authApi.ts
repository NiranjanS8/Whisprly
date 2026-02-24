import httpClient from '../../shared/httpClient';

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    userId: string;
    username: string;
}

export async function registerUser(username: string, email: string, password: string): Promise<AuthResponse> {
    const res = await httpClient.post<AuthResponse>('/auth/register', { username, email, password });
    return res.data;
}

export async function loginUser(username: string, password: string): Promise<AuthResponse> {
    const res = await httpClient.post<AuthResponse>('/auth/login', { username, password });
    return res.data;
}
