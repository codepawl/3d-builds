"""Score for "the life of a fruit fly" (44.5 s, 120 BPM, 23 bars), synced to the film.

The film runs on Ink.beatTime: within each beat story time surges at the downbeat. Every event is written in its own
beat's story time and converted to film time here with the inverse of that curve, so sounds land on the frames.
Instruments come from experiments/music-trial/generate_theme.py.

Run: uv run --no-project --with numpy --with scipy --with soundfile --with pyloudnorm python fly_score.py
Writes out/fly-score.wav (48 kHz, 24-bit), mastered to -14 LUFS.
"""
import sys
from pathlib import Path

import numpy as np
import soundfile

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "experiments" / "music-trial"))
import generate_theme as synth  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BEAT = 0.5
DURATION = 44.5
# Film offsets of each beat: opening, embryo, larva, metamorphosis.
OFFSETS = {"opening": 0.0, "embryo": 2.0, "larva": 8.0, "meta": 14.0, "adult": 24.0, "rebirth": 40.5}

# A minor-ish wonder: Am, F, C, G, with a lift to E for the emergence. One chord per bar.
BARS = ["Am", "Am", "F", "C", "Am", "F", "C", "G", "F", "G", "E", "Am", "F", "C", "G", "E", "Am", "F", "G", "Am", "Am", "F", "E"]
CHORDS = {
    "Am": dict(tones=["A4", "C5", "E5", "B5"], pad=["A2", "E3", "C4", "G4"], bass="A1"),
    "F": dict(tones=["F4", "A4", "C5", "E5"], pad=["F2", "C3", "A3", "E4"], bass="F1"),
    "C": dict(tones=["C5", "E5", "G5", "B5"], pad=["C3", "G3", "E4", "B4"], bass="C2"),
    "G": dict(tones=["G4", "B4", "D5", "F#5"], pad=["G2", "D3", "B3", "F#4"], bass="G1"),
    "E": dict(tones=["E5", "G#5", "B5", "D6"], pad=["E2", "B2", "G#3", "D4"], bass="E2"),
}
RISING = ["A4", "C5", "E5", "G5", "A5", "C6", "E6", "G6", "A6"]


def beat_time(time):
    beat = np.floor(time / BEAT)
    phase = time / BEAT - beat
    return (beat + 0.65 * (1 - (1 - phase) ** 3) + 0.35 * phase) * BEAT


def film_time(section, story_seconds):
    """Film time at which a beat's story time is reached (the inverse of Ink.beatTime, by bisection)."""
    low, high = 0.0, 30.0
    for _ in range(50):
        middle = (low + high) / 2
        if beat_time(middle) < story_seconds:
            low = middle
        else:
            high = middle
    return OFFSETS[section] + high


def montage_story_to_shot(story_seconds):
    """Beat 4's last shot shows story 5.2 + local * 2.8 over shot time 6.0 to 10.0: story time back to beat time."""
    local = (story_seconds - 5.2) / 2.8
    return 6.0 + local * 4.0


