import axios from 'axios';
import { useAuthStore } from '../features/auth/authStore';

const backendOrigin = import.meta.env.VITE_BACKEND_ORIGIN;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || `${backendOrigin || 'http://localhost:9090'}/api`;

const httpClient = axios.create({
    baseURL: apiBaseUrl,
    headers: { 'Content-Type': 'application/json' },
});

let refreshRequest: Promise<string | null> | null = null;

function isAuthRoute(url: string) {
    return url.includes('/auth/login')
        || url.includes('/auth/register')
        || url.includes('/auth/google')
        || url.includes('/auth/refresh')
        || url.includes('/auth/logout');
}

async function refreshAccessToken(): Promise<string | null> {
    const authState = useAuthStore.getState();
    const refreshToken = authState.refreshToken;

    if (!refreshToken) {
        return null;
    }

    const response = await axios.post(`${apiBaseUrl}/auth/refresh`, { refreshToken }, {
        headers: { 'Content-Type': 'application/json' },
    });

    const nextAuth = response.data as {
        accessToken: string;
        refreshToken: string;
        userId: string;
        username: string;
    };

    useAuthStore.getState().setAuth(nextAuth);
    return nextAuth.accessToken;
}

httpClient.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

httpClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error.response?.status;
        const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
        const requestUrl = String(originalRequest?.url ?? '');
        const isAuthenticationRequest = isAuthRoute(requestUrl);

        if (status === 401 && originalRequest && !originalRequest._retry && !isAuthenticationRequest) {
            originalRequest._retry = true;

            try {
                refreshRequest ??= refreshAccessToken().finally(() => {
                    refreshRequest = null;
                });

                const accessToken = await refreshRequest;
                if (!accessToken) {
                    throw new Error('No refreshed access token available');
                }

                originalRequest.headers = originalRequest.headers ?? {};
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return httpClient(originalRequest);
            } catch (refreshError) {
                useAuthStore.getState().clearAuth();
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        if (status === 401 && !isAuthenticationRequest) {
            useAuthStore.getState().clearAuth();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default httpClient;
