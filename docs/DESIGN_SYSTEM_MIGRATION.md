# Fable5 Design System — Tab Integration Guide

> Rewritten 2026-07-08 to match the shipped code. The previous version described a
> pre-rename API (`WorkspaceConsole`, `EntityConsole`, lowercase `shared/…` paths)
> that no longer exists — the folder rename to PascalCase (`Shared/`, `Tabs/`, `Core/`)
> landed, and both components were renamed and re-parameterised along the way.
> This version documents what is actually importable today.

How to take a tab and fully integrate it into the unified Fable5 UI system, so it
is **visually deckungsgleich** with the gold standard and recolors from a single
variable. Uniformity ("Einheitlichkeit") is the top priority: one primary button,
one secondary button, one card, one preview — never several lookalikes.

There are two layers to reuse, in order of preference:

1. **Shared components** (`Shared/Ui/EntityPanel/`) — whole pieces of UI (card,
   coordinate register, add-tile, output checklist, emitter-toggle block, map
   preview) lifted from the gold standard. Reuse these wholesale wherever they fit.
2. **Primitives** (`Shared/DesignSystem/`) — the atoms (buttons, inputs, stations,
   the staircase/block system) for anything a shared component doesn't cover.

**Never** re-implement a card/preview/button look locally. If a reusable element
is missing, extract it into the shared layer and refactor the gold standard onto
it too — that keeps one source of truth.

Gold-standard reference implementations — the only three tabs currently held to
this contract in full:
- `Tabs/Placement/Wreckage/Wreckage.jsx` — the source the shared components were
  lifted from.
- `Tabs/Placement/Props/Props.jsx` and `Tabs/Placement/Emitter/Emitter.jsx` — built
  on the same shared components; the proof that "build once, reuse everywhere" holds.

> **Scope note:** most other tabs (Skybox, Stars, RockErosion, Trees, Settings,
> History, Contributions, …) are **not** yet on this system, or are only partially
> on it. Do not treat their code as reference. `docs/ROADMAP.md` (Phase 2) and
> `docs/LAYOUTS.md` track that wider rollout; this document only guarantees Wreckage/
> Props/Emitter.

---

## 1. The system at a glance

**`Shared/DesignSystem/` — tokens, primitives, layout shell**
- `tokens.css` — every design token as `:root` vars (spacing, type, ink, lines,
  radius, shadow, duration) + the per-tab `--<id>-color` / `--<id>-glow` /
  `--<id>-glow-strong` triplets under **§11 PER-TAB ACCENT REGISTRY** (single
  source of truth for tab hues).
- `tokens-light.css` — light-mode override layer, imported *after* `tokens.css`.
  Activated by `document.documentElement.dataset.theme = 'light'` (see §2 below —
  this exists today and none of the older docs mention it).
- `primitives.css` — the `ctrl-*` control family (`ctrl-col`, `ctrl-block`,
  `ctrl-subtitle`, `ctrl-field`/`ctrl-input`, `ctrl-row`, `ctrl-btn-add` /
  `ctrl-btn-library` / `ctrl-btn-delete` / `ctrl-btn-danger` / `ctrl-btn-meta` /
  `ctrl-btn-close`), `commit-button` (the primary CTA), `station` (selection tile).
  See §12 of `TAB_DESIGN_LAW.md` for the button-hierarchy mapping.
- `layout.css` — the layout shell classes `TabLayout` renders into (`workspace`,
  `console-rail` + `rail-item`, `workspace-main` / `workspace-column`, `section-*`
  header family, `preview-panel`, `standby-field`, `layout-z-*`, `layout-w-*`).
- `index.css` — single `@import` entry point (tokens → tokens-light → primitives →
  layout).

