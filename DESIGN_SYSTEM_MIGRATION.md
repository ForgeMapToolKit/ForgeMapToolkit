# Fable5 Design System — Tab Integration Guide

How to take a tab and fully integrate it into the unified Fable5 UI system, so it
is **visually deckungsgleich** with the gold standard and recolors from a single
variable. Uniformity ("Einheitlichkeit") is the top priority: one primary button,
one secondary button, one card, one preview — never several lookalikes.

There are two layers to reuse, in order of preference:

1. **Shared components** (`shared/entity-console/`) — whole pieces of UI (card,
   coordinate register, matching selector, output checklist, emitter overlay, map
   preview) lifted from the gold standard. Reuse these wholesale wherever they fit.
2. **Primitives** (`shared/design-system/`) — the atoms (buttons, inputs, chips,
   stations, badges) for anything a shared component doesn't already cover.

**Never** re-implement a card/preview/button look locally. If a reusable element
is missing, extract it into the shared layer and refactor the gold standard onto
it too (see §7) — that keeps one source of truth.

Gold-standard reference implementations:
- `tabs/Emitter/WreckageTab/Wreckage.jsx` — the source the shared components were
  lifted from.
- `tabs/Emitter/PropsTab/Props.jsx` — a second tab built entirely on the shared
  components; the proof that "build once, reuse everywhere" holds.

---

## 1. The system at a glance

**`shared/design-system/` — tokens, primitives, layout shell**
- `tokens.css` — every design token as `:root` vars (spacing, type, surfaces, ink,
  hairlines, motion, z-index) + the per-tab `--tab-color` / `--tab-glow` /
  `--tab-glow-strong` (white fallbacks).
- `primitives.css` — `action-button`, `button-solid`, `commit-button`,
  `delete-button`, `field-input`/`field-select`, `field-label`/`field-hint`,
  `form-group`, `chip`, `switch`, `check-row`, `station` + `option-row`,
  `status-badge`, `tick`, `filament`, `divider`, `subsection-head`.
- `layout.css` — `workspace`, `console-rail` + `rail-item`,
  `workspace-main`/`workspace-column`, the `section` header family,
  `preview-panel`, `workspace-ghost`, `surface-grain`.
- `index.css` — single `@import` entry point.

**`shared/WorkspaceConsole/WorkspaceConsole.jsx`** — the outer shell: collapsing
console rail + centered working column (one section at a time) + fixed preview
panel + background ghost numerals. Props: `sections`, `activeSection`, `onSelect`,
`children`, `previewSlot`, `mirrorSlot`, `ghostLabel`, `renderEyebrow`,
`railStorageKey`, `navLabel`, `bootMs`.

**`shared/entity-console/` — reusable feature components (the big lever)**
- `EntityConsole.jsx` — exports `EntityCard`, `EntityCardGrid`, `AddTile`,
  `CoordinateList`, `MatchingMode`, `OutputChecklist`, `EmitterAssignmentOverlay`,
  `MapPreview`. Pure UI; every mutation flows back through callbacks.
- `entity-console.css` — the card / coordinate / add-tile / colour-picker /
  map-preview styling (`ec-*`). Tab-agnostic: no `.trace-tab` ancestor requirement,
  and all `--tc-*` surface tokens carry the same inline fallback as `trace.css`, so
  it renders identically even in tabs that don't carry the `.trace-tab` palette.

**`shared/trace.css`** — still a live dependency, not legacy: it provides the
`:root` motion easings (`--trace-*`) and keyframes that `entity-console.css`
animates with, the `.trace-tab` surface palette (`--tc-*`), and two layout
helpers still in use (`trace-subsection` collapse header, `trace-section-head`
toolbar row). Folding these into the design system is a long-term cleanup (§7), not
a blocker.

**`shared/shared.css`** — imported widely. Still the home of the checkbox
(`checkbox` / `checkbox-label` / `checkbox-check` — the SVG **checkmark**) and the
modal chrome (`help-modal*`, `help-btn`). Keep; audit later (§7).

---

## 2. Pick the integration path

- **Emitter-style tab** (a register of colour-coded entities with coordinates, an
  emitter/category step, a map preview, and an export step — like Wreckage/Props):
  use **WorkspaceConsole + the entity-console components**. Go to §3.
- **Generic tab** (forms, tools, settings — no entity register): use
  **WorkspaceConsole (or just the CSS) + primitives**. Go to §4.

Most of the remaining migration targets are generic tabs (§5); the entity-console
path applies to any future emitter/placement-style tab.

---

## 3. Integrate an emitter-style tab (the decisive recipe)

This is the full path. PropsTab is the worked example — copy its structure.

### 3.1 Import the system

