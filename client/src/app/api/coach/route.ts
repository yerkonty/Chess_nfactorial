import Groq from "groq-sdk";
import { NextRequest } from "next/server";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
    const { fen, turn, pgn } = await req.json();

    const stream = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        stream: true,
        max_tokens: 512,
        messages: [
            {
                role: "system",
                content: "You are an expert chess coach. Give brief, actionable advice. Be encouraging and concise — 2-3 short paragraphs max.",
            },
            {
                role: "user",
                content: `Analyze this position and give me coaching advice.

Current position (FEN): ${fen}
It is ${turn === "w" ? "White" : "Black"}'s turn.
${pgn ? `Game so far (PGN): ${pgn}` : ""}

Give 2-3 concrete suggestions: what to watch out for, a good plan, and a candidate move.`,
            },
        ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
        async start(controller) {
            for await (const chunk of stream) {
                const text = chunk.choices[0]?.delta?.content ?? "";
                if (text) controller.enqueue(encoder.encode(text));
            }
            controller.close();
        },
    });

    return new Response(readable, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
}
