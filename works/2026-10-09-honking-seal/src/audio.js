export class TrumpetAudio {
  constructor() {
    this.context = null;
    this.muted = false;
    this.voices = [];
    this.playedNotes = [];
  }

  async unlock() {
    if (!this.context) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.context.destination);
      const real = new Float32Array(9);
      const imaginary = new Float32Array([
        0, 1, 0.72, 0.5, 0.29, 0.18, 0.12, 0.07, 0.03,
      ]);
      this.wave = this.context.createPeriodicWave(real, imaginary);
    }
    if (this.context.state === "suspended") await this.context.resume();
    return this.context.state === "running";
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.context)
      this.master.gain.setTargetAtTime(
        muted ? 0 : 0.22,
        this.context.currentTime,
        0.025,
      );
  }

  play(midiNote, force = 0.5) {
    this.playedNotes.push(midiNote);
    if (this.playedNotes.length > 84) this.playedNotes.shift();
    if (!this.context || this.context.state !== "running" || this.muted) return;
    const now = this.context.currentTime;
    const frequency = 440 * 2 ** ((midiNote - 69) / 12);
    const oscillator = this.context.createOscillator();
    oscillator.setPeriodicWave(this.wave);
    oscillator.frequency.setValueAtTime(frequency * 0.965, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency, now + 0.045);
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(frequency * 3.6, now);
    filter.frequency.linearRampToValueAtTime(frequency * 6, now + 0.08);
    filter.Q.value = 0.7;
    const envelope = this.context.createGain();
    const volume = 0.45 + Math.min(1, force) * 0.2;
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(volume, now + 0.025);
    envelope.gain.setTargetAtTime(volume * 0.7, now + 0.075, 0.06);
    envelope.gain.setTargetAtTime(0, now + 0.22, 0.045);
    const vibrato = this.context.createOscillator();
    vibrato.frequency.value = 5.5;
    const vibratoDepth = this.context.createGain();
    vibratoDepth.gain.value = frequency * 0.005;
    vibrato.connect(vibratoDepth).connect(oscillator.frequency);
    oscillator.connect(filter).connect(envelope).connect(this.master);
    oscillator.start(now);
    vibrato.start(now);
    oscillator.stop(now + 0.46);
    vibrato.stop(now + 0.46);
    this.voices.push(oscillator);
    oscillator.onended = () => {
      oscillator.disconnect();
      filter.disconnect();
      envelope.disconnect();
      vibrato.disconnect();
      vibratoDepth.disconnect();
      this.voices = this.voices.filter((voice) => voice !== oscillator);
    };
    while (this.voices.length > 4) this.voices.shift().stop();
  }
}

