import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { blocker } from '../blocker';
import { EdibilityBadge } from '../components/EdibilityBadge';
import { CluesList, Lookalikes, SafetyNote } from '../components/MushroomFacts';
import { MushroomPhoto } from '../components/MushroomPhoto';
import { Button } from '../components/ui';
import { dayKey, dueReviews, lessonStudied, REVIEW_DAYS, todaysNewMushrooms } from '../core/daily';
import { collectedCount, currentStreak, masteredCount, milestones, nextMilestone } from '../core/progress';
import { areLookalikes, buildChoices, lookalikesOf, shuffle } from '../core/quiz';
import type { Mushroom } from '../core/types';
import { MUSHROOM_CLUES } from '../data/mushroomClues';
import { MUSHROOM_IMAGES } from '../data/mushroomImages.generated';
import { MUSHROOMS, MUSHROOMS_BY_ID } from '../data/mushrooms';
import { useDeck, useStore } from '../state/store';
import { serif, useColors } from '../theme';

type Phase = 'learn' | 'exam' | 'done';

interface Question {
  mushroom: Mushroom;
  choices: Mushroom[];
  photo: number;
  repeat: boolean;
}

/**
 * Today's lesson: each new mushroom shown once on a study card, then an exam with one
 * multiple-choice question per new mushroom plus each mushroom due for review. Once the cards
 * have been studied today it opens on the exam, unless `?review=1` asks for the cards again.
 * Opened from a lock (`?source=Instagram&unlock=<package>`) when nothing was learned yet:
 * a right answer in the exam opens that app at the end.
 */
export default function Lesson() {
  // The lesson is fixed when the screen opens, so wait for saved progress (e.g. when Android
  // reopens this screen directly after closing the app in the background).
  const { state } = useStore();
  return state.hydrated ? <LessonScreen /> : null;
}

