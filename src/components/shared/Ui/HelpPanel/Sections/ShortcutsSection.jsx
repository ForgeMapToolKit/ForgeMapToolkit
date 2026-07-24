/**
 * ShortcutsSection — keyboard / interaction cheat-sheet.
 *
 * A boxless two-column register of actions and their key(s). Keys render
 * as <kbd> caps; multi-key combos are passed as an array. Pure tokens;
 * the only accent is the inherited --tab-color on the hairlines.
 *
 * Props:
 *   label?  string        eyebrow label
 *   items   Item[]
 *
 * Item shape:
 *   { action: string, keys: string | string[] }
 *
 * Usage:
 *   <ShortcutsSection
 *     label="Shortcuts"
 *     items={[
 *       { action: 'Place coordinate', keys: 'Click' },
 *       { action: 'Generate files',   keys: ['Ctrl', 'G'] },
 *     ]}
 *   />
 */

import React from 'react';
import './sections.css';

export default function ShortcutsSection({ label, items = [] }) {
  return (
    <div className="hs-section">
      {label && <div className="title-section">{label}</div>}
      <div className="cp-shortcuts">
        {items.map((it, i) => {
          const keys = Array.isArray(it.keys) ? it.keys : [it.keys];
          return (
            <div className="cp-shortcuts__row" key={i}>
              <span className="cp-shortcuts__action">{it.action}</span>
              <span className="cp-shortcuts__combo">
                {keys.map((k, j) => (
                  <kbd className="cp-kbd" key={j}>{k}</kbd>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
