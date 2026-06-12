'use strict';
/**
 * scanner.js — Game-data scanner, tagging helpers, library read/write,
 *              and IPC handlers for library operations.
 *
 * Exports:
 *   readLibraries(), writeLibraries(data)
 *   runFullScan(settings, customTags)   (= scanGamedataFolder wrapper)
 *   notifyRenderer(channel, data)
 *   register(deps) — registers library IPC handlers
 */

const path  = require('path');
const fs    = require('fs');
const https = require('https');
const { app, ipcMain, BrowserWindow } = require('electron');
const JSZip = require('jszip');
const { log, yieldTick } = require('./logger');
const { readSettings, writeSettings, LIBRARIES_FILE, getGamedataPaths } = require('./settings');


// ═══════════════════════════════════════════════════════════════════════════════
// TAGGING — EMITTERS
// ═══════════════════════════════════════════════════════════════════════════════

// Returns the category tags for a game-data emitter name.
// Faction tags: uef | cybran | aeon | seraphim  (from unit-code prefixes in name)
// Weather tag:  weather  (only when name contains a weather keyword)
// Used alongside biome tags derived from the file path — see push site.
function tagEmitter(name) {
  const n = name.toLowerCase();
  const tags = [];
  if (/uef|uel|ueb|ues|uea/.test(n))        tags.push('uef');
  if (/cybran|url|urb|urs|ura/.test(n))      tags.push('cybran');
  if (/aeon|ual|uab|uas|uaa/.test(n))        tags.push('aeon');
  if (/seraphim|sera|xsl|xsb|xss|xsa/.test(n)) tags.push('seraphim');
  if (/\bweather\b/.test(n)) tags.push('weather'); // only explicit 'weather' in name
  return tags; // may be empty — caller adds biome or 'misc' as needed
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAGGING — PROPS
// ═══════════════════════════════════════════════════════════════════════════════

const PROP_TYPE_RULES = [
  { tag: 'trees',      keywords: ['pine', 'oak', 'tree', 'palm', 'fir', 'spruce', 'birch', 'maple', 'cedar', 'willow', 'jungle', 'mangrove', 'deadtree', 'dead_tree', 'treestump', 'stump'] },
  { tag: 'rocks',      keywords: ['rock', 'stone', 'boulder', 'cliff', 'pebble', 'mineral', 'crystal', 'ore', 'gravel'] },
  { tag: 'wreckages',  keywords: ['wreck', 'ruin', 'debris', 'scrap', 'hull', 'crash', 'destroyed', 'skeleton'] },
  { tag: 'structures', keywords: ['building', 'structure', 'house', 'factory', 'civilian', 'bunker', 'tower', 'wall', 'bridge', 'facility', 'base', 'platform', 'silo'] },
  { tag: 'vegetation', keywords: ['bush', 'shrub', 'grass', 'plant', 'fern', 'moss', 'weed', 'reed', 'flower', 'vine', 'leaf', 'hedge', 'cactus', 'mushroom'] },
  { tag: 'markers',    keywords: ['road', 'path', 'marker', 'sign', 'post', 'decal', 'arrow', 'waypoint'] },
];

const PROP_BIOME_RULES = [
  { tag: 'boreal',    keywords: ['pine', 'spruce', 'fir', 'birch', 'cedar', 'tundra', 'taiga', 'boreal'] },
  { tag: 'tropical',  keywords: ['palm', 'tropical', 'jungle', 'mangrove', 'rainforest', 'bamboo'] },
  { tag: 'temperate', keywords: ['oak', 'maple', 'willow', 'deciduous', 'temperate', 'meadow'] },
  { tag: 'arid',      keywords: ['cactus', 'desert', 'sand', 'arid', 'dry', 'savanna', 'mesa'] },
  { tag: 'arctic',    keywords: ['snow', 'ice', 'frozen', 'arctic', 'tundra', 'glacier', 'frost'] },
  { tag: 'volcanic',  keywords: ['lava', 'volcano', 'magma', 'volcanic', 'obsidian', 'ash'] },
];

function tagProp(name) {
  const lower = name.toLowerCase();
  const tags  = new Set();
  for (const rule of PROP_TYPE_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) { tags.add(rule.tag); break; }
    }
  }
  for (const rule of PROP_BIOME_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) { tags.add(rule.tag); break; }
    }
  }
  if (tags.size === 0) tags.add('misc');
  return [...tags].sort();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAGGING — UNITS
// ═══════════════════════════════════════════════════════════════════════════════

