// hooks/useCookingProgress.ts - Hook for managing cooking progress state
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CookingProgress } from '../types';

const COOKING_PROGRESS_PREFIX = '@cheffy_cooking_progress_';

interface UseCookingProgressOptions {
  userId: string;
  recipeId: string;
  totalSteps: number;
}

interface UseCookingProgressReturn {
  progress: CookingProgress;
  isLoading: boolean;
  startCooking: () => Promise<void>;
  toggleStep: (stepIndex: number) => Promise<void>;
  resetProgress: () => Promise<void>;
  isStepCompleted: (stepIndex: number) => boolean;
  allStepsCompleted: boolean;
  completionPercentage: number;
}

/**
 * Custom hook for managing cooking progress with persistence
 * Automatically saves progress to AsyncStorage to survive app closure
 */
export function useCookingProgress({
  userId,
  recipeId,
  totalSteps,
}: UseCookingProgressOptions): UseCookingProgressReturn {
  const [progress, setProgress] = useState<CookingProgress>({
    currentStep: -1,
    completedSteps: [],
    startedAt: null,
    completedAt: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = `${COOKING_PROGRESS_PREFIX}${userId}_${recipeId}`;

  // Load saved progress on mount
  useEffect(() => {
    loadProgress();
  }, [userId, recipeId]);

  // Auto-save progress whenever it changes
  useEffect(() => {
    if (!isLoading && progress.startedAt) {
      saveProgress(progress);
    }
  }, [progress, isLoading]);

  const loadProgress = async () => {
    try {
      const saved = await AsyncStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setProgress({
          ...parsed,
          startedAt: parsed.startedAt ? new Date(parsed.startedAt) : null,
          completedAt: parsed.completedAt ? new Date(parsed.completedAt) : null,
        });
      }
    } catch (error) {
      console.error('Error loading cooking progress:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProgress = async (data: CookingProgress) => {
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving cooking progress:', error);
    }
  };

  const startCooking = useCallback(async () => {
    const newProgress: CookingProgress = {
      currentStep: 0,
      completedSteps: [],
      startedAt: new Date(),
      completedAt: null,
    };
    setProgress(newProgress);
    await saveProgress(newProgress);
  }, [storageKey]);

  const toggleStep = useCallback(async (stepIndex: number) => {
    setProgress(prev => {
      const completedSteps = new Set(prev.completedSteps);
      
      if (completedSteps.has(stepIndex)) {
        completedSteps.delete(stepIndex);
      } else {
        completedSteps.add(stepIndex);
      }

      return {
        ...prev,
        currentStep: stepIndex,
        completedSteps: Array.from(completedSteps).sort((a, b) => a - b),
      };
    });
  }, []);

  const resetProgress = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(storageKey);
      setProgress({
        currentStep: -1,
        completedSteps: [],
        startedAt: null,
        completedAt: null,
      });
    } catch (error) {
      console.error('Error resetting cooking progress:', error);
    }
  }, [storageKey]);

  const isStepCompleted = useCallback((stepIndex: number) => {
    return progress.completedSteps.includes(stepIndex);
  }, [progress.completedSteps]);

  const allStepsCompleted = progress.completedSteps.length === totalSteps && totalSteps > 0;

  const completionPercentage = totalSteps > 0 
    ? Math.round((progress.completedSteps.length / totalSteps) * 100)
    : 0;

  return {
    progress,
    isLoading,
    startCooking,
    toggleStep,
    resetProgress,
    isStepCompleted,
    allStepsCompleted,
    completionPercentage,
  };
}

/**
 * Get all active cooking sessions for a user
 */
export async function getActiveCookingSessions(userId: string): Promise<string[]> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const prefix = `${COOKING_PROGRESS_PREFIX}${userId}_`;
    
    const sessionKeys = allKeys.filter(key => key.startsWith(prefix));
    const activeRecipeIds: string[] = [];

    for (const key of sessionKeys) {
      const data = await AsyncStorage.getItem(key);
      if (data) {
        const progress = JSON.parse(data);
        // Only include sessions that have started but not completed
        if (progress.startedAt && !progress.completedAt) {
          const recipeId = key.replace(prefix, '');
          activeRecipeIds.push(recipeId);
        }
      }
    }

    return activeRecipeIds;
  } catch (error) {
    console.error('Error getting active sessions:', error);
    return [];
  }
}

/**
 * Clear all cooking progress for a user
 */
export async function clearAllCookingProgress(userId: string): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const prefix = `${COOKING_PROGRESS_PREFIX}${userId}_`;
    const keysToRemove = allKeys.filter(key => key.startsWith(prefix));
    
    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
    }
  } catch (error) {
    console.error('Error clearing cooking progress:', error);
  }
}

export default useCookingProgress;
