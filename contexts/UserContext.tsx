// contexts/UserContext.tsx - Global user state management
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../services/auth.service';
import userService from '../services/userService';
import statsService from '../services/statsService';
import { isDemoMode, DEMO_USER_ID } from '../config/firebase';
import { useAuth } from './AuthContext';
import type { UserLevel } from '../types';

// Storage keys
const PROFILE_KEY = '@cheffy_user_profile';
const STATS_KEY = '@kainai_user_stats';

// Valid options for normalization (must match UI options in edit-profile.tsx)
const VALID_DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Halal', 'Kosher'];
const VALID_ALLERGY_OPTIONS = ['Nuts', 'Shellfish', 'Eggs', 'Soy', 'Wheat', 'Fish', 'Sesame'];
const VALID_COOKING_LEVELS: UserLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Master Chef'];

/**
 * Normalize dietary preferences/allergies to match UI options (title case)
 * Filters out 'none' values and empty strings
 */
const normalizePreferences = (prefs: string[], validOptions: string[]): string[] => {
  if (!Array.isArray(prefs)) return [];
  return prefs
    .filter(p => p && p.toLowerCase() !== 'none')
    .map(pref => {
      // Find matching option (case-insensitive)
      const match = validOptions.find(opt => opt.toLowerCase() === pref.toLowerCase());
      return match || pref; // Return matched option or original if no match
    });
};

/**
 * Normalize cooking level from cooking_skills array or level string
 */
const normalizeCookingLevel = (cookingSkills: string[] | undefined, level: string | undefined): UserLevel => {
  // First try cooking_skills array (user-selected during onboarding)
  if (Array.isArray(cookingSkills) && cookingSkills.length > 0) {
    const skill = cookingSkills[0];
    const match = VALID_COOKING_LEVELS.find(opt => opt.toLowerCase() === skill.toLowerCase());
    if (match) return match;
  }
  // Fallback to level field (XP-based or stored level)
  if (level) {
    const match = VALID_COOKING_LEVELS.find(opt => opt.toLowerCase() === level.toLowerCase());
    if (match) return match;
  }
  return 'Beginner';
};

// User profile interface
export interface UserProfile {
  displayName: string | null;
  bio: string;
  photoURL: string | null;
  dietaryPreferences: string[];
  allergies: string[];
  cookingLevel: UserLevel;
  // Custom text fields for specific dietary needs and allergies
  customDietaryText: string;
  customAllergyText: string;
}

// User stats interface (XP, points, achievements)
export interface UserStats {
  xp: number;
  rewardPoints: number;
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
  
  // Get auth user from AuthContext to watch for login state changes
  const { user: authUser, loading: authLoading } = useAuth();
  
  // Track if we've loaded for the current user to avoid redundant loads
  const loadedForUid = useRef<string | null>(null);

  // Load stats from AsyncStorage - defined first so loadAll can reference it
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

