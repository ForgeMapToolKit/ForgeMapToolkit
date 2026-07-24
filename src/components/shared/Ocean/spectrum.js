/**
 * spectrum.js — ocean wave spectra and dispersion.
 *
 * Everything here answers one question: given a wave vector k⃗, how much energy
 * does a real sea carry there? That is the whole difference between this and a
 * noise texture — noise is flat or an invented 1/k^β, a sea is measured.
 *
 * Four radial models, one shared directional spreading function:
 *
 *   phillips  Tessendorf's classic. Already a 2D density (the 1/k⁴ tail is the
 *             measured energy falloff of wind-driven water).
 *   pm        Pierson-Moskowitz — a fully developed sea, i.e. wind has blown
 *             long enough over enough water that the spectrum stopped growing.
 *   jonswap   Fetch-limited. Same shape as PM with a sharpened peak (γ) —
 *             what you get near a coast, on a lake, in a bay.
 *   tma       JONSWAP × Kitaigorodskii depth attenuation, plus finite-depth
 *             dispersion. The shallow-water case.
 *
 * The ω-based models (pm/jonswap/tma) are 1D frequency spectra S(ω) [m²·s] and
 * are converted to a 2D wavenumber density [m⁴] by
 *
 *     Ψ(k⃗) = S(ω) · D(θ) · (1/k) · dω/dk
 *
 * Dimension check: m²s · 1 · m · m/s = m⁴. ✓
 */

export const G = 9.81;

export const SPECTRUM_MODELS = [
  { id: 'phillips', label: 'Phillips',            hint: 'Tessendorf classic — broad, general-purpose open water.' },
  { id: 'pm',       label: 'Pierson-Moskowitz',   hint: 'Fully developed sea. Wind has blown long enough to saturate.' },
  { id: 'jonswap',  label: 'JONSWAP',             hint: 'Fetch-limited, sharpened peak. Coastal, bays, lakes.' },
  { id: 'tma',      label: 'TMA (shallow)',       hint: 'JONSWAP with depth attenuation. Shelf and shore water.' },
];

/**
 * exp(−k²l²) reaches half power at k·l = 0.8326, i.e. at a wavelength of
 * 2π·l/0.8326 = 7.546·l. The damping parameter and the wavelength it actually
 * bites at are therefore an order of magnitude apart — which made the old
 * `cutoff` field quietly lie: 0.12 "metres" wiped out everything below ~0.9 m,
 * three octaves of visible micro-detail. The sea state now carries the
 * wavelength, and the conversion happens here.
 */
export const DETAIL_FLOOR_TO_L = 1 / 7.546;

/**
 * Phillips is a bare power law with a free amplitude; the ω-based models carry
 * calibrated constants (α ≈ 0.0081…0.076). Left at 1.0 the two families differ
 * by three orders of magnitude — Phillips came out at rms slope 18 where JONSWAP
 * gave 0.5. This constant puts them on the same footing so `amplitude` means the
 * same thing whichever model is selected.
 */
const PHILLIPS_A = 8e-4;

export const DEFAULT_SEA = {
  model:       'jonswap',
  // Peak wavelength λ = 2πV²/g ≈ 14 m — a lively, detailed wind sea rather than
  // long swell. Density comes from the peak being short, and the recommended
  // tiles (5–160 m) bracket it. Reaching for a longer sea is the standard way
  // the water ends up looking empty; start here and only lengthen deliberately.
  windSpeed:   4.7,    // m/s at 10 m height
  windDir:     0.6,    // radians, 0 = +X
  fetch:       14000,  // m — distance the wind has blown over open water
  gamma:       3.3,    // JONSWAP peak enhancement
  depth:       40,     // m — used by tma and by the dispersion relation
  deepWater:   true,   // ignore depth in the dispersion relation
  spread:      9,      // directional exponent s in cos^{2s}(Δθ/2)
  detailFloor: 0.10,   // m — wavelength at which small-wave damping halves the energy
  amplitude:   1.0,    // global gain on the spectrum (energy, not slope)
  // Water motion (affects only the exported scroll vectors, not the baked normals)
  flowSpeed:      0.015, // editor Speed ≈ flowSpeed·√scale — 0.15 at scale 100, 0.05 at 10
  angleSpreadDeg: 18,    // per-layer scroll heading fan, so the scales cross like real water
};

