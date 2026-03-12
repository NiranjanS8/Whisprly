import { type ReactNode, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';
import { wsService } from '../features/chat/websocket';
import { useRoomStore } from '../features/rooms/roomStore';
import { useChatStore } from '../features/chat/chatStore';
import { searchMessagesGlobal, type MessageSearchResult } from '../features/chat/messageApi';
import LoginPage from '../features/auth/LoginPage';
import RegisterPage from '../features/auth/RegisterPage';
import Sidebar from '../features/rooms/Sidebar';
import ChatPanel from '../features/chat/ChatPanel';
import ProfilePage from '../features/profile/ProfilePage';
import RoomSettingsPage from '../features/rooms/RoomSettingsPage';
import { fetchMyProfile } from '../features/profile/profileApi';
import { resolveMediaUrl } from '../shared/utils';
import './App.css';

function formatSearchTime(dateString: string): string {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function ProtectedRoute({ children }: { children: ReactNode }) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

function ChatLayout() {
    const navigate = useNavigate();
    const accessToken = useAuthStore((s) => s.accessToken);
    const username = useAuthStore((s) => s.username);
    const avatarUrl = useAuthStore((s) => s.avatarUrl);
    const setAvatarUrl = useAuthStore((s) => s.setAvatarUrl);
    const setUsername = useAuthStore((s) => s.setUsername);
    const clearAuth = useAuthStore((s) => s.clearAuth);
    const setActiveRoom = useRoomStore((s) => s.setActiveRoom);
    const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 769px)').matches);
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
    const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<MessageSearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const headerMenuRef = useRef<HTMLDivElement | null>(null);
    const headerSearchRef = useRef<HTMLDivElement | null>(null);
    const resolvedAvatarUrl = resolveMediaUrl(avatarUrl);

    useEffect(() => {
        if (accessToken) {
            wsService.connect(accessToken);
            fetchMyProfile()
                .then((profile) => {
                    setAvatarUrl(profile.avatarUrl ?? null);
                    if (profile.username) {
                        setUsername(profile.username);
                    }
                    setAvatarLoadFailed(false);
                })
                .catch(() => {
                    // no-op; keep existing auth state
                });
        }
        return () => {
            wsService.disconnect();
        };
    }, [accessToken, setAvatarUrl, setUsername]);

    const handleLogout = () => {
        wsService.disconnect();
        clearAuth();
    };

    useEffect(() => {
        if (!headerMenuOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
                setHeaderMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [headerMenuOpen]);

    useEffect(() => {
        if (!searchOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (headerSearchRef.current && !headerSearchRef.current.contains(event.target as Node)) {
                setSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [searchOpen]);

    useEffect(() => {
        if (!searchOpen) return;
        const query = searchQuery.trim();
        if (query.length < 2) {
            setSearchResults([]);
            setSearchLoading(false);
            return;
        }

        setSearchLoading(true);
        const timer = window.setTimeout(() => {
            searchMessagesGlobal(query, 25)
                .then(setSearchResults)
                .catch(() => setSearchResults([]))
                .finally(() => setSearchLoading(false));
        }, 180);

        return () => window.clearTimeout(timer);
    }, [searchQuery, searchOpen]);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 769px)');
        const syncSidebarState = () => {
            setSidebarOpen(mediaQuery.matches);
        };
        mediaQuery.addEventListener('change', syncSidebarState);
        return () => mediaQuery.removeEventListener('change', syncSidebarState);
    }, []);

    const handleMenuAction = (action: 'help' | 'settings' | 'profile' | 'logout') => {
        setHeaderMenuOpen(false);
        if (action === 'logout') {
            handleLogout();
            return;
        }
        if (action === 'profile') {
            navigate('/profile');
            return;
        }
        console.info(`${action} clicked`);
    };

    const jumpToSearchResult = (result: MessageSearchResult) => {
        setActiveRoom(result.roomSlug);
        useChatStore.getState().setJumpTarget(result.roomSlug, result.messageId);
        setSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
        navigate('/chat');
    };

    return (
        <div className="app-layout">
            <header className="top-bar">
                <div className="top-bar-left">
                    <button
                        className={`mobile-menu-btn ${sidebarOpen ? 'is-open' : ''}`}
                        onClick={() => setSidebarOpen((prev) => !prev)}
                        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                        aria-expanded={sidebarOpen}
                    >
                        {sidebarOpen ? 'X' : '\u2630'}
                    </button>
                    <span className="brand-logo">Whisprly</span>
                </div>
                <div className="top-bar-right">
                    <div className="header-search" ref={headerSearchRef}>
                        <button
                            type="button"
                            className={`header-search-btn ${searchOpen ? 'is-open' : ''}`}
                            aria-label="Search messages"
                            aria-expanded={searchOpen}
                            onClick={() => {
                                setSearchOpen((prev) => !prev);
                                setHeaderMenuOpen(false);
                            }}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" stroke="currentColor" strokeWidth="2" fill="none" />
                                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </button>
                        {searchOpen && (
                            <div className="header-search-popover" role="dialog" aria-label="Global message search">
                                <div className="header-search-input-wrap">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search all messages..."
                                        autoFocus
                                    />
                                </div>
                                <div className="header-search-results">
                                    {searchLoading && <div className="header-search-empty">Searching...</div>}
                                    {!searchLoading && searchQuery.trim().length < 2 && (
                                        <div className="header-search-empty">Type at least 2 characters</div>
                                    )}
                                    {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                                        <div className="header-search-empty">No matching messages</div>
                                    )}
                                    {searchResults.map((result) => (
                                        <button
                                            key={result.messageId}
                                            type="button"
                                            className="header-search-item"
                                            onClick={() => jumpToSearchResult(result)}
                                        >
                                            <span className="header-search-item__preview">{result.preview}</span>
                                            <span className="header-search-item__meta">
                                                {result.senderFullName?.trim() || result.senderUsername} · {result.roomName} · {formatSearchTime(result.createdAt)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="header-menu" ref={headerMenuRef}>
                        <button
                            type="button"
                            className="avatar-menu-btn"
                            aria-label="Open profile menu"
                            aria-expanded={headerMenuOpen}
                            onClick={() => setHeaderMenuOpen((prev) => !prev)}
                        >
                            <span className="user-avatar">
                                {resolvedAvatarUrl && !avatarLoadFailed ? (
                                    <img
                                        src={resolvedAvatarUrl}
                                        alt="Profile avatar"
                                        onError={() => setAvatarLoadFailed(true)}
                                    />
                                ) : (
                                    username ? username[0].toUpperCase() : '?'
                                )}
                            </span>
                        </button>
                        {headerMenuOpen && (
                            <div className="header-menu-popover" role="menu" aria-label="Header actions">
                                <button type="button" className="header-menu-item" onClick={() => handleMenuAction('help')}>
                                    Help
                                </button>
                                <button type="button" className="header-menu-item" onClick={() => handleMenuAction('settings')}>
                                    Settings
                                </button>
                                <button type="button" className="header-menu-item" onClick={() => handleMenuAction('profile')}>
                                    Profile
                                </button>
                                <button type="button" className="header-menu-item header-menu-item--danger" onClick={() => handleMenuAction('logout')}>
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>
            <div className={`app-body ${sidebarOpen ? 'app-body--sidebar-open' : 'app-body--sidebar-closed'}`}>
                <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <main className="main-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route
                    path="/chat"
                    element={
                        <ProtectedRoute>
                            <ChatLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<ChatPanel />} />
                    <Route path="rooms/:roomSlug/settings" element={<RoomSettingsPage />} />
                </Route>
                <Route
                    path="/profile"
                    element={
                        <ProtectedRoute>
                            <ProfilePage />
                        </ProtectedRoute>
                    }
                />
                <Route path="*" element={<Navigate to="/chat" replace />} />
            </Routes>
        </BrowserRouter>
    );
}