function unitFaction(id) {
  const p = id.slice(0, 3).toUpperCase();
  const map = {
    UEL: 'uef',       UEB: 'uef',       UES: 'uef',       UEA: 'uef',  UEU: 'uef',
    URL: 'cybran',    URB: 'cybran',    URS: 'cybran',    URA: 'cybran',
    UAL: 'aeon',      UAB: 'aeon',      UAS: 'aeon',      UAA: 'aeon',
    XSL: 'seraphim',  XSB: 'seraphim',  XSS: 'seraphim',  XSA: 'seraphim',
    XEL: 'uef',       XEB: 'uef',
    XRL: 'cybran',    XRB: 'cybran',
    XAL: 'aeon',      XAB: 'aeon',
    XNL: 'nomads',    XNB: 'nomads',    XNS: 'nomads',
    XNA: 'nomads',    XNC: 'nomads',    XNO: 'nomads',
    ZEB: 'uef',       ZAB: 'aeon',      ZRB: 'cybran',    ZSB: 'seraphim', ZNB: 'nomads',
    OPF: 'operations', OPB: 'operations', OPL: 'operations',
    IEL: 'civilian',  IEB: 'civilian',
    DAL: 'aeon',      DAA: 'aeon',
    DEL: 'uef',       DEA: 'uef',       DEB: 'uef',
    DRL: 'cybran',    DRA: 'cybran',
    DSL: 'seraphim',  DSA: 'seraphim',
  };
  return map[p] || 'unknown';
}

function unitLayer(id) {
  const layerChar = id.slice(2, 3).toUpperCase();
  const map = { L: 'land', A: 'air', S: 'naval', B: 'structure', U: 'experimental' };
  return map[layerChar] || 'unknown';
}

function unitTechFromId(id) {
  const num = parseInt(id.slice(3), 10);
  if (isNaN(num)) return null;
  if (num < 200) return 1;
  if (num < 300) return 2;
  if (num < 400) return 3;
  return 4;
}

function parseBlueprintData(content) {

  // Categories-Block auslesen — z.B. ['UEF', 'CIVILIAN', 'STRUCTURE', ...]
  const categories = [];
  // Use [\s\S] to handle both LF and CRLF line endings from SCD archives
  const catBlockMatch = content.match(/Categories\s*=\s*\{([\s\S]*?)\}/);
  if (catBlockMatch) {
    const catMatches = catBlockMatch[1].matchAll(/'([A-Z0-9_]+)'/g);
    for (const m of catMatches) categories.push(m[1]);
  }
  const isCivilian = categories.includes('CIVILIAN');

  // UnitName
  let unitName = null;
  const nameMatch =
    content.match(/UnitName\s*=\s*'<LOC [^>]+>([^']+)'/) ||
    content.match(/UnitName\s*=\s*"<LOC [^>]+>([^"]+)"/) ||
    content.match(/UnitName\s*=\s*"([^"<][^"]*)"/)        ||
    content.match(/UnitName\s*=\s*'([^'<][^']*)'/);
  if (nameMatch) {
    const candidate = nameMatch[1].trim();
    unitName = candidate.length > 0 ? candidate : null;
  }

  // Description als Fallback
  let description = null;
  const descMatch =
    content.match(/Description\s*=\s*'<LOC [^>]+>([^']+)'/) ||
    content.match(/Description\s*=\s*"<LOC [^>]+>([^"]+)"/) ||
    content.match(/Description\s*=\s*'([^'<][^']*)'/)        ||
    content.match(/Description\s*=\s*"([^"<][^"]*)"/);
  if (descMatch) {
    const candidate = descMatch[1].trim();
    description = candidate.length > 0 ? candidate : null;
  }

  // FactionName
  let factionName = null;
  const factionMatch =
    content.match(/FactionName\s*=\s*'([^']+)'/) ||
    content.match(/FactionName\s*=\s*"([^"]+)"/);
  if (factionMatch) factionName = factionMatch[1].trim().toLowerCase() || null;

  // TechLevel
  let tech = null;
  const techMatch =
    content.match(/TechLevel\s*=\s*'([^']+)'/) ||
    content.match(/TechLevel\s*=\s*"([^"]+)"/);
  if (techMatch) {
    const lvl = techMatch[1].toUpperCase();
    if      (lvl.includes('BASIC'))      tech = 1;
    else if (lvl.includes('ADVANCED'))   tech = 2;
    else if (lvl.includes('SECRET'))     tech = 3;
    else if (lvl.includes('EXPERIMENT')) tech = 4;
  }

  // Classification — e.g. 'RULEUC_Weapon', 'RULEUC_Commander', etc.
  let classification = null;
  const classMatch =
    content.match(/Classification\s*=\s*'([^'\r\n]+)'/) ||
    content.match(/Classification\s*=\s*"([^"\r\n]+)"/);
  if (classMatch) classification = classMatch[1].trim();

  // StrategicIconName — e.g. 'icon_structure2_artillery'
  let strategicIcon = null;
  const siMatch =
    content.match(/StrategicIconName\s*=\s*'([^'\r\n]+)'/) ||
    content.match(/StrategicIconName\s*=\s*"([^"\r\n]+)"/);
  if (siMatch) strategicIcon = siMatch[1].trim();

  return { unitName, description, factionName, tech, categories, isCivilian, classification, strategicIcon };
}

