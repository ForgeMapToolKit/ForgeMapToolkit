/**
 * skyboxUtils.js — Pure Hilfsfunktionen für den SkyboxGeneratorTab
 *
 * Kein React-State, keine IPC.  Importierbar aus Parent + Sektionen.
 */

// ── Konstanten ────────────────────────────────────────────────────
export const ASSETS_RAW = 'https://raw.githubusercontent.com/timmasalme/ForgeMapToolkit-Assets/main';

export const DEFAULT_UV_ROWS = [
  { x: '0.0', y: '0.0', z: '0.5', w: '0.5', weight: '0.25' },
  { x: '0.5', y: '0.0', z: '0.5', w: '0.5', weight: '0.25' },
  { x: '0.0', y: '0.5', z: '0.5', w: '0.5', weight: '0.25' },
  { x: '0.5', y: '0.5', z: '0.5', w: '0.5', weight: '0.25' },
];

export const UV_COLORS = [
  '#3b76ff','#22d3ee','#34d399','#f59e0b',
  '#f43f5e','#60a5fa','#fb923c','#84cc16',
];

export const PLANET_UV_COLORS = [
  '#ff4444','#44ff44','#4444ff','#ffff44','#ff44ff','#44ffff','#ff8844','#88ff44',
];

export const Y_MODES = [
  { value: 'flat',      label: 'Flat'        },
  { value: 'gaussian',  label: 'Gaussian'    },
  { value: 'layered',   label: 'Layered'     },
  { value: 'disk_halo', label: 'Disk + Halo' },
  { value: 'curve',     label: 'Curve Editor'},
];

export const CIRRUS_BUILTIN_PRESETS = [
  {
    id: 'heavy-overcast', label: 'Heavy Overcast',
    texture: '/textures/environment/cirrus000.dds',
    layers: [
      { freqX:'0.0001',   freqY:'0.0001',   speed:'3.5',  dirX:'0.432',   dirY:'-0.902' },
      { freqX:'0.001011', freqY:'0.003189',  speed:'1.28', dirX:'1.0',     dirY:'0.0'   },
      { freqX:'0.000645', freqY:'0.001011',  speed:'0.0',  dirX:'0.95',    dirY:'0.312' },
      { freqX:'0.003367', freqY:'0.005911',  speed:'0.55', dirX:'0.9996',  dirY:'0.03'  },
    ],
  },
  {
    id: 'layered-drift', label: 'Layered Drift',
    texture: '/textures/environment/cirrus001_512.dds',
    layers: [
      { freqX:'0.00025', freqY:'0.00025', speed:'1.5',  dirX:'0.866',  dirY:'0.5'   },
      { freqX:'0.00078', freqY:'0.00195', speed:'1.2',  dirX:'0.5',    dirY:'0.866' },
      { freqX:'0.00132', freqY:'0.00066', speed:'0.95', dirX:'-0.707', dirY:'0.707' },
      { freqX:'0.0005',  freqY:'0.00125', speed:'1.8',  dirX:'1.0',    dirY:'0.0'   },
    ],
  },
  {
    id: 'turbulent-banks', label: 'Turbulent Banks',
    texture: '/textures/environment/cirrus000.dds',
    layers: [
      { freqX:'0.00014', freqY:'0.00014', speed:'4.5',  dirX:'-0.6',  dirY:'-0.8'  },
      { freqX:'0.0018',  freqY:'0.0038',  speed:'2.8',  dirX:'0.8',   dirY:'0.6'   },
      { freqX:'0.00075', freqY:'0.00125', speed:'1.2',  dirX:'-0.95', dirY:'0.31'  },
      { freqX:'0.0045',  freqY:'0.0078',  speed:'0.6',  dirX:'0.707', dirY:'0.707' },
    ],
  },
  {
    id: 'high-cirrus', label: 'High Cirrus',
    texture: '/textures/environment/cirrus000.dds',
    layers: [
      { freqX:'0.00082', freqY:'0.00082', speed:'0.3',  dirX:'1.0',      dirY:'0.0'       },
      { freqX:'0.00055', freqY:'0.00173', speed:'0.2',  dirX:'0.866',    dirY:'0.5'       },
      { freqX:'0.00295', freqY:'0.00427', speed:'0.15', dirX:'0.9500741',dirY:'-0.3120243' },
      { freqX:'0.00346', freqY:'0.00364', speed:'0.1',  dirX:'-0.405117',dirY:'0.914264'  },
    ],
  },
];

