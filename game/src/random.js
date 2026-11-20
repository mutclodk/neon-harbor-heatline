/**
 * Seeded deterministic randomness module using the mulberry32 algorithm.
 */

export function makeRng(seed) {
  let state = seed >>> 0;

  function nextFloat() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(min, max) {
    return Math.floor(nextFloat() * (max - min)) + min;
  }

  function range(min, max) {
    return nextFloat() * (max - min) + min;
  }

  function chance(p = 0.5) {
    return nextFloat() < p;
  }

  function choice(array) {
    if (!array || array.length === 0) return undefined;
    return array[int(0, array.length)];
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = int(0, i + 1);
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }

  return {
    next: nextFloat,
    float: nextFloat,
    int,
    integer: int,
    range,
    floatRange: range,
    chance,
    bool: chance,
    choice,
    pick: choice,
    shuffle
  };
}

export function deriveSeed(baseSeed, streamTag) {
  let s = (baseSeed ^ Math.imul(streamTag, 0x9e3779b9)) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x85ebca6b) >>> 0;
  s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35) >>> 0;
  return (s ^ (s >>> 16)) >>> 0;
}
