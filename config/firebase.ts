// config/firebase.ts - Firebase initialization and configuration
// Handles both production Firebase and demo mode for development

import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
// Note: @react-native-firebase/firestore needs to be installed for production
// For now, we'll use a mock Firestore interface that falls back to the backend API

/**
 * Demo user ID constant - used to skip Firebase operations in demo mode
 */
export const DEMO_USER_ID = 'demo-user-id';

/**
 * Check if we're running in demo mode
 */
export const isDemoMode = (userId: string | null): boolean => {
  return !userId || userId === DEMO_USER_ID || userId.startsWith('demo-user-');
};

/**
 * Firebase app instance - initialized automatically by @react-native-firebase
 * Configuration comes from google-services.json (Android) / GoogleService-Info.plist (iOS)
 */
export const firebaseApp = firebase;

/**
 * Firebase Auth instance
 */
export const firebaseAuth = auth;

/**
 * Get current authenticated user
 */
export const getCurrentUser = () => firebaseAuth().currentUser;

/**
 * Get current user ID
 */
export const getCurrentUserId = (): string | null => {
  const user = getCurrentUser();
  return user?.uid || null;
};

/**
 * Firebase configuration status
 */
export const isFirebaseConfigured = (): boolean => {
  try {
    const { apps } = firebase;
    return apps && apps.length > 0;
  } catch (error) {
    return false;
  }
};

/**
 * Firestore timestamp helpers
 * Will use server timestamp when Firestore is available, or Date.now() as fallback
 */
export const serverTimestamp = () => {
  // When @react-native-firebase/firestore is installed, use:
  // return firestore.FieldValue.serverTimestamp();
  return new Date();
};

/**
 * Convert Firestore timestamp to Date
 */
export const timestampToDate = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  
  // Already a Date
  if (timestamp instanceof Date) return timestamp;
  
  // ISO string or numeric timestamp
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    const parsed = new Date(timestamp);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  
  // Firestore Timestamp object with toDate method
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  
  // Firestore timestamp object { _seconds, _nanoseconds }
  if (timestamp._seconds !== undefined) {
    return new Date(timestamp._seconds * 1000);
  }
  
  // Firestore timestamp with seconds
  if (timestamp.seconds !== undefined) {
    return new Date(timestamp.seconds * 1000);
  }
  
  return new Date();
};

/**
 * Convert Date to Firestore-compatible format
 */
export const dateToTimestamp = (date: Date): string => {
  return date.toISOString();
};

/**
 * Generate a unique ID (similar to Firestore auto-ID)
 */
export const generateId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 20; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

/**
 * Log Firebase operation for debugging
 */
export const logFirebaseOp = (operation: string, collection: string, docId?: string) => {
  console.log(`🔥 Firebase ${operation}: ${collection}${docId ? '/' + docId : ''}`);
};

export default {
  app: firebaseApp,
  auth: firebaseAuth,
  DEMO_USER_ID,
  isDemoMode,
  getCurrentUser,
  getCurrentUserId,
  isFirebaseConfigured,
  serverTimestamp,
  timestampToDate,
  dateToTimestamp,
  generateId,
  logFirebaseOp,
};