function tagUnit(id, faction, layer, tech) {
  const tags = new Set();
  if (faction && faction !== 'unknown') tags.add(faction);
  if (layer   && layer   !== 'unknown') tags.add(layer);
  if (tech) tags.add(`t${tech}`);
  return [...tags].sort();
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIBRARY — READ / WRITE
// ═══════════════════════════════════════════════════════════════════════════════

function readLibraries() {
  try {
    if (fs.existsSync(LIBRARIES_FILE)) {
      return JSON.parse(fs.readFileSync(LIBRARIES_FILE, 'utf8'));
    }
  } catch (e) { log.error('readLibraries failed:', e); }
  return null;
}

function writeLibraries(data) {
  try {
    fs.writeFileSync(LIBRARIES_FILE, JSON.stringify(data, null, 2));
    log.debug('Libraries written to disk');
  } catch (e) {
    log.error('writeLibraries failed:', e);
    throw e;
  }
}

// VOR scanGamedataFolder einfügen:
function isIncompleteUnit(unitId, parsed) {
  if (unitId.startsWith('Z')) return false;
  if (unitId.startsWith('XN')) return false;
  if (/^D[AERS][ALB]/i.test(unitId)) return false;
  if (parsed.isCivilian && !parsed.unitName) return true;
  if (parsed.factionName) {
    const idFaction = unitFaction(unitId);
    const bpFaction = parsed.factionName;
    const MISMATCHES = {
      'aeon':     ['uef', 'cybran', 'seraphim'],
      'uef':      ['aeon', 'cybran', 'seraphim'],
      'cybran':   ['uef', 'aeon', 'seraphim'],
      'seraphim': ['uef', 'cybran', 'aeon'],
    };
    if (MISMATCHES[idFaction]?.includes(bpFaction)) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCAN — CORE
// ═══════════════════════════════════════════════════════════════════════════════

async function scanGamedataFolder(gamedataFolder) {
  const result = { emitters: [], props: [], units: [] };
  if (!gamedataFolder || !fs.existsSync(gamedataFolder)) {
    log.warn(`scanGamedataFolder: folder does not exist: ${gamedataFolder}`);
    return result;
  }

const scdFiles = fs.readdirSync(gamedataFolder)
  .filter(f => f.endsWith('.scd') || f.endsWith('.zip') || f.endsWith('.nx2'));

  log.info(`Scanning ${gamedataFolder} — ${scdFiles.length} SCD/ZIP files`);

  for (const scdFile of scdFiles) {
    await yieldTick(1); // yield between SCD files — each is a large ZIP
    try {
      log.debug(`  Reading: ${scdFile}`);
      const buf = fs.readFileSync(path.join(gamedataFolder, scdFile));
      const zip = await JSZip.loadAsync(buf);
      const unitBpEntries = {};
for (const [filePath, file] of Object.entries(zip.files)) {
        if (file.dir) continue;
        await yieldTick(100); // yield every 100 zip entries
        const lower    = filePath.toLowerCase();
        const normPath = '/' + filePath.replace(/\\/g, '/');

        if (lower.endsWith('_emit.bp')) {
          const name = path.basename(filePath, '.bp');
          // Build tags:
          //   - faction tags from name (uef / cybran / aeon / seraphim)
          //   - weather tag from name (weather keywords only)
          //   - biome tag from path when file lives under /env/<biome>/
          //   - fallback 'misc' when none of the above matched
          const emitterTags = tagEmitter(name); // faction + weather from name
          const parts  = normPath.toLowerCase().split('/').filter(Boolean);
          const envIdx = parts.indexOf('env');
          if (envIdx !== -1 && parts[envIdx + 1] && !parts[envIdx + 1].endsWith('.bp')) {
            const biome = parts[envIdx + 1];
            if (!emitterTags.includes(biome)) emitterTags.push(biome);
          }
          // No fallback to 'misc' — untagged emitters appear only under 'All'
          result.emitters.push({ id: name, name, gamePath: normPath, source: scdFile, tags: emitterTags });
        }

        const inUnits = lower.startsWith('units/') || lower.includes('/units/');
        if (inUnits && lower.endsWith('_unit.bp')) {
          const unitId = path.basename(filePath, '.bp').replace(/_unit$/i, '').toUpperCase();
          unitBpEntries[unitId] = { file, normPath, scdFile };
        }

        const inProps = (lower.includes('/props/') || lower.startsWith('props/')) && scdFile.toLowerCase().startsWith('env');

        // Files under /props/emitters/ (or /props/Emitters/) are env emitters, not placeable props.
        // e.g. /env/Desert/Props/Emitters/DesertBlowingSand02_prop.bp  → category: 'desert'
        const inPropEmitters = inProps && lower.includes('/props/emitters/');
        if (inPropEmitters && lower.endsWith('.bp')) {
          const name = path.basename(filePath, '.bp');
          // Biome = first folder after /env/  (e.g. 'desert', 'tundra', 'lava')
          const parts  = normPath.split('/').filter(Boolean);
          const envIdx = parts.findIndex(p => p.toLowerCase() === 'env');
          const biome  = (envIdx !== -1 && parts[envIdx + 1] && !parts[envIdx + 1].endsWith('.bp'))
            ? parts[envIdx + 1].toLowerCase()
            : 'env';
          const emitterTags = tagEmitter(name); // picks up 'weather' if name contains it
          if (!emitterTags.includes(biome)) emitterTags.push(biome);
          log.debug(`  [ENV-EMIT] ${normPath} | biome=${biome} tags=${emitterTags}`);
          result.emitters.push({ id: name, name, gamePath: normPath, source: scdFile, tags: emitterTags });
        }

        if (inProps && !inPropEmitters && lower.endsWith('.bp') && !lower.endsWith('_emit.bp')) {
          const propId   = path.basename(filePath, '.bp');
          const propName = propId.replace(/_prop$/i, '');
          let albedo = null, reclaimEnergy = null, reclaimMass = null, reclaimTime = null, helpText = null;
          let lodPreviewUrls = {};

          // Category + type from normPath (always /env/<cat>/props/<type>/file.bp)
          const np = normPath.split('/').filter(Boolean);
          const ei = np.findIndex(p => p.toLowerCase() === 'env');
          const pi = np.findIndex(p => p.toLowerCase() === 'props');
          let categoryFolder = null;
          let typeFolder     = null;
          if (ei !== -1 && pi !== -1 && pi > ei) {
            categoryFolder = np[ei + 1] ? np[ei + 1].toLowerCase() : null;
            const afterProps = np[pi + 1] ? np[pi + 1].toLowerCase() : null;
            typeFolder = (afterProps && !afterProps.endsWith('.bp')) ? afterProps : null;
          } else if (pi !== -1) {
            const c = np[pi + 1] ? np[pi + 1].toLowerCase() : null;
            const t = np[pi + 2] ? np[pi + 2].toLowerCase() : null;
            categoryFolder = (c && !c.endsWith('.bp')) ? c : null;
            typeFolder     = (t && !t.endsWith('.bp')) ? t : null;
          }

          try {
            const bpContent = await file.async('string');

            // AlbedoName — take only basename, lowercase
            const albedoMatch = bpContent.match(/AlbedoName\s*=\s*['"]([^'"]+\.dds)['"]/i);
            if (albedoMatch) {
              // Take basename as-is — GitHub is case-sensitive, preserve original casing
              const base = albedoMatch[1].replace(/\\/g, '/').split('/').pop();
              albedo = base.replace(/\.dds$/i, '.png');
              log.debug(`  [PROP] ${propId}: AlbedoName found -> ${albedo}`);
            } else {
              // Fallback: derive from BP filename — preserve casing from propName
              // PurpleCrystal07_prop.bp -> PurpleCrystal07_albedo.png
              albedo = propName + '_albedo.png';
              log.debug(`  [PROP] ${propId}: no AlbedoName, fallback -> ${albedo}`);
            }

            // LOD albedos — parse ALL AlbedoName entries, collect _LOD\d+_albedo.dds → GitHub URLs
            const allAlbedoMatches = [...bpContent.matchAll(/AlbedoName\s*=\s*['"]([^'"]*\.dds)['"]/gi)];
            for (const m of allAlbedoMatches) {
              const filename = m[1].replace(/\\/g, '/').split('/').pop();
              const lodAlbMatch = filename.match(/_LOD(\d+)_albedo\.dds$/i);
              if (lodAlbMatch) {
                const lodN = lodAlbMatch[1];
                if (!lodPreviewUrls[lodN]) {
                  lodPreviewUrls[lodN] = `https://raw.githubusercontent.com/timmasalme/ForgeMapToolkit-Assets/main/props/${filename.replace(/\.dds$/i, '.png')}`;
                  log.debug(`  [PROP] ${propId}: LOD${lodN} -> ${lodPreviewUrls[lodN]}`);
                }
              }
            }

            const energyMatch = bpContent.match(/ReclaimEnergyMax\s*=\s*([\d.]+)/);
            const massMatch   = bpContent.match(/ReclaimMassMax\s*=\s*([\d.]+)/);
            const timeMatch   = bpContent.match(/ReclaimTime\s*=\s*([\d.]+)/);
            if (energyMatch) reclaimEnergy = parseFloat(energyMatch[1]);
            if (massMatch)   reclaimMass   = parseFloat(massMatch[1]);
            if (timeMatch)   reclaimTime   = parseFloat(timeMatch[1]);
            const helpMatch = bpContent.match(/HelpText\s*=\s*'([^']+)'/);
            if (helpMatch) helpText = helpMatch[1].trim();

            log.debug(`  [PROP] ${normPath} | cat=${categoryFolder} type=${typeFolder} albedo=${albedo} mass=${reclaimMass} energy=${reclaimEnergy} time=${reclaimTime}`);
          } catch (e) {
            log.warn(`  [PROP] ${propId}: parse error: ${e.message}`);
            albedo = (propName + '_albedo.png').toLowerCase();
          }

          // ── Prop Overrides (lazy-loaded once per scan) ───────────────────
          if (!scanGamedataFolder._overrides) {
            const overridesPath = path.join(app.getAppPath(), 'data', 'prop_overrides.json');
            try {
              scanGamedataFolder._overrides = fs.existsSync(overridesPath)
                ? JSON.parse(fs.readFileSync(overridesPath, 'utf8'))
                : { albedo_overrides: {}, no_preview: [] };
              log.info('prop_overrides.json loaded:', overridesPath);
            } catch (e) {
              log.warn('Could not load prop_overrides.json:', e.message);
              scanGamedataFolder._overrides = { albedo_overrides: {}, no_preview: [] };
            }
          }
          const _ov = scanGamedataFolder._overrides;
          const albedoOverride = _ov.albedo_overrides?.[normPath];
          if (albedoOverride) log.debug(`  [PROP] override ${normPath} -> ${albedoOverride}`);
          const albedoForPreview = albedoOverride ?? albedo;
          const noPreview = Array.isArray(_ov.no_preview) && _ov.no_preview.includes(normPath);
          // All preview PNGs are flat in /props/ folder on GitHub
          const previewUrl = noPreview
            ? null
            : `https://raw.githubusercontent.com/timmasalme/ForgeMapToolkit-Assets/main/props/${albedoForPreview}`;

          result.props.push({
            id: propId, name: propName, helpText,
            gamePath: normPath, source: scdFile,
            biome: categoryFolder, propType: typeFolder,
            albedo, previewUrl,
            lodPreviewUrls: Object.keys(lodPreviewUrls).length > 0 ? lodPreviewUrls : undefined,
            reclaimMass, reclaimEnergy, reclaimTime,
            isGroup: normPath.toLowerCase().includes('/groups/'),
            tags: tagProp(propId),
          });
        }
      }
      // ← Zweiter Loop für Units — dieser fehlte!
for (const [unitId, { file, normPath, scdFile: src }] of Object.entries(unitBpEntries)) {
  await yieldTick(50); // yield every 50 units
  const layer = unitLayer(unitId);
  let tech    = unitTechFromId(unitId);
  let unitName    = null;
  let description = null;
  let bpFaction   = null;
  let parsed      = {};

  try {
    const content = await file.async('string');
    parsed = parseBlueprintData(content);
    if (parsed.tech !== null)  tech        = parsed.tech;
    if (parsed.unitName)       unitName    = parsed.unitName;
    if (parsed.description)    description = parsed.description;
    if (parsed.factionName)    bpFaction   = parsed.factionName;
    // ONE-TIME diagnostic: log first unit that has STRUCTURE in categories
    if (!scanGamedataFolder._structLogged && parsed.categories?.includes('STRUCTURE')) {
      scanGamedataFolder._structLogged = true;
      log.info(`[BPDiag] STRUCTURE unit: ${unitId} cats=[${parsed.categories.join(',')}] class=${parsed.classification} content_len=${content.length}`);
    }
    // ONE-TIME diagnostic: log first unit with any categories
    if (!scanGamedataFolder._catLogged && parsed.categories?.length > 0) {
      scanGamedataFolder._catLogged = true;
      log.info(`[BPDiag] First unit with cats: ${unitId} cats=[${parsed.categories.join(',')}] class=${parsed.classification}`);
    }
  } catch (e) {
    log.debug(`  Could not read BP for unit ${unitId}: ${e.message}`);
  }

  // ← Unfertige / fehlerhafte Units überspringen
  if (isIncompleteUnit(unitId, parsed)) {
    log.debug(`  Skipping incomplete unit: ${unitId}`);
    continue;
  }

  const faction = bpFaction || unitFaction(unitId);

const previewUrl = `https://raw.githubusercontent.com/timmasalme/ForgeMapToolkit-Assets/main/units/${unitId.toUpperCase()}.png`;

result.units.push({
  id:             unitId,
  name:           unitName || description || unitId,
  unitName:       unitName,
  description:    description,
  gamePath:       normPath,
  source:         src,
  faction,
  layer,
  tech,
  previewUrl,
  bpCategories:   parsed?.categories     || [],
  classification: parsed?.classification || null,
  strategicIcon:  parsed?.strategicIcon  || null,
  tags:           tagUnit(unitId, faction, layer, tech),
});
      }

      log.debug(`  ${scdFile}: ${result.emitters.length} emitters, ${result.props.length} props, ${result.units.length} units (running total)`);

    } catch (e) {
      log.error(`scanGamedataFolder: failed to read ${scdFile}:`, e);
    }
  }

  return result;
}

async function scanCustomEmitterFolder(folderPath, customTags) {
  const emitters = [];
  if (!folderPath || !fs.existsSync(folderPath)) {
    if (folderPath) log.warn(`scanCustomEmitterFolder: folder not found: ${folderPath}`);
    return emitters;
  }
  const bpFiles = fs.readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('_emit.bp'));
  log.info(`Custom emitter folder: ${folderPath} — ${bpFiles.length} files`);
  for (const bpFile of bpFiles) {
    await yieldTick(50);
    const name     = path.basename(bpFile, '.bp');
    const userTags = (customTags && customTags[name]) || [];
    emitters.push({
      id: name, name,
      gamePath: path.join(folderPath, bpFile).replace(/\\/g, '/'),
      source: 'custom',
      tags: [...new Set([...tagEmitter(name), 'custom', ...userTags])].sort(),
    });
  }
  return emitters;
}

async function scanNomadsFolder() {
  const result = { units: [] };

  const RAW_BASE = 'https://raw.githubusercontent.com/timmasalme/ForgeMapToolkit-Assets/main';

  // ── helper: HTTP GET → string ───────────────────────────────────────────────
  const httpGet = (url) => new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    https.get({
      hostname: parsedUrl.hostname,
      path:     parsedUrl.pathname + parsedUrl.search,
      headers:  { 'User-Agent': 'ForgeMapToolkit' },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });

  log.info('Scanning Nomads units from GitHub repo...');

  // ── 1. ONE API call: get the full recursive tree for /nomads/ ───────────────
  // Using the Git Trees API with recursive=1 — counts as 1 rate-limit hit total
  let bpPaths;
  try {
    const treeUrl = 'https://api.github.com/repos/timmasalme/ForgeMapToolkit-Assets/git/trees/main?recursive=1';
    const { status, body } = await httpGet(treeUrl);
    if (status !== 200) {
      log.warn(`Nomads: Git Tree API returned ${status}, skipping Nomads scan`);
      return result;
    }
    const tree = JSON.parse(body);
    // Filter to nomads/_unit.bp files only
    // Structure: nomads/XNA0001/XNA0001_unit.bp
    bpPaths = (tree.tree || [])
      .filter(e => e.type === 'blob'
               && e.path.startsWith('nomads/')
               && e.path.toLowerCase().endsWith('_unit.bp'))
      .map(e => e.path);  // e.g. "nomads/XNA0001/XNA0001_unit.bp"

    log.info(`Nomads: found ${bpPaths.length} unit .bp files via Git tree`);
  } catch (e) {
    log.warn('Nomads: Git Tree API failed:', e.message);
    return result;
  }

  // ── 2. Fetch each .bp via raw.githubusercontent.com — NO rate limit ─────────
  await Promise.all(bpPaths.map(async (bpPath) => {
    // Extract unit ID from path: "nomads/XNA0001/XNA0001_unit.bp" → "XNA0001"
    const fileName = bpPath.split('/').pop();                    // XNA0001_unit.bp
    const unitId   = fileName.replace(/_unit\.bp$/i, '').toUpperCase(); // XNA0001

    const rawUrl = `${RAW_BASE}/${bpPath}`;

    try {
      const { status, body } = await httpGet(rawUrl);
      if (status !== 200) {
        log.warn(`Nomads: failed to fetch ${bpPath} (${status})`);
        return;
      }

      const parsed = parseBlueprintData(body);

      // ONE-TIME diagnostic for Nomads
      if (!scanNomadsFolder._logged) {
        scanNomadsFolder._logged = true;
        const _bodyPreview = body.slice(0, 200).split('\n').join(' ');
        log.warn('[NomadsDiag] ' + unitId + ' body_len=' + body.length + ' cats=' + JSON.stringify(parsed.categories) + ' class=' + parsed.classification);
        log.warn('[NomadsDiag] body_start=' + _bodyPreview);
      }

      if (isIncompleteUnit(unitId, parsed)) {
        log.debug(`Nomads: skipping incomplete unit ${unitId}`);
        return;
      }

      const faction = parsed.factionName?.toLowerCase() || 'nomads';
      const layer   = unitLayer(unitId);
      let   tech    = unitTechFromId(unitId);
      if (parsed.tech !== null) tech = parsed.tech;

      result.units.push({
        id:             unitId,
        name:           parsed.unitName || parsed.description || unitId,
        unitName:       parsed.unitName,
        description:    parsed.description,
        gamePath:       `/${bpPath}`,
        source:         'nomads-github',
        faction,
        layer,
        tech,
        previewUrl:     `${RAW_BASE}/units/${unitId}.png`,
        bpCategories:   parsed.categories     || [],
        classification: parsed.classification || null,
        strategicIcon:  parsed.strategicIcon  || null,
        tags:           tagUnit(unitId, faction, layer, tech),
      });
    } catch (e) {
      log.warn(`Nomads: error fetching/parsing ${bpPath}:`, e.message);
    }
  }));

  log.info(`Nomads GitHub scan complete: ${result.units.length} units`);
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREVIEW COVERAGE CHECK — Top-Level-Funktion (nicht nested in runFullScan!)
// ═══════════════════════════════════════════════════════════════════════════════

async function checkPreviewCoverage(units) {
  log.info('Preview coverage check: fetching GitHub asset list...');

  return new Promise(resolve => {
    const req = https.get({
      hostname: 'api.github.com',
      path: '/repos/timmasalme/ForgeMapToolkit-Assets/contents/units',
      headers: { 'User-Agent': 'map-tool-suite' },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const files = JSON.parse(data);
          if (!Array.isArray(files)) {
            log.warn('Preview coverage check: unexpected GitHub API response');
            return resolve();
          }
          const repoIds    = new Set(files.filter(f => f.name.toLowerCase().endsWith('.png')).map(f => f.name.replace(/\.png$/i, '').toUpperCase()));
          const scannedIds = new Set(units.map(u => u.id.toUpperCase()));
          const unused  = [...repoIds].filter(id => !scannedIds.has(id)).sort();
          const missing = [...scannedIds].filter(id => !repoIds.has(id)).sort();
          log.info(`Preview coverage: ${repoIds.size} PNGs in repo, ${scannedIds.size} scanned units`);
          log.info(`Preview coverage: ${repoIds.size - unused.length}/${scannedIds.size} units have a preview (${Math.round((repoIds.size - unused.length) / scannedIds.size * 100)}%)`);
          if (unused.length > 0) {
            log.warn(`Preview coverage: ${unused.length} PNGs in repo are NOT matched to any scanned unit:`);
            for (let i = 0; i < unused.length; i += 10) log.warn(`  Unused PNGs: ${unused.slice(i, i + 10).join(', ')}`);
          } else {
            log.info('Preview coverage: all repo PNGs are matched to a scanned unit ✓');
          }
          if (missing.length > 0) {
            log.info(`Preview coverage: ${missing.length} scanned units have NO preview PNG in repo:`);
            for (let i = 0; i < missing.length; i += 10) log.info(`  Missing previews: ${missing.slice(i, i + 10).join(', ')}`);
          } else {
            log.info('Preview coverage: all scanned units have a preview PNG ✓');
          }
          resolve();
        } catch (e) {
          log.warn('Preview coverage check: failed to parse GitHub response:', e.message);
          resolve();
        }
      });
    });
    req.on('error', e => { log.warn('Preview coverage check: network error:', e.message); resolve(); });
    req.setTimeout(8000, () => { log.warn('Preview coverage check: timed out'); req.destroy(); resolve(); });
  });
}

