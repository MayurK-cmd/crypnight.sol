import { supabase } from "../config/supabase";

export const getPuzzleForUser = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1️⃣ Get user tier
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
      gm: [1900, 2000],
    };

    const [min, max] = ranges[user.tier];

    // 2️⃣ Count puzzles in range
    const { count, error: countError } = await supabase
      .from("puzzles")
      .select("*", { count: "exact", head: true })
      .gte("rating", min)
      .lte("rating", max);

    if (countError) {
      return res.status(400).json({ error: countError.message });
    }

    if (!count) {
      return res.status(404).json({ error: "No puzzles found" });
    }

    const randomOffset = Math.floor(Math.random() * count);

    // 3️⃣ Fetch puzzle
    const { data, error } = await supabase
      .from("puzzles")
      .select("*")
      .gte("rating", min)
      .lte("rating", max)
      .range(randomOffset, randomOffset);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ puzzle: data[0] });

  } catch (err) {
    console.error("Puzzle fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
