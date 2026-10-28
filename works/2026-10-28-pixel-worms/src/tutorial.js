// Quick onboarding inside the game world (play mode, first run only). Four short steps, each shown once, with pixel labels that
// are anchored to something in the world and projected to the screen every frame:
//   1 move       a pulsing ring on the ground ahead, "Move the mouse"; done when the swarm reaches it
//   2 eat        a bobbing arrow over a chicken, "Eat"; done on the first bite (then "Full worms split in two" on the first fission)
//   3 lunge      the first fleeing creature, "Left click to lunge", the lunge button pulses; done on the first lunge
//   4 dodge      the first telegraph: time slows for up to 2 s, the spot is outlined; done on the first dodge
// The director holds back real opponents until step 3 is done or 60 s have passed (see holdsOpponents).
import * as THREE from 'three';

const STORAGE_KEY = 'pixel-worms-tutorial-done';
const STEPS = ['move', 'eat', 'lunge', 'dodge'];
const HOLD_OPPONENTS_SECONDS = 60;
const SLOW_SCALE = 0.3;
const SLOW_REAL_SECONDS = 2;
const FISSION_LABEL_SECONDS = 4;
const STEP_TIMEOUT = { move: 30, eat: 45, lunge: 60 };
const MAX_TELEGRAPHS_SHOWN = 3;

const ARROW_SVG = '<svg viewBox="0 0 9 9" width="36" height="36" shape-rendering="crispEdges"><path fill="#fff3d6" d="M3 0h3v4h3v1H8v1H7v1H6v1H5v1H4V8H3V7H2V6H1V5H0V4h3z"/></svg>';

function readDone() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch (error) {
    return false;
  }
}

function writeDone() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch (error) {
    // Storage may be blocked; the tutorial then shows again next visit.
  }
}

export class Tutorial {
  // `world` gives the tutorial what it needs without importing the game: front(), forward(), creatures(), eaten(), splits(), incoming(),
  // ground(x, z), project(x, y, z) -> { x, y, behind } in CSS pixels.
  constructor({ scene, world, ui, touch }) {
    this.scene = scene;
    this.world = world;
    this.ui = ui;
    this.touch = touch;
    this.root = document.getElementById('tutorial');
    this.labelLayer = document.getElementById('tutorial-labels');
    this.skipButton = document.getElementById('tutorial-skip');
    this.skipButton.addEventListener('click', () => this.finish());
    this.labels = new Map();
    this.running = false;
    this.timeScale = 1;
    this.ring = this.buildRing(0xfff3d6, 0x3a1017);
    this.outline = this.buildRing(0xfff3d6, 0x3a1017);
    this.scene.add(this.ring, this.outline);
    this.ring.visible = false;
    this.outline.visible = false;
  }

  static pending() {
    return !readDone();
  }

