import React, { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { AnimatedFabUnit, StaticFabProp } from './AssetInstances';
import { OHT_LOOPS, CAMPUS_ROAD_LOOP } from '../sim/fabSimulation';

// Shape-coded SVG icon for 3D floating pins (matches House UI Rule: shape differs per state)
function PinStateIcon({ state }) {
  if (state === 'hotlot') {
    // 4-point star / diamond spark
    return (
      <svg width="10" height="10" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
        <path d="M6 0.5 L7.8 4.2 L11.5 6 L7.8 7.8 L6 11.5 L4.2 7.8 L0.5 6 L4.2 4.2 Z" fill="#f97316" />
      </svg>
    );
  }
  if (state === 'maintenance') {
    // Hexagon
    return (
      <svg width="10" height="10" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
        <polygon points="6,1 10.5,3.5 10.5,8.5 6,11 1.5,8.5 1.5,3.5" fill="#3b82f6" />
      </svg>
    );
  }
  if (state === 'idle') {
    // Hollow diamond
    return (
      <svg width="10" height="10" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
        <polygon points="6,1.2 10.8,6 6,10.8 1.2,6" fill="none" stroke="#f59e0b" strokeWidth="2.2" />
      </svg>
    );
  }
  if (state === 'down') {
    // Warning triangle
    return (
      <svg width="10" height="10" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
        <polygon points="6,1.2 11.2,10.5 0.8,10.5" fill="#ef4444" />
      </svg>
    );
  }
  // Running: filled circle
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
      <circle cx="6" cy="6" r="4.5" fill="#10b981" />
    </svg>
  );
}

