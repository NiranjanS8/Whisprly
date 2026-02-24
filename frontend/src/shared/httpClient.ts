import axios from 'axios';
import { useAuthStore } from '../features/auth/authStore';

const backendOrigin = import.meta.env.VITE_BACKEND_ORIGIN;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || `${backendOrigin || 'http://localhost:9090'}/api`;

const httpClient = axios.create({
    baseURL: apiBaseUrl,
    headers: { 'Content-Type': 'application/json' },
});

httpClient.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

httpClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            useAuthStore.getState().clearAuth();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default httpClient;
