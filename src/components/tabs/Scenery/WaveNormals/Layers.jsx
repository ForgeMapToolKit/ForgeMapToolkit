import React from 'react';
import {
  SLOT_PRESETS, BAND_MODES, tileMetres, tileOgrids,
} from '../../../Shared/Ocean/faWater.js';
import { Slider, Select, Toggle, Options } from './Fields.jsx';

/**
 * Section 02 — fitting the sea into FA's four normal slots.
 *
 * The engine samples four normal maps at four `normalRepeatRate` values and sums
 * them before normalising, so these four tile sizes are not four independent
 * choices — they define which slice of the spectrum each texture carries.
 *
 * Sum compensation sits with the band split rather than in its own block because
 * it is not a second decision: its factor is a consequence of the split (×2 for
 * four draws of the full spectrum, ×4 for four disjoint bands).
 */
export default function WaveLayers({
  preset, applyPreset, rates, setRate, bandMode, setBandMode,
  lambda, setLambda, slopeGain, setSlopeGain, sumComp, setSumComp,
  layers, busy, onBakeOne,
}) {
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

      {/* ── Surface ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Surface</div>
        <div className="ctrl-content">
          <Slider
            label="Choppiness λ" value={lambda} onChange={setLambda}
            min={0} max={2.5} step={0.05}
            hint="Horizontal displacement: sharpens crests but broadens troughs. Net effect above ~1.3 is LESS apparent detail, not more — the wide flat troughs read as blur. Keep it 0.8–1.2 for crisp water; go higher only for a deliberately swell-like, folded look. This is also what drives the foam, since folding is what the alpha channel measures."
          />
          <Slider
            label="Normal strength" value={slopeGain} onChange={setSlopeGain}
            min={0.2} max={3} step={0.05}
            hint="Artistic multiplier on the slope, applied after filtering."
          />
        </div>
      </div>

    </div>
  );
}
