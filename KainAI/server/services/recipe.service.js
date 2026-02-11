// services/recipe.service.js
const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * Parse AI-generated recipe text into structured format
 * @param {string} aiResponse - Raw AI response text
 * @returns {Object} Structured recipe object
 */
function parseAIRecipeResponse(aiResponse) {
  // Initialize default structure
  const recipe = {
    title: '',
    description: '',
    ingredients: [],
    instructions: [],
    cookTime: 30,
    servings: 4,
    difficulty: 'Easy',
    calories: 0,
    nutrition: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    },
    tags: []
  };

  const lines = aiResponse.split('\n').map(l => l.trim()).filter(Boolean);
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    // Detect title (usually first significant line or after "Recipe:")
    if (!recipe.title && (lowerLine.includes('recipe:') || i === 0)) {
      recipe.title = line.replace(/^(recipe:|#|\*)/gi, '').trim();
      continue;
    }

    // Detect sections
    if (lowerLine.includes('ingredient')) {
      currentSection = 'ingredients';
      continue;
    } else if (lowerLine.includes('instruction') || lowerLine.includes('direction') || lowerLine.includes('steps')) {
      currentSection = 'instructions';
      continue;
    } else if (lowerLine.includes('nutrition') || lowerLine.includes('macro')) {
      currentSection = 'nutrition';
      continue;
    }

    // Parse cooking time
    const timeMatch = line.match(/(\d+)\s*(min|minute)/i);
    if (timeMatch && (lowerLine.includes('cook') || lowerLine.includes('time') || lowerLine.includes('prep'))) {
      recipe.cookTime = parseInt(timeMatch[1], 10);
    }

    // Parse servings
    const servingMatch = line.match(/(\d+)\s*(serving|portion|people)/i);
    if (servingMatch) {
      recipe.servings = parseInt(servingMatch[1], 10);
    }

    // Parse difficulty
    if (lowerLine.includes('easy')) recipe.difficulty = 'Easy';
    else if (lowerLine.includes('medium') || lowerLine.includes('moderate')) recipe.difficulty = 'Medium';
    else if (lowerLine.includes('hard') || lowerLine.includes('difficult')) recipe.difficulty = 'Hard';

    // Parse calories
    const calMatch = line.match(/(\d+)\s*(cal|kcal|calorie)/i);
    if (calMatch) {
      recipe.calories = parseInt(calMatch[1], 10);
      recipe.nutrition.calories = recipe.calories;
    }

    // Parse ingredients
    if (currentSection === 'ingredients' && (line.startsWith('-') || line.startsWith('•') || line.match(/^\d+\./))) {
      const ingredient = parseIngredient(line);
      if (ingredient) recipe.ingredients.push(ingredient);
    }

    // Parse instructions
    if (currentSection === 'instructions' && (line.match(/^\d+[.)]/) || line.startsWith('-'))) {
      const instruction = parseInstruction(line, recipe.instructions.length + 1);
      if (instruction) recipe.instructions.push(instruction);
    }

    // Parse nutrition values
    if (currentSection === 'nutrition') {
      const proteinMatch = line.match(/protein[:\s]*(\d+)/i);
      const carbsMatch = line.match(/carb[s]?[:\s]*(\d+)/i);
      const fatMatch = line.match(/fat[:\s]*(\d+)/i);
      
      if (proteinMatch) recipe.nutrition.protein = parseInt(proteinMatch[1], 10);
      if (carbsMatch) recipe.nutrition.carbs = parseInt(carbsMatch[1], 10);
      if (fatMatch) recipe.nutrition.fat = parseInt(fatMatch[1], 10);
    }
  }

  // Generate tags from ingredients and title
  recipe.tags = generateTags(recipe);

  // Set description if not found
  if (!recipe.description) {
    recipe.description = `A delicious ${recipe.difficulty.toLowerCase()} recipe that serves ${recipe.servings} and takes about ${recipe.cookTime} minutes to prepare.`;
  }

  return recipe;
}

/**
 * Parse a single ingredient line
 */
