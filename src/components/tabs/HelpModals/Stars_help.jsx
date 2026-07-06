import React from "react";

const EX_RES = 800;
const UV_RES = 400;

function Toggle({ checked, onChange, label }) {
  return (
    <label className="st-toggle-label">
      <input type="checkbox" className="st-toggle-input" checked={checked} onChange={onChange}/>
      <span className="st-toggle-track"><span className="st-toggle-thumb"/></span>
      {label && <span className="st-toggle-text">{label}</span>}
    </label>
  );
}

function StarsHelpModal({ onClose, activeHelpTab, setActiveHelpTab, helpSelected, setHelpSelected, activeAdvSubTab, setActiveAdvSubTab, setExclusionZones }) {

  const INFO = {
    mapname:        { title: 'Map Name',                desc: 'The exact name of your map folder in /maps. Used to build all output paths.',                                         details: [['Format','MapName.vXXXX — e.g. Hades_Dust.v0002'],['Auto-version','.v0001 appended if omitted'],['Case-sensitive','FA is strict — must match folder name']], tip: 'Copy the folder name directly from File Explorer.' },
    stars:          { title: 'Stars',                   desc: 'Total number of star props to place. Split between cluster stars and background stars by Background Ratio.',          details: [['Range','Typically 20–200'],['Performance','More stars = larger Lua file'],['Distribution','Background Ratio controls how many are background vs cluster']], tip: 'Start at 50 and adjust after previewing.' },
    clusters:       { title: 'Clusters',                desc: 'Number of random cluster centers to generate. Stars placed in cluster mode are attracted to these centers.',          details: [['Effect','More clusters = more spread-out groupings'],['Typical','5–20 for natural results'],['Position','Each cluster center is randomly placed within spread']], tip: 'Use fewer clusters (3–5) for a dense focal formation.' },
    spread:         { title: 'Cluster Spread',          desc: 'Half-width of the placement area in game units. Stars and cluster centers are placed within ±Spread on X and Z.',    details: [['Units','Game world units (same as FA coordinates)'],['Typical','10000–20000 for large sky fields'],['Exclusion','Exclusion zones are also relative to this space']], tip: 'Match to your map size — too small looks crowded, too large looks sparse.' },
    stddev:         { title: 'Cluster Std Dev',         desc: 'Standard deviation of the gaussian distribution used to scatter stars around each cluster center.',                   details: [['Low','Stars tightly packed around center'],['High','Stars spread loosely around center'],['Typical','1000–3000']], tip: 'Use low stddev for tight star clusters, high for diffuse nebula-like spread.' },
    bgratio:        { title: 'Background Ratio',        desc: 'Fraction of stars placed randomly across the full spread (background field) vs attracted to cluster centers.',        details: [['0.0','All stars in clusters'],['1.0','All stars background (no clustering)'],['0.45','Default — balanced mix']], tip: '0.3–0.5 gives a natural feel with visible clusters against a sparse field.' },
    scale:          { title: 'Scale Min / Max',         desc: 'UniformScale range for placed star props. Each star gets a random scale within this range, adjusted by distance.',    details: [['Min','Smallest possible scale'],['Max','Largest possible scale'],['Distance','Stars farther from center are slightly smaller']], tip: 'Keep the range narrow (e.g. 10–20) for uniform fields, wide (5–40) for varied depth.' },
    ymode:          { title: 'Y-Distribution Mode',     desc: 'Controls the vertical height distribution of placed stars. Different modes produce different sky profiles.',          details: [['Flat','All stars below Max Height — uniform vertical spread'],['Gaussian','Bell curve centered at Y Center'],['Layered','Multiple gaussian bands — define each manually'],['Disk+Halo','Thin disk + diffuse halo — galaxy-like'],['Curve','Custom probability curve drawn interactively']], tip: 'Flat is fastest to configure. Use Disk+Halo for a realistic galaxy-plane effect.' },
    yclusterscatter:{ title: 'Cluster Y Scatter',       desc: 'Additional random vertical offset applied to cluster stars. Adds vertical spread within each cluster.',              details: [['0','All cluster stars at same Y as their center'],['200','Moderate vertical scatter'],['Effect','Prevents clusters from appearing as flat horizontal discs']], tip: 'Keep at 100–300 for natural-looking 3D clusters.' },
    ymax:           { title: 'Max Height',              desc: 'Upper bound on star Y coordinate. Stars are clamped to this value regardless of other Y settings.',                   details: [['Units','Game world Y units'],['Typical','1000–3000 for most FA maps'],['Clamp','Acts as a ceiling for all Y modes']], tip: 'Set to roughly double your map terrain height for stars to appear clearly above terrain.' },
    seed:           { title: 'Seed Control',            desc: 'Controls whether placement uses a fixed seed (reproducible) or a random seed each generation.',                       details: [['Fixed','Same seed = identical output every run'],['Random','New positions each generation'],['Randomize','Pick a random seed but lock it in — reproducible from that point']], tip: 'Fix the seed once you are happy with placement to make re-generation safe.' },
    uv:             { title: 'UV Texture Row',          desc: 'Defines a texture atlas region (x, y, z, w) from which a star sprite is sampled. One row = one sprite variant.',    details: [['X/Y','Bottom-left corner of the UV rect in texture space (0–1)'],['Z/W','Width and height of the UV rect'],['Multiple rows','Stars randomly pick one row per placement']], tip: 'Use 0.5×0.5 tiles on a 2×2 atlas for 4 distinct star shapes.' },
    uvweight:       { title: 'UV Weight',               desc: 'Relative probability that a given UV row is selected for each placed star. Higher weight = more common.',             details: [['Equal','Same weight for all rows = uniform distribution'],['Unequal','Bias toward specific sprite variants'],['Normalised','Weights are normalised — absolute values do not matter, only ratios']], tip: 'Give your most generic star sprite a higher weight and rare variants a low weight.' },
    generate:       { title: 'Generate Stars',          desc: 'Validates all settings and injects CreateRotatedProp() calls into your map file for all generated stars.',           details: [['Output','Appended to existing _script.lua or written to new file'],['Re-run safe','Running again replaces previous star block'],['Requires','Map Name + Maps Folder set in Settings']], tip: 'Preview on the UV canvas first to check distribution before generating.' },
    exenabled:      { title: 'Exclusion Zones Toggle',  desc: 'Enables or disables all exclusion zones at once. Disabled zones are ignored during generation but not deleted.',   details: [['Enabled','All committed zones block star placement'],['Disabled','Stars can spawn anywhere regardless of zones'],['Non-destructive','Zones are preserved when toggled off']], tip: 'Toggle off to temporarily preview the distribution without exclusion.' },
    zonelist:       { title: 'Zone List',               desc: 'Shows all committed exclusion zones. Click a zone to highlight it on the canvas and see its world coordinates.',     details: [['Click','Jumps to and highlights the zone on the canvas'],['Coords','World-space X/Z range shown when selected'],['×','Deletes just that zone, others remain']], tip: 'Name zones by their order — Zone 1 is usually the map centre safe zone.' },
    confirmbar:     { title: 'Confirm Zone Bar',        desc: 'Appears after drawing a zone on the canvas. The zone is pending — it does not block stars until confirmed.',         details: [['Confirm','Adds the zone to the list and enables it immediately'],['Discard','Removes the draft without saving'],['Purple','Draft zones shown in purple on canvas until confirmed']], tip: 'You can draw and discard freely — only confirmed zones affect generation.' },
    excanvas:       { title: 'Exclusion Zone Canvas',   desc: 'Drag to draw a new exclusion zone. Shows all committed zones (red) and the current draft zone (purple).',           details: [['Draw','Click and drag to define a rectangular zone'],['Red zones','Committed — actively blocking star placement'],['Purple zone','Draft — pending confirmation'],['Union','Overlapping/adjacent zones merge into a single outlined shape']], tip: 'Draw zones over terrain features (lakes, bases, roads) where stars look wrong.' },
    uvupload:       { title: 'Upload Texture Preview',  desc: 'Upload your star texture atlas image to preview UV rectangles overlaid on the actual texture.',                      details: [['Formats','PNG, JPG, WEBP, DDS'],['Purpose','Visual check that UV rows point to correct sprite cells'],['Optional','Canvas works without it — just shows colored rects']], tip: 'Export the texture from your FA mod folder for an accurate preview.' },
    uvopacity:      { title: 'UV Overlay Opacity',      desc: 'Controls how transparent the UV rectangle fills are drawn over the texture canvas.',                                  details: [['0','Only border strokes visible'],['0.25','Default — semi-transparent fill'],['1','Fully opaque fill — may obscure texture']], tip: 'Lower opacity to see the underlying texture while still identifying UV regions.' },
    uvcanvas:       { title: 'UV Visualization Canvas', desc: 'Shows all UV rows as numbered colored rectangles on a grid, optionally overlaid on your uploaded texture.',       details: [['Numbered','Each rect labeled 1–N matching the table row'],['Colors','Each row gets a distinct color for easy identification'],['Grid','0,0 bottom-left to 1,1 top-right (FA UV space)']], tip: 'Check that all UV rects are within 0–1 bounds and cover distinct atlas regions.' },
  };

  const renderInfoPanel = () => {
    const sel = INFO[helpSelected];
    if (!sel) return null;
    return (
      <div className="help-info-panel">
        <div className="help-info-hero">
          <h2 className="help-info-title">{sel.title}</h2>
          <p className="help-info-desc">{sel.desc}</p>
        </div>
        <div className="help-info-details-box">
          <ul className="help-info-details-list">
            {sel.details.map(([label, value], i) => (
              <li key={i}><strong>{label}</strong><span>{value}</span></li>
            ))}
          </ul>
        </div>
        <div className="help-info-note">
          <strong>Tip: </strong>{sel.tip}
        </div>
      </div>
    );
  };

  return (
    <>
          <div className="help-modal-overlay" onClick={onClose} />
          <div className="help-modal"
            style={{ '--tab-color': 'var(--stars-color)', '--tab-glow': 'var(--stars-glow)', '--tab-glow-strong': 'var(--stars-glow-strong)' }}
            onClick={e => e.stopPropagation()}>

            <div className="help-modal-header">
              <h2 className="help-modal-title">Stars Tab — Help Guide</h2>
              <button className="help-modal-close" onClick={onClose}>×</button>
            </div>

            <div className="help-modal-tabs">
              {[['guide','Help Guide'],['advanced','Advanced Guide']].map(([id,label]) => (
                <button key={id}
                  className={`help-modal-tab${activeHelpTab === id ? ' active' : ''}`}
                  onClick={() => { setActiveHelpTab(id); setHelpSelected(null); }}
                >{label}</button>
              ))}
            </div>

            <div className="help-modal-content">

              {/* ═══ HELP GUIDE TAB ═══ */}
              {activeHelpTab === 'guide' && (
                <div style={{ display: 'flex', gap: '40px', height: '100%' }}>

                  {/* LEFT: replica */}
                  <div style={{ flex: '0 0 auto', overflowY: 'auto', paddingRight: '20px', borderRight: '1px solid rgba(255,255,255,0.06)', maxWidth: '1200px' }}>
                    <div style={{ padding: '8px 0 14px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--stars-color)', fontSize: '1rem', opacity: 0.6 }}>↗</span> Click any element to learn about it
                    </div>

                    <div className="tab-grid" style={{ gridTemplateColumns: 'auto 1fr', maxWidth: 'none', margin: 0 }}>

                      {/* CONFIG COLUMN */}
                      <div className="tab-col-config" style={{ width: '420px' }}>

                        {/* Configuration card */}
                        <div className="section-card">
                          <div className="st-card-header">
                            <h2 className="section-title">CONFIGURATION</h2>
                            <button className="btn-ghost" style={{ pointerEvents: 'none' }}>Reset</button>
                          </div>

                          <div className="subsection-title">Map Details</div>
                          <div className="form-group" style={{ cursor: 'pointer', outline: helpSelected === 'mapname' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                            onClick={() => setHelpSelected('mapname')}>
                            <label>Map Name</label>
                            <input readOnly onChange={() => {}} className="form-input" placeholder="e.g. Hades_Dust.v0002" />
                          </div>

                          <hr className="st-subsection-divider"/>
                          <div className="subsection-title">Star Configuration</div>
                          <div className="st-config-grid">
                            {[['stars','Stars','50'],['clusters','Clusters','10'],['spread','Cluster Spread','14000'],['stddev','Cluster Std Dev','1800'],['bgratio','Background Ratio','0.45']].map(([key,lbl,ph]) => (
                              <div key={key} className="form-group" style={{ cursor: 'pointer', outline: helpSelected === key ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                                onClick={() => setHelpSelected(key)}>
                                <label>{lbl}</label>
                                <input readOnly onChange={() => {}} className="form-input" placeholder={ph} />
                              </div>
                            ))}
                            <div className="form-group" style={{ cursor: 'pointer', outline: helpSelected === 'scale' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                              onClick={() => setHelpSelected('scale')}>
                              <label>Scale Min / Max</label>
                              <div className="st-split-input">
                                <input readOnly onChange={() => {}} className="form-input" placeholder="10" />
                                <input readOnly onChange={() => {}} className="form-input" placeholder="30" />
                              </div>
                            </div>
                          </div>

                          <div style={{ marginTop: '18px' }}>
                            <div className="subsection-title" style={{ marginBottom: '14px' }}>Y-Distribution</div>
                            <div className="form-group" style={{ cursor: 'pointer', outline: helpSelected === 'ymode' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                              onClick={() => setHelpSelected('ymode')}>
                              <label>Mode</label>
                              <input readOnly onChange={() => {}} className="form-input" value="flat" />
                            </div>
                            <div className="form-group" style={{ cursor: 'pointer', outline: helpSelected === 'yclusterscatter' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                              onClick={() => setHelpSelected('yclusterscatter')}>
                              <label>Cluster Y Scatter</label>
                              <input readOnly onChange={() => {}} className="form-input" placeholder="200" />
                            </div>
                            <div className="form-group" style={{ cursor: 'pointer', outline: helpSelected === 'ymax' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                              onClick={() => setHelpSelected('ymax')}>
                              <label>Max Height</label>
                              <input readOnly onChange={() => {}} className="form-input" placeholder="1500" />
                            </div>
                          </div>

                          <hr className="st-subsection-divider"/>
                          <div className="subsection-title">Seed Control</div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                            <div style={{ cursor: 'pointer', outline: helpSelected === 'seed' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                              onClick={() => setHelpSelected('seed')}>
                              <Toggle checked={false} onChange={() => {}} label="Random" />
                            </div>
                          </div>
                          <div className="st-seed-row" style={{ cursor: 'pointer', outline: helpSelected === 'seed' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                            onClick={() => setHelpSelected('seed')}>
                            <input readOnly onChange={() => {}} className="form-input" placeholder="42" style={{ opacity: 0.4 }} />
                            <button className="btn-ghost" style={{ pointerEvents: 'none' }}>Randomize</button>
                          </div>
                        </div>

                        {/* UV Texture card */}
                        <div className="section-card">
                          <div className="st-card-header">
                            <h2 className="section-title">UV TEXTURE</h2>
                          </div>
                          <div className="st-uv-table-header">
                            <div className="st-uv-col-color"/>
                            {['X','Y','Z','W'].map(h => <div key={h} className="st-uv-col-field">{h}</div>)}
                            <div className="st-uv-col-weight">Weight</div>
                            <div className="st-uv-col-del"/>
                          </div>
                          {[['#00DDFF','0.0','0.0','0.5','0.5','0.25'],['#A5E801','0.5','0.0','0.5','0.5','0.25']].map(([color,...vals], i) => (
                            <div key={i} className="st-uv-table-row" style={{ cursor: 'pointer', outline: helpSelected === 'uv' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '1px' }}
                              onClick={() => setHelpSelected('uv')}>
                              <div className="st-uv-col-color"><div className="st-uv-legend-dot" style={{ background: color, border: `1.5px solid ${color}` }}/></div>
                              {vals.slice(0,4).map((v,j) => <div key={j} className="st-uv-col-field"><input readOnly onChange={() => {}} className="form-input st-uv-cell-input" value={v}/></div>)}
                              <div className="st-uv-col-weight"><input readOnly onChange={() => {}} className="form-input st-uv-cell-input" value={vals[4]}/></div>
                              <div className="st-uv-col-del"/>
                            </div>
                          ))}
                          <div className="st-uv-table-row" style={{ cursor: 'pointer', outline: helpSelected === 'uvweight' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '1px', opacity: 0.5 }}
                            onClick={() => setHelpSelected('uvweight')}>
                            <div className="st-uv-col-color"><div className="st-uv-legend-dot" style={{ background: '#888' }}/></div>
                            {['0.0','0.5','0.5','0.5'].map((v,j) => <div key={j} className="st-uv-col-field"><input readOnly onChange={() => {}} className="form-input st-uv-cell-input" value={v}/></div>)}
                            <div className="st-uv-col-weight"><input readOnly onChange={() => {}} className="form-input st-uv-cell-input" value="0.25"/></div>
                            <div className="st-uv-col-del"/>
                          </div>
                        </div>

                        <button className="btn-primary btn-lg" style={{ width: '100%', cursor: 'pointer', outline: helpSelected === 'generate' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                          onClick={() => setHelpSelected('generate')}>
                          Generate Stars
                        </button>
                      </div>

                      {/* RIGHT COLUMN — Exclusion + UV vis */}
                      <div className="tab-col-detail">

                        {/* Exclusion Zones card */}
                        <div className="section-card">
                          <div className="st-card-header">
                            <h2 className="section-title">EXCLUSION ZONES</h2>
                            <div className="st-ex-header-actions">
                              <div style={{ cursor: 'pointer', outline: helpSelected === 'exenabled' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                                onClick={() => setHelpSelected('exenabled')}>
                                <Toggle checked={true} onChange={() => {}} label="Enabled" />
                              </div>
                              <button className="btn-delete" style={{ pointerEvents: 'none', opacity: 0.5 }}>Clear All</button>
                            </div>
                          </div>

                          {/* Zone list */}
                          <div className="st-ex-zone-list" style={{ cursor: 'pointer', outline: helpSelected === 'zonelist' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                            onClick={() => setHelpSelected('zonelist')}>
                            {[1,2].map(i => (
                              <div key={i} className={`st-ex-zone-item${i === 1 ? ' active' : ''}`}>
                                <span className="st-ex-zone-label">Zone {i}</span>
                                {i === 1 && <code className="st-ex-zone-coords">X -4200 → 1800   Z -3100 → 2400</code>}
                                <button className="st-ex-zone-delete" style={{ pointerEvents: 'none' }}>×</button>
                              </div>
                            ))}
                          </div>

                          {/* Draft confirm bar */}
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            marginBottom: '12px', padding: '9px 14px',
                            background: 'rgba(138,18,189,0.08)',
                            border: '1px solid rgba(138,18,189,0.35)',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            outline: helpSelected === 'confirmbar' ? '2px solid var(--tab-color)' : 'none',
                            outlineOffset: '2px',
                          }} onClick={() => setHelpSelected('confirmbar')}>
                            <span style={{flex:1, color:'rgba(220,180,255,0.85)'}}>
                              New zone drawn — confirm to add it.
                            </span>
                            <button className="btn-library" style={{ pointerEvents: 'none' }}>Confirm</button>
                            <button className="btn-delete" style={{ pointerEvents: 'none' }}>Discard</button>
                          </div>

                          {/* Canvas */}
                          <div style={{ cursor: 'crosshair', outline: helpSelected === 'excanvas' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                            onClick={() => setHelpSelected('excanvas')}>
                            <div className="st-ex-wrap" style={{ pointerEvents: 'none' }}>
                              <canvas width={EX_RES} height={EX_RES} className="st-ex-canvas"
                                style={{ background: '#08080f' }} />
                            </div>
                          </div>
                        </div>

                        {/* UV Visualization card */}
                        <div className="section-card">
                          <div className="st-card-header" style={{ marginBottom: '14px' }}>
                            <h2 className="section-title">UV VISUALIZATION</h2>
                          </div>
                          <div className="st-upload-area" style={{ cursor: 'pointer', outline: helpSelected === 'uvupload' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                            onClick={() => setHelpSelected('uvupload')}>
                            <span className="st-upload-icon"></span>
                            <span>Upload texture preview</span>
                          </div>
                          <div className="form-group" style={{ cursor: 'pointer', marginTop: '14px', outline: helpSelected === 'uvopacity' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                            onClick={() => setHelpSelected('uvopacity')}>
                            <label>UV Overlay Opacity</label>
                            <div className="st-opacity-row">
                              <input type="range" min="0" max="1" step="0.01" defaultValue="0.25" className="st-range-slider" style={{ pointerEvents: 'none' }}/>
                              <input readOnly onChange={() => {}} className="form-input st-opacity-input" value="0.25" />
                            </div>
                          </div>
                          <div style={{ cursor: 'pointer', outline: helpSelected === 'uvcanvas' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                            onClick={() => setHelpSelected('uvcanvas')}>
                            <canvas width={UV_RES} height={UV_RES} className="st-uv-canvas"
                              style={{ background: '#0e0e14', pointerEvents: 'none' }} />
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* RIGHT: info panel */}
                  <div style={{ flex: '1', overflowY: 'auto', maxHeight: '80vh' }}>
                    {!helpSelected ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', opacity: 0.4, color: 'var(--stars-color)' }}>↖</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>Select an element</div>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.2)', maxWidth: '240px', lineHeight: 1.7 }}>Click any field, button, or section on the left to learn what it does.</div>
                      </div>
                    ) : renderInfoPanel()}
                  </div>
                </div>
              )}

              {/* ═══ ADVANCED GUIDE TAB ═══ */}
              {activeHelpTab === 'advanced' && (
                <div className="help-adv-layout">
                  <div className="help-adv-subtabs">
                    {[
                      { id: 'workflow',   label: 'Workflow' },
                      { id: 'prng',       label: 'RNG & Seed' },
                      { id: 'placement',  label: 'Placement Algorithm' },
                      { id: 'ydist',      label: 'Y-Distribution' },
                      { id: 'scale',      label: 'Scale & Brightness' },
                      { id: 'uv',         label: 'UV System' },
                      { id: 'exclusion',  label: 'Exclusion Zones' },
                      { id: 'output',     label: 'Output & Inject' },
                    ].map(t => (
                      <button key={t.id}
                        className={`help-adv-subtab${activeAdvSubTab === t.id ? ' active' : ''}`}
                        onClick={() => setActiveAdvSubTab(t.id)}
                      >{t.label}</button>
                    ))}
                  </div>

                  {/* ── WORKFLOW ── */}
                  {activeAdvSubTab === 'workflow' && (<>
                    <div className="help-adv-hero">
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">Full Workflow Overview</h2>
                        <p className="help-adv-hero-desc">The Stars Tab generates FA star props using a seeded gaussian cluster model. Every star becomes a CreateRotatedProp() entry injected directly into your map’s data.lua inside the skyBox → planets block. The full pipeline: configure → UV setup → exclusion zones → generate → inject into .scmap.</p>
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Step-by-Step Process</h3>

                      {/* Simple summary */}
                      <div className="help-adv-summary">
                        <div className="help-adv-summary-title">Quick Overview</div>
                        <strong>1. Map Name + Folder</strong> — set the target map. &nbsp;
                        <strong>2. Star Parameters</strong> — count, clusters, spread, scale. &nbsp;
                        <strong>3. Y-Distribution</strong> — control vertical height per star. &nbsp;
                        <strong>4. UV Rows</strong> — define sprite atlas regions + weights. &nbsp;
                        <strong>5. Exclusion Zones</strong> — block placement in specific areas. &nbsp;
                        <strong>6. Generate</strong> — inject into .scmap via IPC pipeline.
                      </div>

                      {/* Detailed grid — 3×2 so cards don’t stretch */}
                      <div className="help-adv-timeline--grid">
                        {[
                          { n:'01', title:'Map Name + Maps Folder', desc:'Map Name must exactly match your /maps subfolder including the version suffix. Maps Folder is set once in Settings and persists across sessions.', subs:['Wrong name → output written to wrong path','Auto-appends .v0001 if no version suffix detected','Maps Folder path read from settings at generation time'] },
                          { n:'02', title:'Star & Cluster Parameters', desc:'Configure the core placement parameters. Every value feeds directly into the placement algorithm with no intermediate processing.', subs:['Stars: total CreateRotatedProp entries in output','Clusters: number of gaussian center points','Spread: ±N in X and Z world space','Background Ratio: bg vs cluster coin-flip per star'] },
                          { n:'03', title:'Y-Distribution Mode', desc:'Controls vertical height sampling per star. Y is sampled independently for background stars, cluster centers, and cluster stars.', subs:['All modes: result clamped to [0, yMax]','Cluster stars get extra uniform Y scatter on top','Mode does not affect X/Z placement'] },
                          { n:'04', title:'UV Texture Rows', desc:'Each row defines one sprite region (x, y, z, w) in the texture atlas. Stars randomly pick a row per placement, weighted by the Weight column.', subs:['Table converts to two internal strings at generation','Row count must match between options and weights','parseUvOptions() + parseWeights() parse at runtime'] },
                          { n:'05', title:'Exclusion Zones', desc:'Rectangular no-go areas in world space. Each confirmed zone is stored as normalised canvas coords and checked per candidate star.', subs:['AABB check — O(zones) per star, no RNG consumed','Stars failing any zone are discarded, attempt++ ','Max 50×nStars attempts before giving up'] },
                          { n:'06', title:'Generate & Inject', desc:'Runs a 7-step IPC pipeline: find .scmap → unpack → read data.lua → inject into planets block → write → repack → copy back.', subs:['History snapshots taken before and after','planets block found via regex inside skyBox','Re-run appends — does not replace existing entries'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num">{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4>
                              <p>{s.desc}</p>
                              {s.plain && <div className="help-plain" style={{marginTop:'8px', marginBottom:'8px'}}><span className="help-plain-icon">💬</span><span>{s.plain}</span></div>}
                              <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Best Practices</h3>
                      <div className="help-adv-practice-grid">
                        {[
                          ['Fix Seed Before Final Generate','Once placement looks right, enable Fixed Seed. Without it, every re-run produces different positions — re-runs are destructive because output appends to the planets block.'],
                          ['Always Exclusion-Zone the Origin','Stars near (0,0,0) appear on the ground plane in-game. Draw at minimum a ±2000 zone around center before generating.'],
                          ['Match Spread to Map','Spread ≈ mapSize × 7 is a good starting point. A 256-map (5km) works well at Spread 10000; a 1024-map at 14000–20000.'],
                          ['Use 2–4 UV Rows, Not 1','One row = uniform appearance. Even two slightly-different sprites break the repetition. Four rows across a 2×2 atlas is the standard setup.'],
                          ['Start with 50 Stars','50 stars at default settings gives a readable preview. Scale up in steps of 20–30, preview each time. 150+ stars starts to look overcrowded on most maps.'],
                          ['Layered Y for Depth','A Layered Y with a low-altitude dense band + a high-altitude sparse band creates convincing depth that Flat cannot achieve.'],
                        ].map(([title, desc]) => (
                          <div key={title} className="help-adv-practice-card">
                            <span className="help-adv-practice-icon">
                              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                                <circle cx="13" cy="13" r="11" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/>
                                <path d="M8 13l3.5 3.5 6.5-7" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </span>
                            <h4>{title}</h4><p>{desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Troubleshooting</h3>
                      <div className="help-adv-ts-grid">
                        {[
                          ['Stars not visible in-game','data.lua planets block must be referenced by your map. Also check Y Max — stars below terrain height are invisible.'],
                          ['Stars appear on the ground','Y Max too low, or no exclusion zone around origin. Stars at Y < ~50 intersect terrain.'],
                          ['Output changes every run','Fixed Seed is off. Enable it and lock in a seed before final generation.'],
                          ['Re-run added duplicate stars','Generate appends to the existing planets block. Clear the planets block in data.lua before re-running, or use the history system to revert.'],
                          ['Error: UV options and weights count mismatch','The number of UV rows and the number of weight rows must be equal. Check for blank lines or extra rows in either field.'],
                          ['Error: planets-Sektion nicht gefunden','The skyBox → planets block is missing or malformed in data.lua. Open data.lua and verify the structure manually.'],
                          ['Stars all clustered in one area','Spread is too low relative to map size, or Background Ratio is 0 (all cluster mode with few clusters).'],
                          ['Placement attempt limit hit (fewer stars than requested)','Exclusion zones cover too much of the map, or Spread is too small. Reduce zone size or increase Spread.'],
                        ].map(([q,a]) => (
                          <div key={q} className="help-adv-ts-item">
                            <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                            <div className="help-adv-ts-a">{a}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>)}

                  {/* ── PRNG & SEED ── */}
                  {activeAdvSubTab === 'prng' && (<>
                    <div className="help-adv-hero">
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">RNG & Seed System</h2>
                        <p className="help-adv-hero-desc">All randomness flows through a single RNG instance — either a seeded deterministic generator (mulberry32) or Math.random. Every draw is consumed in a fixed sequence, so a given seed always produces the exact same output.</p>
                      <div className="help-plain"><span className="help-plain-icon">💬</span><span><strong>In plain words:</strong> Think of the seed as a recipe number. Give the app the same recipe number and it bakes the exact same star field every time. Change even one ingredient (like the number of clusters) and the whole recipe shifts — every star ends up somewhere different.</span></div>
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>mulberry32 Algorithm</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'8px'}}>When Fixed Seed is enabled, the generator is <strong>mulberry32</strong> — a fast 32-bit PRNG that takes a seed number and produces a float between 0 and 1 per call.</p>
                      <div className="help-plain" style={{marginBottom:'16px'}}><span className="help-plain-icon">💬</span><span><strong>In plain words:</strong> A PRNG (Pseudo-Random Number Generator) is a mathematical machine that given a starting number produces a long stream of seemingly random numbers. "32-bit" just means it works with numbers up to about 4 billion. The seed is the starting number — same seed, same stream.</span></div>
                      <div className="help-adv-timeline">
                        {[
                          { n:'①', title:'State update', desc:'s = (s + 0x6D2B79F5) | 0 — the internal state advances by a fixed constant each call, cycling through all 2³² possible states before repeating.', plain:'The generator has an internal counter that ticks forward by the same amount every time you ask for a number. On its own this would be too predictable — that is why the next step scrambles it.', subs:['0x6D2B79F5 is a carefully chosen odd constant','|0 keeps arithmetic within 32-bit range','Called the Weyl sequence — guarantees no state repeats for 4 billion calls'] },
                          { n:'②', title:'Bit mixing', desc:'t = imul(s ^ s>>>15, 1|s); t = (t+imul(t^t>>>7, 61|t))^t — two rounds of xorshift + multiply scramble the counter into an unpredictable number.', plain:'The counter from step ① is run through two scrambling operations that flip bits around so the output looks completely random even though the counter is perfectly predictable. XOR and bit-shifting are standard techniques for mixing bits in cryptography and game engines.', subs:['>>>15 and >>>7 are bit-shift operations that scatter the value','imul is 32-bit integer multiplication — fast and lossy by design','Result passes standard randomness quality tests (BigCrush)'] },
                          { n:'③', title:'Output', desc:'(t >>> 0) ÷ 4294967296 — converts the scrambled integer to an unsigned number, then divides by 2³² to get a decimal between 0 and 1.', plain:'The scrambled number from step ② is in a weird signed-integer form. This step converts it to a clean decimal like 0.3271 or 0.9814. That decimal is what the rest of the algorithm uses to make decisions — is this star background or cluster? Which sprite does it use? Where exactly does it land?', subs:['Result is always in [0, 1) — never reaches exactly 1.0','Each call produces one independent decimal','Uniform distribution: every value equally likely'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'1.1rem'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4>
                              <p>{s.desc}</p>
                              {s.plain && <div className="help-plain" style={{marginTop:'8px', marginBottom:'8px'}}><span className="help-plain-icon">💬</span><span>{s.plain}</span></div>}
                              <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Gaussian Sampling (Box-Muller)</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'8px'}}>Cluster scatter and several Y-distribution modes need numbers that follow a bell curve — most values near the center, fewer at the extremes. The implementation uses the <strong>Box-Muller transform</strong> to convert two uniform randoms into one bell-curve random.</p>
                      <div className="help-plain" style={{marginBottom:'16px'}}><span className="help-plain-icon">💬</span><span><strong>In plain words:</strong> Normal random numbers (also called Gaussian) behave like real-world measurements — most stars land near the cluster center, fewer land far away, almost none land very far. A simple 0–1 random number gives equal probability everywhere; Box-Muller bends that into a bell shape using a bit of trigonometry.</span></div>
                      <div className="help-adv-timeline">
                        {[
                          { n:'①', title:'Two uniform draws', desc:'u1 = rng(), u2 = rng(). Two ordinary 0–1 random numbers. u1 is clamped away from zero to prevent log(0) errors.', plain:'Two coin-flip-style random numbers are drawn. They will be transformed into one bell-curve number in the next step.', subs:['2 RNG calls consumed per gaussian output','u1 controls how far from center, u2 controls the direction','Clamping u1 away from 0 prevents a math error (log of zero is undefined)'] },
                          { n:'②', title:'Transform', desc:'result = std × √(−2 × ln(u1)) × cos(2π × u2). Converts the two uniform numbers into one bell-curve value centered at 0 with spread = std.', plain:'The formula bends the two flat random numbers into a bell shape. The std (standard deviation) parameter controls how wide the bell is — a small std keeps stars tightly grouped, a large std spreads them out. The result is mostly near zero, occasionally far from zero, rarely very far.', subs:['ln = natural logarithm, cos = cosine — standard math functions','std = standard deviation: controls width of the bell curve','The formula actually produces two outputs — only one is used, the other is discarded'] },
                          { n:'③', title:'Usage in placement', desc:'gaussianRandomSeeded(std, rng) is called for cluster X/Z scatter and for several Y-distribution modes.', plain:'This bell-curve function is what makes clusters look like clusters rather than uniform blobs. Each cluster star gets an offset from its center drawn from this bell — most land close, some land further away, very few land far out. The same function shapes the sky bands in Gaussian and Layered Y-modes.', subs:['Cluster X scatter: gauss(clusterStdDev) per star','Cluster Z scatter: separate call, same std','Y gaussian mode: gauss(yStdDev) around yCenter','Each gaussianRandomSeeded call consumes exactly 2 RNG draws'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'1.1rem'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4>
                              <p>{s.desc}</p>
                              {s.plain && <div className="help-plain" style={{marginTop:'8px', marginBottom:'8px'}}><span className="help-plain-icon">💬</span><span>{s.plain}</span></div>}
                              <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>RNG Consumption Order</h3>
                      <div className="help-adv-summary">
                        <div className="help-adv-summary-title">Key rule</div>
                        The seed produces a single deterministic sequence. Any parameter change that affects an <strong>earlier</strong> draw shifts all subsequent draws. Safe changes (don’t affect earlier draws): <strong>numStars</strong>, <strong>UV weights</strong>, <strong>exclusion zones</strong>. Everything else shifts the sequence.
                      </div>
                      <div className="help-adv-ts-grid">
                        {[
                          ['1. Cluster center X','rng() × 2 − 1 × spread, per cluster (nClusters calls)'],
                          ['2. Cluster center Y','sampleY() per cluster — mode-dependent RNG draw count'],
                          ['3. Cluster center Z','rng() per cluster'],
                          ['4. Per-star: background coin','rng() < bgRatio — 1 call per attempt'],
                          ['5. Per-star: position','2–4 calls depending on bg vs cluster path'],
                          ['6. Per-star: UV pick','weightedPick — 1 call'],
                          ['7. Per-star: scale','rng() for scale interpolation — 1 call'],
                          ['8. Per-star: rotation','rng() × 2π — 1 call'],
                        ].map(([q,a]) => (
                          <div key={q} className="help-adv-ts-item">
                            <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                            <div className="help-adv-ts-a">{a}</div>
                          </div>
                        ))}
                      </div>
                      <div className="help-plain" style={{marginTop:'14px'}}><span className="help-plain-icon">💬</span><span><strong>In plain words:</strong> Imagine the seed produces a single very long list of random numbers — 1000 of them, in a fixed order. The algorithm reads that list from left to right. If you change the number of clusters, it reads a different number of values for the cluster centers, which shifts everything that comes after. The stars end up in completely different positions even though the seed is the same. The only safe changes are things that don't read from the list early: adding more stars (just reads more values at the end), changing UV weights or exclusion zones (those don't touch the list at all).</span></div>
                    </div>
                  </>)}

                  {/* ── PLACEMENT ALGORITHM ── */}
                  {activeAdvSubTab === 'placement' && (<>
                    <div className="help-adv-hero">
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">Placement Algorithm</h2>
                        <p className="help-adv-hero-desc">Star placement uses a two-mode gaussian cluster model with rejection sampling for exclusion zones. The algorithm runs in a single while loop with a hard attempt ceiling to prevent infinite loops.</p>
                      <div className="help-plain"><span className="help-plain-icon">💬</span><span><strong>In plain words:</strong> The algorithm tries to place one star at a time. For each attempt it rolls a dice to decide if the star is a "background" star (placed anywhere randomly) or a "cluster" star (placed near one of the pre-generated cluster centers). If the position falls inside an exclusion zone, it discards the attempt and tries again. It keeps going until it has placed the requested number of stars — or until it has tried 50× that many times without success.</span></div>
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Cluster Center Generation</h3>
                      <div className="help-adv-timeline">
                        {[
                          { n:'①', title:'nClusters centers generated upfront', desc:'Before any stars are placed, nClusters random anchor points are generated. Each gets a position: X and Z are uniform random within ±spread, Y uses sampleY().', plain:'Think of cluster centers as invisible magnets scattered across the sky. They are placed once at the start, before any stars are drawn. All cluster-mode stars will then be attracted towards one of these magnets. The magnets themselves are not visible and are not filtered by exclusion zones.', subs:['center.x = (rng()*2-1)*spread — uniform random left/right','center.y = sampleY() — height follows the selected Y-distribution mode','center.z = (rng()*2-1)*spread — uniform random forward/back','Centers are NOT filtered by exclusion zones — only individual stars are'] },
                          { n:'②', title:'Centers are reused across all cluster stars', desc:'All cluster-mode stars share the same pool of centers. Each picks one uniformly at random via Math.floor(rng() * centers.length).', plain:'Every cluster star randomly picks one of the magnets to orbit. With 10 clusters and 50 cluster stars, on average 5 stars end up around each magnet — but some magnets may attract 8 while others attract 2. This natural unevenness is intentional; perfectly balanced clusters would look artificial.', subs:['1 cluster = all cluster stars orbit one point','10 clusters = roughly evenly spread (statistically, with natural variation)','1 RNG call per cluster star to pick the center','No balancing applied — uneven distribution is natural'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'1.1rem'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4>
                              <p>{s.desc}</p>
                              {s.plain && <div className="help-plain" style={{marginTop:'8px', marginBottom:'8px'}}><span className="help-plain-icon">💬</span><span>{s.plain}</span></div>}
                              <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Per-Star Loop Logic</h3>

                      <div className="help-adv-summary">
                        <div className="help-adv-summary-title">Loop in brief</div>
                        For each star: <strong>flip bg/cluster coin</strong> → <strong>sample position</strong> → <strong>check exclusion zones</strong> (reject &amp; retry if hit) → <strong>pick sprite</strong> → <strong>compute scale + rotation</strong> → add to list. Hard ceiling: <strong>50 × nStars</strong> total attempts before giving up.
                      </div>

                      <div className="help-adv-timeline--grid">
                        {[
                          { n:'①', title:'Coin flip', desc:'rng() < bgRatio — one random draw decides: background (placed anywhere) or cluster (placed near a center). Re-evaluated on every retry after rejection.', plain:'Like flipping a weighted coin. If bgRatio is 0.45, there is a 45% chance each star attempt goes into “background” mode. On a retry after hitting an exclusion zone, the coin is flipped again — a retry is not guaranteed to stay in the same mode.', subs:['bgRatio=0.0: every star is a cluster star','bgRatio=1.0: every star is placed randomly across the full area','bgRatio=0.45: roughly 45% background, 55% cluster (default)'] },
                          { n:'②', title:'Background position', desc:'x = (rng()*2−1)*spread, y = sampleY(), z = (rng()*2−1)*spread. Fully uniform random within the ±spread area, independent of all cluster centers.', plain:'Background stars are placed like throwing darts blindfolded at the entire sky area. No magnets, no bias — just flat random. They fill in the space between clusters and create the sparse star field you see behind the bright groupings.', subs:['3+ RNG calls depending on Y-mode complexity','No attraction to cluster centers','Creates the sparse field visible between clusters'] },
                          { n:'③', title:'Cluster position', desc:'Pick random center, add gaussian offsets on X and Z (each uses 2 RNG calls via Box-Muller). Y = center.y ± uniform yClusterScatter (1 RNG call).', plain:'Cluster stars are placed near their chosen magnet but not exactly on it. The gaussian offset is like a dart throw where the dart is more likely to land close to the bullseye than far away. The X and Z offsets are independent — a star can end up north-east of its center, or almost on top of it. Unlike background stars, cluster stars can technically land slightly outside the ±spread boundary if their gaussian offset is very large.', subs:['6 RNG calls total: 1 (center pick) + 2 (X) + 1 (Y scatter) + 2 (Z)','Gaussian offset: most stars within ±1 clusterStdDev of center','Star can land outside ±spread if gaussian tail is long — X/Z not clamped'] },
                          { n:'④', title:'Exclusion check', desc:'activeZones.some(zone => inExclusionZone(x, z, zone, spread)) — if any zone contains this position, the star is discarded and attempts++ without consuming RNG.', plain:'After a position is chosen, the algorithm checks every exclusion zone to see if the star landed inside one. If yes, the position is thrown away and the whole process starts over from step ①. This check is fast (just comparing numbers) and does not advance the random sequence — so exclusion zones do not affect the positions of stars that do get placed.', subs:['O(zones) per star — checks all zones, stops at first hit','No RNG consumed: zone rejection does not shift the seed sequence','attempts++ counts toward the 50× ceiling whether or not a zone was hit'] },
                          { n:'⑤', title:'UV + Scale + Rotation', desc:'weightedPick picks a UV row (1 call). Scale = (scaleMin + rng()*(scaleMax−scaleMin)) × (1−dist×0.25). Rotation = rng() × 2π. 3 RNG calls total.', plain:'The placed star now gets its look: which sprite frame from the texture atlas it uses (UV pick), how big it appears (scale), and which way it is rotated. Scale is slightly reduced for stars far from the center — distant stars are rendered a bit smaller, which adds a subtle depth effect. Rotation is fully random, so no two stars look like they are pointing the same way.', subs:['UV pick: 1 RNG call — which sprite variant','Scale: random in [scaleMin, scaleMax] then multiplied by (1 − distance × 0.25)','Stars at the edge of the map appear up to 35% smaller than stars at the center','Rotation: rng() × 2π — fully random 0° to 360°'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'1.1rem'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4>
                              <p>{s.desc}</p>
                              {s.plain && <div className="help-plain" style={{marginTop:'8px', marginBottom:'8px'}}><span className="help-plain-icon">💬</span><span>{s.plain}</span></div>}
                              <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>)}

                  {/* ── Y-DISTRIBUTION ── */}
                  {activeAdvSubTab === 'ydist' && (<>
                    <div className="help-adv-hero">
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">Y-Distribution Modes</h2>
                        <p className="help-adv-hero-desc">Y is sampled independently for every star via sampleY(). All modes clamp to [0, yMax]. Cluster centers also call sampleY — cluster stars then add ±uniform scatter on top.</p>
                      </div>
                    </div>
                    <div className="help-adv-summary">
                      <div className="help-adv-summary-title">Which mode to use?</div>
                      <strong>Flat</strong> — quickest, even spread. &nbsp;
                      <strong>Gaussian</strong> — stars band around a center height. &nbsp;
                      <strong>Layered</strong> — multiple independent gaussian bands. &nbsp;
                      <strong>Disk+Halo</strong> — galaxy-like thin plane + sparse outer cloud. &nbsp;
                      <strong>Curve</strong> — fully custom shape drawn interactively.
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Mode Reference</h3>
                      <div className="help-adv-timeline--grid">
                        {[
                          { n:'Flat', title:'Flat — uniform', desc:'y = rng() × yMax. Every height equally likely. 1 RNG call.', subs:['Best for quick setup','No height bias','Good baseline before switching modes'] },
                          { n:'Gauss', title:'Gaussian — bell curve', desc:'y = clamp(yCenter + gauss(yStdDev), 0, yMax). Stars concentrate around yCenter. 2 RNG calls.', subs:['68% within ±1 stddev','95% within ±2 stddev','Heavy clamping near 0 or yMax distorts distribution'] },
                          { n:'Layered', title:'Layered — bands', desc:'Parse “center, stddev, weight” lines. Pick layer by weight, then gaussian within it. 3 RNG calls.', subs:['Lines with # are comments','Weights are relative, normalised automatically','Example: “200,400,0.7\\n900,200,0.3”'] },
                          { n:'Disk+Halo', title:'Disk + Halo', desc:'Coin flip (haloRatio) sends star to halo (wide gauss) or disk (narrow gauss), both at diskCenter. 3 RNG calls.', subs:['Typical: diskCenter=100, diskStdDev=120','haloStdDev=800, haloRatio=0.15','Creates galaxy-plane effect'] },
                          { n:'Curve', title:'Curve Editor', desc:'Custom probability density. Points: x=weight, y=height. Integrated via trapezoidal rule, inverse-sampled. 1 RNG call.', subs:['Drag points to shape','Right-click to delete','Click canvas edge to add point'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'0.6rem', letterSpacing:'0.02em'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4>
                              <p>{s.desc}</p>
                              {s.plain && <div className="help-plain" style={{marginTop:'8px', marginBottom:'8px'}}><span className="help-plain-icon">💬</span><span>{s.plain}</span></div>}
                              <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Cluster Y Scatter</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>Cluster stars receive an additional vertical offset on top of their center’s Y: y = clamp(center.y + (rng()−0.5) × yClusterScatter, 0, yMax). This is a <strong>uniform</strong> scatter (not gaussian), centered on the cluster center.</p>
                      <div className="help-adv-ts-grid">
                        {[
                          ['yClusterScatter = 0','All cluster stars at exactly center.y — clusters appear as flat horizontal discs'],
                          ['yClusterScatter = 200','±100 unit uniform scatter — natural 3D cluster depth (default)'],
                          ['yClusterScatter = 1000','±500 unit scatter — clusters become vertical columns'],
                          ['Interaction with yMax','Result is clamped to [0, yMax] — heavy scatter near boundaries creates density buildup at 0 and yMax'],
                        ].map(([q,a]) => (
                          <div key={q} className="help-adv-ts-item">
                            <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                            <div className="help-adv-ts-a">{a}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>)}

                  {/* ── SCALE & BRIGHTNESS ── */}
                  {activeAdvSubTab === 'scale' && (<>
                    <div className="help-adv-hero">
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">Scale & Brightness</h2>
                        <p className="help-adv-hero-desc">Each star receives a UniformScale value and a brightness value. Both are computed from the star’s position and random draws — they are derived, not directly configurable.</p>
                      <div className="help-plain"><span className="help-plain-icon">💬</span><span><strong>In plain words:</strong> You set a min and max size range, and the algorithm picks a random size within that range for each star. Stars placed far from the center of the map are made slightly smaller — this creates a subtle depth effect where the sky looks larger than it is. Brightness only affects the canvas preview color; it is not written into the generated file.</span></div>
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Scale Calculation</h3>
                      <div className="help-adv-timeline">
                        {[
                          { n:'①', title:'Base scale — random interpolation', desc:'baseScale = scaleMin + rng() × (scaleMax − scaleMin). A uniform random value between scaleMin and scaleMax is chosen. This consumes one RNG call.', subs:['scaleMin=10, scaleMax=30 → uniform random in [10, 30]','Equal probability for every value in the range','Narrow range (e.g. 15–20) → uniform size field','Wide range (5–50) → strong size variation suggesting depth'] },
                          { n:'②', title:'Distance attenuation', desc:'dist = √(x²+z²) ÷ spread. This gives a normalised distance from origin in [0, √2] (corners reach ~1.41). Scale is then multiplied by (1 − dist × 0.25).', subs:['At origin: factor = 1.0 → full scale','At edge (dist=1): factor = 0.75 → 25% smaller','At corner (dist≈1.41): factor ≈ 0.65 → 35% smaller','This creates a subtle vignette — stars near the edge appear more distant','The 0.25 coefficient is hardcoded — not user-configurable'] },
                          { n:'③', title:'Final scale', desc:'scale = baseScale × (1 − dist × 0.25). This single value is written to both scale.x and scale.y in the Lua output (uniform scale).', subs:['Written as: scale = { X.XX, X.XX, } with 2 decimal places','Both components identical — FA uses them as 2D sprite scale','Non-uniform sprite stretching is not supported in this output format'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'1.1rem'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4>
                              <p>{s.desc}</p>
                              {s.plain && <div className="help-plain" style={{marginTop:'8px', marginBottom:'8px'}}><span className="help-plain-icon">💬</span><span>{s.plain}</span></div>}
                              <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Brightness</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>Brightness is computed per star but currently used only for canvas preview color intensity — it is <strong>not written to the Lua output</strong>. The value is retained in the star object for potential future use.</p>
                      <div className="help-adv-ts-grid">
                        {[
                          ['Cluster stars','brightness = 0.6 + rng() × 0.4 → range [0.6, 1.0]'],
                          ['Background stars','brightness = 0.3 + rng() × 0.4 → range [0.3, 0.7]'],
                          ['Effect','Cluster stars are visually brighter on canvas — reinforces the cluster/background visual distinction'],
                          ['Lua output','Brightness is not included in the written Lua — all stars appear at equal luminosity in-game'],
                        ].map(([q,a]) => (
                          <div key={q} className="help-adv-ts-item">
                            <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                            <div className="help-adv-ts-a">{a}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Rotation</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>rotation = rng() × 2π — fully random uniform rotation in radians [0, 2π]. Written to Lua with 4 decimal places. FA uses this as the sprite’s roll angle around its facing axis.</p>
                    </div>
                  </>)}

                  {/* ── UV SYSTEM ── */}
                  {activeAdvSubTab === 'uv' && (<>
                    <div className="help-adv-hero">
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">UV Texture System</h2>
                        <p className="help-adv-hero-desc">FA star props sample a texture atlas using UV coordinates. Each UV row defines a rectangle in texture space. Stars pick a row per placement via weighted random selection.</p>
                      <div className="help-plain"><span className="help-plain-icon">💬</span><span><strong>In plain words:</strong> A texture atlas is one big image that contains multiple smaller sprites arranged in a grid. Instead of having separate image files for each star shape, they all live in one file. UV coordinates tell the game "use the sprite in the top-left quarter" or "use the sprite in the bottom-right quarter". Each row in the table defines one of those quarters. Adding multiple rows with different regions gives each star a chance to look slightly different — some use one sprite, some use another.</span></div>
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>UV Coordinate Format</h3>
                      <div className="help-adv-timeline">
                        {[
                          { n:'X', title:'X — horizontal start', desc:'Left edge of the sprite rectangle. 0.0 = far left of the texture, 1.0 = far right. For a 2-column atlas: left sprites use x=0.0, right sprites use x=0.5.', plain:'X is like saying “start reading the texture at this horizontal position”. On a 2×2 atlas, the left column starts at 0 and the right column starts at 0.5 (halfway across).', subs:['0.0 = leftmost pixel of the texture','0.5 = halfway across','x + z (start + width) must not exceed 1.0'] },
                          { n:'Y', title:'Y — vertical start (bottom-up!)', desc:'Bottom edge of the sprite rectangle. 0.0 = bottom of texture, 1.0 = top. FA UV uses bottom-left as origin — opposite to screen coordinates where Y=0 is the top.', plain:'This is the most confusing part. In FA, Y=0 means the BOTTOM of the texture, not the top. So the bottom row of a 2×2 atlas uses y=0.0, and the top row uses y=0.5. If your sprites appear upside down or in the wrong row, this is usually why.', subs:['0.0 = bottom of the texture (not top!)','0.5 = halfway up','y + w (start + height) must not exceed 1.0','Most common mistake: forgetting Y is bottom-up in FA'] },
                          { n:'Z', title:'Z — width', desc:'Width of the UV rectangle. For a 2-column atlas, z=0.5. For a 4-column atlas, z=0.25.', subs:['z=0.5: sprite occupies half the atlas width','z + x must not exceed 1.0','Smaller z = smaller sprite region = finer detail if texture is high-res'] },
                          { n:'W', title:'W — height', desc:'Height of the UV rectangle. For a 2-row atlas, w=0.5. Independent of Z — rectangles can be non-square.', subs:['w=0.5: sprite occupies half the atlas height','w + y must not exceed 1.0','Non-square UV rects are valid — useful for rectangular sprite layouts'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'1rem'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4>
                              <p>{s.desc}</p>
                              {s.plain && <div className="help-plain" style={{marginTop:'8px', marginBottom:'8px'}}><span className="help-plain-icon">💬</span><span>{s.plain}</span></div>}
                              <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Weighted Random Selection</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>The weightedPick(weights) function implements alias sampling: sum all weights, draw rng() × total, then walk the weight array subtracting each until the running total hits zero.</p>
                      <div className="help-adv-ts-grid">
                        {[
                          ['Equal weights','All rows equally likely — uniform distribution. Default: all 0.25.'],
                          ['Unequal weights','Only ratios matter. [1, 1, 2] is identical to [0.25, 0.25, 0.5].'],
                          ['Weight = 0','That row is never selected. Use to temporarily disable a variant without deleting it.'],
                          ['One row','Weight is irrelevant — only one option exists, always selected.'],
                          ['RNG cost','Exactly 1 rng() call per UV pick, regardless of row count.'],
                        ].map(([q,a]) => (
                          <div key={q} className="help-adv-ts-item">
                            <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                            <div className="help-adv-ts-a">{a}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>UV Canvas Rendering</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>The canvas renders all UV rows as colored numbered rectangles. FA UV space (Y=0 at bottom) is converted to screen space (Y=0 at top) via cy1 = (1−uv.y−uv.w)×H. This is the only coordinate where FA’s bottom-up Y convention is accounted for.</p>
                      <div className="help-adv-ts-grid">
                        {[
                          ['Texture overlay','Upload PNG, JPG, or DDS — rendered beneath the UV rects at the configured opacity'],
                          ['UV Overlay Opacity','Controls rect fill alpha — set to 0 to see only outlines, 1 for fully opaque fills'],
                          ['Numbered circles','Center circle shows row index (1-based) — matches table row order'],
                          ['Color assignment','UV_COLORS array cycles through 8 colors — row 9 wraps back to color 1'],
                        ].map(([q,a]) => (
                          <div key={q} className="help-adv-ts-item">
                            <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                            <div className="help-adv-ts-a">{a}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>)}

                  {/* ── EXCLUSION ZONES ── */}
                  {activeAdvSubTab === 'exclusion' && (<>
                    <div className="help-adv-hero">
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">Exclusion Zone System</h2>
                        <p className="help-adv-hero-desc">Exclusion zones define rectangular regions in world space where stars cannot be placed. Each zone is stored as normalised canvas coordinates and converted to world space on every check.</p>
                      <div className="help-plain"><span className="help-plain-icon">💬</span><span><strong>In plain words:</strong> Draw a rectangle on the canvas and any star that would land inside it gets discarded and retried. The canvas represents the entire sky area (±Spread) — the center of the canvas is world coordinate (0, 0). You would typically draw a zone over the base area, over water, or over roads where stars floating at ground level would look wrong.</span></div>
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Coordinate System</h3>
                      <div className="help-adv-timeline">
                        {[
                          { n:'①', title:'Canvas space [0,1]²', desc:'Zones stored as normalised coordinates in [0,1]². Canvas center (0.5, 0.5) = world origin (0,0). Edges = ±Spread.', plain:'The canvas is a scaled-down map of the sky area. A coordinate of (0.5, 0.5) means the exact center of the map — world position (0, 0, 0). A coordinate of (0.0, 0.0) is the top-left corner of the canvas, which is world position (−Spread, −Spread). Storing zones as 0–1 fractions means they stay correct even if you change the Spread value.', subs:['(0.5, 0.5) = world center (0, 0)','(0.0, y) = world X = −Spread','(1.0, y) = world X = +Spread','Canvas Y is top-down but world Z increases downward on canvas'] },
                          { n:'②', title:'World space conversion', desc:'world = (norm × 2 − 1) × spread. Converts the stored 0–1 fraction to the actual world coordinate used for the check.', plain:'Formula: take the 0–1 fraction, stretch it to −1 to +1, then multiply by Spread. So a zone edge at canvas position 0.25 with Spread=14000 becomes world position (0.25×2−1)×14000 = −7000. This conversion happens on every single star check — not once when you draw the zone.', subs:['norm=0.0 → world = −spread (left/top edge)','norm=0.5 → world = 0 (center)','norm=1.0 → world = +spread (right/bottom edge)'] },
                          { n:'③', title:'Intersection test', desc:'px ≥ x0 && px ≤ x1 && pz ≥ z0 && pz ≤ z1. Checks if the star position is inside the rectangle. Stars on the border are excluded.', plain:'“Is the star inside this box?” is a very simple question — just check if its X coordinate is between the left and right edges, and its Z coordinate is between the top and bottom edges. Four number comparisons. Very fast. Stars exactly on the border count as inside (excluded). This check runs for every zone for every star attempt.', subs:['4 comparisons per zone — O(1), extremely fast','Stars on the zone border are also excluded','Any one zone hit discards the star — all zones act as a union','No RNG is consumed — rejection does not shift the seed sequence'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'1.1rem'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4>
                              <p>{s.desc}</p>
                              {s.plain && <div className="help-plain" style={{marginTop:'8px', marginBottom:'8px'}}><span className="help-plain-icon">💬</span><span>{s.plain}</span></div>}
                              <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Draft → Confirm Flow</h3>
                      <div className="help-adv-timeline">
                        {[
                          { n:'①', title:'Drawing (draft state)', desc:'MouseDown on the canvas starts a drag. exDragStart.current records the normalised start position. MouseMove updates exDraft.current and redraws the canvas on every frame — no React state update during drag to keep it smooth.', subs:['mousemove + mouseup listeners on document (not canvas) — drag continues outside canvas bounds','Clamping: both axes clamped to [0,1] — drag cannot extend beyond canvas','Minimum size check on mouseup: zones smaller than 0.01×0.01 in canvas space are discarded','Draft shown in purple: rgba(138,18,189) fill + rgba(180,80,255) stroke'] },
                          { n:'②', title:'Confirmation', desc:'MouseUp sets draftZone state if the zone is large enough. The confirm bar appears. Clicking “Confirm” appends the draft to exclusionZones[] and sets selectedZoneIdx to the new zone.', subs:['Draft zone does not block stars — only committed zones do','Discard removes draft without saving — no undo needed','Confirming immediately enables the zone for the next generation run','selectedZoneIdx is set to the new zone index for immediate canvas highlight'] },
                          { n:'③', title:'Zone list management', desc:'Each committed zone is listed with index, world-space coordinates (when selected), and a delete button. Clicking a zone sets selectedZoneIdx, highlighting it on the canvas.', subs:['selectedZoneIdx highlight: brighter fill + larger corner dots on canvas','Coordinates shown on click: X −N → +N   Z −N → +N format','Delete: filters the array, adjusts selectedZoneIdx if needed (no gaps)','Clear All: setExclusionZones([]) + resets draft and selection'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'1.1rem'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4>
                              <p>{s.desc}</p>
                              {s.plain && <div className="help-plain" style={{marginTop:'8px', marginBottom:'8px'}}><span className="help-plain-icon">💬</span><span>{s.plain}</span></div>}
                              <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Union Canvas Rendering</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>Committed zones are rendered using a three-offscreen-canvas technique to produce a true union outline — shared interior borders between adjacent or overlapping zones are suppressed:</p>
                      <div className="help-adv-timeline">
                        {[
                          { n:'①', title:'offUnion — full union mask', desc:'All zones drawn as solid white rectangles onto an offscreen canvas. Overlapping areas are just white — no double-draw artefact.', subs:[] },
                          { n:'②', title:'offEroded — inset union mask', desc:'Same zones drawn again with a 2px inset (x+2, y+2, w−4, h−4). This represents the “interior” of the union.', subs:[] },
                          { n:'③', title:'offRim — true outer edge', desc:'offUnion drawn onto offRim, then offEroded subtracted via destination-out composite. Remaining pixels are only the 2px outer rim of the union — inner shared edges are erased because both masks agree there.', subs:['Adjacent zones: the shared interior edge is white in both offUnion and offEroded → subtracted → erased','Non-adjacent zones: separate rims remain','Result: only the true outer boundary of the union shape is drawn'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'1.1rem'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4><p>{s.desc}</p>
                              {s.subs.length > 0 && <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>)}

                  {/* ── OUTPUT & INJECT ── */}
                  {activeAdvSubTab === 'output' && (<>
                    <div className="help-adv-hero">
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">Output Format & Injection Pipeline</h2>
                        <p className="help-adv-hero-desc">Generated stars are formatted as Lua table entries and injected directly into your map’s data.lua inside the skyBox → planets block. The pipeline unpacks the .scmap, modifies data.lua, and repacks.</p>
                      <div className="help-plain"><span className="help-plain-icon">💬</span><span><strong>In plain words:</strong> A .scmap file is a compressed archive that contains your map’s data. The app opens it, finds the text file inside (data.lua) that defines the skybox, adds new star entries to the existing list, closes the archive back up, and puts it back where it was. Lua is the scripting language FA uses — it looks like plain text with curly braces. You do not need to know Lua to use this; the app writes it for you.</span></div>
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Lua Output Format</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>Each star is serialised by buildPlanetLua() into the following Lua table entry:</p>
                      <pre style={{background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.08)', padding:'16px 20px', fontFamily:'monospace', fontSize:'0.78rem', color:'rgba(255,255,255,0.7)', lineHeight:1.8, marginBottom:'20px', whiteSpace:'pre', margin:'0 0 20px 0'}}>{`        {\n            position = { X.XXX, Y.XXX, Z.XXX, },\n            rotation = R.RRRR,\n            scale = { S.SS, S.SS, },\n            uv = { X, Y, Z, W, },\n        },`}</pre>
                      <div className="help-adv-ts-grid">
                        {[
                          ['position','World X, Y, Z coordinates. 3 decimal places. Written as-is from buildStars output.'],
                          ['rotation','Random rotation in radians [0, 2π]. 4 decimal places.'],
                          ['scale','Uniform scale value, duplicated for X and Y. 2 decimal places. Distance-attenuated.'],
                          ['uv','The raw x, y, z, w values from the selected UV row — written verbatim from the table input.'],
                          ['Appended, not replaced','Output is inserted before the closing of the existing planets block — re-runs accumulate entries.'],
                        ].map(([q,a]) => (
                          <div key={q} className="help-adv-ts-item">
                            <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                            <div className="help-adv-ts-a">{a}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>IPC Injection Pipeline</h3>

                      <div className="help-adv-summary">
                        <div className="help-adv-summary-title">Pipeline in brief</div>
                        <strong>Find .scmap</strong> → <strong>Unpack</strong> (decompress to temp folder) → <strong>Read data.lua</strong> → <strong>Inject</strong> into planets block via regex → <strong>Write</strong> data.lua → <strong>Repack</strong> .scmap → <strong>Copy back</strong> to map folder. History snapshots before &amp; after.
                      </div>

                      <div className="help-adv-timeline--grid">
                        {[
                          { n:'1', title:'Find .scmap', desc:'list-dir IPC call on the map folder. Scans for a file ending in .scmap — FA editor must have run at least once.', subs:['Throws if not found','Uses first match if multiple exist'] },
                          { n:'2', title:'Unpack .scmap', desc:'scmap-unpack IPC call. Main process decompresses the binary .scmap into a temp folder containing data.lua.', subs:['Output folder path returned in unpackRes','History snapshot taken before modification'] },
                          { n:'3', title:'Read data.lua', desc:'read-file IPC call on the unpacked data.lua. Returns full file as UTF-8 string.', subs:['Throws if file missing','Malformed .scmap if data.lua absent'] },
                          { n:'4', title:'Regex inject', desc:'Greedy regex finds the skyBox → planets block and captures 3 groups. New entries inserted between groups 2 and 3.', subs:['Group 1: up to “planets = {”','Group 2: existing entries (preserved)','Group 3: closing brace'] },
                          { n:'5', title:'Write + snapshot', desc:'write-file IPC call writes the modified string back. History snapshot taken after write for diff.', subs:['Overwrites unpacked data.lua','History diff from before/after snapshots'] },
                          { n:'6', title:'Repack', desc:'scmap-pack IPC call compresses the modified folder back into a .scmap binary.', subs:['Map name from unpacked folder name','Output path returned in packRes'] },
                          { n:'7', title:'Copy back', desc:'copy-file IPC call moves the repacked .scmap to the original path, overwriting the old file.', subs:['Auto-opens map folder if setting enabled','Alert shows actual injected count'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num">{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4>
                              <p>{s.desc}</p>
                              {s.subs.length > 0 && <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>)}

                </div>
              )}
            </div>
          </div>
        </>
    );
  }

export default StarsHelpModal;
