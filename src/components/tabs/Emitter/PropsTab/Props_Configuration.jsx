import React from 'react';

export default function PropsConfiguration({
  mapName, setMapName, mapInfo,
  emitters, updateEmitter, deleteEmitter, onAddEmitter, onOpenLibrary,
}) {
  return (
    <>
      <div className="form-group">
        <label className="field-label">Map Name</label>
        <input
          type="text"
          className="field-input"
          value={mapName}
          onChange={(e) => setMapName(e.target.value)}
          placeholder="e.g. Hades_Dust.v0002"
        />
        {mapInfo && (
          <div className="ec-map-info">
            {mapInfo.ok ? (<>
              <span className="ec-map-info-tag">Map</span>
              <span className="ec-map-info-size">{mapInfo.mapSize} × {mapInfo.mapSize}</span>
              <span className="ec-map-info-sep">·</span>
              <span>{mapInfo.km} km</span>
              {mapInfo.playableSize !== mapInfo.mapSize && (<>
                <span className="ec-map-info-sep">·</span>
                <span>playable {mapInfo.playableKm} km</span>
              </>)}
            </>) : (
              <span className="ec-map-info-err">{mapInfo.error}</span>
            )}
          </div>
        )}
        {mapName && (
          <div className="ec-path-hint">
            {`Saves to: /maps/${mapName.match(/\.v\d{4}$/) ? mapName : mapName + '.v0001'}/`}
          </div>
        )}
      </div>
      <div className="form-group">
        <label className="field-label">Emitters</label>
        {emitters.map((emitter, idx) => {
          const ABSOLUTE_PREFIXES = ['/maps/', '/effects/', '/env/', '/textures/', '/units/', '/projectiles/'];
          const isAbsolute = ABSOLUTE_PREFIXES.some(p => emitter.startsWith(p));
          const displayValue = (mapName && emitter && !isAbsolute)
            ? `/maps/${mapName.match(/\.v\d{4}$/) ? mapName : mapName + '.v0001'}/${emitter.startsWith('/') ? emitter.substring(1) : emitter}`
            : emitter;
          return (
            <div key={idx} className="ec-input-row">
              <input
                type="text"
                className="field-input"
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
              <button className="delete-button" onClick={() => deleteEmitter(idx)}>×</button>
            </div>
          );
        })}
        <button onClick={onAddEmitter} className="action-button action-button--full" style={{ marginBottom: '8px' }}>Add Emitter</button>
        <button onClick={onOpenLibrary} className="action-button action-button--full">Library</button>
      </div>
    </>
  );
}
