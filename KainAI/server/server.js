require('dotenv').config(); // load .env into process.env

// Firebase Admin SDK setup
const admin = require('firebase-admin');
const serviceAccount = require('./cheffy-d7701-firebase-adminsdk-fbsvc-c31968f82f.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // databaseURL: 'https://<YOUR_PROJECT_ID>.firebaseio.com' // Uncomment and set if using Realtime Database
});

console.log('Firebase Admin initialized.');

const express = require('express');
// prefer global fetch (Node 18+) or fall back to node-fetch
let fetchFn;
try {
  fetchFn = (typeof fetch !== 'undefined') ? fetch : require('node-fetch');
} catch (e) {
  console.error('node-fetch is missing and global fetch is not available. Run: npm install node-fetch@2');
  process.exit(1);
}

const app = express();
app.use(express.json());

// simple CORS (allow all origins for dev)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Groq API configuration
const API_KEY = process.env.GROQ_API_KEY || '';
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const BASE = 'https://api.groq.com/openai/v1';

// Firestore user service
const { addUser, getUserData } = require('./services/firestore');
// Endpoint to get user data (preferences, allergies, skill)
app.get('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userData = await getUserData(userId);
    return res.json({ ok: true, user: userData });
  } catch (err) {
    console.error('Error fetching user data:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Add user to Firestore
app.post('/api/add-user', async (req, res) => {
  try {
    const { name } = req.body;
    const id = await addUser(name);
    return res.json({ ok: true, id });
  } catch (err) {
    console.error('Error adding user:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});


if (!API_KEY) {
  console.warn('GROQ_API_KEY not set. Set process.env.GROQ_API_KEY before starting the server.');
} else {
  console.log('GROQ_API_KEY loaded (masked):', `${API_KEY.slice(0,4)}...${API_KEY.slice(-4)}`);
}


// Enhanced /api/chat endpoint for recipe generation with user constraints and confirmation
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, userId, ingredientList, confirmed } = req.body;
    const temperature = typeof req.body.temperature === 'number' ? req.body.temperature : 0.7;
    const maxTokens = req.body.maxTokens || 1024;

    if (!userId) {
      return res.status(400).json({ ok: false, error: 'Missing userId' });
    }

    // Step 1: Retrieve user constraints
    let userData;
    try {
      userData = await getUserData(userId);
    } catch (err) {
      return res.status(400).json({ ok: false, error: 'Could not retrieve user data: ' + (err.message || err) });
    }

    // Step 2: If not confirmed, prompt for confirmation
    if (!confirmed) {
      return res.json({
        ok: true,
        needsConfirmation: true,
        message: `You provided these ingredients: ${ingredientList?.join(', ') || ''}.\nAre these final, or may I recommend and include additional ingredients? Please confirm before I generate your recipe.`
      });
    }

    // Step 3: Generate recipe prompt with all constraints
    const systemPrompt = `You are Cheffy, a high-energy culinary expert and mentor. Your mission is to make professional-grade cooking accessible to everyone. You are vibrant, organized, and deeply encouraging.\n\nUser constraints:\n- Dietary preferences: ${userData.dietary_preferences?.join(', ') || 'None'}\n- Allergy restrictions: ${userData.dietary_allergies?.join(', ') || 'None'}\n- Cooking skill level: ${userData.cooking_skills?.join(', ') || 'Unknown'}\n\nYou must strictly adhere to all dietary and allergy restrictions.\n\nWhen generating a recipe, always include:\n- Estimated cooking time\n- Serving size\n- Difficulty classification (easy, medium, hard)\n- Approximate calorie count`;

    const userPrompt = `Ingredients: ${ingredientList?.join(', ') || ''}\n${prompt || ''}`;

    // Groq uses OpenAI-compatible API
    const url = `${BASE}/chat/completions`;
    const body = {
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature,
      max_tokens: maxTokens
    };

    console.log('Calling Groq API with model:', MODEL);
    console.log('User prompt:', userPrompt.slice(0, 100) + '...');

    const r = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch (e) { json = text; }

    if (!r.ok) {
      console.warn('Groq returned', r.status, text);
      return res.status(502).json({ ok: false, status: r.status, error: json?.error?.message || text, raw: json });
    }

    // Extract response text from OpenAI-compatible format
    const genText = json?.choices?.[0]?.message?.content || '';

    return res.json({ ok: true, response: genText, model: MODEL, userConstraints: userData });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

const port = process.env.PORT || 5173;
const server = app.listen(port, '0.0.0.0', () => console.log(`Groq API server listening on http://0.0.0.0:${port}`));
server.keepAliveTimeout = 120000;