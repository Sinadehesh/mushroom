/**
 * Saved progress, and reading it back after an app update.
 *
 * Android keeps an app's storage when the app is updated, so every release must read what older
 * releases wrote:
 *  - Never change SAVE_KEY: a new key would start every user from scratch.
 *  - When the saved shape changes, bump SAVE_VERSION and convert older data in `migrate`.
 *  - Values that don't check out fall back to their defaults one by one, so a single odd value
 *    never costs the rest of the progress.
 */
import {
  DEFAULT_SETTINGS,
  MUSHROOMS_PER_DAY_MAX,
  MUSHROOMS_PER_DAY_MIN,
  type LearnMap,
  type MushroomCategory,
  type Settings,
  type StatsMap,
  type Streak,
} from './types';

export const SAVE_KEY = 'shroomlock/v1';
/** Saves without a version come from releases before versioning, which wrote the version 1 shape. */
export const SAVE_VERSION = 1;

export interface SavedState {
  settings: Settings;
  learn: LearnMap;
  stats: StatsMap;
  /** Days in a row with the exam done. */
  streak: Streak;
  /** Mushrooms answered right today, so the lock screen moves on to the others. */
  today: { day: string; correct: string[] };
  /** Day the user last finished the lesson's exam. */
  examDoneOn: string;
  emergency: { day: string; used: number };
  /** Owns ShroomLock Plus (last answer from Google Play, kept for offline use). */
  plus: boolean;
  /** Plus unlocked on this phone with a review code (for Google Play's app review). */
  codeUnlock: boolean;
}

export function serializeSaved(state: SavedState): string {
  return JSON.stringify({ version: SAVE_VERSION, ...state });
}

/**
 * Reads a save. Missing or invalid values are left out, so the store's defaults fill them in.
 * `unreadable` means something was stored but it isn't a save at all; keep a copy before
 * writing over it.
 */
export function readSaved(raw: string | null): { state: Partial<SavedState>; unreadable: boolean } {
  if (raw === null) return { state: {}, unreadable: false };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { state: {}, unreadable: true };
  }
  if (!isObject(data)) return { state: {}, unreadable: true };
  return { state: validate(migrate(data)), unreadable: false };
}

/** Converts a save written by an older release to the current shape. */
function migrate(data: Record<string, unknown>): Record<string, unknown> {
  // Nothing to convert yet. When the shape changes, bump SAVE_VERSION and add a step here, e.g.
  //   const version = typeof data.version === 'number' ? data.version : 1;
  //   if (version < 2) data = { ...data, newName: data.oldName };
  return data;
}

const CATEGORIES: readonly MushroomCategory[] = ['gilled', 'pored', 'other'];

function validate(data: Record<string, unknown>): Partial<SavedState> {
  const out: Partial<SavedState> = {};
  if (isObject(data.settings)) out.settings = readSettings(data.settings);
  if (isObject(data.learn)) out.learn = readLearn(data.learn);
  if (isObject(data.stats)) out.stats = readStats(data.stats);
  if (isObject(data.today) && typeof data.today.day === 'string' && Array.isArray(data.today.correct)) {
    out.today = { day: data.today.day, correct: data.today.correct.filter(isString) };
  }
  if (typeof data.examDoneOn === 'string') out.examDoneOn = data.examDoneOn;
  if (isObject(data.streak)) {
    const { last, count, best } = data.streak;
    if (typeof last === 'string' && isCount(count) && isCount(best)) out.streak = { last, count, best };
  }
  if (isObject(data.emergency) && typeof data.emergency.day === 'string' && isCount(data.emergency.used)) {
    out.emergency = { day: data.emergency.day, used: data.emergency.used };
  }
  if (typeof data.plus === 'boolean') out.plus = data.plus;
  if (typeof data.codeUnlock === 'boolean') out.codeUnlock = data.codeUnlock;
  return out;
}

function readSettings(s: Record<string, unknown>): Settings {
  const settings = { ...DEFAULT_SETTINGS };
  if (isCount(s.mushroomsPerDay)) {
    settings.mushroomsPerDay = Math.min(
      MUSHROOMS_PER_DAY_MAX,
      Math.max(MUSHROOMS_PER_DAY_MIN, Math.round(s.mushroomsPerDay)),
    );
  }
  if (isCount(s.unlockMinutes) && s.unlockMinutes > 0) settings.unlockMinutes = s.unlockMinutes;
  if (isCount(s.penaltySeconds)) settings.penaltySeconds = s.penaltySeconds;
  if (isCount(s.emergencyUnlocksPerDay)) settings.emergencyUnlocksPerDay = s.emergencyUnlocksPerDay;
  if (Array.isArray(s.categories)) {
    const categories = CATEGORIES.filter((c) => (s.categories as unknown[]).includes(c));
    if (categories.length) settings.categories = categories;
  }
  if (typeof s.onboarded === 'boolean') settings.onboarded = s.onboarded;
  return settings;
}

function readLearn(learn: Record<string, unknown>): LearnMap {
  const out: LearnMap = {};
  for (const [id, r] of Object.entries(learn)) {
    if (isObject(r) && typeof r.learnedOn === 'string' && isCount(r.step) && typeof r.dueOn === 'string') {
      out[id] = { learnedOn: r.learnedOn, step: Math.round(r.step), dueOn: r.dueOn };
    }
  }
  return out;
}

function readStats(stats: Record<string, unknown>): StatsMap {
  const out: StatsMap = {};
  for (const [id, s] of Object.entries(stats)) {
    if (isObject(s) && isCount(s.seen) && isCount(s.correct) && isCount(s.wrong)) {
      out[id] = { seen: s.seen, correct: s.correct, wrong: s.wrong };
    }
  }
  return out;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
