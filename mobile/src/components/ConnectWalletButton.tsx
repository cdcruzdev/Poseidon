import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useWallet } from '../contexts/WalletContext';
import { colors } from '../theme/colors';

export function ConnectWalletButton() {
  const { publicKey, connected, connecting, connect, disconnect, forceDisconnect } = useWallet();

  const truncatedKey = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;

  const handlePress = () => {
    if (connected) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, connected && styles.connectedButton]}
        onPress={handlePress}
        activeOpacity={0.7}
        disabled={connecting}
      >
        {connecting ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Text style={styles.text}>
            {connected ? truncatedKey : 'Connect Wallet'}
          </Text>
        )}
      </TouchableOpacity>
      {/* DEBUG: Force disconnect — remove before shipping */}
      <TouchableOpacity
        style={styles.debugButton}
        onPress={forceDisconnect}
        activeOpacity={0.7}
      >
        <Text style={styles.debugText}>Force Reset</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    backgroundColor: '#1a3050',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#7ec8e8',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  connectedButton: {
    borderColor: '#4ade80',
  },
  text: {
    color: '#e0e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  debugButton: {
    backgroundColor: '#3a1520',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e05050',
  },
  debugText: {
    color: '#e05050',
    fontSize: 11,
    fontWeight: '600',
  },
});
