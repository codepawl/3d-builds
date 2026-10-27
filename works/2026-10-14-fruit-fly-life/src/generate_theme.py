"""Orglet trailer theme: a 30 s instrumental made entirely in code (numpy/scipy).

Run (never a bare python):
  uv run --no-project --with numpy --with scipy --with soundfile --with pyloudnorm \
      python generate_theme.py

Outputs next to this file: orglet-theme.wav (48 kHz, 24-bit), orglet-theme.mp3 (320k),
structure.json (bar and beat grid).

Everything is synthesized except two layered CC0 one-shots (a hand clap and a shaker from VCSL,
CC0-1.0, copied from the showreel source bank into ./samples).
"""

import ctypes
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import pyloudnorm
import soundfile
from scipy import ndimage, signal

HERE = Path(__file__).resolve().parent
SAMPLE_BANK = Path(os.environ.get("SAMPLE_BANK", "samples"))
SAMPLE_FILES = {
    "clap": ("claps", "Clap_rr1.wav"),
    "clap_alt": ("claps", "Clap_rr3.wav"),
    "shaker_down": ("shaker", "Mid_ShakerDouble_Down_rr1.wav"),
    "shaker_up": ("shaker", "Mid_ShakerDouble_Up_rr1.wav"),
}

SAMPLE_RATE = 48000
BPM = 112
BEAT = 60.0 / BPM            # 0.5357 s
BAR = 4 * BEAT               # 2.1429 s
TOTAL_BARS = 14              # 14 bars * 4 beats = 56 beats = exactly 30.000 s
DURATION = TOTAL_BARS * BAR
TAIL_SECONDS = 3.0           # render room for the reverb tail, cut at DURATION
TOTAL_SAMPLES = int(round(DURATION * SAMPLE_RATE))
RENDER_SAMPLES = TOTAL_SAMPLES + int(TAIL_SECONDS * SAMPLE_RATE)

TARGET_LUFS = -14.0
TRUE_PEAK_CEILING_DB = -1.8  # a little under the -1 dBTP limit, MP3 encoding adds some back

RNG = np.random.default_rng(2026)

# ---------------------------------------------------------------- score

NOTE_OFFSETS = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def note_frequency(name):
    letter = name[0]
    index = 1
    semitone = NOTE_OFFSETS[letter]
    if name[index] == "#":
        semitone += 1
        index += 1
    elif name[index] == "b":
        semitone -= 1
        index += 1
    octave = int(name[index:])
    midi = 12 * (octave + 1) + semitone
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)


# chord name -> voicings. Key of D major.
CHORDS = {
    "Dmaj9": dict(pad=["D3", "A3", "C#4", "E4", "F#4"], keys=["F#4", "A4", "C#5", "E5"],
                  arp=["A4", "C#5", "F#5", "A5"], bass="D2"),
    "Bm7": dict(pad=["B2", "F#3", "A3", "D4", "F#4"], keys=["D4", "F#4", "A4", "D5"],
                arp=["B4", "D5", "F#5", "A5"], bass="B1"),
    "Gmaj7": dict(pad=["G2", "D3", "B3", "F#4", "A4"], keys=["B3", "D4", "F#4", "A4"],
                  arp=["B4", "D5", "F#5", "G5"], bass="G1"),
    "A": dict(pad=["A2", "E3", "A3", "C#4", "E4"], keys=["E4", "A4", "C#5", "E5"],
              arp=["A4", "C#5", "E5", "A5"], bass="A1"),
    "Asus4": dict(pad=["A2", "E3", "A3", "D4", "E4"], keys=["D4", "E4", "A4", "D5"],
                  arp=["A4", "D5", "E5", "A5"], bass="A1"),
    "Em7": dict(pad=["E2", "B2", "D3", "G3", "B3"], keys=["D4", "G4", "B4", "E5"],
                arp=["B4", "D5", "E5", "G5"], bass="E2"),
}

# bar number (1-based) -> list of (beat offset, chord name)
PROGRESSION = {
    1: [(0, "Dmaj9")], 2: [(0, "Bm7")], 3: [(0, "Gmaj7")],
    4: [(0, "Dmaj9")], 5: [(0, "Gmaj7")], 6: [(0, "Asus4"), (2, "A")],
    7: [(0, "Dmaj9")], 8: [(0, "Bm7")], 9: [(0, "Gmaj7")], 10: [(0, "A")],
    11: [(0, "Em7")], 12: [(0, "A")], 13: [(0, "Gmaj7"), (2, "A")],
    14: [(0, "Dmaj9")],
}

SECTIONS = [
    dict(name="intro", first_bar=1, last_bar=3, description="soft pad, quiet pluck arpeggio, sub bass"),
    dict(name="build", first_bar=4, last_bar=6, description="filter opens, kick and hats enter, snare roll and riser into the drop"),
    dict(name="main", first_bar=7, last_bar=12, description="full groove, bass, e-piano chords and the hook melody"),
    dict(name="ending", first_bar=13, last_bar=14, description="fill and riser, then the stop-time sting on the downbeat of bar 14 and its ring-out"),
]

