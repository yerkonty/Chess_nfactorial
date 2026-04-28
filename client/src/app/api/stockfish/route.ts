import { NextRequest, NextResponse } from "next/server";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const initStockfish = require("stockfish");

export const maxDuration = 30;

function getBestMove(fen: string, depth: number): Promise<string> {
    const enginePath = path.join(
        process.cwd(),
        "node_modules/stockfish/bin/stockfish-18-lite-single.js"
    );

    return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initStockfish(enginePath, (err: Error | null, engine: any) => {
            if (err) { reject(err); return; }

            let done = false;

            engine.print = (line: string) => {
                if (done) return;
                if (line.startsWith("bestmove")) {
                    done = true;
                    const mv = line.split(" ")[1];
                    try { engine.terminate(); } catch { /* ignore */ }
                    if (mv && mv !== "(none)") resolve(mv);
                    else reject(new Error("No valid move"));
                }
            };

            engine.sendCommand("uci");
            engine.sendCommand("isready");
            engine.sendCommand(`position fen ${fen}`);
            engine.sendCommand(`go depth ${Math.min(depth, 15)}`);

            setTimeout(() => {
                if (!done) {
                    done = true;
                    try { engine.terminate(); } catch { /* ignore */ }
                    reject(new Error("Engine timeout"));
                }
            }, 25000);
        });
    });
}

export async function POST(req: NextRequest) {
    try {
        const { fen, depth = 10 } = await req.json();
        if (!fen || typeof fen !== "string") {
            return NextResponse.json({ error: "Invalid FEN" }, { status: 400 });
        }
        const move = await getBestMove(fen, depth);
        return NextResponse.json({ move });
    } catch (e) {
        console.error("Stockfish API error:", e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
