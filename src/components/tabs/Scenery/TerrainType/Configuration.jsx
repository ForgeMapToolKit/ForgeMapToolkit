import React, { useState } from 'react';

/**
 * TerrainType · Section 01 — Configuration.
 * Presentational: map name input, analyze trigger, decoded strata meta.
 */
export default function TerrainTypeConfiguration({
  mapName, setMapName, mapInfo,
  onAnalyze, loading, error,
  strata,
}) {
  const [metaOpen, setMetaOpen] = useState(false);

  return (
    <div className="ctrl-col">
      {/* ── Map ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Map</div>
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

            {mapName && metaOpen && mapInfo && (
              <div className="ctrl-mapinfo">
                {mapInfo.ok ? (
                  <>
                    <span className="ctrl-badge ctrl-badge--ok">Map</span>
                    <span>{mapInfo.mapSize} × {mapInfo.mapSize}</span>
                    <span className="ctrl-mapinfo-sep">·</span>
                    <span>{mapInfo.km} km</span>
                  </>
                ) : (
                  <span className="ctrl-mapinfo-err">{mapInfo.error}</span>
                )}
              </div>
            )}
          </div>

          <div className="ctrl-action-row">
            <button className="ctrl-btn-add" onClick={onAnalyze} disabled={loading}>
              {loading ? 'Analyzing…' : 'Analyze Strata'}
            </button>
          </div>

          {error && <div className="tt-error">{error}</div>}
        </div>
      </div>

      {/* ── Detected ── */}
      {strata && (
        <div className="ctrl-block">
          <div className="ctrl-subtitle">Detected</div>
          <div className="ctrl-content">
            <div className="tt-meta">
              <span>Shader <b>{strata.shaderPath || '—'}</b></span>
              <span>Grid {strata.size[0]}×{strata.size[1]}</span>
              <span>Masks {strata.maskResolution?.[0]}²</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
