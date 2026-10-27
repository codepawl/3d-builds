"""Mixes the castle soundtrack: one cue per event from sound/events.json, ambience under it. Master -14 LUFS."""
import csv
import json
import math
import sys
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
SR = 48000
DURATION = 20.0
FRAME = 1 / 30  # frame k shows simulation time (k+1)/30, so audio time = t - one frame
HERE = Path(__file__).parent
SOURCES = HERE / "sources"
FOREST = HERE.parent.parent / "food-forest-study" / "sound" / "sources"
BATTLES = HERE.parent.parent / "pixel-battles" / "sound" / "sources"
data = json.loads((HERE / "events.json").read_text(encoding="utf-8"))
events = data["events"]
camera = data["camera"]


def load(path):
    audio, rate = sf.read(path, always_2d=True)
    mono = audio.mean(axis=1)
    if rate != SR:
        mono = signal.resample_poly(mono, SR, rate)
    return mono.astype(np.float64)


def soften(audio, lowpass=4800, dip=0.5):
    """ASMR-close: roll off the highs and dip 2 to 4 kHz."""
    out = signal.sosfilt(signal.butter(2, lowpass, "low", fs=SR, output="sos"), audio)
    band = signal.sosfilt(signal.butter(2, [2000, 4200], "band", fs=SR, output="sos"), out)
    return out - dip * band


def onsets(audio, min_gap, threshold):
    window = int(0.004 * SR)
    envelope = np.sqrt(np.convolve(audio**2, np.ones(window) / window, mode="same"))
    peak = envelope.max()
    rise = np.diff(envelope, prepend=0)
    found, last = [], -(10**9)
    for index in np.where((envelope > threshold * peak) & (rise > 0))[0]:
        if index - last > min_gap * SR:
            found.append(int(index))
        last = index
    return found


def one_shots(path, length, count, gap, threshold):
    audio = load(path)
    shots = []
    for onset in onsets(audio, gap, threshold):
        start = max(0, onset - int(0.02 * SR))
        piece = audio[start : start + int(length * SR)]
        if len(piece) < int(length * SR) * 0.9:
            continue
        attack = np.abs(piece[: int(0.06 * SR)]).max()
        if attack < 1e-4:
            continue
        taper = np.linspace(1, 0, len(piece)) ** 0.6
        shots.append(piece / attack * taper)
    return shots[:count]


def attack_index(piece):
    return int(np.argmax(np.abs(piece[: int(0.1 * SR)])))


def place(track, piece, time, gain, pan, align_attack=True):
    offset = attack_index(piece) if align_attack else 0
    start = int(round((time - FRAME) * SR)) - offset
    fade = min(len(piece), int(0.025 * SR))
    piece = piece.copy()
    if not align_attack:
        piece[:fade] *= np.linspace(0, 1, fade)
    left = math.cos((pan + 1) * math.pi / 4)
    right = math.sin((pan + 1) * math.pi / 4)
    begin = max(0, start)
    end = min(track.shape[0], start + len(piece))
    if end > begin:
        segment = piece[begin - start : end - start]
        track[begin:end, 0] += segment * gain * left
        track[begin:end, 1] += segment * gain * right
    return start + offset


def loudness_gain(event, near=14.0):
    gain = (near / (near + max(event["distance"], 1.0))) ** 1.2
    return gain * (1.0 if event["onScreen"] else 0.4)


frames = int(DURATION * SR)
track = {name: np.zeros((frames, 2)) for name in ["hoof", "metal", "kitchen", "wood", "bell", "ambience", "fire"]}
report = []

pools = {
    "hoof_dirt": [soften(p, 3800) for p in one_shots(SOURCES / "hoof" / "182504_swiftoid.ogg", 0.32, 12, 0.25, 0.3)],
    "hoof_wood": [soften(p, 3800) for p in one_shots(SOURCES / "hoofwood" / "479789_craigsmith.ogg", 0.34, 10, 0.25, 0.3)],
    "smith": [soften(p, 5200) for p in one_shots(SOURCES / "smith" / "434339_draftcraft.ogg", 0.7, 8, 0.35, 0.3)],
    "chop": [soften(p, 4200) for p in one_shots(SOURCES / "chop" / "125521_krissyeliot.ogg", 0.25, 10, 0.15, 0.3)],
    "pots": [soften(p, 4200) for p in one_shots(SOURCES / "pots" / "209002_OwlStorm.ogg", 0.8, 6, 0.3, 0.3)],
}
for name, pool in pools.items():
    print("pool", name, len(pool), file=sys.stderr)
    assert pool, name
