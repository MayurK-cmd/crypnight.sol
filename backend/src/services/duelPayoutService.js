import { sendAndConfirmTransaction } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { ConnectionMagicRouter } from '@magicblock-labs/ephemeral-rollups-sdk';
import bs58 from 'bs58';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const baseConnection = new anchor.web3.Connection(
  process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);

const erConnection = new ConnectionMagicRouter(
  process.env.MAGICBLOCK_ROUTER_URL || 'https://devnet-router.magicblock.app',
  { wsEndpoint: process.env.MAGICBLOCK_WS_URL || 'wss://devnet-router.magicblock.app' }
);

const authorityKeypair = anchor.web3.Keypair.fromSecretKey(
  bs58.decode(process.env.PLATFORM_AUTHORITY_PRIVATE_KEY)
);

const duelIdlPath = path.join(__dirname, '../../../crypnight-contracts/target/idl/crypnight_duel.json');
const duelIdl = JSON.parse(fs.readFileSync(duelIdlPath, 'utf8'));

const duelProgramId = new anchor.web3.PublicKey(process.env.DUEL_PROGRAM_ID);
const duelTreasuryPDA = new anchor.web3.PublicKey(process.env.DUEL_TREASURY_PUBKEY);

const provider = new anchor.AnchorProvider(
  baseConnection,
  new anchor.Wallet(authorityKeypair),
  { commitment: 'confirmed' }
);

const duelProgram = new anchor.Program(duelIdl, duelProgramId, provider);

const deriveEscrowPDA = (matchId) => {
  const matchIdBytes = Buffer.from(matchId.replace(/-/g, '').padEnd(36, '0').substring(0, 36));
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('duel_escrow'), matchIdBytes],
    duelProgramId
  );
};

export const duelPayoutService = {
  settleDuel: async (matchId, state, winnerId) => {
    const [escrowPDA] = deriveEscrowPDA(matchId);
    const winnerPubkey = new anchor.web3.PublicKey(winnerId);
    const playerAPubkey = new anchor.web3.PublicKey(state.playerAWallet);
    const playerBPubkey = new anchor.web3.PublicKey(state.playerBWallet);

    let tx = await duelProgram.methods
      .settleDuel(winnerPubkey)
      .accounts({
        escrow: escrowPDA,
        authority: authorityKeypair.publicKey,
        playerA: playerAPubkey,
        playerB: playerBPubkey,
        duelTreasury: duelTreasuryPDA,
      })
      .transaction();

    tx.feePayer = authorityKeypair.publicKey;
    tx.recentBlockhash = (await erConnection.getLatestBlockhash()).blockhash;
    tx.sign(authorityKeypair);

    return await sendAndConfirmTransaction(erConnection, tx, [authorityKeypair], {
      skipPreflight: true,
      commitment: 'confirmed',
    });
  },

  refundDuel: async (matchId, state) => {
    const [escrowPDA] = deriveEscrowPDA(matchId);
    const playerAPubkey = new anchor.web3.PublicKey(state.playerAWallet);
    const playerBPubkey = new anchor.web3.PublicKey(state.playerBWallet);

    let tx = await duelProgram.methods
      .refundDuel()
      .accounts({
        escrow: escrowPDA,
        authority: authorityKeypair.publicKey,
        playerA: playerAPubkey,
        playerB: playerBPubkey,
      })
      .transaction();

    tx.feePayer = authorityKeypair.publicKey;
    tx.recentBlockhash = (await erConnection.getLatestBlockhash()).blockhash;
    tx.sign(authorityKeypair);

    return await sendAndConfirmTransaction(erConnection, tx, [authorityKeypair], {
      skipPreflight: true,
      commitment: 'confirmed',
    });
  },

  forfeitDuel: async (matchId, state, forfeitingUserId) => {
    const [escrowPDA] = deriveEscrowPDA(matchId);
    const forfeitingPubkey = new anchor.web3.PublicKey(forfeitingUserId);
    const playerAPubkey = new anchor.web3.PublicKey(state.playerAWallet);
    const playerBPubkey = new anchor.web3.PublicKey(state.playerBWallet);

    let tx = await duelProgram.methods
      .forfeitDuel(forfeitingPubkey)
      .accounts({
        escrow: escrowPDA,
        authority: authorityKeypair.publicKey,
        playerA: playerAPubkey,
        playerB: playerBPubkey,
        duelTreasury: duelTreasuryPDA,
      })
      .transaction();

    tx.feePayer = authorityKeypair.publicKey;
    tx.recentBlockhash = (await erConnection.getLatestBlockhash()).blockhash;
    tx.sign(authorityKeypair);

    return await sendAndConfirmTransaction(erConnection, tx, [authorityKeypair], {
      skipPreflight: true,
      commitment: 'confirmed',
    });
  },

  deriveEscrowPDA,
};
