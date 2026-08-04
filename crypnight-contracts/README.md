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

## Testing

```bash
anchor test
```

Runs Rust tests + integration tests.

## File Structure

```
programs/crypnight-contracts/src/
├── lib.rs
│   ├── initialize_treasury()  # Setup
│   ├── pay_reward()           # Main payout
│   ├── fund_treasury()        # Top-up funds
│   └── PlatformTreasury{}     # Struct
└── scripts/
    ├── fund-treasury.js       # Fund existing treasury
    └── initialize-treasury-prod.js (legacy, requires reset)
```

## On-Chain Addresses (Devnet)

Add your deployed addresses after deployment:

- **Program:** `<your-deployed-program-id>`
- **Treasury PDA:** `<your-treasury-pda>`
- **Authority:** `<your-authority-wallet-address>`

View on [Solana Explorer](https://explorer.solana.com/?cluster=devnet).

## Magic Block ER

Payouts execute on Magic Block ER (separate shard). Backend sends transactions via:
- `erConnection` — Magic Block router endpoint
- `getLatestBlockhash()` — ER-specific blockhash
- ~1-2s confirmation time

The treasury and program state live **only on ER**, not devnet mainnet.
