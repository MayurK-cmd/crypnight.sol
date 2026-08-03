# CrypNight.sol — What's Built

> A single-page summary of every feature, endpoint, and storage contract
> that exists in the repo as of Phase 6 (August 2026). For deeper context
> per phase, see [`docs/PHASE1.md`](docs/PHASE1.md) through
> [`docs/PHASE6.md`](docs/PHASE6.md). For the structured technical
> snapshot, see [`PROJECT_ANALYSIS.md`](PROJECT_ANALYSIS.md).

CrypNight.sol is a Web3 chess puzzle platform on Solana. Players sign
up with email + password + username, link a Phantom wallet, choose a
skill tier, then play 10-puzzle Puzzle-Rush runs against real Lichess
puzzle data. They earn SOL per solve; rating shifts per puzzle via an
adaptive per-puzzle ELO formula; results show up on a global + per-tier
leaderboard.

---

## 🎮 Player flow

| Step | What happens | Where |
|---|---|---|
| 1 | Land on `/`, see real top-5 leaderboard with usernames, click **Get Started** | `LandingPage.jsx` |
| 2 | Create account: email + password + **unique username** (3–20 chars, lowercase a-z + digits + underscore) | `/signup` → `auth.controller.js#signup` |
| 3 | Verify email (Supabase Auth dashboard or SMTP link) | Supabase Auth |
| 4 | Login | `/login` → `auth.controller.js#login` |
| 5 | Link Phantom wallet (one-time signature) | `/setup` → `user.controller.js#linkWallet` |
| 6 | Pick tier (Beginner / Intermediate / Pro / GM) — locked after | `/setup` → `user.controller.js#setTier` |
| 7 | Play 10-puzzle Puzzle Rush runs | `/solo` |
| 8 | See match history + global leaderboard | `/match-history`, `/leaderboard` |

---

## 🧩 Solo Mode (Puzzle Rush)

A `solo_sessions` row = one 10-puzzle run. Strict mode: **one wrong
move fails the puzzle**; **three puzzle-fails in the run ends the
session**.

- Per-puzzle reward scales with tier base × solve-time factor (Phase 2)
- Per-puzzle ELO contribution summed at session end (Phase 5)
- Adaptive rating band: next puzzle targets `max(user.rating,
  last_solved_rating)` ± 200 (Phase 5)
- 10-minute session cap as a deliberate speed-run constraint
- Auto-end at 10 puzzles; no buttons for the user
- Resumes an active in-flight session across page refreshes
- Solution never sent to the browser — anti-cheat from day one

**Sidebar "Session Stats"** during a run shows Puzzle N/10, Solved/Failed
counters, session earnings. **Final summary screen** replaces the
chessboard on auto-end with Total Earned, New Rating, Solved N /
Failed M, and a "Start a New Run" button.

---

## 🏆 Leaderboard

- **Global top-N** (`GET /api/leaderboard/global?limit=50`) — top
  players by ELO across all tiers
- **Per-tier** (`GET /api/leaderboard/tier/:tier?limit=25`) — same
  ranking scoped to one tier
- **My rank** (`GET /api/leaderboard/my-rank`) — single row with
  global_rank, tier_rank, username, rating, puzzles_solved, best_streak
- **Landing page** (`/`) pulls the global top-5 on mount and shows it
  on the marketing page with real usernames
- **"Your Rank" footer card** under the top-5 when logged in (200) or
  a "Sign up to track your rank" CTA (401/404)
- **`puzzles_solved >= 5`** filter suppresses sockpuppet accounts

The data source is a single PostgreSQL view (`public.leaderboard`,
defined in `docs/migrations/solo_sessions_rewards.sql`, re-projected
with `username` in Phase 6).

---

## 👤 Identity

### Username
- **Format**: 3–20 chars, `^[a-z0-9_]+$`
- **Uniqueness**: case-insensitive via citext + `lower(username)` unique
  partial index
- **Set**: at signup, immutable for now (no PATCH endpoint yet — flagged
  for future phase)
