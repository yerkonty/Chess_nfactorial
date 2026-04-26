# YChess

A full-stack chess web app with AI opponent, AI coaching, and game history tracking.

**Live:** [ychess.me](https://ychess.me)

## Features

- **Play Chess** — fully validated moves with legal move highlighting
- **Player vs Player** — local 2-player mode
- **Player vs AI** — Stockfish 18 engine with adjustable difficulty (0–20)
- **AI Coach** — ask for real-time coaching advice powered by Llama 3.3 70B via Groq
- **Authentication** — email/password and Google OAuth via Appwrite
- **Game History** — all games saved to database with result, mode, and PGN
- **Player Profile** — view stats (wins, losses, draws) and full game history

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Chess Logic | chess.js |
| AI Opponent | Stockfish 18 WASM (Web Worker) |
| AI Coach | Groq API — Llama 3.3 70B |
| Auth & Database | Appwrite |
| Deployment | Vercel |

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/yerkonty/Chess_project.git
cd Chess_project/client
npm install
```

### 2. Set up environment variables

Create a `.env.local` file in the `client/` directory:

```env
NEXT_PUBLIC_APPWRITE_ENDPOINT="https://fra.cloud.appwrite.io/v1"
NEXT_PUBLIC_APPWRITE_PROJECT_ID="your-appwrite-project-id"
NEXT_PUBLIC_APPWRITE_PROJECT_NAME="your-project-name"
NEXT_PUBLIC_APPWRITE_DATABASE_ID="your-database-id"
NEXT_PUBLIC_APPWRITE_GAMES_COLLECTION_ID="games"
GROQ_API_KEY="your-groq-api-key"
```

### 3. Set up Appwrite

- Create a project at [appwrite.io](https://appwrite.io)
- Enable **Email/Password** and **Google OAuth** authentication
- Create a database with a `games` collection with these columns:
  - `userId` (string)
  - `result` (string)
  - `mode` (string)
  - `pgn` (string)
- Add `localhost` as a web platform in Settings → Platforms

### 4. Get a free Groq API key

Sign up at [console.groq.com](https://console.groq.com) — no credit card required.

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
client/
├── public/
│   ├── stockfish-18-lite.js     # Stockfish engine
│   ├── stockfish-18-lite.wasm
│   └── stockfish-worker.js      # Web Worker for Stockfish
├── src/
│   ├── app/
│   │   ├── api/coach/route.ts   # Groq AI Coach API route
│   │   ├── profile/page.tsx     # Player profile page
│   │   └── page.tsx             # Home page
│   ├── components/
│   │   ├── Chessboard.tsx       # Main game component
│   │   └── auth/Auth.tsx        # Auth form
│   └── lib/
│       └── appwrite.ts          # Appwrite client
```

## License

MIT