counters = {name: 0 for name in pools}


def next_piece(name):
    pool = pools[name]
    piece = pool[counters[name] % len(pool)]
    counters[name] += 1
    return piece


for event in events:
    kind, time = event["kind"], event["t"]
    pan = event["pan"] * 0.7
    if kind == "hoof":
        bridge = event["surface"] == "bridge"
        piece = next_piece("hoof_wood" if bridge else "hoof_dirt")
        gain = loudness_gain(event) * event["gain"] * (0.8 if bridge else 0.55)
        attack = place(track["hoof"], piece, time, gain, pan)
    elif kind == "hammer":
        attack = place(track["metal"], next_piece("smith"), time, loudness_gain(event) * 0.5, pan)
    elif kind == "chop":
        attack = place(track["kitchen"], next_piece("chop"), time, loudness_gain(event) * 0.5, pan)
    elif kind == "clatter":
        attack = place(track["kitchen"], next_piece("pots"), time, loudness_gain(event) * 0.7, pan)
    elif kind == "bridgeThud":
        thud = load(SOURCES / "thud" / "216872_CastIronCarousel.ogg")
        thud = signal.sosfilt(signal.butter(2, 700, "low", fs=SR, output="sos"), thud[: int(0.9 * SR)])
        attack = place(track["wood"], thud / np.abs(thud).max(), time, 0.75, pan)
    elif kind == "bell":
        bell = load(SOURCES / "bell" / "266525_ivolipa.ogg")
        first = onsets(bell, 1.5, 0.35)[0]
        piece = soften(bell[max(0, first - int(0.02 * SR)) : first + int(4.5 * SR)], 3500, 0.7)
        piece = piece / np.abs(piece).max() * np.concatenate([np.ones(len(piece) - int(1.5 * SR)), np.linspace(1, 0, int(1.5 * SR))])
        attack = place(track["bell"], piece, time, 0.5, event["pan"] * 0.4)
    elif kind == "chain":
        chain = load(SOURCES / "chain" / "199282_qubodup.ogg")
        hop = int(0.5 * SR)
        energy = np.array([np.sqrt((chain[i : i + hop] ** 2).mean()) for i in range(0, len(chain) - hop, hop)])
        best = int(np.argmax(np.convolve(energy, np.ones(5) / 5, mode="same")))
        length = int((event["end"] - event["t"]) * SR)
        segment = soften(chain[best * hop : best * hop + length], 4200, 0.6)
        progress = np.linspace(0, 1, len(segment))
        fall = np.where(progress < 0.5, 4 * progress**3, 1 - (-2 * progress + 2) ** 3 / 2) ** 1.35
        speed = np.abs(np.gradient(fall))
        envelope = 0.15 + 0.85 * speed / speed.max()
        envelope = uniform_filter1d(envelope, int(0.05 * SR))
        piece = segment * envelope
        attack = place(track["metal"], piece / (np.abs(piece).max() + 1e-9), time, 0.5 * max(0.3, loudness_gain(event) * 1.5), event["pan"] * 0.5, align_attack=False)
    elif kind == "portcullis":
        gate = load(SOURCES / "gate" / "767058_ThabzMalik.ogg")
        length = int((event["end"] - event["t"]) * SR)
        segment = soften(gate[:length], 3800, 0.6)
        piece = segment * np.sin(np.pi * np.linspace(0, 1, len(segment))) ** 0.7
        attack = place(track["metal"], piece / (np.abs(piece).max() + 1e-9), time, 0.4 * max(0.3, loudness_gain(event) * 1.5), event["pan"] * 0.5, align_attack=False)
    else:
        continue
    report.append({"kind": kind, "event_t": round(time, 4), "audio_attack_t": round(attack / SR, 4), "offset_ms": round((attack / SR - (time - FRAME)) * 1000, 3), "pan": round(event["pan"], 2), "distance": event["distance"], "onScreen": event["onScreen"]})


