import React from 'react';

export default function WreckageConfiguration({
  mapName, setMapName, mapInfo,
  blueprintPaths, updateBlueprintPath, deleteBlueprintPath, resolveEmitterPath,
  emittersRef, onAddEmitter, onOpenLibrary,
}) {
  return (
    <>
      <div style={{ marginBottom: '20px' }}>
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

      <div ref={emittersRef}>
        <label className="field-label">Emitters</label>
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
            <div key={idx} className="ec-input-row">
              <input
                type="text"
                className="field-input"
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
              <button className="delete-button" onClick={() => deleteBlueprintPath(idx)}>×</button>
            </div>
          );
        })}

        <button
          onClick={onAddEmitter}
          className="action-button action-button--full"
          style={{ marginBottom: '8px' }}
        >
          Add Emitter
        </button>

        <button
          onClick={onOpenLibrary}
          className="action-button action-button--full"
        >
          Library
        </button>
      </div>
    </>
  );
}
