/** Rough field groups by what's under the cap: the first thing you check when identifying a mushroom. */
export type MushroomCategory = 'gilled' | 'pored' | 'other';

/** Kitchen status, for learning only. Never eat a wild mushroom on an app's say-so. */
export type Edibility = 'choice' | 'edible' | 'inedible' | 'poisonous' | 'deadly';

export interface Mushroom {
  id: string;
  commonName: string;
  scientificName: string;
  family: string;
  category: MushroomCategory;
  edibility: Edibility;
  /** Other names accepted in Hard Mode (synonyms, old genus names, regional names). */
  aliases: string[];
  /** Ids of mushrooms it is commonly mistaken for. Easy Mode deals these as distractors first. */
  lookalikes: string[];
  /** One-sentence micro-fact shown during the Genius Penalty. */
  fact: string;
}

export type Difficulty = 'easy' | 'hard';

/** Per-mushroom learning record, keyed by mushroom id. */
export interface MushroomProgress {
  seen: number;
  correct: number;
  wrong: number;
  /** Leitner box: 0 = just missed / brand new, MAX_BOX = mastered. */
  box: number;
  /** Epoch ms when the mushroom is next due for review. */
  dueAt: number;
  lastSeenAt: number;
}

export type ProgressMap = Record<string, MushroomProgress>;

export interface Settings {
  difficulty: Difficulty;
  /** How long a correct answer unlocks the blocked app for. */
  unlockMinutes: number;
  penaltySeconds: number;
  /** Emergency bypasses per day, so a locked-out user doesn't uninstall. */
  emergencyUnlocksPerDay: number;
  categories: MushroomCategory[];
}

export const DEFAULT_SETTINGS: Settings = {
  difficulty: 'easy',
  unlockMinutes: 10,
  penaltySeconds: 10,
  emergencyUnlocksPerDay: 2,
  categories: ['gilled', 'pored', 'other'],
};
