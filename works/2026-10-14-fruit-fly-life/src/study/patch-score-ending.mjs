// Score and sound timeline for the 40.5 s film: the adult beat now runs 16.5 s (fly's view, kitchen tour, hatching,
// deaths and the loop).
import { readFileSync, writeFileSync } from "node:fs";

const root = process.argv[2];
function patch(file, pairs) {
  let text = readFileSync(`${root}/${file}`, "utf8");
  for (const [from, to] of pairs) {
    if (!text.includes(from)) {
      throw new Error(`not found in ${file}: ${from.slice(0, 60)}`);
    }
    text = text.replace(from, to);
  }
  writeFileSync(`${root}/${file}`, text);
}

let score = readFileSync(`${root}/fly_score.py`, "utf8");
const start = score.indexOf("    # Adult life:");
const end = score.indexOf("    return sorted(cue for cue in cues if cue[0] < DURATION)");
score = score.slice(0, start) + `    # Adult life: takeoff, the fly's view with two saccades, the kitchen tour, the approach, landing, two taps, two
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
    add((film_time("adult", 16.1), "wings"))
` + score.slice(end);
writeFileSync(`${root}/fly_score.py`, score);
patch("fly_score.py", [
  ["DURATION = 34.0", "DURATION = 40.5"],
  ["(34 s, 120 BPM, 17 bars)", "(40.5 s, 120 BPM, 21 bars)"],
  ['"G", "E", "Am", "F", "C", "G", "E", "Am"]', '"G", "E", "Am", "F", "C", "G", "E", "Am", "F", "G", "Am", "Am"]'],
]);
patch("sound/make_timeline.py", [
  ['dict(start=24, end=34, name="adult"', 'dict(start=24, end=40.5, name="adult"'],
  ["fade=[33.4, 34.0]", "fade=[39.9, 40.5]"],
]);
