'use client'
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { 
  Pressable, 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, ENABLE_EMAIL_PASSWORD_LOGIN } from '../contexts/AuthContext';

export default function SignIn() {
  const router = useRouter();
  const { signIn, signUp, signInWithGoogle, loading, emailPasswordEnabled, googleSignInAvailable } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);

  const handleGooglePress = async () => {
    if (!signInWithGoogle) {
      Alert.alert('Not Available', 'Google Sign-In requires building the app natively. Please use email/password instead.');
      return;
    }
    try {
      setLocalLoading(true);
      const result = await signInWithGoogle();
      if (!result.success) {
        Alert.alert('Sign In Failed', result.error || 'Please try again.');
      }
      // Navigation is handled by AuthRouteGuard in _layout.tsx
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter both email and password.');
      return;
    }

    if (isSignUp && !displayName.trim()) {
      Alert.alert('Missing Name', 'Please enter your name.');
      return;
    }

    try {
      setLocalLoading(true);
      let result;
      
      if (isSignUp) {
        result = await signUp(email.trim(), password, displayName.trim());
      } else {
        result = await signIn(email.trim(), password);
      }

      if (!result.success) {
        Alert.alert(isSignUp ? 'Sign Up Failed' : 'Sign In Failed', result.error || 'Please try again.');
      }
      // Navigation is handled by AuthRouteGuard in _layout.tsx
    } catch (error: any) {
      console.error('Email auth error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLocalLoading(false);
    }
  };

  const isLoading = loading || localLoading;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.decorTopLeft} />
          <View style={styles.decorTopRight} />
          
          <View style={styles.card}>
            <Text style={styles.emoji}>👨‍🍳</Text>
            <Text style={styles.title}>KainAI</Text>
            <Text style={styles.subtitle}>
              {isSignUp ? 'Create your account' : "Let's get cooking!"}
            </Text>

            {/* Email/Password Form - only show if enabled */}
            {emailPasswordEnabled && ENABLE_EMAIL_PASSWORD_LOGIN && (
              <>
                {isSignUp && (
                  <View style={styles.inputContainer}>
                    <Feather name="user" size={18} color="#9ca3af" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Your name"
                      placeholderTextColor="#9ca3af"
                      value={displayName}
                      onChangeText={setDisplayName}
                      autoCapitalize="words"
                      editable={!isLoading}
                    />
                  </View>
                )}

                <View style={styles.inputContainer}>
                  <Feather name="mail" size={18} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#9ca3af"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!isLoading}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Feather name="lock" size={18} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#9ca3af"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#9ca3af" />
                  </Pressable>
                </View>

                <Pressable 
                  style={[styles.emailButton, isLoading && styles.buttonDisabled]} 
                  onPress={handleEmailAuth}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.emailButtonText}>
                      {isSignUp ? 'Create Account' : 'Sign In'}
                    </Text>
                  )}
                </Pressable>

                <Pressable onPress={() => setIsSignUp(!isSignUp)} disabled={isLoading}>
                  <Text style={styles.toggleText}>
                    {isSignUp 
                      ? 'Already have an account? Sign In' 
                      : "Don't have an account? Sign Up"}
                  </Text>
                </Pressable>

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>
              </>
            )}

            {/* Google Sign-In Button - only show if available */}
            {googleSignInAvailable && (
              <Pressable 
                style={[styles.googleButton, isLoading && styles.buttonDisabled]} 
                onPress={handleGooglePress}
                disabled={isLoading}
              >
                {isLoading && !emailPasswordEnabled ? (
                  <ActivityIndicator color="#DB4437" size="small" />
                ) : (
                  <>
                    <AntDesign name="google" size={18} color="#DB4437" />
                    <Text style={styles.googleText}>Continue with Google</Text>
                  </>
                )}
              </Pressable>
            )}

            {/* Message when Google Sign-In is not available (Expo Go) */}
            {!googleSignInAvailable && (
              <Text style={styles.googleNotAvailable}>
                Google Sign-In available after building the app natively
              </Text>
            )}

            <Text style={styles.secured}>Secured with Firebase</Text>

            <Text style={styles.links}>
              By signing up, I agree to KainAI's Terms of Service, Privacy Policy and Data Processing Terms.
            </Text>
          </View>

          <View style={styles.decorBottomLeft} />
          <View style={styles.decorBottomRight} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff9f2',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
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
  subtitle: { color: '#6b7280', marginBottom: 16 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    width: '100%',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111',
  },
  eyeIcon: {
    padding: 4,
  },
  emailButton: {
    width: '100%',
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  emailButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  toggleText: {
    color: '#10B981',
    fontSize: 13,
    marginTop: 4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    color: '#9ca3af',
    fontSize: 12,
    marginHorizontal: 12,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    width: '100%',
  },
  googleText: { marginLeft: 10, fontSize: 14, color: '#111', fontWeight: '500' },
  googleNotAvailable: { 
    marginTop: 8, 
    fontSize: 12, 
    color: '#9ca3af', 
    textAlign: 'center',
    fontStyle: 'italic',
  },
  secured: { marginTop: 16, fontSize: 12, color: '#4b5563', fontWeight: '600' },
  links: { marginTop: 10, fontSize: 11, color: '#9ca3af', textAlign: 'center' },
});