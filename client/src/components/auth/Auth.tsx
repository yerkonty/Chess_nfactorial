'use client'
import { useState } from 'react';
import { account } from '@/lib/appwrite';
import { AppwriteException } from 'appwrite';

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
            window.location.reload(); // Reload to reflect session change
        } catch (e) {
            if (e instanceof AppwriteException) {
                setError(e.message);
            } else {
                setError('An unexpected error occurred.');
            }
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            await account.create('unique()', email, password, name);
            // After registration, log the user in
            await handleLogin(e);
        } catch (e) {
            if (e instanceof AppwriteException) {
                setError(e.message);
            } else {
                setError('An unexpected error occurred.');
            }
        }
    };

    const handleGoogleLogin = () => {
        try {
            account.createOAuth2Session('google', `${window.location.origin}/`, `${window.location.origin}/?error=true`);
        } catch (e) {
            if (e instanceof AppwriteException) {
                setError(e.message);
            } else {
                setError('An unexpected error occurred.');
            }
        }
    };

    return (
        <div className="w-full max-w-md p-8 space-y-6 bg-gray-700 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold text-center text-white">
                {isLogin ? 'Login to ChessMind' : 'Create an Account'}
            </h1>
            <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-6">
                {!isLogin && (
                    <div>
                        <label
                            htmlFor="name"
                            className="block text-sm font-medium text-gray-300"
                        >
                            Name
                        </label>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                )}
                <div>
                    <label
                        htmlFor="email"
                        className="block text-sm font-medium text-gray-300"
                    >
                        Email address
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label
                        htmlFor="password"
                        className="block text-sm font-medium text-gray-300"
                    >
                        Password
                    </label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div>
                    <button
                        type="submit"
                        className="w-full px-4 py-2 font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        {isLogin ? 'Login' : 'Register'}
                    </button>
                </div>
            </form>
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-500" />
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 text-gray-400 bg-gray-700">Or</span>
                </div>
            </div>
            <div>
                <button
                    onClick={handleGoogleLogin}
                    className="w-full px-4 py-2 font-bold text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                    Sign in with Google
                </button>
            </div>
            <p className="text-sm text-center text-gray-400">
                {isLogin ? "Don't have an account?" : 'Already have an account?'}
                <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="ml-1 font-medium text-blue-400 hover:underline"
                >
                    {isLogin ? 'Register' : 'Login'}
                </button>
            </p>
        </div>
    );
}

