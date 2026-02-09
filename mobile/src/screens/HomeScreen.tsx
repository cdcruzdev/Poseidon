import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ImageBackground, RefreshControl, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { StatusDot } from '../components/StatusDot';
import { ConnectWalletButton } from '../components/ConnectWalletButton';
import { useWallet } from '../contexts/WalletContext';

// Mock positions data (would come from wallet/API in production)
const MOCK_POSITIONS = [
  { id: '1', pair: 'SOL/USDC', value: 2450.80, pnl: 5.2, status: 'in_range' as const, dex: 'Meteora' },
  { id: '2', pair: 'SOL/USDT', value: 1200.00, pnl: -1.8, status: 'out_of_range' as const, dex: 'Orca' },
  { id: '3', pair: 'JUP/SOL', value: 890.50, pnl: 12.3, status: 'in_range' as const, dex: 'Raydium' },
];

export function HomeScreen({ navigation }: any) {
  const { publicKey, connected } = useWallet();
  const [refreshing, setRefreshing] = useState(false);

  const totalValue = MOCK_POSITIONS.reduce((s, p) => s + p.value, 0);
  const avgPnl = MOCK_POSITIONS.reduce((s, p) => s + p.pnl, 0) / MOCK_POSITIONS.length;

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 1000));
    setRefreshing(false);
  };

  return (
    <ImageBackground
      source={require('../../assets/poseidon-bg.jpg')}
      style={styles.bg}
      resizeMode="cover"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>POSEIDON</Text>
          <ConnectWalletButton />
        </View>

        {/* Portfolio Card */}
        <Card style={styles.portfolioCard}>
          <Text style={styles.portfolioLabel}>Total Portfolio Value</Text>
          <Text style={styles.portfolioValue}>${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
          <View style={styles.portfolioRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>24h PnL</Text>
              <Text style={[styles.statValue, { color: avgPnl >= 0 ? colors.success : colors.danger }]}>
                {avgPnl >= 0 ? '+' : ''}{avgPnl.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Fees Earned</Text>
              <Text style={[styles.statValue, { color: colors.success }]}>$34.20</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Positions</Text>
              <Text style={styles.statValue}>{MOCK_POSITIONS.length}</Text>
            </View>
          </View>
        </Card>

        {/* CTA */}
        <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.8}>
          <Text style={styles.ctaText}>Deposit Liquidity</Text>
        </TouchableOpacity>

        {/* Positions */}
        <Text style={styles.sectionTitle}>YOUR POSITIONS</Text>
        <FlatList
          horizontal
          data={MOCK_POSITIONS}
          keyExtractor={item => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('PositionDetail', { position: item })}
            >
              <Card style={styles.positionCard}>
                <View style={styles.positionHeader}>
                  <Text style={styles.positionPair}>{item.pair}</Text>
                  <StatusDot status={item.status} />
                </View>
                <Text style={styles.positionDex}>{item.dex}</Text>
                <Text style={styles.positionValue}>${item.value.toFixed(2)}</Text>
                <Text style={[styles.positionPnl, { color: item.pnl >= 0 ? colors.success : colors.danger }]}>
                  {item.pnl >= 0 ? '↑' : '↓'} {Math.abs(item.pnl)}%
                </Text>
              </Card>
            </TouchableOpacity>
          )}
        />
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  logo: { fontSize: 22, fontWeight: '900', color: colors.accent, letterSpacing: 2 },
  walletBtn: {
    backgroundColor: colors.bg.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  walletText: { color: colors.text.primary, fontSize: 13, fontWeight: '600' },
  portfolioCard: { marginBottom: 16 },
  portfolioLabel: { color: colors.text.muted, fontSize: 13, marginBottom: 4 },
  portfolioValue: { color: colors.text.primary, fontSize: 36, fontWeight: '800', letterSpacing: 1 },
  portfolioRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  stat: { alignItems: 'center' },
  statLabel: { color: colors.text.faint, fontSize: 11, marginBottom: 4 },
  statValue: { color: colors.text.primary, fontSize: 16, fontWeight: '700' },
  ctaBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  ctaText: { color: colors.bg.deep, fontSize: 17, fontWeight: '800', letterSpacing: 1 },
  sectionTitle: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  positionCard: { width: 160, marginRight: 12 },
  positionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  positionPair: { color: colors.text.primary, fontSize: 16, fontWeight: '700' },
  positionDex: { color: colors.text.faint, fontSize: 11, marginTop: 2 },
  positionValue: { color: colors.text.primary, fontSize: 18, fontWeight: '700', marginTop: 8 },
  positionPnl: { fontSize: 13, fontWeight: '600', marginTop: 4 },
});
