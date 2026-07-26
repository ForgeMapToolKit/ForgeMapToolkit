# TAB UI CONTRACT
## ForgeMapToolkit — the binding UI rules for tab surfaces

*Established 2026-06 as `TAB_DESIGN_LAW.md`. Revised 2026-06-24 to match the shipped
build; concrete class/token names refreshed 2026-07-08; §11 added 2026-07-25; compliance
re-measured and renamed to `TAB_UI_CONTRACT.md` 2026-07-26; §12 added 2026-07-26
(see Changelog).*

*This document is binding. Deviations require justification — but it follows the build, not the other way around: when the implementation is provably smarter than a rule here, the rule is corrected, not the build.*

> **The pair.** `TAB_CONTRACT.md` and this document are two halves of the same contract
> for building a tab:
>
> | | Governs |
> |---|---|
> | **`TAB_CONTRACT.md`** | everything that is *not* visual — file structure, state and persistence, props bundles, shared building blocks, IPC security, definition of done |
> | **`TAB_UI_CONTRACT.md`** (this) | everything visual — loudness, staircase, blocks, lines, trace, disclosure, color roles, space, rail, graph canvas, 3D viewport |
>
> A third document sits above both: `UI_PHILOSOPHY.md` explains *why* these rules exist
> and is where you go when a new case has no rule yet. Where philosophy and this document
> disagree, **this document wins.**

## Scope & current compliance

The rules below apply to **every** tab surface. They are not scoped to a subset of tabs —
what varies is how far each tab has been brought into line.

Compliance is measured mechanically by `npm run lint:design`
(`scripts/design-lint.mjs`), which enforces this document's §4/§5/§7 as four checks:

| Check | Meaning | Fails the run? |
|---|---|---|
| **ORPHAN** | a class used in JSX that no stylesheet defines — typo, or a leftover from a deleted rule; the element renders unstyled | yes (exit 1) |
| **FOREIGN** | a class defined only in *another* tab's stylesheet — works today, breaks when that tab is touched, and means one tab wears another's identity | yes (exit 1) |
| **BOXED** | §5 violation: neutral surface *and* neutral border at once, or four generic neutral sides | no — §5 sanctions functional boxes |
| **LITERAL** | raw hex/`rgba()` where a token exists; reported as a per-file count | no — §7 Role 2 data colors are a legitimate exception |

**Measured 2026-07-26 — `orphan 207 · foreign 1 · boxed 270 · 43 files with literals`.**

*The two BOXED added since the previous measurement are the 3D Viewer's viewport frame
and drop target — both sanctioned outlines (§12, §5), not regressions.*

Where it sits, worst first:

| Area | orphan | boxed | Note |
|---|---|---|---|
| `tabs/HelpModals/` (13 files) | ~180 | 0 | the single largest block — legacy help modals, not on `HelpPanel` (TAB_CONTRACT §7) |
| `shared/` | 10 | 78 | shared surface; every fix here pays out across all tabs |
| `Scenery/CustomProps` | 5 | 49 | the least-compliant live tab |
| `Community/Guides/GuideSection.css` | 0 | 53 | v2, not yet routed — expected |
| `Community/Contributions` | 7 | 14 | |
| `MapTools/AdaptiveMapHelper` | 0 | 19 | |
| `System/History` | 0 | 12 | |
| `System/Settings` | 0 | 11 | own shell, exempt from `TabLayout` but not from this contract |
| `CoOp/CoOp.css` | 0 | 9 | dead code (PROJECT_STRUCTURE.md) |
| `Emitter/{Wreckage,Props,Emitter}` | 0–7 | 2 each | the cleanest live tabs |
| `Emitter/TerrainType`, `Scenery/{RockErosion,Trees}`, `Textures/{TextureEditor,WaveNormals}`, `MapTools/{Scmap,BiomeChanger,FloatingTrees}`, `System/CliTerminal` | 0 | 0 | fully clean |

Read the table as a work queue, not a verdict. The two hard failures (ORPHAN, FOREIGN)
concentrate almost entirely in `HelpModals/`; migrating a tab to `HelpPanel` clears its
block in one move.

---

## § 0 — THE DEVISE

