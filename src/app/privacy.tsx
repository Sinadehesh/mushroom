import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PRIVACY_POLICY, type PolicySection } from '../data/privacyPolicy';
import { useColors } from '../theme';

export default function Privacy() {
  const c = useColors();
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={{ color: c.textMuted, fontSize: 14 }}>Last updated {PRIVACY_POLICY.updated}</Text>
      <Text style={[styles.summary, { color: c.text }]}>{PRIVACY_POLICY.summary}</Text>
      {(PRIVACY_POLICY.sections as PolicySection[]).map((s) => (
        <View key={s.heading} style={{ gap: 8 }}>
          <Text style={[styles.heading, { color: c.text }]}>{s.heading}</Text>
          {s.paragraphs.map((p) => (
            <Text key={p} style={[styles.body, { color: c.text }]}>
              {p}
            </Text>
          ))}
          {s.bullets?.map((b) => (
            <Text key={b} style={[styles.body, { color: c.text }]}>
              • {b}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center', gap: 16 },
  summary: { fontSize: 17, lineHeight: 25, fontWeight: '600' },
  heading: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
});
