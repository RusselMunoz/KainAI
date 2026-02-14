// app/(tabs)/legal_and_info_section/_layout.tsx
import { Stack } from 'expo-router';

export default function LegalInfoLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#18b66f',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen 
        name="privacy-policy" 
        options={{ 
          title: 'Privacy Policy',
          headerShown: true,
        }} 
      />
      <Stack.Screen 
        name="terms" 
        options={{ 
          title: 'Terms & Conditions',
          headerShown: true,
        }} 
      />
      <Stack.Screen 
        name="licenses" 
        options={{ 
          title: 'Licenses',
          headerShown: true,
        }} 
      />
    </Stack>
  );
}
