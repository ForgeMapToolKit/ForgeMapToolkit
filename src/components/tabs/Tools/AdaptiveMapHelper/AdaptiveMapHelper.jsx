import { useState, useRef, useEffect } from "react";
import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import './AdaptiveMapHelper.css';
import AMHHelpModal from '../../HelpModals/AdaptiveMapHelper_help.jsx';
import TabLayout from '../../../Shared/Ui/TabLayout/TabLayout';
import { OutputChecklist } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import { usePersistentState } from '../../../Shared/MapLogic';
import MapCanvas from './MapCanvas.jsx';
import {
  ICON_MASS, ICON_ENERGY, ICON_ACU, getAcuIcon,
  parseSaveLua, generateOptionsLua, generateScriptLua, generateTablesLua,
  ARMY_COLORS,
} from './luaGenerators';

// ── Main Component ───────────────────────────────────────────────────────────
export default function AdaptiveMapHelper({ settings, shared={}, onSharedChange=()=>{} }) {

  const [mapName, setMapName] = usePersistentState(shared, 'amh_mapName', '', onSharedChange);

  const [mapInfo,       setMapInfo]       = useState(null);
  const [mapSize,       setMapSize]       = useState(1024);
  const [parsed,        setParsed]        = useState(null);
  const [assignments,   setAssignments]   = useState({});
  const [activeSection, setActiveSection] = useState('canvas');
  const [generatedCode, setGeneratedCode] = useState('');
  const [previewDataUrl,setPreviewDataUrl]= useState(null);
  const [previewLoading,setPreviewLoading]= useState(false);
  const previewInputRef = useRef();
  const [mirrorMode,    setMirrorMode]    = useState(false);
  const [quickArmy,     setQuickArmy]     = useState(null); // army key or null
  const [adaptiveStatus, setAdaptiveStatus] = useState(null); // null | 'running' | 'done' | 'error' | 'already'
  const [adaptiveMsg,    setAdaptiveMsg]    = useState('');
  const [tablesOnly,     setTablesOnly]     = useState(false);
  const [generateReadme, setGenerateReadme] = useState(settings?.generateReadme !== false);
  const [metaOpen,       setMetaOpen]       = useState(false);
  const [showHelp,       setShowHelp]       = useState(false);
  const [activeHelpTab,  setActiveHelpTab]  = useState('guide');
  const [helpSelected,   setHelpSelected]   = useState(null);
  const [helpAdvSubTab,  setHelpAdvSubTab]  = useState('overview');

  // Check whether the current mapName already has the adaptive_ prefix
  const isAlreadyAdaptive = (() => {
    const n = (mapName || '').trim().toLowerCase();
    // Extract the base name without .vNNNN
    const base = n.replace(/\.v\d{4}$/, '');
    return base.startsWith('adaptive_');
  })();


  // Reset preview when map changes
  useEffect(() => {
    setPreviewDataUrl(null);
    setMetaOpen(false);
  }, [mapName, settings?.mapsFolder]);

  const loadPreviewFromScmap = async (mapFolderPath) => {
    try {
      setPreviewLoading(true);
      const dirRes = await window.electronAPI.invoke('list-dir', { dirPath: mapFolderPath });
      if (!dirRes?.success) return;
      const scmapEntry = dirRes.entries.find(e => !e.isDirectory && e.name.toLowerCase().endsWith('.scmap'));
      if (!scmapEntry) return;
      const scmapPath = mapFolderPath + '\\' + scmapEntry.name;
      const unpackRes = await window.electronAPI.invoke('scmap-unpack', { scmapPath });
      if (!unpackRes?.success) return;
      const unpackDir = await window.electronAPI.invoke('list-dir', { dirPath: unpackRes.outputFolder });
      if (!unpackDir?.success) return;
      const previewEntry = unpackDir.entries.find(e => /^previewimage/i.test(e.name));
      if (!previewEntry) return;
      const ddsPath = unpackRes.outputFolder + '\\' + previewEntry.name;
      const ddsRes = await window.electronAPI.invoke('dds-to-dataurl', { filePath: ddsPath });
      if (ddsRes?.success && ddsRes.dataUrl) setPreviewDataUrl(ddsRes.dataUrl);
    } catch (e) {
      console.warn('[AMH] preview load failed:', e);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCustomPreviewUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPreviewDataUrl(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  useEffect(() => {
    const name   = (mapName||'').trim();
    const folder = (settings?.mapsFolder||'').trim();
    if (!name||!folder) { setMapInfo(null); setParsed(null); return; }
    const finalName     = /\.v\d{4}$/.test(name) ? name : name+'.v0001';
    const mapFolderPath = folder+'\\'+finalName;

    window.electronAPI.invoke('read-map-info',{mapFolderPath}).then(res=>{
      if (res?.success) {
        setMapInfo({ok:true, mapSize:res.mapSize, km:res.km, playableSize:res.playableSize});
        setMapSize(res.playableSize||1024);
      } else setMapInfo({ok:false});
    }).catch(()=>setMapInfo({ok:false}));

    // Load preview image from scmap
    loadPreviewFromScmap(mapFolderPath);

    window.electronAPI.invoke('list-dir',{dirPath:mapFolderPath}).then(async res=>{
      if (!res?.success) { setParsed(null); return; }
      const saveEntry = res.entries.find(e=>!e.isDirectory&&e.name.toLowerCase().endsWith('_save.lua'));
      if (!saveEntry) { setParsed(null); return; }
      const fileRes = await window.electronAPI.invoke('read-file',{path:mapFolderPath+'\\'+saveEntry.name});
      if (fileRes?.success&&fileRes.content) { setParsed(parseSaveLua(fileRes.content)); setAssignments({}); }
      else setParsed(null);
    }).catch(()=>setParsed(null));
  }, [mapName, settings?.mapsFolder]);

  const armyList   = parsed ? Object.keys(parsed.armies).sort((a,b)=>parseInt(a.replace('ARMY_',''))-parseInt(b.replace('ARMY_',''))) : [];
  const maxPlayers = armyList.filter(a=>a!=='ARMY_17').length;

  const removeAssignment = key => setAssignments(prev=>{ const n={...prev}; delete n[key]; return n; });

  // ── README ──────────────────────────────────────────────────────────────────
  const buildReadme = (finalName, mapsFolder, writtenFiles) => {
    const now     = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const divider = '─'.repeat(70);
    const thick   = '═'.repeat(70);

    const spwnMex = {}, spwnHydro = {};
    Object.entries(assignments).forEach(([key, a]) => {
      if (!a?.army) return;
      const bucket = a.type === 'spawnHydro' ? spwnHydro : spwnMex;
      (bucket[a.army] ||= []).push(key);
    });

    const lines = [];
    lines.push(thick);
    lines.push('  ADAPTIVE MAP HELPER — GENERATION README');
    lines.push('  ForgeMapToolkit');
    lines.push(thick);
    lines.push('');
    lines.push(`  Generated  : ${dateStr} at ${timeStr}`);
    lines.push(`  Map        : ${finalName}`);
    lines.push(`  Maps Folder: ${mapsFolder}`);
    lines.push('');
    lines.push(divider);
    lines.push('  FILES WRITTEN');
    lines.push(divider);
    writtenFiles.forEach(f => lines.push(`  ${f}`));
    lines.push('');
    lines.push(divider);
    lines.push('  ARMY ASSIGNMENTS');
    lines.push(divider);
    lines.push(`  Players  : ${maxPlayers}`);
    lines.push(`  Assigned : ${assigned} / ${totalMarkers} markers`);
    lines.push('');
    armyList.filter(a => a !== 'ARMY_17').forEach(army => {
      const mex   = spwnMex[army]   || [];
      const hydro = spwnHydro[army] || [];
      if (mex.length === 0 && hydro.length === 0) return;
      lines.push(`  ${army}`);
      if (mex.length)   lines.push(`    Mass       : ${mex.join(', ')}`);
      if (hydro.length) lines.push(`    Hydrocarbon: ${hydro.join(', ')}`);
    });
    lines.push('');
    lines.push(thick);
    lines.push('  COPYRIGHT');
    lines.push(thick);
    lines.push('');
    lines.push('  Creative Commons Attribution-NonCommercial 4.0 International');
    lines.push('  Copyright (c) 2026 timmasalme');
    lines.push('');
    lines.push('  This file was generated by ForgeMapToolkit for your personal use.');
    lines.push('  ForgeMapToolkit · https://github.com/timmasalme/ForgeMapToolkit');
    lines.push(thick);
    return lines.join('\n');
  };

  // ── Write tables.lua (+ options/script unless tablesOnly, + README if enabled) ──
  const writeGeneratedFiles = async (mapFolderPath, baseName, finalName, mapsFolder) => {
    const tables = generateTablesLua(armyList, assignments, maxPlayers);
    setGeneratedCode(tables);
    setActiveSection('tables');

    const writtenFiles = [`${baseName}_tables.lua`];
    const writes = [
      window.electronAPI.invoke('write-file', { filePath: `${mapFolderPath}\\${baseName}_tables.lua`, content: tables }),
    ];

    if (!tablesOnly) {
      const options = generateOptionsLua();
      // Pass the full versioned name so the import path uses the correct version suffix
      const script = generateScriptLua(finalName);
      writtenFiles.push(`${baseName}_options.lua`, `${baseName}_script.lua`);
      writes.push(
        window.electronAPI.invoke('write-file', { filePath: `${mapFolderPath}\\${baseName}_options.lua`, content: options }),
        window.electronAPI.invoke('write-file', { filePath: `${mapFolderPath}\\${baseName}_script.lua`,  content: script  }),
      );
    }

    if (generateReadme) {
      const readme = buildReadme(finalName, mapsFolder, writtenFiles);
      writes.push(
        window.electronAPI.invoke('write-file', { filePath: `${mapFolderPath}\\AdaptiveMapHelper_Generation_README.txt`, content: readme }),
      );
    }

    try {
      await Promise.all(writes);
    } catch (e) {
      console.warn('[AMH] write-file failed:', e);
    }
  };

  const handleGenerate = async () => {
    if (!parsed) return;

    // ── Auto-rename to adaptive_ BEFORE writing files ─────────────────────────
    // If the map folder doesn't have the adaptive_ prefix yet, rename it first
    // so the generated files land in the correctly-named folder.
    if (!isAlreadyAdaptive) {
      const name   = (mapName||'').trim();
      const folder = (settings?.mapsFolder||'').trim();
      if (name && folder) {
        const finalName     = /\.v\d{4}$/.test(name) ? name : name + '.v0001';
        const mapFolderPath = folder + '\\' + finalName;

        setAdaptiveStatus('running');
        setAdaptiveMsg('');

        try {
          const res = await window.electronAPI.invoke('make-map-adaptive', { mapFolder: mapFolderPath });

          if (res?.alreadyAdaptive) {
            setAdaptiveStatus('already');
            setAdaptiveMsg('Map already has the adaptive_ prefix.');
          } else if (res?.success) {
            setMapName(res.newFolderName);
            setAdaptiveStatus('done');
            setAdaptiveMsg(
              `✓ Renamed to ${res.newFolderName}` +
              ` · ${res.renamedFiles?.length ?? 0} files · ${res.patchedFiles?.length ?? 0} Lua files patched`
            );
            // Continue generate with the new (adaptive_) map name
            const adaptiveFinalName = res.newFolderName;
            const adaptiveBaseName  = adaptiveFinalName.replace(/\.v\d{4}$/, '');
            const adaptiveFolder    = folder + '\\' + adaptiveFinalName;
            await writeGeneratedFiles(adaptiveFolder, adaptiveBaseName, adaptiveFinalName, folder);
            return;
          } else {
            setAdaptiveStatus('error');
            setAdaptiveMsg(res?.error || 'Rename failed');
            // Still attempt to write files into the original folder
          }
        } catch (e) {
          setAdaptiveStatus('error');
          setAdaptiveMsg(String(e?.message || e));
        }
      }
    }

    // ── Write files (map is already adaptive, or rename was skipped/failed) ───
    const name   = (mapName||'').trim();
    const folder = (settings?.mapsFolder||'').trim();
    if (!name||!folder) return;
    const finalName     = /\.v\d{4}$/.test(name) ? name : name+'.v0001';
    const mapFolderPath = folder+'\\'+finalName;
    const baseName = finalName.replace(/\.v\d{4}$/, '');

    await writeGeneratedFiles(mapFolderPath, baseName, finalName, folder);
  };

  const assigned     = Object.keys(assignments).length;
  const totalMarkers = parsed ? Object.keys(parsed.mass).length + Object.keys(parsed.hydro).length : 0;

  // ── Band content — Canvas ────────────────────────────────────────────────
  // Row 1 (topBar): identity only — map name + the mass/hydro/army/assigned
  // legend. Row 2 (toolbar): everything else (preview, metadata, status
  // feedback, mirror, quick-assign), left-aligned, per user layout request.
  const canvasTopBar = (
    <>
      <input
        className="ctrl-input ctrl-input--text amh-topbar-input"
        type="text"
        value={mapName}
        onChange={e=>setMapName(e.target.value)}
        placeholder="Map name — e.g. Hades_Dust.v0002"
      />
      <div className="amh-topbar-spacer" />
      {parsed&&(
        <div className="ctrl-mapinfo">
          <img src={ICON_MASS}   alt="" className="amh-stat-icon" />
          <span>{Object.keys(parsed.mass).length}</span>
          <span className="ctrl-mapinfo-sep">·</span>
          <img src={ICON_ENERGY} alt="" className="amh-stat-icon" />
          <span>{Object.keys(parsed.hydro).length}</span>
          <span className="ctrl-mapinfo-sep">·</span>
          <img src={ICON_ACU} alt="" className="amh-stat-icon" />
          <span>{maxPlayers}</span>
          <span className="ctrl-mapinfo-sep">·</span>
          <span className="amh-stat-assigned">{assigned} / {totalMarkers} assigned</span>
        </div>
      )}
    </>
  );

  const canvasToolbar = (
    <>
      <input ref={previewInputRef} type="file" accept="image/*,.dds" style={{display:'none'}} onChange={handleCustomPreviewUpload}/>
      {mapInfo?.ok&&(
        <div className="amh-meta-wrap">
          <button className="ctrl-btn-meta" onClick={()=>setMetaOpen(o=>!o)}>
            {metaOpen ? '− Metadata' : '+ Metadata'}
          </button>
          {metaOpen && (
            <div className="amh-meta-pop">
              <div className="ctrl-mapinfo">
                <span>{mapInfo.mapSize}×{mapInfo.mapSize} px</span>
                <span className="ctrl-mapinfo-sep">·</span>
                <span>{mapInfo.km} km</span>
                <span className="ctrl-mapinfo-sep">·</span>
                <span>playable {mapInfo.playableSize} px</span>
              </div>
            </div>
          )}
        </div>
      )}
      {previewLoading
        ? <span className="amh-toolbar-note">loading preview…</span>
        : <button className="ctrl-btn-add" title="Load custom preview image (PNG/JPG/DDS)" onClick={()=>previewInputRef.current?.click()}>Replace Preview</button>
      }
      {mapName&&!settings?.mapsFolder&&<span className="ctrl-badge ctrl-badge--err">Maps folder not set</span>}
      {mapInfo&&!mapInfo.ok&&(
        <span className="ctrl-badge ctrl-badge--err">Map not found — check name or Maps Folder in Settings</span>
      )}
      {(adaptiveStatus === 'done' || adaptiveStatus === 'already') && (
        <span className="ctrl-badge ctrl-badge--ok">{adaptiveMsg}</span>
      )}
      {adaptiveStatus === 'error' && (
        <span className="ctrl-badge ctrl-badge--err">{adaptiveMsg}</span>
      )}
      <button
        type="button" role="switch" aria-checked={mirrorMode}
        className={`ctrl-toggle-row amh-inline-toggle${mirrorMode?' on':''}`}
        title="Mirror Mode: assign clicked marker + its map-centre mirror"
        onClick={()=>setMirrorMode(m=>!m)}>
        <span className="ctrl-toggle"><span className="ctrl-toggle-pole" /></span>
        <span className="ctrl-toggle-text"><span className="ctrl-toggle-label">Mirror</span></span>
      </button>
      <div className="amh-qa-wrap">
        <span className="amh-qa-label">Quick</span>
        {armyList.filter(a=>a!=='ARMY_17').map(army=>{
          const idx=parseInt(army.replace('ARMY_',''))-1;
          const col=ARMY_COLORS[idx%ARMY_COLORS.length];
          return (
            <button key={army}
              className={`amh-qa-btn${quickArmy===army?' active':''}`}
              style={{'--qcol':col}}
              title={`Quick-assign → ${army}`}
              onClick={()=>setQuickArmy(q=>q===army?null:army)}>
              <img src={getAcuIcon(idx)} alt="" className="amh-qa-icon"/>
              <span>{idx+1}</span>
            </button>
          );
        })}
      </div>
    </>
  );

  // ── Band content — Tables ────────────────────────────────────────────────
  const tablesTopBar = (
    <>
      <span className="amh-code-label">
        {generatedCode ? (tablesOnly ? 'tables.lua' : 'tables.lua · options.lua · script.lua') : 'tables.lua'}
      </span>
      {generatedCode && <span className="ctrl-badge ctrl-badge--ok">saved</span>}
      <div className="amh-topbar-spacer" />
      {generatedCode && (
        <button className="ctrl-btn-add" onClick={()=>navigator.clipboard.writeText(generatedCode)}>Copy tables.lua</button>
      )}
    </>
  );

  // ── Band content — Export ────────────────────────────────────────────────
  // (Live status now lives in the standby-field readout below, next to the
  // form — no need to repeat it in the topBar too.)
  const exportTopBar = (
    <span className="amh-code-label">Export Options</span>
  );

  // Stays on layoutMode="w" (same as Canvas/Tables) — switching layoutMode
  // dynamically on one TabLayout instance is a pattern nothing else in the
  // app uses, and it was the one thing that differed about this section
  // when the Export tab was reported buggy.
  const topBar          = activeSection === 'canvas' ? canvasTopBar : activeSection === 'export' ? exportTopBar : tablesTopBar;
  const toolbar         = activeSection === 'canvas' ? canvasToolbar : undefined;
  const canvasToolbarOn = activeSection === 'canvas';

  return (
    <div className="amh-tab trace-tab">

      {/* ── Help button — shared.css .help-btn ── */}
      <button className="help-btn" onClick={() => setShowHelp(h => !h)} title="Help Guide">?</button>

      {/* ── Help modal ── */}
      {showHelp && (
        <AMHHelpModal
          onClose={() => setShowHelp(false)}
          activeTab={activeHelpTab}
          setActiveTab={t => { setActiveHelpTab(t); setHelpSelected(null); }}
          helpSelected={helpSelected}
          setHelpSelected={setHelpSelected}
          helpAdvSubTab={helpAdvSubTab}
          setHelpAdvSubTab={setHelpAdvSubTab}
        />
      )}

      <TabLayout
        layoutMode="w"
        sections={[
          { id: 'canvas', index: '01', label: 'Canvas', desc: 'Assign mass and hydrocarbon markers to armies on the map.' },
          { id: 'export', index: '02', label: 'Export',  desc: 'Choose export options and generate the adaptive map files.' },
          { id: 'tables', index: '03', label: 'Tables',  desc: 'Generated tables.lua / options.lua / script.lua output.' },
        ]}
        activeSection={activeSection}
        onSelect={setActiveSection}
        railStorageKey="amh-rail-pinned"
        navLabel="Adaptive Map Helper navigation"
        canvasToolbar={canvasToolbarOn}
        topBar={topBar}
        toolbar={toolbar}
      >
        {activeSection === 'canvas' && (
          !parsed ? (
            <div className="amh-empty-state">
              <div className="amh-empty-icon">⬡</div>
              <div className="amh-empty-title">{mapName?'Loading save.lua…':'Enter a map name above to begin'}</div>
              <div className="amh-empty-sub">{mapName?`Searching in ${settings?.mapsFolder||'(no maps folder set)'}` :'The _save.lua will be read automatically'}</div>
            </div>
          ) : (
            <MapCanvas
              parsed={parsed}
              mapSize={mapSize}
              assignments={assignments}
              armyList={armyList}
              armyColors={ARMY_COLORS}
              onAssign={(key,asgn)=>setAssignments(prev=>({...prev,[key]:asgn}))}
              onRemove={removeAssignment}
              previewDataUrl={previewDataUrl}
              mirrorMode={mirrorMode}
              quickArmy={quickArmy}
            />
          )
        )}

        {activeSection === 'export' && (
          <div className="amh-export-content">
            <div className="workspace-column amh-export-column">
              <div className="ctrl-col">
                <OutputChecklist
                  items={[
                    { label: 'Tables.lua Only', sub: 'Skip options.lua and script.lua', checked: tablesOnly, onToggle: () => setTablesOnly(v => !v) },
                    { label: 'Generate README', checked: generateReadme, onToggle: () => setGenerateReadme(v => !v) },
                  ]}
                  ready={!!parsed}
                  onCommit={handleGenerate}
                  commitLabel="Generate & Save Files"
                  commitAriaLabel="Generate adaptive map files"
                  readyText={`${assigned} / ${totalMarkers} assigned`}
                  notReadyText="Load a map first"
                />
              </div>
            </div>
            {/* Deliberate negative space (Philosophy §1) — same standby-field
               treatment Layout Y uses, reused directly since this section
               stays on Layout W (see the layoutMode comment above). */}
            <div className="standby-field" aria-hidden="true">
              <span className="standby-ghost">EXPORT</span>
              <div className="standby-readout">
                <span className="standby-readout-line">{assigned} / {totalMarkers} assigned</span>
                <span className="standby-readout-line">{tablesOnly ? 'tables.lua only' : 'tables + options + script'}</span>
                <span className="standby-readout-line">{generateReadme ? 'readme on' : 'readme off'}</span>
              </div>
              <span className="standby-cursor" />
            </div>
          </div>
        )}

        {activeSection === 'tables' && (
          <div className="amh-tables-content">
            {generatedCode ? (
              <pre className="amh-code-pre">{generatedCode}</pre>
            ) : (
              <div className="amh-code-empty">
                <div className="amh-code-empty-icon">{'{ }'}</div>
                <span>
                  {parsed
                    ? 'Configure options in Export, then click Generate & Save Files.'
                    : 'Load a map first — switch to Canvas and enter a map name.'}
                </span>
              </div>
            )}
          </div>
        )}
      </TabLayout>
    </div>
  );
}
