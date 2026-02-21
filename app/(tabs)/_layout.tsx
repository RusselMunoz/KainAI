// app/(tabs)/_layout.tsx
// import { Tabs } from 'expo-router';
// export default function Layout() {
//   return <Tabs />;
// }

// For no bottom tabs (default)
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Layout() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff7f0' }} edges={['top']}>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaView>
  );
}