  buildRing(inner, outer) {
    const group = new THREE.Group();
    const make = (geometry, color) => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false, depthTest: false, transparent: true, opacity: 0.95 }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 21;
      return mesh;
    };
    group.add(make(new THREE.RingGeometry(0.88, 1.3, 20), outer));
    group.add(make(new THREE.RingGeometry(1.0, 1.18, 20), inner));
    return group;
  }

  // Starts at step 1 for a run that just began.
  begin(time) {
    this.finish(false);
    this.running = true;
    this.startedAt = time;
    this.stepIndex = 0;
    this.stepStartedAt = time;
    this.telegraphsShown = 0;
    this.slowLeft = 0;
    this.slowDone = false;
    this.fissionShownAt = null;
    this.fissionSeen = false;
    this.eatenAtStart = this.world.eaten();
    this.splitsAtStart = this.world.splits();
    this.root.hidden = false;
    this.enterStep(time);
  }

  get step() {
    return STEPS[this.stepIndex];
  }

  // True while real opponents must stay away: the run is young and the lunge has not been learned yet.
  holdsOpponents(time) {
    return this.running && time - this.startedAt < HOLD_OPPONENTS_SECONDS && this.stepIndex < 3;
  }

  enterStep(time) {
    this.stepStartedAt = time;
    this.hideLabel('main');
    this.ring.visible = false;
    this.outline.visible = false;
    this.ui.pulse('lunge', false);
    this.ui.pulse('dodge', false);
    this.target = null;
    if (this.step === 'move') {
      const front = this.world.front();
      const forward = this.world.forward();
      const x = front.x + forward.x * 7;
      const z = front.z + forward.z * 7;
      this.ringSpot = { x, z };
      this.ring.visible = true;
      this.showLabel('main', this.touch ? 'Drag to steer' : 'Move the mouse', () => ({ x, y: this.world.ground(x, z) + 2.2, z }));
    } else if (this.step === 'eat') {
      // A new player cannot find a chicken behind the camera, so the first one is brought into view a few metres ahead.
      const chicken = this.pickTarget('chicken');
      if (chicken) {
        const front = this.world.front();
        const forward = this.world.forward();
        chicken.x = front.x + forward.x * 8;
        chicken.z = front.z + forward.z * 8;
        chicken.home = [chicken.x, chicken.z];
        chicken.target = [chicken.x, chicken.z];
      }
      this.showLabel('main', 'Eat', () => this.creaturePoint(this.lockedTarget(chicken, 'chicken')), true);
    } else if (this.step === 'lunge') {
      this.ui.pulse('lunge', true);
      this.showLabel('main', this.touch ? 'Tap the lunge button' : 'Left click to lunge', () => this.creaturePoint(this.lockedTarget(null, null)));
    }
  }

  advance(time) {
    if (this.stepIndex >= STEPS.length - 1) {
      this.finish();
      return;
    }
    this.stepIndex += 1;
    this.enterStep(time);
  }

  // The chicken (or any creature) the label sticks to: the nearest fleeing one for the lunge step, else the nearest of the kind.
  pickTarget(kind) {
    const front = this.world.front();
    let best = null;
    let bestScore = Infinity;
    for (const creature of this.world.creatures()) {
      if (creature.eatenAt >= 0 || creature.gone) continue;
      if (kind && creature.kindName !== kind) continue;
      let score = Math.hypot(creature.x - front.x, creature.z - front.z) - (!kind && creature.mode === 'flee' ? 100 : 0);
      // Prefer one the player can see: on screen, and not standing among the big animals that would hide the label's subject.
      const screen = this.world.project(creature.x, this.world.ground(creature.x, creature.z) + 1, creature.z);
      if (screen.behind || screen.x < 0 || screen.x > window.innerWidth || screen.y < 0 || screen.y > window.innerHeight) score += 500;
      for (const other of this.world.creatures()) {
        if (other.kind.height > 1.5 && other.eatenAt < 0 && Math.hypot(other.x - creature.x, other.z - creature.z) < 3.5) score += 12;
      }
      if (score < bestScore) {
        bestScore = score;
        best = creature;
      }
    }
    return best;
  }

  // Keeps the label on one creature until it is eaten or gone, so it does not jump between candidates every frame.
  lockedTarget(initial, kind) {
    if (this.target === null && initial) this.target = initial;
    if (!this.target || this.target.eatenAt >= 0 || this.target.gone) this.target = this.pickTarget(kind);
    return this.target;
  }

  creaturePoint(creature) {
    if (!creature) {
      const front = this.world.front();
      return { x: front.x, y: this.world.ground(front.x, front.z) + 1.6, z: front.z };
    }
    return { x: creature.x, y: this.world.ground(creature.x, creature.z) + creature.kind.height + 0.9, z: creature.z };
  }

  // Once per simulation step.
  update(time, count) {
    if (!this.running) return;
    const step = this.step;
    const front = this.world.front();
    if (step === 'move') {
      const reached = Math.hypot(front.x - this.ringSpot.x, front.z - this.ringSpot.z) < 2.6;
      if (reached || time - this.stepStartedAt > STEP_TIMEOUT.move) this.advance(time);
    } else if (step === 'eat') {
      if (this.world.eaten() > this.eatenAtStart || time - this.stepStartedAt > STEP_TIMEOUT.eat) this.advance(time);
    } else if (step === 'lunge') {
      if (time - this.stepStartedAt > STEP_TIMEOUT.lunge) this.advance(time);
    } else if (step === 'dodge') {
      this.updateDodge(time);
    }
    if (!this.fissionSeen && this.world.splits() > this.splitsAtStart && count > 1) {
      this.fissionSeen = true;
      this.fissionShownAt = time;
      this.showLabel('fission', 'Full worms split in two', () => {
        const point = this.world.front();
        return { x: point.x, y: this.world.ground(point.x, point.z) + 2.8, z: point.z };
      });
    }
    if (this.fissionShownAt !== null && time - this.fissionShownAt > FISSION_LABEL_SECONDS) {
      this.fissionShownAt = null;
      this.hideLabel('fission');
    }
  }

  updateDodge(time) {
    const attack = this.world.incoming().find((candidate) => candidate.eta > 0.15);
    if (attack && !this.attackShown) {
      this.attackShown = true;
      this.telegraphsShown += 1;
      this.slowLeft = this.slowDone ? 0 : SLOW_REAL_SECONDS;
      this.slowDone = true;
      this.fissionShownAt = null;
      this.hideLabel('fission');
      this.attackPoint = { x: attack.x, z: attack.z };
      this.outline.visible = true;
      this.ui.pulse('dodge', true);
      this.showLabel('main', this.touch ? 'Tap the dodge button just before the hit to parry' : 'Right click to dodge, just before the hit to parry', () => ({ x: this.attackPoint.x, y: this.world.ground(this.attackPoint.x, this.attackPoint.z) + 3.2, z: this.attackPoint.z }));
    }
    if (this.attackShown) {
      const live = this.world.incoming().find((candidate) => Math.hypot(candidate.x - this.attackPoint.x, candidate.z - this.attackPoint.z) < 8);
      if (live) {
        this.attackPoint = { x: live.x, z: live.z };
      } else {
        // The attack landed or passed. Wait for the next telegraph, up to a few, then stop asking.
        this.attackShown = false;
        this.outline.visible = false;
        this.hideLabel('main');
        this.ui.pulse('dodge', false);
        this.slowLeft = 0;
        if (this.telegraphsShown >= MAX_TELEGRAPHS_SHOWN) this.finish();
      }
    }
  }

  noteLunge() {
    if (this.running && this.step === 'lunge') this.advance(this.world.time());
  }

  noteDodge() {
    if (this.running && this.step === 'dodge' && this.attackShown) this.finish();
  }

  // Once per drawn frame: real seconds, for the slow-motion window.
  frame(realSeconds, time) {
    if (!this.running) {
      this.timeScale = 1;
      return;
    }
    if (this.slowLeft > 0) {
      this.slowLeft -= realSeconds;
      this.timeScale = SLOW_SCALE;
    } else {
      this.timeScale = 1;
    }
    const pulse = 1 + 0.12 * Math.sin(time * 6);
    if (this.ring.visible) {
      this.ring.position.set(this.ringSpot.x, this.world.ground(this.ringSpot.x, this.ringSpot.z) + 0.35, this.ringSpot.z);
      this.ring.scale.setScalar(1.8 * pulse);
    }
    if (this.outline.visible && this.attackPoint) {
      this.outline.position.set(this.attackPoint.x, this.world.ground(this.attackPoint.x, this.attackPoint.z) + 0.35, this.attackPoint.z);
      this.outline.scale.setScalar(2.2 * pulse);
    }
    this.layoutLabels();
  }

  // ---- Labels -------------------------------------------------------------------------------------------------------------------

  showLabel(id, text, anchor, withArrow = false) {
    this.hideLabel(id);
    const element = document.createElement('div');
    element.className = 'tutorial-label';
    const words = document.createElement('span');
    words.textContent = text;
    element.append(words);
    if (withArrow) {
      const arrow = document.createElement('span');
      arrow.className = 'tutorial-arrow';
      arrow.innerHTML = ARROW_SVG;
      element.append(arrow);
    }
    this.labelLayer.append(element);
    this.labels.set(id, { element, anchor });
  }

  hideLabel(id) {
    const label = this.labels.get(id);
    if (!label) return;
    label.element.remove();
    this.labels.delete(id);
  }

  layoutLabels() {
    const margin = 14;
    const width = window.innerWidth;
    const height = window.innerHeight;
    for (const label of this.labels.values()) {
      const point = label.anchor();
      const screen = this.world.project(point.x, point.y, point.z);
      // A point behind the camera projects mirrored; flip it so the arrow points the way to turn.
      const targetX = screen.behind ? width - screen.x : screen.x;
      const targetY = screen.behind ? height * 2 : screen.y;
      const box = label.element.getBoundingClientRect();
      const x = Math.min(width - margin - box.width / 2, Math.max(margin + box.width / 2, targetX));
      const y = Math.min(height - 120, Math.max(margin + 96 + box.height, targetY));
      label.element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
      this.aimArrow(label.element, x, y, targetX, targetY);
    }
  }

  // The arrow points down at its subject; when the label is pinned to the screen edge, it turns toward the subject instead.
  aimArrow(element, labelX, labelY, targetX, targetY) {
    const arrow = element.querySelector('.tutorial-arrow svg');
    if (!arrow) return;
    const distance = Math.hypot(targetX - labelX, targetY - labelY);
    if (distance < 24) {
      arrow.style.transform = '';
      return;
    }
    const degreesFromDown = Math.atan2(targetY - labelY, targetX - labelX) * 180 / Math.PI - 90;
    arrow.style.transform = `rotate(${Math.round(degreesFromDown)}deg)`;
  }

  // Ends the tutorial. `remember` false only when restarting it.
  finish(remember = true) {
    const wasRunning = this.running;
    this.running = false;
    this.timeScale = 1;
    this.slowLeft = 0;
    this.attackShown = false;
    this.ring.visible = false;
    this.outline.visible = false;
    for (const id of [...this.labels.keys()]) this.hideLabel(id);
    this.ui.pulse('lunge', false);
    this.ui.pulse('dodge', false);
    this.root.hidden = true;
    if (wasRunning && remember) writeDone();
  }
}
