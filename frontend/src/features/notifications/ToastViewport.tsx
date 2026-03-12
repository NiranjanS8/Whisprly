import { useToastStore } from './toastStore';
import './toast.css';

export default function ToastViewport() {
    const toasts = useToastStore((s) => s.toasts);
    const removeToast = useToastStore((s) => s.removeToast);

    if (toasts.length === 0) {
        return null;
    }

    return (
        <div className="toast-viewport" aria-live="polite" aria-atomic="true">
            {toasts.map((toast) => (
                <div key={toast.id} className={`toast toast--${toast.tone ?? 'info'}`}>
                    <div className="toast__content">
                        <div className="toast__title">{toast.title}</div>
                        {toast.message && <div className="toast__message">{toast.message}</div>}
                    </div>
                    <button
                        type="button"
                        className="toast__close"
                        aria-label="Dismiss notification"
                        onClick={() => removeToast(toast.id)}
                    >
                        x
                    </button>
                </div>
            ))}
        </div>
    );
}
