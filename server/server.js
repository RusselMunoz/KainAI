require('dotenv').config(); // load .env into process.env
console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY); // ADD THIS
console.log('All env vars:', Object.keys(process.env).filter(k => k.includes('GROQ')));

// ==================== DEMO MODE CONFIG ====================
const DEMO_MODE = false; // Set to false to use real Firebase auth
const MOCK_USER = {
  id: 'demo-user-id',
  username: 'Demo User',
  dietary_preferences: ['Healthy', 'Quick meals'],
  dietary_allergies: [],
  cooking_skills: ['Intermediate'],
  email: 'demo@example.com'
};
console.log('\n🎭 DEMO_MODE:', DEMO_MODE ? 'ENABLED (bypassing Firebase auth)' : 'DISABLED (using real auth)');

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`\n📧 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Root health check
app.get('/', (req, res) => {
  res.json({ ok: true, message: 'KainAI Server is running', port: process.env.PORT || 5173 });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString(), groqKeyLoaded: !!API_KEY });
});

// Groq API configuration
const API_KEY = process.env.GROQ_API_KEY || '';
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const BASE = 'https://api.groq.com/openai/v1';

// Firestore services
const { addUser, getUserData, updateUserData, ensureUserExists } = require('./services/firestore');
const recipeService = require('./services/recipe.service');
const communityService = require('./services/community.service');
const uploadService = require('./services/upload.service');

// Log Cloudinary config status
console.log('☁️ Cloudinary:', uploadService.isCloudinaryConfigured() ? 'CONFIGURED' : 'NOT CONFIGURED (demo mode images)');

function extractUserMetadata(req) {
  const metadata = {};
  const headerEmail = req.headers?.['x-user-email'];
  const headerName = req.headers?.['x-user-name'];
  const headerPhoto = req.headers?.['x-user-photo'];

  const email = req.body?.email ?? req.query?.email ?? headerEmail;
  if (email) {
    metadata.email = email;
  }

  const displayName = req.body?.displayName ?? req.query?.displayName ?? headerName;
  if (displayName) {
    metadata.displayName = displayName;
  }

  const photoURL = req.body?.photoURL ?? headerPhoto;
  if (photoURL) {
    metadata.photoURL = photoURL;
  }

  return metadata;
}

// ==================== IMAGE UPLOAD ENDPOINT ====================
// POST /api/upload - Upload image(s) to Cloudinary
app.post('/api/upload', async (req, res) => {
  try {
    const { image, images, folder } = req.body;
    
    if (images && Array.isArray(images)) {
      // Multiple images
      const results = await uploadService.uploadMultipleImages(images, { folder });
      return res.json({ ok: true, urls: results.map(r => r.secure_url), results });
    } else if (image) {
      // Single image
      const result = await uploadService.uploadImage(image, { folder });
      return res.json({ ok: true, url: result.secure_url, result });
    } else {
      return res.status(400).json({ ok: false, error: 'No image data provided' });
    }
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Upload failed' });
  }
});

// ==================== FOOD VALIDATION ENDPOINT ====================
// POST /api/validate-food - Validate custom dietary/allergy text using AI
app.post('/api/validate-food', async (req, res) => {
  try {
    const { text, type } = req.body;
    
    if (!text || !text.trim()) {
      return res.json({ isValid: true, message: 'Empty text is valid' });
    }
    
    if (!API_KEY) {
      // If no API key, accept all input (graceful degradation)
      console.log('⚠️ No GROQ_API_KEY, skipping AI validation');
      return res.json({ isValid: true, message: 'Validation skipped (no API key)' });
    }
    
    const typeLabel = type === 'allergy' ? 'food allergy or intolerance' : 'dietary preference or food restriction';
    const systemPrompt = `You are a food and nutrition expert. Your job is to validate if user input is a legitimate ${typeLabel}.

Rules:
1. Accept valid food allergies (e.g., "peanut allergy", "lactose intolerance", "mild shellfish sensitivity")
2. Accept valid dietary preferences (e.g., "no red meat", "prefer organic", "low sodium", "pescatarian")
3. Reject nonsense, gibberish, or inappropriate content
4. Reject non-food related restrictions
5. Be lenient with spelling mistakes if intent is clear

