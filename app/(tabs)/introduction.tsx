'use client'
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Introduction() {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async () => {
    debugger;
    if (!name.trim()) {
      Alert.alert('Please enter your name.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5173/api/add-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.ok) {
        Alert.alert('Welcome, ' + name + '!');
        setName('');
        // Optionally, navigate to next step
        // router.push('/onboarding/step1');
      } else {
        Alert.alert('Error', data.error || 'Failed to add user.');
      }
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <View style={styles.chefCircle}>
            <Text style={styles.chefEmoji}>👨‍🍳</Text>
          </View>
        </View>

        <Text style={styles.small}>I'm your</Text>
        <Text style={styles.title}>Assistant Chef,{"\n"}Cheffy! ✨</Text>
        <Text style={styles.subtitle}>🧑‍🍳 Your AI cooking companion</Text>

        {/* <View style={styles.bubble}>
          <Text style={styles.bubbleText}>
            Let's get to know each other! Press start and tell me your name!
          </Text>
        </View> */}

        <View style={styles.features}>
          <Text style={styles.feature}>🍳 Smart Recipes</Text>
          <Text style={styles.feature}>🔍 Ingredient Scan</Text>
          <Text style={styles.feature}>👥 Community</Text>
        </View>

        <Pressable
          style={styles.startBtn}
          onPress={() => router.push('/onboarding/step1')}
        >
          <Text style={styles.startText}>Let's Start! 🚀</Text>
        </Pressable>

        <Text style={styles.tip}>💡 Tip: I can help you cook with whatever's in your fridge!</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff9f2', alignItems: 'center', justifyContent: 'center' },
  card: { width: 340, backgroundColor: '#fff', borderRadius: 12, padding: 24, alignItems: 'center', elevation: 6 },
  avatar: { marginTop: -48, marginBottom: 8 },
  chefCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#ffd9a8', alignItems: 'center', justifyContent: 'center' },
  chefEmoji: { fontSize: 40 },
  small: { color: '#888', marginTop: 8 },
  title: { color: '#10B981', fontSize: 22, fontWeight: '700', textAlign: 'center', marginVertical: 6 },
  subtitle: { color: '#6b7280' },
  bubble: { backgroundColor: '#fff4e6', padding: 10, borderRadius: 10, marginVertical: 12 },
  bubbleText: { color: '#7a5b2c' },
  input: {
    backgroundColor: '#fff',
    borderColor: '#ffd9a8',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    marginBottom: 4,
    fontSize: 16,
    color: '#7a5b2c',
    width: 200,
    alignSelf: 'center',
  },
  features: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 12, marginVertical: 12 },
  feature: { fontSize: 12, color: '#6b7280' },
  startBtn: { backgroundColor: '#10B981', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, width: '80%', alignItems: 'center', marginTop: 8 },
  startText: { color: '#fff', fontWeight: '700' },
  tip: { marginTop: 12, color: '#c6c6c6', fontSize: 12 },
});
