# ForgeMapToolkit — Architektur- & Fertigstellungs-Fahrplan

> Stand: 2026-06-15. Erstellt aus einem Repo-weiten Survey (~49k LOC JSX,
> 14 Electron-Module). Dieser Plan beschreibt das *Gesamtbild* und die Reihenfolge
> bis zur Fertigstellung — die Detail-Arbeit pro Tab kann separat erfolgen.

---

## 1. Bestandsaufnahme

### Fundament steht (gut)
- **Design-System** (`src/components/shared/design-system/`): `tokens.css`,
  `primitives.css`, `layout.css`. Alles läuft über **eine Achse**:
  `--tab-color` / `--tab-glow` / `--tab-glow-strong`, die ein Tab auf seinem Root setzt.
- **Neue UI-Bausteine**: `WorkspaceConsole/`, `entity-console/EntityConsole.jsx`,
  `help-console/`, sowie die frisch extrahierte Logik-Schicht `shared/map-logic/`
  (Hooks: `useMapInfo`, `useScmapPreview`, `useEmitterCategories`, `usePersistentState`;
  Utils: `mapGeometry`, `scmapIO`, `mapCanvas`).
- **Security-Baseline reif**: `nodeIntegration:false`, `contextIsolation:true`,
  Preload mit **Channel-Allowlist**, **CSP** (`electron/main.js`), Datei-IPC über
  `withPathGuard` (`electron/modules/file-ipc.js`), `execFile` statt `exec`.
- **Banner** unterstützt bereits per-Tool-Glow (`--current-glow` in `core/banner/Banner.jsx`).

### Die zentrale Lücke: Inkonsistenz
| Bereich | Adoptiert neues System | Legacy |
|---|---|---|
| **WorkspaceConsole-UI** | Emitter, Props, Wreckage, Scmap (4) | MapResizer, CustomProps, Contributions, RockErosion, SkyboxGenerator, AdaptiveMapHelper, Stars, PreviewImage, Trees, Settings, History, CoopVersioner (~12) |
| **HelpConsole** | Wreckage (1) | ~15× `tabs/HelpModals/*_help.jsx` |
| **map-logic Shared-Hooks** | Emitter/Props/Wreckage (3) | alle anderen duplizieren map-info/preview/scmap-IO |

→ Das eigentliche Projektziel ist nicht „neue Features", sondern **Vereinheitlichung
auf das bestehende System**. Genau das braucht Repo-weite Sicht.

---

## 2. Zielbild / Architektur-Prinzipien

1. **Ein Tab = eine dünne Orchestrierung** + Sektions-Komponenten + geteilte Hooks/Utils.
   (Vorlage: Emitter/Props/Wreckage nach dem letzten Refactor.)
2. **Logik gehört in `shared/map-logic`** (oder neue `shared/*`-Module), nicht in Tabs.
3. **Styling ausschließlich über Design-System-Tokens** + `--tab-color`. Keine
   hartkodierten Farben/Spacings in Tabs. Inline-`style={{…}}` schrittweise in CSS/Tokens.
4. **Hilfe ausschließlich über `HelpConsole`** + Section-Komponenten.
5. **Security**: jeder neue IPC-Channel muss in der Preload-Allowlist stehen *und*
   serverseitig Eingaben validieren (`withPathGuard` o. ä.).

**Voraussetzung für #2/#4 (UI-/Help-Migration):** ein **dokumentierter „Tab-Contract"**
(Authoring-Guide) — Props-Form, Sektions-Schnitt, welche Hooks/Tokens zu nutzen sind.
Damit kann die per-Tab-Arbeit zuverlässig delegiert werden (an dich oder andere KIs),
ohne dass jedes Mal das Gesamtbild neu erarbeitet werden muss.

---

## 3. Priorisierter Fahrplan

Sortiert nach **Hebel = Wert ÷ (Risiko × Abhängigkeit)**.

> **Update 2026-07-08:** Phase 0 und der Kern von Phase 2 sind inzwischen gelandet
> (siehe unten) — `docs/UI_UNIFICATION_ROADMAP.md` (der parallele UI-Fahrplan, der
> das im Detail trackte) wurde nach hier gemergt und gelöscht, damit es nur noch
> einen Fahrplan gibt. Phase 4/5 unten sind seit 15.06. nicht neu verifiziert.