Respond with ONLY a JSON object:
{"isValid": true/false, "reason": "brief explanation"}`;

    const response = await fetchFn(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Validate this ${type === 'allergy' ? 'allergy' : 'dietary preference'}: "${text}"` }
        ],
        temperature: 0.1,
        max_tokens: 100,
      }),
    });
    
    if (!response.ok) {
      console.error('Groq API error:', response.status);
      // Graceful fallback - accept input if AI fails
      return res.json({ isValid: true, message: 'Validation skipped (API error)' });
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    try {
      // Parse the JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.json({
          isValid: parsed.isValid !== false, // Default to valid if unclear
          message: parsed.isValid ? 'Valid entry' : (parsed.reason || 'Please enter a valid food restriction'),
        });
      }
    } catch (parseErr) {
      console.log('Could not parse AI response:', content);
    }
    
    // Default to accepting if we can't parse
    return res.json({ isValid: true, message: 'Accepted' });
    
  } catch (err) {
    console.error('Validation error:', err);
    // Graceful fallback - accept input if anything fails
    return res.json({ isValid: true, message: 'Validation skipped (server error)' });
  }
});

// Endpoint to get user data (preferences, allergies, skill)
app.get('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await ensureUserExists(userId, extractUserMetadata(req));
    const userData = await getUserData(userId);
    return res.json({ ok: true, user: userData });
  } catch (err) {
    console.error('Error fetching user data:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Update user data in Firestore (PUT/PATCH)
app.put('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    console.log(`📝 PUT /api/user/${userId} - Updating user with:`, JSON.stringify(updates));
    await ensureUserExists(userId, extractUserMetadata(req));
    const updatedUser = await updateUserData(userId, updates);
    return res.json({ ok: true, user: updatedUser });
  } catch (err) {
    console.error('Error updating user:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

app.patch('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    console.log(`📝 PATCH /api/user/${userId} - Updating user with:`, JSON.stringify(updates));
    await ensureUserExists(userId, extractUserMetadata(req));
    const updatedUser = await updateUserData(userId, updates);
    return res.json({ ok: true, user: updatedUser });
  } catch (err) {
    console.error('Error updating user:', err);
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

// Get leaderboard (top 50 by XP)
app.get('/api/leaderboard', async (req, res) => {
  try {
    const db = admin.firestore();
    // Query users for XP data
    const snapshot = await db.collection('users')
      .limit(50)
      .get();

    let leaderboard = await Promise.all(snapshot.docs.map(async (doc) => {
      const stats = doc.data();
      const uid = doc.id;
      let displayName = 'Anonymous';
      
      try {
        // Join with users collection for display name
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          displayName = userData.displayName || userData.username || 'Anonymous';
        }
      } catch (e) {
        console.warn(`Error fetching user ${uid} for leaderboard:`, e.message);
      }

      return { uid, displayName, xp: stats.xp || 0, level: stats.level || 1, recipesCompleted: stats.recipesCompleted || 0 };
    }));

    leaderboard.sort((a, b) => (b.xp || 0) - (a.xp || 0)); // Sort after fetching to include users without XP field

    return res.json({ ok: true, leaderboard });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});


if (!API_KEY) {
  console.warn('GROQ_API_KEY not set. Set process.env.GROQ_API_KEY before starting the server.');
} else {
  console.log('GROQ_API_KEY loaded (masked):', `${API_KEY.slice(0,4)}...${API_KEY.slice(-4)}`);
}

// Health check endpoint for /api/chat (GET)
app.get('/api/chat', (req, res) => {
  console.log('📡 GET /api/chat health check');
  res.json({ ok: true, message: 'Chat API is ready', timestamp: new Date().toISOString() });
});

// Enhanced /api/chat endpoint for recipe generation with user constraints and confirmation
app.post('/api/chat', async (req, res) => {
  console.log('📥 POST /api/chat received:', { prompt: req.body.prompt?.slice(0, 50), userId: req.body.userId, confirmed: req.body.confirmed });
  try {
    let { prompt, userId, ingredientList, confirmed } = req.body;
    const temperature = typeof req.body.temperature === 'number' ? req.body.temperature : 0.7;
    const maxTokens = req.body.maxTokens || 1024;

    if (!userId) {
      return res.status(400).json({ ok: false, error: 'Missing userId' });
    }

    // Server-side profanity filter for ingredients
    if (ingredientList && Array.isArray(ingredientList)) {
      const profanityList = ['shit', 'fuck', 'damn', 'ass', 'bitch', 'bastard', 'dick', 'cock', 
        'pussy', 'cunt', 'piss', 'fag', 'whore', 'slut', 'nigger', 'nigga', 'retard', 'faggot'];
      const whitelist = ['shiitake', 'shitake', 'bass', 'grass', 'class', 'pass', 'mass',
        'cocktail', 'cocoa', 'coconut', 'buttermilk', 'butter', 'butternut'];
      
      ingredientList = ingredientList.filter(ingredient => {
        const lower = ingredient.toLowerCase();
        // Allow whitelisted words
        if (whitelist.some(w => lower.includes(w))) return true;
        // Block profanity
        for (const bad of profanityList) {
          const regex = new RegExp(`\\b${bad}\\b`, 'i');
          if (regex.test(ingredient)) {
            console.log(`⚠️ Server blocked profane ingredient: "${ingredient}"`);
            return false;
          }
        }
        return true;
      });
    }

    // Step 1: Retrieve user constraints (use mock data in demo mode)
    let userData;
    if (DEMO_MODE) {
      console.log('🎭 DEMO MODE: Using mock user data instead of Firebase');
      userData = MOCK_USER;
    } else {
      try {
        userData = await getUserData(userId);
      } catch (err) {
        return res.status(400).json({ ok: false, error: 'Could not retrieve user data: ' + (err.message || err) });
      }
    }
    console.log('👤 User data:', JSON.stringify(userData, null, 2));

    // ==================== REQUEST ROUTING ====================
    console.log('🔥 ROUTING REQUEST:', { confirmed, promptStart: prompt?.slice(0, 60) });
    
    // CASE 1: Initial ingredient submission (confirmed is undefined/null)
    if (confirmed === undefined || confirmed === null) {
      console.log('📋 CASE 1: Initial submission - asking for confirmation');
      return res.json({
        ok: true,
        needsConfirmation: true,
        message: `You provided these ingredients: ${ingredientList?.join(', ') || ''}.\nAre these final, or may I recommend and include additional ingredients? Please confirm before I generate your recipe.`
      });
    }
    
    // CASE 2: User wants AI recommendations (confirmed === false AND prompt asks for suggestions)
    if (confirmed === false && prompt && (
      prompt.includes('additional ingredients') || 
      prompt.includes('complement') ||
      prompt.includes('recommend') ||
      prompt.includes('suggest')
    )) {
      console.log('🤖 CASE 2: User wants AI recommendations');
      
      const recommendationPrompt = `Based on these ingredients: ${ingredientList?.join(', ')}, suggest 3-5 complementary ingredients that would work well together.

User dietary constraints:
- Preferences: ${userData.dietary_preferences?.join(', ') || 'None'}
- Allergies to avoid: ${userData.dietary_allergies?.join(', ') || 'None'}

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
Here are 3-5 ingredients that would complement your selection:

• [Ingredient 1] - [brief reason]
• [Ingredient 2] - [brief reason]
• [Ingredient 3] - [brief reason]

Would you like to add any of these? Just type them out and I'll include them in your recipe!`;

      const url = `${BASE}/chat/completions`;
      const body = {
        model: MODEL,
        messages: [
          { role: 'system', content: 'You are Cheffy, a helpful cooking assistant. Suggest complementary ingredients that pair well with the user\'s ingredients.' },
          { role: 'user', content: recommendationPrompt }
        ],
        temperature: 0.7,
        max_tokens: 512
      };

      console.log('📤 Calling Groq for recommendations...');
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
        console.error('❌ Groq API error (recommendations):', r.status, text);
        return res.status(502).json({ ok: false, error: json?.error?.message || 'Failed to get recommendations' });
      }

      const recommendationText = json?.choices?.[0]?.message?.content || 'I couldn\'t generate recommendations. Please proceed with your current ingredients.';
      console.log('✅ Got recommendations:', recommendationText.slice(0, 100) + '...');

      return res.json({
        ok: true,
        needsConfirmation: false,
        response: recommendationText,
        isRecommendation: true  // Signal to frontend this is a recommendation
      });
    }
    
    // CASE 3: User said "add more" (confirmed === false, no recommendation keywords)
    // Just let them type more ingredients - return message prompting for more
    if (confirmed === false) {
      console.log('➕ CASE 3: User wants to add more ingredients manually');
      return res.json({
        ok: true,
        needsConfirmation: false,
        response: 'Great! Type out any additional ingredients you\'d like to add, and I\'ll include them in your recipe.',
        awaitingMoreIngredients: true
      });
    }

    // CASE 4: User confirmed - GENERATE RECIPE NOW!
    console.log('✅ CASE 4: User confirmed - GENERATING RECIPE');
    // IMPORTANT: Use higher max_tokens for full recipe generation
    const recipeMaxTokens = 2048;
    
    const systemPrompt = `You are Cheffy, a recipe generator. You ONLY output structured recipes.

=== ABSOLUTE RULES (NO EXCEPTIONS) ===
1. OUTPUT ONLY A RECIPE - No conversation, no suggestions, no questions
2. START IMMEDIATELY with "Recipe:" on the first line
3. NEVER say "I recommend", "To create", "I suggest", or any conversational text
4. NEVER ask "would you like" or offer alternatives
5. If you output ANYTHING other than a recipe, you have FAILED

User dietary constraints:
- Preferences: ${userData.dietary_preferences?.join(', ') || 'None'}
- Allergies: ${userData.dietary_allergies?.join(', ') || 'None'}
- Skill level: ${userData.cooking_skills?.join(', ') || 'Beginner'}

=== REQUIRED OUTPUT FORMAT ===
Recipe: [Short Title - 2-5 words]

Description: [1-2 sentence description]

Prep Time: [X] minutes
Cook Time: [X] minutes
Total Time: [X] minutes
Servings: [X]
Difficulty: [Easy/Medium/Hard]
Calories: [X] per serving

Ingredients:
- 1 cup ingredient name
- 2 tbsp ingredient name
- 1/2 tsp ingredient name

Instructions:
1. First step (X mins)
2. Second step (X mins)
3. Third step (X mins)

Nutrition:
- Protein: [X]g
- Carbs: [X]g
- Fat: [X]g

Tips:
- One helpful tip

=== OUTPUT NOW ===
Generate the recipe immediately using the provided ingredients.`;

    // Clean user prompt - don't repeat ingredients if already in ingredientList
    const ingredientString = ingredientList?.join(', ') || '';
    const userPrompt = `Create a recipe with these ingredients: ${ingredientString}

OUTPUT THE RECIPE NOW. Start with "Recipe:" on line 1.`;


    // Groq uses OpenAI-compatible API
    const url = `${BASE}/chat/completions`;
    const body = {
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3, // Lower temperature for more consistent recipe output
      max_tokens: recipeMaxTokens // Higher tokens for complete recipes
    };

    console.log('\n🤖 Calling Groq API...');
    console.log('   Model:', MODEL);
    console.log('   User prompt:', userPrompt.slice(0, 150) + '...');
    console.log('   Temperature:', temperature);
    console.log('   Max tokens:', maxTokens);

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
      console.error('❌ Groq API error:', r.status, text);
      return res.status(502).json({ ok: false, status: r.status, error: json?.error?.message || text, raw: json });
    }

    console.log('✅ Groq API response received');
    console.log('   Status:', r.status);
    console.log('   Usage:', json?.usage);

    // Extract response text from OpenAI-compatible format
    const genText = json?.choices?.[0]?.message?.content || '';
    console.log('📄 Generated text preview:', genText.slice(0, 200) + '...');

    // Parse the AI response into structured recipe format
    const parsedRecipe = recipeService.parseAIRecipeResponse(genText);
    console.log('🍳 Parsed recipe:', parsedRecipe?.title || 'No title parsed');
    
    // Save the recipe to Firestore (works for both demo and real users)
    let savedRecipe = null;
    try {
      savedRecipe = await recipeService.saveRecipe(userId, parsedRecipe);
      console.log('✅ Recipe saved with ID:', savedRecipe.id);
    } catch (saveErr) {
      console.error('❌ Failed to save recipe:', saveErr);
      // In demo mode, create a fallback mock recipe if Firestore save fails
      if (DEMO_MODE) {
        savedRecipe = {
          id: 'demo-recipe-' + Date.now(),
          ...parsedRecipe,
          userId: userId,
          status: 'Not Started',
          createdAt: new Date().toISOString()
        };
        console.log('📝 Created fallback mock recipe:', savedRecipe.id);
      }
      // Continue even if save fails - user still gets the response
    }
    console.log('✅ Recipe ready:', savedRecipe?.id);

    return res.json({ 
      ok: true, 
      response: genText, 
      recipe: savedRecipe,
      recipeId: savedRecipe?.id || null,
      model: MODEL, 
      userConstraints: userData,
      navigateTo: 'Recipes' // Signal to client to switch tabs
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// ==================== RECIPE ENDPOINTS ====================

// Get all recipes for a user
app.get('/api/recipes/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;
    
    console.log(`\n📋 GET /api/recipes/${userId} - Fetching recipes (status: ${status || 'all'})`);
    const recipes = await recipeService.getUserRecipes(userId, status || null);
    console.log(`   📤 Returning ${recipes.length} recipes`);
    return res.json({ ok: true, recipes });
  } catch (err) {
    console.error('❌ Error fetching recipes:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Get a single recipe
app.get('/api/recipes/:userId/:recipeId', async (req, res) => {
  try {
    const { userId, recipeId } = req.params;
    
    const recipe = await recipeService.getRecipe(userId, recipeId);
    return res.json({ ok: true, recipe });
  } catch (err) {
    console.error('Error fetching recipe:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Update cooking progress
app.put('/api/recipes/:userId/:recipeId/progress', async (req, res) => {
  try {
    const { userId, recipeId } = req.params;
    const progressData = req.body;
    
    await recipeService.updateCookingProgress(userId, recipeId, progressData);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error updating progress:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Complete a recipe
app.post('/api/recipes/:userId/:recipeId/complete', async (req, res) => {
  try {
    const { userId, recipeId } = req.params;
    const { rating } = req.body;
    
    const result = await recipeService.completeRecipe(userId, recipeId, rating);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Error completing recipe:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Copy a recipe from community to user's archive
app.post('/api/recipes/:userId/copy', async (req, res) => {
  try {
    const { userId } = req.params;
    const { originalRecipe, originalAuthorId } = req.body;
    
    const newRecipe = await recipeService.copyRecipeToArchive(userId, originalRecipe, originalAuthorId);
    return res.json({ ok: true, recipe: newRecipe });
  } catch (err) {
    console.error('Error copying recipe:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Delete a recipe
app.delete('/api/recipes/:userId/:recipeId', async (req, res) => {
  try {
    const { userId, recipeId } = req.params;
    
    const result = await recipeService.deleteRecipe(userId, recipeId);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Error deleting recipe:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Share recipe to community - makes it public and awards points
app.post('/api/recipes/:userId/:recipeId/share', async (req, res) => {
  try {
    const { userId, recipeId } = req.params;
    
    // Verify ownership and share recipe
    const result = await recipeService.shareRecipeToCommunity(userId, recipeId);
    return res.json({ ok: true, pointsAwarded: 15, ...result });
  } catch (err) {
    console.error('Error sharing recipe:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Unshare recipe from community - makes it private
app.post('/api/recipes/:userId/:recipeId/unshare', async (req, res) => {
  try {
    const { userId, recipeId } = req.params;
    
    // Verify ownership and unshare recipe
    const result = await recipeService.unshareRecipe(userId, recipeId);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Error unsharing recipe:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Get all public recipes
app.get('/api/recipes/public', async (req, res) => {
  try {
    const { limit } = req.query;
    
    const recipes = await recipeService.getPublicRecipes(parseInt(limit) || 20);
    return res.json({ ok: true, recipes });
  } catch (err) {
    console.error('Error fetching public recipes:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// ==================== COMMUNITY ENDPOINTS ====================

// Get community feed
app.get('/api/community/feed', async (req, res) => {
  try {
    const { type, limit } = req.query;
    
    const posts = await communityService.getFeedPosts({
      type: type || 'all',
      limit: parseInt(limit) || 20
    });
    return res.json({ ok: true, posts });
  } catch (err) {
    console.error('Error fetching feed:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Get trending posts
app.get('/api/community/trending', async (req, res) => {
  try {
    const { limit } = req.query;
    
    const posts = await communityService.getTrendingPosts(parseInt(limit) || 10);
    return res.json({ ok: true, posts });
  } catch (err) {
    console.error('Error fetching trending:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Get community stats
app.get('/api/community/stats', async (req, res) => {
  try {
    const stats = await communityService.getCommunityStats();
    return res.json({ ok: true, stats });
  } catch (err) {
    console.error('Error fetching stats:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Create a new post
app.post('/api/community/posts', async (req, res) => {
  try {
    const post = await communityService.createPost(req.body);
    return res.json({ ok: true, post });
  } catch (err) {
    console.error('Error creating post:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Get a single post
app.get('/api/community/posts/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    
    const post = await communityService.getPost(postId);
    return res.json({ ok: true, post });
  } catch (err) {
    console.error('Error fetching post:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Like/unlike a post
app.post('/api/community/posts/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;
    
    const result = await communityService.toggleLike(postId, userId);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Error toggling like:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Save/unsave a post
app.post('/api/community/posts/:postId/save', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;
    
    const result = await communityService.toggleSave(postId, userId);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Error toggling save:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Get comments for a post
app.get('/api/community/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const { limit } = req.query;
    
    const comments = await communityService.getComments(postId, parseInt(limit) || 50);
    return res.json({ ok: true, comments });
  } catch (err) {
    console.error('Error fetching comments:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Add a comment
app.post('/api/community/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const comment = await communityService.addComment(postId, req.body);
    return res.json({ ok: true, comment });
  } catch (err) {
    console.error('Error adding comment:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Delete a comment
app.delete('/api/community/posts/:postId/comments/:commentId', async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { userId } = req.body;
    
    await communityService.deleteComment(postId, commentId, userId);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting comment:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Delete a post
app.delete('/api/community/posts/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;
    
    await communityService.deletePost(postId, userId);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting post:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Edit a post
app.put('/api/community/posts/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, title, content, tags } = req.body;
    
    const updatedPost = await communityService.updatePost(postId, userId, { title, content, tags });
    return res.json({ ok: true, post: updatedPost });
  } catch (err) {
    console.error('Error updating post:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Get user's posts
app.get('/api/community/users/:userId/posts', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit } = req.query;
    
    const posts = await communityService.getUserPosts(userId, parseInt(limit) || 20);
    return res.json({ ok: true, posts });
  } catch (err) {
    console.error('Error fetching user posts:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Get user's saved posts
app.get('/api/community/users/:userId/saved', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit } = req.query;
    
    const posts = await communityService.getSavedPosts(userId, parseInt(limit) || 20);
    return res.json({ ok: true, posts });
  } catch (err) {
    console.error('Error fetching saved posts:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Search posts
app.get('/api/community/search', async (req, res) => {
  try {
    const { q, limit } = req.query;
    
    if (!q) {
      return res.status(400).json({ ok: false, error: 'Search query is required' });
    }
    
    const posts = await communityService.searchPosts(q, parseInt(limit) || 20);
    return res.json({ ok: true, posts });
  } catch (err) {
    console.error('Error searching posts:', err);
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

const port = process.env.PORT || 5173;
const server = app.listen(port, '0.0.0.0', () => console.log(`Groq API server listening on http://0.0.0.0:${port}`));
server.keepAliveTimeout = 120000;