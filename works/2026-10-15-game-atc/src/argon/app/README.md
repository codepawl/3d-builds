# SkyVigil — Port Solis Regional Airspace ATC (`game-atc-argon`)

A real-time 3D Air Traffic Control operations app styled like a clean isometric strategy game, built with **Blender 5.2** (10 procedural GLB asset families) and **Vite + React + React Three Fiber + Three.js**.

---

## Quick Start

```powershell
# From <project folder>\app
npm.cmd install
npm.cmd run dev
```

Open **`http://localhost:5424`** in Chromium / Chrome.

---

## Architecture & Features

### 1. Three Control Sectors (`Sites`)
- **`KPSA · TWR` — Port Solis Tower**: Coastal airport peninsula with two parallel precision instrument runways (`RWY 09L/27R` and `RWY 09R/27L`), modular taxiways, high-speed turnoffs, approach lighting pier bridges (`ALSF-2`), concrete gate apron (`G1–G3`), the 42m ATC Control Tower with spinning SMR dish & anemometer, Passenger Concourse with 3 articulated boarding bridges & 4 spinning HVAC chillers, two Maintenance Hangars with motorized sliding doors, ARFF Fire Station, ASR-11 Primary Surveillance Radar with rotating sweep cone, coastal lighthouse, container coaster ship, offshore wind turbines, and active aircraft + Ground Support Equipment (`GSE`) + rigged crew & wildlife.
- **`PSA · TMA` — Solis Bay Approach**: Terminal Manoeuvring Area around Port Solis featuring twin coastal landmasses divided by a river estuary and bridge, terraced hills, Doppler VOR/DME, ASR radar, labeled RNAV waypoint & holding stack pylons (`KESTL`, `NERON`, `VEXOR`, `SOLIS`, `BAYLI`, `MARIN`), a 3-tier `Holding_Stack_Racetrack`, arrival/departure paths, drifting convective storm cells (`Weather_Cell_CB_Heavy` & `Weather_Cell_Moderate`) that force automatic lateral route deviations, 3-state separation rings (`Nominal`, `Amber`, `Red`), altitude drop lines, and contrail history trails.
- **`SEC · NORTH` — North Ridge En-Route**: High-altitude regional sector (`FL240–FL410`) with highland reservoir lake, 3-tier mountain peaks, long-range geodesic `Radar_Enroute_Radome`, high-altitude jetways (`J-42`, `UL-850`, `Q-18`), crossing widebody and narrowbody traffic, and a severe thunderstorm supercell.

### 2. Plain Data Model & Seeded Simulation (`src/model/atcSimulation.js`)
- Drives both the 3D scene and the operational dashboard from a unified state (`sites`, `flights`, `groundUnits`, `weatherCells`, `events`, `kpis`).
- Deterministic frame-stepped updates (`advanceSimulation(state, dt)`) animate aircraft along 3D flight paths, compute pairwise horizontal/vertical separation in NM, trigger `Amber` and `Red` conflict rings, drift weather cells, and animate every moving sub-part and character NLA clip.
- Interactive **ATC Clearance Controls** (`Climb +2,000 ft`, `Descend −2,000 ft`, `Vector L 15°`, `Vector R 15°`, `Enter/Exit Hold`, `Clear ILS 09L`) apply immediately to any selected flight.

### 3. 3D Asset Pack (`app/public/assets/*.glb` & `blender/ASSETS.md`)
- 10 procedural GLB families (`11.13 MB` total) built headless in Blender 5.2 via `blender/build_all.py` and verified via `blender/preview.py` contact sheets in `blender/previews/`.
