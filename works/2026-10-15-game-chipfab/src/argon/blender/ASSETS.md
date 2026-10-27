# Semiconductor Fab 3D Asset Pack (`blender/ASSETS.md`)

## Visual Direction, Palette & Scale Conventions

- **Reference Aesthetic**: Modelled after `references/warehouse-game/video.mp4` (`sheet.png`) — a clean isometric strategy-game and real-time operations world in a light, cool cleanroom palette with one strong brand accent colour (**Cobalt Electric Blue `#1D5CFF`**).
- **Color Palette**:
  - **Cleanroom Powder-Coated White**: `#F2F6FA` (roughness `0.34`, subtle baked panel-seam grid texture `panel_metal_albedo.png`)
  - **Light Cool Grey**: `#DCE3EC` (secondary enclosures, roof slabs, concrete equipment pads)
  - **Anodised Brushed Silver / Vacuum Stainless**: `#BCC8D8` / `#D6E0EB` (metallic `0.82–0.92`, roughness `0.20–0.28`, EFEM load ports, vacuum chambers, pipes, wheel rims)
  - **Dark Slate / Anthracite Chassis**: `#232E3F` (roughness `0.45`, heavy machine plinths, structural columns, recessed louver vents, tire rubber `#1C222B`)
  - **Brand Accent — Cobalt Electric Blue**: `#1D5CFF` (roughness `0.28`, tool header fascias, OHT vehicle stripes, cleanroom bay accents, DI water columns, logistics livery)
  - **Domain Process Accents**:
    - **Photolithography Amber Safe-Light Glass & Trim**: `#FF9E1B` (UV-filtered yellow-room windows, lithography scanner viewports, specialist visors)
    - **Hot-Lot Priority Orange**: `#FF5500` (express "Hot Lot" FOUP pods, priority status badges, butterfly valves)
    - **Copper / Gold Vacuum Optics & RF Coils**: `#D87A38` / `#EAB308` (EUV collector optics, RTP lamp domes, ICP RF coils, HV transformer bushings)
    - **Patterned Silicon Wafer Iridescence**: Baked procedural die-grid texture (`wafer_die_albedo.png`) on `300 mm` (`0.30 m` diameter) silicon wafers
    - **SECS/GEM 4-Tier Emissive Signal Towers**: `Green (#10E868)` = Running, `Yellow (#FFB81C)` = Idle / Waiting FOUP, `Red (#FF2E38)` = Alarm / Down, `Blue/Cyan (#1ED6FF)` = OHT Auto / UPW / Plasma
- **Scale & Coordinate Convention**:
  - `1 Blender / glTF unit = 1.0 meter` (real-world scale: `300 mm` wafers are `0.30 m` diameter; standard 300 mm FOUP pods are `0.42 m × 0.40 m × 0.44 m`; SEMI E15.1 EFEM load-port dock height is `0.90–0.95 m`; cleanroom engineers are `1.78 m` tall; process tools are `2.2–4.5 m` wide and `2.5–3.8 m` tall; cutaway fab shells are `14–16 m` wide).
  - Every variant root node rests flush on the ground plane (`Z_min = 0.000 m`) and faces `-Y` (`+Z` up in Blender, exported `+Y` up in glTF 2.0).
  - Every moving part (doors, EFEM load-port openers, vacuum transfer robot arms, lithography wafer/reticle stages, CMP platens & carousels, furnace boat elevators, wet-bench gantries, OHT hoist grippers & wheels, stocker cranes, cooling/scrubber fans, tower crane jib/trolley/hook, vehicle wheels, security barrier arms) is a **separate named mesh node** with its **local origin `(0, 0, 0)` placed at its physical rotation axle, hinge, or linear translation datum**.

---

## Summary of GLB Asset Files (`app/public/assets/`)

### Primary Modular Asset Suite (`build_all.py` — 14 GLBs, 10.00 MB)

| # | GLB File | Size (KB) | Variants | Primary Placement in World |
|---|----------|----------:|---------:|----------------------------|
| 1 | `fab_buildings.glb` | 547.2 KB | 3 | Cutaway multi-level 300 mm Logic Fab, Fab 2 Ramp-Up Shell with Tower Crane, Advanced 3D Packaging Plant |
| 2 | `cleanroom_bays.glb` | 362.9 KB | 5 | Modular `6m × 6m` Standard Cleanroom Bay, Yellow-Lit Litho Bay, Central Spine Corridor, Partition Wall, Gowning Airlock |
| 3 | `litho_scanners.glb` | 832.6 KB | 3 | Yellow-lit Photolithography Bay tools: High-NA EUV Twinscan, 193i ArF Immersion DUV Scanner, Coater/Developer Track |
| 4 | `etch_deposition_clusters.glb` | 1,366.7 KB | 3 | Etch & Thin-Film Deposition Bays: Octagonal ICP Plasma Etch Cluster, Hexagonal PECVD Cluster, ALD/PVD Metal Cluster |
| 5 | `implant_furnace_tools.glb` | 925.3 KB | 4 | Implant & Thermal Bays: High-Current & Medium-Current Ion Implanters, 4-Tube Vertical Diffusion Furnace, RTP Laser Anneal |
| 6 | `cmp_wet_tools.glb` | 788.7 KB | 3 | Planarization & Wet Clean Bays: Dual-Platen CMP Polisher, 4-Bath Automated Wet Bench, Single-Wafer Spin Cleaner |
| 7 | `metrology_packaging_tools.glb` | 764.7 KB | 4 | Metrology & Packaging Bays: E-Beam CD-SEM, Optical Scatterometer, 3D Die-to-Wafer Bonder, Automated Wafer Prober |
| 8 | `oht_network.glb` | 1,581.5 KB | 6 | Ceiling OHT Monorail Vehicles, Straight/Curved/Switch Rails, Tall Automated FOUP Stocker Tower, EUV Reticle Stocker |
| 9 | `foup_wafer_props.glb` | 688.1 KB | 6 | Standard & Hot-Lot 300 mm FOUP Pods, EUV Reticle SMIF Pod, 300 mm Wafer Pedestal, Autonomous AMR Bot, Manual PGV Cart |
| 10 | `subfab_equipment.glb` | 300.9 KB | 5 | Sub-Fab Utility Basement (`Z < 0`): Dry Vacuum Pump Skid, Point-of-Use Gas Scrubber, Heat Exchanger, VMB Gas Cabinet, Slurry CDS |
| 11 | `fab_characters.glb` | 681.1 KB | 4 | Rigged Cleanroom Personnel (`1.78 m` tall) with Armature & 5 NLA Animation Clips (`Idle`, `Walk`, `Inspect`, `CarryFOUP`, `WorkConsole`) |
| 12 | `support_plant_buildings.glb` | 547.1 KB | 4 | Campus Support Plants: Ultra-Pure Water (UPW) Plant, Cryogenic Bulk Gas Yard, 3-Cell Cooling Tower Bank, HV Power Substation |
| 13 | `campus_vehicles.glb` | 640.7 KB | 3 | Campus Road Fleet: Climate-Controlled Wafer Freight Box Truck, Liquid Nitrogen Cryo Tanker, Cleanroom Maintenance Van |
| 14 | `campus_environment.glb` | 211.6 KB | 5 | Campus Infrastructure: Security Gatehouse, Overhead Utility Pipe Bridge, Two-Lane Road Segment, Solar Generator Pad, Planter |

