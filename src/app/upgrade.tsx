import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  billingAvailable,
  billingBuiltIn,
  buyPlus,
  getPlusProduct,
  onPurchaseUpdate,
  plusOwnership,
  type StoreProduct,
} from '../billing';
import { Button, Card } from '../components/ui';
import { FREE_APP_LIMIT, isReviewCode } from '../core/plus';
import { MUSHROOMS } from '../data/mushrooms';
import { hasPlus, useStore } from '../state/store';
import { serif, useColors } from '../theme';

type Shop =
  | { status: 'loading' }
  | { status: 'unavailable'; reason: string }
  | { status: 'ready'; product: StoreProduct };

const gilled = MUSHROOMS.filter((m) => m.category === 'gilled').length;
const others = MUSHROOMS.length - gilled;

/** What Plus adds, and the one-time purchase through Google Play. */
export default function Upgrade() {
  const c = useColors();
  const { state, dispatch } = useStore();
  const [shop, setShop] = useState<Shop>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const plus = hasPlus(state);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!billingBuiltIn) {
        return setShop({ status: 'unavailable', reason: 'Purchases are available in the Android app.' });
      }
      const available = await billingAvailable();
      if (!live) return;
      if (!available) {
        return setShop({
          status: 'unavailable',
          reason: 'Purchases need the Google Play Store. Install ShroomLock from Google Play to upgrade.',
        });
      }
      const product = await getPlusProduct().catch(() => null);
      if (!live) return;
      setShop(
        product
          ? { status: 'ready', product }
          : { status: 'unavailable', reason: 'ShroomLock Plus isn’t on sale yet. Please check back soon.' },
      );
    })();
    const unsubscribe = onPurchaseUpdate((u) => {
      setBusy(false);
      if (u.state === 'purchased') setNote({ text: 'Thank you! Plus is unlocked. 🍄', tone: 'info' });
      else if (u.state === 'pending')
        setNote({ text: 'Payment pending. Plus unlocks as soon as Google Play confirms it.', tone: 'info' });
      else if (u.state === 'error') setNote({ text: u.message ?? 'Something went wrong.', tone: 'error' });
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  const buy = async () => {
    setNote(null);
    setBusy(true);
    try {
      await buyPlus();
    } catch (e) {
      setBusy(false);
      setNote({ text: e instanceof Error ? e.message : 'Couldn’t open Google Play.', tone: 'error' });
    }
  };

  const restore = async () => {
    setNote(null);
    setBusy(true);
    const owned = await plusOwnership();
    setBusy(false);
    if (owned === 'owned') {
      dispatch({ type: 'setPlus', plus: true });
      setNote({ text: 'Purchase restored. Plus is unlocked. 🍄', tone: 'info' });
    } else if (owned === 'pending') {
      setNote({ text: 'Your payment is still pending with Google Play.', tone: 'info' });
    } else if (owned === 'none') {
      setNote({ text: 'No Plus purchase found for this Google account.', tone: 'error' });
    } else {
      setNote({ text: 'Couldn’t reach Google Play. Check your connection and try again.', tone: 'error' });
    }
  };

  const redeem = () => {
    if (isReviewCode(code)) {
      dispatch({ type: 'unlockWithCode' });
      setCodeOpen(false);
      setNote({ text: 'Code accepted. Plus is unlocked on this phone. 🍄', tone: 'info' });
    } else {
      setNote({ text: 'That code isn’t valid. Check it and try again.', tone: 'error' });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.hero}>🍄</Text>
      <Text style={[styles.title, { color: c.text, fontFamily: serif }]}>ShroomLock Plus</Text>
      <Text style={[styles.subtitle, { color: c.textMuted }]}>
        One payment. Yours for good, on every phone you use.
      </Text>

      <Card style={{ gap: 14, marginTop: 20 }}>
        <Feature title="Lock as many apps as you like" body={`The free version locks up to ${FREE_APP_LIMIT} apps.`} />
        <Feature
          title={`All ${MUSHROOMS.length} mushrooms`}
          body={`${others} boletes, brackets, chanterelles, morels, puffballs and more join the ${gilled} gilled mushrooms in your lessons and on the lock screen.`}
        />
        <Feature title="Support a small, ad-free app" body="No ads, no tracking, no subscription." />
      </Card>

      <View style={{ marginTop: 24, gap: 10 }}>
        {plus ? (
          <Text style={[styles.owned, { color: c.success }]}>✓ You have ShroomLock Plus</Text>
        ) : shop.status === 'loading' ? (
          <ActivityIndicator color={c.primary} />
        ) : shop.status === 'unavailable' ? (
          <Text style={[styles.body, { color: c.textMuted, textAlign: 'center' }]}>{shop.reason}</Text>
        ) : (
          <Button
            label={busy ? 'Opening Google Play…' : `Unlock Plus for ${shop.product.price ?? 'a one-time price'}`}
            disabled={busy}
            onPress={buy}
          />
        )}

        {note && (
          <Text style={[styles.body, { color: note.tone === 'error' ? c.danger : c.success, textAlign: 'center' }]}>
            {note.text}
          </Text>
        )}

        {!plus && billingBuiltIn && shop.status !== 'loading' && (
          <Button variant="ghost" label="Restore purchase" disabled={busy} onPress={restore} />
        )}

        {!plus &&
          (codeOpen ? (
            <View style={{ gap: 8 }}>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="SHROOM-XXXX-XXXX-XXXX-XXXX"
                placeholderTextColor={c.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                onSubmitEditing={redeem}
                accessibilityLabel="Review code"
                style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
              />
              <Button variant="secondary" label="Apply code" disabled={!code.trim()} onPress={redeem} />
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setCodeOpen(true)} hitSlop={8}>
              <Text style={[styles.codeLink, { color: c.textMuted }]}>Have a review code?</Text>
            </Pressable>
          ))}

        {__DEV__ && (
          <Button
            variant="ghost"
            label={state.plus ? 'Dev build: turn Plus off' : 'Dev build: simulate Plus'}
            onPress={() => dispatch({ type: 'setPlus', plus: !state.plus })}
          />
        )}
      </View>

      <Text style={[styles.small, { color: c.textMuted }]}>
        Payment is handled by Google Play. ShroomLock never sees your card details. Plus is tied to your Google account,
        so “Restore purchase” brings it back after reinstalling or on a new phone.
      </Text>
    </ScrollView>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Text style={{ color: c.success, fontSize: 18, fontWeight: '700' }}>✓</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: c.textMuted, fontSize: 14, lineHeight: 20 }}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 48, maxWidth: 560, width: '100%', alignSelf: 'center' },
  hero: { fontSize: 56, textAlign: 'center', marginTop: 8 },
  title: { fontSize: 30, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  subtitle: { fontSize: 16, textAlign: 'center', marginTop: 6 },
  body: { fontSize: 15, lineHeight: 22 },
  owned: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, letterSpacing: 1 },
  codeLink: { fontSize: 14, textAlign: 'center', textDecorationLine: 'underline', paddingVertical: 6 },
  small: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 24 },
});
