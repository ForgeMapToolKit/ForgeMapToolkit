/**
 * SkyboxGenerator_Configuration.jsx — Sektion 01: Atmosphere & Dome
 *
 * Rein präsentational — keine Hooks, kein IPC, kein State (außer lokale UI-Toggles).
 * Enthält auch FullscreenDome und DomePreview (weil sie nur hier gebraucht werden).
 *
 * Neu (Editor Live-Bridge): EditorBridgeBadge-Komponente + Bridge-Props in
 * Configuration. Keine IPC-Aufrufe hier — Handler kommen als Props vom Parent.
 */
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { hexToRgbArr, hexToHsv, hsvToHex, hueToHex } from './utils.js';

// ── DomePreview-Canvas ────────────────────────────────────────────
export const DomePreview = ({
  horizonColor, zenithColor, horizonHeight, zenithHeight,
  subtractHeight, subdivHeight, scale, showLabels, fullscreen,
}) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
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
    const pxPerUnit  = W / (2 * sc);
    const baseScreenY = H * 0.88;
    const toSY       = (worldY) => baseScreenY - worldY * pxPerUnit;
    const centerX    = W / 2;
    const toSX_right = (worldX) => centerX + worldX * pxPerUnit;
    const toSX_left  = (worldX) => centerX - worldX * pxPerUnit;
    const dispMax    = baseScreenY / pxPerUnit;
    const dispRange  = (H / pxPerUnit) || 1;

    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, H);
    const imageData = ctx.createImageData(W, H);
    const data      = imageData.data;
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
      const get = side === 'right' ? toSX_right : toSX_left;
      ctx.moveTo(get(rings[0].worldX), toSY(rings[0].worldY));
      for (let h = 1; h < sdH; h++) ctx.lineTo(get(rings[h].worldX), toSY(rings[h].worldY));
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
    }
    ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=1; ctx.setLineDash([]); ctx.strokeRect(0,0,W,H);
  }, [horizonColor, zenithColor, horizonHeight, zenithHeight, subtractHeight, subdivHeight, scale, showLabels, fullscreen]);

  const w = fullscreen ? 900 : 420;
  const h = fullscreen ? 560 : 280;
  return <canvas ref={canvasRef} width={w} height={h} style={{width:'100%',display:'block',border:'1px solid rgba(255,255,255,0.08)'}}/>;
};

// ── FullscreenDome Overlay ────────────────────────────────────────
export const FullscreenDome = ({
  horizonColor, setHorizonColor, zenithColor, setZenithColor,
  horizonHeight, setHorizonHeight, zenithHeight, setZenithHeight,
  subtractHeight, subdivHeight, scale, showLabels, setShowLabels, onClose,
}) => {
  const HH_MIN = -200, HH_MAX = 1000;
  const ZH_MIN = -100, ZH_MAX = 1000;
  const hH = parseFloat(horizonHeight) || 0;
  const zH = parseFloat(zenithHeight)  || 256;
  const sphereLerp = Math.max(0, Math.min(1, 1-(parseFloat(subtractHeight)||1.2566)*2/Math.PI));

  return (
    <div className="dome-fullscreen-overlay">
      <div className="dome-fullscreen-inner">
        <div className="dome-fullscreen-sidebar">
          <div className="dome-fs-header">
            <span style={{color:'var(--skybox-generator-color)',fontFamily:'Space Grotesk',fontWeight:700,fontSize:'0.9rem',letterSpacing:'0.1em',textTransform:'uppercase'}}>⬡ Dome Editor</span>
            <button className="btn-delete-sm" onClick={onClose} style={{width:36,height:36,minWidth:36,padding:0,fontSize:'1.1rem'}}>×</button>
          </div>
          <div className="dome-fs-group">
            <label>Horizon Color</label>
            <ColorPicker value={horizonColor} onChange={e=>setHorizonColor(e.target.value)} />
          </div>
          <div className="dome-fs-group">
            <label>Horizon Height</label>
            <div className="dome-fs-slider-row">
              <input type="range" min={HH_MIN} max={HH_MAX} step={1}
                value={Math.max(HH_MIN, Math.min(HH_MAX, hH))}
                onChange={e => setHorizonHeight(e.target.value)} className="dome-fs-slider"/>
              <input className="skybox-input dome-fs-slider-input" value={horizonHeight} onChange={e=>setHorizonHeight(e.target.value)} placeholder="-42.5"/>
            </div>
          </div>
          <div className="dome-fs-divider"/>
          <div className="dome-fs-group">
            <label>Zenith Color</label>
            <ColorPicker value={zenithColor} onChange={e=>setZenithColor(e.target.value)} />
          </div>
          <div className="dome-fs-group">
            <label>Zenith Height</label>
            <div className="dome-fs-slider-row">
              <input type="range" min={ZH_MIN} max={ZH_MAX} step={1}
                value={Math.max(ZH_MIN, Math.min(ZH_MAX, zH))}
                onChange={e => setZenithHeight(e.target.value)} className="dome-fs-slider"/>
              <input className="skybox-input dome-fs-slider-input" value={zenithHeight} onChange={e=>setZenithHeight(e.target.value)} placeholder="293.507"/>
            </div>
          </div>
          <div className="dome-fs-divider"/>
          <div className="dome-fs-stat"><span>SphereLerp</span><span style={{color:'var(--skybox-generator-color)',fontFamily:'monospace'}}>{sphereLerp.toFixed(4)}</span></div>
          <div className="dome-fs-stat"><span>Scale</span><span style={{color:'var(--skybox-generator-color)',fontFamily:'monospace'}}>{Math.round(scale)}</span></div>
          <div className="dome-fs-divider"/>
          <button onClick={()=>setShowLabels(v=>!v)} className="btn-secondary" style={{width:'100%',marginTop:'4px'}}>
            {showLabels?'Hide Labels':'Show Labels'}
          </button>
        </div>
        <div className="dome-fullscreen-canvas">
          <DomePreview horizonColor={horizonColor} zenithColor={zenithColor} horizonHeight={hH} zenithHeight={zH}
            subtractHeight={parseFloat(subtractHeight)||1.2566} subdivHeight={parseInt(subdivHeight)||6}
            scale={scale} showLabels={showLabels} fullscreen={true}/>
        </div>
      </div>
    </div>
  );
};

