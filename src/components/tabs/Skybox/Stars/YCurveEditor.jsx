import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DEFAULT_CURVE_POINTS } from './generation';

// ─────────────────────────────────────────────────────────────────
// YCurveEditor — presentational canvas widget for the "Curve" Y-mode.
// The instrument well (background/grid/border/glow) is the shared
// .ec-canvas-wrap + local grid overlay; the canvas itself only draws
// the curve line/points, so it stays transparent underneath.
// ─────────────────────────────────────────────────────────────────
const hexToRgbArr = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

export default function YCurveEditor({ points, onChange, yMax = 1500 }) {
  const canvasRef = useRef(null);
  const wrapRef   = useRef(null);
  const dragIdx   = useRef(null);
  const hoverIdx  = useRef(-1);
  const didMove   = useRef(false);
  const downPos   = useRef(null);
  const accentRef = useRef([180, 100, 255]); // fallback until --tab-color resolves

  const [isHoveringPoint, setIsHoveringPoint] = useState(false);

  const CW = 400, CH = 400, HIT_PX = 14;
  const ptToCv = (p) => ({ cx: p.x * CW, cy: (1 - p.y) * CH });
  const accent = (a) => { const [r, g, b] = accentRef.current; return `rgba(${r},${g},${b},${a})`; };

  // Canvas can't read CSS custom properties directly — resolve
  // --tab-color once against the wrap (inside .stars-tab, where the
  // cascade is defined) and reuse it for every draw.
  useEffect(() => {
    if (!wrapRef.current) return;
    const tabColor = getComputedStyle(wrapRef.current).getPropertyValue('--tab-color').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(tabColor)) accentRef.current = hexToRgbArr(tabColor);
  }, []);

  const clientToNorm = useCallback((clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const scaleX = CW / rect.width, scaleY = CH / rect.height;
    const cx = (clientX - rect.left) * scaleX, cy = (clientY - rect.top) * scaleY;
    return { x: Math.max(0, Math.min(1, cx / CW)), y: Math.max(0, Math.min(1, 1 - cy / CH)) };
  }, []);

  const findHit = useCallback((clientX, clientY) => {
    if (!points?.length) return -1;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return -1;
    const scaleX = CW / rect.width, scaleY = CH / rect.height;
    const mx = (clientX - rect.left) * scaleX, my = (clientY - rect.top) * scaleY;
    let best = -1, bestD2 = HIT_PX * HIT_PX;
    points.forEach((p, i) => {
      const { cx, cy } = ptToCv(p);
      const d2 = (mx - cx) ** 2 + (my - cy) ** 2;
      if (d2 < bestD2) { bestD2 = d2; best = i; }
    });
    return best;
  }, [points]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = CW, H = CH;
    ctx.clearRect(0, 0, W, H);

    if (!points?.length) {
      ctx.fillStyle = accent(0.4);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '11px monospace';
      ctx.fillText('Click to add control points', W / 2, H / 2);
      return;
    }

    const sortedByHeight = [...points].sort((a, b) => a.y - b.y);
    const cvByHeight = sortedByHeight.map(ptToCv);

    if (points.length >= 2) {
      cvByHeight.forEach(({ cx, cy }) => {
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(cx, cy);
        ctx.strokeStyle = accent(0.09); ctx.lineWidth = 1; ctx.setLineDash([2, 5]); ctx.stroke(); ctx.setLineDash([]);
      });
      ctx.beginPath();
      ctx.moveTo(0, cvByHeight[0].cy);
      cvByHeight.forEach(({ cx, cy }) => ctx.lineTo(cx, cy));
      ctx.lineTo(0, cvByHeight[cvByHeight.length - 1].cy);
      ctx.closePath();
      const ag = ctx.createLinearGradient(0, 0, W, 0);
      ag.addColorStop(0, accent(0.03)); ag.addColorStop(1, accent(0.22));
      ctx.fillStyle = ag; ctx.fill();

      const linePath = () => {
        ctx.beginPath(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        cvByHeight.forEach(({ cx, cy }, i) => i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy));
      };
      linePath(); ctx.strokeStyle = accent(0.22); ctx.lineWidth = 14; ctx.stroke();
      linePath(); ctx.strokeStyle = accent(0.55); ctx.lineWidth = 5;  ctx.stroke();
      linePath(); ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    const hovI = hoverIdx.current, dragI = dragIdx.current;
    points.forEach((p, i) => {
      const { cx, cy } = ptToCv(p);
      const isDrag = dragI === i, isHov = hovI === i, r = isDrag ? 9 : isHov ? 8 : 6;

      if (isDrag || isHov) {
        const haloR = r + (isDrag ? 11 : 7);
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
        halo.addColorStop(0, accent(isDrag ? 0.28 : 0.16));
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(cx, cy, haloR, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill();
      }

      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = isDrag ? 'rgba(30,30,34,0.92)' : isHov ? 'rgba(24,24,28,0.88)' : 'rgba(18,18,22,0.82)';
      ctx.fill();
      ctx.strokeStyle = accent(isDrag ? 0.95 : isHov ? 0.75 : 0.5);
      ctx.lineWidth = isDrag ? 1.5 : 1;
      ctx.stroke();

      ctx.beginPath(); ctx.arc(cx, cy, r - 1, Math.PI * 1.15, Math.PI * 1.75);
      ctx.strokeStyle = isDrag ? 'rgba(255,255,255,0.55)' : isHov ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1; ctx.stroke();

      if (isDrag || isHov) {
        const probLabel = (p.x * 100).toFixed(0) + '%';
        const heightLabel = (p.y * yMax).toFixed(0);
        const label = `prob ${probLabel}  h=${heightLabel}`;
        ctx.font = 'bold 10px monospace';
        const tw = ctx.measureText(label).width;
        let tx = cx, ty = cy - r - 18;
        if (ty < 12) ty = cy + r + 18;
        tx = Math.max(tw / 2 + 6, Math.min(W - tw / 2 - 6, tx));
        const pw = tw + 14, ph = 17, px2 = tx - pw / 2, py2 = ty - ph / 2;
        ctx.fillStyle = 'rgba(10,10,14,0.92)';
        ctx.beginPath(); ctx.roundRect?.(px2, py2, pw, ph, 3) ?? ctx.rect(px2, py2, pw, ph); ctx.fill();
        ctx.strokeStyle = accent(0.55); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect?.(px2, py2, pw, ph, 3) ?? ctx.rect(px2, py2, pw, ph); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, tx, ty);
      }
    });
  }, [points, yMax]);

  useEffect(() => { draw(); }, [draw]);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    if (e.button !== 0 && e.button !== 2) return;
    const hit = findHit(e.clientX, e.clientY);
    if (e.button === 2) {
      if (hit >= 0 && points.length > 2) { onChange(points.filter((_, i) => i !== hit)); hoverIdx.current = -1; draw(); }
      return;
    }
    if (hit >= 0) { dragIdx.current = hit; didMove.current = false; downPos.current = { clientX: e.clientX, clientY: e.clientY }; return; }
    const pos = clientToNorm(e.clientX, e.clientY);
    const newPts = [...points, pos].sort((a, b) => a.x - b.x);
    const newIdx = newPts.findIndex(p => p.x === pos.x && p.y === pos.y);
    onChange(newPts); dragIdx.current = newIdx; didMove.current = false; downPos.current = { clientX: e.clientX, clientY: e.clientY };
  }, [points, onChange, findHit, clientToNorm, draw]);

  useEffect(() => {
    const onMove = (e) => {
      if (dragIdx.current === null) {
        const h = findHit(e.clientX, e.clientY);
        if (h !== hoverIdx.current) { hoverIdx.current = h; draw(); }
        return;
      }
      didMove.current = true;
      const pos = clientToNorm(e.clientX, e.clientY);
      const updated = points.map((p, i) => i === dragIdx.current ? pos : p);
      const sorted = updated.sort((a, b) => a.x - b.x);
      onChange(sorted);
      const newIdx = sorted.findIndex(p => p.x === pos.x && p.y === pos.y);
      if (newIdx >= 0) dragIdx.current = newIdx;
    };
    const onUp = () => { if (dragIdx.current !== null) { dragIdx.current = null; draw(); } };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [points, onChange, findHit, clientToNorm, draw]);

  const onMouseLeave = useCallback(() => { if (dragIdx.current !== null) return; hoverIdx.current = -1; setIsHoveringPoint(false); draw(); }, [draw]);
  const onMouseMove  = useCallback((e) => {
    if (dragIdx.current !== null) return;
    const h = findHit(e.clientX, e.clientY);
    if (h !== hoverIdx.current) { hoverIdx.current = h; setIsHoveringPoint(h >= 0); draw(); }
  }, [findHit, draw]);

  const yMaxLabel = yMax >= 1000 ? `${(yMax / 1000).toFixed(1)}k` : String(yMax);

  return (
    <div className="st-curve-shell">
      <div className="st-curve-header">
        <span className="ctrl-label">Y-Distribution Curve</span>
        <div className="st-curve-header-stats">
          <span className="ctrl-badge">{points?.length ?? 0} pts</span>
          <span className="ctrl-badge">yMax {yMaxLabel}</span>
          <button className="ctrl-btn-add" onClick={() => onChange(DEFAULT_CURVE_POINTS)}>Reset</button>
        </div>
      </div>
      <div className="ec-canvas-wrap st-curve-wrap" ref={wrapRef}>
        <div className="st-curve-grid" aria-hidden="true" />
        <canvas ref={canvasRef} width={CW} height={CH} className="st-curve-canvas"
          style={{ cursor: isHoveringPoint ? 'pointer' : 'crosshair' }}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}
          onContextMenu={e => e.preventDefault()} />
        <span className="st-curve-axis-label st-curve-axis-label--ymax">{yMaxLabel}</span>
        <span className="st-curve-axis-label st-curve-axis-label--ymin">0</span>
        <span className="st-curve-axis-label st-curve-axis-label--y-caption">height ↑</span>
        <span className="st-curve-axis-label st-curve-axis-label--x0">0%</span>
        <span className="st-curve-axis-label st-curve-axis-label--x100">100%</span>
        <span className="st-curve-axis-label st-curve-axis-label--x-caption">probability →</span>
      </div>
      <div className="st-curve-hint">
        {isHoveringPoint ? (
          <><span className="st-curve-hint-active">Drag</span><span className="st-curve-hint-sep"> to move</span><span className="st-curve-hint-dot" /><span className="st-curve-hint-active">Right-click</span><span className="st-curve-hint-sep"> to remove</span></>
        ) : (
          <><span className="st-curve-hint-sep">Click canvas</span><span className="st-curve-hint-dot" /><span className="st-curve-hint-sep">to add a control point</span></>
        )}
      </div>
    </div>
  );
}
