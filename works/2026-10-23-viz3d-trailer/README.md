# The viz3d trailer

The 47 second trailer for viz3d, a free skill that turns floor plans, wiring diagrams and case files into a live 3D world. It opens on a real layout, Changi Airport, and cuts to other builds.

- Post: https://x.com/anxuanng/status/2113565735029191084  (pinned)
- The skill: https://github.com/codepawl/viz3d
- Made with: Claude Opus 5.5 in Claude Code, the visualize-in-3d skill (https://github.com/codepawl/viz3d), three.js (recorded from the other builds in this repo), ffmpeg, Python with numpy and scipy for the score

## How it was made
1. The first trailer showed game-style ops apps. An asked for harder subjects: an airport, a hospital, data, a warehouse, and long documentaries about crime and history, plus an intro text that states the purpose of the skill.
2. The cards were rewritten several times. An cut the airport and the spreadsheet from the opening, kept the drawing, and asked for a line like "Got something hard to visualize in your head?". The opening later used a real design, Changi Airport, as the example.
3. Short clips were recorded from each build with a headless browser (`src/record_world_v3.mjs`, shots in `src/shots_v3.json`), plus turntables of single models (`src/turntable.py`).
4. The score was changed twice: An rejected the showreel track, then asked for a softer, deeper sound than the glassy effect. The final score is synthesized in code (`src/make_music_v3.py`).
5. `src/build_trailer_v3.py` joins the clips, cards and score with ffmpeg.
6. The caption was rewritten to start from the pain and say what the skill does, without naming one airport. This took many rounds, not one shot.

## Run it
The trailer needs the apps of the other builds running. Start one from its own work folder, then record:
```
node src/record_world_v3.mjs
uv run --no-project --python 3.12 --with numpy --with scipy --with soundfile --with pyloudnorm python src/make_music_v3.py score.wav
uv run --no-project python src/build_trailer_v3.py
```
The recorder and the builder expect the project layout described at the top of each script. Edit the paths there to match your folders.

## Design
47 seconds at 120 BPM in A major: electric piano, marimba, a warm pad and a soft sub pulse, with no noise layers. Cards and captions are in `design/cards/`. `design/glb_list.txt` lists the models that appear.

## Assets and credits
- Clips come from the other builds in this repo, which are made from procedural Blender models.
- Music: synthesized in `src/make_music.py` and `src/make_music_v3.py`. No samples.
- Left out: the rendered trailer, the recorded clips and the contact sheets.

## Prompts
See prompts.md.