async function runFullScan(settings, existingCustomTags = {}) {
  log.info('Starting full library scan...');
  const combined = { emitters: [], props: [], units: [] };
  const seen     = { emitters: new Set(), props: new Set(), units: new Set() };

  const gdPaths = getGamedataPaths(settings);
  log.info(`Gamedata paths: ${gdPaths.join(', ') || '(none)'}`);

  for (const gdPath of gdPaths) {
    const res = await scanGamedataFolder(gdPath);
    for (const e of res.emitters) {
      if (!seen.emitters.has(e.id)) { seen.emitters.add(e.id); combined.emitters.push(e); }
    }
    for (const p of res.props) {
      if (!seen.props.has(p.id)) { seen.props.add(p.id); combined.props.push(p); }
    }
    for (const u of res.units) {
      if (seen.units.has(u.id)) {
        // Only overwrite if the new entry has richer data (non-empty bpCategories)
        const idx = combined.units.findIndex(x => x.id === u.id);
        if (idx !== -1 && u.bpCategories?.length > 0) combined.units[idx] = u;
      } else {
        seen.units.add(u.id);
        combined.units.push(u);
      }
    }
  }

  const customEmitters = await scanCustomEmitterFolder(settings.emitterBpFolder, existingCustomTags);
  for (const e of customEmitters) {
    if (!seen.emitters.has(e.id)) { seen.emitters.add(e.id); combined.emitters.push(e); }
    else {
      const idx = combined.emitters.findIndex(x => x.id === e.id);
      if (idx !== -1) combined.emitters[idx] = e;
    }
  }

  const nomadsResult = await scanNomadsFolder();
for (const u of nomadsResult.units) {
  if (!seen.units.has(u.id)) {
    seen.units.add(u.id);
    combined.units.push(u);
  } else {
    const idx = combined.units.findIndex(x => x.id === u.id);
    if (idx !== -1 && !combined.units[idx].source?.startsWith('nomads')) {
      combined.units[idx] = u;
    }
  }
}

  const libraries = {
    scannedAt: new Date().toISOString(),
    customEmitterTags: existingCustomTags,
    emitters: combined.emitters,
    props:    combined.props,
    units:    combined.units,
  };

    checkPreviewCoverage(combined.units).catch(() => {});

  // Log a sample unit to confirm bpCategories/classification are populated
  const sampleUnit = libraries.units.find(u => u.bpCategories?.length > 0);
  if (sampleUnit) {
    log.info(`[Scan] bpCategories OK — sample: ${sampleUnit.id} cats=[${sampleUnit.bpCategories.slice(0,4).join(',')}] class=${sampleUnit.classification}`);
  } else {
    log.warn('[Scan] bpCategories EMPTY on all units — check parseBlueprintData');
  }

  writeLibraries(libraries);
  log.info(`Scan complete — ${libraries.emitters.length} emitters, ${libraries.props.length} props, ${libraries.units.length} units`);
  return libraries;
}

