'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { account, databases } from '@/lib/appwrite';
import { ID } from 'appwrite';
import { Chess } from 'chess.js';

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const ROOMS = 'rooms';

const TIMER_OPTIONS = [
    { label: '1 min',  seconds: 60  },
    { label: '3 min',  seconds: 180 },
    { label: '5 min',  seconds: 300 },
    { label: '10 min', seconds: 600 },
];

export default function PlayPage() {
    const router = useRouter();
    const [timer, setTimer] = useState(300);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function createGame() {
        setLoading(true);
        setError('');
        try {
            const user = await account.get();
            const doc = await databases.createDocument(DATABASE_ID, ROOMS, ID.unique(), {
                fen: new Chess().fen(),
                status: 'waiting',
                player1Id: user.$id,
                player1Name: user.name || 'Player 1',
                turn: 'w',
                whiteTime: timer,
                blackTime: timer,
                timerDuration: timer,
            });
            router.push(`/play/${doc.$id}`);
        } catch (e) {
            setError(`Failed to create game: ${e}`);
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4"
            style={{ background: '#FEF9F0', color: '#4A2C0A' }}>
            <div className="w-full max-w-sm animate-slide-up">

                {/* Card */}
                <div style={{
                    background: '#FFFDF9',
                    border: '1.5px solid #C8A882',
                    boxShadow: '6px 6px 0 #C8A882',
                    padding: '40px 40px 36px',
                    textAlign: 'center',
                }}>
                    {/* Logo */}
                    <h1 className="text-2xl font-black mb-1 tracking-tight" style={{ color: '#4A2C0A' }}>
                        Y<span style={{ color: '#D4722A' }}>Chess</span>
                    </h1>
                    <p className="text-sm font-semibold mb-8" style={{ color: '#A07650' }}>
                        Multiplayer — play with a friend
                    </p>

                    {/* Time control label */}
                    <p className="text-xs font-black uppercase tracking-widest mb-3 text-left" style={{ color: '#A07650' }}>
                        Time Control
                    </p>

                    {/* Timer options */}
                    <div className="grid grid-cols-4 gap-2 mb-8">
                        {TIMER_OPTIONS.map(({ label, seconds }) => (
                            <button
                                key={seconds}
                                onClick={() => setTimer(seconds)}
                                className="py-3 text-sm font-bold mc-btn mc-btn-sm"
                                style={timer === seconds
                                    ? { backgroundColor: '#D4722A', color: '#FFFDF9', borderColor: '#B85E1A', boxShadow: '1px 1px 0 #B85E1A', transform: 'translate(2px,2px)' }
                                    : { backgroundColor: '#FFFDF9', color: '#4A2C0A', borderColor: '#C8A882', boxShadow: '2px 2px 0 #C8A882' }
                                }
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {error && (
                        <p className="text-red-600 text-xs mb-4 px-3 py-2 font-semibold"
                            style={{ background: '#FEE2E2', border: '1.5px solid #FCA5A5' }}>
                            {error}
                        </p>
                    )}

                    <button
                        onClick={createGame}
                        disabled={loading}
                        className="w-full py-3 font-black uppercase tracking-widest text-sm mc-btn mc-btn-accent disabled:opacity-50"
                    >
                        {loading ? 'Creating…' : 'Create Game'}
                    </button>

                    <button
                        onClick={() => router.push('/')}
                        className="w-full mt-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors hover:underline"
                        style={{ color: '#A07650' }}
                    >
                        ← Back to Board
                    </button>
                </div>

            </div>
        </div>
    );
}
