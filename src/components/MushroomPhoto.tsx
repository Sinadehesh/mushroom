import { Image } from 'expo-image';
import { Linking, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Mushroom } from '../core/types';
import { MUSHROOM_IMAGES } from '../data/mushroomImages.generated';
import { creditLine, type MushroomImage } from '../data/mushroomImageTypes';
import { CATEGORY_EMOJI, useColors } from '../theme';

interface Props {
  mushroom: Mushroom;
  style?: StyleProp<ViewStyle>;
  /** Show the family as a hint when no photo is bundled (dev builds). Never the name. */
  showHint?: boolean;
  compact?: boolean;
  /** Which of the mushroom's photos to show; wraps around. Randomise it so users learn the mushroom, not one picture. */
  photo?: number;
}

export function MushroomPhoto({ mushroom, style, showHint, compact, photo = 0 }: Props) {
  const colors = useColors();
  const image = imageFor(mushroom, photo);

  if (image) {
    return (
      <Image
        source={image.source}
        style={[styles.fill, style as object]}
        contentFit="cover"
        transition={150}
        // In the quiz (showHint set) the label must not give the answer away.
        accessibilityLabel={
          showHint === undefined ? `Photo of ${mushroom.commonName}` : 'Photo of the mushroom to identify'
        }
      />
    );
  }

  return (
    <View style={[styles.fill, styles.placeholder, { backgroundColor: colors.surfaceMuted }, style]}>
      <Text style={{ fontSize: compact ? 28 : 88 }}>{CATEGORY_EMOJI[mushroom.category]}</Text>
      {showHint && (
        <Text style={[styles.hint, { color: colors.textMuted }]}>Photo not bundled yet · family {mushroom.family}</Text>
      )}
    </View>
  );
}

export function imageFor(mushroom: Mushroom, photo = 0): MushroomImage | undefined {
  const images = MUSHROOM_IMAGES[mushroom.id];
  return images?.length ? images[photo % images.length] : undefined;
}

/** Attribution under a photo (CC BY requires it). Tapping opens the original observation. */
export function PhotoCredit({ mushroom, photo }: { mushroom: Mushroom; photo?: number }) {
  const colors = useColors();
  const image = imageFor(mushroom, photo);
  if (!image) return null;
  return (
    <Text
      style={[styles.credit, { color: colors.textMuted }]}
      numberOfLines={1}
      onPress={() => Linking.openURL(image.credit.sourceUrl)}
    >
      {creditLine(image)}
    </Text>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  credit: { fontSize: 12, marginTop: 6 },
  hint: { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
});
