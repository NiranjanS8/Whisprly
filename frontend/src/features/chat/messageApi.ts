import httpClient from '../../shared/httpClient';
import type { ChatMessage } from './chatStore';
import { generateIdempotencyKey, normalizeApiPath } from '../../shared/utils';

interface PagedResponse<T> {
    content: T[];
    totalPages: number;
    totalElements: number;
    number: number;
}

interface MessageDto {
    id: string;
    content: string;
    attachment?: {
        fileName: string;
        contentType: string;
        fileSizeBytes: number;
        category: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
        url: string;
        inlinePreviewable: boolean;
    } | null;
    senderId: string;
    senderUsername: string;
    senderFullName?: string | null;
    createdAt: string;
    idempotencyKey?: string;
    roomId: string;
}

function toChatMessage(m: MessageDto, roomId: string): ChatMessage {
    const normalizedAttachment = m.attachment
        ? { ...m.attachment, url: normalizeApiPath(m.attachment.url) }
        : undefined;

    return {
        id: m.id,
        idempotencyKey: m.idempotencyKey ?? m.id,
        content: m.content,
        attachment: normalizedAttachment,
        senderId: m.senderId,
        senderUsername: m.senderUsername,
        senderFullName: m.senderFullName ?? null,
        createdAt: m.createdAt,
        roomId: m.roomId || roomId,
        status: 'sent',
    };
}

export async function fetchMessages(roomId: string, page = 0, size = 50): Promise<ChatMessage[]> {
    const res = await httpClient.get<PagedResponse<MessageDto>>(`/rooms/${roomId}/messages`, {
        params: { page, size },
    });
    return res.data.content.map((m) => toChatMessage(m, roomId));
}

export async function uploadAttachmentMessage(
    roomId: string,
    file: File,
    content?: string,
    onProgress?: (progress: number) => void
): Promise<ChatMessage> {
    const formData = new FormData();
    formData.append('file', file);
    if (content && content.trim()) {
        formData.append('content', content.trim());
    }
    formData.append('idempotencyKey', generateIdempotencyKey());

    const res = await httpClient.post<MessageDto>(`/rooms/${roomId}/messages/attachments`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (event) => {
            if (!event.total || !onProgress) return;
            onProgress(Math.round((event.loaded / event.total) * 100));
        },
    });

    return toChatMessage(res.data, roomId);
}
