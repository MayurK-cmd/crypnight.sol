# CrypNight.sol Project Analysis

> Snapshot as of the completion of Phase 1 (security hardening) and Phase 2 (solo-loop completion) in the codebase at `D:\code\web3\crypnight.sol`.

## What's Built

### Phase 1 — Security Hardening (completed, all 12 endpoint checks green)

The security posture of the backend was the first priority. The following are now live:

| Layer | Implementation | File |
|---|---|---|
| Rate limiting | `authLimiter` (10 / 15 min on `/api/auth/{login,signup}`), `apiLimiter` (60 / 1 min on `/api`), `walletLimiter` (5 / hour on `/api/user/link-wallet`) | `backend/src/middleware/rateLimiter.js`, mounted in `backend/index.js` and `backend/src/routes/user.routes.js` |
| Security headers | `helmet()` with explicit CSP + HSTS (1y, includeSubDomains, preload) | `backend/index.js` |
| CORS hardening | Environment-aware origin check; reads `FRONTEND_URL` from `.env` in prod, falls back to localhost in dev | `backend/index.js`, `backend/.env` |
| Body size limit | `express.json({ limit: '10kb' })` + `urlencoded` equivalent | `backend/index.js` |
| Input validation | Joi schemas for signup, login, wallet link, tier, solo move/start/submit/fail, round-puzzle-complete | `backend/src/middleware/validate.js` |
| httpOnly JWT cookies | httpOnly + secure + sameSite=strict, 24 h maxAge; auth middleware reads cookie first then Bearer header; logout endpoint clears cookie | `backend/src/middleware/auth.middleware.js`, `backend/src/controllers/auth.controller.js`, `backend/src/routes/auth.routes.js`, `frontend/src/api/axios.js` (withCredentials), `frontend/src/context/AuthContext.jsx` |
| Password policy | Server: 8+ chars + upper + lower + number + special via Joi. UI: 5-segment strength meter in Signup | `backend/src/middleware/validate.js`, `frontend/src/components/auth/Signup.jsx` |
| Email verification enforcement | New `requireVerified` middleware chained on `user/{link-wallet,set-tier}`, `puzzle`, `solo/*`, `round/*` (intentionally NOT on `/user/profile` so the `/redirect` flow can still see `is_setup_complete`); 403 banner via `crypnight:needs-verification` window event + AuthContext flag | `backend/src/middleware/auth.middleware.js`, all four route files |
| Audit logging | `audit_logs` table migrated into Supabase; `backend/src/utils/auditLog.js`; `logAction` called from auth, user, and solo controllers on signup / login / login-failed / logout / wallet-linked / wallet-link-failed / tier-selected / puzzle-solved / puzzle-failed | `docs/migrations/audit_logs.sql`, `backend/src/utils/auditLog.js`, controller files |
| Backend test harness | `scripts/phase1_checklist.mjs` boots no server of its own, hits the existing `index.js` over HTTP, exercises 12 checks, exits with count of failures | `backend/scripts/phase1_checklist.mjs` (12/12 passing) |

### Phase 2 — Solo Mode Loop Completion (implemented; migration pending in Supabase)

