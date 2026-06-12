# Project Structure — ForgeMapToolkit

> Folder and file overview. Excludes `node_modules/`, `dist/`, and `.git/`.

---

```
ForgeMapToolkit/
│
├── index.html                        # Vite entry point
├── package.json
├── package-lock.json
├── vite.config.js
├── postcss.config.js
├── tailwind.config.js
├── Tech_Decisions.md                 # Stack decision reasoning
│
├── electron/
│   └── main.js                       # Electron main process — all IPC handlers, file I/O, binary parsing, library scanning
│
├── utils/
│   ├── scmap.js                      # Binary .scmap parser/writer (ported from BrewMapTool)
│   └── ScmapHistoryTracker.js        # Cross-tab snapshot & history logic
│
├── data/                             # User-editable JSON config files
│   ├── unit_overrides.json           # Sort order + group overrides for unit library
│   ├── unit_blacklist.json           # Unit IDs to hide from the library
│   └── prop_overrides.json           # Albedo overrides and no-preview list for props
│
├── public/                           # Static assets — served as-is by Vite / Electron
│   ├── scmap-popout.html
│   │
│   ├── assets/
│   │   ├── factions/                 # Faction SVG logos (aeon, cybran, uef, seraphim, nomads)
│   │   ├── strategic/                # Strategic icons per faction × unit type (~400 PNGs)
│   │   │                             # Format: <Faction>_icon_<type><tier>_<role>.png
│   │   ├── icons/
│   │   │   ├── App/                  # App icon (icon.ico, icon.png)
│   │   │   └── Library/              # UI icons (energy.png, mass.png, time.js)
│   │   └── help/                     # Help overlay screenshots (H1-H3, P1-P3, R1-R3)
│   │
│   ├── emitter/                      # Globally saved Emitter blueprints (.bp)
│   │   ├── Forest_mist/
│   │   ├── Smoke/
│   │   └── Wreckage_smoke/
│   │
│   ├── scmap/                        # Unpacked map working directories
│   │   ├── <MapName>.scmap/          # One folder per unpacked map, contains:
│   │   │   ├── data.lua              #   Map metadata
│   │   │   ├── heightmap.raw         #   Terrain heightmap
│   │   │   ├── normalMap.dds         #   Surface normal map
│   │   │   ├── previewImage.dds      #   Minimap thumbnail
│   │   │   ├── textureMaskHigh.dds   #   Stratum texture blend (high)
│   │   │   ├── textureMaskLow.dds    #   Stratum texture blend (low)
│   │   │   ├── waterMap.dds          #   Water mask
│   │   │   ├── terrainType.raw       #   Terrain type data
│   │   │   ├── props*.lua            #   Prop placement data (chunked)
│   │   │   ├── decals*.lua           #   Decal placement data
│   │   │   └── waveGenerators*.lua   #   Water wave generator data
│   │   └── packed/                   # Repacked .scmap output files
│   │
│   ├── skyboxes/                     # Downloaded .scmskybox files
│   ├── textures/                     # Downloaded prop texture outputs
│   └── props/                        # Globally saved Props
│
└── src/                              # React application source
    ├── index.js
    ├── index.css
    ├── main.jsx
    ├── App.js
    │
    └── components/
        │
        ├── core/
        │   ├── ForgeMapToolkit.jsx   # Root layout, tab routing, shared state
        │   └── ForgeMapToolkit.css
        │
        ├── shared/                   # Reusable UI primitives
        │   ├── CustomLine.jsx
        │   ├── shared.css
        │   └── index.css
        │
        ├── modals/
        │   ├── notifications.js
        │   └── root.css
        │
        ├── tabs/
        │   │
        │   ├── Emitter/              # Placement tabs
        │   │   ├── WreckageTab/      # Wreckage.jsx — unit/emitter/prop placement
        │   │   ├── PropsTab/         # Props.jsx — grid + Poisson prop placement
        │   │   └── EmitterTab/       # Emitter.jsx — particle emitter placement
        │   │
        │   ├── Generator/            # Generation tabs
        │   │   ├── RockErosionTab/   # RockErosion.jsx — erosion simulation + rock placement
        │   │   ├── TreesTab/         # Trees.jsx — tree placement visualizer
        │   │   └── CustomPropsTab/   # CustomProps.jsx — prop asset + texture pipeline
        │   │       ├── AddCustomProps/
        │   │       └── TextureAdjustments/
        │   │           └── Editor/   # PropTextureEditor.jsx — multi-pass canvas editor
        │   │
        │   ├── Skybox/               # Skybox tabs
        │   │   ├── SkyboxGeneratorTab/ # SkyboxGenerator.jsx — .scmskybox JSON generator
        │   │   └── StarsTab/           # Stars.jsx — star distribution curve editor
        │   │
        │   ├── Tools/                # Utility tabs
        │   │   ├── ScmapTab/         # Scmap.jsx — binary .scmap unpack/repack
        │   │   └── HistoryTab/       # History.jsx — cross-tab snapshot & LCS diff
        │   │
        │   ├── Libraries/            # Overlay libraries (opened from placement tabs)
        │   │   ├── UnitLibrary/      # UnitLibraryOverlay.jsx — 500+ unit browser
        │   │   ├── EmitterLibrary/   # EmitterLibraryOverlay.jsx
        │   │   ├── PropsLibrary/     # PropsLibraryOverlay.jsx — prop browser with filters
        │   │   └── SkyboxLibrary/    # SkyboxLibraryOverlay.jsx
        │   │
        │   ├── Community/
        │   │   └── ContributionsTab/ # Contributions.jsx — GitHub OAuth, leaderboard,
        │   │                         # community asset browser
        │   └── Config/
        │       └── SettingsTab/      # Settings.jsx — paths, defaults, log level, rescan
        │
        └── (each tab folder contains <Name>.jsx + <Name>.css)
```

