import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

class AuthService {
  // Initialize Google Sign-In
  async initializeGoogleSignIn() {
    try {
      await GoogleSignin.hasPlayServices();
      return true;
    } catch (error) {
      console.error('Google Play services not available:', error);
      return false;
    }
  }

  // Sign in with Google
  async signInWithGoogle() {
    try {
      // Check for Google Play Services (Android)
      await GoogleSignin.hasPlayServices();
      
      // Get user info and idToken
      const userInfo = await GoogleSignin.signIn();
      
      if (!userInfo.idToken) {
        throw new Error('No ID token received from Google');
      }
      
      // Create Firebase credential
      const googleCredential = auth.GoogleAuthProvider.credential(userInfo.idToken);
      
      // Sign in with Firebase
      const userCredential = await auth().signInWithCredential(googleCredential);
      
      console.log('User signed in:', userCredential.user.email);
      return {
        success: true,
        user: userCredential.user,
      };
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      
      // Handle specific errors
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          return { success: false, error: 'User cancelled the sign-in flow' };
        case statusCodes.IN_PROGRESS:
          return { success: false, error: 'Sign-in is already in progress' };
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          return { success: false, error: 'Google Play services not available' };
        default:
          return { success: false, error: error.message || 'Unknown error occurred' };
      }
    }
  }

  // Check if user is already signed in with Google
  async isSignedInWithGoogle() {
    try {
      const isSignedIn = await GoogleSignin.isSignedIn();
      return isSignedIn;
    } catch (error) {
      console.error('Error checking Google sign-in status:', error);
      return false;
    }
  }

  // Get current signed in user from Google
  async getCurrentGoogleUser() {
    try {
      const currentUser = await GoogleSignin.getCurrentUser();
      return currentUser;
    } catch (error) {
      console.error('Error getting current Google user:', error);
      return null;
    }
  }

  // Sign out from both Google and Firebase
  async signOut() {
    try {
      // Sign out from Google
      await GoogleSignin.signOut();
      
      // Sign out from Firebase
      await auth().signOut();
      
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error };
    }
  }

  // Get current Firebase user
  getCurrentFirebaseUser() {
    return auth().currentUser;
  }

  // Check if user is signed in to Firebase
  isSignedInToFirebase() {
    return !!auth().currentUser;
  }

  // Save profile level to Realtime Database (only if signed in)
  async saveProfileLevel(level: string) {
    try {
      const user = auth().currentUser;
      if (!user) {
        return { success: false, error: 'Not signed in' };
      }
      await database().ref(`/users/${user.uid}/profileLevel`).set(level);
      return { success: true };
    } catch (error: any) {
      console.error('Error saving profile level:', error);
      return { success: false, error: error?.message || 'Unknown error' };
    }
  }
}

export default new AuthService();