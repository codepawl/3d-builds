"""Prints the CC0 candidates found by find_sounds.py: user/id, duration, downloads, title."""
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
here = os.path.dirname(os.path.abspath(__file__))
candidates = json.load(open(os.path.join(here, "..", "candidates.json"), encoding="utf8"))
for role, items in candidates.items():
    print("##", role, len(items))
    for item in items[:16]:
        print(item["user"] + "/" + str(item["id"]), item["duration"], item["downloads"], item["title"][:55])
