// app/(tabs)/privacy_and_data_section/_layout.tsx
import { Stack } from 'expo-router';

export default function PrivacyDataLayout() {
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
        name="data-sharing" 
        options={{ 
          title: 'Data Sharing',
          headerShown: true,
        }} 
      />
      <Stack.Screen 
        name="health-data" 
        options={{ 
          title: 'Health Data',
          headerShown: true,
        }} 
      />
    </Stack>
  );
}
