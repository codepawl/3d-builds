// The case file. Every fact here comes from drafts/hold/true-crime-map/ed-gein-facts.md
// (sections 1-4); section 5 of that file lists what must never appear.
// Confidence marks: '2S' two or more sources, '1S' one source, 'D' disputed, 'SEC' later sources only.

const METRES_PER_DEGREE_LON = 79724
const METRES_PER_DEGREE_LAT = 111132
const STORE = { lat: 44.21349, lon: -89.49233 }

// Local county frame in metres: x east, z south, origin at the store point.
export function toLocal(lat, lon) {
  return [(lon - STORE.lon) * METRES_PER_DEGREE_LON, -(lat - STORE.lat) * METRES_PER_DEGREE_LAT]
}

export const CONFIDENCE = {
  '2S': { label: 'two or more sources agree', short: '2S' },
  '1S': { label: 'one source only', short: '1S' },
  D: { label: 'disputed, both versions shown', short: 'D' },
  SEC: { label: 'later sources only, no 1957-68 original located', short: 'SEC' },
}

export const SOURCES = [
  { id: 'wiki', title: 'Wikipedia, "Ed Gein"', detail: 'rendered text and raw wikitext; cites Schechter, Deviant (1989, 2010), Gollmar (1981) and the 1957-68 papers below' },
  { id: 'isthmus', title: 'Isthmus, Scott Hassett, "Our Psycho"', detail: '30 Nov 2007' },
  { id: 'schrc', title: 'Sheboygan County Historical Research Center', detail: '"Sheboygan pathologist helped in Ed Gein case" (PDF)' },
  { id: 'hanneman', title: 'Hanneman Archive', detail: '4 Nov 2014' },
  { id: 'upnorth', title: 'Up North News', detail: '"What happened to Ed Gein\'s house"' },
  { id: 'spj', title: 'Stevens Point Daily Journal, 1957', detail: '18, 20, 21 and 25 Nov 1957, via Wikipedia footnotes' },
  { id: 'spjclip', title: 'Stevens Point Journal clipping, 1954-57', detail: 'seen only as a search summary' },
  { id: 'startribune', title: 'Star Tribune, 17 Nov 1957, p. 1', detail: 'via Wikipedia' },
  { id: 'oshkosh', title: 'Oshkosh Northwestern, 18 Nov 1957, p. 1', detail: 'via Wikipedia' },
  { id: 'lacrosse', title: 'La Crosse Tribune, 21 Mar 1958, p. 16', detail: 'via Wikipedia' },
  { id: 'trial', title: 'Oshkosh Daily Northwestern, 7 Nov 1968, p. 1; Capital Times, 14 Nov 1968, p. 2', detail: 'via Wikipedia' },
  { id: 'rapids', title: 'Wisconsin Rapids Daily Tribune, 19 May 1944, p. 1', detail: 'via Wikipedia' },
  { id: 'prescott', title: 'Prescott Evening Courier, 26 Nov 1957', detail: 'via Wikipedia' },
  { id: 'gollmar', title: 'Gollmar, Edward Gein (1981)', detail: 'cited through Wikipedia; the book itself was not read' },
  { id: 'schechter', title: 'Schechter, Deviant (1989, 2010)', detail: 'cited through Wikipedia; the book itself was not read' },
  { id: 'auction', title: 'Hintz 2007; Reavill 2007', detail: 'via Wikipedia' },
  { id: 'pinegrove', title: 'edgeinstory.com; Simple Wikipedia', detail: 'location of the tavern near Bancroft, Pine Grove' },
  { id: 'osm', title: 'OpenStreetMap contributors (ODbL)', detail: 'Nominatim and Overpass, queried 2026-10-18; distances are great-circle from the store point' },
  { id: 'usgs', title: 'USGS historical topographic quads (public domain)', detail: 'Coloma 1958, Whiting 1957, Amherst 1957, Wautoma 1959, 1:48,000; traced for this map' },
  { id: 'sanborn', title: 'Sanborn Fire Insurance Map, Plainfield, Aug 1908 (LOC, public domain)', detail: 'street grid and lot footprints; 1923 view of the town (public domain)' },
]

