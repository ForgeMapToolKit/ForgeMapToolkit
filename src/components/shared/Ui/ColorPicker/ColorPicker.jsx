import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { hexToHsv, hsvToHex } from './colorMath.js';
import './ColorPicker.css';

/**
 * ColorPicker — the suite's one glassmorphic colour instrument.
 *
 * Originally built for SkyboxGenerator (`sb-cp-*` there); lives here so any
 * tab gets the same trigger-swatch + portaled SV/hue/hex/RGB popup instead of
 * a bare native `<input type="color">`. The popup is portaled to
 * `document.body` (it must escape any `overflow:hidden` ancestor), so it
 * can't inherit `--tab-color`/`--tab-glow`/`--tab-glow-strong` through the
 * cascade — the trigger's computed style is read and forwarded explicitly.
 *
 * `onChange` fires with the same `{ target: { value } }` shape a native
 * `<input type="color">` would, so it's a drop-in replacement anywhere that
 * already wires up a change handler that way.
 *
 * `presets` is optional — pass a hex-string array for a tab-specific swatch
 * row (e.g. SkyboxGenerator's sky/water palette); omit it to skip that
 * section entirely rather than showing another tab's colours.
 */
export const ColorPicker = ({ value, onChange, presets = [] }) => {
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
    // The popup is portaled to document.body, outside whatever tab subtree
    // defines --tab-color — forward the resolved values so the accent
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
    <div className="cp-swatch-wrap" ref={swatchRef}>
      <button
        type="button"
        className={`cp-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title={safeValue}
      >
        <span className="cp-trigger-swatch" style={{ background: safeValue }}/>
        <span className="cp-trigger-hex">{safeValue.toUpperCase()}</span>
      </button>
      {open && ReactDOM.createPortal(
        <div ref={popupRef} className="cp-popup"
          style={{
            position:'fixed', top: pos.top, left: pos.left, zIndex: 99999,
            '--tab-color': pos.tabColor, '--tab-glow': pos.tabGlow, '--tab-glow-strong': pos.tabGlowStrong,
          }}>
          {/* Landscape layout: SV+hue column on the left, fields stacked to
              the right — wide, not tall. */}
          <div className="cp-popup-top">
            <div className="cp-sv-col">
              {/* SV field — machined bezel, same recessed-slot language as .ctrl-toggle */}
              <div className="cp-sv-frame">
                <div ref={svRef} className="cp-sv"
                  style={{ background: `hsl(${h},100%,50%)` }}
                  onClick={onSVClick}>
                  <div className="cp-sv-white"/>
                  <div className="cp-sv-black"/>
                  <div className="cp-sv-cursor"
                    style={{ left:`${s*100}%`, top:`${(1-v)*100}%`, background: safeValue }}/>
                </div>
              </div>
              {/* Hue — recessed track, travelling pole (same mechanic as .ctrl-toggle-pole) */}
              <div className="cp-hue-frame">
                <div ref={hueRef} className="cp-hue" onClick={onHueClick}>
                  <div className="cp-hue-cursor" style={{ left:`${(h/360)*100}%` }}/>
                </div>
              </div>
            </div>
            {/* Fields — the same never-boxed baseline as every other ctrl-input in the app */}
            <div className="cp-fields-col">
              <div className="ctrl-field">
                <div className="ctrl-label">Hex</div>
                <div className="cp-input-hex-wrap">
                  <span className="cp-input-hash">#</span>
                  <input className="ctrl-input cp-input--hex"
                    value={editingHex ? hexEdit : safeValue.slice(1).toUpperCase()}
                    onFocus={() => { setEditingHex(true); setHexEdit(safeValue.slice(1).toUpperCase()); }}
                    onChange={e => setHexEdit(e.target.value)}
                    onBlur={() => { setEditingHex(false); const h2='#'+hexEdit; if(isValidHex(h2)) onChange({target:{value:h2}}); }}
                    onKeyDown={e => { if(e.key==='Enter'){setEditingHex(false);const h2='#'+hexEdit;if(isValidHex(h2))onChange({target:{value:h2}});} }}
                    maxLength={6} spellCheck={false}/>
                </div>
              </div>
              <div className="cp-rgb-row">
                {[['R',r],['G',g],['B',b]].map(([ch,chVal]) => (
                  <div key={ch} className="ctrl-field">
                    <div className="ctrl-label">{ch}</div>
                    <input className="ctrl-input cp-input--num"
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
          {presets.length > 0 && (
            <>
              <div className="ctrl-label cp-presets-label">Presets</div>
              <div className="cp-presets">
                {presets.map(c => (
                  <div key={c} className="cp-preset" style={{background:c}}
                    onClick={() => onChange({target:{value:c}})}/>
                ))}
              </div>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};

export default ColorPicker;
