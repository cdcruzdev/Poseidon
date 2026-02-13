import { useState, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';

interface DepositResult {
  signature: string;
  positionId?: string;
}

interface DepositParams {
  poolAddress: string;
  tokenAAmount: number;
  tokenBAmount: number;
  tokenADecimals: number;
  tokenBDecimals: number;
  tokenAMint: string;
  tokenBMint: string;
  slippageBps: number;
}

export function useMeteoraDeposit() {
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = useCallback(
    async (params: DepositParams): Promise<DepositResult> => {
      if (!publicKey) throw new Error('Wallet not connected');
      setLoading(true);
      setError(null);
      try {
        // TODO: Route through backend API for mobile
        throw new Error('Meteora deposits are handled by the backend agent. Use the web interface or wait for API integration.');
      } catch (err: any) {
        const msg = err?.message || 'Meteora deposit failed';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey]
  );

  return { deposit, loading, error };
}
