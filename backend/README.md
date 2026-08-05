# Backend — CrypNight.sol Express API

Node.js + Express server handling authentication, game logic, and on-chain payouts via Magic Block ER.

## Setup

### Prerequisites
- Node.js 18+ (`node --version`)
- npm 9+
- Supabase project (account + API keys)
- Solana devnet account with SOL

### Installation

```bash
cd backend
npm install
```

### Configuration

Create `.env` file:

```env
PORT=5000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# CORS
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=<your-deployed-program-id>
PLATFORM_TREASURY_PUBKEY=<your-treasury-pda>
PLATFORM_AUTHORITY_PRIVATE_KEY=<your-authority-private-key-base58>

# Magic Block ER
MAGICBLOCK_ROUTER_URL=https://devnet-router.magicblock.app
MAGICBLOCK_WS_URL=wss://devnet-router.magicblock.app

# Game
PUZZLES_PER_SESSION=10
```

### Database

Run migrations in Supabase SQL editor (order matters):
```
docs/migrations/001_schema.sql
docs/migrations/002_audit_log.sql
docs/migrations/003_indexes.sql
```

### Development

```bash
node index.js
```

Server runs at `http://localhost:5000`.

### Key Endpoints

- `POST /api/auth/signup` — Register with email
- `POST /api/auth/login` — Login
- `POST /api/user/link-wallet` — Connect Phantom wallet
- `POST /api/solo/start-session` — Begin 10-puzzle run
- `POST /api/solo/submit-move` — Move validation
- `POST /api/solo/end-session` — Finish session, trigger payout
- `GET /api/leaderboard/global` — Global rankings

### WebSocket

Real-time duel matchmaking via WebSocket at `ws://localhost:5000/ws/duel`:

**Events:**
- `duel:search` — Join matchmaking queue for a tier
- `match:found` — Both players paired, puzzle sent
- `duel:start` — Game starts, FEN position received
- `move:made` — Player submits move, validated server-side
- `match:end` — Winner determined, payouts triggered

### Payout System & Magic Block ER

Payouts execute on **Magic Block Ephemeral Rollups** when a session or duel ends:

- **Treasury PDA** holds SOL (funded via fund-treasury.js)
- **Authority account** signs transactions (private key in PLATFORM_AUTHORITY_PRIVATE_KEY)
- **ER Connection** sends transactions to Magic Block router (separate shard from Solana)
- **Confirmation:** ~1-2 seconds (vs. Solana's ~13s slot finality)
- **Fee:** 3% retained by platform, remainder to player

Test payouts locally:
```bash
node test-payout-cjs.js
```

Payouts are **final on ER immediately** — no rollback risk after confirmation. Backend verifies puzzle/duel outcome server-side before sending payout tx.

### Magic Block Integration

- **Router URL:** `https://devnet-router.magicblock.app` (ER shard endpoint)
- **WS URL:** `wss://devnet-router.magicblock.app` (for real-time settlement monitoring)
- **Benefits:** Instant finality, low cost, no slot-based delays, player sees balance update immediately

See [Magic Block Docs](https://docs.magicblock.io) for architecture details.

## Duel Mode

Real-time multiplayer puzzle battles via WebSocket.

### Endpoints

- `POST /api/duel/search` — Join matchmaking queue (body: `{tier: "beginner"|"intermediate"|"pro"|"gm"}`)
- `POST /api/duel/submit-move` — Validate move in active duel (body: `{sessionId, move, ...}`)
- `GET /api/duel/:sessionId` — Get duel status

### WebSocket Flow

WebSocket at `ws://localhost:5000/ws/duel` handles matchmaking and real-time gameplay:

1. **Search:** Client sends `duel:search` → joins tier queue
2. **Match Found:** Server broadcasts `match:found` to both players + puzzle FEN
3. **Moves:** Players send moves → server validates → broadcasts `move:made` to both
4. **End:** First to solve or timer expires → `match:end` + payouts triggered

Authentication via JWT cookie (extracted in upgrade handler).

### Puzzle Distribution

- One puzzle per duel (stored in `duel_sessions.current_puzzle_fen`)
- Both players validate moves against same puzzle
- Prevents cheating via divergent puzzle state

---

```
src/
├── routes/           # API endpoint definitions
├── controllers/      # Endpoint handlers + business logic
├── services/
│   ├── payoutService.js    # On-chain payout via Magic Block ER
│   ├── puzzleLoader.js     # CSV → database preload
│   └── rewardCalculator.js # ELO + multiplier math
├── config/
│   └── solana.js     # Solana connections (baseConnection, erConnection)
└── middleware/
    ├── auth.js       # JWT + wallet verification
    ├── rateLimiter.js
    └── auditLog.js   # Action logging
```

### Deployment (Render)

Connect Git repo to Render, set env vars, deploy.

Deployed at `https://your-backend.onrender.com` (example).
