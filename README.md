# ♟️ CrypNight.sol

### Web3 Chess Skill-to-Earn Platform on Solana

CrypNight.sol is a decentralized chess puzzle platform built on **Solana**, where players compete using skill — not luck.

Users authenticate with email, connect their **Phantom Wallet**, solve tactical chess puzzles, and earn rewards by outperforming opponents in speed and accuracy.

CrypNight combines:

> ⚡ Competitive Gaming
> 🧠 Chess Intelligence
> 🔗 Web3 Infrastructure
> 💰 Skill-Based Rewards

---

## 🚀 Vision

To create the world’s first fully skill-based chess earning platform on Solana — where intelligence determines rewards.

No gambling.
No randomness.
Only skill.

---

# 🎮 Core Game Modes

## 🧩 Solo Speed Mode (Skill-to-Earn)

Players solve puzzles individually.

Reward calculation is based on:

* ⏱️ Solve time
* ♟️ Puzzle difficulty rating
* 📈 Player tier
* 🎯 Accuracy

Higher difficulty + faster solve = higher reward multiplier.

---

## ⚔️ Duel Mode (PvP)

Two players stake SOL and compete on the same puzzle.

* Both players receive identical puzzle
* Timer starts simultaneously
* Fastest correct solution wins
* Smart contract handles escrow + payout
* Platform fee automatically deducted

---

# 🔐 Authentication Flow

CrypNight.sol uses a hybrid identity system:

### 1️⃣ Email Authentication

* Secure signup & login
* JWT-based session validation
* Supabase Auth

### 2️⃣ Wallet Linking

* Phantom wallet integration
* Message signing verification
* One-time wallet binding
* Prevents wallet spoofing

### 3️⃣ Tier Selection (One-Time)

Players choose their skill tier:

* Beginner
* Intermediate
* Pro
* Grandmaster

Tier is locked after selection.

---

# 🏆 Ranking System

* Tier-based rating system with adaptive per-puzzle ELO (Phase 5)
* Match history — one card per 10-puzzle run
* Global + per-tier leaderboard, top players surface on the landing page
* `puzzles_solved >= 5` filter suppresses sockpuppet accounts from the board
* Username is the public identity on the leaderboard (Phase 6)

---

# 👤 Usernames

Every account gets a unique handle at signup.

* 3–20 characters, lowercase a-z, digits, underscore
* Case-insensitive uniqueness (`chessKing` and `chessking` collide)
* Lowercased server-side; rendered lowercase everywhere
* Surfaced on `/profile`, the dashboard greeting, the in-app leaderboard,
  and the landing-page top-5

---

# 🔒 Anti-Cheat System

CrypNight.sol uses multi-layer protection:

* Server-side move validation
* Signature verification
* Solve time anomaly detection
* Puzzle hash locking
* **The SAN solution is never sent to the browser** (Phase 5) — the
  client receives only `puzzle_id` + `fen` + `rating` + `themes`, the
  moves stay on the server

---

# 💰 Revenue Model

Platform earns:

* **2% commission** on Duel Mode pools
* **3% commission** on Solo Mode rewards

All payouts handled via Solana smart contracts on Magic Block ER.

---

# 💸 On-Chain Payout System

## Architecture

Payouts are executed on **Magic Block ER** (Ephemeral Rollups) — an isolated shard network for CrypNight.

### 3 Accounts Involved

| Account | Role | Details |
|---------|------|---------|
| **Authority** | Fee payer & signer | Authorizes and pays transaction fees. Stored in `PLATFORM_AUTHORITY_PRIVATE_KEY` env var |
| **Treasury PDA** | Reward pool | PDA (Program Derived Address) holding SOL for all payouts. Derived from seed `platform_treasury` |
| **Player Wallet** | Recipient | Player's Phantom wallet address; receives SOL after solving a puzzle |

### Flow

1. Player solves a puzzle in Solo mode
2. Backend calculates reward (based on difficulty, tier, solve time)
3. Backend calls `payReward(playerWallet, rewardSOL)`
4. Authority signs the transaction
5. Instruction sent to Magic Block ER (via `erConnection`)
6. Program: debits Treasury PDA, credits Player wallet
7. 3% platform fee retained, remainder transferred to player
8. Transaction confirmed on ER shard (~1-2s with `commitment: 'confirmed'`)

