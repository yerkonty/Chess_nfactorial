import Groq from 'groq-sdk';

export const maxDuration = 15;

const SYSTEM = `You are an absolutely unhinged chess commentator who reacts to moves using 2025 TikTok/internet Gen Z meme language. After each chess move, give ONE extremely short and punchy reaction — MAX 1-2 sentences, under 30 words total.

Naturally use: slay, ate (and left no crumbs), no cap, fr fr, it's giving, lowkey, delulu, rizz, understood the assignment, era, bussin, cooked, W/L, main character, NPC, POV, bro really said, based, sigma, skill issue, gg ez, L + ratio, touch grass, rent free.

Emojis to sprinkle: 💀🔥⚠️🚨😭🤣🫡👑💅🗿😤

Special chess moments:
- En passant: always go absolutely unhinged ("EN PASSANT IS THE MOST UNHINGED RULE IN EXISTENCE 💀")
- Piece sacrifice: "THE SACRIFICE?! bro is NOT a NPC fr"
- Scholar's mate: pure devastation energy
- Queen captured: "NOT THE QUEEN 😭 lowkey crying rn"
- Check: dramatic, chaotic
- Checkmate: maximum unhinged chaos
- Castling: "the castle arc just dropped 🏰"
- Pawn to promotion: "glow up era 💅"

Keep it SHORT. One punchy reaction only. No lists. No explanation.`;

const PIECE_NAMES: Record<string, string> = {
    p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
};

export async function POST(req: Request) {
    try {
        const { san, piece, captured, flags, isCheck, isMate, moveColor } = await req.json();

        const isEnPassant = typeof flags === 'string' && flags.includes('e');
        const isPromotion = typeof flags === 'string' && flags.includes('p');
        const isCastle = typeof flags === 'string' && (flags.includes('k') || flags.includes('q'));
        const side = moveColor === 'w' ? 'White' : 'Black';

        let prompt = `${side} played ${san}.`;
        if (isMate) prompt = `CHECKMATE! ${side} just got CHECKMATED with ${san}. React!`;
        else if (isEnPassant) prompt = `EN PASSANT was just played: ${san}. React to this cursed move!`;
        else if (isPromotion) prompt = `Pawn just promoted to ${PIECE_NAMES[piece] ?? piece} (${san})! Glow up era.`;
        else if (isCastle) prompt = `Castling! ${side} played ${san}. React.`;
        else if (captured === 'q') prompt = `${side}'s queen was just CAPTURED! Move: ${san}. React!`;
        else if (captured === 'k') prompt = `King captured somehow?! Move: ${san}`;
        else if (isCheck) prompt = `${side} is in CHECK! Move: ${san}. React dramatically.`;
        else if (captured) prompt = `${PIECE_NAMES[piece] ?? 'Piece'} captured a ${PIECE_NAMES[captured] ?? 'piece'} with ${san}. React.`;
        else if (piece === 'p') prompt = `Pawn push: ${san}. ${side} doing pawn things.`;
        else prompt = `${side} played ${san} (${PIECE_NAMES[piece] ?? piece} move). Give a meme reaction.`;

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: SYSTEM },
                { role: 'user', content: prompt },
            ],
            max_tokens: 80,
            temperature: 1.1,
        });

        const comment = completion.choices[0]?.message?.content?.trim() ?? '💀';
        return Response.json({ comment });
    } catch (e) {
        console.error('Meme API error:', e);
        return Response.json({ comment: '💀 bro really said that move fr fr' });
    }
}
