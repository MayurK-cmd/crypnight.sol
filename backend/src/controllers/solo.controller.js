import { supabase } from '../config/supabase.js';
import { getPuzzleById, getPuzzleByRating } from '../services/puzzleLoader.js';
import { AuditAction, getClientIp, logAction } from '../utils/auditLog.js';
import {
  calculateReward,
  puzzleEloDelta,
  MAX_SOLO_SESSION_MS,
} from '../utils/rewardCalculator.js';
import { isValidTier, normalizeTier, TIER_RATING_BANDS } from '../utils/tiers.js';

const PUZZLES_PER_SESSION = 10;
const RATING_FLOOR = 100;
const SESSION_FAIL_CAP = 3; // 3 puzzle-fails in a run ends the session.

const fetchUserTier = async (userId) => {
  const { data } = await supabase
    .from('users')
    .select('tier')
    .eq('id', userId)
    .single();
  return data?.tier ?? null;
};

const fetchUserRating = async (userId) => {
  const { data } = await supabase
    .from('users')
    .select('rating')
    .eq('id', userId)
    .single();
  return data?.rating ?? 1000;
};

const fetchActiveSession = async (userId) => {
  const { data } = await supabase
    .from('solo_sessions')
    .select(
      'id, started_at, status, ended_at, '
      + 'puzzles_in_session, puzzles_solved, puzzles_failed, '
      + 'total_session_reward, last_puzzle_elo_delta, '
      + 'current_puzzle_id, current_puzzle_solve_started_at, current_puzzle_wrong_moves, '
      + 'progress_index, wrong_moves, puzzle_id, tier'
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
};

// PHASE 2 — server-side session-age helper used by every endpoint.
const sessionAgeMs = (session) =>
  Date.now() - new Date(session.started_at).getTime();
const isStale = (session) => sessionAgeMs(session) > MAX_SOLO_SESSION_MS;

// PHASE 5 — end a 10-puzzle run. Sums the per-puzzle ELO contributions,
// updates users.rating, and closes the session row. Returns the summary
// payload the frontend uses to render the final screen.
export const endSoloSession = async ({ userId, sessionId, reason, ipAddress = null }) => {
  const { data: session, error: sessionError } = await supabase
    .from('solo_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (sessionError || !session) {
    throw new Error('Session not found');
  }
  if (session.status !== 'active') {
    // Already closed — return last-known summary without re-writing.
    return {
      session_continues: false,
      session_complete: true,
      new_rating: (await fetchUserRating(userId)),
      session_rating_delta: session.session_rating_delta || 0,
      puzzles_solved: session.puzzles_solved || 0,
      puzzles_failed: session.puzzles_failed || 0,
      total_session_reward: session.total_session_reward || 0,
    };
  }

  const userRating = await fetchUserRating(userId);
  const totalDelta = session.last_puzzle_elo_delta || 0;
  const newRating = Math.max(RATING_FLOOR, userRating + totalDelta);
  const totalReward = session.total_session_reward || 0;
  const endedAt = new Date().toISOString();

  await supabase
    .from('users')
    .update({ rating: newRating })
    .eq('id', userId);

  await supabase
    .from('solo_sessions')
    .update({
      status: 'solved',
      completed: true,
      ended_at: endedAt,
      solved_at: endedAt,
      solve_time_ms: sessionAgeMs(session),
      reward_amount: totalReward,
      session_rating_delta: totalDelta,
    })
    .eq('id', sessionId);

  await logAction({
    userId,
    action: AuditAction.PUZZLE_SOLVED,
    metadata: {
      session_id: sessionId,
      reason: `session_end:${reason || 'auto'}`,
      session_rating_delta: totalDelta,
      new_rating: newRating,
      puzzles_solved: session.puzzles_solved,
      puzzles_failed: session.puzzles_failed,
      total_session_reward: totalReward,
    },
    ipAddress,
  });

  return {
    session_continues: false,
    session_complete: true,
    new_rating: newRating,
    session_rating_delta: totalDelta,
    puzzles_solved: session.puzzles_solved || 0,
    puzzles_failed: session.puzzles_failed || 0,
    total_session_reward: totalReward,
  };
};

// PHASE 5 — start a new session or resume the user's in-flight one.
// Frontend calls this on /solo mount if /puzzle returned session_id=null.
export const startSoloSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const tier = await fetchUserTier(userId);

    if (!tier || !isValidTier(tier)) {
      return res.status(400).json({ error: 'Tier not set — complete setup first' });
    }

    const existing = await fetchActiveSession(userId);

    if (existing && existing.puzzles_in_session < PUZZLES_PER_SESSION && !isStale(existing)) {
      // Resume the same session — frontend already has current_puzzle_id.
      return res.json({
        session_id: existing.id,
        started_at: existing.started_at,
        tier,
        resumed: true,
        puzzles_in_session: existing.puzzles_in_session,
        puzzles_solved: existing.puzzles_solved,
        puzzles_failed: existing.puzzles_failed,
        total_session_reward: existing.total_session_reward,
        current_puzzle_id: existing.current_puzzle_id,
      });
    }

    // Either no active session, or the existing one is full / stale.
    // Close out any stale actives first (defensive — cron also handles
    // this, but we don't want a race).
    if (existing) {
      await supabase
        .from('solo_sessions')
        .update({
          status: 'failed',
          completed: true,
          ended_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    }

    // Pick a starting puzzle so the session has a current_puzzle_id
    // right away (the frontend's /puzzle call also sets it; this
    // covers clients that call /solo/start without calling /puzzle).
    const userRating = await fetchUserRating(userId);
    const tierKey = normalizeTier(tier) || 'intermediate';
    const [min, max] = TIER_RATING_BANDS[tierKey] || TIER_RATING_BANDS.intermediate;
    const startPuzzle = getPuzzleByRating(min, max);
    const startPuzzleId = startPuzzle.puzzle_id || startPuzzle.PuzzleId || startPuzzle.id;

    const { data, error } = await supabase
      .from('solo_sessions')
      .insert({
        user_id: userId,
        puzzle_id: startPuzzleId, // legacy column
        tier,
        status: 'active',
        puzzles_in_session: 1,
        puzzles_solved: 0,
        puzzles_failed: 0,
        total_session_reward: 0,
        last_puzzle_elo_delta: 0,
        current_puzzle_id: startPuzzleId,
        current_puzzle_solve_started_at: new Date().toISOString(),
        current_puzzle_wrong_moves: 0,
        progress_index: 0,
        wrong_moves: 0,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({
      session_id: data.id,
      started_at: data.started_at,
      tier,
      resumed: false,
      puzzles_in_session: 1,
      puzzles_solved: 0,
      puzzles_failed: 0,
      total_session_reward: 0,
      current_puzzle_id: startPuzzleId,
    });
  } catch (err) {
    console.error('Start session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PHASE 5 — record a wrong-move fail. STRICT MODE: the very first wrong
// move on a puzzle ends that puzzle (no 3-strike cushion). The session
// continues to the next puzzle until the run hits SESSION_FAIL_CAP
// puzzle-fails or PUZZLES_PER_SESSION solves, whichever comes first.
const recordPuzzleFail = async (req, session, wrongMoves) => {
  const userId = req.user.id;

  const newPuzzlesFailed = (session.puzzles_failed || 0) + 1;
  const newPuzzlesInSession = (session.puzzles_in_session || 0) + 1;

  // Per-puzzle ELO contribution on fail. Fixed at -5 per puzzle.
  const userRating = await fetchUserRating(userId);
  const puzzle = getPuzzleById(session.current_puzzle_id);
  const puzzleRating = parseInt(puzzle?.rating || puzzle?.Rating || 1200, 10);
  const eloDelta = puzzleEloDelta({
    userRating,
    puzzleRating,
    solveTimeMs: sessionAgeMs(session),
    wrongMoves,
    failed: true,
  });

  const updates = {
    puzzles_failed: newPuzzlesFailed,
    puzzles_in_session: newPuzzlesInSession,
    last_puzzle_elo_delta: (session.last_puzzle_elo_delta || 0) + eloDelta,
    // Clear the current-puzzle slot so the next /puzzle call picks fresh.
    current_puzzle_id: null,
    current_puzzle_solve_started_at: null,
    current_puzzle_wrong_moves: 0,
    progress_index: 0,
    wrong_moves: 0,
  };

  await supabase.from('solo_sessions').update(updates).eq('id', session.id);

  await logAction({
    userId,
    action: AuditAction.PUZZLE_FAILED,
    metadata: {
      session_id: session.id,
      puzzle_id: session.current_puzzle_id,
      session_puzzle_index: session.puzzles_in_session,
      time_taken_ms: sessionAgeMs(session),
      wrong_moves: wrongMoves,
    },
    ipAddress: getClientIp(req),
  });

  // Did this fail close out the run? Two end conditions:
  //   1. Hit the 3-fail session cap.
  //   2. Hit the 10-puzzle cap (fail on the 10th puzzle).
  const sessionEndReason =
    newPuzzlesFailed >= SESSION_FAIL_CAP ? 'fail_cap' :
    newPuzzlesInSession >= PUZZLES_PER_SESSION ? 'last_failed' :
    null;

  if (sessionEndReason) {
    const summary = await endSoloSession({
      userId,
      sessionId: session.id,
      reason: sessionEndReason,
      ipAddress: getClientIp(req),
    });
    return {
      correct: false,
      wrong_moves: wrongMoves,
      puzzle_failed: true,
      session_continues: false,
      session_complete: true,
      session_end_reason: sessionEndReason,
      ...summary,
    };
  }

  return {
    correct: false,
    wrong_moves: wrongMoves,
    puzzle_failed: true,
    session_continues: true,
    puzzles_in_session: newPuzzlesInSession,
    puzzles_solved: session.puzzles_solved || 0,
    puzzles_failed: newPuzzlesFailed,
    lives_remaining: SESSION_FAIL_CAP - newPuzzlesFailed,
  };
};

// PHASE 5 — validate a single move. Strict mode: any wrong move ends
// the current puzzle. The session either advances to the next puzzle
// or ends (3-fail cap / 10 solved) — recordPuzzleFail decides.
export const submitSoloMove = async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id, move } = req.body;

    const session = await fetchActiveSession(userId);
    if (!session || session.id !== session_id) {
      return res.status(400).json({ error: 'Invalid session' });
    }

    if (isStale(session)) {
      await endSoloSession({ userId, sessionId: session.id, reason: 'timeout', ipAddress: getClientIp(req) });
      return res.status(400).json({ error: 'Session timed out' });
    }

    const puzzle = getPuzzleById(session.current_puzzle_id);
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle missing from cache' });
    }

    const correctMoves = (puzzle.moves || puzzle.Moves).split(' ');
    // progress_index is the index of the next expected user move.
    const expectedIdx = session.progress_index || 0;

    if (move !== correctMoves[expectedIdx]) {
      // STRICT MODE: a single wrong move ends the puzzle. The session
      // either continues to the next puzzle or ends (3-fail cap / 10
      // solved) — recordPuzzleFail decides.
      const wrongMoves = (session.current_puzzle_wrong_moves || 0) + 1;
      const result = await recordPuzzleFail(req, session, wrongMoves);
      return res.json(result);
    }

    // Correct move — advance progress.
    const nextIdx = expectedIdx + 1;
    const updates = { progress_index: nextIdx };
    if (nextIdx >= correctMoves.length) {
      // Puzzle fully solved — leave the slot open so /submit can run.
      updates.current_puzzle_wrong_moves = 0;
    }
    await supabase.from('solo_sessions').update(updates).eq('id', session.id);

    if (nextIdx >= correctMoves.length) {
      return res.json({ correct: true, finished: true });
    }

    // Opponent reply (auto-played by the puzzle author).
    return res.json({
      correct: true,
      finished: false,
      opponent_move: correctMoves[nextIdx],
    });
  } catch (err) {
    console.error('Move validation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PHASE 5 — finalize a solved puzzle. Per-puzzle reward + per-puzzle ELO
// contribution are computed server-side and persisted. If this was the
// 10th puzzle in the run, auto-end the session.
export const submitSoloAttempt = async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id } = req.body;

    const session = await fetchActiveSession(userId);
    if (!session || session.id !== session_id) {
      return res.status(400).json({ error: 'Invalid session' });
    }

    if (isStale(session)) {
      await endSoloSession({ userId, sessionId: session.id, reason: 'timeout', ipAddress: getClientIp(req) });
      return res.status(400).json({ error: 'Session timed out' });
    }

    const puzzle = getPuzzleById(session.current_puzzle_id);
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle missing from cache' });
    }

    const solveTimeMs = sessionAgeMs(session);
    const wrongMoves = session.current_puzzle_wrong_moves || 0;
    const puzzleRating = parseInt(puzzle.rating || puzzle.Rating || 1200, 10);
    const tier = session.tier || (await fetchUserTier(userId)) || 'beginner';

    const reward = calculateReward({
      solveTimeMs,
      puzzleRating,
      tier,
      wrongMoves,
    });

    // Per-puzzle ELO contribution. We do NOT update users.rating here —
    // the final rating update happens at session end so the next-puzzle
    // band can be picked against the pre-session rating.
    const userRating = await fetchUserRating(userId);
    const eloDelta = puzzleEloDelta({
      userRating,
      puzzleRating,
      solveTimeMs,
      wrongMoves,
      failed: false,
    });

    // puzzles_in_session is bumped here on a successful solve. Failed
    // puzzles bump it in recordPuzzleFail so the cap check below sees a
    // consistent counter for both outcomes.
    const { data: live } = await supabase
      .from('solo_sessions')
      .select('puzzles_in_session, puzzles_solved, puzzles_failed, total_session_reward, last_puzzle_elo_delta')
      .eq('id', session.id)
      .single();

    const newTotal = Number(live?.total_session_reward || 0) + reward;
    const newDelta = (live?.last_puzzle_elo_delta || 0) + eloDelta;
    const newInSession = (live?.puzzles_in_session || 0) + 1;
    const newSolved = (live?.puzzles_solved || 0) + 1;

    await supabase
      .from('solo_sessions')
      .update({
        puzzles_in_session: newInSession,
        puzzles_solved: newSolved,
        total_session_reward: newTotal,
        reward_amount: newTotal, // mirror for leaderboard view aggregation
        last_solved_rating: puzzleRating,
        last_puzzle_elo_delta: newDelta,
        // Clear the current-puzzle slot; next /puzzle picks fresh.
        current_puzzle_id: null,
        current_puzzle_solve_started_at: null,
        current_puzzle_wrong_moves: 0,
        progress_index: 0,
        wrong_moves: 0,
      })
      .eq('id', session.id);

    await supabase.from('solo_attempts').insert({
      user_id: userId,
      puzzle_id: session.current_puzzle_id,
      solved: true,
      time_taken: Math.floor(solveTimeMs / 1000),
    });

    await logAction({
      userId,
      action: AuditAction.PUZZLE_SOLVED,
      metadata: {
        session_id: session.id,
        puzzle_id: session.current_puzzle_id,
        session_puzzle_index: newInSession,
        time_taken_ms: solveTimeMs,
        wrong_moves: wrongMoves,
        reward,
        elo_delta: eloDelta,
        tier,
      },
      ipAddress: getClientIp(req),
    });

    if (newInSession >= PUZZLES_PER_SESSION) {
      const summary = await endSoloSession({
        userId,
        sessionId: session.id,
        reason: 'all_solved',
        ipAddress: getClientIp(req),
      });
      return res.json({
        solved: true,
        reward,
        elo_delta: eloDelta,
        time_taken: Math.floor(solveTimeMs / 1000),
        session_continues: false,
        session_complete: true,
        ...summary,
      });
    }

    return res.json({
      solved: true,
      reward,
      elo_delta: eloDelta,
      time_taken: Math.floor(solveTimeMs / 1000),
      session_continues: true,
      session_complete: false,
      puzzles_in_session: newInSession,
      puzzles_solved: newSolved,
      puzzles_failed: live?.puzzles_failed || 0,
      total_session_reward: newTotal,
    });
  } catch (err) {
    console.error('Submit error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PHASE 5 — back-compat shim. /solo/move now handles fail inline (any
// wrong move ends the puzzle), so this only fires for older clients
// that call /solo/fail directly. Records a single strike — one move
// was already wrong.
export const failSoloSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id } = req.body;

    const session = await fetchActiveSession(userId);
    if (!session || session.id !== session_id) {
      return res.status(400).json({ error: 'Invalid session' });
    }

    // STRICT MODE — one strike is enough. Pass 1 to match a single
    // bad-move event.
    const result = await recordPuzzleFail(req, session, 1);
    return res.json(result);
  } catch (err) {
    console.error('Fail session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PHASE 5 — explicit session-end endpoint. Not wired to the frontend
// (auto-end only). Used by tests + the cron path.
export const endSoloSessionHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id } = req.body;

    const { data: session } = await supabase
      .from('solo_sessions')
      .select('id, status')
      .eq('id', session_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session already closed' });
    }

    const summary = await endSoloSession({
      userId,
      sessionId: session_id,
      reason: 'manual',
      ipAddress: getClientIp(req),
    });
    return res.json(summary);
  } catch (err) {
    console.error('End session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
