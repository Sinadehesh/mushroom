import { describe, expect, it } from 'vitest';

import { MUSHROOMS, MUSHROOMS_BY_ID } from '../data/mushrooms';
import { challengeReducer, penaltySecondsLeft, startChallenge } from './challenge';
import { acceptedNames, isCorrectAnswer, levenshtein, normalizeName } from './matching';
import { buildChoices, lookalikesOf } from './quiz';
import { BOX_INTERVALS, MAX_BOX, pickNextMushroom, recordAnswer } from './srs';
import { mycologyIQ, troubleMushrooms } from './stats';
import type { ProgressMap } from './types';

/** Deterministic PRNG so tests don't flake. */
function seeded(seed = 42) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const mushroom = (id: string) => MUSHROOMS_BY_ID[id];

describe('mushroom data', () => {
  it('has unique ids and complete entries', () => {
    expect(new Set(MUSHROOMS.map((m) => m.id)).size).toBe(MUSHROOMS.length);
    for (const m of MUSHROOMS) {
      expect(m.commonName && m.scientificName && m.family && m.edibility && m.fact).toBeTruthy();
    }
  });

  it('never accepts the same name for two different mushrooms', () => {
    const owner = new Map<string, string>();
    for (const m of MUSHROOMS) {
      for (const name of acceptedNames(m)) {
        expect(owner.get(name) ?? m.id, `"${name}" is used by ${owner.get(name)} and ${m.id}`).toBe(m.id);
        owner.set(name, m.id);
      }
    }
  });

  it('only lists look-alikes that exist, never itself', () => {
    for (const m of MUSHROOMS) {
      for (const id of m.lookalikes) {
        expect(MUSHROOMS_BY_ID[id], `${m.id} lists unknown look-alike "${id}"`).toBeDefined();
        expect(id).not.toBe(m.id);
      }
    }
  });

  it('pairs every deadly mushroom it can with an edible look-alike', () => {
    expect(lookalikesOf(mushroom('death-cap'), MUSHROOMS).map((m) => m.id)).toContain('caesars-mushroom');
    expect(lookalikesOf(mushroom('false-morel'), MUSHROOMS).map((m) => m.id)).toEqual(['morel']);
    expect(lookalikesOf(mushroom('funeral-bell'), MUSHROOMS).map((m) => m.id)).toEqual([
      'honey-fungus',
      'velvet-shank',
    ]);
  });
});

describe('matching', () => {
  it('normalizes case, accents and punctuation', () => {
    expect(normalizeName("  Jack-o'-Lantern! ")).toBe('jack o lantern');
    expect(normalizeName('Pied de Moutón')).toBe('pied de mouton');
    expect(normalizeName("Lion's Mane")).toBe('lions mane');
  });

  it('computes edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
  });

  it('accepts common names, aliases, scientific names, plurals and small typos', () => {
    expect(isCorrectAnswer('chanterelle', mushroom('chanterelle'))).toBe(true);
    expect(isCorrectAnswer('Chanterelles', mushroom('chanterelle'))).toBe(true);
    expect(isCorrectAnswer('girolle', mushroom('chanterelle'))).toBe(true);
    expect(isCorrectAnswer('Cantharellus cibarius', mushroom('chanterelle'))).toBe(true);
    expect(isCorrectAnswer('penny bun', mushroom('porcini'))).toBe(true);
    expect(isCorrectAnswer('Morels', mushroom('morel'))).toBe(true);
    expect(isCorrectAnswer('chantarelle', mushroom('chanterelle'))).toBe(true);
    expect(isCorrectAnswer('maitake', mushroom('hen-of-the-woods'))).toBe(true);
    expect(isCorrectAnswer('lions mane', mushroom('lions-mane'))).toBe(true);
  });

  it('rejects wrong or empty answers', () => {
    expect(isCorrectAnswer('', mushroom('morel'))).toBe(false);
    expect(isCorrectAnswer('parasol', mushroom('death-cap'))).toBe(false);
    expect(isCorrectAnswer('chanterelle', mushroom('jack-o-lantern'))).toBe(false);
    // short names get no typo allowance
    expect(isCorrectAnswer('cap', mushroom('porcini'))).toBe(false); // not "cep"
  });

  it("doesn't treat a look-alike's exact name as a typo", () => {
    // "cinder conk" (chaga) is one letter off "tinder conk" (tinder fungus)
    expect(isCorrectAnswer('cinder conk', mushroom('tinder-fungus'))).toBe(true);
    expect(isCorrectAnswer('cinder conk', mushroom('tinder-fungus'), MUSHROOMS)).toBe(false);
    expect(isCorrectAnswer('tindr conk', mushroom('tinder-fungus'), MUSHROOMS)).toBe(true);
    expect(isCorrectAnswer('morel', mushroom('false-morel'), MUSHROOMS)).toBe(false);
    expect(isCorrectAnswer('parasol', mushroom('false-parasol'), MUSHROOMS)).toBe(false);
    expect(isCorrectAnswer('false parasols', mushroom('false-parasol'), MUSHROOMS)).toBe(true);
  });
});

