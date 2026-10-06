import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';

import { useStore } from '../../state/store';
import { useColors } from '../../theme';

const icon = (glyph: string) => () => <Text style={{ fontSize: 20 }}>{glyph}</Text>;

export default function TabsLayout() {
  const c = useColors();
  const { state } = useStore();
  // Wait for saved settings, then send first-time users through the setup.
  if (!state.hydrated) return null;
  if (!state.settings.onboarded) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.background },
        headerTitleStyle: { color: c.text },
        headerShadowVisible: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('🍄') }} />
      <Tabs.Screen name="browse" options={{ title: 'Collection', tabBarIcon: icon('🧺') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}
