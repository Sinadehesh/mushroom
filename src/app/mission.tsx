import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Button, Card, SectionTitle } from '../components/ui';
import { playStoreUrl, sisterApps, SUPPORT_URL, thisApp, type SisterStatus } from '../core/family';
import { openSister, sisterStatuses } from '../family';
import { hasPlus, useStore } from '../state/store';
import { serif, useColors } from '../theme';

/**
 * Why we make these apps, our other apps (with the family price for Plus) and how to help.
 * Donations happen on our website and are a gift: they never unlock anything in the app.
 */
export default function Mission() {
  const c = useColors();
  const { state } = useStore();
  const me = thisApp();
  const [sisters, setSisters] = useState<SisterStatus[]>([]);

  useEffect(() => {
    let live = true;
    sisterStatuses().then((s) => live && setSisters(s));
    return () => {
      live = false;
    };
  }, []);

  const open = (url: string) => Linking.openURL(url).catch(() => {});
  const share = () =>
    Share.share({
      message: `I’m learning the ${me.things} around me with ${me.name}. It turns phone time into one-minute lessons about nature: ${playStoreUrl(me.packageName)}`,
    }).catch(() => {});

  const text = [styles.body, { color: c.text }];
  const muted = [styles.small, { color: c.textMuted }];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.hero}>🌍</Text>
      <Text style={[styles.title, { color: c.text, fontFamily: serif }]}>Notice the world around you</Text>
      <Text style={text}>
        Most of us walk past hundreds of plants, mushrooms and clouds every day without really seeing them. Our eyes
        are on our screens, and the living world around us fades into the background.
      </Text>
      <Text style={text}>
        {me.name} turns the moments you reach for your phone into small lessons about nature. Once you know a name, you
        start to see it everywhere: the tree on your street, the mushrooms after the rain, the clouds that bring a
        storm. A walk to the shop becomes a little adventure.
      </Text>
      <Text style={text}>
        We believe people protect what they love, and love what they know. Every name you learn is a reason to look
        up, slow down and appreciate the place you live a little more.
      </Text>

      <SectionTitle>Our apps</SectionTitle>
      <Text style={[muted, { marginBottom: 10 }]}>
        Buy Plus in any of our apps, and Plus in the others costs only a family price.
      </Text>
      {sisterApps().map((app) => {
        const status = sisters.find((s) => s.packageName === app.packageName);
        return (
          <Card key={app.id} style={{ gap: 10, marginBottom: 12 }}>
            <View style={styles.appRow}>
              <Text style={styles.appEmoji}>{app.emoji}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.appName, { color: c.text }]}>{app.name}</Text>
                <Text style={muted}>{app.tagline}</Text>
              </View>
            </View>
            {status?.plus ? (
              <Text style={[styles.small, { color: c.success }]}>
                {hasPlus(state)
                  ? '✓ You have Plus there too.'
                  : `✓ You have Plus there, so ${me.name} Plus is yours at the family price.`}
              </Text>
            ) : state.plus ? (
              <Text style={[styles.small, { color: c.success }]}>🎁 Plus there is yours at the family price.</Text>
            ) : null}
            <Button
              variant="secondary"
              label={status?.installed ? `Open ${app.name}` : 'Get it on Google Play'}
              onPress={() => openSister(app.packageName, !!status?.installed)}
            />
            {status?.plus && !hasPlus(state) && (
              <Button variant="ghost" label="Get the family price here" onPress={() => router.push('/upgrade')} />
            )}
          </Card>
        );
      })}

      <SectionTitle>Why we need your help</SectionTitle>
      <Text style={text}>
        {me.name} is made by a small independent developer, not a big company. There are no ads and no tracking. Each
        app takes months of work: hundreds of photos, every fact checked, and keeping up with Android. Your support
        pays for that work, and lets us make more apps that help people see nature, like birds, insects and the night
        sky.
      </Text>

      <SectionTitle>How you can help</SectionTitle>
      <Card style={{ gap: 14 }}>
        <Way
          title="💚 Donate"
          body="Any amount helps us make the next app. A donation is a gift: it doesn’t unlock anything in the app."
        >
          <Button label="Donate on our website" onPress={() => open(`${SUPPORT_URL}#donate`)} />
        </Way>
        <Way title={`⭐ Rate ${me.name}`} body="A review on Google Play helps other people find us.">
          <Button variant="secondary" label="Rate on Google Play" onPress={() => open(playStoreUrl(me.packageName))} />
        </Way>
        <Way title="📣 Tell a friend" body={`Know someone who’d enjoy learning the ${me.things} around them?`}>
          <Button variant="secondary" label={`Share ${me.name}`} onPress={share} />
        </Way>
        {!hasPlus(state) && (
          <Way title={`🌱 Get ${me.name} Plus`} body="Unlocks everything, and keeps the apps going.">
            <Button variant="secondary" label="See what Plus adds" onPress={() => router.push('/upgrade')} />
          </Way>
        )}
      </Card>

      <Text style={[styles.outro, { color: c.text, fontFamily: serif }]}>{me.goOutside}</Text>
      <Text style={[muted, { textAlign: 'center' }]}>Thank you for being here.</Text>
    </ScrollView>
  );
}

function Way({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
      <Text style={{ color: c.textMuted, fontSize: 14, lineHeight: 20 }}>{body}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 48, maxWidth: 560, width: '100%', alignSelf: 'center' },
  hero: { fontSize: 56, textAlign: 'center', marginTop: 8 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginTop: 4, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
  small: { fontSize: 14, lineHeight: 20 },
  appRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  appEmoji: { fontSize: 36 },
  appName: { fontSize: 18, fontWeight: '700' },
  outro: { fontSize: 18, lineHeight: 26, textAlign: 'center', marginTop: 28, marginBottom: 6 },
});
