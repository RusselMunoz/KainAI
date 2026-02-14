// services/recipeService.ts - Recipe CRUD operations for Firebase/Firestore
// Handles recipe creation, retrieval, progress tracking, and completion

import { Platform } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDemoMode, generateId, logFirebaseOp, serverTimestamp, timestampToDate } from '../config/firebase';
import type { Recipe, RecipeStatus, CookingProgress, Ingredient, Instruction, Difficulty, Nutrition, RecipeSource } from '../types';

// API base URL for backend
const API_BASE = Platform.select({
  android: 'http://10.0.2.2:5173',
  ios: 'http://localhost:5173',
  default: 'http://localhost:5173',
});

// Storage keys for demo mode
const DEMO_RECIPES_KEY = '@kainai_demo_recipes';

/**
 * Recipe data for creation
 */
export interface RecipeData {
  title: string;
  description: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
  prepTime?: number;
  cookTime: number;
  totalTime?: number;
  servings: number;
  difficulty: Difficulty;
  calories: number;
  nutrition: Nutrition;
  tags: string[];
  category: string;
  source?: RecipeSource;
  originalRecipeId?: string;
  originalAuthorId?: string;
  isPublic?: boolean;
}

/**
 * Recipe Service class - handles all recipe-related Firebase operations
 */
class RecipeService {
  /**
   * Create a new recipe
   * Returns the new recipe ID
   */
  async createRecipe(userId: string, recipeData: RecipeData): Promise<string> {
    const recipeId = generateId();
    
    if (isDemoMode(userId)) {
      console.log('📝 [Demo] Creating recipe locally:', recipeId);
      try {
        const stored = await AsyncStorage.getItem(DEMO_RECIPES_KEY);
        const recipes: Recipe[] = stored ? JSON.parse(stored) : [];
        
        const newRecipe: Recipe = {
          id: recipeId,
          userId,
          title: recipeData.title,
          description: recipeData.description,
          ingredients: recipeData.ingredients,
          instructions: recipeData.instructions,
          prepTime: recipeData.prepTime,
          cookTime: recipeData.cookTime,
          totalTime: recipeData.totalTime || (recipeData.prepTime || 0) + recipeData.cookTime,
          servings: recipeData.servings,
          difficulty: recipeData.difficulty,
          calories: recipeData.calories,
          nutrition: recipeData.nutrition,
          tags: recipeData.tags,
          category: recipeData.category,
          status: 'Not Started',
          cookingProgress: {
            currentStep: 0,
            completedSteps: [],
            startedAt: null,
            completedAt: null,
          },
          userRating: null,
          source: recipeData.source || 'ai-generated',
          originalRecipeId: recipeData.originalRecipeId || null,
          originalAuthorId: recipeData.originalAuthorId || null,
          isPublic: recipeData.isPublic || false,
          shareCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastCookedAt: null,
        };
        
        recipes.push(newRecipe);
        await AsyncStorage.setItem(DEMO_RECIPES_KEY, JSON.stringify(recipes));
        
        return recipeId;
      } catch (error) {
        console.error('Error creating demo recipe:', error);
        throw error;
      }
    }

    try {
      logFirebaseOp('CREATE', 'recipes', recipeId);
      
      const newRecipe = {
        id: recipeId,
        userId,
        title: recipeData.title,
        description: recipeData.description,
        ingredients: recipeData.ingredients,
        instructions: recipeData.instructions,
        prepTime: recipeData.prepTime || 0,
        cookTime: recipeData.cookTime,
        totalTime: recipeData.totalTime || (recipeData.prepTime || 0) + recipeData.cookTime,
        servings: recipeData.servings,
        difficulty: recipeData.difficulty,
        calories: recipeData.calories,
        nutrition: recipeData.nutrition,
        tags: recipeData.tags,
        category: recipeData.category,
        status: 'Not Started',
        cookingProgress: {
          currentStep: 0,
          completedSteps: [],
          startedAt: null,
          completedAt: null,
        },
        userRating: null,
        source: recipeData.source || 'ai-generated',
        originalRecipeId: recipeData.originalRecipeId || null,
        originalAuthorId: recipeData.originalAuthorId || null,
        isPublic: recipeData.isPublic || false,
        shareCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastCookedAt: null,
      };

      await axios.post(`${API_BASE}/api/recipes/${userId}`, newRecipe);
      
      console.log('✅ Recipe created successfully:', recipeId);
      return recipeId;
    } catch (error: any) {
      console.error('❌ Error creating recipe:', error.message);
      throw error;
    }
  }

