# UI Philosophy — ForgeMapToolkit

> The "constitution" for visual decisions. TAB_CONTRACT.md says *how* code is to be
> structured. This document says *why* the UI looks the way it does — every design
> decision (human or AI-assisted) should be traceable back to this. If a new idea
> contradicts a principle here, the principle wins, not the idea — or the principle is
> deliberately updated here.
>
> *As of 2026-06-24: revised after the implementation turned out to be more pragmatic
> and nuanced than the original draft at several points. The rule here is: if the build
> is demonstrably smarter than a principle, the principle is corrected, not the build.
> See changelog at the end.*

---

## 0. The 5 Core Principles

1. **Negative space is a feature, not a lack.** Empty space is part of the composition,
   not something that must be filled with content — as long as it breathes *around and
   between* elements and does not collapse into a functionless dead zone (see §1).
2. **One UI-identity accent color per context** — `--tab-color`. Alongside it exist two
   further, clearly separated color roles (data color, feedback color). Anything that
   plays none of these three roles is greyscale (see §2).
3. **Hierarchy is created through structure, not through more color or more size.**
   Size and color operate *independently* (even in opposite directions), not in lockstep
   (see §3).
4. **Motion is meaning.** Every transition / glow must mark a state change — never
   decoration without cause.
5. **Everything goes through tokens.** No hex, no magic-px outside `tokens.css`
   (see TAB_CONTRACT.md §5) — this philosophy *explains why*; the Contract *enforces it*
   technically.

---

## 1. Negative Space

- Empty space is not automatically treated as "missing content." Before filling an empty
  area (more text, more elements, larger type), ask first: *does this add to the
  statement, or does it merely paper over the emptiness?*
- If space should be closed, prefer **structural means** (eyebrow label, dividing line,
  additional but genuinely useful information) over inflating body copy or enlarging
  existing elements.
- Generous spacing around primary actions (CTAs, read-more buttons) is intentional —
  it signals importance through isolation, not through size.
- **Negative space ≠ uncontrolled void.** Breathing room is spacing *around and between*
  elements. A whole empty screen-half is not that. At 1920×1080 and below the free area
  reads as a slightly wider sidebar — intentional. On ultrawide monitors it grows without
  bound into a dead zone; that is a tuning bug, not a philosophy. Fix: cap the content
  composition at a maximum width and **center/contain** it, so excess pixels are
  distributed as balanced margin on *both* sides, not accumulated as one large empty
  block on the left.
  (Technically regulated in TAB_DESIGN_LAW §8.)

## 2. Color — Three Roles

Color has **three distinct roles** in the system. Mixing them is forbidden; using all
three simultaneously is permitted, because they never occupy the same semantic slot. The
old rule "exactly one accent color, everything else grey" was too narrow — the build
already, and correctly, uses more than one color at rest.

**Role 1 — UI identity color (`--tab-color`)** — communicates *which tab* you are in.
- Every tab has exactly **one** identity accent color, mapped from the central registry
  (`tokens.css`, "PER-TAB ACCENT REGISTRY").
- Usage: active / hover states, structural markers (`::before` ticks, eyebrow labels),
  **at most one** accented word per heading, and glow/shadow exclusively on interaction
  — never as a permanent resting state.
- Never a *second identity* accent color in the same tab. Never set a hex value directly
  — always use `var(--tab-color)` / `var(--<id>-color)`.

**Role 2 — Data / object color** — color that *is information*, bound to user data
(unit types, markers, coordinates; currently ~12 distinct unit colors).
- A data color represents a concrete object and is intentionally **not** `--tab-color`.
  The same color reappears wherever the object appears (unit card here, coordinate marker
  on the canvas there).
- This **deliberately overrides** the "one accent color" rule, because the *semantic
  meaning* of the color matters more than the visual purity of the tab. Forcing every
  unit to share one color would destroy the exact information the color exists to carry.
- Data colors come from the data palette, never from `--tab-color` — so the two roles
  never collide. A data color on a unit card is a signal, not generic chrome, and may
  legitimately carry an edge / swatch.

**Role 3 — System / feedback color** — status: success / warning / error.
- **Green = success · Yellow = warning · Red = error.**
- These live one layer *above* the tab design language (notifications, validation) and
  follow convention, not the tab identity. A tab whose identity color is red still shows
  an error in the conventional error treatment — different roles, different layers,
  context disambiguates.
- Never repurpose a feedback color as a UI identity or data color, and vice versa.

Text on an accent surface (e.g. filled button in hover state) uses a dark /
contrast-safe ink level — never unchecked pure black/white.

## 3. Hierarchy Tools

Three proven, combinable tools for distinguishing levels — *before* reaching for size
or weight:

1. **Eyebrow label** — small, generously tracked caption above a heading
   (e.g. "04 — overview"), optional, only when an additional navigation / context layer
   is genuinely needed. Not a standard device for every section.
2. **Structural line** (`::before`, vertical or horizontal, in `--tab-color`) — visually
   groups related elements (heading + text + action) into one block while simultaneously
   separating them from the rest. Preferred over an additional eyebrow label when only
   grouping is needed, not a new information layer. Use sparingly: one or two vertical
   markers per screen — otherwise "line soup" simply becomes a vertical variant of the
   same problem.
