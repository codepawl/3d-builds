"""Builds sound/titanic-sound.wav from real CC0 recordings already on this machine, cut to the reel's shots.
Shot times come from sound/shots.json: {"duration": s, "shots": [{"name": ..., "start": s}, ...]}.
Run: uv run --no-project --python 3.12 --with numpy --with scipy --with soundfile --with pyloudnorm python sound/make_sound.py"""
import sys
import os
import json
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
plan = json.load(open(os.path.join(ROOT, "sound", "shots.json")))
DURATION = plan["duration"]
LENGTH = int(SAMPLE_RATE * DURATION)
shot_start = {shot["name"]: shot["start"] for shot in plan["shots"]}

SOURCES = {
    "sea": DEMOS + r"\pixel-battles\sound\sources\water\213566_Woodylein.ogg",
    "sea_far": DEMOS + r"\pixel-battles\sound\sources\water\18405_kokuya.ogg",
    "wind": DEMOS + r"\food-forest-study\sound\sources\wind\397091_janbezouska.ogg",
    "creak": DEMOS + r"\reich-chancellery-walk\sound\sources\creak\273466_jemburyturner.ogg",
    "room": DEMOS + r"\food-forest-study\sound\sources\room\110127_Ryding.ogg",
    "fire": DEMOS + r"\pixel-battles\sound\sources\fire\242721_sergeeo.ogg",
    "fire_2": DEMOS + r"\pixel-battles\sound\sources\fire\186374_samararaine.ogg",
    "metal": DEMOS + r"\food-forest-study\sound\sources\metal\81266_ra_gun.ogg",
    "machine_air": DEMOS + r"\pixel-battles\sound\sources\air\148292_RutgerMuller.ogg",
    "whoosh": DEMOS + r"\pixel-battles\sound\sources\air\169867_Halgrimm.ogg",
    "bass_low": DEMOS + r"\reich-chancellery-walk\sound\sources\contrabass\BKCtbss_SusVib_A1_v1_rr1.wav",
    "cello_a": DEMOS + r"\reich-chancellery-walk\sound\sources\cello\susvib_A2_v1_1.wav",
    "cello_b": DEMOS + r"\reich-chancellery-walk\sound\sources\cello\susvib_B1_v1_1.wav",
    "organ_c": DEMOS + r"\reich-chancellery-walk\sound\sources\organ\NT5_PedalQuiet_C2_rr1.wav",
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


def place(samples, at_seconds, gain, length_seconds=None):
    track = np.zeros(LENGTH)
    start = int(at_seconds * SAMPLE_RATE)
    if length_seconds:
        samples = samples[: int(length_seconds * SAMPLE_RATE)]
        tail = min(len(samples), int(0.6 * SAMPLE_RATE))
        samples = samples.copy()
        samples[-tail:] *= np.linspace(1, 0, tail)
    end = min(LENGTH, start + len(samples))
    track[start:end] = samples[: end - start] * gain
    return track


# How far inside the ship the camera is: 0 on the wide plate, 1 in a room.
fly_in = shot_start["stairs"]
fly_out = shot_start["out"]
inside = envelope([(0, 0), (fly_in - 2.4, 0), (fly_in - 0.6, 1), (fly_out, 1), (fly_out + 1.6, 0), (DURATION, 0)])
outside = 1 - inside

mix = np.zeros((LENGTH, 2))
mix += to_stereo(lowpass(loop_to(load("sea"), LENGTH), 5000) * (0.30 * outside + 0.04), -0.2)
mix += to_stereo(lowpass(loop_to(load("sea_far"), LENGTH, start_seconds=3), 3500) * (0.18 * outside + 0.03), 0.3)
mix += to_stereo(lowpass(loop_to(load("wind"), LENGTH, start_seconds=8), 4000) * 0.10 * outside, 0.1)
for at in (2.2, fly_out + 0.6):
    mix += to_stereo(lowpass(place(load("creak"), at, 0.22), 3000), -0.3)

# Rooms: a soft room murmur everywhere inside, then each room's own sound.
mix += to_stereo(lowpass(loop_to(load("room"), LENGTH, start_seconds=12), 4500) * 0.16 * inside)
boilers = shot_start["boilers"]
engines = shot_start["engines"]
in_boilers = envelope([(0, 0), (boilers - 1.4, 0), (boilers, 1), (engines - 0.8, 1), (engines + 0.4, 0), (DURATION, 0)])
mix += to_stereo(lowpass(loop_to(load("fire"), LENGTH, start_seconds=1), 5000) * 0.55 * in_boilers, -0.25)
mix += to_stereo(lowpass(loop_to(load("fire_2"), LENGTH, start_seconds=2), 5000) * 0.40 * in_boilers, 0.25)
for index, at in enumerate(np.arange(boilers + 0.3, engines - 0.6, 0.95)):
    shovel = load("metal")[int((1.0 + index * 1.7) * SAMPLE_RATE):]
    mix += to_stereo(lowpass(place(shovel, at, 0.30, 0.45), 6000), 0.4 if index % 2 else -0.4)
in_engines = envelope([(0, 0), (engines - 1.0, 0), (engines + 0.2, 1), (fly_out - 0.2, 1), (fly_out + 1.2, 0), (DURATION, 0)])
mix += to_stereo(lowpass(loop_to(load("machine_air"), LENGTH), 2500) * 0.45 * in_engines)
# The engines' slow piston beat: low bass pulses about twice a second.
pulse = lowpass(load("bass_low"), 300)[: int(0.5 * SAMPLE_RATE)]
pulse *= np.linspace(1, 0, len(pulse)) ** 2
for at in np.arange(engines + 0.1, fly_out + 0.8, 0.52):
    mix += to_stereo(place(pulse, at, 0.55) * in_engines)

# A whoosh on every fly between shots.
moves = [fly_in - 3.0] + [shot_start[name] - 2.4 for name in ("dining", "boilers", "engines")] + [fly_out - 0.2]
for index, at in enumerate(moves):
    mix += to_stereo(lowpass(place(load("whoosh"), at, 0.22), 7000), -0.3 if index % 2 else 0.3)

# Score: slow sustained strings and organ under everything, quietest inside the boiler room.
score_gain = envelope([(0, 0.0), (1.5, 0.16), (boilers - 1, 0.13), (boilers, 0.07), (engines, 0.09), (fly_out, 0.16), (DURATION, 0.16)])
chords = [(0.0, ("bass_low", "cello_a")), (8.0, ("organ_c", "cello_b")), (16.0, ("bass_low", "cello_a")), (24.0, ("organ_c", "cello_b"))]
score = np.zeros(LENGTH)
for at, roles in chords:
    for role in roles:
        note = lowpass(load(role), 2400)
        attack = int(0.8 * SAMPLE_RATE)
        note[:attack] *= np.linspace(0, 1, attack)
        score += place(note, at, 0.5, 9.0)
mix += to_stereo(score * score_gain)

fade_in = int(0.3 * SAMPLE_RATE)
fade_out = int(1.4 * SAMPLE_RATE)
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
sf.write(os.path.join(ROOT, "sound", "titanic-sound.wav"), mix.astype(np.float32), SAMPLE_RATE, subtype="FLOAT")
print("LUFS %.2f  true peak %.2f dBTP  duration %.2f s" % (meter.integrated_loudness(mix), true_peak_db(mix), DURATION))
print("shots", shot_start)
