/**
 * Scene3D.jsx — the React side of the 3D viewer: mount, resize, dispose.
 *
 * Everything else is imperative. The component hands the engine up through
 * `onEngine` once, and `null` again on unmount, so the owning tab can drive it
 * with refs instead of re-rendering a scene graph.
 *
 *   <Scene3D onEngine={e => (engineRef.current = e)} onGridStep={setStep} />
 *
 * The scene takes no accent colour. Its axes are red / green / blue because
 * those three are what X / Y / Z mean everywhere else a mapper works, and a
 * per-tab hue on top of them would be a fourth colour saying nothing (see
 * grid.js → AXIS_COLORS).
 *
 * A missing WebGL context is not an error worth crashing a tab over — the
 * engine factory returns null and this renders the fallback instead.
 */

import React, { useEffect, useRef, useState } from 'react';
import './Scene3D.css';
import { createScene3D } from './engine.js';

const Scene3D = ({ className = '', onEngine = () => {}, onGridStep = () => {} }) => {
  const mountRef  = useRef(null);
  const engineRef = useRef(null);

  // Both callbacks are read through refs so a caller that re-creates them every
  // render cannot tear the GL context down and rebuild it.
  const onEngineRef = useRef(onEngine);
  onEngineRef.current = onEngine;
  const onGridStepRef = useRef(onGridStep);
  onGridStepRef.current = onGridStep;

  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const engine = createScene3D(mount, { onGridStep: s => onGridStepRef.current(s) });
    if (!engine) { setFailed(true); return undefined; }

    engineRef.current = engine;
    onGridStepRef.current(engine.gridStep());
    onEngineRef.current(engine);

    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(mount);

    return () => {
      ro.disconnect();
      onEngineRef.current(null);
      engineRef.current = null;
      engine.dispose();
    };
  }, []);

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
