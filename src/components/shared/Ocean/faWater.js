/**
 * faWater.js — everything specific to Supreme Commander's water shader.
 *
 * The output contract, read off `effects/water2.fx:398-409`:
 *
 *     float4 sum = W0 + W1 + W2 + W3;
 *     float waveCrest = saturate( sum.a - waveCrestThreshold );
 *     float3 N = 2.0 * sum.xyz - 4.0;
 *     N = normalize(N.xzy);
 *
 * so per texture:  R → world X · G → world Z · B → world Y (up) · A → foam,
 * and the four textures are *summed before* normalising. Two consequences that
 * drive the whole design:
 *
 *  1. Since each layer's B is ≈ 1 and its R/G are small, |Σn| ≈ 4 and the
 *     normalise divides by it. The engine therefore renders the **mean** of the
 *     four slopes, not their sum — so a slot has to encode 4× its band's slope
 *     to contribute that band at full strength. See SUM_COMPENSATION.
 *
 *  2. `sum.a` is compared against waveCrestThreshold (default 1) *after*
 *     summing four alphas. One layer averaging 0.33 produces no foam at all.
 *     Slot foam means have to be budgeted together, not per texture.
 */

import { matchSeaToPeak } from './spectrum.js';

/** 5 km across 256 ogrids — the constant every FA distance conversion needs. */
export const OGRID_METRES = 5000 / 256;   // 19.53125

/** See point 1 above. Correct for a band split; see sumCompensation() otherwise. */
export const SUM_COMPENSATION = 4;

/**
 * How much a layer must exaggerate its slope so the engine's mean renders at
 * full strength — and it is not one number, because it depends on whether the
 * layers share wavelengths.
 *
 * The engine renders (1/4)·Σ slopeᵢ. For four *disjoint* bands each carrying
 * variance σ², that mean has std σ/2 while the true full spectrum would be 2σ:
 * a factor of 4.
 *
 * With the full spectrum in every layer the four are independent draws of the
 * same field, so the mean has std σ/2 against a true σ — a factor of 2. (The
 * layers sit at different tile sizes, so wavelengths only one of them reaches
 * are still attenuated by 4; ×2 is the right call for the overlapping middle
 * that dominates the look, and leaves the very finest chop reading a little
 * soft. Trim with Normal strength.)
 */
export function sumCompensation(bandMode) {
  return bandMode === 'independent' ? 2 : SUM_COMPENSATION;
}

/**
 * Vanilla FA `normalRepeatRate` and movement vectors (water2.fx:152-158).
 * A texture period covers 1/repeatRate ogrids.
 */
export const FA_DEFAULT_SLOTS = [
  { repeatRate: 0.0009, movement: [0.5,    -0.95   ] },
  { repeatRate: 0.009,  movement: [0.05,   -0.095  ] },
  { repeatRate: 0.05,   movement: [0.01,    0.03   ] },
  { repeatRate: 0.5,    movement: [0.0005,  0.0009 ] },
];

/**
 * The tool's recommended set.
 *
 * The vanilla tiles are 21.7 km / 2.17 km / 391 m / 39 m, while the peak
 * wavelength of a real wind sea is λ = 2πV²/g — about 10 m at moderate wind and
 * 40 m in a gale. Vanilla's two largest slots therefore sit entirely above any
 * wind-wave scale and can only ever carry near-flat noise.
 *
 * These four span 10 m to 1 km instead, which brackets ripples through long
 * swell, and every repeatRate is a round number for the editor field.
 */
/**
 * Editor scale 120 / 40 / 13 / 4  (tiles ≈ 2344 / 781 / 254 / 78 m).
 *
 * Tile size and wave size are two different things — a mistake earlier versions
 * of this preset conflated. In independent full-spectrum mode every layer
 * carries the whole spectrum, so the *wave density* is fixed by the sea's peak
 * wavelength (see DEFAULT_SEA), and the tile size sets only how often the
 * texture repeats. So the tiles should be as LARGE as the resolution allows, to
 * kill visible repetition, not small.
 *
 * The editor's Scale field is 1/repeatRate in ogrids. On a 1024-ogrid (20 km)
 * map: scale 20 repeats ~51×, which tiles obviously; scale 120 repeats ~8.5×,
 * which reads as open water. With high-resolution assets the big tile can go to
 * scale 100–150 without softening, because its fine detail comes from its own
 * resolution, not from being small.
 *
 * Layer 0 is the large, low-repetition base; each finer layer adds a shorter
 * band, down to layer 3 which carries the small ripples. The four together give
 * detail (fine layers) without repetition (coarse layer).
 */
