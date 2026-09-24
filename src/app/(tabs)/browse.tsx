import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MushroomPhoto } from '../../components/MushroomPhoto';
import { Chip } from '../../components/ui';
import { normalizeName } from '../../core/matching';
import { MAX_BOX } from '../../core/srs';
import type { MushroomCategory } from '../../core/types';
import { MUSHROOMS } from '../../data/mushrooms';
import { useStore } from '../../state/store';
import { CATEGORY_LABEL, useColors } from '../../theme';

const FILTERS: (MushroomCategory | 'all')[] = ['all', 'gilled', 'pored', 'other'];

export default function Browse() {
  const c = useColors();
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MushroomCategory | 'all'>('all');

  const mushrooms = useMemo(() => {
    const q = normalizeName(query);
    return MUSHROOMS.filter((p) => filter === 'all' || p.category === filter)
      .filter((p) => !q || normalizeName(`${p.commonName} ${p.scientificName} ${p.family}`).includes(q))
      .sort((a, b) => a.commonName.localeCompare(b.commonName));
  }, [query, filter]);

  return (
    <FlatList
      data={mushrooms}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 12 }}>
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
              <Chip
                key={f}
                label={f === 'all' ? 'All' : CATEGORY_LABEL[f]}
                selected={filter === f}
                onPress={() => setFilter(f)}
              />
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={<Text style={{ color: c.textMuted }}>No mushrooms match “{query}”.</Text>}
      renderItem={({ item }) => {
        const box = state.progress[item.id]?.box;
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
              <Text style={[styles.name, { color: c.text }]}>{item.commonName}</Text>
              <Text style={{ color: c.textMuted, fontStyle: 'italic' }}>{item.scientificName}</Text>
            </View>
            <MasteryDots box={box} />
          </Pressable>
        );
      }}
    />
  );
}

/** Leitner box as filled dots; hollow when the mushroom hasn't been seen yet. */
function MasteryDots({ box }: { box?: number }) {
  const c = useColors();
  return (
    <View
      style={{ flexDirection: 'row', gap: 3 }}
      accessibilityLabel={box === undefined ? 'Not seen yet' : `Mastery ${box} of ${MAX_BOX}`}
    >
      {Array.from({ length: MAX_BOX }, (_, i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: box !== undefined && i < box ? c.primary : c.border,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  search: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