def events():
    """(film seconds, kind) for every sound the picture asks for."""
    cues = []
    add = cues.append
    # Opening: the egg is laid on the beat at 1.0, the camera punches in at 1.5.
    add((film_time("opening", 1.0), "lay"))
    add((film_time("opening", 1.5), "whoosh"))
    # Embryo: the shell draws, seven synchronous divisions, migration, the punch in, surface waves, the stripes.
    add((film_time("embryo", 0.0), "chime"))
    for cycle in range(7):
        add((film_time("embryo", 0.5 + cycle * 0.25 + 0.075), f"divide{cycle}"))
    add((film_time("embryo", 2.5), "whoosh"))
    for wave in range(4):
        add((film_time("embryo", 2.8 + wave * 0.32 + 0.1), "shimmer"))
    for stripe in range(7):
        add((film_time("embryo", 4.7 + stripe * 0.6 / 7), "stripe"))
    # Larva: grooves, the cut to paper, the cap pops, four crawling pushes.
    add((film_time("larva", 2.0), "cut"))
    add((film_time("larva", 3.0), "pop"))
    for push in range(4):
        add((film_time("larva", 3.5 + push * 0.5), "squish"))
    # Metamorphosis montage cuts.
    for shot_start in [1.0, 1.5, 2.5, 3.5, 6.0]:
        add((film_time("meta", shot_start), "cut"))
    # Eating bites: one per beat while feeding.
    for bite in range(2):
        add((film_time("meta", 0.0 + bite * 0.5), "bite"))
    # Stage flashes inside the case, one per beat.
    for stage in range(1, 5):
        add((film_time("meta", 3.5 + stage * 0.5), "flash"))
    # Emergence: three nudges that grow, then the pop; five pushes; wings open; the loop.
    for nudge, strength in [(5.3, 0.3), (5.48, 0.6), (5.65, 0.9)]:
        add((film_time("meta", montage_story_to_shot(nudge)), f"knock{strength}"))
    add((film_time("meta", montage_story_to_shot(5.82)), "pop"))
    for push in range(5):
        add((film_time("meta", montage_story_to_shot(5.9 + push * 0.2)), "squish"))
    add((film_time("meta", montage_story_to_shot(6.95)), "wings"))
    # Adult life: takeoff, the fly's view with two saccades, the kitchen tour, the approach, landing, two taps, two
    # trains of pulse song, three hearts, the mount, his flight away, three eggs, three hatchings, the wine glass, her
    # fall, and the loop chime as the opening frame returns.
    add((film_time("adult", 0.5), "whoosh"))
    add((film_time("adult", 1.0), "cut"))
    for saccade in [1.75, 2.25]:
        add((film_time("adult", saccade), "knock0.3"))
    add((film_time("adult", 2.5), "cut"))
    for saccade in [3.0, 3.5, 4.0, 4.5]:
        add((film_time("adult", saccade), "knock0.3"))
    for run in range(1, 6):
        add((film_time("adult", 5.0 + run * 0.25), "knock0.3"))
    add((film_time("adult", 6.5), "squish"))
    for tap in [7.5, 7.725]:
        add((film_time("adult", tap), "bite"))
    for train in [8.45, 8.95]:
        for pulse in range(5):
            add((film_time("adult", train + pulse * 0.06), "pulse"))
    for order, heart in enumerate([9.6, 9.75, 9.9]):
        add((film_time("adult", heart), f"heart{order}"))
    add((film_time("adult", 10.5), "chime"))
    add((film_time("adult", 11.5), "whoosh"))
    for lay in [12.25, 12.75, 13.25]:
        add((film_time("adult", lay), "lay"))
    for hatch in [13.5, 13.75, 14.0]:
        add((film_time("adult", hatch), "stripe"))
    add((film_time("adult", 14.95), "cut"))
    add((film_time("adult", 15.45), "cut"))
    add((film_time("adult", 15.5), "squish"))
    cues.extend(rebirth_events(cues))
    return sorted(cue for cue in cues if cue[0] < DURATION)


# Beat 6 replays stretches of beats 3 and 4 linearly in film time: (section, from, to, length), in order.
REBIRTH_PIECES = [("larva", 2.0, 6.0, 1.2), ("meta", 0.0, 3.5, 1.0), ("meta", 6.0, 10.0, 1.8)]
# At this speed only the landmarks get a sound (the hatch, the pupa cap, the wings); the music carries the rest.
REBIRTH_KINDS = {"pop", "wings"}


def rebirth_events(cues):
    """The replayed stretches' sounds, squeezed to beat 6's timing (the recording bank has no cut sounds left, so its cuts stay silent)."""
    replayed = []
    start = OFFSETS["rebirth"]
    for section, begin, end, length in REBIRTH_PIECES:
        for seconds, kind in cues:
            local = seconds - OFFSETS[section]
            if begin <= local < end and kind in REBIRTH_KINDS:
                replayed.append((start + (local - begin) * length / (end - begin), kind))
        start += length
    return replayed


