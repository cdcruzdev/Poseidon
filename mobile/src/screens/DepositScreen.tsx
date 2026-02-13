import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, FlatList, Alert,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { ConnectWalletButton } from '../components/ConnectWalletButton';
import { useWallet } from '../contexts/WalletContext';
import { api, Pool } from '../api/client';
import { TOKENS, TokenInfo, TOKEN_BY_SYMBOL } from '../lib/tokens';
import { connection } from '../lib/connection';
import { useOrcaDeposit } from '../hooks/useOrcaDeposit';
import { useMeteoraDeposit } from '../hooks/useMeteoraDeposit';
import { useRaydiumDeposit } from '../hooks/useRaydiumDeposit';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const SOL_GAS_RESERVE = 0.05; // Reserve SOL for transaction fees

type Strategy = 'Conservative' | 'Balanced' | 'Aggressive';

function formatNum(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatBalance(bal: number, decimals: number): string {
  if (bal === 0) return '0';
  if (bal < 0.001) return '<0.001';
  return bal.toFixed(Math.min(decimals, 4));
}

export function DepositScreen() {
  const wallet = useWallet();
  const { publicKey, connected } = wallet;

  // Token selection
  const [tokenA, setTokenA] = useState<TokenInfo>(TOKENS[0]); // SOL
  const [tokenB, setTokenB] = useState<TokenInfo>(TOKENS[1]); // USDC
  const [pickerTarget, setPickerTarget] = useState<'A' | 'B' | null>(null);

  // Amounts
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');

  // Balances: mint -> ui amount
  const [balances, setBalances] = useState<Record<string, number>>({});

  // Prices: symbol -> usd
  const [prices, setPrices] = useState<Record<string, number>>({});

  // Pools
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [loadingPools, setLoadingPools] = useState(false);

  // Settings
  const [autoRebalance, setAutoRebalance] = useState(true);
  const [strategy, setStrategy] = useState<Strategy>('Balanced');

  // Deposit state
  const [depositing, setDepositing] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  // Hooks for deposit
  const orcaDeposit = useOrcaDeposit();
  const meteoraDeposit = useMeteoraDeposit();
  const raydiumDeposit = useRaydiumDeposit();

  // ── Fetch balances ──
  const fetchBalances = useCallback(async () => {
    if (!publicKey) return;
    try {
      const bals: Record<string, number> = {};
      // SOL balance
      const solBal = await connection.getBalance(publicKey);
      bals['So11111111111111111111111111111111111111112'] = solBal / LAMPORTS_PER_SOL;

      // SPL tokens
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });
      for (const { account } of tokenAccounts.value) {
        const info = account.data.parsed?.info;
        if (info?.mint && info?.tokenAmount) {
          bals[info.mint] = info.tokenAmount.uiAmount ?? 0;
        }
      }
      setBalances(bals);
    } catch (err) {
      console.error('[Deposit] Failed to fetch balances:', err);
    }
  }, [publicKey]);

  useEffect(() => {
    if (connected) fetchBalances();
  }, [connected, fetchBalances]);

  // ── Fetch prices ──
  const fetchPrices = useCallback(async () => {
    try {
      const ids = TOKENS.map((t) => t.coingeckoId).join(',');
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      );
      const data = await res.json();
      const p: Record<string, number> = {};
      for (const t of TOKENS) {
        p[t.symbol] = data[t.coingeckoId]?.usd ?? 0;
      }
      setPrices(p);
    } catch (err) {
      console.error('[Deposit] Failed to fetch prices:', err);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // ── Fetch pools ──
  useEffect(() => {
    if (tokenA.symbol === tokenB.symbol) return;
    setLoadingPools(true);
    setSelectedPool(null);
    api
      .fetchPools(tokenA.symbol, tokenB.symbol)
      .then((res) => {
        setPools(res);
        if (res.length > 0) setSelectedPool(res[0]);
      })
      .catch(() => setPools([]))
      .finally(() => setLoadingPools(false));
  }, [tokenA.symbol, tokenB.symbol]);

  // ── Auto-calc token B from token A ──
  useEffect(() => {
    if (!amountA || !prices[tokenA.symbol] || !prices[tokenB.symbol]) {
      return;
    }
    const usdA = parseFloat(amountA) * prices[tokenA.symbol];
    const calcB = usdA / prices[tokenB.symbol];
    if (isFinite(calcB) && calcB > 0) {
      setAmountB(calcB.toFixed(Math.min(tokenB.decimals, 6)));
    }
  }, [amountA, prices, tokenA.symbol, tokenB.symbol, tokenB.decimals]);

  // ── USD equivalents ──
  const usdA = amountA ? parseFloat(amountA) * (prices[tokenA.symbol] || 0) : 0;
  const usdB = amountB ? parseFloat(amountB) * (prices[tokenB.symbol] || 0) : 0;

  // ── Token picker list sorted by balance ──
  const sortedTokens = useMemo(() => {
    return [...TOKENS].sort((a, b) => {
      const balA = balances[a.mint] || 0;
      const balB = balances[b.mint] || 0;
      return balB - balA;
    });
  }, [balances]);

  // ── Deposit handler ──
  const handleDeposit = async () => {
    if (!selectedPool || !connected) return;
    setDepositing(true);
    setTxSignature(null);
    try {
      const depositParams = {
        poolAddress: (selectedPool as any).address || selectedPool.id || '',
        tokenAAmount: parseFloat(amountA) || 0,
        tokenBAmount: parseFloat(amountB) || 0,
        tokenADecimals: tokenA.decimals,
        tokenBDecimals: tokenB.decimals,
        tokenAMint: tokenA.mint,
        tokenBMint: tokenB.mint,
        slippageBps: 100,
      };

      let result: { signature: string; positionId?: string } | undefined;
      const dex = selectedPool.dex.toLowerCase();
      if (dex.includes('orca')) {
        result = await orcaDeposit.deposit(depositParams);
      } else if (dex.includes('meteora')) {
        result = await meteoraDeposit.deposit(depositParams);
      } else if (dex.includes('raydium')) {
        Alert.alert(
          'Use Web App',
          'Raydium deposits are available on the web app. The Raydium SDK requires features not available on mobile.',
          [{ text: 'OK' }]
        );
        return;
      } else {
        Alert.alert('Unsupported DEX', `Deposits to ${selectedPool.dex} are not yet supported.`);
        return;
      }

      if (result?.signature) {
        setTxSignature(result.signature);
        Alert.alert('Success', `Deposit confirmed!\n\nTx: ${result.signature.slice(0, 16)}...`);
        fetchBalances();
      }
    } catch (err: any) {
      console.error('[Deposit] Error:', err);
      Alert.alert('Deposit Failed', err?.message || String(err));
    } finally {
      setDepositing(false);
    }
  };

  // ── Token Picker Modal ──
  const renderTokenPicker = () => (
    <Modal visible={pickerTarget !== null} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Token</Text>
            <TouchableOpacity onPress={() => setPickerTarget(null)}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={sortedTokens}
            keyExtractor={(item) => item.mint}
            renderItem={({ item }) => {
              const bal = balances[item.mint] || 0;
              const isSelected =
                (pickerTarget === 'A' && item.symbol === tokenA.symbol) ||
                (pickerTarget === 'B' && item.symbol === tokenB.symbol);
              return (
                <TouchableOpacity
                  style={[styles.tokenRow, isSelected && styles.tokenRowSelected]}
                  onPress={() => {
                    if (pickerTarget === 'A') setTokenA(item);
                    else setTokenB(item);
                    setPickerTarget(null);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.tokenInfo}>
                    <Text style={styles.tokenSymbol}>{item.symbol}</Text>
                    <Text style={styles.tokenName}>{item.name}</Text>
                  </View>
                  {bal > 0 && (
                    <Text style={styles.tokenBalance}>{formatBalance(bal, item.decimals)}</Text>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );

  const balA = balances[tokenA.mint] || 0;
  const balB = balances[tokenB.mint] || 0;

  const canDeposit = connected && selectedPool && parseFloat(amountA) > 0;

  return (
    <ImageBackground
      source={require('../../assets/poseidon-bg.jpg')}
      style={styles.bg}
      resizeMode="cover"
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>POSEIDON</Text>
          <ConnectWalletButton />
        </View>
        <Text style={styles.tagline}>Deposit liquidity into the best Solana pools</Text>

        {/* ── Token A Input ── */}
        <Card style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <Text style={styles.inputLabel}>Token A</Text>
            {connected && balA > 0 && (
              <Text style={styles.balanceText}>
                Balance: {formatBalance(balA, tokenA.decimals)}
              </Text>
            )}
          </View>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.tokenSelector}
              onPress={() => setPickerTarget('A')}
              activeOpacity={0.7}
            >
              <Text style={styles.tokenSelectorText}>{tokenA.symbol}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.text.faint} />
            </TouchableOpacity>
            <TextInput
              style={styles.amountInput}
              value={amountA}
              onChangeText={setAmountA}
              placeholder="0.00"
              placeholderTextColor={colors.text.faint}
              keyboardType="decimal-pad"
            />
            {connected && balA > 0 && (
              <TouchableOpacity
                style={styles.maxBtn}
                onPress={() => {
                  const maxA = tokenA.mint === SOL_MINT
                    ? Math.max(0, balA - SOL_GAS_RESERVE)
                    : balA;
                  setAmountA(formatBalance(maxA, tokenA.decimals));
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.maxBtnText}>MAX</Text>
              </TouchableOpacity>
            )}
          </View>
          {usdA > 0 && <Text style={styles.usdText}>≈ ${usdA.toFixed(2)}</Text>}
        </Card>

        {/* Swap icon */}
        <View style={styles.swapRow}>
          <TouchableOpacity
            style={styles.swapBtn}
            onPress={() => {
              setTokenA(tokenB);
              setTokenB(tokenA);
              setAmountA(amountB);
              setAmountB(amountA);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-vertical" size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {/* ── Token B Input ── */}
        <Card style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <Text style={styles.inputLabel}>Token B</Text>
            {connected && balB > 0 && (
              <Text style={styles.balanceText}>
                Balance: {formatBalance(balB, tokenB.decimals)}
              </Text>
            )}
          </View>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.tokenSelector}
              onPress={() => setPickerTarget('B')}
              activeOpacity={0.7}
            >
              <Text style={styles.tokenSelectorText}>{tokenB.symbol}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.text.faint} />
            </TouchableOpacity>
            <TextInput
              style={styles.amountInput}
              value={amountB}
              onChangeText={setAmountB}
              placeholder="0.00"
              placeholderTextColor={colors.text.faint}
              keyboardType="decimal-pad"
            />
            {connected && balB > 0 && (
              <TouchableOpacity
                style={styles.maxBtn}
                onPress={() => {
                  const maxB = tokenB.mint === SOL_MINT
                    ? Math.max(0, balB - SOL_GAS_RESERVE)
                    : balB;
                  setAmountB(formatBalance(maxB, tokenB.decimals));
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.maxBtnText}>MAX</Text>
              </TouchableOpacity>
            )}
          </View>
          {usdB > 0 && <Text style={styles.usdText}>≈ ${usdB.toFixed(2)}</Text>}
        </Card>

        {/* ── Pool Discovery ── */}
        <Card style={styles.poolCard}>
          <Text style={styles.cardTitle}>POOL</Text>
          {loadingPools ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.loadingText}>Scanning DEXs...</Text>
            </View>
          ) : selectedPool ? (
            <>
              <View style={styles.bestPool}>
                <View>
                  <Text style={styles.poolDex}>{selectedPool.dex}</Text>
                  <Text style={styles.poolYield}>{selectedPool.yield24h.toFixed(1)}% APY</Text>
                </View>
                <View style={styles.poolRight}>
                  <Text style={styles.poolStat}>TVL {formatNum(selectedPool.tvl)}</Text>
                  <Text style={styles.poolStat}>Fee {selectedPool.feeTier}%</Text>
                </View>
              </View>
              {pools.length > 1 && (
                <>
                  <Text style={styles.altTitle}>Other pools</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.altScroll}>
                    {pools.slice(1).map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.altChip,
                          selectedPool.id === p.id && styles.altChipActive,
                        ]}
                        onPress={() => setSelectedPool(p)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.altDex}>{p.dex}</Text>
                        <Text style={styles.altYield}>{p.yield24h.toFixed(1)}%</Text>
                        <Text style={styles.altTvl}>{formatNum(p.tvl)}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
            </>
          ) : (
            <Text style={styles.noPool}>
              {tokenA.symbol === tokenB.symbol
                ? 'Select different tokens'
                : 'No pools found'}
            </Text>
          )}
        </Card>

        {/* ── Settings ── */}
        <Card style={styles.settingsCard}>
          <Text style={styles.cardTitle}>SETTINGS</Text>

          {/* Auto-Rebalance */}
          <TouchableOpacity
            style={[styles.toggle, autoRebalance && styles.toggleActive]}
            onPress={() => setAutoRebalance(!autoRebalance)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={autoRebalance ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={autoRebalance ? colors.accent : colors.text.faint}
            />
            <Text style={[styles.toggleText, autoRebalance && styles.toggleTextActive]}>
              Auto-Rebalance
            </Text>
          </TouchableOpacity>

          {/* Strategy */}
          <Text style={styles.stratLabel}>Strategy</Text>
          <View style={styles.stratRow}>
            {(['Conservative', 'Balanced', 'Aggressive'] as Strategy[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.stratChip, strategy === s && styles.stratChipActive]}
                onPress={() => setStrategy(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.stratText, strategy === s && styles.stratTextActive]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* ── Deposit Button ── */}
        {!connected ? (
          <TouchableOpacity style={styles.depositBtnDisabled} activeOpacity={1}>
            <Text style={styles.depositBtnTextDisabled}>Connect Wallet to Deposit</Text>
          </TouchableOpacity>
        ) : depositing ? (
          <View style={styles.depositBtn}>
            <ActivityIndicator size="small" color={colors.bg.deep} />
            <Text style={styles.depositBtnText}>Depositing...</Text>
          </View>
        ) : txSignature ? (
          <View style={styles.successBtn}>
            <Ionicons name="checkmark-circle" size={20} color={colors.bg.deep} />
            <Text style={styles.depositBtnText}>
              Deposited! {txSignature.slice(0, 8)}...
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.depositBtn, !canDeposit && styles.depositBtnDisabled]}
            onPress={handleDeposit}
            activeOpacity={0.8}
            disabled={!canDeposit}
          >
            <Text style={canDeposit ? styles.depositBtnText : styles.depositBtnTextDisabled}>
              {selectedPool ? `Deposit via ${selectedPool.dex}` : 'Select a pool'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {renderTokenPicker()}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  logo: { fontSize: 22, fontWeight: '900', color: colors.accent, letterSpacing: 2 },
  tagline: { color: colors.text.muted, fontSize: 14, marginBottom: 20 },

  // Input cards
  inputCard: { marginBottom: 4 },
  inputHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  inputLabel: { color: colors.text.faint, fontSize: 11, fontWeight: '600' },
  balanceText: { color: colors.text.faint, fontSize: 11 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tokenSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bg.deep,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  tokenSelectorText: { color: colors.text.primary, fontSize: 16, fontWeight: '700' },
  amountInput: {
    flex: 1,
    backgroundColor: colors.bg.deep,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.border.subtle,
    textAlign: 'right',
  },
  maxBtn: {
    backgroundColor: colors.accent + '20',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  maxBtnText: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  usdText: { color: colors.text.faint, fontSize: 12, marginTop: 6, textAlign: 'right' },

  // Swap
  swapRow: { alignItems: 'center', marginVertical: 4 },
  swapBtn: {
    backgroundColor: colors.bg.elevated,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },

  // Pool card
  poolCard: { marginTop: 12 },
  cardTitle: { color: colors.text.muted, fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },
  bestPool: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  poolDex: { color: colors.text.faint, fontSize: 11, fontWeight: '600' },
  poolYield: { color: colors.success, fontSize: 18, fontWeight: '800', marginTop: 2 },
  poolRight: { alignItems: 'flex-end' },
  poolStat: { color: colors.text.muted, fontSize: 12, marginTop: 2 },
  altTitle: { color: colors.text.faint, fontSize: 11, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  altScroll: { marginBottom: 4 },
  altChip: {
    backgroundColor: colors.bg.deep,
    borderRadius: 10,
    padding: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    minWidth: 90,
  },
  altChipActive: { borderColor: colors.accent },
  altDex: { color: colors.text.faint, fontSize: 10, fontWeight: '600' },
  altYield: { color: colors.success, fontSize: 14, fontWeight: '700' },
  altTvl: { color: colors.text.muted, fontSize: 11 },
  noPool: { color: colors.text.faint, fontSize: 13, textAlign: 'center', paddingVertical: 12 },

  loadingWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  loadingText: { color: colors.text.muted, fontSize: 13 },

  // Settings
  settingsCard: { marginTop: 12 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.bg.deep,
    marginBottom: 12,
  },
  toggleActive: { borderColor: colors.accent + '60', backgroundColor: colors.accent + '10' },
  toggleText: { color: colors.text.faint, fontSize: 13, fontWeight: '600' },
  toggleTextActive: { color: colors.accent },
  stratLabel: { color: colors.text.faint, fontSize: 11, fontWeight: '600', marginBottom: 8 },
  stratRow: { flexDirection: 'row', gap: 8 },
  stratChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.bg.deep,
    alignItems: 'center',
  },
  stratChipActive: { borderColor: colors.accent, backgroundColor: colors.accent + '15' },
  stratText: { color: colors.text.faint, fontSize: 12, fontWeight: '600' },
  stratTextActive: { color: colors.accent },

  // Deposit button
  depositBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  depositBtnDisabled: {
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  depositBtnText: { color: colors.bg.deep, fontSize: 16, fontWeight: '800' },
  depositBtnTextDisabled: { color: colors.text.faint, fontSize: 16, fontWeight: '800' },
  successBtn: {
    backgroundColor: colors.success,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bg.base,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalTitle: { color: colors.text.primary, fontSize: 18, fontWeight: '700' },
  tokenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  tokenRowSelected: { backgroundColor: colors.accent + '10' },
  tokenInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tokenSymbol: { color: colors.text.primary, fontSize: 16, fontWeight: '700' },
  tokenName: { color: colors.text.faint, fontSize: 13 },
  tokenBalance: { color: colors.text.faint, fontSize: 13 },
});
