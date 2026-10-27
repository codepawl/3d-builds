"""Synthesizes the documentary's sound effects locally; footsteps are CC0 recordings in tools/sounds (CREDITS.md).

uv run --no-project --with numpy python tools/sfx.py <seconds> <cues.json> <output.wav> [footfalls.json]

cues.json is a list of {kind, start, duration, gain} in film seconds (SFX_CUES in src/film/script.js); footfalls.json is
the list the recorder logs ({seconds, who, distance}). Wind and footsteps are CC0 recordings: every footfall gets one
step sliced from the recording, the steps cues only say the surface and the loudness. Every other effect is filtered
noise and simple tones: a door, car engine
(passing and idling), a car door, a soft two-tone siren, fire, a generator, a lamp clunk, a gavel,
a clock, a corridor hum, a distant church bell, night insects, smoke hiss,
snow-shovel scrapes, neon hum, stove crackle, a floorboard creak, and the map sounds (pen sweep, X thump, plate tick,
pull-out swell). The output is 16-bit stereo WAV at 48 kHz, peak about -6 dBFS; sound.mjs mixes it
under the music and sets the loudness.
"""
import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SAMPLE_RATE = 48000
RANDOM = numpy.random.default_rng(1906)


def seconds_axis(duration):
    return numpy.arange(int(duration * SAMPLE_RATE)) / SAMPLE_RATE


def band(signal, low, high):
    """Keeps frequencies between low and high Hz (FFT mask with soft edges)."""
    spectrum = numpy.fft.rfft(signal)
    frequencies = numpy.fft.rfftfreq(len(signal), 1 / SAMPLE_RATE)
    mask = numpy.clip((frequencies - low * 0.8) / (low * 0.4 + 1e-9), 0, 1) if low > 0 else numpy.ones_like(frequencies)
    mask *= numpy.clip((high * 1.2 - frequencies) / (high * 0.4), 0, 1)
    return numpy.fft.irfft(spectrum * mask, len(signal))


def noise(duration):
    return RANDOM.standard_normal(int(duration * SAMPLE_RATE))


def fade(signal, attack=0.15, release=0.3):
    length = len(signal)
    envelope = numpy.ones(length)
    attack_samples = min(length, int(attack * SAMPLE_RATE))
    release_samples = min(length, int(release * SAMPLE_RATE))
    if attack_samples:
        envelope[:attack_samples] = numpy.linspace(0, 1, attack_samples)
    if release_samples:
        envelope[-release_samples:] *= numpy.linspace(1, 0, release_samples)
    return signal * envelope


def normalized(signal):
    peak = numpy.max(numpy.abs(signal)) or 1
    return signal / peak


WIND_RMS = 0.03


def wind(duration, rate):
    """A stretch of the recorded wind (tools/sounds/wind.ogg), as it was recorded: no synthetic gusts. It is set to a
    fixed low level and fades in and out softly, so a cut never shows a bed switching on."""
    source = recording("wind.ogg")
    length = int(duration * SAMPLE_RATE)
    offset = int(RANDOM.random() * max(1, len(source) - length))
    stretch = source[offset:offset + length]
    stretch = stretch - band(stretch, 0, 70)  # no rumble
    stretch = stretch / (numpy.sqrt(numpy.mean(stretch ** 2)) or 1) * WIND_RMS
    return fade(stretch, 1.2, 1.6)


def one_step(surface):
    length = 0.09 if surface == "snow" else 0.06
    burst = noise(length)
    burst = band(burst, 300, 2500) if surface == "snow" else band(burst, 900, 6000)
    time = seconds_axis(length)
    grains = (RANDOM.random(len(burst)) < 0.25) if surface == "gravel" else numpy.ones(len(burst))
    thump = 0.6 * numpy.sin(2 * numpy.pi * 90 * time) * numpy.exp(-time * 60)
    return normalized(burst * grains * numpy.exp(-time * (35 if surface == "snow" else 55)) + thump)


SOUNDS = Path(__file__).parent / "sounds"
recordings = {}