  /**
   * Get a single recipe by ID
   */
  async getRecipe(recipeId: string): Promise<Recipe | null> {
    // Check demo storage first
    try {
      const stored = await AsyncStorage.getItem(DEMO_RECIPES_KEY);
      if (stored) {
        const recipes: Recipe[] = JSON.parse(stored);
        const recipe = recipes.find(r => r.id === recipeId);
        if (recipe) {
          console.log('📖 [Demo] Found recipe locally:', recipeId);
          return this.parseRecipeDates(recipe);
        }
      }
    } catch (error) {
      console.error('Error checking demo recipes:', error);
    }

    try {
      logFirebaseOp('GET', 'recipes', recipeId);
      
      // Try to get from API (userId-agnostic endpoint)
      const response = await axios.get(`${API_BASE}/api/recipes/by-id/${recipeId}`);
      
      if (response.data.ok && response.data.recipe) {
        console.log('✅ Recipe fetched successfully:', recipeId);
        return this.parseRecipeDates(response.data.recipe);
      }
      
      return null;
    } catch (error: any) {
      console.error('❌ Error getting recipe:', error.message);
      return null;
    }
  }

  /**
   * Get user's recipes
   * Optionally filter by status
   */
  async getUserRecipes(userId: string, status?: 'in_progress' | 'completed'): Promise<Recipe[]> {
    if (isDemoMode(userId)) {
      console.log('📖 [Demo] Getting user recipes locally');
      try {
        const stored = await AsyncStorage.getItem(DEMO_RECIPES_KEY);
        if (stored) {
          let recipes: Recipe[] = JSON.parse(stored);
          
          // Filter by status if specified
          if (status === 'in_progress') {
            recipes = recipes.filter(r => r.status === 'In Progress');
          } else if (status === 'completed') {
            recipes = recipes.filter(r => r.status === 'Done');
          }
          
          return recipes.map(r => this.parseRecipeDates(r));
        }
        return [];
      } catch (error) {
        console.error('Error getting demo recipes:', error);
        return [];
      }
    }

    try {
      logFirebaseOp('QUERY', 'recipes', `user:${userId}`);
      
      let url = `${API_BASE}/api/recipes/${userId}`;
      if (status) {
        const statusMap = {
          'in_progress': 'In Progress',
          'completed': 'Done',
        };
        url += `?status=${encodeURIComponent(statusMap[status])}`;
      }
      
      const response = await axios.get(url);
      
      if (response.data.ok && response.data.recipes) {
        console.log(`✅ Fetched ${response.data.recipes.length} recipes for user:`, userId);
        return response.data.recipes.map((r: any) => this.parseRecipeDates(r));
      }
      
      return [];
    } catch (error: any) {
      console.error('❌ Error getting user recipes:', error.message);
      return [];
    }
  }

