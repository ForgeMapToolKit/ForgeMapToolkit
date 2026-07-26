/**
 * Source.jsx — Sektion 02: woher das Objekt kommt.
 *
 * Zwei Wege, dieselbe Anzeige: ein Prop aus der Library (bringt seine
 * UniformScale mit) oder eine lose `.scm` per Drop (bringt sie nicht — dann ist
 * der Regler die einzige Quelle, und ohne ihn wäre das Mesh rund zwanzigmal zu
 * groß).
 *
 * Rein präsentational: Props rein, JSX raus.
 */

import React, { useRef, useState } from 'react';

const SCALE_PRESETS = [0.025, 0.05, 0.1, 0.2, 0.25, 1];

const Source = ({
  subject, loading, error, sourceBp, looseScale,
  onOpenLibrary, onDroppedMesh, onLooseScale, onClear,
}) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const isLoose  = !!subject && subject.blueprint.uniformScale == null;

  const takeFiles = (fileList) => {
    const files = [...(fileList || [])];
    const scm = files.find(f => /\.scm$/i.test(f.name));
    const dds = files.find(f => /\.dds$/i.test(f.name));
    if (!scm) return;
    onDroppedMesh(scm, dds || null);
  };

  return (
    <section className="v3-panel">
      <div className="ctrl-subtitle ctrl-subtitle--flush">Source</div>

      <div className="ctrl-field">
        <button className="ctrl-btn-add v3-full" onClick={onOpenLibrary} disabled={loading}>
          Browse Props Library
        </button>
      </div>

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
          ref={inputRef}
          type="file"
          accept=".scm,.dds"
          multiple
          className="v3-file-input"
          onChange={e => { takeFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {subject && (
        <div className="v3-current">
          <div className="v3-current-name" title={sourceBp || subject.blueprint.meshPath}>
            {subject.blueprint.name}
          </div>
          <button className="ctrl-btn-meta" onClick={onClear}>Clear</button>
        </div>
      )}

      {/* A loose mesh has no blueprint, so nothing declares its scale. Showing
          the raw mesh would put a rock at twenty ogrids — the presets are the
          values vanilla props actually use. */}
      {isLoose && (
        <div className="ctrl-field">
          <div className="ctrl-label">Uniform Scale</div>
          <div className="v3-scale-row">
            {SCALE_PRESETS.map(v => (
              <button
                key={v}
                className={`ctrl-btn-meta v3-scale${Math.abs(looseScale - v) < 1e-6 ? ' is-on' : ''}`}
                onClick={() => onLooseScale(v)}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="v3-note">
            No blueprint to read this from — vanilla props sit between 0.025 and 0.25.
          </div>
        </div>
      )}

      {error && <div className="v3-panel-error">{error}</div>}
    </section>
  );
};

export default Source;
