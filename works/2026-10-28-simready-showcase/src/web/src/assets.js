// Loads the five SimReady glb files and gives each one its moving parts.
// Every glb lists each mesh node twice (USD reference copies at the root); only the `Geometry` subtree is kept.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const ASSET_DEFS = [
  { id: 'v8', label: 'v8', file: 'models/v8.glb', megabytes: '27.5', triangles: '959k', fit: 2.1 },
  { id: 'turbo', label: 'turbo', file: 'models/turbo.glb', megabytes: '13.1', triangles: '363k', fit: 2.1 },
  { id: 'fan', label: 'fan', file: 'models/fan.glb', megabytes: '31.4', triangles: '1.05M', fit: 2.3 },
  { id: 'vise', label: 'vise', file: 'models/vise.glb', megabytes: '3.1', triangles: '106k', fit: 1.9 },
  { id: 'extinguisher', label: 'extinguisher', file: 'models/extinguisher.glb', megabytes: '3.8', triangles: '109k', fit: 2.0 },
];

const MESH_LAYER = 2; // ascii.js draws layer 2 with the glyph-ramp ("hero") class

function smoothFalloffTexture(innerAlpha) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, `rgba(255,255,255,${innerAlpha})`);
  gradient.addColorStop(0.55, `rgba(255,255,255,${innerAlpha * 0.35})`);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

const POOL_TEXTURE = smoothFalloffTexture(0.55);
const SHADOW_TEXTURE = smoothFalloffTexture(1);

