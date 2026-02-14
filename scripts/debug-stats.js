#!/usr/bin/env node
/**
 * debug-stats.js
 * Display current user stats from AsyncStorage (for debugging)
 * Run with: npm run debug:stats
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('\n📊 KainAI Debug Stats Viewer\n');
console.log('═'.repeat(50));

// Note: This script shows where to find debug data
// For React Native apps, the actual storage is in the device/emulator
// This script provides instructions and simulated data

console.log('\n🔍 Storage Locations:');
console.log('─'.repeat(50));

// Android emulator storage path
const androidPath = path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk', 'emulator');
console.log(`📱 Android Emulator: ${androidPath}`);

// Check for Expo data
const expoDir = path.resolve(__dirname, '..', '.expo');
if (fs.existsSync(expoDir)) {
  console.log(`📦 Expo Cache: ${expoDir}`);
}

console.log('\n📋 AsyncStorage Keys Used by KainAI:');
console.log('─'.repeat(50));
console.log('  @cheffy_user_profile    - User profile data');
console.log('  @kainai_user_stats      - XP, level, achievements');
console.log('  @kainai_recipes         - Cached recipes');
console.log('  @community_pending_shares - Pending community shares');

console.log('\n💡 To view actual stats in the app:');
console.log('─'.repeat(50));
console.log('  1. Start the app with: npm start');
console.log('  2. Navigate to the Debug tab (if in dev mode)');
console.log('  3. View and modify stats directly in the app');

console.log('\n📈 XP Level Thresholds:');
console.log('─'.repeat(50));
const levels = [
  { level: 'Beginner', minXP: 0 },
  { level: 'Novice Cook', minXP: 200 },
  { level: 'Home Chef', minXP: 500 },
  { level: 'Skilled Chef', minXP: 1000 },
  { level: 'Expert Chef', minXP: 2000 },
  { level: 'Master Chef', minXP: 5000 },
  { level: 'Culinary Legend', minXP: 10000 },
];

levels.forEach(l => {
  console.log(`  ${l.level.padEnd(18)} ${String(l.minXP).padStart(6)} XP`);
});

console.log('\n🎮 XP Rewards:');
console.log('─'.repeat(50));
console.log('  Complete Recipe      +20 XP');
console.log('  Share Creation       +15 XP');
console.log('  Complete Achievement +50 XP');
console.log('  Daily Streak         +5 XP');
console.log('  Weekly Streak Bonus  +25 XP');
console.log('  Community Comment    +5 XP');
console.log('  Rate Recipe          +3 XP');
console.log('  Try New Ingredient   +10 XP');

console.log('\n' + '═'.repeat(50));
console.log('✅ Use the in-app Debug tab for live stats viewing!\n');
