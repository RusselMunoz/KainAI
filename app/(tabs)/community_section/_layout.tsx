// app/(tabs)/community_section/_layout.tsx
import { Stack } from 'expo-router';

export default function CommunitySectionLayout() {
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
        name="leaderboard" 
        options={{ 
          title: 'Leaderboard',
          headerShown: true,
        }} 
      />
      <Stack.Screen 
        name="community" 
        options={{ 
          title: 'Community',
          headerShown: true,
        }} 
      />

    </Stack>
  );
}
