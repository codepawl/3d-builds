// Writes the reference sheets (refs/<asset>.md) and appends each one's image list from manifest.json.
// Usage: node blender/refs/write_sheets.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const refsDir = dirname(fileURLToPath(import.meta.url));
const wiki = "https://en.wikipedia.org/wiki";
const manifest = JSON.parse(readFileSync(join(refsDir, "manifest.json"), "utf8"));

const sheets = {
  booster: { images: ["booster"], text: `# Booster (first stage) - reference sheet

**Real type:** fully reusable super-heavy first stage, stainless-steel cylinder, methane and oxygen, many sea-level
engines, grid fins for return, caught by tower arms. Our design: "Kestrel" booster, own names, no livery.

| Dimension | Value | Source |
|---|---|---|
| Height | 71 m (Block 1/2), 72.3 m (Block 3); ours 71 m | ${wiki}/SpaceX_Super_Heavy (refs/text) |
| Diameter | 9 m | same article; second: booster-02, barrel ring 1.83 m (article) counted against the width, ratio matches |
| Barrel rings | 1.83 m tall, 33 rings | same article |
| Engines | 33 in three rings (3 / 10 / 20) | article (33); ring split inferred from the 9 m skirt |
| Grid fins | 4, about 6 m wide x 4.5 m tall, top 9 m of the stage | count from Block 2 photos (booster-02, ship-04; article says 3 on Block 3); size measured against the 9 m body (inferred) |
| Hot-stage ring | about 1.8 m vented interstage on top | booster-02 (vent slots), height = one ring (inferred) |
| Catch pins | 2 hardpoints under the fins | ship-04, booster-03 (inferred) |

**Proportions:** height to diameter 7.9:1; fins in the top 12 % of the length; engine skirt about 4 m (bottom 6 %);
two chines 180 degrees apart along 85 % of the length.

**Parts (bottom to top):** 33 engine bells inside a skirt with a heat-shield rim, aft bay vents, LOX barrel with ring
weld lines, common dome line, methane barrel, two chines, catch pins, grid fins (move, pivot at the hinge), top dome,
vented hot-stage ring. Moving parts: fin_0 to fin_3.
` },
  ship: { images: ["ship", "booster"], text: `# Ship (second stage) - reference sheet

**Real type:** reusable stainless upper stage with flaps for a belly-flop descent and a hex-tile heat shield on the
windward half. Our design: "Heron" ship in crew, cargo and tanker variants, no livery.

| Dimension | Value | Source |
|---|---|---|
| Height | 52.1 m (Block 2), 50.3 m (Block 1); ours 52 m | ${wiki}/SpaceX_Starship_(spacecraft) (refs/text) |
| Diameter | 9 m | same article; second: ship-03, two ships beside 9 m tanks (photo ratio) |
| Nose ogive | about 17 m of the height | ship-01, ship-03 against the 9 m diameter (inferred) |
| Forward flaps | 2, about 5 m long x 3 m | ship-01, ship-03 (inferred) |
| Aft flaps | 2, about 9 m long x 4.5 m | ship-01, ship-03 (inferred) |
| Engines | 6: 3 sea-level (1.3 m bells) + 3 vacuum (2.3 m bells) | engine count from the article; bell sizes inferred from the skirt |

**Proportions:** height to diameter 5.8:1; ogive 33 % of the height; aft flaps on the bottom 20 %; tiles on half the
circumference from nose to skirt.

**Parts:** 6 engines and skirt, aft flaps (move), barrel with ring lines, heat-tile half shell (darker), chines,
forward flaps (move), ogive nose, cargo door (cargo) or window band (crew) or plain (tanker), vents, QD plate.
` },
  tower: { images: ["tower", "booster"], text: `# Catch tower - reference sheet

**Real type:** steel lattice launch-and-catch integration tower with a vertical carriage carrying two catch arms and
a ship quick-disconnect arm. Our design: own lattice, arm and roof shapes.

| Dimension | Value | Source |
|---|---|---|
| Height | 146 m (FAA no-hazard determination) | ${wiki}/SpaceX_Starbase (refs/text) |
| Height, second estimate | 140-150 m, about 16 stage diameters | tower-03, booster-03 against the 9 m vehicle (inferred) |
| Section | about 12 m square truss in 9 stacked modules | tower-02, tower-03 (modules counted, size from the 9 m booster) |
| Catch arms | about 36 m long, 4 m deep truss, pivot on the carriage | tower-01, tower-03, ship-04 (inferred) |
| QD arm | about 20 m, near 100 m height | tower-01, tower-03 (inferred) |

**Proportions:** height to section 12:1; arms 3 tower widths long; carriage 1.5 modules tall; QD arm 0.55 of the arm
length; lightning mast about 10 m above the roof.

**Parts:** foundation block, 9 lattice modules with X bracing and corner columns, stair and lift shaft, cable trays,
carriage (moves up and down), two catch arms with rails and shock pads (rotate about the carriage hinges), QD arm
(swings), roof crane frame and pulleys, lightning mast, obstruction lights. Moving: carriage, arm_left, arm_right,
qd_arm. Variant tower_build: 5 modules standing (the pad under construction).
` },
  launch_mount: { images: ["launch_mount", "tower"], text: `# Launch mount - reference sheet

**Real type:** elevated orbital launch mount, a launch table on six legs with hold-down clamps, a booster
quick-disconnect and a water-cooled steel flame deflector (deluge) under it. The suborbital test stand is our
smaller derivative of the same type (no usable test-stand photos were found; see gaps in ASSETS.md).

| Dimension | Value | Source |
|---|---|---|
| Launch table mass | 370 t | ${wiki}/SpaceX_Starbase (refs/text) |
| Table height | about 20 m above the pad | launch_mount-01, person 1.8 m against a leg (inferred, 11 people) |
| Table ring | 9 m inner, about 17 m outer, 4 m deep | launch_mount-01, tower-02 against the 9 m booster (inferred) |
| Legs | 6, about 3 m square | launch_mount-01, tower-02 (counted with the hidden side) |
| Deluge plate | about 18 m across, water ports | launch_mount-02 top view (inferred) |

**Parts:** concrete pad, six legs with gussets, table ring with 20 hold-down clamps, booster QD arm (moves), deflector
plate with water ports and feed pipes, walkways and railings.
` },
  tank_farm: { images: ["tank_farm"], text: `# Propellant tank farm - reference sheet

**Real type:** cryogenic ground-support tank farm: vertical double-wall tanks (LOX, liquid methane, liquid nitrogen),
horizontal bullet tanks, a spherical tank on legs, ambient-air vaporizer banks, pump skids, pipe racks.

| Dimension | Value | Source |
|---|---|---|
| Horizontal LOX tank | 95,000 gal (360 m3), about 3.7 m dia x 34 m | ${wiki}/SpaceX_Starbase (refs/text), size from the volume |
| Vertical tank | about 9 m dia x 30 m | tank_farm-01 against a tanker trailer about 4 m tall (inferred); tank_farm-02 |
| Spherical tank | about 20 m dia on 10 legs | tank_farm-04 (NASA LC-39B sphere), 2.4 m fence (inferred) |
| Vaporizer | 1.2 m square finned columns, 8 m tall | ambient vaporizer type (inferred, no photo in the set) |

**Parts:** plinths, vertical tanks with ring stiffeners, top domes, caged ladders, vent stacks; bullet tanks on
saddles; sphere with equator legs, cross-bracing and stair; vaporizer columns; pump skid; pipe rack.
` },
  high_bay: { images: ["high_bay"], text: `# Build yard high bays - reference sheet

**Real type:** tall steel-frame stacking buildings (high bay, mega bay) with clad walls, full-height doors and bridge
cranes inside; lower mid bays and tents around them.

| Dimension | Value | Source |
|---|---|---|
| High bay | about 25 x 30 m, 81 m tall | high_bay-01/02 against 9 m stages beside (inferred; must clear a 52 m ship plus crane) |
| Mega bay | about 45 x 60 m, 90 m tall | high_bay-02/03 (inferred) |
| Mid bay | about 40 x 80 m, 25 m tall | ship-03, high_bay-02 (inferred) |

**Proportions:** high bay height to width 3:1; girt bands every 9 m; door slot about a third of one face.

**Parts:** clad box with horizontal girt bands, full-height door slot, rooftop crane house, stair tower, vents, lights.
` },
  spmt: { images: ["spmt"], text: `# Stage transporter (SPMT) - reference sheet

**Real type:** self-propelled modular transporter, axle-line modules with pendular bogies, carrying a stage upright
on a transport stand.

| Dimension | Value | Source |
|---|---|---|
| Module width | 2.44 m | ${wiki}/Self-propelled_modular_transporter (refs/text) |
| Axles | 2 across, 4-8 along per module | same article; spmt-01/02 (counted 6) |
| Axle pitch, deck height | about 1.5 m, 1.5 m | spmt-01, spmt-02 against a person 1.8 m (inferred) |
| Wheel | about 0.9 m | spmt-02 against a person (inferred) |

**Parts:** deck modules, power pack with radiator grille, steerable bogies with twin wheels, upright stage stand.
` },
  crawler_crane: { images: ["crawler_crane"], text: `# Crawler crane - reference sheet

**Real type:** large lattice-boom crawler crane with mast and counterweight, used to stack stages.

| Dimension | Value | Source |
|---|---|---|
| Main boom | about 110 m lattice, 3.5 m section | crawler_crane-01/02 proportions scaled to a 120 m stacking height (inferred) |
| Crawlers | 2 x 12 m long, 2 m wide, 10 m gauge | crawler_crane-01/02 (ratio crawler to boom about 1:9, inferred) |
| Upper works | 12 x 8 m with cab | photos (inferred) |

**Parts:** crawler tracks, car body, upper works (slews), cab, A-frame, boom (luffs), hook block (hoists), pendants.
` },
  recovery_boat: { images: ["recovery_boat"], text: `# Recovery boat - reference sheet

**Real type:** platform supply vessel used offshore: forward superstructure, long open aft deck.

| Dimension | Value | Source |
|---|---|---|
| Length | 50-100 m class; ours 62 m | ${wiki}/Platform_supply_vessel (refs/text) |
| Beam | 14 m (length to beam 4.4) | recovery_boat-01/02 (inferred ratio) |
| Superstructure | forward third, 4 decks, about 12 m above the deck | photos (inferred) |

**Parts:** hull with bow flare, bulwarks, aft deck, A-frame, bridge windows, mast with radar, funnels, lights.
` },
  weather_tower: { images: ["weather_tower"], text: `# Weather and camera towers - reference sheet

**Real type:** lattice instrument tower with a radome or anemometer booms; tall camera masts at the pads.

| Dimension | Value | Source |
|---|---|---|
| Lattice tower | about 30 m, 3 m base, 4 m radome | weather_tower-01 (NASA, KSC), 2.4 m fence (inferred) |
| Camera mast | about 20 m pole with a sealed camera box | inferred |

**Parts:** three-leg lattice with braces, platform, radome or booms, ladder, beacon.
` },
};

for (const [name, sheet] of Object.entries(sheets)) {
  const rows = manifest
    .filter((entry) => sheet.images.includes(entry.asset))
    .slice(0, 6)
    .map((entry) => `- \`${entry.file}\` - ${entry.title} - ${entry.page} - ${entry.licence}${entry.artist ? ", " + entry.artist : ""}`);
  const body = `${sheet.text}\n## Reference images (modelling only, never shown in the app)\n\n${rows.join("\n")}\n`;
  writeFileSync(join(refsDir, `${name}.md`), body);
  console.log(`${name}.md: ${rows.length} images`);
}
