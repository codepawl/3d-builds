# Battle 2026-10-15: Opus 5.5 vs Gemini 4 Argon, four cozy scenes

Same brief per scene (`COMMON.md` + `<scene>.md`), each model run headless once (`run_one.sh`: `claude -p --model opus`,
`agy --model gemini-4-argon-high`), no hand edits. Both builds filmed by `record.mjs` through the `window.battle` hook
(20 s, 1920x1080, 30 fps, same camera curve and preset cues). Battles made with `tools/battle-frame/make-battle.mjs --layout side`.

| Scene | Opus 5.5 | Gemini 4 Argon | Video |
|---|---|---|---|
| tokyo-alley | 47.3 min, 103 tool calls, 21 edits | 42.6 min, 100 tool calls, 31 edits | drafts/battle-tokyo-alley |
| lighthouse | 30.7 min, 97 tool calls, 23 edits | 56.4 min, 115 tool calls, 36 edits | drafts/battle-lighthouse |
| onsen | 54.8 min, 157 tool calls, 36 edits | 49.1 min, 123 tool calls, 40 edits | drafts/battle-onsen (weak, not proposed) |
| koi-garden | 56.1 min, 116 tool calls, 24 edits | 46.5 min by its own timestamps, 121 tool calls (one resume) | drafts/battle-koi-garden |

Minutes are wall clock from the runner logs (`node stats.mjs`). The Argon koi run was cut by the agy CLI while it
waited on its own background task and was resumed once with a neutral "continue" prompt (`RUN-NOTES.md`).

## Pass 2 (`PASS2.md` + `feedback/<scene>-<model>.md`, `run_pass2.sh`)

Both models resumed their own conversation with the same brief: more realism, better models, and one shared camera
look (`shared/battle-look.js`, copied byte for byte and checked by `check-parity.sh`). The look fixes the field of
view at 50 degrees and does the anti-aliasing, ambient occlusion, bloom, depth of field, vignette, grain and handheld
sway for both. Depth of field and ambient occlusion read the depth buffer of the real render, and the recorder sets
one clock per video frame (`battleLook.setClock`), so sway and focus move the same on every build.
Re-recorded with `record-p2.mjs`. The lighthouse is filmed as golden, storm, night, without calm (An, 2026-10-16).

| Scene | Opus 5.5 pass 2 | Argon pass 2 | Total Opus | Total Argon |
|---|---|---|---|---|
| tokyo-alley | 48.7 min | 46.5 min | 96 min | 89 min |
| lighthouse | 35.7 min | 54.5 min | 66 min | 111 min |
| onsen | 50.9 min | 57.4 min | 106 min | 107 min |
| koi-garden | 28.2 min | 62.1 min | 84 min | 109 min |
