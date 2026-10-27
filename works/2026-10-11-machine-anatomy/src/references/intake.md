# Intake: the questions to ask once

Ask all of these in one round with the host's question tool (AskUserQuestion in Claude Code; a single
numbered message where there is none). Give each a recommended default and say it is the default. Skip a
question the user already answered in their request. After the answers come back, build without asking
again: an unanswered question takes its default.

| # | Question | Default (recommended) | Maps to |
|---|---|---|---|
| 1 | Which machine, and which real version (maker, model, years)? | The best-documented historical original, e.g. "Edison's carbon-filament lamp, US patent 223,898, 1879-80" | `machine.mjs` `title`, `pageTitle`, `slug`; the research scope |
| 2 | The one idea a non-expert should get from it | One plain sentence you propose from the research ("the thin carbon gets white hot because it resists the current; the vacuum stops it burning") | `steps`, `trace`, the contrast moment, the caption |
| 3 | Colour theme: light, dark, blueprint, patent | `light` | `machine.mjs` `theme` (page and film); `?theme=` |
| 4 | Render style: line, dither, halftone, hatching, pixel | `line` | `machine.mjs` `style`; `record --style` |
| 5 | What the film shows: the full working cycle, or one sequence (a single letter, one stroke, one fault) | The full cycle in the approved order | `film.story(spec)` |
| 6 | Format: 16:9, 9:16, square | `16:9` | `build --format`, `record --format` |
| 7 | Sound: on or off, and its character (quiet taps, the machine's famous sound) | On, quiet close-mic taps; the machine's own signature sound if it has one | `machine.mjs` `sound` (`false` turns it off); `record --no-sound` |
| 8 | Length | 30 s | `film.seconds`; retime `slow`, `apart` to keep the shape |
| 9 | Audience level: general public, students, engineers | General public | wording of steps, trace, caption; how many numbers the readout shows |
| 10 | Setting: the machine alone, or in its full real setting (a rocket on its whole launch pad, a loom in its frame, a lamp on its supply) | Full real setting, researched and drawn with provenance like the machine | scenery pieces with `badge: false`, their facts, the camera framing |
| 11 | Working parts: show every part that works, or only the main motion | Every working part shown working (engines, fins, legs, clamps, arms, doors, switches...), each in `functions` with its film time, or a stated reason it is out of scope | `machine.functions`; lint and the recorder check it (`references/completeness-and-causality.md`) |

## How answers change the build

- **Machine and version**: research only that version. If the user names a version the sources do not
  support, say so in the report and draw the documented one.
- **One idea**: it decides the contrast control (the thing the reader can switch off to see why a part
  matters) and the film's contrast moment.
- **Theme and style** are independent: any pair works. Patent theme with hatching gives an engraving
  look; blueprint with dither a technical print. Pixel suits a playful post, not a museum page.
- **Film sequence**: keep the approved order around it: working first, then the zoom birth and slow run,
  then normal running with the contrast, then apart and back, then working at the end.
- **Format**: 9:16 puts the zoom frame and steps under the machine; square puts the zoom frame top right
  and the steps under the figure. The kit lays both out; check the stills.
- **Sound off** records a silent film and skips the loudness report.
- **Length** other than 30 s: set `film.seconds` and move `slow` and `apart` so each phase keeps its
  minimum (`film.minimum`); the recorder fails the shape check otherwise.
- **Audience**: engineers may get units and a fuller readout; the general public gets everyday words in
  the trace and no jargon in the caption.
- **Setting**: the default is the full real setting. A rocket stands on its real pad (mount, clamps,
  trench, the tower or strongback, lightning protection), sourced and marked simplified where it is; a
  plain square under the machine was rejected (Falcon 9, 2026-10-12).
