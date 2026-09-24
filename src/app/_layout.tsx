import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { StoreProvider } from '../state/store';
import { useColors } from '../theme';

export default function RootLayout() {
  const c = useColors();
  return (
    <StoreProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.background },
          headerTintColor: c.primary,
          headerTitleStyle: { color: c.text },
          contentStyle: { backgroundColor: c.background },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="mushroom/[id]" options={{ title: '', headerBackTitle: 'Back' }} />
        <Stack.Screen name="credits" options={{ title: 'Photo credits' }} />
        {/* The lock-screen intercept: no swipe-to-dismiss, no back gesture. */}
        <Stack.Screen
          name="challenge"
          options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }}
        />
      </Stack>
    </StoreProvider>
  );
}
