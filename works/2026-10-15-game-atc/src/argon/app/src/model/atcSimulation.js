// ============================================================================
// SKYVIGIL ATC — PLAIN DATA MODEL & REAL-TIME SEEDED SIMULATION ENGINE
// Drives both the 3D React Three Fiber world and the operational dashboard.
// ============================================================================

export const SITES = [
  {
    id: 'tower',
    code: 'KPSA · TWR',
    name: 'Port Solis Tower',
    subtitle: 'Aerodrome Control · RWY 09L/27R & 09R/27L · Surface & Final',
    sectorFreq: '118.700 MHz',
    weatherSummary: '260° / 11 kt · CAVOK · QNH 1016',
    cameraPos: [0, 74, 108],
    cameraTarget: [0, 4, -4],
    groundY: 1.61,
    grassY: 1.43,
    waterY: 0.40,
  },
  {
    id: 'approach',
    code: 'PSA · TMA',
    name: 'Solis Bay Approach',
    subtitle: 'Terminal Manoeuvring Area · Holding Stack KESTL · ILS Corridor',
    sectorFreq: '124.350 MHz',
    weatherSummary: 'CB Cell Drifting E · Reroutes Active · QNH 1015',
    cameraPos: [12, 86, 122],
    cameraTarget: [0, 8, 0],
    groundY: 1.13,
    grassY: 1.13,
    waterY: 0.40,
  },
  {
    id: 'enroute',
    code: 'SEC · NORTH',
    name: 'North Ridge En-Route',
    subtitle: 'Upper Airspace Control · FL240–FL410 · Jetways J-42 & UL-850',
    sectorFreq: '132.925 MHz',
    weatherSummary: 'Upper Winds 285° / 64 kt · Severe CB Supercell',
    cameraPos: [-10, 92, 126],
    cameraTarget: [0, 12, 0],
    groundY: 0.90,
    grassY: 0.90,
    waterY: 1.03,
  },
];

export const ARRIVAL_TIMELINE_STEPS = [
  { id: 'handoff', label: 'Sector Handoff', fix: 'NERON', targetAlt: 14000, timeOffsetMin: -18 },
  { id: 'descend', label: 'STAR Descent', fix: 'VEXOR', targetAlt: 9000, timeOffsetMin: -13 },
  { id: 'hold', label: 'Holding Stack', fix: 'KESTL', targetAlt: 7000, timeOffsetMin: -8 },
  { id: 'approach', label: 'ILS 09L Final', fix: 'SOLIS', targetAlt: 2500, timeOffsetMin: -4 },
  { id: 'land', label: 'Touchdown 09L', fix: 'RWY 09L', targetAlt: 20, timeOffsetMin: -1 },
  { id: 'vacate', label: 'Vacate & Gate', fix: 'TWY K1 · G2', targetAlt: 0, timeOffsetMin: 0 },
];

// Waypoints & Airway Fixes per site
export const SITE_WAYPOINTS = {
  tower: [
    { id: 'WP-SOLIS', code: 'SOLIS', name: 'Final Approach Fix 09L', pos: [-78, 1.43, -14], type: 'fix', freq: 'RNAV FAF', altConstraint: '2500 ft' },
    { id: 'WP-KESTL', code: 'KESTL', name: 'Outer Terminal Hold', pos: [-84, 1.43, 38], type: 'hold', freq: 'HOLD FL070', altConstraint: '7000 ft' },
    { id: 'WP-VEXOR', code: 'VEXOR', name: 'East Climb Gate', pos: [82, 1.43, -24], type: 'fix', freq: 'SID GATE', altConstraint: '6000 ft' },
    { id: 'WP-BAYLI', code: 'BAYLI', name: 'South Bay Departure Fix', pos: [68, 0.40, 56], type: 'fix', freq: 'RNAV SID', altConstraint: '5000 ft' },
    { id: 'NAV-ASR1', code: 'ASR-11', name: 'Port Solis Primary Radar', pos: [42, 1.61, -36], type: 'radar', freq: '2820 MHz', altConstraint: 'SFC–FL240' },
    { id: 'NAV-TWR', code: 'KPSA-TWR', name: 'Port Solis Control Tower', pos: [-36, 11.0, -40], type: 'tower', freq: '118.700 MHz', altConstraint: 'CAB 138 ft' },
  ],
  approach: [
    { id: 'WP-KESTL-A', code: 'KESTL', name: 'Primary Holding Stack', pos: [-38, 1.13, -18], type: 'hold', freq: 'HOLD FL070–090', altConstraint: '7000–9000 ft' },
    { id: 'WP-NERON', code: 'NERON', name: 'North Arrival Gate', pos: [-58, 1.13, -54], type: 'fix', freq: 'STAR ENTRY', altConstraint: '14000 ft' },
    { id: 'WP-VEXOR-A', code: 'VEXOR', name: 'Downwind Transition Fix', pos: [-8, 1.13, -46], type: 'fix', freq: 'RNAV TRANS', altConstraint: '9000 ft' },
    { id: 'WP-SOLIS-A', code: 'SOLIS', name: 'ILS 09L Intercept Gate', pos: [14, 1.13, 18], type: 'fix', freq: 'ILS 109.90', altConstraint: '3000 ft' },
    { id: 'WP-BAYLI-A', code: 'BAYLI', name: 'Coastal Departure Fix', pos: [58, 1.13, -26], type: 'fix', freq: 'SID CLIMB', altConstraint: '11000 ft' },
    { id: 'WP-MARIN', code: 'MARIN', name: 'Estuary Feeder Fix', pos: [52, 1.13, 44], type: 'fix', freq: 'STAR SOUTH', altConstraint: '8000 ft' },
    { id: 'NAV-VOR-A', code: 'PSA-VOR', name: 'Solis Bay Doppler VOR/DME', pos: [-26, 1.13, 32], type: 'vor', freq: '115.40 MHz', altConstraint: 'CH 101X' },
    { id: 'NAV-ASR-A', code: 'TMA-ASR', name: 'Approach Surveillance Radar', pos: [38, 1.13, -4], type: 'radar', freq: '2785 MHz', altConstraint: '60 NM RNG' },
  ],
  enroute: [
    { id: 'WP-CREST', code: 'CREST', name: 'Highland Jetway Intersection', pos: [-56, 0.90, -42], type: 'fix', freq: 'JETWAY J-42', altConstraint: 'FL320+' },
    { id: 'WP-PALMA', code: 'PALMA', name: 'Central Sector Pivot Fix', pos: [-4, 0.90, -10], type: 'fix', freq: 'JETWAY J-42/Q-18', altConstraint: 'FL300+' },
    { id: 'WP-ZENIT', code: 'ZENIT', name: 'Eastbound Exit Gate', pos: [62, 0.90, 26], type: 'fix', freq: 'JETWAY J-42', altConstraint: 'FL340+' },
    { id: 'WP-KORVA', code: 'KORVA', name: 'Northbound Upper Fix', pos: [48, 0.90, -48], type: 'fix', freq: 'UPPER UL-850', altConstraint: 'FL360+' },
    { id: 'WP-LAKES', code: 'LAKES', name: 'Valley Holding Waypoint', pos: [-42, 0.90, 36], type: 'hold', freq: 'HIGH HOLD', altConstraint: 'FL260' },
    { id: 'NAV-ARSR', code: 'ARSR-4', name: 'North Ridge Long-Range Radome', pos: [36, 8.20, 28], type: 'radome', freq: '1310 MHz', altConstraint: '250 NM RNG' },
  ],
};

