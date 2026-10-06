import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MUSHROOMS_PER_DAY_MAX, MUSHROOMS_PER_DAY_MIN } from '../core/types';
import { serif, useColors } from '../theme';
import { Chip } from './ui';

const PRESETS = [1, 3, 5];

/** How many new mushrooms each day's lesson brings: − n + with a few presets. */
export function MushroomsPerDay({
  value,
  deckSize,
  onChange,
}: {
  value: number;
  deckSize: number;
  onChange: (n: number) => void;
}) {
  const c = useColors();
  const set = (n: number) => onChange(Math.min(MUSHROOMS_PER_DAY_MAX, Math.max(MUSHROOMS_PER_DAY_MIN, n)));
  const days = Math.ceil(deckSize / value);
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.stepper}>
        <Step label="−" a11y="Fewer" disabled={value <= MUSHROOMS_PER_DAY_MIN} onPress={() => set(value - 1)} />
        <View style={{ alignItems: 'center', minWidth: 96 }}>
          <Text style={[styles.value, { color: c.primary, fontFamily: serif }]} accessibilityLiveRegion="polite">
            {value}
          </Text>
          <Text style={{ color: c.textMuted, fontSize: 14 }}>{value === 1 ? 'mushroom a day' : 'mushrooms a day'}</Text>
        </View>
        <Step label="+" a11y="More" disabled={value >= MUSHROOMS_PER_DAY_MAX} onPress={() => set(value + 1)} />
      </View>
      <View style={styles.presets}>
        {PRESETS.map((n) => (
          <Chip key={n} label={String(n)} selected={value === n} onPress={() => set(n)} />
        ))}
      </View>
      <Text style={{ color: c.textMuted, fontSize: 14, textAlign: 'center' }}>
        At {value} a day you’ll know all {deckSize} in about {days} day{days === 1 ? '' : 's'}.
      </Text>
    </View>
  );
}

function Step({
  label,
  a11y,
  disabled,
  onPress,
}: {
  label: string;
  a11y: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={[styles.step, { borderColor: c.border, backgroundColor: c.surface, opacity: disabled ? 0.4 : 1 }]}
    >
      <Text style={{ color: c.text, fontSize: 28, fontWeight: '600', lineHeight: 32 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  value: { fontSize: 56, fontWeight: '700', lineHeight: 64 },
  step: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  presets: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
});
