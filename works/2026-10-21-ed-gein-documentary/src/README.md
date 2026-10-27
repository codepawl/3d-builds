# Case file: Plainfield, Wisconsin, 1954-1984

An interactive case file of the Ed Gein case, told as a map of the investigation and its clues. One plain data
model (`src/data.js`: places, victims, people, events with dates and confidence marks, clues, quotes, sources) drives
the 3D view, the timeline and the caption. Every fact comes from `drafts/hold/true-crime-map/ed-gein-facts.md`; its section 5
lists what never appears.

## Run

```
npm install          # pinned exact versions
npm run prep         # optional: rebuild public/data/map.json from the traced GeoJSON
npm run dev          # http://localhost:5432
```

Stack: Vite 8.3.4, React 19.3.0, three 0.186.1, @react-three/fiber 9.8.1, @react-three/drei 10.7.9,
@react-three/postprocessing 3.2.0 (N8AO ambient occlusion, bloom, film grain, vignette), soft shadows.

## Using it

A lean visualization, not an app with panels. On screen there are only three things over the 3D scene:

- **Time**: the date, large, top left; on 16 Nov 1957 the hour beside it in red (morning, about 9:30 AM, about
  5:00 PM, evening, that night; all approximate) and a thin 6 AM to midnight rail with the hour stops. Under it the
  thin 1940-1984 rail: past stops filled, the current one red, later ones hollow. A play button starts and pauses;
  the sound toggle sits at the right end.
- **The event**: one caption line at the bottom for what is happening now (`src/beats.js`, shortened from the event
  texts in `src/data.js`). Only a disputed [D] or later-sources [SEC] fact carries its mark icon.
- **The scene**: boxed spaced-caps labels on places and people; the victims' names appear as labels at their date
  (Mary Hogan on the tavern, Bernice Worden on her store) and together at the end.

It plays by itself after the opening: each moment's beat plays, then the next moment follows. Clicking a stop jumps
there and keeps playing; space pauses; the arrow keys step. Every animation runs on the time since its shot began, so
selecting a moment again, forward or back, replays it. The gate is unchanged: `visibleAt(item, moment)` over the
`FIRST_KNOWN` table in `src/data.js` decides which marks, places and names a moment shows.

The facts known so far and their sources are not on screen by default: press **S** for the sources overlay (Esc or S
closes it), or read them in `src/data.js` and below.

What each moment does (`src/beats.js` lists the shots, `src/world.jsx` the behaviour; exterior only throughout):

| Moment | Behaviour |
|---|---|
| 1940-1952 | the farm mark lights on the county map; 1947-52 the whole county |
| 8 Dec 1954 | the Pine Grove area ring and Mary Hogan's name light; then a generic tavern (lot unknown) at dusk: a customer's car pulls up, a grey silhouette walks to the door, it opens on red light. No figure of the victim |
| 16 Nov, morning | snow falls on Main Street, roofs dusted; two deer-season vehicles drive through; the store truck stands at the rear; Bernice Worden's name on her store |
| about 9:30 | the generic pickup pulls out of the store's rear lot and drives off |
| about 5:00 PM | Frank Worden's white silhouette walks to the front door, the door opens, the windows turn red from inside |
| evening | the sales slip floats up from the counter as a paper card; deputies walk in; then the red line draws itself along the traced road from the store to the farm |
| that night | three blue police lights with headlights drive the road; a generic West Plainfield building: Gein, a grey silhouette, is walked to a police car whose door closes; the farm: cars arrive, flood lamps switch on one by one, blue deputies walk the yard |
| 21 Nov | a car light drives from Plainfield to Wautoma; the courthouse outline lights |
| 25 Nov | small lamp points come on around the Plainfield Cemetery mark; no graves are shown |
| Dec 1957 / Jan 1958 | a red arrow from Wautoma pointing off the county toward Waupun |
| 20 Mar 1958 | the farmhouse flickers orange, fades, and leaves a faintly glowing footprint |
| 1968 | the camera rests on the courthouse |
| 1984, end | Mendota; then every mark with both victims' names |