// Airway / Approach / Departure Lines drawn on the 3D terrain map per site
export const SITE_AIRWAY_LINES = {
  tower: [
    {
      id: 'ILS-09L',
      label: 'ILS RWY 09L Approach',
      color: '#1d5bff',
      points: [
        [-96, 16.0, -14],
        [-78, 11.5, -14],
        [-48, 5.2, -14],
        [-22, 1.9, -14],
        [42, 1.9, -14],
      ],
    },
    {
      id: 'SID-09L',
      label: 'SOLIS 2A Standard Departure',
      color: '#0891b2',
      points: [
        [-10, 1.9, -14],
        [48, 4.5, -14],
        [82, 15.0, -24],
        [98, 22.0, -44],
      ],
    },
    {
      id: 'SID-09R',
      label: 'BAYLI 4B Coastal Departure',
      color: '#10b981',
      points: [
        [-18, 1.9, 10],
        [38, 4.0, 10],
        [68, 13.5, 56],
        [92, 20.0, 74],
      ],
    },
  ],
  approach: [
    {
      id: 'STAR-NERON',
      label: 'NERON 3A Arrival & Hold',
      color: '#1d5bff',
      points: [
        [-84, 28.0, -72],
        [-58, 23.0, -54],
        [-38, 16.5, -18],
        [-8, 13.5, -46],
        [14, 8.5, 18],
        [72, 3.2, 18],
      ],
    },
    {
      id: 'STAR-MARIN',
      label: 'MARIN 1B South Feeder',
      color: '#0891b2',
      points: [
        [78, 22.0, 68],
        [52, 16.0, 44],
        [14, 8.5, 18],
        [72, 3.2, 18],
      ],
    },
    {
      id: 'SID-BAYLI-TMA',
      label: 'BAYLI Climb Corridor',
      color: '#10b981',
      points: [
        [68, 4.5, 6],
        [58, 18.0, -26],
        [24, 27.0, -68],
      ],
    },
  ],
  enroute: [
    {
      id: 'JETWAY-J42',
      label: 'Jetway J-42 West–East Trunk',
      color: '#1d5bff',
      points: [
        [-86, 26.0, -58],
        [-56, 26.0, -42],
        [-4, 26.0, -10],
        [62, 26.0, 26],
        [88, 26.0, 40],
      ],
    },
    {
      id: 'JETWAY-UL850',
      label: 'Upper Airway UL-850 SW–NE',
      color: '#0891b2',
      points: [
        [-78, 31.0, 56],
        [-42, 31.0, 36],
        [-4, 31.0, -10],
        [48, 31.0, -48],
        [82, 31.0, -72],
      ],
    },
    {
      id: 'JETWAY-Q18',
      label: 'Highland Crossway Q-18',
      color: '#f59e0b',
      points: [
        [-18, 22.0, -76],
        [-4, 22.0, -10],
        [18, 22.0, 68],
      ],
    },
  ],
};