### Phase 0 — Spezifikation & Quick Wins (klein, schaltet alles frei)
- [x] **Tab-Contract / Authoring-Guide** (`docs/TAB_CONTRACT.md`) — geschrieben,
  Stand 2026-07-08 gegen Wreckage/Props/Emitter verifiziert.
- [x] **Tab-Farb-Registry zentralisiert**: `Shared/DesignSystem/tokens.css` §11
  PER-TAB ACCENT REGISTRY ist die einzige Quelle; `Core/Home/Data/toolRegistry.js`
  (Nav-Metadaten) + `Core/tabRoutes.jsx` (Render-Wiring) referenzieren sie.
- [ ] **Feature #3 — Banner-Akzent folgt Hover-Tab** (Homepage). Nicht erneut
  verifiziert seit 15.06. — Status unklar, vor Weiterarbeit kurz gegenchecken.

### Phase 1 — Logik-Konsolidierung (entlastet jede spätere Tab-Migration)
- [x] `Shared/MapLogic` (`usePersistentState`, `useMapInfo`, `useScmapPreview`,
  `scmapIO`, `mapGeometry`, `mapCanvas`) ist für Wreckage/Props/Emitter der einzige
  Weg zu map-info/preview/scmap-IO — kein dupliziertes IPC mehr in diesen drei Tabs.
  Ein separater `useEmitterCategories`-Hook wurde **nicht** gebaut; Kategorie-Matching
  läuft stattdessen über `EmitterToggleBlock` direkt in der Entity-Karte (Declare-
  Source/Inherit-Modell) — siehe `TAB_CONTRACT.md §2`.
- [ ] Adoption auf die restlichen Tabs (Phase 2) ausweiten — dort größtenteils noch
  offen; nicht erneut verifiziert.
- [ ] Gemeinsame, noch fehlende Utilities identifizieren (Library-Loader,
  README-Bau, Folder-Picker-Bestätigung) und nach `Shared/` ziehen.

### Phase 2 — UI-Migration aller Tabs (Feature #1 + #2, das große Stück)
Pro Tab nach Contract: **`TabLayout`**-Shell (vier Varianten X/Y/Z/W, siehe
`docs/LAYOUTS.md`) + Sektions-Split + Tokens. `primitives.css` liefert dafür die
`ctrl-*`-Kontrollfamilie + `commit-button` + `station` — kein separates
5-Klassen-Button-Set wie ursprünglich geplant, siehe `DESIGN_SYSTEM_MIGRATION.md §4`.

- [x] **Placement — Wreckage, Props, Emitter**: fertig, Gold-Standard, verifiziert
  2026-07-08. `layoutMode="x"` (Controls + Aside/MapPreview).
- [ ] **Welle 1 (klein/formlastig)** — PreviewImage, Stars, History, Settings
  → vsl. `layoutMode="y"` (Standby-Field statt Preview)
- [ ] **Welle 2** — MapResizer, AdaptiveMapHelper, CoOp, Contributions
  → gemischt `x·half` / `w` (AdaptiveMapHelper hat ein dominantes Canvas)
- [ ] **Welle 3 (groß, viel State)** — RockErosion, Trees, SkyboxGenerator, CustomProps
  → gemischt `x·fixed` / `z·parallel`
- [ ] **Welle 4** — Library-Overlays + Guides visuell ans System angleichen
- [ ] **Cleanup** — `Tabs/HelpModals/` auflösen, sobald Phase 3 (unten) durch ist

Layout-Typ pro Tab/Sektion ist in `docs/LAYOUTS.md` "Tab Overview" vorgemerkt,
gilt aber nur als Absichtserklärung, bis der jeweilige Tab tatsächlich migriert ist
→ *Jeder Tab einzeln baubar/testbar — ideal delegierbar.*

### Phase 3 — Help-System (Feature #4)
- [x] **Wreckage**: migriert auf `Shared/Ui/HelpPanel/HelpPanel.jsx` (`HelpConsole`
  + `HelpButton`) + Section-Komponenten. Vorlage: `Tabs/Placement/Wreckage/Help.jsx`.
- [ ] **Props, Emitter**: noch **nicht** migriert — hängen weiterhin an
  `Tabs/HelpModals/{Props,Emitter}_help.jsx` (eigenständige Modals ohne
  `HelpPanel`-Anbindung). Kleine, risikoarme Aufgabe, siehe `TAB_CONTRACT.md §7`.
