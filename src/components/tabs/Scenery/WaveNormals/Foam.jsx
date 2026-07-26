import React from 'react';
import { tileMetres } from '../../../Shared/Ocean/faWater.js';
import { Slider, Options, Readout } from './Fields.jsx';

/**
 * Section 03 — the alpha channel.
 *
 * `water2.fx` reads alpha completely independently of RGB:
 * `waveCrest = saturate(sum.a − waveCrestThreshold)`, where `sum.a` is the sum
 * over all four slots. That makes foam a closed loop — per-layer coverage feeds
 * Σα, Σα decides what the threshold has to be, and the threshold decides how
 * much white water the map actually shows. The loop used to be split across two
 * rail steps, which is why it never read as one thing; all three of its stages
 * are in this section now, top to bottom in that order.
 */
export default function WaveFoam({
  rates = [],
  foamMode, setFoamMode, foamCoverage, setFoamCoverage, foamJacobian, setFoamJacobian,
  foamSharp, setFoamSharp, foamGain, setFoamGain, foamBlur, setFoamBlur,
  foamWeights = [], setFoamWeight = () => {},
  foamTarget, setFoamTarget, recommended, layers,
}) {
  const sumAlpha = (layers || []).reduce((a, l) => a + l.stats.foamMean, 0);

  return (
    <div className="ctrl-col">

      {/* ── Generation ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Generation</div>
        <div className="ctrl-content">
          <Options
            value={foamMode}
            onChange={setFoamMode}
            options={[
              { id: 'coverage', label: 'Target coverage', hint: 'Solve the det(J) threshold so a fixed share of the surface is flagged.' },
              { id: 'physical', label: 'Fixed det(J)',    hint: 'Use a literal fold threshold; how much foam appears is whatever the sea produces.' },
            ]}
          />

          {foamMode === 'coverage' ? (
            <Slider
              label="Coverage per layer" value={foamCoverage} onChange={setFoamCoverage}
              min={0.02} max={0.7} step={0.01}
              format={v => `${(v * 100).toFixed(0)}%`}
              hint="Share of each layer's texels marked as breaking. The engine compares the SUM of four alphas against waveCrestThreshold, so per-layer values well below the threshold still produce foam where the layers agree."
            />
          ) : (
            <Slider
              label="det(J) threshold" value={foamJacobian} onChange={setFoamJacobian}
              min={0.05} max={1.2} step={0.01}
              hint="Foam starts where the Jacobian of the displacement drops below this. Below 0 the surface has folded through itself outright."
            />
          )}

          <Slider
            label="Edge softness" value={foamSharp} onChange={setFoamSharp}
            min={0.02} max={1} step={0.02}
            hint="How fast the mask saturates past the threshold."
          />
          <Slider
            label="Foam gain" value={foamGain} onChange={setFoamGain}
            min={0} max={2} step={0.05}
            hint="Final multiplier across all layers."
          />
        </div>
      </div>

      {/* ── Which layers break ──
          Foam on every scale reads as weather; foam on the chop alone, over
          unbroken swell, reads as composition. */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Which Layers Break</div>
        <div className="ctrl-content">
          {rates.map((r, i) => (
            <Slider
              key={i}
              label={`Layer ${i} · ${tileMetres(r).toFixed(0)} m`}
              value={foamWeights[i] ?? 1}
              onChange={v => setFoamWeight(i, v)}
              min={0} max={1} step={0.05}
              format={v => (v === 0 ? 'no foam' : v.toFixed(2))}
            />
          ))}

          <Slider
            label="Mask blur" value={foamBlur} onChange={setFoamBlur}
            min={0} max={4} step={1}
            format={v => `${v} px`}
            hint="DXT5 stores alpha as two endpoints plus 3-bit indices per 4×4 block; high-frequency foam turns blocky there. Irrelevant for the uncompressed export."
          />
        </div>
      </div>

      {/* ── Calibration ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Calibration</div>
        <div className="ctrl-content">
          <Slider
            label="Target foam coverage" value={foamTarget} onChange={setFoamTarget}
            min={0.005} max={0.4} step={0.005}
            format={v => `${(v * 100).toFixed(1)}%`}
            hint="Share of the water surface that should end up white in-game. The threshold below is solved from the four baked alphas to hit it — it reads the existing bake, so changing it costs nothing and needs no re-bake."
          />

          {recommended ? (
            <Readout rows={[
              ['waveCrestThreshold', recommended.threshold.toFixed(3)],
              ['mean Σα',            recommended.meanSum.toFixed(3)],
              ['max Σα',             recommended.maxSum.toFixed(3)],
              ['stock threshold 1',
                sumAlpha > 0.25 ? 'reachable where layers overlap' : 'too low — raise coverage',
                sumAlpha > 0.25 ? 'ok' : 'warn'],
            ]} />
          ) : (
            <div className="wn-hint">Bake the layers to solve a threshold.</div>
          )}
        </div>
      </div>

    </div>
  );
}
