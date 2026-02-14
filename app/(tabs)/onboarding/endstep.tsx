import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Must match UserContext storage key
const PROFILE_KEY = '@cheffy_user_profile';

export default function EndStep() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ name: string; prefs: string; allergies: string; level: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // read onboarding values, build final profile and save
      const name = (await AsyncStorage.getItem('onboard_name')) || 'User';
      const prefs = (await AsyncStorage.getItem('onboard_prefs')) || 'None';
      const allergies = (await AsyncStorage.getItem('onboard_allergies')) || 'None';
      const level = (await AsyncStorage.getItem('onboard_level')) || 'Beginner';

      const final = { name, prefs, allergies, level };
      if (!cancelled) setProfile(final);

      try {
        // Parse comma-separated strings into arrays for UserContext format
        const prefsArray = prefs === 'None' ? [] : prefs.split(',').map(s => s.trim()).filter(Boolean);
        const allergiesArray = allergies === 'None' ? [] : allergies.split(',').map(s => s.trim()).filter(Boolean);

        // Save in UserContext format (UserProfile interface)
        const userProfile = {
          displayName: name,
          bio: '',
          photoURL: null,
          dietaryPreferences: prefsArray,
          allergies: allergiesArray,
          cookingLevel: level,
        };

        await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(userProfile));
        // Also keep legacy format for backwards compatibility
        await AsyncStorage.setItem('profile', JSON.stringify(final));
        await AsyncStorage.multiRemove(['onboard_name','onboard_prefs','onboard_allergies','onboard_level']);
      } catch (e) {
        // ignore save errors here
      }

      // brief idle so user sees finalizing screen, then go home
      const delay = 1200;
      const t = setTimeout(() => {
        if (!cancelled) router.replace('/');
      }, delay);

      // cleanup timer on unmount
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    })();
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome to Cheffy</Text>
        <Text style={styles.subtitle}>Finalizing your profile...</Text>

        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '100%' }]} />
          </View>
        </View>

        <View style={styles.chatRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>✨</Text>
          </View>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>
              Cheffy will remember your preferences and suggest recipes tailored to you.
            </Text>
            {profile ? (
              <Text style={{ marginTop: 8 }}>
                • Name: {profile.name}{'\n'}
                • Preferences: {profile.prefs}{'\n'}
                • Allergies: {profile.allergies}{'\n'}
                • Skill: {profile.level}
              </Text>
            ) : null}
            <Text style={{ marginTop: 8 }}>Getting everything ready — you'll be taken to Cheffy shortly.</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff9f2', alignItems: 'center', justifyContent: 'center' },
  card: { width: 520, maxWidth: '94%', backgroundColor: '#fff', borderRadius: 12, padding: 28, alignItems: 'center', elevation: 8 },
  title: { color: '#10B981', fontSize: 18, fontWeight: '700', marginTop: 2 },
  subtitle: { color: '#6b7280', fontSize: 12, marginTop: 6, textAlign: 'center' },
  progressWrap: { width: '100%', marginTop: 14, alignItems: 'center' },
  progressTrack: { width: '90%', height: 8, backgroundColor: '#eef2f4', borderRadius: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#10B981' },
  chatRow: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', marginTop: 18, paddingHorizontal: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffd9a8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarEmoji: { fontSize: 20 },
  bubble: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 8, padding: 12 },
  bubbleText: { color: '#374151', fontSize: 13 },
});