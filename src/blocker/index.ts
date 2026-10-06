/**
 * Bridge between the mushroom challenge (JS) and the OS-level app blocker.
 *
 *  - Android: the native `app-blocker` module (modules/app-blocker). A foreground
 *    service watches the app in front and opens `shroomlock://challenge?source=…&package=…`
 *    over any blocked app that isn't inside an unlock window.
 *  - iOS and web: not available yet (iOS needs the Screen Time API, a Mac to build and
 *    Apple's approval; see docs/PLATFORM_INTEGRATION.md). A simulated blocker keeps the
 *    challenge flow usable there via "Preview the lock screen".
 */
import AppBlocker, { type LaunchableApp } from '../../modules/app-blocker';

export type { LaunchableApp };

export interface BlockerPermissions {
  /** Android "Usage access": lets ShroomLock see which app is in front. */
  usageAccess: boolean;
  /** Android "Display over other apps": lets ShroomLock open the challenge on top. */
  overlay: boolean;
  /** Exempt from battery optimisation, so the system doesn't stop the watcher. */
  batteryUnrestricted: boolean;
}

export interface AppBlocker {
  readonly available: boolean;
  permissions(): BlockerPermissions;
  openUsageAccessSettings(): void;
  openOverlaySettings(): void;
  getLaunchableApps(): Promise<LaunchableApp[]>;
  getBlockedApps(): string[];
  setBlockedApps(packageNames: string[]): void;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  /** Let `packageName` (or every blocked app) open freely for `minutes`. */
  grantTemporaryAccess(packageName: string | undefined, minutes: number): void;
  /** Bring the app the user was trying to open back to the front. */
  returnToApp(packageName: string): boolean;
  goHome(): void;
  /** True while the watcher service is alive. */
  isRunning(): boolean;
  /** Restart the watcher if the lock is on but the system stopped it. */
  ensureRunning(): void;
  requestBatteryExemption(): void;
  /** Lower-case phone maker, e.g. "xiaomi". */
  manufacturer(): string;
  /** The maker's own autostart / background screen; returns false if the phone has none. */
  openManufacturerSettings(): boolean;
}

const CHALLENGE_URL = 'shroomlock://challenge';

function androidBlocker(native: NonNullable<typeof AppBlocker>): AppBlocker {
  return {
    available: true,
    permissions: () => ({
      usageAccess: native.hasUsageAccess(),
      overlay: native.canDrawOverlays(),
      batteryUnrestricted: native.isIgnoringBatteryOptimizations(),
    }),
    openUsageAccessSettings: () => native.openUsageAccessSettings(),
    openOverlaySettings: () => native.openOverlaySettings(),
    getLaunchableApps: () => native.getLaunchableApps(),
    getBlockedApps: () => native.getBlockedApps(),
    setBlockedApps: (packageNames) => native.setBlockedApps(packageNames),
    isEnabled: () => native.isEnabled(),
    setEnabled: (enabled) => {
      if (enabled) native.requestNotificationPermission();
      native.setEnabled(enabled, CHALLENGE_URL);
    },
    grantTemporaryAccess: (packageName, minutes) => native.grantTemporaryAccess(packageName ?? null, minutes),
    returnToApp: (packageName) => native.openApp(packageName),
    goHome: () => native.goHome(),
    isRunning: () => native.isServiceRunning(),
    ensureRunning: () => native.ensureRunning(),
    requestBatteryExemption: () => native.requestIgnoreBatteryOptimizations(),
    manufacturer: () => native.getManufacturer(),
    openManufacturerSettings: () => native.openManufacturerSettings(),
  };
}

const simulatedBlocker: AppBlocker = {
  available: false,
  permissions: () => ({ usageAccess: false, overlay: false, batteryUnrestricted: false }),
  openUsageAccessSettings: () => {},
  openOverlaySettings: () => {},
  getLaunchableApps: async () => [],
  getBlockedApps: () => [],
  setBlockedApps: () => {},
  isEnabled: () => false,
  setEnabled: () => {},
  grantTemporaryAccess: () => {},
  returnToApp: () => false,
  goHome: () => {},
  isRunning: () => false,
  ensureRunning: () => {},
  requestBatteryExemption: () => {},
  manufacturer: () => '',
  openManufacturerSettings: () => false,
};

export const blocker: AppBlocker = AppBlocker ? androidBlocker(AppBlocker) : simulatedBlocker;
