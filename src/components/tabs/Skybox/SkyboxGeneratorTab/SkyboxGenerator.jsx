import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../../../shared/shared.css';
import './SkyboxGenerator.css';
import ReactDOM from 'react-dom';
import SkyboxLibraryOverlay, { fetchSkyboxLibrary } from '../../Libraries/SkyboxLibrary/SkyboxLibraryOverlay';
import { luxuryAlert, luxuryConfirm } from '../../../modals/notifications.js';
import { generateReadme as buildReadme, writeReadme } from '../../../../../utils/readmeGenerator';
import SkyboxGeneratorHelpModal from '../../HelpModals/SkyboxGenerator_help.jsx';
// @uiw/react-color-sketch replaced with custom glassmorphic picker

const ASSETS_RAW = 'https://raw.githubusercontent.com/timmasalme/ForgeMapToolkit-Assets/main';

/* =====================================================
   SKYBOX GENERATOR TAB
   ===================================================== */

const PLANET_UV_COLORS = ['#ff4444','#44ff44','#4444ff','#ffff44','#ff44ff','#44ffff','#ff8844','#88ff44'];


// ── Constants ─────────────────────────────────────────────────
const UV_COLORS = [
  '#3b76ff','#22d3ee','#34d399','#f59e0b',
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

    // Background — deep dark with vignette
    ctx.fillStyle = '#03040b';
    ctx.fillRect(0, 0, W, H);
    const vigGrad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W * 0.75);
    vigGrad.addColorStop(0,   'rgba(8,16,36,0)');
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
    // Major grid — blue tint
    ctx.strokeStyle = 'rgba(59,118,255,0.09)';
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

    // Border — blue glow
    ctx.strokeStyle = 'rgba(59,118,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W-1, H-1);

    if (!points || points.length < 1) {
      ctx.fillStyle = 'rgba(59,118,255,0.3)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '11px monospace';
      ctx.fillText('Click to add control points', W/2, H/2);
      return;
    }

    const sortedByHeight = [...points].sort((a, b) => a.y - b.y);
    const cvByHeight = sortedByHeight.map(ptToCv);

    if (points.length >= 2) {
      // ── Horizontal spread lines ──
      cvByHeight.forEach(({ cx, cy }) => {
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(cx, cy);
        ctx.strokeStyle = 'rgba(59,118,255,0.07)';
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
      areaGrad.addColorStop(0, 'rgba(59,118,255,0.03)');
      areaGrad.addColorStop(1, 'rgba(80,150,255,0.22)');
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
      ctx.strokeStyle = 'rgba(59,118,255,0.22)';
      ctx.lineWidth = 14;
      ctx.stroke();
      linePath();
      ctx.strokeStyle = 'rgba(80,140,255,0.5)';
      ctx.lineWidth = 5;
      ctx.stroke();
      linePath();
      ctx.strokeStyle = 'rgba(140,190,255,0.95)';
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
        const haloR = r + (isDrag ? 11 : 7);
        const halo  = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
        halo.addColorStop(0, isDrag ? 'rgba(60,120,220,0.22)' : 'rgba(59,118,255,0.14)');
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = isDrag ? 'rgba(30,40,65,0.92)' : isHov ? 'rgba(20,30,55,0.88)' : 'rgba(12,18,35,0.82)';
      ctx.fill();
      ctx.strokeStyle = `rgba(80,140,255,${isDrag ? 0.95 : isHov ? 0.75 : 0.45})`;
      ctx.lineWidth   = isDrag ? 1.5 : 1;
      ctx.stroke();
      // glass sheen
      ctx.beginPath();
      ctx.arc(cx, cy, r - 1, Math.PI * 1.15, Math.PI * 1.75);
      ctx.strokeStyle = isDrag ? 'rgba(255,255,255,0.55)' : isHov ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.18)';
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
        ctx.fillStyle = 'rgba(8,12,28,0.92)';
        ctx.beginPath();
        ctx.roundRect?.(px2, py2, pw, ph, 3) ?? ctx.rect(px2, py2, pw, ph);
        ctx.fill();
        ctx.strokeStyle = 'rgba(80,140,255,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect?.(px2, py2, pw, ph, 3) ?? ctx.rect(px2, py2, pw, ph);
        ctx.stroke();
        ctx.fillStyle = 'rgba(160,200,255,0.95)';
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

  const ptCount  = points?.length ?? 0;
  const yMaxLabel = yMax >= 1000 ? `${(yMax/1000).toFixed(1)}k` : String(yMax);

  return (
    <div className="sb-st-curve-wrap" ref={wrapRef}>
      {/* ── Header strip ── */}
      <div className="sb-st-curve-header">
        <span className="sb-st-curve-header-label">Y-Distribution Curve</span>
        <div className="sb-st-curve-header-stats">
          <span className="sb-st-curve-stat">pts <span className="sb-st-curve-stat-val">{ptCount}</span></span>
          <span className="sb-st-curve-stat">yMax <span className="sb-st-curve-stat-val">{yMaxLabel}</span></span>
        </div>
      </div>

      {/* ── Canvas ── */}
      <canvas
        ref={canvasRef}
        width={CW} height={CH}
        className="sb-st-curve-canvas"
        style={{ cursor: cursorStyle }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onContextMenu={e => e.preventDefault()}
      />

      {/* ── Hint footer ── */}
      <div className="sb-st-curve-hint">
        {isHoveringPoint ? (
          <>
            <span className="sb-st-curve-hint-active">Drag</span>
            <span className="sb-st-curve-hint-sep">to move</span>
            <span className="sb-st-curve-hint-dot"/>
            <span className="sb-st-curve-hint-active">Right-click</span>
            <span className="sb-st-curve-hint-sep">to remove</span>
          </>
        ) : (
          <>
            <span className="sb-st-curve-hint-sep">Click canvas</span>
            <span className="sb-st-curve-hint-dot"/>
            <span className="sb-st-curve-hint-sep">to add a control point</span>
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
    <label className="sb-st-toggle-label">
      <input type="checkbox" className="sb-st-toggle-input" checked={checked} onChange={onChange}/>
      <span className="sb-st-toggle-track"><span className="sb-st-toggle-thumb"/></span>
      {label && <span className="sb-st-toggle-text">{label}</span>}
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
    <div className="sb-st-styled-select" ref={ref}>
      <button
        type="button"
        className={`sb-st-styled-select-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <span>{selected?.label ?? value}</span>
        <svg className="sb-st-styled-select-arrow" width="10" height="6" viewBox="0 0 10 6">
          <path d="M0 0L5 6L10 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="sb-st-styled-select-dropdown">
          {options.map(o => (
            <div
              key={o.value}
              className={`sb-st-styled-select-option${o.value === value ? ' selected' : ''}`}
              onMouseDown={() => { onChange(o.value); setOpen(false); }}
            >
              {o.value === value && <span className="sb-st-styled-select-tick">✓</span>}
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════


const defaultPlanet = () => ({
  id: Date.now() + Math.random(),
  x: 2190.0, y: 570.0, z: -1020.0,
  rotation: -1.585,
  scaleX: 183.0, scaleY: 183.0,
  uvX: 0.0, uvY: 0.5, uvZ: 0.5, uvW: 0.5
});

const defaultCirrusLayer = () => ({
  id: Date.now() + Math.random(),
  freqX: 0.0001, freqY: 0.0001,
  speed: 7.8,
  dirX: 0.432, dirY: -0.902
});

// ── Cirrus Presets ─────────────────────────────────────────────────────────────
const CIRRUS_BUILTIN_PRESETS = [
  {
    id: 'heavy-overcast',
    label: 'Heavy Overcast',
    texture: '/textures/environment/cirrus000.dds',
    layers: [
      { freqX:'0.0001',   freqY:'0.0001',   speed:'3.5',  dirX:'0.432',   dirY:'-0.902' },
      { freqX:'0.001011', freqY:'0.003189',  speed:'1.28', dirX:'1.0',     dirY:'0.0'   },
      { freqX:'0.000645', freqY:'0.001011',  speed:'0.0',  dirX:'0.95',    dirY:'0.312' },
      { freqX:'0.003367', freqY:'0.005911',  speed:'0.55', dirX:'0.9996',  dirY:'0.03'  },
    ],
  },
  {
    id: 'layered-drift',
    label: 'Layered Drift',
    texture: '/textures/environment/cirrus001_512.dds',
    layers: [
      { freqX:'0.00025', freqY:'0.00025', speed:'1.5',  dirX:'0.866',   dirY:'0.5'   },
      { freqX:'0.00078', freqY:'0.00195', speed:'1.2',  dirX:'0.5',     dirY:'0.866' },
      { freqX:'0.00132', freqY:'0.00066', speed:'0.95', dirX:'-0.707',  dirY:'0.707' },
      { freqX:'0.0005',  freqY:'0.00125', speed:'1.8',  dirX:'1.0',     dirY:'0.0'   },
    ],
  },
  {
    id: 'turbulent-banks',
    label: 'Turbulent Banks',
    texture: '/textures/environment/cirrus000.dds',
    layers: [
      { freqX:'0.00014', freqY:'0.00014', speed:'4.5',  dirX:'-0.6',   dirY:'-0.8'  },
      { freqX:'0.0018',  freqY:'0.0038',  speed:'2.8',  dirX:'0.8',    dirY:'0.6'   },
      { freqX:'0.00075', freqY:'0.00125', speed:'1.2',  dirX:'-0.95',  dirY:'0.31'  },
      { freqX:'0.0045',  freqY:'0.0078',  speed:'0.6',  dirX:'0.707',  dirY:'0.707' },
    ],
  },
  {
    id: 'high-cirrus',
    label: 'High Cirrus',
    texture: '/textures/environment/cirrus000.dds',
    layers: [
      { freqX:'0.00082', freqY:'0.00082', speed:'0.3',  dirX:'1.0',                       dirY:'0.0'                    },
      { freqX:'0.00055', freqY:'0.00173', speed:'0.2',  dirX:'0.8660190526287391',         dirY:'0.5000110003630134'     },
      { freqX:'0.00295', freqY:'0.00427', speed:'0.15', dirX:'0.9500741086708272',         dirY:'-0.3120243388476822'   },
      { freqX:'0.00346', freqY:'0.00364', speed:'0.1',  dirX:'-0.40511729843930566',       dirY:'0.914264717959322'     },
    ],
  },
];

// Converts a preset's layer list → internal cirrusLayers format (adds id)
const presetToLayers = (preset) =>
  preset.layers.map(l => ({ ...l, id: Date.now() + Math.random() }));

const hexToRgba = (hex) => {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  return { r, g, b, a: 1.0 };
};

const hexToRgbArr = hex => [
  parseInt(hex.slice(1,3),16),
  parseInt(hex.slice(3,5),16),
  parseInt(hex.slice(5,7),16)
];

//  DOME PREVIEW 

// ─── Custom RangeSlider ───────────────────────────────────────────────────────
// Fully styled track + thumb using CSS custom property for fill width.
const RangeSlider = ({ min, max, step, value, onChange }) => {
  const numMin = parseFloat(min) || 0;
  const numMax = parseFloat(max) || 1;
  const numVal = parseFloat(value) || 0;
  const pct = Math.max(0, Math.min(100, ((numVal - numMin) / (numMax - numMin)) * 100));

  return (
    <div className="sb-range-wrap">
      <input
        type="range"
        className="sb-range"
        min={min}
        max={max}
        step={step}
        value={numVal}
        onChange={onChange}
        style={{ '--fill': `${pct}%` }}
      />
    </div>
  );
};


// ─── Custom ColorPicker (via @uiw/react-color-sketch) ────────────────────────
const SKYBOX_PRESET_COLORS = [
  // Deep space blues
  '#020814','#050f2a','#0a1840','#0d2252','#112d6b',
  // Sky blues
  '#1a3a8c','#2255b0','#2b6cd4','#3b76ff','#60a5fa',
  // Horizon / dusk
  '#1a1a3a','#1e2850','#243264','#2a3c78','#1e4a70',
  // Warm twilight
  '#2a1828','#3c1e38','#501e3c','#6b2440','#8c2a3c',
  // Sunset orange / red
  '#5c1e0a','#7a2c14','#9e3820','#c44a2a','#e06030',
  // Amber / ochre
  '#6b3c0a','#8a5018','#aa6824','#c8842e','#e8a040',
  // Dusty sand / brown
  '#3c2c18','#5a4022','#7a5830','#9a7040','#b88c52',
  // Cloud white / pale
  '#b8c4d8','#ccd4e8','#dce4f2','#eaf0f8','#f4f8fc',
];

// ─── Color utilities ──────────────────────────────────────────────────────────
const hexToHsv = (hex) => {
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d % 6) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
};

const toHex = (c) => {
  if (!c) return '#000000';
  if (typeof c === 'string') return c;
  // HDR: proportional herunterskalieren statt hart abschneiden
  const maxCh = Math.max(c.r || 0, c.g || 0, c.b || 0, 1.0);
  const norm = v => Math.round(((v || 0) / maxCh) * 255);
  const r = Math.max(0, Math.min(255, norm(c.r))).toString(16).padStart(2, '0');
  const g = Math.max(0, Math.min(255, norm(c.g))).toString(16).padStart(2, '0');
  const b = Math.max(0, Math.min(255, norm(c.b))).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
};

const hsvToHex = (h, s, v) => {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    const val = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.max(0, Math.min(255, Math.round(val * 255))).toString(16).padStart(2, '0');
  };
  return `#${f(5)}${f(3)}${f(1)}`;
};

const hueToHex = (h) => hsvToHex(h, 1, 1);

// ─── Custom Glassmorphic ColorPicker ──────────────────────────────────────────
const ColorPicker = ({ value, onChange }) => {
  const isValidHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v);
  const safeValue = isValidHex(value) ? value : '#3b76ff';

  const [open,    setOpen]    = React.useState(false);
  const [hexEdit, setHexEdit] = React.useState('');
  const [rgbEdit, setRgbEdit] = React.useState({ r:'', g:'', b:'' });
  const [editingHex, setEditingHex] = React.useState(false);
  const [editingRgb, setEditingRgb] = React.useState(false);

  const swatchRef = React.useRef(null);
  const popupRef  = React.useRef(null);
  const svRef     = React.useRef(null);
  const hueRef    = React.useRef(null);
  const [pos, setPos] = React.useState({ top:0, left:0, width:0 });
  const [draggingSv, setDraggingSv]   = React.useState(false);
  const [draggingHue, setDraggingHue] = React.useState(false);

  const hsv = React.useMemo(() => hexToHsv(safeValue), [safeValue]);
  const [r,g,b] = [parseInt(safeValue.slice(1,3),16), parseInt(safeValue.slice(3,5),16), parseInt(safeValue.slice(5,7),16)];

  const updatePos = React.useCallback(() => {
    if (!swatchRef.current) return;
    const rect = swatchRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    updatePos();
    const onDown = (e) => {
      if (swatchRef.current && !swatchRef.current.contains(e.target) &&
          popupRef.current && !popupRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  // SV field interaction
  const handleSvInteract = React.useCallback((e) => {
    if (!svRef.current) return;
    const rect = svRef.current.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    onChange({ target: { value: hsvToHex(hsv.h, s, v) } });
  }, [hsv.h, onChange]);

  // Hue slider interaction
  const handleHueInteract = React.useCallback((e) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const h = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
    onChange({ target: { value: hsvToHex(h, hsv.s, hsv.v) } });
  }, [hsv.s, hsv.v, onChange]);

  React.useEffect(() => {
    if (!draggingSv && !draggingHue) return;
    const onMove = (e) => draggingSv ? handleSvInteract(e) : handleHueInteract(e);
    const onUp   = () => { setDraggingSv(false); setDraggingHue(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [draggingSv, draggingHue, handleSvInteract, handleHueInteract]);

  const hueColor = hueToHex(hsv.h);

  return (
    <div className="sb-cp-wrap" ref={swatchRef}>
      {/* Trigger: preview swatch only */}
      <div
        className="sb-cp-trigger"
        onClick={() => { setOpen(o => !o); updatePos(); }}
      >
        <div className="sb-cp-trigger-swatch" style={{ background: safeValue }} />
        <span className="sb-cp-trigger-arrow">{open ? '▲' : '▼'}</span>
      </div>

      {open && ReactDOM.createPortal(
        <div
          ref={popupRef}
          className="sb-cp-popup"
          style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 160) }}
        >
          {/* Saturation / Value field */}
          <div
            ref={svRef}
            className="sb-cp-sv"
            style={{ background: hueColor }}
            onMouseDown={(e) => { setDraggingSv(true); handleSvInteract(e); }}
          >
            <div className="sb-cp-sv-white" />
            <div className="sb-cp-sv-dark" />
            <div className="sb-cp-sv-cursor" style={{
              left: `${hsv.s * 100}%`,
              top:  `${(1 - hsv.v) * 100}%`,
              boxShadow: `0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,0.5), 0 0 8px ${safeValue}88`,
            }}/>
          </div>

          {/* Hue slider */}
          <div className="sb-cp-hue-row">
            <div
              ref={hueRef}
              className="sb-cp-hue"
              onMouseDown={(e) => { setDraggingHue(true); handleHueInteract(e); }}
            >
              <div className="sb-cp-hue-thumb" style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }} />
            </div>
          </div>

          {/* Inputs: preview + hex + r + g + b */}
          <div className="sb-cp-inputs-row">
            <div className="sb-cp-preview-swatch" style={{ background: safeValue }} />

            <div className="sb-cp-input-col">
              <div className="sb-cp-input-hex-wrap">
                <span className="sb-cp-input-hash">#</span>
                <input
                  className="sb-cp-input sb-cp-input--hex"
                  value={editingHex ? hexEdit : safeValue.slice(1).toUpperCase()}
                  onFocus={() => { setEditingHex(true); setHexEdit(safeValue.slice(1).toUpperCase()); }}
                  onChange={(e) => setHexEdit(e.target.value)}
                  onBlur={() => {
                    setEditingHex(false);
                    const h = '#' + hexEdit;
                    if (isValidHex(h)) onChange({ target: { value: h } });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setEditingHex(false);
                      const h = '#' + hexEdit;
                      if (isValidHex(h)) onChange({ target: { value: h } });
                    }
                  }}
                  maxLength={6}
                  spellCheck={false}
                />
              </div>
              <span className="sb-cp-input-label">HEX</span>
            </div>

            {[['R', r, 0], ['G', g, 1], ['B', b, 2]].map(([ch, chVal, idx]) => (
              <div key={ch} className="sb-cp-input-col">
                <input
                  className="sb-cp-input"
                  value={editingRgb ? rgbEdit[ch.toLowerCase()] : chVal}
                  onFocus={() => { setEditingRgb(true); setRgbEdit({ r: String(r), g: String(g), b: String(b) }); }}
                  onChange={(e) => setRgbEdit(prev => ({ ...prev, [ch.toLowerCase()]: e.target.value }))}
                  onBlur={() => {
                    setEditingRgb(false);
                    const rv = Math.max(0,Math.min(255,parseInt(rgbEdit.r)||0));
                    const gv = Math.max(0,Math.min(255,parseInt(rgbEdit.g)||0));
                    const bv = Math.max(0,Math.min(255,parseInt(rgbEdit.b)||0));
                    const hex = '#' + [rv,gv,bv].map(x=>x.toString(16).padStart(2,'0')).join('');
                    onChange({ target: { value: hex } });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setEditingRgb(false);
                      const rv = Math.max(0,Math.min(255,parseInt(rgbEdit.r)||0));
                      const gv = Math.max(0,Math.min(255,parseInt(rgbEdit.g)||0));
                      const bv = Math.max(0,Math.min(255,parseInt(rgbEdit.b)||0));
                      const hex = '#' + [rv,gv,bv].map(x=>x.toString(16).padStart(2,'0')).join('');
                      onChange({ target: { value: hex } });
                    }
                  }}
                  maxLength={3}
                />
                <span className="sb-cp-input-label">{ch}</span>
              </div>
            ))}
          </div>

          {/* Presets */}
          <div className="sb-cp-presets-label">PRESETS</div>
          <div className="sb-cp-presets">
            {SKYBOX_PRESET_COLORS.map(c => (
              <div
                key={c}
                className="sb-cp-preset"
                style={{ background: c }}
                onClick={() => onChange({ target: { value: c } })}
              />
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};


const DomePreview = ({ horizonColor, zenithColor, horizonHeight, zenithHeight, subtractHeight, subdivHeight, scale, showLabels, fullscreen }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    const [hr,hg,hb] = hexToRgbArr(horizonColor);
    const [zr,zg,zb] = hexToRgbArr(zenithColor);

    const hH  = parseFloat(horizonHeight)  || 0;
    const zH  = parseFloat(zenithHeight)   || 256;
    const sH  = parseFloat(subtractHeight) || 1.2566;
    const sdH = Math.max(2, parseInt(subdivHeight) || 6);
    const sc  = parseFloat(scale) || 2343.163;

    const sphereLerp = Math.max(0, Math.min(1, 1 - (sH * 2) / Math.PI));
    const rings = [];
    for (let h = 0; h < sdH; h++) {
      const lerp  = h / (sdH - 1);
      const xNorm = (1 - sphereLerp) * (1 - lerp) + sphereLerp * Math.cos(lerp * Math.PI / 2);
      const yNorm = sphereLerp * Math.sin(lerp * Math.PI / 2);
      rings.push({ worldY: hH + yNorm * sc, worldX: xNorm * sc });
    }

    const apexY = rings[sdH - 1].worldY;
    const pxPerUnit = W / (2 * sc);
    const baseScreenY = H * 0.88;
    // toSY uses absolute Y=0 origin — hH and zH are both independent fixed values
    const toSY = (worldY) => baseScreenY - worldY * pxPerUnit;
    const centerX = W / 2;
    const toSX_right = (worldX) => centerX + worldX * pxPerUnit;
    const toSX_left  = (worldX) => centerX - worldX * pxPerUnit;
    const dispMax = baseScreenY / pxPerUnit;
    const dispRange = (H / pxPerUnit) || 1;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    const imageData = ctx.createImageData(W, H);
    const data = imageData.data;
    for (let py = 0; py < H; py++) {
      const worldY = dispMax - (py / H) * dispRange;
      if (worldY < hH) continue;
      const tv = Math.max(0, Math.min(1, (worldY - hH) / Math.max(1, zH - hH)));
      const r = Math.round(hr + (zr - hr) * tv);
      const g = Math.round(hg + (zg - hg) * tv);
      const b = Math.round(hb + (zb - hb) * tv);
      for (let px = 0; px < W; px++) {
        const idx = (py * W + px) * 4;
        data[idx]=Math.max(0,Math.min(255,r)); data[idx+1]=Math.max(0,Math.min(255,g));
        data[idx+2]=Math.max(0,Math.min(255,b)); data[idx+3]=255;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    const horizonScreenY = toSY(hH);
    if (horizonScreenY < H) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, Math.max(0, horizonScreenY), W, H - Math.max(0, horizonScreenY));
    }

    ctx.beginPath();
    ctx.moveTo(toSX_right(rings[0].worldX), toSY(rings[0].worldY));
    for (let h = 1; h < sdH; h++) ctx.lineTo(toSX_right(rings[h].worldX), toSY(rings[h].worldY));
    for (let h = sdH-1; h >= 0; h--) ctx.lineTo(toSX_left(rings[h].worldX), toSY(rings[h].worldY));
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill();

    ['right','left'].forEach(side => {
      ctx.beginPath();
      ctx.moveTo(side==='right' ? toSX_right(rings[0].worldX) : toSX_left(rings[0].worldX), toSY(rings[0].worldY));
      for (let h = 1; h < sdH; h++)
        ctx.lineTo(side==='right' ? toSX_right(rings[h].worldX) : toSX_left(rings[h].worldX), toSY(rings[h].worldY));
      ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=1.5; ctx.setLineDash([]); ctx.stroke();
    });

    if (showLabels) {
      for (let h = 0; h < sdH; h++) {
        const sy = toSY(rings[h].worldY);
        if (sy < 1 || sy > H-1) continue;
        const isApex = h === sdH-1, isBase = h === 0;
        ctx.beginPath();
        ctx.moveTo(toSX_left(rings[h].worldX), sy);
        ctx.lineTo(toSX_right(rings[h].worldX), sy);
        ctx.strokeStyle = isApex ? 'rgba(255,255,255,0.55)' : isBase ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.25)';
        ctx.lineWidth = isApex ? 1.5 : 1;
        ctx.setLineDash(isBase ? [] : [3,3]); ctx.stroke(); ctx.setLineDash([]);
        if (isApex || isBase || sdH <= 8 || h%2===1) {
          ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font=`${fullscreen?10:8}px monospace`;
          ctx.textAlign='left'; ctx.fillText(`r${h}`, toSX_right(rings[h].worldX)+4, sy+3);
        }
      }
      ctx.setLineDash([]);
      const drawHLine = (worldY, color, label) => {
        const sy = toSY(worldY);
        if (sy < 1 || sy > H-1) return;
        ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.setLineDash([5,3]);
        ctx.beginPath(); ctx.moveTo(0,sy); ctx.lineTo(W,sy); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font=`bold ${fullscreen?11:9}px monospace`; ctx.fillStyle=color;
        ctx.textAlign='left'; ctx.fillText(label, 8, sy-5);
      };
      drawHLine(hH, 'var(--skybox-generator-color)', `HorizonH = ${hH}`);
      drawHLine(zH, '#ffffff', `ZenithH = ${zH}`);
      drawHLine(0, 'rgba(255,210,40,0.9)', 'Y=0 Terrain');
      const apexSY = toSY(apexY);
      if (apexSY > 4 && apexSY < H-4) {
        ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font=`${fullscreen?10:8}px monospace`;
        ctx.textAlign='center'; ctx.fillText(`apex ≈ ${Math.round(apexY)}`, centerX, apexSY-6);
      }
      ctx.textAlign='left'; ctx.fillStyle='rgba(255,255,255,0.18)';
      ctx.font=`${fullscreen?10:9}px monospace`;
      ctx.fillText(`SphereLerp=${sphereLerp.toFixed(3)}  SubdivH=${sdH}  SubtractH=${sH}`, 8, H-6);
    }

    ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=1; ctx.setLineDash([]); ctx.strokeRect(0,0,W,H);
  }, [horizonColor, zenithColor, horizonHeight, zenithHeight, subtractHeight, subdivHeight, scale, showLabels, fullscreen]);

  const w = fullscreen ? 900 : 420;
  const h = fullscreen ? 560 : 280;
  return <canvas ref={canvasRef} width={w} height={h} style={{width:'100%',display:'block',border:'1px solid rgba(255,255,255,0.08)'}}/>;
};

//  FULLSCREEN DOME OVERLAY 
const FullscreenDome = ({ horizonColor,setHorizonColor,zenithColor,setZenithColor,horizonHeight,setHorizonHeight,zenithHeight,setZenithHeight,subtractHeight,subdivHeight,scale,showLabels,setShowLabels,onClose }) => {
  const sphereLerp = Math.max(0, Math.min(1, 1-(parseFloat(subtractHeight)||1.2566)*2/Math.PI));

  const hH = parseFloat(horizonHeight) || 0;
  const zH = parseFloat(zenithHeight)  || 256;
  // Slider range: horizonHeight -500..500, zenithHeight 0..2000
  const HH_MIN = -200, HH_MAX = 1000;
  const ZH_MIN = -100, ZH_MAX = 1000;

  return (
    <div className="dome-fullscreen-overlay">
      <div className="dome-fullscreen-inner">
        <div className="dome-fullscreen-sidebar">
          <div className="dome-fs-header">
            <span style={{color:'var(--skybox-generator-color)',fontFamily:'Space Grotesk',fontWeight:700,fontSize:'0.9rem',letterSpacing:'0.1em',textTransform:'uppercase'}}>⬡ Dome Editor</span>
            <button className="btn-delete-sm" onClick={onClose} style={{width:36,height:36,minWidth:36,padding:0,fontSize:'1.1rem'}}>×</button>
          </div>

          {/* Horizon */}
          <div className="dome-fs-group">
            <label>Horizon Color</label>
            <ColorPicker value={horizonColor} onChange={e=>setHorizonColor(e.target.value)} />
          </div>
          <div className="dome-fs-group">
            <label>Horizon Height</label>
            <div className="dome-fs-slider-row">
              <input
                type="range" min={HH_MIN} max={HH_MAX} step={1}
                value={Math.max(HH_MIN, Math.min(HH_MAX, hH))}
                onChange={e => setHorizonHeight(e.target.value)}
                className="dome-fs-slider"
              />
              <input className="skybox-input dome-fs-slider-input" value={horizonHeight} onChange={e=>setHorizonHeight(e.target.value)} placeholder="-42.5"/>
            </div>
            <p className="skybox-form-help" style={{marginTop:4}}>Cut-off edge — below: black.</p>
          </div>

          <div className="dome-fs-divider"/>

          {/* Zenith */}
          <div className="dome-fs-group">
            <label>Zenith Color</label>
            <ColorPicker value={zenithColor} onChange={e=>setZenithColor(e.target.value)} />
          </div>
          <div className="dome-fs-group">
            <label>Zenith Height</label>
            <div className="dome-fs-slider-row">
              <input
                type="range" min={ZH_MIN} max={ZH_MAX} step={1}
                value={Math.max(ZH_MIN, Math.min(ZH_MAX, zH))}
                onChange={e => setZenithHeight(e.target.value)}
                className="dome-fs-slider"
              />
              <input className="skybox-input dome-fs-slider-input" value={zenithHeight} onChange={e=>setZenithHeight(e.target.value)} placeholder="293.507"/>
            </div>
          </div>

          <div className="dome-fs-divider"/>
          <div className="dome-fs-stat"><span>SphereLerp</span><span style={{color:'var(--skybox-generator-color)',fontFamily:'monospace'}}>{sphereLerp.toFixed(4)}</span></div>
          <div className="dome-fs-stat"><span>Scale</span><span style={{color:'var(--skybox-generator-color)',fontFamily:'monospace'}}>{Math.round(scale)}</span></div>
          <div className="dome-fs-stat"><span>Apex ≈</span><span style={{color:'rgba(255,255,255,0.5)',fontFamily:'monospace'}}>{Math.round(hH+sphereLerp*scale)}</span></div>
          <div className="dome-fs-divider"/>
          <button onClick={()=>setShowLabels(v=>!v)} className="btn-secondary" style={{width:'100%',marginTop:'4px'}}>{showLabels?'Hide Labels':'Show Labels'}</button>
        </div>
        <div className="dome-fullscreen-canvas">
          <DomePreview horizonColor={horizonColor} zenithColor={zenithColor} horizonHeight={hH} zenithHeight={zH} subtractHeight={parseFloat(subtractHeight)||1.2566} subdivHeight={parseInt(subdivHeight)||6} scale={scale} showLabels={showLabels} fullscreen={true}/>
        </div>
      </div>
    </div>
  );
};

//  CIRRUS LAYER DIAGRAM 
// Pure explanatory schematic — no rendering, no canvas.
// Shows per-layer frequency scale, direction, speed, and the masking chain.
const CirrusLayerDiagram = ({ layers, cirrusMult }) => {
  if (!layers.length) return null;

  // Map freqX (log scale ~0.00005–0.01) → bar width 8–88px
  const freqBar = (f) => {
    const v = parseFloat(f) || 0.0001;
    const t = Math.max(0, Math.min(1, (Math.log10(v) - Math.log10(0.00005)) / (Math.log10(0.01) - Math.log10(0.00005))));
    return Math.round(8 + t * 80);
  };

  // Speed → scroll label brightness
  const spdColor = (s) => {
    const v = Math.abs(parseFloat(s) || 0);
    const a = Math.round((0.3 + Math.min(v / 10, 1) * 0.7) * 255).toString(16).padStart(2, '0');
    return '#ffffff' + a;
  };

  const S = { // shared style tokens
    muted:  'rgba(255,255,255,0.22)',
    dim:    'rgba(255,255,255,0.12)',
    label:  { fontSize:'0.6rem', letterSpacing:'0.07em', textTransform:'uppercase', color:'rgba(255,255,255,0.28)' },
    mono:   { fontFamily:'monospace' },
  };

  return (
    <div>

      {/*  Per-layer cards  */}
      {layers.map((layer, i) => {
        const col   = PLANET_UV_COLORS[i % PLANET_UV_COLORS.length];
        const fx    = parseFloat(layer.freqX) || 0.0001;
        const fy    = parseFloat(layer.freqY) || 0.0001;
        const speed = parseFloat(layer.speed) || 0;
        const dx    = parseFloat(layer.dirX)  || 1;
        const dz    = parseFloat(layer.dirY)  || 0;
        const len   = Math.sqrt(dx*dx + dz*dz) || 1;
        const ndx   = dx/len, ndz = dz/len;
        const bx    = freqBar(fx), by = freqBar(fy);

        return (
          <div key={layer.id} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 52px',
            gap: '10px',
            alignItems: 'start',
            marginBottom: '7px',
            padding: '9px 11px',
            background: 'rgba(0,0,0,0.28)',
            border: `1px solid ${col}28`,
            borderLeft: `3px solid ${col}`,
          }}>

            {/*  Left: values  */}
            <div>
              {/* Layer header */}
              <div style={{display:'flex', alignItems:'center', gap:'7px', marginBottom:'8px'}}>
                <span style={{color:col, fontWeight:700, fontSize:'0.78rem', fontFamily:'monospace'}}>L{i+1}</span>
                {i > 0 && (
                  <span style={{fontSize:'0.6rem', color:S.muted, letterSpacing:'0.04em'}}>
                    masked by&nbsp;
                    {layers.slice(0,i).map((_,j) => (
                      <span key={j} style={{color:PLANET_UV_COLORS[j%PLANET_UV_COLORS.length], fontWeight:700}}>L{j+1} </span>
                    ))}
                  </span>
                )}
                {i === 0 && (
                  <span style={{fontSize:'0.6rem', color:S.muted}}>base layer</span>
                )}
              </div>

              {/* freqX */}
              <div style={{display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px'}}>
                <span style={{...S.label, width:'40px'}}>freq X</span>
                <div style={{width:`${bx}px`, height:'4px', background:col, opacity:0.75, borderRadius:'2px', flexShrink:0}}/>
                <span style={{fontSize:'0.65rem', ...S.mono, color:'rgba(255,255,255,0.55)'}}>{fx.toExponential(3)}</span>
              </div>

              {/* freqY */}
              <div style={{display:'flex', alignItems:'center', gap:'6px', marginBottom:'7px'}}>
                <span style={{...S.label, width:'40px'}}>freq Y</span>
                <div style={{width:`${by}px`, height:'4px', background:col, opacity:0.42, borderRadius:'2px', flexShrink:0}}/>
                <span style={{fontSize:'0.65rem', ...S.mono, color:'rgba(255,255,255,0.55)'}}>{fy.toExponential(3)}</span>
              </div>

              {/* Speed + Dir */}
              <div style={{display:'flex', gap:'14px'}}>
                <div>
                  <div style={S.label}>speed</div>
                  <span style={{fontSize:'0.72rem', ...S.mono, color: speed > 0 ? col : S.muted}}>
                    {speed > 0 ? speed : '—'}
                  </span>
                </div>
                <div>
                  <div style={S.label}>direction</div>
                  <span style={{fontSize:'0.7rem', ...S.mono, color:'rgba(255,255,255,0.5)'}}>
                    ({parseFloat(layer.dirX).toFixed(3)}, {parseFloat(layer.dirY).toFixed(3)})
                  </span>
                </div>
              </div>
            </div>

            {/*  Right: direction compass  */}
            <svg width="52" height="52" viewBox="-26 -26 52 52" style={{flexShrink:0, marginTop:'2px'}}>
              {/* compass ring */}
              <circle r="22" fill="none" stroke={col} strokeOpacity="0.18" strokeWidth="1"/>
              {/* cardinal ticks */}
              {[[0,-22],[22,0],[0,22],[-22,0]].map(([cx,cy],ti) => (
                <line key={ti} x1={cx*0.82} y1={cy*0.82} x2={cx} y2={cy}
                  stroke={col} strokeOpacity="0.15" strokeWidth="1"/>
              ))}
              {/* direction arrow shaft */}
              <line x1="0" y1="0"
                x2={(ndx*17).toFixed(2)} y2={(ndz*17).toFixed(2)}
                stroke={col} strokeWidth="1.8" strokeOpacity={speed > 0 ? 0.9 : 0.45}
                strokeLinecap="round"/>
              {/* arrowhead */}
              <circle
                cx={(ndx*17).toFixed(2)} cy={(ndz*17).toFixed(2)}
                r="2.5" fill={col} fillOpacity={speed > 0 ? 0.95 : 0.4}/>
              {/* origin dot */}
              <circle r="2" fill={col} fillOpacity="0.5"/>
              {/* speed ring — radius proportional to speed */}
              {speed > 0 && (
                <circle r={Math.min(20, 4 + speed * 1.2).toFixed(1)}
                  fill="none" stroke={col} strokeOpacity="0.12" strokeWidth="1"
                  strokeDasharray="2 3"/>
              )}
            </svg>

          </div>
        );
      })}

      {/*  Multiplication chain  */}
      <div style={{
        marginTop:'10px', padding:'10px 12px',
        background:'rgba(255,255,255,0.03)',
        border:'1px solid rgba(255,255,255,0.09)',
      }}>
        <div style={{...S.label, marginBottom:'7px', display:'block'}}>
          shader result = product of all layers × CirrusMultiplier
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'4px', flexWrap:'wrap', fontFamily:'monospace'}}>
          {layers.map((_, i) => (
            <React.Fragment key={i}>
              <span style={{color:PLANET_UV_COLORS[i%PLANET_UV_COLORS.length], fontWeight:700, fontSize:'0.78rem'}}>
                fbm(L{i+1})
              </span>
              {i < layers.length-1 && (
                <span style={{color:S.muted, fontSize:'0.85rem', margin:'0 1px'}}>×</span>
              )}
            </React.Fragment>
          ))}
          <span style={{color:S.muted, fontSize:'0.85rem', margin:'0 3px'}}>×</span>
          <span style={{color:'rgba(255,255,255,0.65)', fontWeight:700, fontSize:'0.78rem'}}>
            {parseFloat(cirrusMult)||1.8}
          </span>
          <span style={{color:S.dim, fontSize:'0.72rem', marginLeft:'5px'}}>→ cloud opacity</span>
        </div>
      </div>

      {/*  How it works — mini legend  */}
      <div style={{
        marginTop:'7px', padding:'9px 12px',
        background:'rgba(255,255,255,0.02)',
        border:'1px solid rgba(255,255,255,0.06)',
        fontSize:'0.64rem', lineHeight:'1.75', color:S.muted,
      }}>
        <div style={{color:'rgba(255,255,255,0.42)', fontWeight:600, letterSpacing:'0.08em', marginBottom:'3px', textTransform:'uppercase', fontSize:'0.62rem'}}>How it works</div>
        Each layer samples <span style={{color:'rgba(255,255,255,0.48)'}}>FBM noise</span> at its own frequency and scrolls in its direction at its speed.
        The outputs are <span style={{color:'rgba(255,255,255,0.48)'}}>multiplied together</span> — so a dark patch in any single layer suppresses
        clouds everywhere that patch falls, regardless of what the other layers show there.<br/>
        <span style={{color:'rgba(255,255,255,0.35)', marginTop:'3px', display:'block'}}>
          Higher freqX/Y → finer cloud detail · Higher speed → faster scroll · Bar width = relative frequency scale
        </span>
      </div>

    </div>
  );
};

//  MAIN COMPONENT 
const SkyboxGeneratorTab = ({ settings, shared = {}, onSharedChange = () => {}, onRecordSnapshot = () => {} }) => {
  // Map context — own state, synced to shared so other tabs can read it too
  const [mapName,       setMapNameLocal]       = useState(shared.sb_mapName       || shared.pt_mapName       || shared.wr_mapName       || '');
  const [mapsFolderPath, setMapsFolderPathLocal] = useState(shared.sb_mapsFolderPath || shared.pt_mapsFolderPath || shared.wr_mapsFolderPath || settings?.mapsFolder || '');
  const [exportRawScmskybox, setExportRawScmskybox] = useState(shared.sb_exportRawScmskybox ?? false);
  const [generateReadme,     setGenerateReadme]     = useState(shared.sb_generateReadme     ?? true);

  const setMapName = (val) => {
    setMapNameLocal(val);
    onSharedChange('sb_mapName', val);
  };
  const setMapsFolderPath = (val) => {
    setMapsFolderPathLocal(val);
    onSharedChange('sb_mapsFolderPath', val);
  };

  // Sync in from other tabs when shared changes externally
  useEffect(() => {
    const ext = shared.pt_mapName || shared.wr_mapName || '';
    if (ext && !mapName) setMapNameLocal(ext);
  }, [shared.pt_mapName, shared.wr_mapName]);

  useEffect(() => {
    const ext = shared.pt_mapsFolderPath || shared.wr_mapsFolderPath || settings?.mapsFolder || '';
    if (ext && !mapsFolderPath) setMapsFolderPathLocal(ext);
  }, [shared.pt_mapsFolderPath, shared.wr_mapsFolderPath, settings?.mapsFolder]);

  // Auto-read map size from scenario.lua when mapName + mapsFolder are set
  // When the size changes, rescale horizonHeight, zenithHeight and cirrusLayer frequencies
  const prevMapSizeRef = useRef(parseFloat(settings?.defaultMapSize ?? '1024') || 1024);
  useEffect(() => {
    const name   = (mapName || '').trim();
    const folder = (mapsFolderPath || settings?.mapsFolder || '').trim();
    if (!name || !folder) { setMapSize('1024'); setMapSizeSource('default'); return; }
    const finalName     = /\.v\d{4}$/.test(name) ? name : name + '.v0001';
    const mapFolderPath = folder + '\\' + finalName;
    window.electronAPI.invoke('read-map-info', { mapFolderPath }).then(res => {
      const newSize = res?.success ? (parseFloat(res.mapSize) || 1024) : 1024;
      const oldSize = prevMapSizeRef.current;
      if (newSize !== oldSize) {
        const factor = newSize / oldSize;
        setHorizonHeight(v => String(parseFloat((parseFloat(v) * factor).toFixed(2))));
        setZenithHeight(v  => String(parseFloat((parseFloat(v) * factor).toFixed(2))));
        setCirrusLayers(ls => ls.map(l => ({
          ...l,
          freqX: parseFloat((parseFloat(l.freqX) / factor).toPrecision(5)),
          freqY: parseFloat((parseFloat(l.freqY) / factor).toPrecision(5)),
          speed: parseFloat((parseFloat(l.speed)  * factor).toPrecision(5)),
        })));
        prevMapSizeRef.current = newSize;
      }
      if (res?.success) {
        setMapSize(String(res.mapSize));
        setMapSizeSource('auto');
      } else {
        setMapSize('1024');
        setMapSizeSource('default');
      }
    }).catch(() => {
      setMapSize('1024');
      setMapSizeSource('default');
    });
  }, [mapName, mapsFolderPath, settings?.mapsFolder]);

  const [activeTab, setActiveTab] = useState('skybox');
  const [domeFullscreen, setDomeFullscreen] = useState(false);

  // Read save location from settings (configured in Settings → Game Paths)
  const skyboxSaveMode   = settings?.skyboxSaveMode   || 'mapFolder';
  const skyboxFolderPath = settings?.skyboxFolderPath || '';

  const [mapSize,       setMapSize]       = useState(settings?.defaultMapSize ?? "1024");
  const [mapSizeSource, setMapSizeSource] = useState('default'); // 'auto' | 'manual' | 'default'
  const scale = (parseFloat(mapSize) || 1024) * 2.288;
  const [subtractHeight, setSubtractHeight] = useState('1.2566');
  const [subdivAxis, setSubdivAxis] = useState('16');
  const [subdivHeight, setSubdivHeight] = useState('6');
  const [horizonHeight, setHorizonHeight] = useState('-42.5');
  const [zenithHeight, setZenithHeight] = useState('293.507');
  const [horizonColor, setHorizonColor] = useState('#a5d1d6');
  const [zenithColor, setZenithColor] = useState('#3869b8');
  const [decalGlowMult, setDecalGlowMult] = useState('0.1');
  const [albedo, setAlbedo] = useState('/textures/environment/Decal_test_Albedo003.dds');
  const [glow, setGlow] = useState('/textures/environment/Decal_test_Glow003.dds');

  const [cirrusMult, setCirrusMult] = useState('1.8');
  const [cirrusColor, setCirrusColor] = useState('#ffffff');
  const [cirrusTexture, setCirrusTexture] = useState('/textures/environment/cirrus000.dds');
  const [cirrusLayers, setCirrusLayers] = useState([
    { id:1, freqX:0.0001,   freqY:0.0001,   speed:7.8,  dirX:0.432,  dirY:-0.902 },
    { id:2, freqX:0.001011, freqY:0.003189, speed:1.28, dirX:1.0,    dirY:0.0 },
    { id:3, freqX:0.000645, freqY:0.001011, speed:0.0,  dirX:0.95,   dirY:0.312 },
    { id:4, freqX:0.003367, freqY:0.005911, speed:0.55, dirX:0.9996, dirY:0.0297 },
  ]);

  const [planets, setPlanets] = useState([]);

  const addPlanet    = () => setPlanets(ps => [...ps, defaultPlanet()]);
  const removePlanet = (id) => setPlanets(ps => ps.filter(p => p.id !== id));
  const updatePlanet = (id, field, val) =>
    setPlanets(ps => ps.map(p => p.id === id ? { ...p, [field]: val } : p));

  const addCirrus    = () => setCirrusLayers(ls => [...ls, { ...defaultCirrusLayer(), id: Date.now() + Math.random() }]);
  const removeCirrus = (id) => setCirrusLayers(ls => ls.filter(l => l.id !== id));
  const updateCirrus = (id, field, val) =>
    setCirrusLayers(ls => ls.map(l => l.id === id ? { ...l, [field]: val } : l));

  // ── Cirrus Preset state ───────────────────────────────────────────────────
  const [activePresetId,   setActivePresetId]   = useState(null);   // id of active builtin preset, or null
  const [customPresets,    setCustomPresets]     = useState([]);     // user-saved presets
  const [showSavePreset,   setShowSavePreset]    = useState(false);  // custom save dialog open
  const [newPresetName,    setNewPresetName]     = useState('');
  const [importText,       setImportText]        = useState('');     // raw pasted/dropped text
  const [importError,      setImportError]       = useState('');     // parse error message
  const [importDragOver,   setImportDragOver]    = useState(false);  // drag-over highlight

  // Load custom presets from history on mount
  useEffect(() => {
    window.electronAPI.invoke('history-load').then(res => {
      const saved = res?.data?.cirrusCustomPresets;
      if (Array.isArray(saved) && saved.length) setCustomPresets(saved);
    }).catch(() => {});
  }, []);

  // Persist custom presets whenever they change
  useEffect(() => {
    if (!customPresets.length) return;
    window.electronAPI.invoke('history-load').then(res => {
      const base = res?.data || {};
      window.electronAPI.invoke('history-save', { data: { ...base, cirrusCustomPresets: customPresets } }).catch(() => {});
    }).catch(() => {});
  }, [customPresets]);

  const applyPreset = (preset) => {
    // Single-click activates; if already active, double-click deactivates
    if (activePresetId === preset.id) {
      setActivePresetId(null);
      return;
    }
    setActivePresetId(preset.id);
    setCirrusTexture(preset.texture);
    setCirrusLayers(presetToLayers(preset));
  };

  // Parse CirrusLayers + CirrusTexture out of arbitrary JSON or Lua skybox text.
  // Accepts: full skybox JSON, bare CirrusLayers array, or .lua skybox block.
  const parseCirrusFromText = (raw) => {
    raw = (raw || '').trim();
    let layers = null, texture = null;

    // ── Try JSON ──────────────────────────────────────────────────────────────
    // Attempt 1: parse as-is (full object, array, or Data-wrapped)
    const tryParseJson = (str) => {
      try { return JSON.parse(str); } catch (_) { return null; }
    };

    // Attempt 2: if raw starts with a key like "CirrusTexture": wrap in {}
    const tryWrap = (str) => {
      const trimmed = str.replace(/^,|,$/g, '').trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return tryParseJson('{' + trimmed + '}');
      }
      return null;
    };

    let obj = tryParseJson(raw) ?? tryWrap(raw);
    if (obj !== null) {
      if (obj?.Data) obj = obj.Data;
      if (Array.isArray(obj)) {
        layers = obj;
      } else {
        layers  = obj?.CirrusLayers  ?? obj?.cirrusLayers  ?? null;
        texture = obj?.CirrusTexture ?? obj?.cirrusTexture ?? null;
      }
    }

    // ── Try Lua (simple regex extraction) ────────────────────────────────────
    if (!layers) {
      // Extract cirrusTexture = "..."
      const texMatch = raw.match(/cirrusTexture\s*=\s*"([^"]+)"/);
      if (texMatch) texture = texMatch[1];

      // Extract cirrusLayers = { { direction={x,y}, frequency={x,y}, speed=n }, ... }
      const layersBlock = raw.match(/cirrusLayers\s*=\s*\{([\s\S]*?)\},?\s*(?:cirrus|decal|glow|horizon|zenith|planet|position|scale|subDiv|subHeight|albedo|\})/);
      if (layersBlock) {
        const block = layersBlock[1];
        const entries = block.split(/\},?\s*\{/);
        const parsed = entries.map(entry => {
          const dx = entry.match(/direction\s*=\s*\{\s*([\d.eE+\-]+)\s*,\s*([\d.eE+\-]+)/i);
          const fx = entry.match(/frequency\s*=\s*\{\s*([\d.eE+\-]+)\s*,\s*([\d.eE+\-]+)/i);
          const sp = entry.match(/speed\s*=\s*([\d.eE+\-]+)/i);
          if (!fx) return null;
          return {
            frequency: { x: parseFloat(fx[1]), y: parseFloat(fx[2]) },
            Direction: { x: dx ? parseFloat(dx[1]) : 1, y: dx ? parseFloat(dx[2]) : 0 },
            Speed: sp ? parseFloat(sp[1]) : 0,
          };
        }).filter(Boolean);
        if (parsed.length) layers = parsed;
      }
    }

    if (!layers || !layers.length) return null;

    // Normalise to internal format (same as the existing file-load path)
    const normalized = layers.slice(0, 4).map((l, i) => ({
      id:    Date.now() + i + Math.random(),
      freqX: String(l.frequency?.x ?? l.FrequencyX ?? 0.0001),
      freqY: String(l.frequency?.y ?? l.FrequencyY ?? 0.0001),
      speed: String(l.Speed  ?? l.speed  ?? 0),
      dirX:  String(l.Direction?.x ?? l.DirectionX ?? 1),
      dirY:  String(l.Direction?.y ?? l.DirectionY ?? 0),
    }));

    return { layers: normalized, texture };
  };

  const saveCustomPreset = () => {
    const name = newPresetName.trim();
    if (!name) return;
    // If importText has content, parse from that; otherwise snapshot current layers
    const fromImport = importText.trim() ? parseCirrusFromText(importText) : null;
    const preset = {
      id: 'custom-' + Date.now(),
      label: name,
      texture: fromImport?.texture ?? cirrusTexture,
      layers: fromImport
        ? fromImport.layers.map(({ freqX, freqY, speed, dirX, dirY }) =>
            ({ freqX: String(freqX), freqY: String(freqY), speed: String(speed), dirX: String(dirX), dirY: String(dirY) }))
        : cirrusLayers.map(({ freqX, freqY, speed, dirX, dirY }) =>
            ({ freqX: String(freqX), freqY: String(freqY), speed: String(speed), dirX: String(dirX), dirY: String(dirY) })),
    };
    setCustomPresets(ps => [...ps, preset]);
    setNewPresetName('');
    setImportText('');
    setImportError('');
    setShowSavePreset(false);
  };

  const deleteCustomPreset = (id) => {
    setCustomPresets(ps => ps.filter(p => p.id !== id));
    if (activePresetId === id) setActivePresetId(null);
    window.electronAPI.invoke('history-load').then(res => {
      const base = res?.data || {};
      const updated = (base.cirrusCustomPresets || []).filter(p => p.id !== id);
      window.electronAPI.invoke('history-save', { data: { ...base, cirrusCustomPresets: updated } }).catch(() => {});
    }).catch(() => {});
  };

  // ── Stars state ──────────────────────────────────────────────────────────
  const [numStars,        setNumStars]        = useState('50');
  const [numClusters,     setNumClusters]     = useState('10');
  const [clusterSpread,   setClusterSpread]   = useState('14000');
  const [clusterStdDev,   setClusterStdDev]   = useState('1800');
  const [backgroundRatio, setBackgroundRatio] = useState('0.45');
  const [scaleMin,        setScaleMin]        = useState('10');
  const [scaleMax,        setScaleMax]        = useState('30');
  const [uvOpacity,       setUvOpacity]       = useState('0.25');
  const [uvOptions,       setUvOptions]       = useState('0.0, 0.0, 0.5, 0.5\n0.5, 0.0, 0.5, 0.5\n0.0, 0.5, 0.5, 0.5\n0.5, 0.5, 0.5, 0.5');
  const [uvWeights,       setUvWeights]       = useState('0.25\n0.25\n0.25\n0.25');
  const [uvRows, setUvRows] = useState(DEFAULT_UV_ROWS);
  const syncUvRows = (rows) => {
    setUvRows(rows);
    setUvOptions(uvRowsToOptions(rows));
    setUvWeights(uvRowsToWeights(rows));
  };
  const [seed,    setSeed]    = useState(42);
  const [useSeed, setUseSeed] = useState(false);
  const randomizeSeed = () => setSeed(Math.floor(Math.random() * 999999) + 1);
  const [yMode,           setYMode]           = useState('flat');
  const [yMax,            setYMax]            = useState('1500');
  const [yCenter,         setYCenter]         = useState('750');
  const [yStdDev,         setYStdDev]         = useState('300');
  const [yLayers,         setYLayers]         = useState('200, 400, 0.7\n900, 200, 0.3');
  const [diskCenter,      setDiskCenter]      = useState('100');
  const [diskStdDev,      setDiskStdDev]      = useState('120');
  const [haloStdDev,      setHaloStdDev]      = useState('800');
  const [haloRatio,       setHaloRatio]       = useState('0.15');
  const [curvePoints,     setCurvePoints]     = useState([
    { x: 0.05, y: 0.0 }, { x: 1.0, y: 0.15 }, { x: 0.3, y: 0.5 }, { x: 0.05, y: 1.0 },
  ]);
  const [yClusterScatter, setYClusterScatter] = useState('200');
  const [exclusionZones,   setExclusionZones]  = useState([]);
  const [draftZone,        setDraftZone]        = useState(null);
  const [selectedZoneIdx,  setSelectedZoneIdx]  = useState(null);
  const [exEnabled,        setExEnabled]        = useState(true);
  const exDragging  = useRef(false);
  const exDragStart = useRef({ x: 0, y: 0 });
  const exDraft     = useRef(null);
  const [previewImage,     setPreviewImage]     = useState(null);
  const [previewImageData, setPreviewImageData] = useState(null);
  const [texOpacity,       setTexOpacity]       = useState(1);
  const uvCanvasRef  = useRef(null);
  const exCanvasRef  = useRef(null);
  const exWrapRef    = useRef(null);
  const fileInputRef = useRef(null);

  const [showSkyboxLibrary,  setShowSkyboxLibrary]  = useState(false);
  const [showHelp,           setShowHelp]           = useState(false);
  const [activeHelpTab,      setActiveHelpTab]      = useState('guide');
  const [helpSelected,       setHelpSelected]       = useState(null);
  const [activeAdvSubTab,    setActiveAdvSubTab]     = useState('workflow');

  //  Auto-apply pending community skybox when this tab becomes active 
  // ContributionsTab stores data on window._pendingContribSkybox before navigating here.
  // We consume it immediately on mount — no extra button needed.
  useEffect(() => {
    const pending = window._pendingContribSkybox;
    if (!pending) return;
    window._pendingContribSkybox = null;
    applyLibrarySkybox({ scmskyboxData: pending, isCustom: false });
  // applyLibrarySkybox is stable (defined in component body, no deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  //  Skybox library cache — loaded once, complete, never partial 
  // skyboxLibCache holds the full categories array in a ref so it survives
  // re-renders without triggering them during the fetch pipeline.
  const [skyboxCategories, setSkyboxCategories] = useState([]);
  const [skyboxLibLoading, setSkyboxLibLoading] = useState(false);
  const [skyboxLibLoaded,  setSkyboxLibLoaded]  = useState(false);
  const [skyboxLibError,   setSkyboxLibError]   = useState(null);
  const skyboxLibLoadingRef = useRef(false); // ref-guard prevents double-invoke across renders

  const loadSkyboxLibrary = useCallback(async ({ forceRefresh = false } = {}) => {
    // Ref-guard: if a fetch is already in-flight, ignore duplicate calls
    if (skyboxLibLoadingRef.current) return;
    skyboxLibLoadingRef.current = true;
    setSkyboxLibLoading(true);
    setSkyboxLibError(null);
    try {
      // fetchSkyboxLibrary must return ALL categories/items — the overlay is
      // responsible for deep-fetching per-category if the index is paginated.
      // We pass { forceRefresh } so the main process can bypass its disk cache.
      const cats = await fetchSkyboxLibrary({ forceRefresh });

      // Validate: ensure we got a non-empty array; log a warning if suspiciously small
      if (!Array.isArray(cats)) throw new Error('fetchSkyboxLibrary returned non-array');
      const totalItems = cats.reduce((n, c) => n + (c.items?.length ?? 0), 0);
      if (totalItems === 0 && cats.length === 0) {
        console.warn('[SkyboxLib] Library returned 0 categories — possible partial fetch or empty index.');
      } else {
        console.log(`[SkyboxLib] Cached ${cats.length} categories, ${totalItems} total items.`);
      }

      // Commit the full set atomically — never a partial slice
      setSkyboxCategories(cats);
      setSkyboxLibLoaded(true);
    } catch (e) {
      console.error('[SkyboxTab] library load failed:', e.message);
      setSkyboxLibError(e.message);
      // Keep existing cats if we already had some — don't wipe a good cache on a refresh failure
    } finally {
      skyboxLibLoadingRef.current = false;
      setSkyboxLibLoading(false);
    }
  }, []);

  const openSkyboxLibrary = () => {
    setShowSkyboxLibrary(true);
    // First open: try disk cache first (instant, no API calls).
    // Reload button: forceRefresh = true → main process fetches from GitHub.
    if (!skyboxLibLoaded && !skyboxLibLoadingRef.current) {
      loadSkyboxLibrary({ forceRefresh: false });
    }
  };

  const [showDomeLabels, setShowDomeLabels] = useState(true);

  //  Settings-Sync 
  useEffect(() => {
    if (settings?.defaultMapSize) setMapSize(settings.defaultMapSize);
  }, [settings]);

  // ── Draw exclusion canvas — multi-zone union rendering ────────
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
    ctx.strokeStyle = 'rgba(59,118,255,0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();
    ctx.setLineDash([]);
    // Center dot
    ctx.fillStyle = 'rgba(59,118,255,0.65)';
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
    ctx.fillStyle = 'rgba(59,118,255,0.7)';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('0, 0', W/2 + 1, H/2 + 10);
    ctx.strokeStyle = 'rgba(59,118,255,0.15)';
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

      // Offscreen B: eroded union (2px inset per rect)
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

      // Rim = union MINUS eroded → outer 2px ring only
      const offRim = document.createElement('canvas');
      offRim.width = W; offRim.height = H;
      const rCtx = offRim.getContext('2d');
      rCtx.drawImage(offUnion, 0, 0);
      rCtx.globalCompositeOperation = 'destination-out';
      rCtx.drawImage(offEroded, 0, 0);

      // Fill: union at low opacity
      ctx.globalAlpha = 0.1;
      ctx.drawImage(offUnion, 0, 0);
      ctx.globalAlpha = 1;

      // Outline: tint rim red
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

    // ── Draft zone overlay — blue (skybox accent) ──
    if (draft) {
      const x0 = Math.min(draft.x0, draft.x1) * W;
      const y0 = Math.min(draft.y0, draft.y1) * H;
      const w  = Math.abs(draft.x1 - draft.x0) * W;
      const h  = Math.abs(draft.y1 - draft.y0) * H;
      ctx.fillStyle = 'rgba(59,118,255,0.12)';
      ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = 'rgba(100,160,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x0, y0, w, h);
      ctx.setLineDash([]);
      [[x0,y0],[x0+w,y0],[x0,y0+h],[x0+w,y0+h]].forEach(([cx,cy]) => {
        ctx.fillStyle = 'rgba(100,160,255,0.9)';
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2); ctx.fill();
      });
      if (w > 60 && h > 22) {
        ctx.fillStyle = 'rgba(100,160,255,0.85)';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('CONFIRM ZONE?', x0 + w / 2, y0 + h / 2);
      }
    }
  }, [exEnabled, clusterSpread, selectedZoneIdx]);

  // Redraw when zones / draft / enabled / spread / selection changes
  useEffect(() => { drawExCanvas(exclusionZones, draftZone); },
    [exclusionZones, draftZone, exEnabled, clusterSpread, drawExCanvas, selectedZoneIdx, activeTab]);

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
  }, [uvOptions, uvOpacity, previewImage, texOpacity, activeTab]);

  // ── Mouse events — Draft / Confirm multi-zone pattern ─────────
  const getPosRelativeToCanvas = useCallback((clientX, clientY) => {
    const rect = exWrapRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left)  / rect.width,
      y: (clientY - rect.top)   / rect.height,
    };
  }, []);

  const onMouseDown = useCallback(e => {
    if (!exEnabled) return;
    e.preventDefault();
    const pos = getPosRelativeToCanvas(e.clientX, e.clientY);
    const sx = clamp01(pos.x), sy = clamp01(pos.y);
    exDragStart.current = { x: sx, y: sy };
    exDragging.current  = true;
    exDraft.current = { x0: sx, y0: sy, x1: sx, y1: sy };
    // Starting a new drag discards any pending draft
    setDraftZone(null);
    drawExCanvas(exclusionZones, null);
  }, [exEnabled, getPosRelativeToCanvas, drawExCanvas, exclusionZones]);

  // mousemove + mouseup on document — drag works outside canvas bounds
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
      // Zone must be large enough to be meaningful
      if (zone && (zone.x1 - zone.x0) > 0.01 && (zone.y1 - zone.y0) > 0.01) {
        setDraftZone({ ...zone });
      } else {
        setDraftZone(null);
        drawExCanvas(exclusionZones, null);
      }
      exDraft.current = null;
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

  // ── Inject stars as planets directly into data.lua ────────────
  const handleInjectStars = useCallback(async () => {
    const mapNameTrimmed = mapName.trim();
    const mapsFolder     = (settings?.mapsFolder || '').trim();

    if (!mapNameTrimmed) { await luxuryAlert('Please set a Map Name before injecting stars.', 'Map Name Required', 'warning'); return; }
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
      // Regex: finds planets = { ... } within the skyBox section.
      // Strategy: insert new entries before the last closing "        }," of the planets block.
      let dataLua = readRes.content;

      // Findet den planets-Block innerhalb von skyBox = { ... }
      // Greedy-match everything between "planets = {" and its closing "},",
      const planetsRegex = /(skyBox\s*=\s*\{[\s\S]*?planets\s*=\s*\{)([\s\S]*?)(\n        \},)/;
      if (!planetsRegex.test(dataLua)) throw new Error('planets section not found in skyBox.');

      dataLua = dataLua.replace(planetsRegex, (_, open, existing, close) => {
        return `${open}${existing}${newPlanetLua}${close}`;
      });

      // ── set version to 60 if not already 60 ────────────────────
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

      await luxuryAlert(`Successfully injected ${stars.length} stars into ${scmapEntry.name}.`, 'Stars Injected', 'success');
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

  const zoneWorldCoords = (zone) => {
    const spread = parseFloat(clusterSpread) || 14000;
    const toW = v => ((v*2-1)*spread).toFixed(0);
    return (
      `X ${toW(Math.min(zone.x0,zone.x1))} → ${toW(Math.max(zone.x0,zone.x1))}` +
      `   Z ${toW(Math.min(zone.y0,zone.y1))} → ${toW(Math.max(zone.y0,zone.y1))}`
    );
  };
  //  Build the skyBox Lua table string 
  //  Legacy JSON preview (Output tab) 
  const generateSkyboxFile = () => {
    const ms=parseFloat(mapSize)||1024, hH=parseFloat(horizonHeight)||0;
    const hRgba=hexToRgba(horizonColor), zRgba=hexToRgba(zenithColor), cRgba=hexToRgba(cirrusColor);
    const manualPlanets=planets.map(p=>({Position:{x:parseFloat(p.x),y:parseFloat(p.y),z:parseFloat(p.z)},Rotation:parseFloat(p.rotation),Scale:{x:parseFloat(p.scaleX),y:parseFloat(p.scaleY)},Uv:{x:parseFloat(p.uvX),y:parseFloat(p.uvY),z:parseFloat(p.uvZ),w:parseFloat(p.uvW)}}));
    const starPlanets=generateStarPlanets();
    const cirrusLayersData=cirrusLayers.map(l=>({frequency:{x:parseFloat(l.freqX),y:parseFloat(l.freqY)},Speed:parseFloat(l.speed),Direction:{x:parseFloat(l.dirX),y:parseFloat(l.dirY)}}));
    const copyright=[
      "============================================================",
      " ForgeMapToolkit Assets — Skybox Preset",
      " Copyright (c) 2026 timmasalme",
      "============================================================",
      "",
      " LICENSE: Creative Commons Attribution-NonCommercial 4.0",
      "          International (CC BY-NC 4.0)",
      "",
      " You are free to:",
      "   - Share  — copy and redistribute this file in any medium",
      "   - Adapt  — remix, transform, and build upon this material",
      "",
      " Under the following terms:",
      "   - NonCommercial — You may not use this material for",
      "                     commercial purposes.",
      "   - No additional restrictions — You may not apply legal",
      "                     terms or technological measures that",
      "                     legally restrict others from doing",
      "                     anything the license permits.",
      "",
      " This copyright block must remain intact in all copies",
      " and derivative works.",
      "",
      " Full license: https://creativecommons.org/licenses/by-nc/4.0/",
      " Repository:   https://github.com/timmasalme/ForgeMapToolkit-Assets",
      "============================================================"
    ];
    return JSON.stringify({Data:{_copyright:copyright,Position:{x:ms/2,y:hH,z:ms/2},Scale:scale,SubtractHeight:parseFloat(subtractHeight),SubdivisionsAxis:parseInt(subdivAxis),SubdivisionsHeight:parseInt(subdivHeight),HorizonHeight:hH,ZenithHeight:parseFloat(zenithHeight),HorizonColor:hRgba,ZenithColor:zRgba,DecalGlowMultiplier:parseFloat(decalGlowMult),Albedo:albedo,Glow:glow,Planets:[...manualPlanets,...starPlanets],MidRgbColor:{r:0,g:0,b:0,a:0},CirrusMultiplier:parseFloat(cirrusMult),CirrusColor:{r:cRgba.r,g:cRgba.g,b:cRgba.b,a:1.0},CirrusTexture:cirrusTexture,CirrusLayers:cirrusLayersData,Clouds7:0.0}},null,4);
  };

  //  Export .scmskybox file (raw, no SCMAP modification) ───────────────────
  const handleExportScmskybox = async () => {
    if (!mapName || !mapName.trim()) {
      await luxuryAlert('Please enter a Map Name before exporting.', 'Map Name Required', 'warning'); return;
    }
    const mapsFolder = (mapsFolderPath || '').trim();
    if (!mapsFolder) {
      await luxuryAlert('Maps Folder is not configured. Please set it in Settings.', 'Maps Folder Not Set', 'warning'); return;
    }

    const finalName     = /\.v\d{4}$/.test(mapName.trim()) ? mapName.trim() : mapName.trim() + '.v0001';
    const mapFolderPath = `${mapsFolder}\\${finalName}`;

    try {
      const content = generateSkyboxFile();

      const dirEntries = await window.electronAPI.invoke('list-dir', { dirPath: mapFolderPath });
      let maxIdx = 0, hasSingle = false;
      for (const e of (dirEntries?.entries || [])) {
        if (e.name === 'skybox_export.scmskybox') hasSingle = true;
        const m = e.name.match(/^skybox_export(\d+)\.scmskybox$/);
        if (m) maxIdx = Math.max(maxIdx, parseInt(m[1]));
      }
      const fileName = maxIdx > 0 ? `skybox_export${maxIdx + 1}.scmskybox`
                     : hasSingle  ? `skybox_export1.scmskybox`
                     : `skybox_export.scmskybox`;

      const writeRes = await window.electronAPI.invoke('write-file', {
        filePath: `${mapFolderPath}\\${fileName}`,
        content,
      });
      if (!writeRes?.success) throw new Error(`Could not write file: ${writeRes?.error}`);

      if (generateReadme) {
        const ms_rm    = parseFloat(mapSize) || 1024;
        const km_rm    = ms_rm * (20 / 1024);
        const kmStr_rm = Number.isInteger(km_rm) ? `${km_rm}×${km_rm}` : `${km_rm.toFixed(1)}×${km_rm.toFixed(1)}`;

        const cirrusLines = [];
        cirrusLayers.forEach((l, i) => {
          cirrusLines.push(`    [${i + 1}] freq(${l.freqX}, ${l.freqY})  speed: ${l.speed}  dir(${l.dirX}, ${l.dirY})`);
        });
        const planetLines = [];
        planets.forEach((p, i) => {
          planetLines.push(`    [${String(i + 1).padStart(2, '0')}] pos(${p.x}, ${p.y}, ${p.z})  scale(${p.scaleX}, ${p.scaleY})  rot: ${p.rotation}`);
        });

        const readmeContent = buildReadme({
          tool:    'Skybox Generator',
          mapName: finalName,
          mapSize: `${ms_rm} × ${ms_rm} (${kmStr_rm} km)`,
          sections: [
            { title: 'SKYBOX SETTINGS', entries: [
              ['Horizon Height',  horizonHeight],
              ['Zenith Height',   zenithHeight],
              ['Horizon Color',   horizonColor],
              ['Zenith Color',    zenithColor],
              ['Scale',           scale],
              ['Subtract Height', subtractHeight],
              ['Subdiv Axis',     subdivAxis],
              ['Subdiv Height',   subdivHeight],
              ['Decal Glow Mult', decalGlowMult],
              ['Albedo Texture',  albedo],
              ['Glow Texture',    glow],
            ]},
            { title: 'CIRRUS SETTINGS', lines: [
              `  Cirrus Multiplier  : ${cirrusMult}`,
              `  Cirrus Color       : ${cirrusColor}`,
              `  Cirrus Texture     : ${cirrusTexture}`,
              `  Cirrus Layers      : ${cirrusLayers.length}`,
              ...cirrusLines,
            ]},
            { title: 'PLANETS / STARS', lines: [
              `  Manual planets     : ${planets.length}`,
              ...planetLines,
            ]},
            { title: 'OUTPUT', lines: [
              `  File       : ${fileName}`,
              `  Location   : ${mapFolderPath}\\`,
            ]},
          ],
          footer: ['Generated by ForgeMapToolkit · timmasalme'],
        });
        await writeReadme(`${mapFolderPath}\\Skybox_Generation_README.txt`, readmeContent);
      }

      await luxuryAlert(`✓ Skybox exported to ${fileName}${generateReadme ? '\n✓ README written to map folder' : ''}`, 'Exported', 'success');
    } catch (e) {
      console.error('[Skybox export scmskybox]', e);
      await luxuryAlert(e.message, 'Export Failed', 'error');
    }
  };

  //  SCMAP inject: skyBox direkt in .scmap patchen 
  const handleInjectSkybox = async () => {
    if (!mapName || !mapName.trim()) {
      await luxuryAlert('Please enter a Map Name before injecting.', 'Map Name Required', 'warning'); return;
    }
    const mapsFolder = (mapsFolderPath || '').trim();
    if (!mapsFolder) {
      await luxuryAlert('Maps Folder is not configured. Please set it in Settings.', 'Maps Folder Not Set', 'warning'); return;
    }

    const finalName     = /\.v\d{4}$/.test(mapName.trim()) ? mapName.trim() : mapName.trim() + '.v0001';
    const mapFolderPath = `${mapsFolder}\\${finalName}`;

    try {
      //  1. .scmap finden 
      const dirEntries = await window.electronAPI.invoke('list-dir', { dirPath: mapFolderPath });
      if (!dirEntries?.success) throw new Error('Map folder could not be read.');
      const scmapEntry = dirEntries.entries.find(e => !e.isDirectory && e.name.toLowerCase().endsWith('.scmap'));
      if (!scmapEntry) throw new Error(`No .scmap file found in ${mapFolderPath}.`);
      const scmapPath = `${mapFolderPath}\\${scmapEntry.name}`;

      //  2. Entpacken (wie Props.jsx) 
      const unpackRes = await window.electronAPI.invoke('scmap-unpack', { scmapPath });
      if (!unpackRes.success) throw new Error(`Unpack fehlgeschlagen: ${unpackRes.error}`);
      const unpackedFolder = unpackRes.outputFolder;

      //  HISTORY: snapshot BEFORE 
      const snapBeforeRes = await window.electronAPI.invoke('scmap-snapshot-folder', { folderPath: unpackedFolder });
      const snapBefore = snapBeforeRes?.snapshot ?? null;

      //  3. data.lua lesen 
      const dataLuaPath = `${unpackedFolder}\\data.lua`;
      const readRes = await window.electronAPI.invoke('read-file', { path: dataLuaPath });
      if (!readRes?.success) throw new Error(`data.lua could not be read: ${readRes?.error}`);

      //  4. skyBox-Werte als Lua-String bauen und data.lua patchen 
      const ms = parseFloat(mapSize) || 1024;
      const hH = parseFloat(horizonHeight) || 0;
      const hC = hexToRgba(horizonColor);
      const zC = hexToRgba(zenithColor);
      const cC = hexToRgba(cirrusColor);

      const f  = (v, fb = 0) => { const n = parseFloat(v); return isNaN(n) ? fb : n; };

      const manualPlanets = planets.map(p => ({
        position: [f(p.x), f(p.y), f(p.z)],
        rotation: f(p.rotation),
        scale:    [f(p.scaleX, 1), f(p.scaleY, 1)],
        uv:       [f(p.uvX), f(p.uvY), f(p.uvZ, 0.5), f(p.uvW, 0.5)],
      }));
      const starPlanets = generateStarPlanets()
        .filter(s => !isNaN(s.Position.x) && !isNaN(s.Position.y) && !isNaN(s.Position.z))
        .map(s => ({
          position: [s.Position.x, s.Position.y, s.Position.z],
          rotation: s.Rotation,
          scale:    [s.Scale.x, s.Scale.y],
          uv:       [s.Uv.x, s.Uv.y, s.Uv.z, s.Uv.w],
        }));
      const allPlanets = [...manualPlanets, ...starPlanets];

      // Lua-Zahlen-Formatter
      const n = v => String(v);
      const nc = v => { const x = parseFloat(v); return isNaN(x) ? '0' : x.toFixed(6).replace(/\.?0+$/, '') || '0'; };

      let planetLua = '';
      for (const p of allPlanets) {
        planetLua += `        {\n            position = { ${n(p.position[0])}, ${n(p.position[1])}, ${n(p.position[2])}, },\n            rotation = ${n(p.rotation)},\n            scale = { ${n(p.scale[0])}, ${n(p.scale[1])}, },\n            uv = { ${n(p.uv[0])}, ${n(p.uv[1])}, ${n(p.uv[2])}, ${n(p.uv[3])}, },\n        },\n`;
      }

      let cirrusLua = '';
      for (const l of cirrusLayers) {
        cirrusLua += `        {\n            direction = { ${f(l.dirX)}, ${f(l.dirY)}, },\n            frequency = { ${f(l.freqX)}, ${f(l.freqY)}, },\n            speed = ${f(l.speed)},\n        },\n`;
      }

      const skyboxLuaBlock = `    skyBox = {\n        albedo = "${albedo}",\n        cirrusColor = { ${nc(cC.r)}, ${nc(cC.g)}, ${nc(cC.b)}, },\n        cirrusLayers = {\n${cirrusLua}        },\n        cirrusMultiplier = ${f(cirrusMult)},\n        cirrusTexture = "${cirrusTexture}",\n        clouds7 = 0,\n        decalGlowMultiplier = ${f(decalGlowMult)},\n        glow = "${glow}",\n        horizonColor = { ${nc(hC.r)}, ${nc(hC.g)}, ${nc(hC.b)}, },\n        horizonHeight = ${hH},\n        midColor = { 0, 0, 0, },\n        planets = {\n${planetLua}        },\n        position = { ${ms / 2}, 0, ${ms / 2}, },\n        scale = ${(ms * 2.288)},\n        subDivAx = ${parseInt(subdivAxis) || 16},\n        subDivHeight = ${parseInt(subdivHeight) || 6},\n        subHeight = ${f(subtractHeight, 1.2566)},\n        zenithColor = { ${nc(zC.r)}, ${nc(zC.g)}, ${nc(zC.b)}, },\n        zenithHeight = ${f(zenithHeight, 256)},\n    }`;

      // Replace skyBox = { ... } in data.lua
      let dataLua = readRes.content;
      const skyboxRegex = /skyBox = \{[\s\S]*?\n    \}/;
      if (skyboxRegex.test(dataLua)) {
        // skyBox block found → replace
        dataLua = dataLua.replace(skyboxRegex, skyboxLuaBlock);
      } else {
        // skyBox block missing (e.g. version 56) → insert after size/shaderPath block
        const insertAfterRegex = /([ \t]*\},\s*\n[ \t]*shaderPath\s*=\s*"[^"]*",\s*\n[ \t]*size\s*=\s*\{[\s\S]*?\},\s*\n)/;
        if (insertAfterRegex.test(dataLua)) {
          dataLua = dataLua.replace(insertAfterRegex, `$1\n${skyboxLuaBlock},\n`);
        } else {
          throw new Error('skyBox section not found and insert anchor (shaderPath/size) not found.');
        }
      }

      // ── set version to 60 if not already 60 ────────────────────
      dataLua = dataLua.replace(/(\bversion\s*=\s*)(\d+)(\s*,)/, (m, pre, num, post) => {
        return parseInt(num, 10) !== 60 ? `${pre}60${post}` : m;
      });

      //  5. data.lua zurückschreiben 
      const writeRes = await window.electronAPI.invoke('write-file', { filePath: dataLuaPath, content: dataLua });
      if (!writeRes?.success) throw new Error(`data.lua schreiben fehlgeschlagen: ${writeRes?.error}`);

      //  HISTORY: snapshot AFTER 
      const snapAfterRes = await window.electronAPI.invoke('scmap-snapshot-folder', { folderPath: unpackedFolder });
      const snapAfter = snapAfterRes?.snapshot ?? null;
      if (snapBefore && snapAfter) onRecordSnapshot('skybox-generator', finalName, snapBefore, snapAfter);

      //  6. Repack (wie Props.jsx) 
      const mapNameForPack = unpackedFolder.split(/[\\/]/).pop();
      const packRes = await window.electronAPI.invoke('scmap-pack', { mapName: mapNameForPack });
      if (!packRes.success) throw new Error(`Pack fehlgeschlagen: ${packRes.error}`);

      //  7. .scmap zurückkopieren (wie Props.jsx) 
      const copyRes = await window.electronAPI.invoke('copy-file', { src: packRes.outputPath, dest: scmapPath });
      if (!copyRes?.success) throw new Error('Repacked .scmap could not be copied back.');

      // Auto-open
      const currentSettings = await window.electronAPI.invoke('settings-load');
      if (currentSettings?.autoOpenExportFolder) {
        await window.electronAPI.invoke('open-folder', { folderPath: mapFolderPath });
      }

      if (generateReadme) {
        const km_rm2    = ms * (20 / 1024);
        const kmStr_rm2 = Number.isInteger(km_rm2) ? `${km_rm2}×${km_rm2}` : `${km_rm2.toFixed(1)}×${km_rm2.toFixed(1)}`;

        const cirrusLines2 = [];
        cirrusLayers.forEach((l, i) => {
          cirrusLines2.push(`    [${i + 1}] freq(${l.freqX}, ${l.freqY})  speed: ${l.speed}  dir(${l.dirX}, ${l.dirY})`);
        });
        const planetLines2 = [];
        planets.forEach((p, i) => {
          planetLines2.push(`    [${String(i + 1).padStart(2, '0')}] pos(${p.x}, ${p.y}, ${p.z})  scale(${p.scaleX}, ${p.scaleY})  rot: ${p.rotation}`);
        });

        const readmeContent2 = buildReadme({
          tool:    'Skybox Generator',
          mapName: finalName,
          mapSize: `${ms} × ${ms} (${kmStr_rm2} km)`,
          sections: [
            { title: 'MAP SETTINGS (extra)', entries: [['SCMAP File', `${scmapEntry.name}  ← repacked`]] },
            { title: 'SKYBOX SETTINGS', entries: [
              ['Horizon Height',  horizonHeight],
              ['Zenith Height',   zenithHeight],
              ['Horizon Color',   horizonColor],
              ['Zenith Color',    zenithColor],
              ['Scale',           scale],
              ['Subtract Height', subtractHeight],
              ['Subdiv Axis',     subdivAxis],
              ['Subdiv Height',   subdivHeight],
              ['Decal Glow Mult', decalGlowMult],
              ['Albedo Texture',  albedo],
              ['Glow Texture',    glow],
            ]},
            { title: 'CIRRUS SETTINGS', lines: [
              `  Cirrus Multiplier  : ${cirrusMult}`,
              `  Cirrus Color       : ${cirrusColor}`,
              `  Cirrus Texture     : ${cirrusTexture}`,
              `  Cirrus Layers      : ${cirrusLayers.length}`,
              ...cirrusLines2,
            ]},
            { title: 'PLANETS / STARS', lines: [
              `  Manual planets     : ${planets.length}`,
              ...planetLines2,
            ]},
            { title: 'OUTPUT', lines: [
              `  File       : ${scmapEntry.name}  (injected)`,
              `  Location   : ${mapFolderPath}\\`,
            ]},
          ],
          footer: ['Generated by ForgeMapToolkit · timmasalme'],
        });
        await writeReadme(`${mapFolderPath}\\Skybox_Generation_README.txt`, readmeContent2);
      }

      await luxuryAlert(`Skybox successfully injected into ${scmapEntry.name}.${generateReadme ? '\n✓ README written to map folder' : ''}`, 'Skybox Injected', 'success');
    } catch (e) {
      console.error('[Skybox inject]', e);
      await luxuryAlert(e.message, 'Skybox Inject Failed', 'error');
    }
  };
  const applyLibrarySkybox = async (skybox, resolutions = {}) => {
  //  Parse .scmskybox Data block 
  const raw = skybox.scmskyboxData;
  const d   = raw?.Data || raw?.data || raw || {};

  // Helpers to convert color objects {r,g,b,a} -> hex
  const toHex = (c) => {
    if (!c) return '#000000';
    if (typeof c === 'string') return c;
    // HDR: proportional herunterskalieren statt hart abschneiden
    const maxCh = Math.max(c.r || 0, c.g || 0, c.b || 0, 1.0);
    const norm = v => Math.round(((v || 0) / maxCh) * 255);
    const r = Math.max(0, Math.min(255, norm(c.r))).toString(16).padStart(2, '0');
    const g = Math.max(0, Math.min(255, norm(c.g))).toString(16).padStart(2, '0');
    const b = Math.max(0, Math.min(255, norm(c.b))).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  };
  const toStr = (v, fallback = '') => v !== undefined && v !== null ? String(v) : fallback;

  //  Scale the library values to the current map size
  // All library skyboxes are normalized to 1024 units (20x20 map).
  // HorizonHeight, ZenithHeight scale proportionally with map size.
  // CirrusFrequency scales inversely (bigger map = lower frequency needed).
  const REF_SIZE    = 1024;
  const curSize     = parseFloat(mapSize) || REF_SIZE;
  const scaleFactor = curSize / REF_SIZE;   // >1 for bigger maps, <1 for smaller

  //  Atmosphere — heights scaled to current map 
  setHorizonColor(toHex(d.HorizonColor));
  setZenithColor(toHex(d.ZenithColor));
  setHorizonHeight(String(Math.round((parseFloat(d.HorizonHeight) || -42.5) * scaleFactor)));
  setZenithHeight(String(Math.round((parseFloat(d.ZenithHeight) || 293.507) * scaleFactor)));
  setSubtractHeight(toStr(d.SubtractHeight, '1.2566'));
  setSubdivAxis(toStr(d.SubdivisionsAxis, '16'));
  setSubdivHeight(toStr(d.SubdivisionsHeight, '6'));
  setDecalGlowMult(toStr(d.DecalGlowMultiplier, '0.1'));

  //  Textures — rewrite paths for custom skyboxes 
  if (skybox.isCustom && mapName && mapsFolderPath) {
    const finalName = /\.v\d{4}$/.test(mapName) ? mapName : mapName + '.v0001';
    const skyDir    = `/maps/${finalName}/env/skybox`;
    const sn        = skybox.skyboxName; // e.g. "Blackhole"
    const albedoSuffix = resolutions.albedoRes ? `_${resolutions.albedoRes}` : '';
    const glowSuffix   = resolutions.glowRes   ? `_${resolutions.glowRes}`   : '';

    setAlbedo(`${skyDir}/${sn}${albedoSuffix}.dds`);
    setGlow(`${skyDir}/${sn}_glow${glowSuffix}.dds`);

    // Check if aurora.dds is among required files
    const hasAurora = skybox.requiredFiles?.some(f => f.destFile === 'aurora.dds');
    setCirrusTexture(hasAurora ? `${skyDir}/aurora.dds` : toStr(d.CirrusTexture, '/textures/environment/cirrus000.dds'));
  } else {
    // Normal skybox — use paths as-is from the file
    setAlbedo(toStr(d.Albedo, '/textures/environment/Decal_test_Albedo003.dds'));
    setGlow(toStr(d.Glow, '/textures/environment/Decal_test_Glow003.dds'));
    setCirrusTexture(toStr(d.CirrusTexture, '/textures/environment/cirrus000.dds'));
  }

  //  Cirrus 
  setCirrusMult(toStr(d.CirrusMultiplier, '1.8'));
  setCirrusColor(toHex(d.CirrusColor));

  // CirrusLayers from file — frequency scales inversely with map size
  const freqFactor = REF_SIZE / curSize; // inverse: bigger map = lower frequency
  const speedFactor = curSize / REF_SIZE; // proportional: bigger map = faster scroll
  const fileLayers = (d.CirrusLayers || []).map((l, i) => ({
    id:    i + 1,
    freqX: ((l.frequency?.x ?? l.FrequencyX ?? 0.0001) * freqFactor),
    freqY: ((l.frequency?.y ?? l.FrequencyY ?? 0.0001) * freqFactor),
    speed: ((l.Speed ?? l.speed ?? 0) * speedFactor),
    dirX:  l.Direction?.x ?? l.DirectionX ?? 1,
    dirY:  l.Direction?.y ?? l.DirectionY ?? 0,
  }));
  if (fileLayers.length > 0) setCirrusLayers(fileLayers);

  //  Planets — map nested library format { Position, Rotation, Scale, Uv } to flat state format
  if (d.Planets?.length) {
    const mapped = d.Planets.map((p, i) => ({
      id:       Date.now() + i + Math.random(),
      x:        String(p.Position?.x ?? p.x ?? 2190.0),
      y:        String(p.Position?.y ?? p.y ?? 570.0),
      z:        String(p.Position?.z ?? p.z ?? -1020.0),
      rotation: String(p.Rotation  ?? p.rotation ?? -1.585),
      scaleX:   String(p.Scale?.x  ?? p.scaleX   ?? 183.0),
      scaleY:   String(p.Scale?.y  ?? p.scaleY   ?? 183.0),
      uvX:      String(p.Uv?.x     ?? p.uvX      ?? 0.0),
      uvY:      String(p.Uv?.y     ?? p.uvY      ?? 0.5),
      uvZ:      String(p.Uv?.z     ?? p.uvZ      ?? 0.5),
      uvW:      String(p.Uv?.w     ?? p.uvW      ?? 0.5),
    }));
    setPlanets(mapped);
  }

  setShowSkyboxLibrary(false);

  //  Download DDS assets for custom skyboxes 
  if (skybox.isCustom && skybox.requiredFiles?.length) {
    if (!mapName || !mapsFolderPath) {
      await luxuryAlert('This skybox requires texture files to be copied to your map folder. Please set Map Name and Maps Folder first, then re-apply.', 'Map Context Required', 'warning');
      setActiveTab('skybox');
      return;
    }
    const finalName = /\.v\d{4}$/.test(mapName) ? mapName : mapName + '.v0001';
    const mapRoot   = mapsFolderPath.replace(/\\/g, '/').replace(/\/$/, '') + '/' + finalName;
    const destDir   = `${mapRoot}/env/skybox`;

    const results = await Promise.all(skybox.requiredFiles
      .filter(({ type, resolution }) => {
        // Keep only the files matching the chosen resolution per type.
        // Falls back to including all if no resolution info (legacy flat list).
        if (!type || !resolution) return true;
        if (type === 'albedo') return resolution === resolutions.albedoRes;
        if (type === 'glow')   return resolution === resolutions.glowRes;
        return true; // aurora.dds or other non-typed files always included
      })
      .map(async ({ src, destFile }) => {
      const url      = `${ASSETS_RAW}/${src}`;
      const destPath = `${destDir}/${destFile}`;
      const res      = await window.electronAPI.invoke('download-file', { url, dest: destPath });
      return { file: destFile, success: res.success, error: res.error };
    }));

    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      await luxuryAlert(`${failed.length} file(s) could not be downloaded:\n` + failed.map(f => `${f.file}: ${f.error}`).join('\n'), 'Download Failed', 'error');
    } else {
      console.log(`[SkyboxLib] Downloaded ${results.length} DDS file(s) into ${destDir}`);
    }
  }

  setActiveTab('skybox');
};


  // ── generateStarPlanets: wraps buildStars into the object format
  //    expected by generateSkyboxFile() and handleInjectSkybox() ──
  const generateStarPlanets = useCallback(() => {
    const n = parseInt(numStars) || 50;
    try {
      const stars = buildStars(n);
      return stars.map(s => ({
        Position: { x: s.x, y: s.y, z: s.z },
        Rotation: s.rotation,
        Scale:    { x: s.scale, y: s.scale },
        Uv:       { x: s.uv.x, y: s.uv.y, z: s.uv.z, w: s.uv.w },
      }));
    } catch (e) {
      console.warn('[generateStarPlanets]', e.message);
      return [];
    }
  }, [buildStars, numStars]);

  const stParsedUvs = parseUvOptions(uvOptions);
  const sphereLerp = Math.max(0, Math.min(1, 1-(parseFloat(subtractHeight)||1.2566)*2/Math.PI));

  return (
    <div className="skybox-tab tab-scrollbar">
      {domeFullscreen && ReactDOM.createPortal(
        <FullscreenDome horizonColor={horizonColor} setHorizonColor={setHorizonColor} zenithColor={zenithColor} setZenithColor={setZenithColor} horizonHeight={horizonHeight} setHorizonHeight={setHorizonHeight} zenithHeight={zenithHeight} setZenithHeight={setZenithHeight} subtractHeight={subtractHeight} subdivHeight={subdivHeight} scale={scale} showLabels={showDomeLabels} setShowLabels={setShowDomeLabels} onClose={()=>setDomeFullscreen(false)}/>,
        document.body
      )}


      {showSkyboxLibrary && (
        <SkyboxLibraryOverlay
          onClose={() => setShowSkyboxLibrary(false)}
          onApply={applyLibrarySkybox}
          onReload={() => loadSkyboxLibrary({ forceRefresh: true })}
          categories={skyboxCategories}
          loading={skyboxLibLoading}
          mapName={mapName}
          mapsFolderPath={mapsFolderPath}
        />
      )}

      <div style={{maxWidth:'1800px',margin:'0 auto'}}>
        <div className="skybox-tabs">
          <button
  className="skybox-tab-btn"
  onClick={() => openSkyboxLibrary()}
  style={{ borderColor: 'rgba(59, 118, 255, 0.35)', color: 'var(--skybox-generator-color)' }}>
   Library
</button>
          <button className={`skybox-tab-btn ${activeTab==='skybox'?'active':''}`} onClick={()=>setActiveTab('skybox')}>Atmosphere</button>
          <button className={`skybox-tab-btn ${activeTab==='cirrus'?'active':''}`} onClick={()=>setActiveTab('cirrus')}>Cirrus</button>
          <button className={`skybox-tab-btn ${activeTab==='planets'?'active':''}`} onClick={()=>setActiveTab('planets')}>Planets</button>
          <button className={`skybox-tab-btn ${activeTab==='stars'?'active':''}`} onClick={()=>setActiveTab('stars')}>Stars</button>
          <button className={`skybox-tab-btn ${activeTab==='output'?'active':''}`} onClick={()=>setActiveTab('output')}>Output</button>
        </div>
      </div>


      <div className="skybox-main-grid">
        <div>

          {/*  ATMOSPHERE TAB  */}
          {activeTab==='skybox' && (<>
            <div className="skybox-section-card">
              <h2 className="skybox-section-title">Map Context</h2>
              <div className="skybox-form-row">
                <div className="skybox-form-group">
                  <label>Map Name</label>
                  <input className="skybox-input" value={mapName} onChange={e => setMapName(e.target.value)} placeholder="Hades_Dust.v0002"/>
                  {mapName && (
                    <p className="skybox-form-help">
                       …/{/\.v\d{4}$/.test(mapName) ? mapName : mapName + '.v0001'}/env/skybox/
                    </p>
                  )}
                  <p className="skybox-form-help" style={{marginTop: mapName ? 2 : 0}}>
                    {mapSizeSource === 'auto'
                      ? <>Map Size: <strong>{mapSize}</strong> · Scale: <strong>{scale.toFixed(0)}</strong></>
                      : <span style={{color:'rgba(255,255,255,0.35)'}}>Map size auto-read from scenario.lua once Map Name is set</span>
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="skybox-section-card">
              <h2 className="skybox-section-title">Scale & Dome</h2>
              <div className="skybox-form-row">
                <div className="skybox-form-group"><label>Subtract Height</label><input className="skybox-input" value={subtractHeight} onChange={e=>setSubtractHeight(e.target.value)} placeholder="1.2566"/></div>
              </div>
              <div className="skybox-form-row">
                <div className="skybox-form-group"><label>Subdivisions Axis</label><input className="skybox-input" value={subdivAxis} onChange={e=>setSubdivAxis(e.target.value)} placeholder="64"/></div>
                <div className="skybox-form-group"><label>Subdivisions Height</label><input className="skybox-input" value={subdivHeight} onChange={e=>setSubdivHeight(e.target.value)} placeholder="64"/></div>
              </div>
            </div>

            <div className="skybox-section-card">
              <h2 className="skybox-section-title">Colors & Heights</h2>
              <div className="skybox-form-row">
                <div className="skybox-form-group"><label>Horizon Color</label><ColorPicker value={horizonColor} onChange={e=>setHorizonColor(e.target.value)} /></div>
                <div className="skybox-form-group"><label>Zenith Color</label><ColorPicker value={zenithColor} onChange={e=>setZenithColor(e.target.value)} /></div>
              </div>
              <div className="skybox-form-row">
                <div className="skybox-form-group">
                  <label>Horizon Height</label>
                  <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                    <RangeSlider min="-500" max="500" step="0.5" value={parseFloat(horizonHeight)||0} onChange={e=>setHorizonHeight(e.target.value)} />
                    <input className="skybox-input" style={{width:'90px',flex:'none'}} value={horizonHeight} onChange={e=>setHorizonHeight(e.target.value)} placeholder="-50"/>
                  </div>
                </div>
                <div className="skybox-form-group">
                  <label>Zenith Height</label>
                  <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                    <RangeSlider min="-500" max="1000" step="0.5" value={parseFloat(zenithHeight)||256} onChange={e=>setZenithHeight(e.target.value)} />
                    <input className="skybox-input" style={{width:'90px',flex:'none'}} value={zenithHeight} onChange={e=>setZenithHeight(e.target.value)} placeholder="100"/>
                  </div>
                </div>
              </div>
              <div className="skybox-form-group"><label>Decal Glow Multiplier</label><input className="skybox-input" value={decalGlowMult} onChange={e=>setDecalGlowMult(e.target.value)} placeholder="0.1"/></div>
            </div>

            <div className="skybox-section-card">
              <h2 className="skybox-section-title">Textures</h2>
              <div className="skybox-form-group"><label>Albedo Texture</label><input className="skybox-input" value={albedo} onChange={e=>setAlbedo(e.target.value)}/></div>
              <div className="skybox-form-group"><label>Glow Texture</label><input className="skybox-input" value={glow} onChange={e=>setGlow(e.target.value)}/></div>
            </div>
          </>)}

          {/*  PLANETS TAB  */}
          {activeTab==='planets' && (<>
            <div className="skybox-section-card">
              <h2 className="skybox-section-title">Planets ({planets.length})</h2>
              {planets.map((p,i)=>(
                <div className="planet-row" key={p.id}>
                  <div className="planet-row-header"><span className="planet-row-label">Planet #{i+1}</span><button className="btn-delete-sm sm" onClick={()=>removePlanet(p.id)}>×</button></div>
                  <div className="skybox-form-row-3">
                    {[['x','X',p.x,'Horizontal'],['y','Y',p.y,'Height'],['z','Z',p.z,'Depth']].map(([f,lbl,val,hint])=>(
                      <div className="skybox-form-group" key={f}><label>Pos {lbl}</label><input className="skybox-input" value={val} onChange={e=>updatePlanet(p.id,f,e.target.value)}/></div>
                    ))}
                  </div>
                  <div className="skybox-form-row-3">
                    <div className="skybox-form-group"><label>Rotation</label><input className="skybox-input" value={p.rotation} onChange={e=>updatePlanet(p.id,'rotation',e.target.value)}/></div>
                    <div className="skybox-form-group"><label>Scale X</label><input className="skybox-input" value={p.scaleX} onChange={e=>updatePlanet(p.id,'scaleX',e.target.value)}/></div>
                    <div className="skybox-form-group"><label>Scale Y</label><input className="skybox-input" value={p.scaleY} onChange={e=>updatePlanet(p.id,'scaleY',e.target.value)}/></div>
                  </div>
                  <div className="skybox-form-row-4">
                    {[['uvX','UV X',p.uvX],['uvY','UV Y',p.uvY],['uvZ','UV Z',p.uvZ],['uvW','UV W',p.uvW]].map(([f,lbl,val])=>(
                      <div className="skybox-form-group" key={f}><label>{lbl}</label><input className="skybox-input" value={val} onChange={e=>updatePlanet(p.id,f,e.target.value)}/></div>
                    ))}
                  </div>
                </div>
              ))}
              <button className="btn-ghost" onClick={addPlanet}>+ Add Planet</button>
            </div>
          </>)}

          {/*  CIRRUS TAB  */}
          {activeTab==='cirrus' && (<>
            <div className="skybox-section-card">
              <h2 className="skybox-section-title">Cirrus Clouds</h2>
              <div className="skybox-form-row">
                <div className="skybox-form-group"><label>Cirrus Multiplier</label><input className="skybox-input" value={cirrusMult} onChange={e=>setCirrusMult(e.target.value)} placeholder="2"/></div>
                <div className="skybox-form-group"><label>Cirrus Color</label><ColorPicker value={cirrusColor} onChange={e=>setCirrusColor(e.target.value)} /></div>
              </div>
              <div className="skybox-form-group"><label>Cirrus Texture</label><input className="skybox-input" value={cirrusTexture} onChange={e=>setCirrusTexture(e.target.value)}/></div>
              <hr className="skybox-divider"/>

              {/* ── Preset picker ────────────────────────────────────────── */}
              <div style={{marginBottom:'18px'}}>
                <div style={{
                  fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.12em',
                  textTransform:'uppercase', color:'rgba(255,255,255,0.28)',
                  marginBottom:'8px',
                }}>Presets</div>

                {/* Builtin presets row */}
                <div style={{display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'6px'}}>
                  {CIRRUS_BUILTIN_PRESETS.map(preset => {
                    const isActive = activePresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        title={isActive ? 'Double-click to deactivate' : `Apply "${preset.label}" preset`}
                        onClick={() => applyPreset(preset)}
                        style={{
                          padding:'5px 11px',
                          fontSize:'0.72rem',
                          fontWeight: isActive ? 700 : 500,
                          fontFamily:'inherit',
                          letterSpacing:'0.04em',
                          cursor:'pointer',
                          border: isActive
                            ? '1px solid var(--skybox-generator-color, #3b76ff)'
                            : '1px solid rgba(255,255,255,0.12)',
                          background: isActive
                            ? 'color-mix(in srgb, var(--skybox-generator-color, #3b76ff) 14%, transparent)'
                            : 'rgba(255,255,255,0.04)',
                          color: isActive
                            ? 'var(--skybox-generator-color, #3b76ff)'
                            : 'rgba(255,255,255,0.5)',
                          transition:'all 0.15s',
                          borderRadius:'0',
                          outline:'none',
                        }}
                      >
                        {isActive && <span style={{marginRight:'5px', fontSize:'0.65rem'}}>✓</span>}
                        {preset.label}
                      </button>
                    );
                  })}

                  {/* Custom presets */}
                  {customPresets.map(preset => {
                    const isActive = activePresetId === preset.id;
                    return (
                      <div key={preset.id} style={{display:'flex', alignItems:'stretch', gap:'0'}}>
                        <button
                          title={isActive ? 'Double-click to deactivate' : `Apply "${preset.label}"`}
                          onClick={() => applyPreset(preset)}
                          style={{
                            padding:'5px 10px',
                            fontSize:'0.72rem',
                            fontWeight: isActive ? 700 : 500,
                            fontFamily:'inherit',
                            letterSpacing:'0.04em',
                            cursor:'pointer',
                            border: isActive
                              ? '1px solid rgba(251,146,60,0.7)'
                              : '1px solid rgba(255,255,255,0.12)',
                            borderRight: 'none',
                            background: isActive
                              ? 'rgba(251,146,60,0.10)'
                              : 'rgba(255,255,255,0.04)',
                            color: isActive ? '#fb923c' : 'rgba(255,255,255,0.5)',
                            transition:'all 0.15s',
                            outline:'none',
                          }}
                        >
                          {isActive && <span style={{marginRight:'5px', fontSize:'0.65rem'}}>✓</span>}
                          {preset.label}
                        </button>
                        <button
                          title="Delete this custom preset"
                          onClick={() => deleteCustomPreset(preset.id)}
                          style={{
                            padding:'5px 7px',
                            fontSize:'0.68rem',
                            fontFamily:'inherit',
                            cursor:'pointer',
                            border:'1px solid rgba(255,255,255,0.12)',
                            background:'rgba(255,255,255,0.04)',
                            color:'rgba(255,255,255,0.3)',
                            transition:'all 0.15s',
                            outline:'none',
                          }}
                          onMouseEnter={e=>{e.currentTarget.style.color='#ff6666';e.currentTarget.style.borderColor='rgba(255,68,68,0.5)';}}
                          onMouseLeave={e=>{e.currentTarget.style.color='rgba(255,255,255,0.3)';e.currentTarget.style.borderColor='rgba(255,255,255,0.12)';}}
                        >×</button>
                      </div>
                    );
                  })}

                  {/* Add Custom button */}
                  <button
                    title="Save current layers as a custom preset"
                    onClick={() => setShowSavePreset(v => !v)}
                    style={{
                      padding:'5px 11px',
                      fontSize:'0.72rem',
                      fontFamily:'inherit',
                      letterSpacing:'0.04em',
                      cursor:'pointer',
                      border:'1px dashed rgba(255,255,255,0.2)',
                      background:'transparent',
                      color:'rgba(255,255,255,0.35)',
                      transition:'all 0.15s',
                      outline:'none',
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.color='rgba(255,255,255,0.7)';e.currentTarget.style.borderColor='rgba(255,255,255,0.4)';}}
                    onMouseLeave={e=>{e.currentTarget.style.color='rgba(255,255,255,0.35)';e.currentTarget.style.borderColor='rgba(255,255,255,0.2)';}}
                  >+ Custom</button>
                </div>

                {/* Save custom preset — import panel */}
                {showSavePreset && (() => {
                  const parsed     = importText.trim() ? parseCirrusFromText(importText) : null;
                  const hasImport  = !!parsed;
                  const hasError   = importText.trim() && !parsed;
                  const layerCount = parsed?.layers?.length ?? 0;

                  // Derive drop-zone state class (mirrors ct-dropzone logic from Contributions)
                  const dzState = importDragOver ? 'dragging'
                                : hasImport      ? 'has-file'
                                : hasError       ? 'has-file invalid'
                                : '';

                  return (
                    <div style={{
                      marginTop:'6px',
                      background:'rgba(255,255,255,0.02)',
                      border:'1px solid rgba(255,255,255,0.08)',
                      padding:'10px 10px 8px',
                    }}>

                      {/* Drop / paste zone — styled after ct-dropzone */}
                      <div
                        onDragOver={e => { e.preventDefault(); setImportDragOver(true); }}
                        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setImportDragOver(false); }}
                        onDrop={e => {
                          e.preventDefault();
                          setImportDragOver(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = ev => { setImportText(ev.target.result); setImportError(''); };
                            reader.readAsText(file);
                          } else {
                            const text = e.dataTransfer.getData('text');
                            if (text) { setImportText(text); setImportError(''); }
                          }
                        }}
                        onPaste={e => {
                          const text = e.clipboardData.getData('text');
                          if (text) { setImportText(text); setImportError(''); e.preventDefault(); }
                        }}
                        tabIndex={0}
                        style={{
                          minHeight:'80px',
                          display:'flex', flexDirection:'column',
                          alignItems:'center', justifyContent:'center',
                          gap:'5px',
                          padding:'14px 12px',
                          marginBottom:'8px',
                          cursor:'default',
                          outline:'none',
                          position:'relative',
                          textAlign:'center',
                          transition:'all 0.35s cubic-bezier(0.23,1,0.32,1)',
                          // State-driven border + background (mirrors ct-dropzone states)
                          ...(importDragOver ? {
                            border:'1px solid var(--skybox-generator-color,#3b76ff)',
                            background:'color-mix(in srgb, var(--skybox-generator-color,#3b76ff) 5%, transparent)',
                            boxShadow:'0 0 18px color-mix(in srgb, var(--skybox-generator-color,#3b76ff) 25%, transparent), inset 0 0 18px color-mix(in srgb, var(--skybox-generator-color,#3b76ff) 3%, transparent)',
                          } : hasImport ? {
                            border:'1px solid rgba(74,222,128,0.45)',
                            background:'rgba(74,222,128,0.03)',
                            boxShadow:'none',
                          } : hasError ? {
                            border:'1px solid rgba(248,113,113,0.4)',
                            background:'rgba(248,113,113,0.03)',
                            boxShadow:'none',
                          } : {
                            border:'1px dashed rgba(255,255,255,0.1)',
                            background:'rgba(255,255,255,0.02)',
                            boxShadow:'none',
                          }),
                        }}
                      >
                        {!importText ? (<>
                          {/* Icon */}
                          <span style={{fontSize:'1.3rem', lineHeight:1, opacity: importDragOver ? 0.9 : 0.35}}>
                            {importDragOver ? '↓' : '⇥'}
                          </span>
                          <span style={{
                            fontSize:'0.66rem', fontWeight:600, letterSpacing:'0.1em',
                            textTransform:'uppercase', color:'rgba(255,255,255,0.3)',
                          }}>
                            Drop file or paste
                          </span>
                          <span style={{fontSize:'0.6rem', color:'rgba(255,255,255,0.15)'}}>
                            skybox.json · skyBox.lua · CirrusLayers snippet
                          </span>
                        </>) : (<>
                          {hasImport ? (<>
                            <span style={{fontSize:'1.1rem', lineHeight:1, opacity:0.8}}>✓</span>
                            <span style={{
                              fontSize:'0.66rem', fontWeight:600, letterSpacing:'0.08em',
                              textTransform:'uppercase', color:'rgba(74,222,128,0.85)',
                            }}>
                              {layerCount} layer{layerCount!==1?'s':''} parsed
                            </span>
                            {parsed.texture && (
                              <span style={{fontSize:'0.6rem', color:'rgba(74,222,128,0.5)', fontFamily:'monospace'}}>
                                {parsed.texture.split('/').pop()}
                              </span>
                            )}
                          </>) : (<>
                            <span style={{fontSize:'1.1rem', lineHeight:1, opacity:0.7}}>✗</span>
                            <span style={{
                              fontSize:'0.66rem', fontWeight:600, letterSpacing:'0.08em',
                              textTransform:'uppercase', color:'rgba(248,113,113,0.8)',
                            }}>No CirrusLayers found</span>
                            <span style={{fontSize:'0.6rem', color:'rgba(248,113,113,0.4)'}}>
                              Check that the text contains CirrusLayers or cirrusLayers
                            </span>
                          </>)}
                          {/* Clear button */}
                          <button
                            onClick={e => { e.stopPropagation(); setImportText(''); setImportError(''); }}
                            style={{
                              position:'absolute', top:'7px', right:'9px',
                              background:'none', border:'none', cursor:'pointer',
                              fontSize:'0.72rem', color:'rgba(255,255,255,0.22)',
                              padding:'2px 5px', lineHeight:1, transition:'color 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,0.6)'}
                            onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.22)'}
                            title="Clear"
                          >✕</button>
                        </>)}
                      </div>

                      {/* Name + save row */}
                      <div style={{display:'flex', gap:'6px', alignItems:'center'}}>
                        <input
                          className="skybox-input"
                          value={newPresetName}
                          onChange={e => setNewPresetName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key==='Enter') saveCustomPreset();
                            if (e.key==='Escape') { setShowSavePreset(false); setNewPresetName(''); setImportText(''); setImportError(''); }
                          }}
                          placeholder={hasImport ? 'Preset name…' : 'Preset name (saves current layers)…'}
                          style={{flex:1, fontSize:'0.76rem'}}
                          autoFocus
                        />
                        <button
                          className="btn-ghost"
                          onClick={saveCustomPreset}
                          disabled={!newPresetName.trim()}
                          style={{padding:'4px 12px', fontSize:'0.72rem', opacity: newPresetName.trim() ? 1 : 0.4}}
                        >Save</button>
                        <button
                          className="btn-ghost"
                          onClick={() => { setShowSavePreset(false); setNewPresetName(''); setImportText(''); setImportError(''); }}
                          style={{padding:'4px 10px', fontSize:'0.72rem', opacity:0.5}}
                        >✕</button>
                      </div>

                      {!importText && (
                        <div style={{marginTop:'5px', fontSize:'0.6rem', color:'rgba(255,255,255,0.18)', lineHeight:'1.5'}}>
                          No file? Saves the current layer configuration.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <h2 className="skybox-section-title" style={{fontSize:'1rem',marginBottom:'16px'}}>Layers ({cirrusLayers.length})</h2>
              <div style={{padding:'8px 12px',background:'rgba(255,68,68,0.06)',border:'1px solid rgba(255,68,68,0.25)',marginBottom:'14px',fontSize:'0.76rem',color:'#ff6666',lineHeight:'1.6'}}>
                 Max. 4 Cirrus Layers — more than 4 will crash the game.
              </div>
              {cirrusLayers.map((l,i)=>(
                <div className="planet-row" key={l.id}>
                  <div className="planet-row-header">
                    <span className="planet-row-label" style={{color:UV_COLORS[i%UV_COLORS.length]}}>Layer #{i+1}</span>
                    <button className="btn-delete-sm sm" onClick={()=>removeCirrus(l.id)}>×</button>
                  </div>
                  <div className="skybox-form-row">
                    <div className="skybox-form-group"><label>Freq X</label><input className="skybox-input" value={l.freqX} onChange={e=>updateCirrus(l.id,'freqX',e.target.value)}/></div>
                    <div className="skybox-form-group"><label>Freq Y</label><input className="skybox-input" value={l.freqY} onChange={e=>updateCirrus(l.id,'freqY',e.target.value)}/></div>
                  </div>
                  <div className="skybox-form-row-3">
                    <div className="skybox-form-group"><label>Speed</label><input className="skybox-input" value={l.speed} onChange={e=>updateCirrus(l.id,'speed',e.target.value)}/></div>
                    <div className="skybox-form-group"><label>Dir X</label><input className="skybox-input" value={l.dirX} onChange={e=>updateCirrus(l.id,'dirX',e.target.value)}/></div>
                    <div className="skybox-form-group"><label>Dir Y</label><input className="skybox-input" value={l.dirY} onChange={e=>updateCirrus(l.id,'dirY',e.target.value)}/></div>
                  </div>
                </div>
              ))}
              {cirrusLayers.length < 4 && <button className="btn-ghost" onClick={addCirrus}>+ Add Layer</button>}
            </div>
          </>)}

          {/*  STARS TAB  */}
          {activeTab==='stars' && (
        <div className="tab-col-config">

          {/* ── CONFIGURATION (merged card) ── */}
          <div className="section-card">
            <div className="sb-st-card-header">
              <h2 className="section-title">
                CONFIGURATION
              </h2>
              <button className="btn-ghost" onClick={resetDefaults}>Reset</button>
            </div>

            {/* ── Star Configuration subtitle ── */}
            <div className="subsection-title">Star Configuration</div>
            <div className="sb-st-config-grid">
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
                <div className="sb-st-split-input">
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
                <div className="sb-st-config-grid">
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
                    <textarea className="form-input sb-st-textarea" rows={4}
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
                  <div className="sb-st-config-grid">
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

            <hr className="sb-st-subsection-divider"/>

            {/* ── Seed Control subtitle ── */}
            <div className="subsection-title">Seed Control</div>
            <div style={{display:'flex', justifyContent:'flex-end', marginBottom:'10px'}}>
              <Toggle checked={useSeed} onChange={e => setUseSeed(e.target.checked)}
                label={useSeed ? 'Fixed' : 'Random'} />
            </div>
            <div className="sb-st-seed-row">
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
            <div className="sb-st-card-header">
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
            <div className="sb-st-uv-table-header">
              <div className="sb-st-uv-col-color"/>
              <div className="sb-st-uv-col-field">X</div>
              <div className="sb-st-uv-col-field">Y</div>
              <div className="sb-st-uv-col-field">Z</div>
              <div className="sb-st-uv-col-field">W</div>
              <div className="sb-st-uv-col-weight">Weight</div>
              <div className="sb-st-uv-col-del"/>
            </div>

            {uvRows.map((row, i) => {
              const color = UV_COLORS[i % UV_COLORS.length];
              const update = (field, val) => {
                const next = uvRows.map((r, j) => j === i ? { ...r, [field]: val } : r);
                syncUvRows(next);
              };
              return (
                <div className="sb-st-uv-table-row" key={i}>
                  <div className="sb-st-uv-col-color">
                    <div className="st-uv-legend-dot" style={{ background: color, border: `1.5px solid ${color}` }}/>
                  </div>
                  {['x','y','z','w'].map(f => (
                    <div className="sb-st-uv-col-field" key={f}>
                      <input className="form-input sb-st-uv-cell-input"
                        value={row[f]}
                        onChange={e => update(f, e.target.value)}
                        placeholder="0.0"/>
                    </div>
                  ))}
                  <div className="sb-st-uv-col-weight">
                    <input className="form-input sb-st-uv-cell-input"
                      value={row.weight}
                      onChange={e => update('weight', e.target.value)}
                      placeholder="0.25"/>
                  </div>
                  <div className="sb-st-uv-col-del">
                    {uvRows.length > 1 && (
                      <button className="btn-delete-xs sb-st-uv-del-btn"
                        onClick={() => syncUvRows(uvRows.filter((_, j) => j !== i))}
                        title="Remove">×</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
          )}

          {/*  OUTPUT TAB  */}
          {activeTab==='output' && (<>
            <div className="skybox-section-card">
              <h2 className="skybox-section-title">Lua Preview (data.lua → skyBox)</h2>
              <div className="skybox-json-block">{generateSkyboxFile().slice(0,2500)}</div>
            </div>
            <div className="section-card">
              <label className="checkbox-label" style={{ marginBottom: '12px' }} onClick={() => { setExportRawScmskybox(v => !v); onSharedChange('sb_exportRawScmskybox', !exportRawScmskybox); }}>
                <div className={`checkbox${exportRawScmskybox ? ' checked' : ''}`}>
                  {exportRawScmskybox && (
                    <svg className="checkbox-check" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="checkbox-text">Export .scmskybox (no SCMAP)</span>
              </label>
              <label className="checkbox-label" style={{ marginBottom: '20px' }} onClick={() => { const v = !generateReadme; setGenerateReadme(v); onSharedChange('sb_generateReadme', v); }}>
                <div className={`checkbox${generateReadme ? ' checked' : ''}`}>
                  {generateReadme && (
                    <svg className="checkbox-check" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="checkbox-text">Generate README file</span>
              </label>
              <button className="btn-primary btn-lg" onClick={exportRawScmskybox ? handleExportScmskybox : handleInjectSkybox}>
                {exportRawScmskybox ? 'Export .scmskybox' : 'Generate Skybox → .scmap'}
              </button>
            </div>
            {(!mapName || !mapsFolderPath) && (
              <p style={{color:'rgba(255,120,120,0.85)',fontSize:'0.75rem',marginTop:'8px',textAlign:'center'}}>
                 Map Name and Maps Folder must be set (Atmosphere → Map Context).
              </p>
            )}
          </>)}

        </div>

        {/*  RIGHT COLUMN  */}
        <div className="skybox-output-section">

          {/* Dome Preview */}
          {activeTab==='skybox' && (
            <div className="skybox-section-card">
              <h2 className="skybox-section-title">Dome Preview</h2>
              <p className="skybox-section-description">Vertical cross-section. Gradient linear in worldY.</p>
              <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
                <button onClick={()=>setShowDomeLabels(v=>!v)}
                  className={showDomeLabels ? 'btn-library' : 'btn-ghost'}
                  style={{flex:1}}>
                  {showDomeLabels?'Labels On':'Labels Off'}
                </button>
                <button onClick={()=>setDomeFullscreen(true)} className="btn-ghost" style={{flex:1}}>
                   Fullscreen
                </button>
              </div>
              <DomePreview horizonColor={horizonColor} zenithColor={zenithColor} horizonHeight={parseFloat(horizonHeight)||0} zenithHeight={parseFloat(zenithHeight)||256} subtractHeight={parseFloat(subtractHeight)||1.2566} subdivHeight={parseInt(subdivHeight)||6} scale={scale} showLabels={showDomeLabels} fullscreen={false}/>
              <div style={{display:'flex',gap:'8px',marginTop:'10px'}}>
                {[['HORIZON H',horizonHeight],['ZENITH H',zenithHeight],['SPHERE LERP',sphereLerp.toFixed(3)]].map(([lbl,val])=>(
                  <div key={lbl} style={{flex:1,padding:'8px 10px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',fontSize:'0.72rem'}}>
                    <div style={{color:'var(--text-muted)',letterSpacing:'0.08em',marginBottom:'3px'}}>{lbl}</div>
                    <div style={{color:'var(--skybox-generator-color)',fontFamily:'monospace'}}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/*  CIRRUS LAYER DIAGRAM  */}
          {activeTab==='cirrus' && (
            <div className="skybox-section-card">
              <h2 className="skybox-section-title">Layer Structure</h2>
              <CirrusLayerDiagram layers={cirrusLayers} cirrusMult={cirrusMult}/>
            </div>
          )}

          {/* Stars — right column */}
          {activeTab==='stars' && (
        <div className="tab-col-detail">

          {/* Exclusion Zones */}
          <div className="section-card">
            <div className="sb-st-card-header">
              <h2 className="section-title">
                EXCLUSION ZONES
              </h2>
              <div className="sb-st-ex-header-actions">
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

            {/* Draft confirm bar */}
            {draftZone && (
              <div className="sb-st-ex-confirm-bar">
                <span className="sb-st-ex-confirm-label">
                  New zone drawn — confirm to add it.
                </span>
                <div className="sb-st-ex-confirm-actions">
                  <button className="sb-st-ex-btn-confirm"
                    onClick={() => {
                      const newZones = [...exclusionZones, draftZone];
                      setExclusionZones(newZones);
                      setSelectedZoneIdx(newZones.length - 1);
                      setDraftZone(null);
                    }}>Confirm</button>
                  <button className="sb-st-ex-btn-discard"
                    onClick={() => { setDraftZone(null); drawExCanvas(exclusionZones, null); }}>
                    Discard
                  </button>
                </div>
              </div>
            )}

            {/* Zone list */}
            {exEnabled && exclusionZones.length > 0 && (
              <div style={{marginBottom: '12px'}}>
                {exclusionZones.map((zone, i) => (
                  <div key={i}
                    className="sb-st-ex-info"
                    style={{
                      cursor: 'pointer',
                      marginBottom: '6px',
                      outline: i === selectedZoneIdx ? '1px solid rgba(255,80,80,0.5)' : 'none',
                    }}
                    onClick={() => setSelectedZoneIdx(i === selectedZoneIdx ? null : i)}>
                    <span className="sb-st-ex-info-label">Zone {i + 1}</span>
                    {i === selectedZoneIdx && (
                      <code className="sb-st-ex-info-code">{zoneWorldCoords(zone)}</code>
                    )}
                    <button className="btn-delete-xs" style={{marginLeft:'auto'}}
                      onClick={e => {
                        e.stopPropagation();
                        const next = exclusionZones.filter((_, j) => j !== i);
                        setExclusionZones(next);
                        setSelectedZoneIdx(prev =>
                          prev === i ? null : prev > i ? prev - 1 : prev
                        );
                      }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Canvas */}
            <div
              style={{ margin: '-24px', padding: '24px',
                cursor: exEnabled ? 'crosshair' : 'default' }}
              onMouseDown={onMouseDown}>
              <div className="sb-st-ex-wrap">
                <div ref={exWrapRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  <canvas ref={exCanvasRef} width={EX_RES} height={EX_RES}
                    className="sb-st-ex-canvas"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* UV Visualisation */}
          <div className="section-card">
            <div className="sb-st-card-header" style={{marginBottom:'14px'}}>
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
            <div className="sb-st-upload-area" onClick={()=>fileInputRef.current?.click()}>
              <span className="sb-st-upload-icon"></span>
              <span>{previewImageData ? 'Replace texture preview' : 'Upload texture preview'}</span>
              <input ref={fileInputRef} type="file" style={{display:'none'}}
                accept="image/*,.dds" onChange={handleImageUpload}/>
            </div>

            {/* Texture opacity — slider 0–1 + number input for >1 */}
            {previewImageData && (
              <Field label="Texture Opacity" style={{marginTop:'14px', marginBottom:'6px'}}>
                <div className="sb-st-opacity-row">
                  <RangeSlider min="0" max="1" step="0.01"
                    value={Math.min(parseFloat(texOpacity) || 0, 1)}
                    onChange={e => setTexOpacity(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)} />
                  <input type="number" min="0" step="0.01"
                    className="form-input sb-st-opacity-input"
                    value={texOpacity}
                    onChange={e => setTexOpacity(e.target.value)}/>
                </div>
              </Field>
            )}

            {/* UV overlay opacity */}
            <Field label="UV Overlay Opacity" style={{marginBottom:'14px'}}>
              <div className="sb-st-opacity-row">
                <RangeSlider min="0" max="1" step="0.01"
                  value={Math.min(parseFloat(uvOpacity) || 0, 1)}
                  onChange={e => setUvOpacity(e.target.value)} />
                <input type="number" min="0" step="0.01"
                  className="form-input sb-st-opacity-input"
                  value={uvOpacity}
                  onChange={e => setUvOpacity(e.target.value)}/>
              </div>
            </Field>

            <canvas ref={uvCanvasRef} width={UV_RES} height={UV_RES}
              className="sb-st-uv-canvas"/>
          </div>

        </div>
          )}

          {/* Summary */}
          <div className="skybox-section-card">
            <h2 className="skybox-section-title">Summary</h2>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
              {[['Planets',planets.length],['Stars',numStars],['Cirrus Layers',cirrusLayers.length],['Star Clusters',numClusters],['UV Variants',stParsedUvs.length],['Total Planets',planets.length+parseInt(numStars||0)]].map(([lbl,val])=>(
                <div key={lbl} style={{padding:'10px 12px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'}}>
                  <div style={{fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--text-muted)',marginBottom:'3px'}}>{lbl}</div>
                  <div style={{fontSize:'1.05rem',fontWeight:'600',color:'var(--skybox-generator-color)'}}>{val}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Help Button ── */}
      <button className="help-btn" onClick={() => setShowHelp(true)} title="Help Guide">?</button>

      {/* ── Help Modal ── */}
      {showHelp && (
        <SkyboxGeneratorHelpModal
          onClose={() => setShowHelp(false)}
          activeHelpTab={activeHelpTab}
          setActiveHelpTab={setActiveHelpTab}
          helpSelected={helpSelected}
          setHelpSelected={setHelpSelected}
          activeAdvSubTab={activeAdvSubTab}
          setActiveAdvSubTab={setActiveAdvSubTab}
        />
      )}

    </div>
  );
};

export default SkyboxGeneratorTab;