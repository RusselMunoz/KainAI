// Mock auth service for Expo Go development
// TODO: Switch to native Firebase once using development build
import AsyncStorage from '@react-native-async-storage/async-storage';

const MOCK_USER_KEY = '@cheffy_mock_user';

interface MockUser {
  uid: string;
  email: string;
  displayName: string;
}

class AuthService {
  private currentUser: MockUser | null = null;

  constructor() {
    this.loadUser();
  }

  private async loadUser() {
    try {
      const stored = await AsyncStorage.getItem(MOCK_USER_KEY);
      if (stored) {
        this.currentUser = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  }

  // Initialize Google Sign-In (mock)
  async initializeGoogleSignIn() {
    return true;
  }

  // Sign in with Google (mock - auto signs in as demo user)
  async signInWithGoogle() {
    try {
      const mockUser: MockUser = {
        uid: 'demo-user-' + Date.now(),
        email: 'demo@cheffy.app',
        displayName: 'Demo Chef',
      };
      
      this.currentUser = mockUser;
      await AsyncStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser));
      
      console.log('Mock user signed in:', mockUser.email);
      return {
        success: true,
        user: mockUser,
      };
    } catch (error: any) {
      console.error('Mock Sign-In Error:', error);
      return { success: false, error: error.message || 'Unknown error occurred' };
    }
  }

  // Check if user is already signed in
  async isSignedInWithGoogle() {
    await this.loadUser();
    return !!this.currentUser;
  }

  // Get current signed in user
  async getCurrentGoogleUser() {
    await this.loadUser();
    return this.currentUser;
  }

  // Sign out
  async signOut() {
    try {
      this.currentUser = null;
      await AsyncStorage.removeItem(MOCK_USER_KEY);
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error };
    }
  }

  // Get current user
  getCurrentFirebaseUser() {
    return this.currentUser;
  }

  // Check if user is signed in
  isSignedInToFirebase() {
    return !!this.currentUser;
  }

  // Save profile level (mock - stores locally)
  async saveProfileLevel(level: string) {
    try {
      if (!this.currentUser) {
        return { success: false, error: 'Not signed in' };
      }
      await AsyncStorage.setItem(`@cheffy_level_${this.currentUser.uid}`, level);
      return { success: true };
    } catch (error: any) {
      console.error('Error saving profile level:', error);
      return { success: false, error: error?.message || 'Unknown error' };
    }
  }
}

export default new AuthService();