# hook: (bar, beat, length in beats, note)
HOOK = [
    (7, 0, 1, "F#5"), (7, 1, .5, "A5"), (7, 1.5, .5, "B5"), (7, 2, 1, "A5"), (7, 3, .5, "F#5"), (7, 3.5, .5, "E5"),
    (8, 0, 1.5, "D5"), (8, 1.5, .5, "F#5"), (8, 2, 1, "A5"), (8, 3, 1, "F#5"),
    (9, 0, 1, "B4"), (9, 1, .5, "D5"), (9, 1.5, .5, "E5"), (9, 2, 1, "F#5"), (9, 3, .5, "E5"), (9, 3.5, .5, "D5"),
    (10, 0, 1.5, "C#5"), (10, 1.5, .5, "E5"), (10, 2, 1.5, "A5"), (10, 3.5, .5, "B5"),
    (11, 0, 1, "G5"), (11, 1, .5, "F#5"), (11, 1.5, .5, "E5"), (11, 2, 1.5, "B5"), (11, 3.5, .5, "A5"),
    (12, 0, 1, "C#6"), (12, 1, .5, "B5"), (12, 1.5, .5, "A5"), (12, 2, 1, "E5"), (12, 3, 1, "A5"),
    (13, 0, 1.5, "B5"), (13, 1.5, .5, "A5"), (13, 2, 2, "C#6"),
    (14, 0, 4, "D6"),
]


def beat_time(bar, beat=0.0):
    return ((bar - 1) * 4 + beat) * BEAT


# ---------------------------------------------------------------- DSP helpers

def lower_priority():
    below_normal = 0x00004000
    ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), below_normal)


def empty_bus():
    return np.zeros((2, RENDER_SAMPLES))


def place(bus, mono, start_seconds, pan=0.0, gain=1.0):
    """Add a mono sound to a stereo bus with equal-power panning."""
    start = int(round(start_seconds * SAMPLE_RATE))
    if start >= RENDER_SAMPLES or start < 0:
        return
    length = min(len(mono), RENDER_SAMPLES - start)
    angle = (pan + 1.0) * np.pi / 4.0
    bus[0, start:start + length] += mono[:length] * np.cos(angle) * gain
    bus[1, start:start + length] += mono[:length] * np.sin(angle) * gain


def place_stereo(bus, left, right, start_seconds, gain=1.0):
    start = int(round(start_seconds * SAMPLE_RATE))
    length = min(len(left), RENDER_SAMPLES - start)
    if length <= 0:
        return
    bus[0, start:start + length] += left[:length] * gain
    bus[1, start:start + length] += right[:length] * gain


def curve(points):
    """Per-sample gain curve from (seconds, value) points."""
    times = np.arange(RENDER_SAMPLES) / SAMPLE_RATE
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return np.interp(times, xs, ys)


def note_envelope(length_samples, hold_seconds, attack, release):
    time_axis = np.arange(length_samples) / SAMPLE_RATE
    rising = np.minimum(1.0, time_axis / max(attack, 1e-4))
    falling = np.clip((time_axis - hold_seconds) / max(release, 1e-4), 0.0, 1.0)
    return rising * (1.0 - falling) ** 2


def swept_lowpass(audio, cutoff_per_sample, block=512):
    """Lowpass whose cutoff follows a per-sample curve; state carries across blocks."""
    output = np.zeros_like(audio)
    state = None
    for start in range(0, audio.shape[1], block):
        end = min(start + block, audio.shape[1])
        cutoff = float(np.clip(cutoff_per_sample[start], 60.0, SAMPLE_RATE * 0.45))
        sections = signal.butter(2, cutoff / (SAMPLE_RATE / 2), "low", output="sos")
        if state is None:
            state = np.zeros((sections.shape[0], audio.shape[0], 2))
        output[:, start:end], state = signal.sosfilt(sections, audio[:, start:end], axis=1, zi=state)
    return output


def filtered(audio, kind, cutoff, order=2):
    sections = signal.butter(order, np.asarray(cutoff) / (SAMPLE_RATE / 2), kind, output="sos")
    return signal.sosfilt(sections, audio, axis=-1)


def additive_saw(frequency, seconds, rate_base, rate_slope, max_hz=9000.0, tilt=1.0, phase_offset=0.0):
    """Saw built from harmonics whose decay rates grow with harmonic number: a plucked-brightness shape.

    rate_base = decay rate of the fundamental in 1/s, rate_slope = extra rate per harmonic.
    """
    samples = int(seconds * SAMPLE_RATE)
    time_axis = np.arange(samples) / SAMPLE_RATE
    harmonic_count = max(1, int(min(max_hz, SAMPLE_RATE * 0.45) / frequency))
    harmonics = np.arange(1, harmonic_count + 1)[:, None]
    amplitudes = harmonics ** -tilt * np.exp(-time_axis[None, :] * (rate_base + rate_slope * (harmonics - 1)))
    phases = 2 * np.pi * frequency * harmonics * time_axis[None, :] + phase_offset * harmonics
    return np.sum(amplitudes * np.sin(phases), axis=0)


