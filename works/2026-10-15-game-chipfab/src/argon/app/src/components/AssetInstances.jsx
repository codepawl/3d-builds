import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

export const CORE_GLB_FILES = [
  '/assets/cleanroom_structure.glb',
  '/assets/litho_scanners.glb',
  '/assets/etch_dep_clusters.glb',
  '/assets/implant_anneal_tools.glb',
  '/assets/cmp_wet_metrology.glb',
  '/assets/oht_network_foup.glb',
  '/assets/stocker_units.glb',
  '/assets/subfab_utilities.glb',
  '/assets/campus_buildings.glb',
  '/assets/campus_vehicles_props.glb',
  '/assets/fab_characters.glb',
  '/assets/metrology_packaging_tools.glb',
];

CORE_GLB_FILES.forEach((url) => {
  useGLTF.preload(url);
});

// Alias map ensuring variant names match the exact root nodes in public/assets/*.glb
export const VARIANT_ALIASES = {
  Litho_EUV_Twinscan: 'LithoScanner_EUV',
  Litho_DUV_Immersion: 'LithoScanner_ArFi',
  Litho_Track_Coater: 'LithoTrack_CoaterDev',
  Char_Process_Engineer: 'Engineer_Process_White',
  Char_Litho_Specialist: 'Engineer_Litho_Amber',
  Char_Maintenance_Tech: 'Technician_Maint_Blue',
  Char_Shift_Lead: 'Operator_Lead_Teal',
};

const CLIP_SUFFIX_ALIASES = {
  Walk: 'Walk',
  Idle: 'Idle',
  Inspect_Console: 'Inspect',
  Repair_Tool: 'WorkConsole',
  Carry_FOUP: 'CarryFOUP',
};

const ANIMATED_STATIC_VARIANTS = new Set([
  'Ceiling_FFU_Canopy_4m',
  'Wall_Airlock_Gowning_4m',
  'Gate_Campus_Security',
  'Building_Fab1_Shell',
  'Support_Cooling_Tower_Bank',
  'Support_UPW_Plant',
]);

export function resolveVariantName(gltf, variantName) {
  if (!gltf || !gltf.scene) return variantName;
  if (gltf.scene.getObjectByName(variantName)) return variantName;
  const mapped = VARIANT_ALIASES[variantName];
  if (mapped && gltf.scene.getObjectByName(mapped)) return mapped;
  return variantName;
}

// Clone a named variant node from a loaded GLTF scene, zero its root offset,
// and snapshot rest transforms on every child node without duplicating shader programs.
export function cloneVariantFromGLTF(gltf, variantName, isSkinned = false) {
  if (!gltf || !gltf.scene) return null;

  const actualName = resolveVariantName(gltf, variantName);
  let sourceNode = gltf.scene.getObjectByName(actualName);
  if (!sourceNode) {
    gltf.scene.traverse((child) => {
      if (!sourceNode && child.name && child.name.toLowerCase() === actualName.toLowerCase()) {
        sourceNode = child;
      }
    });
  }
  if (!sourceNode) return null;

  const cloned = isSkinned ? SkeletonUtils.clone(sourceNode) : sourceNode.clone(true);
  cloned.position.set(0, 0, 0);
  cloned.rotation.set(0, 0, 0);
  cloned.scale.set(1, 1, 1);

  const isFloorOrRail =
    actualName.startsWith('Floor_') || actualName.startsWith('OHT_Rail_');

  const partMap = {};
  cloned.traverse((node) => {
    node.userData.restPos = node.position.clone();
    node.userData.restRot = node.rotation.clone();
    if (node.name) {
      partMap[node.name] = node;
    }
    if (node.isSkinnedMesh) {
      node.frustumCulled = false;
    }
    if (node.isMesh) {
      node.castShadow = !isFloorOrRail;
      node.receiveShadow = true;
    }
  });

  cloned.userData.partMap = partMap;
  cloned.userData.resolvedVariantName = actualName;
  return cloned;
}