- **Surface**: profile page, dashboard greeting ("Welcome back,
  `<username>`."), leaderboard rows, landing-page top-5

### Email + Password
- Supabase Auth with httpOnly JWT cookies (24 h)
- Strong password policy server-side (8+ chars, upper, lower, digit,
  special) via Joi
- Email verification required for `/puzzle`, `/solo/*`, `/round/*`,
  `/user/link-wallet`, `/user/set-tier`

### Wallet
- Phantom via Solana Wallet Adapter
- One-time binding via `tweetnacl + bs58` signature verification
- `walletLimiter` rate-limit on `/api/user/link-wallet`

### Tier
- One-time selection; locked after first set
- Stored as canonical short form (`pro`, `gm`) regardless of input
  (`professional`, `grandmaster` both normalize)

---

## 💰 Solana Payouts (Phase 3)

After a 10-puzzle session completes, the platform treasury (a PDA on Solana devnet)
pays the player directly in SOL minus a 3% platform fee.

- **Program ID**: `F1E8QvpUYJP71zWz4NwYpPtpUszfp8wb2nKjnrzF2Cmh` (devnet)
- **Treasury PDA**: Holds platform SOL; backend authority can call `pay_reward`
- **ER Routing**: Backend uses `ConnectionMagicRouter` to route `pay_reward` txs to MagicBlock ER endpoint (~10ms confirms) instead of base layer (~400ms)
- **Payout formula**: Scales with tier, puzzle difficulty, solve time, and wrong moves. Example: Pro tier, 1800 rating, 20s, 0 wrong = ~0.028 SOL gross, player receives ~0.027 SOL (3% fee to platform)
- **On-chain tracking**: `reward_ledger(tx_signature, on_chain_payout)` + audit logs with `PAYOUT_COMPLETED` / `PAYOUT_FAILED` events
- **Frontend**: Summary screen displays Solana Explorer link with tx signature

**How ER routing works** (see `docs/ER_BACKEND_ROUTING.md`):
- Contract is simple Anchor (no SDK macros, avoids dependency conflicts)
- Backend creates `ConnectionMagicRouter` pointing to ER endpoint
- When `pay_reward` tx targets the treasury PDA, router auto-routes to ER (~10ms)
- ER validator syncs state back to base layer asynchronously for finality

| Layer | Where |
|---|---|
| Rate limiting (auth, API, wallet) | `backend/src/middleware/rateLimiter.js` |
| Helmet + CSP + HSTS | `backend/index.js` |
| httpOnly + secure + sameSite=strict JWT cookie | `auth.middleware.js`, `auth.controller.js` |
| Joi validation on every mutating endpoint | `backend/src/middleware/validate.js` |
| Email verification gate | `requireVerified` middleware |
| Audit logging | `backend/src/utils/auditLog.js`, `audit_logs` table |
| CORS bound to env-configured origin | `backend/index.js` |
| Trust-proxy set so rate-limiter IP keying works behind Vercel/Render | `backend/index.js` |
| Solution stripped from `/puzzle` response | `puzzle.controller.js` |
| Platform authority keypair never sent to frontend | `backend/src/config/solana.js`, `backend/src/services/payoutService.js` |

`audit_logs` records SIGNUP, LOGIN, LOGIN_FAILED, LOGOUT, WALLET_LINKED,
WALLET_LINK_FAILED, TIER_SELECTED, USERNAME_SET, PUZZLE_SOLVED,
PUZZLE_FAILED, PAYOUT_COMPLETED, PAYOUT_FAILED.

---

## 🗄 Database

### `public.users`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, FK → `auth.users(id)` |
| `email` | (in auth.users only) | |
| `username` | citext | Phase 6; unique partial index on `lower(username)` |
| `wallet_address` | text | UNIQUE |
| `tier` | text | canonical `pro` / `gm`; null until setup |
| `rating` | integer | default 1000, overwritten by `setTier` |
| `is_setup_complete` | boolean | default false, true after `setTier` |
| `created_at` | timestamptz | |

### `public.solo_sessions` (Phase 2 + Phase 5)
One row per 10-puzzle run. Phase 2 columns: `solved_at`,
`solve_time_ms`, `reward_amount`, `tier`, `status`. Phase 5 columns:
`puzzles_in_session`, `puzzles_solved`, `puzzles_failed`,
`total_session_reward`, `ended_at`, `session_rating_delta`,
`current_puzzle_id`, `current_puzzle_solve_started_at`,
`current_puzzle_wrong_moves`, `last_solved_rating`,
`last_puzzle_elo_delta`.

### `public.solo_attempts`
Per-puzzle log: `(user_id, puzzle_id, solved, time_taken, created_at)`.

### `public.audit_logs` (Phase 1)
Append-only: `(user_id, action, metadata jsonb, ip_address, created_at)`.

### `public.leaderboard` (Phase 2 view, updated Phase 6)
Aggregates users + solo_sessions + solo_attempts; projects username;
filters `puzzles_solved >= 5`; ranks by rating globally and per tier.

### Migrations (apply in order)
1. `docs/migrations/audit_logs.sql`
2. `docs/migrations/solo_sessions_rewards.sql`
3. `docs/migrations/phase5_multi_puzzle_sessions.sql`
4. `docs/migrations/phase6_usernames.sql`
5. `docs/migrations/phase6_leaderboard_username.sql`

---

## 🌐 API surface

### Auth (`/api/auth`)
- `POST /signup` — body: `{ email, password, username }` → 201 + httpOnly cookie
- `POST /login` — body: `{ email, password }` → 200 + httpOnly cookie
- `POST /logout` — clears cookie

### User (`/api/user`)
- `GET /profile` — returns the full `public.users` row
- `POST /link-wallet` — body: `{ walletAddress, signature, message }`
- `POST /set-tier` — body: `{ tier }` — one-time

### Solo (`/api/solo`)
- `POST /start` — resume-or-create active session (optional `puzzle_id`)
- `POST /move` — body: `{ session_id, move }` — returns `correct`,
  `puzzle_failed`, `session_complete`, `lives_remaining`
- `POST /submit` — finalize solved puzzle; per-puzzle reward + ELO
- `POST /end` — explicit close (used by tests + cron)
- `POST /fail` — back-compat shim, forces a strike

### Puzzle (`/api/puzzle`)
- `GET /puzzle` — returns next puzzle **without the SAN solution** +
  resume-or-create `session_id`

### History (`/api/history`)
- `GET /history?page=1&limit=20` — caller's `solo_sessions` paginated,
  newest first

### Leaderboard (`/api/leaderboard`)
- `GET /global?limit=50` — top players
- `GET /tier/:tier?limit=25` — per-tier top
- `GET /my-rank` — caller's rank

---

## 🧪 Test harnesses

| Harness | What it covers |
|---|---|
| `backend/scripts/phase1_checklist.mjs` | 12 security + auth checks (Phase 1) |
| `backend/scripts/phase5_checklist.mjs` | 14 phase-5 checks: solution strip, resume, 3-strike fail, full solve, auto-end, history projection |

Both boot no server of their own — they hit the running `index.js` over
HTTP. Exit code = number of failed checks.

---

## 🛠 Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite 7 + Tailwind 4 |
| Routing | react-router 7 |
| Chess UI | react-chessboard + chess.js |
| HTTP | axios with `withCredentials` for cookie auth |
| Icons | lucide-react |
| Wallet | Solana Wallet Adapter (Phantom) |
| Backend | Node.js + Express 5 (ESM, entry `backend/index.js`) |
| Auth | Supabase Auth (HS256, JWT in httpOnly cookies) |
| DB | Supabase PostgreSQL |
| Validation | Joi |
| Rate limit | express-rate-limit |
| Wallet sig | tweetnacl + bs58 |
| Puzzles | Supabase Storage bucket `puzzles`, CSV at `lichess_puzzles.csv` |

---

## 🚧 Not built yet

- **Phase 4 — Duel Mode (PvP)**: head-to-head simultaneous-puzzle
  duels, SOL staking with Anchor escrow, WebSocket move sync,
  matchmaking by ELO. Requires real money + smart contract audits —
  out of scope for solo playtesting.
- **Phase 5 — Operations polish**: production logger (pino/winston),
  Sentry/Datadog APM, match replay from stored FEN walks.
- **Username mutability**: no `PATCH /api/user/profile` yet. Add a
  `username_set_at` column + lock-after-N-days policy before exposing.
- **Wallet-prefix leaderboard fallback**: Phase 6 uses username only.
  A future improvement is to fall back to a short wallet prefix
  (`7xKXt…kQ3p`) for legacy users without a username.
- **MagicBlock ER delegation** (Phase 3 enhancement): treasury currently
  pays on base layer (~400ms). When `ephemeral-rollups-sdk` is compatible
  with anchor-lang 1.0.2, add ER delegation for ~10ms confirms.

---

## 📂 File map (what to read first)

| Goal | File |
|---|---|
| Set up the project | `README.md` |
| One-page "what's built" | this file (`BUILT.md`) |
| Structured snapshot by phase | `PROJECT_ANALYSIS.md` |
| Database schema reference | `docs/DB.md` |
| Operator: puzzle CSV upload | `docs/PUZZLE_SETUP.md` |
| Migration ordering | `docs/migrations/` (apply in order) |
| Per-phase implementation specs | `docs/PHASE1.md` … `docs/PHASE6.md` |
| Phase 6 changes in detail | `docs/PHASE6.md` |
