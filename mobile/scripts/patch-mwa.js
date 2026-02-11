#!/usr/bin/env node
/**
 * Patches @solana-mobile/mobile-wallet-adapter-protocol's android/build.gradle
 * to remove conflicting buildscript and repositories blocks.
 * Run via postinstall hook.
 */
const fs = require('fs');
const path = require('path');

const mwaGradlePath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@solana-mobile',
  'mobile-wallet-adapter-protocol',
  'android',
  'build.gradle'
);

if (!fs.existsSync(mwaGradlePath)) {
  console.log('[patch-mwa] MWA build.gradle not found, skipping');
  process.exit(0);
}

let contents = fs.readFileSync(mwaGradlePath, 'utf8');

// Remove buildscript block (AGP version conflicts with root project)
contents = contents.replace(
  /buildscript\s*\{[\s\S]*?\n\}/,
  '// buildscript block removed by patch-mwa.js'
);

// Remove repositories block (directory traversal fails on EAS)
contents = contents.replace(
  /^repositories\s*\{[\s\S]*?^\}/m,
  '// repositories block removed by patch-mwa.js'
);

fs.writeFileSync(mwaGradlePath, contents, 'utf8');
console.log('[patch-mwa] Patched MWA build.gradle successfully');
