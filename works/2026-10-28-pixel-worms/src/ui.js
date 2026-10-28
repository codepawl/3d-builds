// The play interface: HUD, start screen, end screens and the credits page. Plain DOM, styled in play.css.
import './play.css';
import { iconElement } from './icons.js';
import credits from '../credits.json';
import soundManifest from '../sound/sources/manifest.json';

// The recordings that ship in public/sfx (the manifest also lists unused candidates).
const SHIPPED_SOUNDS = ["eat_splat_a_", "eat_splat_b_", "eat_mud_splat_", "eat_gore_splat_", "eat_slimy_", "eat_mud_squelch_", "eat_squishes_", "hawk_eagle_", "hawk_calls_", "wing_whoosh_", "fox_bark_173208", "fox_scream_", "trap_snap_", "trap_bear_", "sizzle_pan_"];
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
  constructor({ onPlay, onAgain, sfx }) {
    this.sfx = sfx;
    this.root = byId('play');
    this.stats = byId('stats');
    this.countChip = byId('count-chip');
    this.timeChip = byId('time-chip');
    this.eaten = byId('eaten');
    this.shown = {};
    this.root.hidden = false;
    this.stats.classList.add('hidden');
    byId('credits-open').addEventListener('click', () => this.openCredits());
    byId('credits-back').addEventListener('click', () => this.closeCredits());
    byId('play-button').addEventListener('click', onPlay);
    byId('again-button').addEventListener('click', onAgain);
    byId('sound').addEventListener('click', () => {
      this.sfx.unlock();
      this.sfx.setEnabled(!this.sfx.enabled);
      this.drawSound();
    });
    this.drawSound();
    this.buildCredits();
  }

  drawSound() {
    const button = byId('sound');
    button.replaceChildren(iconElement(this.sfx.enabled ? 'soundOn' : 'soundOff'));
    button.setAttribute('aria-label', this.sfx.enabled ? 'Sound on' : 'Sound off');
  }

  showStart() {
    byId('start').hidden = false;
    byId('credits-open').hidden = false;
    byId('end').hidden = true;
    this.stats.classList.add('hidden');
  }

  showPlaying() {
    byId('start').hidden = true;
    byId('credits-open').hidden = true;
    byId('end').hidden = true;
    this.stats.classList.remove('hidden');
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
      chip('worm', won ? `${wormCount.toLocaleString('en-US')} worms` : `Peak ${peak.toLocaleString("en-US")}`, 'Worms'),
      chip('clock', formatTime(seconds), 'Time'),
    );
    this.stats.classList.add('hidden');
    byId('end').hidden = false;
    byId('credits-open').hidden = false;
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
