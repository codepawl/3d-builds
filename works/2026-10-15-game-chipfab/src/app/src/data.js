// Invented company, campus, fabs, tools and products. Nothing here names a real chipmaker,
// tool vendor or product. The layout of each fab is declared as bays of tool rows; sim.js
// turns it into positions using the anchors measured from the GLBs (geometry.json).

export const COMPANY = { name: 'Northmere Semiconductor', campus: 'Lakeport campus' }

// One route stage per process area. A lot loops through these once per layer.
export const STAGES = [
  { key: 'litho', label: 'Litho', toolKind: 'litho', minutes: [48, 64] },
  { key: 'etch', label: 'Etch', toolKind: 'etch', minutes: [36, 50] },
  { key: 'clean', label: 'Clean', toolKind: 'wet', minutes: [22, 31] },
  { key: 'dep', label: 'Deposition', toolKind: 'dep', minutes: [39, 56] },
  { key: 'implant', label: 'Implant', toolKind: 'implant', minutes: [31, 42] },
  { key: 'anneal', label: 'Anneal', toolKind: 'furnace', minutes: [64, 84] },
  { key: 'cmp', label: 'CMP', toolKind: 'cmp', minutes: [36, 48] },
  { key: 'metro', label: 'Metrology', toolKind: 'metro', minutes: [20, 28] },
]

export const TOOL_KINDS = {
  litho: { label: 'Lithography scanner', prefix: 'LTH', icon: 'litho', wph: [180, 230] },
  etch: { label: 'Plasma etch cluster', prefix: 'ETC', icon: 'etch', wph: [36, 48] },
  dep: { label: 'Deposition cluster', prefix: 'DEP', icon: 'dep', wph: [30, 44] },
  implant: { label: 'Ion implanter', prefix: 'IMP', icon: 'implant', wph: [190, 260] },
  furnace: { label: 'Vertical furnace', prefix: 'FRN', icon: 'furnace', wph: [90, 125] },
  cmp: { label: 'CMP polisher', prefix: 'CMP', icon: 'cmp', wph: [55, 72] },
  metro: { label: 'Metrology and inspection', prefix: 'MET', icon: 'metro', wph: [60, 110] },
  wet: { label: 'Wet bench', prefix: 'WET', icon: 'wet', wph: [140, 190] },
}

// Invented model names per GLB variant.
export const TOOL_MODELS = {
  litho_a: 'Lumen 5 scanner',
  litho_b: 'Lumen 9 scanner',
  etch_a: 'Corvid 4 etch',
  etch_b: 'Corvid 3 etch',
  dep_a: 'Strata 4 CVD',
  dep_b: 'Strata 3 ALD',
  implant_a: 'Ionis HC implanter',
  furnace_a: 'Thermix twin furnace',
  furnace_b: 'Thermix furnace',
  cmp_a: 'Glide 3 polisher',
  cmp_b: 'Glide 2 polisher',
  metro_a: 'Caliper CD-SEM',
  metro_b: 'Optix defect scan',
  wet_a: 'Rinse 4 wet bench',
  wet_b: 'Rinse 3 wet bench',
}

export const PRODUCTS = [
  { code: 'KS7', name: 'Kestrel K7 phone SoC', node: '5 nm class', steps: 612 },
  { code: 'AV3', name: 'Avocet A3 AI accelerator', node: '5 nm class', steps: 648 },
  { code: 'TN2', name: 'Tern T2 modem', node: '7 nm class', steps: 540 },
  { code: 'PL5', name: 'Plover P5 microcontroller', node: '28 nm class', steps: 388 },
]

export const PEOPLE_NAMES = [
  'Mai Tran', 'Jonas Weber', 'Priya Nair', 'Leo Garza', 'Hana Sato', 'Omar Haddad', 'Ines Costa', 'Kofi Mensah',
  'Lena Novak', 'Ravi Iyer', 'Sofia Ruiz', 'Tom Becker', 'Yuki Mori', 'Amara Obi', 'Erik Lund', 'Nadia Karim',
]