### Supplementary High-Detail Variant Suite (`build_argon_suite.py` — 9 GLBs, 15.20 MB)

| # | GLB File | Size (KB) | Variants | Primary Placement in World |
|---|----------|----------:|---------:|----------------------------|
| 15 | `cleanroom_structure.glb` | 733.3 KB | 6 | `4m × 4m` Cleanroom & Litho Floor Tiles, Cutaway Partition Wall, Airlock Doors, Ceiling FFU Canopy, Safety Station Pillar |
| 16 | `etch_dep_clusters.glb` | 2,486.8 KB | 3 | Alternate Open-Top Vacuum Clusters (`Cluster_PlasmaEtch`, `Cluster_CVD_ALD`, `Cluster_PVD_Metal`) with tilting chamber lids |
| 17 | `implant_anneal_tools.glb` | 1,906.8 KB | 3 | Alternate Cutaway Beamline Implanter, Exposed-Coil Vertical Furnace & RTP Flash Anneal (`Ion_Implanter_HighCurrent`, etc.) |
| 18 | `cmp_wet_metrology.glb` | 2,268.5 KB | 4 | Alternate Tri-Platen CMP Polisher, 5-Bath Wet Bench, E-Beam Inspector & Optical Scatterometer |
| 19 | `oht_network_foup.glb` | 1,810.9 KB | 8 | Alternate Standard & Priority OHT Vehicles (`OHT_Vehicle_Standard`, `OHT_Vehicle_Priority`), FOUPs, 300 mm Wafer & `4m` Rails |
| 20 | `stocker_units.glb` | 2,475.5 KB | 3 | Interbay Automated FOUP Stocker (`Stocker_Interbay_Tower`), Overhead Under-Track Buffer (`Stocker_Undertrack_Buffer`), N2 Stocker |
| 21 | `subfab_utilities.glb` | 869.3 KB | 5 | Alternate Sub-Fab Dry Pump, Burn/Wet Abatement, Chiller, Gas Cabinet & Waffle Column Pipe Rack |
| 22 | `campus_buildings.glb` | 1,459.5 KB | 7 | Compact Campus Overview Shells (`Building_Fab1_Shell`, `Building_Fab2_RampUp`, `Building_Packaging_Plant`, Support Plants) |
| 23 | `campus_vehicles_props.glb` | 1,552.1 KB | 6 | Alternate Wafer Truck, Cryo Tanker, Scissor-Lift Cleanroom PGV, Inter-Fab Skyway Bridge, Security Gate & Planter |

**Total Asset Pack Size**: `25.20 MB` (`25,801.8 KB`) across all 23 `.glb` files (well below the `40 MB` budget).

---

## Detailed Asset Specifications, Hierarchy, Moving Parts & Pivots

### 1. `fab_buildings.glb` (547.2 KB — `gen_01_fab_buildings.py`)
**World Placement**: Main campus building footprints when zoomed out or in isometric cutaway mode. All 3 buildings feature open cutaway roofs and front glass curtain walls so the interior cleanroom bays, waffle slab deck, and sub-fab basement are clearly visible from the isometric camera.

- **`FabBuilding_Logic300mm`** (`16.10 m × 12.10 m × 8.42 m`, `Z_min = 0.000 m`)
  - Flagship 300 mm sub-2nm logic wafer fab shell with lower sub-fab basement (`Z = 0.0–2.8 m`), perforated cleanroom waffle deck (`Z = 2.85 m`), open cutaway cleanroom roof truss grid (`Z = 6.55 m`) with integrated LED light strips, Cobalt Blue perimeter fascia, and rear mechanical exhaust slab.
  - **Moving Parts**:
    - `RooftopFan_01` (parent: `FabBuilding_Logic300mm`, local pivot at `(-4.20, 4.40, 7.12)`): 6-blade axial fan inside cylindrical rooftop shroud; rotates continuously around local `Z`.
    - `RooftopFan_02` (parent: `FabBuilding_Logic300mm`, local pivot at `(4.20, 4.40, 7.12)`): rotates continuously around local `Z`.
    - `DockDoor_01` (parent: `FabBuilding_Logic300mm`, local pivot at top header `(4.60, -5.75, 2.25)`): roll-up loading dock door; scales/translates vertically along `Z`.
    - `DockDoor_02` (parent: `FabBuilding_Logic300mm`, local pivot at top header `(6.20, -5.75, 2.25)`): roll-up loading dock door; scales/translates vertically along `Z`.
- **`FabBuilding_RampUp`** (`15.90 m × 11.00 m × 10.30 m`, `Z_min = 0.000 m`)
  - Phase-2 expansion fab shell under active tool move-in and commissioning, featuring exposed structural steel column grid, open cutaway roof, upper tool rigging doorway, and a hierarchical 3-part yellow/slate Tower Crane (`Z = 0–10.3 m`).
  - **Moving Parts**:
    - `TowerCraneJib` (parent: `FabBuilding_RampUp`, local pivot at mast slewing ring `(6.20, 4.20, 9.55)`): horizontal boom + counterweight + operator cab; rotates `360°` around local `Z`.
    - `TowerCraneTrolley` (parent: `TowerCraneJib`, local pivot at `(-3.80, 0.00, -0.05)`): travels horizontally along jib `X` axis (`-6.5 m` to `-1.2 m`).
    - `TowerCraneHook` (parent: `TowerCraneTrolley`, local pivot at `(0.00, 0.00, -0.12)`): hoist cable & yellow hook block; translates vertically along `Z`.
    - `MoveInDoor` (parent: `FabBuilding_RampUp`, local pivot at top header `(-3.60, -4.80, 5.20)`): upper cleanroom tool rigging door; slides/rolls along `Z`.
- **`FabBuilding_Packaging`** (`14.10 m × 10.50 m × 5.37 m`, `Z_min = 0.000 m`)
  - Advanced 2.5D/3D CoWoS & HBM wafer packaging plant with open cutaway roof trusses, front curtain glazing, rear exhaust deck with dual shrouded fans, and dual loading docks.
  - **Moving Parts**:
    - `PackExhaustFan_01` (local pivot at `(-3.50, 3.60, 5.28)`): rotates around local `Z`.
    - `PackExhaustFan_02` (local pivot at `(3.50, 3.60, 5.28)`): rotates around local `Z`.
    - `PackDockDoor_01` (local pivot at `(3.60, -5.00, 2.10)`): roll-up dock door (`Z`).
    - `PackDockDoor_02` (local pivot at `(5.20, -5.00, 2.10)`): roll-up dock door (`Z`).

---

### 2. `cleanroom_bays.glb` (362.9 KB — `gen_01_fab_buildings.py`)
**World Placement**: Modular `6.0 m × 6.0 m` interior cleanroom bay tiles that snap together inside the main fab cutaway to form process bays (Litho, Etch, Deposition, Implant, CMP, Metrology), the central OHT spine corridor, and gowning entry airlocks.

