import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

const PLAYER_A_WALLET = "YOUR_DEMO_WINNER_WALLET_ADDRESS";
const PLAYER_B_WALLET = "YOUR_DEMO_OPPONENT_WALLET_ADDRESS";
const DEMO_TIER = 0;
const DEMO_MATCH_ID = "demo-match-00000000000000000000000000000001";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../target/idl/crypnight_duel.json"),
      "utf8"
    )
  );

  const programId = new anchor.web3.PublicKey(process.env.DUEL_PROGRAM_ID!);
  const program = new anchor.Program(idl, programId, provider);
  const authority = (provider.wallet as anchor.Wallet).payer;

  const playerAPubkey = new anchor.web3.PublicKey(PLAYER_A_WALLET);
  const playerBPubkey = new anchor.web3.PublicKey(PLAYER_B_WALLET);

  const matchIdBytes = Array.from(
    Buffer.from(DEMO_MATCH_ID.padEnd(36, "0").substring(0, 36))
  );

  const [escrowPDA, bump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("duel_escrow"), Buffer.from(matchIdBytes)],
    programId
  );

  console.log("Demo Escrow PDA:", escrowPDA.toBase58());
  console.log("Match ID:", DEMO_MATCH_ID);

  const existing = await provider.connection.getAccountInfo(escrowPDA);
  if (existing) {
    console.log("Escrow already exists. Balance:",
      existing.lamports / anchor.web3.LAMPORTS_PER_SOL, "SOL");
    console.log("Ready for demo. Skipping creation.");
    printEnvInstructions(escrowPDA, programId);
    return;
  }

  console.log("\nStep 1: Creating escrow (Player A deposit)...");
  await program.methods
    .createDuelEscrow(matchIdBytes, DEMO_TIER)
    .accounts({
      escrow: escrowPDA,
      playerA: authority.publicKey,
      playerB: playerBPubkey,
      authority: authority.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([authority])
    .rpc();

  console.log("Player A deposited.");

  console.log("Step 2: Player B deposit...");
  await program.methods
    .joinDuelEscrow()
    .accounts({
      escrow: escrowPDA,
      playerB: authority.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([authority])
    .rpc();

  console.log("Player B deposited. Escrow is ACTIVE and ready.");

  const escrowInfo = await provider.connection.getAccountInfo(escrowPDA);
  console.log(
    "\nEscrow balance:",
    escrowInfo!.lamports / anchor.web3.LAMPORTS_PER_SOL,
    "SOL"
  );

  printEnvInstructions(escrowPDA, programId);
}

function printEnvInstructions(
  escrowPDA: anchor.web3.PublicKey,
  programId: anchor.web3.PublicKey
) {
  console.log("\n─────────────────────────────────────────");
  console.log("Add these to backend/.env:");
  console.log(`DEMO_ESCROW_PDA=${escrowPDA.toBase58()}`);
  console.log(`DEMO_MATCH_ID=demo-match-00000000000000000000000000000001`);
  console.log(`DEMO_PLAYER_A_WALLET=${PLAYER_A_WALLET}`);
  console.log(`DEMO_PLAYER_B_WALLET=${PLAYER_B_WALLET}`);
  console.log("─────────────────────────────────────────\n");
  console.log("Demo is ready. Hit POST /api/demo/trigger-duel-win from Postman.");
}

main().catch(console.error);
