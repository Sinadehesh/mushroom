import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { blocker, type LaunchableApp } from '../blocker';
import { canLockAnother, FREE_APP_LIMIT } from '../core/plus';
import { hasPlus, useStore } from '../state/store';
import { useColors } from '../theme';

/** Searchable list of installed apps; ticking one adds it to the lock (Android). Free: up to FREE_APP_LIMIT. */
export function AppPicker({ header }: { header?: ReactElement }) {
  const c = useColors();
  const plus = hasPlus(useStore().state);
  const [apps, setApps] = useState<LaunchableApp[] | null>(null);
  const [blocked, setBlocked] = useState(() => new Set(blocker.getBlockedApps()));
  const [query, setQuery] = useState('');

  useEffect(() => {
    blocker.getLaunchableApps().then(setApps, () => setApps([]));
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (apps ?? []).filter((a) => !q || a.label.toLowerCase().includes(q) || a.packageName.includes(q));
  }, [apps, query]);

  const toggle = (pkg: string) => {
    const next = new Set(blocked);
    if (next.has(pkg)) next.delete(pkg);
    else if (!canLockAnother(blocked.size, plus)) return router.push('/upgrade');
    else next.add(pkg);
    setBlocked(next);
    blocker.setBlockedApps([...next]);
  };

  if (!apps) {
    return <ActivityIndicator style={{ marginTop: 48 }} color={c.primary} />;
  }

  return (
    <FlatList
      data={visible}
      keyExtractor={(a) => a.packageName}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: 8, marginBottom: 12 }}>
          {header}
          <Text style={{ color: c.textMuted, fontSize: 15 }}>
            {blocked.size} locked · opening one shows a mushroom to identify first.
          </Text>
          {!plus && (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/upgrade')}
              style={[styles.limit, { borderColor: c.border, backgroundColor: c.surface }]}
            >
              <Text style={{ color: c.text, fontSize: 14, flex: 1 }}>
                Free version: up to {FREE_APP_LIMIT} apps.{' '}
                <Text style={{ color: c.primary, fontWeight: '700' }}>Get Plus to lock more</Text>
              </Text>
            </Pressable>
          )}
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search apps"
            placeholderTextColor={c.textMuted}
            autoCorrect={false}
            style={[styles.search, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
          />
        </View>
      }
      ListEmptyComponent={<Text style={{ color: c.textMuted }}>No apps found.</Text>}
      renderItem={({ item }) => {
        const on = blocked.has(item.packageName);
        return (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            testID={`app-${item.packageName}`}
            onPress={() => toggle(item.packageName)}
            style={[styles.row, { borderColor: c.border }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>{item.label}</Text>
              <Text style={{ color: c.textMuted, fontSize: 12 }}>{item.packageName}</Text>
            </View>
            <View
              style={[
                styles.box,
                { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : 'transparent' },
              ]}
            >
              {on && <Text style={{ color: c.onPrimary, fontWeight: '800' }}>✓</Text>}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  search: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  limit: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row' },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
