"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import TokenSelector from "@/components/TokenSelector";
import PoolResult from "@/components/PoolResult";
import Alternatives from "@/components/Alternatives";
import AutoRebalance from "@/components/AutoRebalance";
import PrivacyToggle from "@/components/PrivacyToggle";
import { useOrcaDeposit } from "@/hooks/useOrcaDeposit";
import useMeteoraDeposit from "@/hooks/useMeteoraDeposit";
import { useRaydiumDeposit } from "@/hooks/useRaydiumDeposit";
import { useRebalanceProgram } from "@/hooks/useRebalanceProgram";
import StrategyPresets, { type Strategy } from "@/components/StrategyPresets";
import AnimateHeight from "@/components/AnimateHeight";
import { TOKENS, type Token } from "@/lib/tokens";
import { API_BASE, getPools, type Pool } from "@/lib/api";

function parseTxError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("user refused") || lower.includes("user cancelled"))
    return "Transaction cancelled.";
  if (lower.includes("insufficient lamports") || lower.includes("insufficient funds") || lower.includes("0x1"))
    return "Insufficient SOL for transaction fees. Try a slightly smaller amount.";
  if (lower.includes("insufficient") && lower.includes("balance"))
    return "Insufficient token balance.";
  if (lower.includes("blockhash") || lower.includes("expired"))
    return "Transaction expired. Please try again.";
  if (lower.includes("timeout") || lower.includes("timed out"))
    return "Transaction timed out. Please try again.";
  if (lower.includes("slippage") || lower.includes("exceeds desired"))
    return "Price moved too much (slippage). Try again or increase slippage tolerance.";
  if (lower.includes("simulation failed"))
    return "Transaction simulation failed. Try a smaller amount or different pool.";
  // Fallback: truncate if too long
  if (raw.length > 120) return raw.slice(0, 100) + "...";
  return raw;
}

