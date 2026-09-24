import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { blocker } from '../blocker';
import { EdibilityBadge } from '../components/EdibilityBadge';
import { MushroomPhoto, PhotoCredit } from '../components/MushroomPhoto';
import { Button } from '../components/ui';
import {
  challengeReducer,
  penaltySecondsLeft,
  retryUsesSameMushroom,
  startChallenge,
  type ChallengeEvent,
  type ChallengeState,
} from '../core/challenge';
import { acceptedNames, isCorrectAnswer, normalizeName } from '../core/matching';
import { areLookalikes, buildChoices } from '../core/quiz';
import { pickNextMushroom } from '../core/srs';
import type { Mushroom } from '../core/types';
import { MUSHROOMS, MUSHROOMS_BY_ID } from '../data/mushrooms';
import { emergencyLeft, useDeck, useStore } from '../state/store';
import { EDIBILITY_LABEL, serif, useColors } from '../theme';

const randomPhoto = () => Math.floor(Math.random() * 1_000_000);

/** The mushroom a wrong guess named, if any, so the penalty can point out a classic look-alike. */
function guessedMushroom(guess: string): Mushroom | undefined {
  const name = normalizeName(guess);
  return name ? MUSHROOMS.find((m) => acceptedNames(m).includes(name)) : undefined;
}

function haptic(success: boolean) {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(
    success ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
  ).catch(() => {});
}

/**
 * The lock-screen intercept. Opened by the native blocker as
 * `mycolock://challenge?source=Instagram`, or from the Fungarium with
 * `?practice=1` for flashcard study (no unlock, no emergency exit).
 */
