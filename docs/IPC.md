# IPC Contract

The renderer cannot touch the filesystem, the game install, or the network directly.
Everything crosses one boundary: `ipcRenderer.invoke` → `ipcMain.handle`. This document
is the map of that boundary.

> **Measured 2026-07-26** by parsing `electron/modules/*.js`, `electron/preload.js` and
> every `invoke(…)` call in `src/`. Counts and the anomaly list below are extraction
> results, not estimates.
>
> **123 handlers across 25 modules · 100-channel preload allowlist · 88 channels actually
> invoked by the renderer.**
>
> (A raw grep reports 124 / 26 — one hit is a JSDoc usage example in `security.js`, not a
> registration.)
>
> *Updated 2026-07-26 for Floating Trees: `floating-props.js` adds `floatprops-scan`,
> guarded and invoked. The baseline before it was 122 / 24 / 99 / 87.*
>
> *Updated 2026-07-26 for the Symmetry Checker: `symmetry.js` adds `symmetry-read-map`,
> guarded and invoked. The baseline before it was 121 / 23 / 98 / 86.*
>
> *Updated 2026-07-26 for the Biome Changer: `biome.js` adds `biome-read-state` and
> `biome-apply`, both guarded and both invoked. The baseline before it was 119 / 22 / 96 / 84.*
>
> *Updated 2026-07-26 for the 3D Viewer: `mesh.js` adds `viewer3d-load-mesh` and
> `viewer3d-resolve-blueprint`, both allowlisted and both invoked. The baseline before
> it was 117 / 21 / 94 / 82.*

**Related:** `TAB_CONTRACT.md §8` states the security rules a new channel must satisfy.
This document describes what exists.

---

## The three gates

A renderer call passes three checks before any code runs. All three must be satisfied —
adding a handler alone does nothing.

```
  renderer                preload.js                    main process
  ────────                ──────────                    ────────────
  window.electronAPI
    .invoke('write-file') ─┐
                           │  ① INVOKE_CHANNELS.has(channel)?
                           │     no  → throw, call never leaves the renderer
                           │     yes → ipcRenderer.invoke(...)
                           └──────────────────────────────▶ ② ipcMain.handle(channel)
                                                              registered? no → rejects
                                                           ③ withPathGuard wraps it?
                                                              isPathAllowed(resolved)?
                                                              no → rejected + logged
```

**① The preload allowlist.** `electron/preload.js` exposes exactly six methods on
`window.electronAPI` — `invoke`, `send`, `on`, `once`, `removeAllListeners`,
`getPathForFile`. There are no named passthrough methods, so `INVOKE_CHANNELS` is the
*only* gate; a channel missing from that set is unreachable from the renderer no matter
what the main process registers. Two sibling sets govern the other directions:
`SEND_CHANNELS` (1 entry: `set-log-level`) and `LISTEN_CHANNELS` (8 entries).

**② The handler.** Registered at module load — `electron/main.js` requires each module,
some directly (`require('./modules/file-ipc')`), some via an explicit
`.register()` call (`map-resizer`, `biome`, `editor-bridge`, `dds`).

**③ The path guard.** `withPathGuard(pathExtractor, handler)` from
`electron/modules/security.js`. `isPathAllowed()` resolves the target with
`path.resolve()` and requires it to sit under a static root (`userData`, `temp`,
`appPath`) or a dynamic root read live from settings (`mapsFolder`, `faInstallPath`,
`backupFolder`, `emitterBpFolder`, …). **35 of 123 handlers are guarded.** The rest do
not take a caller-supplied path.

---

## Events — main → renderer

Push channels, listened to via `window.electronAPI.on(channel, fn)`. Must be in
`LISTEN_CHANNELS`:

| Channel | Sent from |
|---|---|
| `scmap-progress` | `scmap.js` — live unpack/pack progress (`event.sender.send`) |
| `library-scan-started` / `library-scan-complete` | `main.js`, `settings.js` via `notifyRenderer()` |
| `cli-output` | `cli-runner.js` — `{ type: 'stdout'\|'stderr'\|'info'\|'error', text, ts }` |
| `bridge-state-changed` | `editor-bridge.js` via `broadcast()` — `{ state, loadedMap? }` |
| `settings-updated` | `settings.js` |
| `app-error` | `main.js` |
| `dds-to-dataurl` | listed in `LISTEN_CHANNELS`; also an invoke channel |

Senders use four different helpers (`wc.send`, `event.sender.send`, `notifyRenderer`,
`broadcast`) — grep for the channel name, not for `webContents.send`.

---

## Channels by module

`G` = wrapped in `withPathGuard` · `!` = **not** in the preload allowlist (unreachable
from the renderer).

### Files & generic IO — `file-ipc.js` (23)
```
G  copy-file            G  ensure-dir           G  read-file          G  write-file
G  delete-file          G  list-dir             G  read-map-info
G  download-file        G! read-file-base64     G! read-scenario-size
   backup-file             check-update            load-config           load-image
   civilians-load-presets  civilians-save-presets  open-external
   read-footer-article     read-guide              resolve-prop-to-emit
   save-blueprint          save-config             save-generated-file
```

### Binary `.scmap` — `scmap.js` (14)
```
G  scmap-pack           G  scmap-patch-water    G  scmap-snapshot-folder
G  scmap-pack-folder    G  scmap-read-terrain   G  scmap-unpack
   scmap-list              scmap-select-file       get-asset-base-url
   history-load            history-save            load-faction-icon
   png-to-preview-dds     !read-data-file
```

### Terrain type — `terraintype.js` (3, all guarded)
```
G  resolve-stratum-albedos   G  scmap-read-strata   G  scmap-write-terraintype
```

### Symmetry checker — `symmetry.js` (1, guarded)
```
G  symmetry-read-map
```
Read-only: the tab never writes to a map, so this module has no counterpart writer. The
guard is on `mapFolderPath` — the handler finds the `.scmap` and `_save.lua` inside it
itself rather than taking two paths from the renderer. One call returns every layer that
has to mirror (grids, props, decals, markers, army units); the comparison happens in
`Shared/MapLogic/symmetryLogic.js`, so changing mode or tolerance costs no IPC.

### Floating trees — `floating-props.js` (1, guarded)
```
G  floatprops-scan
```
Read-only, and the same split as the Symmetry Checker: the guard is on `mapFolderPath`,
one call does all the I/O, and the verdict lives renderer-side
(`Shared/MapLogic/floatingPropsLogic.js`) so the tolerance slider costs no IPC.

Unlike `symmetry-read-map` this handler also reaches *outside* the map folder — it resolves
every distinct prop blueprint and its LOD0 mesh through `gamefiles.js`, which reads the
install's `.scd` archives. Those reads are not renderer-supplied paths (they come from the
`.scmap`'s own prop list), so they need no second guard.

The response is filtered, not complete: only objects at or above the request's `floor`
are returned, because a 20 km map measures ~100 000 of them. `floor` comes back in the
response and the tab clamps its slider to it, so a tolerance below the floor cannot
silently undercount. The prop list is also capped, and the response reports how many
records were cut.

### Props & DDS — `props.js` (9)
```
G  dds-to-dataurl       G  generate-prop-files  G  scan-map-emitters
G! resolve-lod-preview-urls                     G  scan-map-props
   dds-url-to-dataurl      save-custom-prop        save-custom-prop-folder
   scan-global-props
```

### Community / GitHub — `community.js` (14)
```
   github-auth-start       github-auth-poll        github-auth-status
   github-auth-logout      github-create-issue     submit-contribution-pr
   contrib-load-github-data                        contrib-download-asset
  !contrib-parse-scmskybox !contrib-get-maintainer-token-status
  !contrib-set-maintainer-token
   clipboard-write-text    open-folder             open-tool-window
```

