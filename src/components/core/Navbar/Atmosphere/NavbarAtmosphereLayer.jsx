import React, { useEffect, useRef } from 'react';
import { createAtmosphereEngine } from '../../Home/Atmosphere/engine.js';

/**
 * NavbarAtmosphereLayer — atmospheric haze behind the NavbarPanel.
 *
 * ── Singleton pattern ────────────────────────────────────────────────────────
 * The engine is initialised once at first mount and never disposed (it lives
 * at module scope). React mounts/unmounts the component as the panel opens and
 * closes, but the GL context and particle positions persist. This matches
 * spec §6: "Singleton-Engine — einmal beim App-Start initialisiert, nie
 * disposed bis App-Ende."
 *
 * ── Static rendering ─────────────────────────────────────────────────────────
 * `quality: 'fast'` → the engine runs isStatic=true automatically: no
 * requestAnimationFrame loop, one frame rendered per setState() call.
 * One frame per color change, hard switch — no lerp.
 *
 * ── Positioning ──────────────────────────────────────────────────────────────
 * Fixed, flush below the navbar bar. `panelTop` (bar bottom in viewport px)
 * is passed in from Navbar.jsx so the layer aligns with the open panel.
 * Height mirrors the panel's 30–40vh. pointer-events: none throughout.
 *
 * ── Right bias ───────────────────────────────────────────────────────────────
 * The shared haze shader defaults to a left-leaning focus (home screen).
 * `NAVBAR_RIGHT_BIAS` (passed as `rightBias` to the engine, default 0.7)
 * pulls the navbar's haze focus toward the right instead — a Navbar-only
 * knob, gated behind `uRightBias` in the shader so the home screen's
 * uniform stays at its default 0 and is unaffected.
 *
 * ── Props ────────────────────────────────────────────────────────────────────
 *  hoveredTabColor  string | null — CSS color, e.g. 'var(--emitter-color)'
 *  visible          boolean       — opacity toggle (no GL teardown)
 *  panelTop         number        — bar bottom in viewport px (default 72)
 *  panelHeight      number | null — actual panel height in px; clamps the
 *                                   haze layer so it never bleeds below the
 *                                   panel's own overflow:hidden boundary.
 *                                   Pass null to use the old 38vh fallback.
 */

// Probe element for resolving CSS var() to [r,g,b] in 0..1.
function resolveColor(value) {
  if (!value) return null;
  const probe = document.createElement('span');
  probe.style.cssText = `color:${value};position:fixed;left:-9999px;top:-9999px`;
  document.body.appendChild(probe);
  const m = getComputedStyle(probe).color.match(/[\d.]+/g);
  document.body.removeChild(probe);
  if (!m || m.length < 3) return null;
  return [+m[0] / 255, +m[1] / 255, +m[2] / 255];
}

// ── Module-level singleton ────────────────────────────────────────────────────
// Survives React render cycles; engine is created once and reused.
let _engine    = null;
let _mountEl   = null;

// How strongly the haze's focus is pulled to the right side of the navbar
// panel. 0 = home's left-leaning default, 1 = fully right. Tune here.
const NAVBAR_RIGHT_BIAS = 1;

// How steeply the haze centerY rises from left (x=0) to right (x=1).
// 0 = flat band (home default, completely unaffected).
// ~0.45 matches the diagonal arc from the lower-left to off-screen upper-right.
// Tune here — does not affect the home screen shader in any way.
// Diagonal shear strength. Controls how steeply the haze rises left→right.
// Right-side anchor = centerY - SHIFT*0.55 (lower half of panel).
// Left-side exit   = right anchor - SHIFT below that (off-screen bottom).
// Tune here. 0.28 ≈ gentle arc; 0.45 ≈ steep.
const NAVBAR_DIAG_SHIFT = 2.0;

function getOrCreateEngine(el) {
  if (_engine) return _engine;
  _engine  = createAtmosphereEngine(el, {
    quality:    'fast',
    layer:      'back',
    rightBias:  NAVBAR_RIGHT_BIAS,
    diagShift:  NAVBAR_DIAG_SHIFT,
  });
  _mountEl = el;
  return _engine;
}

// ── Component ─────────────────────────────────────────────────────────────────

const NavbarAtmosphereLayer = ({
  hoveredTabColor = null,
  visible         = false,
  panelTop        = 72,
  panelHeight     = null,
}) => {
  const containerRef = useRef(null);
  const engineRef    = useRef(null);

  // Init engine once on first mount. Subsequent mounts (panel re-opens) reuse
  // the singleton — the canvas already lives inside the container div.
  useEffect(() => {
    if (!containerRef.current) return;
    // If the engine already exists but was mounted in a different DOM node
    // (e.g. HMR / dev), re-attach by appending its canvas here.
    if (_engine && _mountEl !== containerRef.current && _engine._canvas) {
      containerRef.current.appendChild(_engine._canvas);
      _mountEl = containerRef.current;
    }
    engineRef.current = getOrCreateEngine(containerRef.current);
    engineRef.current?.setState({ color: null }); // initial neutral frame
  }, []);  

  // Recolor on each hovered-tab change. One frame, no lerp.
  useEffect(() => {
    if (!engineRef.current) return;
    const color = resolveColor(hoveredTabColor);
    engineRef.current.setState({ color });
  }, [hoveredTabColor]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position:      'fixed',
        top:           panelTop,
        left:          0,
        right:         0,
        height:        panelHeight != null ? panelHeight : '38vh',
        zIndex:        'calc(var(--z-rail) + 2)',
        pointerEvents: 'none',
        opacity:       visible ? 1 : 0,
        transition:    'opacity 220ms ease',
      }}
    />
  );
};

export default NavbarAtmosphereLayer;