```jsx
import WorkspaceConsole from '../../../shared/WorkspaceConsole/WorkspaceConsole.jsx';
import {
  EntityCard, EntityCardGrid, AddTile, CoordinateList,
  MatchingMode, OutputChecklist, EmitterAssignmentOverlay, MapPreview,
} from '../../../shared/entity-console/EntityConsole.jsx';
```

`WorkspaceConsole` and `EntityConsole` both pull in `design-system/index.css`,
`trace.css` and `shared.css` themselves — you don't import CSS separately.

### 3.2 Theme with ONE variable

On the tab root, set the accent and nothing else color-related:

```jsx
<div className="<feature>-tab" style={{
  '--tab-color':       'var(--<feature>-color)',
  '--tab-glow':        'var(--<feature>-glow)',
  '--tab-glow-strong': 'var(--<feature>-glow-strong)',
}}>
```

Define the literal hue once in `src/components/modals/root.css` next to
`--wreckages-color` / `--props-color` (e.g. `--props-color: #538A33;` plus its two
glows). Everything — rail, cards, chips, preview, ghost — recolors, because the
system references `var(--tab-color)` **directly** (it inherits down intact).

> The entity-console surfaces (`--tc-*`) fall back to the gold-standard values, so
> the tab does **not** need the `.trace-tab` class to look right. Add `.trace-tab`
> only if you also want its bed background + entry animation (Wreckage does; Props
> doesn't and is identical).

### 3.3 Compose the shell

Drive one section at a time with `WorkspaceConsole`:

```jsx
const [activeSection, setActiveSection] = useState('config');

<WorkspaceConsole
  sections={[
    { id: 'config',   index: '01', label: 'Configuration', desc: '…', done: !!ready },
    { id: 'units',    index: '02', label: 'Units',         desc: '…', count: nPlaced },
    { id: 'matching', index: '03', label: 'Matching',      desc: '…' },
    { id: 'export',   index: '04', label: 'Export',        desc: '…' },
  ]}
  activeSection={activeSection}
  onSelect={setActiveSection}
  ghostLabel="UNITS"
  renderEyebrow={(s) => `… — ${s.index} — … CONSOLE`}
  railStorageKey="<feature>-rail-pinned"
  navLabel="<feature> console navigation"
  previewSlot={/* <MapPreview …/> — §3.8 */}
  mirrorSlot={/* select + remove-preview controls */}
>
  {activeSection === 'config'   && (/* §3.4 */)}
  {activeSection === 'units'    && (/* §3.5 */)}
  {activeSection === 'matching' && (/* §3.6 */)}
  {activeSection === 'export'   && (/* §3.7 */)}
</WorkspaceConsole>
```

### 3.4 Config section — fields + emitter list

Plain primitives. Use `form-group` + `field-label` + `field-input`, and the shared
`ec-input-row` for an input with a trailing `delete-button`. Map readouts use
`ec-map-info*` / `ec-path-hint`. Buttons are `action-button action-button--full`.

### 3.5 Entity register — `EntityCardGrid` + `EntityCard` + `CoordinateList` + `AddTile`

The card shell is shared; you supply only the body (the fields that differ per tab)
as children.

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
        {/* tab-specific fields: name, categories, blueprint paths … */}
        <CoordinateList
          coordinates={e.coordinates}
          fields={[[                                   /* one or more grid rows */
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
      </>)}
    </EntityCard>
  ))}
  <AddTile label="Add Entity Type" onClick={addEntity} />
</EntityCardGrid>
```

`fields` is an array of grid rows; Wreckage passes two (x/y/z and
heading/pitch/roll), Props passes one (x/y/z). That single prop is the only card
difference between the two tabs.

### 3.6 Matching — `MatchingMode`

```jsx
<MatchingMode
  value={mode}
  onChange={setMode}
  onConfigure={() => setShowAssignment(true)}
  modes={[
    { key: 'smart',  label: 'Smart Combination (3-Tier)', desc: '…', note: '…' },
    { key: 'simple', label: 'Simple Union',               desc: '…', note: '…' },
    /* … */
  ]}
/>
```

Selection is signalled by the station **lift**, not a radio dot — do not add
`option-row--radio`.

### 3.7 Export — `OutputChecklist`

```jsx
<OutputChecklist
  ready={hasPlacedCoords}
  onCommit={generateFiles}
  commitLabel="Generate Files"
  commitAriaLabel="Generate files"
  items={[
    { label: 'Generate README file',          checked: genReadme, onToggle: () => setGenReadme(!genReadme) },
    { label: 'Export …lua (no SCMAP)',         checked: rawLua,    onToggle: () => setRawLua(!rawLua) },
  ]}
