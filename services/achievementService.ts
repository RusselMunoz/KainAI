// services/achievementService.ts - Achievements, goals, and streaks for Firebase/Firestore
// Handles achievement tracking, weekly goals, and cooking streaks

import { Platform } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDemoMode, generateId, logFirebaseOp, serverTimestamp } from '../config/firebase';

// API base URL for backend
const API_BASE = Platform.select({
  android: 'http://10.0.2.2:5173',
  ios: 'http://localhost:5173',
  default: 'http://localhost:5173',
});

// Storage keys for demo mode
const DEMO_ACHIEVEMENTS_KEY = '@kainai_demo_achievements';

/**
 * Achievement types
 */
export type AchievementType = 
  | 'recipes_completed'
  | 'recipes_shared'
  | 'comments_made'
  | 'likes_received'
  | 'unique_ingredients'
  | 'cooking_streak'
  | 'posts_created';

/**
 * Achievement definition
 */
export interface AchievementDefinition {
  id: string;
  type: AchievementType;
  name: string;
  description: string;
  icon: string;
  threshold: number;  // Value needed to unlock
  xpReward: number;
  pointsReward: number;
}

/**
 * User achievement progress
 */
export interface AchievementProgress {
  type: AchievementType;
  currentValue: number;
  unlockedAt: Date | null;
  claimed: boolean;
}

/**
 * Weekly goal definition
 */
export interface WeeklyGoal {
  id: string;
  type: 'recipesCooked' | 'newIngredientsTried' | 'creationsShared';
  name: string;
  description: string;
  target: number;
  current: number;
  completed: boolean;
  xpReward: number;
  pointsReward: number;
}

/**
 * User achievements data
 */
export interface Achievements {
  progress: AchievementProgress[];
  unlockedAchievements: string[];
  cookingStreak: number;
  lastCookDate: string | null;
  weeklyGoals: WeeklyGoal[];
  lastWeeklyReset: string | null;
}

/**
 * Default achievements list
 */
const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // Recipe milestones
  { id: 'first_recipe', type: 'recipes_completed', name: 'First Bite', description: 'Complete your first recipe', icon: '🍳', threshold: 1, xpReward: 25, pointsReward: 10 },
  { id: 'five_recipes', type: 'recipes_completed', name: 'Getting Started', description: 'Complete 5 recipes', icon: '👨‍🍳', threshold: 5, xpReward: 50, pointsReward: 25 },
  { id: 'ten_recipes', type: 'recipes_completed', name: 'Home Cook', description: 'Complete 10 recipes', icon: '🏠', threshold: 10, xpReward: 100, pointsReward: 50 },
  { id: 'twenty_five_recipes', type: 'recipes_completed', name: 'Skilled Chef', description: 'Complete 25 recipes', icon: '⭐', threshold: 25, xpReward: 250, pointsReward: 100 },
  { id: 'fifty_recipes', type: 'recipes_completed', name: 'Master Chef', description: 'Complete 50 recipes', icon: '🏆', threshold: 50, xpReward: 500, pointsReward: 200 },
  
  // Sharing milestones
  { id: 'first_share', type: 'recipes_shared', name: 'Community Member', description: 'Share your first creation', icon: '🤝', threshold: 1, xpReward: 20, pointsReward: 15 },
  { id: 'five_shares', type: 'recipes_shared', name: 'Influencer', description: 'Share 5 creations', icon: '📢', threshold: 5, xpReward: 75, pointsReward: 40 },
  { id: 'ten_shares', type: 'recipes_shared', name: 'Trendsetter', description: 'Share 10 creations', icon: '🌟', threshold: 10, xpReward: 150, pointsReward: 75 },
  
  // Streak milestones
  { id: 'three_day_streak', type: 'cooking_streak', name: 'Getting Consistent', description: 'Cook 3 days in a row', icon: '🔥', threshold: 3, xpReward: 30, pointsReward: 20 },
  { id: 'seven_day_streak', type: 'cooking_streak', name: 'Week Warrior', description: 'Cook 7 days in a row', icon: '💪', threshold: 7, xpReward: 100, pointsReward: 50 },
  { id: 'thirty_day_streak', type: 'cooking_streak', name: 'Dedicated Chef', description: 'Cook 30 days in a row', icon: '🎖️', threshold: 30, xpReward: 500, pointsReward: 200 },
  
  // Ingredient milestones
  { id: 'five_ingredients', type: 'unique_ingredients', name: 'Experimenter', description: 'Try 5 unique ingredients', icon: '🥬', threshold: 5, xpReward: 25, pointsReward: 15 },
  { id: 'twenty_ingredients', type: 'unique_ingredients', name: 'Adventurer', description: 'Try 20 unique ingredients', icon: '🌶️', threshold: 20, xpReward: 75, pointsReward: 40 },
  { id: 'fifty_ingredients', type: 'unique_ingredients', name: 'Flavor Explorer', description: 'Try 50 unique ingredients', icon: '🌍', threshold: 50, xpReward: 200, pointsReward: 100 },
];