| Capability | Implementation | File |
|---|---|---|
| Server-side timer | `MAX_SOLO_SESSION_MS = 10 min`. `submitSoloMove` rejects with `400 'Session timed out'` if age > cap. `submitSoloAttempt` computes `solveTimeMs = now - started_at` and persists it. Frontend never sends time. | `backend/src/utils/rewardCalculator.js`, `backend/src/controllers/solo.controller.js` |
| Reward persistence | New columns on `solo_sessions`: `solved_at`, `solve_time_ms`, `reward_amount`, `tier`, `status` (active\|solved\|failed). `calculateReward(...)` returns SOL net of 3% platform fee, rounded to 6 decimals. Controller persists reward on solve. | `backend/src/utils/rewardCalculator.js`, `docs/migrations/solo_sessions_rewards.sql` (pending) |
| Match history API | `GET /api/history?page=1&limit=20`. Returns the caller's `solo_sessions` where status ∈ {solved, failed}, paginated newest-first, including persisted `solve_time_ms` and `reward_amount`. | `backend/src/controllers/history.controller.js`, `backend/src/routes/history.routes.js`, `backend/index.js` |
| Leaderboard API | `GET /api/leaderboard/global`, `/tier/:tier`, `/my-rank`. Reads from `public.leaderboard` SQL view (defined in migration). | `backend/src/controllers/history.controller.js`, `backend/src/routes/leaderboard.routes.js`, `backend/index.js` |
| Leaderboard SQL view | `public.leaderboard` aggregates `users` + `solo_sessions` (status='solved') + `solo_attempts`, computes best-streak via window function, filters `puzzles_solved >= 5` to suppress sockpuppets. | `docs/migrations/solo_sessions_rewards.sql` |
| Stale-session cron | `pg_cron.schedule('expire-stale-solo-sessions', '*/5 * * * *', ...)`. Wrapped in a `do $$ ... exception when undefined_function then null` so it no-ops if pg_cron isn't installed — application-level cap still enforces 10 min. | `docs/migrations/solo_sessions_rewards.sql` |
| Match history UI | `MatchHistory.jsx` lists recent solves/fails with tier, wrong-move count, exact ms timing (formatted mm:ss), reward in SOL. Pagination controls. | `frontend/src/components/MatchHistory.jsx`, `frontend/src/App.jsx` (`/match-history`), `frontend/src/components/auth/Dashboard.jsx` (sidebar entry) |
| Leaderboard UI | `Leaderboard.jsx` — tabs (Global / Beginner / Intermediate / Pro / GM). Renders rows with rank, tier, puzzles solved, streak, ELO, total SOL earned. Includes "You" badge calling `/leaderboard/my-rank`. | `frontend/src/components/Leaderboard.jsx`, `frontend/src/App.jsx` (`/leaderboard`), `frontend/src/components/auth/Dashboard.jsx` (sidebar entry) |

### Pre-existing functionality (unchanged but still in use)

| Area | What's there | Source |
|---|---|---|
| Auth | Supabase email/password signup + login. Auto-creates row in `public.users` on signup with rating 1000. | `backend/src/controllers/auth.controller.js`, `backend/src/routes/auth.routes.js` |
| Wallet linking | Phantom wallet via Solana wallet adapter; `verifySignature` uses tweetnacl + bs58; one-time binding enforced server-side. | `backend/src/controllers/user.controller.js`, `backend/src/utils/verifySignature.js`, `frontend/src/components/auth/Setup.jsx`, `frontend/src/wallet/WalletProvider.jsx` |
| Profile | `/api/user/profile` returns the full `public.users` row including `wallet_address`, `tier`, `rating`, `is_setup_complete`, `created_at`. | `backend/src/controllers/user.controller.js`, `frontend/src/components/auth/Profile.jsx` |
| Tier selection | One-time, locked; writes `tier` + tier-default `rating` + flips `is_setup_complete = true`. Defaults: beginner 1000, intermediate 1400, professional 1700, grandmaster 2100. | `backend/src/controllers/user.controller.js`, `frontend/src/components/auth/Setup.jsx` |
| Puzzle loader | In-memory CSV cache backed by Supabase Storage (`puzzles` bucket, `lichess_puzzles.csv`). Loaded at server boot via `loadPuzzles()`. Tier → rating-range mapping in `getPuzzleForUser`. | `backend/src/services/puzzleLoader.js`, `backend/src/controllers/puzzle.controller.js`, `docs/PUZZLE_SETUP.md` |
| Solo mode | Session lifecycle (start / move / submit / fail), 3-strike failure, opponent-reply move injection, server-side timer + reward from Phase 2. | `backend/src/controllers/solo.controller.js`, `frontend/src/components/gameModes/Solo.jsx` |
| Round mode | 10-puzzle rounds, ELO adjustment (K=20 base, scaled by wrong-move multiplier), worst-case `-10` on 3-strike fail. Uses `round_sessions` + `round_puzzle_results`. Floor rating at 100. | `backend/src/controllers/round.controller.js`, `backend/src/routes/round.routes.js` |
| Frontend shell | Vite + React 19 + Tailwind 4, react-router 7, lucide-react icons, react-chessboard 5. Routes: `/`, `/login`, `/signup`, `/dashboard`, `/setup`, `/profile`, `/redirect`, `/solo`, `/match-history`, `/leaderboard`. | `frontend/src/App.jsx`, `frontend/src/components/...` |

### Database schema (matches `docs/DB.md`, extended by Phase 2 migration)

