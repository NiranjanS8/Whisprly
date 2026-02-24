import { type KeyboardEvent, type ChangeEvent, useState, useRef, useCallback } from 'react';

interface Props {
    onSend: (content: string) => void;
    disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
    const [value, setValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (value.trim() && !disabled) {
                    onSend(value.trim());
                    setValue('');
                    if (textareaRef.current) {
                        textareaRef.current.style.height = 'auto';
                    }
                }
            }
        },
        [value, disabled, onSend]
    );

    const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setValue(e.target.value);
        // Auto-resize textarea
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    };

    return (
        <div className="chat-input-container">
            <textarea
                ref={textareaRef}
                className="chat-input"
                value={value}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder={disabled ? 'Reconnecting...' : 'Type a message...'}
                disabled={disabled}
                rows={1}
                aria-label="Type a message"
                role="textbox"
            />
            <button
                className="chat-send-btn"
                onClick={() => {
                    if (value.trim() && !disabled) {
                        onSend(value.trim());
                        setValue('');
                    }
                }}
                disabled={!value.trim() || disabled}
                aria-label="Send message"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
            </button>
        </div>
    );
}
