import React, { useState, useEffect, useRef, useCallback } from 'react';
import './AddCustomProp.css';
import { luxuryAlert } from '../../../Shared/Ui/Notifications/notifications';
import { DropSlot, ToggleSwitch } from '../../../Shared/Ui/EntityPanel/EntityPanel';

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_TREE = {
  reclaimMass: 6, reclaimEnergy: 15, reclaimTime: 5,
  health: 50, blockPath: false, uniformScale: 0.155,
  lodCutoff: 900, sizeX: 10.1, sizeY: 11.2, sizeZ: 10.1, helpText: '',
};
const DEFAULT_ROCK = {
  reclaimMass: 10, reclaimEnergy: 0, reclaimTime: 5,
  health: 50, blockPath: true, uniformScale: 0.05,
  lodCutoff: 100, occupancyCaps: 3,
  sizeX: 0.5, sizeY: 0.25, sizeZ: 1, helpText: '',
};

// ── Parse a PropBlueprint Lua-like text ───────────────────────────────────────
function parseBpText(text) {
  const num  = (key) => { const m = text.match(new RegExp(`${key}\\s*=\\s*([\\d.eE+\\-]+)`)); return m ? parseFloat(m[1]) : undefined; };
  const bool = (key) => { const m = text.match(new RegExp(`${key}\\s*=\\s*(true|false)`));    return m ? m[1]==='true' : undefined; };
  const str  = (key) => { const m = text.match(new RegExp(`${key}\\s*=\\s*'([^']*)'`));       return m ? m[1] : undefined; };
  return {
    reclaimMass:    num('ReclaimMassMax'),
    reclaimEnergy:  num('ReclaimEnergyMax'),
    reclaimTime:    num('ReclaimTime'),
    health:         num('MaxHealth') ?? num('Health'),
    uniformScale:   num('UniformScale'),
    lodCutoff:      num('LODCutoff'),
    blockPath:      bool('BlockPath'),
    sizeX:          num('SizeX'),
    sizeY:          num('SizeY'),
    sizeZ:          num('SizeZ'),
    helpText:       str('HelpText'),
    occupancyCaps:  num('OccupancyCaps'),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const readBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result.split(',')[1]);
  r.onerror = rej;
  r.readAsDataURL(file);
});

const readText = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = rej;
  r.readAsText(file);
});

// ── DropZone (single file) — wraps the EntityConsole DropSlot ───────────────
function DropZone({ label, accept, file, onFile, hint, optional, compact }) {
  return (
    <DropSlot
      label={optional ? `${label} (optional)` : label}
      hint={hint || 'Drop or click'}
      accept={(f) => accept.some(a => f.name.toLowerCase().endsWith(a.toLowerCase()))}
      acceptInput={accept.join(',')}
      value={file}
      onChange={onFile}
      className={[compact ? 'acpo-drop-compact' : '', optional ? 'acpo-drop-optional' : ''].filter(Boolean).join(' ')}
    />
  );
}

// ── FolderDropZone ────────────────────────────────────────────────────────────

