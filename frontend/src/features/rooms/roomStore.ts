import { create } from 'zustand';
import type { Room } from './roomApi';

interface RoomState {
    rooms: Room[];
    activeRoomId: string | null;
    setRooms: (rooms: Room[]) => void;
    addRoom: (room: Room) => void;
    setActiveRoom: (roomId: string | null) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
    rooms: [],
    activeRoomId: null,

    setRooms: (rooms) => set({ rooms }),

    addRoom: (room) =>
        set((state) => ({ rooms: [room, ...state.rooms] })),

    setActiveRoom: (roomId) => set({ activeRoomId: roomId }),
}));
