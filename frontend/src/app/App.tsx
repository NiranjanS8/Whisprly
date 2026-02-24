import { type ReactNode, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';
import { wsService } from '../features/chat/websocket';
import LoginPage from '../features/auth/LoginPage';
import RegisterPage from '../features/auth/RegisterPage';
import Sidebar from '../features/rooms/Sidebar';
import ChatPanel from '../features/chat/ChatPanel';
import './App.css';

function ProtectedRoute({ children }: { children: ReactNode }) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

function ChatLayout() {
    const accessToken = useAuthStore((s) => s.accessToken);
    const username = useAuthStore((s) => s.username);
    const clearAuth = useAuthStore((s) => s.clearAuth);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
    const headerMenuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (accessToken) {
            wsService.connect(accessToken);
        }
        return () => {
            wsService.disconnect();
        };
    }, [accessToken]);

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

    const handleMenuAction = (action: 'help' | 'settings' | 'profile' | 'logout') => {
        setHeaderMenuOpen(false);
        if (action === 'logout') {
            handleLogout();
            return;
        }
        console.info(`${action} clicked`);
    };

    return (
        <div className="app-layout">
            <header className="top-bar">
                <div className="top-bar-left">
                    <button
                        className="mobile-menu-btn"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open sidebar"
                    >
                        ☰
                    </button>
                    <span className="brand-logo">Whisprly</span>
                </div>
                <div className="top-bar-right">
                    <div className="user-info">
                        <div className="user-avatar">{username ? username[0].toUpperCase() : '?'}</div>
                        <span className="username">{username}</span>
                    </div>
                    <div className="header-menu" ref={headerMenuRef}>
                        <button
                            type="button"
                            className="header-menu-btn"
                            aria-label="Open overflow menu"
                            aria-expanded={headerMenuOpen}
                            onClick={() => setHeaderMenuOpen((prev) => !prev)}
                        >
                            ⋮
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
            <div className="app-body">
                <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <main className="main-content">
                    <ChatPanel />
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
                    path="/chat/*"
                    element={
                        <ProtectedRoute>
                            <ChatLayout />
                        </ProtectedRoute>
                    }
                />
                <Route path="*" element={<Navigate to="/chat" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

