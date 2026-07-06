// ── Shared Electron/IPC file helpers for the placement tabs ──────────────────────
// All functions run in the renderer and use the global `window.electronAPI` bridge,
// exactly like the inline helpers they replace in the Emitter / Props / Wreckage tabs.

const api = () => window.electronAPI;

/** Create a directory (throws on failure). */
export const ensureDir = async (dirPath) => {
  const r = await api().invoke('ensure-dir', { dirPath });
  if (!r?.success) throw new Error(r?.error || 'ensure-dir failed');
};

/** Write a file (throws on failure). */
export const writeFile = async (filePath, content) => {
  const r = await api().invoke('write-file', { filePath, content });
  if (!r?.success) throw new Error(r?.error || 'write-file failed');
};

/** Read a file, returning its string content (or '' if unavailable). */
export const readFile = async (path) => {
  const r = await api().invoke('read-file', { path });
  return r?.content || '';
};

/**
 * Unpack the .scmap in a map folder and return the preview image as a data URL.
 * Returns null if anything is missing. Never throws.
 */
export const loadScmapPreview = async (mapFolderPath) => {
  try {
    const dirRes = await api().invoke('list-dir', { dirPath: mapFolderPath });
    if (!dirRes?.success) return null;
    const scmapEntry = dirRes.entries.find(e => !e.isDirectory && e.name.toLowerCase().endsWith('.scmap'));
    if (!scmapEntry) return null;
    const scmapPath = mapFolderPath + '\\' + scmapEntry.name;
    const unpackRes = await api().invoke('scmap-unpack', { scmapPath });
    if (!unpackRes?.success) return null;
    const unpackDir = await api().invoke('list-dir', { dirPath: unpackRes.outputFolder });
    if (!unpackDir?.success) return null;
    const previewEntry = unpackDir.entries.find(e => /^previewimage/i.test(e.name));
    if (!previewEntry) return null;
    const ddsPath = unpackRes.outputFolder + '\\' + previewEntry.name;
    const ddsRes = await api().invoke('dds-to-dataurl', { filePath: ddsPath });
    return (ddsRes?.success && ddsRes.dataUrl) ? ddsRes.dataUrl : null;
  } catch (e) {
    console.warn('[scmapIO] preview load failed:', e);
    return null;
  }
};

/** Pick the next free props*.lua filename given a list-dir entry array. */
export const nextPropsLuaName = (entries = []) => {
  let maxIdx = 0;
  let hasSingle = false;
  for (const e of entries) {
    if (e.name === 'props.lua') hasSingle = true;
    const m = e.name.match(/^props(\d+)\.lua$/);
    if (m) maxIdx = Math.max(maxIdx, parseInt(m[1]));
  }
  return maxIdx > 0 ? `props${maxIdx + 1}.lua`
       : hasSingle  ? `props1.lua`
       : `props.lua`;
};

/**
 * Write the generated props.lua either raw into the map folder, or by
 * unpacking the .scmap, injecting the chunk and repacking.
 * Lists the map folder internally to determine the next free filename.
 * @returns {Promise<{ propsLuaFileName: string }>}
 */
export const injectPropsLua = async ({ mapFolderPath, content, exportRawLua }) => {
  const existing = await api().invoke('list-dir', { dirPath: mapFolderPath });
  const entries = existing?.entries || [];
  const propsLuaFileName = nextPropsLuaName(entries);

  if (exportRawLua) {
    await writeFile(`${mapFolderPath}\\${propsLuaFileName}`, content);
    return { propsLuaFileName };
  }

  const scmapFile = entries.find(e => !e.isDirectory && e.name.toLowerCase().endsWith('.scmap'));
  if (!scmapFile) throw new Error(`No .scmap file found in ${mapFolderPath}`);
  const scmapPath = `${mapFolderPath}\\${scmapFile.name}`;

  const unpackRes = await api().invoke('scmap-unpack', { scmapPath });
  if (!unpackRes.success) throw new Error(`Unpack failed: ${unpackRes.error}`);
  const unpackedFolder = unpackRes.outputFolder;

  await writeFile(`${unpackedFolder}\\${propsLuaFileName}`, content);

  const mapNameForPack = unpackedFolder.split(/[\\/]/).pop();
  const packRes = await api().invoke('scmap-pack', { mapName: mapNameForPack });
  if (!packRes.success) throw new Error(`Pack failed: ${packRes.error}`);

  const copyBackRes = await api().invoke('copy-file', { src: packRes.outputPath, dest: scmapPath });
  if (!copyBackRes?.success) throw new Error('Failed to copy repacked .scmap back to map folder');

  return { propsLuaFileName };
};

/**
 * Fill in any missing toolkit emitter publicPaths (lost after app restart — not
 * persisted) by scanning the map's emitters and matching on filename.
 * @returns {Promise<Object>} a merged copy of known publicPaths
 */
export const resolveToolkitEmitterPublicPaths = async ({ paths, knownPublic = {}, mapsFolder, mapName }) => {
  const resolved = { ...knownPublic };
  const needLookup = paths.filter(p => p.trim() && !resolved[p.trim()]);
  if (needLookup.length === 0) return resolved;

  const scanRes = await api().invoke('scan-map-emitters', { mapsFolder, mapName });
  const scanned = scanRes?.emitters ?? [];
  for (const rawPath of needLookup) {
    const filename = rawPath.replace(/\\/g, '/').split('/').pop();
    const match = scanned.find(
      e => e.source === 'toolkit' && e.publicPath &&
           e.publicPath.replace(/\\/g, '/').split('/').pop() === filename
    );
    if (match) resolved[rawPath] = match.publicPath;
  }
  return resolved;
};
