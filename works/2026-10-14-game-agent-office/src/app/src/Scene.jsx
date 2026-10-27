import { memo, Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { CameraControls, Environment, Html, Lightformer, RoundedBox } from '@react-three/drei';
import { Bloom, EffectComposer, N8AO } from '@react-three/postprocessing';
import * as THREE from 'three';
import { advance, select, world } from './store.js';
import { activeSpace, createRandom, ROOM_KINDS, selectionPosition } from './world.js';
import { Character } from './Character.jsx';
import { cloneAsset, DESK_TOP, FLOOR, InstancedAsset, useAssets } from './assets.jsx';

const BRAND = '#6d4aff';
const LEAD_DESK_WIDTH = 6.4;
const SCREEN_BRIGHTNESS = 1.4;
export const CAMERA_OFFSET = new THREE.Vector3(23, 27, 29);
export const OVERVIEW_TARGET = new THREE.Vector3(2.5, 0, 3);

export function lookAtOverview(controls, animate) {
  const position = OVERVIEW_TARGET.clone().add(CAMERA_OFFSET);
  controls?.setLookAt(position.x, position.y, position.z, OVERVIEW_TARGET.x, 0, OVERVIEW_TARGET.z, animate);
}

function variantLetter(index, count = 2) {
  return 'abc'[index % count];
}

// ---------- static placements, grouped by asset name so each asset is drawn instanced ----------

function addDesk(add, { x, z, facing, width, screens, screenColor, variantIndex }) {
  // The desk sits on the far side of the slot, so the orglet stands between it and the door.
  const deskZ = z + facing * 0.85;
  const screenZ = deskZ + facing * 0.18;
  const rotationY = facing > 0 ? Math.PI : 0;
  const chairZ = z - facing * 0.15;
  if (width > 2) {
    add('lead_desk', { position: [x, FLOOR, deskZ], rotationY, scale: [width / LEAD_DESK_WIDTH, 1, 1] });
  } else {
    add(`desk_${Math.round(width * 100)}_${variantLetter(variantIndex)}`, { position: [x, FLOOR, deskZ], rotationY });
  }
  add(`chair_${variantLetter(variantIndex + 1)}`, { position: [x, FLOOR, chairZ], rotationY });
  for (let index = 0; index < screens; index += 1) {
    const offset = screens === 1 ? 0 : (index - 0.5) * 0.7;
    const angle = screens === 1 ? 0 : (index - 0.5) * -0.35;
    add(`monitor_${variantLetter(variantIndex + index)}`, {
      position: [x + offset, FLOOR + DESK_TOP, screenZ],
      rotationY: rotationY + angle,
      color: screenColor,
      brightness: SCREEN_BRIGHTNESS,
    });
  }
}

function addPlant(add, x, z, scale, variantIndex) {
  add(`plant_${variantLetter(variantIndex, 3)}`, { position: [x, FLOOR, z], rotationY: variantIndex * 1.3, scale: [scale, scale, scale] });
}

function addFurniture(add, spaceRoom, roomIndex) {
  const { kind, slots } = spaceRoom;
  const sideX = spaceRoom.x + spaceRoom.width / 2 - 0.9;
  const backZ = spaceRoom.row === 'back' ? spaceRoom.z - spaceRoom.depth / 2 + 0.8 : spaceRoom.z + spaceRoom.depth / 2 - 0.8;
  if (kind === 'lead') {
    const middle = slots[1];
    addDesk(add, { ...middle, width: spaceRoom.width * 0.62, screens: 2, screenColor: '#cfc4ff', variantIndex: roomIndex });
    addPlant(add, spaceRoom.x - spaceRoom.width / 2 + 0.8, backZ, 1, roomIndex);
    addPlant(add, sideX, backZ, 0.8, roomIndex + 1);
    add('meeting_table', { position: [spaceRoom.x + spaceRoom.width * 0.2, FLOOR, spaceRoom.z + middle.facing * 2.2] });
    return;
  }
  if (kind === 'approvals') {
    return;
  }
  if (kind === 'review' || kind === 'routines') {
    const isReview = kind === 'review';
    slots.forEach((slot, index) => {
      addDesk(add, {
        ...slot,
        width: isReview ? 1.4 : 1.2,
        screens: 1,
        screenColor: isReview ? '#ffe3b8' : '#dcd5ff',
        variantIndex: roomIndex + index,
      });
    });
    if (isReview && spaceRoom.row === 'back') {
      add('review_wall', { position: [spaceRoom.x, 1.3, spaceRoom.z - spaceRoom.depth / 2 + 0.2] });
    }
    return;
  }
  const isCode = kind === 'code';
  slots.forEach((slot, index) => {
    addDesk(add, {
      ...slot,
      width: 1.6,
      screens: isCode ? 2 : 1,
      screenColor: isCode ? '#b9f5d6' : '#bfe3ff',
      variantIndex: roomIndex + index,
    });
  });
  if (!isCode) {
    add('shelf', { position: [sideX, FLOOR, backZ], rotationY: spaceRoom.row === 'back' ? 0 : Math.PI });
  }
  addPlant(add, spaceRoom.x - spaceRoom.width / 2 + 0.7, backZ, 0.9, roomIndex + 2);
}

// Walls are 1 m modules whose finished face looks at +z; floors are 1 m carpet tiles tinted per room kind.
function addRoomShell(add, spaceRoom, roomIndex) {
  const { x, z, width, depth, row, kind } = spaceRoom;
  const isBackRow = row === 'back';
  const farZ = isBackRow ? z - depth / 2 : z + depth / 2;
  for (let column = 0; column < width; column += 1) {
    const moduleX = x - width / 2 + 0.5 + column;
    if (isBackRow) {
      const pattern = (column + roomIndex) % 5;
      const module = pattern === 2 ? 'wall_tall_b' : pattern === 4 ? 'wall_tall_c' : 'wall_tall_a';
      add(module, { position: [moduleX, FLOOR, farZ] });
    } else {
      // Walls facing the camera stay low so the room interior stays visible.
      add('wall_low', { position: [moduleX, FLOOR, farZ], rotationY: Math.PI, scale: [1, 0.64, 1] });
    }
    for (let tileRow = 0; tileRow < depth; tileRow += 1) {
      add('floor_tile', {
        position: [moduleX, 0, z - depth / 2 + 0.5 + tileRow],
        rotationY: ((column * 7 + tileRow * 3) % 4) * (Math.PI / 2),
        color: ROOM_KINDS[kind].tint,
      });
    }
  }
  const sideModule = isBackRow ? 'wall_mid' : 'wall_low';
  for (let tileRow = 0; tileRow < depth; tileRow += 1) {
    const moduleZ = z - depth / 2 + 0.5 + tileRow;
    add(sideModule, { position: [x - width / 2, FLOOR, moduleZ], rotationY: Math.PI / 2 });
    add(sideModule, { position: [x + width / 2, FLOOR, moduleZ], rotationY: -Math.PI / 2 });
  }
}

function addTrees(add, space) {
  const random = createRandom(space.index + 101);
  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * Math.PI * 2 + space.index;
    const radiusX = 20 + (index % 3) * 1.6;
    const radiusZ = 14 + ((index + 1) % 3) * 1.4;
    const scale = 0.8 + (index % 4) * 0.15;
    add(`tree_${variantLetter(index, 3)}`, {
      position: [Math.cos(angle) * radiusX, 0, Math.sin(angle) * radiusZ],
      rotationY: random() * Math.PI * 2,
      scale: [scale, scale, scale],
    });
  }
}

