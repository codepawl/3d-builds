import { Renderer67 } from "/vendor/67/renderer.js";

/** Share the authored geometry and interaction math; all GPU drawing uses 67.js. */
export class SealRenderer67 {
  constructor(canvas, group) {
    this.group = group;
    this.parts = group.children
      .filter((mesh) => mesh.isMesh)
      .map((mesh) => ({
        name: mesh.name || "Seal detail",
        geometry: {
          positions: mesh.geometry.attributes.position.array,
          normals: mesh.geometry.attributes.normal.array,
          indices: new Uint32Array(mesh.geometry.index.array),
          colors: mesh.geometry.attributes.color?.array,
        },
        matrix: new Float32Array(mesh.matrixWorld.elements),
        material: {
          color: mesh.material.color.toArray(),
          metallic: mesh.material.metalness || 0,
          roughness: mesh.material.roughness ?? 0.8,
          emission: 0,
          tag: mesh.material.isMeshBasicMaterial ? "unlit" : "seal",
        },
        mesh,
      }));
    this.engine = new Renderer67(canvas, this.parts, {
      transparent: true,
      ground: false,
      samples: 4,
      pixelRatio: Math.min(devicePixelRatio, 2),
      memoryBudgetMiB: 128,
      environment: { lightDirection: [-3, 5, 5], daylight: 1.15 },
    });
    // 67.js 0.3.3 updates transforms publicly but has no deforming-geometry API.
    // Retain its existing vertex buffers rather than recreate the renderer each frame.
    const context = this.engine.context;
    this.vertexBuffers = this.parts.map((part) => {
      const { batch } = this.engine.partLocations.get(part);
      context.bindVertexArray(batch.vertexArray);
      return {
        positions: context.getVertexAttrib(
          0,
          context.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING,
        ),
        normals: context.getVertexAttrib(
          1,
          context.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING,
        ),
      };
    });
    context.bindVertexArray(null);
  }

  setSize() {
    this.engine.resize();
  }

  render(scene, camera) {
    this.group.updateMatrixWorld(true);
    const context = this.engine.context;
    this.parts.forEach((part, index) => {
      part.matrix.set(part.mesh.matrixWorld.elements);
      if (!part.mesh.visible) {
        // A nonsingular microscopic matrix hides an unequipped trumpet.
        for (const diagonal of [0, 5, 10]) part.matrix[diagonal] *= 0.000001;
      }
      for (const field of ["positions", "normals"]) {
        context.bindBuffer(
          context.ARRAY_BUFFER,
          this.vertexBuffers[index][field],
        );
        context.bufferSubData(context.ARRAY_BUFFER, 0, part.geometry[field]);
      }
    });
    this.engine.updateParts(this.parts);
    this.engine.render({
      eye: camera.position.toArray(),
      target: [0, 0.15, 0],
      fov: camera.fov,
      near: camera.near,
      far: camera.far,
      exposure: 1.2,
      time: performance.now() / 1000,
    });
  }
}
