# Wave Normals — Implementierungsplan

> Erstellt 2026-07-22, **umgesetzt 2026-07-22**. Ziel: ein FMT-Generator, der
> Wellen-Normalmaps für FA-Wasser in der Qualität von Blenders Ocean-Modifier
> erzeugt — inklusive physikalisch begründetem Schaum-Alpha, das die
> Engine-Texturen nicht liefern.
>
> Qualität hat Vorrang vor Laufzeit. Wo eine Abkürzung sichtbar wäre, wird sie
> nicht genommen.
>
> ## Umsetzungsstand
>
> Phasen 1–5 gebaut und verifiziert. Was sich beim Bauen gegenüber dem Plan
> geändert hat — jeweils, weil die Messung etwas anderes sagte:
>
> | Planannahme | Ergebnis |
> |---|---|
> | DXT5 als Standardformat | **A8R8G8B8 als Standard.** Gemessen: PCA+LSQ erreicht 31,8 dB gegen 28,7 dB naiv, aber das sind immer noch 4,2° mittlerer Normalenfehler. Die zusätzliche ±1-Endpunktsuche bringt 0,1 dB — das Limit ist die 4-Einträge-Palette, nicht die Endpunkte. |
> | Zwei Bandmodi (`octave`, `independent`) | **Drei, Default `matched`.** Der strikte Oktav-Split lässt jeden Slot oberhalb der Peak-Wellenlänge leer — physikalisch korrekt, praktisch unbrauchbar. `matched` löst pro Slot den Fetch, dessen Spektrum-Peak im eigenen Band landet. |
> | Schaum gleichmäßig über alle vier Slots | **Nach Größe gewichtet** (`FOAM_WEIGHT_BY_RANK`). Eine det(J)-Maske auf einer Kilometerkachel ist über 100 m Sicht ein weicher Blob, der `sum.a` flutet. |
> | `waveCrestThreshold` manuell | **Aus den vier gebackenen Alphas gelöst** (`recommendWaveCrestThreshold`). Ergebnis bei Defaults: 1,15 — der Stock-Wert 1 ist mit richtig budgetierten Alphas also tatsächlich erreichbar. |
> | Scroll-Vektoren aus dem Preset | **Aus der Tiefwasser-Phasengeschwindigkeit** c = √(g/k) abgeleitet. |
> | three.js-Wasserpreview | **Zurückgestellt.** Die CPU-Composite rechnet die water2.fx-Rekonstruktion exakt und rendert 512² in ~180 ms; eine Perspektivansicht wäre Komfort, keine Korrektheit. |
>
> Zwei Bugs, die die Tore gefangen haben: ein degeneriertes det(J)-Histogramm
> markierte leere Bänder als vollflächigen Schaum (§1.4), und der
> `withPathGuard`-Extractor gab einen String statt eines Arrays zurück, was
> jeden `write-dds`-Aufruf zerlegt hätte.
>
> ## Nachtrag 2026-07-22 — Detailgrad
>
> Erster Praxistest gegen die Engine-Texturen (`waves2_40m/_120m/_400m`) ergab:
> deutlich zu weich. Zwei Ursachen, beide gemessen (Slope-Varianz pro Oktave):
>
> **1. Der `cutoff`-Parameter hat gelogen.** `exp(−k²l²)` erreicht Halbwert erst
> bei λ = 7,546·l. Der Default `cutoff = 0,12 m` dämpfte also alles unter ~0,9 m
> weg — bei 0,13 m Wellenlänge war die Slope-Varianz auf `2,1e-12`. Da der
> Ozean-Tail ~k⁻⁴ ist und die Slope-Varianz damit **pro Oktave konstant**, kostet
> jede gefressene Oktave gleich viel Schärfe. Drei Oktaven waren weg.
>
> Fix: Der Parameter heißt jetzt `detailFloor` und ist die Wellenlänge, bei der
> die Dämpfung greift (Umrechnung `l = detailFloor/7,546`). Er ist außerdem eine
> **Auflösungsgrenze, keine Seegangseigenschaft** — er wird pro Layer aus dessen
> Kachelgröße gelöst (Default 2,5 × Texelgröße) und sitzt in „Fidelity", nicht
> im Seegang-Panel.
>
> **2. Der Band-Split ist der falsche Default.** Er ist rechnerisch sauberer,
> aber die Engine-Konvention ist nachweislich Vollspektrum pro Layer — die
> Dateinamen `waves2_40m/_120m/_400m` sind ein Seegang über 40/120/400 m
> Patches. Ein bandbegrenzter Layer trägt ~2 Oktaven und sieht einzeln glatt aus.
> Default ist jetzt `independent`; das Preset ist auf 1200/400/120/40 m
> umgestellt (zwei der vier Raten decken sich mit FA-Stock).
>
> Damit ändert sich die Summenkompensation: bei disjunkten Bändern ×4, bei
> Vollspektrum ×2 (vier Ziehungen desselben Feldes → Mittelwert bei σ/2, nicht
> σ/4). Siehe `sumCompensation()`.
>
> **Nebeneffekt auf die DXT5-Messung:** RGB-PSNR fiel von 31,8 auf 28,1 dB, der
> mittlere Normalenfehler stieg von 4,2° auf 6,5°. Nicht schlechter geworden —
> schärfer geworden. Mikrodetail innerhalb eines 4×4-Blocks ist genau das, was
> BC1 nicht kann. Uncompressed als Default wird dadurch nur eindeutiger.
>
> Außerdem: Phillips war gegen die ω-basierten Modelle um drei Größenordnungen
> verstimmt (rms slope 18 statt 0,5) — `PHILLIPS_A = 8e-4` stellt sie gleich.

