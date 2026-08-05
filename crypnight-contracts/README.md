# Smart Contracts — CrypNight.sol

Anchor framework smart contracts for on-chain payouts on Solana via Magic Block ER.

## Setup

### Prerequisites
- Rust 1.70+ (`rustup update`)
- Solana CLI (`solana --version`)
- Anchor 0.29+ (`anchor --version`)
- Node.js 18+

### Installation

```bash
cd crypnight-contracts
npm install
```

### Configuration

**Anchor.toml:**
```toml
[toolchain]
package_manager = "yarn"

[programs.devnet]
crypnight_contracts = "contracct-id"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"
```

Ensure your Solana CLI points to devnet:
```bash
solana config set --url https://api.devnet.solana.com
solana airdrop 5  # Get devnet SOL
```

## Build & Deploy

### Build

```bash
anchor build
```

Output: `target/idl/crypnight_contracts.json` + `.so` file.

### Deploy

```bash
anchor deploy
```

Contract deployed to `contract-id` on devnet.

### Initialize Treasury

Treasury must be initialized before payouts work. Fund an existing treasury (no reallocation):

```bash
node scripts/fund-treasury.js
```

Transfers 2 SOL to treasury PDA (`omyRQ6Ynne5seohfqiMQRPyaMuSkPDi9gksUeKm4oi6`).

## Program Instructions

### `initialize_treasury()`
- **Accounts:** treasury, authority, system_program
- **Effect:** Allocate treasury PDA, set authority
- **Requires:** Authority as signer

### `pay_reward(gross_reward_lamports: u64)`
- **Accounts:** authority, treasury, player
- **Effect:** Debit treasury, credit player, deduct 3% fee
- **Requires:** Authority matches treasury.authority

### `fund_treasury(amount_lamports: u64)`
- **Accounts:** funder, treasury, system_program
- **Effect:** Transfer SOL from funder to treasury
- **Note:** Can be called by anyone

---

## Magic Block Ephemeral Rollups (ER)

CrypNight smart contracts execute payouts on **Magic Block Ephemeral Rollups**, not mainnet Solana:

- **Program lives on ER:** Treasury PDA and payout state are stored on the ER shard
- **Backend initiates:** Backend sends signed `pay_reward` instructions to ER via Magic Block router
- **Fast settlement:** Confirmation in ~1-2 seconds (vs. Solana's ~13s slot finality)
- **Final:** Results commit to Solana after ER batch settlement; no rollback risk
- **No mainnet clutter:** Treasury PDA never appears in mainnet ledger

### Treasury State

Treasury PDA (`omyRQ6Ynne5seohfqiMQRPyaMuSkPDi9gksUeKm4oi6` on devnet ER):
- Holds SOL funded via `fund-treasury.js`
- Authority account required to sign `pay_reward` transactions
- 3% platform fee deducted on each payout

### Backend Integration

Backend connects to both:
1. **Solana devnet** (`https://api.devnet.solana.com`) — for baseline state verification
2. **Magic Block ER router** (`https://devnet-router.magicblock.app`) — sends payout transactions

See [backend/README.md](../backend/README.md) for payout flow architecture and [Magic Block Docs](https://docs.magicblock.io) for ER details.

---

```bash
anchor test
```

Runs Rust tests + integration tests.

## File Structure

```
programs/
├── crypnight-contracts/src/
│   ├── lib.rs
│   │   ├── initialize_treasury()  # Setup
│   │   ├── pay_reward()           # Main payout (ER)
│   │   ├── fund_treasury()        # Top-up funds
│   │   └── PlatformTreasury{}     # Struct
│   └── state.rs
├── crypnight-duel/src/
│   ├── lib.rs                     # Duel-specific payouts
│   └── state.rs
└── scripts/
    ├── fund-treasury.js           # Fund existing treasury on ER
    └── initialize-treasury-prod.js (legacy)
```

## On-Chain Addresses (Devnet ER)

Magic Block ER shard addresses (not mainnet):

- **Solo Program:** `<SOLO_PROGRAM_ID>`
- **Duel Program:** `<DUEL_PROGRAM_ID>`
- **Treasury PDA:** `omyRQ6Ynne5seohfqiMQRPyaMuSkPDi9gksUeKm4oi6` (devnet ER)
- **Authority:** `<your-authority-wallet-address>`

View ER transactions via Magic Block explorer: https://explorer.magicblock.io (devnet mode).

*Replace placeholders with actual deployed program IDs after `anchor deploy`.*

## Magic Block ER

Payouts execute on Magic Block ER (separate shard). Backend sends transactions via:
- `erConnection` — Magic Block router endpoint
- `getLatestBlockhash()` — ER-specific blockhash
- ~1-2s confirmation time

The treasury and program state live **only on ER**, not devnet mainnet.
