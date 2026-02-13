import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";

const PROGRAM_ID = new PublicKey("HLsgAVzjjBaBR9QCLqV3vjC9LTnR2xtmtB77j1EJQBsZ");
const FRONTEND = path.resolve(__dirname, "../..");

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

// ── 1. Component Existence ──
function testComponentExistence() {
  console.log("\n🔍 Component Existence Check");
  const files = [
    "src/components/AutoRebalance.tsx",
    "src/components/PositionCard.tsx",
    "src/hooks/useRebalanceProgram.ts",
    "src/contexts/WalletProvider.tsx",
  ];
  for (const f of files) {
    const full = path.join(FRONTEND, f);
    const exists = fs.existsSync(full);
    const size = exists ? fs.statSync(full).size : 0;
    assert(`${f} exists and non-empty`, exists && size > 0, exists ? `${size}B` : "missing");
  }
}

// ── 2. PDA Derivation ──
function testPDA() {
  console.log("\n🔑 PDA Derivation");
  const owner = Keypair.generate().publicKey;
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("rebalance"), owner.toBuffer()],
    PROGRAM_ID
  );
  assert("PDA is valid PublicKey", pda instanceof PublicKey);
  assert("Bump is 0-255", bump >= 0 && bump <= 255);
  // Deterministic check
  const [pda2] = PublicKey.findProgramAddressSync(
    [Buffer.from("rebalance"), owner.toBuffer()],
    PROGRAM_ID
  );
  assert("PDA is deterministic", pda.equals(pda2));
}

// ── 3. Discriminator Computation ──
function testDiscriminators() {
  console.log("\n🔢 Discriminator Computation");

  const enableHash = createHash("sha256").update("global:enable_rebalance").digest();
  const disableHash = createHash("sha256").update("global:disable_rebalance").digest();

  // Values from the hook
  const IX_ENABLE = Buffer.from([94, 247, 51, 161, 142, 177, 235, 11]);
  const IX_DISABLE = Buffer.from([170, 206, 89, 64, 74, 71, 94, 214]);

  assert(
    "enable_rebalance discriminator matches",
    enableHash.subarray(0, 8).equals(IX_ENABLE),
    `expected ${IX_ENABLE.toString("hex")}, got ${enableHash.subarray(0, 8).toString("hex")}`
  );
  assert(
    "disable_rebalance discriminator matches",
    disableHash.subarray(0, 8).equals(IX_DISABLE),
    `expected ${IX_DISABLE.toString("hex")}, got ${disableHash.subarray(0, 8).toString("hex")}`
  );
}

// ── 4. Account Deserialization ──
function testDeserialization() {
  console.log("\n📦 Account Deserialization");

  const buf = Buffer.alloc(61);
  // discriminator (8 bytes) - arbitrary
  buf.writeUInt32LE(0xDEADBEEF, 0);
  buf.writeUInt32LE(0xCAFEBABE, 4);
  // owner pubkey (32 bytes at offset 8)
  const owner = Keypair.generate().publicKey;
  owner.toBuffer().copy(buf, 8);
  // enabled
  buf[40] = 1;
  // max_slippage_bps
  buf.writeUInt16LE(100, 41);
  // min_yield_improvement_bps
  buf.writeUInt16LE(50, 43);
  // created_at
  buf.writeBigInt64LE(BigInt(1700000000), 45);
  // updated_at
  buf.writeBigInt64LE(BigInt(1700001000), 53);

  // Replicate deserializeConfig logic inline
  let offset = 8;
  const dOwner = new PublicKey(buf.subarray(offset, offset + 32));
  offset += 32;
  const enabled = buf[offset] === 1;
  offset += 1;
  const maxSlippageBps = buf.readUInt16LE(offset);
  offset += 2;
  const minYieldImprovementBps = buf.readUInt16LE(offset);
  offset += 2;
  const createdAt = Number(buf.readBigInt64LE(offset));
  offset += 8;
  const updatedAt = Number(buf.readBigInt64LE(offset));

  assert("owner matches", dOwner.equals(owner));
  assert("enabled = true", enabled === true);
  assert("maxSlippageBps = 100", maxSlippageBps === 100);
  assert("minYieldImprovementBps = 50", minYieldImprovementBps === 50);
  assert("createdAt = 1700000000", createdAt === 1700000000);
  assert("updatedAt = 1700001000", updatedAt === 1700001000);
}

// ── 5. Live Devnet PDA Read ──
async function testDevnetPDA() {
  console.log("\n🌐 Live Devnet PDA Read");
  try {
    const keypairPath = "C:/Users/chris/.config/solana/id.json";
    const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")));
    const keypair = Keypair.fromSecretKey(secretKey);
    console.log(`  Wallet: ${keypair.publicKey.toBase58()}`);

    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("rebalance"), keypair.publicKey.toBuffer()],
      PROGRAM_ID
    );
    console.log(`  PDA: ${pda.toBase58()}`);

    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const info = await connection.getAccountInfo(pda);
    assert("PDA account exists on devnet", info !== null && info.data.length >= 61);

    if (info && info.data.length >= 61) {
      const data = Buffer.from(info.data);
      let offset = 8;
      const owner = new PublicKey(data.subarray(offset, offset + 32));
      offset += 32;
      const enabled = data[offset] === 1;
      offset += 1;
      const maxSlippageBps = data.readUInt16LE(offset);
      offset += 2;
      const minYieldImprovementBps = data.readUInt16LE(offset);

      assert("owner matches keypair", owner.equals(keypair.publicKey));
      assert("enabled = true", enabled === true, `got ${enabled}`);
      assert("maxSlippageBps = 100", maxSlippageBps === 100, `got ${maxSlippageBps}`);
      assert("minYieldImprovementBps = 50", minYieldImprovementBps === 50, `got ${minYieldImprovementBps}`);
    }
  } catch (e: any) {
    console.log(`  ⚠️  Devnet test error: ${e.message}`);
    failed++;
  }
}

// ── Run All ──
async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  Poseidon Frontend Integration Tests");
  console.log("═══════════════════════════════════════");

  testComponentExistence();
  testPDA();
  testDiscriminators();
  testDeserialization();
  await testDevnetPDA();

  console.log("\n═══════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════\n");
  process.exit(failed > 0 ? 1 : 0);
}

main();