// ─── Dispersion ───────────────────────────────────────────────────────────────

/** Angular frequency ω(k). Deep water unless a finite depth is given. */
export function dispersion(k, depth, deepWater) {
  if (k <= 0) return 0;
  if (deepWater || !depth || depth <= 0) return Math.sqrt(G * k);
  return Math.sqrt(G * k * Math.tanh(k * depth));
}

/** dω/dk — the group-velocity factor needed for the S(ω) → Ψ(k⃗) conversion. */
export function dispersionDerivative(k, depth, deepWater) {
  if (k <= 0) return 0;
  if (deepWater || !depth || depth <= 0) {
    return 0.5 * Math.sqrt(G / k);
  }
  const kd    = k * depth;
  const t     = Math.tanh(kd);
  const sech2 = 1 - t * t;
  const omega = Math.sqrt(G * k * t);
  if (omega <= 0) return 0;
  return (G * (t + kd * sech2)) / (2 * omega);
}

// ─── Radial spectra ───────────────────────────────────────────────────────────

/** Phillips — already a 2D wavenumber density, no conversion needed. */
function phillipsRadial(k, sea) {
  const L = (sea.windSpeed * sea.windSpeed) / G;   // peak wavelength scale
  const kL = k * L;
  if (kL <= 0) return 0;
  return (PHILLIPS_A * sea.amplitude * Math.exp(-1 / (kL * kL))) / (k * k * k * k);
}

/**
 * JONSWAP S(ω). With γ = 1 and the PM α/ωp this reduces exactly to
 * Pierson-Moskowitz, so `pm` is routed through the same function.
 */
function jonswapS(omega, sea, { pm = false } = {}) {
  if (omega <= 0) return 0;

  let alpha, omegaP;
  if (pm) {
    alpha  = 0.0081;
    omegaP = (0.8776 * G) / sea.windSpeed;
  } else {
    const F = Math.max(sea.fetch, 1);
    alpha  = 0.076 * Math.pow((sea.windSpeed * sea.windSpeed) / (F * G), 0.22);
    omegaP = 22 * Math.pow((G * G) / (sea.windSpeed * F), 1 / 3);
  }

  const base = ((alpha * G * G) / Math.pow(omega, 5)) *
               Math.exp(-1.25 * Math.pow(omegaP / omega, 4));

  if (pm) return base * sea.amplitude;

  const sigma = omega <= omegaP ? 0.07 : 0.09;
  const d     = (omega - omegaP) / (sigma * omegaP);
  const r     = Math.exp(-0.5 * d * d);
  return base * Math.pow(sea.gamma, r) * sea.amplitude;
}

/** Kitaigorodskii depth function — the TMA correction to JONSWAP. */
function kitaigorodskii(omega, depth) {
  const wh = omega * Math.sqrt(depth / G);
  if (wh <= 1) return 0.5 * wh * wh;
  if (wh >= 2) return 1;
  const t = 2 - wh;
  return 1 - 0.5 * t * t;
}

// ─── Directional spreading ────────────────────────────────────────────────────

/**
 * cos^{2s}((θ − θw)/2), normalised so ∫D dθ = 1.
 *
 * Normalisation is done numerically rather than through the closed-form
 * Γ-function ratio: it is exact for whatever s the user dials in, including
 * non-integer values, and costs one 4096-sample loop at setup.
 */
