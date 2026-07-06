# FMT Layout System

> Introduced as part of the UI Unification (see UI_UNIFICATION_ROADMAP.md).
> This document defines the universal layout system used by all tabs and
> sections in FMT. It replaces the previous ad-hoc distinction between
> `no-aside`, `aside-balanced`, and `aside-wide`.

---

## Core Principle

Every section within a tab uses one of four layout types: **X, Y, Z, or W**.
The choice belongs to the section, not the tab. A tab may mix layout types
across its sections — the outer shell (Rail, WorkspaceConsole) remains unchanged.

Each type has **variants** controlled via props — not separate layout classes.
Variants are documented with ASCII diagrams and prop notation in each section below.

**The controls column has the same defined width across X and Y.**
Width is a function of the layout type, not the window size.
This creates consistent visual anchoring across all sections and tabs.

Switching between sections is an immediate state change — no transition animation.
The TraceLine in the section header provides sufficient visual feedback.

---

## Layout X — Two Columns with Aside

Controls left, visual content right. The right column is an active workspace —
no standby state, no ghost label.

**When to use:** The section has a canvas, preview panel, or visual output
that must be used simultaneously with the controls. Controls and visual
content are operationally dependent.

### X · fixed (default)

Controls fixed at ~360px, aside takes the rest. For canvases and maps
that benefit from additional width.

```
┌──────────────────────────────────────────────────────┐
│  RAIL  │  CONTROLS (~360px)  │  VISUAL CONTENT        │
│        │                     │                        │
│  01    │  field              │  Canvas / Preview /    │
│  02 ●  │  field              │  Map / UV Atlas /      │
│  03    │  field              │  Diff Viewer / ...     │
│  04    │                     │                        │
└──────────────────────────────────────────────────────┘
```

`<WorkspaceConsole layoutMode="x" controlsWidth="fixed" />`

### X · half

Controls 50%, aside 50%. For readouts composed of discrete units
(diagrams, lists, live values) that work equally well at 50% as at 65% —
an asymmetric split would be wasted space.

```
┌──────────────────────────────────────────────────────┐
│  RAIL  │  CONTROLS (50%)     │  VISUAL CONTENT (50%)  │
│        │                     │                        │
│  01    │  field   field      │  [Diagram / Readout]   │
│  02 ●  │  field              │  [Diagram / Readout]   │
│  03    │  field   field      │  [Diagram / Readout]   │
└──────────────────────────────────────────────────────┘
```

`<WorkspaceConsole layoutMode="x" controlsWidth="half" />`

**Additional rule for `half`:** Single full-width fields (e.g. preset name,
texture path) receive `max-width: ~360px` instead of `width: 100%` to prevent
them from stretching disproportionately. Multi-field `form-row` grids may use
the full 50% — they benefit from the extra spacing.

**Examples:**
- WreckageTab / PropsTab / EmitterTab / RockErosionTab / TreesTab → X · fixed (MapPreview)
- StarsTab → UV Texture, Exclusion Zones → X · half (canvas)
- SkyboxGeneratorTab → Cirrus → X · half (live readout)
- CustomPropsTab → Props → X · half (visualisation / summary)
- ScmapTab → X · half (pack + unpack equally weighted)
- MapResizerTab → X · half (what to scale + scale parameters)
- HistoryTab → X · half (snapshots + diff viewer)

---

## Layout Y — Single Column + Standby Field

Controls left, deliberate negative space right. Not empty space —
a conscious machine presence with three elements.

**When to use:** The section is purely form-based. There is no canvas
and no visual output that needs to be used simultaneously.

```
┌──────────────────────────────────────────────────────┐
│  RAIL  │  CONTROLS (~360px)  │  STANDBY FIELD        │
│        │                     │                        │
│  01 ●  │  field              │  GHOST LABEL           │
│  02    │  field              │                        │
│  03    │  field              │  param · param · param │
│  04    │                     │  █ (block cursor)      │
└──────────────────────────────────────────────────────┘
```

`<WorkspaceConsole layoutMode="y" ghostLabel="…" readout={[…]} />`

**The standby field contains:**

1. **Ghost label** — section or tool name in large, heavily muted typography.
   Same visual language as the home tab background.

2. **Parameter readout** — current core values of the section as a compact
   monospace status line. Updates live as the user interacts with the controls.
   Not a summary — a machine readout: *the system has registered the parameters.*

3. **Block cursor** — blinking. Signals: the machine is ready, waiting.

The standby field is posture, not information. The machine is on, attentive, waiting.

