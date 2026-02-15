// contexts/UserContext.tsx - Global user state management
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../services/auth.service';
import userService from '../services/userService';
import statsService from '../services/statsService';
import { isDemoMode, DEMO_USER_ID } from '../config/firebase';

// Storage keys
const PROFILE_KEY = '@cheffy_user_profile';
const STATS_KEY = '@kainai_user_stats';

// User profile interface
export interface UserProfile {
  displayName: string;
  bio: string;
  photoURL: string | null;
  dietaryPreferences: string[];
  allergies: string[];
  cookingLevel: string;
  // Custom text fields for specific dietary needs and allergies
  customDietaryText: string;
  customAllergyText: string;
}

// User stats interface (XP, points, achievements)
export interface UserStats {
  xp: number;
  rewardPoints: number;
  level: string;
  recipesCompleted: number;
  recipesShared: number;
  totalIngredientsUsed: number;
  uniqueIngredients: string[];
  achievementsCompleted: string[];
  currentStreak: number;
  lastCookDate: string | null;
  unlockedFeatures: string[];
  communityPoints: number;
  // Weekly goals tracking
  weeklyGoals: {
    recipesCooked: number;
    newIngredientsTried: number;
    creationsShared: number;
    goalsCompletedThisWeek: string[]; // Track which goals were completed to prevent re-awarding
    lastResetDate: string | null;
  };
}

// Default profile values
const DEFAULT_PROFILE: UserProfile = {
  displayName: '',
  bio: '',
  photoURL: null,
  dietaryPreferences: [],
  allergies: [],
  cookingLevel: 'Beginner',
  customDietaryText: '',
  customAllergyText: '',
};

// Default stats values
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
  weeklyGoals: {
    recipesCooked: 0,
    newIngredientsTried: 0,
    creationsShared: 0,
    goalsCompletedThisWeek: [],
    lastResetDate: null,
  },
};

// Context value type
interface UserContextValue {
  /** Current user profile */
  profile: UserProfile;
  /** Current user stats (XP, points, etc.) */
  stats: UserStats;
  /** User's UID from auth */
  uid: string | null;
  /** Whether profile is loading */
  loading: boolean;
  /** Update user profile (merges with existing) */
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  /** Update user stats (merges with existing) */
  updateStats: (updates: Partial<UserStats>) => Promise<void>;
  /** Refresh profile from storage/auth */
  refreshProfile: () => Promise<void>;
  /** Refresh stats from storage */
  refreshStats: () => Promise<void>;
  /** Set complete profile (replaces existing) */
  setProfile: (profile: UserProfile) => Promise<void>;
}

// Create context with default values
const UserContext = createContext<UserContextValue>({
  profile: DEFAULT_PROFILE,
  stats: DEFAULT_STATS,
  uid: null,
  loading: true,
  updateProfile: async () => {},
  updateStats: async () => {},
  refreshProfile: async () => {},
  refreshStats: async () => {},
  setProfile: async () => {},
});

// Provider props
interface UserProviderProps {
  children: ReactNode;
}

/**
 * UserProvider - Wraps the app to provide global user state
 * 
 * Usage:
 * 1. Wrap your app with <UserProvider>
 * 2. Access user state with useUser() hook
 * 3. Profile updates automatically sync to all screens
 */
