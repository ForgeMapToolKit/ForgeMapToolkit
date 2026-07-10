/**
 * SkyboxGenerator_Stars.jsx — Sektion 04: Stars
 *
 * Default export `Stars` = Hauptcontent (Star Parameters, Y-Distribution, UV Options).
 * Named export `StarsAside` = Exclusion Zones + UV Visualization, gerendert im Section-Aside
 * (siehe SkyboxGenerator.jsx) statt im Hauptcontent.
 * Enthält außerdem: YCurveEditor, RangeSlider, Toggle (lokale UI-Primitives).
 * Rein präsentational bis auf lokale Canvas-Zeichenlogik (Refs, kein persistenter State).
 */
import React, {
  useState, useRef, useEffect, useCallback,
} from 'react';
import { Dropdown, DropSlot } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import { UV_COLORS, Y_MODES, clamp01, parseUvOptions, hexToRgbArr } from './utils.js';

// ── RangeSlider ───────────────────────────────────────────────────
const RangeSlider = ({ min, max, step, value, onChange }) => {
  const numMin = parseFloat(min) || 0;
  const numMax = parseFloat(max) || 1;
  const numVal = parseFloat(value) || 0;
  const pct    = Math.max(0, Math.min(100, ((numVal - numMin) / (numMax - numMin)) * 100));
  return (
    <div className="sb-range-wrap">
      <input type="range" className="sb-range" min={min} max={max} step={step}
        value={numVal} onChange={onChange} style={{ '--fill': `${pct}%` }}/>
    </div>
  );
};

