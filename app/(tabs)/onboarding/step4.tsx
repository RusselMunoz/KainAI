import { AntDesign } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingStep4() {
  const [level, setLevel] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    const loadLevel = async () => {
      try {
        const savedLevel = await AsyncStorage.getItem('onboard_level');
        if (savedLevel) {
          setLevel(savedLevel);
        }
        console.log('[OnboardingStep4] Loaded level from AsyncStorage:', savedLevel);
      } catch (e) {
        console.log('[OnboardingStep4] Error loading level from AsyncStorage:', e);
      }
    };
    loadLevel();
  }, []);

  // Save level to AsyncStorage whenever it changes
  useEffect(() => {
    if (level) {
      AsyncStorage.setItem('onboard_level', level)
        .then(() => console.log('[OnboardingStep4] Saved level to AsyncStorage:', level))
        .catch(e => console.log('[OnboardingStep4] Error saving level to AsyncStorage:', e));
    }
  }, [level]);

  const options = [
    { key: 'beginner', label: 'Beginner (just starting out)' },
    { key: 'intermediate', label: 'Intermediate (comfortable with basics)' },
    { key: 'advanced', label: 'Advanced (confident with most techniques)' },
    { key: 'expert', label: 'Expert (cooking master!)' },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome to Cheffy</Text>
        <Text style={styles.subtitle}>Let's set up your cooking profile{'\n'}Step 4 of 5</Text>

        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '80%' }]} />
          </View>
        </View>

        <View style={styles.chatRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>👨‍🍳</Text>
          </View>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>
              Thanks for that. Last question — how would you describe your cooking skills? Pick the level that fits you best.
            </Text>
          </View>
        </View>

        <View style={styles.options}>
          {options.map(o => {
            const selected = level === o.key;
            return (
              <Pressable
                key={o.key}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => setLevel(o.key)}
              >
                <Text style={styles.optionText}>{o.label}</Text>
                {selected && <AntDesign name="check-circle" size={18} color="#fff" />}
              </Pressable>
            );
          })}
        </View> 

        <View style={styles.actions}>
          <Pressable style={styles.backBtn} onPress={() => router.push('/onboarding/step3')}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Pressable
            style={[styles.nextBtn, !level && styles.nextBtnDisabled]}
            onPress={() => {
              // Level is already saved by useEffect
              router.push('/onboarding/step5');
            }}
            disabled={!level}
          >
            <Text style={styles.nextText}>{`Next Step (5/5)`}</Text>
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
  bubble: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 8, padding: 10 },
  bubbleText: { color: '#374151', fontSize: 13 },
  options: { width: '100%', marginTop: 14 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e6e6e6',
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  optionSelected: { backgroundColor: '#10B981', borderColor: '#10B981' },
  optionText: { color: '#374151', fontSize: 14, flex: 1, marginRight: 8 },
  actions: { flexDirection: 'row', width: '100%', marginTop: 16, justifyContent: 'space-between' },
  backBtn: { flex: 1, marginRight: 8, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e6e6e6' },
  backText: { color: '#374151', fontWeight: '600' },
  nextBtn: { flex: 2, backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: '#94d3b5' },
  nextText: { color: '#fff', fontWeight: '700' },
});