export default function DepositCard() {
  const { publicKey, connected, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();

  // DEX deposit hooks
  const orca = useOrcaDeposit();
  const meteora = useMeteoraDeposit();
  const raydium = useRaydiumDeposit();
  const { enableRebalance } = useRebalanceProgram();

  const [tokenA, setTokenA] = useState<Token | null>(TOKENS[0]);
  const [tokenB, setTokenB] = useState<Token | null>(TOKENS[1]);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");

  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [bestPool, setBestPool] = useState<Pool | null>(null);
  const [loadingPools, setLoadingPools] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);

  const [autoRebalance, setAutoRebalance] = useState(true);
  const [targetYield, setTargetYield] = useState("0.10");
  const [privacyEnabled, setPrivacyEnabled] = useState(true);
  const [showFees, setShowFees] = useState(false);
  const [strategy, setStrategy] = useState<Strategy["id"]>("balanced");
  const [txState, setTxState] = useState<"idle" | "confirming" | "success">("idle");
  const [tokenPrices, setTokenPrices] = useState<{ tokenA: number; tokenB: number }>({ tokenA: 0, tokenB: 0 });
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({});
  const [manualTokenB, setManualTokenB] = useState(false);
  const [rebalanceWarning, setRebalanceWarning] = useState<string | null>(null);

  // Fetch all token balances at once
  useEffect(() => {
    if (!publicKey || !connection) {
      setTokenBalances({});
      return;
    }

    const fetchAllBalances = async () => {
      const balances: Record<string, number> = {};

      // SOL balance
      try {
        const solBal = await connection.getBalance(publicKey);
        balances["SOL"] = solBal / 1e9;
      } catch { /* ignore */ }

      // All SPL token balances in one call
      try {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
          programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        });
        for (const account of tokenAccounts.value) {
          const parsed = account.account.data.parsed?.info;
          if (!parsed) continue;
          const mint = parsed.mint as string;
          const uiAmount = parsed.tokenAmount?.uiAmount ?? 0;
          const token = TOKENS.find(t => t.mint === mint);
          if (token && uiAmount > 0) {
            balances[token.symbol] = uiAmount;
          }
        }
      } catch { /* ignore */ }

      setTokenBalances(balances);
    };

    fetchAllBalances();
  }, [publicKey, connection]);

  const SOL_RENT_RESERVE = 0.01;
  // Show full balance in UI, but cap MAX at balance - rent reserve
  const balanceA = tokenA ? tokenBalances[tokenA.symbol] : undefined;
  const balanceB = tokenB ? tokenBalances[tokenB.symbol] : undefined;
  const maxBalanceA = balanceA !== undefined && tokenA?.symbol === "SOL"
    ? Math.max(0, balanceA - SOL_RENT_RESERVE) : balanceA;
  const maxBalanceB = balanceB !== undefined && tokenB?.symbol === "SOL"
    ? Math.max(0, balanceB - SOL_RENT_RESERVE) : balanceB;

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
        // No fallback prices � user can enter both amounts manually
        setTokenPrices({ tokenA: 0, tokenB: 0 });
      }
    };

    fetchPrices();
  }, [tokenA, tokenB]);

  // Track which field was last edited
  const lastEditRef = useRef<"a" | "b">("a");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced auto-fill: A→B and B→A
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (tokenPrices.tokenA <= 0 || tokenPrices.tokenB <= 0) return;

    debounceRef.current = setTimeout(() => {
      if (lastEditRef.current === "a" && amountA && !manualTokenB) {
        const usdVal = parseFloat(amountA) * tokenPrices.tokenA;
        setAmountB((usdVal / tokenPrices.tokenB).toFixed(6));
      } else if (lastEditRef.current === "b" && amountB && manualTokenB) {
        const usdVal = parseFloat(amountB) * tokenPrices.tokenB;
        setAmountA((usdVal / tokenPrices.tokenA).toFixed(6));
      }
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [amountA, amountB, tokenPrices.tokenA, tokenPrices.tokenB, manualTokenB]);

  const lastPairRef = useRef("");

  const fetchPools = useCallback(async () => {
    if (!tokenA || !tokenB) return;
    // Normalize pair key so swapped tokens don't re-fetch
    const pairKey = [tokenA.symbol, tokenB.symbol].sort().join("-");
    if (pairKey === lastPairRef.current && pools.length > 0) return;
    lastPairRef.current = pairKey;
    setLoadingPools(true);
    setPoolError(null);
    setPools([]);
    setSelectedPool(null);

    const dexes = ["orca", "raydium", "meteora"];

    // Helper: fetch with timeout
    const fetchWithTimeout = async (dex: string, timeoutMs: number) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const result = await fetch(
          `${API_BASE}/api/pools?tokenA=${tokenA.symbol}&tokenB=${tokenB.symbol}&dex=${dex}&limit=20`,
          { signal: controller.signal }
        );
        const json = await result.json();
        return json.success ? (json.data as Pool[]) : [];
      } catch {
        return [];
      } finally {
        clearTimeout(timer);
      }
    };

    // Fetch all 3 in parallel
    const [orcaPools, raydiumPools, meteoraPools] = await Promise.all([
      fetchWithTimeout("orca", 15000),
      fetchWithTimeout("raydium", 15000),
      fetchWithTimeout("meteora", 15000),
    ]);

    const allPools = [...orcaPools, ...raydiumPools, ...meteoraPools];

    // Sort by yield (best pool = highest yield with decent TVL)
    allPools.sort((a, b) => {
      const yA = a.yield24h ?? (a.apr24h || a.estimatedApr || 0) / 365;
      const yB = b.yield24h ?? (b.apr24h || b.estimatedApr || 0) / 365;
      // Penalize pools with <$500K TVL
      const safeA = a.tvl >= 500_000 ? 1 : a.tvl >= 100_000 ? 0.5 : 0.1;
      const safeB = b.tvl >= 500_000 ? 1 : b.tvl >= 100_000 ? 0.5 : 0.1;
      return (yB * safeB) - (yA * safeA);
    });
    const top10 = allPools.slice(0, 6);
    setPools(top10);

    if (top10.length > 0) {
      setSelectedPool(top10[0]);
      setBestPool(top10[0]);
      const withPrice = top10.find(p => p.tokenAPrice && p.tokenAPrice > 0);
      if (withPrice) {
        setTokenPrices({ tokenA: withPrice.tokenAPrice || 0, tokenB: withPrice.tokenBPrice || 0 });
      }
    }

    if (allPools.length === 0) {
      setPoolError("Unable to load pools right now. Please try again.");
    }
    setLoadingPools(false);
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
    setManualTokenB(false);
  };

  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const handleDeposit = async () => {
    if (!connected) {
      setVisible(true);
      return;
    }
    if (!selectedPool || !amountA || !amountB || !tokenA || !tokenB) return;

    setTxState("confirming");
    setTxError(null);
    setTxSignature(null);
    setRebalanceWarning(null);

    try {
      const depositParams = {
        poolAddress: selectedPool.address,
        tokenAAmount: parseFloat(amountA),
        tokenBAmount: parseFloat(amountB),
        tokenADecimals: tokenA.decimals,
        tokenBDecimals: tokenB.decimals,
        tokenAMint: tokenA.mint,
        tokenBMint: tokenB.mint,
        slippageBps: 50, // 0.5% slippage
      };

      let result;
      switch (selectedPool.dex) {
        case "orca":
          result = await orca.deposit(depositParams);
          break;
        case "meteora":
          result = await meteora.deposit(depositParams);
          break;
        case "raydium":
          result = await raydium.deposit(depositParams);
          break;
        default:
          throw new Error(`Unsupported DEX: ${selectedPool.dex}`);
      }

      setTxSignature(result.signature);

      // If auto-rebalance is enabled, register on-chain
      if (autoRebalance && publicKey) {
        try {
          const slippageBps = strategy === "aggressive" ? 200 : strategy === "conservative" ? 50 : 100;
          const yieldBps = Math.round(parseFloat(targetYield) * 100);
          await enableRebalance(slippageBps, yieldBps);
        } catch (rebalanceErr) {
          console.warn("Rebalance registration failed (deposit still succeeded):", rebalanceErr);
          setRebalanceWarning("Deposit successful, but auto-rebalance couldn't be enabled. You can enable it from your positions page.");
        }
      }

      setTxState("success");
      setTimeout(() => {
        setTxState("idle");
        setAmountA("");
        setAmountB("");
        setTxSignature(null);
      }, 5000);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Transaction failed";
      const message = parseTxError(raw);
      setTxError(message);
      setTxState("idle");
    }
  };

  const poolQualityOk = selectedPool && selectedPool.tvl >= 100_000;
  const parsedA = parseFloat(amountA);
  const parsedB = parseFloat(amountB);
  const hasEnoughA = balanceA !== undefined && parsedA <= balanceA;
  const hasEnoughB = balanceB !== undefined && parsedB <= balanceB;
  const insufficientBalance = amountA && amountB && parsedA > 0 && parsedB > 0 && (!hasEnoughA || !hasEnoughB);
  const canDeposit = connected && poolQualityOk && amountA && amountB && parsedA > 0 && parsedB > 0 && hasEnoughA && hasEnoughB;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-[#0a1520]/90 backdrop-blur-md rounded-2xl border border-[#1a3050] shadow-2xl shadow-black/50">
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
            onAmountChange={(val) => { lastEditRef.current = "a"; setManualTokenB(false); setAmountA(val); }}
            balance={balanceA}
            maxBalance={maxBalanceA}
            usdPrice={tokenPrices.tokenA}
            tokenBalances={tokenBalances}
          />

          <div className="flex items-center justify-center -my-1 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-[#0a1520]/90 border border-[#1a3050] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5a7090" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
          </div>

          <TokenSelector
            selectedToken={tokenB}
            onSelect={setTokenB}
            excludeToken={tokenA}
            label="And"
            amount={amountB}
            onAmountChange={(val) => { lastEditRef.current = "b"; setManualTokenB(true); setAmountB(val); }}
            balance={balanceB}
            maxBalance={maxBalanceB}
            usdPrice={tokenPrices.tokenB}
            tokenBalances={tokenBalances}
          />
          {tokenPrices.tokenA === 0 || tokenPrices.tokenB === 0 ? (
            <p className="text-[10px] text-[#5a7090] px-1">Price unavailable � enter both amounts manually.</p>
          ) : null}

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
            ) : !loadingPools && pools.length > 0 && !poolQualityOk ? (
              <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-xl p-4 text-center">
                <p className="text-sm text-[#f59e0b]">No quality pools found for this pair.</p>
                <p className="text-xs text-[#8899aa] mt-1">Try pairing with SOL or USDC for better options.</p>
              </div>
            ) : (
              <>
                <PoolResult
                  pool={selectedPool}
                  loading={loadingPools && pools.length === 0}
                  selected={!!selectedPool && !!bestPool && selectedPool.address === bestPool.address && !loadingPools}
                />
                {loadingPools && pools.length === 0 && (
                  <div className="flex items-center gap-2 mt-2 px-1">
                    <svg className="animate-spin h-3 w-3 text-[#7ec8e8]" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-[10px] text-[#5a7090]">
                      Loading pools...
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {pools.length > 1 && !loadingPools && (
            <Alternatives
              pools={pools}
              selectedPool={selectedPool}
              bestPool={bestPool}
              onSelectPool={setSelectedPool}
              loading={loadingPools}
            />
          )}

          <div className="space-y-3 pt-2">
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

          {canDeposit && (
            <div className="border-t border-[#1a3050] pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-[#5a7090]">Fees</span>
                <span className="text-[#8899aa]">~0.00025 SOL</span>
              </div>
            </div>
          )}

          {txError && (
            <div className="bg-[#f87171]/10 border border-[#f87171]/20 rounded-xl p-3 text-center">
              <p className="text-sm text-[#f87171]">{txError}</p>
              <button
                onClick={() => setTxError(null)}
                className="mt-1 text-xs text-[#8899aa] hover:text-[#ffffff] underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="pt-2">
            {txState === "confirming" ? (
              <div className="w-full py-4 bg-[#0d1d30]/80 rounded-xl flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-[#2a4060] border-t-[#7ec8e8] rounded-full animate-spin" />
                <span className="text-[#8899aa]">
                  {selectedPool ? `Depositing via ${selectedPool.dex.charAt(0).toUpperCase() + selectedPool.dex.slice(1)}...` : "Confirming in wallet..."}
                </span>
              </div>
            ) : txState === "success" ? (
              <div className="w-full py-4 bg-[#4ade80]/10 border border-[#4ade80]/20 rounded-xl flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span className="text-[#4ade80] font-medium">Deposit Successful!</span>
                </div>
                {rebalanceWarning && (
                  <p className="text-xs text-[#f59e0b] text-center px-2">{rebalanceWarning}</p>
                )}
                {txSignature && (
                  <a
                    href={`https://solscan.io/tx/${txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#7ec8e8] hover:underline"
                  >
                    View on Solscan ?
                  </a>
                )}
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
                  : insufficientBalance
                  ? "Insufficient Balance"
                  : "Deposit Liquidity"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
