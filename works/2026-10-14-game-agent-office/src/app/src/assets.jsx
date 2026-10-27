// Loads the Blender-built GLBs (see blender/build_office.py) and draws them.
// Static pieces are drawn with one InstancedMesh per mesh of an asset; animated pieces are cloned.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const ASSET_FILES = ['/assets/furniture.glb', '/assets/room.glb', '/assets/nature.glb', '/assets/orglet.glb'];
for (const file of ASSET_FILES) {
  useGLTF.preload(file);
}

// Floor-standing assets have their origin on the floor; the room floor's top is this high.
export const FLOOR = 0.1;
export const DESK_TOP = 0.66;

function prepareMesh(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const material = mesh.material;
  if (material.name === 'Tint_Screen') {
    // Screens are lit by their own colour, set per instance, bright enough for a soft bloom.
    mesh.material = new THREE.MeshBasicMaterial({ name: 'Tint_Screen', toneMapped: false });
    mesh.castShadow = false;
  } else if (material.emissive && material.emissive.getHex() !== 0) {
    material.toneMapped = false;
  }
}

// Every asset root by name, across all GLBs.
export function useAssets() {
  const files = useGLTF(ASSET_FILES);
  return useMemo(() => {
    const roots = {};
    for (const gltf of files) {
      gltf.scene.traverse((object) => {
        if (object.isMesh && !object.userData.prepared) {
          prepareMesh(object);
          object.userData.prepared = true;
        }
      });
      for (const root of gltf.scene.children) {
        roots[root.name] = root;
      }
    }
    return roots;
  }, [files]);
}

// A copy of an asset whose named parts get their own materials, so they can be recoloured or animated alone.
export function cloneAsset(asset, ownMaterialFor = () => false) {
  const copy = asset.clone(true);
  copy.traverse((object) => {
    if (object.isMesh && ownMaterialFor(object)) {
      object.material = object.material.clone();
    }
  });
  return copy;
}

function meshParts(asset) {
  asset.updateMatrixWorld(true);
  const rootInverse = asset.matrixWorld.clone().invert();
  const parts = [];
  asset.traverse((object) => {
    if (object.isMesh) {
      parts.push({
        geometry: object.geometry,
        material: object.material,
        castShadow: object.castShadow,
        isTinted: object.material.name.startsWith('Tint_'),
        matrix: rootInverse.clone().multiply(object.matrixWorld),
      });
    }
  });
  return parts;
}

function InstancedPart({ part, placements }) {
  const mesh = useRef();
  useLayoutEffect(() => {
    const instance = mesh.current;
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const scale = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    placements.forEach((placement, index) => {
      position.fromArray(placement.position);
      rotation.setFromAxisAngle(yAxis, placement.rotationY ?? 0);
      scale.fromArray(placement.scale ?? [1, 1, 1]);
      matrix.compose(position, rotation, scale).multiply(part.matrix);
      instance.setMatrixAt(index, matrix);
      if (part.isTinted) {
        instance.setColorAt(index, color.set(placement.color ?? '#ffffff').multiplyScalar(placement.brightness ?? 1));
      }
    });
    instance.instanceMatrix.needsUpdate = true;
    if (instance.instanceColor) {
      instance.instanceColor.needsUpdate = true;
    }
    instance.computeBoundingSphere();
  }, [part, placements]);
  return (
    <instancedMesh
      ref={mesh}
      args={[part.geometry, part.material, placements.length]}
      castShadow={part.castShadow}
      receiveShadow
    />
  );
}

// placements: [{ position: [x, y, z], rotationY?, scale?: [x, y, z], color?, brightness? }]
export function InstancedAsset({ asset, placements }) {
  const parts = useMemo(() => meshParts(asset), [asset]);
  if (placements.length === 0) {
    return null;
  }
  return parts.map((part, index) => <InstancedPart key={`${index}-${placements.length}`} part={part} placements={placements} />);
}
