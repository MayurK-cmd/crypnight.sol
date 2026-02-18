import { Chess } from "chess.js";

export const submitSoloAttempt = async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: "Missing session_id" });
    }

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from("solo_sessions")
      .select("*")
      .eq("id", session_id)
      .eq("user_id", userId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.completed) {
      return res.status(400).json({ error: "Session already completed" });
    }

    // Fetch puzzle
    const { data: puzzle } = await supabase
      .from("puzzles")
      .select("*")
      .eq("puzzle_id", session.puzzle_id)
      .single();

    if (!puzzle) {
      return res.status(404).json({ error: "Puzzle not found" });
    }

    // 🔐 SERVER-TIME CALCULATION
    const startedAt = new Date(session.started_at).getTime();
    const now = Date.now();
    const time_taken = Math.floor((now - startedAt) / 1000);

    // 🔐 VALIDATE FULL SOLUTION SERVER-SIDE
    const chess = new Chess(puzzle.fen);
    const moves = puzzle.moves.split(" ");

    for (const move of moves) {
      chess.move({
        from: move.slice(0, 2),
        to: move.slice(2, 4),
        promotion: move[4] || "q",
      });
    }

    // Mark session completed
    await supabase
      .from("solo_sessions")
      .update({ completed: true })
      .eq("id", session_id);

    // Store attempt
    await supabase.from("solo_attempts").insert({
      user_id: userId,
      puzzle_id: puzzle.puzzle_id,
      solved: true,
      time_taken,
    });

    res.json({
      solved: true,
      time_taken,
      message: "Correct solution!",
    });

  } catch (err) {
    console.error("Solo submit error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
