import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../../../shared/shared.css';
import './Stars.css';
import { luxuryAlert } from '../../../modals/notifications.js';
import { generateReadme as buildReadme, writeReadme } from '../../../../../utils/readmeGenerator';
import StarsHelpModal from '../../HelpModals/Stars_help.jsx';

// ── Constants ─────────────────────────────────────────────────
const UV_COLORS = [
  '#a855f7','#22d3ee','#34d399','#f59e0b',
  '#f43f5e','#60a5fa','#fb923c','#84cc16',
];

const DEFAULTS = {
  numStars:        '50',
  numClusters:     '10',
  clusterSpread:   '14000',
  clusterStdDev:   '1800',
  backgroundRatio: '0.45',
  scaleMin:        '10',
  scaleMax:        '30',
  uvOpacity:       '0.25',
  uvOptions:       '0.0, 0.0, 0.5, 0.5\n0.5, 0.0, 0.5, 0.5\n0.0, 0.5, 0.5, 0.5\n0.5, 0.5, 0.5, 0.5',
  uvWeights:       '0.25\n0.25\n0.25\n0.25',
};

// Default UV rows as structured objects (replaces textarea approach)
const DEFAULT_UV_ROWS = [
  { x: '0.0', y: '0.0', z: '0.5', w: '0.5', weight: '0.25' },
  { x: '0.5', y: '0.0', z: '0.5', w: '0.5', weight: '0.25' },
  { x: '0.0', y: '0.5', z: '0.5', w: '0.5', weight: '0.25' },
  { x: '0.5', y: '0.5', z: '0.5', w: '0.5', weight: '0.25' },
];

const EX_RES = 800;
const UV_RES = 400;

// ── Helpers ───────────────────────────────────────────────────
const clamp01 = v => Math.max(0, Math.min(1, v));

function gaussianRandom(std) {
  const u1 = Math.random(), u2 = Math.random();
  return std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ── Curve Editor Canvas Component ────────────────────────────
function YCurveEditor({ points, onChange, yMax = 1500 }) {
  const canvasRef = useRef(null);
  const wrapRef   = useRef(null);

  // All mutable interaction state lives in refs — never triggers re-renders
  const dragIdx   = useRef(null);   // index currently being dragged
  const hoverIdx  = useRef(-1);     // index currently under cursor (-1 = none)
  const didMove   = useRef(false);  // true once we move > threshold after mousedown
  const downPos   = useRef(null);   // canvas-space position at mousedown

  const [isHoveringPoint, setIsHoveringPoint] = useState(false); // drives cursor + hint bar

  // ── Canvas sizing ─────────────────────────────────────────────
  const CW = 400, CH = 400;
  // Hit radius in canvas pixels
  const HIT_PX = 14;

  // New semantics: p.x = probability (0–1), p.y = height (0–1 normalized)
  // Canvas: cx = p.x * CW  (prob → right),  cy = (1 - p.y) * CH  (height → up)
  const ptToCv = (p) => ({ cx: p.x * CW, cy: (1 - p.y) * CH });

  // Convert clientXY → { x: prob(0-1), y: height(0-1) }
  const clientToNorm = useCallback((clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const scaleX = CW / rect.width;
    const scaleY = CH / rect.height;
    const cx = (clientX - rect.left) * scaleX;
    const cy = (clientY - rect.top)  * scaleY;
    return {
      x: Math.max(0, Math.min(1, cx / CW)),           // probability
      y: Math.max(0, Math.min(1, 1 - cy / CH)),       // height
    };
  }, []);

  // ── Find nearest point (in canvas-px distance) ──────────────
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
      const d2 = (mx - cx)**2 + (my - cy)**2;
      if (d2 < bestD2) { bestD2 = d2; best = i; }
    });
    return best;
  }, [points]);

  // ── Draw ─────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = CW, H = CH;

    ctx.clearRect(0, 0, W, H);

    // Background — deep dark with subtle vignette
    ctx.fillStyle = '#04030a';
    ctx.fillRect(0, 0, W, H);
    const vigGrad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W * 0.75);
    vigGrad.addColorStop(0,   'rgba(20,8,36,0)');
    vigGrad.addColorStop(1,   'rgba(0,0,0,0.55)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, W, H);

    // Fine grid
    ctx.strokeStyle = 'rgba(255,255,255,0.022)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const p = i / 8;
      ctx.beginPath(); ctx.moveTo(p*W, 0); ctx.lineTo(p*W, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p*H); ctx.lineTo(W, p*H); ctx.stroke();
    }
    // Major grid — purple tint
    ctx.strokeStyle = 'rgba(138,18,189,0.09)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const p = i / 4;
      ctx.beginPath(); ctx.moveTo(p*W, 0); ctx.lineTo(p*W, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p*H); ctx.lineTo(W, p*H); ctx.stroke();
    }

    // ── Axis labels ──
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';

    // X axis — probability, bottom
    ctx.textAlign = 'left';  ctx.textBaseline = 'bottom'; ctx.fillText('prob 0%', 5, H - 4);
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('100%', W - 5, H - 4);
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('→ probability', W/2, H - 4);

    // Y axis — height, left side rotated
    ctx.save();
    ctx.translate(10, H/2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('height ↑', 0, 0);
    ctx.restore();

    // Y axis values
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';    ctx.fillText(`${yMax}`, 14, 4);
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('0', 14, H - 16);

    // Border — purple glow
    ctx.strokeStyle = 'rgba(138,18,189,0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W-1, H-1);

    if (!points || points.length < 1) {
      ctx.fillStyle = 'rgba(138,18,189,0.3)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '11px monospace';
      ctx.fillText('Click to add control points', W/2, H/2);
      return;
    }

    // Sort by height (Y) for drawing the curve left→right on height axis
    const sortedByHeight = [...points].sort((a, b) => a.y - b.y);
    const cvByHeight = sortedByHeight.map(ptToCv);

    if (points.length >= 2) {
      // ── Horizontal spread lines ──
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

      // ── Filled area ──
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

      // ── Line — 3 glow passes ──
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

    // ── Control points — dark glassmorphism ──
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

      // Point body
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = isDrag ? 'rgba(55,25,75,0.95)' : isHov ? 'rgba(40,16,60,0.92)' : 'rgba(22,10,38,0.85)';
      ctx.fill();
      ctx.strokeStyle = `rgba(185,80,255,${isDrag ? 1.0 : isHov ? 0.8 : 0.5})`;
      ctx.lineWidth   = isDrag ? 1.5 : 1;
      ctx.stroke();

      // Glass sheen arc
      ctx.beginPath();
      ctx.arc(cx, cy, r - 1, Math.PI * 1.15, Math.PI * 1.75);
      ctx.strokeStyle = isDrag ? 'rgba(255,255,255,0.6)' : isHov ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Tooltip
      if (isDrag || isHov) {
        const probLabel   = (p.x * 100).toFixed(0) + '%';
        const heightLabel = (p.y * yMax).toFixed(0);
        const label = `prob ${probLabel}  h=${heightLabel}`;
        ctx.font = 'bold 10px monospace';
        const tw = ctx.measureText(label).width;
        let tx = cx, ty = cy - r - 18;
        if (ty < 12) ty = cy + r + 18;
        tx = Math.max(tw/2 + 6, Math.min(W - tw/2 - 6, tx));
        const pw = tw + 14, ph = 17, px2 = tx - pw/2, py2 = ty - ph/2;
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

  // ── Interaction ──────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    if (e.button !== 0 && e.button !== 2) return;

    const hit = findHit(e.clientX, e.clientY);

    // Right-click: only remove if cursor is ON a point
    if (e.button === 2) {
      if (hit >= 0 && points.length > 2) {
        onChange(points.filter((_, i) => i !== hit));
        hoverIdx.current = -1;
        draw();
      }
      return;
    }

    // Left-click ON a point → start drag
    if (hit >= 0) {
      dragIdx.current  = hit;
      didMove.current  = false;
      downPos.current  = { clientX: e.clientX, clientY: e.clientY };
      return;
    }

    // Left-click on empty space → add point immediately, then drag it
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
        // Just update hover
        const h = findHit(e.clientX, e.clientY);
        if (h !== hoverIdx.current) {
          hoverIdx.current = h;
          draw();
        }
        return;
      }
      // We're dragging
      didMove.current = true;
      const pos = clientToNorm(e.clientX, e.clientY);
      const updated = points.map((p, i) => i === dragIdx.current ? pos : p);
      onChange(updated.sort((a, b) => a.x - b.x));
      // After sort, our dragged point may have shifted index — update dragIdx
      // to the point closest to pos so dragging stays on the right node
      const newIdx = updated.sort((a,b)=>a.x-b.x).findIndex(p => p.x === pos.x && p.y === pos.y);
      if (newIdx >= 0) dragIdx.current = newIdx;
    };

    const onUp = () => {
      if (dragIdx.current !== null) {
        dragIdx.current = null;
        // Re-check hover at current mouse position happens on next mousemove
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
    if (dragIdx.current !== null) return; // keep hover while dragging
    hoverIdx.current = -1;
    setIsHoveringPoint(false);
    draw();
  }, [draw]);

  const onMouseMove = useCallback((e) => {
    if (dragIdx.current !== null) return; // global listener handles drag
    const h = findHit(e.clientX, e.clientY);
    if (h !== hoverIdx.current) {
      hoverIdx.current = h;
      setIsHoveringPoint(h >= 0);
      draw();
    }
  }, [findHit, draw]);

  // Cursor: pointer when over a point, crosshair otherwise
  const cursorStyle = isHoveringPoint ? 'pointer' : 'crosshair';

  // Live stats for header
  const ptCount = points?.length ?? 0;
  const yMaxLabel = yMax >= 1000 ? `${(yMax/1000).toFixed(1)}k` : String(yMax);

  return (
    <div className="st-curve-wrap" ref={wrapRef}>
      {/* ── Header strip ── */}
      <div className="st-curve-header">
        <span className="st-curve-header-label">Y-Distribution Curve</span>
        <div className="st-curve-header-stats">
          <span className="st-curve-stat">pts <span className="st-curve-stat-val">{ptCount}</span></span>
          <span className="st-curve-stat">yMax <span className="st-curve-stat-val">{yMaxLabel}</span></span>
        </div>
      </div>

      {/* ── Canvas ── */}
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

      {/* ── Hint footer ── */}
      <div className="st-curve-hint">
        {isHoveringPoint ? (
          <>
            <span className="st-curve-hint-active">Drag</span>
            <span className="st-curve-hint-sep">to move</span>
            <span className="st-curve-hint-dot"/>
            <span className="st-curve-hint-active">Right-click</span>
            <span className="st-curve-hint-sep">to remove</span>
          </>
        ) : (
          <>
            <span className="st-curve-hint-sep">Click canvas</span>
            <span className="st-curve-hint-dot"/>
            <span className="st-curve-hint-sep">to add a control point</span>
          </>
        )}
      </div>
    </div>
  );
}

