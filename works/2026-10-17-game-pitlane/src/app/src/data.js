// Static description of the championship: teams, drivers, circuits and the pit-lane layout every circuit shares.
// All names are made up.

export const CHAMPIONSHIP = 'Meridian Formula Series'
export const OUR_TEAM = 'halvard'
export const RACE_LAPS = 58
// A simulated lap takes about 22 s so the world keeps moving; lap times and gaps are shown at race scale.
export const RACE_TIME_SCALE = 4.1

export const TEAMS = {
  halvard: { name: 'Halvard Racing', short: 'HAL', color: '#2557e8', crew: 'crew_halvard_a', crewAlt: 'crew_halvard_b' },
  ostrava: { name: 'Ostrava Motorsport', short: 'OST', color: '#f0644f', crew: 'crew_ostrava', crewAlt: 'crew_ostrava' },
  kestrel: { name: 'Kestrel GP', short: 'KES', color: '#7b4fd6', crew: 'crew_kestrel', crewAlt: 'crew_kestrel' },
  sable: { name: 'Sable Works', short: 'SAB', color: '#e8b81c', crew: 'crew_ostrava', crewAlt: 'crew_ostrava', recolor: '#e8b81c' },
}

// Two cars per team. `model` is the GLB root; the second car of a rival team reuses its team's body.
export const DRIVERS = [
  { id: 'car07', number: '07', team: 'halvard', model: 'car_halvard_07', driver: 'Rune Okafor-Hale', pace: 1.0 },
  { id: 'car22', number: '22', team: 'halvard', model: 'car_halvard_22', driver: 'Sasha Vireo', pace: 1.004 },
  { id: 'car11', number: '11', team: 'ostrava', model: 'car_ostrava_11', driver: 'Petra Lindvall', pace: 1.006 },
  { id: 'car12', number: '12', team: 'ostrava', model: 'car_ostrava_11', driver: 'Cal Moreaux', pace: 0.99 },
  { id: 'car31', number: '31', team: 'kestrel', model: 'car_kestrel_31', driver: 'Juno Takebrand', pace: 0.997 },
  { id: 'car32', number: '32', team: 'kestrel', model: 'car_kestrel_31', driver: 'Ezra Holmqvist', pace: 0.985 },
  { id: 'car44', number: '44', team: 'sable', model: 'car_sable_44', driver: 'Nico Albarrán', pace: 0.993 },
  { id: 'car45', number: '45', team: 'sable', model: 'car_sable_44', driver: 'Dax Whitford', pace: 0.98 },
]

// The pit complex is the same at every round: the track's main straight runs +x along z = -8, the pit wall sits at
// z = 0.6, the fast lane is z 3.5..10, the working lane with the boxes z 10..18, and the garages open towards -z.
export const LAYOUT = {
  straightZ: -8,
  trackWidth: 14,
  pitWallZ: 0.6,
  fastLaneZ: 6.75,
  boxZ: 14,
  garageZ: 30,
  garageSpacing: 12,
  garageCount: 13,
  pitLimitX: 96,
  entryX: -160,
  exitX: 165,
}

// Garage index (0..12, x = -72 + 12 i) of each team; the rest are plain boxes.
export const GARAGE_TEAMS = { 4: 'sable', 5: 'ostrava', 6: 'halvard', 7: 'kestrel' }

export const garageX = (index) => -72 + LAYOUT.garageSpacing * index

const MAIN_STRAIGHT = [[-170, -8], [-90, -8], [0, -8], [90, -8], [170, -8]]

export const SITES = {
  ashgrove: {
    id: 'ashgrove',
    round: 15,
    name: 'Ashgrove Park',
    kind: 'parkland',
    country: 'Northvale',
    timezoneOffset: 1,
    startHour: 14.4,
    seed: 15,
    ground: 'grass',
    night: false,
    barrier: 'armco_section',
    scenery: ['tree_park_a', 'tree_park_b'],
    track: [...MAIN_STRAIGHT, [222, -34], [232, -85], [196, -126], [128, -134], [74, -104], [16, -122], [-46, -162], [-128, -170], [-196, -138], [-226, -84], [-214, -34]],
    weather: { trackTemp: 38.5, airTemp: 24, rain: 12 },
  },
  lumen: {
    id: 'lumen',
    round: 14,
    name: 'Lumen Harbour',
    kind: 'street',
    country: 'Coast of Avelin',
    timezoneOffset: 3,
    startHour: 21.2,
    seed: 14,
    ground: 'city',
    night: true,
    barrier: 'concrete_barrier',
    scenery: ['palm_a', 'palm_b'],
    track: [...MAIN_STRAIGHT, [214, -26], [226, -70], [206, -96], [150, -100], [120, -140], [40, -150], [-20, -118], [-90, -126], [-160, -160], [-214, -128], [-230, -70], [-212, -30]],
    weather: { trackTemp: 29.2, airTemp: 26, rain: 4 },
  },
  sahra: {
    id: 'sahra',
    round: 16,
    name: 'Sahra Dunes',
    kind: 'desert',
    country: 'Qaren',
    timezoneOffset: 4,
    startHour: 16.1,
    seed: 16,
    ground: 'sand',
    night: false,
    barrier: 'armco_section',
    scenery: ['desert_shrub', 'rock_a', 'rock_b'],
    track: [...MAIN_STRAIGHT, [226, -40], [238, -100], [180, -150], [90, -126], [30, -164], [-60, -150], [-100, -110], [-170, -150], [-226, -116], [-232, -60], [-214, -26]],
    weather: { trackTemp: 47.0, airTemp: 34, rain: 1 },
  },
}

export const SITE_ORDER = ['ashgrove', 'lumen', 'sahra']

export const COMPOUNDS = {
  soft: { label: 'Soft', letter: 'S', color: '#e5383b', wearPerLap: 4.4 },
  medium: { label: 'Medium', letter: 'M', color: '#f2c12e', wearPerLap: 2.9 },
  hard: { label: 'Hard', letter: 'H', color: '#e9edf2', wearPerLap: 2.0 },
  inter: { label: 'Intermediate', letter: 'I', color: '#3bb273', wearPerLap: 3.4 },
  wet: { label: 'Wet', letter: 'W', color: '#2f80ed', wearPerLap: 2.6 },
}

export const CREW_ROLES = {
  jack_front: 'Front jack',
  jack_rear: 'Rear jack',
  gun: 'Wheel gun',
  tyre_off: 'Tyre off',
  tyre_on: 'Tyre on',
  stabiliser: 'Stabiliser',
  mechanic: 'Mechanic',
  marshal: 'Marshal',
}

const FIRST = ['Ari', 'Bo', 'Cleo', 'Dev', 'Eli', 'Fen', 'Gus', 'Hana', 'Ivo', 'Jada', 'Kai', 'Lio', 'Mae', 'Noor', 'Oto', 'Pia', 'Quin', 'Rafa', 'Suki', 'Tam', 'Uma', 'Vik', 'Wren', 'Yara', 'Zed']
const LAST = ['Brandt', 'Castell', 'Dunmore', 'Elsworth', 'Faro', 'Granger', 'Hollis', 'Ibarra', 'Joss', 'Kellan', 'Lomax', 'Marlow', 'Nyberg', 'Oakes', 'Pell', 'Quarry', 'Rook', 'Sorel', 'Tarrant', 'Ulm', 'Vance', 'Wilde']

export function personName(index) {
  return `${FIRST[(index * 7) % FIRST.length]} ${LAST[(index * 5 + 3) % LAST.length]}`
}
