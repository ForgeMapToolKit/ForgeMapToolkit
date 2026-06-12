# ForgeMapToolkit — UI Gold Standard
## The TRACE Design System

Extracted from: `Banner.css`, `HomeScreen.css`, `Settings.css`, `MegaNavbar.css`
Applies to: every tab, overlay, modal, and UI element in the suite

---

## 1. The Physical Model

The entire UI is one instrument: a dark machined plate printed by a carriage. Every surface, every element follows from this metaphor. If an element can't be explained by "what a plotter does on a machined metal plate," it doesn't belong.

**What this replaces:**
- Glass cards with `backdrop-filter: blur()`
- Gradient backgrounds that imply depth or materiality
- Hover lift transforms (`translateY(-3px) scale(1.005)`)
- Decorative glows that float off elements
- Rounded corners on structural elements
- Emoji icons in headers

---

## 2. Surface

### The Plate
Every content surface is the same plate. One background, everywhere.

```css
background: #070708;
background-image: radial-gradient(circle, rgba(255,255,255,0.022) 1px, transparent 1px);
background-size: 28px 28px;
```

### Film Grain (one layer per root surface, not per card)
```css
.trace-grain {
  position: absolute;
  inset: -100%;
  z-index: 40;
  pointer-events: none;
  opacity: 0.05;
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0"/></filter><rect width="320" height="320" filter="url(%23g)"/></svg>');
  animation: trace-grain-shift 0.9s steps(2) infinite;
}
@keyframes trace-grain-shift {
  0%   { transform: translate(0,0); }
  25%  { transform: translate(-1.2%, 0.8%); }
  50%  { transform: translate(0.6%, -1.1%); }
  75%  { transform: translate(-0.8%, -0.5%); }
  100% { transform: translate(0,0); }
}
```

### Architectural Light (surface-level tints, not per-element glow)
```css
/* lit from above — one wash per major register */
background: linear-gradient(180deg, rgba(255,255,255,0.014), transparent 60%);
```

### Never
- `backdrop-filter: blur()` — removes on all cards, modals, panels
- `background: rgba(9,9,9,0.98)` or similar dark-but-not-black — use `#070708` flat
- Individual card backgrounds with gradients
- `box-shadow: 0 0 50px var(--glow)` floating glow on cards

---

## 3. Typography

### Fonts
| Role | Font | Usage |
|---|---|---|
| UI labels, headings, numbers | **Space Grotesk** | All navigation, section titles, form labels, data |
| Descriptive prose | **Poppins** | Multi-sentence descriptions only (e.g. navbar desc panel) |
| Paths, code, file names | **JetBrains Mono** | Path inputs, file name readouts |

### Type Scale
```
eyebrow      0.56–0.58rem   weight 600   tracking 0.30–0.34em   uppercase
caption/meta 0.60–0.66rem   weight 400   tracking 0.14–0.22em   uppercase
label        0.68–0.78rem   weight 600   tracking 0.16–0.26em   uppercase
body         0.78–0.82rem   weight 300   tracking 0.02–0.04em   mixed case
sub-title    0.86–1.0rem    weight 600   tracking 0.12–0.18em   uppercase
title        clamp based    weight 300   tracking 0.08–0.12em   uppercase
designation  clamp large    weight 700   tracking 0.01–0.07em   uppercase
```

### White Opacity Ladder (the only "color" type ever gets)
```
rgba(255,255,255, 0.95)  — active/selected label
rgba(255,255,255, 0.92)  — primary designation / heading
rgba(255,255,255, 0.72)  — form label / active secondary
rgba(255,255,255, 0.55)  — ledger row label (default)
rgba(255,255,255, 0.32)  — muted label, nav item
rgba(255,255,255, 0.22)  — ghost label, helper text
rgba(255,255,255, 0.16)  — index, eyebrow, very muted
rgba(255,255,255, 0.13)  — caption header
rgba(255,255,255, 0.08)  — resting tick/bar
rgba(255,255,255, 0.03)  — ghost watermark (large background text)
```

