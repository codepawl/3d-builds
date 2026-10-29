// A small reader for the USDA text layers of SimReady assets: prims by path, with their metadata lines and their
// one-line attribute values. It reads what add_physics.mjs needs and skips multi-line values such as point arrays.

/** Returns Map(path -> { name, specifier, type, metadata: string, attributes: Map(name -> raw value) }). */
export function parseUsda(text) {
  const prims = new Map();
  const stack = [];
  let pending = null;
  let braceDepth = 0;
  let parenDepth = 0;
  let insideTripleQuote = false;

  for (const line of text.split('\n')) {
    const tripleQuotes = line.split('"""').length - 1;
    if (insideTripleQuote || tripleQuotes % 2 === 1) {
      if (tripleQuotes % 2 === 1) insideTripleQuote = !insideTripleQuote;
      continue;
    }
    const stripped = line
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/@[^@]*@/g, '@@')
      .replace(/<[^>]*>/g, '<>');

    const header = parenDepth === 0 && !pending ? line.match(/^\s*(def|over|class)\s+(?:(\w+)\s+)?"([^"]+)"/) : null;
    if (header) {
      const parentPath = stack.at(-1)?.path ?? '';
      pending = {
        name: header[3],
        specifier: header[1],
        type: header[2] ?? '',
        path: `${parentPath}/${header[3]}`,
        metadata: '',
        lines: [],
      };
    }
    if (pending) pending.metadata += `${line}\n`;
    else if (stack.length > 0 && parenDepth === 0 && braceDepth === stack.at(-1).depth) stack.at(-1).lines.push(line);

    for (const character of stripped) {
      if (character === '(') parenDepth += 1;
      else if (character === ')') parenDepth -= 1;
      else if (character === '{') {
        braceDepth += 1;
        if (pending && parenDepth === 0) {
          pending.depth = braceDepth;
          stack.push(pending);
          prims.set(pending.path, pending);
          pending = null;
        }
      } else if (character === '}') {
        if (stack.length > 0 && stack.at(-1).depth === braceDepth) stack.pop();
        braceDepth -= 1;
      }
    }
  }

  for (const prim of prims.values()) {
    prim.attributes = new Map();
    for (const line of prim.lines) {
      const match = line.match(/^\s*(?:(?:uniform|custom|prepend|append|varying|config)\s+)*[\w[\]]+\s+([\w:]+)\s*=\s*(.+?)\s*$/);
      if (match) prim.attributes.set(match[1], match[2]);
    }
    delete prim.lines;
  }
  return prims;
}

export function apiSchemas(prim) {
  const match = prim?.metadata.match(/apiSchemas = \[([^\]]*)\]/);
  return match ? [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]) : [];
}

/** The first reference of a prim as { file, path }, e.g. { file: 'instances.usda', path: '/Instances/door_01_mesh_00' }. */
export function reference(prim) {
  const match = prim?.metadata.match(/references = \[?\s*@\.?\/?([^@]+)@<([^>]+)>/);
  return match ? { file: match[1], path: match[2] } : null;
}

export function parseNumber(text) {
  const value = text.trim().replace(/^"|"$/g, '');
  if (value === 'inf') return Infinity;
  if (value === '-inf') return -Infinity;
  return Number(value);
}

/** "(1, 2, 3)" -> [1, 2, 3]; a matrix "( (..), (..) )" -> its 16 numbers in order. */
export function parseNumbers(text) {
  return (text.match(/-?(?:inf|[\d.]+(?:e[-+]?\d+)?)/gi) ?? []).map(parseNumber);
}

export function parsePath(text) {
  return text?.match(/<([^>]+)>/)?.[1];
}

export function parseToken(text) {
  return text?.replace(/"/g, '').trim();
}
