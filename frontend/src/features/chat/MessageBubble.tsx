import React, { useEffect, useState } from 'react';
import type { ChatMessage } from './chatStore';
import { formatTime, getInitials, normalizeApiPath, resolveMediaUrl } from '../../shared/utils';
import httpClient from '../../shared/httpClient';

interface Props {
    message: ChatMessage;
    isOwn: boolean;
    showAvatar: boolean;
    showSender: boolean;
    avatarUrl?: string | null;
}

const MessageBubble = React.memo(function MessageBubble({ message, isOwn, showAvatar, showSender, avatarUrl }: Props) {
    const resolvedAvatarUrl = resolveMediaUrl(avatarUrl ?? null);
    const attachment = message.attachment;
    const attachmentUrl = attachment ? normalizeApiPath(attachment.url) : '';
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const isVisualPreview = attachment?.category === 'IMAGE' || attachment?.category === 'VIDEO';

    useEffect(() => {
        let active = true;
        let localObjectUrl: string | null = null;

        const loadPreview = async () => {
            if (!attachment || !isVisualPreview) {
                setPreviewUrl(null);
                return;
            }

            try {
                const res = await httpClient.get<Blob>(attachmentUrl, { responseType: 'blob' });
                if (!active) return;
                localObjectUrl = URL.createObjectURL(res.data);
                setPreviewUrl(localObjectUrl);
            } catch {
                if (active) setPreviewUrl(null);
            }
        };

        loadPreview();

        return () => {
            active = false;
            if (localObjectUrl) URL.revokeObjectURL(localObjectUrl);
        };
    }, [attachment, attachmentUrl, isVisualPreview]);

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
        <div className={`msg ${isOwn ? 'msg--own' : 'msg--other'} ${showAvatar ? '' : 'msg--stacked'}`}>
            {!isOwn && showAvatar && (
                <div className="msg__avatar" title={message.senderUsername}>
                    {resolvedAvatarUrl ? <img src={resolvedAvatarUrl} alt={`${message.senderUsername} avatar`} /> : getInitials(message.senderUsername)}
                </div>
            )}
            {!isOwn && !showAvatar && <div className="msg__avatar-spacer" aria-hidden="true" />}
            <div className="msg__body">
                {!isOwn && showSender && <span className="msg__sender">{message.senderUsername}</span>}
                <div className={`msg__bubble ${message.status === 'sending' ? 'msg__bubble--sending' : ''} ${message.status === 'failed' ? 'msg__bubble--failed' : ''}`}>
                    {message.content && <p className="msg__content">{message.content}</p>}
                    {attachment && (
                        <div className="msg__attachment">
                            {isVisualPreview && previewUrl && (
                                <div className="msg__attachment-preview-shell">
                                    {attachment.category === 'IMAGE' ? (
                                        <img src={previewUrl} alt={attachment.fileName || 'Image attachment'} className="msg__attachment-preview msg__attachment-preview--image" />
                                    ) : (
                                        <video src={previewUrl} controls className="msg__attachment-preview msg__attachment-preview--video" />
                                    )}
                                </div>
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
                                    onClick={isVisualPreview ? onOpenAttachment : onDownloadAttachment}
                                    aria-label={`${isVisualPreview ? 'Open' : 'Download'} ${attachment.fileName}`}
                                >
                                    {isVisualPreview ? 'Open' : 'Download'}
                                </button>
                            </div>
                        </div>
                    )}
                    <span className="msg__time">
                        {formatTime(message.createdAt)}
                        {isOwn && (
                            <span className={`msg__status msg__status--${message.status}`}>
                                {message.status === 'sending' && '...'}
                                {message.status === 'sent' && 'ok'}
                                {message.status === 'failed' && 'x'}
                            </span>
                        )}
                    </span>
                </div>
            </div>
        </div>
    );
});

export default MessageBubble;
