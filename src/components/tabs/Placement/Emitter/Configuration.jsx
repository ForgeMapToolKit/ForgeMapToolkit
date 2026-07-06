import React, { useState } from 'react';

export default function EmitterConfiguration({
  mapName, setMapName, mapInfo,
  emitterPaths, updateEmitterPath, resolveEmitterPath, deleteEmitterPath,
  onAddEmitter, onOpenLibrary,
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
              placeholder="e.g. Hades_Dust.v0002"
              value={mapName}
              onChange={e => setMapName(e.target.value)}
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

      {/* ── Block 2: Emitter Paths ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Emitters</div>
        <div className="ctrl-content">
          <div className="ctrl-row-gap">
            {emitterPaths.map((path, pi) => (
              <div key={pi} className="ctrl-row">
                <input
                  type="text"
                  className="ctrl-input"
                  placeholder="/effects/emitters/weather_sand_01_emit.bp"
                  value={path}
                  onChange={e => updateEmitterPath(pi, e.target.value)}
                  onBlur={e => resolveEmitterPath(pi, e.target.value)}
                />
                <button className="ctrl-btn-delete" onClick={() => deleteEmitterPath(pi)}>×</button>
              </div>
            ))}
          </div>
          <div className="ctrl-action-row">
            <button className="ftr-preview-readmore" onClick={onOpenLibrary}>Library</button>
            <button className="ctrl-btn-add" onClick={onAddEmitter}>Add Emitter</button>
          </div>
        </div>
      </div>

    </div>
  );
}
