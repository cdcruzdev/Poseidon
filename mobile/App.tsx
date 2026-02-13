import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WalletProvider } from './src/contexts/WalletContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <WalletProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </WalletProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
