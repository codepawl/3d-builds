"""Synthesizes the trailer cue with numpy: 84 BPM, D minor, warm strings and pad, piano-like plucks, riser, impact.

Run: uv run --no-project --python 3.12 --with numpy --with scipy --with soundfile --with pyloudnorm python make_music.py <out.wav>
The picture is cut on this beat grid (BEAT seconds per beat), 64 beats in total.
"""
import sys
from pathlib import Path

import numpy as np
import pyloudnorm
import scipy.signal
import soundfile

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SAMPLE_RATE = 48000
BPM = 84
BEAT = 60 / BPM
TOTAL_BEATS = 64
TOTAL_SECONDS = TOTAL_BEATS * BEAT
TURNTABLE_START = 28  # beat where the turntable run starts
IMPACT_BEAT = 56      # beat of the end card

NOTE_OFFSETS = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def frequency(name):
    letter, octave = name[0], int(name[-1])
    semitone = NOTE_OFFSETS[letter] + (1 if "#" in name else 0) - (1 if "b" in name else 0)
    return 440.0 * 2 ** ((semitone + 12 * (octave - 4) - 9) / 12)


# One chord per bar (4 beats): bass note and the triad voiced above it.
CHORDS = [
    ("D2", ["D3", "F3", "A3", "D4"]),
    ("Bb1", ["Bb2", "D3", "F3", "Bb3"]),
    ("F2", ["F3", "A3", "C4", "F4"]),
    ("C2", ["C3", "E3", "G3", "C4"]),
    ("D2", ["D3", "F3", "A3", "D4"]),
    ("Bb1", ["Bb2", "D3", "F3", "Bb3"]),
    ("G2", ["G3", "Bb3", "D4", "G4"]),
    ("A1", ["A2", "C#3", "E3", "A3"]),
] * 2
MOTIF = ["A4", "D5", "F5", "E5", "D5", "A4"]  # piano motif, one note per beat pair in the opening


def seconds_axis(seconds):
    return np.arange(int(seconds * SAMPLE_RATE)) / SAMPLE_RATE


def lowpass(signal, cutoff, order=2):
    sos = scipy.signal.butter(order, cutoff, "lowpass", fs=SAMPLE_RATE, output="sos")
    return scipy.signal.sosfilt(sos, signal)


def highpass(signal, cutoff, order=2):
    sos = scipy.signal.butter(order, cutoff, "highpass", fs=SAMPLE_RATE, output="sos")
    return scipy.signal.sosfilt(sos, signal)


def place(track, start_seconds, sound):
    first = int(start_seconds * SAMPLE_RATE)
    last = min(track.shape[-1], first + sound.shape[-1])
    if first < track.shape[-1]:
        track[..., first:last] += sound[..., : last - first]


def stereo(sound, pan):
    left = np.cos((pan + 1) * np.pi / 4)
    right = np.sin((pan + 1) * np.pi / 4)
    return np.stack([sound * left, sound * right])


def string_note(note, seconds, attack=0.5, release=0.9):
    """Detuned sawtooth voices through a low-pass with slow vibrato: a warm, bowed pad."""
    t = seconds_axis(seconds + release)
    base = frequency(note)
    voice = np.zeros_like(t)
    for detune_cents in (-9, -3, 4, 10):
        vibrato = 1 + 0.0025 * np.sin(2 * np.pi * 5.2 * t + detune_cents)
        phase = 2 * np.pi * np.cumsum(base * 2 ** (detune_cents / 1200) * vibrato) / SAMPLE_RATE
        voice += scipy.signal.sawtooth(phase) + 0.4 * np.sin(phase)
    voice = lowpass(voice, min(2400, base * 5))
    envelope = np.minimum(1, t / attack) * np.where(t < seconds, 1, np.exp(-(t - seconds) * 5 / release))
    return voice * envelope * 0.25


