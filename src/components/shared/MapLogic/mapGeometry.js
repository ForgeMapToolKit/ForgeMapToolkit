// ── Pure map-geometry helpers shared by Emitter / Props / Wreckage tabs ──────────

/**
 * Mirror a world coordinate across the map's symmetry axis.
 * @param {number} x       world X
 * @param {number} z       world Z
 * @param {number|string} mapSize playable map size (defaults to 1024)
 * @param {string} mode    'diagonal' | 'horizontal' | 'vertical' | 'none'
 * @param {number} offsetX map origin offset, used to mirror around the playable centre
 * @returns {{x:number, z:number}|null}
 */
export const getMirroredCoords = (x, z, mapSize, mode, offsetX = 0) => {
  const ms  = parseFloat(mapSize) || 1024;
  const far = 2 * offsetX + ms;
  switch (mode) {
    case 'diagonal':   return { x: far - x, z: far - z };
    case 'horizontal': return { x,          z: far - z };
    case 'vertical':   return { x: far - x, z          };
    default:           return null;
  }
};

/** Append `.v0001` unless the name already carries a `.vNNNN` suffix. */
export const finalizeMapName = (name) => {
  const n = (name || '').trim();
  return /\.v\d{4}$/.test(n) ? n : `${n}.v0001`;
};

/** Human-readable km label for a given map size, e.g. "20×20" or "10.0×10.0". */
export const kmLabel = (size) => {
  const kmPerUnit = 20 / 1024;
  const km = (parseFloat(size) || 1024) * kmPerUnit;
  return Number.isInteger(km) ? `${km}×${km}` : `${km.toFixed(1)}×${km.toFixed(1)}`;
};
