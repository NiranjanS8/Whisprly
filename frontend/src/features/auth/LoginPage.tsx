import { type FormEvent, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser, loginWithGoogle } from './authApi';
import { useAuthStore } from './authStore';
import GoogleSignInButton from './GoogleSignInButton';
import './auth.css';

function normalizeLoginError(err: any) {
    const responseMessage = err?.response?.data?.message;

    if (typeof responseMessage === 'string') {
        const normalized = responseMessage.trim().toLowerCase();

        if (normalized === 'invalid username or password') {
            return "That username, email, or password doesn't look right. Check your details and try again.";
        }

        return responseMessage;
    }

    if (!err?.response) {
        return "We couldn't reach the server. Make sure the backend is running, then try again.";
    }

    return "We couldn't sign you in right now. Please try again.";
}

export default function LoginPage() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const setAuth = useAuthStore((s) => s.setAuth);
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        const trimmedIdentifier = identifier.trim();

        if (!trimmedIdentifier && !password.trim()) {
            setError('Enter your username or email and your password to continue.');
            return;
        }

        if (!trimmedIdentifier) {
            setError('Enter your username or email to continue.');
            return;
        }

        if (!password.trim()) {
            setError('Enter your password to continue.');
            return;
        }

        setLoading(true);
        try {
            const res = await loginUser(trimmedIdentifier, password);
            setAuth(res);
            navigate('/chat');
        } catch (err: any) {
            setError(normalizeLoginError(err));
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
            setError(normalizeLoginError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card animate-slide-up">
                <div className="auth-brand">
                    <h1 className="auth-logo">Whisprly</h1>
                    <p className="auth-tagline">Sign in to jump back into your conversations.</p>
                </div>
                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <div className="auth-error" aria-live="polite">{error}</div>}
                    <div className="auth-field">
                        <label htmlFor="identifier">Username or Email</label>
                        <input
                            id="identifier"
                            type="text"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            placeholder="Enter your username or email"
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
                        {loading ? (
                            <>
                                <span className="spinner" />
                                <span>Signing in...</span>
                            </>
                        ) : 'Sign In'}
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
