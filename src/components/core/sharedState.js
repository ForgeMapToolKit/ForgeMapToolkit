/**
 * sharedState — persistence & cross-tab projection for the suite's shared store.
 *
 * The shared store is a flat object keyed by per-tab prefixes (em_, pt_, wr_, …).
 * Only a subset of keys survives across sessions (PERSIST_PREFIX); the map name
 * can be projected into every tab's map field at once (MAP_NAME_SHARED_KEYS).
 */

export const LS_KEY = 'fmtk_shared_state';

/** Prefixes whose keys are persisted to localStorage across sessions. */
export const PERSIST_PREFIX = ['tm_', 're_'];

/** Per-tab map-name keys that a saved settings.mapName is projected into. */
export const MAP_NAME_SHARED_KEYS = [
  'pt_mapName',  // Props
  'wr_mapName',  // Wreckages
  'cpt_mapName', // CustomProps
  'tm_mapName',  // TreeMap
  're_mapName',  // RockErosion
  'em_mapName',  // Emitter
  'sb_mapName',  // Stars + SkyboxGenerator (same key)
  'amh_mapName', // AdaptiveMapHelper
  'mr_mapName',  // MapResizer
];

/** Read the persisted slice of the shared store from localStorage. */
export const loadPersistedShared = () => {
  try {
    const saved = localStorage.getItem(LS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

/** Write only the persisted-prefix keys of `state` back to localStorage. */
export const persistShared = (state) => {
  try {
    const toPersist = Object.fromEntries(
      Object.entries(state).filter(([k]) => PERSIST_PREFIX.some(p => k.startsWith(p)))
    );
    localStorage.setItem(LS_KEY, JSON.stringify(toPersist));
  } catch {
    /* quota errors etc — fail silently */
  }
};

/** Return a new shared state with `mapName` projected into every tab's map field. */
export const projectMapName = (prev, mapName) => {
  const patch = {};
  for (const key of MAP_NAME_SHARED_KEYS) patch[key] = mapName;
  return { ...prev, ...patch };
};