def recording(name):
    """Decodes a recorded sound (tools/sounds, see CREDITS.md) to mono float at the mix rate, peak 1."""
    if name not in recordings:
        decoded = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", str(SOUNDS / name), "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "f32le", "-"],
            check=True,
            capture_output=True,
        ).stdout
        recordings[name] = normalized(numpy.frombuffer(decoded, dtype=numpy.float32).astype(numpy.float64))
    return recordings[name]


STEP_LENGTH = 0.27
STEP_PREROLL = 0.02  # the slice starts this long before the transient, so the attack can be put on the footfall
step_slices = {}


def step_onsets(source):
    """Times (s) where a footstep's attack begins: a jump of the 5 ms energy envelope, refined to the sample."""
    hop = SAMPLE_RATE // 200
    frames = len(source) // hop
    energy = numpy.sqrt((source[: frames * hop].reshape(frames, hop) ** 2).mean(axis=1))
    jump = numpy.log(energy + 1e-4)
    onsets = []
    for index in range(3, frames):
        rising = jump[index] - jump[index - 3] > 0.9 and energy[index] > 0.15 * energy.max()
        if rising and (not onsets or (index - onsets[-1]) * hop / SAMPLE_RATE > 0.2):
            onsets.append(index)
    refined = []
    for index in onsets:
        window = numpy.abs(source[max(0, (index - 6) * hop):(index + 2) * hop])
        smooth = numpy.convolve(window, numpy.ones(48) / 48, mode="same")
        refined.append((max(0, (index - 6) * hop) + int(numpy.argmax(smooth > 0.25 * smooth.max()))) / SAMPLE_RATE)
    return refined


def single_steps(surface):
    """One slice (STEP_PREROLL before the attack, up to STEP_LENGTH long) for every step in the recording."""
    if surface not in step_slices:
        source = recording(f"footsteps-{surface}.ogg")
        onsets = step_onsets(source)
        slices = []
        for number, onset in enumerate(onsets):
            start = max(0, int((onset - STEP_PREROLL) * SAMPLE_RATE))
            following = onsets[number + 1] - 0.03 if number + 1 < len(onsets) else len(source) / SAMPLE_RATE
            piece = source[start:min(start + int(STEP_LENGTH * SAMPLE_RATE), int(following * SAMPLE_RATE))].copy()
            slices.append(fade(piece, 0.004, 0.06) / (numpy.max(numpy.abs(piece)) or 1))
        step_slices[surface] = slices
    return step_slices[surface]


def footfall_steps(duration, step_cues, footfalls):
    """One recorded step per visible footfall, its attack on the footfall time. The surface and the loudness come from
    the steps cue that covers that moment (a footfall outside every steps cue stays silent). Far figures are quieter,
    and landings that are almost together (two walkers, a crowd) make one sound, so a crowd never turns into clatter."""
    output = numpy.zeros((int(duration * SAMPLE_RATE) + SAMPLE_RATE, 2))
    chosen = []
    for footfall in sorted(footfalls, key=lambda item: item["distance"]):
        cue = next((cue for cue in step_cues if cue["start"] <= footfall["seconds"] < cue["start"] + cue["duration"]), None)
        loudness = min(1.0, 7.0 / max(footfall["distance"], 1.0)) ** 1.2
        if cue is None or loudness < 0.08:
            continue
        if any(abs(footfall["seconds"] - other["seconds"]) < 0.06 for other in chosen):
            continue
        chosen.append({**footfall, "surface": cue["kind"].replace("steps_", ""), "gain": cue["gain"] * loudness})
    counter = {}
    for footfall in sorted(chosen, key=lambda item: item["seconds"]):
        slices = single_steps(footfall["surface"])
        # Walk through the recorded steps in a shuffled order so neighbours differ, and vary the pitch a little.
        number = counter.get(footfall["surface"], 0)
        counter[footfall["surface"]] = number + 1
        order = numpy.random.default_rng(len(slices) * 7).permutation(len(slices))
        piece = slices[order[number % len(slices)]]
        speed = 0.93 + 0.14 * RANDOM.random()
        piece = numpy.interp(numpy.arange(0, len(piece) - 1, speed), numpy.arange(len(piece)), piece)
        start = int((footfall["seconds"] - STEP_PREROLL / speed) * SAMPLE_RATE)
        if start < 0:
            continue
        pan = 0.5 + 0.12 * (1 if number % 2 else -1)
        output[start:start + len(piece), 0] += piece * footfall["gain"] * (1 - pan) * 1.4
        output[start:start + len(piece), 1] += piece * footfall["gain"] * pan * 1.4
    return output


