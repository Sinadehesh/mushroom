import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { blocker, type BlockerStatus } from '../../blocker';
import { Button, Card, Chip, SectionTitle } from '../../components/ui';
import type { MushroomCategory } from '../../core/types';
import { useStore } from '../../state/store';
import { CATEGORY_LABEL, useColors } from '../../theme';

const CATEGORIES: MushroomCategory[] = ['gilled', 'pored', 'other'];

export default function SettingsScreen() {
  const c = useColors();
  const { state, dispatch } = useStore();
  const { settings } = state;
  const update = (patch: Partial<typeof settings>) => dispatch({ type: 'updateSettings', patch });
  const [status, setStatus] = useState<BlockerStatus>('notDetermined');

  useEffect(() => {
    blocker.getStatus().then(setStatus);
  }, []);

  const toggleCategory = (cat: MushroomCategory) => {
    const next = settings.categories.includes(cat)
      ? settings.categories.filter((x) => x !== cat)
      : [...settings.categories, cat];
    if (next.length) update({ categories: next });
  };

  const confirmReset = () => {
    const reset = () => dispatch({ type: 'resetProgress' });
    if (Platform.OS === 'web') {
      if (window.confirm('Reset all learning progress?')) reset();
      return;
    }
    Alert.alert('Reset progress?', 'Your Mycology IQ and review schedule will start over.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: reset },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SectionTitle>Blocked apps</SectionTitle>
      <Card style={{ gap: 12 }}>
        <Text style={{ color: c.text, fontSize: 15, lineHeight: 22 }}>
          {status === 'unsupported'
            ? 'App blocking needs the native iOS/Android build. In this preview, use “Preview the lock screen” on the Fungarium tab to try the flow.'
            : status === 'authorized'
              ? 'MycoLock can shield the apps you choose.'
              : 'Give MycoLock permission to shield distracting apps.'}
        </Text>
        {status !== 'unsupported' && (
          <Button
            label={status === 'authorized' ? 'Choose apps to lock' : 'Grant permission'}
            onPress={async () => {
              if (status === 'authorized') await blocker.chooseBlockedApps();
              else setStatus(await blocker.requestAuthorization());
            }}
          />
        )}
      </Card>

      <SectionTitle>Lock screen</SectionTitle>
      <Setting
        label="Mode"
        hint={settings.difficulty === 'easy' ? 'Pick from 4 names' : 'Type the name (small typos OK)'}
      >
        <Chip label="Easy" selected={settings.difficulty === 'easy'} onPress={() => update({ difficulty: 'easy' })} />
        <Chip label="Hard" selected={settings.difficulty === 'hard'} onPress={() => update({ difficulty: 'hard' })} />
      </Setting>
      <Setting label="Unlock for" hint="How long a correct answer opens the app">
        {[5, 10, 15, 30].map((m) => (
          <Chip
            key={m}
            label={`${m} min`}
            selected={settings.unlockMinutes === m}
            onPress={() => update({ unlockMinutes: m })}
          />
        ))}
      </Setting>
      <Setting label="Genius Penalty" hint="Freeze after a wrong answer">
        {[10, 20, 30].map((s) => (
          <Chip
            key={s}
            label={`${s} s`}
            selected={settings.penaltySeconds === s}
            onPress={() => update({ penaltySeconds: s })}
          />
        ))}
      </Setting>
      <Setting label="Emergency unlocks" hint="Skips the question; resets daily">
        {[0, 1, 2, 3].map((n) => (
          <Chip
            key={n}
            label={String(n)}
            selected={settings.emergencyUnlocksPerDay === n}
            onPress={() => update({ emergencyUnlocksPerDay: n })}
          />
        ))}
      </Setting>

      <SectionTitle>Deck</SectionTitle>
      <Setting label="Mushrooms to learn" hint="At least one group stays on">
        {CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            label={CATEGORY_LABEL[cat]}
            selected={settings.categories.includes(cat)}
            onPress={() => toggleCategory(cat)}
          />
        ))}
      </Setting>

      <SectionTitle>About</SectionTitle>
      <View style={{ gap: 8 }}>
        <Button variant="secondary" label="Photo credits" onPress={() => router.push('/credits')} />
        <Button variant="ghost" label="Reset learning progress" onPress={confirmReset} />
      </View>
    </ScrollView>
  );
}

function Setting({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: c.textMuted, fontSize: 14, marginBottom: 8 }}>{hint}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
