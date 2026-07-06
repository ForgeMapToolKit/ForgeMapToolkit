import React from 'react';
import '../../../Shared/trace.css';
import './Register.css';

/**
 * Register — the right projection stage of NavbarPanel.
 *
 * ── Layout (vertically centred content block) ────────────────────────────
 *
 *   [Luft oben]
 *   01 — EMITTER     ← Eyebrow: index + category name (small, recessive)
 *   WRECKAGES        ← sub-item name — large + dominant, NEVER the category
 *   ──────────       ← Traceline in --tab-color (accentColor prop)
 *   Description      ← begins around 50% of the block
 *   [Luft unten]
 *
 * ── Animation ────────────────────────────────────────────────────────────
 * On each sub-item hover, NavbarPanel bumps the `key` on this component,
 * causing a keyed remount. Each mount triggers the clip-path reveal
 * animation so the content "prints in" fresh on every hover.
 *
 * animate=false (instant panel switch): no entry animation.
 *
 * ── Props ────────────────────────────────────────────────────────────────
 *  index         string  — sub-item's two-digit designation, e.g. "01"
 *  categoryLabel string  — the panel/tab's category name (eyebrow only —
 *                           never shown as the dominant name)
 *  tabName       string  — the sub-item's own label — always dominant
 *  description   string  — sub-item navDescription or category defaultDesc
 *  accentColor   string  — CSS color string for the traceline (resolved --tab-color)
 *  animate       boolean — true = clip-path reveal animation, false = instant
 */

const Register = ({ index, categoryLabel, tabName, description, accentColor, animate = true }) => {
  return (
    <div
      className={[
        'reg-stage',
        animate ? 'reg-stage--animate' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="reg-block">

        {/* Eyebrow — index + category name. Category name lives ONLY here,
            never as the big title below. */}
        <div className="reg-index">
          <span className="reg-index-num">{index}</span>
          {categoryLabel && (
            <span className="reg-index-cat">{categoryLabel}</span>
          )}
        </div>

        {/* Sub-item name — large, dominant. Never the category name. */}
        <h2 className="reg-name">{tabName}</h2>

        {/* Traceline — bloom + core filament, the same pattern used by
            Banner/HomeScreen/Settings (see Shared/trace.css), parameterised
            on the active item's accent instead of --tab-color. */}
        <div
          className="reg-trace trace-filament"
          aria-hidden="true"
          style={{ '--reg-accent': accentColor }}
        >
          <span className="reg-trace-bloom" />
          <span className="reg-trace-core" />
        </div>

        {/* Description */}
        <p className="reg-desc">{description}</p>

      </div>
    </div>
  );
};

export default Register;