// Smooth Camera Rig supporting orbit, fly-to, and live follow of moving OHT/vehicle/engineer units
function CameraRig({
  selectedUnit,
  cameraCommand,
  onClearCameraCommand,
  onGroundClick,
}) {
  const controlsRef = useRef();
  const { camera } = useThree();
  const desiredTargetRef = useRef(new THREE.Vector3(0, 0.8, 0));
  const desiredCameraOffsetRef = useRef(new THREE.Vector3(19, 17, 21));
  const isFlyingRef = useRef(false);
  const lastSelectedIdRef = useRef(null);

  // Trigger camera fly-to when selectedUnit changes
  useEffect(() => {
    if (selectedUnit) {
      const [ux, uy, uz] = selectedUnit.position;
      desiredTargetRef.current.set(ux, uy + 1.0, uz);

      // Choose an unobstructed isometric viewing offset based on unit category
      if (lastSelectedIdRef.current !== selectedUnit.id) {
        if (selectedUnit.category === 'oht') {
          desiredCameraOffsetRef.current.set(5.8, 3.6, 6.2);
        } else if (selectedUnit.category === 'engineer') {
          desiredCameraOffsetRef.current.set(3.2, 3.4, 3.4);
        } else if (selectedUnit.category === 'subfab') {
          desiredCameraOffsetRef.current.set(6.2, 4.2, 6.8);
        } else if (selectedUnit.category === 'plant' || selectedUnit.category === 'vehicle') {
          desiredCameraOffsetRef.current.set(9.5, 7.2, 10.2);
        } else {
          // Process tool or stocker: 55-deg isometric angle looking cleanly over the OHT rail
          desiredCameraOffsetRef.current.set(5.8, 8.2, 5.2);
        }
        isFlyingRef.current = true;
        lastSelectedIdRef.current = selectedUnit.id;
      }
    } else {
      lastSelectedIdRef.current = null;
    }
  }, [selectedUnit]);

  // Handle explicit camera commands (overview, zoomIn, zoomOut, rotate, stageJump)
  useEffect(() => {
    if (!cameraCommand || !controlsRef.current) return;
    const ctrl = controlsRef.current;

    if (cameraCommand.type === 'overview' || cameraCommand.type === 'reset') {
      const pos = cameraCommand.position || [26, 23, 28];
      const tgt = cameraCommand.target || [0, 0.8, 0];
      desiredTargetRef.current.set(tgt[0], tgt[1], tgt[2]);
      desiredCameraOffsetRef.current.set(
        pos[0] - tgt[0],
        pos[1] - tgt[1],
        pos[2] - tgt[2]
      );
      isFlyingRef.current = true;
    } else if (cameraCommand.type === 'zoomIn') {
      const offset = camera.position.clone().sub(ctrl.target).multiplyScalar(0.76);
      if (offset.length() > 4.5) {
        desiredCameraOffsetRef.current.copy(offset);
        desiredTargetRef.current.copy(ctrl.target);
        isFlyingRef.current = true;
      }
    } else if (cameraCommand.type === 'zoomOut') {
      const offset = camera.position.clone().sub(ctrl.target).multiplyScalar(1.3);
      if (offset.length() < 58) {
        desiredCameraOffsetRef.current.copy(offset);
        desiredTargetRef.current.copy(ctrl.target);
        isFlyingRef.current = true;
      }
    } else if (cameraCommand.type === 'rotate' || cameraCommand.type === 'rotate90') {
      const offset = camera.position.clone().sub(ctrl.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
      desiredCameraOffsetRef.current.copy(offset);
      desiredTargetRef.current.copy(ctrl.target);
      isFlyingRef.current = true;
    }
    onClearCameraCommand?.();
  }, [cameraCommand, camera, onClearCameraCommand]);

  useFrame((_, delta) => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const dt = Math.min(delta, 0.05);

    // If a unit is selected, continuously update desiredTargetRef to follow moving units (OHT, truck, PGV, engineer)
    if (selectedUnit) {
      const [ux, uy, uz] = selectedUnit.position;
      desiredTargetRef.current.set(ux, uy + 0.8, uz);
      const prevTarget = ctrl.target.clone();
      ctrl.target.lerp(desiredTargetRef.current, 1 - Math.exp(-8.5 * dt));

      if (isFlyingRef.current) {
        const goalPos = desiredTargetRef.current.clone().add(desiredCameraOffsetRef.current);
        camera.position.lerp(goalPos, 1 - Math.exp(-6.0 * dt));
        if (camera.position.distanceTo(goalPos) < 0.15) {
          isFlyingRef.current = false;
        }
      } else {
        // Keep camera moving along with followed target while allowing user orbit!
        const targetDelta = ctrl.target.clone().sub(prevTarget);
        camera.position.add(targetDelta);
      }
    } else if (isFlyingRef.current) {
      ctrl.target.lerp(desiredTargetRef.current, 1 - Math.exp(-6.5 * dt));
      const goalPos = desiredTargetRef.current.clone().add(desiredCameraOffsetRef.current);
      camera.position.lerp(goalPos, 1 - Math.exp(-6.0 * dt));
      if (camera.position.distanceTo(goalPos) < 0.2) {
        isFlyingRef.current = false;
      }
    } else {
      // Gently recenter orbit target toward cleanroom center (0, 0.8, 0) when no unit is selected
      desiredTargetRef.current.set(0, 0.8, 0);
      const prevTarget = ctrl.target.clone();
      ctrl.target.lerp(desiredTargetRef.current, 1 - Math.exp(-2.8 * dt));
      const targetDelta = ctrl.target.clone().sub(prevTarget);
      camera.position.add(targetDelta);
    }

    ctrl.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2 - 0.04}
      minPolarAngle={0.18}
      minDistance={4.5}
      maxDistance={58}
      onStart={() => {
        // User manual drag cancels initial fly-in interpolation but keeps target tracking
        isFlyingRef.current = false;
      }}
    />
  );
}

