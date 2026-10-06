import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { blocker } from '../../blocker';
import { useLockState } from '../../components/LockSetup';
import { MushroomPhoto } from '../../components/MushroomPhoto';
import { Button, Card, SectionTitle } from '../../components/ui';
import { addDays, dayKey, dueReviews, lessonStudied, reviewsDueOn, todaysNewMushrooms } from '../../core/daily';
import { collectedCount, currentStreak, masteredCount, milestones, nextMilestone } from '../../core/progress';
import { accuracy, mycologyIQ, troubleMushrooms } from '../../core/stats';
import { MUSHROOMS } from '../../data/mushrooms';
import { hasPlus, useDeck, useStore } from '../../state/store';
import { serif, useColors } from '../../theme';

export default function Home() {
  const c = useColors();
  const { state } = useStore();
  const deck = useDeck();
  const [lock] = useLockState();

  const now = Date.now();
  const today = dayKey(now);
  const perDay = state.settings.mushroomsPerDay;
  const fresh = todaysNewMushrooms(deck, state.learn, today, perDay);
  const repeats = dueReviews(deck, state.learn, today);
  const studied = lessonStudied(deck, state.learn, today);
  const examDone = state.examDoneOn === today;
  const tomorrow = addDays(today, 1);
  const tomorrowRepeats = reviewsDueOn(deck, state.learn, tomorrow);
  const tomorrowNew = todaysNewMushrooms(deck, state.learn, tomorrow, perDay).length;

  const acc = accuracy(state.stats);
  const trouble = troubleMushrooms(deck, state.stats);
  const nothingLeft = !fresh.length && !repeats.length;
  // Free users who've met every gilled mushroom: Plus has more mushrooms to learn.
  const offerPlus = !hasPlus(state) && deck.every((m) => state.learn[m.id]);
  const streak = currentStreak(state.streak, today);
  const collected = collectedCount(deck, state.learn);
  const mastered = masteredCount(deck, state.learn);
  const goal = nextMilestone(
    milestones({ collected, mastered, bestStreak: state.streak.best, total: MUSHROOMS.length }),
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {blocker.available && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/settings')}
          style={[styles.lockBanner, { backgroundColor: lock.enabled ? c.surface : c.primary, borderColor: c.border }]}
        >
          <Text style={{ color: lock.enabled ? c.text : c.onPrimary, fontSize: 16, fontWeight: '700' }}>
            {lock.enabled
              ? `🔒 Guarding ${lock.blockedCount} app${lock.blockedCount === 1 ? '' : 's'}`
              : '🔓 Your apps aren’t locked yet — set up the lock'}
          </Text>
        </Pressable>
      )}

      <Card style={{ gap: 12 }}>
        <Text style={[styles.cardLabel, { color: c.textMuted }]}>Today</Text>
        {examDone || nothingLeft ? (
          <>
            <Text style={[styles.headline, { color: c.text, fontFamily: serif }]}>
              {nothingLeft && !examDone ? 'Nothing due today' : '✓ Done for today'}
            </Text>
            <Text style={[styles.body, { color: c.textMuted }]}>
              {tomorrowNew + tomorrowRepeats === 0
                ? 'You’ve learned every mushroom in your deck. Your locked apps keep quizzing you on them.'
                : `Tomorrow: ${plural(tomorrowNew, 'new mushroom')}${tomorrowRepeats ? ` and ${plural(tomorrowRepeats, 'review')}` : ''}.`}
            </Text>
            {examDone && !nothingLeft && (
              <Button
                variant="secondary"
                label="Go over today’s lesson again"
                onPress={() => router.push({ pathname: '/lesson', params: { review: '1' } })}
              />
            )}
            {offerPlus && (
              <>
                <Text style={[styles.body, { color: c.text }]}>
                  You’ve met all {deck.length} gilled mushrooms. ShroomLock Plus adds {MUSHROOMS.length - deck.length}{' '}
                  boletes, brackets, chanterelles, morels, puffballs and more.
                </Text>
                <Button label="See ShroomLock Plus" onPress={() => router.push('/upgrade')} />
              </>
            )}
          </>
        ) : (
          <>
            <Text style={[styles.headline, { color: c.text, fontFamily: serif }]}>
              {studied ? 'Take today’s exam' : fresh.length ? plural(fresh.length, 'new mushroom') : 'Review day'}
            </Text>
            {fresh.length > 0 && (
              <View style={styles.thumbs}>
                {fresh.map((m) => (
                  <View key={m.id} style={[styles.thumb, { backgroundColor: c.surfaceMuted }]}>
                    <MushroomPhoto mushroom={m} compact />
                  </View>
                ))}
              </View>
            )}
            <Text style={[styles.body, { color: c.textMuted }]}>
              {fresh.length && !studied ? 'See each mushroom once, then a short multiple-choice exam. ' : ''}
              {repeats.length ? `Plus ${plural(repeats.length, 'review')} of mushrooms from earlier.` : ''}
            </Text>
            <Button
              label={studied || !fresh.length ? 'Start the exam' : 'Start today’s lesson'}
              onPress={() => router.push('/lesson')}
            />
          </>
        )}
      </Card>

      <Card style={styles.streakCard}>
        <Text style={styles.streakEmoji}>{streak ? '🔥' : '🍄'}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.rowTitle, { color: c.text }]}>
            {streak ? `${plural(streak, 'day')} in a row` : 'Start a streak today'}
          </Text>
          <Text style={{ color: c.textMuted }}>
            {streak && !examDone
              ? 'Finish today’s exam to keep it going.'
              : state.streak.best > 1
                ? `Best: ${plural(state.streak.best, 'day')}`
                : 'Do the exam each day to build one.'}
          </Text>
          {goal && (
            <Text
              style={{ color: c.textMuted }}
              accessibilityLabel={`Next goal: ${goal.label}, ${goal.value} of ${goal.target}`}
            >
              Next goal: {goal.emoji} {goal.label} ({goal.value}/{goal.target})
            </Text>
          )}
        </View>
      </Card>

      <Card style={styles.iqCard}>
        <Text style={[styles.cardLabel, { color: c.textMuted }]}>Mycology IQ</Text>
        <Text style={[styles.iq, { color: c.primary, fontFamily: serif }]}>{mycologyIQ(deck, state.learn)}</Text>
        <View style={styles.statsRow}>
          <Stat label="Collected" value={`${collected}/${deck.length}`} />
          <Stat label="Mastered" value={String(mastered)} />
          <Stat label="Accuracy" value={acc === null ? '—' : `${Math.round(acc * 100)}%`} />
        </View>
      </Card>

      <View style={styles.actions}>
        <Button
          variant="secondary"
          label="Practice a question"
          onPress={() => router.push({ pathname: '/challenge', params: { practice: '1' } })}
        />
        <Button
          variant="ghost"
          label="Preview the lock screen"
          onPress={() => router.push({ pathname: '/challenge', params: { source: 'Instagram' } })}
        />
      </View>

      {trouble.length > 0 && (
        <>
          <SectionTitle>Keeps tripping you up</SectionTitle>
          {trouble.map((m) => {
            const s = state.stats[m.id];
            return (
              <Pressable
                key={m.id}
                accessibilityRole="link"
                onPress={() => router.push({ pathname: '/mushroom/[id]', params: { id: m.id } })}
                style={[styles.row, { borderColor: c.border, backgroundColor: c.surface }]}
              >
                <View style={styles.rowThumb}>
                  <MushroomPhoto mushroom={m} compact />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: c.text }]}>{m.commonName}</Text>
                  <Text style={{ color: c.textMuted }}>
                    Missed {s.wrong} of {s.seen}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function Stat({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>{value}</Text>
      <Text style={{ color: c.textMuted, fontSize: 13, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center', gap: 12 },
  lockBanner: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  cardLabel: { fontSize: 14, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  headline: { fontSize: 26, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden' },
  streakCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  streakEmoji: { fontSize: 40 },
  iqCard: { alignItems: 'center', paddingVertical: 20 },
  iq: { fontSize: 64, fontWeight: '700', lineHeight: 76 },
  statsRow: { flexDirection: 'row', marginTop: 8, alignSelf: 'stretch' },
  actions: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  rowThumb: { width: 52, height: 52, borderRadius: 10, overflow: 'hidden' },
  rowTitle: { fontSize: 17, fontWeight: '600' },
});
