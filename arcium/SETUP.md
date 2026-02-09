# Arcium MXE Privacy Layer - Setup Guide

## Prerequisites (Ubuntu 24.04 / WSL2)

### 1. Install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
```

### 2. Install Build Dependencies
```bash
sudo apt-get update && sudo apt-get install -y build-essential pkg-config libssl-dev libudev-dev docker-compose-v2
```

### 3. Install Solana CLI 3.1.6+
```bash
# Need 3.1.x for SBF platform-tools that support edition2024 crates
sh -c "$(curl -sSfL https://release.anza.xyz/v3.1.6/install)"
export PATH="/root/.local/share/solana/install/active_release/bin:$PATH"
```

### 4. Install Anchor 0.32.1 via AVM
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --force
avm install 0.32.1
avm use 0.32.1
```

### 5. Install Arcium CLI 0.8.0
```bash
curl --proto '=https' --tlsv1.2 -sSfL https://install.arcium.com/ | bash
```

### 6. Verify
```bash
solana --version  # 3.1.6+
anchor --version  # 0.32.1
arcium --version  # 0.8.0
rustc --version   # 1.89.0+ (via rust-toolchain.toml)
```

## Building

```bash
cd arcium/mxe-program
arcium build
```

This builds:
1. **Encrypted instructions** (Arcis circuits): `encrypted_deposit`, `encrypted_rebalance`, `view_position`
2. **Anchor program** (Solana BPF): `poseidon_privacy.so`

Artifacts in `target/deploy/` and `build/`.

## Program ID

`CqPbSB5EhenJenf6k2jKAZepeS4MoMghkEv6HpRUQFf9`

## Deploying to Devnet

```bash
# Generate keypair
solana-keygen new --no-bip39-passphrase

# Fund with ~5 SOL (faucet.solana.com or `solana airdrop 5 -u devnet`)

# Deploy
arcium deploy \
  --cluster-offset 456 \
  --recovery-set-size 4 \
  --keypair-path ~/.config/solana/id.json \
  --rpc-url https://api.devnet.solana.com
```

**Note:** Devnet faucet has rate limits. If airdrop fails, use https://faucet.solana.com or try again later.

## Architecture

### Encrypted Instructions (Arcis)
- `encrypted_deposit` — Validates deposit params in MPC, returns encrypted position
- `encrypted_rebalance` — Computes optimal rebalance from encrypted state
- `view_position` — Re-encrypts position data for the owner

### On-chain Program (Anchor)
- `init_*_comp_def` — One-time init of each computation definition
- `encrypted_deposit` / `encrypted_rebalance` / `view_position` — Queue MPC computations
- `*_callback` — Receive MPC results, emit encrypted events

### Client (TypeScript)
- `@arcium-hq/client` for encryption/decryption with x25519 + RescueCipher
- Key exchange with MXE cluster via shared secret
- Encrypt plaintext → ciphertext before sending to program
- Decrypt callback events using session key

## Key Versions
| Tool | Version | Notes |
|------|---------|-------|
| Solana CLI | 3.1.6 | Need 3.x for edition2024 SBF support |
| Anchor | 0.32.1 | Required by Arcium 0.8 |
| Arcium CLI | 0.8.0 | Uses cluster offset 456 on devnet |
| Rust | 1.89.0 | Via rust-toolchain.toml |
| arcium-anchor | 0.8.0 | On-chain Arcium integration |
| arcis-imports | 0.8.0 | Encrypted instruction framework |
