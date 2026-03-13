import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './confirm-modal.css';

interface ConfirmModalProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    destructive?: boolean;
    isLoading?: boolean;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
}

export default function ConfirmModal({
    open,
    title,
    message,
    confirmLabel,
    cancelLabel = 'Cancel',
    destructive = false,
    isLoading = false,
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isLoading) {
                onCancel();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, isLoading, onCancel]);

    if (!open) return null;

    return createPortal(
        <div className="confirm-modal-backdrop" onClick={() => !isLoading && onCancel()}>
            <div
                className="confirm-modal"
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(event) => event.stopPropagation()}
            >
                <h3 className="confirm-modal__title">{title}</h3>
                <p className="confirm-modal__message">{message}</p>
                <div className="confirm-modal__actions">
                    <button
                        type="button"
                        className="confirm-modal__btn confirm-modal__btn--neutral"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`confirm-modal__btn ${destructive ? 'confirm-modal__btn--destructive' : 'confirm-modal__btn--accent'}`}
                        onClick={() => void onConfirm()}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Please wait...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
