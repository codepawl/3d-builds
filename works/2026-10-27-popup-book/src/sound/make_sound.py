"""Builds sound/popup-sound.wav for the pop-up book reel from real CC0 recordings already on this machine.
Beat times are the reel's marks (tools/reel-states.mjs): cover 2.4-5.6, pull tab 8.0-11.0, flap 12.2, volvelle 14.6-17.0,
page turn 18.0-21.0, steam tab 22.8-26.4, push out 26.8-30.0.
Run: uv run --no-project --python 3.12 --with numpy --with scipy --with soundfile --with pyloudnorm python sound/make_sound.py"""
import sys
import os
import math
import shutil

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import numpy as np
import soundfile as sf
import pyloudnorm
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMOS = os.path.dirname(ROOT)
SAMPLE_RATE = 48000
DURATION = 30.0
LENGTH = int(SAMPLE_RATE * DURATION)
TURTLE = DEMOS + r"\life-of-sea-turtle\sound\sources"

SOURCES = {
    "room": DEMOS + r"\food-forest-study\sound\sources\room\641306_aleclubin.ogg",
    "clock": TURTLE + r"\clock\188033_AntumDeluge.ogg",
    "creak": DEMOS + r"\reich-chancellery-walk\sound\sources\creak\402465_LampEight.ogg",
    "paper_slide": TURTLE + r"\paper\136778_davidbain.ogg",
    "paper_flick": TURTLE + r"\paper\397548_LilMati.ogg",
    "rustle_a": DEMOS + r"\food-forest-study\sound\sources\rustle\106114_j1987.ogg",
    "rustle_b": DEMOS + r"\food-forest-study\sound\sources\rustle\179338_lolamadeus.ogg",
    "page_turn": DEMOS + r"\food-forest-study\sound\sources\rustle\207125_ahill86.ogg",
    "tick": TURTLE + r"\woodblock\wood_click_pp_rr1.wav",
    # 18405_kokuya carries a steady 921 Hz tone; this one is clean.
    "sea": DEMOS + r"\pixel-battles\sound\sources\water\321886_nsmusic.ogg",
    "machine": DEMOS + r"\titanic-plate\sound\sources\machine_air_148292_RutgerMuller.ogg",
    "chimes_up": TURTLE + r"\mark-trees\windchimes_asc1.wav",
    "chimes_down": TURTLE + r"\mark-trees\windchimes_desc1.wav",
    "marimba_c2": TURTLE + r"\marimba\Marimba_hit_Outrigger_C2_med_01.wav",
    "marimba_b2": TURTLE + r"\marimba\Marimba_hit_Outrigger_B2_med_01.wav",
    "marimba_b4": TURTLE + r"\marimba\Marimba_hit_Outrigger_B4_med_01.wav",
}
os.makedirs(os.path.join(ROOT, "sound", "sources"), exist_ok=True)
used = {}
for role, source_path in SOURCES.items():
    target = os.path.join(ROOT, "sound", "sources", role + "_" + os.path.basename(source_path))
    if not os.path.exists(target):
        shutil.copy(source_path, target)
    used[role] = target


def load(role):
    data, rate = sf.read(used[role])
    mono = data.mean(axis=1) if data.ndim > 1 else data
    if rate != SAMPLE_RATE:
        mono = signal.resample_poly(mono, SAMPLE_RATE, rate)
    return mono.astype(np.float64)


def lowpass(samples, cutoff):
    return signal.sosfilt(signal.butter(4, cutoff, "low", fs=SAMPLE_RATE, output="sos"), samples)


