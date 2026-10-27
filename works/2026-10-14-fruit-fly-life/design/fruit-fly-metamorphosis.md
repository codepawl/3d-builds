# Fruit fly: larva growth, pupa, eclosion (beat 4, about 8 s)

Sources, watched frame by frame with `watch-video`: "Complete Life Cycle of the Fruit Fly" (Insects Limited: larva
feeding on banana, larva turning into a pupa at 144x, adult emerging in real time, expanding wings at 12x),
"Drosophila wing expansion" (Eric Spana), "Drosophila Eclosion" (Matt Lindsay Research).
Measured = in a source; inferred = general knowledge or read off the footage. Scale here: 1 mm = 140 px.

| Stage | Look | Size |
|---|---|---|
| Feeding larva, instars 1 to 3 | white, translucent, gut dark with food; head end pointed with black mouth hooks raking forward; grows by molting twice, leaving a thin empty skin | 1 mm at hatching to about 4 mm (inferred) |
| Wandering larva | leaves the food, crawls, then stops | about 4 mm |
| Prepupa | shortens and stiffens into a barrel; segment lines stay visible | about 3 mm |
| Puparium | the larval skin hardens and turns tan then brown (footage: white to cream to orange-brown in about an hour); two anterior spiracles stick out at the head end as short stubs (about 0.1 mm, inferred) with finger-like tips; drawn longer they read as antennae (An, 2026-10-13) | about 3 x 1.1 mm |
| Pharate adult | through the darkening case: red eyes first, then dark folded wings and bristles (footage) | fills the case |
| Eclosion | the cap at the head end pops; the fly pushes out head first with a balloon on its forehead (ptilinum), pulls its legs and abdomen free (footage, real time, a few seconds) | |
| Newly emerged fly | pale, long soft abdomen, wings crumpled into small folded pads with brown vein marks (Spana footage) | |
| Wing expansion | the fly pumps blood into the wings and they unfold flat in minutes; body darkens over hours (footage, 12x) | wing about 2 mm when flat |

## Eclosion motion (real-time footage, frame by frame)

1. The cap lifts a little and drops back, several times, each lift bigger: the fly pushes from inside.
2. The cap pops and swings open on its hinge.
3. The fly comes out head first in pulses: the ptilinum (a pale balloon on the forehead) swells, the body surges,
   then slips back a little; each pulse goes further. Head and body rock side to side.
4. Once the thorax is out, the front legs flail, reach down and grab; then the legs pull the abdomen out.
5. Out, the legs settle and the wings start to unfold.

Code: `capLift`, `emergence` (five weighted pushes), `drawPtilinum`, `rock`, `legSwing` in `src/metamorphosis.js`.

Beat plan: 0 to 2.6 s the larva eats yeast and grows, molting once (an empty skin left behind); 2.6 to 4.2 s it
stops, shortens and the case browns, horns appear; 4.2 to 5.6 s the case turns see-through and the fly shows inside
(eyes first, then wings and legs); 5.6 to 6.6 s cap pops, the pale fly crawls out with crumpled wings; 6.6 to 8 s the
wings unfold flat and the body darkens.
