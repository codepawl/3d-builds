import * as THREE from "three";

/** World-space articulated hoses; the original weathered mesh supplies their skin. */
export function createStrandPhysics(model, torso, scene, collide) {
  const strands = [];
  const displacement = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const vertex = new THREE.Vector3();
  const anchor = new THREE.Vector3();
  let initialized = false;
  let accumulatedTime = 0;
  const fixedStep = 1 / 120;
  for (let index = 0; index < 5; index++) {
    const mesh = model.getObjectByName(`Strand_${index}`);
    if (!mesh) throw new Error(`Missing articulated hose Strand_${index}`);
    model.updateMatrixWorld(true);
    const horizontal = [-0.23, -0.13, -0.025, 0.085, 0.2][index];
    const forward = 0.14 + index * 0.025;
    const radius = [0.024, 0.035, 0.027, 0.039, 0.024][index];
    const controls = [
      [horizontal, 1.51, forward],
      [horizontal + 0.045 * Math.sin(index), 1.1, forward + 0.025],
      [horizontal - 0.05 * Math.cos(index), 0.56, forward + 0.06],
      [horizontal * 1.2, 0.14, forward + 0.16],
      [horizontal * 1.5, radius, 0.52],
      [horizontal * 1.7 + 0.04 * index, radius, 0.81 + index * 0.09],
    ].map((point) => new THREE.Vector3(...point));
    const rest = new THREE.CatmullRomCurve3(controls).getSpacedPoints(22);
    const meshes = [];
    mesh.traverse((node) => {
      if (node.isMesh) meshes.push(node);
    });
    const skins = [];
    for (const surface of meshes) {
      const positions = surface.geometry.attributes.position;
      const bindings = [];
      const originalMatrix = surface.matrixWorld.clone();
      for (let offset = 0; offset < positions.count; offset++) {
        vertex
          .fromBufferAttribute(positions, offset)
          .applyMatrix4(originalMatrix);
        let bestDistance = Infinity;
        let binding;
        for (let segment = 0; segment < rest.length - 1; segment++) {
          displacement.subVectors(rest[segment + 1], rest[segment]);
          const progress = THREE.MathUtils.clamp(
            anchor.subVectors(vertex, rest[segment]).dot(displacement) /
              displacement.lengthSq(),
            0,
            1,
          );
          anchor.copy(rest[segment]).addScaledVector(displacement, progress);
          const distance = anchor.distanceToSquared(vertex);
          if (distance < bestDistance) {
            bestDistance = distance;
            binding = { segment, progress, offset: vertex.clone().sub(anchor) };
          }
        }
        bindings.push(binding);
      }
      scene.add(surface);
      surface.position.set(0, 0, 0);
      surface.quaternion.identity();
      surface.scale.set(1, 1, 1);
      surface.frustumCulled = false;
      skins.push({ mesh: surface, bindings });
    }
    const points = rest.map((point) => point.clone());
    strands.push({
      skins,
      rest,
      points,
      previous: points.map((point) => point.clone()),
      attachment: new THREE.Vector3(),
      guide: points.map((point) => point.clone()),
      radius,
      lengths: rest
        .slice(1)
        .map((point, offset) => point.distanceTo(rest[offset])),
      bends: rest
        .slice(2)
        .map(
          (point, offset) =>
            rest[offset].distanceTo(rest[offset + 1]) +
            rest[offset + 1].distanceTo(point),
        ),
    });
  }

  function reset() {
    torso.updateMatrixWorld(true);
    accumulatedTime = 0;
    for (const strand of strands) {
      strand.attachment.copy(strand.rest[0]).applyMatrix4(torso.matrixWorld);
      let hangingLength = 0;
      for (let index = 0; index < strand.points.length; index++) {
        if (index > 0) hangingLength += strand.lengths[index - 1];
        strand.points[index].copy(strand.attachment);
        strand.points[index].y -= hangingLength;
        if (index > 0) {
          collide(strand.points[index], strand.radius, index);
          const preceding = strand.points[index - 1];
          const verticalDrop = preceding.y - strand.points[index].y;
          const segmentLength = strand.lengths[index - 1];
          if (Math.abs(verticalDrop) < segmentLength) {
            strand.points[index].z =
              preceding.z + Math.sqrt(segmentLength ** 2 - verticalDrop ** 2);
            collide(strand.points[index], strand.radius, index);
          }
        }
        strand.previous[index].copy(strand.points[index]);
      }
    }
    initialized = true;
    updateSkin();
  }

  function constrain(strand, first, second, length, stiffness) {
    displacement.subVectors(strand.points[second], strand.points[first]);
    const distance = displacement.length();
    if (distance < 1e-8) return;
    const correction = (stiffness * (distance - length)) / distance;
    if (first === 0)
      strand.points[second].addScaledVector(displacement, -correction);
    else {
      strand.points[first].addScaledVector(displacement, correction * 0.5);
      strand.points[second].addScaledVector(displacement, -correction * 0.5);
    }
  }

  function updateSkin() {
    for (const strand of strands) {
      for (const skin of strand.skins) {
        const positions = skin.mesh.geometry.attributes.position;
        for (let index = 0; index < skin.bindings.length; index++) {
          const binding = skin.bindings[index];
          const segment = binding.segment;
          tangent
            .subVectors(strand.points[segment + 1], strand.points[segment])
            .normalize();
          displacement
            .subVectors(strand.rest[segment + 1], strand.rest[segment])
            .normalize();
          rotation.setFromUnitVectors(displacement, tangent);
          vertex.copy(binding.offset).applyQuaternion(rotation);
          anchor.lerpVectors(
            strand.points[segment],
            strand.points[segment + 1],
            binding.progress,
          );
          vertex.add(anchor);
          positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
        }
        positions.needsUpdate = true;
        skin.mesh.geometry.computeVertexNormals();
      }
    }
  }

  function update(dt) {
    if (!initialized) reset();
    accumulatedTime += Math.min(dt, 0.05);
    const steps = Math.floor(accumulatedTime / fixedStep);
    accumulatedTime -= steps * fixedStep;
    const step = fixedStep;
    for (const strand of strands) {
      strand.attachment.copy(strand.rest[0]).applyMatrix4(torso.matrixWorld);
    }
    for (let substep = 0; substep < steps; substep++) {
      for (const strand of strands) {
        anchor.lerpVectors(
          strand.points[0],
          strand.attachment,
          1 / (steps - substep),
        );
        const attachmentShift = anchor.clone().sub(strand.points[0]);
        strand.points[0].copy(anchor);
        strand.previous[0].copy(anchor);
        strand.guide[0].copy(anchor);
        for (let index = 1; index < strand.points.length; index++) {
          const point = strand.points[index];
          // Heavy hydraulic lines travel with the mount; the remaining motion supplies subtle lag.
          point.addScaledVector(attachmentShift, 0.92);
          strand.previous[index].addScaledVector(attachmentShift, 0.92);
          displacement
            .subVectors(point, strand.previous[index])
            .multiplyScalar(Math.exp(-22 * step));
          displacement.clampLength(0, 1.2 * step);
          strand.previous[index].copy(point);
          point.add(displacement);
          point.y -= 25 * step * step;
          const precedingGuide = strand.guide[index - 1];
          const guide = strand.guide[index].copy(precedingGuide);
          const length = strand.lengths[index - 1];
          guide.y -= length;
          collide(guide, strand.radius, index);
          const verticalDrop = precedingGuide.y - guide.y;
          if (verticalDrop >= 0 && verticalDrop < length) {
            guide.z =
              precedingGuide.z +
              Math.sqrt(length * length - verticalDrop * verticalDrop);
            collide(guide, strand.radius, index);
          }
          // Gravity-rest shape prevents bend constraints from feeding mount acceleration into flailing.
          point.lerp(guide, 1 - Math.exp(-12 * step));
        }
        for (let iteration = 0; iteration < 24; iteration++) {
          for (let index = 0; index < strand.lengths.length; index++) {
            constrain(strand, index, index + 1, strand.lengths[index], 1);
          }
          for (let index = strand.lengths.length - 1; index >= 0; index--) {
            constrain(strand, index, index + 1, strand.lengths[index], 1);
          }
          for (let index = 0; index < strand.bends.length; index++) {
            constrain(strand, index, index + 2, strand.bends[index], 0.4);
          }
          for (let index = 1; index < strand.points.length; index++) {
            collide(strand.points[index], strand.radius, index);
          }
        }
        for (let index = 0; index < strand.lengths.length; index++) {
          displacement.subVectors(
            strand.points[index + 1],
            strand.points[index],
          );
          if (displacement.lengthSq() > 1e-12) {
            displacement.setLength(strand.lengths[index]);
            strand.points[index + 1]
              .copy(strand.points[index])
              .add(displacement);
          }
          collide(strand.points[index + 1], strand.radius, index + 1);
        }
      }
    }
    updateSkin();
  }
  return {
    update,
    reset,
    get state() {
      return strands.map((strand) => ({
        radius: strand.radius,
        points: strand.points.map((point) => point.toArray()),
        maxStretch: Math.max(
          ...strand.lengths.map(
            (length, index) =>
              strand.points[index].distanceTo(strand.points[index + 1]) /
              length,
          ),
        ),
      }));
    },
  };
}
