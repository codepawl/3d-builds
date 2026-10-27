"""Food Forest study soundtrack: one cue per on-screen event, read from ../events.json.

Rerun after the picture changes and the sound re-syncs. Without ../events.json a draft event list from the
brief is used (written to sound/events.draft.json). Outputs soundtrack.wav, checks.txt, cue-report.csv.

Every cue takes its own slice of a CC0 recording: slices never overlap and no slice is played twice. When a
pool runs out the script stops with an error; add recordings to tools/download_sources.py instead of reusing.
"""
import csv
import json
import sys
from pathlib import Path

import numpy as np
import pyloudnorm
import soundfile
from scipy import signal

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SAMPLE_RATE = 48000
DURATION = 15.0
HERE = Path(__file__).resolve().parent
SOURCES = HERE / "sources"
EVENTS_PATH = HERE.parent / "events.json"
DRAFT_PATH = HERE / "events.draft.json"
FALLBACK_CUTS = [2.16, 5.28, 6.60, 8.96, 12.24]

GRASS_FILES = ["146436", "559082", "364712", "395564", "734643", "570759", "179338", "176252", "351609"]
LEAFY_FILES = ["445788", "117884", "733731", "362253", "437356", "443065", "460236", "207125", "874461", "59315", "106114", "253535", "676801", "830335"]
LEAFFALL_FILES = ["405140", "192528", "444485", "168693"]
PENCIL_FILES = ["320154", "530190", "336381", "269336"]
COMPASS_SCRATCH_FILES = ["387927"]
METAL_FILES = ["81267", "81266"]

# Target RMS (dBFS) of each cue slice before the master, by event kind.
LEVEL_DB = {"pencil": -26, "compass": -28, "tick": -22, "grass": -36, "shrub": -38, "tree": -29,
            "meadow": -33, "leaf": -49}
# Typical event size per kind (events.json "size"); a bigger plant plays louder, within 6 dB.
SIZE_REFERENCE = {"grass": 0.19, "shrub": 0.4, "tree": 0.7, "meadow": 0.55, "leaf": 0.08}
# Longest cue per growth kind; growths now last 1.5 to 3 s (smootherstep) and the recordings are finite.
GROWTH_CUE_MAX_SECONDS = {"grass": 1.3, "meadow": 1.6, "shrub": 1.5, "tree": 2.0}


# ---------------------------------------------------------------- events

def draft_events():
    """Events read off the brief and the reference frames; replaced by ../events.json when it exists."""
    events = []

    def add(kind, start, peak, end, x, x_end=None):
        entry = {"id": f"draft-{len(events):02d}-{kind}", "kind": kind, "start": start, "peak": peak, "end": end, "x": x}
        if x_end is not None:
            entry["x_end"] = x_end
        events.append(entry)

    for cut in FALLBACK_CUTS:
        add("cut", cut, cut, cut, 0.5)
    add("pencil", 0.05, 1.0, 2.10, 0.15, 0.85)
    for index, start in enumerate([0.12, 0.38, 0.62, 0.88, 1.14]):
        add("grass", start, start + 0.22, start + 0.55, 0.2 + 0.13 * index)
    for start, x in [(0.45, 0.35), (0.85, 0.55), (1.30, 0.72)]:
        add("shrub", start, start + 0.30, start + 0.70, x)
    add("tree", 0.95, 1.40, 2.00, 0.6)
    add("compass", 2.20, 2.70, 3.30, 0.45, 0.6)
    for index, start in enumerate([2.45, 2.65, 2.85, 3.02, 3.18]):
        add("grass", start, start + 0.2, start + 0.5, 0.35 + 0.06 * index)
    for index, start in enumerate([3.35, 3.7, 4.0]):
        add("grass", start, start + 0.25, start + 0.55, 0.45 + 0.05 * index)
    add("tree", 4.30, 4.85, 5.28, 0.5)
    add("tree", 5.30, 5.85, 6.35, 0.5)
    for index, start in enumerate([6.65, 7.1, 7.55, 8.0, 8.45]):
        add("meadow", start, start + 0.3, start + 0.75, 0.15 + 0.17 * index)
    for index, start in enumerate([9.05, 9.40, 9.72, 10.05, 10.40, 10.70, 11.00, 11.35]):
        add("tree", start, start + 0.3, start + 0.65, 0.2 + 0.09 * ((index * 5) % 8))
    for start, x in [(10.0, 0.25), (11.2, 0.8)]:
        add("meadow", start, start + 0.35, start + 0.8, x)
    for start, fall, x in [(12.8, 0.7, 0.4), (13.3, 0.9, 0.6), (13.7, 0.6, 0.35), (14.1, 0.7, 0.55), (14.4, 0.5, 0.62)]:
        add("leaf", start, start + fall * 0.6, start + fall, x)
    return events


