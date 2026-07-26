# Tab-Contract — Authoring-Guide für ForgeMapToolkit-Tabs

> **Gegen den Code geprüft am 2026-07-26.**
>
> Verbindliche Bauanleitung für einen Tab im UI-System. Wer einen Tab neu baut oder
> migriert (du oder eine andere KI), folgt diesem Contract → das Ergebnis ist
> konsistent zum Rest der App ohne Repo-weites Vorwissen.
>
> **Scope-Hinweis (Ist-Stand):** Der Rollout ist durch — 19 von 25 Tab-Komponenten
> rendern `TabLayout`. Die sechs Ausnahmen sind bewusst oder tot, nicht "noch offen":
> `System/Settings` und `System/CliTerminal` (eigene Shell, absichtlich),
> `Textures/TextureEditor` (Graph-Canvas, TAB_UI_CONTRACT §11),
> `Textures/Viewer3D` (3D-Viewport, TAB_UI_CONTRACT §12), `Guides` (noch nicht
> geroutet), `CoOp` (toter Code). Details in `PROJECT_STRUCTURE.md`.
>
> *Auf `TabLayout` zu sein heißt nicht, `TAB_UI_CONTRACT` zu erfüllen.* Das misst
> `npm run lint:design`; die aktuellen Zahlen stehen in `TAB_UI_CONTRACT.md`.
>
> Referenz-Implementierungen zum Abschauen:
> `src/components/tabs/Emitter/{Wreckage,Props,Emitter}/` — die ältesten Tabs auf dem
> System und weiterhin die saubersten (je 0–2 Lint-Findings).
>
> ⚠️ **Pfad-Schreibweise:** Auf der Platte heißen die Ordner **klein**
> (`src/components/shared/`, `.../tabs/`), alle Imports schreiben sie **groß**
> (`Shared/`, `Tabs/`). Das funktioniert nur auf case-insensitiven Dateisystemen.
> Dieses Dokument nutzt die Import-Schreibweise, weil du sie beim Schreiben von Code
> brauchst. Hintergrund: `PROJECT_STRUCTURE.md`.

---

## 0. TL;DR — die 5 Regeln

1. **Ein Tab = dünne Orchestrierung.** Der Tab-Parent hält State/Hooks/Handler/Overlays
   und rendert pro Sektion eine eigene Komponente. Keine 1500-Zeilen-Datei.
2. **Logik kommt aus `Shared/MapLogic`** — nicht im Tab neu schreiben.
3. **Layout/Chrome kommt aus `Shared/`** — `TabLayout` + `EntityPanel`.
4. **Styling nur über Design-System-Tokens** + `--tab-color`. Keine Hex/px im Tab.
5. **Hilfe nur über `HelpPanel`.** Neue IPC-Channels nur mit Preload-Allowlist + Guard.
   (Ist-Stand: 6 von 19 Tabs mit Hilfe folgen Regel 5 — siehe §7.)

---

## 1. Datei- & Ordnerstruktur

```
Tabs/<Bereich>/<Name>/
  <Name>.jsx           ← Parent (Orchestrierung): State, Hooks, Handler, Overlays, Slots
  <Name>.css            ← nur tab-spezifische Ausnahmen; mappt --tab-color (s. §5)
  Configuration.jsx      ← Sektion 01
  <Entities>.jsx          ← Sektion 02 (Units / PropList / Emitters …)
  Export.jsx              ← Sektion 03 (letzte Sektion)
  Help.jsx                ← Hilfe via HelpPanel (s. §7)
```

Sektions-Dateien tragen **keinen Tab-Präfix** mehr im Dateinamen (`Configuration.jsx`,
nicht `WreckageConfiguration.jsx`) — der Tab-Parent importiert sie mit einem lokal
sinnvollen Alias, z. B. `import WreckageUnits from './Units.jsx';`. Sektions-Dateien
sind **rein präsentational**: sie destrukturieren Props und rendern JSX. Keine Hooks,
kein IPC, kein State darin (außer trivialen lokalen UI-Toggles).

Beispiel (echter Stand, `Tabs/Emitter/Wreckage/`):
```
Wreckage.jsx   Wreckage.css   Configuration.jsx   Units.jsx   Export.jsx   Help.jsx
```

---

## 2. Parent-Skelett

