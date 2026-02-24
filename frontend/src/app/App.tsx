import { type ReactNode, useEffect, useState } from 'react';
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
                    <button className="logout-btn" onClick={handleLogout}>
                        Logout
                    </button>
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