- [ ] Die übrigen ~13 `HelpModals/*_help.jsx` (ein Tab pro noch nicht migriertem
  Tab aus Phase 2) auf `HelpPanel` + Section-Komponenten migrieren. Pro Tab klein
  und risikoarm, gut parallelisierbar.
- [ ] `HelpPanel`-UI final polieren (offener Punkt laut deiner Liste).

### Phase 4 — Qualität: Bugs (Feature #5)
- [ ] **Build-Hardening zuerst**: ESLint + `eslint-plugin-react-hooks` einführen
  (derzeit keine Lint-Stufe → Hook-/Dead-Code-Fehler fallen erst zur Laufzeit auf).
  Das findet eine ganze Bug-Klasse automatisch.
- [ ] **Verifizierungs-Routine**: pro migriertem Tab `npm run build` + App-Smoke-Test
  (Map laden → Preview → Platzieren → Generate → SCMAP-Repack **und** Raw-Lua).
- [ ] Bekannte Risiko-Pfade gezielt prüfen: SCMAP unpack/pack, Mirror-Logik,
  Koordinaten-Parsing, Texture-Ops.

### Phase 5 — Security-Audit (Feature #6)
Baseline ist gut; der Audit ist read-only und kann früh laufen. Fokus:
- [ ] **Preload-Allowlist vs. tatsächliche Channels** abgleichen (verwaiste/fehlende).
- [ ] **`withPathGuard`-Abdeckung**: jeder Datei-schreibende/-lesende Channel muss
  geschützt sein; Roots/Traversal (`..`) prüfen.
- [ ] **`execFile`-Aufrufe** (`map-resizer.js`, `preview.js`, `settings.js`): Argumente
  nie aus ungeprüftem User-Input; `shell:false` bestätigen.
- [ ] **`shell.openPath`/`openExternal`** (`community.js`, `file-ipc.js:248`):
  URL/Pfad-Whitelist; keine beliebigen Programme.
- [ ] **CSP** schärfen (Dev erlaubt `eval`/localhost — sicherstellen, dass Prod strikt ist);
  `community.js`-BrowserWindows: `webSecurity`, Remote-Inhalte.

---

## 4. Zusätzliche Ideen (über deine Liste hinaus)

- **ESLint + Prettier + `react-hooks`-Regeln** als CI-/Pre-Commit-Gate → verhindert
  die Bug-Klasse, die wir beim Refactor manuell suchen mussten. (Höchster ROI.)
- **`package.json`: `"type"` setzen** — Build warnt bereits (`MODULE_TYPELESS_PACKAGE_JSON`).
- **Bundle-Splitting**: `main-*.js` ist ~4,4 MB. Three.js / Highlight.js / Libraries
  per `lazy()`-Import laden → schnellerer Start.
- **State-Persistenz formalisieren**: der `shared`/`onSharedChange`-Prefix-Mechanismus
  (`em_`/`pt_`/`wr_`) ist konventionsbasiert; eine kleine typisierte Helper-Schicht
  reduziert Tippfehler-Risiko bei neuen Tabs.
- **Smoke-Test-Harness**: minimaler Playwright/Electron-Test, der jeden Tab öffnet und
  auf Render-Fehler prüft — fängt Hook-Order-/Import-Fehler automatisch.
- **`components.zip` im `src/`** klären (eingecheckt, wird mitgetrackt) — gehört das ins Repo?

---

## 5. Empfehlung: das Wertvollste *jetzt*

Du willst die per-Tab-Arbeit selbst/mit anderen KIs machen — dein Engpass ist nicht
das Schreiben einzelner Tabs, sondern **Repo-weite Konsistenz & Spezifikation**.
Den größten Hebel habe genau ich, weil ich den ganzen Ordner sehe. Daher in dieser
Reihenfolge:

1. **Tab-Contract / Authoring-Guide** (`docs/TAB_CONTRACT.md`) — macht jede spätere
   Tab-Migration (Phase 2/3) für dich/andere KIs zuverlässig & uniform.
2. **Security-Audit-Report** (read-only, Phase 5) — findet konkrete Befunde, die nur
   mit Voll-Repo-Sicht auffallen.
3. **Feature #3 (Banner-Hover-Akzent)** + **Farb-Registry zentralisieren** — kleiner,
   abgeschlossener, sofort sichtbarer Quick Win.

Danach läuft die Tab-/Help-Migration als gut delegierbare Fließband-Arbeit gegen den Contract.
