import { useState } from 'react';

/**
 * useState variant that mirrors every change into the tab's shared store via
 * `onSharedChange(key, nextValue)`. Replaces the hand-written
 * `setXxxState` + wrapper boilerplate in the placement tabs.
 *
 * Supports functional updates exactly like useState.
 *
 * @param {object}   shared         the shared store object passed to the tab
 * @param {string}   key            prefixed shared key, e.g. 'em_mapName'
 * @param {*}        initial        fallback when `shared[key]` is undefined
 * @param {Function} onSharedChange (key, value) => void
 */
export function usePersistentState(shared, key, initial, onSharedChange) {
  const [value, setValue] = useState(shared?.[key] ?? initial);

  const set = (next) => {
    setValue(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      onSharedChange(key, resolved);
      return resolved;
    });
  };

  return [value, set];
}
