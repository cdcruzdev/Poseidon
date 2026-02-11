const {
  withAndroidManifest,
  withProjectBuildGradle,
  withSettingsGradle,
  withAppBuildGradle,
  withMainApplication,
} = require('expo/config-plugins');

function withSolanaMWA(config) {
  // 1. singleTask launch mode so app survives wallet app switch
  config = withAndroidManifest(config, (mod) => {
    const mainActivity = mod.modResults.manifest.application[0].activity.find(
      (a) => a.$['android:name'] === '.MainActivity'
    );
    if (mainActivity) {
      mainActivity.$['android:launchMode'] = 'singleTask';
    }
    return mod;
  });

  // 2. Add Solana Mobile Maven repo to project build.gradle
  config = withProjectBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes('maven.solanamobile.com')) {
      mod.modResults.contents = mod.modResults.contents.replace(
        /allprojects\s*\{\s*repositories\s*\{/,
        `allprojects {\n  repositories {\n    maven { url "https://maven.solanamobile.com/releases" }`
      );
    }
    return mod;
  });

  // 3. Include MWA native module in settings.gradle
  config = withSettingsGradle(config, (mod) => {
    if (!mod.modResults.contents.includes('mobile-wallet-adapter-protocol')) {
      mod.modResults.contents += `
// Solana Mobile Wallet Adapter native module
include ':solana-mobile-wallet-adapter-protocol'
project(':solana-mobile-wallet-adapter-protocol').projectDir = new File(rootProject.projectDir, '../node_modules/@solana-mobile/mobile-wallet-adapter-protocol/android')
`;
    }
    return mod;
  });

  // 4. Add MWA as dependency in app/build.gradle
  config = withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes('solana-mobile-wallet-adapter-protocol')) {
      mod.modResults.contents = mod.modResults.contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    implementation project(':solana-mobile-wallet-adapter-protocol')`
      );
    }
    return mod;
  });

  // 5. MWA package registration — NOT needed, Expo autolinking handles it.
  // The autolinked module `:solana-mobile_mobile-wallet-adapter-protocol` registers
  // SolanaMobileWalletAdapterPackage automatically. Manual registration causes
  // "Unresolved reference" compilation errors.

  // Note: MWA build.gradle patching is handled by postinstall script (scripts/patch-mwa.js)
  // This ensures the patch survives npm install on EAS.

  return config;
}

module.exports = withSolanaMWA;