// ── YCurveEditor ──────────────────────────────────────────────────
const DEFAULT_CURVE_POINTS = [
  { x: 0.05, y: 0.0 }, { x: 1.0, y: 0.15 }, { x: 0.3, y: 0.5 }, { x: 0.05, y: 1.0 },
];
const YCurveEditor = ({ points, onChange, yMax = 1500 }) => {
  const canvasRef = useRef(null);
  const wrapRef   = useRef(null);
  const dragIdx   = useRef(null);
  const hoverIdx  = useRef(-1);
  const didMove   = useRef(false);
  const downPos   = useRef(null);
  const accentRef = useRef([59, 118, 255]); // fallback until --tab-color resolves
  const [isHoveringPoint, setIsHoveringPoint] = useState(false);
  const CW = 400, CH = 400, HIT_PX = 14;
  const ptToCv = (p) => ({ cx: p.x * CW, cy: (1 - p.y) * CH });
  const accent = (a) => { const [r,g,b] = accentRef.current; return `rgba(${r},${g},${b},${a})`; };

  // The canvas can't read CSS custom properties directly — resolve
  // --tab-color once against the wrap (which sits inside .skybox-tab,
  // where the cascade is actually defined) and reuse it for every draw.
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
    return { x: Math.max(0,Math.min(1,cx/CW)), y: Math.max(0,Math.min(1,1-cy/CH)) };
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
      const d2 = (mx-cx)**2 + (my-cy)**2;
      if (d2 < bestD2) { bestD2 = d2; best = i; }
    });
    return best;
  }, [points]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = CW, H = CH;
    // Background/grid/border/axis-labels are CSS+HTML now (ec-canvas-wrap +
    // .sb-st-curve-grid + .sb-st-curve-axis-label) — canvas only draws the
    // curve itself, so it stays transparent underneath.
    ctx.clearRect(0,0,W,H);
    if (!points?.length) {
      ctx.fillStyle=accent(0.4);ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font='11px monospace';ctx.fillText('Click to add control points',W/2,H/2); return;
    }
    const sortedByHeight = [...points].sort((a,b)=>a.y-b.y);
    const cvByHeight     = sortedByHeight.map(ptToCv);
    if (points.length >= 2) {
      cvByHeight.forEach(({cx,cy})=>{ctx.beginPath();ctx.moveTo(0,cy);ctx.lineTo(cx,cy);ctx.strokeStyle=accent(0.09);ctx.lineWidth=1;ctx.setLineDash([2,5]);ctx.stroke();ctx.setLineDash([]);});
      ctx.beginPath();ctx.moveTo(0,cvByHeight[0].cy);
      cvByHeight.forEach(({cx,cy})=>ctx.lineTo(cx,cy));
      ctx.lineTo(0,cvByHeight[cvByHeight.length-1].cy);ctx.closePath();
      const ag=ctx.createLinearGradient(0,0,W,0);ag.addColorStop(0,accent(0.03));ag.addColorStop(1,accent(0.22));
      ctx.fillStyle=ag;ctx.fill();
      const linePath=()=>{ctx.beginPath();ctx.lineJoin='round';ctx.lineCap='round';cvByHeight.forEach(({cx,cy},i)=>i===0?ctx.moveTo(cx,cy):ctx.lineTo(cx,cy));};
      linePath();ctx.strokeStyle=accent(0.22);ctx.lineWidth=14;ctx.stroke();
      linePath();ctx.strokeStyle=accent(0.55);ctx.lineWidth=5;ctx.stroke();
      linePath();ctx.strokeStyle='rgba(255,255,255,0.92)';ctx.lineWidth=1.5;ctx.stroke();
    }
    const hovI=hoverIdx.current,dragI=dragIdx.current;
    points.forEach((p,i)=>{
      const{cx,cy}=ptToCv(p);
      const isDrag=dragI===i,isHov=hovI===i,r=isDrag?9:isHov?8:6;
      if(isDrag||isHov){const haloR=r+(isDrag?11:7);const halo=ctx.createRadialGradient(cx,cy,0,cx,cy,haloR);halo.addColorStop(0,accent(isDrag?0.28:0.16));halo.addColorStop(1,'rgba(0,0,0,0)');ctx.beginPath();ctx.arc(cx,cy,haloR,0,Math.PI*2);ctx.fillStyle=halo;ctx.fill();}
      ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.fillStyle=isDrag?'rgba(30,30,34,0.92)':isHov?'rgba(24,24,28,0.88)':'rgba(18,18,22,0.82)';ctx.fill();
      ctx.strokeStyle=accent(isDrag?0.95:isHov?0.75:0.5);ctx.lineWidth=isDrag?1.5:1;ctx.stroke();
      ctx.beginPath();ctx.arc(cx,cy,r-1,Math.PI*1.15,Math.PI*1.75);
      ctx.strokeStyle=isDrag?'rgba(255,255,255,0.55)':isHov?'rgba(255,255,255,0.35)':'rgba(255,255,255,0.18)';ctx.lineWidth=1;ctx.stroke();
      if(isDrag||isHov){const probLabel=(p.x*100).toFixed(0)+'%';const heightLabel=(p.y*yMax).toFixed(0);const label=`prob ${probLabel}  h=${heightLabel}`;ctx.font='bold 10px monospace';const tw=ctx.measureText(label).width;let tx=cx,ty=cy-r-18;if(ty<12)ty=cy+r+18;tx=Math.max(tw/2+6,Math.min(W-tw/2-6,tx));const pw=tw+14,ph=17,px2=tx-pw/2,py2=ty-ph/2;ctx.fillStyle='rgba(10,10,14,0.92)';ctx.beginPath();ctx.roundRect?.(px2,py2,pw,ph,3)??ctx.rect(px2,py2,pw,ph);ctx.fill();ctx.strokeStyle=accent(0.55);ctx.lineWidth=1;ctx.beginPath();ctx.roundRect?.(px2,py2,pw,ph,3)??ctx.rect(px2,py2,pw,ph);ctx.stroke();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,tx,ty);}
    });
  }, [points, yMax]);

  useEffect(()=>{draw();},[draw]);

  const onMouseDown = useCallback((e)=>{
    e.preventDefault();
    if(e.button!==0&&e.button!==2) return;
    const hit=findHit(e.clientX,e.clientY);
    if(e.button===2){if(hit>=0&&points.length>2){onChange(points.filter((_,i)=>i!==hit));hoverIdx.current=-1;draw();}return;}
    if(hit>=0){dragIdx.current=hit;didMove.current=false;downPos.current={clientX:e.clientX,clientY:e.clientY};return;}
    const pos=clientToNorm(e.clientX,e.clientY);
    const newPts=[...points,pos].sort((a,b)=>a.x-b.x);
    const newIdx=newPts.findIndex(p=>p.x===pos.x&&p.y===pos.y);
    onChange(newPts);dragIdx.current=newIdx;didMove.current=false;downPos.current={clientX:e.clientX,clientY:e.clientY};
  },[points,onChange,findHit,clientToNorm,draw]);

  useEffect(()=>{
    const onMove=(e)=>{
      if(dragIdx.current===null){const h=findHit(e.clientX,e.clientY);if(h!==hoverIdx.current){hoverIdx.current=h;draw();}return;}
      didMove.current=true;
      const pos=clientToNorm(e.clientX,e.clientY);
      const updated=points.map((p,i)=>i===dragIdx.current?pos:p);
      onChange(updated.sort((a,b)=>a.x-b.x));
      const sorted=updated.sort((a,b)=>a.x-b.x);
      const newIdx=sorted.findIndex(p=>p.x===pos.x&&p.y===pos.y);
      if(newIdx>=0)dragIdx.current=newIdx;
    };
    const onUp=()=>{if(dragIdx.current!==null){dragIdx.current=null;draw();}};
    window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);
    return()=>{window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);};
  },[points,onChange,findHit,clientToNorm,draw]);

  const onMouseLeave=useCallback(()=>{if(dragIdx.current!==null)return;hoverIdx.current=-1;setIsHoveringPoint(false);draw();},[draw]);
  const onMouseMove=useCallback((e)=>{if(dragIdx.current!==null)return;const h=findHit(e.clientX,e.clientY);if(h!==hoverIdx.current){hoverIdx.current=h;setIsHoveringPoint(h>=0);draw();}},[findHit,draw]);

  const yMaxLabel = yMax>=1000 ? `${(yMax/1000).toFixed(1)}k` : String(yMax);

  return (
    <div className="sb-st-curve-shell">
      <div className="sb-st-curve-header">
        <span className="ctrl-label">Y-Distribution Curve</span>
        <div className="sb-st-curve-header-stats">
          <span className="ctrl-badge">{points?.length??0} pts</span>
          <span className="ctrl-badge">yMax {yMaxLabel}</span>
          <button className="ctrl-btn-add" onClick={() => onChange(DEFAULT_CURVE_POINTS)}>Reset</button>
        </div>
      </div>
      <div className="ec-canvas-wrap sb-st-curve-wrap" ref={wrapRef}>
        <div className="sb-st-curve-grid" aria-hidden="true"/>
        <canvas ref={canvasRef} width={CW} height={CH} className="sb-st-curve-canvas"
          style={{cursor:isHoveringPoint?'pointer':'crosshair'}}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}
          onContextMenu={e=>e.preventDefault()}/>
        <span className="sb-st-curve-axis-label sb-st-curve-axis-label--ymax">{yMaxLabel}</span>
        <span className="sb-st-curve-axis-label sb-st-curve-axis-label--ymin">0</span>
        <span className="sb-st-curve-axis-label sb-st-curve-axis-label--y-caption">height ↑</span>
        <span className="sb-st-curve-axis-label sb-st-curve-axis-label--x0">0%</span>
        <span className="sb-st-curve-axis-label sb-st-curve-axis-label--x100">100%</span>
        <span className="sb-st-curve-axis-label sb-st-curve-axis-label--x-caption">probability →</span>
      </div>
      <div className="sb-st-curve-hint">
        {isHoveringPoint ? (
          <><span className="sb-st-curve-hint-active">Drag</span><span className="sb-st-curve-hint-sep"> to move</span><span className="sb-st-curve-hint-dot"/><span className="sb-st-curve-hint-active">Right-click</span><span className="sb-st-curve-hint-sep"> to remove</span></>
        ) : (
          <><span className="sb-st-curve-hint-sep">Click canvas</span><span className="sb-st-curve-hint-dot"/><span className="sb-st-curve-hint-sep">to add a control point</span></>
        )}
      </div>
    </div>
  );
};

