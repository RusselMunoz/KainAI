// contexts/AuthContext.tsx - Global authentication state management
// Uses Firebase JS SDK for Expo Go compatibility
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithCredential,
  signOut as firebaseSignOut,
  updateProfile,
  GoogleAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { GoogleSignin, statusCodes, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { DEMO_USER_ID, isDemoMode, firebaseAuth } from '../config/firebase';
import userService from '../services/userService';

// Storage keys
const AUTH_STATE_KEY = '@kainai_auth_state';
const ONBOARDING_KEY = '@kainai_onboarding_complete';

// Toggle for email/password login - set to true to enable
export const ENABLE_EMAIL_PASSWORD_LOGIN = true;

// Google Sign-In web client ID - get from Firebase console
const WEB_CLIENT_ID = '953646495667-lt8oouu1gl7982ki7uhbierg0616uhne.apps.googleusercontent.com';

// Configure Google Sign-In once
let googleSignInConfigured = false;

const configureGoogleSignIn = () => {
  if (googleSignInConfigured) return;
  
  try {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      offlineAccess: true,
      scopes: ['profile', 'email'],
    });
    googleSignInConfigured = true;
    console.log('[Auth] Google Sign-In configured');
  } catch (error) {
    console.error('[Auth] Failed to configure Google Sign-In:', error);
  }
};

// User type that combines Firebase user with app-specific data
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
  onboardingComplete: boolean;
}

// Context value type
interface AuthContextValue {
  /** Current authenticated user (null if not logged in) */
  user: AuthUser | null;
  /** Whether auth state is being loaded */
  loading: boolean;
  /** Whether this is user's first time (needs onboarding) */
  isFirstTime: boolean;
  /** Sign in with email and password */
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  /** Create account with email and password */
  signUp: (email: string, password: string, displayName?: string) => Promise<{ success: boolean; error?: string }>;
  /** Sign in with Google */
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  /** Sign out */
  signOut: () => Promise<{ success: boolean; error?: string }>;
  /** Mark onboarding as complete */
  completeOnboarding: () => Promise<void>;
  /** Check if email/password login is enabled */
  emailPasswordEnabled: boolean;
}

// Create context with default values
const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isFirstTime: false,
  signIn: async () => ({ success: false, error: 'Not initialized' }),
  signUp: async () => ({ success: false, error: 'Not initialized' }),
  signInWithGoogle: async () => ({ success: false, error: 'Not initialized' }),
  signOut: async () => ({ success: false, error: 'Not initialized' }),
  completeOnboarding: async () => {},
  emailPasswordEnabled: ENABLE_EMAIL_PASSWORD_LOGIN,
});

