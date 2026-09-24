import { StyleSheet, Text, View } from 'react-native';

import type { Edibility } from '../core/types';
import { EDIBILITY_LABEL, edibilityColor, useColors } from '../theme';

/** Kitchen status as a coloured pill. Never shown while the question is open: it would give the answer away. */
export function EdibilityBadge({ edibility }: { edibility: Edibility }) {
  const c = useColors();
  const color = edibilityColor(edibility, c);
  return (
    <View
      style={[styles.badge, { borderColor: color }]}
      accessibilityLabel={`Edibility: ${EDIBILITY_LABEL[edibility]}`}
    >
      <Text style={[styles.label, { color }]}>
        {edibility === 'deadly' ? '☠️ ' : ''}
        {EDIBILITY_LABEL[edibility]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  label: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
});
