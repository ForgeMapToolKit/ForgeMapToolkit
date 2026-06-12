import React from "react";

function SkyboxGeneratorHelpModal({ onClose, activeHelpTab, setActiveHelpTab, helpSelected, setHelpSelected, activeAdvSubTab, setActiveAdvSubTab }) {
  return (
    <>
        <>
          <div className="help-modal-overlay" onClick={onClose} />
          <div className="help-modal"
            style={{ '--tab-color': 'var(--skybox-generator-color)', '--tab-glow': 'var(--skybox-generator-glow)', '--tab-glow-strong': 'var(--skybox-generator-glow-strong)' }}
            onClick={e => e.stopPropagation()}>

            <div className="help-modal-header">
              <h2 className="help-modal-title">Skybox Generator — Help Guide</h2>
              <button className="help-modal-close" onClick={onClose}>✕ Close</button>
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

                  {/* LEFT: interactive replica */}
                  <div style={{ flex: '0 0 auto', overflowY: 'auto', paddingRight: '20px', borderRight: '1px solid rgba(255,255,255,0.06)', maxWidth: '1100px' }}>
                    <div style={{ padding: '8px 0 14px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--tab-color)', fontSize: '1rem', opacity: 0.6 }}>↗</span> Click any element to learn about it
                    </div>

                    <div className="tab-grid" style={{ gridTemplateColumns: 'auto 1fr', maxWidth: 'none', margin: 0 }}>

                      {/* ── ATMOSPHERE column ── */}
                      <div className="tab-col-config" style={{ width: '400px' }}>

                        {/* Map Context */}
                        <div className="section-card">
                          <h2 className="section-title">MAP CONTEXT</h2>
                          {[['mapname','Map Name','Hades_Dust.v0002'],['mapsize','Map Size','1024']].map(([key,lbl,ph]) => (
                            <div key={key} className="form-group" style={{ cursor:'pointer', outline: helpSelected===key?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                              onClick={() => setHelpSelected(key)}>
                              <label className="form-label">{lbl}</label>
                              <input readOnly onChange={() => {}} className="form-input" placeholder={ph} />
                            </div>
                          ))}
                        </div>

                        {/* Dome */}
                        <div className="section-card">
                          <h2 className="section-title">DOME</h2>
                          {[['subtractheight','Subtract Height','1.2566'],['subdivaxis','Subdivisions Axis','16'],['subdivheight','Subdivisions Height','6']].map(([key,lbl,ph]) => (
                            <div key={key} className="form-group" style={{ cursor:'pointer', outline: helpSelected===key?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                              onClick={() => setHelpSelected(key)}>
                              <label className="form-label">{lbl}</label>
                              <input readOnly onChange={() => {}} className="form-input" placeholder={ph} />
                            </div>
                          ))}
                        </div>

                        {/* Colors & Heights */}
                        <div className="section-card">
                          <h2 className="section-title">COLORS & HEIGHTS</h2>
                          <div style={{ display:'flex', gap:'12px' }}>
                            {[['horizoncolor','Horizon Color'],['zenithcolor','Zenith Color']].map(([key,lbl]) => (
                              <div key={key} className="form-group" style={{ flex:1, cursor:'pointer', outline: helpSelected===key?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                                onClick={() => setHelpSelected(key)}>
                                <label className="form-label">{lbl}</label>
                                <input type="color" readOnly onChange={() => {}} className="form-input" style={{ height:'42px', padding:'4px 8px' }} defaultValue={key==='horizoncolor'?'#a5d1d6':'#3869b8'} />
                              </div>
                            ))}
                          </div>
                          {[['horizonheight','Horizon Height','-42.5'],['zenithheight','Zenith Height','293.5']].map(([key,lbl,ph]) => (
                            <div key={key} className="form-group" style={{ cursor:'pointer', outline: helpSelected===key?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                              onClick={() => setHelpSelected(key)}>
                              <label className="form-label">{lbl}</label>
                              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                                <div style={{ flex:1, height:'4px', background:'rgba(255,255,255,0.08)', position:'relative' }}>
                                  <div style={{ position:'absolute', left:0, top:0, height:'100%', width:'40%', background:'var(--tab-color)', opacity:0.6 }}/>
                                </div>
                                <input readOnly onChange={() => {}} className="form-input" style={{ width:'80px', flex:'none' }} placeholder={ph} />
                              </div>
                            </div>
                          ))}
                          <div className="form-group" style={{ cursor:'pointer', outline: helpSelected==='decalglow'?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                            onClick={() => setHelpSelected('decalglow')}>
                            <label className="form-label">Decal Glow Multiplier</label>
                            <input readOnly onChange={() => {}} className="form-input" placeholder="0.1" />
                          </div>
                        </div>

                        {/* Textures */}
                        <div className="section-card">
                          <h2 className="section-title">TEXTURES</h2>
                          {[['albedotex','Albedo Texture','/textures/environment/Decal_test_Albedo003.dds'],['glowtex','Glow Texture','/textures/environment/Decal_test_Glow003.dds']].map(([key,lbl,ph]) => (
                            <div key={key} className="form-group" style={{ cursor:'pointer', outline: helpSelected===key?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                              onClick={() => setHelpSelected(key)}>
                              <label className="form-label">{lbl}</label>
                              <input readOnly onChange={() => {}} className="form-input" placeholder={ph} />
                            </div>
                          ))}
                        </div>

                        {/* Planets */}
                        <div className="section-card">
                          <h2 className="section-title">PLANETS</h2>
                          <div style={{ cursor:'pointer', outline: helpSelected==='planetadd'?'2px solid var(--tab-color)':'none', outlineOffset:'2px', marginBottom:'14px' }}
                            onClick={() => setHelpSelected('planetadd')}>
                            <button className="btn-secondary" style={{ width:'100%', pointerEvents:'none' }}>+ Add Planet</button>
                          </div>
                          {/* Example planet card */}
                          <div style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)', borderLeft:'3px solid var(--tab-color)', padding:'14px', marginBottom:'8px' }}>
                            <div style={{ fontSize:'0.68rem', letterSpacing:'0.14em', textTransform:'uppercase', color:'var(--tab-color)', marginBottom:'10px', opacity:0.75 }}>PLANET 1</div>
                            <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
                              {[['planetpos','X','−0.12'],['planetpos','Y','0.55'],['planetpos','Z','0.82']].map(([key,lbl,ph],i) => (
                                <div key={i} className="form-group" style={{ flex:1, margin:0, cursor:'pointer', outline: helpSelected===key?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                                  onClick={() => setHelpSelected(key)}>
                                  <label className="form-label">{lbl}</label>
                                  <input readOnly onChange={() => {}} className="form-input form-input-sm" placeholder={ph} />
                                </div>
                              ))}
                            </div>
                            {[['planetscale','Scale','45'],['planetrot','Rotation (°)','12']].map(([key,lbl,ph]) => (
                              <div key={key} className="form-group" style={{ margin:'0 0 8px', cursor:'pointer', outline: helpSelected===key?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                                onClick={() => setHelpSelected(key)}>
                                <label className="form-label">{lbl}</label>
                                <input readOnly onChange={() => {}} className="form-input form-input-sm" placeholder={ph} />
                              </div>
                            ))}
                            <div className="form-group" style={{ margin:0, cursor:'pointer', outline: helpSelected==='planetuv'?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                              onClick={() => setHelpSelected('planetuv')}>
                              <label className="form-label">UV Slot (X Y Z W)</label>
                              <div style={{ display:'flex', gap:'4px' }}>
                                {['0.0','0.0','0.5','0.5'].map((v,i) => (
                                  <input key={i} readOnly onChange={() => {}} className="form-input form-input-sm" style={{ flex:1, textAlign:'center' }} value={v} />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Cirrus */}
                        <div className="section-card">
                          <h2 className="section-title">CIRRUS</h2>
                          <div className="form-group" style={{ cursor:'pointer', outline: helpSelected==='cirrusmult'?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                            onClick={() => setHelpSelected('cirrusmult')}>
                            <label className="form-label">Cirrus Multiplier</label>
                            <input readOnly onChange={() => {}} className="form-input" placeholder="1.8" />
                          </div>
                          <div style={{ cursor:'pointer', outline: helpSelected==='cirrусadd'?'2px solid var(--tab-color)':'none', outlineOffset:'2px', marginBottom:'14px' }}
                            onClick={() => setHelpSelected('cirrусadd')}>
                            <button className="btn-secondary" style={{ width:'100%', pointerEvents:'none' }}>+ Add Layer</button>
                          </div>
                          <div style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)', borderLeft:'3px solid var(--tab-color)', padding:'14px' }}>
                            <div style={{ fontSize:'0.68rem', letterSpacing:'0.14em', textTransform:'uppercase', color:'var(--tab-color)', marginBottom:'10px', opacity:0.75 }}>LAYER 1</div>
                            <div className="form-group" style={{ margin:'0 0 8px', cursor:'pointer', outline: helpSelected==='cirrustex'?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                              onClick={() => setHelpSelected('cirrustex')}>
                              <label className="form-label">Texture</label>
                              <input readOnly onChange={() => {}} className="form-input form-input-sm" placeholder="/textures/environment/cirrus000.dds" />
                            </div>
                            <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
                              {[['cirrusspeed','Freq X','0.0001'],['cirrusspeed','Freq Y','0.0001']].map(([key,lbl,ph],i) => (
                                <div key={i} className="form-group" style={{ flex:1, margin:0, cursor:'pointer', outline: helpSelected===key?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                                  onClick={() => setHelpSelected(key)}>
                                  <label className="form-label">{lbl}</label>
                                  <input readOnly onChange={() => {}} className="form-input form-input-sm" placeholder={ph} />
                                </div>
                              ))}
                            </div>
                            <div className="form-group" style={{ margin:0, cursor:'pointer', outline: helpSelected==='cirrusheight'?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                              onClick={() => setHelpSelected('cirrusheight')}>
                              <label className="form-label">Speed</label>
                              <input readOnly onChange={() => {}} className="form-input form-input-sm" placeholder="7.8" />
                            </div>
                          </div>
                        </div>

                        {/* Stars config */}
                        <div className="section-card">
                          <h2 className="section-title">STARS</h2>
                          <div className="sb-st-config-grid">
                            {[['numstars','Stars','50'],['numclusters','Clusters','10'],['clusterspread','Cluster Spread','14000'],['clusterstddev','Cluster Std Dev','1800'],['backgroundratio','Background Ratio','0.45']].map(([key,lbl,ph]) => (
                              <div key={key} className="form-group" style={{ cursor:'pointer', outline: helpSelected===key?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                                onClick={() => setHelpSelected(key)}>
                                <label className="form-label">{lbl}</label>
                                <input readOnly onChange={() => {}} className="form-input" placeholder={ph} />
                              </div>
                            ))}
                            <div className="form-group" style={{ cursor:'pointer', outline: helpSelected==='scale'?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                              onClick={() => setHelpSelected('scale')}>
                              <label className="form-label">Scale Min / Max</label>
                              <div style={{ display:'flex', gap:'8px' }}>
                                <input readOnly onChange={() => {}} className="form-input" placeholder="10" />
                                <input readOnly onChange={() => {}} className="form-input" placeholder="30" />
                              </div>
                            </div>
                          </div>
                          <div style={{ marginTop:'14px' }}>
                            <div className="subsection-title" style={{ marginBottom:'14px' }}>Y-Distribution</div>
                            <div className="form-group" style={{ cursor:'pointer', outline: helpSelected==='ymode'?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                              onClick={() => setHelpSelected('ymode')}>
                              <label className="form-label">Mode</label>
                              <div style={{ display:'flex', gap:'6px' }}>
                                {['flat','gaussian','layered','disk_halo','curve'].map((m,i) => (
                                  <div key={m} style={{ flex:1, textAlign:'center', fontSize:'0.68rem', padding:'8px 4px',
                                    background: i===0?'rgba(59,118,255,0.12)':'rgba(255,255,255,0.04)',
                                    border: i===0?'1px solid rgba(59,118,255,0.4)':'1px solid rgba(255,255,255,0.08)',
                                    color: i===0?'var(--tab-color)':'rgba(255,255,255,0.4)' }}>{m}</div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <hr className="sb-st-subsection-divider"/>
                          <div className="subsection-title">Seed Control</div>
                          <div className="form-group" style={{ cursor:'pointer', outline: helpSelected==='seed'?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                            onClick={() => setHelpSelected('seed')}>
                            <label className="form-label">Seed</label>
                            <div style={{ display:'flex', gap:'8px' }}>
                              <input readOnly onChange={() => {}} className="form-input" placeholder="42" />
                              <button className="btn-ghost" style={{ pointerEvents:'none' }}>Randomize</button>
                            </div>
                          </div>
                        </div>

                        {/* Output */}
                        <div className="section-card">
                          <h2 className="section-title">OUTPUT</h2>
                          <div className="form-group" style={{ cursor:'pointer', outline: helpSelected==='luapreview'?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                            onClick={() => setHelpSelected('luapreview')}>
                            <label className="form-label">Lua Preview (data.lua → skyBox)</label>
                            <div style={{ fontFamily:'monospace', fontSize:'0.74rem', color:'rgba(255,255,255,0.45)', lineHeight:1.85, background:'rgba(0,0,0,0.45)', padding:'14px 16px', border:'1px solid rgba(255,255,255,0.07)' }}>
                              <span style={{ color:'rgba(59,118,255,0.7)' }}>skyBox</span> = {'{'}<br/>
                              &nbsp;&nbsp;HorizonColor = {'{ 0.647, 0.819, 0.839, 1 },'}<br/>
                              &nbsp;&nbsp;ZenithColor = {'{ 0.220, 0.412, 0.722, 1 },'}<br/>
                              &nbsp;&nbsp;Planets = {'{ ... },'}<br/>
                              {'}'}
                            </div>
                          </div>
                          <div style={{ cursor:'pointer', outline: helpSelected==='injectbtn'?'2px solid var(--tab-color)':'none', outlineOffset:'2px' }}
                            onClick={() => setHelpSelected('injectbtn')}>
                            <button className="btn-primary" style={{ width:'100%', pointerEvents:'none' }}>Generate Skybox → .scmap</button>
                          </div>
                        </div>

                      </div>{/* end tab-col-config */}
                    </div>{/* end tab-grid */}
                  </div>{/* end left */}

                  {/* RIGHT: info panel */}
                  <div style={{ flex:'1', overflowY:'auto', maxHeight:'80vh' }}>
                    {!helpSelected ? (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'400px', gap:'16px', textAlign:'center' }}>
                        <div style={{ fontSize:'3rem', opacity:0.4, color:'var(--tab-color)' }}>↖</div>
                        <div style={{ fontSize:'1.05rem', fontWeight:600, color:'rgba(255,255,255,0.35)', letterSpacing:'0.05em' }}>Select an element</div>
                        <div style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.2)', maxWidth:'240px', lineHeight:1.7 }}>Click any field, button, or section on the left to learn what it does.</div>
                      </div>
                    ) : (() => {
                      const INFO = {
                        mapname:         { title:'Map Name',            desc:'The exact name of your map folder in /maps. Used to build all output file paths for skybox injection.',         details:[['Format','MapName.vXXXX — e.g. Hades_Dust.v0002'],['Auto-version','.v0001 appended if no version suffix present'],['Shared','Synced with other tabs (Planets, Wreckage) automatically']], tip:'Copy the folder name directly from File Explorer to avoid case mismatches.' },
                        mapsize:         { title:'Map Size',            desc:'Playable area in game units. Used to calculate the Scale value that sizes the skybox dome proportionally to the terrain.',  details:[['Common values','256, 512, 1024, 2048 (5–40 km)'],['Scale formula','Scale = MapSize × 2.288'],['Effect','Larger maps need a proportionally larger dome']], tip:'Match this to the map_size field in your scenario file.' },
                        subtractheight:  { title:'Subtract Height',     desc:'Controls how far below the equator the dome extends, driving the Sphere Lerp value that blends hemisphere vs. full sphere.',  details:[['Default','1.2566 (≈ π/2.5)'],['Lower','More sphere — dome extends below horizon'],['Higher','Cut higher — less of the dome visible below camera']], tip:'Values between 1.0 and 1.6 cover most use cases. Watch the Dome Preview.' },
                        subdivaxis:      { title:'Subdivisions Axis',   desc:'Number of horizontal polygon segments in the skybox sphere mesh. More segments = smoother dome silhouette.',                details:[['Recommended','16–64'],['FA standard','Most vanilla maps use 16–32'],['Performance','Values above 64 rarely produce visible improvement']], tip:'16 is sufficient for most maps. Only increase if you see visible polygon edges.' },
                        subdivheight:    { title:'Subdivisions Height', desc:'Number of vertical ring segments. Controls how smoothly the horizon-to-zenith gradient is rendered.',                      details:[['Recommended','6 (standard FA value)'],['Higher','Smoother gradient — rarely needed'],['Range','2–64']], tip:'Keep at 6 unless you have a very tall gradient with visible banding.' },
                        horizoncolor:    { title:'Horizon Color',       desc:'The color at the base of the dome, at horizonHeight world units. Blends linearly upward toward zenithColor.',               details:[['Position','Mapped to horizonHeight in world space'],['Blend','Linear interpolation with Zenith Color by worldY'],['Format','RGB hex']], tip:'Warm tones for desert/volcanic maps; cool blues or grey for arctic or space themes.' },
                        zenithcolor:     { title:'Zenith Color',        desc:'The color directly overhead at the top of the dome, at zenithHeight world units.',                                          details:[['Position','Mapped to zenithHeight in world space'],['Format','RGB hex'],['Typical','Darker than horizon for realistic atmosphere']], tip:'Very dark blue or near-black for space themes. Keep zenith darker than horizon.' },
                        horizonheight:   { title:'Horizon Height',      desc:'World-Y coordinate where the horizon color is fully applied. Controls where the gradient starts.',                          details:[['Default','-42.5 (slightly below sea level)'],['Negative','Hides color seam at terrain edge'],['Range','−500 to +500']], tip:'Set slightly negative (−50 to −150) to prevent a visible color band at the terrain boundary.' },
                        zenithheight:    { title:'Zenith Height',       desc:'World-Y coordinate where the zenith color is fully applied. Controls where the gradient tops out.',                         details:[['Default','293.5'],['Higher value','Slower gradient — softer atmosphere'],['Lower value','Sharper, faster gradient']], tip:'Increase for maps with tall mountains so the gradient isn\'t compressed near the peaks.' },
                        decalglow:       { title:'Decal Glow Multiplier',desc:'Scales the brightness of the glow DDS texture contribution to the sky. Controls atmospheric haze intensity.',            details:[['Default','0.1'],['Range','0 (no glow) to 1+ (intense)'],['Effect','Multiplied onto glow texture sample before compositing']], tip:'Keep below 0.3 for subtle atmosphere. Values above 0.5 create dramatic neon-sky effects.' },
                        albedotex:       { title:'Albedo Texture',       desc:'Base color DDS texture wrapped around the skybox sphere. Defines cloud patterns, nebulae, or background detail.',        details:[['Format','DDS (DirectDraw Surface)'],['Path','Game-relative or custom mod path'],['Tiling','Spherically mapped — seam at the back']], tip:'Use the Library to pick textures — they ship with matching albedo + glow pairs.' },
                        glowtex:         { title:'Glow Texture',         desc:'Additive luminance texture layered over the albedo via the Decal Glow Multiplier. Drives scatter and rim effects.',      details:[['Additive','Blended on top of albedo'],['Format','DDS'],['Common use','Soft horizon glow or planetary ring haze']], tip:'Leave blank for pure-color skyboxes. A good glow texture dramatically increases visual quality.' },
                        planetadd:       { title:'Add Planet',           desc:'Adds a new planet entry. Each planet is an independently positioned billboard sprite rendered in the sky dome.',         details:[['Default','Centered at (2190, 570, −1020), scale 183'],['Limit','No hard engine limit, but >10 impacts performance'],['UV','First UV slot selected by default']], tip:'Start with 1–2 planets and preview before adding more.' },
                        planetpos:       { title:'Planet Position (X/Y/Z)',desc:'World-space position on the skybox sphere surface. Controls where in the sky the planet appears.',                   details:[['Y axis','Positive = above horizon'],['X/Z axes','Left/right and front/back'],['Normalised','Automatically projected onto dome radius']], tip:'Keep Y positive (570+) so planets appear above the terrain horizon.' },
                        planetscale:     { title:'Planet Scale',         desc:'Billboard size in world units. Larger values = visually larger planet.',                                                   details:[['Small moons','30–80'],['Gas giants','150–300'],['FA standard','100–200 for typical planets']], tip:'Scale is in world units — test at different camera distances to judge apparent size.' },
                        planetrot:       { title:'Planet Rotation',      desc:'Rotation of the planet billboard around its center in radians. Orientates cloud bands or rings.',                        details:[['Range','0 to 2π (≈ 6.28)'],['Default','−1.585 (≈ −90°)'],['Effect','Rotates the sprite, not the position']], tip:'Slight variation between planets prevents duplicate sprites from looking identical.' },
                        planetuv:        { title:'Planet UV Slot',       desc:'Atlas region of the planet texture the billboard samples. X/Y = offset, Z/W = size in UV space (0–1).',                details:[['2×2 atlas','(0,0,0.5,0.5) top-left · (0.5,0,0.5,0.5) top-right'],['Full texture','(0, 0, 1, 1)'],['Visual check','UV canvas in the Stars tab']], tip:'Use the UV Visualization canvas (Stars tab) to verify which slot maps to which sprite.' },
                        cirrusmult:      { title:'Cirrus Multiplier',    desc:'Global brightness/opacity multiplier applied to all cirrus layers simultaneously.',                                       details:[['Default','1.8'],['0','All clouds invisible — useful for debugging'],['Effect','Multiplies all layer alpha and color outputs']], tip:'Set to 0 to temporarily disable all clouds without deleting layer configurations.' },
                        cirrусadd:       { title:'Add Cirrus Layer',     desc:'Adds a new cloud layer. Each layer samples FBM noise and scrolls independently.',                                        details:[['FA recommendation','2–4 layers for natural results'],['Composite','Layers are multiplied together — one dark layer suppresses all']], tip:'Use 2–3 layers: one slow base and one or two faster high-altitude wisp layers.' },
                        cirrustex:       { title:'Cirrus Texture',       desc:'The DDS texture tiled across this cloud layer. Must be a seamless tileable pattern.',                                    details:[['Format','DDS (DXT1 or DXT5)'],['Tiling','Texture UV-tiled — seamless textures essential'],['Alpha','Alpha channel used as cloud density mask']], tip:'Use a seamless noise DDS from the Library for best results.' },
                        cirrusspeed:     { title:'Frequency / Speed',    desc:'FreqX/Y control the tiling frequency of the noise (higher = finer clouds). Speed controls scroll rate.',               details:[['FreqX/Y','0.0001 = coarse, 0.005 = fine detail'],['Speed','0 = static, 7–10 = fast-moving'],['Direction','dirX/dirY unit vector controls scroll angle']], tip:'Keep layers scrolling at different speeds (e.g. 7.8 and 1.28) to avoid repetition.' },
                        cirrusheight:    { title:'Cloud Layer Height (Speed)',desc:'The Speed value controls how fast this layer scrolls in world units per second.',                                 details:[['Typical range','0.5 – 15'],['0','Static layer — no movement'],['Higher','Faster-moving clouds']], tip:'Use a slow base layer (1–3) and faster upper layers (7–10) for natural depth.' },
                        numstars:        { title:'Stars',                desc:'Total star sprite count, split between cluster stars and background stars by Background Ratio.',                          details:[['Typical','30–150 for most maps'],['Performance','Very cheap to render — scale freely'],['Default','50']], tip:'Start at 50 and adjust after previewing the distribution.' },
                        numclusters:     { title:'Clusters',             desc:'Number of random cluster centers. Stars in cluster mode are attracted to these using a Gaussian distribution.',           details:[['Typical','5–20'],['More clusters','More spread-out groupings'],['Position','Each center randomly placed within Cluster Spread']], tip:'Use 3–5 clusters for a dense focal formation; 10–15 for a diffuse galaxy feel.' },
                        clusterspread:   { title:'Cluster Spread',       desc:'Half-width of the placement area in world units. Stars and cluster centers are placed within ±Spread on X and Z.',      details:[['Typical','10000–20000'],['Units','FA world units'],['Too small','Stars appear crowded']], tip:'Match to your map size — 14000 works well for a 1024-unit map.' },
                        clusterstddev:   { title:'Cluster Std Dev',      desc:'Standard deviation of the Gaussian distribution around each cluster center. Controls cluster tightness.',                details:[['Low (600–800)','Tight clusters — nebula pockets'],['High (2000–3000)','Diffuse clusters — soft galaxy arms'],['Default','1800']], tip:'Low stddev for visible star clusters, high for subtle density variations.' },
                        backgroundratio: { title:'Background Ratio',     desc:'Fraction of stars placed randomly across the full area (background field) vs. attracted to cluster centers.',            details:[['0.0','All stars in clusters'],['1.0','All background (no clustering)'],['Default','0.45']], tip:'0.3–0.5 gives a natural balance of clusters against a sparse background field.' },
                        scale:           { title:'Scale Min / Max',      desc:'Random scale range for star sprites. Each star gets a random value between Min and Max.',                                details:[['Min default','10'],['Max default','30'],['Wide range','More visual depth variation']], tip:'Use 8–20 for uniform fields; 5–60 for dramatic depth variation.' },
                        ymode:           { title:'Y-Distribution Mode',  desc:'Controls how star altitude is distributed across the hemisphere.',                                                        details:[['flat','Uniform from 0 to Max Height'],['gaussian','Bell curve centered at Y Center'],['disk_halo','Dense plane + sparse halo — galaxy-like'],['curve','Custom probability curve drawn interactively']], tip:'Use Disk+Halo for the most realistic Milky Way appearance.' },
                        seed:            { title:'Seed Control',         desc:'Fixed seed = identical output every generate run. Random = new distribution each time.',                                  details:[['Fixed','Lock seed after finding a good layout'],['Random','Explore variations'],['Randomize','Pick and lock a random seed']], tip:'Always enable Fixed Seed before your final inject run.' },
                        luapreview:      { title:'Lua Preview',          desc:'Read-only preview of the skyBox Lua table that will be injected into data.lua.',                                        details:[['Truncated','First 2500 chars shown — full table written on inject'],['skyBox key','Replaces existing skyBox = { ... } block only'],['All other data','Preserved — inject is safe to re-run']], tip:'Verify all values look correct here — especially planet positions and UV slots — before injecting.' },
                        injectbtn:       { title:'Generate Skybox → .scmap',desc:'Reads target data.lua, replaces the skyBox table, and writes the file back. Repacks the .scmap.',                    details:[['Prerequisite','Map Name + Maps Folder must be set'],['Target','data.lua inside the .scmap archive'],['Safe','Only the skyBox block is replaced — all other map data preserved']], tip:'Back up data.lua before the first generate, just in case.' },
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

              {/* ═══ ADVANCED GUIDE TAB ═══ */}
              {activeHelpTab === 'advanced' && (
                <div className="help-adv-layout">
                  <div className="help-adv-subtabs">
                    {[
                      { id:'workflow',   label:'Workflow' },
                      { id:'atmosphere', label:'Atmosphere' },
                      { id:'cirrus',     label:'Cirrus Clouds' },
                      { id:'planets',    label:'Planets' },
                      { id:'stars',      label:'Stars' },
                      { id:'output',     label:'Output & Generate' },
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
                        <p className="help-adv-hero-desc">The Skybox Generator configures four independent rendering techniques from FA's sky.fx shader — Atmosphere (dome gradient), Decal (planets), Cirrus (clouds), and Stars (billboard props). All four are serialised into a single skyBox Lua table injected into data.lua.</p>
                        <div className="help-plain"><span className="help-plain-icon">💬</span><span><strong>In plain words:</strong> Think of the skybox as four transparent layers stacked above the map. The bottom layer is the coloured dome gradient. Above that sit planet and star billboard sprites. On top of everything are the scrolling cloud layers. The generator lets you configure all four and writes the result into your map file in one click.</span></div>
                      </div>
                      <div className="help-adv-button-showcase">
                        <div style={{ display:'flex', flexDirection:'column', gap:'6px', width:'100%' }}>
                          {[['Atmosphere','technique Atmosphere'],['Planets','technique Decal'],['Cirrus','technique Cirrus'],['Stars','CreateRotatedProp()']].map(([label,tech]) => (
                            <div key={label} style={{ padding:'9px 14px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.1)', fontSize:'0.74rem' }}>
                              <div style={{ color:'var(--tab-color)', fontWeight:700, marginBottom:'2px' }}>{label}</div>
                              <div style={{ color:'rgba(255,255,255,0.3)', fontFamily:'monospace', fontSize:'0.68rem' }}>{tech}</div>
                            </div>
                          ))}
                          <div style={{ textAlign:'center', color:'var(--tab-color)', fontSize:'1rem', margin:'2px 0' }}>↓</div>
                          <div className="help-adv-fake-button btn-primary" style={{ textAlign:'center', padding:'10px', fontSize:'0.75rem', letterSpacing:'0.1em', cursor:'default' }}>Generate Skybox → .scmap</div>
                        </div>
                        <div className="help-adv-button-hint">4 shader techniques → 1 Lua table</div>
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Step-by-Step Process</h3>
                      <div className="help-adv-summary">
                        <div className="help-adv-summary-title">Quick Overview</div>
                        <strong>1. Map Context</strong> — name + size, sets output paths and scale. &nbsp;
                        <strong>2. Atmosphere</strong> — horizon/zenith colours, dome geometry, DDS textures. &nbsp;
                        <strong>3. Cirrus</strong> — cloud layers with frequency, speed, direction. &nbsp;
                        <strong>4. Planets</strong> — billboard positions, UV atlas slots, rotation. &nbsp;
                        <strong>5. Stars</strong> — procedural cluster distribution + exclusion zones. &nbsp;
                        <strong>6. Output</strong> — review Lua preview, then Generate → .scmap.
                      </div>
                      <div className="help-adv-timeline--grid">
                        {[
                          { n:'01', title:'Map Context', desc:'Map Name must exactly match your /maps subfolder including the version suffix (e.g. Hades_Dust.v0002). Map Size drives the Scale constant used by dome geometry and star world coordinates.', subs:['Wrong name → skyBox written to wrong data.lua','Auto-appends .v0001 if no version suffix found','Maps Folder path comes from global Settings'] },
                          { n:'02', title:'Atmosphere', desc:'Sets dome colours, heights, mesh subdivisions, and the two DDS textures (albedo + glow). The Dome Preview canvas updates live so you can judge the gradient before injecting.', subs:['horizonHeight/zenithHeight define the gradient Y range','SubtractHeight controls how far below the horizon the dome extends','Load a Library preset for working texture paths'] },
                          { n:'03', title:'Cirrus Clouds', desc:'Up to four cloud layers, each scrolling independently across the dome. sky.fx multiplies all four channel samples together to produce cloud opacity.', subs:['freqX/Y: texture tiling density','speed + dirX/dirY: scroll rate and direction','cirrusMult: global brightness scale for all layers'] },
                          { n:'04', title:'Planets', desc:'Each planet is a camera-facing billboard quad defined by world position, scale, rotation, and UV atlas region. The Decal technique in sky.fx renders them.', subs:['Positive Y = above horizon — keep Y well above terrain level','UV slot selects which sprite in the texture atlas is shown','Rotation is in radians — π/2 ≈ 1.571 = 90°'] },
                          { n:'05', title:'Stars', desc:'Stars are placed procedurally using a seeded Gaussian cluster model. Each star becomes a billboard prop entry in the Planets block of the Lua output.', subs:['Cluster centers placed first, stars scattered around them','Exclusion zones block placement in defined sky regions','Fix seed before final run — re-inject appends, does not replace'] },
                          { n:'06', title:'Output & Generate', desc:'The Lua Preview shows the full skyBox table. Inject unpacks the .scmap, replaces only the skyBox block in data.lua, and repacks — all in one step.', subs:['All other data.lua content (lighting, water) is preserved','Re-generate is safe — same block overwritten each time','Back up data.lua before the first generate, just in case'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num">{s.n}</div>
                            <div className="help-adv-step-content"><h4>{s.title}</h4><p>{s.desc}</p><ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul></div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Best Practices</h3>
                      <div className="help-adv-practice-grid">
                        {[
                          ['Load a Library Preset First', 'The Library ships complete skyboxes with working albedo + glow DDS paths. Starting from a preset avoids the most common failure: a black sky caused by a broken texture path.'],
                          ['Set Map Context Before Anything Else', 'Map Name and Map Size affect output paths and star world coordinates. Getting these wrong means re-doing everything else.'],
                          ['Fix Star Seed Before Final Inject', 'Without a fixed seed, every Generate call produces a different layout. Re-inject appends — not replaces — so you end up with double stars after a second run.'],
                          ['Use the Dome Preview', 'The Dome Preview canvas shows the vertical gradient cross-section live. Injecting a gradient that looks wrong in the preview will look wrong in-game.'],
                          ['Keep cirrusMult Between 1 and 2', 'The shader multiplies four channel samples together. Values well above 2 push the product toward a uniform flat haze. Values below 1 make clouds faint.'],
                          ['Test Planets at scale=50 First', 'Planet scale is in world units. scale=50 at Y=500 is clearly visible and easy to reposition. Scale up once the position looks right.'],
                        ].map(([title, desc]) => (
                          <div key={title} className="help-adv-practice-card">
                            <span className="help-adv-practice-icon">
                              <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="11" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/><path d="M8 13l3.5 3.5 6.5-7" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
                          ['Generate button is greyed out', 'Map Name and Maps Folder must both be set. Map Name is in the Atmosphere tab; Maps Folder is in global Settings. The Maps Folder must point to the folder that contains your map subfolder.'],
                          ['Nothing changes in-game after inject', 'FA caches the .scmap on load. Close and fully reopen FA after injecting. Also confirm the .scmap modification date updated after inject.'],
                          ['skyBox block not found — inject fails', 'data.lua must already contain a skyBox = { ... } block. If the map was never saved by FA or the block was manually deleted, inject has nothing to replace. Open the map in FA editor and save it first.'],
                        ].map(([q,a]) => (
                          <div key={q} className="help-adv-ts-item">
                            <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                            <div className="help-adv-ts-a">{a}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>)}


                  {/* ── ATMOSPHERE ── */}
                  {activeAdvSubTab === 'atmosphere' && (<>
                    <div className="help-adv-hero">
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">Atmosphere — Dome Gradient & Textures</h2>
                        <p className="help-adv-hero-desc">The atmosphere is the coloured dome that surrounds the map. It blends smoothly from a horizon colour at the base to a zenith colour at the top, with an optional DDS texture layer composited on top for cloud patterns, nebulae, or star fields.</p>
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>How the Gradient Works</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>AtmospherePS in sky.fx computes the gradient by mapping each dome vertex's world-Y elevation to a 0–1 blend value, then mixing between the two configured colours.</p>
                      <div className="help-adv-summary">
                        <div className="help-adv-summary-title">The shader formula</div>
                        <code>tv = clamp((elevation − horizonBegin) / (horizonEnd − horizonBegin), 0, 1)</code><br/>
                        <code>output = lerp(horizonColor, skyColor, 1 − t)</code>
                      </div>
                      <div className="help-adv-timeline">
                        {[
                          { n:'①', title:'tv — elevation normalisation', desc:'Maps the raw world-Y of each vertex into a 0–1 range. Below horizonBegin → tv = 0 (pure horizon colour). Above horizonEnd → tv = 1 (pure zenith colour). Everything between is a smooth mix.', plain:'Think of horizonBegin and horizonEnd as the bottom and top of a ruler. tv measures where a given sky pixel sits on that ruler. A pixel at the base reads 0; one at the top reads 1; everything between gets a fractional value proportional to its height.', subs:['horizonBegin = your Horizon Height field (world-Y)','horizonEnd = your Zenith Height field (world-Y)','Values outside the range are clamped — no overflow or wrapping'] },
                          { n:'②', title:'t — lookup texture blend', desc:'t = tex2D(lookup, (theta, 0.25)).a × tex2D(lookup, (tv, 0.75)).a. Two samples from a 1D gradient texture, one based on horizontal angle (theta) and one on elevation (tv). Their alpha channels are multiplied together.', subs:['Theta-based lookup at v=0.25: optional horizontal variation around the dome','Elevation-based lookup at v=0.75: the primary vertical gradient shape','Multiplication allows a non-linear baked gradient curve in the texture'] },
                          { n:'③', title:'Final colour', desc:'output = lerp(horizonColor, skyColor, 1 − t). t = 0 gives pure horizonColor at the base; t = 1 gives pure skyColor at the top. 1−t flips the direction so the formula reads naturally bottom-to-top.', subs:['horizonColor = your Horizon Color field','skyColor = your Zenith Color field','lerp is linear — the transition is a straight mix, not curved'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'1.1rem'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4><p>{s.desc}</p>
                              {s.plain && <div className="help-plain" style={{marginTop:'8px',marginBottom:'8px'}}><span className="help-plain-icon">💬</span><span>{s.plain}</span></div>}
                              <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Dome Geometry Parameters</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>The dome is a subdivided sphere mesh. Its radius, shape, and polygon density are controlled by four parameters that map directly to sky.fx shader inputs.</p>
                      <div className="help-adv-timeline">
                        {[
                          { n:'Scale', title:'Scale = MapSize × 2.288', desc:'Physical radius of the sky sphere in world units, computed automatically from Map Size. A 1024-unit map produces a dome radius of ~2343 world units.', subs:['Changing Map Size scales all billboard positions in the sky proportionally','Star and planet world coordinates must be sized relative to this value'] },
                          { n:'SH', title:'SubtractHeight → SphereLerp', desc:'SphereLerp = 1 − (SubtractHeight × 2 / π). Controls how far the dome extends below the equator. SphereLerp 1.0 = full sphere, 0.0 = pure hemisphere. Default 1.2566 gives SphereLerp ≈ 0.2.', plain:'Without subtracting any height, the dome would be a perfect hemisphere with a hard visible edge at the horizon. SubtractHeight pulls the dome past the horizon so the gradient colour blends smoothly into the terrain instead of cutting off sharply.', subs:['Higher SubtractHeight → dome extends further below horizon','Lower → more hemispherical, sharper horizon cut','Default 1.2566 (≈ π/2.5) is the FA standard value'] },
                          { n:'sA', title:'SubdivAxis — horizontal rings', desc:'Number of horizontal polygon columns around the dome. More columns produce a smoother dome silhouette. 16 is the FA standard and sufficient for all normal viewing distances.', subs:['16: standard — no visible faceting at game camera distances','64+: overkill — only for close-up cinematic use'] },
                          { n:'sH', title:'SubdivHeight — vertical rings', desc:'Number of vertical polygon rows. Controls how smoothly the gradient transitions vertically. FA standard is 6 — rarely needs to be higher.', subs:['Only increase if visible gradient banding appears in the sky close to the dome'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'0.8rem', letterSpacing:'0.05em'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4><p>{s.desc}</p>
                              {s.plain && <div className="help-plain" style={{marginTop:'8px',marginBottom:'8px'}}><span className="help-plain-icon">💬</span><span>{s.plain}</span></div>}
                              <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Albedo & Glow Textures</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>The Decal technique renders two DDS textures on top of the gradient dome in two separate passes. Pass 0 writes the albedo colour; Pass 1 writes a glow contribution driven by the alpha channel of the glow DDS.</p>
                      <div className="help-adv-timeline">
                        {[
                          { n:'P0', title:'Albedo Pass — DecalAlbedoPS', desc:'Samples the albedo DDS and writes its full RGBA to the render target using standard alpha blending. This is the primary sky texture — cloud patterns, nebulae, or star field backgrounds baked into the DDS.', subs:['Blank path → no texture, pure gradient only','AlphaBlend_SrcAlpha_InvSrcAlpha — standard alpha compositing'] },
                          { n:'P1', title:'Glow Pass — DecalGlowPS', desc:'Reads only the alpha channel: output.a = decalGlowMultiplier × texel.a. High-alpha regions in the glow DDS produce bright atmospheric haze. The colour channel of the glow DDS is ignored.', plain:'The glow pass doesn\'t add colour — it adds brightness. Regions with high alpha in the glow DDS glow through the sky, creating the impression of scattered light or a bright atmosphere. Decal Glow Multiplier scales the overall intensity — set it to 0 to fully suppress glow.', subs:['Decal Glow Multiplier = sky.fx\'s decalGlowMultiplier variable','Default: 0.1 — subtle atmospheric haze','Set to 0 to disable glow without removing the texture path','Values above 0.5 produce very intense atmospheric effects'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'0.85rem'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4><p>{s.desc}</p>
                              {s.plain && <div className="help-plain" style={{marginTop:'8px',marginBottom:'8px'}}><span className="help-plain-icon">💬</span><span>{s.plain}</span></div>}
                              <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">04</span>Best Practices</h3>
                      <div className="help-adv-practice-grid">
                        {[
                          ['Set horizonHeight Slightly Negative', 'Setting it to −50 to −150 makes the pure horizon colour extend below the terrain floor. Without this, a visible colour band appears where the sky meets the terrain edge.'],
                          ['Match Horizon Colour to Terrain', 'Sample the far-distance colour of your terrain texture and shift horizonColor toward it. A desert map with a blue horizon looks wrong at any camera angle near the map edge.'],
                          ['Use Library Textures for DDS Paths', 'The Library ships pre-packaged albedo + glow pairs with correct game-relative paths. Hand-typing paths is the primary cause of the "black sky" bug.'],
                          ['Preview Before Injecting', 'The Dome Preview canvas renders the vertical gradient live. Use the Fullscreen button for a larger view to judge colour transitions precisely before writing to the map file.'],
                        ].map(([title, desc]) => (
                          <div key={title} className="help-adv-practice-card">
                            <span className="help-adv-practice-icon"><svg width="26" height="26" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="11" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/><path d="M8 13l3.5 3.5 6.5-7" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                            <h4>{title}</h4><p>{desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">05</span>Troubleshooting</h3>
                      <div className="help-adv-ts-grid">
                        {[
                          ['Sky is completely black', 'The albedo DDS path is wrong or the file does not exist. sky.fx silently renders nothing if the sampler finds no file. Load a Library preset to get a guaranteed working path, then customise from there.'],
                          ['Dome is a single flat colour — no gradient', 'horizonHeight and zenithHeight are equal or inverted. AtmospherePS divides by (zenithHeight − horizonHeight) — if that is zero or negative the result clamps to a flat colour. Ensure zenithHeight is clearly above horizonHeight.'],
                          ['Colour seam visible at terrain edge', 'Set horizonHeight to a negative value (e.g. −100). Pure horizonColor below horizonBegin extends below the terrain, hiding the boundary line.'],
                        ].map(([q,a]) => (
                          <div key={q} className="help-adv-ts-item">
                            <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                            <div className="help-adv-ts-a">{a}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>)}

                  {/* ── CIRRUS CLOUDS ── */}
                  {activeAdvSubTab === 'cirrus' && (<>
                    <div className="help-adv-hero">
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">Cirrus Clouds — Scrolling Layered Shader</h2>
                        <p className="help-adv-hero-desc">Cirrus clouds are animated layers that scroll across the dome surface. Up to four layers are blended multiplicatively — cloud appears only where all active layers are bright at the same point, creating organic gaps and shapes from simple tileable textures.</p>
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Multiplicative Layer Blending</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>CirrusPS samples the cloud DDS four times — each layer reading a different colour channel (R, G, B, A) at its own independently scrolling UV position. All four values are multiplied together to produce the final cloud opacity.</p>
                      <div className="help-adv-summary">
                        <div className="help-adv-summary-title">The pixel shader formula</div>
                        <code>c0=tex(...).r &nbsp;·&nbsp; c1=tex(...).g &nbsp;·&nbsp; c2=tex(...).b &nbsp;·&nbsp; c3=tex(...).a</code><br/>
                        <code>alpha = cirrusMultiplier × c0 × c1 × c2 × c3</code>
                      </div>
                      <div className="help-adv-timeline">
                        {[
                          { n:'①', title:'Same DDS, four channels', desc:'The texture is sampled four times at different UV positions. Each layer reads a different colour channel — R, G, B, A — so one DDS file carries four independent cloud density maps. Layer 1 reads red, Layer 2 green, Layer 3 blue, Layer 4 alpha.', plain:'One image does the work of four. Each colour channel in the DDS acts as a separate greyscale cloud pattern. Because the channels are sampled at different positions and scrolled in different directions, they appear independent even though they all come from the same file.', subs:['Channels are typically authored as four different noise octaves in the RGBA DDS','Unused layers: set speed=0 and low frequency — do not leave uninitialised'] },
                          { n:'②', title:'Multiplication is AND-logic', desc:'c0 × c1 × c2 × c3 is only large where all four channels are large. A single layer at 0.3 caps the total to at most 0.3, regardless of the other three. This sharpens cloud edges and creates hard-edged breaks and gaps.', plain:'Imagine four transparent sheets of cloud laid on top of each other. A cloud is only bright where all four sheets are bright at the same spot. If any one sheet is dark there, the cloud disappears — no matter how bright the other three are. This AND-like logic produces complex shapes from simple textures.', subs:['More active layers → more contrast, more defined cloud edges','Fewer active layers (speed=0 on some) → softer, hazier result','One layer with speed=0: static base cloud structure'] },
                          { n:'③', title:'cirrusMultiplier', desc:'Scales the final product before writing to alpha. Default 1.8. Values above 1 brighten cloud opacity — pushing toward saturation. Values below 1 dim it. Set to 0 to completely disable all clouds without deleting layer configuration.', subs:['Values above ~2.5 push most of the sky toward full cloud opacity — uniform haze','Set to 0 for instant debugging — all clouds disappear, gradient visible underneath','Restore to 1.8 to re-enable'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'1.1rem'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4><p>{s.desc}</p>
                              {s.plain && <div className="help-plain" style={{marginTop:'8px',marginBottom:'8px'}}><span className="help-plain-icon">💬</span><span>{s.plain}</span></div>}
                              <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>UV Scroll Formula</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>DomeVS calls computeCirrusCoord once per layer per vertex. The function rotates the vertex XZ position into the layer's scroll direction frame, applies frequency scaling, and adds a time-based offset.</p>
                      <div className="help-adv-timeline">
                        {[
                          { n:'①', title:'direction = normalize(cirrus.direction)', desc:'Normalises dirX/dirY to a unit vector. (1,0) scrolls east. (0,1) scrolls north. (0.707, 0.707) scrolls northeast. The generator stores the raw values — the shader normalises them.', subs:['dirX/dirY do not need to be pre-normalised','To scroll west: (−1, 0). Southwest: (−0.707, −0.707)'] },
                          { n:'②', title:'R matrix + position rotation', desc:'A 2D rotation matrix built from the direction rotates the vertex XZ into the layer\'s local frame. This ensures frequency and scroll always act along the intended direction, independent of world orientation.', subs:['R = [[dx, dy], [dy, −dx]] where (dx,dy) = normalised direction','position = mul(position, R) — vertex rotated into layer space'] },
                          { n:'③', title:'output = frequency × (position − time × speed × direction)', desc:'frequency scales how densely the texture tiles. Higher = finer, more repeated cloud pattern. The scroll term moves the UV offset forward along the direction at the given speed per frame tick.', plain:'freqX and freqY are the zoom level of the cloud pattern. Low values (0.0001) produce large coarse clouds that tile slowly. High values (0.005) produce fine wispy clouds with many repetitions. speed controls how fast the whole pattern slides.', subs:['time = tick + interpolant — smooth sub-frame precision','speed=0 → static layer, no movement','Typical freqX/Y: 0.0001 (coarse) to 0.005 (fine detail)'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'1.1rem'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4><p>{s.desc}</p>
                              {s.plain && <div className="help-plain" style={{marginTop:'8px',marginBottom:'8px'}}><span className="help-plain-icon">💬</span><span>{s.plain}</span></div>}
                              <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Best Practices</h3>
                      <div className="help-adv-practice-grid">
                        {[
                          ['Different Speeds Per Layer', 'Layers at the same speed move in lock-step — cloud gaps repeat visibly. Use e.g. 7.8, 1.28, 0, 0.55 across the four layers to break synchronisation permanently.'],
                          ['Different Frequencies Per Layer', 'Same freqX/Y for all layers eliminates the multiplicative contrast. Vary them (e.g. 0.0001, 0.001, 0.0006, 0.003) to get both large and fine cloud structure simultaneously.'],
                          ['One Static Base Layer', 'Set speed=0 on one layer for a fixed base distribution. Moving layers add variation on top. This prevents the sky from ever going completely clear between moving patches.'],
                          ['Use cirrusMult=0 to Debug', 'Setting cirrusMultiplier to 0 instantly hides all clouds without touching any layer. Restore to 1.8 to re-enable. Useful for checking the atmosphere gradient underneath.'],
                        ].map(([title, desc]) => (
                          <div key={title} className="help-adv-practice-card">
                            <span className="help-adv-practice-icon"><svg width="26" height="26" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="11" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/><path d="M8 13l3.5 3.5 6.5-7" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                            <h4>{title}</h4><p>{desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">04</span>Troubleshooting</h3>
                      <div className="help-adv-ts-grid">
                        {[
                          ['Clouds completely invisible', 'cirrusMultiplier is 0, or the DDS path is broken. Set multiplier to 1.8 and confirm the texture exists. The DDS must use WRAP address mode — a CLAMP texture produces invisible or cut-off results near the dome edges.'],
                          ['Uniform flat haze instead of cloud shapes', 'cirrusMultiplier is too high, pushing the product toward 1 everywhere. Lower it to 1.0–1.5. Also ensure layers have different frequencies — identical freqX/Y across all four layers eliminates the multiplicative contrast.'],
                          ['Cloud movement looks jerky', 'Speed values are too large (>20). The scroll offset is applied per frame tick — very high values produce visible per-frame jumps. Keep speed below 15 for smooth motion.'],
                        ].map(([q,a]) => (
                          <div key={q} className="help-adv-ts-item">
                            <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                            <div className="help-adv-ts-a">{a}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>)}

                  {/* ── PLANETS ── */}
                  {activeAdvSubTab === 'planets' && (<>
                    <div className="help-adv-hero">
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">Planets — Camera-Facing Billboard Sprites</h2>
                        <p className="help-adv-hero-desc">Planets are flat billboard sprites anchored at a world position on the dome and always oriented to face the camera. The shader builds a quad around the anchor using the camera's own screen-space axes, so the sprite appears flat from any view direction.</p>
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Billboard Construction (DecalVS)</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>DecalVS builds each billboard from a two-triangle corner-pair quad. It rotates the corners by the planet's rotation, scales them by the size field, then offsets them from the anchor along the camera's viewRight and viewUp vectors.</p>
                      <div className="help-adv-timeline">
                        {[
                          { n:'①', title:'Rotation', desc:'sine = sin(position.w), cosine = cos(position.w). The four quad corners are rotated around the billboard center by this angle before scaling. position.w is your Rotation field in radians.', subs:['π/2 ≈ 1.571 = 90°  ·  π ≈ 3.14 = 180°  ·  2π ≈ 6.28 = full rotation','Rotation spins the sprite around its own center — does not change world position','Useful for rotating planet ring or cloud band orientation'] },
                          { n:'②', title:'UV mapping', desc:'vertex.texcoord = texcoord.xy + 0.5 × texcoord.zw × (corner + 1). The UV (x,y,z,w) fields map the atlas region to the four quad corners. The shader applies texcoord.y = 1 − texcoord.y internally — enter Y as if Y=0 is the top.', plain:'x,y is the starting corner of the sprite in the atlas image (top-left, if you imagine Y=0 as the top). z,w is how wide and tall the sprite region is. The shader automatically flips the Y coordinate so you can enter values the natural way — matching how the image looks in your editor.', subs:['x,y = top-left of sprite (after Y-flip convention)','z,w = width and height of the sprite region (0–1 range)','x+z ≤ 1.0 and y+w ≤ 1.0 — exceeding 1.0 causes wrapping artefacts'] },
                          { n:'③', title:'Billboard placement', desc:'position.xyz += r.xxx × viewRight + r.yyy × viewUp. The rotated, scaled corner offset is added along the camera\'s world-space right and up axes. This guarantees the quad faces the camera regardless of view angle.', subs:['position.xyz = your planet\'s XYZ world anchor point','viewRight/viewUp = camera axes supplied by the engine — not configurable','Positive Y = above horizon. Negative Y = below terrain, invisible'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'1.1rem'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4><p>{s.desc}</p>
                              {s.plain && <div className="help-plain" style={{marginTop:'8px',marginBottom:'8px'}}><span className="help-plain-icon">💬</span><span>{s.plain}</span></div>}
                              <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>UV Atlas Coordinates</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>UV coordinates select a rectangular region from the planet texture atlas. The shader flips Y internally — enter Y values as if Y=0 is the top of the image.</p>
                      <div className="help-adv-summary">
                        <div className="help-adv-summary-title">Standard 2×2 atlas slots</div>
                        Top-left: <strong>(0, 0, 0.5, 0.5)</strong> &nbsp;·&nbsp; Top-right: <strong>(0.5, 0, 0.5, 0.5)</strong> &nbsp;·&nbsp; Bottom-left: <strong>(0, 0.5, 0.5, 0.5)</strong> &nbsp;·&nbsp; Bottom-right: <strong>(0.5, 0.5, 0.5, 0.5)</strong> &nbsp;·&nbsp; Full texture: <strong>(0, 0, 1, 1)</strong>
                      </div>
                      <div className="help-adv-timeline">
                        {[
                          { n:'X', title:'X — horizontal start', desc:'0 = left edge of texture, 1 = right edge. For a 2-column atlas: left column x=0, right column x=0.5. x + z must not exceed 1.0.', subs:[] },
                          { n:'Y', title:'Y — vertical start (top-down after shader Y-flip)', desc:'0 = top of image (after the shader applies texcoord.y = 1 − texcoord.y). For a 2-row atlas: top row y=0, bottom row y=0.5. Enter values matching how the image looks in your editor — top to bottom.', plain:'This is the most confusing part. FA\'s UV system has Y=0 at the bottom. But DecalVS flips Y before sampling, which means entering y=0 actually selects the top of the texture. Enter Y as you see the image — top row = 0, bottom row = 0.5. If sprites appear in the wrong row this is usually why.', subs:['Most common mistake: using FA\'s Y-up convention directly → sprites appear flipped','Shader flip: texcoord.y = 1 − texcoord.y'] },
                          { n:'Z', title:'Z — width', desc:'Width of the sprite in UV space. 0.5 = half the texture width. 4-column atlas: z=0.25.', subs:['x + z must not exceed 1.0'] },
                          { n:'W', title:'W — height', desc:'Height of the sprite in UV space. 0.5 = half the texture height. Rectangles can be non-square.', subs:['y + w must not exceed 1.0'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'1rem'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4><p>{s.desc}</p>
                              {s.plain && <div className="help-plain" style={{marginTop:'8px',marginBottom:'8px'}}><span className="help-plain-icon">💬</span><span>{s.plain}</span></div>}
                              {s.subs.length > 0 && <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Best Practices</h3>
                      <div className="help-adv-practice-grid">
                        {[
                          ['Keep Y Clearly Positive', 'Negative Y places the anchor below the horizon — the planet is invisible or clipped. Keep Y at 300+ to ensure it sits above terrain on all map sizes.'],
                          ['Test with (0, 0, 1, 1) First', 'Set UV to (0, 0, 1, 1) to show the full texture. Once the planet is correctly positioned, then refine the atlas region.'],
                          ['Verify UV in the Stars Tab Canvas', 'Upload your planet DDS in the UV Visualization panel (Stars tab) and check that your X,Y,Z,W values select the intended sprite before adding more planets.'],
                          ['Vary Rotation Between Duplicates', 'Planets sharing the same UV slot look identical at rotation=0. Add a small rotation offset between them to break the repetition.'],
                        ].map(([title, desc]) => (
                          <div key={title} className="help-adv-practice-card">
                            <span className="help-adv-practice-icon"><svg width="26" height="26" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="11" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/><path d="M8 13l3.5 3.5 6.5-7" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                            <h4>{title}</h4><p>{desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">04</span>Troubleshooting</h3>
                      <div className="help-adv-ts-grid">
                        {[
                          ['Planet not visible in-game', 'Check that Y is positive and large enough to sit above the horizon. Verify the UV region is not pointing to a transparent atlas area — use (0,0,1,1) to display the full texture as a quick test.'],
                          ['Planet in wrong part of the sky', 'Adjust X and Z in increments of 500+ — the dome is very large. Y controls altitude (higher = more directly overhead). Small adjustments are not visible at dome scale.'],
                          ['Planet looks squashed or stretched', 'Scale X and Scale Y control half-extents independently. Set both to the same value for a circular planet.'],
                        ].map(([q,a]) => (
                          <div key={q} className="help-adv-ts-item">
                            <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                            <div className="help-adv-ts-a">{a}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>)}

                  {/* ── STARS ── */}
                  {activeAdvSubTab === 'stars' && (<>
                    <div className="help-adv-hero">
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">Stars — Procedural Cluster Placement</h2>
                        <p className="help-adv-hero-desc">Stars are billboard props scattered across the sky using a seeded Gaussian cluster model. Cluster anchor points are generated first; each star is then placed either near an anchor using a bell-curve offset, or uniformly across the full sky as a background star.</p>
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Placement Algorithm</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>The generator runs a loop that places one star at a time. Each attempt samples a position, checks exclusion zones, then assigns UV, scale, and rotation. Failed zone checks discard the position and retry from the beginning.</p>
                      <div className="help-adv-summary">
                        <div className="help-adv-summary-title">Loop in brief</div>
                        <strong>1. Generate nClusters centers</strong> (uniform XZ, sampleY for height). &nbsp;
                        <strong>2. For each star:</strong> flip background/cluster coin → sample position → exclusion check (reject &amp; retry if hit) → UV pick → scale + rotation. Hard ceiling: <strong>50 × nStars</strong> attempts.
                      </div>
                      <div className="help-adv-timeline">
                        {[
                          { n:'①', title:'Cluster centers', desc:'nClusters anchor points are placed before any stars. X and Z are uniform random in ±spread. Y follows the selected distribution mode. Centers are not filtered by exclusion zones — only individual stars are checked.', subs:['Centers placed once, shared by all cluster stars','Each cluster star picks a center by random index — natural uneven distribution','Centers placed outside exclusion zones in world space — stars near them may still be excluded'] },
                          { n:'②', title:'Background / cluster coin flip', desc:'rng() < backgroundRatio — one draw per attempt. Background stars land uniformly across ±spread. Cluster stars scatter around a randomly chosen center using a Gaussian offset. The coin re-flips on every retry.', plain:'A weighted coin decides each star\'s mode. backgroundRatio=0.45 means roughly 45% go to background, 55% to a cluster. Because the coin re-flips on retry, a rejected star might switch modes on the next attempt — this is intentional and prevents zone edges from creating unnaturally dense rings.', subs:['bgRatio=0.0: all stars cluster','bgRatio=1.0: all stars background (no clustering)','Coin re-flips on retry — mode can switch between attempts'] },
                          { n:'③', title:'Gaussian cluster offset (Box-Muller)', desc:'result = std × √(−2 × ln(u1)) × cos(2π × u2). Applied independently to X and Z. Produces values concentrated near zero — most cluster stars land within ±1 clusterStdDev of their center, with exponentially fewer landing further out.', plain:'The Gaussian offset is what makes clusters look like real star groupings. Most stars land close to their anchor, some a bit further, very few far out. Adjusting clusterStdDev changes how tight or spread the clusters are — small stdDev produces tight bright groupings, large stdDev produces diffuse galaxy arms.', subs:['2 RNG calls per axis — Box-Muller needs two uniform inputs','Stars can land outside ±spread if the Gaussian tail is wide','Background stars use simple uniform XZ in ±spread instead'] },
                          { n:'④', title:'Exclusion zone check', desc:'Each committed zone defines a world-XZ rectangle. If the candidate position falls inside any active zone, the position is discarded, attempts++ without consuming RNG, and the loop restarts from the coin flip.', subs:['No RNG consumed on rejection — zones do not shift the seed sequence','Max 50 × nStars total attempts — generator gives up if ceiling is hit','Attempts++ counts whether the zone was hit or not'] },
                          { n:'⑤', title:'UV, scale, rotation', desc:'weightedPick selects a UV row (1 RNG call). scale = lerp(scaleMin, scaleMax, rng()). rotation = rng() × 2π. The placed star consumes 3 final RNG calls for its appearance.', subs:['UV: weighted random from the UV rows table','Scale: uniform random in [scaleMin, scaleMax]','Rotation: uniform random in [0, 2π] — any orientation'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'1.1rem'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4><p>{s.desc}</p>
                              {s.plain && <div className="help-plain" style={{marginTop:'8px',marginBottom:'8px'}}><span className="help-plain-icon">💬</span><span>{s.plain}</span></div>}
                              <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Y-Distribution Modes</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>Y is sampled independently for every star and cluster center via sampleY(). All results are clamped to [0, yMax]. The mode does not affect X or Z placement.</p>
                      <div className="help-adv-timeline">
                        {[
                          { n:'①', title:'flat', desc:'Uniform random Y in [0, yMax]. All heights equally likely. Fastest to configure — best starting point before switching to a more realistic mode.', subs:['1 RNG call per Y sample'] },
                          { n:'②', title:'gaussian', desc:'Bell curve centered at yCenter with standard deviation yStdDev. Stars concentrate near yCenter, fewer land further above or below. Good for a visible density band in the sky.', subs:['2 RNG calls per sample (Box-Muller)','Result clamped to [0, yMax]'] },
                          { n:'③', title:'layered', desc:'Multiple Gaussian bands. Each row defines center, stdDev, weight. A band is chosen by weighted pick, then Y is sampled from its Gaussian. Useful for galaxy-arm structures with distinct altitude layers.', subs:['1 RNG call for band pick + 2 for the Gaussian sample','Weight controls what fraction of stars land in each band'] },
                          { n:'④', title:'disk_halo', desc:'Two-component model: a dense Gaussian disk (diskCenter, diskStdDev) plus a diffuse spherical halo (haloStdDev). haloRatio controls the fraction of stars going into the halo. Most realistic Milky Way profile.', subs:['1 RNG call for disk/halo split + 2 for Gaussian Y','Low diskStdDev + high haloStdDev = sharp disk with diffuse outer glow'] },
                          { n:'⑤', title:'curve', desc:'Custom probability density drawn interactively on the curve editor canvas. Control points define the probability of landing at each height. Drag points up to concentrate stars at that altitude, down to reduce them.', subs:['Fully freeform — any distribution shape possible','Curve sampled via inverse CDF at generation time'] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num" style={{fontSize:'1.1rem'}}>{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4><p>{s.desc}</p>
                              <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Seed & Reproducibility</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>The seed generates one deterministic sequence of random numbers consumed left to right. Any change that affects an earlier draw shifts all subsequent star positions — even with the same seed value.</p>
                      <div className="help-adv-summary">
                        <div className="help-adv-summary-title">Safe vs. unsafe parameter changes</div>
                        <strong>Safe</strong> (don't shift sequence): numStars, UV weights, exclusion zones. &nbsp;
                        <strong>Unsafe</strong> (shift sequence): nClusters, spread, stdDev, backgroundRatio, Y-mode parameters.
                      </div>
                      <div className="help-plain"><span className="help-plain-icon">💬</span><span><strong>In plain words:</strong> The seed produces a very long list of numbers in a fixed order — the algorithm reads left to right. Changing nClusters means it reads a different count of values for the centers, shifting everything that follows. Stars land in completely different positions even with the same seed. Safe changes only affect the end of the list (numStars) or bypass it entirely (exclusion zones consume no RNG).</span></div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">04</span>Best Practices</h3>
                      <div className="help-adv-practice-grid">
                        {[
                          ['Fix Seed Before Final Inject', 'Once the distribution looks right, enable Fixed Seed. Without it every run produces a different layout — and re-inject appends, not replaces, so you end up with doubled stars.'],
                          ['Always Exclusion-Zone the Origin', 'Stars near world (0,0) appear at ground level on the map. Draw at minimum a ±2000 world-unit zone around the origin before generating.'],
                          ['Start with 50 Stars', '50 stars at default settings gives a readable preview. Scale up in increments of 20–30 and preview each time. 150+ starts to look overcrowded on most maps.'],
                          ['Use 2–4 UV Rows', 'One UV row means every star looks identical. Even two slightly different sprites break the repetition. Four rows across a 2×2 atlas is the standard FA setup.'],
                        ].map(([title, desc]) => (
                          <div key={title} className="help-adv-practice-card">
                            <span className="help-adv-practice-icon"><svg width="26" height="26" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="11" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/><path d="M8 13l3.5 3.5 6.5-7" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                            <h4>{title}</h4><p>{desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">05</span>Troubleshooting</h3>
                      <div className="help-adv-ts-grid">
                        {[
                          ['Stars appear at ground level', 'yMax is too small, or yMode is "flat" with a very low Max Height. Increase yMax to 500–1500. Also draw an exclusion zone around world (0,0) to block the map-center ground area.'],
                          ['Star layout changes every run', 'Fixed Seed is disabled. Enable it, pick a seed, and lock it before the final generate. After that, re-runs produce the identical layout.'],
                          ['Fewer stars than requested', 'Exclusion zones may cover too much sky area, causing the 50×nStars attempt ceiling to be hit. Reduce zone size, or reduce nClusters so more cluster centers land outside zones.'],
                        ].map(([q,a]) => (
                          <div key={q} className="help-adv-ts-item">
                            <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                            <div className="help-adv-ts-a">{a}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>)}

                  {/* ── OUTPUT & INJECT ── */}
                  {activeAdvSubTab === 'output' && (<>
                    <div className="help-adv-hero">
                      <div className="help-adv-hero-content">
                        <h2 className="help-adv-hero-title">Output & Generate — Lua Format and .scmap Pipeline</h2>
                        <p className="help-adv-hero-desc">The generator writes all configuration as a Lua skyBox table into data.lua inside the map's .scmap archive. The pipeline unpacks the binary archive, replaces only the skyBox block using a regex match, and repacks — all other map data is untouched.</p>
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Lua Output Format</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>The skyBox table maps directly to sky.fx shader variables. Colours are linear RGB 0–1. The Planets array contains both manual planets and generated stars interleaved in insertion order.</p>
                      <div className="help-adv-code-sample">
                        <div className="help-adv-code-label">data.lua — skyBox block</div>
                        <pre>{`skyBox = {
    HorizonColor = { R, G, B, 1 },  -- horizonColor (linear 0–1)
    ZenithColor  = { R, G, B, 1 },  -- skyColor
    HorizonHeight = N,               -- horizonBegin in sky.fx
    ZenithHeight  = N,               -- horizonEnd in sky.fx
    Scale         = N,               -- dome radius (MapSize × 2.288)
    SubtractHeight = N,
    SubdivAxis    = N,
    SubdivHeight  = N,
    DecalGlowMultiplier = N,
    Albedo  = '/path/to/albedo.dds',
    Glow    = '/path/to/glow.dds',
    CirrusMultiplier = N,
    CirrusColor = { R, G, B },
    Cirrus = {
        { freqX, freqY, speed, dirX, dirY },  -- 4 entries always written
        ...
    },
    Planets = {
        { position = {X,Y,Z}, rotation = R,
          scale = {SX,SY}, uv = {X,Y,Z,W} },  -- planets + stars combined
        ...
    },
}`}</pre>
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>IPC Injection Pipeline</h3>
                      <p className="help-adv-hero-desc" style={{marginBottom:'12px'}}>The inject operation runs entirely via IPC calls to the main Electron process. It decompresses the .scmap, patches data.lua with a regex replacement, and recompresses — atomically from the renderer's perspective.</p>
                      <div className="help-adv-summary">
                        <div className="help-adv-summary-title">Pipeline in brief</div>
                        <strong>Find .scmap</strong> → <strong>Unpack</strong> → <strong>Read data.lua</strong> → <strong>Replace skyBox block</strong> via regex → <strong>Write data.lua</strong> → <strong>Repack .scmap</strong> → <strong>Copy back</strong>.
                      </div>
                      <div className="help-plain"><span className="help-plain-icon">💬</span><span><strong>In plain words:</strong> A .scmap is a compressed archive — like a zip file. Inside it is data.lua, a plain text file defining the skybox, lighting, and water for your map. The injector opens the archive, finds the skyBox block in that text, replaces it with the new configuration, and closes the archive again. Every other part of the file is untouched.</span></div>
                      <div className="help-adv-timeline">
                        {[
                          { n:'1', title:'Find .scmap', desc:'Scans the map folder for a file ending in .scmap. FA editor must have saved the map at least once to produce this file. Throws if not found.', subs:['Uses first .scmap if multiple exist','FA must have run at least one save'] },
                          { n:'2', title:'Unpack', desc:'scmap-unpack IPC call decompresses the binary .scmap into a temp folder. A history snapshot is taken before any modification.', subs:['Snapshot enables revert via history'] },
                          { n:'3', title:'Replace skyBox block', desc:'A regex finds skyBox = { ... } in data.lua and replaces it with the newly generated table. Only the skyBox key is touched — all other content is preserved exactly.', subs:['Re-generate is safe — same block overwritten, never appended','Pattern matches from skyBox = { to its closing }'] },
                          { n:'4', title:'Repack & copy back', desc:'scmap-pack compresses the modified temp folder into a new .scmap binary. The result overwrites the original map file. Map folder auto-opens if setting enabled.', subs:[] },
                        ].map(s => (
                          <div key={s.n} className="help-adv-step">
                            <div className="help-adv-step-num">{s.n}</div>
                            <div className="help-adv-step-content">
                              <h4>{s.title}</h4><p>{s.desc}</p>
                              {s.subs.length > 0 && <ul>{s.subs.map((sub,i) => <li key={i}>{sub}</li>)}</ul>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Best Practices</h3>
                      <div className="help-adv-practice-grid">
                        {[
                          ['Back Up data.lua First', 'Before the first generate, copy data.lua to data.lua.bak. Inject is safe for all other map data, but a backup costs nothing and provides a recovery option.'],
                          ['Review the Lua Preview', 'Check the Output tab before injecting. Look for obviously wrong values — negative scales, colours above 1.0, or empty texture paths.'],
                          ['Close FA Before Injecting', 'If FA has the map open it may lock the .scmap or overwrite it on next save. Close FA before running inject.'],
                        ].map(([title, desc]) => (
                          <div key={title} className="help-adv-practice-card">
                            <span className="help-adv-practice-icon"><svg width="26" height="26" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="11" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/><path d="M8 13l3.5 3.5 6.5-7" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                            <h4>{title}</h4><p>{desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="help-adv-structure">
                      <h3 className="help-adv-section-header"><span className="help-adv-section-num">04</span>Troubleshooting</h3>
                      <div className="help-adv-ts-grid">
                        {[
                          ['Nothing changes in-game after inject', 'FA caches the .scmap on load. Close and fully reopen FA after injecting. Confirm the .scmap modification date changed — if it did not, inject failed silently.'],
                          ['skyBox block not found — inject fails', 'data.lua must already contain a skyBox = { ... } block. Open the map in FA editor and save it at least once, then inject.'],
                          ['Colours look blown out', 'FA uses linear RGB 0–1. Values entered as 0–255 will be far too bright. Divide by 255 first — e.g. 200 → 0.784.'],
                        ].map(([q,a]) => (
                          <div key={q} className="help-adv-ts-item">
                            <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                            <div className="help-adv-ts-a">{a}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>)}


                </div>
              )}
            </div>{/* end help-modal-content */}
          </div>{/* end help-modal */}
        </>
    </>
  );
}

export default SkyboxGeneratorHelpModal;
