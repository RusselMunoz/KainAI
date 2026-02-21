// app/(tabs)/_layout.tsx
// import { Tabs } from 'expo-router';
// export default function Layout() {
//   return <Tabs />;
// }

// For no bottom tabs (default)
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function Layout() {
  return (
    <>
      <StatusBar style="light" backgroundColor="transparent" translucent={false} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

