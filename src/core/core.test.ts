import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { MUSHROOM_CLUES } from '../data/mushroomClues';
import { privacyHtml, privacyMarkdown } from '../data/privacyPolicy';
import { MUSHROOMS, MUSHROOMS_BY_ID } from '../data/mushrooms';
import { challengeReducer, penaltySecondsLeft, startChallenge } from './challenge';
import {
  addDays,
  dayKey,
  dueReviews,
  examMushrooms,
  lessonStudied,
  lockScreenPool,
  markStudied,
  MASTERED_STEP,
  MAX_REVIEWS_PER_DAY,
  pickLockMushroom,
  recordReview,
  recordStats,
  REVIEW_DAYS,
  reviewsDueOn,
  todaysNewMushrooms,
} from './daily';
import {
  allowedLockedApps,
  canLockAnother,
  deckCategories,
  FREE_APP_LIMIT,
  isReviewCode,
  normalizeCode,
  REVIEW_CODE_HASHES,
} from './plus';
import {
  collectedCount,
  currentStreak,
  extendStreak,
  masteredCount,
  milestones,
  nextMilestone,
  NO_STREAK,
} from './progress';
import { areLookalikes, buildChoices, lookalikesOf } from './quiz';
import { readSaved, SAVE_KEY, serializeSaved, type SavedState } from './saved';
import { sha256Hex } from './sha256';
import { mycologyIQ, troubleMushrooms } from './stats';
import { normalizeName } from './text';
import { DEFAULT_SETTINGS, type LearnMap, type StatsMap } from './types';

/** Deterministic PRNG so tests don't flake. */
function seeded(seed = 42) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const mushroom = (id: string) => MUSHROOMS_BY_ID[id];
const ids = (list: { id: string }[]) => list.map((m) => m.id);

describe('mushroom data', () => {
  it('has unique ids and complete entries', () => {
    expect(new Set(ids(MUSHROOMS)).size).toBe(MUSHROOMS.length);
    for (const m of MUSHROOMS) {
      expect(m.commonName && m.scientificName && m.family && m.fact).toBeTruthy();
    }
  });

  it('gives every mushroom its own common name, so a multiple-choice answer is never ambiguous', () => {
    const names = MUSHROOMS.map((m) => normalizeName(m.commonName));
    expect(new Set(names).size).toBe(names.length);
  });

  it('has field clues for exactly the mushrooms in the deck', () => {
    expect(Object.keys(MUSHROOM_CLUES).sort()).toEqual(ids(MUSHROOMS).sort());
    for (const clues of Object.values(MUSHROOM_CLUES)) {
      expect(Object.values(clues).every((v) => v.trim().length > 0)).toBe(true);
    }
  });

  it('has photos for every mushroom', () => {
    // Read as text: the generated file require()s images, which only Metro can load.
    const generated = readFileSync(new URL('../data/mushroomImages.generated.ts', import.meta.url), 'utf8');
    for (const m of MUSHROOMS) expect(generated).toContain(`"${m.id}": [`);
  });

  it('only lists look-alikes that exist', () => {
    for (const m of MUSHROOMS)
      for (const id of m.lookalikes) expect(MUSHROOMS_BY_ID[id], `${m.id} → ${id}`).toBeDefined();
  });

  it('never words a clue or fact as permission to eat', () => {
    const texts = [...MUSHROOMS.map((m) => m.fact), ...Object.values(MUSHROOM_CLUES).flatMap((c) => Object.values(c))];
    for (const t of texts) expect(t).not.toMatch(/\b(safe to eat|good to eat|you can eat|delicious)\b/i);
  });
});

describe('text', () => {
  it('normalizes case, accents and punctuation for search', () => {
    expect(normalizeName("  Jack-o'-lantern! ")).toBe('jack o lantern');
    expect(normalizeName('Cèpe')).toBe('cepe');
    expect(normalizeName("Dryad's Saddle")).toBe('dryads saddle');
  });
});