// ── Fabrik-Funktionen ─────────────────────────────────────────────
export const defaultPlanet = () => ({
  id: Date.now() + Math.random(),
  x: 2190.0, y: 570.0, z: -1020.0,
  rotation: -1.585,
  scaleX: 183.0, scaleY: 183.0,
  uvX: 0.0, uvY: 0.5, uvZ: 0.5, uvW: 0.5,
});

export const defaultCirrusLayer = () => ({
  id: Date.now() + Math.random(),
  freqX: 0.0001, freqY: 0.0001,
  speed: 7.8,
  dirX: 0.432, dirY: -0.902,
});

export const presetToLayers = (preset) =>
  preset.layers.map(l => ({ ...l, id: Date.now() + Math.random() }));

// ── Farb-Konvertierung ────────────────────────────────────────────
export const hexToRgba = (hex) => {
  if (!hex || typeof hex !== 'string' || hex.length < 7) return { r: 0, g: 0, b: 0, a: 1.0 };
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  return { r, g, b, a: 1.0 };
};

export const hexToRgbArr = (hex) => [
  parseInt(hex.slice(1,3),16),
  parseInt(hex.slice(3,5),16),
  parseInt(hex.slice(5,7),16),
];

export const toHex = (c) => {
  if (!c) return '#000000';
  if (typeof c === 'string') return c;
  const maxCh = Math.max(c.r || 0, c.g || 0, c.b || 0, 1.0);
  const norm  = v => Math.round(((v || 0) / maxCh) * 255);
  const r = Math.max(0, Math.min(255, norm(c.r))).toString(16).padStart(2, '0');
  const g = Math.max(0, Math.min(255, norm(c.g))).toString(16).padStart(2, '0');
  const b = Math.max(0, Math.min(255, norm(c.b))).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
};

export const hexToHsv = (hex) => {
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d % 6) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
};

export const hsvToHex = (h, s, v) => {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    const val = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.max(0, Math.min(255, Math.round(val * 255))).toString(16).padStart(2, '0');
  };
  return `#${f(5)}${f(3)}${f(1)}`;
};

export const hueToHex = (h) => hsvToHex(h, 1, 1);

// ── UV-Parsing ────────────────────────────────────────────────────
export const parseUvOptions = (text) =>
  (text || '').split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#'))
    .map(l => {
      const v = l.split(',').map(n => parseFloat(n.trim()));
      return v.length === 4 && v.every(n => !isNaN(n))
        ? { x: v[0], y: v[1], z: v[2], w: v[3] } : null;
    }).filter(Boolean);

export const parseWeights = (text) =>
  (text || '').split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#'))
    .map(l => parseFloat(l.trim()))
    .filter(n => !isNaN(n));

export const uvRowsToOptions = (rows) =>
  rows.map(r => `${r.x}, ${r.y}, ${r.z}, ${r.w}`).join('\n');

export const uvRowsToWeights = (rows) =>
  rows.map(r => r.weight).join('\n');

// ── PRNG ──────────────────────────────────────────────────────────
export const mulberry32 = (seed) => {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};

export const gaussianRandomSeeded = (std, rng) => {
  const u1 = rng(), u2 = rng();
  return std * Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
};

// ── Y-Distribution ────────────────────────────────────────────────
export const sampleFromCurve = (points, yMax, rng) => {
  if (!points || points.length < 2) return rng() * yMax;
  const sorted = [...points].sort((a, b) => a.y - b.y);
  const N = sorted.length;
  const areas = [];
  let total = 0;
  for (let i = 0; i < N - 1; i++) {
    const w = (sorted[i].x + sorted[i+1].x) / 2 * (sorted[i+1].y - sorted[i].y);
    areas.push(w);
    total += w;
  }
  if (total <= 0) return rng() * yMax;
  let r = rng() * total;
  for (let i = 0; i < areas.length; i++) {
    if (r <= areas[i] || i === areas.length - 1) {
      const t = areas[i] > 0 ? r / areas[i] : 0;
      return (sorted[i].y + t * (sorted[i+1].y - sorted[i].y)) * yMax;
    }
    r -= areas[i];
  }
  return rng() * yMax;
};

