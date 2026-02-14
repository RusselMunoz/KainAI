// services/statsService.ts - XP, levels, and points calculations for Firebase/Firestore
// Handles user statistics, level progression, and reward points

import { Platform } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDemoMode, logFirebaseOp, serverTimestamp } from '../config/firebase';
import type { UserLevel } from '../types';

// API base URL for backend
const API_BASE = Platform.select({
  android: 'http://10.0.2.2:5173',
  ios: 'http://localhost:5173',
  default: 'http://localhost:5173',
});

// Storage keys for demo mode
const DEMO_STATS_KEY = '@kainai_user_stats';
const DEMO_XP_LOG_KEY = '@kainai_xp_log';

/**
 * XP rewards for different actions
 */
export const XP_REWARDS = {
  COMPLETE_RECIPE: 20,
  SHARE_CREATION: 15,
  COMPLETE_ACHIEVEMENT: 50,
  DAILY_STREAK: 5,
  WEEKLY_STREAK_BONUS: 25,
  COMMUNITY_COMMENT: 5,
  RATE_RECIPE: 3,
  TRY_NEW_INGREDIENT: 10,
  RECEIVE_LIKE: 2,
  POST_FEATURED: 100,
} as const;

/**
 * Points rewards for different actions
 */
export const POINT_REWARDS = {
  COMPLETE_RECIPE: 10,
  SHARE_CREATION: 15,
  COMPLETE_ACHIEVEMENT: 25,
  COMPLETE_WEEKLY_GOAL: 20,
  STREAK_MILESTONE: 50,
  RECEIVE_LIKE: 1,
} as const;

/**
 * Level thresholds
 */
export interface LevelThreshold {
  level: UserLevel;
  minXP: number;
  maxXP: number | null;
}

const LEVEL_THRESHOLDS: LevelThreshold[] = [
  { level: 'Beginner', minXP: 0, maxXP: 199 },
  { level: 'Intermediate', minXP: 200, maxXP: 499 },
  { level: 'Advanced', minXP: 500, maxXP: 999 },
  { level: 'Expert', minXP: 1000, maxXP: 1999 },
  { level: 'Master Chef', minXP: 2000, maxXP: null },
];

/**
 * User stats interface
 */
export interface UserStats {
  xp: number;
  level: UserLevel;
  rewardPoints: number;
  recipesCompleted: number;
  recipesShared: number;
  totalIngredientsUsed: number;
  uniqueIngredients: string[];
  achievementsCompleted: string[];
  currentStreak: number;
  longestStreak: number;
  lastCookDate: string | null;
  communityPoints: number;
  totalLikesReceived: number;
  totalCommentsReceived: number;
}

/**
 * Level calculation result
 */
export interface LevelInfo {
  level: UserLevel;
  progress: number;  // 0-100 percentage to next level
  currentXP: number;
  nextThreshold: number;
  prevThreshold: number;
}

/**
 * XP award result
 */
export interface XPAwardResult {
  newXP: number;
  leveledUp: boolean;
  newLevel?: UserLevel;
  previousLevel?: UserLevel;
}

/**
 * XP log entry
 */
export interface XPLogEntry {
  timestamp: string;
  xpAmount: number;
  reason: string;
  totalXP: number;
}

/**
 * Default stats values
 */
const DEFAULT_STATS: UserStats = {
  xp: 0,
  level: 'Beginner',
  rewardPoints: 0,
  recipesCompleted: 0,
  recipesShared: 0,
  totalIngredientsUsed: 0,
  uniqueIngredients: [],
  achievementsCompleted: [],
  currentStreak: 0,
  longestStreak: 0,
  lastCookDate: null,
  communityPoints: 0,
  totalLikesReceived: 0,
  totalCommentsReceived: 0,
};

/**
 * Stats Service class - handles all stats-related Firebase operations
 */
