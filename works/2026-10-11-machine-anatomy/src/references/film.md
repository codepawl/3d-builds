# The film

The default is a shape the owner of this kit approved after several rejected cuts. `kit/film.mjs` holds it
as `DEFAULT_FILM`; a machine overrides any field in `machine.mjs` `film` and writes its `story(spec)`
against the phase times, so retiming the spec moves the story with it.

30.0 s, 30 fps, light theme by default, no title bar, no footer wordmark. Formats: `16:9` (1920 x 1080),
`9:16` (1080 x 1920), `square` (1080 x 1080): `node cli.mjs build <folder>   format 9:16` then
`node cli.mjs record <folder> --format 9:16`.

## Order

1. **0 to about 5 s: working.** The full assembled machine works at normal speed from the first second,
   centred. Path, trace and readout live. No zoom frame, no source rectangle, no step labels. The
   recorder holds the zoom frame unborn (`holdZoom`) until its cue.
2. **`slow.from` (4.6 s): the zoom birth and one slow labelled run** at `slow.speed` (0.3x) until
   `slow.to` (12 s). Five or six short numbered steps light one by one as the signal, steam or current
   reaches each part; numbered marks sit beside the parts (`stepPoints`).
3. **Normal speed again**, at least 6 s (`minimum.normal`), with one moment that shows the principle by
   contrast (air let in, bias off, a load change, a different letter).
4. **Take-apart at `apart.open` (19.6 s).** The machine comes to rest, the zoom frame fades first, the
   assemblies leave one by one on staggered springs, the numbered legend shows, the pose holds at least
   1.5 s (`minimum.apartHold`), and at `apart.close` (25 s) it goes back together.
5. **End assembled and working.** Do not start a word or cycle that cannot finish before 30 s.

## The one zoom frame

- At most one magnified inset, never a permanent source rectangle on the model.
- Birth: a thin source rectangle appears round the part (0.25 s); the frame grows out of it to its place
  (ease out, 0.7 s); four dashed lines join the corners of rectangle and frame while it grows and for 1 s
  after; rectangle and lines fade over 1.2 s. Only the frame stays. The page uses the same birth the first
  time the machine runs; with reduced motion it simply appears.
- The frame never covers the part that is acting. Its place per format is in `FORMATS` (`kit/film.mjs`).

## Understanding

- Two colours for a path with two directions or two media (`--ma-flow`, `--ma-flow-2`), with a small key.
- A trace strip under the figure says the chain in everyday words and lights stage by stage.
- The path follows the real parts, computed from the layout.
- When the slow run starts, do not blank what was running.

## What the recorder checks and writes

`record` plays the story frame by frame on the page's own clock and fails when the recording breaks the
shape: zoom born before `minimum.opening`, the machine not working in the first 1.2 s, normal running
under 6 s, the apart hold under 1.5 s, or not ending assembled and working. It writes, under
`shots/<variant>/`: the mp4, the web mp4 (under 10 MB, the one to post), a poster, the stills listed in
`film.stills`, `video-sheet.png`, `film-events.json` (for remux) and `video-notes.txt` with the timeline.
It also prints sync lines (picture against sound) for the events in `film.sync`.

Look at the sheet and three stills yourself before showing anyone: machine working with no inset in the
first frames, the zoom frame born from the model, nothing clipped, labels not overlapping.

## Nothing covers anything (enforced)

The recorder and verify run one collision check (`kit/overlap.mjs`): legend rows, badges, step marks, step
labels, trace strip, readout, corner texts and the zoom frame against each other and against the
assemblies, and, while apart, assemblies against each other. Every collision is reported with both names,
the time and the area, and fails the film. Only physically real overlap may be declared, with its reason,
in `film.overlapAllowed` (`[first, second, reason]`; `["*", piece, reason]` for a ground piece every part
stands on). Never declare an exception to make a layout pass. For a tall machine use `film.legend: "side"`
so the legend has its own column; give scenery that passes under the text band a fade.

## Framing (enforced)

- The subject (all badged assemblies on screen) fills at least `minimum.subject` (default 25%) of the
  frame height in every sampled frame. A moving machine runs its own camera: `hooks.camera()` returns
  `{ x, y, zoom }`; the kit blends the apart view from it and places badges, step marks and the zoom birth
  with it. Fit the camera to the subject inside the area no text uses.
- Key events happen on screen: `film.onScreen` lists `[event, [pieces]]`; each piece must be at least 60%
  inside the frame when the event fires (separations, landings, the moment the principle shows).

## Dissection during motion

`film.variant: "in-motion"` takes the machine apart while it keeps running, inside the slow run:
`slow.ease` eases time down and up so the viewer sees it slow, `steps: { from, to }` sets the step window,
and the shape check requires the whole take-apart inside the slow run with the machine working, then at
least `minimum.normal` seconds at normal speed.
