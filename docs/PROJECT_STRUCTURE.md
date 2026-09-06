# ForgeMapToolkit — Project Structure

> **Regenerated 2026-07-26 from `git ls-files`.** Every path below was read out of the
> index, not from memory.
>
> *Amended 2026-09-06 for the Map Rotator: `tabs/MapTools/MapRotator/`,
> `electron/modules/map-rotator.js`. Hand-added, not regenerated.*
>
> *Amended 2026-07-26 for the 3D Viewer: `shared/Scene3D/`, `tabs/Textures/Viewer3D/`,
> `electron/modules/{gamefiles,mesh}.js`. Those four are hand-added, not regenerated.*
>
> **This file rots fast** — it's a snapshot, not a build artifact. If it looks off,
> trust `git ls-files` over this document, and update it rather than let it drift.

---

## ⚠️ Known inconsistency: directory case vs. import case

On disk (and in git) the four top-level component folders are **lowercase**:

```
src/components/core   src/components/modals   src/components/shared   src/components/tabs
```

Every import in the codebase, however, writes them **PascalCase** — 156 occurrences of
`/Shared/`, plus `../Tabs/…` in `core/tabRoutes.jsx`:

```js
import TabLayout from '../../../Shared/Ui/TabLayout/TabLayout.jsx';   // resolves to shared/
```

This only works because Windows and macOS have case-insensitive filesystems and
`git config core.ignorecase` is `true`. **On a case-sensitive filesystem (Linux CI, a
Docker build) every one of these imports fails to resolve.** An earlier doc revision
claimed the PascalCase rename had landed — it had not; only the import strings were
changed, the `git mv` silently no-opped.

It has already drifted *within* the codebase: `core/home/data/toolRegistry.js` is
imported four different times as `../home/data/…` and three times as `../Home/Data/…`.
Same file, two spellings, both resolving today.

Two ways out, both fine, but pick one:
- rename the directories for real (`git mv src/components/shared src/components/Shared_tmp && git mv … Shared`), or
- rewrite the 156 import paths back to lowercase.

Until then: **directories are lowercase, imports are PascalCase.** The tree below shows
the on-disk truth.

---

## Tree