def door(duration, rate):
    time = seconds_axis(duration)
    pitch = 190 + 70 * numpy.sin(2 * numpy.pi * 1.6 * time) + 25 * RANDOM.standard_normal(len(time)).cumsum() / SAMPLE_RATE ** 0.5
    phase = 2 * numpy.pi * numpy.cumsum(pitch) / SAMPLE_RATE
    creak = band(numpy.sign(numpy.sin(phase)) * (0.5 + 0.5 * numpy.sin(phase * 0.5)), 300, 2400)
    latch = numpy.zeros(len(time))
    click = one_step("gravel")[:1200]
    latch[: len(click)] += click * 0.8
    return fade(normalized(creak) * 0.35, 0.05, 0.25) + latch


def engine(duration, rate, passing):
    time = seconds_axis(duration)
    base = 38 + (6 * numpy.tanh((time - duration / 2) * 2) * -1 if passing else 0)
    phase = 2 * numpy.pi * numpy.cumsum(base * numpy.ones_like(time)) / SAMPLE_RATE
    tone = sum(numpy.sin(phase * harmonic) / harmonic for harmonic in (1, 2, 3, 4, 6))
    rumble = band(noise(duration), 30, 260) * 0.6
    sound = normalized(tone + rumble)
    if passing:
        sound *= numpy.exp(-((time - duration * 0.45) ** 2) / (2 * (duration * 0.25) ** 2))
    else:
        sound *= 0.6 + 0.08 * numpy.sin(2 * numpy.pi * 11 * time)
    return fade(sound * 0.6, 0.3, 0.4)


def siren(duration, rate):
    time = seconds_axis(duration)
    pitch = numpy.where((time % 1.2) < 0.6, 640, 520)
    phase = 2 * numpy.pi * numpy.cumsum(pitch) / SAMPLE_RATE
    return fade(numpy.sin(phase) * 0.18, 0.5, 0.6)


def car_door(duration, rate):
    time = seconds_axis(duration)
    thump = numpy.sin(2 * numpy.pi * 70 * time) * numpy.exp(-time * 22)
    click = band(noise(duration), 1500, 6000) * numpy.exp(-time * 120)
    return normalized(thump + 0.4 * click) * 0.7


def fire(duration, rate):
    time = seconds_axis(duration)
    roar = normalized(band(noise(duration), 40, 500)) * (0.55 + 0.15 * numpy.sin(2 * numpy.pi * 0.7 * time))
    crackle = numpy.zeros(len(time))
    for _ in range(int(duration * 38)):
        start = RANDOM.integers(0, max(1, len(time) - 2400))
        length = RANDOM.integers(200, 2400)
        pop = band(RANDOM.standard_normal(length), 800, 7000) * numpy.exp(-numpy.arange(length) / (length / 6))
        crackle[start:start + len(pop)] += normalized(pop) * RANDOM.uniform(0.2, 1.0)
    for _ in range(int(duration * 1.5)):
        start = RANDOM.integers(0, max(1, len(time) - 9600))
        crack = car_door(0.2, 0) * 0.9
        crackle[start:start + len(crack)] += crack
    return fade(roar * 0.15 + crackle * 0.35, 0.5, 0.5)


def generator(duration, rate):
    time = seconds_axis(duration)
    tone = sum(numpy.sin(2 * numpy.pi * 60 * harmonic * time) / harmonic for harmonic in (1, 2, 3, 5))
    chug = 0.75 + 0.25 * numpy.sin(2 * numpy.pi * 15 * time)
    return fade(normalized(tone * chug + 0.4 * band(noise(duration), 60, 400)) * 0.45, 0.4, 0.4)


