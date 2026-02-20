import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  StatusBar as RNStatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../../contexts/UserContext';
import { useAuth } from '../../contexts/AuthContext';
import Avatar from '../../components/Avatar';
import authService from '../../services/auth.service';

const topInset = Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 12 : 12;
const AUTH_STORAGE_KEYS = ['@kainai_auth_state', '@cheffy_mock_user'];
const SHOW_DEBUG = false;

const SECTIONS = [
  {
    title: 'PROFILE & HEALTH',
    items: [
      { key: 'edit-profile',
        label: 'Edit Profile',
        sublabel: 'Update your personal information and preferences',
        icon: 'user'},
      { key: 'allergies', 
        label: 'Allergies and Dietary Preferences',
        sublabel: 'Manage your allergies and dietary restrictions',
        icon: 'alert-triangle'},
    ],
  },
  {
    title: 'PRIVACY & DATA',
    items: [
      { key: 'data-sharing', 
        label: 'Data Sharing',
        sublabel: 'Control how your data is shared and used',
        icon: 'shield'
       },
      { key: 'health-data',
        label: 'Health Data',
        sublabel: 'Manage your health data and permissions',
        icon: 'heart'
       },
    ],
  },
  {
    title: 'LOCALIZATION',
    items: [{ key: 'language',
              label: 'Language',
              sublabel: 'Select your preferred language',
              icon: 'globe' }],
  },
  {
    title: 'COMMUNITY',
    items: [
      { key: 'leaderboard', 
        label: 'Leaderboard',
        sublabel: 'View your ranking in the community',
        icon: 'award' },
      { key: 'community', 
        label: 'Community', 
        sublabel: 'Connect with other users',
        icon: 'users' },
      { key: 'reward',
        label: 'Rewards',
        sublabel: 'View your rewards and redeem them',
        icon: 'gift' },
    ],
  },
  {
    title: 'LEGAL & INFO SECTION',
    items: [
      { key: 'privacy-policy', 
        label: 'Privacy Policy',
        sublabel: 'View our privacy policy and data usage guidelines',
        icon: 'lock' },
      { key: 'terms', 
        label: 'Terms & Conditions / Terms of Service',
        sublabel: 'View our terms and conditions',
        icon: 'file-text' },
      { key: 'licenses', 
        label: 'Licenses / Acknowledgments', 
        sublabel: 'View our licenses and acknowledgements',
        icon: 'book-open' },
    ],
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { profile } = useUser();
  const { signOut: authSignOut } = useAuth();

  const onBack = () => {
    router.back();
  };

  const handleSignOut = useCallback(async () => {
    try {
      const serviceResult = await authService.signOut();
      const authResult = await authSignOut();

      if (!serviceResult.success || !authResult.success) {
        Alert.alert('Sign Out Failed', String(serviceResult.error || authResult.error || 'Please try again.'));
        return;
      }

      try {
        await AsyncStorage.multiRemove(AUTH_STORAGE_KEYS);
      } catch (error) {
        console.error('[Settings] Failed to clear auth AsyncStorage keys:', error);
        // We still proceed after sign-out, but surface that local storage may be stale
        Alert.alert(
          'Sign Out',
          'You have been signed out, but some local sign-in data may not have been fully cleared.'
        );
      }

      router.replace('/Login');
    } catch (error: any) {
      console.error('[Settings] Sign-out error:', error);
      Alert.alert('Sign Out Failed', error?.message || 'Unable to sign out right now.');
    }
  }, [authSignOut, router]);

  const onPressItem = (key: string) => {
    // Navigation for Profile & Health section
    if (key === 'data-sharing') {
      router.push('/privacy_and_data_section/data-sharing');
      return;
    }
    if (key === 'health-data') {
      router.push('/privacy_and_data_section/health-data');
      return;
    }
    // Navigation for Legal & Info section
    if (key === 'privacy-policy') {
      router.push('/legal_and_info_section/privacy-policy');
      return;
    }
    if (key === 'terms') {
      router.push('/legal_and_info_section/terms');
      return;
    }
    if (key === 'licenses') {
      router.push('/legal_and_info_section/licenses');
      return;
    }
    if (key === 'edit-profile') {
      router.push('/edit-profile');
      return;
    }
    // Navigate to edit-profile with scroll-to param for allergies/dietary
    if (key === 'allergies') {
      router.push({
        pathname: '/edit-profile',
        params: { scrollTo: 'allergies' }
      });
      return;
    }
    // Navigate to language settings placeholder
    if (key === 'language') {
      router.push({ pathname: '/localization/language' });
      return;
    }
    // Navigate to Community section
    if (key === 'leaderboard') {
      router.push('/community_section/leaderboard');
      return;
    }
    if (key === 'community') {
      router.push('/community_section/community');
      return;
    }
    if (key === 'reward') {
      router.push('/community_section/rewards');
      return;
    }
  };

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <Avatar 
            name={profile.displayName || 'User'} 
            photoURL={profile.photoURL} 
            size={60} 
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile.displayName || 'User'}</Text>
            <Text style={styles.profileLevel}>{profile.cookingLevel}</Text>
          </View>
        </View>

        {SHOW_DEBUG && (
          <Pressable
            style={{
              backgroundColor: '#e74c3c',
              padding: 16,
              borderRadius: 12,
              marginBottom: 20,
              alignItems: 'center',
            }}
            onPress={() => router.push('/debug')}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
              Debug - Test All Screens
            </Text>
          </Pressable>
        )}

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>

            <View style={styles.card}>
              {section.items.map((it, i) => (
                <Pressable
                  key={it.key}
                  style={[styles.row, i === 0 ? {} : styles.rowBorder]}
                  onPress={() => onPressItem(it.key)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    {it.icon && <Feather name={it.icon as any} size={18} color="#555" style={{ marginRight: 10 }} />}
                    <View>
                      <Text style={styles.rowText}>{it.label}</Text>
                      {it.sublabel && <Text style={{ fontSize: 12, color: '#999' }}>{it.sublabel}</Text>}
                    </View>
                  </View>
                  <Feather name="chevron-right" size={18} color="#777" />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Pressable style={styles.logoutButton} onPress={() => handleSignOut()}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

/* --- Styles --- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff7f0' },
  header: {
    paddingTop: topInset,
    height: 72 + topInset,
    backgroundColor: '#18b66f',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    elevation: 2,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
  },
  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  profileLevel: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  container: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 30,
  },
  section: { marginBottom: 18 },
  sectionTitle: {
    color: '#2aa96a',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 6,
    // subtle shadow (Android/iOS)
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#f0e7e0',
  },
  rowText: {
    color: '#111',
    fontSize: 15,
  },
  logoutButton: {
    marginTop: 10,
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#b91c1c',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