Portrait (aspect below 1, the vertical film): the date and hour centred at the top, the hour rail and the year rail
under them, the caption above the bottom edge, a wider lens with the projection centre a little low, and portrait
camera variants for the road and the truck so the subject stays in the narrow frame.

Interface sound (`src/sound.js`, Web Audio, synthesized): a soft deep click on real clicks, a heavier 44 Hz hit with a
faint bell when a moment reveals new places or names.

## Tools

- `tools/prep_map.mjs`: converts the GeoJSON to local metres, drops 1,553 short isolated road pieces (letters of
  map labels the tracer kept), and routes store to farm along the traced roads (Dijkstra, with bridges over small
  trace gaps and the Coloma/Wautoma quad seam).
- `tools/shoot.mjs`: screenshots of the required views at 1920x1080 by real clicks, fps per scale.
- `tools/check.mjs [width height scale]`: pauses the autoplay, selects every moment by a real click and screenshots
  each shot late in the shot into `shots/check/` (portrait: `shots/check-portrait/`). Reports overlaps between the
  timeline, the caption and the visible labels, labels cut by the frame edge, the caption size in frame pixels and
  at a 360 px thumbnail, and its line count (one in landscape, at most two in portrait). Default is the film page,
  960 x 540 at 2x; portrait: `node tools/check.mjs 540 960 2`.
- `tools/film.mjs [vertical]`: the 45 s film on a virtual clock (rAF, performance.now and Date.now replaced; 1/30 s
  per frame), driven by real mouse moves and clicks with a small visible cursor. Three clicks only: Play on the
  PLAINFIELD, WISCONSIN 1957 panorama, 8 Dec 1954, and the whole case after 1968; the autoplay does the rest. The log
  records every moment and reveal for the sound. Landscape records a 960x540 page at 2x, `vertical` 540x960 at 2x. Run it from a
  Bash shell: started through PowerShell's Start-Process, Playwright did not find its browser here.
- `tools/sound.mjs [vertical]` then `tools/encode.ps1 [-Vertical]`: sound, then `shots/film.mp4` and
  `shots/film-web.mp4` (or `film-vertical.mp4` and `film-vertical-web.mp4`) at below-normal priority.

## Sources and licences

On screen, only the traced map and our own models appear. Reference material:

| Material | Use | Licence |
|---|---|---|
| USGS historical topographic quads: Coloma 1958, Whiting 1957, Amherst 1957, Wautoma 1959 (1:48,000) | traced into `public/assets/map/*.geojson` | Public domain (US government work) |
| Sanborn Fire Insurance Map, Plainfield, Aug 1908, sheets 1-3 (Library of Congress sanborn09664, via Wikimedia Commons) | Main Street lots and footprints | Public domain |
| "Plainfield Wisc - 1923" (Wikimedia Commons) | the 1923 stone bank | Public domain |
| 1949 Ford Custom Tudor, by Sicnag; 1949 Ford Tudor, by Don O'Brien (Wikimedia Commons) | Ford sedan model | CC BY 2.0, attribution as listed |
| 1953 Ford F-100 Deluxe Cab Pickup, by Sicnag; 1953 Ford F-100 Pickup, by Bob P. B. (Wikimedia Commons) | the generic pickup (make of the store truck unknown) | CC BY 2.0, attribution as listed |
| Detroit Police car in 1955 (Wikimedia Commons) | police car model | Public domain |
| OpenStreetMap (Nominatim, Overpass, queried 2026-10-18) | place coordinates in the fact file | ODbL, (c) OpenStreetMap contributors |
| LEMMiNO, "The Enduring Mystery of Jack the Ripper" | style study only (frame sheets in references/lemmino); nothing copied, nothing shown | not redistributed |

Case facts: Wikipedia "Ed Gein" and the 1944-1968 newspapers it cites, Isthmus (2007), Sheboygan County Historical
Research Center, Hanneman Archive (2014), Up North News, edgeinstory.com and Simple Wikipedia, as listed in the
sources overlay (S key) and `SOURCES` in `src/data.js`. No 1957-68 paper was read first-hand.

