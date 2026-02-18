import { supabase } from "../config/supabase.js";
import { Chess } from "chess.js";


// 🔥 START SESSION
export const startSoloSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { puzzle_id } = req.body;

    if (!puzzle_id) {
      return res.status(400).json({ error: "Puzzle ID required" });
    }

    const { data, error } = await supabase
      .from("solo_sessions")
      .insert({
        user_id: userId,
        puzzle_id,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ session_id: data.id });

  } catch (err) {
    console.error("Start session error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};



// 🔥 VALIDATE MOVE
export const submitSoloMove = async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id, move } = req.body;

    if (!session_id || !move) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const { data: session } = await supabase
      .from("solo_sessions")
      .select("*")
      .eq("id", session_id)
      .eq("user_id", userId)
      .single();

    if (!session || session.completed) {
      return res.status(400).json({ error: "Invalid session" });
    }

    if (session.failed) {
      return res.status(400).json({ error: "Session already failed" });
    }

    const { data: puzzle } = await supabase
      .from("puzzles")
      .select("*")
      .eq("puzzle_id", session.puzzle_id)
      .single();

    const correctMoves = puzzle.moves.split(" ");

    const expectedMove = correctMoves[session.progress_index];

    if (move !== expectedMove) {
      return res.json({ correct: false });
    }

    // Move is correct → increment progress
    const newIndex = session.progress_index + 1;

    await supabase
      .from("solo_sessions")
      .update({ progress_index: newIndex })
      .eq("id", session_id);

    // If puzzle finished
    if (newIndex >= correctMoves.length) {
      return res.json({ correct: true, finished: true });
    }

    return res.json({
      correct: true,
      finished: false,
      opponent_move: correctMoves[newIndex]
    });

  } catch (err) {
    console.error("Move validation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};



// 🔥 SUBMIT FINAL
export const submitSoloAttempt = async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: "Missing session_id" });
    }

    const { data: session } = await supabase
      .from("solo_sessions")
      .select("*")
      .eq("id", session_id)
      .eq("user_id", userId)
      .single();

    if (!session || session.completed) {
      return res.status(400).json({ error: "Invalid session" });
    }

    const { data: puzzle } = await supabase
      .from("puzzles")
      .select("*")
      .eq("puzzle_id", session.puzzle_id)
      .single();

    const totalMoves = puzzle.moves.split(" ").length;

    if (session.progress_index < totalMoves) {
      return res.status(400).json({ error: "Puzzle not completed" });
    }

    const startedAt = new Date(session.started_at).getTime();
    const time_taken = Math.floor((Date.now() - startedAt) / 1000);

    await supabase
      .from("solo_sessions")
      .update({ completed: true })
      .eq("id", session_id);

    await supabase.from("solo_attempts").insert({
      user_id: userId,
      puzzle_id: puzzle.puzzle_id,
      solved: true,
      time_taken
    });

    res.json({
      solved: true,
      time_taken,
      message: "Correct solution!"
    });

  } catch (err) {
    console.error("Submit error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