def clunk(duration, rate):
    time = seconds_axis(duration)
    return normalized(numpy.sin(2 * numpy.pi * 85 * time) * numpy.exp(-time * 28) + 0.5 * band(noise(duration), 400, 3000) * numpy.exp(-time * 90)) * 0.8


def gavel(duration, rate):
    output = numpy.zeros(int(duration * SAMPLE_RATE))
    for offset in (0.0, 0.28):
        knock_time = seconds_axis(0.25)
        knock = numpy.sin(2 * numpy.pi * 310 * knock_time) * numpy.exp(-knock_time * 40) + 0.6 * numpy.sin(2 * numpy.pi * 720 * knock_time) * numpy.exp(-knock_time * 60)
        start = int(offset * SAMPLE_RATE)
        output[start:start + len(knock)] += knock[: len(output) - start]
    return normalized(output) * 0.8


def clock(duration, rate):
    output = numpy.zeros(int(duration * SAMPLE_RATE))
    tick_time = seconds_axis(0.04)
    for index, moment in enumerate(numpy.arange(0.3, duration, 1.0)):
        tick = band(noise(0.04), 2000, 8000) * numpy.exp(-tick_time * 160) * (1 if index % 2 else 0.7)
        start = int(moment * SAMPLE_RATE)
        output[start:start + len(tick)] += tick[: len(output) - start]
    return normalized(output) * 0.5


def hum(duration, rate):
    time = seconds_axis(duration)
    return fade((numpy.sin(2 * numpy.pi * 120 * time) + 0.4 * numpy.sin(2 * numpy.pi * 240 * time)) * 0.07, 0.8, 0.8)


def paper(duration, rate):
    time = seconds_axis(duration)
    rustle = band(noise(duration), 2000, 9000) * (0.5 + 0.5 * numpy.abs(numpy.sin(2 * numpy.pi * 7 * time)))
    return fade(normalized(rustle) * 0.4, 0.05, 0.2)


def bell(duration, rate):
    """A distant church bell: inharmonic partials, struck every 2.4 s, low-passed by distance."""
    output = numpy.zeros(int(duration * SAMPLE_RATE))
    strike_time = seconds_axis(min(duration, 3.0))
    partials = ((1.0, 1.0, 1.1), (2.0, 0.5, 1.6), (2.4, 0.35, 2.0), (3.0, 0.25, 2.6), (4.2, 0.15, 3.4))
    strike = sum(level * numpy.sin(2 * numpy.pi * 196 * ratio * strike_time) * numpy.exp(-strike_time * decay) for ratio, level, decay in partials)
    strike = band(strike, 120, 1400)
    for moment in numpy.arange(0.0, duration - 0.3, 2.4):
        start = int(moment * SAMPLE_RATE)
        output[start:start + len(strike)] += strike[: len(output) - start]
    return fade(normalized(output) * 0.6, 0.01, 0.4)


def insects(duration, rate):
    """Night insects: short 4.4 kHz chirp trains, a little uneven."""
    time = seconds_axis(duration)
    carrier = numpy.sin(2 * numpy.pi * 4400 * time) + 0.5 * numpy.sin(2 * numpy.pi * 5200 * time + 1.0)
    pulses = (numpy.sin(2 * numpy.pi * 28 * time) > 0.2) * (numpy.sin(2 * numpy.pi * 1.7 * time + RANDOM.random()) > -0.1)
    return fade(carrier * pulses * 0.25 + 0.03 * band(noise(duration), 3000, 7000), 0.6, 0.6)