// ── ColorPicker (Glassmorphic) ────────────────────────────────────
const SKYBOX_PRESET_COLORS = [
  '#020814','#050f2a','#0a1840','#0d2252','#112d6b',
  '#1a3a8c','#2255b0','#2b6cd4','#3b76ff','#60a5fa',
  '#1a1a3a','#1e2850','#243264','#2a3c78','#1e4a70',
  '#2a1828','#3c1e38','#501e3c','#6b2440','#8c2a3c',
  '#5c1e0a','#7a2c14','#9e3820','#c44a2a','#e06030',
  '#6b3c0a','#8a5018','#aa6824','#c8842e','#e8a040',
  '#3c2c18','#5a4022','#7a5830','#9a7040','#b88c52',
  '#b8c4d8','#ccd4e8','#dce4f2','#eaf0f8','#f4f8fc',
];

export const ColorPicker = ({ value, onChange }) => {
  const isValidHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v);
  const safeValue  = isValidHex(value) ? value : '#3b76ff';
  const [open,       setOpen]       = useState(false);
  const [hexEdit,    setHexEdit]    = useState('');
  const [rgbEdit,    setRgbEdit]    = useState({ r:'', g:'', b:'' });
  const [editingHex, setEditingHex] = useState(false);
  const [editingRgb, setEditingRgb] = useState(false);
  const [pos,        setPos]        = useState({ top:0, left:0, width:0 });
  const swatchRef = useRef(null);
  const popupRef  = useRef(null);
  const svRef     = useRef(null);
  const hueRef    = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!swatchRef.current?.contains(e.target) && !popupRef.current?.contains(e.target))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open || !swatchRef.current) return;
    const rect = swatchRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
  }, [open]);

  const { h, s, v } = hexToHsv(safeValue);
  const [r, g, b] = [
    parseInt(safeValue.slice(1,3),16),
    parseInt(safeValue.slice(3,5),16),
    parseInt(safeValue.slice(5,7),16),
  ];

  const onSVClick = (e) => {
    const rect = svRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ns = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const nv = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    onChange({ target: { value: hsvToHex(h, ns, nv) } });
  };
  const onHueClick = (e) => {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nh = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
    onChange({ target: { value: hsvToHex(nh, s, v) } });
  };

  return (
    <div className="sb-cp-swatch-wrap" ref={swatchRef}>
      <div className="sb-cp-swatch" style={{ background: safeValue }}
        onClick={() => setOpen(o => !o)} title={safeValue}/>
      {open && ReactDOM.createPortal(
        <div ref={popupRef} className="sb-cp-popup"
          style={{ position:'fixed', top: pos.top, left: pos.left, zIndex: 99999 }}>
          {/* SV Gradient */}
          <div ref={svRef} className="sb-cp-sv"
            style={{ background: `hsl(${h},100%,50%)` }}
            onClick={onSVClick}>
            <div className="sb-cp-sv-white"/>
            <div className="sb-cp-sv-black"/>
            <div className="sb-cp-sv-cursor"
              style={{ left:`${s*100}%`, top:`${(1-v)*100}%`, background: safeValue }}/>
          </div>
          {/* Hue slider */}
          <div ref={hueRef} className="sb-cp-hue" onClick={onHueClick}>
            <div className="sb-cp-hue-cursor" style={{ left:`${(h/360)*100}%` }}/>
          </div>
          {/* Inputs */}
          <div className="sb-cp-inputs">
            <div className="sb-cp-input-col">
              <div className="sb-cp-input-hex-wrap">
                <span className="sb-cp-input-hash">#</span>
                <input className="sb-cp-input sb-cp-input--hex"
                  value={editingHex ? hexEdit : safeValue.slice(1).toUpperCase()}
                  onFocus={() => { setEditingHex(true); setHexEdit(safeValue.slice(1).toUpperCase()); }}
                  onChange={e => setHexEdit(e.target.value)}
                  onBlur={() => { setEditingHex(false); const h2='#'+hexEdit; if(isValidHex(h2)) onChange({target:{value:h2}}); }}
                  onKeyDown={e => { if(e.key==='Enter'){setEditingHex(false);const h2='#'+hexEdit;if(isValidHex(h2))onChange({target:{value:h2}});} }}
                  maxLength={6} spellCheck={false}/>
              </div>
              <span className="sb-cp-input-label">HEX</span>
            </div>
            {[['R',r,0],['G',g,1],['B',b,2]].map(([ch,chVal]) => (
              <div key={ch} className="sb-cp-input-col">
                <input className="sb-cp-input"
                  value={editingRgb ? rgbEdit[ch.toLowerCase()] : chVal}
                  onFocus={() => { setEditingRgb(true); setRgbEdit({r:String(r),g:String(g),b:String(b)}); }}
                  onChange={e => setRgbEdit(prev => ({...prev,[ch.toLowerCase()]:e.target.value}))}
                  onBlur={() => {
                    setEditingRgb(false);
                    const rv=Math.max(0,Math.min(255,parseInt(rgbEdit.r)||0));
                    const gv=Math.max(0,Math.min(255,parseInt(rgbEdit.g)||0));
                    const bv=Math.max(0,Math.min(255,parseInt(rgbEdit.b)||0));
                    onChange({target:{value:'#'+[rv,gv,bv].map(x=>x.toString(16).padStart(2,'0')).join('')}});
                  }}
                  onKeyDown={e => { if(e.key==='Enter'){
                    setEditingRgb(false);
                    const rv=Math.max(0,Math.min(255,parseInt(rgbEdit.r)||0));
                    const gv=Math.max(0,Math.min(255,parseInt(rgbEdit.g)||0));
                    const bv=Math.max(0,Math.min(255,parseInt(rgbEdit.b)||0));
                    onChange({target:{value:'#'+[rv,gv,bv].map(x=>x.toString(16).padStart(2,'0')).join('')}});
                  }}}
                  maxLength={3}/>
                <span className="sb-cp-input-label">{ch}</span>
              </div>
            ))}
          </div>
          <div className="sb-cp-presets-label">PRESETS</div>
          <div className="sb-cp-presets">
            {SKYBOX_PRESET_COLORS.map(c => (
              <div key={c} className="sb-cp-preset" style={{background:c}}
                onClick={() => onChange({target:{value:c}})}/>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

// ── EditorBridgeBadge ─────────────────────────────────────────────
// Rein präsentational. Props vom Parent, kein IPC hier.
const BRIDGE_LABEL = {
  disconnected: 'Show in Editor',
  connecting:   'Connecting…',
  mismatch:     'Map Mismatch',
  live:         'Live',
};

const BRIDGE_BADGE_STYLE = {
  disconnected: { color: 'var(--ink-muted)',                  borderColor: 'var(--line-subtle)' },
  connecting:   { color: 'var(--skybox-generator-color)',     borderColor: 'var(--skybox-generator-color)', opacity: 0.7 },
  mismatch:     { color: '#e8933a',                           borderColor: '#e8933a' },
  live:         { color: '#4ade80',                           borderColor: '#4ade80' },
};

const EditorBridgeBadge = ({ bridgeState, bridgeLoadedMap, mapName, onBridgeConnect, onBridgeDisconnect }) => {
  const isLive         = bridgeState === 'live';
  const isConnecting   = bridgeState === 'connecting';
  const isMismatch     = bridgeState === 'mismatch';
  const isDisconnected = bridgeState === 'disconnected';
  const badgeStyle     = BRIDGE_BADGE_STYLE[bridgeState] ?? BRIDGE_BADGE_STYLE.disconnected;
  const noMapName      = !mapName?.trim();

  return (
    <div className="skybox-bridge-row">
      {/* Status dot + label */}
      <div className="skybox-bridge-status" style={{ color: badgeStyle.color }}>
        <span
          className={`skybox-bridge-dot${isConnecting ? ' skybox-bridge-dot--pulse' : ''}`}
          style={{ background: badgeStyle.color }}
        />
        <span className="skybox-bridge-label">{BRIDGE_LABEL[bridgeState]}</span>
        {isMismatch && bridgeLoadedMap && (
          <span className="skybox-bridge-hint">
            Editor has: <em>{bridgeLoadedMap}</em>
          </span>
        )}
      </div>

      {/* Action button */}
      {(isDisconnected || isMismatch) ? (
        <button
          className="btn-secondary skybox-bridge-btn"
          style={{ borderColor: badgeStyle.borderColor, color: badgeStyle.color }}
          onClick={onBridgeConnect}
          disabled={noMapName}
          title={noMapName ? 'Set a Map Name first' : 'Connect to running FAF Map Editor'}
        >
          {isMismatch ? '↺ Retry' : '⇄ Connect'}
        </button>
      ) : isLive ? (
        <button
          className="btn-secondary skybox-bridge-btn"
          style={{ borderColor: 'var(--line-subtle)', color: 'var(--ink-muted)' }}
          onClick={onBridgeDisconnect}
        >
          Disconnect
        </button>
      ) : null /* connecting — no button */ }
    </div>
  );
};

// ── Haupt-Sektions-Komponente ─────────────────────────────────────
const Configuration = ({
  mapName, setMapName, mapsFolderPath, setMapsFolderPath,
  mapInfo, mapSize, scale,
  subtractHeight, setSubtractHeight,
  subdivAxis, setSubdivAxis,
  subdivHeight, setSubdivHeight,
  horizonHeight, setHorizonHeight,
  zenithHeight, setZenithHeight,
  horizonColor, setHorizonColor,
  zenithColor, setZenithColor,
  decalGlowMult, setDecalGlowMult,
  albedo, setAlbedo,
  glow, setGlow,
  showDomeLabels, setShowDomeLabels,
  domeFullscreen, setDomeFullscreen,
  // Bridge
  bridgeState = 'disconnected',
  bridgeLoadedMap = '',
  onBridgeConnect,
  onBridgeDisconnect,
}) => {
  const sphereLerp = Math.max(0, Math.min(1, 1-(parseFloat(subtractHeight)||1.2566)*2/Math.PI));

  return (
    <div className="skybox-section-stack">

      {/* Map Context */}
      <div className="skybox-section-card">
        <h2 className="skybox-section-title">Map Context</h2>
        <div className="skybox-form-group">
          <label className="skybox-form-label">Map Name</label>
          <input className="skybox-input" value={mapName} onChange={e=>setMapName(e.target.value)} placeholder="Hades_Dust.v0002"/>
          {mapName && (
            <p className="skybox-form-help">…/{/\.v\d{4}$/.test(mapName)?mapName:mapName+'.v0001'}/env/skybox/</p>
          )}
          {mapInfo ? (
            <p className="skybox-form-help">Map Size: <strong>{mapSize}</strong> · Scale: <strong>{scale.toFixed(0)}</strong></p>
          ) : (
            <p className="skybox-form-help" style={{color:'rgba(255,255,255,0.35)'}}>Map size auto-read from scenario.lua once Map Name is set</p>
          )}
        </div>
        <div className="skybox-form-group">
          <label className="skybox-form-label">Maps Folder</label>
          <input className="skybox-input" value={mapsFolderPath} onChange={e=>setMapsFolderPath(e.target.value)} placeholder="C:\ProgramData\FAForever\maps"/>
        </div>

        {/* Editor Live-Bridge */}
        <div className="skybox-form-group">
          <label className="skybox-form-label">
            Editor Sync
            {bridgeState === 'live' && (
              <span className="skybox-live-badge">● LIVE</span>
            )}
          </label>
          <EditorBridgeBadge
            bridgeState={bridgeState}
            bridgeLoadedMap={bridgeLoadedMap}
            mapName={mapName}
            onBridgeConnect={onBridgeConnect}
            onBridgeDisconnect={onBridgeDisconnect}
          />
          <p className="skybox-form-help">
            {bridgeState === 'live'
              ? 'Atmosphere values are streaming to the open FAF Map Editor.'
              : bridgeState === 'mismatch'
              ? 'Open the correct map in the FAF Map Editor, then retry.'
              : 'Open the FAF Map Editor with this map loaded, then connect.'}
          </p>
        </div>
      </div>

      {/* Dome Colors */}
      <div className="skybox-section-card">
        <h2 className="skybox-section-title">Sky Colors</h2>
        <div className="skybox-form-row">
          <div className="skybox-form-group">
            <label className="skybox-form-label">Horizon Color</label>
            <ColorPicker value={horizonColor} onChange={e=>setHorizonColor(e.target.value)}/>
          </div>
          <div className="skybox-form-group">
            <label className="skybox-form-label">Zenith Color</label>
            <ColorPicker value={zenithColor} onChange={e=>setZenithColor(e.target.value)}/>
          </div>
        </div>
        <div className="skybox-form-row">
          <div className="skybox-form-group">
            <label className="skybox-form-label">Horizon Height</label>
            <input className="skybox-input" value={horizonHeight} onChange={e=>setHorizonHeight(e.target.value)} placeholder="-42.5"/>
            <p className="skybox-form-help">Cut-off edge — below: black.</p>
          </div>
          <div className="skybox-form-group">
            <label className="skybox-form-label">Zenith Height</label>
            <input className="skybox-input" value={zenithHeight} onChange={e=>setZenithHeight(e.target.value)} placeholder="293.507"/>
          </div>
        </div>
      </div>

      {/* Dome Preview */}
      <div className="skybox-section-card">
        <div className="skybox-card-header">
          <h2 className="skybox-section-title">Dome Preview</h2>
          <div style={{display:'flex',gap:'8px'}}>
            <button className="btn-secondary" onClick={()=>setShowDomeLabels(v=>!v)}>
              {showDomeLabels?'Hide Labels':'Show Labels'}
            </button>
            <button className="btn-secondary" onClick={()=>setDomeFullscreen(true)}>⤢ Expand</button>
          </div>
        </div>
        <DomePreview
          horizonColor={horizonColor} zenithColor={zenithColor}
          horizonHeight={horizonHeight} zenithHeight={zenithHeight}
          subtractHeight={subtractHeight} subdivHeight={subdivHeight}
          scale={scale} showLabels={showDomeLabels} fullscreen={false}/>
        <div className="skybox-dome-stats">
          <span>SphereLerp: <strong>{sphereLerp.toFixed(4)}</strong></span>
          <span>Scale: <strong>{Math.round(scale)}</strong></span>
          <span>Apex ≈ <strong>{Math.round((parseFloat(horizonHeight)||0)+sphereLerp*(parseFloat(mapSize||1024)*2.288))}</strong></span>
        </div>
      </div>

      {/* Geometry */}
      <div className="skybox-section-card">
        <h2 className="skybox-section-title">Geometry</h2>
        <div className="skybox-form-row">
          <div className="skybox-form-group">
            <label className="skybox-form-label">Subtract Height</label>
            <input className="skybox-input" value={subtractHeight} onChange={e=>setSubtractHeight(e.target.value)} placeholder="1.2566"/>
            <p className="skybox-form-help">Controls sphere vs cylinder blending (SphereLerp).</p>
          </div>
          <div className="skybox-form-group">
            <label className="skybox-form-label">Subdiv Axis</label>
            <input className="skybox-input" value={subdivAxis} onChange={e=>setSubdivAxis(e.target.value)} placeholder="16"/>
          </div>
          <div className="skybox-form-group">
            <label className="skybox-form-label">Subdiv Height</label>
            <input className="skybox-input" value={subdivHeight} onChange={e=>setSubdivHeight(e.target.value)} placeholder="6"/>
          </div>
        </div>
      </div>

      {/* Decal / Textures */}
      <div className="skybox-section-card">
        <h2 className="skybox-section-title">Decal Textures</h2>
        <div className="skybox-form-group">
          <label className="skybox-form-label">Decal Glow Multiplier</label>
          <input className="skybox-input" value={decalGlowMult} onChange={e=>setDecalGlowMult(e.target.value)} placeholder="0.1"/>
        </div>
        <div className="skybox-form-group">
          <label className="skybox-form-label">Albedo Texture</label>
          <input className="skybox-input" value={albedo} onChange={e=>setAlbedo(e.target.value)}/>
        </div>
        <div className="skybox-form-group">
          <label className="skybox-form-label">Glow Texture</label>
          <input className="skybox-input" value={glow} onChange={e=>setGlow(e.target.value)}/>
        </div>
      </div>

    </div>
  );
};

export default Configuration;
