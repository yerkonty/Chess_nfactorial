"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { type Square, type Piece } from "chess.js";
import { databases } from "@/lib/appwrite";
import { ID } from "appwrite";
import ProModal from "./ProModal";
import { PIECE_SKINS, type PieceSkin } from "@/lib/skins";
import { playMove, playCapture, playCheck, playGameOver } from "@/lib/sounds";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_GAMES_COLLECTION_ID!;

const pieceSymbols: { [key: string]: string } = {
    p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔",
    P: "♟", R: "♜", N: "♞", B: "♝", Q: "♛", K: "♚",
};

type GameMode = "player-vs-player" | "player-vs-ai";

type BoardTheme = {
    id: string;
    name: string;
    light: string;
    dark: string;
    selectedBg: string;
    labelColor: string;
};

const BOARD_THEMES: BoardTheme[] = [
    { id: 'classic',  name: 'Classic',  light: '#eeeed2', dark: '#769656', selectedBg: '#f6f669', labelColor: '#5d8040' },
    { id: 'walnut',   name: 'Walnut',   light: '#f0d9b5', dark: '#b58863', selectedBg: '#f6f669', labelColor: '#8a6040' },
    { id: 'ice',      name: 'Ice',      light: '#dce9f5', dark: '#6d9bc3', selectedBg: '#f6f669', labelColor: '#5078a0' },
    { id: 'midnight', name: 'Midnight', light: '#5c5c5c', dark: '#2e2e2e', selectedBg: '#bcfe00', labelColor: '#888888' },
    { id: 'neon',     name: 'Neon',     light: '#d6f57a', dark: '#4a7832', selectedBg: '#fff176', labelColor: '#6aab30' },
];

const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const SQ = 56; // square size px
const COORD = 20; // coordinate gutter px

