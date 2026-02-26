import React, { useEffect, useState } from 'react';
import type { ChatMessage, MessageStatus } from './chatStore';
import { formatTime, getInitials, normalizeApiPath, resolveMediaUrl } from '../../shared/utils';
import httpClient from '../../shared/httpClient';

interface Props {
    message: ChatMessage;
    isOwn: boolean;
    showAvatar: boolean;
    showSender: boolean;
    avatarUrl?: string | null;
    onEdit?: (message: ChatMessage) => void;
    onDelete?: (message: ChatMessage) => void;
}

const PREVIEW_CACHE_LIMIT = 120;
const previewBlobUrlCache = new Map<string, string>();
const previewBlobPromiseCache = new Map<string, Promise<string>>();

function cachePreviewUrl(key: string, objectUrl: string) {
    if (previewBlobUrlCache.has(key)) return;
    previewBlobUrlCache.set(key, objectUrl);

    if (previewBlobUrlCache.size > PREVIEW_CACHE_LIMIT) {
        const oldestKey = previewBlobUrlCache.keys().next().value as string | undefined;
        if (!oldestKey) return;
        const oldestUrl = previewBlobUrlCache.get(oldestKey);
        previewBlobUrlCache.delete(oldestKey);
        if (oldestUrl) URL.revokeObjectURL(oldestUrl);
    }
}

async function getOrLoadPreviewUrl(url: string): Promise<string> {
    const cached = previewBlobUrlCache.get(url);
    if (cached) return cached;

    const pending = previewBlobPromiseCache.get(url);
    if (pending) return pending;

    const request = httpClient
        .get<Blob>(url, { responseType: 'blob' })
        .then((res) => {
            const objectUrl = URL.createObjectURL(res.data);
            cachePreviewUrl(url, objectUrl);
            previewBlobPromiseCache.delete(url);
            return objectUrl;
        })
        .catch((error) => {
            previewBlobPromiseCache.delete(url);
            throw error;
        });

    previewBlobPromiseCache.set(url, request);
    return request;
}

function MessageStatusIndicator({ status }: { status: MessageStatus }) {
    if (status === 'sending') {
        return <span className="msg__status msg__status--sending" aria-label="Sending">○</span>;
    }

    if (status === 'sent') {
        return (
            <span className="msg__status msg__status--sent" aria-label="Sent">
                <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M3 8.5 6.2 11.5 13 4.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
        );
    }

    if (status === 'read') {
        return (
            <span className="msg__status msg__status--read" aria-label="Read">
                <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M1.8 9 4.6 11.7 8.5 7.8" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6.7 9 9.5 11.7 14.2 7" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
        );
    }

    if (status === 'delivered') {
        return (
            <span className="msg__status msg__status--sent" aria-label="Delivered">
                <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M3 8.5 6.2 11.5 13 4.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
        );
    }

    return <span className="msg__status msg__status--failed" aria-label="Failed">!</span>;
}