def normalise_peak(audio):
    peak = np.max(np.abs(audio))
    return audio / peak if peak > 0 else audio


def reverb_impulse(rt60=2.2, predelay=0.018):
    length = int((rt60 + 0.5) * SAMPLE_RATE)
    time_axis = np.arange(length) / SAMPLE_RATE
    decay = np.exp(-6.9 * time_axis / rt60)
    impulses = []
    for _ in range(2):
        noise = RNG.standard_normal(length) * decay
        noise *= np.minimum(1.0, time_axis / 0.006)
        # darker as it decays: blend a bright and a dark copy
        dark = filtered(noise, "low", 2200)
        bright = filtered(noise, "low", 7500)
        mix = np.exp(-time_axis / 0.6)
        tail = bright * mix + dark * (1 - mix)
        tail = filtered(tail, "high", 180)
        impulses.append(np.concatenate([np.zeros(int(predelay * SAMPLE_RATE)), tail]))
    length = max(len(impulses[0]), len(impulses[1]))
    stereo = np.zeros((2, length))
    for channel in range(2):
        stereo[channel, :len(impulses[channel])] = impulses[channel]
    stereo /= np.sqrt(np.sum(stereo ** 2, axis=1, keepdims=True))
    return stereo


def apply_reverb(send):
    impulse = reverb_impulse()
    wet = np.zeros_like(send)
    for channel in range(2):
        wet[channel] = signal.fftconvolve(send[channel], impulse[channel])[:send.shape[1]]
    return wet


def ping_pong_delay(bus, delay_seconds, feedback, repeats, low_hz=3800):
    mono = filtered(bus.mean(axis=0), "low", low_hz, order=1)
    wet = np.zeros_like(bus)
    shift = int(delay_seconds * SAMPLE_RATE)
    for repeat in range(1, repeats + 1):
        offset = shift * repeat
        if offset >= bus.shape[1]:
            break
        side = repeat % 2  # alternates right, left, right...
        wet[side, offset:] += mono[:bus.shape[1] - offset] * feedback ** repeat
    return wet


def duck_curve(kick_times, depth, release=0.16):
    gain = np.ones(RENDER_SAMPLES)
    length = int(0.5 * SAMPLE_RATE)
    shape = 1.0 - depth * np.exp(-np.arange(length) / SAMPLE_RATE / release)
    for kick_time in kick_times:
        start = int(kick_time * SAMPLE_RATE)
        end = min(RENDER_SAMPLES, start + length)
        gain[start:end] = np.minimum(gain[start:end], shape[:end - start])
    return gain


# ---------------------------------------------------------------- instruments

def load_sample(key):
    folder, filename = SAMPLE_FILES[key]
    local = HERE / "samples" / filename
    if not local.exists():
        local.parent.mkdir(exist_ok=True)
        shutil.copy2(SAMPLE_BANK / folder / filename, local)
    data, rate = soundfile.read(local, always_2d=True)
    mono = data.mean(axis=1)
    if rate != SAMPLE_RATE:
        mono = signal.resample_poly(mono, SAMPLE_RATE, rate)
    onset = int(np.argmax(np.abs(mono) > 0.08 * np.max(np.abs(mono))))
    return normalise_peak(mono[max(0, onset - int(0.003 * SAMPLE_RATE)):])


def make_kick(velocity=1.0):
    samples = int(0.5 * SAMPLE_RATE)
    time_axis = np.arange(samples) / SAMPLE_RATE
    frequency = 44.0 + 120.0 * np.exp(-time_axis / 0.032)
    phase = 2 * np.pi * np.cumsum(frequency) / SAMPLE_RATE
    body = np.sin(phase) * np.exp(-time_axis / 0.17)
    click = filtered(RNG.standard_normal(samples), "high", 2500) * np.exp(-time_axis / 0.004) * 0.12
    kick = (body + click) * np.minimum(1.0, time_axis / 0.0008)
    return kick * velocity


def make_hat(decay, velocity):
    samples = int(max(decay * 6, 0.05) * SAMPLE_RATE)
    time_axis = np.arange(samples) / SAMPLE_RATE
    noise = filtered(RNG.standard_normal(samples), "high", 7500, order=4)
    return noise * np.exp(-time_axis / decay) * velocity


def make_snap(sample, velocity, tail=0.4):
    """Clap: the real CC0 clap layered with a short band-passed noise burst."""
    samples = int(tail * SAMPLE_RATE)
    time_axis = np.arange(samples) / SAMPLE_RATE
    burst = filtered(RNG.standard_normal(samples), "band", [1400, 6500]) * np.exp(-time_axis / 0.075)
    real = np.zeros(samples)
    clip = sample[:samples]
    real[:len(clip)] = clip
    return (0.8 * real + 0.45 * normalise_peak(burst)) * velocity


