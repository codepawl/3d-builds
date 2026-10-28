// The play interface: HUD, start screen, end screens and the credits page. Plain DOM, styled in play.css.
import './play.css';
import { iconElement } from './icons.js';
import credits from '../credits.json';
import soundManifest from '../sound/sources/manifest.json';

// The recordings that ship in public/sfx (the manifest also lists unused candidates).
const SHIPPED_SOUNDS = ["eat_splat_a_", "eat_splat_b_", "eat_mud_splat_", "eat_gore_splat_", "eat_slimy_", "eat_mud_squelch_", "eat_squishes_", "hawk_eagle_", "hawk_calls_", "wing_whoosh_", "fox_bark_173208", "fox_scream_", "trap_snap_", "trap_bear_", "sizzle_pan_", "bed_slime_move_", "wing_flap_", "trap_shut_", "squeak_chicken_", "squeak_rat_", "squeak_pig_grunt_", "crow_caw_", "engine_lawn_mower_"];
const KIND_ORDER = ['chicken', 'rabbit', 'pig', 'deer', 'cow', 'villager'];

const byId = (id) => document.getElementById(id);

function chip(iconName, text, label) {
  const element = document.createElement('span');
  element.className = 'chip';
  element.append(iconElement(iconName, label));
  const value = document.createElement('span');
  value.textContent = text;
  element.append(value);
  return element;
}

