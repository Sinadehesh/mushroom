import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { usePlusSync } from '../billing/usePlusSync';
import { blocker } from '../blocker';

import { StoreProvider } from '../state/store';
import { useColors } from '../theme';

export default function RootLayout() {
  const c = useColors();

  // Phones that kill background services can stop the lock; restart it whenever ShroomLock is opened.
  useEffect(() => {
    blocker.ensureRunning();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && blocker.ensureRunning());
    return () => sub.remove();
  }, []);
  return (
    <StoreProvider>
      <PlusSync />
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
        <Stack.Screen name="apps" options={{ title: 'Apps to lock' }} />
        <Stack.Screen name="privacy" options={{ title: 'Privacy policy' }} />
        <Stack.Screen name="upgrade" options={{ title: 'ShroomLock Plus' }} />
        <Stack.Screen name="lesson" options={{ title: 'Today’s lesson' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        {/* The lock-screen intercept: no swipe-to-dismiss, no back gesture. */}
        <Stack.Screen
          name="challenge"
          options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }}
        />
      </Stack>
    </StoreProvider>
  );
}

function PlusSync() {
  usePlusSync();
  return null;
}
