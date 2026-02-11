// Disable React Native autolinking for MWA — we handle it manually via config plugin
module.exports = {
  dependencies: {
    '@solana-mobile/mobile-wallet-adapter-protocol': {
      platforms: {
        android: null, // Disable autolinking on Android
      },
    },
  },
};
