import React, { useState, useMemo } from 'react';

// Shape-differentiated Status Icon & Badge (House UI Rule: Every status starts with an icon whose shape differs per state)
export function StatusBadge({ state, label }) {
  const config = {
    running: {
      bg: 'rgba(16, 185, 129, 0.14)',
      text: '#047857',
      defaultLabel: 'Running',
      icon: (
        // Filled Circle with play notch
        <svg width="12" height="12" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
          <circle cx="7" cy="7" r="6" fill="#10b981" />
          <polygon points="5.5,4.3 10.2,7 5.5,9.7" fill="#ffffff" />
        </svg>
      ),
    },
    hotlot: {
      bg: 'rgba(249, 115, 22, 0.16)',
      text: '#c2410c',
      defaultLabel: 'Hot Lot Express',
      icon: (
        // 4-Point Star Spark
        <svg width="12" height="12" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
          <path
            d="M7 0.5 L8.9 5.1 L13.5 7 L8.9 8.9 L7 13.5 L5.1 8.9 L0.5 7 L5.1 5.1 Z"
            fill="#f97316"
          />
        </svg>
      ),
    },
    idle: {
      bg: 'rgba(245, 158, 11, 0.16)',
      text: '#b45309',
      defaultLabel: 'Standby Idle',
      icon: (
        // Hollow Diamond
        <svg width="12" height="12" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
          <polygon
            points="7,1.4 12.6,7 7,12.6 1.4,7"
            fill="none"
            stroke="#d97706"
            strokeWidth="2.2"
          />
        </svg>
      ),
    },
    maintenance: {
      bg: 'rgba(37, 99, 235, 0.14)',
      text: '#1d4ed8',
      defaultLabel: 'Calibration / PM',
      icon: (
        // Solid Hexagon
        <svg width="12" height="12" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
          <polygon
            points="7,1 12.2,4 12.2,10 7,13 1.8,10 1.8,4"
            fill="#2563eb"
          />
          <circle cx="7" cy="7" r="2.2" fill="#ffffff" />
        </svg>
      ),
    },
    down: {
      bg: 'rgba(239, 68, 68, 0.15)',
      text: '#b91c1c',
      defaultLabel: 'Alarm / Down',
      icon: (
        // Warning Triangle
        <svg width="12" height="12" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
          <polygon points="7,1.2 13,12.2 1,12.2" fill="#ef4444" />
          <rect x="6.3" y="5.2" width="1.4" height="3.6" rx="0.7" fill="#ffffff" />
          <circle cx="7" cy="10.4" r="0.8" fill="#ffffff" />
        </svg>
      ),
    },
  };

  const st = config[state] || config.running;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 9px',
        borderRadius: '999px',
        background: st.bg,
        color: st.text,
        fontSize: '11.5px',
        fontWeight: 600,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      {st.icon}
      <span>{label || st.defaultLabel}</span>
    </span>
  );
}

const panelSurface = {
  background: 'rgba(255, 255, 255, 0.90)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  borderRadius: '14px',
  boxShadow: '0 8px 28px rgba(15, 23, 42, 0.10), 0 1px 3px rgba(15, 23, 42, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.85)',
  pointerEvents: 'auto',
};

