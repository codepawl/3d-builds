import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SecondOrderDynamics, solveTwoBone, hermiteMotion } from "./motion.mjs";
import { createIndustrialEnvironment } from "./environment.mjs";
import { createMechanicalAudio } from "./footsteps.mjs";
import { createStrandPhysics } from "./strand-physics.mjs";

const canvas = document.querySelector("#world");
const mechanicalAudio = createMechanicalAudio();
const comparisonCapture =
  new URLSearchParams(location.search).get("capture") === "compare";
const showcase = {
  active: false,
  elapsed: 0,
  duration: 43.834,
  beats: [],
  groundPhase: "approach",
  pauseElapsed: 0,
};
const showcaseParams = { speed: 1.15, step: 0.3 };
const rig = {
  hipX: 0.38,
  hipY: 1.04,
  coxa: 0.4,
  upper: 1.05,
  lower: 1.5,
  sole: 0.25,
  reachHome: 2.3,
  reachHold: 2.4,
};
const course = { wallStart: 5, radius: 3.25, wallTop: 8 };
course.wallEnd =
  course.wallStart +
  (course.radius * Math.PI) / 2 +
  course.wallTop -
  course.radius -
  2.2;
const jumpTiming = { transfer: 0.92, lift: 0.72, pull: 1.06, push: 0.22 };
const jumpGravity = 18;
const flight = {
  phase: "none",
  elapsed: 0,
  duration: 0,
  root: new THREE.Vector3(),
  prepBase: new THREE.Vector3(),
  rootVelocity: new THREE.Vector3(),
  start: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  landing: new THREE.Vector3(),
  launchRotation: new THREE.Quaternion(),
  landRotation: new THREE.Quaternion(),
  elapsedLanding: 0,
};
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.info.autoReset = false;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#080d14");
scene.fog = new THREE.Fog("#252d31", 24, 55);
const camera = new THREE.OrthographicCamera(-7, 7, 5.5, -5.5, 0.1, 100);
camera.position.set(-11, 4.8, 6);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.75, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.enablePan = false;
controls.minZoom = 0.55;
controls.maxZoom = 2.3;
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = Math.PI / 2 - 0.06;
controls.mouseButtons = {
  LEFT: null,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.ROTATE,
};
controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.update();
scene.add(new THREE.HemisphereLight("#789cbe", "#100c0a", 0.28));
const sun = new THREE.DirectionalLight("#9bb7cd", 1.8);
sun.position.set(-6, 11, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {
  left: -12,
  right: 12,
  top: 12,
  bottom: -12,
  near: 0.1,
  far: 40,
});
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.03;
scene.add(sun);
scene.add(sun.target);
const rim = new THREE.DirectionalLight("#78b8e4", 3.5);
rim.position.set(5, 7, -7);
scene.add(rim);
const front = new THREE.DirectionalLight("#e3b080", 0.3);
front.position.set(2, 4, 8);
scene.add(front);

const state = {
  ready: false,
  mode: "follow",
  mood: "curious",
  pixel: true,
  terrain: false,
  side: "left",
  phase: "grounded",
  steps: 0,
  vents: 0,
};
const presets = {
  curious: { speed: 0.38, step: 0.95 },
  sleepy: { speed: 0.25, step: 1.2 },
  bouncy: { speed: 0.48, step: 0.82 },
};
let params = presets.curious;
const goal = new THREE.Vector3(),
  drive = new THREE.Vector3(),
  velocity = new THREE.Vector3();
const bodyX = new SecondOrderDynamics(1.5, 1, 0),
  bodyZ = new SecondOrderDynamics(1.5, 1, 0);
const yawSpring = new SecondOrderDynamics(1.2, 1, 0),
  headSpring = new SecondOrderDynamics(0.8, 1, 0);
const bodyHeight = new SecondOrderDynamics(1.5, 1, 0);
const brakingPitch = new SecondOrderDynamics(2, 0.48, 0);
const bodyPitch = new SecondOrderDynamics(1.5, 1, 0),
  bodyRoll = new SecondOrderDynamics(1.5, 1, 0);
let yawTarget = 0,
  time = 0,
  lastFrame = performance.now(),
  orbiting = false,
  ventUntil = 0;

const obstacles = [
  { type: "box", x: 0, z: -0.95, width: 7.5, depth: 0.7, height: 0.38 },
  { type: "pipe", x: 0, z: 0.25, width: 7.5, radius: 0.23 },
  { type: "box", x: -2.8, z: 1.35, width: 0.9, depth: 1, height: 0.32 },
  { type: "box", x: 2.8, z: 1.35, width: 0.9, depth: 1, height: 0.32 },
];
function heightAt(x, z) {
  if (!state.terrain) return 0;
  let height = 0;
  for (const obstacle of obstacles) {
    if (Math.abs(x - obstacle.x) > obstacle.width / 2) continue;
    const zDistance = Math.abs(z - obstacle.z);
    if (obstacle.type === "pipe" && zDistance <= obstacle.radius) {
      height = Math.max(
        height,
        obstacle.radius + Math.sqrt(obstacle.radius ** 2 - zDistance ** 2),
      );
    } else if (obstacle.type === "box" && zDistance <= obstacle.depth / 2) {
      height = Math.max(height, obstacle.height);
    }
  }
  return height;
}
const strandHullInverse = new THREE.Matrix4();
const strandHullPoint = new THREE.Vector3();
function collideStrand(point, radius, segmentIndex = 0) {
  strandHullPoint.copy(point).applyMatrix4(strandHullInverse);
  strandHullPoint.y -= 2.01;
  strandHullPoint.z += 0.1;
  const shellDistance = Math.hypot(
    strandHullPoint.x / 0.71,
    strandHullPoint.y / 0.63,
    strandHullPoint.z / 0.82,
  );
  // The attachment and short concealed feed pass under the irregular helmet lip.
  if (segmentIndex > 8 && shellDistance < 1 && shellDistance > 1e-5) {
    strandHullPoint.multiplyScalar(1 / shellDistance);
    strandHullPoint.y += 2.01;
    strandHullPoint.z -= 0.1;
    point.copy(strandHullPoint).applyMatrix4(visibleSpider.matrixWorld);
  }
  point.y = Math.max(heightAt(point.x, point.z) + radius, point.y);
  if (!showcase.active || Math.abs(point.x) > 4.5 + radius) return;
  const wallFront = course.wallStart + course.radius;
  if (
    point.y >= course.radius &&
    point.y < course.wallTop + radius &&
    point.z > wallFront - radius &&
    point.z < wallFront + 0.35 + radius
  ) {
    point.z = wallFront - radius;
  } else if (
    point.y < course.radius &&
    point.z > course.wallStart &&
    point.z <= wallFront
  ) {
    const vertical = point.y - course.radius;
    const forward = point.z - course.wallStart;
    const distance = Math.hypot(vertical, forward);
    const limit = course.radius - radius;
    if (distance > limit) {
      point.y = course.radius + (vertical * limit) / distance;
      point.z = course.wallStart + (forward * limit) / distance;
    }
  }
}
const groundGeometry = new THREE.PlaneGeometry(50, 50, 80, 80);
groundGeometry.rotateX(-Math.PI / 2);
const ground = new THREE.Mesh(
  groundGeometry,
  new THREE.MeshStandardMaterial({ color: "#515a5b", roughness: 0.88 }),
);
ground.receiveShadow = true;
scene.add(ground);
const obstacleGroup = new THREE.Group();
obstacleGroup.visible = state.terrain;
scene.add(obstacleGroup);
const steel = new THREE.MeshStandardMaterial({
  color: "#67787f",
  metalness: 0.78,
  roughness: 0.42,
});
const darkSteel = new THREE.MeshStandardMaterial({
  color: "#3d494e",
  metalness: 0.65,
  roughness: 0.5,
});
const wallGroup = new THREE.Group();
wallGroup.visible = false;
scene.add(wallGroup);
const arcVertices = [],
  arcIndices = [];