def make_noise_hit(seconds, decay, low_hz):
    samples = int(seconds * SAMPLE_RATE)
    time_axis = np.arange(samples) / SAMPLE_RATE
    left = filtered(RNG.standard_normal(samples), "high", low_hz, order=3) * np.exp(-time_axis / decay)
    right = filtered(RNG.standard_normal(samples), "high", low_hz, order=3) * np.exp(-time_axis / decay)
    return left, right


def make_riser(seconds, start_hz=300.0, end_hz=11000.0):
    samples = int(seconds * SAMPLE_RATE)
    progress = np.arange(samples) / samples
    noise = np.stack([RNG.standard_normal(samples), RNG.standard_normal(samples)])
    cutoff = start_hz * (end_hz / start_hz) ** progress
    swept = swept_lowpass(noise, cutoff)
    swept = filtered(swept, "high", 250)
    return swept * (progress ** 2.2) * np.minimum(1.0, (1 - progress) / 0.02)


def make_boom(seconds=1.6):
    samples = int(seconds * SAMPLE_RATE)
    time_axis = np.arange(samples) / SAMPLE_RATE
    frequency = 38.0 + 55.0 * np.exp(-time_axis / 0.09)
    phase = 2 * np.pi * np.cumsum(frequency) / SAMPLE_RATE
    return np.sin(phase) * np.exp(-time_axis / 0.7) * np.minimum(1.0, time_axis / 0.002)


def make_bass_note(note, seconds):
    frequency = note_frequency(note)
    samples = int((seconds + 0.08) * SAMPLE_RATE)
    time_axis = np.arange(samples) / SAMPLE_RATE
    tone = np.sin(2 * np.pi * frequency * time_axis)
    tone += 0.42 * np.sin(2 * np.pi * 2 * frequency * time_axis + 0.3) * np.exp(-time_axis / 0.35)
    tone += 0.22 * np.sin(2 * np.pi * 3 * frequency * time_axis) * np.exp(-time_axis / 0.18)
    return tone * note_envelope(samples, seconds, 0.006, 0.07)


def make_epiano_note(note, seconds, velocity=1.0):
    """Soft FM electric piano: sine carrier, decaying modulation, faint tine."""
    frequency = note_frequency(note)
    samples = int((seconds + 0.5) * SAMPLE_RATE)
    time_axis = np.arange(samples) / SAMPLE_RATE
    index = (1.4 * velocity) * np.exp(-time_axis / 0.28) + 0.15
    body = np.sin(2 * np.pi * frequency * time_axis + index * np.sin(2 * np.pi * frequency * time_axis))
    tine = 0.12 * np.sin(2 * np.pi * frequency * 7 * time_axis) * np.exp(-time_axis / 0.05)
    amplitude = np.exp(-time_axis / 1.1) * note_envelope(samples, seconds, 0.004, 0.35)
    return (body + tine) * amplitude * velocity


def make_pad_voices(note, seconds, attack, release):
    """Three detuned additive saws, spread left/centre/right. Returns (left, right)."""
    frequency = note_frequency(note)
    samples = int((seconds + release) * SAMPLE_RATE)
    envelope = note_envelope(samples, seconds, attack, release)
    left = np.zeros(samples)
    right = np.zeros(samples)
    for cents, left_weight, right_weight in [(-9, 0.85, 0.2), (0, 0.55, 0.55), (9, 0.2, 0.85)]:
        voice = additive_saw(frequency * 2 ** (cents / 1200), samples / SAMPLE_RATE, 0.0, 0.0,
                             max_hz=4500, tilt=1.3, phase_offset=RNG.uniform(0, 6.28))
        left += voice[:samples] * left_weight
        right += voice[:samples] * right_weight
    return left * envelope, right * envelope


def make_pluck(note, seconds, bright, sustain):
    """Saw pluck: harmonics fade fast, the fundamental rings (sustain = ring rate in 1/s)."""
    frequency = note_frequency(note)
    voice = additive_saw(frequency, seconds, sustain, 2.2 * bright, max_hz=9000, tilt=1.05)
    voice += 0.35 * np.sin(2 * np.pi * frequency * np.arange(len(voice)) / SAMPLE_RATE) * np.exp(-np.arange(len(voice)) / SAMPLE_RATE * sustain)
    envelope = note_envelope(len(voice), seconds - 0.12, 0.003, 0.12)
    return normalise_peak(voice) * envelope


def make_lead_note(note, seconds):
    """Hook voice: two slightly detuned saw plucks with a longer ring. Returns (left, right)."""
    left = make_pluck_detuned(note, seconds, -5)
    right = make_pluck_detuned(note, seconds, +5)
    return left, right