describe('quiz choices', () => {
  it('returns 4 unique options including the answer', () => {
    const answer = mushroom('turkey-tail');
    const choices = buildChoices(answer, MUSHROOMS, 4, seeded());
    expect(choices).toHaveLength(4);
    expect(new Set(choices.map((c) => c.id)).size).toBe(4);
    expect(choices).toContain(answer);
    // turkey tail has no look-alikes, so its distractors come from the same category
    expect(choices.every((c) => c.category === 'pored')).toBe(true);
  });

  it('deals look-alikes first, in both directions, even across categories', () => {
    const chanterelle = mushroom('chanterelle');
    // chanterelle lists none itself; jack-o'-lantern and friends list it, and most are gilled
    const lookalikes = lookalikesOf(chanterelle, MUSHROOMS).map((m) => m.id);
    expect(lookalikes).toEqual(
      expect.arrayContaining(['jack-o-lantern', 'false-chanterelle', 'deadly-webcap', 'hedgehog-mushroom']),
    );
    const distractors = buildChoices(chanterelle, MUSHROOMS, 4, seeded())
      .map((c) => c.id)
      .filter((id) => id !== 'chanterelle');
    expect(distractors).toHaveLength(3);
    expect(distractors.every((id) => lookalikes.includes(id))).toBe(true);

    // one look-alike, topped up from the same category
    const morel = buildChoices(mushroom('morel'), MUSHROOMS, 4, seeded());
    expect(morel.map((c) => c.id)).toContain('false-morel');
    expect(morel.every((c) => c.category === 'other')).toBe(true);
  });
});

describe('spaced repetition', () => {
  it('promotes on correct and resets to box 0 on wrong', () => {
    let p = recordAnswer(undefined, true, 0);
    expect(p.box).toBe(1);
    expect(p.dueAt).toBe(BOX_INTERVALS[1]);
    p = recordAnswer(p, true, 1000);
    expect(p.box).toBe(2);
    p = recordAnswer(p, false, 2000);
    expect(p).toMatchObject({ box: 0, seen: 3, correct: 2, wrong: 1, dueAt: 2000 + BOX_INTERVALS[0] });
  });

  it('caps at the max box', () => {
    let p = recordAnswer(undefined, true, 0);
    for (let i = 0; i < 20; i++) p = recordAnswer(p, true, 0);
    expect(p.box).toBe(MAX_BOX);
  });

  it('prefers overdue weak mushrooms, then unseen, then soonest due', () => {
    const now = 1_000_000;
    const progress: ProgressMap = {
      morel: { ...recordAnswer(undefined, false, 0), dueAt: now - 1 }, // due, box 0
      porcini: { ...recordAnswer(undefined, true, 0), box: 3, dueAt: now - 1 }, // due, box 3
    };
    expect(pickNextMushroom(MUSHROOMS, progress, now, seeded()).id).toBe('morel');
    expect(pickNextMushroom(MUSHROOMS, progress, now, seeded(), 'morel').id).toBe('porcini');

    const subset = [mushroom('morel'), mushroom('porcini'), mushroom('chanterelle')];
    const notDue: ProgressMap = {
      morel: { ...progress.morel, dueAt: now + 5000 },
      porcini: { ...progress.porcini, dueAt: now + 100 },
    };
    expect(pickNextMushroom(subset, notDue, now, seeded()).id).toBe('chanterelle');
    notDue.chanterelle = { ...progress.morel, dueAt: now + 9000 };
    expect(pickNextMushroom(subset, notDue, now, seeded()).id).toBe('porcini');
  });
});

describe('challenge (Genius Penalty)', () => {
  const answer = (correct: boolean, now: number) =>
    ({ type: 'answer', correct, guess: 'x', now, penaltySeconds: 10 }) as const;

  it('unlocks on a correct answer', () => {
    const s = challengeReducer(startChallenge('morel'), answer(true, 0));
    expect(s).toEqual({ phase: 'unlocked', mushroomId: 'morel', attempts: 1 });
  });

  it('freezes for the penalty and ignores taps and early retries', () => {
    let s = challengeReducer(startChallenge('morel'), answer(false, 0));
    expect(s.phase).toBe('penalty');
    expect(penaltySecondsLeft(s, 0)).toBe(10);
    expect(penaltySecondsLeft(s, 9_001)).toBe(1);

    expect(challengeReducer(s, answer(true, 5_000))).toBe(s); // speed-run tap ignored
    expect(challengeReducer(s, { type: 'retry', now: 9_999, nextMushroomId: 'porcini' })).toBe(s);

    s = challengeReducer(s, { type: 'retry', now: 10_000, nextMushroomId: 'porcini' });
    expect(s).toEqual({ phase: 'question', mushroomId: 'porcini', attempts: 1 });
  });
});

describe('stats', () => {
  it('scores Mycology IQ from 60 to 160', () => {
    const subset = [mushroom('morel'), mushroom('porcini')];
    expect(mycologyIQ(subset, {})).toBe(60);
    const mastered = { ...recordAnswer(undefined, true, 0), box: MAX_BOX };
    expect(mycologyIQ(subset, { morel: mastered, porcini: mastered })).toBe(160);
    expect(mycologyIQ(subset, { morel: mastered })).toBe(110);
  });

  it('ranks trouble mushrooms by miss rate', () => {
    const progress: ProgressMap = {
      morel: recordAnswer(recordAnswer(undefined, true, 0), false, 0), // 1/2 wrong
      porcini: recordAnswer(undefined, false, 0), // 1/1 wrong
      chanterelle: recordAnswer(undefined, true, 0),
    };
    expect(troubleMushrooms(MUSHROOMS, progress).map((m) => m.id)).toEqual(['porcini', 'morel']);
  });
});