3. **Accent word** — one single, semantically central term in the heading gets
   `--tab-color`. Strengthens recognition (brand name, core concept) without changing
   type size or weight.

### Size and color are decoupled — that is the core, not an accident

Section titles (the higher structural level) deliberately stay **neutral / grey-white**
and are *large*. The subtitle (the lower content level) is *colored* and *smaller*.
Size and color therefore point in **opposite** directions — and that is precisely the
strength:

- **Size carries the orientation hierarchy** — "where am I, what is the structural
  beginning of this block."
- **Color (`--tab-color`) carries the content hierarchy** — "what do I actually read
  and act on."

Because the two channels are independent, the hierarchy encodes two things at once
(structure *and* reading focus) rather than repeating one statement four times. Never
make the title simultaneously the *largest* element *and* colored — that collapses the
two channels into one and wastes the contrast.

## 4. Proximity over Separation (Gestalt Law)

- Elements that belong together (e.g. back-link + the section title it leads back to)
  get **tight** spacing. Global navigation elements get **generous** spacing from
  everything that is not global.
- Rule of thumb for "tight": 12–16 px between a context link and the heading it
  introduces — not 30 px+. Generous spacing is reserved for separation *between*
  independent blocks, not *within* a block.

## 5. Motion & Interaction

- Every transition marks a real state change (hover, active, mount/unmount, tab switch).
  No motion without function.
- Standard timing: **150–250 ms, ease / cubic-bezier** for micro-interactions (buttons,
  links). Longer, one-off reveal animations (trace sweeps, logo draw-on) are deliberate
  exceptions for opening moments (panel open), not for recurring interaction.
- Glow effects are coupled exclusively to interaction states (hover / active), never
  permanent — otherwise the effect loses its signal value. (The decorative ghost index
  was discarded for exactly this reason — see TAB_DESIGN_LAW §2.)
- Primary CTAs may carry the strongest motion / glow effect in their context — this
  unambiguously marks them as "next step."

## 6. Typography

- A clear weight hierarchy rather than many intermediate grades: neutral, large heading
  (section level) → neutral, smaller heading with optional accent word (content level)
  → muted body copy (secondary ink level). See `--text-*` tokens — no hex / magic-px
  font sizes in tab CSS (TAB_CONTRACT §5).
- Body copy is not artificially stretched to fill space (see §1). If more information is
  genuinely warranted, add it as an additional, self-contained thought — not as a
  lengthening of the existing sentence.
- **Input fields:** recognizability comes from consistency *plus* a calm resting baseline.
  A field is text on a line — and that (functional T2) line is **always visible, even in
  the empty state**. An empty field must never be bare placeholder text without a line;
  otherwise it is indistinguishable from a label. The line is the affordance; the
  placeholder sits on top of it. (Technically regulated in TAB_DESIGN_LAW §4 / §5.)
- Placeholder text (phase-X hints, etc.) must remain clearly recognizable as such — it
  must not be treated stylistically as final content.

## 7. When to Deviate from These Principles

- Eyebrow labels, accent words, and structural lines are **tools, not mandates.** Not
  every section needs all three — when in doubt, choose the most minimal tool that
  solves the hierarchy problem.
- A deliberate, documented deviation (such as the data colors in §2, Role 2) is *not* a
  rule violation — it is an additional role that refines the rule. If a new use case
  does not map cleanly to any of the principles above: first extend this document (with
  reasoning), then implement — do not deviate silently.

---

## Relationship to TAB_CONTRACT.md

| Document | Answers |
|---|---|
| `UI_PHILOSOPHY.md` (this) | *Why* does a tab look the way it does? Which hierarchy / color / motion decision is correct? |
| `TAB_CONTRACT.md` | *How* is it built technically? File structure, state contracts, token obligations, IPC security. |
| `TAB_DESIGN_LAW.md` | *Which* concrete rules (loudness, staircase, lines, trace, color roles) apply as law per tab surface? |

All three reference the same token source (`shared/design-system/tokens.css`). If a
principle changes here, check whether TAB_DESIGN_LAW and TAB_CONTRACT.md §5 (styling
contract) need to be updated as well — and vice versa.

---

## Changelog

**2026-06-24 — Philosophy aligned with the build (after adversarial design review).**
- **Principle 2 & §2 Color:** "one accent, everything else grey" replaced by **three
  color roles** — UI identity (`--tab-color`), data / object color (units / markers,
  ~12), system / feedback color (green / yellow / red). The build already used data
  colors correctly; the philosophy now recognizes them as a distinct role.
- **Principle 3 & §3:** made explicit that size and color work *decoupled / in opposite
  directions* (large neutral title ↔ smaller colored subtitle), rather than in lockstep.
- **§1 Negative space:** added the distinction "breathing room vs. dead void" + ultrawide
  capping rule.
- **§6 Typography:** resting baseline for empty input fields added as an affordance rule.
- **§5 Motion:** ghost index noted as a violation of "no decoration without cause"
  (discarded).