// Initial Flights & Ground Units across all 3 sites
export function createInitialSimulationState() {
  const weatherCells = {
    tower: [
      {
        id: 'WX-TWR-1',
        callsign: 'WX-CELL-01',
        name: 'Offshore Cumulus Line',
        variant: 'Weather_Cell_Moderate',
        site: 'tower',
        category: 'weather',
        status: 'Advisory',
        phase: 'Drifting NE · 14 kt',
        pos: [-64, 14.0, 58],
        basePos: [-64, 14.0, 58],
        driftAmp: [12, 8],
        driftFreq: 0.09,
        radius: 14,
        intensity: 'Moderate Rain · Tops FL180',
        progress: 42,
      },
    ],
    approach: [
      {
        id: 'WX-TMA-CB',
        callsign: 'SIGMET-CB4',
        name: 'Convective Storm Cell Echo-4',
        variant: 'Weather_Cell_CB_Heavy',
        site: 'approach',
        category: 'weather',
        status: 'Warning',
        phase: 'Drifting E · Tops FL380',
        pos: [-2, 11.5, -22],
        basePos: [-2, 11.5, -22],
        driftAmp: [18, 10],
        driftFreq: 0.14,
        radius: 17.5,
        intensity: 'Heavy Precip + Lightning · Reroute Active',
        progress: 78,
      },
      {
        id: 'WX-TMA-MOD',
        callsign: 'WX-ECHO-2',
        name: 'Outflow Squall Cell',
        variant: 'Weather_Cell_Moderate',
        site: 'approach',
        category: 'weather',
        status: 'Advisory',
        phase: 'Developing · 18 kt',
        pos: [22, 10.0, -34],
        basePos: [22, 10.0, -34],
        driftAmp: [10, 8],
        driftFreq: 0.12,
        radius: 11,
        intensity: 'Moderate Turbulence · Tops FL240',
        progress: 54,
      },
    ],
    enroute: [
      {
        id: 'WX-ENR-CB',
        callsign: 'SIGMET-N1',
        name: 'Supercell Thunderhead Bravo',
        variant: 'Weather_Cell_CB_Heavy',
        site: 'enroute',
        category: 'weather',
        status: 'Conflict',
        phase: 'Severe CB · Tops FL410',
        pos: [6, 15.5, -8],
        basePos: [6, 15.5, -8],
        driftAmp: [16, 12],
        driftFreq: 0.13,
        radius: 19.0,
        intensity: 'Extreme Hail & Lightning · Mandatory Deviation',
        progress: 88,
      },
    ],
  };

  const flights = [
    // ======================== SITE 1: PORT SOLIS TOWER ========================
    {
      id: 'FLT-AZR402',
      callsign: 'AZR-402',
      airline: 'Azura Air',
      aircraftType: 'A320N Narrowbody',
      family: 'aircraft_jets',
      variant: 'Jet_Narrowbody_Azura',
      site: 'tower',
      category: 'flight',
      role: 'Arrival · ILS RWY 09L',
      phase: 'Final Approach',
      status: 'Approach',
      altitude: 1850,
      clearedLevel: 0,
      speed: 148,
      heading: 90,
      verticalRate: -720,
      nextWaypoint: 'RWY 09L',
      assignedRunway: 'RWY 09L/27R',
      routeType: 'tower_arrival_09L',
      t: 0.28,
      speedFactor: 0.036,
      manualAltOffset: 0,
      manualHdgOffset: 0,
      holding: false,
      sepStatus: 'Nominal',
      minSepNm: 5.8,
      timelineIdx: 3,
      history: [],
    },
    {
      id: 'FLT-SLS118',
      callsign: 'SLS-118',
      airline: 'Solstice Airways',
      aircraftType: 'B738 Narrowbody',
      family: 'aircraft_jets',
      variant: 'Jet_Narrowbody_Solstice',
      site: 'tower',
      category: 'flight',
      role: 'Departure · SOLIS 2A SID',
      phase: 'Initial Climb',
      status: 'Climbing',
      altitude: 3400,
      clearedLevel: 12000,
      speed: 215,
      heading: 78,
      verticalRate: 2100,
      nextWaypoint: 'VEXOR',
      assignedRunway: 'RWY 09L/27R',
      routeType: 'tower_departure_09L',
      t: 0.52,
      speedFactor: 0.042,
      manualAltOffset: 0,
      manualHdgOffset: 0,
      holding: false,
      sepStatus: 'Nominal',
      minSepNm: 6.4,
      timelineIdx: 5,
      history: [],
    },
    {
      id: 'FLT-MRD801',
      callsign: 'MRD-801',
      airline: 'Meridian Heavy',
      aircraftType: 'A359 Widebody Heavy',
      family: 'aircraft_jets',
      variant: 'Jet_Widebody_Meridian',
      site: 'tower',
      category: 'flight',
      role: 'Heavy Departure · BAYLI 4B',
      phase: 'Takeoff Roll & Climb',
      status: 'Climbing',
      altitude: 1200,
      clearedLevel: 16000,
      speed: 192,
      heading: 105,
      verticalRate: 1850,
      nextWaypoint: 'BAYLI',
      assignedRunway: 'RWY 09R/27L',
      routeType: 'tower_departure_09R',
      t: 0.18,
      speedFactor: 0.034,
      manualAltOffset: 0,
      manualHdgOffset: 0,
      holding: false,
      sepStatus: 'Nominal',
      minSepNm: 5.2,
      timelineIdx: 5,
      history: [],
    },
    {
      id: 'FLT-SKW209',
      callsign: 'SKW-209',
      airline: 'Skyward Regional',
      aircraftType: 'DH8D Twin Turboprop',
      family: 'aircraft_turboprops',
      variant: 'Turboprop_Commuter_A',
      site: 'tower',
      category: 'flight',
      role: 'Arrival · Downwind 09R',
      phase: 'Base Leg Turn',
      status: 'Approach',
      altitude: 2900,
      clearedLevel: 1500,
      speed: 162,
      heading: 145,
      verticalRate: -650,
      nextWaypoint: 'SOLIS',
      assignedRunway: 'RWY 09R/27L',
      routeType: 'tower_circuit_north',
      t: 0.64,
      speedFactor: 0.035,
      manualAltOffset: 0,
      manualHdgOffset: 0,
      holding: false,
      sepStatus: 'Nominal',
      minSepNm: 4.9,
      timelineIdx: 2,
      history: [],
    },
    {
      id: 'FLT-VLC550',
      callsign: 'VLC-550',
      airline: 'Veloce Express',
      aircraftType: 'CRJ9 Regional Jet',
      family: 'aircraft_jets',
      variant: 'Jet_Regional_Veloce',
      site: 'tower',
      category: 'flight',
      role: 'Gate Turnaround · Gate G1',
      phase: 'Boarding at Gate G1',
      status: 'OnGround',
      altitude: 0,
      clearedLevel: 10000,
      speed: 0,
      heading: 180,
      verticalRate: 0,
      nextWaypoint: 'TWY A',
      assignedRunway: 'GATE G1',
      routeType: 'tower_gate_g1',
      t: 0.0,
      speedFactor: 0.0,
      manualAltOffset: 0,
      manualHdgOffset: 0,
      holding: false,
      sepStatus: 'Nominal',
      minSepNm: 8.5,
      timelineIdx: 5,
      history: [],
    },
    {
      id: 'FLT-AFR712',
      callsign: 'AFR-712',
      airline: 'AeroFreight Cargo',
      aircraftType: 'AT76 Cargo Feeder',
      family: 'aircraft_turboprops',
      variant: 'Turboprop_Cargo_Feeder',
      site: 'tower',
      category: 'flight',
      role: 'Active Taxi · TWY Alpha',
      phase: 'Taxiing to RWY 09R',
      status: 'OnGround',
      altitude: 0,
      clearedLevel: 8000,
      speed: 18,
      heading: 270,
      verticalRate: 0,
      nextWaypoint: 'HOLD 09R',
      assignedRunway: 'TWY ALPHA',
      routeType: 'tower_taxi_loop',
      t: 0.35,
      speedFactor: 0.025,
      manualAltOffset: 0,
      manualHdgOffset: 0,
      holding: false,
      sepStatus: 'Nominal',
      minSepNm: 7.2,
      timelineIdx: 5,
      history: [],
    },

    // ======================== SITE 2: SOLIS BAY APPROACH ========================
    {
      id: 'FLT-AZR402-A',
      callsign: 'AZR-402',
      airline: 'Azura Air',
      aircraftType: 'A320N Narrowbody',
      family: 'aircraft_jets',
      variant: 'Jet_Narrowbody_Azura',
      site: 'approach',
      category: 'flight',
      role: 'Arrival · STAR NERON 3A',
      phase: 'Descending to ILS',
      status: 'Approach',
      altitude: 6800,
      clearedLevel: 3000,
      speed: 220,
      heading: 118,
      verticalRate: -1150,
      nextWaypoint: 'SOLIS',
      assignedRunway: 'ILS RWY 09L',
      routeType: 'tma_star_main',
      t: 0.42,
      speedFactor: 0.032,
      manualAltOffset: 0,
      manualHdgOffset: 0,
      holding: false,
      sepStatus: 'Nominal',
      minSepNm: 4.6,
      timelineIdx: 2,
      history: [],
    },
    {
      id: 'FLT-MRD904',
      callsign: 'MRD-904',
      airline: 'Meridian Heavy',
      aircraftType: 'A359 Widebody Heavy',
      family: 'aircraft_jets',
      variant: 'Jet_Widebody_Meridian',
      site: 'approach',
      category: 'flight',
      role: 'Arrival · Holding Stack KESTL',
      phase: 'Holding FL080 at KESTL',
      status: 'Caution',
      altitude: 8000,
      clearedLevel: 7000,
      speed: 210,
      heading: 270,
      verticalRate: -400,
      nextWaypoint: 'KESTL',
      assignedRunway: 'HOLD KESTL',
      routeType: 'tma_hold_kestl',
      t: 0.15,
      speedFactor: 0.045,
      manualAltOffset: 0,
      manualHdgOffset: 0,
      holding: true,
      sepStatus: 'Amber',
      minSepNm: 3.4,
      timelineIdx: 2,
      history: [],
    },
    {
      id: 'FLT-SLS331',
      callsign: 'SLS-331',
      airline: 'Solstice Airways',
      aircraftType: 'B738 Narrowbody',
      family: 'aircraft_jets',
      variant: 'Jet_Narrowbody_Solstice',
      site: 'approach',
      category: 'flight',
      role: 'Arrival · Weather Reroute',
      phase: 'Rerouting S of CB Cell',
      status: 'Caution',
      altitude: 8400,
      clearedLevel: 6000,
      speed: 235,
      heading: 132,
      verticalRate: -900,
      nextWaypoint: 'VEXOR',
      assignedRunway: 'ILS RWY 09L',
      routeType: 'tma_wx_reroute',
      t: 0.30,
      speedFactor: 0.034,
      manualAltOffset: 0,
      manualHdgOffset: 0,
      holding: false,
      sepStatus: 'Amber',
      minSepNm: 3.6,
      timelineIdx: 1,
      history: [],
    },
    {
      id: 'FLT-ARC605',
      callsign: 'ARC-605',
      airline: 'Archipelago Air',
      aircraftType: 'DH8D Island Commuter',
      family: 'aircraft_turboprops',
      variant: 'Turboprop_Commuter_B',
      site: 'approach',
      category: 'flight',
      role: 'Arrival · MARIN 1B Feeder',
      phase: 'Estuary Approach',
      status: 'Approach',
      altitude: 5400,
      clearedLevel: 3000,
      speed: 185,
      heading: 310,
      verticalRate: -800,
      nextWaypoint: 'SOLIS',
      assignedRunway: 'ILS RWY 09R',
      routeType: 'tma_south_feeder',
      t: 0.48,
      speedFactor: 0.036,
      manualAltOffset: 0,
      manualHdgOffset: 0,
      holding: false,
      sepStatus: 'Nominal',
      minSepNm: 5.4,
      timelineIdx: 3,
      history: [],
    },
    {
      id: 'FLT-VLC214',
      callsign: 'VLC-214',
      airline: 'Veloce Express',
      aircraftType: 'CRJ9 Regional Jet',
      family: 'aircraft_jets',
      variant: 'Jet_Regional_Veloce',
      site: 'approach',
      category: 'flight',
      role: 'Departure · BAYLI 4B Climb',
      phase: 'Climbing out via BAYLI',
      status: 'Climbing',
      altitude: 10500,
      clearedLevel: 18000,
      speed: 268,
      heading: 340,
      verticalRate: 2200,
      nextWaypoint: 'BAYLI',
      assignedRunway: 'DEP RWY 09L',
      routeType: 'tma_departure_climb',
      t: 0.25,
      speedFactor: 0.038,
      manualAltOffset: 0,
      manualHdgOffset: 0,
      holding: false,
      sepStatus: 'Nominal',
      minSepNm: 6.1,
      timelineIdx: 0,
      history: [],
    },
    {
      id: 'FLT-CLB01',
      callsign: 'CLB-01',
      airline: 'Calibra Flight Check',
      aircraftType: 'BE20 Navaid Calibration',
      family: 'aircraft_turboprops',
      variant: 'Turboprop_Utility_Twin',
      site: 'approach',
      category: 'flight',
      role: 'VOR/ILS Calibration Orbit',
      phase: 'Calibrating PSA-VOR',
      status: 'Normal',
      altitude: 4500,
      clearedLevel: 4500,
      speed: 170,
      heading: 45,
      verticalRate: 0,
      nextWaypoint: 'PSA-VOR',
      assignedRunway: 'ORBIT VOR',
      routeType: 'tma_calib_orbit',
      t: 0.60,
      speedFactor: 0.040,
      manualAltOffset: 0,
      manualHdgOffset: 0,
      holding: false,
      sepStatus: 'Nominal',
      minSepNm: 6.8,
      timelineIdx: 1,
      history: [],
    },

    // ======================== SITE 3: NORTH RIDGE EN-ROUTE ========================
    {
      id: 'FLT-MRD102',
      callsign: 'MRD-102',
      airline: 'Meridian Heavy',
      aircraftType: 'A359 Widebody Heavy',
      family: 'aircraft_jets',
      variant: 'Jet_Widebody_Meridian',
      site: 'enroute',
      category: 'flight',
      role: 'En-Route · Jetway J-42 East',
      phase: 'Cruise FL350 · Weather Dev',
      status: 'Normal',
      altitude: 35000,
      clearedLevel: 35000,
      speed: 482,
      heading: 112,
      verticalRate: 0,
      nextWaypoint: 'ZENIT',
      assignedRunway: 'JETWAY J-42',
      routeType: 'enroute_j42_east',
      t: 0.32,
      speedFactor: 0.032,
      manualAltOffset: 0,
      manualHdgOffset: 0,
      holding: false,
      sepStatus: 'Nominal',
      minSepNm: 5.5,
      timelineIdx: 0,
      history: [],
    },
    {
      id: 'FLT-AZR770',
      callsign: 'AZR-770',
      airline: 'Azura Air',
      aircraftType: 'A320N Narrowbody',
      family: 'aircraft_jets',
      variant: 'Jet_Narrowbody_Azura',
      site: 'enroute',
      category: 'flight',
      role: 'En-Route · Upper UL-850 NE',
      phase: 'Cruise FL340 · Crossing',
      status: 'Caution',
      altitude: 34000,
      clearedLevel: 36000,
      speed: 458,
      heading: 52,
      verticalRate: 1200,
      nextWaypoint: 'KORVA',
      assignedRunway: 'UPPER UL-850',
      routeType: 'enroute_ul850_ne',
      t: 0.36,
      speedFactor: 0.034,
      manualAltOffset: 0,
      manualHdgOffset: 0,
      holding: false,
      sepStatus: 'Amber',
      minSepNm: 3.8,
      timelineIdx: 0,
      history: [],
    },
    {
      id: 'FLT-SLS840',
      callsign: 'SLS-840',
      airline: 'Solstice Airways',
      aircraftType: 'B738 Narrowbody',
      family: 'aircraft_jets',
      variant: 'Jet_Narrowbody_Solstice',
      site: 'enroute',
      category: 'flight',
      role: 'En-Route · Highland Q-18 South',
      phase: 'Descent Entry FL290',
      status: 'Normal',
      altitude: 29000,
      clearedLevel: 24000,
      speed: 440,
      heading: 168,
      verticalRate: -1400,
      nextWaypoint: 'PALMA',
      assignedRunway: 'AIRWAY Q-18',
      routeType: 'enroute_q18_south',
      t: 0.50,
      speedFactor: 0.033,
      manualAltOffset: 0,
      manualHdgOffset: 0,
      holding: false,
      sepStatus: 'Nominal',
      minSepNm: 6.2,
      timelineIdx: 1,
      history: [],
    },
    {
      id: 'FLT-VLC912',
      callsign: 'VLC-912',
      airline: 'Veloce Express',
      aircraftType: 'CRJ9 Regional Jet',
      family: 'aircraft_jets',
      variant: 'Jet_Regional_Veloce',
      site: 'enroute',
      category: 'flight',
      role: 'En-Route · Jetway J-42 West',
      phase: 'Cruise FL320',
      status: 'Normal',
      altitude: 32000,
      clearedLevel: 32000,
      speed: 446,
      heading: 292,
      verticalRate: 0,
      nextWaypoint: 'CREST',
      assignedRunway: 'JETWAY J-42',
      routeType: 'enroute_j42_west',
      t: 0.68,
      speedFactor: 0.035,
      manualAltOffset: 0,
      manualHdgOffset: 0,
      holding: false,
      sepStatus: 'Nominal',
      minSepNm: 7.4,
      timelineIdx: 0,
      history: [],
    },
    {
      id: 'FLT-AFR505',
      callsign: 'AFR-505',
      airline: 'AeroFreight Cargo',
      aircraftType: 'AT76 Regional Freighter',
      family: 'aircraft_turboprops',
      variant: 'Turboprop_Cargo_Feeder',
      site: 'enroute',
      category: 'flight',
      role: 'En-Route · Valley Hold LAKES',
      phase: 'Holding FL240 at LAKES',
      status: 'Caution',
      altitude: 24000,
      clearedLevel: 22000,
      speed: 248,
      heading: 90,
      verticalRate: 0,
      nextWaypoint: 'LAKES',
      assignedRunway: 'HOLD LAKES',
      routeType: 'enroute_hold_lakes',
      t: 0.22,
      speedFactor: 0.042,
      manualAltOffset: 0,
      manualHdgOffset: 0,
      holding: true,
      sepStatus: 'Nominal',
      minSepNm: 8.1,
      timelineIdx: 2,
      history: [],
    },
  ];

  // Ground Support Vehicles & Maritime Vessels (active & selectable!)
  const groundUnits = [
    {
      id: 'GSE-TUG-01',
      callsign: 'TUG-01',
      name: 'Heavy Pushback Tractor #1',
      family: 'ground_vehicles',
      variant: 'Vehicle_Pushback_Tug',
      site: 'tower',
      category: 'ground',
      role: 'Gate G1 Pushback Crew',
      phase: 'Coupled to VLC-550 Nosegear',
      status: 'Normal',
      speed: 6,
      heading: 0,
      assignedZone: 'Apron Gate G1',
      progress: 68,
      pathType: 'apron_tug_g1',
      t: 0.2,
      speedFactor: 0.05,
    },
    {
      id: 'GSE-FUEL-04',
      callsign: 'FUEL-04',
      name: 'Jet-A1 Hydrant Tanker #4',
      family: 'ground_vehicles',
      variant: 'Vehicle_Fuel_Tanker',
      site: 'tower',
      category: 'ground',
      role: 'Apron Refueling Service',
      phase: 'Refueling Boom Raised · Gate G2',
      status: 'Approach',
      speed: 14,
      heading: 90,
      assignedZone: 'Apron Service Road',
      progress: 82,
      pathType: 'apron_service_loop',
      t: 0.15,
      speedFactor: 0.032,
    },
    {
      id: 'GSE-CAT-02',
      callsign: 'CAT-02',
      name: 'High-Lift Galley Catering #2',
      family: 'ground_vehicles',
      variant: 'Vehicle_Catering_HiLift',
      site: 'tower',
      category: 'ground',
      role: 'Cabin Galley Uplift',
      phase: 'Scissor Lift Elevated · Gate G1',
      status: 'Normal',
      speed: 0,
      heading: 180,
      assignedZone: 'Apron Gate G1',
      progress: 74,
      pathType: 'static_gate_g1',
      t: 0.0,
      speedFactor: 0.0,
    },
    {
      id: 'GSE-BAG-07',
      callsign: 'BAG-07',
      name: 'Electric Baggage Train #7',
      family: 'ground_vehicles',
      variant: 'Vehicle_Baggage_Tractor_Carts',
      site: 'tower',
      category: 'ground',
      role: 'ULD Container Transfer',
      phase: 'Hauling 2 ULDs to Terminal',
      status: 'Normal',
      speed: 16,
      heading: 270,
      assignedZone: 'Apron West Loop',
      progress: 55,
      pathType: 'apron_baggage_loop',
      t: 0.55,
      speedFactor: 0.038,
    },
    {
      id: 'GSE-FME-01',
      callsign: 'FOLLOW-01',
      name: 'Follow-Me Marshalling Van #1',
      family: 'ground_vehicles',
      variant: 'Vehicle_FollowMe_Van',
      site: 'tower',
      category: 'ground',
      role: 'Apron Taxi Escort',
      phase: 'LED Matrix Active · TWY Bravo',
      status: 'Climbing',
      speed: 22,
      heading: 90,
      assignedZone: 'Taxiway Bravo',
      progress: 91,
      pathType: 'taxiway_escort_loop',
      t: 0.42,
      speedFactor: 0.035,
    },
    {
      id: 'GSE-ARFF-09',
      callsign: 'RED-9',
      name: 'Striker 6x6 Crash Tender #9',
      family: 'ground_vehicles',
      variant: 'Vehicle_ARFF_CrashTender',
      site: 'tower',
      category: 'ground',
      role: 'Runway Standby Patrol',
      phase: 'Standby at ARFF Station',
      status: 'Normal',
      speed: 19,
      heading: 180,
      assignedZone: 'ARFF Rapid Access',
      progress: 100,
      pathType: 'arff_patrol_loop',
      t: 0.1,
      speedFactor: 0.028,
    },
  ];

  // Initial recent ATC events
  const events = [
    { id: 'EV-1', time: '09:42:18', code: 'AZR-402', status: 'Approach', text: 'Cleared ILS RWY 09L approach, wind 260/11 kt' },
    { id: 'EV-2', time: '09:41:54', code: 'SLS-331', status: 'Caution', text: 'Deviating 12 NM south of SIGMET-CB4 storm core' },
    { id: 'EV-3', time: '09:41:20', code: 'MRD-904', status: 'Caution', text: 'Entered holding stack KESTL at FL080, expect approach 09:48' },
    { id: 'EV-4', time: '09:40:45', code: 'SLS-118', status: 'Climbing', text: 'Airborne RWY 09L, climbing FL120 via SOLIS 2A' },
    { id: 'EV-5', time: '09:40:12', code: 'AZR-770', status: 'Caution', text: 'Traffic alert with MRD-102 near PALMA, climbing FL360' },
  ];

  const state = {
    simTimeSec: 0,
    clockMs: Date.UTC(2026, 9, 16, 9, 42, 30),
    flights,
    groundUnits,
    weatherCells,
    events,
    kpis: {
      aircraftInSector: 6,
      arrivalsPerHour: 34,
      avgDelayMin: 2.4,
      minSeparationNm: 3.4,
      runway09LOccupied: true,
      runway09ROccupied: true,
    },
  };

  // Run one initial tick so all 3D positions and contrail histories are populated immediately
  advanceSimulation(state, 0.033, true);
  return state;
}

