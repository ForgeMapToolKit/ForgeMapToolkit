import React, { useState, useRef, useCallback, useEffect } from 'react';
import '../../../shared/shared.css';
import './Contributions.css';
import ContributionsHelpModal from '../../HelpModals/Contributions_help.jsx';

// ── IPC (Electron) ────────────────────────────────────────────────────────────
const ipcInvoke = (channel, ...args) =>
  window.electronAPI ? window.electronAPI.invoke(channel, ...args) : Promise.resolve(null);

// ── Remote DDS → PNG preview hook ─────────────────────────────────────────────
const _remoteDdsCache = {};
function useRemoteDdsPreview(url) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!url) return;
    if (_remoteDdsCache[url]) { setSrc(_remoteDdsCache[url]); return; }
    if (!/\.dds$/i.test(url)) { setSrc(url); return; }
    window.electronAPI.invoke('dds-url-to-dataurl', { url }).then(res => {
      if (res?.success) {
        _remoteDdsCache[url] = res.dataUrl;
        setSrc(res.dataUrl);
      }
    });
  }, [url]);
  return src;
}

// ── File → base64 ─────────────────────────────────────────────────────────────
function readBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ── Tier definitions (color-only, no emojis) ─────────────────────────────────
const TIERS = [
  { id: 'emerald',     label: 'Emerald',     minApproved: 100, color: '#50fa7b' },
  { id: 'diamond',     label: 'Diamond',     minApproved: 75,  color: '#a9d8ff' },
  { id: 'gold',        label: 'Gold',        minApproved: 50,  color: '#fbbf24' },
  { id: 'silver',      label: 'Silver',      minApproved: 35,  color: '#cbd5e1' },
  { id: 'bronze',      label: 'Bronze',      minApproved: 15,  color: '#cd7c3f' },
  { id: 'white',       label: 'Member',      minApproved: 5,   color: '#e2e8f0' },
];

function getTier(c) {
  return TIERS.find(t => c.approved >= t.minApproved) || null;
}

// ── GitHub data — loaded via IPC from the real repo ──────────────────────────
// Shared mutable store (module-level so all components see updates)
let _ghContributors = [];
let _ghAssets       = [];
let _ghLoaded       = false;
const _ghListeners  = new Set();

function subscribeGH(fn) { _ghListeners.add(fn); return () => _ghListeners.delete(fn); }
function notifyGH()      { _ghListeners.forEach(fn => fn()); }

async function loadGitHubData(force = false) {
  if (_ghLoaded && !force) return;
  try {
    const res = await window.electronAPI.invoke('contrib-load-github-data', { force });
    if (res) {
      _ghContributors = res.contributors || [];
      _ghAssets       = res.assets       || [];
      _ghLoaded       = true;
      notifyGH();
    }
  } catch (err) {
    console.error('[contrib] loadGitHubData failed:', err);
  }
}

// Hook to consume live GitHub data
function useGHData() {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const unsub = subscribeGH(() => forceRender(n => n + 1));
    loadGitHubData(); // kick off load (no-op if already done)
    return unsub;
  }, []);
  return { contributors: _ghContributors, assets: _ghAssets, loaded: _ghLoaded };
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ASSET_TYPES = ['prop', 'skybox', 'emitter', 'texture'];
// TYPE_META: accent/glow/border values are currently uniform across all types.
// If per-type colour theming is ever added, differentiate here.
const TYPE_META = {
  prop:    { label: 'Prop',    accent: 'var(--contributions-color)', glow: 'var(--contributions-glow)', border: 'rgba(165, 232, 1, 0.22)', muted: 'rgba(165, 232, 1, 0.55)' },
  skybox:  { label: 'Skybox',  accent: 'var(--contributions-color)', glow: 'var(--contributions-glow)', border: 'rgba(165, 232, 1, 0.22)', muted: 'rgba(165, 232, 1, 0.55)' },
  emitter: { label: 'Emitter', accent: 'var(--contributions-color)', glow: 'var(--contributions-glow)', border: 'rgba(165, 232, 1, 0.22)', muted: 'rgba(165, 232, 1, 0.55)' },
  texture: { label: 'Texture', accent: 'var(--contributions-color)', glow: 'var(--contributions-glow)', border: 'rgba(165, 232, 1, 0.22)', muted: 'rgba(165, 232, 1, 0.55)' },
};
const STATUS_CFG = {
  approved: { label: 'Approved' },
  removed:  { label: 'Removed'  },
  pending:  { label: 'Pending'  },
  rejected: { label: 'Rejected' },
};
const RANK_COLORS = ['#fbbf24', '#94a3b8', '#cd7c3f'];

function accentVars(type) {
  const m = TYPE_META[type] || TYPE_META.prop;
  return {
    '--accent': m.accent, '--accent-glow': m.glow, '--accent-bg': `${m.accent}14`,
    '--accent-border': m.border, '--accent-border-strong': m.accent + '66',
    '--accent-hover': `${m.accent}26`, '--accent-muted': m.muted,
  };
}
function TypeBadge({ type }) {
  return <span className={`ct-status ct-type-${type}`} style={{ fontFamily: 'monospace', letterSpacing: '0.06em' }}>{TYPE_META[type]?.label || type}</span>;
}
function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || { label: status || '?' };
  return <span className={`ct-status ${status}`}>{c.label}</span>;
}

// ── Tier Badge ────────────────────────────────────────────────────────────────
function TierBadge({ tier, size = 'sm' }) {
  if (!tier) return null;
  return (
    <span
      className={`ct-tier-badge ct-tier-${size}`}
      style={{ color: tier.color, borderColor: tier.color + '44', background: tier.color + '12' }}
    >
      {tier.label}
    </span>
  );
}

// ── GitHub Auth Panel ─────────────────────────────────────────────────────────
function GitHubAuthPanel({ authState, onConnect, onDisconnect }) {
  if (!authState) return (
    <div className="ct-auth-panel ct-auth-disconnected">
      <div className="ct-auth-gh-icon">
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>
      </div>
      <div className="ct-auth-info">
        <div className="ct-auth-title">Connect GitHub <span className="ct-auth-optional-tag">optional</span></div>
        <div className="ct-auth-desc">Unlocks leaderboard entry, achievements, and a verified badge on your contributions. Your PRs appear under your own account.</div>
      </div>
      <div className="ct-auth-perks">
        <span className="ct-auth-perk">Leaderboard</span>
        <span className="ct-auth-perk">Achievements</span>
        <span className="ct-auth-perk">Verified</span>
      </div>
      <button className="ct-auth-btn connect" onClick={onConnect}>Connect</button>
    </div>
  );

  if (authState.status === 'polling') return (
    <div className="ct-auth-panel ct-auth-polling">
      <div style={{ flex: 1 }}>
        <div className="ct-auth-polling-label">Open in your browser and enter the code below:</div>
        <a className="ct-auth-url" href="https://github.com/login/device" target="_blank" rel="noreferrer">github.com/login/device</a>
      </div>
      <div className="ct-auth-code-wrap">
        <div className="ct-auth-code">{authState.code}</div>
        <button className="ct-auth-copy" onClick={() => navigator.clipboard?.writeText(authState.code)}>Copy</button>
      </div>
      <div className="ct-auth-polling-status"><span className="ct-auth-spinner" /> Waiting…</div>
      <button className="ct-auth-btn cancel" onClick={onDisconnect}>Cancel</button>
    </div>
  );

  return (
    <div className="ct-auth-panel ct-auth-connected">
      <div className="ct-auth-gh-avatar connected">
        {authState.avatarUrl
          ? <img src={authState.avatarUrl} alt={authState.username} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
          : <span>{authState.username.slice(0, 2).toUpperCase()}</span>}
      </div>
      <div className="ct-auth-info">
        <div className="ct-auth-title" style={{ color: '#4ade80' }}>Connected</div>
        <div className="ct-auth-username">@{authState.username}</div>
      </div>
      <div className="ct-auth-perks">
        <span className="ct-auth-perk active">Leaderboard</span>
        <span className="ct-auth-perk active">Achievements</span>
        <span className="ct-auth-perk active">Verified</span>
      </div>
      <button className="ct-auth-btn disconnect" onClick={onDisconnect}>Disconnect</button>
    </div>
  );
}

// ── DropZone ──────────────────────────────────────────────────────────────────
function DropZone({ label, accept, icon, file, onFile, hint, optional }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const handleDrop = useCallback((e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }, [onFile]);
  const ext = file?.name?.split('.').pop().toLowerCase();
  const isValid = file && accept.some(a => a.replace('.', '') === ext);
  return (
    <div
      className={['ct-dropzone', dragging ? 'dragging' : '', file ? (isValid ? 'has-file' : 'has-file invalid') : '', optional ? 'optional' : ''].filter(Boolean).join(' ')}
      onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
      onClick={() => inputRef.current?.click()}>
      <input ref={inputRef} type="file" accept={accept.join(',')} style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); }} />
      <div className="ct-dz-icon">{file ? (isValid ? '+' : '-') : icon}</div>
      <div className="ct-dz-label">{label}{optional && <span className="ct-optional-badge">optional</span>}</div>
      {file ? <div className="ct-dz-filename">{file.name}</div> : <div className="ct-dz-hint">{hint}</div>}
    </div>
  );
}

// ── Upload Forms ──────────────────────────────────────────────────────────────

// Recursively read all files from a DirectoryEntry
async function readDirectoryEntryRecursive(dirEntry) {
  return new Promise((resolve) => {
    const allFiles = [];
    const readEntries = (entry, path) => new Promise((res) => {
      if (entry.isFile) {
        entry.file((file) => {
          Object.defineProperty(file, 'webkitRelativePath', { value: path + file.name, writable: false });
          allFiles.push(file);
          res();
        }, () => res());
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readBatch = () => {
          reader.readEntries(async (entries) => {
            if (entries.length === 0) { res(); return; }
            await Promise.all(entries.map(e => readEntries(e, path + entry.name + '/')));
            readBatch();
          }, () => res());
        };
        readBatch();
      } else { res(); }
    });
    const reader = dirEntry.createReader();
    const readBatch = () => {
      reader.readEntries(async (entries) => {
        if (entries.length === 0) { resolve(allFiles); return; }
        await Promise.all(entries.map(e => readEntries(e, dirEntry.name + '/')));
        readBatch();
      }, () => resolve(allFiles));
    };
    readBatch();
  });
}

