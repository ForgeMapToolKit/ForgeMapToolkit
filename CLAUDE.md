# ForgeMapToolkit

Electron + React + Vite desktop tool for **Supreme Commander: Forged Alliance** map
authoring. Not a file manager: it parses FA's binary `.scmap` format, runs Poisson disk
sampling and FFT ocean simulation, composites textures through a WebGL node graph, and
talks to GitHub for community assets.

Renderer = React UI. Main process = all filesystem, binary and network work, reached over
124 IPC channels.


## Claude-Code-Referenz (bei Fragen zu Claude Code selbst)

Bevor du zu Claude-Code-Features (Skills, Hooks, Subagents, Commands, Context-Management, Settings)
aus allgemeinem Wissen antwortest, prüfe zuerst diese Dateien in
D:\Repos\claude-code-best-practice

1. best-practice/claude-skills.md — Skill-Aufbau, inkl. "Skills for Mono-repos"-Report
   (relevant für FMT: großer Codebase, viele Tabs/Editoren)
2. best-practice/claude-hooks.md — Hook-Setup (PreToolUse etc.), inkl. bekannter Windows/PowerShell-Fallstricke
3. best-practice/claude-subagents.md — wann Subagents statt einem großen Kontext sinnvoll sind
4. best-practice/claude-memory.md — CLAUDE.md-Konventionen, Rules-Ordner, Auto-Memory
5. best-practice/claude-mcp.md — MCP-Server-Einrichtung (z.B. für graphify-MCP)
6. tips/ — kuratierte Tipps von Boris Cherny (Claude-Code-Creator) zu Planning, Debugging, Git/PR-Workflow

Bei Windows-spezifischen Problemen (PowerShell-Parser-Limits, Pfad-Fehler etc.) zuerst
best-practice/claude-hooks.md und die dortigen Windows-Hinweise checken.

Nutze diese Dateien als primäre Quelle, nicht als einzige — bei Widersprüchen zur offiziellen
Doku (code.claude.com/docs) hat die offizielle Doku Vorrang.


## Commands

```bash
npm run electron:dev      # dev: vite + electron, HMR
npm run build             # vite build → dist/  (runs prebuild: CSP hashes)
npm run lint              # eslint
npm run lint:design       # enforces docs/TAB_UI_CONTRACT.md — see below
```

`npm run lint:design <TabName>` filters to one tab. It exits 1 on ORPHAN or FOREIGN
findings; BOXED and LITERAL are reported but non-fatal.

> The repo currently has **104 pre-existing ESLint errors** (undefined vars in three help
> modals, regex escapes). `npm run lint` is not green and was not green before. Don't
> treat a red run as something you caused — compare against the baseline.

## Read before writing code

Documentation lives in [`docs/`](docs/README.md) — seven documents, each owning one
question. `docs/README.md` is the index. The short version:

| Task | Read first |
|---|---|
| build or migrate a tab | `docs/TAB_CONTRACT.md`, then `docs/TAB_UI_CONTRACT.md` |
| any visual/CSS decision | `docs/TAB_UI_CONTRACT.md` (binding) |
| a case the rules don't cover | `docs/UI_PHILOSOPHY.md` |
| layout shell / `TabLayout` props | `docs/LAYOUTS.md` |
| add or change an IPC channel | `docs/IPC.md` + `TAB_CONTRACT.md §8` |
| find a file, or check if code is dead | `docs/PROJECT_STRUCTURE.md` |

**No plans or roadmaps in `docs/`.** They rot and get deleted. Status belongs in git.

## Non-negotiable conventions

- **Styling goes through tokens.** No hex, no magic px in tab CSS. Tab accent is always
  `var(--tab-color)`, mapped from the registry in
  `src/components/shared/DesignSystem/tokens.css` §11. Light mode exists and collapses
  per-tab hues — never reference a specific tab's hue variable directly.
- **`src/components/tabs/` mirrors the in-app category structure.** The folders
  (`Emitter`, `Scenery`, `Skybox`, `Textures`, `MapTools`, `System`, `Community`) are the
  categories from `core/home/data/toolRegistry.js`. Moving a tool between categories means
  moving its folder too.
- **Adding a tab touches exactly three places**, and the `id` must match in all three:
  `tokens.css` §11 (accent block), `core/home/data/toolRegistry.js` (nav metadata),
  `core/tabRoutes.jsx` (render wiring).
- **A new IPC channel needs three things**, not one: the handler, a `withPathGuard` wrapper
  if it takes a path, and an entry in `INVOKE_CHANNELS` in `electron/preload.js`. Missing
  the allowlist entry fails *silently* at most call sites — this has already happened twice
  (see `docs/IPC.md` → Known defects).
- **Logic comes from `shared/MapLogic`** — `usePersistentState`, `useMapInfo`,
  `useScmapPreview`, `scmapIO`, `mapGeometry`. Don't re-implement map-info reading, preview
  loading, or scmap IO inside a tab.

## Traps in this repo

- **Directory case does not match import case.** On disk the component folders are
  lowercase (`src/components/shared/`, `.../tabs/`); every import writes them PascalCase
  (`Shared/`, `Tabs/`). This resolves only because Windows/macOS are case-insensitive and
  `core.ignorecase` is true. Follow the existing convention — use PascalCase in imports —
  and see `docs/PROJECT_STRUCTURE.md` for the full picture. A case-sensitive build breaks.
- **Route ids are not labels and must not be "corrected".** `node-editor` is the Texture
  Editor's route id, its token prefix and its IPC prefix; it is also a persisted value in
  user settings. Same for `treemap` (label *TreeMap*, folder `Trees`).
- **Dead code that still looks live:** `src/components/tabs/CoOp/` (broken imports, not
  routed), `electron/modules/footer-content.js` (its register function is never called),
  `tabs/HelpModals/Wreckage_help.jsx` (superseded by `Wreckage/Help.jsx`). Check
  `tabRoutes.jsx` before assuming a tab is live.
- **`build/` is gitignored but referenced** by `package.json`
  (`win.signtoolOptions.sign`), so `npm run electron:build` fails on a fresh clone.
- **Two help systems coexist.** `shared/Ui/HelpPanel` is the target (4 tabs); 13 tabs still
  use the legacy `tabs/HelpModals/*_help.jsx`. New work uses `HelpPanel`.

## Writing docs in this repo

Concrete claims — paths, counts, prop defaults — must be verifiable from the repo. State
at the top of a document when it was last checked and against what. Rule-bearing documents
keep a changelog; a rule change without an entry is a bug.
