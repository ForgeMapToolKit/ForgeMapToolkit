# Node Editor — Konzept & Implementierungsplan

> Erstellt 2026-07-23, **Status: Konzept (noch nicht umgesetzt)**. Ziel: die
> heute separaten Environment-/Textur-Generatoren (Skybox, WaveNormals,
> WaterRamp, Stars, künftig Cirrus/EnvCube) unter *eine* gemeinsame,
> node-basierte Engine hängen — einen prozeduralen **Textur-Composer**, der
> speziell auf den Supreme-Commander-Workflow zugeschnitten ist.
>
> Qualität hat Vorrang vor Laufzeit und vor Feature-Breite. Wo eine Abkürzung
> die spätere Wartbarkeit oder die Ausgabequalität kostet, wird sie nicht
> genommen. Lieber 12 exzellente Nodes als 50 mittelmäßige.
>
> Dies ist ein **Referenz- und Diskussionsdokument**, kein finaler Vertrag. Es
> hält den heute erreichten konzeptuellen Konsens fest. Änderungen sind
> erwartet — dieses Doc wird mit dem Bau mitgeführt (siehe die Plan-vs-Ergebnis-
> Konvention der bestehenden Plan-Docs).

---

## 0. Warum überhaupt — und der entscheidende Perspektivwechsel

FMT hat heute mehrere Generatoren, die sich UI-seitig stark unterscheiden, aber
technisch dasselbe Problem lösen: **sie erzeugen Texturen.** EnvCube, WaterRamp,
WaveNormal, Cirrus, Star-Atlas — jede dieser SupCom-Ressourcen ist am Ende nur
ein bestimmter **Output-Typ** derselben Pipeline.

Statt N separater Editoren also *ein* Graph, dessen Output-Node entscheidet, was
herauskommt. Das Vorbild ist konzeptuell Substance Designer / Blenders
Node-Compositor / Unreals Material-Graph — aber bewusst **klein und
SupCom-first**, nicht als Allzweck-Bildeditor.

### 0.1 Das eine Reframing, das alles trägt

In der Vorüberlegung tauchten „zwei Graph-Typen" auf:

- **Graph A — Texture *Generation*** (Noise → Warp → Blur → Levels), Substance-artig.
- **Graph B — Texture *Composition*** (Gradient → Planet → Stars → Clouds → Layer → Output), Photoshop-artig.

**Diese Trennung gilt nur für die UI, nicht für die Engine.** Für die Engine ist
beides identisch:

> Ein gerichteter azyklischer Graph (DAG) von Knoten, die jeweils **genau eine
> Textur** produzieren. Noise ist ein Fragment-Shader auf einem Quad.
> Compositing ist ein Fragment-Shader, der zwei Texturen mit einem Blend-Mode
> auf ein Quad rendert. Beides ist „Render-Pass → Textur".

Würde man zwei Graph-Typen bauen, hätte man zwei Engines, zwei
Serialisierungen, zwei Undo-Systeme. **Es wird genau eine Engine gebaut.** Die
Generation-vs-Composition-Unterscheidung lebt einzig im Palette-Filter (welche
Nodes vorgeschlagen werden), niemals im Datenmodell.

FMT versteht sich damit als **prozeduraler Textur-*Composer*** (nicht
-Generator): SupCom arbeitet ohnehin mit fertigen Assets; die häufigste
Operation ist `Compose`, nicht `Noise`.

### 0.2 Das ist kein Greenfield-Tech-Projekt

Alle harten Bausteine existieren im Repo bereits — der Node-Editor *vereint* sie,
er erfindet sie nicht:

| Baustein | Wo im Repo | Rolle im Node-Editor |
|---|---|---|
| WebGL/GLSL-Rendering | `Core/Home/Atmosphere/engine.js` + `haze.glsl.js`, `Navbar/Atmosphere/*`, `TextureEditor` | Basis der Eval-Engine (Shader-Passes) |
| DDS-Encoder (BC3/DXT5 + A8R8G8B8, Mips, PSNR-Gate) | `electron/modules/dds.js` | Output-Pfad, via IPC |
| DDS-Decoder | `electron/modules/dds-decode.js`, `props.js` | `image`-/`sprite-extract`-Sources laden DDS |
| scmap-Parsing | `electron/modules/scmap.js` | SupCom-Source-Nodes (Sky-Gradient etc.) |
| Kurveneditor | `Tabs/Skybox/Stars/YCurveEditor.jsx` | Sub-Editor der `curves`-Node |
| Atlas/UV-Picker | `Tabs/Skybox/Stars/UV.jsx` | Sub-Editor der `sprite-extract`-Node |
| Scatter-UI | `Tabs/Skybox/SkyboxGenerator/Stars.jsx` | Sub-Editor einer `scatter`-Node |
| Bildkanal-Utils | `Shared/MapLogic/imageChannels.js` | `channel-split`/`combine` |

Konsequenz für die Risikobewertung: das Neue ist die **Engine-Architektur und
die Registry**, nicht die einzelnen Rechenkerne.

---

## 1. Datenmodell — das Dokument *ist* die Wahrheit

Ein einziges serialisierbares JSON-Dokument (`.fmtgraph`), flach normalisiert:

```jsonc
{
  "version": 1,
  "mode": "envcube",                 // nur Template/Preset — KEINE Semantik (siehe §7)
  "canvas": { "w": 1024, "h": 1024 },
  "nodes": {
    "n1": { "type": "sky-gradient", "params": { "readScmap": true, "path": "…/foo.scmap" }, "pos": [120, 80] },
    "n2": { "type": "sprite-extract", "params": { "atlas": "SkyCube.dds", "region": 3 }, "pos": [120, 260] },
    "n3": { "type": "transform", "params": { "x": 0.61, "y": 0.34, "scale": 1.0, "rot": 0.0 }, "pos": [360, 260] },
    "n4": { "type": "layer-composer", "params": { "layers": [ { "blend": "normal", "opacity": 1.0 }, { "blend": "screen", "opacity": 0.8 } ] }, "pos": [640, 160] },
    "out": { "type": "output-envcube", "params": { "resolution": 1024, "format": "A8R8G8B8", "projection": "equirect" }, "pos": [900, 160] }
  },
  "edges": [
    { "from": ["n1", "out"], "to": ["n4", "in0"] },
    { "from": ["n2", "out"], "to": ["n3", "in"] },
    { "from": ["n3", "out"], "to": ["n4", "in1"] },
    { "from": ["n4", "out"], "to": ["out", "in"] }
  ]
}
```

### 1.1 Zwei eiserne Regeln

**Regel 1 — Jede Node ist eine reine Funktion `(params, inputs[]) → texture`.**
Kein verstecktes State, kein `this.cached` in der Node-Instanz, keine
Seiteneffekte. Das ist die *Vorbedingung* für Caching, Reproduzierbarkeit und
Undo. Wird diese Regel gebrochen, bricht alles darüber.

**Regel 2 — Alles ist parametrisch. Jede Mausinteraktion schreibt nur Parameter
um.** Das ist die wichtigste Designentscheidung des ganzen Projekts. Zieht der
Nutzer im Drag-Modus einen Planeten, passiert intern nur:

```
params.x = 0.614
params.y = 0.342
```

Der *Graph* ändert sich durch Interaktion nie — nur Zahlen. Daraus folgt kostenlos:

- **Undo** = JSON-Snapshot/Diff des Dokuments (kein Operations-History-System).
- **Copy/Paste** = JSON-Teilbaum.
- **Subgraph speichern** (später) = JSON-Teilbaum mit deklarierten Ein-/Ausgängen.
- **Reproduzierbarkeit** = dasselbe Dokument rendert bit-genau dasselbe Bild.

Diese Regel wird kompromisslos durchgehalten. Ein Sub-Editor, der eigenen State
hielte, ist ein Bug.

---

## 2. Auswertung — Lazy Pull + Content-Hash-Caching

**Entscheidung:** kein reaktives Push-Netz (Overkill, schwer zu debuggen),
sondern **pull-based Lazy Evaluation mit Content-Hashing**.

