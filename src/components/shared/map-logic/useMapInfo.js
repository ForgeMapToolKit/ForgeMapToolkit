import { useState, useEffect } from 'react';
import { finalizeMapName } from './mapGeometry';

/**
 * Auto-fetches map metadata (size / km / playable area / origin offset) from the
 * map's save.lua whenever the map name or maps folder changes.
 *
 * Mirrors the `read-map-info` effect that was duplicated across the placement tabs.
 *
 * @param {object}   opts
 * @param {string}   opts.mapName
 * @param {string}   opts.mapsFolderPath
 * @param {object}   opts.settings
 * @param {Function} [opts.onMapSize] called with the playable size string on a
 *                                    successful read, for persisting into shared state
 * @returns {{ mapInfo:object|null, mapSize:string, mapOffsetX:number, mapOffsetY:number }}
 */
export function useMapInfo({ mapName, mapsFolderPath, settings, onMapSize }) {
  const [mapInfo, setMapInfo]       = useState(null);
  const [mapSize, setMapSize]       = useState('1024');
  const [mapOffsetX, setMapOffsetX] = useState(0);
  const [mapOffsetY, setMapOffsetY] = useState(0);

  useEffect(() => {
    const name   = (mapName || '').trim();
    const folder = (mapsFolderPath || settings?.mapsFolder || '').trim();
    if (!name || !folder) {
      setMapInfo(null); setMapSize('1024'); setMapOffsetX(0); setMapOffsetY(0);
      return;
    }
    const mapFolderPath = folder + '\\' + finalizeMapName(name);
    window.electronAPI.invoke('read-map-info', { mapFolderPath }).then(res => {
      if (res?.success) {
        setMapInfo({ ok: true, mapSize: res.mapSize, km: res.km, playableSize: res.playableSize, playableKm: res.playableKm });
        setMapSize(String(res.playableSize));
        setMapOffsetX(res.x1); setMapOffsetY(res.y1);
        onMapSize?.(String(res.playableSize));
      } else {
        setMapInfo({ ok: false, error: 'save.lua not found' });
        setMapSize('1024'); setMapOffsetX(0); setMapOffsetY(0);
      }
    }).catch(() => { setMapInfo(null); setMapSize('1024'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapName, mapsFolderPath, settings?.mapsFolder]);

  return { mapInfo, mapSize, mapOffsetX, mapOffsetY };
}
