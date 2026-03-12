import httpClient from '../../shared/httpClient';
import type { Room } from './roomApi';

export interface DmRequest {
    id: string;
    requesterId: string;
    requesterUsername: string;
    targetId: string;
    targetUsername: string;
    status: string;
    createdAt: string;
    respondedAt: string | null;
}

export async function sendDmRequest(username: string): Promise<DmRequest> {
    const res = await httpClient.post<DmRequest>(`/dm-requests/by-username/${encodeURIComponent(username)}`);
    return res.data;
}

export async function fetchIncomingDmRequests(): Promise<DmRequest[]> {
    const res = await httpClient.get<DmRequest[]>('/dm-requests/incoming');
    return res.data;
}

export async function acceptDmRequest(requestId: string): Promise<Room> {
    const res = await httpClient.post<Room>(`/dm-requests/${requestId}/accept`);
    return res.data;
}

export async function rejectDmRequest(requestId: string): Promise<DmRequest> {
    const res = await httpClient.post<DmRequest>(`/dm-requests/${requestId}/reject`);
    return res.data;
}
