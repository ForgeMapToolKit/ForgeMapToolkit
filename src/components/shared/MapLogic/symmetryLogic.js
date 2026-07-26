// ─── Symmetry maths — pure, renderer-side ────────────────────────────────────
//
// Everything the Symmetry Checker judges. The main process (electron/modules/
// symmetry.js) reads the map once and hands over raw grids and flat entity
// lists; this module decides what "mirrored" means and by how much a map misses.
//
// Two kinds of check, because a map stores its mirror in two shapes:
//
//   GRID    A regular field of samples (heightmap, terrainType, water masks,
//           stratum masks). Symmetry = sample i equals the sample at its
//           mirrored index. Deviation is measured per sample.
//   ENTITY  Discrete placed things (props, decals, markers, units). Symmetry =
//           every entity has a partner of the same kind at its mirrored world
//           position. Deviation is a missing or displaced partner.
//
// Nothing here touches IPC, React or the DOM.

// ── Mirror modes ──────────────────────────────────────────────────────────────
// `vertical`/`horizontal` name the axis the map folds *across*, matching how
// mappers speak: a vertical axis mirrors left↔right.
//
// Note on naming: the placement tabs' MirrorDropdown calls the 180° point mirror
// "Diagonal". Here the two true diagonal-axis mirrors also exist, so the point
// mirror is called what it is (`point`) and `diag-main`/`diag-anti` are the real
// diagonals. `basis` lists the elementary mirrors a mode is built from — `quad`
// is not a single reflection but the requirement that two of them both hold.

export const SYMMETRY_MODES = [
  { id: 'vertical',   label: 'Vertical  │  left ↔ right',   short: 'Vertical',   basis: ['vertical'] },
  { id: 'horizontal', label: 'Horizontal  ─  top ↔ bottom', short: 'Horizontal', basis: ['horizontal'] },
  { id: 'point',      label: 'Point  ⟳  180° rotation',     short: 'Point 180°', basis: ['point'] },
  { id: 'diag-main',  label: 'Diagonal ╲  NW ↔ SE',         short: 'Diagonal ╲', basis: ['diag-main'] },
  { id: 'diag-anti',  label: 'Diagonal ╱  NE ↔ SW',         short: 'Diagonal ╱', basis: ['diag-anti'] },
  { id: 'quad',       label: 'Quad  ✚  both axes',          short: 'Quad',       basis: ['vertical', 'horizontal'] },
];

export const SYMMETRY_MODE_OPTIONS = SYMMETRY_MODES.map(m => ({ value: m.id, label: m.label }));

export const symmetryModeById = (id) => SYMMETRY_MODES.find(m => m.id === id) || SYMMETRY_MODES[0];

/** The elementary reflections a mode requires. `quad` needs both to hold. */
export const symmetryBasis = (id) => symmetryModeById(id).basis;

// ── Grid index mirroring ──────────────────────────────────────────────────────
// A grid of n samples per side. For cell grids (terrainType, masks) n is even
// and the fold sits on the boundary between sample n/2-1 and n/2, so the partner
// of i is n-1-i. For the heightmap n is odd (size+1 samples) and the same
// formula puts the fold on the true centre sample, which maps to itself. Both
// cases are therefore handled by the one expression — no special-casing.

const mirrorIndex = (basis, i, j, n) => {
  switch (basis) {
    case 'vertical':   return [n - 1 - i, j];
    case 'horizontal': return [i, n - 1 - j];
    case 'point':      return [n - 1 - i, n - 1 - j];
    case 'diag-main':  return [j, i];
    case 'diag-anti':  return [n - 1 - j, n - 1 - i];
    default:           return [i, j];
  }
};

// ── World-space mirroring ─────────────────────────────────────────────────────
// Entity coordinates are in map units over [0, size]. `axis` is the extent the
// fold is measured against: pass the full map size for a plain centre mirror, or
// {lo, hi} of the playable rectangle when the playable area is inset and the
// mirror axis follows it.

/**
 * Mirror a world position for one elementary reflection.
 * @param {string} basis  'vertical' | 'horizontal' | 'point' | 'diag-main' | 'diag-anti'
 * @param {number} x
 * @param {number} z
 * @param {{loX:number, hiX:number, loZ:number, hiZ:number}} box mirror extent
 */