### Color belongs to the tick and the trace — not the type
Type **never** takes the accent color. If a label is "active," it steps from 0.28 → 0.95 opacity white. The accent hue goes to the tick, the underline, the trace filament.

**Exception:** status readouts (`ok` / `warn` / `danger`) may carry semantic color.

---

## 4. Motion Easings

Three easings cover everything. Name them consistently in each file:

```css
--trace-out:   cubic-bezier(0.16, 1, 0.3, 1);   /* fast-out mechanical: hard launch, soft land */
--trace-rise:  cubic-bezier(0.55, 0, 0.15, 1);   /* heavy actuation: initial resistance, damped stop */
--trace-decay: cubic-bezier(0.2, 0.55, 0.35, 1); /* phosphor decay: drops fast, lingers in tail */
```

### Durations
```
Ignite (tick on)      0.06s linear        — electrical relay closing
Print (clip reveal)   0.2–0.4s --out      — carriage pass
Trace sweep           0.32s --out         — the pen drawing
Decay (tick off)      0.6–0.9s --decay    — phosphor cooling
Rail extend           0.34s --rise        — mechanical travel
Commit sweep          0.35–0.45s --rise   — shutter
Panel print-down      0.2s --out          — mega dropdown opens
```

### Never
- `opacity: 0 → 1` with `translateY(30px)` entry — replace with clip-path print
- `transition: all 0.7s` — always name the specific properties
- Bounce, spring, or elastic easing

---

## 5. The Tick

The fundamental accent primitive. A short vertical phosphor filament.

```css
.trace-tick {
  width: 2px;
  height: 14px;              /* 14–20px depending on context */
  background: rgba(255,255,255,0.08);  /* at rest: dormant */
  transform: scaleY(0.4);
  transform-origin: center;
  transition:
    background 0.9s var(--trace-decay),
    opacity    0.9s var(--trace-decay),
    box-shadow 0.9s var(--trace-decay),
    transform  0.9s var(--trace-decay);
}

/* Engaged — color from --item-color / --tab-color / --stc-accent */
.parent:hover .trace-tick,
.parent.active .trace-tick {
  background: var(--tab-color);
  box-shadow: 0 0 10px var(--tab-glow-strong), 0 0 3px var(--tab-color);
  transform: scaleY(1);
  transition-duration: 0.06s; /* ignite is instant */
}
```

The tick also runs a **lamp-test** on mount, staggered by element index:
```css
animation: trace-lamp 0.45s linear both;
animation-delay: calc(var(--item-i) * 55ms + 150ms);

@keyframes trace-lamp {
  0%   { background: rgba(255,255,255,0.08); }
  35%  { background: var(--tab-color); box-shadow: 0 0 10px var(--tab-glow-strong); }
  100% { background: rgba(255,255,255,0.08); }
}
```

---

## 6. The Trace Filament

The horizontal signature. Three layers: bloom (energy), core (resident), hot (initial burn).

```css
.trace-filament { position: relative; height: 1px; overflow: visible; }

.trace-bloom {
  position: absolute; inset: 0; top: -4px; bottom: -4px;
  background: var(--tab-color);
  filter: blur(7px);
  opacity: 0.4;
  transform: scaleX(0); transform-origin: left center;
  animation: trace-print 0.32s var(--trace-out) both,
             trace-bloom-settle 1.2s linear both;
}
@keyframes trace-bloom-settle { 0%, 35% { opacity: 0.85; } 100% { opacity: 0.4; } }

.trace-core {
  position: absolute; inset: 0;
  background: linear-gradient(90deg, var(--tab-color), transparent 78%);
  opacity: 0.38;
  transform: scaleX(0); transform-origin: left center;
  animation: trace-print 0.32s var(--trace-out) forwards;
}

.trace-hot {
  position: absolute; inset: 0;
  background: rgba(255,255,255,0.95);
  opacity: 0;
  transform: scaleX(0); transform-origin: left center;
  animation: trace-print 0.32s var(--trace-out) both,
             trace-cool  0.9s linear 0.42s both;
}

@keyframes trace-print { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes trace-cool  { from { opacity: 1; } to { opacity: 0; } }
```

