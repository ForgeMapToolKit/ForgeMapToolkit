import React, { useRef, useEffect } from 'react';
import { Dropdown } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

/**
 * TerrainType · Section 02 — Layers.
 * Blend controls + the nine layer→terrain-type rows, each showing the layer's
 * stratum mask and albedo texture side by side. The picker is the shared
 * `Dropdown` (same control as the mirror-mode dropdown), not a raw <select>.
 */

// Small grayscale render of one stratum's mask channel (already at grid res).
function MaskThumb({ mask, ch, size }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!mask || ch < 0 || !size) return;
    const off = document.createElement('canvas');
    off.width = size; off.height = size;
    const oimg = off.getContext('2d').createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = mask[i * 4 + ch];
      oimg.data[i * 4] = v; oimg.data[i * 4 + 1] = v; oimg.data[i * 4 + 2] = v; oimg.data[i * 4 + 3] = 255;
    }
    off.getContext('2d').putImageData(oimg, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, cv.width, cv.height);
  }, [mask, ch, size]);
  return <canvas ref={ref} width={72} height={72} className="tt-thumb" />;
}

// Decoded albedo thumbnail ({ w, h, rgba }) fetched from the game files.
function AlbedoThumb({ data }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!data?.rgba) return;
    const off = document.createElement('canvas');
    off.width = data.w; off.height = data.h;
    off.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.rgba), data.w, data.h), 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, cv.width, cv.height);
  }, [data]);
  return <canvas ref={ref} width={72} height={72} className="tt-thumb" />;
}

export default function TerrainTypeLayers({
  slots, textures, counts, total,
  slotToId, onSetSlot, typeOptions, typeById,
  slotPalette,
  maskLow, maskHigh, maskSize, albedoThumbs,
  ignoredStrata = [], onToggleIgnore,
  threshold, onThreshold, halfRange, onHalfRange,
}) {
  const pct = (n) => `${(100 * n).toFixed(1)}%`;
  // stratum index (0..7) for a slot; null for the Lower base.
  const stratumOf = (sl) => (sl.mask === 'low' ? sl.ch : sl.mask === 'high' ? sl.ch + 4 : null);

  return (
    <div className="ctrl-col">
      {/* ── Blend ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Blend</div>
        <div className="ctrl-content">
          <label className="tt-toggle">
            <input type="checkbox" checked={halfRange} onChange={(e) => onHalfRange(e.target.checked)} />
            Sharp mask remap (halfRange)
          </label>
          <div className="ctrl-field">
            <div className="ctrl-label">Dominance threshold — {Math.round(threshold * 100)}%</div>
            <input
              type="range" min="0" max="1" step="0.01"
              className="tt-range"
              value={threshold}
              onChange={(e) => onThreshold(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* ── Layers ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Layers → Terrain Type</div>
        <div className="ctrl-content tt-slots">
          {slots.map((sl) => {
            const tex  = textures[sl.texIndex];
            const base = tex?.path ? tex.path.split(/[\\/]/).pop() : '—';
            const cov  = total ? counts[sl.slot] / total : 0;
            const id   = Number(slotToId[sl.slot]) || 0;
            const chosen = id ? typeById[id] : null;
            const mask = sl.mask === 'low' ? maskLow : sl.mask === 'high' ? maskHigh : null;
            const stratumIdx = stratumOf(sl);
            const ignored = stratumIdx != null && ignoredStrata.includes(stratumIdx);
            return (
              <div className={`tt-slot${ignored ? ' tt-slot--ignored' : ''}`} key={sl.slot}>
                <div className="tt-slot-head">
                  <span className="tt-swatch" style={{ background: slotPalette[sl.slot] }} />
                  <span className="tt-slot-title">{sl.label}</span>
                  <span className="tt-cov">{ignored ? 'excluded' : pct(cov)}</span>
                  {chosen?.blocking && !ignored && <span className="tt-badge-block" title="Blocks pathing">no-path</span>}
                  {stratumIdx != null && (
                    <label className="tt-exclude" title="Exclude this layer from the blend (e.g. a map-wide normal, not a ground texture)">
                      <input type="checkbox" checked={ignored} onChange={() => onToggleIgnore(stratumIdx)} />
                      excl.
                    </label>
                  )}
                </div>

                <div className="tt-thumbs">
                  <div className="tt-thumb-wrap">
                    {mask
                      ? <MaskThumb mask={mask} ch={sl.ch} size={maskSize} />
                      : <div className="tt-thumb tt-thumb--base">BASE</div>}
                    <span className="tt-thumb-label">mask</span>
                  </div>
                  <div className="tt-thumb-wrap">
                    {albedoThumbs?.[sl.slot]
                      ? <AlbedoThumb data={albedoThumbs[sl.slot]} />
                      : <div className="tt-thumb tt-thumb--empty" title={tex?.path || ''}>—</div>}
                    <span className="tt-thumb-label">albedo</span>
                  </div>
                  <div className="tt-slot-tex" title={tex?.path || ''}>{base}</div>
                </div>

                {!ignored && (
                  <Dropdown
                    options={typeOptions}
                    value={id}
                    onChange={(v) => onSetSlot(sl.slot, v)}
                    ariaLabel={`Terrain type for ${sl.label}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
