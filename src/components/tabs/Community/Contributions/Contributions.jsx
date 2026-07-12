/**
 * Contributions.jsx — Community asset submission, browsing & leaderboard.
 *
 * On TabLayout, one instance mixes layout types per section (docs/LAYOUTS.md
 * §"Core Principle" — the choice belongs to the section, not the tab):
 *   Upload      → Layout Z · exclusive. secondRail = asset type (Prop/Skybox/
 *                 Emitter/Texture). Group A = Single upload, Group B = Merged
 *                 Folder upload — both always visible, no mode switcher; the
 *                 active path is derived reactively from whichever side has
 *                 data (§"Z · exclusive — reactive dimming"). GitHub auth +
 *                 the asset-agnostic fields live in headerExtra/footerExtra,
 *                 since they belong to neither group alone.
 *   Download    → Layout W · canvas. Top bar = counts, toolbar = type filter
 *                 + search, content = the asset grid + detail modal.
 *   Leaderboard → Layout W · output. Content = ranked contributor list, or a
 *                 contributor's profile when one is selected.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import '../../../Shared/DesignSystem/index.css';
import TabLayout from '../../../Shared/Ui/TabLayout/TabLayout';
import './Contributions.css';
import ContributionsHelpModal from '../../HelpModals/Contributions_help.jsx';

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
const TYPE_META = {
  prop:    { label: 'Prop' },
  skybox:  { label: 'Skybox' },
  emitter: { label: 'Emitter' },
  texture: { label: 'Texture' },
};
const STATUS_CFG = {
  approved: { label: 'Approved' },
  removed:  { label: 'Removed'  },
  pending:  { label: 'Pending'  },
  rejected: { label: 'Rejected' },
};
const RANK_COLORS = ['#fbbf24', '#94a3b8', '#cd7c3f'];

function TypeBadge({ type }) {
  return <span className={`ct-status ct-type`}>{TYPE_META[type]?.label || type}</span>;
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
      <div className="ct-auth-polling-main">
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
          ? <img src={authState.avatarUrl} alt={authState.username} className="ct-auth-avatar-img" />
          : <span>{authState.username.slice(0, 2).toUpperCase()}</span>}
      </div>
      <div className="ct-auth-info">
        <div className="ct-auth-title ct-auth-title--ok">Connected</div>
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

// ── DropZone — single-file drop tile ──────────────────────────────────────────
function DropZone({ label, accept, file, onFile, hint, optional }) {
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
      <input ref={inputRef} type="file" accept={accept.join(',')} className="ct-visually-hidden" onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); }} />
      <div className="ct-dz-icon">{file ? (isValid ? '+' : '−') : ''}</div>
      <div className="ct-dz-label">{label}{optional && <span className="ct-optional-badge">optional</span>}</div>
      {file ? <div className="ct-dz-filename">{file.name}</div> : <div className="ct-dz-hint">{hint}</div>}
    </div>
  );
}

// ── Folder helpers ─────────────────────────────────────────────────────────────

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

// ── FolderDropZone — shared drag-a-whole-folder tile ──────────────────────────
// variant: 'neutral' | 'ok' | 'warn' | 'error' — colours the folder name +
// detail line once a folder has been dropped (a finite, data-driven enum —
// expressed as a class modifier, not inline hex, per TAB_DESIGN_LAW §5).
function FolderDropZone({ folderName, fileList, onFolder, detail, variant = 'neutral', title = 'Drop Folder Here', sub = 'or click to select a folder' }) {
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
      className={['ct-dropzone ct-folder-dz', dragging ? 'dragging' : '', folderName ? 'has-file' : '', folderName ? `ct-folder-dz--${variant}` : ''].filter(Boolean).join(' ')}
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" webkitdirectory="true" directory="true" className="ct-visually-hidden" onChange={handleInput} />
      {folderName ? (
        <>
          <div className="ct-dz-icon">+</div>
          <div className="ct-dz-label">{folderName}</div>
          {detail && <div className="ct-folder-detail">{detail}</div>}
          <div className="ct-folder-filelist">
            {fileList.slice(0, 8).map((f, i) => (
              <span key={i} className={`ct-folder-filepill${f.highlight ? ' hit' : ''}`}>{f.name}</span>
            ))}
            {fileList.length > 8 && <span className="ct-folder-filepill more">+{fileList.length - 8} more</span>}
          </div>
          <div className="ct-folder-changehint">Click to change</div>
        </>
      ) : (
        <>
          <div className="ct-dz-icon ct-dz-icon--lg" />
          <div className="ct-dz-label">{title}</div>
          <div className="ct-dz-hint">{sub}</div>
        </>
      )}
    </div>
  );
}

// ── Detected-items list — used by all four "merged folder" forms ────────────
function DetectedList({ items }) {
  return (
    <div className="ct-detected-list">
      {items.map((it, i) => (
        <div key={i} className="ct-detected-row">
          <span className="ct-detected-name">{it.name}</span>
          {it.meta && <span className="ct-detected-meta">{it.meta}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Prop upload form ──────────────────────────────────────────────────────────
function PropUploadForm({ name, setName }) {
  // Single side
  const [scmLod0, setScmLod0] = useState(null); const [scmLod1, setScmLod1] = useState(null);
  const [albedo, setAlbedo]   = useState(null); const [normal, setNormal]   = useState(null);
  const [bpFile, setBpFile]   = useState(null); const [preview, setPreview] = useState(null);
  const [showLod1, setShowLod1] = useState(false);
  const propName = name.trim().replace(/\s+/g, '_');

  // Folder side
  const [folderName,    setFolderName]    = useState('');
  const [folderFileList, setFolderFileList] = useState([]);
  const [folderProps,   setFolderProps]   = useState([]); // [{name, bpFile, scmFiles, texFiles}]
  const [folderStatus,  setFolderStatus]  = useState(null);

  const singleTouched = !!(propName || scmLod0 || albedo || normal || bpFile || preview);
  const folderTouched = !!folderName;
  const activeSide = folderTouched ? 'folder' : singleTouched ? 'single' : null;

  const singleReady = !!(propName && scmLod0 && albedo && normal && bpFile && preview);
  const folderReady = folderProps.length > 0 && folderStatus === 'ok';
  const ready = activeSide === 'folder' ? folderReady : activeSide === 'single' ? singleReady : false;

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
    setName(rootName || ''); // folder name is the group name
  }, [setName]);

  const getFiles = async () => {
    if (activeSide !== 'folder') {
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

  const singleNode = (
    <div className="ct-layout">
      <div className="ct-col">
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
      <div className="ct-col">
        <div className="ct-section">
          <label className="ct-section-label accent">MESH + TEXTURES</label>
          <div className="ct-dropzone-grid cols-3">
            <DropZone label="LOD0 Mesh" accept={['.scm']} file={scmLod0} onFile={setScmLod0} hint=".scm (required)" />
            <DropZone label="Albedo" accept={['.dds', '.png', '.tga']} file={albedo} onFile={setAlbedo} hint=".dds / .png" />
            <DropZone label="Normal Map" accept={['.dds', '.png', '.tga']} file={normal} onFile={setNormal} hint=".dds / .png" />
          </div>
          <div className="ct-dropzone-grid cols-1 ct-mt-sm">
            <DropZone label="Preview PNG" accept={['.png', '.jpg', '.jpeg']} file={preview} onFile={setPreview} hint="screenshot / render for the library (.png)" />
          </div>
          <div className="ct-note ct-mt-xs">Shown as a thumbnail in the Download section.</div>
          {scmLod0 && (showLod1
            ? <div className="ct-dropzone-grid cols-1 ct-mt-sm"><DropZone label="LOD1 Mesh" accept={['.scm']} file={scmLod1} onFile={setScmLod1} hint=".scm" optional /></div>
            : <button className="ct-btn-addlod" onClick={() => setShowLod1(true)}>+ Add LOD1 (optional)</button>
          )}
        </div>
      </div>
    </div>
  );

  const folderNode = (
    <div className="ct-col">
      <div className="ct-section">
        <label className="ct-section-label accent">FOLDER NAME (Group)</label>
        <input className="ct-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. DeadTrees" />
        {name.trim() && <div className="ct-path-preview">/env/props/{name.trim().replace(/\s+/g,'_')}/</div>}
      </div>
      <div className="ct-section">
        <label className="ct-section-label accent">MERGED PROP FOLDER</label>
        <div className="ct-note ct-mb-sm">Multiple props share albedo/normal textures in one folder. Each prop has its own <code>_prop.bp</code> and <code>.scm</code> but references shared <code>.dds</code> files.</div>
        <FolderDropZone
          folderName={folderName}
          fileList={folderFileList}
          onFolder={handleFolderDrop}
          variant={folderStatus === 'ok' ? 'ok' : folderStatus === 'warn' ? 'warn' : folderStatus === 'error' ? 'error' : 'neutral'}
          detail={folderStatus === 'ok' ? `${folderProps.length} prop${folderProps.length !== 1 ? 's' : ''} detected` : folderStatus === 'warn' ? 'Missing mesh or textures?' : folderStatus === 'error' ? 'No _prop.bp found' : null}
          title="Merged Prop Folder"
          sub="Drop folder with multiple props sharing textures"
        />
      </div>
      {folderProps.length > 0 && (
        <div className="ct-section">
          <label className="ct-section-label accent">DETECTED PROPS ({folderProps.length})</label>
          <DetectedList items={folderProps.map(p => ({ name: p.name, meta: `${p.scmFiles.length} mesh · ${p.texFiles.length} tex` }))} />
        </div>
      )}
    </div>
  );

  return { activeSide, ready, getFiles, singleNode, folderNode, extraHeaderNode: null };
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
  const [scmskybox, setScmskybox] = useState(null);
  const [albedo, setAlbedo]     = useState(null);
  const [glow, setGlow]         = useState(null);
  const [cirrus, setCirrus]     = useState(null);
  const [previews, setPreviews] = useState([null, null, null]);
  const skyboxName = name.trim().replace(/\s+/g, '_');

  const [folderName,    setFolderName]    = useState('');
  const [folderFileList, setFolderFileList] = useState([]);
  const [folderParsed,  setFolderParsed]  = useState(null); // result of parseSkyboxFolder
  const [folderStatus,  setFolderStatus]  = useState(null); // 'ok' | 'warn' | 'error'

  const setPreviewAt = (i, file) => setPreviews(p => { const n = [...p]; n[i] = file; return n; });

  const singleTouched = !!(skyboxName || scmskybox || albedo || glow || cirrus || previews.some(Boolean));
  const folderTouched = !!folderName;
  const activeSide = folderTouched ? 'folder' : singleTouched ? 'single' : null;

  const singleReady = !!(skyboxName && scmskybox && previews[0]);
  const folderReady = !!(folderParsed?.scmskybox && folderParsed?.previews[0]);
  const ready = activeSide === 'folder' ? folderReady : activeSide === 'single' ? singleReady : false;

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
    if (parsed.baseName) setName(parsed.baseName);
    else if (rootName)   setName(rootName);
  }, [setName]);

  const getFiles = async () => {
    if (activeSide !== 'folder') {
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

  const folderVariant = folderStatus === 'ok' ? 'ok' : folderStatus === 'warn' ? 'warn' : folderStatus === 'error' ? 'error' : 'neutral';
  const folderDetail  = folderStatus === 'ok'
    ? `${folderParsed?.scmskybox?.name} · ${folderParsed?.previews.filter(Boolean).length} preview(s)`
    : folderStatus === 'warn' ? 'Missing preview image'
    : folderStatus === 'error' ? 'No .scmskybox found'
    : null;

  const singleNode = (
    <div className="ct-layout">
      <div className="ct-col">
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
          <label className="ct-section-label accent">PREVIEWS <span className="ct-req-tag">min 1 required</span></label>
          <div className="ct-dropzone-grid cols-3">
            <DropZone label="Preview 1" accept={['.png','.jpg','.jpeg']} file={previews[0]} onFile={f => setPreviewAt(0, f)} hint="required" />
            <DropZone label="Preview 2" accept={['.png','.jpg','.jpeg']} file={previews[1]} onFile={f => setPreviewAt(1, f)} hint="recommended" optional />
            <DropZone label="Preview 3" accept={['.png','.jpg','.jpeg']} file={previews[2]} onFile={f => setPreviewAt(2, f)} hint="recommended" optional />
          </div>
        </div>
      </div>
      <div className="ct-col">
        <div className="ct-section">
          <label className="ct-section-label accent">CUSTOM TEXTURES <span className="ct-opt-tag">(all optional)</span></label>
          <div className="ct-dropzone-grid cols-3">
            <DropZone label="Albedo DDS" accept={['.dds']} file={albedo} onFile={setAlbedo} hint="custom albedo" optional />
            <DropZone label="Glow DDS"   accept={['.dds']} file={glow}   onFile={setGlow}   hint="custom glow"   optional />
            <DropZone label="Cirrus DDS" accept={['.dds']} file={cirrus} onFile={setCirrus} hint="custom cirrus" optional />
          </div>
          <div className="ct-note ct-mt-sm">Leave empty if using default game assets from <code>/env/...</code>.</div>
        </div>
      </div>
    </div>
  );

  const folderNode = (
    <div className="ct-col">
      <div className="ct-section">
        <label className="ct-section-label accent">SKYBOX FOLDER</label>
        <div className="ct-note ct-mb-sm">
          Expected: <code>name.scmskybox</code>, <code>name_albedo.dds</code>, <code>name_glow.dds</code>,
          <code>name_prev.png</code> / <code>name_prev1.png</code> … <code>name_prev3.png</code>
        </div>
        <FolderDropZone
          folderName={folderName}
          fileList={folderFileList}
          onFolder={handleFolderDrop}
          variant={folderVariant}
          detail={folderParsed ? folderDetail : null}
        />
      </div>
      {folderParsed?.scmskybox && (
        <div className="ct-section">
          <label className={`ct-section-label accent ct-status-label--${folderVariant}`}>DETECTED FILES</label>
          <DetectedList items={[
            ['scmskybox', folderParsed.scmskybox],
            ['albedo',    folderParsed.albedo],
            ['glow',      folderParsed.glow],
            ['cirrus',    folderParsed.cirrus],
            ...folderParsed.previews.map((p, i) => [`preview ${i + 1}`, p]),
          ].map(([label, file]) => ({ name: label, meta: file ? file.name : '— not found', dim: !file }))}
          />
        </div>
      )}
    </div>
  );

  return { activeSide, ready, getFiles, singleNode, folderNode, extraHeaderNode: null };
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
  const [bpFile,    setBpFile]    = useState(null);
  const [category,  setCategory]  = useState('');
  const [normalTex, setNormalTex] = useState(null);
  const [rampTex,   setRampTex]   = useState(null);
  const emitterName = name.trim().replace(/\s+/g, '_');

  const [folderName,     setFolderName]     = useState('');
  const [folderFileList, setFolderFileList] = useState([]);
  const [folderEmitters, setFolderEmitters] = useState([]);

  const singleTouched = !!(emitterName || bpFile || normalTex || rampTex);
  const folderTouched = !!folderName;
  const activeSide = folderTouched ? 'folder' : singleTouched ? 'single' : null;

  const singleReady = !!(emitterName && bpFile && category.trim());
  const folderReady = folderEmitters.length > 0 && !!category.trim();
  const ready = activeSide === 'folder' ? folderReady : activeSide === 'single' ? singleReady : false;

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
    if (rootName) setName(rootName);
  }, [setName]);

  const getFiles = async () => {
    const cat = category.trim().replace(/\s+/g, '_');
    if (activeSide !== 'folder') {
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

  const extraHeaderNode = (
    <div className="ct-section ct-section--inline">
      <label className="ct-section-label accent">CATEGORY <span className="ct-req-tag">required</span></label>
      <input className="ct-input ct-input--narrow" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Fire, Water, Explosion, Ambient…" />
      <div className="ct-note">Subfolder in <code>public/emitter/</code>. Determines group in the Emitter Library. Applies to both single and folder uploads.</div>
    </div>
  );

  const singleNode = (
    <div className="ct-layout">
      <div className="ct-col">
        <div className="ct-section">
          <label className="ct-section-label accent">EMITTER NAME</label>
          <input className="ct-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. FireColumn_Large" autoFocus />
          {emitterName && category.trim() && <div className="ct-path-preview">/env/emitter/{category.trim().replace(/\s+/g,'_')}/{emitterName}.bp</div>}
        </div>
      </div>
      <div className="ct-col">
        <div className="ct-section">
          <label className="ct-section-label accent">BLUEPRINT (.bp)</label>
          <div className="ct-dropzone-grid cols-1">
            <DropZone label="Emitter .bp" accept={['.bp']} file={bpFile} onFile={setBpFile} hint=".bp (required)" />
          </div>
        </div>
        <div className="ct-section">
          <label className="ct-section-label accent">TEXTURES <span className="ct-opt-tag">(both optional)</span></label>
          <div className="ct-dropzone-grid cols-2">
            <DropZone label="Normal Texture" accept={['.dds', '.png', '.tga']} file={normalTex} onFile={setNormalTex} hint="what gets emitted" optional />
            <DropZone label="Ramp Texture"   accept={['.dds', '.png', '.tga']} file={rampTex}   onFile={setRampTex}   hint="color ramp (.dds)" optional />
          </div>
          <div className="ct-note ct-mt-sm">
            <strong>Normal texture</strong> — defines the shape/surface of what is emitted.<br/>
            <strong>Ramp texture</strong> — horizontal gradient that controls particle color over lifetime.
          </div>
        </div>
      </div>
    </div>
  );

  const folderNode = (
    <div className="ct-col">
      <div className="ct-section">
        <label className="ct-section-label accent">EMITTER FOLDER</label>
        <div className="ct-note ct-mb-sm">Expected per emitter: <code>name.bp</code>, optional <code>name_normal.dds</code>, <code>name_ramp.dds</code></div>
        <FolderDropZone
          folderName={folderName}
          fileList={folderFileList}
          onFolder={handleFolderDrop}
          variant={folderEmitters.length > 0 ? 'ok' : folderName ? 'error' : 'neutral'}
          detail={folderEmitters.length > 0 ? `${folderEmitters.length} emitter(s) detected` : folderName ? 'No .bp files found' : null}
        />
      </div>
      {folderEmitters.length > 0 && (
        <div className="ct-section">
          <label className="ct-section-label accent">DETECTED EMITTERS ({folderEmitters.length})</label>
          <DetectedList items={folderEmitters.map(em => ({ name: em.name, meta: [em.normal && 'normal', em.ramp && 'ramp'].filter(Boolean).join(' · ') || 'bp only' }))} />
        </div>
      )}
    </div>
  );

  return { activeSide, ready, getFiles, singleNode, folderNode, extraHeaderNode };
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
  const [albedo,        setAlbedo]        = useState(null);
  const [normal,        setNormal]        = useState(null);
  const [preview,       setPreview]       = useState(null);
  const [previewNormal, setPreviewNormal] = useState(null);
  const texName = name.trim().replace(/\s+/g, '_');

  const [folderName,     setFolderName]     = useState('');
  const [folderFileList, setFolderFileList] = useState([]);
  const [folderSets,     setFolderSets]     = useState([]);

  const singleTouched = !!(texName || albedo || normal || preview || previewNormal);
  const folderTouched = !!folderName;
  const activeSide = folderTouched ? 'folder' : singleTouched ? 'single' : null;

  const singleReady = !!(texName && albedo && preview);
  const folderReady = folderSets.length > 0;
  const ready = activeSide === 'folder' ? folderReady : activeSide === 'single' ? singleReady : false;

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
    if (sets.length === 1) setName(sets[0].name);
    else if (rootName)     setName(rootName);
  }, [setName]);

  const getFiles = async () => {
    if (activeSide !== 'folder') {
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

  const singleNode = (
    <div className="ct-layout">
      <div className="ct-col">
        <div className="ct-section">
          <label className="ct-section-label accent">TEXTURE SET NAME</label>
          <input className="ct-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. RockyGround_01" autoFocus />
          {texName && <div className="ct-path-preview">/env/textures/{texName}/{texName}_albedo.dds</div>}
        </div>
        <div className="ct-note">Power-of-two, min 512×512, recommended 2048×2048.</div>
      </div>
      <div className="ct-col">
        <div className="ct-section">
          <label className="ct-section-label accent">DDS FILES</label>
          <div className="ct-dropzone-grid cols-2">
            <DropZone label="Albedo DDS"  accept={['.dds']} file={albedo} onFile={setAlbedo} hint={`${texName||'Name'}_albedo.dds`} />
            <DropZone label="Normals DDS" accept={['.dds']} file={normal} onFile={setNormal} hint={`${texName||'Name'}_normalsTS.dds`} optional />
          </div>
          {texName && <div className="ct-note ct-mt-sm">Albedo required. Normals recommended: <code>{texName}_normalsTS.dds</code></div>}
        </div>
        <div className="ct-section">
          <label className="ct-section-label accent">PREVIEW</label>
          <div className="ct-dropzone-grid cols-2">
            <DropZone label="Albedo Preview" accept={['.png', '.jpg', '.jpeg']} file={preview} onFile={setPreview} hint="albedo render / screenshot" />
            <DropZone label="Normal Preview" accept={['.png', '.jpg', '.jpeg']} file={previewNormal} onFile={setPreviewNormal} hint="normal map render" optional />
          </div>
          <div className="ct-note ct-mt-xs">Shown as thumbnails in the Download section.</div>
        </div>
      </div>
    </div>
  );

  const folderNode = (
    <div className="ct-col">
      <div className="ct-section">
        <label className="ct-section-label accent">TEXTURE FOLDER</label>
        <div className="ct-note ct-mb-sm">
          Pairs by basename: <code>name_albedo.dds</code> + <code>name_normalsTS.dds</code>
          + optional <code>name_preview.png</code>, <code>name_normal_preview.png</code>
        </div>
        <FolderDropZone
          folderName={folderName}
          fileList={folderFileList}
          onFolder={handleFolderDrop}
          variant={folderSets.length > 0 ? 'ok' : folderName ? 'error' : 'neutral'}
          detail={folderSets.length > 0 ? `${folderSets.length} texture set(s) detected` : folderName ? 'No _albedo.dds files found' : null}
        />
      </div>
      {folderSets.length > 0 && (
        <div className="ct-section">
          <label className="ct-section-label accent">DETECTED TEXTURE SETS ({folderSets.length})</label>
          <DetectedList items={folderSets.map(set => ({
            name: set.name,
            meta: ['albedo', set.normal && 'normal', set.prevAlbedo && 'preview', set.prevNormal && 'normal preview'].filter(Boolean).join(' · '),
          }))} />
        </div>
      )}
    </div>
  );

  return { activeSide, ready, getFiles, singleNode, folderNode, extraHeaderNode: null };
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
function Leaderboard({ onSelectUser }) {
  const { contributors, loaded } = useGHData();
  const sorted = [...contributors].sort((a, b) => b.approved - a.approved);

  if (!loaded) return (
    <div className="ct-empty-state">
      <div className="ct-empty-hint">Loading from GitHub…</div>
    </div>
  );

  if (sorted.length === 0) return (
    <div className="ct-empty-state">
      <div className="ct-empty-title">No contributors yet</div>
      <div className="ct-empty-hint ct-empty-hint--accent">Be the first to submit an asset</div>
    </div>
  );

  return (
    <div className="ct-lb">
      <div className="ct-lb-header-row">
        <span>#</span><span>CONTRIBUTOR</span>
        <span className="ct-align-right">APPROVED</span>
        <span className="ct-align-right">TIER</span>
      </div>
      <div className="ct-lb-divider" />
      {sorted.map((c, i) => {
        const types  = [...new Set(c.contributions.map(x => x.type))];
        const tier   = getTier(c);
        return (
          <div key={c.username} className={`ct-lb-row${i === 0 ? ' gold' : ''}`} onClick={() => onSelectUser(c)}>
            <div className="ct-lb-rank" style={{ color: i < 3 ? RANK_COLORS[i] : undefined }}>{i + 1}</div>
            <div className="ct-lb-user">
              <div className="ct-lb-avatar-wrap">
                <div className="ct-lb-avatar" style={{
                  background: i < 3 ? RANK_COLORS[i] : undefined,
                  color: i < 3 ? '#0a0a0a' : undefined,
                  border: tier ? `1.5px solid ${tier.color}` : undefined,
                  boxShadow: tier ? `0 0 8px ${tier.color}55` : undefined,
                }}>
                  {c.avatarUrl
                    ? <img src={c.avatarUrl} alt={c.username} className="ct-lb-avatar-img" />
                    : c.avatar}
                </div>
              </div>
              <div className="ct-lb-user-info">
                <div className="ct-lb-username" style={{ color: tier ? tier.color : undefined }}>{c.username}</div>
                <div className="ct-lb-types">
                  {types.map(t => <span key={t} className="ct-lb-typebadge">{TYPE_META[t]?.label || t}</span>)}
                </div>
              </div>
            </div>
            <div className="ct-lb-num">{c.approved}</div>
            <div className="ct-lb-tier-cell">
              {tier ? <TierBadge tier={tier} size="sm" /> : <span className="ct-lb-tier-none">—</span>}
            </div>
          </div>
        );
      })}
      <div className="ct-lb-footer">
        {sorted.length} contributors
        <button className="ct-lb-refresh" onClick={() => loadGitHubData(true)}>refresh</button>
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
    <div className="ct-profile">
      <button className="ct-back-btn" onClick={onBack}>back to leaderboard</button>

      <div className="ct-profile-header">
        <div className="ct-profile-avatar-wrap">
          <div className="ct-profile-avatar" style={{
            background: rank < 3 ? RANK_COLORS[rank] : undefined,
            color: rank < 3 ? '#0a0a0a' : undefined,
            border: tier ? `2px solid ${tier.color}` : undefined,
            boxShadow: tier ? `0 0 20px ${tier.color}44` : undefined,
          }}>
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt={user.username} className="ct-profile-avatar-img" />
              : user.avatar}
          </div>
          {tier && <div className="ct-profile-tier-badge-below" style={{ background: tier.color + '18', borderColor: tier.color, color: tier.color }}>{tier.label}</div>}
        </div>
        <div className="ct-profile-info">
          <div className="ct-profile-name" style={{ color: tier ? tier.color : undefined }}>{user.username}</div>
          <div className="ct-profile-meta">GitHub contributor · since {user.joinedAt} · Rank #{rank + 1}</div>
          <div className="ct-profile-typerow">
            {Object.entries(user.byType || {}).map(([t, n]) => (
              <span key={t} className="ct-lb-typebadge">{n}x {TYPE_META[t]?.label || t}</span>
            ))}
          </div>
        </div>
        <div className="ct-profile-stats">
          <div className="ct-profile-stat">
            <div className="ct-profile-stat-val">{user.approved}</div>
            <div className="ct-profile-stat-key">TOTAL</div>
          </div>
        </div>
      </div>

      {tier && (
        <div className="ct-tier-info-row">
          <span className="ct-tier-info-label">Current tier:</span>
          <TierBadge tier={tier} size="md" />
          {(() => {
            const nextIdx = TIERS.indexOf(tier) - 1;
            const next = nextIdx >= 0 ? TIERS[nextIdx] : null;
            if (!next) return <span className="ct-tier-info-note">Max tier reached</span>;
            const needed = next.minApproved - user.approved;
            return <span className="ct-tier-info-note">{needed} more approved to reach <span style={{ color: next.color }}>{next.label}</span></span>;
          })()}
        </div>
      )}

      <div className="ct-section-eyebrow-row">All Contributions</div>
      <div className="ct-contrib-list">
        {user.contributions.map(c => (
          <div key={c.id} className="ct-contrib-card">
            <div className="ct-contrib-card-top">
              <div className="ct-contrib-card-main">
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
      const RAW_BASE = 'https://raw.githubusercontent.com/ForgeMapToolKit/ForgeMapToolkit-Assets/main';
      const url = `${RAW_BASE}/${asset._folder}/${asset._assetName}/${asset._assetName}.scmskybox`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = await resp.json();
      window._pendingContribSkybox = raw?.Data ? raw : { Data: raw };
      if (autoSwitch !== false && onNavigateTab) {
        onNavigateTab('skybox-generator', asset);
        onClose();
        return;
      }
      setStatus('ready');
    } catch (err) {
      console.error('[contrib] skybox fetch failed:', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  if (status === 'ready') return (
    <div className="ct-skybox-loaded-note">Loaded — open the Skybox Generator tab to apply it.</div>
  );

  return (
    <button className="ct-dl-btn ct-dl-btn--skybox" onClick={handleLoad} disabled={status === 'loading'}>
      {status === 'loading' ? 'Fetching…'
       : status === 'error'  ? 'Failed — retry?'
       : 'Load into Skybox Generator'}
    </button>
  );
}

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
      >
        {st==='pending'?'…':st==='done'?'Downloaded':st==='error'?'Failed':label}
      </button>
    );
  }

  function SubItemList({ items, itemLabel }) {
    return (
      <div className="ct-subitem-list">
        <div className="ct-note ct-mb-xs">Folder with {items.length} {itemLabel}s — download individually or all at once:</div>
        {items.map(item => (
          <div key={item.name} className="ct-subitem-row">
            <span className="ct-subitem-name">{item.name}</span>
            {dlBtn('Download', asset._assetName, asset._folder, item.name)}
          </div>
        ))}
        <div className="ct-mt-xs">{dlBtn('Download All', asset._assetName, asset._folder)}</div>
      </div>
    );
  }

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

        <div className="ct-modal-preview">
          {allPreviews.length > 0
            ? <img src={allPreviews[previewIdx]} alt={asset.name} className="ct-modal-preview-img" />
            : <div className="ct-dl-card-preview-placeholder ct-modal-preview-placeholder"><span className="ct-placeholder-text">NO PREVIEW</span></div>
          }
          {allPreviews.length > 1 && (<>
            <button className="ct-modal-nav ct-modal-nav--prev" onClick={() => setPreviewIdx(i => (i - 1 + allPreviews.length) % allPreviews.length)}>‹</button>
            <button className="ct-modal-nav ct-modal-nav--next" onClick={() => setPreviewIdx(i => (i + 1) % allPreviews.length)}>›</button>
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
              <div className="ct-modal-subrow">
                <TypeBadge type={asset.type} />
                {asset.contributor && (
                  <span className="ct-modal-by">by <span style={{ color: tier ? tier.color : undefined }}>{asset.contributor}</span></span>
                )}
                <span className="ct-contrib-date">{asset.date}</span>
              </div>
            </div>
            <a href={asset.downloadUrl} target="_blank" rel="noreferrer" className="ct-modal-pr-link">PR #{asset.id}</a>
          </div>

          <div className="ct-modal-divider" />
          <div className="ct-modal-section-label">DOWNLOAD</div>

          {renderDownloadSection()}

          {asset.type === 'skybox' && (
            <SkyboxGeneratorButton asset={asset} onNavigateTab={onNavigateTab} onClose={onClose} autoSwitch={autoSwitch} />
          )}

          {asset._files && asset._files.length > 0 && (
            <>
              <div className="ct-modal-divider ct-mt-md" />
              <div className="ct-modal-section-label">FILES</div>
              <div className="ct-modal-filelist">
                {asset._files.map(f => <div key={f} className="ct-modal-file">{f}</div>)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Download Assets ───────────────────────────────────────────────────────────
function useDownloadAssets({ onNavigateTab }) {
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

  const activeAssets = assets.filter(a => a.status !== 'removed');
  const counts = activeAssets.reduce((acc, a) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {});

  const topBar = (
    <>
      <div className="ct-w-topbar-label">Community Assets</div>
      <span className="ct-w-topbar-pill">{activeAssets.length} approved</span>
    </>
  );

  const toolbar = (
    <>
      <div className="ct-dl-type-filters">
        {[['all','All'], ...ASSET_TYPES.map(t => [t, TYPE_META[t].label])].map(([val, label]) => (
          <button key={val}
            className={`ct-dl-filter-btn${typeFilter===val?' active':''}`}
            onClick={() => setTypeFilter(val)}
          >
            {label}
            <span className="ct-dl-count">{val==='all' ? activeAssets.length : (counts[val]||0)}</span>
          </button>
        ))}
      </div>
      <input className="ct-input ct-dl-search" placeholder="Search by name or contributor…"
        value={search} onChange={e => setSearch(e.target.value)} />
    </>
  );

  const content = (
    <div className="ct-dl-content">
      {!loaded ? (
        <div className="ct-empty-state"><div className="ct-empty-hint">Loading assets from GitHub…</div></div>
      ) : filtered.length === 0 ? (
        <div className="ct-empty-state">
          <div className="ct-empty-title">{assets.length === 0 ? 'No approved assets yet' : 'No assets match your filter'}</div>
          {assets.length === 0 && <div className="ct-empty-hint ct-empty-hint--accent">Approved contributions will appear here →</div>}
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
                    ? <img src={asset.preview} alt={asset.name} className="ct-dl-card-preview-img" onError={e => { e.target.style.display='none'; }} />
                    : <div className="ct-dl-card-preview-placeholder"><span className="ct-placeholder-text">NO PREVIEW</span></div>
                  }
                  <TypeBadge type={asset.type} />
                  {asset.type === 'skybox' && <div className="ct-dl-skybox-hint">Gen</div>}
                </div>
                <div className="ct-dl-card-body">
                  <div className="ct-dl-card-name">{asset.name}</div>
                  {asset.contributor && (
                    <div className="ct-dl-card-contributor">by <span style={{ color: tier ? tier.color : undefined }}>{asset.contributor}</span></div>
                  )}
                  <div className="ct-dl-card-meta">
                    <span className="ct-contrib-date">{asset.date}</span>
                    {asset.subProps?.length    > 1 && <span className="ct-dl-card-subcount">{asset.subProps.length} props</span>}
                    {asset.subEmitters?.length > 1 && <span className="ct-dl-card-subcount">{asset.subEmitters.length} emitters</span>}
                    {asset.subSkyboxes?.length > 1 && <span className="ct-dl-card-subcount">{asset.subSkyboxes.length} skyboxes</span>}
                    {asset.subTextures?.length > 1 && <span className="ct-dl-card-subcount">{asset.subTextures.length} textures</span>}
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

  return { topBar, toolbar, content };
}

// ── Upload section — assembled from the four asset-type forms ────────────────
function useUploadSection({ authState, onConnectGitHub, onDisconnectGitHub }) {
  const [assetType,   setAssetType]   = useState('prop');
  const [displayName, setDisplayName] = useState('');
  const [name,        setName]        = useState('');
  const [notes,       setNotes]       = useState('');
  const [submitted,   setSubmitted]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [prResult,    setPrResult]    = useState(null);

  const isConnected       = authState?.status === 'connected';
  const effectiveUsername = isConnected ? authState.username : displayName.trim();

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

  const secondRail = ASSET_TYPES.map(t => ({ id: t, label: TYPE_META[t].label }));

  const successNode = (
    <div className="ct-success">
      <div className="ct-success-title">Pull Request submitted</div>
      <div className="ct-success-body">
        <strong className="ct-success-name">{name}</strong> has been submitted for review.
        {prResult?.prUrl && <><br /><a className="ct-success-link" href={prResult.prUrl} target="_blank" rel="noreferrer">View PR #{prResult.prNumber} on GitHub</a></>}
      </div>
      {!isConnected && (
        <div className="ct-success-gh-hint">
          <span className="ct-success-gh-text">Want leaderboard &amp; achievements?</span>
          <button className="ct-success-connect-btn" onClick={onConnectGitHub}>Connect GitHub</button>
        </div>
      )}
      <button className="ct-success-again" onClick={reset}>Submit another</button>
    </div>
  );

  const headerExtra = (
    <>
      <GitHubAuthPanel authState={authState} onConnect={onConnectGitHub} onDisconnect={onDisconnectGitHub} />
      {!isConnected && (
        <div className="ct-section ct-section--inline">
          <label className="ct-section-label">DISPLAY NAME <span className="ct-opt-tag">(alias, no account needed)</span></label>
          <input className="ct-input ct-input--narrow" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="your name or alias" />
        </div>
      )}
      {current.extraHeaderNode}
    </>
  );

  const footerExtra = (
    <>
      <div className="ct-divider" />
      <div className="ct-section">
        <label className="ct-section-label">NOTES FOR REVIEWER <span className="ct-opt-tag">(optional)</span></label>
        <textarea className="ct-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="License info, source attribution, known issues, resolution details…" />
      </div>
      <div className="ct-submit-row">
        <span className="ct-submit-status">
          {!isConnected
            ? <span className="ct-submit-status--warn">Connect your GitHub account above to submit.</span>
            : !current.ready ? 'Fill in the Single or Merged Folder fields above.'
            : `Ready — PR submitted as "${effectiveUsername}" (GitHub verified)`}
        </span>
        <button className={`ct-btn-submit${canSubmit ? ' ready' : ''}`} onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? 'Creating PR…' : `Submit ${TYPE_META[assetType].label}`}
        </button>
      </div>
    </>
  );

  return {
    submitted,
    assetType,
    switchType,
    secondRail,
    singleNode: current.singleNode,
    folderNode: current.folderNode,
    activeSide: current.activeSide,
    headerExtra,
    footerExtra,
    successNode,
  };
}

// ── Widget (home-screen preview card, outside the tab's own theming scope) ───
export function ContributionsWidget({ onOpenTab }) {
  const { contributors } = useGHData();
  const approved = contributors.reduce((s, c) => s + c.approved, 0);
  const top3     = [...contributors].sort((a, b) => b.approved - a.approved).slice(0, 3);

  return (
    <div className="ct-widget" onClick={onOpenTab}>
      <div className="ct-widget-head">
        <span className="ct-widget-label">Community Assets</span>
        <span className="ct-widget-open">open</span>
      </div>
      <div className="ct-widget-stats">
        <div className="ct-widget-stat">
          <span className="ct-widget-stat-val">{approved}</span>
          <span className="ct-widget-stat-label">APPROVED</span>
        </div>
        <div className="ct-widget-stat">
          <span className="ct-widget-stat-val ct-widget-stat-val--soft">{contributors.length}</span>
          <span className="ct-widget-stat-label">CONTRIBUTORS</span>
        </div>
      </div>
      {top3.length > 0 ? (
        <div className="ct-widget-top">
          <span className="ct-widget-top-label">TOP:</span>
          {top3.map(c => (
            <div key={c.username} className="ct-widget-top-item">
              <div className="ct-widget-top-avatar">{c.avatar}</div>
              <span className="ct-widget-top-name">{c.username}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="ct-widget-empty">No contributions yet — be the first!</div>
      )}
    </div>
  );
}

// ── Main tab ───────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'upload',      index: '01', label: 'Upload',      desc: 'Submit a prop, skybox, emitter or texture for review.' },
  { id: 'download',    index: '02', label: 'Download',    desc: 'Browse and download every approved community asset.' },
  { id: 'leaderboard', index: '03', label: 'Leaderboard', desc: 'Top contributors, ranked by approved submissions.' },
];

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
  const totalApproved = contributors.reduce((s, c) => s + c.approved, 0);

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

  const upload = useUploadSection({ authState, onConnectGitHub: handleConnect, onDisconnectGitHub: handleDisconnect });
  const download = useDownloadAssets({ onNavigateTab });

  const layoutMode = section === 'upload' ? (upload.submitted ? 'y' : 'z') : 'w';

  return (
    <div className="ct-tab trace-tab">

      {!selectedUser && (
        <button className="help-btn" onClick={() => setShowHelp(h => !h)} title="Help Guide">?</button>
      )}

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

      <TabLayout
        sections={SECTIONS}
        activeSection={section}
        onSelect={(id) => { setSection(id); setSelectedUser(null); }}
        layoutMode={layoutMode}
        renderEyebrow={(s) => `COMMUNITY — ${s.index} — ${s.label.toUpperCase()} CONSOLE`}
        navLabel="Community console navigation"
        toolbarSlot={
          <div className="ct-stats-row">
            <div className="ct-stat"><span className="ct-stat-val">{contributors.length}</span><span className="ct-stat-label">contributors</span></div>
            <div className="ct-stat"><span className="ct-stat-val">{totalApproved}</span><span className="ct-stat-label">approved</span></div>
          </div>
        }

        /* Layout Z — Upload */
        groupMode="exclusive"
        secondRail={section === 'upload' && !upload.submitted ? upload.secondRail : undefined}
        activeGroup={section === 'upload' && !upload.submitted ? upload.assetType : undefined}
        onGroupSelect={section === 'upload' && !upload.submitted ? upload.switchType : undefined}
        headerExtra={section === 'upload' && !upload.submitted ? upload.headerExtra : undefined}
        footerExtra={section === 'upload' && !upload.submitted ? upload.footerExtra : undefined}
        groupSlotB={section === 'upload' && !upload.submitted ? (
          <div className={`ct-side${upload.activeSide === 'single' ? ' ct-side--dim' : ''}`}>{upload.folderNode}</div>
        ) : undefined}

        /* Layout Y — Upload, submitted state */
        ghostLabel={section === 'upload' && upload.submitted ? 'SUBMITTED' : ''}
        readout={section === 'upload' && upload.submitted ? [TYPE_META[upload.assetType].label, 'PR OPEN'] : []}

        /* Layout W — Download / Leaderboard */
        canvasToolbar={section === 'download'}
        topBar={section === 'download' ? download.topBar : undefined}
        toolbar={section === 'download' ? download.toolbar : undefined}
      >
        {section === 'upload'
          ? (upload.submitted
              ? upload.successNode
              : <div className={`ct-side${upload.activeSide === 'folder' ? ' ct-side--dim' : ''}`}>{upload.singleNode}</div>)
          : section === 'download'
          ? download.content
          : selectedUser
          ? <ContributorProfile user={selectedUser} onBack={() => setSelectedUser(null)} />
          : <Leaderboard onSelectUser={setSelectedUser} />}
      </TabLayout>
    </div>
  );
}
