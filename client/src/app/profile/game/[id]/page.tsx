'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chess, type Piece, type Square } from 'chess.js';
import { account, databases } from '@/lib/appwrite';
import { Models } from 'appwrite';

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_GAMES_COLLECTION_ID!;

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];
const SQ = 48;

const pieceSymbols: { [key: string]: string } = {
    p: '♙', r: '♖', n: '♘', b: '♗', q: '♕', k: '♔',
    P: '♟', R: '♜', N: '♞', B: '♝', Q: '♛', K: '♚',
};

type GameRecord = Models.Document & {
    userId: string;
    userName: string;
    result: string;
    mode: string;
    pgn: string;
};

export default function GameReplayPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const gameId = params.id;

    const [loading, setLoading] = useState(true);
    const [record, setRecord] = useState<GameRecord | null>(null);
    const [moves, setMoves] = useState<Array<{ from: string; to: string; san: string }>>([]);
    const [viewIndex, setViewIndex] = useState<number | null>(null);
    const [positionFens, setPositionFens] = useState<string[]>([]);
    const [displayBoard, setDisplayBoard] = useState<(Piece | null)[][]>(new Chess().board());
    const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
    const [analysis, setAnalysis] = useState('');
    const [analysisLoading, setAnalysisLoading] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const user = await account.get();
                const res = await databases.getDocument(DATABASE_ID, COLLECTION_ID, gameId);
                const doc = res as unknown as GameRecord;
                if (doc.userId !== user.$id) {
                    router.push('/profile');
                    return;
                }
                const tmp = new Chess();
                tmp.loadPgn(doc.pgn);
                const history = tmp.history({ verbose: true }) as Array<{ from: string; to: string; san: string }>;
                const replay = new Chess();
                const fens: string[] = [];
                for (const m of history) {
                    replay.move(m.san);
                    fens.push(replay.fen());
                }
                setMoves(history);
                setPositionFens(fens);
                setDisplayBoard(tmp.board());
                if (history.length > 0) {
                    const last = history[history.length - 1];
                    setLastMove({ from: last.from as Square, to: last.to as Square });
                }
                setRecord(doc);
            } catch {
                router.push('/profile');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [gameId, router]);

    const statusLabel = useMemo(() => {
        if (!record) return '';
        if (record.result === 'draw') return 'Draw';
        return record.result;
    }, [record]);

    function goToIndex(index: number) {
        if (!record) return;
        const fen = positionFens[index];
        if (!fen) return;
        const tmp = new Chess(fen);
        setDisplayBoard(tmp.board());
        setLastMove({ from: moves[index].from as Square, to: moves[index].to as Square });
        setViewIndex(index);
    }

    function goLive() {
        if (!record) return;
        const lastFen = positionFens[positionFens.length - 1];
        const tmp = lastFen ? new Chess(lastFen) : new Chess();
        setDisplayBoard(tmp.board());
        if (moves.length > 0) {
            const last = moves[moves.length - 1];
            setLastMove({ from: last.from as Square, to: last.to as Square });
        } else {
            setLastMove(null);
        }
        setViewIndex(null);
    }

    async function analyzeGame() {
        if (!record) return;
        setAnalysisLoading(true);
        setAnalysis('');
        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pgn: record.pgn, result: record.result }),
            });
            if (!res.body) return;
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                setAnalysis(prev => prev + decoder.decode(value));
            }
        } catch {
            setAnalysis('Analysis unavailable. Check your API key.');
        } finally {
            setAnalysisLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen" style={{ background: '#FEF9F0' }}>
                <div className="text-center">
                    <div className="spinner mx-auto mb-3" />
                    <p className="text-sm font-semibold" style={{ color: '#A07650' }}>Loading game…</p>
                </div>
            </div>
        );
    }

    if (!record) return null;

    return (
        <div className="min-h-screen" style={{ background: '#FEF9F0', color: '#4A2C0A' }}>
            <nav style={{ background: '#FFFDF9', borderBottom: '1.5px solid #E8D9A8' }}
                className="px-6 py-4 flex items-center justify-between">
                <button
                    onClick={() => router.push('/profile')}
                    className="text-xs font-black uppercase tracking-widest transition-colors hover:underline"
                    style={{ color: '#A07650' }}
                >
                    ← Back
                </button>
                <span className="text-lg font-black tracking-tight" style={{ color: '#4A2C0A' }}>
                    Y<span style={{ color: '#D4722A' }}>Chess</span>
                </span>
                <div style={{ width: 60 }} />
            </nav>

            <div className="max-w-5xl mx-auto px-6 py-10 grid gap-6" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
                <div className="space-y-4">
                    <div style={{ background: '#FFFDF9', border: '1.5px solid #E8D9A8', boxShadow: '2px 2px 0 #C8A882', padding: 16 }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#A07650' }}>Result</p>
                                <p className="text-lg font-black" style={{ color: '#4A2C0A' }}>{statusLabel}</p>
                                <p className="text-xs font-semibold" style={{ color: '#A07650' }}>{record.mode.replace(/-/g, ' ')}</p>
                            </div>
                            <button
                                onClick={analyzeGame}
                                disabled={analysisLoading}
                                className="px-4 py-2 text-xs font-black uppercase tracking-widest"
                                style={{ background: '#D4722A', color: '#FFFDF9', border: '1.5px solid #B85E1A', boxShadow: '2px 2px 0 #B85E1A', cursor: 'pointer', opacity: analysisLoading ? 0.6 : 1 }}
                            >
                                {analysisLoading ? 'Analyzing…' : 'Analyze Game'}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'inline-flex', flexDirection: 'column' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(8, ${SQ}px)` }}>
                            {displayBoard.map((row, rowIdx) =>
                                row.map((piece, colIdx) => {
                                    const square = (FILES[colIdx] + RANKS[rowIdx]) as Square;
                                    const isLight = (rowIdx + colIdx) % 2 === 0;
                                    const isLast = lastMove && (square === lastMove.from || square === lastMove.to);
                                    const bg = isLight ? '#eeeed2' : '#769656';
                                    return (
                                        <div key={`${rowIdx}-${colIdx}`} style={{ width: SQ, height: SQ, backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', fontSize: 30 }}>
                                            {isLast && (
                                                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(212,114,42,0.28)' }} />
                                            )}
                                            {piece && (
                                                <span style={{ position: 'relative', zIndex: 1 }}>
                                                    {pieceSymbols[piece.color === 'b' ? piece.type : piece.type.toUpperCase()]}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                            <button
                                onClick={() => {
                                    if (!moves.length) return;
                                    setViewIndex(prev => {
                                        const next = prev === null ? moves.length - 2 : Math.max(0, prev - 1);
                                        if (next < 0) { goLive(); return null; }
                                        goToIndex(next); return next;
                                    });
                                }}
                                className="px-3 py-1 text-xs font-black uppercase tracking-widest"
                                style={{ background: '#FFFDF9', border: '1.5px solid #E8D9A8', color: '#A07650', boxShadow: '2px 2px 0 #C8A882' }}
                            >
                                ◀ Prev
                            </button>
                            <button
                                onClick={goLive}
                                className="px-3 py-1 text-xs font-black uppercase tracking-widest"
                                style={{ background: '#FFF4E6', border: '1.5px solid #D4722A', color: '#D4722A', boxShadow: '2px 2px 0 #C8A882' }}
                            >
                                Live
                            </button>
                            <button
                                onClick={() => {
                                    if (!moves.length) return;
                                    setViewIndex(prev => {
                                        if (prev === null) return null;
                                        if (prev >= moves.length - 1) { goLive(); return null; }
                                        const next = prev + 1;
                                        goToIndex(next); return next;
                                    });
                                }}
                                className="px-3 py-1 text-xs font-black uppercase tracking-widest"
                                style={{ background: '#FFFDF9', border: '1.5px solid #E8D9A8', color: '#A07650', boxShadow: '2px 2px 0 #C8A882' }}
                            >
                                Next ▶
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div style={{ background: '#FFFDF9', border: '1.5px solid #E8D9A8', boxShadow: '2px 2px 0 #C8A882', padding: 16 }}>
                        <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#A07650' }}>Moves</p>
                        <div className="mt-3 max-h-96 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
                            <div className="flex flex-wrap gap-2">
                                {moves.map((m, i) => {
                                    const isActive = viewIndex === i;
                                    const isLive = viewIndex === null && i === moves.length - 1;
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => goToIndex(i)}
                                            className="px-2 py-1 text-xs font-bold"
                                            style={{ background: isActive || isLive ? '#D4722A' : '#FFF4E6', color: isActive || isLive ? '#FFFDF9' : '#A07650', border: '1px solid #E8D9A8', cursor: 'pointer' }}
                                        >
                                            {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ''} {m.san}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {(analysis || analysisLoading) && (
                        <div style={{ background: '#FFF4E6', border: '1.5px solid #D4722A', boxShadow: '2px 2px 0 #C8A882', padding: 16 }}>
                            <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#D4722A' }}>AI Analysis</p>
                            <div className="text-sm whitespace-pre-wrap mt-2" style={{ color: '#4A2C0A' }}>
                                {analysisLoading && !analysis ? 'Analyzing…' : analysis}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