### Texture Editor — `node-editor.js` (8)
```
G  node-editor-load-texture
   node-editor-create-project   node-editor-list-projects  node-editor-load-project
   node-editor-save-graph       node-editor-delete-graph   node-editor-list-assets
   node-editor-read-skybox
```
> The `node-editor-*` prefix follows the **route id**, not the UI label. The tab is
> called *Texture Editor* and lives in `tabs/Textures/TextureEditor/` — see
> PROJECT_STRUCTURE.md for why the id never changed.
>
> `node-editor-load-texture` is the app's general "game `.dds` → RGBA" call and the
> **3D Viewer uses it too**, rather than adding a fourth near-copy of the same resolver.
> It takes either a game path or, since the viewer's drag-and-drop needs it,
> `textureBytes` (base64) for a file that lies outside every allowlisted root.

### 3D Viewer — `mesh.js` (2)
```
G  viewer3d-load-mesh          G  viewer3d-resolve-blueprint
```
`viewer3d-load-mesh` parses a `.scm` (SupCom Mesh, `MODL`, 68-byte vertex stride) into
flat position/normal/uv/index arrays, base64-encoded. `viewer3d-resolve-blueprint` reads
a `_prop.bp` / `_unit.bp` for its `UniformScale`, declared footprint and per-LOD asset
paths — without the scale the mesh renders about twenty times oversized.

Both accept a game path *or* raw bytes (`meshBytes`). The guard only applies to the path
form: a file dropped from the Desktop is outside every allowlisted root, so the renderer
reads it and sends the bytes, and no filesystem access happens in the handler at all.

Both resolve game paths through `modules/gamefiles.js`, which is the fourth place in
this folder to implement the same `.scd` search — `file-ipc.js` and `node-editor.js` each
still carry their own ZIP cache. New callers should use `gamefiles.js`; migrating the
other two is an open cleanup.

### Map resizer — `map-resizer.js` (4, all guarded) · Preview — `preview.js` (5)
```
G  mr-find-scmap        G  mr-scale-scmap       G  mr-scale-save-lua
G  mr-update-scenario-lua
G  mr-duplicate-map-version   make-map-adaptive   preview-render
   preview-image-step        !preview-replace-dds
```

### Biome changer — `biome.js` (2, all guarded)
```
G  biome-read-state       G  biome-apply
```
`biome-read-state` reads a **packed** `.scmap` (guard on `scmapPath`), so analysing a map
needs no unpack. `biome-apply` patches an **unpacked** folder (guard on `unpackFolder`) and
is the only writer; the caller runs `scmap-unpack` before and `scmap-pack` after, the same
cycle `scmap-patch-water` and `scmap-write-terraintype` use. It also rewrites `props*.lua`,
because `exportScmapData` splits props out of `data.lua` on unpack.

### Libraries & scanning — `scanner.js` (4) · `texture-scanner.js` (3) · `skybox.js` (2)
```
   library-load            library-scan          !library-invalidate
  !library-set-custom-tags
  !texture-library-load   !texture-library-scan  !texture-extract
   skybox-library-load      skybox-library-fetch
```

### Guides — `guides.js` (5) · `guides-downloads.js` (3)
```
   read-guide              read-guide-asset        save-guide
   guide-asset-list       !guide-asset-cache-clear
  !guide-downloads-manifest  !guide-downloads-preview  !guide-downloads-save
```

### Settings & shell — `settings.js` (7) · `logger.js` (2) · `dds.js` (1)
```
   settings-load           settings-save           settings-get-version
   settings-pick-file      settings-pick-folder    autosave-run-now
  !autosave-get-status     get-log-file-path       open-log-window
G  write-dds
```

### CLI & editor bridge — `cli-runner.js` (2) · `cli-session-store.js` (3) · `editor-bridge.js` (3)
```
   cli-exec                cli-abort
  !cli-session-list       !cli-session-load       !cli-session-save
   bridge-connect          bridge-disconnect       bridge-send-snapshot
```

