import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import './TextureEditor.css';
import { DEFAULT_ADJUSTMENTS, adjHasChanges } from './TextureAdjustModal';

const MAX_PREVIEW_PX = 512; 

async function loadPreviewUrlToCanvas(previewUrl) {
  let src = previewUrl;
  if (previewUrl.toLowerCase().endsWith('.dds')) {
    const filePath = previewUrl.replace(/^file:\/+/, '').replace(/\//g, '\\');
    const result = await window.electronAPI.invoke('dds-to-dataurl', { filePath });
    if (!result?.success) return null;
    src = result.dataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > MAX_PREVIEW_PX || h > MAX_PREVIEW_PX) {
        const scale = MAX_PREVIEW_PX / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ── Pixel helpers ─────────────────────────────────────────────────────────────
const clamp = (v, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, Math.round(v)));

const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6;
    }
  }
  return [h * 360, s * 100, l * 100];
};

const hslToRgb = (h, s, l) => {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1/3) * 255),
    Math.round(hue2rgb(p, q, h)       * 255),
    Math.round(hue2rgb(p, q, h - 1/3) * 255),
  ];
};

function renderPreview(srcCanvas, adj) {
  const w = srcCanvas.width, h = srcCanvas.height;
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const ctx = off.getContext('2d');
  ctx.drawImage(srcCanvas, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  const sel   = adj.selection?.enabled ? adj.selection : null;
  const selX0 = sel ? Math.round(sel.x * w)           : 0;
  const selY0 = sel ? Math.round(sel.y * h)            : 0;
  const selX1 = sel ? Math.round((sel.x + sel.w) * w)  : w;
  const selY1 = sel ? Math.round((sel.y + sel.h) * h)  : h;

  const doHueSat = adj.hue !== 0 || adj.saturation !== 100;
  const doBri    = adj.brightness !== 100;
  const doCon    = adj.contrast   !== 100;
  const doGamma  = adj.gamma !== undefined && adj.gamma !== 100;
  const doTint   = adj.tint && adj.tint.opacity > 0;
  const doSC     = adj.selectiveColor?.enabled;

  const conF = doCon ? adj.contrast / 100 : 1;
  const conO = doCon ? 128 * (1 - conF)   : 0;
  const gammaExp = doGamma ? 1 / (adj.gamma / 100) : 1;
  const gammaLUT = new Uint8Array(256);
  for (let i = 0; i < 256; i++)
    gammaLUT[i] = doGamma ? clamp(Math.round(Math.pow(i / 255, gammaExp) * 255)) : i;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const inSel = !sel || (px >= selX0 && px < selX1 && py >= selY0 && py < selY1);
      if (!inSel) continue;
      const i = (py * w + px) * 4;
      let r = d[i], g = d[i+1], b = d[i+2];
      if (doHueSat) {
        let [hh, s, l] = rgbToHsl(r, g, b);
        hh = ((hh + adj.hue) % 360 + 360) % 360;
        s  = clamp(s * (adj.saturation / 100), 0, 100);
        [r, g, b] = hslToRgb(hh, s, l);
      }
      if (doBri)   { const f = adj.brightness / 100; r=clamp(r*f); g=clamp(g*f); b=clamp(b*f); }
      if (doCon)   { r=clamp(r*conF+conO); g=clamp(g*conF+conO); b=clamp(b*conF+conO); }
      if (doGamma) { r=gammaLUT[r]; g=gammaLUT[g]; b=gammaLUT[b]; }
      if (doTint) {
        const a = adj.tint.opacity / 100;
        r=clamp(r*(1-a)+adj.tint.r*a); g=clamp(g*(1-a)+adj.tint.g*a); b=clamp(b*(1-a)+adj.tint.b*a);
      }
      if (doSC) {
        const sc = adj.selectiveColor;
        const [hh, s, l] = rgbToHsl(r, g, b);
        const diff = Math.abs(((hh - sc.targetHue + 180 + 360) % 360) - 180);
        if (diff <= sc.hueRange) {
          const str = 1 - diff / sc.hueRange;
          [r, g, b] = hslToRgb(
            ((hh + sc.hueShift * str) % 360 + 360) % 360,
            clamp(s + sc.satShift * str, 0, 100),
            clamp(l + sc.briShift * str * 0.5, 0, 100)
          );
        }
      }
      d[i]=r; d[i+1]=g; d[i+2]=b;
    }
  }
  ctx.putImageData(img, 0, 0);
  return off;
}

// ── Compact slider ────────────────────────────────────────────────────────────
const AccentSlider = ({ label, value, min, max, step = 1, defaultVal, onChange, unit = '', accent }) => {
  const isChanged = value !== defaultVal;
  const display = unit === '°' && value > 0 ? `+${value}°` : unit === '°' ? `${value}°` : `${value}${unit}`;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
      <span style={{ width:110, fontSize:'0.75rem', color:'rgba(255,255,255,0.42)', flexShrink:0, letterSpacing:'0.02em' }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="pte-slider-input" style={{ '--accent': accent || '#c8ff60' }} />
      <span style={{ width:50, fontSize:'0.78rem', fontWeight:600, textAlign:'right', flexShrink:0,
        color: isChanged ? (accent || '#c8ff60') : 'rgba(255,255,255,0.38)',
        fontVariantNumeric:'tabular-nums' }}>{display}</span>
      {isChanged && (
        <button onClick={() => onChange(defaultVal)}
          style={{ fontSize:'0.62rem', padding:'2px 6px', background:'rgba(255,255,255,0.05)',
            border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.3)',
            borderRadius:3, cursor:'pointer', flexShrink:0, fontFamily:'inherit', lineHeight:1.4 }}>↺</button>
      )}
    </div>
  );
};

const HueRangeBar = ({ targetHue, hueRange }) => {
  const startPct = ((targetHue - hueRange + 360) % 360) / 360 * 100;
  const width    = (hueRange * 2) / 360 * 100;
  return (
    <div style={{ position:'relative', height:8, borderRadius:3, marginBottom:8,
      background:'linear-gradient(to right,hsl(0,100%,50%),hsl(60,100%,50%),hsl(120,100%,50%),hsl(180,100%,50%),hsl(240,100%,50%),hsl(300,100%,50%),hsl(360,100%,50%))' }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.62)', borderRadius:3 }} />
      <div style={{ position:'absolute', top:0, bottom:0, borderRadius:3,
        left:`${startPct}%`, width:`${width}%`,
        background:'rgba(255,255,255,0.18)', boxShadow:'inset 0 0 0 1px rgba(255,255,255,0.5)' }} />
      <div style={{ position:'absolute', left:`${targetHue/360*100}%`, top:-2, bottom:-2, width:2,
        background:'#fff', boxShadow:'0 0 4px rgba(0,0,0,0.9)', transform:'translateX(-50%)', borderRadius:1 }} />
    </div>
  );
};

const SectionLabel = ({ children }) => (
  <div style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase',
    color:'rgba(255,255,255,0.28)', marginBottom:14, paddingBottom:8,
    borderBottom:'1px solid rgba(255,255,255,0.07)' }}>{children}</div>
);

const InfoBox = ({ title, children }) => (
  <div style={{ fontSize:'0.74rem', color:'rgba(255,255,255,0.38)', lineHeight:1.65, marginBottom:14,
    padding:'10px 14px', background:'rgba(255,255,255,0.03)',
    borderRadius:0, border:'1px solid rgba(255,255,255,0.07)',
    borderLeft:'2px solid rgba(255,255,255,0.12)' }}>
    {title && <strong style={{ color:'rgba(255,255,255,0.56)', display:'block', marginBottom:4, fontSize:'0.76rem' }}>{title}</strong>}
    {children}
  </div>
);

