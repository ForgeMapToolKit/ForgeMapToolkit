import React from "react";

function RockErosionHelpModal({ onClose, activeHelpTab, setActiveHelpTab, helpSelected, setHelpSelected, activeAdvSubTab, setActiveAdvSubTab }) {
  return (
    <>
        <>
          <div className="help-modal-overlay" onClick={onClose} />
          <div
            className="help-modal"
            style={{ '--tab-color': 'var(--rockerosion-color)', '--tab-glow': 'var(--rockerosion-glow)', '--tab-glow-strong': 'var(--rockerosion-glow-strong)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="help-modal-header">
              <h2 className="help-modal-title">Rock Erosion Generator — Help Guide</h2>
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
              {activeHelpTab === 'guide' && (
                <div style={{ display: 'flex', gap: '40px', height: '100%' }}>
                  <div style={{ flex: '0 0 auto', overflowY: 'auto', paddingRight: '20px', borderRight: '1px solid rgba(255,175,0,0.08)', maxWidth: '1350px' }}>
                    <div style={{ padding: '8px 0 14px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'rgba(255,175,0,0.5)', fontSize: '1rem' }}>↗</span> Click any element to learn about it
                    </div>

                    <div className="tab-grid" style={{ gridTemplateColumns: 'auto 1fr', maxWidth: 'none', margin: 0 }}>
                    <div className="tab-col-config">
                      <div className="section-card">
                        <div className="section-title">Configuration</div>

                        <div className="subsection-title">Map Details</div>
                        <div className="form-group" style={{ cursor: 'pointer', outline: helpSelected === 'mapname' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                          onClick={() => setHelpSelected('mapname')}>
                          <label>Map Name</label>
                          <input readOnly onChange={() => {}} className="form-input" placeholder="e.g., Desert_Peaks.v0001" />
                        </div>
                        <div className="form-group" style={{ cursor: 'pointer', outline: helpSelected === 'mapsize' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                          onClick={() => setHelpSelected('mapsize')}>
                          <label>Map Size</label>
                          <input readOnly onChange={() => {}} className="form-input" placeholder="1024" />
                        </div>

                        <div className="subsection-title">Density</div>
                        <div className="re-grid-2">
                          <div style={{ cursor: 'pointer', outline: helpSelected === 'densitymultiplier' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                            onClick={() => setHelpSelected('densitymultiplier')}>
                            <label>Density Multiplier</label>
                            <input readOnly onChange={() => {}} defaultValue="1.0" className="form-input" />
                          </div>
                          <div style={{ cursor: 'pointer', outline: helpSelected === 'diffusion' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                            onClick={() => setHelpSelected('diffusion')}>
                            <label>Diffusion (0–100)</label>
                            <input readOnly onChange={() => {}} defaultValue="0" className="form-input" />
                          </div>
                        </div>

                        <div className="subsection-title">Grid Resolution</div>
                        <div className="form-group" style={{ cursor: 'pointer', outline: helpSelected === 'gridresolution' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                          onClick={() => setHelpSelected('gridresolution')}>
                          <label>Grid Resolution <span style={{ float: 'right', color: 'var(--tab-color)', fontSize: '0.78rem' }}>65536 points</span></label>
                          <input readOnly onChange={() => {}} className="form-input" defaultValue="256" />
                        </div>

                        <div className="subsection-title">Size Blending</div>
                        <div className="form-group" style={{ cursor: 'pointer', outline: helpSelected === 'sizeblend' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                          onClick={() => setHelpSelected('sizeblend')}>
                          <label>Size Blend Sigma (1–150)
                            <small style={{ display: 'block', opacity: 0.7, marginTop: '4px' }}>Low = sharp size zones, High = all sizes mix freely</small>
                          </label>
                          <input readOnly onChange={() => {}} className="form-input" defaultValue="50" />
                        </div>

                        <button className="btn-secondary" style={{ width: '100%', cursor: 'pointer', outline: helpSelected === 'randomize' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                          onClick={() => setHelpSelected('randomize')}>Randomize</button>
                      </div>
                      <div className="section-card re-rocktype-block">
                        <div className="re-mode-switch-inner" style={{ cursor: 'pointer', outline: helpSelected === 'rocktype' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '4px' }}
                          onClick={() => setHelpSelected('rocktype')}>
                          <div className="re-mode-switch-title">Rock Type</div>
                          <div className="re-mode-buttons">
                            {['Debris','Scree','Erosion'].map(t => (
                              <div key={t} className={`re-mode-button${t === 'Debris' ? ' active' : ''}`}
                                style={{ pointerEvents: 'none' }}>{t}</div>
                            ))}
                          </div>
                        </div>

                        <div className="re-tab-section">
                          <div style={{ cursor: 'pointer', outline: helpSelected === 'erosionmaps' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '4px' }}
                            onClick={() => setHelpSelected('erosionmaps')}>
                            <div className="section-title">Erosion Maps</div>
                          </div>
                          <p className="re-section-description">Upload masks to control gravitational rock distribution.</p>

                          <div className="re-grid-2">
                            {[['flowmask','Where to spawn?','Upload Spawn Map'],['slopemask','Spawn probability','Upload Spawn Probability']].map(([key,lbl,btn]) => (
                              <div key={key} style={{ cursor: 'pointer', outline: helpSelected === key ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                                onClick={() => setHelpSelected(key)}>
                                <label>{lbl}</label>
                                <button className="btn-secondary" style={{ width: '100%', pointerEvents: 'none' }}>{btn}</button>
                              </div>
                            ))}
                          </div>
                          <div className="re-grid-2" style={{ marginTop: '10px' }}>
                            {[['erosionwear','Size determination','Upload Size Determination'],['curvature','Clustering (Optional)','Upload Clustering Map']].map(([key,lbl,btn]) => (
                              <div key={key} style={{ cursor: 'pointer', outline: helpSelected === key ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                                onClick={() => setHelpSelected(key)}>
                                <label style={{ opacity: key === 'curvature' ? 0.7 : 1 }}>{lbl}</label>
                                <button className="btn-secondary" style={{ width: '100%', pointerEvents: 'none', opacity: key === 'curvature' ? 0.7 : 1 }}>{btn}</button>
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: '10px', cursor: 'pointer', outline: helpSelected === 'heightmap' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                            onClick={() => setHelpSelected('heightmap')}>
                            <label style={{ opacity: 0.7 }}>Heightmap (Optional — Realistic Orientation)</label>
                            <button className="btn-secondary" style={{ width: '100%', pointerEvents: 'none', opacity: 0.7 }}>Upload Heightmap</button>
                          </div>

                          <div style={{ cursor: 'pointer', outline: helpSelected === 'rockconfig' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '4px', marginTop: '18px' }}
                            onClick={() => setHelpSelected('rockconfig')}>
                            <div className="section-title">Rock Configuration</div>
                          </div>

                          <div className="treemap-props-container">
                            <div style={{ cursor: 'pointer', outline: helpSelected === 'rockcard' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                              onClick={() => setHelpSelected('rockcard')}>
                              <div className="treemap-prop-card selected" style={{ pointerEvents: 'none' }}>
                                <div className="treemap-prop-card-header">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--tab-color)', flexShrink: 0 }} />
                                    <input readOnly onChange={() => {}} className="treemap-prop-name-input" defaultValue="Erosion Rocks" />
                                  </div>
                                </div>
                                <div className="treemap-prop-details">
                                  <div className="form-group" style={{ marginBottom: '10px' }}>
                                    <label style={{ pointerEvents: 'all', cursor: 'pointer', display: 'block', marginBottom: '6px',
                                      outline: helpSelected === 'blueprints' ? '2px solid var(--tab-color)' : 'none' }}
                                      onClick={e => { e.stopPropagation(); setHelpSelected('blueprints'); }}>Blueprints</label>
                                    <div className="input-row">
                                      <input readOnly onChange={() => {}} className="form-input" placeholder="/env/Rocks/Props/boulder_01_prop.bp"
                                        style={{ fontFamily: 'monospace', fontSize: '0.78rem' }} />
                                      <button className="btn-delete-sm" style={{ pointerEvents: 'none' }}>×</button>
                                    </div>
                                    <button className="btn-library" style={{ width: '100%', pointerEvents: 'all', cursor: 'pointer',
                                      outline: helpSelected === 'blueprintlibrary' ? '2px solid var(--tab-color)' : 'none' }}
                                      onClick={e => { e.stopPropagation(); setHelpSelected('blueprintlibrary'); }}>Library</button>
                                  </div>
                                  <div style={{ pointerEvents: 'all', cursor: 'pointer',
                                    outline: helpSelected === 'customvalues' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                                    onClick={e => { e.stopPropagation(); setHelpSelected('customvalues'); }}>
                                    <button className="btn-secondary" style={{ width: '100%', pointerEvents: 'none', fontSize: '0.82rem',
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span>Custom Values</span><span style={{ fontSize: '0.65rem', opacity: 0.6 }}>▼</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="treemap-add-prop-card" style={{ cursor: 'pointer', outline: helpSelected === 'addcard' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                              onClick={() => setHelpSelected('addcard')}>
                              <div className="treemap-add-prop-icon"><span style={{ fontSize: '2rem' }}>+</span></div>
                              <span className="treemap-add-prop-text">ADD ROCK CARD</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="section-card">
                        <label className="checkbox-label" style={{ cursor: 'pointer',
                          outline: helpSelected === 'generatereadme' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                          onClick={() => setHelpSelected('generatereadme')}>
                          <div className="checkbox checked">
                            <svg className="checkbox-check" viewBox="0 0 12 10" fill="none">
                              <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <span className="checkbox-text">Generate README file</span>
                        </label>
                        <button className="btn-primary btn-lg" style={{ marginTop: '16px', cursor: 'pointer',
                          outline: helpSelected === 'generatebtn' ? '2px solid var(--tab-color)' : 'none', outlineOffset: '2px' }}
                          onClick={() => setHelpSelected('generatebtn')}>
                          GENERATE FILES
                        </button>
                      </div>

                    </div>
                    <div className="re-preview-column">
                      <div className="section-card re-preview-card">

                        <div className="re-preview-header">
                          <div className="section-title" style={{ margin: 0 }}>PREVIEW</div>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <div className="re-mirror-dropdown" style={{ cursor: 'pointer',
                              outline: helpSelected === 'mirrormode' ? '2px solid var(--tab-color)' : 'none' }}
                              onClick={() => setHelpSelected('mirrormode')}>Diagonal</div>
                            <button className="btn-danger-small" style={{ cursor: 'pointer',
                              outline: helpSelected === 'deletepreview' ? '2px solid var(--tab-color)' : 'none' }}
                              onClick={() => setHelpSelected('deletepreview')}>Delete Preview</button>
                          </div>
                        </div>

                        <div className="re-upload-area" style={{ cursor: 'pointer',
                          outline: helpSelected === 'uploadmap' ? '2px solid var(--tab-color)' : 'none' }}
                          onClick={() => setHelpSelected('uploadmap')}>
                          <span>Click to upload map image</span>
                        </div>

                        <div className="re-canvas-wrapper" style={{ cursor: 'pointer', position: 'relative', width: '700px', height: '700px',
                          outline: helpSelected === 'canvas' ? '2px solid var(--tab-color)' : 'none' }}
                          onClick={() => setHelpSelected('canvas')}>
                          <canvas width={800} height={800} style={{ width: '100%', height: '100%', display: 'block', background: '#0a0a0a' }} />
                          {[[25,30,'var(--rockerosion-color)'],[75,70,'var(--rockerosion-color)'],[60,20,'#00DDFF'],[40,80,'#00DDFF']].map(([x,y,c],i) => (
                            <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', width: '10px', height: '10px', borderRadius: '50%', background: c, boxShadow: `0 0 12px ${c}`, border: '2px solid rgba(255,255,255,0.7)', pointerEvents: 'none' }} />
                          ))}
                        </div>

                        <div className="preview-legend" style={{ cursor: 'pointer',
                          outline: helpSelected === 'legend' ? '2px solid var(--tab-color)' : 'none' }}
                          onClick={() => setHelpSelected('legend')}>
                          <div className="preview-legend-title">ROCK LEGEND</div>
                          <div className="preview-legend-items">
                            {[['var(--rockerosion-color)','Erosion Rocks','12'],['#00DDFF','Boulder Field','8']].map(([c,n,cnt]) => (
                              <div key={n} className="preview-legend-item">
                                <div className="preview-legend-color" style={{ backgroundColor: c }} />
                                <span>{n}</span>
                                <span className="preview-coord-count">{cnt} pts</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="preview-hint-box" style={{ cursor: 'pointer',
                          outline: helpSelected === 'hintbox' ? '2px solid var(--tab-color)' : 'none' }}
                          onClick={() => setHelpSelected('hintbox')}>
                          Upload erosion maps to generate rocks — use Randomize to reseed placement
                        </div>

                      </div>
                    </div>

                    </div>
                  </div>
                  <div style={{ flex: '1', overflowY: 'auto', maxHeight: '80vh' }}>
                    {!helpSelected ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', opacity: 0.4, color: 'var(--rockerosion-color)' }}>↖</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>Select an element</div>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.2)', maxWidth: '240px', lineHeight: 1.7 }}>Click any field, button, or section on the left to learn what it does.</div>
                      </div>
                    ) : (() => {
                      const INFO = {
                        mapname:           { title: 'Map Name',                      desc: 'The exact folder name of your map inside /maps. All output file paths are built from this.',            details: [['Format','MapName.vXXXX — e.g. Desert_Peaks.v0001'],['Case-sensitive','FA is strict — match folder name exactly'],['Auto-version','.v0001 appended automatically if omitted'],['Impact','Wrong name = all generated paths broken']], tip: 'Copy the folder name directly from File Explorer to avoid typos.' },
                        mapsize:           { title: 'Map Size',                      desc: 'Width/height of the map in game units. Controls coordinate scaling for every placed rock.',             details: [['256','5×5 km'],['512','10×10 km'],['1024','20×20 km — standard competitive'],['Impact','Wrong value shifts all rock positions proportionally']], tip: 'Check your map _scenario.lua for the exact map_size value.' },
                        densitymultiplier: { title: 'Density Multiplier',            desc: 'Global scale factor on spawn probability. Multiplies the probability for every grid cell.',           details: [['1.0','Default — no change'],['2.0','Roughly twice as many rocks'],['0.5','Roughly half as many'],['Per-card','Each rock card can override this independently via Custom Values']], tip: 'Start at 0.3–0.5, preview, then scale up.' },
                        diffusion:         { title: 'Diffusion (0–100)',             desc: 'Random positional scatter within each grid cell. Zero places every rock at the exact cell center — visible as a grid pattern.',details: [['0','Exact cell center — grid visible'],['30–60','Natural rocky scatter'],['100','Maximum random spread within cell']], tip: 'Use 30–50 for natural geological distributions.' },
                        gridresolution:    { title: 'Grid Resolution',              desc: 'Grid cell size. Higher = more candidate positions = finer detail. Counter shows total grid points (resolution²).',details: [['Higher (e.g. 256)','More positions = finer detail'],['Lower (e.g. 64)','Fewer positions = coarser layout'],['Points','Resolution² = total candidate positions']], tip: 'Higher resolution + lower density multiplier = fine-grain sparse placement.' },
                        sizeblend:         { title: 'Size Blend Sigma',             desc: 'Controls how sharply the Erosion Wear Map brightness maps to visual rock scale. Works together with the Blueprint mass value to produce the final UniformScale.',details: [['Low (1–20)','Sharp transitions — distinct size zones'],['Mid (40–80)','Balanced blending — default'],['High (100+)','All sizes freely mix'],['Mass','Blueprint ReclaimMassMax also factors into final scale']], tip: 'Leave at 50 unless you specifically want hard or very gradual size boundaries.' },
                        erosionmaps:       { title: 'Erosion Maps (section)',        desc: 'The input maps driving Erosion Rock placement. Each controls a different aspect of where and how rocks appear.',details: [['Flow Mask','Where rocks can spawn (primary gate)'],['Slope Mask','Spawn probability within allowed areas'],['Erosion Wear','Scale factor — bright = larger, dark = smaller'],['Clustering','Optional curvature bonus in concave areas']], tip: 'Start with just the Flow Mask, then add Slope and Wear for more control.' },
                        flowmask:          { title: 'Spawn Map — Flow Mask',        desc: 'Primary gate. White = spawn allowed. Black = no spawn regardless of other maps. Simulates natural debris accumulation paths.',details: [['White','Rock placement allowed'],['Black','Never spawn — hardcoded gate'],['Sigmoid','Very dark pixels also have low probability'],['Source','Flow accumulation map from GIS/DEM analysis']], tip: 'Generate in QGIS from a DEM for geologically accurate debris paths.' },
                        slopemask:         { title: 'Spawn Probability — Slope',    desc: 'Modulates how densely rocks spawn within Flow-allowed areas. Mid-brightness = highest probability. Very bright or very dark = lower.',details: [['Mid brightness','Highest spawn probability'],['Very bright','High slope — probability drops'],['Very dark','Low slope — lower probability'],['Combined','Flow = where, Slope = how dense']], tip: 'Moderate slopes accumulate the most rocks in nature.' },
                        erosionwear:       { title: 'Size Determination — Wear',    desc: 'Determines the scale factor of placed rocks. Combined multiplicatively with the blueprint mass value to produce final UniformScale. Does not select separate "size cards".',details: [['Bright','Higher scale factor — visually larger rocks'],['Dark','Lower scale factor — visually smaller rocks'],['Combined','Final scale = wearFactor × massFactor'],['Sigma','Size Blend Sigma controls transition noise']], tip: 'Old heavily-eroded terrain (dark) = small fragments. Fresh terrain (bright) = large boulders.' },
                        curvature:         { title: 'Clustering Map — Curvature',   desc: 'Optional. Adds a clustering bonus probability in concave terrain areas. Hollows and depressions naturally collect debris.',details: [['Optional','Works fine without it'],['Concave (dark)','Clustering bonus added'],['Convex (bright)','Slight reduction in probability'],['Source','Curvature map from DEM analysis']], tip: 'Subtle effect — only visible with high-contrast curvature maps.' },
                        heightmap:         { title: 'Heightmap — Orientation',      desc: 'Optional. Calculates downslope direction at each rock to rotate it realistically. Without it, rocks get random rotation.',details: [['Optional','Random rotation without it'],['Effect','Elongated rocks align with slope direction'],['Source','Same heightmap as your FA map'],['Visual','Most noticeable on elongated rock props']], tip: 'Use the heightmap exported from the FA map editor for accurate slope vectors.' },
                        rockconfig:        { title: 'Rock Configuration (section)', desc: 'Each Rock Card is one set of blueprints placed using the shared Erosion Maps. Add multiple cards for variety.',details: [['Multiple cards','All placed using the same erosion maps'],['Blueprint variety','Each card can have multiple .bp paths — picked randomly per instance'],['Color','Canvas color for preview legend — cosmetic only'],['Custom Values','Per-card overrides for density, diffusion, decimal precision']], tip: 'Name cards descriptively to track what each one represents.' },
                        rocktype:          { title: 'Rock Type',                    desc: 'Switches between the three geological placement modes — each uses different input maps and placement logic.', details: [['Erosion','Driven by shared Flow, Slope, Wear, Curvature maps — geologically accurate'],['Debris','Per-card spawn map — manual zones like ruins, roads, shorelines'],['Scree','Per-card scree map — loose fragmented rock on slopes']], tip: 'Start with Erosion for terrain-driven placement, add Debris/Scree cards for detail areas.' },
                        randomize:         { title: 'Randomize',                   desc: 'Reseeds the random number generator, shifting all rock positions while keeping the same density and map inputs.', details: [['Effect','New seed = new position offsets for every rock'],['Density','Total count stays the same — only positions change'],['Non-destructive','Maps and settings are untouched']], tip: 'Use to break up repetitive patterns without changing any settings.' },
                        addcard:           { title: 'Add Rock Card',               desc: 'Creates a new rock card for an additional set of blueprints within the current rock type.', details: [['Independent','Each card has its own blueprint paths, color, and optional custom values'],['Same maps','All Erosion cards share the global erosion maps'],['Typical','2–3 cards per rock type for visual variety']], tip: 'Add cards with different blueprint sets — same maps, different prop visuals.' },
                        rockcard:          { title: 'Rock Card',                    desc: 'Contains blueprint paths, preview color, and optional custom values. One card = one set of rock blueprints.',details: [['Prop Name','Label in preview legend — cosmetic'],['Blueprints','One or more .bp paths — randomly selected per instance'],['Color','Canvas marker color'],['Custom Values','Override global density/diffusion/decimal per card']], tip: 'Use multiple cards with different blueprint sets for visual variety across the same placement area.' },
                        blueprints:        { title: 'Blueprint Paths',              desc: 'In-game asset paths to rock .bp files. One is randomly selected per placed rock instance.',details: [['Format','/env/Rocks/Props/boulder_01_prop.bp'],['Multiple paths','Random variety per instance'],['Game-relative','/env/ or /maps/ paths only — absolute paths break for other players'],['Library','Use Library to auto-fill — avoids path errors']], tip: 'Add 2–4 variants per card for natural visual variety.' },
                        blueprintlibrary:  { title: 'Blueprint Library',            desc: 'Browse FAF map rock props by biome and type. Auto-fills paths directly into this card.',details: [['Browse','Organized by biome and prop type'],['Multi-select','Pick multiple at once'],['Auto-fill','Paths added directly']], tip: 'Always use the Library for game-native props — faster and avoids path errors.' },
                        customvalues:      { title: 'Custom Values',                desc: 'Per-card overrides for Density Multiplier, Diffusion, and decimal precision. Use to mix sparse large-rock cards with dense small-rock cards.',details: [['Density Multiplier','Override global for this card only'],['Diffusion','Card-specific scatter'],['Decimal Places','Independent coordinate and heading precision']], tip: 'Give sparse large-boulder cards a low multiplier (0.3) and dense rubble cards a higher one (1.5).' },
                        generatereadme:    { title: 'Generate README',              desc: 'Writes a README.txt with a full record of all settings and rock counts alongside the output file.',details: [['Contains','Rock counts per card, all settings, timestamp'],['Purpose','Invaluable when revisiting a map weeks later']], tip: 'Always leave this enabled.' },
                        generatebtn:       { title: 'GENERATE FILES',               desc: 'Validates all inputs and writes the output Lua file with all rock types to your maps folder.',details: [['Requires','Maps Folder set, Map Name filled, at least one blueprint path'],['Output','Single _rocks.lua with CreateRotatedProp() calls'],['Re-run safe','Overwrites cleanly — iterate freely'],['In-game','Must reference in _scenario.lua to activate props']], tip: 'After generating, reference the output in your map _scenario.lua.' },
                        mirrormode:        { title: 'Mirror Mode',                  desc: 'Sets whether each generated rock position is also mirrored across the map.',details: [['No Mirror','Each rock placed once at its exact position'],['Diagonal','Mirror at (mapSize−X, mapSize−Z)'],['Horizontal','Mirror at same X, mapSize−Z'],['Vertical','Mirror at mapSize−X, same Z']], tip: 'Use Diagonal for symmetrical competitive maps to halve placement work.' },
                        deletepreview:     { title: 'Delete Preview',               desc: 'Removes the uploaded map background image from the canvas.',details: [['Effect','Clears image from localStorage'],['Rocks','Generated rock markers remain untouched']], tip: 'Upload a new image after deleting when switching maps.' },
                        uploadmap:         { title: 'Upload Map Image',             desc: 'Sets a top-down map image as the canvas background for visual reference when previewing rock placement.',details: [['Formats','PNG, JPG, WEBP'],['Storage','Saved in localStorage — persists between sessions'],['Source','Export from FA map editor or in-game screenshot']], tip: 'Makes it easy to check whether rocks end up in the correct terrain zones.' },
                        canvas:            { title: 'Preview Canvas',               desc: 'Shows a real-time preview of all generated rock positions as colored dots on the map.',details: [['Colors','Each rock card has its own canvas color'],['Updates','Auto-refreshes when maps or settings change'],['Randomize','Reseed button shuffles positions while keeping same density']], tip: 'Use with the map image uploaded to verify rocks fall in correct terrain areas.' },
                        legend:            { title: 'Rock Legend',                  desc: 'Shows all active rock cards with their preview colors and placement counts.',details: [['Content','Color + name + count per card'],['Mass/Energy','Total reclaim values shown when blueprints have mass defined'],['Read-only','Purely informational']], tip: 'Check counts after generating to verify expected density.' },
                        hintbox:           { title: 'Canvas Hint Box',              desc: 'Dynamic text showing the currently active mirror mode and any active generation notes.',details: [['Updates','Reflects current mirror mode setting']], tip: 'Glance here before each generation to confirm the mirror mode is correct.' },
                      };
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
                    })()}
                  </div>
                </div>
              )}
              {activeHelpTab === 'advanced' && (
                <div className="help-adv-layout">

                  <div className="help-adv-subtabs">
                    {[
                      { id: 'workflow',    label: 'Workflow' },
                      { id: 'erosionmaps', label: 'Erosion Maps' },
                      { id: 'rocktypes',   label: 'Rock Types' },
                      { id: 'sizeblend',   label: 'Size & Mass' },
                      { id: 'generate',    label: 'Generate' },
                    ].map(t => (
                      <button key={t.id}
                        className={`help-adv-subtab${activeAdvSubTab === t.id ? ' active' : ''}`}
                        onClick={() => setActiveAdvSubTab(t.id)}
                      >{t.label}</button>
                    ))}
                  </div>

                  {activeAdvSubTab === 'workflow' && (<>
                    <div className="help-adv-hero">
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">Full Workflow Overview</h2>
                        <p className="help-adv-hero-desc">Rock Erosion Generator places three rock types — Erosion, Debris, Scree — each driven by different input maps. The result is a single Lua file with geologically realistic rock placement.</p>
                      </div>
                      <div className="help-adv-button-showcase">
                        <svg viewBox="0 0 160 90" width="150" style={{ display: 'block' }}>
                          <rect width="160" height="90" fill="rgba(0,0,0,0.4)" rx="2"/>
                          {[{n:'1',x:16,l:'Config'},{n:'2',x:48,l:'Maps'},{n:'3',x:80,l:'Cards'},{n:'4',x:112,l:'Preview'},{n:'5',x:144,l:'Generate'}].map(({n,x,l},i)=>(
                            <g key={n}>
                              <circle cx={x} cy={30} r="11" fill={i<3?'rgba(255,175,0,0.85)':'rgba(255,175,0,0.18)'} stroke={i<3?'rgba(255,175,0,1)':'rgba(255,175,0,0.3)'} strokeWidth="1"/>
                              <text x={x} y={34} textAnchor="middle" fill={i<3?'#000':'rgba(255,175,0,0.5)'} fontSize="9" fontWeight="700">{n}</text>
                              <text x={x} y={56} textAnchor="middle" fill="rgba(255,175,0,0.4)" fontSize="6">{l}</text>
                              {i<4 && <line x1={x+11} y1={30} x2={x+25} y2={30} stroke="rgba(255,175,0,0.25)" strokeWidth="1.5" strokeDasharray="3,2"/>}
                            </g>
                          ))}
                        </svg>
                        <div className="help-adv-button-hint">5 steps to geological realism</div>
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Core Process</h3>
                      <div className="help-adv-timeline">
                        {[
                          { n:'01', title:'Configure', desc:'Map Name, Map Size, Maps Folder. Global Density, Diffusion, Grid Resolution, Size Blend Sigma.', subs:['Map name must match /maps folder exactly','Wrong Map Size scales all positions off','Set Maps Folder in Settings — persists'] },
                          { n:'02', title:'Upload Erosion Maps', desc:'Flow (where), Slope (probability), Wear (scale), Curvature (clustering), Heightmap (orientation).', subs:['All optional — more = more realism','Flow + Slope minimum for good results','Export from GIS using your map DEM'] },
                          { n:'03', title:'Set Up Rock Cards', desc:'Add cards per rock type. Add blueprints via Library. Set colors.', subs:['Erosion cards share global maps','Debris + Scree have per-card spawn maps','Multiple cards = blueprint variety'] },
                          { n:'04', title:'Preview and Tune', desc:'Upload map image. Adjust multipliers. Watch legend counts.', subs:['Randomize to reseed','Per-card Custom Values for independent density','Legend shows mass + energy totals'] },
                          { n:'05', title:'Generate', desc:'Single Lua output. Reference in _scenario.lua.', subs:['All rock types merged into one file','Re-run always safe','Must reference in scenario to activate'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num">{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4><p>{s.desc}</p>
                              <ul>{s.subs.map((sub, i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Troubleshooting</h3>
                      <div className="help-adv-ts-grid">
                        {[
                          ['No rocks generated','Maps Folder set? Map Name filled? At least one non-empty blueprint path per card?'],
                          ['Rocks in preview but not in-game','Generated .lua must be referenced in _scenario.lua.'],
                          ['Rocks clustered in one corner','Wrong Map Size — verify against _scenario.lua.'],
                          ['No preview markers with maps uploaded','Flow Mask too dark — needs bright areas for spawn probability to pass.'],
                        ].map(([q, a]) => (
                          <div key={q} className="help-adv-ts-item">
                            <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                            <div className="help-adv-ts-a"><p>{a}</p></div>
                          </div>
                        ))}
                      </div>
                    </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Best Practices</h3>
                      <div className="help-adv-practice-grid">
                        {[
                          ['Export Maps from GIS','Use QGIS with your map DEM to generate Flow, Slope, and Curvature maps — free, accurate results.'],
                          ['Multiple Cards for Variety','2–3 erosion cards with different blueprint sets = visual variety using the same erosion maps.'],
                          ['Debris for Manual Zones','Anything not geologically driven: ruins, shoreline, road rubble — Debris cards with hand-painted maps.'],
                          ['Start Sparse','Density Multiplier 0.3 first. Scale up after previewing. Rock fields look overdone quickly.'],
                          ['Match Blueprints to Biome','Desert sandstone, alpine granite. Mixing biomes looks immediately wrong.'],
                          ['Test One Card First','Generate one card, verify in-game, then add the rest.'],
                        ].map(([title, desc]) => (
                          <div key={title} className="help-adv-practice-card">
                            <span className="help-adv-practice-icon">
                              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                                <circle cx="13" cy="13" r="11" fill="rgba(255,175,0,0.1)" stroke="rgba(255,175,0,0.45)" strokeWidth="1.5"/>
                                <path d="M8 13l3.5 3.5 6.5-7" stroke="rgba(255,175,0,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </span>
                            <h4>{title}</h4><p>{desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>)}

                  {activeAdvSubTab === 'erosionmaps' && (<>
                    <div className="help-adv-hero">
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">Erosion Maps — Processing Pipeline</h2>
                        <p className="help-adv-hero-desc">The five maps work as a sequential pipeline. Each step gates or modifies the spawn decision. Understanding the order and math produces geologically accurate results.</p>
                      </div>
                      <div className="help-adv-button-showcase">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                          {[['Flow Mask','WHERE — primary gate'],['Slope Mask','HOW DENSE — probability'],['Erosion Wear','SCALE — combined with mass'],['Curvature Map','CLUSTERING — optional bonus'],['Heightmap','ORIENTATION — optional']].map(([name, role], i) => (
                            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', background: `rgba(255,175,0,${0.04 + i*0.02})`, border: '1px solid rgba(255,175,0,0.15)', fontSize: '0.72rem' }}>
                              <span style={{ color: 'var(--tab-color)', fontWeight: 700, fontFamily: 'monospace' }}>{name}</span>
                              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{role}</span>
                            </div>
                          ))}
                        </div>
                        <div className="help-adv-button-hint">All optional — more = more realistic</div>
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Pipeline Steps</h3>
                      <div className="help-adv-timeline">
                        {[
                          { n:'1', title:'Flow Mask gate', desc:'If uploaded and pixel is dark, stop — no rock here. Uses sigmoid so near-black also has low probability.', subs:['Hard gate — black always excluded','No Flow Mask = rocks can spawn anywhere'] },
                          { n:'2', title:'Slope probability', desc:'Modulates density. Mid-brightness = highest probability. Very steep or very flat slopes have lower probability.', subs:['Slope < 0.5: 10%→100%','Slope > 0.5: 100%→30%','Curvature bonus multiplied on top'] },
                          { n:'3', title:'Density check', desc:'Final gate. Density Multiplier × probability → random draw.', subs:['Per-card Custom Values override global','Clamped to 1.0 maximum'] },
                          { n:'4', title:'Wear + Mass → scale', desc:'wearScale from Erosion Wear brightness × massScale from blueprint ReclaimMassMax = combinedSize (UniformScale).', subs:['wearScale: getSizeFromBrightness() → [0.5, 1.75]','massScale: massToScale() log-normalized against median mass','Sigma adds noise for soft transitions'] },
                          { n:'5', title:'Heightmap → heading', desc:'Downslope direction calculated per cell if uploaded. Otherwise random 0–2π.', subs:['Calculates steepest descent direction','Most visible on elongated rock props'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num">{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4><p>{s.desc}</p>
                              <ul>{s.subs.map((sub, i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Map Reference</h3>
                      <div className="help-adv-card-grid">
                        {[
                          { title: 'Flow Mask', icon: '🌊', desc: 'Primary gate. Where debris accumulates after water erosion.', features: ['White = spawn allowed','Black = blocked always','Sigmoid curve for dark pixels','Source: flow accumulation from DEM'] },
                          { title: 'Slope Mask', icon: '📐', desc: 'Probability modifier. Mid-slope = densest rocks. Very steep/flat = sparser.', features: ['Mid-brightness = highest prob','Bright > 0.5 = drops to 30%','Combined with curvature bonus','Source: slope map from heightmap'] },
                          { title: 'Erosion Wear', icon: '🪨', desc: 'Rock scale factor. Multiplied by blueprint mass. Does NOT select separate size cards.', features: ['Bright → higher scale [up to 1.75]','Dark → lower scale [down to 0.5]','Combined: wearScale × massScale','Sigma smooths transitions'] },
                          { title: 'Curvature (Optional)', icon: '🏔', desc: 'Bonus in concave terrain. Hollows collect debris.', features: ['Optional — works without it','Dark concave = up to ×1.8 bonus','Bright convex = slight reduction','Source: curvature from DEM'] },
                          { title: 'Heightmap (Optional)', icon: '🧭', desc: 'Downslope orientation per rock. Random heading without it.', features: ['Optional','Steepest descent per cell','Subtle on rounded props','Use same heightmap as FA map'] },
                        ].map(item => (
                          <div key={item.title} className="help-adv-card">
                            <div className="help-adv-card-header">
                              <span className="help-adv-card-icon">{item.icon}</span>
                              <h4>{item.title}</h4>
                            </div>
                            <div className="help-adv-card-body">
                              <p className="help-adv-card-desc">{item.desc}</p>
                              <ul className="help-adv-card-features">{item.features.map((f, i) => <li key={i}>{f}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Troubleshooting</h3>
                      <div className="help-adv-ts-grid">
                        {[
                          ['Rocks appear in black Flow Mask areas','Check map is loaded — thumbnail must be visible. Failed upload = map treated as absent.'],
                          ['Slope mask removes all rocks','Very bright slope (>0.5) reduces probability by design. Use mid-range brightness for maximum density.'],
                          ['Curvature has no visible effect','Subtle by design. Use high-contrast map and verify thumbnail is visible.'],
                          ['Heightmap orientation wrong','Verify heightmap dimensions match your map.'],
                        ].map(([q, a]) => (
                          <div key={q} className="help-adv-ts-item">
                            <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                            <div className="help-adv-ts-a"><p>{a}</p></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>)}

                  {activeAdvSubTab === 'rocktypes' && (<>
                    <div className="help-adv-hero">
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">Rock Types — Erosion, Debris & Scree</h2>
                        <p className="help-adv-hero-desc">Three types with completely different placement logic. Each serves a distinct geological role. Combining all three creates a natural, layered rocky landscape.</p>
                      </div>
                      <div className="help-adv-button-showcase">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                          {[['Erosion','rgba(255,175,0,0.85)','Flow + Slope + Wear + Curvature + Heightmap'],['Debris','rgba(255,120,50,0.85)','Per-card Debris Map'],['Scree','rgba(210,160,80,0.85)','Per-card Scree Map + threshold']].map(([t,c,m])=>(
                            <div key={t} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${c.replace('0.85','0.25')}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: c, fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace' }}>{t}</span>
                              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' }}>{m}</span>
                            </div>
                          ))}
                        </div>
                        <div className="help-adv-button-hint">3 types × multiple cards each</div>
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Type Reference</h3>
                      <div className="help-adv-card-grid">
                        {[
                          { title: 'Erosion Rocks', icon: '🏔', desc: 'Geological core. Uses all erosion maps. Best for main rocky terrain driven by actual terrain data.', features: ['Driven by all 5 erosion maps','Scale = wearFactor × massFactor','Multiple cards = different blueprint pools, same maps','Per-card Custom Values for independent density'] },
                          { title: 'Debris Rocks', icon: '🪨', desc: 'Per-card Debris Map. Independent of erosion maps — rocks go wherever you paint the map.', features: ['Each card has its own map','Also uses Wear Map for scale if uploaded','Use for non-geological placement','Spawn threshold filters near-black pixels'] },
                          { title: 'Scree Rocks', icon: '⛰', desc: 'Per-card Scree Map with explicit threshold. Dense cliff-base rubble and talus slopes.', features: ['Each card has its own map','Spawn Threshold (0.0–1.0) filters dark pixels','Also uses Wear Map for scale','Heightmap orientation applied if uploaded'] },
                        ].map(item => (
                          <div key={item.title} className="help-adv-card">
                            <div className="help-adv-card-header">
                              <span className="help-adv-card-icon">{item.icon}</span>
                              <h4>{item.title}</h4>
                            </div>
                            <div className="help-adv-card-body">
                              <p className="help-adv-card-desc">{item.desc}</p>
                              <ul className="help-adv-card-features">{item.features.map((f, i) => <li key={i}>{f}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Best Practices</h3>
                      <div className="help-adv-practice-grid">
                        {[
                          ['Layer All Three','Erosion for geological base, Debris for specific zones, Scree for cliff-base accumulations.'],
                          ['Multiple Erosion Cards','2–3 cards with different blueprint sets — same erosion maps, different prop variety.'],
                          ['Scree Threshold 0.1','Always minimum 0.1 — avoids rocks in essentially-black areas.'],
                          ['Debris = Manual Control','When erosion logic is wrong for a specific area, Debris card + hand-painted map gives exact control.'],
                        ].map(([title, desc]) => (
                          <div key={title} className="help-adv-practice-card">
                            <span className="help-adv-practice-icon">
                              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                                <circle cx="13" cy="13" r="11" fill="rgba(255,175,0,0.1)" stroke="rgba(255,175,0,0.45)" strokeWidth="1.5"/>
                                <path d="M8 13l3.5 3.5 6.5-7" stroke="rgba(255,175,0,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </span>
                            <h4>{title}</h4><p>{desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>)}

                  {activeAdvSubTab === 'sizeblend' && (<>
                    <div className="help-adv-hero">
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">Size & Mass — How Rock Scale Works</h2>
                        <p className="help-adv-hero-desc">Visual scale is determined by two combined factors: Erosion Wear Map brightness and blueprint ReclaimMassMax. Both multiply together to produce the final UniformScale in the output. There are no separate "size class cards" — scale is a continuous value per instance.</p>
                      </div>
                      <div className="help-adv-button-showcase">
                        <svg viewBox="0 0 130 100" width="120" style={{ display: 'block' }}>
                          <rect width="130" height="100" fill="rgba(0,0,0,0.4)" rx="2"/>
                          <defs><linearGradient id="wg3" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#111"/><stop offset="100%" stopColor="#fff"/></linearGradient></defs>
                          <rect x="10" y="8" width="110" height="12" fill="url(#wg3)" rx="1"/>
                          <text x="10" y="32" fill="rgba(255,255,255,0.25)" fontSize="6" fontFamily="monospace">dark wear</text>
                          <text x="90" y="32" fill="rgba(255,255,255,0.6)" fontSize="6" fontFamily="monospace">bright wear</text>
                          {[[18,62,3,0.3],[35,58,5,0.4],[52,55,7,0.5],[69,52,10,0.6],[86,50,14,0.75],[103,48,19,0.9]].map(([x,y,r,o],i)=>(
                            <circle key={i} cx={x} cy={y} r={r} fill={`rgba(255,175,0,${o})`} stroke={`rgba(255,175,0,${o+0.1})`} strokeWidth="1"/>
                          ))}
                          <text x="65" y="90" textAnchor="middle" fill="rgba(255,175,0,0.4)" fontSize="6">wearScale × massScale = final size</text>
                        </svg>
                        <div className="help-adv-button-hint">Continuous scale, not discrete size classes</div>
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>The Two Scale Factors</h3>
                      <div className="help-adv-card-grid">
                        {[
                          { title: 'Wear Map → wearScale', icon: '🗺', desc: 'Wear brightness → scale factor [0.5, 1.75]. Size Blend Sigma adds noise to avoid hard zone boundaries.', features: ['getSizeFromBrightness(brightness, seed)','Bright pixel → wearScale up to 1.75','Dark pixel → wearScale down to 0.5','Sigma noise smooths transitions'] },
                          { title: 'Blueprint Mass → massScale', icon: '⚖', desc: 'ReclaimMassMax log-normalized against median of all known blueprints. Higher mass = larger scale.', features: ['massToScale(mass) = log(mass)/log(median)','Clamped [0.5, 1.75]','Unknown blueprints → massScale = 1.0','Built from Library scan or manual entries'] },
                          { title: 'Combined Scale', icon: '✕', desc: 'combinedSize = wearScale × massScale. This is the UniformScale written to the output Lua.', features: ['Range: roughly 0.25 to 3.0','High-mass + bright wear = largest','Low-mass + dark wear = smallest','Same for Erosion, Debris, and Scree cards'] },
                        ].map(item => (
                          <div key={item.title} className="help-adv-card">
                            <div className="help-adv-card-header">
                              <span className="help-adv-card-icon">{item.icon}</span>
                              <h4>{item.title}</h4>
                            </div>
                            <div className="help-adv-card-body">
                              <p className="help-adv-card-desc">{item.desc}</p>
                              <ul className="help-adv-card-features">{item.features.map((f, i) => <li key={i}>{f}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Wear Map → Scale</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px' }}>
                        {[
                          { label: 'Bright (200–255)', note: 'fresh terrain — low erosion', value: 'wearScale ≈ 1.3–1.75', state: 'active' },
                          { label: 'Mid (100–155)',    note: 'moderate erosion',             value: 'wearScale ≈ 0.9–1.2', state: 'edge' },
                          { label: 'Dark (0–55)',      note: 'heavy erosion — old terrain',  value: 'wearScale ≈ 0.5–0.8', state: 'excluded' },
                        ].map((row, ri) => {
                          const isActive = row.state === 'active', isEdge = row.state === 'edge';
                          return (
                            <div key={ri} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px',
                              background: isActive?'rgba(255,175,0,0.08)':isEdge?'rgba(255,255,255,0.03)':'transparent',
                              border:`1px solid ${isActive?'rgba(255,175,0,0.3)':isEdge?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.04)'}` }}>
                              <span style={{ width:'8px', height:'8px', borderRadius:'50%', flexShrink:0,
                                background: isActive?'var(--tab-color)':isEdge?'rgba(255,255,255,0.35)':'rgba(255,255,255,0.12)',
                                boxShadow: isActive?'0 0 6px var(--tab-glow)':'none' }}></span>
                              <code style={{ fontFamily:'monospace', fontSize:'0.78rem', flex:1, color: isActive?'rgba(255,255,255,0.85)':isEdge?'rgba(255,255,255,0.5)':'rgba(255,255,255,0.25)' }}>{row.label}</code>
                              <span style={{ fontSize:'0.68rem', fontStyle:'italic', color: isActive?'rgba(255,255,255,0.35)':'rgba(255,255,255,0.18)' }}>{row.note}</span>
                              <span style={{ fontSize:'0.75rem', fontWeight:700, padding:'2px 9px', fontFamily:'monospace',
                                background: isActive?'rgba(255,175,0,0.15)':'rgba(255,255,255,0.04)',
                                border:`1px solid ${isActive?'rgba(255,175,0,0.35)':'rgba(255,255,255,0.08)'}`,
                                color: isActive?'var(--tab-color)':'rgba(255,255,255,0.3)',
                                boxShadow: isActive?'0 0 8px var(--tab-glow)':'none' }}>{row.value}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="help-adv-note" style={{ marginTop:'16px' }}>
                        <strong>This wear scale is multiplied by the blueprint mass scale.</strong> A bright wear pixel with a high-mass blueprint gives the largest rock. Without the Wear Map, wearScale = 1.0 and only mass determines scale. Size Blend Sigma adds randomness to avoid sharp hard-edged size zones.
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Size Blend Sigma</h3>
                      <div className="help-adv-ts-grid">
                        {[
                          ['Sigma 1–20 (low)','Sharp transitions. Bright zones = distinctly large, dark zones = distinctly small. Hard visible boundaries.'],
                          ['Sigma 40–80 (default ~50)','Balanced. Transitions smooth but still directional. Most natural-looking for real geology.'],
                          ['Sigma 100–150 (high)','All sizes mix freely everywhere. Wear map still influences the trend but any size can appear anywhere.'],
                        ].map(([q, a]) => (
                          <div key={q} className="help-adv-ts-item">
                            <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                            <div className="help-adv-ts-a"><p>{a}</p></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>)}

                  {activeAdvSubTab === 'generate' && (<>
                    <div className="help-adv-hero">
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">Generate Files — Full Reference</h2>
                        <p className="help-adv-hero-desc">Validation, processing order, output format, and how to activate props in-game.</p>
                      </div>
                      <div className="help-adv-button-showcase">
                        <div className="help-adv-fake-button btn-primary">GENERATE FILES</div>
                        <div className="help-adv-button-hint">All three rock types in one pass</div>
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Generation Process</h3>
                      <div className="help-adv-timeline">
                        {[
                          { n:'1', title:'Validation', desc:'Maps Folder, Map Name, at least one non-empty blueprint path.', subs:['Missing Maps Folder = immediate error','Empty paths skipped silently'] },
                          { n:'2', title:'Erosion Rocks', desc:'Per sample point: Flow gate → Slope probability → curvature bonus → density check → Wear+mass scale → heading.', subs:['All erosion maps processed','combinedSize = wearScale × massScale','Heading from Heightmap or random'] },
                          { n:'3', title:'Debris + Scree', desc:'Each card processes its own spawn map independently.', subs:['Threshold applied for Scree cards','Wear Map scale applied if uploaded'] },
                          { n:'4', title:'File Write', desc:'All rock types merged into one Lua. README if enabled.', subs:['Single output file','CreateRotatedProp() per instance','Re-run always safe'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num">{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4><p>{s.desc}</p>
                              <ul>{s.subs.map((sub, i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Output</h3>
                      <div className="help-adv-file-tree">
                        <div className="help-adv-file-tree-header">maps/MyMap.v0001/</div>
                        <div className="help-adv-file-item highlight"><span>MyMap_rocks.lua</span><span className="help-adv-file-badge">main output</span></div>
                        <div className="help-adv-file-item file"><span>RockErosion_Generation_README.txt</span><span className="help-adv-file-size">if enabled</span></div>
                      </div>
                      <div className="help-adv-code-sample" style={{ marginTop: '16px' }}>
                        <div className="help-adv-code-label">Example output</div>
                        <pre>{`-- Erosion Rocks (142 instances)\nCreateRotatedProp('/env/Rocks/Props/boulder_01_prop.bp', 312.45, 0, 198.72, 1.57)\n\n-- Debris Rocks (87 instances)\nCreateRotatedProp('/env/Rocks/Props/rubble_01_prop.bp', 420.12, 0, 101.55, 2.84)`}</pre>
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Troubleshooting</h3>
                      <div className="help-adv-ts-grid">
                        {[
                          ['Output empty / 0 props','Flow Mask too dark, Density Multiplier 0, or Grid Resolution too low.'],
                          ['Props not in-game','Generated .lua must be referenced in _scenario.lua.'],
                          ['Wrong positions','Map Size mismatch — verify against _scenario.lua.'],
                          ['Debris/Scree missing','Each card needs its own Spawn Map uploaded.'],
                        ].map(([q, a]) => (
                          <div key={q} className="help-adv-ts-item">
                            <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                            <div className="help-adv-ts-a"><p>{a}</p></div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">04</span>Best Practices</h3>
                      <div className="help-adv-practice-grid">
                        {[
                          ['Verify In-Game First','Generate one card, place in FA editor, confirm it appears. Then add the rest.'],
                          ['Relative Paths Only','/env/ or /maps/ paths. Absolute Windows paths break for other players.'],
                          ['Regenerate Freely','Output always overwritten cleanly.'],
                          ['Enable README','Rock fields are complex — README records every setting.'],
                        ].map(([title, desc]) => (
                          <div key={title} className="help-adv-practice-card">
                            <span className="help-adv-practice-icon">
                              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                                <circle cx="13" cy="13" r="11" fill="rgba(255,175,0,0.1)" stroke="rgba(255,175,0,0.45)" strokeWidth="1.5"/>
                                <path d="M8 13l3.5 3.5 6.5-7" stroke="rgba(255,175,0,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </span>
                            <h4>{title}</h4><p>{desc}</p>
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
    </>
  );
}

export default RockErosionHelpModal;
