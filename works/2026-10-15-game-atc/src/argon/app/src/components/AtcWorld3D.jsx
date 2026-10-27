import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { SITE_AIRWAY_LINES, SITE_WAYPOINTS, SITES } from '../model/atcSimulation';

const ASSET_PATHS = {
  terrain: '/assets/terrain_sectors.glb',
  runways: '/assets/airport_runways.glb',
  buildings: '/assets/airport_buildings.glb',
  jets: '/assets/aircraft_jets.glb',
  turboprops: '/assets/aircraft_turboprops.glb',
  vehicles: '/assets/ground_vehicles.glb',
  navaids: '/assets/navaids_waypoints.glb',
  viz: '/assets/airspace_viz.glb',
  props: '/assets/town_coast_props.glb',
  crew: '/assets/characters_crew.glb',
};

Object.values(ASSET_PATHS).forEach((p) => useGLTF.preload(p));

// Clone a named root node from a loaded GLTF scene and zero its root lineup offset
function cloneVariantNode(gltfScene, nodeName, isSkinned = false) {
  if (!gltfScene) return null;
  const target = gltfScene.getObjectByName(nodeName);
  if (!target) return null;
  const cloned = isSkinned ? cloneSkeleton(target) : target.clone(true);
  cloned.position.set(0, 0, 0);
  cloned.rotation.set(0, 0, 0);
  cloned.scale.set(1, 1, 1);
  cloned.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        child.material.side = THREE.FrontSide;
      }
    }
  });
  return cloned;
}

// ============================================================================
// STATIC & ANIMATED WORLD ENVIRONMENT PER SECTOR SITE
// ============================================================================