```
ForgeMapToolkit
├── data                                  ← JSON overrides shipped with the app
│   ├── prop_overrides.json
│   ├── unit_blacklist.json
│   └── unit_overrides.json
│
├── CLAUDE.md                             ← agent orientation; points into docs/, no rules of its own
│
├── docs                                  ← seven permanent documents + an index. No plans.
│   ├── README.md                         ← the index: which doc answers which question
│   ├── TAB_CONTRACT.md                   ← how a tab is built, non-visual half (German)
│   ├── TAB_UI_CONTRACT.md                ← how a tab may look, visual half (the pair)
│   ├── UI_PHILOSOPHY.md                  ← why those rules exist; consult for new cases
│   ├── LAYOUTS.md                        ← the X/Y/Z/W layout spec TabLayout implements
│   ├── IPC.md                            ← the renderer↔main boundary, every channel
│   ├── PROJECT_STRUCTURE.md              ← this file
│   └── TECH_DECISIONS.md                 ← why Electron + React + Vite
│
├── electron
│   ├── cli.js                            ← `fmt` bin entry (package.json "bin")
│   ├── main.js
│   ├── preload.js                        ← IPC allowlist (INVOKE_CHANNELS)
│   ├── log-preload.js  log-window.html  splash.html
│   └── modules                           ← 122 ipcMain.handle channels across 26 modules
│       ├── security.js                   ← isPathAllowed() / withPathGuard()
│       ├── file-ipc.js                   ← withPathGuard-wrapped generic file handlers
│       ├── scmap.js                      ← .scmap pack/unpack/patch/read
│       ├── dds.js  dds-decode.js         ← DDS encode / decode
│       ├── node-editor.js                ← .fmtgraph projects, texture assets
│       ├── gamefiles.js                  ← resolveGameFile(): map folder → loose → .scd archives.
│       │                                    The one new callers should use; file-ipc.js and
│       │                                    node-editor.js still carry their own ZIP caches.
│       ├── mesh.js                       ← .scm (MODL) parser + blueprint reader for the 3D Viewer.
│       │                                    Also boneClusters(): splits a mesh into the objects it
│       │                                    holds via the per-vertex bone index (Floating Trees).
│       ├── floating-props.js             ← Floating Trees: measures every prop object's base
│       │                                    against the terrain under *that object*, so a tree
│       │                                    group snapped by its origin is caught over a cliff.
│       │                                    Geometry only — the verdict is renderer-side.
│       ├── terraintype.js                ← terraintype write-back into .scmap
│       ├── symmetry.js                   ← Symmetry Checker: one read of every mirrored layer
│       │                                    out of a packed .scmap + _save.lua. Carries its own
│       │                                    save.lua parser (STRING/VECTOR3/GROUP calls, which
│       │                                    utils/scmap.js's parseLuaDataFile throws on).
│       ├── biome.js                      ← Biome Changer: reads a map's look from a packed
│       │                                    .scmap, applies a look-only patch to an unpacked
│       │                                    folder. Whitelists exclude geometry by design.
│       ├── texture-scanner.js  scanner.js
│       ├── skybox.js  props.js  preview.js  map-resizer.js
│       ├── map-rotator.js                ← Map Rotator: turns an unpacked map about its
│       │                                    centre. Rasters by index on a quarter turn,
│       │                                    bilinear otherwise; DXT textures rotated as
│       │                                    blocks (never by byte — DXT5 is 1 byte/px and
│       │                                    looks uncompressed by size alone); prop
│       │                                    orientation as three rotated basis vectors.
│       ├── community.js  guides.js  guides-downloads.js  footer-content.js
│       ├── coop-versioner.js  editor-bridge.js
│       ├── cli-runner.js  cli-session-store.js
│       ├── settings.js  logger.js
│
├── scripts
│   └── design-lint.mjs                   ← mechanical enforcement of TAB_UI_CONTRACT
│                                            (`npm run lint:design`)
├── utils                                 ← Node-side helpers, not renderer code
│   ├── scmap.js                          ← the FA binary parser (~1165 lines)
│   ├── ScmapHistoryTracker.js  CliSessionStore.js
│   ├── autosave-runner.js  readmeGenerator.js
│   ├── generate-csp-hashes.js            ← runs on `prebuild`
│   └── generate-terraintypes.js
│
├── public                                ← static assets (not tracked in detail here)
│   ├── assets/{ACU,factions,help,icons,strategic}
│   ├── emitter/{Forest_mist,Wind,Wreckage_smoke}
│   ├── guides/assets   saves   scmap   textures
│
├── _backup                               ← frozen copies of the four Libraries; not built,
│                                            not imported. Delete when no longer needed.
│
├── src
│   ├── main.jsx  App.js  index.js  index.css  devElectronShim.js
│   │
│   └── components
│       ├── core                          ← app shell, routing, chrome
│       │   ├── ForgeMapToolkit.jsx        ← app root; sets documentElement.dataset.theme
│       │   ├── ForgeMapToolkit.css
│       │   ├── sharedState.js
│       │   ├── tabRoutes.jsx              ← render registry: tab id → component
│       │   ├── Footer/                    ← ArticlePreview, ArticleTab, ContentViewer,
│       │   │                                 FafLogo, Nav, content/*.html, hooks/
│       │   ├── Navbar/                    ← NavbarPanel, Register, SlatRow,
│       │   │   └── Atmosphere/              Three.js haze layer behind the navbar
│       │   ├── banner/                    ← Banner.jsx/.css
│       │   ├── chrome/                    ← FirstRunModal, ScanProgressBanner, UpdateModal
│       │   └── home/
│       │       ├── HomeScreen.jsx/.css
│       │       ├── atmosphere/            ← Three.js volumetric backdrop (homepage only)
│       │       ├── components/            ← HeaderRegister, ProjectionStage, ToolRail,
│       │       │                             ToolSlat, TraceLine
│       │       └── data/toolRegistry.js   ← nav registry: id, label, color, colorVar, description
│       │
│       ├── modals
│       │   └── root.css
│       │
│       ├── shared                         ← everything reusable across tabs
│       │   ├── shared.css  trace.css  index.css
│       │   ├── DesignSystem/
│       │   │   ├── tokens.css             ← spacing/type/ink/line/radius/shadow
│       │   │   │                             + §11 PER-TAB ACCENT REGISTRY + §12 compat bridge
│       │   │   ├── tokens-light.css       ← light-mode override layer
│       │   │   ├── primitives.css         ← ctrl-* control family, commit-button, station
│       │   │   ├── ContentPrimitives.css
│       │   │   ├── layout.css             ← the classes TabLayout renders into (X/Y/Z/W)
│       │   │   └── index.css
│       │   ├── Libraries/{EmitterLibrary,PropsLibrary,SkyboxLibrary,UnitLibrary}/
│       │   ├── MapLogic/                  ← hooks + IO, no CSS
│       │   │   ├── index.js               ← the public surface (see TAB_CONTRACT §2)
│       │   │   ├── usePersistentState.js  useMapInfo.js  useScmapPreview.js
│       │   │   ├── scmapIO.js  mapGeometry.js  mapCanvas.js  imageChannels.js
│       │   │   ├── terrainSampler.js  terrainTypeLogic.js
│       │   │   ├── symmetryLogic.js      ← mirror modes, grid/entity comparison, report
│       │   │   ├── floatingPropsLogic.js ← floating/buried verdict, hotspot clustering, report
│       │   │   └── biomeLogic.js         ← roles, preset coverage, texture/prop plans, capture
│       │   ├── Ocean/                     ← FFT ocean simulator (no DOM/React — runs in a worker)
│       │   │   ├── fft.js                 ← radix-2 FFT; the inverse is unnormalised on purpose
│       │   │   ├── random.js              ← seeded xorshift128+ / Gaussian
│       │   │   ├── spectrum.js            ← Phillips / PM / JONSWAP / TMA + dispersion + spreading
│       │   │   ├── ocean.js               ← h̃₀, time evolution, four packed inverse transforms
│       │   │   ├── bake.js                ← Jacobian normals, det(J) foam, Lagrangian→Eulerian, mips
│       │   │   └── faWater.js             ← water2.fx contract: slots, bands, ×4 sum compensation
│       │   ├── Scene3D/                   ← the shared 3D layer (three.js, raw — no R3F)
│       │   │   ├── engine.js              ← renderer, two mesh slots, render-on-demand, dispose
│       │   │   ├── orbit.js               ← hand-rolled orbit camera (avoids three/examples)
│       │   │   ├── grid.js                ← ogrid floor, step scales to the subject
│       │   │   └── Scene3D.jsx + .css     ← mount / ResizeObserver / teardown only
│       │   └── Ui/
│       │       ├── TabLayout/TabLayout.jsx  ← the X/Y/Z/W shell. No CSS file of its own —
│       │       │                               its styles live in DesignSystem/layout.css.
│       │       │                               StandbyField is defined *inside* this file.
│       │       ├── EntityPanel/            ← EntityCard, EntityCardGrid, AddTile, CoordinateList,
│       │       │                              OutputChecklist, MapPreview, Dropdown, MirrorDropdown,
│       │       │                              EmitterToggleBlock, ToggleSwitch, DropSlot, useFileDrop
│       │       ├── HelpPanel/              ← HelpConsole + HelpButton + Sections/
│       │       │                              (Workflow, Media, Troubleshoot, Shortcuts, Code)
│       │       ├── ColorPicker/            ← ColorPicker.jsx + colorMath.js
│       │       └── Notifications/          ← notifications.js (luxuryAlert, luxuryConfirm)
│       │
│       └── tabs                            ← one folder per in-app category, see note below
│           ├── Emitter/                    ← category `emitter` · nav "Emitter"
│           │   ├── Wreckage/  Props/  Emitter/   ← the original reference implementations
│           │   └── TerrainType/
│           ├── Scenery/                    ← category `generator` · nav "Scenery"
│           │   ├── CustomProps/                  ← + TextureEditor/ (multi-pass canvas editor;
│           │   │                                    a sub-component, not the Texture Editor tab)
│           │   └── RockErosion/  Trees/
│           ├── Skybox/                     ← category `skybox`
│           │   └── SkyboxGenerator/  Stars/
│           ├── Textures/                   ← category `textures`
│           │   ├── TextureEditor/                ← route id stays `node-editor`. engine/ (graph,
│           │   │                                    evaluator, glContext, 38 nodes/) + ui/
│           │   ├── WaveNormals/                  ← bakeWorker.js runs shared/Ocean off-thread;
│           │   │                                    useBake.js worker lifecycle; renderPreview.js
│           │   └── Viewer3D/                     ← route id `viewer3d`. Own shell (canvas tab).
│           │                                        load.js = bp→mesh→texture; mode switch is
│           │                                        Props today, Waves/Sky later on Shared/Scene3D
│           ├── MapTools/                   ← category `maptools` · nav "Map Tools"
│           │   ├── Scmap/ (+ PopOut/)  AdaptiveMapHelper/  MapResizer/  PreviewImage/
│           │   ├── MapRotator/                  ← route id `maprotator`. angles.js holds the
│           │   │                                    angle maths; RotationDial.jsx draws the turn
│           │   ├── BiomeChanger/                ← biomePresets.js is the data file to fill;
│           │   │                                    all decisions in Shared/MapLogic/biomeLogic.js
│           │   ├── SymmetryChecker/             ← read-only. All maths in
│           │   │                                    Shared/MapLogic/symmetryLogic.js
│           │   └── FloatingTrees/               ← read-only. Verdict in
│           │                                        Shared/MapLogic/floatingPropsLogic.js;
│           │                                        severity.js is shared by sections 02/03
│           ├── System/                     ← category `system`
│           │   ├── History/
│           │   ├── CliTerminal/                  ← not on TabLayout (own shell)
│           │   └── Settings/                     ← not on TabLayout (own shell)
│           ├── Community/                  ← category `community`
│           │   ├── Contributions/
│           │   └── Guides/                       ← GuideSection v2, not wired into tabRoutes yet
│           │                                        (the `guides` route renders a placeholder)
│           ├── HelpModals/                 ← not a category — legacy per-tab help modals,
│           │                                  13 files, still the live help for 13 tabs
│           │                                  (TAB_CONTRACT §7)
│           └── CoOp/                       ← DEAD CODE, see note below
│
├── package.json  package-lock.json
├── vite.config.js  tailwind.config.js  postcss.config.js  eslint.config.js
├── index.html  index_standalone.html
└── .claude/
```

