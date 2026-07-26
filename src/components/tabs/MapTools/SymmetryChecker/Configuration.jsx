import React, { useState } from 'react';
import { Dropdown } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import { SYMMETRY_MODE_OPTIONS, symmetryModeById } from '../../../Shared/MapLogic';

/**
 * Symmetry Checker · Section 01 — Configuration.
 * Presentational: map name, mirror mode (auto or forced), match tolerances.
 */
export default function SymmetryConfiguration({
  mapName, setMapName, mapInfo,
  onAnalyze, loading, error,
  map,
  mode, setMode,
  autoMode, setAutoMode,
  detected, activeMode,
  heightTolerance, setHeightTolerance, heightSteps,
  maskTolerance, setMaskTolerance,
  worldTolerance, setWorldTolerance,
  usePlayable, setUsePlayable,
  checkY, setCheckY,
  includePathNodes, setIncludePathNodes,
}) {
  const [metaOpen, setMetaOpen] = useState(false);

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
              placeholder="e.g. Hades_Dust.v0002"
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
            <button className="ctrl-btn-add" onClick={onAnalyze} disabled={loading}>
              {loading ? 'Reading map…' : 'Check Symmetry'}
            </button>
          </div>

          {error && <div className="sy-error">{error}</div>}

          {map && (
            <div className="sy-meta">
              <span>Grid <b>{map.size[0]}×{map.size[1]}</b></span>
              <span>Props <b>{map.props.length.toLocaleString()}</b></span>
              <span>Decals <b>{map.decals.length.toLocaleString()}</b></span>
              <span>Markers <b>{map.markers.length.toLocaleString()}</b></span>
              <span>Units <b>{map.units.length.toLocaleString()}</b></span>
            </div>
          )}
        </div>
      </div>

      {/* ── Mirror ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Mirror</div>
        <div className="ctrl-content">
          <button
            type="button"
            className={`ctrl-toggle-row sy-toggle${autoMode ? ' on' : ''}`}
            role="switch"
            aria-checked={autoMode}
            onClick={() => setAutoMode(!autoMode)}
          >
            <span className="ctrl-toggle"><span className="ctrl-toggle-pole" /></span>
            <span className="ctrl-toggle-text">
              <span className="ctrl-toggle-label">Detect the mirror</span>
              <span className="ctrl-toggle-sub">Score all six and check against the best fit</span>
            </span>
          </button>

          {!autoMode && (
            <Dropdown
              options={SYMMETRY_MODE_OPTIONS}
              value={mode}
              onChange={setMode}
              ariaLabel="Symmetry mode"
            />
          )}

          {detected?.length > 0 && (
            <div className="sy-scores">
              {detected.map(d => (
                <div
                  key={d.id}
                  className={`sy-score${d.id === activeMode ? ' is-active' : ''}`}
                  onClick={() => { setAutoMode(false); setMode(d.id); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setAutoMode(false); setMode(d.id); } }}
                  title={`Check this map as ${d.short}`}
                >
                  <span className="sy-score-name">{d.short}</span>
                  <span className="sy-score-bar" style={{ '--sy-fill': `${(d.score * 100).toFixed(2)}%` }} />
                  <span className="sy-score-val">{(d.score * 100).toFixed(2)}%</span>
                </div>
              ))}
            </div>
          )}

          {map && (
            <div className="sy-meta">
              <span>Checking as <b>{symmetryModeById(activeMode).short}</b></span>
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
              Height — {heightTolerance.toFixed(2)} game units
              {heightSteps != null && <> · {heightSteps} raw step{heightSteps === 1 ? '' : 's'}</>}
            </span>
            <input
              type="range" className="sy-range"
              min="0" max="2" step="0.01"
              value={heightTolerance}
              onChange={(e) => setHeightTolerance(Number(e.target.value))}
            />
          </div>

          <div className="ctrl-field">
            <span className="ctrl-label">Mask — {maskTolerance} of 255</span>
            <input
              type="range" className="sy-range"
              min="0" max="32" step="1"
              value={maskTolerance}
              onChange={(e) => setMaskTolerance(Number(e.target.value))}
            />
          </div>

          <div className="ctrl-field">
            <span className="ctrl-label">World — {worldTolerance.toFixed(2)} units</span>
            <input
              type="range" className="sy-range"
              min="0" max="4" step="0.05"
              value={worldTolerance}
              onChange={(e) => setWorldTolerance(Number(e.target.value))}
            />
          </div>

          <button
            type="button"
            className={`ctrl-toggle-row sy-toggle${usePlayable ? ' on' : ''}`}
            role="switch"
            aria-checked={usePlayable}
            onClick={() => setUsePlayable(!usePlayable)}
          >
            <span className="ctrl-toggle"><span className="ctrl-toggle-pole" /></span>
            <span className="ctrl-toggle-text">
              <span className="ctrl-toggle-label">Fold on the playable area</span>
              <span className="ctrl-toggle-sub">Instead of the full map centre</span>
            </span>
          </button>

          <button
            type="button"
            className={`ctrl-toggle-row sy-toggle${checkY ? ' on' : ''}`}
            role="switch"
            aria-checked={checkY}
            onClick={() => setCheckY(!checkY)}
          >
            <span className="ctrl-toggle"><span className="ctrl-toggle-pole" /></span>
            <span className="ctrl-toggle-text">
              <span className="ctrl-toggle-label">Match height too</span>
              <span className="ctrl-toggle-sub">Partners must agree on Y, not only X/Z</span>
            </span>
          </button>

          <button
            type="button"
            className={`ctrl-toggle-row sy-toggle${includePathNodes ? ' on' : ''}`}
            role="switch"
            aria-checked={includePathNodes}
            onClick={() => setIncludePathNodes(!includePathNodes)}
          >
            <span className="ctrl-toggle"><span className="ctrl-toggle-pole" /></span>
            <span className="ctrl-toggle-text">
              <span className="ctrl-toggle-label">Include path-node markers</span>
              <span className="ctrl-toggle-sub">Editor-generated navigation grid — rarely mirrored</span>
            </span>
          </button>
        </div>
      </div>

    </div>
  );
}
