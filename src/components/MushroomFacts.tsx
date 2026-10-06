import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { lookalikesOf } from '../core/quiz';
import type { Clues, Mushroom } from '../core/types';
import { MUSHROOM_CLUES } from '../data/mushroomClues';
import { MUSHROOMS } from '../data/mushrooms';
import { useColors } from '../theme';
import { EdibilityBadge } from './EdibilityBadge';
import { MushroomPhoto } from './MushroomPhoto';

const CLUE_ROWS: [keyof Clues, string][] = [
  ['cap', 'Cap'],
  ['underside', 'Underneath'],
  ['stem', 'Stem'],
  ['sporePrint', 'Spore print'],
  ['habitat', 'Where'],
  ['season', 'When'],
];

/** How to recognise it: the field clues, then the one feature that sets it apart. */
export function CluesList({ mushroom }: { mushroom: Mushroom }) {
  const c = useColors();
  const clues = MUSHROOM_CLUES[mushroom.id];
  if (!clues) return null;
  return (
    <View style={{ gap: 8 }}>
      <View style={[styles.key, { backgroundColor: c.surfaceMuted }]}>
        <Text style={[styles.keyLabel, { color: c.primary }]}>How to tell</Text>
        <Text style={[styles.body, { color: c.text }]}>{clues.key}</Text>
      </View>
      {CLUE_ROWS.map(([field, label]) => (
        <View key={field} style={[styles.clue, { borderColor: c.border }]}>
          <Text style={[styles.clueLabel, { color: c.textMuted }]}>{label}</Text>
          <Text style={[styles.clueText, { color: c.text }]}>{clues[field]}</Text>
        </View>
      ))}
    </View>
  );
}

/** What it's mistaken for, each with the feature that tells them apart. */
export function Lookalikes({ mushroom, linked = true }: { mushroom: Mushroom; linked?: boolean }) {
  const c = useColors();
  const list = lookalikesOf(mushroom, MUSHROOMS);
  if (!list.length) return null;
  return (
    <View style={{ gap: 8 }}>
      {list.map((m) => (
        <Pressable
          key={m.id}
          disabled={!linked}
          accessibilityRole={linked ? 'link' : undefined}
          onPress={() => router.push({ pathname: '/mushroom/[id]', params: { id: m.id } })}
          style={[
            styles.row,
            { borderColor: m.edibility === 'deadly' ? c.danger : c.border, backgroundColor: c.surface },
          ]}
        >
          <View style={styles.rowThumb}>
            <MushroomPhoto mushroom={m} compact />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.rowTitle, { color: c.text }]}>{m.commonName}</Text>
            <EdibilityBadge edibility={m.edibility} />
            {MUSHROOM_CLUES[m.id] && (
              <Text style={{ color: c.textMuted, fontSize: 14, lineHeight: 19 }}>{MUSHROOM_CLUES[m.id].key}</Text>
            )}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export function SafetyNote() {
  const c = useColors();
  return (
    <Text style={[styles.safety, { color: c.textMuted }]}>
      ShroomLock teaches recognition, not foraging. Never eat a wild mushroom because of an app or a photo. Have every
      find checked in person by an expert.
    </Text>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 16, lineHeight: 23 },
  key: { borderRadius: 14, padding: 12, gap: 4 },
  keyLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  clue: { flexDirection: 'row', gap: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  clueLabel: { width: 92, fontSize: 14, fontWeight: '600' },
  clueText: { flex: 1, fontSize: 15, lineHeight: 21 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  rowThumb: { width: 56, height: 56, borderRadius: 10, overflow: 'hidden' },
  rowTitle: { fontSize: 17, fontWeight: '600' },
  safety: { fontSize: 13, lineHeight: 19, marginTop: 20 },
});