// ============================================================================
// PARAMETRIC 3D FLIGHT & GROUND PATH EVALUATORS
// ============================================================================

function evalFlightRoute(f, t, wxList) {
  const u = ((t % 1) + 1) % 1;
  let x = 0;
  let y = 12;
  let z = 0;
  let altFt = f.altitude;
  let phase = f.phase;
  let status = f.status;
  let timelineIdx = f.timelineIdx;

  if (f.holding) {
    // Racetrack holding orbit around current or fix position
    const ang = u * Math.PI * 2;
    const cx = f.site === 'tower' ? -72 : f.site === 'approach' ? -38 : -42;
    const cz = f.site === 'tower' ? 32 : f.site === 'approach' ? -18 : 36;
    const baseY = f.site === 'enroute' ? 21.0 : 16.5;
    x = cx + Math.cos(ang) * 14.0;
    z = cz + Math.sin(ang) * 7.5;
    y = baseY + f.manualAltOffset * 0.002;
    altFt = Math.round((f.site === 'enroute' ? 24000 : 7500) + f.manualAltOffset);
    phase = 'Holding Pattern Orbit';
    status = 'Caution';
    return { x, y, z, altFt, phase, status, timelineIdx: 2 };
  }

  switch (f.routeType) {
    case 'tower_arrival_09L': {
      // Final approach from West (-92, -14) -> Touchdown (-22, -14) -> Rollout (28, -14) -> High-speed exit K1 (40, -22)
      if (u < 0.58) {
        const p = u / 0.58;
        x = -94 + p * 72; // -94 -> -22
        z = -14;
        y = 18.5 * (1 - p) + 1.95 * p;
        altFt = Math.round(2800 * (1 - p) + 20);
        phase = p < 0.75 ? 'ILS 09L Final Approach' : 'Short Final · Over Threshold';
        status = 'Approach';
        timelineIdx = p < 0.85 ? 3 : 4;
      } else if (u < 0.82) {
        const p = (u - 0.58) / 0.24;
        x = -22 + p * 50; // -22 -> +28 rollout on RWY 09L
        z = -14;
        y = 1.92;
        altFt = 0;
        phase = 'Landing Rollout RWY 09L';
        status = 'OnGround';
        timelineIdx = 4;
      } else {
        const p = (u - 0.82) / 0.18;
        x = 28 + p * 14;
        z = -14 - p * 10; // Vacate onto rapid exit taxiway toward apron
        y = 1.92;
        altFt = 0;
        phase = 'Vacating via TWY K1 to Gate G2';
        status = 'OnGround';
        timelineIdx = 5;
      }
      break;
    }

    case 'tower_departure_09L': {
      // Takeoff roll on RWY 09L (-38 -> +15) then climb out East-Northeast toward VEXOR
      if (u < 0.30) {
        const p = u / 0.30;
        x = -38 + p * 52;
        z = -14;
        y = 1.92;
        altFt = 0;
        phase = 'Takeoff Roll RWY 09L';
        status = 'OnGround';
      } else {
        const p = (u - 0.30) / 0.70;
        x = 14 + p * 82;
        z = -14 - Math.pow(p, 1.3) * 32;
        y = 1.92 + Math.pow(p, 1.15) * 21.5;
        altFt = Math.round(400 + p * 9800);
        phase = 'SID Climb · SOLIS 2A';
        status = 'Climbing';
      }
      break;
    }

    case 'tower_departure_09R': {
      // Secondary parallel runway RWY 09R (z = +10) takeoff & right turnout over bay
      if (u < 0.32) {
        const p = u / 0.32;
        x = -34 + p * 48;
        z = 10;
        y = 1.92;
        altFt = 0;
        phase = 'Takeoff Roll RWY 09R';
        status = 'OnGround';
      } else {
        const p = (u - 0.32) / 0.68;
        x = 14 + p * 74;
        z = 10 + Math.pow(p, 1.25) * 58;
        y = 1.92 + Math.pow(p, 1.1) * 19.5;
        altFt = Math.round(500 + p * 11200);
        phase = 'SID Climb · BAYLI 4B';
        status = 'Climbing';
      }
      break;
    }

    case 'tower_circuit_north': {
      // Downwind & Base leg approach to RWY 09R
      const ang = u * Math.PI * 2;
      x = -18 + Math.cos(ang) * 58;
      z = 38 + Math.sin(ang) * 24;
      y = 11.5 + Math.sin(ang) * 3.5;
      altFt = Math.round(2600 + Math.sin(ang) * 800);
      phase = Math.sin(ang) > 0 ? 'Downwind Leg RWY 09R' : 'Base Turn to Final';
      status = 'Approach';
      timelineIdx = 2;
      break;
    }

    case 'tower_gate_g1': {
      // Parked at Terminal Gate G1
      x = -16;
      z = -24.5;
      y = 1.92;
      altFt = 0;
      phase = 'Turnaround · Gate G1';
      status = 'OnGround';
      break;
    }

    case 'tower_taxi_loop': {
      // Taxiing along parallel Taxiway Alpha (z = -2) between apron and holding point 09L
      const ping = u < 0.5 ? u * 2 : (1 - u) * 2;
      x = 32 - ping * 68;
      z = -2.2;
      y = 1.90;
      altFt = 0;
      phase = u < 0.5 ? 'Taxiing West on TWY Alpha' : 'Returning to Cargo Apron';
      status = 'OnGround';
      break;
    }

    // ======================== APPROACH (TMA) ROUTES ========================
    case 'tma_star_main': {
      // Full arrival progression: Handoff (NERON) -> Descend (VEXOR) -> Hold (KESTL) -> Approach (SOLIS) -> Land
      x = -76 + u * 148;
      z = -56 + Math.sin(u * Math.PI * 1.4) * 38 + u * 52;
      y = 26.0 * (1 - u * 0.82) + 3.2;
      altFt = Math.round(13800 * (1 - u * 0.82) + 1200);
      if (u < 0.20) {
        phase = 'Sector Handoff at NERON';
        status = 'Normal';
        timelineIdx = 0;
      } else if (u < 0.42) {
        phase = 'STAR Descent via VEXOR';
        status = 'Climbing';
        timelineIdx = 1;
      } else if (u < 0.64) {
        phase = 'Passing Hold Stack KESTL';
        status = 'Caution';
        timelineIdx = 2;
      } else if (u < 0.86) {
        phase = 'Established ILS 09L at SOLIS';
        status = 'Approach';
        timelineIdx = 3;
      } else {
        phase = 'Short Final Handoff to Tower';
        status = 'Approach';
        timelineIdx = 4;
      }
      break;
    }

    case 'tma_hold_kestl': {
      const ang = u * Math.PI * 2;
      x = -38 + Math.cos(ang) * 12.5;
      z = -18 + Math.sin(ang) * 6.5;
      y = 16.5 + Math.cos(ang * 2) * 0.8;
      altFt = 8000;
      phase = 'Holding Stack KESTL · FL080';
      status = 'Caution';
      timelineIdx = 2;
      break;
    }

    case 'tma_wx_reroute': {
      x = -68 + u * 136;
      z = -44 + u * 56;
      y = 21.0 * (1 - u * 0.65) + 5.0;
      altFt = Math.round(11200 * (1 - u * 0.65) + 2400);
      phase = 'Vectoring Around CB Storm Cell';
      status = 'Caution';
      timelineIdx = 1;
      break;
    }

    case 'tma_south_feeder': {
      x = 74 - u * 110;
      z = 62 - u * 48;
      y = 18.5 * (1 - u * 0.65) + 4.5;
      altFt = Math.round(8500 * (1 - u * 0.65) + 2200);
      phase = 'MARIN 1B Estuary Arrival';
      status = 'Approach';
      timelineIdx = 3;
      break;
    }

    case 'tma_departure_climb': {
      x = 64 - u * 88;
      z = 8 - u * 76;
      y = 5.5 + u * 23.0;
      altFt = Math.round(3200 + u * 14800);
      phase = 'Climbing FL180 via BAYLI';
      status = 'Climbing';
      timelineIdx = 0;
      break;
    }

    case 'tma_calib_orbit': {
      const ang = u * Math.PI * 2;
      x = -26 + Math.cos(ang) * 18;
      z = 32 + Math.sin(ang) * 14;
      y = 11.2;
      altFt = 4500;
      phase = 'Calibrating PSA-VOR Radials';
      status = 'Normal';
      break;
    }

    // ======================== EN-ROUTE ROUTES ========================
    case 'enroute_j42_east': {
      x = -82 + u * 164;
      z = -54 + u * 92;
      y = 26.5;
      altFt = 35000;
      phase = 'Cruise FL350 · Jetway J-42';
      status = 'Normal';
      break;
    }

    case 'enroute_ul850_ne': {
      x = -74 + u * 150;
      z = 52 - u * 118;
      y = 29.5;
      altFt = 34000;
      phase = 'Cruise FL340 · Upper UL-850';
      status = 'Normal';
      break;
    }

    case 'enroute_q18_south': {
      x = -16 + u * 34;
      z = -72 + u * 138;
      y = 23.0 * (1 - u * 0.25);
      altFt = Math.round(29000 - u * 4000);
      phase = 'Step Descent FL250 · Q-18';
      status = 'Climbing';
      break;
    }

    case 'enroute_j42_west': {
      x = 82 - u * 164;
      z = 36 - u * 88;
      y = 24.0;
      altFt = 32000;
      phase = 'Cruise FL320 · Jetway J-42W';
      status = 'Normal';
      break;
    }

    case 'enroute_hold_lakes': {
      const ang = u * Math.PI * 2;
      x = -42 + Math.cos(ang) * 13;
      z = 36 + Math.sin(ang) * 7.5;
      y = 19.5;
      altFt = 24000;
      phase = 'High-Altitude Hold · LAKES';
      status = 'Caution';
      break;
    }

    default:
      break;
  }

  // Dynamic Lateral Weather Cell Avoidance (Traffic automatically reroutes around drifting CB cells!)
  if (wxList && wxList.length > 0 && altFt > 100) {
    for (const wx of wxList) {
      const dx = x - wx.pos[0];
      const dz = z - wx.pos[2];
      const dist = Math.hypot(dx, dz);
      const avoidR = wx.radius * 1.35;
      if (dist < avoidR && dist > 0.001) {
        const push = (1 - dist / avoidR) * 11.5;
        x += (dx / dist) * push;
        z += (dz / dist) * push;
        phase = `Weather Deviation · ${wx.callsign}`;
        status = 'Caution';
      }
    }
  }

  // Apply controller manual altitude & heading vector offsets
  y = Math.max(1.92, y + f.manualAltOffset * 0.0016);
  altFt = Math.max(0, Math.round(altFt + f.manualAltOffset));
  if (Math.abs(f.manualHdgOffset) > 0.5 && altFt > 100) {
    const rad = (f.manualHdgOffset * Math.PI) / 180;
    x += Math.sin(rad) * 6.5;
    z += Math.cos(rad) * 6.5;
  }

  return { x, y, z, altFt, phase, status, timelineIdx };
}

