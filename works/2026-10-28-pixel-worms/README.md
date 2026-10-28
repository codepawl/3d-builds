# Pixel Worms

A free, open-source game in the browser. You lead a swarm of worms across a pixel-style countryside, eat the creatures you
find and grow. Hawks, foxes and traps kill worms, but a big enough swarm overwhelms the fox. Eat every creature on the map to win.
You lose when the last worm dies.

Play it: https://worms.codepawl.com

Inspired by [@Yokohara_h's worm swarm](https://x.com/Yokohara_h/status/2113611938337038512). Made by CodePawl with Claude Opus 5.5 in Claude Code.

## How to play

- Desktop: move the mouse. The worms follow the cursor, and the camera turns when the cursor is near the left or right edge.
- Phone and tablet: drag to steer. A tap sets a target and the swarm goes there.
- Creatures break into meat, ribs and bones. The swarm eats them piece by piece and grows from the food.
- The swarm is capped at 600 worms on desktop and 250 on phones.

## Run it

```
npm install
npm run dev
npm run build
```

`npm run dev` serves the game at http://127.0.0.1:5471/. `npm run build` writes a static site to `dist/` that works from any site
root (asset paths are relative). Preview it with `npx vite preview`.

Debug URL parameters: `?play=1` skips the title screen, `?worms=200` starts with that many worms.

## The film

The same scene produced a short film. Open the page with `?manual=1` (or `?film`) for the film mode: no game interface, a
fixed 1920x1080 picture, a scripted hazard schedule and the `window.__app` hooks. The scripts in `tools/` drive it with
Playwright; set `PLAYWRIGHT_FROM` to a `package.json` next to an installed `playwright` package.

## Code

- `src/worms.js` the swarm simulation, `src/worm-renderer.js` the worm bodies
- `src/creatures.js`, `src/chunks.js` creatures and the pieces they break into
- `src/hazards.js` hawk, fox, bear traps and the salt ring; `src/opponents.js` the other opponents; `src/director.js` and `src/tuning.js` the difficulty
- `src/growth.js` bellies, hunger and splitting; `src/abilities.js` lunge and dodge; `src/tutorial.js` the first-run guide
- `tools/playtest.mjs` runs bot players to balance the game; the numbers are in `notes/game-design.md`
- `src/chase-camera.js` the low-resolution camera, outline and dither
- `src/main.js` the app, `src/ui.js` and `src/audio.js` the interface and sound

## Credits

Models by Kenney (CC0), Pixelify Sans (SIL OFL 1.1), three.js (MIT) and CC0 Freesound recordings. Every item with its author,
licence and link is in `credits.json`, `sound/sources/manifest.json` and the Credits page in the game.

The code is MIT licensed, see `LICENSE`. Source: https://github.com/codepawl/3d-builds (`works/2026-10-28-pixel-worms`).

## Prompts
See prompts.md.
