import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MushroomPhoto } from '../../components/MushroomPhoto';
import { Button, Card, SectionTitle } from '../../components/ui';
import { accuracy, mycologyIQ, masteredCount, troubleMushrooms } from '../../core/stats';
import { useDeck, useStore } from '../../state/store';
import { serif, useColors } from '../../theme';

export default function Fungarium() {
  const c = useColors();
  const { state } = useStore();
  const deck = useDeck();
  const now = Date.now();

  const iq = mycologyIQ(deck, state.progress);
  const acc = accuracy(state.progress);
  const seen = deck.filter((p) => state.progress[p.id]).length;
  const due = deck.filter((p) => state.progress[p.id] && state.progress[p.id].dueAt <= now).length;
  const trouble = troubleMushrooms(deck, state.progress);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.iqCard}>
        <Text style={[styles.iqLabel, { color: c.textMuted }]}>Mycology IQ</Text>
        <Text style={[styles.iq, { color: c.primary, fontFamily: serif }]}>{iq}</Text>
        <View style={styles.statsRow}>
          <Stat label="Seen" value={`${seen}/${deck.length}`} />
          <Stat label="Mastered" value={String(masteredCount(deck, state.progress))} />
          <Stat label="Accuracy" value={acc === null ? '—' : `${Math.round(acc * 100)}%`} />
        </View>
      </Card>

      <View style={styles.actions}>
        <Button
          label={due ? `Review ${due} due mushroom${due === 1 ? '' : 's'}` : 'Practice a flashcard'}
          onPress={() => router.push({ pathname: '/challenge', params: { practice: '1' } })}
        />
        <Button
          variant="secondary"
          label="Preview the lock screen"
          onPress={() => router.push({ pathname: '/challenge', params: { source: 'Instagram' } })}
        />
      </View>

      <SectionTitle>Keeps tripping you up</SectionTitle>
      {trouble.length === 0 ? (
        <Text style={{ color: c.textMuted, fontSize: 15 }}>
          Nothing yet. Mushrooms you miss will show up here so you can study them.
        </Text>
      ) : (
        trouble.map((p) => {
          const pr = state.progress[p.id];
          return (
            <Pressable
              key={p.id}
              accessibilityRole="link"
              onPress={() => router.push({ pathname: '/mushroom/[id]', params: { id: p.id } })}
              style={[styles.row, { borderColor: c.border, backgroundColor: c.surface }]}
            >
              <View style={styles.thumb}>
                <MushroomPhoto mushroom={p} compact />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: c.text }]}>{p.commonName}</Text>
                <Text style={{ color: c.textMuted }}>
                  Missed {pr.wrong} of {pr.seen}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>{value}</Text>
      <Text style={{ color: c.textMuted, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  iqCard: { alignItems: 'center', paddingVertical: 24 },
  iqLabel: { fontSize: 14, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  iq: { fontSize: 72, fontWeight: '700', lineHeight: 84 },
  statsRow: { flexDirection: 'row', marginTop: 12, alignSelf: 'stretch' },
  actions: { gap: 10, marginTop: 16 },
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
  rowTitle: { fontSize: 17, fontWeight: '600' },
});
