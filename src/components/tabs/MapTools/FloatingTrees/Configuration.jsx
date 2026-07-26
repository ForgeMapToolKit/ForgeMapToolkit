import React, { useState } from 'react';

/**
 * Floating Trees · Section 01 — Configuration.
 * Presentational: the map, how much air counts as floating, and what is in scope.
 */
export default function FloatingTreesConfiguration({
  mapName, setMapName, mapInfo,
  onScan, loading, error, scan,
  tolerance, setTolerance, effectiveTolerance, scanFloor,
  includeSingles, setIncludeSingles,
  includeUnderwater, setIncludeUnderwater,
}) {
  const [metaOpen, setMetaOpen] = useState(false);
  const unresolved = (scan?.models || []).filter(m => m.error);

  return (
    <div className="ctrl-col">

      {/* ── Map ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Map</div>
        <div className="ctrl-content">
          <div className="ctrl-field">
            <input
              type="text"
              className="ctrl-input ctrl-input--text"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              placeholder="e.g. Tartaron.v0006"
            />

            {mapName && (
              <button className="ctrl-btn-meta" onClick={() => setMetaOpen(o => !o)}>
                {metaOpen ? '− Metadata' : '+ Metadata'}
              </button>
            )}

            {mapName && metaOpen && mapInfo && (
              <div className="ctrl-mapinfo">
                {mapInfo.ok ? (
                  <>
                    <span className="ctrl-badge ctrl-badge--ok">Map</span>
                    <span>{mapInfo.mapSize} × {mapInfo.mapSize}</span>
                    <span className="ctrl-mapinfo-sep">·</span>
                    <span>{mapInfo.km} km</span>
                  </>
                ) : (
                  <span className="ctrl-mapinfo-err">{mapInfo.error}</span>
                )}
              </div>
            )}
          </div>

          <div className="ctrl-action-row">
            <button className="ctrl-btn-add" onClick={onScan} disabled={loading}>
              {loading ? 'Measuring props…' : 'Scan for Floating Props'}
            </button>
          </div>

          {error && <div className="ft-error">{error}</div>}

          {scan && (
            <div className="ft-meta">
              <span>Grid <b>{scan.size[0]}×{scan.size[1]}</b></span>
              <span>Props <b>{scan.propTotal.toLocaleString()}</b></span>
              <span>Objects <b>{scan.objectTotal.toLocaleString()}</b></span>
              <span>Assets <b>{scan.models.length}</b></span>
            </div>
          )}

          {/* Never a silent gap: a blueprint that could not be read is a blind
              spot in the result, so it is named where the scan is started. */}
          {unresolved.length > 0 && (
            <div className="ft-warn">
              {unresolved.length} blueprint{unresolved.length === 1 ? '' : 's'} could not be read and
              {' '}{unresolved.length === 1 ? 'was' : 'were'} not measured — check the install path in Settings.
            </div>
          )}
        </div>
      </div>

      {/* ── Tolerance ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Tolerance</div>
        <div className="ctrl-content">
          <div className="ctrl-field">
            <span className="ctrl-label">
              Air under a trunk — {effectiveTolerance.toFixed(2)} world units
              {effectiveTolerance > tolerance && <> · raised to the scan floor</>}
            </span>
            <input
              type="range" className="ft-range"
              min={scanFloor} max="3" step="0.05"
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
            />
          </div>

          <div className="ft-hint">
            One world unit is one ogrid — about a trunk width. Below roughly 0.3 a
            gap is only visible from the ground; a full unit reads from the normal
            camera height.
          </div>

          <button
            type="button"
            className={`ctrl-toggle-row ft-toggle${includeSingles ? ' on' : ''}`}
            role="switch"
            aria-checked={includeSingles}
            onClick={() => setIncludeSingles(!includeSingles)}
          >
            <span className="ctrl-toggle"><span className="ctrl-toggle-pole" /></span>
            <span className="ctrl-toggle-text">
              <span className="ctrl-toggle-label">Include single meshes</span>
              <span className="ctrl-toggle-sub">Lone rocks and trees on a slope — same measurement, one object</span>
            </span>
          </button>

          <button
            type="button"
            className={`ctrl-toggle-row ft-toggle${includeUnderwater ? ' on' : ''}`}
            role="switch"
            aria-checked={includeUnderwater}
            onClick={() => setIncludeUnderwater(!includeUnderwater)}
          >
            <span className="ctrl-toggle"><span className="ctrl-toggle-pole" /></span>
            <span className="ctrl-toggle-text">
              <span className="ctrl-toggle-label">Include objects under water</span>
              <span className="ctrl-toggle-sub">A gap below the water plane is not visible in game</span>
            </span>
          </button>
        </div>
      </div>

    </div>
  );
}
