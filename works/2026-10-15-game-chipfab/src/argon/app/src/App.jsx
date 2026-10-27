import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import FabScene from './components/FabScene';
import DashboardUI from './components/DashboardUI';
import {
  createInitialSimulationState,
  updateSimulationAtTime,
  getSiteLiveKpis,
} from './sim/fabSimulation';

export default function App() {
  const simStateRef = useRef(null);
  if (!simStateRef.current) {
    simStateRef.current = createInitialSimulationState();
    updateSimulationAtTime(simStateRef.current, 0);
  }

  const simTimeRef = useRef(0);
  const [simTick, setSimTick] = useState(0);
  const [activeSiteId, setActiveSiteId] = useState('fab1');
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [hoveredUnitId, setHoveredUnitId] = useState(null);
  const [subfabCutaway, setSubfabCutaway] = useState(false);
  const [cameraCommand, setCameraCommand] = useState(null);

  // Sync simulation clock with requestAnimationFrame + performance.now()
  // Three.js useFrame reads simTimeRef.current directly every frame (60 fps),
  // while React UI telemetry ticks at 10 Hz to avoid unnecessary DOM re-renders.
  useEffect(() => {
    let rafId = null;
    const startPerf = performance.now();
    let lastUiUpdate = -1000;

    const loop = (now) => {
      const currentNow = now ?? performance.now();
      const elapsedSec = Math.max(0, (currentNow - startPerf) * 0.001);
      simTimeRef.current = elapsedSec;
      updateSimulationAtTime(simStateRef.current, elapsedSec);

      if (currentNow - lastUiUpdate >= 100) {
        lastUiUpdate = currentNow;
        setSimTick((prev) => (prev + 1) % 1000000);
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  // House UI Rule: Pressing Esc closes the detail card and deselects the current unit
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedUnitId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectSite = useCallback((siteId) => {
    setActiveSiteId(siteId);
    setSelectedUnitId(null);
    setCameraCommand({ type: 'overview', ts: Date.now() });
  }, []);

  const handleSelectUnit = useCallback((unitId) => {
    setSelectedUnitId(unitId);
  }, []);

  const handleCameraAction = useCallback((cmd) => {
    if (typeof cmd === 'string') {
      setCameraCommand({ type: cmd, ts: Date.now() });
    } else if (cmd && typeof cmd === 'object') {
      setCameraCommand({ ...cmd, ts: Date.now() });
    }
  }, []);

  const state = simStateRef.current;
  const kpis = useMemo(
    () => getSiteLiveKpis(state, activeSiteId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, activeSiteId, simTick]
  );

  const hotLotRoute = state.hotLotRoutes[activeSiteId] || state.hotLotRoutes.fab1;
  const activeSite = state.sites.find((s) => s.id === activeSiteId) || state.sites[0];

  useEffect(() => {
    window.__FAB_STATE__ = {
      activeSiteId,
      selectedUnitId,
      subfabCutaway,
      units: state.units,
    };
  }, [activeSiteId, selectedUnitId, subfabCutaway, state.units, simTick]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <Suspense
        fallback={
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#dbe4f0',
              color: '#0f172a',
              fontSize: '15px',
              fontWeight: 600,
            }}
          >
            Loading AetherSil 300 mm Semiconductor Cleanroom Assets...
          </div>
        }
      >
        <FabScene
          siteId={activeSiteId}
          units={state.units}
          selectedUnitId={selectedUnitId}
          hoveredUnitId={hoveredUnitId}
          onSelectUnit={handleSelectUnit}
          onHoverUnit={setHoveredUnitId}
          showSubfab={subfabCutaway}
          subfabCutaway={subfabCutaway}
          cameraCommand={cameraCommand}
          onClearCameraCommand={() => setCameraCommand(null)}
          onCameraCommandHandled={() => setCameraCommand(null)}
          siteCameraDefault={activeSite.cameraDefault}
          simTimeRef={simTimeRef}
        />
      </Suspense>

      <DashboardUI
        sites={state.sites}
        activeSiteId={activeSiteId}
        onSelectSite={handleSelectSite}
        units={state.units}
        tasks={state.tasks}
        events={state.events}
        hotLotRoute={hotLotRoute}
        kpis={kpis}
        selectedUnitId={selectedUnitId}
        onSelectUnit={handleSelectUnit}
        showSubfab={subfabCutaway}
        subfabCutaway={subfabCutaway}
        onToggleSubfab={() => setSubfabCutaway((v) => !v)}
        onToggleSubfabCutaway={() => setSubfabCutaway((v) => !v)}
        onCameraAction={handleCameraAction}
        simTime={simTimeRef.current}
      />
    </div>
  );
}