function spacePlacements(space) {
  const placements = {};
  const add = (name, placement) => {
    placements[name] ??= [];
    placements[name].push(placement);
  };
  space.rooms.forEach((spaceRoom, roomIndex) => {
    addRoomShell(add, spaceRoom, roomIndex);
    addFurniture(add, spaceRoom, roomIndex);
  });
  addTrees(add, space);
  return placements;
}

function StaticAssets({ space }) {
  const assets = useAssets();
  const placements = useMemo(() => spacePlacements(space), [space]);
  return Object.entries(placements).map(([name, list]) => <InstancedAsset key={name} asset={assets[name]} placements={list} />);
}

// ---------- animated pieces: cloned so each has its own lights ----------

function findPart(object, suffix) {
  let found = null;
  object.traverse((child) => {
    if (!found && child.name.endsWith(suffix)) {
      found = child;
    }
  });
  return found;
}

function ServerRack({ x, z }) {
  const assets = useAssets();
  const rack = useMemo(() => cloneAsset(assets.server_rack, (mesh) => mesh.name.includes('Light')), [assets]);
  const lights = useMemo(() => Array.from({ length: 6 }, (_, index) => findPart(rack, `Light_${index}`).material), [rack]);
  useFrame(() => {
    lights.forEach((light, index) => {
      light.emissiveIntensity = 1 + Math.max(0, Math.sin(world.time * 5 + index * 1.7)) * 2.5;
    });
  });
  return <primitive object={rack} position={[x, FLOOR, z]} />;
}

