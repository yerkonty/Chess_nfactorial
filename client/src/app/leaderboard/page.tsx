'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { account, databases } from '@/lib/appwrite';
import { Query, Models } from 'appwrite';

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_GAMES_COLLECTION_ID!;

type GameDoc = Models.Document & {
    userId: string;
    userName?: string;
    result: string;
};

type PlayerStats = {
    userId: string;
    userName: string;
    wins: number;
    losses: number;
    draws: number;
    total: number;
    isCity?: boolean;
};

// Kazakhstan city baseline — always shown
const CITY_PLAYERS: PlayerStats[] = [
    { userId: 'city-almaty',      userName: 'Алматы',      wins: 12, losses: 4,  draws: 2, total: 18, isCity: true },
    { userId: 'city-astana',      userName: 'Астана',       wins: 10, losses: 5,  draws: 3, total: 18, isCity: true },
    { userId: 'city-shymkent',    userName: 'Шымкент',      wins: 9,  losses: 3,  draws: 1, total: 13, isCity: true },
    { userId: 'city-karaganda',   userName: 'Қарағанды',    wins: 8,  losses: 6,  draws: 2, total: 16, isCity: true },
    { userId: 'city-aktobe',      userName: 'Ақтобе',       wins: 7,  losses: 4,  draws: 2, total: 13, isCity: true },
    { userId: 'city-taraz',       userName: 'Тараз',        wins: 6,  losses: 5,  draws: 3, total: 14, isCity: true },
    { userId: 'city-pavlodar',    userName: 'Павлодар',     wins: 6,  losses: 3,  draws: 1, total: 10, isCity: true },
    { userId: 'city-oskemen',     userName: 'Өскемен',      wins: 5,  losses: 4,  draws: 2, total: 11, isCity: true },
    { userId: 'city-semey',       userName: 'Семей',        wins: 5,  losses: 2,  draws: 1, total: 8,  isCity: true },
    { userId: 'city-atyrau',      userName: 'Атырау',       wins: 4,  losses: 5,  draws: 2, total: 11, isCity: true },
    { userId: 'city-kostanay',    userName: 'Қостанай',     wins: 4,  losses: 3,  draws: 1, total: 8,  isCity: true },
    { userId: 'city-petropavl',   userName: 'Петропавл',    wins: 3,  losses: 4,  draws: 2, total: 9,  isCity: true },
    { userId: 'city-oral',        userName: 'Орал',         wins: 3,  losses: 3,  draws: 1, total: 7,  isCity: true },
    { userId: 'city-temirtau',    userName: 'Теміртау',     wins: 3,  losses: 5,  draws: 1, total: 9,  isCity: true },
    { userId: 'city-turkistan',   userName: 'Түркістан',    wins: 2,  losses: 3,  draws: 1, total: 6,  isCity: true },
    { userId: 'city-kyzylorda',   userName: 'Қызылорда',    wins: 2,  losses: 4,  draws: 2, total: 8,  isCity: true },
    { userId: 'city-aktau',       userName: 'Ақтау',        wins: 2,  losses: 2,  draws: 1, total: 5,  isCity: true },
    { userId: 'city-kokshetau',   userName: 'Көкшетау',     wins: 1,  losses: 3,  draws: 1, total: 5,  isCity: true },
    { userId: 'city-taldykorgan', userName: 'Талдықорған',  wins: 1,  losses: 4,  draws: 1, total: 6,  isCity: true },
    { userId: 'city-zhezkazgan',  userName: 'Жезқазған',    wins: 1,  losses: 2,  draws: 0, total: 3,  isCity: true },
];

function buildFromDocs(docs: GameDoc[]): PlayerStats[] {
    const map = new Map<string, PlayerStats>();
    for (const doc of docs) {
        if (!map.has(doc.userId)) {
            map.set(doc.userId, {
                userId: doc.userId,
                userName: doc.userName || 'Player',
                wins: 0, losses: 0, draws: 0, total: 0,
            });
        }
        const s = map.get(doc.userId)!;
        s.total++;
        if (doc.result === 'draw') s.draws++;
        else if (doc.result.includes('wins')) s.wins++;
        else s.losses++;
    }
    return Array.from(map.values());
}

