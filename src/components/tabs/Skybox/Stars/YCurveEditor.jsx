import React, { useState, useRef, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────
// YCurveEditor — presentational canvas widget for the "Curve" Y-mode.
// Owns its own draw/drag effects (same pattern MapPreview presumably
// uses internally for its canvas) but exposes a clean props-in/
// callback-out surface, so it slots into Stars_Configuration as a
// dumb component. Colors here are Canvas2D draw calls, not CSS, so
// the design-system "tokens only" rule (which targets stylesheet
// values) doesn't apply to them.
// ─────────────────────────────────────────────────────────────────
export default function YCurveEditor({ points, onChange, yMax = 1500 }) {
  const canvasRef = useRef(null);
  const wrapRef   = useRef(null);

  const dragIdx   = useRef(null);
  const hoverIdx  = useRef(-1);
  const didMove   = useRef(false);
  const downPos   = useRef(null);

  const [isHoveringPoint, setIsHoveringPoint] = useState(false);

  const CW = 400, CH = 400;
  const HIT_PX = 14;

  const ptToCv = (p) => ({ cx: p.x * CW, cy: (1 - p.y) * CH });

  const clientToNorm = useCallback((clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const scaleX = CW / rect.width;
    const scaleY = CH / rect.height;
    const cx = (clientX - rect.left) * scaleX;
    const cy = (clientY - rect.top)  * scaleY;
    return {
      x: Math.max(0, Math.min(1, cx / CW)),
      y: Math.max(0, Math.min(1, 1 - cy / CH)),
    };
  }, []);

  const findHit = useCallback((clientX, clientY) => {
    if (!points?.length) return -1;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return -1;
    const scaleX = CW / rect.width;
    const scaleY = CH / rect.height;
    const mx = (clientX - rect.left) * scaleX;
    const my = (clientY - rect.top)  * scaleY;
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

    ctx.fillStyle = '#04030a';
    ctx.fillRect(0, 0, W, H);
    const vigGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.75);
    vigGrad.addColorStop(0, 'rgba(20,8,36,0)');
    vigGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.022)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const p = i / 8;
      ctx.beginPath(); ctx.moveTo(p * W, 0); ctx.lineTo(p * W, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p * H); ctx.lineTo(W, p * H); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(138,18,189,0.09)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const p = i / 4;
      ctx.beginPath(); ctx.moveTo(p * W, 0); ctx.lineTo(p * W, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p * H); ctx.lineTo(W, p * H); ctx.stroke();
    }

    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.textAlign = 'left';   ctx.textBaseline = 'bottom'; ctx.fillText('prob 0%', 5, H - 4);
    ctx.textAlign = 'right';  ctx.textBaseline = 'bottom'; ctx.fillText('100%', W - 5, H - 4);
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('→ probability', W / 2, H - 4);
    ctx.save();
    ctx.translate(10, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('height ↑', 0, 0);
    ctx.restore();
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';    ctx.fillText(`${yMax}`, 14, 4);
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('0', 14, H - 16);

    ctx.strokeStyle = 'rgba(138,18,189,0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    if (!points || points.length < 1) {
      ctx.fillStyle = 'rgba(138,18,189,0.3)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '11px monospace';
      ctx.fillText('Click to add control points', W / 2, H / 2);
      return;
    }

    const sortedByHeight = [...points].sort((a, b) => a.y - b.y);
    const cvByHeight = sortedByHeight.map(ptToCv);

    if (points.length >= 2) {
      cvByHeight.forEach(({ cx, cy }) => {
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(cx, cy);
        ctx.strokeStyle = 'rgba(138,18,189,0.07)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      ctx.beginPath();
      ctx.moveTo(0, cvByHeight[0].cy);
      cvByHeight.forEach(({ cx, cy }) => ctx.lineTo(cx, cy));
      ctx.lineTo(0, cvByHeight[cvByHeight.length - 1].cy);
      ctx.closePath();
      const areaGrad = ctx.createLinearGradient(0, 0, W, 0);
      areaGrad.addColorStop(0, 'rgba(138,18,189,0.03)');
      areaGrad.addColorStop(1, 'rgba(180,60,255,0.22)');
      ctx.fillStyle = areaGrad;
      ctx.fill();

      const linePath = () => {
        ctx.beginPath();
        ctx.lineJoin = 'round';
        ctx.lineCap  = 'round';
        cvByHeight.forEach(({ cx, cy }, i) => i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy));
      };
      linePath();
      ctx.strokeStyle = 'rgba(138,18,189,0.22)';
      ctx.lineWidth = 14;
      ctx.stroke();
      linePath();
      ctx.strokeStyle = 'rgba(165,40,220,0.5)';
      ctx.lineWidth = 5;
      ctx.stroke();
      linePath();
      ctx.strokeStyle = 'rgba(210,120,255,0.95)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    const hovI  = hoverIdx.current;
    const dragI = dragIdx.current;

    points.forEach((p, i) => {
      const { cx, cy } = ptToCv(p);
      const isDrag = dragI === i;
      const isHov  = hovI === i;
      const r = isDrag ? 9 : isHov ? 8 : 6;

      if (isDrag || isHov) {
        const haloR = r + (isDrag ? 13 : 8);
        const halo  = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
        halo.addColorStop(0, isDrag ? 'rgba(180,60,255,0.28)' : 'rgba(138,18,189,0.18)');
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = isDrag ? 'rgba(55,25,75,0.95)' : isHov ? 'rgba(40,16,60,0.92)' : 'rgba(22,10,38,0.85)';
      ctx.fill();
      ctx.strokeStyle = `rgba(185,80,255,${isDrag ? 1.0 : isHov ? 0.8 : 0.5})`;
      ctx.lineWidth   = isDrag ? 1.5 : 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r - 1, Math.PI * 1.15, Math.PI * 1.75);
      ctx.strokeStyle = isDrag ? 'rgba(255,255,255,0.6)' : isHov ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (isDrag || isHov) {
        const probLabel   = (p.x * 100).toFixed(0) + '%';
        const heightLabel = (p.y * yMax).toFixed(0);
        const label = `prob ${probLabel}  h=${heightLabel}`;
        ctx.font = 'bold 10px monospace';
        const tw = ctx.measureText(label).width;
        let tx = cx, ty = cy - r - 18;
        if (ty < 12) ty = cy + r + 18;
        tx = Math.max(tw / 2 + 6, Math.min(W - tw / 2 - 6, tx));
        const pw = tw + 14, ph = 17, px2 = tx - pw / 2, py2 = ty - ph / 2;
        ctx.fillStyle = 'rgba(12,5,22,0.95)';
        ctx.beginPath();
        ctx.roundRect?.(px2, py2, pw, ph, 3) ?? ctx.rect(px2, py2, pw, ph);
        ctx.fill();
        ctx.strokeStyle = 'rgba(185,80,255,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect?.(px2, py2, pw, ph, 3) ?? ctx.rect(px2, py2, pw, ph);
        ctx.stroke();
        ctx.fillStyle = 'rgba(225,170,255,0.95)';
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
      if (hit >= 0 && points.length > 2) {
        onChange(points.filter((_, i) => i !== hit));
        hoverIdx.current = -1;
        draw();
      }
      return;
    }

    if (hit >= 0) {
      dragIdx.current  = hit;
      didMove.current  = false;
      downPos.current  = { clientX: e.clientX, clientY: e.clientY };
      return;
    }

    const pos = clientToNorm(e.clientX, e.clientY);
    const newPts = [...points, pos].sort((a, b) => a.x - b.x);
    const newIdx = newPts.findIndex(p => p.x === pos.x && p.y === pos.y);
    onChange(newPts);
    dragIdx.current = newIdx;
    didMove.current = false;
    downPos.current = { clientX: e.clientX, clientY: e.clientY };
  }, [points, onChange, findHit, clientToNorm, draw]);

  useEffect(() => {
    const onMove = (e) => {
      if (dragIdx.current === null) {
        const h = findHit(e.clientX, e.clientY);
        if (h !== hoverIdx.current) {
          hoverIdx.current = h;
          draw();
        }
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

    const onUp = () => {
      if (dragIdx.current !== null) {
        dragIdx.current = null;
        draw();
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [points, onChange, findHit, clientToNorm, draw]);

  const onMouseLeave = useCallback(() => {
    if (dragIdx.current !== null) return;
    hoverIdx.current = -1;
    setIsHoveringPoint(false);
    draw();
  }, [draw]);

  const onMouseMove = useCallback((e) => {
    if (dragIdx.current !== null) return;
    const h = findHit(e.clientX, e.clientY);
    if (h !== hoverIdx.current) {
      hoverIdx.current = h;
      setIsHoveringPoint(h >= 0);
      draw();
    }
  }, [findHit, draw]);

  const cursorStyle = isHoveringPoint ? 'pointer' : 'crosshair';
  const ptCount = points?.length ?? 0;
  const yMaxLabel = yMax >= 1000 ? `${(yMax / 1000).toFixed(1)}k` : String(yMax);

  return (
    <div className="st-curve-wrap" ref={wrapRef}>
      <div className="st-curve-header">
        <span className="st-curve-header-label">Y-Distribution Curve</span>
        <div className="st-curve-header-stats">
          <span className="st-curve-stat">pts <span className="st-curve-stat-val">{ptCount}</span></span>
          <span className="st-curve-stat">yMax <span className="st-curve-stat-val">{yMaxLabel}</span></span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={CW} height={CH}
        className="st-curve-canvas"
        style={{ cursor: cursorStyle }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onContextMenu={e => e.preventDefault()}
      />

      <div className="st-curve-hint">
        {isHoveringPoint ? (
          <>
            <span className="st-curve-hint-active">Drag</span>
            <span className="st-curve-hint-sep">to move</span>
            <span className="st-curve-hint-dot" />
            <span className="st-curve-hint-active">Right-click</span>
            <span className="st-curve-hint-sep">to remove</span>
          </>
        ) : (
          <>
            <span className="st-curve-hint-sep">Click canvas</span>
            <span className="st-curve-hint-dot" />
            <span className="st-curve-hint-sep">to add a control point</span>
          </>
        )}
      </div>
    </div>
  );
}
