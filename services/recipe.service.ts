// services/recipe.service.ts - Client-side recipe service
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import axios from 'axios';
import type { Recipe, CookingProgress, RecipeStatus } from '../types';

// API base URL
const API_BASE = Platform.select({
  android: 'http://10.0.2.2:5173',
  ios: 'http://localhost:5173',
  default: 'http://localhost:5173',
});

// Storage keys
const COOKING_PROGRESS_KEY = '@cheffy_cooking_progress';
const RECIPES_CACHE_KEY = '@cheffy_recipes_cache';

/**
 * Recipe Service - manages recipe CRUD and cooking state
 */
class RecipeService {
  /**
   * Get all recipes for a user
   */
  async getUserRecipes(userId: string, status?: RecipeStatus): Promise<Recipe[]> {
    try {
      const params = status ? `?status=${encodeURIComponent(status)}` : '';
      const response = await axios.get(`${API_BASE}/api/recipes/${userId}${params}`);
      
      if (response.data.ok) {
        // Cache recipes locally
        await this.cacheRecipes(userId, response.data.recipes);
        return response.data.recipes;
      }
      throw new Error(response.data.error || 'Failed to fetch recipes');
    } catch (error: any) {
      console.error('Error fetching recipes:', error);
      // Try to return cached recipes if network fails
      return this.getCachedRecipes(userId);
    }
  }

  /**
   * Get a single recipe by ID
   */
  async getRecipe(userId: string, recipeId: string): Promise<Recipe | null> {
    try {
      const response = await axios.get(`${API_BASE}/api/recipes/${userId}/${recipeId}`);
      
      if (response.data.ok) {
        return response.data.recipe;
      }
      throw new Error(response.data.error || 'Recipe not found');
    } catch (error: any) {
      console.error('Error fetching recipe:', error);
      return null;
    }
  }

  /**
   * Start cooking mode - initializes progress tracking
   */
  async startCookingMode(userId: string, recipeId: string): Promise<void> {
    const progress: CookingProgress = {
      currentStep: 0,
      completedSteps: [],
      startedAt: new Date(),
      completedAt: null,
    };

    // Save to local storage immediately for persistence
    await this.saveCookingProgress(userId, recipeId, progress);

    // Update server
    try {
      await axios.put(`${API_BASE}/api/recipes/${userId}/${recipeId}/progress`, {
        ...progress,
        startedAt: progress.startedAt,
      });
    } catch (error) {
      console.error('Error syncing cooking start:', error);
    }
  }

  /**
   * Toggle step completion
   */
  async toggleStepCompletion(
    userId: string,
    recipeId: string,
    stepIndex: number,
    currentProgress: CookingProgress
  ): Promise<CookingProgress> {
    const completedSteps = new Set(currentProgress.completedSteps);
    
    if (completedSteps.has(stepIndex)) {
      completedSteps.delete(stepIndex);
    } else {
      completedSteps.add(stepIndex);
    }

    const newProgress: CookingProgress = {
      ...currentProgress,
      currentStep: stepIndex,
      completedSteps: Array.from(completedSteps).sort((a, b) => a - b),
    };

    // Save locally first for instant feedback
    await this.saveCookingProgress(userId, recipeId, newProgress);

    // Sync with server (non-blocking)
    this.syncProgressToServer(userId, recipeId, newProgress).catch(console.error);

    return newProgress;
  }

  /**
   * Complete a recipe
   */
  async completeRecipe(userId: string, recipeId: string, rating?: number): Promise<{ success: boolean; newLevel?: string }> {
    try {
      const response = await axios.post(`${API_BASE}/api/recipes/${userId}/${recipeId}/complete`, {
        rating,
      });

      if (response.data.ok) {
        // Clear local cooking progress
        await this.clearCookingProgress(userId, recipeId);
        return { success: true, newLevel: response.data.newLevel };
      }
      throw new Error(response.data.error);
    } catch (error: any) {
      console.error('Error completing recipe:', error);
      return { success: false };
    }
  }

  /**
   * Copy a recipe from community to user's archive
   */
  async copyRecipeToArchive(userId: string, originalRecipe: Recipe): Promise<Recipe | null> {
    try {
      const response = await axios.post(`${API_BASE}/api/recipes/${userId}/copy`, {
        originalRecipe,
        originalAuthorId: originalRecipe.userId,
      });

      if (response.data.ok) {
        return response.data.recipe;
      }
      throw new Error(response.data.error);
    } catch (error: any) {
      console.error('Error copying recipe:', error);
      return null;
    }
  }

  // ==================== LOCAL STORAGE METHODS ====================

  /**
   * Save cooking progress to local storage
   */
  async saveCookingProgress(userId: string, recipeId: string, progress: CookingProgress): Promise<void> {
    try {
      const key = `${COOKING_PROGRESS_KEY}_${userId}_${recipeId}`;
      await AsyncStorage.setItem(key, JSON.stringify(progress));
    } catch (error) {
      console.error('Error saving cooking progress:', error);
    }
  }