Not in the tree because they are gitignored build/runtime output: `dist/`,
`node_modules/`, `logs/`.

> ⚠️ `build/` is gitignored **and** referenced by `package.json`
> (`win.signtoolOptions.sign: "./build/skip-sign.js"`). It does not exist in the working
> tree right now, so `npm run electron:build` fails on a fresh clone until that file is
> restored. Either commit `build/skip-sign.js` or drop the `signtoolOptions` block.

---

## Notes

### `tabs/` mirrors the in-app category structure

**This is a rule, not a coincidence.** Every folder directly under `src/components/tabs/`
is one of the categories in `core/home/data/toolRegistry.js` (`CATEGORIES`), named after
its `navLabel` with spaces removed:

| Folder | `key` | nav label |
|---|---|---|
| `Emitter/` | `emitter` | Emitter |
| `Scenery/` | `generator` | Scenery |
| `Skybox/` | `skybox` | Skybox |
| `Textures/` | `textures` | Textures |
| `MapTools/` | `maptools` | Map Tools |
| `System/` | `system` | System |
| `Community/` | `community` | Community |

Plus two folders that are not categories: `HelpModals/` (support code) and `CoOp/` (dead).

**Moving a tool between categories in `toolRegistry.js` means moving its folder too.**
Otherwise the two drift apart — which is exactly what had happened before 2026-07-26:
the Texture Editor lived under `Skybox/` as `NodeEditor/`, Wave Normals under `Scenery/`,
Terrain Type under `Scenery/`, and a residual `Tools/` folder held both map tools and
system tools.