> **As minimal as possible. As many features as possible.**

Every design decision is measured against this. A feature that cannot be presented without creating visual noise must be hidden, disclosed progressively, or reconsidered. Clarity is not a style preference — it is the primary function of the interface.

This devise is a *bias*, not an arbiter. It does not resolve hard conflicts on its own; it tilts every undecided call toward restraint. Where minimalism and feature-density genuinely collide, the conflict is settled by the specific rules below (§5 boxes, §6 disclosure, §8 space), not by the slogan.

---

## § 1 — THE THREE LOUDNESS LEVELS

Humans comfortably **scan** three levels of importance at once. At four or more presented *simultaneously*, scanning degrades into conscious interpretation. The rule is therefore about **simultaneity, not total count**: a fourth tier discovered *later* (behind disclosure) is fine; a fourth tier competing *on the same screen* is not.

| Level | Name | Role | Ink | Usage |
|-------|------|------|-----|-------|
| 1 | **Laut** | Primary action / central input | `--ink-92` + full weight | Max 1–2 per block |
| 2 | **Normal** | Standard interaction | `--ink-55` – `--ink-72` | Regular inputs, secondary buttons |
| 3 | **Leise** | Helper / rarely needed | `--ink-22` – `--ink-28` | Library buttons, add-ons, meta info |

**Law:** Never present a fourth loudness level *at the same time* as the other three. Disclosure (§6) may reveal an additional level on demand — that is sequential, not simultaneous, and does not count against this rule.

---

## § 2 — THE STAIRCASE

Every tab section uses a positional hierarchy across three readable levels. The four dimensions are **not** redundant — they are deliberately split into two independent reading channels:

```
CONFIGURATION                    ← Title:    large,   NEUTRAL ink, bold   (orientation channel)
   MAPINFOS                      ← Subtitle: smaller, --tab-color, bold   (content channel)
      mapname input...           ← Content:  compact, --ink-55–72, regular
```

### Size and color are decoupled on purpose

The largest element (Title) is **neutral**. The colored element (Subtitle) is **smaller**. Size and color point in *opposite* directions, and this is the system's core trick, not a flaw:

- **Size carries the orientation hierarchy** — "where am I, what is the structural top of this block."
- **Color (`--tab-color`) carries the content hierarchy** — "what do I actually read and act on."

Because the two channels are independent, the staircase encodes two things at once (structure *and* content focus) instead of shouting one thing four times. Never make the Title both largest *and* colored — that collapses the two channels back into one and wastes the contrast.

### The four dimensions — by actual weight in practice

1. **Color** *(primary)* — Subtitle uses `--tab-color`; Title and Content stay neutral ink. This is the strongest, most reliable cue.
2. **Size** *(primary)* — Title largest, Subtitle medium, Content smallest. Runs *counter* to color (see above).
3. **Weight** *(supporting)* — Title bold, Subtitle bold, Content regular/medium.
4. **Position / indentation** *(optional, weakest)* — content may step right of its Subtitle to reinforce grouping. In practice this is the *least* used dimension and is intentionally subtle: keep indentation shallow so the left edge stays scannable. Do not lean on position to carry hierarchy that color and size already carry.

### Title vs. Subtitle

- **Title** ("Configuration") = orientation. It confirms where the user is in the rail context. Already communicated by the active siderail item — the Title in the content area is confirmation, not primary navigation. It earns its size by anchoring the orientation channel, *not* by demanding attention (it stays neutral for exactly this reason).
- **Subtitle** ("Mapinfos", "Emitter") = content heading. This is what the user actually reads when scanning a block. It is the dominant *readable* element within the controls column — dominant by color, not by size.
- **When a section has only one block:** Title (orientation) + one Subtitle (content heading). Not redundant — they sit on different channels.

> **Removed 2026-06-24 — The Ghost (Level 0).** The near-invisible ghost index (`rgba(255,255,255,0.025)` "01"/"02") was decorative justification with no signal to the user, contradicting "no decoration without cause" (Philosophy §5). It has been dropped from the system. The Title no longer needs the Ghost to "earn" its size — the decoupled size/color model (above) already explains why a large neutral Title does not compete with a smaller colored Subtitle.