export default function ChallengeScreen() {
  const { source, practice } = useLocalSearchParams<{ source?: string; practice?: string }>();
  const isPractice = practice === '1';
  const { state: store, dispatch } = useStore();
  const deck = useDeck();
  const c = useColors();

  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [now, setNow] = useState(Date.now);
  const [typed, setTyped] = useState('');
  const [emergencyUsed, setEmergencyUsed] = useState(false);
  // A fresh photo for every question, so users learn the mushroom rather than one picture.
  const [photo, setPhoto] = useState(randomPhoto);

  // Pick the first mushroom only once saved progress has loaded, so SRS sees it.
  useEffect(() => {
    if (store.hydrated && !challenge && deck.length) {
      setChallenge(startChallenge(pickNextMushroom(deck, store.progress, Date.now()).id));
    }
  }, [store.hydrated, challenge, deck, store.progress]);

  // Tick the penalty countdown.
  useEffect(() => {
    if (challenge?.phase !== 'penalty') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [challenge?.phase]);

  const mushroom: Mushroom | undefined = challenge ? MUSHROOMS_BY_ID[challenge.mushroomId] : undefined;
  const difficulty = store.settings.difficulty;
  const choices = useMemo(
    () => (mushroom && difficulty === 'easy' ? buildChoices(mushroom, deck) : []),
    // Re-deal only when the mushroom changes, not on every progress update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mushroom?.id, difficulty],
  );

  if (!challenge || !mushroom) {
    return <View style={[styles.screen, { backgroundColor: c.background }]} />;
  }

  const send = (event: ChallengeEvent) => setChallenge((s) => (s ? challengeReducer(s, event) : s));

  const answer = (guess: string, correct: boolean) => {
    if (challenge.phase !== 'question') return;
    const t = Date.now();
    dispatch({ type: 'answer', mushroomId: mushroom.id, correct, now: t });
    send({ type: 'answer', correct, guess, now: t, penaltySeconds: store.settings.penaltySeconds });
    setNow(t);
    haptic(correct);
    if (correct && !isPractice) blocker.grantTemporaryAccess(source, store.settings.unlockMinutes);
  };

  const retry = () => {
    const t = Date.now();
    const next = retryUsesSameMushroom(difficulty)
      ? mushroom
      : pickNextMushroom(deck, store.progress, t, Math.random, mushroom.id);
    setTyped('');
    setPhoto(randomPhoto());
    send({ type: 'retry', now: t, nextMushroomId: next.id });
  };

  const nextCard = () => {
    setTyped('');
    setPhoto(randomPhoto());
    setChallenge(startChallenge(pickNextMushroom(deck, store.progress, Date.now(), Math.random, mushroom.id).id));
  };

  const emergencyUnlock = () => {
    dispatch({ type: 'useEmergency', now: Date.now() });
    blocker.grantTemporaryAccess(source, store.settings.unlockMinutes);
    setEmergencyUsed(true);
  };

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const secondsLeft = penaltySecondsLeft(challenge, now);
  const guessed = challenge.phase === 'penalty' ? guessedMushroom(challenge.guess) : undefined;
  const confusedWith = guessed && areLookalikes(guessed, mushroom) ? guessed : undefined;
  const emergencies = emergencyLeft(store, now);
  const appName = source ?? 'your app';

  if (emergencyUsed) {
    return (
      <Result
        title="Emergency unlock"
        body={`${appName} is open for ${store.settings.unlockMinutes} minutes. ${emergencies} emergency unlock${emergencies === 1 ? '' : 's'} left today.`}
        primary={{ label: `Continue to ${appName}`, onPress: leave }}
      />
    );
  }

  if (challenge.phase === 'unlocked') {
    return (
      <Result
        mushroom={mushroom}
        photo={photo}
        title={`Yes — ${mushroom.commonName}!`}
        body={
          isPractice
            ? mushroom.fact
            : `You earned ${store.settings.unlockMinutes} minutes of ${appName}. ${mushroom.fact}`
        }
        primary={
          isPractice ? { label: 'Next card', onPress: nextCard } : { label: `Continue to ${appName}`, onPress: leave }
        }
        secondary={isPractice ? { label: 'Done', onPress: leave } : undefined}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={[styles.kicker, { color: c.textMuted }]}>
              {isPractice ? 'Flashcard' : `${appName} is locked`}
            </Text>
            {isPractice && (
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={leave} hitSlop={12}>
                <Text style={{ color: c.textMuted, fontSize: 22 }}>✕</Text>
              </Pressable>
            )}
          </View>

          <View style={[styles.photo, { backgroundColor: c.surfaceMuted }]}>
            <MushroomPhoto mushroom={mushroom} photo={photo} showHint={challenge.phase === 'question'} />
            {challenge.phase === 'penalty' && (
              <View style={[StyleSheet.absoluteFill, styles.penaltyOverlay, { backgroundColor: c.overlay }]}>
                <Text style={styles.countdown} accessibilityLiveRegion="polite">
                  {secondsLeft}
                </Text>
                <Text style={styles.countdownLabel}>{secondsLeft ? 'Take a good look' : 'Ready'}</Text>
              </View>
            )}
          </View>
          {challenge.phase === 'penalty' && <PhotoCredit mushroom={mushroom} photo={photo} />}

          {challenge.phase === 'question' ? (
            <View style={styles.panel}>
              <Text style={[styles.prompt, { color: c.text, fontFamily: serif }]}>What is this mushroom?</Text>
              {difficulty === 'easy' ? (
                <View style={styles.choices}>
                  {choices.map((choice) => (
                    <Button
                      key={choice.id}
                      variant="secondary"
                      label={choice.commonName}
                      onPress={() => answer(choice.commonName, choice.id === mushroom.id)}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.choices}>
                  <TextInput
                    value={typed}
                    onChangeText={setTyped}
                    placeholder="Type its name"
                    placeholderTextColor={c.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => typed.trim() && answer(typed, isCorrectAnswer(typed, mushroom, MUSHROOMS))}
                    style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
                  />
                  <Button
                    label="Check"
                    disabled={!typed.trim()}
                    onPress={() => answer(typed, isCorrectAnswer(typed, mushroom, MUSHROOMS))}
                  />
                </View>
              )}

              {!isPractice && (
                <View style={styles.escapes}>
                  <Button variant="ghost" label={`I don't need ${appName} right now`} onPress={leave} />
                  {emergencies > 0 && (
                    <Pressable accessibilityRole="button" onPress={emergencyUnlock} hitSlop={8}>
                      <Text style={[styles.emergency, { color: c.textMuted }]}>
                        Emergency unlock ({emergencies} left today)
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.panel}>
              <Text style={[styles.wrong, { color: c.danger }]}>
                Not quite{challenge.guess ? ` — not ${challenge.guess}` : ''}.
              </Text>
              <Text style={[styles.answerName, { color: c.text, fontFamily: serif }]}>{mushroom.commonName}</Text>
              <Text style={[styles.sci, { color: c.textMuted, fontFamily: serif }]}>
                {mushroom.scientificName} · {mushroom.family}
              </Text>
              <EdibilityBadge edibility={mushroom.edibility} />
              <Text style={[styles.fact, { color: c.text }]}>{mushroom.fact}</Text>
              {confusedWith && (
                <Text style={[styles.lookalike, { color: c.textMuted }]}>
                  Easy mix-up: {confusedWith.commonName} ({EDIBILITY_LABEL[confusedWith.edibility].toLowerCase()}) is a
                  known look-alike. Compare them in the mushroom guide.
                </Text>
              )}
              <Button
                label={
                  secondsLeft
                    ? `Try again in ${secondsLeft}s`
                    : retryUsesSameMushroom(difficulty)
                      ? 'Now name it'
                      : 'Try another mushroom'
                }
                disabled={secondsLeft > 0}
                onPress={retry}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Result({
  mushroom,
  photo,
  title,
  body,
  primary,
  secondary,
}: {
  mushroom?: Mushroom;
  photo?: number;
  title: string;
  body: string;
  primary: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}) {
  const c = useColors();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {mushroom && (
          <View style={[styles.photo, { backgroundColor: c.surfaceMuted }]}>
            <MushroomPhoto mushroom={mushroom} photo={photo} />
          </View>
        )}
        {mushroom && <PhotoCredit mushroom={mushroom} photo={photo} />}
        <View style={styles.panel}>
          <Text style={[styles.answerName, { color: c.success, fontFamily: serif }]}>{title}</Text>
          {mushroom && (
            <Text style={[styles.sci, { color: c.textMuted, fontFamily: serif }]}>
              {mushroom.scientificName} · {mushroom.family}
            </Text>
          )}
          {mushroom && <EdibilityBadge edibility={mushroom.edibility} />}
          <Text style={[styles.fact, { color: c.text }]}>{body}</Text>
          <Button label={primary.label} onPress={primary.onPress} />
          {secondary && <Button variant="ghost" label={secondary.label} onPress={secondary.onPress} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32, maxWidth: 560, width: '100%', alignSelf: 'center', flexGrow: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  kicker: { fontSize: 14, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  photo: { width: '100%', aspectRatio: 1, maxHeight: 380, borderRadius: 24, overflow: 'hidden' },
  penaltyOverlay: { alignItems: 'center', justifyContent: 'center' },
  countdown: { color: '#fff', fontSize: 96, fontWeight: '800', fontVariant: ['tabular-nums'] },
  countdownLabel: { color: '#fff', fontSize: 16, fontWeight: '600', opacity: 0.9 },
  panel: { marginTop: 20, gap: 10 },
  prompt: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  choices: { gap: 10 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontSize: 18 },
  escapes: { marginTop: 8, alignItems: 'center', gap: 4 },
  emergency: { fontSize: 14, textDecorationLine: 'underline', paddingVertical: 6 },
  wrong: { fontSize: 16, fontWeight: '700' },
  answerName: { fontSize: 32, fontWeight: '700' },
  sci: { fontSize: 16, fontStyle: 'italic' },
  fact: { fontSize: 17, lineHeight: 25, marginVertical: 8 },
  lookalike: { fontSize: 15, lineHeight: 21, fontStyle: 'italic', marginBottom: 8 },
});