**`Shared/Ui/TabLayout/TabLayout.jsx`** — the outer shell: collapsing console rail +
one of four layout renderers (**X/Y/Z/W**, see `docs/LAYOUTS.md`) + fixed ghost
tracker. Core props: `sections`, `activeSection`, `onSelect`, `children`,
`layoutMode` (`'x'|'y'|'z'|'w'`, default `'x'`), plus per-layout props
(`controlsWidth`/`asideSlot`/`asideCaption`/`asideMirror` for X; `ghostLabel`/
`readout` for Y; `groupMode`/`secondRail`/`activeGroup`/`onGroupSelect`/`groupSlotB`
for Z; `canvasToolbar`/`topBar`/`toolbar` for W), and shell props `toolbarSlot`,
`renderEyebrow`, `navLabel`, `bootMs`. Rail pin/collapse state is app-wide, not
per-tab — `TabLayout` persists it to a single shared `localStorage` key
(`RAIL_PINNED_KEY` in `TabLayout.jsx`), so it carries over across tabs and
across sessions; there is no per-tab override for it. All three gold-standard
tabs use `layoutMode="x"` (Placement tabs are canvas + controls).

**`Shared/Ui/EntityPanel/EntityPanel.jsx`** — reusable feature components (the big
lever). Exports today: `EntityCard`, `EntityCardGrid`, `AddTile`, `CoordinateList`,
`OutputChecklist`, `MapPreview`, `Dropdown`, `MirrorDropdown`, `EmitterToggleBlock`,
`ToggleSwitch`, `DropSlot`, `FileDragOverlay`, `useFileDrop`. Pure UI; every
mutation flows back through callbacks.

> **Renamed / replaced vs. the pre-rewrite draft of this doc:** `MatchingMode` and
> `EmitterAssignmentOverlay` (the old full-screen matrix overlay) do not exist
> anymore. Emitter↔entity assignment is now `EmitterToggleBlock` — a per-card
> collapsible toggle list with a **declare-source / inherit-from-source** model
> (a card can be marked "use as source"; other cards pick it from a dropdown and
> mirror its emitter selection live). No standalone matching-mode tab step and no
> full-screen overlay — the assignment lives inside the entity card itself.

**`Shared/trace.css`** — still a live dependency, not legacy: it provides the
`:root` motion easings and keyframes that `EntityPanel.jsx` animates with, plus
`.trace-subsection` (the collapsible sub-header used by `CoordinateList` and
`EmitterToggleBlock` — tick + fading line, not a full border). Folding it into the
design system is a long-term cleanup (§7), not a blocker.

**`Shared/shared.css`** — imported by all three gold-standard tabs directly (and
by `EntityPanel.jsx` itself). Still the home of some generic helpers. Audit later
(§7).

---

## 2. Theming: tab accent + light/dark mode

On the tab root, set the accent and nothing else color-related:

```jsx
<div className="<feature>-tab trace-tab" style={{
  '--tab-color':       'var(--<feature>-color)',
  '--tab-glow':        'var(--<feature>-glow)',
  '--tab-glow-strong': 'var(--<feature>-glow-strong)',
}}>
```

In practice all three gold-standard tabs do this via CSS, not inline style — e.g.
`Wreckage.css`:
```css
.wr-tab {
  --tab-color:       var(--wreckages-color);
  --tab-glow:        var(--wreckages-glow);
  --tab-glow-strong: var(--wreckages-glow-strong);
}
```
(Note the token id is `wreckages`, plural — matches the tab id used in
`Core/Home/Data/toolRegistry.js` and `Core/tabRoutes.jsx`, not `wreckage`.)

Define the literal hue once in `Shared/DesignSystem/tokens.css` under **§11 PER-TAB
ACCENT REGISTRY** (e.g. `--props-color: #538A33;` plus its two glows), and add the
tab to `Core/Home/Data/toolRegistry.js` (nav metadata) and `Core/tabRoutes.jsx`
(render wiring — see §6). Everything — rail, cards, preview, subtitle — recolors,
because the system references `var(--tab-color)` **directly** (it inherits down
intact). **Never reintroduce a `:root`-level `--accent: var(--tab-color)` alias** —
see Notes/gotchas at the end.

### Light mode exists — factor it in

`Shared/DesignSystem/tokens-light.css` is a real, wired-up override layer, toggled
by `document.documentElement.dataset.theme` (set from `settings.colorTheme` in
`Core/ForgeMapToolkit.jsx`). Under light mode, the per-tab accent registry
**collapses to a single shared accent** ("glacier" steel-blue) instead of each
tab's own hue — this is a deliberate simplification for the light palette, not a
bug. When building a new tab or shared component, don't hardcode assumptions that
`--tab-color` is always the tab's own hue; it is only guaranteed to be *a*
consistent accent, dark or light. See `docs/UI_PHILOSOPHY.md` §2 for the reasoning.

