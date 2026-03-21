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
import ToastViewport from '../features/notifications/ToastViewport';
import { logoutSession } from '../features/auth/authApi';
import { fetchMyProfile } from '../features/profile/profileApi';
import { resolveMediaUrl } from '../shared/utils';
import ConfirmModal from '../shared/ConfirmModal';
import './App.css';

function ProtectedRoute({ children }: { children: ReactNode }) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

function ChatLayout() {
    const navigate = useNavigate();
    const accessToken = useAuthStore((s) => s.accessToken);
    const refreshToken = useAuthStore((s) => s.refreshToken);
    const username = useAuthStore((s) => s.username);
    const avatarUrl = useAuthStore((s) => s.avatarUrl);
    const setAvatarUrl = useAuthStore((s) => s.setAvatarUrl);
    const setUsername = useAuthStore((s) => s.setUsername);
    const clearAuth = useAuthStore((s) => s.clearAuth);
    const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 769px)').matches);
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
    const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
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
                    // Keep existing auth state if profile refresh fails.
                });
        }
        return () => {
            wsService.disconnect();
        };
    }, [accessToken, setAvatarUrl, setUsername]);

    const handleLogout = async () => {
        if (refreshToken) {
            try {
                await logoutSession(refreshToken);
            } catch {
                // Best-effort logout; clear local auth regardless.
            }
        }
        wsService.disconnect();
        clearAuth();
        navigate('/login', { replace: true });
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

    const handleMenuAction = (action: 'profile' | 'logout') => {
        setHeaderMenuOpen(false);
        if (action === 'logout') {
            setLogoutConfirmOpen(true);
            return;
        }
        navigate('/profile');
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
            <ConfirmModal
                open={logoutConfirmOpen}
                title="Log out"
                message="Are you sure you want to log out?"
                confirmLabel="Log Out"
                destructive
                onCancel={() => setLogoutConfirmOpen(false)}
                onConfirm={() => {
                    setLogoutConfirmOpen(false);
                    void handleLogout();
                }}
            />
        </div>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <ToastViewport />
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
