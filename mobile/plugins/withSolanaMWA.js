const { withAppBuildGradle, withSettingsGradle, withMainActivity } = require('expo/config-plugins');

function withSolanaMWA(config) {
  // Add the MWA native module to settings.gradle
  config = withSettingsGradle(config, (mod) => {
    if (!mod.modResults.contents.includes('mobile-wallet-adapter-protocol')) {
      const mwaProject = `
include ':solana-mobile-wallet-adapter-protocol'
project(':solana-mobile-wallet-adapter-protocol').projectDir = new File(rootProject.projectDir, '../node_modules/@solana-mobile/mobile-wallet-adapter-protocol/android')
`;
      mod.modResults.contents += mwaProject;
    }
    return mod;
  });

  // Add implementation to app/build.gradle
  config = withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes('solana-mobile-wallet-adapter-protocol')) {
      mod.modResults.contents = mod.modResults.contents.replace(
        /dependencies\s*{/,
        `dependencies {
    implementation project(':solana-mobile-wallet-adapter-protocol')`
      );
    }
    return mod;
  });

  // Set launchMode to singleTask to preserve app state during wallet redirects
  config = withMainActivity(config, (mod) => {
    if (mod.modResults.contents) {
      mod.modResults.contents = mod.modResults.contents.replace(
        'android:launchMode="singleTop"',
        'android:launchMode="singleTask"'
      );
    }
    return mod;
  });

  return config;
}

module.exports = withSolanaMWA;