// Overhead Hoist Transport (OHT) Monorail Track Renderer
function OhtMonorailSystem({ siteId, simTimeRef }) {
  const outerLoop = OHT_LOOPS[siteId] || OHT_LOOPS.fab1;
  const innerLoop = OHT_LOOPS[`${siteId}_inner`] || OHT_LOOPS.fab1_inner;

  const railSegments = useMemo(() => {
    const segs = [];
    const addLoopRails = (loop, isInner) => {
      const minX = loop[0][0];
      const maxX = loop[1][0];
      const northZ = loop[0][2];
      const southZ = loop[2][2];
      const y = loop[0][1];

      // Straight segments along North and South rails every 4.0m
      for (let x = minX + 2.0; x <= maxX - 2.0; x += 4.0) {
        segs.push({
          key: `n-${isInner}-${x}`,
          variant: 'OHT_Rail_Straight_4m',
          pos: [x, y, northZ],
          rot: [0, Math.PI / 2, 0],
        });
        segs.push({
          key: `s-${isInner}-${x}`,
          variant: 'OHT_Rail_Straight_4m',
          pos: [x, y, southZ],
          rot: [0, -Math.PI / 2, 0],
        });
      }
      // Corner curves
      segs.push({
        key: `cnw-${isInner}`,
        variant: 'OHT_Rail_Curve_90',
        pos: [minX + 0.6, y, northZ + 0.6],
        rot: [0, 0, 0],
      });
      segs.push({
        key: `cne-${isInner}`,
        variant: 'OHT_Rail_Curve_90',
        pos: [maxX - 0.6, y, northZ + 0.6],
        rot: [0, -Math.PI / 2, 0],
      });
      segs.push({
        key: `cse-${isInner}`,
        variant: 'OHT_Rail_Curve_90',
        pos: [maxX - 0.6, y, southZ - 0.6],
        rot: [0, Math.PI, 0],
      });
      segs.push({
        key: `csw-${isInner}`,
        variant: 'OHT_Rail_Curve_90',
        pos: [minX + 0.6, y, southZ - 0.6],
        rot: [0, Math.PI / 2, 0],
      });
    };

    addLoopRails(outerLoop, false);
    addLoopRails(innerLoop, true);
    return segs;
  }, [outerLoop, innerLoop]);

  // Continuous extruded monorail beam geometry so the loop looks 100% seamless
  const renderLoopBeam = (loop, colorHex) => {
    const minX = loop[0][0];
    const maxX = loop[1][0];
    const northZ = loop[0][2];
    const southZ = loop[2][2];
    const y = loop[0][1] + 0.52;
    const width = maxX - minX;
    const depth = southZ - northZ;

    return (
      <group>
        {/* North & South horizontal ceiling I-beams */}
        <mesh position={[(minX + maxX) / 2, y, northZ]} castShadow>
          <boxGeometry args={[width, 0.14, 0.28]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.65} roughness={0.25} />
        </mesh>
        <mesh position={[(minX + maxX) / 2, y, southZ]} castShadow>
          <boxGeometry args={[width, 0.14, 0.28]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.65} roughness={0.25} />
        </mesh>
        {/* West & East end-turn beams */}
        <mesh position={[minX, y, (northZ + southZ) / 2]} castShadow>
          <boxGeometry args={[0.28, 0.14, depth]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.65} roughness={0.25} />
        </mesh>
        <mesh position={[maxX, y, (northZ + southZ) / 2]} castShadow>
          <boxGeometry args={[0.28, 0.14, depth]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.65} roughness={0.25} />
        </mesh>
        {/* Glowing inductive power strip along bottom of rail */}
        <mesh position={[(minX + maxX) / 2, y - 0.08, northZ]}>
          <boxGeometry args={[width, 0.03, 0.08]} />
          <meshBasicMaterial color={colorHex} />
        </mesh>
        <mesh position={[(minX + maxX) / 2, y - 0.08, southZ]}>
          <boxGeometry args={[width, 0.03, 0.08]} />
          <meshBasicMaterial color={colorHex} />
        </mesh>
      </group>
    );
  };

  return (
    <group>
      {renderLoopBeam(outerLoop, '#06b6d4')}
      {renderLoopBeam(innerLoop, '#3b82f6')}
      {railSegments.map((seg) => (
        <StaticFabProp
          key={seg.key}
          assetFile="oht_network_foup.glb"
          variantName={seg.variant}
          position={seg.pos}
          rotation={seg.rot}
          simTimeRef={simTimeRef}
        />
      ))}
      {/* Overhead Under-Track FOUP Buffers (UTB) mounted alongside the OHT loop */}
      <StaticFabProp
        assetFile="stocker_units.glb"
        variantName="Stocker_Undertrack_Buffer"
        position={[-4.5, 2.85, -3.55]}
        rotation={[0, 0, 0]}
        simTimeRef={simTimeRef}
      />
      <StaticFabProp
        assetFile="stocker_units.glb"
        variantName="Stocker_Undertrack_Buffer"
        position={[4.5, 2.85, -3.55]}
        rotation={[0, 0, 0]}
        simTimeRef={simTimeRef}
      />
    </group>
  );
}

