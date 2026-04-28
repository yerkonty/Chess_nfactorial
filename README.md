# YChess

A full-stack chess platform with AI opponent, AI coaching, multiplayer rooms, and replayable game history.

**Live:** [ychess.me](https://ychess.me)

## Highlights

- **Play Chess** — legal-move validation, move hints, last-move and check highlights
- **Player vs Player** — local two-player mode
- **Multiplayer Rooms** — share a room link and play live with timers
- **Player vs AI** — Stockfish 18 engine with adjustable difficulty (1–20)
- **AI Coach** — on-demand coaching powered by Llama 3.3 70B via Groq
- **Post-Game Replay** — full move list, board snapshots, and AI analysis on demand
- **Game History & Stats** — wins/losses/draws, recent games, and replay links
- **Skins & Pro** — piece skins and upgrade flow
- **Auth** — email/password and Google OAuth via Appwrite

## Navigation Guide

- **Home**: start a new game and select mode
- **Play**: multiplayer lobby; open or join a room
- **Profile**: stats and game history; open any game to replay
- **Leaderboard**: top players list
- **Replay**: move-by-move viewer with AI analysis button

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Chess Logic | chess.js |
| AI Opponent | Stockfish 18 WASM (Web Worker) |
| AI Coach | Groq API — Llama 3.3 70B |
| Auth & Database | Appwrite |
| Payments | Stripe |
| Deployment | Vercel |

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/yerkonty/Chess_project.git
cd Chess_project/client
npm install
```

### 2. Environment variables

Create a `.env.local` file in `client/`:

```env
NEXT_PUBLIC_APPWRITE_ENDPOINT="https://fra.cloud.appwrite.io/v1"
NEXT_PUBLIC_APPWRITE_PROJECT_ID="your-appwrite-project-id"
NEXT_PUBLIC_APPWRITE_PROJECT_NAME="your-project-name"
NEXT_PUBLIC_APPWRITE_DATABASE_ID="your-database-id"
NEXT_PUBLIC_APPWRITE_GAMES_COLLECTION_ID="games"
GROQ_API_KEY="your-groq-api-key"
```

If you enable payments, add your Stripe keys used in the `/api/stripe/*` routes.

### 3. Appwrite setup

1) Create a project at [appwrite.io](https://appwrite.io)
2) Enable **Email/Password** and **Google OAuth** authentication
3) Add your web platform(s) in Settings → Platforms (include localhost for dev)
4) Create a database and collections:

**games** collection
- `userId` (string)
- `userName` (string)
- `result` (string)
- `mode` (string)
- `pgn` (string)

**rooms** collection (multiplayer)
- `fen` (string)
- `pgn` (string, optional)
- `status` (string: waiting|active|finished)
- `player1Id` (string), `player1Name` (string)
- `player2Id` (string, optional), `player2Name` (string, optional)
- `turn` (string)
- `lastMove` (string, optional)
- `whiteTime` (number, optional), `blackTime` (number, optional)
- `timerDuration` (number, optional)
- `lastMoveAt` (datetime, optional)
- `result` (string, optional)

### 4. Groq API key

Sign up at [console.groq.com](https://console.groq.com) and create a key.

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment (Vercel)

1) Push the repo to GitHub
2) Import the `client/` directory in Vercel
3) Add the same environment variables from `.env.local`
4) Deploy

## Project Structure

```
client/
├── public/
│   ├── stockfish-18-lite.js
│   ├── stockfish-18-lite.wasm
│   └── stockfish-worker.js
├── src/
│   ├── app/
│   │   ├── api/coach/route.ts
│   │   ├── api/analyze/route.ts
│   │   ├── api/stockfish/route.ts
│   │   ├── play/[id]/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── profile/game/[id]/page.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── Chessboard.tsx
│   │   ├── ProModal.tsx
│   │   └── auth/Auth.tsx
│   └── lib/
│       ├── appwrite.ts
│       ├── chessAI.ts
│       └── skins.ts
```

## License

MIT
