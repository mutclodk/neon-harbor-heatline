// Mulberry32 deterministic pseudo-random generator and seeded stream helpers.
// Guaranteed byte-identical sequences across browsers and Node runtimes.

export function createRandom(seed = 20261124) {
  let s = (seed >>> 0) || 1;

  function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(min, max) {
    return Math.floor(next() * (max - min + 1)) + min;
  }

  function float(min, max) {
    return min + next() * (max - min);
  }

  function choice(array) {
    if (!array || array.length === 0) return null;
    return array[Math.floor(next() * array.length)];
  }

  function shuffle(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  function fork(streamOffset = 10007) {
    const derivedSeed = (Math.imul(s ^ streamOffset, 0x5bd1e995) >>> 0) || 1;
    return createRandom(derivedSeed);
  }

  return { next, int, float, choice, shuffle, fork };
}
