import React, { useState, useRef } from 'react';
import {
  View, TouchableOpacity, Text, StyleSheet, ActivityIndicator,
  Modal, Pressable, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../contexts/WalletContext';
import { colors } from '../theme/colors';
import { useNavigation } from '@react-navigation/native';

export function ConnectWalletButton() {
  const { publicKey, connected, connecting, connect, disconnect } = useWallet();
  const [menuVisible, setMenuVisible] = useState(false);
  const navigation = useNavigation<any>();

  const truncatedKey = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;

  const handlePress = () => {
    if (connected) {
      setMenuVisible(true);
    } else {
      connect();
    }
  };

  const handleViewPositions = () => {
    setMenuVisible(false);
    navigation.navigate('Positions');
  };

  const handleChangeWallet = () => {
    setMenuVisible(false);
    disconnect().then(() => {
      setTimeout(() => connect(), 300);
    });
  };

  const handleDisconnect = () => {
    setMenuVisible(false);
    disconnect();
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
        ) : connected ? (
          <View style={styles.connectedRow}>
            <View style={styles.dot} />
            <Text style={styles.text}>{truncatedKey}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.text.secondary} />
          </View>
        ) : (
          <Text style={styles.text}>Connect Wallet</Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menu}>
            <View style={styles.menuHeader}>
              <View style={styles.dot} />
              <Text style={styles.menuAddress}>{truncatedKey}</Text>
            </View>
            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem} onPress={handleViewPositions} activeOpacity={0.7}>
              <Ionicons name="layers-outline" size={18} color={colors.text.primary} />
              <Text style={styles.menuText}>View Positions</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleChangeWallet} activeOpacity={0.7}>
              <Ionicons name="swap-horizontal-outline" size={18} color={colors.text.primary} />
              <Text style={styles.menuText}>Change Wallet</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem} onPress={handleDisconnect} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={18} color="#e05050" />
              <Text style={[styles.menuText, { color: '#e05050' }]}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
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
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  text: {
    color: '#e0e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 80,
    paddingRight: 16,
  },
  menu: {
    backgroundColor: '#1a2a3a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a4a5a',
    minWidth: 200,
    overflow: 'hidden',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuAddress: {
    color: '#e0e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#2a4a5a',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuText: {
    color: '#e0e8f0',
    fontSize: 14,
    fontWeight: '500',
  },
});
