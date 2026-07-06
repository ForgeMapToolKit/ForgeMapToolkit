# FMT UI Unification — Diagnose & Fahrplan

> Aktualisiert: Juni 2026. Reflektiert den Stand nach Step 1 (Ordnerstruktur & Import-Pfade).
> `FMT_LAYOUT_SYSTEM.md` ist die verbindliche Layout-Referenz — dieses Dokument ist der Fahrplan.

---

## Diagnose (kurz)

**Was funktioniert:** Token-Basis sauber, Tab-Farben zentral, `TabLayout`
in allen Tabs aktiv, Build grün, keine broken Imports.

**Das eigentliche Problem: drei Ursachen, eine Konsequenz.**

1. **Zwei parallele Primitive-Schichten** — `primitives.css` (Wreckage/Props/Emitter)
   und `trace.css` (Skybox/Stars/CustomProps/RockErosion) haben beide Buttons,
   Inputs, Toggles. Kein Tab mischt sie, aber jeder neue Tab landet zufällig
   in einer der beiden Welten. Solange beide existieren gibt es keine Einheitlichkeit.

2. **Kein implementiertes Layout-Variant-System** — `TabLayout` existiert, aber
   `layoutMode` (x/y/z/w) ist noch nicht gebaut. Jeder Tab bastelt sein eigenes
   Layout neben der Shell.

3. **Linien ohne Hierarchie** — 7 verschiedene Klassen erzeugen horizontale
   Linien mit identischem visuellen Gewicht. Der Nutzer verliert die Orientierung
   weil jede Grenze gleich stark ist.

**Konsequenz:** Drift ist strukturell unvermeidbar. Nicht durch mangelnde
Disziplin, sondern weil das Fundament mehrere gleichwertige Antworten
auf dieselbe Frage gibt.

---

## Fahrplan

### ✅ Schritt 1 — Ordnerstruktur & Import-Pfade

**Abgeschlossen.**

**Neue Struktur (aktuell):**

```
src/components/
├── Core/                        ← App-Shell, Routing, Navbar, Home
├── Modals/                      ← notifications.js, root.css
├── Shared/
│   ├── DesignSystem/            ← tokens.css, primitives.css, layout.css, index.css
│   ├── Libraries/               ← EmitterLibrary, PropsLibrary, SkyboxLibrary, UnitLibrary
│   ├── MapLogic/                ← Hooks + IO, kein CSS
│   ├── Ui/
│   │   ├── EntityPanel/         ← EntityPanel.jsx + EntityPanel.css (ex entity-console)
│   │   ├── HelpPanel/           ← HelpPanel.jsx + Sections/
│   │   └── TabLayout/           ← TabLayout.jsx (ex WorkspaceConsole)
│   ├── shared.css
│   └── trace.css
└── Tabs/
    ├── Placement/               ← Emitter, Props, Wreckage
    ├── Scenery/                 ← CustomProps, RockErosion, Trees
    ├── Skybox/                  ← SkyboxGenerator, Stars
    ├── Tools/                   ← AdaptiveMapHelper, History, MapResizer, PreviewImage, Scmap
    ├── CoOp/
    ├── Community/
    ├── Config/
    ├── Guides/
    └── HelpModals/              ← wird in späterem Schritt collociert
```

**Naming Conventions:**
- Ordner + `.jsx`/`.css` Komponenten → PascalCase
- `.js` Utilities, Hooks, Datendateien → camelCase
- Standalone CSS ohne Komponente → lowercase
- Section-Dateien haben keinen Tab-Präfix mehr (`Configuration.jsx`, nicht `Wreckage_Configuration.jsx`)

---

### ⬜ Schritt 2 — Tab-Anamnese

**Abgeschlossen — Ergebnis in `FMT_LAYOUT_SYSTEM.md`.**

Layout-Assignments pro Tab und Section sind vollständig dokumentiert.
Vier Layout-Typen: **X** (Controls + Aside), **Y** (Controls + Standby),
**Z** (Full Width + Internal Grid), **W** (Full Width + Top Bar).

Keine weitere Analyse nötig — direkt zu Schritt 3.

---

### ⬜ Schritt 3 — Fundament ausbauen

#### 3a. `TabLayout.jsx` — `layoutMode` Prop einbauen

Ziel-API laut `FMT_LAYOUT_SYSTEM.md`:

```jsx
<TabLayout
  layoutMode="x"           // 'x' | 'y' | 'z' | 'w'
  controlsWidth="fixed"    // X only: 'fixed' | 'half'
  groupMode="parallel"     // Z only: 'parallel' | 'exclusive'
  secondRail={[…]}         // Z · exclusive only, optional
  canvasToolbar={true}     // W only: true | false
  ghostLabel="STARS"       // Y only
  readout={['50 STARS']}   // Y only
  sections={[…]}
  activeSection={…}
  onSelect={…}
/>
```

Neuer `StandbyField`-Subkomponent für Layout Y:
`Shared/Ui/StandbyField/StandbyField.jsx` — ghostLabel, readout, cursorVisible.

#### 3b. `Shared/DesignSystem/primitives.css` vervollständigen

Genau **5 Button-Klassen**, keine Duplikate zu `trace.css`:

```
action-button     ← secondary / inline action
button-solid      ← filled CTA / modal confirm
button-ghost      ← NEU: bordered, kein Fill (Library-Buttons, Help)
button-danger     ← NEU: destructive bordered
commit-button     ← signature primary (via OutputChecklist)
```

#### 3c. Linien-Hierarchie fixieren

Genau **3 semantische Ebenen**:

| Ebene | Bedeutung | Klasse | Visuell |
|---|---|---|---|
| 1 — Section | Trennt Rail-Sections | TabLayout-intern | Kein Border, nur Raum |
| 2 — Gruppe | Trennt thematische Blöcke | `.group-head` | Hairline + Accent-Tick links |
| 3 — Item | Trennt Listeneinträge | — | Nur `gap`, kein Strich |

Zu löschen / deaktivieren: `divider`, `subsection-head`, `check-row`-Border,
`trace-plate`-Border. `trace-section-head` und `trace-subsection` bleiben
für faltbare Subsections.

#### 3d. Schriftgrößen auf `--text-*` Tokens vereinheitlichen

Einzige erlaubte Quellen:

```css
--text-3xs: 0.54rem   /* eyebrows, register-labels */
--text-xs:  0.62rem   /* chip-labels, badge */
--text-sm:  0.68rem   /* hints, captions */
--text-md:  0.72rem   /* body, check-labels */
--text-lg:  0.8rem    /* card-titles, option-labels */
--text-input: 11px    /* controls: inputs, buttons — px wegen Sub-Pixel */
```

Alle direkten `font-size`-Werte in `primitives.css`, `layout.css`, `trace.css`
werden auf diese Tokens umgestellt.

#### 3e. CSS-Bereinigung (nach 3a–3d)

- `shared.css` — Inhalte nach `primitives.css` oder löschen
- `trace.css` — Keyframes → `DesignSystem/keyframes.css` (NEU), Controls → `primitives.css`, Rest löschen
- `Shared/DesignSystem/index.css` — Tailwind-Import gehört in main entry, nicht hier

**Regel danach:** Eine Klasse existiert genau einmal, in genau einer Datei.

---

### ⬜ Schritt 4 — Erster Tab (Pilot): Wreckage

Erst wenn Schritt 3 abgeschlossen ist.

**Vorgehen pro Tab:**

1. **Anamnese** — welche Klassen nutzt dieser Tab? Grep-Audit.
2. **Layout setzen** — `layoutMode` Prop laut `FMT_LAYOUT_SYSTEM.md`.
3. **Controls mappen** — jede bespoke Klasse → canonical Primitive.
4. **Linien prüfen** — max. 2 sichtbare Ebenen pro Section.
5. **Tab-CSS bereinigen** — nur noch feature-spezifisches, token-basiertes CSS.
6. **Smoke-Test** — visuell gegen Referenz-Screenshot, Build grün.

**Reihenfolge:**

```
Pilot:    Wreckage              (Gold Standard, Fundament-Validierung)
Welle 1:  Props, Emitter        (gleicher Typ X·fixed, minimaler Aufwand)
Welle 2:  SkyboxGenerator, Stars, CustomProps   (X·half + Z, trace.css-Controls)
Welle 3:  RockErosion, Trees, MapResizer, Scmap (Y + X·half, Controls)
Welle 4:  AdaptiveMapHelper, PreviewImage, History, CoOp, Contributions
Welle 5:  Settings              (Sonderfall, eigene Entscheidung nach Welle 4)
Cleanup:  HelpModals/ collocieren, Ordner löschen
```

---

## Definition of Done

**Fundament (Schritte 1–3):**
- [x] Ordnerstruktur bereinigt, alle Import-Pfade grün, Build grün
- [ ] `TabLayout.jsx` hat `layoutMode` Prop mit x/y/z/w + allen Variants
- [ ] `StandbyField` Subkomponent existiert in `Shared/Ui/StandbyField/`
- [ ] `primitives.css` hat genau 5 Button-Klassen, keine Duplikate zu `trace.css`
- [ ] `DesignSystem/keyframes.css` ist einzige Quelle für alle Animationen
- [ ] Schriftgrößen ausschließlich über `--text-*` Tokens
- [ ] Linien-Hierarchie: genau 3 Ebenen, dokumentiert
- [ ] `shared.css` und `trace.css` gelöscht oder auf Minimum reduziert

**Pro Tab:**
- [ ] Grep auf tab-eigene Button/Input/Select-Klassen → leer
- [ ] Grep auf hardcodierte Hex/px-Farben im Tab-CSS → leer
- [ ] Genau ein `layoutMode` gesetzt, kein eigenes Layout drumherum
- [ ] Max. 2 Linienebenen sichtbar pro Section
- [ ] Build grün, visueller Smoke-Test bestanden

**Vollständig:**
- [ ] `Tabs/HelpModals/` existiert nicht mehr
- [ ] Jede Klasse existiert genau einmal, in genau einer Datei
- [ ] Neuer Entwickler kann aus `DesignSystem/index.css` + `FMT_LAYOUT_SYSTEM.md`
      allein einen neuen Tab bauen der sofort zum Rest passt
