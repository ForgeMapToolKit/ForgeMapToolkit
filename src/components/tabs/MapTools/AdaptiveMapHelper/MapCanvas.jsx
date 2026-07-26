import { useState, useRef, useEffect } from "react";
import { ICON_MASS, ICON_ENERGY, getAcuIcon, useIconsReady } from './luaGenerators';

// ── Map Canvas ───────────────────────────────────────────────────────────────
export default function MapCanvas({ parsed, mapSize, assignments, armyList, armyColors, onAssign, onRemove, previewDataUrl, mirrorMode, quickArmy }) {
  useIconsReady(); // re-render once icon URLs are resolved
  const wrapRef        = useRef();
  const [camera, setCamera] = useState({ x:0, y:0, zoom:1 });
  const cameraRef      = useRef({ x:0, y:0, zoom:1 });
  const dragRef        = useRef(null);
  const mousePosRef    = useRef(null);
  const insideRef      = useRef(false);
  const [hover, setHover]   = useState(null);
  const [popup, setPopup]   = useState(null);
  const [size,  setSize]    = useState({ w:800, h:600 });

  // Keep cameraRef in sync so wheel handler always has current values
  useEffect(() => { cameraRef.current = camera; }, [camera]);

  useEffect(() => {
    const measure = () => {
      if (wrapRef.current) setSize({ w:wrapRef.current.clientWidth, h:wrapRef.current.clientHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Register wheel as non-passive so preventDefault() works
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = e => {
      e.preventDefault();
      const rect  = el.getBoundingClientRect();
      const mx    = e.clientX - rect.left;   // mouse x in canvas px
      const my    = e.clientY - rect.top;    // mouse y in canvas px
      const c     = cameraRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.max(0.3, Math.min(10, c.zoom * factor));

      // World point under mouse before zoom
      const wx = (mx - c.x - rect.width  / 2) / c.zoom;
      const wy = (my - c.y - rect.height / 2) / c.zoom;

      // Shift camera so that same world point stays under mouse after zoom
      const newX = mx - rect.width  / 2 - wx * newZoom;
      const newY = my - rect.height / 2 - wy * newZoom;

      setCamera({ x: newX, y: newY, zoom: newZoom });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const w2s = (wx,wy) => ({
    cx: Math.round(size.w/2 + (wx/mapSize-0.5)*mapSize*camera.zoom + camera.x),
    cy: Math.round(size.h/2 + (wy/mapSize-0.5)*mapSize*camera.zoom + camera.y),
  });
  const s2w = (sx,sy) => ({
    wx: ((sx-camera.x-size.w/2)/camera.zoom/mapSize+0.5)*mapSize,
    wy: ((sy-camera.y-size.h/2)/camera.zoom/mapSize+0.5)*mapSize,
  });

  const hitTest = (wx,wy,tx,ty,r) => Math.abs(wx-tx)<r && Math.abs(wy-ty)<r;

  const handleMouseDown = e=>{ if(e.button===1||e.button===2) dragRef.current={sx:e.clientX,sy:e.clientY,ox:camera.x,oy:camera.y}; };
  const handleMouseMove = e=>{ const d=dragRef.current; if(d) setCamera(c=>({...c,x:d.ox+e.clientX-d.sx,y:d.oy+e.clientY-d.sy})); };
  const handleMouseUp   = ()=>{ dragRef.current=null; };

  const handleMouseMoveHover = e => {
    handleMouseMove(e);
    // Track mouse position relative to canvas for edge-scroll
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (popup) return;
    if (!rect) return;
    const {wx,wy} = s2w(e.clientX-rect.left, e.clientY-rect.top);
    const thr = 10/camera.zoom;
    for (const [k,{x,y}] of Object.entries(parsed.mass))  { if(hitTest(wx,wy,x,y,thr)){setHover({key:k,kind:'mass', x,y});return;} }
    for (const [k,{x,y}] of Object.entries(parsed.hydro)) { if(hitTest(wx,wy,x,y,thr)){setHover({key:k,kind:'hydro',x,y});return;} }
    setHover(null);
  };

  // Find mirror marker: tests X-axis, Y-axis, and XY (point) mirror candidates,
  // picks whichever is closest. Threshold 8% of map size to handle imprecise maps.
  const findMirror = (hitKey, hitKind) => {
    const src = hitKind==='mass' ? parsed.mass[hitKey] : parsed.hydro[hitKey];
    if (!src) return null;
    const pool = hitKind==='mass' ? parsed.mass : parsed.hydro;
    const half = mapSize / 2;

    // Three possible mirror positions depending on map symmetry axis
    const candidates = [
      { tx: src.x,           ty: mapSize - src.y }, // X-axis  (flip Y)
      { tx: mapSize - src.x, ty: src.y           }, // Y-axis  (flip X)
      { tx: mapSize - src.x, ty: mapSize - src.y }, // XY / point (flip both)
    ];

    let best = null, bestD = Infinity;
    for (const [k, {x,y}] of Object.entries(pool)) {
      if (k === hitKey) continue;
      for (const { tx, ty } of candidates) {
        const d = Math.hypot(x - tx, y - ty);
        if (d < bestD) { bestD = d; best = k; }
      }
    }
    // Accept if within 8% of map size (looser than before to handle imprecise placement)
    return bestD < mapSize * 0.08 ? best : null;
  };

  const handleClick = e => {
    if (e.button!==0) return;
    if (popup) { setPopup(null); return; }
    const rect = wrapRef.current.getBoundingClientRect();
    const {wx,wy} = s2w(e.clientX-rect.left, e.clientY-rect.top);
    const thr = 9/camera.zoom;

    const allMarkers = [
      ...Object.entries(parsed.mass).map(([k,v])=>({k,kind:'mass',...v})),
      ...Object.entries(parsed.hydro).map(([k,v])=>({k,kind:'hydro',...v})),
    ];
    const hit = allMarkers.find(({x,y})=>hitTest(wx,wy,x,y,thr));
    if (!hit) return;

    if (quickArmy) {
      // Quick-assign mode: assign immediately, no popup
      const spawnType = hit.kind==='mass' ? 'spawnMex' : 'spawnHydro';
      const asgn = { type:spawnType, army:quickArmy };
      onAssign(hit.k, asgn);
      if (mirrorMode) {
        const mirrorKey = findMirror(hit.k, hit.kind);
        if (mirrorKey) onAssign(mirrorKey, asgn);
      }
    } else {
      // Normal mode: open popup (mirror applies after popup confirms)
      setPopup({key:hit.k, kind:hit.kind, sx:e.clientX-rect.left, sy:e.clientY-rect.top, mirrorMode});
    }
  };

  const handleRightClick = e => {
    e.preventDefault(); setPopup(null);
    const rect = wrapRef.current.getBoundingClientRect();
    const {wx,wy} = s2w(e.clientX-rect.left, e.clientY-rect.top);
    const thr = 11/camera.zoom;
    for (const [k,{x,y}] of Object.entries(parsed.mass))  { if(hitTest(wx,wy,x,y,thr)){onRemove(k);return;} }
    for (const [k,{x,y}] of Object.entries(parsed.hydro)) { if(hitTest(wx,wy,x,y,thr)){onRemove(k);return;} }
  };

  const getColor = key => {
    const a = assignments[key]; if (!a) return null;
    return a.army ? armyColors[(parseInt(a.army.replace('ARMY_',''))-1)%armyColors.length] : '#888';
  };

  // Fixed icon size — always 16px screen pixels, no sub-pixel scaling
  const iSz  = 16;
  const armR  = 12;
  const mapCorners = [w2s(0,0),w2s(mapSize,0),w2s(mapSize,mapSize),w2s(0,mapSize)];

  return (
    <div ref={wrapRef} className="amh-canvas-inner"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMoveHover}
      onMouseUp={handleMouseUp}
      onMouseEnter={()=>{ insideRef.current=true; }}
      onMouseLeave={()=>{ insideRef.current=false; mousePosRef.current=null; dragRef.current=null; }}
      onClick={handleClick}
      onContextMenu={handleRightClick}
    >
      <svg width={size.w} height={size.h} style={{display:'block',position:'absolute',inset:0}}>
        {/* Map bg */}
        <polygon points={mapCorners.map(c=>`${c.cx},${c.cy}`).join(' ')} fill="#0c1018" stroke="rgba(255,140,0,0.2)" strokeWidth={1.5}/>
        {/* Preview image as map background */}
        {previewDataUrl && (() => {
          const tl=w2s(0,0), tr=w2s(mapSize,0), bl=w2s(0,mapSize), br=w2s(mapSize,mapSize);
          const x=Math.min(tl.cx,bl.cx), y=Math.min(tl.cy,tr.cy);
          const w=Math.max(tr.cx,br.cx)-x, h=Math.max(bl.cy,br.cy)-y;
          return <image href={previewDataUrl} x={x} y={y} width={w} height={h}
            preserveAspectRatio="none" style={{imageRendering:'pixelated'}} opacity={0.55}/>;
        })()}
        {/* Grid */}
        {[0.25,0.5,0.75].map(f=>{
          const a=w2s(f*mapSize,0),b=w2s(f*mapSize,mapSize),c2=w2s(0,f*mapSize),d=w2s(mapSize,f*mapSize);
          return <g key={f}>
            <line x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} strokeDasharray="4,4"/>
            <line x1={c2.cx} y1={c2.cy} x2={d.cx} y2={d.cy} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} strokeDasharray="4,4"/>
          </g>;
        })}

        {/* Mass markers */}
        {Object.entries(parsed.mass).map(([key,{x,y}])=>{
          const {cx,cy}=w2s(x,y); const col=getColor(key);
          const isHov=hover?.key===key&&hover?.kind==='mass';
          const isPop=popup?.key===key;
          const h=iSz/2;
          return <g key={key} opacity={0.95}>
            {col&&<circle cx={cx} cy={cy} r={h+4} fill={col} opacity={0.3}/>}
            <circle cx={cx} cy={cy} r={h+3} fill="none"
              stroke={isPop?'#ff8c00':isHov?'#ffffff':col||'rgba(100,181,246,0.5)'}
              strokeWidth={isPop||isHov?2:1}/>
            <image href={ICON_MASS} x={cx-h} y={cy-h} width={iSz} height={iSz} style={{imageRendering:'pixelated'}}/>
            {camera.zoom>2.8&&<text x={cx} y={cy-h-5} textAnchor="middle" fill="#c9d1d9" fontSize={8} fontFamily="monospace">{key.padStart(2,'0')}</text>}
          </g>;
        })}

        {/* Hydro markers */}
        {Object.entries(parsed.hydro).map(([key,{x,y}])=>{
          const {cx,cy}=w2s(x,y); const col=getColor(key);
          const isHov=hover?.key===key&&hover?.kind==='hydro';
          const isPop=popup?.key===key;
          const h=iSz/2;
          return <g key={key} opacity={0.95}>
            {col&&<circle cx={cx} cy={cy} r={h+4} fill={col} opacity={0.3}/>}
            <rect x={cx-h-3} y={cy-h-3} width={iSz+6} height={iSz+6} rx={2} fill="none"
              stroke={isPop?'#ff8c00':isHov?'#ffffff':col||'rgba(129,199,132,0.5)'}
              strokeWidth={isPop||isHov?2:1}/>
            <image href={ICON_ENERGY} x={cx-h} y={cy-h} width={iSz} height={iSz} style={{imageRendering:'pixelated'}}/>
            {camera.zoom>2.8&&<text x={cx} y={cy-h-5} textAnchor="middle" fill="#c9d1d9" fontSize={8} fontFamily="monospace">H{key}</text>}
          </g>;
        })}

        {/* Army markers */}
        {Object.entries(parsed.armies).map(([army,{x,y}])=>{
          const {cx,cy}=w2s(x,y);
          const idx=parseInt(army.replace('ARMY_',''))-1;
          const col=armyColors[idx%armyColors.length];
          return <g key={army}>
            <circle cx={cx} cy={cy} r={armR+3} fill={col} opacity={0.2}/>
            <circle cx={cx} cy={cy} r={armR+3} fill="none" stroke={col} strokeWidth={1.5} opacity={0.6}/>
            <image href={getAcuIcon(idx)} x={cx-armR} y={cy-armR} width={armR*2} height={armR*2}
              style={{imageRendering:'pixelated'}}/>
            <text x={cx} y={cy+armR+11} textAnchor="middle" fill={col}
              fontSize={Math.max(8,armR*0.6)} fontWeight="700" fontFamily="monospace">{army}</text>
          </g>;
        })}

        {/* Hover tooltip */}
        {hover&&!popup&&(()=>{
          const {cx,cy}=w2s(hover.x,hover.y);
          const a=assignments[hover.key];
          const label=hover.kind==='mass'?`Mass ${hover.key}`:`Hydro ${hover.key}`;
          const sub=a?(a.army||a.type||'assigned'):'click to assign';
          return <g>
            <rect x={cx+14} y={cy-26} width={152} height={36} rx={2} fill="#0a0a0a" stroke="rgba(255,140,0,0.3)" strokeWidth={1}/>
            <text x={cx+20} y={cy-11} fill="#e6edf3" fontSize={11} fontFamily="monospace">{label}</text>
            <text x={cx+20} y={cy+4}  fill="#888"    fontSize={9}  fontFamily="monospace">{sub}</text>
          </g>;
        })()}
      </svg>

      {/* Assignment popup */}
      {popup&&(
        <AssignPopup
          popup={popup}
          current={assignments[popup.key]}
          armyList={armyList}
          armyColors={armyColors}
          containerSize={size}
          onAssign={(type,army,group)=>{
            const asgn = army ? {type,army} : {type,group};
            onAssign(popup.key, asgn);
            if (popup.mirrorMode && army) {
              const mirrorKey = findMirror(popup.key, popup.kind);
              if (mirrorKey) onAssign(mirrorKey, asgn);
            }
            setPopup(null);
          }}
          onRemove={()=>{ onRemove(popup.key); setPopup(null); }}
          onClose={()=>setPopup(null)}
        />
      )}

      {/* Zoom controls */}
      <div className="amh-zoom-controls">
        {[{l:'+',fn:()=>setCamera(c=>({...c,zoom:Math.min(10,c.zoom*1.3)}))},
          {l:'⊙',fn:()=>setCamera({x:0,y:0,zoom:1})},
          {l:'−',fn:()=>setCamera(c=>({...c,zoom:Math.max(0.3,c.zoom*0.77)}))}
        ].map(({l,fn})=>(
          <button key={l} className="amh-zoom-item" onClick={e=>{e.stopPropagation();fn();}}>{l}</button>
        ))}
      </div>
      <div className="amh-controls-hint">Click → assign &nbsp;·&nbsp; Right-click → clear &nbsp;·&nbsp; Scroll → zoom &nbsp;·&nbsp; Mid/Right-drag → pan</div>
    </div>
  );
}

// ── Assignment Popup ─────────────────────────────────────────────────────────
function AssignPopup({ popup, current, armyList, armyColors, containerSize, onAssign, onRemove, onClose }) {
  useIconsReady();
  const spawnType = popup.kind === 'mass' ? 'spawnMex' : 'spawnHydro';
  const spawnableArmies = armyList.filter(a => a !== 'ARMY_17');

  const PW=220, PH=spawnableArmies.length*34+72;
  let left=popup.sx+18, top=popup.sy-16;
  if (left+PW>containerSize.w-8) left=popup.sx-PW-8;
  if (top+PH>containerSize.h-8) top=containerSize.h-PH-8;
  if (top<8) top=8;

  return (
    <div className="amh-assign-pop" style={{left,top,width:PW}} onClick={e=>e.stopPropagation()}>
      <div className="amh-assign-pop-header">
        <img src={popup.kind==='mass'?ICON_MASS:ICON_ENERGY} alt={popup.kind} className="amh-popup-hicon"/>
        <span className="amh-assign-pop-title">{popup.kind==='mass'?`Mass ${popup.key}`:`Hydro ${popup.key}`}</span>
        {popup.mirrorMode&&<span className="amh-assign-pop-mirror">⇌</span>}
        <button className="amh-popup-close" onClick={onClose}>×</button>
      </div>
      <div className="amh-assign-pop-body">
        <div className="amh-assign-pop-list">
          {spawnableArmies.map(army=>{
            const idx=parseInt(army.replace('ARMY_',''))-1;
            const col=armyColors[idx%armyColors.length];
            const active=current?.type===spawnType&&current?.army===army;
            return (
              <button key={army} className={`amh-assign-pop-btn${active?' active':''}`}
                style={{'--army-color':col}}
                onClick={()=>onAssign(spawnType,army,undefined)}>
                <img src={getAcuIcon(idx)} alt="" style={{width:14,height:14,imageRendering:'pixelated'}}/>
                <span style={{flex:1}}>{army}</span>
                {active&&<span style={{color:col}}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>
      {current&&(
        <button className="amh-popup-remove" onClick={onRemove}>✕ Remove</button>
      )}
    </div>
  );
}
