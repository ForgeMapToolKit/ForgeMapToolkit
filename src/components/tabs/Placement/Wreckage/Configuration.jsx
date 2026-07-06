import React, { useState } from 'react';

export default function WreckageConfiguration({
  mapName, setMapName, mapInfo,
  blueprintPaths, updateBlueprintPath, deleteBlueprintPath, resolveEmitterPath,
  emittersRef, onAddEmitter, onOpenLibrary,
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
              placeholder="Map name — e.g. Hades_Dust.v0002"
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

      {/* ── Block 2: Emitters ── */}
      <div className="ctrl-block" ref={emittersRef}>
        <div className="ctrl-subtitle">Emitters</div>
        <div className="ctrl-content">
          <div className="ctrl-row-gap">
            {blueprintPaths.map((path, idx) => {
              let displayPath = path;
              if (mapName && path &&
                  !path.startsWith('/maps/') &&
                  !path.startsWith('/effects/') &&
                  !path.startsWith('/env/') &&
                  !path.startsWith('/textures/') &&
                  !path.startsWith('/units/') &&
                  !path.startsWith('/projectiles/')) {
                let finalMapName = mapName.trim();
                if (finalMapName && !finalMapName.match(/\.v\d{4}$/)) {
                  finalMapName += '.v0001';
                }
                const relativePath = path.startsWith('/') ? path.substring(1) : path;
                displayPath = `/maps/${finalMapName}/${relativePath}`;
              }
              return (
                <div key={idx} className="ctrl-row">
                  <input
                    type="text"
                    className="ctrl-input"
                    value={displayPath}
                    onChange={(e) => {
                      let newPath = e.target.value;
                      if (mapName && newPath.startsWith('/maps/')) {
                        let finalMapName = mapName.trim();
                        if (finalMapName && !finalMapName.match(/\.v\d{4}$/)) {
                          finalMapName += '.v0001';
                        }
                        const prefix = `/maps/${finalMapName}/`;
                        if (newPath.startsWith(prefix)) {
                          newPath = '/' + newPath.substring(prefix.length);
                        }
                      }
                      updateBlueprintPath(idx, newPath);
                    }}
                    onBlur={(e) => {
                      let val = e.target.value;
                      if (mapName && val.startsWith('/maps/')) {
                        let finalMapName = mapName.trim();
                        if (finalMapName && !finalMapName.match(/\.v\d{4}$/)) finalMapName += '.v0001';
                        const prefix = `/maps/${finalMapName}/`;
                        if (val.startsWith(prefix)) val = '/' + val.substring(prefix.length);
                      }
                      resolveEmitterPath(idx, val);
                    }}
                    placeholder="/effects/emitters/weather_sand_01_emit.bp"
                  />
                  <button
                    className="ctrl-btn-delete"
                    onClick={() => deleteBlueprintPath(idx)}
                  >×</button>
                </div>
              );
            })}
          </div>

          <div className="ctrl-action-row">
            <button className="ftr-preview-readmore" onClick={onOpenLibrary}>
              Library
            </button>
            <button className="ctrl-btn-add" onClick={onAddEmitter}>
              Add Emitter
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