- **`CleanroomBay_Standard`** (`6.04 m × 6.00 m × 4.50 m`, `Z_min = 0.000 m`)
  - Standard white cleanroom bay with sub-fab concrete pad, `4×4` support pedestals, color-coded sub-fab utility pipes (UPW teal, N2 blue, exhaust yellow) resting on transverse cross-beams (`Z = 0.72 m`), perforated raised waffle floor (`Z = 1.45 m`) using `cleanroom_tile_albedo.png`, rear bulkhead wall with viewports and return-air grilles, and overhead HEPA Fan-Filter Unit (FFU) ceiling grid (`Z = 4.38 m`) supported by front corner columns and side tie-beams.
  - **Moving Parts**:
    - `FFUFan_01` (local pivot at `(-1.50, 0.00, 4.42)`): ceiling HEPA blower fan; rotates around local `Z`.
    - `FFUFan_02` (local pivot at `(1.50, 0.00, 4.42)`): rotates around local `Z`.
- **`CleanroomBay_LithoYellow`** (`6.04 m × 6.00 m × 4.50 m`, `Z_min = 0.000 m`)
  - UV-filtered yellow-room photolithography bay (`<520 nm` light blocked) with amber-tinted viewing windows, glowing amber ceiling FFU light strips, amber safety stripes, and overhead HEPA blower fan.
  - **Moving Parts**:
    - `LithoFFUFan_01` (local pivot at `(0.00, 0.00, 4.42)`): rotates around local `Z`.
- **`CleanroomBay_SpineCorridor`** (`6.00 m × 4.00 m × 4.50 m`, `Z_min = 0.000 m`)
  - Central interbay Automated Material Handling System (AMHS) spine corridor with dual floor safety guide lanes, dual overhead OHT monorail tracks (`Z = 3.95 m`) suspended from ceiling hanger rods, and a twin-column KPI telemetry board (`Z = 3.55 m`) displaying `console_screen_emissive.png` (WIP, OEE, Yield, Hot Lots).
- **`CleanroomWall_Partition`** (`6.00 m × 0.28 m × 3.20 m`, `Z_min = 0.000 m`)
  - Modular bay-to-bay partition wall with clear tempered glass upper window (`Z = 1.85 m`), Cobalt Blue accent stripe, and bottom laminar return-air louver vents.
- **`CleanroomAirlock_Gowning`** (`4.00 m × 3.50 m × 3.40 m`, `Z_min = 0.000 m`)
  - Personnel cleanroom air-shower & gowning entry lock with stainless gowning bench, 4 bunny-suit garment lockers, HEPA ceiling nozzles, and dual automatic sliding glass doors.
  - **Moving Parts**:
    - `AirlockDoor_L` (local pivot at `(-0.48, -1.68, 1.15)`): slides along `X` (`-0.80 m` to open).
    - `AirlockDoor_R` (local pivot at `(0.48, -1.68, 1.15)`): slides along `X` (`+0.80 m` to open).

---

### 3. `litho_scanners.glb` (832.6 KB — `gen_02_litho_etch.py`)
**World Placement**: Installed inside `CleanroomBay_LithoYellow` bays (Step 1 of the wafer process route and repeated across critical patterning layers).

- **`Tool_EUV_Scanner`** (`3.46 m × 5.20 m × 3.79 m`, `Z_min = 0.000 m`)
  - Flagship High-NA EUV Lithography Scanner (`13.5 nm` wavelength) with massive multi-compartment cleanroom enclosure, Cobalt Blue upper fascia, amber UV-safe front/side observation windows, rear cylindrical Sn-droplet laser-produced plasma (LPP) source vessel with copper RF collector rings, top laser/vacuum umbilical bridge, 3 front EFEM load ports (`Z = 0.98 m`) with docked Hot-Lot and Standard FOUP pods, articulated operator terminal, and 4-tier SECS/GEM status tower.
  - **Moving Parts**:
    - `WaferStageChuck` (local pivot at `(0.00, -0.45, 1.18)`): magnetic-levitation dual-wafer stage carrying a 300 mm patterned silicon wafer (`wafer_die_albedo.png`), visible through the front amber viewport; translates along `X`/`Y`.
    - `ReticleStageArm` (local pivot at `(0.00, -0.45, 2.22)`): upper reticle scanning stage with gold EUV reflective mask; translates along `Y`.
    - `LoadPortDoor_01` (local pivot at `(-0.80, -2.06, 0.98)`): slides vertically along `Z` (`-0.35 m`).
    - `LoadPortDoor_02` (local pivot at `(0.00, -2.06, 0.98)`): slides vertically along `Z`.
    - `LoadPortDoor_03` (local pivot at `(0.80, -2.06, 0.98)`): slides vertically along `Z`.
- **`Tool_DUV_Scanner`** (`2.80 m × 4.00 m × 3.49 m`, `Z_min = 0.000 m`)
  - `193 nm` ArF Immersion DUV Step-and-Scan lithography system with precision projection lens barrel visible behind front amber glass, rear Excimer laser unit, 3 front EFEM load ports, operator console, and status tower.
  - **Moving Parts**:
    - `DUVWaferStage` (local pivot at `(0.00, -0.35, 1.15)`): carries a 300 mm silicon wafer; translates along `X`/`Y`.
    - `LoadPortDoor_01`..`LoadPortDoor_03` (local pivots at `(-0.75, -1.46, 0.98)`, `(0.00, -1.46, 0.98)`, `(0.75, -1.46, 0.98)`): vertical `Z` slide openers.
- **`Tool_CoatDev_Track`** (`2.60 m × 4.50 m × 2.89 m`, `Z_min = 0.000 m`)
  - Inline Photoresist Spin-Coater & Post-Exposure Bake (PEB) Developer Track coupled to lithography scanners, with 3 amber side viewing windows showing internal spin bowls & thermal bake plates, 2 front EFEM load ports, and status tower.
  - **Moving Parts**:
    - `TrackRobotArm` (local pivot at `(0.00, 0.00, 1.25)`): linear shuttle robot carrying a 300 mm silicon wafer along the central track spine (`Y` translation `±1.2 m` & `Z` rotation).
    - `SpinChuck_01` (local pivot at `(-0.62, -0.50, 1.18)`): photoresist spin chuck with 300 mm wafer; rotates rapidly around local `Z`.
    - `SpinChuck_02` (local pivot at `(-0.62, 0.50, 1.18)`): rotates rapidly around local `Z`.
    - `LoadPortDoor_01`, `LoadPortDoor_02` (local pivots at `(-0.55, -1.86, 0.98)`, `(0.55, -1.86, 0.98)`): vertical `Z` slide openers.

---

### 4. `etch_deposition_clusters.glb` (1,366.7 KB — `gen_02_litho_etch.py`)
**World Placement**: Installed in Etch & Thin-Film Deposition bays (Steps 2 & 3 of the wafer process route: reactive-ion plasma etch, PECVD dielectric films, ALD high-k gate oxide & PVD copper metallization). Each cluster has a recessed dark central vacuum transfer well on top so the rotating dual-blade frog-leg robot arm and 300 mm wafer are clearly visible from the isometric camera.

