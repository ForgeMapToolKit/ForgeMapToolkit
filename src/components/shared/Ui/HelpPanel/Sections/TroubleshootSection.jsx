/**
 * TroubleshootSection — fault register.
 *
 * A diagnostic list of common issues. Each entry pairs a mono code with a
 * symptom (the question) and a resolution (the answer). Boxless, tokens
 * only; the accent is the inherited --tab-color. It renders as a normal
 * .hs-section block, so it stacks freely with other sections (Code,
 * Media, …) inside a single tab's help content.
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
 *     label="Common Errors"
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
      {label && <div className="title-section">{label}</div>}
      {items.map((item, i) => (
        <div key={i} className="hs-ts__item" style={{ '--i': i }}>
          <div className="hs-ts__gutter">
            <span className="hs-ts__code">
              Fault {String(i + 1).padStart(2, '0')}
            </span>
          </div>
          <div className="hs-ts__body">
            <div className="hs-ts__sym">{item.q}</div>
            <div className="hs-ts__res">
              <span className="hs-ts__res-label">Resolution →</span>
              <div className="hs-ts__res-text">
                {typeof item.a === 'string' ? <p>{item.a}</p> : item.a}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
