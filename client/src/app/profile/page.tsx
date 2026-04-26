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
            <div className="flex items-center justify-center min-h-screen bg-gray-800">
                <p className="text-white">Loading...</p>
            </div>
        );
    }

    const stats = computeStats(games);

    return (
        <div className="min-h-screen bg-gray-800 text-white p-8">
            <div className="max-w-2xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={() => router.push('/')}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded font-bold"
                    >
                        ← Back to Game
                    </button>
                    <button
                        onClick={handleLogout}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-bold"
                    >
                        Logout
                    </button>
                </div>

                {/* User info */}
                <div className="bg-gray-700 rounded-lg p-6 mb-6">
                    <h1 className="text-3xl font-bold mb-1">{user?.name || 'Player'}</h1>
                    <p className="text-gray-400">{user?.email}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Games', value: stats.total, color: 'text-white' },
                        { label: 'Wins', value: stats.wins, color: 'text-green-400' },
                        { label: 'Losses', value: stats.losses, color: 'text-red-400' },
                        { label: 'Draws', value: stats.draws, color: 'text-yellow-400' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="bg-gray-700 rounded-lg p-4 text-center">
                            <p className={`text-3xl font-bold ${color}`}>{value}</p>
                            <p className="text-gray-400 text-sm mt-1">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Win rate bar */}
                {stats.total > 0 && (
                    <div className="bg-gray-700 rounded-lg p-4 mb-8">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-green-400">Wins {Math.round((stats.wins / stats.total) * 100)}%</span>
                            <span className="text-gray-400">Win Rate</span>
                        </div>
                        <div className="h-3 bg-gray-600 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `${(stats.wins / stats.total) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Game history */}
                <h2 className="text-xl font-bold mb-4">Game History</h2>
                {games.length === 0 ? (
                    <p className="text-gray-400">No games played yet.</p>
                ) : (
                    <div className="space-y-2">
                        {games.map((game) => (
                            <div
                                key={game.$id}
                                className="bg-gray-700 rounded-lg px-5 py-3 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <span className={`font-bold text-sm px-2 py-1 rounded ${
                                        game.result === 'draw'
                                            ? 'bg-yellow-600'
                                            : game.result.includes('wins')
                                            ? 'bg-green-700'
                                            : 'bg-red-700'
                                    }`}>
                                        {game.result === 'draw' ? 'Draw' : game.result}
                                    </span>
                                    <span className="text-gray-400 text-sm capitalize">
                                        {game.mode.replace(/-/g, ' ')}
                                    </span>
                                </div>
                                <span className="text-gray-500 text-xs">
                                    {new Date(game.$createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
