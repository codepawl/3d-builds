"""Synthesizes the documentary's score locally (nothing recorded, nothing downloaded).

uv run --no-project --with numpy python tools/music.py <seconds> <sections.json> <output.wav>

sections.json: {"sections": [{"name", "start"}...], "shots": [{"scene", "start"}...]} in film seconds (SCORE_SECTIONS
and SHOTS in src/film/script.js, written by sound.mjs). The score is restrained and stays in the A minor family; each
section has its own mood, built from the shot timeline, and the sections crossfade over about 1.8 s at their first cut:
- opening: a sparse music-box line over a warm pad, no pulse;
- deaths: slow low piano and a low string-like pad, a lot of space;
- crimes: a low ostinato pulse that speeds up, a soft clock-like tick, a dissonant pad (minor second and tritone), building;
- arrest: a quicker heartbeat, one low hit when the arrest shot starts, an unresolved suspended pad;
- law: cold and sparse, high sustained tones, a slow low piano note now and then, no rhythm;
- ending: a held A minor chord, fading with the film.
"""
import json
import sys
import wave

import numpy

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SAMPLE_RATE = 48000
CROSSFADE_BEFORE = 0.4  # the new section starts rising this long before its first cut
CROSSFADE_AFTER = 1.4  # and is fully in this long after it

# Notes (Hz).
A1, E2, A2, B2, C3, D3, E3, F3, G3, A3, C4, D4, E4, G4 = 55.0, 82.41, 110.0, 123.47, 130.81, 146.83, 164.81, 174.61, 196.0, 220.0, 261.63, 293.66, 329.63, 392.0
A4, C5, D5, E5, G5, A5, C6, E6 = 440.0, 523.25, 587.33, 659.26, 783.99, 880.0, 1046.5, 1318.5
D2, F2, B_FLAT2, E_FLAT3 = 73.42, 87.31, 116.54, 155.56


def seconds_axis(duration):
    return numpy.arange(int(duration * SAMPLE_RATE)) / SAMPLE_RATE


def place(target, sound, start_seconds, gain=1.0):
    start = int(start_seconds * SAMPLE_RATE)
    if start < 0 or start >= len(target):
        return
    end = min(len(target), start + len(sound))
    target[start:end] += gain * sound[: end - start]


def fft_lowpass(signal, cutoff):
    spectrum = numpy.fft.rfft(signal)
    frequencies = numpy.fft.rfftfreq(len(signal), 1 / SAMPLE_RATE)
    spectrum *= 1 / (1 + (frequencies / cutoff) ** 4)
    return numpy.fft.irfft(spectrum, len(signal))


def reverb(signal, decay_seconds, seed):
    generator = numpy.random.default_rng(seed)
    time = seconds_axis(decay_seconds)
    impulse = generator.standard_normal(len(time)) * numpy.exp(-time * 6.9 / decay_seconds)
    impulse = fft_lowpass(impulse, 2600)
    impulse /= numpy.sqrt(numpy.sum(impulse ** 2))
    size = 1 << int(numpy.ceil(numpy.log2(len(signal) + len(impulse))))
    return numpy.fft.irfft(numpy.fft.rfft(signal, size) * numpy.fft.rfft(impulse, size), size)[: len(signal)]


# ---------- voices ----------

def heartbeat_hit(amplitude):
    time = seconds_axis(0.5)
    frequency = 42 + 30 * numpy.exp(-time * 28)
    phase = 2 * numpy.pi * numpy.cumsum(frequency) / SAMPLE_RATE
    envelope = (1 - numpy.exp(-time * 400)) * numpy.exp(-time * 9)
    return amplitude * numpy.sin(phase) * envelope


def low_hit(length=3.5):
    """The arrest: a deep body falling from 70 to 38 Hz, with a dull upper knock."""
    time = seconds_axis(length)
    frequency = 38 + 32 * numpy.exp(-time * 9)
    body = numpy.sin(2 * numpy.pi * numpy.cumsum(frequency) / SAMPLE_RATE) * numpy.exp(-time * 1.3)
    knock = numpy.sin(2 * numpy.pi * 110 * time) * numpy.exp(-time * 6) * 0.4
    return (1 - numpy.exp(-time * 500)) * (body + knock)


