"""Cuts the visualize-in-3d trailer from recorded world frames and Blender turntable frames.

Run: uv run --no-project --python 3.12 --with numpy --with scipy --with soundfile --with pyloudnorm python build_trailer.py
Steps: make_music.py writes music.wav (84 BPM), then this script cuts picture on the same beat grid and muxes.
Every cut lands on a beat: BEAT_FRAMES = 30 fps * 60 / 84 = 21.43 frames, boundaries are rounded cumulatively.
"""
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PROJECT = Path("<your folder>/trailer-visualize-3d")
FRAMES = PROJECT / "frames"
TURN = PROJECT / "turn"
CARD_DIR = PROJECT / "tools" / "cards"
FONT_SEMIBOLD = "C\\:/Windows/Fonts/seguisb.ttf"
FONT_LIGHT = "C\\:/Windows/Fonts/segoeuil.ttf"
FPS = 30
BPM = 84
BEAT = 60 / BPM
BEAT_FRAMES = FPS * BEAT
TOTAL_BEATS = 64
TOTAL_FRAMES = round(TOTAL_BEATS * BEAT_FRAMES)

# (kind, folder name, first source frame, beats). World clips are 150 frames, turntable clips 66, the end hero 171.
SEGMENTS = [
    ("world", "themepark-m", 0, 7),
    ("world", "pitlane-m", 0, 7),
    ("world", "airport-m", 30, 4),
    ("world", "datacenter-m", 50, 4),
    ("world", "fulfillment-m", 50, 3),
    ("world", "er-m", 40, 3),
    ("turn", "rocket", 0, 3),
    ("turn", "crane", 0, 3),
    ("turn", "jet", 0, 3),
    ("turn", "ambulance", 12, 2),
    ("turn", "racecar", 12, 2),
    ("turn", "coaster", 12, 2),
    ("turn", "cart", 12, 2),
    ("turn", "drone", 12, 2),
    ("turn", "orglet", 12, 2),
    ("world", "port-close", 0, 7),
    ("turn", "hero", 0, 8),
]

# (text, start beat, end beat, font, size, y offset from centre, fade-in seconds)
CARDS = [
    ("Things that are hard to picture.", 1.0, 6.5, FONT_SEMIBOLD, 84, 0, 0.7),
    ("Made visible in 3D.", 8.0, 13.5, FONT_SEMIBOLD, 104, 0, 0.7),
    ("visualize-in-3d", 56.0, 64.0, FONT_SEMIBOLD, 124, -70, 0.12),
    ("github.com/codepawl/skills", 57.5, 64.0, FONT_LIGHT, 54, 50, 0.5),
    ("MIT", 58.5, 64.0, FONT_LIGHT, 40, 120, 0.5),
]
# Windows (beat start, beat end, brightness drop) where the picture is darkened under text.
DIMS = [(0.0, 7.0, 0.38), (7.0, 14.0, 0.34), (56.0, 64.0, 0.3)]


def beat_to_frame(beat):
    return round(beat * BEAT_FRAMES)


def segment_frames(index):
    first_beat = sum(segment[3] for segment in SEGMENTS[:index])
    last_beat = first_beat + SEGMENTS[index][3]
    return beat_to_frame(last_beat) - beat_to_frame(first_beat)


def card_filter(index, card):
    text, start, end, font, size, y_offset, fade_in = card
    CARD_DIR.mkdir(exist_ok=True)
    text_file = CARD_DIR / f"card_{index}.txt"
    text_file.write_text(text, encoding="utf-8")
    start_seconds, end_seconds = start * BEAT, end * BEAT
    alpha = f"min(1,(t-{start_seconds:.3f})/{fade_in})*min(1,({end_seconds:.3f}-t)/0.4)"
    escaped = text_file.as_posix().replace(":", "\\:")
    return (
        f"drawtext=fontfile='{font}':textfile='{escaped}':fontsize={size}:fontcolor=white:alpha='{alpha}'"
        f":x=(w-text_w)/2:y=(h-text_h)/2+({y_offset}):shadowcolor=black@0.45:shadowx=0:shadowy=4"
        f":enable='between(t,{start_seconds:.3f},{end_seconds:.3f})'"
    )


def dim_source(index, start, end, amount):
    """A black layer that fades in and out over the window, laid over the picture so text stays legible."""
    start_seconds, end_seconds = start * BEAT, end * BEAT
    return (
        f"color=c=black:s=1920x1080:r={FPS}:d={TOTAL_FRAMES / FPS:.3f},format=yuva420p,"
        f"fade=t=in:st={start_seconds:.3f}:d=0.5:alpha=1,fade=t=out:st={max(start_seconds, end_seconds - 0.5):.3f}:d=0.5:alpha=1,"
        f"colorchannelmixer=aa={amount}[dim{index}]"
    )


def render_picture(output_path):
    command = ["ffmpeg", "-y", "-v", "error"]
    chains = []
    for index, (kind, folder, first_frame, beats) in enumerate(SEGMENTS):
        base = FRAMES if kind == "world" else TURN
        command += ["-framerate", str(FPS), "-start_number", str(first_frame), "-i", str(base / folder / "%04d.jpg")]
        count = segment_frames(index)
        chains.append(f"[{index}:v]trim=end_frame={count},setpts=PTS-STARTPTS,fps={FPS},scale=1920:1080:in_range=pc:out_range=tv,setsar=1,format=yuv420p[s{index}]")
    joined = "".join(f"[s{index}]" for index in range(len(SEGMENTS)))
    cards = ",".join(card_filter(index, card) for index, card in enumerate(CARDS))
    chains.append(f"{joined}concat=n={len(SEGMENTS)}:v=1:a=0[layer0]")
    for index, dim in enumerate(DIMS):
        chains.append(dim_source(index, *dim))
        chains.append(f"[layer{index}][dim{index}]overlay=format=auto[layer{index + 1}]")
    chains.append(f"[layer{len(DIMS)}]{cards},fade=t=in:st=0:d=0.6,fade=t=out:st={TOTAL_FRAMES / FPS - 1.2:.3f}:d=1.2[final]")
    command += [
        "-filter_complex", ";".join(chains), "-map", "[final]", "-frames:v", str(TOTAL_FRAMES), "-r", str(FPS),
        "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-color_primaries", "bt709",
        "-color_trc", "bt709", "-colorspace", "bt709", str(output_path),
    ]
    subprocess.run(command, check=True)


def mux(picture_path, music_path, master_path, web_path):
    duration = TOTAL_FRAMES / FPS
    audio_filter = f"atrim=0:{duration:.3f},afade=t=out:st={duration - 1.6:.3f}:d=1.6"
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-i", str(picture_path), "-i", str(music_path), "-af", audio_filter,
        "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", str(master_path),
    ], check=True)
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-i", str(master_path), "-c:v", "libx264", "-preset", "slow", "-crf", "24",
        "-maxrate", "2400k", "-bufsize", "4800k", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", str(web_path),
    ], check=True)


if __name__ == "__main__":
    picture = PROJECT / "picture.mp4"
    render_picture(picture)
    mux(picture, PROJECT / "music.wav", PROJECT / "trailer-visualize-in-3d.mp4", PROJECT / "trailer-visualize-in-3d-x.mp4")
    print("built", TOTAL_FRAMES, "frames", TOTAL_FRAMES / FPS, "s")
