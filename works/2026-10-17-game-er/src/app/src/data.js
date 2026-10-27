// Made-up health network, hospitals, triage scale and visit stages. No real names or patient data.

export const COMPANY = {
  product: 'Bayflow',
  network: 'Linden Vale Health',
  user: { name: 'Priya Okafor', initials: 'PO', role: 'Patient flow coordinator' },
}

// Triage levels 1 (resuscitation) to 5 (non-urgent); colours match the `triage` tag in beds.glb.
export const TRIAGE = {
  1: { label: 'Level 1 · Resuscitation', short: 'L1', color: '#e5484d', targetMinutes: 0 },
  2: { label: 'Level 2 · Emergent', short: 'L2', color: '#f5822a', targetMinutes: 10 },
  3: { label: 'Level 3 · Urgent', short: 'L3', color: '#f2c94c', targetMinutes: 30 },
  4: { label: 'Level 4 · Less urgent', short: 'L4', color: '#30a46c', targetMinutes: 60 },
  5: { label: 'Level 5 · Non-urgent', short: 'L5', color: '#3e8ee8', targetMinutes: 120 },
}

export const STAGES = [
  { key: 'arrival', label: 'Arrival' },
  { key: 'triage', label: 'Triage' },
  { key: 'seen', label: 'Seen by doctor' },
  { key: 'tests', label: 'Tests' },
  { key: 'decision', label: 'Decision' },
  { key: 'outcome', label: 'Admitted or discharged' },
]

// Patient-facing minutes run faster than the wall clock: one simulated second is a quarter of a visit minute.
export const VISIT_MINUTES_PER_SECOND = 0.25

// Each site is laid out by sim/layout.js from these numbers (metres, building centred on the origin).
export const SITES = [
  {
    id: 'MP',
    name: 'Marrow Point General',
    area: 'Level 1 trauma centre',
    short: 'Marrow Point',
    width: 48,
    depth: 32,
    cubicles: 10,
    resus: 3,
    helipad: true,
    ambulances: ['amb_type3_a', 'amb_type3_b', 'amb_van'],
    floor: 'floor_tile',
    seatRows: 3,
    startClock: 14 * 3600 + 6 * 60,
    baseline: { doorToDoctor: 21, waiting: 14, lwbs: 2.4 },
    seed: 11,
    walkInEvery: [56, 80],
    ambulanceEvery: [70, 104],
    heliEvery: 170,
  },
  {
    id: 'AV',
    name: 'Ashby Vale Community',
    area: 'Community hospital',
    short: 'Ashby Vale',
    width: 40,
    depth: 28,
    cubicles: 8,
    resus: 1,
    helipad: false,
    ambulances: ['amb_van', 'amb_type3_b'],
    floor: 'floor_tile_alt',
    seatRows: 2,
    startClock: 14 * 3600 + 6 * 60,
    baseline: { doorToDoctor: 34, waiting: 9, lwbs: 3.1 },
    seed: 23,
    walkInEvery: [50, 72],
    ambulanceEvery: [80, 120],
    heliEvery: 0,
  },
  {
    id: 'LH',
    name: "Little Harbour Children's",
    area: "Children's hospital",
    short: 'Little Harbour',
    width: 44,
    depth: 32,
    cubicles: 9,
    resus: 2,
    helipad: true,
    ambulances: ['amb_type3_b', 'amb_type3_a'],
    floor: 'floor_tile_alt',
    seatRows: 3,
    startClock: 14 * 3600 + 6 * 60,
    baseline: { doorToDoctor: 17, waiting: 11, lwbs: 1.6 },
    seed: 37,
    walkInEvery: [52, 76],
    ambulanceEvery: [70, 110],
    heliEvery: 150,
    heliFirst: 122,
    children: true,
  },
]

export const FIRST_NAMES = ['Amara', 'Tomas', 'Leilani', 'Kofi', 'Ines', 'Rafael', 'Mei', 'Jonah', 'Sana', 'Oskar', 'Noor', 'Dmitri', 'Talia', 'Bayo', 'Lucia', 'Arjun', 'Freya', 'Mateo', 'Hana', 'Elias', 'Zara', 'Ivo', 'Selin', 'Caleb']
export const LAST_NAMES = ['Brandt', 'Achebe', 'Kowal', 'Nakamura', 'Ferreira', 'Lindqvist', 'Osei', 'Marchetti', 'Haddad', 'Novak', 'Quinn', 'Varga', 'Tanaka', 'Mensah', 'Rowe', 'Iqbal']

export const COMPLAINTS = {
  adult: ['Chest pain', 'Shortness of breath', 'Abdominal pain', 'Fall, hip pain', 'Headache', 'Fever', 'Dizziness', 'Back pain', 'Wrist injury', 'Allergic reaction', 'Palpitations', 'Laceration, hand'],
  child: ['Fever', 'Breathing difficulty', 'Wrist injury', 'Abdominal pain', 'Rash', 'Head bump', 'Dehydration', 'Ear pain', 'Asthma flare', 'Ankle sprain'],
}

export const TESTS = ['Bloods', 'CT', 'X-ray', 'ECG', 'Urinalysis']

export const UNIT_NAMES = { amb_type3_a: 'Medic', amb_type3_b: 'Rescue', amb_van: 'Transport' }