---

## § 3 — BLOCKS

A section is divided into **blocks**. Each block has one Subtitle and its associated content.

### Block rules

- Blocks are **equal in visual weight** by default. No block is more prominent than another by size or color — they are differentiated by their Subtitle label and their position in the flow. This is appropriate when a section is composed of *peer* building blocks that together form a whole. If a section genuinely has one dominant action, that is expressed through loudness *within* the block (§1), not by making the whole block louder.
- Blocks are separated by **significant negative space** — not by dividers, lines, or decorative separators. The gap IS the separator. This relies on the gap staying large enough to read as separation; if density ever compresses gaps to the point of ambiguity, split into rail steps (§9) rather than reaching for a divider.
- Within a block, content sits with its Subtitle — spatial proximity communicates grouping (§2 position dimension, used sparingly).
- **Max 2–3 blocks per section.** More than that signals the section should be split into multiple rail steps.

### Block content order

Within every block, the reading order is fixed:

1. **What the user needs to confirm / set** (Laut inputs) — top
2. **What the user regularly adjusts** (Normal inputs / controls) — middle
3. **Helper actions and rarely-needed features** (Leise) — bottom

This order is never reversed.

---

## § 4 — THE LINE LAW

The horizontal line problem is the primary failure mode of the previous system. Every horizontal line must justify its existence. The fix was never "fewer lines" — it is **intentional lines with clear tiers**. The previous failure was inflationary, equal-weight use, not the line as such.

### Three permitted line tiers

| Tier | Name | Use | Weight |
|------|------|-----|--------|
| T1 | Structural | Max 1 per block. Marks a major boundary. No `--tab-color` glow. | `--line-soft` to `--line-medium` |
| T2 | Functional | Field input baselines. **Always present at rest, even on empty fields** (see §5). | `rgba(255,255,255,0.09)` |
| T3 | Accent | Exactly one per section. Always the Primary Button TraceLine (`.commit-button`). | `--tab-color` with bloom |

### Forbidden

- `divider` component inside section content (only permitted at shell level)
- `border-bottom` on check-rows, list items, or repeated elements
- `.subsection-head` with full-width `border-bottom` — replaced by `.ctrl-subtitle` (staircase). Note: `.subsection-head` still physically exists in `primitives.css` but is unused by the gold-standard tabs (Wreckage/Props/Emitter use `.trace-subsection` for collapsible in-card headers instead, which is the vertical-tick form, not the forbidden full-width-border form) — don't copy it into a new tab.
- More than one T3 accent line per section
- Any element that creates a horizontal line through the full column width except T1 and T3

### The vertical alternative — used sparingly

Before placing any horizontal line, ask: *can this be a vertical element instead?*
A left accent bar on a Subtitle is vertical. A left border on a Notesfield is vertical. A tick on a siderail item is vertical. Vertical elements cannot stack into horizontal noise.

**But the vertical alternative is itself rationed.** Banning horizontal lines only to coat every element in a vertical accent bar trades one monoculture for another ("vertical bar soup"). Vertical hairlines/ticks appear at **one or two deliberate places per screen** — typically the Subtitle tick and one structural edge — never as a default decoration on every element. The Subtitle tick is *the* recurring vertical marker; do not add competing verticals beside it.

---

## § 5 — THE TRACE PRINCIPLE (refined)

The original principle — "no element encloses itself in a border" — is **true for most controls, but not absolute**. The real rule is: **a box must be made of something meaningful, not generic.** Boxes are not banned; *generic, identity-less* boxes are.

### The button hierarchy

Buttons are the primary design challenge. The system uses four distinct levels — dosed deliberately, never all at once. Actual classes (`Shared/DesignSystem/primitives.css §5`):

| Level | Name | Form | Class | When |
|-------|------|------|------|------|
| 1 | **Primary** | TraceLine — no box, no fill. The glowing baseline IS the button. | `commit-button` (always via `OutputChecklist`) | One per section. Generate, Commit, Export. |
| 2 | **Secondary CTA** | `border: 1px solid var(--tab-color)`, no fill. | `ctrl-btn-library` | When the user would genuinely miss it without a clear signal. Library, major overlays. |
| 3 | **Normal** | Text + stub-line that grows on hover. No box, no fill. | `ctrl-btn-add` | Add, standard actions. |
| 4 | **Leise** | Bare text, minimal hover reveal. | `ctrl-btn-meta` (metadata), `ctrl-btn-delete` (destructive glyph), `ctrl-btn-danger` (labelled destructive), `ctrl-btn-close` (dismiss) | Rare helpers, destructive actions in context. |