def tick():
    time = seconds_axis(0.04)
    body = numpy.sin(2 * numpy.pi * 820 * time) * numpy.exp(-time * 160)
    knock = numpy.sin(2 * numpy.pi * 410 * time) * numpy.exp(-time * 90)
    return 0.6 * body + 0.4 * knock


def pluck(frequency, length=0.5):
    """A soft low pluck for the ostinato: a sine with a quiet octave, dying fast."""
    time = seconds_axis(length)
    note = numpy.sin(2 * numpy.pi * frequency * time) + 0.3 * numpy.sin(2 * numpy.pi * 2 * frequency * time) * numpy.exp(-time * 12)
    return note * numpy.exp(-time * 7) * (1 - numpy.exp(-time * 600))


def piano_note(frequency, length=4.0):
    time = seconds_axis(length)
    note = numpy.zeros_like(time)
    # Slightly stretched partials, the upper ones dying faster: a soft, dark felt-piano tone.
    for number, weight in [(1, 1.0), (2, 0.35), (3, 0.12), (4, 0.05)]:
        partial = frequency * number * (1 + 0.0007 * number * number)
        note += weight * numpy.sin(2 * numpy.pi * partial * time) * numpy.exp(-time * (0.9 + 0.8 * number))
    return note * (1 - numpy.exp(-time * 220))


def music_box_note(frequency, length=2.6):
    """A small tine: a bright, fast-fading fundamental with two inharmonic partials."""
    time = seconds_axis(length)
    note = numpy.zeros_like(time)
    for ratio, weight, decay in [(1.0, 1.0, 1.6), (2.0, 0.28, 3.2), (4.17, 0.1, 6.5)]:
        note += weight * numpy.sin(2 * numpy.pi * frequency * ratio * time) * numpy.exp(-time * decay)
    return note * (1 - numpy.exp(-time * 900))


def sustained(frequency, length, attack, release, harmonics=4, seed=0, detune_amount=0.0015):
    """A bowed, string-like tone: a few harmonics, two slightly detuned copies, a raised-cosine swell in and out."""
    time = seconds_axis(length)
    tone = numpy.zeros_like(time)
    for detune in (1 - detune_amount, 1 + detune_amount):
        for number in range(1, harmonics + 1):
            tone += numpy.sin(2 * numpy.pi * frequency * detune * number * time + seed + number) / number ** 1.3
    rise = numpy.clip(time / attack, 0, 1)
    fall = numpy.clip((length - time) / release, 0, 1)
    return tone * (1 - numpy.cos(numpy.pi * rise)) / 2 * (1 - numpy.cos(numpy.pi * fall)) / 2


def chord_pad(stem, chords, chord_length, attack, harmonics, start=0.0, end=None, overlap=1.0, gain=1.0):
    """Places chords one after another; each swells in under the previous one's release."""
    end = len(stem) / SAMPLE_RATE if end is None else end
    for index in range(int((end - start) / chord_length) + 1):
        moment = start + index * chord_length
        if moment >= end:
            break
        length = min(chord_length * overlap + attack, end - moment + attack)
        for voice, frequency in enumerate(chords[index % len(chords)]):
            place(stem, sustained(frequency, length, attack, attack, harmonics, seed=voice), moment, gain * (1.0 if voice == 0 else 0.6))


# ---------- sections: each returns (dry stem, reverb send), local time 0 = the section's first cut ----------

def empty(length):
    return numpy.zeros(int(length * SAMPLE_RATE))


def opening(length, context):
    box, pad = empty(length), empty(length)
    chords = [[A2, E3, A3, C4], [F2, C3, F3, A3], [A2, E3, A3, C4], [C3, G3, C4, E4]]
    chord_pad(pad, chords, 5.2, 3.0, 3, overlap=1.0, gain=0.8)
    line = [A4, C5, E5, D5, C5, A4, E5, G5, E5, C5, D5, A4]
    moment = 0.6
    for index in range(len(line) * 6):
        if moment >= length - 0.5:
            break
        # A sparse line: two notes, a rest, one note, a longer rest.
        place(box, music_box_note(line[index % len(line)]), moment, 0.5)
        moment += [1.1, 1.6, 2.4, 1.3, 2.9][index % 5]
    return fft_lowpass(pad, 900) + box, box