// Places. `scale` says which world shows the place up close; `county` is its map point.
export const PLACES = [
  {
    id: 'store', name: 'Worden Hardware', kind: 'crime', scale: 'village', latLon: [44.21349, -89.49233],
    lines: [
      'Site of 110 S Main St, Plainfield (building per 1908 plan).',
      "Bernice Worden's store since her husband died in 1931.",
      'Placement inferred from the 1908 hardware lot.',
    ],
    distance: 'Village centre; the store point is the origin of every distance here.',
    confidence: '2S', sources: ['osm', 'upnorth', 'hanneman', 'sanborn'],
  },
  {
    id: 'farm', name: 'Gein farm', kind: 'site', scale: 'farm', latLon: [44.1851, -89.5828],
    lines: [
      'Town of Plainfield, Waushara County. Map point only: private farmland today.',
      'House burned 20 Mar 1958, early morning, ten days before the auction.',
      'Acreage disputed: 155, 160 or 195.',
    ],
    distance: '4.9 mi (7.9 km) WSW of the store; about seven miles in the 1957 papers, probably by road.',
    confidence: '2S', sources: ['osm', 'upnorth', 'isthmus', 'lacrosse'],
  },
  {
    id: 'westplainfield', name: 'West Plainfield', kind: 'site', scale: 'county', latLon: [44.2141, -89.5527],
    lines: [
      'Hamlet. Lester Hill ran the grocery; Gein did odd jobs for him.',
      'Arrested here that night: at the grocery, or at the Hills\' table after supper.',
      'Exact lot unknown.',
    ],
    distance: '3.0 mi W of the store; the farm is 2.5 mi SW of it.',
    confidence: 'D', sources: ['oshkosh', 'isthmus', 'schrc'],
  },
  {
    id: 'pinegrove', name: 'Town of Pine Grove', kind: 'crime', scale: 'county', latLon: [44.2915, -89.5473], area: true,
    lines: [
      "Mary Hogan's tavern, Portage County, near Bancroft. Not in Plainfield.",
      'Area marker at the town centre: the tavern lot is unknown.',
    ],
    distance: 'Town centre 7.6 mi NNE of the farm.',
    confidence: '2S', sources: ['spjclip', 'schrc', 'pinegrove'],
  },
  {
    id: 'cemetery', name: 'Plainfield Cemetery', kind: 'site', scale: 'county', latLon: [44.2154, -89.5175],
    lines: [
      'Test exhumations 25 Nov 1957.',
      'Journal, 25 Nov, p. 1: "Empty Coffins Discovered in Graves at Plainfield".',
    ],
    distance: '1.3 mi W of the store.',
    confidence: '2S', sources: ['osm', 'spj', 'prescott'],
  },
  {
    id: 'spiritland', name: 'Spiritland Cemetery', kind: 'site', scale: 'county', latLon: [44.258, -89.4637],
    lines: ['Almond, Portage County. Named as a robbery site only in later write-ups.'],
    distance: '3.4 mi NNE of the store.',
    confidence: 'SEC', sources: ['hanneman', 'upnorth'],
  },
  {
    id: 'hancock', name: 'Hancock Cemetery', kind: 'site', scale: 'county', latLon: [44.1149, -89.5419],
    lines: ['Town of Hancock. Named as a robbery site only in later write-ups.'],
    distance: '7.2 mi S of the store.',
    confidence: 'SEC', sources: ['hanneman', 'upnorth'],
  },
  {
    id: 'courthouse', name: 'Waushara County Courthouse', kind: 'site', scale: 'county', latLon: [44.07371, -89.2899],
    lines: ['Wautoma. Arraignment 21 Nov 1957 in Waushara County Court.', 'Held at the county jail in Wautoma; its building is not located.'],
    distance: '13.9 mi SE of the store.',
    confidence: '2S', sources: ['spj', 'schrc', 'osm'],
  },
  {
    id: 'waupun', name: 'Central State Hospital, Waupun', kind: 'offmap', scale: 'county', latLon: [43.6204, -88.7425],
    lines: ['Committed here after he was found unfit for trial (Dec 1957 or Jan 1958).', 'Now Dodge Correctional Institution.'],
    distance: 'Off this map, to the south-east.',
    confidence: '2S', sources: ['gollmar', 'isthmus', 'hanneman'],
  },
  {
    id: 'mendota', name: 'Mendota Mental Health Institute, Madison', kind: 'offmap', scale: 'county', latLon: [43.13, -89.401],
    lines: ['Later transfer. He died here 26 Jul 1984, age 77.'],
    distance: 'Off this map, to the south.',
    confidence: '2S', sources: ['wiki', 'osm'],
  },
]

