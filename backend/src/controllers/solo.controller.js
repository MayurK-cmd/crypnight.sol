import { supabase } from "../config/supabase.js";
import { Chess } from "chess.js";


export const submitSoloAttempt = async (req, res) => {
  try {
    const userId = req.user.id;
    const { puzzle_id, userMoves, time_taken, difficulty } = req.body;

    if (!puzzle_id || !time_taken == null ) {
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

    

    const chess = new Chess(puzzle.fen);
const moves = puzzle.moves.split(" ");

try {
  for (const move of moves) {
    chess.move({
      from: move.slice(0, 2),
      to: move.slice(2, 4),
      promotion: move[4] || undefined,
    });
  }
} catch {
  return res.status(400).json({ error: "Invalid puzzle data" });
}

const solved = true;

    // Insert attempt
    await supabase.from("solo_attempts").insert({
      user_id: userId,
      puzzle_id,
      solved,
      time_taken,
      
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