Sound: made locally; the only recordings are the CC0 footsteps and wind in `tools/sounds` (credits in its CREDITS.md).
`tools/sound.mjs` mixes, with ffmpeg synthesis, a soft 44 Hz hit with a faint 659 Hz bell on each reveal; the app's
soft deep click on every click frame of the film; and the score from `tools/music.py` (numpy, `uv run --no-project --with
numpy python tools/music.py <seconds> <sections.json> <out.wav>`). In the documentary the score is sectioned by
`SCORE_SECTIONS` in `script.js` (the shots marked `score`) and crossfades at each section's first cut: a music box over a
warm pad (opening and childhood), slow low piano over a string-like pad (the family deaths), a quickening low pulse and
tick under a dissonant pad (the crimes), a heartbeat and one low hit on the arrest, cold high tones with a rare low piano
note (law and institutions), and a held A minor chord at the end. There is no drone, no noise bed and no tape hiss. The
full mix is measured with EBU R128 and set to -19 LUFS integrated, limited below -1 dBFS.

## Known gaps

- The terrain relief is illustrative (shaped from water, not measured); it is kept very low and never labelled.
- Section lines and village blocks from the trace are sparse, so the map is drawn from roads, water, building dots
  and places only.
- The tavern and grocery models are shown only in their own generic scenes, labelled "generic building, lot
  unknown"; on the county map those places stay a mark and, for Pine Grove, an area ring. The cemetery model is not
  placed.
- The store's 1957 building and use are not documented; it is the 1908 lot 630 building.
- Staged, not documented: the snow on 16 Nov, the two deer-season vehicles, the customer who finds the tavern, the
  paths the silhouettes walk, the order of the night shots (the caption marks it disputed), and the route the
  21 Nov car takes (drawn as a moving light only, no line).

## The documentary (film.html)

