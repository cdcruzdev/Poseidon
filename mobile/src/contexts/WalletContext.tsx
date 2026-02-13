import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
// Alert removed - using silent connect/disconnect
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_IDENTITY = {
  name: 'Poseidon',
  uri: 'https://poseidon.trade' as `${string}:${string}`,
  icon: 'favicon.ico',
};

const CLUSTER = 'mainnet-beta';

const STORAGE_KEY_PUBKEY = '@poseidon_wallet_pubkey';
const STORAGE_KEY_AUTH = '@poseidon_wallet_auth';

interface WalletContextType {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  forceDisconnect: () => Promise<void>;
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

const WalletContext = createContext<WalletContextType>({
  publicKey: null,
  connected: false,
  connecting: false,
  connect: async () => {},
  disconnect: async () => {},
  forceDisconnect: async () => {},
  signTransaction: async (tx) => tx,
  signAllTransactions: async (txs) => txs,
  signMessage: async (msg) => msg,
});

export function useWallet() {
  return useContext(WalletContext);
}

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connected = publicKey !== null;

  // Restore wallet state from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const savedPubkey = await AsyncStorage.getItem(STORAGE_KEY_PUBKEY);
        const savedAuth = await AsyncStorage.getItem(STORAGE_KEY_AUTH);
        if (savedPubkey) {
          const pk = new PublicKey(savedPubkey);
          setPublicKey(pk);
          setAuthToken(savedAuth);
          console.log('[Wallet] Restored from storage:', savedPubkey.slice(0, 8));
        }
      } catch (err) {
        console.error('[Wallet] Failed to restore from storage:', err);
      }
    })();
  }, []);

  useEffect(() => {
    if (publicKey) {
      console.log('[Wallet] publicKey changed:', publicKey.toBase58());
    } else {
      console.log('[Wallet] publicKey cleared');
    }
  }, [publicKey]);

  const connect = useCallback(async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      console.log('[Wallet] Starting MWA transact()...');

      const transactPromise = transact(async (wallet: Web3MobileWallet) => {
        console.log('[Wallet] Inside transact callback, calling authorize...');
        
        // If we have a stored auth token, try reauthorize first
        const storedAuth = await AsyncStorage.getItem(STORAGE_KEY_AUTH);
        let authResult;
        
        if (storedAuth) {
          try {
            authResult = await wallet.reauthorize({
              identity: APP_IDENTITY,
              auth_token: storedAuth,
            });
            console.log('[Wallet] reauthorize succeeded');
          } catch {
            console.log('[Wallet] reauthorize failed, trying fresh authorize...');
            authResult = await wallet.authorize({
              identity: APP_IDENTITY,
              cluster: CLUSTER,
            });
          }
        } else {
          authResult = await wallet.authorize({
            identity: APP_IDENTITY,
            cluster: CLUSTER,
          });
        }

        console.log('[Wallet] auth returned:', authResult.accounts[0]?.address?.slice(0, 8));
        return {
          address: authResult.accounts[0].address,
          authToken: authResult.auth_token,
        };
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(
          'Wallet connection timed out (15s). The MWA native module may not be working. Make sure you have a Solana wallet app installed.'
        )), 15000)
      );

      const result = await Promise.race([transactPromise, timeoutPromise]);

      if (result && result.address) {
        // MWA may return address as base64 bytes or base58 string
        let pubkey: PublicKey;
        try {
          pubkey = new PublicKey(result.address);
        } catch {
          // If base58 fails, try decoding as base64
          const bytes = Uint8Array.from(atob(result.address), c => c.charCodeAt(0));
          pubkey = new PublicKey(bytes);
        }
        const base58Address = pubkey.toBase58();
        await AsyncStorage.setItem(STORAGE_KEY_PUBKEY, base58Address);
        if (result.authToken) {
          await AsyncStorage.setItem(STORAGE_KEY_AUTH, result.authToken);
        }
        setPublicKey(pubkey);
        setAuthToken(result.authToken);
        // Connected successfully
      } else {
        console.error('[Wallet] No address returned from wallet');
      }
    } catch (err: any) {
      console.error('[Wallet] Connect error:', err);
      console.error('[Wallet] Connect failed:', err?.message || String(err));
    } finally {
      setConnecting(false);
    }
  }, [connecting]);

  const disconnect = useCallback(async () => {
    // Clear local state immediately -- no MWA dialog popup
    setPublicKey(null);
    setAuthToken(null);
    await AsyncStorage.multiRemove([STORAGE_KEY_PUBKEY, STORAGE_KEY_AUTH]);
    console.log('[Wallet] Disconnected');
  }, []);

  // Force disconnect ΓÇö clears local state without talking to wallet
  const forceDisconnect = useCallback(async () => {
    setPublicKey(null);
    setAuthToken(null);
    setConnecting(false);
    await AsyncStorage.multiRemove([STORAGE_KEY_PUBKEY, STORAGE_KEY_AUTH]);
    console.log('[Wallet] Force disconnected - local state cleared');
  }, []);

  const signTransaction = useCallback(
    async <T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> => {
      return await transact(async (wallet: Web3MobileWallet) => {
        const storedAuth = await AsyncStorage.getItem(STORAGE_KEY_AUTH);
        if (storedAuth) {
          await wallet.reauthorize({ identity: APP_IDENTITY, auth_token: storedAuth });
        } else {
          await wallet.authorize({ identity: APP_IDENTITY, cluster: CLUSTER });
        }
        const signed = await wallet.signTransactions({
          transactions: [transaction],
        });
        return signed[0] as T;
      });
    },
    [],
  );

  const signAllTransactions = useCallback(
    async <T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> => {
      return await transact(async (wallet: Web3MobileWallet) => {
        const storedAuth = await AsyncStorage.getItem(STORAGE_KEY_AUTH);
        if (storedAuth) {
          await wallet.reauthorize({ identity: APP_IDENTITY, auth_token: storedAuth });
        } else {
          await wallet.authorize({ identity: APP_IDENTITY, cluster: CLUSTER });
        }
        const signed = await wallet.signTransactions({ transactions });
        return signed as T[];
      });
    },
    [],
  );

  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    return await transact(async (wallet: Web3MobileWallet) => {
      const storedAuth = await AsyncStorage.getItem(STORAGE_KEY_AUTH);
      if (storedAuth) {
        await wallet.reauthorize({ identity: APP_IDENTITY, auth_token: storedAuth });
      } else {
        await wallet.authorize({ identity: APP_IDENTITY, cluster: CLUSTER });
      }
      const signed = await wallet.signMessages({
        addresses: [publicKey!.toBase58()],
        payloads: [message],
      });
      return signed[0];
    });
  }, [publicKey]);

  const value = useMemo(
    () => ({
      publicKey,
      connected,
      connecting,
      connect,
      disconnect,
      forceDisconnect,
      signTransaction,
      signAllTransactions,
      signMessage,
    }),
    [publicKey, connected, connecting, connect, disconnect, forceDisconnect, signTransaction, signAllTransactions, signMessage],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