```jsx
const NameTab = ({ settings, shared = {}, onSharedChange = () => {}, onRecordSnapshot }) => {
  const s = shared;

  // 2a. Persistenter State — ein Kürzel pro Tab ('wr_'/'pt_'/'em_'), via usePersistentState
  const [mapName, setMapName] = usePersistentState(s, 'xx_mapName', '', onSharedChange);
  // … weitere Felder analog …

  // 2b. Abgeleiteter State über shared Hooks
  const { mapInfo, mapSize, mapOffsetX, mapOffsetY } = useMapInfo({
    mapName, mapsFolderPath, settings, onMapSize: v => onSharedChange('xx_mapSize', v),
  });
  const { previewImage, previewImageData, setPreviewImageData, previewLoading } =
    useScmapPreview({ mapName, mapsFolderPath, settings });

  // 2c. Lokaler UI-State (Auswahl, geöffnete Picker …) via useState
  // 2d. Handler (CRUD, Generate) — nutzen scmapIO/mapGeometry
  // 2e. Section-Props bündeln
  const configProps = { mapName, setMapName, mapInfo, /* … */ };
  // 2f. Render: <TabLayout> mit Sektions-Komponenten
};
```

Die drei Gold-Standard-Tabs nutzen jeweils ihr eigenes Kürzel: `wr_` (Wreckage),
`pt_` (Props), `em_` (Emitter). Neuer Tab → neues, eindeutiges Kürzel.

### Shared-Bausteine (Import aus `Shared/`)
- **`Shared/MapLogic`** (`index.js`) — die vollständige öffentliche Fläche:
  - Hooks: `usePersistentState`, `useMapInfo`, `useScmapPreview`, `useTerrainData`
  - Re-Exports (`export *`): `mapGeometry` (`getMirroredCoords`, `kmLabel`, …),
    `scmapIO` (`ensureDir`, `writeFile`, `readFile`, `injectPropsLua`,
    `resolveToolkitEmitterPublicPaths`, …), `mapCanvas` (`drawPlacementCanvas`, …)
  - Terrain: `createTerrainSampler`, `loadImageChannel`, `sampleChannel`,
    `STRATUM_SLOTS`, `shaderUsesHalfRange`, `computeDominantStratum`,
    `buildTerrainTypeBytes`
  > Ein Hook namens `useEmitterCategories` existiert **nicht** (mehr) — die
  > alte "Matching-Mode"-Sektion mit eigener Tab-Stufe wurde ersetzt durch
  > `EmitterToggleBlock` innerhalb der Entity-Karte (Declare-Source /
  > Inherit-from-Source-Modell) — s. §4.
- **`Shared/Ui/EntityPanel/EntityPanel.jsx`**: `EntityCard`, `EntityCardGrid`,
  `AddTile`, `CoordinateList`, `OutputChecklist`, `MapPreview`, `Dropdown`,
  `MirrorDropdown`, `EmitterToggleBlock`, `ToggleSwitch`, `DropSlot`, `useFileDrop`.
- **`Shared/Ui/TabLayout/TabLayout.jsx`**: die Konsolen-Shell (Sektions-Rail,
  Aside-/Standby-/Grid-/Toolbar-Slot je nach `layoutMode`). Nimmt `sections`,
  `activeSection`, `onSelect`, `layoutMode` (`'x'|'y'|'z'|'w'`, Default `'x'`),
  `asideSlot`, `asideMirror`, `asideCaption`, `renderEyebrow` u. a. —
  **die vollständige Prop-Liste mit echten Defaults steht in `docs/LAYOUTS.md`.**
  Eigene CSS-Datei hat `TabLayout` nicht; die Klassen liegen in
  `Shared/DesignSystem/layout.css`.
  Rail-Pin/Collapse-Status ist app-weit, nicht pro Tab — persistiert intern unter
  einem einzigen `localStorage`-Key (`RAIL_PINNED_KEY`), kein `railStorageKey`-Prop
  mehr.
  > Faustregel: **nichts übergeben = `layoutMode="x"` + `controlsWidth="half"`**,
  > und genau das nutzen 15 der 17 Tabs auf `TabLayout`. `controlsWidth="fixed"`
  > nutzt derzeit kein einziger Tab.
- **`Shared/Libraries/{UnitLibrary,EmitterLibrary,PropsLibrary}`**: die
  Overlay-Bibliotheken (z. B. `UnitLibraryOverlay`, `EmitterLibraryOverlay`),
  eigenständig importiert, nicht Teil von `EntityPanel`.
- **`Shared/Ui/Notifications/notifications.js`**: `luxuryAlert`, `luxuryConfirm`
  (nicht mehr unter `modals/`).

---

## 3. State- & Persistenz-Vertrag

- **Ein Kürzel pro Tab**: `wr_` (Wreckage), `pt_` (Props), `em_` (Emitter) …
  Neuer Tab → neues, eindeutiges Kürzel. Keys: `<kürzel>_<feldName>`.
- **Jedes** persistente Feld läuft über `usePersistentState(shared, key, initial, onSharedChange)`
  (unterstützt funktionale Updates wie `useState`). Kein manuelles `setXxxState`+Wrapper mehr.
