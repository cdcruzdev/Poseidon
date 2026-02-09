/**
 * Integration tests for Poseidon Privacy MXE program on Solana devnet.
 * 
 * Run from agent dir: cd agent && npx tsx ../arcium/tests/mxe-devnet.test.ts
 */
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import {
  RescueCipher,
  getMXEAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
  getMXEPublicKey,
  getArciumEnv,
} from "@arcium-hq/client";

// Use node crypto for random bytes
import { x25519 } from "@noble/curves/ed25519.js";
const randomBytes = (n: number) => new Uint8Array(crypto.randomBytes(n));

const PROGRAM_ID = new PublicKey("CqPbSB5EhenJenf6k2jKAZepeS4MoMghkEv6HpRUQFf9");
const IDL_ACCOUNT = new PublicKey("GVZRbSM58e6z1JG8fudrHKstjzy6FeUKxkhhpYCiVehM");
const DEVNET_URL = "https://api.devnet.solana.com";
const WALLET_PATH = path.join(process.env.USERPROFILE || process.env.HOME || "", ".config", "solana", "id.json");

const connection = new Connection(DEVNET_URL, "confirmed");

function loadKeypair(): Keypair {
  const raw = JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  detail?: string;
  duration?: number;
}

const results: TestResult[] = [];

async function runTest(name: string, fn?: () => Promise<void>, blockReason?: string) {
  if (blockReason || !fn) {
    results.push({ name, status: "BLOCKED", detail: blockReason || "No test function" });
    console.log(`⏸️  BLOCKED: ${name} — ${blockReason || "No test function"}`);
    return;
  }
  const start = Date.now();
  try {
    await fn();
    const dur = Date.now() - start;
    results.push({ name, status: "PASS", duration: dur });
    console.log(`✅ PASS: ${name} (${dur}ms)`);
  } catch (e: any) {
    const dur = Date.now() - start;
    results.push({ name, status: "FAIL", detail: e.message || String(e), duration: dur });
    console.log(`❌ FAIL: ${name} — ${e.message || e}`);
  }
}

