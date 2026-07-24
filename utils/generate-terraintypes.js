'use strict';
/**
 * generate-terraintypes.js — regenerate the TerrainType ID table.
 *
 * Source of truth is the FAF Map Editor's serialized layer list:
 *   D:\FAFEditor\Assets\Scripts\UI\Tools\Terrain\TerrainTypes\Layers Settings.asset
 * (a Unity YAML MonoBehaviour). Each entry maps a byte value written into a
 * map's terrainType.raw to a material/FX group. We mirror it into a JSON the
 * renderer imports, so we never parse Unity YAML at runtime.
 *
 * Usage:  node utils/generate-terraintypes.js [path-to-asset]
 * Output: src/components/Tabs/Scenery/TerrainType/terrainTypes.json
 *
 * The style enum comes from TerrainTypeLayerSettings.cs (0..7).
 */

const fs   = require('fs');
const path = require('path');

const DEFAULT_ASSET = 'D:\\FAFEditor\\Assets\\Scripts\\UI\\Tools\\Terrain\\TerrainTypes\\Layers Settings.asset';
const OUT_PATH = path.join(__dirname, '..', 'src', 'components', 'Tabs', 'Scenery', 'TerrainType', 'terrainTypes.json');

const STYLE_NAMES = ['Default','Evergreen','RedRock','Desert','Tropical','Lava','Geothermal','Tundra'];

function parseAsset(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let cur = null;

  const push = () => { if (cur) { entries.push(cur); cur = null; } };

  for (const line of lines) {
    const nameMatch = line.match(/^\s*-\s*name:\s*(.+?)\s*$/);
    if (nameMatch) {
      push();
      cur = { name: nameMatch[1], index: 0, color: [0,0,0], blocking: false, style: 0, description: '' };
      continue;
    }
    if (!cur) continue;

    let m;
    if ((m = line.match(/^\s*index:\s*(\d+)/)))        { cur.index = parseInt(m[1], 10); continue; }
    if ((m = line.match(/^\s*color:\s*\{([^}]*)\}/))) {
      const g = (ch) => { const mm = m[1].match(new RegExp(ch + ':\\s*([-\\d.eE]+)')); return mm ? parseFloat(mm[1]) : 0; };
      cur.color = [Math.round(g('r')*255), Math.round(g('g')*255), Math.round(g('b')*255)];
      continue;
    }
    if ((m = line.match(/^\s*blocking:\s*(\d+)/)))     { cur.blocking = m[1] !== '0'; continue; }
    if ((m = line.match(/^\s*style:\s*(\d+)/)))        { cur.style = parseInt(m[1], 10); continue; }
    if ((m = line.match(/^\s*description:\s*(.+?)\s*$/))) { cur.description = m[1]; continue; }
    // continuation of a wrapped scalar (e.g. Dirt09 description) — indented,
    // no "key:" — append to whatever we last saw (description in practice).
    if (/^\s{6,}\S/.test(line) && !/:/.test(line)) {
      cur.description = (cur.description + ' ' + line.trim()).trim();
    }
  }
  push();
  return entries;
}

function main() {
  const assetPath = process.argv[2] || DEFAULT_ASSET;
  if (!fs.existsSync(assetPath)) {
    console.error(`Asset not found: ${assetPath}`);
    process.exit(1);
  }
  const entries = parseAsset(fs.readFileSync(assetPath, 'utf8'))
    .filter(e => e.name && Number.isFinite(e.index))
    .map(e => ({ ...e, styleName: STYLE_NAMES[e.style] || String(e.style) }))
    .sort((a, b) => a.index - b.index);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(entries, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${entries.length} terrain types → ${OUT_PATH}`);
}

main();
