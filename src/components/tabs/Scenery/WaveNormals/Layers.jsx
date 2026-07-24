import React from 'react';
import {
  SLOT_PRESETS, BAND_MODES, tileMetres, tileOgrids,
} from '../../../Shared/Ocean/faWater.js';
import { Field, Slider, Select, Toggle, Options, Readout } from './Fields.jsx';

const RESOLUTIONS = [
  { value: 256,  label: '256² — fast iteration' },
  { value: 512,  label: '512² — light' },
  { value: 1024, label: '1024² — matches the sharpest engine normals' },
  { value: 2048, label: '2048² — beyond anything the engine ships' },
];

/**
 * Target world-space texel sizes. FA's camera resolves roughly 3 cm/pixel fully
 * zoomed in and metres when zoomed out, so anything below ~5 cm is paid for and
 * never seen.
 */
const TEXEL_TARGETS = [
  { value: 0.20, label: '20 cm — light' },
  { value: 0.10, label: '10 cm — recommended' },
  { value: 0.05, label: '5 cm — matches the closest camera zoom' },
  { value: 0.03, label: '3 cm — maximum' },
];

/**
 * Section 02 — fitting the sea into FA's four normal slots.
 *
 * The engine samples four normal maps at four `normalRepeatRate` values and
 * sums them before normalising, so these four tile sizes are not four
 * independent choices — they define which slice of the spectrum each texture
 * gets to carry.
 */
