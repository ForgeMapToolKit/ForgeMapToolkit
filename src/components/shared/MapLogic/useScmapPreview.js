import { useState, useEffect } from 'react';
import { finalizeMapName } from './mapGeometry';
import { loadScmapPreview } from './scmapIO';

/**
 * Manages the map preview image for a placement tab:
 *  - resets + auto-loads the .scmap preview when map name / folder changes
 *  - decodes the data URL into an HTMLImageElement for canvas drawing
 *
 * Replaces the duplicated `loadPreviewFromScmap` + preview effects in the tabs.
 *
 * @returns {{ previewImage:HTMLImageElement|null, previewImageData:string|null,
 *             setPreviewImageData:Function, previewLoading:boolean }}
 */
export function useScmapPreview({ mapName, mapsFolderPath, settings }) {
  const [previewImage, setPreviewImage]         = useState(null);
  const [previewImageData, setPreviewImageData] = useState(null);
  const [previewLoading, setPreviewLoading]     = useState(false);

  // Reset + auto-load from the map's .scmap.
  useEffect(() => {
    setPreviewImageData(null);
    const name   = (mapName || '').trim();
    const folder = (mapsFolderPath || settings?.mapsFolder || '').trim();
    if (!name || !folder) return;
    const mapFolderPath = folder + '\\' + finalizeMapName(name);
    let cancelled = false;
    setPreviewLoading(true);
    loadScmapPreview(mapFolderPath)
      .then(dataUrl => { if (!cancelled && dataUrl) setPreviewImageData(dataUrl); })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapName, mapsFolderPath, settings?.mapsFolder]);

  // Decode data URL → Image for canvas drawing.
  useEffect(() => {
    if (previewImageData) {
      const img = new Image();
      img.onload = () => setPreviewImage(img);
      img.src = previewImageData;
    } else {
      setPreviewImage(null);
    }
  }, [previewImageData]);

  return { previewImage, previewImageData, setPreviewImageData, previewLoading };
}
