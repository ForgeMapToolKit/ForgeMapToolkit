# Tech Stack Decisions — ForgeMapToolkit

> Why Electron + React + Vite — a structured reasoning document for contributors.
>
> *Checked against the code 2026-07-26: tab list, IPC surface and dependency set
> refreshed. No decision was revisited — the reasoning below still holds.*

---

## What the App Does

ForgeMapToolkit is a **desktop companion tool for Supreme Commander: Forged Alliance map authoring**. It covers the full workflow from map setup through asset placement, visual generation, binary packaging, and community contribution. Across its tabs:

| Tab | What it actually does |
|---|---|
| **Wreckage** | Scans ~17 SCD/ZIP archives containing thousands of unit blueprints, maintains a unit/emitter/prop database, coordinates wreckage and unit placement in map files |
| **Props** | Grid-based prop placement with Poisson disk sampling, spawn-map masking, mirror modes, and multi-blueprint card system — writes directly to the game maps folder |
| **Emitters** | Particle emitter placement with configurable Poisson jitter, mask-based spawn filtering, category matching, and mirror support |
| **Rock Erosion** | Procedural rock/debris/scree placement using erosion wear maps, spawn-threshold masks, grid resolution controls, and size-blend sigma — three independent card types per run |
| **Trees** | Tree placement with interactive UI replica of the FA TreeMap tab for visualizing placement logic |
| **SCMAP Tool** | Unpacks and repacks binary `.scmap` files — parsing embedded data blocks (heightmap, normal map, albedo, watermap, marker data) via a custom binary parser |
| **Skybox Generator** | Generates `.scmskybox` JSON files with interactive Bézier curve editors (Canvas 2D) for tone-mapping probability curves, UV color row configuration, and star field settings |
| **Stars** | Companion to the Skybox Generator — Canvas-based UV mapping and star distribution curve editor using the same `useRef`-backed interaction model |
| **Custom Props** | Loads local `.dds` texture files via IPC, applies non-destructive texture adjustments on canvas, bakes and writes modified prop asset files. Contains the multi-pass **Texture Editor** — a canvas editing pipeline with per-pass history and a side-by-side diff viewer |
| **Terrain Type** | Derives the terraintype layer from stratum albedos and writes it back into the `.scmap` binary |
| **Wave Normals** | FFT ocean simulation (Phillips/PM/JONSWAP/TMA spectra) baked to FA's `water2.fx` normal/foam slots — runs in a Web Worker off the renderer thread |
| **Texture Editor** *(`node-editor`)* | A node-graph image compositor: ~38 WebGL node types (blur, curves, voronoi, warp, gradient map, layer stack), a `.fmtgraph` document model, DDS export |
| **Map Resizer** | Rescales a map's `.scmap` and its scenario/save Lua, and duplicates map versions |
| **Preview Image** | Renders and replaces the map's preview DDS |
| **Adaptive Map Helper** | Assigns mass/hydrocarbon markers to armies on an interactive canvas and generates `tables.lua` / `options.lua` / `script.lua` |
| **CLI Terminal** | In-app terminal for the `fmt` CLI, with saved sessions |
| **Settings** | Configures game paths, map defaults, export formats, log levels, autosave intervals, and triggers library rescans |
| **History** | Cross-tab change history with snapshot restore and character-level LCS diff rendering |
| **Contributions** | GitHub Device Flow OAuth, tiered contributor leaderboard, community asset browser with DDS-to-dataURL preview via IPC, asset upload workflow |

The app is not a thin file manager. It runs algorithms (Poisson disk sampling, erosion simulation, LCS diff), generates game-format JSON files (`.scmskybox`), processes binary game archives, and connects to GitHub for both asset delivery and community features.

---

## Why a Native Desktop App?

