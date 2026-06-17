# Tab-Contract — Authoring-Guide für ForgeMapToolkit-Tabs

> Verbindliche Bauanleitung für einen Tab im **neuen UI-System**. Wer einen Tab neu
> baut oder migriert (du oder eine andere KI), folgt diesem Contract → das Ergebnis ist
> konsistent zu Emitter/Props/Wreckage (Gold-Standard) ohne Repo-weites Vorwissen.
>
> Referenz-Implementierungen zum Abschauen:
> `src/components/tabs/Emitter/{EmitterTab,PropsTab,WreckageTab}/`.

---

## 0. TL;DR — die 5 Regeln

1. **Ein Tab = dünne Orchestrierung.** Der Tab-Parent hält State/Hooks/Handler/Overlays
   und rendert pro Sektion eine eigene Komponente. Keine 1500-Zeilen-Datei.
2. **Logik kommt aus `shared/map-logic`** — nicht im Tab neu schreiben.
3. **Layout/Chrome kommt aus `shared/`** — `WorkspaceConsole` + `EntityConsole` + `MapPreview`.
4. **Styling nur über Design-System-Tokens** + `--tab-color`. Keine Hex/px im Tab.
5. **Hilfe nur über `HelpConsole`.** Neue IPC-Channels nur mit Preload-Allowlist + Guard.

---

## 1. Datei- & Ordnerstruktur

```
tabs/<Bereich>/<Name>Tab/
  <Name>.jsx              ← Parent (Orchestrierung): State, Hooks, Handler, Overlays, Slots
  <Name>.css              ← nur tab-spezifische Ausnahmen; mappt --tab-color (s. §3)
  <Name>_Configuration.jsx← Sektion 01
  <Name>_<Entities>.jsx   ← Sektion 02 (Units / PropList / Emitters …)
  <Name>_Matching.jsx     ← Sektion 03 (falls Emitter-Matching genutzt)
  <Name>_Export.jsx       ← Sektion 04
  <Name>_help.jsx         ← Hilfe via HelpConsole (s. §7)
```

Sektions-Dateien sind **rein präsentational**: sie destrukturieren Props und rendern JSX.
Keine Hooks, keine IPC, kein State darin (außo triviale lokale UI-Toggles).

---

## 2. Parent-Skelett

```jsx
const NameTab = ({ settings, shared = {}, onSharedChange = () => {}, onRecordSnapshot }) => {
  const s = shared;

  // 2a. Persistenter State — ein Prefix pro Tab ('xx_'), via usePersistentState
  const [mapName, setMapName] = usePersistentState(s, 'xx_mapName', '', onSharedChange);
  // … weitere Felder analog …

  // 2b. Abgeleiteter State über shared Hooks
  const { mapInfo, mapSize, mapOffsetX, mapOffsetY } = useMapInfo({
    mapName, mapsFolderPath, settings, onMapSize: v => onSharedChange('xx_mapSize', v),
  });
  const { previewImage, previewImageData, setPreviewImageData, previewLoading } =
    useScmapPreview({ mapName, mapsFolderPath, settings });
  const cats = useEmitterCategories({ entities, getCategories, emitters, emitterCategories,
                                      setEmitterCategories, matchingMode });

  // 2c. Lokaler UI-State (Auswahl, geöffnete Picker …) via useState
  // 2d. Handler (CRUD, Generate) — nutzen scmapIO/mapGeometry
  // 2e. Section-Props bündeln
  const configProps = { mapName, setMapName, mapInfo, /* … */ };
  // 2f. Render: <WorkspaceConsole> mit Sektions-Komponenten
};
```

### Shared-Bausteine (Import aus `shared/`)
- **`shared/map-logic`** (`index.js`): `usePersistentState`, `useMapInfo`, `useScmapPreview`,
  `useEmitterCategories`, `getMirroredCoords`, `finalizeMapName`, `kmLabel`,
  `ensureDir`, `writeFile`, `readFile`, `loadScmapPreview`, `injectPropsLua`,
  `nextPropsLuaName`, `resolveToolkitEmitterPublicPaths`, `drawPlacementCanvas`.
- **`shared/entity-console/EntityConsole.jsx`**: `EntityCard`, `EntityCardGrid`, `AddTile`,
  `CoordinateList`, `MatchingMode`, `OutputChecklist`, `EmitterAssignmentOverlay`, `MapPreview`.
- **`shared/WorkspaceConsole/WorkspaceConsole.jsx`**: die Konsolen-Shell (Sektions-Rail,
  Preview-Slot, Eyebrow). Nimmt `sections`, `activeSection`, `onSelect`, `previewSlot`,
  `mirrorSlot`, `ghostLabel`, `renderEyebrow`, `railStorageKey`.

---

## 3. State- & Persistenz-Vertrag

- Genau **ein Prefix pro Tab**: `em_` (Emitter), `pt_` (Props), `wr_` (Wreckage) …
  Neuer Tab → neues, eindeutiges Prefix. Keys: `<prefix>_<feldName>`.
