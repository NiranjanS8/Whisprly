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
    upsertRoom: (room: Room) => void;
    setActiveRoom: (roomId: string | null) => void;
    setOnlineCountsByRoom: (onlineCountsByRoom: Record<string, number>) => void;
    setLastActivityByRoom: (lastActivityByRoom: Record<string, string>) => void;
    touchRoomActivity: (roomId: string, activityAt: string) => void;
    setRoomUnreadCount: (roomId: string, unreadCount: number) => void;
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
                        ? rooms.some((room) => room.slug === state.activeRoomId)
                        : false;
                    const nextActivity = { ...state.lastActivityByRoom };
                    const nextRoomIds = new Set(rooms.map((room) => room.slug));
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
                set((state) => {
                    const existingIndex = state.rooms.findIndex((entry) => entry.id === room.id || entry.slug === room.slug);
                    if (existingIndex === -1) {
                        return { rooms: [room, ...state.rooms] };
                    }

                    const nextRooms = [...state.rooms];
                    nextRooms[existingIndex] = { ...nextRooms[existingIndex], ...room };
                    return { rooms: nextRooms };
                }),

            upsertRoom: (room) =>
                set((state) => {
                    const existingIndex = state.rooms.findIndex((entry) => entry.id === room.id || entry.slug === room.slug);
                    if (existingIndex === -1) {
                        return { rooms: [room, ...state.rooms] };
                    }

                    const nextRooms = [...state.rooms];
                    nextRooms[existingIndex] = { ...nextRooms[existingIndex], ...room };
                    return { rooms: nextRooms };
                }),

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

            setRoomUnreadCount: (roomId, unreadCount) =>
                set((state) => {
                    const existingRoom = state.rooms.find((room) => room.slug === roomId);
                    if (!existingRoom || (existingRoom.unreadCount ?? 0) === unreadCount) {
                        return state;
                    }

                    return {
                        rooms: state.rooms.map((room) =>
                            room.slug === roomId
                                ? { ...room, unreadCount }
                                : room
                        ),
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
