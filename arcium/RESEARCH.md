# Arcium Research Notes

## What is Arcium?

Arcium is a decentralized encrypted computation network built on Solana. It uses Multi-Party Computation (MPC) to process encrypted data without ever decrypting it.

**Key concepts:**
- **MXE (MPC eXecution Environment)**: A Solana program that defines encrypted computations
- **Arcis**: Rust framework for writing MXE programs (extends Anchor)
- **RescueCipher**: Arcium's native symmetric cipher for encrypting data sent to MPC nodes
- **x25519**: Key exchange protocol for establishing shared secrets between client and MXE

## SDK Availability (as of Feb 2026)

### TypeScript Packages
- `@arcium-hq/client` v0.8.0 — Client SDK for interacting with encrypted Solana programs
  - Exports: x25519, RescueCipher, Aes256Cipher, field arithmetic, PDA helpers
  - Dependencies: @coral-xyz/anchor, @noble/curves, @noble/hashes, @solana/web3.js
- `@arcium-hq/reader` — Read-only SDK for fetching Arcium network state

### CLI / Tooling
- `arcium` CLI — Wrapper over Anchor CLI for building MXE programs
- **Linux/Mac only** — No Windows support (WSL2 recommended)
- Requires: Rust, Solana CLI 2.3.0, Anchor 0.32.1, Docker, Yarn

### Network Status
- **Public Testnet**: Live since May 2025
- **Mainnet Alpha**: Launched ~Feb 2026

## Feasibility Assessment for Hackathon

### Full MXE Integration (Option A) — NOT FEASIBLE
- Requires writing a Rust MXE program with `arcium init`
- Requires Linux toolchain (arcium CLI doesn't support Windows)
- Would need to deploy to Arcium testnet and configure cluster
- Estimated time: 2-3 days for someone familiar with the stack

### Arcium Client-Side Crypto (Option B) — ✅ IMPLEMENTED
- Use `@arcium-hq/client`'s crypto primitives (x25519, RescueCipher)
- Same encryption used in actual Arcium MPC protocol
- Real cryptographic security, not a mock
- Works on any platform (pure JS/TS)
- Upgrade path to full MPC is clear and documented

### Why This Approach is Honest
1. We use the actual Arcium SDK package
2. We use the same cryptographic primitives Arcium uses internally
3. The encryption is real — not base64 encoding or reversible without the key
4. The interface is designed for drop-in replacement with full MPC
5. We clearly document what's implemented vs. what's planned

## How Arcium MPC Would Work (Full Integration)

```
1. Client encrypts position data using x25519 shared secret with MXE
2. Client sends encrypted data to Solana program (MXE)
3. MXE queues computation on Arcium's MPC node cluster
4. MPC nodes process encrypted data (e.g., aggregate positions, calculate yields)
5. Result is encrypted and returned via callback
6. Client decrypts result using their private key
```

For Poseidon, this would enable:
- **Private deposits**: Hide deposit amounts from other users
- **Confidential rebalancing**: Rebalance positions without revealing strategy
- **Encrypted yield calculation**: Compute yields on encrypted position data
- **Anonymous LP**: Others can verify a position exists but can't see details
