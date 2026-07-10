import React, { useCallback, useEffect, useRef } from 'react';
import { clamp01, exclusionZoneInfo } from './generation';

const EX_RES = 800;

// ─────────────────────────────────────────────────────────────────
// Exclusion — Section 03 main content (enabled toggle, zone list,
// confirm/discard bar). No canvas here — the canvas lives in
// ExclusionAside (same ref/draw logic can't be shared across two
// components, but state lives entirely in the parent, so both halves
// stay in sync through props).
// ─────────────────────────────────────────────────────────────────
export default function Exclusion({
  exclusionZones, exEnabled, clusterSpread,
  onExclusionZonesChange, onExEnabledChange,
  draftZone, onDraftZoneChange,
  selectedZoneIdx, onSelectedZoneIdxChange,
}) {
  return (
    <div className="ctrl-col">
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Exclusion Zones</div>
        <div className="ctrl-content">
          <div className="st-ex-header-actions">
            <button
              type="button"
              className={`ctrl-toggle-row${exEnabled ? ' on' : ''}`}
              role="switch"
              aria-checked={exEnabled}
              onClick={() => onExEnabledChange(v => !v)}
              style={{ width: 'auto' }}
            >
              <span className="ctrl-toggle"><span className="ctrl-toggle-pole" /></span>
              <span className="ctrl-toggle-text">
                <span className="ctrl-toggle-label">{exEnabled ? 'Enabled' : 'Disabled'}</span>
              </span>
            </button>
            {exclusionZones.length > 0 && (
              <button className="ctrl-btn-danger" onClick={() => {
                onExclusionZonesChange([]);
                onDraftZoneChange(null);
                onSelectedZoneIdxChange(null);
              }}>Clear All</button>
            )}
          </div>

          {draftZone && (
            <div className="st-ex-confirm-bar">
              <span className="st-ex-confirm-label">New zone drawn — confirm to add it.</span>
              <div className="st-ex-confirm-actions">
                <button className="ctrl-btn-add" onClick={() => {
                  const newZones = [...exclusionZones, draftZone];
                  onExclusionZonesChange(newZones);
                  onSelectedZoneIdxChange(newZones.length - 1);
                  onDraftZoneChange(null);
                }}>Confirm</button>
                <button className="ctrl-btn-danger" onClick={() => onDraftZoneChange(null)}>Discard</button>
              </div>
            </div>
          )}

          {exEnabled && exclusionZones.length > 0 && (
            <div>
              {exclusionZones.map((zone, i) => (
                <div
                  key={i}
                  className="st-ex-info"
                  style={{ cursor: 'pointer', outline: i === selectedZoneIdx ? '1px solid rgba(255,80,80,0.5)' : 'none' }}
                  onClick={() => onSelectedZoneIdxChange(selectedZoneIdx === i ? null : i)}
                >
                  <span className="st-ex-info-label">Zone {i + 1}</span>
                  {i === selectedZoneIdx && <code className="st-ex-info-code">{exclusionZoneInfo(zone, clusterSpread)}</code>}
                  <button className="ctrl-btn-delete" style={{ marginLeft: 'auto' }} onClick={e => {
                    e.stopPropagation();
                    const next = exclusionZones.filter((_, j) => j !== i);
                    onExclusionZonesChange(next);
                    onSelectedZoneIdxChange(prev => prev === i ? null : prev > i ? prev - 1 : prev);
                  }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ExclusionAside — Section 03 aside (the drawing canvas only). Owns
// the canvas draw loop and mouse-drag refs; mutations flow back
// through onDraftZoneChange (finalizing a drag creates a draft, which
// the main-content confirm bar picks up from parent state).
// ─────────────────────────────────────────────────────────────────
export function ExclusionAside({
  exclusionZones, draftZone, exEnabled, clusterSpread, selectedZoneIdx,
  onDraftZoneChange, onSelectedZoneIdxChange,
}) {
  const exCanvasRef = useRef(null);
  const exWrapRef   = useRef(null);
  const exDragging  = useRef(false);
  const exDragStart = useRef({ x: 0, y: 0 });
  const exDraft     = useRef(null);

  const drawExCanvas = useCallback((zones, draft) => {
    const canvas = exCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#08080f';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 16; i++) {
      const p = i / 16;
      ctx.beginPath(); ctx.moveTo(p * W, 0); ctx.lineTo(p * W, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p * H); ctx.lineTo(W, p * H); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i <= 4; i++) {
      const p = i / 4;
      ctx.beginPath(); ctx.moveTo(p * W, 0); ctx.lineTo(p * W, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p * H); ctx.lineTo(W, p * H); ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(180,100,255,0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(180,100,255,0.65)';
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 3, 0, Math.PI * 2); ctx.fill();

    const spread = parseFloat(clusterSpread) || 14000;
    const toK = v => ((v * 2 - 1) * spread / 1000).toFixed(0) + 'k';
    ctx.font = '9px monospace';
    [
      { nx: 0, ny: 0, ax: 'left',  ay: 'top',    px: 5,     py: 5     },
      { nx: 1, ny: 0, ax: 'right', ay: 'top',    px: W - 5, py: 5     },
      { nx: 0, ny: 1, ax: 'left',  ay: 'bottom', px: 5,     py: H - 5 },
      { nx: 1, ny: 1, ax: 'right', ay: 'bottom', px: W - 5, py: H - 5 },
    ].forEach(({ nx, ny, ax, ay, px, py }) => {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.textAlign = ax; ctx.textBaseline = ay;
      ctx.fillText(`(${toK(nx)},${toK(ny)})`, px, py);
    });

    if (exEnabled && zones.length > 0) {
      const offUnion = document.createElement('canvas');
      offUnion.width = W; offUnion.height = H;
      const uCtx = offUnion.getContext('2d');
      uCtx.fillStyle = '#fff';
      zones.forEach(zone => {
        const x0 = Math.min(zone.x0, zone.x1) * W, y0 = Math.min(zone.y0, zone.y1) * H;
        const w  = Math.abs(zone.x1 - zone.x0) * W, h  = Math.abs(zone.y1 - zone.y0) * H;
        uCtx.fillRect(x0, y0, w, h);
      });
      const offEroded = document.createElement('canvas');
      offEroded.width = W; offEroded.height = H;
      const eCtx = offEroded.getContext('2d');
      eCtx.fillStyle = '#fff';
      zones.forEach(zone => {
        const x0 = Math.min(zone.x0, zone.x1) * W, y0 = Math.min(zone.y0, zone.y1) * H;
        const w  = Math.abs(zone.x1 - zone.x0) * W, h  = Math.abs(zone.y1 - zone.y0) * H;
        eCtx.fillRect(x0 + 2, y0 + 2, Math.max(0, w - 4), Math.max(0, h - 4));
      });
      const offRim = document.createElement('canvas');
      offRim.width = W; offRim.height = H;
      const rCtx = offRim.getContext('2d');
      rCtx.drawImage(offUnion, 0, 0);
      rCtx.globalCompositeOperation = 'destination-out';
      rCtx.drawImage(offEroded, 0, 0);
      ctx.globalAlpha = 0.1;
      ctx.drawImage(offUnion, 0, 0);
      ctx.globalAlpha = 1;
      const offOutline = document.createElement('canvas');
      offOutline.width = W; offOutline.height = H;
      const oCtx = offOutline.getContext('2d');
      oCtx.fillStyle = 'rgba(255,80,80,0.95)';
      oCtx.fillRect(0, 0, W, H);
      oCtx.globalCompositeOperation = 'destination-in';
      oCtx.drawImage(offRim, 0, 0);
      ctx.drawImage(offOutline, 0, 0);

      zones.forEach((zone, i) => {
        const x0 = Math.min(zone.x0, zone.x1) * W, y0 = Math.min(zone.y0, zone.y1) * H;
        const w  = Math.abs(zone.x1 - zone.x0) * W, h  = Math.abs(zone.y1 - zone.y0) * H;
        const isSelected = i === selectedZoneIdx;
        if (isSelected) {
          ctx.fillStyle = 'rgba(255,50,50,0.12)';
          ctx.fillRect(x0, y0, w, h);
        }
        [[x0, y0], [x0 + w, y0], [x0, y0 + h], [x0 + w, y0 + h]].forEach(([cx, cy]) => {
          ctx.fillStyle = isSelected ? '#ff8080' : '#ff5050';
          ctx.beginPath(); ctx.arc(cx, cy, isSelected ? 5 : 4, 0, Math.PI * 2); ctx.fill();
        });
        if (w > 40 && h > 22) {
          ctx.fillStyle = isSelected ? 'rgba(255,100,100,1)' : 'rgba(255,80,80,0.75)';
          ctx.font = `bold ${isSelected ? 11 : 10}px monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(`ZONE ${i + 1}`, x0 + w / 2, y0 + h / 2);
        }
      });
    }

    if (draft) {
      const x0 = Math.min(draft.x0, draft.x1) * W, y0 = Math.min(draft.y0, draft.y1) * H;
      const w  = Math.abs(draft.x1 - draft.x0) * W, h  = Math.abs(draft.y1 - draft.y0) * H;
      ctx.fillStyle = 'rgba(180,100,255,0.12)';
      ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = 'rgba(200,140,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x0, y0, w, h);
      ctx.setLineDash([]);
      [[x0, y0], [x0 + w, y0], [x0, y0 + h], [x0 + w, y0 + h]].forEach(([cx, cy]) => {
        ctx.fillStyle = 'rgba(200,140,255,0.9)';
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
      });
      if (w > 60 && h > 22) {
        ctx.fillStyle = 'rgba(200,140,255,0.85)';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('CONFIRM ZONE?', x0 + w / 2, y0 + h / 2);
      }
    }
  }, [exEnabled, clusterSpread, selectedZoneIdx]);

  useEffect(() => {
    drawExCanvas(exclusionZones, draftZone);
  }, [exclusionZones, draftZone, exEnabled, clusterSpread, drawExCanvas, selectedZoneIdx]);

  const getPosRelativeToCanvas = useCallback((clientX, clientY) => {
    const rect = exWrapRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  }, []);

  const onMouseDown = useCallback(e => {
    if (!exEnabled) return;
    e.preventDefault();
    const pos = getPosRelativeToCanvas(e.clientX, e.clientY);
    const sx = clamp01(pos.x), sy = clamp01(pos.y);
    exDragStart.current = { x: sx, y: sy };
    exDragging.current  = true;
    exDraft.current = { x0: sx, y0: sy, x1: sx, y1: sy };
    onDraftZoneChange(null);
    onSelectedZoneIdxChange(null);
    drawExCanvas(exclusionZones, null);
  }, [exEnabled, getPosRelativeToCanvas, drawExCanvas, exclusionZones, onDraftZoneChange, onSelectedZoneIdxChange]);

  useEffect(() => {
    const onMove = (e) => {
      if (!exDragging.current) return;
      const pos = getPosRelativeToCanvas(e.clientX, e.clientY);
      const x0 = exDragStart.current.x, y0 = exDragStart.current.y;
      const rx = Math.min(x0, pos.x), ry = Math.min(y0, pos.y);
      const rw = Math.abs(pos.x - x0), rh = Math.abs(pos.y - y0);
      const cx = clamp01(rx), cy = clamp01(ry);
      const cw = Math.min(rw, 1 - cx), ch = Math.min(rh, 1 - cy);
      exDraft.current = { x0: cx, y0: cy, x1: cx + cw, y1: cy + ch };
      drawExCanvas(exclusionZones, exDraft.current);
    };
    const onUp = () => {
      if (!exDragging.current) return;
      exDragging.current = false;
      const zone = exDraft.current;
      exDraft.current = null;
      if (zone && (zone.x1 - zone.x0) > 0.01 && (zone.y1 - zone.y0) > 0.01) {
        onDraftZoneChange({ ...zone });
      } else {
        onDraftZoneChange(null);
        drawExCanvas(exclusionZones, null);
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };
  }, [getPosRelativeToCanvas, drawExCanvas, exclusionZones, onDraftZoneChange]);

  return (
    <div className="ctrl-block">
      <div className="mp-subtitle">Exclusion Preview</div>
      <div style={{ position: 'relative' }}>
        <div className="ec-canvas-wrap stc-ex-wrap">
          <div ref={exWrapRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <canvas ref={exCanvasRef} width={EX_RES} height={EX_RES} className="stc-ex-canvas" />
          </div>
        </div>
        {/* Hit area extends beyond the visible canvas so a drag can start
            near the edge without needing pixel-perfect precision. */}
        <div style={{ position: 'absolute', inset: '-24px', cursor: exEnabled ? 'crosshair' : 'default' }} onMouseDown={onMouseDown} />
      </div>
    </div>
  );
}