export const RECOMMENDED_SLOTS = [
  { repeatRate: 1 / 120, movement: [0, 0] },   // scale 120 ≈ 2344 m — base, ~8.5 repeats / 20 km
  { repeatRate: 1 / 40,  movement: [0, 0] },   // scale  40 ≈  781 m
  { repeatRate: 1 / 13,  movement: [0, 0] },   // scale  13 ≈  254 m
  { repeatRate: 1 / 4,   movement: [0, 0] },   // scale   4 ≈   78 m — ripples
];

/**
/**
 * Per-layer scroll direction offset from the wind, by size rank (largest first).
 *
 * Real water is not one train of parallel waves: the dominant swell runs with
 * the wind, but shorter ripples arrive off-axis, and that spread is exactly what
 * breaks the artificial linearity of a single scroll direction. So the base
 * layer stays on the wind and each finer layer is fanned off it, alternating
 * side and widening. Multiplied by the angle-variation setting (radians).
 */
const ANGLE_FAN = [0, 1.0, -1.6, 2.3];

/**
 * Scroll vector for a slot.
 *
 * Two things were wrong before and both are fixed here:
 *
 *  · Magnitude. The old version used the physical phase speed c = √(g/k), which
 *    comes out an order of magnitude too large for the editor's Speed field.
 *    Empirically the editor wants roughly `flow · √scale` (scale = 1/repeatRate,
 *    the editor's own field): ~0.15 at scale 100, ~0.05 at scale 10. Same √scale
 *    shape as the physics — long-tile layers scroll faster — just calibrated to
 *    the editor's units. `flow` defaults to 0.015 to hit those anchors.
 *
 *  · Direction. All layers used to share the wind heading, so the four textures
 *    slid as one rigid sheet. Now each layer is fanned off the wind by ANGLE_FAN
 *    × angleSpread, so the scales cross and interfere like a real sea.
 *
 * Sign: the shader samples at `(pos + movement·Time)·repeatRate`, so the pattern
 * travels toward −movement; waves must run *with* the wind, hence the negation.
 *
 * @param {number} scaleOgrids  the layer's editor Scale = 1/repeatRate
 * @param {number} windDir      radians
 * @param {number} rank         size rank, 0 = largest tile
 * @param {object} [opts]       { flow = 0.015, angleSpread = 0 (radians) }
 */
export function deriveMovement(scaleOgrids, windDir, rank = 0, opts = {}) {
  const { flow = 0.015, angleSpread = 0 } = opts;
  const speed = flow * Math.sqrt(Math.max(0, scaleOgrids));
  const angle = windDir + angleSpread * (ANGLE_FAN[rank] ?? 0);
  return [-speed * Math.cos(angle), -speed * Math.sin(angle)];
}

/**
 * Engine wave textures, with the tile size their name declares.
 *
 * Useful for two things: they are the reference this generator is judged
 * against, and they are what a slot should fall back to when you only want to
 * replace some of the four. All of them carry alpha = 0, so any slot left on a
 * stock texture contributes nothing to `sum.a` — budget the foam across the
 * slots you actually generate.
 */
export const ENGINE_WAVE_TEXTURES = [
  { path: '/textures/engine/waves2_400m.dds', metres: 400 },
  { path: '/textures/engine/waves2_120m.dds', metres: 120 },
  { path: '/textures/engine/waves2_40m.dds',  metres: 40 },
  { path: '/textures/engine/waves1_40m.dds',  metres: 40 },
];

/** Closest stock texture to a given tile size — the sensible "keep vanilla" pick. */
export function nearestEngineTexture(metres) {
  return ENGINE_WAVE_TEXTURES.reduce((a, b) =>
    Math.abs(b.metres - metres) < Math.abs(a.metres - metres) ? b : a);
}

