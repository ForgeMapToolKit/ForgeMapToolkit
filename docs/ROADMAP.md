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
- [x] **Feature #3 — Banner-Akzent folgt Hover-Tab** (Homepage). Bestätigt
  2026-07-11 — Banner-Glow wechselt beim Hover über einen Tab korrekt die Farbe.

### Phase 1 — Logik-Konsolidierung (entlastet jede spätere Tab-Migration)
- [x] `Shared/MapLogic` (`usePersistentState`, `useMapInfo`, `useScmapPreview`,
  `scmapIO`, `mapGeometry`, `mapCanvas`) ist für Wreckage/Props/Emitter der einzige
  Weg zu map-info/preview/scmap-IO — kein dupliziertes IPC mehr in diesen drei Tabs.
  Ein separater `useEmitterCategories`-Hook wurde **nicht** gebaut; Kategorie-Matching
  läuft stattdessen über `EmitterToggleBlock` direkt in der Entity-Karte (Declare-
  Source/Inherit-Modell) — siehe `TAB_CONTRACT.md §2`.
- [x] **Adoption auf alle Tabs ausgeweitet** (2026-07-11) — repo-weiter Grep auf
  den rohen `read-map-info`-IPC-Call (der zuverlässigste Marker für eine
  `useMapInfo`-Duplikation) fand nur noch 2 Tabs mit eigener Logik statt
  Shared-Hooks: `MapResizer` (11 handgeschriebene `useState`+`onSharedChange`-Paare
  statt `usePersistentState`, eigener `read-map-info`-Fetch statt `useMapInfo`)
  und `AdaptiveMapHelper` (eigener SCMAP-Preview- + Map-Info-Fetch statt
  `useMapInfo`/`useScmapPreview`). Beide umgebaut, dazu `SkyboxGenerator`s 3 rohe
  `write-file`/`read-file`-Calls auf `writeFile`/`readFile` umgestellt. Alle
  anderen Tabs waren bereits sauber oder hatten dokumentierte, legitime
  Ausnahmen (z. B. Trees' `propCards` — nicht-serialisierbare Image-Objekte,
  kommentiert im Code; Trees/RockErosion chunked props.lua statt
  `injectPropsLua`, Absicht wegen Multi-File-Split). Live im Preview verifiziert
  (Map Resizer, Adaptive Map Helper, Skybox Generator — keine Konsolenfehler).
- [x] **Gemeinsame Utilities identifiziert und konsolidiert** (2026-07-11):
  - **README-Bau** — zentraler `utils/readmeGenerator.js` existierte bereits
    und wurde von 7 Tabs genutzt; `CustomProps` und `AdaptiveMapHelper` bauten
    ihr README noch komplett von Hand (eigene Box-Zeichnung, eigene Divider).
    Beide umgebaut auf `generateReadme`/`writeReadme`.
  - **Folder-Picker-Bestätigung** — kein Konsolidierungsfall: die
    `selectEmitterBpFolder`/`selectMapsFolder`-Funktionen in `Wreckage`/`Props`
    waren totes Legacy-Code (nirgends mehr verdrahtet, kein `onClick` referenziert
    sie) — Emitter-Pfad wird inzwischen hardcodiert relativ zum App-Root gesetzt,
    Maps-Ordner kommt aus dem Settings-Tab. Ersatzlos aus beiden Tabs entfernt,
    kein neuer Shared-Helper nötig.
  - **Library-Loader** — geprüft, **keine echte Duplikation**: `SkyboxLibrary`
    lädt Community-Assets von GitHub (`skybox-library-load/-fetch`, eigener
    Disk-Cache in `skybox.js`), während `UnitLibrary`/`PropsLibrary` auf
    lokalen Spieldaten arbeiten und `EmitterLibrary` einen separaten
    `library-load`-Kanal (`scanner.js`, Basis-Emitter + `scan-map-emitters`
    für Custom) nutzt — strukturell unterschiedliche Systeme, kein
    gemeinsamer Loader zum Extrahieren. Falls Props/Emitter künftig auch
    community-geteilte Assets browsbar machen sollen (analog zu Custom-
    Skyboxen), ist das ein Feature-Gap, keine Code-Duplikation — separates
    Thema, nicht Teil dieser Konsolidierung.
  - Alle Änderungen im Preview gegengecheckt (Wreckage, Props, CustomProps,
    AdaptiveMapHelper — sauberer Mount, keine Konsolenfehler).

### Phase 2 — UI-Migration aller Tabs (Feature #1 + #2, das große Stück)
Pro Tab nach Contract: **`TabLayout`**-Shell (vier Varianten X/Y/Z/W, siehe
`docs/LAYOUTS.md`) + Sektions-Split + Tokens. `primitives.css` liefert dafür die
`ctrl-*`-Kontrollfamilie + `commit-button` + `station` — kein separates
5-Klassen-Button-Set wie ursprünglich geplant, siehe `DESIGN_SYSTEM_MIGRATION.md §4`.

