# FMT Layout System

> The universal layout system every tab section uses. It replaced the earlier ad-hoc
> distinction between `no-aside`, `aside-balanced` and `aside-wide`.
>
> **Verified against the code 2026-07-26.** Component name, prop defaults, widths and the
> tab overview below were read out of `shared/Ui/TabLayout/TabLayout.jsx` and
> `shared/DesignSystem/layout.css`, not carried over from an earlier revision.

**Implementation:** `src/components/shared/Ui/TabLayout/TabLayout.jsx`
**Styles:** `src/components/shared/DesignSystem/layout.css` (TabLayout has no CSS file of its own)

---

## Core Principle

Every section within a tab uses one of four layout types: **X, Y, Z, or W**.
The choice belongs to the section, not the tab. A tab may mix layout types
across its sections — the outer shell (rail, header) remains unchanged.

Each type has **variants** controlled via props, not via separate layout classes.

Switching between sections is an immediate state change — no transition animation.
The TraceLine in the section header provides sufficient visual feedback.

---

## The full `TabLayout` API

Read off the actual signature. Defaults shown are the real ones.

```jsx
<TabLayout
  /* Core */
  sections={[{ id, index, label, desc }, …]}
  activeSection={id}
  onSelect={fn}

  /* Layout */
  layoutMode="x"            // 'x' | 'y' | 'z' | 'w'      default: 'x'

  /* Layout X */
  controlsWidth="half"      // 'half' | 'fixed'           default: 'half'
  asideSlot={node}
  asideCaption="PREVIEW"    //                            default: 'PREVIEW'
  asideMirror={node}

  /* Layout Y */
  ghostLabel=""
  readout={[]}              // string[]

  /* Layout Z */
  groupMode="parallel"      // 'parallel' | 'exclusive'   default: 'parallel'
  secondRail={[{ id, label }, …]}
  activeGroup={id}
  onGroupSelect={fn}
  groupSlotB={node}
  headerExtra={node}
  footerExtra={node}

  /* Layout W */
  canvasToolbar={false}     //                            default: false
  topBar={node}
  toolbar={node}

  /* Shell */
  toolbarSlot={node}
  renderEyebrow={null}
  navLabel="Tab navigation"
  bootMs={2200}
>
  {children}
</TabLayout>
```

Notes on the shell props:

- **Rail pin/collapse is app-wide, not per tab.** It persists internally under a single
  `localStorage` key (`RAIL_PINNED_KEY`). There is no `railStorageKey` prop.
- `bootMs` is the one-shot boot animation delay before the rail settles.
- `toolbarSlot` renders stacked *above* the rail inside `.workspace`.

---

## Layout X — Two Columns with Aside

Controls left, visual content right. The right column is an active workspace —
no standby state, no ghost label.

**When to use:** The section has a canvas, preview panel, or visual output
that must be used simultaneously with the controls. Controls and visual
content are operationally dependent.

### X · half (default)

`controlsWidth="half"` — and since `'half'` is the default, **passing nothing gives you
this.** The name is historical: the split is *not* 50/50.

- The controls column is `flex: 1 1 auto` — it absorbs all surplus width.
- The aside is `flex: 0 0 clamp(560px, 44vw, 820px)` — it keeps a stable size.
- The whole inner is capped at `max-width: 1560px` (wider than the 1300px base cap, so
  the extra width feeds the controls column and the staircase gets more room).

```
┌──────────────────────────────────────────────────────┐
│  RAIL  │  CONTROLS (flex)      │  ASIDE (560–820px)  │
│        │                       │                      │
│  01    │  field   field        │  [Preview / Canvas]  │
│  02 ●  │  field                │  [Diagram / Readout] │
│  03    │  field   field        │                      │
└──────────────────────────────────────────────────────┘
```

**Additional rule for `half`:** Single full-width fields (preset name, texture path)
receive `max-width: ~360px` instead of `width: 100%`, so they don't stretch
disproportionately. Multi-field `form-row` grids may use the full column.

### X · fixed

`controlsWidth="fixed"` — controls pinned at 360px, aside takes the remainder.
For canvases and maps that benefit from additional width.

```
┌──────────────────────────────────────────────────────┐
│  RAIL  │  CONTROLS (360px)  │  ASIDE (remainder)      │
│        │                    │                         │
│  01    │  field             │  Canvas / Map /         │
│  02 ●  │  field             │  UV Atlas / ...         │
└──────────────────────────────────────────────────────┘
```

> **Currently used by zero tabs.** Every X-mode tab in the app runs on the `half`
> default. `fixed` is implemented and correct — it is simply unused today. Treat it as
> available, not as the norm, and don't assume a tab is `fixed` just because it shows a
> map preview.

---

## Layout Y — Single Column + Standby Field

Controls left (360px fixed), deliberate negative space right. Not empty space —
a conscious machine presence with three elements.

**When to use:** The section is purely form-based. There is no canvas
and no visual output that needs to be used simultaneously.