A second page, `film.html`, is a documentary of about 187 s from Ed Gein's birth (27 Aug 1906) to his death
(26 Jul 1984), with no app UI: 3D scenes, slow camera moves, hard cuts and letter-spaced type (a large date, one line,
and a name card for each of the two women). Only three dips to black: after the 1940-1954 family section, before July 1984, and the
end. Text fades in and out over 0.3 s, and `script.js` lengthens every shot until each piece of text (caption, card,
map label) stays fully readable for at least 1.2 s + 0.07 s per character; that rule sets the film's length.
People are solid glowing silhouettes in the LEMMiNO manner (one flat unlit colour, no visible joints, soft bloom) in
period clothing: work coat and cap for Ed, a long dress for Augusta, coat and fedora for George and townspeople, a coat
for Frank Worden, uniform jacket and campaign hat for deputies, a hospital robe for Ed in old age. Ed Gein is amber at
every age, George green, Augusta violet, Henry teal, Frank Worden off-white, deputies blue, townspeople grey. Neither
woman appears as a figure, and no figure of Gein shares a scene with either of them. Shots and text are in
`src/film/script.js`, scenes in `src/film/scenes.jsx`, the figures in `src/film/Mannequin.jsx`. Open
http://localhost:5432/film.html (`?at=30` starts 30 s in). Buildings that matter in a shot get a glowing edge: red for
the two crime sites, amber for the farm, warm for the courthouse, pale blue for the hospital. Map shots get their sound from their own animation (`mapCues` in `script.js`): a pen-scratch sweep that follows each
red line's easing and brightens as it draws, a muted thump with a soft ping as each red X lights, a tiny tick per plate
and a low swell on pull-outs. Sound effects (door, engines, siren,
fire, generator, gavel, clock) are synthesized by `tools/sfx.py` from the `sfx` cues of each shot; wind is the recorded
CC0 wind, only in exterior shots, at a low level. Footsteps: `Mannequin.jsx` logs every footfall (film seconds, figure,
distance to the camera) to `window.__footfalls`; `node tools/film.mjs life dry [vertical]` replays the film without
capturing frames to refresh that list in the film log, and `sfx.py` puts one recorded step on each footfall (a steps
cue only gives the surface and gain for its window). `src/film/joinery.js` lays frames,
mullions and muntins over every window pane of the app's models (a shop window also gets a transom bar), and replaces
each model door with one clean door (casing, panelled leaf, glass only in an upper lite). A door that opens (the
hardware store, the tavern) has a real opening: `cutDoorway` in `scenes.jsx` clips the wall, glass and window quads
behind the leaf and fills the hole with a shallow dark vestibule; at 5 PM the store's red light lights its back wall
and spills over the threshold. No interior detail is shown.
The family section (1940-1954) is exterior only and keeps section 5's one line on the sealed rooms: George's burial at
Plainfield Cemetery (a graveside group, a block-built 1930s hearse beyond the gate, headstone GEORGE P. GEIN 1873-1940),
the 1944 brush fire, the burnt marsh that night (smoke and embers, no figure), Henry's stone (HENRY GEIN 1944; his birth
year is not in the fact file), Ed carrying firewood in and out of the lit farmhouse in snow, the 29 Dec 1945 crane-out,
Augusta's stone (AUGUSTA GEIN 1945) in snow, two upstairs windows going dark for good while the kitchen window stays lit,
and Ed shovelling a walk in town (odd jobs, Oshkosh Northwestern, 18 Nov 1957).
Map shots (`src/film/MapScene.jsx`, scene `map` in `script.js`, label words in `src/film/mapLabels.js`) tie the places
together: the app's traced county map (`public/data/map.json`, section lines, relief) on black with its edges feathered
into the background, red X marks, letter-spaced names on LEMMiNO plates (near-black box, thin light border, a leader line where the plate sits away from its mark) and a red line drawn along each move. Places and distances come
only from section 1 of the fact file. La Crosse County, Waupun and Madison have no distance there: La Crosse is the
start of a line from the west, Waupun and Madison are red arrows from Wautoma pointing off the county, each marked
"off this map" with no number.
The tavern (8 Dec 1954) stands on a generic two-lane country road with a crossroad, a gravel lot with two 1950s cars,
utility poles, a mailbox, a plain TAVERN board and a beer sign, a windbreak and one distant farm; the lot is unknown,
so nothing implies an address. The next shot pushes in through the open door into the empty tavern (scene
`tavernInterior`), furnished as a generic 1954 country tavern with no brand names: knotty-pine walls, plank floor, the
bar with a brass foot rail and six stools, a back bar with a mirror, bottles of several shapes and colours, stacked
glasses, taps under an ON TAP sign and a radio, beer cases (BEER, LAGER) under a frosted night window, a pool table under
a swaying lamp with a cue rack, a dartboard, mounted antlers, a wall clock, coat hooks with a coat and a hunting cap, a
wall telephone, tables with ashtrays and bottles left on them, a jukebox whose front pulses, a cigarette machine, a
wood stove with flickering embers, a DECEMBER 1954 calendar, a small wreath, a buzzing BEER neon and dust motes in the
lamp light. Nobody is
inside. The evidence is abstract: a red light pool, a marker plated SPENT SHELL CASING and a dotted red line plated
TRAIL TO THE DOOR (Isthmus, 2007). The room is lit dim but readable: two pendants over the bar and one over the
tables, the BEER neon and the stove spilling on the walls, warm fill. The evidence sits deep in the room and the trail
stops short of the door, so the plates and dots stay above the caption band in both formats; the plates appear only
once the camera is through the door.

Every shot has its own camera move (`camera` / `portrait` in `script.js`, read by `placeCamera` in `Film.jsx`):
trucks, cranes, tilts, pans that follow a drawing line, orbits (`orbit: { center, radius, height, angles }`),
locked-off shots (from = to), pull-outs and one dolly-in (the tavern door). A move can set `ease` (inOut, linear,
slow, out, in), `delay` and `duration` in seconds, and a `via` bezier control point. The arrest shot sets `focus`
for a rack focus (depth of field) from the police car's roof light to the figures.

```
node tools/film.mjs life vertical             # frames into shots/frames-life-vertical (dev server running)
node tools/sound.mjs life vertical            # music bed, soft hits and scene effects (tools/sfx.py, cues in script.js) -> shots/sound-life-vertical.wav
powershell tools/encode.ps1 -Name life -Vertical   # shots/life-vertical.mp4 and life-vertical-web.mp4
```

Leave out `vertical` / `-Vertical` for the 16:9 version (`shots/life-wide.mp4`).