def load_events():
    if EVENTS_PATH.exists():
        data = json.loads(EVENTS_PATH.read_text(encoding="utf-8"))
        events = data["events"] if isinstance(data, dict) else data
        origin = str(EVENTS_PATH)
    else:
        events = draft_events()
        DRAFT_PATH.write_text(json.dumps(events, indent=1), encoding="utf-8")
        origin = f"DRAFT (no events.json yet) {DRAFT_PATH}"
    return sorted(events, key=lambda event: event["start"]), origin


# ---------------------------------------------------------------- audio helpers

def load_mono(file_id):
    matches = list(SOURCES.glob(f"*/{file_id}_*.ogg"))
    if not matches:
        raise FileNotFoundError(f"source {file_id} missing; run tools/download_sources.py")
    data, rate = soundfile.read(matches[0], always_2d=True)
    mono = data.mean(axis=1)
    if rate != SAMPLE_RATE:
        mono = signal.resample_poly(mono, SAMPLE_RATE, rate)
    return mono.astype(np.float64)


def rms_db(samples):
    return 20 * np.log10(np.sqrt(np.mean(samples ** 2)) + 1e-12)


def envelope(samples, window_seconds=0.005):
    window = max(1, int(window_seconds * SAMPLE_RATE))
    return np.sqrt(np.convolve(samples ** 2, np.ones(window) / window, mode="same"))


def first_onset(samples):
    """Index of the first moment the 5 ms envelope reaches 25% of its 90th percentile."""
    level = envelope(samples)
    threshold = 0.35 * np.percentile(level, 90)
    above = np.nonzero(level >= threshold)[0]
    return int(above[0]) if len(above) else 0


class SlicePool:
    """Hands out non-overlapping slices of a set of recordings, each region at most once."""

    def __init__(self, file_ids, name):
        self.name = name
        self.files = {file_id: load_mono(file_id) for file_id in file_ids}
        self.cursor = {file_id: 0 for file_id in file_ids}
        self.floor = {file_id: np.percentile(envelope(audio, 0.1), 40) for file_id, audio in self.files.items()}
        self.order = list(file_ids)
        self.turn = 0
        self.used = []

    def take(self, seconds, align=True):
        """A slice of this pool; with align the slice starts on a real onset (within 0.25 s of the scan point)."""
        length = int(seconds * SAMPLE_RATE)
        margin = int(0.3 * SAMPLE_RATE) if align else 0
        step = int(0.05 * SAMPLE_RATE)
        for attempt in range(len(self.order)):
            file_id = self.order[(self.turn + attempt) % len(self.order)]
            audio = self.files[file_id]
            start = self.cursor[file_id]
            while start + length + margin < len(audio):
                onset = first_onset(audio[start:start + int(0.3 * SAMPLE_RATE) + length]) if align else 0
                begin = start + onset
                if (not align or onset <= int(0.25 * SAMPLE_RATE)) and begin + length <= len(audio):
                    window = audio[begin:begin + length]
                    if np.sqrt(np.mean(window ** 2)) >= self.floor[file_id]:
                        self.cursor[file_id] = begin + length + int(0.15 * SAMPLE_RATE)
                        self.turn = (self.turn + attempt + 1) % len(self.order)
                        self.used.append((file_id, begin / SAMPLE_RATE, (begin + length) / SAMPLE_RATE))
                        return window.copy()
                start += step
            self.cursor[file_id] = len(audio)
        raise RuntimeError(f"pool {self.name} ran out of recordings; add more to tools/download_sources.py")