  /**
   * Update recipe progress (completed steps)
   */
  async updateRecipeProgress(recipeId: string, completedSteps: number[]): Promise<void> {
    // Check demo storage first
    try {
      const stored = await AsyncStorage.getItem(DEMO_RECIPES_KEY);
      if (stored) {
        const recipes: Recipe[] = JSON.parse(stored);
        const index = recipes.findIndex(r => r.id === recipeId);
        if (index !== -1) {
          console.log('📝 [Demo] Updating recipe progress locally');
          recipes[index].cookingProgress.completedSteps = completedSteps;
          recipes[index].cookingProgress.currentStep = Math.max(...completedSteps, 0);
          recipes[index].status = 'In Progress';
          recipes[index].updatedAt = new Date();
          if (!recipes[index].cookingProgress.startedAt) {
            recipes[index].cookingProgress.startedAt = new Date();
          }
          await AsyncStorage.setItem(DEMO_RECIPES_KEY, JSON.stringify(recipes));
          return;
        }
      }
    } catch (error) {
      console.error('Error updating demo recipe progress:', error);
    }

    try {
      logFirebaseOp('UPDATE', 'recipes', recipeId);
      
      await axios.patch(`${API_BASE}/api/recipes/progress/${recipeId}`, {
        completedSteps,
        currentStep: Math.max(...completedSteps, 0),
        status: 'In Progress',
      });
      
      console.log('✅ Recipe progress updated:', recipeId);
    } catch (error: any) {
      console.error('❌ Error updating recipe progress:', error.message);
      throw error;
    }
  }

  /**
   * Complete a recipe (mark as done, award XP)
   */
  async completeRecipe(recipeId: string, userId: string, photoUrl?: string): Promise<void> {
    // Handle demo mode
    try {
      const stored = await AsyncStorage.getItem(DEMO_RECIPES_KEY);
      if (stored) {
        const recipes: Recipe[] = JSON.parse(stored);
        const index = recipes.findIndex(r => r.id === recipeId);
        if (index !== -1 && isDemoMode(userId)) {
          console.log('✅ [Demo] Completing recipe locally');
          recipes[index].status = 'Done';
          recipes[index].cookingProgress.completedAt = new Date();
          recipes[index].lastCookedAt = new Date();
          recipes[index].updatedAt = new Date();
          await AsyncStorage.setItem(DEMO_RECIPES_KEY, JSON.stringify(recipes));
          return;
        }
      }
    } catch (error) {
      console.error('Error completing demo recipe:', error);
    }

    try {
      logFirebaseOp('UPDATE', 'recipes', recipeId);
      
      await axios.post(`${API_BASE}/api/recipes/${userId}/${recipeId}/complete`, {
        photoUrl,
        completedAt: serverTimestamp(),
      });
      
      console.log('✅ Recipe completed:', recipeId);
    } catch (error: any) {
      console.error('❌ Error completing recipe:', error.message);
      throw error;
    }
  }

  /**
   * Delete a recipe
   */
  async deleteRecipe(recipeId: string, userId: string): Promise<void> {
    // Handle demo mode
    if (isDemoMode(userId)) {
      console.log('🗑️ [Demo] Deleting recipe locally:', recipeId);
      try {
        const stored = await AsyncStorage.getItem(DEMO_RECIPES_KEY);
        if (stored) {
          const recipes: Recipe[] = JSON.parse(stored);
          const filtered = recipes.filter(r => r.id !== recipeId);
          await AsyncStorage.setItem(DEMO_RECIPES_KEY, JSON.stringify(filtered));
        }
        return;
      } catch (error) {
        console.error('Error deleting demo recipe:', error);
        throw error;
      }
    }

    try {
      logFirebaseOp('DELETE', 'recipes', recipeId);
      
      await axios.delete(`${API_BASE}/api/recipes/${userId}/${recipeId}`);
      
      console.log('✅ Recipe deleted:', recipeId);
    } catch (error: any) {
      console.error('❌ Error deleting recipe:', error.message);
      throw error;
    }
  }

