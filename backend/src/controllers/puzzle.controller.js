import { supabase } from "../config/supabase.js";
import { loadPuzzles, getPuzzleByRating } from "../services/puzzleLoader.js";

export const getPuzzleForUser = async (req, res) => {
  try {
    const userId = req.user.id;

    // Load puzzles into memory (cached after first load)
    await loadPuzzles();

    // Get user tier
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("tier")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.tier) {
      return res.status(400).json({ error: "User tier not set" });
    }

    const ranges = {
      beginner: [800, 1200],
      intermediate: [1200, 1600],
      pro: [1600, 1900],
      gm: [1900, 2500],
      grandmaster: [1900, 2500],
      professional: [1600, 1900]
    };

    const [min, max] = ranges[user.tier] || ranges.intermediate;

    // Get random puzzle from memory cache
    const puzzle = getPuzzleByRating(min, max);

    res.json({ puzzle });

  } catch (err) {
    console.error("Puzzle fetch error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};
