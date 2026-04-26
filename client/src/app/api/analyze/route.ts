import Groq from "groq-sdk";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const { pgn, result } = await req.json();

    const stream = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        stream: true,
        max_tokens: 800,
        messages: [
            {
                role: "system",
                content: "You are an expert chess coach reviewing a completed game. Identify the most critical moments, blunders, and missed opportunities. Be specific about move numbers. Format your response with clear sections.",
            },
            {
                role: "user",
                content: `Review this completed game and provide post-game analysis.

Game result: ${result}
PGN: ${pgn}

Please provide:
1. **Game Summary** — 1-2 sentences on how the game unfolded
2. **Critical Moments** — 2-3 turning points or blunders (reference specific move numbers)
3. **What to Improve** — the most important lesson from this game for both sides

Keep it concise and actionable.`,
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
