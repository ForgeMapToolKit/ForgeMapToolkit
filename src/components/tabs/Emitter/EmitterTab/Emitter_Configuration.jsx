import React from 'react';

export default function EmitterConfiguration({
  mapName, setMapName, mapInfo,
  globalRandomness, setGlobalRandomness,
  maskFileInputRef, maskImageData, handleMaskUpload,
  maskScanMode, setMaskScanMode, maskPreviewUrl, maskWidth, maskHeight, onRemoveMask,
  emitterPaths, updateEmitterPath, resolveEmitterPath, deleteEmitterPath,
  onAddEmitter, onOpenLibrary,
}) {
  return (
    <>
      <div className="form-group">
        <label className="field-label">Map Name</label>
        <input
          type="text"
          className="field-input"
          placeholder="e.g. Hades_Dust.v0002"
          value={mapName}
          onChange={e => setMapName(e.target.value)}
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

      {/* Global Randomness */}
      <div className="subsection-head">
        <span className="subsection-head-title">Global Randomness</span>
      </div>
      <div className="form-group">
        <label className="field-label">Poisson Min. Distance</label>
        <input
          type="number"
          min="0"
          className="field-input"
          placeholder="0"
          value={globalRandomness.poissonRadius}
          onChange={e => setGlobalRandomness(prev => ({ ...prev, poissonRadius: e.target.value }))}
        />
      </div>

      {/* Area Mask */}
      <div className="subsection-head">
        <span className="subsection-head-title">Area Mask</span>
      </div>
      <div className="em-mask-upload" onClick={() => maskFileInputRef.current?.click()}>
        <span>{maskImageData ? 'Mask loaded — click to replace' : 'Click to upload mask image (B/W)'}</span>
        <input
          ref={maskFileInputRef}
          type="file"
          style={{ display: 'none' }}
          accept="image/*"
          onChange={handleMaskUpload}
        />
      </div>
      <div className="form-group">
        <label className="field-label">Dark Pixel Behaviour</label>
        <select
          className="field-select"
          value={maskScanMode}
          onChange={e => setMaskScanMode(e.target.value)}
        >
          <option value="right">Slide Right — shift emitter rightward to next white pixel</option>
          <option value="left">Slide Left — shift emitter leftward to next white pixel</option>
          <option value="ignore">Ignore — skip emitter entirely on dark pixels</option>
        </select>
      </div>
      {maskPreviewUrl && (
        <div className="em-mask-preview">
          <img
            src={maskPreviewUrl}
            alt="Area Mask Preview"
            className="em-mask-img"
          />
          <div className="em-mask-dim">{maskWidth} × {maskHeight} px</div>
        </div>
      )}
      {maskImageData && (
        <button
          className="action-button action-button--danger action-button--full"
          style={{ marginBottom: 'var(--space-md)' }}
          onClick={onRemoveMask}
        >Remove Mask</button>
      )}

      {/* Emitter Paths */}
      <div className="subsection-head" style={{ marginTop: 'var(--space-xl)' }}>
        <span className="subsection-head-title">Emitter Paths</span>
      </div>
      <div className="form-group">
        <label className="field-label">Emitters (_emit.bp)</label>
        {emitterPaths.map((path, pi) => (
          <div key={pi} className="ec-input-row">
            <input
              type="text"
              className="field-input field-input--mono"
              placeholder="/effects/emitters/weather_sand_01_emit.bp"
              value={path}
              onChange={e => updateEmitterPath(pi, e.target.value)}
              onBlur={e => resolveEmitterPath(pi, e.target.value)}
            />
            <button className="delete-button" onClick={() => deleteEmitterPath(pi)}>×</button>
          </div>
        ))}
        <button className="action-button action-button--full" style={{ marginBottom: 'var(--space-xs)' }} onClick={onAddEmitter}>
          Add Emitter
        </button>
        <button className="action-button action-button--full" onClick={onOpenLibrary}>
          Library
        </button>
      </div>
    </>
  );
}
