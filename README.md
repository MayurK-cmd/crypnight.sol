\

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

* Tier-based rating system
* Performance tracking
* Match history
* Global leaderboard (planned)
* ELO-based scaling (planned)

---

# 🔒 Anti-Cheat System

CrypNight.sol uses multi-layer protection:

* Server-side move validation
* Signature verification
* Solve time anomaly detection
* Puzzle hash locking
* Engine accuracy comparison (planned)

---

# 💰 Revenue Model

Platform earns:

* **2% commission** on Duel Mode pools
* **3% commission** on Solo Mode rewards

All payouts handled via Solana smart contracts.

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
* Anchor Framework (planned)
* Escrow-based smart contracts (planned)

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
node src/server.js
```

---

## 3️⃣ Frontend Setup (Bun)

```bash
cd frontend
bun install
bun run dev
```

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

