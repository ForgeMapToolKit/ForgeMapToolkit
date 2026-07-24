import React, { useRef, useState, useCallback } from 'react';
import NumberField from './NumberField.jsx';

/**
 * AlphaRampEditor — sub-editor for the Alpha Ramp node's `stops` param.
 *
 * A 2D pad: X is position along the ramp axis, Y is the alpha at that
 * position (top = opaque, bottom = transparent) — dragging a stop answers
 * "where, how strong" in one gesture. Obeys the parametric rule: every drag
 * only ever writes `params.stops`, never local geometry state.
 *
 *   props: { value: Stop[], onChange: (Stop[]) => void }
 *   Stop = { pos: 0..1, alpha: 0..1 }
 */
export default function AlphaRampEditor({ value = [], onChange }) {
  const padRef = useRef(null);
  const [sel, setSel] = useState(0);
  const stops = value;

  const sorted = [...stops].map((s, i) => ({ ...s, _i: i })).sort((a, b) => a.pos - b.pos);
  const points = sorted.map(s => `${(s.pos * 100).toFixed(2)},${((1 - s.alpha) * 100).toFixed(2)}`).join(' ');

  const update = (i, patch) => {
    const next = stops.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onChange(next);
  };

  const fromEvent = (ev, rect) => ({
    pos: Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)),
    alpha: Math.max(0, Math.min(1, 1 - (ev.clientY - rect.top) / rect.height)),
  });

  const startDrag = useCallback((i) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSel(i);
    const pad = padRef.current;
    const move = (ev) => {
      const r = pad.getBoundingClientRect();
      update(i, fromEvent(ev, r));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [stops]); // eslint-disable-line react-hooks/exhaustive-deps

  const addStop = (e) => {
    const r = padRef.current.getBoundingClientRect();
    const { pos, alpha } = fromEvent(e, r);
    onChange([...stops, { pos, alpha }]);
    setSel(stops.length);
  };

  const onPadPointerDown = (e) => {
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
    <div className="ne-alpharamp-editor">
      <div ref={padRef} className="ne-alpharamp-pad" onPointerDown={onPadPointerDown} title="Middle-click to add a stop">
        <svg className="ne-alpharamp-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          {sorted.length > 1 && (
            <polygon className="ne-alpharamp-fill" points={`0,100 ${points} 100,100`} />
          )}
          {sorted.length > 1 && (
            <polyline className="ne-alpharamp-line" points={points} />
          )}
        </svg>
        {stops.map((s, i) => (
          <div
            key={i}
            className={`ne-alpharamp-stop${i === sel ? ' is-sel' : ''}`}
            style={{ left: `${s.pos * 100}%`, top: `${(1 - s.alpha) * 100}%` }}
            onPointerDown={startDrag(i)}
          />
        ))}
      </div>
      {current && (
        <div className="ne-gradient-controls">
          <label className="ne-field-inline">
            pos
            <NumberField
              min={0} max={1} step={0.01} value={current.pos}
              onChange={v => update(sel, { pos: Math.max(0, Math.min(1, v)) })}
            />
          </label>
          <label className="ne-field-inline">
            α
            <NumberField
              min={0} max={1} step={0.01} value={current.alpha}
              onChange={v => update(sel, { alpha: Math.max(0, Math.min(1, v)) })}
            />
          </label>
          <button className="ne-btn ne-btn-mini" onClick={() => removeStop(sel)} disabled={stops.length <= 2}>Remove</button>
        </div>
      )}
      <p className="ne-hint">Drag stops (X = position, Y = alpha) · middle-click pad to add</p>
    </div>
  );
}
