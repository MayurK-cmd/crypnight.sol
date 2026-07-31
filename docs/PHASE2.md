# CrypNight.sol — Phase 2: Complete the Solo Mode Loop

> Hand this file to Claude Code after Phase 1 is fully complete and verified. Work through each section in order.

---

## Context

Solo mode is mostly built — sessions exist, moves are validated, and a 3-strike system is in place. Three things are broken or missing:

1. **The timer lives on the client.** A modified frontend can fake a 0.01s solve time and claim a max reward. The solve time must be computed server-side.
2. **Rewards are calculated but not persisted.** There is no record of what a user earned, when, or for which puzzle.
3. **There is no leaderboard or match history.** Users have no way to see their ranking or past performance.

This phase fixes all three.

---

## Section 1 — Server-Side Timer

### 1.1 The problem

The current flow likely looks like: frontend starts a JS timer → user solves puzzle → frontend sends `{ move, solveTimeMs }` to the backend. The backend trusts that number. This must change.

### 1.2 Database: add `started_at` to puzzle sessions

Run this SQL in Supabase:

```sql
-- Add started_at column to your puzzle sessions table
-- Replace 'puzzle_sessions' with your actual table name
alter table puzzle_sessions
  add column if not exists started_at timestamptz,
  add column if not exists solved_at timestamptz,
  add column if not exists solve_time_ms integer generated always as (
    extract(epoch from (solved_at - started_at)) * 1000
  ) stored;
```

If you don't have a puzzle sessions table yet, create one:

```sql
create table puzzle_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  puzzle_id text not null,
  tier text not null check (tier in ('beginner', 'intermediate', 'pro', 'gm')),
  status text not null default 'active' check (status in ('active', 'solved', 'failed')),
  strikes integer not null default 0,
  started_at timestamptz not null default now(),
  solved_at timestamptz,
  solve_time_ms integer,
  reward_amount numeric(10, 6),
  created_at timestamptz default now()
);

create index puzzle_sessions_user_id_idx on puzzle_sessions(user_id);
create index puzzle_sessions_status_idx on puzzle_sessions(status);
```

### 1.3 Backend: record `started_at` when session is created

In the route/handler that creates a new puzzle session (e.g. `POST /api/game/start`):

```js
const startPuzzleSession = async (req, res) => {
  const { tier } = req.body;
  const userId = req.user.id;

  // Fetch a puzzle for this tier
  const puzzle = await getPuzzleForTier(tier); // your existing puzzle loader

  // Create session with server-side timestamp
  const { data: session, error } = await supabase
    .from('puzzle_sessions')
    .insert({
      user_id: userId,
      puzzle_id: puzzle.id,
      tier,
      started_at: new Date().toISOString(), // server sets this
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'Failed to create session' });

  // Return session ID and puzzle — but NOT the solution
  return res.json({
    sessionId: session.id,
    puzzle: {
      id: puzzle.id,
      fen: puzzle.fen,
      rating: puzzle.rating,
      // Do NOT include puzzle.solution here
    },
  });
};
```

### 1.4 Backend: compute solve time on submission

In the move submission handler (e.g. `POST /api/game/move`):

