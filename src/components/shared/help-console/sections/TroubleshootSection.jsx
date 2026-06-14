/**
 * TroubleshootSection — FAQ / common issues list.
 *
 * Each item has a question (title) and an answer (body).
 * Items are always expanded; separated by hairlines in --tab-color.
 *
 * Props:
 *   label?  string       eyebrow label
 *   items   Item[]
 *
 * Item shape:
 *   { q: string, a: string | ReactNode }
 *
 * Usage:
 *   <TroubleshootSection
 *     label="Common Issues"
 *     items={[
 *       { q: 'Nothing generates', a: 'Check that at least one unit is configured.' },
 *       { q: 'Wrong output path', a: <>Navigate to <code>Settings → Paths</code>.</> },
 *     ]}
 *   />
 */

import React from 'react';
import './sections.css';

export default function TroubleshootSection({ label, items = [] }) {
  return (
    <div className="hs-section hs-ts">
      {label && <div className="hs-section-label">{label}</div>}
      {items.map((item, i) => (
        <div key={i} className="hs-ts__item">
          <div className="hs-ts__q">{item.q}</div>
          <div className="hs-ts__a">
            {typeof item.a === 'string' ? <p>{item.a}</p> : item.a}
          </div>
        </div>
      ))}
    </div>
  );
}
