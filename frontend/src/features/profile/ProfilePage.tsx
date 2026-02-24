import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../auth/authStore';
import { fetchMyProfile, updateMyProfile } from './profileApi';
import type { UserProfile } from './profileApi';
import './profile.css';

interface FormState {
    username: string;
    email: string;
    fullName: string;
    bio: string;
    avatarUrl: string;
}

function getInitial(nameOrUsername: string): string {
    const value = nameOrUsername?.trim();
    return value ? value[0].toUpperCase() : '?';
}

async function createCroppedAvatarDataUrl(file: File): Promise<string> {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });

    const size = 320;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to process image');

    const srcSize = Math.min(image.width, image.height);
    const sx = (image.width - srcSize) / 2;
    const sy = (image.height - srcSize) / 2;

    ctx.drawImage(image, sx, sy, srcSize, srcSize, 0, 0, size, size);
    URL.revokeObjectURL(image.src);
    return canvas.toDataURL('image/jpeg', 0.9);
}

export default function ProfilePage() {
    const navigate = useNavigate();
    const setUsername = useAuthStore((s) => s.setUsername);
    const setAvatarUrl = useAuthStore((s) => s.setAvatarUrl);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [form, setForm] = useState<FormState>({
        username: '',
        email: '',
        fullName: '',
        bio: '',
        avatarUrl: '',
    });

    useEffect(() => {
        let mounted = true;
        fetchMyProfile()
            .then((profile) => {
                if (!mounted) return;
                setForm({
                    username: profile.username ?? '',
                    email: profile.email ?? '',
                    fullName: profile.fullName ?? '',
                    bio: profile.bio ?? '',
                    avatarUrl: profile.avatarUrl ?? '',
                });
            })
            .catch((err: any) => {
                const msg = err.response?.data?.message || 'Failed to load profile';
                setError(msg);
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, []);

    const displayName = useMemo(() => form.fullName.trim() || form.username.trim(), [form.fullName, form.username]);

    const handleInput = (key: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
        setError('');
        setSuccess('');
    };

    const handleAvatarFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('Please select a valid image file');
            return;
        }

        try {
            const avatarDataUrl = await createCroppedAvatarDataUrl(file);
            setForm((prev) => ({ ...prev, avatarUrl: avatarDataUrl }));
            setError('');
            setSuccess('Avatar updated in preview');
        } catch {
            setError('Failed to process avatar image');
        }
    };

    const handleRemoveAvatar = () => {
        setForm((prev) => ({ ...prev, avatarUrl: '' }));
        setSuccess('Avatar removed in preview');
        setError('');
    };

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const payload = {
                username: form.username.trim(),
                email: form.email.trim(),
                fullName: form.fullName.trim(),
                bio: form.bio.trim(),
                avatarUrl: form.avatarUrl.trim(),
            };

            const updated: UserProfile = await updateMyProfile(payload);
            setForm({
                username: updated.username ?? '',
                email: updated.email ?? '',
                fullName: updated.fullName ?? '',
                bio: updated.bio ?? '',
                avatarUrl: updated.avatarUrl ?? '',
            });
            setUsername(updated.username);
            setAvatarUrl(updated.avatarUrl ?? null);
            setSuccess('Profile saved');
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Failed to save profile';
            setError(msg);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="profile-page">
                <div className="profile-card">Loading profile...</div>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <form className="profile-card" onSubmit={handleSave}>
                <div className="profile-top">
                    <button type="button" className="profile-back" onClick={() => navigate('/chat')}>
                        Back
                    </button>
                    <h2>Profile</h2>
                </div>

                <div className="avatar-section">
                    <div className="avatar-preview">
                        {form.avatarUrl ? (
                            <img src={form.avatarUrl} alt="Profile preview" />
                        ) : (
                            <span>{getInitial(displayName)}</span>
                        )}
                    </div>
                    <div className="avatar-actions">
                        <label className="avatar-upload-btn">
                            Upload Photo
                            <input type="file" accept="image/*" onChange={handleAvatarFile} />
                        </label>
                        <button type="button" className="avatar-remove-btn" onClick={handleRemoveAvatar}>
                            Remove
                        </button>
                        <p className="avatar-note">Images are auto-cropped to square and resized for a clean avatar.</p>
                    </div>
                </div>

                <div className="profile-grid">
                    <label>
                        Full Name
                        <input type="text" value={form.fullName} onChange={handleInput('fullName')} maxLength={100} />
                    </label>
                    <label>
                        Username
                        <input type="text" value={form.username} onChange={handleInput('username')} maxLength={50} required />
                    </label>
                    <label>
                        Email
                        <input type="email" value={form.email} onChange={handleInput('email')} maxLength={255} required />
                    </label>
                    <label>
                        Bio
                        <textarea value={form.bio} onChange={handleInput('bio')} maxLength={500} rows={4} />
                    </label>
                </div>

                {error && <div className="profile-error">{error}</div>}
                {success && <div className="profile-success">{success}</div>}

                <div className="profile-footer">
                    <button type="button" className="secondary-btn" onClick={() => navigate('/chat')}>
                        Cancel
                    </button>
                    <button type="submit" className="primary-btn" disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
}


