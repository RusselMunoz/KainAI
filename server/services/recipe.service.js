// services/recipe.service.js
const admin = require('firebase-admin');
const db = admin.firestore();

// ==================== IN-MEMORY DEMO STORAGE ====================
// Stores demo recipes in memory - cleared on server restart
const demoRecipeStore = new Map();

/**
 * Check if this is a demo user
 */
function isDemoUser(userId) {
  return userId && userId.startsWith('demo-');
}

/**
 * Generate a unique demo recipe ID
 */
function generateDemoRecipeId() {
  return 'demo-recipe-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
}

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
    prepTime: 10,
    cookTime: 20,
    totalTime: 30,
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

    // Parse cooking time - handle prep time, cook time, and total time
    const timeMatch = line.match(/(\d+)\s*(min|minute)/i);
    if (timeMatch) {
      const timeValue = parseInt(timeMatch[1], 10);
      if (lowerLine.includes('prep')) {
        recipe.prepTime = timeValue;
      } else if (lowerLine.includes('cook') && !lowerLine.includes('total')) {
        recipe.cookTime = timeValue;
      } else if (lowerLine.includes('total')) {
        recipe.totalTime = timeValue;
      } else if (lowerLine.includes('time')) {
        // Generic "time" - assume cook time
        recipe.cookTime = timeValue;
      }
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

    // Parse calories - handle multiple formats:
    // "420 cal", "420 kcal", "Calories: 420", "Calories: 420 per serving"
    // Also handle comma-separated numbers like "1,200"
    const calMatch = line.match(/(\d[,\d]*)\s*(cal|kcal|calorie)/i);
    const calMatch2 = line.match(/calorie[s]?[:\s]+?(\d[,\d]*)/i);
    if (calMatch) {
      let parsedCal = parseInt(calMatch[1].replace(/,/g, ''), 10);
      // Validate: per-serving should be 50-1500 range for most recipes
      // If it's too high, it might be total calories - divide by servings
      if (parsedCal > 1500 && recipe.servings > 1) {
        parsedCal = Math.round(parsedCal / recipe.servings);
      }
      // Cap at reasonable max (1500 cal per serving is high but possible)
      recipe.calories = Math.min(parsedCal, 1500);
      recipe.nutrition.calories = recipe.calories;
    } else if (calMatch2) {
      let parsedCal = parseInt(calMatch2[1].replace(/,/g, ''), 10);
      if (parsedCal > 1500 && recipe.servings > 1) {
        parsedCal = Math.round(parsedCal / recipe.servings);
      }
      recipe.calories = Math.min(parsedCal, 1500);
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

  // Calculate totalTime if not explicitly provided
  if (!recipe.totalTime || recipe.totalTime === 30) {
    recipe.totalTime = recipe.prepTime + recipe.cookTime;
  }

  // Estimate calories if not parsed from AI response
  if (!recipe.calories || recipe.calories === 0) {
    recipe.calories = estimateCalories(recipe.ingredients);
    recipe.nutrition.calories = recipe.calories;
  }

  // Generate tags from ingredients and title
  recipe.tags = generateTags(recipe);

  // Set description if not found
  if (!recipe.description) {
    recipe.description = `A delicious ${recipe.difficulty.toLowerCase()} recipe that serves ${recipe.servings}. Prep: ${recipe.prepTime} mins, Cook: ${recipe.cookTime} mins.`;
  }

  return recipe;
}

/**
 * Parse a single ingredient line
 */
function parseIngredient(line) {
  // Clean the line - remove bullets, numbers, and sanitize encoding
  let cleanLine = line.replace(/^[-•\d.)\s]+/, '').trim();
  if (!cleanLine) return null;

  // Fix common encoding issues
  cleanLine = cleanLine
    .replace(/[]/g, '')  // Remove replacement characters
    .replace(/â€"/g, '-')   // Fix dashes
    .replace(/â€™/g, "'")   // Fix apostrophes
    .replace(/Â/g, '')      // Remove Â character
    .trim();

  // Normalize unicode fractions to ASCII
  const fractionMap = {
    '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4',
    '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5',
    '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8'
  };
  for (const [unicode, ascii] of Object.entries(fractionMap)) {
    cleanLine = cleanLine.replace(new RegExp(unicode, 'g'), ascii);
  }

  // Try to extract amount and unit with improved regex
  // Handles: "1/4 cup soy sauce", "2 tbsp oil", "3 cloves garlic", "salt (to taste)"
  const match = cleanLine.match(/^([\d\/\s.]+)?\s*(cups?|tbsps?|tsps?|oz|lbs?|g|kg|ml|liters?|pieces?|cloves?|stalks?|heads?|bunches?|cans?|pinch|dash)?\s*[of]?\s*(.+)/i);
  
  if (match) {
    let amount = match[1]?.trim();
    const unit = match[2]?.toLowerCase()?.replace(/s$/, '') || 'piece'; // Normalize plurals
    let name = match[3]?.trim() || cleanLine;
    
    // Validate amount - don't use null or empty string
    if (!amount || amount === '' || amount === 'null' || amount === 'undefined') {
      amount = '1';
    }
    
    // Clean name - remove any leftover "of" and parenthetical notes
    name = name.replace(/^of\s+/i, '').trim();
    
    return {
      name: name || cleanLine,
      amount: amount,
      unit: unit,
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
 * Estimate calories based on ingredients when AI doesn't provide them
 * Returns estimated calories per serving
 */
function estimateCalories(ingredients) {
  // Approximate calories per ingredient type (very rough estimates)
  const calorieEstimates = {
    // Proteins (per typical serving)
    'chicken': 200, 'beef': 250, 'pork': 230, 'fish': 150, 'salmon': 200,
    'shrimp': 100, 'tofu': 80, 'egg': 70, 'turkey': 180, 'lamb': 250, 'tuna': 120,
    // Grains (per cup cooked)
    'rice': 200, 'pasta': 220, 'noodle': 200, 'bread': 80, 'flour': 50,
    'quinoa': 180, 'oat': 150,
    // Vegetables (generally low)
    'onion': 30, 'tomato': 20, 'potato': 150, 'carrot': 25, 'pepper': 20,
    'broccoli': 30, 'spinach': 10, 'lettuce': 10, 'celery': 10, 'mushroom': 20,
    // Fats/oils
    'oil': 120, 'butter': 100, 'cheese': 110, 'cream': 80,
    // Default for unrecognized
    'default': 30
  };

  let totalCalories = 0;
  
  for (const ingredient of ingredients) {
    const name = ingredient.name.toLowerCase();
    let found = false;
    
    for (const [key, calories] of Object.entries(calorieEstimates)) {
      if (name.includes(key)) {
        totalCalories += calories;
        found = true;
        break;
      }
    }
    
    if (!found) {
      totalCalories += calorieEstimates.default;
    }
  }

  // Return reasonable estimate (minimum 100, cap at 800 for estimation)
  return Math.max(100, Math.min(totalCalories, 800));
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
  
  // Add time-based tags (use totalTime for accurate categorization)
  const totalTime = recipe.totalTime || (recipe.prepTime + recipe.cookTime);
  if (totalTime <= 20) tags.push('Quick');
  if (totalTime <= 30) tags.push('30-Minutes');
  if (totalTime <= 15) tags.push('15-Minutes');
  
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
 * Save a new recipe to Firestore (or in-memory for demo users)
 * @param {string} userId - User's UID
 * @param {Object} recipeData - Parsed recipe data
 * @returns {Object} Created recipe with ID
 */
async function saveRecipe(userId, recipeData) {
  if (!userId) throw new Error('User ID is required');
  
  console.log(`\n📥 saveRecipe called for userId: ${userId}`);
  console.log(`   Recipe title: ${recipeData?.title || 'No title'}`);
  
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

  // Use in-memory storage for demo users (clears on server restart)
  if (isDemoUser(userId)) {
    recipe.id = generateDemoRecipeId();
    
    // Get or create user's recipe list
    if (!demoRecipeStore.has(userId)) {
      demoRecipeStore.set(userId, []);
    }
    demoRecipeStore.get(userId).unshift(recipe); // Add to beginning (newest first)
    
    console.log(`📝 Demo recipe saved in-memory: ${recipe.id} (total: ${demoRecipeStore.get(userId).length})`);
    return recipe;
  }

  // For real users, save to Firestore
  const userRecipeRef = db.collection('users').doc(userId).collection('recipes').doc();
  recipe.id = userRecipeRef.id;
  
  console.log(`   📁 Saving to Firestore path: users/${userId}/recipes/${recipe.id}`);
  await userRecipeRef.set(recipe);
  console.log(`   ✅ Recipe saved successfully: ${recipe.id}`);

  return recipe;
}

/**
 * Get all recipes for a user
 */
async function getUserRecipes(userId, status = null) {
  if (!userId) throw new Error('User ID is required');
  
  console.log(`\n📋 getUserRecipes called for userId: ${userId}, status filter: ${status || 'none'}`);
  
  // Use in-memory storage for demo users
  if (isDemoUser(userId)) {
    let recipes = demoRecipeStore.get(userId) || [];
    if (status) {
      recipes = recipes.filter(r => r.status === status);
    }
    console.log(`   📋 Demo user recipes fetched: ${recipes.length} recipes`);
    return recipes;
  }
  
  // For real users, query Firestore
  console.log(`   📁 Querying Firestore path: users/${userId}/recipes`);
  let query = db.collection('users').doc(userId).collection('recipes');
  
  if (status) {
    query = query.where('status', '==', status);
  }
  
  query = query.orderBy('createdAt', 'desc');
  
  const snapshot = await query.get();
  const recipes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`   ✅ Found ${recipes.length} recipes for user ${userId}`);
  if (recipes.length > 0) {
    console.log(`   📝 Recipe titles: ${recipes.map(r => r.title).join(', ')}`);
  }
  return recipes;
}

/**
 * Get a single recipe by ID
 */
async function getRecipe(userId, recipeId) {
  if (!userId || !recipeId) throw new Error('User ID and Recipe ID are required');
  
  // Use in-memory storage for demo users
  if (isDemoUser(userId)) {
    const recipes = demoRecipeStore.get(userId) || [];
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) throw new Error('Recipe not found');
    console.log(`🔍 Demo recipe fetched: ${recipeId}`);
    return recipe;
  }
  
  // For real users, query Firestore
  const doc = await db.collection('users').doc(userId).collection('recipes').doc(recipeId).get();
  
  if (!doc.exists) throw new Error('Recipe not found');
  
  return { id: doc.id, ...doc.data() };
}

/**
 * Update cooking progress for a recipe
 */
async function updateCookingProgress(userId, recipeId, progressData) {
  if (!userId || !recipeId) throw new Error('User ID and Recipe ID are required');
  
  const now = admin.firestore.Timestamp.now();
  
  // Use in-memory storage for demo users
  if (isDemoUser(userId)) {
    const recipes = demoRecipeStore.get(userId) || [];
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) throw new Error('Recipe not found');
    
    recipe.cookingProgress.currentStep = progressData.currentStep;
    recipe.cookingProgress.completedSteps = progressData.completedSteps;
    recipe.updatedAt = now;
    
    if (progressData.startedAt) {
      recipe.cookingProgress.startedAt = progressData.startedAt;
      recipe.status = 'In Progress';
    }
    
    console.log(`🍳 Demo recipe progress updated: ${recipeId}`);
    return { success: true };
  }
  
  // For real users, update Firestore
  const recipeRef = db.collection('users').doc(userId).collection('recipes').doc(recipeId);
  
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
  
  // Use in-memory storage for demo users
  if (isDemoUser(userId)) {
    const recipes = demoRecipeStore.get(userId) || [];
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) throw new Error('Recipe not found');
    
    recipe.status = 'Done';
    recipe.cookingProgress.completedAt = now;
    recipe.userRating = rating;
    recipe.lastCookedAt = now;
    recipe.updatedAt = now;
    
    console.log(`✅ Demo recipe completed: ${recipeId}`);
    return { success: true, newLevel: 'Beginner' };
  }
  
  // For real users, update Firestore
  const recipeRef = db.collection('users').doc(userId).collection('recipes').doc(recipeId);
  
  // Check if recipe exists
  const recipeDoc = await recipeRef.get();
  if (!recipeDoc.exists) {
    throw new Error('Recipe not found');
  }
  
  await recipeRef.update({
    status: 'Done',
    'cookingProgress.completedAt': now,
    userRating: rating,
    lastCookedAt: now,
    updatedAt: now
  });
  
  // Update user stats - use set with merge in case user doc doesn't exist (demo mode)
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  
  let recipesCompleted = 1;
  let currentXP = 50;
  let currentLevel = 'Beginner';
  
  if (userDoc.exists) {
    const userData = userDoc.data();
    recipesCompleted = (userData.recipesCompleted || 0) + 1;
    currentXP = (userData.xp || 0) + 50;
    currentLevel = calculateLevel(recipesCompleted);
    
    await userRef.update({
      recipesCompleted: recipesCompleted,
      xp: currentXP,
      level: currentLevel,
      updated_at: now
    });
  } else {
    // Create user document if it doesn't exist (demo mode)
    currentLevel = calculateLevel(recipesCompleted);
    await userRef.set({
      recipesCompleted: recipesCompleted,
      xp: currentXP,
      level: currentLevel,
      created_at: now,
      updated_at: now
    }, { merge: true });
  }
  
  // Update secondary user_stats collection for leaderboard
  const xpAwarded = 50;
  const userData = userDoc.exists ? userDoc.data() : {};
  
  await db.collection('user_stats').doc(userId).set({
    userId: userId,
    displayName: userData.displayName || userData.username || 'Anonymous',
    xp: admin.firestore.FieldValue.increment(xpAwarded), // Mirroring for leaderboard sorting
    totalXP: admin.firestore.FieldValue.increment(xpAwarded),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  
  return { success: true, newLevel: currentLevel };
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

/**
 * Delete a recipe
 */
async function deleteRecipe(userId, recipeId) {
  if (!userId || !recipeId) throw new Error('User ID and Recipe ID are required');
  
  // Use in-memory storage for demo users
  if (isDemoUser(userId)) {
    const recipes = demoRecipeStore.get(userId) || [];
    const index = recipes.findIndex(r => r.id === recipeId);
    
    if (index === -1) {
      throw new Error('Recipe not found');
    }
    
    recipes.splice(index, 1);
    console.log(`🗑️ Demo recipe deleted: ${recipeId}`);
    return { success: true };
  }
  
  // For real users, delete from Firestore
  const recipeRef = db.collection('users').doc(userId).collection('recipes').doc(recipeId);
  
  // Check if recipe exists
  const doc = await recipeRef.get();
  if (!doc.exists) {
    throw new Error('Recipe not found');
  }
  
  await recipeRef.delete();
  console.log(`🗑️ Recipe deleted: ${recipeId}`);
  return { success: true };
}

/**
 * Share a recipe to the community
 * Makes the recipe public, creates a community post, and awards points
 */
async function shareRecipeToCommunity(userId, recipeId) {
  if (!userId || !recipeId) throw new Error('User ID and Recipe ID are required');
  
  // Use in-memory storage for demo users
  if (isDemoUser(userId)) {
    const recipes = demoRecipeStore.get(userId) || [];
    const recipe = recipes.find(r => r.id === recipeId);
    
    if (!recipe) {
      throw new Error('Recipe not found');
    }
    
    if (recipe.isPublic) {
      throw new Error('Recipe is already shared to the community');
    }
    
    recipe.isPublic = true;
    recipe.sharedAt = new Date();
    recipe.shareCount = (recipe.shareCount || 0) + 1;
    recipe.updatedAt = new Date();
    
    console.log(`📤 Demo recipe shared to community: ${recipeId}`);
    return { success: true, pointsAwarded: 15 };
  }
  
  // For real users, update in Firestore
  const recipeRef = db.collection('users').doc(userId).collection('recipes').doc(recipeId);
  const doc = await recipeRef.get();
  
  if (!doc.exists) {
    throw new Error('Recipe not found');
  }
  
  const recipe = doc.data();
  
  if (recipe.isPublic) {
    throw new Error('Recipe is already shared to the community');
  }
  
  // Verify ownership
  if (recipe.userId !== userId) {
    throw new Error('You can only share your own recipes');
  }
  
  const now = admin.firestore.FieldValue.serverTimestamp();
  
  // Update recipe to be public
  await recipeRef.update({
    isPublic: true,
    sharedAt: now,
    shareCount: admin.firestore.FieldValue.increment(1),
    updatedAt: now
  });
  
  // Award reward points (+15 for sharing)
  const userRef = db.collection('users').doc(userId);
  await userRef.update({
    rewardPoints: admin.firestore.FieldValue.increment(15),
    recipesShared: admin.firestore.FieldValue.increment(1),
    updated_at: now
  });
  
  // Create a community post for this shared recipe
  const communityPostRef = db.collection('community_posts').doc();
  await communityPostRef.set({
    id: communityPostRef.id,
    authorId: userId,
    type: 'recipe',
    title: recipe.title,
    content: recipe.description || `Check out my recipe: ${recipe.title}!`,
    recipeId: recipeId,
    recipeTitle: recipe.title,
    recipeThumbnail: null,
    images: [],
    tags: recipe.tags || [],
    rating: recipe.userRating || 0,
    likesCount: 0,
    commentsCount: 0,
    savesCount: 0,
    likedBy: [],
    savedBy: [],
    isTrending: false,
    isFeatured: false,
    isPublic: true,
    createdAt: now,
    updatedAt: now
  });
  
  console.log(`📤 Recipe shared to community: ${recipeId}`);
  return { success: true, pointsAwarded: 15, communityPostId: communityPostRef.id };
}

/**
 * Unshare a recipe from the community
 * Makes the recipe private again
 */
async function unshareRecipe(userId, recipeId) {
  if (!userId || !recipeId) throw new Error('User ID and Recipe ID are required');
  
  // Use in-memory storage for demo users
  if (isDemoUser(userId)) {
    const recipes = demoRecipeStore.get(userId) || [];
    const recipe = recipes.find(r => r.id === recipeId);
    
    if (!recipe) {
      throw new Error('Recipe not found');
    }
    
    if (!recipe.isPublic) {
      throw new Error('Recipe is already private');
    }
    
    recipe.isPublic = false;
    recipe.updatedAt = new Date();
    
    console.log(`🔒 Demo recipe made private: ${recipeId}`);
    return { success: true };
  }
  
  // For real users, update in Firestore
  const recipeRef = db.collection('users').doc(userId).collection('recipes').doc(recipeId);
  const doc = await recipeRef.get();
  
  if (!doc.exists) {
    throw new Error('Recipe not found');
  }
  
  const recipe = doc.data();
  
  if (!recipe.isPublic) {
    throw new Error('Recipe is already private');
  }
  
  // Verify ownership
  if (recipe.userId !== userId) {
    throw new Error('You can only unshare your own recipes');
  }
  
  const now = admin.firestore.FieldValue.serverTimestamp();
  
  // Update recipe to be private
  await recipeRef.update({
    isPublic: false,
    updatedAt: now
  });
  
  // Find and delete the associated community post
  const communityPostsQuery = db.collection('community_posts')
    .where('recipeId', '==', recipeId)
    .where('authorId', '==', userId)
    .limit(1);
  
  const snapshot = await communityPostsQuery.get();
  if (!snapshot.empty) {
    await snapshot.docs[0].ref.delete();
  }
  
  console.log(`🔒 Recipe made private: ${recipeId}`);
  return { success: true };
}

/**
 * Get all public recipes from all users
 */
async function getPublicRecipes(limit = 20) {
  const publicRecipes = [];
  
  // For demo mode, check all demo recipes
  for (const [userId, recipes] of demoRecipeStore) {
    const userPublicRecipes = recipes.filter(r => r.isPublic);
    publicRecipes.push(...userPublicRecipes);
  }
  
  // Query Firestore for public recipes using collection group query
  try {
    const snapshot = await db.collectionGroup('recipes')
      .where('isPublic', '==', true)
      .orderBy('sharedAt', 'desc')
      .limit(limit)
      .get();
    
    snapshot.forEach(doc => {
      publicRecipes.push({ id: doc.id, ...doc.data() });
    });
  } catch (err) {
    console.warn('Error querying public recipes (index may need to be created):', err.message);
    // Fall back to simpler query without ordering
    try {
      const snapshot = await db.collectionGroup('recipes')
        .where('isPublic', '==', true)
        .limit(limit)
        .get();
      
      snapshot.forEach(doc => {
        publicRecipes.push({ id: doc.id, ...doc.data() });
      });
    } catch (fallbackErr) {
      console.warn('Fallback query also failed:', fallbackErr.message);
    }
  }
  
  return publicRecipes.slice(0, limit);
}

module.exports = {
  parseAIRecipeResponse,
  saveRecipe,
  getUserRecipes,
  getRecipe,
  updateCookingProgress,
  completeRecipe,
  deleteRecipe,
  copyRecipeToArchive,
  calculateLevel,
  shareRecipeToCommunity,
  unshareRecipe,
  getPublicRecipes
};