function SectorEnvironment({ siteId, onSelectObject, selectedId }) {
  const terrainGltf = useGLTF(ASSET_PATHS.terrain);
  const runwaysGltf = useGLTF(ASSET_PATHS.runways);
  const buildingsGltf = useGLTF(ASSET_PATHS.buildings);
  const navaidsGltf = useGLTF(ASSET_PATHS.navaids);
  const propsGltf = useGLTF(ASSET_PATHS.props);
  const vizGltf = useGLTF(ASSET_PATHS.viz);

  const rootRef = useRef();

  const sceneGraph = useMemo(() => {
    const group = new THREE.Group();
    const animNodes = {
      spinY: [],
      spinZ: [],
      slideDoors: [],
      jetBridges: [],
      windsockCones: [],
      fireDoors: [],
    };

    const addPlacement = (gltf, variantName, pos, rotY = 0, scale = [1, 1, 1], pickData = null) => {
      const node = cloneVariantNode(gltf.scene, variantName, false);
      if (!node) return null;
      node.position.set(pos[0], pos[1], pos[2]);
      node.rotation.set(0, rotY, 0);
      if (Array.isArray(scale)) {
        node.scale.set(scale[0], scale[1], scale[2]);
      } else {
        node.scale.setScalar(scale);
      }
      if (pickData) {
        node.userData.pickData = pickData;
        node.traverse((c) => {
          c.userData.pickData = pickData;
        });
      }

      // Collect moving sub-parts by name for real-time simulation animation
      node.traverse((c) => {
        const n = c.name;
        if (
          n === 'Tower_SMR_Dish' ||
          n === 'Tower_Anemometer' ||
          n === 'Tower_Beacon_Rotator' ||
          n.startsWith('Terminal_HVAC_Fan_') ||
          n === 'Radar_Dish_Assembly' ||
          n === 'Radar_Sweep_Cone' ||
          n === 'Radome_Beacon_Rotator' ||
          n === 'Pylon_Ring_Rotator' ||
          n === 'Hold_Ring_Lower' ||
          n === 'Hold_Ring_Upper' ||
          n === 'Lighthouse_Beacon' ||
          n === 'Ship_Radar_Scanner'
        ) {
          animNodes.spinY.push({ obj: c, speed: n.includes('Anemometer') ? 4.5 : n.includes('Hold_Ring_Upper') ? -1.4 : 1.8 });
        } else if (n === 'Turbine_Rotor') {
          animNodes.spinZ.push({ obj: c, speed: 2.2 });
        } else if (n.endsWith('_Door_L')) {
          animNodes.slideDoors.push({ obj: c, baseX: c.position.x, dir: -1 });
        } else if (n.endsWith('_Door_R')) {
          animNodes.slideDoors.push({ obj: c, baseX: c.position.x, dir: 1 });
        } else if (n.startsWith('JetBridge_Boom_')) {
          animNodes.jetBridges.push({ obj: c, baseRotY: c.rotation.y, idx: parseInt(n.slice(-1), 10) || 1 });
        } else if (n === 'Windsock_Cone') {
          animNodes.windsockCones.push({ obj: c });
        } else if (n.startsWith('FireBay_Door_')) {
          animNodes.fireDoors.push({ obj: c });
        }
      });

      group.add(node);
      return node;
    };

    if (siteId === 'tower') {
      // 1. Base Peninsula Terrain Platter (scaled 2.4x horizontally -> 201.6m x 201.6m)
      addPlacement(terrainGltf, 'Terrain_TowerSector', [-10, 0, 12], 0, [2.4, 1.0, 2.4]);

      // 2. Two Parallel Instrument Runways (RWY 09L/27R at z=-14, RWY 09R/27L at z=+10, rotated 90 deg along X)
      addPlacement(runwaysGltf, 'Runway_09L_27R', [0, 1.48, -14], Math.PI * 0.5, 1.0, {
        id: 'RWY-09L',
        callsign: 'RWY 09L/27R',
        name: 'Primary Precision Runway 09L/27R',
        category: 'runway',
        status: 'Approach',
        phase: 'Active Arrivals & Departures · 3,600m',
        pos: [0, 2.0, -14],
        details: { surface: 'Grooved Asphalt', ils: 'CAT IIIB 109.90 MHz', lighting: 'ALSF-2 + PAPI-4', occupancy: 'AZR-402 Final / SLS-118 Dep' },
      });
      addPlacement(runwaysGltf, 'Runway_09R_27L', [0, 1.48, 10], Math.PI * 0.5, 1.0, {
        id: 'RWY-09R',
        callsign: 'RWY 09R/27L',
        name: 'Secondary Parallel Runway 09R/27L',
        category: 'runway',
        status: 'Climbing',
        phase: 'Active Departures · 3,150m',
        pos: [0, 2.0, 10],
        details: { surface: 'Grooved Asphalt', ils: 'CAT II 110.35 MHz', lighting: 'HIRL + PAPI-4', occupancy: 'MRD-801 Airborne' },
      });

      // Approach Lighting Bridges (ALS) off western thresholds into bay
      addPlacement(runwaysGltf, 'Approach_Light_Bridge_ALS', [-76, 0.35, -14], Math.PI * 0.5, 0.85);
      addPlacement(runwaysGltf, 'Approach_Light_Bridge_ALS', [-68, 0.35, 10], Math.PI * 0.5, 0.80);

      // Parallel Taxiway Alpha & Rapid Exit Turnoffs
      for (const tx of [-36, -12, 12, 36]) {
        addPlacement(runwaysGltf, 'Taxiway_Straight_A', [tx, 1.48, -2.2], Math.PI * 0.5, 0.9);
      }
      addPlacement(runwaysGltf, 'Taxiway_RapidExit', [18, 1.48, -8.2], Math.PI * 0.5, 0.75);
      addPlacement(runwaysGltf, 'Taxiway_RapidExit', [-18, 1.48, 3.8], -Math.PI * 0.5, 0.75);
      addPlacement(runwaysGltf, 'Taxiway_Intersection_T', [0, 1.48, -21], 0, 0.85);

      // Concrete Gate Parking Apron & Main Passenger Terminal Concourse
      addPlacement(runwaysGltf, 'Apron_GatePad_Group', [0, 1.48, -27], 0, 1.0);
      addPlacement(buildingsGltf, 'Terminal_Concourse_Main', [0, 1.60, -44], 0, 0.95, {
        id: 'BLD-TERM',
        callsign: 'TERM-1',
        name: 'Port Solis Passenger Concourse A',
        category: 'facility',
        status: 'Normal',
        phase: 'Gates G1–G3 Operational · 3 JetBridges',
        pos: [0, 8.0, -44],
        details: { gates: 'G1 (Occupied), G2 (Inbound), G3 (Open)', paxFlow: '1,420 pax/hr', baggageSystem: 'Automated ULD Sort' },
      });

      // Iconic Control Tower overlooking Terminal & Runways
      addPlacement(buildingsGltf, 'Control_Tower_Main', [-36, 1.60, -40], 0, 0.95, {
        id: 'NAV-TWR',
        callsign: 'KPSA-TWR',
        name: 'Port Solis ATC Control Tower',
        category: 'facility',
        status: 'Normal',
        phase: 'Visual Control Room + SMR Radar Active',
        pos: [-36, 22.0, -40],
        details: { height: '42.0 m Cab Elevation', smrRadar: '24 RPM Surface Movement', frequency: '118.700 MHz Primary' },
      });

      // Maintenance Hangars A & B + ARFF Fire Station
      addPlacement(buildingsGltf, 'Maintenance_Hangar_A', [38, 1.60, -43], 0, 0.78, {
        id: 'BLD-HGR-A',
        callsign: 'HANGAR-A',
        name: 'Azura Fleet Maintenance Hangar A',
        category: 'facility',
        status: 'Normal',
        phase: 'Bay Doors Cycling · Line Check Active',
        pos: [38, 7.0, -43],
        details: { span: '28m Wide-Span Arch', bayStatus: 'A320N Avionics Check', doors: 'Motorized Dual-Leaf' },
      });
      addPlacement(buildingsGltf, 'Maintenance_Hangar_B', [62, 1.60, -43], 0, 0.75);
      addPlacement(buildingsGltf, 'ARFF_Fire_Station', [-58, 1.60, -34], 0, 0.82, {
        id: 'BLD-ARFF',
        callsign: 'ARFF-STN',
        name: 'Airfield Rescue & Firefighting Station',
        category: 'facility',
        status: 'Normal',
        phase: 'CAT 9 Foam Readiness · 3 Bays',
        pos: [-58, 6.0, -34],
        details: { responseTarget: '< 120 sec any threshold', units: 'Striker 6x6 RED-9 Active', watchTower: 'Occupied' },
      });

      // Navaids on Airfield: Primary ASR Radar, ILS Localizer, ILS Glideslope, Windsocks
      addPlacement(navaidsGltf, 'Radar_Primary_ASR', [42, 1.60, -24], 0, 0.90, {
        id: 'NAV-ASR1',
        callsign: 'ASR-11',
        name: 'Port Solis Terminal Surveillance Radar',
        category: 'navaid',
        status: 'Normal',
        phase: 'Primary S-Band + Mode-S MSSR Sweep',
        pos: [42, 12.0, -24],
        details: { range: '60 NM Terminal Coverage', rpm: '12.5 RPM Continuous', modeS: ' monopulse SSR' },
      });
      addPlacement(navaidsGltf, 'ILS_Localizer_Array', [66, 1.60, -14], -Math.PI * 0.5, 0.85);
      addPlacement(navaidsGltf, 'ILS_Glideslope_Tower', [-38, 1.60, -21], 0, 0.85);
      addPlacement(navaidsGltf, 'Windsock_Mast', [-44, 1.60, -6], 0, 0.90);
      addPlacement(navaidsGltf, 'Windsock_Mast', [44, 1.60, 2], 0, 0.90);

      // Coastal Props: Lighthouse on SW headland, Container Ship in Bay, Offshore Wind Turbines, Town & Trees
      addPlacement(propsGltf, 'Coastal_Lighthouse_Pier', [-74, 0.40, 42], 0.4, 0.95);
      addPlacement(propsGltf, 'Cargo_Ship_Coaster', [-28, 0.38, 56], Math.PI * 0.45, 0.95);
      addPlacement(propsGltf, 'Wind_Turbine_Offshore', [52, 0.40, 62], -0.3, 0.85);
      addPlacement(propsGltf, 'Wind_Turbine_Offshore', [74, 0.40, 52], -0.3, 0.85);
      addPlacement(propsGltf, 'Town_Block_Commercial', [-24, 1.43, -64], 0, 0.85);
      addPlacement(propsGltf, 'Town_Block_Residential', [4, 1.43, -64], 0, 0.85);
      addPlacement(propsGltf, 'Town_Block_Residential', [28, 1.43, -64], 0, 0.85);
      for (const [tx, tz] of [[-52, -56], [-40, -62], [52, -58], [68, -28], [-64, -18]]) {
        addPlacement(propsGltf, 'Tree_Cluster_Pine', [tx, 1.43, tz], tx * 0.3, 0.9);
      }
      for (const [tx, tz] of [[-12, -58], [18, -58], [46, -56]]) {
        addPlacement(propsGltf, 'Tree_Cluster_Deciduous', [tx, 1.43, tz], tz * 0.2, 0.9);
      }
    } else if (siteId === 'approach') {
      // ======================== SITE 2: SOLIS BAY APPROACH (TMA) ========================
      addPlacement(terrainGltf, 'Terrain_ApproachSector', [0, 0, 0], 0, [2.4, 1.15, 2.4]);
      addPlacement(terrainGltf, 'Hill_Cluster_A', [-58, 1.13, -44], 0.3, 1.3);
      addPlacement(terrainGltf, 'Hill_Cluster_B', [58, 1.13, -48], -0.4, 1.3);
      addPlacement(terrainGltf, 'Coast_Cliff_A', [-68, 0.40, 38], 0.6, 1.3);

      // Miniature Destination Airport Reference on East Peninsula
      addPlacement(runwaysGltf, 'Runway_09L_27R', [64, 1.15, 18], Math.PI * 0.5, 0.45);
      addPlacement(buildingsGltf, 'Control_Tower_Main', [64, 1.15, 10], 0, 0.55);

      // 3-Tier Holding Stack Racetrack over KESTL (-38, -18)
      addPlacement(vizGltf, 'Holding_Stack_Racetrack', [-38, 6.5, -18], 0.35, [1.55, 1.15, 1.35]);

      // Radars & VOR/DME in TMA
      addPlacement(navaidsGltf, 'Radar_Primary_ASR', [38, 1.13, -4], 0, 1.05);
      addPlacement(navaidsGltf, 'VOR_DME_Station', [-26, 1.13, 32], 0, 1.1);

      // Towns, Lighthouse, Ships & Wind Farm across Solis Bay TMA
      addPlacement(propsGltf, 'Town_Block_Commercial', [-44, 1.13, 12], 0, 1.0);
      addPlacement(propsGltf, 'Town_Block_Residential', [-24, 1.13, 12], 0, 1.0);
      addPlacement(propsGltf, 'Town_Block_Commercial', [56, 1.13, -12], 0, 0.95);
      addPlacement(propsGltf, 'Town_Block_Residential', [56, 1.13, 4], 0, 0.95);
      addPlacement(propsGltf, 'Coastal_Lighthouse_Pier', [-12, 0.40, 56], 0.2, 1.05);
      addPlacement(propsGltf, 'Cargo_Ship_Coaster', [18, 0.38, 46], -0.4, 1.05);
      addPlacement(propsGltf, 'Wind_Turbine_Offshore', [-56, 0.40, 62], 0.2, 0.95);
      addPlacement(propsGltf, 'Wind_Turbine_Offshore', [-36, 0.40, 66], 0.2, 0.95);
      for (const [tx, tz] of [[-66, -12], [-48, -32], [44, -36], [68, -28], [-22, -48]]) {
        addPlacement(propsGltf, 'Tree_Cluster_Pine', [tx, 1.13, tz], tx, 1.05);
        addPlacement(propsGltf, 'Tree_Cluster_Deciduous', [tx + 8, 1.13, tz + 6], tz, 1.0);
      }
    } else {
      // ======================== SITE 3: NORTH RIDGE EN-ROUTE ========================
      addPlacement(terrainGltf, 'Terrain_EnrouteSector', [0, 0, 0], 0, [2.4, 1.25, 2.4]);
      addPlacement(terrainGltf, 'Hill_Cluster_A', [-64, 0.90, -24], 0.5, 1.5);
      addPlacement(terrainGltf, 'Hill_Cluster_B', [-18, 0.90, 54], -0.2, 1.5);

      // Long-Range ARSR Geodesic Radome on Mountain Peak + High-Power VOR/DME
      addPlacement(navaidsGltf, 'Radar_Enroute_Radome', [36, 8.20, 28], 0, 1.15);
      addPlacement(navaidsGltf, 'VOR_DME_Station', [-4, 0.90, -10], 0, 1.15);
      addPlacement(vizGltf, 'Holding_Stack_Racetrack', [-42, 9.0, 36], -0.3, [1.5, 1.1, 1.3]);

      // Highland Towns, Ridge Wind Turbines & Alpine Pine Forests
      addPlacement(propsGltf, 'Town_Block_Residential', [-58, 0.90, 12], 0, 0.95);
      addPlacement(propsGltf, 'Town_Block_Commercial', [-22, 0.90, -38], 0, 0.95);
      addPlacement(propsGltf, 'Wind_Turbine_Offshore', [24, 6.20, -44], 0.4, 0.90);
      addPlacement(propsGltf, 'Wind_Turbine_Offshore', [42, 5.80, -38], 0.4, 0.90);
      for (const [tx, tz] of [[-68, -48], [-48, -56], [12, -52], [62, -12], [-64, 48], [16, 48]]) {
        addPlacement(propsGltf, 'Tree_Cluster_Pine', [tx, 0.90, tz], tx * 0.4, 1.25);
      }
    }

    // Add Waypoint & Holding Fix Pylons for current site
    const waypoints = SITE_WAYPOINTS[siteId] || [];
    for (const wp of waypoints) {
      if (wp.type === 'fix' || wp.type === 'hold') {
        const variant = wp.type === 'hold' ? 'Waypoint_Holding_Pylon_B' : 'Waypoint_Fix_Pylon_A';
        addPlacement(navaidsGltf, variant, wp.pos, 0, 1.15, {
          id: wp.id,
          callsign: wp.code,
          name: wp.name,
          category: 'waypoint',
          status: wp.type === 'hold' ? 'Caution' : 'Normal',
          phase: `${wp.freq} · ${wp.altConstraint}`,
          pos: [wp.pos[0], wp.pos[1] + 6, wp.pos[2]],
          details: { fixCode: wp.code, procedure: wp.freq, altitudeConstraint: wp.altConstraint, sector: siteId.toUpperCase() },
        });
      }
    }

    // Add Airway Gate Chevrons along site airway lines
    const airwayLines = SITE_AIRWAY_LINES[siteId] || [];
    for (const aw of airwayLines) {
      for (let i = 0; i < aw.points.length - 1; i++) {
        const p0 = aw.points[i];
        const p1 = aw.points[i + 1];
        const mx = (p0[0] + p1[0]) * 0.5;
        const my = (p0[1] + p1[1]) * 0.5;
        const mz = (p0[2] + p1[2]) * 0.5;
        const dx = p1[0] - p0[0];
        const dz = p1[2] - p0[2];
        const yaw = Math.atan2(-dx, -dz);
        addPlacement(vizGltf, 'Airway_Gate_Chevron', [mx, my, mz], yaw, 0.85);
      }
    }

    return { group, animNodes };
  }, [siteId, terrainGltf, runwaysGltf, buildingsGltf, navaidsGltf, propsGltf, vizGltf]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const { animNodes } = sceneGraph;
    for (const item of animNodes.spinY) {
      item.obj.rotation.y += delta * item.speed;
    }
    for (const item of animNodes.spinZ) {
      item.obj.rotation.z += delta * item.speed;
    }
    for (const d of animNodes.slideDoors) {
      const openAmt = (Math.sin(t * 0.55) * 0.5 + 0.5) * 4.8;
      d.obj.position.x = d.baseX + d.dir * openAmt;
    }
    for (const jb of animNodes.jetBridges) {
      jb.obj.rotation.y = jb.baseRotY + Math.sin(t * 0.4 + jb.idx) * 0.08;
    }
    for (const ws of animNodes.windsockCones) {
      ws.obj.rotation.y = 0.35 + Math.sin(t * 1.8) * 0.16;
    }
    for (const fd of animNodes.fireDoors) {
      fd.obj.scale.y = 0.25 + (Math.sin(t * 0.45) * 0.5 + 0.5) * 0.75;
    }
  });

  const waypoints = SITE_WAYPOINTS[siteId] || [];
  const airwayLines = SITE_AIRWAY_LINES[siteId] || [];

  return (
    <group ref={rootRef}>
      <primitive
        object={sceneGraph.group}
        onClick={(e) => {
          const pick = e.object?.userData?.pickData;
          if (pick) {
            e.stopPropagation();
            onSelectObject(pick.id);
          }
        }}
      />

      {/* Airway & Approach Corridor 3D Map Lines */}
      {airwayLines.map((aw) => (
        <Line
          key={aw.id}
          points={aw.points}
          color={aw.color}
          lineWidth={2.2}
          dashed
          dashSize={2.4}
          gapSize={1.2}
          transparent
          opacity={0.78}
        />
      ))}

      {/* Waypoint & Navaid Floating Labels */}
      {waypoints.map((wp) => {
        const isSel = selectedId === wp.id;
        return (
          <Html
            key={wp.id}
            position={[wp.pos[0], wp.pos[1] + (wp.type === 'tower' ? 17.5 : 11.5), wp.pos[2]]}
            center
            zIndexRange={[10, 0]}
          >
            <button
              type="button"
              className={`pin-waypoint ${isSel ? 'is-selected' : ''} type-${wp.type}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectObject(wp.id);
              }}
            >
              <span className="pin-wp-icon">{wp.type === 'hold' ? '▲' : wp.type === 'radar' || wp.type === 'radome' ? '●' : '◆'}</span>
              <span className="pin-wp-code">{wp.code}</span>
            </button>
          </Html>
        );
      })}
    </group>
  );
}

// ============================================================================
// RIGGED CHARACTERS & WILDLIFE WITH NLA ANIMATION CLIPS
// ============================================================================

function RiggedCrewActors({ siteId }) {
  const crewGltf = useGLTF(ASSET_PATHS.crew);

  const actors = useMemo(() => {
    if (siteId !== 'tower') return [];
    const defs = [
      { arm: 'Armature_Marshaller', clip: 'Marshaller_Signal_Turn', pos: [-16, 1.62, -18.5], rotY: 0, scale: 1.45 },
      { arm: 'Armature_Marshaller', clip: 'Marshaller_Signal_Stop', pos: [0, 1.62, -18.5], rotY: 0, scale: 1.45 },
      { arm: 'Armature_Tech', clip: 'Tech_Inspect', pos: [-11.5, 1.62, -22.5], rotY: 0.6, scale: 1.45 },
      { arm: 'Armature_K9', clip: 'K9_Walk', pos: [-48, 1.62, -26.0], rotY: 1.2, scale: 1.55 },
      { arm: 'Armature_Gull', clip: 'Gull_Flap_Climb', pos: [-66, 16.5, 36.0], rotY: 0.8, scale: 1.4 },
      { arm: 'Armature_Gull', clip: 'Gull_Glide_Circle', pos: [-58, 18.0, 42.0], rotY: 1.4, scale: 1.4 },
    ];

    return defs
      .map((d, idx) => {
        const cloned = cloneVariantNode(crewGltf.scene, d.arm, true);
        if (!cloned) return null;
        cloned.position.set(d.pos[0], d.pos[1], d.pos[2]);
        cloned.rotation.set(0, d.rotY, 0);
        cloned.scale.setScalar(d.scale);
        const mixer = new THREE.AnimationMixer(cloned);
        const clipObj =
          crewGltf.animations.find((a) => a.name === d.clip) || crewGltf.animations[0];
        if (clipObj) {
          const action = mixer.clipAction(clipObj);
          action.play();
        }
        return { id: `actor-${idx}`, obj: cloned, mixer, isGull: d.arm === 'Armature_Gull', basePos: d.pos, phase: idx * 1.7 };
      })
      .filter(Boolean);
  }, [siteId, crewGltf]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    for (const a of actors) {
      a.mixer.update(delta);
      if (a.isGull) {
        const ang = t * 0.45 + a.phase;
        a.obj.position.x = a.basePos[0] + Math.cos(ang) * 9.0;
        a.obj.position.z = a.basePos[2] + Math.sin(ang) * 9.0;
        a.obj.rotation.y = -ang;
      }
    }
  });

  return (
    <group>
      {actors.map((a) => (
        <primitive key={a.id} object={a.obj} />
      ))}
    </group>
  );
}

// ============================================================================
// DYNAMIC AIRCRAFT UNIT (JET / TURBOPROP + SEPARATION RING + DROP PIN + TRAIL)
// ============================================================================

function AircraftUnit({ flight, groundY, isSelected, onSelect }) {
  const jetsGltf = useGLTF(ASSET_PATHS.jets);
  const propsGltf = useGLTF(ASSET_PATHS.turboprops);
  const vizGltf = useGLTF(ASSET_PATHS.viz);

  const groupRef = useRef();
  const bodyRef = useRef();
  const sepGroupRef = useRef();
  const reticleRef = useRef();
  const stemRef = useRef();

  const { aircraftNode, movingParts, sepRings, reticleNode } = useMemo(() => {
    const srcGltf = flight.family === 'aircraft_jets' ? jetsGltf : propsGltf;
    const ac = cloneVariantNode(srcGltf.scene, flight.variant, false);
    const parts = { rotors: [], gears: [], wheels: [], cargoDoor: null };

    if (ac) {
      ac.scale.setScalar(0.56); // Tactical readable strategy-game scale
      ac.traverse((c) => {
        if (c.name.includes('_Fan_') || c.name.includes('_Prop_')) {
          parts.rotors.push(c);
        } else if (c.name.includes('_Gear_')) {
          parts.gears.push(c);
        } else if (c.name.includes('_Wheel_')) {
          parts.wheels.push(c);
        } else if (c.name.includes('_Cargo_Door')) {
          parts.cargoDoor = c;
        }
      });
    }

    const sNom = cloneVariantNode(vizGltf.scene, 'Separation_Ring_Nominal', false);
    const sAmb = cloneVariantNode(vizGltf.scene, 'Separation_Ring_Amber', false);
    const sRed = cloneVariantNode(vizGltf.scene, 'Separation_Ring_Red', false);
    [sNom, sAmb, sRed].forEach((s) => {
      if (s) s.scale.setScalar(0.82);
    });

    const ret = cloneVariantNode(vizGltf.scene, 'Altitude_Drop_Pin', false);
    return {
      aircraftNode: ac,
      movingParts: parts,
      sepRings: { Nominal: sNom, Amber: sAmb, Red: sRed },
      reticleNode: ret,
    };
  }, [flight.family, flight.variant, jetsGltf, propsGltf, vizGltf]);

  useFrame((state, delta) => {
    if (!groupRef.current || !flight.pos) return;
    const [px, py, pz] = flight.pos;
    groupRef.current.position.set(px, py, pz);

    if (bodyRef.current) {
      bodyRef.current.rotation.set(flight.pitch || 0, flight.yaw || 0, flight.bank || 0);
    }

    // Spin turbofans / turboprops & wheels
    for (const r of movingParts.rotors) {
      r.rotation.z += delta * 18.0;
    }
    for (const w of movingParts.wheels) {
      if (flight.speed > 5) {
        w.rotation.x += delta * 6.0;
      }
    }
    // Retract landing gear when airborne above 1,600 ft
    const gearExtended = flight.altitude < 1600;
    for (const g of movingParts.gears) {
      g.visible = gearExtended;
    }
    if (movingParts.cargoDoor) {
      movingParts.cargoDoor.rotation.y = flight.altitude < 50 ? 0.95 : 0.0;
    }

    // Spin separation ring inner spinner
    if (sepGroupRef.current) {
      sepGroupRef.current.rotation.y = flight.yaw || 0;
      sepGroupRef.current.traverse((c) => {
        if (c.name.startsWith('SepRing_Spinner_')) {
          c.rotation.y += delta * (flight.sepStatus === 'Red' ? 3.8 : flight.sepStatus === 'Amber' ? 2.4 : 1.1);
        }
      });
    }

    // Update ground reticle & drop line stem
    const dropH = Math.max(0.1, py - groundY);
    if (reticleRef.current) {
      reticleRef.current.position.set(0, -dropH, 0);
      reticleRef.current.rotation.y += delta * 1.2;
    }
    if (stemRef.current) {
      stemRef.current.position.set(0, -dropH * 0.5, 0);
      stemRef.current.scale.set(1, dropH, 1);
    }
  });

  const activeSepRing = sepRings[flight.sepStatus] || sepRings.Nominal;
  const isAirborne = flight.altitude > 80;
  const trailPoints =
    flight.history && flight.history.length >= 2
      ? flight.history
      : [
          [flight.pos[0], flight.pos[1], flight.pos[2]],
          [flight.pos[0] - 0.1, flight.pos[1], flight.pos[2] - 0.1],
        ];

  const statusShape =
    flight.status === 'Conflict'
      ? '⬢'
      : flight.status === 'Caution'
      ? '▲'
      : flight.status === 'Approach'
      ? '◆'
      : flight.status === 'Climbing'
      ? '▲'
      : flight.status === 'OnGround'
      ? '■'
      : '●';

  return (
    <>
      <group
        ref={groupRef}
        position={flight.pos}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(flight.id);
        }}
      >
        <group ref={bodyRef}>
          {aircraftNode && <primitive object={aircraftNode} />}
        </group>

        {/* Separation Ring around Airborne Aircraft */}
        {isAirborne && activeSepRing && (
          <group ref={sepGroupRef} position={[0, -0.2, 0]}>
            <primitive object={activeSepRing} />
          </group>
        )}

        {/* Selection Highlight Ring */}
        {isSelected && (
          <mesh rotation={[-Math.PI * 0.5, 0, 0]} position={[0, -0.35, 0]}>
            <ringGeometry args={[5.2, 6.1, 36]} />
            <meshBasicMaterial color="#1d5bff" transparent opacity={0.92} side={THREE.DoubleSide} />
          </mesh>
        )}

        {/* Thin Vertical Altitude Drop Line & Ground Target Reticle */}
        {isAirborne && (
          <>
            <mesh ref={stemRef}>
              <cylinderGeometry args={[0.07, 0.07, 1.0, 8]} />
              <meshBasicMaterial
                color={flight.sepStatus === 'Red' ? '#ef4444' : flight.sepStatus === 'Amber' ? '#f59e0b' : '#1d5bff'}
                transparent
                opacity={0.55}
              />
            </mesh>
            <group ref={reticleRef}>
              <mesh rotation={[-Math.PI * 0.5, 0, 0]} position={[0, 0.08, 0]}>
                <ringGeometry args={[1.1, 1.55, 24]} />
                <meshBasicMaterial
                  color={flight.sepStatus === 'Red' ? '#ef4444' : flight.sepStatus === 'Amber' ? '#f59e0b' : '#06b6d4'}
                  transparent
                  opacity={0.75}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          </>
        )}

        {/* Floating Strategy-Game Callsign & Flight Level Tag */}
        <Html position={[0, 3.2, 0]} center zIndexRange={[30, 0]}>
          <button
            type="button"
            className={`pin-flight status-${flight.status.toLowerCase()} ${isSelected ? 'is-selected' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(flight.id);
            }}
          >
            <span className="pin-shape">{statusShape}</span>
            <span className="pin-callsign">{flight.callsign}</span>
            <span className="pin-alt">
              {flight.altitude > 100
                ? `FL${String(Math.round(flight.altitude / 100)).padStart(3, '0')}`
                : 'GND'}
            </span>
          </button>
        </Html>
      </group>

      {/* Soft Contrail History Line */}
      {isAirborne && trailPoints.length >= 2 && (
        <Line
          points={trailPoints}
          color={flight.sepStatus === 'Red' ? '#fca5a5' : flight.sepStatus === 'Amber' ? '#fcd34d' : '#ffffff'}
          lineWidth={2.0}
          transparent
          opacity={0.62}
        />
      )}
    </>
  );
}

// ============================================================================
// DYNAMIC GROUND SUPPORT VEHICLE UNIT
// ============================================================================

function GroundVehicleUnit({ unit, isSelected, onSelect }) {
  const vehiclesGltf = useGLTF(ASSET_PATHS.vehicles);
  const groupRef = useRef();

  const { vehicleNode, wheels, liftBox, fuelBoom, signBoard, turretBoom } = useMemo(() => {
    const v = cloneVariantNode(vehiclesGltf.scene, unit.variant, false);
    const wh = [];
    let lb = null;
    let fb = null;
    let sb = null;
    let tb = null;
    if (v) {
      v.scale.setScalar(0.95);
      v.traverse((c) => {
        if (c.name.includes('_Wheel_')) wh.push(c);
        if (c.name === 'Catering_Box_Body') lb = c;
        if (c.name === 'Fuel_Boom_Arm') fb = c;
        if (c.name === 'FollowMe_SignBoard') sb = c;
        if (c.name === 'Turret_Boom') tb = c;
      });
    }
    return { vehicleNode: v, wheels: wh, liftBox: lb, fuelBoom: fb, signBoard: sb, turretBoom: tb };
  }, [unit.variant, vehiclesGltf]);

  useFrame((state, delta) => {
    if (!groupRef.current || !unit.pos) return;
    const t = state.clock.elapsedTime;
    groupRef.current.position.set(unit.pos[0], unit.pos[1], unit.pos[2]);
    groupRef.current.rotation.set(0, unit.yaw || 0, 0);

    for (const w of wheels) {
      if (unit.speed > 0) {
        w.rotation.x += delta * 4.5;
      }
    }
    if (liftBox) {
      liftBox.position.y = 1.85 + (Math.sin(t * 0.8) * 0.5 + 0.5) * 1.15;
    }
    if (fuelBoom) {
      fuelBoom.rotation.y = Math.sin(t * 0.6) * 0.45;
    }
    if (signBoard) {
      signBoard.rotation.x = Math.sin(t * 0.9) * 0.15;
    }
    if (turretBoom) {
      turretBoom.rotation.y = Math.sin(t * 0.7) * 0.5;
    }
  });

  return (
    <group
      ref={groupRef}
      position={unit.pos}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(unit.id);
      }}
    >
      {vehicleNode && <primitive object={vehicleNode} />}
      {isSelected && (
        <mesh rotation={[-Math.PI * 0.5, 0, 0]} position={[0, 0.12, 0]}>
          <ringGeometry args={[3.2, 3.9, 28]} />
          <meshBasicMaterial color="#1d5bff" transparent opacity={0.92} side={THREE.DoubleSide} />
        </mesh>
      )}
      <Html position={[0, 4.2, 0]} center zIndexRange={[20, 0]}>
        <button
          type="button"
          className={`pin-ground ${isSelected ? 'is-selected' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(unit.id);
          }}
        >
          <span className="pin-shape">■</span>
          <span className="pin-callsign">{unit.callsign}</span>
        </button>
      </Html>
    </group>
  );
}

// ============================================================================
// DRIFTING CONVECTIVE WEATHER CELL
// ============================================================================

function WeatherCellUnit({ wx, groundY, isSelected, onSelect }) {
  const vizGltf = useGLTF(ASSET_PATHS.viz);
  const groupRef = useRef();

  const { wxNode, anvilNode, lightningNodes, rainRing } = useMemo(() => {
    const node = cloneVariantNode(vizGltf.scene, wx.variant, false);
    let anvil = null;
    const bolts = [];
    let ring = null;
    if (node) {
      node.scale.setScalar(1.35);
      node.traverse((c) => {
        if (c.name === 'Storm_Anvil_Swirl') anvil = c;
        if (c.name.startsWith('Lightning_Core_')) bolts.push(c);
        if (c.name === 'Rain_Curtain_Ring') ring = c;
      });
    }
    return { wxNode: node, anvilNode: anvil, lightningNodes: bolts, rainRing: ring };
  }, [wx.variant, vizGltf]);

  useFrame((state, delta) => {
    if (!groupRef.current || !wx.pos) return;
    const t = state.clock.elapsedTime;
    groupRef.current.position.set(wx.pos[0], groundY, wx.pos[2]);
    if (anvilNode) anvilNode.rotation.y += delta * 0.45;
    if (rainRing) rainRing.rotation.y -= delta * 0.65;
    lightningNodes.forEach((b, idx) => {
      const pulse = Math.sin(t * 6.5 + idx * 2.1) > 0.35 ? 1.25 : 0.4;
      b.scale.setScalar(pulse);
    });
  });

  return (
    <group
      ref={groupRef}
      position={[wx.pos[0], groundY, wx.pos[2]]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(wx.id);
      }}
    >
      {wxNode && <primitive object={wxNode} />}
      {isSelected && (
        <mesh rotation={[-Math.PI * 0.5, 0, 0]} position={[0, 0.25, 0]}>
          <ringGeometry args={[wx.radius * 0.92, wx.radius * 1.02, 36]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}
      <Html position={[0, 19.5, 0]} center zIndexRange={[15, 0]}>
        <button
          type="button"
          className={`pin-weather ${isSelected ? 'is-selected' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(wx.id);
          }}
        >
          <span className="pin-shape">▲</span>
          <span>{wx.callsign}</span>
        </button>
      </Html>
    </group>
  );
}

// ============================================================================
// ROTATING RADAR SWEEP LIGHT & GROUND BEAM DISC
// ============================================================================

function RadarSweepOverlay({ siteObj, showSweep }) {
  const sweepRef = useRef();
  const spotRef = useRef();

  useFrame((_, delta) => {
    if (sweepRef.current) {
      sweepRef.current.rotation.y -= delta * 0.85;
    }
    if (spotRef.current) {
      const a = sweepRef.current ? sweepRef.current.rotation.y : 0;
      spotRef.current.position.set(Math.cos(a) * 55, 38, Math.sin(a) * 55);
    }
  });

  if (!showSweep) return null;

  return (
    <group position={[0, siteObj.groundY + 0.08, 0]}>
      <group ref={sweepRef}>
        <mesh rotation={[-Math.PI * 0.5, 0, 0]}>
          <ringGeometry args={[4.0, 88.0, 32, 1, 0, Math.PI * 0.22]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.14} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[-Math.PI * 0.5, 0, 0]}>
          <ringGeometry args={[87.2, 88.4, 64]} />
          <meshBasicMaterial color="#1d5bff" transparent opacity={0.28} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <pointLight ref={spotRef} color="#38bdf8" intensity={18} distance={95} />
    </group>
  );
}

