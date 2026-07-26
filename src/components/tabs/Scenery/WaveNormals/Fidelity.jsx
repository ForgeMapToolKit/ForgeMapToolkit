import React from 'react';
import { tileMetres } from '../../../Shared/Ocean/faWater.js';
import { Slider, Select, Toggle, Options, Readout } from './Fields.jsx';

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
 * Section 04 — how finely the bake is computed.
 *
 * These are cost settings, not look settings, and both of their auto modes are on
 * by default — which is why the step sits this late even though the detail floor
 * does feed back into the foam. Sequenced by consequence, it would come before
 * Foam; sequenced by how often anyone touches it, here.
 */
export default function WaveFidelity({
  resMode, setResMode, targetTexel, setTargetTexel, resolution, setResolution,
  ssAuto, setSsAuto, supersample, setSupersample, effectiveSS = 1,
  floorAuto, setFloorAuto, floorTexels, setFloorTexels, floorManual, setFloorManual,
  rates = [], layerRes = [], bakeBudget = { peakMB: 0, textureMB: 0, supersample: 1 },
  layers,
}) {
  return (
    <div className="ctrl-col">

      {/* ── Resolution ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Resolution</div>
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
        </div>
      </div>

      {/* ── Sampling ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Sampling</div>
        <div className="ctrl-content">
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
        </div>
      </div>

    </div>
  );
}
