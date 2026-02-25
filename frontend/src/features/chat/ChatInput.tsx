import { type KeyboardEvent, type ChangeEvent, useState, useRef, useCallback } from 'react';

interface Props {
    onSendText: (content: string) => void;
    onUploadAttachment: (file: File, content?: string, onProgress?: (progress: number) => void) => Promise<void>;
    disabled: boolean;
}

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const ACCEPTED_FILES = '.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov,.mp3,.wav,.m4a,.ogg,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx';

export default function ChatInput({ onSendText, onUploadAttachment, disabled }: Props) {
    const [value, setValue] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (value.trim() && !disabled && !uploading) {
                    onSendText(value.trim());
                    setValue('');
                    if (textareaRef.current) {
                        textareaRef.current.style.height = 'auto';
                    }
                }
            }
        },
        [value, disabled, uploading, onSendText]
    );

    const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setValue(e.target.value);
        // Auto-resize textarea
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    };

    const clearUploadState = () => {
        setUploadProgress(0);
        setUploading(false);
        setUploadError(null);
    };

    const handleAttachClick = () => {
        if (disabled || uploading) return;
        fileInputRef.current?.click();
    };

    const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadError(null);
        if (file.size > MAX_ATTACHMENT_BYTES) {
            setUploadError('File is too large. Maximum allowed size is 25MB.');
            e.target.value = '';
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        try {
            await onUploadAttachment(file, value.trim() || undefined, setUploadProgress);
            setValue('');
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
            clearUploadState();
        } catch (error: any) {
            const apiMessage = error?.response?.data?.message;
            setUploadError(apiMessage || 'Upload failed. Please try again.');
            setUploading(false);
        } finally {
            e.target.value = '';
        }
    };

    return (
        <div className="chat-input-container">
            <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILES}
                className="chat-file-input-hidden"
                onChange={handleFileSelected}
                disabled={disabled || uploading}
            />
            <button
                className="chat-attach-btn"
                onClick={handleAttachClick}
                disabled={disabled || uploading}
                aria-label="Attach file"
                type="button"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.44 11.05l-8.49 8.49a5 5 0 01-7.07-7.07l8.49-8.49a3 3 0 014.24 4.24l-8.48 8.49a1 1 0 01-1.42-1.42l7.78-7.78" />
                </svg>
            </button>
            <textarea
                ref={textareaRef}
                className="chat-input"
                value={value}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder={disabled ? 'Reconnecting...' : 'Type a message...'}
                disabled={disabled || uploading}
                rows={1}
                aria-label="Type a message"
                role="textbox"
            />
            <button
                className="chat-send-btn"
                onClick={() => {
                    if (value.trim() && !disabled && !uploading) {
                        onSendText(value.trim());
                        setValue('');
                    }
                }}
                disabled={!value.trim() || disabled || uploading}
                aria-label="Send message"
                type="button"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
            </button>
            {(uploading || uploadError) && (
                <div className="chat-upload-status" role="status" aria-live="polite">
                    {uploading && (
                        <>
                            <span className="chat-upload-status__text">Uploading... {uploadProgress}%</span>
                            <div className="chat-upload-progress">
                                <div className="chat-upload-progress__bar" style={{ width: `${uploadProgress}%` }} />
                            </div>
                        </>
                    )}
                    {!uploading && uploadError && <span className="chat-upload-status__error">{uploadError}</span>}
                </div>
            )}
        </div>
    );
}
