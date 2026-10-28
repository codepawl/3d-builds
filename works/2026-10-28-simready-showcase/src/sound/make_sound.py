"""Builds sound/simready-showcase.wav from out/input_events.json and out/state_events.json.
One recorded hit per logged input (click, drag step, key press); a soft whir only while a turbine or the fan spins.
It stops with an error on an input kind it has no sound for.
Run: uv run --no-project --python 3.12 --with numpy --with scipy --with soundfile --with pyloudnorm python sound/make_sound.py"""
import json
import os
import shutil
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import numpy as np
import pyloudnorm
import soundfile
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRID_SOURCES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources")
SAMPLE_RATE = 48000
FRAMES_PER_SECOND = 30
DURATION_SECONDS = 24.0
TARGET_LUFS = -16.0
TRUE_PEAK_CEILING_DB = -1.3

SOURCES = {
    "click_a": "click_a_278205_IanStarGem.ogg",
    "click_b": "click_b_397602_Nightflame.ogg",
    "switch_a": "switch_a_257958_FillSoko.ogg",
    "switch_b": "switch_b_440499_ChrisTutorials.ogg",
    "hum": "hum_148292_RutgerMuller.ogg",
}

# input kind or target prefix -> (source, length seconds, gain, pitch factor)
HIT_FOR_TARGET = {
    "row": ("click_a", 0.22, 1.0, 1.0),
    "button": ("switch_a", 0.30, 1.0, 1.0),
    "vise.handle.grab": ("click_b", 0.20, 1.0, 0.85),
}
HIT_FOR_KIND = {
    "drag": ("switch_b", 0.12, 0.55, 1.0),
    "key": ("click_b", 0.18, 0.9, 1.35),
}


def load(name):
    os.makedirs(os.path.join(PROJECT, "sound", "sources"), exist_ok=True)
    local = os.path.join(PROJECT, "sound", "sources", SOURCES[name])
    if not os.path.exists(local):
        shutil.copy(os.path.join(GRID_SOURCES, SOURCES[name]), local)
    data, rate = soundfile.read(local)
    mono = data.mean(axis=1) if data.ndim > 1 else data
    if rate != SAMPLE_RATE:
        mono = signal.resample_poly(mono, SAMPLE_RATE, rate)
    return mono.astype(np.float64)


def pitch(samples, factor):
    if factor == 1.0:
        return samples
    return signal.resample(samples, int(len(samples) / factor))


def dry_hit(name, length_seconds, gain, pitch_factor, variation=0.0):
    samples = load(name)
    onset = int(np.argmax(np.abs(samples) > 0.12 * np.max(np.abs(samples))))
    start = max(0, onset - int(0.004 * SAMPLE_RATE))
    samples = pitch(samples[start: start + int(length_seconds * SAMPLE_RATE * 1.5)], pitch_factor * (1.0 + variation))
    samples = samples[: int(length_seconds * SAMPLE_RATE)]
    fade = int(0.04 * SAMPLE_RATE)
    samples[-fade:] *= np.linspace(1, 0, fade)
    return samples / (np.max(np.abs(samples)) + 1e-9) * 0.8 * gain


def hit_for(event):
    target = event["target"]
    if target in HIT_FOR_TARGET:
        return HIT_FOR_TARGET[target]
    prefix = target.split(":")[0]
    if event["kind"] == "click" and prefix in HIT_FOR_TARGET:
        return HIT_FOR_TARGET[prefix]
    if event["kind"] in HIT_FOR_KIND:
        return HIT_FOR_KIND[event["kind"]]
    raise SystemExit(f"no sound for input {event}")


