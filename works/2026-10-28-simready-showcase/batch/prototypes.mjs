// Leftover USD instance prototypes and the stats every glb records, shared by optimize.mjs and remove_prototypes.mjs.
//
// SimReady USDs place their parts as instanceable prims under /RootNode/Geometry that reference prototypes in
// payloads/instances.usda. Blender's USD import also brings the prototypes in, as scene-root objects at the origin.
// When a part is moved or turned (the eyeglasses' arms, a door, a robot arm) the prototype shows as a second copy
// at the origin; when it is not, the two copies overlap exactly.

function matrixKey(matrix) {
  return Array.from(matrix, (value) => value.toFixed(5)).join(',');
}

/**
 * Removes scene-root nodes that hold a mesh, have no children, and whose mesh another, nested node also uses.
 * The nested node is the placed instance and stays. Returns the names of the removed nodes.
 */
export function removePrototypeRoots(document) {
  const scene = document.getRoot().listScenes()[0];
  const rootNodes = new Set(scene.listChildren());
  const nestedPlacements = new Map(); // mesh -> world matrix keys of nested nodes using it
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh || rootNodes.has(node)) return;
    if (!nestedPlacements.has(mesh)) nestedPlacements.set(mesh, new Set());
    nestedPlacements.get(mesh).add(matrixKey(node.getWorldMatrix()));
  });

  const removed = [];
  for (const node of rootNodes) {
    const mesh = node.getMesh();
    if (!mesh || node.listChildren().length > 0 || !nestedPlacements.has(mesh)) continue;
    removed.push(node.getName());
    node.dispose();
  }
  return removed;
}

export function measure(document, bytes) {
  const root = document.getRoot();
  let triangles = 0;
  let drawCalls = 0;
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      const vertexCount = indices ? indices.getCount() : primitive.getAttribute('POSITION').getCount();
      triangles += vertexCount / 3;
      drawCalls += 1;
    }
  }
  let largestTextureEdge = 0;
  for (const texture of root.listTextures()) {
    const size = texture.getSize();
    if (size) largestTextureEdge = Math.max(largestTextureEdge, size[0], size[1]);
  }
  return {
    bytes,
    triangles: Math.round(triangles),
    drawCalls,
    textures: root.listTextures().length,
    largestTextureEdge,
  };
}
