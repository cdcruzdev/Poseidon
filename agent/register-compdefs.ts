/**
 * Register computation definitions on-chain for the Poseidon Privacy MXE program.
 */
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import {
  getMXEAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
  getArciumProgram,
  getArciumProgramId,
  getLookupTableAddress,
} from "@arcium-hq/client";

const PROGRAM_ID = new PublicKey("CqPbSB5EhenJenf6k2jKAZepeS4MoMghkEv6HpRUQFf9");
const DEVNET_URL = "https://api.devnet.solana.com";
const WALLET_PATH = path.join(process.env.USERPROFILE || process.env.HOME || "", ".config", "solana", "id.json");

async function main() {
  const raw = JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(raw));
  
  const connection = new Connection(DEVNET_URL, "confirmed");
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Balance: ${(await connection.getBalance(wallet.publicKey)) / 1e9} SOL`);

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  // Load our program IDL
  const idl = await anchor.Program.fetchIdl(PROGRAM_ID.toBase58(), provider);
  if (!idl) throw new Error("Could not fetch IDL from chain");
  const program = new anchor.Program(idl, provider);
  console.log(`Program: ${program.programId.toBase58()}`);

  // Load arcium program to read MXE account
  const arciumProgramId = getArciumProgramId();
  const arciumProgram = getArciumProgram(provider);
  const mxeAddr = getMXEAccAddress(PROGRAM_ID);
  console.log(`MXE PDA: ${mxeAddr.toBase58()}`);

  // Get LUT offset from MXE account
  const mxeAccount = await (arciumProgram.account as any).mxeAccount.fetch(mxeAddr);
  const lutOffsetSlot = mxeAccount.lutOffsetSlot;
  console.log(`LUT offset slot: ${lutOffsetSlot}`);
  const lutAddr = getLookupTableAddress(PROGRAM_ID, lutOffsetSlot);
  console.log(`LUT: ${lutAddr.toBase58()}`);

  const LUT_PROGRAM_ID = new PublicKey("AddressLookupTab1e1111111111111111111111111");
  const compDefs = ["encrypted_deposit", "encrypted_rebalance", "view_position"];
  
  for (const ixName of compDefs) {
    const offset = Buffer.from(getCompDefAccOffset(ixName)).readUInt32LE();
    const compDefAddr = getCompDefAccAddress(PROGRAM_ID, offset);
    
    const existing = await connection.getAccountInfo(compDefAddr);
    if (existing) {
      console.log(`✅ ${ixName} already registered at ${compDefAddr.toBase58()}`);
      continue;
    }

    const camelCase = ixName.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    const methodName = `init${camelCase.charAt(0).toUpperCase() + camelCase.slice(1)}CompDef`;
    console.log(`Calling ${methodName} for ${ixName} at ${compDefAddr.toBase58()}...`);

    try {
      const sig = await (program.methods as any)[methodName]()
        .accountsPartial({
          payer: wallet.publicKey,
          mxeAccount: mxeAddr,
          compDefAccount: compDefAddr,
          addressLookupTable: lutAddr,
          lutProgram: LUT_PROGRAM_ID,
          arciumProgram: arciumProgramId,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([wallet])
        .rpc({ commitment: "confirmed" });
      
      console.log(`✅ ${ixName} registered: ${sig}`);
    } catch (e: any) {
      console.error(`❌ ${ixName} failed:`, e.message?.slice(0, 500) || e);
      if (e.logs) console.error("Logs:", e.logs.slice(-10).join("\n"));
    }
  }

  // Verify
  console.log("\n--- Verification ---");
  for (const ixName of compDefs) {
    const offset = Buffer.from(getCompDefAccOffset(ixName)).readUInt32LE();
    const addr = getCompDefAccAddress(PROGRAM_ID, offset);
    const info = await connection.getAccountInfo(addr);
    console.log(`${info ? "✅" : "❌"} ${ixName}: ${addr.toBase58()} ${info ? `(${info.data.length} bytes)` : "NOT FOUND"}`);
  }
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
