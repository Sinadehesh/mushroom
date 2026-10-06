import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { blocker } from '../blocker';
import { AppPicker } from '../components/AppPicker';
import { LockSetup } from '../components/LockSetup';
import { MushroomsPerDay } from '../components/MushroomsPerDay';
import { Button } from '../components/ui';
import { useDeck, useStore } from '../state/store';
import { serif, useColors } from '../theme';

type StepId = 'welcome' | 'perDay' | 'apps' | 'lock';

// Choosing apps and the lock itself only exist on Android.
const STEPS: StepId[] = blocker.available ? ['welcome', 'perDay', 'apps', 'lock'] : ['welcome', 'perDay'];

/** First launch: how it works, mushrooms per day, apps to lock, then the lock's permissions. */
export default function Onboarding() {
  const c = useColors();
  const { state, dispatch } = useStore();
  const deck = useDeck();
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const finish = () => {
    dispatch({ type: 'updateSettings', patch: { onboarded: true } });
    router.replace('/');
  };
  const next = () => (last ? finish() : setIndex(index + 1));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.dot, { backgroundColor: i <= index ? c.primary : c.border }]} />
        ))}
      </View>

      <View style={{ flex: 1 }}>
        {step === 'welcome' && (
          <Page>
            <Text style={styles.hero}>🍄</Text>
            <Title>Learn a mushroom instead of scrolling</Title>
            <Bullet n="1">Choose the apps that eat your time.</Bullet>
            <Bullet n="2">
              Each day, learn a few mushrooms in a short lesson: how to recognise them and what they’re mistaken for.
              Then take a quick exam.
            </Bullet>
            <Bullet n="3">
              Opening a locked app asks you to name one of your mushrooms from four choices, next to its real
              look-alikes. Get it right and the app opens.
            </Bullet>
            <Bullet n="4">Mushrooms come back for review after 1, 3, 7, 14 and 30 days, so they stick.</Bullet>
            <Safety />
          </Page>
        )}

        {step === 'perDay' && (
          <Page>
            <Title>How many mushrooms a day?</Title>
            <Body>Each new mushroom is shown to you once, then you’re examined on it. You can change this later.</Body>
            <View style={{ marginTop: 24 }}>
              <MushroomsPerDay
                value={state.settings.mushroomsPerDay}
                deckSize={deck.length}
                onChange={(mushroomsPerDay) => dispatch({ type: 'updateSettings', patch: { mushroomsPerDay } })}
              />
            </View>
          </Page>
        )}

        {step === 'apps' && (
          <AppPicker
            header={
              <View style={{ gap: 6, marginBottom: 4 }}>
                <Title>Which apps should ShroomLock lock?</Title>
                <Body>Instagram, TikTok, YouTube… whatever pulls you in. You can change these any time.</Body>
              </View>
            }
          />
        )}

        {step === 'lock' && (
          <Page>
            <Title>Turn on the lock</Title>
            <Body>Android needs two permissions before ShroomLock can step in front of a locked app.</Body>
            <View style={{ marginTop: 16 }}>
              <LockSetup />
            </View>
          </Page>
        )}
      </View>

      <View style={[styles.footer, { borderColor: c.border }]}>
        {index > 0 && <Button variant="ghost" label="Back" onPress={() => setIndex(index - 1)} style={{ flex: 1 }} />}
        <Button
          label={index === 0 ? 'Get started' : last ? 'Finish setup' : 'Next'}
          onPress={next}
          style={{ flex: 2 }}
        />
      </View>
    </SafeAreaView>
  );
}

/** Recognition, not foraging: said before anything else, and again on every mushroom. */
function Safety() {
  const c = useColors();
  return (
    <View style={[styles.safety, { borderColor: c.danger }]}>
      <Text style={[styles.body, { color: c.text }]}>
        <Text style={{ fontWeight: '700', color: c.danger }}>☠️ Never eat a wild mushroom because of this app. </Text>
        ShroomLock teaches recognition, not foraging. Photos can’t show smell, spore print or what grows underground,
        and some deadly mushrooms look like edible ones. Have every find checked in person by an expert.
      </Text>
    </View>
  );
}

function Page({ children }: { children: ReactNode }) {
  return <ScrollView contentContainerStyle={styles.page}>{children}</ScrollView>;
}

function Title({ children }: { children: string }) {
  const c = useColors();
  return <Text style={[styles.title, { color: c.text, fontFamily: serif }]}>{children}</Text>;
}

function Body({ children }: { children: string }) {
  const c = useColors();
  return <Text style={[styles.body, { color: c.textMuted }]}>{children}</Text>;
}

function Bullet({ n, children }: { n: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.bullet}>
      <Text style={[styles.bulletN, { color: c.onPrimary, backgroundColor: c.primary }]}>{n}</Text>
      <Text style={[styles.body, { color: c.text, flex: 1 }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  progress: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 12, paddingBottom: 4 },
  dot: { width: 28, height: 4, borderRadius: 2 },
  page: { padding: 20, paddingBottom: 32, maxWidth: 560, width: '100%', alignSelf: 'center', gap: 12 },
  hero: { fontSize: 64, textAlign: 'center', marginTop: 12 },
  title: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  body: { fontSize: 16, lineHeight: 23 },
  bullet: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 4 },
  safety: { borderWidth: 1.5, borderRadius: 14, padding: 14, marginTop: 12 },
  bulletN: {
    width: 26,
    height: 26,
    borderRadius: 13,
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '700',
    overflow: 'hidden',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
});
