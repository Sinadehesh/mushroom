/**
 * The app family on this phone (see src/core/family.ts): which sister apps are installed and
 * which have Plus. Android only, through the native app-blocker module; elsewhere there are no
 * sister apps to find.
 */
import { Linking } from 'react-native';

import AppBlocker from '../../modules/app-blocker';
import { blocker } from '../blocker';
import { playStoreUrl, type SisterStatus } from '../core/family';

export async function sisterStatuses(): Promise<SisterStatus[]> {
  if (!AppBlocker) return [];
  try {
    return await AppBlocker.getFamilyApps();
  } catch {
    return [];
  }
}

/** Lets the sister apps know whether this app has Plus (Google Play's answer, not a review code). */
export function shareFamilyPlus(plus: boolean) {
  try {
    AppBlocker?.setFamilyPlus(plus);
  } catch {}
}

/** Opens a sister app if it's installed, else its Google Play page. */
export function openSister(packageName: string, installed: boolean) {
  if (installed && blocker.returnToApp(packageName)) return;
  Linking.openURL(playStoreUrl(packageName)).catch(() => {});
}