export const SLOT_PRESETS = [
  { id: 'recommended', label: 'Open water (scale 120 / 40 / 13 / 4)', slots: RECOMMENDED_SLOTS,
    hint: 'Large tiles so the texture rarely repeats — scale 120 tiles ~8× across a 20 km map vs ~50× at scale 20. Wave density comes from the sea\'s peak wavelength, not the tile size, so big tiles stay detailed. Layer 0 is the base, layer 3 the ripples.' },
  { id: 'engine', label: 'Engine-style (13 / 40 / 120 / 400 m)', slots: [
      { repeatRate: 0.04883, movement: [-1.27, -0.41] },
      { repeatRate: 0.16276, movement: [-0.70, -0.23] },
      { repeatRate: 0.48828, movement: [-0.40, -0.13] },
      { repeatRate: 1.46484, movement: [-0.23, -0.08] },
    ],
    hint: 'Matches the stock waves2_400m / _120m / _40m sizes. Only fills out under long swell (high fetch); under a normal sea the large slots sit on the dead spectral tail.' },
  { id: 'vanilla',     label: 'FA defaults', slots: FA_DEFAULT_SLOTS,
    hint: '39 m – 21.7 km. Matches stock maps; the two largest slots sit above any wave scale that exists.' },
];

export const MIN_LAYER_RES = 128;
export const MAX_LAYER_RES = 2048;

/**
 * Resolution a layer needs to hit a target world-space texel size.
 *
 * One global resolution is the wrong axis: texel size is tile ÷ resolution, so
 * at a shared 1024² the 400 m layer lands on 39 cm texels while the 13 m layer
 * gets 1.3 cm — thirty times finer than anything the camera can resolve, paid
 * for in memory and bake time, while the layer that actually needed the pixels
 * goes without. Sizing each layer to a constant texel instead spends the budget
 * where it shows.
 *
 * Rounded to a power of two: DDS mip chains want it, and it keeps the
 * supersampled simulation grid a clean multiple.
 */
export function resolutionForTile(metres, targetTexelMetres,
                                  min = MIN_LAYER_RES, max = MAX_LAYER_RES) {
  const ideal = metres / Math.max(1e-4, targetTexelMetres);
  const pow2 = Math.pow(2, Math.round(Math.log2(Math.max(1, ideal))));
  return Math.min(max, Math.max(min, pow2));
}

/**
 * Supersampling the simulation only buys anything if the spectrum reaches past
 * the output Nyquist — and the automatic detail floor is what puts it there or
 * not. With the floor at ≥ 2 texels the shortest wave present is already the
 * shortest the texture can store, so a supersampled grid has nothing left to
 * filter down.
 *
 * Measured at 400 m / 2048²: supersample 1 gives rms slope 0.2564 and mean alpha
 * 0.150 with zero unfilled texels; supersample 2 gives 0.2533 and 0.151 — for
 * 4.4× the time and 2.7× the memory. Below 2 texels the floor lets real content
 * through past Nyquist and supersampling starts to matter again.
 */
export function autoSupersample(detailFloorAuto, floorTexels) {
  if (!detailFloorAuto) return 2;
  return floorTexels >= 2 ? 1 : 2;
}

/**
 * Rough peak memory for one bake, in bytes. evaluateOcean holds eight Float32
 * output fields plus two Float64 spectra and two Float64 transform buffers over
 * the simulation grid; bake.js adds a Float32 Jacobian.
 */
export function estimateBakeBytes(resolution, supersample) {
  const n2 = (resolution * supersample) ** 2;
  return n2 * (8 * 4 + 2 * 8 + 2 * 4 + 4) + resolution * resolution * 5 * 4;
}

/** Texture period in metres for a given repeatRate. */
export const tileMetres = (repeatRate) => OGRID_METRES / repeatRate;

/** Texture period in ogrids — this is the editor's "Scale" field. */
export const tileOgrids = (repeatRate) => 1 / repeatRate;