class StatsService {
  /**
   * Get user stats
   */
  async getUserStats(userId: string): Promise<UserStats> {
    if (isDemoMode(userId)) {
      console.log('📊 [Demo] Getting stats locally');
      try {
        const stored = await AsyncStorage.getItem(DEMO_STATS_KEY);
        if (stored) {
          const stats = JSON.parse(stored);
          // Ensure level is calculated correctly
          const levelInfo = this.calculateLevel(stats.xp || 0);
          return {
            ...DEFAULT_STATS,
            ...stats,
            level: levelInfo.level,
          };
        }
        return { ...DEFAULT_STATS };
      } catch (error) {
        console.error('Error getting demo stats:', error);
        return { ...DEFAULT_STATS };
      }
    }

    try {
      logFirebaseOp('GET', 'user_stats', userId);
      
      const response = await axios.get(`${API_BASE}/api/stats/${userId}`);
      
      if (response.data.ok && response.data.stats) {
        console.log('✅ User stats fetched successfully');
        // Ensure level is calculated correctly
        const levelInfo = this.calculateLevel(response.data.stats.xp || 0);
        return {
          ...DEFAULT_STATS,
          ...response.data.stats,
          level: levelInfo.level,
        };
      }
      
      return { ...DEFAULT_STATS };
    } catch (error: any) {
      console.error('❌ Error getting user stats:', error.message);
      return { ...DEFAULT_STATS };
    }
  }

  /**
   * Calculate level from XP
   * Returns level info including progress to next level
   */
  calculateLevel(xp: number): LevelInfo {
    let currentLevel: UserLevel = 'Beginner';
    let nextThreshold = 200;
    let prevThreshold = 0;
    
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
      const threshold = LEVEL_THRESHOLDS[i];
      if (xp >= threshold.minXP) {
        currentLevel = threshold.level;
        prevThreshold = threshold.minXP;
        
        // Set next threshold
        if (i + 1 < LEVEL_THRESHOLDS.length) {
          nextThreshold = LEVEL_THRESHOLDS[i + 1].minXP;
        } else {
          // Max level - set next threshold for display purposes
          nextThreshold = threshold.minXP + 1000;
        }
      } else {
        break;
      }
    }
    
    // Calculate progress percentage
    const xpInCurrentLevel = xp - prevThreshold;
    const xpNeededForNextLevel = nextThreshold - prevThreshold;
    const progress = Math.min(100, Math.floor((xpInCurrentLevel / xpNeededForNextLevel) * 100));
    
