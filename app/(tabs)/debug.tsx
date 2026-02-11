import React from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

// List all your app screens here for quick testing
const SCREENS = [
  { label: '🏠 Dashboard (index)', route: '/' },
  { label: '⚙️ Settings', route: '/setting' },
  { label: '🔐 Login', route: '/Login' },
  { label: '👨‍🍳 Introduction', route: '/introduction' },
  { label: '📖 Introduction Page', route: '/introduction/page' },
  { label: '1️⃣ Onboarding Step 1', route: '/onboarding/step1' },
  { label: '2️⃣ Onboarding Step 2', route: '/onboarding/step2' },
  { label: '3️⃣ Onboarding Step 3', route: '/onboarding/step3' },
  { label: '4️⃣ Onboarding Step 4', route: '/onboarding/step4' },
  { label: '5️⃣ Onboarding Step 5', route: '/onboarding/step5' },
  { label: '✅ Onboarding End', route: '/onboarding/endstep' },
  { label: '💬 Chat (modal)', route: '/chat' },
  { label: '📱 Modal', route: '/modal' },
];

export default function DebugScreen() {
  const router = useRouter();

  const testNavigation = (route: string, label: string) => {
    console.log(`🧪 Testing navigation to: ${route}`);
    try {
      router.push(route as any);
    } catch (error) {
      console.error(`❌ Failed to navigate to ${route}:`, error);
      Alert.alert('Navigation Error', `Could not navigate to ${route}`);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>🧪 Debug - Test All Screens</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.info}>
          Tap each button to test if the screen loads correctly.
          Check the console for navigation logs.
        </Text>

        {SCREENS.map((screen) => (
          <Pressable
            key={screen.route}
            style={styles.button}
            onPress={() => testNavigation(screen.route, screen.label)}
          >
            <Text style={styles.buttonText}>{screen.label}</Text>
            <Text style={styles.routeText}>{screen.route}</Text>
          </Pressable>
        ))}

        <View style={styles.divider} />
        
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <Pressable
          style={[styles.button, styles.dangerButton]}
          onPress={() => {
            console.log('🔄 Reloading app...');
            router.replace('/');
          }}
        >
          <Text style={styles.buttonText}>🔄 Reset to Home</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  container: { padding: 16, paddingBottom: 40 },
  info: {
    color: '#888',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#2d2d44',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#444',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  routeText: { color: '#888', fontSize: 12, marginTop: 4 },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  dangerButton: {
    backgroundColor: '#4a3030',
    borderColor: '#663333',
  },
});