function InboxTray({ x, z, space }) {
  const assets = useAssets();
  const tray = useMemo(() => cloneAsset(assets.inbox_tray), [assets]);
  const cards = useMemo(() => Array.from({ length: 4 }, (_, index) => findPart(tray, `Card_${index}`)), [tray]);
  useFrame(() => {
    const queued = space.tasks.filter((task) => task.stage < 2 && !task.assigneeId).length;
    cards.forEach((card, index) => {
      card.visible = index < queued;
    });
  });
  return <primitive object={tray} position={[x, FLOOR + DESK_TOP, z]} />;
}

function Kiosk({ slot, space, variantIndex }) {
  const assets = useAssets();
  const kiosk = useMemo(
    () => cloneAsset(assets[`kiosk_${variantLetter(variantIndex)}`], (mesh) => mesh.name.endsWith('Lamp')),
    [assets, variantIndex],
  );
  const lamp = useMemo(() => findPart(kiosk, 'Lamp').material, [kiosk]);
  const kioskZ = slot.z + slot.facing * 0.7;
  useFrame(() => {
    const occupant = space.orglets.find((orglet) => orglet.id === slot.taken && orglet.phase === 'waiting');
    const color = occupant ? '#ffb020' : '#2fd08a';
    lamp.color.set(color);
    lamp.emissive.set(color);
    lamp.emissiveIntensity = occupant ? 2 + Math.sin(world.time * 6) * 0.8 : 1.2;
  });
  return <primitive object={kiosk} position={[slot.x, FLOOR, kioskZ]} rotation={[0, slot.facing > 0 ? Math.PI : 0, 0]} />;
}

function RoutineBoard({ spaceRoom, space }) {
  const assets = useAssets();
  // Back row: hung on the back wall. Front row: a free-standing board by the door, clear of the walking lane.
  const isBackRow = spaceRoom.row === 'back';
  const board = useMemo(() => {
    const copy = cloneAsset(assets.routines_board, (mesh) => mesh.name.includes('GlowTile'));
    findPart(copy, 'Legs').visible = !isBackRow;
    return copy;
  }, [assets, isBackRow]);
  const glow = useMemo(() => findPart(board, 'GlowTile').material, [board]);
  useFrame(() => {
    const sinceFire = world.time - (space.routineFiredAt ?? -99);
    glow.emissiveIntensity = sinceFire < 3 ? 2.5 * (1 - sinceFire / 3) + 0.6 : 0.6;
  });
  const boardX = isBackRow ? spaceRoom.x : spaceRoom.x - spaceRoom.width / 2 + 1.5;
  const boardZ = isBackRow ? spaceRoom.z - spaceRoom.depth / 2 + 0.2 : spaceRoom.z - spaceRoom.depth / 2 + 1.0;
  return <primitive object={board} position={[boardX, 1.25, boardZ]} scale={isBackRow ? 1 : 0.8} />;
}

