// Game sound: CC0 recordings through WebAudio. The audio context starts on the first click or tap. A sample never starts twice
// in the same instant, each cue is throttled, pitch varies a little, and only a few voices play at once.
const CUES = {
  bite: ['bite-1', 'bite-2', 'bite-3'],
  gore: ['gore'],
  chunk: ['chunk-1', 'chunk-2', 'chunk-3'],
  hawk: ['hawk-1', 'hawk-2'],
  dive: ['whoosh'],
  fox: ['fox-1', 'fox-2'],
  snap: ['snap-1', 'snap-2'],
  sizzle: ['sizzle'],
};
const CUE_GAIN = { bite: 0.9, gore: 0.8, chunk: 0.55, hawk: 0.7, dive: 0.6, fox: 0.7, snap: 0.9, sizzle: 0.6 };
const CUE_GAP = { bite: 0.07, gore: 0.3, chunk: 0.11, hawk: 1.2, dive: 1, fox: 0.5, snap: 0.15, sizzle: 0.4 };
const SAMPLE_GAP = 0.06; // seconds before the same sample may start again
const MAX_VOICES = 8;
const STORAGE_KEY = 'pixel-worms-sound';

export class Sfx {
  constructor() {
    this.context = null;
    this.master = null;
    this.buffers = new Map();
    this.voices = 0;
    this.lastSample = new Map();
    this.lastCue = new Map();
    this.enabled = readSetting();
  }

  // Call from a click or tap handler. Safe to call again.
  unlock() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? 0.9 : 0;
      this.master.connect(this.context.destination);
      this.loadAll();
    }
    if (this.context.state === 'suspended') this.context.resume();
  }

  async loadAll() {
    const names = new Set(Object.values(CUES).flat());
    await Promise.all([...names].map(async (name) => {
      try {
        const response = await fetch(`sfx/${name}.ogg`);
        const data = await response.arrayBuffer();
        this.buffers.set(name, await this.context.decodeAudioData(data));
      } catch (error) {
        console.warn(`sound ${name} failed to load`, error);
      }
    }));
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
    } catch (error) {
      // Storage may be blocked; the setting then lasts for this visit only.
    }
    if (this.master) this.master.gain.value = enabled ? 0.9 : 0;
  }

  // `loudness` runs 0..1 and falls off with distance from the camera.
  play(cue, loudness = 1) {
    if (!this.context || !this.enabled || this.context.state !== 'running' || loudness < 0.05) return;
    const now = this.context.currentTime;
    if (now - (this.lastCue.get(cue) ?? -10) < CUE_GAP[cue]) return;
    if (this.voices >= MAX_VOICES) return;
    const candidates = CUES[cue].filter((name) => this.buffers.has(name) && now - (this.lastSample.get(name) ?? -10) >= SAMPLE_GAP);
    if (candidates.length === 0) return;
    const name = candidates[Math.floor(Math.random() * candidates.length)];
    this.lastCue.set(cue, now);
    this.lastSample.set(name, now);
    const source = this.context.createBufferSource();
    source.buffer = this.buffers.get(name);
    source.playbackRate.value = 0.92 + Math.random() * 0.16;
    const gain = this.context.createGain();
    gain.gain.value = CUE_GAIN[cue] * loudness;
    source.connect(gain).connect(this.master);
    this.voices += 1;
    source.onended = () => {
      this.voices -= 1;
    };
    source.start();
  }
}

function readSetting() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch (error) {
    return true;
  }
}