def whir(start_seconds, end_seconds, pitch_factor, level, ramp_seconds, length):
    """A soft band-limited whir from the hum recording, rising while the part spins up and gone when it leaves."""
    count = int((end_seconds - start_seconds) * SAMPLE_RATE)
    source = pitch(load("hum"), pitch_factor)
    repeated = np.tile(source, int(np.ceil(count / len(source))))[:count]
    sos = signal.butter(4, [260, 2600], "band", fs=SAMPLE_RATE, output="sos")
    band = signal.sosfilt(sos, repeated)
    band /= np.max(np.abs(band)) + 1e-9
    time = np.arange(count) / SAMPLE_RATE
    rise = np.clip(time / ramp_seconds, 0, 1) ** 2
    fall = np.clip((time[-1] - time) / 0.6, 0, 1)
    out = np.zeros(length)
    begin = int(start_seconds * SAMPLE_RATE)
    out[begin: begin + count] = band * rise * fall * level
    return out


def true_peak_db(samples):
    return 20 * np.log10(np.max(np.abs(signal.resample_poly(samples, 4, 1))) + 1e-12)


def limit(samples, ceiling_db):
    ceiling = 10 ** (ceiling_db / 20)
    window = int(0.004 * SAMPLE_RATE)
    needed = np.minimum(1.0, ceiling / (np.abs(samples) + 1e-9))
    gain = uniform_filter1d(minimum_filter1d(needed, window * 2 + 1), window)
    return samples * gain


def main():
    length = int(DURATION_SECONDS * SAMPLE_RATE)
    inputs = json.load(open(os.path.join(PROJECT, "out", "input_events.json"), encoding="utf-8"))
    states = json.load(open(os.path.join(PROJECT, "out", "state_events.json"), encoding="utf-8"))
    hits = np.zeros(length)
    for index, event in enumerate(inputs):
        name, seconds, gain, pitch_factor = hit_for(event)
        variation = 0.04 * ((index * 37) % 7 - 3) / 3
        sound = dry_hit(name, seconds, gain, pitch_factor, variation)
        begin = int(event["frame"] / FRAMES_PER_SECOND * SAMPLE_RATE)
        hits[begin: begin + len(sound)] += sound[: length - begin]
    spin_time = next(event["time"] for event in states if event["kind"] == "spin")
    fan_time = next(event["time"] for event in states if event["kind"] == "select" and event["target"] == "fan")
    lineup_time = next(event["time"] for event in states if event["kind"] == "select" and event["target"] == "lineup")
    whirs = (
        whir(spin_time, fan_time + 0.9, 1.9, 0.9, 1.6, length)
        + whir(fan_time, fan_time + 4.6, 1.3, 0.7, 1.4, length)
        + whir(lineup_time + 0.3, DURATION_SECONDS - 0.05, 1.6, 0.5, 1.8, length)
    )
    meter = pyloudnorm.Meter(SAMPLE_RATE)
    dry_mix = hits + whirs
    gain = 1.0
    for _ in range(8):
        mix = limit(dry_mix * gain, TRUE_PEAK_CEILING_DB)
        measured = meter.integrated_loudness(np.stack([mix, mix], axis=1))
        if abs(measured - TARGET_LUFS) < 0.25:
            break
        gain *= 10 ** ((TARGET_LUFS - measured) / 20)
    ceiling_db = TRUE_PEAK_CEILING_DB
    for _ in range(6):
        excess = true_peak_db(mix) - TRUE_PEAK_CEILING_DB
        if excess <= 0:
            break
        ceiling_db -= excess + 0.1
        mix = limit(mix, ceiling_db)
    final = meter.integrated_loudness(np.stack([mix, mix], axis=1))
    peak = true_peak_db(mix)
    print(f"sample peak {20 * np.log10(np.max(np.abs(mix))):.2f} dBFS, gain {gain:.2f}, hits peak {np.max(np.abs(hits)):.2f}, whirs peak {np.max(np.abs(whirs)):.2f}")
    print(f"inputs {len(inputs)}, loudness {final:.2f} LUFS, true peak {peak:.2f} dBFS")
    output = os.path.join(PROJECT, "sound", "simready-showcase.wav")
    soundfile.write(output, np.stack([mix, mix], axis=1), SAMPLE_RATE, subtype="PCM_16")
    print(output)


main()
