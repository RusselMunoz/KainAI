import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { UserProvider } from '../contexts/UserContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

export const unstable_settings = {
 anchor: '(tabs)',
};

/**
 * Inner layout that handles auth-based routing
 * Uses Redirect component for reliable navigation
 */
function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, loading, isFirstTime } = useAuth();
  const segments = useSegments();

  console.log('[Layout] Auth state:', { user: user?.uid || null, loading, isFirstTime, segments: segments.join('/') });

  // Show loading screen while checking auth state
  if (loading) {
    console.log('[Layout] Showing loading screen');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff9f2' }}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  const inAuthGroup = segments[0] === 'Login';
  const inOnboarding = segments[0] === '(tabs)' && segments[1] === 'introduction';
  const inOnboardingSteps = segments.join('/').includes('onboarding');

  // User is NOT signed in
  if (!user) {
    console.log('[Layout] No user, inAuthGroup:', inAuthGroup);
    if (!inAuthGroup) {
      console.log('[Layout] Redirecting to Login');
      return <Redirect href="/Login" />;
    }
  }

  // User IS signed in but needs onboarding
  if (user && isFirstTime) {
    console.log('[Layout] User needs onboarding, inOnboarding:', inOnboarding);
    if (!inOnboarding && !inOnboardingSteps) {
      console.log('[Layout] Redirecting to onboarding');
      return <Redirect href="/introduction" />;
    }
  }

  // User IS signed in and completed onboarding - redirect away from auth/onboarding screens
  if (user && !isFirstTime) {
    if (inAuthGroup || inOnboarding) {
      console.log('[Layout] User authenticated, redirecting to main app');
      return <Redirect href="/(tabs)" />;
    }
  }

  console.log('[Layout] Rendering Stack');
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="Login" options={{ presentation: 'modal', title: 'Login', headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <UserProvider>
        <RootLayoutNav />
      </UserProvider>
    </AuthProvider>
  );
}
