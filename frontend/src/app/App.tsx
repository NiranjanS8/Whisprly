import { type ReactNode, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';
import { wsService } from '../features/chat/websocket';
import LoginPage from '../features/auth/LoginPage';
import RegisterPage from '../features/auth/RegisterPage';
import Sidebar from '../features/rooms/Sidebar';
import ChatPanel from '../features/chat/ChatPanel';
import ProfilePage from '../features/profile/ProfilePage';
import RoomSettingsPage from '../features/rooms/RoomSettingsPage';
import { fetchMyProfile } from '../features/profile/profileApi';
import { resolveMediaUrl } from '../shared/utils';
import './App.css';

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
    const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 769px)').matches);
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
    const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
    const headerMenuRef = useRef<HTMLDivElement | null>(null);
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
                    <Route path="rooms/:roomId/settings" element={<RoomSettingsPage />} />
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


