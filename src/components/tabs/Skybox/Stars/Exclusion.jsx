import React, { useCallback, useEffect, useRef } from 'react';
import { clamp01, exclusionZoneInfo } from './generation';

const EX_RES = 800;

// ─────────────────────────────────────────────────────────────────
// ExclusionCanvas — owns the canvas draw loop and mouse drag logic.
// Kept as a sub-component so Stars_Exclusion stays purely declarative
// (no refs/effects leaking into the section layer).
// ─────────────────────────────────────────────────────────────────
function ExclusionCanvas({
  exclusionZones, draftZone, exEnabled, clusterSpread, selectedZoneIdx,
  onMouseDown, exCanvasRef, exWrapRef,
}) {
  return (
    <div
      style={{ margin: '-24px', padding: '24px', cursor: exEnabled ? 'crosshair' : 'default' }}
      onMouseDown={onMouseDown}
    >
      <div className="st-ex-wrap">
        <div ref={exWrapRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <canvas ref={exCanvasRef} width={EX_RES} height={EX_RES} className="st-ex-canvas" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Stars_Exclusion — Section 03 (Exclusion Zones canvas + zone list).
//
// Canvas draw loop and mouse handlers live here (they need refs that
// are scoped to this section). Everything that mutates persistent
// state flows back through callbacks from the parent (Stars.jsx).
// ─────────────────────────────────────────────────────────────────
export default function Exclusion({
  // persistent state (read)
  exclusionZones, exEnabled, clusterSpread,
  // persistent state (write — callbacks to parent)
  onExclusionZonesChange, onExEnabledChange,
  // transient UI state (owned here via callbacks)
  draftZone, onDraftZoneChange,
  selectedZoneIdx, onSelectedZoneIdxChange,
}) {
  const exCanvasRef = useRef(null);
  const exWrapRef   = useRef(null);
  const exDragging  = useRef(false);
  const exDragStart = useRef({ x: 0, y: 0 });
  const exDraft     = useRef(null);

  // ── Draw ───────────────────────────────────────────────────────
  const drawExCanvas = useCallback((zones, draft) => {
    const canvas = exCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#08080f';
    ctx.fillRect(0, 0, W, H);

    // fine grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 16; i++) {
      const p = i / 16;
      ctx.beginPath(); ctx.moveTo(p * W, 0); ctx.lineTo(p * W, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p * H); ctx.lineTo(W, p * H); ctx.stroke();
    }
    // coarse grid
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i <= 4; i++) {
      const p = i / 4;
      ctx.beginPath(); ctx.moveTo(p * W, 0); ctx.lineTo(p * W, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p * H); ctx.lineTo(W, p * H); ctx.stroke();
    }
    // centre crosshair
    ctx.strokeStyle = 'rgba(138,18,189,0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(138,18,189,0.65)';
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 3, 0, Math.PI * 2); ctx.fill();

    // corner labels
    const spread = parseFloat(clusterSpread) || 14000;
    const toK = v => ((v * 2 - 1) * spread / 1000).toFixed(0) + 'k';
    ctx.font = '9px monospace';
    [
      { nx: 0, ny: 0, ax: 'left',  ay: 'top',    px: 5,     py: 5     },
      { nx: 1, ny: 0, ax: 'right', ay: 'top',    px: W - 4, py: 5     },
      { nx: 0, ny: 1, ax: 'left',  ay: 'bottom', px: 5,     py: H - 5 },
      { nx: 1, ny: 1, ax: 'right', ay: 'bottom', px: W - 4, py: H - 5 },
    ].forEach(({ nx, ny, ax, ay, px, py }) => {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.textAlign = ax; ctx.textBaseline = ay;
      ctx.fillText(`${toK(nx)}, ${toK(ny)}`, px, py);
    });
    ctx.fillStyle = 'rgba(138,18,189,0.7)';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('0, 0', W / 2 + 1, H / 2 + 10);
    ctx.strokeStyle = 'rgba(138,18,189,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, W, H);

    // exclusion zones
    if (exEnabled && zones.length > 0) {
      // union mask
      const offUnion = document.createElement('canvas');
      offUnion.width = W; offUnion.height = H;
      const uCtx = offUnion.getContext('2d');
      uCtx.fillStyle = '#fff';
      zones.forEach(zone => {
        const x0 = Math.min(zone.x0, zone.x1) * W, y0 = Math.min(zone.y0, zone.y1) * H;
        const w  = Math.abs(zone.x1 - zone.x0) * W, h  = Math.abs(zone.y1 - zone.y0) * H;
        uCtx.fillRect(x0, y0, w, h);
      });
      // eroded mask (for rim)
      const offEroded = document.createElement('canvas');
      offEroded.width = W; offEroded.height = H;
      const eCtx = offEroded.getContext('2d');
      eCtx.fillStyle = '#fff';
      zones.forEach(zone => {
        const x0 = Math.min(zone.x0, zone.x1) * W, y0 = Math.min(zone.y0, zone.y1) * H;
        const w  = Math.abs(zone.x1 - zone.x0) * W, h  = Math.abs(zone.y1 - zone.y0) * H;
        eCtx.fillRect(x0 + 2, y0 + 2, Math.max(0, w - 4), Math.max(0, h - 4));
      });
      // rim
      const offRim = document.createElement('canvas');
      offRim.width = W; offRim.height = H;
      const rCtx = offRim.getContext('2d');
      rCtx.drawImage(offUnion, 0, 0);
      rCtx.globalCompositeOperation = 'destination-out';
      rCtx.drawImage(offEroded, 0, 0);
      // fill tint
      ctx.globalAlpha = 0.1;
      ctx.drawImage(offUnion, 0, 0);
      ctx.globalAlpha = 1;
      // outline
      const offOutline = document.createElement('canvas');
      offOutline.width = W; offOutline.height = H;
      const oCtx = offOutline.getContext('2d');
      oCtx.fillStyle = 'rgba(255,80,80,0.95)';
      oCtx.fillRect(0, 0, W, H);
      oCtx.globalCompositeOperation = 'destination-in';
      oCtx.drawImage(offRim, 0, 0);
      ctx.drawImage(offOutline, 0, 0);

      // per-zone handles + labels
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

    // draft zone
    if (draft) {
      const x0 = Math.min(draft.x0, draft.x1) * W, y0 = Math.min(draft.y0, draft.y1) * H;
      const w  = Math.abs(draft.x1 - draft.x0) * W, h  = Math.abs(draft.y1 - draft.y0) * H;
      ctx.fillStyle = 'rgba(138,18,189,0.12)';
      ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = 'rgba(180,80,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x0, y0, w, h);
      ctx.setLineDash([]);
      [[x0, y0], [x0 + w, y0], [x0, y0 + h], [x0 + w, y0 + h]].forEach(([cx, cy]) => {
        ctx.fillStyle = 'rgba(180,80,255,0.9)';
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
      });
      if (w > 60 && h > 22) {
        ctx.fillStyle = 'rgba(180,80,255,0.85)';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('CONFIRM ZONE?', x0 + w / 2, y0 + h / 2);
      }
    }
  }, [exEnabled, clusterSpread, selectedZoneIdx]);

  useEffect(() => {
    drawExCanvas(exclusionZones, draftZone);
  }, [exclusionZones, draftZone, exEnabled, clusterSpread, drawExCanvas, selectedZoneIdx]);

  // ── Mouse drag ─────────────────────────────────────────────────
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
    drawExCanvas(exclusionZones, exDraft.current);
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
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };
  }, [getPosRelativeToCanvas, drawExCanvas, exclusionZones, onDraftZoneChange]);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <>
      {/* Enabled toggle + Clear All */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="form-label" style={{ margin: 0 }}>{exEnabled ? 'Enabled' : 'Disabled'}</span>
          <button
            className={`switch${exEnabled ? ' on' : ''}`}
            onClick={() => onExEnabledChange(v => !v)}
            aria-checked={exEnabled}
            role="switch"
            aria-label="Exclusion zones enabled"
          >
            <span className="switch-pole" />
          </button>
        </div>
        {exclusionZones.length > 0 && (
          <button className="action-button action-button--danger" onClick={() => {
            onExclusionZonesChange([]);
            onDraftZoneChange(null);
            onSelectedZoneIdxChange(null);
          }}>Clear All</button>
        )}
      </div>

      {/* Zone list */}
      {exclusionZones.length > 0 && (
        <div className="st-ex-zone-list">
          {exclusionZones.map((zone, i) => (
            <div
              key={i}
              className={`st-ex-zone-item${selectedZoneIdx === i ? ' active' : ''}`}
              onClick={() => onSelectedZoneIdxChange(selectedZoneIdx === i ? null : i)}
            >
              <span className="st-ex-zone-label">Zone {i + 1}</span>
              {selectedZoneIdx === i && (
                <code className="st-ex-zone-coords">{exclusionZoneInfo(zone, clusterSpread)}</code>
              )}
              <button className="st-ex-zone-delete" onClick={e => {
                e.stopPropagation();
                onExclusionZonesChange(prev => prev.filter((_, j) => j !== i));
                onSelectedZoneIdxChange(prev => prev === i ? null : prev > i ? prev - 1 : prev);
              }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Draft confirm bar */}
      {draftZone && (
        <div className="st-ex-confirm-bar">
          <span className="st-ex-confirm-label">New zone drawn — confirm to add it.</span>
          <div className="st-ex-confirm-actions">
            <button className="st-ex-btn-confirm" onClick={() => {
              const newZones = [...exclusionZones, draftZone];
              onExclusionZonesChange(newZones);
              onSelectedZoneIdxChange(newZones.length - 1);
              onDraftZoneChange(null);
            }}>Confirm</button>
            <button className="st-ex-btn-discard" onClick={() => {
              onDraftZoneChange(null);
              drawExCanvas(exclusionZones, null);
            }}>Discard</button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div
        style={{ margin: '-24px', padding: '24px', cursor: exEnabled ? 'crosshair' : 'default' }}
        onMouseDown={onMouseDown}
      >
        <div className="st-ex-wrap">
          <div ref={exWrapRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <canvas ref={exCanvasRef} width={EX_RES} height={EX_RES} className="st-ex-canvas" />
          </div>
        </div>
      </div>
    </>
  );
}