export const VICTIMS = [
  { id: 'hogan', name: 'Mary Hogan', age: '51', ageNote: '54 or 55 in other accounts', ageConfidence: 'D', job: 'Tavern keeper, Town of Pine Grove', date: '8 Dec 1954', place: 'pinegrove', sources: ['gollmar', 'schrc'] },
  { id: 'worden', name: 'Bernice Worden', age: '58', job: 'Hardware store owner, Plainfield', date: '16 Nov 1957', place: 'store', ageConfidence: '2S', sources: ['wiki', 'hanneman'] },
]

export const PEOPLE = [
  { name: 'Frank Worden', role: "Bernice Worden's son, Waushara County deputy sheriff; found the store about 5 pm.", confidence: '2S', tint: 'white' },
  { name: 'Arthur Schley', role: 'Waushara County sheriff; led the farm search.', confidence: '2S', tint: 'blue' },
  { name: 'Lloyd Schoephoester', role: 'Captain, Green Lake County sheriff\'s department; assisted. Spelling varies.', confidence: 'D', tint: 'blue' },
  { name: 'Allan Wilimovsky', role: 'State crime lab investigator; searched and inventoried the house.', confidence: '1S', tint: 'blue' },
  { name: 'Herbert Wanserski', role: 'Portage County sheriff, Hogan case.', confidence: '1S', tint: 'blue' },
  { name: 'Harold (Ed) Kroll', role: 'Sheboygan County sheriff.', confidence: '1S', tint: 'blue' },
  { name: 'Dr. Frederick Eigenberger', role: 'Sheboygan pathologist working for the state crime lab.', confidence: '1S', tint: 'grey' },
  { name: 'Lester Hill', role: 'West Plainfield grocer; Gein\'s neighbour and employer.', confidence: '2S', tint: 'grey' },
  { name: 'Judge Robert H. Gollmar', role: 'Trial judge, 1968; later author.', confidence: '2S', tint: 'grey' },
  { name: 'Dr. George D. Arndt', role: 'Competency evaluation; wrote on the community\'s reaction.', confidence: '1S', tint: 'grey' },
  { name: 'Edward Gein', role: 'Plainfield farmer and handyman; arrested 16 Nov 1957, committed, tried 1968.', confidence: '2S', tint: 'grey' },
]

// Quotes 1, 2, 3 and 5 of the fact file. Quote 4 is never shown.
export const QUOTES = [
  { before: '"just too ', key: 'horrible', after: '. Horrible beyond belief."', by: 'Sheriff Arthur Schley, 16 Nov 1957', via: 'as reported in Isthmus, Nov 2007; paper not named' },
  { before: '"Well this was too ', key: 'gruesome to even talk about', after: '."', by: 'Sheriff Ed Kroll to a Sheboygan Press reporter, Nov 1957', via: 'via SCHRC; date not given' },
  { before: '"tremendous outpouring of ', key: 'apprehension, fear, panic', after: '"', by: 'Dr. George Arndt, preface to Gollmar 1981', via: 'via Isthmus' },
  { before: '"did not the children, half-believing it while they laughed, say his old house was ', key: 'haunted', after: '?"', by: 'Robert Wells, Milwaukee Journal, 1957', via: 'via Isthmus' },
]

// Lighting presets the timeline selects.
export const LIGHT = {
  day: { label: 'day' },
  morning: { label: 'morning' },
  dusk: { label: 'dusk' },
  night: { label: 'night' },
}

