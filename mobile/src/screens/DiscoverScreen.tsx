import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, RefreshControl, ImageBackground, Image, ImageSourcePropType,
} from 'react-native';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { LoadingState, ErrorState } from '../components/LoadingState';
import { api, Pool } from '../api/client';
import { useApi } from '../hooks/useApi';

const DEX_LOGOS: Record<string, ImageSourcePropType> = {
  Meteora: require('../../assets/meteora-logo.png'),
  Orca: require('../../assets/orca-logo.png'),
  Raydium: require('../../assets/raydium-logo.png'),
};

// Mock data fallback
const MOCK_POOLS: Pool[] = [
  { id: '1', tokenA: 'SOL', tokenB: 'USDC', dex: 'Meteora', yield24h: 45.2, tvl: 12500000, volume24h: 3200000, score: 92, feeTier: 0.25 },
  { id: '2', tokenA: 'SOL', tokenB: 'USDT', dex: 'Orca', yield24h: 38.7, tvl: 8700000, volume24h: 2100000, score: 87, feeTier: 0.30 },
  { id: '3', tokenA: 'JUP', tokenB: 'SOL', dex: 'Raydium', yield24h: 62.1, tvl: 4300000, volume24h: 1800000, score: 78, feeTier: 0.50 },
  { id: '4', tokenA: 'BONK', tokenB: 'SOL', dex: 'Meteora', yield24h: 120.5, tvl: 2100000, volume24h: 980000, score: 65, feeTier: 1.00 },
  { id: '5', tokenA: 'WIF', tokenB: 'USDC', dex: 'Orca', yield24h: 85.3, tvl: 1500000, volume24h: 620000, score: 71, feeTier: 0.50 },
];

function formatNum(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function DiscoverScreen() {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Try API, fall back to mock
  const { data: pools, loading, error, refresh } = useApi(async () => {
    try {
      return await api.fetchPools();
    } catch {
      return MOCK_POOLS;
    }
  });

  const filtered = (pools || MOCK_POOLS).filter(p => {
    if (!search) return true;
    const s = search.toUpperCase();
    return p.tokenA.includes(s) || p.tokenB.includes(s) || p.dex.toUpperCase().includes(s);
  });

  return (
    <ImageBackground source={require('../../assets/poseidon-bg.jpg')} style={styles.bg} resizeMode="cover">
    <View style={styles.container}>
      <Text style={styles.title}>DISCOVER POOLS</Text>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by token or DEX..."
          placeholderTextColor={colors.text.faint}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <LoadingState message="Fetching pools..." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.accent} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.8} onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}>
              <Card>
                <View style={styles.poolHeader}>
                  <View style={styles.poolLeft}>
                    <View style={styles.dexBadge}>
                      {DEX_LOGOS[item.dex] ? (
                        <Image source={DEX_LOGOS[item.dex]} style={styles.dexLogo} />
                      ) : (
                        <Text style={styles.dexBadgeText}>{item.dex.charAt(0)}</Text>
                      )}
                    </View>
                    <View>
                      <Text style={styles.poolPair}>{item.tokenA}/{item.tokenB}</Text>
                      <Text style={styles.poolDex}>{item.dex}</Text>
                    </View>
                  </View>
                  <View style={styles.poolRight}>
                    <Text style={styles.poolYield}>{item.yield24h.toFixed(1)}% APY</Text>
                    <View style={[styles.scoreBadge, { backgroundColor: item.score >= 80 ? colors.success + '30' : colors.warning + '30' }]}>
                      <Text style={[styles.scoreText, { color: item.score >= 80 ? colors.success : colors.warning }]}>
                        {item.score}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.poolStats}>
                  <Text style={styles.poolStat}>TVL {formatNum(item.tvl)}</Text>
                  <Text style={styles.poolStat}>Vol {formatNum(item.volume24h)}</Text>
                  <Text style={styles.poolStat}>Fee {item.feeTier}%</Text>
                </View>

                {expandedId === item.id && (
                  <View style={styles.expanded}>
                    <View style={styles.expandedStats}>
                      <View style={styles.expandedStat}>
                        <Text style={styles.expandedLabel}>24h Volume</Text>
                        <Text style={styles.expandedValue}>{formatNum(item.volume24h)}</Text>
                      </View>
                      <View style={styles.expandedStat}>
                        <Text style={styles.expandedLabel}>Fee Tier</Text>
                        <Text style={styles.expandedValue}>{item.feeTier}%</Text>
                      </View>
                      <View style={styles.expandedStat}>
                        <Text style={styles.expandedLabel}>Score</Text>
                        <Text style={styles.expandedValue}>{item.score}/100</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.depositBtn} activeOpacity={0.8}>
                      <Text style={styles.depositText}>Deposit</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  container: { flex: 1, paddingTop: 60 },
  title: { fontSize: 18, fontWeight: '900', color: colors.accent, letterSpacing: 2, paddingHorizontal: 20, marginBottom: 16 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg.elevated, borderRadius: 12, marginHorizontal: 20, marginBottom: 16,
    paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border.subtle,
  },
  searchInput: { flex: 1, color: colors.text.primary, fontSize: 15, paddingVertical: 14 },
  poolHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  poolLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dexBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  dexLogo: { width: 36, height: 36, borderRadius: 18 },
  dexBadgeText: { fontSize: 16, fontWeight: '800', color: colors.accent },
  poolPair: { color: colors.text.primary, fontSize: 17, fontWeight: '700' },
  poolDex: { color: colors.text.faint, fontSize: 12 },
  poolRight: { alignItems: 'flex-end' },
  poolYield: { color: colors.success, fontSize: 16, fontWeight: '800' },
  scoreBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  scoreText: { fontSize: 12, fontWeight: '700' },
  poolStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  poolStat: { color: colors.text.muted, fontSize: 12 },
  expanded: { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border.subtle, paddingTop: 12 },
  expandedStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  expandedStat: { alignItems: 'center' },
  expandedLabel: { color: colors.text.faint, fontSize: 11 },
  expandedValue: { color: colors.text.primary, fontSize: 14, fontWeight: '600', marginTop: 2 },
  depositBtn: {
    backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  depositText: { color: colors.bg.deep, fontSize: 15, fontWeight: '800' },
});