function parseUvOptions(text) {
  return text.split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#'))
    .map(l => {
      const v = l.split(',').map(n => parseFloat(n.trim()));
      return v.length === 4 && v.every(n => !isNaN(n))
        ? { x: v[0], y: v[1], z: v[2], w: v[3] } : null;
    }).filter(Boolean);
}

function parseWeights(text) {
  return text.split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#'))
    .map(l => parseFloat(l.trim()))
    .filter(n => !isNaN(n));
}

// Convert structured uvRows array → legacy string formats consumed by buildStars
function uvRowsToOptions(rows) {
  return rows.map(r => `${r.x}, ${r.y}, ${r.z}, ${r.w}`).join('\n');
}
function uvRowsToWeights(rows) {
  return rows.map(r => r.weight).join('\n');
}

function weightedPick(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return weights.length - 1;
}

function inExclusionZone(px, pz, zone, spread) {
  if (!zone) return false;
  const toW = v => (v * 2 - 1) * spread;
  const x0 = toW(Math.min(zone.x0, zone.x1)), x1 = toW(Math.max(zone.x0, zone.x1));
  const z0 = toW(Math.min(zone.y0, zone.y1)), z1 = toW(Math.max(zone.y0, zone.y1));
  return px >= x0 && px <= x1 && pz >= z0 && pz <= z1;
}

// ── Seeded PRNG (mulberry32) ──────────────────────────────────
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function gaussianRandomSeeded(std, rng) {
  const u1 = rng(), u2 = rng();
  return std * Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
}

// ── Y-Distribution modes ──────────────────────────────────────
const Y_MODES = [
  { value: 'flat',      label: 'Flat' },
  { value: 'gaussian',  label: 'Gaussian' },
  { value: 'layered',   label: 'Layered' },
  { value: 'disk_halo', label: 'Disk + Halo' },
  { value: 'curve',     label: 'Curve Editor' },
];

const Y_DEFAULTS = {
  flat:      { yMax: '1500' },
  gaussian:  { yCenter: '750', yStdDev: '300' },
  layered:   { yLayers: '200, 400, 0.7\n900, 200, 0.3' },
  disk_halo: { diskCenter: '100', diskStdDev: '120', haloStdDev: '800', haloRatio: '0.15' },
  curve:     {},
};

// Sample Y-height from curve — new semantics: p.x=probability weight(0-1), p.y=height(0-1)
// The curve is read as: for a random draw, what height do we get?
// We sort by height (p.y), use p.x as the probability weight at that height,
// then do a weighted random pick of height.
function sampleFromCurve(points, yMax, rng) {
  if (!points || points.length < 2) return rng() * yMax;
  // Sort by height (y-axis = height)
  const sorted = [...points].sort((a, b) => a.y - b.y);
  const N = sorted.length;
  // Integrate trapezoidally along height axis, using prob (p.x) as weight
  const areas = [];
  let total = 0;
  for (let i = 0; i < N - 1; i++) {
    const w = (sorted[i].x + sorted[i+1].x) / 2 * (sorted[i+1].y - sorted[i].y);
    areas.push(w);
    total += w;
  }
  if (total <= 0) return rng() * yMax;
  // Weighted random pick → interpolate height
  let r = rng() * total;
  for (let i = 0; i < areas.length; i++) {
    if (r <= areas[i] || i === areas.length - 1) {
      const t = areas[i] > 0 ? r / areas[i] : 0;
      const h01 = sorted[i].y + t * (sorted[i+1].y - sorted[i].y);
      return h01 * yMax;
    }
    r -= areas[i];
  }
  return rng() * yMax;
}

function parseLayeredText(text) {
  return text.split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#'))
    .map(l => {
      const v = l.split(',').map(n => parseFloat(n.trim()));
      return v.length === 3 && v.every(n => !isNaN(n))
        ? { center: v[0], stddev: v[1], weight: v[2] } : null;
    }).filter(Boolean);
}

// ── Small components ──────────────────────────────────────────
function Field({ label, help, children, style }) {
  return (
    <div className="form-group" style={style}>
      {label && <label className="form-label">{label}</label>}
      {help  && <p className="form-help">{help}</p>}
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="st-toggle-label">
      <input type="checkbox" className="st-toggle-input" checked={checked} onChange={onChange}/>
      <span className="st-toggle-track"><span className="st-toggle-thumb"/></span>
      {label && <span className="st-toggle-text">{label}</span>}
    </label>
  );
}

