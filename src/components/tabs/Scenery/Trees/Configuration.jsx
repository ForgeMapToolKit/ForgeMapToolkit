import React, { useState } from 'react';

export default function TreesConfiguration({
  mapName, setMapName, mapInfo,
  gridResolution, setGridResolution,
  densityMultiplier, setDensityMultiplier,
  diffusion, setDiffusion,
  onRandomize,
}) {
  const [metaOpen, setMetaOpen] = useState(false);

  return (
    <div className="ctrl-col">

      {/* ── Block 1: Map Info ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Map Info</div>
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

      {/* ── Block 2: Sampling ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Sampling</div>
        <div className="ctrl-content">
          <div className="ctrl-field">
            <div className="ctrl-label">Grid Resolution <span className="tm-grid-point-count">{(parseInt(gridResolution || '100', 10)) ** 2} pts</span></div>
            <input
              type="number" step="10" min="1" max="2000"
              className="ctrl-input"
              value={gridResolution}
              onChange={(e) => setGridResolution(e.target.value)}
              onBlur={(e) => { const v = parseInt(e.target.value, 10); if (isNaN(v) || v < 1) setGridResolution('1'); else if (v > 2000) setGridResolution('2000'); }}
            />
          </div>

          <div className="ctrl-action-row">
            <button className="ctrl-btn-add" onClick={onRandomize}>Randomize Seed</button>
          </div>
        </div>
      </div>

      {/* ── Block 3: Generation ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Generation</div>
        <div className="ctrl-content">
          <div className="tm-density-grid">
            <div className="ctrl-field">
              <div className="ctrl-label">Density Multiplier</div>
              <input
                type="number" step="0.1" min="0.00001"
                className="ctrl-input"
                value={densityMultiplier}
                onChange={(e) => setDensityMultiplier(e.target.value)}
                onBlur={(e) => { const v = parseFloat(e.target.value); if (isNaN(v) || v <= 0) setDensityMultiplier('0.00001'); }}
              />
            </div>
            <div className="ctrl-field">
              <div className="ctrl-label">Diffusion (0–100)</div>
              <input
                type="number" step="1" min="0" max="100"
                className="ctrl-input"
                value={diffusion}
                onChange={(e) => setDiffusion(e.target.value)}
                onBlur={(e) => { const v = parseFloat(e.target.value); if (isNaN(v) || v < 0) setDiffusion('0'); else if (v > 100) setDiffusion('100'); }}
              />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