def deaths(length, context):
    piano, pad = empty(length), empty(length)
    chords = [[A1, E2, A2, C3], [D2, A2, D3, F3], [A1, E2, A2, C3], [F2, C3, F3, A2]]
    chord_pad(pad, chords, 8.0, 3.8, 5, overlap=1.0, gain=0.9)
    notes = [A3, E3, C4, D3, A3, G3, E3, A2]
    moment = 1.2
    for index in range(80):
        if moment >= length - 1.0:
            break
        place(piano, piano_note(notes[index % len(notes)], 5.0), moment, 1.1)
        moment += [4.2, 3.4, 5.0, 3.8][index % 4]
    return fft_lowpass(pad, 480) * 1.3 + piano * 0.6, piano * 1.4


def crimes(length, context):
    dry, pad, ticks = empty(length), empty(length), empty(length)
    # Dissonant pad: A, B flat (minor second) and E flat (tritone) over a low A, swelling through the section.
    chord_pad(pad, [[A1, A2, B_FLAT2, E_FLAT3, E3]], 12.0, 4.0, 4, overlap=1.0, gain=0.8)
    moment = 0.0
    index = 0
    while moment < length - 0.4:
        progress = moment / length
        place(dry, pluck(A1 if index % 4 != 3 else E2), moment, 0.5 + 0.9 * progress)
        place(ticks, tick(), moment + 0.31, 0.45 + 0.5 * progress if index % 2 else 0.3 + 0.3 * progress)
        moment += 0.88 - 0.3 * progress  # the pulse quickens: about 68 bpm to 100 bpm
        index += 1
    shaped = fft_lowpass(pad, 600) * (0.5 + 1.0 * numpy.linspace(0, 1, len(pad)))
    return shaped + dry * 0.9 + ticks * 0.12, dry * 0.2 + pad * 0.1


def arrest(length, context):
    dry, pad = empty(length), empty(length)
    chord_pad(pad, [[A2, D3, E3, A3], [A2, D3, E3, B_FLAT2 * 2]], 7.0, 3.0, 4, overlap=1.0, gain=0.7)
    hit_at = context["arrest_start"]
    moment = 0.1
    while moment < length - 0.6:
        place(dry, heartbeat_hit(1.0), moment, 1.0)
        place(dry, heartbeat_hit(0.62), moment + 0.2, 1.0)
        moment += 0.58  # about 103 bpm
    place(dry, low_hit(), hit_at, 1.6)
    return fft_lowpass(pad, 650) * 0.9 + dry, dry * 0.3


def law(length, context):
    piano, pad = empty(length), empty(length)
    # High sustained tones that overlap and drift, never a chord change and never a beat.
    voices = [(E5, 0.0, 9.0), (A5, 4.5, 9.0), (C6, 11.0, 8.0), (E5, 15.5, 9.0), (E6, 21.0, 7.0), (A5, 26.0, 9.0), (C6, 33.0, 8.0), (E5, 38.0, 10.0), (A5, 46.0, 8.0), (E5, 52.0, 10.0), (C6, 60.0, 9.0), (A5, 68.0, 9.0), (E5, 74.0, 10.0)]
    for number, (frequency, moment, hold) in enumerate(voices):
        if moment < length:
            place(pad, sustained(frequency, hold, 3.5, 3.5, 2, seed=number, detune_amount=0.0003), moment, 0.5)  # barely detuned: no warble up here
    place(pad, sustained(A2, length, 5.0, 3.0, 2), 0.0, 0.5)
    moment = 3.0
    notes = [A2, E3, A2, D3]
    for index in range(40):
        if moment >= length - 1.0:
            break
        place(piano, piano_note(notes[index % len(notes)], 6.0), moment, 1.2)
        moment += [11.0, 8.5, 13.0][index % 3]
    return fft_lowpass(pad, 3000) * 0.55 + piano * 0.55, piano * 1.1 + pad * 0.1