### The key distinction: noise vs. signal

A `border: 1px solid rgba(255,255,255,0.18)` is noise — a generic rectangle.
A `border: 1px solid var(--tab-color)` is a signal — the same color as the Subtitle (`.ctrl-subtitle`), the Rail, the TraceLine (`.commit-button`). The box is not a container, it is a carrier of tab identity.

**The footer READ MORE button is the reference implementation.** Colored border, no fill, dosiert — one per card, only where the user would otherwise be uncertain.

### Dosage law

A Secondary CTA box appears at most **once per block**. If two actions in the same block both need boxes, one of them is mis-categorized — demote it to Normal or Leise.

### Inputs: text riding on a baseline — with an unconditional resting line

- An input is not a bordered field — it is text riding on a baseline (a T2 functional line, §4).
- **The baseline is always present, including when the field is empty.** This is the resolution to the empty-field affordance gap: an empty input must never be bare placeholder text floating with no line under it, because that is visually indistinguishable from a label and does not signal "you can type here." The T2 line under the field — faint at rest, `--tab-color` on focus — *is* the affordance. Placeholder text sits above an always-visible line.
- Affordance is carried by **consistency plus the resting baseline**, not by a box: once every input in the tool reads as "value (or placeholder) on a line," the user learns the form fast. The resting line is what makes that pattern legible from the very first empty field.
- A toggle is not a bordered pill *for decoration* — but a toggle **may carry a box/track** where the box is the control's mechanism (a pole on a track, a filled state). Functional boxes that *are* the control are signal, not noise.
- A select is a field with a chevron, not a generic dropdown rectangle.

### Content containers: one surface or one edge

Unit cards, code blocks, note areas, upload zones, preview panels. These contain data and must communicate grouping. Permitted:

- A subtle background surface: `rgba(255,255,255,0.022)` — no border needed
- OR one accent edge (top or left): `1px solid rgba(255,255,255,0.07)`
- OR, where the container carries **data color** (§7, e.g. a unit card), a single edge/border in that unit's data color — this is signal, not generic chrome
- **Never both** a neutral surface and a neutral border simultaneously
- **Never** all four sides in a generic neutral tone

---

## § 6 — PROGRESSIVE DISCLOSURE

If a user does not need to see something in the normal workflow, it should not demand visual attention. Disclosure is not about hiding state to look clean — it is about replacing a jungle of always-visible features with a clear guided line and deliberate "exits" only where the user actually needs one.

### Decision test

Ask: *does a user who knows this tool well need this visible right now?*

- If **yes** → show it, assign appropriate loudness level
- If **rarely** → make it Leise, minimize it
- If **almost never** → hide behind disclosure (collapsed, behind a small toggle)
- If **never** → remove it

### What disclosure must NOT hide

Identity and safety-critical context are exempt from collapsing. Specifically, **the map name + version stays visible** — it is the one piece of ambient context whose absence could cause a destructive mistake (editing or overwriting the wrong version). Disclosure hides *metadata*, not *identity*.

### Applied example: Mapinfo

A user who created their own map and has worked on it for 100+ hours does not need mapsize, mapfolder, and other metadata displayed prominently. They know the map in and out; signposting it everywhere is like putting direction signs in every room of your own home — technically informative, practically just noise.

**Resolution:** The version-bearing name (`Tartaron.v0006`) remains visible as primary orientation. The *rest* of the metadata collapses to a single Leise line, expandable on click. Identity stays; metadata folds away.

---

## § 7 — COLOR: THREE ROLES

`--tab-color`-only ("one accent, everything else greyscale") was too narrow: the shipped build already, and correctly, uses more than one color at rest. The honest model is **three distinct color roles**, governed separately. Mixing them is forbidden; using all three is fine because they never occupy the same semantic slot.