**Component:** `<StandbyField ghostLabel={…} readout={[…]} cursorVisible />`
lives in `shared/ui/StandbyField/`. Tab-independent — content is tab-specific,
formatting is uniform.

**Examples:**
- StarsTab → Configuration: `50 STARS · 10 CLUSTERS · GAUSSIAN`
- StarsTab → Export: `MAP_NAME.v0001 · JSON OFF · README ON`
- CustomPropsTab → ADD-Props: summary of all current entries
- RockErosionTab / TreesTab / MapResizerTab → all sections

---

## Layout Z — Full Width with Internal Grid

Full width after the rail, no aside, no standby field. Both columns
are equal — neither is "controls", neither is "aside".

**When to use:** The section has many parameters that divide naturally into
two thematically equal groups. No interactive canvas — but possibly a
non-interactive preview as a grid cell.

### Z · parallel (default)

Both groups are complementary — they belong to the same operation.
The user fills in both.

```
┌──────────────────────────────────────────────────────┐
│  RAIL  │  GROUP A            │  GROUP B               │
│        │                     │                        │
│  01 ●  │  field              │  [Preview / field]     │
│        │  field              │                        │
│        ├─────────────────────┼────────────────────────┤
│        │  field              │  field                 │
│        │  field              │  field                 │
└──────────────────────────────────────────────────────┘
```

`<WorkspaceConsole layoutMode="z" groupMode="parallel" />`

**Preview as grid cell:** The preview is a grid cell like any other —
not a structural special case. The right column receives `align-self: start`
so it does not grow beyond the left column.

### Z · exclusive

Both groups are alternative paths to the same goal — the user fills in
only one. No toggle or switcher — the active path emerges from the first
input (reactive dimming).

```
┌────────┬─────────┬──────────────────────┬──────────────────────┐
│ MAIN   │ 2ND     │  GROUP A             │  GROUP B             │
│ RAIL   │ RAIL    │  (Path 1)            │  (Path 2)            │
│        │         │                      │                      │
│        │ Prop    │  field               │  field               │
│        │ Skybox  │  field               │  field               │
│        │ Texture │  field               │  field               │
└────────┴─────────┴──────────────────────┴──────────────────────┘
```

`<WorkspaceConsole layoutMode="z" groupMode="exclusive" secondRail={[…]} />`

**2nd Rail:** Optional. Determines which fields are shown per group
(e.g. asset type: Prop / Skybox / Texture / Emitter). Rail count is
orthogonal to `groupMode` — both are independently composable.

**Reactive dimming:** When the user begins interacting with Group A,
Group B dims to ~40% opacity — and vice versa. The dimmed group remains
interactive (not `disabled`), but is clearly marked as the inactive path.
Resets to full opacity when the active group is cleared entirely.

**Why not a toggle instead:** No extra click required, no hidden state
to remember, no form reset when switching paths. The active path is
always the brighter one.

**Examples:**
- SkyboxGeneratorTab → Atmosphere: Sky Colors + Geometry + Decals + Preview → Z · parallel
- PreviewImageTab → Mapconfig (left) + Preview (right, `align-self: start`) → Z · parallel
- ContributionsTab → Upload: Single Prop vs. Merged Folder, 2nd Rail (Asset-Type) → Z · exclusive

---

## Layout W — Full Width with Top Bar

Controls move to the top, the visual content gets full width **and** height.
No aside, no standby field.

**When to use:** The visual content is dominant enough — through interactivity
(clicking, dragging, zooming, many markers) or sheer reading size — that a
side column would constrain the workspace in both dimensions.

### W · canvas (default)

Two horizontal bands above an interactive canvas.

```
┌──────────────────────────────────────────────────────┐
│  RAIL  │  TOP BAR (full width, fixed 1 line)         │
│        ├─────────────────────────────────────────────┤
│  01    │  CANVAS TOOLBAR (docked to canvas)          │
│  02 ●  ├─────────────────────────────────────────────┤
│        │                                             │
│        │  CANVAS / MAP (full width + height)         │
│        │                                             │
└──────────────────────────────────────────────────────┘
```

`<WorkspaceConsole layoutMode="w" canvasToolbar={true} />`

**Band 1 — Top Bar (page chrome):** Belongs to the page, not the canvas.
Title, primary input (map name), status info, stat pills. Hard height limit:
exactly one line, no vertical growth. `flex-wrap: nowrap` — horizontal scroll
over wrapping to a second line.

**Band 2 — Canvas Toolbar (canvas chrome):** Belongs to the canvas, not the
page. View mode tabs, tool toggles, quick-select, generate button. Appears
and disappears with the canvas — hidden when canvas content is not yet loaded.

### W · output

