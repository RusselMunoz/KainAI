// services/user-stats.service.ts
// Tracks user XP, level, and achievements

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import axios from 'axios';
import type { UserLevel } from '../types';

const API_BASE = Platform.select({
  android: 'http://localhost:5173',
  default: 'http://localhost:5173',
});

const USER_STATS_KEY = '@kainai_user_stats';

// XP thresholds for levels
const LEVEL_THRESHOLDS: { level: UserLevel; minXP: number }[] = [
  { level: 'Beginner', minXP: 0 },
  { level: 'Novice Cook', minXP: 200 },
  { level: 'Home Chef', minXP: 500 },
  { level: 'Skilled Chef', minXP: 1000 },
  { level: 'Expert Chef', minXP: 2000 },
  { level: 'Master Chef', minXP: 5000 },
  { level: 'Culinary Legend', minXP: 10000 },
];

// XP rewards for actions
export const XP_REWARDS = {
  COMPLETE_RECIPE: 20,
  SHARE_CREATION: 15,
  COMPLETE_ACHIEVEMENT: 50,
  DAILY_STREAK: 5,
  WEEKLY_STREAK_BONUS: 25,
  COMMUNITY_COMMENT: 5,
  RATE_RECIPE: 3,
  TRY_NEW_INGREDIENT: 10,
};

export interface UserStats {
  xp: number;
  rewardPoints: number;  // Separate currency for rewards store
  level: UserLevel;
  recipesCompleted: number;
  recipesShared: number;
  totalIngredientsUsed: number;
  uniqueIngredients: string[];
  achievementsCompleted: string[];
  currentStreak: number;
  lastCookDate: string | null;
  unlockedFeatures: string[];
  communityPoints: number;
}

const DEFAULT_STATS: UserStats = {
  xp: 0,
  rewardPoints: 0,
  level: 'Beginner',
  recipesCompleted: 0,
  recipesShared: 0,
  totalIngredientsUsed: 0,
  uniqueIngredients: [],
  achievementsCompleted: [],
  currentStreak: 0,
  lastCookDate: null,
  unlockedFeatures: [],
  communityPoints: 0,
};

class UserStatsService {
  private stats: UserStats = { ...DEFAULT_STATS };
  private loaded: boolean = false;

  /**
   * Load user stats from storage
   */
  async loadStats(): Promise<UserStats> {
    try {
      const stored = await AsyncStorage.getItem(USER_STATS_KEY);
      if (stored) {
        this.stats = { ...DEFAULT_STATS, ...JSON.parse(stored) };
      } else {
        this.stats = { ...DEFAULT_STATS };
      }
      this.loaded = true;
      console.log('📊 Stats loaded:', this.stats.xp, 'XP,', this.stats.level);
      return this.stats;
    } catch (error) {
      console.error('Error loading stats:', error);
      return DEFAULT_STATS;
    }
  }

