// contexts/UserContext.tsx - Global user state management
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../services/auth.service';

// Storage key for user profile
const PROFILE_KEY = '@cheffy_user_profile';

// User profile interface
export interface UserProfile {
  displayName: string;
  bio: string;
  photoURL: string | null;
  dietaryPreferences: string[];
  allergies: string[];
  cookingLevel: string;
}

// Default profile values
const DEFAULT_PROFILE: UserProfile = {
  displayName: '',
  bio: '',
  photoURL: null,
  dietaryPreferences: [],
  allergies: [],
  cookingLevel: 'Beginner',
};

// Context value type
interface UserContextValue {
  /** Current user profile */
  profile: UserProfile;
  /** User's UID from auth */
  uid: string | null;
  /** Whether profile is loading */
  loading: boolean;
  /** Update user profile (merges with existing) */
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  /** Refresh profile from storage/auth */
  refreshProfile: () => Promise<void>;
  /** Set complete profile (replaces existing) */
  setProfile: (profile: UserProfile) => Promise<void>;
}

// Create context with default values
const UserContext = createContext<UserContextValue>({
  profile: DEFAULT_PROFILE,
  uid: null,
  loading: true,
  updateProfile: async () => {},
  refreshProfile: async () => {},
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
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  // Load profile from AsyncStorage and auth
  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get user from auth service
      const user = await authService.getCurrentGoogleUser();
      if (user) {
        setUid(user.uid);
      }

      // Load stored profile
      const stored = await AsyncStorage.getItem(PROFILE_KEY);
      if (stored) {
        const parsedProfile = JSON.parse(stored);
        setProfileState(parsedProfile);
      } else if (user?.displayName) {
        // Initialize with auth display name if no stored profile
        setProfileState(prev => ({
          ...prev,
          displayName: user.displayName,
        }));
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update profile (partial update)
  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    try {
      const newProfile = { ...profile, ...updates };
      setProfileState(newProfile);
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
      
      // TODO: Also update Firebase users collection when using real Firebase
      // await firestore.collection('users').doc(uid).update(updates);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }, [profile]);

  // Set complete profile (replaces existing)
  const setProfile = useCallback(async (newProfile: UserProfile) => {
    try {
      setProfileState(newProfile);
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
      
      // TODO: Also update Firebase users collection when using real Firebase
      // await firestore.collection('users').doc(uid).set(newProfile);
    } catch (error) {
      console.error('Error setting profile:', error);
      throw error;
    }
  }, []);

  // Refresh profile from storage
  const refreshProfile = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  const value: UserContextValue = {
    profile,
    uid,
    loading,
    updateProfile,
    refreshProfile,
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