def chord_at(seconds):
    return CHORDS[BARS[min(len(BARS) - 1, int(seconds // 2.0))]]


def bed(music, drums, reverb_send):
    # Pad and bass, one chord per bar; the opening is pad only.
    for bar, name in enumerate(BARS):
        start = bar * 2.0
        for note in CHORDS[name]["pad"]:
            left, right = synth.make_pad_voices(note, 2.0, 0.3, 0.5)
            synth.place_stereo(music, left, right, start, gain=0.04)
        if bar >= 1:
            synth.place(music, synth.make_bass_note(CHORDS[name]["bass"], 1.9), start, gain=0.25)
    # Pluck arpeggio on eighths from the embryo on; it drives the beat-pulsed motion.
    step = 0
    while step * BEAT / 2 < DURATION - 0.25:
        start = step * BEAT / 2
        if start >= 2.0:
            note = chord_at(start)["tones"][[0, 2, 1, 3, 2, 1, 3, 2][step % 8]]
            gain = 0.13 if step % 2 == 0 else 0.09
            pluck = synth.make_pluck(note, 0.4, 0.8, 5.0)
            synth.place(music, pluck, start, pan=0.3 if step % 2 else -0.3, gain=gain)
            synth.place(reverb_send, pluck, start, gain=gain * 0.4)
        step += 1
    # Drums: a soft kick on every beat from the larva on, a bar-downbeat accent, hats on offbeats in the montage.
    beat = 0
    while beat * BEAT < DURATION - 0.1:
        start = beat * BEAT
        if start >= 8.0:
            synth.place(drums, synth.make_kick(0.6 if beat % 2 else 0.9), start, gain=0.55)
        if start >= 14.0:
            synth.place(drums, synth.make_hat(0.03, 0.5), start + BEAT / 2, pan=0.2, gain=0.25)
        beat += 1


def cue_sound(kind):
    if kind == "lay":
        return synth.make_pluck("E5", 0.6, 1.0, 6.0), 0.35, 0.5
    if kind == "chime":
        mixed = np.zeros(int(2.0 * synth.SAMPLE_RATE))
        for order, note in enumerate(["A5", "E6", "A6"]):
            tone = synth.make_epiano_note(note, 1.2, 0.8)
            start = int(order * 0.05 * synth.SAMPLE_RATE)
            length = min(len(tone), len(mixed) - start)
            mixed[start:start + length] += tone[:length]
        return mixed, 0.25, 0.6
    if kind.startswith("divide"):
        index = int(kind[-1])
        return synth.make_pluck(RISING[index], 0.6, 1.2, 4.0), 0.3, 0.6
    if kind == "shimmer":
        return synth.make_pluck("A6", 0.5, 1.5, 6.0), 0.15, 0.7
    if kind == "stripe":
        return synth.make_pluck("E6", 0.3, 1.2, 8.0), 0.12, 0.5
    if kind == "whoosh":
        riser = synth.make_riser(0.45, start_hz=400, end_hz=7000)
        return (riser[0], riser[1]), 0.5, 0.3
    if kind == "cut":
        return synth.make_boom(0.9), 0.35, 0.1
    if kind == "pop":
        left, right = synth.make_noise_hit(0.2, 0.03, 1200)
        return (left + synth.make_kick(1.0)[: len(left)] * 0.6, right + synth.make_kick(1.0)[: len(right)] * 0.6), 0.6, 0.25
    if kind.startswith("knock"):
        strength = float(kind[5:])
        left, right = synth.make_noise_hit(0.08, 0.015, 1800)
        return (left, right), 0.25 + 0.3 * strength, 0.1
    if kind == "squish":
        return synth.make_bass_note("A2", 0.12), 0.25, 0.05
    if kind == "bite":
        left, right = synth.make_noise_hit(0.06, 0.01, 3000)
        return (left, right), 0.3, 0.05
    if kind == "flash":
        return synth.make_pluck("C6", 0.5, 1.4, 5.0), 0.22, 0.6
    if kind == "wings":
        mixed = np.zeros(int(2.0 * synth.SAMPLE_RATE))
        for order, note in enumerate(["E5", "G#5", "B5", "E6"]):
            tone = synth.make_epiano_note(note, 1.4, 0.9)
            start = int(order * 0.04 * synth.SAMPLE_RATE)
            length = min(len(tone), len(mixed) - start)
            mixed[start:start + length] += tone[:length]
        return mixed, 0.3, 0.7
    if kind == "pulse":
        return synth.make_pluck("A5", 0.08, 0.6, 12.0), 0.18, 0.3
    if kind.startswith("heart"):
        return synth.make_pluck(["C6", "E6", "A6"][int(kind[-1])], 0.5, 1.2, 5.0), 0.22, 0.6
    if kind == "tick":
        left, right = synth.make_noise_hit(0.03, 0.005, 4000)
        return (left, right), 0.15, 0.05
    return None, 0, 0


def main():
    synth.lower_priority()
    # The shared instruments size their buses for a 30 s theme; this film is longer.
    synth.RENDER_SAMPLES = int((DURATION + 3) * synth.SAMPLE_RATE)
    music = synth.empty_bus()
    drums = synth.empty_bus()
    reverb_send = synth.empty_bus()
    bed(music, drums, reverb_send)
    cues = events()
    for seconds, kind in cues:
        sound, gain, send = cue_sound(kind)
        if sound is None:
            continue
        if isinstance(sound, tuple):
            synth.place_stereo(music, sound[0], sound[1], seconds, gain=gain)
            synth.place_stereo(reverb_send, sound[0], sound[1], seconds, gain=gain * send)
        else:
            synth.place(music, sound, seconds, gain=gain)
            synth.place(reverb_send, sound, seconds, gain=gain * send)
    mix = music + drums + synth.apply_reverb(reverb_send) * 0.45
    mix = mix[:, : int(DURATION * synth.SAMPLE_RATE)]
    fade = int(0.3 * synth.SAMPLE_RATE)
    mix[:, -fade:] *= np.linspace(1, 0.4, fade)[None, :]
    mastered, report = synth.master(mix)
    soundfile.write(HERE / "out" / "fly-score.wav", mastered.T, synth.SAMPLE_RATE, subtype="PCM_24")
    print(f"fly-score.wav: {report['lufs']:.2f} LUFS, true peak {synth.true_peak_db(mastered):.2f} dBTP, {len(cues)} cues")
    for seconds, kind in cues:
        print(f"  {seconds:6.3f}  {kind}")


if __name__ == "__main__":
    main()
