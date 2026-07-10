import React, { useEffect, useRef, useState } from 'react';
import { DropSlot } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import { UV_COLORS, parseUvOptions } from './generation';

const UV_RES = 400;

// ─────────────────────────────────────────────────────────────────
// UV — Section 02 main content (UV row table: X/Y/Z/W/weight/delete).
// Pure presentational; all mutation flows back through the on*
// callbacks the parent (Stars.jsx) wires up.
// ─────────────────────────────────────────────────────────────────
export default function UV({
  uvRows, onResetUvRows, onAddUvRow, onUpdateUvRow, onRemoveUvRow,
}) {
  return (
    <div className="ctrl-col">
      <div className="ctrl-block">
        <div className="ctrl-subtitle">UV Options</div>
        <div className="ctrl-content">
          <div className="st-uv-row st-uv-row--header">
            <span />
            <span>X</span><span>Y</span><span>Z</span><span>W</span><span>Weight</span>
            <span />
          </div>
          {uvRows.map((row, i) => (
            <div key={i} className="st-uv-row">
              <span className="st-uv-idx" style={{ color: UV_COLORS[i % UV_COLORS.length] }}>{i + 1}</span>
              {['x', 'y', 'z', 'w'].map(f => (
                <input key={f} className="ctrl-input" value={row[f]} onChange={e => onUpdateUvRow(i, f, e.target.value)} />
              ))}
              <input className="ctrl-input" value={row.weight} onChange={e => onUpdateUvRow(i, 'weight', e.target.value)} />
              <button className="ctrl-btn-delete st-uv-del" disabled={uvRows.length <= 1} onClick={() => onRemoveUvRow(i)}>×</button>
            </div>
          ))}
          <div className="ctrl-action-row">
            <button className="ctrl-btn-add" onClick={onResetUvRows}>Reset</button>
            <button className="ctrl-btn-add" onClick={onAddUvRow}>+ Add Row</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// UVAside — Section 02 aside (texture upload + opacity + atlas
// preview). Canvas draws only the raster texture preview — grid,
// corner coordinates and UV rect markers are CSS/HTML so they stay
// crisp and themeable instead of baked pixels.
// ─────────────────────────────────────────────────────────────────
export function UVAside({
  uvOptions, uvOpacity, onUvOpacityChange,
  textureDataUrl, onUploadImage, onRemoveTexture,
  texOpacity, onTexOpacityChange,
}) {
  const canvasRef = useRef(null);
  const [textureImg, setTextureImg] = useState(null);

  useEffect(() => {
    if (!textureDataUrl) { setTextureImg(null); return; }
    const img = new Image();
    img.onload = () => setTextureImg(img);
    img.src = textureDataUrl;
  }, [textureDataUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (textureImg?.complete) {
      const opacity  = parseFloat(texOpacity) || 0;
      const fullPasses = Math.floor(opacity);
      const remainder  = opacity - fullPasses;
      for (let i = 0; i < fullPasses; i++) { ctx.globalAlpha = 1; ctx.drawImage(textureImg, 0, 0, W, H); }
      if (remainder > 0) { ctx.globalAlpha = remainder; ctx.drawImage(textureImg, 0, 0, W, H); }
      ctx.globalAlpha = 1;
      if (opacity <= 1) {
        ctx.fillStyle = `rgba(0,0,0,${0.28 * (1 - opacity * 0.5)})`;
        ctx.fillRect(0, 0, W, H);
      }
    } else {
      ctx.fillStyle = '#0e0e14';
      ctx.fillRect(0, 0, W, H);
    }
  }, [textureImg, texOpacity]);

  const uvMarkers = parseUvOptions(uvOptions);
  const uvOverlayOpacity = Math.max(0, Math.min(1, parseFloat(uvOpacity) || 0));

  return (
    <>
      <div className="ctrl-block">
        <div className="mp-subtitle">UV Visualization</div>
        <DropSlot
          className="st-upload-dropslot"
          acceptInput="image/*,.dds"
          status={textureDataUrl ? 'done' : 'idle'}
          idleText="Click or drop a texture preview"
          doneText="Texture preview loaded"
          onChange={onUploadImage}
          onClear={onRemoveTexture}
        />
        {textureDataUrl && (
          <div className="ctrl-field" style={{ marginTop: '14px', marginBottom: '6px' }}>
            <div className="ctrl-label">Texture Opacity</div>
            <div className="st-opacity-row">
              <div className="st-range-wrap">
                <input type="range" className="st-range" min="0" max="1" step="0.01"
                  value={Math.min(parseFloat(texOpacity) || 0, 1)}
                  onChange={e => onTexOpacityChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)} />
              </div>
              <input type="number" min="0" step="0.01" className="ctrl-input st-opacity-input"
                value={texOpacity} onChange={e => onTexOpacityChange(e.target.value)} />
            </div>
          </div>
        )}
        <div className="ctrl-field" style={{ marginBottom: '14px' }}>
          <div className="ctrl-label">UV Overlay Opacity</div>
          <div className="st-opacity-row">
            <div className="st-range-wrap">
              <input type="range" className="st-range" min="0" max="1" step="0.01"
                value={Math.min(parseFloat(uvOpacity) || 0, 1)}
                onChange={e => onUvOpacityChange(e.target.value)} />
            </div>
            <input type="number" min="0" step="0.01" className="ctrl-input st-opacity-input"
              value={uvOpacity} onChange={e => onUvOpacityChange(e.target.value)} />
          </div>
        </div>
        <div className="ec-canvas-wrap stc-uv-canvas">
          <canvas ref={canvasRef} width={UV_RES} height={UV_RES} style={{ width: '100%', height: '100%', display: 'block', cursor: 'default' }} />
          <div className="st-uv-grid" aria-hidden="true" />
          <span className="st-uv-corner-label st-uv-corner-label--tl">(0,1)</span>
          <span className="st-uv-corner-label st-uv-corner-label--tr">(1,1)</span>
          <span className="st-uv-corner-label st-uv-corner-label--bl">(0,0)</span>
          <span className="st-uv-corner-label st-uv-corner-label--br">(1,0)</span>
          {uvMarkers.map((uv, idx) => {
            const color = UV_COLORS[idx % UV_COLORS.length];
            return (
              <div
                key={idx}
                className="st-uv-marker"
                style={{
                  left: `${uv.x * 100}%`, top: `${(1 - uv.y - uv.w) * 100}%`,
                  width: `${uv.z * 100}%`, height: `${uv.w * 100}%`,
                  '--marker-color': color,
                  background: uvOverlayOpacity > 0 ? color + Math.round(uvOverlayOpacity * 255).toString(16).padStart(2, '0') : 'transparent',
                }}
              >
                <span className="st-uv-marker-badge">{idx + 1}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
