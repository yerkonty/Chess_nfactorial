'use client'
import { useState } from 'react';
import { account } from '@/lib/appwrite';
import { AppwriteException, OAuthProvider } from 'appwrite';

export default function AuthForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLogin, setIsLogin] = useState(true);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            await account.createEmailPasswordSession(email, password);
            window.location.reload();
        } catch (e) {
            if (e instanceof AppwriteException) setError(e.message);
            else setError('An unexpected error occurred.');
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            await account.create('unique()', email, password, name);
            await handleLogin(e);
        } catch (e) {
            if (e instanceof AppwriteException) setError(e.message);
            else setError('An unexpected error occurred.');
        }
    };

    const handleGoogleLogin = () => {
        try {
            account.createOAuth2Session(
                OAuthProvider.Google,
                `${window.location.origin}/`,
                `${window.location.origin}/?error=true`
            );
        } catch (e) {
            if (e instanceof AppwriteException) setError(e.message);
            else setError('An unexpected error occurred.');
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '12px 16px', marginTop: 4,
        background: '#FFFDF9', border: '1.5px solid #E8D9A8',
        color: '#4A2C0A', fontSize: 14, outline: 'none',
        transition: 'border-color 0.15s', fontFamily: 'inherit',
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#FEF9F0' }}>
            {/* Logo */}
            <div className="mb-10 text-center">
                <h1 className="text-4xl font-black tracking-tight" style={{ color: '#4A2C0A' }}>
                    Y<span style={{ color: '#D4722A' }}>Chess</span>
                </h1>
                <p className="text-sm font-semibold mt-2" style={{ color: '#A07650' }}>
                    AI-powered chess coaching
                </p>
            </div>

            <div className="w-full max-w-sm animate-slide-up">
                {/* Tab toggle */}
                <div className="flex mb-8" style={{ borderBottom: '1.5px solid #E8D9A8' }}>
                    {(['Login', 'Register'] as const).map((tab) => {
                        const active = isLogin ? tab === 'Login' : tab === 'Register';
                        return (
                            <button key={tab} onClick={() => setIsLogin(tab === 'Login')}
                                className="flex-1 pb-3 text-sm font-black uppercase tracking-widest border-b-2 transition-colors"
                                style={{ color: active ? '#D4722A' : '#C8A882', borderColor: active ? '#D4722A' : 'transparent', background: 'none', cursor: 'pointer' }}>
                                {tab}
                            </button>
                        );
                    })}
                </div>

                <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
                    {!isLogin && (
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest" style={{ color: '#A07650' }}>Name</label>
                            <input type="text" required value={name} onChange={e => setName(e.target.value)}
                                placeholder="Your name" style={inputStyle}
                                onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#D4722A'}
                                onBlur={e => (e.target as HTMLInputElement).style.borderColor = '#E8D9A8'} />
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest" style={{ color: '#A07650' }}>Email</label>
                        <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com" style={inputStyle}
                            onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#D4722A'}
                            onBlur={e => (e.target as HTMLInputElement).style.borderColor = '#E8D9A8'} />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest" style={{ color: '#A07650' }}>Password</label>
                        <input type="password" autoComplete="current-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••" style={inputStyle}
                            onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#D4722A'}
                            onBlur={e => (e.target as HTMLInputElement).style.borderColor = '#E8D9A8'} />
                    </div>

                    {error && (
                        <p className="text-xs font-semibold px-3 py-2" style={{ color: '#B91C1C', background: '#FEE2E2', border: '1.5px solid #FCA5A5' }}>
                            {error}
                        </p>
                    )}

                    <button type="submit"
                        className="w-full py-3 mt-2 font-black uppercase tracking-widest text-sm mc-btn mc-btn-accent">
                        {isLogin ? 'Login' : 'Create Account'}
                    </button>
                </form>

                <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px" style={{ background: '#E8D9A8' }} />
                    <span className="text-xs font-black uppercase tracking-widest" style={{ color: '#C8A882' }}>or</span>
                    <div className="flex-1 h-px" style={{ background: '#E8D9A8' }} />
                </div>

                <button onClick={handleGoogleLogin}
                    className="w-full py-3 text-sm font-black uppercase tracking-widest mc-btn mc-btn-ghost">
                    Continue with Google
                </button>
            </div>
        </div>
    );
}
