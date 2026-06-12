import React from "react";

function AMHHelpModal({ onClose, activeTab, setActiveTab, helpSelected, setHelpSelected, helpAdvSubTab, setHelpAdvSubTab }) {

  const TABS = [
    { id: 'guide',    label: '⊞ Interface Guide' },
    { id: 'advanced', label: '⬡ Advanced Guide'  },
  ];

  const ADV_SUBTABS = [
    { id: 'overview',  label: 'Overview'           },
    { id: 'workflow',  label: 'Workflow'            },
    { id: 'tables',    label: 'tables.lua Format'  },
    { id: 'script',    label: 'script.lua Logic'   },
    { id: 'trouble',   label: 'Troubleshooting'    },
  ];

  // ── Click-to-explain info for every element in the replica ──────────────
  const UI_INFO = {
    mapname: {
      title: 'Map Name Input',
      desc: 'The folder name of your map inside the /maps directory. This is the entry point for everything — the tool reads the _save.lua from this folder to extract all markers.',
      details: [['Format','MapName.vNNNN — e.g. adaptive_Tartaron.v0006'],['Auto-version','Omitting .vNNNN appends .v0001 automatically'],['Case-sensitive','FA resolves paths literally — match folder name exactly'],['adaptive_ prefix','Required for FAF to recognise the map as an Adaptive Map']],
      tip: 'Paste the folder name directly from File Explorer. If the name lacks adaptive_, the tool renames the folder automatically on Generate.',
    },
    statpills: {
      title: 'Marker Statistics',
      desc: 'Live count of mass extractors, hydrocarbon deposits, and player spawn slots parsed from the _save.lua. Updates automatically when the map loads.',
      details: [['Mass icon','Number of Mass markers found in _save.lua'],['Energy icon','Number of Hydrocarbon markers found'],['ACU icon','Number of player army slots (ARMY_1…ARMY_N, excluding ARMY_17)'],['Assigned badge','Assigned markers vs. total markers']],
      tip: 'If any count is 0, the save.lua may not have been parsed — verify the map name and Maps Folder path in Settings.',
    },
    mapview: {
      title: 'Map View Canvas',
      desc: 'Interactive SVG canvas rendering all parsed markers. Mass extractors appear as circles, hydros as squares, army spawns as ACU icons with their army colour.',
      details: [['Left-click','Open the assignment popup for a marker'],['Right-click','Immediately clear a marker\'s assignment'],['Scroll','Zoom in / out around the cursor'],['Middle/Right drag','Pan the map view'],['Zoom >2.8×','Numeric labels appear on each marker']],
      tip: 'Zoom in to see individual marker numbers — useful when verifying assignments against the generated tables.lua.',
    },
    mirrormode: {
      title: 'Mirror Mode ⇌',
      desc: 'When active, assigning a marker also assigns its geometrically mirrored counterpart on the opposite side of the map centre.',
      details: [['Activate','Click the ⇌ Mirror button — it highlights when on'],['Mirror search','Nearest marker within 5% of map size at 180°-rotated position'],['No match','If no mirror is found, only the clicked marker is assigned'],['Popup badge','⇌ badge appears in the assignment popup header']],
      tip: 'Use Mirror Mode on symmetric maps to assign paired mass points in one click each.',
    },
    quickarmy: {
      title: 'Quick-Assign Buttons',
      desc: 'Selecting a Quick army button enters quick-assign mode. Clicking a marker then bypasses the popup and instantly assigns it to the selected army.',
      details: [['Select','Click an army button to activate (highlighted border)'],['Deselect','Click the same button again to exit quick mode'],['With Mirror','Quick + Mirror assigns marker and its mirror simultaneously'],['Popup mode','Without a quick army selected, left-click opens the popup']],
      tip: 'Quick-assign + Mirror Mode is the fastest workflow: select an army, enable mirror, click each pair once.',
    },
    assignpopup: {
      title: 'Assignment Popup',
      desc: 'Appears on left-click when no quick army is selected. Lists all playable armies — click one to assign, or Remove to clear.',
      details: [['Mass popup','Assigns as spawnMex — written to spwnMexArmy table'],['Hydro popup','Assigns as spawnHydro — written to spwnHydroArmy table'],['Active army','Currently assigned army shown with a ✓'],['⇌ badge','Mirror Mode is active — assignment also applies to the mirror']],
      tip: 'Right-click any marker to clear it instantly without opening the popup.',
    },
    previewbtn: {
      title: '🖼 Preview Button',
      desc: 'Loads a preview image as the map canvas background. Auto-extracts the DDS from the .scmap, or lets you upload a custom PNG/JPG/DDS.',
      details: [['Auto-load','Unpacks .scmap and extracts previewImage DDS on map load'],['Manual upload','Click the button and pick any image file'],['Opacity','Rendered at 55% opacity so markers stay visible'],['Pixelated','Nearest-neighbour rendering matches FA\'s visual style']],
      tip: 'A preview image makes marker assignment much faster — you see terrain context while clicking.',
    },
    generatebtn: {
      title: '⬡ Generate & Save All Files',
      desc: 'Validates configuration, optionally renames the folder to add the adaptive_ prefix, then writes all three Lua files directly into the map folder.',
      details: [['_tables.lua','spwnMexArmy / spwnHydroArmy tables — your assignments'],['_options.lua','FAF lobby option definitions (dynamic spawn, crazyrush)'],['_script.lua','Full adaptive map runtime — resource spawning & crazyrush logic'],['Auto-rename','Renames folder + patches all Lua & .scmap paths if adaptive_ is missing'],['Map name update','Input updates to the new full versioned name after rename']],
      tip: 'Safe to re-run any time — files are always overwritten cleanly.',
    },
    codetab: {
      title: '{ } tables.lua Code View',
      desc: 'After generation, shows the generated tables.lua content with a copy button. options.lua and script.lua are written silently.',
      details: [['tables.lua','Most frequently edited file — contains your marker assignments'],['Copy button','Copies tables.lua to clipboard for inspection or manual editing'],['Saved note','Confirms all 3 files were written to the map folder on disk']],
      tip: 'Use the code view to verify the Lua output before re-launching FA.',
    },
    adaptiveresult: {
      title: 'Adaptive Rename Status',
      desc: 'Appears after Generate when the map lacked the adaptive_ prefix. Shows the rename result.',
      details: [['✓ green','Folder renamed — file count and Lua patch count shown'],['✓ already','Map already had adaptive_ prefix — no rename needed'],['✕ red','Rename failed — check file permissions or naming conflicts']],
      tip: 'After a successful rename, the Map Name input is updated to the new full versioned name.',
    },
  };

  return (
    <>
      <div className="help-modal-overlay" onClick={onClose} />
      <div className="help-modal" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="help-modal-header">
          <h2 className="help-modal-title">⬡ Adaptive Map Helper — Help</h2>
          <button className="help-modal-close" onClick={onClose}>✕ Close</button>
        </div>

        {/* ── Tab bar ── */}
        <div className="help-modal-tabs">
          {TABS.map(t => (
            <button key={t.id}
              className={`help-modal-tab${activeTab === t.id ? ' active' : ''}`}
              onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="help-modal-content">

          {/* ══════ INTERFACE GUIDE ══════ */}
          {activeTab === 'guide' && (
            <div className="amh-guide-split">

              {/* Left — 1:1 replica */}
              <div className="amh-guide-replica">
                <div className="amh-guide-replica-hint">Click any element to learn what it does</div>

                {/* Header card */}
                <div className="amh-header-card" style={{ marginBottom: 20 }}>
                  <div className="amh-header-left">
                    <span className="amh-header-icon">⬡</span>
                    <div>
                      <div className="amh-header-title">Adaptive Map Helper</div>
                      <div className="amh-header-sub">ForgeMapToolkit</div>
                    </div>
                  </div>

                  <div className="amh-mapname-wrap"
                    onClick={() => setHelpSelected('mapname')}
                    style={{ cursor:'pointer', outline: helpSelected==='mapname' ? '2px solid var(--amh-accent)' : 'none' }}>
                    <label className="amh-form-label">Map Name</label>
                    <input readOnly onChange={()=>{}} className="amh-form-input" value="adaptive_Tartaron.v0006" style={{ pointerEvents:'none' }}/>
                    <div className="amh-map-info">✓ 512×512 px · 10 km · playable 500 px</div>
                  </div>

                  <div className="amh-adaptive-result ok"
                    onClick={() => setHelpSelected('adaptiveresult')}
                    style={{ cursor:'pointer', outline: helpSelected==='adaptiveresult' ? '2px solid var(--amh-accent)' : 'none' }}>
                    ✓ Renamed to adaptive_Tartaron.v0006 · 6 files · 4 Lua files patched
                  </div>

                  <div className="amh-header-stats"
                    onClick={() => setHelpSelected('statpills')}
                    style={{ cursor:'pointer', outline: helpSelected==='statpills' ? '2px solid var(--amh-accent)' : 'none' }}>
                    <div className="amh-stat-pill"><span>⬡</span><span>24</span></div>
                    <div className="amh-stat-pill"><span>⚡</span><span>4</span></div>
                    <div className="amh-stat-pill"><span>🤖</span><span>8</span></div>
                    <div className="amh-stat-pill amh-stat-pill--assigned"><span>16 / 28 assigned</span></div>
                  </div>
                </div>

                {/* Panel toolbar + canvas */}
                <div className="amh-canvas-panel" style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.07)' }}>
                  <div className="amh-panel-tabs">
                    <button className="amh-panel-tab active"
                      onClick={() => setHelpSelected('mapview')}
                      style={{ outline: helpSelected==='mapview' ? '2px solid var(--amh-accent)' : 'none' }}>
                      ⊞ Map View
                    </button>
                    <button className="amh-panel-tab"
                      onClick={() => setHelpSelected('codetab')}
                      style={{ outline: helpSelected==='codetab' ? '2px solid var(--amh-accent)' : 'none' }}>
                      {'{ }'} tables.lua
                    </button>
                    <div style={{ flex:1 }}/>
                    <button className="amh-preview-upload-btn"
                      onClick={() => setHelpSelected('previewbtn')}
                      style={{ outline: helpSelected==='previewbtn' ? '2px solid var(--amh-accent)' : 'none' }}>
                      🖼 Preview
                    </button>
                    <button className="amh-toolbar-toggle active"
                      onClick={() => setHelpSelected('mirrormode')}
                      style={{ outline: helpSelected==='mirrormode' ? '2px solid var(--amh-accent)' : 'none' }}>
                      ⇌ Mirror
                    </button>
                    <div className="amh-quick-army-wrap"
                      onClick={() => setHelpSelected('quickarmy')}
                      style={{ cursor:'pointer', outline: helpSelected==='quickarmy' ? '2px solid var(--amh-accent)' : 'none' }}>
                      <span className="amh-quick-label">Quick:</span>
                      {[['#ef0808',false],['#941421',true],['#ff8639',false],['#b56518',false]].map(([col,active],i) => (
                        <button key={i} className={`amh-quick-army-btn${active?' active':''}`}
                          style={{ '--qcol':col, pointerEvents:'none' }}>
                          <span className="amh-quick-army-label">ARMY_{i+1}</span>
                        </button>
                      ))}
                    </div>
                    <button className="amh-generate-btn-inline"
                      onClick={() => setHelpSelected('generatebtn')}
                      style={{ outline: helpSelected==='generatebtn' ? '2px solid var(--amh-accent)' : 'none' }}>
                      ⬡ Generate &amp; Save All Files
                    </button>
                  </div>

                  {/* Canvas area */}
                  <div onClick={() => setHelpSelected('mapview')}
                    style={{ position:'relative', height:260, background:'#0c1018', border:'1px solid rgba(255,140,0,0.1)', cursor:'pointer', outline: helpSelected==='mapview' ? '2px solid var(--amh-accent)' : 'none' }}>
                    <svg width="100%" height="100%" style={{ position:'absolute', inset:0 }}>
                      <polygon points="50,15 350,15 350,245 50,245" fill="#0c1018" stroke="rgba(255,140,0,0.18)" strokeWidth={1.5}/>
                      {[0.33,0.66].map(f=>(
                        <g key={f}>
                          <line x1={50+f*300} y1={15} x2={50+f*300} y2={245} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} strokeDasharray="4,4"/>
                          <line x1={50} y1={15+f*230} x2={350} y2={15+f*230} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} strokeDasharray="4,4"/>
                        </g>
                      ))}
                      {[[100,60,'#ef0808'],[250,60,'#941421'],[100,195,'#941421'],[250,195,'#ef0808'],[170,115,'#ff8639'],[180,145,'#ff8639']].map(([cx,cy,col],i)=>(
                        <g key={i}>
                          <circle cx={cx} cy={cy} r={10} fill="none" stroke={col} strokeWidth={1.5} opacity={0.8}/>
                          <circle cx={cx} cy={cy} r={4}  fill={col} opacity={0.55}/>
                        </g>
                      ))}
                      {[[140,130,'#81c784'],[210,130,'#81c784']].map(([cx,cy,col],i)=>(
                        <rect key={i} x={cx-8} y={cy-8} width={16} height={16} fill="none" stroke={col} strokeWidth={1.5} opacity={0.8}/>
                      ))}
                      {[[70,35,'#ef0808','1'],[330,35,'#941421','2'],[70,225,'#941421','2'],[330,225,'#ef0808','1']].map(([cx,cy,col,n],i)=>(
                        <g key={i}>
                          <circle cx={cx} cy={cy} r={13} fill={col} opacity={0.12}/>
                          <circle cx={cx} cy={cy} r={13} fill="none" stroke={col} strokeWidth={1.5} opacity={0.5}/>
                          <text x={cx} y={cy+4} textAnchor="middle" fill={col} fontSize={9} fontWeight={700} fontFamily="monospace">A{n}</text>
                        </g>
                      ))}
                    </svg>
                    {/* Inline popup sample */}
                    <div className="amh-popup"
                      onClick={e => { e.stopPropagation(); setHelpSelected('assignpopup'); }}
                      style={{ position:'absolute', right:12, top:10, width:155, cursor:'pointer', outline: helpSelected==='assignpopup' ? '2px solid var(--amh-accent)' : 'none' }}>
                      <div className="amh-popup-header">
                        <span className="amh-popup-htitle">Mass 07</span>
                        <span className="amh-popup-mirror-badge">⇌</span>
                      </div>
                      <div className="amh-popup-body">
                        <div className="amh-popup-army-list">
                          {[['ARMY_1','#ef0808',true],['ARMY_2','#941421',false]].map(([a,col,active])=>(
                            <button key={a} className={`amh-popup-army-btn${active?' active':''}`}
                              style={{'--army-color':col, pointerEvents:'none'}}>
                              <span style={{flex:1}}>{a}</span>
                              {active && <span style={{color:col}}>✓</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ position:'absolute', bottom:6, right:6, display:'flex', flexDirection:'column', gap:3 }}>
                      {['+','⊙','−'].map(l=>(
                        <button key={l} className="amh-zoom-btn" style={{ pointerEvents:'none' }}>{l}</button>
                      ))}
                    </div>
                    <div style={{ position:'absolute', bottom:8, left:10, fontSize:'0.68rem', color:'rgba(255,255,255,0.22)', fontFamily:'monospace' }}>
                      Click → assign · Right-click → clear · Scroll → zoom · Drag → pan
                    </div>
                  </div>
                </div>
              </div>{/* end replica */}

              {/* Right — info panel */}
              <div className="amh-guide-info">
                {!helpSelected ? (
                  <div className="amh-guide-empty">
                    <div style={{ fontSize:'3rem', opacity:0.2, color:'var(--amh-accent)' }}>←</div>
                    <div style={{ fontSize:'1rem', fontWeight:600, color:'rgba(255,255,255,0.28)', letterSpacing:'0.05em' }}>Select an element</div>
                    <div style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.15)', maxWidth:260, lineHeight:1.7, textAlign:'center' }}>
                      Click any field, button, or area on the left to learn what it does.
                    </div>
                  </div>
                ) : (() => {
                  const sel = UI_INFO[helpSelected];
                  if (!sel) return null;
                  return (
                    <div>
                      {/* Uses shared.css .help-adv-hero layout inline */}
                      <div style={{ marginBottom:28, paddingBottom:24, borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
                        <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'1.35rem', fontWeight:700, color:'#fff', margin:'0 0 10px', letterSpacing:'0.05em' }}>{sel.title}</h2>
                        <p style={{ fontSize:'0.88rem', color:'rgba(255,255,255,0.52)', lineHeight:1.75, margin:0 }}>{sel.desc}</p>
                      </div>
                      {/* Details table — shared.css .help-adv-ts-item style */}
                      <div className="help-adv-ts-item" style={{ marginBottom:16 }}>
                        {sel.details.map(([label, value], i) => (
                          <div key={i} style={{ display:'flex', gap:14, padding:'10px 20px', borderBottom:'1px solid rgba(255,255,255,0.05)', fontSize:'0.86rem', lineHeight:1.6 }}>
                            <strong style={{ color:'var(--amh-accent)', minWidth:130, flexShrink:0 }}>{label}:</strong>
                            <span style={{ color:'rgba(255,255,255,0.52)' }}>{value}</span>
                          </div>
                        ))}
                      </div>
                      {/* Tip — shared.css .help-adv-note */}
                      <div className="help-adv-note">
                        <strong>Tip: </strong>{sel.tip}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ══════ ADVANCED GUIDE ══════ */}
          {activeTab === 'advanced' && (
            <div className="help-adv-layout">

              {/* Sub-tab pills — shared.css .help-adv-subtabs */}
              <div className="help-adv-subtabs">
                {ADV_SUBTABS.map(t => (
                  <button key={t.id}
                    className={`help-adv-subtab${helpAdvSubTab===t.id?' active':''}`}
                    onClick={() => setHelpAdvSubTab(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── OVERVIEW ── */}
              {helpAdvSubTab==='overview' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Adaptive Map Helper</h2>
                    <p className="help-adv-hero-desc">
                      A tool for generating the three Lua files that power an Adaptive Map on FAF.
                      Adaptive Maps allow resources to spawn dynamically based on which player slots are
                      actually occupied, supporting different player counts on the same map without
                      pre-placing all extractors for every possible configuration.
                    </p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <div style={{ fontSize:'3rem', color:'var(--tab-color)', filter:'drop-shadow(0 0 20px var(--tab-glow))' }}>⬡</div>
                    <div style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.4)', textAlign:'center', lineHeight:1.6 }}>
                      Assign markers → Generate files → Upload to FAF Vault
                    </div>
                  </div>
                </div>

                <div className="help-adv-ts-grid">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>What the tool generates</h3>
                  {[
                    ['_tables.lua','The data file. Contains spwnMexArmy and spwnHydroArmy tables mapping each army slot to its list of mass/hydro marker numbers. The only file you need to manually edit post-generation if tweaking assignments.'],
                    ['_options.lua','Defines FAF lobby options: Dynamic Spawn mode (mirror / used slots / strict mirror) and Crazyrush. These appear in the lobby game options panel for the host to configure before the match.'],
                    ['_script.lua','The runtime logic. Overrides ScenarioUtils.CreateResources() to use your tables when deciding which markers to spawn. Also contains the full Crazyrush thread implementation.'],
                  ].map(([q,a])=>(
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q"><span className="help-adv-ts-icon">▸</span><strong>{q}</strong></div>
                      <div className="help-adv-ts-a"><p>{a}</p></div>
                    </div>
                  ))}
                </div>

                <div className="help-adv-ts-grid">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>The adaptive_ naming requirement</h3>
                  <div className="help-adv-ts-item">
                    <div className="help-adv-ts-a" style={{ paddingLeft:22 }}>
                      <p>FAF identifies an Adaptive Map by two criteria: the folder name must begin with <strong style={{color:'var(--tab-color)'}}>adaptive_</strong> and the _scenario.lua must contain <strong style={{color:'var(--tab-color)'}}>AdaptiveMap = true</strong>. Without these, the dynamic spawn logic never runs.</p>
                      <p style={{marginTop:10}}>When you click Generate on a map lacking the prefix, the tool performs a full rename: patches all internal Lua path strings, renames individual files, patches string references in the .scmap binary with correct length-prefixes, then renames the folder itself with up to 10 retries for Windows file-lock delays.</p>
                    </div>
                  </div>
                </div>

                <div className="help-adv-ts-grid">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">3</span>Dynamic spawn modes</h3>
                  {[
                    ['Mode 1 — Mirror slots (default)','Pairs are (ARMY_1,ARMY_2), (ARMY_3,ARMY_4), etc. Resources for a pair spawn if at least one army is present. The standard balanced mode for symmetric maps.'],
                    ['Mode 2 — Used slots only','Each army slot evaluated individually. Resources spawn only for actively occupied slots. Results in unbalanced resource counts on asymmetric fills.'],
                    ['Mode 3 — No mirror = no resources','Strictest mode. Resources for a pair spawn only if both armies are present. Ensures perfect resource symmetry at the cost of suppressing resources for lone-slot occupants.'],
                  ].map(([q,a])=>(
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q"><span className="help-adv-ts-icon">▸</span><strong>{q}</strong></div>
                      <div className="help-adv-ts-a"><p>{a}</p></div>
                    </div>
                  ))}
                </div>
              </>)}

              {/* ── WORKFLOW ── */}
              {helpAdvSubTab==='workflow' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Step-by-step Workflow</h2>
                    <p className="help-adv-hero-desc">Complete process from a raw map to a working Adaptive Map on FAF.</p>
                  </div>
                </div>
                <div className="help-adv-card-grid">
                  {[
                    ['01','Prepare markers in FA Editor','Create all mass extractor and hydrocarbon markers. Name them "Mass 01", "Mass 02", … and "Hydrocarbon 01", … — the tool parses these exact patterns from _save.lua. Place army spawns as ARMY_1…ARMY_N.'],
                    ['02','Set Maps Folder in Settings','In ForgeMapToolkit Settings, point the Maps Folder to the directory containing all your map folders (the /maps directory). Required for reading _save.lua and writing output files.'],
                    ['03','Enter the map name','Type the exact folder name into the Map Name input (e.g. Tartaron.v0006). The tool reads the _save.lua and displays all parsed markers on the canvas.'],
                    ['04','Assign markers to armies','For each mass and hydro marker, click it and assign to the army that "owns" that resource. Use Mirror Mode to speed up symmetric assignments. A mass assigned to ARMY_1 spawns when ARMY_1 is present.'],
                    ['05','Click Generate & Save All Files','Writes _tables.lua, _options.lua, and _script.lua. If the map lacks adaptive_, renames everything first. The Map Name input updates to the new versioned name.'],
                    ['06','Re-open in FA Editor and save','Open the renamed map in FA Editor and save once — this re-registers file paths with the new adaptive_ name in .scmap and .lua files managed by FA Editor directly.'],
                    ['07','Upload to FAF Vault','The map folder is now complete. Upload as usual. Players can configure Dynamic Spawn mode and Crazyrush in the lobby options panel.'],
                  ].map(([num,title,desc])=>(
                    <div key={num} className="help-adv-card">
                      <div className="help-adv-card-header">
                        <span className="help-adv-card-icon">{num}</span>
                        <h4>{title}</h4>
                      </div>
                      <div className="help-adv-card-body">
                        <p className="help-adv-card-desc">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>)}

              {/* ── TABLES.LUA FORMAT ── */}
              {helpAdvSubTab==='tables' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">tables.lua Format</h2>
                    <p className="help-adv-hero-desc">The data backbone of every Adaptive Map. Understanding its structure lets you edit assignments manually when needed.</p>
                  </div>
                </div>

                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>File structure</h3>
                  <div className="help-adv-code-block">
                    <code>{`--[[  Generated by ForgeMapToolkit - Adaptive Map Helper  ]]--\n\nmaxPlayerOnMap = 8\n\nspwnMexArmy = {\n    {1,2,3},     -- ARMY_1  (mass marker numbers)\n    {4,5,6},     -- ARMY_2\n    {7,8},       -- ARMY_3\n    {9,10},      -- ARMY_4\n    {},           -- ARMY_5  (empty = no markers)\n    {},           -- ARMY_6\n    {11,12},     -- ARMY_7\n    {11,12},     -- ARMY_8  (shared markers)\n}\n\nspwnHydroArmy = {\n    {1},          -- ARMY_1\n    {2},          -- ARMY_2\n    {},{},{},{},{},{},\n}`}</code>
                  </div>
                </div>

                <div className="help-adv-ts-grid">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>Key rules</h3>
                  {[
                    ['Array index = army slot','The 1st sub-table is ARMY_1, 2nd is ARMY_2, etc. Must have exactly maxPlayerOnMap entries — missing entries cause a Lua index error at runtime.'],
                    ['Marker numbers are integers','"Mass 07" → 7. "Hydrocarbon 03" → 3. Leading zeros in names are stripped. Numbers in the table must match the numeric suffix of the marker name in _save.lua.'],
                    ['Shared markers','The same number can appear in multiple army sub-tables. The marker spawns if any of those armies is present. Use carefully — unintentional sharing breaks resource balance.'],
                    ['Empty table = no resources','An empty {} means that army slot has no assigned resources. The slot can still be used by a player — they just receive no personal spawn resources.'],
                    ['maxPlayerOnMap','Must equal the number of ARMY_N slots (excluding ARMY_17). Controls the pair-logic in script.lua for mirror and strict-mirror modes.'],
                  ].map(([q,a])=>(
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q"><span className="help-adv-ts-icon">▸</span><strong>{q}</strong></div>
                      <div className="help-adv-ts-a"><p>{a}</p></div>
                    </div>
                  ))}
                </div>
              </>)}

              {/* ── SCRIPT.LUA LOGIC ── */}
              {helpAdvSubTab==='script' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">script.lua Logic</h2>
                    <p className="help-adv-hero-desc">The _script.lua overrides FA's default resource creation and adds optional Crazyrush behaviour. Here's exactly what happens at game start.</p>
                  </div>
                </div>

                <div>
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>OnStart / CreateResources execution order</h3>
                  <div className="help-adv-timeline">
                    {[
                      ['A','InitializeArmies','Called from OnPopulate — sets up all army slots as normal.'],
                      ['B','ListArmies + SpawnMex','Builds the present-armies list. SpawnMex lobby slots are treated as occupied even without a real player.'],
                      ['C','Absent army pairs','Depending on dynamic_spawn option, builds Notpresentarmies: pairs where neither/one/both army is absent.'],
                      ['D','Iterate all markers','Loops over every resource marker. Calls FalseIfInList to check if any absent army owns it.'],
                      ['E','SpawnResource','If the marker passes all checks, creates the mass/hydro splat, deposit, and prop.'],
                      ['F','Crazyrush thread','If crazyrush_mexes > 1, ForkThread(Crazyrush_checkMassPoint) starts — polling every 1 s for new extractors.'],
                    ].map(([num,title,desc])=>(
                      <div key={num} className="help-adv-step">
                        <div className="help-adv-step-num">{num}</div>
                        <div className="help-adv-step-content">
                          <h4>{title}</h4>
                          <p>{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="help-adv-ts-grid">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>Crazyrush mechanics</h3>
                  <div className="help-adv-ts-item">
                    <div className="help-adv-ts-a" style={{ paddingLeft:22 }}>
                      <p>Crazyrush spawns 4 additional mass spots adjacent to any extractor being built (±2 units on X and Z axes), creating a chain of mass generation as players expand. The thread polls all units every second, detects MASSEXTRACTION units, and calls <strong style={{color:'var(--tab-color)'}}>Crazyrush_TrySpawn</strong> on the four neighbouring positions.</p>
                      <p style={{marginTop:12}}>De-duplication is handled by <strong style={{color:'var(--tab-color)'}}>checkedExtractor</strong> (which extractors have been processed) and <strong style={{color:'var(--tab-color)'}}>generatedMass</strong> (which positions already had mass spawned). A fixed random seed (<strong style={{color:'var(--tab-color)'}}>math.randomseed(1)</strong>) ensures deterministic prop rotation angles across all clients for replayability.</p>
                    </div>
                  </div>
                </div>
              </>)}

              {/* ── TROUBLESHOOTING ── */}
              {helpAdvSubTab==='trouble' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Troubleshooting</h2>
                    <p className="help-adv-hero-desc">Common problems and their precise solutions.</p>
                  </div>
                </div>
                <div className="help-adv-ts-grid">
                  {[
                    ['Map shows 0 mass / hydro markers','The _save.lua was not found or could not be parsed. Verify: (1) the map name matches the folder name exactly, (2) the Maps Folder in Settings points to the parent /maps directory, (3) the _save.lua exists inside the map folder and contains named Mass / Hydrocarbon markers.'],
                    ['Rename fails with permission error','Windows holds a file handle on the folder (Explorer thumbnail cache, recent file access). Close any File Explorer windows showing the map folder and try Generate again. The tool retries up to 10 times with 300 ms gaps before giving up.'],
                    ['Target folder already exists error','A folder named adaptive_YourMap.vNNNN already exists at that path. Rename or delete the existing folder manually if it is an old version, then try again.'],
                    ['Resources don\'t spawn in-game','Check that: (1) the _scenario.lua contains AdaptiveMap = true, (2) the scenario script field references the correct _script.lua path, (3) all three generated files are present in the map folder with correct names.'],
                    ['Wrong number of resources spawn','The spwnMexArmy table indices don\'t match actual marker numbers in the save. Open the generated _tables.lua and compare numbers against marker names in _save.lua. Remember: "Mass 07" → 7, leading zeros are stripped.'],
                    ['Map appears non-adaptive in FAF vault','Both conditions must be met simultaneously: folder name starts with adaptive_ AND _scenario.lua has AdaptiveMap = true in the ScenarioInfo table. The auto-rename patches _scenario.lua — verify it was applied correctly.'],
                    ['Crazyrush not triggering','The crazyrush_mexes lobby option must be set to a value > 1. Default is 1 (disabled). If the option has no effect, verify _options.lua is present and that _script.lua reads ScenarioInfo.Options.crazyrush_mexes correctly.'],
                  ].map(([q,a])=>(
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q"><span className="help-adv-ts-icon">▸</span><strong>{q}</strong></div>
                      <div className="help-adv-ts-a"><p>{a}</p></div>
                    </div>
                  ))}
                </div>

                <div className="help-adv-practice-grid">
                  <h3 className="help-adv-section-header" style={{gridColumn:'1/-1'}}><span className="help-adv-section-num">✓</span>Best Practices</h3>
                  {[
                    ['⬡','Assign Before Generate','Complete all marker assignments before clicking Generate. Re-generating overwrites the tables cleanly, but partial assignments are easy to miss.'],
                    ['⇌','Use Mirror Mode Always','On any symmetric map, enable Mirror Mode from the start. It halves your click count and prevents asymmetric assignments caused by manual errors.'],
                    ['→','Test with FA first','After generating, open the map in FA singleplayer and verify resources spawn correctly before uploading to the FAF vault.'],
                    ['✓','Match your maxPlayerOnMap','The maxPlayerOnMap value in tables.lua must equal the actual number of army slots. Mismatches silently break the mirror-pair logic in script.lua.'],
                  ].map(([icon,title,desc])=>(
                    <div key={title} className="help-adv-practice-card">
                      <span className="help-adv-practice-icon">{icon}</span>
                      <h4>{title}</h4>
                      <p>{desc}</p>
                    </div>
                  ))}
                </div>
              </>)}

            </div>
          )}

        </div>{/* end help-modal-content */}
      </div>
    </>
  );
}
export default AMHHelpModal;
