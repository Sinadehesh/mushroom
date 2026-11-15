/**
 * FloraLock, ShroomLock and CloudLock are one family of apps. Bought Plus in one of them (once
 * or monthly, through Google Play)? Then Plus in each of the others costs only the family
 * price, a one-time product of its own (PLUS_FAMILY_ID in plus.ts). The apps learn about each
 * other through the native app-blocker module (Family.kt), which keeps the same package list.
 */

export interface FamilyApp {
  id: 'floralock' | 'shroomlock' | 'cloudlock';
  name: string;
  packageName: string;
  emoji: string;
  /** What it teaches, for "More from us". */
  tagline: string;
  /** What you learn in it, in the plural ("plants"). */
  things: string;
  /** A nudge to go and look for them. */
  goOutside: string;
  /** Not on Google Play for everyone yet: shown as "coming soon" instead of a store link. */
  comingSoon?: boolean;
}

export const FAMILY_APPS: FamilyApp[] = [
  {
    id: 'floralock',
    name: 'FloraLock',
    packageName: 'com.floralock.app',
    emoji: '🌸',
    tagline: 'Learn the flowers, houseplants and trees around you.',
    things: 'plants',
    goOutside: 'Today, step outside and find one plant you’ve learned. 🌿',
    // Still in its closed test; set to false (or remove) once FloraLock is public on Google Play.
    comingSoon: true,
  },
  {
    id: 'shroomlock',
    name: 'ShroomLock',
    packageName: 'com.shroomlock.app',
    emoji: '🍄',
    tagline: 'Learn the mushrooms of woods, fields and lawns.',
    things: 'mushrooms',
    goOutside: 'After the next rain, take a walk and spot one mushroom you’ve learned. Look, don’t pick. 🍂',
  },
  {
    id: 'cloudlock',
    name: 'CloudLock',
    packageName: 'com.cloudlock.app',
    emoji: '☁️',
    tagline: 'Learn to read the clouds and the weather they bring.',
    things: 'clouds',
    goOutside: 'Today, look up and name one cloud you’ve learned. 🌤️',
  },
];

/** This app's entry in the family. */
export const THIS_APP_ID: FamilyApp['id'] = 'shroomlock';

export function thisApp(): FamilyApp {
  return FAMILY_APPS.find((a) => a.id === THIS_APP_ID)!;
}

export function sisterApps(): FamilyApp[] {
  return FAMILY_APPS.filter((a) => a.id !== THIS_APP_ID);
}

export function playStoreUrl(packageName: string): string {
  return `https://play.google.com/store/apps/details?id=${packageName}`;
}

/** The mission page on our website, with the ways to help (donations included). */
export const SUPPORT_URL = 'https://www.sinadehesh.com/support/';

/** What the phone reports about a sister app. */
export interface SisterStatus {
  packageName: string;
  installed: boolean;
  plus: boolean;
}

/** The sister app that earns this phone the family price, or null if none has Plus. */
export function familyPriceFrom(statuses: SisterStatus[]): FamilyApp | null {
  for (const app of sisterApps()) {
    if (statuses.some((s) => s.packageName === app.packageName && s.installed && s.plus)) return app;
  }
  return null;
}

/** "ShroomLock", "ShroomLock and CloudLock". */
export function listNames(apps: FamilyApp[]): string {
  const names = apps.map((a) => a.name);
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
