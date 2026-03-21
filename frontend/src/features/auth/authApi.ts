import httpClient from '../../shared/httpClient';

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    userId: string;
    username: string;
}

export interface RefreshTokenRequest {
    refreshToken: string;
}

export async function registerUser(username: string, email: string, password: string): Promise<AuthResponse> {
    const res = await httpClient.post<AuthResponse>('/auth/register', { username, email, password });
    return res.data;
}

export async function loginUser(username: string, password: string): Promise<AuthResponse> {
    const res = await httpClient.post<AuthResponse>('/auth/login', { username, password });
    return res.data;
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
    const res = await httpClient.post<AuthResponse>('/auth/google', { idToken });
    return res.data;
}

export async function refreshSession(refreshToken: string): Promise<AuthResponse> {
    const res = await httpClient.post<AuthResponse>('/auth/refresh', { refreshToken });
    return res.data;
}

export async function logoutSession(refreshToken: string): Promise<void> {
    await httpClient.post('/auth/logout', { refreshToken });
}