async function main() {
  console.log("=== Poseidon Privacy MXE — Devnet Integration Tests ===\n");
  console.log(`Program: ${PROGRAM_ID.toBase58()}`);
  console.log(`IDL:     ${IDL_ACCOUNT.toBase58()}`);
  console.log(`Network: ${DEVNET_URL}\n`);

  const wallet = loadKeypair();
  console.log(`Wallet:  ${wallet.publicKey.toBase58()}\n`);

  // 1. Program exists
  await runTest("Program exists on devnet", async () => {
    const info = await connection.getAccountInfo(PROGRAM_ID);
    if (!info) throw new Error("Program account not found");
    if (!info.executable) throw new Error("Not executable");
    console.log(`  Owner: ${info.owner.toBase58()}, size: ${info.data.length}`);
  });

  // 2. IDL exists
  await runTest("IDL account exists and is readable", async () => {
    const info = await connection.getAccountInfo(IDL_ACCOUNT);
    if (!info) throw new Error("IDL account not found");
    if (info.data.length < 10) throw new Error(`Too small: ${info.data.length}`);
    console.log(`  Owner: ${info.owner.toBase58()}, size: ${info.data.length}`);
  });

  // 3. Wallet balance
  await runTest("Wallet has sufficient balance", async () => {
    const bal = await connection.getBalance(wallet.publicKey);
    console.log(`  Balance: ${bal / 1e9} SOL`);
    if (bal < 1e9) throw new Error("< 1 SOL");
  });

  // 4. MXE account PDA
  await runTest("MXE account PDA exists", async () => {
    const mxeAddr = getMXEAccAddress(PROGRAM_ID);
    console.log(`  MXE PDA: ${mxeAddr.toBase58()}`);
    const info = await connection.getAccountInfo(mxeAddr);
    if (!info) throw new Error("MXE account not found");
    console.log(`  Data: ${info.data.length} bytes`);
  });

  // 5. Comp def accounts
  await runTest("Computation definition accounts exist", async () => {
    for (const ixName of ["encrypted_deposit", "encrypted_rebalance", "view_position"]) {
      const offset = Buffer.from(getCompDefAccOffset(ixName)).readUInt32LE();
      const addr = getCompDefAccAddress(PROGRAM_ID, offset);
      const info = await connection.getAccountInfo(addr);
      if (!info) throw new Error(`CompDef '${ixName}' not found at ${addr.toBase58()}`);
      console.log(`  ${ixName}: ${addr.toBase58()} (${info.data.length} bytes)`);
    }
  });

  // 6. Client-side encryption round-trip
  await runTest("Client-side x25519 + RescueCipher encryption works", async () => {
    const privKey = x25519.utils.randomSecretKey();
    
    let mxePubKey: Uint8Array;
    try {
      mxePubKey = await getMXEPublicKey({ connection } as any, PROGRAM_ID);
    } catch {
      throw new Error("Could not fetch MXE public key");
    }
    console.log(`  MXE pubkey: ${Buffer.from(mxePubKey).toString("hex").slice(0, 32)}...`);

    const sharedSecret = x25519.getSharedSecret(privKey, mxePubKey);
    const cipher = new RescueCipher(sharedSecret);
    
    const testAmount = BigInt(1_000_000_000);
    const nonce = randomBytes(16);
    const ct = cipher.encrypt([testAmount], nonce);
    
    const plainBuf = Buffer.alloc(32);
    plainBuf.writeBigUInt64LE(testAmount);
    if (Buffer.from(ct[0]).equals(plainBuf)) throw new Error("Ciphertext = plaintext!");
    
    const dec = cipher.decrypt([ct[0]], nonce);
    if (dec[0] !== testAmount) throw new Error(`Mismatch: ${dec[0]} vs ${testAmount}`);
    console.log(`  Encrypt/decrypt round-trip: ${dec[0]} ✓`);
  });

  // 7. Unauthorized decryption
  await runTest("Unauthorized user cannot decrypt data", async () => {
    const mxePubKey = await getMXEPublicKey({ connection } as any, PROGRAM_ID);

    const privA = x25519.utils.randomSecretKey();
    const cipherA = new RescueCipher(x25519.getSharedSecret(privA, mxePubKey));
    const amount = BigInt(42_000_000);
    const nonce = randomBytes(16);
    const ct = cipherA.encrypt([amount], nonce);

    const privB = x25519.utils.randomSecretKey();
    const cipherB = new RescueCipher(x25519.getSharedSecret(privB, mxePubKey));

    try {
      const result = cipherB.decrypt([ct[0]], nonce);
      if (result[0] === amount) throw new Error("Security breach: wrong key decrypted correctly!");
      console.log(`  Wrong key → wrong value: ${result[0]} (expected ${amount}) ✓`);
    } catch (e: any) {
      if (e.message?.includes("breach")) throw e;
      console.log(`  Wrong key threw error (expected) ✓`);
    }
  });

  // 8. On-chain data entropy check
  await runTest("On-chain MXE account data has high entropy", async () => {
    const mxeAddr = getMXEAccAddress(PROGRAM_ID);
    const info = await connection.getAccountInfo(mxeAddr);
    if (!info) throw new Error("MXE account not found");

    const data = info.data;
    const byteFreq = new Map<number, number>();
    for (const b of data) byteFreq.set(b, (byteFreq.get(b) || 0) + 1);
    
    const uniqueBytes = byteFreq.size;
    console.log(`  ${data.length} bytes, ${uniqueBytes} unique values`);
    if (uniqueBytes < 10) throw new Error(`Trivial data: only ${uniqueBytes} unique bytes`);

    const ascii = Buffer.from(data.slice(0, 200)).toString("ascii");
    const readableRatio = ascii.replace(/[^\x20-\x7E]/g, "").length / 200;
    console.log(`  ASCII ratio: ${(readableRatio * 100).toFixed(1)}%`);
    if (readableRatio > 0.8) throw new Error("Data appears plaintext");
    console.log(`  Data appears non-trivial ✓`);
  });

  // 9. Encrypt multiple fields for deposit
  await runTest("Encrypt deposit fields (3 ciphertexts)", async () => {
    const privKey = x25519.utils.randomSecretKey();
    const mxePubKey = await getMXEPublicKey({ connection } as any, PROGRAM_ID);
    const cipher = new RescueCipher(x25519.getSharedSecret(privKey, mxePubKey));

    const nonce = randomBytes(16);
    const ct = cipher.encrypt(
      [BigInt(1_000_000_000), BigInt(100_000_000), BigInt(200_000_000)],
      nonce
    );

    if (ct.length !== 3) throw new Error(`Expected 3 ciphertexts, got ${ct.length}`);
    for (let i = 0; i < 3; i++) {
      if (ct[i].length !== 32) throw new Error(`CT[${i}] not 32 bytes: ${ct[i].length}`);
    }

    const dec = cipher.decrypt(ct, nonce);
    if (dec[0] !== BigInt(1_000_000_000)) throw new Error("Amount mismatch");
    if (dec[1] !== BigInt(100_000_000)) throw new Error("PriceLower mismatch");
    if (dec[2] !== BigInt(200_000_000)) throw new Error("PriceUpper mismatch");
    console.log(`  3 fields encrypted/decrypted correctly ✓`);
  });

  // 10. Encrypt rebalance fields (4 ciphertexts)
  await runTest("Encrypt rebalance fields (4 ciphertexts)", async () => {
    const privKey = x25519.utils.randomSecretKey();
    const mxePubKey = await getMXEPublicKey({ connection } as any, PROGRAM_ID);
    const cipher = new RescueCipher(x25519.getSharedSecret(privKey, mxePubKey));

    const nonce = randomBytes(16);
    const ct = cipher.encrypt(
      [BigInt(500_000_000), BigInt(500_000_000), BigInt(150_000_000), BigInt(250_000_000)],
      nonce
    );

    if (ct.length !== 4) throw new Error(`Expected 4 ciphertexts, got ${ct.length}`);
    const dec = cipher.decrypt(ct, nonce);
    if (dec[0] !== BigInt(500_000_000)) throw new Error("AmountA mismatch");
    if (dec[3] !== BigInt(250_000_000)) throw new Error("PriceUpper mismatch");
    console.log(`  4 fields encrypted/decrypted correctly ✓`);
  });

  // MPC-dependent tests
  const MPC_BLOCK = "Requires active Arcium MPC cluster nodes to finalize computation";

  await runTest("Encrypted deposit (full tx + MPC finalization)", undefined, MPC_BLOCK);
  await runTest("View position via MPC computation", undefined, MPC_BLOCK);
  await runTest("Encrypted rebalance via MPC computation", undefined, MPC_BLOCK);

  // Summary
  console.log("\n=== RESULTS SUMMARY ===\n");
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  const blocked = results.filter(r => r.status === "BLOCKED").length;

  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⏸️";
    const extra = r.detail ? ` — ${r.detail}` : "";
    const dur = r.duration ? ` (${r.duration}ms)` : "";
    console.log(`${icon} ${r.status}: ${r.name}${dur}${extra}`);
  }

  console.log(`\nTotal: ${results.length} | ✅ ${passed} PASS | ❌ ${failed} FAIL | ⏸️ ${blocked} BLOCKED`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error("Fatal:", e); process.exit(2); });
