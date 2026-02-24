import httpClient from '../../shared/httpClient';
import type { ChatMessage } from './chatStore';

interface PagedResponse<T> {
    content: T[];
    totalPages: number;
    totalElements: number;
    number: number;
}

interface MessageDto {
    id: string;
    content: string;
    senderId: string;
    senderUsername: string;
    createdAt: string;
    idempotencyKey?: string;
    roomId: string;
}

export async function fetchMessages(roomId: string, page = 0, size = 50): Promise<ChatMessage[]> {
    const res = await httpClient.get<PagedResponse<MessageDto>>(`/rooms/${roomId}/messages`, {
        params: { page, size },
    });
    return res.data.content.map((m) => ({
        id: m.id,
        idempotencyKey: m.idempotencyKey ?? m.id,
        content: m.content,
        senderId: m.senderId,
        senderUsername: m.senderUsername,
        createdAt: m.createdAt,
        roomId: m.roomId || roomId,
        status: 'sent' as const,
    }));
}