A **hosted web app** cannot:
- Access `C:\Program Files\Supreme Commander\gamedata\` or FAForever's data directory
- Read binary `.scd` ZIP archives from the local filesystem
- Write output files directly to the user's maps folder
- Open native OS file-picker dialogs
- Load local `.dds` files from arbitrary disk paths for canvas preview

A **CLI tool** cannot:
- Provide the interactive Bézier curve editors for skybox and star generation
- Render the unit/emitter/prop library overlays
- Show Poisson disk sampling results interactively as parameters change
- Run the multi-pass canvas texture editing pipeline
- Display the community leaderboard and asset browser

A **native C++/C# desktop app** could satisfy the file I/O and algorithm requirements but would require building the entire UI from scratch — the Canvas 2D editors, the diff viewer, the unit library with 500+ units, the faction theming system, the community tab — at enormous cost. The browser rendering engine provides all of this for free.

**Conclusion:** A framework that bridges native OS access with a browser rendering engine is necessary.

---

## Why Electron?

Electron embeds Chromium (renderer process) and Node.js (main process) in a single distributable. Every hard requirement maps directly to a built-in API:

| Requirement | Electron solution |
|---|---|
| Read SCD/ZIP archives from game install | `fs` + `jszip` in main process |
| Parse `.scmap` binary (heightmap, DDS blocks) | Custom `scmap.js` parser in Node |
| Write output files to maps folder | `fs.writeFileSync()` |
| Open native file-picker dialogs | `dialog.showOpenDialog()` |
| Load local `.dds` files for canvas preview | `dds-to-dataurl` / `dds-url-to-dataurl` IPC handlers |
| GitHub Device Flow OAuth | `https` module in Node — no browser redirect needed |
| Fetch community assets from GitHub at runtime | `https` module — no CORS, no proxy |
| Scan 17 SCD files, cache 2841 emitters | Node.js `fs` + `jszip` in ~15s |
| IPC between UI logic and file operations | `ipcMain.handle()` / `ipcRenderer.invoke()` |
| Single distributable for the FA community | Electron Builder portable mode |

The IPC architecture separates concerns cleanly: the main process handles all filesystem and binary operations; the renderer handles all UI state. This means the UI never blocks during a full library scan, and the binary parser never runs in a context where it could crash the renderer.

### Real IPC surface in the app

**122 `ipcMain.handle` channels across 26 modules in `electron/modules/`** (regenerated
2026-08-12 with `npm run docs:ipc`). Every one must also appear in the `INVOKE_CHANNELS`
allowlist in `electron/preload.js` or `invoke()` rejects it (TAB_CONTRACT §8) — **22
currently do not**; see `IPC.md`. By area:

```
binary / .scmap      scmap-unpack · scmap-pack · scmap-pack-folder · scmap-patch-water
                     scmap-read-strata · scmap-read-terrain · scmap-write-terraintype
                     scmap-list · scmap-select-file · scmap-snapshot-folder
                     read-map-info · read-scenario-size
                     (+ scmap-progress as an event, not a handler)

DDS / images         dds-to-dataurl · dds-url-to-dataurl · write-dds · png-to-preview-dds
                     preview-render · preview-image-step · preview-replace-dds
                     load-image · resolve-lod-preview-urls

libraries / scanning library-load · library-scan · library-invalidate · library-set-custom-tags
                     scan-global-props · scan-map-props · scan-map-emitters
                     texture-library-load · texture-library-scan · texture-extract
                     skybox-library-load · skybox-library-fetch
                     resolve-prop-to-emit · resolve-stratum-albedos

node editor          node-editor-{create-project,list-projects,load-project,
                     save-graph,delete-graph,list-assets,load-texture,read-skybox}

map resizer          mr-{find-scmap,scale-scmap,scale-save-lua,update-scenario-lua,
                     duplicate-map-version} · make-map-adaptive

files (path-guarded) read-file · read-file-base64 · write-file · copy-file · delete-file
                     ensure-dir · list-dir · backup-file · download-file
                     save-generated-file · save-blueprint · save-custom-prop
                     save-custom-prop-folder · generate-prop-files · read-data-file

