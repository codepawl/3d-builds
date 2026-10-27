"""Trailer v3 score: 120 BPM, A major, electric piano + marimba + warm pad + soft sub pulse, no noise layers.

Run: uv run --no-project --python 3.12 --with numpy --with scipy --with soundfile --with pyloudnorm python make_music_v3.py <out.wav>
94 beats = 47 s. Sections (bars of 4 beats = 2 s): bars 0-3 sparse, 4-7 pulse, 8-11 arpeggio, 12-15 fuller, 16-20 full, then it resolves on the end card (beat 84).
"""
import sys
from pathlib import Path

import numpy as np
import scipy.signal
import soundfile
import pyloudnorm

from make_music import (SAMPLE_RATE, frequency, seconds_axis, highpass, place, stereo,
                        string_note, reverb_impulse, master, true_peak_dbfs)

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BPM = 120
BEAT = 60 / BPM
TOTAL_BEATS = 94
TOTAL_SECONDS = TOTAL_BEATS * BEAT
END_BEAT = 84

# One chord per bar: bass, pad voicing, arpeggio notes (low to high).
A_MAJ = ("A1", ["A3", "C#4", "E4", "A4"], ["A4", "C#5", "E5", "B5"])
E_MAJ = ("E2", ["G#3", "B3", "E4", "G#4"], ["B4", "E5", "G#5", "B5"])
F_MIN = ("F#1", ["A3", "C#4", "F#4", "A4"], ["A4", "C#5", "F#5", "C#6"])
D_MAJ = ("D2", ["A3", "D4", "F#4", "A4"], ["A4", "D5", "F#5", "A5"])
PROGRESSION = [A_MAJ, E_MAJ, F_MIN, D_MAJ]
ARPEGGIO_ORDER = [0, 1, 2, 3, 2, 1, 2, 1]


def electric_piano(note, volume=1.0, length=1.6):
    """Soft FM tine: sine carrier, a decaying modulator one octave up."""
    t = seconds_axis(length)
    base = frequency(note)
    index = 1.6 * np.exp(-t * 5.0)
    tone = np.sin(2 * np.pi * base * t + index * np.sin(2 * np.pi * base * 2 * t))
    tone += 0.25 * np.sin(2 * np.pi * base * 4 * t) * np.exp(-t * 9)
    return volume * 0.4 * tone * np.exp(-t * 2.4) * np.minimum(1, t / 0.004)


def marimba(note, volume=1.0, length=0.9):
    t = seconds_axis(length)
    base = frequency(note)
    tone = np.sin(2 * np.pi * base * t) * np.exp(-t * 7) + 0.35 * np.sin(2 * np.pi * base * 4 * t) * np.exp(-t * 22)
    return volume * 0.5 * tone * np.minimum(1, t / 0.002)


def soft_kick(volume):
    t = seconds_axis(0.35)
    sweep = 52 + 70 * np.exp(-t * 28)
    return volume * np.sin(2 * np.pi * np.cumsum(sweep) / SAMPLE_RATE) * np.exp(-t * 11)


def build():
    rng = np.random.default_rng(2026)
    length = int((TOTAL_SECONDS + 3.0) * SAMPLE_RATE)
    pad = np.zeros((2, length))
    bass = np.zeros((2, length))
    keys = np.zeros((2, length))
    mallet = np.zeros((2, length))
    pulse = np.zeros((2, length))
    final_bar = END_BEAT // 4

    for bar in range(final_bar):
        start = bar * 4 * BEAT
        bass_note, pad_notes, arpeggio_notes = PROGRESSION[bar % 4]
        fullness = 0.3 if bar < 4 else 0.5 if bar < 8 else 0.7 if bar < 12 else 0.9 if bar < 16 else 1.05
        for index, note in enumerate(pad_notes):
            place(pad, start, stereo(string_note(note, 4 * BEAT + 0.3, attack=0.7, release=0.8) * fullness * 0.8, (index - 1.5) * 0.3))
        if bar >= 4:
            place(bass, start, stereo(string_note(bass_note, 4 * BEAT, attack=0.1, release=0.4) * 1.6, 0))

        if bar < 4:
            # Sparse opening: two tines per bar, under the text cards.
            place(keys, start + BEAT, stereo(electric_piano(arpeggio_notes[bar % 4], 0.7), -0.15))
            place(keys, start + 2.5 * BEAT, stereo(electric_piano(arpeggio_notes[(bar + 2) % 4], 0.5), 0.2))
        else:
            if bar >= 8:
                for step, order in enumerate(ARPEGGIO_ORDER):
                    volume = 0.55 if bar < 16 else 0.7
                    place(mallet, start + step * BEAT / 2, stereo(marimba(arpeggio_notes[order], volume), 0.35 - 0.7 * (step % 2)))
            for beat in range(4):
                place(keys, start + beat * BEAT, stereo(electric_piano(pad_notes[beat], 0.35 + 0.1 * min(bar, 12) / 12), -0.1 + 0.07 * beat))
            for beat in range(4):
                place(pulse, start + beat * BEAT, stereo(soft_kick(0.5 if bar < 12 else 0.62), 0))

    # Resolution on the end card: open A major add9 with long tails, then three tines.
    end_time = END_BEAT * BEAT
    for index, note in enumerate(("A2", "E3", "A3", "C#4", "E4", "B4", "A4")):
        place(pad, end_time, stereo(string_note(note, 5.5, attack=0.12, release=2.0) * 1.1, (index - 3) * 0.18))
    place(bass, end_time, stereo(string_note("A1", 5.5, attack=0.08, release=1.5) * 1.8, 0))
    place(keys, end_time + 0.02, stereo(electric_piano("A4", 1.0, 3.5), -0.15))
    place(keys, end_time + 0.5, stereo(electric_piano("E5", 0.8, 3.5), 0.15))
    place(keys, end_time + 1.0, stereo(electric_piano("C#5", 0.7, 3.5), 0.0))
    place(pulse, end_time, stereo(soft_kick(0.7), 0))

    dry = pad * 0.9 + bass * 0.9 + keys + mallet * 0.9 + pulse
    impulse = reverb_impulse(2.4, rng)
    wet = np.stack([
        scipy.signal.fftconvolve(pad[0] + keys[0] + mallet[0], impulse[0])[:length],
        scipy.signal.fftconvolve(pad[1] + keys[1] + mallet[1], impulse[1])[:length],
    ])
    mix = dry + wet * 0.4
    mix = np.stack([highpass(channel, 30) for channel in mix])
    seconds = np.arange(length) / SAMPLE_RATE
    mix *= np.minimum(1, seconds / 1.0)
    mix *= np.clip((TOTAL_SECONDS - seconds) / 1.0, 0, 1)
    return mix[:, : int(TOTAL_SECONDS * SAMPLE_RATE)].T


if __name__ == "__main__":
    audio = master(build())
    soundfile.write(Path(sys.argv[1]), audio, SAMPLE_RATE, subtype="PCM_24")
    meter = pyloudnorm.Meter(SAMPLE_RATE)
    print(f"duration {len(audio) / SAMPLE_RATE:.2f}s  loudness {meter.integrated_loudness(audio):.2f} LUFS  true peak {true_peak_dbfs(audio):.2f} dBFS")
