/**
 * SkyboxGenerator_Stars.jsx — Sektion 04: Stars
 *
 * Enthält: YCurveEditor, ExclusionZoneCanvas, UVCanvas, RangeSlider, StyledSelect, Toggle.
 * Rein präsentational bis auf lokale Canvas-Zeichenlogik (Refs, kein persistenter State).
 */
import React, {
  useState, useRef, useEffect, useCallback,
} from 'react';
import { UV_COLORS, Y_MODES, clamp01, parseUvOptions } from './utils.js';

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

// ── Toggle ────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, label }) => (
  <label className="sb-st-toggle-label">
    <input type="checkbox" className="sb-st-toggle-input" checked={checked} onChange={onChange}/>
    <span className="sb-st-toggle-track"><span className="sb-st-toggle-thumb"/></span>
    {label && <span className="sb-st-toggle-text">{label}</span>}
  </label>
);

// ── StyledSelect ──────────────────────────────────────────────────
const StyledSelect = ({ value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  const selected = options.find(o => o.value === value);
  return (
    <div className="sb-st-styled-select" ref={ref}>
      <button type="button" className={`sb-st-styled-select-trigger${open?' open':''}`} onClick={()=>setOpen(v=>!v)}>
        <span>{selected?.label ?? value}</span>
        <svg className="sb-st-styled-select-arrow" width="10" height="6" viewBox="0 0 10 6">
          <path d="M0 0L5 6L10 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="sb-st-styled-select-dropdown">
          {options.map(o => (
            <div key={o.value} className={`sb-st-styled-select-option${o.value===value?' selected':''}`}
              onMouseDown={()=>{onChange(o.value);setOpen(false);}}>
              {o.value === value && <span className="sb-st-styled-select-tick">✓</span>}
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── YCurveEditor ──────────────────────────────────────────────────
const YCurveEditor = ({ points, onChange, yMax = 1500 }) => {
  const canvasRef = useRef(null);
  const wrapRef   = useRef(null);
  const dragIdx   = useRef(null);
  const hoverIdx  = useRef(-1);
  const didMove   = useRef(false);
  const downPos   = useRef(null);
  const [isHoveringPoint, setIsHoveringPoint] = useState(false);
  const CW = 400, CH = 400, HIT_PX = 14;
  const ptToCv = (p) => ({ cx: p.x * CW, cy: (1 - p.y) * CH });

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
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#03040b'; ctx.fillRect(0,0,W,H);
    const vg = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.75);
    vg.addColorStop(0,'rgba(8,16,36,0)'); vg.addColorStop(1,'rgba(0,0,0,0.55)');
    ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,0.022)'; ctx.lineWidth=1;
    for(let i=1;i<8;i++){const p=i/8;ctx.beginPath();ctx.moveTo(p*W,0);ctx.lineTo(p*W,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,p*H);ctx.lineTo(W,p*H);ctx.stroke();}
    ctx.strokeStyle='rgba(59,118,255,0.09)'; ctx.lineWidth=1;
    for(let i=1;i<4;i++){const p=i/4;ctx.beginPath();ctx.moveTo(p*W,0);ctx.lineTo(p*W,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,p*H);ctx.lineTo(W,p*H);ctx.stroke();}
    ctx.font='9px monospace'; ctx.fillStyle='rgba(255,255,255,0.15)';
    ctx.textAlign='left';  ctx.textBaseline='bottom'; ctx.fillText('prob 0%',5,H-4);
    ctx.textAlign='right'; ctx.textBaseline='bottom'; ctx.fillText('100%',W-5,H-4);
    ctx.textAlign='center';ctx.textBaseline='bottom'; ctx.fillText('→ probability',W/2,H-4);
    ctx.save(); ctx.translate(10,H/2); ctx.rotate(-Math.PI/2);
    ctx.textAlign='center';ctx.textBaseline='middle'; ctx.fillText('height ↑',0,0); ctx.restore();
    const yMaxLabel = yMax>=1000?`${(yMax/1000).toFixed(1)}k`:String(yMax);
    ctx.textAlign='left';ctx.textBaseline='top';   ctx.fillText(yMaxLabel,14,4);
    ctx.textAlign='left';ctx.textBaseline='bottom';ctx.fillText('0',14,H-16);
    ctx.strokeStyle='rgba(59,118,255,0.3)'; ctx.lineWidth=1; ctx.strokeRect(0.5,0.5,W-1,H-1);
    if (!points?.length) {
      ctx.fillStyle='rgba(59,118,255,0.3)';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font='11px monospace';ctx.fillText('Click to add control points',W/2,H/2); return;
    }
    const sortedByHeight = [...points].sort((a,b)=>a.y-b.y);
    const cvByHeight     = sortedByHeight.map(ptToCv);
    if (points.length >= 2) {
      cvByHeight.forEach(({cx,cy})=>{ctx.beginPath();ctx.moveTo(0,cy);ctx.lineTo(cx,cy);ctx.strokeStyle='rgba(59,118,255,0.07)';ctx.lineWidth=1;ctx.setLineDash([2,5]);ctx.stroke();ctx.setLineDash([]);});
      ctx.beginPath();ctx.moveTo(0,cvByHeight[0].cy);
      cvByHeight.forEach(({cx,cy})=>ctx.lineTo(cx,cy));
      ctx.lineTo(0,cvByHeight[cvByHeight.length-1].cy);ctx.closePath();
      const ag=ctx.createLinearGradient(0,0,W,0);ag.addColorStop(0,'rgba(59,118,255,0.03)');ag.addColorStop(1,'rgba(80,150,255,0.22)');
      ctx.fillStyle=ag;ctx.fill();
      const linePath=()=>{ctx.beginPath();ctx.lineJoin='round';ctx.lineCap='round';cvByHeight.forEach(({cx,cy},i)=>i===0?ctx.moveTo(cx,cy):ctx.lineTo(cx,cy));};
      linePath();ctx.strokeStyle='rgba(59,118,255,0.22)';ctx.lineWidth=14;ctx.stroke();
      linePath();ctx.strokeStyle='rgba(80,140,255,0.5)';ctx.lineWidth=5;ctx.stroke();
      linePath();ctx.strokeStyle='rgba(140,190,255,0.95)';ctx.lineWidth=1.5;ctx.stroke();
    }
    const hovI=hoverIdx.current,dragI=dragIdx.current;
    points.forEach((p,i)=>{
      const{cx,cy}=ptToCv(p);
      const isDrag=dragI===i,isHov=hovI===i,r=isDrag?9:isHov?8:6;
      if(isDrag||isHov){const haloR=r+(isDrag?11:7);const halo=ctx.createRadialGradient(cx,cy,0,cx,cy,haloR);halo.addColorStop(0,isDrag?'rgba(60,120,220,0.22)':'rgba(59,118,255,0.14)');halo.addColorStop(1,'rgba(0,0,0,0)');ctx.beginPath();ctx.arc(cx,cy,haloR,0,Math.PI*2);ctx.fillStyle=halo;ctx.fill();}
      ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.fillStyle=isDrag?'rgba(30,40,65,0.92)':isHov?'rgba(20,30,55,0.88)':'rgba(12,18,35,0.82)';ctx.fill();
      ctx.strokeStyle=`rgba(80,140,255,${isDrag?0.95:isHov?0.75:0.45})`;ctx.lineWidth=isDrag?1.5:1;ctx.stroke();
      ctx.beginPath();ctx.arc(cx,cy,r-1,Math.PI*1.15,Math.PI*1.75);
      ctx.strokeStyle=isDrag?'rgba(255,255,255,0.55)':isHov?'rgba(255,255,255,0.35)':'rgba(255,255,255,0.18)';ctx.lineWidth=1;ctx.stroke();
      if(isDrag||isHov){const probLabel=(p.x*100).toFixed(0)+'%';const heightLabel=(p.y*yMax).toFixed(0);const label=`prob ${probLabel}  h=${heightLabel}`;ctx.font='bold 10px monospace';const tw=ctx.measureText(label).width;let tx=cx,ty=cy-r-18;if(ty<12)ty=cy+r+18;tx=Math.max(tw/2+6,Math.min(W-tw/2-6,tx));const pw=tw+14,ph=17,px2=tx-pw/2,py2=ty-ph/2;ctx.fillStyle='rgba(8,12,28,0.92)';ctx.beginPath();ctx.roundRect?.(px2,py2,pw,ph,3)??ctx.rect(px2,py2,pw,ph);ctx.fill();ctx.strokeStyle='rgba(80,140,255,0.55)';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect?.(px2,py2,pw,ph,3)??ctx.rect(px2,py2,pw,ph);ctx.stroke();ctx.fillStyle='rgba(160,200,255,0.95)';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,tx,ty);}
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

  return (
    <div className="sb-st-curve-wrap" ref={wrapRef}>
      <div className="sb-st-curve-header">
        <span className="sb-st-curve-header-label">Y-Distribution Curve</span>
        <div className="sb-st-curve-header-stats">
          <span className="sb-st-curve-stat">pts <span className="sb-st-curve-stat-val">{points?.length??0}</span></span>
          <span className="sb-st-curve-stat">yMax <span className="sb-st-curve-stat-val">{yMax>=1000?`${(yMax/1000).toFixed(1)}k`:String(yMax)}</span></span>
        </div>
      </div>
      <canvas ref={canvasRef} width={CW} height={CH} className="sb-st-curve-canvas"
        style={{cursor:isHoveringPoint?'pointer':'crosshair'}}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}
        onContextMenu={e=>e.preventDefault()}/>
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

// ── Stars Hauptkomponente ───────────────────────────────────
const Stars = ({
  numStars, setNumStars, numClusters, setNumClusters,
  clusterSpread, setClusterSpread, clusterStdDev, setClusterStdDev,
  backgroundRatio, setBackgroundRatio, scaleMin, setScaleMin, scaleMax, setScaleMax,
  uvOpacity, setUvOpacity, uvOptions, uvWeights,
  uvRows, syncUvRows,
  seed, setSeed, useSeed, setUseSeed, onRandomizeSeed,
  yMode, setYMode, yMax, setYMax,
  yCenter, setYCenter, yStdDev, setYStdDev,
  yLayers, setYLayers,
  diskCenter, setDiskCenter, diskStdDev, setDiskStdDev,
  haloStdDev, setHaloStdDev, haloRatio, setHaloRatio,
  curvePoints, setCurvePoints,
  yClusterScatter, setYClusterScatter,
  exclusionZones, setExclusionZones,
  draftZone, setDraftZone,
  selectedZoneIdx, setSelectedZoneIdx,
  exEnabled, setExEnabled,
  previewImage, previewImageData,
  onRemovePreview, texOpacity, setTexOpacity, onImageUpload,
  onResetDefaults, onInjectStars,
}) => {
  // Canvas refs (lokal, kein persistenter State)
  const uvCanvasRef  = useRef(null);
  const exCanvasRef  = useRef(null);
  const exWrapRef    = useRef(null);
  const fileInputRef = useRef(null);
  const exDragging   = useRef(false);
  const exDragStart  = useRef({ x:0, y:0 });
  const exDraft      = useRef(null);

  const EX_RES = 800, UV_RES = 400;

  // ── Exclusion-Canvas-Zeichnung ──────────────────────────────
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

  // Exclusion zone mouse interaction
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

  // UV Canvas
  useEffect(()=>{
    const canvas=uvCanvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext('2d');const W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);
    if(previewImage?.complete){const fullPasses=Math.floor(texOpacity);const remainder=texOpacity-fullPasses;for(let i=0;i<fullPasses;i++){ctx.globalAlpha=1;ctx.drawImage(previewImage,0,0,W,H);}if(remainder>0){ctx.globalAlpha=remainder;ctx.drawImage(previewImage,0,0,W,H);}ctx.globalAlpha=1;if(texOpacity<=1){ctx.fillStyle=`rgba(0,0,0,${0.28*(1-texOpacity*0.5)})`;ctx.fillRect(0,0,W,H);}}else{ctx.fillStyle='#0e0e14';ctx.fillRect(0,0,W,H);}
    ctx.strokeStyle='rgba(255,255,255,0.07)';ctx.lineWidth=1;for(let i=1;i<4;i++){const p=(i/4)*W;ctx.beginPath();ctx.moveTo(p,0);ctx.lineTo(p,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,p);ctx.lineTo(W,p);ctx.stroke();}
    ctx.font='9px monospace';ctx.fillStyle='rgba(255,255,255,0.2)';
    ctx.textAlign='left';ctx.textBaseline='bottom';ctx.fillText('(0,0)',4,H-3);ctx.textAlign='right';ctx.textBaseline='bottom';ctx.fillText('(1,0)',W-3,H-3);ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText('(0,1)',4,3);ctx.textAlign='right';ctx.textBaseline='top';ctx.fillText('(1,1)',W-3,3);
    const parsedUvs=parseUvOptions(uvOptions);const opacity=parseFloat(uvOpacity)||0;
    parsedUvs.forEach((uv,idx)=>{const color=UV_COLORS[idx%UV_COLORS.length];const cx1=uv.x*W,cy1=(1-uv.y-uv.w)*H,cw=uv.z*W,ch=uv.w*H;if(opacity>0){ctx.fillStyle=color+Math.round(opacity*255).toString(16).padStart(2,'0');ctx.fillRect(cx1,cy1,cw,ch);}ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeRect(cx1,cy1,cw,ch);const cx=cx1+cw/2,cy=cy1+ch/2;ctx.fillStyle='#111';ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,13,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(idx+1),cx,cy);});
  },[uvOptions,uvOpacity,previewImage,texOpacity]);

  const zoneWorldCoords=(zone)=>{const spread=parseFloat(clusterSpread)||14000;const toW=v=>((v*2-1)*spread).toFixed(0);return`X ${toW(Math.min(zone.x0,zone.x1))} → ${toW(Math.max(zone.x0,zone.x1))}   Z ${toW(Math.min(zone.y0,zone.y1))} → ${toW(Math.max(zone.y0,zone.y1))}`;};

  return (
    <div className="skybox-section-stack">

      {/* Controls */}
      <div className="skybox-section-card">
        <div className="skybox-card-header">
          <h2 className="skybox-section-title">Star Parameters</h2>
          <div style={{display:'flex',gap:'8px'}}>
            <button className="btn-secondary" onClick={onResetDefaults}>Reset Defaults</button>
            <button className="btn-primary" onClick={onInjectStars}>Inject Stars</button>
          </div>
        </div>

        <div className="skybox-form-row">
          <div className="skybox-form-group">
            <label className="skybox-form-label">Star Count</label>
            <input className="skybox-input" value={numStars} onChange={e=>setNumStars(e.target.value)}/>
          </div>
          <div className="skybox-form-group">
            <label className="skybox-form-label">Clusters</label>
            <input className="skybox-input" value={numClusters} onChange={e=>setNumClusters(e.target.value)}/>
          </div>
          <div className="skybox-form-group">
            <label className="skybox-form-label">Background Ratio</label>
            <RangeSlider min="0" max="1" step="0.01" value={parseFloat(backgroundRatio)||0} onChange={e=>setBackgroundRatio(e.target.value)}/>
            <input className="skybox-input" value={backgroundRatio} onChange={e=>setBackgroundRatio(e.target.value)}/>
          </div>
        </div>

        <div className="skybox-form-row">
          <div className="skybox-form-group">
            <label className="skybox-form-label">Cluster Spread</label>
            <input className="skybox-input" value={clusterSpread} onChange={e=>setClusterSpread(e.target.value)}/>
          </div>
          <div className="skybox-form-group">
            <label className="skybox-form-label">Cluster Std Dev</label>
            <input className="skybox-input" value={clusterStdDev} onChange={e=>setClusterStdDev(e.target.value)}/>
          </div>
          <div className="skybox-form-group">
            <label className="skybox-form-label">Y Cluster Scatter</label>
            <input className="skybox-input" value={yClusterScatter} onChange={e=>setYClusterScatter(e.target.value)}/>
          </div>
        </div>

        <div className="skybox-form-row">
          <div className="skybox-form-group">
            <label className="skybox-form-label">Scale Min</label>
            <input className="skybox-input" value={scaleMin} onChange={e=>setScaleMin(e.target.value)}/>
          </div>
          <div className="skybox-form-group">
            <label className="skybox-form-label">Scale Max</label>
            <input className="skybox-input" value={scaleMax} onChange={e=>setScaleMax(e.target.value)}/>
          </div>
        </div>
      </div>

      {/* Seed */}
      <div className="skybox-section-card">
        <h2 className="skybox-section-title">Seed</h2>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <Toggle checked={useSeed} onChange={e=>setUseSeed(e.target.checked)} label="Use Seed"/>
          {useSeed && (
            <>
              <input className="skybox-input" style={{width:'120px'}} value={seed}
                onChange={e=>setSeed(parseInt(e.target.value)||0)}/>
              <button className="btn-secondary" onClick={onRandomizeSeed}>↺ Randomize</button>
            </>
          )}
        </div>
      </div>

      {/* Y-Distribution */}
      <div className="skybox-section-card">
        <h2 className="skybox-section-title">Y-Distribution</h2>
        <div className="skybox-form-group">
          <label className="skybox-form-label">Mode</label>
          <StyledSelect value={yMode} onChange={setYMode} options={Y_MODES}/>
        </div>
        {yMode==='flat' && (
          <div className="skybox-form-group"><label className="skybox-form-label">Y Max</label><input className="skybox-input" value={yMax} onChange={e=>setYMax(e.target.value)}/></div>
        )}
        {yMode==='gaussian' && (
          <div className="skybox-form-row">
            <div className="skybox-form-group"><label className="skybox-form-label">Center</label><input className="skybox-input" value={yCenter} onChange={e=>setYCenter(e.target.value)}/></div>
            <div className="skybox-form-group"><label className="skybox-form-label">Std Dev</label><input className="skybox-input" value={yStdDev} onChange={e=>setYStdDev(e.target.value)}/></div>
            <div className="skybox-form-group"><label className="skybox-form-label">Y Max</label><input className="skybox-input" value={yMax} onChange={e=>setYMax(e.target.value)}/></div>
          </div>
        )}
        {yMode==='layered' && (
          <div className="skybox-form-group">
            <label className="skybox-form-label">Layers (center, stddev, weight per line)</label>
            <textarea className="skybox-input skybox-textarea" rows={4} value={yLayers} onChange={e=>setYLayers(e.target.value)}/>
            <div className="skybox-form-group"><label className="skybox-form-label">Y Max</label><input className="skybox-input" value={yMax} onChange={e=>setYMax(e.target.value)}/></div>
          </div>
        )}
        {yMode==='disk_halo' && (
          <div className="skybox-form-row">
            <div className="skybox-form-group"><label className="skybox-form-label">Disk Center</label><input className="skybox-input" value={diskCenter} onChange={e=>setDiskCenter(e.target.value)}/></div>
            <div className="skybox-form-group"><label className="skybox-form-label">Disk StdDev</label><input className="skybox-input" value={diskStdDev} onChange={e=>setDiskStdDev(e.target.value)}/></div>
            <div className="skybox-form-group"><label className="skybox-form-label">Halo StdDev</label><input className="skybox-input" value={haloStdDev} onChange={e=>setHaloStdDev(e.target.value)}/></div>
            <div className="skybox-form-group"><label className="skybox-form-label">Halo Ratio</label><input className="skybox-input" value={haloRatio} onChange={e=>setHaloRatio(e.target.value)}/></div>
            <div className="skybox-form-group"><label className="skybox-form-label">Y Max</label><input className="skybox-input" value={yMax} onChange={e=>setYMax(e.target.value)}/></div>
          </div>
        )}
        {yMode==='curve' && (
          <>
            <div className="skybox-form-group"><label className="skybox-form-label">Y Max</label><input className="skybox-input" value={yMax} onChange={e=>setYMax(e.target.value)}/></div>
            <YCurveEditor points={curvePoints} onChange={setCurvePoints} yMax={parseFloat(yMax)||1500}/>
          </>
        )}
      </div>

      {/* UV Rows */}
      <div className="skybox-section-card">
        <h2 className="skybox-section-title">UV Options</h2>
        {uvRows.map((row, i) => (
          <div key={i} className="skybox-form-row" style={{alignItems:'center'}}>
            <span style={{color:UV_COLORS[i%UV_COLORS.length],fontFamily:'monospace',fontWeight:700,width:'20px',flexShrink:0}}>{i+1}</span>
            {['x','y','z','w'].map(f=>(
              <div key={f} className="skybox-form-group" style={{flexShrink:1}}>
                <label className="skybox-form-label">{f.toUpperCase()}</label>
                <input className="skybox-input" value={row[f]}
                  onChange={e=>{const next=[...uvRows];next[i]={...next[i],[f]:e.target.value};syncUvRows(next);}}/>
              </div>
            ))}
            <div className="skybox-form-group" style={{flexShrink:1}}>
              <label className="skybox-form-label">Weight</label>
              <input className="skybox-input" value={row.weight}
                onChange={e=>{const next=[...uvRows];next[i]={...next[i],weight:e.target.value};syncUvRows(next);}}/>
            </div>
            <button className="btn-delete-xs" style={{alignSelf:'flex-end',marginBottom:'2px'}}
              disabled={uvRows.length<=1}
              onClick={()=>{const next=uvRows.filter((_,j)=>j!==i);syncUvRows(next);}}>×</button>
          </div>
        ))}
        <button className="btn-secondary" style={{marginTop:'8px'}}
          onClick={()=>syncUvRows([...uvRows,{x:'0.0',y:'0.0',z:'0.5',w:'0.5',weight:'0.25'}])}>
          + Add UV Row
        </button>
      </div>

      {/* Exclusion Zones */}
      <div className="section-card">
        <div className="sb-st-card-header">
          <h2 className="section-title">EXCLUSION ZONES</h2>
          <div className="sb-st-ex-header-actions">
            <Toggle checked={exEnabled} onChange={e=>setExEnabled(e.target.checked)} label={exEnabled?'Enabled':'Disabled'}/>
            {exclusionZones.length > 0 && (
              <button className="btn-delete" onClick={()=>{setExclusionZones([]);setDraftZone(null);setSelectedZoneIdx(null);}}>Clear All</button>
            )}
          </div>
        </div>
        {draftZone && (
          <div className="sb-st-ex-confirm-bar">
            <span className="sb-st-ex-confirm-label">New zone drawn — confirm to add it.</span>
            <div className="sb-st-ex-confirm-actions">
              <button className="sb-st-ex-btn-confirm" onClick={()=>{const n=[...exclusionZones,draftZone];setExclusionZones(n);setSelectedZoneIdx(n.length-1);setDraftZone(null);}}>Confirm</button>
              <button className="sb-st-ex-btn-discard" onClick={()=>{setDraftZone(null);drawExCanvas(exclusionZones,null);}}>Discard</button>
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
                <button className="btn-delete-xs" style={{marginLeft:'auto'}} onClick={e=>{e.stopPropagation();const next=exclusionZones.filter((_,j)=>j!==i);setExclusionZones(next);setSelectedZoneIdx(prev=>prev===i?null:prev>i?prev-1:prev);}}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={{margin:'-24px',padding:'24px',cursor:exEnabled?'crosshair':'default'}} onMouseDown={onMouseDownEx}>
          <div className="sb-st-ex-wrap">
            <div ref={exWrapRef} style={{position:'absolute',inset:0,pointerEvents:'none'}}>
              <canvas ref={exCanvasRef} width={EX_RES} height={EX_RES} className="sb-st-ex-canvas"/>
            </div>
          </div>
        </div>
      </div>

      {/* UV Visualization */}
      <div className="section-card">
        <div className="sb-st-card-header" style={{marginBottom:'14px'}}>
          <h2 className="section-title">UV VISUALIZATION</h2>
          {previewImageData && <button className="btn-delete" onClick={onRemovePreview}>Remove</button>}
        </div>
        <div className="sb-st-upload-area" onClick={()=>fileInputRef.current?.click()}>
          <span className="sb-st-upload-icon"/>
          <span>{previewImageData?'Replace texture preview':'Upload texture preview'}</span>
          <input ref={fileInputRef} type="file" style={{display:'none'}} accept="image/*,.dds" onChange={onImageUpload}/>
        </div>
        {previewImageData && (
          <div className="skybox-form-group" style={{marginTop:'14px',marginBottom:'6px'}}>
            <label className="skybox-form-label">Texture Opacity</label>
            <div className="sb-st-opacity-row">
              <RangeSlider min="0" max="1" step="0.01" value={Math.min(parseFloat(texOpacity)||0,1)} onChange={e=>setTexOpacity(e.target.value===''?'':parseFloat(e.target.value)||0)}/>
              <input type="number" min="0" step="0.01" className="form-input sb-st-opacity-input" value={texOpacity} onChange={e=>setTexOpacity(e.target.value)}/>
            </div>
          </div>
        )}
        <div className="skybox-form-group" style={{marginBottom:'14px'}}>
          <label className="skybox-form-label">UV Overlay Opacity</label>
          <div className="sb-st-opacity-row">
            <RangeSlider min="0" max="1" step="0.01" value={Math.min(parseFloat(uvOpacity)||0,1)} onChange={e=>setUvOpacity(e.target.value)}/>
            <input type="number" min="0" step="0.01" className="form-input sb-st-opacity-input" value={uvOpacity} onChange={e=>setUvOpacity(e.target.value)}/>
          </div>
        </div>
        <canvas ref={uvCanvasRef} width={UV_RES} height={UV_RES} className="sb-st-uv-canvas"/>
      </div>

    </div>
  );
};

export default Stars;