for (let i = 0; i <= 128; i++) {
  const angle = ((i / 128) * Math.PI) / 2;
  for (const x of [-4.5, 4.5])
    arcVertices.push(
      x,
      course.radius * (1 - Math.cos(angle)),
      course.wallStart + course.radius * Math.sin(angle),
    );
  if (i < 128) {
    const v = i * 2;
    arcIndices.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
  }
}
const arcGeometry = new THREE.BufferGeometry();
arcGeometry.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(arcVertices, 3),
);
arcGeometry.setIndex(arcIndices);
arcGeometry.computeVertexNormals();
const wallMaterial = darkSteel.clone();
wallMaterial.side = THREE.DoubleSide;
const curvedBase = new THREE.Mesh(arcGeometry, wallMaterial);
curvedBase.receiveShadow = true;
curvedBase.castShadow = true;
wallGroup.add(curvedBase);
const wallPanel = new THREE.Mesh(
  new THREE.BoxGeometry(9, course.wallTop - course.radius, 0.35),
  darkSteel,
);
wallPanel.position.set(
  0,
  (course.wallTop + course.radius) / 2,
  course.wallStart + course.radius + 0.175,
);
wallPanel.castShadow = true;
wallPanel.receiveShadow = true;
wallGroup.add(wallPanel);
for (const x of [-4.35, 4.35]) {
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, course.wallTop - course.radius, 0.15),
    steel,
  );
  rail.position.set(
    x,
    (course.wallTop + course.radius) / 2,
    course.wallStart + course.radius - 0.04,
  );
  wallGroup.add(rail);
}
for (const obstacle of obstacles) {
  let geometry;
  if (obstacle.type === "pipe") {
    geometry = new THREE.CylinderGeometry(
      obstacle.radius,
      obstacle.radius,
      obstacle.width,
      24,
    );
    geometry.rotateZ(Math.PI / 2);
  } else
    geometry = new THREE.BoxGeometry(
      obstacle.width,
      obstacle.height,
      obstacle.depth,
    );
  const mesh = new THREE.Mesh(
    geometry,
    obstacle.type === "pipe" ? steel : darkSteel,
  );
  mesh.position.set(
    obstacle.x,
    obstacle.type === "pipe" ? obstacle.radius : obstacle.height / 2,
    obstacle.z,
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  obstacleGroup.add(mesh);
  if (obstacle.type === "box") {
    const bolts = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.012, 6),
      steel,
      4,
    );
    const boltTransform = new THREE.Object3D();
    for (let index = 0; index < 4; index++) {
      boltTransform.position.set(
        obstacle.x + (index % 2 ? 1 : -1) * (obstacle.width / 2 - 0.12),
        obstacle.height + 0.006,
        obstacle.z + (index < 2 ? 1 : -1) * (obstacle.depth / 2 - 0.12),
      );
      boltTransform.updateMatrix();
      bolts.setMatrixAt(index, boltTransform.matrix);
    }
    obstacleGroup.add(bolts);
  }
}
const grid = new THREE.Group();
scene.add(grid);
const gridMaterial = new THREE.LineBasicMaterial({
  color: "#98a4a4",
  transparent: true,
  opacity: 0.075,
});
const majorMaterial = new THREE.LineBasicMaterial({
  color: "#b2bbbb",
  transparent: true,
  opacity: 0.15,
});
function updateGround() {
  const positions = groundGeometry.attributes.position;
  for (let i = 0; i < positions.count; i++) positions.setY(i, 0);
  positions.needsUpdate = true;
  groundGeometry.computeVertexNormals();
  for (const child of [...grid.children]) {
    child.geometry.dispose();
    grid.remove(child);
  }
  for (let line = -24; line <= 24; line++) {
    const points = [];
    for (let s = -48; s < 48; s++) {
      const a = s / 2,
        b = (s + 1) / 2;
      points.push(line, 0.008, a, line, 0.008, b);
      points.push(a, 0.008, line, b, 0.008, line);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3),
    );
    grid.add(
      new THREE.LineSegments(
        geometry,
        line % 4 === 0 ? majorMaterial : gridMaterial,
      ),
    );
  }
}
updateGround();
const industrialEnvironment = createIndustrialEnvironment({
  THREE,
  scene,
  renderer,
  ground,
  wallGroup,
  obstacleGroup,
});

const lowResolution = new THREE.WebGLRenderTarget(400, 260, {
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
});
const postScene = new THREE.Scene(),
  postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const pixelMaterial = new THREE.ShaderMaterial({
  uniforms: { frame: { value: lowResolution.texture } },
  depthTest: false,
  depthWrite: false,
  vertexShader:
    "varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position,1.0);}",
  fragmentShader: `uniform sampler2D frame; varying vec2 vUv;
    void main(){gl_FragColor=texture2D(frame,vUv);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      gl_FragColor.rgb=floor(gl_FragColor.rgb*28.0+.5)/28.0;
    }`,
});
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), pixelMaterial));

