import { clamp } from './random.js';

// A button with a short effect and a cooldown, all on the sim clock. The cooldown starts when the effect starts.
export class Ability {
  constructor({ activeSeconds, cooldownSeconds }) {
    this.activeSeconds = activeSeconds;
    this.cooldownSeconds = cooldownSeconds;
    this.startedAt = -Infinity;
  }

  get totalSeconds() {
    return this.activeSeconds + this.cooldownSeconds;
  }

  ready(time) {
    return time - this.startedAt >= this.totalSeconds;
  }

  trigger(time) {
    if (!this.ready(time)) return false;
    this.startedAt = time;
    return true;
  }

  active(time) {
    return time - this.startedAt < this.activeSeconds;
  }

  secondsSinceStart(time) {
    return time - this.startedAt;
  }

  // 0 just after use, 1 when ready again.
  recharge(time) {
    return clamp((time - this.startedAt) / this.totalSeconds, 0, 1);
  }

  reset() {
    this.startedAt = -Infinity;
  }
}

export const LUNGE = { activeSeconds: 0.6, cooldownSeconds: 4 };
export const DODGE = { activeSeconds: 0.5, cooldownSeconds: 5 };
// A dodge that began this recently before an attack lands is a parry; an older one only makes the attack miss.
export const PARRY_WINDOW = 0.35;