export const parseLayeredText = (text) =>
  (text || '').split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#'))
    .map(l => {
      const v = l.split(',').map(n => parseFloat(n.trim()));
      return v.length === 3 && v.every(n => !isNaN(n))
        ? { center: v[0], stddev: v[1], weight: v[2] } : null;
    }).filter(Boolean);

// ── Star-Generierung ──────────────────────────────────────────────
export const clamp01 = v => Math.max(0, Math.min(1, v));

export const inExclusionZone = (px, pz, zone, spread) => {
  if (!zone) return false;
  const toW = v => (v * 2 - 1) * spread;
  const x0 = toW(Math.min(zone.x0, zone.x1)), x1 = toW(Math.max(zone.x0, zone.x1));
  const z0 = toW(Math.min(zone.y0, zone.y1)), z1 = toW(Math.max(zone.y0, zone.y1));
  return px >= x0 && px <= x1 && pz >= z0 && pz <= z1;
};

/**
 * buildStars — generiert Star-Objekte aus allen relevanten Parametern.
 * Rückgabe: Array von { x, y, z, scale, brightness, uvIndex, uv, rotation, color }
 */
export const buildStars = ({
  nStars, numClusters, clusterSpread, clusterStdDev, backgroundRatio,
  scaleMin, scaleMax, uvOptions, uvWeights, exclusionZones, exEnabled,
  seed, useSeed, yMode, yMax, yCenter, yStdDev, yLayers,
  diskCenter, diskStdDev, haloStdDev, haloRatio, curvePoints, yClusterScatter,
}) => {
  const spread   = parseFloat(clusterSpread)   || 14000;
  const stddev   = parseFloat(clusterStdDev)   || 1800;
  const bgRatio  = parseFloat(backgroundRatio) || 0.45;
  const minScale = parseFloat(scaleMin)        || 10;
  const maxScale = parseFloat(scaleMax)        || 30;
  const nClust   = parseInt(numClusters)       || 10;
  const yMaxVal  = parseFloat(yMax)            || 1500;

  const parsedUvs     = parseUvOptions(uvOptions);
  const parsedWeights = parseWeights(uvWeights);
  if (!parsedUvs.length)                           throw new Error('No valid UV options');
  if (parsedWeights.length !== parsedUvs.length)   throw new Error('UV options/weights count mismatch');

  const rng   = useSeed ? mulberry32(seed) : Math.random.bind(Math);
  const gauss = std => gaussianRandomSeeded(std, rng);

  const sampleY = () => {
    switch (yMode) {
      case 'gaussian': {
        const c = parseFloat(yCenter) || 750, s2 = parseFloat(yStdDev) || 300;
        return Math.max(0, Math.min(yMaxVal, c + gauss(s2)));
      }
      case 'layered': {
        const lyrs = parseLayeredText(yLayers);
        if (!lyrs.length) return rng() * yMaxVal;
        const totalW = lyrs.reduce((a, l) => a + l.weight, 0);
        let r = rng() * totalW;
        for (const l of lyrs) { r -= l.weight; if (r <= 0) return Math.max(0, Math.min(yMaxVal, l.center + gauss(l.stddev))); }
        const last = lyrs[lyrs.length - 1];
        return Math.max(0, Math.min(yMaxVal, last.center + gauss(last.stddev)));
      }
      case 'disk_halo': {
        const dc = parseFloat(diskCenter) || 100, ds = parseFloat(diskStdDev) || 120;
        const hs = parseFloat(haloStdDev) || 800, hr = parseFloat(haloRatio)  || 0.15;
        if (rng() < hr) return Math.max(0, Math.min(yMaxVal, dc + gauss(hs)));
        return Math.max(0, Math.min(yMaxVal, dc + gauss(ds)));
      }
      case 'curve':
        return sampleFromCurve(curvePoints, yMaxVal, rng);
      default:
        return rng() * yMaxVal;
    }
  };

  const centers = Array.from({ length: nClust }, () => ({
    x: (rng()*2-1)*spread,
    y: sampleY(),
    z: (rng()*2-1)*spread,
  }));

  const activeZones = exEnabled ? exclusionZones : [];
  const pick = (weights) => {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
    return weights.length - 1;
  };

  const stars = [];
  let attempts = 0;
  while (stars.length < nStars && attempts < nStars * 50) {
    attempts++;
    let x, y, z, isCluster;
    if (rng() < bgRatio) {
      x = (rng()*2-1)*spread; y = sampleY(); z = (rng()*2-1)*spread;
      isCluster = false;
    } else {
      const c = centers[Math.floor(rng()*centers.length)];
      x = c.x + gauss(stddev);
      y = Math.max(0, Math.min(yMaxVal, c.y + (rng()-0.5) * (parseFloat(yClusterScatter) || 200)));
      z = c.z + gauss(stddev);
      isCluster = true;
    }
    if (activeZones.some(zone => inExclusionZone(x, z, zone, spread))) continue;

    const uvIndex    = pick(parsedWeights);
    const uv         = parsedUvs[uvIndex];
    const dist       = Math.sqrt(x*x+z*z)/spread;
    const scalev     = (minScale + rng()*(maxScale-minScale)) * (1 - dist*0.25);
    const brightness = isCluster ? 0.6+rng()*0.4 : 0.3+rng()*0.4;
    const rotation   = rng() * Math.PI * 2;
    stars.push({ x, y, z, scale: scalev, brightness, uvIndex, uv, rotation,
                 color: UV_COLORS[uvIndex % UV_COLORS.length] });
  }
  return stars;
};

