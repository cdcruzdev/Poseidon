"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useConnection } from "@solana/wallet-adapter-react";
import TokenSelector from "@/components/TokenSelector";
import PoolResult from "@/components/PoolResult";
import Alternatives from "@/components/Alternatives";
import AutoRebalance from "@/components/AutoRebalance";
import PrivacyToggle from "@/components/PrivacyToggle";
import YieldSimulator from "@/components/YieldSimulator";
import ILCalculator from "@/components/ILCalculator";
import StrategyPresets, { type Strategy } from "@/components/StrategyPresets";
import AnimateHeight from "@/components/AnimateHeight";
import { TOKENS, type Token } from "@/lib/tokens";
import { comparePools, type Pool } from "@/lib/api";

export default function DepositCard() {
  const { publicKey, connected, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();

  const [tokenA, setTokenA] = useState<Token | null>(TOKENS[0]);
  const [tokenB, setTokenB] = useState<Token | null>(TOKENS[1]);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");

  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [loadingPools, setLoadingPools] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);

  const [autoRebalance, setAutoRebalance] = useState(true);
  const [targetYield, setTargetYield] = useState("0.10");
  const [privacyEnabled, setPrivacyEnabled] = useState(true);
  const [showFees, setShowFees] = useState(false);
  const [strategy, setStrategy] = useState<Strategy["id"]>("balanced");
  const [balanceA, setBalanceA] = useState<number | undefined>(undefined);
  const [txState, setTxState] = useState<"idle" | "confirming" | "success">("idle");
  const [tokenPrices, setTokenPrices] = useState<{ tokenA: number; tokenB: number }>({ tokenA: 0, tokenB: 0 });

  // Fetch SOL balance
  useEffect(() => {
    if (publicKey && connection && tokenA?.symbol === "SOL") {
      connection.getBalance(publicKey).then((bal) => {
        setBalanceA(bal / 1e9);
      });
    }
  }, [publicKey, connection, tokenA]);

  // Fetch token prices from CoinGecko
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // Map token symbols to CoinGecko IDs
        const coinGeckoIds: Record<string, string> = {
          "SOL": "solana",
          "USDC": "usd-coin",
          "USDT": "tether",
          "JUP": "jupiter-exchange-solana",
          "BONK": "bonk",
          "WIF": "dogwifcoin",
          "JTO": "jito-governance-token",
          "RAY": "raydium",
          "ORCA": "orca",
          "mSOL": "msol",
        };

        const idA = tokenA ? coinGeckoIds[tokenA.symbol] : null;
        const idB = tokenB ? coinGeckoIds[tokenB.symbol] : null;
        
        const ids = [idA, idB].filter(Boolean).join(",");
        if (!ids) return;

        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
        const data = await res.json();

        setTokenPrices({
          tokenA: idA ? (data[idA]?.usd || 0) : (tokenA?.symbol === "USDC" ? 1 : 0),
          tokenB: idB ? (data[idB]?.usd || 0) : (tokenB?.symbol === "USDC" ? 1 : 0),
        });
      } catch (err) {
        console.error("Failed to fetch prices:", err);
        // Fallback prices for demo
        setTokenPrices({
          tokenA: tokenA?.symbol === "SOL" ? 180 : tokenA?.symbol === "USDC" ? 1 : 0,
          tokenB: tokenB?.symbol === "USDC" ? 1 : tokenB?.symbol === "SOL" ? 180 : 0,
        });
      }
    };

    fetchPrices();
  }, [tokenA, tokenB]);

  // Auto-calculate token B amount based on USD value (50/50 split)
  useEffect(() => {
    if (amountA && tokenPrices.tokenA > 0 && tokenPrices.tokenB > 0) {
      const usdValueA = parseFloat(amountA) * tokenPrices.tokenA;
      const amountBCalc = usdValueA / tokenPrices.tokenB;
      setAmountB(amountBCalc.toFixed(6));
    }
  }, [amountA, tokenPrices.tokenA, tokenPrices.tokenB]);

  const fetchPools = useCallback(async () => {
    if (!tokenA || !tokenB) return;
    setLoadingPools(true);
    setPoolError(null);
    try {
      const result = await comparePools(tokenA.symbol, tokenB.symbol);
      setPools(result.pools);
      // Store token prices from API response
      setTokenPrices({ 
        tokenA: result.tokenAPrice || 0, 
        tokenB: result.tokenBPrice || 0 
      });
      if (result.pools.length > 0) {
        setSelectedPool(result.pools[0]);
      } else {
        setSelectedPool(null);
      }
    } catch (err) {
      console.error("Failed to fetch pools:", err);
      setPoolError("Failed to fetch pools. Make sure the backend is running.");
      setPools([]);
      setSelectedPool(null);
    } finally {
      setLoadingPools(false);
    }
  }, [tokenA, tokenB]);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  const handleSwapTokens = () => {
    const tempToken = tokenA;
    const tempAmount = amountA;
    setTokenA(tokenB);
    setTokenB(tempToken);
    setAmountA(amountB);
    setAmountB(tempAmount);
  };

  const handleDeposit = async () => {
    if (!connected) {
      setVisible(true);
      return;
    }
    if (!selectedPool || !amountA || !amountB) return;
    setTxState("confirming");
    setTimeout(() => {
      setTxState("success");
      setTimeout(() => {
        setTxState("idle");
        setAmountA("");
        setAmountB("");
      }, 3000);
    }, 2000);
  };

  const canDeposit = connected && selectedPool && amountA && amountB && parseFloat(amountA) > 0 && parseFloat(amountB) > 0;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-[#0a1520]/90 backdrop-blur-md rounded-2xl border border-[#1a3050] overflow-hidden shadow-2xl shadow-black/50">
        {/* Card Header */}
        <div className="p-4 border-b border-[#1a3050] flex items-center justify-between">
          <h2 className="font-semibold text-lg tracking-wider text-[#e0e8f0]" style={{ fontFamily: 'var(--font-bebas)' }}>DEPOSIT LIQUIDITY</h2>
          <button
            onClick={fetchPools}
            disabled={loadingPools}
            className="p-2 rounded-lg hover:bg-[#1a3050]/50 transition-colors text-[#5a7090] hover:text-[#ffffff] disabled:opacity-50"
            title="Refresh pools" aria-label="Refresh pools"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={loadingPools ? "animate-spin" : ""}
            >
              <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </button>
        </div>

        {/* Card Body */}
        <div className="p-4 space-y-3">
          <TokenSelector
            selectedToken={tokenA}
            onSelect={setTokenA}
            excludeToken={tokenB}
            label="You provide"
            amount={amountA}
            onAmountChange={setAmountA}
            balance={balanceA}
            usdPrice={tokenPrices.tokenA}
          />

          <div className="flex items-center justify-center -my-1 relative z-10">
            <button
              onClick={handleSwapTokens}
              className="w-10 h-10 rounded-xl bg-[#0a1520]/90 border border-[#1a3050] flex items-center justify-center hover:border-[#2a4060] hover:bg-[#0d1d30] transition-colors" aria-label="Swap tokens"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4" />
              </svg>
            </button>
          </div>

          <TokenSelector
            selectedToken={tokenB}
            onSelect={setTokenB}
            excludeToken={tokenA}
            label="And"
            amount={amountB}
            onAmountChange={setAmountB}
            usdPrice={tokenPrices.tokenB}
          />

          <div className="pt-2">
            {poolError ? (
              <div className="bg-[#f87171]/10 border border-[#f87171]/20 rounded-xl p-4 text-center">
                <p className="text-sm text-[#f87171]">{poolError}</p>
                <button
                  onClick={fetchPools}
                  className="mt-2 text-xs text-[#8899aa] hover:text-[#ffffff] underline"
                >
                  Try again
                </button>
              </div>
            ) : (
              <PoolResult
                pool={selectedPool}
                loading={loadingPools}
                selected={!!selectedPool}
              />
            )}
          </div>

          {pools.length > 1 && !loadingPools && (
            <Alternatives
              pools={pools}
              selectedPool={selectedPool}
              onSelectPool={setSelectedPool}
              loading={loadingPools}
            />
          )}

          {/* Yield Simulator */}
          {selectedPool && (amountA || amountB) && (
            <YieldSimulator
              pool={selectedPool}
              amountA={amountA}
              amountB={amountB}
              tokenAPrice={tokenPrices.tokenA || 1}
              tokenBPrice={tokenPrices.tokenB || 1}
            />
          )}

          {/* IL Calculator */}
          {selectedPool && (
            <ILCalculator
              pool={selectedPool}
              depositValueUSD={
                (parseFloat(amountA) || 0) * (tokenPrices.tokenA || 1) +
                (parseFloat(amountB) || 0) * (tokenPrices.tokenB || 1)
              }
            />
          )}

          <div className="space-y-3 pt-2">
            <StrategyPresets selected={strategy} onSelect={setStrategy} />
            <AutoRebalance
              enabled={autoRebalance}
              onEnabledChange={setAutoRebalance}
              targetYield={targetYield}
              onTargetYieldChange={setTargetYield}
            />
            <PrivacyToggle
              enabled={privacyEnabled}
              onEnabledChange={setPrivacyEnabled}
            />
          </div>

          {canDeposit && (privacyEnabled || autoRebalance) && (
            <div className="border-t border-[#1a3050] pt-3">
              <button
                onClick={() => setShowFees(!showFees)}
                className="w-full flex items-center justify-between text-sm text-[#8899aa] hover:text-[#ffffff] transition-colors"
              >
                <span>Fee Summary</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`transition-transform ${showFees ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <AnimateHeight open={showFees}>
                <div className="mt-3 space-y-2 text-sm">
                  {privacyEnabled && (
                    <div className="flex justify-between">
                      <span className="text-[#5a7090]">Privacy (Arcium)</span>
                      <span className="text-[#8899aa]">0.1% of deposit</span>
                    </div>
                  )}
                  {autoRebalance && (
                    <div className="flex justify-between">
                      <span className="text-[#5a7090]">Auto-Rebalancing</span>
                      <span className="text-[#8899aa]">5% of rebalance fees</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-[#1a3050]">
                    <span className="text-[#8899aa]">Network Fee</span>
                    <span className="text-[#8899aa]">~0.00025 SOL</span>
                  </div>
                </div>
              </AnimateHeight>
            </div>
          )}

          <div className="pt-2">
            {txState === "confirming" ? (
              <div className="w-full py-4 bg-[#0d1d30]/80 rounded-xl flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-[#2a4060] border-t-[#7ec8e8] rounded-full animate-spin" />
                <span className="text-[#8899aa]">Confirming in wallet...</span>
              </div>
            ) : txState === "success" ? (
              <div className="w-full py-4 bg-[#4ade80]/10 border border-[#4ade80]/20 rounded-xl flex items-center justify-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span className="text-[#4ade80] font-medium">Deposit Successful!</span>
              </div>
            ) : (
              <button
                onClick={handleDeposit}
                disabled={!canDeposit && connected}
                className={`w-full py-4 rounded-xl font-semibold text-base transition-all ${
                  !connected
                    ? "bg-[#7ec8e8] text-[#0a1520] hover:bg-[#9dd8f0]"
                    : canDeposit
                    ? "bg-[#7ec8e8] text-[#0a1520] hover:bg-[#9dd8f0]"
                    : "bg-[#0d1d30]/80 text-[#5a7090] cursor-not-allowed"
                }`}
              >
                {connecting
                  ? "Connecting..."
                  : !connected
                  ? "Connect Wallet"
                  : !selectedPool
                  ? "Select Tokens"
                  : !amountA || !amountB
                  ? "Enter Amounts"
                  : "Deposit Liquidity"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