def flatten(samples):
    """Evens out slow loudness swings so a scratch does not start in a quiet stretch."""
    smooth = envelope(samples, 0.1) + 1e-6
    return samples / smooth ** 0.6 * np.median(smooth) ** 0.6


def take_aligned(pool, seconds):
    return pool.take(seconds, align=True)


def growth_envelope(length, start, peak, end):
    """Onset at start, swell to the overshoot peak, settle to the end. Sample 0 is the event start."""
    time = np.arange(length) / SAMPLE_RATE
    peak_offset = max(peak - start, 0.04)
    total = max(end - start, peak_offset + 0.05)
    rise = np.clip(time / peak_offset, 0, 1)
    swell = 0.65 + 0.35 * np.sin(rise * np.pi / 2)
    settle = np.clip((time - peak_offset) / (total - peak_offset), 0, 1)
    fall = 0.5 * (1 + np.cos(np.pi * settle)) ** 1.3
    # A soft 25 ms fade-in: no click at the start of a growth, the way a close-mic ASMR rustle opens.
    attack = np.clip(time / 0.025, 0, 1) ** 2
    return swell * np.where(time < peak_offset, 1.0, fall) * attack


def place(canvas, mono, start_seconds, pan):
    """Constant-power pan into the stereo canvas at start_seconds. Pan runs 0 (left) to 1 (right), scalar or array."""
    start = int(round(start_seconds * SAMPLE_RATE))
    end = min(start + len(mono), canvas.shape[1])
    mono = mono[: end - start]
    pan_values = np.broadcast_to(np.asarray(pan, dtype=float), mono.shape) if np.ndim(pan) == 0 else np.asarray(pan)[: len(mono)]
    angle = np.clip(pan_values, 0, 1) * np.pi / 2
    canvas[0, start:end] += mono * np.cos(angle)
    canvas[1, start:end] += mono * np.sin(angle)


def normalise(mono, target_db):
    return mono * 10 ** ((target_db - rms_db(mono)) / 20)


def highpass(samples, cutoff):
    sos = signal.butter(2, cutoff, "highpass", fs=SAMPLE_RATE, output="sos")
    return signal.sosfilt(sos, samples)


def lowpass(samples, cutoff):
    sos = signal.butter(2, cutoff, "lowpass", fs=SAMPLE_RATE, output="sos")
    return signal.sosfilt(sos, samples)


# ---------------------------------------------------------------- cue rendering

def peaking(samples, frequency, gain_db, quality):
    """RBJ peaking biquad: cuts or lifts one band."""
    amplitude = 10 ** (gain_db / 40)
    omega = 2 * np.pi * frequency / SAMPLE_RATE
    alpha = np.sin(omega) / (2 * quality)
    numerator = [1 + alpha * amplitude, -2 * np.cos(omega), 1 - alpha * amplitude]
    denominator = [1 + alpha / amplitude, -2 * np.cos(omega), 1 - alpha / amplitude]
    return signal.lfilter(numerator, denominator, samples)


def soften(samples):
    """ASMR-close plant sounds (An, 2026-10-25: growth rustles were too high and harsh for the ear).
    Dip the 2 to 5 kHz band the ear finds shrill, roll off the air above 6 kHz and keep the warm low mids."""
    samples = peaking(samples, 3000, -10.0, 0.6)
    samples = peaking(samples, 400, 3.0, 0.7)
    sos = signal.butter(4, 4800, "lowpass", fs=SAMPLE_RATE, output="sos")
    return signal.sosfilt(sos, samples)