### Role 1 — UI identity color (`--tab-color`)

The single accent that expresses *which tab you are in*.

- `--tab-color` is the identity color of the tab (red for Wreckage, cyan for Emitter, etc.)
- **Subtitle text** is in `--tab-color` — the static accent signal within the column
- **Primary Button (TraceLine)** uses `--tab-color` as the animated accent — bloom, glow, sweep on commit
- **Exactly one UI identity color per tab.** No second *identity* accent. Nothing else uses `--tab-color` in the resting state beyond the two moments below.

**The two UI-accent moments per section** (these do not compete — one is typographic/static, one is kinetic/animated):
1. **Subtitle** — static, identifies the block, `--tab-color` text
2. **Primary Button** — animated, terminates the section, `--tab-color` TraceLine

### Role 2 — Data / object color

Colors that *are information*, attached to user data — unit types, canvas markers, coordinates. (~12 distinct unit colors in the Units tab.)

- A data color represents a concrete object and is intentionally **not** `--tab-color`. The same color reappears wherever that object does (the unit card border/swatch here, its coordinate marker on the canvas there).
- This **deliberately overrides** the "one accent per tab" rule, because the *semantic meaning* of the color outweighs the visual purity of the tab. Forcing every unit to share one color would destroy the exact information the color exists to carry.
- Data colors are chosen from the data palette, never from `--tab-color`, so the two roles never collide. A data color on a unit card is signal — it may legitimately carry an edge or swatch (§5).

### Role 3 — System / feedback color

Status semantics: success, warning, error.

- **Green = success · Yellow = warning · Red = error.**
- These live one layer *above* the tab design language (notifications, validation, system feedback) and follow standard convention, not the tab identity rule. A tab whose identity color is red still shows an error in the conventional error treatment — the two reds belong to different roles and different layers, and context disambiguates them.
- Never repurpose a feedback color as a UI identity accent or a data color, and vice versa.

### Ink scale usage (the neutral spine all three roles sit on)

`tokens.css` defines a primary 6-step scale plus a wider set of finer-grained
aliases (kept for existing rules that need an in-between value — both are live,
not one canonical vs. one deprecated):

- `--ink-100` — Title, dominant text (aliased as `--ink-92`/`-95` in some rules)
- `--ink-72` — Normal interactive elements (e.g. `ctrl-btn-close:hover`)
- `--ink-55` — Standard content (e.g. `subsection-head-title`, `ctrl-btn-meta:hover`)
- `--ink-40` — Muted controls / state text
- `--ink-28` — Leise / meta information
- `--ink-22`/`-16` — Barely visible labels (e.g. `field-hint`)
- Below `--ink-11` — decorative / structural only, not readable text

New rules should reach for the primary scale (`100/72/55/40/28/16`) first; only use
a finer alias (e.g. `--ink-45`) when matching an existing sibling rule that already
uses it.

---

## § 8 — RESPONSIVE & SPACE

No fixed `px` values for structural layout. The staircase indentation uses relative units (`%` of column width or `ch`). The column itself responds to viewport.

**Minimum target:** 1280×800. Design at 1920×1080, verify at 1280×800.

### Negative space is the philosophy; runaway void on ultrawide is a bug

The layout philosophy — generous space, content in a focused column, room to breathe — holds at 1920×1080 and below, where the empty margin reads as a slightly wider sidebar, not a missing half-screen. **This philosophy is not in question.**

What *is* a tuning bug: on ultrawide monitors the empty zone grows without bound and reads as a dead, functionless quadrant rather than breathing room. Breathing room is space *around and between* elements; an entire empty screen-half is not that.

**Rule:** Cap the content+preview composition at a maximum effective width and **center or contain** it, so additional ultrawide pixels are distributed as balanced margin on *both* sides — never accumulated as one large empty block to the left of the controls. The extra space at any width is for breathing room, **not** for adding elements, and **not** for an unbalanced void.

---

## § 9 — SIDERAIL

The siderail is the top-level navigation of a tab. It divides the tab into sections (01 Config, 02 Units, etc.).

