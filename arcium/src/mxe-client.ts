/**
 * Poseidon Privacy MXE Client
 *
 * TypeScript client for interacting with the deployed Arcium MXE program.
 * Handles encryption, computation queueing, and decryption of LP position data.
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
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

// ============================================================
// Types
// ============================================================

export interface EncryptedPositionData {
  ciphertexts: Uint8Array[];
  nonce: Uint8Array;
  publicKey: Uint8Array;
}

export interface PositionData {
  amount: bigint;
  priceLower: bigint;
  priceUpper: bigint;
}

export interface RebalanceData {
  amountA: bigint;
  amountB: bigint;
  newPriceLower: bigint;
  newPriceUpper: bigint;
}

export interface RebalanceResult {
  newAmountA: bigint;
  newAmountB: bigint;
  newPriceLower: bigint;
  newPriceUpper: bigint;
}

// ============================================================
// MXE Client
// ============================================================

export class PoseidonMXEClient {
  private program: Program;
  private provider: anchor.AnchorProvider;
  private privateKey: Uint8Array;
  private publicKey: Uint8Array;
  private sharedSecret: Uint8Array | null = null;
  private cipher: any | null = null;
  private arciumEnv: any;
  private programId: PublicKey;

  constructor(
    program: Program,
    provider: anchor.AnchorProvider,
    programId: PublicKey
  ) {
    this.program = program;
    this.provider = provider;
    this.programId = programId;
    this.arciumEnv = getArciumEnv();

    // Generate x25519 keypair for this session
    this.privateKey = x25519.utils.randomSecretKey();
    this.publicKey = x25519.getPublicKey(this.privateKey);
  }

  /**
   * Initialize the client by establishing shared secret with MXE cluster.
   */
  async initialize(): Promise<void> {
    const mxePublicKey = await getMXEPublicKeyWithRetry(
      this.provider,
      this.programId
    );
    this.sharedSecret = x25519.getSharedSecret(this.privateKey, mxePublicKey);
    this.cipher = new RescueCipher(this.sharedSecret);
    console.log("[MXE Client] Initialized with MXE shared secret");
  }

  /**
   * Initialize computation definitions (call once after deployment).
   */
  async initCompDefs(payer: Keypair): Promise<string[]> {
    const sigs: string[] = [];

    for (const ixName of [
      "initEncryptedDepositCompDef",
      "initEncryptedRebalanceCompDef",
      "initViewPositionCompDef",
    ]) {
      const sig = await (this.program.methods as any)
        [ixName]()
        .accountsPartial({
          payer: payer.publicKey,
          mxeAccount: getMXEAccAddress(this.programId),
        })
        .signers([payer])
        .rpc({ commitment: "confirmed" });
      sigs.push(sig);
      console.log(`[MXE Client] ${ixName} initialized: ${sig}`);
    }

    return sigs;
  }

  /**
   * Encrypt and queue a deposit computation.
   */
  async encryptedDeposit(
    payer: Keypair,
    position: PositionData
  ): Promise<{ computationOffset: anchor.BN; sig: string }> {
    this.ensureInitialized();

    const nonce = randomBytes(16);
    const plaintext = [position.amount, position.priceLower, position.priceUpper];
    const ciphertext = this.cipher!.encrypt(plaintext, nonce);

    const computationOffset = new anchor.BN(randomBytes(8), "hex");

    const sig = await this.program.methods
      .encryptedDeposit(
        computationOffset,
        Array.from(ciphertext[0]),
        Array.from(ciphertext[1]),
        Array.from(ciphertext[2]),
        Array.from(this.publicKey),
        new anchor.BN(deserializeLE(nonce).toString())
      )
      .accountsPartial({
        payer: payer.publicKey,
        computationAccount: getComputationAccAddress(
          this.arciumEnv.arciumClusterOffset,
          computationOffset
        ),
        clusterAccount: getClusterAccAddress(
          this.arciumEnv.arciumClusterOffset
        ),
        mxeAccount: getMXEAccAddress(this.programId),
        mempoolAccount: getMempoolAccAddress(
          this.arciumEnv.arciumClusterOffset
        ),
        executingPool: getExecutingPoolAccAddress(
          this.arciumEnv.arciumClusterOffset
        ),
        compDefAccount: getCompDefAccAddress(
          this.programId,
          Buffer.from(getCompDefAccOffset("encrypted_deposit")).readUInt32LE()
        ),
      })
      .signers([payer])
      .rpc({ commitment: "confirmed" });

    console.log(`[MXE Client] Deposit queued: ${sig}`);
    return { computationOffset, sig };
  }

  /**
   * Encrypt and queue a rebalance computation.
   */
  async encryptedRebalance(
    payer: Keypair,
    data: RebalanceData
  ): Promise<{ computationOffset: anchor.BN; sig: string }> {
    this.ensureInitialized();

    const nonce = randomBytes(16);
    const plaintext = [
      data.amountA,
      data.amountB,
      data.newPriceLower,
      data.newPriceUpper,
    ];
    const ciphertext = this.cipher!.encrypt(plaintext, nonce);

    const computationOffset = new anchor.BN(randomBytes(8), "hex");

    const sig = await this.program.methods
      .encryptedRebalance(
        computationOffset,
        Array.from(ciphertext[0]),
        Array.from(ciphertext[1]),
        Array.from(ciphertext[2]),
        Array.from(ciphertext[3]),
        Array.from(this.publicKey),
        new anchor.BN(deserializeLE(nonce).toString())
      )
      .accountsPartial({
        payer: payer.publicKey,
        computationAccount: getComputationAccAddress(
          this.arciumEnv.arciumClusterOffset,
          computationOffset
        ),
        clusterAccount: getClusterAccAddress(
          this.arciumEnv.arciumClusterOffset
        ),
        mxeAccount: getMXEAccAddress(this.programId),
        mempoolAccount: getMempoolAccAddress(
          this.arciumEnv.arciumClusterOffset
        ),
        executingPool: getExecutingPoolAccAddress(
          this.arciumEnv.arciumClusterOffset
        ),
        compDefAccount: getCompDefAccAddress(
          this.programId,
          Buffer.from(
            getCompDefAccOffset("encrypted_rebalance")
          ).readUInt32LE()
        ),
      })
      .signers([payer])
      .rpc({ commitment: "confirmed" });

    console.log(`[MXE Client] Rebalance queued: ${sig}`);
    return { computationOffset, sig };
  }

  /**
   * Encrypt and queue a view position computation.
   */
  async viewPosition(
    payer: Keypair,
    position: PositionData
  ): Promise<{ computationOffset: anchor.BN; sig: string }> {
    this.ensureInitialized();

    const nonce = randomBytes(16);
    const plaintext = [position.amount, position.priceLower, position.priceUpper];
    const ciphertext = this.cipher!.encrypt(plaintext, nonce);

    const computationOffset = new anchor.BN(randomBytes(8), "hex");

    const sig = await this.program.methods
      .viewPosition(
        computationOffset,
        Array.from(ciphertext[0]),
        Array.from(ciphertext[1]),
        Array.from(ciphertext[2]),
        Array.from(this.publicKey),
        new anchor.BN(deserializeLE(nonce).toString())
      )
      .accountsPartial({
        payer: payer.publicKey,
        computationAccount: getComputationAccAddress(
          this.arciumEnv.arciumClusterOffset,
          computationOffset
        ),
        clusterAccount: getClusterAccAddress(
          this.arciumEnv.arciumClusterOffset
        ),
        mxeAccount: getMXEAccAddress(this.programId),
        mempoolAccount: getMempoolAccAddress(
          this.arciumEnv.arciumClusterOffset
        ),
        executingPool: getExecutingPoolAccAddress(
          this.arciumEnv.arciumClusterOffset
        ),
        compDefAccount: getCompDefAccAddress(
          this.programId,
          Buffer.from(getCompDefAccOffset("view_position")).readUInt32LE()
        ),
      })
      .signers([payer])
      .rpc({ commitment: "confirmed" });

    console.log(`[MXE Client] View position queued: ${sig}`);
    return { computationOffset, sig };
  }

  /**
   * Wait for computation to finalize and decrypt result.
   */
  async awaitAndDecrypt(
    computationOffset: anchor.BN,
    numFields: number
  ): Promise<bigint[]> {
    this.ensureInitialized();

    const finalizeSig = await awaitComputationFinalization(
      this.provider,
      computationOffset,
      this.programId,
      "confirmed"
    );
    console.log(`[MXE Client] Computation finalized: ${finalizeSig}`);

    // The callback emits an event with encrypted output.
    // In a real implementation, we'd parse the event logs.
    // For now, return the finalization sig for verification.
    return [];
  }

  /**
   * Decrypt ciphertext values using the session shared secret.
   */
  decryptValues(ciphertexts: Uint8Array[], nonce: Uint8Array): bigint[] {
    this.ensureInitialized();
    return this.cipher!.decrypt(ciphertexts, nonce);
  }

  private ensureInitialized(): void {
    if (!this.cipher) {
      throw new Error(
        "MXE Client not initialized. Call initialize() first."
      );
    }
  }
}
