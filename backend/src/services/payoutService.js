const { sendAndConfirmTransaction } = require('@solana/web3.js');
const {
  erConnection,
  baseConnection,
  authorityKeypair,
  program,
  PLATFORM_TREASURY_PDA,
  anchor,
} = require('../config/solana');

const payReward = async (playerWalletAddress, rewardSol) => {
  if (!playerWalletAddress) {
    throw new Error('Player has no linked wallet address');
  }
  if (rewardSol <= 0) {
    throw new Error('Reward must be greater than zero');
  }

  const playerPubkey = new anchor.web3.PublicKey(playerWalletAddress);
  const grossLamports = Math.round(rewardSol * anchor.web3.LAMPORTS_PER_SOL);

  // Build the pay_reward transaction
  let tx = await program.methods
    .payReward(new anchor.BN(grossLamports))
    .accounts({
      authority: authorityKeypair.publicKey,
      treasury: PLATFORM_TREASURY_PDA,
      player: playerPubkey,
    })
    .transaction();

  // Sign with authority and send via ER connection (~10ms)
  // ConnectionMagicRouter automatically routes this to the ER validator
  // because the treasury is delegated to the ER.
  tx.feePayer = authorityKeypair.publicKey;
  tx.recentBlockhash = (await erConnection.getLatestBlockhash()).blockhash;
  tx.sign(authorityKeypair);

  const signature = await sendAndConfirmTransaction(
    erConnection,
    tx,
    [authorityKeypair],
    { skipPreflight: true, commitment: 'confirmed' }
  );

  // Calculate what the player actually received (after 3% fee)
  const fee = Math.round((grossLamports * 300) / 10_000);
  const playerPayout = grossLamports - fee;

  return {
    signature,
    playerPayout: playerPayout / anchor.web3.LAMPORTS_PER_SOL,
    fee: fee / anchor.web3.LAMPORTS_PER_SOL,
  };
};

const getTreasuryBalance = async () => {
  const balance = await baseConnection.getBalance(PLATFORM_TREASURY_PDA);
  return balance / anchor.web3.LAMPORTS_PER_SOL;
};

module.exports = { payReward, getTreasuryBalance };
