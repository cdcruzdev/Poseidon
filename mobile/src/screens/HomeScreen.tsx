import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ImageBackground, TextInput, ActivityIndicator, Image,
  LayoutAnimation, Platform, UIManager, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { SharedHeader } from '../components/SharedHeader';
import { useWallet } from '../contexts/WalletContext';
import { api, Pool } from '../api/client';
import { TOKENS, Token } from '../lib/tokens';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COINGECKO_IDS: Record<string, string> = {
  SOL: 'solana', USDC: 'usd-coin', USDT: 'tether',
  JUP: 'jupiter-exchange-solana', BONK: 'bonk', WIF: 'dogwifcoin',
};

// Sanitize amount input: only digits and one decimal point
function sanitizeAmount(val: string): string {
  let clean = val.replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  if (parts.length > 2) clean = parts[0] + '.' + parts.slice(1).join('');
  // Max 4 decimal places
  if (parts.length === 2 && parts[1].length > 4) {
    clean = parts[0] + '.' + parts[1].slice(0, 4);
  }
  return clean;
}

function formatNum(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// ---------- Token Selector ----------
function TokenSelector({
  selectedToken, onSelect, excludeToken, label, amount, onAmountChange,
  usdPrice = 0, balance, onMaxPress, isOpen, onToggleOpen, tokenBalances,
}: {
  selectedToken: Token | null;
  onSelect: (token: Token) => void;
  excludeToken?: Token | null;
  label: string;
  amount: string;
  onAmountChange: (val: string) => void;
  usdPrice?: number;
  balance?: number;
  onMaxPress?: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  tokenBalances?: Record<string, number>;
}) {
  const [search, setSearch] = useState('');
  const balances = tokenBalances || {};

  // Sort: tokens with balance first
  const filteredTokens = TOKENS.filter(t => {
    if (excludeToken && t.symbol === excludeToken.symbol) return false;
    if (!search) return true;
    return t.symbol.toLowerCase().includes(search.toLowerCase()) ||
           t.name.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => {
    const balA = balances[a.symbol] || 0;
    const balB = balances[b.symbol] || 0;
    if (balA > 0 && balB <= 0) return -1;
    if (balB > 0 && balA <= 0) return 1;
    return 0;
  });

  const handleSelect = (token: Token) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onSelect(token);
    onToggleOpen();
    setSearch('');
  };

  const usdValue = amount && parseFloat(amount) > 0 && usdPrice > 0
    ? (parseFloat(amount) * usdPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null;

  return (
    <View style={tss.container}>
      <View style={tss.labelRow}>
        <Text style={tss.label}>{label}</Text>
        {balance !== undefined && (
          <Text style={tss.balanceText}>
            Balance: <Text style={{ color: '#fff' }}>{balance < 0.0001 ? '<0.0001' : balance.toFixed(4)}</Text>
          </Text>
        )}
      </View>

      <View style={tss.row}>
        <TouchableOpacity style={tss.tokenBtn} onPress={onToggleOpen} activeOpacity={0.7}>
          {selectedToken ? (
            <Image source={{ uri: selectedToken.logo }} style={tss.tokenLogo} />
          ) : null}
          <Text style={tss.tokenSymbol}>{selectedToken?.symbol || 'Select'}</Text>
          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={12} color="#5a7090" />
        </TouchableOpacity>

        <TextInput
          style={tss.amountInput}
          value={amount}
          onChangeText={(v) => onAmountChange(sanitizeAmount(v))}
          placeholder="0.00"
          placeholderTextColor="#5a7090"
          keyboardType="decimal-pad"
          textAlign="right"
        />

        {balance !== undefined && balance > 0 && (
          <TouchableOpacity style={tss.maxBtn} onPress={onMaxPress} activeOpacity={0.7}>
            <Text style={tss.maxText}>MAX</Text>
          </TouchableOpacity>
        )}
      </View>

      {usdValue && <Text style={tss.usdValue}>~ ${usdValue}</Text>}

      {isOpen && (
        <View style={tss.dropdown}>
          <TextInput
            style={tss.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search tokens..."
            placeholderTextColor="#5a7090"
          />
          {filteredTokens.map(token => {
            const bal = balances[token.symbol];
            return (
              <TouchableOpacity
                key={token.symbol}
                style={tss.dropdownItem}
                onPress={() => handleSelect(token)}
                activeOpacity={0.7}
              >
                <Image source={{ uri: token.logo }} style={tss.dropdownLogo} />
                <View style={{ flex: 1 }}>
                  <Text style={tss.dropdownSymbol}>{token.symbol}</Text>
                  <Text style={tss.dropdownName}>{token.name}</Text>
                </View>
                {bal !== undefined && bal > 0 && (
                  <Text style={tss.dropdownBalance}>
                    {bal < 0.0001 ? '<0.0001' : bal < 1 ? bal.toFixed(4) : bal < 1000 ? bal.toFixed(2) : bal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
          {filteredTokens.length === 0 && (
            <Text style={tss.noResults}>No tokens found</Text>
          )}
        </View>
      )}
    </View>
  );
}

const tss = StyleSheet.create({
  container: { backgroundColor: '#0d1d30', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1a3050' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 13, color: '#7090a0' },
  balanceText: { fontSize: 12, color: '#7090a0' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tokenBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#0a1520', borderRadius: 10, borderWidth: 1, borderColor: '#1a3050',
  },
  tokenLogo: { width: 28, height: 28, borderRadius: 14 },
  tokenSymbol: { color: '#e0e8f0', fontSize: 16, fontWeight: '700' },
  amountInput: { flex: 1, color: '#ffffff', fontSize: 20, fontWeight: '600' },
  maxBtn: {
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: 'rgba(126,200,232,0.1)', borderRadius: 6,
  },
  maxText: { color: '#7ec8e8', fontSize: 11, fontWeight: '700' },
  usdValue: { color: '#5a7090', fontSize: 12, textAlign: 'right', marginTop: 6 },
  dropdown: {
    backgroundColor: '#0a1520', borderRadius: 12, borderWidth: 1,
    borderColor: '#1a3050', marginTop: 8, overflow: 'hidden',
  },
  searchInput: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1a3050', color: '#e0e8f0', fontSize: 14,
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  dropdownLogo: { width: 36, height: 36, borderRadius: 18 },
  dropdownSymbol: { color: '#e0e8f0', fontSize: 15, fontWeight: '600' },
  dropdownName: { color: '#5a7090', fontSize: 12 },
  dropdownBalance: { color: '#5a7090', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  noResults: { color: '#5a7090', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
});

// ---------- Pool Result Card ----------
function PoolResultCard({
  pool, selected, onPress, compact = false, isBest = false,
}: {
  pool: Pool; selected?: boolean; onPress?: () => void; compact?: boolean; isBest?: boolean;
}) {
  const dexLogos: Record<string, any> = {
    meteora: require('../../assets/meteora-logo.png'),
    orca: require('../../assets/orca-logo.png'),
    raydium: require('../../assets/raydium-logo.png'),
  };

  const yield24h = pool.yield24h;
  const tvlFormatted = pool.tvl >= 1_000_000
    ? `$${(pool.tvl / 1_000_000).toFixed(1)}M`
    : `$${(pool.tvl / 1_000).toFixed(0)}K`;

  if (compact) {
    return (
      <TouchableOpacity
        style={[pss.compactRow, selected && pss.compactSelected]}
        onPress={onPress} activeOpacity={0.7}
      >
        <Image source={dexLogos[pool.dex]} style={pss.compactLogo} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={pss.compactDex}>{pool.dex.charAt(0).toUpperCase() + pool.dex.slice(1)}</Text>
            {isBest && <View style={pss.bestBadge}><Text style={pss.bestBadgeText}>Best</Text></View>}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={pss.compactTvl}>TVL {tvlFormatted}</Text>
          <Text style={pss.compactYield}>{yield24h.toFixed(3)}%</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={[pss.card, selected && pss.cardSelected]} onPress={onPress} activeOpacity={0.8}>
      {selected && (
        <View style={pss.bestRow}>
          <View style={pss.bestDot} />
          <Text style={pss.bestLabel}>BEST POOL FOUND</Text>
        </View>
      )}
      <View style={pss.mainRow}>
        <View style={pss.dexLogoWrap}>
          <Image source={dexLogos[pool.dex]} style={pss.dexLogo} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={pss.dexName}>{pool.dex.charAt(0).toUpperCase() + pool.dex.slice(1)}</Text>
          <Text style={pss.poolMeta}>Fee: {pool.feeTier.toFixed(2)}% | TVL: {tvlFormatted}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={pss.yieldText}>{yield24h.toFixed(3)}%</Text>
          <Text style={pss.yieldLabel}>24h Yield</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const pss = StyleSheet.create({
  card: { backgroundColor: '#0d1d30', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1a3050', marginBottom: 8 },
  cardSelected: { borderColor: 'rgba(126,200,232,0.5)', backgroundColor: 'rgba(126,200,232,0.05)' },
  bestRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  bestDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7ec8e8' },
  bestLabel: { color: '#7ec8e8', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  mainRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dexLogoWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1a3050', alignItems: 'center', justifyContent: 'center' },
  dexLogo: { width: 28, height: 28, borderRadius: 6 },
  dexName: { color: '#e0e8f0', fontSize: 15, fontWeight: '600' },
  poolMeta: { color: '#5a7090', fontSize: 12, marginTop: 4 },
  yieldText: { color: '#7ec8e8', fontSize: 20, fontWeight: '800' },
  yieldLabel: { color: '#5a7090', fontSize: 11 },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, backgroundColor: '#0d1d30', borderWidth: 1, borderColor: 'transparent', marginBottom: 6 },
  compactSelected: { borderColor: 'rgba(126,200,232,0.5)', backgroundColor: 'rgba(126,200,232,0.1)' },
  compactLogo: { width: 28, height: 28, borderRadius: 8 },
  compactDex: { color: '#e0e8f0', fontSize: 14, fontWeight: '600' },
  compactTvl: { color: '#5a7090', fontSize: 11 },
  compactYield: { color: '#7ec8e8', fontSize: 13, fontWeight: '700' },
  bestBadge: { backgroundColor: 'rgba(126,200,232,0.15)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  bestBadgeText: { color: '#7ec8e8', fontSize: 9, fontWeight: '700' },
});

// ---------- Main Home Screen ----------
export function HomeScreen({ navigation }: any) {
  const { connected, connect, publicKey } = useWallet();
  const [tokenA, setTokenA] = useState<Token>(TOKENS[0]);
  const [tokenB, setTokenB] = useState<Token>(TOKENS[1]);
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [bestPool, setBestPool] = useState<Pool | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRebalance, setAutoRebalance] = useState(true);
  const [privacy, setPrivacy] = useState(true);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [tokenPrices, setTokenPrices] = useState({ tokenA: 0, tokenB: 0 });
  const [openDropdown, setOpenDropdown] = useState<'a' | 'b' | null>(null);
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({});

  const debounceA = useRef<NodeJS.Timeout | null>(null);
  const debounceB = useRef<NodeJS.Timeout | null>(null);
  const lastEditRef = useRef<'a' | 'b' | null>(null);

  // Fetch token balances when wallet connects
  useEffect(() => {
    if (!connected || !publicKey) {
      setTokenBalances({});
      return;
    }
    // Fetch SOL + SPL balances via RPC
    const fetchBalances = async () => {
      try {
        const rpcUrl = process.env.EXPO_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
        // SOL balance
        const solRes = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [publicKey.toBase58()] }),
        });
        const solData = await solRes.json();
        const balances: Record<string, number> = {};
        if (solData.result?.value) {
          balances['SOL'] = solData.result.value / 1e9;
        }

        // SOL rent reserve applied separately for max/validation, not display

        // SPL token balances
        const splRes = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 2, method: 'getTokenAccountsByOwner',
            params: [publicKey.toBase58(), { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding: 'jsonParsed' }],
          }),
        });
        const splData = await splRes.json();
        if (splData.result?.value) {
          for (const acct of splData.result.value) {
            const info = acct.account?.data?.parsed?.info;
            if (!info) continue;
            const mint = info.mint;
            const uiAmount = info.tokenAmount?.uiAmount ?? 0;
            const token = TOKENS.find(t => t.mint === mint);
            if (token && uiAmount > 0) {
              balances[token.symbol] = uiAmount;
            }
          }
        }
        setTokenBalances(balances);
      } catch (err) {
        console.error('[Balance] Failed to fetch:', err);
      }
    };
    fetchBalances();
  }, [connected, publicKey]);

  // Fetch token prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const idA = COINGECKO_IDS[tokenA.symbol];
        const idB = COINGECKO_IDS[tokenB.symbol];
        const ids = [idA, idB].filter(Boolean).join(',');
        if (!ids) return;
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
        const data = await res.json();
        setTokenPrices({
          tokenA: idA ? (data[idA]?.usd || 0) : (tokenA.symbol === 'USDC' ? 1 : 0),
          tokenB: idB ? (data[idB]?.usd || 0) : (tokenB.symbol === 'USDC' ? 1 : 0),
        });
      } catch {
        setTokenPrices({ tokenA: 0, tokenB: 0 });
      }
    };
    fetchPrices();
  }, [tokenA, tokenB]);

  // #1: Clear both when either is emptied. #2: sanitize. #3: debounced calc
  const handleAmountAChange = (val: string) => {
    setAmountA(val);
    lastEditRef.current = 'a';
    if (!val || val === '0' || val === '0.') {
      setAmountB('');
      return;
    }
    if (debounceA.current) clearTimeout(debounceA.current);
    debounceA.current = setTimeout(() => {
      if (val && tokenPrices.tokenA > 0 && tokenPrices.tokenB > 0) {
        const usdVal = parseFloat(val) * tokenPrices.tokenA;
        setAmountB((usdVal / tokenPrices.tokenB).toFixed(4));
      }
    }, 500);
  };

  const handleAmountBChange = (val: string) => {
    setAmountB(val);
    lastEditRef.current = 'b';
    if (!val || val === '0' || val === '0.') {
      setAmountA('');
      return;
    }
    if (debounceB.current) clearTimeout(debounceB.current);
    debounceB.current = setTimeout(() => {
      if (val && tokenPrices.tokenA > 0 && tokenPrices.tokenB > 0) {
        const usdVal = parseFloat(val) * tokenPrices.tokenB;
        setAmountA((usdVal / tokenPrices.tokenA).toFixed(4));
      }
    }, 500);
  };

  // Show full balance, but max/validation uses rent-adjusted
  const SOL_RENT_RESERVE = 0.003;
  const displayBalanceA = tokenBalances[tokenA.symbol];
  const displayBalanceB = tokenBalances[tokenB.symbol];
  const maxBalanceA = displayBalanceA !== undefined && tokenA.symbol === 'SOL'
    ? Math.max(0, displayBalanceA - SOL_RENT_RESERVE) : displayBalanceA;
  const maxBalanceB = displayBalanceB !== undefined && tokenB.symbol === 'SOL'
    ? Math.max(0, displayBalanceB - SOL_RENT_RESERVE) : displayBalanceB;

  const handleMaxA = () => {
    if (maxBalanceA !== undefined) {
      handleAmountAChange(parseFloat(maxBalanceA.toFixed(4)).toString());
    }
  };
  const handleMaxB = () => {
    if (maxBalanceB !== undefined) {
      handleAmountBChange(parseFloat(maxBalanceB.toFixed(4)).toString());
    }
  };

  const fetchPools = useCallback(async () => {
    if (!tokenA || !tokenB) return;
    setLoading(true);
    try {
      const results = await api.fetchPools(tokenA.symbol, tokenB.symbol);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setPools(results);
      if (results.length > 0) {
        setSelectedPool(results[0]);
        setBestPool(results[0]);
      } else {
        setSelectedPool(null);
        setBestPool(null);
      }
    } catch {
      setPools([]);
      setSelectedPool(null);
    } finally {
      setLoading(false);
    }
  }, [tokenA, tokenB]);

  useEffect(() => { fetchPools(); }, [fetchPools]);

  const alternativePools = pools
    .filter(p => selectedPool ? p.id !== selectedPool.id : true)
    .slice(0, 5);

  const toggleDropdownA = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenDropdown(openDropdown === 'a' ? null : 'a');
  };
  const toggleDropdownB = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenDropdown(openDropdown === 'b' ? null : 'b');
  };

  const parsedA = amountA ? parseFloat(amountA) : 0;
  const parsedB = amountB ? parseFloat(amountB) : 0;
  const insufficientA = displayBalanceA !== undefined && parsedA > displayBalanceA;
  const insufficientB = displayBalanceB !== undefined && parsedB > displayBalanceB;
  const insufficientBalance = (insufficientA || insufficientB) && parsedA > 0 && parsedB > 0;

  const depositDisabled = !connected || !selectedPool || !amountA || !amountB
    || parsedA <= 0 || parsedB <= 0 || insufficientBalance;

  const depositLabel = !connected
    ? 'Connect Wallet'
    : !selectedPool
    ? 'Select Tokens'
    : !amountA || !amountB
    ? 'Enter Amounts'
    : insufficientBalance
    ? 'Insufficient Balance'
    : 'Deposit Liquidity';

  const [depositMessage, setDepositMessage] = useState<string | null>(null);
  const handleDepositPress = () => {
    if (!connected) { connect(); return; }
    if (insufficientBalance) return;
    // Mobile deposits route through backend API (DEX SDKs are server-side only)
    setDepositMessage('Deposits are processed through the Poseidon agent. Feature coming soon.');
    setTimeout(() => setDepositMessage(null), 3000);
  };

  return (
    <ImageBackground source={require('../../assets/poseidon-bg.jpg')} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SharedHeader title="POSEIDON" subtitle="Find the best yields across Solana DEXs" />

        {/* Deposit Card */}
        <View style={{ paddingHorizontal: 20 }}>
        <Card style={styles.depositCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>DEPOSIT LIQUIDITY</Text>
            <TouchableOpacity onPress={fetchPools} activeOpacity={0.6}>
              <Ionicons name="refresh-outline" size={18} color={loading ? colors.accent : '#5a7090'} />
            </TouchableOpacity>
          </View>

          <TokenSelector
            selectedToken={tokenA} onSelect={setTokenA} excludeToken={tokenB}
            label="You provide" amount={amountA} onAmountChange={handleAmountAChange}
            usdPrice={tokenPrices.tokenA} balance={displayBalanceA}
            onMaxPress={handleMaxA} isOpen={openDropdown === 'a'} onToggleOpen={toggleDropdownA}
            tokenBalances={tokenBalances}
          />

          <View style={styles.plusRow}>
            <View style={styles.plusCircle}>
              <Ionicons name="add" size={16} color="#5a7090" />
            </View>
          </View>

          <TokenSelector
            selectedToken={tokenB} onSelect={setTokenB} excludeToken={tokenA}
            label="And" amount={amountB} onAmountChange={handleAmountBChange}
            usdPrice={tokenPrices.tokenB} balance={displayBalanceB}
            onMaxPress={handleMaxB} isOpen={openDropdown === 'b'} onToggleOpen={toggleDropdownB}
            tokenBalances={tokenBalances}
          />

          {tokenPrices.tokenA === 0 || tokenPrices.tokenB === 0 ? (
            <Text style={styles.priceNote}>Price unavailable. Enter both amounts manually.</Text>
          ) : null}

          <View style={{ marginTop: 12 }}>
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.loadingText}>Loading pools...</Text>
              </View>
            ) : selectedPool ? (
              <PoolResultCard pool={selectedPool} selected={true} />
            ) : !loading && pools.length === 0 ? (
              <View style={styles.emptyPool}>
                <Ionicons name="search-outline" size={20} color="#5a7090" />
                <Text style={styles.emptyPoolText}>Select tokens to find pools</Text>
              </View>
            ) : null}
          </View>

          {alternativePools.length > 0 && !loading && (
            <View style={styles.altSection}>
              <TouchableOpacity style={styles.altHeader}
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setShowAlternatives(!showAlternatives); }}
                activeOpacity={0.7}
              >
                <Text style={styles.altTitle}>Alternatives ({alternativePools.length})</Text>
                <Ionicons name={showAlternatives ? 'chevron-up' : 'chevron-down'} size={16} color="#5a7090" />
              </TouchableOpacity>
              {showAlternatives && (
                <View style={{ marginTop: 8 }}>
                  {alternativePools.map(pool => (
                    <PoolResultCard key={pool.id} pool={pool} compact
                      selected={selectedPool?.id === pool.id}
                      onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setSelectedPool(pool); }}
                      isBest={bestPool?.id === pool.id}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.toggleSection}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Auto-Rebalancing</Text>
              <Switch value={autoRebalance}
                onValueChange={(v) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setAutoRebalance(v); }}
                trackColor={{ false: '#1a3050', true: 'rgba(126,200,232,0.4)' }}
                thumbColor={autoRebalance ? '#7ec8e8' : '#5a7090'}
              />
            </View>
            {autoRebalance && (
              <Text style={styles.toggleInfo}>Agent monitors 24/7 and rebalances when price moves out of range.</Text>
            )}

            <View style={[styles.toggleRow, { marginTop: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={privacy ? 'lock-closed' : 'lock-open-outline'} size={14} color={privacy ? '#7ec8e8' : '#5a7090'} />
                <Text style={styles.toggleLabel}>Private Position</Text>
              </View>
              <Switch value={privacy}
                onValueChange={(v) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setPrivacy(v); }}
                trackColor={{ false: '#1a3050', true: 'rgba(126,200,232,0.4)' }}
                thumbColor={privacy ? '#7ec8e8' : '#5a7090'}
              />
            </View>
            {privacy && (
              <View style={styles.privacyBadge}>
                <Ionicons name="shield-checkmark" size={10} color="#7ec8e8" />
                <Text style={styles.privacyBadgeText}>Encrypted with Arcium</Text>
              </View>
            )}
          </View>

          {parsedA > 0 && connected && selectedPool && (
            <View style={styles.feeSection}>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Network fee</Text>
                <Text style={styles.feeValue}>~0.00025 SOL</Text>
              </View>
              {privacy && (
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Privacy fee</Text>
                  <Text style={styles.feeValue}>{(parsedA * tokenPrices.tokenA * 0.001).toFixed(4)} USD</Text>
                </View>
              )}
              {autoRebalance && (
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Rebalance fee</Text>
                  <Text style={styles.feeValue}>5% of earned fees</Text>
                </View>
              )}
            </View>
          )}

          {depositMessage && (
            <View style={{ backgroundColor: 'rgba(126,200,232,0.1)', borderRadius: 10, padding: 12, marginTop: 12 }}>
              <Text style={{ color: '#7ec8e8', fontSize: 12, textAlign: 'center' }}>{depositMessage}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.depositBtn, depositDisabled && connected && styles.depositBtnDisabled]}
            activeOpacity={0.8} onPress={handleDepositPress}
          >
            <Text style={[styles.depositBtnText, depositDisabled && connected && styles.depositBtnTextDisabled]}>
              {depositLabel}
            </Text>
          </TouchableOpacity>
        </Card>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  container: { flex: 1 },
  content: { paddingBottom: 40, paddingTop: 0 },

  depositCard: { marginBottom: 20, paddingBottom: 0, overflow: 'visible' },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1a3050', marginBottom: 12,
  },
  cardTitle: { color: '#e0e8f0', fontSize: 16, fontWeight: '700', letterSpacing: 1 },

  plusRow: { alignItems: 'center', marginVertical: -4, zIndex: 10 },
  plusCircle: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#0a1520',
    borderWidth: 1, borderColor: '#1a3050', alignItems: 'center', justifyContent: 'center',
  },

  priceNote: { color: '#5a7090', fontSize: 10, marginTop: 4 },
  loadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  loadingText: { color: '#5a7090', fontSize: 12 },
  emptyPool: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#0d1d30', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1a3050',
  },
  emptyPoolText: { color: '#5a7090', fontSize: 13 },

  altSection: { borderTopWidth: 1, borderTopColor: '#1a3050', marginTop: 12, paddingTop: 8 },
  altHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  altTitle: { color: '#8899aa', fontSize: 13, fontWeight: '600' },

  toggleSection: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1a3050' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { color: '#e0e8f0', fontSize: 14, fontWeight: '500' },
  toggleInfo: { color: '#5a7090', fontSize: 11, marginTop: 4, lineHeight: 16 },
  privacyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  privacyBadgeText: { color: '#7ec8e8', fontSize: 11 },

  feeSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1a3050' },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  feeLabel: { color: '#5a7090', fontSize: 12 },
  feeValue: { color: '#8899aa', fontSize: 12 },

  depositBtn: { backgroundColor: '#7ec8e8', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16, marginBottom: 16 },
  depositBtnDisabled: { backgroundColor: '#0d1d30', borderWidth: 1, borderColor: '#1a3050' },
  depositBtnText: { color: '#0a1520', fontSize: 16, fontWeight: '700' },
  depositBtnTextDisabled: { color: '#5a7090' },
});