Two things deliberately did **not** change in that realignment:

- **The route id `node-editor` stays.** It is the key in `tabRoutes.jsx` *and* the saved
  start-tab value in user settings, so renaming it would silently break both. The token
  (`--node-editor-color`), the CSS class (`.node-editor-tab`) and the IPC channel prefix
  (`node-editor-*`) follow the id, not the label. Only the folder, the two filenames and
  the React component identifier became `TextureEditor`.
- **`Scenery/Trees/` keeps its folder name** although the tool is labelled *TreeMap*
  (id `treemap`). It is in the right category; only the name differs. Renaming it is a
  separate, optional cleanup.

### Which tabs are live

`core/tabRoutes.jsx` is the authority. 22 routes are wired:

`wreckages · props · customprops · treemap · rockerosion · wavenormals · terraintype ·
emitter · stars · skybox-generator · node-editor · viewer3d · scmaptool ·
adaptivemaphelper · history · mapresizer · previewimage · biomechanger ·
symmetrychecker · cliterminal · contributions · settings`

plus `guides` (renders a placeholder component, not `Community/Guides/GuideSection.jsx`) and
`footer:<slug>` (routed to a single shared `FooterArticleTab`).

**`tabs/CoOp/` is dead code.** It is not imported by `tabRoutes.jsx`, and it would not
build if it were: `CoOp.jsx` imports `./CoopVersioner.css` (the file is `CoOp.css`) and
`../../HelpModals/CoopVersioner_help.jsx` (that file does not exist anywhere in the
repo). The tab-color tokens `--coop-versioner-*` are defined in `tokens.css` and used by
nothing. Either fix the two imports and wire the route, or delete the folder — right now
it is neither.