export const BAND_MODES = [
  { id: 'independent', label: 'Full spectrum per layer',
    hint: 'Every layer is a complete ocean at its own tile size — the engine\'s own convention (waves2_40m / _120m / _400m) and what a Blender bake gives you. Each texture stands on its own.' },
  { id: 'matched', label: 'Band-matched seas',
    hint: 'Each layer carries one slice of the spectrum, with its own fetch so the slice is populated. Highest composite fidelity, but only if all four slots are wired up.' },
  { id: 'octave', label: 'Strict octave split',
    hint: 'One sea, split into four bands. Physically exact — layers above the sea\'s wavelength range come out flat.' },
];

/**
 * Resolve the four slots into bake jobs.
 *
 * `independent` (default) — full spectrum at every tile size, no windows. This
 * is the engine's own convention: its textures are named waves2_40m / _120m /
 * _400m, i.e. one sea baked over 40, 120 and 400 metre patches, each carrying
 * every wavelength down to its own Nyquist. Each texture is dense on its own and
 * stays usable if a mapper wires up only two of the four slots.
 *
 * `matched` — band windows, with each slot's fetch solved so the spectral peak
 * lands inside its band. No wavelength is carried twice, so the composite keeps
 * full slope where a split spectrum would otherwise average itself down in the
 * overlap. The cost: a single layer looks smooth in isolation, and the result
 * only adds up if all four slots are actually used.
 *
 * `octave` — the same windows against one unmodified sea. Strictly correct, with
 * one honest consequence: a wind sea peaks at λ = 2πV²/g and dies exponentially
 * below that, so any slot whose band sits well above the peak comes out flat.
 *
 * @param {Array}  slots      [{ repeatRate, movement }] — any order
 * @param {string} bandMode   'independent' | 'matched' | 'octave'
 * @param {number} seed
 * @param {object} sea        base sea state; slots may receive an override
 */
export function resolveSlotBands(slots, bandMode = 'independent', seed = 1, sea = null) {
  const withMetres = slots.map((s, i) => ({
    index: i,
    repeatRate: s.repeatRate,
    movement: s.movement,
    L: tileMetres(s.repeatRate),
  }));

  // Bands are assigned by physical size, not by slot order, so the result does
  // not silently change if someone reorders the repeatRate fields.
  const bySize = [...withMetres].sort((a, b) => b.L - a.L);

  bySize.forEach((s, rank) => {
    s.rank = rank;                     // 0 = largest tile — indexes FOAM_WEIGHT_BY_RANK
    if (bandMode === 'independent') {
      s.kLo = 0;
      s.kHi = Infinity;
    } else {
      const next = bySize[rank + 1];
      // Slot of tile L carries wavelengths [L_next, L] → k ∈ [2π/L, 2π/L_next].
      // The largest slot's low edge is its own fundamental, so nothing to cut.
      // Band i's high edge equals band i+1's low edge, which is what lets the
      // power-complementary windows in ocean.js sum back to unity.
      s.kLo = rank === 0 ? 0 : (2 * Math.PI) / s.L;
      s.kHi = next ? (2 * Math.PI) / next.L : Infinity;
    }
    // The wavenumber a matched sea should peak at: the geometric centre of the
    // band. The open ends fall back to the tile fundamental / two octaves up.
    const kLoEff = s.kLo > 0 ? s.kLo : (2 * Math.PI) / s.L;
    const kHiEff = Number.isFinite(s.kHi) ? s.kHi : kLoEff * 4;
    s.kPeak = Math.sqrt(kLoEff * kHiEff);

    s.sea = sea
      ? (bandMode === 'matched' ? matchSeaToPeak(sea, s.kPeak) : sea)
      : null;
    s.derivedMovement = sea
      ? deriveMovement(1 / s.repeatRate, sea.windDir, s.rank, {
          flow: sea.flowSpeed ?? 0.015,
          angleSpread: ((sea.angleSpreadDeg ?? 0) * Math.PI) / 180,
        })
      : null;

    // Each slot gets its own realisation: they are scrolled at different speeds
    // and directions in-game, so shared randomness would buy nothing.
    s.seed = (seed * 7919 + s.index * 104729) >>> 0;
  });

  return withMetres.map(s => bySize.find(b => b.index === s.index));
}

