import { type FormEvent, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from './authApi';
import { useAuthStore } from './authStore';
import './auth.css';

export default function RegisterPage() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
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
            const res = await registerUser(username, email, password);
            setAuth(res);
            navigate('/chat');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card animate-slide-up">
                <div className="auth-brand">
                    <h1 className="auth-logo">Whisprly</h1>
                    <p className="auth-tagline">Create your account</p>
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
                            placeholder="Choose a username"
                            required
                            autoFocus
                            autoComplete="username"
                        />
                    </div>
                    <div className="auth-field">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            autoComplete="email"
                        />
                    </div>
                    <div className="auth-field">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            required
                            minLength={8}
                            autoComplete="new-password"
                        />
                    </div>
                    <button type="submit" className="auth-submit" disabled={loading}>
                        {loading ? <span className="spinner" /> : 'Create Account'}
                    </button>
                </form>
                <p className="auth-switch">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </div>
        </div>
    );
}
