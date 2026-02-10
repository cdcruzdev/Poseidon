import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ImageBackground, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { ConnectWalletButton } from '../components/ConnectWalletButton';
import { useWallet } from '../contexts/WalletContext';
import { api, Pool } from '../api/client';

const POPULAR_PAIRS = [
  { tokenA: 'SOL', tokenB: 'USDC' },
  { tokenA: 'SOL', tokenB: 'USDT' },
  { tokenA: 'JUP', tokenB: 'SOL' },
  { tokenA: 'BONK', tokenB: 'SOL' },
];

function formatNum(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function HomeScreen({ navigation }: any) {
  const { connected } = useWallet();
  const [tokenA, setTokenA] = useState('SOL');
  const [tokenB, setTokenB] = useState('USDC');
  const [amount, setAmount] = useState('');
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [autoRebalance, setAutoRebalance] = useState(true);
  const [privacy, setPrivacy] = useState(false);

  const fetchPools = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const results = await api.fetchPools(tokenA, tokenB);
      setPools(results);
    } catch {
      // API not available — show empty state
      setPools([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on pair change
  useEffect(() => {
    if (tokenA && tokenB && tokenA !== tokenB) {
      fetchPools();
    }
  }, [tokenA, tokenB]);

  const selectPair = (a: string, b: string) => {
    setTokenA(a);
    setTokenB(b);
  };

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

        {/* Tagline */}
        <Text style={styles.tagline}>Find the best yields across Solana DEXs</Text>

        {/* Token Pair Selector */}
        <Card style={styles.depositCard}>
          <Text style={styles.cardTitle}>DEPOSIT LIQUIDITY</Text>

          <View style={styles.tokenRow}>
            <View style={styles.tokenInput}>
              <Text style={styles.inputLabel}>Token A</Text>
              <TextInput
                style={styles.tokenField}
                value={tokenA}
                onChangeText={setTokenA}
                placeholderTextColor={colors.text.faint}
                autoCapitalize="characters"
              />
            </View>
            <Ionicons name="swap-horizontal" size={20} color={colors.text.faint} style={styles.swapIcon} />
            <View style={styles.tokenInput}>
              <Text style={styles.inputLabel}>Token B</Text>
              <TextInput
                style={styles.tokenField}
                value={tokenB}
                onChangeText={setTokenB}
                placeholderTextColor={colors.text.faint}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* Quick Pairs */}
          <View style={styles.quickPairs}>
            {POPULAR_PAIRS.map((pair) => (
              <TouchableOpacity
                key={`${pair.tokenA}-${pair.tokenB}`}
                style={[
                  styles.pairChip,
                  tokenA === pair.tokenA && tokenB === pair.tokenB && styles.pairChipActive,
                ]}
                onPress={() => selectPair(pair.tokenA, pair.tokenB)}
              >
                <Text style={[
                  styles.pairChipText,
                  tokenA === pair.tokenA && tokenB === pair.tokenB && styles.pairChipTextActive,
                ]}>
                  {pair.tokenA}/{pair.tokenB}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount */}
          <View style={styles.amountRow}>
            <Text style={styles.inputLabel}>Amount (USD)</Text>
            <TextInput
              style={styles.amountField}
              value={amount}
              onChangeText={setAmount}
              placeholder="1,000"
              placeholderTextColor={colors.text.faint}
              keyboardType="numeric"
            />
          </View>

          {/* Toggles */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggle, autoRebalance && styles.toggleActive]}
              onPress={() => setAutoRebalance(!autoRebalance)}
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

            <TouchableOpacity
              style={[styles.toggle, privacy && styles.toggleActive]}
              onPress={() => setPrivacy(!privacy)}
            >
              <Ionicons
                name={privacy ? 'shield-checkmark' : 'shield-outline'}
                size={18}
                color={privacy ? colors.accent : colors.text.faint}
              />
              <Text style={[styles.toggleText, privacy && styles.toggleTextActive]}>
                Privacy
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Pool Results */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Scanning DEXs...</Text>
          </View>
        ) : searched && pools.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>BEST POOLS FOR {tokenA}/{tokenB}</Text>
            {pools.map((pool) => (
              <Card key={pool.id} style={styles.poolCard}>
                <View style={styles.poolHeader}>
                  <View>
                    <Text style={styles.poolDex}>{pool.dex}</Text>
                    <Text style={styles.poolPair}>{pool.tokenA}/{pool.tokenB}</Text>
                  </View>
                  <View style={styles.poolRight}>
                    <Text style={styles.poolYield}>{pool.yield24h.toFixed(1)}% APY</Text>
                    <View style={[styles.scoreBadge, { backgroundColor: pool.score >= 80 ? colors.success + '30' : colors.warning + '30' }]}>
                      <Text style={[styles.scoreText, { color: pool.score >= 80 ? colors.success : colors.warning }]}>
                        Score: {pool.score}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.poolStats}>
                  <Text style={styles.poolStat}>TVL {formatNum(pool.tvl)}</Text>
                  <Text style={styles.poolStat}>Vol {formatNum(pool.volume24h)}</Text>
                  <Text style={styles.poolStat}>Fee {pool.feeTier}%</Text>
                </View>
                <TouchableOpacity
                  style={[styles.depositBtn, !connected && styles.depositBtnDisabled]}
                  activeOpacity={0.8}
                  disabled={!connected}
                >
                  <Text style={styles.depositBtnText}>
                    {connected ? 'Deposit' : 'Connect Wallet to Deposit'}
                  </Text>
                </TouchableOpacity>
              </Card>
            ))}
          </>
        ) : searched && pools.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="search-outline" size={32} color={colors.text.faint} />
            <Text style={styles.emptyText}>
              {loading ? 'Scanning...' : 'No pools found. Make sure the agent API is running.'}
            </Text>
          </Card>
        ) : null}
      </ScrollView>
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

  depositCard: { marginBottom: 20 },
  cardTitle: { color: colors.text.muted, fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 16 },

  tokenRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  tokenInput: { flex: 1 },
  inputLabel: { color: colors.text.faint, fontSize: 11, fontWeight: '600', marginBottom: 6 },
  tokenField: {
    backgroundColor: colors.bg.deep,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  swapIcon: { paddingBottom: 14 },

  quickPairs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  pairChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.bg.deep,
  },
  pairChipActive: { borderColor: colors.accent, backgroundColor: colors.accent + '15' },
  pairChipText: { color: colors.text.faint, fontSize: 12, fontWeight: '600' },
  pairChipTextActive: { color: colors.accent },

  amountRow: { marginBottom: 16 },
  amountField: {
    backgroundColor: colors.bg.deep,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },

  toggleRow: { flexDirection: 'row', gap: 12 },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.bg.deep,
  },
  toggleActive: { borderColor: colors.accent + '60', backgroundColor: colors.accent + '10' },
  toggleText: { color: colors.text.faint, fontSize: 13, fontWeight: '600' },
  toggleTextActive: { color: colors.accent },

  loadingWrap: { alignItems: 'center', marginTop: 32, gap: 12 },
  loadingText: { color: colors.text.muted, fontSize: 14 },

  sectionTitle: {
    color: colors.text.muted, fontSize: 12, fontWeight: '700',
    letterSpacing: 2, marginBottom: 12,
  },

  poolCard: { marginBottom: 12 },
  poolHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  poolDex: { color: colors.text.faint, fontSize: 11, fontWeight: '600' },
  poolPair: { color: colors.text.primary, fontSize: 17, fontWeight: '700' },
  poolRight: { alignItems: 'flex-end' },
  poolYield: { color: colors.success, fontSize: 16, fontWeight: '800' },
  scoreBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  scoreText: { fontSize: 12, fontWeight: '700' },
  poolStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 12 },
  poolStat: { color: colors.text.muted, fontSize: 12 },

  depositBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  depositBtnDisabled: { backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.subtle },
  depositBtnText: { color: colors.bg.deep, fontSize: 15, fontWeight: '800' },

  emptyCard: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyText: { color: colors.text.faint, fontSize: 14, textAlign: 'center' },
});
