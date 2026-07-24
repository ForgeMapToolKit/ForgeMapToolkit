// ─────────────────────────────────────────────────────────────────
// starsInjection.js — file-system / IPC side of Stars generation.
//
// ⚠ VERIFICATION NEEDED (see chat write-up): TAB_CONTRACT.md §6 says
// SCMAP output must go through `scmapIO` (injectPropsLua, ensureDir,
// writeFile, readFile, ...) and that the unpack → patch → pack →
// copy-back flow must never be duplicated per tab. The contract only
// documents `injectPropsLua`, which targets props.lua — Stars patches
// the `skyBox.planets` table inside `data.lua`, a different file/
// section. I don't have the actual scmapIO source, so I can't confirm
// whether an equivalent generic helper (e.g. something Wreckage/Props
// use internally for their own data.lua sections) already exists.
//
// What I *did* do: replaced the direct `read-file` / `write-file`
// IPC calls with the documented shared helpers (`readFile`, `writeFile`,
// `ensureDir`) so at least that part matches §6. The remaining steps
// (`list-dir`, `scmap-unpack`, `scmap-snapshot-folder`, `scmap-pack`,
// `copy-file`, `settings-load`, `open-folder`) are NOT in the
// documented shared/map-logic export list, so they stay as direct
// `window.electronAPI.invoke` calls here — but now isolated in this
// one module instead of inline in the component. If a generic
// "unpack → patch lua → repack → copy back" helper already exists in
// scmapIO, this whole module should be replaced with a call to it.
// ─────────────────────────────────────────────────────────────────

import { ensureDir, writeFile, readFile, finalizeMapName } from '../../../Shared/MapLogic';
import { buildPlanetLua, buildPlanetsJson } from './generation';

function mapFolderPathFor(mapName, mapsFolder) {
  const finalName = finalizeMapName(mapName.trim());
  return { finalName, mapFolderPath: `${mapsFolder.trim()}\\${finalName}` };
}

export async function exportPlanetsJson({ mapName, mapsFolder, stars }) {
  const { mapFolderPath } = mapFolderPathFor(mapName, mapsFolder);
  await ensureDir(mapFolderPath);

  const planetsArray = buildPlanetsJson(stars);
  const jsonContent = `"Planets": ${JSON.stringify(planetsArray, null, 4)}`;

  // Listing the folder to avoid clobbering a previous export still goes
  // through the raw IPC channel — `list-dir` isn't part of the documented
  // shared/map-logic surface.
  const dirEntries = await window.electronAPI.invoke('list-dir', { dirPath: mapFolderPath });
  let maxIdx = 0, hasSingle = false;
  for (const e of (dirEntries?.entries || [])) {
    if (e.name === 'stars_planets.json') hasSingle = true;
    const m = e.name.match(/^stars_planets(\d+)\.json$/);
    if (m) maxIdx = Math.max(maxIdx, parseInt(m[1]));
  }
  const fileName = maxIdx > 0 ? `stars_planets${maxIdx + 1}.json`
                 : hasSingle  ? `stars_planets1.json`
                 : `stars_planets.json`;

  await writeFile(`${mapFolderPath}\\${fileName}`, jsonContent);
  return { fileName, mapFolderPath };
}

export async function injectStarsIntoScmap({ mapName, mapsFolder, stars, settings, onRecordSnapshot }) {
  const { finalName, mapFolderPath } = mapFolderPathFor(mapName, mapsFolder);

  const dirEntries = await window.electronAPI.invoke('list-dir', { dirPath: mapFolderPath });
  if (!dirEntries?.success) throw new Error('Could not read map folder.');
  const scmapEntry = dirEntries.entries.find(e => !e.isDirectory && e.name.toLowerCase().endsWith('.scmap'));
  if (!scmapEntry) throw new Error(`No .scmap file found in ${mapFolderPath} `);
  const scmapPath = `${mapFolderPath}\\${scmapEntry.name}`;

  const unpackRes = await window.electronAPI.invoke('scmap-unpack', { scmapPath });
  if (!unpackRes.success) throw new Error(`Unpack failed: ${unpackRes.error}`);
  const unpackedFolder = unpackRes.outputFolder;

  const snapBeforeRes = await window.electronAPI.invoke('scmap-snapshot-folder', { folderPath: unpackedFolder });
  const snapBefore = snapBeforeRes?.snapshot ?? null;

  const dataLuaPath = `${unpackedFolder}\\data.lua`;
  let dataLua = await readFile(dataLuaPath);

  const newPlanetLua = buildPlanetLua(stars);
  const planetsRegex = /(skyBox\s*=\s*\{[\s\S]*?planets\s*=\s*\{)([\s\S]*?)(\n {8}\},)/;
  if (!planetsRegex.test(dataLua)) throw new Error('planets section not found in skyBox.');
  dataLua = dataLua.replace(planetsRegex, (_, open, existing, close) => `${open}${existing}${newPlanetLua}${close}`);
  dataLua = dataLua.replace(/(\bversion\s*=\s*)(\d+)(\s*,)/, (m, pre, num, post) =>
    parseInt(num, 10) !== 60 ? `${pre}60${post}` : m);

  await writeFile(dataLuaPath, dataLua);

  const snapAfterRes = await window.electronAPI.invoke('scmap-snapshot-folder', { folderPath: unpackedFolder });
  const snapAfter = snapAfterRes?.snapshot ?? null;
  if (snapBefore && snapAfter) onRecordSnapshot('stars', finalName, snapBefore, snapAfter);

  const mapNameForPack = unpackedFolder.split(/[\\/]/).pop();
  const packRes = await window.electronAPI.invoke('scmap-pack', { mapName: mapNameForPack });
  if (!packRes.success) throw new Error(`Pack failed: ${packRes.error}`);

  const copyRes = await window.electronAPI.invoke('copy-file', { src: packRes.outputPath, dest: scmapPath });
  if (!copyRes?.success) throw new Error('Could not copy repacked .scmap back.');

  const currentSettings = await window.electronAPI.invoke('settings-load');
  if (currentSettings?.autoOpenExportFolder) {
    await window.electronAPI.invoke('open-folder', { folderPath: mapFolderPath });
  }

  return { finalName, mapFolderPath, scmapName: scmapEntry.name };
}
