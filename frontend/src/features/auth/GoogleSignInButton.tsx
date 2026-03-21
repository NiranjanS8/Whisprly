import { useEffect, useRef, useState } from 'react';

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: {
                        client_id: string;
                        callback: (response: { credential?: string }) => void;
                        auto_select?: boolean;
                        cancel_on_tap_outside?: boolean;
                    }) => void;
                    renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
                };
            };
        };
    }
}

const GOOGLE_SCRIPT_ID = 'google-identity-services';

interface Props {
    onCredential: (credential: string) => Promise<void> | void;
    disabled?: boolean;
}

export default function GoogleSignInButton({ onCredential, disabled = false }: Props) {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [scriptError, setScriptError] = useState('');

    useEffect(() => {
        if (!clientId || disabled) {
            return;
        }

        let active = true;

        const renderGoogleButton = () => {
            if (!active || !window.google?.accounts?.id || !containerRef.current) {
                return;
            }

            containerRef.current.innerHTML = '';
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: ({ credential }) => {
                    if (credential) {
                        void onCredential(credential);
                    }
                },
                cancel_on_tap_outside: true,
            });
            window.google.accounts.id.renderButton(containerRef.current, {
                theme: 'outline',
                size: 'large',
                shape: 'pill',
                text: 'continue_with',
                width: 320,
            });
        };

        const existingScript = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
        if (existingScript) {
            if (window.google?.accounts?.id) {
                renderGoogleButton();
            } else {
                existingScript.addEventListener('load', renderGoogleButton, { once: true });
            }
            return () => {
                active = false;
                existingScript.removeEventListener('load', renderGoogleButton);
            };
        }

        const script = document.createElement('script');
        script.id = GOOGLE_SCRIPT_ID;
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => renderGoogleButton();
        script.onerror = () => {
            if (active) {
                setScriptError('Google sign-in is unavailable right now');
            }
        };
        document.head.appendChild(script);

        return () => {
            active = false;
        };
    }, [clientId, disabled, onCredential]);

    if (!clientId) {
        return null;
    }

    return (
        <div className="auth-google">
            <div className="auth-divider">
                <span>or</span>
            </div>
            {scriptError && <div className="auth-error">{scriptError}</div>}
            <div className={`auth-google__button ${disabled ? 'is-disabled' : ''}`} ref={containerRef} />
        </div>
    );
}