function notifyRenderer(channel, data) {
  // FIX: mainWindow war nicht in diesem Modul definiert → ReferenceError.
  // BrowserWindow.getAllWindows() ist korrekt und bereits importiert.
  for (const win of BrowserWindow.getAllWindows()) {
    try { if (!win.isDestroyed()) win.webContents.send(channel, data); } catch (_) {}
  }
}
// ═══════════════════════════════════════════════════════════════════════════════
// IPC — LIBRARIES
// ═══════════════════════════════════════════════════════════════════════════════

ipcMain.handle('library-load', async () => {
  const data = readLibraries();
  if (!data) {
    log.info('No library cache found');
    return { scanned: false, emitters: [], props: [], units: [] };
  }
  log.info(`Library loaded from cache (scanned: ${data.scannedAt}) — ${data.emitters?.length} emitters`);
  return { scanned: true, ...data };
});

ipcMain.handle('library-scan', async () => {
  try {
    const settings   = readSettings();
    const existing   = readLibraries();
    const customTags = existing?.customEmitterTags || {};
    // Always clear cache before rescan so stale data is gone
    if (fs.existsSync(LIBRARIES_FILE)) {
      fs.unlinkSync(LIBRARIES_FILE);
      log.info('library-scan: cleared stale cache before rescan');
    }
    const libs = await runFullScan(settings, customTags);
    return { success: true, counts: { emitters: libs.emitters.length, props: libs.props.length, units: libs.units.length } };
  } catch (e) {
    log.error('library-scan IPC failed:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('library-set-custom-tags', async (event, { emitterId, tags }) => {
  try {
    const data = readLibraries() || { emitters: [], props: [], units: [], customEmitterTags: {} };
    data.customEmitterTags = data.customEmitterTags || {};
    data.customEmitterTags[emitterId] = tags;
    const idx = data.emitters.findIndex(e => e.id === emitterId && e.source === 'custom');
    if (idx !== -1) {
      data.emitters[idx].tags = [...new Set([...tagEmitter(emitterId), 'custom', ...tags])].sort();
    }
    writeLibraries(data);
    log.info(`Custom tags updated for emitter: ${emitterId}`);
    return { success: true };
  } catch (e) {
    log.error('library-set-custom-tags failed:', e);
    return { success: false, error: e.message };
  }
});


ipcMain.handle('library-invalidate', async () => {
  try {
    if (fs.existsSync(LIBRARIES_FILE)) {
      fs.unlinkSync(LIBRARIES_FILE);
      log.info('Library cache invalidated');
    }
    return { success: true };
  } catch (e) {
    log.error('library-invalidate failed:', e);
    return { success: false, error: e.message };
  }
});



/**
 * Register library IPC handlers.
 * @param {{ log, readSettings, getGamedataPaths }} deps
 */
function register(deps) {
  // handlers registered at module load time via ipcMain.handle above
}

module.exports = {
  readLibraries,
  writeLibraries,
  runFullScan,
  notifyRenderer,
  register,
};