function makeGroundDecals(radius) {
  const decals = new THREE.Group();
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2.6, radius * 2.6),
    new THREE.MeshBasicMaterial({ map: POOL_TEXTURE, color: 0x55555a, transparent: true, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.001;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 1.5, radius * 1.5),
    new THREE.MeshBasicMaterial({ map: SHADOW_TEXTURE, color: 0x000000, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.003;
  decals.add(pool, shadow);
  return decals;
}

/** A thin additive disc standing in for a fast-spinning part: it smears the part's glyphs and its light. */
function makeBlurDisc(part) {
  const mesh = part.getObjectByProperty('isMesh', true);
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  const radius = Math.max(box.max.y - box.min.y, box.max.z - box.min.z) * 0.5;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 1.05, 40),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  disc.rotation.y = Math.PI / 2;
  disc.position.copy(part.position);
  disc.position.x += (box.max.x + box.min.x) * 0.5;
  disc.position.y += (box.max.y + box.min.y) * 0.5;
  disc.position.z += (box.max.z + box.min.z) * 0.5;
  disc.layers.set(MESH_LAYER);
  part.parent.add(disc);
  return disc;
}

const easeBlend = (blend) => blend * blend * (3 - 2 * blend);

export class Asset {
  constructor(definition, model) {
    this.definition = definition;
    this.id = definition.id;
    this.holder = new THREE.Group();
    this.turntable = new THREE.Group();
    this.holder.add(this.turntable);
    this.turntable.add(model);
    this.model = model;
    this.effects = [];
    this.spinners = [];
    this.spinBlend = 0;
    this.spinTarget = 0;
    this.yaw = 0;
    this.jawOffset = 0;
    this.jawTarget = 0;

    this.normalize(definition.fit);
    this.holder.add(makeGroundDecals(this.footprintRadius));
    this.holder.children[1].traverse((child) => { child.layers.set(0); });
    this.findParts();
  }

  normalize(fit) {
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    const scale = fit / Math.max(size.x, size.y, size.z);
    this.model.scale.setScalar(scale);
    this.model.updateMatrixWorld(true);
    const scaled = new THREE.Box3().setFromObject(this.model);
    const center = scaled.getCenter(new THREE.Vector3());
    this.model.position.set(-center.x, -scaled.min.y, -center.z);
    this.height = scaled.max.y - scaled.min.y;
    this.footprintRadius = Math.max(scaled.max.x - scaled.min.x, scaled.max.z - scaled.min.z, this.height * 0.8) * 0.5;
    this.model.traverse((node) => {
      if (node.isMesh) {
        node.layers.set(MESH_LAYER);
        node.frustumCulled = false;
      }
    });
  }

  part(name) {
    const part = this.model.getObjectByName(name);
    if (!part) throw new Error(`${this.id}: part ${name} not found`);
    return part;
  }

  addSpinner(name, idleSpeed, fastSpeed, withBlur) {
    const object = this.part(name);
    const disc = withBlur ? makeBlurDisc(object) : null;
    if (disc) this.effects.push(disc);
    this.spinners.push({ object, idleSpeed, fastSpeed, disc, angle: 0 });
  }

  findParts() {
    if (this.id === 'v8') {
      const ratios = [0.55, -2.4, 2.4, -3.1, 3.1, -2.2, 2.2, -1.5, 1.5];
      ratios.forEach((ratio, index) => this.addSpinner(`gear_0${index + 1}_obj_00`, ratio, ratio * 1.6, false));
    }
    if (this.id === 'turbo') {
      this.addSpinner('turbine_01_obj_00', 0.7, 22, true);
      this.addSpinner('turbine_02_obj_00', 0.6, 30, true);
    }
    if (this.id === 'fan') this.addSpinner('blade_01_obj_00', 0.9, 19, true);
    if (this.id === 'vise') {
      this.jaw = this.part('slidingJaw_01_obj_00');
      this.screw = this.part('screw_01_obj_00');
      this.handle = this.part('handle_01_obj_00');
      this.restPositions = [this.jaw, this.screw, this.handle].map((object) => object.position.x);
      this.screwAngle = 0;
    }
  }

  setSpinning(isFast) {
    this.spinTarget = isFast ? 1 : 0;
  }

  /** Advances the animation by one fixed step. Call once per frame, in order. */
  advance(deltaSeconds) {
    this.spinBlend += (this.spinTarget - this.spinBlend) * (1 - Math.exp(-deltaSeconds * 2.4));
    const blend = easeBlend(this.spinBlend);
    for (const spinner of this.spinners) {
      const speed = spinner.idleSpeed + (spinner.fastSpeed - spinner.idleSpeed) * blend;
      spinner.angle += speed * deltaSeconds;
      spinner.object.rotation.x = spinner.angle;
      if (spinner.disc) spinner.disc.material.opacity = Math.min(1, Math.max(0, (blend - 0.3) / 0.5)) * 0.34;
    }
    if (this.id === 'extinguisher') {
      this.yaw += 0.85 * deltaSeconds;
      this.turntable.rotation.y = this.yaw;
    }
    if (this.id === 'vise') {
      this.jawOffset += (this.jawTarget - this.jawOffset) * (1 - Math.exp(-deltaSeconds * 9));
      const offset = this.jawOffset * JAW_DIRECTION;
      [this.jaw, this.screw, this.handle].forEach((object, index) => { object.position.x = this.restPositions[index] + offset; });
      this.screwAngle = this.jawOffset * SCREW_RADIANS_PER_METER;
      this.screw.rotation.x = this.screwAngle;
      this.handle.rotation.x = this.screwAngle;
    }
  }
}

// Opening the vise moves the jaw, screw and handle together along the screw axis (local x of the model).
export const JAW_DIRECTION = 1;
export const SCREW_RADIANS_PER_METER = 900;
export const JAW_TRAVEL = 0.05;

export async function loadAssets(baseUrl = './') {
  const loader = new GLTFLoader();
  const assets = [];
  for (const definition of ASSET_DEFS) {
    const gltf = await loader.loadAsync(baseUrl + definition.file);
    const model = gltf.scene;
    for (const child of [...model.children]) {
      if (child.name !== 'Geometry') model.remove(child);
    }
    assets.push(new Asset(definition, model));
  }
  return assets;
}
