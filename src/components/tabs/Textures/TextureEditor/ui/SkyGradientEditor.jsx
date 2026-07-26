import React, { useEffect, useState, useCallback } from 'react';
import { Dropdown } from '../../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

/**
 * SkyGradientEditor — pulls the sky straight out of a map's data.lua.
 *
 * Two ways to get a map into the dropdown: pick one FMT has already unpacked
 * (scmap-list), or "Browse .scmap…" a raw file that's never been opened here —
 * that unpacks it first (scmap-unpack, the same call the SCMAP tool uses) and
 * adds it to the list. Either way, "Read sky" then pulls the `skyBox` block
 * over IPC and writes it into the node's params. The read is an explicit
 * action, not a live binding: once pressed, the values are plain params like
 * any other, so the graph stays reproducible offline and `render` stays pure
 * (docs/NODE_EDITOR_PLAN.md §1.1).
 *
 * horizonHeight/zenithHeight/apexHeight go in verbatim — apexHeight is the
 * dome mesh's real top height (SkyboxGenerator's own scale/subHeight formula,
 * computed server-side from the map's own skyBox.scale/subHeight, falling
 * back to mapSize only for a never-configured skybox). `midColor` is not
 * read — the in-game shader never uses it.
 *
 * It also surfaces the texture paths the skyBox references (planet/star atlas,
 * cirrus, reflection cube) — those are what a Texture node wants to point at.
 */
export default function SkyGradientEditor({ params, setParams }) {
  const [maps, setMaps] = useState([]);
  const [busy, setBusy] = useState(false);
  const [unpacking, setUnpacking] = useState(false);
  const [msg, setMsg] = useState('');
  const [found, setFound] = useState(null);
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

  const readSky = useCallback(async (mapName) => {
    if (!mapName) { setMsg('Pick a map first'); return; }
    setBusy(true); setMsg('');
    try {
      const api = window.electronAPI;
      if (!api?.invoke) throw new Error('reading a .scmap needs the desktop app');
      const res = await api.invoke('node-editor-read-skybox', { mapName });
      if (!res?.success) throw new Error(res?.error || 'read failed');
      const s = res.skybox;
      setParams({
        horizon: s.horizon,
        zenith: s.zenith,
        horizonHeight: s.horizonHeight,
        zenithHeight: s.zenithHeight,
        apexHeight: s.apexHeight,
      });
      setFound({ ...s, cubeMap: res.cubeMap });
      setMsg(`✓ Read sky from ${mapName}`);
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
      setMsg(`✓ Unpacked ${res.mapName}`);
      await readSky(res.mapName);
    } catch (err) {
      setMsg(`⚠ ${err.message}`);
    } finally {
      setUnpacking(false);
    }
  }, [refreshMaps, setParams, readSky]);

  const texRows = found ? [
    ['Planet/star atlas', found.albedo],
    ['Atlas glow', found.glow],
    ['Cirrus', found.cirrusTexture],
    ['Reflection cube', found.cubeMap],
  ].filter(([, v]) => v) : [];

  return (
    <div className="ne-scmap-editor">
      <div className="ne-scmap-row">
        <Dropdown
          value={selected}
          onChange={v => setParams({ scmapMap: v })}
          ariaLabel="Unpacked map"
          options={[{ value: '', label: '— unpacked map —' }, ...maps.map(m => ({ value: m, label: m }))]}
        />
        <button className="ctrl-btn-add" onClick={() => readSky(selected)} disabled={busy || unpacking || !selected}>
          {busy ? 'Reading…' : 'Read sky'}
        </button>
      </div>
      <button className="ctrl-btn-add ne-scmap-browse" onClick={browseAndUnpack} disabled={busy || unpacking}>
        {unpacking ? 'Unpacking…' : 'Browse .scmap…'}
      </button>

      {msg && <p className="ne-hint">{msg}</p>}

      {found && (
        <div className="ne-scmap-found">
          <div className="ne-scmap-found-title">Real heights (apex from scale/subHeight — SkyboxGenerator's own dome formula)</div>
          <div className="ne-scmap-heights">
            <span>horizon {found.horizonHeight.toFixed(0)}</span>
            <span>zenith {found.zenithHeight.toFixed(0)}</span>
            <span>apex {found.apexHeight.toFixed(0)}</span>
          </div>
        </div>
      )}

      {texRows.length > 0 && (
        <div className="ne-scmap-found">
          <div className="ne-scmap-found-title">Textures referenced by this skybox</div>
          {texRows.map(([label, p]) => (
            <div key={label} className="ne-scmap-tex">
              <span className="ne-scmap-tex-label">{label}</span>
              <code className="ne-scmap-tex-path" title={p}>{p}</code>
            </div>
          ))}
          <p className="ne-hint">Copy a path into a Texture node to display it.</p>
        </div>
      )}
    </div>
  );
}