- Each rail step is a discrete, logically complete unit of work
- Rail steps are not subdivided further within the rail — blocks exist within a step, not as additional steps
- **Strong recommendation: 4–5 steps per tab.** More usually signals the tab should be split — but this is guidance, not a natural law. A genuinely indivisible longer workflow may exceed it *with explicit justification*.
- The active rail item already communicates "you are in Configuration" — the Title in the content area is therefore confirmation, not navigation

---

## § 10 — WHAT WE ARE SOLVING

This system exists because the previous implementation produced **horizontal line soup**: every component — section header, field baseline, divider, subsection head, check-row border, commit button — added a horizontal line of similar weight. No line provided orientation because all lines competed equally.

The solution is not "fewer lines" — it is **intentional lines with clear hierarchy and purpose**. Three tiers. Maximum one animated accent per section. Structure communicated by space and position, not decoration.

**The standing risk is not the design — it is drift between this contract and the build.** A contract that the product has quietly outgrown stops being the source of truth, and an ignored contract cannot prevent the next slide back into soup. Hence the rule at the top: when the build is provably smarter than a rule here, update the rule. This revision is that update.

---

## § 11 — THE GRAPH CANVAS

A *graph canvas* is a free 2D surface on which the user places, drags and wires
discrete objects (the Texture Editor's node graph; any future editor of the same
shape). It is the one surface in the toolkit where §5's box rules need an
explicit carve-out — and a narrow one.

### The exception

**On a graph canvas, an object's outline is mechanism, not decoration.** Without
a card body there is no drag handle, no hit target, no anchor for the socket
geometry the edge maths depends on. This is the same reasoning that grants a
toggle its track in §5: a box that *is* the control is signal.

**Scope — this licence covers the object card only.** It does not extend to
anything that merely sits near the canvas: toolbars, toolboxes, inspectors,
badges, overlays and search panels around a graph are ordinary tab surface and
obey §4/§5 unchanged. The failure mode this clause exists to prevent is the
exception leaking outward until the whole tab is boxed again.

### The two-channel card

A node card carries two questions at once, and they must ride on **separate,
non-competing channels** — the same decoupling §2 applies to size vs. colour:

| Channel | Carrier | Character | Colour role |
|---|---|---|---|
| **Identity** — "what am I" | the head | permanent, static | Role 2 (object colour) |
| **State** — "what is true of me right now" | the ring | transient, rare | Role 3 + selection |

**Identity — the head.** The head is washed in the object's category colour
(~18%) with a single full-saturation hairline on its lower edge. This is §5's
"one surface *or* one edge" turned inward: surface and edge are the *same* data
colour, which is signal, not the forbidden neutral-surface-plus-neutral-border
pair. A full-saturation head *fill* is not permitted — at a dozen cards it turns
the canvas into a colour field and drowns `--tab-color`.

**State — the ring.** **At rest the ring does not exist.** A card wears no
border until a state is true; the ring *appearing* is the signal. This is what
keeps the exception honest — the neutral resting border that §5 forbids is not
excused here, it is structurally absent.

Three rules govern the ring:

1. **It is a shadow, not a border.** A state must never change an object's
   geometry — the socket anchors the edge maths assumes have to stay put.
2. **Exactly one ring at a time**, resolved by a declared priority ladder
   (Texture Editor: `compare < bypass < freeze < selection < error`).
3. **No information may live only in the ring.** Because the ring shows one
   state and an object may hold several, every active state must also appear in
   a per-object glyph strip — which doubles as the click target for clearing it.

### Connections

Wires are not plumbing — on a canvas they *are* the trace grammar the rest of
the toolkit draws by hand (§4), generated from the data instead:

- A wire inherits **its source object's** category colour (Role 2 — "the same
  colour reappears wherever the object appears") and fades along its length
  toward the target. Direction is read from the fade; a canvas needs no
  arrowheads or markers.
- Hairline weight, non-scaling stroke. A wire that fattens with zoom reads as
  cabling, not as trace.
- Selection recolours the wire to `--tab-color`. That is the only place the tab
  identity colour touches a wire.

---

## § 12 — THE 3D VIEWPORT

A *3D viewport* is a rendered volume the user orbits around (the 3D Viewer's prop
preview; the wave and sky views planned on the same engine). Like §11 it needs a
narrow carve-out from §5, and for a different reason.

