# Arcium Privacy Layer for Poseidon LP Vault

## Overview

This module provides privacy for LP positions using cryptographic primitives from the **Arcium SDK** (`@arcium-hq/client`). User position data (amounts, price ranges, pool addresses) is encrypted client-side using x25519 key exchange and Arcium's RescueCipher — the same cryptographic stack used by Arcium's on-chain MPC network.

## Architecture

### Current Implementation: Client-Side Encryption with Arcium Crypto

```
User Wallet (ed25519 keypair)
        │
        ▼
x25519 Key Derivation ──── Arcium SDK (@arcium-hq/client)
        │
        ▼
Position Data ──► RescueCipher.encrypt() ──► Encrypted Blob (on-chain or off-chain)
        │
        ▼
Only wallet owner can decrypt via shared secret
```

**What's real:**
- x25519 key exchange using `@arcium-hq/client`
- RescueCipher encryption (Arcium's native cipher, used in their MPC protocol)
- Position data is genuinely encrypted — not base64, not reversible without the key
- Only the position owner's wallet can decrypt

**What's planned (requires Arcium MXE deployment):**
- Full MPC-based encryption where data is split across Arcium nodes
- On-chain confidential state via Arcium's computation network
- Requires deploying a Rust MXE program using `arcium init` (Linux/Mac only currently)

### Upgrade Path to Full Arcium MPC

1. **Current**: Client-side encryption using Arcium's crypto primitives
2. **Next**: Deploy MXE program on Arcium testnet for server-side encrypted computation
3. **Future**: Mainnet deployment with full MPC — positions computed on encrypted data

The interface (`IPrivacyProvider`) is designed so swapping from client-side to full MPC requires zero changes to the agent code.

## Usage

```typescript
import { ArciumPrivacyProvider } from './src/arcium-provider';

const provider = new ArciumPrivacyProvider();
await provider.initialize();

// Encrypt a position
const encrypted = await provider.encryptPosition(position);

// Decrypt (only owner can)
const decrypted = await provider.decryptPosition(encrypted, ownerSecretKey);
```

## Files

- `src/arcium-provider.ts` — Full `IPrivacyProvider` implementation using Arcium SDK
- `src/crypto.ts` — Low-level encryption/decryption using x25519 + RescueCipher
- `src/index.ts` — Exports
- `tests/privacy.test.ts` — Test suite
- `RESEARCH.md` — Arcium research notes and feasibility analysis

## Dependencies

- `@arcium-hq/client` — Arcium TypeScript SDK (x25519, RescueCipher, field arithmetic)
- `@solana/web3.js` — Solana keypair handling
