"""Search Freesound for CC0 recordings and list candidates with their HQ preview URLs.

Usage: python find_sounds.py > candidates.json
Only results whose card says "License: Creative Commons 0" are kept.
"""
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

QUERIES = {
    "hoof_dirt": ["horse hooves", "horse trot", "horse walk", "horse gallop", "hoofbeats", "horse footsteps"],
    "hoof_wood": ["horse bridge wood", "horse clip clop", "clip clop cobblestone"],
    "chain": ["drawbridge chain", "heavy chain rattle", "chain winch pull", "chain dragging metal"],
    "bell": ["distant church bell", "single bell toll", "old bell ring far"],
    "smith": ["blacksmith hammer anvil", "hammer on anvil single", "anvil strike"],
    "kitchen": ["kitchen pots clatter", "chopping vegetables board", "pot lid clank"],
    "thud": ["heavy wooden thud", "wooden gate slam", "wood drop heavy"],
    "portcullis": ["metal gate grind", "heavy iron gate rising"],
}

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
CC0_FILTER = 'license:"Creative Commons 0"'


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def attribute(chunk, name):
    match = re.search(rf'data-{name}="([^"]*)"', chunk)
    return html.unescape(match.group(1)) if match else None


def search(query):
    url = "https://freesound.org/search/?" + urllib.parse.urlencode({"q": query, "f": CC0_FILTER, "s": "Downloads (most first)"})
    page = fetch(url)
    chunks = page.split('class="bw-player"')[1:]
    results = []
    for chunk in chunks:
        license_match = re.search(r'title="License: ([^"]+)"', chunk)
        license_name = license_match.group(1) if license_match else None
        if license_name != "Creative Commons 0":
            continue
        preview = attribute(chunk, "ogg") or ""
        results.append({
            "id": int(attribute(chunk, "sound-id")),
            "user": attribute(chunk, "username"),
            "title": attribute(chunk, "title"),
            "duration": round(float(attribute(chunk, "duration") or 0), 2),
            "samplerate": attribute(chunk, "samplerate"),
            "downloads": int(attribute(chunk, "num-downloads") or 0),
            "license": license_name,
            "preview": preview.replace("-lq.ogg", "-hq.ogg"),
            "page": f"https://freesound.org/people/{attribute(chunk, 'username')}/sounds/{attribute(chunk, 'sound-id')}/",
        })
    return results


def main():
    candidates = {}
    for role, queries in QUERIES.items():
        seen = set()
        candidates[role] = []
        for query in queries:
            for result in search(query)[:8]:
                if result["id"] in seen:
                    continue
                seen.add(result["id"])
                result["query"] = query
                candidates[role].append(result)
            time.sleep(1.0)
    print(json.dumps(candidates, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
