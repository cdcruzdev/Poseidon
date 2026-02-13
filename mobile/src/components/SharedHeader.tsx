import React from 'react';
import { View, Text, StyleSheet, Image, Platform, StatusBar } from 'react-native';
import { ConnectWalletButton } from './ConnectWalletButton';
import { colors } from '../theme/colors';

interface SharedHeaderProps {
  title: string;
  subtitle?: string;
}

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 50;

export function SharedHeader({ title, subtitle }: SharedHeaderProps) {
  return (
    <View style={[styles.wrapper, { paddingTop: STATUSBAR_HEIGHT }]}>
      <View style={styles.row}>
        <View style={styles.logoRow}>
          <Image source={require('../../assets/poseidon-icon.png')} style={styles.logoImg} />
          <Text style={styles.title}>{title}</Text>
        </View>
        <ConnectWalletButton />
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 20, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImg: { width: 28, height: 28, borderRadius: 14 },
  title: { fontSize: 22, fontWeight: '900', color: colors.accent, letterSpacing: 2 },
  subtitle: { color: '#7090a0', fontSize: 14, marginTop: 4 },
});
