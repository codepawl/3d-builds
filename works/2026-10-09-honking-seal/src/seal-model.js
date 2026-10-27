/** A pillow-shaped seal. Every attachment shares the body's deformation field. */
export function createSeal(THREE) {
  const group = new THREE.Group();
  group.name = "Pillow seal";
  const deformingMeshes = [];
  const bodyMeshes = [];
  const hornMeshes = [];
  const eyes = [];
  const frontFlippers = [];
  const state = {
    offset: new THREE.Vector3(),
    grip: new THREE.Vector3(0, 0.2, 1),
    stretch: 0,
    squash: 0,
    playing: 0,
    time: 0,
  };
  const skinMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 });
  const flipperMaterial = new THREE.MeshStandardMaterial({ color: 0x555e68, roughness: 0.91 });
  const tailMaterial = new THREE.MeshStandardMaterial({ color: 0x252d38, roughness: 0.97 });
  const muzzleMaterial = new THREE.MeshStandardMaterial({ color: 0x737c85, roughness: 0.95 });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x070c13, roughness: 0.72 });
  const glintMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const goldMaterial = new THREE.MeshStandardMaterial({ color: 0xe5a63a, metalness: 0.63, roughness: 0.3 });
  const goldRimMaterial = new THREE.MeshStandardMaterial({ color: 0xffd275, metalness: 0.6, roughness: 0.26 });
  const bellInsideMaterial = new THREE.MeshStandardMaterial({ color: 0x684319, metalness: 0.25, roughness: 0.7, side: THREE.DoubleSide });

  function addMesh(name, geometry, material, position, scale, rotation, collection) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    if (position) mesh.position.set(...position);
    if (scale) mesh.scale.set(...scale);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.updateMatrix();
    geometry.applyMatrix4(mesh.matrix);
    mesh.position.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    mesh.rotation.set(0, 0, 0);
    geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    deformingMeshes.push({ mesh, canonical: geometry.attributes.position.array.slice() });
    group.add(mesh);
    if (collection) collection.push(mesh);
    return mesh;
  }

  function ellipsoid(name, position, scale, material, rotation, collection) {
    return addMesh(name, new THREE.SphereGeometry(1, 32, 22), material, position, scale, rotation, collection);
  }

  function smoothstep(lower, upper, value) {
    const progress = THREE.MathUtils.clamp((value - lower) / (upper - lower), 0, 1);
    return progress * progress * (3 - 2 * progress);
  }

  function pillowPoint(horizontal, vertical, depth) {
    // A broad face and flatter underside give the single volume the weight of a plush.
    return [
      horizontal * 1.472 * (0.94 + depth * 0.09),
      0.055 + vertical * (vertical < 0 ? 0.9545 : 1.1615),
      depth * 1.727,
    ];
  }

  const bodyGeometry = new THREE.SphereGeometry(1, 192, 128);
  const positions = bodyGeometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const horizontal = positions.getX(index);
    const vertical = positions.getY(index);
    const depth = positions.getZ(index);
    // Gentle superellipsoid shaping, with smooth poles rather than a spherical balloon.
    const exponent = 0.92;
    const shaped = [horizontal, vertical, depth].map(value => Math.sign(value) * Math.abs(value) ** exponent);
    positions.setXYZ(index, ...pillowPoint(...shaped));
  }
  bodyGeometry.computeVertexNormals();

  const pale = new THREE.Color(0xe2e7e9);
  const cap = new THREE.Color(0x252d38);
  const spotColor = new THREE.Color(0x697887);
  const color = new THREE.Color();
  const colors = new Float32Array(positions.count * 3);
  const spots = [];
  let seed = 29431;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  for (let index = 0; index < 94; index += 1) {
    const vertical = random() * 1.26 - 0.48;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(1 - vertical * vertical);
    const spherePoint = [Math.cos(angle) * radius, vertical, Math.sin(angle) * radius];
    const point = pillowPoint(...spherePoint.map(value => Math.sign(value) * Math.abs(value) ** 0.92));
    // Leave a clean, readable little face and a quiet underside.
    if (point[2] > 1.342 && Math.abs(point[0]) < 0.55) continue;
    spots.push({ point, radius: 0.035 + random() * 0.042, aspect: 0.66 + random() * 0.65, opacity: 0.37 + random() * 0.28 });
  }
  for (let index = 0; index < positions.count; index += 1) {
    const horizontal = positions.getX(index);
    const vertical = positions.getY(index);
    const depth = positions.getZ(index);
    const forehead = 0.2645 * Math.exp(-horizontal * horizontal * 10) * smoothstep(0.88, 1.672, depth);
    const capAmount = smoothstep(0.1955 - forehead, 1.035 - forehead, vertical);
    let marking = 0;
    for (const spot of spots) {
      const distance = Math.hypot(horizontal - spot.point[0], (vertical - spot.point[1]) / spot.aspect, depth - spot.point[2]);
      marking = Math.max(marking, (1 - smoothstep(spot.radius * 0.55, spot.radius * 1.18, distance)) * spot.opacity);
    }
    color.copy(pale).lerp(spotColor, marking).lerp(cap, capAmount);
    color.toArray(colors, index * 3);
  }
  bodyGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  addMesh("One soft pillow body", bodyGeometry, skinMaterial);
  // Picking follows the same deforming surface without tracing the render mesh.
  const pickGeometry = new THREE.SphereGeometry(1, 32, 24);
  const pickPositions = pickGeometry.attributes.position;
  for (let index = 0; index < pickPositions.count; index++) {
    const shaped = [pickPositions.getX(index), pickPositions.getY(index), pickPositions.getZ(index)]
      .map(value => Math.sign(value) * Math.abs(value) ** 0.92);
    pickPositions.setXYZ(index, ...pillowPoint(...shaped));
  }
  const pickSurface = addMesh("Interaction surface", pickGeometry, skinMaterial, null, null, null, bodyMeshes);
  pickSurface.visible = false;

  // Short, surface-colored ribbons make a fine nap without a separate texture or shader.
  const bodyIndices = bodyGeometry.index.array;
  const bodyNormals = bodyGeometry.attributes.normal;
  const triangleAreas = [];
  const triangleOffsets = [];
  const firstPoint = new THREE.Vector3();
  const secondPoint = new THREE.Vector3();
  const thirdPoint = new THREE.Vector3();
  const firstEdge = new THREE.Vector3();
  const secondEdge = new THREE.Vector3();
  let totalArea = 0;
  for (let index = 0; index < bodyIndices.length; index += 3) {
    firstPoint.fromBufferAttribute(positions, bodyIndices[index]);
    secondPoint.fromBufferAttribute(positions, bodyIndices[index + 1]);
    thirdPoint.fromBufferAttribute(positions, bodyIndices[index + 2]);
    firstEdge.subVectors(secondPoint, firstPoint);
    secondEdge.subVectors(thirdPoint, firstPoint);
    const area = firstEdge.cross(secondEdge).length() * 0.5;
    if (area < 0.000001) continue;
    totalArea += area;
    triangleAreas.push(totalArea);
    triangleOffsets.push(index);
  }
  const fiberPositions = [];
  const fiberNormals = [];
  const fiberColors = [];
  const fiberIndices = [];
  const surfacePoint = new THREE.Vector3();
  const surfaceNormal = new THREE.Vector3();
  const sampledNormal = new THREE.Vector3();
  const ribbonWidth = new THREE.Vector3();
  const combDirection = new THREE.Vector3();
  const fiberPoint = new THREE.Vector3();
  const fiberColor = new THREE.Color();
  for (let strand = 0; strand < 5000; strand += 1) {
    const targetArea = random() * totalArea;
    let lower = 0;
    let upper = triangleAreas.length - 1;
    while (lower < upper) {
      const middle = (lower + upper) >> 1;
      if (triangleAreas[middle] < targetArea) lower = middle + 1;
      else upper = middle;
    }
    const triangle = triangleOffsets[lower];
    const root = Math.sqrt(random());
    const split = random();
    const weights = [1 - root, root * (1 - split), root * split];
    surfacePoint.set(0, 0, 0);
    surfaceNormal.set(0, 0, 0);
    fiberColor.setRGB(0, 0, 0);
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = bodyIndices[triangle + corner];
      firstPoint.fromBufferAttribute(positions, vertex);
      sampledNormal.fromBufferAttribute(bodyNormals, vertex);
      surfacePoint.addScaledVector(firstPoint, weights[corner]);
      surfaceNormal.addScaledVector(sampledNormal, weights[corner]);
      fiberColor.r += colors[vertex * 3] * weights[corner];
      fiberColor.g += colors[vertex * 3 + 1] * weights[corner];
      fiberColor.b += colors[vertex * 3 + 2] * weights[corner];
    }
    surfaceNormal.normalize();
    ribbonWidth.set(random() - 0.5, random() - 0.5, random() - 0.5).cross(surfaceNormal).normalize();
    combDirection.set(0, -0.25, -1).addScaledVector(surfaceNormal, surfaceNormal.z + surfaceNormal.y * 0.25).normalize();
    const length = 0.009 + random() * 0.009;
    const width = 0.001 + random() * 0.0006;
    fiberColor.multiplyScalar(0.9 + random() * 0.18);
    const firstVertex = fiberPositions.length / 3;
    for (let corner = 0; corner < 4; corner += 1) {
      const tip = corner >= 2;
      const side = corner === 0 || corner === 3 ? -1 : 1;
      fiberPoint.copy(surfacePoint)
        .addScaledVector(surfaceNormal, tip ? length : 0.0005)
        .addScaledVector(combDirection, tip ? length * 0.4 : 0)
        .addScaledVector(ribbonWidth, width * side * (tip ? 0.18 : 1));
      fiberPositions.push(...fiberPoint.toArray());
      fiberNormals.push(...surfaceNormal.toArray());
      fiberColors.push(fiberColor.r, fiberColor.g, fiberColor.b);
    }
    for (const corner of [0, 1, 2, 0, 2, 3, 2, 1, 0, 3, 2, 0]) fiberIndices.push(firstVertex + corner);
  }
  const furGeometry = new THREE.BufferGeometry();
  furGeometry.setAttribute("position", new THREE.Float32BufferAttribute(fiberPositions, 3));
  furGeometry.setAttribute("normal", new THREE.Float32BufferAttribute(fiberNormals, 3));
  furGeometry.setAttribute("color", new THREE.Float32BufferAttribute(fiberColors, 3));
  furGeometry.setIndex(fiberIndices);
  const fur = addMesh("Fine plush nap", furGeometry, skinMaterial);
  fur.userData.plushFibers = true;

  ellipsoid("Tucked tail base", [-0.2, -0.3335, -1.637], [0.27, 0.095, 0.42], tailMaterial, [0, 0.28, 0], bodyMeshes);
  for (const side of [-1, 1]) {
    const flipper = ellipsoid("Little paddle flipper", [side * 1.334, -0.644, 0.18], [0.39, 0.065, 0.205], flipperMaterial, [0.08, side * -0.38, side * -0.16], bodyMeshes);
    frontFlippers.push({ mesh: flipper, side, pivot: new THREE.Vector3(side * 1.15, -0.60, 0.18) });
    const tailGeometry = new THREE.SphereGeometry(1, 32, 22);
    const tailPositions = tailGeometry.attributes.position;
    for (let index = 0; index < tailPositions.count; index += 1) {
      const depth = tailPositions.getZ(index);
      tailPositions.setX(index, tailPositions.getX(index) * (1 - depth * 0.3));
    }
    tailGeometry.computeVertexNormals();
    addMesh("Flat rear flipper", tailGeometry, tailMaterial, [-0.28 + side * 0.26, -0.345, -2.147], [0.28, 0.065, 0.49], [0.04, 0.18 - side * 0.52, 0], bodyMeshes);
  }

  for (const side of [-1, 1]) {
    eyes.push(ellipsoid("Bright bead eye", [side * 0.245, 0.30, 1.705], [0.049, 0.055, 0.033], eyeMaterial, [0, side * 0.12, side * -0.07]));
    eyes.push(ellipsoid("Eye catchlight", [side * 0.245 - 0.011, 0.317, 1.735], [0.005, 0.006, 0.003], glintMaterial));
    ellipsoid("Soft muzzle cheek", [side * 0.097, 0.131, 1.732], [0.113, 0.106, 0.077], muzzleMaterial);
  }
  ellipsoid("Tiny nose", [0, 0.185, 1.735], [0.046, 0.03, 0.04], eyeMaterial);

  function tube(name, points, radius, material, collection) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    return addMesh(name, new THREE.TubeGeometry(curve, 32, radius, 10, false), material, null, null, null, collection);
  }

  // Model the trumpet in a compact horizontal local frame, then turn it out from the mouth.
  const hornOrigin = new THREE.Vector3(0, 0.074, 1.856);
  const hornDirection = new THREE.Vector3(0.86, 0.025, 0.51).normalize();
  const hornSide = new THREE.Vector3(-hornDirection.z, 0, hornDirection.x).normalize();
  function hornPoint(along, vertical, side = 0) {
    return hornOrigin.clone().addScaledVector(hornDirection, along).addScaledVector(hornSide, side).add(new THREE.Vector3(0, vertical, 0));
  }
  function hornTube(name, points, radius = 0.022, material = goldMaterial) {
    return tube(name, points.map(point => hornPoint(...point).toArray()), radius, material, hornMeshes);
  }
  hornTube("Trumpet lead pipe", [[0, 0, 0], [0.14, 0, 0], [0.29, -0.01, 0], [0.51, 0.005, 0], [0.61, 0.01, 0]], 0.025);
  hornTube("Trumpet return loop", [[0.5, -0.025, 0.015], [0.5, -0.16, 0.015], [0.41, -0.21, 0.015], [0.21, -0.21, 0.015], [0.16, -0.15, 0.015], [0.18, -0.055, 0.015], [0.24, -0.04, 0.015]], 0.022);
  for (let index = 0; index < 3; index += 1) {
    const along = 0.26 + index * 0.075;
    addMesh("Valve casing", new THREE.CylinderGeometry(0.026, 0.026, 0.19, 16), goldMaterial, hornPoint(along, -0.09, 0).toArray(), null, null, hornMeshes);
    addMesh("Valve stem", new THREE.CylinderGeometry(0.009, 0.009, 0.051, 12), goldMaterial, hornPoint(along, 0.041, 0).toArray(), null, null, hornMeshes);
    addMesh("Pearl valve button", new THREE.CylinderGeometry(0.035, 0.035, 0.014, 20), goldRimMaterial, hornPoint(along, 0.074, 0).toArray(), null, null, hornMeshes);
  }
  const bellRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), hornDirection);
  function bellMesh(name, geometry, material, along) {
    geometry.applyQuaternion(bellRotation);
    geometry.translate(...hornPoint(along, 0.01, 0).toArray());
    return addMesh(name, geometry, material, null, null, null, hornMeshes);
  }
  const bellProfile = [[0.025, 0], [0.03, 0.075], [0.044, 0.14], [0.073, 0.2], [0.125, 0.26], [0.181, 0.298], [0.186, 0.311], [0.173, 0.316], [0.116, 0.278], [0.065, 0.218], [0.035, 0.14], [0.019, 0.06]];
  bellMesh("Flared trumpet bell", new THREE.LatheGeometry(bellProfile.map(point => new THREE.Vector2(...point)), 48), goldMaterial, 0.59);
  const rim = new THREE.TorusGeometry(0.181, 0.008, 10, 48);
  rim.rotateX(Math.PI / 2);
  bellMesh("Bright bell rim", rim, goldRimMaterial, 0.901);
  bellMesh("Dark bell throat", new THREE.CircleGeometry(0.027, 24).rotateX(-Math.PI / 2), bellInsideMaterial, 0.664);
  const mouthpiece = new THREE.TorusGeometry(0.036, 0.009, 10, 24);
  mouthpiece.rotateX(Math.PI / 2);
  bellMesh("Mouthpiece rim", mouthpiece, goldRimMaterial, 0.01);

  for (const mesh of hornMeshes) {
    const hornPositions = mesh.geometry.attributes.position;
    for (let index = 0; index < hornPositions.count; index += 1) {
      hornPositions.setXYZ(index,
        hornOrigin.x + (hornPositions.getX(index) - hornOrigin.x) * 0.73,
        hornOrigin.y + (hornPositions.getY(index) - hornOrigin.y) * 0.73,
        hornOrigin.z + (hornPositions.getZ(index) - hornOrigin.z) * 0.73,
      );
    }
    const entry = deformingMeshes.find(entry => entry.mesh === mesh);
    entry.canonical = hornPositions.array.slice();
  }

  const pull = new THREE.Vector3();
  function applyDeformation() {
    pull.copy(state.offset).clampLength(0, 1.7);
    const verticalScale = 1 + THREE.MathUtils.clamp(state.stretch, 0, 1) * 0.58 - THREE.MathUtils.clamp(state.squash, 0, 1) * 0.4;
    const radialScale = 1 / Math.sqrt(verticalScale);
    const puff = state.playing * 0.022;
    for (const entry of deformingMeshes) {
      const positions = entry.mesh.geometry.attributes.position;
      const canonical = entry.canonical;
      for (let index = 0; index < positions.count; index += 1) {
        const arrayIndex = index * 3;
        const horizontal = canonical[arrayIndex];
        const vertical = canonical[arrayIndex + 1];
        const depth = canonical[arrayIndex + 2];
        const distanceSquared = (horizontal - state.grip.x) ** 2 + (vertical - state.grip.y) ** 2 + (depth - state.grip.z) ** 2;
        const influence = Math.exp(-distanceSquared / 3.4) * 0.8;
        const puffWeight = Math.exp(-horizontal * horizontal * 4 - (depth - 1.557) ** 2 * 4);
        positions.setXYZ(index,
          horizontal * (radialScale + puff * puffWeight) + pull.x * influence,
          (vertical - 0.055) * verticalScale + 0.055 + pull.y * influence,
          depth * radialScale + puff * puffWeight + pull.z * influence,
        );
      }
      positions.needsUpdate = true;
      if (!entry.mesh.userData.plushFibers) entry.mesh.geometry.computeVertexNormals();
      entry.mesh.geometry.computeBoundingBox();
      entry.mesh.geometry.computeBoundingSphere();
    }
  }

  function finite(value) {
    return Number.isFinite(value) ? value : 0;
  }
  function deform({ offset, grip, stretch = 0, squash = 0, time = state.time } = {}) {
    if (offset) state.offset.set(finite(offset.x), finite(offset.y), finite(offset.z));
    if (grip) state.grip.set(finite(grip.x), finite(grip.y), finite(grip.z));
    state.stretch = finite(stretch);
    state.squash = finite(squash);
    state.time = finite(time);
    applyDeformation();
  }
  function setHornVisible(visible) {
    for (const mesh of hornMeshes) mesh.visible = Boolean(visible);
  }
  function setPlaying(amount) {
    state.playing = THREE.MathUtils.clamp(finite(Number(amount)), 0, 1);
  }
  function applyIdle(time, interactionAmount = 0) {
    const seconds = finite(time);
    const resting = 1 - THREE.MathUtils.clamp(finite(interactionAmount), 0, 1);
    const blinkPhase = ((seconds + 1.6) % 5.2 + 5.2) % 5.2;
    const blink = Math.exp(-(((blinkPhase - 0.14) / 0.065) ** 2)) * resting;
    for (const eye of eyes) {
      const center = eye.geometry.boundingSphere?.center.y ?? 0.3;
      eye.scale.y = 1 - blink * 0.92;
      eye.position.y = center * (1 - eye.scale.y);
    }
    for (const flipper of frontFlippers) {
      const angle = Math.sin(seconds * 1.7) * 0.018 * resting * flipper.side;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      flipper.mesh.rotation.z = angle;
      flipper.mesh.position.set(
        flipper.pivot.x - (cosine * flipper.pivot.x - sine * flipper.pivot.y),
        flipper.pivot.y - (sine * flipper.pivot.x + cosine * flipper.pivot.y),
        0,
      );
    }
  }
  function update(time, delta = 0) {
    state.time = Number.isFinite(time) ? time : state.time + finite(delta);
    applyDeformation();
    applyIdle(state.time, Math.min(1, state.offset.length()));
  }
  return { group, bodyMeshes, deform, setHornVisible, setPlaying, applyIdle, update };
}





