import { Chess } from "chess.js";

const PIECE_VALUE: Record<string, number> = {
    p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
};

// Piece-square tables, white perspective, index 0 = a8
const PST: Record<string, number[]> = {
    p: [
         0,  0,  0,  0,  0,  0,  0,  0,
        50, 50, 50, 50, 50, 50, 50, 50,
        10, 10, 20, 30, 30, 20, 10, 10,
         5,  5, 10, 25, 25, 10,  5,  5,
         0,  0,  0, 20, 20,  0,  0,  0,
         5, -5,-10,  0,  0,-10, -5,  5,
         5, 10, 10,-20,-20, 10, 10,  5,
         0,  0,  0,  0,  0,  0,  0,  0,
    ],
    n: [
        -50,-40,-30,-30,-30,-30,-40,-50,
        -40,-20,  0,  0,  0,  0,-20,-40,
        -30,  0, 10, 15, 15, 10,  0,-30,
        -30,  5, 15, 20, 20, 15,  5,-30,
        -30,  0, 15, 20, 20, 15,  0,-30,
        -30,  5, 10, 15, 15, 10,  5,-30,
        -40,-20,  0,  5,  5,  0,-20,-40,
        -50,-40,-30,-30,-30,-30,-40,-50,
    ],
    b: [
        -20,-10,-10,-10,-10,-10,-10,-20,
        -10,  0,  0,  0,  0,  0,  0,-10,
        -10,  0,  5, 10, 10,  5,  0,-10,
        -10,  5,  5, 10, 10,  5,  5,-10,
        -10,  0, 10, 10, 10, 10,  0,-10,
        -10, 10, 10, 10, 10, 10, 10,-10,
        -10,  5,  0,  0,  0,  0,  5,-10,
        -20,-10,-10,-10,-10,-10,-10,-20,
    ],
    r: [
         0,  0,  0,  0,  0,  0,  0,  0,
         5, 10, 10, 10, 10, 10, 10,  5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
         0,  0,  0,  5,  5,  0,  0,  0,
    ],
    q: [
        -20,-10,-10, -5, -5,-10,-10,-20,
        -10,  0,  0,  0,  0,  0,  0,-10,
        -10,  0,  5,  5,  5,  5,  0,-10,
         -5,  0,  5,  5,  5,  5,  0, -5,
          0,  0,  5,  5,  5,  5,  0, -5,
        -10,  5,  5,  5,  5,  5,  0,-10,
        -10,  0,  5,  0,  0,  0,  0,-10,
        -20,-10,-10, -5, -5,-10,-10,-20,
    ],
    k: [
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -20,-30,-30,-40,-40,-30,-30,-20,
        -10,-20,-20,-20,-20,-20,-20,-10,
         20, 20,  0,  0,  0,  0, 20, 20,
         20, 30, 10,  0,  0, 10, 30, 20,
    ],
};

function evaluate(game: Chess): number {
    if (game.isCheckmate()) return game.turn() === "w" ? -99999 : 99999;
    if (game.isDraw()) return 0;

    let score = 0;
    const board = game.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p) continue;
            const idx = p.color === "w" ? r * 8 + c : (7 - r) * 8 + c;
            const pst = PST[p.type]?.[idx] ?? 0;
            const val = PIECE_VALUE[p.type] + pst;
            score += p.color === "w" ? val : -val;
        }
    }
    return score;
}

function alphaBeta(game: Chess, depth: number, alpha: number, beta: number, maxing: boolean): number {
    if (depth === 0 || game.isGameOver()) return evaluate(game);

    const moves = game.moves({ verbose: true });
    // Captures first for better pruning
    moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

    if (maxing) {
        let best = -Infinity;
        for (const m of moves) {
            game.move(m);
            best = Math.max(best, alphaBeta(game, depth - 1, alpha, beta, false));
            game.undo();
            alpha = Math.max(alpha, best);
            if (beta <= alpha) break;
        }
        return best;
    } else {
        let best = Infinity;
        for (const m of moves) {
            game.move(m);
            best = Math.min(best, alphaBeta(game, depth - 1, alpha, beta, true));
            game.undo();
            beta = Math.min(beta, best);
            if (beta <= alpha) break;
        }
        return best;
    }
}

export function getBestMove(game: Chess, depth: number): string | null {
    const moves = game.moves({ verbose: true });
    if (!moves.length) return null;

    // Shuffle for variety at equal scores
    moves.sort(() => Math.random() - 0.5);

    const maxing = game.turn() === "w";
    let bestMove = moves[0];
    let bestScore = maxing ? -Infinity : Infinity;

    for (const m of moves) {
        game.move(m);
        const score = alphaBeta(game, depth - 1, -Infinity, Infinity, !maxing);
        game.undo();
        if (maxing ? score > bestScore : score < bestScore) {
            bestScore = score;
            bestMove = m;
        }
    }

    return `${bestMove.from}${bestMove.to}${bestMove.promotion ?? ""}`;
}

// Map difficulty 1–20 to search depth
export function difficultyToDepth(level: number): number {
    if (level <= 4)  return 1;
    if (level <= 9)  return 2;
    if (level <= 15) return 3;
    return 4;
}