  /**
   * Save stats to storage
   */
  async saveStats(): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_STATS_KEY, JSON.stringify(this.stats));
      console.log('💾 Stats saved:', this.stats.xp, 'XP');
    } catch (error) {
      console.error('Error saving stats:', error);
    }
  }

  /**
   * Get current stats
   */
  getStats(): UserStats {
    return { ...this.stats };
  }

  /**
   * Calculate level from XP
   */
  calculateLevel(xp: number): UserLevel {
    let level: UserLevel = 'Beginner';
    for (const threshold of LEVEL_THRESHOLDS) {
      if (xp >= threshold.minXP) {
        level = threshold.level;
      } else {
        break;
      }
    }
    return level;
  }

  /**
   * Get XP needed for next level
   */
  getXPToNextLevel(): { current: number; needed: number; nextLevel: string } {
    const currentXP = this.stats.xp;
    let nextThreshold = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
      if (currentXP < LEVEL_THRESHOLDS[i].minXP) {
        nextThreshold = LEVEL_THRESHOLDS[i];
        break;
      }
    }

    const prevThreshold = LEVEL_THRESHOLDS.find((_, i) => 
      i < LEVEL_THRESHOLDS.length - 1 && LEVEL_THRESHOLDS[i + 1] === nextThreshold
    ) || LEVEL_THRESHOLDS[0];

    return {
      current: currentXP - prevThreshold.minXP,
      needed: nextThreshold.minXP - prevThreshold.minXP,
      nextLevel: nextThreshold.level,
    };
  }

  /**
   * Award XP and check for level up
   */
  async awardXP(amount: number, reason: string): Promise<{ newXP: number; leveledUp: boolean; newLevel: UserLevel | null }> {
    const oldLevel = this.stats.level;
    this.stats.xp += amount;
    const newLevel = this.calculateLevel(this.stats.xp);
    
    const leveledUp = oldLevel !== newLevel;
    if (leveledUp) {
      this.stats.level = newLevel;
    }

    await this.saveStats();
    console.log(`✨ Awarded ${amount} XP for ${reason}. Total: ${this.stats.xp}`);

    return {
      newXP: this.stats.xp,
      leveledUp,
      newLevel: leveledUp ? newLevel : null,
    };
  }

  /**
   * Track recipe completion
   */
  async onRecipeComplete(ingredients: string[] = []): Promise<{ xpAwarded: number; leveledUp: boolean; newLevel: UserLevel | null; newXP: number; newAchievements: string[] }> {
    this.stats.recipesCompleted++;
    let newAchievements: string[] = [];
    
    // Track unique ingredients
    const uniqueNew = ingredients.filter(ing => !this.stats.uniqueIngredients.includes(ing.toLowerCase()));
    this.stats.uniqueIngredients.push(...uniqueNew.map(i => i.toLowerCase()));
    this.stats.totalIngredientsUsed += ingredients.length;

    // Calculate XP
    let xpAwarded = XP_REWARDS.COMPLETE_RECIPE;
    xpAwarded += uniqueNew.length * XP_REWARDS.TRY_NEW_INGREDIENT;

    // Update streak
    const today = new Date().toDateString();
    if (this.stats.lastCookDate !== today) {
      const lastDate = this.stats.lastCookDate ? new Date(this.stats.lastCookDate) : null;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastDate && lastDate.toDateString() === yesterday.toDateString()) {
        this.stats.currentStreak++;
        xpAwarded += XP_REWARDS.DAILY_STREAK;
        
        if (this.stats.currentStreak % 7 === 0) {
          xpAwarded += XP_REWARDS.WEEKLY_STREAK_BONUS;
        }
      } else if (!lastDate || lastDate.toDateString() !== today) {
        this.stats.currentStreak = 1;
        xpAwarded += XP_REWARDS.DAILY_STREAK;
      }
      this.stats.lastCookDate = today;
    }

    // Check for achievements
    // Ingredient Master: Try 50 unique ingredients
    if (this.stats.uniqueIngredients.length >= 50 && !this.stats.achievementsCompleted.includes('ingredient-master')) {
      this.stats.achievementsCompleted.push('ingredient-master');
      newAchievements.push('🥗 Ingredient Master');
      xpAwarded += XP_REWARDS.COMPLETE_ACHIEVEMENT;
    }
    // First Recipe
    if (this.stats.recipesCompleted === 1 && !this.stats.achievementsCompleted.includes('first-recipe')) {
      this.stats.achievementsCompleted.push('first-recipe');
      newAchievements.push('👨‍🍳 First Recipe');
      xpAwarded += XP_REWARDS.COMPLETE_ACHIEVEMENT;
    }
    // Streak Master: 7 day streak
    if (this.stats.currentStreak >= 7 && !this.stats.achievementsCompleted.includes('streak-master')) {
      this.stats.achievementsCompleted.push('streak-master');
      newAchievements.push('🔥 Streak Master');
      xpAwarded += XP_REWARDS.COMPLETE_ACHIEVEMENT;
    }
    // Recipe Pro: Complete 10 recipes
    if (this.stats.recipesCompleted >= 10 && !this.stats.achievementsCompleted.includes('recipe-pro')) {
      this.stats.achievementsCompleted.push('recipe-pro');
      newAchievements.push('⭐ Recipe Pro');
      xpAwarded += XP_REWARDS.COMPLETE_ACHIEVEMENT;
    }

    const result = await this.awardXP(xpAwarded, 'recipe completion');
    return { xpAwarded, ...result, newAchievements };
  }

  /**
   * Track sharing a creation
   */
  async onShareCreation(): Promise<{ xpAwarded: number; newXP: number }> {
    this.stats.recipesShared++;
    const result = await this.awardXP(XP_REWARDS.SHARE_CREATION, 'sharing creation');
    return { xpAwarded: XP_REWARDS.SHARE_CREATION, newXP: result.newXP };
  }

  /**
   * Track community engagement
   */
  async onCommunityEngagement(type: 'comment' | 'rate'): Promise<{ xpAwarded: number; newXP: number }> {
    const xp = type === 'comment' ? XP_REWARDS.COMMUNITY_COMMENT : XP_REWARDS.RATE_RECIPE;
    const result = await this.awardXP(xp, `community ${type}`);
    return { xpAwarded: xp, newXP: result.newXP };
  }

  /**
   * Unlock a feature
   */
  async unlockFeature(featureId: string): Promise<boolean> {
    if (!this.stats.unlockedFeatures.includes(featureId)) {
      this.stats.unlockedFeatures.push(featureId);
      await this.saveStats();
      return true;
    }
    return false;
  }

  /**
   * Check if feature is unlocked
   */
  isFeatureUnlocked(featureId: string): boolean {
    return this.stats.unlockedFeatures.includes(featureId);
  }

  /**
   * Reset stats (for demo mode)
   */
  async resetStats(): Promise<void> {
    this.stats = { ...DEFAULT_STATS };
    await this.saveStats();
    console.log('🔄 Stats reset');
  }

  // ==================== REWARD POINTS SYSTEM ====================

  /**
   * Award reward points (separate from XP)
   */
  async awardRewardPoints(amount: number, reason: string): Promise<number> {
    this.stats.rewardPoints += amount;
    await this.saveStats();
    console.log(`🎁 Awarded ${amount} reward points for ${reason}. Total: ${this.stats.rewardPoints}`);
    return this.stats.rewardPoints;
  }

  /**
   * Deduct reward points (for redemptions)
   */
  async deductRewardPoints(amount: number): Promise<{ success: boolean; remaining: number }> {
    if (this.stats.rewardPoints >= amount) {
      this.stats.rewardPoints -= amount;
      await this.saveStats();
      return { success: true, remaining: this.stats.rewardPoints };
    }
    return { success: false, remaining: this.stats.rewardPoints };
  }

  /**
   * Get current reward points
   */
  getRewardPoints(): number {
    return this.stats.rewardPoints;
  }

  /**
   * Modify reward points (for debug)
   */
  async modifyRewardPoints(amount: number): Promise<number> {
    this.stats.rewardPoints = Math.max(0, this.stats.rewardPoints + amount);
    await this.saveStats();
    return this.stats.rewardPoints;
  }

  /**
   * Reset only reward points
   */
  async resetRewardPoints(): Promise<void> {
    this.stats.rewardPoints = 0;
    await this.saveStats();
    console.log('🔄 Reward points reset to 0');
  }

  /**
   * Reset only XP (for debug)
   */
  async resetXP(): Promise<void> {
    this.stats.xp = 0;
    this.stats.level = 'Beginner';
    await this.saveStats();
    console.log('🔄 XP reset to 0');
  }
}

export const userStatsService = new UserStatsService();
export default userStatsService;
