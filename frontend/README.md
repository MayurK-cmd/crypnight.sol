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
- **Chess Board** — Puzzle display with move input
- **Session Timer** — Real-time countdown per puzzle
- **Leaderboard** — Global + tier-based rankings

### File Structure

```
src/
├── components/
│   ├── gameModes/Solo.jsx       # Puzzle timer + move submission
│   ├── auth/                     # Login, signup, wallet linking
│   └── leaderboard/              # Rankings display
├── pages/
│   ├── Dashboard.jsx             # Session history + stats
│   └── Landing.jsx               # Top 5 leaderboard + intro
└── services/
    └── api.js                    # API client (axios)
```

### Deployment (Vercel)

```bash
vercel deploy --prod
```

Set `VITE_API_URL` env var if backend is on a different domain.