def loop_to(samples, length, crossfade_seconds=1.0, start_seconds=0.0):
    samples = np.roll(samples, -int(start_seconds * SAMPLE_RATE))
    fade = min(int(crossfade_seconds * SAMPLE_RATE), len(samples) // 3)
    out = np.zeros(length)
    take = min(len(samples), length)
    out[:take] = samples[:take]
    position = take - fade
    while position + fade < length:
        take = min(len(samples), length - position)
        overlap = min(fade, take)
        ramp = np.linspace(0, 1, overlap)
        out[position: position + overlap] = out[position: position + overlap] * (1 - ramp) + samples[:overlap] * ramp
        out[position + overlap: position + take] = samples[overlap:take]
        position += take - fade
    return out


time_axis = np.arange(LENGTH) / SAMPLE_RATE


def envelope(points):
    """Piecewise gain over time from (seconds, gain) pairs, smoothed so nothing clicks."""
    seconds, gains = zip(*points)
    return uniform_filter1d(np.interp(time_axis, seconds, gains), int(0.3 * SAMPLE_RATE), mode="nearest")


def to_stereo(mono, pan=0.0):
    return np.stack([mono * math.sqrt(0.5 * (1 - pan)), mono * math.sqrt(0.5 * (1 + pan))], axis=1)


def trim_silence(samples, threshold=0.02):
    loud = np.flatnonzero(np.abs(samples) > threshold * np.abs(samples).max())
    return samples[loud[0]:] if len(loud) else samples


def place(samples, at_seconds, gain, length_seconds=None, offset_seconds=0.0):
    samples = samples[int(offset_seconds * SAMPLE_RATE):]
    track = np.zeros(LENGTH)
    start = int(at_seconds * SAMPLE_RATE)
    if length_seconds:
        samples = samples[: int(length_seconds * SAMPLE_RATE)].copy()
        tail = min(len(samples), int(0.2 * SAMPLE_RATE))
        samples[-tail:] *= np.linspace(1, 0, tail)
    # A short attack so no paper sound starts with a hard click.
    attack = min(len(samples), int(0.03 * SAMPLE_RATE))
    samples = samples.copy()
    samples[:attack] *= np.linspace(0, 1, attack)
    end = min(LENGTH, start + len(samples))
    track[start:end] = samples[: end - start] * gain
    return track


def pop_run(start, end, count, pan_from, pan_to):
    """Each layer rising: a short paper snap from alternating rustles, spread over the opening."""
    out = np.zeros((LENGTH, 2))
    rustles = [load("rustle_a"), load("rustle_b")]
    for index, at in enumerate(np.linspace(start, end, count)):
        rustle = rustles[index % 2]
        offset = int(index * 0.7 * SAMPLE_RATE) % max(1, len(rustle) - int(0.3 * SAMPLE_RATE))
        snap = trim_silence(rustle[offset:])
        out += to_stereo(lowpass(place(snap, at, 0.11, 0.14), 4500), pan_from + (pan_to - pan_from) * index / max(1, count - 1))
    return out


mix = np.zeros((LENGTH, 2))

# A quiet study at night: room air and a far clock under everything.
mix += to_stereo(lowpass(loop_to(load("room"), LENGTH), 5000) * 0.10)
mix += to_stereo(lowpass(loop_to(load("clock"), LENGTH), 6000) * envelope([(0, 0.035), (DURATION, 0.035)]), 0.5)

# Cover opens with one soft page sound, then a single paper fold as the Titanic stands up.
# One sound per action: stacked creaks, snaps and chimes read as noise (An, 2026-10-27).
mix += to_stereo(lowpass(place(load("page_turn"), 2.5, 0.14, 1.4), 3800), -0.1)
mix += pop_run(4.2, 4.2, 1, 0.0, 0.0)
sea_gain = envelope([(0, 0), (4.5, 0), (6.0, 0.09), (17.5, 0.09), (19.5, 0), (DURATION, 0)])
mix += to_stereo(lowpass(loop_to(load("sea"), LENGTH, start_seconds=5), 3000) * sea_gain)

# Pull tab: the hull plate slides, the boilers glow behind it.
mix += to_stereo(lowpass(place(load("paper_slide"), 8.0, 0.25, 3.0), 5000), 0.3)
mix += to_stereo(lowpass(place(load("machine"), 9.0, 0.18, 3.0), 900))

# Bridge flap up and down.
mix += to_stereo(place(trim_silence(load("paper_flick")), 12.2, 0.45, 0.5), 0.1)
mix += to_stereo(place(trim_silence(load("paper_flick")), 15.4, 0.30, 0.5, offset_seconds=0.6), 0.1)

# Volvelle: a wooden detent click at each of the four stops.
for index, at in enumerate((14.6, 15.4, 16.2, 17.0)):
    mix += to_stereo(place(trim_silence(load("tick")), at, 0.40, 0.25), 0.4 - index * 0.1)

# Page turn, then the power station rises.
mix += to_stereo(lowpass(place(load("page_turn"), 18.2, 0.14, 1.6, offset_seconds=0.5), 3800), 0.2)
mix += pop_run(20.2, 20.2, 1, 0.0, 0.0)

# Steam tab: paper strips running round the loop over a low turbine drone.
mix += to_stereo(lowpass(place(load("paper_slide"), 22.8, 0.22, 3.6, offset_seconds=1.0), 5000), -0.2)
turbine_gain = envelope([(0, 0), (22.6, 0), (23.6, 0.30), (26.4, 0.30), (27.6, 0), (DURATION, 0)])
mix += to_stereo(lowpass(loop_to(load("machine"), LENGTH, start_seconds=4), 1200) * turbine_gain)

# Nothing in a paper book needs sub-bass: cut the room's and the slides' rumble.
mix = signal.sosfilt(signal.butter(2, 90, "high", fs=SAMPLE_RATE, output="sos"), mix, axis=0)

fade_in = int(0.3 * SAMPLE_RATE)
fade_out = int(1.6 * SAMPLE_RATE)
mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
mix[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]

meter = pyloudnorm.Meter(SAMPLE_RATE)


def true_peak_db(samples):
    return 20 * math.log10(np.abs(signal.resample_poly(samples, 4, 1, axis=0)).max())


def limit(samples, ceiling_db=-1.2):
    ceiling = 10 ** (ceiling_db / 20)
    needed = np.minimum(1.0, ceiling / np.maximum(np.abs(samples).max(axis=1), 1e-9))
    needed = uniform_filter1d(minimum_filter1d(needed, 960), 480)
    return samples * needed[:, None]


for attempt in range(6):
    mix *= 10 ** ((-16.0 - meter.integrated_loudness(mix)) / 20)
    mix = limit(mix)
    if abs(meter.integrated_loudness(mix) + 16.0) < 0.2 and true_peak_db(mix) <= -1.0:
        break
if true_peak_db(mix) > -1.0:
    mix *= 10 ** ((-1.05 - true_peak_db(mix)) / 20)
sf.write(os.path.join(ROOT, "sound", "popup-sound.wav"), mix.astype(np.float32), SAMPLE_RATE, subtype="FLOAT")
print("LUFS %.2f  true peak %.2f dBTP  duration %.2f s" % (meter.integrated_loudness(mix), true_peak_db(mix), DURATION))
