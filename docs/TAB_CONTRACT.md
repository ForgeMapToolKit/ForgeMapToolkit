# Tab-Contract — Authoring-Guide für ForgeMapToolkit-Tabs

> Neu geschrieben 2026-07-08, um den tatsächlichen Code abzubilden. Die vorige
> Fassung beschrieb den Stand vor dem PascalCase-Rename (`shared/`, `tabs/`,
> `WorkspaceConsole`, `EntityConsole`) — der Rename ist gelandet, Pfade und
> Komponentennamen haben sich geändert.
>
> Verbindliche Bauanleitung für einen Tab im **neuen UI-System**. Wer einen Tab neu
> baut oder migriert (du oder eine andere KI), folgt diesem Contract → das Ergebnis
> ist konsistent zu Wreckage/Props/Emitter (Gold-Standard) ohne Repo-weites Vorwissen.
>
> **Scope-Hinweis:** Nur diese drei Tabs sind heute vollständig auf diesem Contract.
> Die meisten anderen Tabs (Skybox, Stars, RockErosion, Trees, Settings, History,
> Contributions, …) sind noch nicht oder nur teilweise migriert — ihr Code ist
> **keine** Referenz. Siehe `ROADMAP.md` Phase 2 für den Rollout-Stand.
>
> Referenz-Implementierungen zum Abschauen:
> `src/components/Tabs/Emitter/{Wreckage,Props,Emitter}/`.

---

## 0. TL;DR — die 5 Regeln

1. **Ein Tab = dünne Orchestrierung.** Der Tab-Parent hält State/Hooks/Handler/Overlays
   und rendert pro Sektion eine eigene Komponente. Keine 1500-Zeilen-Datei.
2. **Logik kommt aus `Shared/MapLogic`** — nicht im Tab neu schreiben.
3. **Layout/Chrome kommt aus `Shared/`** — `TabLayout` + `EntityPanel`.
4. **Styling nur über Design-System-Tokens** + `--tab-color`. Keine Hex/px im Tab.
5. **Hilfe nur über `HelpPanel`.** Neue IPC-Channels nur mit Preload-Allowlist + Guard.
   (Aktueller Ist-Stand: nur Wreckage folgt Regel 5 vollständig — siehe §7.)

---

## 1. Datei- & Ordnerstruktur

```
Tabs/<Bereich>/<Name>/
  <Name>.jsx           ← Parent (Orchestrierung): State, Hooks, Handler, Overlays, Slots
  <Name>.css            ← nur tab-spezifische Ausnahmen; mappt --tab-color (s. §5)
  Configuration.jsx      ← Sektion 01
  <Entities>.jsx          ← Sektion 02 (Units / PropList / Emitters …)
  Export.jsx              ← Sektion 03 (letzte Sektion)
  Help.jsx                ← Hilfe via HelpPanel (nur Wreckage bisher, s. §7)
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
- **`Shared/MapLogic`** (`index.js`): `usePersistentState`, `useMapInfo`,
  `useScmapPreview`, `getMirroredCoords`, `kmLabel`, `ensureDir`, `writeFile`,
  `readFile`, `injectPropsLua`, `resolveToolkitEmitterPublicPaths`,
  `drawPlacementCanvas`.
  > Ein Hook namens `useEmitterCategories` existiert **nicht** (mehr) — die
  > alte "Matching-Mode"-Sektion mit eigener Tab-Stufe wurde ersetzt durch
  > `EmitterToggleBlock` innerhalb der Entity-Karte (Declare-Source /
  > Inherit-from-Source-Modell) — s. §4.
- **`Shared/Ui/EntityPanel/EntityPanel.jsx`**: `EntityCard`, `EntityCardGrid`,
  `AddTile`, `CoordinateList`, `OutputChecklist`, `MapPreview`, `Dropdown`,
  `MirrorDropdown`, `EmitterToggleBlock`, `ToggleSwitch`, `DropSlot`, `useFileDrop`.
- **`Shared/Ui/TabLayout/TabLayout.jsx`**: die Konsolen-Shell (Sektions-Rail,
  Aside-/Standby-/Grid-/Toolbar-Slot je nach `layoutMode`). Nimmt `sections`,
  `activeSection`, `onSelect`, `layoutMode` (`'x'|'y'|'z'|'w'`, s.
  `docs/LAYOUTS.md`), `asideSlot`, `asideMirror`, `asideCaption`, `renderEyebrow`.
  Rail-Pin/Collapse-Status ist app-weit, nicht pro Tab — persistiert intern unter
  einem einzigen `localStorage`-Key (`RAIL_PINNED_KEY`), kein `railStorageKey`-Prop
  mehr. Emitter-Tabs nutzen ausschließlich `layoutMode="x"`.
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
  `Core/Home/Data/toolRegistry.js` (Nav-Metadaten) und `Core/tabRoutes.jsx`
  (Render-Wiring). Sonst nichts.
- Werte (Spacing/Typo/Ink/Lines/Radius/Shadow) **nur** über Tokens (`--space-*`,
  `--text-*`, `--ink-*`, `--line-*`, `--radius-*`, `--shadow-*`). Keine
  Magic-Numbers/Hex im Tab-CSS.
- Inline-`style={{…}}` in JSX nur für echt Dynamisches. Statisches Styling gehört
  ins CSS mit Tokens.
- **Lichtmodus existiert.** `tokens-light.css` kollabiert die Pro-Tab-Akzente auf
  einen gemeinsamen Steel-Akzent, getoggelt über `document.documentElement.dataset.theme`
  (aus `settings.colorTheme`, gesetzt in `Core/ForgeMapToolkit.jsx`). Referenziere
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
- **Ist-Stand**: Nur **Wreckage** folgt diesem Muster. **Props und Emitter binden
  weiterhin `Tabs/HelpModals/{Props,Emitter}_help.jsx`** ein — eigenständige
  Modal-Komponenten ohne `HelpPanel`-Anbindung, eigenes Markup, `--tab-color` inline
  gesetzt. Das ist kein Dokufehler, sondern eine offene, kleine Migrationsaufgabe:
  beim nächsten Berühren von Props/Emitter auf das `Help.jsx`+`HelpPanel`-Muster
  umstellen.
- `Tabs/HelpModals/` bleibt für die noch nicht migrierten Tabs bestehen; für
  Wreckage/Props/Emitter ist nur `Props_help.jsx`/`Emitter_help.jsx` noch aktiv
  referenziert (`Wreckage_help.jsx` dort ist tot — die lebende Wreckage-Hilfe ist
  `Wreckage/Help.jsx`).

---

## 8. Security-Vertrag (bei neuen IPC-Channels)

- Jeder neue Channel muss in der **Preload-Allowlist** stehen (`electron/preload.js`,
  `INVOKE_CHANNELS`-Set), sonst wird `invoke()` mit einem Fehler abgewiesen.
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
- [ ] Hilfe über `HelpPanel` (`Help.jsx`) — bei Props/Emitter derzeit noch offen (§7).
- [ ] `npm run build` grün.
- [ ] App-Smoke-Test: Map laden → mapInfo-Badge + Preview → Sektionen durchklicken →
      Generate (SCMAP-Repack **und** Raw-Lua) → Tab wechseln/zurück (State bleibt).