---

## 3. Integrate a Placement-style tab (the decisive recipe)

This is the full path for a register-of-entities tab (units, props, emitters —
color-coded, with coordinates, a map preview, and an export step). PropsTab and
EmitterTab are the worked examples besides Wreckage — copy their structure.

### 3.1 Import the system

```jsx
import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import './<Feature>.css';
import TabLayout from '../../../Shared/Ui/TabLayout/TabLayout';
import { MapPreview, MirrorDropdown } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import {
  getMirroredCoords, kmLabel,
  ensureDir, writeFile, injectPropsLua,
  drawPlacementCanvas,
  usePersistentState, useMapInfo, useScmapPreview,
} from '../../../Shared/MapLogic';
```

Section files (`EntityCard`, `EntityCardGrid`, `AddTile`, `CoordinateList`,
`EmitterToggleBlock`) are imported inside the section component that renders them
(e.g. `Units.jsx`/`PropList.jsx`/`Emitters.jsx`), not in the parent — see
`TAB_CONTRACT.md §4`.

### 3.2 Compose the shell

Drive one section at a time with `TabLayout`, `layoutMode="x"`:

```jsx
const [activeSection, setActiveSection] = useState('config');

<TabLayout
  layoutMode="x"
  sections={[
    { id: 'config', index: '01', label: 'Configuration', desc: '…', done: !!ready },
    { id: 'units',  index: '02', label: 'Units',          desc: '…', count: nPlaced },
    { id: 'export', index: '03', label: 'Export',         desc: '…' },
  ]}
  activeSection={activeSection}
  onSelect={setActiveSection}
  renderEyebrow={(s) => `… — ${s.index} — … CONSOLE`}
  navLabel="<feature> console navigation"
  asideSlot={/* <MapPreview …/> — §3.6 */}
  asideMirror={/* mirror-mode Dropdown */}
>
  {activeSection === 'config' && <FeatureConfiguration {...configProps} />}
  {activeSection === 'units'  && <FeatureUnits {...unitsProps} />}
  {activeSection === 'export' && <FeatureExport {...exportProps} />}
</TabLayout>
```

Wreckage and Props use no explicit `matching` section anymore — matching lives
inside the entity register step via `EmitterToggleBlock` (§1).

### 3.3 Entity register — `EntityCardGrid` + `EntityCard` + `CoordinateList` + `EmitterToggleBlock` + `AddTile`

The card shell is shared; you supply only the body (the fields that differ per
tab) as children.

```jsx
<EntityCardGrid>
  {entities.map((e, i) => (
    <EntityCard
      key={e.id}
      index={i}
      color={e.color}
      selected={i === selected}
      onSelect={() => setSelected(i)}
      onDelete={() => deleteEntity(i)}
      title={e.name ? e.name.toUpperCase() : `Entity ${i + 1}`}
      availableColors={availableColors}
      showColorPicker={picker === i}
      onToggleColorPicker={() => setPicker(picker === i ? null : i)}
      onPickColor={(c) => { updateColor(i, c); setPicker(null); }}
    >
      {i === selected && (<>
        {/* tab-specific fields: name, blueprint paths … */}
        <CoordinateList
          coordinates={e.coordinates}
          fields={[[
            { key: 'x', label: 'X', placeholder: '256' },
            { key: 'y', label: 'Y', placeholder: '26'  },
            { key: 'z', label: 'Z', placeholder: '256' },
          ]]}
          open={!!coordsOpen[i]}
          onToggle={() => setCoordsOpen(p => ({ ...p, [i]: !p[i] }))}
          labelFor={(c, ci) => `Point ${ci + 1}${c.isMirrored ? ' · mirror' : ''}`}
          onUpdate={(ci, key, val) => updateCoordinate(i, ci, key, val)}
          onDelete={(ci) => deleteCoordinate(i, ci)}
          onAdd={() => addCoordinate(i)}
          hasPlaced={e.coordinates.some(c => c.x && c.z)}
          onDeleteAll={async () => { if (await luxuryConfirm(/* … */)) deleteAllCoordinates(i); }}
        />
        <EmitterToggleBlock
          entity={e}
          entityIdx={i}
          allEntities={entities}
          configuredEmitters={emitters}
          getEmitterName={getEmitterNameFromPath}
          labelOf={(entity, idx) => entity.name?.toUpperCase() || `Entity ${idx + 1}`}
          onToggleEmitter={toggleEmitter}
          onSetSource={setEmitterSource}
          onClearSource={clearEmitterSource}
          onSetIsSource={setIsEmitterSource}
        />
      </>)}
    </EntityCard>
  ))}
  <AddTile label="Add Entity Type" onClick={addEntity} />
</EntityCardGrid>
```

