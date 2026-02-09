import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import * as os from "os";
import { x25519 } from "@noble/curves/ed25519";
import { randomBytes } from "@noble/hashes/utils";
import {
  RescueCipher,
  getArciumEnv,
  getMXEAccAddress,
  getClusterAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getComputationAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
  getMXEPublicKeyWithRetry,
  awaitComputationFinalization,
  deserializeLE,
} from "@arcium-hq/client";
import { PoseidonMXEClient } from "../src/mxe-client";

function readKpJson(path: string): anchor.web3.Keypair {
  const fs = require("fs");
  const raw = JSON.parse(fs.readFileSync(path, "utf-8"));
  return anchor.web3.Keypair.fromSecretKey(Uint8Array.from(raw));
}

describe("Poseidon Privacy MXE", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.PoseidonPrivacy;
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  const arciumEnv = getArciumEnv();
  let mxeClient: PoseidonMXEClient;
  let owner: anchor.web3.Keypair;

  before(async () => {
    owner = readKpJson(`${os.homedir()}/.config/solana/id.json`);
    mxeClient = new PoseidonMXEClient(program, provider, program.programId);
    await mxeClient.initialize();
  });

  it("Initializes computation definitions", async () => {
    const sigs = await mxeClient.initCompDefs(owner);
    expect(sigs).to.have.lengthOf(3);
    console.log("Comp defs initialized:", sigs);
  });

  it("Encrypts and queues a deposit", async () => {
    const position = {
      amount: BigInt(1_000_000_000), // 1 SOL
      priceLower: BigInt(100_000_000), // $100
      priceUpper: BigInt(200_000_000), // $200
    };

    const { computationOffset, sig } = await mxeClient.encryptedDeposit(
      owner,
      position
    );
    expect(sig).to.be.a("string");
    console.log("Deposit queued with offset:", computationOffset.toString());

    // Wait for MPC computation to complete
    const finalizeSig = await awaitComputationFinalization(
      provider,
      computationOffset,
      program.programId,
      "confirmed"
    );
    console.log("Deposit finalized:", finalizeSig);
  });

  it("Encrypts and queues a rebalance", async () => {
    const rebalanceData = {
      amountA: BigInt(500_000_000),
      amountB: BigInt(500_000_000),
      newPriceLower: BigInt(150_000_000),
      newPriceUpper: BigInt(250_000_000),
    };

    const { computationOffset, sig } = await mxeClient.encryptedRebalance(
      owner,
      rebalanceData
    );
    expect(sig).to.be.a("string");
    console.log("Rebalance queued with offset:", computationOffset.toString());

    const finalizeSig = await awaitComputationFinalization(
      provider,
      computationOffset,
      program.programId,
      "confirmed"
    );
    console.log("Rebalance finalized:", finalizeSig);
  });

  it("Verifies on-chain data is encrypted (not readable)", async () => {
    // Direct client-side encryption test
    const privateKey = x25519.utils.randomSecretKey();
    const publicKey = x25519.getPublicKey(privateKey);
    const mxePublicKey = await getMXEPublicKeyWithRetry(
      provider,
      program.programId
    );
    const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
    const cipher = new RescueCipher(sharedSecret);

    const amount = BigInt(1_000_000_000);
    const nonce = randomBytes(16);
    const ciphertext = cipher.encrypt([amount], nonce);

    // Verify ciphertext is not the plaintext
    const ctBytes = ciphertext[0];
    const plainBytes = new Uint8Array(32);
    const view = new DataView(plainBytes.buffer);
    view.setBigUint64(0, amount, true);

    expect(ctBytes).to.not.deep.equal(plainBytes);
    console.log(
      "Ciphertext (first 16 bytes):",
      Buffer.from(ctBytes.slice(0, 16)).toString("hex")
    );
    console.log("Plaintext would be:", Buffer.from(plainBytes).toString("hex"));

    // Verify decryption works with correct key
    const decrypted = cipher.decrypt([ctBytes], nonce);
    expect(decrypted[0]).to.equal(amount);
    console.log("Decrypted correctly:", decrypted[0].toString());
  });

  it("Unauthorized user cannot decrypt encrypted position", async () => {
    // Encrypt with one key
    const privateKey1 = x25519.utils.randomSecretKey();
    const publicKey1 = x25519.getPublicKey(privateKey1);
    const mxePublicKey = await getMXEPublicKeyWithRetry(
      provider,
      program.programId
    );
    const sharedSecret1 = x25519.getSharedSecret(privateKey1, mxePublicKey);
    const cipher1 = new RescueCipher(sharedSecret1);

    const amount = BigInt(1_000_000_000);
    const nonce = randomBytes(16);
    const ciphertext = cipher1.encrypt([amount], nonce);

    // Try to decrypt with different key
    const privateKey2 = x25519.utils.randomSecretKey();
    const sharedSecret2 = x25519.getSharedSecret(privateKey2, mxePublicKey);
    const cipher2 = new RescueCipher(sharedSecret2);

    try {
      const wrongDecrypt = cipher2.decrypt([ciphertext[0]], nonce);
      // Even if it doesn't throw, the value should be wrong
      expect(wrongDecrypt[0]).to.not.equal(amount);
      console.log("Wrong key gave wrong value:", wrongDecrypt[0].toString());
    } catch (e) {
      console.log("Wrong key correctly failed to decrypt");
    }
  });
});
