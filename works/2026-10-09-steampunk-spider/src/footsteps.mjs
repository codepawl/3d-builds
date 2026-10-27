const noiseBuffers = new WeakMap();

function noiseFor(context) {
  if (noiseBuffers.has(context)) return noiseBuffers.get(context);
  const buffer = context.createBuffer(
    1,
    context.sampleRate,
    context.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  let seed = 271828;
  for (let index = 0; index < samples.length; index++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    samples[index] = (seed / 4294967296) * 2 - 1;
  }
  noiseBuffers.set(context, buffer);
  return buffer;
}

function scheduleMechanicalSound(context, destination, event, start) {
  const panner = context.createStereoPanner();
  panner.pan.value = event.side * 0.45;
  panner.connect(destination);
  const lift = event.kind === "lift";
  const landing = event.kind === "land";
  const jumping = event.kind === "jump";
  const weight = event.weight ?? 1;
  const pitch = event.pitch ?? 1;
  const duration =
    (jumping ? 0.68 : landing ? 0.75 : lift ? 0.19 : 0.26) * (event.decay ?? 1);
  const noise = context.createBufferSource();
  noise.buffer = noiseFor(context);
  noise.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  const cutoff = jumping ? 720 : landing ? 460 : lift ? 520 : 900 / weight;
  filter.frequency.setValueAtTime(cutoff * pitch, start);
  filter.Q.value = 0.55;
  filter.frequency.exponentialRampToValueAtTime(
    (jumping ? 150 : cutoff * 0.55) * pitch,
    start + duration,
  );
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(
    (jumping ? 0.28 : landing ? 0.2 : lift ? 0.035 : 0.075) * weight,
    start + (jumping ? 0.045 : 0.012),
  );
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  noise.connect(filter).connect(envelope).connect(panner);
  noise.start(start, event.noiseOffset ?? 0);
  noise.stop(start + duration);

  const tones = jumping
    ? [46, 79]
    : lift
      ? [140, 265]
      : landing
        ? [48, 83, 190, 370]
        : [68, 158, 315];
  tones.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    const variation = pitch / Math.sqrt(weight);
    oscillator.frequency.setValueAtTime(frequency * variation, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency * variation * (jumping ? 0.72 : lift ? 0.92 : 0.86),
      start + duration,
    );
    const amplitude =
      ((jumping ? 0.045 : landing ? 0.19 : lift ? 0.006 : 0.065) * weight) /
      (index + 1);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(amplitude, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + duration * (index ? 0.7 : 1),
    );
    oscillator.connect(gain).connect(panner);
    oscillator.start(start);
    oscillator.stop(start + duration);
  });
}

export function createMechanicalAudio() {
  let context;
  let output;
  let timelineStart = null;
  let randomSeed = 314159;
  function random() {
    randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
    return randomSeed / 4294967296;
  }
  const events = [];
  function unlock() {
    if (!context) {
      context = new AudioContext();
      output = context.createGain();
      output.gain.value = 0.65;
      output.connect(context.destination);
    }
    if (context.state === "suspended") context.resume();
  }
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  return {
    beginTimeline() {
      events.length = 0;
      randomSeed = 314159;
      timelineStart = performance.now();
    },
    emit(kind, side = 0) {
      const event = {
        kind,
        side,
        weight: kind === "step" ? 0.72 + random() * 0.58 : 1,
        pitch: 0.9 + random() * 0.2,
        decay: 0.82 + random() * 0.35,
        noiseOffset: random() * 0.7,
        seconds:
          timelineStart === null
            ? 0
            : (performance.now() - timelineStart) / 1000,
      };
      if (timelineStart !== null) events.push(event);
      if (context?.state === "running")
        scheduleMechanicalSound(
          context,
          output,
          event,
          context.currentTime + 0.005,
        );
    },
    get events() {
      return events.slice();
    },
  };
}

export async function renderMechanicalAudio(events, duration) {
  const sampleRate = 48000;
  const context = new OfflineAudioContext(
    2,
    Math.ceil(duration * sampleRate),
    sampleRate,
  );
  const output = context.createGain();
  output.gain.value = 0.9;
  output.connect(context.destination);
  for (const event of events) {
    if (event.seconds < duration)
      scheduleMechanicalSound(
        context,
        output,
        event,
        Math.max(0, event.seconds),
      );
  }
  const audio = await context.startRendering();
  const bytes = new Uint8Array(44 + audio.length * 4);
  const view = new DataView(bytes.buffer);
  function label(offset, value) {
    for (let index = 0; index < value.length; index++)
      bytes[offset + index] = value.charCodeAt(index);
  }
  label(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  label(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  label(36, "data");
  view.setUint32(40, audio.length * 4, true);
  const channels = [audio.getChannelData(0), audio.getChannelData(1)];
  for (let frame = 0; frame < audio.length; frame++) {
    for (let channel = 0; channel < 2; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
      view.setInt16(44 + frame * 4 + channel * 2, sample * 32767, true);
    }
  }
  return bytes;
}
