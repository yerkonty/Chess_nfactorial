'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { account, databases } from '@/lib/appwrite';
import { Query, Models } from 'appwrite';

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_GAMES_COLLECTION_ID!;

type GameRecord = Models.Document & {
    result: string;
    mode: string;
    pgn: string;
};

type Stats = { total: number; wins: number; losses: number; draws: number };

function computeStats(games: GameRecord[]): Stats {
    let wins = 0, losses = 0, draws = 0;
    for (const g of games) {
        if (g.result === 'draw') draws++;
        else if (g.result.includes('wins')) wins++;
        else losses++;
    }
    return { total: games.length, wins, losses, draws };
}

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
    const [games, setGames] = useState<GameRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const currentUser = await account.get();
                setUser(currentUser);
                const res = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
                    Query.equal('userId', currentUser.$id),
                    Query.orderDesc('$createdAt'),
                    Query.limit(50),
                ]);
                setGames(res.documents as unknown as GameRecord[]);
            } catch {
                router.push('/');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [router]);

    const handleLogout = async () => {
        await account.deleteSession('current');
        router.push('/');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black">
                <div className="text-center">
                    <div className="spinner mx-auto mb-3" />
                    <p style={{ color: '#adacac' }} className="text-sm">Loading profile…</p>
                </div>
            </div>
        );
    }

    const stats = computeStats(games);
    const winPct = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;

    const statCards = [
        { label: 'Games', value: stats.total, color: '#ffffff' },
        { label: 'Wins', value: stats.wins, color: '#bcfe00' },
        { label: 'Losses', value: stats.losses, color: '#f87171' },
        { label: 'Draws', value: stats.draws, color: '#facc15' },
    ];

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Nav */}
            <nav className="border-b border-[#282828] px-6 py-4 flex items-center justify-between">
                <button
                    onClick={() => router.push('/')}
                    className="text-sm uppercase tracking-widest transition-colors hover:text-[#bcfe00]"
                    style={{ color: '#adacac' }}
                >
                    ← Back
                </button>
                <span className="text-lg font-bold tracking-tight">
                    Y<span style={{ color: '#bcfe00' }}>Chess</span>
                </span>
                <button
                    onClick={handleLogout}
                    className="text-sm uppercase tracking-widest border border-[#333] px-4 py-2 rounded-sm hover:border-red-500 hover:text-red-400 transition-all"
                >
                    Logout
                </button>
            </nav>

            <div className="max-w-2xl mx-auto px-6 py-10 animate-slide-up">
                {/* User info */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-1">{user?.name || 'Player'}</h1>
                    <p style={{ color: '#adacac' }} className="text-sm">{user?.email}</p>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-3 mb-8">
                    {statCards.map(({ label, value, color }) => (
                        <div
                            key={label}
                            className="rounded-sm p-4 text-center border border-[#282828]"
                            style={{ backgroundColor: '#191919' }}
                        >
                            <p className="text-3xl font-bold mb-1" style={{ color }}>{value}</p>
                            <p className="text-xs uppercase tracking-widest" style={{ color: '#adacac' }}>{label}</p>
                        </div>
                    ))}
                </div>

                {/* Win rate bar */}
                {stats.total > 0 && (
                    <div className="rounded-sm p-4 mb-8 border border-[#282828]" style={{ backgroundColor: '#191919' }}>
                        <div className="flex justify-between text-xs uppercase tracking-widest mb-3">
                            <span style={{ color: '#bcfe00' }}>Wins {winPct}%</span>
                            <span style={{ color: '#adacac' }}>Win Rate</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#282828' }}>
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${winPct}%`, backgroundColor: '#bcfe00' }}
                            />
                        </div>
                    </div>
                )}

                {/* Game history */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-medium uppercase tracking-widest" style={{ color: '#adacac' }}>
                        Game History
                    </h2>
                    <span className="text-xs" style={{ color: '#555' }}>
                        {games.length} game{games.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {games.length === 0 ? (
                    <p style={{ color: '#555' }} className="text-sm text-center py-12 border border-[#282828] rounded-sm">
                        No games played yet. Go play one!
                    </p>
                ) : (
                    <div className="space-y-2">
                        {games.map((game) => {
                            const isDraw = game.result === 'draw';
                            const isWin = game.result.includes('wins');
                            const badgeColor = isDraw ? '#854d0e' : isWin ? '#166534' : '#7f1d1d';
                            const badgeText = isDraw ? 'Draw' : game.result;

                            return (
                                <div
                                    key={game.$id}
                                    className="rounded-sm px-5 py-3 flex items-center justify-between border border-[#282828] hover:border-[#333] transition-colors"
                                    style={{ backgroundColor: '#191919' }}
                                >
                                    <div className="flex items-center gap-4">
                                        <span
                                            className="text-xs font-medium uppercase tracking-wider px-2 py-1 rounded-sm"
                                            style={{ backgroundColor: badgeColor, color: '#fff' }}
                                        >
                                            {badgeText}
                                        </span>
                                        <span className="text-sm capitalize" style={{ color: '#adacac' }}>
                                            {game.mode.replace(/-/g, ' ')}
                                        </span>
                                    </div>
                                    <span className="text-xs" style={{ color: '#555' }}>
                                        {new Date(game.$createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
