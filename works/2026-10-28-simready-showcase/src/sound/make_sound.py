"""Builds sound/simready-optimized.wav: soft effects on every logged input and cue, over a music bed.

Inputs: out/input_events.json (every click, drag step and key press the recorder performed, with its frame) and
out/cue_events.json (transitions, slides and counter ticks from web/src/script.js, in seconds). The script stops with
an error on an input it has no sound for, and checks that every input has sound energy on its frame.
Effects are real CC0 Freesound recordings, small and soft: a light mouse click, a soft whoosh, a quiet tick.
Music is Hypnothis by Kevin MacLeod (incompetech.com, CC BY 4.0), ducked under the effects, faded in and out.
Mix: about -16 LUFS integrated, true peak under -1 dBFS. See CREDITS.md for sources and licences.
Env for another film: INPUTS (events json), CUES (optional), SECONDS (film length), OUTPUT (wav path).
Run: uv run --offline --no-project --python 3.12 --with numpy --with scipy --with soundfile --with pyloudnorm python sound/make_sound.py
"""
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import numpy as np
import pyloudnorm
import soundfile
from scipy import signal
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_FOLDER = os.path.join(PROJECT, "sound", "sources")
SAMPLE_RATE = 48000
FRAMES_PER_SECOND = 30
TARGET_LUFS = -16.0
TRUE_PEAK_CEILING_DB = -1.3
MUSIC_LUFS = -20.0
EFFECT_PEAK = 0.2
DUCK_DEPTH = 0.32  # the music loses up to this fraction of its level under an effect
MUSIC_START_SECONDS = 0.0
MUSIC_FADE_IN_SECONDS = 1.6
MUSIC_FADE_OUT_SECONDS = 3.0

SOURCES = {
    "click_a": "click_mouse_a_683099_florianreichelt.ogg",
    "click_b": "click_mouse_b_678248_Pixeliota.ogg",
    "keypress": "click_b_397602_Nightflame.ogg",
    "tick_a": "tick_a_384187_malle99.ogg",
    "tick_b": "tick_b_528561_Jummit.ogg",
    "whoosh_soft": "whoosh_soft_a_71852_ludvique.ogg",
    "whoosh_light": "whoosh_light_b_701104_xkeril.ogg",
    "whoosh_swipe": "whoosh_swipe_c_60007_qubodup.ogg",
    "music": "music_hypnothis_kevin_macleod.mp3",
}


def load(name, mono=True):
    data, rate = soundfile.read(os.path.join(SOURCE_FOLDER, SOURCES[name]), always_2d=True)
    if rate != SAMPLE_RATE:
        data = signal.resample_poly(data, SAMPLE_RATE, rate, axis=0)
    return data.mean(axis=1) if mono else data


def pitch(samples, factor):
    return samples if factor == 1.0 else signal.resample(samples, int(len(samples) / factor))


def first_hit(samples):
    onset = int(np.argmax(np.abs(samples) > 0.2 * np.max(np.abs(samples))))
    return samples[max(0, onset - int(0.004 * SAMPLE_RATE)):]


def shaped(samples, length_seconds, fade_in_seconds, fade_out_seconds, low_pass_hz, high_pass_hz=0):
    """A source cut to length with soft edges and a gentle filter, normalised to a peak of 1."""
    samples = samples[: int(length_seconds * SAMPLE_RATE)].copy()
    if high_pass_hz:
        samples = signal.sosfilt(signal.butter(2, high_pass_hz, "high", fs=SAMPLE_RATE, output="sos"), samples)
    samples = signal.sosfilt(signal.butter(2, low_pass_hz, "low", fs=SAMPLE_RATE, output="sos"), samples)
    fade_in = max(1, int(fade_in_seconds * SAMPLE_RATE))
    fade_out = max(1, int(fade_out_seconds * SAMPLE_RATE))
    samples[:fade_in] *= np.linspace(0, 1, fade_in)
    samples[-fade_out:] *= np.linspace(1, 0, fade_out)
    return samples / (np.max(np.abs(samples)) + 1e-9)


