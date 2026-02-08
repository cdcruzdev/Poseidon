import { Connection, Keypair, Transaction, sendAndConfirmTransaction, Signer } from '@solana/web3.js';
import { AgentWallet } from './agent-wallet.js';
import { WalletSigner } from '../dex/interface.js';

/**
 * Send and confirm a transaction using either a local Keypair or AgentWallet.
 * Drop-in replacement for sendAndConfirmTransaction that works with both.
 */
export async function sendTransaction(
  connection: Connection,
  transaction: Transaction,
  wallet: WalletSigner,
  additionalSigners: Signer[] = []
): Promise<string> {
  if (wallet instanceof AgentWallet) {
    // Server-side signing via AgentWallet API
    return wallet.signAndSendTransaction(
      transaction,
      connection,
      additionalSigners as { publicKey: any; secretKey: Uint8Array }[]
    );
  } else {
    // Local keypair signing
    return sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet, ...additionalSigners]
    );
  }
}
