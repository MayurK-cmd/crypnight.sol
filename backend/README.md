# Crypnight Backend

Express.js + WebSocket server powering Solo and Duel game modes with real-time puzzle distribution, move validation, and on-chain settlement integration.

## Overview

The backend handles:
- **Authentication**: Supabase JWT from httpOnly cookies
- **Puzzle Loading**: Rated database queries (100–2800 ELO)
- **Solo Mode**: Magic Block integration for off-chain compute + on-chain settlement
- **Duel Mode**: Real-time WebSocket matchmaking, per-player puzzle progression, lives tracking
- **Settlement**: Draw refunds + winner payout logic
- **Leaderboard**: User stats and ranking

## Tech Stack

- **Framework**: Express.js
- **WebSocket**: ws library
- **Database**: Supabase (PostgreSQL)
- **Blockchain**: Solana (Anchor programs, Magic Block)
- **Chess**: chess.js for move validation

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account with puzzle database
- Solana Devnet RPC access

### Installation

```bash
npm install
npm run dev
```

Server runs on `http://localhost:5000`.

## Environment Configuration

```env
# Server
PORT=5000
NODE_ENV=development

# Solana Programs
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=DKoawaEk5pJj1npwNYXeCCPF3Uqzxahokq67NY387qbK
DUEL_PROGRAM_ID=EzkHbrB8bTWPVevB9X1AySwt2fAtjqEnZkAnihjZfcEc
PLATFORM_TREASURY_PUBKEY=omyRQ6Ynne5seohfqiMQRPyaMuSkPDi9gksUeKm4oi6
DUEL_TREASURY_PUBKEY=6kcSoKW35mTzhf8YCyGwwzPZJBMEH7cVNEZQcohZdgJk

# Magic Block (off-chain compute)
MAGICBLOCK_ROUTER_URL=https://devnet-router.magicblock.app
MAGICBLOCK_WS_URL=wss://devnet-router.magicblock.app

# Supabase
SUPABASE_URL=https://etkfbdivtlgdqzwhckbd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Authority keypair for transactions
PLATFORM_AUTHORITY_PRIVATE_KEY=your_keypair_bytes

# CORS
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173

# Demo (testing)
DEMO_ESCROW_PDA=8iXhZUk7ZdumVE8aWiHqmMnDHdTtTbjj8YRmiAf4vdKx
```

## Project Structure

```
src/
├── controllers/
│   ├── duel.controller.js       # Duel settlement endpoint
│   └── user.controller.js       # Profile, leaderboard
├── services/
│   ├── duelSocket.js            # WebSocket duel logic
│   ├── duelManager.js           # Queue, matchmaking, state
│   ├── duelPayoutService.js     # Solana settlement
│   └── puzzleLoader.js          # Puzzle queries
├── routes/
│   ├── duel.routes.js           # /api/duel/*
│   └── user.routes.js           # /api/user/*
├── config/
│   ├── solana.js                # Connection, keypair setup
│   └── supabase.js              # Client initialization
└── utils/
    ├── rewardCalculator.js      # Streak multipliers
    └── validators.js            # Input validation
```

## API Reference

### REST Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/duel/queue/:tier` | Check queue length |
| POST | `/api/duel/settle` | Settle completed duel (refund/payout) |
| GET | `/api/user/profile` | Fetch user stats |
| GET | `/api/leaderboard` | Top 100 players |

**POST /api/duel/settle**

Request:
```json
{
  "matchId": "uuid",
  "playerASolved": 3,
  "playerBSolved": 3
}
```

Response (draw):
```json
{
  "status": "refunded",
  "reason": "draw",
  "message": "Both players refunded their stakes."
}
```

Response (winner):
```json
{
  "status": "settled",
  "winnerId": "user-id",
  "playerASolved": 5,
  "playerBSolved": 2
}
```

## WebSocket Protocol

**Connect**: `ws://localhost:5000/ws/duel`

Authentication via JWT in `auth_token` cookie (set by frontend on Phantom login).

### Message Types

**queue:join** (Client→Server)
```json
{ "type": "queue:join", "tier": "beginner" }
```

**match:found** (Server→Client)
```json
{
  "type": "match:found",
  "matchId": "uuid",
  "tier": "beginner",
  "stakeSol": 0.05,
  "opponent": { "username": "opp", "rating": 1600 },
  "role": "player_a"
}
```

