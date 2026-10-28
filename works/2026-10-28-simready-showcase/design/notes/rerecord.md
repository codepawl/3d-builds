# Re-record the film with final numbers

All commands run from anywhere with absolute paths (never `cd`). `$D` = this folder.
Each Node tool lowers its own priority, so Chrome starts below normal. Use Git Bash (PowerShell cannot see the Playwright Chrome).
At most 2 render processes at a time. Never write to the batch output (read only).

1. Server: start `node $D/tools/serve.mjs 5530` with the shell tool's `run_in_background`, note the pid it prints, stop it at the end
   (`Get-NetTCPConnection -LocalPort 5530 -State Listen` gives the pid).
2. Totals and the set models from the batch manifest (reads the batch output (`BATCH_OUT`), writes `web/data/totals.json`, `web/data/set.json`, `web/models/set/`):
   `node $D/tools/totals.mjs 12`. It keeps only models that fit a set cell (widest view / height <= 1.05), one per category first;
   12 are needed for the 4 x 3 grid. Then refresh the set rows in `CREDITS.md` (the list is the `models/set/` lines).
   The set panel prints `optimizedCount / 2,595 done`; when the batch is complete (`totals.json` `complete: true`) the number reads 2,595 / 2,595.
3. Load times and the raw V8 capture (optional, only if the models changed): `node $D/tools/measure_load.mjs`
   (`ONLY=v8_raw node ...` re-measures one target). Pipeline stages: `node $D/batch/stages.mjs <blender.glb> $D/web/data/stages_v8.json 1024` run from `batch/`.
   The left side of the V8 beat is the 220 stills in `web/captures/` (the raw glb cannot share a page with another model);
   the fast-forward factor is computed from `load_times.json` and `SCRIPT.loadClick`/`fastForwardEnd`, so it stays true if the load time changes.
4. Check the set cells: `window.__setMetrics` (page console, or a Playwright evaluate after load) lists each model's width and height in px;
   heights must stay >= 260 and widths <= 290 (cell is 315 wide). Fewer than 260 means `totals.mjs` let a wide model in.
5. Film frames (about 75 s): `node $D/tools/film.mjs $D/out/frames` -> `out/frames/f####.jpg`, `out/input_events.json`, `out/state_events.json`, `out/cue_events.json`
6. Sound (one soft sound per logged input and cue, music bed ducked under them, -16 LUFS, true peak under -1 dBFS; stops on a silent input).
   Needs `uv run --offline` (no network, the cached environment):
   `uv run --offline --no-project --python 3.12 --with numpy --with scipy --with soundfile --with pyloudnorm python $D/sound/make_sound.py`
   Sources and licences: `CREDITS.md`; files in `sound/sources/` (music: `music_hypnothis_kevin_macleod.mp3`, CC BY 4.0, credited on the end card).
7. Mux (frames are full-range JPEG, convert to limited-range yuv420p):
   `ffmpeg -y -framerate 30 -i $D/out/frames/f%04d.jpg -i $D/sound/simready-optimized.wav -vf "scale=in_range=full:out_range=tv,format=yuv420p" -c:v libx264 -preset slow -crf 17 -r 30 -c:a aac -b:a 192k -shortest -movflags +faststart $D/out/simready-optimized.mp4`
8. Sheets and stills from the encoded video (delete the old ones first so none are stale):
   `ffmpeg -y -i $D/out/simready-optimized.mp4 -vf "fps=1,scale=480:-1,tile=4x4" $D/out/sheets/sheet_%d.png`
   `ffmpeg -y -ss <t> -i $D/out/simready-optimized.mp4 -frames:v 1 $D/out/stills/t<t>.png` for 0.3, 3.0, 5.0, 6.5, 9.6, 12.0, 16.8, 20.5, 22.5, 27.5 (one per beat state).
9. Single stills without recording: `node $D/tools/still.mjs $D/out/review 5 12 27`

Timeline (seconds, `web/src/script.js`, restructured 2026-10-28): alternator slider 0-8.0 (starts in motion, cursor gliding to the handle, grab 1.2,
close-up key 5.7), progress beat 8.0-18.4 (one V8 engine, a track NVIDIA original -> Blender glb -> dedupe instances -> textures to WebP -> meshopt geometry -> ours;
real clicks on the four step rows at 9.0, 10.8, 12.6, 14.4, each counting the stat panels over 0.9 s; "ours" lands about 15.3-16.0 and the beat ends on the
before/after panels, 888 MB -> 9.3 MB, 9.40 s -> 0.57 s, 16x faster), whole set 18.4-25.0 (click 19.5), end card 25.0-29.0. One whoosh at 7.8, 18.2 and 24.8.
The V8 on screen is the raw stills in `web/captures/` until the last step runs, then the live optimized model fades in over them (same camera). Keep the film 28-34 s.
X copy (under 15 MB, 1080p): `ffmpeg -y -i out/simready-optimized.mp4 -c:v libx264 -preset slow -b:v 3500k -pass 1 -an -f null NUL` then the same with `-pass 2 -c:a aac -b:a 128k -movflags +faststart out/simready-optimized-x.mp4`.
The repo name lives in one constant: `REPO_NAME` in `web/src/script.js`. Input times and sound cues (`effectCues`) live in the same file.

## Fixes for the final cut (main session, 2026-10-28)

- Vise close-up: the Space close-up is too tight (texels visible), so the 1K side reads blurry against the 4K side and
  contradicts "looks the same". Pull back to a medium close-up where the 1K texture holds, and end the slider over
  the vise body (not at x 1040 with the model cut off).
- Compress the final mp4 for X (target under 15 MB, CRF tuned, keep 1080p).

## Opening model changed to the alternator (2026-10-29)

The owner found the vise's blue speckled paint glitchy next to the dithered backdrop. The opening slider now shows
`electricalSystem_alternator_d01` (NVIDIA SimReady, CC BY 4.0): clean polished metal, strong silhouette. Chosen from six
candidates rendered at the opening camera (`out/candidates/`, sheet.png); the others were a cooling radiator (greenish, flat),
the front axle differential (exploded, small in frame), an engine hoist, a steering wheel and a wheel rim (cut off by the frame).
- Raw glb rebuilt from the Hugging Face simready_usd files with `batch/usd_to_glb.py` (Blender 5.2): 381,386,840 bytes, the same as the manifest.
  Files: `web/models/test/electricalSystem_alternator_d01.blender.glb` (raw) and `.glb` (optimized, copied from the batch output).
- Numbers come from `web/data/opt_alternator.json` (manifest) and `load_times.json` keys `alternator_raw` / `alternator_opt`
  (`ONLY=alternator_raw node tools/measure_load.mjs`). They were measured while the batch job was running, so first frames are slower than on an idle machine.
- Camera in `placeCamera` (`web/src/film.js`): zoom 1.45 -> 1.95 on the close-up, centre shifted up by 10% of the height. At 4096 vs 1024 the close-up still holds.
- The vise files stay in `web/models/` and `web/models/test/`; `opt_vise.json` and the `vise_*` load times are no longer read.
