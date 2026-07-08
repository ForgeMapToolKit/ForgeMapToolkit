import React, { useState } from 'react';

export default function RockErosionConfiguration({
  mapName, setMapName, mapInfo,
  gridResolution, setGridResolution,
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
            <div className="ctrl-label">Grid Resolution</div>
            <input
              type="number" min="1"
              className="ctrl-input"
              placeholder="128"
              value={gridResolution}
              onChange={(e) => setGridResolution(e.target.value)}
            />
          </div>

          <div className="ctrl-action-row">
            <button className="ctrl-btn-add" onClick={onRandomize}>Randomize Seed</button>
          </div>
        </div>
      </div>

    </div>
  );
}