// ── PropEditor ────────────────────────────────────────────────────────────────
const PropEditor = forwardRef(function PropEditor({ prop, adj, onChange, totalProps, activePreviewUrl, onPassClick }, ref) {
  // activePreviewUrl: overrides prop.previewUrl when a LOD sub-tab is active
  const resolvedPreviewUrl = activePreviewUrl ?? prop.previewUrl;
  // Session key for this specific prop's canvas history — include previewUrl so LOD tabs get separate caches
  const PROP_SESSION_KEY = `pte-prop:${prop.id ?? prop.previewUrl ?? prop.gamePath}:${resolvedPreviewUrl ?? ''}`;

  const [srcCanvas, setSrcCanvas]         = useState(null);
  const [previewCanvas, setPreviewCanvas] = useState(null);

  // Full history array — never trimmed on navigation, only on delete
  const [history, setHistory]     = useState([]); // [{ canvas, label }]
  const [activePass, setActivePass] = useState(-1); // -1 = tip (latest)
  const [hoveredPass, setHoveredPass] = useState(null);
  // Sticky flag: true once any pass has been baked, cleared only when all passes deleted
  const [hasBakedPasses, setHasBakedPasses] = useState(
    () => !!(adj?._hasBakedPasses)
  );

  // Resolve which canvas is the current editing base:
  // activePass === -1  →  tip (last entry), or srcCanvas if empty
  const resolvedPassIdx = activePass === -1 ? history.length - 1 : activePass;
  const baseCanvas = resolvedPassIdx >= 0 ? history[resolvedPassIdx].canvas : srcCanvas;

  // Navigate to pass i — does NOT delete anything
  const handleSelectPass = useCallback((i) => {
    setActivePass(i);
    onChange({ ...DEFAULT_ADJUSTMENTS, _hasBakedPasses: hasBakedPasses }, false);
  }, [onChange, hasBakedPasses]);

  // Delete pass i and everything after it (they depend on it)
  const handleDeletePass = useCallback((e, i) => {
    e.stopPropagation();
    setHistory(prev => {
      const next = prev.slice(0, i);
      try {
        const existing = JSON.parse(sessionStorage.getItem(PROP_SESSION_KEY) || '{}');
        sessionStorage.setItem(PROP_SESSION_KEY, JSON.stringify({
          ...existing,
          history: next.map(e => ({ dataUrl: e.canvas.toDataURL('image/png'), label: e.label })),
        }));
      } catch {}
      return next;
    });
    setActivePass(-1);
    const stillHasPasses = i > 0;
    setHasBakedPasses(stillHasPasses);
    onChange({ ...DEFAULT_ADJUSTMENTS, _hasBakedPasses: stillHasPasses }, false);
  }, [onChange, PROP_SESSION_KEY]);

  const canvasOrigRef  = useRef(null);

  useImperativeHandle(ref, () => ({
    getBaseDataUrl: () => baseCanvas ? baseCanvas.toDataURL('image/png') : null,
    getHistory:     () => history,
  }), [baseCanvas, history]);
  const canvasAdjRef   = useRef(null);
  const canvasSelRef   = useRef(null);
  const selWrapRef     = useRef(null);
  const dragging       = useRef(false);
  const dragStart      = useRef({ x: 0, y: 0 });
  const animFrame      = useRef(null);

  const upd   = (k, v) => onChange({ ...adj, [k]: v }, false);
  const updT  = (k, v) => onChange({ ...adj, tint:{ ...adj.tint, [k]: v } }, false);


  useEffect(() => {
    if (!resolvedPreviewUrl) return;
    let cancelled = false;

    // Try restoring from sessionStorage first (survives tab switches)
    const restoreFromSession = async () => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(PROP_SESSION_KEY) || '{}');
        if (saved.history?.length > 0 || saved.srcDataUrl) {
          const loadCanvas = (dataUrl) => new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
              const c = document.createElement('canvas');
              c.width = img.naturalWidth; c.height = img.naturalHeight;
              c.getContext('2d').drawImage(img, 0, 0);
              resolve(c);
            };
            img.onerror = () => resolve(null);
            img.src = dataUrl;
          });
          if (saved.srcDataUrl) {
            const c = await loadCanvas(saved.srcDataUrl);
            if (c && !cancelled) setSrcCanvas(c);
          }
          if (saved.history?.length > 0) {
            const restored = await Promise.all(
              saved.history.map(async ({ dataUrl, label, adj }) => ({
                canvas: await loadCanvas(dataUrl),
                label,
                adj: adj ?? null,
              }))
            );
            if (!cancelled) {
              setHistory(restored.filter(e => e.canvas));
              setHasBakedPasses(true);
            }
          }
          return true; // restored from session
        }
      } catch {}
      return false;
    };

    restoreFromSession().then(restored => {
      if (restored || cancelled) return;
      // Fresh load — cache src canvas in session
      loadPreviewUrlToCanvas(resolvedPreviewUrl).then(canvas => {
        if (cancelled || !canvas) return;
        setSrcCanvas(canvas);
        setHistory([]);
        try {
          const existing = JSON.parse(sessionStorage.getItem(PROP_SESSION_KEY) || '{}');
          sessionStorage.setItem(PROP_SESSION_KEY, JSON.stringify({
            ...existing,
            srcDataUrl: canvas.toDataURL('image/png'),
          }));
        } catch {}
      });
    });

    return () => { cancelled = true; };
  }, [resolvedPreviewUrl, PROP_SESSION_KEY]);

  // When Apply Changes is called, bake onto current base and push to history tip
  const handleApplyChanges = useCallback(() => {
    if (!previewCanvas) return;
    const baked = document.createElement('canvas');
    baked.width  = previewCanvas.width;
    baked.height = previewCanvas.height;
    baked.getContext('2d').drawImage(previewCanvas, 0, 0);
    const parts = [];
    if (adj.hue !== 0)               parts.push(`Hue ${adj.hue > 0 ? '+' : ''}${adj.hue}°`);
    if (adj.saturation !== 100)      parts.push(`Sat ${adj.saturation}%`);
    if (adj.brightness !== 100)      parts.push(`Bri ${adj.brightness}%`);
    if (adj.contrast !== 100)        parts.push(`Con ${adj.contrast}%`);
    if (adj.gamma !== 100)           parts.push(`Gamma ${adj.gamma}`);
    if (adj.tint?.opacity > 0)       parts.push(`Tint ${adj.tint.opacity}%`);
    if (adj.selection?.enabled)      parts.push(`Region ${(adj.selection.w*100).toFixed(0)}×${(adj.selection.h*100).toFixed(0)}%`);
    const label = parts.length > 0 ? parts.join(' · ') : 'Pass';
    // Insert after current activePass, discarding nothing — just appending at tip
    // If we're mid-history (activePass < tip), the new pass branches from here.
    // Simplest correct behaviour: trim history to current pass, then append.
    setHistory(prev => {
      const base = activePass === -1 ? prev : prev.slice(0, activePass + 1);
      const next = [...base, { canvas: baked, label, adj: { ...adj } }];
      // Persist all history canvases as data-URLs in sessionStorage
      try {
        const existing = JSON.parse(sessionStorage.getItem(PROP_SESSION_KEY) || '{}');
        sessionStorage.setItem(PROP_SESSION_KEY, JSON.stringify({
          ...existing,
          history: next.map(e => ({ dataUrl: e.canvas.toDataURL('image/png'), label: e.label, adj: e.adj })),
        }));
      } catch {}
      return next;
    });
    setActivePass(-1); // jump to new tip
    setHasBakedPasses(true);
    // Send _bakedImageDataUrl immediately so it is stored in adjMap/lodAdjMap
    // regardless of which tab is active when the user clicks Confirm.
    // This is the only moment we have the canvas in-hand.
    onChange({
      ...DEFAULT_ADJUSTMENTS,
      _hasBakedPasses: true,
      _bakedImageDataUrl: baked.toDataURL('image/png'),
    }, false);
  }, [previewCanvas, adj, onChange, activePass]);

  // Render adjusted — always from baseCanvas (which is the last baked snapshot)
  useEffect(() => {
    if (!baseCanvas) return;
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
    animFrame.current = requestAnimationFrame(() => setPreviewCanvas(renderPreview(baseCanvas, adj)));
  }, [adj, baseCanvas]);

  // Paint split-preview original half — shows current base (original or last baked)
  useEffect(() => {
    const c = canvasOrigRef.current;
    if (!c || !baseCanvas) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(baseCanvas, 0, 0, c.width, c.height);
  }, [baseCanvas]);

  // Paint split-preview adjusted half (no selection overlay here)
  useEffect(() => {
    const c = canvasAdjRef.current;
    if (!c || !previewCanvas) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(previewCanvas, 0, 0, c.width, c.height);
  }, [previewCanvas]);

  // Paint standalone adjusted preview WITH selection overlay
  useEffect(() => {
    const c = canvasSelRef.current;
    if (!c || !previewCanvas) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(previewCanvas, 0, 0, c.width, c.height);
    if (adj.selection?.enabled) {
      const { x, y, w, h } = adj.selection;
      const cw = c.width, ch = c.height;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, cw, y * ch);
      ctx.fillRect(0, (y + h) * ch, cw, ch);
      ctx.fillRect(0, y * ch, x * cw, h * ch);
      ctx.fillRect((x + w) * cw, y * ch, cw, h * ch);
      ctx.strokeStyle = '#c8ff60';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x * cw + 1, y * ch + 1, w * cw - 2, h * ch - 2);
      ctx.setLineDash([]);
    }
  }, [previewCanvas, adj.selection]);

  // ── Selection drag — clamped to [0,1] but drag starts/continues outside ──
  // We attach mousemove + mouseup to document so dragging outside the element works.
  const getPosRelativeToWrap = useCallback((clientX, clientY) => {
    const rect = selWrapRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    // Do NOT clamp here — we clamp only when storing the selection rectangle
    return {
      x: (clientX - rect.left)  / rect.width,
      y: (clientY - rect.top)   / rect.height,
    };
  }, []);

  const onSelMouseDown = useCallback(e => {
    e.preventDefault();
    const pos = getPosRelativeToWrap(e.clientX, e.clientY);
    dragStart.current = pos;
    dragging.current  = true;
    // Auto-enable selection when user starts dragging
    onChange({ ...adj, selection: { enabled: true, x: clampUnit(pos.x), y: clampUnit(pos.y), w: 0, h: 0 } }, false);
  }, [adj, onChange, getPosRelativeToWrap]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const pos = getPosRelativeToWrap(e.clientX, e.clientY);
      const x0 = dragStart.current.x, y0 = dragStart.current.y;
      const x1 = pos.x, y1 = pos.y;
      const rx = Math.min(x0, x1), ry = Math.min(y0, y1);
      const rw = Math.abs(x1 - x0), rh = Math.abs(y1 - y0);
      // Clamp rect to image bounds [0,1]
      const cx = clampUnit(rx);
      const cy = clampUnit(ry);
      const cw2 = Math.min(rw, 1 - cx);
      const ch2 = Math.min(rh, 1 - cy);
      onChange({ ...adj, selection: { ...adj.selection, x: cx, y: cy, w: cw2, h: ch2 } }, false);
    };
    const onUp = () => { dragging.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };
  }, [adj, onChange, getPosRelativeToWrap]);

  const clampUnit = v => Math.max(0, Math.min(1, v));

  const hasAdj = adjHasChanges(adj) || history.length > 0;
  const chips = [];
  if (adj.hue !== 0)               chips.push(`Hue ${adj.hue > 0 ? '+' : ''}${adj.hue}°`);
  if (adj.saturation !== 100)      chips.push(`Sat ${adj.saturation}%`);
  if (adj.brightness !== 100)      chips.push(`Bri ${adj.brightness}%`);
  if (adj.contrast !== 100)        chips.push(`Con ${adj.contrast}%`);
  if (adj.gamma !== 100)           chips.push(`Gamma ${adj.gamma}`);
  if (adj.tint?.opacity > 0)       chips.push(`Tint ${adj.tint.opacity}%`);
  if (adj.selection?.enabled)      chips.push('Region');

  const origPath   = prop.gamePath || prop.resolvedPath || prop.id || '';
  const baseName   = origPath.split('/').pop().replace(/_prop\.bp$/i,'').replace(/\.bp$/i,'');
  const customName = `${baseName}_custom`;
  const albedoOut  = prop.pendingTextureOps?.[0]?.targetBpPath
    || (hasAdj ? `/env/props/${customName}/${customName}_prop.bp` : null);

  const canvasW = baseCanvas?.width  || 512;
  const canvasH = baseCanvas?.height || 512;
  const hasCurrentAdj = adjHasChanges(adj);

  return (
    <div className="pte-editor">

      {/* ── LEFT: Preview panel — scrollable ─────────────────────────────── */}
      <div className="pte-preview-panel" style={{ overflowY:'auto', minHeight:0, height:'100%' }}>
        <div className="pte-preview-label">PREVIEW</div>

        {/* 1. Split preview: Original | Adjusted (no selection overlay) */}
        <div style={{ position:'relative', width:'100%', aspectRatio:'1',
          borderRadius:10, overflow:'hidden',
          border:'1px solid rgba(255,255,255,0.08)', background:'#0e0e0e', flexShrink:0 }}>
          {!resolvedPreviewUrl ? (
            <div className="pte-preview-empty" style={{ position:'absolute', inset:0 }}>
              <p>No preview</p>
            </div>
          ) : !srcCanvas ? (
            <div className="pte-preview-empty" style={{ position:'absolute', inset:0 }}>
              <p style={{fontSize:'0.7rem'}}>Loading…</p>
            </div>
          ) : (
            <>
              <canvas ref={canvasOrigRef} width={canvasW} height={canvasH}
                style={{ position:'absolute', inset:0, width:'100%', height:'100%',
                  objectFit:'cover', imageRendering:'pixelated',
                  clipPath:'inset(0 50% 0 0)', pointerEvents:'none' }} />
              <canvas ref={canvasAdjRef} width={canvasW} height={canvasH}
                style={{ position:'absolute', inset:0, width:'100%', height:'100%',
                  objectFit:'cover', imageRendering:'pixelated',
                  clipPath:'inset(0 0 0 50%)', pointerEvents:'none' }} />
              <div style={{ position:'absolute', top:0, bottom:0, left:'50%', width:2,
                background:'rgba(255,255,255,0.4)', boxShadow:'0 0 8px rgba(255,255,255,0.2)',
                transform:'translateX(-50%)', pointerEvents:'none' }} />
              <span style={{ position:'absolute', bottom:8, left:8, fontSize:'0.57rem', fontWeight:600,
                letterSpacing:'0.1em', background:'rgba(0,0,0,0.7)', padding:'2px 6px', borderRadius:4,
                color:'rgba(255,255,255,0.4)', pointerEvents:'none' }}>
                {history.length > 0 ? `PASS ${history.length}` : 'ORIGINAL'}
              </span>
              <span style={{ position:'absolute', bottom:8, right:8, fontSize:'0.57rem', fontWeight:600,
                letterSpacing:'0.1em', background:'rgba(0,0,0,0.7)', padding:'2px 6px', borderRadius:4,
                color:'rgba(255,255,255,0.4)', pointerEvents:'none' }}>ADJUSTED</span>
            </>
          )}
        </div>

        {/* 2. Standalone adjusted preview — selection drag target */}
        {srcCanvas && (
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:'0.57rem', fontWeight:700, letterSpacing:'0.15em',
              textTransform:'uppercase', color:'rgba(255,255,255,0.2)', marginBottom:6 }}>
              ADJUSTED — {adj.selection?.enabled ? 'drag to select region' : 'enable selection below to draw region'}
            </div>

            {/* Oversized drag zone: 24px padding on all sides so edges are easy to grab */}
            <div style={{ margin:'-24px', padding:'24px', cursor: 'crosshair' }}
              onMouseDown={onSelMouseDown}>
              <div ref={selWrapRef} style={{ position:'relative', width:'100%', aspectRatio:'1',
                borderRadius:10, overflow:'hidden',
                border: adj.selection?.enabled
                  ? '1px solid rgba(200,255,96,0.35)'
                  : '1px solid rgba(255,255,255,0.08)',
                background:'#0e0e0e', pointerEvents:'none' }}>
                <canvas ref={canvasSelRef} width={canvasW} height={canvasH}
                  style={{ position:'absolute', inset:0, width:'100%', height:'100%',
                    objectFit:'cover', imageRendering:'pixelated' }} />
                {adj.selection?.enabled && (
                  <span style={{ position:'absolute', top:6, right:6, fontSize:'0.57rem',
                    background:'rgba(200,255,96,0.12)', border:'1px solid rgba(200,255,96,0.35)',
                    color:'rgba(200,255,96,0.75)', padding:'1px 7px', borderRadius:20,
                    pointerEvents:'none' }}>selection mode</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Apply Changes button + history — shown below second preview */}
        {srcCanvas && (() => {
          const canApply = adjHasChanges(adj);
          return (
            <div style={{ marginTop:10 }}>

              {/* History entries */}
              {history.length > 0 && (
                <div style={{ marginBottom:8, display:'flex', flexDirection:'column', gap:3 }}>
                  {history.map((entry, i) => {
                    const isActive  = i === resolvedPassIdx;
                    const isTip     = i === history.length - 1;
                    const isHovered = hoveredPass === i;
                    return (
                      <div key={i}
                        onClick={() => handleSelectPass(i)}
                        onMouseEnter={() => setHoveredPass(i)}
                        onMouseLeave={() => setHoveredPass(null)}
                        style={{ display:'flex', alignItems:'center', gap:7,
                          padding:'5px 8px', borderRadius:5, cursor:'pointer',
                          background: isActive
                            ? 'rgba(200,255,96,0.1)'
                            : isHovered ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                          border: isActive
                            ? '1px solid rgba(200,255,96,0.35)'
                            : '1px solid rgba(255,255,255,0.07)',
                          transition:'background 0.15s, border-color 0.15s',
                          userSelect:'none',
                          opacity: isActive ? 1 : 0.6,
                        }}>
                        <span style={{ fontSize:'0.6rem', fontWeight:700, flexShrink:0,
                          color: isActive ? 'rgba(200,255,96,0.75)' : 'rgba(255,255,255,0.35)' }}>
                          {isActive ? '▶' : '·'} PASS {i + 1}
                        </span>
                        <span style={{ flex:1, fontSize:'0.65rem', color:'rgba(255,255,255,0.45)',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {entry.label}
                        </span>
                        {/* Apply-to-others button */}
                        {onPassClick && entry.adj && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onPassClick(entry.adj); }}
                            title="Apply these adjustments to other props / LODs"
                            style={{
                              flexShrink:0, padding:'1px 6px',
                              fontSize:'0.55rem', fontWeight:700, fontFamily:'inherit',
                              background: isHovered ? 'rgba(200,255,96,0.12)' : 'transparent',
                              border: isHovered ? '1px solid rgba(200,255,96,0.35)' : '1px solid transparent',
                              borderRadius:3, cursor:'pointer',
                              color:'rgba(200,255,96,0.65)',
                              opacity: isHovered ? 1 : 0,
                              transition:'opacity 0.15s',
                              lineHeight:1.4,
                            }}>⇢</button>
                        )}
                        {/* X only visible on hover — deletes this pass and all after */}
                        <button
                          onClick={(e) => handleDeletePass(e, i)}
                          title={`Delete pass ${i+1} and all after`}
                          style={{
                            flexShrink:0, width:16, height:16,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            background: isHovered ? 'rgba(255,70,70,0.18)' : 'transparent',
                            border: isHovered ? '1px solid rgba(255,70,70,0.4)' : '1px solid transparent',
                            borderRadius:3, cursor:'pointer', fontFamily:'inherit',
                            fontSize:'0.62rem', color:'rgba(255,80,80,0.8)',
                            opacity: isHovered ? 1 : 0,
                            transition:'opacity 0.15s',
                            lineHeight:1,
                          }}>×</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Apply button */}
              <button
                disabled={!canApply}
                onClick={handleApplyChanges}
                style={{
                  width:'100%', padding:'8px 0',
                  fontSize:'0.75rem', fontWeight:700, fontFamily:'inherit',
                  borderRadius:7, cursor: canApply ? 'pointer' : 'not-allowed',
                  letterSpacing:'0.05em',
                  background: canApply
                    ? 'linear-gradient(135deg, rgba(200,255,96,0.18), rgba(200,255,96,0.08))'
                    : 'rgba(255,255,255,0.03)',
                  border: canApply
                    ? '1px solid rgba(200,255,96,0.45)'
                    : '1px solid rgba(255,255,255,0.08)',
                  color: canApply ? 'rgba(200,255,96,0.9)' : 'rgba(255,255,255,0.2)',
                  transition:'all 0.2s',
                }}>
                {canApply ? '⬇ Apply Changes — bake as new base' : 'No changes to apply'}
              </button>

              {history.length > 0 && (
                <div style={{ fontSize:'0.62rem', color:'rgba(255,255,255,0.25)',
                  textAlign:'center', marginTop:5, lineHeight:1.4 }}>
                  {history.length} pass{history.length !== 1 ? 'es' : ''} baked · the left preview now shows the result of all passes
                </div>
              )}
            </div>
          );
        })()}
        <div className="pte-prop-meta" style={{ marginTop: srcCanvas ? 34 : 16 }}>
          <div className="pte-prop-meta-name">{prop.name || prop.propName || prop.id}</div>
          {origPath && (
            <div className="pte-prop-meta-path">
              {origPath.length > 52 ? '…' + origPath.slice(-49) : origPath}
            </div>
          )}
          <div className="pte-prop-meta-tags">
            {prop.biome    && <span className="pte-tag">{prop.biome}</span>}
            {prop.propType && <span className="pte-tag">{prop.propType}</span>}
            {hasAdj && <span className="pte-tag pte-tag-custom">modified</span>}
          </div>
        </div>

        {/* Output info */}
        {hasAdj && (
          <div className="pte-output-info" style={{ marginTop:14 }}>
            <div className="pte-output-info-title">OUTPUT OR GENERATE</div>
            <div className="pte-output-info-body">
              <div className="pte-output-row">
                <span className="pte-output-icon"></span>
                <span>Albedo PNG → processed → <code>.dds</code></span>
              </div>
              {albedoOut && (
                <div className="pte-output-row">
                  <span className="pte-output-icon"></span>
                  <span>Copied to <code title={albedoOut}>
                    {albedoOut.length > 38 ? '…' + albedoOut.slice(-35) : albedoOut}
                  </code></span>
                </div>
              )}
              <div className="pte-output-row pte-output-row-muted">
                <span className="pte-output-icon" style={{fontSize:'0.7rem'}}></span>
                <span><code>.bp</code> → <code>.scd</code> also copied</span>
              </div>
            </div>
          </div>
        )}

        {hasAdj && (
          <button className="pte-reset-all-btn" style={{ marginTop:12, width:'100%' }}
            onClick={() => onChange({ ...DEFAULT_ADJUSTMENTS, _hasBakedPasses: hasBakedPasses }, false)}>
            ↺ Reset all {chips.length} modification{chips.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* ── RIGHT: Controls ───────────────────────────────────────────────── */}
      <div className="pte-controls-panel">

        <div className="pte-controls-header">
          <span className="pte-controls-title">ADJUSTMENTS</span>
          <div className="pte-controls-actions">
            <button className="pte-reset-btn" disabled={!hasAdj}
              onClick={() => onChange({ ...DEFAULT_ADJUSTMENTS, _hasBakedPasses: hasBakedPasses }, false)}>
              Reset
            </button>
          </div>
        </div>

        {/* Basic */}
        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
          <AccentSlider label="Hue Rotation" value={adj.hue}        min={-180} max={180} defaultVal={0}   onChange={v=>upd('hue',v)}        unit="°" accent="#b87cff" />
          <AccentSlider label="Saturation"   value={adj.saturation} min={0}    max={200} defaultVal={100} onChange={v=>upd('saturation',v)} unit="%" accent="#60c8ff" />
          <AccentSlider label="Brightness"   value={adj.brightness} min={0}    max={200} defaultVal={100} onChange={v=>upd('brightness',v)} unit="%" accent="#c8ff60" />
          <AccentSlider label="Contrast"     value={adj.contrast}   min={0}    max={200} defaultVal={100} onChange={v=>upd('contrast',v)}   unit="%" accent="#60c8ff" />
          <AccentSlider label="Gamma"        value={adj.gamma}      min={10}   max={300} defaultVal={100} onChange={v=>upd('gamma',v)}               accent="#ffa860" />
        </div>

        {/* Chips */}
        <div className="pte-adj-summary">
          {chips.length > 0
            ? <div className="pte-adj-chips">{chips.map(c => <span key={c} className="pte-adj-chip">{c}</span>)}</div>
            : <span className="pte-adj-none">No adjustments applied</span>}
        </div>

        {/* Tint */}
        <div>
          <SectionLabel>Tint (Color Overlay)</SectionLabel>
          <AccentSlider label="Opacity" value={adj.tint.opacity} min={0} max={100} defaultVal={0} onChange={v=>updT('opacity',v)} unit="%" accent="#ffa860" />
          {adj.tint.opacity > 0 && (
            <>
              <div style={{ display:'flex', gap:10, alignItems:'center', margin:'8px 0' }}>
                <div style={{ width:28, height:28, borderRadius:5, flexShrink:0,
                  background:`rgb(${adj.tint.r},${adj.tint.g},${adj.tint.b})`,
                  border:'1px solid rgba(255,255,255,0.15)',
                  boxShadow:`0 0 10px rgba(${adj.tint.r},${adj.tint.g},${adj.tint.b},0.4)` }} />
                <div style={{ flex:1 }}>
                  <AccentSlider label="R" value={adj.tint.r} min={0} max={255} defaultVal={255} onChange={v=>updT('r',v)} accent="#ff6060" />
                  <AccentSlider label="G" value={adj.tint.g} min={0} max={255} defaultVal={128} onChange={v=>updT('g',v)} accent="#60ff80" />
                  <AccentSlider label="B" value={adj.tint.b} min={0} max={255} defaultVal={0}   onChange={v=>updT('b',v)} accent="#60a0ff" />
                </div>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {[['Red',255,60,60],['Orange',255,140,0],['Yellow',255,220,0],
                  ['Green',60,200,60],['Teal',0,180,160],['Blue',60,120,255],
                  ['Purple',160,60,255],['Pink',255,80,160],['White',255,255,255],
                ].map(([n,r,g,b]) => (
                  <button key={n}
                    onClick={() => onChange({ ...adj, tint:{ ...adj.tint, r, g, b } }, false)}
                    style={{ padding:'2px 7px', fontSize:'0.63rem', borderRadius:4, cursor:'pointer',
                      background:`rgb(${r},${g},${b})`, border:'1px solid rgba(255,255,255,0.1)',
                      color:(r+g+b)>400?'#000':'#fff', fontFamily:'inherit' }}>{n}</button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Restrict to Region */}
        <div>
          <SectionLabel>Restrict to Region</SectionLabel>
          <InfoBox title="How it works">
            <strong style={{color:'rgba(200,255,96,0.8)'}}>Drag a rectangle</strong> on the adjusted preview (left panel, second image) to restrict all adjustments to that area. Everything outside stays original. Drag to redefine or click Reset to clear.
          </InfoBox>
          {adj.selection.enabled && (
            <div style={{ fontFamily:'monospace', fontSize:'0.64rem', color:'rgba(255,255,255,0.28)',
              marginBottom:8, display:'flex', gap:10 }}>
              <span>X {(adj.selection.x*100).toFixed(0)}%</span>
              <span>Y {(adj.selection.y*100).toFixed(0)}%</span>
              <span>W {(adj.selection.w*100).toFixed(0)}%</span>
              <span>H {(adj.selection.h*100).toFixed(0)}%</span>
            </div>
          )}
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            <button onClick={() => onChange({ ...adj, selection:{ enabled:true, x:0, y:0, w:1, h:1 } }, false)}
              style={{ padding:'3px 10px', fontSize:'0.66rem', borderRadius:4, cursor:'pointer',
                background:'rgba(200,255,96,0.08)', border:'1px solid rgba(200,255,96,0.28)',
                color:'rgba(200,255,96,0.7)', fontFamily:'inherit' }}>Select All</button>
            <button onClick={() => onChange({ ...adj, selection:{ enabled:true, x:0.25, y:0.25, w:0.5, h:0.5 } }, false)}
              style={{ padding:'3px 10px', fontSize:'0.66rem', borderRadius:4, cursor:'pointer',
                background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)',
                color:'rgba(255,255,255,0.38)', fontFamily:'inherit' }}>Center 50%</button>
            <button onClick={() => onChange({ ...adj, selection:{ ...DEFAULT_ADJUSTMENTS.selection, enabled:false } }, false)}
              style={{ padding:'3px 10px', fontSize:'0.66rem', borderRadius:4, cursor:'pointer',
                background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)',
                color:'rgba(255,255,255,0.38)', fontFamily:'inherit' }}>Reset</button>
          </div>
        </div>

      </div>
    </div>
  );
});
PropEditor.displayName = 'PropEditor';

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PropTextureEditor({ selectedProps, onConfirm, onBack, onClose }) {
  const total = selectedProps?.length ?? 0;

  // Session key scoped to the set of selected prop IDs — survives tab switches
  const SESSION_KEY = `pte:${selectedProps?.map(p => p.id ?? p.gamePath).join('|')}`;

  const [adjMap, setAdjMapRaw] = useState(() => {
    // Try restoring from sessionStorage first
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      if (saved.adjMap && Object.keys(saved.adjMap).length > 0) return saved.adjMap;
    } catch {}
    // Fall back to props' stored adjustments
    const map = {};
    selectedProps?.forEach((p, i) => {
      const ex = p.textureAdjustments;
      map[i] = {
        ...DEFAULT_ADJUSTMENTS, ...(ex ?? {}),
        tint:           { ...DEFAULT_ADJUSTMENTS.tint,           ...(ex?.tint           ?? {}) },
        selectiveColor: { ...DEFAULT_ADJUSTMENTS.selectiveColor, ...(ex?.selectiveColor  ?? {}) },
        selection:      { ...DEFAULT_ADJUSTMENTS.selection,      ...(ex?.selection       ?? {}) },
      };
    });
    return map;
  });

  // Wrap setAdjMap so every change is immediately saved to sessionStorage
  const setAdjMap = useCallback((updater) => {
    setAdjMapRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        const existing = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...existing, adjMap: next }));
      } catch {}
      return next;
    });
  }, [SESSION_KEY]);

  const clearSession = useCallback(() => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  }, [SESSION_KEY]);

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      return saved.activeTab ?? 0;
    } catch { return 0; }
  });

  // Persist activeTab too — and snapshot the current tab's baked canvas DataURL + history
  // before switching, since PropEditor unmounts (key={activeTab}) and its canvas is lost.
  const handleSetActiveTab = useCallback((i) => {
    const bakedDataUrl = editorRef.current?.getBaseDataUrl() ?? null;
    const history      = editorRef.current?.getHistory()     ?? null;
    if (bakedDataUrl || history) {
      if (activeLodKey === null) {
        // LOD0 active — snapshot into adjMap
        setAdjMap(prev => {
          const cur = prev[activeTab];
          if (!cur?._hasBakedPasses) return prev;
          const updated = { ...cur };
          if (bakedDataUrl && cur._bakedImageDataUrl !== bakedDataUrl)
            updated._bakedImageDataUrl = bakedDataUrl;
          if (history) {
            const passes = history.map(e => e.adj).filter(Boolean);
            if (passes.length) updated._bakedPasses = passes;
          }
          if (updated === cur) return prev;
          return { ...prev, [activeTab]: updated };
        });
      } else {
        // LOD sub-tab active — snapshot into lodAdjMap
        setLodAdjMap(prev => {
          const cur = prev[activeTab]?.[activeLodKey];
          if (!cur?._hasBakedPasses) return prev;
          const updated = { ...cur };
          if (bakedDataUrl && cur._bakedImageDataUrl !== bakedDataUrl)
            updated._bakedImageDataUrl = bakedDataUrl;
          if (history) {
            const passes = history.map(e => e.adj).filter(Boolean);
            if (passes.length) updated._bakedPasses = passes;
          }
          return { ...prev, [activeTab]: { ...prev[activeTab], [activeLodKey]: updated } };
        });
      }
    }
    setActiveTab(i);
    setActiveLodKey(null); // reset LOD sub-tab on prop tab switch
    try {
      const existing = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...existing, activeTab: i }));
    } catch {}
  }, [SESSION_KEY, activeTab]);

  // ── LOD sub-tab state ────────────────────────────────────────────────────
  // activeLodKey: null = LOD0 (main), '2' = LOD2, '3' = LOD3, etc.
  const [activeLodKey, setActiveLodKey] = useState(null);

  // ── Pass-to-others overlay ───────────────────────────────────────────────
  // passOverlay: null = closed, { adj } = open with source adj (selection stripped)
  const [passOverlay, setPassOverlay] = useState(null);
  // passTargets: Set of strings "propIndex:lodKey" ('propIndex:lod0' for main)
  const [passTargets, setPassTargets] = useState(new Set());
  // per-key remount counters — only the affected key gets bumped, others stay mounted
  const [remountCounters, setRemountCounters] = useState({});

  // lodAdjMap[propIndex][lodKey] = adj  — separate adjustments per LOD per prop
  const [lodAdjMap, setLodAdjMap] = useState(() => {
    const map = {};
    selectedProps?.forEach((p, i) => {
      map[i] = {};
      if (p.lodPreviewUrls) {
        Object.keys(p.lodPreviewUrls).forEach(lodKey => {
          const ex = p.lodTextureAdjustments?.[lodKey];
          map[i][lodKey] = {
            ...DEFAULT_ADJUSTMENTS, ...(ex ?? {}),
            tint:           { ...DEFAULT_ADJUSTMENTS.tint,           ...(ex?.tint           ?? {}) },
            selectiveColor: { ...DEFAULT_ADJUSTMENTS.selectiveColor, ...(ex?.selectiveColor  ?? {}) },
            selection:      { ...DEFAULT_ADJUSTMENTS.selection,      ...(ex?.selection       ?? {}) },
          };
        });
      }
    });
    return map;
  });

  const activeProp = selectedProps[activeTab];
  const lodKeys = activeProp?.lodPreviewUrls ? Object.keys(activeProp.lodPreviewUrls).sort() : [];
  const hasLods = lodKeys.length > 0;

  // Current effective adj and previewUrl for the active LOD sub-tab
  const effectiveAdj = activeLodKey !== null
    ? (lodAdjMap[activeTab]?.[activeLodKey] ?? DEFAULT_ADJUSTMENTS)
    : (adjMap[activeTab] ?? DEFAULT_ADJUSTMENTS);

  const effectivePreviewUrl = activeLodKey !== null
    ? activeProp?.lodPreviewUrls?.[activeLodKey]
    : null; // null = use prop.previewUrl (LOD0)

  const editorRef = useRef(null);
  if (!total) { onBack(); return null; }

  const handleChange = (adj) => {
    setAdjMap(prev => ({ ...prev, [activeTab]: adj }));
  };

  const handleLodChange = (adj) => {
    if (activeLodKey === null) {
      handleChange(adj);
    } else {
      setLodAdjMap(prev => ({
        ...prev,
        [activeTab]: { ...prev[activeTab], [activeLodKey]: adj },
      }));
    }
  };

  // Strip selection from a pass adj before copying to other targets
  const stripSelection = (adj) => ({
    ...adj,
    selection: { ...DEFAULT_ADJUSTMENTS.selection, enabled: false },
    _bakedImageDataUrl: undefined,
    _bakedPasses:       undefined,
    _hasBakedPasses:    undefined,
  });

  const handlePassClick = (passAdj) => {
    setPassTargets(new Set());
    setPassOverlay({ adj: passAdj });
  };

  const handlePassOverlayConfirm = async () => {
    if (!passOverlay || passTargets.size === 0) { setPassOverlay(null); return; }
    const cleanAdj = stripSelection(passOverlay.adj);

    // Helper: load a dataUrl string into a canvas element
    const loadCanvas = (dataUrl) => new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve(c);
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });

    // Helper: build PROP_SESSION_KEY the same way PropEditor does
    const makeSessionKey = (prop, resolvedPreviewUrl) =>
      `pte-prop:${prop.id ?? prop.previewUrl ?? prop.gamePath}:${resolvedPreviewUrl ?? ''}`;

    for (const key of passTargets) {
      const [idxStr, lodKey] = key.split(':');
      const idx = parseInt(idxStr, 10);
      const prop = selectedProps[idx];
      if (!prop) continue;

      const isLod0 = lodKey === 'lod0';
      const resolvedPreviewUrl = isLod0
        ? (prop.previewUrl ?? null)
        : (prop.lodPreviewUrls?.[lodKey] ?? null);
      const sessionKey = makeSessionKey(prop, resolvedPreviewUrl);

      // Read existing session for this prop/lod
      let saved = {};
      try { saved = JSON.parse(sessionStorage.getItem(sessionKey) || '{}'); } catch {}

      // Determine current base canvas (last baked frame, or src, or from adjMap)
      let baseDataUrl = null;
      if (saved.history?.length > 0) {
        baseDataUrl = saved.history[saved.history.length - 1].dataUrl;
      } else if (saved.srcDataUrl) {
        baseDataUrl = saved.srcDataUrl;
      } else {
        // Check if adjMap/lodAdjMap already has a baked image from a previous Apply Changes
        const existingAdj = isLod0
          ? (adjMap[idx] ?? null)
          : (lodAdjMap[idx]?.[lodKey] ?? null);
        if (existingAdj?._bakedImageDataUrl) {
          baseDataUrl = existingAdj._bakedImageDataUrl;
        } else if (resolvedPreviewUrl) {
          // Last resort — load fresh from previewUrl (works for file:// and https://)
          const freshCanvas = await loadPreviewUrlToCanvas(resolvedPreviewUrl);
          if (freshCanvas) baseDataUrl = freshCanvas.toDataURL('image/png');
        }
      }
      if (!baseDataUrl) continue;

      const baseCanvas = await loadCanvas(baseDataUrl);
      if (!baseCanvas) continue;

      // Bake cleanAdj onto baseCanvas
      const bakedCanvas = renderPreview(baseCanvas, cleanAdj);
      const bakedDataUrl = bakedCanvas.toDataURL('image/png');

      // Build label for the new pass
      const parts = [
        cleanAdj.hue !== 0          && `Hue ${cleanAdj.hue > 0 ? '+' : ''}${cleanAdj.hue}°`,
        cleanAdj.saturation !== 100 && `Sat ${cleanAdj.saturation}%`,
        cleanAdj.brightness !== 100 && `Bri ${cleanAdj.brightness}%`,
        cleanAdj.contrast !== 100   && `Con ${cleanAdj.contrast}%`,
        cleanAdj.gamma !== 100      && `Gamma ${cleanAdj.gamma}`,
        cleanAdj.tint?.opacity > 0  && `Tint ${cleanAdj.tint.opacity}%`,
      ].filter(Boolean);
      const label = parts.join(' · ') || 'Pass';

      const newHistoryEntry = { dataUrl: bakedDataUrl, label, adj: cleanAdj };
      const updatedHistory = [...(saved.history ?? []), newHistoryEntry];

      // Write back to sessionStorage — always include srcDataUrl so the editor
      // has a valid base when it mounts for the first time after this inject.
      try {
        sessionStorage.setItem(sessionKey, JSON.stringify({
          ...saved,
          srcDataUrl: saved.srcDataUrl ?? baseDataUrl, // keep original src if already present
          history: updatedHistory,
        }));
      } catch {}

      // Update adjMap / lodAdjMap so the stored adj reflects _hasBakedPasses
      const newAdj = {
        ...DEFAULT_ADJUSTMENTS,
        _hasBakedPasses: true,
        _bakedImageDataUrl: bakedDataUrl,
        _bakedPasses: updatedHistory.map(e => e.adj).filter(Boolean),
      };
      if (isLod0) {
        setAdjMap(prev => ({ ...prev, [idx]: newAdj }));
      } else {
        setLodAdjMap(prev => ({
          ...prev,
          [idx]: { ...(prev[idx] ?? {}), [lodKey]: newAdj },
        }));
      }
    }

    setPassOverlay(null);

    // Only force-remount the currently visible PropEditor — it's already mounted and
    // won't re-read sessionStorage on its own. All other tabs will pick up their updated
    // sessionStorage naturally the next time they're switched to (they're unmounted).
    const activeKey = `${activeTab}:${activeLodKey ?? 'lod0'}`;
    if (passTargets.has(activeKey)) {
      setRemountCounters(prev => ({ ...prev, [activeKey]: (prev[activeKey] ?? 0) + 1 }));
    }
  };

  const handleConfirm = () => {
    // _bakedImageDataUrl is already stored in adjMap/lodAdjMap at the moment
    // of each "Apply Changes" bake — no canvas snapshot needed here.
    clearSession();
    onConfirm(selectedProps.map((prop, i) => ({
      ...prop,
      textureAdjustments:    adjMap[i] ?? DEFAULT_ADJUSTMENTS,
      lodTextureAdjustments: Object.keys(lodAdjMap[i] ?? {}).length > 0
        ? lodAdjMap[i]
        : undefined,
    })));
  };

  const editedCount = Object.values(adjMap).filter(adjHasChanges).length;

  return (
    <>
      <div className="pte-backdrop" onClick={() => { clearSession(); onBack(); }} />
      <div className="pte-window" onClick={e => e.stopPropagation()}>
        <div className="pte-accent-line" />

        <div className="pte-header">
          <div className="pte-header-left">
            <div>
              <div className="pte-header-title">Texture Adjustments</div>
              <div className="pte-header-sub">
                {total} prop{total !== 1 ? 's' : ''} selected
                {editedCount > 0 && <span className="pte-modified-badge">{editedCount} modified</span>}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <button className="btn-delete-sm" onClick={() => { clearSession(); onClose(); }}>×</button>
          </div>
        </div>


        <div className="pte-body">
          <div className="pte-tabs-bar">
            <div className="pte-tabs-scroll">
              {selectedProps.map((prop, i) => {
                const isActive = i === activeTab;
                const hasAdj   = adjHasChanges(adjMap[i]);
                return (
                  <button key={prop.id ?? i}
                    className={`pte-tab${isActive ? ' active' : ''}${hasAdj ? ' modified' : ''}`}
                    onClick={() => handleSetActiveTab(i)}>
                    {prop.previewUrl
                      ? <img src={prop.previewUrl} alt="" className="pte-tab-thumb" />
                      : <span className="pte-tab-thumb pte-tab-fallback"></span>}
                    <span className="pte-tab-name">
                      {prop.name || prop.propName || prop.id || `Prop ${i+1}`}
                    </span>
                    {hasAdj && <span className="pte-tab-dot" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
            {/* ── LOD Sub-Tabs (only when this prop has LOD textures) ─── */}
            {hasLods && (
              <div style={{
                display:'flex', alignItems:'center', gap:4,
                padding:'6px 16px 0',
                borderBottom:'1px solid rgba(255,255,255,0.07)',
                background:'rgba(0,0,0,0.15)',
                flexShrink:0,
              }}>
                <span style={{ fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.14em',
                  textTransform:'uppercase', color:'rgba(255,255,255,0.22)', marginRight:6 }}>LOD</span>
                {/* LOD0 tab */}
                {[null, ...lodKeys].map(key => {
                  const isActive = key === activeLodKey;
                  const label    = key === null ? 'LOD0 (main)' : `LOD${key}`;
                  const thisAdj  = key === null
                    ? (adjMap[activeTab] ?? DEFAULT_ADJUSTMENTS)
                    : (lodAdjMap[activeTab]?.[key] ?? DEFAULT_ADJUSTMENTS);
                  const hasChange = adjHasChanges(thisAdj);
                  return (
                    <button key={key ?? 'lod0'}
                      onClick={() => {
                        // Snapshot current canvas before switching LOD sub-tab
                        const dataUrl = editorRef.current?.getBaseDataUrl() ?? null;
                        const hist    = editorRef.current?.getHistory()     ?? null;
                        if (dataUrl || hist) {
                          if (activeLodKey === null) {
                            setAdjMap(prev => {
                              const cur = prev[activeTab];
                              if (!cur?._hasBakedPasses) return prev;
                              const upd = { ...cur };
                              if (dataUrl && cur._bakedImageDataUrl !== dataUrl) upd._bakedImageDataUrl = dataUrl;
                              if (hist) { const p = hist.map(e => e.adj).filter(Boolean); if (p.length) upd._bakedPasses = p; }
                              return { ...prev, [activeTab]: upd };
                            });
                          } else {
                            setLodAdjMap(prev => {
                              const cur = prev[activeTab]?.[activeLodKey];
                              if (!cur?._hasBakedPasses) return prev;
                              const upd = { ...cur };
                              if (dataUrl && cur._bakedImageDataUrl !== dataUrl) upd._bakedImageDataUrl = dataUrl;
                              if (hist) { const p = hist.map(e => e.adj).filter(Boolean); if (p.length) upd._bakedPasses = p; }
                              return { ...prev, [activeTab]: { ...prev[activeTab], [activeLodKey]: upd } };
                            });
                          }
                        }
                        setActiveLodKey(key);
                      }}
                      style={{
                        padding:'3px 10px 5px',
                        fontSize:'0.68rem', fontWeight:600, fontFamily:'inherit',
                        border:'none', borderRadius:'4px 4px 0 0', cursor:'pointer',
                        background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                        color: isActive
                          ? 'rgba(255,255,255,0.85)'
                          : 'rgba(255,255,255,0.35)',
                        borderBottom: isActive
                          ? '2px solid rgba(200,255,96,0.7)'
                          : '2px solid transparent',
                        position:'relative',
                        transition:'color 0.15s',
                      }}>
                      {label}
                      {hasChange && (
                        <span style={{ width:5, height:5, borderRadius:'50%',
                          background:'#c8ff60', display:'inline-block',
                          marginLeft:5, verticalAlign:'middle' }} />
                      )}
                    </button>
                  );
                })}
                {/* "Copy LOD0 → this LOD" button when on a non-LOD0 tab */}
                {activeLodKey !== null && (
                  <button
                    title="Copy current LOD0 adjustments to this LOD as starting point"
                    onClick={() => {
                      const lod0adj = adjMap[activeTab] ?? DEFAULT_ADJUSTMENTS;
                      setLodAdjMap(prev => ({
                        ...prev,
                        [activeTab]: { ...prev[activeTab], [activeLodKey]: { ...lod0adj } },
                      }));
                    }}
                    style={{
                      marginLeft:'auto', padding:'2px 9px',
                      fontSize:'0.62rem', fontFamily:'inherit',
                      background:'rgba(200,255,96,0.06)', border:'1px solid rgba(200,255,96,0.25)',
                      color:'rgba(200,255,96,0.6)', borderRadius:4, cursor:'pointer',
                    }}>
                    ← Copy from LOD0
                  </button>
                )}
              </div>
            )}

            <div style={{ flex:1, overflow:'hidden' }}>
            <PropEditor
              ref={editorRef}
              key={`${activeTab}:${activeLodKey ?? 'lod0'}:${remountCounters[`${activeTab}:${activeLodKey ?? 'lod0'}`] ?? 0}`}
              prop={selectedProps[activeTab]}
              adj={effectiveAdj}
              onChange={handleLodChange}
              totalProps={total}
              activePreviewUrl={effectivePreviewUrl}
              onPassClick={handlePassClick}
            />
            </div>
          </div>
        </div>

        {/* ── Pass-to-others overlay — Luxury Modal ───────────────────────── */}
        {passOverlay && (() => {
          const srcAdj = passOverlay.adj;
          const passChips = [
            srcAdj.hue !== 0           && `Hue ${srcAdj.hue > 0 ? '+' : ''}${srcAdj.hue}°`,
            srcAdj.saturation !== 100  && `Sat ${srcAdj.saturation}%`,
            srcAdj.brightness !== 100  && `Bri ${srcAdj.brightness}%`,
            srcAdj.contrast !== 100    && `Con ${srcAdj.contrast}%`,
            srcAdj.gamma !== 100       && `Gamma ${srcAdj.gamma}`,
            srcAdj.tint?.opacity > 0   && `Tint ${srcAdj.tint.opacity}%`,
          ].filter(Boolean);
          const passLabel = passChips.join(' · ') || 'Pass';

          const toggleTarget = (key) => setPassTargets(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
          });

          const allKeys = [];
          selectedProps.forEach((p, i) => {
            allKeys.push(`${i}:lod0`);
            if (p.lodPreviewUrls) {
              Object.keys(p.lodPreviewUrls).sort().forEach(k => allKeys.push(`${i}:${k}`));
            }
          });
          const allSelected = allKeys.length > 0 && allKeys.every(k => passTargets.has(k));

          // Accent color — matches customprops theme from THEME_COLORS
          const ACCENT       = '#3EA387';
          const ACCENT_GLOW  = 'rgba(62,163,135,0.32)';
          const ACCENT_DIM   = 'rgba(62,163,135,0.18)';
          const ACCENT_EDGE  = 'rgba(62,163,135,0.55)';
          const ACCENT_TEXT  = 'rgba(62,163,135,0.92)';

          return (
            <div style={{
              position:'absolute', inset:0, zIndex:200,
              background:'rgba(0,0,0,0.62)',
              backdropFilter:'blur(6px)',
              display:'flex', alignItems:'center', justifyContent:'center',
              animation:'luxOverlayIn 0.25s cubic-bezier(0.23,1,0.32,1) forwards',
            }}
              onClick={(e) => { if (e.target === e.currentTarget) setPassOverlay(null); }}
            >
              <style>{`
                @keyframes luxOverlayIn { from{opacity:0} to{opacity:1} }
                @keyframes luxModalIn { from{opacity:0;transform:translateY(20px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
                .pass-lod-chip { transition: background 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s; }
                .pass-lod-chip:hover { background: rgba(62,163,135,0.12) !important; border-color: rgba(62,163,135,0.5) !important; color: rgba(62,163,135,0.9) !important; }
                .pass-cancel-btn { transition: all 0.35s cubic-bezier(0.23,1,0.32,1); position:relative; overflow:hidden; }
                .pass-cancel-btn::before { content:''; position:absolute; top:0; left:0; width:0%; height:100%; background:linear-gradient(135deg,rgba(62,163,135,0.9),rgba(255,255,255,0.6)); transition:width 0.5s cubic-bezier(0.23,1,0.32,1); z-index:-1; }
                .pass-cancel-btn:hover { border-color: ${ACCENT} !important; color:#000 !important; box-shadow:0 0 24px ${ACCENT_GLOW},0 4px 16px rgba(0,0,0,0.4) !important; transform:translateY(-2px); }
                .pass-cancel-btn:hover::before { width:100%; }
                .pass-confirm-btn { transition: all 0.35s cubic-bezier(0.23,1,0.32,1); position:relative; overflow:hidden; }
                .pass-confirm-btn::before { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,0.28),transparent); transform:translateX(-100%); transition:transform 0.5s cubic-bezier(0.23,1,0.32,1); }
                .pass-confirm-btn:not(:disabled):hover { filter:brightness(1.18); box-shadow:0 0 32px ${ACCENT_GLOW},0 6px 18px rgba(0,0,0,0.5) !important; transform:translateY(-2px); }
                .pass-confirm-btn:not(:disabled):hover::before { transform:translateX(100%); }
                .pass-confirm-btn:disabled { opacity:0.32; cursor:not-allowed; }
                .pass-selectall-row { transition: background 0.2s; }
                .pass-selectall-row:hover { background: rgba(255,255,255,0.04) !important; }
              `}</style>

              {/* Modal shell */}
              <div style={{
                position:'relative',
                width:540, maxWidth:'calc(100vw - 40px)',
                maxHeight:'82vh',
                fontFamily:"'Poppins', sans-serif",
                color:'#fff',
                display:'flex', flexDirection:'column',
                overflow:'hidden',
                background:'linear-gradient(135deg,rgba(255,255,255,0.055) 0%,rgba(255,255,255,0.012) 50%,rgba(0,0,0,0.28) 100%)',
                border:'1px solid rgba(255,255,255,0.08)',
                backdropFilter:'blur(22px) saturate(180%)',
                boxShadow:`0 32px 80px rgba(0,0,0,0.75), 0 0 56px ${ACCENT_GLOW}, inset 0 1px 0 rgba(255,255,255,0.07)`,
                animation:'luxModalIn 0.32s cubic-bezier(0.23,1,0.32,1) forwards',
              }}>

                {/* Top accent line */}
                <div style={{
                  position:'absolute', top:0, left:0, right:0, height:3,
                  background:`linear-gradient(90deg, transparent 0%, ${ACCENT} 50%, transparent 100%)`,
                  boxShadow:`0 0 22px rgba(62,163,135,0.7)`,
                }} />

                {/* Header */}
                <div style={{ padding:'32px 34px 0' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <h2 style={{
                        fontFamily:"'Space Grotesk', sans-serif",
                        fontSize:'0.8rem', fontWeight:700,
                        letterSpacing:'0.2em', textTransform:'uppercase',
                        color: ACCENT_TEXT,
                        textShadow:`0 0 18px ${ACCENT_GLOW}`,
                        margin:'0 0 6px',
                      }}>Apply pass to…</h2>
                      {/* Pass descriptor chips */}
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:2 }}>
                        {passChips.length > 0 ? passChips.map(chip => (
                          <span key={chip} style={{
                            fontSize:'0.6rem', fontWeight:600, letterSpacing:'0.1em',
                            textTransform:'uppercase',
                            padding:'2px 8px',
                            background: ACCENT_DIM,
                            border:`1px solid ${ACCENT_EDGE}`,
                            color: ACCENT_TEXT,
                          }}>{chip}</span>
                        )) : (
                          <span style={{ fontSize:'0.62rem', color:'rgba(255,255,255,0.3)', fontStyle:'italic' }}>No adjustments</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => setPassOverlay(null)} style={{
                      flexShrink:0, background:'transparent', border:'none',
                      color:'rgba(255,255,255,0.28)', fontSize:'1.1rem',
                      cursor:'pointer', lineHeight:1, padding:'2px 4px',
                      transition:'color 0.2s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,0.75)'}
                      onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.28)'}
                    >✕</button>
                  </div>
                  {/* Title underline */}
                  <div style={{
                    width:'100%', height:1, marginTop:16,
                    background:`linear-gradient(90deg, ${ACCENT} 0%, transparent 100%)`,
                    opacity:0.4,
                  }} />
                </div>

                {/* Select-all row */}
                <div className="pass-selectall-row" style={{
                  margin:'0 34px', padding:'12px 14px',
                  display:'flex', alignItems:'center', gap:12,
                  borderBottom:'1px solid rgba(255,255,255,0.06)',
                  cursor:'pointer',
                }}
                  onClick={() => setPassTargets(allSelected ? new Set() : new Set(allKeys))}
                >
                  {/* Custom checkbox */}
                  <div style={{
                    width:16, height:16, flexShrink:0,
                    background: allSelected ? ACCENT_DIM : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${allSelected ? ACCENT : 'rgba(255,255,255,0.18)'}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'all 0.2s',
                    boxShadow: allSelected ? `0 0 8px ${ACCENT_GLOW}` : 'none',
                  }}>
                    {allSelected && <span style={{ fontSize:'0.6rem', color: ACCENT, lineHeight:1 }}>✓</span>}
                  </div>
                  <span style={{
                    fontSize:'0.72rem', fontWeight:600, letterSpacing:'0.1em',
                    textTransform:'uppercase',
                    color: allSelected ? ACCENT_TEXT : 'rgba(255,255,255,0.38)',
                    transition:'color 0.2s',
                  }}>Select all</span>
                  <span style={{ marginLeft:'auto', fontSize:'0.63rem', color:'rgba(255,255,255,0.22)', letterSpacing:'0.06em' }}>
                    {passTargets.size} / {allKeys.length}
                  </span>
                </div>

                {/* Prop × LOD list — scrollable body */}
                <div style={{
                  flex:1, overflowY:'auto', padding:'18px 34px 24px',
                  display:'flex', flexDirection:'column', gap:20,
                }}>
                  {selectedProps.map((p, i) => {
                    const propLodKeys = p.lodPreviewUrls ? Object.keys(p.lodPreviewUrls).sort() : [];
                    const propName = p.customName?.trim() || p.originalProp?.name || p.gamePath?.split('/').pop() || `Prop ${i+1}`;
                    const anyCheckedInProp = ['lod0', ...propLodKeys].some(lk => passTargets.has(`${i}:${lk}`));
                    return (
                      <div key={i}>
                        {/* Prop label */}
                        <div style={{
                          fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.18em',
                          textTransform:'uppercase', marginBottom:9,
                          color: anyCheckedInProp ? ACCENT_TEXT : 'rgba(255,255,255,0.32)',
                          transition:'color 0.2s',
                          display:'flex', alignItems:'center', gap:8,
                        }}>
                          <span style={{
                            width:3, height:12, flexShrink:0,
                            background: anyCheckedInProp ? ACCENT : 'rgba(255,255,255,0.15)',
                            transition:'background 0.2s',
                          }} />
                          {propName}
                        </div>
                        {/* LOD chips */}
                        <div style={{ display:'flex', flexWrap:'wrap', gap:7, paddingLeft:11 }}>
                          {['lod0', ...propLodKeys].map(lk => {
                            const key = `${i}:${lk}`;
                            const checked = passTargets.has(key);
                            const chipLabel = lk === 'lod0' ? 'LOD0 — main' : `LOD${lk}`;
                            return (
                              <div key={lk} className="pass-lod-chip"
                                onClick={() => toggleTarget(key)}
                                style={{
                                  display:'flex', alignItems:'center', gap:8,
                                  padding:'8px 14px',
                                  cursor:'pointer', userSelect:'none',
                                  background: checked ? ACCENT_DIM : 'rgba(255,255,255,0.03)',
                                  border: `1px solid ${checked ? ACCENT_EDGE : 'rgba(255,255,255,0.08)'}`,
                                  color: checked ? ACCENT_TEXT : 'rgba(255,255,255,0.35)',
                                  boxShadow: checked ? `0 0 12px ${ACCENT_GLOW}` : 'none',
                                  borderRadius:0,
                                }}>
                                {/* Inline checkbox */}
                                <div style={{
                                  width:12, height:12, flexShrink:0,
                                  background: checked ? ACCENT_DIM : 'rgba(255,255,255,0.05)',
                                  border: `1px solid ${checked ? ACCENT : 'rgba(255,255,255,0.2)'}`,
                                  display:'flex', alignItems:'center', justifyContent:'center',
                                  transition:'all 0.18s',
                                  borderRadius:0,
                                }}>
                                  {checked && <span style={{ fontSize:'0.5rem', color: ACCENT, lineHeight:1 }}>✓</span>}
                                </div>
                                <span style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' }}>
                                  {chipLabel}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div style={{
                  display:'flex', gap:12, justifyContent:'flex-end',
                  padding:'18px 34px 30px',
                  borderTop:'1px solid rgba(255,255,255,0.06)',
                }}>
                  {/* Cancel — btn-secondary style */}
                  <button className="pass-cancel-btn" onClick={() => setPassOverlay(null)} style={{
                    fontFamily:"'Poppins', sans-serif",
                    fontSize:'0.78rem', fontWeight:600,
                    letterSpacing:'0.14em', textTransform:'uppercase',
                    padding:'14px 30px',
                    background:'transparent',
                    border:'1px solid rgba(255,255,255,0.18)',
                    color:'rgba(255,255,255,0.55)',
                    cursor:'pointer',
                    borderRadius:0,
                  }}>Cancel</button>

                  {/* Confirm — btn-primary style */}
                  <button className="pass-confirm-btn"
                    disabled={passTargets.size === 0}
                    onClick={handlePassOverlayConfirm}
                    style={{
                      fontFamily:"'Poppins', sans-serif",
                      fontSize:'0.78rem', fontWeight:600,
                      letterSpacing:'0.14em', textTransform:'uppercase',
                      padding:'14px 32px',
                      background: ACCENT,
                      border:`1px solid ${ACCENT}`,
                      color:'#000',
                      cursor:'pointer',
                      boxShadow:`0 0 18px ${ACCENT_GLOW}`,
                      borderRadius:0,
                    }}>
                    Apply to {passTargets.size} target{passTargets.size !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="pte-footer">
          <div className="pte-footer-left">
            <button className="pte-footer-back" onClick={() => { clearSession(); onBack(); }}>← Back to Library</button>
          </div>
          <div className="pte-footer-right">
            <button className="pte-footer-cancel" onClick={() => { clearSession(); onBack(); }}>Cancel</button>
            <button className="pte-footer-confirm" onClick={handleConfirm}>
              Apply to Selection
              {editedCount > 0 && <span className="pte-footer-badge">{editedCount}</span>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
