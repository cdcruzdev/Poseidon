# Arcium Integration Guide for Privacy-Preserving DeFi

> **Status**: Arcium Public Testnet on Solana Devnet
> **Last Updated**: February 2026
> **SDK Version**: v0.6.3+ / v0.7.0 clusters

## Table of Contents

1. [Overview](#1-overview)
2. [Installation](#2-installation)
3. [Project Structure](#3-project-structure)
4. [Writing Confidential Instructions (Arcis)](#4-writing-confidential-instructions-arcis)
5. [MXE Setup](#5-mxe-setup)
6. [TypeScript Client Integration](#6-typescript-client-integration)
7. [Encryption Flow](#7-encryption-flow)
8. [Testnet Details](#8-testnet-details)
9. [Example Walkthrough: Sealed-Bid Auction](#9-example-walkthrough-sealed-bid-auction)
10. [DeFi Vault Integration Patterns](#10-defi-vault-integration-patterns)
11. [Limitations & Considerations](#11-limitations--considerations)

---

## 1. Overview

### What is Arcium?

Arcium is a **decentralized private computation network** that enables secure processing of encrypted data through **Multi-Party Computation (MPC)**. It allows computations to run on fully encrypted data without ever decrypting it.

### Key Concepts

| Term | Description |
|------|-------------|
| **MXE** | MPC eXecution Environment - your privacy-preserving application |
| **Arcis** | Rust framework for writing MPC circuits |
| **ARX Nodes** | MPC execution nodes that process encrypted data |
| **Cluster** | Group of ARX nodes that collaborate on computations |
| **Computation** | A single MPC operation submitted to the network |

### How It Works

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client    │────▶│   MXE Program   │────▶│  Arcium Network │
│ (Encrypts)  │     │   (Solana)      │     │  (MPC Cluster)  │
└─────────────┘     └─────────────────┘     └─────────────────┘
      │                     │                       │
      │ x25519 key exchange │                       │
      │ Rescue cipher       │                       │
      └─────────────────────│───────────────────────┘
                            │
                     ┌──────▼──────┐
                     │  Callback   │
                     │ (Results)   │
                     └─────────────┘
```

1. Client encrypts data using shared secret (x25519 key exchange)
2. Encrypted data sent to MXE program on Solana
3. MXE queues computation for MPC cluster
4. Cluster processes data while keeping it encrypted (secret shares)
5. Results returned via callback instruction

---

## 2. Installation

### Prerequisites

- **Rust**: https://www.rust-lang.org/tools/install
- **Solana CLI 2.3.0**: https://docs.solana.com/cli/install-solana-cli-tools
- **Anchor 0.32.1**: https://www.anchor-lang.com/docs/installation
- **Yarn**: https://yarnpkg.com/getting-started/install
- **Docker & Docker Compose**: Required for local testing

### Quick Install (Mac/Linux)

```bash
curl --proto '=https' --tlsv1.2 -sSfL https://install.arcium.com/ | bash
```

This installs:
- `arcup` - Version manager for Arcium tooling
- `arcium` CLI - Project management and deployment
- Arx Node software

### Verify Installation

```bash
arcium --version
```

### Manual Installation

```bash
# Install arcup (replace <YOUR_TARGET> with your platform)
# Targets: aarch64_linux, x86_64_linux, aarch64_macos, x86_64_macos
# Note: Windows NOT supported - use WSL2

arcup install
arcium --version
```

### PATH Setup (if needed)

```bash
# Add to ~/.bashrc or ~/.zshrc
export PATH="$HOME/.cargo/bin:$PATH"
```

---

## 3. Project Structure

### Initialize New Project

```bash
arcium init my-private-vault
cd my-private-vault
```

### Directory Structure

```
my-private-vault/
├── Anchor.toml              # Anchor configuration
├── Arcium.toml              # Arcium-specific configuration
├── Cargo.toml               # Workspace definition
├── programs/
│   └── my-private-vault/
│       ├── Cargo.toml       # Solana program dependencies
│       └── src/
│           └── lib.rs       # Solana program (queue/callback)
├── encrypted-ixs/           # ⭐ Confidential instructions
│   ├── Cargo.toml
│   └── src/
│       └── add_together.rs  # Arcis circuits
├── tests/
│   └── my-private-vault.ts  # TypeScript integration tests
└── build/                   # Generated after arcium build
    └── *.arcis              # Compiled circuits
```

### Arcium.toml Configuration

```toml
[localnet]
nodes = 2
localnet_timeout_secs = 60
backends = ["Cerberus"]

# For devnet deployment
[clusters.devnet]
offset = 456  # v0.7.0 cluster (recommended)
# offset = 123  # v0.5.4 cluster (older)
```

### Key Differences from Anchor

1. **`Arcium.toml`** - Configuration for MPC cluster connection
2. **`encrypted-ixs/`** - Arcis circuits that run in MPC
3. **`#[arcium_program]`** - Replaces `#[program]` macro
4. **Three instructions per operation**: init_comp_def, queue, callback

---

## 4. Writing Confidential Instructions (Arcis)

### Basic Structure

```rust
// encrypted-ixs/src/my_circuit.rs
use arcis::*;

#[encrypted]
mod circuits {
    use arcis::*;

    // Input struct
    pub struct MyInput {
        amount: u64,
        flag: bool,
    }

    // Entry point - callable from Solana
    #[instruction]
    pub fn process_private(
        input: Enc<Shared, MyInput>  // Client + MXE can decrypt
    ) -> Enc<Shared, u64> {
        // Convert encrypted → secret shares (never decrypted!)
        let data = input.to_arcis();
        
        // Compute on secret shares
        let result = if data.flag {
            data.amount * 2
        } else {
            data.amount
        };
        
        // Convert secret shares → encrypted output
        input.owner.from_arcis(result)
    }
}
```

### Encryption Ownership Types

| Type | Who Can Decrypt | Use Case |
|------|-----------------|----------|
| `Enc<Shared, T>` | Client + MXE | User inputs/outputs that need client verification |
| `Enc<Mxe, T>` | MXE only | Protocol state (order books, vaults, etc.) |

### Supported Types

```rust
// Integers
u8, u16, u32, u64, u128, usize
i8, i16, i32, i64, i128, isize

// Floats (fixed-point emulated, range [-2^75, 2^75))
f64, f32

// Collections
[T; N]        // Fixed-size arrays ONLY
(T1, T2, ...) // Tuples

// Custom structs
#[derive(Copy, Clone)]
struct MyStruct {
    field1: u64,
    field2: bool,
}

// NOT supported
Vec<T>        // ❌ Variable length
String        // ❌ Variable length
HashMap       // ❌ Variable length
enum          // ❌ Not yet supported
```

### Control Flow Constraints

```rust
// ✅ Works - both branches ALWAYS execute, condition selects result
let result = if secret_condition { a } else { b };

// ✅ Works - fixed iteration count
for i in 0..100 {
    process(arr[i]);
}

// ❌ Won't compile - iteration depends on secret
while secret_value < threshold {
    secret_value += 1;
}

// ❌ Won't compile - early exit based on secret
for i in 0..1000 {
    if found { break; }  // No break/continue
}

// ❌ Won't compile - no match expressions yet
match value {
    0 => do_a(),
    _ => do_b(),
}
```

### Reveal and Encryption Placement

```rust
// ❌ Cannot reveal inside conditional
if secret_condition {
    value.reveal()  // Error!
}

// ✅ Select first, then reveal outside
let selected = if secret_condition { a } else { b };
selected.reveal()  // OK

// Same for .from_arcis()
let result = if condition { x } else { y };
owner.from_arcis(result)  // OK
```

### Operation Costs

| Operation | Cost | Notes |
|-----------|------|-------|
| Addition, subtraction | Nearly free | Local on shares |
| Multiplication by constant | Nearly free | Local |
| Multiplication | Cheap | Preprocessing optimized |
| Comparisons (<, >, ==) | **Expensive** | Bit decomposition |
| Division, modulo | **Very expensive** | Iterative |
| Dynamic array indexing | **O(n)** | Checks all positions |

### Built-in Primitives

```rust
// Random Number Generation
let coin = ArcisRNG::bool();
let num = ArcisRNG::gen_integer_from_width(64);
let uniform = ArcisRNG::gen_uniform::<[u8; 32]>();
ArcisRNG::shuffle(&mut arr);
let (val, ok) = ArcisRNG::gen_integer_in_range(1, 100, 24);

// Hashing
let hash = SHA3_256::new().digest(&data).reveal();

// Ed25519 Signatures
let valid = vk.verify(&message, &signature).reveal();
let sig = MXESigningKey::sign(&message).reveal();

// Data Packing (for efficient storage)
let packed: Pack<[u8; 64]> = Pack::new(data);
let data: [u8; 64] = packed.unpack();
```

---

## 5. MXE Setup

### Solana Program Structure

```rust
// programs/my-vault/src/lib.rs
use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

// Unique offset for each encrypted instruction
const COMP_DEF_OFFSET_DEPOSIT: u32 = comp_def_offset("deposit_private");

declare_id!("YOUR_PROGRAM_ID");

#[arcium_program]  // Replaces #[program]
pub mod my_vault {
    use super::*;

    // 1. Initialize computation definition (once per instruction)
    pub fn init_deposit_comp_def(ctx: Context<InitDepositCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    // 2. Queue computation
    pub fn deposit_private(
        ctx: Context<DepositPrivate>,
        computation_offset: u64,
        encrypted_amount: [u8; 32],
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        let args = ArgBuilder::new()
            .x25519_pubkey(pub_key)
            .plaintext_u128(nonce)
            .encrypted_u64(encrypted_amount)
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![DepositCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[]  // Custom callback accounts
            )?],
            1,  // num_txs for callback
            0,  // priority fee (microlamports)
        )?;
        Ok(())
    }

    // 3. Callback (called by MPC cluster)
    #[arcium_callback(encrypted_ix = "deposit_private")]
    pub fn deposit_callback(
        ctx: Context<DepositCallback>,
        output: SignedComputationOutputs<DepositPrivateOutput>,
    ) -> Result<()> {
        let result = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account
        ) {
            Ok(DepositPrivateOutput { field_0 }) => field_0,
            Err(e) => return Err(ErrorCode::AbortedComputation.into()),
        };

        emit!(DepositEvent {
            ciphertext: result.ciphertexts[0],
            nonce: result.nonce.to_le_bytes(),
        });
        Ok(())
    }
}
```

### Account Structures

```rust
// Initialize computation definition accounts
#[init_computation_definition_accounts("deposit_private", payer)]
#[derive(Accounts)]
pub struct InitDepositCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_mxe_lut_pda!(mxe_account.lut_offset_slot))]
    pub address_lookup_table: UncheckedAccount<'info>,
    #[account(address = LUT_PROGRAM_ID)]
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

// Queue computation accounts
#[queue_computation_accounts("deposit_private", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct DepositPrivate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet))]
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_DEPOSIT))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

// Callback accounts
#[callback_accounts("deposit_private")]
#[derive(Accounts)]
pub struct DepositCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_DEPOSIT))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
}
```

### ArgBuilder Methods

```rust
// For Enc<Shared, T> - pass pubkey first, then nonce, then ciphertexts
let args = ArgBuilder::new()
    .x25519_pubkey(pub_key)      // Required for Shared ownership
    .plaintext_u128(nonce)       // Nonce
    .encrypted_u8(ciphertext)    // Type-specific encrypted values
    .encrypted_u16(ct2)
    .encrypted_u32(ct3)
    .encrypted_u64(ct4)
    .encrypted_u128(ct5)
    .encrypted_bool(ct_bool)
    .build();

// For Enc<Mxe, T> - only nonce and ciphertexts (no pubkey)
let args = ArgBuilder::new()
    .plaintext_u128(nonce)
    .encrypted_u64(ciphertext)
    .build();
```

---

## 6. TypeScript Client Integration

### Installation

```bash
# Client library (encryption, transactions)
yarn add @arcium-hq/client

# Reader library (network monitoring)
yarn add @arcium-hq/reader
```

### Complete Integration Example

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { randomBytes } from "crypto";
import {
  RescueCipher,
  getArciumEnv,
  x25519,
  getMXEPublicKey,
  getClusterAccAddress,
  getComputationAccAddress,
  getMXEAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
  awaitComputationFinalization,
} from "@arcium-hq/client";

async function depositPrivate(
  program: Program<YourProgram>,
  provider: anchor.AnchorProvider,
  amount: bigint
) {
  const owner = provider.wallet.publicKey;

  // 1. Get MXE public key for encryption
  const mxePublicKey = await getMXEPublicKey(provider, program.programId);

  // 2. Generate ephemeral keypair for this transaction
  const privateKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(privateKey);

  // 3. Derive shared secret via ECDH
  const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);

  // 4. Initialize cipher with shared secret
  const cipher = new RescueCipher(sharedSecret);

  // 5. Encrypt the amount
  const nonce = randomBytes(16);
  const plaintext = [amount];
  const ciphertext = cipher.encrypt(plaintext, nonce);

  // 6. Queue the computation
  const computationOffset = new anchor.BN(randomBytes(8), "hex");
  const clusterOffset = 456; // devnet v0.7.0 cluster

  const queueTx = await program.methods
    .depositPrivate(
      computationOffset,
      Array.from(ciphertext[0]),
      Array.from(publicKey),
      new anchor.BN(deserializeLE(nonce).toString())
    )
    .accountsPartial({
      computationAccount: getComputationAccAddress(clusterOffset, computationOffset),
      clusterAccount: getClusterAccAddress(clusterOffset),
      mxeAccount: getMXEAccAddress(program.programId),
      mempoolAccount: getMempoolAccAddress(clusterOffset),
      executingPool: getExecutingPoolAccAddress(clusterOffset),
      compDefAccount: getCompDefAccAddress(
        program.programId,
        Buffer.from(getCompDefAccOffset("deposit_private")).readUInt32LE()
      ),
    })
    .rpc({ commitment: "confirmed" });

  console.log("Queue tx:", queueTx);

  // 7. Wait for computation to complete
  const finalizeTx = await awaitComputationFinalization(
    provider,
    computationOffset,
    program.programId,
    "confirmed"
  );

  console.log("Finalize tx:", finalizeTx);

  // 8. Decrypt result (from event or account)
  // const decrypted = cipher.decrypt([resultCiphertext], resultNonce);
}

// Helper to deserialize nonce from bytes
function deserializeLE(bytes: Buffer): bigint {
  let result = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i]);
  }
  return result;
}
```

### Decrypting Results

```typescript
// After receiving callback event or reading from account
const cipher = new RescueCipher(sharedSecret);

// Decrypt single value
const [decryptedValue] = cipher.decrypt([eventData.ciphertext], eventData.nonce);

// Decrypt multiple values
const decrypted = cipher.decrypt(
  [ciphertext1, ciphertext2],
  nonce
);
```

---

## 7. Encryption Flow

### Cryptographic Primitives

1. **Key Exchange**: x25519 Elliptic Curve Diffie-Hellman
2. **Cipher**: Rescue (arithmetization-oriented symmetric cipher)
3. **Mode**: Counter (CTR) mode with m=5
4. **Key Derivation**: Rescue-Prime hash function
5. **Security Level**: 128 bits

### Encryption Process

```
┌────────────────────────────────────────────────────────────┐
│                     CLIENT SIDE                             │
├────────────────────────────────────────────────────────────┤
│  1. Generate ephemeral x25519 keypair                       │
│     privateKey = x25519.utils.randomSecretKey()             │
│     publicKey = x25519.getPublicKey(privateKey)             │
│                                                             │
│  2. Fetch MXE cluster public key                           │
│     mxePublicKey = getMXEPublicKey(provider, programId)    │
│                                                             │
│  3. Derive shared secret                                    │
│     sharedSecret = x25519.getSharedSecret(privateKey, mxe) │
│                                                             │
│  4. Create cipher with key derivation                       │
│     cipher = new RescueCipher(sharedSecret)                │
│     (internally: key = RescuePrimeHash(sharedSecret))      │
│                                                             │
│  5. Encrypt with random nonce                               │
│     nonce = randomBytes(16)                                 │
│     ciphertext = cipher.encrypt([plaintext], nonce)        │
│                                                             │
│  6. Send to chain: [ciphertext, publicKey, nonce]          │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│                     MPC CLUSTER                             │
├────────────────────────────────────────────────────────────┤
│  7. Receive [ciphertext, clientPubKey, nonce]              │
│                                                             │
│  8. Derive same shared secret using cluster private key     │
│     sharedSecret = x25519(clusterPrivKey, clientPubKey)    │
│                                                             │
│  9. In MPC: decrypt to SECRET SHARES (not plaintext!)      │
│     .to_arcis() converts ciphertext → distributed shares   │
│     Each node holds random-looking piece                    │
│                                                             │
│  10. Compute on shares (secret never reconstructed)         │
│      Operations work on shares mathematically               │
│                                                             │
│  11. Re-encrypt result                                      │
│      .from_arcis() converts shares → new ciphertext        │
│      Uses incremented nonce (original + 1)                  │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│                     CLIENT SIDE                             │
├────────────────────────────────────────────────────────────┤
│  12. Receive result ciphertext with new nonce              │
│                                                             │
│  13. Decrypt using same shared secret                       │
│      result = cipher.decrypt([resultCiphertext], newNonce) │
└────────────────────────────────────────────────────────────┘
```

### Key Points

- **Secret shares**: Data is split into random pieces across nodes. No single node sees the actual value.
- **Nonce management**: MXE increments nonce by 1 for output. Use new nonce for next interaction.
- **Performance tip**: Batch multiple values in one struct to reduce `from_arcis()` calls.

---

## 8. Testnet Details

### Network Information

| Property | Value |
|----------|-------|
| Network | Solana Devnet |
| Status | Public Testnet (stress testing) |
| Economic Value | None (test tokens only) |

### Cluster Offsets

| Offset | Version | Recommended |
|--------|---------|-------------|
| 456 | v0.7.0 | ✅ Yes |
| 123 | v0.5.4 | Legacy |

### Program IDs

| Version | Program ID |
|---------|-----------|
| v0.6.3+ | `Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ` |
| v0.5.x | `BpaW2ZmCJnDwizWY8eM34JtVqp2kRgnmQcedSVc9USdP` |

### RPC Endpoints

```bash
# Default (unreliable, may drop transactions)
https://api.devnet.solana.com
wss://api.devnet.solana.com

# Recommended - Use dedicated providers (free tier works):
# - Helius: https://devnet.helius-rpc.com/?api-key=YOUR_KEY
# - QuickNode: Your devnet endpoint
```

### Faucet

```bash
# Get devnet SOL (need ~2-5 SOL for deployment)
solana airdrop 2 YOUR_PUBKEY -u devnet

# Or use web faucet:
# https://faucet.solana.com/
```

### Deployment Process

```bash
# 1. Build project
arcium build

# 2. Deploy to devnet
arcium deploy \
  --cluster-offset 456 \
  --recovery-set-size 4 \
  --keypair-path ~/.config/solana/id.json \
  --rpc-url https://devnet.helius-rpc.com/?api-key=YOUR_KEY

# Options:
# --mempool-size: Tiny|Small|Medium|Large (default: Tiny)
# --skip-deploy: Only init MXE account
# --skip-init: Only deploy program
```

### Initialize Computation Definitions

After deployment, call init for each encrypted instruction:

```typescript
// Only needed once per instruction after deployment
await initDepositCompDef(program, owner);
```

### Testing

```bash
# Local testing (requires Docker)
arcium test

# Devnet testing (requires Arcium.toml cluster config)
arcium test --cluster devnet
```

---

## 9. Example Walkthrough: Sealed-Bid Auction

This example demonstrates patterns directly applicable to a DeFi vault: encrypted state, accumulation over time, and selective revelation.

### Encrypted Instruction (Arcis)

```rust
// encrypted-ixs/src/auction.rs
use arcis::*;

#[encrypted]
mod circuits {
    use arcis::*;

    #[derive(Copy, Clone)]
    pub struct Bid {
        pub amount: u64,
        pub bidder_lo: u128,  // Lower 128 bits of pubkey
        pub bidder_hi: u128,  // Upper 128 bits of pubkey
    }

    #[derive(Copy, Clone)]
    pub struct AuctionState {
        pub highest_bid: u64,
        pub highest_bidder_lo: u128,
        pub highest_bidder_hi: u128,
        pub second_highest_bid: u64,  // For Vickrey auctions
        pub bid_count: u8,
    }

    #[instruction]
    pub fn place_bid(
        bid_ctxt: Enc<Shared, Bid>,           // User's encrypted bid
        state_ctxt: Enc<Mxe, AuctionState>,   // Protocol state (MXE-only)
    ) -> Enc<Mxe, AuctionState> {
        let bid = bid_ctxt.to_arcis();
        let mut state = state_ctxt.to_arcis();

        // Compare bids - happens in MPC, values never exposed
        if bid.amount > state.highest_bid {
            // New highest - shift current to second place
            state.second_highest_bid = state.highest_bid;
            state.highest_bid = bid.amount;
            state.highest_bidder_lo = bid.bidder_lo;
            state.highest_bidder_hi = bid.bidder_hi;
        } else if bid.amount > state.second_highest_bid {
            state.second_highest_bid = bid.amount;
        }

        state.bid_count += 1;
        state_ctxt.owner.from_arcis(state)  // Re-encrypt for MXE
    }

    #[derive(Copy, Clone)]
    pub struct AuctionResult {
        pub winner_lo: u128,
        pub winner_hi: u128,
        pub payment_amount: u64,
    }

    // Vickrey auction: winner pays second-highest bid
    #[instruction]
    pub fn determine_winner(
        state_ctxt: Enc<Mxe, AuctionState>
    ) -> AuctionResult {
        let state = state_ctxt.to_arcis();
        AuctionResult {
            winner_lo: state.highest_bidder_lo,
            winner_hi: state.highest_bidder_hi,
            payment_amount: state.second_highest_bid,  // Vickrey!
        }.reveal()  // Only reveal winner + payment, not all bids
    }
}
```

### Storing Encrypted State On-Chain

```rust
// programs/auction/src/lib.rs
#[account]
pub struct AuctionAccount {
    pub bump: u8,
    pub state: [[u8; 32]; 5],  // 5 encrypted fields × 32 bytes each
    pub nonce: u128,
    pub authority: Pubkey,
    pub end_time: i64,
}
```

### Reading Encrypted Account Data in MPC

```rust
// When passing encrypted account state to MPC
use arcium_anchor::prelude::Argument;

let args = ArgBuilder::new()
    .plaintext_u128(nonce)
    .arg(Argument::Account(
        ctx.accounts.auction_acc.key(),
        8 + 1,  // Skip: discriminator (8) + bump (1)
        160,    // Read: 5 ciphertexts × 32 bytes = 160 bytes
    ))
    .build();
```

### Key Patterns for DeFi Vaults

1. **Encrypted Protocol State**: Store vault balances, positions as `Enc<Mxe, T>`
2. **User Inputs**: Accept deposits/withdrawals as `Enc<Shared, T>`
3. **Accumulation**: Update encrypted state across transactions
4. **Selective Reveal**: Only reveal what's necessary (e.g., net position, not individual trades)

---

## 10. DeFi Vault Integration Patterns

### Pattern 1: Private Deposits

```rust
// Encrypted instruction
#[instruction]
pub fn private_deposit(
    user_deposit: Enc<Shared, u64>,
    vault_state: Enc<Mxe, VaultState>,
) -> Enc<Mxe, VaultState> {
    let amount = user_deposit.to_arcis();
    let mut state = vault_state.to_arcis();
    
    state.total_deposits += amount;
    state.deposit_count += 1;
    
    vault_state.owner.from_arcis(state)
}
```

### Pattern 2: Private LP Positions

```rust
#[derive(Copy, Clone)]
pub struct LPPosition {
    pub shares: u64,
    pub entry_price: u64,
    pub owner_lo: u128,
    pub owner_hi: u128,
}

#[instruction]
pub fn add_liquidity(
    deposit: Enc<Shared, u64>,
    positions: Enc<Mxe, [LPPosition; 100]>,
    position_idx: u8,
) -> Enc<Mxe, [LPPosition; 100]> {
    let amount = deposit.to_arcis();
    let mut pos = positions.to_arcis();
    
    // Update position at index
    // Note: dynamic indexing is O(n) but necessary for privacy
    for i in 0..100u8 {
        if i == position_idx {
            pos[i as usize].shares += amount;
        }
    }
    
    positions.owner.from_arcis(pos)
}
```

### Pattern 3: Private Order Matching

```rust
#[derive(Copy, Clone)]
pub struct Order {
    pub size: u64,
    pub price: u64,
    pub is_bid: bool,
}

#[instruction]
pub fn match_orders(
    new_order: Enc<Shared, Order>,
    order_book: Enc<Mxe, [Order; 50]>,
) -> (Enc<Mxe, [Order; 50]>, u64) {
    let order = new_order.to_arcis();
    let mut book = order_book.to_arcis();
    let mut filled = 0u64;
    
    for i in 0..50 {
        let can_match = book[i].size > 0 
            && book[i].is_bid != order.is_bid
            && if order.is_bid { 
                order.price >= book[i].price 
            } else { 
                order.price <= book[i].price 
            };
        
        if can_match {
            let fill_size = if book[i].size < order.size - filled {
                book[i].size
            } else {
                order.size - filled
            };
            book[i].size -= fill_size;
            filled += fill_size;
        }
    }
    
    (order_book.owner.from_arcis(book), filled.reveal())
}
```

---

## 11. Limitations & Considerations

### Current Restrictions

| Limitation | Details | Workaround |
|------------|---------|------------|
| **No Windows** | Arcium CLI doesn't support Windows | Use WSL2 with Ubuntu |
| **Fixed-size only** | No Vec, String, HashMap | Use `[T; N]` arrays |
| **No enums** | Enum types not supported | Use structs with type flags |
| **No match** | Match expressions not supported | Use if/else chains |
| **No early exit** | No break, continue, return | Restructure loops |
| **No while loops** | Must have fixed iteration count | Use `for i in 0..N` |
| **No recursion** | Functions cannot recurse | Use iterative approach |

### Performance Considerations

| Factor | Impact | Mitigation |
|--------|--------|------------|
| **Comparisons** | Expensive (bit decomposition) | Minimize comparisons, reuse results |
| **Dynamic indexing** | O(n) for each access | Use fixed indices where possible |
| **Both branches execute** | Cost = sum of all branches | Keep branches lightweight |
| **Division/modulo** | Very expensive | Use power-of-2 divisors |
| **Large circuits** | Multi-MB compiled size | Use offchain storage for circuits |

### Testnet Restrictions

- **No economic value** - Test tokens only
- **Network reliability** - Expect occasional failures
- **Computation time** - MPC takes longer than normal transactions
- **Cluster availability** - Depends on active nodes

### Security Considerations

1. **Dishonest majority safe**: Arcium preserves privacy even with n-1 malicious nodes
2. **One honest node**: Need at least one honest ARX node for security guarantees
3. **Client-side encryption**: Critical that encryption happens client-side
4. **Nonce management**: Never reuse nonces; MXE increments for outputs

### Circuit Size and Costs

```rust
// Circuits can be large - use offchain storage
pub fn init_my_comp_def(ctx: Context<InitMyCompDef>) -> Result<()> {
    init_comp_def(
        ctx.accounts,
        Some(CircuitSource::OffChain(OffChainCircuitSource {
            source: "https://your-storage.com/circuit.arcis".to_string(),
            hash: circuit_hash!("my_instruction"),
        })),
        None,
    )?;
    Ok(())
}
```

### What Can't Be Done (Yet)

1. **Complex data structures** - Trees, graphs, linked lists
2. **Unbounded iteration** - Processing variable-length inputs
3. **External calls** - No composability with other programs during MPC
4. **Floating-point precision** - Limited to fixed-point emulation
5. **Large state** - Array sizes limited by circuit compilation

### Recommended Approach for DeFi Vault

1. **Start simple** - Basic deposit/withdraw with encrypted amounts
2. **Batch operations** - Aggregate multiple inputs in one computation
3. **Minimize comparisons** - Use addition/subtraction where possible
4. **Pre-allocate state** - Fixed-size arrays for positions/orders
5. **Selective revelation** - Only reveal aggregate data, not individual positions
6. **Test extensively** - Local testing before devnet deployment

---

## Resources

- **Documentation**: https://docs.arcium.com/developers
- **Examples Repository**: https://github.com/arcium-hq/examples
- **TypeScript SDK Reference**: https://ts.arcium.com/api
- **Discord Community**: https://discord.gg/arcium

---

## Quick Reference Commands

```bash
# Create project
arcium init my-project

# Build
arcium build

# Test locally
arcium test

# Test on devnet
arcium test --cluster devnet

# Deploy
arcium deploy --cluster-offset 456 --recovery-set-size 4 \
  --keypair-path ~/.config/solana/id.json \
  --rpc-url https://devnet.helius-rpc.com/?api-key=KEY

# Check program
solana program show PROGRAM_ID --url devnet
```
