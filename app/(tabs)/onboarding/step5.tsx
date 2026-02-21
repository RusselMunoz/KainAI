import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingStep5() {
  const router = useRouter();
  const [profile, setProfile] = useState({
    name: 'User',
    prefs: 'None',
    allergies: 'None',
    level: 'Beginner',
  });

  useEffect(() => {
    (async () => {
      const name = (await AsyncStorage.getItem('onboard_name')) || profile.name;
      const prefs = (await AsyncStorage.getItem('onboard_prefs')) || profile.prefs;
      const allergies = (await AsyncStorage.getItem('onboard_allergies')) || profile.allergies;
      const level = (await AsyncStorage.getItem('onboard_level')) || profile.level;
      setProfile({ name, prefs, allergies, level });
    })();
  }, []);

  // navigate to endstep which will handle final save + redirect
  const goToEndStep = () => {
    router.push('/onboarding/endstep');
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome to Cheffy</Text>
        <Text style={styles.subtitle}>Let's set up your cooking profile{'\n'}Step 5 of 5</Text>

        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '100%' }]} />
          </View>
        </View>

        <View style={styles.chatRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>👨‍🍳</Text>
          </View>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>
              Perfect! Here's what I have for you:
            </Text>
            <Text style={{ marginTop: 8 }}>
              • Name: {profile.name}{'\n'}
              • Dietary preferences: {profile.prefs}{'\n'}
              • Allergies: {profile.allergies}{'\n'}
              • Skill level: {profile.level}
            </Text>
            <Text style={{ marginTop: 8 }}>Does this look right? Tap "Start Cooking" to finish.</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.backBtn} onPress={() => router.push('/onboarding/step4')}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Pressable style={styles.nextBtn} onPress={goToEndStep}>
            <Text style={styles.nextText}>Start Cooking</Text>
          </Pressable>
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
  actions: { flexDirection: 'row', width: '100%', marginTop: 16, justifyContent: 'space-between' },
  backBtn: { flex: 1, marginRight: 8, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e6e6e6' },
  backText: { color: '#374151', fontWeight: '600' },
  nextBtn: { flex: 2, backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  nextText: { color: '#fff', fontWeight: '700' },
});
