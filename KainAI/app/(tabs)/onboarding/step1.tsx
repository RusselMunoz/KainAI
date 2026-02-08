import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingStep1() {
  const [name, setName] = useState('');
  const router = useRouter();

  // Load name from AsyncStorage on mount
  React.useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('onboard_name');
      if (stored) setName(stored);
    })();
  }, []);

  // Save name to AsyncStorage whenever it changes
  const handleNameChange = async (val: string) => {
    setName(val);
    await AsyncStorage.setItem('onboard_name', val);
  };

  // Debug: log name changes
  React.useEffect(() => {
    if (name) {
      AsyncStorage.getItem('onboard_name').then(val => {
        console.log('AsyncStorage onboard_name:', val);
        debugger;
      });
    }
  }, [name]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome to Cheffy</Text>
        <Text style={styles.subtitle}>Let's set up your cooking profile{'\n'}Step 1 of 5</Text>

        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '20%' }]} />
          </View>
        </View>

        <View style={styles.chatRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>👨‍🍳</Text>
          </View>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>
              Let's get to know each other first - what should I call you?
            </Text>
          </View>
        </View>

        <TextInput
          value={name}
          onChangeText={handleNameChange}
          placeholder="Enter your name..."
          style={styles.input}
          returnKeyType="done"
        />

        <Pressable
          style={[styles.nextBtn, !name && styles.nextBtnDisabled]}
          onPress={() => router.push('/onboarding/step2')}
          disabled={!name}
        >
          <Text style={styles.nextText}>{`Next Step (2/5)`}</Text>
        </Pressable>
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
  nextBtn: { marginTop: 16, backgroundColor: '#10B981', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, width: '100%', alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: '#94d3b5' },
  nextText: { color: '#fff', fontWeight: '700' },
});