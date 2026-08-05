const { PublicKey } = require("@solana/web3.js");

const DUEL_PROGRAM_ID = "EzkHbrB8bTWPVevB9X1AySwt2fAtjqEnZkAnihjZfcEc";
const DUEL_TREASURY_SEED = Buffer.from("duel_treasury");

const programId = new PublicKey(DUEL_PROGRAM_ID);

// Find PDA for duel treasury
const [treasuryPDA, bump] = PublicKey.findProgramAddressSync(
  [DUEL_TREASURY_SEED],
  programId
);

console.log("Duel Program ID:", DUEL_PROGRAM_ID);
console.log("Duel Treasury PDA:", treasuryPDA.toBase58());
console.log("Bump:", bump);

console.log("\n✅ Add to backend/.env:");
console.log(`DUEL_PROGRAM_ID=${DUEL_PROGRAM_ID}`);
console.log(`DUEL_TREASURY_PUBKEY=${treasuryPDA.toBase58()}`);