### Co-Op — `coop-versioner.js` (1)
```
  !coop-version-fix
```

---

## Known defects

Everything below was found by cross-checking the three gates against each other. None of
it is fixed — this section is a work queue.

### 🔴 Two live channels are blocked by the allowlist

The renderer calls them, the preload rejects them, and **both call sites swallow the
error in a `try/catch`** — so the feature silently does nothing instead of failing loudly.

| Channel | Called from | Consequence |
|---|---|---|
| `read-data-file` | `shared/Libraries/UnitLibrary/UnitLibrary.jsx:139,157` | `unit_overrides.json` and `unit_blacklist.json` never load. Unit tier/group overrides and the blacklist are inert — in the Unit Library, i.e. in Wreckage and Props. |
| `resolve-lod-preview-urls` | `tabs/Scenery/CustomProps/CustomProps.jsx:54` | LOD preview URLs never resolve for custom props. |

Both handlers exist and are correct; they are simply missing from `INVOKE_CHANNELS` in
`electron/preload.js`. The fix is two lines — but it *is* a change to a security
allowlist, so it should be a deliberate, reviewed edit rather than a drive-by.

A third, `coop-version-fix`, has the same defect but is harmless: its only caller is
`tabs/CoOp/`, which is dead code that does not build.

### 🟡 Duplicate registrations

Electron throws on a second `handle()` for the same channel unless the first is removed.
Three channels are registered twice:

| Channel | Winner | Loser |
|---|---|---|
| `read-guide` | `guides.js:519` — calls `ipcMain.removeHandler('read-guide')` first, deliberately overriding | `file-ipc.js:257` is dead |
| `read-footer-article` | `file-ipc.js:285` | `footer-content.js:79` — inside `registerFooterContentHandlers()`, **which is never called anywhere.** The whole module is dead code. |
| `write-file` | `file-ipc.js:318` | not a real duplicate — the second hit is a JSDoc usage example in `security.js:80` |

The `read-guide` override works but is easy to miss: reading `file-ipc.js` alone gives
you the wrong implementation. The `removeHandler` call is the only signal.

### 🟡 Dead allowlist entry

`scmap-select-folder` is in `INVOKE_CHANNELS` with no handler anywhere and no caller.

### 🟢 Unreachable-but-harmless handlers

19 further handlers are not allowlisted and not currently called from the renderer.
Marked `!` in the listing above — mostly newer subsystems (`texture-scanner`,
`guides-downloads`, `cli-session-store`, the contrib maintainer-token pair). They are
either work in progress or abandoned. Each one is either a missing allowlist entry or a
handler that should be deleted; deciding which needs a look at the feature, not at the
IPC layer.

---

## Adding a channel

1. Write the handler in the module that owns the domain (`electron/modules/*.js`).
   New domain → new module, and `require` it from `electron/main.js`.
2. If any argument is or becomes a filesystem path, wrap it:
   ```js
   ipcMain.handle('write-thing', withPathGuard(
     ({ filePath }) => [filePath],              // extract every path from the args
     async (event, { filePath, content }) => { … }
   ));
   ```
3. **Add the channel to `INVOKE_CHANNELS` in `electron/preload.js`.** Skipping this is
   the single most common mistake — see the two live defects above, both of which fail
   silently.
4. Never `exec`; use `execFile` and never pass unvalidated user input as an argument.
   `shell.openPath` / `openExternal` only against a whitelist.
5. For a push channel, add it to `LISTEN_CHANNELS` too.

### Regenerating the numbers in this document

```bash
grep -rhoE "ipcMain\.handle\(\s*'[^']*'" electron/ | sed "s/.*'\(.*\)'/\1/" | sort -u
```

The authoritative sources are always the `ipcMain.handle` calls in `electron/modules/`
and the three channel sets in `electron/preload.js`.