- **`Tool_PlasmaEtch_Cluster`** (`3.55 m × 3.92 m × 2.69 m`, `Z_min = 0.000 m`)
  - Multi-chamber Inductively Coupled Plasma (ICP) / Reactive-Ion Etch (RIE) cluster tool with central octagonal vacuum transfer module, 4 radial process chambers (`(-1.25, 0.35)`, `(-0.75, 1.45)`, `(0.75, 1.45)`, `(1.25, 0.35)`), copper RF matching coils, glowing cyan plasma viewports, front rectangular EFEM with 3 load ports and docked FOUPs, operator console, and signal tower.
  - **Moving Parts**:
    - `TransferRobotArm` (local pivot at central vacuum hub `(0.00, 0.35, 1.38)`): dual-blade vacuum wafer handler carrying a 300 mm patterned silicon wafer; rotates `360°` around local `Z` to index between load-locks and radial chambers.
    - `ChamberLid_01` (local pivot at `(-1.25, 0.35, 1.82)`): radial chamber top lid; lifts/tilts for chamber maintenance.
    - `ChamberLid_02` (local pivot at `(-0.75, 1.45, 1.82)`): radial chamber top lid.
    - `LoadPortDoor_01`..`LoadPortDoor_03` (local pivots at `(-0.75, -1.46, 0.98)`, `(0.00, -1.46, 0.98)`, `(0.75, -1.46, 0.98)`): vertical `Z` slide openers.
- **`Tool_CVD_Cluster`** (`3.55 m × 3.92 m × 2.69 m`, `Z_min = 0.000 m`)
  - Plasma-Enhanced Chemical Vapor Deposition (PECVD) cluster with 4 radial heated vacuum chambers, stainless precursor gas manifold lines, amber/cyan viewports, central vacuum transfer well, and 3-port EFEM.
  - **Moving Parts**:
    - `TransferRobotArm` (local pivot at `(0.00, 0.35, 1.38)`): rotates `360°` around local `Z` with 300 mm wafer.
    - `ChamberLid_01` (local pivot at `(-1.25, 0.35, 1.82)`), `ChamberLid_02` (local pivot at `(-0.75, 1.45, 1.82)`).
    - `LoadPortDoor_01`..`LoadPortDoor_03` (local pivots at `(±0.75/0.0, -1.46, 0.98)`).
- **`Tool_ALD_PVD_Cluster`** (`3.55 m × 3.92 m × 2.69 m`, `Z_min = 0.000 m`)
  - Atomic Layer Deposition (ALD) & Physical Vapor Deposition (PVD) copper/barrier cluster with copper magnetron sputter targets, cryopumps, central vacuum transfer well, and 3-port EFEM.
  - **Moving Parts**:
    - `TransferRobotArm` (local pivot at `(0.00, 0.35, 1.38)`): rotates `360°` around local `Z` with 300 mm wafer.
    - `ChamberLid_01` (local pivot at `(-1.25, 0.35, 1.82)`), `ChamberLid_02` (local pivot at `(-0.75, 1.45, 1.82)`).
    - `LoadPortDoor_01`..`LoadPortDoor_03` (local pivots at `(±0.75/0.0, -1.46, 0.98)`).

---

### 5. `implant_furnace_tools.glb` (925.3 KB — `gen_03_implant_cmp_metro.py`)
**World Placement**: Installed in Ion Implantation and Thermal Diffusion/Annealing bays (Steps 4 & 5 of the wafer route).

- **`Tool_IonImplanter_HighCurrent`** (`2.80 m × 4.60 m × 3.09 m`, `Z_min = 0.000 m`)
  - High-current beamline ion implanter with insulated high-voltage enclosure, side radiation-shielded access doors, front process endstation, 2 EFEM load ports with docked Hot-Lot & Standard FOUPs, and status tower.
  - **Moving Parts**:
    - `ImplantWheelPendulum` (local pivot at `(0.00, -0.80, 1.35)`): internal high-speed wafer scan pendulum wheel; rotates around local `Y`.
    - `LoadPortDoor_01`, `LoadPortDoor_02` (local pivots at `(-0.62, -1.86, 0.98)`, `(0.62, -1.86, 0.98)`): vertical `Z` slide openers.
- **`Tool_IonImplanter_MedCurrent`** (`2.68 m × 4.20 m × 2.99 m`, `Z_min = 0.000 m`)
  - Medium-current / high-energy ion implanter with 3 rear high-voltage accelerator column rings, side rotary target wheel assembly, and 3-port EFEM.
  - **Moving Parts**:
    - `BeamTargetWheel` (local pivot at `(1.22, -0.50, 1.32)`): rotary target scan hub; rotates around local `X`.
    - `LoadPortDoor_01`..`LoadPortDoor_03` (local pivots at `(-0.70, -1.66, 0.98)`, `(0.00, -1.66, 0.98)`, `(0.70, -1.66, 0.98)`).
- **`Tool_DiffusionFurnace_Vertical`** (`2.50 m × 3.20 m × 3.95 m`, `Z_min = 0.000 m`)
  - Tall `3.95 m` vertical batch oxidation / LPCVD / diffusion furnace with dual tall amber-lit quartz tube viewing windows on the front face, top twin exhaust stacks, internal vertical quartz boat elevator carrying a batch of 300 mm wafers, and 2-port EFEM.
  - **Moving Parts**:
    - `BoatElevatorCarriage` (local pivot at `(-0.52, -0.75, 1.25)`): vertical wafer boat elevator; translates vertically along `Z` (`0.0 m` to `+1.35 m`).
    - `LoadPortDoor_01`, `LoadPortDoor_02` (local pivots at `(-0.55, -1.16, 0.98)`, `(0.55, -1.16, 0.98)`).
- **`Tool_RTP_LaserAnneal`** (`2.40 m × 3.00 m × 2.89 m`, `Z_min = 0.000 m`)
  - Rapid Thermal Processing (RTP) & millisecond flash/laser spike anneal tool with top copper pyrometer & tungsten-halogen lamp array dome, and 2-port EFEM.
  - **Moving Parts**:
    - `RTPLampHead` (local pivot at `(0.00, 0.10, 2.46)`): copper lamp reflector ring on top of the anneal chamber; rotates around local `Z`.
    - `LoadPortDoor_01`, `LoadPortDoor_02` (local pivots at `(-0.52, -1.06, 0.98)`, `(0.52, -1.06, 0.98)`).

---

### 6. `cmp_wet_tools.glb` (788.7 KB — `gen_03_implant_cmp_metro.py`)
**World Placement**: Installed in CMP Planarization and Wet Chemical Clean bays (Step 6 of the wafer route).

- **`Tool_CMP_Polisher`** (`2.88 m × 4.00 m × 2.89 m`, `Z_min = 0.000 m`)
  - Chemical-Mechanical Planarization (CMP) polisher with clear wrap-around polycarbonate safety enclosure (`Z = 1.15–2.20 m`) revealing the wet granite polishing table, two rotating blue polyurethane polishing platens (`0.76 m` diameter), overhead 4-head rotary carrier carousel, diamond pad conditioner sweep arm, swing-arm operator console, and 3-port EFEM.
  - **Moving Parts**:
    - `CMPPlaten_01` (local pivot at `(-0.62, -0.35, 1.26)`): primary polishing table with concentric slurry grooves; rotates around local `Z`.
    - `CMPPlaten_02` (local pivot at `(0.62, -0.35, 1.26)`): secondary buffing platen; rotates around local `Z`.
    - `CMPCarouselHead` (local pivot at `(0.00, -0.15, 1.72)`): multi-head rotary wafer carrier; rotates/oscillates around local `Z`.
    - `CMPConditionerArm` (local pivot at `(-1.05, -0.75, 1.32)`): diamond conditioning disc sweep arm; pivots around local `Z` (`±25°`).
    - `LoadPortDoor_01`..`LoadPortDoor_03` (local pivots at `(-0.72, -1.56, 0.98)`, `(0.00, -1.56, 0.98)`, `(0.72, -1.56, 0.98)`).
