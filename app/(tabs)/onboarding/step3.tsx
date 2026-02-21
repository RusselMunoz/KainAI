import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingStep3() {
  const [allergies, setAllergies] = useState('');
  const router = useRouter();

  // Load name from AsyncStorage on mount
  React.useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('onboard_allergies');
      if (stored) setAllergies(stored);
    })();
  }, []);

  // Save prefs to AsyncStorage whenever it changes
  const handleAllergiesChange = async (val: string) => {
    setAllergies(val);
    await AsyncStorage.setItem('onboard_allergies', val);
  };

  // Debug: log prefs changes
  React.useEffect(() => {
    if (allergies) {
      AsyncStorage.getItem('onboard_allergies').then(val => {
        console.log('AsyncStorage onboard_allergies:', val);
        debugger;
      });
    }
  }, [allergies]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome to Cheffy</Text>
        <Text style={styles.subtitle}>Let's set up your cooking profile{'\n'}Step 3 of 5</Text>

        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '60%' }]} />
          </View>
        </View>

        <View style={styles.chatRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>👨‍🍳</Text>
          </View>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>
              Got it! Now, do you have any food allergies I should know about? Please list them, or say "none" if you don't have any.
            </Text>
          </View>
        </View>

        <TextInput
          value={allergies}
          onChangeText={handleAllergiesChange}
          placeholder="Enter any food allergies..."
          style={styles.input}
          returnKeyType="done"
        />

        <View style={styles.actions}>
          <Pressable style={styles.backBtn} onPress={() => router.push('/onboarding/step2')}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Pressable
            style={[styles.nextBtn, !allergies && styles.nextBtnDisabled]}
            onPress={async () => {
              await AsyncStorage.setItem('onboard_allergies', allergies);
              router.push('/onboarding/step4');
            }}
            disabled={!allergies}
          >
            <Text style={styles.nextText}>{`Next Step (4/5)`}</Text>
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
  input: { width: '100%', marginTop: 12, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e6e6e6', backgroundColor: '#fff' },
  actions: { flexDirection: 'row', width: '100%', marginTop: 16, justifyContent: 'space-between' },
  backBtn: { flex: 1, marginRight: 8, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e6e6e6' },
  backText: { color: '#374151', fontWeight: '600' },
  nextBtn: { flex: 2, backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: '#94d3b5' },
  nextText: { color: '#fff', fontWeight: '700' },
});
