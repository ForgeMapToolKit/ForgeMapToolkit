# TerrainType Auto-Paint — Implementierungsplan

> Erstellt 2026-07-23, **umgesetzt 2026-07-23** (Phasen 1–3). Ziel: ein FMT-Tool, das `terrainType.raw` **automatisch**
> aus den Stratum-Masken einer Map erzeugt. Der Nutzer ordnet jedem Stratum
> (Textur-Layer) einen Terrain-Type zu; FMT ermittelt pro Zelle das dominante
> Stratum und schreibt dort die zugeordnete Type-ID. Statt jede Fläche von Hand
> zu malen, entsteht der TerrainType-Layer aus dem, was ohnehin schon auf der
> Map liegt.
>
> Korrektheit hat Vorrang: das dominante Stratum wird nach dem realen
> Blend-Modell der Engine bestimmt, nicht nach dem größten Rohwert.
>
> **Tier 2 (exaktes Height-Sampling aus der Spiel-VFS) ist bewusst ausgeklammert**
> und hier nur als späterer Anschluss vermerkt.

## Umsetzungsstand (2026-07-23)

Gebaut, `npm run build` grün, Dominanz-Logik unit-getestet, App bootet fehlerfrei
mit dem neuen Tab („Terrain Type", Scenery). Dateien:

- `utils/generate-terraintypes.js` → `src/components/Tabs/Scenery/TerrainType/terrainTypes.json` (59 Typen)
- `electron/modules/dds-decode.js` — sync DDS→RGBA (aus props.js-Logik extrahiert)
- `electron/modules/terraintype.js` — IPC `scmap-read-strata` + `scmap-write-terraintype`
- `src/components/Shared/MapLogic/terrainTypeLogic.js` — `computeDominantStratum` / `buildTerrainTypeBytes` (+ Barrel-Export)
- `src/components/Tabs/Scenery/TerrainType/{TerrainType.jsx,.css}` — Tab + Preview + Help
- Verdrahtung: `tabRoutes.jsx`, `toolRegistry.js`, `tokens.css` / `tokens-light.css`, `preload.js`, `main.js`

Abweichung vom Plan: Dominanz-Rechnung läuft **renderer-seitig** (Shared-Logik),
Main liefert nur die resampelten Masken — so bleiben Threshold/Remap-Regler ohne
IPC-Roundtrip live. `data/terrainTypes.json` wurde zu einem tab-lokalen JSON-Import
statt `read-data-file`. **Offen: Validierung an einer echten Terrain200- und
TTerrainXP-Map** (Y-Orientierung + Dominanzgrenzen) — braucht die Desktop-App.

## Phase 0 — Recherche (abgeschlossen)

Quelle der Wahrheit: `D:\FAFEditor` (Unity-C#-Repo des FAF-Map-Editors).

### Die Terrain-Type-ID-Tabelle

Vollständig in
`D:\FAFEditor\Assets\Scripts\UI\Tools\Terrain\TerrainTypes\Layers Settings.asset`
(YAML). Pro Layer: `name, index (das Byte in terrainType.raw), color
(Editor-Overlay-Farbe), blocking, style, description`. Schema:
`TerrainTypeLayerSettings.cs`.

Eigenheiten, die im Code berücksichtigt werden müssen:

- **Indizes sind nicht fortlaufend.** Default = 1, Dirt01–09 = 2..9,
  Sand = 40/41, Vegetation = 80..84, Rocky/Concrete = 150..165,
  Termac = 190..192, Snowy = 200..202, Water = 220..240, Lava01 = 230.
  Die Type-ID ist also ein Byte-Wert aus einer Sparse-Tabelle, kein Listenindex.
- **Default-Fill ist Index 1**, nicht 0. Zellen ohne dominantes Ziel bekommen
  Default (1).
- `style` (0..7) = Biom/FX-Gruppe: `0 Default, 1 Evergreen, 2 RedRock,
  3 Desert, 4 Tropical, 5 Lava, 6 Geothermal, 7 Tundra`. Rein informativ für die
  UI (Gruppierung/Filter), nicht Teil des geschriebenen Bytes.
- `blocking=1` (Dirt09, Lava01) = Pathing-Block. **Das ist gewollt** — der Nutzer
  vergibt so gezielt unpassierbares Terrain (Cliffs, Rocks). Nicht ausschließen,
  nur als Badge kennzeichnen.

Die Tabelle wird 1:1 als `data/terrainTypes.json` in FMT gespiegelt (statisch
generiert aus dem `.asset`, damit wir nicht zur Laufzeit YAML parsen).

### Das Blend-Modell

`D:\FAFEditor\Assets\GFX\Shaders\FaTerrainShader.shader`, bestätigt in
`ScmapEditor.cs`. 9 Bodenschichten: `Lower` (Basis) + `Stratum0..7`, geordnete
Lerp-Kette:

```
albedo = lowerAlbedo
albedo = lerp(albedo, stratum0, mask0.x)   ... stratum3 → mask0.w
albedo = lerp(albedo, stratum4, mask1.x)   ... stratum7 → mask1.w
// danach Upper-Macro-Overlay — irrelevant fürs Terrain
```

- `mask0` = `UtilitySamplerA` = scmap **`textureMaskLow`** (Stratum 0–3, RGBA)
- `mask1` = `UtilitySamplerB` = scmap **`textureMaskHigh`** (Stratum 4–7, RGBA)

Sichtbarkeits-Anteil je Schicht (spätere Strata überdecken frühere):

```
w_i     = mask_i · ∏_{j>i} (1 − mask_j)        // Stratum 0..7
w_lower = ∏_{j}   (1 − mask_j)                  // Basis
```

**argmax über die 9 Gewichte = dominantes Stratum an dieser Zelle.** Das ist
exakt der Flächenanteil im Endbild.

### Shader-Varianten & die „blurriness"-Frage

Der Blend-Modus hängt vom Map-Shader ab, der in der scmap als `data.shaderPath`
liegt (`utils/scmap.js:447`; im Editor `map.TerrainShader`). shaderId-Switch:
`ScmapEditor.cs:1082`.

Zwei Masken-Interpretationen, pro Technique fest verdrahtet:

- **direkt** (`mask`) → weiche Übergänge
- **halfRange** (`saturate(mask·2 − 1)`) → scharfe Übergänge (≤0.5 unsichtbar)

Die Terrain1xx/2xx-Familie (häufig genutzt) blendet zusätzlich height-basiert via
`splatLerp` (`FaTerrainShader.shader:730`):

```
factor = saturate((t2height + opacity − 1 + 0.5·blurriness) / blurriness)
```

- `opacity` = Maskenwert (aus der scmap)
- `blurriness` = `SpecularColor.x`, per-Map gespeichert und lesbar; `contrast`
  (SpecularColor.g = 0.6) und 30°-Rotation sind konstant (`ScmapEditor.cs:1194`)
- `t2height` = Height-Kanal (.y/.w) der **Stratum-Textur**, hochfrequent
  gekachelt → liegt in der FA-VFS, **nicht in der scmap**

**Warum Masken-argmax auch für 1xx/2xx korrekt ist:** `terrainType.raw` hat nur
`size×size` Auflösung — gröber als die Textur-Kachelung. Über eine Zelle mittelt
`t2height` auf ~0.5, also `E[factor] ≈ opacity`. Der Masken-argmax ist damit der
korrekte *erwartete* Label, nicht bloß eine Näherung; die Height jittert nur die
Grenzlinie im Übergangsband (Breite ≈ blurriness) unterhalb der relevanten
Auflösung.

## Modell (die Rechnung, shaderunabhängig)

Pro Zelle `(x, y)` des terrainType-Grids:

1. Beide Masken an der Zelle sampeln (nach Resampling, s. u.) → 8 Kanalwerte
   `m[0..7] ∈ [0,1]`.
2. **Mask-Remap** je nach `shaderPath`:
   - halfRange-Shader: `m_i ← saturate(2·m_i − 1)`
   - sonst: `m_i` direkt
3. Gewichte `w_lower, w_0..w_7` nach obiger Formel.
4. `k = argmax`. `w_lower` gewinnt → Stratum-Slot „Lower".
5. Optionaler **Dominanz-Schwellwert** `τ`: ist `max(w) < τ`, Zelle bleibt Default
   (1). Verhindert Rauschen in gemischten Übergangszonen.
6. Stratum-Slot `k` → vom Nutzer zugeordnete Type-ID → Byte in `terrainType.raw`.

Stratum-Slot ↔ scmap-Layer-Mapping (fix):

| Slot        | Gewicht   | scmap `textures[]` | Maskenkanal      |
|-------------|-----------|--------------------|------------------|
| Lower       | `w_lower` | `textures[0]`      | — (Basis)        |
| Stratum 0–3 | `w_0..3`  | `textures[1..4]`   | `maskLow.RGBA`   |
| Stratum 4–7 | `w_4..7`  | `textures[5..8]`   | `maskHigh.RGBA`  |

(`textures[9]` = Upper-Macro, kein Boden-Layer.)

### Auflösung / Resampling

`terrainType` ist `size[0]×size[1]`. Die Mask-DDS haben eine eigene Auflösung —
**nicht annehmen**, aus dem DDS-Header lesen und per Nearest auf das
terrainType-Grid abbilden. Y-Achsen-Orientierung gegen den Editor gegenprüfen
(`TerrainTypeData[(j*Width)+i]`, Map.cs) — ein vertikaler Flip ist der
wahrscheinlichste Fehler und beim Validieren als Erstes auszuschließen.

## Phasenplan

### Phase 1 — Read-Layer + Rechenkern (Main-Prozess)

- `data/terrainTypes.json` aus dem `.asset` generieren (einmaliges Skript unter
  `utils/`, Ergebnis eingecheckt). Felder: `index, name, style, styleName,
  blocking, color, description`.
- IPC `scmap-read-strata`: liest aus der Binary (Muster wie `scmap-read-terrain`,
  `scmap.js:156`) `size`, `shaderPath`, `SpecularColor.x`, `textures[].path`,
  dekodiert `textureMaskLow/High` via vorhandenem DDS-Decoder
  (`props.js` `decodeDDSToPNG` / Block-Decoder) → 8 Kanal-Buffer + Meta.
- Reine Funktion `computeDominantStratum({ maskLow, maskHigh, size, shaderPath,
  threshold })` → `{ dominant: Uint8Array (Slot 0..8 pro Zelle), coverage:
  Float32Array }`. Slot 8 = Lower. Unit-getestet mit synthetischen Masken.
- Shader→Modus-Lookup (`halfRange: bool`) als Tabelle, gekeyed auf die
  `shaderPath`-Werte aus `ScmapEditor.cs:1082`. Unbekannt → halfRange=true
  (TTerrainXP-Default) + Warnung im Result.

### Phase 2 — FMT-Tab (UI)

Neuer Tool-Eintrag (Kategorie `generator`/Scenery), registriert nach der
`toolRegistry.js`-Konvention (Accent-Tokens in `tokens.css`, Eintrag in `TOOLS`,
Route in `ForgeMapToolkit.jsx`).

- Liste der 9 Stratum-Slots mit Albedo-Thumbnail (aus `textures[].path`, falls
  auflösbar; sonst Platzhalter + Pfadname) und je einem **Terrain-Type-Dropdown**
  (gruppiert nach `style`, `blocking` als Badge, `description` als Tooltip).
- **Dominanz-Vorschau** als farbcodiertes Overlay über der Map-Preview
  (Editor-Farben aus der Tabelle), nutzt die vorhandene Preview-Infrastruktur
  (`Shared/MapLogic`). Zeigt sofort, welche Fläche welchem Stratum zufällt.
- Schwellwert-Slider `τ` (Default konservativ, z. B. 0.5) und Mask-Remap-Toggle
  (auto aus `shaderPath` vorbelegt, manuell überschreibbar).
- Anzeige des erkannten `shaderPath` + Hinweis, wenn es ein height-splat-Shader
  ist („Vorschau ist der erwartete Label; exaktes Height-Sampling folgt").

### Phase 3 — Write-Back

- `terrainType.raw` neu erzeugen: pro Zelle Slot→ID, sonst Default (1).
- Zurückschreiben über den bewährten Unpack→Patch→Pack-Zyklus wie
  `scmap-patch-water` (`scmap.js:183`): IPC `scmap-write-terraintype` schreibt nur
  die `terrainType.raw` im entpackten Ordner, danach Pack.
- Vorher-Snapshot für History/Undo (bestehende Snapshot-Infrastruktur).

### Validierung (Gate vor „fertig")

An mindestens einer echten **Terrain200-Map** und einer TTerrainXP-Map:
argmax-Overlay gegen den sichtbaren Boden im Editor prüfen. Erst die
Y-Orientierung, dann die Dominanz-Grenzen. Abweichungen dokumentieren wie im
Wave-Normals-Nachtrag.

## Offen / später

- **Tier 2:** exaktes Height-Sampling der Stratum-Texturen aus der `D:\fa`-VFS für
  pixelgenaue Ränder bei 1xx/2xx. Braucht VFS-Zugriff über `textures[].path`;
  hoher Aufwand, geringer Gewinn bei einem groben Label → zurückgestellt.
- Symmetrie-Anwendung (der Editor malt symmetrisch) — prüfen, ob Auto-Paint das
  respektieren muss oder ob argmax über die ganze Map das ohnehin liefert.
- Batch über mehrere Maps.