- **`Tool_WetBench_Auto`** (`3.60 m × 2.60 m × 2.89 m`, `Z_min = 0.000 m`)
  - Automated multi-bath wet chemical cleaning station (`SC-1`, `DHF`, `SC-2`, `UPW Overflow Rinse`) with open front glass fume hood showing 4 illuminated chemical/DIW tanks, overhead linear gantry robot with vertical wafer-cassette dipper, and 2 front EFEM load ports.
  - **Moving Parts**:
    - `WetGantryRobot` (parent: `Tool_WetBench_Auto`, local pivot at `(-0.90, 0.25, 2.05)`): travels horizontally along the wet bench `X` rail (`-1.25 m` to `+1.25 m`).
    - `WetLiftHead` (parent: `WetGantryRobot`, local pivot at `(0.00, -0.22, -0.15)`): lowers/raises wafer carrier vertically along `Z` (`-0.55 m` to `0.0 m`) into the chemical baths.
    - `LoadPortDoor_01`, `LoadPortDoor_02` (local pivots at `(-0.85, -0.86, 0.98)`, `(0.85, -0.86, 0.98)`).
- **`Tool_SingleWaferCleaner`** (`2.60 m × 3.20 m × 2.89 m`, `Z_min = 0.000 m`)
  - High-throughput 4-chamber single-wafer megasonic & IPA Marangoni spin-rinse-dry cleaner with 4 glowing cyan side portholes, 3 front EFEM load ports, and internal spin-clean rotor.
  - **Moving Parts**:
    - `CleanerSpinRotor` (local pivot at `(0.00, 0.00, 1.45)`): rotates around local `Z`.
    - `LoadPortDoor_01`..`LoadPortDoor_03` (local pivots at `(-0.68, -1.16, 0.98)`, `(0.00, -1.16, 0.98)`, `(0.68, -1.16, 0.98)`).

---

### 7. `metrology_packaging_tools.glb` (764.7 KB — `gen_03_implant_cmp_metro.py`)
**World Placement**: Installed in Inline Metrology bays (Step 7 of the wafer route) and inside the Advanced 3D Packaging Plant (`FabBuilding_Packaging`).

- **`Tool_CDSEM_Metrology`** (`2.38 m × 2.60 m × 2.89 m`, `Z_min = 0.000 m`)
  - Critical-Dimension Scanning Electron Microscope (CD-SEM) & e-beam defect review tool on a heavy dark-slate active vibration-isolation base, with front glass window revealing the stainless field-emission electron column and copper objective lens ring, side operator console, and 2-port EFEM.
  - **Moving Parts**:
    - `SEMStageChuck` (local pivot at `(0.00, -0.25, 1.15)`): laser-interferometer X-Y stage holding a 300 mm patterned wafer; translates along `X`/`Y`.
    - `LoadPortDoor_01`, `LoadPortDoor_02` (local pivots at `(-0.48, -0.86, 0.98)`, `(0.48, -0.86, 0.98)`).
- **`Tool_OpticalDefect_Inspector`** (`2.40 m × 2.80 m × 2.79 m`, `Z_min = 0.000 m`)
  - Broadband plasma optical wafer defect & overlay scatterometry inspector with front observation window, internal scanning optical head, and 2-port EFEM.
  - **Moving Parts**:
    - `OpticalScanGantry` (local pivot at `(0.00, -0.25, 1.65)`): translates along `X`/`Y` above the wafer chuck.
    - `LoadPortDoor_01`, `LoadPortDoor_02` (local pivots at `(-0.50, -0.96, 0.98)`, `(0.50, -0.96, 0.98)`).
- **`Tool_DieBonder_3DPack`** (`2.20 m × 2.40 m × 2.59 m`, `Z_min = 0.000 m`)
  - Hybrid bonding / CoWoS thermocompression 3D die-to-wafer bonder with clear front window, precision granite bridge, and 2-port EFEM.
  - **Moving Parts**:
    - `BonderPickHead` (local pivot at `(0.00, -0.15, 1.58)`): high-speed die pick-and-place bonding head; translates along `X`/`Z`.
    - `LoadPortDoor_01`, `LoadPortDoor_02` (local pivots at `(-0.46, -0.76, 0.98)`, `(0.46, -0.76, 0.98)`).
- **`Tool_WaferProber_Test`** (`2.20 m × 2.40 m × 2.49 m`, `Z_min = 0.000 m`)
  - Final electrical sort & CP wafer prober with top hinged ATE test-head manipulator docked over the prober platen and 2-port EFEM.
  - **Moving Parts**:
    - `ProberTestHead` (local pivot at `(0.00, 0.05, 1.98)`): heavy ATE test head; hinges/rotates around local `X` (`0°` to `45°`).
    - `LoadPortDoor_01`, `LoadPortDoor_02` (local pivots at `(-0.46, -0.76, 0.98)`, `(0.46, -0.76, 0.98)`).

---

### 8. `oht_network.glb` (1,581.5 KB — `gen_04_oht_foup_subfab.py`)
**World Placement**: Suspended from the cleanroom ceiling grid (`Z ≈ 3.8–4.0 m`) and placed at bay intersections for automated FOUP buffering.

- **`OHT_Vehicle_Hoist`** (`0.84 m × 0.65 m × 0.85 m`, `Z_min = 0.000 m`)
  - Overhead Hoist Transport (OHT) ceiling monorail vehicle with white & Cobalt Blue chassis, front optical LiDAR obstacle sensor dome, cyan status LED strip, 4 articulated upper guide wheels with rims/hubs/lug bolts, vertical belt hoist mechanism, and gripper holding a 300 mm Hot-Lot FOUP pod.
  - **Moving Parts**:
    - `HoistWheel_FL`, `HoistWheel_FR`, `HoistWheel_RL`, `HoistWheel_RR` (local pivots at `(-0.26, -0.22, 0.72)`, `(-0.26, 0.22, 0.72)`, `(0.26, -0.22, 0.72)`, `(0.26, 0.22, 0.72)`): rotate around local `Y`.
    - `HoistBeltSpool` (parent: `OHT_Vehicle_Hoist`, local pivot at `(0.00, 0.00, 0.42)`): vertical hoist belt assembly; extends/scales along `Z`.
    - `HoistGripperHead` (parent: `HoistBeltSpool`, local pivot at `(0.00, 0.00, -0.18)`): active FOUP gripper + docked FOUP pod; translates vertically along `Z` (`0.0 m` down to `-2.8 m` to dock with tool EFEM load ports).
- **`OHT_Track_Straight_4m`** (`4.00 m × 0.56 m × 0.49 m`, `Z_min = 0.000 m`)
  - `4.0 m` straight extruded aluminum OHT monorail section with copper inductive power rails and ceiling hanger rods every `1.0 m`.
- **`OHT_Track_Curve_90`** (`2.29 m × 2.29 m × 0.49 m`, `Z_min = 0.000 m`)
  - `90°` curved OHT monorail turn (`R = 2.0 m`) with inner/outer guide rails, cross-ties, and ceiling hanger rods.
- **`OHT_Track_Switch_Y`** (`4.00 m × 1.38 m × 0.49 m`, `Z_min = 0.000 m`)
  - Interbay-to-intrabay OHT diverging Y-switch with branching rail and articulated switch diverter blade.
  - **Moving Parts**:
    - `TrackSwitchBlade` (local pivot at `(-0.80, 0.00, 0.12)`): rotates around local `Z` (`±15°`) to route OHT vehicles onto the bypass loop.
