import React from 'react';
import { useRouter } from 'expo-router';

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

const topInset = Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 12 : 12;

const SECTIONS = [
  {
    title: 'PROFILE & HEALTH',
    items: [
      { key: 'edit-profile', label: 'Edit Profile' },
      { key: 'allergies', label: 'Allergies and Dietary Preferences' },
    ],
  },
  {
    title: 'PRIVACY & DATA',
    items: [
      { key: 'data-sharing', label: 'Data Sharing' },
      { key: 'health-data', label: 'Health Data' },
    ],
  },
  {
    title: 'LOCALIZATION',
    items: [{ key: 'language', label: 'Language' }],
  },
  {
    title: 'COMMUNITY',
    items: [
      { key: 'leaderboard', label: 'Leaderboard' },
      { key: 'badges', label: 'Badges' },
      { key: 'community', label: 'Community' },
    ],
  },
  {
    title: 'LEGAL & INFO SECTION',
    items: [
      { key: 'privacy-policy', label: 'Privacy Policy' },
      { key: 'terms', label: 'Terms & Conditions / Terms of Service' },
      { key: 'licenses', label: 'Licenses / Acknowledgments' },
    ],
  },
];

export default function SettingsScreen() {
  const router = useRouter();

  const onBack = () => {
    router.back();
    console.log('back pressed');
  };

  const onPressItem = (key: string) => {
    // Navigation for Legal & Info section
    if (key === 'privacy-policy') {
      router.push('/privacy-policy');
      return;
    }
    if (key === 'terms') {
      router.push('/terms');
      return;
    }
    if (key === 'licenses') {
      router.push('/licenses');
      return;
    }
    if (key === 'edit-profile') {
      router.push('/edit-profile');
      return;
    }
    // Default: just log
    console.log('pressed', key);
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
        {/* Debug button - easy access to test all screens */}
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
            🧪 Debug - Test All Screens
          </Text>
        </Pressable>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>

            <View style={styles.card}>
              {section.items.map((it, i) => (
                <Pressable
                  key={it.key}
                  style={[styles.row, i === 0 ? {} : styles.rowBorder]}
                  onPress={() => onPressItem(it.key)}>
                  <Text style={styles.rowText}>{it.label}</Text>
                  <Feather name="chevron-right" size={18} color="#777" />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

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
});