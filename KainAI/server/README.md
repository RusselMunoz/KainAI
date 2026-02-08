# KainAI Chat Server

This server provides a proxy to the Groq API for the KainAI mobile app.

## Setup

1. **Get a Groq API Key**:
   - Visit https://console.groq.com/
   - Create an account and get an API key
   - Copy the API key

2. **Configure Environment Variables**:
   - Open the `.env` file in the `server` directory
   - Add your Groq API key
   
   ```env
   GROQ_API_KEY=gsk_XXXXXXXXXXXXXXXXXXXXXXXXXXXX
   GROQ_MODEL=llama-3.3-70b-versatile
   PORT=5173
   ```

3. **Install Dependencies** (if not already installed):
   ```bash
   cd KainAI
   npm install
   ```

## Running the Server

From the KainAI directory:

```bash
cd server
node server.js
```

The server will start on `http://localhost:5173` (or the port specified in `.env`).

You should see:
```
GROQ_API_KEY loaded (masked): gsk_...XXXX
Groq API server listening on http://0.0.0.0:5173
```

## Running the Full App

You need **two terminals**:

**Terminal 1 - API Server:**
```bash
cd d:\VSCode\KainAI\KainAI\server
node server.js
```

**Terminal 2 - Expo:**
```bash
cd d:\VSCode\KainAI\KainAI
npx expo start
```

Then press `a` to open on Android emulator.

## Testing

You can test the API endpoint with PowerShell:

```powershell
Invoke-RestMethod -Uri "http://localhost:5173/api/chat" -Method POST -ContentType "application/json" -Body '{"prompt": "What is a simple chicken recipe?"}'
```

Or with curl:

```bash
curl -X POST http://localhost:5173/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is a simple chicken recipe?", "temperature": 0.7, "maxTokens": 512}'
```

## Troubleshooting

- **"GROQ_API_KEY not set"**: Make sure you've set the API key in the `server/.env` file
- **"Network request failed" on Android**: 
  - The Android emulator uses `10.0.2.2` to reach localhost
  - Make sure Node.js is allowed through Windows Firewall
  - Try running as Administrator: `netsh advfirewall firewall add rule name="Node.js" dir=in action=allow program="C:\Program Files\nodejs\node.exe" enable=yes`
- **API errors**: Check that your Groq API key is valid at https://console.groq.com/
