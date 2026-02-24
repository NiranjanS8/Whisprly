import React from 'react';
import type { ChatMessage } from './chatStore';
import { formatTime, getInitials } from '../../shared/utils';

interface Props {
    message: ChatMessage;
    isOwn: boolean;
}

const MessageBubble = React.memo(function MessageBubble({ message, isOwn }: Props) {
    return (
        <div className={`msg ${isOwn ? 'msg--own' : 'msg--other'}`}>
            {!isOwn && (
                <div className="msg__avatar" title={message.senderUsername}>
                    {getInitials(message.senderUsername)}
                </div>
            )}
            <div className="msg__body">
                {!isOwn && <span className="msg__sender">{message.senderUsername}</span>}
                <div className={`msg__bubble ${message.status === 'sending' ? 'msg__bubble--sending' : ''} ${message.status === 'failed' ? 'msg__bubble--failed' : ''}`}>
                    <p className="msg__content">{message.content}</p>
                    <span className="msg__time">
                        {formatTime(message.createdAt)}
                        {isOwn && (
                            <span className={`msg__status msg__status--${message.status}`}>
                                {message.status === 'sending' && '○'}
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
