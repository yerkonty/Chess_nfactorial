"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { type Square, type Piece } from "chess.js";
import { databases } from "@/lib/appwrite";
import { ID } from "appwrite";
import ProModal from "./ProModal";
import { PIECE_SKINS, type PieceSkin } from "@/lib/skins";
import { playMove, playCapture, playCheck, playGameOver } from "@/lib/sounds";
import { playMemeMove, playMemeCapture, playMemeCheck, playMemeGameOver, playMemeCaptureQueen, playMemeEnPassant, preloadMemeSounds, stopMemeSound } from "@/lib/memeSounds";
import { getBestMove, difficultyToDepth } from "@/lib/chessAI";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_GAMES_COLLECTION_ID!;

const pieceSymbols: { [key: string]: string } = {
    p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔",
    P: "♟", R: "♜", N: "♞", B: "♝", Q: "♛", K: "♚",
};

type GameMode = "player-vs-player" | "player-vs-ai";

type BoardTheme = { id: string; name: string; light: string; dark: string; selectedBg: string; labelColor: string };

const BOARD_THEMES: BoardTheme[] = [
    { id: 'classic', name: 'Classic', light: '#eeeed2', dark: '#769656', selectedBg: '#f6f669', labelColor: '#5d8040' },
    { id: 'walnut', name: 'Walnut', light: '#f0d9b5', dark: '#b58863', selectedBg: '#f6f669', labelColor: '#8a6040' },
    { id: 'ice', name: 'Ice', light: '#dce9f5', dark: '#6d9bc3', selectedBg: '#f6f669', labelColor: '#5078a0' },
    { id: 'midnight', name: 'Midnight', light: '#5c5c5c', dark: '#2e2e2e', selectedBg: '#D4722A', labelColor: '#888888' },
    { id: 'neon', name: 'Neon', light: '#d6f57a', dark: '#4a7832', selectedBg: '#fff176', labelColor: '#6aab30' },
];

const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const SQ = 56;
const COORD = 20;

const C = {
    bg: '#FEF9F0',
    card: '#FFFDF9',
    cardAlt: '#F7EDDA',
    accent: '#D4722A',
    accentHover: '#E8903F',
    accentDark: '#B85E1A',
    text: '#4A2C0A',
    muted: '#A07650',
    faint: '#C8A882',
    border: '#E8D9A8',
    borderStrong: '#C8A882',
    shadow: '#C8A882',
    highlight: '#FFF4E6',
};

const mcBtn = (active = false, size: 'sm' | 'md' | 'lg' = 'md') => ({
    border: `1.5px solid ${active ? C.accentDark : C.borderStrong}`,
    boxShadow: active
        ? `1px 1px 0 ${C.accentDark}`
        : `${size === 'sm' ? 2 : size === 'lg' ? 4 : 3}px ${size === 'sm' ? 2 : size === 'lg' ? 4 : 3}px 0 ${C.shadow}`,
    transform: active ? 'translate(2px,2px)' : undefined,
    borderRadius: 0,
    cursor: 'pointer',
    transition: 'transform 0.08s ease, box-shadow 0.08s ease',
    fontFamily: 'inherit',
    fontWeight: 800,
    fontSize: size === 'sm' ? 11 : size === 'lg' ? 15 : 13,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
});

