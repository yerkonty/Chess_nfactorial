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
            <div className="flex items-center justify-center min-h-screen" style={{ background: '#FEF9F0' }}>
                <div className="text-center">
                    <div className="spinner mx-auto mb-3" />
                    <p className="text-sm font-semibold" style={{ color: '#A07650' }}>Loading profile…</p>
                </div>
            </div>
        );
    }

    const stats = computeStats(games);
    const winPct = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;

    const statCards = [
        { label: 'Games',  value: stats.total,  color: '#4A2C0A' },
        { label: 'Wins',   value: stats.wins,   color: '#D4722A' },
        { label: 'Losses', value: stats.losses, color: '#B91C1C' },
        { label: 'Draws',  value: stats.draws,  color: '#92400E' },
    ];

    return (
        <div className="min-h-screen" style={{ background: '#FEF9F0', color: '#4A2C0A' }}>

            {/* Nav */}
            <nav style={{ background: '#FFFDF9', borderBottom: '1.5px solid #E8D9A8' }}
                className="px-6 py-4 flex items-center justify-between">
                <button
                    onClick={() => router.push('/')}
                    className="text-xs font-black uppercase tracking-widest transition-colors hover:underline"
                    style={{ color: '#A07650' }}
                >
                    ← Back
                </button>
                <span className="text-lg font-black tracking-tight" style={{ color: '#4A2C0A' }}>
                    Y<span style={{ color: '#D4722A' }}>Chess</span>
                </span>
                <button
                    onClick={handleLogout}
                    className="text-xs font-black uppercase tracking-widest px-4 py-2 mc-btn mc-btn-ghost"
                >
                    Logout
                </button>
            </nav>

            <div className="max-w-2xl mx-auto px-6 py-10 animate-slide-up">

                {/* User info */}
                <div className="flex items-center gap-4 mb-8">
                    {/* Avatar */}
                    <div style={{
                        width: 64, height: 64,
                        background: '#D4722A',
                        border: '1.5px solid #B85E1A',
                        boxShadow: '3px 3px 0 #C8A882',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 26, fontWeight: 900, color: '#FFFDF9',
                        flexShrink: 0,
                    }}>
                        {(user?.name || 'P')[0].toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-3xl font-black mb-0.5" style={{ color: '#4A2C0A' }}>
                            {user?.name || 'Player'}
                        </h1>
                        <p className="text-sm font-semibold" style={{ color: '#A07650' }}>{user?.email}</p>
                    </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-3 mb-6">
                    {statCards.map(({ label, value, color }) => (
                        <div key={label} style={{
                            background: '#FFFDF9',
                            border: '1.5px solid #E8D9A8',
                            boxShadow: '2px 2px 0 #C8A882',
                            padding: '16px 12px',
                            textAlign: 'center',
                        }}>
                            <p className="text-3xl font-black mb-1" style={{ color }}>{value}</p>
                            <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#A07650' }}>{label}</p>
                        </div>
                    ))}
                </div>

                {/* Win rate */}
                {stats.total > 0 && (
                    <div style={{
                        background: '#FFFDF9',
                        border: '1.5px solid #E8D9A8',
                        boxShadow: '2px 2px 0 #C8A882',
                        padding: '14px 16px',
                        marginBottom: 24,
                    }}>
                        <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-3">
                            <span style={{ color: '#D4722A' }}>Wins {winPct}%</span>
                            <span style={{ color: '#A07650' }}>Win Rate</span>
                        </div>
                        <div style={{ height: 10, background: '#F7EDDA', border: '1px solid #E8D9A8' }}>
                            <div
                                className="h-full transition-all duration-700"
                                style={{ width: `${winPct}%`, background: '#D4722A' }}
                            />
                        </div>
                    </div>
                )}

                {/* Game history */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: '#A07650' }}>
                        Game History
                    </h2>
                    <span className="text-xs font-semibold" style={{ color: '#C8A882' }}>
                        {games.length} game{games.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {games.length === 0 ? (
                    <p className="text-sm font-semibold text-center py-12"
                        style={{ color: '#A07650', border: '1.5px solid #E8D9A8', background: '#FFFDF9' }}>
                        No games played yet. Go play one!
                    </p>
                ) : (
                    <div className="space-y-2">
                        {games.map((game) => {
                            const isDraw   = game.result === 'draw';
                            const isWin    = game.result.includes('wins');
                            const badgeBg  = isDraw ? '#F7EDDA' : isWin ? '#D4722A' : '#FEE2E2';
                            const badgeTxt = isDraw ? '#7A4F2D' : isWin ? '#FFFDF9' : '#B91C1C';
                            const badgeBdr = isDraw ? '#C8A882' : isWin ? '#B85E1A' : '#FCA5A5';
                            const badgeText = isDraw ? 'Draw' : game.result;

                            return (
                                <div
                                    key={game.$id}
                                    className="px-4 py-3 flex items-center justify-between transition-all"
                                    style={{
                                        background: '#FFFDF9',
                                        border: '1.5px solid #E8D9A8',
                                        boxShadow: '2px 2px 0 #C8A882',
                                        cursor: 'pointer',
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLDivElement).style.transform = 'translate(-1px,-1px)';
                                        (e.currentTarget as HTMLDivElement).style.boxShadow = '3px 3px 0 #C8A882';
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLDivElement).style.transform = '';
                                        (e.currentTarget as HTMLDivElement).style.boxShadow = '2px 2px 0 #C8A882';
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-black uppercase tracking-wider px-2 py-1"
                                            style={{ background: badgeBg, color: badgeTxt, border: `1.5px solid ${badgeBdr}` }}>
                                            {badgeText}
                                        </span>
                                        <span className="text-sm font-semibold capitalize" style={{ color: '#7A4F2D' }}>
                                            {game.mode.replace(/-/g, ' ')}
                                        </span>
                                    </div>
                                    <span className="text-xs font-semibold" style={{ color: '#C8A882' }}>
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