- `mapInfo` (inkl. Größe/Offset) kommt **ausschließlich** aus `useMapInfo` —
  nicht selbst per `read-map-info`-Effekt nachbauen.
- Preview-Bild **ausschließlich** aus `useScmapPreview` — kein eigenes `loadPreviewFromScmap`.

---

## 4. Sektions-Komponenten & Props-Bündel

- Pro Sektion ein gruppiertes Props-Objekt im Parent, in die Komponente gespreadet:
  `{activeSection === 'config' && <WreckageConfiguration {...configProps} />}`.
- **Inline-Closures vermeiden**: Logik, die `setState(prev => …)` o. ä. nutzt, wird im
  Parent zu benannten Handlern (`onAddEntity`, `onToggleEmitter`, `onSetSource` …) und
  ins Props-Objekt gelegt. Sektionen bleiben dumm.
- Präsentationale Imports (`EntityCard`, `CoordinateList`, `EmitterToggleBlock`,
  `luxuryConfirm` …) stehen in der **Sektionsdatei**, nicht im Parent (der Parent
  importiert i. d. R. nur `MapPreview` + `MirrorDropdown` für den Aside-Slot).
- **Emitter-Zuordnung**: kein eigener Matching-Schritt mehr. `EmitterToggleBlock`
  sitzt in der ausgewählten Entity-Karte selbst und trägt `entity`, `entityIdx`,
  `allEntities`, `configuredEmitters`, `getEmitterName`, `labelOf` +
  `onToggleEmitter`/`onSetSource`/`onClearSource`/`onSetIsSource` als Props.

---

## 5. Styling-Vertrag (Design-System)

- Tab-Root mappt die Achse aus der **zentralen Registry** (`Shared/DesignSystem/tokens.css`
  §11 PER-TAB ACCENT REGISTRY):
  ```css
  .name-tab { --tab-color: var(--name-color);
              --tab-glow: var(--name-glow);
              --tab-glow-strong: var(--name-glow-strong); }
  ```
  **Niemals** Hex/rgba direkt für die Tab-Farbe setzen — immer `var(--<id>-…)`.
  Der Token-Id entspricht dem Tab-Id aus der Registry (z. B. `wreckages`, Plural —
  nicht `wreckage`).
- Neue Tab-Farbe? **Einen Block** in `tokens.css` (§11) + je einen Eintrag in
  `core/home/data/toolRegistry.js` (Nav-Metadaten) und `core/tabRoutes.jsx`
  (Render-Wiring). Sonst nichts. Die `id` muss in allen drei identisch sein.
  > Warnung zur Schreibweise: `toolRegistry.js` wird im Bestand mit **zwei**
  > verschiedenen Casings importiert (`../home/data/…` und `../Home/Data/…`) —
  > beide zeigen auf dieselbe Datei und funktionieren nur wegen des
  > case-insensitiven Dateisystems. Neue Imports bitte klein schreiben.
- Werte (Spacing/Typo/Ink/Lines/Radius/Shadow) **nur** über Tokens (`--space-*`,
  `--text-*`, `--ink-*`, `--line-*`, `--radius-*`, `--shadow-*`). Keine
  Magic-Numbers/Hex im Tab-CSS.
- Inline-`style={{…}}` in JSX nur für echt Dynamisches. Statisches Styling gehört
  ins CSS mit Tokens.
- **Lichtmodus existiert.** `tokens-light.css` kollabiert die Pro-Tab-Akzente auf
  einen gemeinsamen Steel-Akzent, getoggelt über `document.documentElement.dataset.theme`
  (aus `settings.colorTheme`, gesetzt in `core/ForgeMapToolkit.jsx`). Referenziere
  immer `var(--tab-color)` — nie die Registry-Variable direkt — damit der Tab in
  beiden Modi korrekt einfärbt.

---

## 6. Datei-Generierung & IPC

- SCMAP/props.lua-Ausgabe **immer** über `Shared/MapLogic`: `injectPropsLua({ mapFolderPath,
  content, exportRawLua })`, `ensureDir`, `writeFile`, `resolveToolkitEmitterPublicPaths`.
  Keinen Unpack→Pack→copy-back-Flow im Tab duplizieren.
- Map-Namen/Label kommen aus `kmLabel(size)` und dem `mapInfo`-Objekt von `useMapInfo`.

---

## 7. Hilfe-System

- **Zielbild**: Hilfe als `<Name>/Help.jsx` über **`Shared/Ui/HelpPanel/HelpPanel.jsx`**
  (Default-Export `HelpConsole`, Named-Export `HelpButton`) + Section-Komponenten aus
  `Shared/Ui/HelpPanel/Sections/index.js` (`WorkflowSection`, `MediaSection`,
  `TroubleshootSection`, `ShortcutsSection`, `CodeSection`).
  Vorlage: `Tabs/Emitter/Wreckage/Help.jsx`.