export function mirrorPoint(basis, x, z, box) {
  const { loX, hiX, loZ, hiZ } = box;
  const fx = loX + hiX;   // x + x' = fx  on a vertical fold
  const fz = loZ + hiZ;
  switch (basis) {
    case 'vertical':   return [fx - x, z];
    case 'horizontal': return [x, fz - z];
    case 'point':      return [fx - x, fz - z];
    // The diagonals swap the axes, so they only mean anything on a square
    // extent — which every FA map is.
    // ╲ runs (loX,loZ)→(hiX,hiZ);  ╱ runs (loX,hiZ)→(hiX,loZ).
    case 'diag-main':  return [loX + (z - loZ), loZ + (x - loX)];
    case 'diag-anti':  return [loX + (hiZ - z), loZ + (hiX - x)];
    default:           return [x, z];
  }
}

/** The mirror extent for a map: the whole grid, or the playable rectangle. */
export function mirrorBox({ size, playable, usePlayable }) {
  if (usePlayable && playable) {
    return { loX: playable.x1, hiX: playable.x2, loZ: playable.y1, hiZ: playable.y2 };
  }
  return { loX: 0, hiX: size, loZ: 0, hiZ: size };
}

// ── Grid comparison ───────────────────────────────────────────────────────────

/**
 * Compare one grid against its own mirror.
 *
 * @param {object} o
 * @param {Uint8Array|Uint16Array|Int32Array} o.values  n×n samples, row-major
 * @param {number}   o.n          samples per side
 * @param {string}   o.mode       symmetry mode id
 * @param {number}   [o.tolerance] deviation in raw sample units still counted as equal
 * @param {number}   [o.channels]  interleaved channels per sample (masks: 4)
 * @param {number}   [o.errorSize] side length of the returned error field
 * @param {number}   [o.step]      sample every step-th cell (auto-detect scan)
 * @returns {{compared:number, mismatched:number, maxDelta:number, meanDelta:number,
 *            rms:number, ratio:number, error:Float32Array|null, errorSize:number,
 *            worst:Array<{x:number,z:number,a:number,b:number,delta:number}>}}
 */
export function compareGrid({
  values, n, mode, tolerance = 0, channels = 1,
  errorSize = 0, step = 1,
}) {
  const bases = symmetryBasis(mode);
  const es = errorSize > 0 ? Math.min(errorSize, n) : 0;
  const error = es ? new Float32Array(es * es) : null;

  let compared = 0, mismatched = 0, maxDelta = 0, sum = 0, sumSq = 0;

  // Top-12 offenders, kept sorted descending by insertion so the list is the
  // real worst cases and not just the first ones encountered.
  const WORST_N = 12;
  const worst = [];
  const keepWorst = (entry) => {
    if (worst.length === WORST_N && entry.delta <= worst[WORST_N - 1].delta) return;
    let at = worst.length;
    while (at > 0 && worst[at - 1].delta < entry.delta) at--;
    worst.splice(at, 0, entry);
    if (worst.length > WORST_N) worst.length = WORST_N;
  };

  const at = (i, j, c) => values[(j * n + i) * channels + c];

  for (let j = 0; j < n; j += step) {
    for (let i = 0; i < n; i += step) {
      // Largest deviation over every required reflection and every channel.
      let delta = 0;
      for (const basis of bases) {
        const [mi, mj] = mirrorIndex(basis, i, j, n);
        for (let c = 0; c < channels; c++) {
          const d = Math.abs(at(i, j, c) - at(mi, mj, c));
          if (d > delta) delta = d;
        }
      }
      compared++;
      const off = delta > tolerance;
      if (off) {
        mismatched++;
        sum += delta;
        sumSq += delta * delta;
        if (delta > maxDelta) maxDelta = delta;
        const [mi, mj] = mirrorIndex(bases[0], i, j, n);
        keepWorst({ x: i, z: j, a: at(i, j, 0), b: at(mi, mj, 0), delta });
      }
      if (error && delta > 0) {
        const ei = ((i / n) * es) | 0;
        const ej = ((j / n) * es) | 0;
        const p = ej * es + ei;
        if (delta > error[p]) error[p] = delta;
      }
    }
  }

  return {
    compared,
    mismatched,
    maxDelta,
    meanDelta: mismatched ? sum / mismatched : 0,
    rms: compared ? Math.sqrt(sumSq / compared) : 0,
    ratio: compared ? mismatched / compared : 0,
    error,
    errorSize: es,
    worst,
  };
}

/** Read a raw 16-bit little-endian heightmap into a Uint16Array view. */
export function heightmapView(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // The scmap heightmap is LE 16-bit; a plain typed-array view only works on an
  // even byte offset, so copy when the buffer hands us an odd one.
  if (u8.byteOffset % 2 === 0) {
    return new Uint16Array(u8.buffer, u8.byteOffset, u8.byteLength >> 1);
  }
  return new Uint16Array(u8.slice().buffer);
}

