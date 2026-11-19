"""Builds the cue list from the film's input log and the sim's event log. Only what is on screen at that second gets a sound.

Usage: uv run --no-project python make_cues.py <recording folder> <output json>
"""
import json
import sys
from pathlib import Path

# Film seconds set by the shot plan: the hero forklift is on screen from its click until the overview click, and the lift is under way.
# The forks reach the top at second 10.3 of the film, and the tail runs past that.
HERO_LIFT_SECONDS = 8.2
BELT_RUN_SECONDS = 2.2
TRAILER_DELAY_SECONDS = 0.9
FLIGHT_TARGETS = {"overview", "pick line", "dock"}


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def input_cues(events, frames_per_second):
    cues = []
    for event in events:
        time = event["frame"] / frames_per_second
        target = event["target"]
        cues.append({"time": time, "kind": "click"})
        if event["kind"] != "click":
            continue
        cues.append({"time": time + 0.02, "kind": "camera_move"})
        if target != "overview":
            cues.append({"time": time + 0.05, "kind": "card_open"})
    return cues


def click_time(events, frames_per_second, target_prefix):
    for event in events:
        if event["target"].startswith(target_prefix):
            return event["frame"] / frames_per_second
    raise ValueError(f"no click on {target_prefix}")


def next_overview_time(events, frames_per_second, after):
    for event in events:
        time = event["frame"] / frames_per_second
        if event["target"] == "overview" and time > after:
            return time
    raise ValueError("no overview click")


def world_cues(input_log, sim_log):
    events = input_log["events"]
    frames_per_second = input_log["fps"]
    start = sim_log["startSimTime"]
    hero_click = click_time(events, frames_per_second, "forklift")
    hero_end = next_overview_time(events, frames_per_second, hero_click)
    line_click = click_time(events, frames_per_second, "pick line")
    line_end = next_overview_time(events, frames_per_second, line_click)
    dock_click = click_time(events, frames_per_second, "dock")
    cues = [
        {"time": hero_click + 1.0, "kind": "forklift_lift_long", "seconds": HERO_LIFT_SECONDS, "take": 2, "pitch": 0.72},
        {"time": line_click + 0.4, "kind": "conveyor", "seconds": min(BELT_RUN_SECONDS, line_end - line_click)},
        {"time": dock_click + TRAILER_DELAY_SECONDS, "kind": "trailer_load"},
    ]
    for event in sim_log["events"]:
        time = event["time"] - start
        if event["kind"] == "drop" and hero_click < time < hero_end:
            cues.append({"time": time, "kind": "pallet_set"})
        if event["kind"] == "placed" and line_click + 0.8 < time < line_end:
            cues.append({"time": time, "kind": "gantry_grab"})
    return cues


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    recording_folder = Path(sys.argv[1])
    input_log = load_json(recording_folder / "input_events.json")
    sim_log = load_json(recording_folder / "sim_events.json")
    cues = input_cues(input_log["events"], input_log["fps"]) + world_cues(input_log, sim_log)
    cues.sort(key=lambda cue: cue["time"])
    Path(sys.argv[2]).write_text(json.dumps(cues, indent=1), encoding="utf-8")
    for cue in cues:
        print(round(cue["time"], 2), cue["kind"])


if __name__ == "__main__":
    main()
