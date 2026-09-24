import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EdibilityBadge } from '../../components/EdibilityBadge';
import { MushroomPhoto, PhotoCredit } from '../../components/MushroomPhoto';
import { Card, SectionTitle } from '../../components/ui';
import { lookalikesOf } from '../../core/quiz';
import { MAX_BOX } from '../../core/srs';
import { MUSHROOM_IMAGES } from '../../data/mushroomImages.generated';
import { MUSHROOMS, MUSHROOMS_BY_ID } from '../../data/mushrooms';
import { useStore } from '../../state/store';
import { CATEGORY_LABEL, EDIBILITY_LABEL, serif, useColors } from '../../theme';

export default function MushroomDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mushroom = MUSHROOMS_BY_ID[id];
  const c = useColors();
  const { state } = useStore();
  const [photo, setPhoto] = useState(0);

  if (!mushroom) return <Text style={{ padding: 16, color: c.text }}>Unknown mushroom.</Text>;

  const progress = state.progress[mushroom.id];
  const photoCount = MUSHROOM_IMAGES[mushroom.id]?.length ?? 0;
  const lookalikes = lookalikesOf(mushroom, MUSHROOMS);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: mushroom.commonName }} />
      <View style={[styles.photo, { backgroundColor: c.surfaceMuted }]}>
        <MushroomPhoto mushroom={mushroom} photo={photo} />
      </View>
      <PhotoCredit mushroom={mushroom} photo={photo} />
      {photoCount > 1 && (
        <View style={styles.thumbs}>
          {Array.from({ length: photoCount }, (_, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Photo ${i + 1} of ${photoCount}`}
              accessibilityState={{ selected: i === photo }}
              onPress={() => setPhoto(i)}
              style={[styles.thumb, { borderColor: i === photo ? c.primary : 'transparent' }]}
            >
              <MushroomPhoto mushroom={mushroom} photo={i} compact />
            </Pressable>
          ))}
        </View>
      )}

      <Text style={[styles.name, { color: c.text, fontFamily: serif }]}>{mushroom.commonName}</Text>
      <Text style={[styles.sci, { color: c.textMuted, fontFamily: serif }]}>{mushroom.scientificName}</Text>
      <View style={{ marginTop: 10 }}>
        <EdibilityBadge edibility={mushroom.edibility} />
      </View>

      <Card style={{ marginTop: 16 }}>
        <Text style={[styles.fact, { color: c.text }]}>{mushroom.fact}</Text>
      </Card>

      <SectionTitle>Details</SectionTitle>
      <Detail label="Family" value={mushroom.family} />
      <Detail label="Group" value={CATEGORY_LABEL[mushroom.category]} />
      <Detail label="Edibility" value={EDIBILITY_LABEL[mushroom.edibility]} />
      {mushroom.aliases.length > 0 && <Detail label="Also accepted" value={mushroom.aliases.join(', ')} />}

      {lookalikes.length > 0 && (
        <>
          <SectionTitle>Often confused with</SectionTitle>
          {lookalikes.map((m) => (
            <Pressable
              key={m.id}
              accessibilityRole="link"
              onPress={() => router.push({ pathname: '/mushroom/[id]', params: { id: m.id } })}
              style={[styles.row, { borderColor: c.border, backgroundColor: c.surface }]}
            >
              <View style={styles.rowThumb}>
                <MushroomPhoto mushroom={m} compact />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.rowTitle, { color: c.text }]}>{m.commonName}</Text>
                <EdibilityBadge edibility={m.edibility} />
              </View>
            </Pressable>
          ))}
        </>
      )}

      <SectionTitle>Your record</SectionTitle>
      {progress ? (
        <>
          <Detail label="Correct" value={`${progress.correct} of ${progress.seen}`} />
          <Detail label="Mastery" value={`${progress.box} / ${MAX_BOX}`} />
          <Detail label="Next review" value={formatDue(progress.dueAt)} />
        </>
      ) : (
        <Text style={{ color: c.textMuted }}>You haven’t met this mushroom on the lock screen yet.</Text>
      )}

      <Text style={[styles.safety, { color: c.textMuted }]}>
        MycoLock teaches recognition, not foraging. Never eat a wild mushroom because of an app or a photo. Have every
        find checked in person by a local expert.
      </Text>
    </ScrollView>
  );
}

function formatDue(dueAt: number): string {
  const mins = Math.round((dueAt - Date.now()) / 60_000);
  if (mins <= 0) return 'Due now';
  if (mins < 60) return `In ${mins} min`;
  if (mins < 48 * 60) return `In ${Math.round(mins / 60)} h`;
  return `In ${Math.round(mins / 1440)} days`;
}

function Detail({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={[styles.detail, { borderColor: c.border }]}>
      <Text style={{ color: c.textMuted, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 15, flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 20, overflow: 'hidden' },
  thumbs: { flexDirection: 'row', gap: 8, marginTop: 10 },
  thumb: { width: 60, height: 60, borderRadius: 10, overflow: 'hidden', borderWidth: 2 },
  name: { fontSize: 32, fontWeight: '700', marginTop: 16 },
  sci: { fontSize: 18, fontStyle: 'italic' },
  fact: { fontSize: 17, lineHeight: 25 },
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
  safety: { fontSize: 13, lineHeight: 19, marginTop: 28 },
  detail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
