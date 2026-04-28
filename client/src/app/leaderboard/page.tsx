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
                // keep city baseline
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const MEDALS = ['🥇', '🥈', '🥉'];

    return (
        <div className="min-h-screen" style={{ background: '#FEF9F0', color: '#4A2C0A' }}>

            {/* Nav */}
            <nav style={{ background: '#FFFDF9', borderBottom: '1.5px solid #E8D9A8' }}
                className="px-6 py-4 flex items-center justify-between">
                <button
                    onClick={() => router.push('/')}
                    className="text-xs font-black uppercase tracking-widest hover:underline transition-colors"
                    style={{ color: '#A07650' }}
                >
                    ← Back
                </button>
                <span className="text-lg font-black tracking-tight" style={{ color: '#4A2C0A' }}>
                    Y<span style={{ color: '#D4722A' }}>Chess</span>
                </span>
                <div style={{ width: 60 }} />
            </nav>

            <div className="max-w-2xl mx-auto px-6 py-10 animate-slide-up">

                {/* Header */}
                <div className="flex items-end justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black mb-1" style={{ color: '#4A2C0A' }}>Leaderboard</h1>
                        <p className="text-sm font-semibold" style={{ color: '#A07650' }}>Top players ranked by wins</p>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: '#C8A882' }}>
                        {loading && <span className="spinner" style={{ width: 12, height: 12 }} />}
                        {players.length} players
                    </span>
                </div>

                {/* Column headers */}
                <div className="flex items-center px-4 mb-2 text-xs font-black uppercase tracking-widest" style={{ color: '#C8A882' }}>
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
                                className="px-4 py-3 transition-colors"
                                style={{
                                    background: isMe ? '#FFF4E6' : '#FFFDF9',
                                    border: `1.5px solid ${isMe ? '#D4722A' : '#E8D9A8'}`,
                                    boxShadow: i === 0 ? '3px 3px 0 #C8A882' : '2px 2px 0 #C8A882',
                                }}
                            >
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="w-8 text-center flex-shrink-0">
                                        {i < 3 ? (
                                            <span style={{ fontSize: 18 }}>{MEDALS[i]}</span>
                                        ) : (
                                            <span className="text-sm font-black" style={{ color: '#C8A882' }}>#{i + 1}</span>
                                        )}
                                    </div>

                                    <span className="flex-1 font-bold text-sm truncate" style={{ color: '#4A2C0A' }}>
                                        {p.userName}
                                        {isMe && (
                                            <span className="ml-2 text-xs font-black" style={{ color: '#D4722A' }}>you</span>
                                        )}
                                        {p.isCity && !isMe && (
                                            <span className="ml-2 text-xs" style={{ color: '#C8A882' }}>🇰🇿</span>
                                        )}
                                    </span>

                                    <span className="w-8 text-center text-sm font-black" style={{ color: '#D4722A' }}>{p.wins}</span>
                                    <span className="w-8 text-center text-sm font-bold" style={{ color: '#B91C1C' }}>{p.losses}</span>
                                    <span className="w-8 text-center text-sm font-bold" style={{ color: '#92400E' }}>{p.draws}</span>
                                    <span className="w-16 text-right text-sm font-bold" style={{ color: '#A07650' }}>{winPct}%</span>
                                </div>

                                <div className="ml-12 h-1.5 overflow-hidden" style={{ background: '#F7EDDA', border: '1px solid #E8D9A8' }}>
                                    <div
                                        className="h-full transition-all duration-700"
                                        style={{
                                            width: `${winPct}%`,
                                            background: isMe ? '#D4722A' : p.isCity ? '#C8A882' : '#E8903F',
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
