// The plain data model: spaces (sites), rooms, orglets (agents), tasks and approvals.
// The 3D scene and the dashboard both read it; simulation.js advances it.

export function createRandom(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export const ROOM_KINDS = {
  lead: { label: 'Lead desk', tint: '#e9e6ff' },
  research: { label: 'Research corner', tint: '#e3f1fb' },
  code: { label: 'Code room', tint: '#e5f5ee' },
  review: { label: 'Review room', tint: '#fbf1e2' },
  approvals: { label: 'Approval stations', tint: '#fdeaea' },
  routines: { label: 'Routines board', tint: '#eef0f6' },
};

export const STAGES = ['Requested', 'Planned', 'Working', 'Approval', 'Reported'];

// Corridor runs along z = 0; back-row rooms open to its north edge, front-row rooms to its south edge.
const BACK_ROW_Z = -6.2;
const FRONT_ROW_Z = 6.2;
const ROOM_DEPTH = 8;

function room(kind, x, row, width) {
  const z = row === 'back' ? BACK_ROW_Z : FRONT_ROW_Z;
  const doorZ = row === 'back' ? z + ROOM_DEPTH / 2 : z - ROOM_DEPTH / 2;
  return { id: `${kind}`, kind, label: ROOM_KINDS[kind].label, x, z, width, depth: ROOM_DEPTH, row, doorZ };
}

const SPACE_DEFINITIONS = [
  {
    id: 'launch',
    name: 'Launch week',
    note: 'Space · 3 channels',
    floorColor: '#dfe5f3',
    seed: 11,
    rooms: [
      room('research', -10.5, 'back', 9),
      room('code', 0, 'back', 10),
      room('review', 10.5, 'back', 9),
      room('lead', -9.5, 'front', 10),
      room('approvals', 1, 'front', 8),
      room('routines', 10, 'front', 9),
    ],
    channels: ['#launch', '#site', '#press'],
    orglets: [
      { name: 'Mira', role: 'Lead', runtime: 'Claude Code', color: '#6d4aff', lead: true },
      { name: 'Juno', role: 'Researcher', runtime: 'Gemini CLI', color: '#2f9bea' },
      { name: 'Pax', role: 'Coder', runtime: 'Codex', color: '#17a673' },
      { name: 'Tove', role: 'Writer', runtime: 'Claude Code', color: '#f08a3c' },
      { name: 'Rook', role: 'Reviewer', runtime: 'Cursor Agent', color: '#e2557a' },
      { name: 'Ivo', role: 'Coder', runtime: 'OpenRouter API', color: '#14a3b8' },
    ],
    tasks: [
      ['research', 'Compare three launch-day posting times', '#press'],
      ['code', 'Add the pricing table to the landing page', '#site'],
      ['research', 'Summarise feedback from the beta form', '#launch'],
      ['code', 'Fix the broken download link on Windows', '#site'],
      ['research', 'Draft the press note from the changelog', '#press'],
      ['code', 'Resize screenshots for the store page', '#launch'],
    ],
  },
  {
    id: 'studio',
    name: 'Halden Studio',
    note: 'Client space · 2 channels',
    floorColor: '#e2ebe6',
    seed: 23,
    rooms: [
      room('code', -9, 'back', 12),
      room('research', 4, 'back', 8),
      room('routines', 12.5, 'back', 7),
      room('approvals', -11, 'front', 7),
      room('lead', -1.5, 'front', 10),
      room('review', 9.5, 'front', 9),
    ],
    channels: ['#website', '#invoices'],
    orglets: [
      { name: 'Odile', role: 'Lead', runtime: 'Codex', color: '#17a673', lead: true },
      { name: 'Bram', role: 'Coder', runtime: 'Claude Code', color: '#6d4aff' },
      { name: 'Senna', role: 'Coder', runtime: 'Cursor Agent', color: '#2f9bea' },
      { name: 'Kit', role: 'Bookkeeper', runtime: 'Ollama', color: '#f08a3c' },
      { name: 'Lume', role: 'Researcher', runtime: 'Gemini CLI', color: '#e2557a' },
    ],
    tasks: [
      ['code', 'Move the contact form to the new layout', '#website'],
      ['research', 'Match October receipts to bank lines', '#invoices'],
      ['code', 'Replace hero images with compressed ones', '#website'],
      ['research', 'List unpaid invoices older than 30 days', '#invoices'],
      ['code', 'Add alt text to the gallery page', '#website'],
    ],
  },
  {
    id: 'digest',
    name: 'Research digest',
    note: 'Space · routines',
    floorColor: '#e7e3f1',
    seed: 37,
    rooms: [
      room('routines', -11, 'back', 7),
      room('research', -1, 'back', 12),
      room('review', 10, 'back', 9),
      room('lead', -7.5, 'front', 11),
      room('code', 3.5, 'front', 8),
      room('approvals', 11.5, 'front', 7),
    ],
    channels: ['#weekly-digest', '#reading'],
    orglets: [
      { name: 'Wren', role: 'Lead', runtime: 'Claude Code', color: '#2f9bea', lead: true },
      { name: 'Atlas', role: 'Researcher', runtime: 'Gemini CLI', color: '#6d4aff' },
      { name: 'Noor', role: 'Researcher', runtime: 'Claude Code', color: '#17a673' },
      { name: 'Fen', role: 'Editor', runtime: 'Codex', color: '#e2557a' },
    ],
    tasks: [
      ['research', 'Read this week’s papers on agent memory', '#reading'],
      ['research', 'Pull release notes from five tool vendors', '#weekly-digest'],
      ['code', 'Update the digest template table', '#weekly-digest'],
      ['research', 'Check every quoted number against its source', '#reading'],
    ],
  },
];

const TOOLS = {
  research: ['Browser · reading a page', 'Web search', 'Read attachment', 'MCP · notion'],
  code: ['Edit granted folder (private copy)', 'Run a check', 'MCP · github', 'Desktop app · Excel'],
};

const HELD_ACTIONS = {
  research: [
    { action: 'Browser · submit a form', risk: 'high' },
    { action: 'Browser · open a signed-in page', risk: 'low' },
    { action: 'MCP · notion create_page', risk: 'low' },
  ],
  code: [
    { action: 'Apply the diff to your folder', risk: 'high' },
    { action: 'MCP · github create_pull_request', risk: 'high' },
    { action: 'Desktop app · save workbook', risk: 'low' },
  ],
};

export const API_RUNTIMES = new Set(['OpenRouter API']);

function buildSlots(spaceRoom) {
  // Standing spots in front of furniture; scene.jsx places furniture at the same spots.
  const columns = spaceRoom.kind === 'lead' || spaceRoom.kind === 'approvals' ? 3 : Math.max(2, Math.floor(spaceRoom.width / 3));
  const slots = [];
  const towardDoor = spaceRoom.row === 'back' ? 1 : -1;
  for (let column = 0; column < columns; column += 1) {
    const x = spaceRoom.x - spaceRoom.width / 2 + (spaceRoom.width / columns) * (column + 0.5);
    // Front-row approval stations face the camera, so the orglet stands behind the kiosk, facing the corridor.
    const isFacingCorridor = spaceRoom.kind === 'approvals' && spaceRoom.row === 'front';
    const standOffset = isFacingCorridor ? -towardDoor * 1.0 : towardDoor * 0.6;
    const facing = isFacingCorridor ? towardDoor : -towardDoor;
    slots.push({ x, z: spaceRoom.z + standOffset, facing, taken: null });
  }
  return slots;
}

export function createWorld() {
  const spaces = SPACE_DEFINITIONS.map((definition, spaceIndex) => {
    const random = createRandom(definition.seed);
    const rooms = definition.rooms.map((spaceRoom) => ({ ...spaceRoom, slots: buildSlots(spaceRoom) }));
    const leadRoom = rooms.find((spaceRoom) => spaceRoom.kind === 'lead');
    const orglets = definition.orglets.map((orgletDefinition, index) => {
      const startSlot = index === 0 ? leadRoom.slots[1] : null;
      const startX = leadRoom.x - leadRoom.width / 2 + 1 + index * 1.4;
      return {
        id: `${definition.id}-${orgletDefinition.name.toLowerCase()}`,
        type: 'orglet',
        ...orgletDefinition,
        spaceId: definition.id,
        position: startSlot ? { x: startSlot.x, z: startSlot.z } : { x: startX, z: 0.6 * (index % 2 ? 1 : -1) },
        heading: 0,
        path: [],
        phase: orgletDefinition.lead ? 'planning' : 'idle',
        timer: 1 + index * 1.7,
        roomId: orgletDefinition.lead ? 'lead' : null,
        slot: startSlot,
        taskId: null,
        tool: orgletDefinition.lead ? 'Planning the channel' : null,
        tokensToday: Math.round(40000 + random() * 160000),
        tasksDone: Math.floor(random() * 6),
        log: [],
        walkCycle: random() * 6,
      };
    });
    if (orglets[0].slot) {
      orglets[0].slot.taken = orglets[0].id;
    }
    return {
      id: definition.id,
      index: spaceIndex,
      name: definition.name,
      note: definition.note,
      floorColor: definition.floorColor,
      channels: definition.channels,
      rooms,
      orglets,
      tasks: [],
      approvals: [],
      taskTemplates: definition.tasks,
      nextTemplate: 0,
      nextTaskNumber: 1040 + spaceIndex * 300,
      nextApprovalNumber: 1,
      spawnTimer: 0.5,
      routineTimer: 14 + spaceIndex * 5,
      reportedToday: 9 + spaceIndex * 4,
      apiSpendDollars: 1.8 + spaceIndex * 0.7,
      apiCapDollars: 10,
      random,
      events: [],
    };
  });
  return { spaces, activeSpaceId: 'launch', time: 0, version: 0, selection: null };
}

export function pickTool(space, kind) {
  const options = TOOLS[kind];
  return options[Math.floor(space.random() * options.length)];
}

export function pickHeldAction(space, kind) {
  const options = HELD_ACTIONS[kind];
  return options[Math.floor(space.random() * options.length)];
}

export function activeSpace(world) {
  return world.spaces.find((space) => space.id === world.activeSpaceId);
}

export function findRoom(space, roomId) {
  return space.rooms.find((spaceRoom) => spaceRoom.id === roomId);
}

export function findObject(world, selection) {
  if (!selection) {
    return null;
  }
  const space = activeSpace(world);
  if (selection.type === 'orglet') {
    return space.orglets.find((orglet) => orglet.id === selection.id) || null;
  }
  if (selection.type === 'room') {
    return findRoom(space, selection.id) || null;
  }
  if (selection.type === 'task') {
    return space.tasks.find((task) => task.id === selection.id) || null;
  }
  if (selection.type === 'approval') {
    return space.approvals.find((approval) => approval.id === selection.id) || null;
  }
  return null;
}

// Where the camera should look for a selection.
export function selectionPosition(world, selection) {
  const space = activeSpace(world);
  const target = findObject(world, selection);
  if (!target) {
    return null;
  }
  if (selection.type === 'orglet') {
    return target.position;
  }
  if (selection.type === 'room') {
    return { x: target.x, z: target.z };
  }
  const orglet = space.orglets.find((candidate) => candidate.id === (target.assigneeId || target.orgletId));
  return orglet ? orglet.position : findRoom(space, 'lead');
}