For **underlines** (active nav items, row baselines): single `trace-core` layer is sufficient.

---

## 7. Print Animation

All text, rows, panels reveal left-to-right with a carriage pass.

```css
@keyframes trace-reveal {
  from { clip-path: inset(0 100% 0 0); }
  to   { clip-path: inset(0 0% 0 0); }
}

@keyframes trace-reveal-down {
  from { clip-path: inset(0 0 100% 0); }
  to   { clip-path: inset(0 0 0 0); }
}
```

Usage — stagger by index:
```css
.row {
  clip-path: inset(0 100% 0 0);
  animation: trace-reveal 0.4s var(--trace-out) both;
  animation-delay: calc(var(--row-i) * 55ms + 120ms);
}
```

**Never use `opacity:0 + translateY()` as an entry animation.** Replace with clip-path.

---

## 8. Borders & Dividers

```
Standard hairline:    1px solid rgba(255,255,255,0.07)
Inner divider:        1px solid rgba(255,255,255,0.055)
Focus / elevated:     1px solid rgba(255,255,255,0.18)
Active accent:        1px solid rgba(255,255,255,0.45)
```

Gradient divider (fades out right):
```css
height: 1px;
background: linear-gradient(90deg, rgba(255,255,255,0.07), transparent 85%);
```

**Never:**
- `border-radius` on panels, cards, inputs (2px max on truly small badges/chips)
- Borders thicker than 1px (2px only for the active underline tick)
- `border-top: 3px solid` accent bars → replace with the tick pattern

---

## 9. Backgrounds & Surfaces (opacity scale)

```
#070708                           — plate surface (root bg)
rgba(255,255,255, 0.015)          — card / raised surface
rgba(255,255,255, 0.025)          — hover surface
rgba(255,255,255, 0.04–0.05)      — active / selected surface
rgba(255,255,255, 0.02)           — input channel (recessed)
rgba(255,255,255, 0.035)          — input focused channel
```

---

## 10. Status Colors (semantic only — never decorative)

```
Ok / success:   rgba(0, 200, 100, 0.75)    background tint: rgba(0,200,100,0.04)
Warning:        rgba(255, 140, 0, 0.75)    background tint: rgba(255,140,0,0.07)
Danger/error:   #cc4444                    background tint: rgba(200,60,60,0.05)
Coming soon:    opacity: 0.35–0.45 on parent, badge "SOON"
```

Status dot:
```css
.status-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor; }
```

---

## 11. Buttons

Three tiers. All: no `border-radius` (2px max), Space Grotesk, uppercase, `letter-spacing: 0.14–0.18em`.

### Tier 1 — Primary Action (`.btn-action`)
The main commit button (generate, save, apply). Carries the tab accent.

```css
.btn-action {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 13px 32px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 2px;
  color: #ffffff;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.25s linear, border-color 0.25s linear, box-shadow 0.25s linear;
  white-space: nowrap;
}
.btn-action::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
  opacity: 0;
  transition: opacity 0.3s;
}
.btn-action:hover:not(:disabled) {
  background:   rgba(255,255,255,0.10);
  border-color: rgba(255,255,255,0.40);
  box-shadow:   0 0 24px rgba(255,255,255,0.10), 0 4px 20px rgba(0,0,0,0.5);
}
.btn-action:hover:not(:disabled)::after { opacity: 1; }
.btn-action:disabled { opacity: 0.25; cursor: not-allowed; }

/* Accent variant — for primary tab action (Generate, Apply) */
.btn-action--accent {
  border-color: color-mix(in srgb, var(--tab-color) 60%, rgba(255,255,255,0.18));
  background:   color-mix(in srgb, var(--tab-color) 10%, transparent);
}
.btn-action--accent:hover:not(:disabled) {
  border-color: var(--tab-color);
  background:   color-mix(in srgb, var(--tab-color) 18%, transparent);
  box-shadow:   0 0 24px var(--tab-glow-strong), 0 4px 20px rgba(0,0,0,0.5);
}

/* Success state (after generate/save) */
.btn-action--saved {
  background:   rgba(0,200,100,0.10);
  border-color: rgba(0,200,100,0.40);
  color:        rgba(0,220,110,0.9);
}
```

