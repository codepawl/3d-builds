// Score for beat 5: 34 s, five more bars, cues for the takeoff, saccades, taps, pulse song, hearts, the clock, the
// eggs and the loop.
import { readFileSync, writeFileSync } from "node:fs";

const path = `${process.argv[2]}/fly_score.py`;
let text = readFileSync(path, "utf8");
function replace(from, to) {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 60)}`);
  }
  text = text.replace(from, to);
}
replace('"""Score for "the life of a fruit fly" (24 s, 120 BPM, 12 bars), synced to the film.', '"""Score for "the life of a fruit fly" (34 s, 120 BPM, 17 bars), synced to the film.');
replace("DURATION = 24.0", "DURATION = 34.0");
replace('OFFSETS = {"opening": 0.0, "embryo": 2.0, "larva": 8.0, "meta": 14.0}', 'OFFSETS = {"opening": 0.0, "embryo": 2.0, "larva": 8.0, "meta": 14.0, "adult": 24.0}');
replace('BARS = ["Am", "Am", "F", "C", "Am", "F", "C", "G", "F", "G", "E", "Am"]', 'BARS = ["Am", "Am", "F", "C", "Am", "F", "C", "G", "F", "G", "E", "Am", "F", "C", "G", "E", "Am"]');
replace("    return sorted(cue for cue in cues if cue[0] < DURATION)", `    # Adult life: takeoff, six saccades, landing, two taps, two trains of pulse song, three hearts, the mount, the
    # clock, the flight away, three eggs, and the loop chime as the opening frame returns.
    add((film_time("adult", 0.5), "whoosh"))
    add((film_time("adult", 1.0), "cut"))
    for run in range(1, 6):
        add((film_time("adult", 1.0 + run * 0.25), "knock0.3"))
    add((film_time("adult", 2.5), "squish"))
    for tap in [3.5, 3.725]:
        add((film_time("adult", tap), "bite"))
    for train in [4.45, 4.95]:
        for pulse in range(5):
            add((film_time("adult", train + pulse * 0.06), "pulse"))
    for order, heart in enumerate([5.6, 5.75, 5.9]):
        add((film_time("adult", heart), f"heart{order}"))
    add((film_time("adult", 6.5), "chime"))
    for tick in range(6):
        add((film_time("adult", 6.95 + tick * 0.1), "tick"))
    add((film_time("adult", 7.6), "whoosh"))
    for lay in [8.25, 8.75, 9.25]:
        add((film_time("adult", lay), "lay"))
    add((film_time("adult", 9.6), "wings"))
    return sorted(cue for cue in cues if cue[0] < DURATION)`);
replace("    return None, 0, 0", `    if kind == "pulse":
        return synth.make_pluck("A5", 0.08, 0.6, 12.0), 0.18, 0.3
    if kind.startswith("heart"):
        return synth.make_pluck(["C6", "E6", "A6"][int(kind[-1])], 0.5, 1.2, 5.0), 0.22, 0.6
    if kind == "tick":
        left, right = synth.make_noise_hit(0.03, 0.005, 4000)
        return (left, right), 0.15, 0.05
    return None, 0, 0`);
writeFileSync(path, text);