export default function Chessboard({
    userId,
    purchasedSkins,
    onSkinPurchased,
}: {
    userId: string;
    purchasedSkins: string[];
    onSkinPurchased: (skinId: string) => void;
}) {
    const router = useRouter();
    const [game, setGame] = useState<Chess>(new Chess());
    const [board, setBoard] = useState<(Piece | null)[][]>(game.board());
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
    const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
    const [status, setStatus] = useState("");
    const [gameMode, setGameMode] = useState<GameMode>("player-vs-player");
    const [aiLevel, setAiLevel] = useState(5);
    const [theme, setTheme] = useState<BoardTheme>(BOARD_THEMES[0]);
    const stockfishWorker = useRef<Worker | null>(null);
    const [coachAdvice, setCoachAdvice] = useState<string>("");
    const [coachLoading, setCoachLoading] = useState(false);
    const [analysis, setAnalysis] = useState<string>("");
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [gameResult, setGameResult] = useState<string>("");
    const [showPro, setShowPro] = useState(false);
    const [activeSkin, setActiveSkin] = useState<PieceSkin>(PIECE_SKINS[0]);
    const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
    const [moveCount, setMoveCount] = useState(0);
    const boardRef = useRef<HTMLDivElement | null>(null);
    const potentialDrag = useRef<{ square: Square; piece: Piece; startX: number; startY: number } | null>(null);
    const isDraggingRef = useRef(false);
    const justDragged = useRef(false);
    const [dragState, setDragState] = useState<{ square: Square; piece: Piece; x: number; y: number } | null>(null);
    const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square } | null>(null);

    useEffect(() => {
        updateStatus();
        stockfishWorker.current = new Worker('/stockfish-worker.js');
        stockfishWorker.current.postMessage({ type: 'init' });
        stockfishWorker.current.onmessage = (event) => {
            const { type, payload } = event.data;
            if (type === 'best-move' && payload) {
                const from = payload.slice(0, 2) as Square;
                const to   = payload.slice(2, 4) as Square;
                const aiMove = game.move({ from, to, promotion: payload.length === 5 ? payload[4] : undefined });
                setBoard(game.board());
                setLastMove({ from, to });
                setMoveCount(c => c + 1);
                updateStatus();
                if (game.isGameOver()) playGameOver();
                else if (game.inCheck()) playCheck();
                else if (aiMove?.captured) playCapture();
                else playMove();
            }
        };
        return () => { stockfishWorker.current?.terminate(); };
    }, []);

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
                if (boardEl) {
                    const rect = boardEl.getBoundingClientRect();
                    const col = Math.floor((e.clientX - rect.left) / SQ);
                    const row = Math.floor((e.clientY - rect.top) / SQ);
                    if (col >= 0 && col < 8 && row >= 0 && row < 8) {
                        const toSquare = (FILES[col] + RANKS[row]) as Square;
                        const from = potentialDrag.current.square;
                        if (toSquare !== from) {
                            const movingPiece = game.get(from);
                            const isPromo = movingPiece?.type === 'p' && (toSquare[1] === '8' || toSquare[1] === '1');
                            if (isPromo) {
                                const legal = game.moves({ square: from, verbose: true });
                                if (legal.some((m: { to: string }) => m.to === toSquare)) {
                                    setPromotionPending({ from, to: toSquare });
                                    setSelectedSquare(null);
                                    setPossibleMoves([]);
                                }
                            } else {
                                try {
                                    const move = game.move({ from, to: toSquare, promotion: 'q' });
                                    if (move) {
                                        setBoard(game.board());
                                        setLastMove({ from, to: toSquare });
                                        setMoveCount(c => c + 1);
                                        updateStatus();
                                        if (game.isGameOver()) playGameOver();
                                        else if (game.inCheck()) playCheck();
                                        else if (move.captured) playCapture();
                                        else playMove();
                                    }
                                } catch { /* invalid drop */ }
                            }
                        }
                    }
                }
                setSelectedSquare(null);
                setPossibleMoves([]);
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
    }, []); // closes over mutable game ref and stable setState functions

    useEffect(() => {
        if (gameMode === 'player-vs-ai' && game.turn() === 'b') {
            if (stockfishWorker.current) {
                stockfishWorker.current.postMessage({ type: 'uci', payload: `position fen ${game.fen()}` });
                stockfishWorker.current.postMessage({ type: 'uci', payload: `go depth ${aiLevel}` });
            }
        }
    }, [game.fen(), gameMode, aiLevel]);

    async function saveGame(result: string) {
        try {
            await databases.createDocument(DATABASE_ID, COLLECTION_ID, ID.unique(), {
                userId, result, mode: gameMode, pgn: game.pgn(),
            });
        } catch (e) {
            console.error("Failed to save game:", e);
        }
    }

    function updateStatus() {
        let newStatus = `${game.turn() === "w" ? "White" : "Black"} to move`;
        if (game.isCheckmate()) {
            const winner = game.turn() === "w" ? "Black" : "White";
            newStatus = `Checkmate — ${winner} wins!`;
            setGameResult(`${winner} wins`);
            saveGame(`${winner} wins`);
        } else if (game.isDraw()) {
            newStatus = "Game drawn.";
            setGameResult("Draw");
            saveGame("draw");
        } else if (game.inCheck()) {
            newStatus = `Check! ${game.turn() === "w" ? "White" : "Black"} to move`;
        }
        setStatus(newStatus);
    }

    function handlePieceMouseDown(e: React.MouseEvent, square: Square, piece: Piece) {
        if (game.isGameOver() || (gameMode === 'player-vs-ai' && game.turn() === 'b')) return;
        if (piece.color !== game.turn()) return;
        e.preventDefault();
        potentialDrag.current = { square, piece, startX: e.clientX, startY: e.clientY };
        const moves = game.moves({ square, verbose: true });
        if (moves.length > 0) {
            setSelectedSquare(square);
            setPossibleMoves(moves.map(m => m.to));
        }
    }

    function onSquareClick(square: Square) {
        if (justDragged.current) { justDragged.current = false; return; }
        if (promotionPending) return;
        if (game.isGameOver() || (gameMode === 'player-vs-ai' && game.turn() === 'b')) return;

        if (selectedSquare) {
            const from = selectedSquare;
            const legalDests = game.moves({ square: from, verbose: true }).map(m => m.to);
            if (legalDests.includes(square)) {
                if (isPawnPromotion(from, square)) {
                    setPromotionPending({ from, to: square });
                } else {
                    applyMove(from, square);
                }
            }
            setSelectedSquare(null);
            setPossibleMoves([]);
        } else {
            const moves = game.moves({ square, verbose: true });
            if (moves.length > 0 && game.get(square)?.color === game.turn()) {
                setSelectedSquare(square);
                setPossibleMoves(moves.map((m) => m.to));
            }
        }
    }

    async function askCoach() {
        setCoachLoading(true);
        setCoachAdvice("");
        try {
            const res = await fetch("/api/coach", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fen: game.fen(), turn: game.turn(), pgn: game.pgn() }),
            });
            if (!res.body) return;
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                setCoachAdvice((prev) => prev + decoder.decode(value));
            }
        } catch {
            setCoachAdvice("Coach unavailable. Check your API key.");
        } finally {
            setCoachLoading(false);
        }
    }

    async function analyzeGame() {
        setAnalysisLoading(true);
        setAnalysis("");
        try {
            const res = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pgn: game.pgn(), result: gameResult }),
            });
            if (!res.body) return;
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                setAnalysis((prev) => prev + decoder.decode(value));
            }
        } catch {
            setAnalysis("Analysis unavailable. Check your API key.");
        } finally {
            setAnalysisLoading(false);
        }
    }

    function isPawnPromotion(from: Square, to: Square): boolean {
        const p = game.get(from);
        return p?.type === 'p' && (to[1] === '8' || to[1] === '1');
    }

    function applyMove(from: Square, to: Square, promotion: 'q' | 'r' | 'b' | 'n' = 'q') {
        try {
            const move = game.move({ from, to, promotion });
            if (move) {
                setBoard(game.board());
                setLastMove({ from, to });
                setMoveCount(c => c + 1);
                updateStatus();
                if (game.isGameOver()) playGameOver();
                else if (game.inCheck()) playCheck();
                else if (move.captured) playCapture();
                else playMove();
            }
        } catch { /* invalid */ }
    }

    function completePromotion(piece: 'q' | 'r' | 'b' | 'n') {
        if (!promotionPending) return;
        const { from, to } = promotionPending;
        setPromotionPending(null);
        applyMove(from, to, piece);
    }

    function resetGame() {
        const newGame = new Chess();
        setGame(newGame);
        setBoard(newGame.board());
        setSelectedSquare(null);
        setPossibleMoves([]);
        setLastMove(null);
        setPromotionPending(null);
        setAnalysis("");
        setGameResult("");
        setCoachAdvice("");
        updateStatus();
    }

    async function buySkin(skinId: string) {
        try {
            const res = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ skinId, userId }),
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert(`Checkout error: ${data.error || JSON.stringify(data)}`);
            }
        } catch (e) {
            alert(`Network error: ${e}`);
        }
    }

    const isOver = game.isGameOver();
    const coordStyle = { color: theme.labelColor, fontSize: 11, fontWeight: 700, lineHeight: 1, userSelect: 'none' as const };

    // Find king square for check highlight
    const kingInCheckSq: Square | null = game.inCheck() ? (() => {
        const turn = game.turn();
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const sq = (FILES[c] + RANKS[r]) as Square;
                const p = game.get(sq);
                if (p?.type === 'k' && p.color === turn) return sq;
            }
        }
        return null;
    })() : null;

    const PROMO_PIECES = [
        { key: 'q' as const, label: 'Queen'  },
        { key: 'r' as const, label: 'Rook'   },
        { key: 'b' as const, label: 'Bishop' },
        { key: 'n' as const, label: 'Knight' },
    ];

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Floating drag piece */}
            {dragState && (
                <div style={{
                    position: 'fixed',
                    left: dragState.x - SQ * 0.6,
                    top: dragState.y - SQ * 0.6,
                    width: SQ * 1.2,
                    height: SQ * 1.2,
                    fontSize: SQ * 0.9,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    zIndex: 9999,
                    lineHeight: 1,
                    filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.75))',
                    transform: 'scale(1.18)',
                    ...(dragState.piece.color === 'w' ? activeSkin.whiteStyle : activeSkin.blackStyle),
                }}>
                    {pieceSymbols[dragState.piece.color === 'b' ? dragState.piece.type : dragState.piece.type.toUpperCase()]}
                </div>
            )}

            {/* Pawn promotion dialog */}
            {promotionPending && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(3px)' }}
                >
                    <div
                        className="rounded-sm animate-slide-up"
                        style={{ backgroundColor: '#111', border: '1px solid #282828' }}
                    >
                        <p className="text-xs uppercase tracking-widest px-6 pt-5 pb-4" style={{ color: '#adacac' }}>
                            Promote pawn to
                        </p>
                        <div className="flex gap-2 px-5 pb-5">
                            {PROMO_PIECES.map(({ key, label }) => {
                                const color = game.turn();
                                const symbol = pieceSymbols[color === 'w' ? key.toUpperCase() : key];
                                return (
                                    <button
                                        key={key}
                                        onClick={() => completePromotion(key)}
                                        title={label}
                                        className="flex flex-col items-center gap-1 rounded-sm border border-[#333] hover:border-[#bcfe00] transition-all active:scale-[0.96]"
                                        style={{ width: 60, height: 72, backgroundColor: '#191919', fontSize: 36 }}
                                    >
                                        <span
                                            className="mt-2"
                                            style={color === 'w' ? activeSkin.whiteStyle : activeSkin.blackStyle}
                                        >
                                            {symbol}
                                        </span>
                                        <span className="text-[9px] uppercase tracking-widest" style={{ color: '#555' }}>
                                            {label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {showPro && (
                <ProModal
                    onClose={() => setShowPro(false)}
                    purchasedSkins={purchasedSkins}
                    onBuySkin={async (skinId) => {
                        await buySkin(skinId);
                        onSkinPurchased(skinId);
                    }}
                />
            )}

            {/* Nav */}
            <nav className="border-b border-[#1a1a1a] px-6 py-4 flex items-center justify-between">
                <span className="text-xl font-bold tracking-tight">
                    Y<span style={{ color: '#bcfe00' }}>Chess</span>
                </span>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowPro(true)}
                        className="text-xs uppercase tracking-widest px-4 py-2 rounded-sm font-bold transition-all hover:brightness-110 active:scale-[0.97]"
                        style={{ backgroundColor: '#bcfe00', color: '#000' }}
                    >
                        ⚡ Go Pro
                    </button>
                    <button
                        onClick={() => router.push('/profile')}
                        className="text-xs uppercase tracking-widest border border-[#333] px-4 py-2 rounded-sm transition-all hover:border-[#bcfe00] hover:text-[#bcfe00]"
                        style={{ color: '#adacac' }}
                    >
                        Profile
                    </button>
                </div>
            </nav>

            <div className="flex flex-col items-center py-8 px-4 gap-6">
                {/* Mode selector */}
                <div className="flex gap-2">
                    {([
                        { mode: 'player-vs-player', label: 'vs Player' },
                        { mode: 'player-vs-ai',     label: 'vs AI' },
                    ] as const).map(({ mode, label }) => {
                        const active = gameMode === mode;
                        return (
                            <button
                                key={mode}
                                onClick={() => setGameMode(mode)}
                                className="px-5 py-2 text-xs uppercase tracking-widest rounded-sm transition-all active:scale-[0.97]"
                                style={
                                    active
                                        ? { backgroundColor: '#bcfe00', color: '#000', fontWeight: 700 }
                                        : { backgroundColor: '#191919', color: '#adacac', border: '1px solid #282828' }
                                }
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                {/* AI level */}
                {gameMode === 'player-vs-ai' && (
                    <div className="flex items-center gap-3" style={{ color: '#adacac' }}>
                        <span className="text-xs uppercase tracking-widest">AI Level</span>
                        <input
                            type="range" min="0" max="20" value={aiLevel}
                            onChange={(e) => setAiLevel(parseInt(e.target.value))}
                            className="w-36 accent-[#bcfe00]"
                        />
                        <span className="w-6 text-center text-sm font-bold" style={{ color: '#bcfe00' }}>{aiLevel}</span>
                    </div>
                )}

                {/* Status */}
                <div
                    className="text-sm uppercase tracking-widest px-4 py-2 rounded-sm"
                    style={{
                        backgroundColor: isOver ? '#1a1a00' : '#191919',
                        color: isOver ? '#bcfe00' : '#adacac',
                        border: isOver ? '1px solid #bcfe00' : '1px solid #282828',
                    }}
                >
                    {status}
                </div>

                {/* Board with coordinates */}
                <div style={{ display: 'inline-flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex' }}>
                        {/* Rank labels (8→1) */}
                        <div style={{ display: 'flex', flexDirection: 'column', width: COORD }}>
                            {RANKS.map((r) => (
                                <div
                                    key={r}
                                    style={{ height: SQ, width: COORD, display: 'flex', alignItems: 'center', justifyContent: 'center', ...coordStyle }}
                                >
                                    {r}
                                </div>
                            ))}
                        </div>

                        {/* Board */}
                        <div
                            ref={boardRef}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(8, ${SQ}px)`,
                                boxShadow: '0 0 40px rgba(0,0,0,0.8)',
                                borderRadius: 2,
                                overflow: 'hidden',
                            }}
                        >
                            {board.map((row, rowIndex) =>
                                row.map((piece, colIndex) => {
                                    const square = (FILES[colIndex] + RANKS[rowIndex]) as Square;
                                    const isLight = (rowIndex + colIndex) % 2 === 0;
                                    const isSelected = selectedSquare === square;
                                    const isPossible = possibleMoves.includes(square);
                                    const isCapture = isPossible && !!piece;
                                    const isLastMoveSquare = !!lastMove && (square === lastMove.from || square === lastMove.to);
                                    const isLanding = !!lastMove && square === lastMove.to;

                                    const bg = isSelected
                                        ? theme.selectedBg
                                        : (isLight ? theme.light : theme.dark);

                                    return (
                                        <div
                                            key={`${rowIndex}-${colIndex}`}
                                            className="board-square"
                                            onClick={() => onSquareClick(square)}
                                            style={{
                                                width: SQ, height: SQ,
                                                backgroundColor: bg,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                position: 'relative',
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                fontSize: 36,
                                            }}
                                        >
                                            {/* King in check highlight */}
                                            {square === kingInCheckSq && (
                                                <div style={{
                                                    position: 'absolute', inset: 0,
                                                    background: 'radial-gradient(circle at center, rgba(255,30,30,0.75) 0%, rgba(220,0,0,0.25) 60%, transparent 100%)',
                                                    pointerEvents: 'none',
                                                }} />
                                            )}
                                            {/* Last-move highlight */}
                                            {isLastMoveSquare && (
                                                <div style={{
                                                    position: 'absolute', inset: 0,
                                                    backgroundColor: 'rgba(205, 210, 56, 0.38)',
                                                    pointerEvents: 'none',
                                                }} />
                                            )}
                                            {/* Move hint — empty square */}
                                            {isPossible && !isCapture && (
                                                <div style={{
                                                    width: SQ * 0.3, height: SQ * 0.3,
                                                    borderRadius: '50%',
                                                    backgroundColor: 'rgba(0,0,0,0.22)',
                                                    pointerEvents: 'none',
                                                }} />
                                            )}
                                            {/* Move hint — capture square: ring */}
                                            {isCapture && (
                                                <div style={{
                                                    position: 'absolute', inset: 0,
                                                    borderRadius: '50%',
                                                    boxShadow: '0 0 0 5px rgba(0,0,0,0.28) inset',
                                                    pointerEvents: 'none',
                                                }} />
                                            )}
                                            {piece && (
                                                <span
                                                    key={isLanding ? moveCount : undefined}
                                                    className={`piece-span${isLanding ? ' piece-land' : ''}`}
                                                    onMouseDown={(e) => handlePieceMouseDown(e, square, piece)}
                                                    style={{
                                                        zIndex: 1,
                                                        cursor: 'grab',
                                                        opacity: dragState?.square === square ? 0.15 : 1,
                                                        ...(piece.color === 'w' ? activeSkin.whiteStyle : activeSkin.blackStyle),
                                                    }}
                                                >
                                                    {pieceSymbols[piece.color === 'b' ? piece.type : piece.type.toUpperCase()]}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* File labels (a→h), offset by rank column width */}
                    <div style={{ display: 'flex', marginLeft: COORD }}>
                        {FILES.map((f) => (
                            <div
                                key={f}
                                style={{ width: SQ, height: COORD, display: 'flex', alignItems: 'center', justifyContent: 'center', ...coordStyle }}
                            >
                                {f}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Board theme picker */}
                <div className="flex flex-col items-center gap-3">
                    <span className="text-xs uppercase tracking-widest" style={{ color: '#555' }}>Board Style</span>
                    <div className="flex gap-3">
                        {BOARD_THEMES.map((t) => {
                            const isActive = theme.id === t.id;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setTheme(t)}
                                    title={t.name}
                                    style={{
                                        padding: 2,
                                        borderRadius: 4,
                                        border: isActive ? '2px solid #bcfe00' : '2px solid transparent',
                                        transition: 'border-color 0.15s',
                                        cursor: 'pointer',
                                        background: 'none',
                                    }}
                                >
                                    {/* 2×2 checkerboard swatch */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: 28, height: 28, borderRadius: 2, overflow: 'hidden' }}>
                                        <div style={{ backgroundColor: t.light }} />
                                        <div style={{ backgroundColor: t.dark }} />
                                        <div style={{ backgroundColor: t.dark }} />
                                        <div style={{ backgroundColor: t.light }} />
                                    </div>
                                    <p className="text-center mt-1" style={{ fontSize: 9, color: isActive ? '#bcfe00' : '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {t.name}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Piece skin selector */}
                <div className="flex flex-col items-center gap-3">
                    <span className="text-xs uppercase tracking-widest" style={{ color: '#555' }}>Piece Skin</span>
                    <div className="flex gap-3">
                        {PIECE_SKINS.map((skin) => {
                            const owned = skin.price === null || purchasedSkins.includes(skin.id);
                            const isActive = activeSkin.id === skin.id;
                            return (
                                <button
                                    key={skin.id}
                                    onClick={() => owned && setActiveSkin(skin)}
                                    title={owned ? skin.name : `${skin.name} — $${skin.price?.toFixed(2)} (unlock in Pro)`}
                                    style={{
                                        padding: 2,
                                        borderRadius: 4,
                                        border: isActive ? '2px solid #bcfe00' : '2px solid transparent',
                                        transition: 'border-color 0.15s',
                                        cursor: owned ? 'pointer' : 'not-allowed',
                                        background: 'none',
                                        opacity: owned ? 1 : 0.35,
                                    }}
                                >
                                    <div style={{
                                        width: 28, height: 28,
                                        backgroundColor: '#191919',
                                        borderRadius: 2,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 20,
                                        ...skin.whiteStyle,
                                    }}>
                                        ♔
                                    </div>
                                    <p className="text-center mt-1" style={{ fontSize: 9, color: isActive ? '#bcfe00' : '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {skin.price === null ? skin.name : owned ? skin.name : '🔒'}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 flex-wrap justify-center">
                    <button
                        onClick={resetGame}
                        className="px-5 py-2.5 text-xs uppercase tracking-widest rounded-sm font-bold transition-all active:scale-[0.97] hover:brightness-110"
                        style={{ backgroundColor: '#bcfe00', color: '#000' }}
                    >
                        New Game
                    </button>
                    <button
                        onClick={askCoach}
                        disabled={coachLoading || isOver}
                        className="px-5 py-2.5 text-xs uppercase tracking-widest rounded-sm font-medium transition-all active:scale-[0.97] border disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                        style={{ backgroundColor: '#191919', color: '#adacac', borderColor: '#282828' }}
                        onMouseEnter={e => { if (!coachLoading && !isOver) { (e.currentTarget as HTMLButtonElement).style.borderColor = '#bcfe00'; (e.currentTarget as HTMLButtonElement).style.color = '#bcfe00'; } }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#282828'; (e.currentTarget as HTMLButtonElement).style.color = '#adacac'; }}
                    >
                        {coachLoading && <div className="spinner" style={{ width: 14, height: 14 }} />}
                        {coachLoading ? 'Thinking…' : 'Ask Coach'}
                    </button>
                    {isOver && (
                        <button
                            onClick={analyzeGame}
                            disabled={analysisLoading}
                            className="px-5 py-2.5 text-xs uppercase tracking-widest rounded-sm font-medium transition-all active:scale-[0.97] border disabled:opacity-40 flex items-center gap-2"
                            style={{ backgroundColor: '#191900', color: '#bcfe00', borderColor: '#bcfe00' }}
                        >
                            {analysisLoading && <div className="spinner" style={{ width: 14, height: 14 }} />}
                            {analysisLoading ? 'Analyzing…' : 'Analyze Game'}
                        </button>
                    )}
                </div>

                {/* Coach panel */}
                {coachAdvice && (
                    <div
                        className="w-full max-w-lg rounded-sm p-5 text-sm whitespace-pre-wrap animate-slide-up border"
                        style={{ backgroundColor: '#0d0d0d', borderColor: '#282828', color: '#d4d4d4' }}
                    >
                        <p className="text-xs uppercase tracking-widest mb-3 font-medium" style={{ color: '#bcfe00' }}>
                            Coach says
                        </p>
                        {coachAdvice}
                    </div>
                )}

                {/* Analysis panel */}
                {(analysis || analysisLoading) && (
                    <div
                        className="w-full max-w-lg rounded-sm p-5 text-sm whitespace-pre-wrap animate-slide-up border"
                        style={{ backgroundColor: '#0d0d0d', borderColor: '#bcfe00', color: '#d4d4d4' }}
                    >
                        <p className="text-xs uppercase tracking-widest mb-3 font-medium" style={{ color: '#bcfe00' }}>
                            Post-Game Analysis
                        </p>
                        {analysisLoading && !analysis && (
                            <p style={{ color: '#555' }} className="italic">Reviewing your game…</p>
                        )}
                        {analysis}
                    </div>
                )}
            </div>
        </div>
    );
}