### Magic Block ER Role

Magic Block ER is a **separate execution shard** from regular Solana devnet. The treasury account and program state live exclusively on the ER shard. This provides:

- **Isolated state** — CrypNight's game state doesn't compete with mainnet traffic
- **Optimized for gaming** — low-latency, gameplay-specific execution
- **Reduced fees** — ephemeral rollups have lower transaction costs than mainnet

### Transaction Speed

~1-2 seconds to confirmation (with `commitment: 'confirmed'`). This is typical for ER shards, which prioritize finality and state isolation over sub-100ms latency.

### Setup

Treasury must be initialized with the correct authority:

```bash
cd crypnight-contracts
node scripts/fund-treasury.js  # Fund existing treasury
```

Backend requires `.env`:

```
SOLANA_PROGRAM_ID=DKoawaEk5pJj1npwNYXeCCPF3Uqzxahokq67NY387qbK
PLATFORM_TREASURY_PUBKEY=omyRQ6Ynne5seohfqiMQRPyaMuSkPDi9gksUeKm4oi6
PLATFORM_AUTHORITY_PRIVATE_KEY=<base58-encoded-secret-key>
MAGICBLOCK_ROUTER_URL=https://devnet-router.magicblock.app
MAGICBLOCK_WS_URL=wss://devnet-router.magicblock.app
```

Test payouts with:

```bash
cd backend
node test-payout-cjs.js
```

---

# 🧱 Tech Stack

## 🖥 Frontend

* React (Vite)
* Bun runtime
* Solana Wallet Adapter
* React Router
* Axios
* Chessboard integration (planned)

## ⚙ Backend

* Node.js + Express
* Supabase (PostgreSQL + Auth)
* JWT authentication
* Signature verification (tweetnacl + bs58)
* WebSocket (planned)

## 🔗 Blockchain

* Solana (Devnet → Mainnet)
* Anchor Framework
* Magic Block ER (Ephemeral Rollups) for payouts
* Smart contracts: payout instruction + treasury PDA

---

# 🧪 Local Development Setup

## 1️⃣ Clone Repository

```bash
git clone https://github.com/your-username/crypnight.sol.git
cd crypnight.sol
```

---

## 2️⃣ Backend Setup

```bash
cd backend
npm install
```

Create `.env`:

```
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Run backend:

```bash
node index.js
```

> The actual entry is `backend/index.js`. `src/server.js` does not exist.

---

## 3️⃣ Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

(Bun also works — the project doesn't depend on Bun-specific features,
so vanilla `npm` is the lowest-friction path.)

---

# 📚 Docs

| Doc | Purpose |
|---|---|
| [`docs/PHASE1.md`](docs/PHASE1.md) | Security hardening (rate limiting, JWT cookies, helmet, audit logs) |
| [`docs/PHASE2.md`](docs/PHASE2.md) | Solo reward loop + history + leaderboard view |
| [`docs/PHASE5.md`](docs/PHASE5.md) | Puzzle-Rush solo mode (10 puzzles, strict mode, anti-cheat, adaptive ELO) |
| [`docs/PHASE6.md`](docs/PHASE6.md) | Polish pass — usernames, real leaderboard on landing, CSS audit |
| [`docs/PUZZLE_SETUP.md`](docs/PUZZLE_SETUP.md) | Operator guide: Supabase Storage bucket + CSV format |
| [`docs/DB.md`](docs/DB.md) | Schema reference (context only — not a migration script) |
| [`docs/migrations/`](docs/migrations/) | Ordered `.sql` files; apply in sequence in the Supabase SQL editor |
| [`PROJECT_ANALYSIS.md`](PROJECT_ANALYSIS.md) | Snapshot of what's built, organized by phase |

---

# 🌍 Deployment

Frontend:

* Vercel

Backend:

* Render 

Database:

* Supabase

---

# 🧠 Architecture Overview

```
User
 ↓
React Frontend
 ↓
Express Backend
 ↓
Supabase (Auth + DB)
 ↓
Solana Smart Contracts (Planned)
```

---

# 🛡 Security Principles

* Never trust frontend
* All business logic validated server-side
* Wallet ownership verified via signature
* Smart contracts handle all financial transactions
* No private keys stored server-side

---

# 📜 License

MIT License