export default function Chessboard({
    userId, userName, purchasedSkins, onSkinPurchased,
}: {
    userId: string; userName: string; purchasedSkins: string[]; onSkinPurchased: (skinId: string) => void;
}) {
    const router = useRouter();
    const [game, setGame] = useState<Chess>(new Chess());
    const [board, setBoard] = useState<(Piece | null)[][]>(game.board());
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
    const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
    const [status, setStatus] = useState("White to move");
    const [gameMode, setGameMode] = useState<GameMode>("player-vs-player");
    const [aiLevel, setAiLevel] = useState(5);
    const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
    const [aiThinking, setAiThinking] = useState(false);
    const [theme, setTheme] = useState<BoardTheme>(BOARD_THEMES[0]);
    const [coachAdvice, setCoachAdvice] = useState("");
    const [coachLoading, setCoachLoading] = useState(false);
    const [analysis, setAnalysis] = useState("");
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [gameResult, setGameResult] = useState("");
    const [showPro, setShowPro] = useState(false);
    const [activeSkin, setActiveSkin] = useState<PieceSkin>(PIECE_SKINS[0]);
    const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
    const [moveCount, setMoveCount] = useState(0);
    const [dragState, setDragState] = useState<{ square: Square; piece: Piece; x: number; y: number } | null>(null);
    const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square } | null>(null);
    const [memeMode, setMemeMode] = useState(false);
    const [memeComment, setMemeComment] = useState('');
    const [memeLoading, setMemeLoading] = useState(false);
    const gameRef = useRef(game);

    // Clock
    const [clockEnabled, setClockEnabled] = useState(0);
    const [wClockDisplay, setWClockDisplay] = useState(0);
    const [bClockDisplay, setBClockDisplay] = useState(0);
    const [clockTurn, setClockTurn] = useState<'w' | 'b'>('w');
    const clockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const whiteSecRef = useRef(0);
    const blackSecRef = useRef(0);
    const clockStartedRef = useRef(false);
    const clockTurnRef = useRef<'w' | 'b'>('w');
    const clockEnabledRef = useRef(0);
    const [clockRunning, setClockRunning] = useState(false);
    const gameSavedRef = useRef(false);

    // Board orientation & AI
    const playerColorRef = useRef<'w' | 'b'>('w');
    const boardFlippedRef = useRef(false);
    const aiAbortRef = useRef<{ cancelled: boolean }>({ cancelled: false });

    // Move history navigation
    const [viewIndex, setViewIndex] = useState<number | null>(null);
    const [historyBoard, setHistoryBoard] = useState<(Piece | null)[][] | null>(null);
    const [historyLastMove, setHistoryLastMove] = useState<{ from: Square; to: Square } | null>(null);

    // Drag refs
    const boardRef = useRef<HTMLDivElement | null>(null);
    const potentialDrag = useRef<{ square: Square; piece: Piece; startX: number; startY: number } | null>(null);
    const isDraggingRef = useRef(false);
    const justDragged = useRef(false);
    const startClockRef = useRef<() => void>(() => undefined);
    const updateStatusRef = useRef<() => void>(() => undefined);
    const maybeTriggerAiMoveRef = useRef<(activeGame: Chess) => void>(() => undefined);
    const fetchMemeRef = useRef<(move: { san: string; piece: string; captured?: string; flags: string; color: string }, isMate: boolean, isCheck: boolean) => void>(() => undefined);
    const memeModeRef = useRef(false);

    function formatClock(secs: number): string {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function goToMoveIndex(index: number, moves: Array<{ from: string; to: string; san: string }>) {
        const tmp = new Chess();
        for (let i = 0; i <= index; i++) tmp.move(moves[i].san);
        setHistoryBoard(tmp.board());
        setHistoryLastMove({ from: moves[index].from as Square, to: moves[index].to as Square });
    }

    const saveGame = useCallback(async (result: string) => {
        try {
            await databases.createDocument(DATABASE_ID, COLLECTION_ID, ID.unique(), {
                userId, userName, result, mode: gameMode, pgn: game.pgn(),
            });
        } catch (e) { console.error("Failed to save game:", e); }
    }, [game, gameMode, userId, userName]);

    const stopClock = useCallback(() => {
        if (clockIntervalRef.current) { clearInterval(clockIntervalRef.current); clockIntervalRef.current = null; }
        clockStartedRef.current = false;
        setClockRunning(false);
    }, []);

    const updateStatus = useCallback(() => {
        let newStatus = `${game.turn() === "w" ? "White" : "Black"} to move`;
        if (game.isCheckmate()) {
            const winner = game.turn() === "w" ? "Black" : "White";
            newStatus = `Checkmate — ${winner} wins!`;
            setGameResult(`${winner} wins`);
            stopClock();
            if (!gameSavedRef.current) { gameSavedRef.current = true; saveGame(`${winner} wins`); }
        } else if (game.isDraw()) {
            newStatus = "Game drawn.";
            setGameResult("Draw");
            stopClock();
            if (!gameSavedRef.current) { gameSavedRef.current = true; saveGame("draw"); }
        } else if (game.inCheck()) {
            newStatus = `Check! ${game.turn() === "w" ? "White" : "Black"} to move`;
        }
        setStatus(newStatus);
    }, [game, saveGame, stopClock]);

    const startClock = useCallback(() => {
        if (clockEnabledRef.current === 0 || clockStartedRef.current || game.isGameOver()) return;
        clockStartedRef.current = true;
        setClockRunning(true);
        clockIntervalRef.current = setInterval(() => {
            if (clockTurnRef.current === 'w') {
                whiteSecRef.current = Math.max(0, whiteSecRef.current - 1);
                setWClockDisplay(whiteSecRef.current);
                if (whiteSecRef.current === 0) {
                    clearInterval(clockIntervalRef.current!);
                    clockIntervalRef.current = null;
                    clockStartedRef.current = false;
                    setClockRunning(false);
                    setGameResult('Black wins');
                    setStatus('Time out — Black wins!');
                    if (!gameSavedRef.current) { gameSavedRef.current = true; saveGame('Black wins'); }
                }
            } else {
                blackSecRef.current = Math.max(0, blackSecRef.current - 1);
                setBClockDisplay(blackSecRef.current);
                if (blackSecRef.current === 0) {
                    clearInterval(clockIntervalRef.current!);
                    clockIntervalRef.current = null;
                    clockStartedRef.current = false;
                    setClockRunning(false);
                    setGameResult('White wins');
                    setStatus('Time out — White wins!');
                    if (!gameSavedRef.current) { gameSavedRef.current = true; saveGame('White wins'); }
                }
            }
        }, 1000);
    }, [game, saveGame]);

    function setClockEnabledAndReset(val: number) {
        clockEnabledRef.current = val;
        whiteSecRef.current = val;
        blackSecRef.current = val;
        setWClockDisplay(val);
        setBClockDisplay(val);
        stopClock();
        clockTurnRef.current = 'w';
        setClockTurn('w');
        setClockEnabled(val);
    }

    function cancelAiThinking() {
        aiAbortRef.current.cancelled = true;
        aiAbortRef.current = { cancelled: false };
        setAiThinking(false);
    }

    const startAiMove = useCallback((activeGame: Chess) => {
        aiAbortRef.current.cancelled = true;
        const ctrl = { cancelled: false };
        aiAbortRef.current = ctrl;
        setAiThinking(true);

        const fen = activeGame.fen();
        const depth = difficultyToDepth(aiLevel);

        setTimeout(() => {
            if (ctrl.cancelled) return;
            const mv = getBestMove(activeGame, depth);
            if (!mv || ctrl.cancelled) { setAiThinking(false); return; }

            const from = mv.slice(0, 2) as Square;
            const to = mv.slice(2, 4) as Square;
            const promo = mv.length === 5 ? mv[4] as 'q' | 'r' | 'b' | 'n' : undefined;

            // Guard: FEN must still match (player hasn't reset mid-think)
            if (activeGame.fen() !== fen) { setAiThinking(false); return; }

            const aiMove = activeGame.move({ from, to, promotion: promo });
            if (!aiMove) { setAiThinking(false); return; }

            setBoard(activeGame.board());
            setLastMove({ from, to });
            setMoveCount(c => c + 1);
            setViewIndex(null); setHistoryBoard(null); setHistoryLastMove(null);
            clockTurnRef.current = activeGame.turn() as 'w' | 'b';
            setClockTurn(activeGame.turn() as 'w' | 'b');
            startClock();
            setAiThinking(false);
            updateStatus();
            const aiMate = activeGame.isCheckmate();
            const aiChk = activeGame.inCheck();
            if (memeMode) stopMemeSound();
            if (activeGame.isGameOver()) { memeMode ? playMemeGameOver(!aiMate) : playGameOver(); }
            else if (aiChk) { memeMode ? playMemeCheck() : playCheck(); }
            else if (aiMove.captured) {
                if (memeMode) { aiMove.captured === 'q' ? playMemeCaptureQueen() : playMemeCapture(); }
                else playCapture();
            } else if (memeMode && aiMove.flags.includes('e')) { playMemeEnPassant(); }
            else { memeMode ? playMemeMove() : playMove(); }
            fetchMeme(aiMove as { san: string; piece: string; captured?: string; flags: string; color: string }, aiMate, aiChk);
        }, 50); // yield so "AI thinking…" renders first
    }, [aiLevel, startClock, updateStatus]);

    const maybeTriggerAiMove = useCallback((activeGame: Chess, modeOverride?: GameMode) => {
        const mode = modeOverride ?? gameMode;
        if (mode !== 'player-vs-ai' || activeGame.isGameOver() || activeGame.turn() === playerColorRef.current) return;
        startAiMove(activeGame);
    }, [gameMode, startAiMove]);

    useEffect(() => {
        gameRef.current = game;
    }, [game]);

    useEffect(() => {
        return () => {
            if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
        };
    }, []);

    useEffect(() => {
        startClockRef.current = startClock;
        updateStatusRef.current = updateStatus;
        maybeTriggerAiMoveRef.current = maybeTriggerAiMove;
        fetchMemeRef.current = fetchMeme;
        memeModeRef.current = memeMode;
    });

    // Drag handlers
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
                        const dFiles = boardFlippedRef.current ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : FILES;
                        const dRanks = boardFlippedRef.current ? [1, 2, 3, 4, 5, 6, 7, 8] : RANKS;
                        const toSquare = (dFiles[col] + dRanks[row]) as Square;
                        const from = potentialDrag.current.square;
                        if (toSquare !== from) {
                            const activeGame = gameRef.current;
                            const movingPiece = activeGame.get(from);
                            const isPromo = movingPiece?.type === 'p' && (toSquare[1] === '8' || toSquare[1] === '1');
                            if (isPromo) {
                                const legal = activeGame.moves({ square: from, verbose: true });
                                if (legal.some((m: { to: string }) => m.to === toSquare)) {
                                    setPromotionPending({ from, to: toSquare });
                                    setSelectedSquare(null); setPossibleMoves([]);
                                }
                            } else {
                                try {
                                    const move = activeGame.move({ from, to: toSquare, promotion: 'q' });
                                    if (move) {
                                        setBoard(activeGame.board()); setLastMove({ from, to: toSquare });
                                        setMoveCount(c => c + 1);
                                        setViewIndex(null); setHistoryBoard(null); setHistoryLastMove(null);
                                        clockTurnRef.current = activeGame.turn() as 'w' | 'b';
                                        setClockTurn(activeGame.turn() as 'w' | 'b');
                                        startClockRef.current(); updateStatusRef.current();
                                        const dMate = activeGame.isCheckmate();
                                        const dChk = activeGame.inCheck();
                                        const dMeme = memeModeRef.current;
                                        if (dMeme) stopMemeSound();
                                        if (activeGame.isGameOver()) { dMeme ? playMemeGameOver(!dMate) : playGameOver(); }
                                        else if (dChk) { dMeme ? playMemeCheck() : playCheck(); }
                                        else if (move.captured) {
                                            if (dMeme) { move.captured === 'q' ? playMemeCaptureQueen() : playMemeCapture(); }
                                            else playCapture();
                                        } else if (dMeme && move.flags.includes('e')) { playMemeEnPassant(); }
                                        else { dMeme ? playMemeMove() : playMove(); }
                                        fetchMemeRef.current(move as { san: string; piece: string; captured?: string; flags: string; color: string }, dMate, dChk);
                                        maybeTriggerAiMoveRef.current(activeGame);
                                    }
                                } catch { /* invalid drop */ }
                            }
                        }
                    }
                }
                setSelectedSquare(null); setPossibleMoves([]);
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
    }, []);

    // Keyboard history navigation
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                const moves = gameRef.current.history({ verbose: true });
                setViewIndex(prev => {
                    const next = prev === null ? moves.length - 2 : Math.max(0, prev - 1);
                    if (next < 0) { setHistoryBoard(null); setHistoryLastMove(null); return null; }
                    goToMoveIndex(next, moves);
                    return next;
                });
            } else if (e.key === 'ArrowRight') {
                const moves = gameRef.current.history({ verbose: true });
                setViewIndex(prev => {
                    if (prev === null) return null;
                    if (prev >= moves.length - 1) { setHistoryBoard(null); setHistoryLastMove(null); return null; }
                    const next = prev + 1;
                    goToMoveIndex(next, moves);
                    return next;
                });
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [moveCount]);

    function handlePieceMouseDown(e: React.MouseEvent, square: Square, piece: Piece) {
        if (game.isGameOver() || (gameMode === 'player-vs-ai' && game.turn() !== playerColor)) return;
        if (piece.color !== game.turn()) return;
        e.preventDefault();
        potentialDrag.current = { square, piece, startX: e.clientX, startY: e.clientY };
        const moves = game.moves({ square, verbose: true });
        if (moves.length > 0) { setSelectedSquare(square); setPossibleMoves(moves.map(m => m.to)); }
    }

    function onSquareClick(square: Square) {
        if (justDragged.current) { justDragged.current = false; return; }
        if (promotionPending) return;
        if (viewIndex !== null) { setViewIndex(null); setHistoryBoard(null); setHistoryLastMove(null); return; }
        if (game.isGameOver() || (gameMode === 'player-vs-ai' && game.turn() !== playerColor)) return;

        if (selectedSquare) {
            const from = selectedSquare;
            const legalDests = game.moves({ square: from, verbose: true }).map(m => m.to);
            if (legalDests.includes(square)) {
                if (isPawnPromotion(from, square)) setPromotionPending({ from, to: square });
                else applyMove(from, square);
            }
            setSelectedSquare(null); setPossibleMoves([]);
        } else {
            const moves = game.moves({ square, verbose: true });
            if (moves.length > 0 && game.get(square)?.color === game.turn()) {
                setSelectedSquare(square);
                setPossibleMoves(moves.map(m => m.to));
            }
        }
    }

    async function askCoach() {
        setCoachLoading(true); setCoachAdvice("");
        try {
            const res = await fetch("/api/coach", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fen: game.fen(), turn: game.turn(), pgn: game.pgn() }),
            });
            if (!res.body) return;
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                setCoachAdvice(prev => prev + decoder.decode(value));
            }
        } catch { setCoachAdvice("Coach unavailable. Check your API key."); }
        finally { setCoachLoading(false); }
    }

    async function analyzeGame() {
        setAnalysisLoading(true); setAnalysis("");
        try {
            const res = await fetch("/api/analyze", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pgn: game.pgn(), result: gameResult }),
            });
            if (!res.body) return;
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                setAnalysis(prev => prev + decoder.decode(value));
            }
        } catch { setAnalysis("Analysis unavailable. Check your API key."); }
        finally { setAnalysisLoading(false); }
    }

    function fetchMeme(move: { san: string; piece: string; captured?: string; flags: string; color: string }, afterMate: boolean, afterCheck: boolean) {
        if (!memeMode) return;
        setMemeLoading(true);
        fetch('/api/meme', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                san: move.san,
                piece: move.piece,
                captured: move.captured ?? null,
                flags: move.flags,
                isCheck: afterCheck,
                isMate: afterMate,
                moveColor: move.color,
            }),
        })
            .then(r => r.json())
            .then(d => { setMemeComment(d.comment ?? '💀'); })
            .catch(() => { setMemeComment('💀 bro really said that move fr fr'); })
            .finally(() => setMemeLoading(false));
    }

    function isPawnPromotion(from: Square, to: Square) {
        const p = game.get(from);
        return p?.type === 'p' && (to[1] === '8' || to[1] === '1');
    }

    function applyMove(from: Square, to: Square, promotion: 'q' | 'r' | 'b' | 'n' = 'q') {
        if (memeMode) stopMemeSound();
        try {
            const move = game.move({ from, to, promotion });
            if (move) {
                setBoard(game.board()); setLastMove({ from, to });
                setMoveCount(c => c + 1);
                setViewIndex(null); setHistoryBoard(null); setHistoryLastMove(null);
                clockTurnRef.current = game.turn() as 'w' | 'b';
                setClockTurn(game.turn() as 'w' | 'b');
                startClock(); updateStatus();
                const isMate = game.isCheckmate();
                const isChk = game.inCheck();
                if (game.isGameOver()) { memeMode ? playMemeGameOver(!isMate) : playGameOver(); }
                else if (isChk) { memeMode ? playMemeCheck() : playCheck(); }
                else if (move.captured) {
                    if (memeMode) { move.captured === 'q' ? playMemeCaptureQueen() : playMemeCapture(); }
                    else playCapture();
                } else if (memeMode && move.flags.includes('e')) { playMemeEnPassant(); }
                else { memeMode ? playMemeMove() : playMove(); }
                fetchMeme(move as { san: string; piece: string; captured?: string; flags: string; color: string }, isMate, isChk);
                maybeTriggerAiMove(game);
            }
        } catch { /* invalid */ }
    }

    function completePromotion(piece: 'q' | 'r' | 'b' | 'n') {
        if (!promotionPending) return;
        const { from, to } = promotionPending;
        setPromotionPending(null);
        applyMove(from, to, piece);
    }

    function selectColor(color: 'w' | 'b') {
        playerColorRef.current = color;
        boardFlippedRef.current = color === 'b';
        setPlayerColor(color);
        resetGame();
    }

    function handleGameModeChange(mode: GameMode) {
        if (mode === gameMode) return;
        cancelAiThinking();
        setGameMode(mode);
        maybeTriggerAiMove(game, mode);
    }

    function resetGame() {
        cancelAiThinking();
        const newGame = new Chess();
        setGame(newGame); setBoard(newGame.board());
        setSelectedSquare(null); setPossibleMoves([]);
        setLastMove(null); setPromotionPending(null);
        setAnalysis(""); setGameResult(""); setCoachAdvice(""); setMemeComment("");
        setViewIndex(null); setHistoryBoard(null); setHistoryLastMove(null);
        setAiThinking(false);
        gameSavedRef.current = false;
        stopClock();
        whiteSecRef.current = clockEnabledRef.current;
        blackSecRef.current = clockEnabledRef.current;
        setWClockDisplay(clockEnabledRef.current);
        setBClockDisplay(clockEnabledRef.current);
        clockTurnRef.current = 'w';
        setClockTurn('w');
        setStatus("White to move");
        maybeTriggerAiMove(newGame);
    }

    async function buySkin(skinId: string) {
        try {
            const res = await fetch('/api/stripe/checkout', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ skinId, userId }),
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else alert(`Checkout error: ${data.error || JSON.stringify(data)}`);
        } catch (e) { alert(`Network error: ${e}`); }
    }

    const isOver = game.isGameOver();
    const flipped = playerColor === 'b';
    const displayRanks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : RANKS;
    const displayFiles = flipped ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : FILES;
    const rawBoard = historyBoard ?? board;
    const displayBoard = flipped
        ? rawBoard.slice().reverse().map(row => row.slice().reverse())
        : rawBoard;
    const displayLastMove = historyLastMove ?? lastMove;
    const moves = game.history({ verbose: true }) as Array<{ from: string; to: string; san: string }>;
    const coordStyle = { color: theme.labelColor, fontSize: 11, fontWeight: 700, lineHeight: 1, userSelect: 'none' as const };

    const kingInCheckSq: Square | null = game.inCheck() ? (() => {
        const turn = game.turn();
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const sq = (FILES[c] + RANKS[r]) as Square;
            const p = game.get(sq);
            if (p?.type === 'k' && p.color === turn) return sq;
        }
        return null;
    })() : null;

    const PROMO_PIECES = [
        { key: 'q' as const, label: 'Queen' }, { key: 'r' as const, label: 'Rook' },
        { key: 'b' as const, label: 'Bishop' }, { key: 'n' as const, label: 'Knight' },
    ];

    return (
        <div className="min-h-screen" style={{
            background: memeMode ? `url('/memes-everywhere.jpg') center/cover fixed` : C.bg,
            color: C.text,
            transition: 'background 0.3s ease',
        }}>

            {/* Floating drag piece */}
            {dragState && (
                <div style={{
                    position: 'fixed', left: dragState.x - SQ * 0.6, top: dragState.y - SQ * 0.6,
                    width: SQ * 1.2, height: SQ * 1.2, fontSize: SQ * 0.9,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none', zIndex: 9999, lineHeight: 1,
                    filter: 'drop-shadow(0 8px 20px rgba(74,44,10,0.4))', transform: 'scale(1.18)',
                    ...(dragState.piece.color === 'w' ? activeSkin.whiteStyle : activeSkin.blackStyle),
                }}>
                    {pieceSymbols[dragState.piece.color === 'b' ? dragState.piece.type : dragState.piece.type.toUpperCase()]}
                </div>
            )}

            {/* Promotion dialog */}
            {promotionPending && (
                <div className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(74,44,10,0.55)', backdropFilter: 'blur(3px)' }}>
                    <div className="animate-slide-up" style={{ background: C.card, border: `1.5px solid ${C.borderStrong}`, boxShadow: `6px 6px 0 ${C.shadow}` }}>
                        <p className="text-xs font-black uppercase tracking-widest px-6 pt-5 pb-4" style={{ color: C.muted }}>
                            Promote pawn to
                        </p>
                        <div className="flex gap-2 px-5 pb-5">
                            {PROMO_PIECES.map(({ key, label }) => {
                                const color = game.turn();
                                const symbol = pieceSymbols[color === 'w' ? key.toUpperCase() : key];
                                return (
                                    <button key={key} onClick={() => completePromotion(key)} title={label}
                                        className="flex flex-col items-center gap-1"
                                        style={{ width: 60, height: 72, background: C.cardAlt, border: `1.5px solid ${C.borderStrong}`, boxShadow: `2px 2px 0 ${C.shadow}`, fontSize: 36, cursor: 'pointer', transition: 'border-color 0.08s' }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.borderStrong; }}>
                                        <span className="mt-2" style={color === 'w' ? activeSkin.whiteStyle : activeSkin.blackStyle}>{symbol}</span>
                                        <span style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {showPro && (
                <ProModal onClose={() => setShowPro(false)} purchasedSkins={purchasedSkins}
                    onBuySkin={async (skinId) => { await buySkin(skinId); onSkinPurchased(skinId); }} />
            )}

            {/* Nav */}
            <nav style={{ background: memeMode ? 'rgba(255,253,249,0.92)' : C.card, borderBottom: `1.5px solid ${C.border}`, backdropFilter: memeMode ? 'blur(6px)' : 'none' }}
                className="px-6 py-3 flex items-center justify-between">
                <span className="text-xl font-black tracking-tight" style={{ color: C.text }}>
                    Y<span style={{ color: C.accent }}>Chess</span>
                </span>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowPro(true)} className="text-xs px-4 py-2"
                        style={{ ...mcBtn(false, 'sm'), background: C.accent, color: '#FFFDF9', borderColor: C.accentDark, boxShadow: `2px 2px 0 ${C.accentDark}` }}
                        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = C.accentHover}
                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = C.accent}
                        onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translate(2px,2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = `1px 1px 0 ${C.accentDark}`; }}
                        onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = `2px 2px 0 ${C.accentDark}`; }}>
                        ⚡ Go Pro
                    </button>
                    {[{ label: 'Multiplayer', path: '/play' }, { label: 'Leaderboard', path: '/leaderboard' }, { label: 'Profile', path: '/profile' }].map(({ label, path }) => (
                        <button key={path} onClick={() => router.push(path)} className="text-xs px-4 py-2"
                            style={{ ...mcBtn(false, 'sm'), background: C.card, color: C.muted }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.accent; (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.muted; (e.currentTarget as HTMLButtonElement).style.borderColor = C.borderStrong; }}
                            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translate(1px,1px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = `1px 1px 0 ${C.shadow}`; }}
                            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = `2px 2px 0 ${C.shadow}`; }}>
                            {label}
                        </button>
                    ))}
                </div>
            </nav>

            <div className="flex flex-col items-center py-8 px-4 gap-5" style={memeMode ? { position: 'relative' } : undefined}>

                {/* Mode selector */}
                <div className="flex" style={{ border: `1.5px solid ${C.borderStrong}` }}>
                    {([{ mode: 'player-vs-player', label: 'vs Player' }, { mode: 'player-vs-ai', label: 'vs AI' }] as const).map(({ mode, label }, i) => {
                        const active = gameMode === mode;
                        return (
                            <button key={mode} onClick={() => handleGameModeChange(mode)}
                                className="px-5 py-2 text-xs font-black uppercase tracking-widest"
                                style={{ background: active ? C.accent : C.card, color: active ? '#FFFDF9' : C.muted, borderRight: i === 0 ? `1.5px solid ${C.borderStrong}` : 'none', cursor: 'pointer', transition: 'background 0.1s', fontFamily: 'inherit' }}>
                                {label}
                            </button>
                        );
                    })}
                </div>

                {/* AI controls */}
                {gameMode === 'player-vs-ai' && (
                    <div className="flex flex-col items-center gap-3">
                        {/* Color picker */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase tracking-widest" style={{ color: C.faint }}>Play as</span>
                            {([{ color: 'w' as const, label: 'White', sym: '♔' }, { color: 'b' as const, label: 'Black', sym: '♚' }]).map(({ color, label, sym }) => (
                                <button key={color} onClick={() => selectColor(color)}
                                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-black uppercase tracking-widest"
                                    style={{ ...mcBtn(playerColor === color, 'sm'), background: playerColor === color ? C.accent : C.card, color: playerColor === color ? '#FFFDF9' : C.muted }}>
                                    <span style={{ fontSize: 16 }}>{sym}</span>{label}
                                </button>
                            ))}
                        </div>
                        {/* Difficulty */}
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-black uppercase tracking-widest" style={{ color: C.muted }}>Difficulty</span>
                            <input type="range" min="1" max="20" value={aiLevel}
                                onChange={e => setAiLevel(parseInt(e.target.value))}
                                className="w-36" style={{ accentColor: C.accent }} />
                            <span className="w-6 text-center text-sm font-black" style={{ color: C.accent }}>{aiLevel}</span>
                        </div>
                    </div>
                )}

                {/* Status */}
                <div className="text-sm font-black uppercase tracking-widest px-5 py-2"
                    style={{ background: isOver ? C.highlight : C.card, color: isOver ? C.accent : C.muted, border: `1.5px solid ${isOver ? C.accent : C.border}`, boxShadow: `2px 2px 0 ${C.shadow}` }}>
                    {status}
                </div>

                {/* AI thinking — always rendered to prevent layout shift */}
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest"
                    style={{ color: C.muted, visibility: aiThinking ? 'visible' : 'hidden', height: 20 }}>
                    <div className="spinner" style={{ width: 12, height: 12 }} />
                    AI is thinking…
                </div>

                {/* Clocks + Board */}
                <div className="flex flex-col items-center gap-2">

                    {/* Black clock */}
                    {clockEnabled > 0 && (
                        <div className="flex items-center justify-between px-4 py-2 w-full"
                            style={{ background: clockRunning && clockTurn === 'b' && !isOver ? C.highlight : C.card, border: `1.5px solid ${clockRunning && clockTurn === 'b' && !isOver ? C.accent : C.border}`, boxShadow: `2px 2px 0 ${C.shadow}`, maxWidth: 8 * SQ + COORD }}>
                            <span className="text-xs font-black uppercase tracking-widest" style={{ color: C.muted }}>Black</span>
                            <span className="font-black tabular-nums" style={{ fontSize: 20, color: bClockDisplay <= 10 ? '#B91C1C' : clockRunning && clockTurn === 'b' && !isOver ? C.accent : C.muted }}>
                                {formatClock(bClockDisplay)}
                            </span>
                        </div>
                    )}

                    {/* Board */}
                    <div style={{ display: 'inline-flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', width: COORD }}>
                                {displayRanks.map(r => (
                                    <div key={r} style={{ height: SQ, width: COORD, display: 'flex', alignItems: 'center', justifyContent: 'center', ...coordStyle }}>{r}</div>
                                ))}
                            </div>
                            <div ref={boardRef} style={{ display: 'grid', gridTemplateColumns: `repeat(8, ${SQ}px)`, boxShadow: `5px 5px 0 ${C.shadow}`, border: `1.5px solid ${C.borderStrong}`, overflow: 'hidden' }}>
                                {displayBoard.map((row, rowIndex) =>
                                    row.map((piece, colIndex) => {
                                        const square = (displayFiles[colIndex] + displayRanks[rowIndex]) as Square;
                                        const isLight = (rowIndex + colIndex) % 2 === 0;
                                        const isSelected = viewIndex === null && selectedSquare === square;
                                        const isPossible = viewIndex === null && possibleMoves.includes(square);
                                        const isCapture = isPossible && !!piece;
                                        const isLastMoveSquare = !!displayLastMove && (square === displayLastMove.from || square === displayLastMove.to);
                                        const isLanding = !!lastMove && square === lastMove.to && viewIndex === null;
                                        const bg = isSelected ? theme.selectedBg : (isLight ? theme.light : theme.dark);

                                        return (
                                            <div key={`${rowIndex}-${colIndex}`} className="board-square" onClick={() => onSquareClick(square)}
                                                style={{ width: SQ, height: SQ, backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer', userSelect: 'none', fontSize: 36 }}>
                                                {square === kingInCheckSq && (
                                                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(255,30,30,0.7) 0%, rgba(220,0,0,0.2) 60%, transparent 100%)', pointerEvents: 'none' }} />
                                                )}
                                                {isLastMoveSquare && (
                                                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(212,114,42,0.28)', pointerEvents: 'none' }} />
                                                )}
                                                {isPossible && !isCapture && (
                                                    <div style={{ width: SQ * 0.3, height: SQ * 0.3, borderRadius: '50%', backgroundColor: 'rgba(74,44,10,0.18)', pointerEvents: 'none' }} />
                                                )}
                                                {isCapture && (
                                                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: '0 0 0 5px rgba(74,44,10,0.22) inset', pointerEvents: 'none' }} />
                                                )}
                                                {piece && (
                                                    <span key={isLanding ? moveCount : undefined}
                                                        className={`piece-span${isLanding ? ' piece-land' : ''}`}
                                                        onMouseDown={e => handlePieceMouseDown(e, square, piece)}
                                                        style={{ zIndex: 1, cursor: 'grab', opacity: dragState?.square === square ? 0.15 : 1, ...(piece.color === 'w' ? activeSkin.whiteStyle : activeSkin.blackStyle) }}>
                                                        {pieceSymbols[piece.color === 'b' ? piece.type : piece.type.toUpperCase()]}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', marginLeft: COORD }}>
                            {displayFiles.map(f => (
                                <div key={f} style={{ width: SQ, height: COORD, display: 'flex', alignItems: 'center', justifyContent: 'center', ...coordStyle }}>{f}</div>
                            ))}
                        </div>
                    </div>

                    {/* White clock */}
                    {clockEnabled > 0 && (
                        <div className="flex items-center justify-between px-4 py-2 w-full"
                            style={{ background: clockRunning && clockTurn === 'w' && !isOver ? C.highlight : C.card, border: `1.5px solid ${clockRunning && clockTurn === 'w' && !isOver ? C.accent : C.border}`, boxShadow: `2px 2px 0 ${C.shadow}`, maxWidth: 8 * SQ + COORD }}>
                            <span className="text-xs font-black uppercase tracking-widest" style={{ color: C.muted }}>White</span>
                            <span className="font-black tabular-nums" style={{ fontSize: 20, color: wClockDisplay <= 10 ? '#B91C1C' : clockRunning && clockTurn === 'w' && !isOver ? C.accent : C.muted }}>
                                {formatClock(wClockDisplay)}
                            </span>
                        </div>
                    )}

                    {/* Clock selector */}
                    <div className="flex items-center gap-2 mt-1" style={{ maxWidth: 8 * SQ + COORD }}>
                        <span className="text-xs font-black uppercase tracking-widest flex-shrink-0" style={{ color: C.faint }}>Clock</span>
                        {[{ label: 'Off', val: 0 }, { label: '1m', val: 60 }, { label: '3m', val: 180 }, { label: '5m', val: 300 }, { label: '10m', val: 600 }].map(({ label, val }) => (
                            <button key={val} onClick={() => setClockEnabledAndReset(val)}
                                className="px-3 py-1 text-xs font-bold"
                                style={{ ...mcBtn(false, 'sm'), background: clockEnabled === val ? C.accent : C.card, color: clockEnabled === val ? '#FFFDF9' : C.muted, borderColor: clockEnabled === val ? C.accentDark : C.borderStrong }}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Move history */}
                    {moves.length > 0 && (
                        <div className="flex items-center gap-2 w-full" style={{ maxWidth: 8 * SQ + COORD }}>
                            <button onClick={() => {
                                if (!moves.length) return;
                                setViewIndex(prev => {
                                    const next = prev === null ? moves.length - 2 : Math.max(0, prev - 1);
                                    if (next < 0) { setHistoryBoard(null); setHistoryLastMove(null); return null; }
                                    goToMoveIndex(next, moves); return next;
                                });
                            }} className="flex-shrink-0 w-7 h-7 flex items-center justify-center font-black"
                                style={{ ...mcBtn(false, 'sm'), background: C.card, color: C.muted, fontSize: 14 }}>◀</button>

                            <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                                <div className="flex gap-1" style={{ width: 'max-content' }}>
                                    {moves.map((m, i) => {
                                        const isActive = viewIndex === i;
                                        const isLive = viewIndex === null && i === moves.length - 1;
                                        return (
                                            <div key={i} className="flex items-center gap-0.5 flex-shrink-0">
                                                {i % 2 === 0 && <span className="text-xs px-1" style={{ color: C.faint }}>{Math.floor(i / 2) + 1}.</span>}
                                                <button onClick={() => { setViewIndex(i); goToMoveIndex(i, moves); }}
                                                    className="px-2 py-0.5 text-xs font-bold"
                                                    style={{ background: isActive || isLive ? C.accent : 'transparent', color: isActive || isLive ? '#FFFDF9' : C.muted, border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontWeight: isActive || isLive ? 800 : 400 }}>
                                                    {m.san}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <button onClick={() => {
                                if (!moves.length) return;
                                setViewIndex(prev => {
                                    if (prev === null) return null;
                                    if (prev >= moves.length - 1) { setHistoryBoard(null); setHistoryLastMove(null); return null; }
                                    const next = prev + 1; goToMoveIndex(next, moves); return next;
                                });
                            }} className="flex-shrink-0 w-7 h-7 flex items-center justify-center font-black"
                                style={{ ...mcBtn(false, 'sm'), background: C.card, color: C.muted, fontSize: 14 }}>▶</button>
                        </div>
                    )}
                </div>

                {/* Board theme picker */}
                <div className="flex flex-col items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest" style={{ color: C.faint }}>Board Style</span>
                    <div className="flex gap-3">
                        {BOARD_THEMES.map(t => {
                            const isActive = theme.id === t.id;
                            return (
                                <button key={t.id} onClick={() => setTheme(t)} title={t.name}
                                    style={{ padding: 2, border: isActive ? `2px solid ${C.accent}` : '2px solid transparent', cursor: 'pointer', background: 'none', transition: 'border-color 0.15s' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: 28, height: 28, overflow: 'hidden' }}>
                                        <div style={{ backgroundColor: t.light }} /><div style={{ backgroundColor: t.dark }} />
                                        <div style={{ backgroundColor: t.dark }} /><div style={{ backgroundColor: t.light }} />
                                    </div>
                                    <p style={{ fontSize: 9, color: isActive ? C.accent : C.faint, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', marginTop: 4 }}>{t.name}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Piece skin selector */}
                <div className="flex flex-col items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest" style={{ color: C.faint }}>Piece Skin</span>
                    <div className="flex gap-3">
                        {PIECE_SKINS.map(skin => {
                            const owned = skin.price === null || purchasedSkins.includes(skin.id);
                            const isActive = activeSkin.id === skin.id;
                            return (
                                <button key={skin.id} onClick={() => owned && setActiveSkin(skin)}
                                    title={owned ? skin.name : `${skin.name} — $${skin.price?.toFixed(2)} (unlock in Pro)`}
                                    style={{ padding: 2, border: isActive ? `2px solid ${C.accent}` : '2px solid transparent', cursor: owned ? 'pointer' : 'not-allowed', background: 'none', opacity: owned ? 1 : 0.4, transition: 'border-color 0.15s' }}>
                                    <div style={{ width: 28, height: 28, background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, ...skin.whiteStyle }}>♔</div>
                                    <p style={{ fontSize: 9, color: isActive ? C.accent : C.faint, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', marginTop: 4 }}>
                                        {skin.price === null ? skin.name : owned ? skin.name : '🔒'}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 flex-wrap justify-center">
                    <button onClick={resetGame} className="px-5 py-2.5 text-xs font-black uppercase tracking-widest"
                        style={{ ...mcBtn(false, 'md'), background: C.accent, color: '#FFFDF9', borderColor: C.accentDark, boxShadow: `3px 3px 0 ${C.accentDark}` }}
                        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = C.accentHover}
                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = C.accent}
                        onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translate(2px,2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = `1px 1px 0 ${C.accentDark}`; }}
                        onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = `3px 3px 0 ${C.accentDark}`; }}>
                        New Game
                    </button>
                    <button onClick={askCoach} disabled={coachLoading || isOver}
                        className="px-5 py-2.5 text-xs font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ ...mcBtn(false, 'md'), background: C.card, color: C.muted, borderColor: C.borderStrong }}
                        onMouseEnter={e => { if (!coachLoading && !isOver) { (e.currentTarget as HTMLButtonElement).style.color = C.accent; (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent; } }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.muted; (e.currentTarget as HTMLButtonElement).style.borderColor = C.borderStrong; }}
                        onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translate(2px,2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = `1px 1px 0 ${C.shadow}`; }}
                        onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = `3px 3px 0 ${C.shadow}`; }}>
                        {coachLoading && <div className="spinner" style={{ width: 14, height: 14 }} />}
                        {coachLoading ? 'Thinking…' : 'Ask Coach'}
                    </button>
                    <button
                        onClick={() => { setMemeMode(m => { if (!m) preloadMemeSounds(); return !m; }); setMemeComment(''); }}
                        className="px-5 py-2.5 text-xs font-black uppercase tracking-widest"
                        style={{
                            ...mcBtn(memeMode, 'md'),
                            background: memeMode ? '#1a1a1a' : C.card,
                            color: memeMode ? '#D4722A' : C.muted,
                            borderColor: memeMode ? '#D4722A' : C.borderStrong,
                            boxShadow: memeMode ? `3px 3px 0 #D4722A` : `3px 3px 0 ${C.shadow}`,
                        }}>
                        💀 Meme Mode
                    </button>
                    {isOver && (
                        <button onClick={analyzeGame} disabled={analysisLoading}
                            className="px-5 py-2.5 text-xs font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-40"
                            style={{ ...mcBtn(false, 'md'), background: C.highlight, color: C.accent, borderColor: C.accent, boxShadow: `3px 3px 0 ${C.accentDark}` }}
                            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translate(2px,2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = `1px 1px 0 ${C.accentDark}`; }}
                            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = `3px 3px 0 ${C.accentDark}`; }}>
                            {analysisLoading && <div className="spinner" style={{ width: 14, height: 14 }} />}
                            {analysisLoading ? 'Analyzing…' : 'Analyze Game'}
                        </button>
                    )}
                </div>

                {/* Meme Mode panel */}
                {memeMode && (
                    <div className="w-full max-w-lg animate-slide-up" style={{ maxWidth: 8 * SQ + COORD }}>
                        <div style={{
                            background: '#111',
                            border: '1.5px solid #D4722A',
                            boxShadow: '4px 4px 0 #B85E1A',
                            padding: '14px 18px',
                            minHeight: 64,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                        }}>
                            <p style={{ fontSize: 9, color: '#D4722A', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 900, marginBottom: 6, fontFamily: 'inherit' }}>
                                💀 MEME MODE — {moves.length === 0 ? 'make a move fr' : 'no cap'}
                            </p>
                            {memeLoading ? (
                                <div className="flex items-center gap-2">
                                    <div className="spinner" style={{ width: 12, height: 12 }} />
                                    <span style={{ color: '#888', fontSize: 12, fontWeight: 700 }}>cooking up a reaction fr fr…</span>
                                </div>
                            ) : memeComment ? (
                                <p style={{ color: '#fff', fontSize: 14, lineHeight: 1.5, fontWeight: 600, fontFamily: 'inherit' }}>
                                    {memeComment}
                                </p>
                            ) : (
                                <p style={{ color: '#555', fontSize: 12, fontStyle: 'italic', fontFamily: 'inherit' }}>
                                    waiting for your first move bestie 👀
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Coach panel */}
                {coachAdvice && (
                    <div className="w-full max-w-lg p-5 text-sm whitespace-pre-wrap animate-slide-up"
                        style={{ background: C.card, border: `1.5px solid ${C.border}`, boxShadow: `3px 3px 0 ${C.shadow}`, color: C.text }}>
                        <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: C.accent }}>Coach says</p>
                        {coachAdvice}
                    </div>
                )}

                {/* Analysis panel */}
                {(analysis || analysisLoading) && (
                    <div className="w-full max-w-lg p-5 text-sm whitespace-pre-wrap animate-slide-up"
                        style={{ background: C.highlight, border: `1.5px solid ${C.accent}`, boxShadow: `3px 3px 0 ${C.accentDark}`, color: C.text }}>
                        <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: C.accent }}>Post-Game Analysis</p>
                        {analysisLoading && !analysis && <p style={{ color: C.muted }} className="italic">Reviewing your game…</p>}
                        {analysis}
                    </div>
                )}
            </div>
        </div>
    );
}