One band above the content — no canvas toolbar, because the content
is not interactive (no clicking, dragging, zooming).

```
┌──────────────────────────────────────────────────────┐
│  RAIL  │  HEADER LINE (label · status · action)      │
│        ├─────────────────────────────────────────────┤
│  01    │                                             │
│  02 ●  │  OUTPUT (full width + height)               │
│        │  Code block / read-only content             │
│        │                                             │
└──────────────────────────────────────────────────────┘
```

`<WorkspaceConsole layoutMode="w" canvasToolbar={false} />`

**Header line:** Output label / filename, optional status note (`✓ saved`),
at most one primary action (copy button). No tool toggles — otherwise this
becomes W · canvas.

**Empty state:** No output yet → centred hint block (icon + explanation of
what to do) replaces the content. Header line remains; action button is
hidden until output exists.

**Examples:**
- AdaptiveMapHelperTab → CANVAS: Top Bar (map name, stat pills) + Canvas Toolbar
  (view tabs, mirror, quick army, generate) + MapCanvas → W · canvas
- AdaptiveMapHelperTab → TABLES: Header (`tables.lua · options.lua · script.lua`)
  + code output → W · output

---

## Column Width Reference

| Type | Variant | Structure | Width |
|---|---|---|---|
| X | fixed | Controls + Aside | Controls ~360px fixed, Aside: remainder |
| X | half | Controls + Aside | Controls 50%, Aside 50% |
| Y | — | Controls + Standby | Controls ~360px fixed, Standby: remainder |
| Z | parallel / exclusive | Internal grid | Full width after rail, 50% / 50% |
| W | canvas / output | Top bar + content | Full width after rail |

---

## Tab Overview

| Tab | Section | Layout | Variant | Content |
|---|---|---|---|---|
| WreckageTab | all | X | fixed | MapPreview + Mirror |
| PropsTab | all | X | fixed | MapPreview |
| EmitterTab | all | X | fixed | MapPreview |
| RockErosionTab | all | X | fixed | MapPreview |
| TreesTab | all | X | fixed | MapPreview |
| StarsTab | Configuration | Y | — | Standby: star parameters |
| StarsTab | UV Texture | X | half | UV atlas canvas |
| StarsTab | Exclusion Zones | X | half | Exclusion canvas |
| StarsTab | Export | Y | — | Standby: export status |
| SkyboxGeneratorTab | Atmosphere | Z | parallel | Sky Colors · Geometry · Decals · Preview |
| SkyboxGeneratorTab | Cirrus | X | half | Cirrus setup + live readout |
| CustomPropsTab | Props | X | half | Config + visualisation / summary |
| CustomPropsTab | ADD-Props | Y | — | Standby: summary of all entries |
| ScmapTab | all | X | half | Pack + Unpack equally weighted |
| MapResizerTab | all | X | half | What to scale + scale parameters |
| AdaptiveMapHelperTab | CANVAS | W | canvas | Top Bar + MapCanvas |
| AdaptiveMapHelperTab | TABLES | W | output | Header + code output |
| PreviewImageTab | all | Z | parallel | Mapconfig + Preview (`align-self: start`) |
| HistoryTab | all | X | half | Snapshots + Diff Viewer |
| ContributionsTab | all | Z | exclusive | Single vs. Merged upload, 2nd Rail (Asset-Type) |
| SettingsTab | — | — | — | Exempt from this system — self-contained settings shell with its own internal layout. No WorkspaceConsole. |

---

## Relation to the Roadmap

This document replaces Steps 2 and 3c of UI_UNIFICATION_ROADMAP:

- `aside-balanced` / `aside-wide` → **Layout X** (`controlsWidth: fixed | half`)
- `no-aside` → **Layout Y** (standby field replaces empty space)
- Internal grid → **Layout Z** (`groupMode: parallel | exclusive`)
- Full-width canvas / output → **Layout W** (`canvasToolbar: true | false`)

**WorkspaceConsole target API:**
```jsx
<WorkspaceConsole
  layoutMode="x"           // 'x' | 'y' | 'z' | 'w'
  controlsWidth="fixed"    // X only: 'fixed' | 'half'
  groupMode="parallel"     // Z only: 'parallel' | 'exclusive'
  secondRail={[…]}         // Z · exclusive only, optional
  canvasToolbar={true}     // W only: true | false
  ghostLabel="STARS"       // Y only
  readout={['50 STARS']}   // Y only
/>
```

**`StandbyField` component:** lives in `shared/ui/StandbyField/`.
Tab-independent. Props: `ghostLabel`, `readout: string[]`, `cursorVisible`.