  /**
   * Update recipe rating
   */
  async updateRecipeRating(recipeId: string, userId: string, rating: number): Promise<void> {
    // Handle demo mode
    try {
      const stored = await AsyncStorage.getItem(DEMO_RECIPES_KEY);
      if (stored) {
        const recipes: Recipe[] = JSON.parse(stored);
        const index = recipes.findIndex(r => r.id === recipeId);
        if (index !== -1) {
          console.log('⭐ [Demo] Updating recipe rating locally');
          recipes[index].userRating = rating;
          recipes[index].updatedAt = new Date();
          await AsyncStorage.setItem(DEMO_RECIPES_KEY, JSON.stringify(recipes));
          if (isDemoMode(userId)) return;
        }
      }
    } catch (error) {
      console.error('Error updating demo recipe rating:', error);
    }

    try {
      logFirebaseOp('UPDATE', 'recipes', recipeId);
      
      await axios.patch(`${API_BASE}/api/recipes/${userId}/${recipeId}/rating`, {
        rating,
      });
      
      console.log('✅ Recipe rating updated:', rating);
    } catch (error: any) {
      console.error('❌ Error updating recipe rating:', error.message);
      throw error;
    }
  }

  /**
   * Make recipe public (share to community)
   */
  async makeRecipePublic(recipeId: string, userId: string): Promise<void> {
    // Handle demo mode
    try {
      const stored = await AsyncStorage.getItem(DEMO_RECIPES_KEY);
      if (stored) {
        const recipes: Recipe[] = JSON.parse(stored);
        const index = recipes.findIndex(r => r.id === recipeId);
        if (index !== -1) {
          console.log('🌍 [Demo] Making recipe public locally');
          recipes[index].isPublic = true;
          recipes[index].updatedAt = new Date();
          await AsyncStorage.setItem(DEMO_RECIPES_KEY, JSON.stringify(recipes));
          if (isDemoMode(userId)) return;
        }
      }
    } catch (error) {
      console.error('Error making demo recipe public:', error);
    }

    try {
      logFirebaseOp('UPDATE', 'recipes', recipeId);
      
      await axios.patch(`${API_BASE}/api/recipes/${userId}/${recipeId}/visibility`, {
        isPublic: true,
      });
      
      console.log('✅ Recipe made public:', recipeId);
    } catch (error: any) {
      console.error('❌ Error making recipe public:', error.message);
      throw error;
    }
  }

  /**
   * Copy a recipe from community to user's archive
   */
  async copyRecipeToArchive(userId: string, originalRecipe: Recipe): Promise<string> {
    const recipeData: RecipeData = {
      title: originalRecipe.title,
      description: originalRecipe.description,
      ingredients: originalRecipe.ingredients,
      instructions: originalRecipe.instructions,
      prepTime: originalRecipe.prepTime,
      cookTime: originalRecipe.cookTime,
      totalTime: originalRecipe.totalTime,
      servings: originalRecipe.servings,
      difficulty: originalRecipe.difficulty,
      calories: originalRecipe.calories,
      nutrition: originalRecipe.nutrition,
      tags: originalRecipe.tags,
      category: originalRecipe.category,
      source: 'community',
      originalRecipeId: originalRecipe.id,
      originalAuthorId: originalRecipe.userId,
      isPublic: false,
    };

    return this.createRecipe(userId, recipeData);
  }

  /**
   * Helper: Parse recipe date fields
   */
  private parseRecipeDates(recipe: any): Recipe {
    return {
      ...recipe,
      createdAt: timestampToDate(recipe.createdAt),
      updatedAt: timestampToDate(recipe.updatedAt),
      lastCookedAt: recipe.lastCookedAt ? timestampToDate(recipe.lastCookedAt) : null,
      cookingProgress: {
        ...recipe.cookingProgress,
        startedAt: recipe.cookingProgress?.startedAt ? timestampToDate(recipe.cookingProgress.startedAt) : null,
        completedAt: recipe.cookingProgress?.completedAt ? timestampToDate(recipe.cookingProgress.completedAt) : null,
      },
    };
  }
}

export const recipeService = new RecipeService();
export default recipeService;
