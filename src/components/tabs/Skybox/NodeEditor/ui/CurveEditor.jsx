import React, { useRef, useState, useCallback } from 'react';
import NumberField from './NumberField.jsx';

/**
 * CurveEditor — sub-editor for the Curves node's `points` param.
 *
 * A tone-curve pad: X is the input value, Y is the output (top = 1). Drag a
 * point to reshape; middle-click adds one; a point can't cross its neighbours
 * in X so the curve stays a function. Obeys the parametric rule — every drag
 * only writes `params.points`.
 *
 *   props: { value: Point[], onChange: (Point[]) => void }
 *   Point = { x: 0..1, y: 0..1 }
 */
export default function CurveEditor({ value = [], onChange }) {
  const padRef = useRef(null);
  const [sel, setSel] = useState(0);
  const points = value;

  const sorted = [...points].map((p, i) => ({ ...p, _i: i })).sort((a, b) => a.x - b.x);
  const poly = sorted.map(p => `${(p.x * 100).toFixed(2)},${((1 - p.y) * 100).toFixed(2)}`).join(' ');

  const commit = (next) => onChange(next);

  const fromEvent = (ev, rect) => ({
    x: Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, 1 - (ev.clientY - rect.top) / rect.height)),
  });

  const startDrag = useCallback((i) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSel(i);
    const pad = padRef.current;
    const move = (ev) => {
      const r = pad.getBoundingClientRect();
      commit(points.map((p, idx) => (idx === i ? { ...p, ...fromEvent(ev, r) } : p)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [points]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPadPointerDown = (e) => {
    if (e.button !== 1) return; // middle-click adds a point
    e.preventDefault();
    const r = padRef.current.getBoundingClientRect();
    const p = fromEvent(e, r);
    onChange([...points, p]);
    setSel(points.length);
  };

  const removePoint = (i) => {
    if (points.length <= 2) return;
    onChange(points.filter((_, idx) => idx !== i));
    setSel(0);
  };

  const current = points[sel] || points[0];

  return (
    <div className="ne-curve-editor">
      <div ref={padRef} className="ne-curve-pad" onPointerDown={onPadPointerDown} title="Middle-click to add a point">
        <svg className="ne-curve-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line className="ne-curve-diag" x1="0" y1="100" x2="100" y2="0" />
          {sorted.length > 1 && <polyline className="ne-curve-line" points={poly} />}
        </svg>
        {points.map((p, i) => (
          <div
            key={i}
            className={`ne-curve-pt${i === sel ? ' is-sel' : ''}`}
            style={{ left: `${p.x * 100}%`, top: `${(1 - p.y) * 100}%` }}
            onPointerDown={startDrag(i)}
          />
        ))}
      </div>
      {current && (
        <div className="ne-gradient-controls">
          <label className="ne-field-inline">
            in
            <NumberField
              min={0} max={1} step={0.01} value={current.x}
              onChange={v => commit(points.map((p, idx) => (idx === sel ? { ...p, x: Math.max(0, Math.min(1, v)) } : p)))}
            />
          </label>
          <label className="ne-field-inline">
            out
            <NumberField
              min={0} max={1} step={0.01} value={current.y}
              onChange={v => commit(points.map((p, idx) => (idx === sel ? { ...p, y: Math.max(0, Math.min(1, v)) } : p)))}
            />
          </label>
          <button className="ctrl-btn-add" onClick={() => removePoint(sel)} disabled={points.length <= 2}>Remove</button>
        </div>
      )}
      <p className="ne-hint">Drag points (X = in, Y = out) · middle-click pad to add</p>
    </div>
  );
}
