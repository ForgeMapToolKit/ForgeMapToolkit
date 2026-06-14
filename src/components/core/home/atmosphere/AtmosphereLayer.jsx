import React, { useEffect, useRef } from 'react';
import { createAtmosphereEngine } from './engine.js';
import { getTool } from '../data/toolRegistry.js';

/**
 * Resolve a tool's CSS colour (which may be a `var(--x)`) to an [r,g,b] in
 * 0..1, evaluated inside `scope` so the home screen's custom properties
 * resolve correctly. Returns null if it can't be parsed.
 */
function resolveColor(value, scope) {
  if (!value || !scope) return null;
  const probe = document.createElement('span');
  probe.style.cssText = `color:${value};position:absolute;left:-9999px;top:-9999px`;
  scope.appendChild(probe);
  const m = getComputedStyle(probe).color.match(/[\d.]+/g);
  scope.removeChild(probe);
  if (!m || m.length < 3) return null;
  return [+m[0] / 255, +m[1] / 255, +m[2] / 255];
}

/**
 * AtmosphereLayer — the volumetric substrate behind the TRACE home screen.
 *
 * This is NOT a 3D scene. It is a single full-bleed canvas sitting at the
 * very back of the home screen (z-index 0), onto which a fragment-shader
 * volume (+ a particle field, later) is composited. It exists ONLY on the
 * homepage: it mounts inside HomeScreen and tears its GL context down on
 * unmount, so no other tab ever pays for it.
 *
 * It is driven entirely by the home screen's existing state signal
 * (focusedToolId / commitToolId) and mirrors the DOM choreography timings,
 * so the volume stays in lockstep with the plotter gantry rather than
 * running on its own clock.
 *
 * ─── STAGE 2 (current) ───────────────────────────────────────────────
 * Renders the standby cold haze. focusedToolId / commitToolId are already
 * forwarded to the engine; they become live in Stage 3.
 *
 * Props:
 *  - focusedToolId: string | null   tool currently hovered on the rail
 *  - commitToolId:  string | null   tool being committed (shutter in flight)
 *  - quality:       'fast' | 'performant'
 */

const AtmosphereLayer = ({ focusedToolId = null, commitToolId = null, quality = 'performant' }) => {
  const backRef    = useRef(null);
  const frontRef   = useRef(null);
  const enginesRef = useRef([]);

  // Mount / dispose the depth layers. Performant runs both (back at z 0,
  // front at z 6) with the hero between them and motion on. Fast runs the
  // back layer only, static — one engine, no movement, for weak machines.
  // Quality changes rebuild them (rare — only on a settings change).
  useEffect(() => {
    const engines = [];
    const back = createAtmosphereEngine(backRef.current, { quality, layer: 'back' });
    if (back) engines.push(back);
    if (quality !== 'fast') {
      const front = createAtmosphereEngine(frontRef.current, { quality, layer: 'front' });
      if (front) engines.push(front);
    }
    enginesRef.current = engines;
    return () => {
      engines.forEach((e) => e.dispose());
      enginesRef.current = [];
    };
  }, [quality]);

  // Feed the home screen's state to both layers without rebuilding them. The
  // haze grades to the focused (or committing) tool's hue, neutral at rest.
  useEffect(() => {
    const tool = getTool(commitToolId ?? focusedToolId);
    const color = tool ? resolveColor(tool.color, backRef.current) : null;
    enginesRef.current.forEach((e) => e.setState({ focusedToolId, commitToolId, color }));
  }, [focusedToolId, commitToolId]);

  return (
    <>
      <div ref={backRef}  className="hs-atmosphere hs-atmosphere--back"  aria-hidden="true" />
      <div ref={frontRef} className="hs-atmosphere hs-atmosphere--front" aria-hidden="true" />
    </>
  );
};

export default AtmosphereLayer;
