import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Room } from './roomApi';

interface RoomState {
    rooms: Room[];
    activeRoomId: string | null;
    onlineCountsByRoom: Record<string, number>;
    setRooms: (rooms: Room[]) => void;
    addRoom: (room: Room) => void;
    setActiveRoom: (roomId: string | null) => void;
    setOnlineCountsByRoom: (onlineCountsByRoom: Record<string, number>) => void;
}

export const useRoomStore = create<RoomState>()(
    persist(
        (set) => ({
            rooms: [],
            activeRoomId: null,
            onlineCountsByRoom: {},

            setRooms: (rooms) =>
                set((state) => {
                    const activeStillExists = state.activeRoomId
                        ? rooms.some((room) => room.id === state.activeRoomId)
                        : false;

                    return {
                        rooms,
                        activeRoomId: activeStillExists ? state.activeRoomId : null,
                    };
                }),

            addRoom: (room) =>
                set((state) => ({ rooms: [room, ...state.rooms] })),

            setActiveRoom: (roomId) => set({ activeRoomId: roomId }),

            setOnlineCountsByRoom: (onlineCountsByRoom) => set({ onlineCountsByRoom }),
        }),
        {
            name: 'whisprly-room-storage',
            storage: createJSONStorage(() => sessionStorage),
            partialize: (state) => ({ activeRoomId: state.activeRoomId }),
        }
    )
);
