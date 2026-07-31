import { supabase } from '../config/supabase.js';
import { getPuzzleById } from '../services/puzzleLoader.js';
import { AuditAction, getClientIp, logAction } from '../utils/auditLog.js';
import {
  calculateReward,
  MAX_SOLO_SESSION_MS,
} from '../utils/rewardCalculator.js';

const KNOWN_TIERS = new Set([
  'beginner',
  'intermediate',
  'pro',
  'professional',
  'gm',
  'grandmaster',
]);

const fetchUserTier = async (userId) => {
  const { data } = await supabase
    .from('users')
    .select('tier')
    .eq('id', userId)
    .single();
  return data?.tier ?? null;
};

// PHASE 2 — server-side session-age helper used by every endpoint.
const sessionAgeMs = (session) =>
  Date.now() - new Date(session.started_at).getTime();
const isStale = (session) => sessionAgeMs(session) > MAX_SOLO_SESSION_MS;

// START SESSION
export const startSoloSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { puzzle_id } = req.body;

    if (!puzzle_id) {
      return res.status(400).json({ error: 'Puzzle ID required' });
    }

    const tier = await fetchUserTier(userId);
    if (!tier || !KNOWN_TIERS.has(tier)) {
      return res.status(400).json({ error: 'Tier not set — complete setup first' });
    }

    const { data, error } = await supabase
      .from('solo_sessions')
      .insert({
        user_id: userId,
        puzzle_id,
        tier,
        progress_index: 1,
        wrong_moves: 0,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({
      session_id: data.id,
      started_at: data.started_at, // PHASE 2 — echo so the client's display timer is in sync
      tier,
    });
  } catch (err) {
    console.error('Start session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// VALIDATE MOVE
export const submitSoloMove = async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id, move } = req.body;

    if (!session_id || !move) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const { data: session } = await supabase
      .from('solo_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', userId)
      .single();

    if (!session || session.completed || session.status === 'solved') {
      return res.status(400).json({ error: 'Invalid session' });
    }

    if (session.failed || session.status === 'failed') {
      return res.status(400).json({ error: 'Session already failed' });
    }

    // PHASE 2 — server-side timeout. A long-running session cannot claim reward.
    if (isStale(session)) {
      await supabase
        .from('solo_sessions')
        .update({ status: 'failed', completed: true })
        .eq('id', session_id);
      return res.status(400).json({ error: 'Session timed out' });
    }

    const puzzle = getPuzzleById(session.puzzle_id);
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found' });
    }

    const correctMoves = (puzzle.moves || puzzle.Moves).split(' ');
    const expectedMove = correctMoves[session.progress_index];

    if (move !== expectedMove) {
      const newWrongMoves = (session.wrong_moves || 0) + 1;
      await supabase
        .from('solo_sessions')
        .update({ wrong_moves: newWrongMoves })
        .eq('id', session_id);

      return res.json({ correct: false, wrong_moves: newWrongMoves });
    }

    const newIndex = session.progress_index + 1;

    await supabase
      .from('solo_sessions')
      .update({ progress_index: newIndex + 1 })
      .eq('id', session_id);

    if (newIndex >= correctMoves.length) {
      return res.json({ correct: true, finished: true });
    }

    return res.json({
      correct: true,
      finished: false,
      opponent_move: correctMoves[newIndex],
    });
  } catch (err) {
    console.error('Move validation error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// SUBMIT FINAL (puzzle solved)
export const submitSoloAttempt = async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'Missing session_id' });
    }

    const { data: session } = await supabase
      .from('solo_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', userId)
      .single();

    if (!session || session.status === 'solved') {
      return res.status(400).json({ error: 'Invalid session' });
    }

    const puzzle = getPuzzleById(session.puzzle_id);
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found' });
    }

    const totalMoves = (puzzle.moves || puzzle.Moves).split(' ').length;

    if (session.progress_index < totalMoves) {
      return res.status(400).json({ error: 'Puzzle not completed' });
    }

    // PHASE 2 — server-side timer. We never trust the frontend clock.
    const solveTimeMs = sessionAgeMs(session);
    const solvedAt = new Date().toISOString();
    const time_taken = Math.floor(solveTimeMs / 1000);
    const wrong_moves = session.wrong_moves || 0;

    const reward = calculateReward({
      solveTimeMs,
      puzzleRating: parseInt(puzzle.rating || puzzle.Rating),
      tier: session.tier || (await fetchUserTier(userId)) || 'beginner',
      wrongMoves: wrong_moves,
    });

    // Persist session outcome. Keep `completed=true` for backward compat.
    await supabase
      .from('solo_sessions')
      .update({
        status: 'solved',
        completed: true,
        solved_at: solvedAt,
        solve_time_ms: solveTimeMs,
        reward_amount: reward,
      })
      .eq('id', session_id);

    await supabase.from('solo_attempts').insert({
      user_id: userId,
      puzzle_id: session.puzzle_id,
      solved: true,
      time_taken,
    });

    await logAction({
      userId,
      action: AuditAction.PUZZLE_SOLVED,
      metadata: {
        puzzle_id: session.puzzle_id,
        session_id,
        time_taken_ms: solveTimeMs,
        time_taken_s: time_taken,
        wrong_moves,
        reward,
        tier: session.tier,
      },
      ipAddress: getClientIp(req),
    });

    return res.json({
      solved: true,
      time_taken,
      solve_time_ms: solveTimeMs,
      wrong_moves,
      puzzle_rating: parseInt(puzzle.rating || puzzle.Rating),
      puzzle_id: session.puzzle_id,
      reward,
      message: 'Correct solution!',
    });
  } catch (err) {
    console.error('Submit error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// FAIL SESSION (3 wrong moves)
export const failSoloSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'Missing session_id' });
    }

    const { data: session } = await supabase
      .from('solo_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', userId)
      .single();

    if (!session || session.status === 'solved') {
      return res.status(400).json({ error: 'Invalid session' });
    }

    const puzzle = getPuzzleById(session.puzzle_id);
    const solveTimeMs = sessionAgeMs(session);
    const time_taken = Math.floor(solveTimeMs / 1000);

    // PHASE 2 — explicit status + persistence. reward_amount stays null on fail.
    await supabase
      .from('solo_sessions')
      .update({
        status: 'failed',
        failed: true,
        completed: true,
        solved_at: new Date().toISOString(),
        solve_time_ms: solveTimeMs,
      })
      .eq('id', session_id);

    await supabase.from('solo_attempts').insert({
      user_id: userId,
      puzzle_id: session.puzzle_id,
      solved: false,
      time_taken,
    });

    await logAction({
      userId,
      action: AuditAction.PUZZLE_FAILED,
      metadata: {
        puzzle_id: session.puzzle_id,
        session_id,
        time_taken_ms: solveTimeMs,
        time_taken_s: time_taken,
        wrong_moves: 3,
      },
      ipAddress: getClientIp(req),
    });

    return res.json({
      failed: true,
      time_taken,
      solve_time_ms: solveTimeMs,
      wrong_moves: 3,
      puzzle_rating: parseInt(puzzle?.rating || puzzle?.Rating || 1200),
      puzzle_id: session.puzzle_id,
    });
  } catch (err) {
    console.error('Fail session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
