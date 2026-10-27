"""Cuts trailer v3: two purpose cards, eight UI-free world or film shots with question captions, an end card.

Run: uv run --no-project --python 3.12 python build_trailer_v3.py   (music_v3.wav must exist, see make_music_v3.py)
Everything sits on a 120 BPM grid: 94 beats of 0.5 s = 47 s, 1410 frames at 30 fps.
"""
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PROJECT = Path("<your folder>/trailer-visualize-3d")
FRAMES = PROJECT / "frames"
CARD_DIR = PROJECT / "tools" / "cards_v3"
DEMOS = Path("<your folder>/demos")
GEIN_FILM = DEMOS / "case-plainfield/app/shots/life-wide-web.mp4"
CHERNOBYL_FILM = DEMOS / "case-chernobyl/app/shots/night-wide-web.mp4"
FONT_SEMIBOLD = "C\\:/Windows/Fonts/seguisb.ttf"
FONT_REGULAR = "C\\:/Windows/Fonts/segoeui.ttf"
FPS = 30
BEAT = 0.5
BEAT_FRAMES = 15
INTRO_BEATS = 17
END_BEATS = 10
SCRIM_TOP = 600

# (kind, source, first frame or start second, beats, caption, slowdown for film clips)
SHOTS = [
    ("frames", FRAMES / "airport-m", 15, 8, "How an airport turns a plane around", 1.0),
    ("frames", FRAMES / "er-m", 0, 9, "What an ER does with ten arrivals at once", 1.0),
    ("frames", FRAMES / "datacenter-m", 10, 8, "Where a data center's power goes", 1.0),
    ("frames", FRAMES / "fulfillment-m", 15, 8, "How a warehouse ships an order", 1.0),
    ("frames", FRAMES / "metro-v3", 0, 9, "How a metro keeps trains apart underground", 1.0),
    ("frames", FRAMES / "toll-v3", 20, 9, "How a toll gantry charges a truck at full speed", 1.0),
    ("film", GEIN_FILM, 116.2, 8, "How a 1957 case unfolded across a county", 1.0),
    ("film", CHERNOBYL_FILM, 33.0, 8, "Why reactor 4 exploded at 01:23", 1.0),
]
# Text cards on the dark intro: (text, start s, end s, size)
CARDS = [
    ("Some things are hard to picture", 0.4, 3.9, 100),
    ("This Claude skill turns them\ninto 3D worlds", 4.1, 8.4, 100),
]
# End card lines: (text, start s, font, size, y)
END_LINES = [
    ("visualize-in-3d", 42.0, FONT_SEMIBOLD, 140, 340),
    ("github.com/codepawl/skills", 42.4, FONT_REGULAR, 72, 580),
    ("MIT", 42.8, FONT_REGULAR, 60, 700),
]
TOTAL_BEATS = INTRO_BEATS + sum(shot[3] for shot in SHOTS) + END_BEATS
TOTAL_FRAMES = TOTAL_BEATS * BEAT_FRAMES
TOTAL_SECONDS = TOTAL_FRAMES / FPS
BACKGROUND = "0x0e1218"


def text_file(name, text):
    CARD_DIR.mkdir(exist_ok=True)
    path = CARD_DIR / f"{name}.txt"
    path.write_text(text, encoding="utf-8")
    return path.as_posix().replace(":", "\\:")


def draw_text(name, text, start, end, font, size, y, fade_in, fade_out):
    alpha = f"min(1,(t-{start:.3f})/{fade_in})*min(1,({end:.3f}-t)/{fade_out})"
    return (
        f"drawtext=fontfile='{font}':textfile='{text_file(name, text)}':fontsize={size}:fontcolor=white:alpha='{alpha}'"
        f":x=(w-text_w)/2:y={y}:text_align=center:line_spacing=-60:shadowcolor=black@0.5:shadowx=0:shadowy=3:enable='between(t,{start:.3f},{end:.3f})'"
    )


