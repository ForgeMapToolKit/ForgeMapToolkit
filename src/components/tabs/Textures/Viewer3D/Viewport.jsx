/**
 * Viewport.jsx — Sektion 01: die 3D-Fläche und was sie über das Objekt sagt.
 *
 * Rein präsentational. Die Maße kommen aus den Bounds des Meshes mal
 * UniformScale, nicht aus der Engine — dieselbe Rechnung, aber als Daten statt
 * über einen Ref, damit die Anzeige mit dem State neu rendert.
 */

import React from 'react';
import { OGRID_METRES } from '../../../Shared/Ocean/faWater.js';

const fmt = (n, digits = 2) => (n == null || Number.isNaN(n) ? '—' : n.toFixed(digits));

/** Measured extent in ogrids: raw mesh bounds scaled by the blueprint's UniformScale. */
function extent(asset) {
  if (!asset) return null;
  const { min, max } = asset.mesh.bounds;
  const s = asset.scale || 1;
  return { x: (max[0] - min[0]) * s, y: (max[1] - min[1]) * s, z: (max[2] - min[2]) * s };
}

const Viewport = ({
  subject, reference, showReference, wireframe, loading, error,
  SceneComponent, onEngine, onWireframe, onFrame,
}) => {
  const size = extent(subject);
  const refSize = extent(reference);
  const bp = subject?.blueprint;

  return (
    <div className="v3-viewport">
      <SceneComponent accent="var(--tab-color)" onEngine={onEngine} className="v3-canvas" />

      {/* Read-out. Sits over the canvas because the numbers only mean anything
          next to the thing they describe. */}
      <div className="v3-readout">
        {subject ? (
          <>
            <div className="v3-readout-name">{bp.name}</div>
            <dl className="v3-facts">
              <dt>Size</dt>
              <dd>
                {fmt(size.x)} × {fmt(size.y)} × {fmt(size.z)} ogrids
                <span className="v3-fact-aside">
                  ≈ {fmt(size.x * OGRID_METRES, 1)} × {fmt(size.y * OGRID_METRES, 1)} × {fmt(size.z * OGRID_METRES, 1)} m nominal
                </span>
              </dd>

              <dt>Scale</dt>
              <dd>
                {bp.uniformScale == null
                  ? <span className="v3-warn">no UniformScale — set it below</span>
                  : <>UniformScale {bp.uniformScale}</>}
              </dd>

              {bp.declaredSize?.x != null && (
                <>
                  <dt>Footprint</dt>
                  <dd>
                    {fmt(bp.declaredSize.x, 2)} × {fmt(bp.declaredSize.z, 2)} declared
                    <span className="v3-fact-aside">pathing footprint, not the mesh extent</span>
                  </dd>
                </>
              )}

              <dt>Mesh</dt>
              <dd>
                {subject.mesh.triCount.toLocaleString()} tris · {subject.mesh.vertCount.toLocaleString()} verts
                {bp.lodCount > 1 && <span className="v3-fact-aside">{bp.lodCount} LODs declared</span>}
              </dd>

              {bp.shaderName && (
                <>
                  <dt>Shader</dt>
                  <dd>
                    {bp.shaderName}
                    <span className="v3-fact-aside">not applied — see below</span>
                  </dd>
                </>
              )}

              {reference && showReference && (
                <>
                  <dt>Against</dt>
                  <dd>
                    {reference.blueprint.name} · {fmt(refSize.x)} × {fmt(refSize.z)} ogrids
                  </dd>
                </>
              )}
            </dl>
          </>
        ) : (
          <div className="v3-readout-empty">
            {loading ? 'Loading…' : 'Pick a prop, or drop a .scm'}
          </div>
        )}
      </div>

      <div className="v3-viewport-actions">
        <button className="ctrl-btn-meta" onClick={onFrame} title="Fit the view to the scene">Frame</button>
        <button
          className={`ctrl-btn-meta${wireframe ? ' is-on' : ''}`}
          onClick={() => onWireframe(!wireframe)}
          aria-pressed={wireframe}
        >
          Wireframe
        </button>
      </div>

      {/* Stated, not implied: this is studio lighting. Vanilla props declare
          sixteen different ShaderNames and none of them is what three does
          here — approximating them is a later phase, and until then a
          confident-looking render would be a lie about the game. */}
      <div className="v3-disclaimer">Neutral lighting — not the in-game shader</div>

      {error && <div className="v3-error" role="alert">{error}</div>}
      {loading && <div className="v3-loading" aria-live="polite">Loading…</div>}
    </div>
  );
};

export default Viewport;