// Cleanroom Architecture, Sub-Fab Cutaway Level & Campus Environment
function CleanroomAndCampusEnvironment({ siteId, showSubfab, simTimeRef, onGroundClick }) {
  // Generate 4m x 4m floor tile coordinates for the cleanroom pad (-12..+12 in X, -6..+6 in Z)
  const floorTiles = useMemo(() => {
    const tiles = [];
    for (let x = -10; x <= 10; x += 4) {
      for (let z = -6; z <= 6; z += 4) {
        // North-West zone (x <= -2, z < 0) is the Yellow Photolithography Bay on Fab 1 & Fab 2
        const isLithoBay = siteId !== 'ap1' && x <= -2 && z < 0;
        tiles.push({
          key: `tile-${x}-${z}`,
          variant: isLithoBay ? 'Floor_LithoBay_Tile_4m' : 'Floor_Cleanroom_Tile_4m',
          pos: [x, 0.0, z],
        });
      }
    }
    return tiles;
  }, [siteId]);

  // Sub-fab structural waffle columns under the cleanroom deck
  const subfabColumns = useMemo(() => {
    const cols = [];
    for (let x = -10; x <= 10; x += 5) {
      cols.push({ key: `col-n-${x}`, pos: [x, -3.0, -3.2] });
      cols.push({ key: `col-s-${x}`, pos: [x, -3.0, 3.2] });
    }
    return cols;
  }, []);

  return (
    <group>
      {/* Large clickable exterior ground plane (deselects when clicking empty ground) */}
      <mesh
        position={[0, -0.06, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta <= 5) onGroundClick();
        }}
      >
        <planeGeometry args={[180, 180]} />
        <meshStandardMaterial color="#cfdbe9" roughness={0.92} metalness={0.02} />
      </mesh>

      {/* Campus landscaped apron & subtle architectural grid pad */}
      <mesh
        position={[0, -0.03, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta <= 5) onGroundClick();
        }}
      >
        <planeGeometry args={[54, 42]} />
        <meshStandardMaterial color="#dde6f1" roughness={0.85} metalness={0.04} />
      </mesh>

      {/* Campus Perimeter Logistics Road Loop (matches CAMPUS_ROAD_LOOP: X=±21.5, Z=-16.5..+15.2) */}
      <group position={[0, -0.01, 0]}>
        {/* South Boulevard (Z = 15.2) */}
        <mesh position={[0, 0, 15.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[46.5, 3.4]} />
          <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
        {/* North Utility Road (Z = -16.5) */}
        <mesh position={[0, 0, -16.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[46.5, 3.4]} />
          <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
        {/* West & East Connectors (X = ±21.5) */}
        <mesh position={[-21.5, 0, -0.65]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[3.4, 35.1]} />
          <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
        <mesh position={[21.5, 0, -0.65]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[3.4, 35.1]} />
          <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
        {/* Center dashed road stripe on South Boulevard */}
        <mesh position={[0, 0.01, 15.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[42.0, 0.12]} />
          <meshBasicMaterial color="#94a3b8" />
        </mesh>
      </group>

      {/* Sub-Fab Basement Cavity (Y = -3.02 m) directly beneath Cleanroom */}
      <group>
        {/* Sub-fab epoxy floor slab at Y = -3.02m */}
        <mesh position={[0, -3.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[30.5, 17.5]} />
          <meshStandardMaterial color="#1e293b" roughness={0.65} metalness={0.15} />
        </mesh>
        {/* Sub-fab perimeter retaining walls with open front cutaway gallery */}
        <mesh position={[0, -1.5, -8.75]}>
          <boxGeometry args={[30.6, 3.0, 0.35]} />
          <meshStandardMaterial color="#334155" roughness={0.7} />
        </mesh>
        <mesh position={[-15.2, -1.5, 0]}>
          <boxGeometry args={[0.35, 3.0, 17.5]} />
          <meshStandardMaterial color="#334155" roughness={0.7} />
        </mesh>
        <mesh position={[15.2, -1.5, 0]}>
          <boxGeometry args={[0.35, 3.0, 17.5]} />
          <meshStandardMaterial color="#334155" roughness={0.7} />
        </mesh>

        {/* Sub-fab structural waffle columns & utility pipe racks */}
        {subfabColumns.map((col) => (
          <StaticFabProp
            key={col.key}
            assetFile="subfab_utilities.glb"
            variantName="Subfab_Waffle_Column_Rack"
            position={col.pos}
            simTimeRef={simTimeRef}
          />
        ))}

        {/* Extra Sub-Fab skids for Fab 2 & AP1 so their sub-fab level is equally rich */}
        {siteId !== 'fab1' && (
          <>
            <StaticFabProp
              assetFile="subfab_utilities.glb"
              variantName="Subfab_DryPump_Booster"
              position={[-6.0, -3.0, -5.8]}
              simTimeRef={simTimeRef}
            />
            <StaticFabProp
              assetFile="subfab_utilities.glb"
              variantName="Subfab_HeatExchanger_Chiller"
              position={[0.8, -3.0, -5.8]}
              simTimeRef={simTimeRef}
            />
            <StaticFabProp
              assetFile="subfab_utilities.glb"
              variantName="Subfab_PointOfUse_Abatement"
              position={[5.2, -3.0, -5.8]}
              simTimeRef={simTimeRef}
            />
            <StaticFabProp
              assetFile="subfab_utilities.glb"
              variantName="Subfab_GasCabinet_VMB"
              position={[-4.0, -3.0, 5.8]}
              rotation={[0, Math.PI, 0]}
              simTimeRef={simTimeRef}
            />
          </>
        )}
      </group>

      {/* Cleanroom Raised Access Floor Deck (Tiled 4m modules, hidden/x-ray when showSubfab is active) */}
      {!showSubfab ? (
        <group>
          {floorTiles.map((t) => (
            <StaticFabProp
              key={t.key}
              assetFile="cleanroom_structure.glb"
              variantName={t.variant}
              position={t.pos}
              simTimeRef={simTimeRef}
            />
          ))}
          {/* Cleanroom perimeter cutaway slab trim with Cobalt Blue accent */}
          <mesh position={[0, 0.11, -8.25]} receiveShadow>
            <boxGeometry args={[30.4, 0.24, 0.45]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.11, 8.25]} receiveShadow>
            <boxGeometry args={[30.4, 0.24, 0.45]} />
            <meshStandardMaterial color="#2563eb" roughness={0.3} metalness={0.2} />
          </mesh>
          <mesh position={[-15.1, 0.11, 0]} receiveShadow>
            <boxGeometry args={[0.45, 0.24, 16.9]} />
            <meshStandardMaterial color="#2563eb" roughness={0.3} metalness={0.2} />
          </mesh>
          <mesh position={[15.1, 0.11, 0]} receiveShadow>
            <boxGeometry args={[0.45, 0.24, 16.9]} />
            <meshStandardMaterial color="#2563eb" roughness={0.3} metalness={0.2} />
          </mesh>
        </group>
      ) : (
        /* X-Ray translucent floor grid when Sub-Fab Cutaway mode is active */
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[29.6, 16.2]} />
          <meshStandardMaterial
            color="#38bdf8"
            transparent
            opacity={0.16}
            roughness={0.2}
            metalness={0.1}
          />
        </mesh>
      )}

      {/* Cleanroom Cutaway Partition Walls, Gowning Airlock, Safety Pillars & FFU Canopies */}
      <group>
        {/* Partition wall dividing Yellow Litho Bay (West) from Plasma Etch Bay (East) */}
        <StaticFabProp
          assetFile="cleanroom_structure.glb"
          variantName="Wall_Cutaway_Partition_4m"
          position={[-0.6, 0.22, -6.1]}
          rotation={[0, Math.PI / 2, 0]}
          simTimeRef={simTimeRef}
        />
        {/* North-West & North-East rear cutaway glass partition walls */}
        <StaticFabProp
          assetFile="cleanroom_structure.glb"
          variantName="Wall_Cutaway_Partition_4m"
          position={[-9.5, 0.22, -8.1]}
          rotation={[0, 0, 0]}
          simTimeRef={simTimeRef}
        />
        <StaticFabProp
          assetFile="cleanroom_structure.glb"
          variantName="Wall_Cutaway_Partition_4m"
          position={[-5.4, 0.22, -8.1]}
          rotation={[0, 0, 0]}
          simTimeRef={simTimeRef}
        />
        <StaticFabProp
          assetFile="cleanroom_structure.glb"
          variantName="Wall_Cutaway_Partition_4m"
          position={[3.4, 0.22, -8.1]}
          rotation={[0, 0, 0]}
          simTimeRef={simTimeRef}
        />
        <StaticFabProp
          assetFile="cleanroom_structure.glb"
          variantName="Wall_Cutaway_Partition_4m"
          position={[7.5, 0.22, -8.1]}
          rotation={[0, 0, 0]}
          simTimeRef={simTimeRef}
        />

        {/* Cleanroom Personnel Entry Airlock with sliding doors at North-Center */}
        <StaticFabProp
          assetFile="cleanroom_structure.glb"
          variantName="Wall_Airlock_Gowning_4m"
          position={[-1.0, 0.22, -8.1]}
          rotation={[0, 0, 0]}
          simTimeRef={simTimeRef}
        />

        {/* Safety Shower / ESD Pillars along central spine */}
        <StaticFabProp
          assetFile="cleanroom_structure.glb"
          variantName="Pillar_Safety_Station"
          position={[-6.8, 0.22, -1.9]}
          rotation={[0, 0, 0]}
          simTimeRef={simTimeRef}
        />
        <StaticFabProp
          assetFile="cleanroom_structure.glb"
          variantName="Pillar_Safety_Station"
          position={[6.8, 0.22, -1.9]}
          rotation={[0, 0, 0]}
          simTimeRef={simTimeRef}
        />

        {/* Suspended HEPA Fan-Filter Unit (FFU) Canopies at the outer bay corners (spinning fans) */}
        <StaticFabProp
          assetFile="cleanroom_structure.glb"
          variantName="Ceiling_FFU_Canopy_4m"
          position={[-13.8, 4.15, -6.2]}
          simTimeRef={simTimeRef}
        />
        <StaticFabProp
          assetFile="cleanroom_structure.glb"
          variantName="Ceiling_FFU_Canopy_4m"
          position={[13.8, 4.15, -6.2]}
          simTimeRef={simTimeRef}
        />
      </group>

      {/* Overhead OHT Monorail System */}
      <OhtMonorailSystem siteId={siteId} simTimeRef={simTimeRef} />

      {/* Campus Perimeter Props, Skyway, Security Gate, Trees & Site-Specific Exterior Buildings */}
      <group>
        {/* Inter-Fab Elevated FOUP Skyway Bridge on West side */}
        <StaticFabProp
          assetFile="campus_vehicles_props.glb"
          variantName="Bridge_Interfab_Skyway"
          position={[-17.6, 0.0, 0.0]}
          rotation={[0, 0, 0]}
          simTimeRef={simTimeRef}
        />
        {/* Campus Security Gate with articulated barrier arm at South-West road entrance */}
        <StaticFabProp
          assetFile="campus_vehicles_props.glb"
          variantName="Gate_Campus_Security"
          position={[-17.2, 0.0, 12.6]}
          rotation={[0, 0, 0]}
          simTimeRef={simTimeRef}
        />
        {/* Landscaped Isometric Trees & Campus Monument Signs */}
        <StaticFabProp
          assetFile="campus_vehicles_props.glb"
          variantName="Prop_Campus_Trees_Planter"
          position={[-10.5, 0.0, 12.2]}
          simTimeRef={simTimeRef}
        />
        <StaticFabProp
          assetFile="campus_vehicles_props.glb"
          variantName="Prop_Campus_Trees_Planter"
          position={[10.5, 0.0, 12.2]}
          simTimeRef={simTimeRef}
        />
        <StaticFabProp
          assetFile="campus_vehicles_props.glb"
          variantName="Prop_Campus_Trees_Planter"
          position={[16.8, 0.0, 12.2]}
          simTimeRef={simTimeRef}
        />

        {/* On Fab 2 & AP1, include background support plants so campus perimeter is complete */}
        {siteId !== 'fab1' && (
          <>
            <StaticFabProp
              assetFile="campus_buildings.glb"
              variantName="Support_UPW_Plant"
              position={[-16.5, 0.0, -12.0]}
              simTimeRef={simTimeRef}
            />
            <StaticFabProp
              assetFile="campus_buildings.glb"
              variantName="Support_Cooling_Tower_Bank"
              position={[-5.5, 0.0, -12.2]}
              simTimeRef={simTimeRef}
            />
            <StaticFabProp
              assetFile="campus_buildings.glb"
              variantName="Support_Power_Substation"
              position={[5.5, 0.0, -12.2]}
              simTimeRef={simTimeRef}
            />
            <StaticFabProp
              assetFile="campus_buildings.glb"
              variantName="Support_Gas_Yard"
              position={[16.5, 0.0, -12.0]}
              simTimeRef={simTimeRef}
            />
          </>
        )}

        {/* Site-specific Campus Building Shells */}
        {siteId === 'fab1' && (
          <StaticFabProp
            assetFile="campus_buildings.glb"
            variantName="Building_Fab1_Shell"
            position={[17.2, 0.0, 5.5]}
            rotation={[0, -Math.PI / 2, 0]}
            simTimeRef={simTimeRef}
          />
        )}
        {siteId === 'ap1' && (
          <StaticFabProp
            assetFile="campus_buildings.glb"
            variantName="Building_Packaging_Plant"
            position={[16.8, 0.0, 4.5]}
            rotation={[0, -Math.PI / 2, 0]}
            simTimeRef={simTimeRef}
          />
        )}
      </group>
    </group>
  );
}