def build_command(output_path):
    command = ["ffmpeg", "-y", "-v", "error"]
    chains = []
    intro_frames = INTRO_BEATS * BEAT_FRAMES
    end_frames = END_BEATS * BEAT_FRAMES
    command += ["-f", "lavfi", "-i", f"color=c={BACKGROUND}:s=1920x1080:r={FPS}:d={intro_frames / FPS:.3f}"]
    chains.append("[0:v]format=yuv420p,setsar=1[intro]")
    labels = ["[intro]"]
    for index, (kind, source, start, beats, _caption, slowdown) in enumerate(SHOTS, start=1):
        count = beats * BEAT_FRAMES
        if kind == "frames":
            command += ["-framerate", str(FPS), "-start_number", str(start), "-i", str(source / "%04d.jpg")]
            chain = f"[{index}:v]trim=end_frame={count},setpts=PTS-STARTPTS,scale=1920:1080:in_range=pc:out_range=tv"
        else:
            duration = count / FPS / slowdown + 0.2
            command += ["-ss", str(start), "-t", f"{duration:.3f}", "-i", str(source)]
            # Crop away the film's own burned-in caption strip (lower quarter), keep 16:9.
            crop = "crop=1422:800:249:0," if source == CHERNOBYL_FILM else ""
            chain = f"[{index}:v]{crop}scale=1920:1080,setpts=(PTS-STARTPTS)*{slowdown},fps={FPS},trim=end_frame={count},setpts=PTS-STARTPTS"
        chains.append(f"{chain},setsar=1,format=yuv420p[shot{index}]")
        labels.append(f"[shot{index}]")
    command += ["-f", "lavfi", "-i", f"color=c={BACKGROUND}:s=1920x1080:r={FPS}:d={end_frames / FPS:.3f}"]
    end_index = len(SHOTS) + 1
    chains.append(f"[{end_index}:v]format=yuv420p,setsar=1[outro]")
    labels.append("[outro]")
    scrim_index = end_index + 1
    command += ["-f", "lavfi", "-i", f"color=c=black:s=1920x{1080 - SCRIM_TOP}:r={FPS}:d={TOTAL_SECONDS:.3f},format=yuva444p"]
    chains.append(f"[{scrim_index}:v]geq=lum='0':cb=128:cr=128:a='min(255,215*pow(Y/H,1.5))'[scrim]")
    chains.append("".join(labels) + f"concat=n={len(labels)}:v=1:a=0[joined]")
    example_start = INTRO_BEATS * BEAT
    example_end = example_start + sum(shot[3] for shot in SHOTS) * BEAT
    chains.append(f"[joined][scrim]overlay=0:{SCRIM_TOP}:enable='between(t,{example_start:.3f},{example_end - 0.001:.3f})':format=auto[scrimmed]")
    texts = []
    for index, (text, start, end, size) in enumerate(CARDS):
        texts.append(draw_text(f"card_{index}", text, start, end, FONT_SEMIBOLD, size, "(h-text_h)/2", 0.4, 0.3))
    shot_start = example_start
    for index, shot in enumerate(SHOTS):
        shot_end = shot_start + shot[3] * BEAT
        texts.append(draw_text(f"caption_{index}", shot[4], shot_start, shot_end, FONT_SEMIBOLD, 74, "h-200", 0.2, 0.15))
        shot_start = shot_end
    for index, (text, start, font, size, y) in enumerate(END_LINES):
        texts.append(draw_text(f"end_{index}", text, start, TOTAL_SECONDS, font, size, y, 0.35, 0.001))
    fade_out_start = TOTAL_SECONDS - 0.8
    chains.append(f"[scrimmed]{','.join(texts)},fade=t=in:st=0:d=0.5,fade=t=out:st={fade_out_start:.3f}:d=0.8[final]")
    command += [
        "-filter_complex", ";".join(chains), "-map", "[final]", "-frames:v", str(TOTAL_FRAMES), "-r", str(FPS),
        "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-color_primaries", "bt709",
        "-color_trc", "bt709", "-colorspace", "bt709", str(output_path),
    ]
    return command


def run_low_priority(command):
    below_normal = 0x00004000
    subprocess.run(command, check=True, creationflags=below_normal)


def mux(picture_path, music_path, master_path, web_path):
    run_low_priority([
        "ffmpeg", "-y", "-v", "error", "-i", str(picture_path), "-i", str(music_path), "-t", f"{TOTAL_SECONDS:.3f}",
        "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", str(master_path),
    ])
    run_low_priority([
        "ffmpeg", "-y", "-v", "error", "-i", str(master_path), "-c:v", "libx264", "-preset", "slow", "-crf", "24",
        "-maxrate", "2400k", "-bufsize", "4800k", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", str(web_path),
    ])


if __name__ == "__main__":
    picture = PROJECT / "picture_v3.mp4"
    run_low_priority(build_command(picture))
    mux(picture, PROJECT / "music_v3.wav", PROJECT / "trailer-v3.mp4", PROJECT / "trailer-v3-x.mp4")
    print("built", TOTAL_FRAMES, "frames", TOTAL_SECONDS, "s")
