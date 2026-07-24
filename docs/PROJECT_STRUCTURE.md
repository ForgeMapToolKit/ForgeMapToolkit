# ForgeMapToolkit — Project Structure

> Regenerated 2026-07-08. The previous version described the pre-rename lowercase
> layout (`src/components/shared/`, `src/components/tabs/`) which no longer exists —
> the whole `src/components` tree was renamed to PascalCase (`Shared/`, `Tabs/`,
> `Core/`, `Modals/`).
>
> **This file rots fast** — it's a snapshot, not a build artifact. If it looks off,
> trust `git ls-files` / a fresh directory listing over this document, and update it
> (or delete it) rather than let it drift again.

```
ForgeMapToolkit
├── build
│   └── skip-sign.js
│
├── data
│   ├── prop_overrides.json
│   ├── unit_blacklist.json
│   └── unit_overrides.json
│
├── docs
│   ├── DESIGN_SYSTEM_MIGRATION.md   ← how to build/migrate a tab onto the shared UI system
│   ├── LAYOUTS.md                   ← the X/Y/Z/W layout-type spec TabLayout implements
│   ├── PROJECT_STRUCTURE.md         ← this file
│   ├── ROADMAP.md                   ← overall project roadmap
│   ├── TAB_CONTRACT.md              ← authoring guide for a new/migrated tab (German)
│   ├── TAB_DESIGN_LAW.md            ← visual design rules (loudness, staircase, lines, color roles)
│   ├── tech_decisions.md            ← why Electron + React + Vite
│   └── UI_PHILOSOPHY.md             ← why the UI looks the way it does
│
├── electron
│   ├── cli.js
│   ├── log-preload.js
│   ├── log-window.html
│   ├── main.js
│   ├── preload.js                   ← IPC channel allowlist (INVOKE_CHANNELS)
│   ├── splash.html
│   └── modules
│       ├── cli-runner.js
│       ├── cli-session-store.js
│       ├── community.js
│       ├── coop-versioner.js
│       ├── editor-bridge.js
│       ├── file-ipc.js              ← withPathGuard-wrapped file handlers
│       ├── footer-content.js
│       ├── guides-downloads.js
│       ├── guides.js
│       ├── logger.js
│       ├── map-resizer.js
│       ├── preview.js
│       ├── props.js
│       ├── scanner.js
│       ├── scmap.js
│       ├── security.js              ← isPathAllowed() / withPathGuard()
│       ├── settings.js
│       └── skybox.js
│
├── public
│   ├── assets
│   │   ├── ACU / factions / help / icons / strategic
│   ├── emitter
│   │   └── Forest_mist / Wind / Wreckage_smoke
│   ├── guides
│   │   └── assets
│   ├── saves
│   ├── scmap
│   └── textures
│
├── src
│   ├── App.js
│   ├── devElectronShim.js
│   ├── index.css
│   ├── index.js
│   ├── main.jsx
│   │
│   └── components
│       ├── Core                            ← app shell, routing, chrome
│       │   ├── ForgeMapToolkit.jsx          ← app root; sets document.documentElement.dataset.theme
│       │   ├── ForgeMapToolkit.css
│       │   ├── sharedState.js
│       │   ├── tabRoutes.jsx                ← render registry: tab id → component
│       │   ├── Banner/
│       │   ├── Chrome/
│       │   ├── Footer/
│       │   ├── Home/
│       │   │   └── Data/toolRegistry.js     ← nav registry: tab id, label, color var, description
│       │   └── Navbar/
│       │
│       ├── Modals
│       │   └── root.css
│       │
│       ├── Shared                          ← everything reusable across tabs
│       │   ├── shared.css
│       │   ├── trace.css                   ← easings/keyframes, .trace-subsection, .trace-tab palette
│       │   ├── index.css
│       │   ├── DesignSystem/
│       │   │   ├── tokens.css              ← spacing/type/ink/line/radius/shadow + §11 per-tab accent registry
│       │   │   ├── tokens-light.css        ← light-mode override layer
│       │   │   ├── primitives.css          ← ctrl-* control family, commit-button, station
│       │   │   ├── layout.css              ← classes TabLayout renders into
│       │   │   └── index.css
│       │   ├── Libraries/
│       │   │   ├── EmitterLibrary/
│       │   │   ├── PropsLibrary/
│       │   │   ├── SkyboxLibrary/
│       │   │   └── UnitLibrary/
│       │   ├── MapLogic/                   ← hooks + IO, no CSS
│       │   │   ├── index.js                ← usePersistentState, useMapInfo, useScmapPreview, scmapIO, mapGeometry, mapCanvas, imageChannels
│       │   ├── Ocean/                      ← FFT ocean simulator (no DOM/React — runs in a worker)
│       │   │   ├── fft.js                  ← radix-2 FFT; the inverse is unnormalised on purpose
│       │   │   ├── random.js               ← seeded xorshift128+ / Gaussian
│       │   │   ├── spectrum.js             ← Phillips / PM / JONSWAP / TMA + dispersion + spreading
│       │   │   ├── ocean.js                ← h̃₀, time evolution, the four packed inverse transforms
│       │   │   ├── bake.js                 ← Jacobian normals, det(J) foam, Lagrangian→Eulerian scatter, mips
│       │   │   └── faWater.js              ← water2.fx contract: slots, bands, ×4 sum compensation, threshold solver
│       │   └── Ui/
│       │       ├── EntityPanel/            ← EntityPanel.jsx (EntityCard, CoordinateList, OutputChecklist, MapPreview, EmitterToggleBlock, …)
│       │       ├── HelpPanel/              ← HelpPanel.jsx + Sections/ (Workflow, Media, Troubleshoot, Shortcuts, Code)
│       │       ├── Notifications/          ← notifications.js (luxuryAlert, luxuryConfirm)
│       │       └── TabLayout/              ← TabLayout.jsx — the X/Y/Z/W shell (see LAYOUTS.md)
│       │
│       └── Tabs
│           ├── Placement                   ← gold standard, fully on the shared UI system
│           │   ├── Wreckage/
│           │   ├── Props/
│           │   └── Emitter/
│           │
│           ├── Scenery                     ← not yet fully migrated
│           │   ├── CustomProps/
│           │   │   └── TextureEditor/
│           │   ├── RockErosion/
│           │   ├── Trees/
│           │   └── WaveNormals/            ← built on the shared UI system (Layout X · half)
│           │       ├── bakeWorker.js       ← runs Shared/Ocean off the renderer thread
│           │       ├── useBake.js          ← worker lifecycle + layer results
│           │       └── renderPreview.js    ← CPU composite using the exact shader reconstruction
│           │
│           ├── Skybox                      ← not yet fully migrated
│           │   ├── SkyboxGenerator/
│           │   └── Stars/
│           │
│           ├── Tools                       ← not yet fully migrated
│           │   ├── AdaptiveMapHelper/
│           │   ├── CliTerminal/            ← new; not a WorkspaceConsole-style tab
│           │   ├── History/
│           │   ├── MapResizer/
│           │   ├── PreviewImage/
│           │   └── Scmap/
│           │       └── PopOut/
│           │
│           ├── CoOp/                       ← not yet fully migrated
│           ├── Community/
│           │   └── Contributions/          ← not yet fully migrated
│           ├── Config/
│           │   └── Settings/               ← exempt from TabLayout (own shell, see LAYOUTS.md)
│           ├── Guides/                     ← not yet fully migrated
│           └── HelpModals/                 ← legacy per-tab help modals; still the live source
│                                              for Props/Emitter (see TAB_CONTRACT.md §7);
│                                              other tabs migrate off this over time
│
├── utils
│   ├── autosave-runner.js
│   ├── CliSessionStore.js
│   ├── generate-csp-hashes.js
│   ├── readmeGenerator.js
│   ├── scmap.js
│   └── ScmapHistoryTracker.js
│
├── package.json
├── package-lock.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Notes

- **"Migrated" here means "on the shared UI system"** (`TabLayout` + `EntityPanel` +
  the `Shared/DesignSystem` tokens/primitives), per `DESIGN_SYSTEM_MIGRATION.md`.
  Only `Tabs/Placement/{Wreckage,Props,Emitter}` are verified fully compliant as of
  2026-07-08 — everything else may be partially migrated or still legacy. Don't
  treat unlisted tabs as reference implementations.
- **Naming convention**: folders and `.jsx`/`.css` component files are PascalCase;
  `.js` utilities/hooks/data files are camelCase; standalone CSS without a component
  (`shared.css`, `trace.css`) is lowercase.
- Section files inside a migrated tab folder carry no tab prefix
  (`Configuration.jsx`, not `WreckageConfiguration.jsx`) — see `TAB_CONTRACT.md §1`.
