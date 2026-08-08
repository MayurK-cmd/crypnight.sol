# Crypnight ♟️

Solana-based chess puzzle platform with real-time competitive duels, stake-based rewards, and off-chain compute verification via Magic Block.

## Features

- **Solo Mode**: Race against the clock to solve chess puzzles, earn streaks and rewards
- **Duel Mode**: Challenge opponents with stake-based matches, independent lives system (3 strikes), winner-take-all payouts
- **Magic Block Integration**: Off-chain puzzle computation and verification for efficient on-chain settlement
- **Phantom Wallet**: Seamless wallet connection and SOL stake management
- **Real-time WebSocket**: Live opponent moves, instant puzzle progression, reliable game state sync

## Tech Stack

- **Frontend**: React 18 + Vite, TailwindCSS, react-chessboard
- **Backend**: Express.js + WebSocket (ws), Supabase PostgreSQL
- **Blockchain**: Solana Devnet, Anchor framework, Magic Block Event Relay
- **Games**: chess.js for move validation, FEN notation for board state

## Quick Start

### Prerequisites
- Node.js 18+
- Phantom wallet browser extension
- Solana Devnet RPC access

### Installation

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

Backend runs on `http://localhost:5000`, frontend on `http://localhost:5173`.

## Magic Block Integration

Crypnight uses **Magic Block** for off-chain puzzle computation and verification, enabling efficient on-chain settlement without computationally expensive operations on Solana.

### How It Works

1. **Puzzle Submission**: Backend submits solo session puzzle results to Magic Block Event Relay (ER)
2. **Off-chain Compute**: Magic Block computes and verifies the solution proof off-chain
3. **Proof Generation**: Magic Block returns cryptographic proof to backend
4. **On-chain Settlement**: Backend forwards proof to Solana smart contract (`settle_solo` instruction)
5. **Reward Distribution**: Program verifies proof and transfers earned SOL to user's rewards account

### Key Benefits

- **Scalability**: Complex puzzle verification happens off-chain, not in contract instructions
- **Cost Efficiency**: Reduced on-chain transaction sizes and compute units
- **Security**: Cryptographic proofs ensure integrity of off-chain computation
- **Flexibility**: Backend can adjust puzzle difficulty without contract redeployment

### Architecture Diagram

```
User Session → Backend → Magic Block ER → Proof Generation
                             ↓
                         Off-chain Compute
                             ↓
                        Cryptographic Proof
                             ↓
Backend receives proof → submit to settle_solo → Program verifies → Rewards transferred
```

### Configuration

Set these environment variables in backend `.env`:

```env
MAGICBLOCK_ROUTER_URL=https://devnet-router.magicblock.app
MAGICBLOCK_WS_URL=wss://devnet-router.magicblock.app
```

