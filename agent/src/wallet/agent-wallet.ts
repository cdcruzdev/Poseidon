import { PublicKey, Transaction, Connection, sendAndConfirmRawTransaction } from '@solana/web3.js';
import Decimal from 'decimal.js';

interface ApiResponse {
  signature?: string;
  txHash?: string;
  solana?: { sol?: string; usdc?: string };
  [key: string]: unknown;
}

/**
 * AgentWallet - Server-side wallet via mcpay.tech
 * 
 * Replaces local Keypair with API-based signing.
 * Provides the same `publicKey` interface so existing code works.
 */
export class AgentWallet {
  readonly publicKey: PublicKey;
  private readonly username: string;
  private readonly apiToken: string;
  private readonly apiBase = 'https://agentwallet.mcpay.tech/api';

  constructor(config: {
    username: string;
    apiToken: string;
    solanaAddress: string;
  }) {
    this.username = config.username;
    this.apiToken = config.apiToken;
    this.publicKey = new PublicKey(config.solanaAddress);
  }

  static fromEnv(): AgentWallet {
    const username = process.env.AGENTWALLET_USERNAME;
    const apiToken = process.env.AGENTWALLET_API_TOKEN;
    const solanaAddress = process.env.AGENTWALLET_SOLANA_ADDRESS;

    if (!username || !apiToken || !solanaAddress) {
      throw new Error(
        'Missing AgentWallet env vars. Required: AGENTWALLET_USERNAME, AGENTWALLET_API_TOKEN, AGENTWALLET_SOLANA_ADDRESS'
      );
    }

    return new AgentWallet({ username, apiToken, solanaAddress });
  }

  private async apiCall(endpoint: string, method: string = 'GET', body?: object): Promise<ApiResponse> {
    const opts: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${this.apiBase}${endpoint}`, opts);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`AgentWallet ${endpoint} failed: ${res.status} ${JSON.stringify(err)}`);
    }

    return (await res.json()) as ApiResponse;
  }

  async signMessage(message: string): Promise<string> {
    const data = await this.apiCall(
      `/wallets/${this.username}/actions/sign-message`,
      'POST',
      { chain: 'solana', message }
    );
    return data.signature!;
  }

  /**
   * Sign and send a transaction via AgentWallet API.
   * Serializes the tx message, gets server-side signature, then submits.
   */
  async signAndSendTransaction(
    transaction: Transaction,
    connection: Connection,
    additionalSigners: { publicKey: PublicKey; secretKey: Uint8Array }[] = []
  ): Promise<string> {
    if (additionalSigners.length > 0) {
      transaction.partialSign(...additionalSigners as any);
    }

    const message = transaction.serializeMessage().toString('base64');

    const data = await this.apiCall(
      `/wallets/${this.username}/actions/sign-message`,
      'POST',
      { chain: 'solana', message }
    );

    const signature = Buffer.from(data.signature!, 'base64');
    transaction.addSignature(this.publicKey, signature as any);

    const rawTx = transaction.serialize();
    const txHash = await sendAndConfirmRawTransaction(connection, rawTx, {
      commitment: 'confirmed',
    });

    return txHash;
  }

  async transferSol(to: string, amountLamports: string, network: 'mainnet' | 'devnet' = 'mainnet'): Promise<string> {
    const data = await this.apiCall(
      `/wallets/${this.username}/actions/transfer-solana`,
      'POST',
      { to, amount: amountLamports, asset: 'sol', network }
    );
    return data.txHash!;
  }

  async getBalances(): Promise<{ sol: Decimal; usdc: Decimal }> {
    const data = await this.apiCall(`/wallets/${this.username}/balances`);
    return {
      sol: new Decimal(data.solana?.sol || '0'),
      usdc: new Decimal(data.solana?.usdc || '0'),
    };
  }

  async requestDevnetSol(): Promise<string> {
    const data = await this.apiCall(
      `/wallets/${this.username}/actions/faucet-sol`,
      'POST',
      {}
    );
    return data.txHash!;
  }

  toString(): string {
    return `AgentWallet(${this.username}: ${this.publicKey.toBase58()})`;
  }
}
