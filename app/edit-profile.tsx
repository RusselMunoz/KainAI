// app/edit-profile.tsx - Edit Profile page
import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar as RNStatusBar,
  Alert,
  ActivityIndicator,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import AntDesign from '@expo/vector-icons/AntDesign';
import axios from 'axios';
import uploadService from '../services/upload.service';
import Avatar from '../components/Avatar';
import { useUser, UserProfile } from '../contexts/UserContext';
import type { UserLevel } from '../types';

const topInset = Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 12 : 12;

// Groq API for AI validation
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const COOKING_LEVELS: UserLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Halal', 'Kosher'];
const ALLERGY_OPTIONS = ['Nuts', 'Shellfish', 'Eggs', 'Soy', 'Wheat', 'Fish', 'Sesame'];

export default function EditProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ scrollTo?: string }>();
  const { profile: globalProfile, setProfile: setGlobalProfile, loading: contextLoading } = useUser();
  
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [validatingCustomText, setValidatingCustomText] = useState(false);
  
  // ScrollView ref for scrolling to sections
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Track if we've initialized from global profile
  const hasInitialized = useRef(false);
  
  // Section Y positions for scroll-to functionality
  const [sectionPositions, setSectionPositions] = useState<{ dietary: number; allergies: number }>({
    dietary: 0,
    allergies: 0,
  });
  
  const defaultProfile: UserProfile = {
    displayName: '',
    bio: '',
    photoURL: null,
    dietaryPreferences: [],
    allergies: [],
    cookingLevel: 'Beginner',
    customDietaryText: '',
    customAllergyText: '',
  };

  // Local state for editing - initialize from global profile with defaults
  const [profile, setProfile] = useState<UserProfile>(() => ({
    ...defaultProfile,
    ...globalProfile,
    allergies: globalProfile?.allergies ?? [],
  }));

  // Sync local state when global profile loads
  // Uses individual field dependencies to ensure sync when data actually changes
  useEffect(() => {
    if (!contextLoading && !hasInitialized.current) {
      console.log('[EditProfile] Initializing from global profile:', {
        displayName: globalProfile.displayName,
        bio: globalProfile.bio,
        dietaryPreferences: globalProfile.dietaryPreferences,
        allergies: globalProfile.allergies,
        cookingLevel: globalProfile.cookingLevel,
      });
      setProfile({
        ...globalProfile,
        displayName: globalProfile.displayName ?? '',
        customDietaryText: globalProfile.customDietaryText || '',
        customAllergyText: globalProfile.customAllergyText || '',
      });
      hasInitialized.current = true;
    }
  }, [contextLoading, globalProfile.displayName, globalProfile.bio, globalProfile.photoURL, 
      globalProfile.dietaryPreferences, globalProfile.allergies, globalProfile.cookingLevel,
      globalProfile.customDietaryText, globalProfile.customAllergyText]);
  
  // Reset initialization flag if global profile significantly changes (e.g., user logout/login)
  useEffect(() => {
    return () => {
      hasInitialized.current = false;
    };
  }, []);
  
  // Handle scroll-to when coming from Settings with a section param
  useEffect(() => {
    if (params.scrollTo && scrollViewRef.current) {
      const targetY = params.scrollTo === 'allergies' 
        ? sectionPositions.allergies 
        : sectionPositions.dietary;
      
      // Small delay to ensure layout is calculated
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
      }, 300);
    }
  }, [params.scrollTo, sectionPositions]);

  const loading = contextLoading;
  
  // AI Validation for custom dietary/allergy text
  const validateFoodRestriction = async (text: string, type: 'dietary' | 'allergy'): Promise<boolean> => {
    if (!text.trim()) return true; // Empty is valid
    
    setValidatingCustomText(true);
    try {
      // Using local server proxy to avoid CORS issues
      const API_BASE = Platform.select({
        android: 'http://10.0.2.2:5173',
        ios: 'http://localhost:5173',
        default: 'http://localhost:5173',
      });
      
      const response = await axios.post(`${API_BASE}/api/validate-food`, {
        text,
        type,
      }, { timeout: 10000 });
      
      if (response.data?.isValid === false) {
        Alert.alert(
          'Invalid Entry',
          response.data.message || `Please enter a valid ${type === 'dietary' ? 'dietary preference' : 'food allergy'}.`,
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.log('Validation API not available, accepting input:', error);
      // If server unavailable, accept the input (better UX than blocking)
      return true;
    } finally {
      setValidatingCustomText(false);
    }
  };

  const saveProfile = async () => {
    const trimmedName = profile.displayName?.trim() ?? '';
    if (!trimmedName) {
      Alert.alert('Error', 'Display name is required');
      return;
    }

    setSaving(true);
    try {
      const normalizedProfile: UserProfile = {
        ...profile,
        displayName: trimmedName,
      };
      setProfile(normalizedProfile);
      // Update global profile - this propagates to ALL screens
      console.log('Saving profile:', normalizedProfile);
      await setGlobalProfile(normalizedProfile);
      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePickPhoto = async () => {
    Alert.alert(
      'Change Photo',
      'Choose how you want to change your photo',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const uri = await uploadService.takePhoto();
            if (uri) uploadPhoto(uri);
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const uri = await uploadService.pickImage();
            if (uri) uploadPhoto(uri);
          },
        },
        {
          text: 'Remove Photo',
          style: 'destructive',
          onPress: () => setProfile(prev => ({ ...prev, photoURL: null })),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const uploadPhoto = async (uri: string) => {
    setUploadingPhoto(true);
    try {
      const result = await uploadService.uploadImage(uri, 'kainai/profiles');
      if (result.ok && result.url) {
        setProfile(prev => ({ ...prev, photoURL: result.url! }));
      } else {
        Alert.alert('Error', 'Failed to upload photo');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const toggleDietaryPreference = (pref: string) => {
    setProfile(prev => ({
      ...prev,
      dietaryPreferences: prev.dietaryPreferences.includes(pref)
        ? prev.dietaryPreferences.filter(p => p !== pref)
        : [...prev.dietaryPreferences, pref],
    }));
  };

  const toggleAllergy = (allergy: string) => {
    setProfile(prev => ({
      ...prev,
      allergies: prev.allergies.includes(allergy)
        ? prev.allergies.filter(a => a !== allergy)
        : [...prev.allergies, allergy],
    }));
  };

  if (loading) {
    return (
      <View style={[styles.safe, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#ff8a3d" />
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity 
          onPress={saveProfile} 
          style={styles.saveBtn}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.content} 
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <TouchableOpacity onPress={handlePickPhoto} style={styles.photoWrapper}>
            {uploadingPhoto ? (
              <View style={styles.photoPlaceholder}>
                <ActivityIndicator size="large" color="#ff8a3d" />
              </View>
            ) : (
              <Avatar 
                name={profile.displayName ?? ''} 
                photoURL={profile.photoURL} 
                size={100} 
              />
            )}
            <View style={styles.cameraIcon}>
              <Feather name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.photoHint}>Tap to change photo</Text>
        </View>

        {/* Display Name */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={profile.displayName ?? ''}
            onChangeText={text => setProfile(prev => ({ ...prev, displayName: text }))}
            placeholder="Enter your name"
            placeholderTextColor="#999"
          />
        </View>

        {/* Bio */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Bio (optional)</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={profile.bio}
            onChangeText={text => setProfile(prev => ({ ...prev, bio: text }))}
            placeholder="Tell us about yourself..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Cooking Level */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Cooking Level</Text>
          <View style={styles.chipContainer}>
            {COOKING_LEVELS.map(level => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.chip,
                  profile.cookingLevel === level && styles.chipSelected,
                ]}
                onPress={() => setProfile(prev => ({ ...prev, cookingLevel: level }))}
              >
                <Text style={[
                  styles.chipText,
                  profile.cookingLevel === level && styles.chipTextSelected,
                ]}>
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Dietary Preferences */}
        <View 
          style={styles.inputSection}
          onLayout={(e: LayoutChangeEvent) => {
            const y = e.nativeEvent?.layout?.y;
            if (y != null) {
              setSectionPositions(prev => ({ ...prev, dietary: y }));
            }
          }}
        >
          <Text style={styles.label}>Dietary Preferences</Text>
          <View style={styles.chipContainer}>
            {DIETARY_OPTIONS.map(pref => (
              <TouchableOpacity
                key={pref}
                style={[
                  styles.chip,
                  profile.dietaryPreferences.includes(pref) && styles.chipSelected,
                ]}
                onPress={() => toggleDietaryPreference(pref)}
              >
                <Text style={[
                  styles.chipText,
                  profile.dietaryPreferences.includes(pref) && styles.chipTextSelected,
                ]}>
                  {pref}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Custom Dietary Text Input */}
          <View style={styles.customInputContainer}>
            <Text style={styles.customInputLabel}>📝 Specific dietary needs:</Text>
            <TextInput
              style={[styles.input, styles.customInput]}
              value={profile.customDietaryText}
              onChangeText={text => setProfile(prev => ({ ...prev, customDietaryText: text }))}
              onBlur={() => validateFoodRestriction(profile.customDietaryText, 'dietary')}
              placeholder="e.g., No red meat, prefer organic, pescatarian"
              placeholderTextColor="#999"
              multiline
              numberOfLines={2}
            />
            {validatingCustomText && (
              <View style={styles.validatingIndicator}>
                <ActivityIndicator size="small" color="#ff8a3d" />
                <Text style={styles.validatingText}>Validating...</Text>
              </View>
            )}
          </View>
        </View>

        {/* Allergies */}
        <View 
          style={styles.inputSection}
          onLayout={(e: LayoutChangeEvent) => {
            const y = e.nativeEvent?.layout?.y;
            if (y != null) {
              setSectionPositions(prev => ({ ...prev, allergies: y }));
            }
          }}
        >
          <Text style={styles.label}>Allergies</Text>
          <View style={styles.chipContainer}>
            {ALLERGY_OPTIONS.map(allergy => (
              <TouchableOpacity
                key={allergy}
                style={[
                  styles.chip,
                  styles.allergyChip,
                  profile.allergies.includes(allergy) && styles.allergyChipSelected,
                ]}
                onPress={() => toggleAllergy(allergy)}
              >
                <Text style={[
                  styles.chipText,
                  profile.allergies.includes(allergy) && styles.allergyTextSelected,
                ]}>
                  {allergy}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Custom Allergy Text Input */}
          <View style={styles.customInputContainer}>
            <Text style={styles.customInputLabel}>📝 Specific allergies:</Text>
            <TextInput
              style={[styles.input, styles.customInput]}
              value={profile.customAllergyText}
              onChangeText={text => setProfile(prev => ({ ...prev, customAllergyText: text }))}
              onBlur={() => validateFoodRestriction(profile.customAllergyText, 'allergy')}
              placeholder="e.g., Mild lactose intolerance, can handle aged cheese"
              placeholderTextColor="#999"
              multiline
              numberOfLines={2}
            />
            {validatingCustomText && (
              <View style={styles.validatingIndicator}>
                <ActivityIndicator size="small" color="#ff8a3d" />
                <Text style={styles.validatingText}>Validating...</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff7f0',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: topInset,
    height: 72 + topInset,
    backgroundColor: '#ff8a3d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    elevation: 2,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#ff8a3d',
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ddd',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ff8a3d',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  photoHint: {
    marginTop: 8,
    color: '#999',
    fontSize: 12,
  },
  inputSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#eee',
  },
  bioInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  chipSelected: {
    backgroundColor: '#ff8a3d',
    borderColor: '#ff8a3d',
  },
  chipText: {
    fontSize: 14,
    color: '#666',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  allergyChip: {
    borderColor: '#ffcccc',
    backgroundColor: '#fff5f5',
  },
  allergyChipSelected: {
    backgroundColor: '#ff4444',
    borderColor: '#ff4444',
  },
  allergyTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  // Custom input styles for dietary/allergy text
  customInputContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  customInputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  customInput: {
    height: 60,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  validatingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  validatingText: {
    fontSize: 12,
    color: '#ff8a3d',
    fontStyle: 'italic',
  },
});