// ── JSON-Export ────────────────────────────────────────────────────
export const generateSkyboxJson = ({
  mapSize, horizonHeight, horizonColor, zenithColor, zenithHeight,
  subtractHeight, subdivAxis, subdivHeight, decalGlowMult, albedo, glow,
  cirrusMult, cirrusColor, cirrusTexture, cirrusLayers, planets,
  generateStarPlanets, scale,
}) => {
  const ms    = parseFloat(mapSize)      || 1024;
  const hH    = parseFloat(horizonHeight)|| 0;
  const hRgba = hexToRgba(horizonColor);
  const zRgba = hexToRgba(zenithColor);
  const cRgba = hexToRgba(cirrusColor);

  const manualPlanets = planets.map(p => ({
    Position: { x: parseFloat(p.x), y: parseFloat(p.y), z: parseFloat(p.z) },
    Rotation: parseFloat(p.rotation),
    Scale:    { x: parseFloat(p.scaleX), y: parseFloat(p.scaleY) },
    Uv:       { x: parseFloat(p.uvX), y: parseFloat(p.uvY), z: parseFloat(p.uvZ), w: parseFloat(p.uvW) },
  }));
  const starPlanets     = generateStarPlanets();
  const cirrusLayersData = cirrusLayers.map(l => ({
    frequency: { x: parseFloat(l.freqX), y: parseFloat(l.freqY) },
    Speed:     parseFloat(l.speed),
    Direction: { x: parseFloat(l.dirX), y: parseFloat(l.dirY) },
  }));

  const copyright = [
    "============================================================",
    " ForgeMapToolkit Assets — Skybox Preset",
    " Copyright (c) 2026 timmasalme",
    "============================================================",
    " LICENSE: Creative Commons Attribution-NonCommercial 4.0",
    " Full license: https://creativecommons.org/licenses/by-nc/4.0/",
    " Repository:   https://github.com/timmasalme/ForgeMapToolkit-Assets",
    "============================================================",
  ];

  return JSON.stringify({
    Data: {
      _copyright:          copyright,
      Position:            { x: ms/2, y: hH, z: ms/2 },
      Scale:               scale,
      SubtractHeight:      parseFloat(subtractHeight),
      SubdivisionsAxis:    parseInt(subdivAxis),
      SubdivisionsHeight:  parseInt(subdivHeight),
      HorizonHeight:       hH,
      ZenithHeight:        parseFloat(zenithHeight),
      HorizonColor:        hRgba,
      ZenithColor:         zRgba,
      DecalGlowMultiplier: parseFloat(decalGlowMult),
      Albedo:              albedo,
      Glow:                glow,
      Planets:             [...manualPlanets, ...starPlanets],
      MidRgbColor:         { r:0, g:0, b:0, a:0 },
      CirrusMultiplier:    parseFloat(cirrusMult),
      CirrusColor:         { r: cRgba.r, g: cRgba.g, b: cRgba.b, a: 1.0 },
      CirrusTexture:       cirrusTexture,
      CirrusLayers:        cirrusLayersData,
      Clouds7:             0.0,
    },
  }, null, 4);
};