// Provider props
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider - Wraps the app to provide global authentication state
 * 
 * Usage:
 * 1. Wrap your app with <AuthProvider>
 * 2. Access auth state with useAuth() hook
 * 3. Use signIn, signInWithGoogle, signOut methods
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFirstTime, setIsFirstTime] = useState(false);

  // Initialize Google Sign-In on mount
  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const auth = firebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[Auth] Auth state changed:', firebaseUser?.uid || 'null');
      
      if (firebaseUser) {
        await handleUserSignIn(firebaseUser);
      } else {
        // Check for demo mode / stored state
        await checkStoredAuthState();
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle user sign in - load or create user data
  const handleUserSignIn = async (firebaseUser: FirebaseUser) => {
    try {
      // Check if onboarding is complete
      const onboardingComplete = await checkOnboardingStatus(firebaseUser.uid);
      
      const authUser: AuthUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        isAnonymous: firebaseUser.isAnonymous,
        onboardingComplete,
      };

      setUser(authUser);
      setIsFirstTime(!onboardingComplete);

      // Store auth state for offline access
      await AsyncStorage.setItem(AUTH_STATE_KEY, JSON.stringify({
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName,
        photoURL: authUser.photoURL,
      }));

      // Ensure user document exists in Firestore (via backend API)
      if (!isDemoMode(firebaseUser.uid)) {
        try {
          await userService.ensureUserExists({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || null,
          });
        } catch (error) {
          console.warn('[Auth] Failed to sync user to backend (non-blocking):', error);
        }
      }
    } catch (error) {
      console.error('[Auth] Error handling sign in:', error);
    }
  };

  // Check onboarding status from storage/Firestore
  const checkOnboardingStatus = async (uid: string): Promise<boolean> => {
    try {
      // Check local storage first (faster)
      const stored = await AsyncStorage.getItem(`${ONBOARDING_KEY}_${uid}`);
      if (stored === 'true') return true;

      // Check Firestore via backend
      try {
        const userData = await userService.getUser(uid);
        if (userData?.onboardingComplete) {
          await AsyncStorage.setItem(`${ONBOARDING_KEY}_${uid}`, 'true');
          return true;
        }
      } catch (error) {
        console.warn('[Auth] Failed to check onboarding status from backend:', error);
      }

      return false;
    } catch (error) {
      console.error('[Auth] Error checking onboarding status:', error);
      return false;
    }
  };

  // Check for stored auth state (for demo mode or offline)
  const checkStoredAuthState = async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_STATE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only restore demo users when Firebase is not available
        if (parsed.uid && isDemoMode(parsed.uid)) {
          const onboardingComplete = await checkOnboardingStatus(parsed.uid);
          setUser({
            ...parsed,
            isAnonymous: false,
            onboardingComplete,
          });
          setIsFirstTime(!onboardingComplete);
        }
      }
    } catch (error) {
      console.error('[Auth] Error checking stored auth state:', error);
    }
    setUser(null);
  };

  // Sign in with email and password
  const signIn = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      const auth = firebaseAuth();
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Email sign-in error:', error);
      let errorMessage = 'Sign in failed. Please try again.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      }
      
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // Sign up with email and password
  const signUp = useCallback(async (email: string, password: string, displayName?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      const auth = firebaseAuth();
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update display name if provided
      if (displayName && credential.user) {
        await updateProfile(credential.user, { displayName });
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Email sign-up error:', error);
      let errorMessage = 'Sign up failed. Please try again.';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Use at least 6 characters.';
      }
      
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // Sign in with Google
  const signInWithGoogle = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      
      // Ensure Google Sign-In is configured
      configureGoogleSignIn();

      // Check Play Services on Android
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      // Get the user's ID token
      const response = await GoogleSignin.signIn();
      
      if (!isSuccessResponse(response)) {
        throw new Error('Google Sign-In was cancelled');
      }

      const { data } = response;
      if (!data?.idToken) {
        throw new Error('No ID token received from Google Sign-In');
      }

      // Create a Google credential with the token
      const googleCredential = GoogleAuthProvider.credential(data.idToken);

      // Sign in to Firebase with the Google credential
      const auth = firebaseAuth();
      await signInWithCredential(auth, googleCredential);

      console.log('[Auth] Google Sign-In successful');
      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Google Sign-In error:', error);
      
      let errorMessage = 'Google Sign-In failed. Please try again.';
      
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        errorMessage = 'Sign in was cancelled.';
      } else if (error.code === statusCodes.IN_PROGRESS) {
        errorMessage = 'Sign in is already in progress.';
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        errorMessage = 'Google Play Services not available.';
      }
      
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // Sign out
  const signOut = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      
      // Sign out from Firebase
      const auth = firebaseAuth();
      await firebaseSignOut(auth);
      
      // Sign out from Google if signed in
      try {
        const isGoogleSignedIn = await GoogleSignin.isSignedIn();
        if (isGoogleSignedIn) {
          await GoogleSignin.revokeAccess();
          await GoogleSignin.signOut();
        }
      } catch (googleError) {
        console.warn('[Auth] Google sign out error (non-blocking):', googleError);
      }
      
      // Clear stored auth state
      await AsyncStorage.removeItem(AUTH_STATE_KEY);
      
      setUser(null);
      setIsFirstTime(false);
      
      console.log('[Auth] Sign out successful');
      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Sign out error:', error);
      return { success: false, error: 'Sign out failed. Please try again.' };
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark onboarding as complete
  const completeOnboarding = useCallback(async () => {
    if (!user) return;
    
    try {
      // Update local state
      setUser(prev => prev ? { ...prev, onboardingComplete: true } : null);
      setIsFirstTime(false);
      
      // Store locally
      await AsyncStorage.setItem(`${ONBOARDING_KEY}_${user.uid}`, 'true');
      
      // Update in backend/Firestore
      if (!isDemoMode(user.uid)) {
        try {
          await userService.updateUser(user.uid, { onboardingComplete: true });
        } catch (error) {
          console.warn('[Auth] Failed to sync onboarding status to backend:', error);
        }
      }
      
      console.log('[Auth] Onboarding marked as complete');
    } catch (error) {
      console.error('[Auth] Error completing onboarding:', error);
    }
  }, [user]);

  const value: AuthContextValue = {
    user,
    loading,
    isFirstTime,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    completeOnboarding,
    emailPasswordEnabled: ENABLE_EMAIL_PASSWORD_LOGIN,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth hook - Access global authentication state
 * 
 * @example
 * const { user, signIn, signOut } = useAuth();
 * 
 * // Check if logged in
 * if (!user) {
 *   return <LoginScreen />;
 * }
 * 
 * // Sign out
 * await signOut();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
