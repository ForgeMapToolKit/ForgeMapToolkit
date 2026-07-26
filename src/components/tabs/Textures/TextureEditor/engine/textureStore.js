/**
 * textureStore.js — async game-texture cache for source nodes.
 *
 * Node `render` must stay synchronous and pure, but a game texture has to come
 * over IPC (resolve the path in a .scd / next to the map, decode the DDS). The
 * store bridges that: `request(path)` returns the current entry immediately —
 * `loading` on the first call, `ready` with a GL texture once it arrives — and
 * fires `onChange` when the state flips so the editor can invalidate the
 * evaluator cache and re-render. The document still only holds the path.
 *
 * Entries are keyed by path+map, so two nodes pointing at the same texture
 * share one upload.
 */

const keyOf = (texturePath, mapName) => `${mapName || ''}|${texturePath || ''}`;

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function createTextureStore(ctx, onChange) {
  const cache = new Map(); // key -> { state, tex?, w?, h?, error? }

  function get(texturePath, mapName) {
    return cache.get(keyOf(texturePath, mapName)) || null;
  }

  /** Synchronous: returns the entry now, kicking off a load on first sight. */
  function request(texturePath, mapName) {
    if (!texturePath) return null;
    const key = keyOf(texturePath, mapName);
    const hit = cache.get(key);
    if (hit) return hit;

    const entry = { state: 'loading' };
    cache.set(key, entry);

    (async () => {
      try {
        const api = typeof window !== 'undefined' && window.electronAPI;
        if (!api?.invoke) throw new Error('texture loading needs the desktop app');
        const res = await api.invoke('node-editor-load-texture', { texturePath, mapName });
        if (!res?.success) throw new Error(res?.error || 'load failed');

        const bytes = base64ToBytes(res.rgba);
        const imgData = new ImageData(new Uint8ClampedArray(bytes), res.width, res.height);
        const bitmap = await createImageBitmap(imgData);
        const t = ctx.uploadImageTexture(bitmap);
        bitmap.close?.();

        entry.tex = t.tex; entry.target = t; entry.w = res.width; entry.h = res.height;
        entry.state = 'ready';
      } catch (err) {
        entry.state = 'error';
        entry.error = err.message;
      }
      onChange?.(entry);
    })();

    return entry;
  }

  /** Forget one path (or all), so the next request re-fetches it. */
  function forget(texturePath, mapName) {
    if (texturePath === undefined) {
      for (const e of cache.values()) if (e.target) ctx.freeTarget(e.target);
      cache.clear();
      return;
    }
    const key = keyOf(texturePath, mapName);
    const e = cache.get(key);
    if (e?.target) ctx.freeTarget(e.target);
    cache.delete(key);
  }

  function dispose() { forget(); }

  return { get, request, forget, dispose };
}
