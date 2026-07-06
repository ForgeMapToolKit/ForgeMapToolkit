import React from 'react';
import YCurveEditor from './YCurveEditor.jsx';
import { Y_MODES } from './generation';

// ─────────────────────────────────────────────────────────────────
// Stars_Configuration — Section 01 (Map Details, Star Configuration,
// Y-Distribution, Seed Control). Pure presentational: destructures
// props, renders JSX, no hooks beyond what YCurveEditor owns itself.
// All mutation flows back through the on*Change callbacks the
// parent (Stars.jsx) wires up.
//
// NOTE: `field-input` / `field-label` / `subsection-head` /
// `subsection-head-title` are the class names DESIGN_SYSTEM_
// MIGRATION.md §5 documents as the *new* primitive names (replacing
// the old `form-input` / `form-label` / `subsection-title`). I
// couldn't see primitives.css itself to confirm the exact modifier
// spelling, so please diff this against PropsTab/Props_Configuration
// (or whatever the actual section file is named there) before
// merging.
// ─────────────────────────────────────────────────────────────────
export default function Configuration({
  mapName, onMapNameChange, mapInfo,

  numStars, onNumStarsChange,
  numClusters, onNumClustersChange,
  clusterSpread, onClusterSpreadChange,
  clusterStdDev, onClusterStdDevChange,
  backgroundRatio, onBackgroundRatioChange,
  scaleMin, onScaleMinChange,
  scaleMax, onScaleMaxChange,

  yMode, onYModeChange,
  yClusterScatter, onYClusterScatterChange,
  yMax, onYMaxChange,
  yCenter, onYCenterChange,
  yStdDev, onYStdDevChange,
  yLayers, onYLayersChange,
  diskCenter, onDiskCenterChange,
  diskStdDev, onDiskStdDevChange,
  haloStdDev, onHaloStdDevChange,
  haloRatio, onHaloRatioChange,
  curvePoints, onCurvePointsChange, onResetCurve,

  seed, onSeedChange,
  useSeed, onUseSeedChange, onRandomizeSeed,

  onResetDefaults,
}) {
  return (
    <>
      {/* Map Details */}
      <div className="subsection-head"><span className="subsection-head-title">Map Details</span></div>
      <div className="form-group">
        <label className="field-label">Map Name</label>
        <input className="field-input" value={mapName}
          onChange={e => onMapNameChange(e.target.value)}
          placeholder="e.g. Hades_Dust.v0002" />
        {mapInfo?.ok && (
          <span className="field-hint">
          {mapInfo.playableSize} × {mapInfo.playableSize} ({mapInfo.playableKm} km) — {mapInfo.mapSize} total
          </span>
        )}
      </div>

      <hr className="divider" />

      {/* Star Configuration */}
      <div className="subsection-head"><span className="subsection-head-title">Star Configuration</span></div>
      <div className="st-config-grid">
        <div className="form-group">
          <label className="field-label">Stars</label>
          <input className="field-input" value={numStars} onChange={e => onNumStarsChange(e.target.value)} placeholder="50" />
        </div>
        <div className="form-group">
          <label className="field-label">Clusters</label>
          <input className="field-input" value={numClusters} onChange={e => onNumClustersChange(e.target.value)} placeholder="10" />
        </div>
        <div className="form-group">
          <label className="field-label">Cluster Spread</label>
          <input className="field-input" value={clusterSpread} onChange={e => onClusterSpreadChange(e.target.value)} placeholder="14000" />
        </div>
        <div className="form-group">
          <label className="field-label">Cluster Std Dev</label>
          <input className="field-input" value={clusterStdDev} onChange={e => onClusterStdDevChange(e.target.value)} placeholder="1800" />
        </div>
        <div className="form-group">
          <label className="field-label">Background Ratio</label>
          <input className="field-input" value={backgroundRatio} onChange={e => onBackgroundRatioChange(e.target.value)} placeholder="0.45" />
        </div>
        <div className="form-group">
          <label className="field-label">Scale Min / Max</label>
          <div className="st-split-input">
            <input className="field-input" value={scaleMin} onChange={e => onScaleMinChange(e.target.value)} placeholder="10" />
            <input className="field-input" value={scaleMax} onChange={e => onScaleMaxChange(e.target.value)} placeholder="30" />
          </div>
        </div>
      </div>

      <hr className="divider" />

      {/* Y-Distribution */}
      <div className="subsection-head"><span className="subsection-head-title">Y-Distribution</span></div>
      <div className="form-group">
        <label className="field-label">Mode</label>
        <select className="field-select" value={yMode} onChange={e => onYModeChange(e.target.value)}>
          {Y_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label className="field-label">Cluster Y Scatter</label>
        <input className="field-input" value={yClusterScatter}
          onChange={e => onYClusterScatterChange(e.target.value)} placeholder="200" />
      </div>

      {yMode === 'flat' && (
        <div className="form-group">
          <label className="field-label">Max Height</label>
          <input className="field-input" value={yMax} onChange={e => onYMaxChange(e.target.value)} placeholder="1500" />
        </div>
      )}

      {yMode === 'gaussian' && (
        <div className="st-config-grid">
          <div className="form-group">
            <label className="field-label">Center</label>
            <input className="field-input" value={yCenter} onChange={e => onYCenterChange(e.target.value)} placeholder="750" />
          </div>
          <div className="form-group">
            <label className="field-label">Std Dev</label>
            <input className="field-input" value={yStdDev} onChange={e => onYStdDevChange(e.target.value)} placeholder="300" />
          </div>
          <div className="form-group">
            <label className="field-label">Max Height</label>
            <input className="field-input" value={yMax} onChange={e => onYMaxChange(e.target.value)} placeholder="1500" />
          </div>
        </div>
      )}

      {yMode === 'layered' && (
        <>
          <div className="form-group">
            <label className="field-label">Layers — center, stddev, weight (one per line)</label>
            <textarea className="field-input st-textarea" rows={4}
              value={yLayers} onChange={e => onYLayersChange(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">Max Height</label>
            <input className="field-input" value={yMax} onChange={e => onYMaxChange(e.target.value)} placeholder="1500" />
          </div>
        </>
      )}

      {yMode === 'disk_halo' && (
        <div className="st-config-grid">
          <div className="form-group">
            <label className="field-label">Disk Center</label>
            <input className="field-input" value={diskCenter} onChange={e => onDiskCenterChange(e.target.value)} placeholder="100" />
          </div>
          <div className="form-group">
            <label className="field-label">Disk Std Dev</label>
            <input className="field-input" value={diskStdDev} onChange={e => onDiskStdDevChange(e.target.value)} placeholder="120" />
          </div>
          <div className="form-group">
            <label className="field-label">Halo Std Dev</label>
            <input className="field-input" value={haloStdDev} onChange={e => onHaloStdDevChange(e.target.value)} placeholder="800" />
          </div>
          <div className="form-group">
            <label className="field-label">Halo Ratio</label>
            <input className="field-input" value={haloRatio} onChange={e => onHaloRatioChange(e.target.value)} placeholder="0.15" />
          </div>
          <div className="form-group">
            <label className="field-label">Max Height</label>
            <input className="field-input" value={yMax} onChange={e => onYMaxChange(e.target.value)} placeholder="1500" />
          </div>
        </div>
      )}

      {yMode === 'curve' && (
        <>
          <div className="st-curve-center">
            <div className="st-curve-frame">
              <YCurveEditor
                points={curvePoints}
                onChange={onCurvePointsChange}
                yMax={parseFloat(yMax) || 1500}
              />
            </div>
          </div>
          <div className="form-group st-curve-maxheight">
            <label className="field-label">Max Height</label>
            <input className="field-input" value={yMax} onChange={e => onYMaxChange(e.target.value)} placeholder="1500" />
          </div>
          <button className="action-button st-curve-reset" onClick={onResetCurve}>Reset curve</button>
        </>
      )}

      <hr className="divider" />

      {/* Seed Control */}
      <div className="subsection-head"><span className="subsection-head-title">Seed Control</span></div>
      <div className="st-seed-toggle-row">
        <span className="field-label">{useSeed ? 'Fixed' : 'Random'}</span>
        <button
          className={`switch${useSeed ? ' on' : ''}`}
          onClick={() => onUseSeedChange(!useSeed)}
          aria-checked={useSeed}
          role="switch"
          aria-label="Fixed seed"
        >
          <span className="switch-pole" />
        </button>
      </div>
      <div className="st-seed-row">
        <input
          className="field-input"
          type="number" min="1" max="999999"
          value={seed}
          disabled={!useSeed}
          onChange={e => onSeedChange(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
        />
        <button className="action-button" onClick={onRandomizeSeed} title="Pick a random seed">Randomize</button>
      </div>

      <div className="st-reset-row">
        <button className="action-button" onClick={onResetDefaults}>Reset Defaults</button>
      </div>
    </>
  );
}