// Timeline. `sort` orders the axis; `scale` and `place` say where the event is shown.
// Events of 16 Nov 1957 also sit on the hour-by-hour track (`hour` in 24 h, approximate).
export const EVENTS = [
  { id: 'e1940', date: '1 Apr 1940', short: 'George Gein dies', text: 'George Gein dies of heart failure, age 66.', confidence: '1S', sources: ['schechter'], scale: 'county', place: 'farm', light: 'day' },
  { id: 'e1944', date: '16 May 1944', short: 'Henry Gein dies', text: 'Henry Gein dies after a brush fire got out of control. Later treated as suspicious in some books; not proven.', confidence: '2S', sources: ['rapids'], scale: 'county', place: 'farm', light: 'day' },
  { id: 'e1945', date: '29 Dec 1945', short: 'Augusta Gein dies', text: 'Augusta Gein dies after strokes, age 67.', confidence: '1S', sources: ['schechter'], scale: 'county', place: 'farm', light: 'day' },
  { id: 'e1947', date: '1947-1952', short: 'Grave visits', text: 'His own later account: night visits to three local graveyards; nine graves robbed, by his admission.', confidence: '2S', sources: ['schechter', 'spj'], scale: 'county', place: 'cemetery', light: 'night' },
  { id: 'e1954', date: '8 Dec 1954', short: 'Mary Hogan missing', text: 'Mary Hogan, tavern keeper in the Town of Pine Grove, disappears in the late afternoon. Unsolved for three years.', confidence: '2S', sources: ['spjclip', 'gollmar', 'schrc'], scale: 'county', place: 'pinegrove', light: 'dusk', crime: true },
  { id: 'e1957morning', date: '16 Nov 1957', short: 'Deer season opens', text: 'Saturday, opening day of gun deer season. Bernice Worden, 58, minds the store; her son Frank is hunting.', confidence: '2S', sources: ['schrc', 'isthmus', 'hanneman'], scale: 'village', place: 'store', light: 'morning', day: true, hour: 8, hourLabel: 'morning' },
  { id: 'e0930', date: '16 Nov 1957', short: 'Truck leaves the rear', text: "The hardware store's truck is seen driving out from the rear of the building. Few customers all day.", confidence: '1S', sources: ['schechter'], scale: 'village', place: 'store', light: 'morning', day: true, hour: 9.5, hourLabel: '9:30' },
  { id: 'e1700', date: '16 Nov 1957', short: 'Frank Worden finds the store', text: 'Frank Worden, deputy sheriff, enters the store: blood stains on the floor, the cash register open, his mother gone.', confidence: '2S', sources: ['startribune', 'isthmus'], scale: 'village', place: 'store', light: 'dusk', day: true, hour: 17, hourLabel: '5:00 PM', crime: true },
  { id: 'eslip', date: '16 Nov 1957', short: 'Antifreeze sales slip', text: 'The last receipt is an antifreeze sales slip. Frank says Gein was in the evening before and would return for a gallon of antifreeze.', confidence: '2S', sources: ['spj', 'schrc'], scale: 'village', place: 'store', light: 'dusk', day: true, hour: 17.8, hourLabel: 'evening' },
  { id: 'enight', date: '16 Nov 1957', short: 'Arrest and farm search', text: 'That night: Gein taken into custody in West Plainfield; the farm searched with generators and flood lamps. Sources differ on which came first.', confidence: 'D', sources: ['oshkosh', 'isthmus', 'schrc', 'startribune'], scale: 'farm', place: 'farm', light: 'night', day: true, hour: 20, hourLabel: 'that night' },
  { id: 'e1121', date: '21 Nov 1957', short: 'Arraignment, Wautoma', text: 'Arraigned in Waushara County Court on one count of first-degree murder; pleads not guilty by reason of insanity.', confidence: '2S', sources: ['spj'], scale: 'county', place: 'courthouse', light: 'day' },
  { id: 'e1125', date: '25 Nov 1957', short: 'Test exhumations', text: 'Test graves opened at Plainfield Cemetery; the caskets are empty, as his account said.', confidence: '2S', sources: ['spj', 'prescott'], scale: 'county', place: 'cemetery', light: 'day' },
  { id: 'e1958a', date: 'Dec 1957 / Jan 1958', short: 'Committed, Waupun', text: 'Found unfit for trial; committed to Central State Hospital, Waupun. Sources differ on the month.', confidence: 'D', sources: ['gollmar', 'isthmus', 'hanneman'], scale: 'county', place: 'waupun', light: 'day' },
  { id: 'e1958fire', date: '20 Mar 1958', short: 'Farmhouse burns', text: 'The farmhouse is destroyed by fire early in the morning, ten days before the auction. Arson suspected, never proven.', confidence: '2S', sources: ['lacrosse'], scale: 'county', place: 'farm', light: 'night', fire: true },
  { id: 'e1968', date: '7-14 Nov 1968', short: 'Trial', text: 'Bench trial before Judge Robert H. Gollmar, tried only for Bernice Worden: guilty of first-degree murder, then not guilty by reason of insanity.', confidence: '2S', sources: ['trial', 'gollmar'], scale: 'county', place: 'courthouse', light: 'day' },
  { id: 'e1984', date: '26 Jul 1984', short: 'Dies, Mendota', text: 'Dies at Mendota Mental Health Institute, Madison, age 77, of respiratory failure after lung cancer.', confidence: '1S', sources: ['schechter'], scale: 'county', place: 'mendota', light: 'day' },
]