---

## 0. Warum überhaupt

`D:\fa\effects\water2.fx:398-409` — die Engine liest vier Normalmaps, summiert sie
und normalisiert erst danach:

```hlsl
float4 sum = W0 + W1 + W2 + W3;
float waveCrest = saturate( sum.a - waveCrestThreshold );
float3 N = 2.0 * sum.xyz - 4.0;
N = normalize(N.xzy);
```

Daraus folgt der komplette Ausgabevertrag:

| Kanal | Bedeutung nach `.xzy`-Swizzle |
|---|---|
| **R** | Welt-X-Komponente der Normale |
| **G** | Welt-**Z**-Komponente (horizontal) |
| **B** | Welt-**Y**-Komponente (up) |
| **A** | Schaummaske, **völlig unabhängig von RGB** |

Standard-Tangent-Space-Layout also, nur mit Y-up-Swizzle. Und ein Alphakanal,
der mit der Normale nichts zu tun hat — genau der Grund, warum ein Blender-
Normal-Bake das Problem nicht löst: ein Bake schreibt keine unabhängige Maske
in Kanal 4.

**Belegte Ausgangslage** (zwei Maps unabhängig verifiziert): alle neun
hochaufgelösten `waves1/2/3_*m.dds` (1024²) haben Alpha = 0 — Schaum ist auf
praktisch jeder Map tot. Alpha gibt es nur bei `waves001.dds` / `waves6.dds`
(256², nur im Steam-Basisarchiv). Ein eigener Generator hebt diesen
Zielkonflikt auf: 1024² **mit** Kammmaske.

---

## 1. Verfahren — Tessendorf-FFT, nicht Noise

Blenders Ocean-Modifier ist Tessendorf-FFT mit wählbarem Spektrum. Wir
implementieren dasselbe Verfahren, nur ohne die Zwischenschritte (Bake → GIMP →
DDS-Tool), in denen Qualität wieder verloren geht.

### 1.1 Spektrum → Anfangsamplituden

Für jeden Wellenvektor **k** des Gitters:

```
h̃₀(k) = 1/√2 · (ξr + i·ξi) · √( Ψ(k) · Δkx · Δkz )       ξ ~ N(0,1)
Δkx = 2π/Lx     Δkz = 2π/Lz
```

`Ψ(k)` [m⁴] ist das 2D-Wellenzahlspektrum. Vier Modelle, alle vier gebaut:

**Phillips** (Tessendorf, direkt 2D):
```
Ψ = A · exp(−1/(k·L)²) / k⁴ · exp(−k²·l²)      L = V²/g
```

**JONSWAP** (fetch-limitiert, 1D in ω → 2D konvertiert):
```
ωp = 22·(g²/(V·F))^(1/3)          α = 0.076·(V²/(F·g))^0.22
S(ω) = α·g²/ω⁵ · exp(−1.25·(ωp/ω)⁴) · γ^r
r    = exp( −(ω−ωp)² / (2·σ²·ωp²) )      σ = 0.07 (ω≤ωp) | 0.09 (ω>ωp)
```

**Pierson-Moskowitz** (voll ausgereifte See): JONSWAP mit γ=1, α=0.0081,
ωp = 0.8776·g/V.

**TMA** (Flachwasser): JONSWAP × Kitaigorodskii-Dämpfung Φ(ω,D), zusätzlich
Flachwasser-Dispersion.

Konversion 1D→2D:
```
Ψ(k⃗) = S(ω) · D(θ) · (1/k) · (dω/dk)
```
Dimensionscheck: m²s · 1 · m · m/s = m⁴ ✓

**Richtungsverteilung** `D(θ) ∝ cos^{2s}((θ−θw)/2)`, numerisch über das Gitter
normalisiert. Bei θ=π automatisch 0 → keine Gegenwind-Wellen, kein
Extra-Hack nötig.

### 1.2 Dispersion und Zeitentwicklung

```
ω(k) = √(g·k)                Tiefwasser
ω(k) = √(g·k·tanh(k·D))      endliche Tiefe D
h̃(k,t) = h̃₀(k)·e^{iωt} + h̃₀*(−k)·e^{−iωt}
```

Die zweite Zeile garantiert Hermitesche Symmetrie (`h̃(−k) = conj(h̃(k))`)
automatisch — nachgerechnet, gilt für jedes Ψ, auch für richtungsabhängige.
Ergebnis ist damit garantiert reell.

