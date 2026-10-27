"""Motion smoothness: per segment, coefficient of variation of the mean absolute frame-to-frame difference.
A smooth glide gives a steady difference (low); texel-stepping gives bursts and holds (high)."""
import subprocess, sys
import numpy as np
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
segments = {"pan": (0, 180), "zoom": (190, 390), "orbit": (400, 598)}
print("| preset | pan | zoom | orbit |\n|---|---|---|---|")
for path in sys.argv[1:]:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", "scale=480:270", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True, check=True).stdout
    frames = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 270, 480).astype(np.int16)
    difference = np.abs(frames[1:] - frames[:-1]).mean(axis=(1, 2))
    cells = []
    for start, end in segments.values():
        window = difference[start:end]
        cells.append(f"{window.std() / window.mean():.2f}")
    print(f"| {path.split('/')[-1][:-4]} | " + " | ".join(cells) + " |")