// Clue chain, section 4, in order of discovery. Each clue flies to a place and lights it.
export const CLUES = [
  { id: 'c1', title: 'Empty tavern', date: '8 Dec 1954', text: 'Hogan\'s tavern found empty: blood on the floor, a spent .32 shell, tracks outside. No suspect.', confidence: '1S', place: 'pinegrove', event: 'e1954', sources: ['spjclip'] },
  { id: 'c2', title: 'Talk in town', date: 'before 1957', text: 'Gein was known as an odd handyman who lived alone. No dated 1957 article names a specific tip.', confidence: 'SEC', place: 'westplainfield', event: 'e1954', sources: ['gollmar'] },
  { id: 'c3', title: 'Truck at the rear', date: '16 Nov, about 9:30', text: "The store's truck leaves from the rear of the building.", confidence: '1S', place: 'store', event: 'e0930', sources: ['schechter'] },
  { id: 'c4', title: 'Frank Worden returns', date: '16 Nov, about 5 pm', text: 'Blood on the floor, the register open, his mother gone.', confidence: '2S', place: 'store', event: 'e1700', sources: ['startribune'] },
  { id: 'c5', title: 'Trail to the rear door', date: '16 Nov', text: 'A blood trail and a casing lead to the rear door, where the truck had stood.', confidence: '2S', place: 'store', event: 'e1700', sources: ['isthmus', 'hanneman'] },
  { id: 'c6', title: 'Sales slip', date: '16 Nov, evening', text: 'Antifreeze, the last receipt. Frank: Gein had been in the evening before and would return for antifreeze. The lead to Gein.', confidence: '2S', place: 'farm', event: 'enight', sources: ['spj'], key: true },
  { id: 'c7', title: 'First visit to the farm', date: 'that night', text: 'Deputies go to the farm; Gein is not home.', confidence: 'D', place: 'farm', event: 'enight', sources: ['isthmus', 'hanneman'] },
  { id: 'c8', title: 'Found at West Plainfield', date: 'that night', text: 'Found at the Hill grocery or the Hills\' supper table; taken into custody.', confidence: 'D', place: 'westplainfield', event: 'enight', sources: ['oshkosh', 'isthmus'] },
  { id: 'c9', title: 'Night search', date: 'that night', text: 'Schley and others search the farm with generators. Bernice Worden found. Crime lab and out-of-county officers arrive.', confidence: 'D', place: 'farm', event: 'enight', sources: ['isthmus', 'schrc'] },
  { id: 'c10', title: 'Questioning', date: '17-19 Nov', text: 'Admission about Bernice Worden, then Mary Hogan.', confidence: '1S', place: 'courthouse', event: 'e1121', sources: ['spj'] },
  { id: 'c11', title: 'Test graves', date: '25 Nov', text: 'He describes grave visits; test graves opened at Plainfield Cemetery are empty.', confidence: '2S', place: 'cemetery', event: 'e1125', sources: ['spj'] },
]

export function placeById(id) {
  return PLACES.find((place) => place.id === id)
}

export function eventById(id) {
  return EVENTS.find((event) => event.id === id)
}

export function sourceById(id) {
  return SOURCES.find((source) => source.id === id)
}

// ---------- what is known when ----------
// The timeline's selected moment is the app's "now". Every item carries `known`: the first moment at which
// investigators (or the record) knew it. Where that differs from when a thing happened, the investigators'
// order wins: the 1947-52 grave visits are only known from his account in Nov 1957, so the cemetery mark
// waits for the test graves of 25 Nov. Disputed night events are all "that night". [SEC] items wait for the end.

// The last stop of the timeline: the whole case at once.
export const END = {
  id: 'end', date: '1940-1984', short: 'Whole case',
  text: 'The whole case on one map. Two women were killed: Mary Hogan, 1954, and Bernice Worden, 1957.',
  confidence: '2S', sources: ['wiki', 'gollmar'], scale: 'county', place: null, light: 'day',
}

export const MOMENTS = [...EVENTS.map((event) => event.id), END.id]

