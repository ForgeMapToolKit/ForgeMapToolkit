import React, { useState, useRef, useEffect } from 'react';

/**
 * NumberField — a numeric input you can actually clear while editing.
 *
 * A plain `<input type=number value={n} onChange={Number(...)}>` snaps an empty
 * field back to 0 the instant you delete the last digit, which makes editing a
 * value miserable. This keeps a local draft string: you can empty it, type a
 * leading "-" or ".", etc. Valid numbers commit live via onChange; an empty or
 * half-typed draft simply doesn't commit, and blur restores the last good value
 * if you left it unfinished. While unfocused it mirrors the external value, so
 * slider/drag updates flow in normally.
 *
 * Always carries `.ctrl-input` (the design system's T2-baseline field). That is
 * baked in rather than left to each caller because it was left to each caller:
 * the inline pos/alpha/x/y fields in the sub-editors silently rendered as raw
 * native number boxes for exactly that reason. `className` appends to it.
 *
 *   props: { value:number, onChange:(n:number)=>void, min?, max?, step?, className?, ... }
 */
export default function NumberField({ value, onChange, min, max, step, className = '', ...rest }) {
  const [draft, setDraft] = useState(() => String(value ?? ''));
  const focused = useRef(false);

  // Mirror external changes only while the user isn't mid-edit.
  useEffect(() => {
    if (!focused.current) setDraft(String(value ?? ''));
  }, [value]);

  return (
    <input
      {...rest}
      type="number"
      className={`ctrl-input ${className}`.trim()}
      min={min} max={max} step={step}
      value={draft}
      onFocus={() => { focused.current = true; }}
      onBlur={() => {
        focused.current = false;
        const n = Number(draft);
        if (draft === '' || !Number.isFinite(n)) setDraft(String(value ?? ''));
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw === '') return;             // allow an empty field mid-edit
        const n = Number(raw);
        if (Number.isFinite(n)) onChange(n); // commit only real numbers
      }}
    />
  );
}
