# Falcon 9: research notes (read 2026-10-12)

## Sources read in this session

- SpaceX, Falcon 9 vehicle page, https://www.spacex.com/vehicles/falcon-9 (rendered in headless Chrome;
  plain fetch returns only a script shell). Height 70 m, diameter 3.7 m, mass 549,054 kg; first stage with
  nine Merlin engines and Al-Li tanks of LOX and RP-1; interstage is composite and houses the pneumatic
  pushers; four hypersonic grid fins at the base of the interstage move the centre of pressure; second stage
  with one Merlin Vacuum engine that ignites a few seconds after separation; carbon composite fairing,
  13.1 m by 5.2 m, jettisoned about 3 minutes into flight. The live counters (missions, landings,
  reflights) rendered as 0 in the headless browser, so no count is used.
- SpaceX, Falcon User's Guide (2025-05-09),
  https://www.spacex.com/assets/media/falcon-users-guide-2025-05-09.pdf. Common dome between the LOX and
  RP-1 tanks and a LOX transfer tube through the RP-1 tank; four grid fins near the top and four deployable
  legs at the base; nine M1D at up to 845 kN each, eight round a centre one; held down after engine start
  until systems check out; throttle 190,000 to 108,300 lbf; MVac with a fixed 165:1 nozzle; cold nitrogen
  thrusters (first stage: recovery only); stages latched at three points, helium releases them, four
  pneumatic pushers; fairing halves on latches along a seam, four pushers; sample timeline T+74 s max Q,
  T+147 s MECO, T+151 s separation, T+158 s SES-1, T+222 s fairing separation. The guide also has a
  superlative about thrust-to-weight; it is not used.
- Wikipedia, "SpaceX reusable launch system development program": booster flips, optional boostback burn,
  reentry burn, landing burn.
- Wikipedia, "Autonomous spaceport drone ship": a modified ocean-going barge with propulsion to hold
  position and a large landing platform.
- Wikipedia, "Falcon 9": Flight 23, CRS-8, first successful landing on a droneship.
- Wikipedia, "SpaceX Merlin" (the old "Merlin (rocket engine family)" title redirects there).

## Chosen for the model (status inferred, fact `model-values`)

- Upper stage plus payload 126.5 t, booster dry 25.6 t, the rest booster propellant; one average specific
  impulse of 300 s for the first stage, 348 s for MVac; first-stage thrust held at its sea-level value.
- Drag areas 3.6 m2 for the stack, 22 m2 for the falling booster (fins and legs, engines first); air
  density 1.225 kg/m3 with an 8.5 km scale height; flat Earth, one vertical plane.
- Pitch: vertical to T+9 s, a 4 degree kick by T+22 s, then along the velocity (gravity turn).
- Throttle bucket to 70% from T+52 s to T+96 s; max Q then comes out of the integration near T+56 s
  (the guide's sample says T+74 s; the model's peak is earlier).
- Recovery: flip on the nitrogen thrusters to T+168 s, a 15 s three-engine boostback, grid fins out from
  T+175 s, a three-engine entry burn below 52 km that removes 900 m/s, a one-engine landing burn throttled
  to stop at the deck, legs swung down below 260 m.
- The droneship sits where the steered booster comes down; the fins steer toward the unsteered touchdown.
- Playback: real time on the pad, then compressed between 10x and 150x, slower for the landing burn.

## Drawing choices

- Lengths between the sourced heights are estimated (`drawing-proportions`); LOX tank above RP-1 because
  the LOX transfer tube runs through the RP-1 tank to the engines.
- Plumes are drawn as tapered flames that lengthen with throttle and widen in thin air; not real shapes.
- The droneship and launch mount are drawn small and plain; distances to them are squeezed.

## Revision 2 (2026-10-12): the pad and the flame

- User's guide: SLC-40 has "a launch pad, and lightning towers"; SLC-40 and LC-39A have "overhead wire
  lightning protection systems"; "The transporter-erector strongback is retracted just prior to launch";
  engines light "while the vehicle is held down at the base via hydraulic clamps", released at T-0.
- Wikipedia "Cape Canaveral Space Launch Complex 40" read; it does not describe the lightning towers or the
  trench, so the trench, mount and tower placement are drawn plain (`pad-drawing`, inferred).
- Wikipedia "Shock diamond": standing waves in a supersonic plume in an atmosphere. The kit's plume shows
  them at low altitude and fades them as the air thins (`plume-drawing`, inferred).
- The strongback retracts over about a second of film; in reality it is minutes (time is compressed).

## Revision 3 (2026-10-12): the real SLC-40, the plume, the landing

Pad chosen: SLC-40, kept over LC-39A. It is the pad the figure already names, SpaceX's "workhorse"
Falcon 9 pad (Wikipedia), and NASA's 2024 Crew-9 rollout photographs show it clearly from the side.
LC-39A is the old Apollo/Shuttle pad with the Fixed Service Structure; it would read as "NASA", which is
the confusion the owner pointed at.

