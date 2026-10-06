/** Field groups by what's under the cap: the first thing you check when you pick a mushroom up. */
export type MushroomCategory = 'gilled' | 'pored' | 'other';

/** Kitchen status, for learning only. Never eat a wild mushroom on an app's say-so. */
export type Edibility = 'choice' | 'edible' | 'inedible' | 'poisonous' | 'deadly';

/** How to recognise a mushroom in the field. */
export interface Clues {
  cap: string;
  /** Gills, pores, spines or ridges. */
  underside: string;
  /** Stem, ring and base (a volva, a bulb, a root). */
  stem: string;
  sporePrint: string;
  habitat: string;
  season: string;
  /** The one feature that tells it apart from its look-alikes. */
  key: string;
}

export interface Mushroom {
  id: string;
  commonName: string;
  scientificName: string;
  family: string;
  category: MushroomCategory;
  edibility: Edibility;
  /** Other names the mushroom goes by (synonyms, old genus names, regional names). */
  aliases: string[];
  /** Ids of mushrooms it is commonly mistaken for. Listing one side of a pair is enough. */
  lookalikes: string[];
  /** One-sentence micro-fact shown during the Genius Penalty. */
  fact: string;
}

/** Answer history for one mushroom, keyed by mushroom id. */
export interface MushroomStats {
  seen: number;
  correct: number;
  wrong: number;
}

export type StatsMap = Record<string, MushroomStats>;

/**
 * Where a mushroom is in the review schedule (see daily.ts). It's introduced in a lesson on
 * `learnedOn`; each right answer on or after its due day moves it one `step` further out, and a
 * miss starts the schedule over from tomorrow.
 */
export interface LearnRecord {
  learnedOn: string;
  step: number;
  dueOn: string;
}

export type LearnMap = Record<string, LearnRecord>;

/** Days in a row with the lesson's exam done. */
export interface Streak {
  /** Last day the exam was done ("" if never). */
  last: string;
  count: number;
  best: number;
}

export interface Settings {
  /** New mushrooms introduced in each day's lesson. */
  mushroomsPerDay: number;
  /** How long a correct answer unlocks the blocked app for. */
  unlockMinutes: number;
  penaltySeconds: number;
  /** Emergency bypasses per day, so a locked-out user doesn't uninstall. */
  emergencyUnlocksPerDay: number;
  categories: MushroomCategory[];
  /** First-launch setup finished. */
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  mushroomsPerDay: 3,
  unlockMinutes: 10,
  penaltySeconds: 10,
  emergencyUnlocksPerDay: 2,
  categories: ['gilled', 'pored', 'other'],
  onboarded: false,
};

export const MUSHROOMS_PER_DAY_MIN = 1;
export const MUSHROOMS_PER_DAY_MAX = 10;