describe('look-alikes', () => {
  it('matches pairs listed on either side', () => {
    expect(areLookalikes(mushroom('chanterelle'), mushroom('jack-o-lantern'))).toBe(true);
    expect(areLookalikes(mushroom('jack-o-lantern'), mushroom('chanterelle'))).toBe(true);
    expect(areLookalikes(mushroom('morel'), mushroom('parasol'))).toBe(false);
    expect(ids(lookalikesOf(mushroom('chanterelle'), MUSHROOMS))).toEqual(
      expect.arrayContaining(['jack-o-lantern', 'deadly-webcap', 'false-chanterelle', 'hedgehog-mushroom']),
    );
  });

  it('deals real look-alikes first, from outside the deck too', () => {
    const deck = MUSHROOMS.filter((m) => m.category === 'other');
    const choices = buildChoices(mushroom('chanterelle'), deck, MUSHROOMS, 4, seeded());
    expect(choices).toHaveLength(4);
    expect(new Set(ids(choices)).size).toBe(4);
    expect(choices).toContain(mushroom('chanterelle'));
    // jack-o'-lantern and deadly webcap are gilled, so not in this deck, but still dealt.
    expect(
      ids(choices)
        .filter((id) => id !== 'chanterelle')
        .every((id) => areLookalikes(mushroom('chanterelle'), mushroom(id))),
    ).toBe(true);
  });

  it('tops up from the same group in the deck', () => {
    const deck = MUSHROOMS.filter((m) => m.category === 'pored');
    for (let seed = 1; seed < 10; seed++) {
      const choices = buildChoices(mushroom('turkey-tail'), deck, MUSHROOMS, 4, seeded(seed));
      expect(choices.every((m) => m.category === 'pored')).toBe(true);
    }
  });
});

