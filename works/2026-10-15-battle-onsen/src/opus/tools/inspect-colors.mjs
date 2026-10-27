// Prints the first values of COLOR_0 and COLOR_1 for one mesh in a GLB.
import { readFileSync } from "node:fs";

const [filePath, meshName] = process.argv.slice(2);
const buffer = readFileSync(filePath);
const jsonLength = buffer.readUInt32LE(12);
const document = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8"));
const binaryStart = 20 + jsonLength + 8;
const mesh = document.meshes.find((candidate) => candidate.name === meshName);
const primitive = mesh.primitives[0];
for (const attributeName of (process.argv[4] || "COLOR_0,COLOR_1").split(",")) {
  if (!(attributeName in primitive.attributes)) continue;
  const accessor = document.accessors[primitive.attributes[attributeName]];
  const view = document.bufferViews[accessor.bufferView];
  const offset = binaryStart + (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const values = [];
  for (let index = 0; index < 12; index += 1) {
    if (accessor.componentType === 5126) values.push(buffer.readFloatLE(offset + index * 4).toFixed(3));
    else if (accessor.componentType === 5123) values.push((buffer.readUInt16LE(offset + index * 2) / 65535).toFixed(3));
    else values.push(buffer.readUInt8(offset + index) / 255);
  }
  console.log(attributeName, accessor.componentType, accessor.type, accessor.normalized, values.join(" "));
}
