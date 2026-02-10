const { withAndroidManifest, withProjectBuildGradle } = require('expo/config-plugins');

function withSolanaMWA(config) {
  // 1. Set launchMode to singleTask so the app returns properly from wallet
  config = withAndroidManifest(config, (mod) => {
    const mainActivity = mod.modResults.manifest.application[0].activity.find(
      (a) => a.$['android:name'] === '.MainActivity'
    );
    if (mainActivity) {
      mainActivity.$['android:launchMode'] = 'singleTask';
    }
    return mod;
  });

  // 2. Add Solana Mobile maven repository for clientlib dependency
  config = withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language === 'groovy') {
      const mavenLine = `        maven { url "https://maven.solanamobile.com/releases" }`;
      // Add to allprojects.repositories if not already present
      if (!mod.modResults.contents.includes('maven.solanamobile.com')) {
        mod.modResults.contents = mod.modResults.contents.replace(
          /allprojects\s*\{[\s\S]*?repositories\s*\{/,
          (match) => `${match}\n${mavenLine}`
        );
      }
    }
    return mod;
  });

  return config;
}

module.exports = withSolanaMWA;
