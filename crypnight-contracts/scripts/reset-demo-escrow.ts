import * as anchor from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

const DEMO_MATCH_ID = `demo-match-${Date.now().toString().substring(0, 36)}`;

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

  const matchIdBytes = Array.from(
    Buffer.from(DEMO_MATCH_ID.padEnd(36, "0").substring(0, 36))
  );

  const [escrowPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("duel_escrow"), Buffer.from(matchIdBytes)],
    programId
  );

  console.log("Creating new demo escrow...");
  console.log("Match ID:", DEMO_MATCH_ID);

  await program.methods
    .createDuelEscrow(matchIdBytes, 0)
    .accounts({
      escrow: escrowPDA,
      playerA: authority.publicKey,
      playerB: authority.publicKey,
      authority: authority.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([authority])
    .rpc();

  await program.methods
    .joinDuelEscrow()
    .accounts({
      escrow: escrowPDA,
      playerB: authority.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([authority])
    .rpc();

  console.log("New demo escrow ready.");
  console.log("\nUpdate backend/.env:");
  console.log(`DEMO_ESCROW_PDA=${escrowPDA.toBase58()}`);
  console.log(`DEMO_MATCH_ID=${DEMO_MATCH_ID}`);
}

main().catch(console.error);