export default function FabScene({
  siteId,
  units,
  selectedUnitId,
  hoveredUnitId,
  onSelectUnit,
  onHoverUnit,
  showSubfab,
  subfabCutaway,
  simTimeRef,
  cameraCommand,
  onClearCameraCommand,
  onCameraCommandHandled,
}) {
  const isSubfabXray = Boolean(showSubfab ?? subfabCutaway);
  const handleClearCameraCmd = onClearCameraCommand || onCameraCommandHandled;

  const siteUnits = useMemo(
    () =>
      units.filter(
        (u) =>
          u.siteId === siteId ||
          (u.siteId === 'fab1' && (u.category === 'plant' || u.category === 'subfab'))
      ),
    [units, siteId]
  );

  const selectedUnit = useMemo(
    () => siteUnits.find((u) => u.id === selectedUnitId) || null,
    [siteUnits, selectedUnitId]
  );

  // Show compact floating 3D badges on primary tools, stockers, engineers, priority OHTs, and selected unit
  const pinUnits = useMemo(
    () =>
      siteUnits.filter(
        (u) =>
          u.id === selectedUnitId ||
          u.id === hoveredUnitId ||
          u.category === 'tool' ||
          u.category === 'stocker' ||
          u.category === 'engineer' ||
          (u.category === 'oht' && u.isHotLot) ||
          u.id === 'F2-CRANE-01'
      ),
    [siteUnits, selectedUnitId, hoveredUnitId]
  );

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Canvas
        shadows
        dpr={1}
        camera={{ position: [26, 23, 28], fov: 34, near: 0.5, far: 180 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
          powerPreference: 'high-performance',
        }}
      >
        <color attach="background" args={['#dce5f2']} />
        <fog attach="fog" args={['#dce5f2', 62, 135]} />

        {/* Clean Isometric Studio Lighting */}
        <ambientLight intensity={0.72} color="#f1f5f9" />
        <hemisphereLight args={['#ffffff', '#94a3b8', 0.68]} position={[0, 35, 0]} />
        <directionalLight
          position={[24, 36, 22]}
          intensity={1.75}
          color="#fffaf0"
          castShadow
          shadow-mapSize={[1536, 1536]}
          shadow-bias={-0.00025}
          shadow-camera-left={-28}
          shadow-camera-right={28}
          shadow-camera-top={28}
          shadow-camera-bottom={-28}
          shadow-camera-near={5}
          shadow-camera-far={95}
        />
        <directionalLight position={[-22, 18, -16]} intensity={0.55} color="#bae6fd" />

        {/* Warm Amber Safe-Light Illumination inside Yellow Photolithography Bay */}
        {siteId !== 'ap1' && (
          <pointLight
            position={[-6.2, 3.2, -5.8]}
            intensity={3.5}
            distance={11}
            color="#f59e0b"
          />
        )}
        {/* Cyan Sub-Fab Basement Illumination */}
        <pointLight position={[0, -1.6, 0]} intensity={2.2} distance={22} color="#38bdf8" />

        {/* Camera Orbit & Target Follow Rig */}
        <CameraRig
          selectedUnit={selectedUnit}
          cameraCommand={cameraCommand}
          onClearCameraCommand={handleClearCameraCmd}
          onGroundClick={() => onSelectUnit(null)}
        />

        {/* Architectural Cleanroom, OHT Monorail, Sub-Fab & Campus Grounds */}
        <CleanroomAndCampusEnvironment
          siteId={siteId}
          showSubfab={isSubfabXray}
          simTimeRef={simTimeRef}
          onGroundClick={() => onSelectUnit(null)}
        />

        {/* All Interactive Selectable & Articulated Units for Current Site */}
        {siteUnits.map((unit) => (
          <AnimatedFabUnit
            key={unit.id}
            unit={unit}
            isSelected={unit.id === selectedUnitId}
            isHovered={unit.id === hoveredUnitId}
            onSelect={onSelectUnit}
            onHoverChange={onHoverUnit}
            simTimeRef={simTimeRef}
          />
        ))}

        {/* Floating 3D Status Labels over Tools, Stockers, Engineers, and Active Units */}
        {pinUnits.map((unit) => {
          const isSel = unit.id === selectedUnitId;
          const pinY =
            unit.category === 'oht'
              ? unit.position[1] + 1.05
              : unit.category === 'engineer'
              ? unit.position[1] + 2.05
              : unit.category === 'plant'
              ? unit.position[1] + 4.25
              : unit.position[1] + 3.35;
          return (
            <Html
              key={`pin-${unit.id}`}
              position={[unit.position[0], pinY, unit.position[2]]}
              center
              zIndexRange={[10, 0]}
            >
              <div
                data-pin-unit-id={unit.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectUnit(unit.id);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: isSel ? '4px 10px' : '2.5px 7.5px',
                  borderRadius: '999px',
                  background: isSel
                    ? '#1e40af'
                    : unit.state === 'hotlot'
                    ? 'rgba(15, 23, 42, 0.92)'
                    : 'rgba(255, 255, 255, 0.92)',
                  color: isSel || unit.state === 'hotlot' ? '#ffffff' : '#0f172a',
                  boxShadow: isSel
                    ? '0 4px 14px rgba(37, 99, 235, 0.45)'
                    : '0 2px 6px rgba(15, 23, 42, 0.16)',
                  fontSize: isSel ? '11.5px' : '10.5px',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transform: isSel ? 'scale(1.06)' : 'scale(1)',
                  transition: 'transform 0.15s ease, background 0.15s ease',
                  pointerEvents: 'auto',
                }}
              >
                <PinStateIcon state={unit.state} />
                <span>{unit.shortName || unit.id}</span>
              </div>
            </Html>
          );
        })}
      </Canvas>
    </div>
  );
}
