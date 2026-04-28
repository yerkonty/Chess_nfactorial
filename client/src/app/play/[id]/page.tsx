'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chess, type Square, type Piece } from 'chess.js';
import { account, databases } from '@/lib/appwrite';
import appwriteClient from '@/lib/appwrite';
import { playMove, playCapture, playCheck, playGameOver } from '@/lib/sounds';

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
    player2Id?: string | null;
    player2Name?: string | null;
    turn: string;
    lastMove?: string | null;
    whiteTime?: number;
    blackTime?: number;
    lastMoveAt?: string | null;
    timerDuration?: number;
    result?: string | null;
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
    const [displayGame, setDisplayGame] = useState(new Chess());
    const [myColor, setMyColor] = useState<'w' | 'b' | null>(null);
    const [selected, setSelected] = useState<Square | null>(null);
    const [hints, setHints] = useState<string[]>([]);
    const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
    const [moveCount, setMoveCount] = useState(0);
    const [whiteDisplay, setWhiteDisplay] = useState(0);
    const [blackDisplay, setBlackDisplay] = useState(0);
    const [copied, setCopied] = useState(false);
    const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [dragState, setDragState] = useState<{ square: Square; piece: Piece; x: number; y: number } | null>(null);

    const gameRef = useRef(new Chess());
    const roomRef = useRef<RoomDoc | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const storedWt = useRef(0);
    const storedBt = useRef(0);
    const lastMoveAtRef = useRef<number | null>(null);
    const turnRef = useRef<string>('w');
    const myIdRef = useRef('');
    const myColorRef = useRef<'w' | 'b' | null>(null);
    const submittingRef = useRef(false);

    // Drag-and-drop refs
    const boardRef = useRef<HTMLDivElement | null>(null);
    const potentialDrag = useRef<{ square: Square; piece: Piece; startX: number; startY: number } | null>(null);
    const isDraggingRef = useRef(false);
    const justDragged = useRef(false);

    // ── Sync timer from room ──────────────────────────────────────────────────
    const handleTimeout = useCallback(async (color: 'w' | 'b') => {
        if (timerRef.current) clearInterval(timerRef.current);
        const winner = color === 'w' ? 'Black' : 'White';
        try {
            await databases.updateDocument(DATABASE_ID, ROOMS, id, {
                status: 'finished',
                result: `${winner} wins on time`,
            });
        } catch { /* another client may have already updated */ }
    }, [id]);

    const syncTimer = useCallback((r: RoomDoc) => {
        const defaultTime = r.timerDuration ?? 300;
        storedWt.current = r.whiteTime ?? defaultTime;
        storedBt.current = r.blackTime ?? defaultTime;
        lastMoveAtRef.current = r.lastMoveAt ? new Date(r.lastMoveAt).getTime() : null;
        turnRef.current = r.turn;

        const elapsed = lastMoveAtRef.current
            ? Math.floor((Date.now() - lastMoveAtRef.current) / 1000)
            : 0;

        setWhiteDisplay(r.turn === 'w' ? Math.max(0, storedWt.current - elapsed) : storedWt.current);
        setBlackDisplay(r.turn === 'b' ? Math.max(0, storedBt.current - elapsed) : storedBt.current);

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
    }, [handleTimeout]);

    // ── Handle room update ────────────────────────────────────────────────────
    const applyRoom = useCallback((r: RoomDoc) => {
        roomRef.current = r;
        gameRef.current = new Chess(r.fen);
        if (r.lastMove) {
            setLastMove({ from: r.lastMove.slice(0, 2), to: r.lastMove.slice(2, 4) });
            setMoveCount(c => c + 1);
        }
        setSelected(null);
        setHints([]);
        setRoom(r);
        setDisplayGame(new Chess(r.fen));
        syncTimer(r);
    }, [syncTimer]);

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

                let color: 'w' | 'b' | null = null;
                if (r.player1Id === user.$id) color = 'w';
                else if (r.player2Id === user.$id) color = 'b';
                else if (!r.player2Id && r.status === 'waiting') {
                    const joinFields: Record<string, unknown> = {
                        player2Id: user.$id,
                        player2Name: user.name || 'Player 2',
                        status: 'active',
                    };
                    try {
                        const updated = await databases.updateDocument(DATABASE_ID, ROOMS, id, {
                            ...joinFields,
                            lastMoveAt: new Date().toISOString(),
                        });
                        color = 'b';
                        applyRoom(updated as unknown as RoomDoc);
                    } catch {
                        const updated = await databases.updateDocument(DATABASE_ID, ROOMS, id, joinFields);
                        color = 'b';
                        applyRoom(updated as unknown as RoomDoc);
                    }
                }

                myColorRef.current = color;
                setMyColor(color);
                applyRoom(r);

                unsubscribe = appwriteClient.subscribe(
                    `databases.${DATABASE_ID}.collections.${ROOMS}.documents.${id}`,
                    (response) => {
                        const payload = response.payload as RoomDoc;
                        // Play sound on opponent's move (ours was played in submitMove)
                        if (payload.lastMove && myColorRef.current !== null) {
                            const prevFen = gameRef.current.fen();
                            const tmp = new Chess(prevFen);
                            const from = payload.lastMove.slice(0, 2) as Square;
                            const to   = payload.lastMove.slice(2, 4) as Square;
                            try {
                                const m = tmp.move({ from, to, promotion: 'q' });
                                if (m) {
                                    if (tmp.isGameOver()) playGameOver();
                                    else if (tmp.inCheck()) playCheck();
                                    else if (m.captured) playCapture();
                                    else playMove();
                                }
                            } catch { /* ignore */ }
                        }
                        applyRoom(payload);
                    }
                );
            } catch (e: unknown) {
                console.error(e);
                const msg = e instanceof Error ? e.message : String(e);
                if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('user_unauthorized') || msg.includes('missing scope')) {
                    router.push('/login');
                }
            }
        };

        init();
        return () => {
            unsubscribe?.();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [id, applyRoom, router]);

    // ── Make move (ref-safe version used by drag handler) ─────────────────────
    const doSubmitMove = useCallback(async (from: Square, to: Square, promotion: 'q' | 'r' | 'b' | 'n' = 'q') => {
        if (submittingRef.current) return;
        const r = roomRef.current;
        if (!r || r.status !== 'active') return;
        if (myColorRef.current !== gameRef.current.turn()) return;

        const game = gameRef.current;
        let move;
        try { move = game.move({ from, to, promotion }); } catch { return; }
        if (!move) return;

        // Play sound immediately on our own move
        if (game.isGameOver()) playGameOver();
        else if (game.inCheck()) playCheck();
        else if (move.captured) playCapture();
        else playMove();

        submittingRef.current = true;

        const now = Date.now();
        const elapsed = lastMoveAtRef.current
            ? Math.floor((now - lastMoveAtRef.current) / 1000)
            : 0;

        const wt = r.whiteTime ?? storedWt.current;
        const bt = r.blackTime ?? storedBt.current;
        const newWt = r.turn === 'w' ? Math.max(0, wt - elapsed) : wt;
        const newBt = r.turn === 'b' ? Math.max(0, bt - elapsed) : bt;

        let result: string | null = null;
        if (game.isCheckmate()) result = `${game.turn() === 'w' ? 'Black' : 'White'} wins by checkmate`;
        else if (game.isDraw()) result = 'Draw';

        const updateData: Record<string, unknown> = {
            fen: game.fen(),
            turn: game.turn(),
            lastMove: `${from}${to}`,
            status: result ? 'finished' : 'active',
            result,
        };

        // Only include timer fields if the room has them
        if (r.timerDuration) {
            updateData.whiteTime = newWt;
            updateData.blackTime = newBt;
            updateData.lastMoveAt = new Date(now).toISOString();
        }

        try {
            await databases.updateDocument(DATABASE_ID, ROOMS, id, updateData);
        } catch (e) {
            console.error(e);
        } finally {
            submittingRef.current = false;
        }
    }, [id]);

    // ── Drag-and-drop ─────────────────────────────────────────────────────────
    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!potentialDrag.current) return;
            const dx = e.clientX - potentialDrag.current.startX;
            const dy = e.clientY - potentialDrag.current.startY;
            if (!isDraggingRef.current && Math.hypot(dx, dy) > 5) {
                isDraggingRef.current = true;
                document.body.style.cursor = 'grabbing';
            }
            if (isDraggingRef.current) {
                const { square, piece } = potentialDrag.current;
                setDragState({ square, piece, x: e.clientX, y: e.clientY });
            }
        };

        const onMouseUp = (e: MouseEvent) => {
            if (potentialDrag.current && isDraggingRef.current) {
                justDragged.current = true;
                const boardEl = boardRef.current;
                const r = roomRef.current;
                if (boardEl && r?.status === 'active') {
                    const rect = boardEl.getBoundingClientRect();
                    const col = Math.floor((e.clientX - rect.left) / SQ);
                    const row = Math.floor((e.clientY - rect.top) / SQ);
                    if (col >= 0 && col < 8 && row >= 0 && row < 8) {
                        const flipped = myColorRef.current === 'b';
                        const dFiles = flipped ? ['h','g','f','e','d','c','b','a'] : FILES_W;
                        const dRanks = flipped ? [1,2,3,4,5,6,7,8] : RANKS_W;
                        const toSq = `${dFiles[col]}${dRanks[row]}` as Square;
                        const from = potentialDrag.current.square;
                        const game = gameRef.current;
                        if (toSq !== from && myColorRef.current === game.turn()) {
                            const movingPiece = game.get(from);
                            const legal = game.moves({ square: from, verbose: true });
                            const isLegal = legal.some((m: { to: string }) => m.to === toSq);
                            if (isLegal) {
                                const isPromo = movingPiece?.type === 'p' && (toSq[1] === '8' || toSq[1] === '1');
                                if (isPromo) {
                                    setPromo({ from, to: toSq });
                                } else {
                                    doSubmitMove(from, toSq);
                                }
                            }
                        }
                    }
                }
                setSelected(null);
                setHints([]);
            }
            document.body.style.cursor = '';
            potentialDrag.current = null;
            isDraggingRef.current = false;
            setDragState(null);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [doSubmitMove]);

    // ── Make move (React state version used by click handler) ─────────────────
    async function submitMove(from: Square, to: Square, promotion: 'q' | 'r' | 'b' | 'n' = 'q') {
        if (submitting) return;
        setSubmitting(true);
        await doSubmitMove(from, to, promotion);
        setSubmitting(false);
    }

    // ── Piece mouse down ──────────────────────────────────────────────────────
    function handlePieceMouseDown(e: React.MouseEvent, square: Square, piece: Piece) {
        const r = roomRef.current;
        if (!r || r.status !== 'active') return;
        if (myColorRef.current !== gameRef.current.turn()) return;
        if (piece.color !== myColorRef.current) return;
        e.preventDefault();
        potentialDrag.current = { square, piece, startX: e.clientX, startY: e.clientY };
        const legalMoves = gameRef.current.moves({ square, verbose: true });
        if (legalMoves.length > 0) {
            setSelected(square);
            setHints(legalMoves.map(m => m.to));
        }
    }

    // ── Square click ──────────────────────────────────────────────────────────
    function onSquareClick(sq: Square) {
        if (justDragged.current) { justDragged.current = false; return; }
        if (promo) return;
        const r = roomRef.current;
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
            <div className="flex items-center justify-center min-h-screen" style={{ background: '#FEF9F0' }}>
                <div className="text-center">
                    <div className="spinner mx-auto mb-3" />
                    <p className="text-sm font-semibold" style={{ color: '#A07650' }}>Connecting…</p>
                </div>
            </div>
        );
    }

    const flipped = myColor === 'b';
    const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : RANKS_W;
    const files = flipped ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : FILES_W;

    const inCheck = displayGame.inCheck();
    const checkKingSq: Square | null = inCheck ? (() => {
        const t = displayGame.turn();
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const sq = (FILES_W[c] + RANKS_W[r]) as Square;
            const p = displayGame.get(sq);
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
        <div className="min-h-screen flex flex-col" style={{ background: '#FEF9F0', color: '#4A2C0A' }}>
            {/* Floating drag piece */}
            {dragState && (
                <div style={{ position: 'fixed', left: dragState.x - SQ * 0.6, top: dragState.y - SQ * 0.6, width: SQ * 1.2, height: SQ * 1.2, fontSize: SQ * 0.9, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 9999, lineHeight: 1, filter: 'drop-shadow(0 8px 20px rgba(74,44,10,0.4))', transform: 'scale(1.18)' }}>
                    {SYMBOLS[dragState.piece.color === 'b' ? dragState.piece.type : dragState.piece.type.toUpperCase()]}
                </div>
            )}

            {/* Promotion dialog */}
            {promo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(74,44,10,0.55)', backdropFilter: 'blur(3px)' }}>
                    <div className="animate-slide-up" style={{ background: '#FFFDF9', border: '1.5px solid #C8A882', boxShadow: '6px 6px 0 #C8A882' }}>
                        <p className="text-xs font-black uppercase tracking-widest px-6 pt-5 pb-4" style={{ color: '#A07650' }}>Promote pawn to</p>
                        <div className="flex gap-2 px-5 pb-5">
                            {PROMO_PIECES.map(({ key, label }) => {
                                const color = displayGame.turn();
                                const sym = SYMBOLS[color === 'w' ? key.toUpperCase() : key];
                                return (
                                    <button key={key} onClick={() => { submitMove(promo.from, promo.to, key); setPromo(null); }} title={label}
                                        className="flex flex-col items-center gap-1"
                                        style={{ width: 60, height: 72, background: '#F7EDDA', border: '1.5px solid #C8A882', boxShadow: '2px 2px 0 #C8A882', fontSize: 36, cursor: 'pointer' }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#D4722A'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#C8A882'; }}>
                                        <span className="mt-2">{sym}</span>
                                        <span style={{ fontSize: 9, color: '#A07650', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Nav */}
            <nav style={{ background: '#FFFDF9', borderBottom: '1.5px solid #E8D9A8' }} className="px-6 py-4 flex items-center justify-between flex-shrink-0">
                <button onClick={() => router.push('/')} className="text-xs font-black uppercase tracking-widest hover:underline" style={{ color: '#A07650', background: 'none', border: 'none', cursor: 'pointer' }}>
                    ← Home
                </button>
                <span className="text-lg font-black tracking-tight" style={{ color: '#4A2C0A' }}>Y<span style={{ color: '#D4722A' }}>Chess</span></span>
                <div style={{ width: 60 }} />
            </nav>

            <div className="flex flex-col items-center justify-center flex-1 py-6 px-4 gap-3">

                {/* Waiting banner */}
                {waiting && (
                    <div className="w-full max-w-md px-5 py-4 mb-2" style={{ background: '#FFF4E6', border: '1.5px solid #D4722A', boxShadow: '3px 3px 0 #C8A882' }}>
                        <p className="text-sm font-black mb-3" style={{ color: '#D4722A' }}>Waiting for opponent…</p>
                        <p className="text-xs font-semibold mb-3" style={{ color: '#A07650' }}>Share this link with your friend:</p>
                        <div className="flex gap-2">
                            <input readOnly value={link} className="flex-1 text-xs px-3 py-2 font-semibold"
                                style={{ background: '#FFFDF9', border: '1.5px solid #E8D9A8', color: '#4A2C0A', outline: 'none' }} />
                            <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                                className="px-4 py-2 text-xs font-black uppercase tracking-widest"
                                style={{ background: copied ? '#769656' : '#D4722A', color: '#FFFDF9', border: `1.5px solid ${copied ? '#5d8040' : '#B85E1A'}`, boxShadow: `2px 2px 0 ${copied ? '#5d8040' : '#B85E1A'}`, cursor: 'pointer' }}>
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Finished banner */}
                {finished && (
                    <div className="w-full max-w-md px-5 py-4 mb-2 text-center" style={{ background: '#FFF4E6', border: '1.5px solid #D4722A', boxShadow: '3px 3px 0 #C8A882' }}>
                        <p className="text-lg font-black mb-1" style={{ color: '#D4722A' }}>{room.result}</p>
                        <button onClick={() => router.push('/play')} className="mt-3 text-xs font-black uppercase tracking-widest hover:underline" style={{ color: '#A07650', background: 'none', border: 'none', cursor: 'pointer' }}>
                            New game →
                        </button>
                    </div>
                )}

                {/* Top player */}
                <div className="flex items-center justify-between w-full" style={{ maxWidth: SQ * 8 + 40 }}>
                    <span className="text-sm font-bold" style={{ color: topActive ? '#4A2C0A' : '#C8A882' }}>{topName}</span>
                    {room.timerDuration && (
                        <div className="text-2xl font-black tabular-nums px-3 py-1"
                            style={{ color: topActive ? '#FFFDF9' : '#A07650', background: topActive ? '#D4722A' : '#FFFDF9', border: `1.5px solid ${topActive ? '#B85E1A' : '#E8D9A8'}`, boxShadow: `2px 2px 0 ${topActive ? '#B85E1A' : '#C8A882'}`, minWidth: 80, textAlign: 'center' }}>
                            {fmt(topTime)}
                        </div>
                    )}
                </div>

                {/* Board */}
                <div style={{ display: 'inline-flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', width: 20 }}>
                            {ranks.map(r => (
                                <div key={r} style={{ height: SQ, width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#C8A882', userSelect: 'none' }}>{r}</div>
                            ))}
                        </div>
                        <div ref={boardRef} style={{ display: 'grid', gridTemplateColumns: `repeat(8, ${SQ}px)`, boxShadow: '5px 5px 0 #C8A882', border: '1.5px solid #C8A882', overflow: 'hidden' }}>
                            {ranks.map((rank, rowIdx) =>
                                files.map((file, colIdx) => {
                                    const sq = `${file}${rank}` as Square;
                                    const isLight = (rowIdx + colIdx) % 2 === 0;
                                    const isSelected = selected === sq;
                                    const isHint = hints.includes(sq);
                                    const isLastMove = !!lastMove && (sq === lastMove.from || sq === lastMove.to);
                                    const isLanding = !!lastMove && sq === lastMove.to;
                                    const isCheck = sq === checkKingSq;
                                    const fileIdx = FILES_W.indexOf(file as string);
                                    const rankIdx = RANKS_W.indexOf(rank as number);
                                    const piece: Piece | null = displayGame.board()[rankIdx]?.[fileIdx] ?? null;
                                    const isCapture = isHint && !!piece;
                                    const bg = isSelected ? '#f6f669' : isLight ? '#eeeed2' : '#769656';
                                    return (
                                        <div key={sq} className="board-square" onClick={() => onSquareClick(sq)}
                                            style={{ width: SQ, height: SQ, backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer', userSelect: 'none', fontSize: 36 }}>
                                            {isCheck && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(255,30,30,0.7) 0%, rgba(220,0,0,0.2) 60%, transparent 100%)', pointerEvents: 'none' }} />}
                                            {isLastMove && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(212,114,42,0.28)', pointerEvents: 'none' }} />}
                                            {isHint && !isCapture && <div style={{ width: SQ * 0.3, height: SQ * 0.3, borderRadius: '50%', backgroundColor: 'rgba(74,44,10,0.18)', pointerEvents: 'none' }} />}
                                            {isCapture && <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: '0 0 0 5px rgba(74,44,10,0.22) inset', pointerEvents: 'none' }} />}
                                            {piece && (
                                                <span key={isLanding ? moveCount : undefined} className={`piece-span${isLanding ? ' piece-land' : ''}`}
                                                    onMouseDown={e => handlePieceMouseDown(e, sq, piece)}
                                                    style={{ zIndex: 1, lineHeight: 1, cursor: piece.color === myColor ? 'grab' : 'default', opacity: dragState?.square === sq ? 0.15 : 1 }}>
                                                    {SYMBOLS[piece.color === 'b' ? piece.type : piece.type.toUpperCase()]}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', marginLeft: 20 }}>
                        {files.map(f => (
                            <div key={f} style={{ width: SQ, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#C8A882', userSelect: 'none' }}>{f}</div>
                        ))}
                    </div>
                </div>

                {/* Bottom player */}
                <div className="flex items-center justify-between w-full" style={{ maxWidth: SQ * 8 + 40 }}>
                    <span className="text-sm font-bold" style={{ color: botActive ? '#4A2C0A' : '#C8A882' }}>
                        {botName} {myColor && <span style={{ color: '#D4722A' }}>(you)</span>}
                    </span>
                    {room.timerDuration && (
                        <div className="text-2xl font-black tabular-nums px-3 py-1"
                            style={{ color: botActive ? '#FFFDF9' : '#A07650', background: botActive ? '#D4722A' : '#FFFDF9', border: `1.5px solid ${botActive ? '#B85E1A' : '#E8D9A8'}`, boxShadow: `2px 2px 0 ${botActive ? '#B85E1A' : '#C8A882'}`, minWidth: 80, textAlign: 'center' }}>
                            {fmt(botTime)}
                        </div>
                    )}
                </div>

                {!myColor && room.status === 'active' && (
                    <p className="text-xs font-black uppercase tracking-widest mt-2" style={{ color: '#C8A882' }}>Spectating</p>
                )}
            </div>
        </div>
    );
}
