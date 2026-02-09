import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
} from 'react-native';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { StatusDot } from '../components/StatusDot';

const MOCK_ACTIVITY = [
  { id: '1', type: 'rebalance', description: 'Auto-rebalanced to $95.20 - $105.80', timestamp: '2 min ago' },
  { id: '2', type: 'fee_collection', description: 'Collected $2.45 in fees', timestamp: '1 hr ago' },
  { id: '3', type: 'rebalance', description: 'Auto-rebalanced to $94.00 - $106.50', timestamp: '4 hr ago' },
];

const typeColors: Record<string, string> = {
  rebalance: colors.accent,
  fee_collection: colors.success,
  alert: colors.warning,
};

const typeIcons: Record<string, string> = {
  rebalance: '🔄',
  fee_collection: '💰',
  alert: '⚠️',
};

export function PositionDetailScreen({ route }: any) {
  const { position } = route.params;
  const [autoRebalance, setAutoRebalance] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);

  // Mock range data
  const lowerBound = 92.5;
  const upperBound = 108.3;
  const currentPrice = 100.2;
  const rangePercent = ((currentPrice - lowerBound) / (upperBound - lowerBound)) * 100;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.pair}>{position.pair}</Text>
          <Text style={styles.dex}>{position.dex}</Text>
        </View>
        <StatusDot status={position.status} />
      </View>

      {/* Value */}
      <Card>
        <Text style={styles.valueLabel}>Position Value</Text>
        <Text style={styles.value}>
          {privacyMode ? '••••••' : `$${position.value.toFixed(2)}`}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>PnL</Text>
            <Text style={[styles.statValue, { color: position.pnl >= 0 ? colors.success : colors.danger }]}>
              {position.pnl >= 0 ? '+' : ''}{position.pnl}%
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Yield</Text>
            <Text style={[styles.statValue, { color: colors.success }]}>42.5%</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Fees</Text>
            <Text style={[styles.statValue, { color: colors.success }]}>$12.30</Text>
          </View>
        </View>
      </Card>

      {/* Range Visualization */}
      <Card>
        <Text style={styles.sectionTitle}>PRICE RANGE</Text>
        <View style={styles.rangeBar}>
          <View style={styles.rangeTrack}>
            <View style={[styles.rangeActive, { left: '0%', right: '0%' }]} />
            <View style={[styles.rangeCurrent, { left: `${Math.min(100, Math.max(0, rangePercent))}%` }]} />
          </View>
        </View>
        <View style={styles.rangeBounds}>
          <Text style={styles.boundText}>${lowerBound}</Text>
          <Text style={[styles.boundText, { color: colors.accent }]}>${currentPrice} ●</Text>
          <Text style={styles.boundText}>${upperBound}</Text>
        </View>
      </Card>

      {/* Controls */}
      <Card>
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleLabel}>Auto-Rebalance</Text>
            <Text style={styles.toggleDesc}>Agent auto-adjusts your range</Text>
          </View>
          <Switch
            value={autoRebalance}
            onValueChange={setAutoRebalance}
            trackColor={{ false: colors.bg.surface, true: colors.accent + '60' }}
            thumbColor={autoRebalance ? colors.accent : colors.text.faint}
          />
        </View>
        <View style={[styles.toggleRow, { borderTopWidth: 1, borderTopColor: colors.border.subtle, paddingTop: 12, marginTop: 12 }]}>
          <View>
            <Text style={styles.toggleLabel}>Privacy Mode</Text>
            <Text style={styles.toggleDesc}>Hide values on screen</Text>
          </View>
          <Switch
            value={privacyMode}
            onValueChange={setPrivacyMode}
            trackColor={{ false: colors.bg.surface, true: colors.accent + '60' }}
            thumbColor={privacyMode ? colors.accent : colors.text.faint}
          />
        </View>
      </Card>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.claimBtn} activeOpacity={0.8}>
          <Text style={styles.claimText}>💰 Claim Fees</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeBtn} activeOpacity={0.8}>
          <Text style={styles.closeText}>Close Position</Text>
        </TouchableOpacity>
      </View>

      {/* Agent Activity */}
      <Text style={styles.activityTitle}>AGENT ACTIVITY</Text>
      {MOCK_ACTIVITY.map(a => (
        <Card key={a.id}>
          <View style={styles.activityRow}>
            <Text style={styles.activityIcon}>{typeIcons[a.type] || '📋'}</Text>
            <View style={styles.activityContent}>
              <Text style={[styles.activityDesc, { color: typeColors[a.type] || colors.text.secondary }]}>
                {a.description}
              </Text>
              <Text style={styles.activityTime}>{a.timestamp}</Text>
            </View>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.deep },
  content: { padding: 20, paddingTop: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerLeft: {},
  pair: { color: colors.text.primary, fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  dex: { color: colors.text.faint, fontSize: 13, marginTop: 2 },
  valueLabel: { color: colors.text.muted, fontSize: 13 },
  value: { color: colors.text.primary, fontSize: 36, fontWeight: '800', marginVertical: 4 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  stat: { alignItems: 'center' },
  statLabel: { color: colors.text.faint, fontSize: 11 },
  statValue: { color: colors.text.primary, fontSize: 16, fontWeight: '700', marginTop: 2 },
  sectionTitle: { color: colors.text.muted, fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },
  rangeBar: { marginBottom: 8 },
  rangeTrack: { height: 8, backgroundColor: colors.bg.surface, borderRadius: 4, position: 'relative' },
  rangeActive: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.accent + '40', borderRadius: 4 },
  rangeCurrent: { position: 'absolute', top: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.accent, marginLeft: -8 },
  rangeBounds: { flexDirection: 'row', justifyContent: 'space-between' },
  boundText: { color: colors.text.faint, fontSize: 12 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { color: colors.text.primary, fontSize: 15, fontWeight: '600' },
  toggleDesc: { color: colors.text.faint, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  claimBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  claimText: { color: colors.bg.deep, fontSize: 15, fontWeight: '800' },
  closeBtn: { flex: 1, backgroundColor: colors.bg.elevated, borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.danger + '60' },
  closeText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  activityTitle: { color: colors.text.muted, fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  activityIcon: { fontSize: 20, marginTop: 2 },
  activityContent: { flex: 1 },
  activityDesc: { fontSize: 14, fontWeight: '500' },
  activityTime: { color: colors.text.faint, fontSize: 11, marginTop: 2 },
});
