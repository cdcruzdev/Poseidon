import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
} from 'react-native';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { api, AgentAction } from '../api/client';
import { useApi } from '../hooks/useApi';

const typeColors: Record<string, string> = {
  rebalance: colors.accent,
  fee_collection: colors.success,
  alert: colors.warning,
  deposit: colors.accent,
  withdraw: colors.danger,
};

const typeIcons: Record<string, string> = {
  rebalance: '🔄',
  fee_collection: '💰',
  alert: '⚠️',
  deposit: '💧',
  withdraw: '📤',
};

const MOCK_FEED: AgentAction[] = [
  { id: '1', type: 'rebalance', description: 'Rebalanced SOL/USDC position to $95.20 - $105.80', timestamp: '2025-02-09T10:30:00Z' },
  { id: '2', type: 'fee_collection', description: 'Collected $4.20 fees from SOL/USDC', timestamp: '2025-02-09T10:15:00Z' },
  { id: '3', type: 'alert', description: 'SOL/USDT position approaching range boundary', timestamp: '2025-02-09T09:45:00Z' },
  { id: '4', type: 'rebalance', description: 'Rebalanced JUP/SOL position to $0.82 - $1.15', timestamp: '2025-02-09T09:00:00Z' },
  { id: '5', type: 'fee_collection', description: 'Collected $1.80 fees from JUP/SOL', timestamp: '2025-02-09T08:30:00Z' },
  { id: '6', type: 'rebalance', description: 'Rebalanced SOL/USDC position to $94.50 - $106.20', timestamp: '2025-02-09T07:15:00Z' },
  { id: '7', type: 'fee_collection', description: 'Collected $3.10 fees from SOL/USDT', timestamp: '2025-02-09T06:00:00Z' },
  { id: '8', type: 'alert', description: 'High volatility detected for BONK/SOL', timestamp: '2025-02-09T04:30:00Z' },
];

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  } catch {
    return ts;
  }
}

export function AgentFeedScreen() {
  const { data: feed, loading, refresh } = useApi(async () => {
    try {
      return await api.fetchAgentActivity();
    } catch {
      return MOCK_FEED;
    }
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const items = feed || MOCK_FEED;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🤖 AGENT FEED</Text>
      <Text style={styles.subtitle}>Real-time actions from your Poseidon agent</Text>

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        renderItem={({ item, index }) => (
          <View style={styles.feedItem}>
            {/* Timeline line */}
            {index < items.length - 1 && <View style={styles.timelineLine} />}

            <View style={[styles.iconCircle, { backgroundColor: (typeColors[item.type] || colors.text.muted) + '20' }]}>
              <Text style={styles.icon}>{typeIcons[item.type] || '📋'}</Text>
            </View>

            <Card style={styles.feedCard}>
              <Text style={[styles.feedType, { color: typeColors[item.type] || colors.text.muted }]}>
                {item.type.replace('_', ' ').toUpperCase()}
              </Text>
              <Text style={styles.feedDesc}>{item.description}</Text>
              <Text style={styles.feedTime}>{formatTime(item.timestamp)}</Text>
            </Card>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.deep, paddingTop: 60 },
  title: { fontSize: 18, fontWeight: '900', color: colors.accent, letterSpacing: 2, paddingHorizontal: 20 },
  subtitle: { color: colors.text.faint, fontSize: 13, paddingHorizontal: 20, marginBottom: 20, marginTop: 4 },
  feedItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, position: 'relative' },
  timelineLine: {
    position: 'absolute', left: 19, top: 40, bottom: -4, width: 2,
    backgroundColor: colors.border.subtle,
  },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  icon: { fontSize: 18 },
  feedCard: { flex: 1 },
  feedType: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  feedDesc: { color: colors.text.secondary, fontSize: 14, lineHeight: 20 },
  feedTime: { color: colors.text.faint, fontSize: 11, marginTop: 6 },
});
