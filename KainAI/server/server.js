require('dotenv').config(); // load .env into process.env
console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY); // ADD THIS
console.log('All env vars:', Object.keys(process.env).filter(k => k.includes('GROQ')));

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

// Firestore services
const { addUser, getUserData } = require('./services/firestore');
const recipeService = require('./services/recipe.service');
const communityService = require('./services/community.service');

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
    const systemPrompt = `You are Cheffy, a high-energy culinary expert and mentor. Your mission is to make professional-grade cooking accessible to everyone.

User constraints:
- Dietary preferences: ${userData.dietary_preferences?.join(', ') || 'None'}
- Allergy restrictions: ${userData.dietary_allergies?.join(', ') || 'None'}
- Cooking skill level: ${userData.cooking_skills?.join(', ') || 'Unknown'}

You must strictly adhere to all dietary and allergy restrictions.

IMPORTANT: Generate recipes in this EXACT format for parsing:

Recipe: [Title]

Description: [Brief description of the dish]

Cooking Time: [X] minutes
Servings: [X]
Difficulty: [Easy/Medium/Hard]
Calories: [X] per serving

Ingredients:
- [amount] [unit] [ingredient name]
- [amount] [unit] [ingredient name]
...

Instructions:
1. [Step 1 instruction] (X mins)
2. [Step 2 instruction] (X mins)
...

Nutrition:
- Protein: [X]g
- Carbs: [X]g
- Fat: [X]g

Tips:
- [Helpful cooking tip]
`;

    const userPrompt = `Create a recipe using these ingredients: ${ingredientList?.join(', ') || ''}\n${prompt || ''}`;


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

    // Parse the AI response into structured recipe format
    const parsedRecipe = recipeService.parseAIRecipeResponse(genText);
    
    // Save the recipe to Firestore
    let savedRecipe = null;
    try {
      savedRecipe = await recipeService.saveRecipe(userId, parsedRecipe);
      console.log('Recipe saved with ID:', savedRecipe.id);
    } catch (saveErr) {
      console.error('Failed to save recipe:', saveErr);
      // Continue even if save fails - user still gets the response
    }

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
    
    const recipes = await recipeService.getUserRecipes(userId, status || null);
    return res.json({ ok: true, recipes });
  } catch (err) {
    console.error('Error fetching recipes:', err);
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