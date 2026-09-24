/**
 * Bridge between the mushroom challenge (JS) and the OS-level app blocker.
 *
 * The native halves are not built yet — see docs/PLATFORM_INTEGRATION.md:
 *  - iOS: FamilyControls + ManagedSettings shield, ShieldConfiguration/ShieldAction
 *    extensions, and a DeviceActivity schedule to re-shield when the unlock expires.
 *  - Android: a foreground service watching UsageStatsManager events that opens
 *    `mycolock://challenge?source=<package>` over a blocked app.
 *
 * Until then this simulated blocker lets the full challenge flow run in Expo Go
 * and on the web.
 */
export type BlockerStatus = 'authorized' | 'denied' | 'notDetermined' | 'unsupported';

export interface AppBlocker {
  readonly kind: 'simulated' | 'ios-screen-time' | 'android-usage-stats';
  getStatus(): Promise<BlockerStatus>;
  /** iOS: Screen Time authorization. Android: Usage Access + Display over other apps. */
  requestAuthorization(): Promise<BlockerStatus>;
  /** iOS: FamilyActivityPicker. Android: an in-app list of installed launcher apps. */
  chooseBlockedApps(): Promise<void>;
  /** Lift the shield on `source` (or every blocked app) for `minutes`, then re-lock. */
  grantTemporaryAccess(source: string | undefined, minutes: number): Promise<void>;
}

const simulatedBlocker: AppBlocker = {
  kind: 'simulated',
  getStatus: async () => 'unsupported',
  requestAuthorization: async () => 'unsupported',
  chooseBlockedApps: async () => {},
  grantTemporaryAccess: async (source, minutes) => {
    console.log(`[blocker] (simulated) unlocked ${source ?? 'all apps'} for ${minutes} min`);
  },
};

export const blocker: AppBlocker = simulatedBlocker;
