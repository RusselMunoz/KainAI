// config/firebase.ts - Firebase initialization and configuration
// Uses Firebase JS SDK for Expo Go compatibility

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

// Firebase configuration from google-services.json
const firebaseConfig = {
  apiKey: 'AIzaSyAdND0GiDdiUqTr4tLrH4XN8Q2cTIYfSms',
  authDomain: 'cheffy-d7701.firebaseapp.com',
  projectId: 'cheffy-d7701',
  storageBucket: 'cheffy-d7701.firebasestorage.app',
  messagingSenderId: '953646495667',
  appId: '1:953646495667:android:db1c4415d664cd50d67dc6',
};

/**
 * Demo user ID constant - used to skip Firebase operations in demo mode
 * MUST be a fake ID that doesn't match any real Firebase Auth UIDs
 */
export const DEMO_USER_ID = 'DEMO_USER_LOCAL_ONLY';

/**
 * Check if we're running in demo mode
 */
export const isDemoMode = (userId: string | null): boolean => {
  // Only treat as demo mode if explicitly a demo user prefix
  // Real Firebase UIDs should never match these patterns
  return !userId || userId === DEMO_USER_ID || userId.startsWith('demo-user-') || userId.startsWith('DEMO_');
};

/**
 * Initialize Firebase app (singleton pattern)
 */
let _app: FirebaseApp | undefined;
let _auth: Auth | undefined;

const getFirebaseApp = (): FirebaseApp => {
  if (!_app) {
    if (getApps().length === 0) {
      _app = initializeApp(firebaseConfig);
      console.log('[Firebase] App initialized');
    } else {
      _app = getApps()[0];
    }
  }
  return _app;
};

/**
 * Firebase app instance
 */
export const firebaseApp = getFirebaseApp();

/**
 * Firebase Auth instance
 */
export const firebaseAuth = (): Auth => {
  if (!_auth) {
    _auth = getAuth(firebaseApp);
  }
  return _auth;
};

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
    return getApps().length > 0;
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