`fields` is an array of grid rows; Wreckage passes two (x/y/z and
heading/pitch/roll), Props/Emitter pass one (x/y/z). That single prop is the only
card difference between the tabs.

### 3.4 Export — `OutputChecklist`

```jsx
<OutputChecklist
  ready={hasPlacedCoords}
  onCommit={generateFiles}
  commitLabel="Generate Files"
  commitAriaLabel="Generate files"
  items={[
    { label: 'Generate README file', checked: genReadme, onToggle: () => setGenReadme(!genReadme) },
    { label: 'Export raw .lua (no SCMAP)', checked: rawLua, onToggle: () => setRawLua(!rawLua) },
  ]}
/>
```

`OutputChecklist` renders two `ctrl-block`s ("Generate Options" toggles, "Generate
Files" primary `commit-button`) — the checkbox visual is a `ctrl-toggle-row` switch,
not a checkmark box. `ready` toggles the commit button's mono `Ready`/`Not Ready`
status text and enabled state.

### 3.5 Preview — `MapPreview` (+ `asideMirror`)

```jsx
asideSlot={
  <MapPreview
    previewLoading={previewLoading}
    previewImageData={previewImageData}
    onUploadClick={() => fileInputRef.current?.click()}
    fileInputRef={fileInputRef}
    onImageUpload={handleImageUpload}
    canvasRef={canvasRef}
    onCanvasClick={handleCanvasClick}
    containerRef={canvasContainerRef}
    onCanvasMove={handleCanvasMove}
    onCanvasLeave={handleCanvasLeave}
    readoutRef={coordReadoutRef}
    markers={markers}
    onMarkerDelete={(m) => deleteCoordinate(m.entityIdx, m.coordIdx)}
    markerTitle={(m) => `${m.label} — Click to delete`}
    showPlaceholder={!previewImage && entities.every(e => e.coordinates.every(c => !c.x))}
    placeholder="Click on canvas to place units"
    legendTitle="Unit Legend"
    legendRows={entities.map((e, i) => ({ id: e.id, color: e.color, label: e.name || `Unit ${i+1}`, pts: e.coordinates.filter(c => c.x && c.z).length }))}
    hint={`Click canvas to place · ${mirror !== 'none' ? `${mirror} mirror active` : 'no mirror'}`}
  />
}
asideMirror={<MirrorDropdown value={mirror} onChange={setMirror} />}
```

`MapPreview` also supports an opt-in collapsible legend rail (`legendCollapsible`,
`legendCollapsed`, `onToggleLegend`, `selectedLegendId`, `onLegendSelect`) — Wreckage
uses it; when omitted it falls back to the legacy under-canvas `.ec-legend` block.

### 3.6 Feature-only CSS

The tab's own stylesheet keeps **only** genuinely tab-specific visuals, written
with tokens (`var(--space-md)`, `var(--ink-55)`, `var(--tab-color)` …) — never
hardcoded px/hex/easings. Everything the shared layer provides is deleted from it.

### 3.7 Verify

`npm run build` (must be clean), then `npm run electron:dev` and eyeball: parity
with Wreckage, correct accent recolor (and in light mode: parity via the shared
glacier accent), ghost/rail correct, cards lift on hover (`.station`/`.ec-card`),
toggles read correctly, one button vocabulary (§4 below).

---

## 4. Button vocabulary — exactly these, nothing else

The pre-rewrite draft of this doc named `action-button`/`button-solid`/
`commit-button`/`delete-button`. Those classes were never shipped under those
names — the actual, live vocabulary in `primitives.css` (§5 "Buttons") is:

| Loudness | Class | Use |
|---|---|---|
| Normal | `ctrl-btn-add` | Add / utility action. Boxless — a leading stub-line that grows on hover is the affordance. |
| Secondary CTA | `ctrl-btn-library` | Bordered (`var(--tab-color)`), no fill. Reserve for actions the user would genuinely miss otherwise (e.g. opening a library overlay). Max one per block — see `TAB_DESIGN_LAW.md §5`. |
| Leise (destructive) | `ctrl-btn-danger` / `ctrl-btn-delete` | Muted-red on hover. `ctrl-btn-danger` for a labelled action ("Delete All"), `ctrl-btn-delete` for the bare `×` glyph on a card/row. |
| Leise (non-destructive) | `ctrl-btn-close` | Dismiss / collapse overlays and panels. |
| Leise (meta) | `ctrl-btn-meta` | Quiet metadata toggle, sits under a field baseline. |
| Signature primary | `commit-button` | Always rendered via `OutputChecklist` — the TraceLine CTA that terminates a section. |
| Selection tile | `station` | Not a button but the same lift+ignite mechanic — mode/option pickers. |

Do not introduce a new button class. If a new context needs a button, it is one of
these.

---

## 5. Reference — components

| need | component |
|---|---|
| selectable colour-coded card | `EntityCard` (+ `EntityCardGrid`, `AddTile`) |
| collapsible coordinate register | `CoordinateList` |
| per-entity emitter assignment (declare-source / inherit) | `EmitterToggleBlock` |
| README/raw toggles + primary commit | `OutputChecklist` |
| map upload + canvas + legend + hint | `MapPreview` |
| custom `<select>` replacement | `Dropdown` (+ `MirrorDropdown` preset) |
| boolean toggle (corner-bracket style) | `ToggleSwitch` |
| drag-and-drop file target | `DropSlot` (+ `useFileDrop`, `FileDragOverlay`) |

---

## 6. Tab registry — where a new tab gets wired in

Two files, not one:
- `Core/Home/Data/toolRegistry.js` — nav/home-screen metadata (id, label, color var,
  description). The `id` here is what the CSS accent registry and `tabRoutes.jsx`
  key off (e.g. `wreckages`, plural).
- `Core/tabRoutes.jsx` — render wiring: imports the tab component and maps the id to
  `(c) => <Component {...c.tabProps} />`.

Both need an entry for a tab to appear and route correctly.

---

## 7. Help system status (real divergence — flag when touching these tabs)

Only **Wreckage** is on the current-generation help pattern: a colocated
`Help.jsx` that imports `Shared/Ui/HelpPanel/HelpPanel.jsx` + section components
(`WorkflowSection`, `ShortcutsSection`, `TroubleshootSection`, …). **Props and
Emitter still import their help modal from the legacy
`Tabs/HelpModals/{Props,Emitter}_help.jsx`** — a self-contained modal that does not
use `HelpPanel.jsx` at all (own markup, own `--tab-color` inline styling). This is
not a doc error — it's the actual current state, and closing it (migrating Props/
Emitter onto `Help.jsx` + `HelpPanel`) is an open, small, low-risk task. See
`TAB_CONTRACT.md §7`.