```js
const submitMove = async (req, res) => {
  const { sessionId, move } = req.body;
  const userId = req.user.id;

  // Fetch session and verify ownership
  const { data: session, error: sessionError } = await supabase
    .from('puzzle_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (sessionError || !session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (session.status !== 'active') {
    return res.status(400).json({ error: 'Session is no longer active' });
  }

  // Check for session timeout (e.g. 10 minutes max per puzzle)
  const sessionAgeMs = Date.now() - new Date(session.started_at).getTime();
  const MAX_SESSION_MS = 10 * 60 * 1000; // 10 minutes
  if (sessionAgeMs > MAX_SESSION_MS) {
    await supabase
      .from('puzzle_sessions')
      .update({ status: 'failed' })
      .eq('id', sessionId);
    return res.status(400).json({ error: 'Session timed out' });
  }

  // Validate move against the puzzle solution
  const puzzle = await getPuzzleById(session.puzzle_id);
  const isCorrect = validateMove(move, puzzle, session); // your existing validation

  if (!isCorrect) {
    // Increment strikes
    const newStrikes = session.strikes + 1;
    const failed = newStrikes >= 3;

    await supabase
      .from('puzzle_sessions')
      .update({
        strikes: newStrikes,
        status: failed ? 'failed' : 'active',
      })
      .eq('id', sessionId);

    return res.json({
      correct: false,
      strikes: newStrikes,
      failed,
      message: failed ? 'Puzzle failed — 3 wrong moves' : `Wrong move. ${3 - newStrikes} strikes remaining.`,
    });
  }

  // Correct move — check if puzzle is fully solved (may need multiple correct moves)
  const isSolved = checkIfFullySolved(move, puzzle, session); // your existing logic

  if (!isSolved) {
    // Correct but more moves needed
    return res.json({ correct: true, solved: false });
  }

  // Puzzle solved — compute solve time server-side
  const solvedAt = new Date();
  const solveTimeMs = solvedAt.getTime() - new Date(session.started_at).getTime();

  // Calculate reward
  const reward = calculateReward({
    solveTimeMs,
    puzzleRating: puzzle.rating,
    tier: session.tier,
    strikes: session.strikes,
  });

  // Persist everything atomically
  const { error: updateError } = await supabase
    .from('puzzle_sessions')
    .update({
      status: 'solved',
      solved_at: solvedAt.toISOString(),
      solve_time_ms: solveTimeMs,
      reward_amount: reward,
    })
    .eq('id', sessionId);

  if (updateError) {
    console.error('[submitMove] Failed to update session:', updateError);
    return res.status(500).json({ error: 'Failed to record result' });
  }

  // Write audit log
  await logAction({
    userId,
    action: AuditAction.PUZZLE_SOLVED,
    metadata: { sessionId, puzzleId: session.puzzle_id, solveTimeMs, reward },
  });

  return res.json({
    correct: true,
    solved: true,
    solveTimeMs,
    reward,
    message: 'Puzzle solved!',
  });
};
```

### 1.5 Frontend: remove client-side timer from reward logic

The frontend can still show a running timer for UX — but it must never send the time to the backend. Remove any code that sends `solveTimeMs` in the request body. The move endpoint only needs `{ sessionId, move }`.

---

## Section 2 — Reward Formula

### 2.1 Define the formula

Create `/backend/src/utils/rewardCalculator.js`:

```js
// Base reward in SOL per tier
const TIER_BASE_REWARD = {
  beginner: 0.001,
  intermediate: 0.003,
  pro: 0.008,
  gm: 0.02,
};

// Platform fee (3% for solo mode per the spec)
const PLATFORM_FEE = 0.03;

/**
 * Calculate the reward for a solved puzzle.
 *
 * Formula:
 *   base = TIER_BASE_REWARD[tier]
 *   difficultyMultiplier = puzzleRating / 1500  (1.0 at rating 1500)
 *   speedMultiplier = clamp(60000 / solveTimeMs, 0.5, 3.0)
 *     — faster than 1 min gets up to 3x, slower gets down to 0.5x
 *   accuracyMultiplier = 1.0 - (strikes * 0.25)
 *     — 0 wrong moves: 1.0, 1 wrong: 0.75, 2 wrong: 0.5
 *   grossReward = base * difficultyMultiplier * speedMultiplier * accuracyMultiplier
 *   netReward = grossReward * (1 - PLATFORM_FEE)
 */
const calculateReward = ({ solveTimeMs, puzzleRating, tier, strikes }) => {
  const base = TIER_BASE_REWARD[tier] ?? TIER_BASE_REWARD.beginner;

  const difficultyMultiplier = puzzleRating / 1500;

  const speedMultiplier = Math.min(3.0, Math.max(0.5, 60000 / solveTimeMs));

  const accuracyMultiplier = Math.max(0, 1.0 - strikes * 0.25);

  const grossReward = base * difficultyMultiplier * speedMultiplier * accuracyMultiplier;

  const netReward = grossReward * (1 - PLATFORM_FEE);

  // Round to 6 decimal places (lamport-friendly)
  return Math.round(netReward * 1_000_000) / 1_000_000;
};

module.exports = { calculateReward };
```

### 2.2 Add a reward ledger table

```sql
create table reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  session_id uuid references puzzle_sessions(id) on delete set null,
  amount numeric(10, 6) not null,
  type text not null check (type in ('solo_earn', 'duel_win', 'platform_fee')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz default now()
);

create index reward_ledger_user_id_idx on reward_ledger(user_id);
create index reward_ledger_status_idx on reward_ledger(status);
```