// ── Custom Styled Select — replaces native <select> to avoid browser cyan ────
function StyledSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div className="st-styled-select" ref={ref}>
      <button
        type="button"
        className={`st-styled-select-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <span>{selected?.label ?? value}</span>
        <svg className="st-styled-select-arrow" width="10" height="6" viewBox="0 0 10 6">
          <path d="M0 0L5 6L10 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="st-styled-select-dropdown">
          {options.map(o => (
            <div
              key={o.value}
              className={`st-styled-select-option${o.value === value ? ' selected' : ''}`}
              onMouseDown={() => { onChange(o.value); setOpen(false); }}
            >
              {o.value === value && <span className="st-styled-select-tick">✓</span>}
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
const StarsTab = ({ settings, shared = {}, onSharedChange = () => {}, onRecordSnapshot = () => {} }) => {

  const mkState = key => {
    const [v, setV] = useState(shared[`st_${key}`] ?? DEFAULTS[key]);
    const set = val => { setV(val); onSharedChange(`st_${key}`, val); };
    return [v, set];
  };

  const [numStars,        setNumStars]        = mkState('numStars');
  const [numClusters,     setNumClusters]      = mkState('numClusters');
  const [clusterSpread,   setClusterSpread]    = mkState('clusterSpread');
  const [clusterStdDev,   setClusterStdDev]    = mkState('clusterStdDev');
  const [backgroundRatio, setBackgroundRatio]  = mkState('backgroundRatio');
  const [scaleMin,        setScaleMin]         = mkState('scaleMin');
  const [scaleMax,        setScaleMax]         = mkState('scaleMax');
  const [uvOpacity,       setUvOpacity]        = mkState('uvOpacity');
  // Legacy string states kept for canvas rendering compatibility
  const [uvOptions,       setUvOptions]        = mkState('uvOptions');
  const [uvWeights,       setUvWeights]        = mkState('uvWeights');

  // Structured UV rows — single source of truth for the input table
  const [uvRows, setUvRows] = useState(() => {
    // Try to hydrate from shared state (legacy strings) on first load
    try {
      const opts = (shared['st_uvOptions'] || DEFAULTS.uvOptions).split('\n').filter(l => l.trim() && !l.startsWith('#'));
      const wts  = (shared['st_uvWeights'] || DEFAULTS.uvWeights).split('\n').filter(l => l.trim() && !l.startsWith('#'));
      if (opts.length) {
        return opts.map((line, i) => {
          const parts = line.split(',').map(s => s.trim());
          return { x: parts[0]||'0', y: parts[1]||'0', z: parts[2]||'0.5', w: parts[3]||'0.5', weight: wts[i]?.trim() || '0.25' };
        });
      }
    } catch(_) {}
    return DEFAULT_UV_ROWS;
  });

  // Sync uvRows → legacy strings whenever rows change
  const syncUvRows = (rows) => {
    setUvRows(rows);
    const optStr = uvRowsToOptions(rows);
    const wtStr  = uvRowsToWeights(rows);
    setUvOptions(optStr);
    setUvWeights(wtStr);
  };

  // ── Map Context (autark) ──────────────────────────────────────
  const [mapName,        setMapName]        = useState(shared.sb_mapName       || shared.pt_mapName       || shared.wr_mapName       || '');
  const [exportRawJson,  setExportRawJson]  = useState(shared.st_exportRawJson ?? false);
  const [generateReadme, setGenerateReadme] = useState(shared.st_generateReadme ?? true);

  // Sync in from other tabs when shared changes externally
  useEffect(() => {
    const ext = shared.sb_mapName || shared.pt_mapName || shared.wr_mapName || '';
    if (ext && !mapName) setMapName(ext);
  }, [shared.sb_mapName, shared.pt_mapName, shared.wr_mapName]);

  // ── Seed ──────────────────────────────────────────────────────
  const [seed,    setSeed]    = useState(42);
  const [useSeed, setUseSeed] = useState(false);

  const randomizeSeed = () => setSeed(Math.floor(Math.random() * 999999) + 1);

  // ── Y-Distribution ────────────────────────────────────────────
  const [yMode,       setYMode]       = useState('flat');
  // flat
  const [yMax,        setYMax]        = useState('1500');
  // gaussian
  const [yCenter,     setYCenter]     = useState('750');
  const [yStdDev,     setYStdDev]     = useState('300');
  // layered  (center, stddev, weight — one layer per line)
  const [yLayers,     setYLayers]     = useState('200, 400, 0.7\n900, 200, 0.3');
  // disk + halo
  const [diskCenter,  setDiskCenter]  = useState('100');
  const [diskStdDev,  setDiskStdDev]  = useState('120');
  const [haloStdDev,  setHaloStdDev]  = useState('800');
  const [haloRatio,   setHaloRatio]   = useState('0.15');
  // curve editor — x=probability(0-1), y=height(0-1 normalized)
  const [curvePoints, setCurvePoints] = useState([
    { x: 0.05, y: 0.0 }, { x: 1.0, y: 0.15 }, { x: 0.3, y: 0.5 }, { x: 0.05, y: 1.0 },
  ]);
  // cluster Y scatter — how much a star within a cluster can deviate from the cluster's Y center
  const [yClusterScatter, setYClusterScatter] = useState('200');

  // ── Exclusion zones ───────────────────────────────────────────
  const [exclusionZones,   setExclusionZones]   = useState([]);
  const [draftZone,        setDraftZone]         = useState(null);
  const [selectedZoneIdx,  setSelectedZoneIdx]   = useState(null);
  const [exEnabled,        setExEnabled]         = useState(true);

  // ── Help modal ────────────────────────────────────────────────
  const [showHelp,       setShowHelp]       = useState(false);
  const [activeHelpTab,  setActiveHelpTab]  = useState('guide');
  const [helpSelected,   setHelpSelected]   = useState(null);
  const [activeAdvSubTab,setActiveAdvSubTab]= useState('workflow');

  // drag refs — same pattern as TextureAdjustOverlay
  const exDragging  = useRef(false);
  const exDragStart = useRef({ x: 0, y: 0 });
  const exDraft     = useRef(null);   // live zone rect during drag

  // ── UV / texture ──────────────────────────────────────────────
  const [previewImage,     setPreviewImage]     = useState(null);
  const [previewImageData, setPreviewImageData] = useState(null);
  const [texOpacity,       setTexOpacity]       = useState(1);   // PNG overlay opacity

  const uvCanvasRef  = useRef(null);
  const exCanvasRef  = useRef(null);   // single canvas: grid + zone overlay
  const exWrapRef    = useRef(null);   // inner wrap div — coordinate reference (like PTE's selWrapRef)
  const fileInputRef = useRef(null);

  // ── Draw exclusion canvas (grid + all zones + draft) ─────────
  const drawExCanvas = useCallback((zones, draft) => {
    const canvas = exCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#08080f';
    ctx.fillRect(0, 0, W, H);

    // Fine 16×16 grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 16; i++) {
      const p = i / 16;
      ctx.beginPath(); ctx.moveTo(p*W, 0); ctx.lineTo(p*W, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p*H); ctx.lineTo(W, p*H); ctx.stroke();
    }
    // Major 4×4 grid
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const p = i / 4;
      ctx.beginPath(); ctx.moveTo(p*W, 0); ctx.lineTo(p*W, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p*H); ctx.lineTo(W, p*H); ctx.stroke();
    }
    // Center crosshair
    ctx.strokeStyle = 'rgba(138,18,189,0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();
    ctx.setLineDash([]);
    // Center dot
    ctx.fillStyle = 'rgba(138,18,189,0.65)';
    ctx.beginPath(); ctx.arc(W/2, H/2, 3, 0, Math.PI*2); ctx.fill();
    // Corner labels
    const spread = parseFloat(clusterSpread) || 14000;
    const toK = v => ((v*2-1)*spread/1000).toFixed(0)+'k';
    ctx.font = '9px monospace';
    [
      { nx:0, ny:0, ax:'left',  ay:'top',    px:5,   py:5   },
      { nx:1, ny:0, ax:'right', ay:'top',    px:W-4, py:5   },
      { nx:0, ny:1, ax:'left',  ay:'bottom', px:5,   py:H-5 },
      { nx:1, ny:1, ax:'right', ay:'bottom', px:W-4, py:H-5 },
    ].forEach(({ nx, ny, ax, ay, px, py }) => {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.textAlign = ax; ctx.textBaseline = ay;
      ctx.fillText(`${toK(nx)}, ${toK(ny)}`, px, py);
    });
    ctx.fillStyle = 'rgba(138,18,189,0.7)';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('0, 0', W/2 + 1, H/2 + 10);
    ctx.strokeStyle = 'rgba(138,18,189,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, W, H);

    // ── Committed zone overlays — true union fill + true union outline ──
    if (exEnabled && zones.length > 0) {

      // Offscreen A: union of all zones filled solid white
      const offUnion = document.createElement('canvas');
      offUnion.width = W; offUnion.height = H;
      const uCtx = offUnion.getContext('2d');
      uCtx.fillStyle = '#fff';
      zones.forEach(zone => {
        const x0 = Math.min(zone.x0, zone.x1) * W;
        const y0 = Math.min(zone.y0, zone.y1) * H;
        const w  = Math.abs(zone.x1 - zone.x0) * W;
        const h  = Math.abs(zone.y1 - zone.y0) * H;
        uCtx.fillRect(x0, y0, w, h);
      });

      // Offscreen B: same union eroded by 2px (shrunk inward by filling black inside each rect)
      // Erosion = union minus a 2px inset copy of the union
      // We achieve this by drawing union, then cutting a 2px-shrunk version of the WHOLE union
      // using destination-out. The shrunk version is drawn by re-filling each rect 2px inset.
      const offEroded = document.createElement('canvas');
      offEroded.width = W; offEroded.height = H;
      const eCtx = offEroded.getContext('2d');
      eCtx.fillStyle = '#fff';
      zones.forEach(zone => {
        const x0 = Math.min(zone.x0, zone.x1) * W;
        const y0 = Math.min(zone.y0, zone.y1) * H;
        const w  = Math.abs(zone.x1 - zone.x0) * W;
        const h  = Math.abs(zone.y1 - zone.y0) * H;
        eCtx.fillRect(x0 + 2, y0 + 2, Math.max(0, w - 4), Math.max(0, h - 4));
      });

      // Rim = union MINUS eroded: pixels in union but not in eroded = outer 2px ring
      // We compute: draw union, then destination-out the eroded mask
      const offRim = document.createElement('canvas');
      offRim.width = W; offRim.height = H;
      const rCtx = offRim.getContext('2d');
      rCtx.drawImage(offUnion, 0, 0);
      rCtx.globalCompositeOperation = 'destination-out';
      rCtx.drawImage(offEroded, 0, 0);
      // offRim now contains ONLY the true outer-edge pixels of the union shape

      // Fill: draw union at low opacity (red) — merged fill, no double-alpha at overlaps
      const offFill = document.createElement('canvas');
      offFill.width = W; offFill.height = H;
      const fCtx = offFill.getContext('2d');
      fCtx.fillStyle = 'rgba(255,50,50,1)';
      fCtx.drawImage(offUnion, 0, 0); // union mask
      fCtx.globalCompositeOperation = 'source-in';
      fCtx.fillStyle = 'rgba(255,50,50,1)';
      fCtx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.1;
      ctx.drawImage(offUnion, 0, 0);
      ctx.globalAlpha = 1;

      // Outline: tint the rim red and draw it
      const offOutline = document.createElement('canvas');
      offOutline.width = W; offOutline.height = H;
      const oCtx = offOutline.getContext('2d');
      oCtx.fillStyle = 'rgba(255,80,80,0.95)';
      oCtx.fillRect(0, 0, W, H);
      oCtx.globalCompositeOperation = 'destination-in';
      oCtx.drawImage(offRim, 0, 0);
      ctx.drawImage(offOutline, 0, 0);

      // Corner dots + labels per zone
      zones.forEach((zone, i) => {
        const x0 = Math.min(zone.x0, zone.x1) * W;
        const y0 = Math.min(zone.y0, zone.y1) * H;
        const w  = Math.abs(zone.x1 - zone.x0) * W;
        const h  = Math.abs(zone.y1 - zone.y0) * H;
        const isSelected = i === selectedZoneIdx;
        if (isSelected) {
          ctx.fillStyle = 'rgba(255,50,50,0.12)';
          ctx.fillRect(x0, y0, w, h);
        }
        [[x0,y0],[x0+w,y0],[x0,y0+h],[x0+w,y0+h]].forEach(([cx,cy]) => {
          ctx.fillStyle = isSelected ? '#ff8080' : '#ff5050';
          ctx.beginPath(); ctx.arc(cx, cy, isSelected ? 5 : 4, 0, Math.PI*2); ctx.fill();
        });
        if (w > 40 && h > 22) {
          ctx.fillStyle = isSelected ? 'rgba(255,100,100,1)' : 'rgba(255,80,80,0.75)';
          ctx.font = `bold ${isSelected ? 11 : 10}px monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(`ZONE ${i + 1}`, x0 + w / 2, y0 + h / 2);
        }
      });
    }

    // ── Draft zone overlay — purple ──
    if (draft) {
      const x0 = Math.min(draft.x0, draft.x1) * W;
      const y0 = Math.min(draft.y0, draft.y1) * H;
      const w  = Math.abs(draft.x1 - draft.x0) * W;
      const h  = Math.abs(draft.y1 - draft.y0) * H;
      ctx.fillStyle = 'rgba(138,18,189,0.12)';
      ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = 'rgba(180,80,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x0, y0, w, h);
      ctx.setLineDash([]);
      [[x0,y0],[x0+w,y0],[x0,y0+h],[x0+w,y0+h]].forEach(([cx,cy]) => {
        ctx.fillStyle = 'rgba(180,80,255,0.9)';
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2); ctx.fill();
      });
      if (w > 60 && h > 22) {
        ctx.fillStyle = 'rgba(180,80,255,0.85)';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('CONFIRM ZONE?', x0 + w / 2, y0 + h / 2);
      }
    }
  }, [exEnabled, clusterSpread, selectedZoneIdx]);

  // Redraw when zones / draft / enabled / spread / selection changes
  useEffect(() => { drawExCanvas(exclusionZones, draftZone); },
    [exclusionZones, draftZone, exEnabled, clusterSpread, drawExCanvas, selectedZoneIdx]);

  // ── UV canvas ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = uvCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background / texture
    if (previewImage?.complete) {
      // opacity > 1: draw image multiple times to simulate overbright/burn effect
      const fullPasses = Math.floor(texOpacity);
      const remainder  = texOpacity - fullPasses;
      for (let i = 0; i < fullPasses; i++) {
        ctx.globalAlpha = 1;
        ctx.drawImage(previewImage, 0, 0, W, H);
      }
      if (remainder > 0) {
        ctx.globalAlpha = remainder;
        ctx.drawImage(previewImage, 0, 0, W, H);
      }
      ctx.globalAlpha = 1;
      // dim layer only when opacity <= 1
      if (texOpacity <= 1) {
        ctx.fillStyle = `rgba(0,0,0,${0.28 * (1 - texOpacity * 0.5)})`;
        ctx.fillRect(0, 0, W, H);
      }
    } else {
      ctx.fillStyle = '#0e0e14';
      ctx.fillRect(0, 0, W, H);
    }

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const p = (i/4)*W;
      ctx.beginPath(); ctx.moveTo(p,0); ctx.lineTo(p,H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,p); ctx.lineTo(W,p); ctx.stroke();
    }

    // Corner labels
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.textAlign='left';  ctx.textBaseline='bottom'; ctx.fillText('(0,0)',4,H-3);
    ctx.textAlign='right'; ctx.textBaseline='bottom'; ctx.fillText('(1,0)',W-3,H-3);
    ctx.textAlign='left';  ctx.textBaseline='top';    ctx.fillText('(0,1)',4,3);
    ctx.textAlign='right'; ctx.textBaseline='top';    ctx.fillText('(1,1)',W-3,3);

    // UV rects
    const parsedUvs = parseUvOptions(uvOptions);
    const opacity   = parseFloat(uvOpacity) || 0;

    parsedUvs.forEach((uv, idx) => {
      const color = UV_COLORS[idx % UV_COLORS.length];
      const cx1 = uv.x*W, cy1 = (1-uv.y-uv.w)*H, cw = uv.z*W, ch = uv.w*H;

      if (opacity > 0) {
        ctx.fillStyle = color + Math.round(opacity*255).toString(16).padStart(2,'0');
        ctx.fillRect(cx1, cy1, cw, ch);
      }
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.strokeRect(cx1, cy1, cw, ch);

      const cx = cx1+cw/2, cy = cy1+ch/2;
      ctx.fillStyle = '#111'; ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx,cy,13,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(idx+1), cx, cy);
    });
  }, [uvOptions, uvOpacity, previewImage, texOpacity]);

  // ── Mouse events — PropTextureEditor pattern ─────────────────
  // getPosRelativeToCanvas: coordinates relative to the inner wrap div (same pixel area as canvas).
  // Do NOT clamp here — raw position is fine, clamping happens in the move handler.
  const getPosRelativeToCanvas = useCallback((clientX, clientY) => {
    const rect = exWrapRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left)  / rect.width,
      y: (clientY - rect.top)   / rect.height,
    };
  }, []);

  // onMouseDown on the outer oversized div — fires even when clicking just outside the canvas edge
  const onMouseDown = useCallback(e => {
    if (!exEnabled) return;
    e.preventDefault();
    const pos = getPosRelativeToCanvas(e.clientX, e.clientY);
    const sx = clamp01(pos.x), sy = clamp01(pos.y);
    exDragStart.current = { x: sx, y: sy };
    exDragging.current  = true;
    exDraft.current = { x0: sx, y0: sy, x1: sx, y1: sy };
    setDraftZone(null);
    setSelectedZoneIdx(null);
    drawExCanvas(exclusionZones, exDraft.current);
  }, [exEnabled, getPosRelativeToCanvas, drawExCanvas, exclusionZones]);

  // mousemove + mouseup on document — so dragging outside the canvas keeps working
  useEffect(() => {
    const onMove = (e) => {
      if (!exDragging.current) return;
      const pos = getPosRelativeToCanvas(e.clientX, e.clientY);
      const x0 = exDragStart.current.x, y0 = exDragStart.current.y;
      const rx = Math.min(x0, pos.x), ry = Math.min(y0, pos.y);
      const rw = Math.abs(pos.x - x0),  rh = Math.abs(pos.y - y0);
      const cx = clamp01(rx),            cy = clamp01(ry);
      const cw = Math.min(rw, 1 - cx),  ch = Math.min(rh, 1 - cy);
      exDraft.current = { x0: cx, y0: cy, x1: cx + cw, y1: cy + ch };
      drawExCanvas(exclusionZones, exDraft.current);
    };
    const onUp = () => {
      if (!exDragging.current) return;
      exDragging.current = false;
      const zone = exDraft.current;
      exDraft.current = null;
      if (zone && (zone.x1 - zone.x0) > 0.01 && (zone.y1 - zone.y0) > 0.01) {
        setDraftZone({ ...zone }); // waiting for user to confirm
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };
  }, [getPosRelativeToCanvas, drawExCanvas, exclusionZones]);

  // ── Build stars ───────────────────────────────────────────────
  const buildStars = useCallback((nStars) => {
    const spread    = parseFloat(clusterSpread)   || 14000;
    const stddev    = parseFloat(clusterStdDev)   || 1800;
    const bgRatio   = parseFloat(backgroundRatio) || 0.45;
    const minScale  = parseFloat(scaleMin)        || 10;
    const maxScale  = parseFloat(scaleMax)        || 30;
    const nClusters = parseInt(numClusters)       || 10;
    const yMaxVal   = parseFloat(yMax)            || 1500;

    const parsedUvs     = parseUvOptions(uvOptions);
    const parsedWeights = parseWeights(uvWeights);
    if (!parsedUvs.length)                         throw new Error('No valid UV options');
    if (parsedWeights.length !== parsedUvs.length)  throw new Error('UV options and weights count mismatch');

    // ── RNG setup ──
    const rng = useSeed ? mulberry32(seed) : Math.random.bind(Math);
    const gauss = std => gaussianRandomSeeded(std, rng);

    // ── Cluster centers (Y also uses the mode) ──
    const sampleY = () => {
      switch (yMode) {
        case 'gaussian': {
          const c = parseFloat(yCenter) || 750;
          const s = parseFloat(yStdDev) || 300;
          return Math.max(0, Math.min(yMaxVal, c + gauss(s)));
        }
        case 'layered': {
          const layers = parseLayeredText(yLayers);
          if (!layers.length) return rng() * yMaxVal;
          const totalW = layers.reduce((a, l) => a + l.weight, 0);
          let r = rng() * totalW;
          for (const l of layers) { r -= l.weight; if (r <= 0) return Math.max(0, Math.min(yMaxVal, l.center + gauss(l.stddev))); }
          const last = layers[layers.length - 1];
          return Math.max(0, Math.min(yMaxVal, last.center + gauss(last.stddev)));
        }
        case 'disk_halo': {
          const dc = parseFloat(diskCenter) || 100;
          const ds = parseFloat(diskStdDev) || 120;
          const hs = parseFloat(haloStdDev) || 800;
          const hr = parseFloat(haloRatio)  || 0.15;
          if (rng() < hr) return Math.max(0, Math.min(yMaxVal, dc + gauss(hs)));
          return Math.max(0, Math.min(yMaxVal, dc + gauss(ds)));
        }
        case 'curve':
          return sampleFromCurve(curvePoints, yMaxVal, rng);
        default: // flat
          return rng() * yMaxVal;
      }
    };

    const centers = Array.from({ length: nClusters }, () => ({
      x: (rng()*2-1)*spread,
      y: sampleY(),
      z: (rng()*2-1)*spread,
    }));

    const activeZones = exEnabled ? exclusionZones : [];
    const stars = [];
    let attempts = 0;

    // weightedPick with our rng
    const pick = (weights) => {
      const total = weights.reduce((a, b) => a + b, 0);
      let r = rng() * total;
      for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
      return weights.length - 1;
    };

    while (stars.length < nStars && attempts < nStars * 50) {
      attempts++;
      let x, y, z, isCluster;
      if (rng() < bgRatio) {
        x = (rng()*2-1)*spread; y = sampleY(); z = (rng()*2-1)*spread;
        isCluster = false;
      } else {
        const c = centers[Math.floor(rng()*centers.length)];
        x = c.x + gauss(stddev);
        y = Math.max(0, Math.min(yMaxVal, c.y + (rng()-0.5) * (parseFloat(yClusterScatter) || 200)));
        z = c.z + gauss(stddev);
        isCluster = true;
      }
      if (activeZones.some(zone => inExclusionZone(x, z, zone, spread))) continue;

      const uvIndex    = pick(parsedWeights);
      const uv         = parsedUvs[uvIndex];
      const dist       = Math.sqrt(x*x+z*z)/spread;
      const scale      = (minScale + rng()*(maxScale-minScale)) * (1 - dist*0.25);
      const brightness = isCluster ? 0.6+rng()*0.4 : 0.3+rng()*0.4;
      const rotation   = rng() * Math.PI * 2;
      stars.push({ x, y, z, scale, brightness, uvIndex, uv, rotation, color: UV_COLORS[uvIndex % UV_COLORS.length] });
    }
    return stars;
  }, [numStars, numClusters, clusterSpread, clusterStdDev, backgroundRatio,
      scaleMin, scaleMax, uvOptions, uvWeights, exclusionZones, exEnabled,
      seed, useSeed, yMode, yMax, yCenter, yStdDev, yLayers,
      diskCenter, diskStdDev, haloStdDev, haloRatio, curvePoints, yClusterScatter]);

  // ── Build planet-Lua entries from generated stars ─────────────
  const buildPlanetLua = useCallback((stars) => {
    return stars.map(star =>
      `        {\n` +
      `            position = { ${star.x.toFixed(3)}, ${star.y.toFixed(3)}, ${star.z.toFixed(3)}, },\n` +
      `            rotation = ${star.rotation.toFixed(4)},\n` +
      `            scale = { ${star.scale.toFixed(2)}, ${star.scale.toFixed(2)}, },\n` +
      `            uv = { ${star.uv.x}, ${star.uv.y}, ${star.uv.z}, ${star.uv.w}, },\n` +
      `        },\n`
    ).join('');
  }, []);

  // ── Export planets JSON (raw, no SCMAP) ───────────────────────
  const handleExportJson = useCallback(async () => {
    const mapNameTrimmed = mapName.trim();
    const mapsFolder     = (settings?.mapsFolder || '').trim();

    if (!mapNameTrimmed) { await luxuryAlert('Please set a Map Name before exporting.', 'Map Name Required', 'warning'); return; }
    if (!mapsFolder)     { await luxuryAlert('Please configure the Maps Folder in Settings before continuing.', 'Maps Folder Not Set', 'warning'); return; }

    const finalName     = /\.v\d{4}$/.test(mapNameTrimmed) ? mapNameTrimmed : mapNameTrimmed + '.v0001';
    const mapFolderPath = `${mapsFolder}\\${finalName}`;

    try {
      const n     = parseInt(numStars) || 50;
      const stars = buildStars(n);

      const planetsArray = stars.map(star => ({
        Position: { x: parseFloat(star.x.toFixed(3)), y: parseFloat(star.y.toFixed(3)), z: parseFloat(star.z.toFixed(3)) },
        Rotation: parseFloat(star.rotation.toFixed(4)),
        Scale:    { x: parseFloat(star.scale.toFixed(2)), y: parseFloat(star.scale.toFixed(2)) },
        Uv:       { x: star.uv.x, y: star.uv.y, z: star.uv.z, w: star.uv.w },
      }));

      const jsonContent = `"Planets": ${JSON.stringify(planetsArray, null, 4)}`;

      const dirEntries = await window.electronAPI.invoke('list-dir', { dirPath: mapFolderPath });
      let maxIdx = 0, hasSingle = false;
      for (const e of (dirEntries?.entries || [])) {
        if (e.name === 'stars_planets.json') hasSingle = true;
        const m = e.name.match(/^stars_planets(\d+)\.json$/);
        if (m) maxIdx = Math.max(maxIdx, parseInt(m[1]));
      }
      const fileName = maxIdx > 0 ? `stars_planets${maxIdx + 1}.json`
                     : hasSingle  ? `stars_planets1.json`
                     : `stars_planets.json`;

      const writeRes = await window.electronAPI.invoke('write-file', {
        filePath: `${mapFolderPath}\\${fileName}`,
        content:  jsonContent,
      });
      if (!writeRes?.success) throw new Error(`Could not write file: ${writeRes?.error}`);

      await luxuryAlert(`✓ ${stars.length} stars exported to ${fileName}`, 'JSON Exported', 'success');
    } catch (e) {
      console.error('[Stars export JSON]', e);
      await luxuryAlert(e.message, 'Export Failed', 'error');
    }
  }, [buildStars, numStars, mapName, settings]);

  // ── Inject stars as planets directly into data.lua ────────────
  const handleInjectStars = useCallback(async () => {
    const mapNameTrimmed = mapName.trim();
    const mapsFolder     = (settings?.mapsFolder || '').trim();

    if (!mapNameTrimmed) { await luxuryAlert('Please set a Map Name before generating stars.', 'Map Name Required', 'warning'); return; }
    if (!mapsFolder)     { await luxuryAlert('Please configure the Maps Folder in Settings before continuing.', 'Maps Folder Not Set', 'warning'); return; }

    const finalName     = /\.v\d{4}$/.test(mapNameTrimmed) ? mapNameTrimmed : mapNameTrimmed + '.v0001';
    const mapFolderPath = `${mapsFolder}\\${finalName}`;

    try {
      // ── 1. .scmap finden ────────────────────────────────────────
      const dirEntries = await window.electronAPI.invoke('list-dir', { dirPath: mapFolderPath });
      if (!dirEntries?.success) throw new Error('Could not read map folder.');
      const scmapEntry = dirEntries.entries.find(e => !e.isDirectory && e.name.toLowerCase().endsWith('.scmap'));
      if (!scmapEntry) throw new Error(`No .scmap file found in ${mapFolderPath} `);
      const scmapPath = `${mapFolderPath}\\${scmapEntry.name}`;

      // ── 2. Entpacken ─────────────────────────────────────────────
      const unpackRes = await window.electronAPI.invoke('scmap-unpack', { scmapPath });
      if (!unpackRes.success) throw new Error(`Unpack failed: ${unpackRes.error}`);
      const unpackedFolder = unpackRes.outputFolder;

      // ── HISTORY: snapshot BEFORE ─────────────────────────────────────────
      const snapBeforeRes = await window.electronAPI.invoke('scmap-snapshot-folder', { folderPath: unpackedFolder });
      const snapBefore = snapBeforeRes?.snapshot ?? null;

      // ── 3. data.lua lesen ────────────────────────────────────────
      const dataLuaPath = `${unpackedFolder}\\data.lua`;
      const readRes = await window.electronAPI.invoke('read-file', { path: dataLuaPath });
      if (!readRes?.success) throw new Error(`Could not read data.lua: ${readRes?.error}`);

      // ── 4. Generate stars → Lua strings ────────────────────────
      const n     = parseInt(numStars) || 50;
      const stars = buildStars(n);
      const newPlanetLua = buildPlanetLua(stars);

      // ── 5. Append into planets = { ... } inside skyBox ────────
      // Regex: findet planets = { ... } innerhalb der skyBox-Sektion.
      // Strategy: insert new entries before the last closing "        }," of the planets block.
      let dataLua = readRes.content;

      // Findet den planets-Block innerhalb von skyBox = { ... }
      // Greedy-match everything between "planets = {" and its closing "},",
      const planetsRegex = /(skyBox\s*=\s*\{[\s\S]*?planets\s*=\s*\{)([\s\S]*?)(\n        \},)/;
      if (!planetsRegex.test(dataLua)) throw new Error('planets-Sektion in skyBox nicht ');

      dataLua = dataLua.replace(planetsRegex, (_, open, existing, close) => {
        return `${open}${existing}${newPlanetLua}${close}`;
      });

      // ── version auf 60 setzen falls nicht bereits 60 ────────────
      dataLua = dataLua.replace(/(\bversion\s*=\s*)(\d+)(\s*,)/, (m, pre, num, post) => {
        return parseInt(num, 10) !== 60 ? `${pre}60${post}` : m;
      });

      // ── 6. Write back data.lua ──────────────────────────────────
      const writeRes = await window.electronAPI.invoke('write-file', { filePath: dataLuaPath, content: dataLua });
      if (!writeRes?.success) throw new Error(`Could not write data.lua: ${writeRes?.error}`);

      // ── HISTORY: snapshot AFTER ─────────────────────────────────────────
      const snapAfterRes = await window.electronAPI.invoke('scmap-snapshot-folder', { folderPath: unpackedFolder });
      const snapAfter = snapAfterRes?.snapshot ?? null;
      if (snapBefore && snapAfter) onRecordSnapshot('stars', finalName, snapBefore, snapAfter);

      // ── 7. Repack ────────────────────────────────────────────────
      const mapNameForPack = unpackedFolder.split(/[\\/]/).pop();
      const packRes = await window.electronAPI.invoke('scmap-pack', { mapName: mapNameForPack });
      if (!packRes.success) throw new Error(`Pack failed: ${packRes.error}`);

      // ── 8. Copy .scmap back ─────────────────────────────────────
      const copyRes = await window.electronAPI.invoke('copy-file', { src: packRes.outputPath, dest: scmapPath });
      if (!copyRes?.success) throw new Error('Could not copy repacked .scmap back.');

      // ── Auto-open ────────────────────────────────────────────────
      const currentSettings = await window.electronAPI.invoke('settings-load');
      if (currentSettings?.autoOpenExportFolder) {
        await window.electronAPI.invoke('open-folder', { folderPath: mapFolderPath });
      }

      if (generateReadme) {
        const ms_rm    = parseFloat(settings?.mapSize) || 1024;
        const km_rm    = ms_rm * (20 / 1024);
        const kmStr_rm = Number.isInteger(km_rm) ? `${km_rm}×${km_rm}` : `${km_rm.toFixed(1)}×${km_rm.toFixed(1)}`;

        const starLines = stars.slice(0, 5).map((s, i) =>
          `  [${String(i + 1).padStart(2, '0')}] pos(${s.x?.toFixed(2)}, ${s.y?.toFixed(2)}, ${s.z?.toFixed(2)})  scale(${s.scaleX?.toFixed(2)}, ${s.scaleY?.toFixed(2)})`
        );
        if (stars.length > 5) starLines.push(`  ... and ${stars.length - 5} more`);

        const readmeContent = buildReadme({
          tool:    'Stars Tab',
          mapName: finalName,
          mapSize: `${ms_rm} × ${ms_rm} (${kmStr_rm} km)`,
          sections: [
            { title: 'OUTPUT SUMMARY', entries: [
              ['Stars injected', stars.length],
              ['SCMAP File',     `${scmapEntry.name}  ← repacked`],
            ]},
            { title: 'STAR PREVIEW (first 5)', lines: starLines },
          ],
        });
        await writeReadme(`${mapFolderPath}\\Stars_Generation_README.txt`, readmeContent);
      }

      await luxuryAlert(`Successfully injected ${stars.length} stars into ${scmapEntry.name}.${generateReadme ? '\n✓ README written to map folder' : ''}`, 'Stars Injected', 'success');
    } catch (e) {
      console.error('[Stars inject]', e);
      await luxuryAlert(e.message, 'Star Inject Failed', 'error');
    }
  }, [buildStars, buildPlanetLua, numStars, mapName]);

  const resetDefaults = () => {
    setNumStars(DEFAULTS.numStars); setNumClusters(DEFAULTS.numClusters);
    setClusterSpread(DEFAULTS.clusterSpread); setClusterStdDev(DEFAULTS.clusterStdDev);
    setBackgroundRatio(DEFAULTS.backgroundRatio); setScaleMin(DEFAULTS.scaleMin);
    setScaleMax(DEFAULTS.scaleMax); setUvOpacity(DEFAULTS.uvOpacity);
    syncUvRows(DEFAULT_UV_ROWS);
  };

  const handleImageUpload = async e => {
    const file = e.target.files[0];
    if (!file) return;
    const isDds = file.name.toLowerCase().endsWith('.dds');
    if (isDds) {
      try {
        const filePath = webUtils.getPathForFile(file);
        const result = await window.electronAPI.invoke('dds-to-dataurl', { filePath });
        if (!result?.success) { await luxuryAlert('Failed to load DDS file: ' + (result?.error || 'Unknown error'), 'DDS Load Failed', 'error'); return; }
        const img = new Image();
        img.onload = () => { setPreviewImage(img); setPreviewImageData(result.dataUrl); };
        img.src = result.dataUrl;
      } catch (err) {
        await luxuryAlert('DDS support requires Electron: ' + err.message, 'Electron Required', 'error');
      }
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => { setPreviewImage(img); setPreviewImageData(ev.target.result); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const exclusionZoneInfo = (zone) => {
    if (!zone) return null;
    const spread = parseFloat(clusterSpread) || 14000;
    const toW = v => ((v*2-1)*spread).toFixed(0);
    return (
      `X ${toW(Math.min(zone.x0,zone.x1))} → ${toW(Math.max(zone.x0,zone.x1))}` +
      `   Z ${toW(Math.min(zone.y0,zone.y1))} → ${toW(Math.max(zone.y0,zone.y1))}`
    );
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="st-tab stars-tab tab-scrollbar">
      <div className="tab-grid">

        {/* ══ LEFT — Configuration (merged) + UV inputs ══ */}
        <div className="tab-col-config">

          {/* ── CONFIGURATION (merged card) ── */}
          <div className="section-card">
            <div className="st-card-header">
            <h2 className="section-title">
              CONFIGURATION
            </h2>
              <button className="btn-ghost" onClick={resetDefaults}>Reset</button>
            </div>

            {/* ── Map Context subtitle ── */}
            <div className="subsection-title">Map Details</div>
            <Field label="Map Name">
              <input className="form-input" value={mapName}
                onChange={e => setMapName(e.target.value)}
                placeholder="e.g. Hades_Dust.v0002"/>
            </Field>

            <hr className="st-subsection-divider"/>

            {/* ── Star Configuration subtitle ── */}
            <div className="subsection-title">Star Configuration</div>
            <div className="st-config-grid">
              <Field label="Stars">
                <input className="form-input" value={numStars} onChange={e=>setNumStars(e.target.value)} placeholder="50"/>
              </Field>
              <Field label="Clusters">
                <input className="form-input" value={numClusters} onChange={e=>setNumClusters(e.target.value)} placeholder="10"/>
              </Field>
              <Field label="Cluster Spread">
                <input className="form-input" value={clusterSpread} onChange={e=>setClusterSpread(e.target.value)} placeholder="14000"/>
              </Field>
              <Field label="Cluster Std Dev">
                <input className="form-input" value={clusterStdDev} onChange={e=>setClusterStdDev(e.target.value)} placeholder="1800"/>
              </Field>
              <Field label="Background Ratio">
                <input className="form-input" value={backgroundRatio} onChange={e=>setBackgroundRatio(e.target.value)} placeholder="0.45"/>
              </Field>
              <Field label="Scale Min / Max">
                <div className="st-split-input">
                  <input className="form-input" value={scaleMin} onChange={e=>setScaleMin(e.target.value)} placeholder="10"/>
                  <input className="form-input" value={scaleMax} onChange={e=>setScaleMax(e.target.value)} placeholder="30"/>
                </div>
              </Field>
            </div>

            {/* ── Y-Distribution (inside Star Configuration) ── */}
            <div style={{marginTop: '18px'}}>
              <div className="subsection-title" style={{marginBottom:'14px'}}>Y-Distribution</div>
              <Field label="Mode">
                <StyledSelect
                  value={yMode}
                  onChange={setYMode}
                  options={Y_MODES}
                />
              </Field>

              <Field label="Cluster Y Scatter">
                <input className="form-input" value={yClusterScatter}
                  onChange={e => setYClusterScatter(e.target.value)} placeholder="200"/>
              </Field>

              {yMode === 'flat' && (
                <Field label="Max Height">
                  <input className="form-input" value={yMax}
                    onChange={e => setYMax(e.target.value)} placeholder="1500"/>
                </Field>
              )}

              {yMode === 'gaussian' && (
                <div className="st-config-grid">
                  <Field label="Center">
                    <input className="form-input" value={yCenter}
                      onChange={e => setYCenter(e.target.value)} placeholder="750"/>
                  </Field>
                  <Field label="Std Dev">
                    <input className="form-input" value={yStdDev}
                      onChange={e => setYStdDev(e.target.value)} placeholder="300"/>
                  </Field>
                  <Field label="Max Height">
                    <input className="form-input" value={yMax}
                      onChange={e => setYMax(e.target.value)} placeholder="1500"/>
                  </Field>
                </div>
              )}

              {yMode === 'layered' && (
                <>
                  <Field label="Layers — center, stddev, weight (one per line)">
                    <textarea className="form-input st-textarea" rows={4}
                      value={yLayers} onChange={e => setYLayers(e.target.value)}/>
                  </Field>
                  <Field label="Max Height">
                    <input className="form-input" value={yMax}
                      onChange={e => setYMax(e.target.value)} placeholder="1500"/>
                  </Field>
                </>
              )}

              {yMode === 'disk_halo' && (
                <>
                  <div className="st-config-grid">
                    <Field label="Disk Center">
                      <input className="form-input" value={diskCenter}
                        onChange={e => setDiskCenter(e.target.value)} placeholder="100"/>
                    </Field>
                    <Field label="Disk Std Dev">
                      <input className="form-input" value={diskStdDev}
                        onChange={e => setDiskStdDev(e.target.value)} placeholder="120"/>
                    </Field>
                    <Field label="Halo Std Dev">
                      <input className="form-input" value={haloStdDev}
                        onChange={e => setHaloStdDev(e.target.value)} placeholder="800"/>
                    </Field>
                    <Field label="Halo Ratio">
                      <input className="form-input" value={haloRatio}
                        onChange={e => setHaloRatio(e.target.value)} placeholder="0.15"/>
                    </Field>
                    <Field label="Max Height">
                      <input className="form-input" value={yMax}
                        onChange={e => setYMax(e.target.value)} placeholder="1500"/>
                    </Field>
                  </div>
                </>
              )}

              {yMode === 'curve' && (
                <>
                  <div style={{ display:'flex', justifyContent:'center' }}>
                    <div style={{ width:'72%' }}>
                      <YCurveEditor
                        points={curvePoints}
                        onChange={setCurvePoints}
                        yMax={parseFloat(yMax) || 1500}
                      />
                    </div>
                  </div>
                  <Field label="Max Height" style={{marginTop:10}}>
                    <input className="form-input" value={yMax}
                      onChange={e => setYMax(e.target.value)} placeholder="1500"/>
                  </Field>
                  <button className="btn-ghost" style={{marginTop:6}}
                    onClick={() => setCurvePoints([
                      { x: 0.05, y: 0.0 }, { x: 1.0, y: 0.15 }, { x: 0.3, y: 0.5 }, { x: 0.05, y: 1.0 },
                    ])}>Reset curve
                  </button>
                </>
              )}
            </div>

            <hr className="st-subsection-divider"/>

            {/* ── Seed Control subtitle ── */}
            <div className="subsection-title">Seed Control</div>
            <div style={{display:'flex', justifyContent:'flex-end', marginBottom:'10px'}}>
              <Toggle checked={useSeed} onChange={e => setUseSeed(e.target.checked)}
                label={useSeed ? 'Fixed' : 'Random'} />
            </div>
            <div className="st-seed-row">
              <input
                className="form-input"
                type="number" min="1" max="999999"
                value={seed}
                disabled={!useSeed}
                onChange={e => setSeed(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                style={{ opacity: useSeed ? 1 : 0.4 }}
              />
              <button className="btn-ghost" onClick={randomizeSeed}
                title="Pick a random seed">Randomize
              </button>
            </div>
          </div>

          {/* UV Texture inputs */}
          <div className="section-card">
            <div className="st-card-header">
              <h2 className="section-title">
                UV TEXTURE
              </h2>
              <div style={{display:'flex', gap:'8px'}}>
                <button className="btn-ghost" onClick={() => syncUvRows(DEFAULT_UV_ROWS)}>Reset</button>
                <button className="btn-ghost" onClick={() => syncUvRows([...uvRows, { x:'0.0', y:'0.0', z:'0.5', w:'0.5', weight:'0.25' }])}>
                  + Add
                </button>
              </div>
            </div>

            {/* Header row */}
            <div className="st-uv-table-header">
              <div className="st-uv-col-color"/>
              <div className="st-uv-col-field">X</div>
              <div className="st-uv-col-field">Y</div>
              <div className="st-uv-col-field">Z</div>
              <div className="st-uv-col-field">W</div>
              <div className="st-uv-col-weight">Weight</div>
              <div className="st-uv-col-del"/>
            </div>

            {uvRows.map((row, i) => {
              const color = UV_COLORS[i % UV_COLORS.length];
              const update = (field, val) => {
                const next = uvRows.map((r, j) => j === i ? { ...r, [field]: val } : r);
                syncUvRows(next);
              };
              return (
                <div className="st-uv-table-row" key={i}>
                  <div className="st-uv-col-color">
                    <div className="st-uv-legend-dot" style={{ background: color, border: `1.5px solid ${color}` }}/>
                  </div>
                  {['x','y','z','w'].map(f => (
                    <div className="st-uv-col-field" key={f}>
                      <input className="form-input st-uv-cell-input"
                        value={row[f]}
                        onChange={e => update(f, e.target.value)}
                        placeholder="0.0"/>
                    </div>
                  ))}
                  <div className="st-uv-col-weight">
                    <input className="form-input st-uv-cell-input"
                      value={row.weight}
                      onChange={e => update('weight', e.target.value)}
                      placeholder="0.25"/>
                  </div>
                  <div className="st-uv-col-del">
                    {uvRows.length > 1 && (
                      <button className="btn-delete st-uv-del-btn"
                        onClick={() => syncUvRows(uvRows.filter((_, j) => j !== i))}
                        title="Remove">✕</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="section-card">
          <label className="checkbox-label" style={{ marginBottom: '12px' }} onClick={() => { setExportRawJson(v => !v); onSharedChange('st_exportRawJson', !exportRawJson); }}>
            <div className={`checkbox${exportRawJson ? ' checked' : ''}`}>
              {exportRawJson && (
                <svg className="checkbox-check" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span className="checkbox-text">Export planets JSON (no SCMAP)</span>
          </label>

          {!exportRawJson && (
            <label className="checkbox-label" style={{ marginBottom: '20px', cursor: 'pointer' }} onClick={() => { const v = !generateReadme; setGenerateReadme(v); onSharedChange('st_generateReadme', v); }}>
              <div className={`checkbox${generateReadme ? ' checked' : ''}`}>
                {generateReadme && (
                  <svg className="checkbox-check" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="checkbox-text">Generate README file</span>
            </label>
          )}

          <button className="btn-primary btn-lg" onClick={exportRawJson ? handleExportJson : handleInjectStars}>
            {exportRawJson ? 'Export Planets JSON' : 'Generate Stars'}
          </button>
          </div>
        </div>

        {/* ══ RIGHT — Exclusion zone + UV visualisation ══ */}
        <div className="tab-col-detail">

          {/* Exclusion Zone */}
          <div className="section-card">
            <div className="st-card-header">
              <h2 className="section-title">
                EXCLUSION ZONES
              </h2>
              <div className="st-ex-header-actions">
                <Toggle checked={exEnabled} onChange={e=>setExEnabled(e.target.checked)}
                  label={exEnabled ? 'Enabled' : 'Disabled'}/>
                {exclusionZones.length > 0 && (
                  <button className="btn-delete" onClick={() => {
                    setExclusionZones([]);
                    setDraftZone(null);
                    setSelectedZoneIdx(null);
                  }}>Clear All</button>
                )}
              </div>
            </div>

            {/* Zone list — PTE tab-bar pattern */}
            {exclusionZones.length > 0 && (
              <div className="st-ex-zone-list">
                {exclusionZones.map((zone, i) => (
                  <div key={i}
                    className={`st-ex-zone-item${selectedZoneIdx === i ? ' active' : ''}`}
                    onClick={() => setSelectedZoneIdx(selectedZoneIdx === i ? null : i)}>
                    <span className="st-ex-zone-label">Zone {i + 1}</span>
                    {selectedZoneIdx === i && (
                      <code className="st-ex-zone-coords">{exclusionZoneInfo(zone)}</code>
                    )}
                    <button className="st-ex-zone-delete" onClick={e => {
                      e.stopPropagation();
                      setExclusionZones(prev => prev.filter((_, j) => j !== i));
                      setSelectedZoneIdx(prev => prev === i ? null : prev > i ? prev - 1 : prev);
                    }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Draft confirm banner */}
            {draftZone && (
              <div className="st-ex-confirm-bar">
                <span className="st-ex-confirm-label">
                  New zone drawn — confirm to add it.
                </span>
                <div className="st-ex-confirm-actions">
                  <button className="st-ex-btn-confirm"
                    onClick={() => {
                      const newZones = [...exclusionZones, draftZone];
                      setExclusionZones(newZones);
                      setSelectedZoneIdx(newZones.length - 1);
                      setDraftZone(null);
                    }}>Confirm</button>
                  <button className="st-ex-btn-discard"
                    onClick={() => { setDraftZone(null); drawExCanvas(exclusionZones, null); }}>
                    Discard
                  </button>
                </div>
              </div>
            )}

            {/*
              Outer div with negative margin = oversized drag zone (PTE pattern).
              mousemove + mouseup on document handle drags that leave the canvas.
              onMouseDown here so clicks just outside the canvas edge still start a drag.
              exWrapRef on the inner div — used for coordinate calculation only.
            */}
            <div
              style={{ margin: '-24px', padding: '24px',
                cursor: exEnabled ? 'crosshair' : 'default' }}
              onMouseDown={onMouseDown}>
              <div className="st-ex-wrap">
                <div ref={exWrapRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  <canvas ref={exCanvasRef} width={EX_RES} height={EX_RES}
                    className="st-ex-canvas"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* UV Visualisation */}
          <div className="section-card">
            <div className="st-card-header" style={{marginBottom:'14px'}}>
              <h2 className="section-title">
              UV VISUALIZATION
              </h2>
              {previewImageData && (
                <button className="btn-delete"
                  onClick={()=>{ setPreviewImage(null); setPreviewImageData(null); }}>Remove
                </button>
              )}
            </div>

            {/* Upload */}
            <div className="st-upload-area" onClick={()=>fileInputRef.current?.click()}>
              <span className="st-upload-icon"></span>
              <span>{previewImageData ? 'Replace texture preview' : 'Upload texture preview'}</span>
              <input ref={fileInputRef} type="file" style={{display:'none'}}
                accept="image/*,.dds" onChange={handleImageUpload}/>
            </div>

            {/* Texture opacity — slider 0–1 + number input for >1 */}
            {previewImageData && (
              <Field label="Texture Opacity" style={{marginTop:'14px', marginBottom:'6px'}}>
                <div className="st-opacity-row">
                  <input type="range" min="0" max="1" step="0.01"
                    className="st-range-slider"
                    value={Math.min(parseFloat(texOpacity) || 0, 1)}
                    onChange={e => setTexOpacity(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}/>
                  <input type="number" min="0" step="0.01"
                    className="form-input st-opacity-input"
                    value={texOpacity}
                    onChange={e => setTexOpacity(e.target.value)}/>
                </div>
              </Field>
            )}

            {/* UV overlay opacity */}
            <Field label="UV Overlay Opacity" style={{marginBottom:'14px'}}>
              <div className="st-opacity-row">
                <input type="range" min="0" max="1" step="0.01"
                  className="st-range-slider"
                  value={Math.min(parseFloat(uvOpacity) || 0, 1)}
                  onChange={e => setUvOpacity(e.target.value)}/>
                <input type="number" min="0" step="0.01"
                  className="form-input st-opacity-input"
                  value={uvOpacity}
                  onChange={e => setUvOpacity(e.target.value)}/>
              </div>
            </Field>

            <canvas ref={uvCanvasRef} width={UV_RES} height={UV_RES}
              className="st-uv-canvas"/>
          </div>

        </div>
      </div>

      {/* ── Help Button ── */}
      <button className="help-btn" onClick={() => setShowHelp(true)} title="Help Guide">?</button>

      {/* ── Help Modal ── */}
      {showHelp && (
        <StarsHelpModal
          onClose={() => setShowHelp(false)}
          activeHelpTab={activeHelpTab}
          setActiveHelpTab={setActiveHelpTab}
          helpSelected={helpSelected}
          setHelpSelected={setHelpSelected}
          activeAdvSubTab={activeAdvSubTab}
          setActiveAdvSubTab={setActiveAdvSubTab}
          setExclusionZones={setExclusionZones}
        />
      )}

    </div>
  );
};

export default StarsTab;