/**
 * Objects.jsx — the Layout workspace's object list: what's standing on the
 * floor, in insertion order (which is also the order the engine lines them up
 * in — see Scene3D/engine.js `layout()`).
 *
 * Three ways an object gets here, one list to hold them: a library prop
 * (brings its own UniformScale), a reference unit from the user's own
 * installation (a known "how big is a tank" yardstick), or a loose `.scm`
 * drop (no blueprint, so no scale — the slider under it is the only source).
 *
 * Rein präsentational: Props rein, JSX raus.
 */

import React, { useRef, useState } from 'react';
import { REFERENCE_UNITS } from './referenceUnits.js';
import { OGRID_METRES } from '../../../Shared/Ocean/faWater.js';

const SCALE_PRESETS = [0.025, 0.05, 0.1, 0.2, 0.25, 1];

const fmt = (n, digits = 2) => (n == null || Number.isNaN(n) ? '—' : n.toFixed(digits));

/** Measured extent in ogrids: raw mesh bounds scaled by the object's scale. */
function extent(asset) {
  if (!asset) return null;
  const { min, max } = asset.mesh.bounds;
  const s = asset.scale || 1;
  return { x: (max[0] - min[0]) * s, y: (max[1] - min[1]) * s, z: (max[2] - min[2]) * s };
}

const Objects = ({
  objects, hasInstall,
  onOpenLibrary, onAddReference, onDroppedMesh, onLooseScale,
  onRemove, onToggleVisible, onSelect, activeId,
}) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const takeFiles = (fileList) => {
    const files = [...(fileList || [])];
    const scm = files.find(f => /\.scm$/i.test(f.name));
    const dds = files.find(f => /\.dds$/i.test(f.name));
    if (!scm) return;
    onDroppedMesh(scm, dds || null);
  };

  return (
    <section className="v3-panel">
      <div className="ctrl-subtitle ctrl-subtitle--flush">Objects</div>

      <div className="ctrl-field">
        <button className="ctrl-btn-add v3-full" onClick={onOpenLibrary}>Browse Props Library</button>
      </div>

      {hasInstall && (
        <div className="ctrl-field">
          <div className="v3-ref-list">
            {REFERENCE_UNITS.map(u => (
              <button key={u.id} className="v3-ref" onClick={() => onAddReference(u.id)} title={u.note}>
                <span className="v3-ref-label">+ {u.label}</span>
                <span className="v3-ref-id">{u.id}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        className={`v3-drop${dragging ? ' is-dragging' : ''}`}
        onDragEnter={e => { e.preventDefault(); setDragging(true); }}
        onDragOver={e => e.preventDefault()}
        onDragLeave={e => { e.preventDefault(); setDragging(false); }}
        onDrop={e => { e.preventDefault(); setDragging(false); takeFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      >
        <span className="v3-drop-label">Drop a mesh</span>
        <span className="v3-drop-hint">.scm, plus its _albedo.dds</span>
        <input
          ref={inputRef} type="file" accept=".scm,.dds" multiple
          className="v3-file-input"
          onChange={e => { takeFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {!hasInstall && (
        <div className="v3-note">
          Reference units need a Supreme Commander install path — set it in Settings.
          They are read from your own installation and never bundled.
        </div>
      )}

      <div className="v3-obj-list">
        {objects.length === 0 && (
          <div className="v3-readout-empty v3-obj-empty">Nothing here yet — browse, drop, or add a reference.</div>
        )}
        {objects.map(o => {
          const size = extent(o.asset);
          const isLoose = o.kind === 'loose';
          return (
            <div key={o.id} className={`v3-obj${activeId === o.id ? ' is-active' : ''}`} onClick={() => onSelect(o.id)}>
              <div className="v3-obj-row">
                <label className="v3-check" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={o.visible} onChange={e => onToggleVisible(o.id, e.target.checked)} />
                </label>
                <div className="v3-obj-name" title={o.label}>{o.label}</div>
                <button className="ctrl-btn-meta" onClick={e => { e.stopPropagation(); onRemove(o.id); }}>×</button>
              </div>

              {o.loading && <div className="v3-note">Loading…</div>}
              {o.error && <div className="v3-panel-error">{o.error}</div>}
              {size && (
                <div className="v3-obj-size">
                  {fmt(size.x)} × {fmt(size.y)} × {fmt(size.z)} ogrids
                  <span className="v3-fact-aside">≈ {fmt(size.x * OGRID_METRES, 1)} × {fmt(size.z * OGRID_METRES, 1)} m nominal</span>
                </div>
              )}

              {isLoose && o.asset && (
                <div className="v3-scale-row" onClick={e => e.stopPropagation()}>
                  {SCALE_PRESETS.map(v => (
                    <button
                      key={v}
                      className={`ctrl-btn-meta v3-scale${Math.abs((o.looseScale ?? 0.05) - v) < 1e-6 ? ' is-on' : ''}`}
                      onClick={() => onLooseScale(o.id, v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default Objects;
