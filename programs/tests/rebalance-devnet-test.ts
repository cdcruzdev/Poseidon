import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { createHash } from "crypto";
import * as fs from "fs";

const PROGRAM_ID = new PublicKey("2ro3VBKvqtc86DJVMnZETHMGAtjYFipZwdMFgtZGWscx");
const RPC = "https://api.devnet.solana.com";
const KEYPAIR_PATH = "C:/Users/chris/.config/solana/id.json";

function loadKeypair(): Keypair {
  const secret = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function disc(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function getPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("rebalance"), owner.toBuffer()],
    PROGRAM_ID
  );
}

function enableIx(pda: PublicKey, owner: PublicKey, maxSlippage: number, minYield: number): TransactionInstruction {
  const data = Buffer.alloc(12);
  disc("enable_rebalance").copy(data, 0);
  data.writeUInt16LE(maxSlippage, 8);
  data.writeUInt16LE(minYield, 10);
  return new TransactionInstruction({
    keys: [
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

function disableIx(pda: PublicKey, owner: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data: disc("disable_rebalance"),
  });
}

function isEnabledIx(pda: PublicKey, owner: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: pda, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: disc("is_enabled"),
  });
}

async function sendTx(conn: Connection, kp: Keypair, ix: TransactionInstruction): Promise<string> {
  const bh = await conn.getLatestBlockhash();
  const msg = new TransactionMessage({
    payerKey: kp.publicKey,
    recentBlockhash: bh.blockhash,
    instructions: [ix],
  }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  tx.sign([kp]);
  const sig = await conn.sendTransaction(tx);
  await conn.confirmTransaction({ signature: sig, ...bh }, "confirmed");
  return sig;
}

interface RebalanceConfig {
  owner: PublicKey;
  enabled: boolean;
  maxSlippageBps: number;
  minYieldImprovementBps: number;
  createdAt: bigint;
  updatedAt: bigint;
}

function deserialize(data: Buffer): RebalanceConfig {
  let off = 8; // skip discriminator
  const owner = new PublicKey(data.subarray(off, off + 32)); off += 32;
  const enabled = data[off] === 1; off += 1;
  const maxSlippageBps = data.readUInt16LE(off); off += 2;
  const minYieldImprovementBps = data.readUInt16LE(off); off += 2;
  const createdAt = data.readBigUInt64LE(off); off += 8;
  const updatedAt = data.readBigUInt64LE(off);
  return { owner, enabled, maxSlippageBps, minYieldImprovementBps, createdAt, updatedAt };
}

let passed = 0, failed = 0;
function ok(name: string, detail?: string) { passed++; console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`); }
function fail(name: string, detail?: string) { failed++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); }

async function main() {
  const conn = new Connection(RPC, "confirmed");
  const kp = loadKeypair();
  const [pda, bump] = getPDA(kp.publicKey);
  console.log(`Owner:  ${kp.publicKey}`);
  console.log(`PDA:    ${pda} (bump ${bump})\n`);

  // 1. Airdrop
  console.log("1. Airdrop SOL");
  try {
    const bal = await conn.getBalance(kp.publicKey);
    if (bal < LAMPORTS_PER_SOL) {
      const sig = await conn.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
      await conn.confirmTransaction(sig, "confirmed");
      ok("Airdrop", `+2 SOL, sig: ${sig}`);
    } else {
      ok("Airdrop", `skipped, balance: ${bal / LAMPORTS_PER_SOL} SOL`);
    }
  } catch (e: any) { fail("Airdrop", e.message); }

  // 2. Enable Rebalance (100, 50)
  console.log("\n2. Enable Rebalance (100, 50)");
  try {
    const sig = await sendTx(conn, kp, enableIx(pda, kp.publicKey, 100, 50));
    ok("Enable", `sig: ${sig}`);
  } catch (e: any) { fail("Enable", e.message); }

  // 3. Read Config
  console.log("\n3. Read Config");
  try {
    const acct = await conn.getAccountInfo(pda);
    if (!acct) throw new Error("PDA not found");
    const cfg = deserialize(acct.data as Buffer);
    console.log("  Data:", { ...cfg, owner: cfg.owner.toBase58(), createdAt: cfg.createdAt.toString(), updatedAt: cfg.updatedAt.toString() });
    cfg.enabled ? ok("enabled=true") : fail("enabled!=true");
    cfg.maxSlippageBps === 100 ? ok("maxSlippageBps=100") : fail(`maxSlippageBps=${cfg.maxSlippageBps}`);
    cfg.minYieldImprovementBps === 50 ? ok("minYieldImprovementBps=50") : fail(`minYieldImprovementBps=${cfg.minYieldImprovementBps}`);
    cfg.owner.equals(kp.publicKey) ? ok("owner matches") : fail("owner mismatch");
  } catch (e: any) { fail("Read Config", e.message); }

  // 4. Update Config (200, 75)
  console.log("\n4. Update Config (200, 75)");
  try {
    const sig = await sendTx(conn, kp, enableIx(pda, kp.publicKey, 200, 75));
    const acct = await conn.getAccountInfo(pda);
    const cfg = deserialize(acct!.data as Buffer);
    cfg.maxSlippageBps === 200 && cfg.minYieldImprovementBps === 75
      ? ok("Update", `sig: ${sig}`)
      : fail("Update", `got ${cfg.maxSlippageBps}/${cfg.minYieldImprovementBps}`);
  } catch (e: any) { fail("Update", e.message); }

  // 5. Disable Rebalance
  console.log("\n5. Disable Rebalance");
  try {
    const sig = await sendTx(conn, kp, disableIx(pda, kp.publicKey));
    ok("Disable", `sig: ${sig}`);
  } catch (e: any) { fail("Disable", e.message); }

  // 6. Verify Closed
  console.log("\n6. Verify Closed");
  try {
    const acct = await conn.getAccountInfo(pda);
    acct === null ? ok("PDA closed") : fail("PDA still exists");
  } catch (e: any) { fail("Verify Closed", e.message); }

  // 7. Re-enable (100, 50)
  console.log("\n7. Re-enable (100, 50)");
  try {
    const sig = await sendTx(conn, kp, enableIx(pda, kp.publicKey, 100, 50));
    ok("Re-enable", `sig: ${sig}`);
  } catch (e: any) { fail("Re-enable", e.message); }

  console.log(`\n${"=".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
