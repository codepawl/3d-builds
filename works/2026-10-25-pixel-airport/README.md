# A tiny pixel airport that runs itself

A single-file pixel-art 3D airport you can orbit, with a seeded simulation of arrivals, turnarounds and departures, a flight board and a day and night cycle.

- Post: https://x.com/anxuanng/status/2114171653869724055
- Live page: https://claude.ai/artifact/BXHpiw15HjLnmP3YUd191M
- Made with: Claude Opus 5.5 in Claude Code, three.js 0.170.0 (CDN import map)

## How it was made
1. The same prompt went to two models in a duel (`prompts.md`). The post shows the Opus result.
2. Opus wrote one `index.html` in one pass, with no external model or texture. The other run ended on a network error (`design/PROMPT-as-run.md` is the prompt it received).
3. The page was recorded at 1280x720 with `src/record.mjs` and checked in stills at 5, 20 and 45 seconds (`src/shoot.mjs`).
4. Before posting, An asked to drop the model label and show only the result.

## Run it
The page loads three.js and a font from CDNs, so it needs a network connection.
```
uv run --no-project python -m http.server 8080 --directory src
```
Open http://localhost:8080/index.html. Drag to orbit, click an aircraft to follow it, and use the 1x, 4x and 16x buttons.

## Design
The scene renders at about 400x225 into a render target and is upscaled with nearest-neighbour filtering. One warm sun casts shadows, aircraft and buildings get a 1 px outline, and a 4 minute day and night cycle turns on runway, taxiway and terminal lights. One runway 09/27, a parallel taxiway, six gates, a tower, a fuel farm and a hangar. The simulation uses a seeded generator and lets one aircraft use the runway at a time. The prompt in `design/prompt-as-given.md` lists every rule.

## Assets and credits
- Font: Silkscreen from Google Fonts (SIL Open Font License), loaded from fonts.googleapis.com.
- three.js: MIT, loaded from jsDelivr.
- Everything else is built from code. Left out: the recorded video and screen captures.

## Prompts
See prompts.md.