/**
 * Default weekly goals
 */
const DEFAULT_WEEKLY_GOALS: WeeklyGoal[] = [
  { id: 'weekly_recipes', type: 'recipesCooked', name: 'Weekly Chef', description: 'Cook 3 recipes this week', target: 3, current: 0, completed: false, xpReward: 50, pointsReward: 25 },
  { id: 'weekly_ingredients', type: 'newIngredientsTried', name: 'Try Something New', description: 'Use 5 new ingredients', target: 5, current: 0, completed: false, xpReward: 40, pointsReward: 20 },
  { id: 'weekly_shares', type: 'creationsShared', name: 'Share the Love', description: 'Share 2 creations', target: 2, current: 0, completed: false, xpReward: 30, pointsReward: 15 },
];

/**
 * Default achievements state
 */
const DEFAULT_ACHIEVEMENTS: Achievements = {
  progress: ACHIEVEMENT_DEFINITIONS.map(def => ({
    type: def.type,
    currentValue: 0,
    unlockedAt: null,
    claimed: false,
  })),
  unlockedAchievements: [],
  cookingStreak: 0,
  lastCookDate: null,
  weeklyGoals: DEFAULT_WEEKLY_GOALS,
  lastWeeklyReset: null,
};

/**
 * Achievement Service class - handles all achievement-related Firebase operations
 */
class AchievementService {
  /**
   * Get user's achievements
   */
  async getAchievements(userId: string): Promise<Achievements> {
    if (isDemoMode(userId)) {
      console.log('🏆 [Demo] Getting achievements locally');
      try {
        const stored = await AsyncStorage.getItem(DEMO_ACHIEVEMENTS_KEY);
        if (stored) {
          const achievements = JSON.parse(stored);
          // Check if weekly reset needed
          return this.checkWeeklyReset(achievements);
        }
        // Initialize with defaults
        await AsyncStorage.setItem(DEMO_ACHIEVEMENTS_KEY, JSON.stringify(DEFAULT_ACHIEVEMENTS));
        return { ...DEFAULT_ACHIEVEMENTS };
      } catch (error) {
        console.error('Error getting demo achievements:', error);
        return { ...DEFAULT_ACHIEVEMENTS };
      }
    }

    try {
      logFirebaseOp('GET', 'achievements', userId);
      
      const response = await axios.get(`${API_BASE}/api/achievements/${userId}`);
      
      if (response.data.ok && response.data.achievements) {
        console.log('✅ Achievements fetched successfully');
        return this.checkWeeklyReset(response.data.achievements);
      }
      
      return { ...DEFAULT_ACHIEVEMENTS };
    } catch (error: any) {
      console.error('❌ Error getting achievements:', error.message);
      return { ...DEFAULT_ACHIEVEMENTS };
    }
  }

  /**
   * Update achievement progress
   * Use increment to add to current value
   */
  async updateAchievementProgress(userId: string, achievementType: AchievementType, increment: number): Promise<void> {
    if (isDemoMode(userId)) {
      console.log(`📈 [Demo] Updating ${achievementType} progress by ${increment}`);
      try {
        const stored = await AsyncStorage.getItem(DEMO_ACHIEVEMENTS_KEY);
        const achievements: Achievements = stored ? JSON.parse(stored) : { ...DEFAULT_ACHIEVEMENTS };
        
        // Find and update progress
        const progressIndex = achievements.progress.findIndex(p => p.type === achievementType);
        if (progressIndex !== -1) {
          achievements.progress[progressIndex].currentValue += increment;
        } else {
          achievements.progress.push({
            type: achievementType,
            currentValue: increment,
            unlockedAt: null,
            claimed: false,
          });
        }
        
        await AsyncStorage.setItem(DEMO_ACHIEVEMENTS_KEY, JSON.stringify(achievements));
        return;
      } catch (error) {
        console.error('Error updating demo achievement progress:', error);
        throw error;
      }
    }

    try {
      logFirebaseOp('UPDATE', 'achievements', userId);
      
      await axios.post(`${API_BASE}/api/achievements/${userId}/progress`, {
        achievementType,
        increment,
      });
      
      console.log(`✅ Achievement progress updated: ${achievementType} +${increment}`);
    } catch (error: any) {
      console.error('❌ Error updating achievement progress:', error.message);
      throw error;
    }
  }