function mergeAndSort(real: PlayerStats[]): PlayerStats[] {
    // Real players override city entries with same userId (won't happen, but safe)
    const map = new Map<string, PlayerStats>();
    for (const c of CITY_PLAYERS) map.set(c.userId, c);
    for (const r of real) map.set(r.userId, r);
    return Array.from(map.values())
        .sort((a, b) => b.wins - a.wins || b.total - a.total);
}

export default function LeaderboardPage() {
    const router = useRouter();
    const [players, setPlayers] = useState<PlayerStats[]>(CITY_PLAYERS.slice().sort((a, b) => b.wins - a.wins));
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const user = await account.get();
                setCurrentUserId(user.$id);
                const res = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
                    Query.limit(500),
                    Query.orderDesc('$createdAt'),
                ]);
                const real = buildFromDocs(res.documents as unknown as GameDoc[]);
                setPlayers(mergeAndSort(real));
            } catch {
                // Keep city baseline if fetch fails
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const MEDALS = ['🥇', '🥈', '🥉'];

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
                <div style={{ width: 60 }} />
            </nav>

            <div className="max-w-2xl mx-auto px-6 py-10 animate-slide-up">
                {/* Header */}
                <div className="flex items-end justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-1">Leaderboard</h1>
                        <p className="text-sm" style={{ color: '#adacac' }}>Top players ranked by wins</p>
                    </div>
                    <span className="text-xs uppercase tracking-widest flex items-center gap-2" style={{ color: '#555' }}>
                        {loading && <span className="spinner" style={{ width: 12, height: 12 }} />}
                        {players.length} players
                    </span>
                </div>

                {/* Column headers */}
                <div className="flex items-center px-5 mb-2 text-xs uppercase tracking-widest" style={{ color: '#555' }}>
                    <div className="w-8" />
                    <div className="flex-1 ml-4">Player</div>
                    <div className="w-8 text-center">W</div>
                    <div className="w-8 text-center">L</div>
                    <div className="w-8 text-center">D</div>
                    <div className="w-16 text-right">Win%</div>
                </div>

                <div className="space-y-2">
                    {players.slice(0, 25).map((p, i) => {
                        const isMe = p.userId === currentUserId;
                        const winPct = p.total > 0 ? Math.round((p.wins / p.total) * 100) : 0;

                        return (
                            <div
                                key={p.userId}
                                className="rounded-sm px-5 py-4 border transition-colors"
                                style={{
                                    backgroundColor: isMe ? '#0d1a00' : '#191919',
                                    borderColor: isMe ? '#bcfe00' : '#282828',
                                }}
                            >
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="w-8 text-center flex-shrink-0">
                                        {i < 3 ? (
                                            <span style={{ fontSize: 18 }}>{MEDALS[i]}</span>
                                        ) : (
                                            <span className="text-sm font-bold" style={{ color: '#555' }}>#{i + 1}</span>
                                        )}
                                    </div>

                                    <span className="flex-1 font-medium text-sm truncate">
                                        {p.userName}
                                        {isMe && (
                                            <span className="ml-2 text-xs font-normal" style={{ color: '#bcfe00' }}>you</span>
                                        )}
                                        {p.isCity && !isMe && (
                                            <span className="ml-2 text-xs font-normal" style={{ color: '#555' }}>🇰🇿</span>
                                        )}
                                    </span>

                                    <span className="w-8 text-center text-sm font-bold" style={{ color: '#bcfe00' }}>{p.wins}</span>
                                    <span className="w-8 text-center text-sm" style={{ color: '#f87171' }}>{p.losses}</span>
                                    <span className="w-8 text-center text-sm" style={{ color: '#facc15' }}>{p.draws}</span>
                                    <span className="w-16 text-right text-sm font-bold" style={{ color: '#adacac' }}>{winPct}%</span>
                                </div>

                                <div className="ml-12 h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#282828' }}>
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{
                                            width: `${winPct}%`,
                                            backgroundColor: isMe ? '#bcfe00' : p.isCity ? '#4a5568' : '#4a7832',
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
