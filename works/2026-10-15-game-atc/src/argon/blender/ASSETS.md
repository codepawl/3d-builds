# AEROGRID ATC — 3D Asset Pack Specification (`blender/ASSETS.md`)

All 10 GLB asset families in `app/public/assets/` are procedurally modeled in Blender 5.2 (`blender/build_*.py`) with beveled edges, outward-recalculated normals (`use_backface_culling = True`), box-projected UVs, procedural PBR materials (including packed procedural grid/stripe textures and emissive lighting), and clean node hierarchies designed for `THREE.InstancedMesh` / cloned hierarchy animation in React Three Fiber.

Total pack size: **11.13 MB** across 10 `.glb` files (well below the 40 MB budget).

---

## Coordinate & Pivot Conventions

- **Export Axes**: glTF 2.0 standard (`+Y` Up, `+Z` Forward / South, `+X` Right / East in Three.js after Blender's `export_yup=True` conversion; in Blender source space `+Z` is Up and `+Y` is Forward).
- **Variant Lineup Offsets**: Each family GLB contains multiple variants placed at distinct `X` offsets at root level for contact-sheet inspection. When instantiating a variant in Three.js, reset the variant root node's local `position.set(0, 0, 0)` (or place it directly at its world target coordinates).
- **Moving Sub-Part Pivots**: Every moving child node (wheels, turbofan rotors, propellers, landing gear struts, radar dishes, radar sweep cones, hangar doors, fire bay doors, jet bridges, scissor lifts, towbars, fuel booms, LED signboards, anemometers, beacons, windsock cones, separation spinners, storm anvils) has its **local mesh origin at `(0, 0, 0)`** at the exact mechanical hinge/axle/swivel point, and is positioned via its object transform relative to its parent variant root.

---

## 1. `terrain_sectors.glb` (159.0 KB)

Stylised isometric control-sector terrain platters and modular topographic formations with layered coastal water, shallow shelf, sandy shoreline, terraced grass plains, rock ridges, and chamfered geological plinth rims.

| Root Node | Child Mesh Nodes | Real-World Scale (W × L × H) | Pivot | Placement / Usage in World |
| :--- | :--- | :--- | :--- | :--- |
| `Terrain_TowerSector` | `Terrain_TowerSector_Mesh` | `84.0m × 84.0m × 5.8m` | Center of sector platter `(0,0,0)` | Base terrain platter for **Site 1: Port Solis Tower Sector (`KPSA`)** — coastal peninsula with sandy bay, seawall revetment, graded airfield table, and low northern hills. |
| `Terrain_ApproachSector` | `Terrain_ApproachSector_Mesh` | `84.0m × 84.0m × 5.5m` | Center of sector platter `(0,0,0)` | Base terrain platter for **Site 2: Solis Bay Approach (`TMA`)** — twin coastal landmasses divided by a river estuary, suspension bridge, highway ribbon, and flanking hills. |
| `Terrain_EnrouteSector` | `Terrain_EnrouteSector_Mesh` | `84.0m × 84.0m × 10.0m` | Center of sector platter `(0,0,0)` | Base terrain platter for **Site 3: High-Altitude En-Route (`SECTOR-N`)** — regional highland basin with reservoir lake and 3-tier mountain peaks. |
| `Hill_Cluster_A` | `Hill_Cluster_A_Mesh` | `18.0m × 14.0m × 6.2m` | Ground base `(0,0,0)` | Instanced around sector perimeters and approach corridors for multi-tiered relief. |
| `Hill_Cluster_B` | `Hill_Cluster_B_Mesh` | `22.0m × 16.0m × 5.6m` | Ground base `(0,0,0)` | Instanced along northern and eastern sector boundaries. |
| `Coast_Cliff_A` | `Coast_Cliff_A_Mesh` | `16.0m × 10.0m × 4.9m` | Shoreline base `(0,0,0)` | Instanced along coastal headlands in Tower and Approach sectors. |

---

## 2. `airport_runways.glb` (1,290.7 KB)

Precision instrument runways, modular taxiway network segments, concrete gate apron pads, and approach lighting pier bridges.

| Root Node | Child Mesh Nodes | Real-World Scale (W × L × H) | Pivot | Placement / Usage in World |
| :--- | :--- | :--- | :--- | :--- |
| `Runway_09L_27R` | `Runway_09L_27R_Mesh` | `22.0m × 128.0m × 1.2m` | Center of runway strip `(0,0,0)` | Primary precision arrivals/departures runway in Tower Sector (`RWY 09L/27R`), complete with piano-key thresholds, touchdown zone bars, blast-pad chevrons, PAPI-4 slope lights, edge lights, and hold-short signboards. |
| `Runway_09R_27L` | `Runway_09R_27L_Mesh` | `20.0m × 112.0m × 1.2m` | Center of runway strip `(0,0,0)` | Parallel secondary runway (`RWY 09R/27L`) with displaced threshold arrows, PAPI-4 lights, and exit signage. |
| `Taxiway_Straight_A` | `Taxiway_Straight_Mesh` | `12.0m × 28.0m × 0.7m` | Center ground `(0,0,0)` | Instanced along parallel taxiway Alpha/Bravo and cross-field connectors; includes yellow centerline, green centerline lamps, blue edge lights, and hold-short bars. |
| `Taxiway_Curve_90` | `Taxiway_Curve_Mesh` | `16.0m × 16.0m × 0.4m` | Corner center `(0,0,0)` | Instanced at taxiway 90° turns connecting runway ends to parallel taxiways. |
| `Taxiway_Intersection_T` | `Taxiway_Intersection_Mesh` | `22.0m × 18.0m × 0.4m` | Junction center `(0,0,0)` | Instanced where apron entry stubs meet the main parallel taxiway. |
| `Taxiway_RapidExit` | `Taxiway_RapidExit_Mesh` | `16.8m × 23.4m × 0.4m` | Turnoff center `(0,0,0)` | Instanced as 35° high-speed runway turnoffs (`K1`, `K2`) between runways and taxiways. |
| `Apron_GatePad_Group` | `Apron_GatePad_Mesh` | `56.0m × 32.0m × 0.4m` | Center of apron slab `(0,0,0)` | Placed in front of `Terminal_Concourse_Main`; includes 3 gate lead-in lines, nosewheel stop bars, red safety staging boxes, and ground power hatches. |
| `Approach_Light_Bridge_ALS` | `Approach_Light_Bridge_Mesh` | `14.6m × 34.0m × 2.5m` | Pier center `(0,0,0)` | Placed extending off threshold `09L` and `27R` into the bay water for high-intensity sequenced approach lighting. |

---

## 3. `airport_buildings.glb` (969.0 KB)

Airside control tower, main passenger terminal concourse with 3 articulated jet bridges, two wide-span maintenance hangars with sliding doors, and the ARFF fire station with roll-up bay doors.

| Root Node | Static & Moving Child Nodes | Real-World Scale (W × L × H) | Moving Pivot / Axis | Placement / Usage in World |
| :--- | :--- | :--- | :--- | :--- |
| `Control_Tower_Main` | `Control_Tower_Structure`<br>`Tower_SMR_Dish` *(rotates)*<br>`Tower_Anemometer` *(rotates)*<br>`Tower_Beacon_Rotator` *(rotates)* | `14.4m × 16.8m × 41.9m` | `Tower_SMR_Dish`: `(0,0,37.25m)` spins around vertical axis<br>`Tower_Anemometer`: `(2.2,2.2,37.25m)` spins around vertical axis<br>`Tower_Beacon_Rotator`: `(-2.2,2.2,37.25m)` spins around vertical axis | Iconic centerpiece of **Tower Sector** overlooking the apron and parallel runways. |
| `Terminal_Concourse_Main` | `Terminal_Structure`<br>`Terminal_HVAC_Fan_1..4` *(spin)*<br>`JetBridge_Boom_1..3` *(pivot)*<br>↳ `JetBridge_Cab_1..3` *(pivot)*<br>&nbsp;&nbsp;↳ `JetBridge_Wheel_1..3` *(spin)* | `54.8m × 31.8m × 11.2m` | `Terminal_HVAC_Fan_1..4`: rooftop chiller fans spin around vertical axis<br>`JetBridge_Boom_1..3`: pivot at rotunda `(±16/0, 10.8, 4.4m)` to swing to aircraft door<br>`JetBridge_Cab_1..3`: `(0, 9.5, 0m)` relative to boom | Placed adjacent to `Apron_GatePad_Group` in Tower Sector; gates `G1`, `G2`, `G3` dock with parked/turnaround airliners. |
| `Maintenance_Hangar_A` | `Maintenance_Hangar_A_Structure`<br>`Maintenance_Hangar_A_Door_L` *(slides)*<br>`Maintenance_Hangar_A_Door_R` *(slides)* | `32.6m × 26.6m × 11.9m` | `Door_L` / `Door_R`: local origin `(0,0,0)` at `(±6.2, 12.85, 0m)`; slide along `X` (`±5.5m`) to open/close bay | Placed at north-east maintenance apron (Cobalt brand fascia). |
| `Maintenance_Hangar_B` | `Maintenance_Hangar_B_Structure`<br>`Maintenance_Hangar_B_Door_L` *(slides)*<br>`Maintenance_Hangar_B_Door_R` *(slides)* | `32.6m × 26.6m × 11.9m` | `Door_L` / `Door_R`: local origin `(0,0,0)` at `(±6.2, 12.85, 0m)`; slide along `X` (`±5.5m`) | Placed next to Hangar A on the maintenance apron (Solstice Amber fascia). |
| `ARFF_Fire_Station` | `ARFF_Station_Structure`<br>`FireBay_Door_1..3` *(roll up/pivot)* | `21.4m × 14.4m × 12.9m` | `FireBay_Door_1..3`: pivot at top header shaft `(±5.6/0, 7.02, 4.45m)`; rotate or scale vertically to open | Placed adjacent to rapid runway access road for crash tender deployment. |

---

## 4. `aircraft_jets.glb` (2,157.8 KB)

Four distinct procedural jet airliner variants in custom fictional airline liveries, each with separate spinning turbofan blade rotors, retractable nose/main landing gear struts, and spinning wheels.

| Root Node | Livery & Type | Child Nodes (per variant `<Prefix>`) | Real-World Scale (Span × Len × H) | Moving Part Pivots | Placement / Usage in World |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `Jet_Narrowbody_Azura` | **Azura Air** (`AZR`) — Electric Cobalt Blue & White twinjet w/ sharklets | `<Prefix>_Fuselage`<br>`<Prefix>_Fan_L`, `<Prefix>_Fan_R`<br>`<Prefix>_Gear_Nose` ↳ `<Prefix>_Wheel_Nose`<br>`<Prefix>_Gear_Main_L/R` ↳ `<Prefix>_Wheel_Main_L/R` | `17.5m × 18.3m × 5.2m` | `Fan_L/R`: nacelle intake center, spin around longitudinal axis<br>`Gear_Nose` & `Gear_Main_L/R`: top strut trunnion pivot `(0,0,0)` for retraction<br>`Wheel_*`: axle center `(0,0,0)` | Primary commercial narrowbody on SID departures, STAR arrivals, holding stacks, and terminal gates. |
| `Jet_Narrowbody_Solstice` | **Solstice Airways** (`SLS`) — Warm Amber Gold & Slate twinjet | Same 9-node hierarchy (`Jet_Narrowbody_Solstice_*`) | `16.9m × 17.5m × 5.1m` | Same pivot hierarchy | Medium-haul narrowbody operating arrivals, departures, and active taxiing. |
| `Jet_Widebody_Meridian` | **Meridian Heavy** (`MRD`) — Crimson Red & Cool Grey widebody w/ dual-bogie main gear | Same 9-node hierarchy (`Jet_Widebody_Meridian_*`) | `23.8m × 24.7m × 7.0m` | Same pivot hierarchy | Heavy long-haul airliner on high-altitude en-route airways and priority ILS approaches. |
| `Jet_Regional_Veloce` | **Veloce Express** (`VLC`) — Cyan & Dark Cobalt T-tail rear-engine regional jet | Same 9-node hierarchy (`Jet_Regional_Veloce_*`) | `13.7m × 15.2m × 4.6m` | Rear fuselage-mounted `Fan_L/R` + T-tail + retractable gear | Regional jet flying short-haul commuter approaches and departures. |

---

## 5. `aircraft_turboprops.glb` (1,740.5 KB)

Four procedural twin-turboprop aircraft variants with multi-blade scimitar propellers (yellow safety tips), high/low wings, and retractable gear.

| Root Node | Livery & Type | Child Nodes (per variant `<Prefix>`) | Real-World Scale (Span × Len × H) | Moving Part Pivots | Placement / Usage in World |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `Turboprop_Commuter_A` | **Skyward Regional** (`SKW`) — Cobalt Blue high-wing T-tail 6-blade commuter | `<Prefix>_Fuselage`<br>`<Prefix>_Prop_L`, `<Prefix>_Prop_R`<br>`<Prefix>_Gear_Nose` ↳ `<Prefix>_Wheel_Nose`<br>`<Prefix>_Gear_Main_L/R` ↳ `<Prefix>_Wheel_Main_L/R` | `16.5m × 15.2m × 4.4m` | `Prop_L/R`: spinner hub origin `(0,0,0)` spins around longitudinal axis<br>`Gear_*`: top strut hinge<br>`Wheel_*`: axle center | Regional feeder arrivals and departures in Approach and Tower sectors. |
| `Turboprop_Commuter_B` | **Archipelago Air** (`ARC`) — Emerald Green island-hopper turboprop | Same 9-node hierarchy (`Turboprop_Commuter_B_*`) | `15.7m × 14.2m × 4.2m` | Same pivot hierarchy | Coastal commuter flights between island fixes and Port Solis. |
| `Turboprop_Cargo_Feeder` | **AeroFreight** (`AFR`) — Amber & Dark Slate freighter + hinged `Cargo_Door` | Same 9 nodes + `Turboprop_Cargo_Feeder_Cargo_Door` | `16.9m × 15.6m × 4.5m` | `Cargo_Door`: top hinge `(0,0,0)` at `(-1.0, 1.45, 1.9m)` swings upward `75°` when loading on apron | Cargo apron operations and night/day feeder routes. |
| `Turboprop_Utility_Twin` | **Calibra Flight Check** (`CLB`) — High-Vis Orange low-wing navaid inspection twin w/ wingtip sensor pods | Same 9-node hierarchy (`Turboprop_Utility_Twin_*`) | `13.7m × 11.8m × 3.7m` | 4-blade `Prop_L/R` + low-wing gear | Navaid/ILS calibration orbits and airway inspection runs. |

---

## 6. `ground_vehicles.glb` (2,701.2 KB)

Six airport Ground Support Equipment (GSE) and emergency vehicles with articulated booms, scissor lifts, towbars, dollies, LED signboards, and individual wheel nodes with lug bolts and hubs.

| Root Node | Child Nodes | Real-World Scale (W × L × H) | Moving Part Pivots | Placement / Usage in World |
| :--- | :--- | :--- | :--- | :--- |
| `Vehicle_Pushback_Tug` | `Tug_Body`<br>`Tug_Towbar` *(pivots)*<br>`Tug_Wheel_FL/FR/RL/RR` *(spin)* | `2.68m × 8.85m × 2.19m` | `Tug_Towbar`: front hitch pin `(0, 2.82, 0.55m)` swivels around vertical/pitch axes<br>`Tug_Wheel_*`: axle centers `(±1.18, ±1.65, 0.52m)` | Pushes aircraft back from Gates `G1–G3` onto the taxiway centerline. |
| `Vehicle_Fuel_Tanker` | `Tanker_Body`<br>`Fuel_Boom_Arm` *(pivots)*<br>`Tanker_Wheel_FL/FR/ML/MR/RL/RR` *(spin)* | `2.70m × 8.35m × 3.33m` | `Fuel_Boom_Arm`: swivel base `(0.82, 1.55, 1.05m)` rotates to aircraft wing<br>6× `Tanker_Wheel_*`: axle centers | Drives along apron service road and refuels turnaround jets at gates. |
| `Vehicle_Catering_HiLift` | `Catering_Chassis`<br>`Catering_Scissor_Lift` *(extends)*<br>`Catering_Box_Body` *(rises)*<br>`Catering_Wheel_FL/FR/RL/RR` *(spin)* | `2.68m × 7.28m × 4.00m` | `Catering_Scissor_Lift`: `(0, -0.85, 0.80m)` scales/pivots vertically<br>`Catering_Box_Body`: `(0, -0.85, 1.85m)` translates up `+1.4m` to cabin door height | Services parked aircraft on the terminal apron. |
| `Vehicle_Baggage_Tractor_Carts` | `Tractor_Body`, `Tractor_Wheel_FL/FR/RL/RR`<br>`Dolly_Cart_1..2` ↳ `Dolly_Bed_ULD_1..2`, `Dolly_Tongue_1..2`, `Dolly1/2_Wheel_FL/FR/RL/RR` | `2.10m × 9.20m × 2.07m` | `Dolly_Cart_1..2`: articulate behind tractor on apron loops<br>`Dolly_Tongue_1..2`: front drawbar hinge<br>12× `Wheel` nodes: axle centers | Hauls ULD baggage containers between terminal baggage hall and aircraft holds. |
| `Vehicle_FollowMe_Van` | `FollowMe_Body`<br>`FollowMe_SignBoard` *(folds)*<br>`FollowMe_Wheel_FL/FR/RL/RR` *(spin)* | `2.26m × 4.61m × 2.42m` | `FollowMe_SignBoard`: roof hinge `(0, -1.15, 1.72m)` folds up `0°..90°` around `X` axis | Escorts landed aircraft along taxiways to assigned gates. |
| `Vehicle_ARFF_CrashTender` | `ARFF_Body`<br>`Turret_Boom` *(aims)*<br>`ARFF_Wheel_FL/FR/ML/MR/RL/RR` *(spin)* | `3.32m × 8.76m × 3.45m` | `Turret_Boom`: roof monitor swivel `(0, 2.15, 2.65m)` rotates yaw/pitch<br>6× `ARFF_Wheel_*`: heavy off-road tires | Stationed at `ARFF_Fire_Station` and patrols runway perimeter road. |

---

## 7. `navaids_waypoints.glb` (546.4 KB)

Primary/secondary surveillance radars, long-range geodesic radome, Doppler VOR/DME, ILS localizer & glideslope arrays, RNAV waypoint & holding stack pylons, and airfield windsock.

| Root Node | Child Nodes | Real-World Scale (W × L × H) | Moving Part Pivots | Placement / Usage in World |
| :--- | :--- | :--- | :--- | :--- |
| `Radar_Primary_ASR` | `Radar_Primary_Pedestal`<br>`Radar_Dish_Assembly` *(rotates)*<br>`Radar_Sweep_Cone` *(rotates)* | `9.5m × 14.8m × 17.1m` | `Radar_Dish_Assembly`: `(0,0,13.5m)` continuous 360° rotation (`~12.5 RPM`)<br>`Radar_Sweep_Cone`: `(0,0,15.2m)` co-rotating soft cyan beam wedge | Placed at high ground on airport/approach sector; drives the rotating radar sweep light across the map. |
| `Radar_Enroute_Radome` | `Radar_Enroute_Structure`<br>`Radome_Beacon_Rotator` *(rotates)* | `9.2m × 9.2m × 20.9m` | `Radome_Beacon_Rotator`: apex `(0,0,20.05m)` spins around vertical axis | Placed on mountain ridge in **En-Route Sector (`SECTOR-N`)** and **Approach Sector**. |
| `VOR_DME_Station` | `VOR_DME_Mesh` | `13.0m × 13.0m × 6.0m` | Static ground origin `(0,0,0)` | Placed at primary airway junction fixes (`SOLIS VOR`). |
| `ILS_Localizer_Array` | `ILS_Localizer_Mesh` | `16.5m × 2.6m × 2.3m` | Ground origin `(0,0,0)` | Placed beyond the departure end of `Runway_09L_27R` and `Runway_09R_27L`. |
| `ILS_Glideslope_Tower` | `ILS_Glideslope_Mesh` | `5.2m × 3.3m × 11.3m` | Ground origin `(0,0,0)` | Placed beside the touchdown zone of `Runway_09L_27R`. |
| `Waypoint_Fix_Pylon_A` | `Waypoint_Pylon_A_Base`<br>`Pylon_Ring_Rotator` *(rotates)* | `4.8m × 4.8m × 9.0m` | `Pylon_Ring_Rotator`: `(0,0,4.5m)` spins around vertical axis | Instanced at every named RNAV waypoint/fix (`NERon`, `KESTL`, `VEXOR`, `BAYLI`, `SOLIS`, `MARIN`, `CREST`, `PALMA`). |
| `Waypoint_Holding_Pylon_B` | `Waypoint_Pylon_B_Column`<br>`Hold_Ring_Lower` *(rotates)*<br>`Hold_Ring_Upper` *(counter-rotates)* | `5.2m × 5.2m × 10.7m` | `Hold_Ring_Lower`: `(0,0,3.6m)` & `Hold_Ring_Upper`: `(0,0,6.8m)` counter-rotate around vertical axis | Placed at the primary arrival holding stack fix (`STACK / KESTL`). |
| `Windsock_Mast` | `Windsock_Pole`<br>`Windsock_Cone` *(swivels)* | `3.6m × 4.5m × 6.6m` | `Windsock_Cone`: mast swivel `(0,0,5.75m)` yaws with wind direction & oscillates gently | Placed near runway thresholds in Tower Sector. |

---

## 8. `airspace_viz.glb` (920.8 KB)

3D tactical airspace visualization widgets: drifting convective storm cells with rotating anvil tops and pulsing lightning, 3-state separation rings (Nominal Cyan, Warning Amber, Conflict Red), 3-tier holding stack racetrack, altitude drop-line pin reticle, and airway corridor chevrons.

| Root Node | Child Nodes | Real-World Scale (W × L × H) | Moving Part Pivots | Placement / Usage in World |
| :--- | :--- | :--- | :--- | :--- |
| `Weather_Cell_CB_Heavy` | `Weather_CB_CloudMass`<br>`Storm_Anvil_Swirl` *(rotates)*<br>`Lightning_Core_1..2` *(pulse)*<br>`Rain_Curtain_Ring` *(rotates)* | `16.4m × 13.7m × 13.6m` | `Storm_Anvil_Swirl`: `(0,0,11.6m)` slow cyclonic rotation<br>`Lightning_Core_1..2`: `(±1.7, ±1.1, 4.2m)` scale/emissive flash<br>`Rain_Curtain_Ring`: `(0,0,0)` ground footprint ring | Drifts across Approach and En-Route sectors, dynamically triggering flight reroutes around its convective core. |
| `Weather_Cell_Moderate` | `Weather_Mod_CloudMass` | `12.0m × 8.0m × 8.6m` | Center `(0,0,0)` | Secondary drifting weather cell flanking the main CB storm cell. |
| `Separation_Ring_Nominal` | `Separation_Ring_Nominal_OuterHalo`<br>`SepRing_Spinner_Nominal` *(rotates)* | `11.4m × 13.7m × 0.2m` | `SepRing_Spinner_Nominal`: `(0,0,0)` rotates around aircraft center | Attached to airborne aircraft when horizontal/vertical separation is safe (`>= 5.0 NM`). |
| `Separation_Ring_Amber` | `Separation_Ring_Amber_OuterHalo`<br>`SepRing_Spinner_Amber` *(rotates)* | `11.4m × 13.7m × 0.2m` | `SepRing_Spinner_Amber`: `(0,0,0)` faster warning rotation | Displayed around aircraft pairs when separation drops into caution range (`3.0–5.0 NM`). |
| `Separation_Ring_Red` | `Separation_Ring_Red_OuterHalo`<br>`SepRing_Spinner_Red` *(rotates)* | `11.4m × 13.7m × 0.2m` | `SepRing_Spinner_Red`: `(0,0,0)` rapid alert rotation | Displayed around aircraft pairs in active loss-of-separation conflict (`< 3.0 NM`). |
| `Holding_Stack_Racetrack` | `Holding_Stack_Mesh` | `8.7m × 20.6m × 8.1m` | Ground origin `(0,0,0)` | Placed over holding fix (`KESTL` / `NERON`) to visualize the 3 vertical holding levels (`FL070`, `FL080`, `FL090`). |
| `Altitude_Drop_Pin` | `Altitude_Stem`<br>`Reticle_Base_Ring` *(rotates)* | `4.2m × 4.2m × 10.0m` | `Reticle_Base_Ring`: `(0,0,0)` spins on terrain surface under each aircraft; `Altitude_Stem` scales vertically to aircraft altitude | Rendered beneath every airborne aircraft to show ground-track projection and altitude drop line. |
| `Airway_Gate_Chevron` | `Airway_Chevron_Mesh` | `4.1m × 5.7m × 0.6m` | Origin `(0,0,0)` | Instanced along SID departure climbs, STAR arrival descents, final approach ILS centerlines, and en-route airways. |

---

## 9. `town_coast_props.glb` (415.7 KB)

Contextual urban, coastal, maritime, energy, and foliage props that populate the coastline, hills, and towns across all three control sectors.

| Root Node | Child Nodes | Real-World Scale (W × L × H) | Moving Part Pivots | Placement / Usage in World |
| :--- | :--- | :--- | :--- | :--- |
| `Town_Block_Commercial` | `Town_Block_Commercial_Mesh` | `20.0m × 18.0m × 9.7m` | Ground origin `(0,0,0)` | Instanced on town pads in Tower, Approach, and En-Route sectors. |
| `Town_Block_Residential` | `Town_Block_Residential_Mesh` | `18.0m × 16.0m × 4.4m` | Ground origin `(0,0,0)` | Instanced around commercial blocks and coastal hills. |
| `Coastal_Lighthouse_Pier` | `Coastal_Lighthouse_Structure`<br>`Lighthouse_Beacon` *(rotates)* | `9.5m × 14.0m × 15.7m` | `Lighthouse_Beacon`: `(1.2, 2.2, 13.85m)` rotates 360° inside glass lantern room | Placed on coastal headlands in Tower and Approach sectors. |
| `Cargo_Ship_Coaster` | `Cargo_Ship_Hull`<br>`Ship_Radar_Scanner` *(rotates)* | `6.2m × 22.2m × 8.4m` | `Ship_Radar_Scanner`: `(0, -6.8, 7.25m)` spins on bridge mast | Cruises slowly along shipping lanes in the bay in Tower and Approach sectors. |
| `Wind_Turbine_Offshore` | `Wind_Turbine_Tower`<br>`Turbine_Nacelle` *(yaws)*<br>↳ `Turbine_Rotor` *(spins)* | `17.2m × 5.3m × 29.0m` | `Turbine_Nacelle`: `(0,0,19.8m)` yaws into wind<br>`Turbine_Rotor`: `(0, 1.55, 0.95m)` relative to nacelle; 3-blade rotor spins around local `Y`/`Z` axis | Instanced in offshore wind farms and highland ridges. |
| `Tree_Cluster_Pine` | `Tree_Cluster_Pine_Mesh` | `6.1m × 5.6m × 5.8m` | Ground origin `(0,0,0)` | Instanced across hills, ridges, and airport buffer zones. |
| `Tree_Cluster_Deciduous` | `Tree_Cluster_Deciduous_Mesh` | `6.6m × 5.6m × 5.0m` | Ground origin `(0,0,0)` | Instanced around town blocks, coastlines, and approach valleys. |

---

## 10. `characters_crew.glb` (492.2 KB)

Four rigged character and animal assets with armatures, vertex-group skinning, and 13 named NLA animation clips exported into the GLB.

| Armature Root | Skinned Mesh Node | Real-World Scale (W × L × H) | Bones | Named Animation Clips | Placement / Usage in World |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `Armature_Marshaller` | `Crew_Marshaller` | `0.80m × 0.65m × 1.88m` | `Root`, `Pelvis`, `Torso`, `Head`, `Arm_L`, `Arm_R`, `Leg_L`, `Leg_R` | `Marshaller_Idle`<br>`Marshaller_Walk`<br>`Marshaller_Signal_Turn`<br>`Marshaller_Signal_Stop` | Positioned at terminal gate lead-in lines (`G1–G3`) with glowing marshalling wands to guide arriving aircraft. |
| `Armature_Tech` | `Crew_Controller_Tech` | `0.80m × 0.55m × 1.88m` | `Root`, `Pelvis`, `Torso`, `Head`, `Arm_L`, `Arm_R`, `Leg_L`, `Leg_R` | `Tech_Idle`<br>`Tech_Walk`<br>`Tech_Inspect` | Positioned on apron equipment pads, radar stations, and tower observation catwalk with illuminated tablet. |
| `Armature_K9` | `Animal_Patrol_K9` | `0.36m × 0.85m × 0.89m` | `Root`, `Body`, `Head`, `Tail`, `Leg_FL`, `Leg_FR`, `Leg_BL`, `Leg_BR` | `K9_Idle`<br>`K9_Walk`<br>`K9_Run` | Accompanies perimeter security/wildlife patrol along airfield boundary. |
| `Armature_Gull` | `Animal_Coastal_Gull` | `2.24m × 0.78m × 0.65m` | `Root`, `Body`, `Wing_L`, `Wing_Tip_L`, `Wing_R`, `Wing_Tip_R` | `Gull_Idle_Perch`<br>`Gull_Flap_Climb`<br>`Gull_Glide_Circle` | Flocks gliding and circling above the coastline, lighthouse pier, and bay waters. |