// Animated 3D Unit Instance (Process Tools, OHT Vehicles, Stockers, Sub-Fab Skids, Plants, Trucks, Rigged Engineers)
export function AnimatedUnitModel({
  unit,
  isSelected,
  isHovered,
  onSelect,
  onHoverChange,
  simTimeRef,
}) {
  const url = `/assets/${unit.assetFile}`;
  const gltf = useGLTF(url);
  const groupRef = useRef();
  const mixerRef = useRef(null);
  const activeActionRef = useRef(null);
  const currentClipNameRef = useRef('');

  const isCharacter = unit.category === 'engineer' || unit.assetFile === 'fab_characters.glb';

  const clonedRoot = useMemo(() => {
    return cloneVariantFromGLTF(gltf, unit.variantName, isCharacter);
  }, [gltf, unit.variantName, isCharacter]);

  // Setup AnimationMixer for rigged bunny-suit engineers
  useEffect(() => {
    if (!isCharacter || !clonedRoot || !gltf.animations || gltf.animations.length === 0) {
      return undefined;
    }
    const mixer = new THREE.AnimationMixer(clonedRoot);
    mixerRef.current = mixer;
    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
    };
  }, [isCharacter, clonedRoot, gltf]);

  // Drive live position, rotation, and all articulated sub-parts every frame
  useFrame(() => {
    const t = simTimeRef?.current ?? performance.now() * 0.001;
    if (groupRef.current) {
      groupRef.current.position.set(unit.position[0], unit.position[1], unit.position[2]);
      groupRef.current.rotation.y = unit.rotationY || 0;
    }

    if (!clonedRoot) return;
    const parts = clonedRoot.userData.partMap || {};
    const resolvedName = clonedRoot.userData.resolvedVariantName || unit.variantName;
    const isRunning = unit.state === 'running' || unit.state === 'hotlot';
    const isMaint = unit.state === 'maintenance';
    const speedFactor = isRunning ? 1.0 : isMaint ? 0.35 : 0.15;
    const phase = (unit.id.charCodeAt(0) + unit.id.charCodeAt(unit.id.length - 1)) * 0.7;

    // 1. Character NLA animation playback
    if (isCharacter) {
      const rawSuffix = unit.clipState || 'Walk';
      const mappedSuffix = CLIP_SUFFIX_ALIASES[rawSuffix] || rawSuffix;
      if (mixerRef.current && gltf.animations?.length) {
        const candidateNames = [
          `${resolvedName}_${mappedSuffix}`,
          `${resolvedName}_${rawSuffix}`,
          `${unit.variantName}_${rawSuffix}`,
        ];
        const targetKey = candidateNames[0];
        if (currentClipNameRef.current !== targetKey) {
          const clip =
            gltf.animations.find((a) => candidateNames.includes(a.name)) ||
            gltf.animations.find((a) => a.name.startsWith(resolvedName) && a.name.includes(mappedSuffix)) ||
            gltf.animations.find((a) => a.name.startsWith(resolvedName)) ||
            gltf.animations[0];
          if (clip) {
            const nextAction = mixerRef.current.clipAction(clip);
            nextAction.reset().play();
            if (activeActionRef.current && activeActionRef.current !== nextAction) {
              activeActionRef.current.stop();
            }
            activeActionRef.current = nextAction;
            currentClipNameRef.current = targetKey;
          }
        }
        const clipDur = activeActionRef.current?.getClip()?.duration || 1.0;
        mixerRef.current.setTime((t * 1.15 + phase) % Math.max(0.1, clipDur));
      }
    }

    // 2. Lithography Scanners & Tracks (both naming conventions supported)
    const waferStage = parts.Wafer_Stage || parts.WaferStage_Chuck;
    if (waferStage) {
      waferStage.position.x =
        waferStage.userData.restPos.x + Math.sin(t * 3.2 * speedFactor + phase) * 0.16;
      waferStage.position.z =
        waferStage.userData.restPos.z + Math.cos(t * 6.4 * speedFactor + phase) * 0.11;
    }
    const trackBridge = parts.Track_Bridge || parts.ReticleBridge;
    if (trackBridge) {
      trackBridge.position.x =
        trackBridge.userData.restPos.x + Math.sin(t * 2.1 * speedFactor + phase) * 0.18;
    }
    const duvStage = parts.DUV_Wafer_Stage || parts.ImmersionStage;
    if (duvStage) {
      duvStage.position.x =
        duvStage.userData.restPos.x + Math.sin(t * 3.6 * speedFactor + phase) * 0.15;
    }
    const reticleArm = parts.Reticle_Arm || parts.OperatorArm;
    if (reticleArm) {
      reticleArm.rotation.y =
        reticleArm.userData.restRot.y + Math.sin(t * 1.8 * speedFactor + phase) * 0.35;
    }
    const trackShuttle = parts.Track_Shuttle || parts.TrackWaferShuttle;
    if (trackShuttle) {
      trackShuttle.position.x =
        trackShuttle.userData.restPos.x + Math.sin(t * 2.5 * speedFactor + phase) * 0.55;
    }

    // 3. Etch, CVD/ALD & PVD Vacuum Clusters
    if (parts.Transfer_Robot_Arm) {
      const p = parts.Transfer_Robot_Arm;
      p.rotation.y = p.userData.restRot.y + t * 1.85 * speedFactor + phase;
    }
    if (parts.CVD_Transfer_Arm) {
      const p = parts.CVD_Transfer_Arm;
      p.rotation.y = p.userData.restRot.y - t * 1.65 * speedFactor + phase;
    }
    if (parts.PVD_Transfer_Arm) {
      const p = parts.PVD_Transfer_Arm;
      p.rotation.y = p.userData.restRot.y + t * 1.5 * speedFactor + phase;
    }
    for (let m = 1; m <= 4; m++) {
      const rotor = parts[`Magnetron_Rotor_${m}`];
      if (rotor) {
        rotor.rotation.y = rotor.userData.restRot.y + t * 5.5 * speedFactor + m;
      }
      const lid = parts[`Chamber_${m}_Lid`] || parts[`CVD_Lid_${m}`];
      if (lid) {
        const openAngle = isMaint && m === 2 ? 0.68 + Math.sin(t * 1.5) * 0.08 : 0;
        lid.rotation.x = lid.userData.restRot.x - openAngle;
      }
    }

    // 4. Ion Implanter, Vertical Diffusion Furnace & RTP Laser Anneal
    if (parts.Endstation_Wheel) {
      const p = parts.Endstation_Wheel;
      p.rotation.z = p.userData.restRot.z + t * 3.8 * speedFactor;
      p.position.x = p.userData.restPos.x + Math.sin(t * 1.9 * speedFactor + phase) * 0.16;
    }
    if (parts.Boat_Elevator) {
      const p = parts.Boat_Elevator;
      const lift = (Math.sin(t * 0.95 * speedFactor + phase) * 0.5 + 0.5) * 0.78;
      p.position.y = p.userData.restPos.y + lift;
    }
    if (parts.RTP_Rotor) {
      const p = parts.RTP_Rotor;
      p.rotation.y = p.userData.restRot.y + t * 6.5 * speedFactor;
    }

    // 5. CMP Tri-Platen Polisher, Auto Wet Bench & Metrology Tools
    for (let idx = 1; idx <= 3; idx++) {
      const platen = parts[`Platen_${idx}`];
      if (platen) {
        platen.rotation.y = platen.userData.restRot.y + t * (4.2 + idx * 0.6) * speedFactor;
      }
    }
    if (parts.Carrier_Carousel) {
      const p = parts.Carrier_Carousel;
      p.rotation.y = p.userData.restRot.y - t * 1.4 * speedFactor + Math.sin(t * 2.2) * 0.35;
    }
    if (parts.Conditioner_Arm) {
      const p = parts.Conditioner_Arm;
      p.rotation.y = p.userData.restRot.y + Math.sin(t * 2.8 * speedFactor + phase) * 0.38;
    }
    if (parts.Gantry_Bridge) {
      const p = parts.Gantry_Bridge;
      p.position.x = p.userData.restPos.x + Math.sin(t * 1.1 * speedFactor + phase) * 0.68;
    }
    if (parts.Gantry_Hoist) {
      const p = parts.Gantry_Hoist;
      p.position.y = p.userData.restPos.y + Math.cos(t * 2.2 * speedFactor + phase) * 0.22;
    }
    if (parts.SEM_Stage) {
      const p = parts.SEM_Stage;
      p.position.x = p.userData.restPos.x + Math.sin(t * 4.0 * speedFactor + phase) * 0.12;
      p.position.z = p.userData.restPos.z + Math.cos(t * 4.0 * speedFactor + phase) * 0.12;
    }
    if (parts.Optical_Head) {
      const p = parts.Optical_Head;
      p.position.x = p.userData.restPos.x + Math.sin(t * 3.4 * speedFactor + phase) * 0.2;
    }

    // 6. EFEM Load-Port FOUP Opener Doors
    Object.keys(parts).forEach((key) => {
      if ((key.endsWith('_Door') && key.includes('_LP_')) || key.includes('LoadPortDoor_')) {
        const door = parts[key];
        const doorWave = Math.sin(t * 1.2 + phase + key.charCodeAt(0));
        const slideDown = doorWave > 0.45 ? ((doorWave - 0.45) / 0.55) * 0.26 : 0;
        door.position.y = door.userData.restPos.y - slideDown;
      }
    });

    // 7. Interbay FOUP Stocker SRM Crane Mast & Fork
    if (parts.Stocker_Mast) {
      const p = parts.Stocker_Mast;
      p.position.x = p.userData.restPos.x + Math.sin(t * 1.15 + phase) * 0.95;
    }
    if (parts.Stocker_Fork) {
      const p = parts.Stocker_Fork;
      p.position.y = p.userData.restPos.y + Math.cos(t * 1.7 + phase) * 0.65;
    }

    // 8. OHT Vehicles: Rotating Bogie Wheels & Hoist Gripper Lowering FOUPs
    const ohtPrefix = unit.variantName;
    ['FL', 'FR', 'RL', 'RR'].forEach((corner) => {
      const w = parts[`${ohtPrefix}_Wheel_${corner}`];
      if (w) {
        w.rotation.x = w.userData.restRot.x + t * 9.5;
      }
    });
    const hoistGripper = parts[`${ohtPrefix}_Hoist_Gripper`];
    if (hoistGripper) {
      const drop = unit.hoistDropMeters || 0;
      hoistGripper.position.y = hoistGripper.userData.restPos.y - drop;
    }

    // 9. Sub-Fab Fans & Exterior Plant Fans / Fab 2 Commissioning Tower Crane
    if (parts.Pump_Cooling_Fan) {
      parts.Pump_Cooling_Fan.rotation.x = parts.Pump_Cooling_Fan.userData.restRot.x + t * 14.0;
    }
    if (parts.Chiller_Fan) {
      parts.Chiller_Fan.rotation.y = parts.Chiller_Fan.userData.restRot.y + t * 11.0;
    }
    if (parts.UPW_Blower_Fan) {
      parts.UPW_Blower_Fan.rotation.y = parts.UPW_Blower_Fan.userData.restRot.y + t * 9.0;
    }
    for (let f = 1; f <= 3; f++) {
      const ctFan = parts[`CT_Fan_${f}`];
      if (ctFan) {
        ctFan.rotation.y = ctFan.userData.restRot.y + t * (8.5 + f * 0.7);
      }
    }
    if (parts.Crane_Turret) {
      parts.Crane_Turret.rotation.y = parts.Crane_Turret.userData.restRot.y + Math.sin(t * 0.45) * 0.65;
    }
    if (parts.Crane_Boom) {
      parts.Crane_Boom.rotation.x = parts.Crane_Boom.userData.restRot.x + Math.sin(t * 0.7) * 0.08;
    }
    if (parts.Crane_Hook) {
      parts.Crane_Hook.position.y = parts.Crane_Hook.userData.restPos.y + Math.sin(t * 1.1) * 0.35;
    }

    // 10. Campus Road Trucks, Cryo Tankers & Cleanroom PGV Carts
    ['FL', 'FR', 'ML', 'MR', 'RL', 'RR'].forEach((corner) => {
      const tw =
        parts[`Truck_Wheel_${corner}`] ||
        parts[`Tanker_Wheel_${corner}`] ||
        parts[`PGV_Wheel_${corner}`];
      if (tw) {
        tw.rotation.x = tw.userData.restRot.x + t * 8.0;
      }
    });
    if (parts.PGV_Lift_Table) {
      parts.PGV_Lift_Table.position.y =
        parts.PGV_Lift_Table.userData.restPos.y + (Math.sin(t * 1.8 + phase) * 0.5 + 0.5) * 0.18;
    }
  });

  if (!clonedRoot) return null;

  const ringColor =
    unit.state === 'hotlot'
      ? '#f97316'
      : unit.state === 'maintenance'
      ? '#2563eb'
      : unit.state === 'down'
      ? '#ef4444'
      : unit.state === 'idle'
      ? '#f59e0b'
      : '#10b981';

  const isOht = unit.category === 'oht';
  const ringRadius =
    unit.category === 'engineer'
      ? 0.58
      : isOht
      ? 0.75
      : unit.category === 'plant'
      ? 2.85
      : unit.category === 'subfab'
      ? 1.15
      : 1.95;

  return (
    <group
      ref={groupRef}
      position={unit.position}
      rotation={[0, unit.rotationY || 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(unit.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
        onHoverChange?.(unit.id);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'auto';
        onHoverChange?.(null);
      }}
    >
      <primitive object={clonedRoot} />

      {/* Selection / Hover Ground Ring */}
      {(isSelected || isHovered || unit.state === 'hotlot' || unit.state === 'maintenance') && (
        <group position={[0, isOht ? -0.15 : 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <ringGeometry
              args={[
                ringRadius * (isSelected ? 0.86 : 0.9),
                ringRadius * (isSelected ? 1.06 : 0.98),
                32,
              ]}
            />
            <meshBasicMaterial
              color={isSelected ? '#2563eb' : ringColor}
              transparent
              opacity={isSelected ? 0.95 : isHovered ? 0.75 : 0.42}
              side={THREE.DoubleSide}
            />
          </mesh>
          {isSelected && (
            <mesh>
              <ringGeometry args={[ringRadius * 1.12, ringRadius * 1.19, 32]} />
              <meshBasicMaterial
                color="#60a5fa"
                transparent
                opacity={0.65}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
        </group>
      )}

      {/* Vertical Laser Drop Guide Line when OHT lowers its hoist */}
      {isOht && (unit.hoistDropMeters > 0.1 || isSelected) && (
        <mesh position={[0, -1.1, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 2.1, 8]} />
          <meshBasicMaterial
            color={unit.isHotLot ? '#f97316' : '#38bdf8'}
            transparent
            opacity={0.55}
          />
        </mesh>
      )}
    </group>
  );
}

// Static or Ambient Animated Architectural / Environment Props from GLBs
export function StaticGLBProp({
  assetFile,
  variantName,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  simTimeRef,
}) {
  const gltf = useGLTF(`/assets/${assetFile}`);
  const cloned = useMemo(() => cloneVariantFromGLTF(gltf, variantName, false), [gltf, variantName]);
  const isAnimatedStatic = ANIMATED_STATIC_VARIANTS.has(variantName);

  useFrame(() => {
    if (!isAnimatedStatic || !cloned) return;
    const t = simTimeRef?.current ?? performance.now() * 0.001;
    const parts = cloned.userData.partMap || {};
    for (let i = 1; i <= 4; i++) {
      const ffu = parts[`FFU_Fan_${i}`];
      if (ffu) ffu.rotation.y = ffu.userData.restRot.y + t * 7.5;
      const roof = parts[`Fab1_Roof_Fan_${i}`];
      if (roof) roof.rotation.y = roof.userData.restRot.y + t * 6.5;
      const ct = parts[`CT_Fan_${i}`];
      if (ct) ct.rotation.y = ct.userData.restRot.y + t * 8.0;
    }
    if (parts.UPW_Blower_Fan) {
      parts.UPW_Blower_Fan.rotation.y = parts.UPW_Blower_Fan.userData.restRot.y + t * 8.5;
    }
    if (parts.Gate_Barrier_Arm) {
      const arm = parts.Gate_Barrier_Arm;
      const openWave = Math.max(0, Math.sin(t * 0.65));
      arm.rotation.z = arm.userData.restRot.z + openWave * 1.15;
    }
    if (parts.Airlock_Door_L && parts.Airlock_Door_R) {
      const doorSlide = Math.max(0, Math.sin(t * 0.8)) * 0.55;
      parts.Airlock_Door_L.position.x = parts.Airlock_Door_L.userData.restPos.x - doorSlide;
      parts.Airlock_Door_R.position.x = parts.Airlock_Door_R.userData.restPos.x + doorSlide;
    }
  });

  if (!cloned) return null;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={cloned} />
    </group>
  );
}

export const AnimatedFabUnit = AnimatedUnitModel;
export const StaticFabProp = StaticGLBProp;
