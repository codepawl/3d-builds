# Bayflow: emergency department patient flow you can play like a strategy game

A live patient-flow and capacity app for a made-up health network, Linden Vale Health, drawn as a toy isometric
diorama. It covers patient flow only and makes no clinical decisions. Three hospitals run at once, each with its own seeded simulation:

- **MP Marrow Point General, level 1 trauma centre.** 3 resus bays, 14 cubicles (a back row and a middle row),
  CT and X-ray, a lab, three ambulances and a helipad with an air ambulance.
- **AV Ashby Vale Community.** 1 resus bay, 11 cubicles, two ambulances, no helipad.
- **LH Little Harbour Children's.** 2 resus bays, 12 cubicles, two ambulances and a helipad.

The roof is off, and the front and east walls are cut low. Ambulances come along the road, turn up the drive, stop
and back under the canopy. They open their rear doors, and two paramedics roll the cot head first through the bay
doors to a free resus bay or cubicle. There the patient slides across to the department's stretcher, and the crew
walk the empty cot back and drive off. Walk-ins come up the path, check in at the kiosk, sit, are called to a triage
desk, wait for a bed and walk to their cubicle. Doctors assess and review at the bedside, nurses take bloods to the
lab and turn bays over, and porters pull stretchers out of bays and push them to CT or X-ray and back. The CT couch
slides into the bore. Porters also take admitted patients out through the covered link to the wards. The helicopter
flies in, lands, spins down and hands over the same way. Patients are covered figures with a coloured triage tag.
No injuries are shown.

All models are the Blender GLB pack in `public/assets` (see `../blender/ASSETS.md`). Every hospital name, person
and ID is made up.

## Run

```
npm install
npm run dev        # http://localhost:5430
```

Pinned stack: Vite 8.3.4, React 19.3.0, three 0.186.1, @react-three/fiber 9.8.1, @react-three/drei 10.7.9,
@react-three/postprocessing 3.2.0 (N8AO ambient occlusion, bloom on lamps, SMAA), soft shadows.

URL options: `?site=LH` opens another hospital, `?warm=200` warms the simulation for that many seconds first
(default 60).

## Using it

- Drag to orbit, right-drag to pan, wheel to zoom, or use the camera buttons on the left.
- Click any patient, bay, stretcher, ambulance, the helicopter, staff member, CT, X-ray or the lab. A pin and a
  fitted ring mark it, and the card on the right opens with live fields and a progress bar. The locate button
  flies there and follows. An ambulance that is handing over is followed by its cot. Click empty ground or press
  Esc to close the card.
- The tabs at the bottom right are Patients, Bays, Arrivals, Imaging and Staff. Clicking a row flies to that item
  and follows it.
- The strip at the bottom follows one patient's visit: arrival, triage, seen by doctor, tests, decision, then
  admitted or discharged.
- KPIs: door to doctor (median of the last 20), patients waiting, beds free, and left without being seen.
- Switch hospitals from the menu in the top bar. `/` focuses search, and Enter jumps to the first match.

## Code

- `src/data.js`: the network, the hospitals, the triage scale and the visit stages.
- `src/sim/layout.js`: floor plan, walking routes and ambulance paths for each hospital.
- `src/sim/er.js`: patients, bays, staff jobs, convoys (a stretcher with its porter or paramedics), ambulances,
  the helicopter, imaging and the lab. It is plain data and seeded.
- `src/sim/index.js`: the world. All hospitals step together.
- `src/store.js`: selection and camera commands. `src/status.js`: status labels, one icon shape per state.
- `src/scene/`: the 3D view. Repeats are instanced. Moving models are flattened clones that keep their moving
  parts (doors, wheels, rotors, curtains, backrests, the CT couch and status lamps).
- `src/ui/`: the dashboard.
- `tools/simcheck.mjs` runs the simulation headless. `tools/forecast.mjs` finds the film start time.
  `tools/shoot.mjs` takes screenshots, measures fps and checks that the people clips play. `tools/film.mjs`
  records the film.

## Film

With the dev server running, run `node tools/film.mjs`. It captures 900 frames on a virtual clock, driven only by
real mouse moves, clicks, drags and wheel events with a drawn cursor. Encode:

```
ffmpeg -framerate 30 -i shots/frames/%04d.png -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart shots/film.mp4
```