- **`OHT_Stocker_Tower`** (`3.20 m × 2.55 m × 4.49 m`, `Z_min = 0.000 m`)
  - Tall `4.5 m` automated interbay N2-purge FOUP stocker tower with open front glass inspection facade revealing twin 4-tier internal storage racks populated with Standard & Hot-Lot FOUP pods, central vertical mast, manual front EFEM port, and status tower.
  - **Moving Parts**:
    - `StockerElevator` (parent: `OHT_Stocker_Tower`, local pivot at `(0.00, 0.00, 1.50)`): translates vertically along the central mast (`Z = -0.9 m` to `+2.1 m`).
    - `StockerRobotArm` (parent: `StockerElevator`, local pivot at `(0.00, 0.00, 0.12)`): rotates around local `Z` and extends to pick/place FOUPs into storage cells.
- **`OHT_Reticle_Stocker`** (`2.00 m × 1.60 m × 3.09 m`, `Z_min = 0.000 m`)
  - Automated EUV/DUV photomask reticle library cabinet with UV-safe amber window and internal rotary reticle carousel.
  - **Moving Parts**:
    - `ReticleCarousel` (local pivot at `(0.00, 0.00, 1.55)`): rotates around local `Z`.

---

### 9. `foup_wafer_props.glb` (688.1 KB — `gen_04_oht_foup_subfab.py`)
**World Placement**: Instanced on tool EFEM load ports, inside stockers, on OHT hoists, or pushed along cleanroom aisles by operators and AMRs.

- **`Prop_FOUP_300mm_Std`** (`0.42 m × 0.40 m × 0.44 m`, `Z_min = 0.000 m`)
  - Standard 25-wafer 300 mm Front Opening Unified Pod in cleanroom white & Cobalt Blue with top robotic OHT mushroom flange, side kinematic handles, and translucent smoked polycarbonate front door (`FOUPDoor`, local pivot at `(0.00, -0.175, 0.21)`).
- **`Prop_FOUP_300mm_HotLot`** (`0.42 m × 0.40 m × 0.44 m`, `Z_min = 0.000 m`)
  - High-priority "Hot Lot" 300 mm FOUP pod in safety orange (`#FF5500`) with glowing cyan status beacon and articulated front door (`FOUPDoor_HotLot`, local pivot at `(0.00, -0.175, 0.21)`).
- **`Prop_ReticlePod_EUV`** (`0.38 m × 0.38 m × 0.19 m`, `Z_min = 0.000 m`)
  - Dual-pod EUV photomask carrier (EUV SMIF pod) in gold/amber trim with top robotic handling flange (`ReticlePodLid`, local pivot at `(0.00, 0.00, 0.13)`).
- **`Prop_Wafer_300mm_Display`** (`0.48 m × 0.48 m × 0.99 m`, `Z_min = 0.000 m`)
  - Cleanroom exhibition & metrology display pedestal supporting a tilted `300 mm` patterned silicon wafer (`WaferDisk_300mm`, local pivot at `(0.00, 0.00, 0.88)`, textured with `wafer_die_albedo.png`).
- **`Prop_AMR_WaferBot`** (`0.95 m × 0.72 m × 0.94 m`, `Z_min = 0.000 m`)
  - Autonomous Mobile Robot (AMR) cleanroom wafer transport bot with front LiDAR scanner, cyan perimeter safety LEDs, 4 articulated drive wheels (`AMRWheel_FL..RR`, local pivots at `(±0.28, ±0.34, 0.12)`), and top rotary turntable (`AMRTurntable`, local pivot at `(0.00, 0.00, 0.46)`) carrying a Standard 300 mm FOUP.
- **`Prop_Cleanroom_Cart`** (`0.95 m × 0.62 m × 0.98 m`, `Z_min = 0.000 m`)
  - Stainless-steel tubular cleanroom push-cart with 2 shelves, push handle, 4 articulated wheels (`CartWheel_FL..RR`, local pivots at `(±0.34, ±0.26, 0.09)`), and a Hot-Lot FOUP on the upper shelf.

---

### 10. `subfab_equipment.glb` (300.9 KB — `gen_04_oht_foup_subfab.py`)
**World Placement**: Installed on the Sub-Fab utility floor (`Z < 0` beneath the perforated cleanroom waffle slab), connected to the process tools above via vertical foreline and exhaust risers.

- **`Subfab_DryVacuumPump`** (`1.20 m × 1.80 m × 1.65 m`, `Z_min = 0.000 m`)
  - Twin-barrel dry screw roughing & Roots booster vacuum pump skid with vertical stainless foreline risers and an articulated orange butterfly throttle valve (`PumpThrottleValve`, local pivot at `(-0.30, 0.20, 1.15)`, rotates around local `Y`).
- **`Subfab_GasScrubber`** (`1.60 m × 1.60 m × 2.89 m`, `Z_min = 0.000 m`)
  - Point-of-Use (POU) burn/wet exhaust abatement scrubber with top reaction column, status tower, and spinning top exhaust blower (`ScrubberExhaustFan`, local pivot at `(0.35, -0.25, 2.38)`, rotates around local `Z`).
- **`Subfab_Chiller_PCW`** (`1.50 m × 2.00 m × 2.05 m`, `Z_min = 0.000 m`)
  - Process Cooling Water (PCW) heat exchanger & temperature control unit with front louver grille, UPW/PCW supply & return headers, and modulated flow control valve (`ChillerFlowValve`, local pivot at `(0.00, 0.00, 1.72)`, rotates around local `Z`).
- **`Subfab_VMB_GasCabinet`** (`1.20 m × 0.90 m × 2.59 m`, `Z_min = 0.000 m`)
  - Specialty gas Valve Manifold Box (VMB) & dual-cylinder cabinet with status tower and hinged front safety door with viewing window (`GasCabinetDoor`, local pivot at left hinge `(-0.56, -0.43, 1.12)`, swings open around local `Z`).
- **`Subfab_Slurry_CDS`** (`2.00 m × 1.60 m × 2.59 m`, `Z_min = 0.000 m`)
  - Bulk CMP slurry & high-purity chemical Central Delivery System (CDS) skid with UPW-teal day tank, white mix tank, containment bund, status tower, and top rotary mixer shaft (`SlurryMixerShaft`, local pivot at `(-0.48, -0.10, 1.85)`, rotates around local `Z`).

---

### 11. `fab_characters.glb` (681.1 KB — `gen_05_characters_campus.py`)
**World Placement**: Populating the cleanroom bays, yellow lithography room, spine corridor, and tool operator consoles.

