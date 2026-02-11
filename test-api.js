// Simple test script to verify the API server is working
const http = require('http');

const data = JSON.stringify({
  prompt: 'Say hello',
  temperature: 0.7,
  maxTokens: 100
});

const options = {
  hostname: 'localhost',
  port: 5173,
  path: '/api/gemini',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('Testing API at http://localhost:5173/api/gemini...');

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', body);
    try {
      const json = JSON.parse(body);
      console.log('Parsed:', json.ok ? '✓ Success' : '✗ Failed', json.ok ? json.text : json.error);
    } catch (e) {
      console.log('Failed to parse JSON');
    }
  });
});

req.on('error', (error) => {
  console.error('Connection error:', error.message);
  console.error('Make sure the server is running: node server/server.js');
});

req.write(data);
req.end();
