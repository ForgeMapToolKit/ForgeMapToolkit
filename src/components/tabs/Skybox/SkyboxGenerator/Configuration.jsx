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
import { hexToRgbArr, SKYBOX_PRESET_COLORS } from './utils.js';
import { ColorPicker } from '../../../Shared/Ui/ColorPicker/ColorPicker.jsx';

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
            <ColorPicker value={horizonColor} onChange={e=>setHorizonColor(e.target.value)} presets={SKYBOX_PRESET_COLORS} />
          </div>
          <div className="ctrl-field">
            <div className="ctrl-label">Horizon Height</div>
            <input className="ctrl-input" value={horizonHeight} onChange={e=>setHorizonHeight(e.target.value)} placeholder="-42.5"/>
          </div>
          <div className="ctrl-field">
            <div className="ctrl-label">Zenith Color</div>
            <ColorPicker value={zenithColor} onChange={e=>setZenithColor(e.target.value)} presets={SKYBOX_PRESET_COLORS} />
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

// ColorPicker now lives in Shared/Ui/ColorPicker — imported above. Kept as
// ColorPicker + SKYBOX_PRESET_COLORS (this tab's sky/water swatch row).

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
              <ColorPicker value={horizonColor} onChange={e=>setHorizonColor(e.target.value)} presets={SKYBOX_PRESET_COLORS}/>
            </div>
            <div className="ctrl-field">
              <div className="ctrl-label">Zenith Color</div>
              <ColorPicker value={zenithColor} onChange={e=>setZenithColor(e.target.value)} presets={SKYBOX_PRESET_COLORS}/>
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