/>
```

The checkbox is the shared SVG **checkmark**; `ready` toggles the commit button's
mono `Ready` / `Not Ready` readout and enabled state.

### 3.8 Preview — `MapPreview` (+ `mirrorSlot`)

```jsx
previewSlot={
  <MapPreview
    previewLoading={previewLoading}
    previewImageData={previewImageData}
    onUploadClick={() => fileInputRef.current?.click()}
    fileInputRef={fileInputRef}
    onImageUpload={handleImageUpload}
    canvasRef={canvasRef}
    onCanvasClick={handleCanvasClick}
    /* optional live instrument — Wreckage wires these, Props omits them: */
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
```

The `mirrorSlot` holds the mirror `field-select` + an optional "Remove Preview"
`action-button action-button--danger`.

### 3.9 Emitter↔category overlay — `EmitterAssignmentOverlay`

One component renders the whole full-screen matrix (left: live preview rail of
`ec-card`s; right: per-category emitter chips). Pass the entity accessors + the
emitter predicates + `colorVars` (so it recolors to this tab's hue):

```jsx
{showAssignment && (
  <EmitterAssignmentOverlay
    entities={entities}
    getEntityTitle={(e, i) => e.name?.toUpperCase() || `Entity ${i + 1}`}
    getEntityColor={(e) => e.color}
    getEntityCategories={(e) => e.categories}
    getEmittersForEntity={getEmittersForEntity}
    categories={getAllUniqueCategories()}
    emitters={emitters.filter(p => p.trim())}
    isActive={isEmitterActiveForCategory}
    onToggle={toggleEmitterCategory}
    getName={getEmitterNameFromPath}
    entityNoun="unit"
    sidebarHint="Emitters active per unit"
    onClose={() => setShowAssignment(false)}
    colorVars={{
      '--tab-color': 'var(--<feature>-color)',
      '--tab-glow': 'var(--<feature>-glow)',
      '--tab-glow-strong': 'var(--<feature>-glow-strong)',
    }}
  />
)}
```

### 3.10 Feature-only CSS

The tab's own stylesheet keeps **only** genuinely tab-specific visuals (e.g. a
bespoke library overlay), written with tokens (`var(--space-md)`, `var(--ink-55)`,
`var(--tab-color)` …) — never hardcoded px/hex/easings. Everything the shared layer
provides is deleted from it.

### 3.11 Verify

`npm run build` (must be clean), then `npm run electron:dev` and eyeball: parity
with Wreckage, correct accent recolor, ghost numerals present bottom-left, cards
lift on hover, checkmarks (not squares), one button vocabulary.

---

## 4. Integrate a generic tab (primitives only)

For tabs without an entity register:

1. Import `WorkspaceConsole` (if it's a rail/column/preview layout) or just
   `import '../../../shared/design-system/index.css';` otherwise.
2. Set `--tab-color` (+ glows) on the root (§3.2).
3. Build sections / panels from **primitives** using the class map in §5.
4. Keep only feature-specific, tokenized CSS.
5. `npm run build` + eyeball.

---

## 5. Reference — components, classes, button vocabulary

### Shared components (prefer these)
| need | component |
|---|---|
| selectable colour-coded card | `EntityCard` (+ `EntityCardGrid`, `AddTile`) |
| collapsible coordinate register | `CoordinateList` |
| emitter-matching strategy picker | `MatchingMode` |
| README/raw toggles + primary commit | `OutputChecklist` |
| emitter↔category assignment overlay | `EmitterAssignmentOverlay` |
| map upload + canvas + legend + hint | `MapPreview` |

### Primitive class map (for everything else)
| old / bespoke | new |
|---|---|
| text/number input | `field-input` (+ `field-input--sm`) |
| select | `field-select` |
| field label | `field-label` |
| sublabel / hint | `field-hint` |
| label+control wrapper | `form-group` |
| input + trailing delete | `ec-input-row` (input flexes, `delete-button` after) |
| secondary button | `action-button` (+ `--full` / `--danger`) |
| filled CTA / modal "Done" | `button-solid` (+ `--accent` / `--full`) |
| primary commit | `commit-button` (via `OutputChecklist`) |
| delete glyph | `delete-button` |
| radio / mode tile | `station option-row` (no dot — lift signals selection) |
| checkbox | `checkbox` / `checkbox-label` / `checkbox-check` (SVG check) |
| toggle pill | `chip` (+ `.active`) |
| on/off switch | `switch` / `switch-pole` (+ `.on`) |
| status pill | `status-badge` (+ `--ok/--warn/--err/--accent`) |
| rule | `divider` |
| in-content header | `subsection-head` / `subsection-head-title` |
| empty list / overlay body | `ec-empty-state` |

### Button vocabulary — exactly these, nothing else
- **Secondary / inline action** → `action-button` (`--full` for block width,
  `--danger` for destructive).
- **Filled CTA / modal confirm** → `button-solid button-solid--accent`.
- **Signature primary commit** → `commit-button` (always via `OutputChecklist`).
- **Delete glyph (×)** → `delete-button`.

Do not introduce a fifth button style. If a new context needs a button, it is one
of these four.

---

## 6. Per-tab rollout checklist

Done: **WreckageTab**, **PropsTab** (both on WorkspaceConsole + entity-console).

Order the rest by value/risk:

- [ ] **ScmapTab** — already sets `--tab-color`; convert controls + layout (generic).
- [ ] **MapResizerTab** — has `--tab-color`; migrate (generic).
- [ ] **AdaptiveMapHelperTab** — has `--tab-color`; migrate (generic).
- [ ] **SettingsTab** — currently its own `stc-` console. Fold `stc-rail` into
      `WorkspaceConsole` (preferred — one shell). Biggest single refactor; deliberate.
- [ ] **GeneratorTab**, **SkyboxTab**, **Co-Op**, **Community**, **Guides** — convert
      as each is touched.
- [ ] **HelpModals** — already set `--tab-color` inline; point at shared primitives
      (`field-*`, `action-button`, `status-badge`) and drop local copies.

Per tab, tick when: (a) imports the system, (b) sets only `--tab-color` (+ glows),
(c) UI uses shared components/classes (no bespoke buttons/cards), (d) tab CSS is
feature-only + tokenized, (e) visually verified against the gold standard.

---

## 7. Cleanup backlog (non-blocking)

- **`trace.css`** is now a shared dependency (easings, keyframes, `--tc-*` palette,
  `trace-subsection`, `trace-section-head`). Long-term: move those few pieces into
  the design system (`tokens.css` + a small layout/helper file) and update
  `entity-console.css` + consumers, then delete `trace.css`. Not urgent.
- **`shared.css`** — fold the still-used generic helpers into the system: the
  checkbox into a primitive, `help-modal*` / `help-btn` into a new
  `design-system/overlay.css`. Delete dead rules; shrink toward zero.
- **Per-tab dead CSS** — `Props.css` still has `.props-tab`-scoped rules left over
  from before the component refactor (old preview/card/legend classes). Harmless
  (no in-use duplication); delete once confirmed unused
  (`grep -oE 'props-[a-z-]+' Props.jsx`).
- **Missing primitives** worth adding when a generic tab needs them: a static
  `panel` (non-interactive card), a `toolbar` row, an `overlay`/`modal` primitive
  to replace the inline modal chrome.

---

## 8. Definition of done (clean architecture)

- [ ] Every tab imports the system (directly or via `WorkspaceConsole`).
- [ ] Every tab themes with only `--tab-color` (+ glows); no per-tab color logic.
- [ ] Emitter-style tabs reuse the entity-console components; no tab re-implements a
      card / preview / button look.
- [ ] One button vocabulary everywhere (§5); checkboxes are the SVG checkmark.
- [ ] No tab defines its own button/input/typography/spacing system; per-tab CSS is
      feature-only + tokenized.
- [ ] No hardcoded px/hex/easings outside `tokens.css` (grep audits clean).
- [ ] `trace.css` + `shared.css` reduced to (or folded into) the system.
- [ ] One shell (`WorkspaceConsole`) powers all rail/column/preview tabs.

---

## Notes / gotchas

- **Never reintroduce a `:root`-level `--accent: var(--tab-color)` alias.** A custom
  property whose value is `var(--tab-color)` is resolved where it's *declared*; at
  `:root` it bakes the white fallback and inherits white everywhere, ignoring a
  tab's later override. Always reference `var(--tab-color)` **directly** in rules
  (it's normally inherited, so a tab root's color flows down intact).
- **Pass `colorVars` to overlays that render in a portal-like fixed layer.**
  `EmitterAssignmentOverlay`'s scrim/sidebar/modal are `position: fixed`; they still
  inherit `--tab-color` from the tab root in the DOM, but passing `colorVars`
  guarantees the hue even if the overlay is hoisted.
- **Entity-console surfaces self-heal without `.trace-tab`.** `--tc-*` tokens carry
  inline fallbacks equal to the `.trace-tab` palette, so a tab that doesn't use
  `.trace-tab` (e.g. `.props-tab`) renders identically. Don't "fix" this by forcing
  `.trace-tab` onto a tab that has its own root layout.
- Keep the **restraint contract**: at most two colored elements at full intensity,
  one movement per gesture, no idle motion except the standby cursor.
