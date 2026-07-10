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
  return (
    <div className="ec-canvas-wrap" style={{ width: '100%', aspectRatio: `${w}/${h}` }}>
      <canvas ref={canvasRef} width={w} height={h} className="ec-canvas" style={{ width: '100%', height: '100%', display: 'block', cursor: 'default' }}/>
    </div>
  );
};

// ── FullscreenDome Overlay ────────────────────────────────────────
export const FullscreenDome = ({
  horizonColor, setHorizonColor, zenithColor, setZenithColor,
  horizonHeight, setHorizonHeight, zenithHeight, setZenithHeight,
  subtractHeight, subdivHeight, scale, showLabels, setShowLabels, onClose,
}) => {
  const hH = parseFloat(horizonHeight) || 0;
  const zH = parseFloat(zenithHeight)  || 256;
  const sphereLerp = Math.max(0, Math.min(1, 1-(parseFloat(subtractHeight)||1.2566)*2/Math.PI));

  return (
    <div className="dome-fullscreen-overlay">
      <div className="dome-fullscreen-inner">
        <div className="dome-fullscreen-sidebar">
          <div className="dome-fs-header">
            <span className="ctrl-subtitle ctrl-subtitle--flush">Dome Editor</span>
            <button className="ctrl-btn-close" onClick={onClose} aria-label="Close">×</button>
          </div>
          <div className="ctrl-field">
            <div className="ctrl-label">Horizon Color</div>
            <ColorPicker value={horizonColor} onChange={e=>setHorizonColor(e.target.value)} />
          </div>
          <div className="ctrl-field">
            <div className="ctrl-label">Horizon Height</div>
            <input className="ctrl-input" value={horizonHeight} onChange={e=>setHorizonHeight(e.target.value)} placeholder="-42.5"/>
          </div>
          <div className="ctrl-field">
            <div className="ctrl-label">Zenith Color</div>
            <ColorPicker value={zenithColor} onChange={e=>setZenithColor(e.target.value)} />
          </div>
          <div className="ctrl-field">
            <div className="ctrl-label">Zenith Height</div>
            <input className="ctrl-input" value={zenithHeight} onChange={e=>setZenithHeight(e.target.value)} placeholder="293.507"/>
          </div>
          <div className="dome-fs-stat"><span className="ctrl-label">SphereLerp</span><span className="dome-fs-stat-val">{sphereLerp.toFixed(4)}</span></div>
          <div className="dome-fs-stat"><span className="ctrl-label">Scale</span><span className="dome-fs-stat-val">{Math.round(scale)}</span></div>
          <button onClick={()=>setShowLabels(v=>!v)} className="ctrl-btn-add">
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
    // The popup is portaled to document.body, outside the .skybox-tab subtree
    // that defines --tab-color — forward the resolved values so the accent
    // cascade still reaches it.
    const cs = getComputedStyle(swatchRef.current);
    setPos({
      top: rect.bottom + 8, left: rect.left, width: rect.width,
      tabColor:       cs.getPropertyValue('--tab-color').trim(),
      tabGlow:        cs.getPropertyValue('--tab-glow').trim(),
      tabGlowStrong:  cs.getPropertyValue('--tab-glow-strong').trim(),
    });
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
      <button
        type="button"
        className={`sb-cp-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title={safeValue}
      >
        <span className="sb-cp-trigger-swatch" style={{ background: safeValue }}/>
        <span className="sb-cp-trigger-hex">{safeValue.toUpperCase()}</span>
      </button>
      {open && ReactDOM.createPortal(
        <div ref={popupRef} className="sb-cp-popup"
          style={{
            position:'fixed', top: pos.top, left: pos.left, zIndex: 99999,
            '--tab-color': pos.tabColor, '--tab-glow': pos.tabGlow, '--tab-glow-strong': pos.tabGlowStrong,
          }}>
          {/* Landscape layout: SV+hue column on the left, fields stacked to
              the right — wide, not tall. */}
          <div className="sb-cp-popup-top">
            <div className="sb-cp-sv-col">
              {/* SV field — machined bezel, same recessed-slot language as .ctrl-toggle */}
              <div className="sb-cp-sv-frame">
                <div ref={svRef} className="sb-cp-sv"
                  style={{ background: `hsl(${h},100%,50%)` }}
                  onClick={onSVClick}>
                  <div className="sb-cp-sv-white"/>
                  <div className="sb-cp-sv-black"/>
                  <div className="sb-cp-sv-cursor"
                    style={{ left:`${s*100}%`, top:`${(1-v)*100}%`, background: safeValue }}/>
                </div>
              </div>
              {/* Hue — recessed track, travelling pole (same mechanic as .ctrl-toggle-pole) */}
              <div className="sb-cp-hue-frame">
                <div ref={hueRef} className="sb-cp-hue" onClick={onHueClick}>
                  <div className="sb-cp-hue-cursor" style={{ left:`${(h/360)*100}%` }}/>
                </div>
              </div>
            </div>
            {/* Fields — the same never-boxed baseline as every other ctrl-input in the app */}
            <div className="sb-cp-fields-col">
              <div className="ctrl-field">
                <div className="ctrl-label">Hex</div>
                <div className="sb-cp-input-hex-wrap">
                  <span className="sb-cp-input-hash">#</span>
                  <input className="ctrl-input sb-cp-input--hex"
                    value={editingHex ? hexEdit : safeValue.slice(1).toUpperCase()}
                    onFocus={() => { setEditingHex(true); setHexEdit(safeValue.slice(1).toUpperCase()); }}
                    onChange={e => setHexEdit(e.target.value)}
                    onBlur={() => { setEditingHex(false); const h2='#'+hexEdit; if(isValidHex(h2)) onChange({target:{value:h2}}); }}
                    onKeyDown={e => { if(e.key==='Enter'){setEditingHex(false);const h2='#'+hexEdit;if(isValidHex(h2))onChange({target:{value:h2}});} }}
                    maxLength={6} spellCheck={false}/>
                </div>
              </div>
              <div className="sb-cp-rgb-row">
                {[['R',r,0],['G',g,1],['B',b,2]].map(([ch,chVal]) => (
                  <div key={ch} className="ctrl-field">
                    <div className="ctrl-label">{ch}</div>
                    <input className="ctrl-input sb-cp-input--num"
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
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="ctrl-label sb-cp-presets-label">Presets</div>
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

const BRIDGE_BADGE_VARIANT = {
  disconnected: '',
  connecting:   'ctrl-badge--warn',
  mismatch:     'ctrl-badge--warn',
  live:         'ctrl-badge--ok',
};

export const EditorBridgeBadge = ({ bridgeState, bridgeLoadedMap, mapName, onBridgeConnect, onBridgeDisconnect }) => {
  const isLive         = bridgeState === 'live';
  const isMismatch     = bridgeState === 'mismatch';
  const isDisconnected = bridgeState === 'disconnected';
  const noMapName      = !mapName?.trim();

  return (
    <div className="ctrl-action-row">
      {!isDisconnected && (
        <span className={`ctrl-badge ${BRIDGE_BADGE_VARIANT[bridgeState] ?? ''}`.trim()}>
          {BRIDGE_LABEL[bridgeState]}
        </span>
      )}
      {isMismatch && bridgeLoadedMap && (
        <span className="sb-field-help">Editor has: {bridgeLoadedMap}</span>
      )}

      {/* Action button */}
      {(isDisconnected || isMismatch) ? (
        <button
          className="btn-library"
          onClick={onBridgeConnect}
          disabled={noMapName}
          title={noMapName ? 'Set a Map Name first' : 'Connect to running FAF Map Editor'}
        >
          {isMismatch ? '↺ Retry' : '⇄ Connect'}
        </button>
      ) : isLive ? (
        <button className="ctrl-btn-add" onClick={onBridgeDisconnect}>Disconnect</button>
      ) : null /* connecting — no button */ }
    </div>
  );
};

// ── Haupt-Sektions-Komponente ─────────────────────────────────────
// Sky Colors, Editor Sync (→ Aside) und Decal Textures (→ Planets) leben
// nicht mehr hier — siehe SkyboxGenerator.jsx (asideBySection.atmosphere)
// bzw. Planets.jsx.
const Configuration = ({
  mapName, setMapName,
  mapInfo, mapSize, scale,
  subtractHeight, setSubtractHeight,
  subdivAxis, setSubdivAxis,
  subdivHeight, setSubdivHeight,
  horizonColor, setHorizonColor,
  zenithColor, setZenithColor,
  horizonHeight, setHorizonHeight,
  zenithHeight, setZenithHeight,
}) => {
  const [metaOpen, setMetaOpen] = useState(false);

  return (
    <div className="ctrl-col">

      {/* Map Context */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Map Context</div>
        <div className="ctrl-content">
          <div className="ctrl-field">
            <input
              type="text"
              className="ctrl-input ctrl-input--text"
              value={mapName}
              onChange={e=>setMapName(e.target.value)}
              placeholder="Hades_Dust.v0002"
            />

            {mapName && (
              <button className="ctrl-btn-meta" onClick={() => setMetaOpen(o => !o)}>
                {metaOpen ? '− Metadata' : '+ Metadata'}
              </button>
            )}

            {mapName && metaOpen && (
              <div className="ctrl-mapinfo">
                <div className="ctrl-path-hint">
                  …/{/\.v\d{4}$/.test(mapName)?mapName:mapName+'.v0001'}/env/skybox/
                </div>
                {mapInfo ? (<>
                  <span className="ctrl-badge ctrl-badge--ok">Map</span>
                  <span>{mapSize} × {mapSize}</span>
                  <span className="ctrl-mapinfo-sep">·</span>
                  <span>Scale {scale.toFixed(0)}</span>
                </>) : (
                  <span className="ctrl-mapinfo-err">Map size auto-read from scenario.lua once Map Name is set</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Geometry */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Geometry</div>
        <div className="ctrl-content">
          <div className="sb-cfg-row sb-cfg-row--3">
            <div className="ctrl-field">
              <div className="ctrl-label">Subtract Height</div>
              <input className="ctrl-input" value={subtractHeight} onChange={e=>setSubtractHeight(e.target.value)} placeholder="1.2566"/>
            </div>
            <div className="ctrl-field">
              <div className="ctrl-label">Subdiv Axis</div>
              <input className="ctrl-input" value={subdivAxis} onChange={e=>setSubdivAxis(e.target.value)} placeholder="16"/>
            </div>
            <div className="ctrl-field">
              <div className="ctrl-label">Subdiv Height</div>
              <input className="ctrl-input" value={subdivHeight} onChange={e=>setSubdivHeight(e.target.value)} placeholder="6"/>
            </div>
          </div>
        </div>
      </div>

      {/* Sky Colors */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Sky Colors</div>
        <div className="ctrl-content">
          <div className="sb-cfg-row">
            <div className="ctrl-field">
              <div className="ctrl-label">Horizon Color</div>
              <ColorPicker value={horizonColor} onChange={e=>setHorizonColor(e.target.value)}/>
            </div>
            <div className="ctrl-field">
              <div className="ctrl-label">Zenith Color</div>
              <ColorPicker value={zenithColor} onChange={e=>setZenithColor(e.target.value)}/>
            </div>
          </div>
          <div className="sb-cfg-row">
            <div className="ctrl-field">
              <div className="ctrl-label">Horizon Height</div>
              <input className="ctrl-input" value={horizonHeight} onChange={e=>setHorizonHeight(e.target.value)} placeholder="-42.5"/>
            </div>
            <div className="ctrl-field">
              <div className="ctrl-label">Zenith Height</div>
              <input className="ctrl-input" value={zenithHeight} onChange={e=>setZenithHeight(e.target.value)} placeholder="293.507"/>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Configuration;
