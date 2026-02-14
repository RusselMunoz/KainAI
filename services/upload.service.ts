// services/upload.service.ts
// Client-side image upload service with Cloudinary URL generation

import axios from 'axios';
import {
  requestMediaLibraryPermissionsAsync,
  requestCameraPermissionsAsync,
  launchImageLibraryAsync,
  launchCameraAsync,
} from 'expo-image-picker';
import { Platform } from 'react-native';
import { Cloudinary } from '@cloudinary/url-gen';
import { auto } from '@cloudinary/url-gen/actions/resize';
import { autoGravity } from '@cloudinary/url-gen/qualifiers/gravity';
import { format, quality } from '@cloudinary/url-gen/actions/delivery';

// Cloudinary cloud name
const CLOUD_NAME = 'dgqo8swpb';

// Initialize Cloudinary for URL generation
const cld = new Cloudinary({ cloud: { cloudName: CLOUD_NAME } });

const API_BASE = Platform.select({
  android: 'http://10.0.2.2:5173',
  default: 'http://localhost:5173',
});

interface UploadResult {
  ok: boolean;
  url?: string;
  urls?: string[];
  error?: string;
}

/**
 * Generate an optimized Cloudinary image URL
 */
export function getOptimizedImageUrl(publicId: string, width = 500, height = 500): string {
  const img = cld
    .image(publicId)
    .format('auto')
    .quality('auto')
    .resize(auto().gravity(autoGravity()).width(width).height(height));
  
  return img.toURL();
}

/**
 * Generate a thumbnail URL
 */
export function getThumbnailUrl(publicId: string, size = 150): string {
  return getOptimizedImageUrl(publicId, size, size);
}

/**
 * Request permission to access the photo library
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  const { status } = await requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * Request permission to access the camera
 */
export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await requestCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * Pick an image from the device's media library
 */
export async function pickImage(): Promise<string | null> {
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) {
    console.warn('Media library permission not granted');
    return null;
  }

  const result = await launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
    base64: true, // Enable base64 to avoid file system issues
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  // Return base64 directly if available, otherwise URI
  if (result.assets[0].base64) {
    return `data:image/jpeg;base64,${result.assets[0].base64}`;
  }
  return result.assets[0].uri;
}

/**
 * Take a photo with the device's camera
 */
export async function takePhoto(): Promise<string | null> {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) {
    console.warn('Camera permission not granted');
    return null;
  }

  const result = await launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
    base64: true, // Enable base64 to avoid file system issues
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  // Return base64 directly if available, otherwise URI
  if (result.assets[0].base64) {
    return `data:image/jpeg;base64,${result.assets[0].base64}`;
  }
  return result.assets[0].uri;
}

/**
 * Convert image URI to base64 (or pass through if already base64)
 */
async function uriToBase64(uri: string): Promise<string> {
  // If already a base64 data URI, return as-is
  if (uri.startsWith('data:')) {
    return uri;
  }

  // For web platform
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // For native platforms - use expo-file-system
  try {
    const FileSystem = require('expo-file-system');
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('Failed to convert image to base64:', error);
    // Fallback: return with placeholder if conversion fails
    throw new Error('Failed to process image. Please try again.');
  }
}

/**
 * Upload a single image to the server (which uploads to Cloudinary)
 */
export async function uploadImage(imageUri: string, folder = 'kainai/community'): Promise<UploadResult> {
  try {
    const base64 = await uriToBase64(imageUri);
    
    const response = await axios.post<UploadResult>(`${API_BASE}/api/upload`, {
      image: base64,
      folder,
    });

    return response.data;
  } catch (error: any) {
    console.error('Upload error:', error);
    return {
      ok: false,
      error: error.response?.data?.error || error.message || 'Upload failed',
    };
  }
}

/**
 * Upload multiple images
 */
export async function uploadMultipleImages(imageUris: string[], folder = 'kainai/community'): Promise<UploadResult> {
  try {
    const base64Images = await Promise.all(imageUris.map(uriToBase64));
    
    const response = await axios.post<UploadResult>(`${API_BASE}/api/upload`, {
      images: base64Images,
      folder,
    });

    return response.data;
  } catch (error: any) {
    console.error('Upload error:', error);
    return {
      ok: false,
      error: error.response?.data?.error || error.message || 'Upload failed',
    };
  }
}

export default {
  requestMediaLibraryPermission,
  requestCameraPermission,
  pickImage,
  takePhoto,
  uploadImage,
  uploadMultipleImages,
  getOptimizedImageUrl,
  getThumbnailUrl,
  cloudinary: cld,
};
