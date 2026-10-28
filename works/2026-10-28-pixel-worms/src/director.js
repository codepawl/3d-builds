// The difficulty director (play only). A pressure budget fills with time and with the size of the swarm and is spent on opponents
// from the unlocked list. It eases off after the swarm lost a lot and pushes when the swarm grows fast with few losses, and it
// rests after a big fight. Eaten prey come back slowly at their homes so the map never runs dry.
import { RUN_SEED } from './config.js';
import { clamp, createRandom } from './random.js';
import { gameEvents } from './events.js';
import { TUNING } from './tuning.js';

// unlock: seconds into the run; cost: pressure it takes; minCount: smallest swarm it bothers with; toast: shown when it first appears.
export const OPPONENT_KINDS = {
  birds: { unlock: 65, cost: 3.5, fade: 150, minCount: 1, toast: 'Birds are pecking', icon: 'bird' },
  hen: { unlock: 95, cost: 4, fade: 240, minCount: 1, toast: 'Hens are angry', icon: 'hen' },
  hawk: { unlock: 120, cost: 4, minCount: 2, toast: 'Hawks are hunting', icon: 'hawk' },
  fox: { unlock: 135, cost: 5, minCount: 3, toast: 'Foxes are prowling', icon: 'fox' },
  crows: { unlock: 150, cost: 6, minCount: 6, toast: 'Crows are circling', icon: 'crow' },
  traps: { unlock: 170, cost: 3, minCount: 6, toast: 'Traps are set', icon: 'trap' },
  farmer: { unlock: 190, cost: 7, minCount: 12, toast: 'A farmer is coming', icon: 'farmer' },
  salt: { unlock: 220, cost: 3, minCount: 25, toast: 'Salt on the ground', icon: 'salt' },
  hedgehog: { unlock: 300, cost: 8, minCount: 15, toast: 'A hedgehog rolls in', icon: 'hedgehog' },
  badger: { unlock: 330, cost: 12, minCount: 40, toast: 'A badger is digging', icon: 'badger' },
  mower: { unlock: 360, cost: 10, minCount: 12, toast: 'A mower is coming', icon: 'mower' },
};
const BUDGET_CAP = 16;
const LOSS_MEMORY_SECONDS = 25;
const HISTORY_SECONDS = 30;

export class Director {
  constructor({ hazards, creatures, onUnlock }) {
    this.hazards = hazards;
    this.creatures = creatures;
    this.onUnlock = onUnlock;
    this.random = createRandom(RUN_SEED + 13);
    this.stats = { spawned: {}, lost: {}, respawned: 0 };
    gameEvents.addEventListener('worm-die', (event) => this.noteLoss(event.detail.cause));
    this.reset(0);
  }

  reset(time) {
    this.startedAt = time;
    this.budget = 0;
    this.restUntil = 0;
    this.lossRecent = 0;
    this.history = [];
    this.nextSample = 0;
    this.adapt = 1;
    this.unlocked = new Set();
    this.newest = null;
    this.nextRespawn = TUNING.respawnSeconds;
    this.lastSpent = 0;
    this.stats = { spawned: {}, lost: {}, respawned: 0 };
  }

  noteLoss(cause) {
    this.stats.lost[cause] = (this.stats.lost[cause] ?? 0) + 1;
    if (cause !== 'hunger') this.lossRecent += 1;
  }

  // How many of this kind are on the field now.
  alive(kind) {
    const hazards = this.hazards;
    if (kind === 'hawk' || kind === 'fox') return hazards.predators.filter((predator) => predator.kind === kind).length;
    if (kind === 'traps') return hazards.traps.length > 0 ? 1 : 0;
    if (kind === 'salt') return hazards.salt ? 1 : 0;
    return hazards.opponents.list.filter((opponent) => opponent.kind === kind && !opponent.done).length;
  }

  activeGroups() {
    const hazards = this.hazards;
    const flocks = new Set(hazards.opponents.list.filter((opponent) => !opponent.done).map((opponent) => opponent.kind));
    return flocks.size + hazards.predators.length;
  }

