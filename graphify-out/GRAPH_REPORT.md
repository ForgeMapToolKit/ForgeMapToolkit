# Graph Report - .  (2026-08-11)

## Corpus Check
- Large corpus: 847 files · ~1,641,561 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2390 nodes · 4761 edges · 128 communities (121 shown, 7 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 189 edges (avg confidence: 0.68)
- Token cost: 255,089 input · 0 output

## Community Hubs (Navigation)
- Texture Editor Node Graph
- Scmap History & CLI Terminal
- Skybox Generator & Library
- Scmap Binary Reader
- Community Guides Data
- Texture Node Shaders
- Standalone HTML Windows
- Skybox Star Generation
- Prop Mesh & Gamefiles
- Shared 3D Scene Engine
- Community Contributions Tab
- Map Preview & Image Channels
- Tab Layout Shell & Routes
- Shared EntityPanel Blocks
- Co-Op Map Versioner
- Symmetry Checker Logic
- Dev Dependencies
- Electron CLI Commands
- Electron Main & Logger
- Guides Asset Pipeline
- Props Library & Texture Adjust
- DDS Encoder
- Settings & First Run
- Emitter Library & Wreckage
- Biome Patch Engine (main)
- Community Auth & Upload
- Game Asset Scanner
- FA Water Wave Model
- Runtime Dependencies
- Preview Generation & Path Guard
- Symmetry Extraction (main)
- Node Editor Asset Index
- Adaptive Map Lua Generators
- TabLayout Layout Contract
- Scmap IPC & Preload Bridge
- Props DDS Handling (main)
- Notifications & Modal Builder
- Terrain Type Logic
- Backup Unit Library
- DDS Decoder & TerrainType
- File IPC & Path Security
- App Shell & Shared State
- Unit Library
- Navbar & Tool Registry
- Wave Normals Export Fields
- IPC Channel Contract
- Settings Module (main)
- Footer Logo & Article Preview
- Biome Patch Logic (renderer)
- Biome Channels & Prop Policies
- Wreckage Help Panel
- Texture Color Utilities
- Skybox GitHub Fetch
- Design Lint Script
- Biome Preset Coverage
- Biome Changer Help
- Texture Ramp & Curve Nodes
- Map Resizer
- Map Geometry & Terrain Sampler
- Floating Trees Help
- Symmetry Checker Help
- Ocean Normal Map Bake
- Terrain Type Help
- Wave Normals Help
- Route Ids & Backlog Ideas
- Editor Bridge (named pipe)
- Texture Scanner
- Electron Builder Config
- Ocean Wave Spectrum
- Repo Traps & Baselines
- Wave Normals Preview Render
- FFT Ocean Transform
- HelpPanel Workflow Sections
- Trees Tab & Help
- Atmosphere Layers
- Add Custom Prop
- Backup Props Library
- Tab Registration Rules
- 3D Preview Engine Ideas
- Viewer3D Help
- CSP Hash Generator
- Design Lint Contract
- CLI Runner Bridge
- Guides Download Fetcher
- npm Scripts
- Floating Trees Severity
- CLI Session Store
- Floating Props Logic
- HelpPanel Console Core
- HelpPanel Code Section
- HelpPanel Troubleshooting
- Backup Folder Policy
- Tab Contract Skeleton
- UI Philosophy Hierarchy
- Footer Content Module (dead)
- Footer Article Pipeline
- Home Projection Stage
- Custom Prop Detail
- Autosave Runner
- Backup Emitter Library
- Backup Skybox Library
- Ocean Simulation Rationale
- Package Metadata
- Footer Article Viewer
- TerrainTypes Generator
- Navbar Atmosphere Shader
- Navbar Panel & Register
- Preview Image Help
- Cirrus Cloud Node
- ESLint Config
- Packaged Files List
- Windows Build Signing
- Biome Layer Thumbnails
- Scatter Node
- Auto Level Node
- Blend Node
- Layers Node
- Texture Import Node
- Warp Node
- Combine RGB Alpha Node
- Voronoi Node
- Scenery Preset Ideas
- Build Packaging Gaps

## God Nodes (most connected - your core abstractions)
1. `registerNode()` - 38 edges
2. `readSettings()` - 37 edges
3. `luxuryAlert()` - 37 edges
4. `usePersistentState()` - 34 edges
5. `useMapInfo()` - 33 edges
6. `luxuryConfirm()` - 29 edges
7. `electron/**/*` - 27 edges
8. `TextureEditor()` - 26 edges
9. `log` - 24 edges
10. `useScmapPreview()` - 24 edges

## Surprising Connections (you probably didn't know these)
- `layout.css — workspace shell (rail, column, preview)` --semantically_similar_to--> `Layout X — two columns with aside`  [INFERRED] [semantically similar]
  index_standalone.html → docs/LAYOUTS.md
- `window.electronAPI bridge (popout IPC surface)` --semantically_similar_to--> `logBridge preload API (window.logBridge)`  [INFERRED] [semantically similar]
  src/components/Tabs/MapTools/Scmap/PopOut/scmapPopout.html → electron/log-window.html
- `appendLog (popout console line writer)` --semantically_similar_to--> `appendLine (incremental log append)`  [INFERRED] [semantically similar]
  src/components/Tabs/MapTools/Scmap/PopOut/scmapPopout.html → electron/log-window.html
- `Adding a tab touches exactly three places` --semantically_similar_to--> `The three registries a new tab touches`  [INFERRED] [semantically similar]
  CLAUDE.md → docs/PROJECT_STRUCTURE.md
- `_backup — inert reference copies` --semantically_similar_to--> `No plans, roadmaps or migration trackers in docs/`  [INFERRED] [semantically similar]
  _backup/README.md → docs/README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Log window render/filter pipeline** — electron_log_window_logbridge, electron_log_window_appendline, electron_log_window_redraw, electron_log_window_renderline, electron_log_window_updatestats, electron_log_window_log_record [EXTRACTED 1.00]
- **FMT project identity: origins, licensing, stack, contribution** — src_components_core_footer_content_about_fmt_forgemaptoolkit, src_components_core_footer_content_about_author_seraphim_noob, src_components_core_footer_content_licenses_polyform_noncommercial, src_components_core_footer_content_techstack_electron_choice, src_components_core_footer_content_contribute_trace_design_system [INFERRED 0.85]
- **SCMAP popout drop-to-result flow** — src_components_tabs_maptools_scmap_popout_scmappopout_handledropitems, src_components_tabs_maptools_scmap_popout_scmappopout_setselection, src_components_tabs_maptools_scmap_popout_scmappopout_doaction, src_components_tabs_maptools_scmap_popout_scmappopout_appendlog, src_components_tabs_maptools_scmap_popout_scmappopout_ipc_open_folder [EXTRACTED 1.00]
- **The documents that jointly govern building one tab** — docs_tab_contract_tab_contract, docs_tab_ui_contract_tab_ui_contract, docs_ui_philosophy_ui_philosophy, docs_layouts_tablayout, docs_readme_doc_precedence [EXTRACTED 1.00]
- **The three gates every renderer IPC call passes** — docs_ipc_invoke_channels, docs_ipc_withpathguard, docs_ipc_ispathallowed, docs_ipc_three_gates, docs_tab_contract_security_contract [EXTRACTED 1.00]
- **Read-only analysis tabs: one guarded read, verdict renderer-side** — docs_ipc_symmetry_module, docs_ipc_floating_props_module, docs_ipc_thin_ipc_thick_renderer, docs_ipc_biome_module [INFERRED 0.85]

## Communities (128 total, 7 thin omitted)

### Community 0 - "Texture Editor Node Graph"
Cohesion: 0.08
Nodes (62): pass(), Dropdown(), ancestorsOf(), createEvaluator(), buildMipChain(), exportGraphToDds(), halve(), channelBlitFrag() (+54 more)

### Community 1 - "Scmap History & CLI Terminal"
Cohesion: 0.05
Nodes (51): HIST_HELP_TABS, HIST_INFO, HistoryHelpModal(), buildBannerLines(), buildRecentActivityLines(), buildWelcomeLines(), CliTerminalTab(), LINE_CLS (+43 more)

### Community 2 - "Skybox Generator & Library"
Cohesion: 0.07
Nodes (51): DetailView(), fetchSkyboxLibrary(), SkyboxLibraryOverlay(), toHex(), UV_COLORS, hexToHsv(), hsvToHex(), ColorPicker() (+43 more)

### Community 3 - "Scmap Binary Reader"
Cohesion: 0.07
Nodes (28): arrayToLuaObj(), BinReader, BinWriter, exportScmapData(), fs, getFormat(), indexBinToLua(), indexLuaToBin() (+20 more)

### Community 4 - "Community Guides Data"
Cohesion: 0.05
Nodes (27): getCategoryById(), getGuideById(), getGuidesByCategory(), GUIDE_CATEGORIES, GUIDES, NOTE: All guides will eventually be local. External links (wiki, forum) are, searchGuides(), _assetListCache (+19 more)

### Community 5 - "Texture Node Shaders"
Cohesion: 0.07
Nodes (9): SOURCES, MODES, MODES, SOURCES, VARIANTS, SOURCES, CATEGORY_COLORS, registerNode() (+1 more)

### Community 6 - "Standalone HTML Windows"
Cohesion: 0.05
Nodes (45): appendLine (incremental log append), escHtml (HTML escaping for log messages), levelNum (log level ordinal lookup), Log record shape { time, level, msg }, logBridge preload API (window.logBridge), logBridge preload sanity check fallback, redraw (full log re-render), renderLine (log line renderer + filter) (+37 more)

### Community 7 - "Skybox Star Generation"
Cohesion: 0.10
Nodes (33): readFile(), StarsHelpModal(), Configuration(), Exclusion(), ExclusionAside(), Export(), buildPlanetLua(), buildPlanetsJson() (+25 more)

### Community 8 - "Prop Mesh & Gamefiles"
Cohesion: 0.07
Nodes (34): { boneClusters, parseBlueprint }, fs, { ipcMain }, { log }, path, PROP_ARCHIVES, { readSettings }, { resolveGameFile } (+26 more)

### Community 9 - "Shared 3D Scene Engine"
Cohesion: 0.10
Nodes (33): OGRID_METRES, createAxisGizmo(), createScene3D(), letterSprite(), makeStudioMatcap(), originMarker(), AXIS_COLORS, axisGeometry() (+25 more)

### Community 10 - "Community Contributions Tab"
Cohesion: 0.08
Nodes (33): ASSET_TYPES, AssetDetailModal(), ContributionsTab(), ContributionsWidget(), ContributorProfile(), EmitterUploadForm(), FolderDropZone(), getTier() (+25 more)

### Community 11 - "Map Preview & Image Channels"
Cohesion: 0.15
Nodes (31): loadImageChannel(), sampleChannel(), drawPlacementCanvas(), getMirroredCoords(), kmLabel(), api(), ensureDir(), injectPropsLua() (+23 more)

### Community 12 - "Tab Layout Shell & Routes"
Cohesion: 0.07
Nodes (16): TAB_ROUTES, FileDragOverlay(), useFileDrop(), TabLayout(), useGhostRect(), GUIDE_INFO, MapResizerHelpModal(), SCMAP_HELP_TABS (+8 more)

### Community 13 - "Shared EntityPanel Blocks"
Cohesion: 0.10
Nodes (17): AddTile(), CoordinateList(), DropSlot(), EmitterToggleBlock(), EntityCard(), EntityCardGrid(), MIRROR_OPTIONS, OutputChecklist() (+9 more)

### Community 14 - "Co-Op Map Versioner"
Cohesion: 0.10
Nodes (12): addVersionToMapPath(), { app, ipcMain }, fs, { log }, patchScmapPaths(), path, { readSettings }, SCMAP_HEADER (+4 more)

### Community 15 - "Symmetry Checker Logic"
Cohesion: 0.12
Nodes (30): buildIndex(), buildSymmetryReport(), compareGrid(), heightmapView(), matchBasis(), mirrorBox(), mirrorIndex(), mirrorPoint() (+22 more)

### Community 16 - "Dev Dependencies"
Cohesion: 0.06
Nodes (33): autoprefixer, concurrently, cross-env, electron, electron-builder, eslint, @eslint/js, eslint-plugin-react (+25 more)

### Community 17 - "Electron CLI Commands"
Cohesion: 0.12
Nodes (31): buildDdsHeader(), C, cmdPreview(), cmdRepack(), cmdUnpack(), col(), dispatch(), err() (+23 more)

### Community 18 - "Electron Main & Logger"
Cohesion: 0.08
Nodes (28): { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem, safeStorage, shell }, createWindow(), fs, GUIDE_SCRIPT_HASHES, https, { isPathAllowed, withPathGuard: _withPathGuardBase }, JSZip, {
  log, LOG_FILE, LOG_LEVELS, logBuffer, yieldTick, instrumentIpc, bridgeRendererConsole,
  registerIpc: registerLoggerIpc,
  setLogLevel,
} (+20 more)

### Community 19 - "Guides Asset Pipeline"
Cohesion: 0.12
Nodes (31): ASSET_CACHE_ROOT, ASSETS_ROOT, assetToDataUrl(), assetToSvg(), CONTENT_ROOT, convertMarkdownToGuideHtml(), crypto, escHtml() (+23 more)

### Community 20 - "Props Library & Texture Adjust"
Cohesion: 0.09
Nodes (21): _ddsCache, getTypeIcon(), PropCard(), SORT_OPTIONS, sortProps(), TYPE_ICON, TypeSection(), useDdsPreview() (+13 more)

### Community 21 - "DDS Encoder"
Cohesion: 0.11
Nodes (30): ALPHA6_W0, ALPHA8_W0, alphaError(), assignColorIndices(), buildColorPalette(), buildHeader(), clamp5(), clamp6() (+22 more)

### Community 22 - "Settings & First Run"
Cohesion: 0.08
Nodes (19): FirstRunModal(), applyDefaultPaths(), ATMOSPHERE_QUALITY_OPTIONS, AUTOSAVE_INTERVAL_OPTIONS, ConsoleRail(), DEFAULT_PATHS, DIRTY_IGNORE_KEYS, DONATION_CHANNELS (+11 more)

### Community 23 - "Emitter Library & Wreckage"
Cohesion: 0.09
Nodes (14): cleanMapName(), EmitterLibraryOverlay(), SORT_OPTIONS, sortEmitters(), MirrorDropdown(), PropsConfiguration(), PropsExport(), PropsPropList() (+6 more)

### Community 24 - "Biome Patch Engine (main)"
Cohesion: 0.13
Nodes (27): applyBiomePatch(), applyBlock(), applyPropPatch(), applySlotList(), arrayToLuaObj(), coerceMidColor(), coerceValue(), ENV_KEYS (+19 more)

### Community 25 - "Community Auth & Upload"
Cohesion: 0.08
Nodes (19): { app, ipcMain, shell, BrowserWindow, clipboard }, CONTRIB_AUTH_FILE, CONTRIB_AUTH_META_FILE, CONTRIB_AUTH_TOKEN_BIN, CONTRIB_TOKEN_FILE, detectType(), extractPRMeta(), fs (+11 more)

### Community 26 - "Game Asset Scanner"
Cohesion: 0.12
Nodes (26): { app, ipcMain, BrowserWindow }, checkPreviewCoverage(), fs, https, isIncompleteUnit(), JSZip, { log, yieldTick }, notifyRenderer() (+18 more)

### Community 27 - "FA Water Wave Model"
Cohesion: 0.13
Nodes (24): ANGLE_FAN, autoSupersample(), BAND_MODES, deriveMovement(), editorValues(), ENGINE_WAVE_TEXTURES, estimateBakeBytes(), FA_DEFAULT_SLOTS (+16 more)

### Community 28 - "Runtime Dependencies"
Cohesion: 0.07
Nodes (27): anser, framer-motion, highlight.js, jszip, lucide-react, dependencies, anser, framer-motion (+19 more)

### Community 29 - "Preview Generation & Path Guard"
Cohesion: 0.10
Nodes (20): withPathGuard(), withPathGuard(), withPathGuard(), { app, ipcMain, dialog }, escRe(), { execFile, execFileSync }, fs, isConfiguredEditorPath() (+12 more)

### Community 30 - "Symmetry Extraction (main)"
Cohesion: 0.12
Nodes (20): { decodeDDSToRGBA }, extractMarkers(), extractUnits(), fs, { ipcMain }, isVec(), { log }, makeCtx() (+12 more)

### Community 31 - "Node Editor Asset Index"
Cohesion: 0.11
Nodes (20): _assetIndex, cirrusLayersOf(), { decodeDDSToRGBA }, fs, indexGamedata(), { ipcMain }, isAbsolute(), JSZip (+12 more)

### Community 32 - "Adaptive Map Lua Generators"
Cohesion: 0.17
Nodes (16): AMHHelpModal(), AdaptiveMapHelper(), ALL_TYPE_META, ARMY_COLORS, generateOptionsLua(), generateScriptLua(), generateTablesLua(), getAcuIcon() (+8 more)

### Community 33 - "TabLayout Layout Contract"
Cohesion: 0.11
Nodes (23): X·half carries 16 of 18 tabs — Y/Z/W not load-bearing, Layout X — two columns with aside, Layout Y — single column + standby field, Layout Z — full width internal grid, RAIL_PINNED_KEY — app-wide rail pin state, Second rail (Z · exclusive), StandbyField (defined inside TabLayout.jsx), TabLayout — the universal layout shell (+15 more)

### Community 34 - "Scmap IPC & Preload Bridge"
Cohesion: 0.09
Nodes (17): { contextBridge, ipcRenderer }, { app, ipcMain, dialog }, fs, HISTORY_FILE, JSZip, { log }, path, NOTE: parseLuaDataFile returns Lua tables as 1-indexed objects (+9 more)

### Community 35 - "Props DDS Handling (main)"
Cohesion: 0.11
Nodes (14): { app, ipcMain }, _ddsUrlCache, decodeDDSToPNG(), decodeDXT1Block(), decodeDXT3Block(), decodeDXT5Block(), fs, http (+6 more)

### Community 36 - "Notifications & Modal Builder"
Cohesion: 0.17
Nodes (17): PropsLibraryOverlay(), animateClose(), buildModal(), escapeHtml(), initErrorBridge(), luxuryAlert(), luxuryConfirm(), replaceBrowserAlerts() (+9 more)

### Community 37 - "Terrain Type Logic"
Cohesion: 0.13
Nodes (15): buildTerrainTypeBytes(), clamp01(), computeDominantStratum(), DIRECT_MASK_SHADERS, shaderUsesHalfRange(), STRATUM_SLOTS, MapPreview(), TerrainTypeConfiguration() (+7 more)

### Community 38 - "Backup Unit Library"
Cohesion: 0.16
Nodes (19): AllSubcatView(), FACTION_CONFIG, FACTION_ORDER, FactionLogo(), fetchBlacklist(), fetchSortOverrides(), getIpcRenderer(), getUnitTypeGroup() (+11 more)

### Community 39 - "DDS Decoder & TerrainType"
Cohesion: 0.13
Nodes (18): decodeDDSToRGBA(), decodeDXT1Block(), decodeDXT3Block(), decodeDXT5Block(), { decodeDDSToRGBA }, fs, { ipcMain }, JSZip (+10 more)

### Community 40 - "File IPC & Path Security"
Cohesion: 0.10
Nodes (16): { app, ipcMain, dialog, shell }, fs, https, JSZip, { log }, path, PROP_EMIT_CACHE_FILE, _propEmitCache (+8 more)

### Community 41 - "App Shell & Shared State"
Cohesion: 0.14
Nodes (12): ScanProgressBanner(), UpdateModal(), ForgeMapToolkit(), LibraryContext, loadPersistedShared(), LS_KEY, MAP_NAME_SHARED_KEYS, PERSIST_PREFIX (+4 more)

### Community 42 - "Unit Library"
Cohesion: 0.16
Nodes (19): AllSubcatView(), FACTION_CONFIG, FACTION_ORDER, FactionLogo(), fetchBlacklist(), fetchSortOverrides(), getIpcRenderer(), getUnitTypeGroup() (+11 more)

### Community 43 - "Navbar & Tool Registry"
Cohesion: 0.18
Nodes (14): Banner(), ToolRail(), ToolSlat(), CATEGORIES, getTool(), getToolsByCategory(), TOOLS, getTopActive() (+6 more)

### Community 44 - "Wave Normals Export Fields"
Cohesion: 0.25
Nodes (14): tileMetres(), tileOgrids(), FORMATS, RESOLUTIONS, TEXEL_TARGETS, WaveFidelity(), Field(), Options() (+6 more)

### Community 45 - "IPC Channel Contract"
Cohesion: 0.14
Nodes (19): A new IPC channel needs three things, Biome changer idea, Adding a channel — procedure, biome.js — biome-read-state / biome-apply, Defect: two live channels blocked by the allowlist, INVOKE_CHANNELS preload allowlist, IPC Contract (renderer↔main boundary), isPathAllowed static + dynamic roots (+11 more)

### Community 46 - "Settings Module (main)"
Cohesion: 0.17
Nodes (17): copyDirSync(), DEFAULT_SETTINGS, fs, getNodeExe(), getRunnerPath(), JSZip, { log, yieldTick, LOG_LEVELS }, notifyRenderer() (+9 more)

### Community 47 - "Footer Logo & Article Preview"
Cohesion: 0.17
Nodes (11): FooterArticlePreview(), renderTitle(), FAF_SHAPES, FafLogo(), smoothstep(), Footer(), resolveColorVar(), useFooterPanelState() (+3 more)

### Community 48 - "Biome Patch Logic (renderer)"
Cohesion: 0.19
Nodes (18): baseName(), buildBiomePatch(), clamp01(), diffBlock(), guessRole(), hex2(), isFilled(), nameAffinity() (+10 more)

### Community 49 - "Biome Channels & Prop Policies"
Cohesion: 0.12
Nodes (13): BIOME_CHANNELS, BIOME_LAYER_SLOTS, DEFAULT_CHANNELS, PRESET_ROLE_IDS, PROP_POLICIES, ROLE_IDS, roleById(), FLOAT_VERDICT_LABEL (+5 more)

### Community 50 - "Wreckage Help Panel"
Cohesion: 0.11
Nodes (5): HELP_CATEGORIES, HELP_LINKS, SECTIONS, WreckageHelp(), WreckageHelpButton()

### Community 51 - "Texture Color Utilities"
Cohesion: 0.19
Nodes (11): hexToRgb(), buildUniforms(), render(), render(), SOURCES, stopUniforms(), render(), render() (+3 more)

### Community 52 - "Skybox GitHub Fetch"
Cohesion: 0.16
Nodes (16): { app, ipcMain }, fetchFullTree(), fetchJson(), fetchSkyboxLibraryFromGitHub(), fetchText(), fs, _httpGet(), https (+8 more)

### Community 53 - "Design Lint Script"
Cohesion: 0.12
Nodes (16): args, asJson, boxed, cssFiles, defined, F, files, foreign (+8 more)

### Community 54 - "Biome Preset Coverage"
Cohesion: 0.20
Nodes (14): describePatch(), guessRoles(), patchIsEmpty(), presetCoverage(), presetFromState(), presetToSource(), validatePreset(), api() (+6 more)

### Community 55 - "Biome Changer Help"
Cohesion: 0.11
Nodes (5): BiomeChangerHelp(), BiomeChangerHelpButton(), HELP_CATEGORIES, HELP_LINKS, SECTIONS

### Community 56 - "Texture Ramp & Curve Nodes"
Cohesion: 0.17
Nodes (9): buildUniforms(), render(), buildUniforms(), render(), AlphaRampEditor(), CurveEditor(), NumberField(), QUADRANTS (+1 more)

### Community 57 - "Map Resizer"
Cohesion: 0.19
Nodes (16): cmdResize(), _ddsJsFallback(), duplicateMapVersion(), findScmap(), fs, JSZip, { log, yieldTick }, path (+8 more)

### Community 58 - "Map Geometry & Terrain Sampler"
Cohesion: 0.24
Nodes (11): finalizeMapName(), loadScmapPreview(), api(), useTerrainData(), useMapInfo(), useScmapPreview(), FloatingTreesConfiguration(), api() (+3 more)

### Community 59 - "Floating Trees Help"
Cohesion: 0.12
Nodes (5): FloatingTreesHelp(), FloatingTreesHelpButton(), HELP_CATEGORIES, HELP_LINKS, SECTIONS

### Community 60 - "Symmetry Checker Help"
Cohesion: 0.12
Nodes (5): HELP_CATEGORIES, HELP_LINKS, SECTIONS, SymmetryHelp(), SymmetryHelpButton()

### Community 61 - "Ocean Normal Map Bake"
Cohesion: 0.23
Nodes (14): add(), bakeNormalMap(), boxBlur(), buildMipChain(), clamp01(), dec(), DEFAULT_BAKE, enc() (+6 more)

### Community 62 - "Terrain Type Help"
Cohesion: 0.12
Nodes (5): HELP_CATEGORIES, HELP_LINKS, SECTIONS, TerrainTypeHelp(), TerrainTypeHelpButton()

### Community 63 - "Wave Normals Help"
Cohesion: 0.12
Nodes (5): HELP_CATEGORIES, HELP_LINKS, SECTIONS, WaveNormalsHelp(), WaveNormalsHelpButton()

### Community 64 - "Route Ids & Backlog Ideas"
Cohesion: 0.16
Nodes (15): Route ids are not labels and must not be corrected, tabs/ mirrors the in-app category structure, Floating tree detector idea, Map validator idea, Prop 3D Viewer with SupCom shader + reference units, Symmetry checker idea, Open in Texture Node Editor from 3D view, floating-props.js — floatprops-scan (+7 more)

### Community 65 - "Editor Bridge (named pipe)"
Cohesion: 0.29
Nodes (14): broadcast(), cleanup(), connect(), dispatchMessage(), encodeMessage(), { ipcMain, BrowserWindow }, { log }, net (+6 more)

### Community 66 - "Texture Scanner"
Cohesion: 0.17
Nodes (13): yieldTick(), getGamedataPaths(), { app, ipcMain }, fs, JSZip, { log, yieldTick }, path, TODO: replace with real decode once modules/dds.js exposes a (+5 more)

### Community 67 - "Electron Builder Config"
Cohesion: 0.13
Nodes (15): build, appId, asarUnpack, directories, forceCodeSigning, linux, mac, productName (+7 more)

### Community 68 - "Ocean Wave Spectrum"
Cohesion: 0.20
Nodes (14): resolveSlotBands(), clampWind(), DEFAULT_SEA, DETAIL_FLOOR_TO_L, dispersion(), dispersionDerivative(), G, jonswapS() (+6 more)

### Community 69 - "Repo Traps & Baselines"
Cohesion: 0.25
Nodes (14): Directory case does not match import case, 104 pre-existing ESLint errors baseline, ForgeMapToolkit (agent orientation), Directory case vs. import case inconsistency, Project Structure snapshot, shared/MapLogic — hooks + IO, no CSS, Document precedence ladder, docs/ index — seven documents, one question each (+6 more)

### Community 70 - "Wave Normals Preview Render"
Cohesion: 0.25
Nodes (12): reconstructWaterNormal(), bilinear(), DEEP, renderComposite(), renderLayer(), shadePixel(), SKY, SUN (+4 more)

### Community 71 - "FFT Ocean Transform"
Cohesion: 0.30
Nodes (11): binToMode(), fft1d(), fft1dOffset(), fft2d(), makePlan(), bandWindow(), createOceanField(), evaluateOcean() (+3 more)

### Community 72 - "HelpPanel Workflow Sections"
Cohesion: 0.16
Nodes (5): buildBranch(), buildSpine(), EASE, JITTER, WorkflowSection()

### Community 73 - "Trees Tab & Help"
Cohesion: 0.20
Nodes (9): _hl(), TreesHelpModal(), TreesHelpReplica(), TreesCards(), TreesChannels(), TreesConfiguration(), TreesExport(), availableColors (+1 more)

### Community 74 - "Atmosphere Layers"
Cohesion: 0.27
Nodes (9): AtmosphereLayer(), resolveColor(), createAtmosphereEngine(), STANDBY_COLOR, HAZE_FRAG, HAZE_VERT, getOrCreateEngine(), NavbarAtmosphereLayer() (+1 more)

### Community 75 - "Add Custom Prop"
Cohesion: 0.23
Nodes (9): AddCustomPropOverlay(), DEFAULT_ROCK, DEFAULT_TREE, FolderDropZone(), groupPropFiles(), parseBpText(), readBase64(), readDirectoryEntryRecursive() (+1 more)

### Community 76 - "Backup Props Library"
Cohesion: 0.23
Nodes (9): _ddsCache, getTypeIcon(), PropCard(), PropsLibraryOverlay(), SORT_OPTIONS, sortProps(), TYPE_ICON, TypeSection() (+1 more)

### Community 77 - "Tab Registration Rules"
Cohesion: 0.20
Nodes (12): Dead code that still looks live, Styling goes through tokens, Adding a tab touches exactly three places, Defect: duplicate handler registrations, tabs/CoOp/ is dead code, tabRoutes.jsx — the routing authority (22 routes), The three registries a new tab touches, Styling contract (§5 tokens + --tab-color) (+4 more)

### Community 78 - "3D Preview Engine Ideas"
Cohesion: 0.20
Nodes (12): 3D Preview Viewer (Props / Waves / Sky), Cinematic creator idea, Civilian bases as presets or 3D editor, FMT 3D Preview Engine (shared viewer), Sky / Environment 3D Preview (sky dome), Layout W — full width with top bar, shared/Scene3D — raw three.js layer (no R3F), §12 The 3D viewport carve-out (+4 more)

### Community 79 - "Viewer3D Help"
Cohesion: 0.17
Nodes (6): HelpButton(), HELP_CATEGORIES, HELP_LINKS, SECTIONS, Viewer3DHelp(), Viewer3DHelpButton()

### Community 80 - "CSP Hash Generator"
Cohesion: 0.17
Nodes (8): allHashes, CONTENT_ROOT, crypto, fs, GUIDES_REL, MAIN_JS, path, SRC_ROOT

### Community 81 - "Design Lint Contract"
Cohesion: 0.24
Nodes (11): npm run lint:design, Definition of Done checklist per tab, Help system migration (HelpPanel vs. HelpModals), The four-level button hierarchy, design-lint checks: ORPHAN / FOREIGN / BOXED / LITERAL, §4 The line law — three line tiers, §10 Horizontal line soup — the failure being solved, Unconditional resting baseline on empty inputs (+3 more)

### Community 82 - "CLI Runner Bridge"
Cohesion: 0.22
Nodes (6): classify(), cli, { ipcMain, BrowserWindow }, { log }, push(), withStreamedConsole()

### Community 83 - "Guides Download Fetcher"
Cohesion: 0.22
Nodes (9): fs, https, httpsGetBuffer(), _httpsGetOnce(), { ipcMain, dialog }, { log }, path, previewCache (+1 more)

### Community 84 - "npm Scripts"
Cohesion: 0.18
Nodes (11): scripts, build, dev, electron:build, electron:dev, lint, lint:design, prebuild (+3 more)

### Community 85 - "Floating Trees Severity"
Cohesion: 0.35
Nodes (8): FLOAT_OBVIOUS, FloatingTreesFindings(), VERDICT_CLASS, describe(), FloatingTreesPlacements(), SEVERITY_CLASS, severityClass(), shortName()

### Community 86 - "CLI Session Store"
Cohesion: 0.24
Nodes (8): { app, ipcMain }, filePath(), fs, { log }, path, readAll(), writeAll(), log

### Community 87 - "Floating Props Logic"
Cohesion: 0.38
Nodes (9): ANCHOR_DRIFT, buildFloatingPropsReport(), findHotspots(), fmtGap(), fmtPos(), groupByBlueprint(), judgeFloatingProps(), shortName() (+1 more)

### Community 88 - "HelpPanel Console Core"
Cohesion: 0.22
Nodes (3): HelpConsole(), Help(), SECTIONS

### Community 89 - "HelpPanel Code Section"
Cohesion: 0.29
Nodes (9): CodeLine, CodeSection(), JSON_BOOLEANS, LUA_KEYWORDS, tokenise(), tokeniseBash(), tokeniseJson(), tokeniseLua() (+1 more)

### Community 90 - "HelpPanel Troubleshooting"
Cohesion: 0.36
Nodes (9): buildDiscordMessage(), buildIssueBody(), buildTitle(), emptyForm(), FREQUENCY_OPTIONS, frequencyLabel(), openLogFolder(), TARGET_OPTIONS (+1 more)

### Community 91 - "Backup Folder Policy"
Cohesion: 0.22
Nodes (9): _backup — inert reference copies, Frozen Libraries snapshot (2026-07-26), Never import from _backup/, Why the toolchain never sees _backup/, Dangling citations to deleted plan documents, No plans, roadmaps or migration trackers in docs/, Architecture overview (main / preload / renderer), Why Vite (+1 more)

### Community 92 - "Tab Contract Skeleton"
Cohesion: 0.25
Nodes (9): Naming convention (PascalCase / camelCase / lowercase), EmitterToggleBlock replaces the matching-mode step, Shared/Ui/EntityPanel building blocks, Parent skeleton (state, hooks, handlers, slots), State & persistence contract (usePersistentState, key prefix), Section components & props bundles, Shared/MapLogic public surface, A tab is thin orchestration (+1 more)

### Community 93 - "UI Philosophy Hierarchy"
Cohesion: 0.25
Nodes (8): The Ghost (Level 0) removed as decoration without cause, §2 The staircase (title / subtitle / content), The two-channel node card (identity head / state ring), Dependency-by-dependency rationale table, §3 Hierarchy tools (eyebrow, structural line, accent word), §5 Motion is meaning, Size and color are decoupled, prefers-reduced-motion fallback block

### Community 94 - "Footer Content Module (dead)"
Cohesion: 0.32
Nodes (7): fs, getContentRoot(), { ipcMain, app }, path, NOTE: the existing 'read-guide' handler this is meant to mirror (Phase-0, readFooterArticle(), registerFooterContentHandlers()

### Community 95 - "Footer Article Pipeline"
Cohesion: 0.25
Nodes (8): Changelog (empty, no tracked releases), How to Contribute (article), TRACE design system, Per-tab help console documentation model, Footer article loading pipeline (Footer.jsx -> FooterContentViewer -> read-footer-article IPC), ForgeTools (placeholder article), cp-* footer article markup vocabulary (callout, shortcuts, code, notes), Keyboard Shortcuts (placeholder / style specimen)

### Community 96 - "Home Projection Stage"
Cohesion: 0.36
Nodes (4): HeaderRegister(), ProjectionStage(), TraceLine(), HomeScreen()

### Community 97 - "Custom Prop Detail"
Cohesion: 0.32
Nodes (6): CUSTOM_FILE_TYPES, FILE_TYPES, PropDetail(), SLIDERS, PropPreviewImg(), useDdsPreview()

### Community 98 - "Autosave Runner"
Cohesion: 0.25
Nodes (5): fs, LOG_FILE, path, SETTINGS_FILE, src

### Community 99 - "Backup Emitter Library"
Cohesion: 0.38
Nodes (4): cleanMapName(), EmitterLibraryOverlay(), SORT_OPTIONS, sortEmitters()

### Community 100 - "Backup Skybox Library"
Cohesion: 0.33
Nodes (3): DetailView(), toHex(), UV_COLORS

### Community 101 - "Ocean Simulation Rationale"
Cohesion: 0.33
Nodes (7): Wave 3D Preview (ocean plane), shared/Ocean — FFT ocean simulator, React as a shell, not the compute layer, Svelte considered and rejected, useRef keeps 60fps canvas interaction off the React cycle, Vue 3 considered and rejected, Why React

### Community 102 - "Package Metadata"
Cohesion: 0.29
Nodes (6): bin, fmt, description, main, name, version

### Community 103 - "Footer Article Viewer"
Cohesion: 0.43
Nodes (4): FooterArticleTab(), FooterContentViewer(), FOOTER_CONTENT, getFooterContent()

### Community 104 - "TerrainTypes Generator"
Cohesion: 0.33
Nodes (6): fs, main(), OUT_PATH, parseAsset(), path, STYLE_NAMES

### Community 105 - "Navbar Atmosphere Shader"
Cohesion: 0.47
Nodes (3): STANDBY_COLOR, HAZE_FRAG, HAZE_VERT

### Community 106 - "Navbar Panel & Register"
Cohesion: 0.47
Nodes (3): NavbarPanel(), Register(), SlatRow()

### Community 107 - "Preview Image Help"
Cohesion: 0.33
Nodes (4): GUIDE_INFO, PreviewImageHelpModal(), RESOLUTIONS, STEPS

### Community 108 - "Cirrus Cloud Node"
Cohesion: 0.53
Nodes (4): rad(), render(), v4(), CirrusEditor()

### Community 109 - "ESLint Config"
Cohesion: 0.50
Nodes (4): globals, react, reactHooks, reactRefresh

### Community 110 - "Packaged Files List"
Cohesion: 0.40
Nodes (5): files, data/**/*, dist/**/*, public/**/*, utils/**/*

### Community 111 - "Windows Build Signing"
Cohesion: 0.40
Nodes (5): win, sign, icon, signtoolOptions, target

### Community 112 - "Biome Layer Thumbnails"
Cohesion: 0.50
Nodes (3): BIOME_ROLES, BiomeLayers(), fileOf()

### Community 113 - "Scatter Node"
Cohesion: 0.40
Nodes (3): DIST, MODES, SOURCES

### Community 114 - "Auto Level Node"
Cohesion: 0.67
Nodes (3): clipRange(), MODES, render()

### Community 116 - "Layers Node"
Cohesion: 0.67
Nodes (3): modeIdx(), MODES, render()

## Ambiguous Edges - Review These
- `Splash screen (startup window)` → `window.electronAPI bridge (popout IPC surface)`  [AMBIGUOUS]
  src/components/Tabs/MapTools/Scmap/PopOut/scmapPopout.html · relation: conceptually_related_to
- `3D Preview Viewer (Props / Waves / Sky)` → `Civilian bases as presets or 3D editor`  [AMBIGUOUS]
  docs/IDEEN.txt · relation: conceptually_related_to
- `FMT 3D Preview Engine (shared viewer)` → `Cinematic creator idea`  [AMBIGUOUS]
  docs/IDEEN.txt · relation: conceptually_related_to
- `EmitterToggleBlock replaces the matching-mode step` → `Emitter Assignment — Rework Mockup v2 (standalone)`  [AMBIGUOUS]
  index_standalone.html · relation: conceptually_related_to

## Knowledge Gaps
- **536 isolated node(s):** `SORT_OPTIONS`, `_ddsCache`, `TYPE_ICON`, `SORT_OPTIONS`, `UV_COLORS` (+531 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Splash screen (startup window)` and `window.electronAPI bridge (popout IPC surface)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `3D Preview Viewer (Props / Waves / Sky)` and `Civilian bases as presets or 3D editor`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `FMT 3D Preview Engine (shared viewer)` and `Cinematic creator idea`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `EmitterToggleBlock replaces the matching-mode step` and `Emitter Assignment — Rework Mockup v2 (standalone)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `err()` connect `Electron CLI Commands` to `Texture Editor Node Graph`, `Scmap History & CLI Terminal`, `Notifications & Modal Builder`, `Community Contributions Tab`, `Add Custom Prop`, `Biome Patch Engine (main)`, `Map Resizer`, `Footer Content Module (dead)`?**
  _High betweenness centrality (0.315) - this node is a cross-community bridge._
- **Why does `CustomPropsTab()` connect `Notifications & Modal Builder` to `Electron CLI Commands`, `Map Geometry & Terrain Sampler`, `Map Preview & Image Channels`, `Tab Layout Shell & Routes`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Why does `electron/**/*` connect `Scmap IPC & Preload Bridge` to `Prop Mesh & Gamefiles`, `Co-Op Map Versioner`, `Electron Main & Logger`, `Guides Asset Pipeline`, `Community Auth & Upload`, `Game Asset Scanner`, `Preview Generation & Path Guard`, `Symmetry Extraction (main)`, `Node Editor Asset Index`, `Props DDS Handling (main)`, `DDS Decoder & TerrainType`, `File IPC & Path Security`, `Settings Module (main)`, `Skybox GitHub Fetch`, `Map Resizer`, `Editor Bridge (named pipe)`, `Texture Scanner`, `CLI Runner Bridge`, `Guides Download Fetcher`, `CLI Session Store`, `Footer Content Module (dead)`, `Packaged Files List`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._