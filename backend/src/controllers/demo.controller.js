import { supabase } from '../config/supabase.js';
import { settleDuel } from '../services/duelPayoutService.js';
import * as anchor from '@coral-xyz/anchor';

let demoState = {
  status: 'ready',
  winnerWallet: null,
  txSignature: null,
  settledAt: null,
  error: null,
  potSol: null,
  winnerPayout: null,
};

export const triggerDuelWin = async (req, res) => {
  const { winnerWallet } = req.body;

  if (!winnerWallet) {
    return res.status(400).json({ error: 'winnerWallet is required' });
  }

  try {
    new anchor.web3.PublicKey(winnerWallet);
  } catch {
    return res.status(400).json({ error: 'Invalid Solana wallet address' });
  }

  if (demoState.status === 'settling') {
    return res.status(409).json({ error: 'Settlement already in progress' });
  }

  demoState = {
    status: 'settling',
    winnerWallet,
    txSignature: null,
    settledAt: null,
    error: null,
    potSol: null,
    winnerPayout: null,
  };

  res.json({
    message: 'Demo settlement triggered',
    winnerWallet,
    status: 'settling',
  });

  try {
    console.log('[demo] Triggering duel settlement for winner:', winnerWallet);

    const state = {
      playerAWallet: process.env.DEMO_PLAYER_A_WALLET,
      playerBWallet: process.env.DEMO_PLAYER_B_WALLET,
    };

    const result = await settleDuel(
      process.env.DEMO_MATCH_ID,
      state,
      winnerWallet
    );

    const txSignature = result.signature || result.tx;
    const potSol = 0.10;
    const winnerPayout = potSol * 0.80;

    demoState = {
      status: 'settled',
      winnerWallet,
      txSignature,
      settledAt: new Date().toISOString(),
      error: null,
      potSol,
      winnerPayout,
    };

    await supabase.from('audit_logs').insert({
      action: 'demo.duel_settled',
      metadata: {
        winnerWallet,
        txSignature,
        potSol,
        winnerPayout,
        matchId: process.env.DEMO_MATCH_ID,
      },
    });

    console.log('[demo] Settlement complete. Tx:', txSignature);

  } catch (err) {
    console.error('[demo] Settlement failed:', err.message);
    demoState = {
      ...demoState,
      status: 'failed',
      error: err.message,
    };
  }
};

export const getDemoStatus = (req, res) => {
  res.json(demoState);
};