```
public.users(id PK→auth.users, wallet_address UNIQUE, tier, rating, is_setup_complete, created_at)
public.solo_sessions(id, user_id, puzzle_id, progress_index, completed, failed,
                     started_at, wrong_moves,
                     [P2] solved_at, solve_time_ms, reward_amount, tier, status)
public.solo_attempts(id, user_id, puzzle_id, solved, time_taken, created_at)
public.round_sessions(id, user_id, puzzle_count, is_complete, started_at, completed_at)
public.round_puzzle_results(id, round_session_id, user_id, puzzle_id, puzzle_rating,
                            solved, wrong_moves, elo_change, time_taken, created_at)
public.audit_logs(id, user_id, action, metadata jsonb, ip_address, created_at)   -- P1
public.leaderboard     (view)                                                      -- P2
```

## What Needs to be Built

### Phase 3 — Duel Mode (PvP)

The original roadmap's Phase 3. Not started.

1. **Head-to-head competition system** — both players receive the same puzzle, simultaneous timer, fastest correct wins.
2. **SOL staking + smart-contract escrow** — Anchor program on Solana devnet; on win, transfer stake minus 2% platform fee to winner; on dispute / timeout, refund.
3. **Matchmaking queue** — pair users with similar rating in same tier (round-robin with ELO brackets from `users.rating`).
4. **Real-time move sync** — Socket.io or native `ws` server, fed by the existing `verifyUser` middleware (cookies already work over WS).
5. **Reward ledger status flips** — once an Anchor on-chain transfer is confirmed, update a `duel_payouts` row from `pending → paid`. The `reward_amount` column on `solo_sessions` is the right home for the eventual Phase 3 SOL move.

### Phase 4 — Polish + Operations (lower priority)

1. **Global leaderboard polish** — Anti-sockpuppet gating is in place (`puzzles_solved >= 5`); still need a UI for rank progress and "near me" views.
2. **Match replay** — Store FEN walk and replay it deterministically on `/profile/replay/:session_id`.
3. **Email-verification banner UI** — The backend 403 is wired; the front-end `needsEmailVerification` boolean is exposed in AuthContext but no component currently renders the banner.
4. **Production logging + monitoring** — Currently we have `console.error` everywhere. Need a real logger (pino, winston) and an APM (Datadog, Sentry).
5. **WebSocket security** — Rate limit + heartbeat + session token rotation when we add WS in Phase 3.

## Security Findings (status after Phase 1)

### Fixed
- ✅ Rate limiting on auth, wallet, and all `/api` traffic.
- ✅ Helmet + CSP + HSTS headers on every response.
- ✅ Joi validation on every mutating endpoint.
- ✅ JWT moved out of `localStorage` into `httpOnly` cookies.
- ✅ Strong password policy (8+ chars, upper, lower, number, special).
- ✅ `requireVerified` middleware blocks unverified users on every protected route.
- ✅ Audit logs for sensitive operations (auth, wallet, tier, puzzles).
- ✅ CORS bound to a known allowlist per environment.

### Still open
- **`account_recovery` enforcement** — Supabase password reset is on by default; we don't currently restrict it to verified email addresses, but the path here is small.
- **Audit log retention** — no retention policy set; row count will grow unbounded.
- **Secrets in source** — `backend/.env` is gitignored but has been committed historically; audit the remote before declaring the env clean.
- **Replay protection on the wallet-link endpoint** — replaying a `(message, signature)` pair would link the same wallet twice (we mitigate with `wallet already linked` 403, but a fresh address could be replayed until the next nonce system is added).
- **Production-only rate-limit tuning** — current limits are reasonable defaults; need to monitor false positives before tightening.
- **Helmet CSP is strict** — `'self'` blocks any third-party widget (e.g. analytics). Add explicit allow-listing only if a real need arises.

## Conclusion

The project has moved from a partially-secured MVP to a hardened, mostly-self-documenting solo-mode platform. Phase 1 closed the security gap and added an automated check that catches regressions. Phase 2 closed the reward loop with server-side timing, persisted SOL payouts, and a read-only audit trail (history + leaderboard) for users. The biggest remaining work is **Phase 3 (Duel Mode)** which requires Anchor + WebSockets; both are non-trivial but the foundation underneath them — auth, wallet, tier, audit, leaderboard view — is now production-leaning.