function LessonScreen() {
  const c = useColors();
  // The card's buttons sit at the bottom: keep them above the navigation bar (Android draws edge to edge).
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useStore();
  const deck = useDeck();

  // Freeze the lesson when the screen opens, so answering doesn't reshuffle it.
  const { review, source, unlock } = useLocalSearchParams<{ review?: string; source?: string; unlock?: string }>();
  const [{ fresh, repeats, studied }] = useState(() => {
    const today = dayKey(Date.now());
    return {
      fresh: todaysNewMushrooms(deck, state.learn, today, state.settings.mushroomsPerDay),
      repeats: dueReviews(deck, state.learn, today),
      studied: lessonStudied(deck, state.learn, today),
    };
  });
  const [phase, setPhase] = useState<Phase>(fresh.length && (!studied || review === '1') ? 'learn' : 'exam');
  const [card, setCard] = useState(0);
  const [photo, setPhoto] = useState(0);

  const questions = useMemo<Question[]>(
    () =>
      [
        ...shuffle(fresh).map((mushroom) => ({ mushroom, repeat: false })),
        ...shuffle(repeats).map((mushroom) => ({ mushroom, repeat: true })),
      ].map((q) => ({
        ...q,
        choices: buildChoices(q.mushroom, deck, MUSHROOMS),
        photo: Math.floor(Math.random() * 1000),
      })),
    [fresh, repeats, deck],
  );
  const [qIndex, setQIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!fresh.length && !repeats.length) {
    return (
      <Centered>
        <Text style={[styles.title, { color: c.text, fontFamily: serif }]}>Nothing to learn today</Text>
        <Text style={[styles.body, { color: c.textMuted }]}>
          You’ve met every mushroom in your deck and none are due for review. Add more mushroom groups in Settings, or
          practise from the home screen.
        </Text>
        <Button label="Back" onPress={close} />
      </Centered>
    );
  }

  if (phase === 'learn') {
    const mushroom = fresh[card];
    const photos = MUSHROOM_IMAGES[mushroom.id]?.length ?? 0;
    const lastCard = card === fresh.length - 1;
    const startExam = () => {
      if (!studied) dispatch({ type: 'studied', mushroomIds: fresh.map((m) => m.id), now: Date.now() });
      setPhase('exam');
    };
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.kicker, { color: c.textMuted }]}>
            New mushroom {card + 1} of {fresh.length}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityHint={photos > 1 ? 'Shows another photo' : undefined}
            onPress={() => setPhoto((p) => p + 1)}
            style={[styles.photo, { backgroundColor: c.surfaceMuted }]}
          >
            <MushroomPhoto mushroom={mushroom} photo={photo} />
            {photos > 1 && (
              <Text style={[styles.photoCount, { backgroundColor: c.overlay }]}>
                {(photo % photos) + 1}/{photos} · tap for more
              </Text>
            )}
          </Pressable>
          <Text style={[styles.name, { color: c.text, fontFamily: serif }]}>{mushroom.commonName}</Text>
          <Text style={[styles.sci, { color: c.textMuted, fontFamily: serif }]}>
            {mushroom.scientificName} · {mushroom.family}
          </Text>
          <View style={{ marginVertical: 8 }}>
            <EdibilityBadge edibility={mushroom.edibility} />
          </View>
          <Text style={[styles.body, { color: c.text }]}>{mushroom.fact}</Text>
          <Text style={[styles.section, { color: c.textMuted }]}>How to recognise it</Text>
          <CluesList mushroom={mushroom} />
          {lookalikesOf(mushroom, MUSHROOMS).length > 0 && (
            <>
              <Text style={[styles.section, { color: c.textMuted }]}>Don’t confuse it with</Text>
              <Lookalikes mushroom={mushroom} linked={false} />
            </>
          )}
          <SafetyNote />
        </ScrollView>
        <View
          style={[
            styles.footer,
            { borderColor: c.border, backgroundColor: c.background, paddingBottom: 16 + insets.bottom },
          ]}
        >
          {card > 0 && (
            <Button
              variant="ghost"
              label="Previous"
              style={{ flex: 1 }}
              onPress={() => {
                setPhoto(0);
                setCard(card - 1);
              }}
            />
          )}
          <Button
            label={lastCard ? 'Start the exam' : 'Next mushroom'}
            style={{ flex: 2 }}
            onPress={() => {
              setPhoto(0);
              if (lastCard) startExam();
              else setCard(card + 1);
            }}
          />
        </View>
      </View>
    );
  }

  if (phase === 'done') {
    const missed = questions.length - score;
    const today = dayKey(Date.now());
    const streak = currentStreak(state.streak, today);
    const collected = collectedCount(deck, state.learn);
    const goal = nextMilestone(
      milestones({ collected, mastered: masteredCount(deck, state.learn), bestStreak: state.streak.best, total: MUSHROOMS.length }),
    );
    return (
      <Centered>
        <Text style={styles.hero}>{missed === 0 ? '🍄' : '🌱'}</Text>
        <Text style={[styles.title, { color: c.text, fontFamily: serif }]}>
          {missed === 0 ? 'Perfect score!' : 'Lesson done'}
        </Text>
        <Text style={[styles.score, { color: c.textMuted }]}>
          {score} of {questions.length} right
        </Text>
        <View style={styles.wins}>
          <Win value={`🔥 ${streak}`} label={streak === 1 ? 'day streak' : 'days in a row'} />
          <Win value={`${collected}/${deck.length}`} label="mushrooms collected" />
        </View>
        {fresh.length > 0 && (
          <View style={[styles.newCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.newTitle, { color: c.textMuted }]}>New in your collection</Text>
            <View style={styles.newRow}>
              {fresh.map((p) => (
                <View key={p.id} style={styles.newItem}>
                  <View style={[styles.newThumb, { backgroundColor: c.surfaceMuted }]}>
                    <MushroomPhoto mushroom={p} compact />
                  </View>
                  <Text numberOfLines={2} style={[styles.newName, { color: c.text }]}>
                    {p.commonName}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {goal && (
          <Text style={[styles.goal, { color: c.text }]}>
            Next goal: {goal.emoji} {goal.label} ({goal.value}/{goal.target})
          </Text>
        )}
        <Text style={[styles.body, { color: c.textMuted, textAlign: 'center' }]}>
          {fresh.length > 0 && `Today’s mushrooms come back for review in ${REVIEW_DAYS[0]} day. `}
          {missed > 0
            ? 'Mushrooms you missed start their reviews again tomorrow.'
            : 'Each right review pushes the next one further out.'}
        </Text>
        {source && score > 0 ? (
          <>
            <Button
              label={`Open ${source}`}
              onPress={() => {
                blocker.grantTemporaryAccess(unlock, state.settings.unlockMinutes);
                router.replace('/');
                if (unlock) blocker.returnToApp(unlock);
              }}
            />
            <Button variant="ghost" label="Done for today" onPress={close} />
          </>
        ) : source ? (
          <>
            <Button
              label={`Answer one to open ${source}`}
              onPress={() =>
                router.replace({ pathname: '/challenge', params: { source, ...(unlock ? { package: unlock } : {}) } })
              }
            />
            <Button variant="ghost" label="Done for today" onPress={close} />
          </>
        ) : (
          <Button label="Done for today" onPress={close} />
        )}
      </Centered>
    );
  }

  const q = questions[qIndex];
  const answered = picked !== null;
  const right = picked === q.mushroom.id;
  const pick = (id: string) => {
    if (answered) return;
    const correct = id === q.mushroom.id;
    setPicked(id);
    if (correct) setScore(score + 1);
    dispatch({ type: 'answer', mushroomId: q.mushroom.id, correct, now: Date.now() });
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
    }
  };
  const nextQuestion = () => {
    if (qIndex === questions.length - 1) {
      dispatch({ type: 'examDone', now: Date.now() });
      setPhase('done');
      return;
    }
    setPicked(null);
    setQIndex(qIndex + 1);
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={[styles.kicker, { color: c.textMuted }]}>
        Exam · question {qIndex + 1} of {questions.length}
        {q.repeat ? ' · review' : ''}
      </Text>
      <View style={[styles.photo, { backgroundColor: c.surfaceMuted }]}>
        <MushroomPhoto mushroom={q.mushroom} photo={q.photo} showHint={!answered} />
      </View>
      <Text style={[styles.prompt, { color: c.text, fontFamily: serif }]}>What is this mushroom?</Text>
      <View style={styles.actions}>
        {q.choices.map((choice, i) => {
          const isAnswer = choice.id === q.mushroom.id;
          const color = !answered ? undefined : isAnswer ? c.success : choice.id === picked ? c.danger : undefined;
          return (
            <Pressable
              key={choice.id}
              testID={`choice-${i}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: answered }}
              onPress={() => pick(choice.id)}
              style={[
                styles.choice,
                { borderColor: color ?? c.border, backgroundColor: c.surface, borderWidth: color ? 2 : 1 },
              ]}
            >
              <Text style={{ color: color ?? c.text, fontSize: 17, fontWeight: '600' }}>
                {choice.commonName}
                {answered && isAnswer ? '  ✓' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {answered && (
        <View style={{ marginTop: 16, gap: 10 }}>
          <Text style={[styles.feedback, { color: right ? c.success : c.danger }]}>
            {right ? 'Right!' : `It’s ${q.mushroom.commonName}.`}
          </Text>
          <EdibilityBadge edibility={q.mushroom.edibility} />
          {!right && picked && <LookalikeNote answer={q.mushroom} pickedId={picked} />}
          <Text style={[styles.body, { color: c.text }]}>{q.mushroom.fact}</Text>
          <Button label={qIndex === questions.length - 1 ? 'See my score' : 'Next question'} onPress={nextQuestion} />
        </View>
      )}
    </ScrollView>
  );
}

/** After a wrong pick that was a real look-alike: how to tell the two apart. */
function LookalikeNote({ answer, pickedId }: { answer: Mushroom; pickedId: string }) {
  const c = useColors();
  const picked = MUSHROOMS_BY_ID[pickedId];
  if (!picked || !areLookalikes(answer, picked)) return null;
  return (
    <View style={[styles.note, { borderColor: picked.edibility === 'deadly' ? c.danger : c.warning }]}>
      <Text style={[styles.body, { color: c.text, fontWeight: '700' }]}>
        {picked.edibility === 'deadly' ? '☠️ ' : ''}
        {picked.commonName} is a real look-alike{picked.edibility === 'deadly' ? ', and deadly' : ''}.
      </Text>
      <Text style={[styles.body, { color: c.text }]}>How to tell: {MUSHROOM_CLUES[answer.id]?.key}</Text>
    </View>
  );
}

function Win({ value, label }: { value: string; label: string }) {
  const c = useColors();
  return (
    <View style={[styles.win, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.winValue, { color: c.text }]}>{value}</Text>
      <Text style={[styles.winLabel, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <ScrollView contentContainerStyle={[styles.scroll, styles.centered]}>{children}</ScrollView>;
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center', flexGrow: 1 },
  centered: { justifyContent: 'center', alignItems: 'stretch', gap: 14 },
  kicker: { fontSize: 13, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  photo: { width: '100%', aspectRatio: 1, maxHeight: 380, borderRadius: 24, overflow: 'hidden' },
  photoCount: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  name: { fontSize: 32, fontWeight: '700', marginTop: 16 },
  sci: { fontSize: 16, fontStyle: 'italic', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  hero: { fontSize: 64, textAlign: 'center' },
  score: { fontSize: 17, textAlign: 'center', marginTop: -6 },
  wins: { flexDirection: 'row', gap: 12 },
  win: { flex: 1, alignItems: 'center', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 14 },
  winValue: { fontSize: 26, fontWeight: '800' },
  winLabel: { fontSize: 13, marginTop: 2 },
  newCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  newTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  newRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  newItem: { width: 72, alignItems: 'center', gap: 6 },
  newThumb: { width: 64, height: 64, borderRadius: 16, overflow: 'hidden' },
  newName: { fontSize: 12, textAlign: 'center', lineHeight: 15 },
  goal: { fontSize: 15, textAlign: 'center', fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 25 },
  prompt: { fontSize: 24, fontWeight: '700', marginVertical: 14 },
  actions: { gap: 10, marginTop: 8 },
  choice: { minHeight: 52, borderRadius: 14, paddingHorizontal: 16, justifyContent: 'center' },
  feedback: { fontSize: 18, fontWeight: '700' },
  section: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
  },
  note: { borderWidth: 1.5, borderRadius: 14, padding: 12, gap: 6 },
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
