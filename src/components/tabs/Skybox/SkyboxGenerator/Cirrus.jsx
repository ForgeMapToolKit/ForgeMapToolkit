/**
 * SkyboxGenerator_Cirrus.jsx — Sektion 02: Cirrus
 *
 * Rein präsentational. `CirrusLayerDiagram` wird exportiert und im
 * Cirrus-Section-Aside gerendert (siehe SkyboxGenerator.jsx), nicht mehr
 * hier in der Hauptspalte.
 */
import React from 'react';
import { EntityCardGrid, EntityCard, AddTile } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import { ColorPicker } from './Configuration.jsx';
import { PLANET_UV_COLORS } from './utils.js';

// ── CirrusLayerDiagram ─────────────────────────────────────────────
export const CirrusLayerDiagram = ({ layers, cirrusMult }) => {
  if (!layers.length) return null;
  const freqBar = (f) => {
    const v = parseFloat(f) || 0.0001;
    const t = Math.max(0, Math.min(1, (Math.log10(v) - Math.log10(0.00005)) / (Math.log10(0.01) - Math.log10(0.00005))));
    return Math.round(8 + t * 80);
  };
  const S = {
    label: { fontSize:'0.6rem', letterSpacing:'0.07em', textTransform:'uppercase', color:'rgba(255,255,255,0.28)' },
    mono:  { fontFamily:'monospace' },
  };

  return (
    <div>
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
          <div key={layer.id} className="sb-cirrus-layer-box" style={{ '--layer-color': col, borderLeftColor: col }}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:'7px',marginBottom:'8px'}}>
                <span style={{color:col,fontWeight:700,fontSize:'0.78rem',fontFamily:'monospace'}}>L{i+1}</span>
                <span className="ctrl-label">channel {['R','G','B','A'][i] ?? i+1}</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'4px'}}>
                <span style={{...S.label,width:'40px'}}>freq X</span>
                <div style={{width:`${bx}px`,height:'4px',background:col,opacity:0.75,borderRadius:'2px',flexShrink:0}}/>
                <span style={{fontSize:'0.65rem',...S.mono,color:'rgba(255,255,255,0.55)'}}>{fx.toExponential(3)}</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'7px'}}>
                <span style={{...S.label,width:'40px'}}>freq Y</span>
                <div style={{width:`${by}px`,height:'4px',background:col,opacity:0.75,borderRadius:'2px',flexShrink:0}}/>
                <span style={{fontSize:'0.65rem',...S.mono,color:'rgba(255,255,255,0.55)'}}>{fy.toExponential(3)}</span>
              </div>
              <div style={{display:'flex',gap:'16px'}}>
                <div>
                  <span style={{...S.label}}>speed</span>
                  <span style={{fontSize:'0.68rem',...S.mono,color:`rgba(255,255,255,${Math.round(0.3+Math.min(Math.abs(speed)/10,1)*0.7*10)/10})`,display:'block',marginTop:'1px'}}>{speed}</span>
                </div>
                <div>
                  <span style={{...S.label}}>direction</span>
                  <span style={{fontSize:'0.68rem',...S.mono,color:'rgba(255,255,255,0.55)',display:'block',marginTop:'1px'}}>{ndx.toFixed(2)}, {ndz.toFixed(2)}</span>
                </div>
              </div>
            </div>
            {/* Direction arrow */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'52px'}}>
              <svg width="40" height="40" viewBox="-1 -1 2 2">
                <circle cx="0" cy="0" r="0.9" fill="none" stroke={`${col}40`} strokeWidth="0.08"/>
                <line x1="0" y1="0" x2={ndx*0.75} y2={-ndz*0.75} stroke={col} strokeWidth="0.12" strokeLinecap="round"/>
                <circle cx={ndx*0.75} cy={-ndz*0.75} r="0.12" fill={col}/>
                <circle cx="0" cy="0" r="0.07" fill={`${col}88`}/>
              </svg>
            </div>
          </div>
        );
      })}

      {/* Masking chain */}
      {layers.length > 1 && (
        <div style={{marginTop:'10px',padding:'9px 12px',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',fontSize:'0.65rem',lineHeight:'1.9'}}>
          <div style={{color:'rgba(255,255,255,0.35)',fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',fontSize:'0.6rem',marginBottom:'4px'}}>Masking Chain</div>
          {layers.map((_, i) => (
            <React.Fragment key={i}>
              <span style={{color:PLANET_UV_COLORS[i%PLANET_UV_COLORS.length],fontWeight:700,fontFamily:'monospace'}}>L{i+1}</span>
              {i < layers.length-1 && <span style={{color:'rgba(255,255,255,0.22)',margin:'0 4px'}}>×</span>}
            </React.Fragment>
          ))}
          <span style={{color:'rgba(255,255,255,0.22)',margin:'0 4px'}}>×</span>
          <span style={{color:'var(--skybox-generator-color)',fontFamily:'monospace'}}>{parseFloat(cirrusMult)||1.8}</span>
          <span style={{color:'rgba(255,255,255,0.35)',marginLeft:'6px',fontSize:'0.6rem'}}>→ cloud opacity</span>
        </div>
      )}
    </div>
  );
};

// ── Haupt-Sektions-Komponente ─────────────────────────────────────
const Cirrus = ({
  cirrusMult, setCirrusMult,
  cirrusColor, setCirrusColor,
  cirrusTexture, setCirrusTexture,
  cirrusLayers,
  onAddCirrus, onRemoveCirrus, onUpdateCirrus,
  activePresetId,
  customPresets,
  showSavePreset, setShowSavePreset,
  newPresetName, setNewPresetName,
  importText, setImportText,
  importError, setImportError,
  importDragOver, setImportDragOver,
  onApplyPreset, onSaveCustomPreset, onDeleteCustomPreset,
  parseCirrusFromText,
  CIRRUS_BUILTIN_PRESETS,
}) => {
  return (
    <div className="ctrl-col">

      {/* Settings (presets are shortcuts for the fields below, not a separate feature) */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Settings</div>
        <div className="ctrl-content">
          <div className="sb-cirrus-preset-grid">
            {CIRRUS_BUILTIN_PRESETS.map(preset => (
              <button
                key={preset.id}
                className={`sb-cirrus-preset-btn${activePresetId === preset.id ? ' active' : ''}`}
                onClick={() => onApplyPreset(preset)}
              >
                {preset.label}
              </button>
            ))}
            {customPresets.map(preset => (
              <div key={preset.id} className="sb-cirrus-preset-custom-row">
                <button
                  className={`sb-cirrus-preset-btn custom${activePresetId === preset.id ? ' active' : ''}`}
                  onClick={() => onApplyPreset(preset)}
                >
                  ★ {preset.label}
                </button>
                <button className="ctrl-btn-delete" onClick={() => onDeleteCustomPreset(preset.id)}>×</button>
              </div>
            ))}
          </div>

          <div className="sb-cfg-row">
            <div className="ctrl-field">
              <div className="ctrl-label">Cirrus Multiplier</div>
              <input className="ctrl-input" value={cirrusMult} onChange={e=>setCirrusMult(e.target.value)} placeholder="1.8"/>
            </div>
            <div className="ctrl-field">
              <div className="ctrl-label">Cirrus Color</div>
              <ColorPicker value={cirrusColor} onChange={e=>setCirrusColor(e.target.value)}/>
            </div>
          </div>
          <div className="ctrl-field">
            <div className="ctrl-label">Cirrus Texture</div>
            <input className="ctrl-input ctrl-input--text" value={cirrusTexture} onChange={e=>setCirrusTexture(e.target.value)}/>
          </div>
        </div>
      </div>

      {/* Layers */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Layers ({cirrusLayers.length})</div>
        <div className="ctrl-content">
          <EntityCardGrid>
            {cirrusLayers.map((layer, i) => (
              <EntityCard
                key={layer.id}
                index={i}
                color={PLANET_UV_COLORS[i % PLANET_UV_COLORS.length]}
                title={`L${i + 1}`}
                onDelete={() => onRemoveCirrus(layer.id)}
              >
                <div onClick={(e) => e.stopPropagation()}>
                  <div className="sb-cfg-row sb-cfg-row--3">
                    <div className="ctrl-field">
                      <div className="ctrl-label">Freq X</div>
                      <input className="ctrl-input" value={layer.freqX}
                        onChange={e=>onUpdateCirrus(layer.id,'freqX',e.target.value)}/>
                    </div>
                    <div className="ctrl-field">
                      <div className="ctrl-label">Freq Y</div>
                      <input className="ctrl-input" value={layer.freqY}
                        onChange={e=>onUpdateCirrus(layer.id,'freqY',e.target.value)}/>
                    </div>
                    <div className="ctrl-field">
                      <div className="ctrl-label">Speed</div>
                      <input className="ctrl-input" value={layer.speed}
                        onChange={e=>onUpdateCirrus(layer.id,'speed',e.target.value)}/>
                    </div>
                  </div>
                  <div className="sb-cfg-row">
                    <div className="ctrl-field">
                      <div className="ctrl-label">Dir X</div>
                      <input className="ctrl-input" value={layer.dirX}
                        onChange={e=>onUpdateCirrus(layer.id,'dirX',e.target.value)}/>
                    </div>
                    <div className="ctrl-field">
                      <div className="ctrl-label">Dir Y</div>
                      <input className="ctrl-input" value={layer.dirY}
                        onChange={e=>onUpdateCirrus(layer.id,'dirY',e.target.value)}/>
                    </div>
                  </div>
                </div>
              </EntityCard>
            ))}
            {cirrusLayers.length < 4 && (
              <AddTile label="Add Layer" onClick={onAddCirrus} />
            )}
          </EntityCardGrid>
        </div>
      </div>

      {/* Save custom preset — captures Settings + the Layers above */}
      <div className="ctrl-block">
        <div className="ctrl-content">
          <div className="ctrl-action-row">
            <button className="ctrl-btn-add" onClick={() => setShowSavePreset(v=>!v)}>
              {showSavePreset ? '▲ Cancel' : '+ Save Current as Preset'}
            </button>
          </div>
          {showSavePreset && (
            <div className="sb-cirrus-save-preset-panel">
              <div className="ctrl-field">
                <div className="ctrl-label">Preset Name</div>
                <input className="ctrl-input ctrl-input--text" value={newPresetName}
                  onChange={e=>setNewPresetName(e.target.value)}
                  placeholder="My Preset" onKeyDown={e=>e.key==='Enter'&&onSaveCustomPreset()}/>
              </div>
              <div className="ctrl-field">
                <div className="ctrl-label">Import from JSON / Lua (optional)</div>
                <textarea className="ctrl-input ctrl-input--text sb-textarea" rows={4} value={importText}
                  onChange={e=>{setImportText(e.target.value);setImportError('');}}
                  onDragOver={e=>{e.preventDefault();setImportDragOver(true);}}
                  onDragLeave={()=>setImportDragOver(false)}
                  onDrop={e=>{
                    e.preventDefault();setImportDragOver(false);
                    const text=e.dataTransfer.getData('text');
                    if(text){setImportText(text);const res=parseCirrusFromText(text);if(!res)setImportError('Could not parse.');}
                  }}
                  style={{outline:importDragOver?'1px solid var(--skybox-generator-color)':'none'}}
                  placeholder="Paste skybox JSON or Lua here…"/>
                {importError && <p className="sb-field-help" style={{color:'rgba(255,80,80,0.9)'}}>{importError}</p>}
              </div>
              <button className="ctrl-btn-add" onClick={onSaveCustomPreset} disabled={!newPresetName.trim()}>
                Save Preset
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Cirrus;
