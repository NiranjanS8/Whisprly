import React from 'react';
import type { ChatMessage } from './chatStore';
import { formatTime, getInitials, resolveMediaUrl } from '../../shared/utils';

interface Props {
    message: ChatMessage;
    isOwn: boolean;
    showAvatar: boolean;
    showSender: boolean;
    avatarUrl?: string | null;
}

const MessageBubble = React.memo(function MessageBubble({ message, isOwn, showAvatar, showSender, avatarUrl }: Props) {
    const resolvedAvatarUrl = resolveMediaUrl(avatarUrl ?? null);

    return (
        <div className={`msg ${isOwn ? 'msg--own' : 'msg--other'} ${showAvatar ? '' : 'msg--stacked'}`}>
            {!isOwn && showAvatar && (
                <div className="msg__avatar" title={message.senderUsername}>
                    {resolvedAvatarUrl ? (
                        <img src={resolvedAvatarUrl} alt={`${message.senderUsername} avatar`} />
                    ) : (
                        getInitials(message.senderUsername)
                    )}
                </div>
            )}
            {!isOwn && !showAvatar && <div className="msg__avatar-spacer" aria-hidden="true" />}
            <div className="msg__body">
                {!isOwn && showSender && <span className="msg__sender">{message.senderUsername}</span>}
                <div className={`msg__bubble ${message.status === 'sending' ? 'msg__bubble--sending' : ''} ${message.status === 'failed' ? 'msg__bubble--failed' : ''}`}>
                    <p className="msg__content">{message.content}</p>
                    <span className="msg__time">
                        {formatTime(message.createdAt)}
                        {isOwn && (
                            <span className={`msg__status msg__status--${message.status}`}>
                                {message.status === 'sending' && 'O'}
                                {message.status === 'sent' && '✓'}
                                {message.status === 'failed' && '✕'}
                            </span>
                        )}
                    </span>
                </div>
            </div>
        </div>
    );
});

export default MessageBubble;
