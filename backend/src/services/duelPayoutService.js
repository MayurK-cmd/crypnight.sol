import * as anchor from '@coral-xyz/anchor';
import { baseConnection, erConnection, getAuthorityKeypair } from '../config/solana.js';
import { supabase } from '../config/supabase.js';

const DUEL_PROGRAM_ID = process.env.DUEL_PROGRAM_ID || 'CbcMMMUwUN81hWiNkxcwNiatL6G8ghuBGVTBkJVgQYSx';
const DUEL_TREASURY_SEED = Buffer.from('duel_treasury');
const DUEL_ESCROW_SEED = Buffer.from('duel_escrow');

let duelIdl = null;


// Derive duel treasury PDA
const getDuelTreasuryPda = () => {
  const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [DUEL_TREASURY_SEED],
    new anchor.web3.PublicKey(DUEL_PROGRAM_ID)
  );
  return pda;
};

// Derive duel escrow PDA from match_id
const getDuelEscrowPda = (matchId) => {
  const matchIdBuffer = Buffer.from(matchId, 'utf-8');
  const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [DUEL_ESCROW_SEED, matchIdBuffer],
    new anchor.web3.PublicKey(DUEL_PROGRAM_ID)
  );
  return pda;
};

export const settleDuel = async (matchId, state, winnerWallet) => {
  try {
    const authority = getAuthorityKeypair();

    // For demo: use baseConnection (regular devnet) instead of ER for testing
    // In production, this would route through the contract on Magic Block ER
    const instruction = anchor.web3.SystemProgram.transfer({
      fromPubkey: authority.publicKey,
      toPubkey: new anchor.web3.PublicKey(winnerWallet),
      lamports: Math.floor(0.08 * anchor.web3.LAMPORTS_PER_SOL), // 80% of 0.10 SOL
    });

    const tx = new anchor.web3.Transaction().add(instruction);
    const signature = await baseConnection.sendTransaction(tx, [authority]);
    await baseConnection.confirmTransaction(signature, 'confirmed');

    return { signature, tx: signature };
  } catch (error) {
    console.error('Settlement error:', error);
    throw error;
  }
};

export const refundDuel = async ({ matchId, playerAWallet, playerBWallet, session }) => {
  try {
    const authority = getAuthorityKeypair();

    const escrowPda = getDuelEscrowPda(matchId);

    // Log refund to database
    await supabase
      .from('duel_sessions')
      .update({
        status: 'refunded',
      })
      .eq('id', session.id);

    return { status: 'refunded' };
  } catch (error) {
    console.error('Refund error:', error);
    throw error;
  }
};

export const forfeitDuel = async ({ matchId, forfeitingPlayer, session }) => {
  try {
    const authority = getAuthorityKeypair();

    const escrowPda = getDuelEscrowPda(matchId);

    // Log forfeit to database
    await supabase
      .from('duel_sessions')
      .update({
        status: 'forfeited',
      })
      .eq('id', session.id);

    return { status: 'forfeited' };
  } catch (error) {
    console.error('Forfeit error:', error);
    throw error;
  }
};

export const initializeDuelTreasury = async () => {
  try {
    const authority = getAuthorityKeypair();
    const program = await getDuelProgram();

    const treasuryPda = getDuelTreasuryPda();

    console.log('Duel treasury PDA:', treasuryPda.toBase58());
    return treasuryPda;
  } catch (error) {
    console.error('Initialize treasury error:', error);
    throw error;
  }
};
