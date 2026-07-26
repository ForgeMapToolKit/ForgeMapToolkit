import React, { useState } from 'react';

/**
 * BiomeChanger · Section 01 — Configuration.
 * Presentational: map name, the read trigger, what was found, and the capture
 * escape hatch that turns the map you are looking at into a preset.
 */
export default function BiomeConfiguration({
  mapName, setMapName, mapInfo,
  onRead, loading, error,
  biome, onCapture,
}) {
  const [metaOpen, setMetaOpen] = useState(false);

  const families = biome?.props?.byFamily?.filter(f => f.family !== 'unknown') || [];

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
              disabled={loading}
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
            <button className="ctrl-btn-add" onClick={onRead} disabled={loading}>
              {loading ? 'Reading…' : 'Read Biome'}
            </button>
          </div>

          {error && <div className="bc-error">{error}</div>}
        </div>
      </div>

      {/* ── What the map wears today ── */}
      {biome && (
        <div className="ctrl-block">
          <div className="ctrl-subtitle">Current Biome</div>
          <div className="ctrl-content">
            <div className="bc-meta">
              <span>Grid <b>{biome.size?.[0]}×{biome.size?.[1]}</b></span>
              <span>Format <b>v{biome.version}</b></span>
              <span>Shader <b>{biome.shaderPath || '—'}</b></span>
              <span>Skybox <b>{biome.skybox ? 'present' : 'none'}</b></span>
              <span>Props <b>{biome.props?.total?.toLocaleString() ?? 0}</b></span>
              <span>Water <b>{biome.waterLevels?.waterPresent ? `at ${biome.waterLevels.elevation}` : 'none'}</b></span>
            </div>

            {families.length > 0 && (
              <div className="bc-families">
                {families.map(f => (
                  <span className="bc-family" key={f.family}>
                    {f.family}<i>{f.count}</i>
                  </span>
                ))}
              </div>
            )}

            {/* Leise (§1 level 3) — the way to fill biomePresets.js without
                typing a single game path. */}
            <div className="ctrl-action-row">
              <button className="ctrl-btn-meta" onClick={onCapture}>
                Capture as preset →  clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
