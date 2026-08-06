import { PublicKey } from '@solana/web3.js';

const DUEL_PROGRAM_ID = "EzkHbrB8bTWPVevB9X1AySwt2fAtjqEnZkAnihjZfcEc";
const DEMO_MATCH_ID = "demo-match-00000000000000000000000000000001";

const programId = new PublicKey(DUEL_PROGRAM_ID);
const matchIdBuffer = Buffer.from(DEMO_MATCH_ID.padEnd(36, "0").substring(0, 36));
const matchIdSeed = matchIdBuffer.slice(0, 32);

const [escrowPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("duel_escrow"), matchIdSeed],
  programId
);

console.log("Demo Escrow PDA:", escrowPDA.toBase58());
console.log("Match ID:", DEMO_MATCH_ID);
console.log("\nCopy this into backend/.env and frontend/.env:");
console.log(`DEMO_ESCROW_PDA=${escrowPDA.toBase58()}`);
console.log(`DEMO_MATCH_ID=${DEMO_MATCH_ID}`);