def pluck(note, volume=1.0, length=2.4):
    """Piano-like tone: a few inharmonic partials with fast decay on the upper ones."""
    t = seconds_axis(length)
    base = frequency(note)
    tone = np.zeros_like(t)
    for harmonic, weight, decay in ((1, 1.0, 1.6), (2, 0.5, 2.6), (3, 0.28, 3.6), (4, 0.16, 5.0), (5, 0.08, 6.5)):
        stretch = 1 + 0.0004 * harmonic ** 2
        tone += weight * np.sin(2 * np.pi * base * harmonic * stretch * t) * np.exp(-decay * t)
    hammer = np.random.default_rng(int(base)).standard_normal(len(t)) * np.exp(-t * 90) * 0.05
    return volume * 0.5 * (tone + lowpass(hammer, 3000)) * np.minimum(1, t / 0.003)


def sub_hit(volume, length=0.9):
    t = seconds_axis(length)
    sweep = 38 + 55 * np.exp(-t * 14)
    return volume * np.sin(2 * np.pi * np.cumsum(sweep) / SAMPLE_RATE) * np.exp(-t * 3.2)


def noise_rise(seconds, rng):
    """Filtered noise riser: brightness and level grow towards the end."""
    t = seconds_axis(seconds)
    noise = rng.standard_normal((2, len(t)))
    progress = t / seconds
    blocks = np.zeros_like(noise)
    for cutoff, lower, upper in ((400, 0.0, 0.35), (1200, 0.25, 0.65), (3500, 0.5, 0.9), (7500, 0.7, 1.0)):
        band = lowpass(noise, cutoff)
        gate = np.clip((progress - lower) / (upper - lower), 0, 1)
        blocks += band * gate
    return blocks * progress ** 2.2 * 0.22


def reverb_impulse(seconds, rng):
    t = seconds_axis(seconds)
    decay = np.exp(-t * 2.3)
    impulse = rng.standard_normal((2, len(t))) * decay
    impulse = lowpass(impulse, 5500)
    impulse[:, : int(0.02 * SAMPLE_RATE)] *= np.linspace(0, 1, int(0.02 * SAMPLE_RATE))
    return impulse / np.sqrt(np.sum(impulse ** 2, axis=1, keepdims=True)) * 0.9


