export function generateIdempotencyKey(): string {
    return crypto.randomUUID();
}

export function formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function getInitials(name: string): string {
    return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

export function classNames(...classes: (string | false | undefined | null)[]): string {
    return classes.filter(Boolean).join(' ');
}

export function resolveMediaUrl(raw: string | null): string | null {
    if (!raw || !raw.trim()) return null;
    const value = raw.trim();

    if (
        value.startsWith('data:image/') ||
        value.startsWith('http://') ||
        value.startsWith('https://') ||
        value.startsWith('blob:')
    ) {
        return value;
    }

    if (value.startsWith('/')) {
        const backendOrigin = import.meta.env.VITE_BACKEND_ORIGIN || 'http://localhost:9090';
        return `${backendOrigin}${value}`;
    }

    return value;
}
