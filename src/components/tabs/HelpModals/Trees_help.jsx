import React from "react";

// ── Replica helpers (moved from Trees.jsx) ─────────────────────────────────

function _hl(sel, key) {
  return sel === key ? { outline: '2px solid rgba(0,255,102,0.85)', outlineOffset: '2px' } : {};
}
function TreesHelpReplica({ sel, setSel }) {
  function pick(key) { return { onClick: () => setSel(key), style: { cursor: 'pointer', ..._hl(sel, key) } }; }

// ─────────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ overflowY: 'visible', paddingRight: '0' }}>

      {/* ── CONFIGURATION ── */}
      <div className="section-card" style={{ marginBottom: '30px' }}>
        <h2 className="section-title">CONFIGURATION</h2>

        <div className="subsection-title">Map Details</div>
        <div className="form-group" {...pick('mapname')}>
          <label>Map Name</label>
          <input readOnly onChange={() => {}} className="form-input" placeholder="e.g. Hades_Dust.v0002" style={_hl(sel, 'mapname')} />
        </div>
        <div className="form-group" {...pick('mapsize')} style={{ marginBottom: '28px', ...(_hl(sel, 'mapsize')) }}>
          <div style={{
            marginTop: '6px',
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)',
            fontFamily: 'monospace',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'inherit' }}>MAP</span>
            <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>1024 × 1024</span>
            <span style={{ color: 'rgba(255,255,255,0.22)' }}>·</span>
            <span>20 km</span>
            <span style={{ color: 'rgba(255,255,255,0.22)' }}>·</span>
            <span style={{ color: 'rgba(255,255,255,0.28)' }}>playable 10 km</span>
          </div>
        </div>

        <div className="subsection-title">Decimals</div>
        <div className="treemap-grid-2" style={{ marginBottom: '28px' }}>
          <div {...pick('decimalcoords')} style={_hl(sel, 'decimalcoords')}>
            <label>Decimal Places (X/Z Coords)</label>
            <select style={{ pointerEvents: 'none' }}><option>2</option></select>
          </div>
          <div {...pick('decimalheading')} style={_hl(sel, 'decimalheading')}>
            <label>Decimal Places (Heading)</label>
            <select style={{ pointerEvents: 'none' }}><option>2</option></select>
          </div>
        </div>

        <div className="subsection-title">Density</div>
        <div className="form-group" {...pick('densitymap')}>
          <label>Density Map (brightness = spawn probability)</label>
          <button className="btn-secondary" style={{ width: '100%', pointerEvents: 'none', ..._hl(sel, 'densitymap') }}>Upload Density Map</button>
        </div>
        <div className="form-group" {...pick('densitymultiplier')}>
          <label>Density Multiplier</label>
          <input readOnly onChange={() => {}} className="form-input" value="1.0" style={_hl(sel, 'densitymultiplier')} />
        </div>
        <div className="form-group" {...pick('diffusion')}>
          <label>Diffusion (0–100)</label>
          <input readOnly onChange={() => {}} className="form-input" value="0" style={_hl(sel, 'diffusion')} />
        </div>
        <div className="form-group" {...pick('gridresolution')}>
          <label>Grid Resolution <span style={{ float: 'right', color: 'var(--tab-color)', fontSize: '0.78rem' }}>10000 points</span></label>
          <input readOnly onChange={() => {}} className="form-input" value="100" style={_hl(sel, 'gridresolution')} />
        </div>

        <div className="subsection-title">Treeline Heightmap</div>
        <div className="form-group" {...pick('heightmap')}>
          <button className="btn-secondary" style={{ width: '100%', pointerEvents: 'none', ..._hl(sel, 'heightmap') }}>Upload Heightmap</button>
        </div>
        <div className="form-group" {...pick('treelinecutoff')} style={_hl(sel, 'treelinecutoff')}>
          <label>Treeline Cutoff (0–255) <span style={{ float: 'right', color: 'var(--tab-color)' }}>200</span></label>
          <input readOnly onChange={() => {}} type="range" min="0" max="255" defaultValue="200" style={{ width: '100%', pointerEvents: 'none' }} />
          <input readOnly onChange={() => {}} className="form-input" value="200" style={{ marginBottom: '15px' }} />
        </div>
        <div className="form-group" {...pick('treelinegradient')} style={_hl(sel, 'treelinegradient')}>
          <label>Gradient Width <span style={{ float: 'right', color: 'var(--tab-color)' }}>30</span></label>
          <input readOnly onChange={() => {}} type="range" min="0" max="255" defaultValue="30" style={{ width: '100%', pointerEvents: 'none' }} />
          <input readOnly onChange={() => {}} className="form-input" value="30" style={{ marginBottom: '15px' }} />
        </div>
        <div className="form-group" {...pick('treelinemin')} style={_hl(sel, 'treelinemin')}>
          <label>Treeline Min (0–255) <span style={{ float: 'right', color: 'var(--tab-color)' }}>0</span></label>
          <input readOnly onChange={() => {}} type="range" min="0" max="255" defaultValue="0" style={{ width: '100%', pointerEvents: 'none' }} />
          <input readOnly onChange={() => {}} className="form-input" value="0" style={{ marginBottom: '15px' }} />
        </div>
        <div className="form-group" {...pick('treelinemingradient')} style={_hl(sel, 'treelinemingradient')}>
          <label>Min Gradient Width <span style={{ float: 'right', color: 'var(--tab-color)' }}>30</span></label>
          <input readOnly onChange={() => {}} type="range" min="0" max="255" defaultValue="30" style={{ width: '100%', pointerEvents: 'none' }} />
          <input readOnly onChange={() => {}} className="form-input" value="30" style={{ marginBottom: '15px' }} />
        </div>

        <div className="subsection-title">Exclusion Zone</div>
        <div className="form-group" {...pick('exclusionzone')}>
          <button className="btn-secondary" style={{ width: '100%', pointerEvents: 'none', ..._hl(sel, 'exclusionzone') }}>Upload Exclusion Zone</button>
        </div>

        <div className="subsection-title">Randomize</div>
        <div {...pick('randomize')}>
          <button className="btn-secondary" style={{ width: '100%', pointerEvents: 'none', ..._hl(sel, 'randomize') }}>Randomize</button>
        </div>
      </div>

      {/* ── PROPS CONFIGURATION ── */}
      <div className="section-card" style={{ marginBottom: '30px' }}>
        <h2 className="section-title" style={{ margin: 0 }}>Props Configuration</h2>

        <div style={{ marginTop: '20px' }}>
          {/* Single example prop card — shown as selected/expanded */}
          <div className="treemap-prop-card selected" style={{ marginBottom: '20px' }}>
            <div className="treemap-prop-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <div {...pick('propcolor')} className="treemap-color-indicator" style={{ backgroundColor: '#00FF66', ..._hl(sel, 'propcolor') }} />
                <div {...pick('propname')} style={{ flex: 1, ...(_hl(sel, 'propname')) }}>
                  <input readOnly onChange={() => {}} className="treemap-prop-name-input" value="Oak Trees" style={{ cursor: 'pointer' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button {...pick('deleteprop')} className="btn-delete-sm" style={_hl(sel, 'deleteprop')}>×</button>
              </div>
            </div>

            {/* Expanded content — treemap-prop-details mirrors the selected state */}
            <div className="treemap-prop-details">
              <div className="form-group">
                <label>Blueprints</label>
                <div className="input-row" {...pick('blueprintrow')} style={{ cursor: 'pointer', ...(_hl(sel, 'blueprintrow')) }}>
                  <input readOnly onChange={() => {}} className="form-input" placeholder="/maps/map.v0001/env/props/trees/oak.bp" style={{ fontFamily: 'Courier New, monospace', fontSize: '0.8rem', pointerEvents: 'none' }} />
                  <button className="btn-delete-sm" style={{ pointerEvents: 'none' }}>×</button>
                </div>
                <button {...pick('blueprintlibrary')} className="btn-library" style={{ width: '100%', ..._hl(sel, 'blueprintlibrary') }}>Library</button>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <button {...pick('customvalues')} className="btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'var(--tab-color)', color: 'var(--tab-color)', background: 'color-mix(in srgb, var(--tab-color) 8%, transparent)', pointerEvents: 'none', ..._hl(sel, 'customvalues') }}>
                  <span>Custom Values</span><span style={{ fontSize: '0.65rem', opacity: 0.6 }}>▼</span>
                </button>
                <button {...pick('determinearea')} className="btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', pointerEvents: 'none', ..._hl(sel, 'determinearea') }}>
                  <span>Determine Area</span><span style={{ fontSize: '0.65rem', opacity: 0.6 }}>▼</span>
                </button>
                <button {...pick('propdensitymap')} className="btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', pointerEvents: 'none', ..._hl(sel, 'propdensitymap') }}>
                  <span>Prop Density Map</span><span style={{ fontSize: '0.65rem', opacity: 0.6 }}>▼</span>
                </button>
              </div>
            </div>
          </div>

          {/* Add prop card */}
          <div {...pick('addpropcard')} className="treemap-add-prop-card" style={_hl(sel, 'addpropcard')}>
            <div className="treemap-add-prop-icon"><span style={{ fontSize: '2rem' }}>+</span></div>
            <span className="treemap-add-prop-text">ADD PROP CARD</span>
          </div>
        </div>
      </div>

      {/* ── GENERATE ── */}
      <div className="section-card" style={{ marginBottom: '14px' }}>
        <label {...pick('generatereadme')} className="checkbox-label" style={{ marginBottom: '16px', cursor: 'pointer', ..._hl(sel, 'generatereadme') }}>
          <div className="checkbox checked">
            <svg className="checkbox-check" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="checkbox-text">Generate README file</span>
        </label>
        <div {...pick('generatebtn')}>
          <button className="btn-primary btn-lg" style={{ pointerEvents: 'none', ..._hl(sel, 'generatebtn') }}>GENERATE FILES</button>
        </div>
      </div>
    </div>
  );
}