### The exception

**A viewport is a window, and a window has a frame.** A rendered volume has no
intrinsic edge: its content runs to the pixel boundary and its background is
whatever the scene clears to. Without a border the viewport bleeds into the tab
and the user cannot tell where the model space ends. The single neutral outline
is therefore mechanism — the same argument §11 makes for the node card body, and
§5 makes for a toggle track.

**One outline, and only the viewport.** No fill, no second edge, no inner
padding ring. Everything beside the viewport — toolbar, side panels, pickers —
is ordinary tab surface under §4/§5, unchanged.

### Overlays are labels, not blocks

Text and controls floating over a viewport (the read-out, the action buttons,
the standing caveat) are **labels on the surface below**, not blocks on it. They
therefore carry:

- **no surface and no border of their own.** Legibility comes from type
  contrast against a scene that the engine keeps dark and low-contrast — not
  from a scrim. A panel drawn over the render is a block, and §5 applies to it
  in full.
- **`pointer-events: none` on anything that is not a control**, so the read-out
  never eats an orbit drag.

### The scene is not a design surface

The tab accent may appear in the scene only where it marks *the viewer's own*
geometry — the origin cross, the axis lines. Model, texture and lighting are
data: they show what the file contains, and tinting them toward `--tab-color`
would make the tab lie about the asset.

Where the render is not what the game shows, **the viewport says so in
writing**, permanently, not as a dismissible notice. The 3D Viewer's
"neutral lighting — not the in-game shader" is that label; it is Role 1 quiet
and it never goes away, because it is true of every frame.

---

## CHANGELOG

**2026-07-26 — compliance table extended for Floating Trees.** No rule changed, and no new
clause was needed: the tab is ordinary X·half tab surface under §4/§5. Two calls worth
recording. Its verdict banner, severity ticks and canvas overlay carry §7 Role 3 feedback
hue rather than `--tab-color`, on the same argument SymmetryChecker makes — "does this tree
touch the ground" is the answer, not the tab's identity. And its Findings step was split
into two rail steps (02 Findings, 03 Placements) rather than run as one four-block section,
which is §3's "more than 2–3 blocks signals a split" applied rather than waived; the tab
sits at four rail steps, inside §9's recommendation. It reports
`orphan 0 · foreign 0 · boxed 0 · literals 0`, so the repo-wide totals above are unchanged.

**2026-07-26 — compliance table extended for the Biome Changer.** No rule changed, and no
new clause was needed: the tab is ordinary X·half tab surface under §4/§5, with its preset
swatches and layer-role colours as §7 Role 2 data colour and the reclaim delta as Role 3
feedback. It reports `orphan 0 · foreign 0 · boxed 0 · literals 0`, so the repo-wide totals
above are unchanged.