community / GitHub   github-auth-{start,poll,status,logout} · github-create-issue
                     contrib-load-github-data · contrib-download-asset
                     contrib-parse-scmskybox · contrib-{get,set}-maintainer-token-status
                     submit-contribution-pr

guides / footer      read-guide · save-guide · read-guide-asset · guide-asset-list
                     guide-asset-cache-clear · guide-downloads-{manifest,preview,save}
                     read-footer-article

CLI / sessions       cli-exec · cli-abort · cli-session-{list,load,save}

settings / shell     settings-{load,save,get-version,pick-file,pick-folder}
                     load-config · save-config · open-folder · open-external
                     open-log-window · open-tool-window · get-log-file-path
                     clipboard-write-text · check-update · get-asset-base-url
                     load-faction-icon · autosave-{run-now,get-status}
                     history-load · history-save · coop-version-fix
                     bridge-{connect,disconnect,send-snapshot}
                     civilians-{load,save}-presets
```

This is not a thin Electron wrapper around a website. The IPC surface reflects genuine coordination between native file operations, binary processing, and a reactive UI.

> This list is a snapshot and will drift. The authoritative sources are the
> `ipcMain.handle` calls in `electron/modules/` and the `INVOKE_CHANNELS` set in
> `electron/preload.js`. Regenerate with:
> `grep -rho "ipcMain\.handle(\s*'[^']*'" electron/ | sed "s/.*'\(.*\)'/\1/" | sort -u`

### Considered Alternatives

**Tauri (Rust backend + WebView)**

Tauri produces smaller binaries. However:

- The Rust backend requires a second language for every contributor. The binary parser (`scmap.js`), the blueprint scanner, the Poisson disk sampler, the rock erosion algorithm — all of this would need to be rewritten in Rust or wrapped via FFI. The existing codebase encodes significant accumulated knowledge of FA's file formats and game-specific logic; rewriting it for marginal binary size savings is not justified.
- Tauri's WebView uses the system browser engine, which varies across Windows versions. The FA community includes users on older Windows builds where WebView2 may be outdated or absent. Electron's bundled Chromium is consistent everywhere — this matters for canvas pixel-precise operations in the Skybox Generator, Stars, and Texture Editor.
- The Tauri IPC model is more rigid than Electron's `ipcMain.handle()` pattern. This project adds new IPC channels frequently during development; that iteration speed would be lost.
- The Node.js ecosystem for binary parsing, ZIP handling, and image processing is significantly richer than Rust/Tauri's equivalent, and most of it is already in use.

**NW.js**
Smaller community, fewer maintained packages, no meaningful technical advantage for this use case.

**Python + PyQt / Tkinter**
The app has significant JS logic accumulated over time. Python has no component library matching the visual quality required, and the Canvas-based pipelines (curve editors, texture adjustments, erosion wear map rendering) have no natural Python equivalent without adding heavy dependencies like OpenCV.

**Verdict:** Electron is the correct choice. Its size overhead is justified by development velocity, rendering consistency, and the depth of the Node.js ecosystem for this specific workload.

---

## Why React?

The UI state is deeply nested, expensive to compute, and performance-sensitive in specific ways that React's hook model handles precisely:

**Unit library (`Wreckage.jsx`, `UnitLibraryOverlay.jsx`):** 500+ units each with faction, layer, tier, bpCategories, strategicIcon, sort overrides, and blacklist state. `useMemo` recomputes `groupedUnits` only when the faction selection, active filters, sort overrides, or blacklist change — not on every keystroke.

**Canvas curve editors (`SkyboxGenerator.jsx`, `Stars.jsx`):** Interactive Bézier tone-curve editors where every mouse move triggers O(n) nearest-point search across control points at ~60fps. All mutable interaction state — mouse position, drag handle, hit radius — lives in `useRef`. This keeps the editor entirely off the React render cycle during interaction. `useState` fires only on commit (mouseup), not on every drag frame.

**Poisson disk sampling (`Props.jsx`, `Emitter.jsx`, `RockErosion.jsx`):** Grid-with-jitter placement algorithms that run in the renderer on parameter change, producing hundreds to thousands of coordinate pairs. `useRef` for the canvas overlay, `useMemo` for derived placement data. The result feeds directly into file output without a round-trip to the main process.

**Erosion wear map (`RockErosion.jsx`):** Canvas-rendered simulation output (`erosionWearMap`, `erosionWearMapData`) stored as `useState` that persists across card configuration changes without rerunning the simulation unless explicitly triggered.

**Multi-pass texture editor (`Scenery/CustomProps/TextureEditor/TextureEditor.jsx`):** Canvas history stack where each pass is a full ImageData snapshot. `useRef` holds the canvas context and current pixel buffer for live brush operations; `useState` holds the committed pass history and is used only for the diff viewer. The boundary between "editing" and "done" is explicit by design.

**Node graph evaluator (`Textures/TextureEditor/`):** ~38 WebGL node types evaluated against a `.fmtgraph` document that is the single source of truth. The GL context, texture store and framebuffer pool live in plain modules outside React entirely (`engine/`); React holds only view state (pan/zoom, selection) and the document. This is the clearest case in the app of React being used as a *shell*, not as the compute layer.

**Off-thread ocean bake (`Textures/WaveNormals/`):** the FFT ocean simulator in `shared/Ocean/` has no DOM and no React dependency at all — `bakeWorker.js` runs it in a Web Worker and `useBake.js` owns only the worker lifecycle and the layer results. A bake that would freeze the renderer for seconds is invisible to it.

**Cross-tab history (`History.jsx`):** Character-level LCS diff between arbitrary text snapshots, `useMemo`-cached against the snapshot pair. The side-by-side renderer expands context windows dynamically based on changed-line proximity.

React's model is not used for its own sake. `useMemo`, `useCallback`, `useRef`, and `useEffect` are the exact tools needed to manage these performance characteristics at this complexity level.

### Considered Alternatives

**Vue 3**
A legitimate alternative with equivalent capabilities. The project started in React and is now fully committed to that model. Switching provides no technical benefit.

**Svelte**
Excellent compile-time reactivity for simple components. However, Svelte's store model is less suited to deeply nested state with expensive derived values, and the `useRef`-backed canvas interaction pattern (keeping 60fps input off the reactive cycle) would require explicit workarounds with no net gain.

**Vanilla JS / Web Components**
Not viable for an app with this many overlapping stateful components. Manual DOM management for the unit library, the canvas editors, the erosion wear map, and the cross-tab history system simultaneously would be prohibitively complex to maintain.

**Verdict:** React is the right choice for stateful, performance-sensitive UI at this scale.

---

## Why Vite?

The development loop for this project is:

1. Change a component (e.g. a curve editor parameter, a filter button, a Poisson radius control)
2. See the result in the Electron renderer

With webpack/CRA this round-trip takes several seconds. With Vite's HMR it is instantaneous — the component updates in the renderer without a page reload, preserving all loaded state. For a tool where a full library scan takes ~30 seconds and canvas editing state accumulates over time, losing state on every rebuild would make development significantly more painful. Vite's HMR eliminates that entirely.

Vite produces clean Rollup-bundled output in `dist/` that Electron loads via `loadFile(indexPath)`. The asset pipeline handles images, CSS, and SVGs automatically with no configuration.

**Verdict:** The HMR speed advantage is material for a project of this complexity. Vite is the correct choice.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  Electron Main Process  (Node.js)                        │
│                                                          │
│  Binary / file operations     Data layer                 │
│  ├── utils/scmap.js (FA bin)  ├── libraries.json cache   │
│  ├── jszip    (SCD archives)  ├── unit_overrides.json    │
│  ├── dds.js / dds-decode.js   ├── unit_blacklist.json    │
│  └── sharp    (image ops)     ├── prop_overrides.json    │
│                               └── settings (userData)    │
│                                                          │
│  122 IPC handlers across 26 modules (ipcMain.handle)     │
│  all path-touching handlers wrapped in withPathGuard()   │
├──────────────────────────────────────────────────────────┤
│  IPC Bridge — electron/preload.js                        │
│  invoke()  →  async response, gated by INVOKE_CHANNELS   │
│  on()      →  progress events (scmap-progress, …)        │
├──────────────────────────────────────────────────────────┤
│  Electron Renderer Process  (Chromium + React 18)        │
│                                                          │
│  Placement tabs        Visual generation                 │
│  ├── Wreckage          ├── Skybox Generator              │
│  ├── Props             ├── Stars                         │
│  ├── Emitter           ├── Texture Editor (WebGL graph)  │
│  ├── Rock Erosion      ├── Wave Normals ──┐              │
│  ├── Trees             └── Preview Image  │              │
│  └── Custom Props                         │              │
│      └── Texture Editor      Web Worker ──┘              │
│                              └── shared/Ocean (FFT)      │
│  Map tooling           Community / shell                 │
│  ├── SCMAP Tool        ├── Contributions (GitHub OAuth)  │
│  ├── Terrain Type      ├── Guides                        │
│  ├── Map Resizer       ├── Settings                      │
│  ├── Adaptive Map      ├── History (cross-tab)           │
│  └── CLI Terminal      └── Home / Navbar (three.js haze) │
│                                                          │
│  Shell: shared/Ui/TabLayout — X/Y/Z/W (see LAYOUTS.md)   │
│  Build: Vite + @vitejs/plugin-react → dist/              │
└──────────────────────────────────────────────────────────┘
```

