import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MUSHROOM_IMAGES } from '../data/mushroomImages.generated';
import { MUSHROOMS_BY_ID } from '../data/mushrooms';
import { useColors } from '../theme';

/** Attribution for every bundled photo — required by CC BY / CC BY-SA licenses. */
export default function Credits() {
  const c = useColors();
  const entries = Object.entries(MUSHROOM_IMAGES)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([id, images]) => images.map((image, i) => ({ key: `${id}-${i}`, id, credit: image.credit })));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={{ color: c.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 16 }}>
        Mushroom photos come from iNaturalist observers who share their work under open licenses (CC0, CC BY, CC BY-SA).
        Tap a credit to see the original observation.
      </Text>
      {entries.length === 0 && (
        <Text style={{ color: c.textMuted }}>No photos bundled yet — run `npm run photos:download`.</Text>
      )}
      {entries.map(({ key, id, credit }) => (
        <View key={key} style={[styles.row, { borderColor: c.border }]}>
          <Text style={{ color: c.text, fontWeight: '600' }}>{MUSHROOMS_BY_ID[id]?.commonName ?? id}</Text>
          <Text style={{ color: c.primary }} onPress={() => Linking.openURL(credit.sourceUrl)}>
            {credit.author} · {credit.license}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
});