function evalGroundPath(g, t) {
  const u = ((t % 1) + 1) % 1;
  const ping = u < 0.5 ? u * 2 : (1 - u) * 2;
  switch (g.pathType) {
    case 'apron_tug_g1':
      return { x: -16, y: 1.63, z: -19.5 + ping * 3.2, yaw: 0 };
    case 'apron_service_loop': {
      const ang = u * Math.PI * 2;
      const x = Math.cos(ang) * 22;
      const z = -26 + Math.sin(ang) * 5.5;
      const dx = -Math.sin(ang) * 22;
      const dz = Math.cos(ang) * 5.5;
      return { x, y: 1.63, z, yaw: Math.atan2(-dx, -dz) };
    }
    case 'static_gate_g1':
      return { x: -12.2, y: 1.63, z: -24.0, yaw: Math.PI * 0.5 };
    case 'apron_baggage_loop': {
      const ang = u * Math.PI * 2;
      const x = -8 + Math.cos(ang) * 18;
      const z = -29 + Math.sin(ang) * 4.2;
      const dx = -Math.sin(ang) * 18;
      const dz = Math.cos(ang) * 4.2;
      return { x, y: 1.63, z, yaw: Math.atan2(-dx, -dz) };
    }
    case 'taxiway_escort_loop': {
      const x = -42 + ping * 78;
      const z = -2.2;
      const yaw = u < 0.5 ? -Math.PI * 0.5 : Math.PI * 0.5;
      return { x, y: 1.63, z, yaw };
    }
    case 'arff_patrol_loop': {
      const x = 48 - ping * 24;
      const z = -32;
      const yaw = u < 0.5 ? Math.PI * 0.5 : -Math.PI * 0.5;
      return { x, y: 1.63, z, yaw };
    }
    default:
      return { x: 0, y: 1.63, z: -25, yaw: 0 };
  }
}