// Bays run along z; rows face the aisle between them. `S` marks the bay stocker (first in row A).
// Fab 2 is ramping up: `install` slots are taped floor where a tool is still to arrive.
export const SITES = [
  {
    id: 'F1',
    kind: 'fab',
    name: 'Fab 1 Cedar',
    area: '300 mm logic',
    seed: 11,
    lots: 72,
    vehiclesPerBay: 7,
    baseline: { starts: 3180, yield: 92.6, cycleDays: 47.2, availability: 91.5 },
    bays: [
      { name: 'Litho', floor: 'litho', rowA: ['stocker_a', 'litho_b', 'litho_a', 'litho_b', 'metro_a'], rowB: ['litho_a', 'litho_b', 'metro_a', 'litho_a', 'litho_b'] },
      { name: 'Etch and deposition', floor: 'a', rowA: ['stocker_a', 'etch_a', 'etch_b', 'etch_a'], rowB: ['dep_a', 'dep_b', 'dep_a', 'metro_b', 'metro_a'] },
      { name: 'Diffusion and implant', floor: 'a', rowA: ['stocker_a', 'furnace_a', 'furnace_a', 'furnace_b', 'furnace_b', 'implant_a'], rowB: ['implant_a', 'wet_a', 'wet_b', 'implant_a', 'wet_b'] },
      { name: 'CMP and metrology', floor: 'a', rowA: ['stocker_a', 'cmp_a', 'cmp_b', 'cmp_a', 'wet_b'], rowB: ['metro_b', 'metro_a', 'cmp_a', 'metro_a', 'cmp_b', 'metro_b'] },
    ],
  },
  {
    id: 'F2',
    kind: 'fab',
    name: 'Fab 2 Larch',
    area: 'ramp-up',
    seed: 23,
    lots: 30,
    vehiclesPerBay: 5,
    baseline: { starts: 620, yield: 81.4, cycleDays: 63.5, availability: 78.0 },
    bays: [
      { name: 'Litho', floor: 'litho', rowA: ['stocker_a', 'litho_b', 'install'], rowB: ['litho_b', 'metro_a', 'install'] },
      { name: 'Etch, clean and deposition', floor: 'a', rowA: ['stocker_a', 'etch_b', 'wet_a', 'install'], rowB: ['dep_b', 'install', 'etch_b'] },
      { name: 'Thermal, implant and CMP', floor: 'a', rowA: ['stocker_a', 'furnace_a', 'implant_a', 'install'], rowB: ['cmp_b', 'metro_b', 'install'] },
    ],
  },
  {
    id: 'LP',
    kind: 'campus',
    name: 'Lakeport campus',
    area: 'site services',
    seed: 37,
    baseline: { starts: 3800, yield: 90.9, cycleDays: 49.6, availability: 89.8 },
  },
]

// Campus buildings at real size (metres). `fab` links a building to a fab site.
export const CAMPUS_BUILDINGS = [
  { id: 'B-F1', node: 'bldg_fab_main', name: 'Fab 1 Cedar', role: '300 mm logic fab', position: [-62, 0, -18], rotation: 0, fab: 'F1' },
  { id: 'B-F2', node: 'bldg_fab_ramp', name: 'Fab 2 Larch', role: 'Fab under ramp-up', position: [58, 0, -20], rotation: 0, fab: 'F2' },
  { id: 'B-PK', node: 'bldg_packaging', name: 'Packaging plant', role: 'Advanced packaging and test', position: [-70, 0, 68], rotation: 0 },
  { id: 'B-UPW', node: 'bldg_upw', name: 'Ultra-pure water', role: 'UPW plant', position: [4, 0, 58], rotation: 0 },
  { id: 'B-GAS', node: 'gas_yard', name: 'Gas yard', role: 'Bulk gases and cryogenics', position: [44, 0, 62], rotation: 0 },
  { id: 'B-CT1', node: 'cooling_tower', name: 'Cooling tower 1', role: 'Process cooling water', position: [-8, 0, -58], rotation: 0 },
  { id: 'B-CT2', node: 'cooling_tower', name: 'Cooling tower 2', role: 'Process cooling water', position: [16, 0, -58], rotation: 0 },
  { id: 'B-SUB', node: 'substation', name: 'Substation', role: '138 kV intake', position: [118, 0, 64], rotation: 0 },
  { id: 'B-ADM', node: 'bldg_admin', name: 'Operations centre', role: 'Offices and control room', position: [-14, 0, 104], rotation: 0 },
]

// Road loop the trucks drive (x, z), clockwise from the gate.
export const CAMPUS_ROAD = [
  [-112, 40], [140, 40], [140, 92], [-112, 92],
]
