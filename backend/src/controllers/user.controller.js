import { supabase } from "../config/supabase.js";
import { verifySignature } from "../utils/verifySignature.js";
import { AuditAction, getClientIp, logAction } from "../utils/auditLog.js";

export const linkWallet = async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;
    const userId = req.user.id;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        error: "Missing walletAddress, signature, or message",
      });
    }

    const isValid = verifySignature(message, signature, walletAddress);

    if (!isValid) {
      await logAction({
        userId,
        action: AuditAction.WALLET_LINK_FAILED,
        metadata: { walletAddress, reason: 'invalid_signature' },
        ipAddress: getClientIp(req),
      });
      return res.status(400).json({
        error: "Invalid wallet signature",
      });
    }

    // Make sure this wallet isn't already linked to someone else (cheap extra check).
    const { data: existingUser } = await supabase
      .from("users")
      .select("wallet_address, id")
      .eq("id", userId)
      .single();

    if (existingUser?.wallet_address) {
      await logAction({
        userId,
        action: AuditAction.WALLET_LINK_FAILED,
        metadata: { walletAddress, reason: 'already_linked' },
        ipAddress: getClientIp(req),
      });
      return res.status(403).json({
        error: "Wallet already linked",
      });
    }

    await supabase
      .from("users")
      .update({ wallet_address: walletAddress })
      .eq("id", userId);

    await logAction({
      userId,
      action: AuditAction.WALLET_LINKED,
      metadata: { walletAddress },
      ipAddress: getClientIp(req),
    });

    return res.json({ message: "Wallet linked successfully" });
  } catch (err) {
    console.error("Wallet link error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

const allowedTiers = ['beginner', 'intermediate', 'professional', 'grandmaster'];

const defaultRatings = {
  beginner: 1000,
  intermediate: 1400,
  professional: 1700,
  grandmaster: 2100,
};

export const setTier = async (req, res) => {
  const { tier } = req.body;
  const userId = req.user.id;

  if (!allowedTiers.includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  const { data: existingUser } = await supabase
    .from('users')
    .select('tier')
    .eq('id', userId)
    .single();

  if (existingUser?.tier) {
    return res.status(403).json({
      error: 'Tier already set. Cannot change.',
    });
  }

  await supabase
    .from('users')
    .update({
      tier,
      rating: defaultRatings[tier],
      is_setup_complete: true,
    })
    .eq('id', userId);

  await logAction({
    userId,
    action: AuditAction.TIER_SELECTED,
    metadata: { tier },
    ipAddress: getClientIp(req),
  });

  return res.json({ message: 'Tier set successfully' });
};

export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    return res.status(200).json({ profile: data });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
