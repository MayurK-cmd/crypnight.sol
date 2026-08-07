# Crypnight Frontend

React 18 + Vite frontend for Crypnight chess puzzle platform with Phantom wallet integration, real-time WebSocket gameplay, and responsive chessboard UI.

## Overview

The frontend provides:
- **Authentication**: Phantom wallet connection via Supabase
- **Solo Mode**: Timer-based puzzle solving with streak tracking
- **Duel Mode**: Real-time matchmaking, tier selection, stake confirmation, per-player independent puzzles
- **Game UI**: React Chessboard with move validation, turn indicators, lives display
- **WebSocket**: Real-time opponent moves, puzzle progression, game state sync

## Tech Stack

- **Framework**: React 18, Vite
- **UI Library**: TailwindCSS, Lucide React icons
- **Chess**: chess.js for validation, react-chessboard for board rendering
- **HTTP**: Axios
- **Wallet**: Phantom wallet adapter for Solana

## Getting Started

### Prerequisites
- Node.js 18+
- Phantom wallet (browser extension)
- Backend running on localhost:5000

### Installation

\\\ash
npm install
npm run dev
\\\

App runs on \http://localhost:5173\.

## Environment Configuration

\\\env
VITE_BACKEND_PORT=5000
VITE_DUEL_ESCROW_PDA=8iXhZUk7ZdumVE8aWiHqmMnDHdTtTbjj8YRmiAf4vdKx
\\\

## Project Structure

\\\
src/
+-- components/
¦   +-- gameModes/
¦   ¦   +-- Solo.jsx           # Solo mode UI and gameplay
¦   ¦   +-- Duel.jsx           # Duel mode UI and gameplay
¦   ¦   +-- Dashboard.jsx      # Stats and mode selection
¦   +-- auth/
¦   ¦   +-- LoginPage.jsx      # Phantom wallet connection
¦   ¦   +-- ProtectedRoute.jsx # Auth guard wrapper
¦   +-- common/
¦       +-- Navbar.jsx         # Top navigation
¦       +-- LoadingSpinner.jsx # Loading states
+-- hooks/
¦   +-- useDuelSocket.js       # WebSocket duel connection and messaging
¦   +-- useAuth.js             # Authentication state
¦   +-- useLocalStorage.js     # Persist user preferences
+-- context/
¦   +-- AuthContext.jsx        # Global auth state
+-- api/
¦   +-- axios.js               # API client with auth headers
+-- App.jsx                    # Main router and layout
+-- main.jsx                   # Entry point
\\\

## Key Components

### Duel.jsx
Complete duel flow with state machine:
- **tier_select**: User chooses stake tier (Beginner ? Grandmaster)
- **queuing**: Waiting for opponent match
- **match_found**: Opponent details shown, "Confirm & Stake" button
- **waiting_both**: Both players' deposit status, "Start Duel" button
- **game**: Real-time chess gameplay with 3-minute timer
- **ended**: Results, stats, and payout confirmation

Features:
- Tier-based stakes: 0.05 ? 0.50 SOL
- Phantom wallet integration for stake confirmation
- Per-player lives display (3 circles, green=alive, gray=used)
- Turn indicator (white dot/black dot for whose move)
- Left sidebar: your progress + opponent progress
- Board blur when opponent out of lives
- Timer countdown (3 minutes)

### Solo.jsx
Solo mode puzzle racing:
- Puzzle rating selection (100–2800 ELO)
- 3-minute timer per session
- Streak tracking and reward multiplier
- Real-time puzzle progression
- Magic Block integration for settlement

### useDuelSocket.js
WebSocket hook managing duel connection and all game messaging:

