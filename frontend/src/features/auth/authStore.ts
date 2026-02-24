import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    userId: string | null;
    username: string | null;
    isAuthenticated: boolean;
    setAuth: (data: { accessToken: string; refreshToken: string; userId: string; username: string }) => void;
    clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            accessToken: null,
            refreshToken: null,
            userId: null,
            username: null,
            isAuthenticated: false,

            setAuth: (data) =>
                set({
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken,
                    userId: data.userId,
                    username: data.username,
                    isAuthenticated: true,
                }),

            clearAuth: () =>
                set({
                    accessToken: null,
                    refreshToken: null,
                    userId: null,
                    username: null,
                    isAuthenticated: false,
                }),
        }),
        {
            name: 'whisprly-auth-storage',
        }
    )
);
