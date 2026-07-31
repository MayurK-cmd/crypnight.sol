import { supabase } from '../config/supabase.js';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// GET /api/solo/history?page=1&limit=20
//
// Returns the caller's recent solo attempts joined with the corresponding
// solo_sessions row so the UI can show reward / exact-ms timings.
export const getMatchHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = clamp(parseInt(req.query.page, 10) || 1, 1, 1000);
    const limit = clamp(parseInt(req.query.limit, 10) || 20, 1, 50);
    const offset = (page - 1) * limit;

    // Pull sessions first (this is what we want to display, newest first).
    const {
      data: rows,
      error,
      count,
    } = await supabase
      .from('solo_sessions')
      .select(
        'id, puzzle_id, tier, status, wrong_moves, solve_time_ms, reward_amount, started_at, solved_at',
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .in('status', ['solved', 'failed'])
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({
      history: rows ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
      },
    });
  } catch (err) {
    console.error('History error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/leaderboard/global?limit=50
export const getGlobalLeaderboard = async (req, res) => {
  try {
    const limit = clamp(parseInt(req.query.limit, 10) || 50, 1, 100);

    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('global_rank', { ascending: true })
      .limit(limit);

    if (error) {
      // Fallback: if pg_cron/leaderboard view isn't yet built, derive inline.
      return res.status(500).json({ error: error.message });
    }

    return res.json({ leaderboard: data ?? [] });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/leaderboard/tier/:tier?limit=25
export const getTierLeaderboard = async (req, res) => {
  try {
    const tier = String(req.params.tier || '').toLowerCase();
    const allowed = new Set(['beginner', 'intermediate', 'pro', 'gm', 'professional', 'grandmaster']);
    if (!allowed.has(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const limit = clamp(parseInt(req.query.limit, 10) || 25, 1, 50);

    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      // leaderboard.tier stores the canonical short form ('pro', 'gm') — map long→short
      .eq('tier', tier === 'professional' ? 'pro' : tier === 'grandmaster' ? 'gm' : tier)
      .order('tier_rank', { ascending: true })
      .limit(limit);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ tier, leaderboard: data ?? [] });
  } catch (err) {
    console.error('Tier leaderboard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/leaderboard/my-rank
export const getMyRank = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('leaderboard')
      .select('global_rank, tier_rank, tier, rating, puzzles_solved, best_streak')
      .eq('user_id', userId)
      .single();

    if (error) {
      // Most likely the user has fewer than 5 solves — the view filters those out.
      return res
        .status(404)
        .json({ error: 'Not ranked yet — need at least 5 solved puzzles' });
    }

    return res.json(data);
  } catch (err) {
    console.error('My-rank error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