See [Backend README](./backend/README.md#magic-block-integration) for detailed setup.

## Game Modes

### Solo Mode

Race against a 3-minute timer to solve as many puzzles as possible. Earn streak multipliers:

- 1 puzzle: 1x reward
- 2-3 puzzles: 1.25x multiplier
- 4+ puzzles: 1.5x multiplier

Rewards settled via Magic Block and distributed on-chain.

### Duel Mode

Head-to-head matches with SOL stakes:

- **Tier Selection**: Beginner (0.05 SOL) → Intermediate (0.10) → Pro (0.25) → Grandmaster (0.50)
- **Lives System**: Each player has 3 independent lives; 3 wrong moves = elimination
- **Puzzle Progression**: Per-player independent puzzles; solving one loads your next puzzle only
- **Winner Determination**: Most puzzles solved in 3 minutes wins the pot (2x stake)
- **Draw**: Equal puzzle count triggers refund to both players
- **Board State**: Opponent's board blurs when eliminated; winner can continue solving

Full duel flow: tier selection → matchmaking → deposit confirmation → game start → puzzle solving → settlement.

## Smart Contracts

### Solo Program

**Address**: [DKoawaEk5pJj1npwNYXeCCPF3Uqzxahokq67NY387qbK](https://explorer.solana.com/address/DKoawaEk5pJj1npwNYXeCCPF3Uqzxahokq67NY387qbK?cluster=devnet)

Off-chain puzzle settling and reward distribution via Magic Block. [View on Solana Explorer](https://explorer.solana.com/address/DKoawaEk5pJj1npwNYXeCCPF3Uqzxahokq67NY387qbK?cluster=devnet).

### Duel Program

**Address**: [EzkHbrB8bTWPVevB9X1AySwt2fAtjqEnZkAnihjZfcEc](https://explorer.solana.com/address/EzkHbrB8bTWPVevB9X1AySwt2fAtjqEnZkAnihjZfcEc?cluster=devnet)

Manages duel escrows and settlement logic. [View on Solana Explorer](https://explorer.solana.com/address/EzkHbrB8bTWPVevB9X1AySwt2fAtjqEnZkAnihjZfcEc?cluster=devnet).

**Treasury PDA**: [6kcSoKW35mTzhf8YCyGwwzPZJBMEH7cVNEZQcohZdgJk](https://explorer.solana.com/address/6kcSoKW35mTzhf8YCyGwwzPZJBMEH7cVNEZQcohZdgJk?cluster=devnet) — Holds duel match escrows. [View on Solana Explorer](https://explorer.solana.com/address/6kcSoKW35mTzhf8YCyGwwzPZJBMEH7cVNEZQcohZdgJk?cluster=devnet).

**Demo Escrow PDA**: [8iXhZUk7ZdumVE8aWiHqmMnDHdTtTbjj8YRmiAf4vdKx](https://explorer.solana.com/address/8iXhZUk7ZdumVE8aWiHqmMnDHdTtTbjj8YRmiAf4vdKx?cluster=devnet) — Testing escrow for Devnet. [View on Solana Explorer](https://explorer.solana.com/address/8iXhZUk7ZdumVE8aWiHqmMnDHdTtTbjj8YRmiAf4vdKx?cluster=devnet).

## Project Structure

```
crypnight.sol/
├── backend/              # Express.js + WebSocket server
│   ├── src/
│   │   ├── controllers/  # Duel settlement, user endpoints
│   │   ├── services/     # WebSocket handlers, matchmaking, Solana settlement
│   │   ├── routes/       # API and WebSocket route definitions
│   │   ├── config/       # Solana + Supabase setup
│   │   └── utils/        # Helpers (rewards calculator, validators)
│   └── package.json
├── frontend/             # React 18 + Vite
│   ├── src/
│   │   ├── components/   # Solo, Duel, Dashboard components
│   │   ├── hooks/        # useDuelSocket, useAuth
│   │   ├── context/      # AuthContext
│   │   ├── api/          # Axios client
│   │   └── App.jsx
│   └── package.json
├── crypnight-contracts/  # Solana programs (Rust/Anchor)
│   ├── programs/
│   │   ├── crypnight-solo/
│   │   └── crypnight-duel/
│   ├── Cargo.toml
│   └── Anchor.toml
└── README.md             # This file
```

## Environment Configuration

See individual component READMEs for detailed env setup:

- [Backend .env](./backend/README.md#environment-configuration)
- [Frontend .env](./frontend/README.md#environment-configuration)
- [Contracts setup](./crypnight-contracts/README.md#building--deploying)

## Documentation

- [**Backend README**](./backend/README.md) — API reference, WebSocket protocol, services documentation
- [**Frontend README**](./frontend/README.md) — Components, hooks, game mechanics, UI testing guide
- [**Contracts README**](./crypnight-contracts/README.md) — Program addresses, account structures, instruction reference, security
- [**Deployment Guide**](./DEPLOY.md) — Production deployment steps for Vercel, Railway, Cloudflare Workers

## Testing

### Manual Duel Flow

1. Open two browsers (or incognito + normal)
2. Both connect Phantom wallet
3. Both select same tier
4. Both confirm stakes → approve Phantom transaction
5. Both click "Start Duel"
6. Play moves on both sides; verify:
   - Opponent's moves auto-play on your board
   - Lives decrement on wrong moves
   - New puzzle loads only for the player who failed
   - Board blurs when one player reaches 0 lives
   - Settlement called when time expires or one player eliminated

### Draw Scenario

1. Both players solve same number of puzzles
2. Let timer expire
3. Verify both see "Draw" result
4. Verify stakes refunded to both wallets

### Elimination Test

1. One player makes 3 wrong moves
2. That player's board blurs with "Waiting for opponent to finish"
3. Other player continues playing
4. Verify correct player wins when timer expires

## Deployment

See [DEPLOY.md](./DEPLOY.md) for:

- Vercel frontend deployment
- Backend options (Cloudflare Workers, Railway, Fly.io)
- Environment setup for production
- Mainnet migration checklist

## Development

### Building Contracts

```bash
cd crypnight-contracts
anchor build
```

### Running Tests

```bash
cd crypnight-contracts
anchor test
```

### Dev Server

Backend and frontend run with hot reload:

```bash
npm run dev
```

## Security & Audits

- Escrow is a PDA (deterministic from match_id, no direct withdrawals)
- Settlement requires authority signer (backend only)
- Player wallets sign all stake deposits
- Timestamp validation prevents replay attacks
- Magic Block proofs cryptographically verified on-chain

For mainnet deployment, smart contracts require professional security audit.

## Contributing

Contributions welcome. Before submitting, ensure:

- Code passes linter and type checks
- Manual game flow tested in two browsers
- No console logs in production code (backend logs are fine)

## License

MIT

## Support

For issues or questions:

- Check [Backend README](./backend/README.md) for API troubleshooting
- Check [Frontend README](./frontend/README.md) for UI issues
- Check [Contracts README](./crypnight-contracts/README.md) for blockchain issues
- Review [DEPLOY.md](./DEPLOY.md) for deployment problems