### Tier 2 — Ghost / Secondary (`.btn-ghost-trace`)
Browse, browse-library, secondary actions.

```css
.btn-ghost-trace {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 2px;
  color: rgba(255,255,255,0.45);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color 0.2s linear, color 0.2s linear, background 0.2s linear;
  white-space: nowrap;
}
.btn-ghost-trace:hover {
  border-color: rgba(255,255,255,0.28);
  color: rgba(255,255,255,0.85);
  background: rgba(255,255,255,0.04);
}
/* accent tint variant (library, browse) */
.btn-ghost-trace--accent:hover {
  border-color: var(--tab-color);
  color: var(--tab-color);
  background: color-mix(in srgb, var(--tab-color) 6%, transparent);
}
```

### Tier 3 — Danger (`.btn-danger-trace`)
Delete all, factory reset.

```css
.btn-danger-trace {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  background: transparent;
  border: 1px solid rgba(255,60,60,0.25);
  border-radius: 2px;
  color: rgba(255,100,100,0.7);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.2s linear, border-color 0.2s linear, color 0.2s linear;
  white-space: nowrap;
}
.btn-danger-trace:hover {
  background:   rgba(255,60,60,0.08);
  border-color: rgba(255,60,60,0.55);
  color:        #ff6060;
  box-shadow:   0 0 14px rgba(255,60,60,0.12);
}
```

### Inline Delete (`.btn-delete-trace`)
The × button in input rows and item cards.

```css
.btn-delete-trace {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  background: none;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 0;
  color: rgba(255,255,255,0.28);
  font-size: 1.1rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s linear, color 0.15s linear;
}
.btn-delete-trace:hover {
  border-color: rgba(255,80,80,0.4);
  color: rgba(255,120,120,0.85);
}
```

### Migration map (old → new)
| Old class | New class | Notes |
|---|---|---|
| `.btn-primary` | `.btn-action.btn-action--accent` | Remove translateY lift, keep accent color signal |
| `.btn-primary.btn-lg` | `.btn-action.btn-action--accent` full width | |
| `.btn-secondary` | `.btn-ghost-trace` | Remove blur, remove fill-on-hover sweep |
| `.btn-library` | `.btn-ghost-trace.btn-ghost-trace--accent` | |
| `.btn-ghost` | `.btn-ghost-trace` | |
| `.btn-delete`, `.btn-delete-sm`, `.btn-delete-sm-alt`, `.btn-delete-xs` | `.btn-delete-trace` | Standardize all to 36×36 |
| `.st-settings-btn` | `.btn-action` | Already correct system |
| `.st-settings-btn-ghost` | `.btn-ghost-trace` | |
| `.st-settings-btn-danger` | `.btn-danger-trace` | |

---

## 12. Form Controls

### Text / Path Input
```css
.trace-input {
  width: 100%;
  background: rgba(255,255,255,0.02);
  border: none;
  border-bottom: 1px solid rgba(255,255,255,0.12);
  border-radius: 0;
  padding: 10px 12px;
  color: rgba(255,255,255,0.80);
  font-size: 11px;
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace; /* paths */
  letter-spacing: 0.025em;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s linear, background 0.2s linear;
}
.trace-input:focus {
  border-bottom-color: rgba(255,255,255,0.50);
  background: rgba(255,255,255,0.035);
}
.trace-input.is-set { border-bottom-color: rgba(0,200,100,0.30); }
.trace-input::placeholder { color: rgba(255,255,255,0.16); }
```

