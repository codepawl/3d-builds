"""Downloads the Freesound HQ previews this film uses into sound/sources and writes sources/manifest.json.

Each sound page is fetched first and must carry the CC0 1.0 licence link (publicdomain/zero/1.0); otherwise the script
stops. Only real recordings: no synthesis.
Run: uv run --no-project --python 3.12 python sound/tools/download_sources.py
"""
import hashlib
import html
import json
import os
import re
import sys
import time
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
SOURCES = os.path.join(HERE, "..", "sources")
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

# (role, freesound user, sound id)
RECORDINGS = [
    ("eat_meat", "ProductionNow", 234237),
    ("eat_squishes", "Eneasz", 216882),
    ("eat_carcass", "ProductionNow", 234236),
    ("eat_splat_a", "gprosser", 360942),
    ("eat_splat_b", "gprosser", 361030),
    ("eat_gore_splat", "ThefitzyG", 414296),
    ("eat_mud_squelch", "ahill86", 207142),
    ("eat_mud_splat", "Breviceps", 445109),
    ("eat_chicken_slime", "qubodup", 211605),
    ("eat_slimy", "Breviceps", 445968),
    ("bed_slime_squish", "rubberduck9999", 680447),
    ("bed_guts_goo", "Perel", 222363),
    ("bed_wet_slimy", "Federicoy", 834075),
    ("bed_superworms", "fthgurdy", 528196),
    ("bed_slime_move", "wubitog", 188384),
    ("squeak_rat", "toefur", 288941),
    ("squeak_pig_grunt", "JarredGibb", 233177),
    ("squeak_pig_squeal", "TheAcidRomance", 260640),
    ("squeak_chicken", "Zajjman", 349177),
    ("squeak_bwack", "Preacher13", 673255),
    ("ambience_meadow_a", "baryy", 409143),
    ("ambience_meadow_b", "PuzzleAudio", 440807),
    ("ambience_birds", "WavJunction.com", 456766),
    ("swell_rumble", "swiftoid", 184313),
    ("swell_bass", "DanielsonIII", 68396),
    ("hawk_eagle", "GrayEpic", 697363),
    ("hawk_calls", "denalwa", 582183),
    ("wing_flap", "_stubb", 389634),
    ("wing_whoosh", "Godowan", 240476),
    ("fox_bark", "Setzilla", 173208),
    ("fox_barking_long", "gadzooks", 397655),
    ("fox_scream", "Soundburst", 634005),
    ("trap_bear", "ThePriest909", 278203),
    ("trap_spring", "fractionalist", 644245),
    ("trap_shut", "qubodup", 752070),
    ("trap_snap", "bsmacbride", 108524),
    ("sizzle_acid", "bottles", 382313),
    ("sizzle_pan", "newagesoup", 351406),
]


def request(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": USER_AGENT}), timeout=90) as response:
        return response.read()


def main():
    os.makedirs(SOURCES, exist_ok=True)
    entries = []
    for role, user, sound_id in RECORDINGS:
        page_url = f"https://freesound.org/people/{user}/sounds/{sound_id}/"
        page = request(page_url).decode("utf-8", errors="replace")
        if "publicdomain/zero/1.0" not in page:
            raise SystemExit(f"{page_url} is not CC0: stopping")
        title_match = re.search(r'<meta property="og:title" content="([^"]*)"', page)
        title = html.unescape(title_match.group(1)) if title_match else ""
        marker = f"https://cdn.freesound.org/previews/{sound_id // 1000}/{sound_id}_"
        start = page.index(marker)
        end = page.index('"', start)
        preview = page[start:end].replace("-lq.mp3", "-hq.ogg").replace("-lq.ogg", "-hq.ogg")
        safe_user = re.sub(r"[^A-Za-z0-9]", "", user)
        file_name = f"{role}_{sound_id}_{safe_user}.ogg"
        target = os.path.join(SOURCES, file_name)
        if os.path.exists(target):
            data = open(target, "rb").read()
        else:
            data = request(preview)
            if data[:4] != b"OggS":
                raise SystemExit(f"{preview} did not return an ogg file")
            open(target, "wb").write(data)
            time.sleep(0.6)
        entries.append({
            "role": role,
            "file": file_name,
            "source": "Freesound HQ preview",
            "url": page_url,
            "author": user,
            "title": title,
            "license": "Creative Commons 0 (CC0 1.0), sound page checked for publicdomain/zero/1.0 before download",
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        })
        print("ok", file_name, len(data))
    manifest = {"note": "All recordings CC0. No synthesis. Licence of each Freesound page checked before download.", "sources": entries}
    with open(os.path.join(SOURCES, "manifest.json"), "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
