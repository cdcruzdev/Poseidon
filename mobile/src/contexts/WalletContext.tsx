import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
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

const CLUSTER = 'devnet';

const STORAGE_KEY_PUBKEY = '@poseidon_wallet_pubkey';
const STORAGE_KEY_AUTH = '@poseidon_wallet_auth';

interface WalletContextType {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
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

  // Debug: log/alert when publicKey changes
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
      const result = await transact(async (wallet: Web3MobileWallet) => {
        const authResult = await wallet.authorize({
          identity: APP_IDENTITY,
          cluster: CLUSTER,
        });
        return {
          address: authResult.accounts[0].address,
          authToken: authResult.auth_token,
        };
      });
      // Persist to AsyncStorage BEFORE setting state (survives app kill)
      if (result && result.address) {
        await AsyncStorage.setItem(STORAGE_KEY_PUBKEY, result.address);
        if (result.authToken) {
          await AsyncStorage.setItem(STORAGE_KEY_AUTH, result.authToken);
        }
        const pubkey = new PublicKey(result.address);
        setPublicKey(pubkey);
        setAuthToken(result.authToken);
        Alert.alert('Connected', `Wallet: ${result.address.slice(0, 8)}...`);
      } else {
        Alert.alert('Error', 'No address returned from wallet');
      }
    } catch (err: any) {
      console.error('Wallet connect error:', err);
      Alert.alert('Wallet Error', err?.message || String(err));
    } finally {
      setConnecting(false);
    }
  }, [connecting]);

  const disconnect = useCallback(async () => {
    if (!authToken) {
      setPublicKey(null);
      await AsyncStorage.multiRemove([STORAGE_KEY_PUBKEY, STORAGE_KEY_AUTH]);
      return;
    }
    try {
      await transact(async (wallet: Web3MobileWallet) => {
        await wallet.deauthorize({ auth_token: authToken });
      });
    } catch (err) {
      console.error('Wallet disconnect error:', err);
    } finally {
      setPublicKey(null);
      setAuthToken(null);
      await AsyncStorage.multiRemove([STORAGE_KEY_PUBKEY, STORAGE_KEY_AUTH]);
    }
  }, [authToken]);

  const signTransaction = useCallback(
    async <T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> => {
      return await transact(async (wallet: Web3MobileWallet) => {
        await wallet.authorize({ identity: APP_IDENTITY, cluster: CLUSTER });
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
        await wallet.authorize({ identity: APP_IDENTITY, cluster: CLUSTER });
        const signed = await wallet.signTransactions({ transactions });
        return signed as T[];
      });
    },
    [],
  );

  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    return await transact(async (wallet: Web3MobileWallet) => {
      await wallet.authorize({ identity: APP_IDENTITY, cluster: CLUSTER });
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
      signTransaction,
      signAllTransactions,
      signMessage,
    }),
    [publicKey, connected, connecting, connect, disconnect, signTransaction, signAllTransactions, signMessage],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
