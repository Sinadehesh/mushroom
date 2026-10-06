import { requireOptionalNativeModule } from 'expo';

export interface LaunchableApp {
  packageName: string;
  label: string;
}

export interface AppBlockerNativeModule {
  hasUsageAccess(): boolean;
  canDrawOverlays(): boolean;
  openUsageAccessSettings(): void;
  openOverlaySettings(): void;
  requestNotificationPermission(): void;
  getLaunchableApps(): Promise<LaunchableApp[]>;
  getBlockedApps(): string[];
  setBlockedApps(packageNames: string[]): void;
  isEnabled(): boolean;
  setEnabled(enabled: boolean, challengeUrl: string): void;
  grantTemporaryAccess(packageName: string | null, minutes: number): void;
  openApp(packageName: string): boolean;
  goHome(): void;
  isServiceRunning(): boolean;
  ensureRunning(): void;
  isIgnoringBatteryOptimizations(): boolean;
  requestIgnoreBatteryOptimizations(): void;
  getManufacturer(): string;
  openManufacturerSettings(): boolean;
}

/** Android only. `null` on iOS, on the web, and in Expo Go (which can't load custom native code). */
export default requireOptionalNativeModule<AppBlockerNativeModule>('AppBlocker');
