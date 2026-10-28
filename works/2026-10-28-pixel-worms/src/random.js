// Seeded random numbers and value noise. The sim and the world layout never call Math.random.
export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range: (low, high) => low + (high - low) * next(),
    int: (count) => Math.floor(next() * count),
    pick: (list) => list[Math.floor(next() * list.length)],
  };
}

function latticeHash(ix, iz, seed) {
  let value = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 2147483647)) | 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise(x, z, seed = 0) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = latticeHash(ix, iz, seed);
  const b = latticeHash(ix + 1, iz, seed);
  const c = latticeHash(ix, iz + 1, seed);
  const d = latticeHash(ix + 1, iz + 1, seed);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sz;
}

export function fractalNoise(x, z, seed = 0, octaves = 3) {
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  for (let octave = 0; octave < octaves; octave++) {
    total += amplitude * valueNoise(x * frequency, z * frequency, seed + octave * 17);
    amplitude *= 0.5;
    frequency *= 2;
  }
  return total / (1 - Math.pow(0.5, octaves));
}

export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const smoothstep = (low, high, value) => {
  const t = clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};
export const lerp = (from, to, amount) => from + (to - from) * amount;