```
┌──────────────────────────────────────────────────────┐
│  RAIL  │  CONTROLS (360px)   │  STANDBY FIELD         │
│        │                     │                        │
│  01 ●  │  field              │  GHOST LABEL           │
│  02    │  field              │                        │
│  03    │  field              │  param · param · param │
│  04    │                     │  █ (block cursor)      │
└──────────────────────────────────────────────────────┘
```

`<TabLayout layoutMode="y" ghostLabel="…" readout={[…]} />`

**The standby field contains:**

1. **Ghost label** — section or tool name in large, heavily muted typography.
   Same visual language as the home tab background.
2. **Parameter readout** — current core values as a compact monospace status line.
   Updates live. Not a summary — a machine readout: *the system has registered
   the parameters.*
3. **Block cursor** — blinking. Signals: the machine is ready, waiting.

The standby field is posture, not information.

**`StandbyField` is not a standalone component.** It is defined inside
`TabLayout.jsx` and rendered by the Y renderer. There is no `shared/Ui/StandbyField/`
directory — an earlier revision of this document claimed there was.

The markup is reusable directly, though, and one tab does exactly that: the Adaptive Map
Helper's Export section stays on Layout W and hand-rolls a `.standby-field` /
`.standby-ghost` / `.standby-readout` block to get the same treatment (with a code
comment explaining why it doesn't switch `layoutMode`).

---

## Layout Z — Full Width with Internal Grid

Full width after the rail, no aside, no standby field. Both columns are equal
(`grid-template-columns: 1fr 1fr`, `align-items: start`) — neither is "controls",
neither is "aside". Group A carries a `border-right: 1px solid var(--line-subtle)`.

**When to use:** The section has many parameters that divide naturally into
two thematically equal groups.

### Z · parallel (default)

Both groups are complementary — they belong to the same operation. The user fills in both.

```
┌──────────────────────────────────────────────────────┐
│  RAIL  │  GROUP A            │  GROUP B               │
│  01 ●  │  field              │  [Preview / field]     │
│        │  field              │                        │
└──────────────────────────────────────────────────────┘
```

`<TabLayout layoutMode="z" groupMode="parallel" groupSlotB={…} />`

**Preview as grid cell:** the preview is a grid cell like any other, not a structural
special case. `align-items: start` keeps the right column from growing beyond the left.

### Z · exclusive

Both groups are alternative paths to the same goal — the user fills in only one.

```
┌────────┬─────────┬──────────────────────┬──────────────────────┐
│ MAIN   │ 2ND     │  GROUP A             │  GROUP B             │
│ RAIL   │ RAIL    │  (Path 1)            │  (Path 2)            │
│        │ (168px) │                      │                      │
│        │ Prop    │  field               │  field               │
│        │ Skybox  │  field               │  field               │
│        │ Texture │  field               │  field               │
└────────┴─────────┴──────────────────────┴──────────────────────┘
```

`<TabLayout layoutMode="z" groupMode="exclusive" secondRail={[…]} activeGroup={…} />`

**2nd Rail:** optional, `width: 168px`, a real full-height vertical sidepanel with its own
scroll — same tick language as `.rail-item`, without the collapse/pin mechanic. It only
renders when `groupMode === 'exclusive'` **and** `secondRail?.length > 0`.

**Dimming:** `TabLayout` dims the inactive group to `opacity: 0.4` only when
`groupMode === 'exclusive'` **and** `activeGroup` is literally `'a'` or `'b'`. That means
`secondRail` can safely be reused for an unrelated N-way selector (asset type, say)
without dimming both columns.

> **`TabLayout` does not compute reactive dimming for you.** The "no toggle — the active
> path emerges from the first input" behaviour is *not* built in. Each tab derives its own
> active side from which fields have data and applies its own dim class. `TabLayout`'s
> a/b dimming is the separate, narrower explicit-selection mechanism.

**Full-width slots:** `headerExtra` and `footerExtra` sit above/below the two-column grid
for content belonging to neither group (an auth panel, a notes+submit row).

**Scrolling:** `.layout-z` scrolls as one unit (`overflow-y: auto`) and `.layout-z-grid`
sizes to its own content. This matters — a tall `headerExtra`/`footerExtra` used to be
able to squeeze the grid to ~0px inside a hard-clipped column with no way to reach the
rest.

---

## Layout W — Full Width with Top Bar

Controls move to the top, the visual content gets full width **and** height.
No aside, no standby field.

**When to use:** The visual content is dominant enough — through interactivity
(clicking, dragging, zooming, many markers) or sheer reading size — that a
side column would constrain the workspace in both dimensions.

### W · canvas

`canvasToolbar={true}` — two horizontal bands above an interactive canvas.

```
┌──────────────────────────────────────────────────────┐
│  RAIL  │  TOP BAR (52px, one line, nowrap)           │
│        ├─────────────────────────────────────────────┤
│  01    │  CANVAS TOOLBAR (44px, docked to canvas)    │
│  02 ●  ├─────────────────────────────────────────────┤
│        │  CANVAS / MAP (full width + height)         │
└──────────────────────────────────────────────────────┘
```

**Band 1 — Top Bar (page chrome):** belongs to the page, not the canvas. Title, primary
input, status info, stat pills. Hard height limit: `height: 52px`, `white-space: nowrap`,
`overflow: hidden` — horizontal clipping over wrapping to a second line. The section
title is force-shrunk to `--text-lg` here (`.layout-w-title`).

**Band 2 — Canvas Toolbar (canvas chrome):** belongs to the canvas. `height: 44px`. View
mode tabs, tool toggles, quick-select, generate. Appears and disappears with the canvas.

### W · output

`canvasToolbar={false}` (the default) — one band above non-interactive content.

```
┌──────────────────────────────────────────────────────┐
│  RAIL  │  HEADER LINE (label · status · action)      │
│        ├─────────────────────────────────────────────┤
│  01    │  OUTPUT (full width + height)               │
│  02 ●  │  Code block / read-only content             │
└──────────────────────────────────────────────────────┘
```

**Header line:** output label / filename, optional status note (`✓ saved`), at most one
primary action (copy). No tool toggles — otherwise this is W · canvas.

**Empty state:** no output yet → centred hint block replaces the content; the header line
remains, the action is hidden until output exists.

---

## Column Width Reference

| Type | Variant | Controls / Group A | Aside / Group B |
|---|---|---|---|
| X | `half` (default) | `flex: 1 1 auto` (absorbs surplus) | `clamp(560px, 44vw, 820px)`; inner capped at 1560px |
| X | `fixed` | `360px` fixed | remainder |
| Y | — | `360px` fixed | standby field, remainder |
| Z | `parallel` / `exclusive` | `1fr` | `1fr`; `+168px` second rail in exclusive |
| W | `canvas` / `output` | full width after rail | — |

---

## Tab Overview — actual state

Read from the code on 2026-07-26. Where a tab passes no `layoutMode`/`controlsWidth`,
it gets the defaults (`x` / `half`) — that is the majority case, marked *(default)*.

| Tab | Layout | Notes |
|---|---|---|
| `Emitter/Wreckage` | X · half *(default)* | `asideSlot` = MapPreview + mirror |
| `Emitter/Props` | X · half *(default)* | `asideSlot` = MapPreview |
| `Emitter/Emitter` | X · half *(default)* | `asideSlot` = MapPreview |
| `Scenery/CustomProps` | X · half *(default)* | |
| `Scenery/RockErosion` | X · half *(default)* | `asideSlot` = previewSlot |
| `Scenery/Trees` | X · half *(default)* | `asideSlot` = previewSlot |
| `Emitter/TerrainType` | X · half *(default)* | `asideSlot` = previewSlot |
| `Textures/WaveNormals` | X · half *(explicit)* | water preview, composite / per-layer canvas |
| `Skybox/Stars` | X · half *(default)* | `asideSlot` varies per section (`asideBySection`) |
| `Skybox/SkyboxGenerator` | X · half *(default)* | `asideSlot` varies per section (`asideBySection`) |
| `MapTools/Scmap` | X · half *(default)* | |
| `MapTools/MapResizer` | X · half *(default)* | |
| `MapTools/PreviewImage` | X · half *(default)* | |
| `MapTools/BiomeChanger` | X · half *(default)* | `asideSlot` = MapPreview + collapsible legend of the queued layer changes |
| `MapTools/SymmetryChecker` | X · half *(default)* | `asideSlot` = MapPreview (deviation heatmap) + collapsible legend of per-layer verdicts |
| `System/History` | X · half *(explicit)* | `asideSlot` = diff viewer, only when an entry is selected |
| `MapTools/AdaptiveMapHelper` | **W** (all 3 sections) | `canvasToolbar` only on `canvas`; `topBar` swaps per section. Export deliberately stays on W and hand-rolls a standby field. |
| `Community/Contributions` | **Z / Y / W** (per section) | `upload` → `z` exclusive, or `y` once submitted; `download` + `leaderboard` → `w`. `secondRail` = asset type. Uses `headerExtra`/`footerExtra`/`toolbarSlot`. |
| `System/Settings` | — | exempt: self-contained settings shell, no `TabLayout` |
| `System/CliTerminal` | — | not on `TabLayout` (terminal surface, own shell) |
| `Textures/TextureEditor` | — | not on `TabLayout` (full-bleed graph canvas, TAB_UI_CONTRACT §11) |
| `Guides` | — | not wired into `tabRoutes.jsx`; the `guides` route renders a placeholder |
| `CoOp` | — | dead code, not routed (see PROJECT_STRUCTURE.md) |

**What this table says about the system:** X·half carries 16 of the 18 `TabLayout` tabs.
Y, Z and W each have exactly one consumer — Contributions for Y and Z, Adaptive Map Helper
for W. They are real, implemented and correct, but they are not yet load-bearing; a change
to any of them has a very small blast radius today.