  /**
   * Get cooking progress from local storage
   */
  async getCookingProgress(userId: string, recipeId: string): Promise<CookingProgress | null> {
    try {
      const key = `${COOKING_PROGRESS_KEY}_${userId}_${recipeId}`;
      const data = await AsyncStorage.getItem(key);
      
      if (data) {
        const progress = JSON.parse(data);
        // Convert date strings back to Date objects
        return {
          ...progress,
          startedAt: progress.startedAt ? new Date(progress.startedAt) : null,
          completedAt: progress.completedAt ? new Date(progress.completedAt) : null,
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting cooking progress:', error);
      return null;
    }
  }

  /**
   * Clear cooking progress from local storage
   */
  async clearCookingProgress(userId: string, recipeId: string): Promise<void> {
    try {
      const key = `${COOKING_PROGRESS_KEY}_${userId}_${recipeId}`;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing cooking progress:', error);
    }
  }

  /**
   * Get all active cooking sessions
   */
  async getAllActiveCookingSessions(userId: string): Promise<{ recipeId: string; progress: CookingProgress }[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const progressKeys = allKeys.filter(key => 
        key.startsWith(`${COOKING_PROGRESS_KEY}_${userId}_`)
      );

      const sessions: { recipeId: string; progress: CookingProgress }[] = [];
      
      for (const key of progressKeys) {
        const recipeId = key.replace(`${COOKING_PROGRESS_KEY}_${userId}_`, '');
        const progress = await this.getCookingProgress(userId, recipeId);
        if (progress) {
          sessions.push({ recipeId, progress });
        }
      }

      return sessions;
    } catch (error) {
      console.error('Error getting active sessions:', error);
      return [];
    }
  }

  /**
   * Cache recipes locally
   */
  private async cacheRecipes(userId: string, recipes: Recipe[]): Promise<void> {
    try {
      const key = `${RECIPES_CACHE_KEY}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(recipes));
    } catch (error) {
      console.error('Error caching recipes:', error);
    }
  }

  /**
   * Get cached recipes
   */
  private async getCachedRecipes(userId: string): Promise<Recipe[]> {
    try {
      const key = `${RECIPES_CACHE_KEY}_${userId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting cached recipes:', error);
      return [];
    }
  }

  /**
   * Sync progress to server (non-blocking)
   */
  private async syncProgressToServer(userId: string, recipeId: string, progress: CookingProgress): Promise<void> {
    await axios.put(`${API_BASE}/api/recipes/${userId}/${recipeId}/progress`, progress);
  }

  /**
   * Delete a recipe
   */
  async deleteRecipe(userId: string, recipeId: string): Promise<boolean> {
    try {
      const response = await axios.delete(`${API_BASE}/api/recipes/${userId}/${recipeId}`);
      
      if (response.data.ok) {
        // Also remove from local cache
        const cached = await this.getCachedRecipes(userId);
        const filtered = cached.filter(r => r.id !== recipeId);
        await this.cacheRecipes(userId, filtered);
        
        console.log(`🗑️ Recipe deleted: ${recipeId}`);
        return true;
      }
      
      throw new Error(response.data.error || 'Failed to delete recipe');
    } catch (error: any) {
      console.error('Error deleting recipe:', error);
      throw new Error(error.response?.data?.error || error.message || 'Failed to delete recipe');
    }
  }

  /**
   * Share a recipe to the community
   * Makes the recipe public and creates a community post
   * Awards +15 reward points for sharing
   */
  async shareRecipeToCommunity(recipeId: string, userId: string): Promise<{ success: boolean; error?: string; pointsAwarded?: number }> {
    try {
      const response = await axios.post(`${API_BASE}/api/recipes/${userId}/${recipeId}/share`, {
        userId,
      });

      if (response.data.ok) {
        // Update local cache to reflect public status
        const cached = await this.getCachedRecipes(userId);
        const updated = cached.map(r => 
          r.id === recipeId 
            ? { ...r, isPublic: true, sharedAt: new Date() }
            : r
        );
        await this.cacheRecipes(userId, updated);

        console.log(`📤 Recipe shared to community: ${recipeId}`);
        return { 
          success: true, 
          pointsAwarded: response.data.pointsAwarded || 15 
        };
      }

      throw new Error(response.data.error || 'Failed to share recipe');
    } catch (error: any) {
      console.error('Error sharing recipe:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || error.message || 'Failed to share recipe' 
      };
    }
  }

  /**
   * Unshare a recipe from the community
   * Makes the recipe private again
   * Note: Does NOT remove reward points that were already awarded
   */
  async unshareRecipe(recipeId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await axios.post(`${API_BASE}/api/recipes/${userId}/${recipeId}/unshare`, {
        userId,
      });

      if (response.data.ok) {
        // Update local cache to reflect private status
        const cached = await this.getCachedRecipes(userId);
        const updated = cached.map(r => 
          r.id === recipeId 
            ? { ...r, isPublic: false }
            : r
        );
        await this.cacheRecipes(userId, updated);

        console.log(`🔒 Recipe made private: ${recipeId}`);
        return { success: true };
      }

      throw new Error(response.data.error || 'Failed to unshare recipe');
    } catch (error: any) {
      console.error('Error unsharing recipe:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || error.message || 'Failed to unshare recipe' 
      };
    }
  }

  /**
   * Get all public recipes (for community feed)
   */
  async getPublicRecipes(limit: number = 20): Promise<Recipe[]> {
    try {
      const response = await axios.get(`${API_BASE}/api/recipes/public`, {
        params: { limit },
      });

      if (response.data.ok) {
        return response.data.recipes;
      }

      throw new Error(response.data.error || 'Failed to fetch public recipes');
    } catch (error: any) {
      console.error('Error fetching public recipes:', error);
      return [];
    }
  }
}

export const recipeService = new RecipeService();
export default recipeService;
