import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Room } from './roomApi';

interface RoomState {
    rooms: Room[];
    activeRoomId: string | null;
    onlineCountsByRoom: Record<string, number>;
    lastActivityByRoom: Record<string, string>;
    setRooms: (rooms: Room[]) => void;
    addRoom: (room: Room) => void;
    setActiveRoom: (roomId: string | null) => void;
    setOnlineCountsByRoom: (onlineCountsByRoom: Record<string, number>) => void;
    setLastActivityByRoom: (lastActivityByRoom: Record<string, string>) => void;
    touchRoomActivity: (roomId: string, activityAt: string) => void;
}

export const useRoomStore = create<RoomState>()(
    persist(
        (set) => ({
            rooms: [],
            activeRoomId: null,
            onlineCountsByRoom: {},
            lastActivityByRoom: {},

            setRooms: (rooms) =>
                set((state) => {
                    const activeStillExists = state.activeRoomId
                        ? rooms.some((room) => room.id === state.activeRoomId)
                        : false;
                    const nextActivity = { ...state.lastActivityByRoom };
                    const nextRoomIds = new Set(rooms.map((room) => room.id));
                    Object.keys(nextActivity).forEach((roomId) => {
                        if (!nextRoomIds.has(roomId)) {
                            delete nextActivity[roomId];
                        }
                    });

                    return {
                        rooms,
                        activeRoomId: activeStillExists ? state.activeRoomId : null,
                        lastActivityByRoom: nextActivity,
                    };
                }),

            addRoom: (room) =>
                set((state) => ({ rooms: [room, ...state.rooms] })),

            setActiveRoom: (roomId) => set({ activeRoomId: roomId }),

            setOnlineCountsByRoom: (onlineCountsByRoom) => set({ onlineCountsByRoom }),

            setLastActivityByRoom: (lastActivityByRoom) => set({ lastActivityByRoom }),

            touchRoomActivity: (roomId, activityAt) =>
                set((state) => {
                    const current = state.lastActivityByRoom[roomId];
                    if (!current) {
                        return {
                            lastActivityByRoom: {
                                ...state.lastActivityByRoom,
                                [roomId]: activityAt,
                            },
                        };
                    }

                    const currentTs = new Date(current).getTime();
                    const nextTs = new Date(activityAt).getTime();
                    if (Number.isNaN(nextTs) || nextTs <= currentTs) {
                        return state;
                    }

                    return {
                        lastActivityByRoom: {
                            ...state.lastActivityByRoom,
                            [roomId]: activityAt,
                        },
                    };
                }),
        }),
        {
            name: 'whisprly-room-storage',
            storage: createJSONStorage(() => sessionStorage),
            partialize: (state) => ({ activeRoomId: state.activeRoomId }),
        }
    )
);