\\\javascript
const {
  socket,
  joinQueue,                // (tier) ? queue:join
  confirmDeposit,           // (matchId, txSig) ? deposit:confirm
  startDuel,                // (matchId) ? duel:start
  submitMove,               // (matchId, move) ? move:submit
  onMatchFound,             // callback(data) ? match:found
  onDuelStart,              // callback(data) ? duel:start
  onPuzzleSolved,           // callback(data) ? puzzle:solved
  onPuzzleFailed,           // callback(data) ? puzzle:failed
  onOpponentReply,          // callback(data) ? opponent events
  onDuelEnded,              // callback(data) ? duel:ended
} = useDuelSocket();
`

## Game Mechanics

### Duel Mode Flow

**Queue & Match:**
1. Select tier ? joinQueue(tier)
2. Backend matches players, sends match:found
3. Show opponent details, "Confirm & Stake" button

**Deposit:**
1. Click "Confirm & Stake" ? sendTransaction via Phantom
2. confirmDeposit(matchId, txSignature) sent to backend
3. When both deposited, both receive both:deposited
4. "Start Duel" button enabled

**Game:**
1. startDuel(matchId) ? receive puzzle + timer
2. Drag pieces or click to move
3. submitMove(matchId, move) sent to backend
4. Backend validates move against solution
5. Correct move: receive next auto-move in solution sequence
6. Wrong move: lose 1 life, new puzzle loaded for you only
7. 0 lives: board blurs, wait for opponent
8. Timer expires or opponent out of lives: game ends
9. Settlement called, winner/draw determined

### Piece Dragging Logic
- Only your color pieces draggable (playerColor check)
- No moves if you've used all lives (playerLives <= 0)
- Move validation happens on backend (solution validation)

### Board Orientation
- Set by puzzle FEN's second token (w=white, b=black)
- Chessboard boardOrientation prop: "white" or "black"

### Lives Display
- 3 green circles = all lives remaining
- Grayed out circle = life used
- 0 remaining = elimination (board blurs, "Waiting for opponent")

### Turn Indicator
- Derives from FEN's second token
- Displays colored dot: white or black
- Shows "White to move" or "Black to move"

## API Integration

### Authentication
- Phantom wallet connection sets \uth_token\ httpOnly cookie
- Axios client automatically includes cookie in all requests

### Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| POST /api/user/register | Create user on first Phantom login |
| GET /api/user/profile | Fetch user stats |
| GET /api/leaderboard | Fetch top 100 players |
| POST /api/duel/settle | Call after game ends (timer or elimination) |

## WebSocket Connection

\\\javascript
// Auto-connects on mount
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const url = \\//\:\/ws/duel\;
\\\

## Testing

### Manual Duel Flow
1. Open two browsers (or incognito + normal window)
2. Both connect Phantom wallet
3. Both select same tier (e.g., "Beginner")
4. Both click "Confirm & Stake" ? approve Phantom transaction
5. Both see "Start Duel" button enabled
6. Both click "Start Duel" ? puzzle loads
7. Play moves on both sides
8. Verify:
   - Opponent's moves auto-play on your board
   - Lives decrement on wrong moves
   - New puzzle loads after solving
   - Board blurs when one player reaches 0 lives

### Draw Scenario
1. Play until both players have solved same number of puzzles
2. Let timer expire
3. Both should see "Draw" result
4. Verify stakes returned to both wallets (settlement endpoint called)

### Elimination Test
1. One player makes 3 wrong moves
2. That player reaches 0 lives
3. Other player's board should blur
4. Text "Waiting for opponent to finish" displayed
5. First player continues playing, solves more puzzles
6. Timer expires ? first player wins (more puzzles solved)

## Smart Contracts

### Solo Program
**Address:** [\DKoawaEk5pJj1npwNYXeCCPF3Uqzxahokq67NY387qbK\](https://explorer.solana.com/address/DKoawaEk5pJj1npwNYXeCCPF3Uqzxahokq67NY387qbK?cluster=devnet)

Off-chain puzzle settling via Magic Block.

### Duel Program
**Address:** [\EzkHbrB8bTWPVevB9X1AySwt2fAtjqEnZkAnihjZfcEc\](https://explorer.solana.com/address/EzkHbrB8bTWPVevB9X1AySwt2fAtjqEnZkAnihjZfcEc?cluster=devnet)

**Treasury:** [\6kcSoKW35mTzhf8YCyGwwzPZJBMEH7cVNEZQcohZdgJk\](https://explorer.solana.com/address/6kcSoKW35mTzhf8YCyGwwzPZJBMEH7cVNEZQcohZdgJk?cluster=devnet)

Manages duel escrows and settlement.

### Demo Escrow PDA
**Address:** [\8iXhZUk7ZdumVE8aWiHqmMnDHdTtTbjj8YRmiAf4vdKx\](https://explorer.solana.com/address/8iXhZUk7ZdumVE8aWiHqmMnDHdTtTbjj8YRmiAf4vdKx?cluster=devnet)

Demo escrow for testing duel stakes on Devnet.

## Build & Deploy

### Development
\\\ash
npm run dev
\\\

### Production Build
\\\ash
npm run build
npm run preview
\\\

Deploy to Vercel or Netlify:
\\\ash
# Vercel
vercel deploy --prod
\\\

Update env vars in hosting platform (VITE_BACKEND_PORT, VITE_DUEL_ESCROW_PDA).

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Phantom not connecting | Wallet not installed/enabled | Install extension, reload page |
| Can't find opponent | Backend not running or RPC issue | Check backend logs, verify RPC URL |
| Moves not validating | Backend move:submit handler failing | Check backend logs, verify puzzle FEN correct |
| Board not blurring when opponent out | Event not received | Check browser DevTools WebSocket tab |
| Timer not counting down | useEffect not running | Check console for errors in game state |

## See Also

- [Backend README](../backend/README.md) — API and WebSocket protocol
- [Contracts README](../crypnight-contracts/README.md) — Solana programs
- [Root README](../README.md) — Overview
