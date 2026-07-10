// ─────────────────────────────────────────────────────────────────
// starsGeneration.js — pure star-placement math for StarsTab.
// No React, no IPC, no DOM. Safe to unit-test in isolation.
// Lives next to Stars.jsx because it's Stars-specific business logic,
// not a cross-tab concern (see TAB_CONTRACT §2: "Logik kommt aus
// shared/map-logic — nicht im Tab neu schreiben" applies to *shared*
// logic; this generator is unique to the Stars feature).
// ─────────────────────────────────────────────────────────────────

export const UV_COLORS = [
  '#a855f7', '#22d3ee', '#34d399', '#f59e0b',
  '#f43f5e', '#60a5fa', '#fb923c', '#84cc16',
];

export const DEFAULTS = {
  numStars:        '50',
  numClusters:     '10',
  clusterSpread:   '14000',
  clusterStdDev:   '1800',
  backgroundRatio: '0.45',
  scaleMin:        '10',
  scaleMax:        '30',
  uvOpacity:       '0.25',
  uvOptions:       '0.0, 0.0, 0.5, 0.5\n0.5, 0.0, 0.5, 0.5\n0.0, 0.5, 0.5, 0.5\n0.5, 0.5, 0.5, 0.5',
  uvWeights:       '0.25\n0.25\n0.25\n0.25',
};

export const DEFAULT_UV_ROWS = [
  { x: '0.0', y: '0.0', z: '0.5', w: '0.5', weight: '0.25' },
  { x: '0.5', y: '0.0', z: '0.5', w: '0.5', weight: '0.25' },
  { x: '0.0', y: '0.5', z: '0.5', w: '0.5', weight: '0.25' },
  { x: '0.5', y: '0.5', z: '0.5', w: '0.5', weight: '0.25' },
];

export const Y_MODES = [
  { value: 'flat',      label: 'Flat' },
  { value: 'gaussian',  label: 'Gaussian' },
  { value: 'layered',   label: 'Layered' },
  { value: 'disk_halo', label: 'Disk + Halo' },
  { value: 'curve',     label: 'Curve Editor' },
];

export const DEFAULT_CURVE_POINTS = [
  { x: 0.05, y: 0.0 }, { x: 1.0, y: 0.15 }, { x: 0.3, y: 0.5 }, { x: 0.05, y: 1.0 },
];

export const clamp01 = v => Math.max(0, Math.min(1, v));

// ── UV text <-> rows ────────────────────────────────────────────
export function parseUvOptions(text) {
  return text.split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#'))
    .map(l => {
      const v = l.split(',').map(n => parseFloat(n.trim()));
      return v.length === 4 && v.every(n => !isNaN(n))
        ? { x: v[0], y: v[1], z: v[2], w: v[3] } : null;
    }).filter(Boolean);
}

export function parseWeights(text) {
  return text.split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#'))
    .map(l => parseFloat(l.trim()))
    .filter(n => !isNaN(n));
}

export function uvRowsToOptions(rows) {
  return rows.map(r => `${r.x}, ${r.y}, ${r.z}, ${r.w}`).join('\n');
}

export function uvRowsToWeights(rows) {
  return rows.map(r => r.weight).join('\n');
}

export function uvRowsFromText(uvOptions, uvWeights) {
  const opts = (uvOptions || DEFAULTS.uvOptions).split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const wts  = (uvWeights || DEFAULTS.uvWeights).split('\n').filter(l => l.trim() && !l.startsWith('#'));
  if (!opts.length) return DEFAULT_UV_ROWS;
  return opts.map((line, i) => {
    const parts = line.split(',').map(s => s.trim());
    return { x: parts[0] || '0', y: parts[1] || '0', z: parts[2] || '0.5', w: parts[3] || '0.5', weight: wts[i]?.trim() || '0.25' };
  });
}

