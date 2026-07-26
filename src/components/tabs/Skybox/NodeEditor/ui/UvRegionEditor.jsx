import React from 'react';
import NumberField from './NumberField.jsx';

/**
 * UvRegionEditor — the four UV numbers, plus the presets you actually reach for.
 *
 * Values match SupCom's `uv = {x, y, z, w}` convention exactly: x/y are the
 * region's origin, z/w its size (added onto the origin — a rect, not a second
 * corner), and the origin is **bottom-left** — (0,0) is the atlas's bottom-left
 * texel, (1,1) its top-right. So {x:0, y:0.5, z:0.5, w:0.5} is the TOP-left
 * quarter (y=0.5 is already halfway up), not bottom-left — easy to get
 * backwards if you think in screen/CSS coordinates, where y grows downward.
 *
 * The mini-map mirrors that: it flips the y axis so the preview reads the same
 * way up as the atlas does (CSS `top` grows down; SupCom `y` grows up).
 */
const QUADRANTS = [
  ['Bottom-left', { x: 0, y: 0, z: 0.5, w: 0.5 }],
  ['Bottom-right', { x: 0.5, y: 0, z: 0.5, w: 0.5 }],
  ['Top-left', { x: 0, y: 0.5, z: 0.5, w: 0.5 }],
  ['Top-right', { x: 0.5, y: 0.5, z: 0.5, w: 0.5 }],
  ['Full', { x: 0, y: 0, z: 1, w: 1 }],
];

export default function UvRegionEditor({ value, onChange }) {
  const r = value || { x: 0, y: 0, z: 1, w: 1 };
  const set = (patch) => onChange({ ...r, ...patch });
  const x = Number(r.x) || 0, y = Number(r.y) || 0, z = Number(r.z) || 0, w = Number(r.w) || 0;

  return (
    <div className="ne-uv-editor">
      <div className="ne-uv-map" title="Selected atlas region (bottom-left origin, like SupCom)">
        <div
          className="ne-uv-sel"
          style={{
            left: `${x * 100}%`,
            top: `${(1 - y - w) * 100}%`,   // flip: SupCom y=0 is the bottom
            width: `${z * 100}%`,
            height: `${w * 100}%`,
          }}
        />
      </div>

      <div className="ne-uv-grid">
        <label className="ne-field-inline">x<NumberField min={0} max={1} step={0.01} value={r.x} onChange={v => set({ x: v })} /></label>
        <label className="ne-field-inline">y<NumberField min={0} max={1} step={0.01} value={r.y} onChange={v => set({ y: v })} /></label>
        <label className="ne-field-inline">z<NumberField min={0} max={1} step={0.01} value={r.z} onChange={v => set({ z: v })} /></label>
        <label className="ne-field-inline">w<NumberField min={0} max={1} step={0.01} value={r.w} onChange={v => set({ w: v })} /></label>
      </div>

      <div className="ne-uv-presets">
        {QUADRANTS.map(([label, rect]) => (
          <button key={label} className="ctrl-btn-add" onClick={() => onChange(rect)}>{label}</button>
        ))}
      </div>
      <p className="ne-hint">SupCom uv = {'{x, y, z, w}'}: x/y origin (bottom-left), z/w size.</p>
    </div>
  );
}
