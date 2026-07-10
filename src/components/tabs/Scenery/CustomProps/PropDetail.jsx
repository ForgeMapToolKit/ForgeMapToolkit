import React from 'react';
import PropPreviewImg from './PropPreviewImg.jsx';

const FILE_TYPES = [
  { ext: '_prop.bp',       label: 'Blueprint' },
  { ext: '_lod0.scm',      label: 'Mesh' },
  { ext: '_albedo.dds',    label: 'Albedo' },
  { ext: '_normalsTS.dds', label: 'Normal Map' },
];

const CUSTOM_FILE_TYPES = [
  { ext: '_prop.bp',       label: 'Blueprint' },
  { ext: '_lod0.scm',      label: 'Mesh (copied)' },
  { ext: '_albedo.dds',    label: 'Albedo (adjusted)' },
  { ext: '_normalsTS.dds', label: 'Normal Map (copied)' },
];

const SLIDERS = [
  { key: 'hue',        label: 'Hue',        min: 0, max: 360, defaultVal: 0,   unit: '°' },
  { key: 'saturation', label: 'Saturation', min: 0, max: 200, defaultVal: 100, unit: '%' },
  { key: 'brightness', label: 'Brightness', min: 0, max: 200, defaultVal: 100, unit: '%' },
  { key: 'contrast',   label: 'Contrast',   min: 0, max: 200, defaultVal: 100, unit: '%' },
  { key: 'gamma',      label: 'Gamma',      min: 0, max: 200, defaultVal: 100, unit: '%' },
];

// ────────────────────────────────────────────────────────────────────────────
// PropDetail — shown in the aside when a prop is selected
// ────────────────────────────────────────────────────────────────────────────
export default function PropDetail({ entry }) {
  const { originalProp, adjustments, targetBpPath } = entry;
  const hasAdj = !!adjustments;

  const origPath = originalProp.gamePath || originalProp.resolvedPath || originalProp.id;
  const origDir  = origPath.replace(/\/[^/]+$/, '');
  const origBase = origPath.split('/').pop().replace(/_prop\.bp$/i, '').replace(/\.bp$/i, '');

  const customDir  = hasAdj ? targetBpPath.replace(/\/[^/]+$/, '') : null;
  const customBase = hasAdj ? targetBpPath.split('/').pop().replace(/_prop\.bp$/i, '') : null;

  return (
    <>
      {/* ── Identity header ── */}
      <div className="ctrl-block">
        <div className="cpt-detail-header">
          {originalProp.previewUrl ? (
            <PropPreviewImg className="cpt-detail-thumb" src={originalProp.previewUrl} alt={originalProp.name} />
          ) : (
            <div className="cpt-detail-thumb-placeholder" />
          )}
          <div className="cpt-detail-title-wrap">
            <div className="cpt-detail-name">{originalProp.name || originalProp.id}</div>
            <div className="cpt-detail-path">{targetBpPath}</div>
            {(originalProp.biome || originalProp.source) && (
              <div className="cpt-detail-meta">
                {originalProp.biome && <span>Biome: <strong>{originalProp.biome}</strong></span>}
                {originalProp.biome && originalProp.source && <span> · </span>}
                {originalProp.source && <span>Source: <strong>{originalProp.source}</strong></span>}
              </div>
            )}
          </div>
          {hasAdj && <div className="cpt-adj-indicator">Custom Texture</div>}
        </div>
      </div>

      {/* ── Texture Adjustments ── */}
      {hasAdj && (
        <div className="ctrl-block">
          <div className="mp-subtitle">Texture Adjustments</div>
          <div className="cpt-sliders">
            {SLIDERS.map(({ key, label, min, max, defaultVal, unit }) => {
              const value = adjustments[key] ?? defaultVal;
              const pct = ((value - min) / (max - min)) * 100;
              const defaultPct = ((defaultVal - min) / (max - min)) * 100;
              const fillLeft  = Math.min(pct, defaultPct);
              const fillWidth = Math.abs(pct - defaultPct);
              const isChanged = value !== defaultVal;
              const display = unit === '°' && value > 0 ? `+${value}°` : `${value}${unit}`;
              return (
                <div key={key} className="cpt-slider-row">
                  <div className="cpt-slider-header">
                    <span className="cpt-slider-label">{label}</span>
                    <span className={`cpt-slider-val${isChanged ? ' changed' : ''}`}>{display}</span>
                  </div>
                  <div className="cpt-slider-track-wrap">
                    <div className="cpt-slider-track" />
                    <div className="cpt-slider-fill" style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }} />
                    <input type="range" className="cpt-slider-input"
                      min={min} max={max} value={value} readOnly onChange={() => {}} />
                  </div>
                </div>
              );
            })}
            {(adjustments.tint?.opacity > 0 || adjustments.selectiveColor?.enabled || adjustments.selection?.enabled) && (
              <div className="cpt-badge-row">
                {adjustments.tint?.opacity > 0 && (
                  <span className="cpt-prop-badge custom">Tint · {adjustments.tint.opacity}%</span>
                )}
                {adjustments.selectiveColor?.enabled && (
                  <span className="cpt-prop-badge custom">Selective Color</span>
                )}
                {adjustments.selection?.enabled && (
                  <span className="cpt-prop-badge custom">Color Selection</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Pass 1: Original files ── */}
      <div className="ctrl-block">
        <div className="mp-subtitle">
          Pass 1 — Original
          <span className="cpt-prop-badge cpt-subtitle-badge">source</span>
        </div>
        <div className="cpt-pass-dir">{origDir}/</div>
        <div className="cpt-pass-files">
          {FILE_TYPES.map(f => (
            <div key={f.ext} className="cpt-pass-file">
              <div className="cpt-pass-file-info">
                <span className="cpt-pass-file-name">{origBase}{f.ext}</span>
                <span className="cpt-pass-file-label">{f.label} · game source</span>
              </div>
            </div>
          ))}
        </div>
        <div className="cpt-pass-note">Read-only game files — used as source for texture generation</div>
      </div>

      {/* ── Pass 2: Custom generated files (only if adjustments) ── */}
      {hasAdj && (
        <div className="ctrl-block">
          <div className="mp-subtitle">
            Pass 2 — Custom
            <span className="cpt-prop-badge custom cpt-subtitle-badge">output</span>
          </div>
          <div className="cpt-pass-dir cpt-pass-dir-custom">{customDir}/</div>
          <div className="cpt-pass-files">
            {CUSTOM_FILE_TYPES.map(f => (
              <div key={f.ext} className="cpt-pass-file custom">
                <div className="cpt-pass-file-info">
                  <span className="cpt-pass-file-name">{customBase}{f.ext}</span>
                  <span className="cpt-pass-file-label">{f.label}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="cpt-pass-note cpt-pass-note-custom">
            Written to map directory with texture adjustments applied
          </div>
        </div>
      )}

      {/* No-adjustment note */}
      {!hasAdj && (
        <div className="ctrl-block">
          <div className="cpt-info-card">
            <span className="cpt-info-text">
              No texture adjustments — this prop uses <strong>original game files</strong> directly.
              No files will be generated; the blueprint path above is referenced as-is.
            </span>
          </div>
        </div>
      )}
    </>
  );
}
