import React from 'react';
import { getTool } from '../home/data/toolRegistry.js';
import './Banner.css';

const FOOTER_PREFIX = 'footer:';

/**
 * Banner — the monumental identity register of the suite.
 *
 * The same machine as the TRACE home screen, one register up: a dark
 * instrument surface (#070708, dot grid, grain) carrying the suite's
 * designation in monumental type. Composed like the projection stage —
 * eyebrow, designation, trace filament, data line — and aligned to the
 * same 72px content column, so banner and stage read as one plate.
 *
 * Boot (once, at launch): the designation prints behind a carriage
 * pass, the trace sweeps white-hot and cools into the accent, the data
 * line follows one beat later. Afterwards: total stillness.
 *
 * Theme: the trace filament and the logo's aura carry the active
 * tool's hue; the type itself stays white — color belongs to the
 * filament and the register, never the letterforms (except MAP, the
 * single accent word of the wordmark).
 *
 * Right: the active tool's designation (index + label) prints in its
 * hue when a tool engages (keyed remount per tool). On the home screen
 * the register idles dark.
 *
 * Props:
 *  - activeSection:  current tool id or null (home)
 *  - previewSection: tool id being hovered on the home screen (null otherwise).
 *                    Drives the accent/glow so the banner previews the hovered
 *                    tool's hue while idling on the homepage. The printed
 *                    register label stays tied to the *active* tool only.
 *  - lastRealTool:   the last toolRegistry entry that was actually active,
 *                     computed once in ForgeMapToolkit.jsx and shared with
 *                     Footer and FooterArticleTab. Used as the fallback while
 *                     a footer:<slug> article is open, so the banner keeps
 *                     that tool's identity instead of idling to the default.
 */
const Banner = ({ activeSection, previewSection = null, lastRealTool = null }) => {
  const isFooterArticle = typeof activeSection === 'string' && activeSection.startsWith(FOOTER_PREFIX);

  const tool = getTool(activeSection);

  // Footer articles ("footer:<slug>") have no toolRegistry entry by design,
  // so getTool() returns null while one is open and the banner would idle
  // back to its dark/default-orange home state. lastRealTool (passed down
  // from ForgeMapToolkit.jsx) carries the last real tool forward instead.
  const effectiveTool = tool ?? (isFooterArticle ? lastRealTool : null);

  const themeTool = effectiveTool ?? getTool(previewSection);

  const accent     = themeTool?.color      ?? 'var(--accent-primary, #ff8c00)';
  const glow       = themeTool?.glow       ?? 'var(--accent-glow, rgba(255,140,0,0.12))';
  const glowStrong = themeTool?.glowStrong ?? 'var(--accent-glow-strong, rgba(255,140,0,0.7))';

  return (
    <header
      className="bnr-root"
      style={{
        '--current-accent':      accent,
        '--current-glow':        glow,
        '--current-glow-strong': glowStrong,
      }}
    >
      {/* Content column — same 72px register as the projection stage */}
      <div className="bnr-stage">

        {/* Eyebrow — mono index line, prints first */}
        <div className="bnr-eyebrow">
          FORGED ALLIANCE FOREVER&nbsp;&nbsp;·&nbsp;&nbsp;INSTRUMENT SUITE
        </div>

        {/* Monumental designation — printed by the carriage pass */}
        <h1 className="bnr-designation">
          <span className="bnr-wm-forge">FORGE</span>
          <span className="bnr-wm-map">MAP</span>
          <span className="bnr-wm-toolkit">TOOLKIT</span>
        </h1>

        {/* The trace — the filament signature, carries the active hue */}
        <div className="bnr-trace" aria-hidden="true">
          <div className="bnr-trace-bloom" />
          <div className="bnr-trace-line" />
          <div className="bnr-trace-hot" />
        </div>

        {/* Data line — caption left, active-tool register right */}
        <div className="bnr-meta">
          <span className="bnr-caption">PROFESSIONAL MAP CREATION TOOLKIT</span>
          {effectiveTool && (
            <span className="bnr-register" key={effectiveTool.id}>
              <span className="bnr-reg-index">{effectiveTool.index}&nbsp;/</span>
              <span className="bnr-reg-label">{effectiveTool.label.toUpperCase()}</span>
            </span>
          )}
        </div>

      </div>

      {/* The mark — standing in the right field like a seal, lit by
          the active hue */}
      <div className="bnr-mark" aria-hidden="true">
        <div className="bnr-mark-aura" />
        <img
          className="bnr-logo"
          src="/assets/icons/App/icon.png"
          alt=""
          draggable="false"
        />
      </div>

      {/* Film grain — the same surface as the home screen */}
      <div className="bnr-grain" aria-hidden="true" />

    </header>
  );
};

export default Banner;
