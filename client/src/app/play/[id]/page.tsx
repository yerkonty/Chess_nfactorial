'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chess, type Square, type Piece } from 'chess.js';
import { account, databases } from '@/lib/appwrite';
import appwriteClient from '@/lib/appwrite';

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const ROOMS = 'rooms';
const SQ = 56;
const FILES_W = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS_W = [8, 7, 6, 5, 4, 3, 2, 1];

const SYMBOLS: Record<string, string> = {
    p: '♙', r: '♖', n: '♘', b: '♗', q: '♕', k: '♔',
    P: '♟', R: '♜', N: '♞', B: '♝', Q: '♛', K: '♚',
};

type RoomDoc = {
    $id: string;
    fen: string;
    status: 'waiting' | 'active' | 'finished';
    player1Id: string;
    player1Name: string;
    player2Id: string | null;
    player2Name: string | null;
    turn: string;
    lastMove: string | null;
    whiteTime: number;
    blackTime: number;
    lastMoveAt: string | null;
    timerDuration: number;
    result: string | null;
};

function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function PlayRoom() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [room, setRoom] = useState<RoomDoc | null>(null);
    const [myId, setMyId] = useState('');
    const [myColor, setMyColor] = useState<'w' | 'b' | null>(null);
    const [selected, setSelected] = useState<Square | null>(null);
    const [hints, setHints] = useState<string[]>([]);
    const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
    const [whiteDisplay, setWhiteDisplay] = useState(300);
    const [blackDisplay, setBlackDisplay] = useState(300);
    const [copied, setCopied] = useState(false);
    const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const gameRef = useRef(new Chess());
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const storedWt = useRef(300);
    const storedBt = useRef(300);
    const lastMoveAtRef = useRef<number | null>(null);
    const turnRef = useRef<string>('w');
    const myIdRef = useRef('');
    const myColorRef = useRef<'w' | 'b' | null>(null);

    // ── Sync timer from room ──────────────────────────────────────────────────
    function syncTimer(r: RoomDoc) {
        storedWt.current = r.whiteTime;
        storedBt.current = r.blackTime;
        lastMoveAtRef.current = r.lastMoveAt ? new Date(r.lastMoveAt).getTime() : null;
        turnRef.current = r.turn;

        const elapsed = lastMoveAtRef.current
            ? Math.floor((Date.now() - lastMoveAtRef.current) / 1000)
            : 0;

        setWhiteDisplay(r.turn === 'w' ? Math.max(0, r.whiteTime - elapsed) : r.whiteTime);
        setBlackDisplay(r.turn === 'b' ? Math.max(0, r.blackTime - elapsed) : r.blackTime);

        if (timerRef.current) clearInterval(timerRef.current);
        if (r.status !== 'active') return;

        timerRef.current = setInterval(() => {
            const el = lastMoveAtRef.current
                ? Math.floor((Date.now() - lastMoveAtRef.current) / 1000)
                : 0;

            if (turnRef.current === 'w') {
                const t = Math.max(0, storedWt.current - el);
                setWhiteDisplay(t);
                if (t === 0) handleTimeout('w');
            } else {
                const t = Math.max(0, storedBt.current - el);
                setBlackDisplay(t);
                if (t === 0) handleTimeout('b');
            }
        }, 500);
    }

    // ── Handle room update ────────────────────────────────────────────────────
    function applyRoom(r: RoomDoc) {
        gameRef.current = new Chess(r.fen);
        if (r.lastMove) {
            setLastMove({ from: r.lastMove.slice(0, 2), to: r.lastMove.slice(2, 4) });
        }
        setSelected(null);
        setHints([]);
        setRoom(r);
        syncTimer(r);
    }

    // ── Timeout ───────────────────────────────────────────────────────────────
    async function handleTimeout(color: 'w' | 'b') {
        if (timerRef.current) clearInterval(timerRef.current);
        const loser = color === 'w' ? 'White' : 'Black';
        const winner = color === 'w' ? 'Black' : 'White';
        try {
            await databases.updateDocument(DATABASE_ID, ROOMS, id, {
                status: 'finished',
                result: `${winner} wins on time`,
            });
        } catch { /* another client may have already updated */ }
    }

    // ── Initial load ──────────────────────────────────────────────────────────
    useEffect(() => {
        let unsubscribe: (() => void) | null = null;

        const init = async () => {
            try {
                const [user, doc] = await Promise.all([
                    account.get(),
                    databases.getDocument(DATABASE_ID, ROOMS, id),
                ]);

                const r = doc as unknown as RoomDoc;
                myIdRef.current = user.$id;
                setMyId(user.$id);

                // Determine color
                let color: 'w' | 'b' | null = null;
                if (r.player1Id === user.$id) color = 'w';
                else if (r.player2Id === user.$id) color = 'b';
                else if (!r.player2Id && r.status === 'waiting') {
                    // Join as player 2
                    const updated = await databases.updateDocument(DATABASE_ID, ROOMS, id, {
                        player2Id: user.$id,
                        player2Name: user.name || 'Player 2',
                        status: 'active',
                        lastMoveAt: new Date().toISOString(),
                    });
                    color = 'b';
                    applyRoom(updated as unknown as RoomDoc);
                }

                myColorRef.current = color;
                setMyColor(color);
                applyRoom(r);

                // Subscribe to real-time updates
                unsubscribe = appwriteClient.subscribe(
                    `databases.${DATABASE_ID}.collections.${ROOMS}.documents.${id}`,
                    (response) => {
                        const payload = response.payload as RoomDoc;
                        applyRoom(payload);
                    }
                );
            } catch (e) {
                console.error(e);
            }
        };

        init();
        return () => {
            unsubscribe?.();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [id]);

    // ── Make move ─────────────────────────────────────────────────────────────
    async function submitMove(from: Square, to: Square, promotion: 'q' | 'r' | 'b' | 'n' = 'q') {
        if (submitting) return;
        const r = room;
        if (!r || r.status !== 'active') return;
        if (myColorRef.current !== gameRef.current.turn()) return;

        const game = gameRef.current;
        let move;
        try {
            move = game.move({ from, to, promotion });
        } catch { return; }
        if (!move) return;

        setSubmitting(true);

        const now = Date.now();
        const elapsed = lastMoveAtRef.current
            ? Math.floor((now - lastMoveAtRef.current) / 1000)
            : 0;

        const newWt = r.turn === 'w' ? Math.max(0, r.whiteTime - elapsed) : r.whiteTime;
        const newBt = r.turn === 'b' ? Math.max(0, r.blackTime - elapsed) : r.blackTime;

        let result: string | null = null;
        if (game.isCheckmate()) result = `${game.turn() === 'w' ? 'Black' : 'White'} wins by checkmate`;
        else if (game.isDraw()) result = 'Draw';

        try {
            await databases.updateDocument(DATABASE_ID, ROOMS, id, {
                fen: game.fen(),
                turn: game.turn(),
                lastMove: `${from}${to}`,
                whiteTime: newWt,
                blackTime: newBt,
                lastMoveAt: new Date(now).toISOString(),
                status: result ? 'finished' : 'active',
                result,
            });
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    }

    // ── Square click ──────────────────────────────────────────────────────────
    function onSquareClick(sq: Square) {
        if (promo) return;
        const r = room;
        if (!r || r.status !== 'active') return;
        if (myColorRef.current !== gameRef.current.turn()) return;

        const game = gameRef.current;

        if (selected) {
            const legalDests = game.moves({ square: selected, verbose: true }).map(m => m.to);
            if (legalDests.includes(sq)) {
                const movingPiece = game.get(selected);
                const isPromo = movingPiece?.type === 'p' && (sq[1] === '8' || sq[1] === '1');
                if (isPromo) {
                    setPromo({ from: selected, to: sq });
                } else {
                    submitMove(selected, sq);
                }
            }
            setSelected(null);
            setHints([]);
        } else {
            const piece = game.get(sq);
            if (piece && piece.color === game.turn()) {
                setSelected(sq);
                setHints(game.moves({ square: sq, verbose: true }).map(m => m.to));
            }
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────
    if (!room) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black">
                <div className="text-center">
                    <div className="spinner mx-auto mb-3" />
                    <p className="text-sm" style={{ color: '#adacac' }}>Connecting…</p>
                </div>
            </div>
        );
    }

    const flipped = myColor === 'b';
    const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : RANKS_W;
    const files = flipped ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : FILES_W;
    const board = gameRef.current.board();

    const inCheck = gameRef.current.inCheck();
    const checkKingSq: Square | null = inCheck ? (() => {
        const t = gameRef.current.turn();
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const sq = (FILES_W[c] + RANKS_W[r]) as Square;
            const p = gameRef.current.get(sq);
            if (p?.type === 'k' && p.color === t) return sq;
        }
        return null;
    })() : null;

    const waiting = room.status === 'waiting';
    const finished = room.status === 'finished';
    const link = typeof window !== 'undefined' ? window.location.href : '';

    const whiteName = room.player1Name;
    const blackName = room.player2Name ?? '…';
    const topName  = flipped ? whiteName : blackName;
    const botName  = flipped ? blackName : whiteName;
    const topTime  = flipped ? whiteDisplay : blackDisplay;
    const botTime  = flipped ? blackDisplay : whiteDisplay;
    const topColor = flipped ? 'w' : 'b';
    const botColor = flipped ? 'b' : 'w';
    const topActive = room.status === 'active' && room.turn === topColor;
    const botActive = room.status === 'active' && room.turn === botColor;

    const PROMO_PIECES = [
        { key: 'q' as const, label: 'Queen'  },
        { key: 'r' as const, label: 'Rook'   },
        { key: 'b' as const, label: 'Bishop' },
        { key: 'n' as const, label: 'Knight' },
    ];

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            {/* Promotion dialog */}
            {promo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(3px)' }}>
                    <div className="rounded-sm animate-slide-up" style={{ backgroundColor: '#111', border: '1px solid #282828' }}>
                        <p className="text-xs uppercase tracking-widest px-6 pt-5 pb-4" style={{ color: '#adacac' }}>Promote pawn to</p>
                        <div className="flex gap-2 px-5 pb-5">
                            {PROMO_PIECES.map(({ key, label }) => {
                                const color = gameRef.current.turn();
                                const sym = SYMBOLS[color === 'w' ? key.toUpperCase() : key];
                                return (
                                    <button
                                        key={key}
                                        onClick={() => { submitMove(promo.from, promo.to, key); setPromo(null); }}
                                        title={label}
                                        className="flex flex-col items-center gap-1 rounded-sm border border-[#333] hover:border-[#bcfe00] transition-all"
                                        style={{ width: 60, height: 72, backgroundColor: '#191919', fontSize: 36 }}
                                    >
                                        <span className="mt-2">{sym}</span>
                                        <span className="text-[9px] uppercase tracking-widest" style={{ color: '#555' }}>{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Nav */}
            <nav className="border-b border-[#1a1a1a] px-6 py-4 flex items-center justify-between flex-shrink-0">
                <button onClick={() => router.push('/')} className="text-sm uppercase tracking-widest transition-colors hover:text-[#bcfe00]" style={{ color: '#adacac' }}>
                    ← Home
                </button>
                <span className="text-lg font-bold">Y<span style={{ color: '#bcfe00' }}>Chess</span></span>
                <div style={{ width: 60 }} />
            </nav>

            <div className="flex flex-col items-center justify-center flex-1 py-6 px-4 gap-3">

                {/* Waiting banner */}
                {waiting && (
                    <div className="w-full max-w-md rounded-sm border border-[#bcfe00] px-5 py-4 mb-2" style={{ backgroundColor: '#0d1a00' }}>
                        <p className="text-sm font-medium mb-3" style={{ color: '#bcfe00' }}>
                            Waiting for opponent…
                        </p>
                        <p className="text-xs mb-3" style={{ color: '#adacac' }}>Share this link with your friend:</p>
                        <div className="flex gap-2">
                            <input
                                readOnly
                                value={link}
                                className="flex-1 text-xs px-3 py-2 rounded-sm border border-[#333] bg-black"
                                style={{ color: '#adacac' }}
                            />
                            <button
                                onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                                className="px-4 py-2 text-xs uppercase tracking-widest rounded-sm font-bold transition-all"
                                style={{ backgroundColor: copied ? '#4a7832' : '#bcfe00', color: '#000' }}
                            >
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Finished banner */}
                {finished && (
                    <div className="w-full max-w-md rounded-sm border border-[#bcfe00] px-5 py-4 mb-2 text-center" style={{ backgroundColor: '#0d1a00' }}>
                        <p className="text-lg font-bold mb-1" style={{ color: '#bcfe00' }}>{room.result}</p>
                        <button onClick={() => router.push('/play')} className="mt-3 text-xs uppercase tracking-widest hover:text-white transition-colors" style={{ color: '#555' }}>
                            New game →
                        </button>
                    </div>
                )}

                {/* Top player (opponent from your view) */}
                <div className="flex items-center justify-between w-full" style={{ maxWidth: SQ * 8 + 40 }}>
                    <span className="text-sm font-medium" style={{ color: topActive ? '#fff' : '#555' }}>{topName}</span>
                    <div
                        className="text-2xl font-bold tabular-nums px-3 py-1 rounded-sm"
                        style={{
                            color: topActive ? '#000' : '#555',
                            backgroundColor: topActive ? '#bcfe00' : '#191919',
                            border: topActive ? 'none' : '1px solid #282828',
                            minWidth: 80,
                            textAlign: 'center',
                        }}
                    >
                        {fmt(topTime)}
                    </div>
                </div>

                {/* Board */}
                <div style={{ display: 'inline-flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex' }}>
                        {/* Rank labels */}
                        <div style={{ display: 'flex', flexDirection: 'column', width: 20 }}>
                            {ranks.map(r => (
                                <div key={r} style={{ height: SQ, width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#555', userSelect: 'none' }}>
                                    {r}
                                </div>
                            ))}
                        </div>

                        {/* Squares */}
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(8, ${SQ}px)`, boxShadow: '0 0 40px rgba(0,0,0,0.8)', borderRadius: 2, overflow: 'hidden' }}>
                            {ranks.map((rank, rowIdx) =>
                                files.map((file, colIdx) => {
                                    const sq = `${file}${rank}` as Square;
                                    const isLight = (rowIdx + colIdx) % 2 === 0;
                                    const isSelected = selected === sq;
                                    const isHint = hints.includes(sq);
                                    const isLastMove = !!lastMove && (sq === lastMove.from || sq === lastMove.to);
                                    const isCheck = sq === checkKingSq;

                                    // Get piece from board array
                                    const fileIdx = FILES_W.indexOf(file);
                                    const rankIdx = RANKS_W.indexOf(rank);
                                    const piece: Piece | null = board[rankIdx]?.[fileIdx] ?? null;
                                    const isCapture = isHint && !!piece;

                                    const bg = isSelected ? '#f6f669' : isLight ? '#eeeed2' : '#769656';

                                    return (
                                        <div
                                            key={sq}
                                            onClick={() => onSquareClick(sq)}
                                            style={{ width: SQ, height: SQ, backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer', userSelect: 'none', fontSize: 36 }}
                                        >
                                            {isCheck && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, rgba(255,30,30,0.75) 0%, rgba(220,0,0,0.2) 60%, transparent 100%)', pointerEvents: 'none' }} />}
                                            {isLastMove && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(205,210,56,0.4)', pointerEvents: 'none' }} />}
                                            {isHint && !isCapture && <div style={{ width: SQ * 0.3, height: SQ * 0.3, borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.22)', pointerEvents: 'none' }} />}
                                            {isCapture && <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: '0 0 0 5px rgba(0,0,0,0.28) inset', pointerEvents: 'none' }} />}
                                            {piece && (
                                                <span style={{ zIndex: 1, lineHeight: 1 }}>
                                                    {SYMBOLS[piece.color === 'b' ? piece.type : piece.type.toUpperCase()]}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* File labels */}
                    <div style={{ display: 'flex', marginLeft: 20 }}>
                        {files.map(f => (
                            <div key={f} style={{ width: SQ, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#555', userSelect: 'none' }}>
                                {f}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom player (you) */}
                <div className="flex items-center justify-between w-full" style={{ maxWidth: SQ * 8 + 40 }}>
                    <span className="text-sm font-medium" style={{ color: botActive ? '#fff' : '#555' }}>
                        {botName} {myColor && <span style={{ color: '#bcfe00' }}>(you)</span>}
                    </span>
                    <div
                        className="text-2xl font-bold tabular-nums px-3 py-1 rounded-sm"
                        style={{
                            color: botActive ? '#000' : '#555',
                            backgroundColor: botActive ? '#bcfe00' : '#191919',
                            border: botActive ? 'none' : '1px solid #282828',
                            minWidth: 80,
                            textAlign: 'center',
                        }}
                    >
                        {fmt(botTime)}
                    </div>
                </div>

                {/* Spectator notice */}
                {!myColor && room.status === 'active' && (
                    <p className="text-xs uppercase tracking-widest mt-2" style={{ color: '#555' }}>Spectating</p>
                )}
            </div>
        </div>
    );
}
