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

### Payout System

Payouts execute on Magic Block ER when a session ends:
- Treasury PDA holds SOL
- Authority account signs transactions
- 3% fee retained, remainder to player
- Confirmation ~1-2 seconds

Test payouts:
```bash
node test-payout-cjs.js
```

### File Structure

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