function parseIngredient(line) {
  const cleanLine = line.replace(/^[-•\d.)\s]+/, '').trim();
  if (!cleanLine) return null;

  // Try to extract amount and unit
  const match = cleanLine.match(/^([\d\/\s.]+)?\s*(cup|cups|tbsp|tsp|oz|lb|g|kg|ml|liter|piece|pieces|clove|cloves)?\s*(.+)/i);
  
  if (match) {
    return {
      name: match[3]?.trim() || cleanLine,
      amount: match[1]?.trim() || '1',
      unit: match[2]?.toLowerCase() || 'piece',
      category: categorizeIngredient(cleanLine),
      notes: ''
    };
  }

  return {
    name: cleanLine,
    amount: '1',
    unit: 'piece',
    category: categorizeIngredient(cleanLine),
    notes: ''
  };
}

/**
 * Categorize ingredient by type
 */
function categorizeIngredient(ingredientName) {
  const lowerName = ingredientName.toLowerCase();
  
  const proteins = ['chicken', 'beef', 'pork', 'fish', 'shrimp', 'tofu', 'egg', 'turkey', 'lamb', 'salmon', 'tuna'];
  const grains = ['rice', 'pasta', 'bread', 'flour', 'oat', 'quinoa', 'noodle', 'wheat'];
  const seasonings = ['salt', 'pepper', 'garlic', 'paprika', 'cumin', 'oregano', 'basil', 'thyme', 'spice', 'powder'];
  const vegetables = ['onion', 'tomato', 'potato', 'carrot', 'pepper', 'broccoli', 'spinach', 'lettuce', 'celery', 'mushroom'];

  if (proteins.some(p => lowerName.includes(p))) return 'Protein';
  if (grains.some(g => lowerName.includes(g))) return 'Grain';
  if (seasonings.some(s => lowerName.includes(s))) return 'Seasoning';
  if (vegetables.some(v => lowerName.includes(v))) return 'Vegetable';
  
  return 'Other';
}

/**
 * Parse a single instruction step
 */
function parseInstruction(line, stepNumber) {
  const cleanLine = line.replace(/^\d+[.)]\s*/, '').trim();
  if (!cleanLine) return null;

  // Try to extract time from step
  const timeMatch = cleanLine.match(/(\d+)\s*(min|minute)/i);
  
  return {
    stepNumber,
    text: cleanLine,
    timeMinutes: timeMatch ? parseInt(timeMatch[1], 10) : null,
    tip: null
  };
}

/**
 * Generate tags from recipe content
 */
