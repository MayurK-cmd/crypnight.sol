import { supabase } from '../config/supabase.js';
import { getPuzzleById } from '../services/puzzleLoader.js';
import { AuditAction, getClientIp, logAction } from '../utils/auditLog.js';

// START SESSION
export const startSoloSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { puzzle_id } = req.body;

    if (!puzzle_id) {
      return res.status(400).json({ error: 'Puzzle ID required' });
    }

    const { data, error } = await supabase
      .from('solo_sessions')
      .insert({
        user_id: userId,
        puzzle_id,
        progress_index: 1,
        wrong_moves: 0,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ session_id: data.id });
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

    if (!session || session.completed) {
      return res.status(400).json({ error: 'Invalid session' });
    }

    if (session.failed) {
      return res.status(400).json({ error: 'Session already failed' });
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

    if (!session || session.completed) {
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

    const startedAt = new Date(session.started_at).getTime();
    const time_taken = Math.floor((Date.now() - startedAt) / 1000);

    await supabase
      .from('solo_sessions')
      .update({ completed: true })
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
        time_taken,
        wrong_moves: session.wrong_moves || 0,
      },
      ipAddress: getClientIp(req),
    });

    return res.json({
      solved: true,
      time_taken,
      wrong_moves: session.wrong_moves || 0,
      puzzle_rating: parseInt(puzzle.rating || puzzle.Rating),
      puzzle_id: session.puzzle_id,
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

    if (!session) {
      return res.status(400).json({ error: 'Invalid session' });
    }

    const puzzle = getPuzzleById(session.puzzle_id);
    const startedAt = new Date(session.started_at).getTime();
    const time_taken = Math.floor((Date.now() - startedAt) / 1000);

    await supabase
      .from('solo_sessions')
      .update({ failed: true, completed: true })
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
        time_taken,
        wrong_moves: 3,
      },
      ipAddress: getClientIp(req),
    });

    return res.json({
      failed: true,
      time_taken,
      wrong_moves: 3,
      puzzle_rating: parseInt(puzzle?.rating || puzzle?.Rating || 1200),
      puzzle_id: session.puzzle_id,
    });
  } catch (err) {
    console.error('Fail session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