### 2.3 Write to the ledger when a puzzle is solved

Add this inside the `isSolved` block in Section 1.4, after updating the session:

```js
await supabase.from('reward_ledger').insert({
  user_id: userId,
  session_id: sessionId,
  amount: reward,
  type: 'solo_earn',
  status: 'pending', // changes to 'paid' once Solana tx is confirmed
});
```

---

## Section 3 — User Stats & Rating

### 3.1 Update the user stats table

Ensure there is a `user_stats` table. If not, create it:

```sql
create table user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'beginner',
  rating integer not null default 1200,
  puzzles_solved integer not null default 0,
  puzzles_failed integer not null default 0,
  total_earned numeric(10, 6) not null default 0,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  updated_at timestamptz default now()
);
```

### 3.2 Update stats after a solve or fail

Create `/backend/src/utils/updateUserStats.js`:

```js
const { supabase } = require('../config/supabase');

const ELO_K_FACTOR = 32;

/**
 * Update the user's stats after a puzzle outcome.
 * Uses a simplified ELO adjustment:
 *   expected score = 1 / (1 + 10^((puzzleRating - userRating) / 400))
 *   new rating = old rating + K * (actualScore - expectedScore)
 *   actualScore: 1 for solve, 0 for fail
 */
const updateUserStats = async ({ userId, solved, puzzleRating, reward = 0 }) => {
  const { data: stats } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!stats) return;

  const expectedScore = 1 / (1 + Math.pow(10, (puzzleRating - stats.rating) / 400));
  const actualScore = solved ? 1 : 0;
  const newRating = Math.round(stats.rating + ELO_K_FACTOR * (actualScore - expectedScore));

  const updates = {
    rating: Math.max(100, newRating), // floor at 100
    puzzles_solved: solved ? stats.puzzles_solved + 1 : stats.puzzles_solved,
    puzzles_failed: solved ? stats.puzzles_failed : stats.puzzles_failed + 1,
    total_earned: stats.total_earned + reward,
    current_streak: solved ? stats.current_streak + 1 : 0,
    best_streak: solved
      ? Math.max(stats.best_streak, stats.current_streak + 1)
      : stats.best_streak,
    updated_at: new Date().toISOString(),
  };

  await supabase.from('user_stats').update(updates).eq('user_id', userId);

  return updates;
};

module.exports = { updateUserStats };
```

### 3.3 Call `updateUserStats` after every puzzle outcome

In the solve handler (Section 1.4), after persisting the session:

```js
const newStats = await updateUserStats({
  userId,
  solved: true,
  puzzleRating: puzzle.rating,
  reward,
});

return res.json({
  correct: true,
  solved: true,
  solveTimeMs,
  reward,
  newRating: newStats.rating,
  currentStreak: newStats.current_streak,
});
```

In the fail handler (3 strikes reached):

```js
await updateUserStats({
  userId,
  solved: false,
  puzzleRating: puzzle.rating,
  reward: 0,
});
```

---

## Section 4 — Match History API

### 4.1 Add the endpoint

In your game routes file:

```js
// GET /api/game/history?page=1&limit=20
router.get('/history', authMiddleware, getMatchHistory);
```

Handler:

```js
const getMatchHistory = async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('puzzle_sessions')
    .select('id, puzzle_id, tier, status, strikes, solve_time_ms, reward_amount, started_at, solved_at', { count: 'exact' })
    .eq('user_id', userId)
    .in('status', ['solved', 'failed'])
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return res.status(500).json({ error: 'Failed to fetch history' });

  return res.json({
    history: data,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  });
};
```

### 4.2 Profile endpoint — return full stats

Update `GET /api/user/profile`:

```js
const getProfile = async (req, res) => {
  const userId = req.user.id;

  const [profileResult, statsResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).single(),
    supabase.from('user_stats').select('*').eq('user_id', userId).single(),
  ]);

  if (profileResult.error) return res.status(404).json({ error: 'Profile not found' });

  return res.json({
    profile: profileResult.data,
    stats: statsResult.data || null,
  });
};
```

---

## Section 5 — Leaderboard

### 5.1 Create a leaderboard view in Supabase

Run in the SQL editor:

```sql
create or replace view leaderboard as
select
  p.user_id,
  p.username,        -- adjust to your actual column name
  s.tier,
  s.rating,
  s.puzzles_solved,
  s.total_earned,
  s.best_streak,
  rank() over (partition by s.tier order by s.rating desc) as tier_rank,
  rank() over (order by s.rating desc) as global_rank
from user_stats s
join profiles p on p.user_id = s.user_id
where s.puzzles_solved >= 5;  -- only show users with at least 5 solves
```

### 5.2 Leaderboard API endpoints

```js
// GET /api/leaderboard/global?limit=100
router.get('/leaderboard/global', authMiddleware, getGlobalLeaderboard);

// GET /api/leaderboard/tier/:tier?limit=50
router.get('/leaderboard/tier/:tier', authMiddleware, getTierLeaderboard);
```

Handlers:

```js
const getGlobalLeaderboard = async (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit) || 50);

  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('global_rank', { ascending: true })
    .limit(limit);

  if (error) return res.status(500).json({ error: 'Failed to fetch leaderboard' });

  return res.json({ leaderboard: data });
};

const getTierLeaderboard = async (req, res) => {
  const { tier } = req.params;
  const validTiers = ['beginner', 'intermediate', 'pro', 'gm'];

  if (!validTiers.includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  const limit = Math.min(50, parseInt(req.query.limit) || 25);

  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .eq('tier', tier)
    .order('tier_rank', { ascending: true })
    .limit(limit);

  if (error) return res.status(500).json({ error: 'Failed to fetch leaderboard' });

  return res.json({ tier, leaderboard: data });
};
```

### 5.3 User's own rank

```js
// GET /api/leaderboard/my-rank
router.get('/leaderboard/my-rank', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  const { data, error } = await supabase
    .from('leaderboard')
    .select('global_rank, tier_rank, tier, rating')
    .eq('user_id', userId)
    .single();

  if (error) return res.status(404).json({ error: 'Not ranked yet (need at least 5 solves)' });

  return res.json(data);
});
```

---

## Section 6 — Frontend Components

### 6.1 Match history component

Create `/frontend/src/components/MatchHistory.jsx`:

```jsx
import { useEffect, useState } from 'react';
import api from '../lib/axios';

const formatTime = (ms) => {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

export default function MatchHistory() {
  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/game/history?page=${page}&limit=20`);
        setHistory(res.data.history);
        setPagination(res.data.pagination);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [page]);

  if (loading) return <div className="text-gray-400 text-sm">Loading history...</div>;

  return (
    <div className="space-y-2">
      {history.length === 0 && (
        <p className="text-gray-400 text-sm">No puzzles solved yet. Start playing!</p>
      )}
      {history.map((session) => (
        <div
          key={session.id}
          className={`flex items-center justify-between p-3 rounded-lg border ${
            session.status === 'solved'
              ? 'border-green-800 bg-green-950/30'
              : 'border-red-900 bg-red-950/20'
          }`}
        >
          <div>
            <span className="text-sm font-medium text-white capitalize">{session.tier}</span>
            <span className="ml-2 text-xs text-gray-400">
              {session.strikes} {session.strikes === 1 ? 'mistake' : 'mistakes'}
            </span>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-300">{formatTime(session.solve_time_ms)}</div>
            {session.reward_amount > 0 && (
              <div className="text-xs text-green-400">+{session.reward_amount} SOL</div>
            )}
          </div>
        </div>
      ))}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-between items-center pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-sm text-gray-400 disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500">
            {page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            className="text-sm text-gray-400 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
```

### 6.2 Leaderboard component

Create `/frontend/src/components/Leaderboard.jsx`:

```jsx
import { useEffect, useState } from 'react';
import api from '../lib/axios';

const TIERS = ['beginner', 'intermediate', 'pro', 'gm'];

export default function Leaderboard() {
  const [tab, setTab] = useState('global');
  const [data, setData] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [boardRes, rankRes] = await Promise.all([
          tab === 'global'
            ? api.get('/leaderboard/global')
            : api.get(`/leaderboard/tier/${tab}`),
          api.get('/leaderboard/my-rank').catch(() => ({ data: null })),
        ]);
        setData(tab === 'global' ? boardRes.data.leaderboard : boardRes.data.leaderboard);
        setMyRank(rankRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tab]);

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-4 bg-gray-900 p-1 rounded-lg">
        {['global', ...TIERS].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
              tab === t ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* My rank badge */}
      {myRank && (
        <div className="mb-3 p-2 rounded-lg bg-purple-950/40 border border-purple-800 text-sm text-purple-300">
          Your rank: #{tab === 'global' ? myRank.global_rank : myRank.tier_rank} · {myRank.rating} ELO
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="space-y-1">
          {data.map((entry, i) => (
            <div
              key={entry.user_id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50"
            >
              <span className={`w-6 text-center text-sm font-mono ${
                i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-500'
              }`}>
                {i + 1}
              </span>
              <span className="flex-1 text-sm text-white">{entry.username}</span>
              <span className="text-xs text-gray-400">{entry.rating} ELO</span>
              <span className="text-xs text-green-400 min-w-[60px] text-right">
                {entry.total_earned?.toFixed(3)} SOL
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 6.3 Update the Dashboard

In `/frontend/src/pages/Dashboard.jsx`, add tabs for History and Leaderboard alongside the existing solo mode content:

```jsx
import MatchHistory from '../components/MatchHistory';
import Leaderboard from '../components/Leaderboard';

// Add a tab state
const [activeTab, setActiveTab] = useState('play'); // 'play' | 'history' | 'leaderboard'

// Tab bar in JSX
<div className="flex gap-2 border-b border-gray-800 mb-6">
  {['play', 'history', 'leaderboard'].map(tab => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`pb-2 px-1 text-sm capitalize border-b-2 transition-colors ${
        activeTab === tab
          ? 'border-white text-white'
          : 'border-transparent text-gray-500 hover:text-gray-300'
      }`}
    >
      {tab}
    </button>
  ))}
</div>

{activeTab === 'play' && <SoloModeBoard />}
{activeTab === 'history' && <MatchHistory />}
{activeTab === 'leaderboard' && <Leaderboard />}
```

---

## Section 7 — Anti-cheat: Session Timeout Enforcement

### 7.1 Clean up stale sessions with a Supabase scheduled function

In Supabase, create a scheduled function (Database → Functions) that runs every 5 minutes to expire timed-out sessions:

```sql
create or replace function expire_stale_sessions()
returns void
language plpgsql
as $$
begin
  update puzzle_sessions
  set status = 'failed'
  where status = 'active'
    and started_at < now() - interval '10 minutes';
end;
$$;
```

Schedule it via Supabase's pg_cron extension:

```sql
select cron.schedule('expire-sessions', '*/5 * * * *', 'select expire_stale_sessions()');
```

### 7.2 Validate session is still active on every move

This is already handled in Section 1.4 with the `sessionAgeMs` check. Make sure that check is in the handler and runs before any move validation.

---

## Section 8 — Final Checklist

Before closing Phase 2, verify every item:

- [ ] Start a puzzle session — `started_at` is set in the database, **not** passed from the frontend
- [ ] Solve a puzzle correctly — `solved_at` and `solve_time_ms` are written server-side
- [ ] Check `puzzle_sessions` in Supabase: `solve_time_ms` matches `solved_at - started_at`
- [ ] Check `reward_ledger` — a pending entry exists after each solve
- [ ] Fail a puzzle (3 strikes) — session status becomes `failed`, stats updated
- [ ] `GET /api/game/history` returns paginated results
- [ ] `GET /api/leaderboard/global` returns ranked users
- [ ] `GET /api/leaderboard/tier/pro` returns only pro-tier users
- [ ] `GET /api/leaderboard/my-rank` returns the user's rank (or 404 if fewer than 5 solves)
- [ ] Dashboard shows History and Leaderboard tabs with correct data
- [ ] Frontend never sends `solveTimeMs` in any request body
- [ ] Sessions older than 10 minutes cannot accept moves (returns 400)
- [ ] Stale session cron job runs and flips old active sessions to `failed`
- [ ] ELO rating changes after each solve/fail (check `user_stats` in Supabase)
- [ ] Streak increments on consecutive solves and resets on failure

---

## Notes for Phase 3

Once Phase 2 is done, the solo loop is complete and production-worthy. Phase 3 (duel mode) will need:

- The WebSocket server (Socket.io or native ws) for real-time puzzle sync
- Anchor escrow smart contract on devnet
- Matchmaking queue — pairing users of similar rating within the same tier
- The reward ledger `status` column will flip from `pending` to `paid` once Solana transactions are confirmed — Phase 3 will implement that confirmation flow

Do not start Phase 3 until this checklist is fully green.