For non-path text fields use Space Grotesk and drop the mono family. The border-bottom only (no full border box) is the standard. Use a full `border: 1px solid` only for multi-line textareas.

### Select
```css
.trace-select {
  /* same base as trace-input, but: */
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11.5px;
  letter-spacing: 0.04em;
  appearance: none;
  cursor: pointer;
  padding-right: 36px;
}
.trace-select option { background: #0d0d0f; color: rgba(255,255,255,0.8); }
```

### Number Input
Identical to `trace-input`, width: 96px, `text-align: center`.

### Form Label
```css
.trace-label {
  display: block;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.72);
  margin-bottom: 8px;
}
.trace-sublabel {
  font-size: 0.64rem;
  font-weight: 400;
  letter-spacing: 0.03em;
  color: rgba(255,255,255,0.28);
  line-height: 1.6;
}
```

### Chip Selector (segmented button group)
```css
.trace-chip-row { display: flex; flex-wrap: wrap; gap: 1px; }
.trace-chip {
  padding: 9px 18px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.015);
  border-radius: 0;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.62rem; font-weight: 600;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: rgba(255,255,255,0.30);
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}
.trace-chip:hover { border-color: rgba(255,255,255,0.22); color: rgba(255,255,255,0.65); }
.trace-chip.active {
  border-color: rgba(255,255,255,0.45); color: #ffffff;
  background: rgba(255,255,255,0.05);
  box-shadow: inset 0 -2px 0 -1px rgba(255,255,255,0.6);
}
```

### Toggle Switch
```css
.trace-switch { flex-shrink: 0; width: 38px; height: 18px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.02); position: relative; transition: border-color 0.25s linear; }
.trace-switch.on { border-color: rgba(255,255,255,0.40); background: rgba(255,255,255,0.06); }
.trace-switch-pole { position: absolute; top: 3px; left: 3px; width: 10px; height: 10px; background: rgba(255,255,255,0.25); transition: left 0.26s var(--trace-rise), background 0.26s linear; }
.trace-switch.on .trace-switch-pole { left: 23px; background: #ffffff; box-shadow: 0 0 10px rgba(255,255,255,0.45); }
```

### Migration map
| Old | New |
|---|---|
| `.form-input`, `.form-input-sm` | `.trace-input` — drop full-border box focus, drop translateY |
| `.form-group label`, `.form-label` | `.trace-label` |
| `.form-help` | `.trace-sublabel` |
| `.st-chip`, `.st-select`, `.st-number-input` | `.trace-chip`, `.trace-select`, `.trace-input` |
| `.stc-switch`, `.stc-switch-pole` | `.trace-switch`, `.trace-switch-pole` |

---

## 13. Section Layout

### Tab Root
Every tab that takes the full content area:
```css
.trace-tab {
  --tab-color:       var(--TOOLID-color);
  --tab-glow:        var(--TOOLID-glow);
  --tab-glow-strong: var(--TOOLID-glow-strong);

  position: relative;
  display: flex; flex-direction: column;
  flex: 1; min-height: 0;
  background: #070708;
  background-image: radial-gradient(circle, rgba(255,255,255,0.022) 1px, transparent 1px);
  background-size: 28px 28px;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
  padding: 0 64px;                /* or 0 72px for wide layout */
  animation: trace-reveal 0.3s var(--trace-out);
}
```

Replace old: `font-family: Poppins`, `background: var(--bg-primary)`, `min-height: 100vh`, `padding: 40px 20px`, `animation: *FadeIn 0.7s { translateY(30px) }`.

### Flat Section Plate (replaces `.section-card`)
A ruled plate, not a card. No radius, no blur, no gradient.