const MessageBubble = React.memo(function MessageBubble({
    message,
    isOwn,
    showAvatar,
    showSender,
    avatarUrl,
    onEdit,
    onDelete,
}: Props) {
    const senderDisplayName = message.senderFullName?.trim() || message.senderUsername;
    const resolvedAvatarUrl = resolveMediaUrl(avatarUrl ?? null);
    const attachment = message.attachment;
    const attachmentUrl = attachment ? normalizeApiPath(attachment.url) : '';
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const isImage = attachment?.category === 'IMAGE';
    const isVideo = attachment?.category === 'VIDEO';
    const isVisualPreview = isImage || isVideo;
    const isDeleted = !!message.deletedAt;
    const canEdit = isOwn && !!message.id && !isDeleted && message.status !== 'sending';

    useEffect(() => {
        let active = true;

        const loadPreview = async () => {
            if (!attachment || !isVisualPreview || isDeleted) {
                setPreviewUrl(null);
                setPreviewLoading(false);
                return;
            }

            const cached = previewBlobUrlCache.get(attachmentUrl);
            if (cached) {
                setPreviewUrl(cached);
                setPreviewLoading(false);
                return;
            }

            try {
                setPreviewLoading(true);
                const objectUrl = await getOrLoadPreviewUrl(attachmentUrl);
                if (!active) return;
                setPreviewUrl(objectUrl);
            } catch {
                if (active) setPreviewUrl(null);
            } finally {
                if (active) setPreviewLoading(false);
            }
        };

        loadPreview();

        return () => {
            active = false;
        };
    }, [attachmentUrl, isVisualPreview]);

    useEffect(() => {
        if (!imageViewerOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setImageViewerOpen(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [imageViewerOpen]);

    useEffect(() => {
        if (!imageViewerOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [imageViewerOpen]);

    const fetchAttachmentBlob = async () => {
        if (!attachment) return null;
        const res = await httpClient.get<Blob>(attachmentUrl, { responseType: 'blob' });
        return res.data;
    };

    const onDownloadAttachment = async () => {
        if (!attachment) return;
        const blob = await fetchAttachmentBlob();
        if (!blob) return;
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = attachment.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    };

    const onOpenAttachment = async () => {
        if (!attachment) return;
        const blob = await fetchAttachmentBlob();
        if (!blob) return;
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
    };

    return (
        <>
            <div className={`msg ${isOwn ? 'msg--own' : 'msg--other'} ${showAvatar ? '' : 'msg--stacked'}`}>
                {!isOwn && showAvatar && (
                    <div className="msg__avatar" title={senderDisplayName}>
                        {resolvedAvatarUrl ? <img src={resolvedAvatarUrl} alt={`${senderDisplayName} avatar`} /> : getInitials(senderDisplayName)}
                    </div>
                )}
                {!isOwn && !showAvatar && <div className="msg__avatar-spacer" aria-hidden="true" />}
                <div className="msg__body">
                    {!isOwn && showSender && <span className="msg__sender">{senderDisplayName}</span>}
                    <div
                        className={`msg__bubble ${message.status === 'sending' ? 'msg__bubble--sending' : ''} ${message.status === 'failed' ? 'msg__bubble--failed' : ''} ${isDeleted ? 'msg__bubble--deleted' : ''}`}
                    >
                        {message.content && (
                            <p className={`msg__content ${isDeleted ? 'msg__content--deleted' : ''}`}>
                                {message.content}
                            </p>
                        )}
                        {!isDeleted && attachment && (
                            <div className="msg__attachment">
                                {isVisualPreview && previewUrl && (
                                    <div className="msg__attachment-preview-shell">
                                        {isImage ? (
                                            <button
                                                type="button"
                                                className="msg__image-preview-btn"
                                                onClick={() => setImageViewerOpen(true)}
                                                aria-label={`Open image ${attachment.fileName}`}
                                            >
                                                <img src={previewUrl} alt={attachment.fileName || 'Image attachment'} className="msg__attachment-preview msg__attachment-preview--image" />
                                            </button>
                                        ) : (
                                            <video src={previewUrl} controls className="msg__attachment-preview msg__attachment-preview--video" />
                                        )}
                                    </div>
                                )}
                                {isVisualPreview && previewLoading && !previewUrl && (
                                    <div className="msg__attachment-loading" aria-hidden="true" />
                                )}
                                <div className={`msg__attachment-footer ${!isVisualPreview ? 'msg__attachment-footer--document' : ''}`}>
                                    {!isVisualPreview && (
                                        <span className="msg__attachment-file-icon" aria-hidden="true">
                                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm7 1v5h5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                                            </svg>
                                        </span>
                                    )}
                                    {attachment.fileName && <span className="msg__attachment-name">{attachment.fileName}</span>}
                                    <button
                                        type="button"
                                        className="msg__attachment-action"
                                        onClick={isVideo ? onOpenAttachment : onDownloadAttachment}
                                        aria-label={`${isVideo ? 'Open' : 'Download'} ${attachment.fileName}`}
                                    >
                                        {isVideo ? 'Open' : 'Download'}
                                    </button>
                                </div>
                            </div>
                        )}
                        <span className="msg__time">
                            {formatTime(message.createdAt)}
                            {message.editedAt && !isDeleted && <span className="msg__edited">Edited</span>}
                            {isOwn && (
                                <MessageStatusIndicator status={message.status} />
                            )}
                        </span>
                        {canEdit && (
                            <div className="msg__actions">
                                <button
                                    type="button"
                                    className="msg__actions-btn"
                                    aria-label="Message actions"
                                    onClick={() => setMenuOpen((prev) => !prev)}
                                >
                                    <svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="12" cy="5" r="1.6" fill="currentColor" />
                                        <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                                        <circle cx="12" cy="19" r="1.6" fill="currentColor" />
                                    </svg>
                                </button>
                                {menuOpen && (
                                    <div className="msg__actions-menu">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMenuOpen(false);
                                                onEdit?.(message);
                                            }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            className="msg__actions-delete"
                                            onClick={() => {
                                                setMenuOpen(false);
                                                onDelete?.(message);
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isImage && previewUrl && imageViewerOpen && (
                <div className="chat-image-viewer" onClick={() => setImageViewerOpen(false)} role="dialog" aria-modal="true" aria-label="Image preview">
                    <button
                        type="button"
                        className="chat-image-viewer__back"
                        onClick={() => setImageViewerOpen(false)}
                        aria-label="Back"
                    >
                        Back
                    </button>
                    <img
                        src={previewUrl}
                        alt={attachment?.fileName || 'Image attachment'}
                        className="chat-image-viewer__image"
                        onClick={(event) => event.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
});

export default MessageBubble;
