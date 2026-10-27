# Honking Seal

A plump seal you can stretch with a mouse or finger. Pull or change direction to play the next trumpet note of **Twinkle, Twinkle, Little Star**. Each stroke plays one note. The 42-note tune loops. Staying still for three seconds starts the melody over.

Give or remove the trumpet, mute sound, or restart the song with the controls. Arrow keys and Space also squeeze the seal. Audio starts after the first interaction.

## Local preview

Run `node demos/seal-squeeze/server.mjs` from the social workspace. Open http://127.0.0.1:5178. The header switches between Three.js and 67.js.

The development server uses the existing Three.js and 67.js checkout at `<your 67js checkout>`. It installs nothing.

## Static website

Run `node demos/seal-squeeze/build.mjs`. Serve the resulting `dist/` folder on any static host. The build bundles the installed dependencies, so that folder does not need the local checkout. Publishing is separate.

Both versions share the original procedural model, deformation, pointer math and synthesized audio. Three.js renders the first version. The second uses **Renderer67 0.3.3** for every draw. Three.js only supplies the shared geometry and interaction math. Since 67.js has no public deforming-geometry upload API yet, the local adapter updates its retained position and normal buffers. This adapter depends on that renderer version.

## Checks

- `node --test demos/seal-squeeze/interaction.test.mjs`: melody order, looping, reset, one note per stroke, jitter and cooldown.
- `node demos/seal-squeeze/smoke.mjs three` and `... 67`: rendered desktop/mobile screenshots, pointer dragging, spring return, horn toggle and audio unlock.
- `node demos/seal-squeeze/checks.mjs`: browser touch input, stationary hold, 44-note playback, audio signal/pitch/muting, 320px layout and reduced-motion handling.

The checks use the already installed Playwright and isolated headless Chrome. The toy uses original geometry and synthesized audio. It needs no image generation, downloaded model or recorded soundtrack.