  /**
   * Check for achievement unlocks based on current progress
   * Returns array of newly unlocked achievement IDs
   */
  async checkAchievementUnlocks(userId: string): Promise<string[]> {
    const achievements = await this.getAchievements(userId);
    const newlyUnlocked: string[] = [];
    
    for (const definition of ACHIEVEMENT_DEFINITIONS) {
      // Skip if already unlocked
      if (achievements.unlockedAchievements.includes(definition.id)) {
        continue;
      }
      
      // Find progress for this achievement type
      const progress = achievements.progress.find(p => p.type === definition.type);
      if (!progress) continue;
      
      // Check if threshold reached
      if (progress.currentValue >= definition.threshold) {
        newlyUnlocked.push(definition.id);
        achievements.unlockedAchievements.push(definition.id);
        
        // Update progress with unlock time
        progress.unlockedAt = new Date();
      }
    }
    
    if (newlyUnlocked.length > 0) {
      console.log(`🏆 New achievements unlocked: ${newlyUnlocked.join(', ')}`);
      
      if (isDemoMode(userId)) {
        await AsyncStorage.setItem(DEMO_ACHIEVEMENTS_KEY, JSON.stringify(achievements));
      } else {
        try {
          await axios.post(`${API_BASE}/api/achievements/${userId}/unlock`, {
            achievementIds: newlyUnlocked,
          });
        } catch (error: any) {
          console.error('Error syncing achievement unlocks:', error.message);
        }
      }
    }
    
    return newlyUnlocked;
  }

  /**
   * Update cooking streak
   * Call this when user completes a recipe
   * Returns new streak count
   */
  async updateCookingStreak(userId: string): Promise<number> {
    const today = new Date().toDateString();
    
    if (isDemoMode(userId)) {
      console.log('🔥 [Demo] Updating cooking streak');
      try {
        const stored = await AsyncStorage.getItem(DEMO_ACHIEVEMENTS_KEY);
        const achievements: Achievements = stored ? JSON.parse(stored) : { ...DEFAULT_ACHIEVEMENTS };
        
        if (achievements.lastCookDate === today) {
          // Already cooked today, no change
          return achievements.cookingStreak;
        }
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();
        
        if (achievements.lastCookDate === yesterdayStr) {
          // Continue streak
          achievements.cookingStreak++;
        } else {
          // Reset streak
          achievements.cookingStreak = 1;
        }
        
        achievements.lastCookDate = today;
        await AsyncStorage.setItem(DEMO_ACHIEVEMENTS_KEY, JSON.stringify(achievements));
        
        // Update progress for streak achievements
        const streakProgress = achievements.progress.find(p => p.type === 'cooking_streak');
        if (streakProgress) {
          streakProgress.currentValue = achievements.cookingStreak;
        } else {
          achievements.progress.push({
            type: 'cooking_streak',
            currentValue: achievements.cookingStreak,
            unlockedAt: null,
            claimed: false,
          });
        }
        await AsyncStorage.setItem(DEMO_ACHIEVEMENTS_KEY, JSON.stringify(achievements));
        
        return achievements.cookingStreak;
      } catch (error) {
        console.error('Error updating demo cooking streak:', error);
        return 1;
      }
    }

    try {
      logFirebaseOp('UPDATE', 'achievements', userId);
      
      const response = await axios.post(`${API_BASE}/api/achievements/${userId}/streak`);
      
      if (response.data.ok) {
        console.log(`🔥 Cooking streak: ${response.data.streak} days`);
        return response.data.streak;
      }
      
      return 1;
    } catch (error: any) {
      console.error('❌ Error updating cooking streak:', error.message);
      return 1;
    }
  }

  /**
   * Update weekly goal progress
   */
  async updateWeeklyGoal(userId: string, goalType: string, increment: number): Promise<void> {
    if (isDemoMode(userId)) {
      console.log(`📊 [Demo] Updating weekly goal ${goalType} by ${increment}`);
      try {
        const stored = await AsyncStorage.getItem(DEMO_ACHIEVEMENTS_KEY);
        const achievements: Achievements = stored ? JSON.parse(stored) : { ...DEFAULT_ACHIEVEMENTS };
        
        const goal = achievements.weeklyGoals.find(g => g.type === goalType);
        if (goal && !goal.completed) {
          goal.current += increment;
          if (goal.current >= goal.target) {
            goal.completed = true;
          }
        }
        
        await AsyncStorage.setItem(DEMO_ACHIEVEMENTS_KEY, JSON.stringify(achievements));
        return;
      } catch (error) {
        console.error('Error updating demo weekly goal:', error);
        throw error;
      }
    }

    try {
      logFirebaseOp('UPDATE', 'achievements', userId);
      
      await axios.post(`${API_BASE}/api/achievements/${userId}/weekly-goal`, {
        goalType,
        increment,
      });
      
      console.log(`✅ Weekly goal updated: ${goalType} +${increment}`);
    } catch (error: any) {
      console.error('❌ Error updating weekly goal:', error.message);
      throw error;
    }
  }