// ── Exclusion zones ─────────────────────────────────────────────
export function inExclusionZone(px, pz, zone, spread) {
  if (!zone) return false;
  const toW = v => (v * 2 - 1) * spread;
  const x0 = toW(Math.min(zone.x0, zone.x1)), x1 = toW(Math.max(zone.x0, zone.x1));
  const z0 = toW(Math.min(zone.y0, zone.y1)), z1 = toW(Math.max(zone.y0, zone.y1));
  return px >= x0 && px <= x1 && pz >= z0 && pz <= z1;
}

export function exclusionZoneInfo(zone, clusterSpread) {
  if (!zone) return null;
  const spread = parseFloat(clusterSpread) || 14000;
  const toW = v => ((v * 2 - 1) * spread).toFixed(0);
  return (
    `X ${toW(Math.min(zone.x0, zone.x1))} → ${toW(Math.max(zone.x0, zone.x1))}` +
    `   Z ${toW(Math.min(zone.y0, zone.y1))} → ${toW(Math.max(zone.y0, zone.y1))}`
  );
}

// ── RNG helpers ───────────────────────────────────────────────────
function gaussianRandom(std, rng) {
  const u1 = rng(), u2 = rng();
  return std * Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
}

export function sampleFromCurve(points, yMax, rng) {
  if (!points || points.length < 2) return rng() * yMax;
  const sorted = [...points].sort((a, b) => a.y - b.y);
  const N = sorted.length;
  const areas = [];
  let total = 0;
  for (let i = 0; i < N - 1; i++) {
    const w = (sorted[i].x + sorted[i + 1].x) / 2 * (sorted[i + 1].y - sorted[i].y);
    areas.push(w);
    total += w;
  }
  if (total <= 0) return rng() * yMax;
  let r = rng() * total;
  for (let i = 0; i < areas.length; i++) {
    if (r <= areas[i] || i === areas.length - 1) {
      const t = areas[i] > 0 ? r / areas[i] : 0;
      const h01 = sorted[i].y + t * (sorted[i + 1].y - sorted[i].y);
      return h01 * yMax;
    }
    r -= areas[i];
  }
  return rng() * yMax;
}

function parseLayeredText(text) {
  return text.split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#'))
    .map(l => {
      const v = l.split(',').map(n => parseFloat(n.trim()));
      return v.length === 3 && v.every(n => !isNaN(n))
        ? { center: v[0], stddev: v[1], weight: v[2] } : null;
    }).filter(Boolean);
}

