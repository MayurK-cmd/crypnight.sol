# ♟️ crypnight.sol — Web3 Chess Skill-to-Earn Platform

crypnight.sol is a decentralized chess puzzle platform built on **Solana** where players compete using skill instead of luck. Users connect their **Phantom Wallet**, solve chess puzzles in real-time, and earn SOL by outperforming opponents in speed and accuracy.

This platform combines **Web3 payments + competitive gaming + chess intelligence** into a fast-paced skill-based ecosystem.

---

## 🚀 Features

### 🔐 Wallet Authentication
- Phantom Wallet integration
- Secure Solana wallet-based login
- No email/password required

---

### ⚔️ Puzzle Duel Mode (PvP)

Two players stake SOL and compete:

- Same chess puzzle is served
- Fastest correct solver wins
- Winner receives total pool (minus platform fee)
- Smart contract enforces fairness

---

### 🧩 Solo Speed Mode (Skill-to-Earn)

Players solve puzzles solo:

Rewards depend on:
- ⏱️ Solve time
- ♟️ Puzzle difficulty rating
- 📈 Player performance ranking

Higher skill = higher reward.

---

### 🏆 Ranking & Rating System

- Global leaderboard
- ELO-based puzzle rating
- Player skill tiers
- Seasonal rewards (optional)

---

### 🔒 Anti-Cheat Protection

- Move validation engine
- Server-side answer verification
- Timer synchronization
- Puzzle hash locking

---

## 🧱 Tech Stack

### Frontend
- React + Vite
- Tailwind CSS
- Solana Wallet Adapter
- Chessboard.js / React Chessboard
- WebSocket for real-time duels

---

### Backend
- Node.js + Express
- WebSocket server (Socket.IO)
- PostgreSQL / MongoDB
- Redis (matchmaking + caching)

---

### Blockchain
- Solana
- Anchor Framework
- Phantom Wallet
- SPL Tokens (optional reward token)

---

## 🗂️ Project Structure