export default function DashboardUI({
  sites,
  activeSiteId,
  onSelectSite,
  units,
  tasks,
  events,
  hotLotRoute,
  kpis,
  selectedUnitId,
  onSelectUnit,
  showSubfab,
  onToggleSubfab,
  onCameraAction,
  simTime,
}) {
  const [activeTab, setActiveTab] = useState('oht'); // 'oht' | 'tools' | 'lots' | 'events'
  const [searchQuery, setSearchQuery] = useState('');

  const siteUnits = useMemo(
    () => units.filter((u) => u.siteId === activeSiteId),
    [units, activeSiteId]
  );

  const siteLots = useMemo(
    () => tasks.filter((t) => t.siteId === activeSiteId),
    [tasks, activeSiteId]
  );

  const siteEvents = useMemo(
    () => events.filter((e) => e.siteId === activeSiteId),
    [events, activeSiteId]
  );

  const selectedUnit = useMemo(
    () => siteUnits.find((u) => u.id === selectedUnitId) || null,
    [siteUnits, selectedUnitId]
  );

  // Filter units by search query if typed
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return siteUnits
      .filter(
        (u) =>
          u.id.toLowerCase().includes(q) ||
          u.name.toLowerCase().includes(q) ||
          (u.bay && u.bay.toLowerCase().includes(q)) ||
          (u.activeLotId && u.activeLotId.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [siteUnits, searchQuery]);

  const ohtAndMobileUnits = useMemo(
    () =>
      siteUnits.filter(
        (u) => u.category === 'oht' || u.category === 'vehicle' || u.category === 'engineer'
      ),
    [siteUnits]
  );

  const toolAndStockerUnits = useMemo(
    () =>
      siteUnits.filter(
        (u) =>
          u.category === 'tool' ||
          u.category === 'stocker' ||
          u.category === 'subfab' ||
          u.category === 'plant'
      ),
    [siteUnits]
  );

  // Format deterministic simulation clock (starts at 08:42:00 UTC)
  const formattedClock = useMemo(() => {
    const totalSec = Math.floor(8 * 3600 + 42 * 60 + (simTime || 0));
    const hh = String(Math.floor(totalSec / 3600) % 24).padStart(2, '0');
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss} UTC`;
  }, [simTime]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '14px 18px',
      }}
    >
      {/* ===================================================================
          TOP BAR: Brand, Search, Site Switcher, Sub-Fab Cutaway, Clock
          =================================================================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <header
          style={{
            ...panelSurface,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '9px 16px',
            gap: '16px',
          }}
        >
          {/* Left: Brand Mark + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 3px 10px rgba(37, 99, 235, 0.32)',
              }}
            >
              {/* Custom 300mm Wafer Die Grid SVG Mark */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9.5" stroke="#ffffff" strokeWidth="2" />
                <path d="M7 9.5H17M7 14.5H17M9.5 7V17M14.5 7V17" stroke="#93c5fd" strokeWidth="1.5" />
                <rect x="9.5" y="9.5" width="5" height="5" fill="#f59e0b" />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>AetherSil FabOS</span>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: '#2563eb',
                    background: '#eff6ff',
                    padding: '2px 8px',
                    borderRadius: '6px',
                  }}
                >
                  SECS/GEM Live
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500 }}>
                300 mm Autonomous Wafer Fab & AMHS Operations
              </div>
            </div>
          </div>

          {/* Center: Site Switcher Pills */}
          <div
            role="tablist"
            aria-label="Semiconductor Campus Sites"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f1f5f9',
              padding: '4px',
              borderRadius: '10px',
            }}
          >
            {sites.map((site) => {
              const active = site.id === activeSiteId;
              return (
                <button
                  key={site.id}
                  data-site-id={site.id}
                  onClick={() => onSelectSite(site.id)}
                  style={{
                    border: 'none',
                    borderRadius: '7px',
                    padding: '6px 13px',
                    fontSize: '12.5px',
                    fontWeight: active ? 600 : 500,
                    background: active ? '#2563eb' : 'transparent',
                    color: active ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: active ? '0 2px 8px rgba(37, 99, 235, 0.28)' : 'none',
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      opacity: active ? 1 : 0.75,
                    }}
                  >
                    {site.code}
                  </span>
                  <span>{site.name.split('—')[1]?.trim() || site.name}</span>
                </button>
              );
            })}
          </div>

          {/* Right: Search Input, Sub-Fab X-Ray Toggle & Live Clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find tool, OHT, or lot..."
                style={{
                  width: '185px',
                  padding: '6px 11px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: '12px',
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
              {searchResults.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '36px',
                    left: 0,
                    width: '260px',
                    background: '#ffffff',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.18)',
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    zIndex: 50,
                  }}
                >
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        onSelectUnit(u.id);
                        setSearchQuery('');
                      }}
                      style={{
                        border: 'none',
                        background: '#f8fafc',
                        borderRadius: '7px',
                        padding: '6px 9px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{u.id}</span>
                      <span style={{ color: '#64748b', fontSize: '11px' }}>
                        {u.name.slice(0, 24)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={onToggleSubfab}
              data-action="toggle-subfab"
              style={{
                border: 'none',
                borderRadius: '8px',
                padding: '6px 11px',
                fontSize: '12px',
                fontWeight: 600,
                background: showSubfab ? '#0284c7' : '#f1f5f9',
                color: showSubfab ? '#ffffff' : '#334155',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {showSubfab ? 'Sub-Fab X-Ray: On' : 'Sub-Fab Cutaway'}
            </button>

            <div
              style={{
                padding: '5px 10px',
                borderRadius: '8px',
                background: '#f8fafc',
                fontSize: '12px',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: '#1e293b',
              }}
            >
              {formattedClock}
            </div>
          </div>
        </header>

        {/* =================================================================
            SECOND ROW: Top-Left KPI Strip + Right Detail Card (when open)
            ================================================================= */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
          }}
        >
          {/* Top-Left 4 Semiconductor Fab KPI Cards */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ ...panelSurface, padding: '10px 14px', minWidth: '148px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                Wafer Starts / Day
              </div>
              <div
                style={{
                  fontSize: '21px',
                  fontWeight: 700,
                  color: '#0f172a',
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: '2px',
                }}
              >
                {kpis.wspd.toLocaleString()}{' '}
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>WSPD</span>
              </div>
              <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                {kpis.activeLots} Active 300mm FOUPs
              </div>
            </div>

            <div style={{ ...panelSurface, padding: '10px 14px', minWidth: '142px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                Inline Line Yield
              </div>
              <div
                style={{
                  fontSize: '21px',
                  fontWeight: 700,
                  color: '#0f172a',
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: '2px',
                }}
              >
                {kpis.lineYield}%
              </div>
              <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600, marginTop: '2px' }}>
                Zero Killer Defect Excursion
              </div>
            </div>

            <div style={{ ...panelSurface, padding: '10px 14px', minWidth: '142px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                Lot Cycle Time
              </div>
              <div
                style={{
                  fontSize: '21px',
                  fontWeight: 700,
                  color: '#0f172a',
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: '2px',
                }}
              >
                {kpis.cycleTimeDays}{' '}
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>days</span>
              </div>
              <div style={{ fontSize: '11px', color: '#ea580c', fontWeight: 600, marginTop: '2px' }}>
                Hot-Lot Express: 1.8x Speed
              </div>
            </div>

            <div style={{ ...panelSurface, padding: '10px 14px', minWidth: '148px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                Tool Availability
              </div>
              <div
                style={{
                  fontSize: '21px',
                  fontWeight: 700,
                  color: '#0f172a',
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: '2px',
                }}
              >
                {kpis.toolAvailability}%
              </div>
              <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600, marginTop: '2px' }}>
                OHT Fleet Load {kpis.ohtUtilization}%
              </div>
            </div>
          </div>

          {/* Right-Hand Detail Card (Opens when any 3D object or row is selected; NO X close button per House UI Rules) */}
          {selectedUnit && (
            <aside
              data-testid="unit-detail-card"
              style={{
                ...panelSurface,
                width: '356px',
                padding: '15px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {/* Header with Title & Shape-Differentiated Status Badge */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: '15.5px',
                      fontWeight: 700,
                      color: '#0f172a',
                      lineHeight: 1.25,
                    }}
                  >
                    {selectedUnit.name}
                  </h2>
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#64748b',
                      fontWeight: 500,
                      marginTop: '2px',
                    }}
                  >
                    {selectedUnit.id} · {selectedUnit.bay}
                  </div>
                </div>
                <StatusBadge state={selectedUnit.state} />
              </div>

              {/* Description */}
              <p
                style={{
                  fontSize: '12px',
                  lineHeight: 1.45,
                  color: '#334155',
                  background: '#f8fafc',
                  padding: '8px 10px',
                  borderRadius: '9px',
                }}
              >
                {selectedUnit.description}
              </p>

              {/* Live Cycle / Hoist Progress Bar */}
              <div
                style={{
                  background: '#f1f5f9',
                  padding: '9px 11px',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#1e293b',
                  }}
                >
                  <span>
                    {selectedUnit.category === 'oht'
                      ? 'AMHS Rail & Hoist Transfer Cycle'
                      : selectedUnit.category === 'engineer'
                      ? 'Protocol Inspection Progress'
                      : 'Wafer Recipe Step Progress'}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: '#2563eb' }}>
                    {selectedUnit.liveProgress ?? selectedUnit.stepProgress ?? 72}%
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    borderRadius: '999px',
                    background: '#cbd5e1',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${selectedUnit.liveProgress ?? selectedUnit.stepProgress ?? 72}%`,
                      height: '100%',
                      borderRadius: '999px',
                      background:
                        selectedUnit.state === 'hotlot'
                          ? 'linear-gradient(90deg, #f97316, #f59e0b)'
                          : 'linear-gradient(90deg, #2563eb, #06b6d4)',
                      transition: 'width 0.25s ease',
                    }}
                  />
                </div>
              </div>

              {/* Spaced Telemetry Grid (No divider lines or eyebrow labels) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '7px',
                }}
              >
                {selectedUnit.category === 'oht' || selectedUnit.category === 'vehicle' ? (
                  <>
                    <div
                      style={{
                        background: '#f8fafc',
                        padding: '8px 10px',
                        borderRadius: '9px',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                        Carrying Payload
                      </div>
                      <div
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 700,
                          color: '#0f172a',
                          marginTop: '2px',
                        }}
                      >
                        {selectedUnit.carrying || '300mm FOUP Pod'}
                      </div>
                    </div>
                    <div
                      style={{
                        background: '#f8fafc',
                        padding: '8px 10px',
                        borderRadius: '9px',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                        Route Destination
                      </div>
                      <div
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 700,
                          color: '#2563eb',
                          marginTop: '2px',
                        }}
                      >
                        {selectedUnit.destination || 'Cleanroom Loop'}
                      </div>
                    </div>
                    <div
                      style={{
                        background: '#f8fafc',
                        padding: '8px 10px',
                        borderRadius: '9px',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                        Travel Velocity
                      </div>
                      <div
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 700,
                          color: '#0f172a',
                          fontVariantNumeric: 'tabular-nums',
                          marginTop: '2px',
                        }}
                      >
                        {(selectedUnit.speedMps || 2.4).toFixed(2)} m/s
                      </div>
                    </div>
                    <div
                      style={{
                        background: '#f8fafc',
                        padding: '8px 10px',
                        borderRadius: '9px',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                        Live Coordinates
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#0f172a',
                          fontVariantNumeric: 'tabular-nums',
                          marginTop: '2px',
                        }}
                      >
                        {selectedUnit.position[0].toFixed(1)}m, {selectedUnit.position[2].toFixed(1)}m
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        background: '#f8fafc',
                        padding: '8px 10px',
                        borderRadius: '9px',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                        Active Wafer Lot
                      </div>
                      <div
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 700,
                          color: '#0f172a',
                          marginTop: '2px',
                        }}
                      >
                        {selectedUnit.activeLotId || 'LOT-9402-HOT'}
                      </div>
                    </div>
                    <div
                      style={{
                        background: '#f8fafc',
                        padding: '8px 10px',
                        borderRadius: '9px',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                        Recipe / Protocol
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#2563eb',
                          marginTop: '2px',
                        }}
                      >
                        {selectedUnit.recipeName || 'STANDARD-300MM'}
                      </div>
                    </div>
                    <div
                      style={{
                        background: '#f8fafc',
                        padding: '8px 10px',
                        borderRadius: '9px',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                        Tool Utilization & WPH
                      </div>
                      <div
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 700,
                          color: '#0f172a',
                          fontVariantNumeric: 'tabular-nums',
                          marginTop: '2px',
                        }}
                      >
                        {selectedUnit.liveUtilization ?? selectedUnit.utilization ?? 94}% ·{' '}
                        {selectedUnit.liveWph ?? selectedUnit.wafersPerHour ?? 180} WPH
                      </div>
                    </div>
                    <div
                      style={{
                        background: '#f8fafc',
                        padding: '8px 10px',
                        borderRadius: '9px',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                        Chamber Environment
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#0f172a',
                          marginTop: '2px',
                        }}
                      >
                        {selectedUnit.chamberVacuum || 'ISO-1 Laminar'}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Linked Sub-Fab Utility Jump Button if tool has a sub-fab link */}
              {selectedUnit.subfabLink && (
                <button
                  onClick={() => {
                    if (!showSubfab) onToggleSubfab();
                    onSelectUnit(selectedUnit.subfabLink);
                  }}
                  style={{
                    border: 'none',
                    borderRadius: '8px',
                    padding: '7px 11px',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>Inspect Linked Sub-Fab Skid ({selectedUnit.subfabLink})</span>
                  <span>View Basement →</span>
                </button>
              )}

              {/* Subtle instruction footer (No X button on side panels) */}
              <div
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Camera tracking active unit</span>
                <span>Click empty ground or press Esc to close</span>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* ===================================================================
          BOTTOM AREA: Camera Controls, Hot-Lot Timeline Strip & Tabbed List
          =================================================================== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '14px',
        }}
      >
        {/* Left & Center Column: Camera Controls + Hot-Lot 7-Stage Route Timeline Strip */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '9px',
            flex: 1,
            maxWidth: '920px',
          }}
        >
          {/* Camera Quick Controls Pill */}
          <div
            style={{
              ...panelSurface,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 8px',
              alignSelf: 'flex-start',
            }}
          >
            <button
              onClick={() => onCameraAction('overview')}
              data-camera="overview"
              style={{
                border: 'none',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontWeight: 600,
                fontSize: '12px',
                padding: '5px 10px',
                borderRadius: '7px',
                cursor: 'pointer',
              }}
            >
              Reset Overview
            </button>
            <button
              onClick={() => onCameraAction('zoomIn')}
              style={{
                border: 'none',
                background: '#f1f5f9',
                color: '#334155',
                fontWeight: 600,
                fontSize: '12px',
                padding: '5px 9px',
                borderRadius: '7px',
                cursor: 'pointer',
              }}
            >
              Zoom +
            </button>
            <button
              onClick={() => onCameraAction('zoomOut')}
              style={{
                border: 'none',
                background: '#f1f5f9',
                color: '#334155',
                fontWeight: 600,
                fontSize: '12px',
                padding: '5px 9px',
                borderRadius: '7px',
                cursor: 'pointer',
              }}
            >
              Zoom −
            </button>
            <button
              onClick={() => onCameraAction('rotate')}
              style={{
                border: 'none',
                background: '#f1f5f9',
                color: '#334155',
                fontWeight: 600,
                fontSize: '12px',
                padding: '5px 9px',
                borderRadius: '7px',
                cursor: 'pointer',
              }}
            >
              Orbit 45°
            </button>
          </div>

          {/* Bottom Timeline Strip: Follows One Hot Lot Through Its 7-Stage Route */}
          {hotLotRoute && (
            <section
              aria-label="Hot Lot Process Route Timeline"
              style={{
                ...panelSurface,
                padding: '11px 15px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <StatusBadge state="hotlot" label={`Hot Lot ${hotLotRoute.lotId}`} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    {hotLotRoute.product}
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                    Full Cleanroom Process Flow (Click any step to inspect tool)
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#2563eb',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  Stage {kpis.activeStageIndex + 1} of {hotLotRoute.stages.length} · {kpis.stageProgress}%
                </span>
              </div>

              {/* 7 Process Stages Row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '7px',
                }}
              >
                {hotLotRoute.stages.map((st, idx) => {
                  const isCurrent = idx === kpis.activeStageIndex;
                  const isDone = idx < kpis.activeStageIndex;
                  const isSelectedTool = selectedUnitId === st.toolId;

                  return (
                    <button
                      key={st.key}
                      data-stage-tool={st.toolId}
                      onClick={() => onSelectUnit(st.toolId)}
                      style={{
                        border: isSelectedTool
                          ? '1.5px solid #2563eb'
                          : isCurrent
                          ? '1.5px solid #f97316'
                          : '1.5px solid transparent',
                        borderRadius: '9px',
                        padding: '7px 8px',
                        background: isCurrent
                          ? '#fff7ed'
                          : isDone
                          ? '#f0fdf4'
                          : '#f8fafc',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '4px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: isCurrent ? '#c2410c' : isDone ? '#15803d' : '#334155',
                          }}
                        >
                          {st.label}
                        </span>
                        {/* Shape-differentiated mini icon */}
                        {isCurrent ? (
                          <svg width="10" height="10" viewBox="0 0 12 12">
                            <path
                              d="M6 0.5 L7.6 4.4 L11.5 6 L7.6 7.6 L6 11.5 L4.4 7.6 L0.5 6 L4.4 4.4 Z"
                              fill="#f97316"
                            />
                          </svg>
                        ) : isDone ? (
                          <svg width="10" height="10" viewBox="0 0 12 12">
                            <circle cx="6" cy="6" r="4.5" fill="#10b981" />
                          </svg>
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 12 12">
                            <polygon
                              points="6,1.5 10.5,6 6,10.5 1.5,6"
                              fill="none"
                              stroke="#94a3b8"
                              strokeWidth="1.8"
                            />
                          </svg>
                        )}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>
                        {st.toolId} · {st.stepCode}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* =================================================================
            BOTTOM-RIGHT PANEL: Quiet Text Tabs & Spaced Borderless Rows
            ================================================================= */}
        <section
          aria-label="Fab Operations Directory"
          style={{
            ...panelSurface,
            width: '410px',
            padding: '13px 15px',
            display: 'flex',
            flexDirection: 'column',
            gap: '9px',
          }}
        >
          {/* Quiet Text Button Tabs (House UI Rule: Tabs are quiet text buttons) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {[
                { id: 'oht', label: `OHT & Fleet (${ohtAndMobileUnits.length})` },
                { id: 'tools', label: `Fab Tools (${toolAndStockerUnits.length})` },
                { id: 'lots', label: `Wafer Lots (${siteLots.length})` },
                { id: 'events', label: `Yield & PM (${siteEvents.length})` },
              ].map((tab) => {
                const isAct = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    data-tab-id={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '2px 0',
                      fontSize: '12.5px',
                      fontWeight: isAct ? 700 : 500,
                      color: isAct ? '#2563eb' : '#64748b',
                      cursor: 'pointer',
                      transition: 'color 0.15s ease',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Spaced Rows Without Divider Lines (House UI Rule: No divider lines between rows; use spacing and subtle fills) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              maxHeight: '215px',
              overflowY: 'auto',
              paddingRight: '2px',
            }}
          >
            {activeTab === 'oht' &&
              ohtAndMobileUnits.map((unit) => {
                const isSel = unit.id === selectedUnitId;
                return (
                  <div
                    key={unit.id}
                    data-row-unit-id={unit.id}
                    onClick={() => onSelectUnit(unit.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 11px',
                      borderRadius: '9px',
                      background: isSel ? '#eff6ff' : '#f8fafc',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>
                          {unit.id}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: '#334155' }}>
                          {unit.name.slice(0, 28)}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {unit.carrying
                          ? `${unit.carrying} → ${unit.destination || 'Loop'}`
                          : `${unit.recipeName || unit.bay}`}
                      </div>
                    </div>
                    <StatusBadge
                      state={unit.state}
                      label={
                        unit.category === 'oht'
                          ? `${(unit.speedMps || 2.2).toFixed(1)} m/s`
                          : unit.clipState || 'Active'
                      }
                    />
                  </div>
                );
              })}

            {activeTab === 'tools' &&
              toolAndStockerUnits.map((unit) => {
                const isSel = unit.id === selectedUnitId;
                return (
                  <div
                    key={unit.id}
                    data-row-unit-id={unit.id}
                    onClick={() => onSelectUnit(unit.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 11px',
                      borderRadius: '9px',
                      background: isSel ? '#eff6ff' : '#f8fafc',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>
                          {unit.id}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: '#334155' }}>
                          {unit.name.slice(0, 27)}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {unit.bay} · Lot {unit.activeLotId || 'Active'}
                      </div>
                    </div>
                    <StatusBadge
                      state={unit.state}
                      label={`${unit.liveUtilization ?? unit.utilization ?? 92}%`}
                    />
                  </div>
                );
              })}

            {activeTab === 'lots' &&
              siteLots.map((lot) => {
                const isSel =
                  selectedUnitId === lot.currentTool || selectedUnitId === lot.carrierUnitId;
                return (
                  <div
                    key={lot.id}
                    data-row-lot-id={lot.id}
                    onClick={() => onSelectUnit(lot.currentTool)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 11px',
                      borderRadius: '9px',
                      background: isSel ? '#eff6ff' : '#f8fafc',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>
                          {lot.id}
                        </span>
                        <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 500 }}>
                          {lot.product}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        Step {lot.stepNumber}/{lot.totalSteps} ({lot.stageName}) · Tool{' '}
                        <strong style={{ color: '#1e293b' }}>{lot.currentTool}</strong> · Queue{' '}
                        {lot.queueTime}
                      </div>
                    </div>
                    <StatusBadge state={lot.state} label={`Yield ${lot.yieldPct}%`} />
                  </div>
                );
              })}

            {activeTab === 'events' &&
              siteEvents.map((ev) => {
                const isSel = selectedUnitId === ev.unitId;
                return (
                  <div
                    key={ev.id}
                    data-row-event-id={ev.id}
                    onClick={() => onSelectUnit(ev.unitId)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 11px',
                      borderRadius: '9px',
                      background: isSel ? '#eff6ff' : '#f8fafc',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                        {ev.title}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        Unit {ev.unitId} · {ev.metric} · {ev.timestamp}
                      </div>
                    </div>
                    <StatusBadge state={ev.state} label={ev.unitId} />
                  </div>
                );
              })}
          </div>
        </section>
      </div>
    </div>
  );
}
