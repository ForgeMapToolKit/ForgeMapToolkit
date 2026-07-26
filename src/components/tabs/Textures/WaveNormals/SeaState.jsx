import React from 'react';
import { SPECTRUM_MODELS } from '../../../Shared/Ocean/spectrum.js';
import { Field, Slider, Select, Toggle, Readout } from './Fields.jsx';

/**
 * Section 01 — the sea state.
 *
 * Everything here is physics: a spectrum and the wind that drives it. Nothing in
 * this section knows that FA exists. The scroll vectors used to sit here too,
 * which taught the wrong model — they never touch a pixel, so they live in
 * Export now.
 */
export default function SeaState({
  model, setModel, windSpeed, setWindSpeed, windDir, setWindDir,
  fetchKm, setFetchKm, gamma, setGamma, depth, setDepth, deepWater, setDeepWater,
  spread, setSpread, seed, setSeed,
  peakLambda, layers, elapsed,
}) {
  const fetchDriven = model === 'jonswap' || model === 'tma';

  return (
    <div className="ctrl-col">

      {/* ── Spectrum ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Spectrum</div>
        <div className="ctrl-content">
          <Select
            label="Model"
            value={model}
            onChange={setModel}
            options={SPECTRUM_MODELS}
            hint={SPECTRUM_MODELS.find(m => m.id === model)?.hint}
          />

          <Slider
            label="Wind speed" value={windSpeed} onChange={setWindSpeed}
            min={1} max={30} step={0.5} unit=" m/s"
            hint="Measured at 10 m. Drives wave height and, in the fetch-limited models, wavelength."
          />

          <Slider
            label="Wind direction" value={windDir} onChange={setWindDir}
            min={0} max={360} step={1} unit="°"
            hint="0° runs along +X. Also sets each layer's scroll direction on export."
          />

          {fetchDriven && (
            <Slider
              label="Fetch" value={fetchKm} onChange={setFetchKm}
              min={1} max={2000} step={1} unit=" km"
              hint="Open water the wind has crossed. Short fetch = short, steep chop; long fetch = long swell."
            />
          )}

          {fetchDriven && (
            <Slider
              label="Peak enhancement γ" value={gamma} onChange={setGamma}
              min={1} max={7} step={0.1}
              hint="1 collapses JONSWAP onto Pierson-Moskowitz. 3.3 is the North Sea mean."
            />
          )}
        </div>
      </div>

      {/* ── Water body ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Water Body</div>
        <div className="ctrl-content">
          <Toggle
            label="Deep water"
            value={deepWater}
            onChange={setDeepWater}
            hint="Off switches the dispersion relation to ω = √(gk·tanh(kD)) — long waves slow down and steepen as they feel the bottom."
          />
          {(!deepWater || model === 'tma') && (
            <Slider
              label="Depth" value={depth} onChange={setDepth}
              min={1} max={200} step={1} unit=" m"
              hint="Used by the TMA attenuation and by the finite-depth dispersion."
            />
          )}
          <Slider
            label="Directional spread" value={spread} onChange={setSpread}
            min={0.5} max={20} step={0.5}
            hint="Exponent s in cos²ˢ(Δθ/2). Low = waves fan out in all directions, high = tight parallel trains."
          />
        </div>
      </div>

      {/* ── Realisation ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Realisation</div>
        <div className="ctrl-content">
          <Field
            label="Seed"
            hint="Same seed and same parameters always give the same sea. Change it to re-roll the wave arrangement without touching the physics."
          >
            <div className="ctrl-row">
              <input
                type="number"
                className="ctrl-input"
                value={seed}
                onChange={e => setSeed(Number(e.target.value) || 1)}
              />
              <button
                className="ctrl-btn-meta"
                onClick={() => setSeed(Math.floor(Math.random() * 1e8))}
                type="button"
              >Roll</button>
            </div>
          </Field>

          <Readout rows={[
            ['peak wavelength', `${peakLambda.toFixed(1)} m`],
            ['peak period',     `${Math.sqrt((2 * Math.PI * peakLambda) / 9.81).toFixed(1)} s`],
            ...(layers?.length
              ? [
                  ['rms wave height', `${Math.max(...layers.map(l => l.stats.rmsHeight)).toFixed(2)} m`],
                  ['last bake',       elapsed ? `${(elapsed / 1000).toFixed(1)} s` : '—'],
                ]
              : []),
          ]} />
        </div>
      </div>

    </div>
  );
}
