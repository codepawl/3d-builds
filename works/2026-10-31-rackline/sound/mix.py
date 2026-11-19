"""Mixes the Rackline soundtrack from the ElevenLabs files, the input log and the cue list, then muxes it onto the film.

Usage: uv run --no-project --python 3.12 --with numpy --with soundfile --with pyloudnorm python mix.py <video> <cues.json> <output> [music take]
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy
import pyloudnorm
import soundfile

SOUND_DIRECTORY = Path(__file__).resolve().parent
SAMPLE_RATE = 48000
TARGET_LOUDNESS = -14.0
PEAK_LIMIT = 10 ** (-1.0 / 20)
MUSIC_GAIN_DECIBELS = -5.0
ROOM_TONE_GAIN_DECIBELS = 6.0
DUCK_DECIBELS = -3.0
FINAL_FADE_SECONDS = 0.25
ONSET_DECIBELS_BELOW_PEAK = -24.0
ONSET_LEAD_IN_SECONDS = 0.005
FADE_IN_SECONDS = 0.15
TAIL_SECONDS = 1.1
EFFECTS_FILTER = (
    "highpass=f=40,"
    "lowshelf=f=220:g=8,"
    "equalizer=f=600:t=q:w=1.0:g=-3,"
    "equalizer=f=3200:t=q:w=1.0:g=-4,"
    "highshelf=f=6000:g=-5,"
    "lowpass=f=13000,"
    "acompressor=threshold=-20dB:ratio=2.5:attack=15:release=180:makeup=2,"
    "aecho=0.9:0.85:70|130:0.16|0.09,"
    "highpass=f=30"
)

# Cue kind: peak in dBFS, and whether it ducks the music.
CUES = {
    "click": (-7.0, False),
    "card_open": (-15.0, False),
    "camera_move": (-13.0, False),
    "forklift_lift_long": (-9.0, True),
    "pallet_set": (-8.0, True),
    "reverse_beep": (-17.0, False),
    "conveyor": (-14.0, False),
    "gantry_grab": (-14.0, False),
    "trailer_load": (-10.0, True),
}


def decibels_to_gain(decibels):
    return 10 ** (decibels / 20)


def decode(path):
    command = ["ffmpeg", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SAMPLE_RATE), "-"]
    raw = subprocess.run(command, capture_output=True, check=True).stdout
    return numpy.frombuffer(raw, dtype=numpy.float32).reshape(-1, 2).astype(numpy.float64)


def probe_duration(path):
    command = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]
    return float(subprocess.run(command, capture_output=True, check=True, text=True).stdout.strip())


def trimmed_to_onset(take):
    """Generated effects start with near silence, which would put the cue late against its frame."""
    magnitude = numpy.abs(take).max(axis=1)
    threshold = magnitude.max() * decibels_to_gain(ONSET_DECIBELS_BELOW_PEAK)
    onset = int(numpy.argmax(magnitude >= threshold))
    lead_in = int(ONSET_LEAD_IN_SECONDS * SAMPLE_RATE)
    return take[max(0, onset - lead_in):]


def effect_takes(kind):
    paths = sorted((SOUND_DIRECTORY / "effects").glob(f"{kind}_*.mp3"))
    if not paths:
        raise FileNotFoundError(f"no effect files for {kind}")
    return [trimmed_to_onset(decode(path)) for path in paths]


def pitched(take, rate):
    """Plays a take slower, which lowers it and lengthens it, the way a heavier machine sounds."""
    positions = numpy.arange(0, len(take) - 1, rate)
    return numpy.column_stack([numpy.interp(positions, numpy.arange(len(take)), take[:, channel]) for channel in range(2)])


def shaped_to_length(take, samples):
    """Cuts a long take to its on-screen length with a slow curved tail, so it dies away instead of stopping."""
    if len(take) < samples:
        raise ValueError("the take is shorter than its cue, generate a longer one instead of looping it")
    shaped = take[:samples].copy()
    fade_in = int(FADE_IN_SECONDS * SAMPLE_RATE)
    shaped[:fade_in] *= numpy.linspace(0.0, 1.0, fade_in)[:, None]
    tail = min(int(TAIL_SECONDS * SAMPLE_RATE), samples // 2)
    shaped[-tail:] *= (numpy.cos(numpy.linspace(0.0, numpy.pi / 2, tail)) ** 2)[:, None]
    return shaped


def warmed(effects):
    """Gives the effects more body and takes the sour edge off, then puts them in the hall with a short dark echo."""
    command = ["ffmpeg", "-loglevel", "error", "-f", "f64le", "-ac", "2", "-ar", str(SAMPLE_RATE), "-i", "-",
               "-af", EFFECTS_FILTER, "-f", "f64le", "-ac", "2", "-ar", str(SAMPLE_RATE), "-"]
    raw = subprocess.run(command, input=effects.tobytes(), capture_output=True, check=True).stdout
    processed = numpy.frombuffer(raw, dtype=numpy.float64).reshape(-1, 2)
    output = numpy.zeros_like(effects)
    count = min(len(processed), len(effects))
    output[:count] = processed[:count]
    return output


def place_effects(cues, length):
    effects = numpy.zeros((length, 2))
    duck_marks = numpy.zeros(length)
    takes_by_kind = {}
    use_count_by_kind = {}
    for cue in sorted(cues, key=lambda item: item["time"]):
        kind = cue["kind"]
        peak_decibels, ducks = CUES[kind]
        takes = takes_by_kind.setdefault(kind, effect_takes(kind))
        use_count = use_count_by_kind.get(kind, 0)
        use_count_by_kind[kind] = use_count + 1
        take_index = cue["take"] - 1 if "take" in cue else use_count % len(takes)
        take = takes[take_index]
        if "pitch" in cue:
            take = pitched(take, cue["pitch"])
        duration = cue.get("seconds")
        if duration:
            samples = int(duration * SAMPLE_RATE)
            take = shaped_to_length(take, samples)
        take = take / max(numpy.abs(take).max(), 1e-6) * decibels_to_gain(peak_decibels)
        start = int(cue["time"] * SAMPLE_RATE)
        end = min(length, start + len(take))
        if start >= length:
            continue
        effects[start:end] += take[: end - start]
        if ducks:
            duck_marks[start:end] = 1.0
    return effects, duck_marks


def duck_envelope(duck_marks):
    attack = 1.0 / (0.03 * SAMPLE_RATE)
    release = 1.0 / (0.35 * SAMPLE_RATE)
    amount = numpy.zeros(len(duck_marks))
    current = 0.0
    for index, mark in enumerate(duck_marks):
        current = min(1.0, current + attack) if mark > 0 else max(0.0, current - release)
        amount[index] = current
    return decibels_to_gain(DUCK_DECIBELS * amount)


def master(mix):
    meter = pyloudnorm.Meter(SAMPLE_RATE)
    mastered = mix * decibels_to_gain(TARGET_LOUDNESS - meter.integrated_loudness(mix))
    peak = numpy.abs(mastered).max()
    if peak > PEAK_LIMIT:
        mastered = numpy.tanh(mastered / PEAK_LIMIT) * PEAK_LIMIT
    fade_samples = int(FINAL_FADE_SECONDS * SAMPLE_RATE)
    mastered[-fade_samples:] *= numpy.linspace(1.0, 0.0, fade_samples)[:, None]
    return mastered, meter.integrated_loudness(mastered)


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    video_path, cues_path, output_path = sys.argv[1:4]
    music_take = sys.argv[4] if len(sys.argv) > 4 else "1"
    cues = json.loads(Path(cues_path).read_text(encoding="utf-8"))
    length = int(round(probe_duration(video_path) * SAMPLE_RATE))
    effects, duck_marks = place_effects(cues, length)
    music = decode(SOUND_DIRECTORY / "music" / f"music_{music_take}.mp3")[:length] * decibels_to_gain(MUSIC_GAIN_DECIBELS)
    if len(music) < length:
        raise ValueError("the music is shorter than the film")
    music = music * duck_envelope(duck_marks)[:, None]
    effects = warmed(effects)
    tone = decode(SOUND_DIRECTORY / "effects" / "room_tone_1.mp3")
    tone = numpy.tile(tone, (length // len(tone) + 1, 1))[:length] * decibels_to_gain(ROOM_TONE_GAIN_DECIBELS)
    mastered, loudness = master(music + effects + tone)
    soundtrack_path = SOUND_DIRECTORY / "soundtrack.wav"
    soundfile.write(soundtrack_path, mastered, SAMPLE_RATE, subtype="PCM_24")
    command = ["ffmpeg", "-loglevel", "error", "-y", "-i", video_path, "-i", str(soundtrack_path), "-map", "0:v", "-map", "1:a",
               "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", output_path]
    subprocess.run(command, check=True)
    print(json.dumps({"cues": len(cues), "loudness_lufs": round(loudness, 2), "music_take": music_take}))


if __name__ == "__main__":
    main()
