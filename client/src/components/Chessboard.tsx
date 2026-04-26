"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { type Square, type Piece } from "chess.js";
import { databases } from "@/lib/appwrite";
import { ID } from "appwrite";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_GAMES_COLLECTION_ID!;

const pieceSymbols: { [key: string]: string } = {
    p: "♙",
    r: "♖",
    n: "♘",
    b: "♗",
    q: "♕",
    k: "♔",
    P: "♟",
    R: "♜",
    N: "♞",
    B: "♝",
    Q: "♛",
    K: "♚",
};

type GameMode = "player-vs-player" | "player-vs-ai";

export default function Chessboard({ userId }: { userId: string }) {
    const router = useRouter();
    const [game, setGame] = useState<Chess>(new Chess());
    const [board, setBoard] = useState<(Piece | null)[][]>(game.board());
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
    const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
    const [status, setStatus] = useState("");
    const [gameMode, setGameMode] = useState<GameMode>("player-vs-player");
    const [aiLevel, setAiLevel] = useState(5); // Default AI level (0-20)
    const stockfishWorker = useRef<Worker | null>(null);
    const [coachAdvice, setCoachAdvice] = useState<string>("");
    const [coachLoading, setCoachLoading] = useState(false);

    useEffect(() => {
        updateStatus();

        // Initialize the Stockfish worker
        stockfishWorker.current = new Worker('/stockfish-worker.js');
        stockfishWorker.current.postMessage({ type: 'init' });

        stockfishWorker.current.onmessage = (event) => {
            const { type, payload } = event.data;
            if (type === 'best-move') {
                if (payload) {
                    game.move({
                        from: payload.slice(0, 2) as Square,
                        to: payload.slice(2, 4) as Square,
                        promotion: payload.length === 5 ? payload[4] : undefined,
                    });
                    setBoard(game.board());
                    updateStatus();
                }
            }
        };

        return () => {
            stockfishWorker.current?.terminate();
        };
    }, []);

    useEffect(() => {
        if (gameMode === 'player-vs-ai' && game.turn() === 'b') {
            // AI's turn
            if (stockfishWorker.current) {
                stockfishWorker.current.postMessage({ type: 'uci', payload: `position fen ${game.fen()}` });
                stockfishWorker.current.postMessage({ type: 'uci', payload: `go depth ${aiLevel}` });
            }
        }
    }, [game.fen(), gameMode, aiLevel]);


    async function saveGame(result: string) {
        try {
            await databases.createDocument(DATABASE_ID, COLLECTION_ID, ID.unique(), {
                userId,
                result,
                mode: gameMode,
                pgn: game.pgn(),
            });
        } catch (e) {
            console.error("Failed to save game:", e);
        }
    }

    function updateStatus() {
        let newStatus = `Turn: ${game.turn() === "w" ? "White" : "Black"}`;

        if (game.isCheckmate()) {
            const winner = game.turn() === "w" ? "Black" : "White";
            newStatus = `Checkmate! ${winner} wins.`;
            saveGame(`${winner} wins`);
        } else if (game.isDraw()) {
            newStatus = "Draw!";
            saveGame("draw");
        }

        setStatus(newStatus);
    }

    function onSquareClick(square: Square) {
        if (game.isGameOver() || (gameMode === 'player-vs-ai' && game.turn() === 'b')) return;

        if (selectedSquare) {
            try {
                const move = game.move({
                    from: selectedSquare,
                    to: square,
                    promotion: "q", // NOTE: always promote to a queen for simplicity
                });

                if (move) {
                    setBoard(game.board());
                    updateStatus();
                }
            } catch (e) {
                // invalid move
            }
            setSelectedSquare(null);
            setPossibleMoves([]);
        } else {
            const moves = game.moves({ square, verbose: true });
            if (moves.length > 0 && game.get(square)?.color === game.turn()) {
                setSelectedSquare(square);
                setPossibleMoves(moves.map((move) => move.to));
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
                body: JSON.stringify({
                    fen: game.fen(),
                    turn: game.turn(),
                    pgn: game.pgn(),
                }),
            });
            if (!res.body) return;
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                setCoachAdvice((prev) => prev + decoder.decode(value));
            }
        } catch (e) {
            setCoachAdvice("Coach unavailable. Check your API key.");
        } finally {
            setCoachLoading(false);
        }
    }

    function resetGame() {
        const newGame = new Chess();
        setGame(newGame);
        setBoard(newGame.board());
        setSelectedSquare(null);
        setPossibleMoves([]);
        updateStatus();
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800 text-white">
            <div className="flex items-center justify-between w-full max-w-lg mb-4">
                <h1 className="text-4xl font-bold">ChessMind</h1>
                <button
                    onClick={() => router.push('/profile')}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded font-bold text-sm"
                >
                    Profile
                </button>
            </div>
            <div className="flex gap-4 mb-4">
                <button onClick={() => setGameMode("player-vs-player")} className={`px-4 py-2 rounded ${gameMode === 'player-vs-player' ? 'bg-blue-700' : 'bg-blue-500'}`}>
                    Player vs Player
                </button>
                <button onClick={() => setGameMode("player-vs-ai")} className={`px-4 py-2 rounded ${gameMode === 'player-vs-ai' ? 'bg-green-700' : 'bg-green-500'}`}>
                    Player vs AI
                </button>
            </div>
            {gameMode === 'player-vs-ai' && (
                <div className="flex items-center gap-2 mb-4">
                    <label htmlFor="aiLevel">AI Level: {aiLevel}</label>
                    <input
                        type="range"
                        id="aiLevel"
                        min="0"
                        max="20"
                        value={aiLevel}
                        onChange={(e) => setAiLevel(parseInt(e.target.value))}
                        className="w-48"
                    />
                </div>
            )}
            <div className="grid grid-cols-8 border-4 border-gray-600">
                {board.map((row, rowIndex) =>
                    row.map((piece, colIndex) => {
                        const square = String.fromCharCode(97 + colIndex) + (8 - rowIndex) as Square;
                        const isEven = (rowIndex + colIndex) % 2 === 0;
                        const squareColor = isEven ? "bg-gray-400" : "bg-gray-600";
                        const isSelected = selectedSquare === square;
                        const isPossibleMove = possibleMoves.includes(square);

                        return (
                            <div
                                key={colIndex}
                                onClick={() => onSquareClick(square)}
                                className={`w-16 h-16 flex items-center justify-center text-4xl cursor-pointer ${squareColor} ${isSelected ? "bg-yellow-500" : ""
                                    } ${isPossibleMove ? "bg-green-500" : ""}`}
                            >
                                {piece && (
                                    <span className={piece.color === 'w' ? 'text-white' : 'text-black'}>
                                        {pieceSymbols[piece.color === 'b' ? piece.type : piece.type.toUpperCase()]}
                                    </span>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
            <div className="mt-4 text-xl">{status}</div>
            <div className="flex gap-4 mt-4">
                <button
                    onClick={resetGame}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-700 text-white font-bold rounded"
                >
                    New Game
                </button>
                <button
                    onClick={askCoach}
                    disabled={coachLoading || game.isGameOver()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-800 text-white font-bold rounded disabled:opacity-50"
                >
                    {coachLoading ? "Thinking..." : "Ask Coach"}
                </button>
            </div>
            {coachAdvice && (
                <div className="mt-4 max-w-xl w-full p-4 bg-gray-700 rounded-lg text-sm text-gray-200 whitespace-pre-wrap">
                    <p className="text-purple-400 font-bold mb-1">Coach says:</p>
                    {coachAdvice}
                </div>
            )}
        </div>
    );
}


