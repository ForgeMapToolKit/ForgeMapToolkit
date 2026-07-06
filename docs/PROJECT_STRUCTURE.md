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
│   ├── DESIGN_SYSTEM_MIGRATION.md
│   ├── ROADMAP.md
│   ├── structure.md
│   ├── TAB_CONTRACT.md
│   └── tech_decisions.md
│
├── electron
│   ├── log-preload.js
│   ├── log-window.html
│   ├── main.js
│   ├── preload.js
│   ├── splash.html
│   └── modules
│       ├── community.js
│       ├── coop-versioner.js
│       ├── file-ipc.js
│       ├── guides-downloads.js
│       ├── guides.js
│       ├── logger.js
│       ├── map-resizer.js
│       ├── preview.js
│       ├── props.js
│       ├── scanner.js
│       ├── scmap.js
│       ├── security.js
│       ├── settings.js
│       └── skybox.js
│
├── public
│   ├── assets
│   │   ├── ACU
│   │   ├── factions
│   │   ├── help
│   │   ├── icons
│   │   │   ├── App
│   │   │   └── Library
│   │   └── strategic
│   │
│   ├── emitter
│   │   ├── Forest_mist
│   │   ├── Wind
│   │   └── Wreckage_smoke
│   │
│   ├── guides
│   │   └── assets
│   │       └── water
│   │
│   ├── props
│   │   └── DeadTree_01
│   │
│   ├── saves
│   ├── scmap
│   │
│   ├── skyboxes
│   │   └── community
│   │       └── world
│   │
│   └── textures
│
├── src
│   ├── App.js
│   ├── index.css
│   ├── index.js
│   ├── main.jsx
│   │
│   └── components
│       ├── core
│       │   ├── ForgeMapToolkit.css
│       │   ├── ForgeMapToolkit.jsx
│       │   ├── sharedState.js
│       │   ├── tabRoutes.jsx
│       │   ├── banner
│       │   ├── chrome
│       │   ├── home
│       │   └── navbar
│       │
│       ├── modals
│       │   ├── notifications.js
│       │   └── root.css
│       │
│       ├── shared
│       │   ├── design-system
│       │   ├── entity-console
│       │   ├── help-console
│       │   ├── map-logic
│       │   └── WorkspaceConsole
│       │
│       └── tabs
│           ├── Co-Op
│           │   └── CoopVersionerTab
│           │
│           ├── Community
│           │   └── ContributionsTab
│           │
│           ├── Config
│           │   └── SettingsTab
│           │
│           ├── Emitter
│           │   ├── EmitterTab
│           │   ├── PropsTab
│           │   └── WreckageTab
│           │
│           ├── Generator
│           │   ├── CustomPropsTab
│           │   ├── RockErosionTab
│           │   └── TreesTab
│           │
│           ├── Guides
│           │   └── GuideSection
│           │
│           ├── HelpModals
│           │
│           ├── Libraries
│           │   ├── EmitterLibrary
│           │   ├── PropsLibrary
│           │   ├── SkyboxLibrary
│           │   └── UnitLibrary
│           │
│           ├── Skybox
│           │   ├── SkyboxGeneratorTab
│           │   └── StarsTab
│           │
│           └── Tools
│               ├── AdaptiveMapHelperTab
│               ├── HistoryTab
│               ├── MapResizerTab
│               ├── PreviewImageTab
│               └── ScmapTab
│
├── utils
│   ├── autosave-runner.js
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
