import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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

const typeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  rebalance: 'swap-horizontal',
  fee_collection: 'cash-outline',
  alert: 'alert-circle-outline',
  deposit: 'arrow-down-circle-outline',
  withdraw: 'arrow-up-circle-outline',
};

// No mock data — fetch from API only

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
    return await api.fetchAgentActivity();
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const items = feed || [];

  return (
    <ImageBackground source={require('../../assets/poseidon-bg.jpg')} style={styles.bg} resizeMode="cover">
    <View style={styles.container}>
      <Text style={styles.title}>AGENT FEED</Text>
      <Text style={styles.subtitle}>Real-time actions from your Poseidon agent</Text>

      {items.length === 0 && !loading && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 }}>
          <Ionicons name="pulse-outline" size={48} color={colors.text.faint} />
          <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '700', marginTop: 16 }}>No Activity Yet</Text>
          <Text style={{ color: colors.text.muted, fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
            Agent actions will appear here once you have active positions
          </Text>
        </View>
      )}

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
              <Ionicons name={typeIcons[item.type] || 'ellipse-outline'} size={18} color={typeColors[item.type] || colors.accent} />
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  container: { flex: 1, paddingTop: 60 },
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
  icon: { fontSize: 14, fontWeight: '800', color: colors.accent },
  feedCard: { flex: 1 },
  feedType: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  feedDesc: { color: colors.text.secondary, fontSize: 14, lineHeight: 20 },
  feedTime: { color: colors.text.faint, fontSize: 11, marginTop: 6 },
});
