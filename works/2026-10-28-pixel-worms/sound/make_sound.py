"""Builds sound/film-sound.wav, cue-report.csv and checks.txt for the 30 s Pixel Worms film.

Only real CC0 recordings from sound/sources (see sources/manifest.json): no synthesis, no music, no reverb, no hiss.
Inputs come from the recorder: shots/input_events.json (every mouse input: mouse moves need no sound, any click or wheel
step needs its own, and an input with no sound stops the build) and shots/state_log.json (per frame: worm count, which
creatures were eaten on that frame and where they stood on screen, which creatures started to flee).

Run: uv run --no-project --python 3.12 --with numpy --with scipy --with soundfile --with pyloudnorm python sound/make_sound.py
"""
import csv
import json
import math
import os
import sys

import numpy as np
import pyloudnorm
import soundfile as sf
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
SOURCES = os.path.join(HERE, "sources")
SHOTS = os.path.join(HERE, "..", "shots")
RATE = 48000
FPS = 60
DURATION = 30.0
LENGTH = int(RATE * DURATION)
TIME = np.arange(LENGTH) / RATE
TARGET_LUFS = -16.0
TRUE_PEAK_LIMIT_DB = -1.5
SAMPLE_CEILING_DB = -3.9  # the limiter sees sample peaks; the true peak ran 1.4 dB above them in the first build


def db(value):
    return 10 ** (value / 20)


def frame_time(frame):
    return frame / FPS


def source_path(prefix):
    matches = [name for name in sorted(os.listdir(SOURCES)) if name.startswith(prefix) and name.endswith(".ogg")]
    if not matches:
        raise SystemExit("no source recording starts with %s" % prefix)
    return matches[0]


def load_mono(name, start=0.0, length=None):
    data, rate = sf.read(os.path.join(SOURCES, name), always_2d=True)
    mono = data.mean(axis=1)
    if rate != RATE:
        mono = signal.resample_poly(mono, RATE, rate)
    begin = int(start * RATE)
    end = None if length is None else begin + int(length * RATE)
    return mono[begin:end].astype(np.float64)


def lowpass(samples, cutoff, order=4):
    return signal.sosfilt(signal.butter(order, cutoff, "low", fs=RATE, output="sos"), samples)


def highpass(samples, cutoff, order=2):
    return signal.sosfilt(signal.butter(order, cutoff, "high", fs=RATE, output="sos"), samples)


def rms_normalise(samples, target_db):
    current = math.sqrt(float(np.mean(samples ** 2))) + 1e-12
    return samples * (db(target_db) / current)


def peak_normalise(samples, target_db):
    return samples * (db(target_db) / (np.abs(samples).max() + 1e-12))


def loop_to_length(samples, length, crossfade=1.2):
    fade = int(crossfade * RATE)
    out = np.zeros(length)
    out[: min(length, len(samples))] = samples[:length]
    position = len(samples) - fade
    while position + fade < length:
        piece = samples[: length - position]
        ramp = np.linspace(0, 1, min(fade, len(piece)))
        overlap = len(ramp)
        out[position: position + overlap] = out[position: position + overlap] * (1 - ramp) + piece[:overlap] * ramp
        out[position + overlap: position + len(piece)] = piece[overlap:]
        position += len(samples) - fade
    return out


def envelope(points, smooth=0.25):
    seconds, gains = zip(*points)
    raw = np.interp(TIME, seconds, gains)
    return uniform_filter1d(raw, max(1, int(smooth * RATE)), mode="nearest")


