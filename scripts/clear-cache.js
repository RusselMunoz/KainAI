#!/usr/bin/env node
/**
 * clear-cache.js
 * Script to clear all caches for faster clean rebuilds
 * Run with: node scripts/clear-cache.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧹 Clearing caches...\n');

const commands = [
  // Clear Metro bundler cache
  { cmd: 'npx expo start --clear', desc: 'Metro bundler cache', skip: true },
  
  // Clear Watchman (if installed)
  { cmd: 'watchman watch-del-all', desc: 'Watchman cache', optional: true },
  
  // Clear npm cache
  { cmd: 'npm cache clean --force', desc: 'npm cache' },
];

// Directories to remove
const cacheDirs = [
  'node_modules/.cache',
  '.expo',
  path.join(require('os').tmpdir(), 'metro-*'),
  path.join(require('os').tmpdir(), 'haste-map-*'),
];

// Remove cache directories
cacheDirs.forEach(dir => {
  const fullPath = path.resolve(__dirname, '..', dir);
  if (fs.existsSync(fullPath)) {
    console.log(`  Removing: ${dir}`);
    try {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } catch (e) {
      console.log(`  ⚠️  Could not remove ${dir}: ${e.message}`);
    }
  }
});

console.log('\n✅ Caches cleared!\n');
console.log('Next steps:');
console.log('  1. Run: npm install');
console.log('  2. Run: npx expo start --clear');
console.log('\n');