// ── Entity comparison ─────────────────────────────────────────────────────────

/**
 * A bucket grid over the entity list, keyed by kind. A 20 km map carries tens of
 * thousands of props, so partner lookup must not be an O(n²) scan.
 */
function buildIndex(items, keys, cell) {
  const buckets = new Map();
  for (let i = 0; i < items.length; i++) {
    const p = items[i].position;
    const bk = `${keys[i]}|${Math.floor(p[0] / cell)}|${Math.floor(p[2] / cell)}`;
    if (!buckets.has(bk)) buckets.set(bk, []);
    buckets.get(bk).push(i);
  }
  return buckets;
}

/**
 * Match every entity against one elementary reflection.
 *
 * A single reflection is an involution — the partner of an entity's partner is
 * the entity itself — so partners can safely be *consumed*: two props on one
 * side and one on the other then correctly leaves one unmatched instead of both
 * claiming the same partner. This is why a `quad` map is matched per axis rather
 * than in one pass over all its reflections: on one axis a 4-group is two clean
 * pairs, whereas a combined pass would consume partners the second axis needs.
 */
function matchBasis({ items, keys, basis, box, tolerance, yTolerance, buckets, cell }) {
  const n = items.length;
  const taken = new Uint8Array(n);
  const partner = new Int32Array(n).fill(-1);   // -1 unmatched, -2 on the axis
  const dists = new Float64Array(n);

  const nearest = (k, tx, tz, ty, self) => {
    let best = -1, bestD = Infinity;
    const cx = Math.floor(tx / cell), cz = Math.floor(tz / cell);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = buckets.get(`${k}|${cx + dx}|${cz + dz}`);
        if (!list) continue;
        for (const idx of list) {
          if (taken[idx] || idx === self) continue;
          const p = items[idx].position;
          const d = Math.hypot(p[0] - tx, p[2] - tz);
          if (d > tolerance || d >= bestD) continue;
          if (yTolerance >= 0 && Math.abs(p[1] - ty) > yTolerance) continue;
          best = idx; bestD = d;
        }
      }
    }
    return { idx: best, dist: bestD };
  };

  for (let i = 0; i < n; i++) {
    if (taken[i]) continue;
    const [x, y, z] = items[i].position;
    const [tx, tz] = mirrorPoint(basis, x, z, box);

    // An entity standing on this mirror axis is its own partner — correct, not
    // a defect, and the single most common false positive if not handled.
    if (Math.hypot(tx - x, tz - z) <= tolerance) {
      taken[i] = 1;
      partner[i] = -2;
      continue;
    }

    const hit = nearest(keys[i], tx, tz, y, i);
    taken[i] = 1;
    if (hit.idx < 0) continue;                  // stays -1: unmatched
    taken[hit.idx] = 1;
    partner[i] = hit.idx;
    partner[hit.idx] = i;
    dists[i] = hit.dist;
    dists[hit.idx] = hit.dist;
  }

  return { partner, dists };
}

/**
 * Pair every entity with its mirror partner(s).
 *
 * @param {object} o
 * @param {Array}  o.items       [{ position:[x,y,z], … }]
 * @param {string} o.mode        symmetry mode id
 * @param {object} o.box         from mirrorBox()
 * @param {number} [o.tolerance] world units a partner may be off by
 * @param {number} [o.yTolerance] height difference still accepted (-1 = ignore y)
 * @param {Function} o.keyOf     item → kind key; only same-key items pair
 * @param {Function} [o.labelOf] item → display label for findings
 * @returns {{total:number, matched:number, selfPaired:number, maxOffset:number,
 *            unpaired:Array, ratio:number}}
 */