def build():
    rng = np.random.default_rng(84)
    length = int((TOTAL_SECONDS + 2.5) * SAMPLE_RATE)
    strings = np.zeros((2, length))
    bass = np.zeros((2, length))
    piano = np.zeros((2, length))
    drums = np.zeros((2, length))
    fx = np.zeros((2, length))

    for bar, (bass_note, chord_notes) in enumerate(CHORDS):
        start = bar * 4 * BEAT
        # Pad swells in over the first bars and fills out for the run and the end.
        fullness = 0.35 if bar < 2 else 0.6 if bar < 7 else 0.9 if bar < 14 else 1.0
        for index, note in enumerate(chord_notes):
            pan = (index - 1.5) * 0.35
            place(strings, start, stereo(string_note(note, 4 * BEAT, attack=0.9) * fullness, pan))
        place(bass, start, stereo(string_note(bass_note, 4 * BEAT, attack=0.25, release=0.5) * 1.3 * (0.4 if bar < 2 else 1), 0))

    # Piano motif: two bars of sparse notes, then an eighth-note arpeggio for the turntable run.
    for index, note in enumerate(MOTIF):
        place(piano, (1 + index * 1.5) * BEAT + 0.0, stereo(pluck(note, 0.9), -0.2 + 0.1 * index))
    for bar in range(4, 14):
        chord = CHORDS[bar][1]
        arpeggio = [chord[0], chord[1], chord[2], chord[3], chord[2], chord[1]]
        notes_per_bar = 8 if bar >= 7 else 4
        for step in range(notes_per_bar):
            time_in_bar = step * 4 * BEAT / notes_per_bar
            note = arpeggio[step % len(arpeggio)]
            raised = note[:-1] + str(int(note[-1]) + 1)
            place(piano, bar * 4 * BEAT + time_in_bar, stereo(pluck(raised, 0.5 if bar < 7 else 0.65, 1.8), 0.3 - 0.6 * (step % 2)))

    # Soft pulse: a low thump on every beat from the first turntable, quieter heartbeat before.
    for beat in range(TOTAL_BEATS):
        if beat >= IMPACT_BEAT:
            break
        if beat >= TURNTABLE_START - 4:
            place(drums, beat * BEAT, stereo(sub_hit(0.55 if beat >= TURNTABLE_START else 0.3, 0.5), 0))
            if beat >= TURNTABLE_START:
                tick = highpass(rng.standard_normal(int(0.05 * SAMPLE_RATE)), 6000) * np.exp(-seconds_axis(0.05) * 90) * 0.1
                place(drums, beat * BEAT + BEAT / 2, stereo(tick, 0.4))
        elif beat % 4 == 0 and beat > 0:
            place(drums, beat * BEAT, stereo(sub_hit(0.22, 0.7), 0))

    # Riser into the turntable run and a reverse swell before the impact.
    riser_start = (TURNTABLE_START - 10) * BEAT
    place(fx, riser_start, noise_rise(10 * BEAT, rng))
    place(fx, (IMPACT_BEAT - 3) * BEAT, noise_rise(3 * BEAT, rng) * 0.9)

    # Impact on the end card: sub drop, noise burst, final open chord with a long tail.
    impact_time = IMPACT_BEAT * BEAT
    place(fx, impact_time - 0.02, stereo(sub_hit(1.1, 2.8), 0))
    burst = lowpass(rng.standard_normal((2, int(2.5 * SAMPLE_RATE))), 5000) * np.exp(-seconds_axis(2.5) * 3.5) * 0.35
    place(fx, impact_time, burst)
    for note in ("D2", "A2", "D3", "F3", "A3", "D4", "A4", "F5"):
        place(strings, impact_time, stereo(string_note(note, 3.4 * BEAT + 1.0, attack=0.08, release=1.8) * 1.2, rng.uniform(-0.5, 0.5)))
    place(piano, impact_time + 0.05, stereo(pluck("D4", 0.9, 4.0), -0.2))
    place(piano, impact_time + 0.05, stereo(pluck("A4", 0.7, 4.0), 0.2))

    dry = strings * 0.9 + bass * 0.9 + piano * 0.9 + drums * 1.0 + fx
    impulse = reverb_impulse(2.6, rng)
    wet = np.stack([
        scipy.signal.fftconvolve(strings[0] + piano[0] + fx[0] * 0.5, impulse[0])[:length],
        scipy.signal.fftconvolve(strings[1] + piano[1] + fx[1] * 0.5, impulse[1])[:length],
    ])
    mix = dry + wet * 0.42
    mix = np.stack([highpass(channel, 28) for channel in mix])
    # Gentle fades at the very start and over the final second of the video.
    seconds = np.arange(length) / SAMPLE_RATE
    mix *= np.minimum(1, seconds / 1.2)
    mix *= np.clip((TOTAL_SECONDS + 2.3 - seconds) / 1.8, 0, 1)
    return mix.T


def true_peak_dbfs(audio):
    oversampled = scipy.signal.resample_poly(audio, 4, 1, axis=0)
    return 20 * np.log10(np.max(np.abs(oversampled)))


def master(audio):
    meter = pyloudnorm.Meter(SAMPLE_RATE)
    for _ in range(4):
        loudness = meter.integrated_loudness(audio)
        audio = audio * 10 ** ((-16.0 - loudness) / 20)
        # Soft limiter keeps peaks under the ceiling without flattening the dynamics.
        audio = np.tanh(audio / 0.85) * 0.85 if np.max(np.abs(audio)) > 0.85 else audio
    peak = true_peak_dbfs(audio)
    if peak > -1.2:
        audio = audio * 10 ** ((-1.4 - peak) / 20)
    return audio


if __name__ == "__main__":
    output_path = Path(sys.argv[1])
    audio = master(build())
    soundfile.write(output_path, audio, SAMPLE_RATE, subtype="PCM_24")
    meter = pyloudnorm.Meter(SAMPLE_RATE)
    print(f"duration {len(audio) / SAMPLE_RATE:.2f}s  loudness {meter.integrated_loudness(audio):.2f} LUFS  true peak {true_peak_dbfs(audio):.2f} dBFS")