const currentFrame = new THREE.WebGLRenderTarget(400, 260, {
  type: THREE.HalfFloatType,
});
let blendedFrame = currentFrame.clone();
let previousFrame = currentFrame.clone();
let motionHistoryReady = false;
let motionHistoryTime = 0;
const blendScene = new THREE.Scene();
const blendMaterial = new THREE.ShaderMaterial({
  uniforms: {
    current: { value: currentFrame.texture },
    previous: { value: previousFrame.texture },
    weight: { value: 0 },
  },
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
  vertexShader:
    "varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position,1.0);}",
  fragmentShader: `uniform sampler2D current; uniform sampler2D previous; uniform float weight;
    varying vec2 vUv; void main(){gl_FragColor=mix(texture2D(current,vUv), texture2D(previous,vUv),weight);}`,
});
blendScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blendMaterial));
const displayScene = new THREE.Scene();
const displayMaterial = new THREE.ShaderMaterial({
  uniforms: { frame: { value: blendedFrame.texture } },
  depthTest: false,
  depthWrite: false,
  vertexShader:
    "varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position,1.0);}",
  fragmentShader: `uniform sampler2D frame; varying vec2 vUv;
    void main(){gl_FragColor=texture2D(frame,vUv);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
displayScene.add(
  new THREE.Mesh(new THREE.PlaneGeometry(2, 2), displayMaterial),
);

// This HUD is drawn through WebGL, so captureStream records the real measurements.
const statsCanvas = document.createElement("canvas");
statsCanvas.width = 440;
statsCanvas.height = 156;
const statsContext = statsCanvas.getContext("2d");
const statsTexture = new THREE.CanvasTexture(statsCanvas);
statsTexture.colorSpace = THREE.SRGBColorSpace;
const statsScene = new THREE.Scene();
const statsCamera = new THREE.OrthographicCamera(
  0,
  innerWidth,
  innerHeight,
  0,
  -1,
  1,
);
const statsSprite = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: statsTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  }),
);
statsSprite.scale.set(220, 78, 1);
statsScene.add(statsSprite);
const frameSamples = [];
let frameMs = 0,
  fps = 0,
  lastStatsUpdate = -1,
  movingLegs = 0;
function drawStats() {
  const ctx = statsContext;
  ctx.clearRect(0, 0, 440, 156);
  ctx.fillStyle = "rgba(12,18,21,.78)";
  ctx.fillRect(0, 0, 440, 156);
  ctx.font = "22px monospace";
  ctx.fillStyle = "#e5ecec";
  ctx.fillText(
    `${fps.toFixed(0)} FPS  ${frameMs.toFixed(1)} ms  ${movingLegs}/${legs.length || 6} moving`,
    18,
    32,
  );
  ctx.font = "16px monospace";
  ctx.fillStyle = "#9baeb2";
  ctx.fillText("FRAME TIME · 0–50 ms", 18, 57);
  ctx.strokeStyle = "#96c3b2";
  ctx.lineWidth = 2;
  ctx.beginPath();
  frameSamples.forEach((sample, i) => {
    const x = 18 + (i / Math.max(1, frameSamples.length - 1)) * 404;
    const y = 138 - (Math.min(sample, 50) / 50) * 67;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  statsTexture.needsUpdate = true;
}
function resize() {
  const width = innerWidth,
    height = innerHeight;
  renderer.setSize(width, height);
  const panelWidth = comparisonCapture ? width / 2 : width;
  const halfHeight = comparisonCapture ? 4.85 : width < 600 ? 9 : 3.75;
  camera.left = (-halfHeight * panelWidth) / height;
  camera.right = -camera.left;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
  lowResolution.setSize(
    Math.max(1, Math.round((panelWidth * renderer.getPixelRatio()) / 4)),
    Math.max(1, Math.round((height * renderer.getPixelRatio()) / 4)),
  );
  for (const target of [currentFrame, blendedFrame, previousFrame]) {
    target.setSize(
      Math.round(panelWidth * renderer.getPixelRatio()),
      Math.round(height * renderer.getPixelRatio()),
    );
  }
  motionHistoryReady = false;
  statsCamera.right = width;
  statsCamera.top = height;
  statsCamera.updateProjectionMatrix();
  statsSprite.position.set(width - 126, width < 600 ? 170 : 57, 0);
}
addEventListener("resize", resize);
resize();

const spider = new THREE.Group();
// Simulation uses intrinsic course coordinates; the visible rig follows its tangent frame.
const visibleSpider = new THREE.Group();
scene.add(visibleSpider);
const eyeLight = new THREE.PointLight("#ffad36", 3, 3, 2);
scene.add(eyeLight);
const glowCanvas = document.createElement("canvas");
glowCanvas.width = glowCanvas.height = 64;
const glowContext = glowCanvas.getContext("2d");
const glowGradient = glowContext.createRadialGradient(32, 32, 1, 32, 32, 32);
glowGradient.addColorStop(0, "rgba(255,191,70,0.9)");
glowGradient.addColorStop(0.2, "rgba(255,136,30,0.35)");
glowGradient.addColorStop(1, "rgba(255,113,20,0)");
glowContext.fillStyle = glowGradient;
glowContext.fillRect(0, 0, 64, 64);
const eyeGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowCanvas),
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    opacity: 0.5,
  }),
);
eyeGlow.scale.setScalar(0.42);
scene.add(eyeGlow);
let body, head, headRest, strandPhysics;
const landingHeight = new SecondOrderDynamics(2.5, 0.32, 0);
const landingForward = new SecondOrderDynamics(2.5, 0.8, 0);
const landingPitch = new SecondOrderDynamics(2.2, 0.38, 0);
const legs = [];
const up = new THREE.Vector3(0, 1, 0),
  direction = new THREE.Vector3(),
  tmp = new THREE.Vector3();
const hipWorld = new THREE.Vector3(),
  coxaEnd = new THREE.Vector3(),
  poleWorld = new THREE.Vector3(),
  reachHip = new THREE.Vector3();
const pairGroups = [
  ["L0", "R1"],
  ["R0", "L2"],
  ["L1", "R2"],
];
let gaitGroup = 0;
function localToWorld(x, y, z, out = new THREE.Vector3()) {
  return out.set(x, y, z).applyMatrix4(spider.matrixWorld);
}
function courseAngle(s) {
  return showcase.active
    ? THREE.MathUtils.clamp(
        (s - course.wallStart) / course.radius,
        0,
        Math.PI / 2,
      )
    : 0;
}
function coursePoint(point, out = new THREE.Vector3()) {
  const angle = courseAngle(point.z);
  if (angle === 0) return out.copy(point);
  const arcEnd = course.wallStart + (course.radius * Math.PI) / 2;
  const rise = point.z > arcEnd ? point.z - arcEnd : 0;
  return out.set(
    point.x,
    course.radius * (1 - Math.cos(angle)) + rise + point.y * Math.cos(angle),
    course.wallStart +
      course.radius * Math.sin(angle) -
      point.y * Math.sin(angle),
  );
}
const mappedHip = new THREE.Vector3(),
  mappedFoot = new THREE.Vector3();
function updateVisibleRig() {
  if (flight.phase === "pullUp" || flight.phase === "pushOff") {
    const pullElapsed = flight.prepTime - jumpTiming.transfer;
    const liftEnd = [0, 9.4, flight.prepBase.z];
    const liftVelocity = [0, 1, 0];
    const pullEnd = [0, 8.65, flight.prepBase.z];
    const crestVelocity = [0, 0.3, 0.5];
    const pose =
      flight.phase === "pushOff"
        ? hermiteMotion(
            pullEnd,
            [0, 9.15, flight.prepBase.z + 0.8],
            crestVelocity,
            [0, 3.8, 7.2],
            jumpTiming.push,
            pullElapsed - jumpTiming.pull,
          )
        : pullElapsed < jumpTiming.lift
          ? hermiteMotion(
              flight.prepBase.toArray(),
              liftEnd,
              [0, 0, 0],
              liftVelocity,
              jumpTiming.lift,
              pullElapsed,
            )
          : hermiteMotion(
              liftEnd,
              pullEnd,
              liftVelocity,
              crestVelocity,
              jumpTiming.pull - jumpTiming.lift,
              pullElapsed - jumpTiming.lift,
            );
    visibleSpider.position.fromArray(pose.position);
    flight.rootVelocity.fromArray(pose.velocity);
    // Raise the pelvis in the climbing pose before rolling the cleared chassis over the crest.
    const progress = THREE.MathUtils.clamp(
      (pullElapsed - jumpTiming.lift) / (jumpTiming.pull - jumpTiming.lift),
      0,
      1,
    );
    const extension = THREE.MathUtils.clamp((pullElapsed - jumpTiming.pull) / jumpTiming.push, 0, 1);
    const arch = flight.phase === "pushOff" ? -0.3 * smootherstep(extension) : 0.18 * Math.sin(Math.PI * progress);
    const pitch = (-Math.PI / 2) * (1 - smootherstep(progress)) + arch;
    visibleSpider.rotation.set(pitch, spider.rotation.y, 0);
    visibleSpider.updateMatrixWorld(true);
    return;
  }
  if (["airborne", "landing", "landed"].includes(flight.phase)) {
    visibleSpider.position.copy(flight.root);
    if (flight.phase !== "airborne") {
      visibleSpider.quaternion.copy(flight.landRotation);
      visibleSpider.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          landingPitch.value,
        ),
      );
    }
    visibleSpider.updateMatrixWorld(true);
    return;
  }
  coursePoint(spider.position, visibleSpider.position);
  const surfaceRotation = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    -courseAngle(spider.position.z),
  );
  visibleSpider.quaternion.copy(surfaceRotation).multiply(spider.quaternion);
  visibleSpider.updateMatrixWorld(true);
}
function footHome(leg, out = new THREE.Vector3()) {
  localToWorld(leg.side * leg.restX, 0, leg.restZ, out);
  out.y = heightAt(out.x, out.z) + rig.sole;
  return reachableFoothold(leg, out);
}
function legReach(leg, foot) {
  localToWorld(leg.side * rig.hipX, rig.hipY, leg.hipZ, reachHip);
  mappedHip
    .set(leg.side * rig.hipX, rig.hipY, leg.hipZ)
    .applyMatrix4(visibleSpider.matrixWorld);
  coursePoint(foot, mappedFoot);
  // Coxa points along the current hull's tangent plane.
  const normal = new THREE.Vector3(
    0,
    Math.cos(courseAngle(spider.position.z)),
    -Math.sin(courseAngle(spider.position.z)),
  );
  const delta = mappedFoot.sub(mappedHip);
  const normalDistance = delta.dot(normal);
  const tangentDistance = Math.sqrt(
    Math.max(0, delta.lengthSq() - normalDistance ** 2),
  );
  return Math.hypot(tangentDistance - rig.coxa, normalDistance);
}
function reachableFoothold(leg, foot) {
  // A raised/tilted hull needs a narrower stance, not a stretched bone chain.
  for (
    let attempt = 0;
    attempt < 30 && legReach(leg, foot) > rig.reachHome;
    attempt++
  ) {
    foot.x = THREE.MathUtils.lerp(foot.x, reachHip.x, 0.06);
    foot.z = THREE.MathUtils.lerp(foot.z, reachHip.z, 0.06);
    foot.y = heightAt(foot.x, foot.z) + rig.sole;
  }
  return foot;
}
function supportNeedsStep(leg) {
  const stepDistance =
    showcase.active && Math.abs(course.wallEnd - spider.position.z) < 0.15
      ? 0.12
      : 0.42;
  return (
    leg.phase === "planted" &&
    (footHome(leg, tmp).distanceTo(leg.position) > stepDistance ||
      legReach(leg, leg.position) > rig.reachHold)
  );
}
function positionSegment(mesh, start, end) {
  direction.subVectors(end, start);
  const length = direction.length();
  mesh.position.copy(start);
  mesh.quaternion.setFromUnitVectors(up, direction.normalize());
  mesh.scale.set(1, length, 1);
}
function resetFeet() {
  spider.updateMatrixWorld(true);
  updateVisibleRig();
  for (const leg of legs) {
    footHome(leg, leg.position);
    leg.start.copy(leg.position);
    leg.end.copy(leg.position);
    leg.phase = "planted";
    leg.topAnchor = null;
    leg.topTransfer = null;
    leg.worldTarget = null;
    leg.progress = 0;
  }
}
const ease = (value) => value * value * (3 - 2 * value);
const smootherstep = (value) =>
  value * value * value * (value * (value * 6 - 15) + 10);
function updateLegs(dt) {
  spider.updateMatrixWorld(true);
  updateVisibleRig();
  const busy = legs.some((leg) => leg.phase !== "planted");
  if (!busy && state.phase === "grounded") {
    // Work through opposing pairs; four feet support the hull throughout a cycle.
    for (let offset = 0; offset < pairGroups.length; offset++) {
      const groupIndex = (gaitGroup + offset) % pairGroups.length;
      const pair = pairGroups[groupIndex].map((name) =>
        legs.find((leg) => leg.name === name),
      );
      if (!pair.some(supportNeedsStep)) continue;
      for (const leg of pair) {
        leg.start.copy(leg.position);
        footHome(leg, leg.end);
        leg.end.addScaledVector(velocity, showcase.active ? 0.2 : 0.6);
        leg.end.y = heightAt(leg.end.x, leg.end.z) + rig.sole;
        reachableFoothold(leg, leg.end);
        // Query the entire swept path so steel edges cannot intersect a swinging toe.
        leg.clearance = Math.max(leg.start.y, leg.end.y);
        for (let sample = 0; sample <= 20; sample++) {
          tmp.lerpVectors(leg.start, leg.end, sample / 20);
          leg.clearance = Math.max(
            leg.clearance,
            heightAt(tmp.x, tmp.z) + rig.sole,
          );
        }
        leg.clearance += 0.42;
        leg.progress = 0;
        leg.phase = "lift";
        mechanicalAudio.emit("lift", leg.side);
        state.steps++;
      }
      gaitGroup = (groupIndex + 1) % pairGroups.length;
      break;
    }
  }
  for (const leg of legs) {
    if (
      ["lift", "swing", "lower", "lock"].includes(leg.phase) &&
      !leg.topAnchor
    ) {
      const previousPhase = leg.phase;
      leg.progress = Math.min(1, leg.progress + dt / params.step);
      const p = leg.progress;
      const clearance = leg.clearance;
      if (p < 0.22) {
        leg.phase = "lift";
        leg.position.copy(leg.start);
        leg.position.y = THREE.MathUtils.lerp(
          leg.start.y,
          clearance,
          ease(p / 0.22),
        );
      } else if (p < 0.68) {
        leg.phase = "swing";
        leg.position.lerpVectors(leg.start, leg.end, ease((p - 0.22) / 0.46));
        leg.position.y = clearance;
      } else if (p < 0.9) {
        leg.phase = "lower";
        leg.position.copy(leg.end);
        leg.position.y = THREE.MathUtils.lerp(
          clearance,
          leg.end.y,
          ease((p - 0.68) / 0.22),
        );
      } else {
        leg.phase = p === 1 ? "planted" : "lock";
        leg.position.copy(leg.end);
        if (previousPhase !== "lock") mechanicalAudio.emit("step", leg.side);
      }
    }
    hipWorld
      .set(leg.side * rig.hipX, rig.hipY, leg.hipZ)
      .applyMatrix4(visibleSpider.matrixWorld);
    // Coxa steers horizontally; its rigid length is not part of the two-bone chain.
    coursePoint(leg.position, mappedFoot);
    if (
      leg.topTransfer &&
      ["transfer", "pullUp", "pushOff"].includes(flight.phase)
    ) {
      const transfer = leg.topTransfer;
      const progress = THREE.MathUtils.clamp(
        (flight.prepTime - transfer.delay) / transfer.duration,
        0,
        1,
      );
      transfer.curve.getPoint(smootherstep(progress), mappedFoot);
      leg.phase = progress === 0 || progress === 1 ? "planted" : "topClear";
      if (progress === 1 && !transfer.contactSoundPlayed) {
        mechanicalAudio.emit("step", leg.side);
        transfer.contactSoundPlayed = true;
      }
    }
    if (["pullUp", "pushOff"].includes(flight.phase) && leg.restZ <= 0) {
      const elapsed = flight.prepTime - jumpTiming.transfer - leg.releaseDelay;
      if (elapsed > 0) {
        const released = new THREE.Vector3(
          leg.side * leg.restX * 0.95,
          0.65,
          leg.restZ * 0.9,
        ).applyMatrix4(visibleSpider.matrixWorld);
        const release = smootherstep(
          THREE.MathUtils.clamp(elapsed / 0.3, 0, 1),
        );
        released.lerpVectors(leg.releaseStart, released, release);
        mappedFoot.fromArray(
          released
            .toArray()
            .map((value, axis) => leg.releaseSprings[axis].update(dt, value)),
        );
        leg.phase = "release";
      }
    }
    direction.subVectors(mappedFoot, hipWorld);
    const normal = up.clone().applyQuaternion(visibleSpider.quaternion);
    direction.addScaledVector(normal, -direction.dot(normal));
    direction.normalize();
    coxaEnd.copy(hipWorld).addScaledVector(direction, rig.coxa);
    poleWorld
      .set(leg.side * 3.1, 1.8, leg.restZ * 1.15)
      .applyMatrix4(visibleSpider.matrixWorld);
    const solution = solveTwoBone(
      coxaEnd.toArray(),
      mappedFoot.toArray(),
      poleWorld.toArray(),
      rig.upper,
      rig.lower,
    );
    const knee = new THREE.Vector3(...solution.knee),
      foot = new THREE.Vector3(...solution.foot);
    positionSegment(leg.coxa, hipWorld, coxaEnd);
    positionSegment(leg.upper, coxaEnd, knee);
    positionSegment(leg.lower, knee, foot);
    leg.foot.position.copy(foot);
    leg.worldTarget = mappedFoot.clone();
    if (leg.topTransfer) {
      const plantedRotation = new THREE.Quaternion().setFromAxisAngle(
        up,
        spider.rotation.y + leg.toeYaw,
      );
      leg.foot.quaternion.slerpQuaternions(
        leg.topTransfer.rotation,
        plantedRotation,
        smootherstep(
          THREE.MathUtils.clamp(
            (flight.prepTime - leg.topTransfer.delay) /
              leg.topTransfer.duration,
            0,
            1,
          ),
        ),
      );
    } else if (leg.phase === "release") {
      leg.foot.quaternion
        .copy(visibleSpider.quaternion)
        .multiply(new THREE.Quaternion().setFromAxisAngle(up, leg.toeYaw));
    } else
      leg.foot.rotation.set(
        -courseAngle(leg.position.z),
        spider.rotation.y + leg.toeYaw,
        0,
      );
    leg.solved.copy(foot);
  }
  movingLegs = legs.filter(
    (leg) => leg.phase !== "planted" && leg.phase !== "lock",
  ).length;
}

// A fixed sprite pool emits from the two actual chimney tips without creating meshes per frame.
const smokeCanvas = document.createElement("canvas");
smokeCanvas.width = smokeCanvas.height = 64;
const smokeContext = smokeCanvas.getContext("2d");
const smokeGradient = smokeContext.createRadialGradient(32, 32, 0, 32, 32, 32);
smokeGradient.addColorStop(0, "rgba(195,205,209,.55)");
smokeGradient.addColorStop(0.45, "rgba(146,162,170,.3)");
smokeGradient.addColorStop(1, "rgba(146,162,170,0)");
smokeContext.fillStyle = smokeGradient;
smokeContext.fillRect(0, 0, 64, 64);
const smokeTexture = new THREE.CanvasTexture(smokeCanvas);
smokeTexture.colorSpace = THREE.SRGBColorSpace;
const smokePool = Array.from({ length: 72 }, () => {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: smokeTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    }),
  );
  sprite.visible = false;
  scene.add(sprite);
  return { sprite, age: 0, life: 0, drift: 0 };
});
let smokeClock = 0,
  smokeSide = -1;
function updateSmoke(dt) {
  const landingSteam = ["landing", "landed"].includes(flight.phase);
  const activeVent = time < ventUntil;
  smokeClock += dt;
  const interval = activeVent ? 0.055 : 0.16;
  while (smokeClock >= interval) {
    smokeClock -= interval;
    const puff = smokePool.find((particle) => !particle.sprite.visible);
    if (!puff) break;
    smokeSide *= -1;
    puff.sprite.position
      .set(smokeSide * 0.35, 2.51, -0.65)
      .applyMatrix4(visibleSpider.matrixWorld);
    puff.age = 0;
    puff.life = landingSteam ? 0.65 : activeVent ? 2.8 : 2.2;
    puff.opacity = landingSteam ? 0.1 : 0.48;
    puff.expansion = landingSteam ? 0.25 : 1.05;
    puff.drift = smokeSide * 0.09;
    puff.sprite.visible = true;
    puff.sprite.scale.setScalar(0.22);
    puff.sprite.material.opacity = puff.opacity;
  }
  for (const puff of smokePool) {
    if (!puff.sprite.visible) continue;
    puff.age += dt;
    if (puff.age >= puff.life) {
      puff.sprite.visible = false;
      continue;
    }
    const progress = puff.age / puff.life;
    puff.sprite.position.y += dt * (activeVent ? 0.8 : 0.5);
    puff.sprite.position.x += dt * puff.drift;
    puff.sprite.position.z -= dt * 0.08;
    puff.sprite.scale.setScalar(0.22 + progress * puff.expansion);
    puff.sprite.material.opacity = puff.opacity * (1 - progress) ** 2;
  }
}
function vent() {
  if (state.ready) {
    ventUntil = time + 2;
    state.vents++;
  }
}
function setMood(name) {
  if (!presets[name]) return;
  state.mood = name;
  params = presets[name];
  document
    .querySelectorAll("[data-mood]")
    .forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.mood === name)),
    );
}
function setSide(value) {
  state.side = value === "right" || value === true ? "right" : "left";
  camera.position.set(
    spider.position.x + (state.side === "left" ? -11 : 11),
    4.8,
    spider.position.z + 6,
  );
  controls.target.set(spider.position.x, 1.75, spider.position.z);
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  controls.update();
  document
    .querySelector("#side")
    .setAttribute("aria-pressed", String(state.side === "right"));
}
function reset() {
  motionHistoryReady = false;
  flight.phase = "none";
  flight.elapsed = 0;
  flight.elapsedLanding = 0;
  flight.heroTime = 0;
  flight.prepTime = 0;
  showcase.active = false;
  showcase.elapsed = 0;
  showcase.groundPhase = "approach";
  showcase.pauseElapsed = 0;
  brakingPitch.reset(0);
  wallGroup.visible = false;
  controls.enabled = true;
  params = presets[state.mood];
  state.mode = "follow";
  state.phase = "grounded";
  goal.set(0, 0, 0);
  drive.set(0, 0, 0);
  velocity.set(0, 0, 0);
  spider.position.set(0, 0, 0);
  spider.rotation.set(0, 0, 0);
  bodyX.reset(0);
  bodyZ.reset(0);
  yawSpring.reset(0);
  headSpring.reset(0);
  bodyHeight.reset(0);
  bodyPitch.reset(0);
  bodyRoll.reset(0);
  yawTarget = 0;
  gaitGroup = 0;
  resetFeet();
  strandPhysics?.reset();
  document.querySelector("#wander").setAttribute("aria-pressed", "false");
  setSide(state.side);
}
function startShowcase({ duration = 43.834, beats = [] } = {}) {
  if (!state.ready) return false;
  reset();
  mechanicalAudio.beginTimeline();
  showcase.active = true;
  showcase.elapsed = 0;
  showcase.duration =
    Number.isFinite(duration) && duration > 0 ? duration : 43.834;
  showcase.beats = beats.filter(Number.isFinite).sort((a, b) => a - b);
  state.terrain = true;
  obstacleGroup.visible = true;
  wallGroup.visible = true;
  document.querySelector("#terrain").setAttribute("aria-pressed", "true");
  params = showcaseParams;
  controls.enabled = false;
  spider.position.set(0, 0, -4.2);
  drive.copy(spider.position);
  bodyX.reset(0);
  bodyZ.reset(-4.2);
  goal.set(0, 0, course.wallEnd);
  spider.updateMatrixWorld(true);
  updateVisibleRig();
  resetFeet();
  updateLegs(0);
  updateShowcaseCamera();
  strandPhysics?.reset();
  return true;
}
function beginWallJump() {
  mechanicalAudio.emit("jump");
  flight.phase = "airborne";
  flight.elapsed = 0;
  state.phase = "airborne";
  flight.start.copy(visibleSpider.position);
  flight.root.copy(flight.start);
  flight.launchRotation.copy(visibleSpider.quaternion);
  flight.landRotation.setFromAxisAngle(up, spider.rotation.y);
  flight.velocity.copy(flight.rootVelocity);
  flight.duration =
    (flight.velocity.y +
      Math.sqrt(flight.velocity.y ** 2 + 2 * jumpGravity * flight.start.y)) /
    jumpGravity;
  flight.landing
    .copy(flight.start)
    .addScaledVector(flight.velocity, flight.duration);
  flight.landing.y = 0;
  for (const leg of legs) {
    leg.landing = new THREE.Vector3(leg.side * leg.restX, rig.sole, leg.restZ)
      .applyQuaternion(flight.landRotation)
      .add(flight.landing);
    leg.flightRelease = leg.solved
      .clone()
      .applyMatrix4(visibleSpider.matrixWorld.clone().invert());
    leg.flightSprings = leg.flightRelease
      .toArray()
      .map((value) => new SecondOrderDynamics(3.4, 0.85, 0, value));
    leg.phase = "airborne";
  }
  ventUntil = time + 0.8;
  // Carry the fraction of this frame after takeoff into the ballistic trajectory.
  updateFlight(
    Math.max(
      0,
      flight.prepTime - jumpTiming.transfer - jumpTiming.pull - jumpTiming.push,
    ),
  );
}
function updateFlight(dt) {
  if (flight.phase === "airborne") {
    flight.elapsed = Math.min(flight.duration, flight.elapsed + dt);
    const t = flight.elapsed;
    flight.root.copy(flight.start).addScaledVector(flight.velocity, t);
    flight.root.y -= 0.5 * jumpGravity * t * t;
    const turn = ease(
      THREE.MathUtils.clamp((t - 0.12) / (flight.duration - 0.3), 0, 1),
    );
    visibleSpider.quaternion.slerpQuaternions(
      flight.launchRotation,
      flight.landRotation,
      turn,
    );
    if (t >= flight.duration) {
      mechanicalAudio.emit("land");
      flight.phase = "landing";
      state.phase = "landing";
      flight.root.copy(flight.landing);
      flight.elapsedLanding = 0;
      landingHeight.reset(0);
      landingHeight.velocity = -4.8;
      landingForward.reset(0);
      landingForward.velocity = flight.velocity.z;
      landingPitch.reset(0);
      landingPitch.velocity = 1.5;
      for (const leg of legs) leg.phase = "planted";
      ventUntil = time + 0.18;
    }
  } else if (flight.phase === "landing") {
    flight.elapsedLanding += dt;
    const progress = Math.min(1, flight.elapsedLanding / 1.2);
    flight.root.copy(flight.landing);
    // Anchored soles let the joints absorb a damped hull compression and rebound.
    flight.root.y = Math.max(-0.3, landingHeight.update(dt, 0));
    flight.root.z += landingForward.update(dt, 0);
    landingPitch.update(dt, 0);
    if (progress === 1) {
      flight.phase = "landed";
      state.phase = "landed";
    }
  } else if (flight.phase === "landed") {
    flight.heroTime += dt;
    flight.root.copy(flight.landing);
    flight.root.y = landingHeight.update(dt, 0);
    flight.root.z += landingForward.update(dt, 0);
    landingPitch.update(dt, 0);
  }
  updateVisibleRig();
  for (const leg of legs) {
    let target;
    if (flight.phase === "airborne") {
      const extended = new THREE.Vector3(
        leg.side * leg.restX * 0.95,
        0.45,
        leg.restZ * 0.9 - 0.1,
      );
      const release = smootherstep(Math.min(1, flight.elapsed / 0.4));
      extended.lerpVectors(leg.flightRelease, extended, release);
      const local = extended
        .toArray()
        .map((value, axis) => leg.flightSprings[axis].update(dt, value));
      target = new THREE.Vector3(...local).applyMatrix4(
        visibleSpider.matrixWorld,
      );
      // Until the last contact window the legs travel with the hull, not toward a remote ground point.
      const contactWindow = 0.055;
      const deploy = smootherstep(
        THREE.MathUtils.clamp(
          (flight.elapsed - flight.duration + contactWindow) / contactWindow,
          0,
          1,
        ),
      );
      target.lerp(leg.landing, deploy);
      target.y = Math.max(rig.sole, target.y);
    } else target = leg.landing;
    hipWorld
      .set(leg.side * rig.hipX, rig.hipY, leg.hipZ)
      .applyMatrix4(visibleSpider.matrixWorld);
    const normal = up.clone().applyQuaternion(visibleSpider.quaternion);
    direction.subVectors(target, hipWorld);
    direction.addScaledVector(normal, -direction.dot(normal));
    if (flight.phase === "landing")
      direction.addScaledVector(normal, landingHeight.value * 0.35);
    direction.normalize();
    coxaEnd.copy(hipWorld).addScaledVector(direction, rig.coxa);
    poleWorld
      .set(leg.side * 3.1, 1.8, leg.restZ)
      .applyMatrix4(visibleSpider.matrixWorld);
    const solution = solveTwoBone(
      coxaEnd.toArray(),
      target.toArray(),
      poleWorld.toArray(),
      rig.upper,
      rig.lower,
    );
    const knee = new THREE.Vector3(...solution.knee),
      foot = new THREE.Vector3(...solution.foot);
    positionSegment(leg.coxa, hipWorld, coxaEnd);
    positionSegment(leg.upper, coxaEnd, knee);
    positionSegment(leg.lower, knee, foot);
    leg.foot.position.copy(foot);
    leg.foot.quaternion
      .copy(
        flight.phase === "airborne"
          ? visibleSpider.quaternion
          : flight.landRotation,
      )
      .multiply(new THREE.Quaternion().setFromAxisAngle(up, leg.toeYaw));
    leg.solved.copy(foot);
    leg.flightTarget = target.clone();
  }
  movingLegs = flight.phase === "airborne" ? legs.length : 0;
}
function updateShowcaseCamera() {
  const desiredAnchors = [
    0,
    4.234,
    16.945,
    24.797,
    32.589,
    38.206,
    40.431,
    43.834,
    48.333,
    showcase.duration,
  ];
  const anchors = desiredAnchors.map((target, i) =>
    i === 0 || i === desiredAnchors.length - 1 || showcase.beats.length === 0
      ? target
      : showcase.beats.reduce(
          (best, beat) =>
            Math.abs(beat - target) < Math.abs(best - target) ? beat : best,
          showcase.beats[0],
        ),
  );
  const shots = [
    { angle: 0, height: 2, radius: 8.4 },
    { angle: 0, height: 2.2, radius: 8.4 },
    { angle: -1.5, height: 1, radius: 9 },
    { angle: -1.85, height: 1.5, radius: 9 },
    { angle: -1.9, height: 2.2, radius: 9 },
    { angle: -2.1, height: 5.5, radius: 9 },
    { angle: -2.6, height: 8, radius: 9 },
    { angle: -3.7, height: 9, radius: 9 },
    { angle: -4.15, height: 3, radius: 9 },
    { angle: -4.4, height: 1.6, radius: 9 },
  ];
  let index = 0;
  while (index < anchors.length - 2 && showcase.elapsed > anchors[index + 1])
    index++;
  const progress = ease(
    THREE.MathUtils.clamp(
      (showcase.elapsed - anchors[index]) /
        Math.max(0.01, anchors[index + 1] - anchors[index]),
      0,
      1,
    ),
  );
  const a = shots[index],
    b = shots[index + 1];
  let angle = THREE.MathUtils.lerp(a.angle, b.angle, progress);
  const radius = THREE.MathUtils.lerp(a.radius, b.radius, progress);
  let height = THREE.MathUtils.lerp(a.height, b.height, progress);
  if (["transfer", "pullUp", "pushOff"].includes(flight.phase)) {
    angle = -1.9;
    height = THREE.MathUtils.lerp(
      2.2,
      8.8,
      ease(
        Math.min(1, flight.prepTime / (jumpTiming.transfer + jumpTiming.pull)),
      ),
    );
  } else if (flight.phase === "airborne") {
    angle = THREE.MathUtils.lerp(
      -1.9,
      -4.15,
      ease(flight.elapsed / flight.duration),
    );
    height = 8.8;
  } else if (flight.phase === "landing" || flight.phase === "landed") {
    angle = -4.15 - 0.2 * ease(Math.min(1, flight.heroTime / 4));
    height = THREE.MathUtils.lerp(
      8.8,
      1.6,
      ease(Math.min(1, (flight.elapsedLanding + flight.heroTime) / 4)),
    );
  }
  // +Z sees the amber lens; the camera lifts above the crest before crossing sides.
  const target = new THREE.Vector3(0, 1.45, 0).applyMatrix4(
    visibleSpider.matrixWorld,
  );
  camera.position.set(
    target.x + Math.sin(angle) * radius,
    target.y + height,
    target.z + Math.cos(angle) * radius,
  );
  controls.target.copy(target);
  camera.zoom = 1.2;
  camera.updateProjectionMatrix();
  camera.lookAt(target);
}
const raycaster = new THREE.Raycaster(),
  pointer = new THREE.Vector2(),
  plane = new THREE.Plane(up, 0);
function lead(event) {
  if (
    !state.ready ||
    showcase.active ||
    orbiting ||
    event.buttons === 2 ||
    event.isPrimary === false
  )
    return;
  const bounds = canvas.getBoundingClientRect();
  pointer.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  if (raycaster.ray.intersectPlane(plane, tmp)) {
    goal.set(
      THREE.MathUtils.clamp(tmp.x, -5, 5),
      0,
      THREE.MathUtils.clamp(tmp.z, -5, 5),
    );
    state.mode = "follow";
    document.querySelector("#wander").setAttribute("aria-pressed", "false");
  }
}
canvas.addEventListener("pointermove", lead);
canvas.addEventListener("pointerdown", (event) => {
  if (event.button === 0) {
    canvas.focus({ preventScroll: true });
    lead(event);
  }
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
controls.addEventListener("start", () => {
  orbiting = true;
});
controls.addEventListener("end", () => {
  orbiting = false;
});
canvas.addEventListener("keydown", (event) => {
  const moves = {
    ArrowUp: [0, -0.8],
    ArrowDown: [0, 0.8],
    ArrowLeft: [-0.8, 0],
    ArrowRight: [0.8, 0],
  };
  if (event.code === "Space") {
    event.preventDefault();
    vent();
  }
  if (moves[event.key]) {
    event.preventDefault();
    state.mode = "follow";
    goal.x = THREE.MathUtils.clamp(goal.x + moves[event.key][0], -5, 5);
    goal.z = THREE.MathUtils.clamp(goal.z + moves[event.key][1], -5, 5);
  }
});
document
  .querySelectorAll("[data-mood]")
  .forEach((button) =>
    button.addEventListener("click", () => setMood(button.dataset.mood)),
  );
document.querySelector("#hop").addEventListener("click", vent);
document.querySelector("#reset").addEventListener("click", reset);
document
  .querySelector("#side")
  .addEventListener("click", () =>
    setSide(state.side === "left" ? "right" : "left"),
  );
document.querySelector("#pixel").addEventListener("click", () => {
  state.pixel = !state.pixel;
  document
    .querySelector("#pixel")
    .setAttribute("aria-pressed", String(state.pixel));
});
document.querySelector("#terrain").addEventListener("click", () => {
  state.terrain = !state.terrain;
  document
    .querySelector("#terrain")
    .setAttribute("aria-pressed", String(state.terrain));
  obstacleGroup.visible = state.terrain;
  updateGround();
  resetFeet();
});
document.querySelector("#wander").addEventListener("click", () => {
  state.mode = state.mode === "roam" ? "follow" : "roam";
  document
    .querySelector("#wander")
    .setAttribute("aria-pressed", String(state.mode === "roam"));
});

try {
  const gltf = await new GLTFLoader().loadAsync("./assets/spider.glb");
  const model = gltf.scene;
  industrialEnvironment.applyModelMaterials(model);
  visibleSpider.add(model);
  model.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  body = model.getObjectByName("Body");
  head = model.getObjectByName("Head");
  if (!body || !head) throw new Error("Model is missing Body or Head");
  headRest = head.rotation.clone();
  const restZ = [2.05, 0, -2.05],
    restX = [1.5, 2.05, 1.5],
    hipZ = [0.36, 0, -0.36];
  for (const side of [-1, 1])
    for (let index = 0; index < 3; index++) {
      const name = (side < 0 ? "L" : "R") + index;
      const coxa = model.getObjectByName(`Leg_${name}_Coxa`),
        upper = model.getObjectByName(`Leg_${name}_Upper`);
      const lower = model.getObjectByName(`Leg_${name}_Lower`),
        foot = model.getObjectByName(`Foot_${name}`);
      if (!coxa || !upper || !lower || !foot)
        throw new Error(`Model is missing leg ${name}`);
      scene.add(coxa, upper, lower, foot);
      legs.push({
        name,
        side,
        restZ: restZ[index],
        restX: restX[index],
        toeYaw: index === 0 ? 0 : index === 2 ? Math.PI : (side * Math.PI) / 2,
        hipZ: hipZ[index],
        coxa,
        upper,
        lower,
        foot,
        position: new THREE.Vector3(),
        start: new THREE.Vector3(),
        end: new THREE.Vector3(),
        solved: new THREE.Vector3(),
        phase: "planted",
        progress: 0,
      });
    }
  strandPhysics = createStrandPhysics(
    model,
    visibleSpider,
    scene,
    collideStrand,
  );
  resetFeet();
  strandPhysics.reset();
  state.ready = true;
  document.querySelector("#loading").hidden = true;
} catch (error) {
  document.querySelector("#loading").textContent =
    "Could not load the spider. Refresh to try again.";
  console.error(error);
}

function animate() {
  requestAnimationFrame(animate);
  renderer.info.reset();
  const now = performance.now();
  const actualFrameMs = now - lastFrame;
  const dt = Math.min(actualFrameMs / 1000, 0.05);
  lastFrame = now;
  time += dt;
  if (showcase.active) showcase.elapsed += dt;
  // Frame statistics use the raw wall-clock interval, never the simulation clamp.
  if (actualFrameMs > 0) frameSamples.push(actualFrameMs);
  if (frameSamples.length > 120) frameSamples.shift();
  frameMs =
    frameSamples.reduce((sum, value) => sum + value, 0) /
    Math.max(1, frameSamples.length);
  fps = frameMs > 0 ? 1000 / frameMs : 0;
  if (!showcase.active) controls.update();
  if (state.ready) {
    if (["airborne", "landing", "landed"].includes(flight.phase))
      updateFlight(dt);
    else {
      if (!showcase.active && state.mode === "roam")
        goal.set(Math.sin(time * 0.14) * 2.8, 0, Math.cos(time * 0.1) * 2);
      const delta = new THREE.Vector3().subVectors(goal, drive);
      delta.y = 0;
      const distance = delta.length();
      const desiredVelocity = delta.multiplyScalar(
        distance > 0.03 ? Math.min(params.speed, distance) / distance : 0,
      );
      if (
        showcase.active &&
        (showcase.elapsed < 4.234 || flight.phase !== "none")
      )
        desiredVelocity.set(0, 0, 0);
      if (showcase.active && flight.phase === "none") {
        const stopBeforeWall = course.wallStart - 0.7;
        if (showcase.groundPhase === "approach" && showcase.elapsed >= 4.234) {
          const approachSpeed = Math.min(
            1.5,
            Math.max(0, (stopBeforeWall - drive.z) * 2.8),
          );
          desiredVelocity.set(0, 0, approachSpeed);
          if (drive.z >= stopBeforeWall - 0.025 && velocity.z < 0.06) {
            showcase.groundPhase = "pause";
            showcase.pauseElapsed = 0;
          }
        }
        if (showcase.groundPhase === "pause") {
          desiredVelocity.set(0, 0, 0);
          showcase.pauseElapsed += dt;
          if (showcase.pauseElapsed >= 0.9) showcase.groundPhase = "climb";
        }
      }
      // Hold translation while stretched support feet catch up, instead of sliding them.
      const stretched = legs.some(supportNeedsStep);
      if (stretched) desiredVelocity.set(0, 0, 0);
      const previousForwardVelocity = velocity.z;
      velocity.lerp(desiredVelocity, 1 - Math.exp(-dt * 3));
      const slowingAtWall =
        showcase.active &&
        showcase.groundPhase !== "climb" &&
        drive.z > course.wallStart - 2;
      const deceleration =
        (previousForwardVelocity - velocity.z) / Math.max(dt, 0.0001);
      brakingPitch.update(
        dt,
        slowingAtWall
          ? THREE.MathUtils.clamp(deceleration * 0.065, 0, 0.16)
          : 0,
      );
      drive.addScaledVector(velocity, dt);
      spider.position.x = bodyX.update(dt, drive.x);
      spider.position.z = bodyZ.update(dt, drive.z);
      const sinYaw = Math.sin(spider.rotation.y),
        cosYaw = Math.cos(spider.rotation.y);
      const frontHeight = heightAt(
        spider.position.x + sinYaw,
        spider.position.z + cosYaw,
      );
      const rearHeight = heightAt(
        spider.position.x - sinYaw,
        spider.position.z - cosYaw,
      );
      const leftHeight = heightAt(
        spider.position.x - cosYaw * 0.7,
        spider.position.z + sinYaw * 0.7,
      );
      const rightHeight = heightAt(
        spider.position.x + cosYaw * 0.7,
        spider.position.z - sinYaw * 0.7,
      );
      const hullHeight =
        (heightAt(spider.position.x, spider.position.z) +
          frontHeight +
          rearHeight +
          leftHeight +
          rightHeight) /
        5;
      spider.position.y =
        bodyHeight.update(dt, hullHeight) - Math.abs(brakingPitch.value) * 0.45;
      if (["transfer", "pullUp", "pushOff"].includes(flight.phase)) {
        flight.prepTime += dt;
        const elapsed = flight.prepTime;
        if (flight.phase === "transfer" && elapsed >= jumpTiming.transfer)
          flight.prepBase.copy(visibleSpider.position);
        flight.phase =
          elapsed < jumpTiming.transfer
            ? "transfer"
            : elapsed < jumpTiming.transfer + jumpTiming.pull
              ? "pullUp"
              : "pushOff";
        state.phase = flight.phase;
        if (flight.phase === "transfer") {
          spider.position.z +=
            0.2 * smootherstep(Math.min(1, elapsed / jumpTiming.transfer));
        }
      }
      spider.rotation.x =
        bodyPitch.update(dt, Math.atan2(rearHeight - frontHeight, 2)) +
        brakingPitch.value;
      spider.rotation.z = bodyRoll.update(
        dt,
        Math.atan2(rightHeight - leftHeight, 1.4),
      );
      if (velocity.length() > 0.025 && !stretched) {
        const desiredYaw = Math.atan2(velocity.x, velocity.z);
        let turn = Math.atan2(
          Math.sin(desiredYaw - yawTarget),
          Math.cos(desiredYaw - yawTarget),
        );
        // Reverse gear avoids spinning a wide chassis when the route changes direction.
        if (Math.abs(turn) > Math.PI / 2) turn -= Math.sign(turn) * Math.PI;
        yawTarget += THREE.MathUtils.clamp(turn, -dt * 0.22, dt * 0.22);
      }
      spider.rotation.y = yawSpring.update(dt, yawTarget);
      head.rotation.y =
        headRest.y +
        THREE.MathUtils.clamp(
          headSpring.update(dt, yawTarget) - spider.rotation.y,
          -0.16,
          0.16,
        );
      updateLegs(dt);
      if (
        showcase.active &&
        flight.phase === "none" &&
        spider.position.z > course.wallEnd - 0.055 &&
        legs.every(
          (leg) =>
            leg.phase === "planted" &&
            footHome(leg, tmp).distanceTo(leg.position) < 0.13,
        )
      ) {
        flight.phase = "transfer";
        state.phase = "transfer";
        flight.prepTime = 0;
        flight.prepBase.copy(visibleSpider.position);
        for (const leg of legs) {
          leg.releaseStart = leg.solved.clone();
          leg.releaseDelay =
            (leg.restZ === 0 ? 0.27 : 0.15) + (leg.side > 0 ? 0.06 : 0);
          leg.releaseSprings = leg.solved
            .toArray()
            .map((value) => new SecondOrderDynamics(3.5, 0.8, 0, value));
        }
        for (const leg of legs.filter((leg) => leg.restZ > 0)) {
          leg.topAnchor = new THREE.Vector3(
            leg.side * 1.3,
            course.wallTop + rig.sole,
            course.wallStart + course.radius + 0.175,
          );
          const start = leg.solved.clone();
          leg.topTransfer = {
            start,
            rotation: leg.foot.quaternion.clone(),
            delay: leg.side < 0 ? 0 : 0.1,
            duration: 0.82,
            curve: new THREE.CubicBezierCurve3(
              start,
              start.clone().add(new THREE.Vector3(0, 0.8, -0.65)),
              leg.topAnchor.clone().add(new THREE.Vector3(0, 0.6, -0.08)),
              leg.topAnchor.clone(),
            ),
          };
        }
      }
      if (
        flight.phase === "pushOff" &&
        flight.prepTime >=
          jumpTiming.transfer + jumpTiming.pull + jumpTiming.push
      )
        beginWallJump();
    }
    strandHullInverse.copy(visibleSpider.matrixWorld).invert();
    strandPhysics.update(dt);
    updateSmoke(dt);
    eyeLight.position
      .set(0, 1.65, 0.74)
      .applyMatrix4(visibleSpider.matrixWorld);
    eyeGlow.position.set(0, 1.65, 0.67).applyMatrix4(visibleSpider.matrixWorld);
    sun.target.position.set(
      visibleSpider.position.x,
      visibleSpider.position.y + 1.4,
      visibleSpider.position.z,
    );
    sun.position.set(
      sun.target.position.x - 6,
      sun.target.position.y + 11,
      sun.target.position.z + 5,
    );
    industrialEnvironment.update(
      time,
      dt,
      visibleSpider.position,
      flight.phase === "landing",
      legs.map((leg) => leg.solved),
    );
    // Follow translation without changing the chosen viewing flank.
    if (showcase.active) updateShowcaseCamera();
    else {
      tmp
        .set(spider.position.x, 1.75, spider.position.z)
        .sub(controls.target)
        .multiplyScalar(1 - Math.exp(-dt * 2));
      camera.position.add(tmp);
      controls.target.add(tmp);
      controls.update();
    }
  }
  if (time - lastStatsUpdate > 0.2) {
    drawStats();
    lastStatsUpdate = time;
  }
  renderer.setScissorTest(false);
  renderer.setRenderTarget(currentFrame);
  renderer.render(scene, camera);
  const movingFast = flight.phase === "airborne" || flight.phase === "pushOff";
  blendMaterial.uniforms.previous.value = previousFrame.texture;
  blendMaterial.uniforms.weight.value =
    motionHistoryReady && movingFast
      ? flight.phase === "airborne"
        ? 0.16
        : 0.09
      : 0;
  renderer.setRenderTarget(blendedFrame);
  renderer.render(blendScene, postCamera);
  displayMaterial.uniforms.frame.value = blendedFrame.texture;
  // Render-target output stays linear; tone mapping occurs once on the display.
  if (comparisonCapture || state.pixel) {
    renderer.setRenderTarget(lowResolution);
    renderer.render(displayScene, postCamera);
  }
  renderer.setRenderTarget(null);
  if (comparisonCapture) {
    const halfWidth = innerWidth / 2;
    renderer.setScissorTest(true);
    renderer.setViewport(0, 0, halfWidth, innerHeight);
    renderer.setScissor(0, 0, halfWidth, innerHeight);
    renderer.render(displayScene, postCamera);
    renderer.setViewport(halfWidth, 0, halfWidth, innerHeight);
    renderer.setScissor(halfWidth, 0, halfWidth, innerHeight);
    renderer.render(postScene, postCamera);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, innerWidth, innerHeight);
  } else renderer.render(state.pixel ? postScene : displayScene, postCamera);
  // A 45 Hz history keeps the small shutter smear visible even at high render FPS.
  if (!motionHistoryReady || time - motionHistoryTime >= 1 / 45) {
    [previousFrame, blendedFrame] = [blendedFrame, previousFrame];
    motionHistoryTime = time;
  }
  motionHistoryReady = true;
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(statsScene, statsCamera);
  renderer.autoClear = true;
}
requestAnimationFrame(animate);
window.spiderDebug = {
  get ready() {
    return state.ready;
  },
  get state() {
    return {
      ...state,
      position: visibleSpider.position.toArray(),
      target: (["airborne", "landing", "landed"].includes(flight.phase)
        ? flight.landing
        : coursePoint(goal)
      ).toArray(),
      yaw: spider.rotation.y,
      headYaw: head?.rotation.y,
      feet: legs.map((leg) => ({
        name: leg.name,
        phase: leg.phase,
        position: (["airborne", "landing", "landed"].includes(flight.phase)
          ? leg.flightTarget || leg.solved
          : leg.worldTarget || coursePoint(leg.position)
        ).toArray(),
        surfacePosition:
          flight.phase === "airborne"
            ? null
            : (["landing", "landed"].includes(flight.phase)
                ? leg.landing
                : leg.topAnchor || coursePoint(leg.position)
              ).toArray(),
        contactSurface:
          flight.phase === "airborne" ||
          leg.phase === "release" ||
          ["topLift", "topClear", "topPlace"].includes(leg.phase)
            ? "none"
            : ["landing", "landed"].includes(flight.phase)
              ? "farGround"
              : leg.topAnchor && leg.phase === "planted"
                ? "wallTop"
                : courseAngle(leg.position.z) === Math.PI / 2
                  ? "wall"
                  : courseAngle(leg.position.z) > 0
                    ? "roundedBase"
                    : "floor",
        soleNormal: new THREE.Vector3(0, 1, 0)
          .applyQuaternion(leg.foot.quaternion)
          .toArray(),
        contactNormal:
          flight.phase === "airborne" ||
          leg.phase === "release" ||
          ["topLift", "topClear", "topPlace"].includes(leg.phase)
            ? null
            : leg.topAnchor || ["landing", "landed"].includes(flight.phase)
              ? [0, 1, 0]
              : [
                  0,
                  Math.cos(courseAngle(leg.position.z)),
                  -Math.sin(courseAngle(leg.position.z)),
                ],
        localFoot: leg.solved
          .clone()
          .applyMatrix4(visibleSpider.matrixWorld.clone().invert())
          .toArray(),
        solved: leg.solved.toArray(),
      })),
      frameMs,
      fps,
      movingLegs,
      smokeCount: smokePool.filter((puff) => puff.sprite.visible).length,
      drawCalls: renderer.info.render.calls,
      comparisonCapture,
      showcaseTime: showcase.elapsed,
      groundPhase: showcase.groundPhase,
      pauseElapsed: showcase.pauseElapsed,
      groundVelocity: velocity.toArray(),
      brakingPitch: brakingPitch.value,
      courseProgress: spider.position.z,
      courseAngle: courseAngle(spider.position.z),
      recordingComplete:
        showcase.active && showcase.elapsed >= showcase.duration,
      strands: strandPhysics?.state,
      landingCompression: landingHeight.value,
      anticipationPitch: spider.rotation.x,
      prepTime: flight.prepTime,
      flightPhase: flight.phase,
      airborne: flight.phase === "airborne",
      landed: flight.phase === "landed",
      flightTime: flight.elapsed,
      landingTime: flight.elapsedLanding,
      flightDuration: flight.duration,
      heading: new THREE.Vector3(0, 0, 1)
        .applyQuaternion(visibleSpider.quaternion)
        .toArray(),
      prepRootVelocity: flight.rootVelocity.toArray(),
      flightVelocity: [
        flight.velocity.x,
        flight.velocity.y - 9.8 * flight.elapsed,
        flight.velocity.z,
      ],
      cameraPosition: camera.position.toArray(),
      cameraTarget: controls.target.toArray(),
      worldRotation: visibleSpider.quaternion.toArray(),
    };
  },
  setSide,
  get soundEvents() {
    return mechanicalAudio.events;
  },
  startShowcase,
  get recordingComplete() {
    return showcase.active && showcase.elapsed >= showcase.duration;
  },
  surfaceHeight: heightAt,
  project(x, z) {
    const p = new THREE.Vector3(x, heightAt(x, z), z).project(camera);
    return {
      x: ((p.x + 1) * innerWidth) / 2,
      y: ((1 - p.y) * innerHeight) / 2,
    };
  },
};