// Recursively read all files from a DirectoryEntry using the FileSystem Entry API
async function readDirectoryEntryRecursive(dirEntry) {
  return new Promise((resolve) => {
    const allFiles = [];

    const readEntries = (entry, path) => new Promise((res) => {
      if (entry.isFile) {
        entry.file((file) => {
          // Attach a synthetic webkitRelativePath so downstream code works the same as input[webkitdirectory]
          Object.defineProperty(file, 'webkitRelativePath', {
            value: path + file.name,
            writable: false,
          });
          allFiles.push(file);
          res();
        }, () => res());
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readBatch = () => {
          reader.readEntries(async (entries) => {
            if (entries.length === 0) { res(); return; }
            await Promise.all(entries.map(e => readEntries(e, path + entry.name + '/')));
            readBatch(); // readEntries only returns up to 100 at a time
          }, () => res());
        };
        readBatch();
      } else {
        res();
      }
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

function FolderDropZone({ folderName, fileList, onFolder, status, propCount }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragging(false);
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const entry = items[0].webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        // Use FileSystem Entry API to recursively read ALL files in the folder
        console.log('[ACPO:drop] Reading directory via Entry API:', entry.name);
        const files = await readDirectoryEntryRecursive(entry);
        console.log('[ACPO:drop] Entry API read', files.length, 'files:', files.map(f => f.webkitRelativePath));
        onFolder(entry, files);
        return;
      }
    }
    if (e.dataTransfer.files.length > 0) onFolder(null, e.dataTransfer.files);
  }, [onFolder]);

  const handleInput = useCallback((e) => {
    if (e.target.files.length > 0) onFolder(null, e.target.files);
  }, [onFolder]);

  const statusColor = status === 'ok'    ? 'rgba(80,220,130,0.9)'
    : status === 'warn'  ? 'rgba(255,190,50,0.9)'
    : status === 'error' ? 'rgba(255,80,80,0.85)'
    : 'rgba(255,255,255,0.35)';

  const isDone = !!folderName;

  // Folder drops need the raw DataTransfer (FileSystem Entry API) for recursive
  // directory reading, which the generic DropSlot doesn't expose — so this stays
  // a dedicated component, just rebuilt on the same ec-drop-slot frame/markup.
  return (
    <div
      className={`ec-drop-slot acpo-folder-slot${dragging ? ' dragging' : ''}${isDone ? ' done' : ''}${status === 'error' ? ' status-error' : ''}${status === 'warn' ? ' status-warn' : ''}`}
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Prop folder"
    >
      <input ref={inputRef} type="file" webkitdirectory="true" directory="true"
        style={{ display: 'none' }} onChange={handleInput} />

      <span className="ec-drop-slot-label">Prop Folder</span>

      <span className="ec-drop-slot-corner ec-drop-slot-corner--tl" aria-hidden="true" />
      <span className="ec-drop-slot-corner ec-drop-slot-corner--tr" aria-hidden="true" />
      <span className="ec-drop-slot-corner ec-drop-slot-corner--br" aria-hidden="true" />
      <span className="ec-drop-slot-corner ec-drop-slot-corner--bl" aria-hidden="true" />

      <span className="ec-drop-slot-line ec-drop-slot-line--top"    aria-hidden="true" />
      <span className="ec-drop-slot-line ec-drop-slot-line--bottom" aria-hidden="true" />
      <span className="ec-drop-slot-line ec-drop-slot-line--right"  aria-hidden="true" />
      <span className="ec-drop-slot-line ec-drop-slot-line--left"   aria-hidden="true" />

      <div className="ec-drop-slot-inner acpo-folder-slot-inner">
        {folderName ? (
          <>
            <div className="acpo-folder-name">{folderName}</div>
            {fileList.length > 0 && (
              <div className="acpo-folder-filelist">
                {fileList.slice(0, 10).map((f, i) => (
                  <span key={i} className={`acpo-folder-file-chip${f.highlight ? ' highlight' : ''}`}>
                    {f.name}
                  </span>
                ))}
                {fileList.length > 10 && (
                  <span className="acpo-folder-file-chip">+{fileList.length - 10} more</span>
                )}
              </div>
            )}
            {status && (
              <div className="acpo-folder-status" style={{ color: statusColor }}>
                {status === 'ok'    && `${propCount > 1 ? propCount + ' Props' : 'Prop folder'} detected — ready to save`}
                {status === 'warn'  && `${propCount || 1} .bp found — mesh or texture may be missing`}
                {status === 'error' && 'No _prop.bp file found in folder'}
              </div>
            )}
            <span className="ec-drop-slot-hint">click or drop again to change</span>
          </>
        ) : (
          <>
            <span className="ec-drop-slot-idle" aria-hidden="true" />
            <span className="ec-drop-slot-text">Drop prop folder here</span>
            <span className="ec-drop-slot-hint">_prop.bp, .scm and .dds files · or click to browse</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── NumField ──────────────────────────────────────────────────────────────────
function NumField({ label, value, onChange, min, step = 0.01 }) {
  return (
    <div className="acpo-field">
      <label className="field-label">{label}</label>
      <input type="number" className="field-input"
        value={value} min={min} step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)} />
    </div>
  );
}

// ── BpVal — display a parsed bp value ────────────────────────────────────────
function BpVal({ label, value, wide }) {
  return (
    <div className={`acpo-bp-val${wide ? ' wide' : ''}`}>
      <span className="acpo-bp-val-label">{label}</span>
      <span className="acpo-bp-val-value">{String(value ?? '—')}</span>
    </div>
  );
}

// ── groupPropFiles ───────────────────────────────────────────────────────────
// Given a list of _prop.bp files and all .scm / texture files in the same folder,
// pairs each prop with its files using progressive-fallback name matching.
//
// Strategy:
//   1. Use SCM file names as the "ground truth" for what files belong to a prop.
//      e.g. "DeadTree_s1_lod0.scm" → prop prefix = "deadtree_s1"
//   2. For textures/albedo: try exact prefix first, then progressively shorter
//      prefixes (stripping trailing _s1, _s2, _01 etc.) until a match is found.
//   3. This means DeadTree_s1 and DeadTree_s2 can share DeadTree_albedo.dds.
//
async function groupPropFiles(bpFiles, scmFiles, texFiles) {
  console.log('[ACPO:group] bpFiles:', bpFiles.map(f=>f.name));
  console.log('[ACPO:group] scmFiles:', scmFiles.map(f=>f.name));
  console.log('[ACPO:group] texFiles:', texFiles.map(f=>f.name));
  // Helper: strip a file extension
  const noExt = (name) => name.replace(/\.[^.]+$/, '');
  // Helper: get the base name without extension, lowercased
  const baseLower = (name) => noExt(name).toLowerCase();

  // Build a map: scm-base-name → File (for quick lookup)
  const scmMap = {};
  scmFiles.forEach(f => { scmMap[baseLower(f.name)] = f; });

  // Build a map: tex-base-name → File
  const texMap = {};
  texFiles.forEach(f => { texMap[baseLower(f.name)] = f; });

  // Find files for a prop using progressive prefix fallback.
  // e.g. prefix = "deadtree_s1" tries: "deadtree_s1_lod0", "deadtree_s1", then "deadtree"
  const findByPrefix = (map, prefix) => {
    const p = prefix.toLowerCase();
    // Exact prefix match (key starts with prefix)
    const exact = Object.keys(map).filter(k => k.startsWith(p));
    if (exact.length) return exact.map(k => map[k]);
    // Fallback: strip trailing variant suffix (_s1, _s2, _01, _02, _a, _b etc.)
    // and try again — progressively remove the last underscore segment
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

    console.log(`[ACPO:group] prop="${propName}" prefix="${propPrefix}" → scm:[${relatedScm.map(f=>f.name)}] tex:[${relatedTex.map(f=>f.name)}]`);

    let bpData = null;
    let propType = 'rock';
    try {
      const bpText = await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(bpFile);
      });
      bpData   = { ...parseBpText(bpText), _raw: bpText };
      propType = bpText.includes('proptree.lua') ? 'tree' : 'rock';
    } catch { /* skip */ }

    props.push({ name: propName, bp: bpData, propType, bpFile, scmFiles: relatedScm, texFiles: relatedTex });
  }
  return props;
}

// ── Main overlay ──────────────────────────────────────────────────────────────
export default function AddCustomPropOverlay({ onConfirm, onSaved, onClose, inline = false }) {
  // 'manual' | 'folder'
  const [inputMode, setInputMode] = useState('manual');

  // Manual mode
  const [propType, setPropType]   = useState('tree');

  // Apply defaultPropType from settings on mount
  useEffect(() => {
    window.electronAPI.invoke('settings-load').then(s => {
      if (s?.defaultPropType) setPropType(s.defaultPropType);
    }).catch(() => {});
  }, []);
  const [bpMode, setBpMode]       = useState(null);
  const [name, setName]           = useState('');
  const [scmLod0, setScmLod0]     = useState(null);
  const [scmLod1, setScmLod1]     = useState(null);
  const [scmLod2, setScmLod2]     = useState(null);
  const [showExtraLods, setShowExtraLods] = useState(false);
  const [albedoFile, setAlbedoFile] = useState(null);
  const [normalFile, setNormalFile] = useState(null);
  const [bpFile, setBpFile]         = useState(null);
  const [bp, setBp] = useState({ ...DEFAULT_TREE });

  // Folder mode
  const [folderName, setFolderName]     = useState('');
  const [folderFiles, setFolderFiles]   = useState([]);
  const [folderStatus, setFolderStatus] = useState(null);
  const [folderBp, setFolderBp]         = useState(null);
  const [folderRawFiles, setFolderRawFiles] = useState({});
  // Multi-prop: when folder has multiple _prop.bp files at root level
  const [folderProps, setFolderProps]       = useState([]);  // [{name, bp, bpFile, scmFiles, texFiles}]
  const [selectedPropIdx, setSelectedPropIdx] = useState(0);
  // Editable bp overrides per prop (keyed by prop name)
  const [propBpEdits, setPropBpEdits] = useState({});  // { [propName]: { reclaimMass, ... } }
  // Pack Together: save all props in one shared folder (true) or each in its own folder (false)
  const [packTogether, setPackTogether] = useState(true);

  const [saving, setSaving] = useState(false);

  const setBpField = (k, v) => setBp(prev => ({ ...prev, [k]: v }));
  const switchType = (t) => { setPropType(t); setBp(t === 'tree' ? { ...DEFAULT_TREE } : { ...DEFAULT_ROCK }); };

  // ── Per-prop bp edit helpers (folder mode) ────────────────────────────────
  // Get the effective bp values for a prop: edits override the parsed bp
  const getPropBp = (prop) => ({ ...(prop.bp || {}), ...(propBpEdits[prop.name] || {}) });
  const setPropBpField = (propName, k, v) =>
    setPropBpEdits(prev => ({ ...prev, [propName]: { ...(prev[propName] || {}), [k]: v } }));
  // Reset edits for current prop to its parsed values
  const resetPropBpEdits = (propName) =>
    setPropBpEdits(prev => { const n = { ...prev }; delete n[propName]; return n; });

  // ── Folder drop handler ──────────────────────────────────────────────────
  // Three cases:
  //   A) Single-prop folder: one _prop.bp at root level → single prop
  //   B) Flat multi-prop folder: multiple _prop.bp at root → tabs per prop
  //   C) Type-category folder (Trees/): subfolders each with own prop files
  const handleFolderDrop = useCallback(async (entry, files) => {
    const allFiles = Array.from(files);
    console.log('[ACPO] handleFolderDrop fired — total files:', allFiles.length);
    console.log('[ACPO] file names:', allFiles.map(f => f.webkitRelativePath || f.name));
    if (allFiles.length === 0) return;

    // Determine root folder name
    let rootFolderName = '';
    if (entry?.name) {
      rootFolderName = entry.name;
    } else if (allFiles[0]?.webkitRelativePath) {
      rootFolderName = allFiles[0].webkitRelativePath.split('/')[0];
    }
    console.log('[ACPO] rootFolderName:', rootFolderName);

    // Auto-detect propType from folder name
    const rootLower = rootFolderName.toLowerCase();
    if (rootLower.includes('tree') || rootLower.includes('forest') || rootLower.includes('plant')) setPropType('tree');
    else if (rootLower.includes('rock') || rootLower.includes('boulder') || rootLower.includes('stone')) setPropType('rock');

    // Strip root prefix from all paths
    const fileMap = {};
    allFiles.forEach(f => {
      const rel = f.webkitRelativePath || f.name;
      const withoutRoot = rel.includes('/') ? rel.substring(rel.indexOf('/') + 1) : rel;
      if (withoutRoot) fileMap[withoutRoot] = f;
    });

    const allBpFiles  = allFiles.filter(f => f.name.toLowerCase().endsWith('_prop.bp'));
    const allScmFiles = allFiles.filter(f => f.name.toLowerCase().endsWith('.scm'));
    const allTexFiles = allFiles.filter(f => /\.(dds|tga|png)$/i.test(f.name));

    console.log('[ACPO] allBpFiles (' + allBpFiles.length + '):', allBpFiles.map(f => f.name));
    console.log('[ACPO] allScmFiles (' + allScmFiles.length + '):', allScmFiles.map(f => f.name));
    console.log('[ACPO] allTexFiles (' + allTexFiles.length + '):', allTexFiles.map(f => f.name));

    if (allBpFiles.length === 0) {
      console.warn('[ACPO] No _prop.bp files found → error state');
      setFolderName(rootFolderName || 'Unknown');
      setFolderFiles(allFiles.slice(0, 15).map(f => ({
        name: f.webkitRelativePath || f.name, file: f, highlight: false,
      })));
      setFolderRawFiles({});
      setFolderProps([]);
      setFolderStatus('error');
      setFolderBp(null);
      return;
    }

    // ── Detect case: are the bp files at root level (depth 1 or 2) or in subfolders (depth 3+)?
    // Note: input[webkitdirectory] always produces paths like "RootFolder/file.ext" = depth 2,
    // so flatBpFiles will always contain all bp files when dropped via the file input.
    const bpDepth = (f) => (f.webkitRelativePath || f.name).split('/').length;
    const flatBpFiles   = allBpFiles.filter(f => bpDepth(f) <= 2); // root-level .bp files
    const deepBpFiles   = allBpFiles.filter(f => bpDepth(f) >= 3); // subfolders

    console.log('[ACPO] flatBpFiles:', flatBpFiles.map(f => f.name), '| deepBpFiles:', deepBpFiles.map(f => f.name));

    // ── CASE B: flat multi-prop folder (multiple .bp at root, same folder) ──
    // Use groupPropFiles for ALL cases where we have multiple bp files (flat or deep)
    if (allBpFiles.length > 1) {
      console.log('[ACPO] CASE B — multi-prop folder, grouping', allBpFiles.length, 'props');
      const bpFilesToGroup = flatBpFiles.length > 1 ? flatBpFiles : allBpFiles;
      console.log('[ACPO] bpFilesToGroup:', bpFilesToGroup.map(f => f.name));
      const parsedProps = await groupPropFiles(bpFilesToGroup, allScmFiles, allTexFiles);
      console.log('[ACPO] parsedProps:', parsedProps.map(p => ({ name: p.name, type: p.propType, scm: p.scmFiles.map(f=>f.name), tex: p.texFiles.map(f=>f.name) })));
      setFolderProps(parsedProps);
      setSelectedPropIdx(0);
      setPropBpEdits({});
      setFolderName(rootFolderName);
      setFolderRawFiles(fileMap);
      setFolderBp(parsedProps[0]?.bp || null);
      if (parsedProps[0]?.propType) setPropType(parsedProps[0].propType);

      const IMPORTANT_EXTS = new Set(['bp', 'scm', 'dds', 'tga', 'png']);
      const displayList = allFiles
        .map(f => ({
          name: (f.webkitRelativePath || f.name).includes('/')
            ? (f.webkitRelativePath || f.name).substring((f.webkitRelativePath || f.name).indexOf('/') + 1)
            : f.name,
          file: f,
          highlight: IMPORTANT_EXTS.has(f.name.split('.').pop().toLowerCase()),
        }))
        .sort((a, b) => (b.highlight ? 1 : 0) - (a.highlight ? 1 : 0));
      setFolderFiles(displayList);
      setFolderStatus(parsedProps.length > 0 ? 'ok' : 'warn');
      return;
    }

    // ── CASE A or C: single bp at root, or subfolders ──
    console.log('[ACPO] CASE A/C — single prop');
    // Use first found bp (could be in a subfolder)
    const firstBp = flatBpFiles[0] || deepBpFiles[0];
    const IMPORTANT_EXTS = new Set(['bp', 'scm', 'dds', 'tga', 'png']);
    const displayList = allFiles
      .map(f => ({
        name: (f.webkitRelativePath || f.name).includes('/')
          ? (f.webkitRelativePath || f.name).substring((f.webkitRelativePath || f.name).indexOf('/') + 1)
          : f.name,
        file: f,
        highlight: IMPORTANT_EXTS.has(f.name.split('.').pop().toLowerCase()),
      }))
      .sort((a, b) => (b.highlight ? 1 : 0) - (a.highlight ? 1 : 0));

    setFolderName(rootFolderName);
    setFolderFiles(displayList);
    setFolderRawFiles(fileMap);
    setFolderProps([]);

    try {
      const bpText = await readText(firstBp);
      const parsed = parseBpText(bpText);
      console.log('[ACPO] single prop parsed bp:', parsed);
      setFolderBp({ ...parsed, _raw: bpText, _bpCount: allBpFiles.length });
      if (bpText.includes('proptree.lua')) setPropType('tree');
      else setPropType('rock');
    } catch (err) {
      console.error('[ACPO] failed to read bp:', err);
      setFolderBp(null);
    }

    setFolderStatus(allScmFiles.length > 0 && allTexFiles.length > 0 ? 'ok' : 'warn');
  }, []);



  // ── Manual bp builder ────────────────────────────────────────────────────
  const buildLods = (propName, isTree) => {
    const shader = isTree ? 'NormalMappedAlpha' : 'TMeshNoNormals';
    const lodFiles = [scmLod0, scmLod1, scmLod2].filter(Boolean);
    const cutoffs = [bp.lodCutoff, Math.round(bp.lodCutoff * 0.55), Math.round(bp.lodCutoff * 0.25)];
    return lodFiles.map((_, i) => {
      const normalLine = isTree ? `\n                    NormalsName = '${propName}_normalsTS.dds',` : '';
      return `                {\n                    AlbedoName = '${propName}_albedo.dds',\n                    LODCutoff = ${cutoffs[i]},${normalLine}\n                    MeshName = '${propName}_lod${i}.scm',\n                    ShaderName = '${shader}',\n                },`;
    }).join('\n');
  };

  const buildBpContent = (propName) => {
    const isTree = propType === 'tree';
    const lodsStr = buildLods(propName, isTree);
    if (isTree) {
      return `PropBlueprint {\n    Audio = {\n        BurnLoop = Sound {\n            Bank = 'AmbientTest',\n            Cue = 'Gen_Fire_Loop',\n            LodCutoff = 'UnitMove_LodCutoff',\n        },\n        BurnStart = Sound {\n            Bank = 'AmbientTest',\n            Cue = 'Gen_Fire_Start',\n            LodCutoff = 'UnitMove_LodCutoff',\n        },\n        TreeFall = Sound {\n            Bank = 'AmbientTest',\n            Cue = 'Gen_Tree_Crush',\n            LodCutoff = 'UnitMove_LodCutoff',\n        },\n    },\n    Categories = {\n        'RECLAIMABLE',\n    },\n    CollisionOffsetX = 0,\n    CollisionOffsetY = 0,\n    CollisionOffsetZ = 0,\n    Defense = {\n        Health = ${bp.health},\n        MaxHealth = ${bp.health},\n    },\n    Display = {\n        Mesh = {\n            IconFadeInZoom = 4,\n            LODs = {\n${lodsStr}\n            },\n        },\n        UniformScale = ${bp.uniformScale},\n    },\n    Economy = {\n        ReclaimEnergyMax = ${bp.reclaimEnergy},\n        ReclaimMassMax = ${bp.reclaimMass},\n        ReclaimTime = ${bp.reclaimTime},\n    },\n    Interface = {\n        HelpText = '${bp.helpText || propName}',\n    },\n    Physics = {\n        BlockPath = ${bp.blockPath},\n    },\n    ScriptClass = 'prop',\n    ScriptModule = '/lua/proptree.lua',\n    SizeX = ${bp.sizeX},\n    SizeY = ${bp.sizeY},\n    SizeZ = ${bp.sizeZ},\n}`;
    } else {
      return `PropBlueprint {\n    Categories = {\n        'RECLAIMABLE',\n    },\n    Defense = {\n        Health = ${bp.health},\n        MaxHealth = ${bp.health},\n    },\n    Display = {\n        Mesh = {\n            IconFadeInZoom = 4,\n            LODs = {\n${lodsStr}\n            },\n        },\n        UniformScale = ${bp.uniformScale},\n    },\n    Economy = {\n        ReclaimEnergyMax = ${bp.reclaimEnergy || "''"},\n        ReclaimMassMax = ${bp.reclaimMass},\n        ReclaimTime = ${bp.reclaimTime},\n    },\n    Footprint = {\n        OccupancyCaps = ${bp.occupancyCaps ?? 3},\n    },\n    Interface = {\n        HelpText = '${bp.helpText || propName}',\n    },\n    Physics = {\n        BlockPath = ${bp.blockPath},\n    },\n    SizeX = ${bp.sizeX},\n    SizeY = ${bp.sizeY},\n    SizeZ = ${bp.sizeZ},\n}`;
    }
  };

  // ── Derived / validation ─────────────────────────────────────────────────
  const propName     = name.trim().replace(/\s+/g, '_');
  const canSaveManual = propName && scmLod0 && albedoFile && normalFile
    && (bpMode === 'upload' ? bpFile : bpMode === 'create');
  const canSaveFolder = folderName && folderStatus !== 'error' && (Object.keys(folderRawFiles).length > 0 || folderProps.length > 0);
  const canSave       = inputMode === 'folder' ? canSaveFolder : canSaveManual;

  // ── Save: folder mode ────────────────────────────────────────────────────
  // Rebuild a prop.bp text with edited values, preserving the original structure
  // by doing targeted replacements on known keys.
  const buildEditedBpText = (originalText, edits, propName) => {
    if (!edits || Object.keys(edits).length === 0) return originalText;
    let t = originalText;
    const rep = (key, val) => { t = t.replace(new RegExp(`(${key}\\s*=\\s*)[\\d.eE+\\-]+`), `$1${val}`); };
    const repBool = (key, val) => { t = t.replace(new RegExp(`(${key}\\s*=\\s*)(true|false)`), `$1${val}`); };
    const repStr  = (key, val) => { t = t.replace(new RegExp(`(${key}\\s*=\\s*)'[^']*'`), `$1'${val}'`); };
    if (edits.reclaimMass    != null) rep('ReclaimMassMax', edits.reclaimMass);
    if (edits.reclaimEnergy  != null) rep('ReclaimEnergyMax', edits.reclaimEnergy);
    if (edits.reclaimTime    != null) rep('ReclaimTime', edits.reclaimTime);
    if (edits.health         != null) { rep('MaxHealth', edits.health); rep('Health', edits.health); }
    if (edits.uniformScale   != null) rep('UniformScale', edits.uniformScale);
    if (edits.lodCutoff      != null) rep('LODCutoff', edits.lodCutoff);
    if (edits.sizeX          != null) rep('SizeX', edits.sizeX);
    if (edits.sizeY          != null) rep('SizeY', edits.sizeY);
    if (edits.sizeZ          != null) rep('SizeZ', edits.sizeZ);
    if (edits.blockPath      != null) repBool('BlockPath', edits.blockPath);
    if (edits.occupancyCaps  != null) rep('OccupancyCaps', edits.occupancyCaps);
    if (edits.helpText       != null) repStr('HelpText', edits.helpText);
    return t;
  };

  const handleSaveFolder = async () => {
    setSaving(true);
    try {
      // ── Multi-prop folder ──────────────────────────────────────────────────
      if (folderProps.length > 1) {
        if (packTogether) {
          // Pack Together: all props share one folder, shared textures are only written once
          const sharedFiles = {};
          const writtenTex = new Set();

          for (const prop of folderProps) {
            const edits = propBpEdits[prop.name] || {};
            const originalBpText = await readText(prop.bpFile);
            const finalBpText = buildEditedBpText(originalBpText, edits, prop.name);
            sharedFiles[`${prop.name}_prop.bp`] = { name: `${prop.name}_prop.bp`, data: finalBpText, encoding: 'utf8' };

            for (const f of prop.scmFiles) {
              if (!sharedFiles[f.name]) {
                sharedFiles[f.name] = { name: f.name, data: await readBase64(f), encoding: 'base64' };
              }
            }
            for (const f of prop.texFiles) {
              if (!writtenTex.has(f.name)) {
                writtenTex.add(f.name);
                sharedFiles[f.name] = { name: f.name, data: await readBase64(f), encoding: 'base64' };
              }
            }
          }

          const res = await window.electronAPI.invoke('save-custom-prop-folder', {
            propName: folderName,
            propType: folderProps[0]?.propType || propType,
            files: sharedFiles,
            packTogether: true,
          });
          if (!res?.success) throw new Error(res?.error || 'Save failed');
          const savedCount = folderProps.length;
          console.log(`[ACPO] Saved ${savedCount} props (packTogether) into "${folderName}"`);
          onSaved?.({ savedCount, folderName });
          onClose();
        } else {
          // Separate: each prop gets its own folder with its own copies of textures
          const results = [];
          for (const prop of folderProps) {
            const propFiles = {};
            const edits = propBpEdits[prop.name] || {};
            const originalBpText = await readText(prop.bpFile);
            const finalBpText = buildEditedBpText(originalBpText, edits, prop.name);
            propFiles[`${prop.name}_prop.bp`] = { name: `${prop.name}_prop.bp`, data: finalBpText, encoding: 'utf8' };
            for (const f of [...prop.scmFiles, ...prop.texFiles]) {
              propFiles[f.name] = { name: f.name, data: await readBase64(f), encoding: 'base64' };
            }
            const res = await window.electronAPI.invoke('save-custom-prop-folder', {
              propName: prop.name, propType: prop.propType, files: propFiles,
            });
            if (res?.success) results.push({ prop, result: res });
          }
          if (results.length === 0) throw new Error('No props saved');
          onSaved?.({ savedCount: results.length, folderName });
          onClose();
        }
        return;
      }

      // ── Single-prop folder: send all files with relative paths ─────────────
      const filePayloads = {};
      const singleProp = folderProps[0];
      const edits = singleProp ? (propBpEdits[singleProp.name] || {}) : {};

      for (const [relPath, file] of Object.entries(folderRawFiles)) {
        const ext = relPath.split('.').pop().toLowerCase();
        if (relPath.toLowerCase().endsWith('_prop.bp') && singleProp && Object.keys(edits).length > 0) {
          const originalText = await readText(file);
          filePayloads[relPath] = { name: relPath, data: buildEditedBpText(originalText, edits, singleProp.name), encoding: 'utf8' };
        } else if (['bp', 'lua', 'txt'].includes(ext)) {
          filePayloads[relPath] = { name: relPath, data: await readText(file), encoding: 'utf8' };
        } else {
          filePayloads[relPath] = { name: relPath, data: await readBase64(file), encoding: 'base64' };
        }
      }
      const result = await window.electronAPI.invoke('save-custom-prop-folder', { propName: folderName, propType, files: filePayloads });
      if (!result?.success) throw new Error(result?.error || 'Save failed');
      onSaved?.({ savedCount: 1, folderName });
      onClose();
    } catch (err) {
      await luxuryAlert(`Failed to save:\n${err.message}`, 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Save: manual mode ────────────────────────────────────────────────────
  const handleSaveManual = async () => {
    setSaving(true);
    try {
      const files = {
        albedo: { name: `${propName}_albedo.dds`,    data: await readBase64(albedoFile), encoding: 'base64' },
        normal: { name: `${propName}_normalsTS.dds`, data: await readBase64(normalFile), encoding: 'base64' },
        lod0:   { name: `${propName}_lod0.scm`,      data: await readBase64(scmLod0),    encoding: 'base64' },
      };
      if (scmLod1) files.lod1 = { name: `${propName}_lod1.scm`, data: await readBase64(scmLod1), encoding: 'base64' };
      if (scmLod2) files.lod2 = { name: `${propName}_lod2.scm`, data: await readBase64(scmLod2), encoding: 'base64' };
      files.bp = {
        name: `${propName}_prop.bp`,
        data: bpMode === 'upload' ? await readText(bpFile) : buildBpContent(propName),
        encoding: 'utf8',
      };

      const result = await window.electronAPI.invoke('save-custom-prop', { propName, propType, files });
      if (!result?.success) throw new Error(result?.error || 'Save failed');
      onSaved?.({ savedCount: 1, folderName: propName });
      onClose();
    } catch (err) {
      await luxuryAlert(`Failed to save prop:\n${err.message}`, 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => inputMode === 'folder' ? handleSaveFolder() : handleSaveManual();

  const bpVals   = folderBp || {};
  const hasBpData = folderBp && Object.entries(folderBp)
    .filter(([k]) => !k.startsWith('_'))
    .some(([, v]) => v !== undefined && v !== null);

  // ── Render ────────────────────────────────────────────────────────────────
  const OuterWrapper = ({ children }) => inline ? <>{children}</> : (
    <div className="acpo-backdrop">
      <div className="acpo-panel">
        <div className="acpo-header">
          <div className="acpo-header-title">
            <span className="acpo-header-icon"></span>
            ADD CUSTOM PROP
          </div>
          <button className="acpo-btn-close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );

  return (
    <OuterWrapper>
      <div className="acpo-body">

          {/* ── Input Mode ── */}
          <div className="acpo-section">
            <label className="acpo-section-label">INPUT MODE</label>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className={`station option-row${inputMode === 'manual' ? ' active' : ''}`}
                onClick={() => setInputMode('manual')} style={{ flex: 1 }}>
                <div className="option-row-head"><span className="option-label">Manual</span></div>
              </button>
              <button className={`station option-row${inputMode === 'folder' ? ' active' : ''}`}
                onClick={() => setInputMode('folder')} style={{ flex: 1 }}>
                <div className="option-row-head"><span className="option-label">Drop Folder</span></div>
              </button>
            </div>
          </div>

          {/* ═══════════════════════════
              FOLDER MODE
              ═══════════════════════════ */}
          {inputMode === 'folder' && (
            <>
              <div className="acpo-section">
                <FolderDropZone
                  folderName={folderName}
                  fileList={folderFiles}
                  onFolder={handleFolderDrop}
                  status={folderStatus}
                  propCount={folderProps.length > 0 ? folderProps.length : (folderBp?._bpCount ?? 1)}
                />
              </div>

              {/* ── Multi-prop tabs (flat folder with several .bp files) ── */}
              {folderProps.length > 1 && (
                <div className="acpo-section">
                  <label className="acpo-section-label">
                    PROPS IN FOLDER ({folderProps.length})
                  </label>
                  <div className="acpo-bp-tabs" style={{ flexWrap: 'wrap' }}>
                    {folderProps.map((p, i) => (
                      <button
                        key={p.name}
                        className={`acpo-bp-tab${selectedPropIdx === i ? ' active' : ''}${propBpEdits[p.name] ? ' edited' : ''}`}
                        onClick={() => { setSelectedPropIdx(i); setFolderBp(p.bp); if (p.propType) setPropType(p.propType); }}
                        style={{ flex: 'none' }}
                      >
                        {p.propType === 'tree' ? '' : ''} {p.name}
                        {propBpEdits[p.name] && <span className="acpo-edited-dot" title="Modified">●</span>}
                      </button>
                    ))}
                  </div>

                  {/* Pack Together toggle */}
                  <div className="acpo-pack-together">
                    <button
                      className={`acpo-pack-btn${packTogether ? ' on' : ' off'}`}
                      onClick={() => setPackTogether(v => !v)}
                    >
                      <span className="acpo-pack-checkbox">{packTogether ? '' : ''}</span>
                      <span className="acpo-pack-label">Pack Together</span>
                    </button>
                    <span className="acpo-pack-hint">
                      {packTogether
                        ? `All ${folderProps.length} props in one folder "${folderName}" — shared textures saved once`
                        : `Each prop gets its own folder with individual albedo & normal map`}
                    </span>
                  </div>
                </div>
              )}

              {/* ── Editable BP values for selected prop (or single prop) ── */}
              {(folderProps.length > 0) && (() => {
                const prop = folderProps[folderProps.length === 1 ? 0 : selectedPropIdx];
                if (!prop) return null;
                const vals = getPropBp(prop);
                const hasEdits = !!propBpEdits[prop.name];
                const isTree = prop.propType === 'tree';
                return (
                  <div className="acpo-section">
                    <label className="acpo-section-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {folderProps.length > 1 ? `VALUES: ${prop.name}` : 'VALUES FROM PROP.BP'}
                      {hasEdits && (
                        <button className="action-button" onClick={() => resetPropBpEdits(prop.name)} title="Reset changes">
                          ↺ Reset
                        </button>
                      )}
                    </label>
                    <div className="acpo-fields-grid">
                      <NumField label="Reclaim Mass"   value={vals.reclaimMass   ?? 0} onChange={v => setPropBpField(prop.name, 'reclaimMass', v)}   step={1}     min={0} />
                      <NumField label="Reclaim Energy" value={vals.reclaimEnergy ?? 0} onChange={v => setPropBpField(prop.name, 'reclaimEnergy', v)} step={1}     min={0} />
                      <NumField label="Reclaim Time"   value={vals.reclaimTime   ?? 0} onChange={v => setPropBpField(prop.name, 'reclaimTime', v)}   step={1}     min={0} />
                      <NumField label="Health"         value={vals.health        ?? 0} onChange={v => setPropBpField(prop.name, 'health', v)}         step={1}     min={1} />
                      <NumField label="Uniform Scale"  value={vals.uniformScale  ?? 0} onChange={v => setPropBpField(prop.name, 'uniformScale', v)}  step={0.001} min={0} />
                      <NumField label="LOD Cutoff"     value={vals.lodCutoff     ?? 0} onChange={v => setPropBpField(prop.name, 'lodCutoff', v)}      step={50}    min={0} />
                      <NumField label="Size X"         value={vals.sizeX         ?? 0} onChange={v => setPropBpField(prop.name, 'sizeX', v)}          step={0.1}   min={0} />
                      <NumField label="Size Y"         value={vals.sizeY         ?? 0} onChange={v => setPropBpField(prop.name, 'sizeY', v)}          step={0.1}   min={0} />
                      <NumField label="Size Z"         value={vals.sizeZ         ?? 0} onChange={v => setPropBpField(prop.name, 'sizeZ', v)}          step={0.1}   min={0} />
                      {!isTree && (
                        <NumField label="Occupancy Caps" value={vals.occupancyCaps ?? 3} onChange={v => setPropBpField(prop.name, 'occupancyCaps', v)} step={1} min={0} />
                      )}
                    </div>
                    <div className="acpo-field acpo-field-full" style={{ marginTop: 8 }}>
                      <label className="field-label">Help Text</label>
                      <input className="field-input" value={vals.helpText ?? ''}
                        onChange={e => setPropBpField(prop.name, 'helpText', e.target.value)}
                        placeholder={prop.name} />
                    </div>
                    <ToggleSwitch
                      label="Block Pathfinding"
                      value={vals.blockPath}
                      onChange={v => setPropBpField(prop.name, 'blockPath', v)}
                      className="acpo-toggle-field"
                    />
                    {vals._raw && (
                      <details className="acpo-bp-raw-details" style={{ marginTop: 8 }}>
                        <summary className="acpo-bp-raw-summary">Show raw prop.bp content</summary>
                        <pre className="acpo-bp-preview-code">
                          {vals._raw.slice(0, 1400)}{vals._raw.length > 1400 ? '\n…' : ''}
                        </pre>
                      </details>
                    )}
                  </div>
                );
              })()}

              {/* Detected type note */}
              {folderProps.length > 0 && (
                <div className="acpo-section">
                  <div className="acpo-folder-type-note">
                    <span>{propType === 'tree' ? '' : ''}</span>
                    <span>
                      {folderProps.length > 1
                        ? packTogether
                          ? `Pack Together → one folder "${folderName}" with ${folderProps.length} props`
                          : `Separate folders → ${folderProps.length} props, individual texture copies`
                        : `Detected type: ${propType === 'tree' ? 'Tree' : 'Rock'}${propType === 'tree' ? ' — proptree.lua' : ''}`}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════
              MANUAL MODE
              ═══════════════════════════ */}
          {inputMode === 'manual' && (
            <>
              {/* Type */}
              <div className="acpo-section">
                <label className="acpo-section-label">PROP TYPE</label>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <button className={`station option-row${propType === 'tree' ? ' active' : ''}`} onClick={() => switchType('tree')} style={{ flex: 1 }}>
                    <div className="option-row-head"><span className="option-label">Tree</span></div>
                  </button>
                  <button className={`station option-row${propType === 'rock' ? ' active' : ''}`} onClick={() => switchType('rock')} style={{ flex: 1 }}>
                    <div className="option-row-head"><span className="option-label">Rock</span></div>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div className="acpo-section">
                <label className="acpo-section-label">PROP NAME</label>
                <input className="field-input" value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={propType === 'tree' ? 'e.g. PineTree_01' : 'e.g. Boulder_Large_01'}
                  autoFocus />
                {propName && <div className="acpo-path-preview">/env/props/{propName}/{propName}_prop.bp</div>}
              </div>

              {/* Assets */}
              <div className="acpo-section">
                <label className="acpo-section-label">ASSETS</label>
                <div className="acpo-dropzones">
                  <DropZone label="Mesh LOD0" accept={['.scm']} file={scmLod0} onFile={setScmLod0} hint=".scm (required)" compact />
                  <DropZone label="Albedo" accept={['.dds']} file={albedoFile} onFile={setAlbedoFile} hint=".dds only" compact />
                  <DropZone label="Normal Map" accept={['.dds']} file={normalFile} onFile={setNormalFile} hint=".dds only" compact />
                </div>
                {scmLod0 && (
                  <div className="acpo-lod-extra">
                    {!showExtraLods ? (
                      <button className="action-button" onClick={() => setShowExtraLods(true)}>+ Add LOD levels (LOD1 / LOD2)</button>
                    ) : (
                      <div className="acpo-lod-extra-grid">
                        <DropZone label="Mesh LOD1" accept={['.scm']} file={scmLod1} onFile={setScmLod1} hint=".scm" optional compact />
                        <DropZone label="Mesh LOD2" accept={['.scm']} file={scmLod2} onFile={setScmLod2} hint=".scm" optional compact />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Blueprint */}
              <div className="acpo-section">
                <label className="acpo-section-label">BLUEPRINT</label>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <button className={`station option-row${bpMode === 'upload' ? ' active' : ''}`} onClick={() => setBpMode('upload')} style={{ flex: 1 }}>
                    <div className="option-row-head"><span className="option-label">Upload prop.bp</span></div>
                  </button>
                  <button className={`station option-row${bpMode === 'create' ? ' active' : ''}`} onClick={() => setBpMode('create')} style={{ flex: 1 }}>
                    <div className="option-row-head"><span className="option-label">Create prop.bp</span></div>
                  </button>
                </div>
                {bpMode === 'upload' && (
                  <div className="acpo-bp-upload">
                    <DropZone label="Blueprint" accept={['.bp']} file={bpFile} onFile={setBpFile} hint="Drop _prop.bp here" />
                  </div>
                )}
                {bpMode === 'create' && (
                  <div className="acpo-bp-fields">
                    <div className="acpo-fields-grid">
                      <NumField label="Reclaim Mass"   value={bp.reclaimMass}   onChange={v => setBpField('reclaimMass', v)}   step={1} min={0} />
                      <NumField label="Reclaim Energy" value={bp.reclaimEnergy} onChange={v => setBpField('reclaimEnergy', v)} step={1} min={0} />
                      <NumField label="Reclaim Time"   value={bp.reclaimTime}   onChange={v => setBpField('reclaimTime', v)}   step={1} min={0} />
                      <NumField label="Health"         value={bp.health}        onChange={v => setBpField('health', v)}        step={1} min={1} />
                      <NumField label="Uniform Scale"  value={bp.uniformScale}  onChange={v => setBpField('uniformScale', v)} step={0.001} min={0} />
                      <NumField label="LOD Cutoff"     value={bp.lodCutoff}     onChange={v => setBpField('lodCutoff', v)}    step={50}  min={0} />
                      <NumField label="Size X" value={bp.sizeX} onChange={v => setBpField('sizeX', v)} step={0.1} min={0} />
                      <NumField label="Size Y" value={bp.sizeY} onChange={v => setBpField('sizeY', v)} step={0.1} min={0} />
                      <NumField label="Size Z" value={bp.sizeZ} onChange={v => setBpField('sizeZ', v)} step={0.1} min={0} />
                      {propType === 'rock' && (
                        <NumField label="Occupancy Caps" value={bp.occupancyCaps ?? 3} onChange={v => setBpField('occupancyCaps', v)} step={1} min={0} />
                      )}
                    </div>
                    <div className="acpo-field acpo-field-full">
                      <label className="field-label">Help Text</label>
                      <input className="field-input" value={bp.helpText}
                        onChange={e => setBpField('helpText', e.target.value)}
                        placeholder={propName || 'Prop description'} />
                    </div>
                    <ToggleSwitch
                      label="Block Pathfinding"
                      value={bp.blockPath}
                      onChange={v => setBpField('blockPath', v)}
                    />
                    {propName && (
                      <div className="acpo-bp-preview">
                        <div className="acpo-bp-preview-label">Generated prop.bp preview</div>
                        <pre className="acpo-bp-preview-code">{buildBpContent(propName)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="acpo-footer">
          <div className="acpo-footer-hint">
            {inputMode === 'folder'
              ? !folderName
                ? 'Drop a prop folder or click to browse.'
                : folderStatus === 'error'
                  ? ' No _prop.bp file found in folder.'
                  : folderStatus === 'warn'
                    ? ' .bp found, but mesh or texture may be missing.'
                  : folderProps.length > 1
                    ? packTogether
                      ? ` ${folderProps.length} props → shared folder "${folderName}"`
                      : ` ${folderProps.length} props → individual folders`
                    : ` Folder will be saved globally under ${propType === 'tree' ? 'global/trees' : 'global/rocks'}.`
              : !propName
                ? 'Enter a prop name to get started.'
                : !scmLod0 || !albedoFile || !normalFile
                  ? 'Upload Mesh LOD0, Albedo (.dds) and Normal Map (.dds).'
                  : !bpMode
                    ? 'Choose a blueprint option above.'
                    : bpMode === 'upload' && !bpFile
                      ? 'Upload your prop.bp file.'
                      : ' Ready — prop will be stored globally and available across all maps.'}
          </div>
          <div className="acpo-footer-actions">
            <button className="action-button" onClick={onClose}>Cancel</button>
            <button className={`action-button${canSave ? ' ready' : ''}`} onClick={handleSave} disabled={!canSave || saving}>
              {saving ? ' Saving…' : ' Save Prop'}
            </button>
          </div>
        </div>
    </OuterWrapper>
  );
}
