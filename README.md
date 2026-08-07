# Crypnight � Solana Chess Puzzle Platform

A decentralized chess puzzle platform on Solana featuring solo training mode and competitive duel mode with real-time WebSocket gameplay.

## Overview

**Crypnight** lets players solve rated chess puzzles in two modes:

- **Solo Mode**: Race against a timer, build streaks, earn rewards. Integrates with Magic Block for on-chain settlement.
- **Duel Mode**: Head-to-head competitive matches with SOL stakes. 3-minute timer, 3 lives per player, puzzle racing mechanic.

Players connect their Phantom wallet, complete puzzles, and earn rewards on Devnet. Both modes feature real-time move validation and automatic progression through a curated puzzle database.

## Magic Block Integration (Solo Mode)

Crypnight uses **Magic Block Event Relay (ER)** for off-chain puzzle computation and verification in Solo mode:

### How It Works

1. **Off-Chain Compute**: Player solves puzzles locally in the browser. The backend submits puzzle results to Magic Block's Event Relay.
2. **Proof Generation**: Magic Block computes a cryptographic proof of the puzzle results off-chain, then returns it to the backend.
3. **On-Chain Settlement**: The backend forwards the proof to the Solana program, which verifies it and settles rewards on-chain.

### Benefits

- **Performance**: Puzzle computation happens off-chain, keeping transaction costs low and settlement instant
- **Scalability**: Off-chain compute removes load from the blockchain, allowing thousands of concurrent players
- **Security**: Magic Block's proof system ensures integrity without trusting centralized servers
- **Decentralization**: On-chain verification means results are tamper-proof and auditable on-chain

### Architecture

```
Player (Browser)
    ↓ solves puzzles locally
Backend (Express server)
    ↓ submits results
Magic Block Event Relay (ER)
    ↓ computes proof
Returns proof to backend
    ↓ forwards proof
Solana Program (Solo Program)
    ↓ verifies proof, settles rewards
User wallet receives SOL
```

### Configuration

Magic Block ER is configured in backend `.env`:
```
MAGICBLOCK_ROUTER_URL=https://devnet-router.magicblock.app
MAGICBLOCK_WS_URL=wss://devnet-router.magicblock.app
```

See **[Contracts README](./crypnight-contracts/README.md)** for detailed proof verification logic and **[Backend README](./backend/README.md)** for ER integration code.

## Quick Start

### Prerequisites
- Node.js 18+
- Phantom wallet (browser extension)

### Installation

``ash
# Backend
cd backend && npm install && npm run dev

# Frontend (new terminal)
cd frontend && npm install && npm run dev
``

Visit \http://localhost:5173\ and connect your Phantom wallet.

## Key Features

### Solo Mode
- Rated puzzle progression (100�2800 ELO)
- 3-minute timer per session
- Streak tracking and reward multiplier
- Magic Block integration for off-chain compute and on-chain settlement
- Real-time board state sync

### Duel Mode
- Tier-based matchmaking (Beginner ? Grandmaster)
- SOL stakes: 0.05 ? 0.50 SOL per tier
- Per-player independent puzzle queues
- 3 lives per player (3 wrong moves = elimination)
- Draw refund logic (equal puzzles = both refunded)
- Winner takes pot
- Real-time WebSocket move broadcasting
- Board blur when waiting for opponent to finish

## Smart Contracts

All contracts deployed on **Devnet**.

### Solo Program
**Address:** [\DKoawaEk5pJj1npwNYXeCCPF3Uqzxahokq67NY387qbK\](https://explorer.solana.com/address/DKoawaEk5pJj1npwNYXeCCPF3Uqzxahokq67NY387qbK?cluster=devnet)

Handles off-chain puzzle settling and reward distribution via Magic Block.

### Duel Program
**Address:** [\EzkHbrB8bTWPVevB9X1AySwt2fAtjqEnZkAnihjZfcEc\](https://explorer.solana.com/address/EzkHbrB8bTWPVevB9X1AySwt2fAtjqEnZkAnihjZfcEc?cluster=devnet)

Manages escrow accounts and dispute resolution for duel matches.

**Duel Treasury PDA:** [\6kcSoKW35mTzhf8YCyGwwzPZJBMEH7cVNEZQcohZdgJk\](https://explorer.solana.com/address/6kcSoKW35mTzhf8YCyGwwzPZJBMEH7cVNEZQcohZdgJk?cluster=devnet)

### Demo Escrow PDA
**Address:** [\8iXhZUk7ZdumVE8aWiHqmMnDHdTtTbjj8YRmiAf4vdKx\](https://explorer.solana.com/address/8iXhZUk7ZdumVE8aWiHqmMnDHdTtTbjj8YRmiAf4vdKx?cluster=devnet)

Demo escrow for testing duel stakes on Devnet.

## Documentation

- **[Backend README](./backend/README.md)** � API reference, services, WebSocket protocol
- **[Frontend README](./frontend/README.md)** � Components, hooks, game mechanics
- **[Contracts README](./crypnight-contracts/README.md)** � Program logic, accounts, instructions

## License

MIT
