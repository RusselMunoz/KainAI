// config/google-signin.ts - Google Sign-In configuration
// Uses @react-native-google-signin/google-signin for native in-app authentication

import { GoogleSignin, statusCodes, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

// Google Sign-In web client ID from Firebase Console
// Get this from: Firebase Console > Authentication > Sign-in method > Google > Web SDK configuration
const WEB_CLIENT_ID = '985949544587-ctomcfbj9d2bqbmbmh2skl58n70ofj3j.apps.googleusercontent.com';

let isConfigured = false;

/**
 * Configure Google Sign-In
 * Must be called before any sign-in operations
 */
export const configureGoogleSignIn = () => {
  if (isConfigured) {
    console.log('[GoogleSignIn] Already configured');
    return;
  }
  
  try {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      offlineAccess: true,
      scopes: ['profile', 'email'],
    });
    isConfigured = true;
    console.log('[GoogleSignIn] Configured successfully');
  } catch (error) {
    console.error('[GoogleSignIn] Configuration error:', error);
  }
};

/**
 * Check if Google Play Services are available (Android only)
 */
export const ensurePlayServices = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }
  
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    console.log('[GoogleSignIn] Play Services available');
    return true;
  } catch (error: any) {
    console.error('[GoogleSignIn] Play Services error:', error);
    return false;
  }
};

/**
 * Check if user is currently signed in with Google
 */
export const isGoogleSignedIn = async (): Promise<boolean> => {
  try {
    return await GoogleSignin.isSignedIn();
  } catch (error) {
    console.error('[GoogleSignIn] Check sign-in status error:', error);
    return false;
  }
};

/**
 * Get current Google user info
 */
export const getCurrentGoogleUser = async () => {
  try {
    return await GoogleSignin.getCurrentUser();
  } catch (error) {
    console.error('[GoogleSignin] Get current user error:', error);
    return null;
  }
};

/**
 * Sign out from Google
 */
export const signOutGoogle = async (): Promise<boolean> => {
  try {
    await GoogleSignin.revokeAccess();
    await GoogleSignin.signOut();
    console.log('[GoogleSignIn] Signed out successfully');
    return true;
  } catch (error) {
    console.error('[GoogleSignIn] Sign out error:', error);
    return false;
  }
};

// Export status codes and helper for external use
export { statusCodes, isSuccessResponse };