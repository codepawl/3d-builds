"""Searches Freesound for CC0 recordings for the hazards (hawk, fox, bear trap, salt sizzle). Writes candidates_hazards.json."""
import json
import sys
import time

import find_sounds

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
QUERIES = {
    "hawk": ["hawk screech", "bird of prey cry", "eagle screech", "falcon call"],
    "wings": ["wing flap", "bird wings flapping", "swoosh dive whoosh"],
    "fox": ["fox bark", "fox yelp", "fox scream", "dog snarl"],
    "trap": ["bear trap", "metal trap snap", "steel clamp snap", "mouse trap snap"],
    "sizzle": ["sizzle", "frying sizzle short", "acid fizz", "salt crunch"],
}
out = {}
for role, queries in QUERIES.items():
    seen = set()
    out[role] = []
    for query in queries:
        for result in find_sounds.search(query)[:6]:
            if result["id"] in seen:
                continue
            seen.add(result["id"])
            result["query"] = query
            out[role].append(result)
        time.sleep(1.0)
with open("candidates_hazards.json", "w", encoding="utf-8") as handle:
    json.dump(out, handle, indent=1, ensure_ascii=False)
for role, items in out.items():
    print(role)
    for item in items:
        print("  %d %s %s %.1fs dl=%d q=%s" % (item["id"], item["user"], item["title"], item["duration"], item["downloads"], item["query"]))
