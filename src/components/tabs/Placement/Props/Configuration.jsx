import React, { useState } from 'react';

export default function PropsConfiguration({
  mapName, setMapName, mapInfo,
  emitters, updateEmitter, deleteEmitter, onAddEmitter, onOpenLibrary,
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

      {/* ── Block 2: Emitters ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Emitters</div>
        <div className="ctrl-content">
          <div className="ctrl-row-gap">
            {emitters.map((emitter, idx) => {
              const ABSOLUTE_PREFIXES = ['/maps/', '/effects/', '/env/', '/textures/', '/units/', '/projectiles/'];
              const isAbsolute = ABSOLUTE_PREFIXES.some(p => emitter.startsWith(p));
              const displayValue = (mapName && emitter && !isAbsolute)
                ? `/maps/${mapName.match(/\.v\d{4}$/) ? mapName : mapName + '.v0001'}/${emitter.startsWith('/') ? emitter.substring(1) : emitter}`
                : emitter;
              return (
                <div key={idx} className="ctrl-row">
                  <input
                    type="text"
                    className="ctrl-input"
                    value={displayValue}
                    onChange={(e) => {
                      let newVal = e.target.value;
                      if (mapName) {
                        const finalMapName = mapName.match(/\.v\d{4}$/) ? mapName : mapName + '.v0001';
                        const prefix = `/maps/${finalMapName}/`;
                        if (newVal.startsWith(prefix)) newVal = '/' + newVal.substring(prefix.length);
                      }
                      updateEmitter(idx, newVal);
                    }}
                    placeholder="/env/Desert/Props/Emitters/DesertBlowingSand02_prop.bp"
                  />
                  <button className="ctrl-btn-delete" onClick={() => deleteEmitter(idx)}>×</button>
                </div>
              );
            })}
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
