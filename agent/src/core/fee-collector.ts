import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import Decimal from 'decimal.js';
import { AgentWallet } from '../wallet/agent-wallet.js';
import { WalletSigner } from '../dex/interface.js';
import { sendTransaction } from '../wallet/send-tx.js';

export interface FeeConfig {
  /** Deposit fee in basis points (10 = 0.1%) */
  depositFeeBps: number;
  /** Performance fee in basis points (500 = 5%) */
  performanceFeeBps: number;
  /** Treasury wallet address (Chris's personal wallet) */
  treasuryAddress: PublicKey;
  /** % of performance fee kept in AgentWallet for gas, in bps of the fee (200 = 2%) */
  agentGasReserveBps: number;
}

export interface FeeBreakdown {
  /** Amount going to LP position (after deposit fee) */
  toPosition: Decimal;
  /** Amount going to treasury */
  toTreasury: Decimal;
  /** Total fee taken */
  totalFee: Decimal;
}

export interface PerformanceFeeBreakdown {
  /** Amount returned to user */
  toUser: Decimal;
  /** Amount sent to treasury */
  toTreasury: Decimal;
  /** Amount kept in AgentWallet for gas */
  toAgentGas: Decimal;
  /** Total fees earned */
  totalFee: Decimal;
}

/**
 * FeeCollector — handles all fee routing for Poseidon.
 * 
 * Revenue model:
 * - Deposit fee: 0.1% of deposit → treasury
 * - Performance fee: 5% of LP fees earned →
 *     98% → treasury
 *     2% → stays in AgentWallet for gas (self-sustaining agent)
 */
export class FeeCollector {
  private config: FeeConfig;
  private connection: Connection;
  private wallet: WalletSigner;

  // Running totals for stats
  private totalDepositFeesCollected = new Decimal(0);
  private totalPerformanceFeesCollected = new Decimal(0);
  private totalGasReserved = new Decimal(0);

  constructor(connection: Connection, wallet: WalletSigner, config: FeeConfig) {
    this.connection = connection;
    this.wallet = wallet;
    this.config = config;
  }

  static fromEnv(connection: Connection, wallet: WalletSigner): FeeCollector {
    const treasuryAddress = process.env.TREASURY_ADDRESS;
    if (!treasuryAddress) {
      throw new Error('TREASURY_ADDRESS env var required');
    }

    return new FeeCollector(connection, wallet, {
      depositFeeBps: parseInt(process.env.DEPOSIT_FEE_BPS || '10'),
      performanceFeeBps: parseInt(process.env.PERFORMANCE_FEE_BPS || '500'),
      treasuryAddress: new PublicKey(treasuryAddress),
      agentGasReserveBps: parseInt(process.env.AGENT_GAS_RESERVE_BPS || '200'),
    });
  }

  /**
   * Calculate deposit fee breakdown.
   * Call this before creating a position to know how much actually goes to LP.
   */
  calculateDepositFee(depositAmount: Decimal): FeeBreakdown {
    const fee = depositAmount.mul(this.config.depositFeeBps).div(10000);
    return {
      toPosition: depositAmount.sub(fee),
      toTreasury: fee,
      totalFee: fee,
    };
  }

  /**
   * Calculate performance fee breakdown on claimed LP fees.
   * Called when agent collects fees from a position.
   */
  calculatePerformanceFee(claimedFees: Decimal): PerformanceFeeBreakdown {
    const totalFee = claimedFees.mul(this.config.performanceFeeBps).div(10000);
    const gasReserve = totalFee.mul(this.config.agentGasReserveBps).div(10000);
    const toTreasury = totalFee.sub(gasReserve);
    const toUser = claimedFees.sub(totalFee);

    return {
      toUser,
      toTreasury,
      toAgentGas: gasReserve,
      totalFee,
    };
  }

  /**
   * Execute deposit fee transfer — send fee to treasury.
   * Returns the tx signature.
   */
  async collectDepositFee(depositAmountLamports: bigint): Promise<string | null> {
    const depositAmount = new Decimal(depositAmountLamports.toString());
    const breakdown = this.calculateDepositFee(depositAmount);

    if (breakdown.toTreasury.lte(0)) return null;

    const feeLamports = BigInt(breakdown.toTreasury.floor().toString());

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.wallet.publicKey,
        toPubkey: this.config.treasuryAddress,
        lamports: feeLamports,
      })
    );

    tx.feePayer = this.wallet.publicKey;
    tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

    const sig = await sendTransaction(this.connection, tx, this.wallet);

    this.totalDepositFeesCollected = this.totalDepositFeesCollected.add(breakdown.toTreasury);
    console.log(`[FeeCollector] Deposit fee: ${breakdown.toTreasury.div(LAMPORTS_PER_SOL).toFixed(6)} SOL → treasury (${sig})`);

    return sig;
  }

  /**
   * Execute performance fee distribution — split between treasury and gas reserve.
   * The gas reserve stays in the AgentWallet automatically (no transfer needed).
   * Only the treasury portion needs a transfer.
   */
  async collectPerformanceFee(claimedFeeLamports: bigint): Promise<{ treasurySig: string | null; breakdown: PerformanceFeeBreakdown }> {
    const claimedFees = new Decimal(claimedFeeLamports.toString());
    const breakdown = this.calculatePerformanceFee(claimedFees);

    let treasurySig: string | null = null;

    if (breakdown.toTreasury.gt(0)) {
      const treasuryLamports = BigInt(breakdown.toTreasury.floor().toString());

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.wallet.publicKey,
          toPubkey: this.config.treasuryAddress,
          lamports: treasuryLamports,
        })
      );

      tx.feePayer = this.wallet.publicKey;
      tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

      treasurySig = await sendTransaction(this.connection, tx, this.wallet);

      this.totalPerformanceFeesCollected = this.totalPerformanceFeesCollected.add(breakdown.toTreasury);
      this.totalGasReserved = this.totalGasReserved.add(breakdown.toAgentGas);

      console.log(`[FeeCollector] Performance fee split:`);
      console.log(`  → Treasury: ${breakdown.toTreasury.div(LAMPORTS_PER_SOL).toFixed(6)} SOL (${treasurySig})`);
      console.log(`  → Gas reserve: ${breakdown.toAgentGas.div(LAMPORTS_PER_SOL).toFixed(6)} SOL (kept in agent)`);
      console.log(`  → User: ${breakdown.toUser.div(LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    }

    return { treasurySig, breakdown };
  }

  /**
   * Get running fee stats
   */
  getStats() {
    return {
      totalDepositFees: this.totalDepositFeesCollected,
      totalPerformanceFees: this.totalPerformanceFeesCollected,
      totalGasReserved: this.totalGasReserved,
      config: {
        depositFeeBps: this.config.depositFeeBps,
        performanceFeeBps: this.config.performanceFeeBps,
        agentGasReserveBps: this.config.agentGasReserveBps,
        treasuryAddress: this.config.treasuryAddress.toBase58(),
      },
    };
  }
}
