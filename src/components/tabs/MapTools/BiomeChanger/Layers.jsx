import React, { useRef, useEffect, useMemo } from 'react';
import { Dropdown } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import { BIOME_ROLES } from '../../../Shared/MapLogic';

/**
 * BiomeChanger · Section 03 — Layers.
 *
 * The heart of the tab: one row per ground layer, showing what it is now and what
 * it becomes. Roles are guessed from the texture file names on read; this is where
 * you correct a guess before anything is written, because a wrong role paints sand
 * where rock was and the result looks broken for a reason nobody can see.
 *
 * A row with no target is not a failure — it says why (no role, preset has no such
 * texture, layer unused) and stays as it is.
 */

// Decoded 64² albedo thumbnail from resolve-stratum-albedos ({ w, h, rgba }).
function AlbedoThumb({ data, alt }) {
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
  return <canvas ref={ref} width={64} height={64} className="bc-thumb" aria-label={alt} />;
}

const fileOf = (p) => (p ? String(p).split('/').pop() : '—');

export default function BiomeLayers({
  rows, onSetRole, onResetRoles,
  thumbs, toThumbs,
  hasBiome, presetLabel,
}) {
  const roleOptions = useMemo(() => ([
    { value: '', label: '— unassigned —' },
    ...BIOME_ROLES.map(r => ({ value: r.id, label: r.label })),
  ]), []);

  if (!hasBiome) {
    return (
      <div className="ctrl-col">
        <div className="ctrl-block">
          <div className="ctrl-subtitle">Layers</div>
          <div className="ctrl-content">
            <div className="bc-empty">Read a map in Configuration first — the layers come from the map, not the preset.</div>
          </div>
        </div>
      </div>
    );
  }

  const changed = rows.filter(r => r.changed).length;

  return (
    <div className="ctrl-col">
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Layer Roles → {presetLabel || 'preset'}</div>
        <div className="ctrl-content">
          <div className="bc-meta">
            <span>Changing <b>{changed}</b> of {rows.length}</span>
            <span>Masks <b>untouched</b></span>
          </div>
          <div className="ctrl-action-row">
            <button className="ctrl-btn-meta" onClick={onResetRoles}>Re-guess roles from file names</button>
          </div>

          <div className="bc-layers">
            {rows.map((r) => (
              <div className={`bc-layer${r.changed ? ' bc-layer--changed' : ''}${r.skip ? ' bc-layer--skipped' : ''}`} key={r.slot}>
                <div className="bc-layer-head">
                  <span className="bc-layer-title">{r.label}</span>
                  {r.skip
                    ? <span className="bc-layer-note">{r.skip}</span>
                    : <span className="bc-layer-note bc-layer-note--go">{r.changed ? 'will change' : 'identical'}</span>}
                </div>

                <div className="bc-layer-swap">
                  <div className="bc-thumb-wrap">
                    {thumbs?.[r.slot]
                      ? <AlbedoThumb data={thumbs[r.slot]} alt={`current albedo for ${r.label}`} />
                      : <div className="bc-thumb bc-thumb--empty" title={r.fromAlbedo}>—</div>}
                    <span className="bc-thumb-label" title={r.fromAlbedo}>{fileOf(r.fromAlbedo)}</span>
                  </div>

                  <span className="bc-swap-arrow" aria-hidden="true">→</span>

                  <div className="bc-thumb-wrap">
                    {toThumbs?.[r.slot]
                      ? <AlbedoThumb data={toThumbs[r.slot]} alt={`target albedo for ${r.label}`} />
                      : <div className="bc-thumb bc-thumb--empty" title={r.toAlbedo || ''}>—</div>}
                    <span className="bc-thumb-label" title={r.toAlbedo || ''}>{fileOf(r.toAlbedo)}</span>
                  </div>
                </div>

                {/* Normal + scale ride along, shown as a leise readout so the row
                    stays scannable but nothing is written invisibly. */}
                <div className="bc-layer-detail">
                  <span title={r.fromNormal}>nrm {fileOf(r.fromNormal)}</span>
                  {r.toNormal && <span title={r.toNormal}>→ {fileOf(r.toNormal)}</span>}
                  <span>scale {r.fromScale ?? '—'}{r.toScale != null ? ` → ${r.toScale}` : ''}</span>
                </div>

                <Dropdown
                  options={roleOptions}
                  value={r.role ?? ''}
                  onChange={(v) => onSetRole(r.slot, v || null)}
                  ariaLabel={`Role for ${r.label}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
