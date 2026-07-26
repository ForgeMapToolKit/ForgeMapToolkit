import React, { useRef, useState } from 'react';
import { Field, Slider, Select, Readout, Toggle } from './Fields.jsx';
import { nearestEngineTexture } from '../../../Shared/Ocean/faWater.js';

const FORMATS = [
  { value: 'RGBA', label: 'A8R8G8B8 — lossless (recommended)' },
  { value: 'DXT5', label: 'DXT5 / BC3 — ¼ the size' },
];

/**
 * Section 05 — write the set and wire it into the map.
 *
 * The scroll motion belongs here rather than with the sea state: it never touches
 * a baked pixel, it only decides the Speed/Angle pairs the engine scrolls the
 * finished textures at. Because it is solved live from the repeat rates and the
 * wind, it needs no bake and never makes one stale.
 *
 * With the "patch .scmap" toggle on, the export both writes the DDS files and
 * rewrites the map's water settings so nothing has to be assembled by hand. The
 * printed settings block is kept as a fallback and a record of what was written.
 */
export default function WaveExport({
  mapName, setMapName, mapInfo, baseName, setBaseName, format, setFormat,
  flowSpeed, setFlowSpeed, angleSpread, setAngleSpread,
  recommended, editorRows = [], layers,
  writeSlots = [], toggleWriteSlot = () => {},
  writeScmap = true, setWriteScmap = () => {}, liftSun = false, setLiftSun = () => {},
  onWrite, writing, written,
}) {
  const isSelected = i => writeSlots[i] !== false;
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const mapNameRef = useRef(null);

  const settingsBlock = () => {
    const lines = [
      '-- Wave Normals — water settings for the FA map editor',
      recommended
        ? `-- waveCrestThreshold: ${recommended.threshold.toFixed(3)}   (mean Σα ${recommended.meanSum.toFixed(3)}, max ${recommended.maxSum.toFixed(3)})`
        : '',
      '',
      ...editorRows.map(r => {
        const keep = !isSelected(r.index);
        const texture = keep
          ? `${nearestEngineTexture(r.L).path}   (stock — this slot is not generated)`
          : written?.files.find(f => f.index === r.index)?.gamePath ?? '<write the set first>';
        return [
          `Layer ${r.index}:`,
          `  Texture  ${texture}`,
          `  Scale    ${r.scale.toFixed(3)}   (repeatRate ${r.repeatRate})`,
          `  Speed    ${r.speed.toFixed(4)}`,
          `  Angle    ${r.angle.toFixed(1)}°`,
        ].join('\n');
      }),
    ];
    return lines.filter(Boolean).join('\n');
  };

  const copy = async () => {
    try {
      await window.electronAPI.invoke('clipboard-write-text', { text: settingsBlock() });
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard is a convenience, not a requirement */ }
  };

  const hasLayers = !!layers?.length;
  const hasName   = !!mapName.trim();

  /**
   * A disabled button that says "Map name missing" is a dead end: the field it
   * refers to sits several blocks further up, off-screen once the button is in
   * view. So the button stays live and takes you there instead.
   */
  const handleWrite = () => {
    if (!hasName) {
      const el = mapNameRef.current;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus();
      return;
    }
    onWrite();
  };

  return (
    <div className="ctrl-col">

      {/* ── Destination ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Destination</div>
        <div className="ctrl-content">
          <Field label="Map name" hint="Textures go to <map>/env/layers/water/; with the toggle below, the .scmap water settings are patched to point at them.">
            <input
              ref={mapNameRef}
              type="text"
              className="ctrl-input ctrl-input--text"
              value={mapName}
              onChange={e => setMapName(e.target.value)}
              placeholder="Map name — e.g. Hades_Dust.v0002"
            />
          </Field>

          {mapName && mapInfo && (
            <div className="ctrl-mapinfo">
              {mapInfo.ok ? (
                <>
                  <span className="ctrl-badge ctrl-badge--ok">Map</span>
                  <span>{mapInfo.mapSize} × {mapInfo.mapSize}</span>
                  <span className="ctrl-mapinfo-sep">·</span>
                  <span>{mapInfo.km} km</span>
                </>
              ) : <span className="ctrl-mapinfo-err">{mapInfo.error}</span>}
            </div>
          )}

          <Field label="File base name">
            <input
              type="text"
              className="ctrl-input"
              value={baseName}
              onChange={e => setBaseName(e.target.value.replace(/[^\w-]/g, ''))}
            />
          </Field>

          {hasLayers && (
            <div className="ctrl-field">
              <label className="ctrl-label">Layers to write</label>
              <div className="wn-slot-table">
                {layers.map(l => {
                  const on = isSelected(l.index);
                  return (
                    <div className="wn-write-row" key={l.index}>
                      <button
                        type="button"
                        className={`wn-chip${on ? ' is-on' : ''}`}
                        onClick={() => toggleWriteSlot(l.index)}
                      >{on ? '✓' : '—'}</button>
                      <span className="wn-slot-idx">{l.index}</span>
                      <span className="wn-slot-cell">{l.L.toFixed(0)} m</span>
                      <span className="wn-write-name">
                        {on
                          ? `${baseName}_${l.index}.dds`
                          : nearestEngineTexture(l.L).path.split('/').pop()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Select
            label="Format"
            value={format}
            onChange={setFormat}
            options={FORMATS}
            hint={format === 'DXT5'
              ? 'BC1 colour endpoints can only span four palette entries per 4×4 block. Measured on a real bake that costs ~4° of mean normal error — visible on smooth water. Use it when map size actually matters.'
              : 'Bit-exact. 512² with mips is 1.4 MB per layer, 5.6 MB for the set — against a 20 MB scmap that is not a real cost.'}
          />
        </div>
      </div>

      {/* ── Motion ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Motion</div>
        <div className="ctrl-content">
          <Slider
            label="Flow speed" value={flowSpeed} onChange={setFlowSpeed}
            min={0} max={0.04} step={0.001}
            format={v => v.toFixed(3)}
            hint="Scroll speed scales with each layer's tile: editor Speed ≈ this × √scale. At 0.015 that is about 0.15 for a scale-100 layer and 0.05 for scale-10 — the range the editor expects. This only affects the exported motion, not the baked normals."
          />
          <Slider
            label="Angle variation" value={angleSpread} onChange={setAngleSpread}
            min={0} max={45} step={1} unit="°"
            hint="Fans each layer's scroll heading off the wind so the four scales cross instead of sliding as one rigid sheet — the base layer runs with the wind, finer layers scatter. 0 locks them all to the wind direction."
          />

          <Readout rows={editorRows.map(r => [
            `layer ${r.index} · scale ${r.scale.toFixed(0)}`,
            `speed ${r.speed.toFixed(3)} · ${r.angle.toFixed(0)}°`,
          ])} />
        </div>
      </div>

      {/* ── Wire into map ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Wire Into Map</div>
        <div className="ctrl-content">
          <Toggle
            label="Patch the .scmap water settings"
            value={writeScmap}
            onChange={setWriteScmap}
            hint="Rewrites the map's four wave-texture paths, movement vectors and repeat rates to point at this set — no manual editing. Deselected slots (above) keep their stock texture. The .scmap is unpacked, patched and repacked in place."
          />
          <Toggle
            label="Lift the water sun above the horizon"
            value={liftSun}
            onChange={setLiftSun}
            hint="The stock water sun points ~74° below the horizon, which switches the specular highlight off — why FA water looks matte almost everywhere. This flips it above the horizon so your normals actually catch light. Off by default because it changes the whole water look; turn it on if the water still looks flat in-game."
          />

          <button className="commit-button" onClick={handleWrite} disabled={!hasLayers || writing} type="button">
            <span className="commit-button-label">
              {writing ? 'Writing…' : writeScmap ? 'Write set + patch map' : 'Write DDS set'}
            </span>
            <span className="commit-button-status">
              {!hasLayers ? 'Bake first'
                : !hasName ? 'Click to set the map name ↑'
                : `${layers.filter(l => isSelected(l.index)).length} files`}
            </span>
            <span className="commit-button-bloom" aria-hidden />
            <span className="commit-button-line" aria-hidden />
          </button>

          {written && (
            <div className="wn-written">
              <div className="wn-written-head">Written to {written.dir}</div>
              {written.files.map(f => (
                <div className="wn-written-row" key={f.index}>
                  <span className="wn-written-name">{f.gamePath.split('/').pop()}</span>
                  <span className="wn-written-meta">{f.mipCount} mips · {(f.bytes / 1024).toFixed(0)} KB</span>
                </div>
              ))}
              {written.scmapPatched && (
                <div className="wn-written-row">
                  <span className="wn-written-name">.scmap patched</span>
                  <span className="wn-written-meta">
                    water settings updated{written.sunLifted ? ' · sun lifted' : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Leise, per §3 block order: the manual fallback for anyone patching
              the map by hand, kept out of the way of the path that works. */}
          <div className="ctrl-action-row">
            <button
              className="ctrl-btn-meta"
              onClick={() => setShowSettings(v => !v)}
              type="button"
            >{showSettings ? 'Hide water settings' : 'Show water settings'}</button>
            {showSettings && (
              <button className="ctrl-btn-meta" onClick={copy} type="button">
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          {showSettings && <pre className="wn-code">{settingsBlock()}</pre>}
        </div>
      </div>

    </div>
  );
}
