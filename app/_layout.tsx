import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
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
 * Route guard component that handles authentication routing
 * - Redirects unauthenticated users to Login
 * - Redirects first-time users to onboarding
 * - Allows authenticated users to access main app
 */
function AuthRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isFirstTime } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return; // Wait for auth state to load

    const inAuthGroup = segments[0] === 'Login';
    const inOnboarding = segments[0] === '(tabs)' && segments[1] === 'introduction';
    const inOnboardingSteps = segments.join('/').includes('onboarding');

    if (!user) {
      // User is not signed in - redirect to Login
      if (!inAuthGroup) {
        router.replace('/Login');
      }
    } else if (user && isFirstTime) {
      // User is signed in but hasn't completed onboarding
      if (!inOnboarding && !inOnboardingSteps) {
        router.replace('/introduction');
      }
    } else if (user && !isFirstTime) {
      // User is signed in and has completed onboarding
      if (inAuthGroup || inOnboarding) {
        router.replace('/(tabs)');
      }
    }
  }, [user, loading, isFirstTime, segments]);

  // Show loading screen while checking auth state
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff9f2' }}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthRouteGuard>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="Login" options={{ presentation: 'modal', title: 'Login', headerShown: false }} />
        </Stack>
      </AuthRouteGuard>
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