  /**
   * Complete a weekly goal and claim rewards
   * Returns points awarded
   */
  async completeWeeklyGoal(userId: string, goalType: string): Promise<number> {
    if (isDemoMode(userId)) {
      console.log(`🎯 [Demo] Completing weekly goal ${goalType}`);
      try {
        const stored = await AsyncStorage.getItem(DEMO_ACHIEVEMENTS_KEY);
        const achievements: Achievements = stored ? JSON.parse(stored) : { ...DEFAULT_ACHIEVEMENTS };
        
        const goal = achievements.weeklyGoals.find(g => g.type === goalType);
        if (goal && goal.completed) {
          await AsyncStorage.setItem(DEMO_ACHIEVEMENTS_KEY, JSON.stringify(achievements));
          return goal.pointsReward;
        }
        
        return 0;
      } catch (error) {
        console.error('Error completing demo weekly goal:', error);
        return 0;
      }
    }

    try {
      logFirebaseOp('UPDATE', 'achievements', userId);
      
      const response = await axios.post(`${API_BASE}/api/achievements/${userId}/complete-weekly-goal`, {
        goalType,
      });
      
      if (response.data.ok) {
        console.log(`🎯 Weekly goal completed: ${goalType}, +${response.data.points} points`);
        return response.data.points;
      }
      
      return 0;
    } catch (error: any) {
      console.error('❌ Error completing weekly goal:', error.message);
      return 0;
    }
  }

  /**
   * Reset weekly goals (called at start of new week)
   */
  async resetWeeklyGoals(userId: string): Promise<void> {
    if (isDemoMode(userId)) {
      console.log('🔄 [Demo] Resetting weekly goals');
      try {
        const stored = await AsyncStorage.getItem(DEMO_ACHIEVEMENTS_KEY);
        const achievements: Achievements = stored ? JSON.parse(stored) : { ...DEFAULT_ACHIEVEMENTS };
        
        achievements.weeklyGoals = DEFAULT_WEEKLY_GOALS.map(goal => ({ ...goal }));
        achievements.lastWeeklyReset = new Date().toISOString();
        
        await AsyncStorage.setItem(DEMO_ACHIEVEMENTS_KEY, JSON.stringify(achievements));
        return;
      } catch (error) {
        console.error('Error resetting demo weekly goals:', error);
        throw error;
      }
    }

    try {
      logFirebaseOp('UPDATE', 'achievements', userId);
      
      await axios.post(`${API_BASE}/api/achievements/${userId}/reset-weekly`);
      
      console.log('✅ Weekly goals reset');
    } catch (error: any) {
      console.error('❌ Error resetting weekly goals:', error.message);
      throw error;
    }
  }

  /**
   * Get achievement definitions
   */
  getAchievementDefinitions(): AchievementDefinition[] {
    return ACHIEVEMENT_DEFINITIONS;
  }

  /**
   * Get achievement definition by ID
   */
  getAchievementDefinition(achievementId: string): AchievementDefinition | undefined {
    return ACHIEVEMENT_DEFINITIONS.find(def => def.id === achievementId);
  }

  /**
   * Check if weekly goals need to be reset
   * (start of ISO week - Monday)
   */
  private checkWeeklyReset(achievements: Achievements): Achievements {
    const now = new Date();
    const lastReset = achievements.lastWeeklyReset ? new Date(achievements.lastWeeklyReset) : null;
    
    // Get current week number
    const getWeekNumber = (date: Date): number => {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    };
    
    const currentWeek = getWeekNumber(now);
    const lastResetWeek = lastReset ? getWeekNumber(lastReset) : 0;
    
    // Reset if different week or different year
    if (!lastReset || currentWeek !== lastResetWeek || now.getFullYear() !== lastReset.getFullYear()) {
      console.log('🔄 Auto-resetting weekly goals for new week');
      achievements.weeklyGoals = DEFAULT_WEEKLY_GOALS.map(goal => ({ ...goal }));
      achievements.lastWeeklyReset = now.toISOString();
    }
    
    return achievements;
  }
}

export const achievementService = new AchievementService();
export default achievementService;
