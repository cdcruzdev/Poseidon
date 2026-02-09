import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useWallet } from '../contexts/WalletContext';
import { colors } from '../theme/colors';

export function ConnectWalletButton() {
  const { publicKey, connected, connecting, connect, disconnect } = useWallet();

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
  );
}

const styles = StyleSheet.create({
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
});