- Jede Node bekommt einen `hash = hash(type, params, ...inputHashes)`.
- Ändert sich ein Parameter, wird diese Node und **alles stromabwärts**
  invalidiert; unveränderte Teilbäume liefern die gecachte Textur zurück.
- Ausgewertet wird per Topologischer Sortierung + Dirty-Flag. Nur „dirty" Nodes
  rechnen neu.
- Das skaliert problemlos auf hunderte Nodes, weil bei einer typischen
  Interaktion (ein Slider) nur eine kurze Kette stromabwärts neu rechnet.

Der Cache ist ein `Map<hash, Texture>` mit LRU-Verdrängung (GPU-Speicher ist
begrenzt — siehe FBO-Pool §3.2). Beim Export wird derselbe Graph bei
Zielauflösung *ohne* Preview-Cache neu evaluiert.

---

## 3. Rendering-Engine — WebGL2, Ping-Pong-FBOs

**Entscheidung: WebGL2.** Begründung:

- Läuft im Repo bereits produktiv (Atmosphere-Engines, TextureEditor) — kein neues Tech-Risiko.
- Live-Preview ist quasi *gratis*, weil ohnehin in Texturen gerendert wird.
- CPU/Canvas2D skaliert nur für reines Sprite-Compositing, nicht für Noise/Warp/Blur bei hoher Auflösung.
- **WebGPU bewusst nicht** — unnötiges Kompatibilitätsrisiko in Electron; WebGL2 deckt alles Benötigte ab.

### 3.1 Ausführungsmodell

1. Graph wird zu einer topologisch sortierten Liste von Passes kompiliert.
2. Jeder Pass: bind Input-Texturen → bind Ziel-FBO → zeichne Fullscreen-Quad mit dem Node-Shader.
3. Die Preview zeigt die Textur des *selektierten* Nodes (oder des Output-Nodes).
4. Preview rendert bei niedriger Auflösung (z.B. 512²), Export bei Zielauflösung — **gleicher Code, anderer Viewport**.

### 3.2 FBO-Pool

GPU-Speicher wird nicht pro Node verbraucht, sondern aus einem **Pool
wiederverwendbarer Framebuffer-Objekte** (Ping-Pong). Ein einfacher
Reference-Counting-Allokator gibt FBOs frei, sobald alle stromabwärtigen
Konsumenten eines Zwischenergebnisses gerechnet haben. Nur explizit gecachte
(z.B. selektierte / teure) Nodes halten ihr FBO dauerhaft.

### 3.3 Präzision

Zwischentexturen als `RGBA16F` (Half-Float), wo Bandingschutz nötig ist
(Gradienten, Normalmaps) — die WaveNormals-Erfahrung (`dds.js`: BC1-Palette ist
das Limit, nicht die Endpunkte) gilt analog: 8-Bit-Zwischenschritte bei
Gradienten fressen Qualität. Der finale Downcast passiert erst im Output-Node.

### 3.4 CSP-Randbedingung

Der `prebuild`-Schritt (`utils/generate-csp-hashes.js`) erzeugt CSP-Hashes.
GLSL-Strings sind unproblematisch (kein `eval`). **Falls** Shader je dynamisch
zusammengesetzt werden (z.B. für variable Layer-Zahl im `layer-composer`), muss
das über String-Konkatenation zur Laufzeit *ohne* `new Function`/`eval`
geschehen, oder die Varianten werden zur Buildzeit erzeugt. Merken, nicht jetzt lösen.

---

## 4. Die Node-Registry — das Rückgrat der Erweiterbarkeit

Es gibt **genau einen** Erweiterungspunkt. Ein neuer Node-Typ *registriert*
sich; er ändert nichts an der Engine:

```js
registerNode({
  type: "sky-gradient",
  category: "source",              // "source" | "modifier" | "compositor" | "output"
  label: "Sky Gradient",
  // Params-Schema: Typ, Default, Range, UI-Hint — treibt sowohl Validierung
  // als auch die automatische Fallback-UI (Zahlenfelder), wenn kein editor gesetzt ist.
  params: {
    readScmap: { type: "bool",  default: true },
    horizon:   { type: "color", default: "#88aacc" },
    zenith:    { type: "color", default: "#0a1a3a" },
    mid:       { type: "color", default: "#446699" },
  },
  inputs:  [],                     // Source hat keine Eingänge
  outputs: [{ name: "out", type: "texture" }],
  editor:  SkyGradientEditor,      // optionale React-Komponente (Sub-Editor); fällt sonst auf Auto-UI zurück
  render:  (ctx, params, inputs) => ctx.pass(SKY_GRADIENT_FRAG, { params, inputs }),
})
```

Damit verschwindet die frühere Unterscheidung „allgemeine vs.
SupCom-spezifische Nodes" als *Architektur*-Konzept — es ist **dieselbe
Registry**, nur andere `category`/`render`-Inhalte. Eine `sky-gradient`-Source
ruft per IPC in `scmap.js`; eine `noise`-Source rendert prozedural. Für die
Engine kein Unterschied. Der Mehrwert (SupCom-Domänenwissen) steckt in einzelnen
Registry-Einträgen, nicht in einer Sonderarchitektur.

---

## 5. Node-Katalog

Drei funktionale Kategorien + Outputs.

### 5.1 Kern-Menge für den ersten tragfähigen Output (~12 Nodes)

Nicht 30–50 zum Start. Diese Menge trägt eine Pipeline end-to-end:

| Kategorie | Node | Zweck |
|---|---|---|
| **Source** | `sky-gradient` | liest scmap (Horizon/Mid/Zenith) → vertikaler Verlauf |
| **Source** | `sprite-extract` | Atlas-Region → RGBA-Bild (früher „UV-Node"; umbenannt, s.u.) |
| **Source** | `image` | Bild/DDS-Datei laden |
| **Source** | `noise` | prozedurales Rauschen (Perlin/FBM) |
| **Modifier** | `transform` | Position/Scale/Rotation — mit Parameter- **und** Drag-Modus |
| **Modifier** | `levels` | Schwarz-/Weißpunkt, Gamma |
| **Modifier** | `blur` | Gauß/Directional |
| **Modifier** | `curves` | Tonwertkurve (Sub-Editor existiert: `YCurveEditor.jsx`) |
| **Compositor** | `layer-composer` | **zentrale** Node: Blend-Mode + Opacity + Reihenfolge + Maske |
| **Output** | `output-*` | Auflösung, Format, DDS-Export via IPC (§8) |

### 5.2 Warum `layer-composer` zentral ist (nicht verkettet)

Nicht `Planet → Layer → Stars → Layer → …`, sondern *ein* Composer, in den alle
Ebenen laufen:

```
sky-gradient ─┐
sprite(planet)─┼─► layer-composer ─► output
sprite(stars) ─┤     (Blend/Opacity/
cirrus ────────┘      Reihenfolge/Maske)
```

Sonst müsste man Blend-Mode/Opacity/Maske über verstreute Kanten verwalten. Der
Composer ist das Photoshop-Ebenenpanel als *eine* Node mit eigenem Sub-Editor.

### 5.3 Umbenennung: „UV-Node" → `sprite-extract`

Der Begriff *UV* suggeriert Meshes. Die Node lädt einen Atlas und liefert eine
Region als RGBA-Bild; intern nutzt sie UV-Rechtecke, der Nutzer denkt aber nicht
in UVs. Sie erkennt die in der scmap hinterlegten Atlas-Regionen automatisch,
erlaubt aber auch manuelle Rechtecke und einen eigenen Dateipfad.

### 5.4 Spätere Erweiterungen (reine Registry-Einträge, kein Engine-Umbau)

`hsv`, `warp`, `mask`, `normal-map`, `channel-split`/`combine`, `clamp`,
`invert`, `tile`, `scatter`, `cirrus-generator`, `wave-generator`,
`fractal-noise`, `gradient` (freier Verlaufseditor). Jede davon ist ein
`registerNode(...)` — das ist der ganze Sinn der Registry.

---

## 6. Sub-Editoren — spezialisierte UI über denselben Parametern

Viele Eigenschaften beschreiben sich gut über Zahlen (Noise → Warp → Levels).
Andere sind stark visuell (Planet verschieben, Mond skalieren, Sterne
platzieren). Für Letztere sind reine X/Y-Felder schlecht.

**Lösung:** jeder Node-Typ *kann* eine eigene Editor-Komponente (`editor:`)
mitbringen. Fehlt sie, generiert die Engine aus dem `params`-Schema automatisch
Zahlen-/Farb-/Bool-Felder.

| Node | Sub-Editor | Status |
|---|---|---|
| `curves` | Kurveneditor | Komponente existiert (`YCurveEditor.jsx`) |
| `sprite-extract` | Atlas-Region-Picker | Komponente existiert (`UV.jsx`) |
| `scatter` | Scatter-Canvas | Komponente existiert (`SkyboxGenerator/Stars.jsx`) |
| `transform` | Drag-Canvas | neu (siehe §6.1) |
| `gradient` | Verlaufseditor | neu |

### 6.1 Der Transform-Node: Parameter- **oder** Drag-Modus

Ein Dropdown pro Transform-Node schaltet zwischen:

- **Parameter-Modus:** `x = 0.53`, `y = 0.27`, `scale`, `rot` als Felder.
- **Drag-Modus:** der Nutzer zieht das Objekt direkt im Output-Viewport; der Drag
  wird *sofort* in `params.x/y` übersetzt.

Das ist die „Photopea-Funktion im Node-Editor" — und sie verletzt Regel 2 nicht,
weil Drag ausschließlich Parameter schreibt. **Der Sub-Editor hält niemals
eigenen State.**

---

## 7. Der Modus-Dropdown = Template, nicht Modus

Oben links wählt ein Dropdown den Asset-Typ (EnvCube, WaterRamp, WaveNormals,
Cirrus, Star-Atlas, …). Wichtig:

> Der Dropdown ändert **nicht** die Graph-Semantik. Er ist ein **Template /
> „New from…"**: Canvas-Größe + vorplatzierte Output-Node + gefilterte
> Node-Palette + sinnvolle Vorschläge.

Die eigentliche Autorität ist die **Output-Node im Graphen**, nicht der Dropdown.
Beispiele:

| Auswahl | Canvas | Output-Node | Palette-Fokus |
|---|---|---|---|
| Environment Reflection | 1024×1024 | `output-envcube` | Sky-Gradient, Sprite-Extract, Layer, Cirrus |
| WaterRamp | z.B. 256×16 | `output-waterramp` | Gradient, Curves |
| WaveNormals | 512² tileable | `output-wavenormal` | Noise, Warp, Normal-Map; animierte Scroll-Preview |

Würde der Modus versteckten Zustand außerhalb des Dokuments halten, bräche das
Regel „Dokument ist die Wahrheit". Deshalb: Dropdown setzt nur Startwerte im
Dokument; danach lebt alles im `.fmtgraph`.

---

## 8. Outputs

Der Output-Node rendert den Graphen bei Zielauflösung, liest das Ergebnis aus
dem FBO und reicht den Pixelpuffer per IPC an den bestehenden `dds.js`-Encoder
weiter (BC3/DXT5 oder A8R8G8B8, mit Mips). **Der Export-Pfad wird nicht neu
gebaut** — er existiert und ist qualitätsgemessen.

### 8.1 EnvCube — als einzelnes equirektangulares Bild (nicht zwingend 6 Faces)

Wichtige Vereinfachung des Flagship-Outputs: die EnvCube/Reflection **muss keine
6-seitige Cubemap sein**, die zu einem equirektangularen Bild gerendert wird.
Sie kann direkt **ein einzelnes 1024×1024 equirektangulares Bild** sein. Damit
bleibt der gesamte EnvCube-Flow reine **2D-Textur-Komposition** — exakt das
„Composer"-Modell, ohne Cubemap-Projektionsmathematik als Pflicht.

Reflection wird *komponiert*, nicht „erraten":

1. Sky-Gradient automatisch aus der scmap.
2. Optional Clouds/Cirrus.
3. Planeten/Monde aus dem Atlas (`sprite-extract`) auswählen.
4. Interaktiv platzieren/skalieren/drehen (`transform` Drag-Modus).
5. Blur/Alpha/Blend über `layer-composer`.
6. Export als equirektangulares 1024×1024-Bild über `output-envcube`.

*(Cubemap-Projektion mit 6 Faces bleibt als optionaler späterer Output-Modus
denkbar, ist aber kein Pflichtweg und wird nicht zuerst gebaut.)*

### 8.2 WaterRamp / WaveNormals

`output-waterramp` schreibt den kleinen Verlaufsstreifen im FA-Format.
`output-wavenormal` erbt das Wissen aus `WAVE_NORMALS_PLAN.md` (tileable, Mips,
Format-Wahl, Normal-Encoding). Ideal wäre, den vorhandenen WaveNormals-Bake
mittelfristig als Nodes zu spiegeln — aber erst nachdem die Engine steht.

---

## 9. UI-Layout

Zweigeteilter Arbeitsbereich (wie Gaea / Blender Shader Editor):

```
┌───────────────────────────────────────────────┐
│ [▼ Environment Reflection]        (Mode/Template)│
│                                                 │
│            OUTPUT-VIEWPORT (gerendert)          │   ~50 %
│         zeigt selektierte / Output-Textur       │
│      Drag-Interaktion der Transform-Node hier    │
├───────────────────────────────────────────────┤
│                                                 │
│            NODE-GRAPH (Pan/Zoom/Edges)          │   ~50 %
│                                                 │
└───────────────────────────────────────────────┘
```

Der Node-Graph-Canvas selbst wird **nicht** selbst gebaut, sondern über eine
mature Bibliothek gelöst (siehe §11); die Engine bleibt eigen.

---

## 10. Was bewusst NICHT gebaut wird

- **Keine Zyklen/Feedback-Loops.** Strikt DAG.
- **Kein Scripting-/Expression-Node** in v1 (auch wegen CSP).
- **Keine Subgraphs in v1.** Konzeptuell reizvoll, aber Serialisierungs- und
  UX-Falle. Die Registry wird *so* entworfen, dass eine `subgraph`-Node später
  möglich ist (sie evaluiert einen inneren Graph), aber sie wird nicht gebaut.
- **Kein generisches Riesen-Node-Set.** Jede Node, die keinen SupCom-Output
  näherbringt, wird verschoben.
- **Kein Operations-History-Undo.** JSON-Snapshots.
- **Kein Substance-Klon.** Das Alleinstellungsmerkmal sind die 5–6
  SupCom-Sources/Outputs, nicht 200 Filter.
- **Keine 6-Face-Cubemap-Projektion als Pflicht** (siehe §8.1).

---

## 11. Referenz-Bibliotheken & -Projekte

- **Graph-Canvas-UI:** [React Flow / xyflow](https://reactflow.dev) — passt zum
  React-18-Stack; liefert Pan/Zoom/Edges/Selection/Minimap. **Nur die UI** hierüber
  lösen; die Auswertungs-Engine bleibt eigener Code (Engine niemals outsourcen).
  Alternativen zur Inspiration: `rete.js`, `litegraph.js`, `nodl`.
- **Engine-Konzept:** Blenders Node-Compositor, Substance Designer, Unreal
  Material-Graph — alle „DAG von Texture-Passes mit Lazy-Eval + Cache".

*(Offen: prüfen, ob React Flow lizenz-/CSP-technisch sauber in die Electron-App
passt, oder ob ein leichterer Eigenbau des Canvas günstiger ist. Siehe §13.)*

---

## 12. Zusammenspiel mit den bestehenden Tabs

Der Node-Editor wird ein **neuer Tab**, keine Ablösung per Big-Bang. Er kann die
bestehenden Generatoren schrittweise subsumieren:

- Phase 1–3 (unten) laufen **parallel** zu den heutigen Generatoren.
- Sobald ein Output im Node-Editor die Qualität des dedizierten Generators
  erreicht (gemessen, wie in `WAVE_NORMALS_PLAN.md`), kann der alte Generator
  optional durch ein Node-Template ersetzt werden — muss aber nicht.
- Er respektiert `TAB_CONTRACT.md` / `LAYOUTS.md` / `TAB_DESIGN_LAW.md` wie jeder
  andere Tab. **Achtung `controlsWidth`-Falle** (siehe Memory / TablLayout): der
  zweigeteilte Viewport ist kein Standard-Layout — die Layout-Integration früh klären.

---

## 13. Phasenplan — Vertical Slice zuerst

Der Fehler wäre, mit EnvCube zu beginnen (der reichste Use-Case). Die Pipeline
wird zuerst am **einfachsten** Output end-to-end bewiesen.

### Phase 0 — Engine-Skelett & Datenmodell
Registry, `.fmtgraph`-Schema, Topo-Sort + Dirty-Flag, WebGL2-Kontext, FBO-Pool,
Fullscreen-Quad-Pass. Ein einziger Dummy-Node (`solid-color`) rendert in die
Preview. **Gate:** Param-Änderung → Preview aktualisiert, korrektes
Cache-Verhalten (unveränderte Node rechnet nicht neu).

### Phase 1 — Vertical Slice: `WaterRamp`
Kleinste echte Kette: `gradient`/`sky-gradient` → `output-waterramp`. Beweist die
*gesamte* Kette: Registry → DAG-Eval → WebGL-Pass → FBO → Puffer → IPC →
`dds.js` → Datei. **Gate:** exportierte DDS öffnet korrekt und entspricht dem
FA-WaterRamp-Format.

### Phase 2 — Engine härten: `WaveNormals`
Fügt `noise`, `warp`, `blur`, `normal-map` hinzu; testet Multi-Pass-Ketten,
`RGBA16F`-Zwischenschritte und Caching bei *teuren* Nodes. Nutzt das PSNR-Gate
aus `WAVE_NORMALS_PLAN.md`. **Gate:** tileable, Normalenfehler im Rahmen des
bestehenden Bakes.

### Phase 3 — Flagship: `EnvCube` (equirect, §8.1)
Erst jetzt, auf bewiesener Basis: `sky-gradient` + `sprite-extract` +
`transform`(Drag) + `layer-composer` + `output-envcube`. Enthält den
Drag-Sub-Editor (§6.1) und den zentralen Composer (§5.2). **Gate:** eine echte
Reflection lässt sich interaktiv komponieren und exportieren.

### Phase 4+ — Registry-Erweiterungen
`hsv`, `mask`, `cirrus-generator`, `star-*`, `channel-split/combine`, freier
`gradient`-Editor. Danach ggf. Subgraphs, ggf. Cubemap-6-Face-Output.

Jede Phase liefert einen **vollständigen, nutzbaren Output** — kein
„monatelang bauen, dann testen".

---

## 14. Offene Fragen (zu klären, bevor Phase 1 startet)

1. **EnvCube-Format konkret:** Was erwartet FA für die Reflection genau — welche
   DDS-Kompression, welche Auflösung, welche Kanäle, welche Projektion beim
   equirektangularen Weg? (`dds-decode.js` / eine echte Stock-Reflection als
   Referenz messen — Vorgehen wie bei WaveNormals.)
2. **Graph-Canvas:** React Flow vs. leichter Eigenbau — Entscheidung nach kurzem
   CSP-/Bundle-Größen-/Lizenz-Check.
3. **Preview-Auflösung vs. Genauigkeit:** reicht 512² Preview, oder brauchen
   Normalmaps/Gradienten volle Auflösung schon in der Preview (Banding)?
4. **scmap-Zugriff:** liefern die bestehenden `scmap.js`-Handler alle für
   `sky-gradient` nötigen Felder, oder muss der Parser erweitert werden?
5. **Persistenz/Bibliothek:** wo leben gespeicherte Graphen und (später)
   Subgraphs — pro Map, global, als Preset-Ordner?
6. **Layout-Integration:** wie fügt sich der zweigeteilte Viewport in
   `TabLayout`/`LAYOUTS.md` ein, ohne die `controlsWidth`-Falle auszulösen?
```
