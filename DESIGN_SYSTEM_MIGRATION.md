# Fable5 Design System — Rollout & Cleanup Roadmap

How to take the Wreckage tab's look (the gold standard) and apply it to every
other tab, and how to refactor the old/new shared files into one clean
architecture.

Read this together with the design system itself:
`src/components/shared/design-system/` and
`src/components/shared/WorkspaceConsole/WorkspaceConsole.jsx`.

---

## 1. Current state (what exists today)

**New, canonical (use this for everything going forward):**
- `shared/design-system/tokens.css` — all design tokens as `:root` vars
  (spacing, typography, surfaces, ink, hairlines, motion, z-index) + the per-tab
  `--tab-color` / `--tab-glow` / `--tab-glow-strong` (white fallbacks).
- `shared/design-system/primitives.css` — `action-button`, `commit-button`,
  `button-solid`, `delete-button`, `field-input`/`field-select`,
  `field-label`/`field-hint`, `form-group`, `chip`, `switch`, `check-row`,
  `station` + `option-row`, `status-badge`, `tick`, `filament`, `divider`,
  `subsection-head`.
- `shared/design-system/layout.css` — `workspace`, `console-rail` + `rail-item`,
  `workspace-main`/`workspace-column`, the `section` header family,
  `preview-panel`, `workspace-ghost`, `surface-grain`.
- `shared/design-system/index.css` — single `@import` entry point.
- `shared/WorkspaceConsole/WorkspaceConsole.jsx` — the reusable rail + column +
  preview shell. Props: `sections`, `activeSection`, `onSelect`, `children`,
  `previewSlot`, `mirrorSlot`, `ghostLabel`, `renderEyebrow`, `railStorageKey`,
  `navLabel`, `bootMs`.

**Reference implementation:** `tabs/Emitter/WreckageTab/Wreckage.jsx` + `Wreckage.css`
(now feature-only: canvas, legend, unit card, color picker, library overlay).

**Legacy (to be retired):**
- `shared/trace.css` — the OLD primitive/shell system (`.trace-*`, `.btn-action`,
  `.btn-ghost-trace`, etc.). **Now imported by Wreckage only**, and only its
  legacy modals still reference `.trace-*` classes. No other tab depends on it.
- `shared/shared.css` — still imported widely (15 files). Mixed bag: some still-used
  generic helpers (`checkbox`, `checkbox-label`, `help-btn`, `help-modal*`) plus
  older styles. Keep for now; audit later (§5).

**Migration targets (each has its own bespoke CSS, not yet on the system):**
`Config/SettingsTab` (has its own `stc-` console), `Tools/ScmapTab`,
`Tools/MapResizerTab`, `Tools/AdaptiveMapHelperTab`, `Generator`, `Skybox`,
`Co-Op`, `Community`, `Guides`, and the `HelpModals`.

---

## 2. How to convert ONE tab (the repeatable recipe)

Do this per tab. Wreckage is the worked example to copy from.

1. **Import the system** in the tab's entry component:
   ```jsx
   import WorkspaceConsole from '../../../shared/WorkspaceConsole/WorkspaceConsole.jsx';
   // (WorkspaceConsole already imports design-system/index.css)
   ```
   If a tab is NOT a rail/column/preview layout, import the CSS directly instead:
   `import '../../../shared/design-system/index.css';`

2. **Theme it with ONE variable.** On the tab root element set the accent:
   ```jsx
   <div className="<feature>-tab" style={{
     '--tab-color':        'var(--scmap-color)',
     '--tab-glow':         'var(--scmap-glow)',
     '--tab-glow-strong':  'var(--scmap-glow-strong)',
   }}>
   ```
   Define the literal color once in `src/components/modals/root.css` next to
   `--wreckages-color` (e.g. `--scmap-color: #FFFA00;`). Everything recolors —
   the system references `var(--tab-color)` directly, which inherits down.

3. **Compose the layout** with `<WorkspaceConsole>`: build the `sections`
   array (`{ id, index, label, desc, count?, done?, locked? }`), pass
   `previewSlot` / `mirrorSlot` if the tab has a preview, set `ghostLabel` and a
   `renderEyebrow`, and give a unique `railStorageKey`.

4. **Swap controls to the shared primitive classes.** Map the tab's old classes:
   | old / bespoke | new |
   |---|---|
   | text/number input | `field-input` (+ `field-input--sm`) |
   | select | `field-select` |
   | field label | `field-label` |
   | sublabel / hint | `field-hint` |
   | label+control wrapper | `form-group` |
   | secondary button | `action-button` (+ `--full` / `--danger`) |
   | filled CTA | `button-solid` (+ `--accent` / `--full`) |
   | primary commit | `commit-button` (+ `-label/-status/-bloom/-line`) |
   | delete glyph | `delete-button` |
   | radio/mode tile | `station option-row` (+ `option-row-head/-label/-desc/-note`) |
   | checkbox row | `check-row` / `check-box` / `check-tick` / `check-label` |
   | toggle pill | `chip` (+ `.active`) |
   | on/off switch | `switch` / `switch-pole` (+ `.on`) |
   | status pill | `status-badge` (+ `--ok/--warn/--err/--accent`) |
   | rule | `divider` |
   | in-content header | `subsection-head` / `subsection-head-title` |

5. **Keep ONLY feature-specific CSS** in the tab's own stylesheet, and write it
   with tokens (`var(--space-md)`, `var(--ink-55)`, `var(--tab-color)` …) — never
   hardcoded px/hex/easings. Delete everything the shared system now provides.