Sources read this session:
- Wikipedia, "Cape Canaveral Space Launch Complex 40",
  https://en.wikipedia.org/wiki/Cape_Canaveral_Space_Launch_Complex_40: "in early 2023, SpaceX began
  constructing an access tower at SLC-40"; "In February 2024, SpaceX tested its new emergency escape
  system ... which uses an evacuation slide instead of the slidewire baskets used at LC-39A"; first crew
  launch from SLC-40, Crew-9, September 2024; a landing zone (LZ-40) inside the complex since 2026.
- Reference images in `reference/images/` (URLs in `sources.json`), all opened:
  - pad-1.jpg, SLC-40 aerial, SpaceX 2010: four lattice lightning towers, two either side of the pad, the
    mount at the centre, hangar off to one side, a ring road.
  - pad-2.jpg, CRS-7 on SLC-40, SpaceX 2015: grey lattice erector right beside the rocket up to the
    payload, the raised mount, lightning towers with white masts on their tops and wires between them.
  - pad-3.jpg, Crew-9 rollout, NASA 2024: the rocket being raised on the erector, which pivots at its foot
    by the mount; the black square access tower, about as tall as the towers' lattice; both tower pairs,
    each mast joined to the opposite pair by a sagging wire, with guys to the ground.
  - pad-4.jpg, Crew-9 on the pad, NASA 2024: erector lattice with its arms on one side of the stack, the
    access tower's swing arm with its white room on the other.
  - pad-5.jpg, Starlink 6-35 climbing, U.S. Space Force 2024: plume glow and trail at altitude.
  - booster-landed.jpg, octaweb.jpg: a landed first stage; the engine section, eight bells round one.
- Read off pad-3 (inferred, `photo-*` facts): crew tower about 78 m, tower lattice about 74 m and masts to
  about 96 m, estimated against the 70 m rocket. The tower pairs stand much farther out than drawn; they
  are drawn 30 m either side of the rocket so the pad fits the frame (`pad-drawing`).
- Not shown in any image read: the trench's inside and the water deluge. The trench is drawn as one duct
  opening away from the erector; no water tank is drawn.
- Drawing: erector on the right of the rocket with rails and lifting rams, tilting back 7 degrees before
  ignition (angle chosen); access tower on the left with its arm swung away (no crew on this flight) and a
  plain chute for the slide; exhaust cloud leaves toward the front left.

Plume: one cluster plume over the nine engines (exit radius of the whole ring) carries the halo, body and
six shock diamonds, so the diamonds read at film size; the nine single plumes stay as narrow bright cores.
Kit `plume()` gained a halo (soft wide envelope for depth), a narrower brighter core and larger diamonds.

Landing: the droneship's height is squeezed at 26 m instead of 140 m, so the booster and the deck sit in one
frame through the landing burn. Fairing separation plays at 4x (was 55x) for six seconds of flight.

## Revision 4 (2026-10-12): arms, honest time, the top of the rocket, the engines that land

Sources read this session:
- Wikipedia, "Falcon 9 first-stage landing tests", https://en.wikipedia.org/wiki/Falcon_9_first-stage_landing_tests:
  "SpaceX was reigniting the engines three times ... (although only three of the nine engines were used): a
  boost-back burn, a reentry burn, and a landing burn"; the reentry burn runs "from approximately 70 to 40 km".
- Wikipedia, "SpaceX reusable launch system development program",
  https://en.wikipedia.org/wiki/SpaceX_reusable_launch_system_development_program: "a total of four burns for
  the center engine"; "a shorter landing burn with three engines instead of the single-engine burns seen in
  earlier attempts" (so the one-engine landing drawn here is one of two real profiles).
- Wikipedia, "Falcon 9", https://en.wikipedia.org/wiki/Falcon_9: "the fairing halves are scooped out of water
  after a parachute-assisted landing and can be reflown multiple times."

Chosen for the model (`model-values`): the booster's turn is limited by its actuator, 0.12 rad/s (about 7 deg/s)
on the nitrogen thrusters, 0.22 rad/s with an engine burning, 0.3 rad/s on the grid fins in air. The flip
window runs T+158 to T+182 so that turn can finish; boostback T+182 to T+197; fins out at T+199.

Film time: the readout shows "time ×N" whenever the film is not at real time (N = playback rate times the
film's slow-motion speed); the rate eases between values. The film is 35 s instead of 30 s so the flip
(about 3 s of film at ×8), the entry burn (about 1.4 s at ×12) and the landing burn (about 4 s at ×3.4) are
readable.

Drawing: erector arms drawn heavy, reaching a clamp pad on the skin, riding the beam as it tilts away. The
access tower's swing arm stays swung away: it reaches only Dragon flights (pad-3, pad-4 are Crew-9), and
this flight carries a fairing. Lightning tower pairs stand on a line turned 45 degrees to the camera, so
both towers of each pair show (equivalent to choosing that viewing azimuth). Merlin bells larger and dark,
the octaweb dark with a heat shield edge and four leg hinge brackets (octaweb.jpg).