  step(time, dt, world) {
    const swarm = world.swarm;
    const count = swarm.count;
    const seconds = time - this.startedAt;
    this.lossRecent *= Math.exp(-dt / LOSS_MEMORY_SECONDS);
    if (seconds >= this.nextSample) {
      this.nextSample = seconds + 5;
      this.history.push(count);
      if (this.history.length > HISTORY_SECONDS / 5 + 1) this.history.shift();
    }
    const before = this.history[0] ?? count;
    const growth = (count - before) / Math.max(10, before);
    const lossShare = this.lossRecent / Math.max(8, count);
    const lateMinutes = Math.max(0, (seconds - TUNING.lateStart) / 60);
    const adaptFloor = 0.35 + Math.min(0.9, TUNING.lateAdaptFloor * lateMinutes);
    this.adapt = clamp(1 + 0.8 * clamp(growth, 0, 1.2) - 1.6 * lossShare, adaptFloor, 1.8);
    const income = (TUNING.incomeBase + (TUNING.incomePerMinute * seconds) / 60) * (0.7 + 0.35 * Math.log10(Math.max(1, count))) * this.adapt * (1 + TUNING.lateIncomeGain * lateMinutes);
    this.budget = Math.min(BUDGET_CAP + 4 * lateMinutes, this.budget + income * dt);
    this.respawn(time, seconds, swarm);
    const restShare = 1 - Math.min(0.7, TUNING.lateRestCut * lateMinutes);
    if (count === 0 || time < this.restUntil) return;
    if (this.lossRecent >= Math.max(6, 0.15 * count) && time - this.lastSpent > 4) {
      this.restUntil = time + TUNING.restSeconds * restShare;
      this.lossRecent *= 0.5;
      return;
    }
    const slots = clamp(1 + Math.floor(seconds / 100) + Math.floor(count / 200), 1, 5) + Math.floor(TUNING.lateSlotsPerMinute * lateMinutes);
    if (this.activeGroups() >= slots) return;
    const options = Object.entries(OPPONENT_KINDS).filter(([kind, spec]) => {
      if (seconds < spec.unlock * TUNING.unlockScale || count < spec.minCount || spec.cost > this.budget) return false;
      const limit = kind === 'hawk' ? 1 + Math.floor(count / 250) : 1;
      return this.alive(kind) < limit;
    });
    if (options.length === 0) return;
    const weights = options.map(([kind, spec]) => (kind === this.newest ? 2.5 : 1) * (spec.fade && seconds > spec.fade ? 0.1 : 1));
    let pick = this.random.next() * weights.reduce((sum, weight) => sum + weight, 0);
    let chosen = options[0];
    for (let index = 0; index < options.length; index++) {
      pick -= weights[index];
      if (pick <= 0) {
        chosen = options[index];
        break;
      }
    }
    const [kind, spec] = chosen;
    this.budget -= spec.cost;
    this.lastSpent = time;
    this.stats.spawned[kind] = (this.stats.spawned[kind] ?? 0) + 1;
    this.hazards.spawn(kind, time, world, count);
    if (spec.cost >= 8) this.restUntil = time + TUNING.restSeconds * 0.6 * restShare;
    if (!this.unlocked.has(kind)) {
      this.unlocked.add(kind);
      this.newest = kind;
      if (this.onUnlock) this.onUnlock(kind, spec);
    }
  }

  // Prey comes back one at a time, a little slower for a swarm that is thriving and faster for one that is starving.
  respawn(time, seconds, swarm) {
    if (seconds < this.nextRespawn) return;
    const starving = this.starvingFraction ?? 0;
    const interval = TUNING.respawnSeconds * (starving > TUNING.hungerIconFraction ? 0.6 : 1) * (swarm.count > 200 ? 1.25 : 1);
    this.nextRespawn = seconds + interval;
    if (this.creatures.respawnOne(swarm.front, 50)) this.stats.respawned += 1;
  }
}
