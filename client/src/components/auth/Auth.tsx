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

    const inputClass =
        'w-full px-4 py-3 mt-1 bg-[#191919] border border-[#333] text-white rounded-sm focus:outline-none focus:border-[#bcfe00] transition-colors placeholder-[#555] text-sm';

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
            {/* Logo */}
            <div className="mb-10 text-center">
                <h1 className="text-4xl font-bold tracking-tight">
                    Y<span style={{ color: '#bcfe00' }}>Chess</span>
                </h1>
                <p className="text-sm mt-2" style={{ color: '#adacac' }}>
                    AI-powered chess coaching
                </p>
            </div>

            <div className="w-full max-w-sm animate-slide-up">
                {/* Tab toggle */}
                <div className="flex mb-8 border-b border-[#282828]">
                    {(['Login', 'Register'] as const).map((tab) => {
                        const active = isLogin ? tab === 'Login' : tab === 'Register';
                        return (
                            <button
                                key={tab}
                                onClick={() => setIsLogin(tab === 'Login')}
                                style={active ? { color: '#bcfe00', borderBottomColor: '#bcfe00' } : {}}
                                className={`flex-1 pb-3 text-sm uppercase tracking-widest transition-colors border-b-2 ${
                                    active ? 'font-medium border-[#bcfe00]' : 'text-[#adacac] border-transparent hover:text-white'
                                }`}
                            >
                                {tab}
                            </button>
                        );
                    })}
                </div>

                <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
                    {!isLogin && (
                        <div>
                            <label className="block text-xs uppercase tracking-widest text-[#adacac]">
                                Name
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name"
                                className={inputClass}
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-xs uppercase tracking-widest text-[#adacac]">
                            Email
                        </label>
                        <input
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className="block text-xs uppercase tracking-widest text-[#adacac]">
                            Password
                        </label>
                        <input
                            type="password"
                            autoComplete="current-password"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className={inputClass}
                        />
                    </div>

                    {error && (
                        <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-sm px-3 py-2">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        className="w-full py-3 mt-2 font-bold uppercase tracking-widest text-black text-sm rounded-sm transition-all hover:brightness-110 active:scale-[0.98]"
                        style={{ backgroundColor: '#bcfe00' }}
                    >
                        {isLogin ? 'Login' : 'Create Account'}
                    </button>
                </form>

                <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-[#282828]" />
                    <span className="text-xs uppercase tracking-widest text-[#555]">or</span>
                    <div className="flex-1 h-px bg-[#282828]" />
                </div>

                <button
                    onClick={handleGoogleLogin}
                    className="w-full py-3 border border-[#333] text-white text-sm uppercase tracking-widest rounded-sm hover:border-[#bcfe00] hover:text-[#bcfe00] transition-all active:scale-[0.98]"
                >
                    Continue with Google
                </button>
            </div>
        </div>
    );
}