---

## Summary

| Layer | Choice | Why — specific to this project |
|---|---|---|
| Desktop runtime | **Electron** | Binary `.scmap` parser, DDS encode/decode, SCD/ZIP scanning, direct write to maps folder, GitHub OAuth — none of this is possible in a browser |
| UI framework | **React** | `useMemo` for 500-unit library grouping and LCS diffs; `useRef` for 60fps canvas curve editors and erosion wear maps; `useCallback` for Poisson placement |
| Build tool | **Vite** | Instant HMR preserves library and canvas state during development; a full library scan takes ~30s so state loss on rebuild is unacceptable |
| ZIP parsing | **JSZip** | Pure JS, no native dependency, runs in Node main process alongside all other file I/O |
| Binary parsing | **Custom `utils/scmap.js`** | Ported from BrewMapTool — handles FA's specific binary format for heightmap, DDS blocks, and marker data (~1165 lines) |
| Image ops | **sharp** | Native, unpacked from asar (`asarUnpack`); resize/encode work that would be far slower in pure JS |
| 3D / GPU | **three.js** | The home and navbar atmosphere layers. The node editor's compositor uses raw WebGL, not three.js — it needs framebuffer-level control |
| Motion | **framer-motion** | Declarative enter/exit for overlays and panels, matching Philosophy §5 ("motion is meaning") |
| Markdown / code | **react-markdown + rehype-highlight + remark-gfm + highlight.js** | Guides, footer articles and the generated-Lua viewers render authored content |
| Skybox format | **JSON (.scmskybox)** | FA's native skybox format; generated directly in the renderer with no binary encoding step |
| Node graph format | **JSON (.fmtgraph)** | The document is the single source of truth; the evaluator is a pure function of it |
| Config/overrides | **JSON files** | Human-editable by map authors and contributors, version-controllable, no database overhead |
| Packaging | **electron-builder**, portable `dir` target on Windows | Code signing is deliberately skipped — the FA community distributes unsigned tooling. ⚠️ `package.json` points `win.signtoolOptions.sign` at `./build/skip-sign.js`, but `build/` is gitignored and absent from a fresh clone, so `npm run electron:build` fails until that file is restored |
| Design enforcement | **`scripts/design-lint.mjs`** | TAB_UI_CONTRACT is checked mechanically (`npm run lint:design`), not by review alone |