// ── Main generator ───────────────────────────────────────────────
export function buildStars(cfg) {
  const {
    numStars, numClusters, clusterSpread, clusterStdDev, backgroundRatio,
    scaleMin, scaleMax, uvOptions, uvWeights,
    exclusionZones, exEnabled,
    yMode, yMax, yCenter, yStdDev, yLayers,
    diskCenter, diskStdDev, haloStdDev, haloRatio, curvePoints, yClusterScatter,
  } = cfg;

  const nStars    = parseInt(numStars)          || 50;
  const spread    = parseFloat(clusterSpread)   || 14000;
  const stddev    = parseFloat(clusterStdDev)   || 1800;
  const bgRatio   = parseFloat(backgroundRatio) || 0.45;
  const minScale  = parseFloat(scaleMin)        || 10;
  const maxScale  = parseFloat(scaleMax)        || 30;
  const nClusters = parseInt(numClusters)       || 10;
  const yMaxVal   = parseFloat(yMax)            || 1500;

  const parsedUvs     = parseUvOptions(uvOptions);
  const parsedWeights = parseWeights(uvWeights);
  if (!parsedUvs.length)                        throw new Error('No valid UV options');
  if (parsedWeights.length !== parsedUvs.length) throw new Error('UV options and weights count mismatch');

  const rng = Math.random.bind(Math);
  const gauss = std => gaussianRandom(std, rng);

  const sampleY = () => {
    switch (yMode) {
      case 'gaussian': {
        const c = parseFloat(yCenter) || 750;
        const s = parseFloat(yStdDev) || 300;
        return Math.max(0, Math.min(yMaxVal, c + gauss(s)));
      }
      case 'layered': {
        const layers = parseLayeredText(yLayers);
        if (!layers.length) return rng() * yMaxVal;
        const totalW = layers.reduce((a, l) => a + l.weight, 0);
        let r = rng() * totalW;
        for (const l of layers) { r -= l.weight; if (r <= 0) return Math.max(0, Math.min(yMaxVal, l.center + gauss(l.stddev))); }
        const last = layers[layers.length - 1];
        return Math.max(0, Math.min(yMaxVal, last.center + gauss(last.stddev)));
      }
      case 'disk_halo': {
        const dc = parseFloat(diskCenter) || 100;
        const ds = parseFloat(diskStdDev) || 120;
        const hs = parseFloat(haloStdDev) || 800;
        const hr = parseFloat(haloRatio)  || 0.15;
        if (rng() < hr) return Math.max(0, Math.min(yMaxVal, dc + gauss(hs)));
        return Math.max(0, Math.min(yMaxVal, dc + gauss(ds)));
      }
      case 'curve':
        return sampleFromCurve(curvePoints, yMaxVal, rng);
      default:
        return rng() * yMaxVal;
    }
  };

  const centers = Array.from({ length: nClusters }, () => ({
    x: (rng() * 2 - 1) * spread,
    y: sampleY(),
    z: (rng() * 2 - 1) * spread,
  }));

  const activeZones = exEnabled ? exclusionZones : [];
  const stars = [];
  let attempts = 0;

  const pick = (weights) => {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
    return weights.length - 1;
  };

  while (stars.length < nStars && attempts < nStars * 50) {
    attempts++;
    let x, y, z, isCluster;
    if (rng() < bgRatio) {
      x = (rng() * 2 - 1) * spread; y = sampleY(); z = (rng() * 2 - 1) * spread;
      isCluster = false;
    } else {
      const c = centers[Math.floor(rng() * centers.length)];
      x = c.x + gauss(stddev);
      y = Math.max(0, Math.min(yMaxVal, c.y + (rng() - 0.5) * (parseFloat(yClusterScatter) || 200)));
      z = c.z + gauss(stddev);
      isCluster = true;
    }
    if (activeZones.some(zone => inExclusionZone(x, z, zone, spread))) continue;

    const uvIndex    = pick(parsedWeights);
    const uv         = parsedUvs[uvIndex];
    const dist       = Math.sqrt(x * x + z * z) / spread;
    const scale      = (minScale + rng() * (maxScale - minScale)) * (1 - dist * 0.25);
    const brightness = isCluster ? 0.6 + rng() * 0.4 : 0.3 + rng() * 0.4;
    const rotation   = rng() * Math.PI * 2;
    stars.push({ x, y, z, scale, brightness, uvIndex, uv, rotation, color: UV_COLORS[uvIndex % UV_COLORS.length] });
  }
  return stars;
}

export function buildPlanetLua(stars) {
  return stars.map(star =>
    `        {\n` +
    `            position = { ${star.x.toFixed(3)}, ${star.y.toFixed(3)}, ${star.z.toFixed(3)}, },\n` +
    `            rotation = ${star.rotation.toFixed(4)},\n` +
    `            scale = { ${star.scale.toFixed(2)}, ${star.scale.toFixed(2)}, },\n` +
    `            uv = { ${star.uv.x}, ${star.uv.y}, ${star.uv.z}, ${star.uv.w}, },\n` +
    `        },\n`
  ).join('');
}

export function buildPlanetsJson(stars) {
  return stars.map(star => ({
    Position: { x: parseFloat(star.x.toFixed(3)), y: parseFloat(star.y.toFixed(3)), z: parseFloat(star.z.toFixed(3)) },
    Rotation: parseFloat(star.rotation.toFixed(4)),
    Scale:    { x: parseFloat(star.scale.toFixed(2)), y: parseFloat(star.scale.toFixed(2)) },
    Uv:       { x: star.uv.x, y: star.uv.y, z: star.uv.z, w: star.uv.w },
  }));
}