// Group multiple props that share textures in a merged folder
async function groupPropFiles(bpFiles, scmFiles, texFiles) {
  const noExt = (name) => name.replace(/\.[^.]+$/, '');
  const baseLower = (name) => noExt(name).toLowerCase();
  const scmMap = {}; scmFiles.forEach(f => { scmMap[baseLower(f.name)] = f; });
  const texMap = {}; texFiles.forEach(f => { texMap[baseLower(f.name)] = f; });

  const findByPrefix = (map, prefix) => {
    const p = prefix.toLowerCase();
    const exact = Object.keys(map).filter(k => k.startsWith(p));
    if (exact.length) return exact.map(k => map[k]);
    const parts = p.split('_');
    for (let i = parts.length - 1; i >= 1; i--) {
      const shorter = parts.slice(0, i).join('_');
      const partial = Object.keys(map).filter(k => k.startsWith(shorter));
      if (partial.length) return partial.map(k => map[k]);
    }
    return [];
  };

  const props = [];
  for (const bpFile of bpFiles) {
    const propName   = noExt(bpFile.name).replace(/_prop$/i, '');
    const propPrefix = propName.toLowerCase();
    const relatedScm = findByPrefix(scmMap, propPrefix);
    const relatedTex = findByPrefix(texMap, propPrefix);
    props.push({ name: propName, bpFile, scmFiles: relatedScm, texFiles: relatedTex });
  }
  return props;
}


// ── Generic FolderDropZone (shared by Skybox, Emitter, Texture) ───────────────
function GenericFolderDropZone({ folderName, fileList, onFolder, statusLine, icon = '' }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault(); setDragging(false);
    const items = e.dataTransfer.items;
    if (items?.length > 0) {
      const entry = items[0].webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        const files = await readDirectoryEntryRecursive(entry);
        onFolder(entry.name, files);
        return;
      }
    }
    if (e.dataTransfer.files.length > 0) onFolder(null, Array.from(e.dataTransfer.files));
  }, [onFolder]);

  const handleInput = useCallback((e) => {
    if (e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const rootName = files[0]?.webkitRelativePath?.split('/')[0] || 'folder';
      onFolder(rootName, files);
    }
  }, [onFolder]);

  return (
    <div
      className={['ct-dropzone', dragging ? 'dragging' : '', folderName ? 'has-file' : '', 'ct-folder-dz'].filter(Boolean).join(' ')}
      style={{ minHeight: 100, flexDirection: 'column' }}
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" webkitdirectory="true" directory="true" style={{ display: 'none' }} onChange={handleInput} />
      {folderName ? (
        <>
          <div className="ct-dz-icon">+</div>
          <div className="ct-dz-label" style={{ color: 'rgba(165,232,1,0.9)' }}>{folderName}</div>
          {statusLine && <div style={{ fontSize: '0.63rem', color: 'rgba(165,232,1,0.6)', marginTop: 2 }}>{statusLine}</div>}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6, maxWidth: '100%' }}>
            {fileList.slice(0, 8).map((f, i) => (
              <span key={i} style={{ fontSize: '0.58rem', padding: '1px 5px', background: 'rgba(255,255,255,0.05)', borderRadius: 3, color: f.highlight ? 'rgba(165,232,1,0.7)' : 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>{f.name}</span>
            ))}
            {fileList.length > 8 && <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)' }}>+{fileList.length - 8} more</span>}
          </div>
          <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>Click to change</div>
        </>
      ) : (
        <>
          <div className="ct-dz-icon" style={{ fontSize: '1.4rem' }}>{icon}</div>
          <div className="ct-dz-label">Drop Folder Here</div>
          <div className="ct-dz-hint">or click to select a folder</div>
        </>
      )}
    </div>
  );
}

// PropFolderDropZone — accepts a whole merged-folder drop
function PropFolderDropZone({ folderName, fileList, onFolder, propCount, status }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault(); setDragging(false);
    const items = e.dataTransfer.items;
    if (items?.length > 0) {
      const entry = items[0].webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        const files = await readDirectoryEntryRecursive(entry);
        onFolder(entry.name, files);
        return;
      }
    }
    if (e.dataTransfer.files.length > 0) onFolder(null, Array.from(e.dataTransfer.files));
  }, [onFolder]);

  const handleInput = useCallback((e) => {
    if (e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const rootName = files[0]?.webkitRelativePath?.split('/')[0] || 'folder';
      onFolder(rootName, files);
    }
  }, [onFolder]);

  const statusColor = status === 'ok' ? '#4ade80' : status === 'warn' ? '#fbbf24' : '#f87171';

  return (
    <div
      className={['ct-dropzone', dragging ? 'dragging' : '', folderName ? 'has-file' : '', 'ct-folder-dz'].filter(Boolean).join(' ')}
      style={{ minHeight: 110, flexDirection: 'column' }}
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" webkitdirectory="true" directory="true" style={{ display: 'none' }} onChange={handleInput} />
      {folderName ? (
        <>
          <div className="ct-dz-icon">+</div>
          <div className="ct-dz-label" style={{ color: statusColor }}>{folderName}</div>
          <div style={{ fontSize: '0.63rem', color: statusColor, marginTop: 2 }}>
            {status === 'ok' ? `${propCount} prop${propCount !== 1 ? 's' : ''} detected` : status === 'warn' ? 'Missing mesh or textures?' : 'No _prop.bp found'}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6, maxWidth: '100%' }}>
            {fileList.slice(0, 8).map((f, i) => (
              <span key={i} style={{ fontSize: '0.58rem', padding: '1px 5px', background: 'rgba(255,255,255,0.05)', borderRadius: 3, color: f.highlight ? 'rgba(165,232,1,0.7)' : 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>{f.name}</span>
            ))}
            {fileList.length > 8 && <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)' }}>+{fileList.length - 8} more</span>}
          </div>
          <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>Click to change</div>
        </>
      ) : (
        <>
          <div className="ct-dz-icon" style={{ fontSize: '1.4rem' }}></div>
          <div className="ct-dz-label">Merged Prop Folder</div>
          <div className="ct-dz-hint">Drop folder with multiple props sharing textures</div>
        </>
      )}
    </div>
  );
}