**2026-07-26 — added §12 (the 3D viewport), for the 3D Viewer tab.** No existing
rule changed. §12 is a second narrow deviation in the sense of Philosophy §7,
parallel to §11 and argued the same way: a rendered volume has no intrinsic edge,
so the one neutral outline around it is mechanism rather than decoration. The
clause is deliberately tighter than §11 in one respect — it licenses the frame
and nothing inside it, so overlays on the render stay borderless labels and a
panel drawn over the scene remains a block under §5. It also adds a positive
obligation §11 had no need for: where the render is not what the game shows, the
viewport must say so permanently. Implemented in
`Tabs/Textures/Viewer3D/{Viewer3D.css, Viewport.jsx}` and
`Shared/Scene3D/Scene3D.css`. The tab reports `orphan 0 · foreign 0 · boxed 2`;
both BOXED findings are the sanctioned outlines — the viewport frame (§12) and
the drop target (§5's functional box).

**2026-07-26 — renamed `TAB_DESIGN_LAW.md` → `TAB_UI_CONTRACT.md`.** No rule changed.
The name now pairs visibly with `TAB_CONTRACT.md`: one contract for the non-visual half
of building a tab, one for the visual half. "Law" survives as internal vocabulary where
it is a section's actual name (§4 THE LINE LAW, the dosage law) — only the document's
self-description changed. All 14 references from code comments, `scripts/design-lint.mjs`
and the in-app contributor article were updated in the same pass.

**2026-07-26 — compliance re-measured; scope note corrected.** No rule changed. The
header previously claimed this law was "verified against the three gold-standard tabs
(Wreckage/Props/Emitter)" and pointed at a `DESIGN_SYSTEM_MIGRATION.md` that no longer
exists. That framing was wrong in both directions: the law always applied to every tab,
and the three named tabs are no longer alone in complying. Replaced with a measured
compliance table from `npm run lint:design`. Notable: `Textures/TextureEditor` now reports
**0** findings — the "remaining 21 BOXED findings" recorded in the §11 entry below have
been cleared.

**2026-07-25 — added §11 (the graph canvas), for the Texture Editor's node
editor.** No existing rule changed; §11 is an additional, deliberately narrow
role in the sense of Philosophy §7 ("a documented deviation is not a violation
— it is an additional role that refines the rule"). The substance: on a free
canvas the object's outline is mechanism, so a node card may be a box — but
only the card, and only by splitting into an identity channel (washed head,
Role 2) and a state channel (a ring that does not exist at rest, so the
forbidden neutral resting border is absent rather than excused). Wires inherit
their source object's colour and get trace treatment. Everything around the
canvas keeps §4/§5 unchanged. Implemented in
`Tabs/Textures/TextureEditor/{NodeEditor.css, ui/NodeGraph.jsx}`; the tab's
remaining 21 BOXED findings all sat *outside* the canvas and were not covered by
this clause. *(Since cleared — the tab reports 0 findings as of 2026-07-26.)*

**2026-07-08 — refreshed class/token names after the `Shared/`/`Tabs/` rename; scoped to Wreckage/Props/Emitter.**

- No principle changed. Updated concrete references only: `WorkspaceConsole` →
  `TabLayout`, `EntityConsole` → `EntityPanel`, the button hierarchy now names the
  actual `ctrl-btn-*`/`commit-button`/`station` classes (the `action-button`/
  `button-solid` vocabulary drafted in an earlier roadmap was never shipped under
  those names).
- §7 Ink scale: documented the real primary 6-step scale (`100/72/55/40/28/16`)
  alongside the finer-grained compat aliases (`92`, `22`, …) that individual rules
  still use — both are live, not one canonical vs. one dead.
- §4 Line Law: clarified that `.subsection-head` (forbidden form) still physically
  exists in `primitives.css` but is unused by the gold-standard tabs, which use
  `.trace-subsection` (the permitted vertical-tick form) instead.
- Added a scope note limiting the document to Wreckage/Props/Emitter.
  *(Superseded 2026-07-26 — see the top entry.)*

**2026-06-24 — synced law to shipped build after an adversarial design review.**

- **§2 Staircase:** replaced "all four dimensions point in the same direction / no dimension contradicts another" with the true decoupled model — size carries orientation (neutral, large), color carries content (`--tab-color`, smaller); they run counter to each other on purpose. Position demoted to the weakest, optional dimension.
- **§2 The Ghost:** removed. Decorative-only, no user signal, contradicted "no decoration without cause."
- **§5 Inputs:** "strictly boxless" relaxed to "no *generic* boxes." Functional boxes that *are* the control (toggles/tracks) and identity/data-colored borders are permitted as signal. Added the **unconditional resting baseline** rule to fix the empty-field affordance gap.
- **§7 Color:** replaced "one accent, everything else greyscale" with **three color roles** — UI identity (`--tab-color`), data/object color (units, markers, ~12 colors), system/feedback (green/yellow/red). The build already used data color (unit cards) correctly; the law now accounts for it.
- **§1 Loudness:** clarified the rule is about *simultaneous* levels, not total count — disclosure-revealed levels are sequential and don't violate it.
- **§6 Disclosure:** added explicit carve-out — map name + version is never collapsed (identity/safety), only metadata folds.
- **§4 / §8 / §9:** added anti-monoculture note on vertical elements; added ultrawide void-capping rule (philosophy kept, runaway empty half-screen fixed); softened the rail cap from law to strong recommendation with a justified-exception path.

---

*End of contract.*
