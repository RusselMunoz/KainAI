'use client'
import { AntDesign } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import AuthService from '../services/auth.service';
import { configureGoogleSignIn } from '../config/google-signin';

export default function SignIn() {
  const router = useRouter();

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  const onGooglePress = async () => {
    try {
      const result = await AuthService.signInWithGoogle();
      if (!result.success) {
        throw new Error(result.error || 'Sign-in failed');
      }
      console.log('User signed in:', result.user?.email || result.user?.uid);
      router.push('/introduction');
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.decorTopLeft} />
      <View style={styles.decorTopRight} />
      <View style={styles.card}>
        <Text style={styles.emoji}>👨‍🍳</Text>
        <Text style={styles.title}>KainAI</Text>
        <Text style={styles.subtitle}>Let's get cooking!</Text>

        <Pressable style={styles.googleButton} onPress={onGooglePress}>
          <AntDesign name="google" size={18} color="#DB4437" />
          <Text style={styles.googleText}>Continue with Google</Text>
        </Pressable>

        <Text style={styles.secured}>Secured because I said so</Text>

        <Text style={styles.links}>
          By signing up, I agree to KainAI's Terms of Service, Privacy Policy and Data Processing Terms.
        </Text>
      </View>

      <View style={styles.decorBottomLeft} />
      <View style={styles.decorBottomRight} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff9f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  decorTopLeft: {
    position: 'absolute',
    left: 28,
    top: 28,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffedd5',
    opacity: 0.7,
  },
  decorTopRight: {
    position: 'absolute',
    right: 28,
    top: 40,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff2cc',
    opacity: 0.9,
  },
  decorBottomLeft: {
    position: 'absolute',
    left: 18,
    bottom: 40,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff2cc',
    opacity: 0.9,
  },
  decorBottomRight: {
    position: 'absolute',
    right: 18,
    bottom: 40,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffd9d1',
    opacity: 0.75,
  },
  card: {
    width: 340,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 8,
  },
  emoji: { fontSize: 56, marginBottom: 6 },
  title: { fontSize: 28, color: '#10B981', fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#6b7280', marginBottom: 12 },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 0.6,
    borderColor: '#e6e6e6',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    marginTop: 8,
  },
  googleText: { marginLeft: 10, fontSize: 14, color: '#111' },
  secured: { marginTop: 12, fontSize: 12, color: '#4b5563', fontWeight: '600' },
  links: { marginTop: 10, fontSize: 11, color: '#9ca3af', textAlign: 'center' },
});