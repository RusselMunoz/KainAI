#!/usr/bin/env node
/**
 * reset-recipes.js
 * Clear demo recipe storage on the server side
 * Run with: npm run debug:reset-recipes
 */

const http = require('http');

console.log('\n🍳 KainAI Recipe Reset Tool\n');
console.log('═'.repeat(50));

// Server base URL
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5173';

// Note: The server uses demo mode with in-memory data
// This script provides guidance and can trigger a server reset

console.log('\n📝 Demo Mode Storage:');
console.log('─'.repeat(50));
console.log('  In demo mode, recipes are stored in Firestore');
console.log('  or in server memory if Firestore is unavailable.');

console.log('\n🔄 To Reset Demo Recipes:');
console.log('─'.repeat(50));
console.log('  Option 1: Restart the server');
console.log('    1. Stop the server (Ctrl+C in terminal)');
console.log('    2. Run: cd server && node server.js');
console.log('');
console.log('  Option 2: Clear via Debug Tab');
console.log('    1. Open the app');
console.log('    2. Go to Debug tab');
console.log('    3. Press "Clear All Recipes" button');

console.log('\n📱 To Reset AsyncStorage (client-side):');
console.log('─'.repeat(50));
console.log('  The app stores recipe cache locally in AsyncStorage.');
console.log('  Keys to clear:');
console.log('    @kainai_recipes');
console.log('    @cheffy_user_profile (recipesCompleted field)');
console.log('    @kainai_user_stats (recipesCompleted field)');

// Try to hit the health endpoint to verify server is running
console.log('\n🔌 Checking Server Status...');
console.log('─'.repeat(50));

const url = new URL('/api/health', SERVER_URL);

const req = http.get(url.href, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.ok) {
        console.log('  ✅ Server is running!');
        console.log(`  📍 URL: ${SERVER_URL}`);
        console.log(`  🔑 Groq API loaded: ${json.groqKeyLoaded ? 'Yes' : 'No'}`);
      } else {
        console.log('  ⚠️  Server responded but reported issues');
      }
    } catch (e) {
      console.log('  ⚠️  Could not parse server response');
    }
    console.log('\n' + '═'.repeat(50));
    console.log('✅ Use the in-app Debug tab for recipe management!\n');
  });
});

req.on('error', (err) => {
  console.log('  ❌ Server not running or unreachable');
  console.log(`  💡 Start the server: cd KainAI/server && node server.js`);
  console.log('\n' + '═'.repeat(50));
  console.log('⚠️  Start the server first, then use the Debug tab!\n');
});

req.setTimeout(3000, () => {
  req.destroy();
  console.log('  ⏱️  Connection timeout - server may not be running');
  console.log('\n' + '═'.repeat(50) + '\n');
});
