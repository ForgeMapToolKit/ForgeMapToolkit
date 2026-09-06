import React, { useEffect, useState, useCallback } from 'react';
import { Dropdown } from '../../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

/**
 * TextureImportEditor — pick the texture a Texture node points at.
 *
 * Either type a path directly (a game path like
 * "/textures/environment/foo.dds", a "/maps/<map>/…" path, or an absolute
 * file), pick an unpacked map and take one of the textures its skyBox already
 * references — the map tells you where its planet/star atlas and cirrus live,
 * you just point at it — or browse to a texture file anywhere on disk (e.g.
 * one grabbed off the internet); that copies it into userData/imported-textures
 * so it loads like any other local file.
 */
export default function TextureImportEditor({ value, onChange, params, setParams }) {
  const [maps, setMaps] = useState([]);
  const [pickMap, setPickMap] = useState(params?.mapName || '');
  const [found, setFound] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [unpacking, setUnpacking] = useState(false);

  const refreshMaps = useCallback(async () => {
    try {
      const api = window.electronAPI;
      if (!api?.invoke) { setMsg('Texture browsing needs the desktop app'); return []; }
      const res = await api.invoke('scmap-list');
      const list = (res?.maps || []).map(m => m.name).filter(Boolean);
      setMaps(list);
      return list;
    } catch (err) { setMsg(err.message); return []; }
  }, []);

  useEffect(() => { refreshMaps(); }, [refreshMaps]);

  const loadSkyboxPaths = useCallback(async (mapName) => {
    if (!mapName) { setFound(null); return; }
    setBusy(true); setMsg('');
    try {
      const api = window.electronAPI;
      if (!api?.invoke) throw new Error('needs the desktop app');
      const res = await api.invoke('node-editor-read-skybox', { mapName });
      if (!res?.success) throw new Error(res?.error || 'read failed');
      setFound({ ...res.skybox, cubeMap: res.cubeMap });
    } catch (err) {
      setMsg(`⚠ ${err.message}`);
      setFound(null);
    } finally { setBusy(false); }
  }, []);

  const choose = (p) => setParams({ path: p, mapName: pickMap });

  const [browsingFile, setBrowsingFile] = useState(false);
  const browseTextureFile = useCallback(async () => {
    setBrowsingFile(true); setMsg('');
    try {
      const api = window.electronAPI;
      if (!api?.invoke) throw new Error('needs the desktop app');
      const res = await api.invoke('node-editor-browse-texture-file');
      if (res?.canceled) return;
      if (!res?.success) throw new Error(res?.error || 'import failed');
      setParams({ path: res.path, mapName: '' });
      setMsg(`✓ Imported ${res.path}`);
    } catch (err) {
      setMsg(`⚠ ${err.message}`);
    } finally {
      setBrowsingFile(false);
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
      setPickMap(res.mapName);
      await loadSkyboxPaths(res.mapName);
      setMsg(`✓ Unpacked ${res.mapName}`);
    } catch (err) {
      setMsg(`⚠ ${err.message}`);
    } finally {
      setUnpacking(false);
    }
  }, [refreshMaps, loadSkyboxPaths]);

  // ── Stock (vanilla) asset browser ───────────────────────────────────────
  const [assetQuery, setAssetQuery] = useState('');
  const [assets, setAssets] = useState([]);
  const [assetBusy, setAssetBusy] = useState(false);

  const searchAssets = useCallback(async (q) => {
    setAssetQuery(q);
    if (!q || q.length < 3) { setAssets([]); return; }
    setAssetBusy(true);
    try {
      const api = window.electronAPI;
      if (!api?.invoke) throw new Error('needs the desktop app');
      const res = await api.invoke('node-editor-list-assets', { filter: q, limit: 60 });
      setAssets(res?.assets || []);
      if (!res?.success && res?.error) setMsg(`⚠ ${res.error}`);
    } catch (err) {
      setMsg(`⚠ ${err.message}`);
      setAssets([]);
    } finally { setAssetBusy(false); }
  }, []);

  const rows = found ? [
    ['Planet/star atlas', found.albedo],
    ['Atlas glow', found.glow],
    ['Cirrus', found.cirrusTexture],
    ['Reflection cube', found.cubeMap],
  ].filter(([, v]) => v) : [];

  return (
    <div className="ne-scmap-editor">
      <input
        className="ctrl-input ne-tex-path"
        type="text"
        placeholder="/textures/environment/….dds"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        spellCheck={false}
      />
      <button className="ctrl-btn-add ne-scmap-browse" onClick={browseTextureFile} disabled={browsingFile}>
        {browsingFile ? 'Importing…' : 'Browse texture file…'}
      </button>

      <div className="ne-scmap-row">
        <Dropdown
          value={pickMap}
          onChange={v => { setPickMap(v); loadSkyboxPaths(v); }}
          ariaLabel="Map skybox"
          options={[{ value: '', label: "— browse a map's skybox —" }, ...maps.map(m => ({ value: m, label: m }))]}
        />
        {busy && <span className="ne-hint">Reading…</span>}
      </div>
      <button className="ctrl-btn-add ne-scmap-browse" onClick={browseAndUnpack} disabled={busy || unpacking}>
        {unpacking ? 'Unpacking…' : 'Browse .scmap…'}
      </button>

      {/* Stock game assets — waterramps, cirrus sheets, envcubes … */}
      <div className="ne-scmap-row">
        <input
          className="ctrl-input ctrl-input--text ne-scmap-search"
          type="text"
          placeholder="search stock assets (e.g. waterramp)"
          value={assetQuery}
          onChange={e => searchAssets(e.target.value)}
          spellCheck={false}
        />
        {assetBusy && <span className="ne-hint">…</span>}
      </div>
      <div className="ne-uv-presets">
        {['waterramp', 'cirrus', 'envcube'].map(q => (
          <button key={q} className="ctrl-btn-add" onClick={() => searchAssets(q)}>{q}</button>
        ))}
      </div>
      {assets.length > 0 && (
        <div className="ne-scmap-found ne-asset-list">
          {assets.map(p => (
            <button key={p} className="station ne-scmap-pick" onClick={() => choose(p)} title={p}>
              <code className="ne-scmap-tex-path">{p}</code>
            </button>
          ))}
        </div>
      )}

      {msg && <p className="ne-hint">{msg}</p>}

      {rows.length > 0 && (
        <div className="ne-scmap-found">
          {rows.map(([label, p]) => (
            <button key={label} className="station ne-scmap-pick" onClick={() => choose(p)} title={p}>
              <span className="ne-scmap-tex-label">{label}</span>
              <code className="ne-scmap-tex-path">{p}</code>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