def render_cue(event, pools):
    """Returns (mono samples starting at event start, pan array or scalar, label of the sources)."""
    kind = event["kind"]
    start, peak, end = max(event["start"], 0.0), event["peak"], event["end"]
    size_db = 0.0
    if kind in SIZE_REFERENCE and event.get("size"):
        size_db = float(np.clip(10 * np.log10(event["size"] / SIZE_REFERENCE[kind]), -6, 6))
    length_seconds = max(end - start, 0.12)
    if kind in GROWTH_CUE_MAX_SECONDS:
        # A slow growth is heard while it visibly swells; its last slow settle fades out within the cap.
        length_seconds = min(length_seconds, max(GROWTH_CUE_MAX_SECONDS[kind], (peak - start) * 1.6))
        end = start + length_seconds
    x = event.get("x", 0.5)
    x_end = event.get("x_end", x)
    length = int(length_seconds * SAMPLE_RATE)
    pan = x if x_end == x else np.linspace(x, x_end, length)

    if kind == "pencil":
        raw = take_aligned(pools["pencil"], length_seconds)
        fade = np.clip(np.arange(len(raw)) / (0.02 * SAMPLE_RATE), 0, 1) * np.clip((len(raw) - np.arange(len(raw))) / (0.03 * SAMPLE_RATE), 0, 1)
        return normalise(highpass(flatten(raw), 250), LEVEL_DB["pencil"]) * fade, pan

    if kind == "compass":
        tick_pool = pools["metal"]
        tick_raw = tick_pool.take(0.5, align=False)
        tick = tick_raw[first_onset(tick_raw): first_onset(tick_raw) + int(0.12 * SAMPLE_RATE)]
        tick = highpass(tick, 1500) * np.exp(-np.arange(len(tick)) / (0.025 * SAMPLE_RATE))
        tick = normalise(tick, LEVEL_DB["tick"])
        scratch_seconds = max(end - start - 0.10, 0.2)
        scratch = take_aligned(pools["compass"], scratch_seconds)
        fade = np.clip(np.arange(len(scratch)) / (0.02 * SAMPLE_RATE), 0, 1) * np.clip((len(scratch) - np.arange(len(scratch))) / (0.04 * SAMPLE_RATE), 0, 1)
        scratch = normalise(highpass(flatten(scratch), 300), LEVEL_DB["compass"]) * fade
        out = np.zeros(length)
        out[: len(tick)] += tick[: length]
        offset = int(0.10 * SAMPLE_RATE)
        out[offset: offset + len(scratch)] += scratch[: length - offset]
        return out, pan

    if kind in ("grass", "meadow"):
        raw = take_aligned(pools["grass"], length_seconds)
        raw = soften(highpass(raw, 180 if kind == "grass" else 150))
    elif kind in ("shrub", "tree"):
        raw = take_aligned(pools["leafy"], length_seconds)
        raw = soften(highpass(raw, 120 if kind == "tree" else 160))
    elif kind == "leaf":
        raw = take_aligned(pools["leaffall"], min(length_seconds, 0.9))
        raw = soften(highpass(raw, 250))
        if len(raw) < length:
            raw = np.pad(raw, (0, length - len(raw)))
    else:
        return None, None
    shape = growth_envelope(len(raw), start, peak, end)
    if kind == "leaf":
        shape = growth_envelope(len(raw), start, peak, start + len(raw) / SAMPLE_RATE)
    return normalise(raw, LEVEL_DB[kind] + size_db) * shape / max(np.sqrt(np.mean(shape ** 2)), 0.2), pan


# ---------------------------------------------------------------- ambience

def segment_bounds(events):
    cuts = sorted(event["start"] for event in events if event["kind"] == "cut") or FALLBACK_CUTS
    return [0.0] + cuts + [DURATION], cuts[-1]