function PropUploadForm({ name, setName }) {
  const [mode, setMode] = useState('single'); // 'single' | 'folder'

  // Single mode
  const [scmLod0, setScmLod0] = useState(null); const [scmLod1, setScmLod1] = useState(null);
  const [albedo, setAlbedo]   = useState(null); const [normal, setNormal]   = useState(null);
  const [bpFile, setBpFile]   = useState(null); const [preview, setPreview] = useState(null);
  const [showLod1, setShowLod1] = useState(false);
  const propName = name.trim().replace(/\s+/g, '_');

  // Folder / merged mode
  const [folderName,    setFolderName]    = useState('');
  const [folderFileList, setFolderFileList] = useState([]);
  const [folderProps,   setFolderProps]   = useState([]); // [{name, bpFile, scmFiles, texFiles}]
  const [folderStatus,  setFolderStatus]  = useState(null);

  const singleReady  = !!(propName && scmLod0 && albedo && normal && bpFile && preview);
  const folderReady  = folderProps.length > 0 && folderStatus === 'ok';
  const ready = mode === 'single' ? singleReady : folderReady;

  const handleFolderDrop = useCallback(async (rootName, files) => {
    const allFiles = Array.from(files);
    if (allFiles.length === 0) return;
    const displayList = allFiles.map(f => ({
      name: (f.webkitRelativePath || f.name).replace(/^[^/]+\//, ''),
      highlight: /\.(bp|scm|dds|tga|png)$/i.test(f.name),
    })).sort((a, b) => b.highlight - a.highlight);
    setFolderName(rootName || 'folder');
    setFolderFileList(displayList);

    const bpFiles  = allFiles.filter(f => f.name.toLowerCase().endsWith('_prop.bp'));
    const scmFiles = allFiles.filter(f => f.name.toLowerCase().endsWith('.scm'));
    const texFiles = allFiles.filter(f => /\.(dds|tga|png)$/i.test(f.name));

    if (bpFiles.length === 0) { setFolderStatus('error'); setFolderProps([]); return; }
    if (scmFiles.length === 0 || texFiles.length === 0) { setFolderStatus('warn'); }

    const parsed = await groupPropFiles(bpFiles, scmFiles, texFiles);
    setFolderProps(parsed);
    setFolderStatus(parsed.length > 0 && scmFiles.length > 0 && texFiles.length > 0 ? 'ok' : 'warn');
    // Use folder name as the "group" name
    setName(rootName || '');
  }, [setName]);

  const getFiles = async () => {
    if (mode === 'single') {
      const files = [
        { path: `props/community/${propName}/${propName}_lod0.scm`,     data: await readBase64(scmLod0), encoding: 'base64' },
        { path: `props/community/${propName}/${propName}_albedo.dds`,    data: await readBase64(albedo),  encoding: 'base64' },
        { path: `props/community/${propName}/${propName}_normalsTS.dds`, data: await readBase64(normal),  encoding: 'base64' },
        { path: `props/community/${propName}/${propName}_prop.bp`,       data: await bpFile.text(),       encoding: 'utf-8'  },
        { path: `props/community/${propName}/${propName}_preview.png`,   data: await readBase64(preview), encoding: 'base64' },
      ];
      if (scmLod1) files.push({ path: `props/community/${propName}/${propName}_lod1.scm`, data: await readBase64(scmLod1), encoding: 'base64' });
      return files;
    } else {
      // Merged folder: all props go into props/community/<folderName>/ sharing textures
      const groupName = (folderName || propName).trim().replace(/\s+/g, '_');
      const files = [];
      for (const prop of folderProps) {
        const pn = prop.name.trim().replace(/\s+/g, '_');
        files.push({ path: `props/community/${groupName}/${pn}_prop.bp`, data: await prop.bpFile.text(), encoding: 'utf-8' });
        for (const scm of prop.scmFiles) {
          files.push({ path: `props/community/${groupName}/${scm.name}`, data: await readBase64(scm), encoding: 'base64' });
        }
        for (const tex of prop.texFiles) {
          if (!files.find(f => f.path.endsWith(tex.name))) { // deduplicate shared textures
            files.push({ path: `props/community/${groupName}/${tex.name}`, data: await readBase64(tex), encoding: 'base64' });
          }
        }
      }
      return files;
    }
  };

  return { ready, getFiles, node: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mode switcher */}
      <div className="ct-section">
        <label className="ct-section-label">UPLOAD MODE</label>
        <div style={{ display: 'flex', gap: 0, border: '1px solid rgba(255,255,255,0.08)' }}>
          {[['single', 'Single Prop'], ['folder', 'Merged Folder']].map(([val, label]) => (
            <button key={val} onClick={() => setMode(val)} style={{
              flex: 1, padding: '9px 0',
              background: mode === val ? 'rgba(165,232,1,0.08)' : 'transparent',
              border: 'none', borderBottom: mode === val ? '2px solid var(--contributions-color)' : '2px solid transparent',
              color: mode === val ? 'var(--contributions-color)' : 'rgba(255,255,255,0.3)',
              fontFamily: 'Poppins,sans-serif', fontSize: '0.76rem', fontWeight: 600,
              cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'all 0.2s',
            }}>{label}</button>
          ))}
        </div>
        {mode === 'folder' && (
          <div className="ct-note">Multiple props share albedo/normal textures in one folder. Each prop has its own <code>_prop.bp</code> and <code>.scm</code> but references shared <code>.dds</code> files.</div>
        )}
      </div>

      {mode === 'single' ? (
        <div className="ct-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="ct-section">
              <label className="ct-section-label accent">PROP NAME</label>
              <input className="ct-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. PineTree_01" autoFocus />
              {propName && <div className="ct-path-preview">/env/props/{propName}/{propName}_prop.bp</div>}
            </div>
            <div className="ct-section">
              <label className="ct-section-label accent">BLUEPRINT (.bp)</label>
              <div className="ct-dropzone-grid cols-1">
                <DropZone label="prop.bp" accept={['.bp']} file={bpFile} onFile={setBpFile} hint="Drop _prop.bp here" />
              </div>
            </div>
            <div className="ct-note">The <code>.bp</code> defines reclaim values, LOD cutoffs, collision and scripting.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="ct-section">
              <label className="ct-section-label accent">MESH + TEXTURES</label>
              <div className="ct-dropzone-grid cols-3">
                <DropZone label="LOD0 Mesh" accept={['.scm']} file={scmLod0} onFile={setScmLod0} hint=".scm (required)" />
                <DropZone label="Albedo" accept={['.dds', '.png', '.tga']} file={albedo} onFile={setAlbedo} hint=".dds / .png" />
                <DropZone label="Normal Map" accept={['.dds', '.png', '.tga']} file={normal} onFile={setNormal} hint=".dds / .png" />
              </div>
              <div className="ct-dropzone-grid cols-1" style={{ marginTop: 8 }}>
                <DropZone label="Preview PNG" accept={['.png', '.jpg', '.jpeg']} file={preview} onFile={setPreview} hint="screenshot / render for the library (.png)" />
              </div>
              <div className="ct-note" style={{ marginTop: 4 }}>Preview PNG wird im Download-Tab als Thumbnail angezeigt.</div>
              {scmLod0 && (showLod1
                ? <div className="ct-dropzone-grid cols-1" style={{ marginTop: 8 }}><DropZone label="LOD1 Mesh" accept={['.scm']} file={scmLod1} onFile={setScmLod1} hint=".scm" optional /></div>
                : <button onClick={() => setShowLod1(true)} style={{ marginTop: 8, background: 'none', border: '1px dashed rgba(165, 232, 1, 0.2)', color: 'rgba(165, 232, 1, 0.45)', padding: '8px 16px', fontSize: '0.73rem', fontFamily: 'Poppins,sans-serif', cursor: 'pointer', letterSpacing: '0.05em' }}>+ Add LOD1 (optional)</button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="ct-section">
            <label className="ct-section-label accent">FOLDER NAME (Group)</label>
            <input className="ct-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. DeadTrees" />
            {name.trim() && <div className="ct-path-preview">/env/props/{name.trim().replace(/\s+/g,'_')}/</div>}
          </div>
          <PropFolderDropZone
            folderName={folderName}
            fileList={folderFileList}
            onFolder={handleFolderDrop}
            propCount={folderProps.length}
            status={folderStatus}
          />
          {folderProps.length > 0 && (
            <div className="ct-section">
              <label className="ct-section-label accent">DETECTED PROPS ({folderProps.length})</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {folderProps.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4 }}>
                    <span style={{ color: 'rgba(165,232,1,0.7)', fontFamily: 'monospace', fontSize: '0.75rem', minWidth: 0, flex: 1 }}>{p.name}</span>
                    <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>{p.scmFiles.length} mesh · {p.texFiles.length} tex</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )};
}

// ── Skybox folder pairing logic ───────────────────────────────────────────────
// Naming convention:
//   skyboxname.scmskybox
//   skyboxname_albedo.dds / skyboxname_glow.dds / skyboxname_cirrus.dds
//   skyboxname_prev.png (treated as preview1), skyboxname_prev1..3.png
function parseSkyboxFolder(files) {
  const scmskybox = files.find(f => /\.scmskybox$/i.test(f.name)) || null;
  const baseName  = scmskybox ? scmskybox.name.replace(/\.scmskybox$/i, '') : null;

  const find = (suffix) => {
    if (!baseName) return null;
    return files.find(f => f.name.toLowerCase() === `${baseName.toLowerCase()}${suffix}`) || null;
  };

  const albedo = find('_albedo.dds');
  const glow   = find('_glow.dds');
  const cirrus  = find('_cirrus.dds');

  // Previews: _prev.png → slot 0, _prev1.png → slot 0, _prev2.png → slot 1, _prev3.png → slot 2
  const previewFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f.name));
  const previews = [null, null, null];
  for (const f of previewFiles) {
    const lower = f.name.toLowerCase();
    const m3 = lower.match(/_prev(\d)\.(?:png|jpg|jpeg)$/i);
    if (m3) { const idx = parseInt(m3[1]) - 1; if (idx >= 0 && idx < 3) previews[idx] = f; continue; }
    if (/_prev\.(?:png|jpg|jpeg)$/i.test(lower)) { previews[0] = f; }
  }
  // fallback: if no _prev pattern found, use first image as preview1
  if (!previews[0] && previewFiles.length > 0) previews[0] = previewFiles[0];

  return { baseName, scmskybox, albedo, glow, cirrus, previews };
}

function SkyboxUploadForm({ name, setName }) {
  const [mode, setMode]         = useState('single'); // 'single' | 'folder'
  const [scmskybox, setScmskybox] = useState(null);
  const [albedo, setAlbedo]     = useState(null);
  const [glow, setGlow]         = useState(null);
  const [cirrus, setCirrus]     = useState(null);
  const [previews, setPreviews] = useState([null, null, null]);
  const skyboxName = name.trim().replace(/\s+/g, '_');

  // Folder mode state
  const [folderName,    setFolderName]    = useState('');
  const [folderFileList, setFolderFileList] = useState([]);
  const [folderParsed,  setFolderParsed]  = useState(null); // result of parseSkyboxFolder
  const [folderStatus,  setFolderStatus]  = useState(null); // 'ok' | 'warn' | 'error'

  const setPreviewAt = (i, file) => setPreviews(p => { const n = [...p]; n[i] = file; return n; });

  const singleReady = !!(skyboxName && scmskybox && previews[0]);
  const folderReady = !!(folderParsed?.scmskybox && folderParsed?.previews[0]);
  const ready = mode === 'single' ? singleReady : folderReady;

  const handleFolderDrop = useCallback(async (rootName, files) => {
    const allFiles = Array.from(files);
    if (!allFiles.length) return;
    setFolderName(rootName || 'folder');
    setFolderFileList(
      allFiles.map(f => ({
        name: f.name,
        highlight: /\.(scmskybox|dds|png|jpg|jpeg)$/i.test(f.name),
      })).sort((a, b) => b.highlight - a.highlight)
    );
    const parsed = parseSkyboxFolder(allFiles);
    setFolderParsed(parsed);
    if (!parsed.scmskybox) { setFolderStatus('error'); return; }
    if (!parsed.previews[0]) { setFolderStatus('warn'); return; }
    setFolderStatus('ok');
    // Auto-fill name from folder / scmskybox filename
    if (parsed.baseName) setName(parsed.baseName);
    else if (rootName)   setName(rootName);
  }, [setName]);

  const getFiles = async () => {
    if (mode === 'single') {
      const sn = skyboxName;
      const base = `skyboxes/community/${sn}`;
      const files = [
        { path: `${base}/${sn}.scmskybox`, data: await scmskybox.text(), encoding: 'utf-8' },
      ];
      if (albedo) files.push({ path: `${base}/assets/${sn}.dds`,      data: await readBase64(albedo),  encoding: 'base64' });
      if (glow)   files.push({ path: `${base}/assets/${sn}_glow.dds`, data: await readBase64(glow),    encoding: 'base64' });
      if (cirrus) files.push({ path: `${base}/assets/${sn}_cirrus.dds`, data: await readBase64(cirrus), encoding: 'base64' });
      previews.forEach((p, i) => {
        if (p) files.push({ path: `${base}/prev/${i + 1}.png`, data: readBase64(p), encoding: 'base64' });
      });
      for (const f of files) if (f.data instanceof Promise) f.data = await f.data;
      return files;
    } else {
      const p = folderParsed;
      const sn = (p.baseName || folderName).replace(/\s+/g, '_');
      const base = `skyboxes/community/${sn}`;
      const files = [
        { path: `${base}/${sn}.scmskybox`, data: await p.scmskybox.text(), encoding: 'utf-8' },
      ];
      if (p.albedo) files.push({ path: `${base}/assets/${sn}.dds`,       data: await readBase64(p.albedo),  encoding: 'base64' });
      if (p.glow)   files.push({ path: `${base}/assets/${sn}_glow.dds`,  data: await readBase64(p.glow),    encoding: 'base64' });
      if (p.cirrus) files.push({ path: `${base}/assets/${sn}_cirrus.dds`, data: await readBase64(p.cirrus), encoding: 'base64' });
      p.previews.forEach((pv, i) => {
        if (pv) files.push({ path: `${base}/prev/${i + 1}.png`, data: readBase64(pv), encoding: 'base64' });
      });
      for (const f of files) if (f.data instanceof Promise) f.data = await f.data;
      return files;
    }
  };

  const statusColor = folderStatus === 'ok' ? '#4ade80' : folderStatus === 'warn' ? '#fbbf24' : '#f87171';
  const statusLine  = folderStatus === 'ok'
    ? `${folderParsed?.scmskybox?.name} · ${folderParsed?.previews.filter(Boolean).length} preview(s)`
    : folderStatus === 'warn' ? 'Missing preview image'
    : 'No .scmskybox found';

  return { ready, getFiles, node: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mode switcher */}
      <div className="ct-section">
        <label className="ct-section-label">UPLOAD MODE</label>
        <div style={{ display: 'flex', gap: 0, border: '1px solid rgba(255,255,255,0.08)' }}>
          {[['single', 'Single Files'], ['folder', 'Drop Folder']].map(([val, label]) => (
            <button key={val} onClick={() => setMode(val)} style={{
              flex: 1, padding: '9px 0',
              background: mode === val ? 'rgba(165,232,1,0.08)' : 'transparent',
              border: 'none', borderBottom: mode === val ? '2px solid var(--contributions-color)' : '2px solid transparent',
              color: mode === val ? 'var(--contributions-color)' : 'rgba(255,255,255,0.3)',
              fontFamily: 'Poppins,sans-serif', fontSize: '0.76rem', fontWeight: 600,
              cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'all 0.2s',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {mode === 'folder' ? (
        <>
          <div className="ct-section">
            <label className="ct-section-label accent">SKYBOX FOLDER</label>
            <div className="ct-note" style={{ marginBottom: 8 }}>
              Expected: <code>name.scmskybox</code>, <code>name_albedo.dds</code>, <code>name_glow.dds</code>,
              <code>name_prev.png</code> / <code>name_prev1.png</code> … <code>name_prev3.png</code>
            </div>
            <GenericFolderDropZone
              folderName={folderName}
              fileList={folderFileList}
              onFolder={handleFolderDrop}
              statusLine={folderParsed ? statusLine : null}
              icon=""
            />
          </div>
          {folderParsed?.scmskybox && (
            <div className="ct-section">
              <label className="ct-section-label accent" style={{ color: statusColor }}>DETECTED FILES</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  ['scmskybox', folderParsed.scmskybox],
                  ['albedo',    folderParsed.albedo],
                  ['glow',      folderParsed.glow],
                  ['cirrus',    folderParsed.cirrus],
                  ...folderParsed.previews.map((p, i) => [`preview ${i + 1}`, p]),
                ].map(([label, file]) => (
                  <div key={label} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4,
                    opacity: file ? 1 : 0.35,
                  }}>
                    <span style={{ color: file ? '#4ade80' : 'rgba(255,255,255,0.2)', fontFamily: 'monospace', fontSize: '0.72rem', minWidth: 80 }}>{label}</span>
                    <span style={{ color: file ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)', fontFamily: 'monospace', fontSize: '0.7rem', flex: 1 }}>
                      {file ? file.name : '— not found'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="ct-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="ct-section">
              <label className="ct-section-label accent">SKYBOX NAME</label>
              <input className="ct-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. DesertDusk" autoFocus />
              {skyboxName && <div className="ct-path-preview">/env/skyboxes/{skyboxName}/{skyboxName}.scmskybox</div>}
            </div>
            <div className="ct-section">
              <label className="ct-section-label accent">.SCMSKYBOX FILE</label>
              <div className="ct-dropzone-grid cols-1">
                <DropZone label=".scmskybox" accept={['.scmskybox']} file={scmskybox} onFile={setScmskybox} hint=".scmskybox (required)" />
              </div>
            </div>
            <div className="ct-section">
              <label className="ct-section-label accent">PREVIEWS <span style={{ color: '#f87171', fontSize: '0.6rem', marginLeft: 4 }}>min 1 required</span></label>
              <div className="ct-dropzone-grid cols-3">
                <DropZone label="Preview 1" accept={['.png','.jpg','.jpeg']} file={previews[0]} onFile={f => setPreviewAt(0, f)} hint="required" />
                <DropZone label="Preview 2" accept={['.png','.jpg','.jpeg']} file={previews[1]} onFile={f => setPreviewAt(1, f)} hint="recommended" optional />
                <DropZone label="Preview 3" accept={['.png','.jpg','.jpeg']} file={previews[2]} onFile={f => setPreviewAt(2, f)} hint="recommended" optional />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="ct-section">
              <label className="ct-section-label accent">CUSTOM TEXTURES <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>(all optional)</span></label>
              <div className="ct-dropzone-grid cols-3">
                <DropZone label="Albedo DDS" accept={['.dds']} file={albedo} onFile={setAlbedo} hint="custom albedo" optional />
                <DropZone label="Glow DDS"   accept={['.dds']} file={glow}   onFile={setGlow}   hint="custom glow"   optional />
                <DropZone label="Cirrus DDS" accept={['.dds']} file={cirrus} onFile={setCirrus} hint="custom cirrus" optional />
              </div>
              <div className="ct-note" style={{ marginTop: 6 }}>Leave empty if using default game assets from <code>/env/...</code>.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )};
}

// ── Emitter folder pairing logic ─────────────────────────────────────────────
// Convention: emittername.bp + optional emittername_normal.dds + emittername_ramp.dds
// Multiple emitters per folder → one entry per .bp
function parseEmitterFolder(files) {
  const bpFiles = files.filter(f => /\.bp$/i.test(f.name));
  const ddsFiles = files.filter(f => /\.dds$/i.test(f.name));

  return bpFiles.map(bp => {
    const base = bp.name.replace(/\.bp$/i, '').toLowerCase();
    const normal = ddsFiles.find(f => f.name.toLowerCase() === `${base}_normal.dds`) || null;
    const ramp   = ddsFiles.find(f => f.name.toLowerCase() === `${base}_ramp.dds`)   || null;
    return { name: bp.name.replace(/\.bp$/i, ''), bpFile: bp, normal, ramp };
  });
}

function EmitterUploadForm({ name, setName }) {
  const [mode, setMode]         = useState('single'); // 'single' | 'folder'
  const [bpFile,    setBpFile]    = useState(null);
  const [category,  setCategory]  = useState('');
  const [normalTex, setNormalTex] = useState(null);
  const [rampTex,   setRampTex]   = useState(null);
  const emitterName = name.trim().replace(/\s+/g, '_');
  const singleReady = !!(emitterName && bpFile && category.trim());

  // Folder mode
  const [folderName,     setFolderName]     = useState('');
  const [folderFileList, setFolderFileList] = useState([]);
  const [folderEmitters, setFolderEmitters] = useState([]);
  const [folderStatus,   setFolderStatus]   = useState(null);

  const folderReady = folderEmitters.length > 0 && !!category.trim();
  const ready = mode === 'single' ? singleReady : folderReady;

  const handleFolderDrop = useCallback(async (rootName, files) => {
    const allFiles = Array.from(files);
    if (!allFiles.length) return;
    setFolderName(rootName || 'folder');
    setFolderFileList(
      allFiles.map(f => ({
        name: f.name,
        highlight: /\.(bp|dds)$/i.test(f.name),
      })).sort((a, b) => b.highlight - a.highlight)
    );
    const emitters = parseEmitterFolder(allFiles);
    setFolderEmitters(emitters);
    setFolderStatus(emitters.length > 0 ? 'ok' : 'error');
    if (rootName) setName(rootName);
  }, [setName]);

  const getFiles = async () => {
    const cat = category.trim().replace(/\s+/g, '_');
    if (mode === 'single') {
      const files = [
        { path: `emitter/${cat}/${emitterName}.bp`, data: await bpFile.text(), encoding: 'utf-8' },
      ];
      if (normalTex) files.push({ path: `emitter/${cat}/${emitterName}_normal.dds`, data: await readBase64(normalTex), encoding: 'base64' });
      if (rampTex)   files.push({ path: `emitter/${cat}/${emitterName}_ramp.dds`,   data: await readBase64(rampTex),   encoding: 'base64' });
      return files;
    } else {
      const files = [];
      for (const em of folderEmitters) {
        const en = em.name.replace(/\s+/g, '_');
        files.push({ path: `emitter/${cat}/${en}.bp`, data: await em.bpFile.text(), encoding: 'utf-8' });
        if (em.normal) files.push({ path: `emitter/${cat}/${en}_normal.dds`, data: await readBase64(em.normal), encoding: 'base64' });
        if (em.ramp)   files.push({ path: `emitter/${cat}/${en}_ramp.dds`,   data: await readBase64(em.ramp),   encoding: 'base64' });
      }
      return files;
    }
  };

  return { ready, getFiles, node: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mode switcher */}
      <div className="ct-section">
        <label className="ct-section-label">UPLOAD MODE</label>
        <div style={{ display: 'flex', gap: 0, border: '1px solid rgba(255,255,255,0.08)' }}>
          {[['single', 'Single Emitter'], ['folder', 'Drop Folder']].map(([val, label]) => (
            <button key={val} onClick={() => setMode(val)} style={{
              flex: 1, padding: '9px 0',
              background: mode === val ? 'rgba(165,232,1,0.08)' : 'transparent',
              border: 'none', borderBottom: mode === val ? '2px solid var(--contributions-color)' : '2px solid transparent',
              color: mode === val ? 'var(--contributions-color)' : 'rgba(255,255,255,0.3)',
              fontFamily: 'Poppins,sans-serif', fontSize: '0.76rem', fontWeight: 600,
              cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'all 0.2s',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Category always visible */}
      <div className="ct-section">
        <label className="ct-section-label accent">CATEGORY <span style={{ color: '#f87171', fontSize: '0.6rem', marginLeft: 4 }}>required</span></label>
        <input className="ct-input" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Fire, Water, Explosion, Ambient…" />
        <div className="ct-note" style={{ marginTop: 0 }}>Subfolder in <code>public/emitter/</code>. Determines group in the Emitter Library.</div>
      </div>

      {mode === 'folder' ? (
        <>
          <div className="ct-section">
            <label className="ct-section-label accent">EMITTER FOLDER</label>
            <div className="ct-note" style={{ marginBottom: 8 }}>
              Expected per emitter: <code>name.bp</code>, optional <code>name_normal.dds</code>, <code>name_ramp.dds</code>
            </div>
            <GenericFolderDropZone
              folderName={folderName}
              fileList={folderFileList}
              onFolder={handleFolderDrop}
              statusLine={folderEmitters.length > 0 ? `${folderEmitters.length} emitter(s) detected` : 'No .bp files found'}
              icon=""
            />
          </div>
          {folderEmitters.length > 0 && (
            <div className="ct-section">
              <label className="ct-section-label accent">DETECTED EMITTERS ({folderEmitters.length})</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {folderEmitters.map((em, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4 }}>
                    <span style={{ color: 'rgba(165,232,1,0.7)', fontFamily: 'monospace', fontSize: '0.75rem', flex: 1 }}>{em.name}</span>
                    <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>
                      {[em.normal && 'normal', em.ramp && 'ramp'].filter(Boolean).join(' · ') || 'bp only'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="ct-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="ct-section">
              <label className="ct-section-label accent">EMITTER NAME</label>
              <input className="ct-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. FireColumn_Large" autoFocus />
              {emitterName && category.trim() && <div className="ct-path-preview">/env/emitter/{category.trim().replace(/\s+/g,'_')}/{emitterName}.bp</div>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="ct-section">
              <label className="ct-section-label accent">BLUEPRINT (.bp)</label>
              <div className="ct-dropzone-grid cols-1">
                <DropZone label="Emitter .bp" icon="" accept={['.bp']} file={bpFile} onFile={setBpFile} hint=".bp (required)" />
              </div>
            </div>
            <div className="ct-section">
              <label className="ct-section-label accent">TEXTURES <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>(both optional)</span></label>
              <div className="ct-dropzone-grid cols-2">
                <DropZone label="Normal Texture" icon="" accept={['.dds', '.png', '.tga']} file={normalTex} onFile={setNormalTex} hint="what gets emitted" optional />
                <DropZone label="Ramp Texture"   icon="" accept={['.dds', '.png', '.tga']} file={rampTex}   onFile={setRampTex}   hint="color ramp (.dds)" optional />
              </div>
              <div className="ct-note" style={{ marginTop: 6 }}>
                <strong>Normal texture</strong> — defines the shape/surface of what is emitted.<br/>
                <strong>Ramp texture</strong> — horizontal gradient that controls particle color over lifetime.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )};
}


// ── Texture folder pairing logic ─────────────────────────────────────────────
// Convention: basename_albedo.dds + basename_normalsTS.dds
//             basename_preview.png / basename_albedo_preview.png
//             basename_normal_preview.png
// Multiple texture sets per folder — paired by shared basename.
function parseTextureFolder(files) {
  const albedoFiles  = files.filter(f => /_albedo\.dds$/i.test(f.name));
  const normalFiles  = files.filter(f => /_normalsTS\.dds$/i.test(f.name));
  const previewFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f.name));

  return albedoFiles.map(albedo => {
    const base = albedo.name.replace(/_albedo\.dds$/i, '').toLowerCase();
    const normal = normalFiles.find(f => f.name.toLowerCase() === `${base}_normalsTS.dds`.toLowerCase()) || null;

    // preview: base_preview.png, base_albedo_preview.png
    const prevAlbedo = previewFiles.find(f => {
      const lower = f.name.toLowerCase();
      return lower === `${base}_preview.png` || lower === `${base}_albedo_preview.png`;
    }) || null;
    const prevNormal = previewFiles.find(f => f.name.toLowerCase() === `${base}_normal_preview.png`) || null;

    return { name: albedo.name.replace(/_albedo\.dds$/i, ''), albedo, normal, prevAlbedo, prevNormal };
  });
}

function TextureUploadForm({ name, setName }) {
  const [mode, setMode]         = useState('single'); // 'single' | 'folder'
  const [albedo,        setAlbedo]        = useState(null);
  const [normal,        setNormal]        = useState(null);
  const [preview,       setPreview]       = useState(null);
  const [previewNormal, setPreviewNormal] = useState(null);
  const texName = name.trim().replace(/\s+/g, '_');
  const singleReady = !!(texName && albedo && preview);

  // Folder mode
  const [folderName,     setFolderName]     = useState('');
  const [folderFileList, setFolderFileList] = useState([]);
  const [folderSets,     setFolderSets]     = useState([]);
  const [folderStatus,   setFolderStatus]   = useState(null);

  const folderReady = folderSets.length > 0;
  const ready = mode === 'single' ? singleReady : folderReady;

  const handleFolderDrop = useCallback(async (rootName, files) => {
    const allFiles = Array.from(files);
    if (!allFiles.length) return;
    setFolderName(rootName || 'folder');
    setFolderFileList(
      allFiles.map(f => ({
        name: f.name,
        highlight: /\.(dds|png|jpg|jpeg)$/i.test(f.name),
      })).sort((a, b) => b.highlight - a.highlight)
    );
    const sets = parseTextureFolder(allFiles);
    setFolderSets(sets);
    setFolderStatus(sets.length > 0 ? 'ok' : 'error');
    if (sets.length === 1) setName(sets[0].name);
    else if (rootName)     setName(rootName);
  }, [setName]);

  const getFiles = async () => {
    if (mode === 'single') {
      const tn = texName;
      const files = [
        { path: `textures/${tn}/${tn}_albedo.dds`,   data: await readBase64(albedo),  encoding: 'base64' },
        { path: `textures/${tn}/${tn}_preview.png`,  data: await readBase64(preview), encoding: 'base64' },
      ];
      if (normal)        files.push({ path: `textures/${tn}/${tn}_normalsTS.dds`,      data: await readBase64(normal),        encoding: 'base64' });
      if (previewNormal) files.push({ path: `textures/${tn}/${tn}_normal_preview.png`, data: await readBase64(previewNormal), encoding: 'base64' });
      return files;
    } else {
      const files = [];
      // Each set gets its own subfolder named after its basename
      const groupName = (folderName || 'textures').replace(/\s+/g, '_');
      for (const set of folderSets) {
        const tn = set.name.replace(/\s+/g, '_');
        files.push({ path: `textures/${groupName}/${tn}_albedo.dds`, data: await readBase64(set.albedo), encoding: 'base64' });
        if (set.normal)     files.push({ path: `textures/${groupName}/${tn}_normalsTS.dds`,      data: await readBase64(set.normal),     encoding: 'base64' });
        if (set.prevAlbedo) files.push({ path: `textures/${groupName}/${tn}_preview.png`,        data: await readBase64(set.prevAlbedo), encoding: 'base64' });
        if (set.prevNormal) files.push({ path: `textures/${groupName}/${tn}_normal_preview.png`, data: await readBase64(set.prevNormal), encoding: 'base64' });
      }
      return files;
    }
  };

  return { ready, getFiles, node: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mode switcher */}
      <div className="ct-section">
        <label className="ct-section-label">UPLOAD MODE</label>
        <div style={{ display: 'flex', gap: 0, border: '1px solid rgba(255,255,255,0.08)' }}>
          {[['single', 'Single Set'], ['folder', 'Drop Folder']].map(([val, label]) => (
            <button key={val} onClick={() => setMode(val)} style={{
              flex: 1, padding: '9px 0',
              background: mode === val ? 'rgba(165,232,1,0.08)' : 'transparent',
              border: 'none', borderBottom: mode === val ? '2px solid var(--contributions-color)' : '2px solid transparent',
              color: mode === val ? 'var(--contributions-color)' : 'rgba(255,255,255,0.3)',
              fontFamily: 'Poppins,sans-serif', fontSize: '0.76rem', fontWeight: 600,
              cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'all 0.2s',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {mode === 'folder' ? (
        <>
          <div className="ct-section">
            <label className="ct-section-label accent">TEXTURE FOLDER</label>
            <div className="ct-note" style={{ marginBottom: 8 }}>
              Pairs by basename: <code>name_albedo.dds</code> + <code>name_normalsTS.dds</code>
              + optional <code>name_preview.png</code>, <code>name_normal_preview.png</code>
            </div>
            <GenericFolderDropZone
              folderName={folderName}
              fileList={folderFileList}
              onFolder={handleFolderDrop}
              statusLine={folderSets.length > 0
                ? `${folderSets.length} texture set(s) detected`
                : 'No _albedo.dds files found'}
              icon=""
            />
          </div>
          {folderSets.length > 0 && (
            <div className="ct-section">
              <label className="ct-section-label accent">DETECTED TEXTURE SETS ({folderSets.length})</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {folderSets.map((set, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4 }}>
                    <span style={{ color: 'rgba(165,232,1,0.7)', fontFamily: 'monospace', fontSize: '0.75rem', flex: 1 }}>{set.name}</span>
                    <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>
                      {[
                        'albedo',
                        set.normal     && 'normal',
                        set.prevAlbedo && 'preview',
                        set.prevNormal && 'normal preview',
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="ct-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="ct-section">
              <label className="ct-section-label accent">TEXTURE SET NAME</label>
              <input className="ct-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. RockyGround_01" autoFocus />
              {texName && <div className="ct-path-preview">/env/textures/{texName}/{texName}_albedo.dds</div>}
            </div>
            <div className="ct-note">Power-of-two, min 512×512, recommended 2048×2048.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="ct-section">
              <label className="ct-section-label accent">DDS FILES</label>
              <div className="ct-dropzone-grid cols-2">
                <DropZone label="Albedo DDS"  icon="" accept={['.dds']} file={albedo} onFile={setAlbedo} hint={`${texName||'Name'}_albedo.dds`} />
                <DropZone label="Normals DDS" icon="" accept={['.dds']} file={normal} onFile={setNormal} hint={`${texName||'Name'}_normalsTS.dds`} optional />
              </div>
              {texName && <div className="ct-note" style={{ marginTop: 6 }}>Albedo required. Normals recommended: <code>{texName}_normalsTS.dds</code></div>}
            </div>
            <div className="ct-section">
              <label className="ct-section-label accent">PREVIEW</label>
              <div className="ct-dropzone-grid cols-2">
                <DropZone label="Albedo Preview" icon="" accept={['.png', '.jpg', '.jpeg']} file={preview} onFile={setPreview} hint="albedo render / screenshot" />
                <DropZone label="Normal Preview" icon="" accept={['.png', '.jpg', '.jpeg']} file={previewNormal} onFile={setPreviewNormal} hint="normal map render" optional />
              </div>
              <div className="ct-note" style={{ marginTop: 4 }}>Shown as thumbnails in the Download tab.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )};
}


// ── Upload Section ────────────────────────────────────────────────────────────
function UploadSection({ authState, onConnectGitHub, onDisconnectGitHub }) {
  const [assetType,   setAssetType]   = useState('prop');
  const [displayName, setDisplayName] = useState('');
  const [name,        setName]        = useState('');
  const [notes,       setNotes]       = useState('');
  const [submitted,   setSubmitted]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [prResult,    setPrResult]    = useState(null);

  const isConnected      = authState?.status === 'connected';
  const effectiveUsername = isConnected ? authState.username : displayName.trim();
  const meta = TYPE_META[assetType];

  const switchType = (t) => { setAssetType(t); setName(''); };

  const propForm    = PropUploadForm({ name, setName });
  const skyboxForm  = SkyboxUploadForm({ name, setName });
  const emitterForm = EmitterUploadForm({ name, setName });
  const textureForm = TextureUploadForm({ name, setName });
  const current = { prop: propForm, skybox: skyboxForm, emitter: emitterForm, texture: textureForm }[assetType];

  const canSubmit = !!(isConnected && current.ready);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await window.electronAPI.invoke('submit-contribution-pr', {
        useGitHubAuth: isConnected,
        contributorName: effectiveUsername,
        assetType,
        assetName: name.trim() || 'merged-folder',
        notes,
        files: await current.getFiles(),
      });
      if (!result?.success) throw new Error(result?.error || 'PR submission failed');
      setPrResult({ prUrl: result.prUrl, prNumber: result.prNumber });
      setSubmitted(true);
    } catch (err) {
      console.error('[contrib] submit failed:', err);
      alert('Submission failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => { setSubmitted(false); setName(''); setNotes(''); setPrResult(null); };

  if (submitted) return (
    <div className="ct-success">
      <div className="ct-success-icon"></div>
      <div className="ct-success-title">Pull Request submitted</div>
      <div className="ct-success-body">
        <strong style={{ color: '#ddd' }}>{name}</strong> has been submitted for review.
        {prResult?.prUrl && <><br /><a className="ct-success-link" href={prResult.prUrl} target="_blank" rel="noreferrer">View PR #{prResult.prNumber} on GitHub</a></>}
      </div>
      {!isConnected && (
        <div className="ct-success-gh-hint">
          <span style={{ opacity: 0.5, fontSize: '0.78rem' }}>Want leaderboard & achievements?</span>
          <button className="ct-success-connect-btn" onClick={onConnectGitHub}>Connect GitHub</button>
        </div>
      )}
      <button className="ct-success-again" onClick={reset}>Submit another</button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, ...accentVars(assetType) }}>

      {/* Auth panel */}
      <div style={{ marginBottom: 20 }}>
        <GitHubAuthPanel authState={authState} onConnect={onConnectGitHub} onDisconnect={onDisconnectGitHub} />
      </div>

      {/* Display name (no-GH only) */}
      {!isConnected && (
        <div className="ct-section" style={{ marginBottom: 20 }}>
          <label className="ct-section-label">DISPLAY NAME <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 4 }}>(alias, no account needed)</span></label>
          <input className="ct-input" style={{ maxWidth: 320 }} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="your name or alias" />
        </div>
      )}

      {/* Type switcher */}
      <div className="ct-section" style={{ marginBottom: 20 }}>
        <label className="ct-section-label">ASSET TYPE</label>
        <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.08)' }}>
          {ASSET_TYPES.map(t => {
            const m = TYPE_META[t]; const active = assetType === t;
            return (
              <button key={t} onClick={() => switchType(t)} style={{
                flex: 1, padding: '10px 0', background: active ? `${m.accent}14` : 'transparent',
                border: 'none', borderRight: '1px solid rgba(255,255,255,0.08)',
                borderBottom: active ? `2px solid ${m.accent}` : '2px solid transparent',
                color: active ? m.accent : 'rgba(255,255,255,0.3)',
                fontFamily: 'Poppins,sans-serif', fontSize: '0.8rem', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>{m.label}</button>
            );
          })}
        </div>
      </div>

      <div className="ct-divider" style={{ marginBottom: 20 }} />

      <div style={accentVars(assetType)}>{current.node}</div>

      {/* Notes */}
      <div className="ct-section" style={{ marginTop: 20 }}>
        <label className="ct-section-label">NOTES FOR REVIEWER <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>(optional)</span></label>
        <textarea className="ct-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="License info, source attribution, known issues, resolution details…" />
      </div>

      {/* Submit row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ flex: 1, fontSize: '0.72rem', color: 'rgba(255,255,255,0.22)', fontStyle: 'italic' }}>
          {!isConnected
            ? <span style={{ color: 'rgba(251,191,36,0.7)' }}>Connect your GitHub account above to submit.</span>
            : !current.ready ? 'Fill in all required fields above.'
            : `Ready — PR submitted as "${effectiveUsername}" (GitHub verified)`}
        </span>
        <button className={`ct-btn-submit${canSubmit ? ' ready' : ''}`} onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? 'Creating PR…' : `Submit ${meta.label}`}
        </button>
      </div>
    </div>
  );
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
function Leaderboard({ onSelectUser }) {
  const { contributors, loaded } = useGHData();
  const sorted = [...contributors].sort((a, b) => b.approved - a.approved);
  const total  = contributors.reduce((s, c) => s + c.totalContributions, 0);

  if (!loaded) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '60px 0', color: 'rgba(255,255,255,0.2)' }}>
      <div style={{ fontSize: '0.8rem', letterSpacing: '0.08em', animation: 'ct-spin 1.5s linear infinite', display: 'inline-block' }}></div>
      <div style={{ fontSize: '0.78rem' }}>Loading from GitHub…</div>
    </div>
  );

  if (sorted.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '60px 0', color: 'rgba(255,255,255,0.2)' }}>
      <div style={{ fontSize: '2rem', opacity: 0.4 }}></div>
      <div style={{ fontSize: '0.85rem', letterSpacing: '0.08em' }}>No contributors yet</div>
      <div style={{ fontSize: '0.72rem', color: 'rgba(52,211,153,0.4)' }}>Be the first to submit an asset</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="ct-lb-header-row">
        <span>#</span><span>CONTRIBUTOR</span>
        <span style={{ textAlign: 'right' }}>APPROVED</span>
        <span style={{ textAlign: 'right' }}>TIER</span>
      </div>
      <div className="ct-lb-divider" />
      {sorted.map((c, i) => {
        const types  = [...new Set(c.contributions.map(x => x.type))];
        const tier   = getTier(c);
        return (
          <div key={c.username} className={`ct-lb-row${i === 0 ? ' gold' : ''}`} onClick={() => onSelectUser(c)}>
            <div className="ct-lb-rank" style={{ color: i < 3 ? RANK_COLORS[i] : 'rgba(255,255,255,0.18)' }}>
              {i + 1}
            </div>
            <div className="ct-lb-user">
              <div className="ct-lb-avatar-wrap">
                <div className="ct-lb-avatar" style={{
                  background: i < 3 ? RANK_COLORS[i] : '#1e2a38',
                  color: i < 3 ? '#0a0a0a' : '#94a3b8',
                  border: tier ? `1.5px solid ${tier.color}` : '1.5px solid transparent',
                  boxShadow: tier ? `0 0 8px ${tier.color}55` : 'none',
                  fontSize: '0.6rem',
                  overflow: 'hidden',
                }}>
                  {c.avatarUrl
                    ? <img src={c.avatarUrl} alt={c.username} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                    : c.avatar}
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="ct-lb-username" style={{ color: tier ? tier.color : '#ddd' }}>{c.username}</div>
                <div className="ct-lb-types">
                  {types.map(t => <span key={t} className={`ct-lb-typebadge ct-type-${t}`}>{TYPE_META[t]?.label || t}</span>)}
                </div>
              </div>
            </div>
            <div className="ct-lb-num" style={{ color: '#4ade80' }}>{c.approved}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              {tier ? <TierBadge tier={tier} size="sm" /> : <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.15)' }}>—</span>}
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 16, color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace', fontSize: '0.7rem', textAlign: 'center' }}>
        {sorted.length} contributors
        <button onClick={() => loadGitHubData(true)} style={{ marginLeft: 12, background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'monospace' }}>refresh</button>
      </div>
    </div>
  );
}

// ── Contributor Profile ───────────────────────────────────────────────────────
function ContributorProfile({ user, onBack }) {
  const { contributors } = useGHData();
  const rank = [...contributors].sort((a, b) => b.approved - a.approved).findIndex(c => c.username === user.username);
  const tier   = getTier(user);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <button className="ct-back-btn" onClick={onBack}>back to leaderboard</button>

      {/* Header */}
      <div className="ct-profile-header">
        <div className="ct-profile-avatar-wrap">
          <div className="ct-profile-avatar" style={{
            background: rank < 3 ? RANK_COLORS[rank] : '#1e2a38',
            color: rank < 3 ? '#0a0a0a' : '#94a3b8',
            border: tier ? `2px solid ${tier.color}` : '2px solid rgba(255,255,255,0.08)',
            boxShadow: tier ? `0 0 20px ${tier.color}44` : 'none',
            overflow: 'hidden',
          }}>
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt={user.username} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
              : user.avatar}
          </div>
          {tier && <div className="ct-profile-tier-badge-below" style={{ background: tier.color + '18', borderColor: tier.color, color: tier.color }}>{tier.label}</div>}
        </div>
        <div className="ct-profile-info">
          <div className="ct-profile-name" style={{ color: tier ? tier.color : '#fff' }}>{user.username}</div>
          <div className="ct-profile-meta">GitHub contributor · since {user.joinedAt} · Rank #{rank + 1}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {Object.entries(user.byType || {}).map(([t, n]) => (
              <span key={t} className={`ct-lb-typebadge ct-type-${t}`}>{n}x {TYPE_META[t]?.label || t}</span>
            ))}
          </div>
        </div>
        <div className="ct-profile-stats">
          {[['TOTAL', user.approved, '#4ade80']].map(([k, v, col]) => (
            <div key={k} className="ct-profile-stat">
              <div className="ct-profile-stat-val" style={{ color: col }}>{v}</div>
              <div className="ct-profile-stat-key">{k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tier info */}
      {tier && (
        <div className="ct-tier-info-row">
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem' }}>Current tier:</span>
          <TierBadge tier={tier} size="md" />
          {(() => {
            const nextIdx = TIERS.indexOf(tier) - 1;
            const next = nextIdx >= 0 ? TIERS[nextIdx] : null;
            if (!next) return <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)' }}>Max tier reached</span>;
            const needed = next.minApproved - user.approved;
            return <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>{needed} more approved to reach <span style={{ color: next.color }}>{next.label}</span></span>;
          })()}
        </div>
      )}

      {/* Contributions list */}
      <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.67rem', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '20px 0 10px' }}>All Contributions</div>
      <div className="ct-contrib-list">
        {user.contributions.map(c => (
          <div key={c.id} className="ct-contrib-card">
            <div className="ct-contrib-card-top">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ct-contrib-name">{c.name}<TypeBadge type={c.type} /></div>
                <div className="ct-contrib-tags">{c.tags.map(t => <span key={t} className="ct-contrib-tag">#{t}</span>)}</div>
                {c.rejectionReason && <div className="ct-rejection-box"><span className="ct-rejection-label">Rejection reason: </span>{c.rejectionReason}</div>}
              </div>
              <div className="ct-contrib-right">
                <StatusBadge status={c.status} />
                <span className="ct-contrib-date">{c.date}</span>
                <span className="ct-contrib-size">{c.size}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



// ── Skybox Generator Button ───────────────────────────────────────────────────
function SkyboxGeneratorButton({ asset, onNavigateTab, onClose, autoSwitch }) {
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error

  const handleLoad = async () => {
    setStatus('loading');
    try {
      const RAW_BASE = 'https://raw.githubusercontent.com/timmasalme/ForgeMapToolkit-Assets/main';
      const url = `${RAW_BASE}/${asset._folder}/${asset._assetName}/${asset._assetName}.scmskybox`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = await resp.json();
      window._pendingContribSkybox = raw?.Data ? raw : { Data: raw };
      // Navigate if autoSwitch is on (default: true) and onNavigateTab is wired up
      if (autoSwitch !== false && onNavigateTab) {
        onNavigateTab('skybox-generator', asset);
        onClose();
        return; // modal closed, no further state update needed
      }
      setStatus('ready');
    } catch (err) {
      console.error('[contrib] skybox fetch failed:', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  // Only shown when autoSwitch is off and data was loaded successfully
  if (status === 'ready') return (
    <div style={{ fontSize:'0.72rem', color:'#34d399', padding:'6px 10px',
      background:'rgba(52,211,153,0.06)', border:'1px solid rgba(52,211,153,0.2)', borderRadius:4 }}>
      Loaded — open the Skybox Generator tab to apply it.
    </div>
  );

  return (
    <button className="ct-dl-btn"
      style={{ margin:0, background:'rgba(52,211,153,0.08)', borderColor:'rgba(52,211,153,0.3)', color:'#34d399' }}
      onClick={handleLoad}
      disabled={status === 'loading'}>
      {status === 'loading' ? 'Fetching…'
       : status === 'error'  ? 'Failed — retry?'
       : 'Load into Skybox Generator'}
    </button>
  );
}

// ── Download Assets Tab ───────────────────────────────────────────────────────
// ── Asset Detail Modal ────────────────────────────────────────────────────────
function AssetDetailModal({ asset, contributors, onClose, onNavigateTab, autoSwitch }) {
  const [downloading, setDownloading] = useState({});
  const [previewIdx, setPreviewIdx]   = useState(0);
  const tier = asset.contributor
    ? getTier(contributors.find(c => c.username === asset.contributor) || { approved: 0 })
    : null;
  const allPreviews = [asset.preview, ...(asset.extraPreviews || [])].filter(Boolean);

  async function handleDownload(assetName, folder, subItemFilter) {
    const key = subItemFilter || '__all__';
    setDownloading(d => ({ ...d, [key]: 'pending' }));
    try {
      const res = await window.electronAPI.invoke('contrib-download-asset', { folder, assetName, subItemFilter });
      setDownloading(d => ({ ...d, [key]: res?.success ? 'done' : 'error' }));
    } catch (_) { setDownloading(d => ({ ...d, [key]: 'error' })); }
  }

  function dlBtn(label, assetName, folder, subItemFilter) {
    const key = subItemFilter || '__all__';
    const st = downloading[key];
    return (
      <button
        key={key}
        className={`ct-dl-btn${st==='done'?' done':st==='error'?' error':''}`}
        onClick={() => handleDownload(assetName, folder, subItemFilter)}
        disabled={!assetName || st==='pending'}
        style={{ margin: 0 }}
      >
        {st==='pending'?'…':st==='done'?'Downloaded':st==='error'?'Failed':`${label}`}
      </button>
    );
  }

  // Generic sub-item list renderer (props, emitters, skyboxes, textures)
  function SubItemList({ items, itemLabel }) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <div className="ct-note" style={{ marginBottom:4 }}>
          Folder with {items.length} {itemLabel}s — download individually or all at once:
        </div>
        {items.map(item => (
          <div key={item.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:4 }}>
            <span style={{ fontSize:'0.8rem', color:'#ddd', fontFamily:'monospace' }}>{item.name}</span>
            {dlBtn('Download', asset._assetName, asset._folder, item.name)}
          </div>
        ))}
        <div style={{ marginTop:4 }}>{dlBtn('Download All', asset._assetName, asset._folder)}</div>
      </div>
    );
  }

  // Determine which sub-items to show (first multi-item list wins per type)
  function renderDownloadSection() {
    if (asset.type === 'prop'    && asset.subProps?.length    > 1) return <SubItemList items={asset.subProps}    itemLabel="prop"    />;
    if (asset.type === 'emitter' && asset.subEmitters?.length > 1) return <SubItemList items={asset.subEmitters} itemLabel="emitter" />;
    if (asset.type === 'skybox'  && asset.subSkyboxes?.length > 1) return <SubItemList items={asset.subSkyboxes} itemLabel="skybox"  />;
    if (asset.type === 'texture' && asset.subTextures?.length > 1) return <SubItemList items={asset.subTextures} itemLabel="texture" />;
    return dlBtn('Download', asset._assetName, asset._folder);
  }

  return (
    <div className="ct-modal-backdrop" onClick={onClose}>
      <div className="ct-modal" onClick={e => e.stopPropagation()}>
        <button className="ct-modal-close" onClick={onClose}>×</button>

        <div className="ct-modal-preview" style={{ position: 'relative' }}>
          {allPreviews.length > 0
            ? <img src={allPreviews[previewIdx]} alt={asset.name} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
            : <div className="ct-dl-card-preview-placeholder" style={{ height:'100%' }}>
                <span style={{ fontSize:'3rem', opacity:0.1, fontFamily:'monospace' }}>{TYPE_META[asset.type]?.icon}</span>
              </div>
          }
          {allPreviews.length > 1 && (<>
            <button
              onClick={() => setPreviewIdx(i => (i - 1 + allPreviews.length) % allPreviews.length)}
              style={{
                position:'absolute', top:'50%', left:10, transform:'translateY(-50%)',
                background:'rgba(0,0,0,0.6)', border:'1px solid rgba(165,232,1,0.25)',
                color:'var(--contributions-color,#a5e801)', width:32, height:32, cursor:'pointer',
                fontSize:'1.2rem', display:'flex', alignItems:'center', justifyContent:'center',
                transition:'background 0.15s', borderRadius:0,
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(165,232,1,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(0,0,0,0.6)'}
            >‹</button>
            <button
              onClick={() => setPreviewIdx(i => (i + 1) % allPreviews.length)}
              style={{
                position:'absolute', top:'50%', right:10, transform:'translateY(-50%)',
                background:'rgba(0,0,0,0.6)', border:'1px solid rgba(165,232,1,0.25)',
                color:'var(--contributions-color,#a5e801)', width:32, height:32, cursor:'pointer',
                fontSize:'1.2rem', display:'flex', alignItems:'center', justifyContent:'center',
                transition:'background 0.15s', borderRadius:0,
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(165,232,1,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(0,0,0,0.6)'}
            >›</button>
            <div className="ct-modal-carousel-dots">
              {allPreviews.map((_, i) => (
                <button key={i} className={`ct-modal-dot${i===previewIdx?' active':''}`} onClick={() => setPreviewIdx(i)} />
              ))}
            </div>
          </>)}
        </div>

        <div className="ct-modal-body">
          <div className="ct-modal-header">
            <div>
              <div className="ct-modal-title">{asset.name}</div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
                <TypeBadge type={asset.type} />
                {asset.contributor && (
                  <span style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.3)' }}>
                    by <span style={{ color: tier ? tier.color : 'rgba(255,255,255,0.5)' }}>{asset.contributor}</span>
                  </span>
                )}
                <span className="ct-contrib-date">{asset.date}</span>
              </div>
            </div>
            <a href={asset.downloadUrl} target="_blank" rel="noreferrer"
               style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.2)', textDecoration:'none', fontFamily:'monospace' }}>
              PR #{asset.id}
            </a>
          </div>

          <div className="ct-modal-divider" />
          <div className="ct-modal-section-label">DOWNLOAD</div>

          {renderDownloadSection()}

          {asset.type === 'skybox' && (
            <SkyboxGeneratorButton asset={asset} onNavigateTab={onNavigateTab} onClose={onClose} autoSwitch={autoSwitch} />
          )}

          {asset._files && asset._files.length > 0 && (
            <>
              <div className="ct-modal-divider" style={{ marginTop:12 }} />
              <div className="ct-modal-section-label">FILES</div>
              <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                {asset._files.map(f => (
                  <div key={f} style={{ fontFamily:'monospace', fontSize:'0.65rem', color:'rgba(255,255,255,0.3)', padding:'2px 8px', background:'rgba(255,255,255,0.02)', borderRadius:3 }}>{f}</div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DownloadAssets({ onNavigateTab }) {
  const { contributors, assets, loaded } = useGHData();
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState(null);
  const [autoSwitch, setAutoSwitch] = useState(true);

  useEffect(() => {
    window.electronAPI.invoke('settings-load').then(s => {
      setAutoSwitch(s?.contribSkyboxAutoSwitch !== false);
    });
  }, []);

  const filtered = assets.filter(a => {
    if (a.status === 'removed') return false;
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (search.trim() && !a.name.toLowerCase().includes(search.toLowerCase()) &&
        !(a.contributor || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = assets.filter(a => a.status !== 'removed').reduce((acc, a) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {});

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
      <div className="ct-dl-filterbar">
        <div className="ct-dl-type-filters">
          {[['all','All'], ...ASSET_TYPES.map(t => [t, TYPE_META[t].label])].map(([val, label]) => (
            <button key={val}
              className={`ct-dl-filter-btn${typeFilter===val?' active':''}`}
              onClick={() => setTypeFilter(val)}
              style={typeFilter===val ? { '--fc':'var(--contributions-color)', '--fb':'rgba(165,232,1,0.1)', '--fbd':'rgba(165,232,1,0.4)' } : {}}
            >
              
              {label}
              <span className="ct-dl-count">{val==='all' ? assets.length : (counts[val]||0)}</span>
            </button>
          ))}
        </div>
        <input className="ct-input ct-dl-search" placeholder="Search by name or contributor…"
          value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth:240 }} />
      </div>

      <div className="ct-lb-divider" style={{ margin:'12px 0' }} />

      {!loaded ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:'60px 0', color:'rgba(255,255,255,0.2)' }}>
          <div style={{ fontSize:'0.8rem', animation:'ct-spin 1.5s linear infinite', display:'inline-block' }}>⟳</div>
          <div style={{ fontSize:'0.78rem' }}>Loading assets from GitHub…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:'60px 0', color:'rgba(255,255,255,0.2)' }}>
          <div style={{ fontSize:'2rem', opacity:0.3 }}></div>
          <div style={{ fontSize:'0.85rem' }}>{assets.length === 0 ? 'No approved assets yet' : 'No assets match your filter'}</div>
          {assets.length === 0 && <div style={{ fontSize:'0.72rem', color:'rgba(165,232,1,0.35)' }}>Approved contributions will appear here →</div>}
        </div>
      ) : (
        <div className="ct-dl-grid">
          {filtered.map(asset => {
            const tier = asset.contributor
              ? getTier(contributors.find(c => c.username === asset.contributor) || { approved:0 })
              : null;
            return (
              <div key={asset.id} className="ct-dl-card" onClick={() => setSelected(asset)}>
                <div className="ct-dl-card-preview">
                  {asset.preview
                    ? <img src={asset.preview} alt={asset.name}
                        style={{ width:'100%', height:'100%', objectFit:'cover' }}
                        onError={e => { e.target.style.display='none'; }} />
                    : <div className="ct-dl-card-preview-placeholder">
                        <span style={{ fontSize:'1.8rem', opacity:0.2, fontFamily:'monospace' }}>{TYPE_META[asset.type]?.icon}</span>
                      </div>
                  }
                  <TypeBadge type={asset.type} />
                  {asset.type === 'skybox' && <div className="ct-dl-skybox-hint">Gen</div>}
                </div>
                <div className="ct-dl-card-body">
                  <div className="ct-dl-card-name">{asset.name}</div>
                  {asset.contributor && (
                    <div className="ct-dl-card-contributor">
                      by <span style={{ color: tier ? tier.color : 'rgba(255,255,255,0.5)' }}>{asset.contributor}</span>
                    </div>
                  )}
                  <div className="ct-dl-card-meta">
                    <span className="ct-contrib-date">{asset.date}</span>
                    {asset.subProps?.length    > 1 && <span style={{ fontSize:'0.62rem', color:'rgba(165,232,1,0.5)', fontFamily:'monospace' }}>{asset.subProps.length} props</span>}
                    {asset.subEmitters?.length > 1 && <span style={{ fontSize:'0.62rem', color:'rgba(165,232,1,0.5)', fontFamily:'monospace' }}>{asset.subEmitters.length} emitters</span>}
                    {asset.subSkyboxes?.length > 1 && <span style={{ fontSize:'0.62rem', color:'rgba(165,232,1,0.5)', fontFamily:'monospace' }}>{asset.subSkyboxes.length} skyboxes</span>}
                    {asset.subTextures?.length > 1 && <span style={{ fontSize:'0.62rem', color:'rgba(165,232,1,0.5)', fontFamily:'monospace' }}>{asset.subTextures.length} textures</span>}
                  </div>
                </div>
                <div className="ct-dl-card-footer">click for details</div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <AssetDetailModal asset={selected} contributors={contributors}
          onClose={() => setSelected(null)} onNavigateTab={onNavigateTab} autoSwitch={autoSwitch} />
      )}
    </div>
  );
}

export function ContributionsWidget({ onOpenTab }) {
  const { contributors, assets } = useGHData();
  const total    = contributors.reduce((s, c) => s + c.approved, 0);
  const approved = total;
  const top3     = [...contributors].sort((a, b) => b.approved - a.approved).slice(0, 3);

  return (
    <div
      onClick={onOpenTab}
      style={{
        background: 'rgba(52,211,153,0.04)',
        border: '1px solid rgba(52,211,153,0.18)',
        borderRadius: 8,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'background 0.2s, border-color 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.08)'; e.currentTarget.style.borderColor = 'rgba(52,211,153,0.35)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.04)'; e.currentTarget.style.borderColor = 'rgba(52,211,153,0.18)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#34d399', fontSize: '0.7rem', letterSpacing: '0.12em', fontWeight: 600, textTransform: 'uppercase' }}>Community Assets</span>
        </div>
        <span style={{ color: 'rgba(52,211,153,0.5)', fontSize: '0.7rem' }}>open</span>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: '#34d399', fontSize: '1.3rem', fontWeight: 700, lineHeight: 1 }}>{approved}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', letterSpacing: '0.08em', marginTop: 2 }}>APPROVED</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: '#a3f0cc', fontSize: '1.3rem', fontWeight: 700, lineHeight: 1 }}>{contributors.length}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', letterSpacing: '0.08em', marginTop: 2 }}>CONTRIBUTORS</span>
        </div>
      </div>
      {top3.length > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem' }}>TOP:</span>
          {top3.map((c, i) => (
            <div key={c.username} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: i < 3 ? RANK_COLORS[i] : '#1e2a38',
                color: '#0a0a0a', fontSize: '0.5rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{c.avatar}</div>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.67rem' }}>{c.username}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: 'rgba(52,211,153,0.35)', fontSize: '0.7rem', fontStyle: 'italic' }}>No contributions yet — be the first!</div>
      )}
    </div>
  );
}
// ── ContribHelpInfoPanel — shared right-column detail card ───────────────────
function ContribHelpInfoPanel({ sel }) {
  return (
    <div style={{ padding: 0 }}>
      <div className="help-adv-hero" style={{ marginBottom: 24 }}>
        <div className="help-adv-hero-content">
          <h2 className="help-adv-hero-title" style={{ fontSize: '1.6rem' }}>{sel.title}</h2>
          <p className="help-adv-hero-desc">{sel.desc}</p>
        </div>
      </div>
      <div className="help-adv-structure">
        <h3 className="help-adv-section-header">
          <span className="help-adv-section-num">01</span>Details
        </h3>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px 24px', marginTop: 24 }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sel.details.map(([label, value], i) => (
              <li key={i} style={{ display: 'flex', gap: 12, fontSize: '0.88rem', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--tab-color)', minWidth: 140, flexShrink: 0 }}>{label}:</strong>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>{value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="help-adv-note" style={{ marginTop: 16 }}>
        <strong>Tip: </strong>{sel.tip}
      </div>
    </div>
  );
}

export default function ContributionsTab({ onNavigateTab }) {
  const [section,         setSection]         = useState('upload');
  const [selectedUser,    setSelectedUser]    = useState(null);
  const [authState,       setAuthState]       = useState(null);
  const [showHelp,        setShowHelp]        = useState(false);
  const [activeHelpTab,   setActiveHelpTab]   = useState('upload');
  const [helpSelected,    setHelpSelected]    = useState(null);
  const [activeAdvSubTab, setActiveAdvSubTab] = useState('workflow');
  const pollRef = useRef(null);
  const { contributors } = useGHData();
  const totalStats = contributors.reduce(
    (a, c) => ({ approved: a.approved + c.approved }),
    { approved: 0 }
  );

  useEffect(() => {
    window.electronAPI.invoke('github-auth-status').then(res => {
      if (res?.connected) setAuthState({ status: 'connected', username: res.username, avatarUrl: res.avatarUrl || null });
    });
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleConnect = async () => {
    if (authState?.status === 'polling') return;
    if (pollRef.current) clearInterval(pollRef.current);
    const result = await window.electronAPI.invoke('github-auth-start');
    if (result?.error) { console.error('[contrib] auth-start failed:', result.error); return; }
    setAuthState({ status: 'polling', code: result.user_code });
    const startPolling = (intervalMs) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const res = await window.electronAPI.invoke('github-auth-poll');
        if (res?.confirmed) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setAuthState({ status: 'connected', username: res.username, avatarUrl: res.avatarUrl });
        } else if (res?.slowDown) {
          startPolling(res.interval * 1000);
        } else if (res?.error) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setAuthState(null);
          console.error('[contrib] auth-poll error:', res.error);
        }
      }, intervalMs);
    };
    startPolling(5000);
  };

  const handleDisconnect = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    window.electronAPI.invoke('github-auth-logout');
    setAuthState(null);
  };

  return (
    <div className="ct-root" style={{ "--shell-accent": "#34d399", "--shell-glow": "rgba(52,211,153,0.15)", "--shell-border": "rgba(52,211,153,0.2)", "--tab-color": "var(--contributions-color)", "--tab-glow": "var(--contributions-glow)", "--tab-glow-strong": "var(--contributions-glow-strong)" }}>

      {/* ── Help button — only visible on main view, not inside contributor profile ── */}
      {!selectedUser && (
        <button
          className="help-btn"
          onClick={() => setShowHelp(!showHelp)}
          title="Help Guide"
        >
          ?
        </button>
      )}

      {/* ── Help modal ── */}
      {showHelp && (
        <ContributionsHelpModal
          onClose={() => setShowHelp(false)}
          activeTab={activeHelpTab}
          setActiveTab={(t) => { setActiveHelpTab(t); setHelpSelected(null); }}
          helpSelected={helpSelected}
          setHelpSelected={setHelpSelected}
          activeAdvSubTab={activeAdvSubTab}
          setActiveAdvSubTab={setActiveAdvSubTab}
        />
      )}

      <div className="ct-topbar">
        <div className="ct-stats-row">
          <div className="ct-stat"><span className="ct-stat-val" style={{ color: '#34d399' }}>{contributors.length}</span><span className="ct-stat-label">contributors</span></div>
          <div className="ct-stat"><span className="ct-stat-val" style={{ color: '#4ade80' }}>{totalStats.approved}</span><span className="ct-stat-label">approved</span></div>
        </div>
      </div>

      {!selectedUser && (
        <div className="ct-nav">
          {[['upload', 'Upload Asset'], ['download', 'Download Assets'], ['leaderboard', 'Leaderboard']].map(([key, label]) => (
            <button key={key}
              className={`ct-nav-btn${section === key ? ' active' : ''}`}
              style={section === key ? { '--accent': '#34d399' } : {}}
              onClick={() => setSection(key)}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="ct-body">
        {selectedUser ? (
          <ContributorProfile user={selectedUser} onBack={() => setSelectedUser(null)} />
        ) : section === 'upload' ? (
          <UploadSection authState={authState} onConnectGitHub={handleConnect} onDisconnectGitHub={handleDisconnect} />
        ) : section === 'download' ? (
          <DownloadAssets onNavigateTab={onNavigateTab} />
        ) : (
          <Leaderboard onSelectUser={setSelectedUser} />
        )}
      </div>
    </div>
  );
}