export function makeSpreading(sea) {
  const s = Math.max(0.05, sea.spread);
  const STEPS = 4096;
  let sum = 0;
  for (let i = 0; i < STEPS; i++) {
    const th = -Math.PI + (2 * Math.PI * (i + 0.5)) / STEPS;
    sum += Math.pow(Math.max(0, Math.cos(th / 2)), 2 * s);
  }
  const norm = 1 / ((sum * 2 * Math.PI) / STEPS);

  return (theta) => {
    let d = theta - sea.windDir;
    while (d >  Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    // cos(±π/2 … ±π) is negative → clamped to 0: no energy travelling into
    // the wind. This is why no separate "against wind" damping factor is needed.
    return norm * Math.pow(Math.max(0, Math.cos(d / 2)), 2 * s);
  };
}

// ─── The 2D spectrum ──────────────────────────────────────────────────────────

/**
 * Returns Ψ(kx, kz) [m⁴] — the 2D wavenumber density for the configured sea.
 * Callers multiply by Δkx·Δkz and take the square root to get an amplitude.
 */
export function makeSpectrum(sea) {
  const spreading = makeSpreading(sea);
  const l         = Math.max(0, sea.detailFloor ?? 0) * DETAIL_FLOOR_TO_L;
  const cutoff2   = l * l;
  const deep      = !!sea.deepWater;
  const depth     = sea.depth;

  return (kx, kz) => {
    const k2 = kx * kx + kz * kz;
    if (k2 <= 0) return 0;
    const k = Math.sqrt(k2);

    let radial;
    if (sea.model === 'phillips') {
      radial = phillipsRadial(k, sea);
    } else {
      const omega = dispersion(k, depth, deep);
      if (omega <= 0) return 0;
      const dwdk = dispersionDerivative(k, depth, deep);

      let S;
      if (sea.model === 'pm')      S = jonswapS(omega, sea, { pm: true });
      else if (sea.model === 'tma') S = jonswapS(omega, sea) * kitaigorodskii(omega, depth);
      else                          S = jonswapS(omega, sea);

      radial = (S * dwdk) / k;
    }

    if (!(radial > 0)) return 0;

    // Suppress waves the texture cannot resolve. This should sit just above the
    // output Nyquist and nowhere near the wavelengths that carry visible detail:
    // the ocean tail is ~k⁻⁴, whose *slope* variance (∝ k²Ψ·k dk) is flat per
    // octave, so every octave the damping eats is an equal share of the texture's
    // apparent sharpness. See the auto detail floor in bakeWorker.js.
    const damp = Math.exp(-k2 * cutoff2);

    return radial * damp * spreading(Math.atan2(kz, kx));
  };
}

/**
 * Wind speed whose spectral peak lands at wavenumber `kPeak`.
 *
 * The inverse of peakWavelength(). FA stacks four normal layers across scales
 * that span two or three decades, while a real wind sea only spans about one —
 * so a single spectrum leaves the largest layers empty. This lets each layer be
 * given a sea whose peak sits inside its own band, which is also what an ocean
 * physically has: local wind sea at the small scales, swell from elsewhere at
 * the large ones.
 */
export function matchSeaToPeak(sea, kPeak) {
  if (!(kPeak > 0)) return sea;

  if (sea.model === 'phillips') {
    // λpeak = 2πV²/g  ⟹  V = √(g/k)
    return { ...sea, windSpeed: clampWind(Math.sqrt(G / kPeak)) };
  }

  const omegaP = Math.sqrt(G * kPeak);

  if (sea.model === 'pm') {
    // ωp = 0.8776·g/V — a fully developed sea has no fetch to turn
    return { ...sea, windSpeed: clampWind((0.8776 * G) / omegaP) };
  }

  // jonswap / tma: ωp = 22·(g²/(V·F))^⅓. Solving for fetch rather than wind is
  // the physical choice — 400 m swell at 9 m/s means the wind blew across an
  // ocean, not that it blew at 700 m/s. Fetch is what actually differs between
  // a distant swell and local chop.
  const F = (Math.pow(22, 3) * G * G) / (sea.windSpeed * Math.pow(omegaP, 3));
  return { ...sea, fetch: Math.min(3e6, Math.max(100, F)) };
}

const clampWind = (v) => Math.min(60, Math.max(0.5, v));

/**
 * Peak wavelength of the configured sea, in metres. Used by the UI to tell the
 * user whether their tile sizes can actually hold the waves they asked for.
 */
export function peakWavelength(sea) {
  if (sea.model === 'phillips') {
    return (2 * Math.PI * sea.windSpeed * sea.windSpeed) / G;
  }
  let omegaP;
  if (sea.model === 'pm') {
    omegaP = (0.8776 * G) / sea.windSpeed;
  } else {
    const F = Math.max(sea.fetch, 1);
    omegaP = 22 * Math.pow((G * G) / (sea.windSpeed * F), 1 / 3);
  }
  // deep-water k from ω, then λ = 2π/k
  const k = (omegaP * omegaP) / G;
  return (2 * Math.PI) / k;
}