// ── Lua-Block-Builder ─────────────────────────────────────────────
export const buildSkyboxLuaBlock = ({
  mapSize, horizonHeight, horizonColor, zenithColor, zenithHeight,
  subtractHeight, subdivAxis, subdivHeight, decalGlowMult, albedo, glow,
  cirrusMult, cirrusColor, cirrusTexture, cirrusLayers, planets,
  generateStarPlanets,
}) => {
  const ms  = parseFloat(mapSize) || 1024;
  const hH  = parseFloat(horizonHeight) || 0;
  const hC  = hexToRgba(horizonColor);
  const zC  = hexToRgba(zenithColor);
  const cC  = hexToRgba(cirrusColor);
  const f   = (v, fb = 0) => { const n = parseFloat(v); return isNaN(n) ? fb : n; };
  const nc  = v => { const x = parseFloat(v); return isNaN(x) ? '0' : x.toFixed(6).replace(/\.?0+$/, '') || '0'; };
  const n   = v => String(v);

  const manualPlanets = planets.map(p => ({
    position: [f(p.x), f(p.y), f(p.z)],
    rotation: f(p.rotation),
    scale:    [f(p.scaleX, 1), f(p.scaleY, 1)],
    uv:       [f(p.uvX), f(p.uvY), f(p.uvZ, 0.5), f(p.uvW, 0.5)],
  }));
  const starPlanets = generateStarPlanets()
    .filter(s => !isNaN(s.Position.x) && !isNaN(s.Position.y) && !isNaN(s.Position.z))
    .map(s => ({
      position: [s.Position.x, s.Position.y, s.Position.z],
      rotation: s.Rotation,
      scale:    [s.Scale.x, s.Scale.y],
      uv:       [s.Uv.x, s.Uv.y, s.Uv.z, s.Uv.w],
    }));

  let planetLua = '';
  for (const p of [...manualPlanets, ...starPlanets]) {
    planetLua += `        {\n` +
      `            position = { ${n(p.position[0])}, ${n(p.position[1])}, ${n(p.position[2])}, },\n` +
      `            rotation = ${n(p.rotation)},\n` +
      `            scale = { ${n(p.scale[0])}, ${n(p.scale[1])}, },\n` +
      `            uv = { ${n(p.uv[0])}, ${n(p.uv[1])}, ${n(p.uv[2])}, ${n(p.uv[3])}, },\n` +
      `        },\n`;
  }

  let cirrusLua = '';
  for (const l of cirrusLayers) {
    cirrusLua += `        {\n` +
      `            direction = { ${f(l.dirX)}, ${f(l.dirY)}, },\n` +
      `            frequency = { ${f(l.freqX)}, ${f(l.freqY)}, },\n` +
      `            speed = ${f(l.speed)},\n` +
      `        },\n`;
  }

  return (
    `    skyBox = {\n` +
    `        albedo = "${albedo}",\n` +
    `        cirrusColor = { ${nc(cC.r)}, ${nc(cC.g)}, ${nc(cC.b)}, },\n` +
    `        cirrusLayers = {\n${cirrusLua}        },\n` +
    `        cirrusMultiplier = ${f(cirrusMult)},\n` +
    `        cirrusTexture = "${cirrusTexture}",\n` +
    `        clouds7 = 0,\n` +
    `        decalGlowMultiplier = ${f(decalGlowMult)},\n` +
    `        glow = "${glow}",\n` +
    `        horizonColor = { ${nc(hC.r)}, ${nc(hC.g)}, ${nc(hC.b)}, },\n` +
    `        horizonHeight = ${hH},\n` +
    `        midColor = { 0, 0, 0, },\n` +
    `        planets = {\n${planetLua}        },\n` +
    `        position = { ${ms / 2}, 0, ${ms / 2}, },\n` +
    `        scale = ${ms * 2.288},\n` +
    `        subDivAx = ${parseInt(subdivAxis) || 16},\n` +
    `        subDivHeight = ${parseInt(subdivHeight) || 6},\n` +
    `        subHeight = ${f(subtractHeight, 1.2566)},\n` +
    `        zenithColor = { ${nc(zC.r)}, ${nc(zC.g)}, ${nc(zC.b)}, },\n` +
    `        zenithHeight = ${f(zenithHeight, 256)},\n` +
    `    }`
  );
};

