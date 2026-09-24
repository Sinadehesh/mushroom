import type { Mushroom } from './types';

/** Lowercase, strip accents/punctuation, collapse whitespace. "Jack-o'-Lantern!" -> "jack o lantern" */
export function normalizeName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Typos allowed for a name of this length: phones make exact spelling unreasonably harsh. */
export function allowedTypos(length: number): number {
  if (length <= 4) return 0;
  if (length <= 8) return 1;
  return 2;
}

export function acceptedNames(mushroom: Mushroom): string[] {
  const names = [mushroom.commonName, mushroom.scientificName, ...mushroom.aliases].map(normalizeName);
  return [...new Set(names)].filter(Boolean);
}

/**
 * Hard Mode check: tolerant of case, spacing, punctuation, plurals and small typos.
 * Pass `allMushrooms` so a guess that exactly names a *different* mushroom is never
 * accepted as a typo of this one (e.g. "morel" for "false morel").
 */
export function isCorrectAnswer(input: string, mushroom: Mushroom, allMushrooms: Mushroom[] = []): boolean {
  const guess = normalizeName(input);
  if (!guess) return false;
  const variants = new Set([guess, guess.replace(/s$/, ''), guess.replace(/es$/, '')]);
  const own = acceptedNames(mushroom);
  if (own.some((name) => variants.has(name))) return true;
  const namesOtherMushroom = allMushrooms.some(
    (other) => other.id !== mushroom.id && acceptedNames(other).some((name) => variants.has(name)),
  );
  if (namesOtherMushroom) return false;
  for (const name of own) {
    for (const v of variants) {
      if (levenshtein(v, name) <= allowedTypos(name.length)) return true;
    }
  }
  return false;
}
