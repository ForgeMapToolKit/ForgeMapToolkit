import React from 'react';
import { Dropdown } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

/**
 * Small presentational field set shared by this tab's three sections.
 *
 * The design system has no slider primitive yet, so `Slider` styles itself via
 * `.wn-slider` in WaveNormals.css — tokens only, no literals. If a second tab
 * ever needs one, this is the piece to promote into primitives.css.
 */

// Field-level explanatory `hint` text lives in the Help modal, not inline — the
// `hint` prop is still accepted at call sites but intentionally not rendered.
export const Field = ({ label, children, wide = false }) => (
  <div className={`ctrl-field${wide ? ' wn-field--wide' : ''}`}>
    {label && <label className="ctrl-label">{label}</label>}
    {children}
  </div>
);

export const Slider = ({
  label, value, onChange, min, max, step = 0.01, unit = '', format, disabled,
}) => (
  <div className={`ctrl-field wn-slider-field${disabled ? ' is-disabled' : ''}`}>
    <div className="wn-slider-head">
      <label className="ctrl-label">{label}</label>
      <span className="wn-slider-value">
        {format ? format(value) : Number(value).toFixed(step < 1 ? 2 : 0)}{unit}
      </span>
    </div>
    <input
      type="range"
      className="wn-slider"
      min={min} max={max} step={step}
      value={value}
      disabled={disabled}
      onChange={e => onChange(Number(e.target.value))}
    />
  </div>
);

export const Select = ({ label, value, onChange, options }) => (
  <Field label={label}>
    <Dropdown
      options={options.map(o => ({ value: o.id ?? o.value, label: o.label }))}
      value={value}
      onChange={onChange}
      ariaLabel={label}
    />
  </Field>
);

export const Toggle = ({ label, value, onChange }) => (
  <div className="ctrl-field">
    <div
      className={`ctrl-toggle-row${value ? ' on' : ''}`}
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      tabIndex={0}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(!value); } }}
    >
      <span className="ctrl-toggle"><span className="ctrl-toggle-pole" /></span>
      <span>{label}</span>
    </div>
  </div>
);

/** Radio-style option list — the design system's `.ctrl-option` family. */
export const Options = ({ value, onChange, options }) => (
  <div className="ctrl-option-group">
    {options.map(o => (
      <button
        key={o.id}
        className={`ctrl-option${value === o.id ? ' active' : ''}`}
        onClick={() => onChange(o.id)}
        type="button"
      >
        <span className="ctrl-option-label">{o.label}</span>
        {o.hint && <span className="ctrl-option-desc">{o.hint}</span>}
      </button>
    ))}
  </div>
);

/** Monospace key/value readout — used for measured values, never for input. */
export const Readout = ({ rows }) => (
  <div className="wn-readout">
    {rows.map(([k, v, tone]) => (
      <div className="wn-readout-row" key={k}>
        <span className="wn-readout-key">{k}</span>
        <span className={`wn-readout-val${tone ? ` is-${tone}` : ''}`}>{v}</span>
      </div>
    ))}
  </div>
);
