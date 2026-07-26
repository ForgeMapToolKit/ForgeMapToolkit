# Tech Stack Decisions — ForgeMapToolkit

> Why Electron + React + Vite — a structured reasoning document for contributors.

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
| **Custom Props** | Loads local `.dds` texture files via IPC, applies non-destructive texture adjustments on canvas, bakes and writes modified prop asset files |
| **Prop Texture Editor** | Multi-pass canvas editing pipeline with per-pass history, LCS-based char-level diff, and side-by-side diff viewer |
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

```
library-load / library-scan           — unit/emitter/prop database
scmap-unpack / scmap-pack             — binary .scmap parse + write
scmap-progress                        — real-time unpack progress events
dds-to-dataurl / dds-url-to-dataurl   — DDS → canvas-renderable data URL
generate-prop-files                   — bake texture adjustments to disk
write-file / read-file                — generic file operations
copy-file / ensure-dir                — asset management
list-dir / open-folder                — directory browsing
download-file                         — GitHub asset fetching
settings-load / settings-pick-folder  — user configuration
scmap-snapshot-folder                 — map state diff/history
history-load / history-save           — cross-tab change history
load-faction-icon / get-asset-base-url — static asset serving in file:// context
read-data-file                        — JSON config files (overrides, blacklist)
contrib-load-github-data              — community contributor/asset data from GitHub
```

This is not a thin Electron wrapper around a website. The IPC surface reflects genuine coordination between native file operations, binary processing, and a reactive UI.

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

**Multi-pass texture editor (`PropTextureEditor.jsx`):** Canvas history stack where each pass is a full ImageData snapshot. `useRef` holds the canvas context and current pixel buffer for live brush operations; `useState` holds the committed pass history and is used only for the diff viewer. The boundary between "editing" and "done" is explicit by design.

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
│  ├── scmap.js  (FA binary)    ├── libraries.json cache   │
│  ├── jszip    (SCD archives)  ├── unit_overrides.json    │
│  ├── DDS encode/decode        ├── unit_blacklist.json    │
│  └── sharp    (image ops)     └── settings (userData)    │
│                                                          │
│  IPC handlers — 20+ channels (ipcMain.handle)            │
├──────────────────────────────────────────────────────────┤
│  IPC Bridge                                              │
│  invoke()  →  async response                             │
│  on()      →  progress events (scmap-progress)           │
├──────────────────────────────────────────────────────────┤
│  Electron Renderer Process  (Chromium + React 18)        │
│                                                          │
│  Emitter tabs                    Visual generation       │
│  ├── Wreckage                    ├── Skybox Generator    │
│  ├── Props                       ├── Stars               │
│  ├── Emitter                     └── SCMAP Tool          │
│  ├── Rock Erosion                                        │
│  └── Trees                       Asset / tooling        │
│                                  ├── Custom Props        │
│  Community                       ├── Prop Texture Editor │
│  ├── Contributions               ├── Settings            │
│  └── (GitHub OAuth + assets)     └── History (cross-tab) │
│                                                          │
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
| Binary parsing | **Custom scmap.js** | Ported from BrewMapTool — handles FA's specific binary format for heightmap, DDS blocks, and marker data |
| Skybox format | **JSON (.scmskybox)** | FA's native skybox format; generated directly in the renderer with no binary encoding step |
| Config/overrides | **JSON files** | Human-editable by map authors and contributors, version-controllable, no database overhead |