// ============================================================================
// CAMERA CONTROLLER & SIMULATION TICK LOOP
// ============================================================================

function CameraAndSimController({
  simStateRef,
  activeSiteId,
  selectedUnit,
  followSelected,
  cameraCommand,
  onClearCameraCommand,
  onTickUi,
}) {
  const controlsRef = useRef();
  const { camera } = useThree();
  const desiredTargetRef = useRef(new THREE.Vector3(0, 4, -4));
  const desiredPosRef = useRef(null);
  const lastUiSyncRef = useRef(0);

  // Switch camera view when site changes
  useEffect(() => {
    const siteObj = SITES.find((s) => s.id === activeSiteId) || SITES[0];
    desiredTargetRef.current.set(...siteObj.cameraTarget);
    desiredPosRef.current = new THREE.Vector3(...siteObj.cameraPos);
  }, [activeSiteId]);

  // Handle explicit camera commands (Zoom In, Zoom Out, Reset, FlyTo)
  useEffect(() => {
    if (!cameraCommand) return;
    const siteObj = SITES.find((s) => s.id === activeSiteId) || SITES[0];
    if (cameraCommand.type === 'RESET') {
      desiredTargetRef.current.set(...siteObj.cameraTarget);
      desiredPosRef.current = new THREE.Vector3(...siteObj.cameraPos);
    } else if (cameraCommand.type === 'ZOOM_IN') {
      const dir = new THREE.Vector3().subVectors(camera.position, desiredTargetRef.current);
      dir.multiplyScalar(0.76);
      desiredPosRef.current = new THREE.Vector3().addVectors(desiredTargetRef.current, dir);
    } else if (cameraCommand.type === 'ZOOM_OUT') {
      const dir = new THREE.Vector3().subVectors(camera.position, desiredTargetRef.current);
      dir.multiplyScalar(1.28);
      desiredPosRef.current = new THREE.Vector3().addVectors(desiredTargetRef.current, dir);
    } else if (cameraCommand.type === 'FLY_TO' && cameraCommand.pos) {
      const [tx, ty, tz] = cameraCommand.pos;
      desiredTargetRef.current.set(tx, ty, tz);
      desiredPosRef.current = new THREE.Vector3(tx + 26, ty + 28, tz + 38);
    }
    onClearCameraCommand();
  }, [cameraCommand, activeSiteId, camera, onClearCameraCommand]);

  useFrame((state, delta) => {
    // Advance simulation deterministically
    onTickUi(delta, state.clock.elapsedTime, lastUiSyncRef);

    if (!controlsRef.current) return;

    // Follow selected moving unit smoothly
    if (selectedUnit && followSelected && selectedUnit.pos) {
      const [ux, uy, uz] = selectedUnit.pos;
      const newTgt = new THREE.Vector3(ux, uy, uz);
      const deltaMove = new THREE.Vector3().subVectors(newTgt, controlsRef.current.target);
      controlsRef.current.target.lerp(newTgt, Math.min(1, delta * 5.5));
      if (!desiredPosRef.current) {
        camera.position.addScaledVector(deltaMove, Math.min(1, delta * 4.5));
      }
    } else {
      controlsRef.current.target.lerp(desiredTargetRef.current, Math.min(1, delta * 5.0));
    }

    if (desiredPosRef.current) {
      camera.position.lerp(desiredPosRef.current, Math.min(1, delta * 4.5));
      if (camera.position.distanceTo(desiredPosRef.current) < 0.6) {
        desiredPosRef.current = null;
      }
    }

    controlsRef.current.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI * 0.44}
      minPolarAngle={0.22}
      minDistance={16}
      maxDistance={230}
    />
  );
}