def hiss(duration, rate):
    """Smoke and cooling embers: soft high noise that swells slowly, with a few faint pops."""
    time = seconds_axis(duration)
    swell = 0.6 + 0.4 * numpy.sin(2 * numpy.pi * 0.3 * time)
    pops = numpy.zeros(len(time))
    for _ in range(int(duration * 3)):
        start = RANDOM.integers(0, max(1, len(time) - 1200))
        length = 1200
        pops[start:start + length] += band(RANDOM.standard_normal(length), 1500, 6000) * numpy.exp(-numpy.arange(length) / 150) * 0.5
    return fade(normalized(band(noise(duration), 2500, 9000)) * swell * 0.25 + pops * 0.3, 0.6, 0.6)


def shovel(duration, rate):
    """Snow shovel scrapes, one push per bend of the figure (the pose cycles every 2.62 s)."""
    output = numpy.zeros(int(duration * SAMPLE_RATE))
    for moment in numpy.arange(-0.25, duration, 2 * numpy.pi / 2.4):
        length = 0.55
        scrape_time = seconds_axis(length)
        scrape = band(noise(length), 700, 4500) * numpy.sin(numpy.pi * scrape_time / length) ** 2 * (1 + 0.5 * numpy.sin(2 * numpy.pi * 30 * scrape_time))
        start = int(max(0.0, moment) * SAMPLE_RATE)
        output[start:start + len(scrape)] += normalized(scrape)[: len(output) - start]
    return output * 0.6


def neon(duration, rate):
    """A neon sign's hum: 120 Hz buzz with harmonics and a faint fizz."""
    time = seconds_axis(duration)
    buzz = sum(numpy.sin(2 * numpy.pi * 120 * harmonic * time) / harmonic for harmonic in (1, 2, 3, 4, 5))
    flutter = 0.85 + 0.15 * numpy.sin(2 * numpy.pi * 0.37 * time) * numpy.sin(2 * numpy.pi * 2.3 * time)
    return fade(band(buzz, 100, 2000) * flutter * 0.12 + 0.02 * band(noise(duration), 4000, 9000), 0.3, 0.3)


def crackle(duration, rate):
    """A wood stove: small crackles only, no roar."""
    time = seconds_axis(duration)
    output = numpy.zeros(len(time))
    for _ in range(int(duration * 14)):
        start = RANDOM.integers(0, max(1, len(time) - 1600))
        length = RANDOM.integers(200, 1600)
        pop = band(RANDOM.standard_normal(length), 900, 6000) * numpy.exp(-numpy.arange(length) / (length / 6))
        output[start:start + len(pop)] += normalized(pop) * RANDOM.uniform(0.2, 1.0)
    return fade(output * 0.35 + 0.08 * normalized(band(noise(duration), 60, 300)), 0.3, 0.3)


def creak(duration, rate):
    """A floorboard creak: a slow, low, rough glide."""
    time = seconds_axis(duration)
    pitch = 95 + 40 * numpy.sin(numpy.pi * time / duration)
    phase = 2 * numpy.pi * numpy.cumsum(pitch) / SAMPLE_RATE
    rough = numpy.sign(numpy.sin(phase)) * (0.6 + 0.4 * RANDOM.random(len(time)))
    return fade(normalized(band(rough, 150, 1600)) * numpy.sin(numpy.pi * time / duration) * 0.4, 0.05, 0.15)


def ease_in_out(value):
    value = numpy.clip(value, 0, 1)
    return value * value * (3 - 2 * value)


def map_draw(duration, rate):
    """A soft pen-on-paper sweep while a red line draws: loudness follows the line's speed (easeInOut) and the
    brightness and a faint tone rise with its progress."""
    time = seconds_axis(duration)
    progress = ease_in_out(time / duration)
    speed = numpy.gradient(progress) * SAMPLE_RATE * duration
    grain = 0.55 + 0.45 * numpy.abs(numpy.sin(2 * numpy.pi * 34 * time + 3 * numpy.sin(2 * numpy.pi * 5 * time)))
    dull = normalized(band(noise(duration), 500, 1800))
    bright = normalized(band(noise(duration), 2200, 7000))
    scratch = (dull * (1 - progress) + bright * progress) * grain
    tone = numpy.sin(2 * numpy.pi * numpy.cumsum(320 + 280 * progress) / SAMPLE_RATE) * 0.08
    return fade((scratch * 0.3 + tone) * numpy.clip(speed / 1.5, 0, 1), 0.04, 0.12)


