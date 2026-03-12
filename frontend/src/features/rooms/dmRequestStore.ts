import { create } from 'zustand';
import type { DmRequest } from './dmRequestApi';

interface DmRequestState {
    incomingRequests: DmRequest[];
    setIncomingRequests: (requests: DmRequest[]) => void;
    prependIncomingRequest: (request: DmRequest) => void;
    removeIncomingRequest: (requestId: string) => void;
    clearIncomingRequests: () => void;
}

export const useDmRequestStore = create<DmRequestState>((set) => ({
    incomingRequests: [],
    setIncomingRequests: (incomingRequests) => set({ incomingRequests }),
    prependIncomingRequest: (request) =>
        set((state) => {
            const exists = state.incomingRequests.some((entry) => entry.id === request.id);
            if (exists) {
                return {
                    incomingRequests: state.incomingRequests.map((entry) =>
                        entry.id === request.id ? request : entry
                    ),
                };
            }
            return { incomingRequests: [request, ...state.incomingRequests] };
        }),
    removeIncomingRequest: (requestId) =>
        set((state) => ({
            incomingRequests: state.incomingRequests.filter((entry) => entry.id !== requestId),
        })),
    clearIncomingRequests: () => set({ incomingRequests: [] }),
}));