---

## 8. Cleanup backlog (non-blocking)

- **`trace.css`** is a shared dependency (easings, keyframes, `.trace-subsection`,
  `.trace-tab` surface class). Long-term: fold the remaining pieces into the design
  system and delete `trace.css`. Not urgent.
- **`shared.css`** — audit what's still actually consumed by Wreckage/Props/Emitter
  vs. dead weight; shrink toward zero.
- **`primitives.css` unused-by-gold-standard classes** — `subsection-head` (full
  border-bottom header) and `field-hint` exist in `primitives.css` but are not used
  by Wreckage/Props/Emitter (they use `.trace-subsection` from `trace.css` instead
  for collapsible headers). Confirm dead-elsewhere before deleting.
- **Props/Emitter help migration** — close the gap in §7.
- **`Props.css` dead CSS** — legacy tab-scoped rules may remain from before the
  component refactor; confirm unused before deleting (grep for the class prefix in
  `Props.jsx`).

### Token audit — re-run before trusting old numbers

`docs/DESIGN_TOKENS_AUDIT.md` used to track this as a standalone, dated snapshot
(last run 2026-06-22); it's folded in here because a numbers-heavy audit file goes
stale fast and a stale audit is worse than no audit. As of the last run: 28 tokens
used via `var(--…)` with no definition anywhere (mostly concentrated in
`Tabs/Skybox/Stars/Stars.css` and `Tabs/Tools/AdaptiveMapHelper/AdaptiveMapHelper.css`
— both out of scope for the gold-standard tabs), 36 tokens defined in `tokens.css`
but never consumed, and several thousand hardcoded hex/rgba hits concentrated in
`Tabs/Guides/`, `Tabs/Skybox/SkyboxGenerator/`, `Core/ForgeMapToolkit.css`,
`Tabs/Tools/AdaptiveMapHelper/`, `Tabs/Community/Contributions/`. None of this
affects Wreckage/Props/Emitter materially — it's backlog for the tabs still on the
old system. Re-run before acting on these numbers:

