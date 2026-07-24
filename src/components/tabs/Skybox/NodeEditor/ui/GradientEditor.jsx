import React, { useRef, useState, useCallback } from 'react';
import { ColorPicker } from '../../../../Shared/Ui/ColorPicker/ColorPicker.jsx';
import NumberField from './NumberField.jsx';

/**
 * GradientEditor — sub-editor for the Gradient node's `stops` param.
 *
 * A visual stop editor that obeys the parametric rule: dragging a handle only
 * ever writes `params.stops`. No internal geometry state beyond which stop is
 * selected — the stops array in the document is the truth.
 *
 *   props: { value: Stop[], onChange: (Stop[]) => void }
 *   Stop = { pos: 0..1, color: '#rrggbb' }   // Gradient is pure colour (alpha=1);
 *                                            // opacity is the Alpha Ramp node's job.
 */
export default function GradientEditor({ value = [], onChange }) {
  const barRef = useRef(null);
  const [sel, setSel] = useState(0);
  const stops = value;

  const sorted = [...stops].map((s, i) => ({ ...s, _i: i })).sort((a, b) => a.pos - b.pos);
  const css = sorted.length
    ? `linear-gradient(90deg, ${sorted.map(s => `${s.color} ${(s.pos * 100).toFixed(1)}%`).join(', ')})`
    : '#000';

  const update = (i, patch) => {
    const next = stops.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onChange(next);
  };

  const startDrag = useCallback((i) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSel(i);
    const bar = barRef.current;
    const move = (ev) => {
      const r = bar.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      update(i, { pos });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [stops]); // eslint-disable-line react-hooks/exhaustive-deps

  const addStop = (e) => {
    const r = barRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const nearest = sorted.reduce((a, b) => (Math.abs(b.pos - pos) < Math.abs(a.pos - pos) ? b : a), sorted[0]);
    onChange([...stops, { pos, color: nearest?.color || '#ffffff' }]);
    setSel(stops.length);
  };

  const onBarPointerDown = (e) => {
    if (e.button !== 1) return; // middle-click adds a stop; left-click drags an existing one
    e.preventDefault();
    addStop(e);
  };

  const removeStop = (i) => {
    if (stops.length <= 2) return;
    onChange(stops.filter((_, idx) => idx !== i));
    setSel(0);
  };

  const current = stops[sel] || stops[0];

  return (
    <div className="ne-gradient-editor">
      <div ref={barRef} className="ne-gradient-bar" style={{ background: css }} onPointerDown={onBarPointerDown} title="Middle-click to add a stop">
        {stops.map((s, i) => (
          <div
            key={i}
            className={`ne-gradient-stop${i === sel ? ' is-sel' : ''}`}
            style={{ left: `${s.pos * 100}%`, background: s.color }}
            onPointerDown={startDrag(i)}
          />
        ))}
      </div>
      {current && (
        <>
          <ColorPicker
            value={current.color}
            onChange={e => update(sel, { color: e.target.value })}
          />
          <div className="ne-gradient-controls">
            <label className="ne-field-inline">
              pos
              <NumberField
                min={0} max={1} step={0.01} value={current.pos}
                onChange={v => update(sel, { pos: Math.max(0, Math.min(1, v)) })}
              />
            </label>
            <button className="ne-btn ne-btn-mini" onClick={() => removeStop(sel)} disabled={stops.length <= 2}>Remove</button>
          </div>
        </>
      )}
      <p className="ne-hint">Drag stops · middle-click bar to add</p>
    </div>
  );
}
