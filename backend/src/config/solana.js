const anchor = require('@coral-xyz/anchor');
const { ConnectionMagicRouter } = require('@magicblock-labs/ephemeral-rollups-sdk');
const bs58 = require('bs58');
const fs = require('fs');
const path = require('path');

// Base layer connection — used for non-critical calls (fund, query balance)
const baseConnection = new anchor.web3.Connection(
  process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);

// Magic Router — automatically routes pay_reward to ER, other txs to base layer
// This is the connection used for ALL payout transactions. The ER validator
// (set via delegation) intercepts pay_reward and executes in ~10ms, then syncs back.
const erConnection = new ConnectionMagicRouter(
  process.env.MAGICBLOCK_ROUTER_URL || 'https://devnet-router.magicblock.app',
  {
    wsEndpoint: process.env.MAGICBLOCK_WS_URL || 'wss://devnet-router.magicblock.app',
  }
);

// Platform authority — the backend signer that calls pay_reward
// NEVER expose this private key; NEVER log it; NEVER send to frontend
const authorityKeypair = anchor.web3.Keypair.fromSecretKey(
  bs58.decode(process.env.PLATFORM_AUTHORITY_PRIVATE_KEY)
);

// Load the IDL from the built Anchor program
const idlPath = path.join(
  __dirname,
  '../../../crypnight-contracts/target/idl/crypnight_contracts.json'
);

let idl;
if (fs.existsSync(idlPath)) {
  idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
} else {
  idl = {
    version: '0.1.0',
    name: 'crypnight_contracts',
    instructions: [
      {
        name: 'initializeTreasury',
        accounts: [],
        args: [],
      },
      {
        name: 'payReward',
        accounts: [],
        args: [{ name: 'grossRewardLamports', type: 'u64' }],
      },
      {
        name: 'fundTreasury',
        accounts: [],
        args: [{ name: 'amountLamports', type: 'u64' }],
      },
    ],
  };
}

const programId = new anchor.web3.PublicKey(process.env.SOLANA_PROGRAM_ID);

// Provider uses base connection for general operations
const provider = new anchor.AnchorProvider(
  baseConnection,
  new anchor.Wallet(authorityKeypair),
  { commitment: 'confirmed' }
);

const program = new anchor.Program(idl, programId, provider);

const PLATFORM_TREASURY_PDA = new anchor.web3.PublicKey(
  process.env.PLATFORM_TREASURY_PUBKEY
);

module.exports = {
  baseConnection,
  erConnection,
  authorityKeypair,
  program,
  programId,
  PLATFORM_TREASURY_PDA,
  anchor,
};
