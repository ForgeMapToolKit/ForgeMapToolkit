import React, { useState, useRef, useEffect, useCallback } from 'react';

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

// ── Default adjustment state ──────────────────────────────────────────────────
export const DEFAULT_ADJUSTMENTS = {
  hue:        0,
  saturation: 100,
  brightness: 100,
  contrast:   100,
  gamma:      100,
  tint: { r: 255, g: 128, b: 0, opacity: 0 },
  selection: { enabled: false, x: 0, y: 0, w: 1, h: 1 },
};

export const adjHasChanges = (adj) => adj && (
  adj.hue !== 0 || adj.saturation !== 100 ||
  adj.brightness !== 100 || adj.contrast !== 100 ||
  (adj.gamma !== undefined && adj.gamma !== 100) ||
  (adj.tint && adj.tint.opacity > 0) ||
  adj.selection?.enabled
);

// ── Helpers ───────────────────────────────────────────────────────────────────
const clamp = (v, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, v));

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

// Client-side preview render (mirrors main.js applyAdjustments logic)
function renderPreview(srcCanvas, adj) {
  const w = srcCanvas.width, h = srcCanvas.height;
  const offscreen = document.createElement('canvas');
  offscreen.width = w; offscreen.height = h;
  const ctx = offscreen.getContext('2d');
  ctx.drawImage(srcCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  const sel = adj.selection?.enabled ? adj.selection : null;
  const selX0 = sel ? Math.round(sel.x * w)           : 0;
  const selY0 = sel ? Math.round(sel.y * h)            : 0;
  const selX1 = sel ? Math.round((sel.x + sel.w) * w)  : w;
  const selY1 = sel ? Math.round((sel.y + sel.h) * h)  : h;

  const doHueSat = adj.hue !== 0 || adj.saturation !== 100;
  const doBri    = adj.brightness !== 100;
  const doCon    = adj.contrast !== 100;
  const doGamma  = adj.gamma !== undefined && adj.gamma !== 100;
  const doTint   = adj.tint && adj.tint.opacity > 0;
  const doSC     = adj.selectiveColor?.enabled;

  const conF = doCon ? adj.contrast / 100 : 1;
  const conO = doCon ? 128 * (1 - conF) : 0;
  const gammaExp = doGamma ? 1 / (adj.gamma / 100) : 1;

  const gammaLUT = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    gammaLUT[i] = doGamma ? clamp(Math.round(Math.pow(i / 255, gammaExp) * 255)) : i;
  }

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
      if (doBri) { const f = adj.brightness / 100; r = clamp(r*f); g = clamp(g*f); b = clamp(b*f); }
      if (doCon) { r = clamp(r*conF+conO); g = clamp(g*conF+conO); b = clamp(b*conF+conO); }
      if (doGamma) { r = gammaLUT[r]; g = gammaLUT[g]; b = gammaLUT[b]; }
      if (doTint) {
        const a = adj.tint.opacity / 100;
        r = clamp(r*(1-a) + adj.tint.r*a);
        g = clamp(g*(1-a) + adj.tint.g*a);
        b = clamp(b*(1-a) + adj.tint.b*a);
      }
      if (doSC) {
        const sc = adj.selectiveColor;
        const [hh, s, l] = rgbToHsl(r, g, b);
        const diff = Math.abs(((hh - sc.targetHue + 180 + 360) % 360) - 180);
        if (diff <= sc.hueRange) {
          const strength = 1 - diff / sc.hueRange;
          const nh = ((hh + sc.hueShift * strength) % 360 + 360) % 360;
          const ns = clamp(s + sc.satShift * strength, 0, 100);
          const nl = clamp(l + sc.briShift * strength * 0.5, 0, 100);
          [r, g, b] = hslToRgb(nh, ns, nl);
        }
      }
      d[i] = r; d[i+1] = g; d[i+2] = b;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return offscreen;
}

// ── Slider row ────────────────────────────────────────────────────────────────
const Slider = ({ label, value, min, max, step = 1, defaultVal, onChange, unit = '' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
    <span style={{ width: 110, fontSize: 12, color: '#aaa', flexShrink: 0 }}>{label}</span>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ flex: 1, accentColor: '#7c5cff' }} />
    <span style={{ width: 44, fontSize: 12, color: '#eee', textAlign: 'right' }}>
      {value}{unit}
    </span>
    {value !== defaultVal && (
      <button onClick={() => onChange(defaultVal)}
        style={{ fontSize: 10, padding: '1px 5px', background: '#333', border: '1px solid #555',
          color: '#aaa', borderRadius: 3, cursor: 'pointer', flexShrink: 0 }}>↺</button>
    )}
  </div>
);