export function formatTime(seconds) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export class PlayUi {
  constructor({ onPlay, onAgain, onLunge, onDodge, onHowTo, sfx }) {
    this.sfx = sfx;
    this.root = byId('play');
    this.stats = byId('stats');
    this.countChip = byId('count-chip');
    this.timeChip = byId('time-chip');
    this.eaten = byId('eaten');
    this.hunger = byId('hunger');
    this.threat = byId('threat');
    this.shown = {};
    this.root.hidden = false;
    this.stats.classList.add('hidden');
    byId('credits-open').addEventListener('click', () => this.openCredits());
    byId('credits-back').addEventListener('click', () => this.closeCredits());
    byId('howto-open').addEventListener('click', onHowTo);
    byId('play-button').addEventListener('click', onPlay);
    byId('again-button').addEventListener('click', onAgain);
    byId('sound').addEventListener('click', () => {
      this.sfx.unlock();
      this.sfx.setEnabled(!this.sfx.enabled);
      this.drawSound();
    });
    this.drawSound();
    this.buildCredits();
    this.abilities = byId('abilities');
    this.toastElement = byId('toast');
    this.buttons = { lunge: byId('lunge-button'), dodge: byId('dodge-button') };
    this.buttons.lunge.append(iconElement('lunge'));
    this.buttons.dodge.append(iconElement('dodge'));
    this.buttons.lunge.addEventListener('pointerdown', (event) => this.press(event, 'lunge', onLunge));
    this.buttons.dodge.addEventListener('pointerdown', (event) => this.press(event, 'dodge', onDodge));
    // Keep the browser menu off the game, buttons included.
    this.root.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  press(event, name, handler) {
    event.preventDefault();
    event.stopPropagation();
    if (!handler()) this.deny(name);
  }

  // A pulsing ring on a HUD button tells the player to press it (the tutorial turns it on and off).
  pulse(name, on) {
    this.buttons[name].classList.toggle('pulse', on);
  }

  deny(name) {
    const button = this.buttons[name];
    button.classList.remove('denied');
    void button.offsetWidth;
    button.classList.add('denied');
  }

  // `recharge` runs 0 (just used) to 1 (ready); the dark wedge on the button shrinks as it fills.
  updateAbilities({ lunge, dodge }) {
    for (const [name, recharge] of [['lunge', lunge], ['dodge', dodge]]) {
      const cooling = Math.round((1 - recharge) * 50) / 50;
      if (this.shown[name] === cooling) continue;
      this.shown[name] = cooling;
      this.buttons[name].style.setProperty('--cooling', String(cooling));
      this.buttons[name].classList.toggle('cooling', cooling > 0);
    }
  }

  // A new opponent shows up: a short toast, and its icon stays beside the stats as the current threat tier.
  announceThreat(iconName, text) {
    this.toast(iconName, text);
    this.threat.replaceChildren(iconElement(iconName, text));
    this.threat.title = text;
    this.threat.hidden = false;
  }

  // The hunger icon shows only while the swarm is starving.
  setHunger(starving) {
    if (this.shown.hunger === starving) return;
    this.shown.hunger = starving;
    this.hunger.hidden = !starving;
    if (starving) this.hunger.replaceChildren(iconElement('hunger', 'Starving'));
  }

  toast(iconName, text) {
    this.toastElement.replaceChildren(iconElement(iconName), document.createTextNode(text));
    this.toastElement.classList.remove('show');
    void this.toastElement.offsetWidth;
    this.toastElement.classList.add('show');
  }

  drawSound() {
    const button = byId('sound');
    button.replaceChildren(iconElement(this.sfx.enabled ? 'soundOn' : 'soundOff'));
    button.setAttribute('aria-label', this.sfx.enabled ? 'Sound on' : 'Sound off');
  }

  showStart() {
    byId('start').hidden = false;
    byId('links').hidden = false;
    byId('end').hidden = true;
    this.stats.classList.add('hidden');
    this.abilities.classList.add('hidden');
  }

  showPlaying() {
    byId('start').hidden = true;
    byId('links').hidden = true;
    byId('end').hidden = true;
    this.stats.classList.remove('hidden');
    this.abilities.classList.remove('hidden');
    this.threat.hidden = true;
    this.hunger.hidden = true;
    this.shown.hunger = false;
  }

  // Redraws only what changed, so the DOM stays quiet while the game runs.
  updateStats({ wormCount, seconds, eatenByKind, creaturesLeft }) {
    const countText = wormCount.toLocaleString('en-US');
    if (this.shown.count !== countText) {
      this.shown.count = countText;
      this.countChip.replaceChildren(iconElement('worm', 'Worms'), document.createTextNode(countText));
    }
    const timeText = formatTime(seconds);
    if (this.shown.time !== timeText) {
      this.shown.time = timeText;
      this.timeChip.replaceChildren(iconElement('clock', 'Time'), document.createTextNode(timeText));
    }
    const eatenKey = KIND_ORDER.map((kind) => eatenByKind[kind] ?? 0).join(',') + `|${creaturesLeft}`;
    if (this.shown.eaten !== eatenKey) {
      this.shown.eaten = eatenKey;
      const chips = KIND_ORDER.filter((kind) => eatenByKind[kind] > 0).map((kind) => chip(kind, String(eatenByKind[kind]), kind));
      this.eaten.replaceChildren(...chips);
    }
  }

  showEnd({ won, peak, wormCount, seconds }) {
    byId('end-icon').replaceChildren(iconElement(won ? 'star' : 'skull', won ? 'Win' : 'Lost'));
    byId('end-title').textContent = won ? 'Every creature eaten' : 'Your swarm is gone';
    byId('end-stats').replaceChildren(
      chip('clock', formatTime(seconds), 'Survived'),
      chip('worm', peak.toLocaleString('en-US'), 'Peak swarm'),
    );
    this.stats.classList.add('hidden');
    this.abilities.classList.add('hidden');
    byId('end').hidden = false;
    byId('links').hidden = false;
  }

  openCredits() {
    byId('credits').hidden = false;
    byId('credits').scrollTop = 0;
  }

  closeCredits() {
    byId('credits').hidden = true;
  }

  buildCredits() {
    const body = byId('credits-body');
    const section = (title, items) => {
      const heading = document.createElement('h3');
      heading.textContent = title;
      const list = document.createElement('ul');
      list.append(...items);
      body.append(heading, list);
    };
    const link = (text, url) => {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.textContent = text;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      return anchor;
    };
    const entry = (nameNode, detail) => {
      const item = document.createElement('li');
      item.append(nameNode);
      if (detail) {
        const small = document.createElement('small');
        small.textContent = detail;
        item.append(small);
      }
      return item;
    };
    const models = credits.filter((item) => item.kind === 'model');
    section('Models', models.map((item) => entry(link(item.pack, item.source), `${item.author}, ${item.license}`)));
    const fonts = credits.filter((item) => item.kind === 'font');
    const code = credits.filter((item) => item.kind === 'code');
    section('Font and code', [
      entry(document.createTextNode('Code: CodePawl, MIT'), ''),
      ...fonts.map((item) => entry(link(item.id, item.source), item.license)),
      ...code.filter((item) => item.license !== 'own').map((item) => entry(item.source ? link(item.id, item.source) : document.createTextNode(item.id), item.license)),
    ]);
    const sounds = soundManifest.sources.filter((sound) => SHIPPED_SOUNDS.some((prefix) => sound.file.startsWith(prefix))).map((sound) => {
      const title = sound.title.replace(/\s+by\s+.*$/i, '').replace(/\.(wav|mp3|ogg|flac)$/i, '');
      return entry(link(title, sound.url), `${sound.author}, Freesound, CC0`);
    });
    section('Sounds', sounds);
    const links = credits.filter((item) => ['inspiration', 'source'].includes(item.kind));
    section('Project', [
      ...links.map((item) => entry(link(item.kind === 'inspiration' ? `Inspired by ${item.id}` : 'Source code on GitHub', item.source), item.kind === 'source' ? 'works/2026-10-28-pixel-worms, MIT' : '')),
      ...credits.filter((item) => item.kind === 'made').map((item) => entry(document.createTextNode(item.id), '')),
    ]);
  }
}
