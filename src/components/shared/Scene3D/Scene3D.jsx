/**
 * Scene3D.jsx — the React side of the 3D viewer: mount, resize, dispose.
 *
 * Everything else is imperative. The component hands the engine up through
 * `onEngine` once, and `null` again on unmount, so the owning tab can drive it
 * with refs instead of re-rendering a scene graph.
 *
 *   <Scene3D accent="#6C63FF" onEngine={e => (engineRef.current = e)} />
 *
 * A missing WebGL context is not an error worth crashing a tab over — the
 * engine factory returns null and this renders the fallback instead.
 */

import React, { useEffect, useRef, useState } from 'react';
import './Scene3D.css';
import { createScene3D } from './engine.js';

/**
 * three parses CSS colour *strings*, not custom properties — `new Color('var(--tab-color)')`
 * warns and silently yields white. Callers naturally pass the token, so resolve it
 * against the mounted element, which is inside the tab's scope and therefore also
 * picks up the light-mode override.
 */
function resolveColor(el, value, fallback = '#6C63FF') {
  const m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/.exec(String(value || '').trim());
  if (!m) return value || fallback;
  const resolved = getComputedStyle(el).getPropertyValue(m[1]).trim();
  return resolved || (m[2] || '').trim() || fallback;
}

const Scene3D = ({ accent = '#6C63FF', className = '', onEngine = () => {} }) => {
  const mountRef  = useRef(null);
  const engineRef = useRef(null);
  const onEngineRef = useRef(onEngine);
  onEngineRef.current = onEngine;

  const [failed, setFailed] = useState(false);

  // Mount once. `accent` is read at construction; changing the theme mid-life
  // is rare enough that a remount (via the key the tab gives us) is the honest
  // way to handle it, rather than threading a live colour through the scene.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const engine = createScene3D(mount, { accent: resolveColor(mount, accent) });
    if (!engine) { setFailed(true); return undefined; }

    engineRef.current = engine;
    onEngineRef.current(engine);

    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(mount);

    return () => {
      ro.disconnect();
      onEngineRef.current(null);
      engineRef.current = null;
      engine.dispose();
    };
  }, [accent]);

  if (failed) {
    return (
      <div className={`scene3d scene3d--failed ${className}`.trim()}>
        <span className="scene3d-fallback">3D preview unavailable — no WebGL context</span>
      </div>
    );
  }

  return <div ref={mountRef} className={`scene3d ${className}`.trim()} />;
};

export default Scene3D;