describe('daily plan and spaced reviews', () => {
  const deck = MUSHROOMS.slice(0, 6);
  const DAY1 = '2026-10-01';
  const DAY2 = '2026-10-02';

  it('writes zero-padded local days that sort as strings, and adds days across months', () => {
    expect(dayKey(new Date(2026, 8, 30, 23, 59).getTime())).toBe('2026-09-30');
    expect(dayKey(new Date(2026, 9, 1, 0, 1).getTime())).toBe('2026-10-01');
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it("offers the next unlearned mushrooms as today's lesson, and keeps them once studied", () => {
    expect(ids(todaysNewMushrooms(deck, {}, DAY1, 2))).toEqual(ids(deck.slice(0, 2)));
    const learn = markStudied({}, ids(deck.slice(0, 2)), DAY1);
    expect(lessonStudied(deck, learn, DAY1)).toBe(true);
    expect(ids(todaysNewMushrooms(deck, learn, DAY1, 4))).toEqual(ids(deck.slice(0, 2)));
    expect(ids(todaysNewMushrooms(deck, learn, DAY2, 2))).toEqual(ids(deck.slice(2, 4)));
    expect(lessonStudied(deck, learn, DAY2)).toBe(false);
  });

  it('reviews after 1, 3, 7, 14 and 30 days, then counts the mushroom as mastered', () => {
    const [a] = deck;
    let learn = markStudied({}, [a.id], DAY1);
    let day = DAY1;
    expect(learn[a.id]).toEqual({ learnedOn: DAY1, step: 0, dueOn: DAY2 });
    // Right answers on the lesson day, or before a review is due, change nothing.
    expect(recordReview(learn, a.id, true, DAY1)).toBe(learn);
    for (const gap of REVIEW_DAYS) {
      day = addDays(day, gap);
      expect(learn[a.id].dueOn).toBe(day);
      expect(recordReview(learn, a.id, true, addDays(day, -1))).toBe(learn);
      expect(ids(dueReviews(deck, learn, day))).toEqual([a.id]);
      learn = recordReview(learn, a.id, true, day);
    }
    expect(learn[a.id].step).toBe(MASTERED_STEP);
    expect(masteredCount(deck, learn)).toBe(1);
    expect(dueReviews(deck, learn, addDays(day, 365))).toEqual([]);
  });

  it('starts the schedule over from tomorrow after a miss, at any time', () => {
    const [a] = deck;
    let learn = markStudied({}, [a.id], DAY1);
    learn = recordReview(learn, a.id, true, DAY2); // step 1, due in 3 days
    expect(learn[a.id]).toMatchObject({ step: 1, dueOn: addDays(DAY2, 3) });
    learn = recordReview(learn, a.id, false, addDays(DAY2, 1)); // missed on the lock screen
    expect(learn[a.id]).toMatchObject({ step: 0, dueOn: addDays(DAY2, 2) });
  });

  it('reviews a late mushroom on the day it is opened, not on every missed day', () => {
    const [a] = deck;
    let learn = markStudied({}, [a.id], DAY1);
    const late = addDays(DAY1, 10);
    expect(ids(dueReviews(deck, learn, late))).toEqual([a.id]);
    learn = recordReview(learn, a.id, true, late);
    expect(learn[a.id]).toMatchObject({ step: 1, dueOn: addDays(late, 3) });
  });

  it('caps a day of reviews, most overdue first', () => {
    const many = MUSHROOMS.slice(0, MAX_REVIEWS_PER_DAY + 5);
    const learn: LearnMap = Object.fromEntries(
      many.map((m, i) => [m.id, { learnedOn: DAY1, step: 0, dueOn: addDays(DAY2, i % 3) }]),
    );
    const today = addDays(DAY2, 5);
    const due = dueReviews(many, learn, today);
    expect(due).toHaveLength(MAX_REVIEWS_PER_DAY);
    expect(due.map((m) => learn[m.id].dueOn)).toEqual([...due.map((m) => learn[m.id].dueOn)].sort());
    expect(reviewsDueOn(many, learn, today)).toBe(MAX_REVIEWS_PER_DAY);
  });

  it("examines today's new mushrooms and today's reviews", () => {
    let learn = markStudied({}, ids(deck.slice(0, 2)), DAY1);
    expect(ids(examMushrooms(deck, learn, DAY1, 2))).toEqual(ids(deck.slice(0, 2)));
    expect(ids(examMushrooms(deck, learn, DAY2, 2))).toEqual(ids(deck.slice(0, 2)));
    learn = markStudied(learn, ids(deck.slice(2, 4)), DAY2);
    expect(ids(examMushrooms(deck, learn, DAY2, 2))).toEqual(ids([deck[2], deck[3], deck[0], deck[1]]));
  });

  it('keeps the lock screen on what is due, then on anything learned', () => {
    expect(ids(lockScreenPool(deck, {}, DAY1, 2))).toEqual(ids(deck.slice(0, 2)));
    let learn = markStudied({}, [deck[0].id], DAY1);
    expect(ids(lockScreenPool(deck, learn, DAY1, 1))).toEqual([deck[0].id]);
    learn = recordReview(learn, deck[0].id, true, DAY2);
    // Day 2, review done, lesson not studied yet: nothing due, so anything learned.
    expect(ids(lockScreenPool(deck, learn, DAY2, 1))).toEqual([deck[0].id]);
  });

  it('asks mushrooms not yet answered right today first, never twice in a row', () => {
    const pool = deck.slice(0, 3);
    expect(pickLockMushroom(pool, new Set([pool[0].id, pool[1].id]), seeded()).id).toBe(pool[2].id);
    for (let i = 0; i < 20; i++) {
      expect(pickLockMushroom(pool, new Set(), seeded(i + 1), pool[0].id).id).not.toBe(pool[0].id);
    }
    expect(pickLockMushroom([pool[0]], new Set(), seeded(), pool[0].id).id).toBe(pool[0].id);
  });
});

describe('streaks and milestones', () => {
  it('grows a streak day by day and restarts it after a missed day', () => {
    let streak = extendStreak(NO_STREAK, '2026-10-01');
    expect(streak).toEqual({ last: '2026-10-01', count: 1, best: 1 });
    expect(extendStreak(streak, '2026-10-01')).toBe(streak);
    streak = extendStreak(streak, '2026-10-02');
    streak = extendStreak(streak, '2026-10-03');
    expect(streak).toEqual({ last: '2026-10-03', count: 3, best: 3 });
    expect(currentStreak(streak, '2026-10-04')).toBe(3); // still alive until today's exam
    expect(currentStreak(streak, '2026-10-05')).toBe(0);
    streak = extendStreak(streak, '2026-10-05');
    expect(streak).toEqual({ last: '2026-10-05', count: 1, best: 3 });
  });

  it('marks milestones done and points at the closest next one', () => {
    const list = milestones({ collected: 8, mastered: 0, bestStreak: 3, total: 71 });
    expect(list.find((m) => m.id === 'collect-1')?.done).toBe(true);
    expect(list.find((m) => m.id === 'streak-3')?.done).toBe(true);
    expect(list.find((m) => m.id === 'collect-10')).toMatchObject({ done: false, value: 8, target: 10 });
    expect(nextMilestone(list)?.id).toBe('collect-10');
  });

  it('counts the collection', () => {
    const learn = markStudied({}, ['parasol', 'morel'], '2026-10-01');
    expect(collectedCount(MUSHROOMS, learn)).toBe(2);
    expect(masteredCount(MUSHROOMS, learn)).toBe(0);
  });
});

describe('challenge (Genius Penalty)', () => {
  const answer = (correct: boolean, now: number) =>
    ({ type: 'answer', correct, guess: 'x', now, penaltySeconds: 10 }) as const;

  it('unlocks on a correct answer', () => {
    const s = challengeReducer(startChallenge('death-cap'), answer(true, 0));
    expect(s).toEqual({ phase: 'unlocked', mushroomId: 'death-cap', attempts: 1 });
  });

  it('freezes for the penalty and ignores taps and early retries', () => {
    let s = challengeReducer(startChallenge('death-cap'), answer(false, 0));
    expect(s.phase).toBe('penalty');
    expect(penaltySecondsLeft(s, 0)).toBe(10);
    expect(penaltySecondsLeft(s, 9_001)).toBe(1);

    expect(challengeReducer(s, answer(true, 5_000))).toBe(s); // speed-run tap ignored
    expect(challengeReducer(s, { type: 'retry', now: 9_999, nextMushroomId: 'parasol' })).toBe(s);

    s = challengeReducer(s, { type: 'retry', now: 10_000, nextMushroomId: 'parasol' });
    expect(s).toEqual({ phase: 'question', mushroomId: 'parasol', attempts: 1 });
  });
});

describe('stats', () => {
  it('scores Mycology IQ from 60 to 160: a fifth for collected, the rest grows with each review', () => {
    const subset = [mushroom('death-cap'), mushroom('parasol')];
    expect(mycologyIQ(subset, {})).toBe(60);
    const mastered: LearnMap = {
      'death-cap': { learnedOn: '2026-10-01', step: MASTERED_STEP, dueOn: '' },
      parasol: { learnedOn: '2026-10-01', step: MASTERED_STEP, dueOn: '' },
    };
    expect(mycologyIQ(subset, mastered)).toBe(160);
    const fresh = { ...mastered, parasol: { learnedOn: '2026-10-01', step: 0, dueOn: '2026-10-02' } };
    expect(mycologyIQ(subset, fresh)).toBe(120);
  });

  it('ranks trouble mushrooms by miss rate', () => {
    let stats: StatsMap = {};
    stats = recordStats(stats, 'parasol', true);
    stats = recordStats(stats, 'parasol', false); // 1/2 wrong
    stats = recordStats(stats, 'death-cap', false); // 1/1 wrong
    stats = recordStats(stats, 'morel', true);
    expect(stats.parasol).toEqual({ seen: 2, correct: 1, wrong: 1 });
    expect(troubleMushrooms(MUSHROOMS, stats).map((m) => m.id)).toEqual(['death-cap', 'parasol']);
  });
});

describe('ShroomLock Plus', () => {
  it('keeps the free deck to the gilled mushrooms and never leaves it empty', () => {
    expect(deckCategories(['gilled', 'pored', 'other'], false)).toEqual(['gilled']);
    expect(deckCategories(['other'], false)).toEqual(['gilled']);
    expect(deckCategories(['pored', 'other'], true)).toEqual(['pored', 'other']);
    expect(deckCategories([], true)).toEqual(['gilled']);
  });

  it(`locks up to ${FREE_APP_LIMIT} apps for free, any number with Plus`, () => {
    expect(canLockAnother(FREE_APP_LIMIT - 1, false)).toBe(true);
    expect(canLockAnother(FREE_APP_LIMIT, false)).toBe(false);
    expect(canLockAnother(50, true)).toBe(true);
    expect(allowedLockedApps(['a', 'b', 'c'], false)).toEqual(['a', 'b']);
    expect(allowedLockedApps(['a', 'b', 'c'], true)).toEqual(['a', 'b', 'c']);
  });
});

describe('review codes', () => {
  it('computes SHA-256 like the standard test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('accepts a code whatever its case, spaces or dashes, and rejects others', () => {
    const hashes = [sha256Hex('SHROOMTEST1234ABCD')];
    expect(normalizeCode(' shroom-test 1234-abcd ')).toBe('SHROOMTEST1234ABCD');
    expect(isReviewCode('shroom-test-1234-abcd', hashes)).toBe(true);
    expect(isReviewCode('SHROOM-TEST-1234-ABCE', hashes)).toBe(false);
    expect(isReviewCode('', hashes)).toBe(false);
    expect(REVIEW_CODE_HASHES.every((h) => /^[0-9a-f]{64}$/.test(h))).toBe(true);
  });
});

describe('privacy policy', () => {
  it('PRIVACY.md matches the in-app policy (run `npm run privacy` after editing it)', () => {
    const file = readFileSync(new URL('../../PRIVACY.md', import.meta.url), 'utf8');
    expect(file).toBe(privacyMarkdown());
  });

  it('the public web page matches the in-app policy (run `npm run privacy` after editing it)', () => {
    for (const path of ['privacy/index.html', 'shroomlock/privacy/index.html']) {
      expect(readFileSync(new URL(`../../site/${path}`, import.meta.url), 'utf8')).toBe(privacyHtml());
    }
    const page = privacyHtml();
    expect(page).toContain('<a href="https://github.com/Sinadehesh/mushroom/issues">');
  });
});

describe('saved progress across app updates', () => {
  const saved: SavedState = {
    settings: { ...DEFAULT_SETTINGS, mushroomsPerDay: 3, categories: ['gilled'], onboarded: true },
    learn: {
      parasol: { learnedOn: '2026-10-01', step: 1, dueOn: '2026-10-05' },
      morel: { learnedOn: '2026-10-02', step: 0, dueOn: '2026-10-03' },
    },
    stats: { parasol: { seen: 4, correct: 3, wrong: 1 } },
    today: { day: '2026-10-02', correct: ['parasol'] },
    examDoneOn: '2026-10-02',
    streak: { last: '2026-10-02', count: 2, best: 5 },
    emergency: { day: '2026-10-02', used: 1 },
    plus: true,
    codeUnlock: false,
  };

  it('keeps the storage key (a new key would start every user from scratch)', () => {
    expect(SAVE_KEY).toBe('shroomlock/v1');
  });

  it('reads back what it saves', () => {
    expect(readSaved(serializeSaved(saved))).toEqual({ state: saved, unreadable: false });
  });

  it('reads saves from releases before versioning', () => {
    expect(readSaved(JSON.stringify(saved)).state).toEqual(saved);
  });

  it('fills settings added in later releases with defaults', () => {
    const { onboarded: _, ...older } = saved.settings;
    const { state } = readSaved(JSON.stringify({ ...saved, settings: older }));
    expect(state.settings).toEqual({ ...saved.settings, onboarded: DEFAULT_SETTINGS.onboarded });
    expect(state.learn).toEqual(saved.learn);
  });

  it('drops only the values that are invalid', () => {
    const { state } = readSaved(
      JSON.stringify({
        ...saved,
        settings: { ...saved.settings, mushroomsPerDay: 99, unlockMinutes: 'ten', categories: ['cactus', 'other'] },
        learn: { ...saved.learn, broken: { learnedOn: '2026-10-01', repeated: true } },
        stats: { ...saved.stats, broken: { seen: -1, correct: 0, wrong: 0 } },
        plus: 'yes',
      }),
    );
    expect(state.settings).toEqual({ ...saved.settings, mushroomsPerDay: 10, categories: ['other'] });
    expect(state.learn).toEqual(saved.learn);
    expect(state.stats).toEqual(saved.stats);
    expect(state.plus).toBeUndefined();
    expect(state.examDoneOn).toBe(saved.examDoneOn);
  });

  it('reports storage that holds something other than a save', () => {
    expect(readSaved(null)).toEqual({ state: {}, unreadable: false });
    expect(readSaved('{not json')).toEqual({ state: {}, unreadable: true });
    expect(readSaved('[1,2]')).toEqual({ state: {}, unreadable: true });
  });
});