**duel:start** (Server→Client)
```json
{
  "type": "duel:start",
  "matchId": "uuid",
  "puzzle": { "puzzle_id": 1, "fen": "...", "rating": 1600 },
  "durationMs": 180000,
  "startedAt": 1691234567890
}
```

**move:submit** (Client→Server)
```json
{ "type": "move:submit", "matchId": "uuid", "move": "e2e4" }
```

**puzzle:solved** (Server→Client)
```json
{ "type": "puzzle:solved", "matchId": "uuid" }
```

**puzzle:failed** (Server→Client)
```json
{ "type": "puzzle:failed", "matchId": "uuid", "livesRemaining": 2 }
```

**opponent:out_of_lives** (Server→Client)
```json
{ "type": "opponent:out_of_lives", "matchId": "uuid" }
```

## Services

### duelSocket.js

Handles all WebSocket messages:
- `handleQueueJoin`: Add to matchmaking queue, find/create match
- `handleDepositConfirm`: Mark player deposited, broadcast when both ready
- `handleStartDuel`: Load puzzle, initialize per-player puzzle state
- `handleMoveSubmit`: Validate move, handle correct/wrong/solve, load next puzzle

Per-player puzzle state:
```javascript
puzzleState.set(matchId, {
  playerAPuzzle: { fen, solution, solutionIndex },
  playerBPuzzle: { fen, solution, solutionIndex },
  playerALives: 3,
  playerBLives: 3,
})
```

### duelManager.js

Queue and matchmaking:
- `addToQueue(userId, tier)`: Add to tier queue, match if pair found
- `removeFromQueue(userId, tier)`: Remove from queue
- `getQueueStatus(tier)`: Return queue length

### duelPayoutService.js

Solana settlement:
- `settleDuel`: Transfer pot to winner
- `refundDuel`: Return stakes to both players

### puzzleLoader.js

- `getPuzzleByRating(minRating, maxRating)`: Query Supabase for puzzle in range

## Smart Contracts

### Solo Program

**Address**: [DKoawaEk5pJj1npwNYXeCCPF3Uqzxahokq67NY387qbK](https://explorer.solana.com/address/DKoawaEk5pJj1npwNYXeCCPF3Uqzxahokq67NY387qbK?cluster=devnet)

Off-chain puzzle settling via Magic Block.

### Duel Program

**Address**: [EzkHbrB8bTWPVevB9X1AySwt2fAtjqEnZkAnihjZfcEc](https://explorer.solana.com/address/EzkHbrB8bTWPVevB9X1AySwt2fAtjqEnZkAnihjZfcEc?cluster=devnet)

**Treasury**: [6kcSoKW35mTzhf8YCyGwwzPZJBMEH7cVNEZQcohZdgJk](https://explorer.solana.com/address/6kcSoKW35mTzhf8YCyGwwzPZJBMEH7cVNEZQcohZdgJk?cluster=devnet)

Manages duel escrows and settlement.

### Demo Escrow PDA

**Address**: [8iXhZUk7ZdumVE8aWiHqmMnDHdTtTbjj8YRmiAf4vdKx](https://explorer.solana.com/address/8iXhZUk7ZdumVE8aWiHqmMnDHdTtTbjj8YRmiAf4vdKx?cluster=devnet)

Demo escrow for testing duel stakes on Devnet.

## Testing

### WebSocket Testing

```bash
wscat -c ws://localhost:5000/ws/duel
{"type":"queue:join","tier":"beginner"}
```

### Manual Flow

1. Open two terminals, connect both clients
2. Both join queue → match found
3. Both confirm deposits → both:deposited
4. Both start duel → receive puzzle + timer
5. Submit moves → watch validation and opponent updates

## Deployment

### Devnet (Development)

```bash
npm run build
npm start
```

Deploy to Railway, Fly.io, or Cloudflare Workers.

### Mainnet (Production)

- Update `.env` with mainnet RPC + contract IDs
- Redeploy contracts (audit required)
- Increase stake amounts

## See Also

- [Frontend README](../frontend/README.md) – Client implementation
- [Contracts README](../crypnight-contracts/README.md) – Solana programs
- [Root README](../README.md) – Overview