def smoothstep(low, high, value):
    t = np.clip((value - low) / (high - low), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def pan_stereo(mono, pan=0.0):
    return np.stack([mono * math.sqrt(0.5 * (1 - pan)), mono * math.sqrt(0.5 * (1 + pan))], axis=1)


def attack_index(samples, fraction=0.3):
    """First point of the main attack: where a 3 ms envelope first reaches a fraction of its own peak."""
    window = int(0.003 * RATE)
    envelope_now = uniform_filter1d(np.abs(samples), window)
    return int(np.argmax(envelope_now >= fraction * envelope_now.max()))


def place(samples, event_time, gain_db, fade_in=0.004, fade_out=0.08, fraction=0.3):
    """Lays the one-shot on a silent track so its main attack falls exactly on event_time."""
    shot = samples.copy()
    shot[: int(fade_in * RATE)] *= np.linspace(0, 1, int(fade_in * RATE))
    tail = min(len(shot), int(fade_out * RATE))
    shot[-tail:] *= np.linspace(1, 0, tail)
    track = np.zeros(LENGTH)
    start = int(round(event_time * RATE)) - attack_index(shot, fraction)
    source_from = max(0, -start)
    destination = max(0, start)
    count = min(len(shot) - source_from, LENGTH - destination)
    if count > 0:
        track[destination: destination + count] = shot[source_from: source_from + count] * db(gain_db)
    return track


def distinct_hits(samples, count, minimum_gap=0.45, pre=0.03, length=0.34):
    """Up to `count` distinct hits from one take, loudest first: each is a slice that starts just before its own attack."""
    envelope_now = uniform_filter1d(np.abs(samples), int(0.006 * RATE))
    order = np.argsort(envelope_now)[::-1]
    chosen = []
    for index in order:
        if envelope_now[index] < 0.12 * envelope_now.max():
            break
        if all(abs(index - other) > minimum_gap * RATE for other in chosen):
            chosen.append(int(index))
        if len(chosen) == count:
            break
    hits = []
    for index in chosen:
        begin = max(0, index - int(pre * RATE))
        hits.append((begin / RATE, samples[begin: begin + int((pre + length) * RATE)]))
    return hits


# ----- inputs from the recorder -----------------------------------------------------------------------------------
with open(os.path.join(SHOTS, "input_events.json"), encoding="utf-8") as handle:
    input_events = json.load(handle)
with open(os.path.join(SHOTS, "state_log.json"), encoding="utf-8") as handle:
    state_log = json.load(handle)
kinds_seen = sorted({event["kind"] for event in input_events})
unvoiced = [event for event in input_events if event["kind"] != "move"]
if unvoiced:
    raise SystemExit("inputs with no sound handler (only mouse moves are silent): %s" % unvoiced[:5])
frames = np.array([entry["frame"] for entry in state_log])
worm_counts = np.array([entry["worms"] for entry in state_log], dtype=float)
worms_at = np.interp(TIME, frames / FPS, worm_counts)
log_worms = np.log(np.maximum(worms_at, 12.0))


def grow(low_worms, high_worms):
    return smoothstep(math.log(low_worms), math.log(high_worms), log_worms)


# ----- beds -----------------------------------------------------------------------------------------------------
mix = np.zeros((LENGTH, 2))


def bed_from(prefix, start, length, low_hz, high_hz, level_db, pan):
    take = load_mono(source_path(prefix), start, length)
    take = loop_to_length(take, LENGTH)
    take = rms_normalise(lowpass(highpass(take, low_hz), high_hz, order=2), level_db)
    return take, pan


# Wet writhing mass: four real recordings that come in as the worm count passes 12, 60, 250 and 700, so the bed gets
# denser as well as louder.
size = grow(12, 1400)
wet_layers = [
    ("bed_superworms", 0.0, 12.0, 90, 6500, -30, -0.15, 0.40 + 0.60 * grow(12, 200)),
    ("bed_wet_slimy", 6.0, 60.0, 120, 6000, -31, 0.15, grow(40, 400)),
    ("bed_guts_goo", 4.0, 36.0, 100, 5500, -31, -0.1, grow(200, 900)),
    ("bed_slime_squish", 10.0, 90.0, 120, 6000, -31, 0.1, grow(600, 1400)),
]
bed_levels = []
for prefix, start, length, low_hz, high_hz, level_db, pan, presence in wet_layers:
    layer, layer_pan = bed_from(prefix, start, length, low_hz, high_hz, level_db, pan)
    layer_gain = presence * (0.45 + 0.55 * size)
    fade_in = np.clip(TIME / 0.4, 0, 1)
    mix += pan_stereo(layer * layer_gain * fade_in, layer_pan) * db(-1.0)
    bed_levels.append(prefix)

# Meadow life that thins out as the land is taken: birds first, a light wind under them that never quite vanishes.
taken = grow(30, 900)
birds = bed_from("ambience_meadow_a", 8.0, 60.0, 400, 7500, -33, -0.2)[0]
birds_gain = (1.0 - taken) ** 1.4 * np.clip(TIME / 0.5, 0, 1)
mix += pan_stereo(birds * birds_gain, -0.2) * db(2.0)
wind = bed_from("ambience_meadow_b", 5.0, 60.0, 90, 800, -33, 0.2)[0]
wind_gain = (0.9 - 0.65 * taken) * np.clip(TIME / 0.8, 0, 1)
mix += pan_stereo(wind * wind_gain, 0.2) * db(1.0)

# A low swell under the pull-back (26 s on).
swell = loop_to_length(load_mono(source_path("swell_rumble"), 2.0, 26.0), LENGTH)
swell = rms_normalise(lowpass(swell, 170, order=4), -26)
swell_gain = envelope([(0, 0), (25.2, 0), (28.0, 1.0), (29.3, 0.9), (30, 0.6)], smooth=0.5)
mix += pan_stereo(swell * swell_gain, 0.0) * db(1.5)
bed_only = mix.copy()

# ----- cues -----------------------------------------------------------------------------------------------------
cue_rows = []
used_slices = set()


def add_cue(name, frame, note, recording, track, event_time, pan):
    global mix
    mix += pan_stereo(track, pan)
    cue_rows.append((name, frame, note, recording, track, event_time))


def screen_pan(screen_x):
    return float(np.clip((screen_x / 1920.0 - 0.5) * 1.2, -0.6, 0.6))


# Squelch and crunch hits for every eat: slices of the eat recordings, one slice per cue, interleaved so consecutive
# eats use different recordings. Slices are softened a little (highpass 130 Hz, low-pass 6.5 kHz) so none is shrill.
eat_events = []
for entry in state_log:
    for eaten in entry["eaten"]:
        eat_events.append((entry["frame"], dict(eaten, chunk=False)))
    # A wet bite for every chunk of a carcass the worms finish; the screen x is where the chunk lay.
    for chunk in entry.get("chunkEvents", []):
        eat_events.append((entry["frame"], {"kind": chunk["kind"], "name": "%s of a %s" % (chunk["piece"], chunk["kind"]), "screenX": chunk["screen"]["x"], "chunk": True}))
eat_sources = [
    ("eat_meat", 6), ("eat_squishes", 9), ("eat_carcass", 7), ("eat_splat_a", 1), ("eat_splat_b", 1), ("eat_gore_splat", 2),
    ("eat_mud_squelch", 3), ("eat_mud_splat", 1), ("eat_chicken_slime", 3), ("eat_slimy", 1), ("bed_slime_squish", 8),
]
pools = []
for prefix, count in eat_sources:
    name = source_path(prefix)
    hits = distinct_hits(load_mono(name), count * 6, minimum_gap=0.3)
    pools.append([(name, begin, hit) for begin, hit in hits])
interleaved = []
for round_index in range(max(len(pool) for pool in pools)):
    for pool in pools:
        if round_index < len(pool):
            interleaved.append(pool[round_index])
# Fewer, chunkier bites (draft 5): every creature eat keeps its cue; chunk bites are thinned to one per 0.35 s and then to the
# number of distinct slices left, so no slice is ever used twice.
creature_eats = [item for item in eat_events if not item[1]["chunk"]]
chunk_bites = []
last_kept_frame = -1000
for frame, eaten in eat_events:
    if eaten["chunk"] and frame - last_kept_frame >= 21:
        chunk_bites.append((frame, eaten))
        last_kept_frame = frame
room = max(0, len(interleaved) - len(creature_eats))
if len(chunk_bites) > room:
    keep = np.linspace(0, len(chunk_bites) - 1, room).round().astype(int)
    chunk_bites = [chunk_bites[index] for index in sorted(set(keep.tolist()))]
eat_events = sorted(creature_eats + chunk_bites, key=lambda item: item[0])
KIND_GAIN_DB = {"chicken": -19.0, "rabbit": -19.0, "pig": -17.5, "deer": -17.0, "cow": -16.0, "villager": -16.0, "fox": -15.5}
frame_counts = {}
for index, (frame, eaten) in enumerate(eat_events):
    name, begin, hit = interleaved[index]
    slice_id = "%s@%.2fs" % (name, begin)
    if slice_id in used_slices:
        raise SystemExit("slice reused: %s" % slice_id)
    used_slices.add(slice_id)
    frame_counts[frame] = frame_counts.get(frame, 0) + 1
    crowd_db = -1.5 * (frame_counts[frame] - 1)
    softened = peak_normalise(lowpass(highpass(hit, 130), 6500, order=2), -1)
    event_time = frame_time(frame)
    track = place(softened, event_time, KIND_GAIN_DB[eaten["kind"]] + crowd_db - (5.0 if eaten["chunk"] else 0.0), fade_in=0.003, fade_out=0.09)
    add_cue(("chunk %s #%d" if eaten["chunk"] else "eat %s #%d") % (eaten["kind"], index + 1), frame, ("state_log: chunk (%s) is finished on this frame" if eaten["chunk"] else "state_log: creature %s leaves the creature list on this frame") % eaten["name"], slice_id, track, event_time, screen_pan(eaten["screenX"]))

# A few short squeaks or bleats as creatures start to flee: sparing, one per recording, at least 1.6 s apart.
squeak_sources = [("squeak_chicken", ["chicken"]), ("squeak_rat", ["rabbit"]), ("squeak_pig_squeal", ["pig"]), ("squeak_bwack", ["chicken"]), ("squeak_pig_grunt", ["pig"])]
flee_events = []
for entry in state_log:
    for fleeing in entry["startedFleeing"]:
        flee_events.append((entry["frame"], fleeing))
last_squeak_time = -10.0
squeak_count = 0
for prefix, kinds in squeak_sources:
    name = source_path(prefix)
    take = load_mono(name)
    hit = distinct_hits(take, 1, length=0.6)[0]
    candidates = [(frame, fleeing) for frame, fleeing in flee_events if fleeing["kind"] in kinds and frame_time(frame) > last_squeak_time + 1.6 and 0.5 < fleeing["screenX"] / 1920.0 * 2 < 1.9 and frame_time(frame) > 3.0 and frame_time(frame) < 26.0]
    if not candidates:
        continue
    frame, fleeing = candidates[0]
    softened = peak_normalise(lowpass(highpass(hit[1], 300), 6000, order=2), -1)
    event_time = frame_time(frame)
    track = place(softened, event_time, -22.0, fade_in=0.004, fade_out=0.12)
    add_cue("flee %s" % fleeing["kind"], frame, "state_log: creature %s switches to flee" % fleeing["name"], "%s@%.2fs" % (name, hit[0]), track, event_time, screen_pan(fleeing["screenX"]))
    last_squeak_time = event_time
    squeak_count += 1


# ----- hazards: predator dives and snaps, trap snaps, salt sizzle; every cue its own slice of a CC0 recording ---------------
hazard_events = []
for entry in state_log:
    for event in entry.get("hazardEvents", []):
        hazard_events.append((entry["frame"], event))
HAZARD_SOURCES = {
    "hawk-dive": [("hawk_eagle", 1, 0.9, -15.0), ("wing_whoosh", 1, 0.8, -20.0), ("wing_flap", 1, 0.8, -20.0)],
    "hawk-kill": [("hawk_calls", 6, 0.8, -16.0)],
    "fox-snap": [("fox_bark", 2, 0.5, -15.0), ("fox_barking_long", 6, 0.5, -15.0)],
    "fox-overwhelmed": [("fox_scream", 3, 1.2, -16.0)],
    "bear-snap": [("trap_bear", 1, 0.5, -11.0), ("trap_shut", 1, 0.6, -11.0), ("trap_snap", 2, 0.5, -11.0), ("trap_spring", 4, 0.6, -11.0)],
    "salt-shrivel": [("sizzle_acid", 12, 0.9, -21.0), ("sizzle_pan", 3, 0.9, -21.0)],
}
hazard_pools = {}
for kind, sources in HAZARD_SOURCES.items():
    pool = []
    for prefix, count, length, gain_db in sources:
        name = source_path(prefix)
        for begin, hit in distinct_hits(load_mono(name), count, minimum_gap=0.5, pre=0.02, length=length):
            pool.append((name, begin, hit, gain_db))
    hazard_pools[kind] = pool
hazard_pools["hawk-abort"] = hazard_pools["hawk-kill"]  # one pool of hawk calls, so no slice is used twice
hazard_cue_count = 0
for frame, event in hazard_events:
    pool = hazard_pools.get(event["kind"])
    if not pool:
        continue
    name, begin, hit, gain_db = pool.pop(0)
    slice_id = "%s@%.2fs" % (name, begin)
    used_slices.add(slice_id)
    softened = peak_normalise(lowpass(highpass(hit, 120), 7000, order=2), -1)
    event_time = frame_time(frame)
    track = place(softened, event_time, gain_db, fade_in=0.003, fade_out=0.15)
    add_cue("%s #%d" % (event["kind"], hazard_cue_count + 1), frame, "state_log: hazard event %s (killed %d)" % (event["kind"], event["killed"]), slice_id, track, event_time, screen_pan(event["screen"]["x"]))
    hazard_cue_count += 1

# ----- master ---------------------------------------------------------------------------------------------------
fade_in = int(0.12 * RATE)
fade_out = int(0.6 * RATE)
mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
mix[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
meter = pyloudnorm.Meter(RATE)


def true_peak_db(samples):
    return 20 * math.log10(np.abs(signal.resample_poly(samples, 4, 1, axis=0)).max() + 1e-12)


def limit(samples, ceiling_db):
    ceiling = db(ceiling_db)
    needed = np.minimum(1.0, ceiling / np.maximum(np.abs(samples).max(axis=1), 1e-9))
    needed = uniform_filter1d(minimum_filter1d(needed, 1440), 720)
    return samples * needed[:, None]


gain_total_db = 0.0
for attempt in range(10):
    loudness = meter.integrated_loudness(mix)
    mix = mix * db(TARGET_LUFS - loudness)
    gain_total_db += TARGET_LUFS - loudness
    mix = limit(mix, SAMPLE_CEILING_DB)
    if abs(meter.integrated_loudness(mix) - TARGET_LUFS) < 0.12 and true_peak_db(mix) <= TRUE_PEAK_LIMIT_DB:
        break
sf.write(os.path.join(HERE, "film-sound.wav"), mix.astype(np.float32), RATE, subtype="FLOAT")

# ----- reports --------------------------------------------------------------------------------------------------
scale = 10 ** (gain_total_db / 20)
rows = []
for name, frame, note, recording, track, event_time in cue_rows:
    onset = attack_index(track, 0.3) / RATE
    offset_ms = (onset - event_time) * 1000
    cue_peak = float(np.abs(track).max()) * scale
    around = int(0.5 * RATE)
    event_sample = int(event_time * RATE)
    bed_window = bed_only[max(0, event_sample - around): event_sample + around] * scale
    bed_rms = math.sqrt(float(np.mean(bed_window ** 2)))
    rows.append({
        "cue": name, "event_frame": frame, "event_time_s": round(event_time, 3), "event_basis": note,
        "sound_onset_s": round(onset, 3), "offset_ms": round(offset_ms, 1), "frame_offset": round(offset_ms / 1000 * FPS, 2),
        "cue_peak_dbfs": round(20 * math.log10(cue_peak + 1e-9), 1),
        "cue_over_bed_db": round(20 * math.log10((cue_peak + 1e-9) / (bed_rms + 1e-9)), 1),
        "recording_slice": recording,
    })
with open(os.path.join(HERE, "cue-report.csv"), "w", newline="", encoding="utf-8") as handle:
    writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)

integrated = meter.integrated_loudness(mix)
peak_sample = float(np.abs(mix).max())
true_peak = true_peak_db(mix)
max_offset = max(abs(row["offset_ms"]) for row in rows)
slices = [row["recording_slice"] for row in rows]
recordings = sorted({row["recording_slice"].split("@")[0] for row in rows})
checks = [
    "film-sound.wav checks",
    "integrated loudness: %.2f LUFS (target %.1f)" % (integrated, TARGET_LUFS),
    "true peak: %.2f dBTP (limit %.1f)  sample peak %.3f" % (true_peak, TRUE_PEAK_LIMIT_DB, peak_sample),
    "length: %.3f s at %d Hz stereo" % (len(mix) / RATE, RATE),
    "mouse inputs logged: %d, kinds %s (moves are silent by design; any click or wheel would have stopped the build)" % (len(input_events), kinds_seen),
    "eat and chunk cues: %d  flee cues: %d  hazard cues: %d  total cues: %d" % (len(eat_events), squeak_count, hazard_cue_count, len(rows)),
    "largest cue offset from its event frame: %.1f ms (one frame is %.1f ms)" % (max_offset, 1000 / FPS),
    "every cue uses its own slice (no slice used twice): %s; %d cues cut from %d recordings" % ("yes" if len(set(slices)) == len(slices) else "NO", len(slices), len(recordings)),
    "beds: " + ", ".join(bed_levels) + " (density and level follow the per-frame worm count), meadow birds and wind thin out as the land is taken, low swell from 25 s",
    "worm count at 4, 12, 20, 26, 30 s: " + ", ".join(str(int(np.interp(second, frames / FPS, worm_counts))) for second in (4, 12, 20, 26, 29.9)),
    "",
    "cue timing (event time, sound onset, offset):",
]
for row in rows:
    checks.append("  %-18s frame %4d event %7.3f s  onset %7.3f s  offset %5.1f ms  peak %6.1f dBFS  %5.1f dB over bed" % (
        row["cue"], row["event_frame"], row["event_time_s"], row["sound_onset_s"], row["offset_ms"], row["cue_peak_dbfs"], row["cue_over_bed_db"]))
text = "\n".join(checks)
open(os.path.join(HERE, "checks.txt"), "w", encoding="utf-8").write(text + "\n")
print(text)