def click(name, pitch_factor, gain):
    samples = pitch(first_hit(load(name)), pitch_factor)
    return shaped(samples, 0.16, 0.0015, 0.08, 7000) * gain


def tick(name, gain):
    return shaped(first_hit(load(name)), 0.07, 0.001, 0.04, 6000) * gain


def whoosh(name, length_seconds, gain, pitch_factor=1.0, low_pass_hz=5000):
    samples = pitch(load(name), pitch_factor)
    return shaped(samples, length_seconds, 0.12, 0.35, low_pass_hz, high_pass_hz=250) * gain


class Effects:
    """Accumulates one sound per input or cue on a mono effects bus."""

    def __init__(self, length):
        self.bus = np.zeros(length)
        self.count = {}

    def place(self, sound, seconds):
        begin = int(round(seconds * SAMPLE_RATE))
        end = min(len(self.bus), begin + len(sound))
        self.bus[begin:end] += sound[: end - begin]

    def alternate(self, key, options):
        self.count[key] = self.count.get(key, 0) + 1
        return options[(self.count[key] - 1) % len(options)]


def build_effects(length, inputs, cues):
    effects = Effects(length)
    for event in inputs:
        seconds = event["frame"] / FRAMES_PER_SECOND
        target = event["target"]
        if event["kind"] == "click" and target.startswith(("button:", "row:", "tile:", "input:")):
            name = effects.alternate("click", ["click_a", "click_b"])
            effects.place(click(name, 1.0, 0.8), seconds)
        elif event["kind"] == "click" and target == "slider.grab":
            effects.place(click("click_b", 0.88, 0.7), seconds)
        elif event["kind"] == "click" and target.endswith(".grab"):
            # Grabbing a slider, a part or the stage: a low click, and a soft swipe that carries the drag.
            effects.place(click("click_b", 0.88, 0.7), seconds)
            effects.place(whoosh("whoosh_swipe", 0.5, 0.4, pitch_factor=0.85, low_pass_hz=4000), seconds + 0.05)
        elif event["kind"] == "release":
            continue
        elif event["kind"] == "drag":
            # No tick per drag step: repeated ticks read as tapping a bowl (An, 2026-10-28). The slide whoosh cue
            # carries the drag.
            continue
        elif event["kind"] == "key":
            effects.place(click("keypress", 1.25, 0.6), seconds)
        else:
            raise SystemExit(f"no sound for input {event}")
    for cue in cues:
        if cue["kind"] == "whoosh" and cue["name"] == "transition":
            sound = whoosh(effects.alternate("transition", ["whoosh_soft", "whoosh_light"]), 0.9, 0.55)
        elif cue["kind"] == "whoosh" and cue["name"] == "fast-forward":
            sound = whoosh("whoosh_light", 1.6, 0.5, pitch_factor=1.15)
        elif cue["kind"] == "whoosh" and cue["name"] == "slide":
            sound = whoosh("whoosh_swipe", 0.45, 0.45, pitch_factor=0.9, low_pass_hz=4500)
        elif cue["kind"] == "whoosh" and cue["name"] == "closeup":
            sound = whoosh("whoosh_soft", 0.9, 0.5, pitch_factor=1.1)
        elif cue["kind"] == "tick":
            continue  # counter ticks dropped for the same reason as drag ticks
        else:
            raise SystemExit(f"no sound for cue {cue}")
        effects.place(sound, cue["time"])
    return effects.bus


def true_peak_db(samples):
    return 20 * np.log10(np.max(np.abs(signal.resample_poly(samples, 4, 1, axis=0))) + 1e-12)


def limit(samples, ceiling_db):
    ceiling = 10 ** (ceiling_db / 20)
    window = int(0.004 * SAMPLE_RATE)
    level = np.max(np.abs(samples), axis=1)
    needed = np.minimum(1.0, ceiling / (level + 1e-9))
    gain = uniform_filter1d(minimum_filter1d(needed, window * 2 + 1), window)
    return samples * gain[:, None]


