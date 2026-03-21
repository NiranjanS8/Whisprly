import { create } from 'zustand';
import type { UserSummary } from './profileApi';

interface BlockState {
    blockedByCurrentUser: boolean;
    blocksCurrentUser: boolean;
}

interface BlockStoreState {
    byUserId: Record<string, BlockState>;
    syncSummary: (summary: UserSummary) => void;
    setBlockedByCurrentUser: (userId: string, blockedByCurrentUser: boolean) => void;
}

export const useBlockStore = create<BlockStoreState>((set) => ({
    byUserId: {},
    syncSummary: (summary) =>
        set((state) => ({
            byUserId: {
                ...state.byUserId,
                [summary.id]: {
                    blockedByCurrentUser: summary.blockedByCurrentUser,
                    blocksCurrentUser: summary.blocksCurrentUser,
                },
            },
        })),
    setBlockedByCurrentUser: (userId, blockedByCurrentUser) =>
        set((state) => ({
            byUserId: {
                ...state.byUserId,
                [userId]: {
                    blockedByCurrentUser,
                    blocksCurrentUser: state.byUserId[userId]?.blocksCurrentUser ?? false,
                },
            },
        })),
}));