FA animiert die Textur nicht, es scrollt UVs. Wir backen einen Zeitschnitt;
`t` bleibt trotzdem Parameter, weil verschiedene t verschiedene
Wellen-Realisierungen bei identischem Spektrum liefern (billiges „Würfeln").

### 1.3 Choppiness — die Kammschärfe

Reine Sinuswellen sind falsch. Echte Wellen haben spitze Kämme, breite Täler.
Horizontale Verschiebung nach Tessendorf:

```
D̃x(k) = −i·(kx/|k|)·h̃(k)      D̃z(k) = −i·(kz/|k|)·h̃(k)
P(x,z) = ( x + λ·Dx , h , z + λ·Dz )
```

Auch hermitesch (nachgerechnet) → reell.

### 1.4 Normale — über die Jacobi-Matrix, nicht über den Sobel

Der entscheidende Qualitätspunkt. Auf einer verschobenen Fläche ist die
Normale **nicht** `(−hx, 1, −hz)`. Korrekt:

```
a = ∂P/∂x = ( 1 + λ·Dxx ,  hx ,  λ·Dzx )
b = ∂P/∂z = ( λ·Dxz     ,  hz ,  1 + λ·Dzz )
n = b × a
```

ausgeschrieben:

```
n.x = hz·λDzx − (1 + λDzz)·hx
n.y = (1 + λDxx)(1 + λDzz) − λ²·Dxz²          ← das ist exakt det(J)
n.z = λDxz·hx − hz·(1 + λDxx)
```

Zwei Dinge fallen dabei ab:

1. **Alle Ableitungen kommen aus dem Frequenzraum** (`∇̃ = i·k⃗·h̃`), also
   analytisch exakt — kein Finite-Differenzen-Rauschen, kein Bake-Bias.
2. **`n.y` ist die Jacobi-Determinante.** Wo sie gegen 0 geht, faltet sich die
   Oberfläche über sich selbst — das ist der brechende Kamm. Der Schaum-Alpha
   fällt also aus derselben Rechnung, die auch die Normale liefert.
   (`Dxz = Dzx` ist analytisch identisch — spart eine Transformation.)

Beim Normalisieren wird `n.y` auf ein positives ε geklemmt, damit die Normale
bei überkippten Kämmen nicht umschlägt; die Faltung wird stattdessen im Alpha
festgehalten.

### 1.5 Lagrange → Euler: die Rückverteilung

Die Jacobi-Normale gilt an der **verschobenen** Position `P(x)`, nicht am
Gitterpunkt `x`. Eine Textur braucht aber Euler-Parametrisierung: Texel (i,j)
= Weltposition (x_i, z_j). Ohne diesen Schritt geht die Kammasymmetrie wieder
verloren — genau der Punkt, an dem naive Implementierungen matschig werden.

Verfahren: **Forward-Scatter mit bilinearem Splatting.**

- Lagrange-Gitter mit `N = S·M` (Supersampling-Faktor S, Default 2; M = Ausgabegröße)
- Pro Gitterpunkt: verschobene Position (mod L), Einheitsnormale, Schaumwert
- Bilinear in den M-Akkumulator splatten (Normale und Schaum je × Gewicht)
- Durch Gewichtssumme teilen, renormalisieren
- Restlöcher (nur in stark gedehnten Zonen möglich) über iterative 3×3-Dilation

Der Scatter bei S=2 direkt auf M ist gleichzeitig ein Tent-Rekonstruktionsfilter
— also **Antialiasing inklusive**. Ein FFT-Ozean, der exakt auf Ausgabeauflösung
gerechnet wird, aliast am Nyquist sichtbar; deshalb wird nicht auf M simuliert.

### 1.6 Transformationsbudget

Benötigt: `h, Dx, Dz, hx, hz, Dxx, Dxz, Dzz` — 8 reelle Felder.
Da alle acht Spektren hermitesch sind, lassen sich je zwei in einer komplexen
IFFT verpacken (`IFFT(Ã + i·B̃)` → Realteil = A, Imaginärteil = B).
**4 komplexe 2D-IFFTs statt 8.**

Die Rücktransformation wird als unnormierte Summe implementiert
(`h(x) = Σ_k h̃(k)·e^{ik·x}`), damit die physikalische Skalierung aus §1.1
in Metern erhalten bleibt.

---

## 2. Die vier FA-Slots

`normalRepeatRate` skaliert Weltkoordinaten auf UV: eine Texturperiode deckt
`1/repeatRate` Ogrids ab. Mit 1 Ogrid = 5000/256 = 19.53125 m:

| Slot | repeatRate (Default) | Kachel | Weltmaß |
|---|---|---|---|
| 0 | 0.0009 | 1111 ogrid | 21.7 km |
| 1 | 0.009  | 111 ogrid  | 2.17 km |
| 2 | 0.05   | 20 ogrid   | 391 m |
| 3 | 0.5    | 2 ogrid    | 39 m |

Die Peak-Wellenlänge des Spektrums ist `L = V²/g` — bei 10 m/s ≈ 10 m, bei
20 m/s ≈ 41 m. Die reale Windwellen-Energie liegt damit **komplett in Slot 3,
teils Slot 2**. Slot 0/1 liegen jenseits jeder Windwellenskala.

Deshalb zwei Betriebsarten:

- **`octave` (Default)** — ein Spektrum, vier bandbegrenzte Fenster. Slot i
  deckt `[2π/L_i , 2π/L_{i+1}]`, der kleinste bis zur eigenen Nyquist-Grenze.
  Die vier Texturen sind damit eine echte Oktavzerlegung **eines** Seegangs
  und addieren sich zu einem kohärenten Bild statt zu vier Mustern übereinander.
- **`independent`** — vier eigenständige Ozeane, je auf eigener Skala. Das
  Äquivalent zu vier separaten Blender-Bakes.

### 2.1 Die ×4-Summenkompensation

Aus §0: bei vier fast senkrechten Einheitsnormalen ist
`normalize(Σnᵢ) ≈ (Σsx/4, Σsz/4, 1)` — die Engine bildet effektiv den
**Mittelwert** der vier Neigungen, nicht die Summe. Damit die Gesamtneigung der
Summe der Bandneigungen entspricht, muss jeder Slot seine Bandneigung ×4
kodieren. Als Schalter `sumCompensation` (Default an), weil er das Clipping-
Verhalten spürbar ändert — die Live-Preview entscheidet.

### 2.2 Schaum-Kalibrierung

`waveCrest = saturate(sum.a − waveCrestThreshold)`, Default-Threshold = 1,
`sum.a` = Summe über vier Slots. Ein einzelner alphaführender Slot mit
Mittelwert ~0.33 ergibt also nichts.

Der Generator steuert deshalb nicht über einen rohen Jacobi-Schwellwert,
sondern über **Zieldeckung**: `foamCoverage` = Anteil der Texel über der
Schwelle; der Jacobi-Schwellwert wird per Quantil aus dem tatsächlichen
Histogramm gelöst. Zusätzlich `foamMean` pro Slot, damit
`Σ mean ≈ 1.1…1.3` und der Default-Threshold greift.

DXT5 interpoliert Alpha mit 2 Endpunkten + 3 Bit pro 4×4-Block — hochfrequentes
Schaumrauschen wird dort blockig. Gegenmaßnahmen: optionaler Weichzeichner auf
der Maske, und Uncompressed als Ausweg.

---

## 3. DDS-Ausgabe

Bestand: `electron/cli.js:419` schreibt einen 128-Byte A8R8G8B8-Header **ohne
Mipmaps**. Beides zu wenig.

- **Mipmaps sind Pflicht.** Bei `repeatRate = 0.5` (2-Ogrid-Kacheln) flimmert
  Wasser in der Distanz ohne Mipkette zu Tode. Normalmap-Mips: Einheitsnormalen
  box-mitteln, **dann** renormalisieren. Alpha: reiner Boxfilter.
- **Zwei Formate:** A8R8G8B8 (verlustfrei, 1024² + Mips ≈ 5.6 MB) und
  DXT5/BC3 (Engine-Konvention, ≈ 1.4 MB). Default DXT5.
- **BC3-Encoder mit Anspruch:** Farbendpunkte per **PCA** über den 4×4-Block
  (statt Bounding-Box-Min/Max) plus **Least-Squares-Refinement** über die
  Indexzuweisung, 2 Iterationen. Alpha-Block: 8-Wert-Modus, Endpunkte ebenfalls
  LSQ-verfeinert. Naive Min/Max-Encoder erzeugen auf Normalmaps sichtbares
  Banding — das ist der Unterschied, den man am Wasser sieht.
- BC3 gibt Grün 6 Bit, Rot/Blau je 5. Da FA `.xyz`/`.a` fest interpretiert,
  ist der DXT5nm-Swizzle-Trick **nicht** möglich. Kompensiert wird über den
  guten Encoder und darüber, dass die Daten ohnehin nur einen kleinen Teil des
  RGB-Würfels belegen (alle Normalen nahe up) — die per-Block-Endpunkte legen
  sich eng um die tatsächliche Spanne.

Round-Trip-Test gegen den vorhandenen Decoder in
`electron/modules/props.js:43` (DXT1/3/5/ATI2/uncompressed).

---

## 4. Dateien

### 4.1 Engine — `src/components/Shared/Ocean/`

```
fft.js         Iterative Radix-2-FFT, in-place, vorberechnete Twiddles.
               1D komplex + 2D-Wrapper (Zeilen/Spalten). Unnormierte Inverse.
random.js      xorshift128+ PRNG (seedbar) + Box-Muller-Gaußpaare.
spectrum.js    Phillips / PM / JONSWAP / TMA, Richtungsverteilung,
               Dispersion + dω/dk (tief + flach).
ocean.js       OceanField: h̃₀-Init, evolve(t), die 4 gepackten IFFTs →
               { h, Dx, Dz, hx, hz, Dxx, Dxz, Dzz }.
bake.js        Jacobi-Normale + det(J)-Schaum, Lagrange→Euler-Scatter,
               Lochfüllung, RGBA-Encoding, Mipkette, Foam-Quantil.
faWater.js     FA-Spezifika: Slot-Tabelle, Ogrid-Skala, Bandaufteilung,
               ×4-Kompensation, reconstructWaterNormal() (exakte
               water2.fx-Mathematik für die Preview).
```

### 4.2 Electron — `electron/modules/dds.js`

`writeDDS({ path, width, height, mips, format })`, BC3-Encoder,
IPC-Channel `write-dds` hinter `withPathGuard` + Preload-Allowlist
(TAB_CONTRACT §8).

### 4.3 Tab — `src/components/Tabs/Scenery/WaveNormals/`

Nach TAB_CONTRACT.md, State-Kürzel **`wn_`**, Layout X · half.

```
WaveNormals.jsx    Parent, reine Orchestrierung (< 400 Zeilen)
WaveNormals.css    nur .wn-tab Akzent-Mapping
Configuration.jsx  01 — Seegang: Modell, Wind, Fetch, Tiefe, Spread,
                        Choppiness, Seed, Zeitschnitt
Layers.jsx         02 — die vier Slots: Kachelgröße/repeatRate, Bandmodus,
                        Gain, Auflösung, Foam-Deckung
Export.jsx         03 — Zielordner, Format, Mips, Dateinamen, Wasser-Settings-Hinweis
Help.jsx           HelpPanel (nicht HelpModals — Neubau folgt dem Zielbild)
Preview/
  TilePreview.jsx    2D-Canvas, 3×3-Kachelung, Kanalumschaltung
                     (Höhe / Normale / Schaum / Jacobi)
  WaterPreview.jsx   three.js, exakte water2.fx-Normalenrekonstruktion
                     + GGX-Sonne + Schaumschwelle
```

### 4.4 Registry-Wiring

| Datei | Eintrag |
|---|---|
| `Shared/DesignSystem/tokens.css` §11 | `--wavenormals-color: #00A3E0` + glow/glow-strong |
| `Core/Home/Data/toolRegistry.js` | id `wavenormals`, category `generator` |
| `Core/tabRoutes.jsx` | `wavenormals: (c) => <WaveNormals {...c.tabProps} />` |
| `electron/preload.js` | `'write-dds'` in `INVOKE_CHANNELS` |

Akzentfarbe: `#00A3E0` — abgesetzt von `--emitter-color #00DDFF` (reines Cyan)
und `--skybox-generator-color #3B76FF` (Indigo).

---

## 5. Reihenfolge & Qualitätstore

| Phase | Inhalt | Tor |
|---|---|---|
| **1** | fft, random, spectrum, ocean, bake, faWater | Headless-Node-Skript rendert Höhe/Normale/Schaum als PNG. **Ansehen.** Kachelbarkeit im 3×3 prüfen. Erst wenn es nach See aussieht, geht es weiter. |
| **2** | `dds.js` + BC3 + IPC | Round-Trip: schreiben → mit `props.js`-Decoder lesen → PSNR gegen Original. Mipkette-Byteanzahl gegen Header prüfen. |
| **3** | Tab-Gerüst + Registry | `npm run build` grün, Tab öffnet, Sektionen schalten, State überlebt Tabwechsel. |
| **4** | Previews | TilePreview zuerst (verifiziert die Bake-Ausgabe), dann WaterPreview. |
| **5** | Help, Doku, Build | `npm run build` grün, Smoke-Test. |

Phase 1 ist das eigentliche Projekt. Wenn dort etwas nicht stimmt, hilft keine
UI darüber.

---

## 6. Bewusst nicht im Scope

- Kein Schreiben der Wasser-Settings in die `.scmap` — der Generator gibt die
  vier DDS aus und nennt die passenden `Scale`/`Speed`-Werte für den Editor.
  (Ein Scmap-Water-Writer ist ein eigenes Vorhaben.)
- Kein Import gebackener Blender-Normalmaps in Phase 1–5. Der Hook dafür
  (`bake.js` nimmt ein externes Höhenfeld statt des FFT-Ergebnisses) bleibt
  offen, wird aber nicht gebaut, bevor der Eigenweg steht.
- Keine Animation. FA scrollt UVs.