// ============================================================================
// REAL-TIME SIMULATION STEP (DETERMINISTIC FOR BOTH LIVE & VIRTUAL CLOCK)
// ============================================================================

export function advanceSimulation(state, dtSeconds, initialPopulate = false) {
  const dt = Math.min(Math.max(dtSeconds, 0.001), 0.25);
  state.simTimeSec += dt;
  state.clockMs += dt * 1000;

  // 1. Update drifting weather cells per site
  for (const siteKey of Object.keys(state.weatherCells)) {
    for (const wx of state.weatherCells[siteKey]) {
      const s = state.simTimeSec * wx.driftFreq;
      wx.pos = [
        wx.basePos[0] + Math.sin(s) * wx.driftAmp[0],
        wx.basePos[1],
        wx.basePos[2] + Math.cos(s * 0.85) * wx.driftAmp[1],
      ];
    }
  }

  // 2. Update flights (positions, headings, pitch/bank, contrail history)
  for (const f of state.flights) {
    const wxList = state.weatherCells[f.site] || [];
    if (initialPopulate) {
      f.history = [];
      for (let k = 18; k >= 1; k--) {
        const pastT = f.t - k * 0.012 * (f.speedFactor > 0 ? 1 : 0);
        const pt = evalFlightRoute(f, pastT, wxList);
        f.history.push([pt.x, pt.y, pt.z]);
      }
    }

    const prevPos = f.pos ? [...f.pos] : null;
    f.t = (f.t + dt * f.speedFactor) % 1.0;

    const cur = evalFlightRoute(f, f.t, wxList);
    const ahead = evalFlightRoute(f, f.t + 0.008, wxList);

    f.pos = [cur.x, cur.y, cur.z];
    f.altitude = cur.altFt;
    f.phase = cur.phase;
    f.status = cur.status;
    f.timelineIdx = cur.timelineIdx;

    const dx = ahead.x - cur.x;
    const dy = ahead.y - cur.y;
    const dz = ahead.z - cur.z;
    const horizDist = Math.hypot(dx, dz);

    if (f.speedFactor > 0.0001 && horizDist > 0.0001) {
      // Three.js rotation.y so -Z nose points along (dx, dz)
      f.yaw = Math.atan2(-dx, -dz);
      f.pitch = Math.max(-0.22, Math.min(0.24, Math.atan2(dy, horizDist)));
      const compassRad = Math.atan2(dx, -dz);
      f.heading = Math.round(((compassRad * 180) / Math.PI + 360) % 360) || 360;
      f.bank = f.holding ? -0.28 : 0.0;
    } else {
      f.yaw = f.yaw ?? 0;
      f.pitch = 0;
      f.bank = 0;
    }

    // Append contrail history sample
    if (!prevPos || Math.hypot(cur.x - prevPos[0], cur.z - prevPos[2]) > 0.45) {
      f.history.push([cur.x, cur.y, cur.z]);
      if (f.history.length > 26) {
        f.history.shift();
      }
    }
  }

  // 3. Pairwise Separation Calculation per site (triggers Amber/Red separation rings!)
  let globalMinSep = 9.9;
  for (const siteObj of SITES) {
    const siteFlights = state.flights.filter(
      (fl) => fl.site === siteObj.id && fl.altitude > 100
    );
    for (const fl of siteFlights) {
      fl.sepStatus = 'Nominal';
      fl.minSepNm = 8.5;
    }
    for (let i = 0; i < siteFlights.length; i++) {
      for (let j = i + 1; j < siteFlights.length; j++) {
        const a = siteFlights[i];
        const b = siteFlights[j];
        const worldDist = Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2]);
        const altDiff = Math.abs(a.altitude - b.altitude);
        // Convert world units to tactical radar NM (14 world units ~= 1.0 NM)
        const nm = +(worldDist / 12.5).toFixed(1);
        if (altDiff < 2000) {
          if (nm < a.minSepNm) a.minSepNm = nm;
          if (nm < b.minSepNm) b.minSepNm = nm;
          if (nm < globalMinSep) globalMinSep = nm;
          if (nm < 3.0) {
            a.sepStatus = 'Red';
            b.sepStatus = 'Red';
            a.status = 'Conflict';
            b.status = 'Conflict';
          } else if (nm < 4.8) {
            if (a.sepStatus !== 'Red') a.sepStatus = 'Amber';
            if (b.sepStatus !== 'Red') b.sepStatus = 'Amber';
          }
        }
      }
    }
  }

  // 4. Update Ground Vehicles
  for (const g of state.groundUnits) {
    g.t = (g.t + dt * g.speedFactor) % 1.0;
    const gp = evalGroundPath(g, g.t);
    g.pos = [gp.x, gp.y, gp.z];
    g.yaw = gp.yaw;
    g.progress = Math.min(100, Math.round(50 + Math.sin(state.simTimeSec * 0.5 + g.id.length) * 45));
  }

  // 5. Update live KPIs
  state.kpis.minSeparationNm = Math.max(1.8, Math.min(9.9, globalMinSep));
  state.kpis.arrivalsPerHour = 32 + Math.round(Math.sin(state.simTimeSec * 0.15) * 3);
  state.kpis.avgDelayMin = +(2.2 + Math.cos(state.simTimeSec * 0.12) * 0.5).toFixed(1);
}