// ============================================================================
// MAIN 3D CANVAS EXPORT
// ============================================================================

export default function AtcWorld3D({
  simState,
  simStateRef,
  activeSiteId,
  selectedId,
  selectedUnit,
  followSelected,
  showRadarSweep,
  cameraCommand,
  onClearCameraCommand,
  onSelectObject,
  onTickSimulation,
}) {
  const siteObj = SITES.find((s) => s.id === activeSiteId) || SITES[0];
  const siteFlights = simState.flights.filter((f) => f.site === activeSiteId);
  const siteGround = simState.groundUnits.filter((g) => g.site === activeSiteId);
  const siteWeather = simState.weatherCells[activeSiteId] || [];

  return (
    <div className="canvas-stage">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: siteObj.cameraPos, fov: 38, near: 1.0, far: 900 }}
        onPointerMissed={() => onSelectObject(null)}
      >
        <color attach="background" args={['#dce7f5']} />
        <fog attach="fog" args={['#dce7f5', 180, 440]} />

        {/* Cool Isometric Strategy-Game Lighting + Soft Shadows */}
        <ambientLight intensity={0.85} color="#f1f5f9" />
        <hemisphereLight args={['#e2eeff', '#94a3b8', 0.65]} />
        <directionalLight
          position={[85, 130, 75]}
          intensity={1.55}
          color="#fffaf0"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-120}
          shadow-camera-right={120}
          shadow-camera-top={120}
          shadow-camera-bottom={-120}
          shadow-camera-near={10}
          shadow-camera-far={340}
          shadow-bias={-0.0004}
        />
        <directionalLight position={[-70, 65, -60]} intensity={0.45} color="#bae6fd" />

        {/* Invisible Ground Catch Plane so clicking empty space closes the detail card */}
        <mesh
          rotation={[-Math.PI * 0.5, 0, 0]}
          position={[0, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onSelectObject(null);
          }}
        >
          <planeGeometry args={[500, 500]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* Sector Terrain, Runways, Buildings, Navaids, Waypoints & Airways */}
        <SectorEnvironment
          siteId={activeSiteId}
          selectedId={selectedId}
          onSelectObject={onSelectObject}
        />

        {/* Rigged Crew & Wildlife */}
        <RiggedCrewActors siteId={activeSiteId} />

        {/* Rotating Radar Sweep Light */}
        <RadarSweepOverlay siteObj={siteObj} showSweep={showRadarSweep} />

        {/* Drifting Weather Cells */}
        {siteWeather.map((wx) => (
          <WeatherCellUnit
            key={wx.id}
            wx={wx}
            groundY={siteObj.groundY}
            isSelected={selectedId === wx.id}
            onSelect={onSelectObject}
          />
        ))}

        {/* Ground Support Vehicles */}
        {siteGround.map((g) => (
          <GroundVehicleUnit
            key={g.id}
            unit={g}
            isSelected={selectedId === g.id}
            onSelect={onSelectObject}
          />
        ))}

        {/* Airborne & Surface Flights */}
        {siteFlights.map((f) => (
          <AircraftUnit
            key={f.id}
            flight={f}
            groundY={siteObj.groundY}
            isSelected={selectedId === f.id}
            onSelect={onSelectObject}
          />
        ))}

        {/* Camera & Simulation Loop */}
        <CameraAndSimController
          simStateRef={simStateRef}
          activeSiteId={activeSiteId}
          selectedUnit={selectedUnit}
          followSelected={followSelected}
          cameraCommand={cameraCommand}
          onClearCameraCommand={onClearCameraCommand}
          onTickUi={onTickSimulation}
        />
      </Canvas>
    </div>
  );
}
