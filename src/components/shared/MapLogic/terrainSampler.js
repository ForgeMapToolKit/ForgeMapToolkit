// ── Real terrain elevation for the procedural scatter tabs (TreeMap, Rock Erosion) ──
// The engine always snaps props/rocks to actual terrain height at load time, but the
// in-app editor previously wrote y=0 — fine for the game, unusable for manual nudges
// in the editor. This reads the real heightmap + water elevation straight out of the
// .scmap binary (scmapUtils.readDatastream on the main-process side) so markers can
// carry a real Y, get masked against water, and get filtered by real slope.

import { useState, useEffect } from 'react';
import { finalizeMapName } from './mapGeometry';

const api = () => window.electronAPI;

/**
 * Fetches the raw heightmap + water elevation for the current map whenever
 * mapName / mapsFolderPath changes. Mirrors useMapInfo's fetch-on-change shape.
 *
 * @returns {{ terrain: object|null, terrainError: string|null }}
 *   terrain, when present: { size:[w,h], heightmapScale, heightmap:Uint8Array, waterPresent, waterElevation }
 */
export function useTerrainData({ mapName, mapsFolderPath, settings }) {
  const [terrain, setTerrain] = useState(null);
  const [terrainError, setTerrainError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const name   = (mapName || '').trim();
    const folder = (mapsFolderPath || settings?.mapsFolder || '').trim();
    if (!name || !folder) { setTerrain(null); setTerrainError(null); return; }

    (async () => {
      try {
        const mapFolderPath = `${folder}\\${finalizeMapName(name)}`;
        const dirRes = await api().invoke('list-dir', { dirPath: mapFolderPath });
        if (!dirRes?.success) throw new Error(dirRes?.error || 'map folder not found');
        const scmapEntry = dirRes.entries.find(e => !e.isDirectory && e.name.toLowerCase().endsWith('.scmap'));
        if (!scmapEntry) throw new Error('no .scmap file in map folder');
        const scmapPath = `${mapFolderPath}\\${scmapEntry.name}`;

        const res = await api().invoke('scmap-read-terrain', { scmapPath });
        if (cancelled) return;
        if (!res?.success) throw new Error(res?.error || 'scmap-read-terrain failed');

        const heightmap = new Uint8Array(res.heightmap || []);
        const expectedBytes = (res.size[0] + 1) * (res.size[1] + 1) * 2;
        if (heightmap.byteLength !== expectedBytes) {
          throw new Error(`heightmap size mismatch — got ${heightmap.byteLength} bytes, expected ${expectedBytes} (IPC transfer likely dropped the buffer)`);
        }

        setTerrain({
          size: res.size,
          heightmapScale: res.heightmapScale,
          heightmap,
          waterPresent: res.waterPresent,
          waterElevation: res.waterElevation,
        });
        setTerrainError(null);
      } catch (err) {
        if (cancelled) return;
        setTerrain(null);
        setTerrainError(err.message);
      }
    })();

    return () => { cancelled = true; };
  }, [mapName, mapsFolderPath, settings?.mapsFolder]);

  return { terrain, terrainError };
}

/**
 * Builds a { sampleHeight, sampleSlopeDegrees, isUnderwater } sampler over a
 * terrain object from useTerrainData. Returns null if terrain isn't loaded —
 * callers should fall back to y=0 / no slope-or-water filtering in that case.
 */
export function createTerrainSampler(terrain) {
  if (!terrain?.heightmap || !terrain.size) return null;

  const [sizeX, sizeZ] = terrain.size;
  const w = sizeX + 1, h = sizeZ + 1;
  const scale = terrain.heightmapScale;
  const view = new DataView(terrain.heightmap.buffer, terrain.heightmap.byteOffset, terrain.heightmap.byteLength);

  const rawAt = (gx, gz) => view.getUint16((gz * w + gx) * 2, true);

  // Bilinear-interpolated world height at (worldX, worldZ). 1 heightmap texel
  // = 1 world unit, grid anchored at world origin (0,0) — the same convention
  // map-resizer.js relies on when resampling heightmap.raw.
  const sampleHeight = (worldX, worldZ) => {
    const fx = Math.min(Math.max(worldX, 0), sizeX);
    const fz = Math.min(Math.max(worldZ, 0), sizeZ);
    const x0 = Math.floor(fx), z0 = Math.floor(fz);
    const x1 = Math.min(x0 + 1, w - 1), z1 = Math.min(z0 + 1, h - 1);
    const tx = fx - x0, tz = fz - z0;
    const h00 = rawAt(x0, z0), h10 = rawAt(x1, z0), h01 = rawAt(x0, z1), h11 = rawAt(x1, z1);
    const raw = h00 * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz;
    return raw * scale;
  };

  // Slope steepness in degrees from a central-difference gradient, one world
  // unit either side of the sample point.
  const sampleSlopeDegrees = (worldX, worldZ) => {
    const eps = 1;
    const dHdx = (sampleHeight(worldX + eps, worldZ) - sampleHeight(worldX - eps, worldZ)) / (2 * eps);
    const dHdz = (sampleHeight(worldX, worldZ + eps) - sampleHeight(worldX, worldZ - eps)) / (2 * eps);
    const gradMag = Math.sqrt(dHdx * dHdx + dHdz * dHdz);
    return Math.atan(gradMag) * (180 / Math.PI);
  };

  const isUnderwater = (worldX, worldZ) => {
    if (!terrain.waterPresent || terrain.waterElevation == null) return false;
    return sampleHeight(worldX, worldZ) < terrain.waterElevation;
  };

  return { sampleHeight, sampleSlopeDegrees, isUnderwater };
}