def bed(path, seconds):
    audio = load(path)
    return np.tile(audio, int(np.ceil(seconds * SR / len(audio))))[: int(seconds * SR)]


time_axis = np.arange(frames) / SR
wind = soften(bed(FOREST / "wind" / "397091_janbezouska.ogg", DURATION), 1800, 0)
wind = wind / (wind.std() + 1e-9) * (0.5 + 0.5 * time_axis / DURATION)
birds = soften(bed(FOREST / "birds" / "341337_AlfredGoldman89.ogg", DURATION), 5200, 0.3)
birds = birds / (birds.std() + 1e-9) * np.clip(1 - (time_axis - 3) / 10, 0, 1) * 0.9
fire = soften(bed(BATTLES / "fire" / "186374_samararaine.ogg", DURATION), 4200, 0.6)
fire = fire / (fire.std() + 1e-9)
hearths = [(12.2, 1.5, 0.5), (12.0, 13.5, 5.0), (-31.5, 1.5, -10.4)]
near = np.array([min(math.dist(cam["position"], hearth) for hearth in hearths) for cam in camera])
fire = fire * np.interp(time_axis, np.arange(len(camera)) / 10, (22 / (22 + near)) ** 2.0)
for audio, gain in [(wind, 0.5), (birds, 0.3)]:
    track["ambience"][:, 0] += audio * gain
    track["ambience"][:, 1] += audio * gain * 0.97
track["fire"][:, 0] += fire
track["fire"][:, 1] += fire * 0.97

levels = {"hoof": 1.0, "metal": 1.0, "kitchen": 1.0, "wood": 1.0, "bell": 1.0, "ambience": 0.55, "fire": 0.11}
mix = sum(track[name] * levels[name] for name in track)


def limiter(audio, ceiling):
    peak = np.abs(signal.resample_poly(audio, 4, 1, axis=0)).max(axis=1)
    need = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    window = int(0.004 * SR) * 4
    need = uniform_filter1d(minimum_filter1d(need, 2 * window + 1), window)
    need = np.minimum(need, np.minimum(1.0, ceiling / np.maximum(peak, 1e-9)))
    gain = need.reshape(-1, 4).min(axis=1)[: len(audio)] if len(need) % 4 == 0 else need[::4][: len(audio)]
    gain = np.pad(gain, (0, len(audio) - len(gain)), mode="edge")
    return audio * gain[:, None]


meter = pyln.Meter(SR)
ceiling = 10 ** (-1.5 / 20)
for _ in range(8):
    mix = mix * 10 ** ((-14 - meter.integrated_loudness(mix)) / 20)
    mix = limiter(mix, ceiling)
fade = int(0.05 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
final_loudness = meter.integrated_loudness(mix)
true_peak = 20 * np.log10(np.abs(signal.resample_poly(mix, 8, 1, axis=0)).max())
sf.write(HERE / "castle-sfx.wav", mix.astype(np.float32), SR, subtype="FLOAT")
with open(HERE / "cue-report.csv", "w", newline="", encoding="utf-8") as handle:
    writer = csv.DictWriter(handle, fieldnames=list(report[0]))
    writer.writeheader()
    writer.writerows(report)
power = np.abs(np.fft.rfft(mix.mean(axis=1))) ** 2
freqs = np.fft.rfftfreq(len(mix), 1 / SR)
summary = {
    "cues": len(report),
    "max_offset_ms": max(abs(row["offset_ms"]) for row in report),
    "lufs": round(float(final_loudness), 2),
    "true_peak_dbtp": round(float(true_peak), 2),
    "share_2_to_6khz": round(float(power[(freqs > 2000) & (freqs < 6000)].sum() / power.sum()), 4),
}
print(json.dumps(summary))
(HERE / "checks.txt").write_text(json.dumps(summary, indent=1))
