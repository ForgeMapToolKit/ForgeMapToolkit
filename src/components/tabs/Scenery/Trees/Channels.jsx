import React from 'react';
import { DropSlot } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

export default function TreesChannels({
  densityMap, onDensityMapUpload, onDensityMapClear,
  heightmap, onHeightmapUpload, onHeightmapClear,
  treeline, setTreeline, treelineGradient, setTreelineGradient,
  treelineMin, setTreelineMin, treelineMinGradient, setTreelineMinGradient,
  exclusionZone, onExclusionZoneUpload, onExclusionZoneClear,
}) {
  return (
    <div className="ctrl-col">

      {/* ── Density Map ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Density Map</div>
        <div className="ctrl-content">
          <DropSlot
            acceptInput="image/*"
            status={densityMap ? 'done' : 'idle'}
            idleText="Click or drop a greyscale density mask"
            doneText="Density Map loaded"
            onChange={onDensityMapUpload}
            onClear={onDensityMapClear}
          />
        </div>
      </div>

      {/* ── Treeline Heightmap ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Treeline Heightmap</div>
        <div className="ctrl-content">
          <DropSlot
            acceptInput="image/*"
            status={heightmap ? 'done' : 'idle'}
            idleText="Click or drop a greyscale heightmap"
            doneText="Heightmap loaded"
            onChange={onHeightmapUpload}
            onClear={onHeightmapClear}
          />

          {heightmap && (
            <div className="tm-cutoff-grid">
              <div className="ctrl-field">
                <div className="ctrl-label">Treeline Cutoff (0–255) <span className="tm-slider-value">{treeline}</span></div>
                <input type="range" min="0" max="255" step="1" value={treeline} onChange={(e) => setTreeline(e.target.value)} />
                <input type="number" min="0" max="255" step="1" className="ctrl-input tm-slider-number" value={treeline} onChange={(e) => setTreeline(e.target.value)} />
              </div>
              <div className="ctrl-field">
                <div className="ctrl-label">Gradient Width <span className="tm-slider-value">{treelineGradient}</span></div>
                <input type="range" min="0" max="255" step="1" value={treelineGradient} onChange={(e) => setTreelineGradient(e.target.value)} />
                <input type="number" min="0" max="255" step="1" className="ctrl-input tm-slider-number" value={treelineGradient} onChange={(e) => setTreelineGradient(e.target.value)} />
              </div>
              <div className="ctrl-field">
                <div className="ctrl-label">Treeline Min (0–255) <span className="tm-slider-value">{treelineMin}</span></div>
                <input type="range" min="0" max="255" step="1" value={treelineMin} onChange={(e) => setTreelineMin(e.target.value)} />
                <input type="number" min="0" max="255" step="1" className="ctrl-input tm-slider-number" value={treelineMin} onChange={(e) => setTreelineMin(e.target.value)} />
              </div>
              <div className="ctrl-field">
                <div className="ctrl-label">Min Gradient Width <span className="tm-slider-value">{treelineMinGradient}</span></div>
                <input type="range" min="0" max="255" step="1" value={treelineMinGradient} onChange={(e) => setTreelineMinGradient(e.target.value)} />
                <input type="number" min="0" max="255" step="1" className="ctrl-input tm-slider-number" value={treelineMinGradient} onChange={(e) => setTreelineMinGradient(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Exclusion Zone ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Exclusion Zone</div>
        <div className="ctrl-content">
          <DropSlot
            acceptInput="image/*"
            status={exclusionZone ? 'done' : 'idle'}
            idleText="Click or drop a greyscale exclusion mask"
            doneText="Exclusion Zone loaded"
            onChange={onExclusionZoneUpload}
            onClear={onExclusionZoneClear}
          />
        </div>
      </div>

    </div>
  );
}