def make_pluck_detuned(note, seconds, cents):
    frequency = note_frequency(note) * 2 ** (cents / 1200)
    voice = additive_saw(frequency, seconds + 0.15, 1.1, 1.5, max_hz=7000, tilt=1.1)
    voice += 0.30 * np.sin(2 * np.pi * frequency * np.arange(len(voice)) / SAMPLE_RATE) * np.exp(-np.arange(len(voice)) / SAMPLE_RATE * 1.1)
    envelope = note_envelope(len(voice), seconds, 0.006, 0.15)
    return normalise_peak(voice) * envelope


# ---------------------------------------------------------------- arrangement

def chords_in_bar(bar):
    """[(start seconds, end seconds, chord name)] for one bar."""
    entries = PROGRESSION[bar]
    result = []
    for index, (beat, name) in enumerate(entries):
        next_beat = entries[index + 1][0] if index + 1 < len(entries) else 4
        result.append((beat_time(bar, beat), beat_time(bar, next_beat), name))
    return result


def render():
    samples = {key: load_sample(key) for key in SAMPLE_FILES}

    pad_bus = empty_bus()
    bass_bus = empty_bus()
    keys_bus = empty_bus()
    pluck_bus = empty_bus()
    lead_bus = empty_bus()
    drum_bus = empty_bus()
    shaker_bus = empty_bus()
    fx_bus = empty_bus()
    kick_times = []
    reverb_send = empty_bus()

    # ---- pad: a chord per chord change, filter and level automated afterwards
    for bar in range(1, TOTAL_BARS + 1):
        for start, end, name in chords_in_bar(bar):
            length = end - start
            if bar == TOTAL_BARS:
                length = 1.7  # sting chord rings, then lets go before the end
            for note in CHORDS[name]["pad"]:
                left, right = make_pad_voices(note, length, attack=0.35, release=0.55)
                place_stereo(pad_bus, left, right, start, gain=0.16)
    pad_cutoff = curve([(0, 700), (beat_time(4), 1100), (beat_time(7), 4200), (beat_time(7) + 1, 3000),
                        (beat_time(13), 3000), (beat_time(14), 5000), (DURATION, 2500)])
    pad_bus = swept_lowpass(pad_bus, pad_cutoff)
    pad_bus *= curve([(0, 0.55), (beat_time(3), 0.9), (beat_time(4), 0.9), (beat_time(7), 0.75),
                      (beat_time(13), 0.7), (beat_time(14), 1.0), (beat_time(14) + 0.8, 0.55), (DURATION - 0.3, 0.12), (DURATION, 0.1)])

    # ---- bass
    for bar in range(1, TOTAL_BARS + 1):
        for start, end, name in chords_in_bar(bar):
            root = CHORDS[name]["bass"]
            if bar == 1:
                continue
            if bar in (2, 3):
                place(bass_bus, make_bass_note(root, end - start - 0.05), start, gain=0.5)
            elif bar in (4, 5, 6):
                place(bass_bus, make_bass_note(root, end - start - 0.05), start, gain=0.75)
            elif bar in (7, 8, 9, 10, 11, 12, 13):
                # syncopated groove in sixteenth steps: (step, length in steps)
                pattern = [(0, 2), (3, 1.5), (6, 1.5), (8, 2), (11, 1.5), (14, 1.5)]
                for step, length_steps in pattern:
                    step_start = beat_time(bar, step / 4.0)
                    if not (start - 1e-6 <= step_start < end - 1e-6):
                        continue
                    note_end = min(end, step_start + length_steps * BEAT / 4.0)
                    pitch = root
                    place(bass_bus, make_bass_note(pitch, max(0.08, note_end - step_start - 0.02)), step_start, gain=0.95)
            elif bar == 14:
                place(bass_bus, make_bass_note(root, 1.9), start, gain=1.0)

    # ---- plucked arpeggio: intro quarter notes, build eighths
    arp_order_quarter = [0, 2, 1, 3]
    arp_order_eighth = [0, 1, 2, 3, 2, 1, 2, 3]
    for bar in range(1, 7):
        for start, end, name in chords_in_bar(bar):
            tones = CHORDS[name]["arp"]
            if bar <= 3:
                steps = int(round((end - start) / BEAT))
                for index in range(steps):
                    note = tones[arp_order_quarter[index % 4]]
                    place(pluck_bus, make_pluck(note, 0.9, 1.0, 2.0), start + index * BEAT,
                          pan=(-0.35, 0.35)[index % 2], gain=0.5 if bar == 1 else 0.6)
            else:
                steps = int(round((end - start) / (BEAT / 2)))
                crescendo = 0.55 + 0.1 * (bar - 4)
                for index in range(steps):
                    note = tones[arp_order_eighth[index % 8]]
                    place(pluck_bus, make_pluck(note, 0.5, 1.0, 3.0), start + index * BEAT / 2,
                          pan=(-0.4, 0.4)[index % 2], gain=crescendo)

    # ---- e-piano comp: build (pulse on 1 and 3) and main (syncopated stabs)
    for bar in range(4, 14):
        for start, end, name in chords_in_bar(bar):
            voicing = CHORDS[name]["keys"]
            if bar in (4, 5, 6):
                hits = [(0, 1.5, 0.55), (2, 1.5, 0.5)]
            elif bar == 13:
                hits = [(0, 0.9, 0.9), (1.5, 0.45, 0.7), (2.5, 0.4, 0.7)]
            else:
                hits = [(0, 0.9, 0.9), (1.5, 0.45, 0.75), (2.5, 0.45, 0.75)]
            for beat, length_beats, velocity in hits:
                hit_time = beat_time(bar, beat)
                if not (start - 1e-6 <= hit_time < end - 1e-6):
                    continue
                for index, note in enumerate(voicing):
                    place(keys_bus, make_epiano_note(note, length_beats * BEAT, velocity),
                          hit_time + index * 0.006, pan=-0.25 + index * 0.17, gain=0.2)
    # sting chord on the e-piano
    for index, note in enumerate(CHORDS["Dmaj9"]["keys"] + ["D5"]):
        place(keys_bus, make_epiano_note(note, 1.6, 1.0), beat_time(14) + index * 0.004, pan=-0.3 + index * 0.15, gain=0.24)

    # ---- hook (lead)
    for bar, beat, length_beats, note in HOOK:
        seconds = length_beats * BEAT * (0.95 if bar < 14 else 1.0)
        if bar == 14:
            seconds = 2.0
        left, right = make_lead_note(note, seconds)
        place_stereo(lead_bus, left, right, beat_time(bar, beat), gain=0.5 if bar < 14 else 0.65)
    # shimmering bells on the sting: D major with the 9th
    for note, pan in [("D6", -0.4), ("A6", 0.4), ("F#6", 0.0), ("E6", 0.2)]:
        place(lead_bus, make_pluck(note, 2.0, 0.6, 1.4), beat_time(14), pan=pan, gain=0.28)

    # ---- drums
    def add_kick(time_seconds, velocity=1.0):
        place(drum_bus, make_kick(1.0), time_seconds, gain=0.75 * velocity)
        kick_times.append(time_seconds)

    def add_clap(time_seconds, velocity=1.0, alternate=False):
        sample = samples["clap_alt" if alternate else "clap"]
        place(drum_bus, make_snap(sample, 1.0), time_seconds, pan=0.05, gain=0.5 * velocity)
        reverb_send_bus_place(time_seconds, make_snap(sample, 1.0), 0.5 * velocity * 0.45)

    def reverb_send_bus_place(time_seconds, audio, gain):
        place(reverb_send, audio, time_seconds, gain=gain)

    def add_hat(time_seconds, decay, velocity, pan):
        place(drum_bus, make_hat(decay, 1.0), time_seconds, pan=pan, gain=0.26 * velocity)

    def add_shaker(time_seconds, index, velocity):
        key = "shaker_down" if index % 2 == 0 else "shaker_up"
        sample = filtered(samples[key][:int(0.2 * SAMPLE_RATE)], "high", 2500)
        sample = sample * np.minimum(1.0, (len(sample) - np.arange(len(sample))) / 800.0)
        place(shaker_bus, sample, time_seconds, pan=0.3 if index % 2 == 0 else -0.3, gain=0.22 * velocity)

    for bar in range(4, 15):
        for beat in range(4):
            beat_start = beat_time(bar, beat)
            if bar == 4:
                if beat in (0, 2):
                    add_kick(beat_start, 0.6)
            elif bar in (5, 6):
                if not (bar == 6 and beat == 3):
                    add_kick(beat_start, 0.72 if bar == 5 else 0.82)
                if beat in (1, 3) and not (bar == 6 and beat == 3):
                    add_clap(beat_start, 0.55)
                add_hat(beat_start + BEAT / 2, 0.04, 0.8, 0.35)
            elif bar in (7, 8, 9, 10, 11, 12):
                add_kick(beat_start, 1.0)
                if beat in (1, 3):
                    add_clap(beat_start, 1.0, alternate=(beat == 3))
                add_hat(beat_start + BEAT / 2, 0.05 if beat < 3 else 0.16, 0.9, 0.35)
                add_hat(beat_start, 0.025, 0.28, -0.25)
                add_hat(beat_start + BEAT * 0.75, 0.02, 0.2, 0.2)
                add_shaker(beat_start, bar * 4 + beat, 0.8)
                add_shaker(beat_start + BEAT / 2, bar * 4 + beat + 1, 0.55)
            elif bar == 13:
                if beat < 3:
                    add_kick(beat_start, 1.0 if beat != 2 else 0.9)
                if beat in (1,):
                    add_clap(beat_start, 1.0)
                add_hat(beat_start + BEAT / 2, 0.05, 0.8, 0.35)
                add_shaker(beat_start, bar * 4 + beat, 0.7)
    # snare roll at the end of the build (bar 6, last beat) and the fill in bar 13 (last beat)
    for roll_bar, base in [(6, 0.45), (13, 0.7)]:
        roll_beat_start = beat_time(roll_bar, 3)
        steps = 8
        for index in range(steps):
            velocity = base + (1.0 - base) * index / (steps - 1)
            add_clap(roll_beat_start + index * BEAT / 8, velocity * 0.9, alternate=bool(index % 2))
        if roll_bar == 6:
            for index in range(4):
                add_clap(beat_time(6, 2) + index * BEAT / 2, 0.45 + 0.1 * index, alternate=bool(index % 2))
    # impact on the downbeat of bar 7 and the sting on bar 14
    for impact_bar, strength in [(7, 0.9), (14, 1.25)]:
        impact_time = beat_time(impact_bar)
        add_kick(impact_time, 1.0 * (1.0 if impact_bar == 7 else 1.1))
        add_clap(impact_time, 0.8 * strength)
        left, right = make_noise_hit(3.0, 0.9 if impact_bar == 14 else 0.7, 3200)
        place_stereo(fx_bus, left, right, impact_time, gain=0.08 * strength)
        place(fx_bus, make_boom(), impact_time, gain=0.5 * strength)

    # ---- risers
    riser = make_riser(2 * BAR)
    place_stereo(fx_bus, riser[0], riser[1], beat_time(5), gain=0.09)
    riser2 = make_riser(BAR - 0.01, start_hz=800, end_hz=12000)
    place_stereo(fx_bus, riser2[0], riser2[1], beat_time(13), gain=0.06)

    # ---- sidechain ducking from the kicks
    duck_heavy = duck_curve(kick_times, 0.5)
    duck_light = duck_curve(kick_times, 0.22)
    pad_bus *= duck_heavy
    bass_bus *= duck_curve(kick_times, 0.55, release=0.12)
    keys_bus *= duck_light
    pluck_bus *= duck_light

    # ---- drum bus soft clip so the kick does not set the limiter's job
    drum_bus = np.tanh(drum_bus * 1.3) / 1.3

    # ---- effects: send levels per bus
    reverb_send += pad_bus * 0.30
    reverb_send += keys_bus * 0.45
    reverb_send += pluck_bus * 0.40
    reverb_send += lead_bus * 0.38
    reverb_send += fx_bus * 0.35
    reverb_send += shaker_bus * 0.05
    reverb = apply_reverb(reverb_send)

    delay_source = lead_bus + pluck_bus * 0.55
    delay = ping_pong_delay(delay_source, 0.75 * BEAT, 0.5, 6)

    bus_gains = dict(pad=0.55, bass=0.36, keys=1.3, pluck=1.3, lead=0.65, drums=1.0, shaker=3.0, fx=1.0)
    buses = dict(pad=pad_bus, bass=bass_bus, keys=keys_bus, pluck=pluck_bus, lead=lead_bus,
                 drums=drum_bus, shaker=shaker_bus, fx=fx_bus)
    main_slice = slice(int(beat_time(7) * SAMPLE_RATE), int(beat_time(13) * SAMPLE_RATE))
    for name, bus in buses.items():
        rms = np.sqrt(np.mean(bus[:, main_slice] ** 2))
        print(f"  bus {name:7s} main-section RMS {20 * np.log10(rms + 1e-12):6.1f} dBFS (before bus gain {bus_gains[name]})")
    dry = sum(buses[name] * bus_gains[name] for name in buses)
    mix = dry + 0.85 * reverb + 0.55 * delay
    # section macro level: quiet intro, rising build, full main and ending (dB)
    macro_db = curve([(0, -9), (beat_time(3), -7), (beat_time(4), -5.5), (beat_time(6), -3),
                      (beat_time(7) - 0.01, -2), (beat_time(7), 0), (beat_time(14), 0), (beat_time(14) + 0.75, -2),
                      (beat_time(14) + 1.4, -10), (DURATION - 0.3, -22), (DURATION, -40)])
    mix = mix * (10 ** (macro_db / 20))[None, :]
    mix = mix[:, :TOTAL_SAMPLES]
    return mix, dict(kick_times=kick_times)