- [x] **Placement — Wreckage, Props, Emitter**: fertig, Gold-Standard, verifiziert
  2026-07-08. `layoutMode="x"` (Controls + Aside/MapPreview).
- [x] **Welle 1 (klein/formlastig)** — PreviewImage, Stars, History auf `TabLayout`
  verifiziert (2026-07-11, Grep + Preview-Mount-Check). **Settings** bewusst
  **ausgenommen** — laut `docs/LAYOUTS.md` "Exempt from this system —
  self-contained settings shell", keine `TabLayout`-Migration vorgesehen.
- [x] **Welle 2** — MapResizer, AdaptiveMapHelper, Contributions auf `TabLayout`
  verifiziert (2026-07-11). **CoOp/CoopVersioner** ist **kein echter Fall**:
  `Tabs/CoOp/CoOp.jsx` (`CoopVersioner`) ist nirgends in `core/tabRoutes.jsx`,
  `Navbar` oder `toolRegistry.js` referenziert — die Komponente ist unerreichbarer
  Legacy-Code, kein navigierbarer Tab. Migration ergibt erst Sinn, wenn geklärt
  ist, ob das Feature reaktiviert oder gelöscht wird (siehe Notiz unten).
- [x] **Welle 3 (groß, viel State)** — RockErosion, Trees, SkyboxGenerator,
  CustomProps auf `TabLayout` verifiziert (2026-07-11).
- [x] **Welle 4a — Library-Overlays auf Design-Tokens migriert** (2026-07-11):
  Alle 4 Overlays (`UnitLibrary`, `SkyboxLibrary`, `EmitterLibrary`,
  `PropsLibrary`) durchgegangen, kleinste zuerst. Pro Datei behoben:
  hartkodierte UI-Chrome-Farben (Weiß/Cyan/Orange) → `var(--ink-*)` bzw.
  `var(--tab-color)`; neuer geteilter Token `--source-custom-color/-glow`
  (`tokens.css`) ersetzt das in Props+Emitter identisch duplizierte `#f0a040`
  für "Custom"-Kategorie-Markierung; Filter-Panel-§5-Verstoß (Surface+Border
  gleichzeitig) in Props/Emitter behoben; "cheap count pills" (`.el-section-badge`,
  `.pl-type-selected-badge`, `.sl-img-count`) auf reinen Text ohne Box reduziert
  (Vorlage: `.ul-subcat-count`, das es schon richtig machte); Apply/Confirm-Buttons
  auf Secondary-CTA-Spezifikation (Border in Akzentfarbe, kein Fill im
  Ruhezustand) umgestellt; `PropsLibrary`s eigene `--tab-accent`-Variable auf
  die System-Konvention `--tab-color`/`--tab-glow` umbenannt. Legitime
  Datenfarben (Fraktionsfarben, Economy Mass/Energy/Time, UV/Cirrus-Layer)
  bewusst unangetastet gelassen. Alle 4 im Preview gegengecheckt (Overlay öffnen,
  Custom-Kategorie, Filter-Panel, Buttons — keine Konsolenfehler, Farben per
  `preview_inspect` stichprobenartig bestätigt).
  **Nicht gemacht** (bewusst außerhalb des Scopes, siehe Konsolidierungsnotiz):
  keine Migration auf `EntityCard`/`EntityCardGrid` — strukturell zu
  unterschiedliche Layouts (horizontale Fraktions-Karten vs. vertikale
  Prop-Karten vs. Emitter-Liste vs. Skybox-Karten+Carousel), hohes
  Risiko für wenig Nutzen.
  **Fund dabei (nicht behoben, separates Ticket)**: `PropsLibrary.jsx` rendert
  `<PropTextureEditor>`, aber importiert/definiert nur `TextureEditor` — die
  Texture-Editor-Übergabe nach "Apply" wirft vermutlich einen ReferenceError.
  Vorbestehender Bug, nicht durch diese Migration verursacht.
- [ ] **Welle 4b — Guides** ist noch **kein echter Tab** — `core/tabRoutes.jsx`
  rendert dafür nur einen `GuidesPlaceholder` ("Guides — SOON"); `GuideSection.jsx`
  existiert als Datei, ist aber nicht verdrahtet. Bleibt offen.
- [ ] **Cleanup** — `Tabs/HelpModals/` auflösen, sobald Phase 3 (unten) durch ist
  — weiterhin korrekt offen, alle 13 Legacy-Help-Dateien noch vorhanden.

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
- [ ] **Custom-Skybox-Rendering-Fix (Albedo)**: manche `.scmskybox`-Assets, die
  über die SkyboxLibrary bereitgestellt werden, haben ein Rendering-Problem mit
  ihrer Custom-Albedo-Textur. Ist spielseitig (wie SC das Skybox-Rendering
  handhabt), kein Toolkit-Bug — User untersucht/fixt das selbst zu einem
  späteren Zeitpunkt. Danach ggf. 1-2 weitere Custom-Skyboxen erstellen.

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
