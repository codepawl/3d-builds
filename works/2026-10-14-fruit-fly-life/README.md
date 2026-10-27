# The life of a fruit fly

A hand-drawn style film where every frame is code: the full fruit fly life cycle from egg to egg, drawn on a 2D canvas in JavaScript, with a score also made in code. Opus tried to learn the style of a viral film by Kevin Ngo.

- Post: https://x.com/anxuanng/status/2110354046540513509
- Made with: Claude Opus 5.5 in Claude Code, the `animate-code-illustration` skill, canvas 2D, Python (numpy, scipy, soundfile) for the score, ffmpeg

## How it was made

1. The owner liked Kevin Ngo's "life of a fruit fly" video (https://x.com/kevin_t_ngo/status/2099858454043349342). A first try with a sea turtle was rejected as ugly. A test with p5.brush was liked less than plain canvas.
2. The owner then asked to remake the fruit fly piece by piece together. I could not find the exact messages, so `prompts.md` gives the summary from the session notes.
3. Each scene is a page in `src/study/` (opening, embryo, larva, metamorphosis, adult, rebirth). The drawing helpers are in `src/src/` (`ink.js`, `fly.js` and one file for each stage).
4. The anatomy notes for each stage are in `design/` (`fruit-fly-embryo.md`, `fruit-fly-larva.md`, `fruit-fly-metamorphosis.md`, `fruit-fly-adult-life.md`).
5. The score is `src/fly_score.py` (44.5 s, 120 BPM). It is synced to the film and mastered to -14 LUFS. It uses `src/generate_theme.py` for its instruments.
6. The film runs 44.5 s. I did not verify how the posted video was assembled from the scene pages, because the project folder also holds the abandoned sea turtle film.

## Run it

Serve this folder with any static server and open a scene page, for example:

```
npx http-server src -p 5300
```

Then open http://localhost:5300/study/fly.html. To build the score:

```
uv run --no-project --with numpy --with scipy --with soundfile --with pyloudnorm python src/fly_score.py
```

The paths in `fly_score.py` expect `generate_theme.py` next to a parent `experiments/music-trial` folder. Change the `sys.path` line to `src/` if it fails.

## Design

Ink-line drawing on a paper look, with story time that surges on each beat so sounds land on frames. Six scenes: opening, embryo, larva, metamorphosis, adult life and rebirth. Anatomy notes per stage are in `design/`.
`poster.jpg` is a frame of the beat test render.

## Assets and credits

No external images or models. The score instruments come from `src/generate_theme.py` (synthesized). Kevin Ngo's video is only referenced by link.
Left out: rendered videos, and the real-recording sound pipeline (`sound/`), whose source recordings are not in this repo.
The folder `src/src/` also holds `kitchen.js`, `creatures.js` and `turtle.js` from the earlier sea turtle attempt. The fly scenes do not use them, as far as I checked; `study/turtle.html` is the leftover turtle page and needs `turtle.js`.

## Prompts
See prompts.md.