- **Jedes** persistente Feld läuft über `usePersistentState(shared, key, initial, onSharedChange)`
  (unterstützt funktionale Updates wie `useState`). Kein manuelles `setXxxState`+Wrapper mehr.
- `mapSize` / `mapOffsetX/Y` / `mapInfo` kommen **ausschließlich** aus `useMapInfo` —
  nicht selbst per `read-map-info`-Effekt nachbauen.
- Preview-Bild **ausschließlich** aus `useScmapPreview` — kein eigenes `loadPreviewFromScmap`.

---

## 4. Sektions-Komponenten & Props-Bündel

- Pro Sektion ein gruppiertes Props-Objekt im Parent, in die Komponente gespreadet:
  `{activeSection === 'config' && <NameConfiguration {...configProps} />}`
  (oder via `sectionContent`-Objekt wie in Wreckage).
- **Inline-Closures vermeiden**: Logik, die `setState(prev => …)` o. ä. nutzt, wird im
  Parent zu benannten Handlern (`onAddCategory`, `onOpenLibrary`, `onRemoveMask` …) und
  ins Props-Objekt gelegt. Sektionen bleiben dumm.
- Präsentationale Imports (`EntityCard`, `CoordinateList`, `luxuryConfirm` …) stehen in
  der **Sektionsdatei**, nicht mehr im Parent (Parent importiert nur, was er selbst nutzt:
  i. d. R. `MapPreview` + `EmitterAssignmentOverlay`).

---

## 5. Styling-Vertrag (Design-System)

- Tab-Root mappt die Achse aus der **zentralen Registry** (`shared/design-system/tokens.css`):
  ```css
  .name-tab { --tab-color: var(--name-color);
              --tab-glow: var(--name-glow);
              --tab-glow-strong: var(--name-glow-strong); }
  ```
  **Niemals** Hex/rgba direkt für die Tab-Farbe setzen — immer `var(--<id>-…)`.
- Neue Tab-Farbe? **Einen Block** in `tokens.css` (Sektion „PER-TAB ACCENT REGISTRY") +
  einen Eintrag in `core/home/data/toolRegistry.js`. Sonst nichts.
- Werte (Spacing/Typo/Surfaces/Ink/Lines) **nur** über Tokens (`--space-*`, `--text-*`,
  `--surface-*`, `--ink-*`, `--line-*`). Keine Magic-Numbers/Hex im Tab-CSS.
- Inline-`style={{…}}` in JSX nur für echt Dynamisches (z. B. `--tab-color`-Injection am
  Root). Statisches Styling gehört ins CSS mit Tokens.

---

## 6. Datei-Generierung & IPC

- SCMAP/props.lua-Ausgabe **immer** über `scmapIO`: `injectPropsLua({ mapFolderPath,
  content, exportRawLua })`, `ensureDir`, `writeFile`, `resolveToolkitEmitterPublicPaths`.
  Keinen Unpack→Pack→copy-back-Flow im Tab duplizieren.
- Map-Namen via `finalizeMapName(name)`, km-Label via `kmLabel(size)`.

---

## 7. Hilfe-System

- Hilfe als `<Name>_help.jsx` über **`shared/help-console/HelpConsole.jsx`** +
  Section-Komponenten (`WorkflowSection`, `MediaSection`, `TroubleshootSection`,
  `ShortcutsSection`, `CodeSection`). Vorlage: `WreckageTab/Wreckage_help.jsx`.
- Alte `tabs/HelpModals/*_help.jsx` gelten als Legacy und werden bei der Migration ersetzt.

---

## 8. Security-Vertrag (bei neuen IPC-Channels)

- Jeder neue Channel muss in der **Preload-Allowlist** stehen (`electron/preload.js`),
  sonst wird er geblockt.
- Datei-schreibende/-lesende Handler **müssen** durch `withPathGuard` (`file-ipc.js`)
  oder eine äquivalente Pfad-/Root-Validierung laufen.
- Externe Programme/URLs (`shell.openPath`/`openExternal`) nur mit Whitelist.
- Prozesse nur via `execFile` (nie `exec`), Argumente nie aus ungeprüftem User-Input.

---

## 9. Definition of Done (Checkliste pro Tab)

- [ ] Parent < ~400 Zeilen, nur Orchestrierung; je Sektion eine Datei.
- [ ] Kein dupliziertes map-info / preview / scmap-IO / Matching — alles aus `shared`.
- [ ] State über `usePersistentState` mit eindeutigem Prefix.
- [ ] Tab-Farbe via `var(--<id>-…)` aus `tokens.css`; keine Hex/px im Tab.
- [ ] Hilfe über `HelpConsole`.
- [ ] `npm run build` grün.
- [ ] App-Smoke-Test: Map laden → mapInfo-Badge + Preview → Sektionen durchklicken →
      Generate (SCMAP-Repack **und** Raw-Lua) → Tab wechseln/zurück (State bleibt).