```css
.trace-plate {
  position: relative;
  padding: 28px 0 32px;
  border-bottom: 1px solid rgba(255,255,255,0.055);
}
/* or for side-by-side column layout: */
.trace-plate--bordered {
  padding: 28px 32px;
  background: rgba(255,255,255,0.015);
  border: 1px solid rgba(255,255,255,0.07);
}
```

### Section Header (replaces `.section-title` with emoji icon)
```css
.trace-section-head {
  display: flex; align-items: center;
  justify-content: space-between;
  height: 44px; flex-shrink: 0;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.trace-section-eyebrow {
  font-size: 0.56rem; font-weight: 600;
  letter-spacing: 0.30em; text-transform: uppercase;
  color: rgba(255,255,255,0.13);
}
.trace-section-title {
  font-size: 0.86rem; font-weight: 600;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: rgba(255,255,255,0.55);
}
/* Active/hover: title steps up without color */
.trace-section-title.active { color: #ffffff; }
```

### Subsection title (replaces `.subsection-title` with colored text + rule)
```css
.trace-subsection {
  display: flex; align-items: center;
  font-size: 0.62rem; font-weight: 600;
  letter-spacing: 0.28em; text-transform: uppercase;
  color: rgba(255,255,255,0.22);
  margin: 28px 0 14px;
  gap: 14px;
}
.trace-subsection::after {
  content: ''; flex: 1; height: 1px;
  background: linear-gradient(90deg, rgba(255,255,255,0.07), transparent 85%);
}
```
Note: remove the old colored `subsection-title` (accent-colored text). Use white-opacity only.

### Item Card (unit cards, emitter cards, prop cards)
```css
.trace-item {
  position: relative;
  padding: 18px 20px;
  background: rgba(255,255,255,0.015);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 0;
  transition: background 0.2s linear, border-color 0.2s linear;
}
.trace-item:hover { background: rgba(255,255,255,0.025); border-color: rgba(255,255,255,0.12); }
.trace-item.selected {
  background: color-mix(in srgb, var(--tab-color) 6%, transparent);
  border-color: color-mix(in srgb, var(--tab-color) 40%, rgba(255,255,255,0.12));
}
/* Left accent — the tick's sibling: a hairline at the left edge, only when selected */
.trace-item.selected::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0;
  width: 2px; background: var(--tab-color);
  box-shadow: 0 0 8px var(--tab-glow);
}
```

Replace old: `border: 2px solid`, `box-shadow: 0 0 30px glow`, `transform: translateX(3px)`, `backdrop-filter`, gradient backgrounds.

---

## 14. Status / Data Readouts

Inline status badge (`.trace-badge`):
```css
.trace-badge {
  font-size: 0.56rem; font-weight: 600;
  letter-spacing: 0.14em; text-transform: uppercase;
  padding: 2px 7px;
  border: 1px solid currentColor;
  opacity: 0.8;
}
.trace-badge--ok     { color: rgba(0,200,100,0.75); border-color: rgba(0,200,100,0.25); }
.trace-badge--warn   { color: rgba(255,140,0,0.80); border-color: rgba(255,140,0,0.25); }
.trace-badge--soon   { color: rgba(255,255,255,0.35); border-color: rgba(255,255,255,0.12); }
.trace-badge--accent { color: var(--tab-color); border-color: color-mix(in srgb, var(--tab-color) 35%, transparent); }
```

---

## 15. Scrollbar

```css
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.35); }
```

---

## 16. Focus & Selection

```css
*:focus-visible {
  outline: 1px solid rgba(255,255,255,0.7);
  outline-offset: 2px;
}
::selection { background: rgba(255,255,255,0.85); color: #000; }
```

---

## 17. Overlay / Modal

Modals follow the same plate grammar. No floating card with radius.

