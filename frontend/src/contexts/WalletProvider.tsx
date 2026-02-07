"use client";

import React, { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { SolanaMobileWalletAdapter } from "@solana-mobile/wallet-adapter-mobile";
import { clusterApiUrl } from "@solana/web3.js";

// Import wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css";

interface WalletProviderProps {
  children: React.ReactNode;
}

export default function WalletProvider({ children }: WalletProviderProps) {
  // Use mainnet-beta or custom RPC
  const endpoint = useMemo(() => {
    return process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("mainnet-beta");
  }, []);

  // Initialize wallets - Phantom, Solflare, and Mobile Wallet Adapter
  const wallets = useMemo(
    () => [
      new SolanaMobileWalletAdapter({
        appIdentity: {
          name: "Poseidon",
          uri: typeof window !== "undefined" ? window.location.origin : undefined,
          icon: "/favicon.ico",
        },
        addressSelector: {
          select: async (addresses) => addresses[0],
        },
        cluster: "mainnet-beta",
        authorizationResultCache: {
          get: async () => undefined,
          set: async () => {},
          clear: async () => {},
        },
        onWalletNotFound: async () => {
          // User does not have a mobile wallet installed
          window.open("https://phantom.app/download", "_blank");
        },
      }),
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