export function UserProvider({ children }: UserProviderProps) {
  const [profile, setProfileState] = useState<UserProfile>(DEFAULT_PROFILE);
  const [stats, setStatsState] = useState<UserStats>(DEFAULT_STATS);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load profile and stats on mount
  useEffect(() => {
    loadAll();
  }, []);

  // Load all data
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([loadProfile(), loadStats()]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load stats from AsyncStorage
  const loadStats = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STATS_KEY);
      if (stored) {
        const parsedStats = { ...DEFAULT_STATS, ...JSON.parse(stored) };
        // Ensure weeklyGoals exists (migration)
        if (!parsedStats.weeklyGoals) {
          parsedStats.weeklyGoals = DEFAULT_STATS.weeklyGoals;
        }
        setStatsState(parsedStats);
        console.log('📊 Stats loaded:', parsedStats.xp, 'XP,', parsedStats.rewardPoints, 'pts');
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  // Load profile from AsyncStorage and Firestore
  const loadProfile = useCallback(async () => {
    try {
      // Get user from auth service
      const user = await authService.getCurrentGoogleUser();
      if (user) {
        setUid(user.uid);
        console.log('[UserContext] User UID from auth:', user.uid);
      }

      // Always try to fetch fresh data from Firestore if we have a UID
      if (user?.uid && !isDemoMode(user.uid)) {
        console.log('[UserContext] Fetching profile from Firestore...');
        try {
          const firestoreUser = await userService.getUser(user.uid);
          if (firestoreUser && firestoreUser.displayName) {
            console.log('[UserContext] Got displayName from Firestore:', firestoreUser.displayName);
            const firestoreProfile: UserProfile = {
              displayName: firestoreUser.displayName || '',
              bio: firestoreUser.bio || '',
              photoURL: firestoreUser.photoURL || null,
              dietaryPreferences: firestoreUser.dietary_preferences || [],
              allergies: firestoreUser.dietary_allergies || [],
              cookingLevel: firestoreUser.level || 'Beginner',
              customDietaryText: firestoreUser.dietary_custom || '',
              customAllergyText: firestoreUser.allergy_custom || '',
            };
            setProfileState(firestoreProfile);
            // Also save to AsyncStorage for offline access
            await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(firestoreProfile));
            console.log('[UserContext] Profile synced from Firestore, displayName:', firestoreProfile.displayName);
            return; // Successfully loaded from Firestore
          }
        } catch (firestoreError) {
          console.error('[UserContext] Failed to fetch from Firestore, falling back to local:', firestoreError);
        }
      }

      // Fallback: Load stored profile from AsyncStorage
      const stored = await AsyncStorage.getItem(PROFILE_KEY);
      if (stored) {
        const parsedProfile = JSON.parse(stored);
        console.log('[UserContext] Loaded profile from AsyncStorage, displayName:', parsedProfile.displayName);
        setProfileState(parsedProfile);
      } else {
        // Try to migrate from legacy onboarding format
        const legacyProfile = await AsyncStorage.getItem('profile');
        if (legacyProfile) {
          try {
            const legacy = JSON.parse(legacyProfile);
            // Convert legacy format { name, prefs, allergies, level } to UserProfile
            const prefsArray = legacy.prefs === 'None' || !legacy.prefs 
              ? [] 
              : legacy.prefs.split(',').map((s: string) => s.trim()).filter(Boolean);
            const allergiesArray = legacy.allergies === 'None' || !legacy.allergies 
              ? [] 
              : legacy.allergies.split(',').map((s: string) => s.trim()).filter(Boolean);
            
            const migratedProfile: UserProfile = {
              displayName: legacy.name || '',
              bio: '',
              photoURL: null,
              dietaryPreferences: prefsArray,
              allergies: allergiesArray,
              cookingLevel: legacy.level || 'Beginner',
              customDietaryText: '',
              customAllergyText: '',
            };
            
            // Save migrated profile
            await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(migratedProfile));
            setProfileState(migratedProfile);
            console.log('[UserContext] Migrated legacy profile, displayName:', migratedProfile.displayName);
          } catch (parseError) {
            console.error('[UserContext] Error migrating legacy profile:', parseError);
          }
        } else if (user?.displayName) {
          // Initialize with auth display name if no stored profile
          console.log('[UserContext] Using auth displayName:', user.displayName);
          setProfileState(prev => ({
            ...prev,
            displayName: user.displayName,
          }));
        }
      }
    } catch (error) {
      console.error('[UserContext] Error loading user profile:', error);
    }
  }, []);

  // Update profile (partial update)
  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    try {
      const newProfile = { ...profile, ...updates };
      setProfileState(newProfile);
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
      
      // Sync with Firebase if user is authenticated
      if (uid) {
        try {
          // Map profile keys to Firebase user document fields
          const firebaseUpdates: any = {};
          if (updates.displayName !== undefined) firebaseUpdates.displayName = updates.displayName;
          if (updates.bio !== undefined) firebaseUpdates.bio = updates.bio;
          if (updates.photoURL !== undefined) firebaseUpdates.photoURL = updates.photoURL;
          if (updates.dietaryPreferences !== undefined) firebaseUpdates.dietary_preferences = updates.dietaryPreferences;
          if (updates.allergies !== undefined) firebaseUpdates.dietary_allergies = updates.allergies;
          if (updates.customDietaryText !== undefined) firebaseUpdates.dietary_custom = updates.customDietaryText;
          if (updates.customAllergyText !== undefined) firebaseUpdates.allergy_custom = updates.customAllergyText;
          if (updates.cookingLevel !== undefined) firebaseUpdates.level = updates.cookingLevel;
          
          if (Object.keys(firebaseUpdates).length > 0) {
            await userService.updateUser(uid, firebaseUpdates);
          }
        } catch (firebaseError) {
          console.warn('Failed to sync profile to Firebase (non-blocking):', firebaseError);
        }
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }, [profile, uid]);

  // Set complete profile (replaces existing)
  const setProfile = useCallback(async (newProfile: UserProfile) => {
    try {
      setProfileState(newProfile);
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
      
      // Sync with Firebase if user is authenticated
      if (uid) {
        try {
          const firebaseProfile = {
            displayName: newProfile.displayName,
            bio: newProfile.bio,
            photoURL: newProfile.photoURL,
            dietary_preferences: newProfile.dietaryPreferences,
            dietary_allergies: newProfile.allergies,
            dietary_custom: newProfile.customDietaryText,
            allergy_custom: newProfile.customAllergyText,
            level: newProfile.cookingLevel,
          };
          await userService.updateUser(uid, firebaseProfile);
        } catch (firebaseError) {
          console.warn('Failed to sync profile to Firebase (non-blocking):', firebaseError);
        }
      }
    } catch (error) {
      console.error('Error setting profile:', error);
      throw error;
    }
  }, [uid]);

  // Update stats (partial update) - This triggers re-renders in all subscribed components
  const updateStats = useCallback(async (updates: Partial<UserStats>) => {
    try {
      const newStats = { ...stats, ...updates };
      
      // Handle nested weeklyGoals updates
      if (updates.weeklyGoals) {
        newStats.weeklyGoals = { ...stats.weeklyGoals, ...updates.weeklyGoals };
      }
      
      setStatsState(newStats);
      await AsyncStorage.setItem(STATS_KEY, JSON.stringify(newStats));
      console.log('💾 Stats updated:', newStats.xp, 'XP,', newStats.rewardPoints, 'pts');
    } catch (error) {
      console.error('Error updating stats:', error);
      throw error;
    }
  }, [stats]);

  // Refresh profile from storage
  const refreshProfile = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  // Refresh stats from storage
  const refreshStats = useCallback(async () => {
    await loadStats();
  }, [loadStats]);

  const value: UserContextValue = {
    profile,
    stats,
    uid,
    loading,
    updateProfile,
    updateStats,
    refreshProfile,
    refreshStats,
    setProfile,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

/**
 * useUser hook - Access global user state
 * 
 * @example
 * const { profile, updateProfile } = useUser();
 * 
 * // Update profile picture
 * await updateProfile({ photoURL: 'https://...' });
 * 
 * // Access user data
 * <Avatar name={profile.displayName} photoURL={profile.photoURL} />
 */
export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export default UserContext;
