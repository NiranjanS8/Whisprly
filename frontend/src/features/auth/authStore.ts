import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    userId: string | null;
    username: string | null;
    avatarUrl: string | null;
    isAuthenticated: boolean;
    setAuth: (data: { accessToken: string; refreshToken: string; userId: string; username: string; avatarUrl?: string | null }) => void;
    setUsername: (username: string) => void;
    setAvatarUrl: (avatarUrl: string | null) => void;
    clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            accessToken: null,
            refreshToken: null,
            userId: null,
            username: null,
            avatarUrl: null,
            isAuthenticated: false,

            setAuth: (data) =>
                set({
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken,
                    userId: data.userId,
                    username: data.username,
                    avatarUrl: data.avatarUrl ?? null,
                    isAuthenticated: true,
                }),

            setUsername: (username) =>
                set({
                    username,
                }),

            setAvatarUrl: (avatarUrl) =>
                set({
                    avatarUrl,
                }),

            clearAuth: () =>
                set({
                    accessToken: null,
                    refreshToken: null,
                    userId: null,
                    username: null,
                    avatarUrl: null,
                    isAuthenticated: false,
                }),
        }),
        {
            name: 'whisprly-auth-storage',
            storage: createJSONStorage(() => sessionStorage),
        }
    )
);
