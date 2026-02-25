import { create } from 'zustand';

interface PresenceState {
    onlineByUserId: Record<string, boolean>;
    lastSeenByUserId: Record<string, string>;
    setPresenceSnapshot: (onlineUserIds: string[]) => void;
    markAllOffline: () => void;
    isUserOnline: (userId?: string | null) => boolean;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
    onlineByUserId: {},
    lastSeenByUserId: {},

    setPresenceSnapshot: (onlineUserIds) =>
        set((state) => {
            const nextOnlineMap: Record<string, boolean> = {};
            onlineUserIds.forEach((id) => {
                nextOnlineMap[id] = true;
            });

            const nextLastSeen = { ...state.lastSeenByUserId };
            Object.keys(state.onlineByUserId).forEach((id) => {
                if (state.onlineByUserId[id] && !nextOnlineMap[id]) {
                    nextLastSeen[id] = new Date().toISOString();
                }
            });

            return {
                onlineByUserId: nextOnlineMap,
                lastSeenByUserId: nextLastSeen,
            };
        }),

    markAllOffline: () =>
        set((state) => {
            const now = new Date().toISOString();
            const nextLastSeen = { ...state.lastSeenByUserId };
            Object.keys(state.onlineByUserId).forEach((id) => {
                if (state.onlineByUserId[id]) {
                    nextLastSeen[id] = now;
                }
            });
            return {
                onlineByUserId: {},
                lastSeenByUserId: nextLastSeen,
            };
        }),

    isUserOnline: (userId) => {
        if (!userId) return false;
        return Boolean(get().onlineByUserId[userId]);
    },
}));