### "On the shared UI system" — the actual state

16 of the 21 tab components render `Shared/Ui/TabLayout`. The five that do not:

| Tab | Why |
|---|---|
| `System/Settings` | deliberate — self-contained settings shell, exempt (see LAYOUTS.md) |
| `System/CliTerminal` | deliberate — terminal surface, own shell |
| `Textures/TextureEditor` | deliberate — full-bleed graph canvas (TAB_UI_CONTRACT §11) |
| `Textures/Viewer3D` | deliberate — full-bleed 3D viewport (TAB_UI_CONTRACT §12) |
| `Guides` | not wired into routing yet |
| `CoOp` | dead code (above) |

Being *on* `TabLayout` is not the same as being *compliant* with `TAB_UI_CONTRACT` —
`npm run lint:design` is the measure of that, and TAB_UI_CONTRACT carries the current
numbers.

### Naming convention

- Folders and `.jsx`/`.css` component files are PascalCase — **except** the four
  top-level component folders and `core/{banner,chrome,home}`, which are lowercase on
  disk (see the warning at the top).
- `.js` utilities/hooks/data files are camelCase.
- Standalone CSS with no component (`shared.css`, `trace.css`, `layout.css`) is lowercase.
- Section files inside a tab folder carry no tab prefix (`Configuration.jsx`, not
  `WreckageConfiguration.jsx`) — see `TAB_CONTRACT.md §1`.

### Where the two registries live

Adding a tab touches exactly three places (TAB_CONTRACT §5):

1. `shared/DesignSystem/tokens.css` §11 — one accent block (`--<id>-color/-glow/-glow-strong`)
2. `core/home/data/toolRegistry.js` — nav metadata (id, label, color, colorVar, description)
3. `core/tabRoutes.jsx` — render wiring

The `id` must be identical in all three.
