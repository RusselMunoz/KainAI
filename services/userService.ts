// services/userService.ts - User CRUD operations for Firestore
// Handles user profile, XP, rewards, and preferences

import { Platform } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDemoMode, DEMO_USER_ID, generateId, logFirebaseOp, serverTimestamp } from '../config/firebase';
import type { User, UserLevel } from '../types';

// API base URL for backend fallback
const API_BASE = Platform.select({
  android: 'http://10.0.2.2:5173',
  ios: 'http://localhost:5173',
  default: 'http://localhost:5173',
});

// Storage keys for demo mode
const DEMO_USER_KEY = '@kainai_demo_user';
const DEMO_STATS_KEY = '@kainai_user_stats';

// XP thresholds for level calculation
const LEVEL_THRESHOLDS: { level: UserLevel; minXP: number }[] = [
  { level: 'Beginner', minXP: 0 },
  { level: 'Intermediate', minXP: 200 },
  { level: 'Advanced', minXP: 500 },
  { level: 'Expert', minXP: 1000 },
  { level: 'Master Chef', minXP: 2000 },
];

/**
 * User data for creation
 */
export interface UserData {
  email: string;
  displayName: string;
  photoURL?: string | null;
  username?: string;
  bio?: string;
  dietary_preferences?: string[];
  dietary_allergies?: string[];
  dietary_custom?: string;
  allergy_custom?: string;
  cooking_skills?: string[];
}

/**
 * Calculate user level from XP
 */
const calculateLevelFromXP = (xp: number): UserLevel => {
  let level: UserLevel = 'Beginner';
  for (const threshold of LEVEL_THRESHOLDS) {
    if (xp >= threshold.minXP) {
      level = threshold.level;
    } else {
      break;
    }
  }
  return level;
};

/**
 * User Service class - handles all user-related Firebase operations
 */
