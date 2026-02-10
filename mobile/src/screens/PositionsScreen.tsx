import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ImageBackground, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { StatusDot } from '../components/StatusDot';
import { ConnectWalletButton } from '../components/ConnectWalletButton';
import { useWallet } from '../contexts/WalletContext';

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
        <View style={styles.emptyContainer}>
          <Text style={styles.logo}>POSEIDON</Text>
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
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>POSITIONS</Text>
          <ConnectWalletButton />
        </View>

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
                        <Text style={styles.positionDex}>{item.dex}</Text>
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
                      <View style={styles.rebalanceBadge}>
                        <Ionicons
                          name={item.autoRebalance ? 'sync-circle' : 'sync-circle-outline'}
                          size={16}
                          color={item.autoRebalance ? colors.accent : colors.text.faint}
                        />
                      </View>
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
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  emptyContainer: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logo: { fontSize: 18, fontWeight: '900', color: colors.accent, letterSpacing: 2 },

  emptyContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingBottom: 100 },
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
  positionDex: { color: colors.text.faint, fontSize: 12, marginTop: 2 },
  positionRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  positionStatus: { color: colors.text.muted, fontSize: 12 },

  positionStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  posStatLabel: { color: colors.text.faint, fontSize: 11 },
  posStatValue: { color: colors.text.primary, fontSize: 15, fontWeight: '700', marginTop: 2 },
  rebalanceBadge: { padding: 4 },
});
