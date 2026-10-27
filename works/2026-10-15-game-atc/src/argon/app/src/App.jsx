import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AtcWorld3D from './components/AtcWorld3D';
import {
  ARRIVAL_TIMELINE_STEPS,
  SITES,
  SITE_WAYPOINTS,
  advanceSimulation,
  applyControllerInstruction,
  createInitialSimulationState,
} from './model/atcSimulation';

// Distinct geometric SVG icon per operational status (House UI rule)
export function StatusBadge({ status = 'Normal', text }) {
  const norm = status || 'Normal';
  const label = text || norm;

  const renderShape = () => {
    switch (norm) {
      case 'Approach':
        return (
          <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
            <polygon points="8,1 15,8 8,15 1,8" fill="currentColor" />
          </svg>
        );
      case 'Climbing':
        return (
          <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
            <polygon points="8,2 15,14 1,14" fill="currentColor" />
          </svg>
        );
      case 'Caution':
      case 'Warning':
      case 'Advisory':
        return (
          <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 1.5L15 14H1L8 1.5Z" fill="currentColor" />
          </svg>
        );
      case 'Conflict':
        return (
          <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
            <polygon points="5,1 11,1 15,5 15,11 11,15 5,15 1,11 1,5" fill="currentColor" />
          </svg>
        );
      case 'OnGround':
        return (
          <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="2.5" y="2.5" width="11" height="11" rx="2.2" fill="currentColor" />
          </svg>
        );
      default:
        return (
          <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="5.5" fill="currentColor" />
          </svg>
        );
    }
  };

  return (
    <span className={`status-pill state-${norm.toLowerCase()}`}>
      {renderShape()}
      <span>{label}</span>
    </span>
  );
}

// Static facility / runway lookup for when user clicks a 3D building or runway
const STATIC_FACILITIES = {
  'RWY-09L': {
    id: 'RWY-09L',
    callsign: 'RWY 09L/27R',
    name: 'Primary Precision Runway 09L/27R',
    category: 'runway',
    site: 'tower',
    status: 'Approach',
    phase: 'ILS CAT IIIB Active · 3,600m × 45m',
    pos: [0, 2.0, -14],
    progress: 84,
    fields: [
      ['Dimensions', '3,600 m × 45 m Grooved Asphalt'],
      ['Instrument Approach', 'ILS CAT IIIB · 109.90 MHz'],
      ['Visual Slope', '4-Box PAPI Left & Right (3.0°)'],
      ['Active Traffic', 'AZR-402 Short Final / SLS-118 Dep'],
      ['Lighting System', 'ALSF-2 Pier + Touchdown Zone'],
      ['Surface Condition', 'Dry · Braking Action Good'],
    ],
  },
  'RWY-09R': {
    id: 'RWY-09R',
    callsign: 'RWY 09R/27L',
    name: 'Secondary Parallel Runway 09R/27L',
    category: 'runway',
    site: 'tower',
    status: 'Climbing',
    phase: 'Departures & Feeder Arrivals · 3,150m',
    pos: [0, 2.0, 10],
    progress: 62,
    fields: [
      ['Dimensions', '3,150 m × 45 m Displaced Thresh'],
      ['Instrument Approach', 'ILS CAT II · 110.35 MHz'],
      ['Visual Slope', '4-Box PAPI (3.0° Glidepath)'],
      ['Active Traffic', 'MRD-801 Climbing / SKW-209 Base'],
      ['High-Speed Turnoffs', 'TWY K2 & Bravo Connectors'],
      ['Surface Condition', 'Dry · Braking Action Good'],
    ],
  },
  'BLD-TERM': {
    id: 'BLD-TERM',
    callsign: 'CONCOURSE-A',
    name: 'Port Solis Main Passenger Terminal',
    category: 'facility',
    site: 'tower',
    status: 'Normal',
    phase: 'Gates G1–G3 Active · 3 JetBridges',
    pos: [0, 8.0, -44],
    progress: 76,
    fields: [
      ['Active Gates', 'G1 (VLC-550), G2 (AZR-402 Inbound), G3'],
      ['Boarding Bridges', '3 Articulated Glass Rotunda Booms'],
      ['HVAC Chillers', '4 Rooftop Units @ 100% Nominal'],
      ['Turnaround Crew', 'Marshaller + Catering + Fuel Active'],
      ['Baggage Handling', 'Automated ULD Tractor Loop'],
      ['Hourly Throughput', '1,420 Passengers / Hr'],
    ],
  },
  'BLD-HGR-A': {
    id: 'BLD-HGR-A',
    callsign: 'HANGAR-A',
    name: 'Azura Fleet Maintenance Hangar A',
    category: 'facility',
    site: 'tower',
    status: 'Normal',
    phase: 'Dual-Leaf Hangar Doors Cycling',
    pos: [38, 7.0, -43],
    progress: 65,
    fields: [
      ['Clear Span', '28.0 m Wide-Span Steel Truss'],
      ['Active Bay Work', 'A320N Avionics & Radar Calibration'],
      ['Door Actuators', 'Synchronized Dual-Leaf Sliders'],
      ['Annex Offices', 'Line Maintenance Engineering'],
    ],
  },
  'BLD-ARFF': {
    id: 'BLD-ARFF',
    callsign: 'ARFF-STN',
    name: 'Airfield Rescue & Firefighting Station',
    category: 'facility',
    site: 'tower',
    status: 'Normal',
    phase: 'ICAO Category 9 Readiness · 3 Bays',
    pos: [-58, 6.0, -34],
    progress: 100,
    fields: [
      ['ICAO Category', 'CAT 9 Heavy Foam & Dry Chemical'],
      ['Apparatus Bays', '3 Roll-Up Rapid Dispatch Doors'],
      ['Active Unit', 'RED-9 Striker 6x6 Crash Tender'],
      ['Response Time', '< 95 sec to Either Runway Threshold'],
    ],
  },
};

