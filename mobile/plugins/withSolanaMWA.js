const { withAndroidManifest } = require('expo/config-plugins');

// Set launchMode to singleTask so the app isn't killed when switching to wallet apps
function withSolanaMWA(config) {
  return withAndroidManifest(config, (mod) => {
    const mainActivity = mod.modResults.manifest.application[0].activity.find(
      (a) => a.$['android:name'] === '.MainActivity'
    );
    if (mainActivity) {
      mainActivity.$['android:launchMode'] = 'singleTask';
    }
    return mod;
  });
}

module.exports = withSolanaMWA;
