import { create } from 'zustand';

export interface ToastItem {
    id: string;
    title: string;
    message?: string;
    tone?: 'info' | 'success';
}

interface ToastState {
    toasts: ToastItem[];
    pushToast: (toast: Omit<ToastItem, 'id'>) => void;
    removeToast: (id: string) => void;
}

const TOAST_LIFETIME_MS = 3600;

export const useToastStore = create<ToastState>((set) => ({
    toasts: [],
    pushToast: (toast) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const nextToast: ToastItem = { id, tone: 'info', ...toast };
        set((state) => ({
            toasts: [...state.toasts, nextToast].slice(-4),
        }));

        window.setTimeout(() => {
            set((state) => ({
                toasts: state.toasts.filter((item) => item.id !== id),
            }));
        }, TOAST_LIFETIME_MS);
    },
    removeToast: (id) =>
        set((state) => ({
            toasts: state.toasts.filter((item) => item.id !== id),
        })),
}));