export default function App() {
  const simStateRef = useRef(null);
  if (!simStateRef.current) {
    simStateRef.current = createInitialSimulationState();
  }

  const [uiSnapshot, setUiSnapshot] = useState(() => ({ ...simStateRef.current }));
  const [activeSiteId, setActiveSiteId] = useState('tower');
  const [selectedId, setSelectedId] = useState(null);
  const [followSelected, setFollowSelected] = useState(true);
  const [showRadarSweep, setShowRadarSweep] = useState(true);
  const [activeTab, setActiveTab] = useState('flights');
  const [searchQuery, setSearchQuery] = useState('');
  const [cameraCommand, setCameraCommand] = useState(null);

  // Close detail card on Escape key (House UI rule)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Advance simulation from R3F frame loop and throttled-sync React UI state
  const handleTickSimulation = useCallback((delta, elapsedTime, lastSyncRef) => {
    advanceSimulation(simStateRef.current, delta, false);
    if (elapsedTime - lastSyncRef.current >= 0.12) {
      lastSyncRef.current = elapsedTime;
      setUiSnapshot({
        ...simStateRef.current,
        flights: [...simStateRef.current.flights],
        groundUnits: [...simStateRef.current.groundUnits],
        events: [...simStateRef.current.events],
        kpis: { ...simStateRef.current.kpis },
      });
    }
  }, []);

  const handleClearCameraCommand = useCallback(() => {
    setCameraCommand(null);
  }, []);

  // Resolve any selected object across flights, ground units, weather cells, waypoints, or facilities
  const resolveObjectById = useCallback(
    (id) => {
      if (!id) return null;
      const st = simStateRef.current;
      const fl = st.flights.find((f) => f.id === id);
      if (fl) return fl;
      const gr = st.groundUnits.find((g) => g.id === id);
      if (gr) return gr;
      for (const sKey of Object.keys(st.weatherCells)) {
        const wx = st.weatherCells[sKey].find((w) => w.id === id);
        if (wx) return wx;
      }
      for (const sKey of Object.keys(SITE_WAYPOINTS)) {
        const wp = SITE_WAYPOINTS[sKey].find((w) => w.id === id);
        if (wp) {
          return {
            id: wp.id,
            callsign: wp.code,
            name: wp.name,
            site: sKey,
            category: 'waypoint',
            status: wp.type === 'hold' ? 'Caution' : 'Normal',
            phase: `${wp.freq} · ${wp.altConstraint}`,
            pos: [wp.pos[0], wp.pos[1] + 5, wp.pos[2]],
            progress: 100,
            wpData: wp,
          };
        }
      }
      if (STATIC_FACILITIES[id]) {
        return STATIC_FACILITIES[id];
      }
      return null;
    },
    []
  );

  const selectedUnit = useMemo(
    () => resolveObjectById(selectedId),
    [selectedId, uiSnapshot, resolveObjectById]
  );

  // Select object and optionally fly camera to it
  const handleSelectObject = useCallback(
    (id, shouldFly = false) => {
      if (!id) {
        setSelectedId(null);
        return;
      }
      const target = resolveObjectById(id);
      if (target && target.site && target.site !== activeSiteId) {
        setActiveSiteId(target.site);
      }
      setSelectedId(id);
      if (shouldFly && target && target.pos) {
        setFollowSelected(true);
        setCameraCommand({ type: 'FLY_TO', pos: target.pos });
      }
    },
    [activeSiteId, resolveObjectById]
  );

  const handleSiteSwitch = (newSiteId) => {
    setActiveSiteId(newSiteId);
    setSelectedId(null);
  };

  const handleControllerAction = (actionType) => {
    if (!selectedId) return;
    applyControllerInstruction(simStateRef.current, selectedId, actionType);
    setUiSnapshot({
      ...simStateRef.current,
      flights: [...simStateRef.current.flights],
      events: [...simStateRef.current.events],
    });
  };

  const activeSite = SITES.find((s) => s.id === activeSiteId) || SITES[0];
  const siteFlights = uiSnapshot.flights.filter((f) => f.site === activeSiteId);
  const siteGround = uiSnapshot.groundUnits.filter((g) => g.site === activeSiteId);
  const siteWaypoints = SITE_WAYPOINTS[activeSiteId] || [];
  const siteWeather = uiSnapshot.weatherCells[activeSiteId] || [];

  // Search filtering across active sector or all sectors
  const q = searchQuery.trim().toLowerCase();
  const filteredFlights = siteFlights.filter(
    (f) =>
      !q ||
      f.callsign.toLowerCase().includes(q) ||
      f.airline.toLowerCase().includes(q) ||
      f.aircraftType.toLowerCase().includes(q) ||
      f.nextWaypoint.toLowerCase().includes(q)
  );
  const filteredWaypoints = siteWaypoints.filter(
    (w) => !q || w.code.toLowerCase().includes(q) || w.name.toLowerCase().includes(q)
  );
  const filteredGround = siteGround.filter(
    (g) => !q || g.callsign.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)
  );

  // Arrival flight tracked by the bottom timeline strip
  const timelineFlight = useMemo(() => {
    if (selectedUnit && selectedUnit.category === 'flight') {
      return selectedUnit;
    }
    return (
      siteFlights.find((f) => f.callsign.startsWith('AZR-402')) ||
      siteFlights[0] ||
      uiSnapshot.flights[0]
    );
  }, [selectedUnit, siteFlights, uiSnapshot.flights]);

  const activeTimelineStep = timelineFlight?.timelineIdx ?? 3;
  const clockDisplay = new Date(uiSnapshot.clockMs).toISOString().slice(11, 19);

  // Sector-specific KPI calculations
  const sectorConflictCount = siteFlights.filter((f) => f.sepStatus !== 'Nominal').length;
  const sectorMinSep = useMemo(() => {
    const airborne = siteFlights.filter((f) => f.altitude > 100);
    if (airborne.length === 0) return 5.8;
    return Math.min(...airborne.map((f) => f.minSepNm || 6.0));
  }, [siteFlights]);

  return (
    <div className="atc-shell">
      {/* FULL-VIEWPORT 3D STRATEGY WORLD */}
      <AtcWorld3D
        simState={uiSnapshot}
        simStateRef={simStateRef}
        activeSiteId={activeSiteId}
        selectedId={selectedId}
        selectedUnit={selectedUnit}
        followSelected={followSelected}
        showRadarSweep={showRadarSweep}
        cameraCommand={cameraCommand}
        onClearCameraCommand={handleClearCameraCommand}
        onSelectObject={(id) => handleSelectObject(id, false)}
        onTickSimulation={handleTickSimulation}
      />

      {/* ==================== TOP OPERATIONAL BAR ==================== */}
      <header className="top-bar">
        <div className="brand-cluster">
          <div className="brand-emblem" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2.2" strokeOpacity="0.85" />
              <path d="M12 3V12L18.5 8.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
              <circle cx="12" cy="12" r="2.6" fill="white" />
            </svg>
          </div>
          <div className="brand-titles">
            <span className="brand-name">SkyVigil</span>
            <span className="brand-sub">Port Solis Regional Airspace</span>
          </div>
        </div>

        {/* Search Input */}
        <div className="search-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20L16.2 16.2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search flights, callsigns, waypoints, vehicles..."
            aria-label="Search airspace objects"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearchQuery('')}
            >
              Clear
            </button>
          )}
        </div>

        {/* Control Sector Site Switcher */}
        <nav className="site-switcher" aria-label="Control Sectors">
          {SITES.map((s) => {
            const isActive = s.id === activeSiteId;
            return (
              <button
                key={s.id}
                type="button"
                data-site-id={s.id}
                className={`site-btn ${isActive ? 'is-active' : ''}`}
                onClick={() => handleSiteSwitch(s.id)}
              >
                <span className="site-code-badge">{s.code}</span>
                <span className="site-btn-name">{s.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Live Clock & Controller Profile */}
        <div className="topbar-right">
          <div className="live-clock-pill">
            <span className="live-dot" />
            <span className="clock-label">Live</span>
            <span className="clock-mono">{clockDisplay} UTC</span>
          </div>
          <div className="user-badge">
            <div className="user-avatar">EV</div>
            <div className="user-info">
              <span className="user-name">Elena Vance</span>
              <span className="user-role">Lead ATC Supervisor</span>
            </div>
          </div>
        </div>
      </header>

      {/* ==================== TOP-LEFT KPI CARDS ==================== */}
      <section className="kpi-strip" aria-label="Sector Key Performance Indicators">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Aircraft in sector</span>
            <StatusBadge status="Normal" text={activeSite.code} />
          </div>
          <div className="kpi-main">
            <span className="kpi-value">{siteFlights.length}</span>
            <span className="kpi-delta positive">+{uiSnapshot.flights.length} total</span>
          </div>
          <div className="kpi-sub">
            {siteFlights.filter((f) => f.altitude > 100).length} airborne · {siteFlights.filter((f) => f.altitude <= 100).length} surface
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Arrivals per hour</span>
            <StatusBadge status="Approach" text="RWY 09L/R" />
          </div>
          <div className="kpi-main">
            <span className="kpi-value">{uiSnapshot.kpis.arrivalsPerHour}</span>
            <span className="kpi-unit">/ hr</span>
          </div>
          <div className="kpi-sub">ILS 09L &amp; 09R dual ops active</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Average delay</span>
            <StatusBadge status="Normal" text="96.8% on-time" />
          </div>
          <div className="kpi-main">
            <span className="kpi-value">{uiSnapshot.kpis.avgDelayMin}</span>
            <span className="kpi-unit">min</span>
          </div>
          <div className="kpi-sub">Target &lt; 3.5 min across TMA</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Minimum separation</span>
            <StatusBadge
              status={sectorMinSep < 3.0 ? 'Conflict' : sectorMinSep < 4.8 ? 'Caution' : 'Normal'}
              text={sectorMinSep < 4.8 ? `${sectorConflictCount} caution` : 'Safe'}
            />
          </div>
          <div className="kpi-main">
            <span className="kpi-value">{sectorMinSep.toFixed(1)}</span>
            <span className="kpi-unit">NM</span>
          </div>
          <div className="kpi-sub">3.0 NM radar standard minimum</div>
        </div>
      </section>

      {/* ==================== FLOATING CAMERA & RADAR CONTROLS ==================== */}
      <div className="camera-toolbar" aria-label="Camera and View Controls">
        <button
          type="button"
          className="cam-btn"
          title="Zoom In"
          onClick={() => setCameraCommand({ type: 'ZOOM_IN' })}
        >
          +
        </button>
        <button
          type="button"
          className="cam-btn"
          title="Zoom Out"
          onClick={() => setCameraCommand({ type: 'ZOOM_OUT' })}
        >
          −
        </button>
        <button
          type="button"
          className="cam-btn cam-btn-text"
          title="Reset Sector Overview"
          onClick={() => {
            setFollowSelected(false);
            setCameraCommand({ type: 'RESET' });
          }}
        >
          Overview
        </button>
        <button
          type="button"
          className={`cam-btn cam-btn-text ${followSelected && selectedUnit ? 'is-active' : ''}`}
          title="Toggle Camera Follow on Selected Object"
          onClick={() => setFollowSelected((v) => !v)}
        >
          Follow
        </button>
        <button
          type="button"
          className={`cam-btn cam-btn-text ${showRadarSweep ? 'is-active' : ''}`}
          title="Toggle Rotating Radar Sweep Beam"
          onClick={() => setShowRadarSweep((v) => !v)}
        >
          Radar Sweep
        </button>
      </div>

      {/* ==================== RIGHT DETAIL CARD (NO X BUTTON; CLOSES ON GROUND CLICK OR ESC) ==================== */}
      {selectedUnit && (
        <aside className="detail-card" aria-label="Selected Unit Telemetry">
          <div className="detail-top">
            <div>
              <h2 className="detail-heading">{selectedUnit.callsign}</h2>
              <p className="detail-subtitle">
                {selectedUnit.airline
                  ? `${selectedUnit.airline} · ${selectedUnit.aircraftType}`
                  : selectedUnit.name}
              </p>
            </div>
            <StatusBadge status={selectedUnit.status} text={selectedUnit.status} />
          </div>

          <div className="detail-phase-banner">
            <span className="phase-text">{selectedUnit.phase}</span>
            <span className="phase-hint">Click ground or Esc to close</span>
          </div>

          {/* Live Progress Bar */}
          <div className="detail-progress-block">
            <div className="progress-meta">
              <span>
                {selectedUnit.category === 'flight'
                  ? `Sector Route Progress · Next: ${selectedUnit.nextWaypoint}`
                  : 'Operational Cycle Progress'}
              </span>
              <span className="mono-val">
                {selectedUnit.category === 'flight'
                  ? `${Math.round((selectedUnit.t || 0.5) * 100)}%`
                  : `${selectedUnit.progress || 80}%`}
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${
                    selectedUnit.category === 'flight'
                      ? Math.max(8, Math.round((selectedUnit.t || 0.5) * 100))
                      : selectedUnit.progress || 80
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Telemetry Fields */}
          {selectedUnit.category === 'flight' && (
            <>
              <div className="telemetry-grid">
                <div className="telemetry-cell">
                  <span className="t-label">Current Altitude</span>
                  <span className="t-value mono-val">
                    {selectedUnit.altitude > 100
                      ? `${selectedUnit.altitude.toLocaleString()} ft`
                      : 'Surface (0 ft)'}
                  </span>
                </div>
                <div className="telemetry-cell">
                  <span className="t-label">Cleared Level</span>
                  <span className="t-value mono-val">
                    {selectedUnit.clearedLevel > 0
                      ? `${selectedUnit.clearedLevel.toLocaleString()} ft`
                      : 'RWY Touchdown'}
                  </span>
                </div>
                <div className="telemetry-cell">
                  <span className="t-label">Groundspeed</span>
                  <span className="t-value mono-val">{selectedUnit.speed} kt</span>
                </div>
                <div className="telemetry-cell">
                  <span className="t-label">Magnetic Heading</span>
                  <span className="t-value mono-val">
                    {String(selectedUnit.heading).padStart(3, '0')}°
                  </span>
                </div>
                <div className="telemetry-cell">
                  <span className="t-label">Vertical Rate</span>
                  <span className="t-value mono-val">
                    {selectedUnit.verticalRate > 0
                      ? `+${selectedUnit.verticalRate} fpm`
                      : `${selectedUnit.verticalRate} fpm`}
                  </span>
                </div>
                <div className="telemetry-cell">
                  <span className="t-label">Separation / Min</span>
                  <span className="t-value mono-val">
                    {selectedUnit.minSepNm?.toFixed(1) || '5.5'} NM ({selectedUnit.sepStatus})
                  </span>
                </div>
                <div className="telemetry-cell">
                  <span className="t-label">Next Waypoint</span>
                  <span className="t-value mono-val">{selectedUnit.nextWaypoint}</span>
                </div>
                <div className="telemetry-cell">
                  <span className="t-label">Assigned Corridor</span>
                  <span className="t-value mono-val">{selectedUnit.assignedRunway}</span>
                </div>
              </div>

              {/* Interactive Controller Instructions */}
              <div className="controller-actions">
                <div className="ctrl-title">Issue ATC Clearance</div>
                <div className="ctrl-buttons-grid">
                  <button
                    type="button"
                    className="ctrl-btn"
                    onClick={() => handleControllerAction('CLIMB')}
                  >
                    Climb +2,000 ft
                  </button>
                  <button
                    type="button"
                    className="ctrl-btn"
                    onClick={() => handleControllerAction('DESCEND')}
                  >
                    Descend −2,000 ft
                  </button>
                  <button
                    type="button"
                    className="ctrl-btn"
                    onClick={() => handleControllerAction('TURN_LEFT')}
                  >
                    Vector L 15°
                  </button>
                  <button
                    type="button"
                    className="ctrl-btn"
                    onClick={() => handleControllerAction('TURN_RIGHT')}
                  >
                    Vector R 15°
                  </button>
                  <button
                    type="button"
                    className="ctrl-btn"
                    onClick={() => handleControllerAction('TOGGLE_HOLD')}
                  >
                    {selectedUnit.holding ? 'Exit Hold' : 'Enter Hold'}
                  </button>
                  <button
                    type="button"
                    className="ctrl-btn primary"
                    onClick={() => handleControllerAction('CLEAR_APPROACH')}
                  >
                    Clear ILS 09L
                  </button>
                </div>
              </div>
            </>
          )}

          {selectedUnit.category === 'ground' && (
            <div className="telemetry-grid">
              <div className="telemetry-cell">
                <span className="t-label">Assigned Zone</span>
                <span className="t-value">{selectedUnit.assignedZone}</span>
              </div>
              <div className="telemetry-cell">
                <span className="t-label">Ground Speed</span>
                <span className="t-value mono-val">{selectedUnit.speed} km/h</span>
              </div>
              <div className="telemetry-cell">
                <span className="t-label">Mission Role</span>
                <span className="t-value">{selectedUnit.role}</span>
              </div>
              <div className="telemetry-cell">
                <span className="t-label">Transponder</span>
                <span className="t-value mono-val">MODE-S GND</span>
              </div>
            </div>
          )}

          {selectedUnit.category === 'weather' && (
            <div className="telemetry-grid">
              <div className="telemetry-cell">
                <span className="t-label">Convective Intensity</span>
                <span className="t-value">{selectedUnit.intensity}</span>
              </div>
              <div className="telemetry-cell">
                <span className="t-label">Hazard Radius</span>
                <span className="t-value mono-val">{selectedUnit.radius} NM Core</span>
              </div>
              <div className="telemetry-cell">
                <span className="t-label">Traffic Action</span>
                <span className="t-value">Auto Lateral Reroute Active</span>
              </div>
              <div className="telemetry-cell">
                <span className="t-label">Echo Tops</span>
                <span className="t-value mono-val">FL380 Anvil</span>
              </div>
            </div>
          )}

          {selectedUnit.category === 'waypoint' && selectedUnit.wpData && (
            <div className="telemetry-grid">
              <div className="telemetry-cell">
                <span className="t-label">Fix Identifier</span>
                <span className="t-value mono-val">{selectedUnit.wpData.code}</span>
              </div>
              <div className="telemetry-cell">
                <span className="t-label">Procedure Role</span>
                <span className="t-value">{selectedUnit.wpData.freq}</span>
              </div>
              <div className="telemetry-cell">
                <span className="t-label">Crossing Altitude</span>
                <span className="t-value mono-val">{selectedUnit.wpData.altConstraint}</span>
              </div>
              <div className="telemetry-cell">
                <span className="t-label">Control Sector</span>
                <span className="t-value">{activeSite.name}</span>
              </div>
            </div>
          )}

          {(selectedUnit.category === 'runway' || selectedUnit.category === 'facility') &&
            selectedUnit.fields && (
              <div className="telemetry-grid">
                {selectedUnit.fields.map(([k, v]) => (
                  <div className="telemetry-cell" key={k}>
                    <span className="t-label">{k}</span>
                    <span className="t-value">{v}</span>
                  </div>
                ))}
              </div>
            )}
        </aside>
      )}

      {/* ==================== BOTTOM ARRIVAL TIMELINE STRIP ==================== */}
      <section className="timeline-panel" aria-label="Arrival Flight Progression Timeline">
        <div className="timeline-header">
          <div className="timeline-title-group">
            <h3 className="timeline-heading">Arrival Sequence Tracker</h3>
            <span className="timeline-flight-badge">{timelineFlight?.callsign || 'AZR-402'}</span>
            <span className="timeline-flight-meta">
              {timelineFlight?.airline || 'Azura Air'} · {timelineFlight?.aircraftType || 'A320N'} ·{' '}
              {timelineFlight?.phase || 'Final Approach'}
            </span>
          </div>
          <div className="timeline-right-meta">
            <StatusBadge
              status={timelineFlight?.status || 'Approach'}
              text={
                timelineFlight?.altitude > 100
                  ? `${timelineFlight.altitude.toLocaleString()} ft · ${timelineFlight.speed} kt`
                  : 'Runway / Apron Surface'
              }
            />
          </div>
        </div>

        <div className="timeline-steps">
          {ARRIVAL_TIMELINE_STEPS.map((step, idx) => {
            const stateClass =
              idx < activeTimelineStep
                ? 'is-done'
                : idx === activeTimelineStep
                ? 'is-current'
                : 'is-upcoming';
            return (
              <div
                key={step.id}
                className={`timeline-step ${stateClass}`}
                onClick={() => timelineFlight && handleSelectObject(timelineFlight.id, true)}
              >
                <div className="step-node-row">
                  <div className="step-dot">
                    {idx < activeTimelineStep ? '✓' : idx === activeTimelineStep ? '◆' : idx + 1}
                  </div>
                  {idx < ARRIVAL_TIMELINE_STEPS.length - 1 && <div className="step-bar" />}
                </div>
                <div className="step-label">{step.label}</div>
                <div className="step-sub">
                  {step.fix} · {step.targetAlt > 0 ? `${step.targetAlt} ft` : 'Gate G2'}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ==================== BOTTOM-RIGHT DOCK: QUIET TEXT TABS & LISTS ==================== */}
      <section className="dock-panel" aria-label="Sector Units and Activity Lists">
        <div className="dock-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'flights'}
            className={`quiet-tab ${activeTab === 'flights' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('flights')}
          >
            Flights ({filteredFlights.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'waypoints'}
            className={`quiet-tab ${activeTab === 'waypoints' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('waypoints')}
          >
            Waypoints ({filteredWaypoints.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ground'}
            className={`quiet-tab ${activeTab === 'ground' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('ground')}
          >
            Apron &amp; WX ({filteredGround.length + siteWeather.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'events'}
            className={`quiet-tab ${activeTab === 'events' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            Clearances ({uiSnapshot.events.length})
          </button>
        </div>

        <div className="dock-list">
          {activeTab === 'flights' &&
            filteredFlights.map((f) => (
              <button
                key={f.id}
                type="button"
                data-row-id={f.id}
                className={`dock-row ${selectedId === f.id ? 'is-selected' : ''}`}
                onClick={() => handleSelectObject(f.id, true)}
              >
                <div className="row-primary">
                  <span className="row-code">{f.callsign}</span>
                  <span className="row-name">{f.aircraftType}</span>
                </div>
                <div className="row-mid mono-val">
                  {f.altitude > 100 ? `${f.altitude.toLocaleString()} ft` : 'GND'} · {f.speed} kt ·{' '}
                  {f.nextWaypoint}
                </div>
                <StatusBadge status={f.status} text={f.phase.split('·')[0].trim()} />
              </button>
            ))}

          {activeTab === 'waypoints' &&
            filteredWaypoints.map((w) => (
              <button
                key={w.id}
                type="button"
                data-row-id={w.id}
                className={`dock-row ${selectedId === w.id ? 'is-selected' : ''}`}
                onClick={() => handleSelectObject(w.id, true)}
              >
                <div className="row-primary">
                  <span className="row-code">{w.code}</span>
                  <span className="row-name">{w.name}</span>
                </div>
                <div className="row-mid mono-val">{w.altConstraint}</div>
                <StatusBadge
                  status={w.type === 'hold' ? 'Caution' : 'Normal'}
                  text={w.freq}
                />
              </button>
            ))}

          {activeTab === 'ground' && (
            <>
              {siteWeather.map((wx) => (
                <button
                  key={wx.id}
                  type="button"
                  data-row-id={wx.id}
                  className={`dock-row ${selectedId === wx.id ? 'is-selected' : ''}`}
                  onClick={() => handleSelectObject(wx.id, true)}
                >
                  <div className="row-primary">
                    <span className="row-code">{wx.callsign}</span>
                    <span className="row-name">{wx.name}</span>
                  </div>
                  <div className="row-mid">{wx.phase}</div>
                  <StatusBadge status={wx.status} text={wx.status} />
                </button>
              ))}
              {filteredGround.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  data-row-id={g.id}
                  className={`dock-row ${selectedId === g.id ? 'is-selected' : ''}`}
                  onClick={() => handleSelectObject(g.id, true)}
                >
                  <div className="row-primary">
                    <span className="row-code">{g.callsign}</span>
                    <span className="row-name">{g.name}</span>
                  </div>
                  <div className="row-mid">{g.assignedZone}</div>
                  <StatusBadge status={g.status} text={`${g.speed} km/h`} />
                </button>
              ))}
            </>
          )}

          {activeTab === 'events' &&
            uiSnapshot.events.map((ev) => (
              <div key={ev.id} className="dock-row is-static">
                <div className="row-primary">
                  <span className="row-code mono-val">{ev.time}</span>
                  <span className="row-name">{ev.text}</span>
                </div>
                <StatusBadge status={ev.status} text={ev.code} />
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
