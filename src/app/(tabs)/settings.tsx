import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LockSetup } from '../../components/LockSetup';
import { MushroomsPerDay } from '../../components/MushroomsPerDay';
import { Button, Card, Chip, SectionTitle } from '../../components/ui';
import { deckCategories, FREE_APP_LIMIT, isPlusCategory } from '../../core/plus';
import type { MushroomCategory } from '../../core/types';
import { hasPlus, useDeck, useStore } from '../../state/store';
import { CATEGORY_LABEL, useColors } from '../../theme';

const CATEGORIES: MushroomCategory[] = ['gilled', 'pored', 'other'];

export default function SettingsScreen() {
  const c = useColors();
  const { state, dispatch } = useStore();
  const { settings } = state;
  const deck = useDeck();
  const plus = hasPlus(state);
  const update = (patch: Partial<typeof settings>) => dispatch({ type: 'updateSettings', patch });

  const activeCategories = deckCategories(settings.categories, plus);
  const toggleCategory = (cat: MushroomCategory) => {
    if (isPlusCategory(cat) && !plus) return router.push('/upgrade');
    const next = activeCategories.includes(cat)
      ? activeCategories.filter((x) => x !== cat)
      : [...activeCategories, cat];
    if (next.length) update({ categories: next });
  };

  const confirmReset = () => {
    const reset = () => dispatch({ type: 'resetProgress' });
    if (Platform.OS === 'web') {
      if (window.confirm('Reset all learning progress?')) reset();
      return;
    }
    Alert.alert('Reset progress?', 'Your collection, reviews, streak and Mycology IQ will start over.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: reset },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SectionTitle>App lock</SectionTitle>
      <LockSetup />

      <SectionTitle>ShroomLock Plus</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Text style={{ color: plus ? c.success : c.text, fontSize: 16, fontWeight: '600' }}>
          {plus
            ? '✓ Plus unlocked: unlimited apps and every mushroom group.'
            : `Free version: up to ${FREE_APP_LIMIT} locked apps and the gilled mushrooms.`}
        </Text>
        <Button
          variant={plus ? 'ghost' : 'primary'}
          label={plus ? 'About Plus' : 'See what Plus adds'}
          onPress={() => router.push('/upgrade')}
        />
      </Card>

      <SectionTitle>Daily lesson</SectionTitle>
      <MushroomsPerDay
        value={settings.mushroomsPerDay}
        deckSize={deck.length}
        onChange={(mushroomsPerDay) => update({ mushroomsPerDay })}
      />

      <SectionTitle>Lock screen</SectionTitle>
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
      <Setting
        label="Mushrooms to learn"
        hint={plus ? 'At least one group stays on' : 'Pores, brackets, ridges and spines come with Plus'}
      >
        {CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            label={`${isPlusCategory(cat) && !plus ? '🔒 ' : ''}${CATEGORY_LABEL[cat]}`}
            selected={activeCategories.includes(cat)}
            onPress={() => toggleCategory(cat)}
          />
        ))}
      </Setting>

      <SectionTitle>About</SectionTitle>
      <View style={{ gap: 8 }}>
        <Button variant="secondary" label="Privacy policy" onPress={() => router.push('/privacy')} />
        <Button variant="secondary" label="Photo credits" onPress={() => router.push('/credits')} />
        <Button variant="ghost" label="Run the setup again" onPress={() => update({ onboarded: false })} />
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