  // Load profile from AsyncStorage and Firestore - defined before loadAll
  const loadProfile = useCallback(async () => {
    console.log('[UserContext] ========== loadProfile STARTED ==========');
    console.log('[UserContext] authUser from context:', authUser?.uid || 'null');
    
    try {
      // Get user from auth service
      console.log('[UserContext] Step 1: Calling authService.getCurrentGoogleUser()...');
      const user = await authService.getCurrentGoogleUser();
      console.log('[UserContext] Step 1 COMPLETE: getCurrentGoogleUser returned:', user ? { uid: user.uid, displayName: user.displayName, email: user.email } : 'null');
      
      if (user) {
        setUid(user.uid);
        console.log('[UserContext] User UID set:', user.uid);
      } else {
        console.warn('[UserContext] WARNING: getCurrentGoogleUser returned null but authUser.uid is:', authUser?.uid);
      }

      // Always try to fetch fresh data from Firestore if we have a UID
      const uidToUse = user?.uid || authUser?.uid;
      console.log('[UserContext] Step 2: Checking if should fetch from Firestore. uidToUse:', uidToUse, 'isDemoMode:', uidToUse ? isDemoMode(uidToUse) : 'N/A');
      
      if (uidToUse && !isDemoMode(uidToUse)) {
        console.log('[UserContext] Step 3: Fetching profile from Firestore for UID:', uidToUse);
        try {
          console.log('[UserContext] Step 3a: Calling userService.getUser()...');
          const firestoreUser = await userService.getUser(uidToUse);
          console.log('[UserContext] Step 3b: userService.getUser() returned:', firestoreUser ? 'Object with keys: ' + Object.keys(firestoreUser).join(', ') : 'null/undefined');
          
          // FIX: Check for firestoreUser existence, not displayName (displayName can be empty)
          if (firestoreUser) {
            console.log('[UserContext] Got Firestore user data:', firestoreUser.displayName);
            console.log('[UserContext] Raw Firestore data - dietary_preferences:', firestoreUser.dietary_preferences, 'dietary_allergies:', firestoreUser.dietary_allergies, 'cooking_skills:', firestoreUser.cooking_skills);
            const firestoreProfile: UserProfile = {
              displayName: firestoreUser.displayName || '',
              bio: firestoreUser.bio || '',
              photoURL: firestoreUser.photoURL || null,
              dietaryPreferences: normalizePreferences(firestoreUser.dietary_preferences || [], VALID_DIETARY_OPTIONS),
              allergies: normalizePreferences(firestoreUser.dietary_allergies || [], VALID_ALLERGY_OPTIONS),
              cookingLevel: normalizeCookingLevel(firestoreUser.cooking_skills, firestoreUser.level),
              customDietaryText: firestoreUser.dietary_custom || '',
              customAllergyText: firestoreUser.allergy_custom || '',
            };
            console.log('[UserContext] Normalized profile - dietaryPreferences:', firestoreProfile.dietaryPreferences, 'allergies:', firestoreProfile.allergies, 'cookingLevel:', firestoreProfile.cookingLevel);
            
            // FIX: Always call setProfileState when we have Firestore data
            console.log('[UserContext] Step 4: About to call setProfileState with Firestore data...');
            setProfileState(firestoreProfile);
            console.log('[UserContext] Step 4 COMPLETE: setProfileState called with Firestore data');
            
            // Also save to AsyncStorage for offline access
            console.log('[UserContext] Step 5: Saving to AsyncStorage...');
            await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(firestoreProfile));
            console.log('[UserContext] Step 5 COMPLETE: Profile synced from Firestore, displayName:', firestoreProfile.displayName);
            console.log('[UserContext] ========== loadProfile FINISHED (Firestore path) ==========');
            return; // Successfully loaded from Firestore
          } else {
            console.log('[UserContext] firestoreUser is null/undefined, falling back to local storage');
          }
        } catch (firestoreError) {
          console.error('[UserContext] ERROR in Firestore fetch:', firestoreError);
          console.error('[UserContext] Error name:', (firestoreError as Error).name);
          console.error('[UserContext] Error message:', (firestoreError as Error).message);
          console.error('[UserContext] Error stack:', (firestoreError as Error).stack);
          console.log('[UserContext] Falling back to local storage...');
        }
      } else {
        console.log('[UserContext] Skipping Firestore fetch - no UID or demo mode');
      }

      // Fallback: Load stored profile from AsyncStorage
      console.log('[UserContext] Step 6: Loading from AsyncStorage fallback...');
      const stored = await AsyncStorage.getItem(PROFILE_KEY);
      console.log('[UserContext] AsyncStorage PROFILE_KEY exists:', !!stored);
      
      if (stored) {
        const parsedProfile = JSON.parse(stored);
        console.log('[UserContext] Loaded profile from AsyncStorage, displayName:', parsedProfile.displayName);
        // Handle both snake_case (from onboarding) and camelCase (legacy) formats
        const rawDietaryPrefs = parsedProfile.dietary_preferences || parsedProfile.dietaryPreferences || [];
        const rawAllergies = parsedProfile.dietary_allergies || parsedProfile.allergies || [];
        const rawCookingSkills = parsedProfile.cooking_skills || parsedProfile.cookingLevel;
        
        const normalizedProfile: UserProfile = {
          displayName: parsedProfile.displayName || '',
          bio: parsedProfile.bio || '',
          photoURL: parsedProfile.photoURL || null,
          dietaryPreferences: normalizePreferences(Array.isArray(rawDietaryPrefs) ? rawDietaryPrefs : [], VALID_DIETARY_OPTIONS),
          allergies: normalizePreferences(Array.isArray(rawAllergies) ? rawAllergies : [], VALID_ALLERGY_OPTIONS),
          cookingLevel: normalizeCookingLevel(
            Array.isArray(rawCookingSkills) ? rawCookingSkills : undefined,
            typeof rawCookingSkills === 'string' ? rawCookingSkills : undefined
          ),
          customDietaryText: parsedProfile.customDietaryText || '',
          customAllergyText: parsedProfile.customAllergyText || '',
        };
        console.log('[UserContext] Step 6a: About to call setProfileState with AsyncStorage data...');
        setProfileState(normalizedProfile);
        console.log('[UserContext] Step 6a COMPLETE: setProfileState called with AsyncStorage data');
        console.log('[UserContext] ========== loadProfile FINISHED (AsyncStorage path) ==========');
      } else {
        // Try to migrate from legacy onboarding format
        console.log('[UserContext] Step 7: No stored profile, checking for legacy format...');
        const legacyProfile = await AsyncStorage.getItem('profile');
        console.log('[UserContext] Legacy profile exists:', !!legacyProfile);
        
        if (legacyProfile) {
          try {
            const legacy = JSON.parse(legacyProfile);
            console.log('[UserContext] Migrating legacy profile:', legacy);
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
            console.log('[UserContext] ========== loadProfile FINISHED (Legacy migration path) ==========');
          } catch (parseError) {
            console.error('[UserContext] Error migrating legacy profile:', parseError);
          }
        } else {
          // Use authUser from context or user from getCurrentGoogleUser
          const fallbackUser = user || authUser;
          console.log('[UserContext] Step 8: No stored profile, checking fallback user displayName:', fallbackUser?.displayName);
          
          if (fallbackUser?.displayName) {
            // Initialize with auth display name if no stored profile
            console.log('[UserContext] Using auth displayName:', fallbackUser.displayName);
            setProfileState(prev => ({
              ...prev,
              displayName: fallbackUser.displayName ?? '',
            }));
            console.log('[UserContext] ========== loadProfile FINISHED (Auth displayName path) ==========');
          } else {
            console.log('[UserContext] ========== loadProfile FINISHED (No profile found) ==========');
          }
        }
      }
    } catch (error) {
      console.error('[UserContext] ========== loadProfile FATAL ERROR ==========');
      console.error('[UserContext] Error:', error);
      console.error('[UserContext] Error name:', (error as Error).name);
      console.error('[UserContext] Error message:', (error as Error).message);
      console.error('[UserContext] Error stack:', (error as Error).stack);
    }
  }, [authUser]);

  // Load all data - now loadProfile and loadStats are defined before this
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([loadProfile(), loadStats()]);
    } finally {
      setLoading(false);
    }
  }, [loadProfile, loadStats]);

  // Watch for auth user changes and trigger loadProfile when user logs in
  // This is the key fix: when user state changes from null to an object, load profile
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      console.log('[UserContext] Auth still loading, waiting...');
      return;
    }

    const currentUid = authUser?.uid || null;
    
    // If user logged in (or changed), and we haven't loaded for this user yet
    if (currentUid && loadedForUid.current !== currentUid) {
      console.log('[UserContext] User logged in, triggering loadProfile for UID:', currentUid);
      loadedForUid.current = currentUid;
      loadAll();
    } else if (!currentUid && loadedForUid.current !== null) {
      // User logged out - reset state
      console.log('[UserContext] User logged out, resetting profile state');
      loadedForUid.current = null;
      setProfileState(DEFAULT_PROFILE);
      setStatsState(DEFAULT_STATS);
      setUid(null);
      setLoading(false);
    } else if (!currentUid && loadedForUid.current === null) {
      // No user and we've already acknowledged no user - just ensure loading is false
      setLoading(false);
    }
  }, [authUser, authLoading, loadAll]);

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
          if (updates.displayName !== undefined) {
            firebaseUpdates.displayName = updates.displayName ?? '';
          }
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
    const currentUid = authUser?.uid;
    console.log('setProfile called, uid:', currentUid, 'newProfile:', newProfile?.displayName);
    try {
      setProfileState(newProfile);
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
      
      // Sync with Firebase if user is authenticated
      if (currentUid) {
        const firebaseProfile = {
          displayName: newProfile.displayName ?? '',
          bio: newProfile.bio,
          photoURL: newProfile.photoURL,
          dietary_preferences: newProfile.dietaryPreferences,
          dietary_allergies: newProfile.allergies,
          dietary_custom: newProfile.customDietaryText,
          allergy_custom: newProfile.customAllergyText,
          level: newProfile.cookingLevel,
        };
        try {
          console.log('Sending to API:', firebaseProfile);
          await userService.updateUser(currentUid, firebaseProfile);
          console.log('API update successful');
        } catch (err) {
          console.error('API update FAILED:', err);
        }
      }
    } catch (error) {
      console.error('Error setting profile:', error);
      throw error;
    }
  }, [authUser]);

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
