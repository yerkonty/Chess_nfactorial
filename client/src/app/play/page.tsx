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
                player2Id: null,
                player2Name: null,
                turn: 'w',
                lastMove: null,
                whiteTime: timer,
                blackTime: timer,
                lastMoveAt: null,
                timerDuration: timer,
                result: null,
            });
            router.push(`/play/${doc.$id}`);
        } catch (e) {
            setError(`Failed to create game: ${e}`);
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-sm animate-slide-up">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold mb-1">
                        Y<span style={{ color: '#bcfe00' }}>Chess</span>
                    </h1>
                    <p className="text-sm" style={{ color: '#adacac' }}>Multiplayer — play with a friend</p>
                </div>

                <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#555' }}>
                    Time control
                </p>
                <div className="grid grid-cols-4 gap-2 mb-8">
                    {TIMER_OPTIONS.map(({ label, seconds }) => (
                        <button
                            key={seconds}
                            onClick={() => setTimer(seconds)}
                            className="py-3 text-sm rounded-sm transition-all font-medium"
                            style={timer === seconds
                                ? { backgroundColor: '#bcfe00', color: '#000', fontWeight: 700 }
                                : { backgroundColor: '#191919', color: '#adacac', border: '1px solid #282828' }
                            }
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {error && (
                    <p className="text-red-400 text-xs mb-4 bg-red-400/10 border border-red-400/20 rounded-sm px-3 py-2">
                        {error}
                    </p>
                )}

                <button
                    onClick={createGame}
                    disabled={loading}
                    className="w-full py-3 font-bold uppercase tracking-widest text-black text-sm rounded-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                    style={{ backgroundColor: '#bcfe00' }}
                >
                    {loading ? 'Creating…' : 'Create Game'}
                </button>

                <button
                    onClick={() => router.push('/')}
                    className="w-full mt-4 py-2 text-xs uppercase tracking-widest transition-colors hover:text-white"
                    style={{ color: '#555' }}
                >
                    ← Back to Board
                </button>
            </div>
        </div>
    );
}