def duck_envelope(effect_bus):
    """1 at rest, falling to 1 - DUCK_DEPTH under an effect: fast attack, slow release."""
    level = np.abs(effect_bus)
    held = maximum_filter1d(level, int(0.08 * SAMPLE_RATE))
    smoothed = np.zeros_like(held)
    attack = 1 - np.exp(-1 / (0.03 * SAMPLE_RATE))
    release = 1 - np.exp(-1 / (0.45 * SAMPLE_RATE))
    value = 0.0
    for index, target in enumerate(np.minimum(1.0, held / (EFFECT_PEAK * 0.5))):
        value += (target - value) * (attack if target > value else release)
        smoothed[index] = value
    return 1 - DUCK_DEPTH * smoothed


def build_music(length):
    music = load("music", mono=False)
    start = int(MUSIC_START_SECONDS * SAMPLE_RATE)
    music = music[start: start + length]
    if len(music) < length:
        raise SystemExit("the music track is shorter than the film")
    if music.shape[1] == 1:
        music = np.repeat(music, 2, axis=1)
    meter = pyloudnorm.Meter(SAMPLE_RATE)
    music = music * 10 ** ((MUSIC_LUFS - meter.integrated_loudness(music)) / 20)
    seconds = np.arange(length) / SAMPLE_RATE
    total = length / SAMPLE_RATE
    fade = np.minimum(np.clip(seconds / MUSIC_FADE_IN_SECONDS, 0, 1), np.clip((total - seconds) / MUSIC_FADE_OUT_SECONDS, 0, 1))
    return music * (fade ** 1.5)[:, None]


def check_every_input_is_heard(effect_bus, inputs):
    for event in inputs:
        if event["kind"] in ("drag", "release"):
            continue
        begin = int(event["frame"] / FRAMES_PER_SECOND * SAMPLE_RATE)
        window = effect_bus[begin: begin + int(0.1 * SAMPLE_RATE)]
        if len(window) == 0 or np.max(np.abs(window)) < 0.02:
            raise SystemExit(f"silent input on frame {event['frame']}: {event}")


def main():
    inputs = json.load(open(os.environ.get("INPUTS", os.path.join(PROJECT, "out", "input_events.json")), encoding="utf-8"))
    cues_path = os.environ.get("CUES", os.path.join(PROJECT, "out", "cue_events.json") if "INPUTS" not in os.environ else "")
    cues = json.load(open(cues_path, encoding="utf-8")) if cues_path else []
    if "SECONDS" in os.environ:
        seconds = float(os.environ["SECONDS"])
    else:
        script = open(os.path.join(PROJECT, "web", "src", "script.js"), encoding="utf-8").read()
        seconds = float(script.split("endSeconds:")[1].split(",")[0])
    length = int(round(seconds * SAMPLE_RATE))

    effect_bus = build_effects(length, inputs, cues)
    effect_bus = effect_bus / np.max(np.abs(effect_bus)) * EFFECT_PEAK
    check_every_input_is_heard(effect_bus, inputs)
    music = build_music(length) * duck_envelope(effect_bus)[:, None]
    mix = music + effect_bus[:, None]

    meter = pyloudnorm.Meter(SAMPLE_RATE)
    gain = 10 ** ((TARGET_LUFS - meter.integrated_loudness(mix)) / 20)
    mix = limit(mix * gain, TRUE_PEAK_CEILING_DB)
    final = meter.integrated_loudness(mix)
    peak = true_peak_db(mix)
    music_only = meter.integrated_loudness(music * gain)
    print(f"inputs {len(inputs)}, cues {len(cues)}, loudness {final:.2f} LUFS, true peak {peak:.2f} dBFS")
    print(f"music alone {music_only:.2f} LUFS, effects peak {20 * np.log10(EFFECT_PEAK * gain):.1f} dBFS, gain {gain:.2f}")
    if peak > -1.0 or abs(final - TARGET_LUFS) > 0.6:
        raise SystemExit("mix is outside the loudness or true peak target")
    output = os.environ.get("OUTPUT", os.path.join(PROJECT, "sound", "simready-optimized.wav"))
    soundfile.write(output, mix, SAMPLE_RATE, subtype="PCM_16")
    print(output)


main()