class UserService {
  /**
   * Create a new user in Firestore
   * Called after successful authentication
   */
  async createUser(userId: string, userData: UserData): Promise<void> {
    // Skip Firebase in demo mode
    if (isDemoMode(userId)) {
      console.log('📝 [Demo] Creating user locally:', userId);
      const demoUser: Partial<User> = {
        uid: userId,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL || null,
        username: userData.username || userData.displayName.toLowerCase().replace(/\s+/g, '_'),
        bio: userData.bio || '',
        dietary_preferences: userData.dietary_preferences || [],
        dietary_allergies: userData.dietary_allergies || [],
        cooking_skills: userData.cooking_skills || [],
        level: 'Beginner',
        xp: 0,
        recipesCompleted: 0,
        postsCreated: 0,
        totalLikesReceived: 0,
        totalSaves: 0,
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
      };
      await AsyncStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser));
      return;
    }

    try {
      logFirebaseOp('CREATE', 'users', userId);
      
      const newUser = {
        uid: userId,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL || null,
        username: userData.username || userData.displayName.toLowerCase().replace(/\s+/g, '_'),
        bio: userData.bio || '',
        dietary_preferences: userData.dietary_preferences || [],
        dietary_allergies: userData.dietary_allergies || [],
        dietary_custom: userData.dietary_custom || '',
        allergy_custom: userData.allergy_custom || '',
        cooking_skills: userData.cooking_skills || [],
        level: 'Beginner',
        xp: 0,
        recipesCompleted: 0,
        postsCreated: 0,
        totalLikesReceived: 0,
        totalSaves: 0,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        is_active: true,
      };

      // Call backend API to create user
      await axios.post(`${API_BASE}/api/users`, {
        userId,
        userData: newUser,
      });
      
      console.log('✅ User created successfully:', userId);
    } catch (error: any) {
      console.error('❌ Error creating user:', error.message);
      throw error;
    }
  }

  /**
   * Ensure user exists in database (create if not exists)
   * Called after successful authentication to sync user data
   */
  async ensureUserExists(userData: { uid: string; email: string; displayName: string; photoURL: string | null }): Promise<void> {
    try {
      // Try to get existing user
      const existingUser = await this.getUser(userData.uid);
      
      if (existingUser) {
        // User exists, update any changed fields
        const updates: Partial<User> = {};
        if (userData.displayName && userData.displayName !== existingUser.displayName) {
          updates.displayName = userData.displayName;
        }
        if (userData.photoURL && userData.photoURL !== existingUser.photoURL) {
          updates.photoURL = userData.photoURL;
        }
        
        if (Object.keys(updates).length > 0) {
          await this.updateUser(userData.uid, updates);
        }
        return;
      }
      
      // User doesn't exist, create new user
      await this.createUser(userData.uid, {
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
      });
    } catch (error) {
      console.error('❌ Error ensuring user exists:', error);
      // Don't throw - this is a non-blocking operation
    }
  }

  /**
   * Get user data from Firestore
   */
  async getUser(userId: string): Promise<User | null> {
    // Return demo user in demo mode
    if (isDemoMode(userId)) {
      console.log('📖 [Demo] Getting user locally:', userId);
      try {
        const stored = await AsyncStorage.getItem(DEMO_USER_KEY);
        if (stored) {
          const user = JSON.parse(stored);
          return {
            ...user,
            created_at: new Date(user.created_at),
            updated_at: new Date(user.updated_at),
          } as User;
        }
      } catch (error) {
        console.error('Error loading demo user:', error);
      }
      // Return default demo user
      return {
        uid: userId,
        email: 'demo@kainai.app',
        displayName: 'Demo Chef',
        photoURL: null,
        username: 'demo_chef',
        bio: '',
        dietary_preferences: [],
        dietary_allergies: [],
        cooking_skills: [],
        level: 'Beginner',
        xp: 0,
        recipesCompleted: 0,
        postsCreated: 0,
        totalLikesReceived: 0,
        totalSaves: 0,
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
      };
    }

    try {
      logFirebaseOp('GET', 'users', userId);
      
      const response = await axios.get(`${API_BASE}/api/users/${userId}`);
      
      if (response.data.ok && response.data.user) {
        console.log('✅ User fetched successfully:', userId);
        return response.data.user as User;
      }
      
      return null;
    } catch (error: any) {
      console.error('❌ Error getting user:', error.message);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    if (isDemoMode(userId)) {
      console.log('📝 [Demo] Updating user locally');
      try {
        const stored = await AsyncStorage.getItem(DEMO_USER_KEY);
        if (stored) {
          const user = JSON.parse(stored);
          const updated = { ...user, ...updates, updated_at: new Date() };
          await AsyncStorage.setItem(DEMO_USER_KEY, JSON.stringify(updated));
        }
      } catch (error) {
        console.error('Error updating demo user:', error);
      }
      return;
    }

    try {
      logFirebaseOp('UPDATE', 'users', userId);
      
      const updateData = {
        ...updates,
        updated_at: serverTimestamp(),
      };
      
      await axios.patch(`${API_BASE}/api/users/${userId}`, updateData);
      
      console.log('✅ User updated successfully:', userId);
    } catch (error: any) {
      console.error('❌ Error updating user:', error.message);
      throw error;
    }
  }

  /**
   * Update profile picture URL
   */
  async updateProfilePicture(userId: string, photoUrl: string): Promise<void> {
    if (isDemoMode(userId)) {
      console.log('📷 [Demo] Updating profile picture locally');
      await this.updateUser(userId, { photoURL: photoUrl });
      return;
    }

    try {
      logFirebaseOp('UPDATE', 'users', userId);
      
      await axios.patch(`${API_BASE}/api/users/${userId}`, {
        photoURL: photoUrl,
        updated_at: serverTimestamp(),
      });
      
      console.log('✅ Profile picture updated for user:', userId);
    } catch (error: any) {
      console.error('❌ Error updating profile picture:', error.message);
      throw error;
    }
  }

  /**
   * Update XP and check for level up
   * Returns new XP total and whether user leveled up
   */
  async updateXP(userId: string, xpToAdd: number): Promise<{ newXP: number; leveledUp: boolean; newLevel?: UserLevel }> {
    if (isDemoMode(userId)) {
      console.log(`✨ [Demo] Adding ${xpToAdd} XP locally`);
      try {
        const stored = await AsyncStorage.getItem(DEMO_STATS_KEY);
        const stats = stored ? JSON.parse(stored) : { xp: 0, level: 'Beginner' };
        const oldLevel = stats.level;
        const newXP = stats.xp + xpToAdd;
        const newLevel = calculateLevelFromXP(newXP);
        const leveledUp = oldLevel !== newLevel;
        
        await AsyncStorage.setItem(DEMO_STATS_KEY, JSON.stringify({
          ...stats,
          xp: newXP,
          level: newLevel,
        }));
        
        // Also update demo user
        const userStored = await AsyncStorage.getItem(DEMO_USER_KEY);
        if (userStored) {
          const user = JSON.parse(userStored);
          user.xp = newXP;
          user.level = newLevel;
          await AsyncStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
        }
        
        return { newXP, leveledUp, newLevel: leveledUp ? newLevel : undefined };
      } catch (error) {
        console.error('Error updating demo XP:', error);
        return { newXP: xpToAdd, leveledUp: false };
      }
    }

    try {
      logFirebaseOp('UPDATE', 'users', userId);
      
      // Get current user data
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      const oldLevel = user.level;
      const newXP = user.xp + xpToAdd;
      const newLevel = calculateLevelFromXP(newXP);
      const leveledUp = oldLevel !== newLevel;
      
      await axios.patch(`${API_BASE}/api/users/${userId}`, {
        xp: newXP,
        level: newLevel,
        updated_at: serverTimestamp(),
      });
      
      console.log(`✨ XP updated: +${xpToAdd} (Total: ${newXP})`);
      
      return { newXP, leveledUp, newLevel: leveledUp ? newLevel : undefined };
    } catch (error: any) {
      console.error('❌ Error updating XP:', error.message);
      throw error;
    }
  }

  /**
   * Update reward points
   * Returns new points total
   */
  async updateRewardPoints(userId: string, pointsToAdd: number): Promise<number> {
    if (isDemoMode(userId)) {
      console.log(`🎁 [Demo] Adding ${pointsToAdd} reward points locally`);
      try {
        const stored = await AsyncStorage.getItem(DEMO_STATS_KEY);
        const stats = stored ? JSON.parse(stored) : { rewardPoints: 0 };
        const newPoints = (stats.rewardPoints || 0) + pointsToAdd;
        
        await AsyncStorage.setItem(DEMO_STATS_KEY, JSON.stringify({
          ...stats,
          rewardPoints: newPoints,
        }));
        
        return newPoints;
      } catch (error) {
        console.error('Error updating demo points:', error);
        return pointsToAdd;
      }
    }

    try {
      logFirebaseOp('UPDATE', 'users', userId);
      
      const response = await axios.post(`${API_BASE}/api/users/${userId}/reward-points`, {
        pointsToAdd,
      });
      
      const newPoints = response.data.newPoints || 0;
      console.log(`🎁 Reward points updated: +${pointsToAdd} (Total: ${newPoints})`);
      
      return newPoints;
    } catch (error: any) {
      console.error('❌ Error updating reward points:', error.message);
      throw error;
    }
  }

  /**
   * Update dietary preferences
   */
  async updateDietaryPreferences(userId: string, preferences: string[], customText?: string): Promise<void> {
    if (isDemoMode(userId)) {
      console.log('🥗 [Demo] Updating dietary preferences locally');
      try {
        const stored = await AsyncStorage.getItem(DEMO_USER_KEY);
        if (stored) {
          const user = JSON.parse(stored);
          user.dietary_preferences = preferences;
          if (customText !== undefined) {
            user.dietary_custom = customText;
          }
          user.updated_at = new Date();
          await AsyncStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
        }
      } catch (error) {
        console.error('Error updating demo preferences:', error);
      }
      return;
    }

    try {
      logFirebaseOp('UPDATE', 'users', userId);
      
      const updateData: any = {
        dietary_preferences: preferences,
        updated_at: serverTimestamp(),
      };
      
      if (customText !== undefined) {
        updateData.dietary_custom = customText;
      }
      
      await axios.patch(`${API_BASE}/api/users/${userId}`, updateData);
      
      console.log('✅ Dietary preferences updated');
    } catch (error: any) {
      console.error('❌ Error updating dietary preferences:', error.message);
      throw error;
    }
  }

  /**
   * Update allergies
   */
  async updateAllergies(userId: string, allergies: string[], customText?: string): Promise<void> {
    if (isDemoMode(userId)) {
      console.log('⚠️ [Demo] Updating allergies locally');
      try {
        const stored = await AsyncStorage.getItem(DEMO_USER_KEY);
        if (stored) {
          const user = JSON.parse(stored);
          user.dietary_allergies = allergies;
          if (customText !== undefined) {
            user.allergy_custom = customText;
          }
          user.updated_at = new Date();
          await AsyncStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
        }
      } catch (error) {
        console.error('Error updating demo allergies:', error);
      }
      return;
    }

    try {
      logFirebaseOp('UPDATE', 'users', userId);
      
      const updateData: any = {
        dietary_allergies: allergies,
        updated_at: serverTimestamp(),
      };
      
      if (customText !== undefined) {
        updateData.allergy_custom = customText;
      }
      
      await axios.patch(`${API_BASE}/api/users/${userId}`, updateData);
      
      console.log('✅ Allergies updated');
    } catch (error: any) {
      console.error('❌ Error updating allergies:', error.message);
      throw error;
    }
  }

  /**
   * Increment recipes completed count
   */
  async incrementRecipesCompleted(userId: string): Promise<number> {
    if (isDemoMode(userId)) {
      console.log('📈 [Demo] Incrementing recipes completed');
      try {
        const stored = await AsyncStorage.getItem(DEMO_USER_KEY);
        if (stored) {
          const user = JSON.parse(stored);
          user.recipesCompleted = (user.recipesCompleted || 0) + 1;
          await AsyncStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
          return user.recipesCompleted;
        }
      } catch (error) {
        console.error('Error incrementing demo recipes:', error);
      }
      return 1;
    }

    try {
      logFirebaseOp('UPDATE', 'users', userId);
      
      const response = await axios.post(`${API_BASE}/api/users/${userId}/increment-recipes`);
      
      return response.data.recipesCompleted || 0;
    } catch (error: any) {
      console.error('❌ Error incrementing recipes completed:', error.message);
      throw error;
    }
  }

  /**
   * Increment posts created count
   */
  async incrementPostsCreated(userId: string): Promise<number> {
    if (isDemoMode(userId)) {
      console.log('📈 [Demo] Incrementing posts created');
      try {
        const stored = await AsyncStorage.getItem(DEMO_USER_KEY);
        if (stored) {
          const user = JSON.parse(stored);
          user.postsCreated = (user.postsCreated || 0) + 1;
          await AsyncStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
          return user.postsCreated;
        }
      } catch (error) {
        console.error('Error incrementing demo posts:', error);
      }
      return 1;
    }

    try {
      logFirebaseOp('UPDATE', 'users', userId);
      
      const response = await axios.post(`${API_BASE}/api/users/${userId}/increment-posts`);
      
      return response.data.postsCreated || 0;
    } catch (error: any) {
      console.error('❌ Error incrementing posts created:', error.message);
      throw error;
    }
  }
}

export const userService = new UserService();
export default userService;
