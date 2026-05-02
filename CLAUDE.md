# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

All application code lives under `client/`. There is no backend service — everything runs as Next.js API routes or in the browser.

```
client/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Home — main chess board (PvP / vs-AI / mode select)
│   │   ├── play/[id]/page.tsx    # Multiplayer room (Appwrite Realtime)
│   │   ├── leaderboard/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── profile/game/[id]/page.tsx  # Game replay
│   │   └── api/
│   │       ├── coach/route.ts    # Streaming AI coaching (Groq)
│   │       ├── analyze/route.ts  # Streaming post-game analysis (Groq)
│   │       ├── meme/route.ts     # Meme Mode reactions (Groq, non-streaming)
│   │       └── stripe/           # checkout + verify
│   ├── components/
│   │   ├── Chessboard.tsx        # Main board + all singleplayer/AI game logic
│   │   ├── ProModal.tsx          # Skin shop + upgrade modal
│   │   └── auth/Auth.tsx         # Email/password + Google OAuth
│   └── lib/
│       ├── appwrite.ts           # Appwrite client (account, databases)
│       ├── chessAI.ts            # Minimax + alpha-beta pruning engine
│       ├── memeSounds.ts         # Meme sound preloader/player
│       ├── sounds.ts             # Web Audio API chess sounds
│       └── skins.ts              # Piece skin definitions + prices
└── public/
    ├── meme-sounds/              # 22 MP3 files
    └── stockfish-worker.js       # Stockfish 18 lite web worker
```

## Commands (run from `client/`)

```bash
npm run dev     # start dev server on localhost:3000
npm run build   # production build
npm run lint    # ESLint
```

There are no tests. There is no separate test command.

## Tech stack

| Concern | Technology |
|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Chess logic | chess.js |
| AI opponent | `src/lib/chessAI.ts` — pure JS minimax, alpha-beta pruning, piece-square tables; runs entirely in-browser |
| AI coach / meme / analysis | Groq API (`llama-3.3-70b-versatile`), called from Next.js API routes |
| Auth + DB + Realtime | Appwrite (hosted, `fra.cloud.appwrite.io`) |
| Payments | Stripe Checkout (server-side session creation in `api/stripe/checkout`) |
| Deployment | Vercel, live at ychess.me |

## Environment variables (`client/.env.local`)

```
NEXT_PUBLIC_APPWRITE_ENDPOINT
NEXT_PUBLIC_APPWRITE_PROJECT_ID
NEXT_PUBLIC_APPWRITE_DATABASE_ID
NEXT_PUBLIC_APPWRITE_GAMES_COLLECTION_ID   # collection name: "games"
GROQ_API_KEY
STRIPE_SECRET_KEY                          # optional
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY         # optional
```

## Architecture notes

**Appwrite collections** — two collections used:
- `games` — stores completed games: `userId`, `userName`, `result`, `mode`, `pgn`
- `rooms` — multiplayer rooms with full game state; synced via Appwrite Realtime subscriptions in `play/[id]/page.tsx`

**AI difficulty** — `difficultyToDepth()` in `chessAI.ts` maps level 1–20 → depth 1–4. The Stockfish WASM worker (`public/stockfish-worker.js`) exists but the active vs-AI path uses the pure-JS minimax to avoid WASM issues on Vercel.

**Groq streaming** — `api/coach` and `api/analyze` return a `ReadableStream` with `Content-Type: text/plain`. Clients consume it via `response.body.getReader()` to stream text token-by-token into the UI.

**Piece skins** — defined in `lib/skins.ts` as CSS-in-JS (`CSSProperties`). Purchased skins are stored in `localStorage` keyed by `userId`. The `api/stripe/verify` route confirms a Stripe `session_id` before unlocking.

**Meme Mode** — toggled client-side in `Chessboard.tsx`. On enable, `memeSounds.ts` preloads all 22 MP3s. After each move, `api/meme` is called (non-streaming) to get a one-line Gen Z reaction; a meme sound is chosen by move type (capture / check / en passant / etc.) and played via `HTMLAudioElement`.

**Next.js 16** — This project uses Next.js 16 with the App Router. APIs and conventions may differ from older versions. Check `node_modules/next/dist/docs/` when uncertain.

## After completing any task

Update `client/progress.md` to reflect completed work.
