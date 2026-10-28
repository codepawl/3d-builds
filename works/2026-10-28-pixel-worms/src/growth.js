// Growth by fission (play only). A worm has a belly. Bites of meat fill the bellies of the worms that bite; a fuller worm is
// longer; a full worm pinches in two and splits. Bellies drain, and a worm with an empty belly shrinks and then dies.
import { smoothstep } from './random.js';
import { TUNING, splitCost } from './tuning.js';
import { announce } from './events.js';

const SEGMENT_EMPTY = 0.2;
const SEGMENT_FULL = 0.285;
const SEGMENT_STARVING = 0.12;

export class Growth {
  constructor(swarm) {
    this.swarm = swarm;
    this.biters = new Int32Array(16);
    this.splits = 0;
    this.starved = 0;
    this.starvingFraction = 0;
    this.foodWasted = 0;
    this.foodEaten = 0;
  }

  // Food from a bite goes to the worms whose heads are on the piece, the emptiest first. Full bellies take nothing.
  feedAt(x, z, food) {
    const swarm = this.swarm;
    const found = swarm.collectHeadsWithin(x, z, 1.4, this.biters, 16);
    this.foodEaten += food;
    if (found === 0) return;
    const candidates = Array.from(this.biters.subarray(0, found)).filter((worm) => swarm.belly[worm] < TUNING.bellyCap);
    candidates.sort((a, b) => swarm.belly[a] - swarm.belly[b]);
    const chosen = candidates.slice(0, TUNING.maxBiters);
    if (chosen.length === 0) {
      this.foodWasted += food;
      return;
    }
    const share = food / splitCost(swarm.count) / chosen.length;
    for (const worm of chosen) {
      swarm.belly[worm] = Math.min(TUNING.bellyCap, swarm.belly[worm] + share);
      swarm.hunger[worm] = 0;
    }
  }

  // The lone first worm starts half full so it can grow from its first chicken.
  seed(worm) {
    this.swarm.belly[worm] = TUNING.startBelly;
    this.swarm.cooldown[worm] = 2;
  }

  step(dt, onStarve) {
    const swarm = this.swarm;
    const drain = dt / TUNING.foodLife;
    let starving = 0;
    const ready = [];
    for (let worm = 0; worm < swarm.count; worm++) {
      swarm.belly[worm] = Math.max(0, swarm.belly[worm] - drain);
      swarm.cooldown[worm] -= dt;
      if (swarm.belly[worm] <= 0) {
        swarm.hunger[worm] += dt;
        if (swarm.hunger[worm] > 3) starving += 1;
      } else {
        swarm.hunger[worm] = Math.max(0, swarm.hunger[worm] - dt * 2);
      }
      const shrink = smoothstep(0, TUNING.shrinkSeconds, swarm.hunger[worm]);
      const target = SEGMENT_EMPTY + (SEGMENT_FULL - SEGMENT_EMPTY) * Math.min(1, swarm.belly[worm]);
      const wanted = target + (SEGMENT_STARVING - target) * shrink;
      swarm.segmentLength[worm] += (wanted - swarm.segmentLength[worm]) * Math.min(1, dt * 1.5);
      if (swarm.pinch[worm] > 0) {
        swarm.pinch[worm] = Math.min(1, swarm.pinch[worm] + dt / TUNING.pinchSeconds);
        if (swarm.pinch[worm] >= 1) ready.push(worm);
      } else if (swarm.belly[worm] >= 1 && swarm.cooldown[worm] <= 0 && swarm.count < swarm.limit && swarm.hunger[worm] === 0) {
        swarm.pinch[worm] = 0.001;
      }
    }
    for (const parent of ready) this.divide(parent);
    this.dieOfHunger(onStarve);
    this.starvingFraction = swarm.count > 0 ? starving / swarm.count : 0;
  }

  divide(parent) {
    const swarm = this.swarm;
    const leftover = Math.max(0, swarm.belly[parent] - 1) * 0.5;
    const child = swarm.split(parent);
    if (child < 0) {
      swarm.pinch[parent] = 0;
      swarm.cooldown[parent] = 2;
      return;
    }
    const belly = leftover + TUNING.childBelly;
    swarm.belly[parent] = belly;
    swarm.belly[child] = belly;
    swarm.cooldown[parent] = TUNING.splitCooldown;
    swarm.cooldown[child] = TUNING.splitCooldown;
    swarm.hunger[child] = 0;
    this.splits += 1;
    announce('worm-split', { x: swarm.x[parent * 20], z: swarm.z[parent * 20] });
  }

  dieOfHunger(onStarve) {
    const swarm = this.swarm;
    const limit = TUNING.shrinkSeconds + TUNING.dieSeconds;
    for (let worm = swarm.count - 1; worm >= 0; worm--) {
      if (swarm.hunger[worm] < limit) continue;
      const spot = swarm.remove(worm);
      this.starved += 1;
      announce('worm-die', { x: spot.x, z: spot.z, cause: 'hunger' });
      if (onStarve) onStarve(spot);
    }
  }
}
