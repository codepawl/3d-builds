// Prints the meshes, primitive attributes and materials of a GLB file.
import { readFileSync } from "node:fs";

const filePath = process.argv[2];
const buffer = readFileSync(filePath);
const jsonLength = buffer.readUInt32LE(12);
const document = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8"));
for (const mesh of document.meshes) {
  for (const primitive of mesh.primitives) {
    const material = document.materials[primitive.material];
    const vertexCount = document.accessors[primitive.attributes.POSITION].count;
    console.log(mesh.name, Object.keys(primitive.attributes).join(","), material?.name, vertexCount);
  }
}