# ---------------------------------------------------------------- master

def true_peak_db(stereo):
    upsampled = signal.resample_poly(stereo, 4, 1, axis=1)
    return 20 * np.log10(np.max(np.abs(upsampled)) + 1e-12)


def look_ahead_limit(stereo, ceiling_db, window=240):
    ceiling = 10 ** (ceiling_db / 20)
    upsampled = signal.resample_poly(stereo, 4, 1, axis=1)
    peak = np.max(np.abs(upsampled), axis=0)
    peak = peak[:stereo.shape[1] * 4].reshape(-1, 4).max(axis=1) if len(peak) >= stereo.shape[1] * 4 else peak
    needed = np.minimum(1.0, ceiling / (peak + 1e-12))
    gain = ndimage.minimum_filter1d(needed, size=2 * window + 1)
    gain = ndimage.uniform_filter1d(gain, size=window + 1)
    return stereo * gain, 20 * np.log10(np.min(gain))


def master(mix):
    meter = pyloudnorm.Meter(SAMPLE_RATE)
    audio = filtered(mix, "high", 28, order=2)  # remove DC and rumble
    audio = audio * 10 ** ((-20.0 - meter.integrated_loudness(audio.T)) / 20)  # park at -20 LUFS first
    audio = np.tanh(audio * 1.4) / 1.4  # gentle saturation, only rounds the loudest peaks
    # tail: cosine fade over the last 0.35 s so the ring-out ends on exactly zero
    fade_samples = int(0.35 * SAMPLE_RATE)
    audio[:, -fade_samples:] *= (0.5 * (1 + np.cos(np.linspace(0, np.pi, fade_samples))))[None, :]
    audio[:, :int(0.004 * SAMPLE_RATE)] *= np.linspace(0, 1, int(0.004 * SAMPLE_RATE))[None, :]

    gain_db = 6.0
    limited = audio
    reduction = 0.0
    for _ in range(8):
        scaled = audio * 10 ** (gain_db / 20)
        limited, reduction = look_ahead_limit(scaled, TRUE_PEAK_CEILING_DB)
        loudness = meter.integrated_loudness(limited.T)
        error = TARGET_LUFS - loudness
        print(f"  master pass: gain {gain_db:+.2f} dB -> {loudness:.2f} LUFS, max limiter reduction {reduction:.2f} dB")
        if abs(error) < 0.05:
            break
        gain_db += error
    return limited, dict(lufs=loudness, max_reduction_db=reduction, gain_db=gain_db)