def ending(length, context):
    dry, piano = empty(length), empty(length)
    chord = [A2, E3, A3, C4, E4]
    for voice, frequency in enumerate(chord):
        place(dry, sustained(frequency, length + 4.0, 1.2, 3.0, 4, seed=voice), 0.0, 1.0 if voice == 0 else 0.55)
    place(piano, piano_note(A2, 6.0), 0.3, 1.2)
    return fft_lowpass(dry, 700) * 0.9 + piano * 0.7, piano


# builder, reverb level, reverb decay (s), loudness (the builders' stems differ in level; these even them out, with the
# law section the quietest and the crimes and the ending a little above the rest)
BUILDERS = {
    "opening": (opening, 0.22, 4.0, 0.83),
    "deaths": (deaths, 0.2, 4.5, 0.54),
    "crimes": (crimes, 0.2, 3.0, 0.75),
    "arrest": (arrest, 0.22, 3.2, 1.08),
    "law": (law, 0.22, 4.6, 1.66),
    "ending": (ending, 0.26, 4.0, 0.83),
}


def main():
    duration = float(sys.argv[1])
    sections = json.loads(open(sys.argv[2], encoding="utf-8").read())
    output_path = sys.argv[3]
    cuts = sections["sections"]
    total = int(duration * SAMPLE_RATE)
    left = numpy.zeros(total)
    right = numpy.zeros(total)
    time = seconds_axis(duration)
    arrest_start = next(shot["start"] for shot in sections["shots"] if shot["scene"] == "arrest")
    for index, cut in enumerate(cuts):
        build, wet_gain, decay, level = BUILDERS[cut["name"]]
        start = cut["start"]
        next_start = cuts[index + 1]["start"] if index + 1 < len(cuts) else duration
        length = next_start - start + CROSSFADE_AFTER + 0.5
        dry, send = build(length, {"arrest_start": arrest_start - start})
        wet = reverb(send, decay, seed=index + 1)
        stem_left = level * (dry + wet_gain * wet)
        stem_right = level * (dry + wet_gain * numpy.roll(wet, 480))
        rise_start = start - CROSSFADE_BEFORE if index > 0 else 0.0
        rise_end = start + CROSSFADE_AFTER if index > 0 else 3.0
        envelope = numpy.clip((time - rise_start) / (rise_end - rise_start), 0, 1)
        if index + 1 < len(cuts):
            fall_start = next_start - CROSSFADE_BEFORE
            fall_end = next_start + CROSSFADE_AFTER
            envelope *= numpy.cos(numpy.clip((time - fall_start) / (fall_end - fall_start), 0, 1) * numpy.pi / 2)
        envelope = numpy.sin(envelope * numpy.pi / 2) if index == 0 else envelope
        first = int(start * SAMPLE_RATE)
        window = min(total - first, len(stem_left))
        full_left = numpy.zeros(total)
        full_right = numpy.zeros(total)
        full_left[first:first + window] = stem_left[:window]
        full_right[first:first + window] = stem_right[:window]
        rms = numpy.sqrt(numpy.mean(stem_left[:int((next_start - start) * SAMPLE_RATE)] ** 2))
        print(f"  {cut['name']:8s} {start:7.1f}-{next_start:7.1f} s  rms {20 * numpy.log10(rms + 1e-9):6.1f} dB")
        left += full_left * envelope
        right += full_right * envelope

    fade_out = numpy.clip((duration - time) / 2.6, 0, 1)
    stereo = numpy.stack([left * fade_out, right * fade_out], axis=1)
    stereo *= 0.5 / numpy.max(numpy.abs(stereo))

    with wave.open(output_path, "wb") as file:
        file.setnchannels(2)
        file.setsampwidth(2)
        file.setframerate(SAMPLE_RATE)
        file.writeframes((stereo * 32767).astype("<i2").tobytes())
    print(f"music {duration:.2f} s -> {output_path}, peak -6 dBFS before the mix")


if __name__ == "__main__":
    main()