// ── Stars Hauptkomponente (Star Parameters / Y-Distribution / UV Options) ──
const Stars = ({
  numStars, setNumStars, numClusters, setNumClusters,
  clusterSpread, setClusterSpread, clusterStdDev, setClusterStdDev,
  backgroundRatio, setBackgroundRatio, scaleMin, setScaleMin, scaleMax, setScaleMax,
  uvOptions, uvWeights,
  uvRows, syncUvRows,
  yMode, setYMode, yMax, setYMax,
  yCenter, setYCenter, yStdDev, setYStdDev,
  yLayers, setYLayers,
  diskCenter, setDiskCenter, diskStdDev, setDiskStdDev,
  haloStdDev, setHaloStdDev, haloRatio, setHaloRatio,
  curvePoints, setCurvePoints,
  yClusterScatter, setYClusterScatter,
  onResetDefaults,
}) => {
  const yModeTriggerRef = useRef(null);

  return (
    <div className="ctrl-col">

      {/* Controls */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Star Parameters</div>
        <div className="ctrl-content">
          <div className="ctrl-action-row">
            <button className="ctrl-btn-add" onClick={onResetDefaults}>Reset Defaults</button>
          </div>

          <div className="sb-cfg-row sb-cfg-row--3">
            <div className="ctrl-field">
              <div className="ctrl-label">Star Count</div>
              <input className="ctrl-input" value={numStars} onChange={e=>setNumStars(e.target.value)}/>
            </div>
            <div className="ctrl-field">
              <div className="ctrl-label">Clusters</div>
              <input className="ctrl-input" value={numClusters} onChange={e=>setNumClusters(e.target.value)}/>
            </div>
            <div className="ctrl-field">
              <div className="ctrl-label">Background Ratio</div>
              <input className="ctrl-input" value={backgroundRatio} onChange={e=>setBackgroundRatio(e.target.value)}/>
            </div>
          </div>

          <div className="sb-cfg-row sb-cfg-row--3">
            <div className="ctrl-field">
              <div className="ctrl-label">Cluster Spread</div>
              <input className="ctrl-input" value={clusterSpread} onChange={e=>setClusterSpread(e.target.value)}/>
            </div>
            <div className="ctrl-field">
              <div className="ctrl-label">Cluster Std Dev</div>
              <input className="ctrl-input" value={clusterStdDev} onChange={e=>setClusterStdDev(e.target.value)}/>
            </div>
            <div className="ctrl-field">
              <div className="ctrl-label">Y Cluster Scatter</div>
              <input className="ctrl-input" value={yClusterScatter} onChange={e=>setYClusterScatter(e.target.value)}/>
            </div>
          </div>

          <div className="sb-cfg-row">
            <div className="ctrl-field">
              <div className="ctrl-label">Scale Min</div>
              <input className="ctrl-input" value={scaleMin} onChange={e=>setScaleMin(e.target.value)}/>
            </div>
            <div className="ctrl-field">
              <div className="ctrl-label">Scale Max</div>
              <input className="ctrl-input" value={scaleMax} onChange={e=>setScaleMax(e.target.value)}/>
            </div>
          </div>
        </div>
      </div>

      {/* Y-Distribution */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Y-Distribution</div>
        <div className="ctrl-content">
          <div className="ctrl-field">
            <div className="ctrl-label">Mode</div>
            <Dropdown options={Y_MODES} value={yMode} onChange={setYMode} triggerRef={yModeTriggerRef} ariaLabel="Y-Distribution Mode" />
          </div>
          {yMode==='flat' && (
            <div className="ctrl-field"><div className="ctrl-label">Y Max</div><input className="ctrl-input" value={yMax} onChange={e=>setYMax(e.target.value)}/></div>
          )}
          {yMode==='gaussian' && (
            <div className="sb-cfg-row sb-cfg-row--3">
              <div className="ctrl-field"><div className="ctrl-label">Center</div><input className="ctrl-input" value={yCenter} onChange={e=>setYCenter(e.target.value)}/></div>
              <div className="ctrl-field"><div className="ctrl-label">Std Dev</div><input className="ctrl-input" value={yStdDev} onChange={e=>setYStdDev(e.target.value)}/></div>
              <div className="ctrl-field"><div className="ctrl-label">Y Max</div><input className="ctrl-input" value={yMax} onChange={e=>setYMax(e.target.value)}/></div>
            </div>
          )}
          {yMode==='layered' && (
            <div className="ctrl-field">
              <div className="ctrl-label">Layers (center, stddev, weight per line)</div>
              <textarea className="ctrl-input ctrl-input--text sb-textarea" rows={4} value={yLayers} onChange={e=>setYLayers(e.target.value)}/>
              <div className="ctrl-field"><div className="ctrl-label">Y Max</div><input className="ctrl-input" value={yMax} onChange={e=>setYMax(e.target.value)}/></div>
            </div>
          )}
          {yMode==='disk_halo' && (
            <div className="sb-cfg-row sb-cfg-row--5">
              <div className="ctrl-field"><div className="ctrl-label">Disk Center</div><input className="ctrl-input" value={diskCenter} onChange={e=>setDiskCenter(e.target.value)}/></div>
              <div className="ctrl-field"><div className="ctrl-label">Disk StdDev</div><input className="ctrl-input" value={diskStdDev} onChange={e=>setDiskStdDev(e.target.value)}/></div>
              <div className="ctrl-field"><div className="ctrl-label">Halo StdDev</div><input className="ctrl-input" value={haloStdDev} onChange={e=>setHaloStdDev(e.target.value)}/></div>
              <div className="ctrl-field"><div className="ctrl-label">Halo Ratio</div><input className="ctrl-input" value={haloRatio} onChange={e=>setHaloRatio(e.target.value)}/></div>
              <div className="ctrl-field"><div className="ctrl-label">Y Max</div><input className="ctrl-input" value={yMax} onChange={e=>setYMax(e.target.value)}/></div>
            </div>
          )}
          {yMode==='curve' && (
            <>
              <div className="ctrl-field"><div className="ctrl-label">Y Max</div><input className="ctrl-input" value={yMax} onChange={e=>setYMax(e.target.value)}/></div>
              <YCurveEditor points={curvePoints} onChange={setCurvePoints} yMax={parseFloat(yMax)||1500}/>
            </>
          )}
        </div>
      </div>

      {/* UV Rows */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">UV Options</div>
        <div className="ctrl-content">
          <div className="sb-uv-row sb-uv-row--header">
            <span className="sb-uv-idx" />
            <span>X</span><span>Y</span><span>Z</span><span>W</span><span>Weight</span>
            <span className="sb-uv-del" />
          </div>
          {uvRows.map((row, i) => (
            <div key={i} className="sb-uv-row">
              <span className="sb-uv-idx" style={{color:UV_COLORS[i%UV_COLORS.length]}}>{i+1}</span>
              {['x','y','z','w'].map(f=>(
                <input key={f} className="ctrl-input" value={row[f]}
                  onChange={e=>{const next=[...uvRows];next[i]={...next[i],[f]:e.target.value};syncUvRows(next);}}/>
              ))}
              <input className="ctrl-input" value={row.weight}
                onChange={e=>{const next=[...uvRows];next[i]={...next[i],weight:e.target.value};syncUvRows(next);}}/>
              <button className="ctrl-btn-delete sb-uv-del"
                disabled={uvRows.length<=1}
                onClick={()=>{const next=uvRows.filter((_,j)=>j!==i);syncUvRows(next);}}>×</button>
            </div>
          ))}
          <div className="ctrl-action-row">
            <button className="ctrl-btn-add"
              onClick={()=>syncUvRows([...uvRows,{x:'0.0',y:'0.0',z:'0.5',w:'0.5',weight:'0.25'}])}>
              + Add UV Row
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

// ── StarsAside (Exclusion Zones + UV Visualization — rendered in the Stars-section aside) ──
export const StarsAside = ({
  exclusionZones, setExclusionZones,
  draftZone, setDraftZone,
  selectedZoneIdx, setSelectedZoneIdx,
  exEnabled, setExEnabled,
  clusterSpread,
  previewImage, previewImageData,
  onRemovePreview, texOpacity, setTexOpacity, onImageUpload,
  uvOptions, uvOpacity, setUvOpacity,
}) => {
  const uvCanvasRef  = useRef(null);
  const exCanvasRef  = useRef(null);
  const exWrapRef    = useRef(null);
  const exDragging   = useRef(false);
  const exDragStart  = useRef({ x:0, y:0 });
  const exDraft      = useRef(null);

  const EX_RES = 800, UV_RES = 400;

  const drawExCanvas = useCallback((zones, draft) => {
    const canvas = exCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#08080f'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;
    for(let i=0;i<=16;i++){const p=i/16;ctx.beginPath();ctx.moveTo(p*W,0);ctx.lineTo(p*W,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,p*H);ctx.lineTo(W,p*H);ctx.stroke();}
    ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=1;
    for(let i=0;i<=4;i++){const p=i/4;ctx.beginPath();ctx.moveTo(p*W,0);ctx.lineTo(p*W,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,p*H);ctx.lineTo(W,p*H);ctx.stroke();}
    ctx.strokeStyle='rgba(59,118,255,0.45)';ctx.lineWidth=1;ctx.setLineDash([4,6]);
    ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='rgba(59,118,255,0.65)';ctx.beginPath();ctx.arc(W/2,H/2,3,0,Math.PI*2);ctx.fill();
    const spread=parseFloat(clusterSpread)||14000;
    const toK=v=>((v*2-1)*spread/1000).toFixed(0)+'k';
    ctx.font='9px monospace';
    [{nx:0,ny:0,ax:'left',ay:'top',px:5,py:5},{nx:1,ny:0,ax:'right',ay:'top',px:W-5,py:5},{nx:0,ny:1,ax:'left',ay:'bottom',px:5,py:H-5},{nx:1,ny:1,ax:'right',ay:'bottom',px:W-5,py:H-5}].forEach(({nx,ny,ax,ay,px,py})=>{ctx.fillStyle='rgba(255,255,255,0.22)';ctx.textAlign=ax;ctx.textBaseline=ay;ctx.fillText(`(${toK(nx)},${toK(ny)})`,px,py);});
    if(exEnabled&&zones.length>0){
      const offUnion=document.createElement('canvas');offUnion.width=W;offUnion.height=H;const uCtx=offUnion.getContext('2d');uCtx.fillStyle='#fff';
      zones.forEach(zone=>{const x0=Math.min(zone.x0,zone.x1)*W,y0=Math.min(zone.y0,zone.y1)*H,w=Math.abs(zone.x1-zone.x0)*W,h=Math.abs(zone.y1-zone.y0)*H;uCtx.fillRect(x0,y0,w,h);});
      const offEroded=document.createElement('canvas');offEroded.width=W;offEroded.height=H;const eCtx=offEroded.getContext('2d');eCtx.fillStyle='#fff';
      zones.forEach(zone=>{const x0=Math.min(zone.x0,zone.x1)*W,y0=Math.min(zone.y0,zone.y1)*H,w=Math.abs(zone.x1-zone.x0)*W,h=Math.abs(zone.y1-zone.y0)*H;eCtx.fillRect(x0+2,y0+2,Math.max(0,w-4),Math.max(0,h-4));});
      const offRim=document.createElement('canvas');offRim.width=W;offRim.height=H;const rCtx=offRim.getContext('2d');rCtx.drawImage(offUnion,0,0);rCtx.globalCompositeOperation='destination-out';rCtx.drawImage(offEroded,0,0);
      ctx.globalAlpha=0.1;ctx.drawImage(offUnion,0,0);ctx.globalAlpha=1;
      const offOutline=document.createElement('canvas');offOutline.width=W;offOutline.height=H;const oCtx=offOutline.getContext('2d');oCtx.fillStyle='rgba(255,80,80,0.95)';oCtx.fillRect(0,0,W,H);oCtx.globalCompositeOperation='destination-in';oCtx.drawImage(offRim,0,0);ctx.drawImage(offOutline,0,0);
      zones.forEach((zone,i)=>{const x0=Math.min(zone.x0,zone.x1)*W,y0=Math.min(zone.y0,zone.y1)*H,w=Math.abs(zone.x1-zone.x0)*W,h=Math.abs(zone.y1-zone.y0)*H;const isSel=i===selectedZoneIdx;if(isSel){ctx.fillStyle='rgba(255,50,50,0.12)';ctx.fillRect(x0,y0,w,h);}[[x0,y0],[x0+w,y0],[x0,y0+h],[x0+w,y0+h]].forEach(([cx,cy])=>{ctx.fillStyle=isSel?'#ff8080':'#ff5050';ctx.beginPath();ctx.arc(cx,cy,isSel?5:4,0,Math.PI*2);ctx.fill();});if(w>40&&h>22){ctx.fillStyle=isSel?'rgba(255,100,100,1)':'rgba(255,80,80,0.75)';ctx.font=`bold ${isSel?11:10}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`ZONE ${i+1}`,x0+w/2,y0+h/2);}});
    }
    if(draft){const x0=Math.min(draft.x0,draft.x1)*W,y0=Math.min(draft.y0,draft.y1)*H,w=Math.abs(draft.x1-draft.x0)*W,h=Math.abs(draft.y1-draft.y0)*H;ctx.fillStyle='rgba(59,118,255,0.12)';ctx.fillRect(x0,y0,w,h);ctx.strokeStyle='rgba(100,160,255,0.9)';ctx.lineWidth=1.5;ctx.setLineDash([4,4]);ctx.strokeRect(x0,y0,w,h);ctx.setLineDash([]);[[x0,y0],[x0+w,y0],[x0,y0+h],[x0+w,y0+h]].forEach(([cx,cy])=>{ctx.fillStyle='rgba(100,160,255,0.9)';ctx.beginPath();ctx.arc(cx,cy,4,0,Math.PI*2);ctx.fill();});if(w>60&&h>22){ctx.fillStyle='rgba(100,160,255,0.85)';ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('CONFIRM ZONE?',x0+w/2,y0+h/2);}}
  }, [exEnabled, clusterSpread, selectedZoneIdx]);

  useEffect(()=>{drawExCanvas(exclusionZones,draftZone);},[exclusionZones,draftZone,exEnabled,clusterSpread,drawExCanvas,selectedZoneIdx]);

  const getPosRel = useCallback((clientX, clientY) => {
    const rect = exWrapRef.current?.getBoundingClientRect();
    if(!rect) return{x:0,y:0};
    return{x:(clientX-rect.left)/rect.width,y:(clientY-rect.top)/rect.height};
  },[]);

  const onMouseDownEx = useCallback(e=>{
    if(!exEnabled)return;e.preventDefault();
    const pos=getPosRel(e.clientX,e.clientY);
    const sx=clamp01(pos.x),sy=clamp01(pos.y);
    exDragStart.current={x:sx,y:sy};exDragging.current=true;
    exDraft.current={x0:sx,y0:sy,x1:sx,y1:sy};setDraftZone(null);drawExCanvas(exclusionZones,null);
  },[exEnabled,getPosRel,drawExCanvas,exclusionZones,setDraftZone]);

  useEffect(()=>{
    const onMove=e=>{if(!exDragging.current)return;const pos=getPosRel(e.clientX,e.clientY);const x0=exDragStart.current.x,y0=exDragStart.current.y;const rx=Math.min(x0,pos.x),ry=Math.min(y0,pos.y);const rw=Math.abs(pos.x-x0),rh=Math.abs(pos.y-y0);const cx=clamp01(rx),cy=clamp01(ry);const cw=Math.min(rw,1-cx),ch=Math.min(rh,1-cy);exDraft.current={x0:cx,y0:cy,x1:cx+cw,y1:cy+ch};drawExCanvas(exclusionZones,exDraft.current);};
    const onUp=()=>{if(!exDragging.current)return;exDragging.current=false;const zone=exDraft.current;if(zone&&(zone.x1-zone.x0)>0.01&&(zone.y1-zone.y0)>0.01){setDraftZone({...zone});}else{setDraftZone(null);drawExCanvas(exclusionZones,null);}exDraft.current=null;};
    document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    return()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);};
  },[getPosRel,drawExCanvas,exclusionZones,setDraftZone]);

  // Canvas draws only the raster texture preview — grid, corner coordinates
  // and UV rect markers are CSS/HTML now (.sb-st-uv-grid / -corner-label /
  // -marker), so they stay crisp and themeable instead of baked pixels.
  useEffect(()=>{
    const canvas=uvCanvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext('2d');const W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);
    if(previewImage?.complete){
      const fullPasses=Math.floor(texOpacity);const remainder=texOpacity-fullPasses;
      for(let i=0;i<fullPasses;i++){ctx.globalAlpha=1;ctx.drawImage(previewImage,0,0,W,H);}
      if(remainder>0){ctx.globalAlpha=remainder;ctx.drawImage(previewImage,0,0,W,H);}
      ctx.globalAlpha=1;
      if(texOpacity<=1){ctx.fillStyle=`rgba(0,0,0,${0.28*(1-texOpacity*0.5)})`;ctx.fillRect(0,0,W,H);}
    }else{
      ctx.fillStyle='#0e0e14';ctx.fillRect(0,0,W,H);
    }
  },[previewImage,texOpacity]);

  const uvMarkers = parseUvOptions(uvOptions);
  const uvOverlayOpacity = Math.max(0, Math.min(1, parseFloat(uvOpacity)||0));

  const zoneWorldCoords=(zone)=>{const spread=parseFloat(clusterSpread)||14000;const toW=v=>((v*2-1)*spread).toFixed(0);return`X ${toW(Math.min(zone.x0,zone.x1))} → ${toW(Math.max(zone.x0,zone.x1))}   Z ${toW(Math.min(zone.y0,zone.y1))} → ${toW(Math.max(zone.y0,zone.y1))}`;};

  return (
    <>
      {/* Exclusion Zones */}
      <div className="ctrl-block">
        <div className="mp-subtitle">Exclusion Zones</div>
        <div className="sb-st-card-header">
          <div className="sb-st-ex-header-actions">
            <button
              type="button"
              className={`ctrl-toggle-row${exEnabled ? ' on' : ''}`}
              role="switch"
              aria-checked={exEnabled}
              onClick={() => setExEnabled(v => !v)}
              style={{ width: 'auto', padding: 0 }}
            >
              <span className="ctrl-toggle"><span className="ctrl-toggle-pole"/></span>
              <span className="ctrl-toggle-text">
                <span className="ctrl-toggle-label">{exEnabled ? 'Enabled' : 'Disabled'}</span>
              </span>
            </button>
            {exclusionZones.length > 0 && (
              <button className="ctrl-btn-danger" onClick={()=>{setExclusionZones([]);setDraftZone(null);setSelectedZoneIdx(null);}}>Clear All</button>
            )}
          </div>
        </div>
        {draftZone && (
          <div className="sb-st-ex-confirm-bar">
            <span className="sb-st-ex-confirm-label">New zone drawn — confirm to add it.</span>
            <div className="sb-st-ex-confirm-actions">
              <button className="ftr-preview-readmore" onClick={()=>{const n=[...exclusionZones,draftZone];setExclusionZones(n);setSelectedZoneIdx(n.length-1);setDraftZone(null);}}>Confirm</button>
              <button className="ctrl-btn-danger" onClick={()=>{setDraftZone(null);drawExCanvas(exclusionZones,null);}}>Discard</button>
            </div>
          </div>
        )}
        {exEnabled && exclusionZones.length > 0 && (
          <div style={{marginBottom:'12px'}}>
            {exclusionZones.map((zone,i)=>(
              <div key={i} className="sb-st-ex-info"
                style={{cursor:'pointer',marginBottom:'6px',outline:i===selectedZoneIdx?'1px solid rgba(255,80,80,0.5)':'none'}}
                onClick={()=>setSelectedZoneIdx(i===selectedZoneIdx?null:i)}>
                <span className="sb-st-ex-info-label">Zone {i+1}</span>
                {i===selectedZoneIdx&&<code className="sb-st-ex-info-code">{zoneWorldCoords(zone)}</code>}
                <button className="ctrl-btn-delete" style={{marginLeft:'auto'}} onClick={e=>{e.stopPropagation();const next=exclusionZones.filter((_,j)=>j!==i);setExclusionZones(next);setSelectedZoneIdx(prev=>prev===i?null:prev>i?prev-1:prev);}}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={{position:'relative'}}>
          <div className="ec-canvas-wrap sb-st-ex-wrap">
            <div ref={exWrapRef} style={{position:'absolute',inset:0,pointerEvents:'none'}}>
              <canvas ref={exCanvasRef} width={EX_RES} height={EX_RES} className="sb-st-ex-canvas"/>
            </div>
          </div>
          {/* Hit area extends beyond the visible canvas so a drag can start
              near the edge without needing pixel-perfect precision — purely
              functional, no visual footprint change. */}
          <div style={{position:'absolute',inset:'-24px',cursor:exEnabled?'crosshair':'default'}} onMouseDown={onMouseDownEx}/>
        </div>
      </div>

      {/* UV Visualization */}
      <div className="ctrl-block">
        <div className="mp-subtitle">UV Visualization</div>
        <DropSlot
          className="sb-st-upload-dropslot"
          acceptInput="image/*,.dds"
          status={previewImageData ? 'done' : 'idle'}
          idleText="Click or drop a texture preview"
          doneText="Texture preview loaded"
          onChange={onImageUpload}
          onClear={onRemovePreview}
        />
        {previewImageData && (
          <div className="ctrl-field" style={{marginTop:'14px',marginBottom:'6px'}}>
            <div className="ctrl-label">Texture Opacity</div>
            <div className="sb-st-opacity-row">
              <RangeSlider min="0" max="1" step="0.01" value={Math.min(parseFloat(texOpacity)||0,1)} onChange={e=>setTexOpacity(e.target.value===''?'':parseFloat(e.target.value)||0)}/>
              <input type="number" min="0" step="0.01" className="ctrl-input sb-st-opacity-input" value={texOpacity} onChange={e=>setTexOpacity(e.target.value)}/>
            </div>
          </div>
        )}
        <div className="ctrl-field" style={{marginBottom:'14px'}}>
          <div className="ctrl-label">UV Overlay Opacity</div>
          <div className="sb-st-opacity-row">
            <RangeSlider min="0" max="1" step="0.01" value={Math.min(parseFloat(uvOpacity)||0,1)} onChange={e=>setUvOpacity(e.target.value)}/>
            <input type="number" min="0" step="0.01" className="ctrl-input sb-st-opacity-input" value={uvOpacity} onChange={e=>setUvOpacity(e.target.value)}/>
          </div>
        </div>
        <div className="ec-canvas-wrap sb-st-uv-canvas">
          <canvas ref={uvCanvasRef} width={UV_RES} height={UV_RES} style={{width:'100%',height:'100%',display:'block',cursor:'default'}}/>
          <div className="sb-st-uv-grid" aria-hidden="true"/>
          <span className="sb-st-uv-corner-label sb-st-uv-corner-label--tl">(0,1)</span>
          <span className="sb-st-uv-corner-label sb-st-uv-corner-label--tr">(1,1)</span>
          <span className="sb-st-uv-corner-label sb-st-uv-corner-label--bl">(0,0)</span>
          <span className="sb-st-uv-corner-label sb-st-uv-corner-label--br">(1,0)</span>
          {uvMarkers.map((uv, idx) => {
            const color = UV_COLORS[idx % UV_COLORS.length];
            return (
              <div
                key={idx}
                className="sb-st-uv-marker"
                style={{
                  left: `${uv.x*100}%`, top: `${(1-uv.y-uv.w)*100}%`,
                  width: `${uv.z*100}%`, height: `${uv.w*100}%`,
                  '--marker-color': color,
                  background: uvOverlayOpacity > 0 ? color+Math.round(uvOverlayOpacity*255).toString(16).padStart(2,'0') : 'transparent',
                }}
              >
                <span className="sb-st-uv-marker-badge">{idx+1}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default Stars;