/**
 * Reference implementation of the shader's normal reconstruction.
 * Used by the preview so that what the user judges is the real composite, not
 * one texture in isolation.
 *
 * @param {Array} samples four {r,g,b,a} in 0…1
 * @returns {{ normal: number[], waveCrest: number }}
 */
export function reconstructWaterNormal(samples, waveCrestThreshold = 1) {
  let sr = 0, sg = 0, sb = 0, sa = 0;
  for (const s of samples) { sr += s.r; sg += s.g; sb += s.b; sa += s.a; }

  // N = 2·sum.xyz − 4, then swizzled .xzy → world = (Nx, Nz, Ny)
  const x = 2 * sr - 4;
  const y = 2 * sb - 4;   // B is the up component after the swizzle
  const z = 2 * sg - 4;

  const inv = 1 / Math.max(1e-8, Math.hypot(x, y, z));
  return {
    normal: [x * inv, y * inv, z * inv],
    waveCrest: Math.max(0, Math.min(1, sa - waveCrestThreshold)),
  };
}

/**
 * Default foam weight per slot, by size rank (largest tile first).
 *
 * Whitecaps are a small-scale phenomenon. A det(J) mask computed on a 1 km tile
 * is a perfectly valid breaking-wave mask for 1 km waves — but rendered over a
 * 100 m view it is a slow, soft blob that swamps `sum.a` and turns the water
 * into white patches. So the large slots contribute only their very steepest
 * parts, and the fine slots carry the actual foam.
 *
 * These are starting values, not a law: the tab exposes a weight per layer,
 * because "which scales are allowed to break" is a composition decision. Setting
 * the long layers to 0 and letting only the chop break is both the physically
 * honest arrangement for a swell-dominated sea and the one that reads as
 * deliberate rather than as weather.
 */
export const FOAM_WEIGHT_BY_RANK = [0.15, 0.45, 0.85, 1.0];

/**
 * Solve the waveCrestThreshold that yields `targetCoverage` of foam in-game.
 *
 * The engine computes `saturate(sum.a − waveCrestThreshold)` over four summed
 * alphas, so the usable threshold depends entirely on how the four maps were
 * baked. Rather than making the user guess (the stock default of 1 is
 * unreachable for any realistic alpha budget), sample the actual composite and
 * read the quantile off it.
 *
 * @param {Array} slots  [{ rgba, width, repeatRate }]
 * @returns {{ threshold: number, meanSum: number, maxSum: number }}
 */
export function recommendWaveCrestThreshold(slots, targetCoverage = 0.06, samples = 120000) {
  // A pseudo-random sweep rather than a grid: the four tile sizes are
  // incommensurate, so a grid would alias against one of them.
  let s = 0x2545f491;
  const rand = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };

  const sums = new Float32Array(samples);
  let total = 0, max = 0;
  const patchOgrids = 4000;

  for (let i = 0; i < samples; i++) {
    const X = rand() * patchOgrids;
    const Z = rand() * patchOgrids;
    let a = 0;
    for (const sl of slots) {
      const M = sl.width;
      const u = X * sl.repeatRate, v = Z * sl.repeatRate;
      const px = ((Math.floor(u * M) % M) + M) % M;
      const py = ((Math.floor(v * M) % M) + M) % M;
      a += sl.rgba[(py * M + px) * 4 + 3] / 255;
    }
    sums[i] = a;
    total += a;
    if (a > max) max = a;
  }

  const sorted = sums.slice().sort();
  const idx = Math.min(samples - 1,
    Math.max(0, Math.floor((1 - Math.min(0.99, Math.max(0.001, targetCoverage))) * samples)));

  return {
    threshold: sorted[idx],
    meanSum: total / samples,
    maxSum: max,
  };
}

/** Editor-facing values for one slot: what to type into the map's water settings. */
export function editorValues(slot) {
  const [mx, mz] = slot.movement;
  const speed = Math.hypot(mx, mz);
  // water2.fx applies movement = Speed × (−sin θ, cos θ), θ in degrees.
  const angle = (Math.atan2(-mx, mz) * 180) / Math.PI;
  return {
    scale: tileOgrids(slot.repeatRate),
    speed,
    angle: ((angle % 360) + 360) % 360,
  };
}