```bash
cd /d/ForgeMapToolKit
AUD=/tmp/aud; mkdir -p $AUD
grep -rhoE -- '--[a-z0-9-]+\s*:' src/components --include=*.css | sed -E 's/\s*:.*//' | sort -u > $AUD/def_css.txt
grep -rhoE -- "['\"]--[a-z0-9-]+['\"]\s*:" src/components --include=*.jsx | sed -E "s/['\"]//g; s/\s*:.*//" | sort -u > $AUD/def_jsx.txt
cat $AUD/def_css.txt $AUD/def_jsx.txt | sort -u > $AUD/def_all.txt
grep -rhoE -- 'var\(--[a-z0-9-]+' src/components --include=*.css --include=*.jsx | sed 's/var(//' | sort -u > $AUD/used.txt
# Real gaps (used, never defined):
comm -23 $AUD/used.txt $AUD/def_all.txt
# Dead tokens in tokens.css (defined, never used):
grep -oE '^\s*--[a-z0-9-]+\s*:' src/components/Shared/DesignSystem/tokens.css | sed -E 's/\s//g; s/:$//' | sort -u | comm -23 - $AUD/used.txt
# Hardcoded hex per file, worst offenders first:
for f in $(find src/components -name '*.css'); do n=$(grep -oiE '#[0-9a-f]{3,8}\b' "$f"|wc -l); [ $n -gt 0 ] && echo "$n ${f#src/components/}"; done | sort -rn
```

---

## 9. Definition of done (Wreckage/Props/Emitter parity)

- [x] All three import `TabLayout` + `EntityPanel`.
- [x] All three theme with only `--tab-color` (+ glows) via the tokens.css registry.
- [x] All three reuse `EntityCard`/`EntityCardGrid`/`CoordinateList`/`AddTile`/
      `MapPreview`/`OutputChecklist`; no tab re-implements a card/preview/button look.
- [x] One button vocabulary (§4).
- [ ] One help pattern — currently split (§7).
- [ ] No hardcoded px/hex/easings outside `tokens.css` (not re-audited as part of
      this rewrite — re-run the script in §8 before trusting old numbers).
- [ ] `trace.css` + `shared.css` reduced to (or folded into) the system.

---

## Notes / gotchas

- **Never reintroduce a `:root`-level `--accent: var(--tab-color)` alias.** A custom
  property whose value is `var(--tab-color)` is resolved where it's *declared*; at
  `:root` it bakes the (unset) fallback and inherits that everywhere, ignoring a
  tab's later override. Always reference `var(--tab-color)` **directly** in rules
  (it's normally inherited, so a tab root's color flows down intact).
- **`EntityPanel.jsx`'s own file header still says "EntityConsole"** — a stale
  internal comment left over from the rename. The exports and behavior are current;
  don't be misled by the docstring. Worth a one-line fix when next touching the file.
- **Data colors are not `--tab-color`.** A unit/prop/emitter's own card color
  (~arbitrary per-entity hue) is a separate role from the tab's identity accent —
  see `docs/UI_PHILOSOPHY.md §2, Role 2`.
- Keep the **restraint contract**: at most one Secondary CTA per block, one
  `commit-button` per section, no idle motion except the standby cursor.