const FIRST_KNOWN = {
  place: {
    farm: 'e1940', pinegrove: 'e1954', store: 'e1957morning', westplainfield: 'enight', courthouse: 'e1121',
    cemetery: 'e1125', waupun: 'e1958a', mendota: 'e1984', spiritland: 'end', hancock: 'end',
  },
  victim: { hogan: 'e1954', worden: 'e1957morning' },
  person: {
    'Frank Worden': 'e1957morning', 'Arthur Schley': 'enight', 'Lloyd Schoephoester': 'enight', 'Allan Wilimovsky': 'enight',
    'Herbert Wanserski': 'e1954', 'Harold (Ed) Kroll': 'enight', 'Dr. Frederick Eigenberger': 'enight', 'Lester Hill': 'enight',
    'Judge Robert H. Gollmar': 'e1968', 'Dr. George D. Arndt': 'e1958a', 'Edward Gein': 'eslip',
  },
  // Quotes by the date they were said or printed: Arndt's preface is 1981, so it waits for 1984.
  quote: { horrible: 'enight', 'gruesome to even talk about': 'enight', haunted: 'e1121', 'apprehension, fear, panic': 'e1984' },
  clue: { c1: 'e1954', c2: 'e1954', c3: 'e0930', c4: 'e1700', c5: 'e1700', c6: 'eslip', c7: 'enight', c8: 'enight', c9: 'enight', c10: 'e1121', c11: 'e1125' },
}
for (const place of PLACES) place.known = FIRST_KNOWN.place[place.id]
for (const victim of VICTIMS) victim.known = FIRST_KNOWN.victim[victim.id]
for (const person of PEOPLE) person.known = FIRST_KNOWN.person[person.name]
for (const quote of QUOTES) quote.known = FIRST_KNOWN.quote[quote.key]
for (const clue of CLUES) clue.known = FIRST_KNOWN.clue[clue.id]
for (const event of EVENTS) event.known = event.id
// The sales slip is found in the evening; clicking it follows the lead out to the farm ("that night").
CLUES.find((clue) => clue.id === 'c6').event = 'eslip'

export function momentIndex(moment) {
  const index = MOMENTS.indexOf(moment ?? END.id)
  return index < 0 ? MOMENTS.length - 1 : index
}

// The one gate: is this item known at the selected moment? Items without `known` are always shown.
export function visibleAt(item, moment) {
  if (!item?.known) return true
  return momentIndex(item.known) <= momentIndex(moment)
}

// Some cards carry a later fact inside their text; those lines and role wordings wait for their moment too.
const LINE_KNOWN = {
  'House burned 20 Mar 1958, early morning, ten days before the auction.': 'e1958fire',
}
// A null wording means the full role from PEOPLE.
const ROLE_STAGES = {
  'Frank Worden': [
    ['e1957morning', "Bernice Worden's son, Waushara County deputy sheriff; out hunting."],
    ['e1700', null],
  ],
  'Edward Gein': [
    ['eslip', 'Plainfield farmer and handyman.'],
    ['enight', 'Plainfield farmer and handyman; arrested 16 Nov 1957.'],
    ['e1958a', 'Plainfield farmer and handyman; arrested 16 Nov 1957, committed.'],
    ['e1968', null],
  ],
}

export function placeLinesAt(place, moment) {
  return place.lines.filter((line) => visibleAt({ known: LINE_KNOWN[line] }, moment))
}

// The person's role as worded at the moment: the latest stage reached.
export function roleAt(person, moment) {
  const reached = (ROLE_STAGES[person.name] ?? []).filter(([known]) => visibleAt({ known }, moment))
  if (reached.length === 0) return person.role
  return reached.at(-1)[1] ?? person.role
}

export function momentById(moment) {
  return moment === END.id ? END : eventById(moment)
}

// The sources drawer lists the facts known at the moment, with their marks; built from the model so the two
// never drift. A source is listed once a visible fact cites it.
export function factRows(moment = END.id) {
  const rows = []
  for (const victim of VICTIMS) {
    rows.push({ known: victim.known, fact: `${victim.name}, ${victim.age}${victim.ageNote ? ` (${victim.ageNote})` : ''}: ${victim.job}; ${victim.date}`, confidence: victim.ageConfidence, sources: victim.sources })
  }
  for (const event of EVENTS) rows.push({ known: event.known, fact: `${event.date}${event.hourLabel && event.hourLabel !== 'morning' ? `, ${event.hourLabel}` : ''}: ${event.text}`, confidence: event.confidence, sources: event.sources })
  for (const place of PLACES) rows.push({ known: place.known, fact: `${place.name}: ${place.distance}`, confidence: place.confidence, sources: place.sources })
  return rows.filter((row) => visibleAt(row, moment))
}