- **4 Rigged Cleanroom Bunny-Suit Character Variants** (`1.78 m` tall, `Z_min = 0.000 m`):
  1. **`Char_FabEngineer_Blue`**: Cleanroom Process Engineer in white bunny suit with **Cobalt Electric Blue (`#1D5CFF`)** shoulder yoke & trim, full hood, dark protective goggles, face mask, blue nitrile gloves, cleanroom booties with sole treads, rear PAPR HEPA belt pack + breathing hose, and a glowing wafer-map diagnostic tablet in the right hand.
  2. **`Char_LithoTech_Yellow`**: Photolithography Specialist in white bunny suit with **Amber-Gold (`#FF9E1B`)** shoulder yoke & trim, UV-filtered amber visor goggles, PAPR pack, and a handheld reticle inspection wand.
  3. **`Char_MaintSpec_Orange`**: Equipment Maintenance Specialist in silver-grey ESD cleanroom suit with **Safety Orange (`#FF5500`)** shoulder yoke & trim, dark visor, PAPR pack, and a handheld helium leak-detector / calibration wrench.
  4. **`Char_MaterialHandler_Std`**: AMHS Material Handler in pure white bunny suit with **UPW Teal (`#00B8D9`)** shoulder yoke & trim, dark goggles, PAPR pack, and a handheld RFID FOUP barcode scanner.
- **Armature & Bone Hierarchy** (`<VariantName>_Armature`, 12 deform bones per character):
  - `Root` `(0, 0, 0)` -> `Hips` `(0, 0, 0.92)` -> `Spine` `(0, 0, 1.05)` -> `Chest` `(0, 0, 1.25)` -> `Head` `(0, 0, 1.50)`
  - `Chest` -> `UpperArm_L` / `UpperArm_R` `(±0.21, 0, 1.42)` -> `Forearm_L` / `Forearm_R` `(±0.24, 0, 1.16)`
  - `Hips` -> `Thigh_L` / `Thigh_R` `(±0.105, 0, 0.90)` -> `Shin_L` / `Shin_R` `(±0.105, 0, 0.48)`
- **5 Named NLA Animation Clips per Character** (`24 fps`, frames `1–25` looping):
  - `Idle`: Subtle breathing torso motion and cleanroom bay observation head turn.
  - `Walk`: Full cleanroom stride with alternating leg/knee articulation and arm counter-swing.
  - `Inspect`: Raising the right-hand diagnostic tablet/instrument while tilting head to inspect a wafer load port.
  - `CarryFOUP`: Both arms raised forward at `90°` to carry a 300 mm FOUP pod with a steady walk cycle.
  - `WorkConsole`: Typing/operating a tool SECS/GEM touchscreen console with alternating forearm motion.

---

### 12. `support_plant_buildings.glb` (547.1 KB — `gen_05_characters_campus.py`)
**World Placement**: Exterior utility campus surrounding the main wafer fab buildings (`UPW`, `Bulk Gas`, `Cooling Water`, `HV Electrical`).

- **`Plant_UPW_System`** (`8.50 m × 6.50 m × 4.55 m`, `Z_min = 0.000 m`)
  - Ultra-Pure Water (UPW) treatment & polishing plant with 2 tall `4.2 m` primary Reverse Osmosis (RO) storage silos with teal bands, horizontal RO membrane skid with 3 pressure vessels, 3 Cobalt Blue mixed-bed deionization (DI) columns with glowing cyan UV TOC sterilizer tubes, and a cylindrical degasifier blower column with a spinning top axial fan.
  - **Moving Parts**:
    - `UPWBlowerFan` (local pivot at `(2.40, -1.60, 1.28)`): 6-blade axial fan inside the degasifier blower housing; rotates around local `Z`.
- **`Plant_GasYard_Cryo`** (`8.00 m × 6.50 m × 5.15 m`, `Z_min = 0.000 m`)
  - Bulk industrial cryogenic gas yard (`LN2`, `LOX`, `LAr`, `H2`) with 3 tall `4.8 m` vertical vacuum-insulated cryogenic dewars, 4 finned ambient atmospheric vaporizer towers, and a hinged safety yellow access gate.
  - **Moving Parts**:
    - `GasYardGate` (local pivot at left hinge `(-0.90, -3.10, 0.35)`): swings open around local `Z`.
- **`Plant_CoolingTowers`** (`9.20 m × 5.20 m × 4.33 m`, `Z_min = 0.000 m`)
  - 3-cell modular induced-draft cooling tower bank with concrete cold-water basin (`UPW teal` water surface), 3 front intake louver bays, Cobalt Blue top deck fascia, and 3 large cylindrical fan shrouds with dark recessed intake wells and 6-blade axial fans.
  - **Moving Parts**:
    - `CoolingFan_01` (local pivot at `(-2.80, 0.00, 4.18)`): rotates around local `Z`.
    - `CoolingFan_02` (local pivot at `(0.00, 0.00, 4.18)`): rotates around local `Z`.
    - `CoolingFan_03` (local pivot at `(2.80, 0.00, 4.18)`): rotates around local `Z`.
- **`Plant_PowerSubstation`** (`8.50 m × 6.50 m × 3.63 m`, `Z_min = 0.000 m`)
  - High-voltage `161 kV / 22.8 kV` redundant power substation with 2 finned step-down transformers, 6 copper/ceramic HV insulator bushings, GIS switchgear building, and hinged maintenance door.
  - **Moving Parts**:
    - `SwitchgearDoor` (local pivot at `(0.00, -2.56, 1.35)`): swings open around local `Z`.

---

### 13. `campus_vehicles.glb` (640.7 KB — `gen_05_characters_campus.py`)
**World Placement**: Driving along the perimeter campus roads, passing through the security gatehouse, and docking at the Fab 1, Fab 2, Packaging Plant, and Gas Yard bays.

- **`Vehicle_WaferTruck`** (`6.20 m × 2.34 m × 3.05 m`, `Z_min = 0.000 m`)
  - Air-ride climate-controlled 300 mm wafer & reticle freight box truck in cleanroom white & Cobalt Blue livery with cab windshield, front grille, headlights/taillights, front rooftop refrigeration unit, rear hydraulic tail-lift, rear roll-up door, and 6 detailed wheels (`radius = 0.42 m`).
  - **Moving Parts**:
    - `Wheel_FL`, `Wheel_FR`, `Wheel_ML`, `Wheel_MR`, `Wheel_RL`, `Wheel_RR` (local pivots at axle centers `(1.85, ±1.02, 0.42)`, `(-1.25, ±1.02, 0.42)`, `(-2.35, ±1.02, 0.42)`): rotate around local `Y`.
    - `ReeferFan` (local pivot at `(1.12, 0.00, 2.55)`): rotates around local `X`.
    - `TailLift` (local pivot at `(-3.08, 0.00, 0.72)`): translates along `Z` / pitches around `Y`.
    - `RearDoor` (local pivot at `(-3.06, 0.00, 2.75)`): roll-up cargo door (`Z`).
- **`Vehicle_GasTanker`** (`7.35 m × 2.34 m × 2.75 m`, `Z_min = 0.000 m`)
  - Cryogenic liquid nitrogen (`LN2`) / ultra-pure chemical delivery semi-tanker with tractor cab, stainless cylindrical cryogenic tank with Cobalt Blue identification bands, rear valve cabinet, and 6 articulated wheels.
  - **Moving Parts**:
    - `Tanker_Wheel_FL/FR/ML/MR/RL/RR` (local pivots at `(2.20, ±1.02, 0.42)`, `(-1.45, ±1.02, 0.42)`, `(-2.60, ±1.02, 0.42)`): rotate around local `Y`.
    - `ValveCabinetDoor` (local pivot at `(-3.65, 0.00, 1.45)`): swings open around local `Z`.