export default function WaveLayers({
  preset, applyPreset, rates, setRate, bandMode, setBandMode,
  resMode, setResMode, targetTexel, setTargetTexel,
  resolution, setResolution,
  ssAuto, setSsAuto, supersample, setSupersample, effectiveSS = 1,
  layerRes = [], bakeBudget = { peakMB: 0, textureMB: 0, supersample: 1 },
  floorAuto, setFloorAuto, floorTexels, setFloorTexels, floorManual, setFloorManual,
  lambda, setLambda, slopeGain, setSlopeGain, sumComp, setSumComp,
  foamMode, setFoamMode, foamCoverage, setFoamCoverage, foamJacobian, setFoamJacobian,
  foamSharp, setFoamSharp, foamGain, setFoamGain, foamBlur, setFoamBlur,
  foamWeights = [], setFoamWeight = () => {},
  layers, busy, onBake, onBakeOne,
}) {
  const sumAlpha = (layers || []).reduce((a, l) => a + l.stats.foamMean, 0);

  return (
    <div className="ctrl-col">

      {/* ── Tile sizes ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Tile Sizes</div>
        <div className="ctrl-content">
          <Select
            label="Preset"
            value={preset}
            onChange={applyPreset}
            options={[...SLOT_PRESETS, { id: 'custom', label: 'Custom' }]}
            hint={SLOT_PRESETS.find(p => p.id === preset)?.hint
              || 'Hand-set repeat rates. The editor field is Scale = 1 / repeatRate, in ogrids.'}
          />

          <div className="wn-slot-table">
            <div className="wn-slot-head">
              <span>#</span><span>repeatRate</span><span>Scale (ogrid)</span><span>Tile</span><span />
            </div>
            {rates.map((r, i) => {
              const l = layers?.find(x => x.index === i);
              return (
                <div className="wn-slot-row" key={i}>
                  <span className="wn-slot-idx">{i}</span>
                  <input
                    type="number"
                    className="ctrl-input wn-slot-input"
                    step="0.001"
                    value={r}
                    onChange={e => setRate(i, Math.max(1e-4, Number(e.target.value) || 1e-4))}
                  />
                  <span className="wn-slot-cell">{tileOgrids(r).toFixed(2)}</span>
                  <span className="wn-slot-cell">{tileMetres(r).toFixed(0)} m</span>
                  <button
                    className="ctrl-btn-meta"
                    disabled={busy || !layers?.length}
                    onClick={() => onBakeOne(i)}
                    title="Re-bake only this layer"
                    type="button"
                  >↻</button>
                  {l && (
                    <span className="wn-slot-band">
                      {/* An open band runs down to the simulation's Nyquist, an
                          open low end up to the tile's own fundamental. */}
                      λ {(l.kHi ? (2 * Math.PI) / l.kHi : (2 * l.L) / l.simN).toFixed(2)}–
                      {l.kLo ? ((2 * Math.PI) / l.kLo).toFixed(0) : l.L.toFixed(0)} m
                      <span className="wn-slot-sep">·</span>
                      slope {l.stats.rmsSlope.toFixed(2)}
                      <span className="wn-slot-sep">·</span>
                      α {l.stats.foamMean.toFixed(2)}
                      {l.stats.rmsSlope < 0.01 && <span className="wn-slot-warn">empty band</span>}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Band split ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Band Split</div>
        <div className="ctrl-content">
          <Options value={bandMode} onChange={setBandMode} options={BAND_MODES} />
        </div>
      </div>

      {/* ── Surface ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Surface</div>
        <div className="ctrl-content">
          <Slider
            label="Choppiness λ" value={lambda} onChange={setLambda}
            min={0} max={2.5} step={0.05}
            hint="Horizontal displacement: sharpens crests but broadens troughs. Net effect above ~1.3 is LESS apparent detail, not more — the wide flat troughs read as blur. Keep it 0.8–1.2 for crisp water; go higher only for a deliberately swell-like, folded look (and watch the foam, since folding drives it)."
          />
          <Slider
            label="Normal strength" value={slopeGain} onChange={setSlopeGain}
            min={0.2} max={3} step={0.05}
            hint="Artistic multiplier on the slope, applied after filtering."
          />
          <Toggle
            label={`Sum compensation (×${bandMode === 'independent' ? 2 : 4})`}
            value={sumComp}
            onChange={setSumComp}
            hint={bandMode === 'independent'
              ? 'The engine normalises the sum of four layers, rendering their mean slope. With the full spectrum in each layer they are four draws of the same field, so the mean lands at half strength — hence ×2.'
              : 'The engine normalises the sum of four layers, rendering their mean slope. With four disjoint bands that mean is a quarter of the true slope — hence ×4.'}
          />
        </div>
      </div>

      {/* ── Foam ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Foam (alpha channel)</div>
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

          <div className="ctrl-field">
            <label className="ctrl-label">Which layers break</label>
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
          </div>
          <Slider
            label="Mask blur" value={foamBlur} onChange={setFoamBlur}
            min={0} max={4} step={1}
            format={v => `${v} px`}
            hint="DXT5 stores alpha as two endpoints plus 3-bit indices per 4×4 block; high-frequency foam turns blocky there. Irrelevant for the uncompressed export."
          />

          {layers?.length ? (
            <Readout rows={[
              ['Σ mean α', sumAlpha.toFixed(3)],
              ['stock threshold 1', sumAlpha > 0.25 ? 'reachable where layers overlap' : 'too low — raise coverage', sumAlpha > 0.25 ? 'ok' : 'warn'],
            ]} />
          ) : null}
        </div>
      </div>

      {/* ── Fidelity ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Fidelity</div>
        <div className="ctrl-content">
          <Options
            value={resMode}
            onChange={setResMode}
            options={[
              { id: 'perTexel', label: 'Per layer, by texel size',
                hint: 'Size each layer so all four land on the same world-space texel. The pixel budget goes where it shows.' },
              { id: 'uniform', label: 'One resolution for all',
                hint: 'Same texture size everywhere — over-resolves the small tiles by an order of magnitude.' },
            ]}
          />

          {resMode === 'perTexel' ? (
            <Select
              label="Target texel size"
              value={targetTexel}
              onChange={v => setTargetTexel(Number(v))}
              options={TEXEL_TARGETS}
              hint="Texel size in world space, identical across layers. A 400 m tile needs sixteen times the pixels of a 100 m one to reach it — that is the whole point."
            />
          ) : (
            <Select
              label="Texture resolution"
              value={resolution}
              onChange={v => setResolution(Number(v))}
              options={RESOLUTIONS}
            />
          )}

          {!!layerRes.length && (
            <Readout rows={[
              ...rates.map((r, i) => [
                `layer ${i} · ${tileMetres(r).toFixed(0)} m`,
                `${layerRes[i]}²  →  ${((tileMetres(r) / layerRes[i]) * 100).toFixed(1)} cm/texel`,
              ]),
              ['bake peak RAM', `${bakeBudget.peakMB.toFixed(0)} MB  ·  ${bakeBudget.supersample}× sim`,
                bakeBudget.peakMB > 900 ? 'warn' : 'ok'],
              ['texture set', `${bakeBudget.textureMB.toFixed(1)} MB uncompressed, before mips`],
            ]} />
          )}
          <Toggle
            label={`Auto supersampling (currently ${effectiveSS}×)`}
            value={ssAuto}
            onChange={setSsAuto}
            hint="Supersampling only earns its cost when the spectrum reaches past the output Nyquist — and the auto detail floor is what decides whether it does. Measured at 400 m / 2048²: with the floor at 2 texels, 1× and 2× give the same rms slope and the same foam, for a quarter of the time and a third of the memory."
          />

          {!ssAuto && (
            <Select
              label="Supersampling"
              value={supersample}
              onChange={v => setSupersample(Number(v))}
              options={[
                { value: 1, label: '1× — off' },
                { value: 2, label: '2× — antialiased' },
                { value: 4, label: '4× — maximum' },
              ]}
              hint="The simulation runs at this multiple of the output and is resolved back down through the displacement scatter, which doubles as the antialiasing filter. Must be a power of two (the FFT requires it); only worth raising if you have pushed the detail floor below 2 texels."
            />
          )}

          <Toggle
            label="Auto detail floor"
            value={floorAuto}
            onChange={setFloorAuto}
            hint="Damping is a resolution limit, not a property of the sea: it must scale with each layer's tile size. A single fixed value is right on one layer and throws away three octaves of micro-detail on the next."
          />

          {floorAuto ? (
            <Slider
              label="Detail floor" value={floorTexels} onChange={setFloorTexels}
              min={1.5} max={8} step={0.5}
              format={v => `${v}× texel`}
              hint="Where the small-wave damping reaches half power, in output texels. The ocean tail is ~k⁻⁴, whose slope variance is flat per octave — so every octave this eats costs an equal share of apparent sharpness. Go below ~2 and the finest layer starts to shimmer instead of sharpen."
            />
          ) : (
            <Slider
              label="Detail floor" value={floorManual} onChange={setFloorManual}
              min={0.01} max={2} step={0.01} unit=" m"
              hint="Fixed wavelength at half power, applied to every layer regardless of its tile size."
            />
          )}

          {layers?.length ? (
            <Readout rows={layers.map(l => [
              `layer ${l.index} floor`,
              `${((l.detailFloor ?? 0) * 100).toFixed(1)} cm  ·  texel ${((l.texel ?? 0) * 100).toFixed(1)} cm`,
            ])} />
          ) : null}

          <div className="ctrl-action-row">
            <button className="ftr-preview-readmore" onClick={onBake} disabled={busy} type="button">
              {busy ? 'Baking…' : 'Bake all layers'}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
