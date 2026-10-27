import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { sim, world } from '../appContext.js';
import { createPlant } from './plant.js';
import { createGround } from './ground.js';
import { applyRigToCamera, clearSelection, dragOrbit, dragPan, plantRef, positionOfSelection, rig, selectBag, selectUnit, snapToView, updateRig, zoomBy } from '../runtime.js';
import { getState } from '../store.js';
import { SITES } from '../model.js';
import { updatePins } from '../pins.js';
import { updatePlayback } from '../playback.js';

const ASSET_NAMES = ['bags', 'conveyors', 'sorter', 'screening', 'logistics', 'ramp'];
ASSET_NAMES.forEach((name) => useGLTF.preload(`/assets/${name}.glb`));

const RING_COLOR = '#1d6bff';

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl);
    const environment = generator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.4;
    scene.background = new THREE.Color('#d3e2f0');
    scene.fog = new THREE.Fog('#d3e2f0', 170, 380);
    return () => {
      environment.dispose();
      generator.dispose();
    };
  }, [gl, scene]);
  return null;
}

// One place that advances everything in a fixed order each frame: simulation, plant, camera, light, pins.
function Driver({ plant }) {
  const { camera, gl, size, raycaster } = useThree();
  const lightRef = useRef();
  const ringRef = useRef();
  const lastSnap = useRef(new THREE.Vector3());

  useEffect(() => {
    snapToView(SITES[0].view);
    camera.near = 0.5;
    camera.far = 600;
    camera.fov = 30;
    camera.updateProjectionMatrix();
    rig.orbitRate = 0.035;
  }, [camera]);

  useEffect(() => {
    const element = gl.domElement;
    let pointerStart = null;
    let lastX = 0;
    let lastY = 0;
    let moved = 0;
    let button = 0;
    const onDown = (event) => {
      pointerStart = { x: event.clientX, y: event.clientY };
      lastX = event.clientX;
      lastY = event.clientY;
      moved = 0;
      button = event.button;
      element.setPointerCapture(event.pointerId);
    };
    const onMove = (event) => {
      if (!pointerStart) return;
      const deltaX = event.clientX - lastX;
      const deltaY = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      moved += Math.abs(deltaX) + Math.abs(deltaY);
      if (moved > 5) {
        if (button === 2 || event.shiftKey) dragPan(deltaX, deltaY);
        else dragOrbit(deltaX, deltaY);
        rig.orbitRate = 0;
      }
    };
    const onUp = (event) => {
      if (!pointerStart) return;
      const wasClick = moved <= 5 && button === 0;
      pointerStart = null;
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      if (!wasClick) return;
      const rectangle = element.getBoundingClientRect();
      const pointer = new THREE.Vector2(((event.clientX - rectangle.left) / rectangle.width) * 2 - 1, -((event.clientY - rectangle.top) / rectangle.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = plant.pick(raycaster);
      if (!hit) clearSelection();
      else if (hit.kind === 'bag') selectBag(hit.planId);
      else selectUnit(hit.unitId, { fly: false });
    };
    const onWheel = (event) => {
      event.preventDefault();
      zoomBy(Math.exp(event.deltaY * 0.0012));
    };
    const onContextMenu = (event) => event.preventDefault();
    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('contextmenu', onContextMenu);
    const onKey = (event) => {
      if (event.key === 'Escape') clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKey);
    };
  }, [gl, camera, raycaster, plant]);

  useFrame((state, delta) => {
    const deltaSeconds = Math.min(delta, 0.1);
    updatePlayback(deltaSeconds);
    sim.advance(deltaSeconds);
    plant.update(sim.alpha);
    updateRig(deltaSeconds);
    applyRigToCamera(camera);

    // The sun follows the camera target, snapped to whole metres so shadows do not shimmer.
    const light = lightRef.current;
    if (light) {
      const snapped = lastSnap.current.set(Math.round(rig.target.x), 0, Math.round(rig.target.z));
      light.target.position.copy(snapped);
      light.position.set(snapped.x - 26, 48, snapped.z - 30);
      light.target.updateMatrixWorld();
    }

    // Selection ring fitted to the selected object.
    const ring = ringRef.current;
    const selection = getState().selection;
    ring.visible = false;
    if (selection) {
      if (selection.kind === 'bag') {
        const position = plant.positionOfBag(selection.planId);
        if (position) {
          const radiusX = 0.52;
          const radiusZ = 0.36;
          ring.visible = true;
          ring.position.set(position.x, position.y + 0.03, position.z);
          ring.scale.set(radiusX, radiusZ, 1);
          const entry = sim.entryFor(selection.planId);
          ring.rotation.set(-Math.PI / 2, entry ? entry.current[3] : 0, 0, 'YXZ');
        }
      } else {
        const bounds = plant.boundsOfUnit(selection.unitId);
        if (bounds) {
          ring.visible = true;
          ring.position.set(bounds.centre.x, bounds.centre.y - bounds.size.y / 2 + 0.05, bounds.centre.z);
          ring.scale.set(Math.max(0.6, (bounds.size.x / 2) * 1.2), Math.max(0.6, (bounds.size.z / 2) * 1.2), 1);
          ring.rotation.set(-Math.PI / 2, 0, 0, 'YXZ');
        }
      }
    }
    updatePins(camera, size.width, size.height);
    window.__camera = camera;
    void state;
    void positionOfSelection;
  });

  return (
    <>
      <directionalLight
        ref={lightRef}
        intensity={2.0}
        color="#fff5e6"
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-48}
        shadow-camera-right={48}
        shadow-camera-top={48}
        shadow-camera-bottom={-48}
        shadow-camera-near={5}
        shadow-camera-far={140}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
        shadow-radius={3}
      />
      <hemisphereLight args={['#dbe8ff', '#a9b6c4', 0.55]} />
      <mesh ref={ringRef} renderOrder={20} visible={false}>
        <ringGeometry args={[0.9, 1, 64]} />
        <meshBasicMaterial color={RING_COLOR} transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </>
  );
}

function PlantView() {
  const gltfs = ASSET_NAMES.map((name) => useGLTF(`/assets/${name}.glb`));
  const plant = useMemo(() => {
    const scenes = {};
    ASSET_NAMES.forEach((name, index) => {
      scenes[name] = gltfs[index].scene;
    });
    return createPlant(scenes, sim);
  }, [gltfs]);
  const ground = useMemo(() => createGround(world), []);
  useEffect(() => {
    plantRef.current = plant;
    window.__plant = plant;
    return () => {
      plantRef.current = null;
    };
  }, [plant]);
  return (
    <>
      <primitive object={ground} />
      <primitive object={plant.root} />
      <Driver plant={plant} />
    </>
  );
}

export default function Scene() {
  return (
    <Canvas
      flat
      shadows
      dpr={1}
      camera={{ fov: 30, near: 0.5, far: 600, position: [30, 24, 50] }}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
    >
      <Environment />
      <Suspense fallback={null}>
        <PlantView />
      </Suspense>
      <EffectComposer multisampling={0}>
        <N8AO aoRadius={1.7} intensity={2.4} distanceFalloff={1.2} color="#3d4d60" quality="medium" halfRes />
        <Bloom intensity={0.55} luminanceThreshold={1.0} luminanceSmoothing={0.2} mipmapBlur />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  );
}