    return {
      level: currentLevel,
      progress,
      currentXP: xp,
      nextThreshold,
      prevThreshold,
    };
  }

  /**
   * Award XP to user
   * Returns award result including level up info
   */
  async awardXP(userId: string, xp: number, reason: string): Promise<XPAwardResult> {
    if (isDemoMode(userId)) {
      console.log(`✨ [Demo] Awarding ${xp} XP for: ${reason}`);
      try {
        const stored = await AsyncStorage.getItem(DEMO_STATS_KEY);
        const stats: UserStats = stored ? JSON.parse(stored) : { ...DEFAULT_STATS };
        
        const previousLevel = stats.level;
        const newXP = stats.xp + xp;
        const levelInfo = this.calculateLevel(newXP);
        const leveledUp = previousLevel !== levelInfo.level;
        
        stats.xp = newXP;
        stats.level = levelInfo.level;
        
        await AsyncStorage.setItem(DEMO_STATS_KEY, JSON.stringify(stats));
        
        // Log XP award
        await this.logXPAward(userId, xp, reason, newXP);
        
        console.log(`✨ XP awarded: +${xp} (Total: ${newXP}, Level: ${levelInfo.level})`);
        
        return {
          newXP,
          leveledUp,
          newLevel: leveledUp ? levelInfo.level : undefined,
          previousLevel: leveledUp ? previousLevel : undefined,
        };
      } catch (error) {
        console.error('Error awarding demo XP:', error);
        return { newXP: xp, leveledUp: false };
      }
    }

    try {
      logFirebaseOp('UPDATE', 'user_stats', userId);
      
      const response = await axios.post(`${API_BASE}/api/stats/${userId}/award-xp`, {
        xp,
        reason,
      });
      
      if (response.data.ok) {
        console.log(`✨ XP awarded: +${xp} for ${reason}`);
        return {
          newXP: response.data.newXP,
          leveledUp: response.data.leveledUp,
          newLevel: response.data.newLevel,
          previousLevel: response.data.previousLevel,
        };
      }
      
      return { newXP: 0, leveledUp: false };
    } catch (error: any) {
      console.error('❌ Error awarding XP:', error.message);
      throw error;
    }
  }

  /**
   * Award reward points to user
   * Returns new points total
   */
  async awardRewardPoints(userId: string, points: number, reason: string): Promise<number> {
    if (isDemoMode(userId)) {
      console.log(`🎁 [Demo] Awarding ${points} points for: ${reason}`);
      try {
        const stored = await AsyncStorage.getItem(DEMO_STATS_KEY);
        const stats: UserStats = stored ? JSON.parse(stored) : { ...DEFAULT_STATS };
        
        const newPoints = stats.rewardPoints + points;
        stats.rewardPoints = newPoints;
        
        await AsyncStorage.setItem(DEMO_STATS_KEY, JSON.stringify(stats));
        
        console.log(`🎁 Points awarded: +${points} (Total: ${newPoints})`);
        
        return newPoints;
      } catch (error) {
        console.error('Error awarding demo points:', error);
        return points;
      }
    }

    try {
      logFirebaseOp('UPDATE', 'user_stats', userId);
      
      const response = await axios.post(`${API_BASE}/api/stats/${userId}/award-points`, {
        points,
        reason,
      });
      
      if (response.data.ok) {
        console.log(`🎁 Points awarded: +${points} for ${reason}`);
        return response.data.newPoints;
      }
      
      return 0;
    } catch (error: any) {
      console.error('❌ Error awarding points:', error.message);
      throw error;
    }
  }

  /**
   * Spend reward points
   * Returns success status and remaining points
   */
  async spendRewardPoints(userId: string, points: number, reason: string): Promise<{ success: boolean; remainingPoints: number }> {
    if (isDemoMode(userId)) {
      console.log(`💳 [Demo] Spending ${points} points for: ${reason}`);
      try {
        const stored = await AsyncStorage.getItem(DEMO_STATS_KEY);
        const stats: UserStats = stored ? JSON.parse(stored) : { ...DEFAULT_STATS };
        
        if (stats.rewardPoints < points) {
          console.log('❌ Insufficient points');
          return { success: false, remainingPoints: stats.rewardPoints };
        }
        
        stats.rewardPoints -= points;
        await AsyncStorage.setItem(DEMO_STATS_KEY, JSON.stringify(stats));
        
        console.log(`💳 Points spent: -${points} (Remaining: ${stats.rewardPoints})`);
        
        return { success: true, remainingPoints: stats.rewardPoints };
      } catch (error) {
        console.error('Error spending demo points:', error);
        return { success: false, remainingPoints: 0 };
      }
    }

    try {
      logFirebaseOp('UPDATE', 'user_stats', userId);
      
      const response = await axios.post(`${API_BASE}/api/stats/${userId}/spend-points`, {
        points,
        reason,
      });
      
      if (response.data.ok) {
        console.log(`💳 Points spent: -${points} for ${reason}`);
        return {
          success: true,
          remainingPoints: response.data.remainingPoints,
        };
      }
      
      return { success: false, remainingPoints: response.data.currentPoints || 0 };
    } catch (error: any) {
      console.error('❌ Error spending points:', error.message);
      throw error;
    }
  }

  /**
   * Increment a stat counter (e.g., recipesCompleted, recipesShared)
   */
  async incrementStat(userId: string, statName: keyof UserStats, increment: number = 1): Promise<number> {
    if (isDemoMode(userId)) {
      console.log(`📈 [Demo] Incrementing ${statName} by ${increment}`);
      try {
        const stored = await AsyncStorage.getItem(DEMO_STATS_KEY);
        const stats: UserStats = stored ? JSON.parse(stored) : { ...DEFAULT_STATS };
        
        const currentValue = (stats[statName] as number) || 0;
        const newValue = currentValue + increment;
        (stats as any)[statName] = newValue;
        
        await AsyncStorage.setItem(DEMO_STATS_KEY, JSON.stringify(stats));
        
        return newValue;
      } catch (error) {
        console.error('Error incrementing demo stat:', error);
        return increment;
      }
    }

    try {
      logFirebaseOp('UPDATE', 'user_stats', userId);
      
      const response = await axios.post(`${API_BASE}/api/stats/${userId}/increment`, {
        statName,
        increment,
      });
      
      if (response.data.ok) {
        console.log(`📈 ${statName} incremented: +${increment}`);
        return response.data.newValue;
      }
      
      return 0;
    } catch (error: any) {
      console.error('❌ Error incrementing stat:', error.message);
      throw error;
    }
  }

  /**
   * Add unique ingredients to user's list
   * Returns array of newly added ingredients
   */
  async addUniqueIngredients(userId: string, ingredients: string[]): Promise<string[]> {
    if (isDemoMode(userId)) {
      console.log(`🥬 [Demo] Adding ${ingredients.length} ingredients`);
      try {
        const stored = await AsyncStorage.getItem(DEMO_STATS_KEY);
        const stats: UserStats = stored ? JSON.parse(stored) : { ...DEFAULT_STATS };
        
        const existingSet = new Set(stats.uniqueIngredients.map(i => i.toLowerCase()));
        const newIngredients = ingredients.filter(i => !existingSet.has(i.toLowerCase()));
        
        if (newIngredients.length > 0) {
          stats.uniqueIngredients.push(...newIngredients.map(i => i.toLowerCase()));
          stats.totalIngredientsUsed += ingredients.length;
          await AsyncStorage.setItem(DEMO_STATS_KEY, JSON.stringify(stats));
        }
        
        return newIngredients;
      } catch (error) {
        console.error('Error adding demo ingredients:', error);
        return [];
      }
    }

    try {
      logFirebaseOp('UPDATE', 'user_stats', userId);
      
      const response = await axios.post(`${API_BASE}/api/stats/${userId}/add-ingredients`, {
        ingredients,
      });
      
      if (response.data.ok) {
        console.log(`🥬 New ingredients added: ${response.data.newIngredients?.length || 0}`);
        return response.data.newIngredients || [];
      }
      
      return [];
    } catch (error: any) {
      console.error('❌ Error adding ingredients:', error.message);
      return [];
    }
  }

  /**
   * Get XP history log
   */
  async getXPLog(userId: string, limit: number = 50): Promise<XPLogEntry[]> {
    if (isDemoMode(userId)) {
      try {
        const stored = await AsyncStorage.getItem(DEMO_XP_LOG_KEY);
        if (stored) {
          const log: XPLogEntry[] = JSON.parse(stored);
          return log.slice(0, limit);
        }
        return [];
      } catch (error) {
        console.error('Error getting demo XP log:', error);
        return [];
      }
    }

    try {
      const response = await axios.get(`${API_BASE}/api/stats/${userId}/xp-log`, {
        params: { limit },
      });
      
      if (response.data.ok && response.data.log) {
        return response.data.log;
      }
      
      return [];
    } catch (error: any) {
      console.error('❌ Error getting XP log:', error.message);
      return [];
    }
  }

  /**
   * Log XP award (internal)
   */
  private async logXPAward(userId: string, xp: number, reason: string, totalXP: number): Promise<void> {
    if (!isDemoMode(userId)) return;
    
    try {
      const stored = await AsyncStorage.getItem(DEMO_XP_LOG_KEY);
      const log: XPLogEntry[] = stored ? JSON.parse(stored) : [];
      
      log.unshift({
        timestamp: new Date().toISOString(),
        xpAmount: xp,
        reason,
        totalXP,
      });
      
      // Keep only last 100 entries
      const trimmedLog = log.slice(0, 100);
      await AsyncStorage.setItem(DEMO_XP_LOG_KEY, JSON.stringify(trimmedLog));
    } catch (error) {
      console.error('Error logging XP award:', error);
    }
  }

  /**
   * Get level thresholds
   */
  getLevelThresholds(): LevelThreshold[] {
    return LEVEL_THRESHOLDS;
  }

  /**
   * Get XP required for a specific level
   */
  getXPForLevel(level: UserLevel): number {
    const threshold = LEVEL_THRESHOLDS.find(t => t.level === level);
    return threshold?.minXP || 0;
  }

  /**
   * Reset all stats (for testing/debug)
   */
  async resetStats(userId: string): Promise<void> {
    if (isDemoMode(userId)) {
      console.log('🔄 [Demo] Resetting all stats');
      await AsyncStorage.setItem(DEMO_STATS_KEY, JSON.stringify(DEFAULT_STATS));
      await AsyncStorage.removeItem(DEMO_XP_LOG_KEY);
      return;
    }

    try {
      await axios.post(`${API_BASE}/api/stats/${userId}/reset`);
      console.log('✅ Stats reset');
    } catch (error: any) {
      console.error('❌ Error resetting stats:', error.message);
      throw error;
    }
  }
}

export const statsService = new StatsService();
export default statsService;