6. **Verify:** `npx esbuild <tab>.jsx --bundle --outdir=... --loader:.js=jsx`
   then `npm run electron:dev` and eyeball parity + accent recolor.

---

## 3. Per-tab rollout checklist

Order by value/risk (start with the tabs most like Wreckage):

- [ ] **ScmapTab** — already sets `--tab-color`; convert controls + layout.
- [ ] **MapResizerTab** — has `--tab-color` in its CSS; migrate.
- [ ] **AdaptiveMapHelperTab** — has `--tab-color`; migrate.
- [ ] **SettingsTab** — currently its own `stc-` console. Decide: fold the
      `stc-rail` into `WorkspaceConsole` (preferred — one shell) or keep bespoke.
      This is the biggest single refactor; do it deliberately.
- [ ] **GeneratorTab**, **SkyboxTab**, **Co-Op**, **Community**, **Guides** —
      convert as each is touched.
- [ ] **HelpModals** — they already set `--tab-color` inline; point them at the
      shared primitives (`field-*`, `action-button`, `status-badge`) and drop
      their local copies.

For each: tick when (a) imports the system, (b) sets `--tab-color`, (c) controls
use shared classes, (d) tab CSS is feature-only + tokenized, (e) visually verified.

---

## 4. Retire `trace.css` (after Wreckage's modals migrate)

`trace.css` is now effectively Wreckage-only. To remove it cleanly:

1. In `Wreckage.jsx`, migrate the two remaining legacy overlays — the
   **Emitter-Category config modal** and the **blueprint library sidebar** — off
   `.trace-*`/`.btn-action` onto shared primitives:
   - `trace-section-title` → a `section-title`-like heading or `subsection-head-title`
   - `trace-sublabel` → `field-hint`
   - `trace-item` → a static card (introduce a non-interactive `panel` primitive
     if needed — see §6)
   - `trace-badge` → `status-badge`
   - `btn-action` → `button-solid`
   - `trace-subsection` (Coordinates collapse header) → `subsection-head` or a new
     `collapse-header` primitive
   - `trace-section-head` (units toolbar row) → a `toolbar` primitive (see §6)
2. Remove `import './trace.css'` from `Wreckage.jsx`.
3. Confirm `grep -rl trace.css src` and `grep -rlE 'trace-(tab|item|...)' src` are
   empty, then **delete `shared/trace.css`**.

---

## 5. Audit & split `shared.css`

`shared.css` (imported by ~15 files) mixes genuinely-shared helpers with stale
styles. Plan:

1. Inventory which classes are still referenced (`checkbox*`, `help-btn`,
   `help-modal*` are; many are likely dead).
2. Move the truly generic, still-used pieces into the design system:
   - checkbox → already have `check-row`; reconcile `checkbox`/`checkbox-label`
     into one primitive and update consumers.
   - `help-modal*` / `help-btn` → a `shared/design-system/overlay.css` (new file)
     for modal/overlay chrome.
3. Delete dead rules; keep `shared.css` only for anything not yet classified.
4. Long-term goal: `shared.css` shrinks to near-zero; design-system is the source
   of truth.

---

## 6. Primitives still missing from the system (add as needed)

These appear in the legacy code but aren't in `primitives.css` yet. Add them
(token-driven, accent via `var(--tab-color)`) before/while migrating the tabs
that need them:

- **`panel`** — a static (non-interactive) bordered card surface. Needed to
  replace `trace-item` used as a read-only list item.
- **`toolbar`** — a horizontal action row with a baseline filament (replaces
  `trace-section-head` used as a button strip).
- **`collapse-header`** — the click-to-expand subsection header with leading tick
  + trailing hairline (replaces `trace-subsection`).
- **`overlay` / `modal`** — modal scrim + dialog chrome (currently `help-modal*`
  in `shared.css`, and ad-hoc inline styles in Wreckage's category modal).
- **`empty-state`** — currently `wr-empty-state`, generalize.
- **`tag` / token chips** — small inline labels (currently inline-styled).

When you add one, document it in the `primitives.css` header contents list.

---

## 7. Definition of done (clean architecture)

- [ ] Every tab imports `design-system/index.css` (directly or via `WorkspaceConsole`).
- [ ] Every tab sets only `--tab-color` (+ glows) for theming; no per-tab color
      logic anywhere else.
- [ ] No tab defines its own button/input/typography/spacing system — only
      feature-specific visuals remain in per-tab CSS, written with tokens.
- [ ] `trace.css` deleted; `shared.css` reduced to (or folded into) the system.
- [ ] No hardcoded px/hex/easings outside `tokens.css` (grep audits clean).
- [ ] One shell component (`WorkspaceConsole`) powers all rail/column/preview tabs.
- [ ] `DESIGN_SYSTEM_MIGRATION.md` checklists all ticked; this file can be deleted.

---

## Notes / gotchas

- **Never reintroduce a `:root`-level `--accent: var(--tab-color)` alias.** A custom
  property whose value is `var(--tab-color)` is resolved where it's *declared*; at
  `:root` it bakes the white fallback and inherits white everywhere, ignoring a
  tab's later override. Always reference `var(--tab-color)` **directly** in rules
  (it's a normally-inherited property, so a tab root's color flows down intact).
  This is why composite tokens like the old `--glow-tick` were inlined.
- A few **dead layout blocks** may still linger in `Wreckage.css` and other tab
  CSS from earlier iterations — safe to delete once confirmed unused in JSX
  (`grep -oE '(wr-)[a-z-]+' Wreckage.jsx`).
- Keep the **restraint contract**: max two colored elements at full intensity, one
  movement per gesture, no idle motion except the standby cursor.