function AnimatedFurniture({ spaceRoom, space }) {
  const { kind, slots } = spaceRoom;
  if (kind === 'lead') {
    const middle = slots[1];
    return <InboxTray x={middle.x - spaceRoom.width * 0.2} z={middle.z + middle.facing * 0.85} space={space} />;
  }
  if (kind === 'approvals') {
    return slots.map((slot, index) => <Kiosk key={index} slot={slot} space={space} variantIndex={index} />);
  }
  if (kind === 'routines') {
    return <RoutineBoard spaceRoom={spaceRoom} space={space} />;
  }
  if (kind === 'code') {
    const sideX = spaceRoom.x + spaceRoom.width / 2 - 0.9;
    const backZ = spaceRoom.row === 'back' ? spaceRoom.z - spaceRoom.depth / 2 + 0.8 : spaceRoom.z + spaceRoom.depth / 2 - 0.8;
    return <ServerRack x={sideX} z={backZ} />;
  }
  return null;
}

function Room({ spaceRoom, space, isActive }) {
  const { x, z, width, depth } = spaceRoom;
  const isSelected = world.selection?.type === 'room' && world.selection.id === spaceRoom.id;
  return (
    <group>
      {/* Invisible pick target over the floor tiles: clicking a room's floor opens its card. */}
      <mesh
        position={[x, 0.05, z]}
        visible={false}
        onClick={(event) => {
          if (event.delta > 5 || !isActive) {
            return;
          }
          event.stopPropagation();
          select({ type: 'room', id: spaceRoom.id });
        }}
      >
        <boxGeometry args={[width - 0.1, 0.1, depth - 0.1]} />
      </mesh>
      <AnimatedFurniture spaceRoom={spaceRoom} space={space} />
      <Html position={[x - width / 2 + 0.4, 0.15, spaceRoom.doorZ]} zIndexRange={[5, 0]} pointerEvents="none" center={false}>
        <div className={`room-tag${isSelected ? ' is-selected' : ''}`} hidden={!isActive}>{spaceRoom.label}</div>
      </Html>
    </group>
  );
}

