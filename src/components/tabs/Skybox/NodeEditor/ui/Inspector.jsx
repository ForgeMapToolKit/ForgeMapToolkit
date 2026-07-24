import React from 'react';
import { getNodeDef, nodeColor } from '../engine/registry.js';
import { ColorPicker } from '../../../../Shared/Ui/ColorPicker/ColorPicker.jsx';
import NumberField from './NumberField.jsx';

/**
 * Inspector — the parameter panel for the selected node.
 *
 * UI is generated from the node def's `params` schema (number → slider+field,
 * color → picker, bool → checkbox, select → dropdown, text → field). If the
 * node type ships a custom sub-editor (`def.editor`, e.g. GradientEditor), that
 * renders for its param instead. Every control writes back through
 * `onParams(id, patch)` — never any local editing state (parametric rule).
 */
export default function Inspector({ graph, selectedId, selectedCount = 0, onParams }) {
  if (!selectedId || !graph.nodes[selectedId]) {
    const msg = selectedCount > 1
      ? `${selectedCount} nodes selected — select just one to edit its parameters.`
      : 'Select a node to edit its parameters.';
    return <div className="ne-inspector ne-inspector-empty">{msg}</div>;
  }
  const node = graph.nodes[selectedId];
  const def = getNodeDef(node.type);
  const CustomEditor = def.editor;

  const set = (key, val) => onParams(selectedId, { [key]: val });

  return (
    <div className="ne-inspector">
      <div className="ne-inspector-head">
        <span className="ne-dot" style={{ background: nodeColor(def) }} />
        <span className="ne-inspector-title">{node.label || def.label}</span>
        <span className="ne-inspector-id">{selectedId}</span>
      </div>

      {Object.entries(def.params).map(([key, spec]) => {
        const val = node.params[key];

        // Custom sub-editor claims its param (matched by param type or an explicit flag).
        // It also gets the whole param bag + a patch setter, so an editor that
        // drives several params at once (e.g. reading three sky colours out of a
        // .scmap) doesn't need one host param per value.
        if (CustomEditor && (spec.type === 'stops' || spec.type === 'points' || spec.editorParam === true)) {
          return (
            <div key={key} className="ne-field">
              <label className="ne-field-label">{spec.label || key}</label>
              <CustomEditor
                value={val}
                onChange={v => set(key, v)}
                params={node.params}
                setParams={patch => onParams(selectedId, patch)}
              />
            </div>
          );
        }

        switch (spec.type) {
          case 'f':
            return (
              <div key={key} className="ne-field">
                <label className="ne-field-label">
                  {spec.label || key}
                  <span className="ne-field-val">{Number(val).toFixed(2)}</span>
                </label>
                <div className="ne-slider-row">
                  <input
                    type="range" min={spec.min ?? 0} max={spec.max ?? 1} step={spec.step ?? 0.01}
                    value={val} onChange={e => set(key, Number(e.target.value))}
                  />
                  <NumberField
                    min={spec.min} max={spec.max} step={spec.step ?? 0.01}
                    value={val} onChange={v => set(key, v)}
                  />
                </div>
              </div>
            );
          case 'i':
            return (
              <div key={key} className="ne-field">
                <label className="ne-field-label">{spec.label || key}</label>
                <NumberField step={1} value={val} onChange={v => set(key, Math.round(v))} />
              </div>
            );
          case 'b':
            return (
              <label key={key} className="ne-field ne-field-check">
                <input type="checkbox" checked={!!val} onChange={e => set(key, e.target.checked)} />
                {spec.label || key}
              </label>
            );
          case 'color':
            return (
              <div key={key} className="ne-field ne-field-color">
                <label className="ne-field-label">{spec.label || key}</label>
                <ColorPicker value={val} onChange={e => set(key, e.target.value)} />
              </div>
            );
          case 'select':
            return (
              <div key={key} className="ne-field">
                <label className="ne-field-label">{spec.label || key}</label>
                <select value={val} onChange={e => set(key, e.target.value)}>
                  {spec.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            );
          case 'text':
            return (
              <div key={key} className="ne-field">
                <label className="ne-field-label">{spec.label || key}</label>
                <input type="text" value={val} onChange={e => set(key, e.target.value)} />
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
