# Frontend — CrypNight.sol React UI

React + Vite frontend for the chess skill-to-earn platform.

## Setup

### Prerequisites
- Node.js 18+ (`node --version`)
- npm 9+

### Installation

```bash
cd frontend
npm install
```

### Configuration

No `.env` required for local development. The app defaults to `http://localhost:5000` for the backend API.

### Development

```bash
npm run dev
```

Server starts at `http://localhost:5173`. Browser opens automatically.

### Build

```bash
npm run build
```

Output: `dist/` folder (ready for Vercel deployment).

### Key Features

- **Phantom Wallet Integration** — Connect wallet via `@solana/wallet-adapter`
- **Chess Board** — Puzzle display with move input (Chess.js + react-chessboard)
- **Solo Mode** — Timed 10-puzzle runs with instant on-chain rewards
- **Duel Mode** — Real-time multiplayer puzzle duels with stake deposits via WebSocket
- **Session Timer** — Real-time countdown per puzzle
- **Leaderboard** — Global + tier-based rankings
- **Magic Block ER** — Fast settlement via Ephemeral Rollups (payouts in ~1-2s)

### File Structure

```
src/
├── components/
│   ├── gameModes/
│   │   ├── Solo.jsx              # Solo mode — timed puzzles
│   │   └── Duel.jsx              # Duel mode — real-time multiplayer
│   ├── auth/                      # Login, signup, wallet linking
│   ├── leaderboard/               # Rankings display
│   ├── Dashboard.jsx              # Game modes + chess quotes + stats
│   └── Profile.jsx                # Wallet connection + SOL balance
├── pages/
│   ├── Landing.jsx                # Top 5 leaderboard + intro
│   └── History.jsx                # Past sessions log
├── hooks/
│   └── useDuelWebSocket.js         # WebSocket client for duel matchmaking
└── services/
    └── api.js                     # API client (axios)
```

### Environment Variables

Create `.env` (optional for local dev, defaults to `http://localhost:5000`):

```env
VITE_API_URL=http://localhost:5000
VITE_SOLANA_NETWORK=devnet
```

### Deployment (Vercel)

```bash
vercel deploy --prod
```

Set `VITE_API_URL` env var if backend is on a different domain.

### Magic Block ER Integration

Payouts use **Magic Block Ephemeral Rollups** for instant settlement:
- Solo mode: End session → backend sends payout transaction to ER → ~1-2s confirmation
- Duel mode: Match ends → payouts settle on ER → player sees balance update
- No waiting for Solana slot finality; results are final on ER immediately

See backend/README.md for payout architecture.