def ambience(events, canvas):
    """Room tone (desk room, then dining room), distant birds, wind and pad. Allowed gaps-filler by the brief."""
    bounds, last_cut = segment_bounds(events)
    desk = load_mono("641306")
    dining = load_mono("110127")
    birds = [load_mono(file_id) for file_id in ("548489", "341337", "463903")]
    wind = load_mono("459977")
    pad = load_mono("255169")
    labels = []
    cross = int(0.04 * SAMPLE_RATE)
    for index in range(len(bounds) - 1):
        begin, finish = bounds[index], bounds[index + 1]
        after_last = begin >= last_cut - 1e-6
        length = int((finish - begin) * SAMPLE_RATE) + 2 * cross
        room_source = dining if after_last else desk
        room_offset = int((3 + 9 * index) * SAMPLE_RATE)
        room_offset %= max(1, len(room_source) - length)
        room = room_source[room_offset: room_offset + length].copy()
        room = lowpass(room, 5000 + 700 * (index % 3)) if not after_last else lowpass(room, 3800)
        room = normalise(room, -40 if not after_last else -41)
        bird_source = birds[index % 3]
        bird_offset = int((5 + 17 * index) * SAMPLE_RATE)
        bird_offset %= max(1, len(bird_source) - length)
        bird = highpass(bird_source[bird_offset: bird_offset + length], 1200)
        bird = normalise(bird, -45 if not after_last else -49)
        layer = (room + bird)
        fade = np.ones(len(layer))
        fade[:cross] = np.linspace(0, 1, cross)
        fade[-cross:] = np.linspace(1, 0, cross)
        place(canvas, layer * fade, begin - cross / SAMPLE_RATE if begin > 0 else 0.0, 0.5)
        labels.append(f"segment {begin:.2f}-{finish:.2f}: {'dining' if after_last else 'desk'} room tone + birds {index % 3}")
    # Last shot: a little wind and a very soft pad swell, under the cues.
    length = int((DURATION - last_cut) * SAMPLE_RATE)
    gust = normalise(lowpass(wind[int(4 * SAMPLE_RATE): int(4 * SAMPLE_RATE) + length], 1800), -42)
    gust *= np.linspace(0.3, 1.0, length)
    pad_part = lowpass(pad[int(6 * SAMPLE_RATE): int(6 * SAMPLE_RATE) + length], 1200)
    swell = np.sin(np.linspace(0, np.pi, length) ** 1.0 / 2 * 1.0) ** 2
    swell = np.sin(np.linspace(0, np.pi / 2, length)) ** 2
    pad_part = normalise(pad_part, -40) * swell * np.clip((length - np.arange(length)) / (0.8 * SAMPLE_RATE), 0, 1)
    place(canvas, gust, last_cut, 0.5)
    place(canvas, pad_part, last_cut, 0.5)
    return labels


# ---------------------------------------------------------------- master

def true_peak_db(stereo):
    upsampled = signal.resample_poly(stereo, 4, 1, axis=1)
    return 20 * np.log10(np.max(np.abs(upsampled)) + 1e-12)


def limit(stereo, ceiling_db=-1.3):
    ceiling = 10 ** (ceiling_db / 20)
    upsampled = signal.resample_poly(stereo, 4, 1, axis=1)
    peak = np.max(np.abs(upsampled), axis=0)
    need = np.minimum(1.0, ceiling / (peak + 1e-12))
    window = int(0.004 * SAMPLE_RATE) * 4
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    held = minimum_filter1d(need, window * 2 + 1)
    smooth = uniform_filter1d(held, window + 1)
    smooth = np.minimum(smooth, need.clip(max=1))
    smooth = smooth[::4][: stereo.shape[1]]
    return stereo * np.minimum(1.0, np.interp(np.arange(stereo.shape[1]), np.arange(len(smooth)), smooth))


def master(stereo):
    meter = pyloudnorm.Meter(SAMPLE_RATE)
    result = stereo
    for _ in range(6):
        loudness = meter.integrated_loudness(result.T)
        result = result * 10 ** ((-14.0 - loudness) / 20)
        result = limit(result)
    return result


def onset_index(mono):
    level = envelope(mono, 0.002)
    return int(np.argmax(level >= 0.10 * np.percentile(level, 95)))


def detect_onsets(mono):
    hop = int(0.01 * SAMPLE_RATE)
    frames = len(mono) // hop
    level = 20 * np.log10(np.sqrt(np.mean(mono[: frames * hop].reshape(frames, hop) ** 2, axis=1)) + 1e-9)
    onsets = []
    for index in range(5, frames - 1):
        if level[index] - np.min(level[index - 5: index]) > 6 and level[index] > level[index - 1] - 0.5:
            time = index * 0.01
            if not onsets or time - onsets[-1] > 0.12:
                onsets.append(time)
    return onsets


