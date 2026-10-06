import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { blocker } from '../blocker';
import { useColors } from '../theme';
import { Button, Card } from './ui';

interface LockState {
  usageAccess: boolean;
  overlay: boolean;
  batteryUnrestricted: boolean;
  blockedCount: number;
  enabled: boolean;
  running: boolean;
}

function readLockState(): LockState {
  return {
    ...blocker.permissions(),
    blockedCount: blocker.getBlockedApps().length,
    enabled: blocker.isEnabled(),
    running: blocker.isRunning(),
  };
}

/** Makers whose phones stop background apps unless the user allows it in their own settings screen. */
const MAKER_TIPS: Record<string, { brand: string; tip: string }> = {
  xiaomi: { brand: 'Xiaomi', tip: 'Turn on Autostart and “Display pop-up windows while running in the background”.' },
  redmi: { brand: 'Redmi', tip: 'Turn on Autostart and “Display pop-up windows while running in the background”.' },
  poco: { brand: 'POCO', tip: 'Turn on Autostart and “Display pop-up windows while running in the background”.' },
  huawei: {
    brand: 'Huawei',
    tip: 'Set ShroomLock to “Manage manually” and allow auto-launch and running in background.',
  },
  honor: {
    brand: 'Honor',
    tip: 'Set ShroomLock to “Manage manually” and allow auto-launch and running in background.',
  },
  oppo: { brand: 'OPPO', tip: 'Allow ShroomLock to auto-launch and run in the background.' },
  realme: { brand: 'realme', tip: 'Allow ShroomLock to auto-launch and run in the background.' },
  oneplus: { brand: 'OnePlus', tip: 'Allow ShroomLock to auto-launch and run in the background.' },
  vivo: { brand: 'vivo', tip: 'Allow ShroomLock to start in the background (Background startup / Autostart).' },
  iqoo: { brand: 'iQOO', tip: 'Allow ShroomLock to start in the background (Background startup / Autostart).' },
  samsung: { brand: 'Samsung', tip: 'Set battery usage to “Unrestricted” and keep ShroomLock out of “Sleeping apps”.' },
  asus: { brand: 'ASUS', tip: 'Allow ShroomLock to auto-start.' },
};

/** Lock status, refreshed whenever the screen regains focus or the user returns from system settings. */
export function useLockState(): [LockState, () => void] {
  const [state, setState] = useState(readLockState);
  const refresh = useCallback(() => setState(readLockState()), []);
  useFocusEffect(refresh);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);
  return [state, refresh];
}

/** Step-by-step setup for the Android lock: two permissions, pick apps, switch on. */
export function LockSetup() {
  const c = useColors();
  const [lock, refresh] = useLockState();

  if (!blocker.available) {
    return (
      <Card>
        <Text style={[styles.body, { color: c.text }]}>
          App locking works in the Android app. On iPhone it needs Apple’s Screen Time permission, which isn’t built
          yet. Meanwhile, “Preview the lock screen” on the Today tab shows the challenge.
        </Text>
      </Card>
    );
  }

  const ready = lock.usageAccess && lock.overlay && lock.blockedCount > 0;
  const maker = MAKER_TIPS[blocker.manufacturer()];
  const toggle = () => {
    blocker.setEnabled(!lock.enabled);
    refresh();
    setTimeout(refresh, 1000); // the service starts asynchronously
  };
  const restart = () => {
    blocker.ensureRunning();
    setTimeout(refresh, 1000);
  };

  return (
    <Card style={{ gap: 4 }}>
      <Step
        n={1}
        done={lock.usageAccess}
        title="Allow usage access"
        hint="Lets ShroomLock see which app you open. Find ShroomLock in the list and switch it on."
        action="Open settings"
        onPress={blocker.openUsageAccessSettings}
      />
      <Step
        n={2}
        done={lock.overlay}
        title="Allow display over other apps"
        hint="Lets ShroomLock show the mushroom on top of a locked app."
        action="Open settings"
        onPress={blocker.openOverlaySettings}
      />
      <Step
        n={3}
        done={lock.blockedCount > 0}
        title={
          lock.blockedCount
            ? `${lock.blockedCount} app${lock.blockedCount === 1 ? '' : 's'} locked`
            : 'Choose apps to lock'
        }
        hint="Instagram, TikTok, YouTube… whatever pulls you in."
        action={lock.blockedCount ? 'Edit' : 'Choose'}
        onPress={() => router.push('/apps')}
        alwaysShowAction
      />
      <Step
        n={4}
        done={lock.batteryUnrestricted}
        title="Keep ShroomLock running"
        hint="Recommended: stops your phone’s battery saver from switching the lock off."
        action="Allow"
        onPress={blocker.requestBatteryExemption}
      />
      {maker && (
        <Step
          n={5}
          done={false}
          title={`${maker.brand} setting`}
          hint={`Recommended on ${maker.brand} phones: ${maker.tip}`}
          action="Open"
          onPress={blocker.openManufacturerSettings}
          alwaysShowAction
        />
      )}
      <View style={{ marginTop: 12 }}>
        {lock.enabled && !lock.running ? (
          <>
            <Text style={[styles.status, { color: c.danger }]}>⚠️ Your phone stopped the lock</Text>
            <Button label="Restart lock" onPress={restart} />
            <Button variant="ghost" label="Turn lock off" onPress={toggle} />
          </>
        ) : lock.enabled ? (
          <>
            <Text style={[styles.status, { color: c.success }]}>🔒 Lock is on</Text>
            <Button variant="secondary" label="Turn lock off" onPress={toggle} />
          </>
        ) : (
          <Button label="Turn lock on" disabled={!ready} onPress={toggle} />
        )}
      </View>
    </Card>
  );
}

function Step(props: {
  n: number;
  done: boolean;
  title: string;
  hint: string;
  action: string;
  onPress: () => void;
  alwaysShowAction?: boolean;
}) {
  const c = useColors();
  return (
    <View style={[styles.step, { borderColor: c.border }]}>
      <Text style={[styles.badge, { color: props.done ? c.success : c.textMuted }]}>{props.done ? '✓' : props.n}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: c.text }]}>{props.title}</Text>
        {!props.done && <Text style={[styles.hint, { color: c.textMuted }]}>{props.hint}</Text>}
      </View>
      {(!props.done || props.alwaysShowAction) && (
        <Pressable accessibilityRole="button" onPress={props.onPress} hitSlop={8}>
          <Text style={[styles.action, { color: c.primary }]}>{props.action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  badge: { width: 22, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  action: { fontSize: 15, fontWeight: '700' },
  status: { fontSize: 16, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
});
