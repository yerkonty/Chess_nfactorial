"use client";

import { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { type Square, type Piece } from "chess.js";

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

export default function Chessboard() {
    const [game, setGame] = useState<Chess>(new Chess());
    const [board, setBoard] = useState<(Piece | null)[][]>(game.board());
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
    const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
    const [status, setStatus] = useState("");
    const [gameMode, setGameMode] = useState<GameMode>("player-vs-player");
    const [aiLevel, setAiLevel] = useState(5); // Default AI level (0-20)
    const stockfishWorker = useRef<Worker | null>(null);

    useEffect(() => {
        updateStatus();

        // Initialize the Stockfish worker
        stockfishWorker.current = new Worker(new URL('../workers/stockfish.js', import.meta.url), {
            type: 'module'
        });
        stockfishWorker.current.postMessage({ type: 'init' });

        stockfishWorker.current.onmessage = (event) => {
            const { type, payload } = event.data;
            if (type === 'best-move') {
                if (payload) {
                    game.move(payload, { sloppy: true });
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


    function updateStatus() {
        let newStatus = `Turn: ${game.turn() === "w" ? "White" : "Black"}`;

        if (game.isCheckmate()) {
            newStatus = `Checkmate! ${game.turn() === "w" ? "Black" : "White"} wins.`;
        } else if (game.isDraw()) {
            newStatus = "Draw!";
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
            <h1 className="text-4xl font-bold mb-4">ChessMind</h1>
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
            <button
                onClick={resetGame}
                className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-700 text-white font-bold rounded"
            >
                New Game
            </button>
        </div>
    );
}