function TreesHelpModal({ onClose, activeHelpTab, setActiveHelpTab, helpGuideSelected, setHelpGuideSelected, activeAdvancedSubTab, setActiveAdvancedSubTab }) {
  return (
    <>
    <div className="help-modal-overlay" onClick={onClose} />
    <div
      className="help-modal"
      style={{ '--tab-color': 'var(--treemap-color)', '--tab-glow': 'var(--treemap-glow)', '--tab-glow-strong': 'var(--treemap-glow-strong)' }}
      onClick={e => e.stopPropagation()}
    >

      <div className="help-modal-header">
        <h2 className="help-modal-title">TreeMap Generator — Help Guide</h2>
        <button className="help-modal-close" onClick={onClose}>×</button>
      </div>

      <div className="help-modal-tabs">
        <button
          className={`help-modal-tab${activeHelpTab === 'help-guide' ? ' active' : ''}`}
          onClick={() => { setActiveHelpTab('help-guide'); setHelpGuideSelected(null); }}
        >Help Guide</button>
        <button
          className={`help-modal-tab${activeHelpTab === 'advanced' ? ' active' : ''}`}
          onClick={() => setActiveHelpTab('advanced')}
        >Advanced Guide</button>
      </div>

      <div className="help-modal-content">

        {activeHelpTab === 'help-guide' && (
          <div style={{ display: 'flex', gap: '40px', height: '100%' }}>

            <div style={{ flex: '0 0 auto', overflowY: 'auto', paddingRight: '20px', borderRight: '1px solid rgba(255,255,255,0.07)', maxWidth: '1350px' }}>
              <div style={{ padding: '8px 0 14px', fontSize: '0.72rem', color: 'rgba(0,255,102,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 9L9 2M9 2H4M9 2v5" stroke="rgba(0,255,102,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Click any element to learn about it
              </div>
              <div className="tab-grid" style={{ gridTemplateColumns: 'auto 1fr', maxWidth: 'none', margin: 0, alignItems: 'start' }}>
                <div className="tab-col-config" style={{ gap: '14px' }}>
                  <TreesHelpReplica sel={helpGuideSelected} setSel={setHelpGuideSelected} />
                </div>
                <div className="treemap-preview-column" style={{ position: 'static', alignSelf: 'start' }}>
                  <div className="section-card treemap-preview-card" style={{ marginBottom: '20px', cursor: 'pointer' }}
                    onClick={() => setHelpGuideSelected(helpGuideSelected === 'preview' ? null : 'preview')}>
                    <div style={{ outline: helpGuideSelected === 'preview' ? '2px solid rgba(0,255,102,0.85)' : 'none', outlineOffset: '4px' }}>
                      <div className="treemap-preview-header">
                        <h2 className="section-title" style={{ margin: 0, pointerEvents: 'none' }}>PREVIEW</h2>
                        <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
                          <div onClick={() => setHelpGuideSelected('mirrormode')} style={{ cursor: 'pointer', outline: helpGuideSelected === 'mirrormode' ? '2px solid rgba(0,255,102,0.85)' : 'none', outlineOffset: '2px' }}>
                            <select className="treemap-mirror-dropdown" style={{ pointerEvents: 'none' }}><option>No Mirror</option></select>
                          </div>
                          <div onClick={() => setHelpGuideSelected('deletepreview')} style={{ cursor: 'pointer', outline: helpGuideSelected === 'deletepreview' ? '2px solid rgba(0,255,102,0.85)' : 'none', outlineOffset: '2px' }}>
                            <button className="btn-delete-text" style={{ pointerEvents: 'none' }}>Delete Preview</button>
                          </div>
                        </div>
                      </div>
                      <div onClick={e => { e.stopPropagation(); setHelpGuideSelected('uploadmap'); }} style={{ cursor: 'pointer', outline: helpGuideSelected === 'uploadmap' ? '2px solid rgba(0,255,102,0.85)' : 'none', outlineOffset: '2px' }}>
                        <div className="treemap-upload-area" style={{ pointerEvents: 'none' }}><span>Click to upload map image</span></div>
                      </div>
                      <div onClick={e => { e.stopPropagation(); setHelpGuideSelected('canvas'); }} style={{ cursor: 'pointer', outline: helpGuideSelected === 'canvas' ? '2px solid rgba(0,255,102,0.85)' : 'none', outlineOffset: '2px' }}>
                        <div className="treemap-preview-container" style={{ position: 'relative', width: '700px', height: '700px', overflow: 'hidden' }}>
                          <div className="treemap-preview-placeholder" style={{ pointerEvents: 'none' }}><p>Upload a density map to place props</p></div>
                          {/* grid lines like the real canvas */}
                          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.07 }}>
                            {[1,2,3,4,5,6,7].map(i => (
                              <g key={i}>
                                <line x1={`${(i/8)*100}%`} y1="0" x2={`${(i/8)*100}%`} y2="100%" stroke="white" strokeWidth="1"/>
                                <line x1="0" y1={`${(i/8)*100}%`} x2="100%" y2={`${(i/8)*100}%`} stroke="white" strokeWidth="1"/>
                              </g>
                            ))}
                          </svg>
                          {[[15,22],[28,48],[42,16],[58,65],[72,38],[50,76],[25,70],[62,30],[80,55],[38,58],[88,20]].map(([x,y],i) => (
                            <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: '6px', height: '6px', borderRadius: '50%', background: '#00FF66', boxShadow: '0 0 5px rgba(0,255,102,0.9)', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
                          ))}
                        </div>
                      </div>
                      <div onClick={e => { e.stopPropagation(); setHelpGuideSelected('legend'); }} style={{ cursor: 'pointer', outline: helpGuideSelected === 'legend' ? '2px solid rgba(0,255,102,0.85)' : 'none', outlineOffset: '2px' }}>
                        <div className="preview-legend" style={{ pointerEvents: 'none' }}>
                          <div className="preview-legend-title">PROP LEGEND</div>
                          <div className="preview-legend-items">
                            {[['#00FF66','Oak Trees','142'],['#FF7B00','Pine Trees','87']].map(([c,n,ct]) => (
                              <div key={n} className="preview-legend-item">
                                <div className="preview-legend-color" style={{ backgroundColor: c }} />
                                <span>{n}</span>
                                <span className="preview-coord-count">{ct} pts</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="preview-hint-box" style={{ pointerEvents: 'none' }}>
                        Upload a density map to generate props — use Randomize to reseed placement
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ flex: '1', minWidth: 0, overflowY: 'auto', maxHeight: '80vh' }}>
              {!helpGuideSelected ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '320px', gap: '14px', textAlign: 'center' }}>
                  <svg width="42" height="42" viewBox="0 0 42 42" fill="none" style={{ opacity: 0.3 }}>
                    <path d="M30 12L12 30M12 14v16h16" stroke="rgba(0,255,102,1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.06em' }}>Select an element</div>
                  <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.16)', maxWidth: '200px', lineHeight: 1.7 }}>Click any field, button, or section on the left to learn what it does.</div>
                </div>
              ) : (() => {
                const INFO = {
                  mapname:           { title: 'Map Name',                desc: 'The exact folder name of your map inside /maps. Used to construct every output file path.',          details: [['Format','MapName.vXXXX — e.g. Silent_Dunes.v0001'],['Auto-version','Omitting .v0001 appends it automatically'],['Case-sensitive','FA is strict — match folder name exactly'],['Impact','Wrong name = broken paths = no props in-game']], tip: 'Copy the folder name directly from File Explorer to guarantee correct capitalisation.' },
                  mapsize:           { title: 'Map Size (auto-detected)', desc: 'Automatically read from the map\'s save.lua when a valid Map Name and Maps Folder are set. Controls coordinate scale across the entire output.',                    details: [['Auto-detection','Reads playable size from save.lua in the map folder'],['Fallback','Defaults to 1024 if save.lua is not found'],['Impact','Wrong size = all coordinates scaled off from reality'],['Read-only','Not manually editable — set by the map folder contents']], tip: 'Make sure your Map Name exactly matches the folder name so save.lua can be found and the size is read correctly.' },
                  mapsfolder:        { title: 'Maps Folder (via Settings)', desc: 'Absolute path to your SC /maps directory. Configured once in Settings and shared across all tabs — there is no folder picker in this tab itself.',                    details: [['Where to set','Open Settings and configure the Maps Folder there'],['Persist','Survives app restarts and applies to all tabs'],['Required','Generation fails if no maps folder is set'],['Typical path','Documents/My Games/.../Supreme Commander Forged Alliance/maps']], tip: 'Set the Maps Folder in Settings once — you never need to re-select it per session.' },
                  densitymap:        { title: 'Density Map',             desc: 'Grayscale image controlling where props are placed. White = maximum density, black = none.',         details: [['White (255)','100% spawn chance in this grid cell'],['Black (0)','No props placed here'],['Grey values','Proportional probability 0–100%'],['Any resolution','Downscaled internally to match the grid']], tip: 'Use soft brushes for natural forest edges. Hard edges look artificial.' },
                  densitymultiplier: { title: 'Density Multiplier',      desc: 'Global scale factor applied on top of the density map brightness to control total prop count.',    details: [['1.0','Default — no change'],['2.0','Twice as many props'],['0.5','Half as many'],['Per-card','Each card can override this with its own multiplier']], tip: 'Start low (0.3), preview, then scale up. Easier to add than to remove.' },
                  diffusion:         { title: 'Diffusion (0–100)',       desc: 'Random positional scatter within each grid cell. Prevents a visible regular grid pattern.',          details: [['0','Exact cell center — creates visible grid pattern'],['30–60','Natural forest scatter'],['100','Maximum scatter within cell']], tip: 'Values 40–60 work well for natural vegetation. Keep at 0 for perfectly aligned arrays.' },
                  gridresolution:    { title: 'Grid Resolution',         desc: 'Grid cell size in pixels. Higher resolution = smaller cells = finer, denser placement grid.',       details: [['Higher (e.g. 200px)','Smaller cells = more positions = finer detail'],['Lower (e.g. 50px)','Larger cells = fewer positions = coarser layout'],['Interaction','Pair with Density Multiplier to control count independently of grid fineness']], tip: 'Higher resolution gives finer grain. Use with a lower Density Multiplier to keep total count manageable.' },
                  exclusionzone:     { title: 'Exclusion Zone',          desc: 'Global mask. White pixels hard-block all prop placement regardless of all other settings.',         details: [['White','Blocked for ALL prop cards — highest priority'],['Black','Unaffected'],['Global','Applies to every prop card']], tip: 'Use to keep props off roads, spawn zones, shallow water, and cliff faces.' },
                  randomize:         { title: 'Randomize',               desc: 'Generates a new random seed to reshuffle prop placement without changing any settings.',             details: [['Effect','Different cells selected within same density/grid parameters'],['Nothing changes','Density, grid, and all settings stay the same']], tip: 'Run several times before generating — seed choice has a large visual impact.' },
                  decimalcoords:     { title: 'Decimal Places (X/Z)',    desc: 'Coordinate precision for X and Z values in the output files.',                                      details: [['2','FAF standard — compatible with all scripts'],['Higher','More precision — rarely needed']], tip: '2 decimal places is the FAF standard. No need to change unless you have a specific requirement.' },
                  decimalheading:    { title: 'Decimal Places (Heading)', desc: 'Precision of the rotation (heading) value written per prop.',                                      details: [['2','Standard — sufficient for all props'],['Higher','Only if doing custom rotation math']], tip: 'Keep at 2 unless you have a specific rotation precision requirement.' },
                  heightmap:         { title: 'Treeline Heightmap',      desc: 'Grayscale heightmap image. Restricts prop placement to a specific altitude band.',                 details: [['Pixel brightness','Represents terrain height: black = low, white = high'],['Effect','Props only placed where height is between Min and Cutoff'],['Optional','Without this image, no height filtering is applied']], tip: 'Use a heightmap export from the FA map editor for accurate altitude data.' },
                  treelinecutoff:    { title: 'Treeline Cutoff (0–255)', desc: 'Maximum height at which props still appear. Props above this value are removed.',                  details: [['0','No props anywhere on map'],['255','All heights allowed — filtering disabled'],['Gradient','Props fade out over the gradient band below this value']], tip: 'Typical alpine treelines use 160–220. Pair with gradient for a natural soft fade.' },
                  treelinegradient:  { title: 'Gradient Width',          desc: 'Width of the fade zone below Treeline Cutoff. Props thin out gradually within this band.',         details: [['0','Hard cut — abrupt artificial line at cutoff value'],['30','30-unit soft transition zone'],['Higher','Wider, more natural transition']], tip: 'Set 20–40 for realistic treelines. Zero gives an artificial hard edge.' },
                  treelinemin:       { title: 'Treeline Min (0–255)',     desc: 'Minimum height at which props appear. Props below this value are suppressed.',                     details: [['0','Disabled — all low elevations allowed'],['5–20','Keeps props just above sea level'],['Pair','Works symmetrically with Treeline Cutoff']], tip: 'Set to 5–20 to keep props off water edges and flooded lowlands.' },
                  treelinemingradient:{ title: 'Min Gradient Width',     desc: 'Fade zone above Treeline Min. Props ramp up gradually above the minimum.',                         details: [['0','Hard start from minimum — abrupt appearance'],['Higher','Wider ramp-up zone for smoother transition']], tip: 'Same logic as upper gradient — set both for a fully natural altitude range.' },
                  propcolor:         { title: 'Prop Color',              desc: 'Canvas marker color for this prop type. Visual only — no effect on generated output files.',       details: [['Purpose','Distinguishes prop types on the preview canvas and legend'],['No effect','Not written to any output file'],['Picker','Click the dot to open the color picker']], tip: 'Use strongly distinct colors when working with multiple prop types simultaneously.' },
                  propname:          { title: 'Prop Name',               desc: 'Label for this prop card. Shown in the preview legend only — not written to output.',              details: [['Purpose','Visual label in canvas legend'],['No output effect','Purely cosmetic — not written to files']], tip: 'Use the actual prop type name (e.g. "Oak Trees") for easy identification.' },
                  deleteprop:        { title: 'Delete Prop Card',        desc: 'Removes this prop card and all its settings. The last card is reset rather than deleted.',         details: [['Irreversible','All settings, blueprints, and overrides for this card are lost'],['Last card','Reset to defaults rather than deleted']], tip: 'Double-check blueprint paths before deleting — they cannot be recovered.' },
                  blueprintrow:      { title: 'Blueprint Path',          desc: 'In-game asset path to the prop blueprint (.bp) file.',                                             details: [['Format','/maps/MyMap.v0001/env/props/trees/oak01.bp'],['Multiple paths','Generator picks one randomly per prop instance for visual variety'],['Library','Use Library button to auto-fill — avoids path errors']], tip: 'Always use game-relative paths starting with /maps/. Absolute paths break for other players.' },
                  blueprintlibrary:  { title: 'Blueprint Library',       desc: 'Opens the Props Library — browse FAF map props organized by biome and type.',                      details: [['Browse','Organized by biome and prop type'],['Multi-select','Pick multiple props at once'],['Auto-fill','Paths added directly to this card — no typing']], tip: 'Always use the Library for game-native props — faster and prevents path errors.' },
                  customvalues:      { title: 'Custom Values',           desc: 'Per-card overrides for density, diffusion, decimal places, and treeline settings.',                details: [['Density Multiplier','Overrides global multiplier for this card only'],['Diffusion','Card-specific scatter override'],['Decimal places','Coord and heading precision override per card'],['Custom Treeline','Separate heightmap + cutoff, min, and gradient values per card — active only when a heightmap is uploaded in that section']], tip: 'Use to give oak trees 2× density of pine trees while sharing the same global density map.' },
                  determinearea:     { title: 'Determine Area',          desc: 'Per-card placement mask. White = allow, black = block. Only affects this prop card.',              details: [['White','Placement allowed in this area'],['Black','Placement blocked — overrides density'],['vs Exclusion Zone','This is per-card only, not global']], tip: 'Use to restrict specific prop types to their natural biome zones on the map.' },
                  propdensitymap:    { title: 'Prop Density Map',        desc: 'Per-card density map override. Completely replaces the global density map for this card only.',    details: [['Overrides','The global density map for this card only'],['Purpose','Different distribution pattern per prop type on the same map']], tip: 'Useful when you want dense rocks in one region and sparse trees in another.' },
                  addpropcard:       { title: '+ Add Prop Card',         desc: 'Creates a new prop card with default settings.',                                                   details: [['Independent','Own blueprints, color, density overrides, and treeline settings'],['Merged output','All cards combined into one single output file']], tip: 'Add all prop card types before tuning settings — working with the full picture is easier.' },
                  generatereadme:    { title: 'Generate README',         desc: 'Includes a README.txt in the output with settings summary and prop counts.',                       details: [['Contains','All prop counts, settings used, generation timestamp'],['Purpose','Documentation for sharing maps and reconstructing settings later']], tip: 'Keep enabled — useful for understanding what was generated weeks later.' },
                  generatebtn:       { title: 'GENERATE FILES',          desc: 'Validates everything, writes chunk files, and automatically injects them into your .scmap binary in one click.',               details: [['Requires','Maps Folder + Map Name + at least one blueprint path per card + density map'],['Process','Write props.lua → unpack .scmap → inject → repack'],['Re-run safe','Existing files are overwritten cleanly'],['Progress','A progress bar tracks each step']], tip: 'Mirror Mode settings are baked into the output — make sure it is set correctly before generating.' },
                  preview:           { title: 'Preview Panel',           desc: 'The right column of the app. Shows prop placement dots on your map in real time.',                details: [['Canvas','Colored dots = placed prop instances, colored by prop card'],['Legend','Shows all active cards with live coord counts'],['Background','Upload any top-down map image as reference'],['Updates live','Refreshes instantly as you change density and grid settings']], tip: 'Click any element in the preview to learn what it does.' },
                  canvas:            { title: 'Preview Canvas',          desc: 'Visual overlay showing prop placement dots on your map. Upload a map image as background.',       details: [['Dots','Each colored dot = one placed prop instance'],['Colors','Match each prop card color from the legend'],['Background','Upload any top-down map image as a reference layer'],['Live','Updates instantly on every setting change']], tip: 'The canvas updates live as you change density and grid settings.' },
                  mirrormode:        { title: 'Mirror Mode',             desc: 'Mirrors prop placement across one or both axes. Mirrored props are included in the generated output — this is not just a visual preview setting.',                details: [['None','No mirroring — props placed as-is'],['Diagonal','Mirrors across both horizontal and vertical axes — doubles total prop count'],['Horizontal','Mirrors top-to-bottom — doubles total prop count'],['Vertical','Mirrors left-to-right — doubles total prop count'],['Output','Mirrored instances are written to the output file with correct reflected coordinates and headings']], tip: 'Enable Mirror Mode before generating — mirrored props are always included in the file output.' },
                  uploadmap:         { title: 'Upload Map Image',        desc: 'Upload a top-down map preview image as a reference background for the canvas.',                    details: [['Formats','PNG, JPG, WEBP'],['Storage','Saved in localStorage — persists between sessions'],['Source','Export from FA map editor or an in-game screenshot']], tip: 'The image scales automatically to fill the canvas.' },
                  deletepreview:     { title: 'Delete Preview Image',    desc: 'Removes the uploaded map image and resets the canvas to a plain background.',                     details: [['Effect','Clears image from localStorage and resets canvas'],['Coordinates','Prop markers remain untouched — only background removed']], tip: 'Upload a new image after deleting when switching between different maps.' },
                  legend:            { title: 'Prop Legend',             desc: 'Shows all active prop cards with their canvas colors and live placement counts.',                  details: [['Color dot','Matches the prop card color, sized 26×26px'],['Count','Live placement count for this prop type'],['Read-only','Purely informational']], tip: 'Check all counts here before generating — this is exactly what will be written to the output.' },
                };
                const sel = INFO[helpGuideSelected];
                if (!sel) return null;
                return (
                  <div className="help-adv-layout" style={{ padding: 0 }}>
                    <div className="help-adv-hero" style={{ marginBottom: '24px' }}>
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">{sel.title}</h2>
                        <p className="help-adv-hero-desc">{sel.desc}</p>
                      </div>
                    </div>
                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header">
                        <span className="help-adv-section-num">01</span>Details
                      </h3>
                      <div className="help-adv-card-grid" style={{ gridTemplateColumns: '1fr' }}>
                        <div className="help-adv-card">
                          <div className="help-adv-card-body">
                            <ul className="help-adv-card-features">
                              {sel.details.map(([label, value], i) => (
                                <li key={i}><strong>{label}:</strong> {value}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="help-adv-note" style={{ marginTop: '16px' }}>
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
                { id: 'workflow',  label: 'Workflow' },
                { id: 'config',    label: 'Configuration' },
                { id: 'density',   label: 'Density Maps' },
                { id: 'treelines', label: 'Treelines' },
                { id: 'propsetup', label: 'Prop Setup' },
                { id: 'generate',  label: 'Generate' },
              ].map(t => (
                <button
                  key={t.id}
                  className={`help-adv-subtab${activeAdvancedSubTab === t.id ? ' active' : ''}`}
                  onClick={() => setActiveAdvancedSubTab(t.id)}
                >{t.label}</button>
              ))}
            </div>

            {(() => {
              function TI({ items }) {
                return (
                  <div className="help-adv-ts-grid">
                    {items.map(([q, a]) => (
                      <div key={q} className="help-adv-ts-item">
                        <div className="help-adv-ts-q">
                          <span className="help-adv-ts-icon" ></span>
                          <strong>{q}</strong>
                        </div>
                        <div className="help-adv-ts-a"><p>{a}</p></div>
                      </div>
                    ))}
                  </div>
                );
              }
              function PC({ items }) {
                return (
                  <div className="help-adv-practice-grid">
                    {items.map(([title, desc]) => (
                      <div key={title} className="help-adv-practice-card">
                        <span className="help-adv-practice-icon">
                          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                            <circle cx="13" cy="13" r="11" fill="rgba(0,255,102,0.1)" stroke="rgba(0,255,102,0.45)" strokeWidth="1.5" />
                            <path d="M8 13l3.5 3.5 6.5-7" stroke="rgba(0,255,102,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <h4>{title}</h4>
                        <p>{desc}</p>
                      </div>
                    ))}
                  </div>
                );
              }
              function TC({ items }) {
                return (
                  <div className="help-adv-card-grid">
                    {items.map(item => (
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
                );
              }

              if (activeAdvancedSubTab === 'workflow') return (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Full Workflow Overview</h2>
                    <p className="help-adv-hero-desc">Follow these steps from start to finish. Each step builds on the last — do not skip on your first run.</p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <svg viewBox="0 0 160 80" width="150" style={{ display: 'block' }}>
                      <rect width="160" height="80" fill="rgba(0,0,0,0.4)" rx="2" />
                      {[{n:'1',x:16,l:'Config'},{n:'2',x:48,l:'Props'},{n:'3',x:80,l:'Density'},{n:'4',x:112,l:'Preview'},{n:'5',x:144,l:'Generate'}].map(({n,x,l},i) => (
                        <g key={n}>
                          <circle cx={x} cy={30} r="11" fill={i < 3 ? 'rgba(0,255,102,0.85)' : 'rgba(0,255,102,0.18)'} stroke={i < 3 ? 'rgba(0,255,102,1)' : 'rgba(0,255,102,0.3)'} strokeWidth="1" />
                          <text x={x} y={34} textAnchor="middle" fill={i < 3 ? '#000' : 'rgba(0,255,102,0.5)'} fontSize="9" fontWeight="700">{n}</text>
                          <text x={x} y={56} textAnchor="middle" fill="rgba(0,255,102,0.4)" fontSize="6">{l}</text>
                          {i < 4 && <line x1={x+11} y1={30} x2={x+25} y2={30} stroke="rgba(0,255,102,0.25)" strokeWidth="1.5" strokeDasharray="3,2" />}
                        </g>
                      ))}
                    </svg>
                    <div className="help-adv-button-hint">5 steps to production output</div>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Core Process</h3>
                  <div className="help-adv-timeline">
                    {[
                      { n:'01', title:'Configure Map Settings', desc:'Enter Map Name, Map Size (1024), select /maps folder.', subs:['Map name must exactly match folder — FA is case-sensitive','Wrong Map Size shifts all coordinates proportionally','Set Maps Folder in Settings once — persists across sessions'] },
                      { n:'02', title:'Create Prop Cards',       desc:'One card per prop type. Add blueprint paths via Library. Set distinct color per card.', subs:['Use Library — typing paths manually is error-prone','Multiple blueprint paths = random variety per instance','Each card is independent — own density, treeline, area mask'] },
                      { n:'03', title:'Upload Density Map',      desc:'Grayscale image: white = dense, black = none. Upload as global Density Map.', subs:['Soft brushes create natural forest edges','Paint separate layers per prop type, export as separate PNGs','Exclusion Zone globally blocks spawn areas, roads, water'] },
                      { n:'04', title:'Preview and Tune',        desc:'Upload top-down map image. Adjust Density Multiplier, Diffusion, Grid Resolution. Click Randomize.', subs:['Watch live prop count badge on each card','Randomize several times — seed has large visual impact','Per-card custom values let you mix dense undergrowth with sparse trees'] },
                      { n:'05', title:'Generate Files',          desc:'Click GENERATE FILES. Props are written as chunk files, auto-injected into the .scmap, and the map is repacked automatically.', subs:['Progress bar shows each step: write → unpack → inject → repack','No _scenario.lua change needed — props are baked into the .scmap binary','Re-running is safe — existing chunk files are overwritten','Mirror Mode is included in the output — set it correctly before generating'] },
                    ].map(s => (
                      <div key={s.n} className="help-adv-step">
                        <div className="help-adv-step-num">{s.n}</div>
                        <div className="help-adv-step-content">
                          <h4>{s.title}</h4>
                          <p>{s.desc}</p>
                          <ul>{s.subs.map((sub, i) => <li key={i}>{sub}</li>)}</ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Best Practices</h3>
                  <PC items={[
                    ['Paint Density in Layers', 'Separate image layers per prop type, export individual PNGs — fine-grained control with minimal extra work.'],
                    ['Start Sparse', 'Begin with Density Multiplier 0.3, get the layout right, then scale up. Easier to add than remove.'],
                    ['Randomize Often', 'Click Randomize 3–5 times and pick the best seed. Small changes make a large visual difference.'],
                    ['Combine Treeline + Exclusion', 'Height filtering for peaks, Exclusion Zone for spawns and roads. Together they cover most real maps.'],
                  ]} />
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Troubleshooting</h3>
                  <TI items={[
                    ['Nothing happens after clicking Generate', 'Check Maps Folder is set, Map Name is filled, and at least one prop card has a non-empty blueprint path.'],
                    ['Props visible in preview but not in-game', 'Check that the .scmap was repacked without errors — the progress bar shows each step including repacking. Props are baked into the binary, so a failed repack means they are not in the map.'],
                    ['Randomize has no visible effect', 'Make sure a density map is uploaded. Without a density map there are no candidates to reshuffle.'],
                  ]} />
                </div>
              </>);

              if (activeAdvancedSubTab === 'config') return (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Configuration Deep Dive</h2>
                    <p className="help-adv-hero-desc">Map Name and Maps Folder are the two settings you configure here. Map Size is auto-detected from your map's save.lua — setting the name correctly is what makes that work.</p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <svg viewBox="0 0 130 90" width="120" style={{ display: 'block' }}>
                      <rect width="130" height="90" fill="rgba(0,0,0,0.4)" rx="2" />
                      <rect x="8" y="10" width="114" height="16" fill="rgba(0,255,102,0.1)" stroke="rgba(0,255,102,0.3)" strokeWidth="1" rx="1" />
                      <text x="65" y="22" textAnchor="middle" fill="rgba(0,255,102,0.7)" fontSize="8" fontFamily="monospace">Silent_Dunes.v0001</text>
                      <rect x="8" y="32" width="114" height="16" fill="rgba(0,255,102,0.06)" stroke="rgba(0,255,102,0.2)" strokeWidth="1" rx="1" />
                      <text x="65" y="44" textAnchor="middle" fill="rgba(0,255,102,0.5)" fontSize="8" fontFamily="monospace">1024</text>
                      <rect x="8" y="54" width="114" height="16" fill="rgba(0,255,102,0.04)" stroke="rgba(0,255,102,0.15)" strokeWidth="1" rx="1" />
                      <text x="65" y="66" textAnchor="middle" fill="rgba(0,255,102,0.4)" fontSize="8" fontFamily="monospace">/maps/...</text>
                    </svg>
                    <div className="help-adv-button-hint">name / auto-size / folder — the three foundations</div>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Field Reference</h3>
                  <TC items={[
                    { title: 'Map Name',    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="5" width="14" height="10" rx="1" stroke="rgba(0,255,102,0.7)" strokeWidth="1.5"/><path d="M2 8h14M6 5V3h6v2" stroke="rgba(0,255,102,0.5)" strokeWidth="1.5" strokeLinecap="round"/></svg>, desc: 'Exact folder name in /maps. Drives all output file paths.', features: ['Must match folder exactly — FA is case-sensitive','Format: MapName.vXXXX (e.g. Silent_Dunes.v0001)','Omitting .v0001 is fine — auto-appended','Wrong name = all generated paths broken'] },
                    { title: 'Map Size',   icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="14" height="14" stroke="rgba(0,255,102,0.7)" strokeWidth="1.5" fill="none"/><path d="M2 9h14M9 2v14" stroke="rgba(0,255,102,0.4)" strokeWidth="1" strokeDasharray="2,2"/></svg>, desc: 'Auto-detected from save.lua when Map Name and Maps Folder are set. Used to scale all output coordinates.', features: ['Read from save.lua — not manually editable','Falls back to 1024 if save.lua is not found','Wrong name or missing folder = fallback size = wrong coordinates','Displayed as a status line below the Map Name field'] },
                    { title: 'Maps Folder',icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 5h5l2 2h7a1 1 0 011 1v6a1 1 0 01-1 1H2a1 1 0 01-1-1V6a1 1 0 011-1z" stroke="rgba(0,255,102,0.7)" strokeWidth="1.5" fill="none"/></svg>, desc: 'Absolute path to /maps directory. Configured once in Settings — there is no folder picker in this tab.', features: ['Set in Settings, not in this tab','Required — generation fails without it','Typical: Documents/My Games/.../maps','Persists across all sessions once set in Settings'] },
                  ]} />
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Troubleshooting</h3>
                  <TI items={[
                    ['Files appear in wrong subfolder', 'Check for leading/trailing spaces in the map name — they are included in the output path verbatim.'],
                    ['Maps folder not saved between sessions', 'The Maps Folder must be set in Settings — it is not configured inside this tab. Once set in Settings it persists automatically.'],
                    ['Props appear at wrong location in-game', 'Verify Map Size matches the actual map exactly. A mismatch scales all coordinates proportionally off.'],
                  ]} />
                </div>
              </>);

              if (activeAdvancedSubTab === 'density') return (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Density Maps — Full Reference</h2>
                    <p className="help-adv-hero-desc">Density maps are the primary tool for controlling where and how densely props appear. Understanding global, per-card, and exclusion layers gives you complete control.</p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <svg viewBox="0 0 140 110" width="130" style={{ display: 'block' }}>
                      <rect width="140" height="110" fill="rgba(0,0,0,0.5)" rx="2" />
                      <defs><linearGradient id="dg2" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#000" /><stop offset="100%" stopColor="#fff" /></linearGradient></defs>
                      <rect x="8" y="10" width="124" height="18" fill="url(#dg2)" rx="1" />
                      <text x="8" y="42" fill="rgba(255,255,255,0.25)" fontSize="7">0%</text>
                      <text x="110" y="42" fill="rgba(255,255,255,0.7)" fontSize="7">100%</text>
                      {[[20,0.1],[45,0.35],[70,0.65],[95,0.88],[120,1.0]].map(([x,o],i) => (
                        <g key={i}>{Array.from({length:Math.round(o*6)}).map((_,j) => (
                          <circle key={j} cx={x+(j%2)*5-2} cy={62+Math.floor(j/2)*8} r="2.5" fill={`rgba(0,255,102,${o*0.85})`} />
                        ))}</g>
                      ))}
                      <text x="70" y="104" textAnchor="middle" fill="rgba(0,255,102,0.3)" fontSize="7">brightness = probability</text>
                    </svg>
                    <div className="help-adv-button-hint">Pixel brightness = spawn probability</div>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Grid Resolution — Visual Comparison</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '24px' }}>
                    {[
                      { label: 'Low Res (50px)',  cells: 3, desc: 'Large cells — coarse — fewer positions' },
                      { label: 'Mid Res (100px)', cells: 5, desc: 'Balanced — standard default' },
                      { label: 'High Res (200px)',cells: 8, desc: 'Small cells — fine grain — more positions' },
                    ].map(({ label, cells, desc }) => (
                      <div key={label} style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(0,255,102,0.15)', padding: '14px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--tab-color)', letterSpacing: '0.08em', marginBottom: '10px', textTransform: 'uppercase' }}>{label}</div>
                        <svg viewBox={`0 0 ${cells*20} ${cells*20}`} width="100%" style={{ display: 'block', marginBottom: '8px', maxHeight: '90px' }}>
                          {Array.from({length:cells}).map((_,r) => Array.from({length:cells}).map((_,c) => {
                            const has = (r*cells+c)%3 !== 0;
                            return (<g key={`${r}-${c}`}><rect x={c*20} y={r*20} width="20" height="20" fill="none" stroke="rgba(0,255,102,0.2)" strokeWidth="0.5"/>{has && <circle cx={c*20+10} cy={r*20+10} r="3" fill="rgba(0,255,102,0.8)"/>}</g>);
                          }))}
                        </svg>
                        <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.38)', lineHeight: 1.5 }}>{desc}</div>
                      </div>
                    ))}
                  </div>
                  <div className="help-adv-note" style={{ marginTop: '16px' }}>
                    <strong>Grid Resolution:</strong> Higher value = smaller cells = more positions = finer detail. Lower value = larger cells = fewer positions = coarser layout.
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Density Layer Stack</h3>
                  <TC items={[
                    { title: 'Global Density Map',      icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="14" height="14" stroke="rgba(0,255,102,0.6)" strokeWidth="1.5" fill="none"/></svg>, desc: 'Main density image applied to all cards without a per-card override.', features: ['White (255) = 100% spawn chance','Black (0) = 0%','Grey = proportional probability','Soft gradients = natural forest edges'] },
                    { title: 'Exclusion Zone',           icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="rgba(255,80,80,0.7)" strokeWidth="1.5" fill="none"/><path d="M5 5l8 8M13 5L5 13" stroke="rgba(255,80,80,0.7)" strokeWidth="1.5" strokeLinecap="round"/></svg>, desc: 'Global hard-block mask. Highest priority — overrides everything.', features: ['White = blocked for ALL cards','Black = unaffected','Use for roads, spawns, water edges'] },
                    { title: 'Per-Card Density Map',     icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="14" height="14" stroke="rgba(0,255,102,0.6)" strokeWidth="1.5" fill="none"/><path d="M2 9h14M9 2v14" stroke="rgba(0,255,102,0.35)" strokeWidth="1" strokeDasharray="2,2"/></svg>, desc: 'Completely overrides the global map for that card only.', features: ['Uploaded inside Card > Custom Values','Same grayscale format','Empty = falls back to global density map'] },
                    { title: 'Determine Area (per card)', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 15l4-4 4 4 4-8" stroke="rgba(0,255,102,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>, desc: 'Per-card placement mask — white = allow, black = block.', features: ['Only affects the card it belongs to','Combine with density map for biome control'] },
                  ]} />
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Parameter Interaction</h3>
                  <div className="help-adv-timeline">
                    {[
                      { n:'M', title:'Density Multiplier', def:'default 1.0',    desc:'Scales spawn probability across all cells. Does not change cell count.', formula:'probability = (pixel/255) × multiplier' },
                      { n:'R', title:'Grid Resolution',    def:'higher = finer', desc:'Cell size. Higher = smaller cells = more candidates = finer detail.', formula:'cell_count ~ (map_size / resolution)²' },
                      { n:'D', title:'Diffusion',          def:'default 0',      desc:'Random scatter within cell. 0 = exact center (grid visible). 100 = fully random.', formula:'pos = cell_center + rand(0,diffusion) × cell_size' },
                    ].map(r => (
                      <div key={r.title} className="help-adv-step">
                        <div className="help-adv-step-num" style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{r.n}</div>
                        <div className="help-adv-step-content">
                          <h4>{r.title} <code style={{ fontSize: '0.72rem', opacity: 0.5, fontWeight: 400, textTransform: 'none' }}>({r.def})</code></h4>
                          <p>{r.desc}</p>
                          <div className="help-adv-code-block"><code>{r.formula}</code></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">04</span>Troubleshooting</h3>
                  <TI items={[
                    ['Too many / too few props', 'Adjust Density Multiplier. Also check Grid Resolution — higher value = more candidates.'],
                    ['Visible regular grid pattern', 'Increase Diffusion to 30–60. Zero places every prop at the exact cell center.'],
                    ['Exclusion zone not fully working', 'Low-resolution mask causes sampling errors at boundaries. Use a higher-resolution image.'],
                    ['Per-card density map not applying', 'Uploaded inside the correct prop card Custom Values section? Not the global Density Map slot.'],
                  ]} />
                </div>
              </>);

              if (activeAdvancedSubTab === 'treelines') return (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Treeline and Heightmap Filtering</h2>
                    <p className="help-adv-hero-desc">Restricts prop placement to a specific altitude band — essential for realistic alpine treelines, snowfield separation, and lowland vegetation zones.</p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <svg viewBox="0 0 140 120" width="130" style={{ display: 'block' }}>
                      <rect width="140" height="120" fill="rgba(0,0,0,0.5)" rx="2" />
                      <polygon points="0,100 35,20 70,60 100,8 140,100" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                      <line x1="0" y1="42" x2="140" y2="42" stroke="var(--tab-color)" strokeWidth="1.5" strokeDasharray="5,3" opacity="0.85" />
                      <line x1="0" y1="78" x2="140" y2="78" stroke="rgba(0,255,102,0.4)" strokeWidth="1" strokeDasharray="4,3" />
                      <rect x="0" y="52" width="140" height="22" fill="rgba(0,255,102,0.05)" />
                      <rect x="0" y="42" width="140" height="10" fill="rgba(0,255,102,0.09)" />
                      <text x="4" y="38" fill="rgba(0,255,102,0.9)" fontSize="7" fontFamily="monospace">cutoff</text>
                      <text x="4" y="91" fill="rgba(0,255,102,0.45)" fontSize="7" fontFamily="monospace">min</text>
                      <text x="55" y="67" fill="rgba(0,255,102,0.6)" fontSize="7">props here</text>
                      {[[30,64],[55,60],[72,70],[92,66],[115,68],[38,74]].map(([x,y],i) => (
                        <circle key={i} cx={x} cy={y} r="2.5" fill="rgba(0,255,102,0.85)" />
                      ))}
                    </svg>
                    <div className="help-adv-button-hint">Props placed only within the green band</div>
                  </div>
                </div>

                {(() => {
                  const W=720, H=420, PAD_L=48, PAD_R=220, PAD_T=20, PAD_B=24;
                  const CW=W-PAD_L-PAD_R, CH=H-PAD_T-PAD_B;
                  const minVal=40, cutoff=200, gradLo=30, gradUp=30;
                  const gradLoEnd=minVal+gradLo, gradUpStart=cutoff-gradUp;
                  const ty = v => PAD_T + CH - (v/255)*CH;
                  const yCutoff=ty(cutoff), yGradUpStart=ty(gradUpStart), yGradLoEnd=ty(gradLoEnd), yMin=ty(minVal);
                  const mPts=[[0,26],[0.04,34],[0.08,28],[0.13,52],[0.17,44],[0.22,72],[0.26,65],[0.31,98],[0.35,88],[0.40,128],[0.44,118],[0.49,155],[0.53,145],[0.57,178],[0.61,195],[0.64,245],[0.67,230],[0.71,205],[0.75,185],[0.79,162],[0.83,138],[0.87,108],[0.91,80],[0.95,55],[1.0,34]];
                  const terrainD=[...mPts,[1,0],[0,0]].map(([f,v],i)=>`${i===0?'M':'L'}${PAD_L+f*CW},${ty(v)}`).join(' ')+'Z';
                  const terrainLine=mPts.map(([f,v],i)=>`${i===0?'M':'L'}${PAD_L+f*CW},${ty(v)}`).join(' ');
                  const xR=PAD_L+CW+18;
                  return (
                    <div style={{ marginBottom:'36px',background:'rgba(0,0,0,0.45)',border:'1px solid rgba(0,255,102,0.15)',overflow:'hidden' }}>
                      <div style={{ padding:'13px 22px 11px',borderBottom:'1px solid rgba(0,255,102,0.08)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                        <span style={{ fontSize:'0.7rem',fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase',color:'rgba(0,255,102,0.65)' }}>Height Band Visualizer</span>
                        <div style={{ display:'flex',gap:'18px' }}>
                          {[['Min','40','rgba(0,255,102,0.55)'],['Min Gradient','30','rgba(0,255,102,0.38)'],['Cutoff','200','rgba(0,255,102,0.98)'],['Cutoff Gradient','30','rgba(0,255,102,0.38)']].map(([l,v,c])=>(
                            <div key={l} style={{ textAlign:'center' }}>
                              <div style={{ fontSize:'0.62rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.22)',marginBottom:'2px' }}>{l}</div>
                              <div style={{ fontSize:'0.82rem',fontWeight:700,fontFamily:'monospace',color:c }}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display:'block',height:`${H}px` }}>
                        <defs>
                          <linearGradient id="v4-mtn" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="rgba(175,175,185,0.20)"/><stop offset="100%" stopColor="rgba(90,90,100,0.38)"/></linearGradient>
                          <linearGradient id="v4-band" gradientUnits="userSpaceOnUse" x1="0" y1={ty(cutoff)} x2="0" y2={ty(minVal)}>
                            <stop offset="0%" stopColor="rgba(0,255,102,0.0)"/>
                            <stop offset={`${(gradUp/(cutoff-minVal))*100}%`} stopColor="rgba(0,255,102,0.35)"/>
                            <stop offset={`${((cutoff-minVal-gradLo)/(cutoff-minVal))*100}%`} stopColor="rgba(0,255,102,0.35)"/>
                            <stop offset="100%" stopColor="rgba(0,255,102,0.0)"/>
                          </linearGradient>
                          <filter id="v4-lineglow"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                          <clipPath id="v4-clip"><rect x={PAD_L} y={PAD_T} width={CW} height={CH}/></clipPath>
                        </defs>
                        <rect x={PAD_L} y={PAD_T} width={CW} height={CH} fill="rgba(0,0,0,0.22)"/>
                        {[64,128,192].map(v=>(<line key={v} x1={PAD_L} y1={ty(v)} x2={PAD_L+CW} y2={ty(v)} stroke="rgba(255,255,255,0.035)" strokeWidth="1"/>))}
                        <rect x={PAD_L} y={yCutoff} width={CW} height={yMin-yCutoff} fill="url(#v4-band)" clipPath="url(#v4-clip)"/>
                        <path d={terrainD} fill="url(#v4-mtn)" clipPath="url(#v4-clip)"/>
                        <path d={terrainLine} fill="none" stroke="rgba(210,210,220,0.5)" strokeWidth="1.4" clipPath="url(#v4-clip)"/>
                        <line x1={PAD_L} y1={yCutoff} x2={PAD_L+CW} y2={yCutoff} stroke="rgba(0,255,102,0.9)" strokeWidth="1.8" filter="url(#v4-lineglow)"/>
                        <text x={PAD_L-10} y={yCutoff+4} textAnchor="end" fill="rgba(0,255,102,0.9)" fontSize="11" fontFamily="monospace" fontWeight="700">{cutoff}</text>
                        <line x1={PAD_L} y1={yGradUpStart} x2={PAD_L+CW} y2={yGradUpStart} stroke="rgba(0,255,102,0.42)" strokeWidth="1.2" strokeDasharray="4,4"/>
                        <text x={PAD_L-10} y={yGradUpStart+4} textAnchor="end" fill="rgba(0,255,102,0.42)" fontSize="10" fontFamily="monospace">{gradUpStart}</text>
                        <text x={xR} y={yCutoff-6} fill="rgba(0,255,102,0.95)" fontSize="12" fontFamily="monospace" fontWeight="700">Cutoff  {cutoff}</text>
                        <text x={xR} y={yCutoff+8} fill="rgba(255,255,255,0.38)" fontSize="10" fontFamily="monospace">hard block — no spawn at or above</text>
                        {(()=>{ const mid=(yCutoff+yGradUpStart)/2; const xB=xR-6; return (<g><line x1={xB} y1={yCutoff+1} x2={xB} y2={yGradUpStart-1} stroke="rgba(0,255,102,0.35)" strokeWidth="1"/><text x={xR+2} y={mid-5} fill="rgba(0,255,102,0.62)" fontSize="11" fontFamily="monospace" fontWeight="700">Gradient  {gradUp}</text><text x={xR+2} y={mid+8} fill="rgba(255,255,255,0.32)" fontSize="10" fontFamily="monospace">cutoff − {gradUp} = {gradUpStart}</text></g>); })()}
                        <line x1={PAD_L} y1={yGradLoEnd} x2={PAD_L+CW} y2={yGradLoEnd} stroke="rgba(0,255,102,0.42)" strokeWidth="1.2" strokeDasharray="4,4"/>
                        <text x={PAD_L-10} y={yGradLoEnd+4} textAnchor="end" fill="rgba(0,255,102,0.42)" fontSize="10" fontFamily="monospace">{gradLoEnd}</text>
                        {(()=>{ const mid=(yGradUpStart+yGradLoEnd)/2; return (<g><text x={xR} y={mid-5} fill="rgba(0,255,102,0.85)" fontSize="12" fontFamily="monospace" fontWeight="700">Full Spawn</text><text x={xR} y={mid+9} fill="rgba(255,255,255,0.32)" fontSize="10" fontFamily="monospace">probability = 1.0</text></g>); })()}
                        {(()=>{ const mid=(yGradLoEnd+yMin)/2; const xB=xR-6; return (<g><line x1={xB} y1={yGradLoEnd+1} x2={xB} y2={yMin-1} stroke="rgba(0,255,102,0.35)" strokeWidth="1"/><text x={xR+2} y={mid-5} fill="rgba(0,255,102,0.62)" fontSize="11" fontFamily="monospace" fontWeight="700">Min Gradient  {gradLo}</text><text x={xR+2} y={mid+8} fill="rgba(255,255,255,0.32)" fontSize="10" fontFamily="monospace">min + {gradLo} = {gradLoEnd}</text></g>); })()}
                        <line x1={PAD_L} y1={yMin} x2={PAD_L+CW} y2={yMin} stroke="rgba(0,255,102,0.72)" strokeWidth="1.6"/>
                        <text x={PAD_L-10} y={yMin+4} textAnchor="end" fill="rgba(0,255,102,0.72)" fontSize="11" fontFamily="monospace" fontWeight="700">{minVal}</text>
                        <text x={xR} y={yMin+14} fill="rgba(0,255,102,0.78)" fontSize="12" fontFamily="monospace" fontWeight="700">Min  {minVal}</text>
                        <text x={xR} y={yMin+28} fill="rgba(255,255,255,0.38)" fontSize="10" fontFamily="monospace">hard block — no spawn at or below</text>
                        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T+CH} stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
                        <text x={14} y={PAD_T+CH/2} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="9" fontFamily="monospace" letterSpacing="0.1em" transform={`rotate(-90,14,${PAD_T+CH/2})`}>HEIGHT  (RGB 0 – 255)</text>
                        <line x1={PAD_L} y1={PAD_T+CH} x2={PAD_L+CW} y2={PAD_T+CH} stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
                      </svg>
                    </div>
                  );
                })()}
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Settings Reference</h3>
                  <TC items={[
                    { title: 'Heightmap Image', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><polyline points="1,17 5,6 9,10 13,3 17,7" fill="none" stroke="rgba(0,255,102,0.7)" strokeWidth="1.5" strokeLinejoin="round"/></svg>, desc: 'Grayscale image where pixel brightness = terrain height.', features: ['Black = lowest terrain | White = highest','Export from FA map editor for precision','No heightmap = no height filtering applied at all'] },
                    { title: 'Treeline Cutoff', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><line x1="1" y1="8" x2="17" y2="8" stroke="rgba(0,255,102,0.8)" strokeWidth="1.5" strokeDasharray="3,2"/><path d="M1 16l4-8 4 4 4-12 4 4" stroke="rgba(0,255,102,0.4)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>, desc: 'Maximum height where props appear. Above = removed.', features: ['0 = no props | 255 = no upper limit','Typical alpine treeline: 160–220','Gradient fades props out over the band below Cutoff'] },
                    { title: 'Treeline Min',    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><line x1="1" y1="12" x2="17" y2="12" stroke="rgba(0,255,102,0.6)" strokeWidth="1.5" strokeDasharray="3,2"/><path d="M1 16l4-8 4 4 4-12 4 4" stroke="rgba(0,255,102,0.4)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>, desc: 'Minimum height where props appear. Below = suppressed.', features: ['0 = disabled | 5–20 = above sea level','Works symmetrically to Cutoff','Min Gradient ramps props up from Min value'] },
                    { title: 'Gradient Widths', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 14c4-8 10-8 14-4" stroke="rgba(0,255,102,0.7)" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>, desc: 'Fade zones at both height boundaries — removes hard edges.', features: ['0 = hard pixel-exact line','20–40 = natural-looking forest fade','Upper: props thin out approaching Cutoff','Lower: props ramp up above Min'] },
                  ]} />
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Troubleshooting</h3>
                  <TI items={[
                    ['No props at all after uploading heightmap', 'Cutoff may be 0 or Min too high — no valid band. Reset to defaults (Cutoff: 200, Min: 0).'],
                    ['Hard visible line at treeline', 'Gradient Width is 0. Set to 20–40.'],
                    ['Props appearing in water', 'Set Treeline Min to 5–15.'],
                    ['Per-card treeline not overriding global', 'Upload heightmap inside the prop card Custom Values > Custom Treeline section.'],
                  ]} />
                </div>
              </>);

              if (activeAdvancedSubTab === 'propsetup') return (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Prop Card Setup — Full Reference</h2>
                    <p className="help-adv-hero-desc">Each Prop Card is an independent placement unit with its own blueprints, density overrides, and area masks. All cards are merged into a single output file.</p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <svg viewBox="0 0 130 80" width="120" style={{ display: 'block' }}>
                      <rect width="130" height="80" fill="rgba(0,0,0,0.4)" rx="2" />
                      <rect x="8" y="8" width="114" height="28" fill="rgba(0,255,102,0.08)" stroke="rgba(0,255,102,0.3)" strokeWidth="1" rx="1" />
                      <circle cx="20" cy="22" r="6" fill="#00FF66" />
                      <rect x="32" y="17" width="60" height="10" fill="rgba(255,255,255,0.1)" rx="1" />
                      <text x="96" y="26" fill="rgba(0,255,102,0.8)" fontSize="9" fontWeight="700">142</text>
                      <rect x="8" y="42" width="114" height="14" fill="rgba(0,255,102,0.04)" stroke="rgba(0,255,102,0.15)" strokeWidth="1" rx="1" />
                      <rect x="8" y="60" width="114" height="14" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" rx="1" strokeDasharray="3,2" />
                      <text x="65" y="70" textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="7">+ Add Prop Card</text>
                    </svg>
                    <div className="help-adv-button-hint">1 card = 1 prop type</div>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Field Reference</h3>
                  <TC items={[
                    { title: 'Blueprint Paths',  icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="3" width="14" height="12" rx="1" stroke="rgba(0,255,102,0.6)" strokeWidth="1.5" fill="none"/><line x1="5" y1="7" x2="13" y2="7" stroke="rgba(0,255,102,0.5)" strokeWidth="1.5" strokeLinecap="round"/><line x1="5" y1="10" x2="10" y2="10" stroke="rgba(0,255,102,0.3)" strokeWidth="1.5" strokeLinecap="round"/></svg>, desc: 'In-game paths to .bp files. Multiple paths = random variety per instance.', features: ['Format: /maps/MapName.v0001/env/props/trees/oak01.bp','Game-relative paths only — absolute paths break on other machines','One path picked randomly per placed prop instance','Use Library to auto-fill — avoids path errors'] },
                    { title: 'Blueprint Library', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="3" height="14" rx="1" stroke="rgba(0,255,102,0.6)" strokeWidth="1.5" fill="none"/><rect x="7" y="2" width="3" height="14" rx="1" stroke="rgba(0,255,102,0.6)" strokeWidth="1.5" fill="none"/><rect x="12" y="2" width="4" height="14" rx="1" stroke="rgba(0,255,102,0.6)" strokeWidth="1.5" fill="none"/></svg>, desc: 'Browse FAF map props by biome and type.', features: ['Select multiple props at once','Auto-fills correct game paths','Prerequisite: library scan run in Settings'] },
                    { title: 'Color Dot',         icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" fill="rgba(0,255,102,0.3)" stroke="rgba(0,255,102,0.7)" strokeWidth="1.5"/></svg>, desc: 'Marker color in preview canvas and legend. Visual only.', features: ['No effect on generated files','Use distinct colors for each card type','Click to open color picker'] },
                    { title: 'Custom Values',     icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2v3M9 13v3M2 9h3M13 9h3" stroke="rgba(0,255,102,0.5)" strokeWidth="1.5" strokeLinecap="round"/><circle cx="9" cy="9" r="3" stroke="rgba(0,255,102,0.8)" strokeWidth="1.5" fill="none"/></svg>, desc: 'Per-card overrides for all global density and treeline settings.', features: ['Density Multiplier override','Diffusion override','Decimal places override','Custom Treeline: heightmap + cutoff/min/gradient'] },
                  ]} />
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Troubleshooting</h3>
                  <TI items={[
                    ['Prop count stays 0 with density map loaded', 'Density Multiplier above 0? Grid Resolution not producing zero candidates? Density map bright enough?'],
                    ['Every placed prop uses the same model', 'Add multiple blueprint paths. With only one path, every instance uses that single model.'],
                    ['Blueprint paths not generating props', 'Paths must be game-relative starting with /maps/ or /env/. FA is case-sensitive on filenames.'],
                  ]} />
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Best Practices</h3>
                  <PC items={[
                    ['Use Relative Paths', 'Always start with /maps/ — absolute Windows paths break for anyone who downloads your map from the FAF vault.'],
                    ['Add 3–5 Blueprint Variants', 'Multiple paths create visual diversity. 3–5 variants is the sweet spot between variety and complexity.'],
                    ['Add All Cards First', 'Set up all prop types before tuning density — working with the full picture is easier than adjusting in isolation.'],
                  ]} />
                </div>
              </>);

              if (activeAdvancedSubTab === 'generate') return (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Generate Files</h2>
                    <p className="help-adv-hero-desc">Transform your prop card configuration and density map into production-ready Supreme Commander prop placement files in a single click. The tool samples your density map, applies treeline filtering, respects exclusion zones, and writes all output files to your maps folder automatically.</p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <div className="help-adv-fake-button btn-primary">GENERATE FILES</div>
                    <div className="help-adv-button-hint">Writes all prop cards into one output file</div>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Generation Process</h3>
                  <div className="help-adv-timeline">
                    {[
                      { n:'1', title:'Validation Check', desc:'System validates all required inputs before writing any files.', subs:['Map name is set','Maps folder is selected','At least one prop card has a non-empty blueprint path','Density map is uploaded'] },
                      { n:'2', title:'Prop Placement Sampling', desc:'Density map is sampled on a jittered grid. Per-pixel brightness determines spawn probability. Treeline and exclusion zone filters applied.', subs:['Grid cell candidates filtered by density brightness','Treeline cutoff/min/gradient applied per pixel','Exclusion zone white pixels hard-blocked'] },
                      { n:'3', title:'Blueprint Assignment & File Write', desc:'One blueprint path randomly selected per prop instance. Output written to target file. README generated if enabled.', subs:['Random heading (0–2π) per instance for natural variation','All prop cards merged into one output file','SCMAP mode splits at 5,000 props per chunk'] },
                    ].map(s => (
                      <div key={s.n} className="help-adv-step">
                        <div className="help-adv-step-num">{s.n}</div>
                        <div className="help-adv-step-content">
                          <h4>{s.title}</h4>
                          <p>{s.desc}</p>
                          <ul>{s.subs.map((sub, i) => <li key={i}>{sub}</li>)}</ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Output Mode</h3>
                  <TC items={[
                    { title: 'SCMAP Binary (only mode)',    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="3" width="14" height="12" rx="1" stroke="rgba(0,255,102,0.6)" strokeWidth="1.5" fill="none"/><path d="M6 7h6M6 10h4" stroke="rgba(0,255,102,0.4)" strokeWidth="1.5" strokeLinecap="round"/></svg>, desc: 'Props are written as props.lua chunk files and injected directly into your .scmap binary. No separate Lua script is produced.', features: ['Output: props.lua (or props1.lua, props2.lua for >5,000 props)','Tool automatically unpacks the .scmap, injects the chunks, and repacks','Props are baked directly into the binary map file','No _scenario.lua change needed — props are embedded in the .scmap'] },
                  ]} />
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Generated File Structure</h3>
                  <div className="help-adv-file-tree">
                    <div className="help-adv-file-tree-header">maps/MyMap.v0001/</div>
                    <div className="help-adv-file-item highlight"><span>props.lua</span><span className="help-adv-file-badge">SCMAP chunk (≤5000 props)</span></div>
                    <div className="help-adv-file-item file"><span>props1.lua, props2.lua …</span><span className="help-adv-file-size">if &gt;5000 props</span></div>
                    <div className="help-adv-file-item file"><span>TreeMap_Generation_README.txt</span><span className="help-adv-file-size">README</span></div>
                    <div className="help-adv-file-item folder" style={{ marginTop: '8px', opacity: 0.5 }}><span>All chunks are auto-injected into the .scmap — no manual step needed.</span></div>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">04</span>Generated File Contents</h3>
                  <TC items={[
                    {
                      title: 'SCMAP Chunk Output (props.lua)',
                      icon: '⚙️',
                      desc: 'A Lua table returned by the file. Each entry is one prop with full position, rotation matrix, and scale data. The tool automatically unpacks your .scmap, copies the chunk(s) in, and repacks.',
                      features: ['Format: return { { path = "...", position = {...}, rotationX = {...}, rotationY = {...}, rotationZ = {...}, scale = {...} }, ... }','Random heading: each prop gets a random rotation (0–2π), stored as a 3×3 rotation matrix','Y = 0 in position: terrain height is resolved at runtime by the engine','Chunked at 5,000: large maps split into numbered files (props1.lua, props2.lua …) — all are injected automatically','No scenario change needed: props are baked directly into the .scmap binary'],
                    },
                  ]} />
                  <div className="help-adv-code-sample" style={{ marginTop: '16px' }}>
                    <div className="help-adv-code-label">SCMAP chunk — example output (props.lua)</div>
                    <pre>{`return {\n    {\n        path = "/maps/MyMap.v0001/env/props/trees/oak01.bp",\n        position = {\n            312.45,\n            0,\n            198.72,\n        },\n        rotationX = {\n            0.71,\n            0,\n            -0.71,\n        },\n        rotationY = {\n            0,\n            1,\n            0,\n        },\n        rotationZ = {\n            0.71,\n            0,\n            0.71,\n        },\n        scale = {\n            1,\n            1,\n            1,\n        },\n    },\n}`}</pre>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">05</span>Troubleshooting</h3>
                  <TI items={[
                    ['Error: "Please select the Maps folder first"', 'Configure the maps folder in Settings. The Maps Folder is a global setting — there is no folder picker inside this tab.'],
                    ['Props not appearing in-game', 'Check that the .scmap was repacked successfully — the progress bar shows each step. If repacking failed, the binary was not updated. Also verify blueprint paths are valid game paths.'],
                    ['Generated file is empty or has 0 props', 'Check: density map is uploaded and non-black, Density Multiplier is above 0, Grid Resolution is not set too high relative to density.'],
                    ['Wrong output path / wrong map folder', 'Extra spaces in Map Name? Maps Folder pointing to a map subfolder instead of the /maps root? Check both.'],
                    ['Only part of the props appear (SCMAP chunking)', 'For maps with >5,000 props, multiple chunk files are created. All chunks are injected automatically — if some are missing, check for errors during the pack step.'],
                    ['Mirror mode doubled prop count unexpectedly', 'Mirror mode is active in the output — it is not just a preview setting. Set Mirror Mode to "No Mirror" before generating if you do not want mirrored props in the output.'],
                  ]} />
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">06</span>Best Practices</h3>
                  <PC items={[
                    ['Test With a Small Density Map First', 'Start with a density map covering a small area and 2–3 prop cards. Verify they appear in-game before scaling to the full map.'],
                    ['Regenerate Freely', 'You can regenerate as many times as needed. The tool overwrites existing files, so your latest settings are always applied cleanly.'],
                    ['Backup Your Maps Folder', 'Before a major regeneration, copy your map folder as a backup. This lets you revert if something goes wrong.'],
                    ['Check Mirror Mode Before Generating', 'Mirror mode is included in the output — not just the preview. Confirm it is set correctly before hitting Generate.'],
                    ['Enable README for Collaboration', 'The README records every setting. Sharing it with collaborators or your future self prevents "what settings did I use?" confusion.'],
                  ]} />
                </div>
              </>);

              return null;
            })()}

          </div>
        )}

      </div>
    </div>
  </>
  );
}

export default TreesHelpModal;