```css
.trace-overlay-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.80);
}
.trace-overlay {
  position: fixed; z-index: 1001;
  background: #070708;
  background-image: radial-gradient(circle, rgba(255,255,255,0.022) 1px, transparent 1px);
  background-size: 28px 28px;
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 0;
  /* no box-shadow with huge spread, at most: */
  box-shadow: 0 40px 80px rgba(0,0,0,0.85);
}
```

Replace old: `border-radius: 8px`, `backdrop-filter: blur(4px)` on backdrop, gradient-filled card.

---

## 18. What To Delete

The following patterns must be **removed** when migrating a tab:

| Pattern | Reason |
|---|---|
| `backdrop-filter: blur()` on any element | No glass in the system |
| `background: linear-gradient(135deg, rgba(255,255,255,0.05)...)` on cards | Flat plate only |
| `transform: translateY(-3px) scale(1.005)` on hover | No floating |
| `transform: translateY(-4px)` on button hover | Max 1px mechanical press |
| `box-shadow: 0 20px 60px ... 0 0 50px var(--tab-glow)` on cards | Ambient only, not floating |
| `font-family: 'Poppins'` on UI labels | Space Grotesk for labels |
| `animation: *FadeIn { translateY(30px) }` | Clip-path print instead |
| 3px colored top border (`.section-card::before`) | Use tick or hairline |
| `border-radius: 8px` or similar on panels | 0 or 2px max |
| Emoji in section titles / headings | Remove |
| Colored text on labels/titles (not status, not accent-word) | White opacity ladder only |
| `filter: drop-shadow(...)` on icons that animate | Static accent only |

---

## 19. Tab Entry Animation

Replace every `@keyframes *FadeIn { from: opacity:0; translateY(30px) }` with:

```css
@keyframes trace-tab-enter {
  from { clip-path: inset(0 0 4% 0); opacity: 0; }
  to   { clip-path: inset(0 0 0 0); opacity: 1;  }
}
.trace-tab { animation: trace-tab-enter 0.28s var(--trace-out) both; }
```

Or, if the tab has a header row that prints anyway, skip the tab-level animation entirely — the sequenced row reveals do the same job.

---

## 20. Namespace Convention

To avoid class collisions across 20+ CSS files:

| Scope | Prefix | Example |
|---|---|---|
| Global TRACE system (new shared) | `trace-` | `.trace-btn`, `.trace-tick` |
| Tab-specific | `<toolid>-` | `.emitter-unit-card` |
| Settings console | `stc-` / `st-` | already correct |
| Banner | `bnr-` | already correct |
| Home screen | `hs-` | already correct |
| Navbar | `mnb-` | already correct |

When a tab element is identical across multiple tabs (e.g. item card, path input), it goes into `shared/trace.css` with a `trace-` prefix. Tab-specific variations (unique layout, special states) keep their own prefix.

---

## 21. Implementation Roadmap

### Phase 1 — Foundation (one file change, zero regressions)
1. Add `src/components/shared/trace.css` containing: variables/easings, tick, trace, buttons, form controls, section plate, trace-badge
2. Import it after `shared.css` in each tab (no class renames yet — additive)

### Phase 2 — Per-Tab Migration (one tab at a time)
For each tab:
1. Replace `background: var(--bg-primary)` → `#070708` + dot grid
2. Replace `font-family: Poppins` on labels → `Space Grotesk`
3. Replace `section-card` → `trace-plate` (remove blur, gradient, hover lift)
4. Replace `btn-primary` → `btn-action btn-action--accent`
5. Replace `btn-secondary` → `btn-ghost-trace`
6. Replace `@keyframes *FadeIn` → clip-path or remove
7. Replace 3px top bar → left tick on selected items
8. Replace item card hover (translateX, glow box-shadow) → trace-item pattern

### Phase 3 — Cleanup
1. Remove redundant per-tab color rules (`emitter-btn-generate`, etc.) where covered by `trace-` classes
2. Remove `backdrop-filter` from all remaining places
3. Consolidate modals and overlays to `trace-overlay`