def map_mark(duration, rate):
    """A red X lighting: a muted low thump and a soft, quiet ping."""
    time = seconds_axis(duration)
    thump = numpy.sin(2 * numpy.pi * 62 * time) * numpy.exp(-time * 9) + 0.4 * numpy.sin(2 * numpy.pi * 124 * time) * numpy.exp(-time * 16)
    ping = 0.18 * numpy.sin(2 * numpy.pi * 880 * time) * numpy.exp(-time * 6)
    return normalized(thump + ping) * 0.7


def map_tick(duration, rate):
    """A plate appearing: a tiny dry tick."""
    time = seconds_axis(duration)
    return normalized(numpy.sin(2 * numpy.pi * 2400 * time) * numpy.exp(-time * 220) + 0.3 * band(noise(duration), 3000, 8000) * numpy.exp(-time * 300)) * 0.4


def map_swell(duration, rate):
    """A map pull-out: a low swell that rises and settles."""
    time = seconds_axis(duration)
    shape = numpy.sin(numpy.pi * numpy.clip(time / duration, 0, 1)) ** 1.5
    tone = numpy.sin(2 * numpy.pi * 55 * time) + 0.6 * numpy.sin(2 * numpy.pi * 82.4 * time) + 0.3 * numpy.sin(2 * numpy.pi * 110 * time)
    return normalized(tone * 0.7 + 0.5 * band(noise(duration), 40, 220)) * shape * 0.6


EFFECTS = {
    "bell": bell,
    "insects": insects,
    "hiss": hiss,
    "shovel": shovel,
    "neon": neon,
    "crackle": crackle,
    "creak": creak,
    "map_draw": map_draw,
    "map_mark": map_mark,
    "map_tick": map_tick,
    "map_swell": map_swell,
    "wind": wind,
    "door": door,
    "engine_pass": lambda duration, rate: engine(duration, rate, True),
    "engine_idle": lambda duration, rate: engine(duration, rate, False),
    "siren": siren,
    "car_door": car_door,
    "fire": fire,
    "generator": generator,
    "clunk": clunk,
    "gavel": gavel,
    "clock": clock,
    "hum": hum,
    "paper": paper,
}


def main():
    duration = float(sys.argv[1])
    cues = json.loads(open(sys.argv[2], encoding="utf-8").read())
    output_path = sys.argv[3]
    footfalls = json.loads(open(sys.argv[4], encoding="utf-8").read()) if len(sys.argv) > 4 else []
    step_cues = [cue for cue in cues if cue["kind"].startswith("steps_")]
    cues = [cue for cue in cues if not cue["kind"].startswith("steps_")]
    mix = footfall_steps(duration, step_cues, footfalls)
    for cue in cues:
        effect = EFFECTS[cue["kind"]](cue["duration"], cue.get("rate"))
        start = int(cue["start"] * SAMPLE_RATE)
        # A small, fixed stereo spread per kind keeps the bed wide and the events central.
        spread = 0.25 if cue["kind"] in ("wind", "fire", "hum") else 0.05
        delayed = numpy.roll(effect, int(spread * 0.01 * SAMPLE_RATE))
        end = min(len(mix), start + len(effect))
        mix[start:end, 0] += (effect * cue["gain"])[: end - start]
        mix[start:end, 1] += (delayed * cue["gain"])[: end - start]
    mix = mix[: int(duration * SAMPLE_RATE)]
    mix *= 0.5 / (numpy.max(numpy.abs(mix)) or 1)
    with wave.open(output_path, "wb") as file:
        file.setnchannels(2)
        file.setsampwidth(2)
        file.setframerate(SAMPLE_RATE)
        file.writeframes((numpy.clip(mix, -1, 1) * 32767).astype(numpy.int16).tobytes())
    print(f"sfx {duration:.2f} s, {len(cues)} cues -> {output_path}")


if __name__ == "__main__":
    main()
