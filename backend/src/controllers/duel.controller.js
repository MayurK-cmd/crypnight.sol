import { supabase } from '../config/supabase.js';
import { DuelManager } from '../services/duelManager.js';
import { initializeDuelTreasury } from '../services/duelPayoutService.js';

export const getDuelSession = async (req, res) => {
  try {
    const { matchId } = req.params;

    const { data: session } = await supabase
      .from('duel_sessions')
      .select('*')
      .eq('match_id', matchId)
      .single();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching duel session:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getQueueStatus = async (req, res) => {
  try {
    const { tier } = req.params;

    const queueLength = DuelManager.getQueueStatus(tier);

    res.json({
      tier,
      queueLength,
      estimatedWaitSeconds: queueLength >= 2 ? 0 : 30,
    });
  } catch (error) {
    console.error('Error fetching queue status:', error);
    res.status(500).json({ error: error.message });
  }
};

export const initializeTreasury = async (req, res) => {
  try {
    const treasuryPda = await initializeDuelTreasury();

    res.json({
      treasuryPda: treasuryPda.toBase58(),
      message: 'Duel treasury initialized',
    });
  } catch (error) {
    console.error('Error initializing treasury:', error);
    res.status(500).json({ error: error.message });
  }
};
