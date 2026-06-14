import React, { useState, useEffect, useRef } from 'react';
import '../../../shared/shared.css';
import '../../../shared/design-system/index.css';
import WorkspaceConsole from '../../../shared/WorkspaceConsole/WorkspaceConsole.jsx';
import './Scmap.css';
import ScmapHelpModal from '../../HelpModals/Scmap_help.jsx';

const getFilePath = (file) => {
  try { if (window.electronAPI?.getPathForFile) return window.electronAPI.getPathForFile(file); } catch (_) {}
  return file.path ?? null;
};

export default function ScmapTool({ settings }) {
  // ── Unpack state ──────────────────────────────────────────────────
  const [unpackSrc, setUnpackSrc]   = useState('');
  const [unpacking, setUnpacking]   = useState(false);
  const [unpackLog, setUnpackLog]   = useState([]);
  const [unpackDone, setUnpackDone] = useState(false);
  const [lastOutputFolder, setLastOutputFolder] = useState(null);

  // ── Pack state ────────────────────────────────────────────────────
  const [maps, setMaps]             = useState([]);   // [{ name, mtime }]
  const [packing, setPacking]       = useState(null);
  const [packLog, setPackLog]       = useState([]);

  // ── Ref to track unpacking without stale closures ─────────────────
  const unpackingRef = useRef(false);

  // ── Help modal state ─────────────────────────────────────────────
  const [showHelp,        setShowHelp]        = useState(false);
  const [activeHelpTab,   setActiveHelpTab]   = useState('main');
  const [helpSelected,    setHelpSelected]    = useState(null);
  const [activeAdvSubTab, setActiveAdvSubTab] = useState('workflow');

  // ── Active console section (rail) ─────────────────────────────────
  const [activeSection, setActiveSection] = useState('unpack');

  // ── Drag state (global drop onto the whole tab) ───────────────────
  const [globalDrag, setGlobalDrag] = useState(false);
  const dragCounter                 = useRef(0);

  const unpackLogRef = useRef(null);
  const packLogRef   = useRef(null);

  // ── Auto-scroll logs ──────────────────────────────────────────────
  useEffect(() => { if (unpackLogRef.current) unpackLogRef.current.scrollTop = unpackLogRef.current.scrollHeight; }, [unpackLog]);
  useEffect(() => { if (packLogRef.current)   packLogRef.current.scrollTop   = packLogRef.current.scrollHeight;   }, [packLog]);

  // ── Progress listener ─────────────────────────────────────────────
  useEffect(() => {
    // main.js sends either a string or { msg: string } — normalise both
    const handler = (_, payload) => {
      const text = typeof payload === 'string' ? payload : (payload?.msg ?? JSON.stringify(payload));
      setUnpackLog(l => [...l, { text, type: 'info' }]);
    };
    window.electronAPI.on('scmap-progress', handler);
    return () => window.electronAPI.removeAllListeners('scmap-progress');
  }, []);

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
      setUnpackLog([]);
      await doUnpackPath(res.path);
    }
  }

  // ── Accept a dropped .scmap file (auto-unpack immediately) ───────
  async function acceptDroppedFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.scmap')) return;
    const fp = getFilePath(file);
    if (!fp) return;
    setUnpackSrc(fp);
    setUnpackDone(false);
    setUnpackLog([]);
    // Trigger unpack directly — pass path explicitly since state update is async
    await doUnpackPath(fp);
  }

  // ── Global drag handlers ──────────────────────────────────────────
  const onGlobalDragEnter = e => {
    e.preventDefault();
    dragCounter.current++;
    const hasFile = [...(e.dataTransfer.items || [])].some(i => i.kind === 'file');
    if (hasFile) setGlobalDrag(true);
  };
  const onGlobalDragLeave = e => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) { dragCounter.current = 0; setGlobalDrag(false); }
  };
  const onGlobalDragOver = e => e.preventDefault();
  const onGlobalDrop = e => {
    e.preventDefault();
    dragCounter.current = 0;
    setGlobalDrag(false);
    const file = e.dataTransfer.files?.[0];
    acceptDroppedFile(file);
  };

  // ── Unpack (accepts explicit path for drag-and-drop auto-trigger) ─
  async function doUnpackPath(srcPath) {
    if (!srcPath || unpackingRef.current) return;
    unpackingRef.current = true;
    setUnpacking(true);
    setUnpackDone(false);
    setUnpackLog([{ text: `Unpacking: ${srcPath}`, type: 'info' }]);
    const res = await window.electronAPI.invoke('scmap-unpack', { scmapPath: srcPath });
    if (res.success) {
      setUnpackLog(l => [...l, { text: `✓ Done → ${res.outputFolder}`, type: 'ok' }]);
      setUnpackDone(true);
      setLastOutputFolder(res.outputFolder);
      loadMaps();
      // Open folder only once, controlled entirely by the settings flag
      if (settings?.autoOpenExportFolder) {
        await window.electronAPI.invoke('open-folder', { folderPath: res.outputFolder });
      }
    } else {
      setUnpackLog(l => [...l, { text: `✗ ${res.error}`, type: 'err' }]);
    }
    setUnpacking(false);
    unpackingRef.current = false;
  }

  async function doUnpack() {
    await doUnpackPath(unpackSrc);
  }

  // ── Pack ──────────────────────────────────────────────────────────
  async function doPack(mapName) {
    if (packing) return;
    setPacking(mapName);
    setPackLog([{ text: `Packing: ${mapName}`, type: 'info' }]);
    const res = await window.electronAPI.invoke('scmap-pack', { mapName, _caller: 'scmap-tab' });
    if (res.success) {
      setPackLog(l => [...l, { text: `✓ Written: ${res.outputPath} (${(res.bytes / 1024).toFixed(1)} KB)`, type: 'ok' }]);
      loadMaps();
      if (settings?.autoOpenExportFolder && res.outputPath) {
        const folder = res.outputPath.replace(/[\\/][^\\/]+$/, '');
        await window.electronAPI.invoke('open-folder', { folderPath: folder });
      }
    } else {
      setPackLog(l => [...l, { text: `✗ ${res.error}`, type: 'err' }]);
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
  const srcName   = unpackSrc ? unpackSrc.split(/[\\/]/).pop().replace(/\.scmap$/i, '') : null;
  const canUnpack = !!unpackSrc && !unpacking;

  const fmtDate = ts => {
    if (!ts) return null;
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
      + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  // ── Render ────────────────────────────────────────────────────────
  const log     = activeSection === 'unpack' ? unpackLog : packLog;
  const logRef  = activeSection === 'unpack' ? unpackLogRef : packLogRef;
  const emptyMsg = activeSection === 'unpack'
    ? 'Drop a .scmap anywhere to begin extraction. The log prints each block as it is parsed.'
    : 'Select a map to assemble its .scmap binary. The log prints the output path and size.';

  return (
    <div
      className={`scmap-tab${globalDrag ? ' scmap-global-drag' : ''}`}
      onDragEnter={onGlobalDragEnter}
      onDragLeave={onGlobalDragLeave}
      onDragOver={onGlobalDragOver}
      onDrop={onGlobalDrop}
    >
      {/* ── Help button ─────────────────────────────────────────────── */}
      <button
        className="help-btn"
        onClick={() => { setShowHelp(h => !h); setHelpSelected(null); }}
        title="Help Guide"
      >?</button>

      {/* ── Help modal ──────────────────────────────────────────────── */}
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

      {/* ── Global drag overlay ─────────────────────────────────────── */}
      {globalDrag && (
        <div className="scmap-drag-overlay">
          <div className="scmap-drag-frame">
            <span className="scmap-drag-label">Drop .scmap to unpack</span>
            <span className="scmap-drag-sub">Release anywhere — extraction starts immediately</span>
          </div>
        </div>
      )}

      {/* ── Console shell ───────────────────────────────────────────── */}
      <WorkspaceConsole
        sections={[
          { id: 'unpack', index: '01', label: 'Unpack', desc: 'Extract a .scmap binary into its named blocks — heightmap, normals, albedo, watermap and the rest.', done: unpackDone },
          { id: 'pack',   index: '02', label: 'Pack',   desc: 'Reassemble an unpacked map folder back into a single .scmap binary.', count: maps.length },
        ]}
        activeSection={activeSection}
        onSelect={setActiveSection}
        ghostLabel="SCMAP"
        renderEyebrow={(s) => `SCMAP REGISTER — ${s.index} — BINARY CONSOLE`}
        railStorageKey="scmap-rail-pinned"
        navLabel="SCMAP console navigation"
        bootMs={280}
        mirrorSlot={
          <button className="action-button" onClick={popOut} title="Open in separate window">
            Pop Out
          </button>
        }
        previewSlot={
          <div className="scmap-preview">
            <div className="scmap-console-scroll" ref={logRef}>
              {log.length === 0 ? (
                <div className="scmap-console-empty">{emptyMsg}</div>
              ) : (
                <div className="scmap-console">
                  {log.map((l, i) => (
                    <span key={i} className={`scmap-line scmap-line-${l.type}`}>{l.text}</span>
                  ))}
                </div>
              )}
            </div>
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
        }
      >
        {/* ── 01 UNPACK ── */}
        {activeSection === 'unpack' && (
          <>
            <div className="subsection-head">
              <span className="subsection-head-title">Source</span>
            </div>

            <div
              className={`scmap-drop${unpacking ? ' busy' : ''}${unpackSrc && !unpacking ? ' loaded' : ''}`}
              onClick={unpacking ? undefined : browse}
              title={unpacking ? 'Extracting…' : 'Click to browse — or drop a .scmap anywhere'}
            >
              {unpacking && <div className="scmap-drop-scan" aria-hidden="true" />}
              <div className="scmap-drop-prompt">
                {unpacking ? 'Extracting' : unpackSrc ? `${srcName}.scmap` : 'Drop .scmap here'}
              </div>
              <div className="scmap-drop-sub">
                {unpacking
                  ? unpackSrc.split(/[\\/]/).pop()
                  : unpackSrc
                    ? (unpackDone ? 'Done — click or drop another to unpack' : 'Click to change · or drop another')
                    : 'or click to browse — unpacks immediately'}
              </div>
              {!unpacking && !unpackSrc && <span className="scmap-drop-fil" aria-hidden="true" />}
            </div>

            {unpackDone && lastOutputFolder && (
              <button
                className="action-button action-button--full"
                style={{ marginTop: 'var(--space-md)' }}
                onClick={() => openFolder(lastOutputFolder)}
              >
                Open Output Folder
              </button>
            )}

            {srcName && (
              <div className="scmap-hint">public/scmap/<b>{srcName}.scmap</b>/</div>
            )}
          </>
        )}

        {/* ── 02 PACK ── */}
        {activeSection === 'pack' && (
          <>
            <div className="subsection-head">
              <span className="subsection-head-title">Unpacked Maps</span>
              {maps.length > 0 && <span className="scmap-count">{String(maps.length).padStart(2, '0')}</span>}
            </div>

            <button className="action-button" onClick={loadMaps}>Refresh List</button>

            <div className="scmap-list">
              {maps.length === 0 ? (
                <div className="scmap-empty">No unpacked maps found</div>
              ) : maps.map(({ name, mtime }) => (
                <div className={`scmap-map-row${packing === name ? ' is-packing' : ''}`} key={name}>
                  <div className="scmap-map-meta">
                    <span className="scmap-map-name">{name}</span>
                    {mtime ? <span className="scmap-map-date">{fmtDate(mtime)}</span> : null}
                  </div>
                  <button className="action-button" onClick={() => doPack(name)} disabled={!!packing}>
                    {packing === name ? 'Packing…' : 'Pack'}
                  </button>
                </div>
              ))}
            </div>

            {maps.length > 0 && (
              <div className="scmap-hint">Output → <b>public/scmap/packed/</b></div>
            )}
          </>
        )}
      </WorkspaceConsole>
    </div>
  );
}
// ════════════════════════════════════════════════════════════════════════════
// ScmapHelpModal — 1:1 UI replica (left) + Advanced Guide (right)
// Uses shared.css: help-modal-*, help-adv-*, help-btn
// ════════════════════════════════════════════════════════════════════════════

const SCMAP_COLOR       = '#FFFA00';
const SCMAP_GLOW        = 'rgba(255,250,0,0.35)';
const SCMAP_GLOW_STRONG = 'rgba(255,250,0,0.6)';

const SCMAP_HELP_TABS = [
  { id: 'main',     label: '⬡ Interface Guide' },
  { id: 'advanced', label: '⚙ Advanced Guide'  },
];

// ── Info cards for every clickable element in the UI replica ─────────────────
const SCMAP_INFO = {

  // ── UNPACK side ───────────────────────────────────────────────────────────
  credits: {
    title: 'Credits — BrewMapTool',
    desc: 'The SCMAP Tool is built on top of BrewMapTool by The-Balthazar, an open-source Supreme Commander map binary parser and writer. All binary read/write logic in scmap.js originates from that project.',
    details: [
      ['Original project', 'github.com/The-Balthazar/BrewMapTool'],
      ['Author',           'The-Balthazar'],
      ['Integration',      'Wrapped into ForgeMapToolkit as an IPC-backed tool'],
    ],
    tip: 'If you encounter a .scmap the tool cannot parse, check if BrewMapTool itself can handle it — the upstream project may have received updates.',
  },
  popout: {
    title: 'Pop Out Window',
    desc: 'Opens the SCMAP Tool in a compact floating window that can be positioned independently of the main toolkit. The pop-out supports the full unpack/pack cycle including drag-and-drop.',
    details: [
      ['Drop .scmap',       'Triggers unpack automatically — same as the main tab'],
      ['Drop folder',       'Triggers pack immediately — output lands in packed/ next to source folder'],
      ['Right-click zone',  'Opens a folder picker for pack (alternative to drag-and-drop)'],
      ['Separate window',   'Runs alongside the main toolkit — useful on a second monitor'],
    ],
    tip: 'Use the pop-out on a second monitor while editing the map in the FA editor. Drop folder → pack → check in FA without switching windows.',
  },
  filedrop: {
    title: 'File Drop Zone — Unpack',
    desc: 'The primary drop target for .scmap files. Clicking opens the OS file browser. Dropping a file here loads it as the unpack source without triggering the unpack — click the Unpack button to start.',
    details: [
      ['Accepts',      '.scmap files only'],
      ['Click',        'Opens file browser (showOpenDialog filtered to .scmap)'],
      ['Drop',         'Loads the file path — then click Unpack'],
      ['Auto-unpack',  'Dropping a file anywhere on the tab (not just here) triggers unpack immediately without clicking'],
    ],
    tip: 'Drop a .scmap anywhere on the tab for the fastest path — no button click needed.',
  },
  pathdisplay: {
    title: 'Output Path Preview',
    desc: 'Shows where the extracted files will land. The path is derived from the source filename: public/scmap/<filename-without-extension>.scmap/',
    details: [
      ['Format',    'public/scmap/<name>.scmap/'],
      ['Created',   'Automatically on first unpack — folder does not need to pre-exist'],
      ['Overwrite', 'Re-unpacking the same file overwrites the folder contents cleanly'],
    ],
    tip: 'The folder name always includes .scmap — so a file called kaali.scmap extracts to a folder called kaali.scmap/ (not kaali/).',
  },
  unpackbtn: {
    title: 'Unpack Button',
    desc: 'Starts the binary extraction. Reads the .scmap file, parses all embedded data blocks (heightmap, normal map, albedo, watermap, etc.) and writes each as a named file to the output folder.',
    details: [
      ['Disabled',     'Until a .scmap file is selected'],
      ['Running',      'Shows spinning ⟳ icon — button disabled during extraction'],
      ['Re-run label', 'After a successful unpack the label changes to "↺ Unpack Again"'],
      ['Auto-open',    'If autoOpenExportFolder is enabled in Settings, opens the output folder in Explorer after completion'],
    ],
    tip: 'The unpack is non-destructive: original .scmap is never modified. Only the output folder is written.',
  },
  unpacklog: {
    title: 'Unpack Log',
    desc: 'Real-time output from the extraction process. Each line corresponds to a progress event emitted via the scmap-progress IPC channel as scmap.js processes the binary.',
    details: [
      ['Green ✓',  'Unpack succeeded — output folder path printed'],
      ['Red ✗',    'Extraction failed — error message from Node.js printed'],
      ['Info lines', 'Progress from scmap.js as each block is parsed'],
      ['Auto-scroll', 'Log scrolls to the bottom automatically as lines arrive'],
    ],
    tip: 'If the log ends with an error, check that the .scmap is a valid SC/FA map binary — files from mods or other games may use different formats.',
  },

  // ── PACK side ─────────────────────────────────────────────────────────────
  maplist: {
    title: 'Unpacked Maps List',
    desc: 'Shows all subdirectories found in public/scmap/ at the time the tab loaded (or after the last Refresh). Each entry was created by a previous unpack run.',
    details: [
      ['Sorted',     'Newest first — by folder modification time (mtime)'],
      ['Refresh',    '↺ button re-reads the directory. External changes are not watched live'],
      ['Date stamp', 'Shown next to each map name — the mtime of the folder'],
      ['Count badge', 'Shows total number of maps found'],
    ],
    tip: 'After unpacking a map the list refreshes automatically. Use the Refresh button if you move or rename folders externally.',
  },
  packbtn: {
    title: 'Pack Button (per-map)',
    desc: 'Triggers the binary assembly for that specific map folder. Calls the scmap-pack IPC handler, which reads all files in the folder (excluding _origin.json), assembles the .scmap binary using scmap.js writeDatastream(), and writes the result.',
    details: [
      ['Primary output',    'public/scmap/packed/<mapname>.scmap'],
      ['Copy-back',         'If mapsFolder is set in Settings, also copies to the matching versioned folder in the game maps directory'],
      ['Disabled state',    'Disabled while any pack is already running (one at a time)'],
      ['Running label',     'Shows ⟳ Packing… on the active row only'],
    ],
    tip: 'Re-packing is always safe. The output file is overwritten cleanly on every run.',
  },
  packoutput: {
    title: 'Output Path Display',
    desc: 'Shows the target directory for packed output. Always public/scmap/packed/ — not configurable. This prevents the EISDIR error that occurs when output resolves to the source folder itself.',
    details: [
      ['Path',    'public/scmap/packed/'],
      ['Created', 'Automatically if it does not exist (mkdirSync recursive)'],
      ['Conflict','Output path is always a file, never collides with the source folder'],
    ],
    tip: 'If you want the .scmap in a different location, use the pop-out window which lets you place output next to the source — but note the pop-out also writes to packed/ to avoid EISDIR.',
  },
  packlog: {
    title: 'Pack Log',
    desc: 'Output from the most recent pack operation. Persists between packs until the next one starts.',
    details: [
      ['Green ✓',  'Pack succeeded — output path and file size (in KB) shown'],
      ['Green ✓ (copy-back)', 'If copy-back happened, a second ✓ line shows the game folder path'],
      ['Red ✗',    'Pack failed — error message printed'],
      ['Small file', 'A very small result (< 1 KB) means the folder was empty or only had _origin.json'],
    ],
    tip: 'After a successful pack, check the file size in the log. If it is suspiciously small, open the output folder and verify the extracted files are all present.',
  },
};

// ── Shared info panel ──────────────────────────────────────────────────────
function ScmapInfoPanel({ sel }) {
  return (
    <div className="help-adv-layout" style={{ padding: 0 }}>
      <div className="help-adv-hero" style={{ marginBottom: '24px' }}>
        <div className="help-adv-hero-content">
          <h2 className="help-adv-hero-title" style={{ fontSize: '1.6rem' }}>{sel.title}</h2>
          <p className="help-adv-hero-desc">{sel.desc}</p>
        </div>
      </div>
      <div className="help-adv-structure">
        <h3 className="help-adv-section-header">
          <span className="help-adv-section-num">01</span>Details
        </h3>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px 24px', marginTop: '24px' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sel.details.map(([label, value], i) => (
              <li key={i} style={{ display: 'flex', gap: '12px', fontSize: '0.88rem', lineHeight: 1.6 }}>
                <strong style={{ color: SCMAP_COLOR, minWidth: '140px', flexShrink: 0 }}>{label}:</strong>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>{value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="help-adv-note" style={{ marginTop: '16px' }}>
        <strong>Tip: </strong>{sel.tip}
      </div>
    </div>
  );
}

// ── Clickable wrapper matching the CustomProps pattern exactly ─────────────
function Sel({ id, sel, setSel, children, style, className }) {
  const active = sel === id;
  return (
    <div
      className={className}
      onClick={e => { e.stopPropagation(); setSel(active ? null : id); }}
      style={{
        cursor: 'pointer',
        outline: active ? `2px solid ${SCMAP_COLOR}` : '2px solid transparent',
        outlineOffset: '2px',
        boxShadow: active ? `0 0 18px ${SCMAP_GLOW}` : 'none',
        transition: 'outline 0.15s ease, box-shadow 0.15s ease',
        ...style,
      }}
    >{children}</div>
  );
}