import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ImageBackground, RefreshControl, StatusBar,
} from 'react-native';
// StatusBar.currentHeight used for safe area padding
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { StatusDot } from '../components/StatusDot';
import { SharedHeader } from '../components/SharedHeader';
import { ConnectWalletButton } from '../components/ConnectWalletButton';
import { useWallet } from '../contexts/WalletContext';

const DEX_LOGOS: Record<string, any> = {
  Meteora: require('../../assets/meteora-logo.png'),
  meteora: require('../../assets/meteora-logo.png'),
  Orca: require('../../assets/orca-logo.png'),
  orca: require('../../assets/orca-logo.png'),
  Raydium: require('../../assets/raydium-logo.png'),
  raydium: require('../../assets/raydium-logo.png'),
};

// Position data will come from the API when wallet is connected
interface Position {
  id: string;
  pair: string;
  value: number;
  pnl: number;
  status: 'in_range' | 'out_of_range';
  dex: string;
  feesEarned: number;
  autoRebalance: boolean;
}

export function PositionsScreen({ navigation }: any) {
  const statusBarHeight = StatusBar.currentHeight || 24;
  const { connected } = useWallet();
  const [refreshing, setRefreshing] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Fetch real positions from API
    await new Promise(r => setTimeout(r, 500));
    setRefreshing(false);
  };

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const totalFees = positions.reduce((s, p) => s + p.feesEarned, 0);

  if (!connected) {
    return (
      <ImageBackground source={require('../../assets/poseidon-bg.jpg')} style={styles.bg} resizeMode="cover">
        <LinearGradient colors={['rgba(6,14,24,0.95)', 'rgba(6,14,24,0.7)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: statusBarHeight + 20, zIndex: 10 }} pointerEvents="none" />
        <View style={styles.emptyContainer}>
          <SharedHeader title="POSITIONS" subtitle="Your active LP positions across DEXs" />
          <View style={styles.emptyContent}>
            <Ionicons name="wallet-outline" size={48} color={colors.text.faint} />
            <Text style={styles.emptyTitle}>Connect Your Wallet</Text>
            <Text style={styles.emptySubtitle}>Connect a wallet to view your LP positions</Text>
            <ConnectWalletButton />
          </View>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={require('../../assets/poseidon-bg.jpg')} style={styles.bg} resizeMode="cover">
      <LinearGradient colors={['rgba(6,14,24,0.95)', 'rgba(6,14,24,0.7)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: statusBarHeight + 20, zIndex: 10 }} pointerEvents="none" />
      <View style={styles.container}>
        <SharedHeader title="POSITIONS" subtitle="Your active LP positions across DEXs" />

        {positions.length === 0 ? (
          <View style={styles.emptyContent}>
            <Ionicons name="layers-outline" size={48} color={colors.text.faint} />
            <Text style={styles.emptyTitle}>No Positions Yet</Text>
            <Text style={styles.emptySubtitle}>
              Deposit liquidity from the Home tab to get started
            </Text>
          </View>
        ) : (
          <>
            {/* Summary Card */}
            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryLabel}>Total Value</Text>
                  <Text style={styles.summaryValue}>
                    ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryLabel}>Fees Earned</Text>
                  <Text style={[styles.summaryValue, { color: colors.success }]}>
                    ${totalFees.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryLabel}>Active</Text>
                  <Text style={styles.summaryValue}>{positions.length}</Text>
                </View>
              </View>
            </Card>

            {/* Position List */}
            <FlatList
              data={positions}
              keyExtractor={item => item.id}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
              }
              contentContainerStyle={{ paddingBottom: 100 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('PositionDetail', { position: item })}
                >
                  <Card style={styles.positionCard}>
                    <View style={styles.positionHeader}>
                      <View>
                        <Text style={styles.positionPair}>{item.pair}</Text>
                        <View style={styles.dexRow}>
                          {DEX_LOGOS[item.dex] && (
                            <Image source={DEX_LOGOS[item.dex]} style={styles.dexLogo} />
                          )}
                          <Text style={styles.positionDex}>{item.dex}</Text>
                        </View>
                      </View>
                      <View style={styles.positionRight}>
                        <StatusDot status={item.status} />
                        <Text style={styles.positionStatus}>
                          {item.status === 'in_range' ? 'In Range' : 'Out of Range'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.positionStats}>
                      <View>
                        <Text style={styles.posStatLabel}>Value</Text>
                        <Text style={styles.posStatValue}>${item.value.toFixed(2)}</Text>
                      </View>
                      <View>
                        <Text style={styles.posStatLabel}>PnL</Text>
                        <Text style={[styles.posStatValue, { color: item.pnl >= 0 ? colors.success : colors.danger }]}>
                          {item.pnl >= 0 ? '+' : ''}{item.pnl.toFixed(1)}%
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.posStatLabel}>Fees</Text>
                        <Text style={[styles.posStatValue, { color: colors.success }]}>
                          ${item.feesEarned.toFixed(2)}
                        </Text>
                      </View>
                      {/* TODO: Re-enable rebalance badge when per-position program is funded
                      <View style={styles.rebalanceBadge}>
                        <Ionicons
                          name={item.autoRebalance ? 'sync-circle' : 'sync-circle-outline'}
                          size={16}
                          color={item.autoRebalance ? colors.accent : colors.text.faint}
                        />
                      </View>
                      */}
                    </View>
                  </Card>
                </TouchableOpacity>
              )}
            />
          </>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  container: { flex: 1 },
  emptyContainer: { flex: 1 },

  emptyContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingBottom: 100, paddingHorizontal: 20 },
  emptyTitle: { color: colors.text.primary, fontSize: 20, fontWeight: '700' },
  emptySubtitle: { color: colors.text.muted, fontSize: 14, textAlign: 'center', maxWidth: 260 },

  summaryCard: { marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryStat: { alignItems: 'center' },
  summaryLabel: { color: colors.text.faint, fontSize: 11, marginBottom: 4 },
  summaryValue: { color: colors.text.primary, fontSize: 18, fontWeight: '800' },

  positionCard: { marginBottom: 10 },
  positionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  positionPair: { color: colors.text.primary, fontSize: 17, fontWeight: '700' },
  dexRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dexLogo: { width: 14, height: 14, borderRadius: 7 },
  positionDex: { color: colors.text.faint, fontSize: 12 },
  positionRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  positionStatus: { color: colors.text.muted, fontSize: 12 },

  positionStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  posStatLabel: { color: colors.text.faint, fontSize: 11 },
  posStatValue: { color: colors.text.primary, fontSize: 15, fontWeight: '700', marginTop: 2 },
  rebalanceBadge: { padding: 4 },
});
