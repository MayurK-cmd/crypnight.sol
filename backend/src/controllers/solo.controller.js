import { supabase } from "../config/supabase.js";
import { validateSolution } from "../utils/validateSolution.js";

export const submitSoloAttempt = async (req, res) => {
  try {
    const userId = req.user.id;
    const { puzzle_id, userMoves, time_taken, difficulty } = req.body;

    if (!puzzle_id || !userMoves || !time_taken || !difficulty) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Fetch puzzle
    const { data: puzzle, error } = await supabase
      .from("puzzles")
      .select("*")
      .eq("puzzle_id", puzzle_id)
      .single();

    if (error || !puzzle) {
      return res.status(404).json({ error: "Puzzle not found" });
    }

    // Validate solution
    const solved = validateSolution(
      puzzle.fen,
      puzzle.moves,
      userMoves
    );

    // Insert attempt
    await supabase.from("solo_attempts").insert({
      user_id: userId,
      puzzle_id,
      solved,
      time_taken,
      difficulty,
    });

    res.json({
      solved,
      message: solved ? "Correct solution!" : "Incorrect solution.",
    });

  } catch (err) {
    console.error("Solo submit error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
