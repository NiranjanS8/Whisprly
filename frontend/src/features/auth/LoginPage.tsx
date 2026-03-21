import { type FormEvent, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser, loginWithGoogle } from './authApi';
import { useAuthStore } from './authStore';
import GoogleSignInButton from './GoogleSignInButton';
import './auth.css';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const setAuth = useAuthStore((s) => s.setAuth);
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await loginUser(username, password);
            setAuth(res);
            navigate('/chat');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async (credential: string) => {
        setError('');
        setLoading(true);
        try {
            const res = await loginWithGoogle(credential);
            setAuth(res);
            navigate('/chat');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Google sign-in failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card animate-slide-up">
                <div className="auth-brand">
                    <h1 className="auth-logo">Whisprly</h1>
                    <p className="auth-tagline">Welcome back</p>
                </div>
                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <div className="auth-error">{error}</div>}
                    <div className="auth-field">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            required
                            autoFocus
                            autoComplete="username"
                        />
                    </div>
                    <div className="auth-field">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                            autoComplete="current-password"
                        />
                    </div>
                    <button type="submit" className="auth-submit" disabled={loading}>
                        {loading ? <span className="spinner" /> : 'Sign In'}
                    </button>
                </form>
                <GoogleSignInButton onCredential={handleGoogleSignIn} disabled={loading} />
                <p className="auth-switch">
                    Don't have an account? <Link to="/register">Sign up</Link>
                </p>
            </div>
        </div>
    );
}
