import * as anchor from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idlPath = path.join(__dirname, "../target/idl/crypnight_duel.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

  const programId = new anchor.web3.PublicKey(process.env.DUEL_PROGRAM_ID);
  const program = new anchor.Program(idl, programId, provider);

  const [treasuryPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("duel_treasury")],
    program.programId
  );

  console.log("Duel Treasury PDA:", treasuryPDA.toBase58());

  await program.methods
    .initializeDuelTreasury()
    .accounts({
      treasury: treasuryPDA,
      authority: provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log("✅ Duel treasury initialized.");
  console.log("\nAdd to backend/.env:");
  console.log(`DUEL_PROGRAM_ID=${programId.toBase58()}`);
  console.log(`DUEL_TREASURY_PUBKEY=${treasuryPDA.toBase58()}`);
}

main().catch(console.error);
