# ♟️ CrypNight.sol

**Web3 Chess Skill-to-Earn Platform on Solana**

![CrypNight](screenshots/image.png)

Players solve chess puzzles and earn SOL rewards. Compete solo or in real-time duels. No gambling, no randomness — only skill.

---

## 🎮 How It Works

1. Sign up with email + connect Phantom wallet
2. Choose skill tier (Beginner → Grandmaster)
3. Solve puzzles in Solo mode or challenge opponents in Duel mode
4. Earn SOL rewards instantly on-chain via Magic Block ER
5. Climb the leaderboard

---

## ⚡ Features

- **Solo Speed Mode** — Timed puzzle runs with adaptive difficulty
- **Duel Arena** — Real-time competitive puzzle duels with stake deposits
- **Instant Payouts** — On-chain rewards via Solana + Magic Block Ephemeral Rollups
- **Anti-Cheat** — Server-side move validation, puzzle verification
- **ELO Rating** — Adaptive per-puzzle rankings
- **Global Leaderboard** — Ranked by tier
- **Phantom Wallet Integration** — Stake deposits and rewards via Solana

---

## 🧱 Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express + WebSockets
- **Database:** Supabase (PostgreSQL)
- **Blockchain:** Solana + Anchor Framework
- **Settlement Layer:** Magic Block ER (Ephemeral Rollups for fast finality)
- **Chess Logic:** Chess.js
- **Wallet:** Phantom (Solana wallet adapter)

---

## 📁 Repo Layout

```
crypnight.sol/
├── frontend/                 # React UI — Solo & Duel modes
├── backend/                  # Express API + WebSocket server + payouts
├── crypnight-contracts/      # Anchor smart contracts (Devnet)
│   ├── programs/crypnight-contracts/  # Solo mode contract
│   └── programs/crypnight-duel/       # Duel mode contract
└── README.md
```

---

## 🔐 Smart Contracts

Deployed on **Solana Devnet**:

| Mode | Program ID | Purpose |
|------|-----------|---------|
| **Solo** | `DKoawaEk5pJj1npwNYXeCCPF3Uqzxahokq67NY387qbK` | Puzzle rewards & session management |
| **Duel** | `EzkHbrB8bTWPVevB9X1AySwt2fAtjqEnZkAnihjZfcEc` | Stake deposits, settlement, payouts |

*Replace placeholders with actual devnet program IDs after deployment.*

---

## 🚀 How to Run

**Backend:**
```bash
cd backend
npm install
# Add .env (see backend/.env.example)
node index.js
# Runs on http://localhost:5000
# WebSocket: ws://localhost:5000/ws/duel
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5174
```

**Smart Contracts (Optional):**
```bash
cd crypnight-contracts
anchor build
anchor deploy --provider.cluster devnet
```

---

## 🎯 Current Status

- ✅ Solo mode fully functional
- ✅ Duel mode (matchmaking, puzzle sharing, move validation, stake deposits)
- ✅ WebSocket real-time communication
- ✅ Leaderboard & ELO rating system
- ✅ Phantom wallet integration
- ✅ Magic Block ER integration for fast settlement


---

## 🔗 Magic Block Ephemeral Rollups (ER)

CrypNight uses **Magic Block's Ephemeral Rollups** for fast on-chain settlement:

- **Instant finality:** Puzzle results settle in milliseconds, not slots
- **Low cost:** Batch multiple duel outcomes into single ER transaction
- **No rollback risk:** Results committed to Solana after ER batch
- **Better UX:** Players see instant settlement vs. Solana's slot-based confirmation

See [Magic Block Docs](https://docs.magicblock.io) for integration details.

---

## 📖 Documentation

- **[Backend README](backend/README.md)** — API endpoints, WebSocket protocol, payout flow
- **[Frontend README](frontend/README.md)** — UI components, wallet integration, game modes
- **[Contract README](crypnight-contracts/README.md)** — Anchor programs, IDL, deployment

---

