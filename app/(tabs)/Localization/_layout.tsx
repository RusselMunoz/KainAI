// app/(tabs)/localization/_layout.tsx
import { Stack } from 'expo-router';

export default function LocalizationLayout() {
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
        name="language" 
        options={{ 
          title: 'Language Settings',
          headerShown: true,
        }} 
      />
    </Stack>
  );
}