def main():
    events, origin = load_events()
    pools = {
        "grass": SlicePool(GRASS_FILES, "grass"),
        "leafy": SlicePool(LEAFY_FILES, "leafy"),
        "leaffall": SlicePool(LEAFFALL_FILES, "leaffall"),
        "pencil": SlicePool(PENCIL_FILES, "pencil"),
        "compass": SlicePool(COMPASS_SCRATCH_FILES, "compass"),
        "metal": SlicePool(METAL_FILES, "metal"),
    }
    total = int(DURATION * SAMPLE_RATE)
    canvas = np.zeros((2, total))
    ambience_labels = ambience(events, canvas)
    rows = []
    for event in events:
        if event["kind"] == "cut":
            continue
        mono, pan = render_cue(event, pools)
        if mono is None:
            continue
        clamped_start = max(event["start"], 0.0)
        # Drop any quiet lead-in so the first audible moment sits on the event start.
        for _ in range(3):
            lead = onset_index(mono)
            if lead <= int(0.004 * SAMPLE_RATE):
                break
            mono = mono[lead:]
            pan = pan if np.ndim(pan) == 0 else pan[lead:]
        place(canvas, mono, clamped_start, pan)
        measured_onset = clamped_start + onset_index(mono) / SAMPLE_RATE
        rows.append({"id": event["id"], "kind": event["kind"], "event_start": event["start"], "event_peak": event["peak"],
                     "event_end": event["end"], "cue_onset": round(measured_onset, 4),
                     "offset_ms": round((measured_onset - clamped_start) * 1000, 1), "pan": float(np.mean(pan)),
                     "length_s": round(len(mono) / SAMPLE_RATE, 3)})
    mastered = master(canvas)
    soundfile.write(HERE / "soundtrack.wav", mastered.T, SAMPLE_RATE, subtype="PCM_24")

    meter = pyloudnorm.Meter(SAMPLE_RATE)
    loudness = meter.integrated_loudness(mastered.T)
    peak = true_peak_db(mastered)
    detected = detect_onsets(mastered.mean(axis=0))
    worst = max(abs(row["offset_ms"]) for row in rows)
    with open(HERE / "cue-report.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    lines = [f"events: {origin}", f"duration: {mastered.shape[1] / SAMPLE_RATE:.3f} s, {SAMPLE_RATE} Hz, stereo",
             f"integrated loudness: {loudness:.2f} LUFS (target -14)",
             f"true peak: {peak:.2f} dBTP (limit -1)", f"sample peak: {20 * np.log10(np.max(np.abs(mastered))):.2f} dBFS",
             f"cues (one per event): {len(rows)}; onsets detected in the master: {len(detected)} (reference about 43)",
             f"cue onset = first 2 ms level reaching 10% of the cue 95th-percentile level; worst cue offset from event start: {worst:.1f} ms (target under 33 ms)",
             f"PASS loudness: {abs(loudness + 14) < 0.5}", f"PASS true peak: {peak < -1.0}", f"PASS sync: {worst < 33}",
             "", "ambience:"] + ["  " + label for label in ambience_labels]
    lines += ["", "cue vs event (times in s; offset = cue onset - event start, ms):",
              "id | kind | event start / peak / end | cue onset | offset ms | pan | cue length"]
    for row in rows:
        lines.append(f"{row['id']} | {row['kind']} | {row['event_start']:.3f} / {row['event_peak']:.3f} / {row['event_end']:.3f}"
                     f" | {row['cue_onset']:.3f} | {row['offset_ms']:+.1f} | {row['pan']:.2f} | {row['length_s']:.2f}")
    lines += ["", "recording slices used (file id, from s, to s):"]
    for name, pool in pools.items():
        for file_id, begin, finish in pool.used:
            lines.append(f"  {name}: {file_id} {begin:.2f}-{finish:.2f}")
    seconds = [f"{rms_db(mastered[:, i * SAMPLE_RATE:(i + 1) * SAMPLE_RATE]):.1f}" for i in range(15)]
    lines += ["", "per-second RMS dBFS (0 to 14 s): " + " ".join(seconds)]
    lines += ["", "Measured only. Nobody has listened to this yet."]
    (HERE / "checks.txt").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines[:12]))


if __name__ == "__main__":
    main()