- **`Vehicle_MaintenanceVan`** (`4.50 m × 2.02 m × 2.27 m`, `Z_min = 0.000 m`)
  - Fab facility & emergency tool response van with roof amber lightbar, Cobalt Blue side stripe, sliding side door, and 4 articulated wheels.
  - **Moving Parts**:
    - `Van_Wheel_FL/FR/RL/RR` (local pivots at `(1.35, ±0.88, 0.36)`, `(-1.35, ±0.88, 0.36)`): rotate around local `Y`.
    - `VanSideDoor` (local pivot at `(-0.10, -0.96, 1.12)`): slides along `X`.

---

### 14. `campus_environment.glb` (211.6 KB — `gen_05_characters_campus.py`)
**World Placement**: Modular road network, inter-building utility pipe bridges, security gate, backup generators, and landscaping around the semiconductor fab campus.

- **`Campus_SecurityGate`** (`4.60 m × 3.20 m × 2.65 m`, `Z_min = 0.000 m`)
  - Modern security guardhouse with wrap-around dark glass, Cobalt Blue overhang roof, and automated traffic barrier boom (`BarrierArm`, local pivot at `(0.95, -0.80, 0.95)`, rotates `0°–90°` around local `Y`).
- **`Campus_PipeBridge_8m`** (`8.00 m × 2.20 m × 4.46 m`, `Z_min = 0.000 m`)
  - Elevated `8.0 m` structural steel utility pipe bridge carrying 3 color-coded overhead pipelines (`UPW Teal`, `N2 Cobalt Blue`, `Exhaust Amber`) between the Support Plants and the Main Fab sub-fab level (`BridgeExpansionJoint` at `(0.0, 0.0, 4.18)`).
- **`Campus_Road_Straight_8m`** (`8.00 m × 6.40 m × 0.16 m`, `Z_min = 0.000 m`)
  - Two-lane dark asphalt campus road segment with concrete curbs and dashed center line markings.
- **`Campus_SolarGenerator_Pad`** (`5.20 m × 4.20 m × 2.60 m`, `Z_min = 0.000 m`)
  - Backup diesel generator enclosure & tilted dark-blue solar canopy array with hinged service door (`GenDoor`, local pivot at `(-0.80, -0.96, 1.25)`) and spinning radiator fan (`GenExhaustFan`, local pivot at `(0.85, 0.20, 1.25)`).
- **`Campus_Landscape_Set`** (`4.20 m × 2.20 m × 3.85 m`, `Z_min = 0.000 m`)
  - Sculpted architectural planter box with 2 stylized faceted campus trees, LED bollard, and a tall `3.6 m` street light pole (`LampHead`, local pivot at `(1.45, 0.00, 3.65)`).

---

### 15–23. Supplementary High-Detail Variant Suite (`build_argon_suite.py`)
All 9 supplementary `.glb` files in `app/public/assets/` (`cleanroom_structure.glb`, `etch_dep_clusters.glb`, `implant_anneal_tools.glb`, `cmp_wet_metrology.glb`, `oht_network_foup.glb`, `stocker_units.glb`, `subfab_utilities.glb`, `campus_buildings.glb`, `campus_vehicles_props.glb`) are also built, verified at `Z_min = 0.000 m`, and rendered in `blender/previews/`:
- **`cleanroom_structure.glb`**: `Floor_Cleanroom_Tile_4m`, `Floor_LithoBay_Tile_4m`, `Wall_Cutaway_Partition_4m`, `Wall_Airlock_Gowning_4m` (`Airlock_Door_L/R`), `Ceiling_FFU_Canopy_4m` (`FFU_Fan_1..4`), `Pillar_Safety_Station` (`Cabinet_Door`).
- **`etch_dep_clusters.glb`**: `Cluster_PlasmaEtch` (`Transfer_Robot_Arm`, `Chamber_1..4_Lid`, `Etch_LP_1..3_Door`), `Cluster_CVD_ALD` (`CVD_Transfer_Arm`, `CVD_Lid_1..3`, `CVD_LP_1..3_Door`), `Cluster_PVD_Metal` (`PVD_Transfer_Arm`, `Magnetron_Rotor_1..4`, `PVD_LP_1..3_Door`).
- **`implant_anneal_tools.glb`**: `Ion_Implanter_HighCurrent` (`Endstation_Wheel`, `IMP_LP_1..3_Door`), `Furnace_Vertical_Diffusion` (`Boat_Elevator`, `FUR_LP_1..2_Door`), `Anneal_RTP_Laser` (`RTP_Rotor`, `RTP_LP_1..2_Door`).
- **`cmp_wet_metrology.glb`**: `CMP_Polisher_TriPlaten` (`Platen_1..3`, `Carrier_Carousel`, `Conditioner_Arm`, `CMP_LP_1..3_Door`), `Wet_Bench_Auto` (`Gantry_Bridge` -> `Gantry_Hoist`, `Hood_Door`), `Metrology_EB_Inspector` (`SEM_Stage`, `EB_LP_1..2_Door`), `Metrology_Optical_Scatter` (`Optical_Head`, `OPT_LP_1..2_Door`).
- **`oht_network_foup.glb`**: `OHT_Vehicle_Standard` (`Wheel_FL..RR`, `Hoist_Slide` -> `Hoist_Gripper`), `OHT_Vehicle_Priority` (`Wheel_FL..RR`, `Hoist_Slide` -> `Hoist_Gripper`), `FOUP_Pod_Standard` (`Door`), `FOUP_Pod_HotLot` (`Door`), `Wafer_300mm_Single`, `OHT_Rail_Straight_4m`, `OHT_Rail_Curve_90`, `OHT_Rail_Switch_Merge` (`Switch_Tongue`).
- **`stocker_units.glb`**: `Stocker_Interbay_Tower` (`Stocker_Mast` -> `Stocker_Fork`, `STK_Manual_LP_Door`), `Stocker_Undertrack_Buffer`, `Stocker_Nitrogen_Purge` (`Service_Door`).
- **`subfab_utilities.glb`**: `Subfab_DryPump_Booster` (`Pump_Cooling_Fan`), `Subfab_PointOfUse_Abatement` (`Abatement_Door`), `Subfab_HeatExchanger_Chiller` (`Chiller_Fan`), `Subfab_GasCabinet_VMB` (`Cabinet_Door_L/R`), `Subfab_Waffle_Column_Rack`.
- **`campus_buildings.glb`**: `Building_Fab1_Shell` (`Fab1_Roof_Fan_1..2`), `Building_Fab2_RampUp` (`Crane_Turret` -> `Crane_Boom` -> `Crane_Hook`, `Fab2_Rigging_Door`), `Building_Packaging_Plant` (`AP1_Dock_Door_1..2`), `Support_UPW_Plant` (`UPW_Blower_Fan`), `Support_Gas_Yard`, `Support_Cooling_Tower_Bank` (`CT_Fan_1..3`), `Support_Power_Substation`.
- **`campus_vehicles_props.glb`**: `Vehicle_Wafer_Transport_Truck` (`Truck_Wheel_FL..RR`, `Truck_Rear_Door`), `Vehicle_Cryo_Gas_Tanker` (`Tanker_Wheel_FL..RR`), `Vehicle_Cleanroom_PGV` (`PGV_Wheel_FL..RR`, `PGV_Lift_Table`), `Bridge_Interfab_Skyway` (`Skyway_Damper`), `Gate_Campus_Security` (`Gate_Barrier_Arm`), `Prop_Campus_Trees_Planter`.
