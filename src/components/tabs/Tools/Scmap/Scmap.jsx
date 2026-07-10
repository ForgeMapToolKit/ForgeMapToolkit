import React, { useState, useEffect } from 'react';
import '../../../Shared/shared.css';
import '../../../Shared/DesignSystem/index.css';
import '../../../Shared/trace.css';
import TabLayout                                        from '../../../Shared/Ui/TabLayout/TabLayout';
import { useFileDrop, FileDragOverlay, DropSlot }      from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import './Scmap.css';
import ScmapHelpModal from '../../HelpModals/Scmap_help.jsx';

const getFilePath = (file) => {
  try { if (window.electronAPI?.getPathForFile) return window.electronAPI.getPathForFile(file); } catch (_) {}
  return file.path ?? null;
};

export default function ScmapTool({ settings }) {
  // ── Unpack state ──────────────────────────────────────────────────
  const [unpackSrc,        setUnpackSrc]        = useState('');
  const [unpacking,        setUnpacking]        = useState(false);
  const [unpackDone,       setUnpackDone]       = useState(false);
  const [unpackStatus,     setUnpackStatus]     = useState(null); // null | { ok, text }
  const [lastOutputFolder, setLastOutputFolder] = useState(null);

  // ── Pack state ────────────────────────────────────────────────────
  const [maps,       setMaps]       = useState([]);
  const [packing,    setPacking]    = useState(null);
  const [packStatus, setPackStatus] = useState(null); // null | { ok, text }

  // ── Help modal state ──────────────────────────────────────────────
  const [showHelp,        setShowHelp]        = useState(false);
  const [activeHelpTab,   setActiveHelpTab]   = useState('main');
  const [helpSelected,    setHelpSelected]    = useState(null);
  const [activeAdvSubTab, setActiveAdvSubTab] = useState('workflow');

  // ── Global drag ───────────────────────────────────────────────────
  const { isDragging, dropHandlers } = useFileDrop({
    accept: file => file.name.toLowerCase().endsWith('.scmap'),
    onDrop: file => acceptDroppedFile(file),
  });

  // ── Load map list (sorted by mtime desc) ─────────────────────────
  async function loadMaps() {
    const res = await window.electronAPI.invoke('scmap-list');
    if (res.success) {
      const normalised = (res.maps || []).map(m =>
        typeof m === 'string' ? { name: m, mtime: 0 } : m
      );
      normalised.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
      setMaps(normalised);
    }
  }
  useEffect(() => { loadMaps(); }, []);

  // ── Browse for .scmap — triggers unpack immediately ──────────────
  async function browse() {
    const res = await window.electronAPI.invoke('scmap-select-file');
    if (res?.path) {
      setUnpackSrc(res.path);
      setUnpackDone(false);
      await doUnpackPath(res.path);
    }
  }

  // ── Accept a dropped .scmap file ─────────────────────────────────
  async function acceptDroppedFile(file) {
    const fp = getFilePath(file);
    if (!fp) return;
    setUnpackSrc(fp);
    setUnpackDone(false);
    await doUnpackPath(fp);
  }

  // ── Unpack ────────────────────────────────────────────────────────
  async function doUnpackPath(srcPath) {
    if (!srcPath || unpacking) return;
    setUnpacking(true);
    setUnpackDone(false);
    setUnpackStatus(null);
    const res = await window.electronAPI.invoke('scmap-unpack', { scmapPath: srcPath });
    if (res.success) {
      setUnpackDone(true);
      setUnpackStatus({ ok: true, text: `✓ Done — ${res.outputFolder}` });
      setLastOutputFolder(res.outputFolder);
      loadMaps();
      if (settings?.autoOpenExportFolder) {
        await window.electronAPI.invoke('open-folder', { folderPath: res.outputFolder });
      }
    } else {
      setUnpackStatus({ ok: false, text: `✗ ${res.error}` });
    }
    setUnpacking(false);
  }

  // ── Pack ──────────────────────────────────────────────────────────
  async function doPack(mapName) {
    if (packing) return;
    setPacking(mapName);
    setPackStatus(null);
    const res = await window.electronAPI.invoke('scmap-pack', { mapName, _caller: 'scmap-tab' });
    if (res.success) {
      setPackStatus({ ok: true, text: `✓ ${res.outputPath} (${(res.bytes / 1024).toFixed(1)} KB)` });
      loadMaps();
      if (settings?.autoOpenExportFolder && res.outputPath) {
        const folder = res.outputPath.replace(/[\\/][^\\/]+$/, '');
        await window.electronAPI.invoke('open-folder', { folderPath: folder });
      }
    } else {
      setPackStatus({ ok: false, text: `✗ ${res.error}` });
    }
    setPacking(null);
  }

  // ── Open folder helper ────────────────────────────────────────────
  async function openFolder(path) {
    await window.electronAPI.invoke('open-folder', { folderPath: path });
  }

  // ── Pop out ───────────────────────────────────────────────────────
  async function popOut() {
    await window.electronAPI.invoke('open-tool-window', { tool: 'scmap' });
  }

  // ── Helpers ───────────────────────────────────────────────────────
  const srcName = unpackSrc ? unpackSrc.split(/[\\/]/).pop().replace(/\.scmap$/i, '') : null;

  const fmtDate = ts => {
    if (!ts) return null;
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
      + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const sectionMeta = { id: 'console', index: '01', label: 'Console', desc: 'Unpack a .scmap into its named blocks, then reassemble any listed map back to binary.', done: unpackDone };

  // ── Aside (Repack) ───────────────────────────────────────────────────
  const asideSlot = (
    <>
      {/* Invisible clone of TabLayout's section header — the aside has no
          header of its own, so without this "Repack" would start ~200px
          above "Unpack". Same markup/classes as SectionHeader (TabLayout.jsx)
          so it always matches the real header's height exactly, even if the
          description text reflows. */}
      <div className="section-header" aria-hidden="true" style={{ visibility: 'hidden', pointerEvents: 'none' }}>
        <h2 className="section-title">{sectionMeta.label}</h2>
        <div className="section-trace"><div className="section-trace-line" /><div className="section-trace-hot" /></div>
        <p className="section-desc">{sectionMeta.desc}</p>
      </div>
      <div className="ctrl-block">
        <div className="mp-subtitle">Repack</div>
        <div className="mp-action-row">
          <button className="ctrl-btn-add" onClick={loadMaps}>Refresh List</button>
          <button className="ctrl-btn-add" onClick={popOut} title="Open in separate window">Pop Out</button>
        </div>

        <div className="scmap-list">
          {maps.length === 0 ? (
            <div className="scmap-empty">No unpacked maps found</div>
          ) : maps.map(({ name, mtime }) => (
            <div className={`scmap-map-row${packing === name ? ' is-packing' : ''}`} key={name}>
              <div className="scmap-map-meta">
                <span className="scmap-map-name">{name}</span>
                {mtime ? <span className="scmap-map-date">{fmtDate(mtime)}</span> : null}
              </div>
              <button className="ctrl-btn-add" onClick={() => doPack(name)} disabled={!!packing}>
                {packing === name ? 'Packing…' : 'Pack'}
              </button>
            </div>
          ))}
        </div>

        {packStatus && (
          <div className={`scmap-status${packStatus.ok ? ' scmap-status--ok' : ' scmap-status--err'}`}>
            {packStatus.text}
          </div>
        )}

        <div className="scmap-credits">
          <span>Based on</span>
          <a
            href="https://github.com/The-Balthazar/BrewMapTool"
            onClick={e => { e.preventDefault(); window.electronAPI.invoke('open-external', 'https://github.com/The-Balthazar/BrewMapTool'); }}
          >BrewMapTool</a>
          <span>by</span>
          <a
            href="https://github.com/The-Balthazar"
            onClick={e => { e.preventDefault(); window.electronAPI.invoke('open-external', 'https://github.com/The-Balthazar'); }}
          >The-Balthazar</a>
        </div>
      </div>
    </>
  );

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div
      className={`scmap-tab trace-tab${isDragging ? ' scmap-global-drag' : ''}`}
      {...dropHandlers}
    >
      <button
        className="help-btn"
        onClick={() => { setShowHelp(h => !h); setHelpSelected(null); }}
        title="Help Guide"
      >?</button>

      {showHelp && (
        <ScmapHelpModal
          onClose={() => setShowHelp(false)}
          activeTab={activeHelpTab}
          setActiveTab={t => { setActiveHelpTab(t); setHelpSelected(null); }}
          helpSelected={helpSelected}
          setHelpSelected={setHelpSelected}
          activeAdvSubTab={activeAdvSubTab}
          setActiveAdvSubTab={setActiveAdvSubTab}
        />
      )}

      {isDragging && (
        <FileDragOverlay
          label="Drop .scmap to unpack"
          sub="Release anywhere — extraction starts immediately"
        />
      )}

      <TabLayout
        sections={[sectionMeta]}
        activeSection="console"
        onSelect={() => {}}
        railStorageKey="scmap-rail-pinned"
        navLabel="SCMAP console navigation"
        asideSlot={asideSlot}
        asideCaption={null}
        asideMirror={null}
      >
        <div className="ctrl-col">
          <div className="ctrl-block">
            <div className="ctrl-subtitle">Unpack</div>
            <div className="ctrl-content">
              <DropSlot
                status={unpacking ? 'busy' : unpackSrc ? 'done' : 'idle'}
                idleText="Drop .scmap here"
                hint="or click to browse — unpacks immediately"
                busyText={`Extracting — ${unpackSrc.split(/[\\/]/).pop()}`}
                doneText={unpackDone ? `${srcName}.scmap` : unpackSrc.split(/[\\/]/).pop()}
                accept={f => f.name.toLowerCase().endsWith('.scmap')}
                onClick={unpacking ? undefined : browse}
                onClear={unpacking ? undefined : () => { setUnpackSrc(''); setUnpackDone(false); setUnpackStatus(null); }}
              />

              {unpackDone && lastOutputFolder && (
                <div className="ctrl-action-row">
                  <button className="ctrl-btn-add" onClick={() => openFolder(lastOutputFolder)}>
                    Open Output Folder
                  </button>
                </div>
              )}

              {srcName && (
                <div className="scmap-hint">public/scmap/<b>{srcName}.scmap</b>/</div>
              )}

              {unpackStatus && (
                <div className={`scmap-status${unpackStatus.ok ? ' scmap-status--ok' : ' scmap-status--err'}`}>
                  {unpackStatus.text}
                </div>
              )}
            </div>
          </div>
        </div>
      </TabLayout>
    </div>
  );
}
