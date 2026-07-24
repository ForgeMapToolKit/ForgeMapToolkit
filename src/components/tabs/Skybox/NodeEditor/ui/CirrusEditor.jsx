import React, { useEffect, useState, useCallback } from 'react';

/**
 * CirrusEditor — pulls the four cirrus layers straight out of a map's data.lua.
 *
 * Same pattern as SkyGradientEditor: pick a map FMT has already unpacked, or
 * "Browse .scmap…" one that's never been opened here (unpacks it first). "Read
 * cirrus" then writes cirrusColor/cirrusMultiplier and all four layers'
 * freqX/freqY/direction/speed into the node's params in one go — after that
 * they're plain params like any other (§1.1: render stays a pure function of
 * params, no live binding to the file).
 */
export default function CirrusEditor({ params, setParams }) {
  const [maps, setMaps] = useState([]);
  const [busy, setBusy] = useState(false);
  const [unpacking, setUnpacking] = useState(false);
  const [msg, setMsg] = useState('');
  const selected = params?.scmapMap || '';

  const refreshMaps = useCallback(async () => {
    try {
      const api = window.electronAPI;
      if (!api?.invoke) { setMsg('Map list needs the desktop app'); return []; }
      const res = await api.invoke('scmap-list');
      const list = (res?.maps || []).map(m => m.name).filter(Boolean);
      setMaps(list);
      return list;
    } catch (err) {
      setMsg(err.message);
      return [];
    }
  }, []);

  useEffect(() => { refreshMaps(); }, [refreshMaps]);

  const readCirrus = useCallback(async (mapName) => {
    if (!mapName) { setMsg('Pick a map first'); return; }
    setBusy(true); setMsg('');
    try {
      const api = window.electronAPI;
      if (!api?.invoke) throw new Error('reading a .scmap needs the desktop app');
      const res = await api.invoke('node-editor-read-skybox', { mapName });
      if (!res?.success) throw new Error(res?.error || 'read failed');
      const s = res.skybox;
      const layers = s.cirrusLayers || [];
      const patch = { color: s.cirrusColor, mult: s.cirrusMultiplier };
      layers.slice(0, 4).forEach((l, i) => {
        const n = i + 1;
        patch[`fx${n}`] = l.freqX;
        patch[`fy${n}`] = l.freqY;
        patch[`d${n}`] = l.dirDeg;
        patch[`s${n}`] = l.speed;
      });
      setParams(patch);
      setMsg(layers.length
        ? `✓ Read ${layers.length} cirrus layer(s) from ${mapName}${s.cirrusTexture ? ` — texture: ${s.cirrusTexture}` : ''}`
        : `⚠ ${mapName} has no cirrusLayers in data.lua`);
    } catch (err) {
      setMsg(`⚠ ${err.message}`);
    } finally {
      setBusy(false);
    }
  }, [setParams]);

  const browseAndUnpack = useCallback(async () => {
    setUnpacking(true); setMsg('');
    try {
      const api = window.electronAPI;
      if (!api?.invoke) throw new Error('needs the desktop app');
      const picked = await api.invoke('scmap-select-file');
      if (picked?.canceled) return;
      const res = await api.invoke('scmap-unpack', { scmapPath: picked.path });
      if (!res?.success) throw new Error(res?.error || 'unpack failed');
      await refreshMaps();
      setParams({ scmapMap: res.mapName });
      await readCirrus(res.mapName);
    } catch (err) {
      setMsg(`⚠ ${err.message}`);
    } finally {
      setUnpacking(false);
    }
  }, [refreshMaps, setParams, readCirrus]);

  return (
    <div className="ne-scmap-editor">
      <div className="ne-scmap-row">
        <select
          className="ne-scmap-select"
          value={selected}
          onChange={e => setParams({ scmapMap: e.target.value })}
        >
          <option value="">— unpacked map —</option>
          {maps.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <button className="ne-btn ne-btn-mini" onClick={() => readCirrus(selected)} disabled={busy || unpacking || !selected}>
          {busy ? 'Reading…' : 'Read cirrus'}
        </button>
      </div>
      <button className="ne-btn ne-btn-mini ne-scmap-browse" onClick={browseAndUnpack} disabled={busy || unpacking}>
        {unpacking ? 'Unpacking…' : 'Browse .scmap…'}
      </button>

      {msg && <p className="ne-hint">{msg}</p>}
      <p className="ne-hint">
        Wire the map's own cirrus texture into the input above (see its Import
        Texture node, or the path shown after reading) — the layers only mean
        anything sampled against the texture they were tuned for.
      </p>
    </div>
  );
}