// ── Cirrus-Import-Parser ──────────────────────────────────────────
export const parseCirrusFromText = (raw) => {
  raw = (raw || '').trim();
  let layers = null, texture = null;

  const tryParseJson = (str) => { try { return JSON.parse(str); } catch (_) { return null; } };
  const tryWrap = (str) => {
    const trimmed = str.replace(/^,|,$/g, '').trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('['))
      return tryParseJson('{' + trimmed + '}');
    return null;
  };

  let obj = tryParseJson(raw) ?? tryWrap(raw);
  if (obj !== null) {
    if (obj?.Data) obj = obj.Data;
    if (Array.isArray(obj)) {
      layers = obj;
    } else {
      layers  = obj?.CirrusLayers  ?? obj?.cirrusLayers  ?? null;
      texture = obj?.CirrusTexture ?? obj?.cirrusTexture ?? null;
    }
  }

  if (!layers) {
    const texMatch = raw.match(/cirrusTexture\s*=\s*"([^"]+)"/);
    if (texMatch) texture = texMatch[1];
    const layersBlock = raw.match(/cirrusLayers\s*=\s*\{([\s\S]*?)\},?\s*(?:cirrus|decal|glow|horizon|zenith|planet|position|scale|subDiv|subHeight|albedo|\})/);
    if (layersBlock) {
      const block   = layersBlock[1];
      const entries = block.split(/\},?\s*\{/);
      const parsed  = entries.map(entry => {
        const dx = entry.match(/direction\s*=\s*\{\s*([\d.eE+\-]+)\s*,\s*([\d.eE+\-]+)/i);
        const fx = entry.match(/frequency\s*=\s*\{\s*([\d.eE+\-]+)\s*,\s*([\d.eE+\-]+)/i);
        const sp = entry.match(/speed\s*=\s*([\d.eE+\-]+)/i);
        if (!fx) return null;
        return {
          frequency: { x: parseFloat(fx[1]), y: parseFloat(fx[2]) },
          Direction: { x: dx ? parseFloat(dx[1]) : 1, y: dx ? parseFloat(dx[2]) : 0 },
          Speed:     sp ? parseFloat(sp[1]) : 0,
        };
      }).filter(Boolean);
      if (parsed.length) layers = parsed;
    }
  }

  if (!layers || !layers.length) return null;

  const normalized = layers.slice(0, 4).map((l, i) => ({
    id:    Date.now() + i + Math.random(),
    freqX: String(l.frequency?.x ?? l.FrequencyX ?? 0.0001),
    freqY: String(l.frequency?.y ?? l.FrequencyY ?? 0.0001),
    speed: String(l.Speed  ?? l.speed  ?? 0),
    dirX:  String(l.Direction?.x ?? l.DirectionX ?? 1),
    dirY:  String(l.Direction?.y ?? l.DirectionY ?? 0),
  }));

  return { layers: normalized, texture };
};
