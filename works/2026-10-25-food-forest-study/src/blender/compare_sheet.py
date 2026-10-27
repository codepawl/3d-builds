import subprocess, sys, os
from PIL import Image, ImageDraw
ROOT = "<your folder>/food-forest-study"
VIDEO = "reference.mp4"  # the reference video, not included
times = [0.5, 1.5, 2.6, 3.6, 4.8, 5.8, 7.5, 9.5, 11.5, 13.0, 14.5]
os.makedirs(f"{ROOT}/out/ref", exist_ok=True)
W, H = 640, 360
rows = [t for t in times if os.path.exists(f"{ROOT}/stills/still_{t:05.2f}.png")]
sheet = Image.new("RGB", (W * 2, H * len(rows)))
draw = ImageDraw.Draw(sheet)
for i, t in enumerate(rows):
    ref = f"{ROOT}/out/ref/ref_{t:05.2f}.png"
    if not os.path.exists(ref):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(t), "-i", VIDEO, "-frames:v", "1", ref], check=True)
    sheet.paste(Image.open(ref).convert("RGB").resize((W, H)), (0, i * H))
    sheet.paste(Image.open(f"{ROOT}/stills/still_{t:05.2f}.png").convert("RGB").resize((W, H)), (W, i * H))
    draw.text((8, i * H + 6), f"ref {t:.1f}s", fill=(255, 255, 0))
    draw.text((W + 8, i * H + 6), f"ours {t:.1f}s", fill=(0, 255, 255))
sheet.save(f"{ROOT}/out/compare-sheet.jpg", quality=88)
# per-pair halves for closer reading
half = len(rows) // 2 + 1
sheet.crop((0, 0, W * 2, H * half)).save(f"{ROOT}/out/compare-sheet-a.jpg", quality=90)
sheet.crop((0, H * half, W * 2, H * len(rows))).save(f"{ROOT}/out/compare-sheet-b.jpg", quality=90)
print("rows", rows)
