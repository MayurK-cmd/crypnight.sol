import { supabase } from "../config/supabase";
import {verifySignature} from "../utils/verifySignature";

export const linkWallet = async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;  // ✅ extract message
    const userId = req.user.id;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        error: "Missing walletAddress, signature, or message",
      });
    }

    const isValid = verifySignature(message, signature, walletAddress);

    if (!isValid) {
      return res.status(400).json({
        error: "Invalid wallet signature",
      });
    }

    console.log("JWT user id:", userId);

const { data: existingUser, error } = await supabase
  .from("users")
  .select("*")
  .eq("id", userId);

console.log("Query result:", existingUser);
console.log("Query error:", error);


    // Check if wallet already linked
    // const { data: existingUser } = await supabase
    //   .from("users")
    //   .select("wallet_address")
    //   .eq("id", userId)
    //   .single();

    if (existingUser.wallet_address) {
      return res.status(403).json({
        error: "Wallet already linked",
      });
    }

    await supabase
      .from("users")
      .update({ wallet_address: walletAddress })
      .eq("id", userId);

    return res.json({ message: "Wallet linked successfully" });

  } catch (err) {
    console.error("Wallet link error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }

  
};


export const setTier = async (req, res) => {
    const { tier } = req.body;
    const userId = req.user.id;

    const allowedTiers = ['beginner', 'intermediate', 'professional','grandmaster'];
    if (!allowedTiers.includes(tier)) {
        return res.status(400).json({ error: 'Invalid tier' });
    }

    const { data: existingUser } = await supabase
    .from('users')
    .select('tier')
    .eq('id', userId)
    .single();

  if (existingUser.tier) {
    return res.status(403).json({
      error: 'Tier already set. Cannot change.',
    });
  }

  const defaultRatings = {
    beginner: 1000,
    intermediate: 1400,
    professional: 1700,
    grandmaster: 2100,
  };

  await supabase
    .from('users')
    .update({
      tier,
      rating: defaultRatings[tier],
      is_setup_complete: true,
    })
    .eq('id', userId);

  res.json({ message: 'Tier set successfully' });
};

export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id; // comes from verifyUser middleware

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      return res.status(400).json({
        error: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "User profile not found",
      });
    }

    return res.status(200).json({
      profile: data,
    });

  } catch (err) {
    console.error("Get profile error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};