export function pairEntities({
  items, mode, box, tolerance = 0.5, yTolerance = -1, keyOf, labelOf = () => '',
}) {
  const bases = symmetryBasis(mode);
  const n = items.length;
  const keys = new Array(n);
  for (let i = 0; i < n; i++) keys[i] = keyOf(items[i]);

  const cell = Math.max(tolerance * 2, 4);
  const buckets = buildIndex(items, keys, cell);

  const runs = bases.map(basis => ({
    basis,
    ...matchBasis({ items, keys, basis, box, tolerance, yTolerance, buckets, cell }),
  }));

  const unpaired = [];
  let selfPaired = 0, matched = 0, maxOffset = 0;

  for (let i = 0; i < n; i++) {
    // An entity is symmetric only if EVERY required reflection found it a
    // partner (or put it on that reflection's axis).
    const failed = runs.find(r => r.partner[i] === -1);
    if (failed) {
      const [x, , z] = items[i].position;
      const [tx, tz] = mirrorPoint(failed.basis, x, z, box);
      unpaired.push({
        index: i,
        label: labelOf(items[i]),
        kind: keys[i],
        position: items[i].position,
        expected: { x: tx, z: tz, basis: failed.basis },
      });
      continue;
    }
    matched++;
    if (runs.every(r => r.partner[i] === -2)) selfPaired++;
    for (const r of runs) if (r.dists[i] > maxOffset) maxOffset = r.dists[i];
  }

  return {
    total: n,
    matched,
    selfPaired,
    maxOffset,
    unpaired,
    ratio: n ? unpaired.length / n : 0,
  };
}

// ── Verdicts ──────────────────────────────────────────────────────────────────

/**
 * A layer's verdict. `pass` means every compared sample/entity matched inside the
 * tolerance. `near` is the rounding-level band: a handful of samples off, which
 * on a hand-mirrored map is normal and invisible in game. Anything above that is
 * a real break.
 */
export const SYMMETRY_NEAR_RATIO = 0.001;   // ≤ 0.1 % of samples off → near-symmetric

export function symmetryVerdict({ compared, mismatched }) {
  if (!compared) return 'skip';
  if (!mismatched) return 'pass';
  return (mismatched / compared) <= SYMMETRY_NEAR_RATIO ? 'near' : 'fail';
}

export const SYMMETRY_VERDICT_LABEL = { pass: 'Symmetric', near: 'Near-symmetric', fail: 'Asymmetric', skip: 'Not checked' };

/**
 * Score one mode across the layers that carry the most signal, for auto-detect.
 * Higher is better; 1 = every compared sample matched. The heightmap dominates
 * because it is the layer a mapper mirrors first and the one the engine reads
 * for terrain — a map that is heightmap-symmetric but prop-asymmetric still has
 * that symmetry, and saying so is the point of the checker.
 */
export function scoreSymmetryMode({ heightRatio, terrainRatio, propRatio }) {
  const parts = [
    [heightRatio, 0.7],
    [terrainRatio, 0.2],
    [propRatio, 0.1],
  ].filter(([r]) => r != null && Number.isFinite(r));
  const wsum = parts.reduce((a, [, w]) => a + w, 0);
  if (!wsum) return 0;
  return parts.reduce((a, [r, w]) => a + (1 - Math.min(1, r)) * w, 0) / wsum;
}

// ── Report ────────────────────────────────────────────────────────────────────

const pct = (v) => `${(v * 100).toFixed(v < 0.01 && v > 0 ? 3 : 2)}%`;

/** Render a finished run as a plain-text report. */
export function buildSymmetryReport({ mapName, meta, mode, tolerance, findings, detected }) {
  const L = [];
  L.push('ForgeMapToolkit — Symmetry Report');
  L.push('='.repeat(52));
  L.push(`Map            ${mapName}`);
  if (meta?.scmapName) L.push(`SCMAP          ${meta.scmapName}  (v${meta.version})`);
  if (meta?.saveName)  L.push(`Save           ${meta.saveName}`);
  if (meta?.size)      L.push(`Grid           ${meta.size[0]} × ${meta.size[1]}`);
  L.push(`Mode           ${symmetryModeById(mode).short}`);
  L.push(`Tolerance      height ${tolerance.height} game units · mask ${tolerance.mask}/255 · world ${tolerance.world} units`);
  if (detected?.length) {
    L.push('');
    L.push('Detected symmetry');
    L.push('-'.repeat(52));
    for (const d of detected) {
      L.push(`  ${d.short.padEnd(12)} ${pct(d.score).padStart(8)}${d.id === mode ? '   ← checked' : ''}`);
    }
  }
  L.push('');
  L.push('Layers');
  L.push('-'.repeat(52));
  for (const f of findings) {
    L.push(`  ${f.label.padEnd(18)} ${SYMMETRY_VERDICT_LABEL[f.verdict].padEnd(16)} ${f.headline}`);
    for (const d of f.detail || []) L.push(`      ${d}`);
  }
  const fails = findings.filter(f => f.verdict === 'fail');
  L.push('');
  L.push('-'.repeat(52));
  L.push(fails.length
    ? `RESULT: ${fails.length} layer(s) asymmetric — ${fails.map(f => f.label).join(', ')}`
    : 'RESULT: every checked layer is symmetric.');
  return L.join('\n');
}
