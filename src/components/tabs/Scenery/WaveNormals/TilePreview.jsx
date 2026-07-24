import React, { useEffect, useRef, useState } from 'react';
import { Dropdown } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import { renderComposite, renderLayer } from './renderPreview.js';

const VIEW_TABS = [
  { id: 'composite', label: 'Composite' },
  { id: 'shaded',    label: 'Layer' },
  { id: 'normal',    label: 'Normal' },
  { id: 'foam',      label: 'Foam α' },
];

const PATCHES = [60, 120, 250, 500, 1000];

/**
 * The preview is the arbiter for every parameter in this tab, so it renders the
 * composite the way the shader does — four layers summed, then normalised —
 * rather than showing one texture at a time. A layer on its own looks fine long
 * after the four of them together have stopped looking like water.
 */
export default function TilePreview({ layers, threshold, busy, progress }) {
  const canvasRef = useRef(null);
  const [view, setView]   = useState('composite');
  const [patch, setPatch] = useState(250);
  const [slot, setSlot]   = useState(0);
  const [foamOn, setFoamOn] = useState(true);
  const [renderMs, setRenderMs] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layers?.length) return;

    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const t0 = performance.now();

    const img = view === 'composite'
      ? renderComposite(layers, { size, patchMetres: patch, threshold, showFoam: foamOn })
      : renderLayer(layers[Math.min(slot, layers.length - 1)], { size, tiles: 2, channel: view });

    ctx.putImageData(img, 0, 0);
    setRenderMs(performance.now() - t0);
  }, [layers, view, patch, slot, threshold, foamOn]);

  const active = layers?.[Math.min(slot, (layers?.length ?? 1) - 1)];

  return (
    <div className="wn-preview">
      <div className="wn-preview-bar">
        {VIEW_TABS.map(t => (
          <button
            key={t.id}
            className={`wn-chip${view === t.id ? ' is-on' : ''}`}
            onClick={() => setView(t.id)}
          >{t.label}</button>
        ))}

        <span className="wn-preview-spacer" />

        {view === 'composite' ? (
          <>
            <label className="wn-preview-label">View</label>
            <Dropdown
              options={PATCHES.map(p => ({ value: p, label: `${p} m` }))}
              value={patch}
              onChange={setPatch}
              ariaLabel="Preview patch size"
            />
            <button
              className={`wn-chip${foamOn ? ' is-on' : ''}`}
              onClick={() => setFoamOn(v => !v)}
              title="Toggle the wave-crest overlay to judge the normals on their own"
            >Foam</button>
          </>
        ) : (
          <>
            <label className="wn-preview-label">Layer</label>
            <Dropdown
              options={(layers || []).map((l, i) => ({ value: i, label: `${i} — ${l.ogrids.toFixed(2)} ogrid` }))}
              value={slot}
              onChange={setSlot}
              ariaLabel="Preview layer"
            />
          </>
        )}
      </div>

      <div className="wn-preview-stage">
        {layers?.length
          ? <canvas ref={canvasRef} className="wn-preview-canvas" />
          : (
            <div className="wn-preview-empty">
              {busy
                ? <>Layer {(progress?.slot ?? 0) + 1} / {progress?.total ?? 4} — {progress?.label || 'working'}…</>
                : <>No bake yet. Set a sea state and run <strong>Bake layers</strong>.</>}
            </div>
          )}
        {busy && layers?.length ? <div className="wn-preview-veil">re-baking…</div> : null}
      </div>

      <div className="wn-preview-foot">
        {view === 'composite' ? (
          <>
            <span>{patch} m across · waveCrestThreshold {threshold.toFixed(2)}</span>
            <span className="wn-preview-sep">·</span>
            <span>sun lobe is an approximation — the normal and the foam threshold are not</span>
          </>
        ) : active ? (
          <>
            <span>{active.L.toFixed(1)} m tile · 2×2 repeats</span>
            <span className="wn-preview-sep">·</span>
            <span>rms slope {active.stats.rmsSlope.toFixed(3)} · mean α {active.stats.foamMean.toFixed(3)}</span>
          </>
        ) : null}
        {renderMs != null && <span className="wn-preview-ms">{renderMs.toFixed(0)} ms</span>}
      </div>
    </div>
  );
}