// ============================================================================
// INTERACTIVE CONTROLLER INSTRUCTIONS
// ============================================================================

export function applyControllerInstruction(state, unitId, actionType) {
  const flight = state.flights.find((f) => f.id === unitId);
  if (!flight) return null;

  const clockStr = new Date(state.clockMs).toISOString().slice(11, 19);
  let msg = '';

  switch (actionType) {
    case 'CLIMB':
      flight.manualAltOffset += 2000;
      flight.clearedLevel = Math.min(41000, flight.altitude + 2000);
      flight.verticalRate = 1800;
      flight.status = 'Climbing';
      msg = `${flight.callsign} instructed: Climb & maintain ${flight.clearedLevel} ft`;
      break;
    case 'DESCEND':
      flight.manualAltOffset -= 2000;
      flight.clearedLevel = Math.max(1500, flight.altitude - 2000);
      flight.verticalRate = -1400;
      flight.status = 'Approach';
      msg = `${flight.callsign} instructed: Descend & maintain ${flight.clearedLevel} ft`;
      break;
    case 'TURN_LEFT':
      flight.manualHdgOffset -= 15;
      msg = `${flight.callsign} instructed: Turn left 15° vector for spacing`;
      break;
    case 'TURN_RIGHT':
      flight.manualHdgOffset += 15;
      msg = `${flight.callsign} instructed: Turn right 15° vector for spacing`;
      break;
    case 'TOGGLE_HOLD':
      flight.holding = !flight.holding;
      flight.status = flight.holding ? 'Caution' : 'Approach';
      msg = flight.holding
        ? `${flight.callsign} instructed: Enter holding pattern as published`
        : `${flight.callsign} instructed: Cancel hold, resume published approach`;
      break;
    case 'CLEAR_APPROACH':
      flight.holding = false;
      flight.manualHdgOffset = 0;
      flight.status = 'Approach';
      flight.phase = 'Cleared ILS Approach RWY 09L';
      msg = `${flight.callsign} cleared ILS RWY 09L approach, report established`;
      break;
    default:
      return null;
  }

  const newEv = {
    id: `EV-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    time: clockStr,
    code: flight.callsign,
    status: flight.status,
    text: msg,
  };
  state.events = [newEv, ...state.events.slice(0, 14)];
  return newEv;
}
