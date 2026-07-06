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

// Home haze character. The canvas is large and near-square, so at the bare
// defaults the noise spreads into a few broad blobs ("big cloud"). We lift the
// feature density for internal structure, but keep it moderate and add strong
// domain WARP so the fog reads as billowing SMOKE rather than fine even grain
// (which looks like heat-shimmer / refraction). LEAN gives a gentle up-right
// diagonal drift. Back carries the body; the front veil stays softer so it
// reads as drifting wisps. Tune live via the console, e.g.
//   window.__hsAtmo.back.setDetailScale(1.7); .setWarp(1.9); .setLean(0.35)
const HOME_DETAIL_BACK  = 1.7;
const HOME_DETAIL_FRONT = 1.4;
const HOME_WARP_BACK    = 1.9;
const HOME_WARP_FRONT   = 1.7;
const HOME_LEAN         = 0.35;

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
    const back = createAtmosphereEngine(backRef.current, { quality, layer: 'back', detailScale: HOME_DETAIL_BACK, warp: HOME_WARP_BACK, lean: HOME_LEAN });
    if (back) engines.push(back);
    if (quality !== 'fast') {
      const front = createAtmosphereEngine(frontRef.current, { quality, layer: 'front', detailScale: HOME_DETAIL_FRONT, warp: HOME_WARP_FRONT, lean: HOME_LEAN });
      if (front) engines.push(front);
    }
    enginesRef.current = engines;
    // Dev-only: expose for live tuning from the console (e.g.
    // window.__hsAtmo.back.setDetailScale(2.8)) while we dial in the look.
    if (import.meta.env?.DEV) {
      window.__hsAtmo = { back: engines[0] ?? null, front: engines[1] ?? null };
    }
    return () => {
      engines.forEach((e) => e.dispose());
      enginesRef.current = [];
      if (window.__hsAtmo) delete window.__hsAtmo;
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