function generateTags(recipe) {
  const tags = [];
  
  // Add difficulty
  tags.push(recipe.difficulty);
  
  // Add time-based tags
  if (recipe.cookTime <= 20) tags.push('Quick');
  if (recipe.cookTime <= 30) tags.push('30-Minutes');
  
  // Add ingredient-based tags
  const ingredientNames = recipe.ingredients.map(i => i.name.toLowerCase()).join(' ');
  
  if (ingredientNames.includes('chicken')) tags.push('Chicken');
  if (ingredientNames.includes('beef')) tags.push('Beef');
  if (ingredientNames.includes('fish') || ingredientNames.includes('shrimp') || ingredientNames.includes('salmon')) tags.push('Seafood');
  if (ingredientNames.includes('rice')) tags.push('Rice');
  if (ingredientNames.includes('pasta') || ingredientNames.includes('noodle')) tags.push('Pasta');
  
  // Add other common tags
  if (recipe.servings >= 4) tags.push('Family-Friendly');
  if (recipe.calories && recipe.calories < 400) tags.push('Low-Calorie');
  
  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Save a new recipe to Firestore
 * @param {string} userId - User's UID
 * @param {Object} recipeData - Parsed recipe data
 * @returns {Object} Created recipe with ID
 */
async function saveRecipe(userId, recipeData) {
  if (!userId) throw new Error('User ID is required');
  
  const now = admin.firestore.Timestamp.now();
  
  const recipe = {
    ...recipeData,
    userId,
    status: 'Not Started',
    cookingProgress: {
      currentStep: -1,
      completedSteps: [],
      startedAt: null,
      completedAt: null
    },
    userRating: null,
    source: 'ai-generated',
    originalRecipeId: null,
    originalAuthorId: null,
    isPublic: false,
    shareCount: 0,
    createdAt: now,
    updatedAt: now,
    lastCookedAt: null
  };

  // Save to user's recipes subcollection
  const userRecipeRef = db.collection('users').doc(userId).collection('recipes').doc();
  recipe.id = userRecipeRef.id;
  await userRecipeRef.set(recipe);

  return recipe;
}

/**
 * Get all recipes for a user
 */
async function getUserRecipes(userId, status = null) {
  if (!userId) throw new Error('User ID is required');
  
  let query = db.collection('users').doc(userId).collection('recipes');
  
  if (status) {
    query = query.where('status', '==', status);
  }
  
  query = query.orderBy('createdAt', 'desc');
  
  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get a single recipe by ID
 */
async function getRecipe(userId, recipeId) {
  if (!userId || !recipeId) throw new Error('User ID and Recipe ID are required');
  
  const doc = await db.collection('users').doc(userId).collection('recipes').doc(recipeId).get();
  
  if (!doc.exists) throw new Error('Recipe not found');
  
  return { id: doc.id, ...doc.data() };
}

/**
 * Update cooking progress for a recipe
 */
async function updateCookingProgress(userId, recipeId, progressData) {
  if (!userId || !recipeId) throw new Error('User ID and Recipe ID are required');
  
  const recipeRef = db.collection('users').doc(userId).collection('recipes').doc(recipeId);
  const now = admin.firestore.Timestamp.now();
  
  const updates = {
    'cookingProgress.currentStep': progressData.currentStep,
    'cookingProgress.completedSteps': progressData.completedSteps,
    updatedAt: now
  };

  // Set startedAt if this is the first progress update
  if (progressData.startedAt) {
    updates['cookingProgress.startedAt'] = progressData.startedAt;
    updates['status'] = 'In Progress';
  }

  await recipeRef.update(updates);
  
  return { success: true };
}

/**
 * Mark a recipe as complete
 */
async function completeRecipe(userId, recipeId, rating = null) {
  if (!userId || !recipeId) throw new Error('User ID and Recipe ID are required');
  
  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();
  
  // Update recipe
  const recipeRef = db.collection('users').doc(userId).collection('recipes').doc(recipeId);
  batch.update(recipeRef, {
    status: 'Done',
    'cookingProgress.completedAt': now,
    userRating: rating,
    lastCookedAt: now,
    updatedAt: now
  });
  
  // Update user stats
  const userRef = db.collection('users').doc(userId);
  batch.update(userRef, {
    recipesCompleted: admin.firestore.FieldValue.increment(1),
    xp: admin.firestore.FieldValue.increment(50), // 50 XP per completed recipe
    updated_at: now
  });
  
  await batch.commit();
  
  // Calculate new level
  const userDoc = await userRef.get();
  const userData = userDoc.data();
  const newLevel = calculateLevel(userData.recipesCompleted || 0);
  
  if (userData.level !== newLevel) {
    await userRef.update({ level: newLevel });
  }
  
  return { success: true, newLevel };
}

/**
 * Calculate user level based on completed recipes
 */
function calculateLevel(recipesCompleted) {
  if (recipesCompleted >= 50) return 'Master Chef';
  if (recipesCompleted >= 30) return 'Expert';
  if (recipesCompleted >= 15) return 'Advanced';
  if (recipesCompleted >= 5) return 'Intermediate';
  return 'Beginner';
}

/**
 * Copy a recipe from community to user's archive
 */
async function copyRecipeToArchive(userId, originalRecipe, originalAuthorId) {
  if (!userId) throw new Error('User ID is required');
  
  const now = admin.firestore.Timestamp.now();
  
  // Create a copy with new ownership
  const recipeCopy = {
    ...originalRecipe,
    userId,
    id: null, // Will be set by Firestore
    status: 'Not Started',
    cookingProgress: {
      currentStep: -1,
      completedSteps: [],
      startedAt: null,
      completedAt: null
    },
    userRating: null,
    source: 'community',
    originalRecipeId: originalRecipe.id,
    originalAuthorId: originalAuthorId,
    isPublic: false,
    shareCount: 0,
    createdAt: now,
    updatedAt: now,
    lastCookedAt: null
  };

  const userRecipeRef = db.collection('users').doc(userId).collection('recipes').doc();
  recipeCopy.id = userRecipeRef.id;
  await userRecipeRef.set(recipeCopy);

  return recipeCopy;
}

module.exports = {
  parseAIRecipeResponse,
  saveRecipe,
  getUserRecipes,
  getRecipe,
  updateCookingProgress,
  completeRecipe,
  copyRecipeToArchive,
  calculateLevel
};
