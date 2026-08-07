import * as web3 from "@solana/web3.js";
import * as fs from "fs";

const ESCROW_PDA = "8iXhZUk7ZdumVE8aWiHqmMnDHdTtTbjj8YRmiAf4vdKx";
const AMOUNT_SOL = 0.10;

async function main() {
  const connection = new web3.Connection("https://api.devnet.solana.com");

  // Load wallet
  const walletPath = process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`;
  const walletData = JSON.parse(fs.readFileSync(walletPath, "utf8"));
  const payer = web3.Keypair.fromSecretKey(Buffer.from(walletData));

  const escrowPubkey = new web3.PublicKey(ESCROW_PDA);

  console.log(`Funding escrow: ${ESCROW_PDA}`);
  console.log(`Payer: ${payer.publicKey.toBase58()}`);
  console.log(`Amount: ${AMOUNT_SOL} SOL`);

  // Check if escrow already exists
  const existing = await connection.getAccountInfo(escrowPubkey);
  if (existing) {
    console.log(`Escrow already exists with balance: ${existing.lamports / web3.LAMPORTS_PER_SOL} SOL`);
  }

  // Transfer SOL to escrow
  const tx = new web3.Transaction().add(
    web3.SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: escrowPubkey,
      lamports: Math.floor(AMOUNT_SOL * web3.LAMPORTS_PER_SOL),
    })
  );

  const signature = await web3.sendAndConfirmTransaction(connection, tx, [payer]);
  console.log(`Transaction: ${signature}`);

  // Verify balance
  const balance = await connection.getBalance(escrowPubkey);
  console.log(`Escrow balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);

  console.log("\n✅ Demo escrow funded and ready!");
  console.log(`\nAdd to backend/.env:`);
  console.log(`DEMO_ESCROW_PDA=${ESCROW_PDA}`);
  console.log(`DEMO_PLAYER_A_WALLET=HxjB35T6gCfDH6wREUurTyvahLT5Gp929AqjJNsFpYbo`);
  console.log(`DEMO_PLAYER_B_WALLET=82YWe86nQSdrBixFhUxHH5nSPuSCzKWc4YhXqRsspYFm`);
}

main().catch(console.error);
