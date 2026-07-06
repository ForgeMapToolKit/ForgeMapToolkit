import React, { useEffect, useRef, useState } from 'react';
import { UV_COLORS, parseUvOptions } from './generation';

const UV_RES = 400;

// ─────────────────────────────────────────────────────────────────
// UvAtlasCanvas — small presentational sub-component that owns its
// own draw effect (loads the uploaded texture from a data URL and
// paints the UV-rect overlay on top). Kept local to Stars_UV because
// it's a Stars-specific visualization, not a cross-tab concern.
// ─────────────────────────────────────────────────────────────────
function UvAtlasCanvas({ uvOptions, uvOpacity, textureDataUrl, texOpacity }) {
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
      const fullPasses = Math.floor(texOpacity);
      const remainder  = texOpacity - fullPasses;
      for (let i = 0; i < fullPasses; i++) {
        ctx.globalAlpha = 1;
        ctx.drawImage(textureImg, 0, 0, W, H);
      }
      if (remainder > 0) {
        ctx.globalAlpha = remainder;
        ctx.drawImage(textureImg, 0, 0, W, H);
      }
      ctx.globalAlpha = 1;
      if (texOpacity <= 1) {
        ctx.fillStyle = `rgba(0,0,0,${0.28 * (1 - texOpacity * 0.5)})`;
        ctx.fillRect(0, 0, W, H);
      }
    } else {
      ctx.fillStyle = '#0e0e14';
      ctx.fillRect(0, 0, W, H);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const p = (i / 4) * W;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(W, p); ctx.stroke();
    }

    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.textAlign = 'left';  ctx.textBaseline = 'bottom'; ctx.fillText('(0,0)', 4, H - 3);
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('(1,0)', W - 3, H - 3);
    ctx.textAlign = 'left';  ctx.textBaseline = 'top';    ctx.fillText('(0,1)', 4, 3);
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';    ctx.fillText('(1,1)', W - 3, 3);

    const parsedUvs = parseUvOptions(uvOptions);
    const opacity   = parseFloat(uvOpacity) || 0;

    parsedUvs.forEach((uv, idx) => {
      const color = UV_COLORS[idx % UV_COLORS.length];
      const cx1 = uv.x * W, cy1 = (1 - uv.y - uv.w) * H, cw = uv.z * W, ch = uv.w * H;

      if (opacity > 0) {
        ctx.fillStyle = color + Math.round(opacity * 255).toString(16).padStart(2, '0');
        ctx.fillRect(cx1, cy1, cw, ch);
      }
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.strokeRect(cx1, cy1, cw, ch);

      const cx = cx1 + cw / 2, cy = cy1 + ch / 2;
      ctx.fillStyle = '#111'; ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(idx + 1), cx, cy);
    });
  }, [uvOptions, uvOpacity, textureImg, texOpacity]);

  return <canvas ref={canvasRef} width={UV_RES} height={UV_RES} className="st-uv-canvas" />;
}

// ─────────────────────────────────────────────────────────────────
// Stars_UV — Section 02 (UV row table, texture upload, atlas preview)
// ─────────────────────────────────────────────────────────────────
export default function UV({
  uvRows, onResetUvRows, onAddUvRow, onUpdateUvRow, onRemoveUvRow,
  uvOptions, uvOpacity, onUvOpacityChange,
  textureDataUrl, onUploadImage, onRemoveTexture,
  texOpacity, onTexOpacityChange,
  fileInputRef,
}) {
  return (
    <>
      <div className="st-card-header">
        <div className="st-card-header-actions">
          <button className="action-button" onClick={onResetUvRows}>Reset</button>
          <button className="action-button" onClick={onAddUvRow}>+ Add Row</button>
        </div>
      </div>

      {/* UV Table */}
      <div className="st-uv-table-header">
        <div className="st-uv-col-color" />
        <div className="st-uv-col-field">X</div>
        <div className="st-uv-col-field">Y</div>
        <div className="st-uv-col-field">Z</div>
        <div className="st-uv-col-field">W</div>
        <div className="st-uv-col-weight">Weight</div>
        <div className="st-uv-col-del" />
      </div>

      {uvRows.map((row, i) => {
        const color = UV_COLORS[i % UV_COLORS.length];
        return (
          <div className="st-uv-table-row" key={i}>
            <div className="st-uv-col-color">
              <div className="st-uv-legend-dot" style={{ background: color, borderColor: color }} />
            </div>
            {['x', 'y', 'z', 'w'].map(f => (
              <div className="st-uv-col-field" key={f}>
                <input className="field-input st-uv-cell-input"
                  value={row[f]}
                  onChange={e => onUpdateUvRow(i, f, e.target.value)}
                  placeholder="0.0" />
              </div>
            ))}
            <div className="st-uv-col-weight">
              <input className="field-input st-uv-cell-input"
                value={row.weight}
                onChange={e => onUpdateUvRow(i, 'weight', e.target.value)}
                placeholder="0.25" />
            </div>
            <div className="st-uv-col-del">
              {uvRows.length > 1 && (
                <button className="delete-button"
                  onClick={() => onRemoveUvRow(i)}
                  title="Remove">×</button>
              )}
            </div>
          </div>
        );
      })}

      <hr className="divider" />

      {/* UV Visualization */}
      <div className="subsection-head"><span className="subsection-head-title">UV Visualization</span></div>

      <div className="st-upload-area" onClick={() => fileInputRef.current?.click()}>
        <span className="st-upload-icon">🖼</span>
        <span>{textureDataUrl ? 'Replace texture preview' : 'Upload texture preview'}</span>
        <input ref={fileInputRef} type="file" className="st-hidden-input"
          accept="image/*,.dds" onChange={onUploadImage} />
      </div>

      {textureDataUrl && (
        <>
          <div className="form-group st-opacity-group">
            <label className="field-label">Texture Opacity</label>
            <div className="st-opacity-row">
              <input type="range" min="0" max="1" step="0.01"
                className="st-range-slider"
                value={Math.min(parseFloat(texOpacity) || 0, 1)}
                onChange={e => onTexOpacityChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)} />
              <input type="number" min="0" step="0.01"
                className="field-input st-opacity-input"
                value={texOpacity}
                onChange={e => onTexOpacityChange(e.target.value)} />
            </div>
          </div>
          <div className="st-remove-texture-row">
            <button className="action-button action-button--danger" onClick={onRemoveTexture}>
              Remove Texture
            </button>
          </div>
        </>
      )}

      <div className="form-group st-opacity-group">
        <label className="field-label">UV Overlay Opacity</label>
        <div className="st-opacity-row">
          <input type="range" min="0" max="1" step="0.01"
            className="st-range-slider"
            value={Math.min(parseFloat(uvOpacity) || 0, 1)}
            onChange={e => onUvOpacityChange(e.target.value)} />
          <input type="number" min="0" step="0.01"
            className="field-input st-opacity-input"
            value={uvOpacity}
            onChange={e => onUvOpacityChange(e.target.value)} />
        </div>
      </div>

      <UvAtlasCanvas
        uvOptions={uvOptions}
        uvOpacity={uvOpacity}
        textureDataUrl={textureDataUrl}
        texOpacity={parseFloat(texOpacity) || 0}
      />
    </>
  );
}