# ---------------------------------------------------------------- structure.json

def write_structure():
    bars = []
    chord_timeline = []
    for bar in range(1, TOTAL_BARS + 1):
        section = next(s["name"] for s in SECTIONS if s["first_bar"] <= bar <= s["last_bar"])
        chords = [dict(chord=name, start_s=round(start, 4), end_s=round(end, 4)) for start, end, name in chords_in_bar(bar)]
        chord_timeline.extend(chords)
        bars.append(dict(bar=bar, start_s=round(beat_time(bar), 4), section=section,
                         beats_s=[round(beat_time(bar, beat), 4) for beat in range(4)], chords=chords))
    sections = []
    for section in SECTIONS:
        sections.append(dict(name=section["name"], description=section["description"],
                             first_bar=section["first_bar"], last_bar=section["last_bar"],
                             start_s=round(beat_time(section["first_bar"]), 4),
                             end_s=round(beat_time(section["last_bar"] + 1), 4)))
    structure = dict(
        title="Orglet trailer theme (code-generated trial)",
        duration_s=round(DURATION, 4),
        bpm=BPM,
        time_signature="4/4",
        key="D major",
        beat_s=round(BEAT, 6),
        bar_s=round(BAR, 6),
        total_bars=TOTAL_BARS,
        total_beats=TOTAL_BARS * 4,
        sections=sections,
        key_moments=dict(
            drop_downbeat_s=round(beat_time(7), 4),
            riser_start_s=round(beat_time(5), 4),
            snare_roll_start_s=round(beat_time(6, 2), 4),
            pre_sting_fill_s=round(beat_time(13, 3), 4),
            sting_hit_s=round(beat_time(14), 4),
            end_s=round(DURATION, 4),
        ),
        beats_s=[round(beat_time(1, beat), 4) for beat in range(TOTAL_BARS * 4 + 1)],
        downbeats_s=[round(beat_time(bar), 4) for bar in range(1, TOTAL_BARS + 2)],
        bars=bars,
        notes=("Bars are snapped to 112 BPM, so section boundaries fall on bar lines (6.43, 12.86, 25.71 s) "
               "instead of the round 6, 12, 26 s. The sting chord lands on the downbeat of bar 14 (27.857 s) "
               "and rings for one bar; beat 57 (30.000 s) is the end of the file."),
    )
    (HERE / "structure.json").write_text(json.dumps(structure, indent=2), encoding="utf-8")


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    lower_priority()
    started = time.time()
    print(f"{BPM} BPM, {TOTAL_BARS} bars, {DURATION:.4f} s")
    mix, info = render()
    print(f"rendered in {time.time() - started:.1f} s; mastering")
    mastered, master_info = master(mix)
    soundfile.write(HERE / "orglet-theme.wav", mastered.T, SAMPLE_RATE, subtype="PCM_24")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(HERE / "orglet-theme.wav"),
                    "-c:a", "libmp3lame", "-b:a", "320k", str(HERE / "orglet-theme.mp3")], check=True)
    write_structure()
    print(json.dumps(master_info))
    print(f"done in {time.time() - started:.1f} s")


if __name__ == "__main__":
    main()