// ── Hue wheel strip ───────────────────────────────────────────────────────────
const HueStrip = ({ value, onChange }) => {
  const grad = 'linear-gradient(to right,' +
    'hsl(0,100%,50%),hsl(30,100%,50%),hsl(60,100%,50%),hsl(90,100%,50%),' +
    'hsl(120,100%,50%),hsl(150,100%,50%),hsl(180,100%,50%),hsl(210,100%,50%),' +
    'hsl(240,100%,50%),hsl(270,100%,50%),hsl(300,100%,50%),hsl(330,100%,50%),hsl(360,100%,50%))';
  const pct = ((value % 360 + 360) % 360) / 360 * 100;
  return (
    <div style={{ position: 'relative', height: 18, borderRadius: 4, background: grad, cursor: 'pointer', marginBottom: 4 }}
      onClick={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        onChange(Math.round(x * 360) - 180);
      }}>
      <div style={{ position: 'absolute', left: `${pct}%`, top: 0, bottom: 0, width: 2,
        background: '#fff', boxShadow: '0 0 3px #000', transform: 'translateX(-50%)' }} />
    </div>
  );
};

// ── Main Overlay ──────────────────────────────────────────────────────────────
const TextureAdjustOverlay = ({ previewUrl, propName, initialAdj, onConfirm, onClose }) => {
  // ── Session persistence key (survives tab switches within the same session) ──
  const SESSION_KEY = `tao:${propName}`;

  // ── adj: initialise from sessionStorage if available, else from initialAdj ──
  const [adj, setAdjRaw] = useState(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.adj) return parsed.adj;
      }
    } catch {}
    return {
      ...DEFAULT_ADJUSTMENTS, ...initialAdj,
      tint:          { ...DEFAULT_ADJUSTMENTS.tint,          ...(initialAdj?.tint          ?? {}) },
      selectiveColor:{ ...DEFAULT_ADJUSTMENTS.selectiveColor,...(initialAdj?.selectiveColor ?? {}) },
      selection:     { ...DEFAULT_ADJUSTMENTS.selection,     ...(initialAdj?.selection      ?? {}) },
    };
  });

  // Wrap setAdj so every change is immediately saved to sessionStorage
  const setAdj = useCallback((updater) => {
    setAdjRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        const existing = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...existing, adj: next }));
      } catch {}
      return next;
    });
  }, [SESSION_KEY]);

  const clearSession = useCallback(() => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  }, [SESSION_KEY]);

  const [tab, setTab]           = useState('basic');     // basic | tint | selective | selection
  const [srcCanvas, setSrcCanvas]   = useState(null);
  const [previewCanvas, setPreviewCanvas] = useState(null);
  const [loading, setLoading]   = useState(true);

  // Selection drag state
  const selCanvasRef      = useRef(null);
  const dragging          = useRef(false);
  const dragStart         = useRef({ x: 0, y: 0 });
  const animFrame         = useRef(null);

  const upd = (key, val) => setAdj(a => ({ ...a, [key]: val }));
  const updTint = (key, val) => setAdj(a => ({ ...a, tint: { ...a.tint, [key]: val } }));
  const updSC   = (key, val) => setAdj(a => ({ ...a, selectiveColor: { ...a.selectiveColor, [key]: val } }));
  const updSel  = (key, val) => setAdj(a => ({ ...a, selection: { ...a.selection, [key]: val } }));

  // ── Load source image — restore from sessionStorage cache if available ────
  useEffect(() => {
    if (!previewUrl) { setLoading(false); return; }
    let cancelled = false;

    // Try to restore cached image data from sessionStorage first
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      if (saved?.imgDataUrl) {
        const img = new Image();
        img.onload = () => {
          if (cancelled) return;
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          setSrcCanvas(c);
          setLoading(false);
        };
        img.onerror = () => {}; // fall through to fresh load below
        img.src = saved.imgDataUrl;
        return () => { cancelled = true; };
      }
    } catch {}

    // Fresh load — then cache the result
    loadPreviewUrlToCanvas(previewUrl).then(canvas => {
      if (cancelled) return;
      if (canvas) {
        setSrcCanvas(canvas);
        // Cache the image as a data-URL so re-opening the overlay is instant
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const existing = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...existing, imgDataUrl: dataUrl }));
        } catch {}
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [previewUrl, SESSION_KEY]);

  // ── Re-render preview when adj or srcCanvas changes ──────────────────────
  useEffect(() => {
    if (!srcCanvas) return;
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
    animFrame.current = requestAnimationFrame(() => {
      setPreviewCanvas(renderPreview(srcCanvas, adj));
    });
  }, [adj, srcCanvas]);

  // ── Draw preview + selection rect onto selCanvasRef ──────────────────────
  useEffect(() => {
    const canvas = selCanvasRef.current;
    if (!canvas || !previewCanvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(previewCanvas, 0, 0, canvas.width, canvas.height);

    if (adj.selection.enabled) {
      const { x, y, w, h } = adj.selection;
      const cw = canvas.width, ch = canvas.height;
      // Dim outside
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, cw, y * ch);
      ctx.fillRect(0, (y + h) * ch, cw, ch);
      ctx.fillRect(0, y * ch, x * cw, h * ch);
      ctx.fillRect((x + w) * cw, y * ch, cw, h * ch);
      // Border
      ctx.strokeStyle = '#7c5cff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x * cw + 1, y * ch + 1, w * cw - 2, h * ch - 2);
      ctx.setLineDash([]);
    }
  }, [previewCanvas, adj.selection]);

  // ── Canvas mouse handlers for selection drag ──────────────────────────────
  const onMouseDown = useCallback(e => {
    if (!adj.selection.enabled) return;
    const rect = selCanvasRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top)  / rect.height;
    dragStart.current = { x: nx, y: ny };
    dragging.current  = true;
    setAdj(a => ({ ...a, selection: { ...a.selection, x: nx, y: ny, w: 0, h: 0 } }));
  }, [adj.selection.enabled]);

  const onMouseMove = useCallback(e => {
    if (!dragging.current) return;
    const rect = selCanvasRef.current.getBoundingClientRect();
    const nx = clamp((e.clientX - rect.left) / rect.width,  0, 1);
    const ny = clamp((e.clientY - rect.top)  / rect.height, 0, 1);
    const x  = Math.min(nx, dragStart.current.x);
    const y  = Math.min(ny, dragStart.current.y);
    const w  = Math.abs(nx - dragStart.current.x);
    const h  = Math.abs(ny - dragStart.current.y);
    setAdj(a => ({ ...a, selection: { ...a.selection, x, y, w, h } }));
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  // ── Styles ────────────────────────────────────────────────────────────────
  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(6px)', zIndex: 3000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const modal = {
    background: 'linear-gradient(135deg,#111 0%,#0a0a0a 100%)',
    border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 14,
    boxShadow: '0 24px 80px rgba(0,0,0,0.9)',
    width: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  };
  const tabBtn = (id) => ({
    padding: '6px 16px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
    background: tab === id ? '#7c5cff' : 'transparent',
    color: tab === id ? '#fff' : '#888',
    border: tab === id ? '1px solid #7c5cff' : '1px solid transparent',
    transition: 'all .15s',
  });
  const section = { padding: '0 0 12px 0' };
  const sectionTitle = { fontSize: 11, color: '#7c5cff', letterSpacing: 1, textTransform: 'uppercase',
    marginBottom: 10, paddingBottom: 4, borderBottom: '1px solid rgba(124,92,255,0.2)' };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && (clearSession(), onClose())}>
      <div style={modal}>

        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Texture Adjustments</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{propName}</div>
          </div>
          <button onClick={() => { clearSession(); onClose(); }} style={{ background: 'none', border: 'none', color: '#666',
            fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 20px 0',
          borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {[['basic','Basic'],['tint','Tint'],['selective','Selective Color'],['selection','Selection']].map(([id,label]) => (
            <button key={id} style={tabBtn(id)} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Controls */}
          <div style={{ width: 340, padding: '16px 20px', overflowY: 'auto',
            borderRight: '1px solid rgba(255,255,255,0.06)' }}>

            {tab === 'basic' && (
              <div style={section}>
                <div style={sectionTitle}>Basic</div>
                <Slider label="Hue"        value={adj.hue}        min={-180} max={180} defaultVal={0}   onChange={v => upd('hue', v)} unit="°" />
                <HueStrip value={adj.hue} onChange={v => upd('hue', v)} />
                <Slider label="Saturation" value={adj.saturation} min={0}    max={200} defaultVal={100} onChange={v => upd('saturation', v)} unit="%" />
                <Slider label="Brightness" value={adj.brightness} min={0}    max={200} defaultVal={100} onChange={v => upd('brightness', v)} unit="%" />
                <Slider label="Contrast"   value={adj.contrast}   min={0}    max={200} defaultVal={100} onChange={v => upd('contrast', v)}   unit="%" />
                <Slider label="Gamma"      value={adj.gamma}      min={10}   max={300} defaultVal={100} onChange={v => upd('gamma', v)}     unit=""
                  step={1} />
                <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>
                  Gamma &lt;100 = brighter midtones, &gt;100 = darker midtones
                </div>
              </div>
            )}

            {tab === 'tint' && (
              <div style={section}>
                <div style={sectionTitle}>Tint (Color Overlay)</div>
                <Slider label="Opacity" value={adj.tint.opacity} min={0} max={100} defaultVal={0}
                  onChange={v => updTint('opacity', v)} unit="%" />
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>Color</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 6, flexShrink: 0,
                      background: `rgb(${adj.tint.r},${adj.tint.g},${adj.tint.b})`,
                      border: '1px solid rgba(255,255,255,0.2)' }} />
                    <div style={{ flex: 1 }}>
                      <Slider label="R" value={adj.tint.r} min={0} max={255} defaultVal={255} onChange={v => updTint('r', v)} />
                      <Slider label="G" value={adj.tint.g} min={0} max={255} defaultVal={128} onChange={v => updTint('g', v)} />
                      <Slider label="B" value={adj.tint.b} min={0} max={255} defaultVal={0}   onChange={v => updTint('b', v)} />
                    </div>
                  </div>
                </div>
                {/* Quick color presets */}
                <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>Presets</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    ['Red',    255,  60,  60],['Orange',255,140,  0],['Yellow',255,220,  0],
                    ['Green',   60, 200,  60],['Teal',   0, 180,160],['Blue',  60,120,255],
                    ['Purple', 160,  60,255],['Pink',  255,  80,160],['White', 255,255,255],
                  ].map(([name, r, g, b]) => (
                    <button key={name} onClick={() => setAdj(a => ({ ...a, tint: { ...a.tint, r, g, b } }))}
                      style={{ padding: '3px 8px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
                        background: `rgb(${r},${g},${b})`, border: '1px solid rgba(255,255,255,0.15)',
                        color: (r + g + b) > 400 ? '#000' : '#fff' }}>
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === 'selective' && (
              <div style={section}>
                <div style={sectionTitle}>Selective Color</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <input type="checkbox" checked={adj.selectiveColor.enabled}
                    onChange={e => updSC('enabled', e.target.checked)} id="sc-enabled" />
                  <label htmlFor="sc-enabled" style={{ fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
                    Enable Selective Color
                  </label>
                </div>
                <div style={{ opacity: adj.selectiveColor.enabled ? 1 : 0.35, pointerEvents: adj.selectiveColor.enabled ? 'auto' : 'none' }}>
                  <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>Target Hue</div>
                  {/* Hue wheel for target */}
                  <div style={{ position: 'relative', height: 18, borderRadius: 4, marginBottom: 8, cursor: 'pointer',
                    background: 'linear-gradient(to right,hsl(0,100%,50%),hsl(60,100%,50%),hsl(120,100%,50%),hsl(180,100%,50%),hsl(240,100%,50%),hsl(300,100%,50%),hsl(360,100%,50%))'
                  }} onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    updSC('targetHue', Math.round((e.clientX - rect.left) / rect.width * 360));
                  }}>
                    <div style={{ position: 'absolute', left: `${adj.selectiveColor.targetHue / 360 * 100}%`,
                      top: 0, bottom: 0, width: 2, background: '#fff', boxShadow: '0 0 3px #000',
                      transform: 'translateX(-50%)' }} />
                  </div>
                  <Slider label="Target Hue"  value={adj.selectiveColor.targetHue} min={0}    max={360} defaultVal={120} onChange={v => updSC('targetHue', v)}  unit="°" />
                  <Slider label="Hue Range"   value={adj.selectiveColor.hueRange}  min={1}    max={180} defaultVal={40}  onChange={v => updSC('hueRange', v)}   unit="°" />
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '10px 0' }} />
                  <Slider label="Hue Shift"   value={adj.selectiveColor.hueShift}  min={-180} max={180} defaultVal={0}   onChange={v => updSC('hueShift', v)}   unit="°" />
                  <Slider label="Sat Shift"   value={adj.selectiveColor.satShift}  min={-100} max={100} defaultVal={0}   onChange={v => updSC('satShift', v)}   unit="" />
                  <Slider label="Bright Shift" value={adj.selectiveColor.briShift} min={-100} max={100} defaultVal={0}   onChange={v => updSC('briShift', v)}   unit="" />
                  {/* Target color preview */}
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 4, flexShrink: 0,
                      background: `hsl(${adj.selectiveColor.targetHue},80%,50%)`,
                      border: '1px solid rgba(255,255,255,0.2)' }} />
                    <span style={{ fontSize: 11, color: '#666' }}>Targeting hue ±{adj.selectiveColor.hueRange}°</span>
                  </div>
                </div>
              </div>
            )}

            {tab === 'selection' && (
              <div style={section}>
                <div style={sectionTitle}>Rectangle Selection</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <input type="checkbox" checked={adj.selection.enabled}
                    onChange={e => updSel('enabled', e.target.checked)} id="sel-enabled" />
                  <label htmlFor="sel-enabled" style={{ fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
                    Restrict effects to selection
                  </label>
                </div>
                <div style={{ opacity: adj.selection.enabled ? 1 : 0.35 }}>
                  <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>
                    Draw a rectangle on the preview to select the area where all effects will be applied.
                    Outside the selection stays untouched.
                  </div>
                  {adj.selection.enabled && (
                    <div style={{ fontSize: 11, color: '#666', fontFamily: 'monospace' }}>
                      X: {(adj.selection.x * 100).toFixed(1)}%&nbsp;
                      Y: {(adj.selection.y * 100).toFixed(1)}%&nbsp;
                      W: {(adj.selection.w * 100).toFixed(1)}%&nbsp;
                      H: {(adj.selection.h * 100).toFixed(1)}%
                    </div>
                  )}
                  <button onClick={() => updSel('x', 0) || updSel('y', 0) || updSel('w', 1) || updSel('h', 1)}
                    style={{ marginTop: 8, padding: '4px 12px', fontSize: 11, borderRadius: 4,
                      background: '#222', border: '1px solid #444', color: '#aaa', cursor: 'pointer' }}>
                    Reset Selection
                  </button>
                </div>
              </div>
            )}

            {/* Reset all */}
            <button onClick={() => { clearSession(); setAdj({ ...DEFAULT_ADJUSTMENTS }); }}
              style={{ width: '100%', marginTop: 8, padding: '7px 0', fontSize: 12, borderRadius: 6,
                background: '#1a1a1a', border: '1px solid #333', color: '#888', cursor: 'pointer' }}>
              Reset All Adjustments
            </button>
          </div>

          {/* Preview */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', fontSize: 11, color: '#555',
              borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              Preview {adj.selection.enabled ? '— drag to draw selection' : ''}
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#050505', overflow: 'hidden', position: 'relative' }}>
              {loading && <div style={{ color: '#555', fontSize: 13 }}>Loading…</div>}
              {!loading && !srcCanvas && <div style={{ color: '#555', fontSize: 13 }}>No preview available</div>}
              {!loading && srcCanvas && (
                <canvas ref={selCanvasRef}
                  width={srcCanvas.width} height={srcCanvas.height}
                  style={{
                    maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated',
                    cursor: adj.selection.enabled ? 'crosshair' : 'default',
                  }}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={() => { clearSession(); onClose(); }}
            style={{ padding: '7px 18px', fontSize: 13, borderRadius: 6, cursor: 'pointer',
              background: '#1a1a1a', border: '1px solid #333', color: '#888' }}>
            Cancel
          </button>
          <button onClick={() => { onConfirm(adj); }}
            style={{ padding: '7px 22px', fontSize: 13, borderRadius: 6, cursor: 'pointer',
              background: 'linear-gradient(135deg,#7c5cff,#5a3dd4)',
              border: '1px solid rgba(124,92,255,0.5)', color: '#fff', fontWeight: 600 }}>
            Apply
          </button>
        </div>

      </div>
    </div>
  );
};

export default TextureAdjustOverlay;
