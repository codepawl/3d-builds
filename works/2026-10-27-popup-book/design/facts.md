# Facts and sources: How Big Things Work (pop-up book)

Status: **measured** = read in a source opened this session (2026-10-27, English Wikipedia plain-text extracts saved in
`research/`); **derived** = our own arithmetic; **recalled** = from memory, not verified; **placement** = our drawing choice.

## Pop-up engineering (what the build copies)

- Terms used by the page text (movables, volvelles with grommets, flaps, pull-tabs, tunnel books, pop-ups): measured, Wikipedia "Pop-up book". Volvelles go back to Matthew Paris (Chronica Majora, from 1240) and Apianus (1540): measured.
- Mechanisms in the build (second pass): a staircase of **parallel-fold layers** (each wall hinged on the lower leaf, its roof a step that stays parallel to the lower leaf and is tied to the wall of the next taller layer behind it, the tallest to the upper leaf: a chain of parallelogram linkages, so no roof passes through a wall), **box folds** (wall, roof and two parallelogram cheeks; the Titanic ship is starboard wall, port wall, deck and cheeks), **V-folds** standing on a roof (funnels, chimney, cooling tower; two panels joined at an apex, solved as a circle intersection each frame, with paper smoke and steam curls that grow last), a **recessed box** behind the boiler window (four reveal cards that reach the wall behind), a **pull-tab** slider, a **lift flap** with a glued patch under it, a **volvelle** on a grommet, a **tunnel** of three nested arches, and **lecterns** (solid wedges with a printed slope card) that carry the short margin texts. Layers rise one after another because each wall trails the far leaf by a few degrees midway through the opening (a drawing choice that stretches roofs by a few percent for a moment). How Sabuda or Reinhart build theirs was not researched beyond the Wikipedia names; the linkage geometry is our own and follows the same folding logic.
- Placement: the lower leaf is a sea apron; real pop-ups use a dozen glue points and slots we did not draw. The funnel panels and the page 2 tower and stack fold down (shorten) near a closed book instead of folding flat at fixed length. That is a drawing shortcut, not paper physics.

## Page 1: RMS Titanic

| Fact on the page | Status | Source |
|---|---|---|
| Built by Harland and Wolff, Belfast; 46,329 GRT; 269 m long | measured | Wikipedia "Titanic" |
| 16 primary compartments, 15 bulkheads; 11 vertically closing watertight doors on the orlop deck, closed from the bridge | measured | same |
| Only eight of the fifteen bulkheads reached D deck (the highest level any reached) | measured | same, D Deck paragraph |
| Could not remain afloat with more than four compartments flooded; five heavily breached and a sixth slightly | measured | same, sinking paragraph |
| Water spilled over the top of each bulkhead, compartment to compartment, as the angle steepened | measured | same |
| 29 boilers (24 double-ended, 5 single-ended), 159 furnaces; each 4.80 m diameter, 6.1 m long, 91.5 t, held 48.5 t of water | measured | same |
| Over 600 t coal a day, 176 firemen, 100 t ash a day into the sea | measured | same |
| Two four-cylinder triple-expansion engines 30,000 hp combined, 63 ft long, 720 t each; central low-pressure Parsons turbine 16,000 hp | measured | same |
| 20 lifeboats (14 wooden, 4 collapsible, 2 emergency cutters); 1,178 capacity; 16 sets of davits could handle 48 boats; 2,208 aboard | measured (the page's lifeboat counts differ between two paragraphs: 14+2+4 and "16 wooden + 4"; we print 14, 4 and 2) | same |
| A deck promenade 546 ft (166 m); E deck "Scotland Road"; F deck pool and Turkish bath; G deck lowest portholes, squash court, post office; tank top carried boilers and engines | measured | same |
| Boiler working pressure about 215 psi (15 bar) | **recalled, not verified**: not in the extract; it is printed on the volvelle with that mark | none |
| "A triple-expansion engine passes the same steam through three cylinders at falling pressure; the turbine ran on the low-pressure steam beyond them" | general engineering; the turbine being fed exhaust steam is **not stated in the extract** | none |
| Room positions in the cutaway | placement (from `titanic-plate/facts.md`, itself inferred) | |

The ship image is the Titanic plate renderer's side view (`tools/capture-plate.mjs` renders `plate-src/`, a copy of
`titanic-plate/web`, and cuts the ship out of the paper). The plate's figures, rooms and callouts code is copied in
`plate-src/`; this book uses its render, not the callouts.

## Page 2: steam power station

| Fact on the page | Status | Source |
|---|---|---|
| Rankine cycle has four processes; pump work is often around 1 % of turbine work | measured | Wikipedia "Rankine cycle" |
| 170 bar and 570 degrees C plants run at 35 to 38 %; subcritical 36 to 40 %; supercritical low to mid 40s; best fossil 46 % | measured | Wikipedia "Thermal power station" |
| Waste heat leaves through the condenser to cooling water or cooling towers | measured | same |
| Stations make three-phase current at 50 Hz or 60 Hz | measured | same, and "Utility frequency" |
| 3,000 rpm for 50 Hz and 3,600 rpm for 60 Hz (two-pole generator) | derived: rpm = 120 f / poles | |
| Turbines replaced reciprocating engines in power stations after about 1905 (speed, size, steady speed for parallel running) | measured | "Thermal power station" |
| Tallest cooling tower: Pingshan II, Huaibei, Anhui, 210 m | measured | Wikipedia "Cooling tower" |
| Station layout (boiler house, turbine hall, generator, condenser, control room, yard) and the steam loop path | placement; a generic plant, no real station | |
| The paper "strip" that carries the steam marks is drawn by the page, not a physical strip | placement | |

## Added in the second pass

- Page 1 backdrop caption "Sunday 14 April 1912, the North Atlantic, a clear and moonless night": **recalled, not verified** (not in the saved extract). The stars, the Milky Way band and the sea line are drawn, not astronomy.
- The iceberg off the bow is a drawn box-fold berg (a tabular block), not a model of the real one; the page's lectern text only says that it opened five compartments (measured, "Titanic").
- Lectern texts are short copies of rows already in the tables above; the turbine-on-spent-steam line stays general engineering, as before.
- Page 2: the town, the sun, the hills and the pylon line on the backdrop and hills strip are decoration; the layout of boiler house, turbine hall and control building is a generic plant (placement).
