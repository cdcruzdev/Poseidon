module.exports = {
  dependencies: {
    '@solana-mobile/mobile-wallet-adapter-protocol': {
      root: require.resolve('@solana-mobile/mobile-wallet-adapter-protocol/package.json').replace('/package.json', ''),
      platforms: {
        android: {
          sourceDir: require.resolve('@solana-mobile/mobile-wallet-adapter-protocol/package.json').replace('/package.json', '') + '/android',
        },
      },
    },
  },
};