- **Ist-Stand (2026-07-26)** — sechs Tabs sind auf `HelpPanel`:

  | Auf `HelpPanel` (`Help.jsx`) | Noch auf `Tabs/HelpModals/*_help.jsx` |
  |---|---|
  | `Emitter/Wreckage` | `Emitter/Props` · `Emitter/Emitter` |
  | `Emitter/TerrainType` | `Scenery/CustomProps` · `Scenery/RockErosion` · `Scenery/Trees` |
  | `Textures/WaveNormals` | `Skybox/Stars` |
  | `Skybox/SkyboxGenerator` | `MapTools/{AdaptiveMapHelper,MapResizer,PreviewImage,Scmap}` · `System/History` |
  | `MapTools/BiomeChanger` | `Community/Contributions` |
  | `MapTools/FloatingTrees` | |

  Die Modal-Variante ist eigenständiges Markup ohne `HelpPanel`-Anbindung, mit inline
  gesetztem `--tab-color`. Das ist kein Dokufehler, sondern eine offene
  Migrationsaufgabe: beim nächsten Berühren eines dieser Tabs auf
  `Help.jsx` + `HelpPanel` umstellen.

- **Toter Code in `Tabs/HelpModals/`:** `Wreckage_help.jsx` wird von niemandem mehr
  importiert (die lebende Wreckage-Hilfe ist `Wreckage/Help.jsx`) — kann weg.
  Umgekehrt importiert `CoOp.jsx` ein `CoopVersioner_help.jsx`, **das es nicht gibt**;
  der CoOp-Tab ist deshalb ohnehin nicht baubar und nicht geroutet
  (s. `PROJECT_STRUCTURE.md`).

- `design-lint` sieht die Modals: die 13 `*_help.jsx` stellen mit ~180 ORPHAN-Findings
  den mit Abstand größten Block der Lint-Ausgabe. Wer einen Tab auf `HelpPanel`
  umstellt, räumt damit automatisch einen zweistelligen Findings-Block ab.

---

## 8. Security-Vertrag (bei neuen IPC-Channels)

- Jeder neue Channel muss in der **Preload-Allowlist** stehen (`electron/preload.js`,
  `INVOKE_CHANNELS`-Set), sonst wird `invoke()` mit einem Fehler abgewiesen.
  Größenordnung: derzeit **123 `ipcMain.handle`-Kanäle über 25 Module** in
  `electron/modules/`.
- Datei-schreibende/-lesende Handler **müssen** durch `withPathGuard`
  (`electron/modules/file-ipc.js`, basierend auf `electron/modules/security.js`)
  laufen. `isPathAllowed()` prüft den aufgelösten Zielpfad gegen statische Roots
  (`userData`, `temp`, `appPath`) plus dynamische, live aus den Settings gelesene
  Roots (`mapsFolder`, `faInstallPath`, `backupFolder`, `emitterBpFolder`, …) via
  `path.resolve()` + `startsWith()`.
- Externe Programme/URLs (`shell.openPath`/`openExternal`) nur mit Whitelist.
- Prozesse nur via `execFile` (nie `exec`), Argumente nie aus ungeprüftem User-Input.

---

## 9. Definition of Done (Checkliste pro Tab)

- [ ] Parent < ~400 Zeilen, nur Orchestrierung; je Sektion eine Datei ohne
      Tab-Präfix im Dateinamen.
- [ ] Kein dupliziertes map-info / preview / scmap-IO — alles aus `Shared/MapLogic`.
- [ ] State über `usePersistentState` mit eindeutigem Kürzel.
- [ ] Tab-Farbe via `var(--<id>-…)` aus `tokens.css` §11; keine Hex/px im Tab;
      funktioniert in Light- und Dark-Mode.
- [ ] Emitter-Zuordnung (falls zutreffend) über `EmitterToggleBlock`, nicht neu gebaut.
- [ ] Hilfe über `HelpPanel` (`Help.jsx`) — bei 13 Tabs noch offen (§7).
- [ ] `npm run build` grün.
- [ ] `npm run lint:design <TabName>` ohne ORPHAN/FOREIGN (die beiden lassen den Lauf
      mit Exit-Code 1 fehlschlagen). BOXED/LITERAL werden gemeldet, brechen aber nicht —
      dort ist eine menschliche Entscheidung nötig (§5 funktionale Boxen, §7 Datenfarbe).
- [ ] `npm run lint` (ESLint) grün.
- [ ] App-Smoke-Test: Map laden → mapInfo-Badge + Preview → Sektionen durchklicken →
      Generate (SCMAP-Repack **und** Raw-Lua) → Tab wechseln/zurück (State bleibt).