function Grounds({ space }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#e8ecf6" roughness={1} />
      </mesh>
      <RoundedBox args={[32, 0.3, 21.5]} radius={0.12} smoothness={3} position={[0, -0.15, 0]} receiveShadow>
        <meshStandardMaterial color={space.floorColor} roughness={0.95} />
      </RoundedBox>
      {/* Corridor guide line in the brand colour. */}
      {Array.from({ length: 14 }, (_, index) => (
        <mesh key={index} rotation={[-Math.PI / 2, 0, 0]} position={[-13 + index * 2, 0.012, 0]}>
          <planeGeometry args={[1.1, 0.12]} />
          <meshStandardMaterial color={BRAND} transparent opacity={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function CameraRig({ controls }) {
  const { camera, size } = useThree();
  const lastRequest = useRef(null);
  useEffect(() => {
    window.__office = {
      // Screen position of an object, used by the film script to aim real mouse clicks.
      project(selection) {
        const position = selectionPosition(world, selection);
        if (!position) {
          return null;
        }
        const point = new THREE.Vector3(position.x, 0.8, position.z).project(camera);
        return { x: ((point.x + 1) / 2) * size.width, y: ((1 - point.y) / 2) * size.height };
      },
      world,
    };
  }, [camera, size]);
  useEffect(() => {
    lookAtOverview(controls.current, false);
  }, [controls]);
  const followedAt = useRef({ x: 0, z: 0 });
  useFrame(() => {
    const request = world.cameraRequest;
    if (!controls.current || !request) {
      return;
    }
    if (request === lastRequest.current) {
      // A close-up on an orglet keeps following it while it walks, so it does not leave the frame.
      const position = request.follow && selectionPosition(world, request.follow);
      const isStillSelected = world.selection?.type === request.follow?.type && world.selection?.id === request.follow?.id;
      const moved = position && Math.hypot(position.x - followedAt.current.x, position.z - followedAt.current.z) > 0.02;
      if (isStillSelected && moved) {
        followedAt.current = { x: position.x, z: position.z };
        controls.current.moveTo(position.x, 0, position.z, true);
      }
      return;
    }
    lastRequest.current = request;
    followedAt.current = { x: request.x, z: request.z };
    const target = new THREE.Vector3();
    controls.current.getTarget(target);
    const offset = camera.position.clone().sub(target).normalize().multiplyScalar(request.distance);
    controls.current.setLookAt(request.x + offset.x, offset.y, request.z + offset.z, request.x, 0, request.z, true);
  });
  return null;
}

function Simulation() {
  useFrame((_, deltaSeconds) => advance(deltaSeconds));
  return null;
}

// All spaces stay mounted and only the active one is shown: switching is instant and no label roots unmount mid-render.
function SpaceView({ space, isActive }) {
  return (
    <group visible={isActive}>
      <Grounds space={space} />
      <StaticAssets space={space} />
      {space.rooms.map((spaceRoom) => (
        <Room key={`${space.id}-${spaceRoom.id}`} spaceRoom={spaceRoom} space={space} isActive={isActive} />
      ))}
      {space.orglets.map((orglet) => (
        <Character key={orglet.id} orglet={orglet} isActive={isActive} />
      ))}
    </group>
  );
}

// Re-renders only when the space or the selection changes; motion is driven per frame.
export const Scene = memo(function Scene({ controlsRef }) {
  const space = activeSpace(world);
  return (
    <Canvas
      shadows="soft"
      dpr={1}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ position: CAMERA_OFFSET.toArray(), fov: 30, near: 1, far: 200 }}
      onPointerMissed={(event) => {
        if (event.type === 'click' && window.__pointerTravel < 5) {
          select(null);
        }
      }}
    >
      <color attach="background" args={['#e8ecf6']} />
      <fog attach="fog" args={['#e8ecf6', 60, 110]} />
      <hemisphereLight args={['#ffffff', '#b9c3de', 1.05]} />
      <directionalLight
        position={[14, 26, 10]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={6}
      />
      {/* Soft studio light for the PBR materials; built from local light cards, so nothing is fetched. */}
      <Environment resolution={64} frames={1} environmentIntensity={0.35}>
        <Lightformer intensity={1.6} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 12, 1]} />
        <Lightformer intensity={0.8} position={[8, 2, 6]} rotation={[0, -Math.PI / 4, 0]} scale={[8, 4, 1]} color="#eef1ff" />
        <Lightformer intensity={0.5} position={[-8, 2, -6]} rotation={[0, Math.PI / 4, 0]} scale={[8, 4, 1]} color="#fff4e6" />
      </Environment>
      {/* The simulation and camera rig wait with the spaces for the assets, so the clock and window.__office start
          on the first drawn frame, as they did before the assets were files. */}
      <Suspense fallback={null}>
        <Simulation />
        {world.spaces.map((candidate) => (
          <SpaceView key={candidate.id} space={candidate} isActive={candidate.id === space.id} />
        ))}
        <CameraRig controls={controlsRef} />
      </Suspense>
      <CameraControls
        ref={controlsRef}
        makeDefault
        smoothTime={0.55}
        minDistance={9}
        maxDistance={60}
        minPolarAngle={0.45}
        maxPolarAngle={1.1}
        dollySpeed={0.6}
      />
      <EffectComposer multisampling={4}>
        <N8AO aoRadius={1.4} intensity={2.2} distanceFalloff={0.6} halfRes quality="medium" />
        <Bloom mipmapBlur luminanceThreshold={1} intensity={0.55} radius={0.6} />
      </EffectComposer>
    </Canvas>
  );
});
