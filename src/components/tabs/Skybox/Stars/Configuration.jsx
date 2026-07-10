import React, { useRef, useState } from 'react';
import YCurveEditor from './YCurveEditor.jsx';
import { Dropdown } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import { Y_MODES } from './generation';

// ─────────────────────────────────────────────────────────────────
// Configuration — Section 01 (Map Details, Star Parameters,
// Y-Distribution). Pure presentational: destructures props, renders
// JSX, no hooks beyond local +Metadata disclosure and what
// YCurveEditor owns itself. All mutation flows back through the
// on*Change callbacks the parent (Stars.jsx) wires up.
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
  curvePoints, onCurvePointsChange,

  onResetDefaults,
}) {
  const [metaOpen, setMetaOpen] = useState(false);
  const yModeTriggerRef = useRef(null);

  return (
    <div className="ctrl-col">

      {/* Map Details */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Map Details</div>
        <div className="ctrl-content">
          <div className="ctrl-field">
            <input
              type="text"
              className="ctrl-input ctrl-input--text"
              value={mapName}
              onChange={e => onMapNameChange(e.target.value)}
              placeholder="e.g. Hades_Dust.v0002"
            />

            {mapName && (
              <button className="ctrl-btn-meta" onClick={() => setMetaOpen(o => !o)}>
                {metaOpen ? '− Metadata' : '+ Metadata'}
              </button>
            )}

            {mapName && metaOpen && (
              <div className="ctrl-mapinfo">
                <div className="ctrl-path-hint">
                  {`/maps/${mapName.match(/\.v\d{4}$/) ? mapName : mapName + '.v0001'}/`}
                </div>
                {mapInfo && (mapInfo.ok ? (<>
                  <span className="ctrl-badge ctrl-badge--ok">Map</span>
                  <span>{mapInfo.mapSize} × {mapInfo.mapSize}</span>
                  <span className="ctrl-mapinfo-sep">·</span>
                  <span>{mapInfo.km} km</span>
                  {mapInfo.playableSize !== mapInfo.mapSize && (<>
                    <span className="ctrl-mapinfo-sep">·</span>
                    <span>playable {mapInfo.playableKm} km</span>
                  </>)}
                </>) : (
                  <span className="ctrl-mapinfo-err">{mapInfo.error}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Star Parameters */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Star Parameters</div>
        <div className="ctrl-content">
          <div className="ctrl-action-row">
            <button className="ctrl-btn-add" onClick={onResetDefaults}>Reset Defaults</button>
          </div>

          <div className="st-cfg-row st-cfg-row--3">
            <div className="ctrl-field">
              <div className="ctrl-label">Star Count</div>
              <input className="ctrl-input" value={numStars} onChange={e => onNumStarsChange(e.target.value)} placeholder="50" />
            </div>
            <div className="ctrl-field">
              <div className="ctrl-label">Clusters</div>
              <input className="ctrl-input" value={numClusters} onChange={e => onNumClustersChange(e.target.value)} placeholder="10" />
            </div>
            <div className="ctrl-field">
              <div className="ctrl-label">Background Ratio</div>
              <input className="ctrl-input" value={backgroundRatio} onChange={e => onBackgroundRatioChange(e.target.value)} placeholder="0.45" />
            </div>
          </div>

          <div className="st-cfg-row st-cfg-row--3">
            <div className="ctrl-field">
              <div className="ctrl-label">Cluster Spread</div>
              <input className="ctrl-input" value={clusterSpread} onChange={e => onClusterSpreadChange(e.target.value)} placeholder="14000" />
            </div>
            <div className="ctrl-field">
              <div className="ctrl-label">Cluster Std Dev</div>
              <input className="ctrl-input" value={clusterStdDev} onChange={e => onClusterStdDevChange(e.target.value)} placeholder="1800" />
            </div>
            <div className="ctrl-field">
              <div className="ctrl-label">Y Cluster Scatter</div>
              <input className="ctrl-input" value={yClusterScatter} onChange={e => onYClusterScatterChange(e.target.value)} placeholder="200" />
            </div>
          </div>

          <div className="st-cfg-row">
            <div className="ctrl-field">
              <div className="ctrl-label">Scale Min</div>
              <input className="ctrl-input" value={scaleMin} onChange={e => onScaleMinChange(e.target.value)} placeholder="10" />
            </div>
            <div className="ctrl-field">
              <div className="ctrl-label">Scale Max</div>
              <input className="ctrl-input" value={scaleMax} onChange={e => onScaleMaxChange(e.target.value)} placeholder="30" />
            </div>
          </div>
        </div>
      </div>

      {/* Y-Distribution */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Y-Distribution</div>
        <div className="ctrl-content">
          <div className="ctrl-field">
            <div className="ctrl-label">Mode</div>
            <Dropdown options={Y_MODES} value={yMode} onChange={onYModeChange} triggerRef={yModeTriggerRef} ariaLabel="Y-Distribution Mode" />
          </div>

          {yMode === 'flat' && (
            <div className="ctrl-field">
              <div className="ctrl-label">Max Height</div>
              <input className="ctrl-input" value={yMax} onChange={e => onYMaxChange(e.target.value)} placeholder="1500" />
            </div>
          )}

          {yMode === 'gaussian' && (
            <div className="st-cfg-row st-cfg-row--3">
              <div className="ctrl-field"><div className="ctrl-label">Center</div><input className="ctrl-input" value={yCenter} onChange={e => onYCenterChange(e.target.value)} placeholder="750" /></div>
              <div className="ctrl-field"><div className="ctrl-label">Std Dev</div><input className="ctrl-input" value={yStdDev} onChange={e => onYStdDevChange(e.target.value)} placeholder="300" /></div>
              <div className="ctrl-field"><div className="ctrl-label">Max Height</div><input className="ctrl-input" value={yMax} onChange={e => onYMaxChange(e.target.value)} placeholder="1500" /></div>
            </div>
          )}

          {yMode === 'layered' && (
            <>
              <div className="ctrl-field">
                <div className="ctrl-label">Layers — center, stddev, weight (one per line)</div>
                <textarea className="ctrl-input ctrl-input--text st-textarea" rows={4} value={yLayers} onChange={e => onYLayersChange(e.target.value)} />
              </div>
              <div className="ctrl-field"><div className="ctrl-label">Max Height</div><input className="ctrl-input" value={yMax} onChange={e => onYMaxChange(e.target.value)} placeholder="1500" /></div>
            </>
          )}

          {yMode === 'disk_halo' && (
            <div className="st-cfg-row st-cfg-row--5">
              <div className="ctrl-field"><div className="ctrl-label">Disk Center</div><input className="ctrl-input" value={diskCenter} onChange={e => onDiskCenterChange(e.target.value)} placeholder="100" /></div>
              <div className="ctrl-field"><div className="ctrl-label">Disk Std Dev</div><input className="ctrl-input" value={diskStdDev} onChange={e => onDiskStdDevChange(e.target.value)} placeholder="120" /></div>
              <div className="ctrl-field"><div className="ctrl-label">Halo Std Dev</div><input className="ctrl-input" value={haloStdDev} onChange={e => onHaloStdDevChange(e.target.value)} placeholder="800" /></div>
              <div className="ctrl-field"><div className="ctrl-label">Halo Ratio</div><input className="ctrl-input" value={haloRatio} onChange={e => onHaloRatioChange(e.target.value)} placeholder="0.15" /></div>
              <div className="ctrl-field"><div className="ctrl-label">Max Height</div><input className="ctrl-input" value={yMax} onChange={e => onYMaxChange(e.target.value)} placeholder="1500" /></div>
            </div>
          )}

          {yMode === 'curve' && (
            <>
              <div className="ctrl-field"><div className="ctrl-label">Max Height</div><input className="ctrl-input" value={yMax} onChange={e => onYMaxChange(e.target.value)} placeholder="1500" /></div>
              <YCurveEditor points={curvePoints} onChange={onCurvePointsChange} yMax={parseFloat(yMax) || 1500} />
            </>
          )}
        </div>
      </div>

    </div>
  );
}
