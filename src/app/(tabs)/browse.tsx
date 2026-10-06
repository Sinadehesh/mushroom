import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MushroomPhoto } from '../../components/MushroomPhoto';
import { Chip } from '../../components/ui';
import { MASTERED_STEP } from '../../core/daily';
import { collectedCount, masteredCount, milestones } from '../../core/progress';
import { normalizeName } from '../../core/text';
import type { LearnRecord, MushroomCategory } from '../../core/types';
import { MUSHROOMS } from '../../data/mushrooms';
import { useStore } from '../../state/store';
import { CATEGORY_LABEL, useColors } from '../../theme';

type Filter = MushroomCategory | 'all' | 'collected';
const FILTERS: Filter[] = ['all', 'collected', 'gilled', 'pored', 'other'];
const FILTER_LABEL: Record<Filter, string> = { all: 'All', collected: 'Collected', ...CATEGORY_LABEL };

export default function Browse() {
  const c = useColors();
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const collected = collectedCount(MUSHROOMS, state.learn);
  const mastered = masteredCount(MUSHROOMS, state.learn);
  const badges = milestones({ collected, mastered, bestStreak: state.streak.best, total: MUSHROOMS.length });

  const mushrooms = useMemo(() => {
    const q = normalizeName(query);
    return MUSHROOMS.filter(
      (m) => filter === 'all' || (filter === 'collected' ? !!state.learn[m.id] : m.category === filter),
    )
      .filter((m) => !q || normalizeName(`${m.commonName} ${m.scientificName} ${m.family}`).includes(q))
      .sort((a, b) => a.commonName.localeCompare(b.commonName));
  }, [query, filter, state.learn]);

  return (
    <FlatList
      data={mushrooms}
      keyExtractor={(m) => m.id}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 12 }}>
          <View style={[styles.summary, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.name, { color: c.text }]}>
              Collected {collected} of {MUSHROOMS.length} · mastered {mastered}
            </Text>
            <View style={styles.badges}>
              {badges.map((b) => (
                <View
                  key={b.id}
                  accessibilityLabel={`${b.label}: ${b.done ? 'done' : `${b.value} of ${b.target}`}`}
                  style={[styles.badge, { borderColor: b.done ? c.primary : c.border, opacity: b.done ? 1 : 0.45 }]}
                >
                  <Text style={{ fontSize: 22 }}>{b.emoji}</Text>
                </View>
              ))}
            </View>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search mushrooms, species or families"
            placeholderTextColor={c.textMuted}
            autoCorrect={false}
            style={[styles.search, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
          />
          <View style={styles.chips}>
            {FILTERS.map((f) => (
              <Chip key={f} label={FILTER_LABEL[f]} selected={filter === f} onPress={() => setFilter(f)} />
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={<Text style={{ color: c.textMuted }}>No mushrooms match “{query}”.</Text>}
      renderItem={({ item }) => {
        return (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/mushroom/[id]', params: { id: item.id } })}
            style={[styles.row, { borderColor: c.border, backgroundColor: c.surface }]}
          >
            <View style={styles.thumb}>
              <MushroomPhoto mushroom={item} compact />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: c.text }]}>
                {item.edibility === 'deadly' ? '☠️ ' : ''}
                {item.commonName}
              </Text>
              <Text style={{ color: c.textMuted, fontStyle: 'italic' }}>{item.scientificName}</Text>
            </View>
            <ReviewDots record={state.learn[item.id]} />
          </Pressable>
        );
      }}
    />
  );
}

/** One dot for the lesson, then one per review passed; all filled = mastered. */
function ReviewDots({ record }: { record?: LearnRecord }) {
  const c = useColors();
  const filled = record ? 1 + Math.min(record.step, MASTERED_STEP) : 0;
  const label = !record
    ? 'Not collected yet'
    : record.step >= MASTERED_STEP
      ? 'Mastered'
      : `Collected, ${record.step} of ${MASTERED_STEP} reviews passed`;
  return (
    <View style={{ flexDirection: 'row', gap: 3 }} accessibilityLabel={label}>
      {Array.from({ length: MASTERED_STEP + 1 }, (_, i) => (
        <View
          key={i}
          style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: i < filled ? c.primary : c.border }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  search: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summary: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 10 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  thumb: { width: 52, height: 52, borderRadius: 10, overflow: 'hidden' },
  name: { fontSize: 17, fontWeight: '600' },
});
