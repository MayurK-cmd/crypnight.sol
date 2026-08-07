# Crypnight Smart Contracts

Solana programs (Rust/Anchor) for Solo and Duel mode on-chain settlement, reward distribution, and escrow management.

## Overview

Crypnight deploys two Solana programs:

- **Solo Program**: Off-chain puzzle solving via Magic Block with on-chain reward settlement
- **Duel Program**: Head-to-head competitive matches with SOL escrow, dispute resolution, and winner payout

Both programs use Devnet and are production-ready for migration to Mainnet (audit required).

## Deployed Programs

### Solo Program
**Address:** [\DKoawaEk5pJj1npwNYXeCCPF3Uqzxahokq67NY387qbK\](https://explorer.solana.com/address/DKoawaEk5pJj1npwNYXeCCPF3Uqzxahokq67NY387qbK?cluster=devnet)

Handles off-chain puzzle settling and reward distribution via Magic Block.

**Key Instructions:**
- \settle_solo\: Submit off-chain puzzle results, settle rewards on-chain
- \claim_rewards\: Withdraw earned SOL from rewards account

### Duel Program
**Address:** [\EzkHbrB8bTWPVevB9X1AySwt2fAtjqEnZkAnihjZfcEc\](https://explorer.solana.com/address/EzkHbrB8bTWPVevB9X1AySwt2fAtjqEnZkAnihjZfcEc?cluster=devnet)

Manages escrow accounts and settlement for duel matches.

**Treasury PDA:** [\6kcSoKW35mTzhf8YCyGwwzPZJBMEH7cVNEZQcohZdgJk\](https://explorer.solana.com/address/6kcSoKW35mTzhf8YCyGwwzPZJBMEH7cVNEZQcohZdgJk?cluster=devnet)

**Key Instructions:**
- \create_duel\: Initialize escrow for new match
- \deposit_stake\: Lock SOL for match (called by both players)
- \settle_winner\: Transfer pot to winner
- \settle_draw\: Refund both stakes
- \orfeit\: End match, return stakes if one player forfeits

### Demo Escrow PDA
**Address:** [\8iXhZUk7ZdumVE8aWiHqmMnDHdTtTbjj8YRmiAf4vdKx\](https://explorer.solana.com/address/8iXhZUk7ZdumVE8aWiHqmMnDHdTtTbjj8YRmiAf4vdKx?cluster=devnet)

Demo escrow for testing duel stakes on Devnet.

## Project Structure

\\\
crypnight-contracts/
+-- programs/
¦   +-- crypnight-solo/
¦   ¦   +-- src/
¦   ¦   ¦   +-- lib.rs              # Entry point, instruction router
¦   ¦   ¦   +-- instructions/
¦   ¦   ¦   ¦   +-- settle_solo.rs  # Off-chain puzzle settlement
¦   ¦   ¦   ¦   +-- claim_rewards.rs # Reward withdrawal
¦   ¦   ¦   +-- state.rs            # Account structs
¦   ¦   +-- Cargo.toml
¦   +-- crypnight-duel/
¦       +-- src/
¦       ¦   +-- lib.rs              # Entry point, instruction router
¦       ¦   +-- instructions/
¦       ¦   ¦   +-- create_duel.rs  # Match initialization
¦       ¦   ¦   +-- deposit_stake.rs # Stake escrow
¦       ¦   ¦   +-- settle_winner.rs # Payout winner
¦       ¦   ¦   +-- settle_draw.rs  # Refund draw
¦       ¦   ¦   +-- forfeit.rs      # Handle forfeit
¦       ¦   +-- state.rs            # Account structs
¦       +-- Cargo.toml
+-- Cargo.toml                      # Workspace root
+-- Anchor.toml                     # Anchor config (networks, programs)
\\\

## Building & Deploying

### Prerequisites
- Rust 1.70+
- Solana CLI
- Anchor CLI (\
pm install -g @coral-xyz/anchor\)

### Build

\\\ash
anchor build
\\\

Compiled programs appear in \	arget/deploy/\.

### Deploy to Devnet

\\\ash
# Set cluster
solana config set --url https://api.devnet.solana.com

# Airdrop SOL to payer
solana airdrop 5 <your-wallet>

# Deploy
anchor deploy
\\\

Output will show deployed program addresses. Update backend \.env\ with new program IDs.

### Deploy to Mainnet

\\\ash
# 1. Audit contracts (required before mainnet)
# 2. Update Anchor.toml cluster = "mainnet"
# 3. Set mainnet RPC

solana config set --url https://api.mainnet-beta.solana.com
anchor deploy
\\\

## Account Structures

### Solo Program

**UserRewards Account**
\\\ust
pub struct UserRewards {
    pub user: Pubkey,           // User wallet
    pub total_earned: u64,      // Lamports earned from puzzles
    pub rewards_claimed: u64,   // Lamports withdrawn
    pub last_settled: i64,      // Timestamp of last settlement
}
\\\

### Duel Program

**DuelMatch Account**
\\\ust
pub struct DuelMatch {
    pub match_id: [u8; 16],     // Unique match ID
    pub player_a: Pubkey,       // Player A wallet
    pub player_b: Pubkey,       // Player B wallet
    pub stake_amount: u64,      // SOL per player (lamports)
    pub status: MatchStatus,    // active, settled, refunded, forfeited
    pub player_a_deposited: bool,
    pub player_b_deposited: bool,
    pub winner: Option<Pubkey>, // Winner wallet (if settled)
    pub created_at: i64,        // Timestamp
}
\\\

**DuelEscrow Account (PDA)**
\\\ust
pub struct DuelEscrow {
    pub match_id: [u8; 16],     // Associated match ID
    pub balance: u64,           // Total locked SOL (2x stake)
    pub player_a_deposited: u64,
    pub player_b_deposited: u64,
}
\\\

## Instruction Reference

### Solo Program

#### settle_solo
Submit off-chain puzzle results and settle rewards on-chain.

**Accounts:**
- \user_rewards\ (writable) — User rewards account
- \user\ (signer) — User wallet
- \system_program\ — System program
- \magic_block_pda\ — Magic Block compute result account

**Arguments:**
\\\ust
pub struct SettleSoloArgs {
    pub puzzles_solved: u32,    // Number of puzzles completed
    pub reward_amount: u64,     // Lamports to award
    pub magic_block_proof: [u8; 32], // Off-chain compute proof
}
\\\

**Effects:**
- Increments user's total_earned by reward_amount
- Creates UserRewards account if it doesn't exist
- Updates last_settled timestamp

#### claim_rewards
Withdraw earned SOL to user wallet.

**Accounts:**
- \user_rewards\ (writable) — User rewards account
- \user\ (writable, signer) — User wallet
- \system_program\ — System program

**Arguments:**
\\\ust
pub struct ClaimRewardsArgs {
    pub amount: u64,            // Lamports to claim
}
\\\

**Effects:**
- Transfers amount from UserRewards to user wallet
- Increments rewards_claimed
- Fails if user has insufficient earned balance

### Duel Program

#### create_duel
Initialize a new duel match and escrow account.

**Accounts:**
- \duel_match\ (writable) — New match account
- \duel_escrow\ (writable) — New escrow PDA
- \player_a\ (signer) — Player A wallet
- \player_b\ — Player B wallet
- \uthority\ (signer) — Authority (backend)
- \system_program\ — System program

**Arguments:**
\\\ust
pub struct CreateDuelArgs {
    pub match_id: [u8; 16],     // Unique match ID (from backend)
    pub stake_amount: u64,      // SOL per player (lamports)
}
\\\

**Effects:**
- Creates DuelMatch account with status = active
- Creates DuelEscrow PDA (seeds: [\"escrow\", match_id])
- Initializes both players as not deposited

#### deposit_stake
Lock SOL from player into escrow.

**Accounts:**
- \duel_match\ (writable) — Match account
- \duel_escrow\ (writable) — Escrow PDA
- \player\ (writable, signer) — Player wallet
- \system_program\ — System program

**Arguments:**
\\\ust
pub struct DepositStakeArgs {
    pub match_id: [u8; 16],
}
\\\

**Effects:**
- Transfers stake_amount SOL from player to escrow
- Sets player_a_deposited or player_b_deposited = true
- Fails if stake already deposited or amount mismatch

#### settle_winner
Transfer pot to winner after match ends.

**Accounts:**
- \duel_match\ (writable) — Match account
- \duel_escrow\ (writable) — Escrow PDA
- \winner\ (writable) — Winner wallet
- \uthority\ (signer) — Authority (backend)
- \system_program\ — System program

**Arguments:**
\\\ust
pub struct SettleWinnerArgs {
    pub match_id: [u8; 16],
    pub winner: Pubkey,
}
\\\

**Effects:**
- Transfers 2x stake_amount from escrow to winner
- Sets match status = settled
- Sets match winner
- Clears escrow balance

#### settle_draw
Refund both players after draw.

**Accounts:**
- \duel_match\ (writable) — Match account
- \duel_escrow\ (writable) — Escrow PDA
- \player_a\ (writable) — Player A wallet
- \player_b\ (writable) — Player B wallet
- \uthority\ (signer) — Authority (backend)
- \system_program\ — System program

**Arguments:**
\\\ust
pub struct SettleDrawArgs {
    pub match_id: [u8; 16],
}
\\\

**Effects:**
- Transfers stake_amount from escrow to each player
- Sets match status = refunded
- Clears escrow balance

#### forfeit
Handle match forfeit, return stakes.

**Accounts:**
- \duel_match\ (writable) — Match account
- \duel_escrow\ (writable) — Escrow PDA
- \orfeit_player\ (signer) — Player forfeiting
- \other_player\ (writable) — Other player wallet
- \uthority\ (signer) — Authority (backend)
- \system_program\ — System program

**Arguments:**
\\\ust
pub struct ForfeitArgs {
    pub match_id: [u8; 16],
}
\\\

**Effects:**
- Transfers 2x stake_amount to non-forfeiting player
- Sets match status = forfeited
- Clears escrow balance

## Magic Block Integration

Solo mode uses Magic Block for off-chain puzzle computation and verification:

1. Backend submits puzzle results to Magic Block ER (Event Relay)
2. Magic Block computes proof (off-chain)
3. Proof returned to backend, forwarded to settle_solo instruction
4. Program verifies proof and settles rewards on-chain

**Magic Block PDA** is derived from match_id and serves as proof verification account.

## Security Considerations

### Access Control
- All settlement instructions require authority signer (backend only)
- Player wallets must sign deposit instructions
- Match creation authorized by backend

### Escrow Safety
- Escrow is a PDA (deterministic address from match_id)
- No direct withdrawals; only programmatic settlement
- Funds locked until match resolved (no early withdrawal)

### Input Validation
- Match IDs validated as unique
- Stake amounts > 0
- Player wallets validated as signers
- Status transitions enforced (no settling active matches)

### Audit Checklist
- [ ] Escrow can't be drained by non-authority
- [ ] Winners correctly receive pot (2x stake)
- [ ] Draws correctly refund both players
- [ ] No funds lost in settlement
- [ ] Timestamp logic prevents replay attacks
- [ ] Magic Block proof validation working

## Testing

### Local Testing

\\\ash
# Start local validator
solana-test-validator

# In another terminal, run tests
anchor test

# Output: Runs all \#[tokio::test]\ in tests/ and programs/*/tests/
\\\

### Devnet Testing

\\\ash
# Deploy to devnet
anchor deploy

# Run devnet-specific tests
npm run test:devnet
\\\

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Build fails: \nchor not found\ | Anchor CLI not installed | \
pm install -g @coral-xyz/anchor\ |
| Deploy fails: \insufficient funds\ | Payer account out of SOL | \solana airdrop 5\ |
| Instruction fails: \ccount not signer\ | Missing signer in accounts | Verify all (signer) accounts are signed |
| Escrow balance mismatch | Math error in settlement | Audit settlement instructions, check proof logic |
| Magic Block proof rejected | Proof invalid or expired | Check proof format, timestamp, and Magic Block connection |

## See Also

- [Backend README](../backend/README.md) — API and settlement endpoint calls
- [Frontend README](../frontend/README.md) — Game flow and UI
- [Root README](../README.md) — Overview
