# Design-Token-Audit — ForgeMapToolkit

> Temporäres Arbeitsartefakt für die Token-Greenfield-Migration (Plan Phase 1a).
> Stand: 2026-06-22. Re-Run jederzeit über das Skript am Ende.

> **Phase 1b erledigt:** `tokens.css` neu autoren. Re-Run des Skripts → echte
> Lücken = **0** (nur `--x`, ein Kommentar-Fehltreffer). 36 tote Tokens
> entfernt, neue Achsen (radius/shadow/duration) offiziell, alle 27 echten
> Lücken über §12 COMPAT-Block gebrückt.

> **Phase 1c (re-scoped: NUR Footer/Navbar/Home) erledigt:** Diese drei Bäume
> sind jetzt token-rein — **79 + 3** hardcoded Werte → Tokens, alle pixelgenau
> (User-Entscheid „exakt, keine Änderung"). Neue exakte Tokens ergänzt:
> Ink-Stufen (09/11/12/13/15/17/20/70/95), `--sheen-*` (Gloss <5%),
> `--shade-*`/`--home-rail-*` (Schwarz/Recess), `--code-*` (VS-Code-Syntax),
> `--accent-primary(+glow)`, `--status-ok-dim`, `--surface-stage`, `--home-soon`.
> Einzige Rest-Treffer: 2 Hex/rgba **in Kommentaren** (Doku), keine CSS-Regel.
> Die übrigen Tabs bleiben bewusst unangetastet (veraltet, kommen später).

## Zusammenfassung

| Metrik | Wert |
|---|---|
| Tokens via `var(--…)` verwendet (distinct) | **323** |
| Tokens irgendwo definiert (CSS + inline JSX, distinct) | **382** |
| Tokens in `tokens.css` definiert | 194 |
| **Wirklich nirgends definiert (echte Bugs)** | **28** |
| Tote Tokens in `tokens.css` (definiert, nie genutzt) | **36** |
| Hardcoded Hex in Komponenten-CSS (Treffer gesamt) | **683** |
| Hardcoded rgba() in Komponenten-CSS (Treffer gesamt) | **3166** |

**Wichtige Einordnung:** Der ursprüngliche Verdacht „~119 undefinierte Tokens" stammte aus einem Vergleich *nur* gegen `tokens.css`. Tokens werden aber auch in `primitives.css`, `layout.css`, Komponenten-CSS und inline in JSX definiert. Gegen *alle* Definitionsquellen bleiben **28** echte Lücken.

---

## A) Wirklich undefinierte Tokens (28) — echte Bugs, Fallback auf `initial`

Ballen sich in wenigen Tabs, die gegen ein **paralleles, nie gemergtes Token-Vokabular** geschrieben wurden. Diese Tabs sind die Hauptkandidaten für Migration in Phase 1c.

### `Tabs/Skybox/Stars/Stars.css` — eigenes Vokabular (größter Block)
`--ink-14`, `--ink-18`, `--ink-65`, `--ink-85`, `--line-md`, `--line-sm`, `--line-subtle`,
`--shadow-md`, `--shadow-lg`, `--surface-control`, `--surface-overlay`, `--surface-accent-ghost`,
`--text-base`, `--duration-base`, `--duration-long`

### `Tabs/Tools/AdaptiveMapHelper/AdaptiveMapHelper.css`
`--amh-glow`, `--amh-glow-strong`, `--gt-color`

### `Tabs/Skybox/SkyboxGenerator/` (.css + Configuration.jsx)
`--ink-muted`, `--radius-sm`, `--line-subtle`

### Verstreut / Einzelfälle
| Token | Fundort | Anmerkung |
|---|---|---|
| `--weight-base` | `Core/Navbar/Register/Register.css:221` | **neuer Code** → vermutl. gemeint: `--weight-regular` |
| `--coop-versioner-color` | `Tabs/CoOp/CoOp.css` | fehlt in Per-Tab-Registry |
| `--cpt-accent` | `CustomProps.jsx`, `CustomProps_help.jsx` | lokaler Alias nie definiert |
| `--skybox-color` | `Tabs/Tools/History/History.jsx` | Tab-Color-Name falsch (`--skybox-generator-color`?) |
| `--motion-fast` | `Tabs/Scenery/Trees/Trees.css` | gemeint `--dur-fast`? |
| `--surface-2` | `Tabs/Placement/Props/Props.jsx` | — |
| `--tc` | `PropsLibrary.css`, `trace.css`, `EntityPanel.css`, `Wreckage.css` | Kurz-Alias, nie definiert |
| `--x` | `Home/Atmosphere/AtmosphereLayer.jsx:6` | **false positive** (steht in einem Kommentar) |

> Die Stars/AMH/Skybox-Cluster zeigen: hier wurde ein „zweites Token-System" (mit `--radius-*`, `--shadow-md/lg`, `--duration-*`, `--ink-<2-stellig>`, `--surface-control/overlay`) angefangen. Beim Greenfield-Set entscheiden, welche dieser Achsen offiziell werden (Radius, Shadow-Skala, Duration-Aliase) — vieles davon ist sinnvoll und sollte ins neue Set, statt es wegzumigrieren.

---

## B) Tote Tokens in `tokens.css` (36) — Kandidaten zum Streichen

**`*-glow-intense` (14×, komplett ungenutzt):** adaptivemaphelper, civilians, contributions, customprops, history, mapresizer, previewimage, props, scmaptool, settings, skybox-generator, stars, treemap, wreckages, emitter(-accent), rockerosion(-accent)

**`*-accent`-Aliase (ungenutzt):** `--emitter-accent[-glow/-strong/-intense]`, `--rockerosion-accent[-…]`, `--st-accent[-light/-glow/-glow-strong]`

**`--economymap-*` (4×):** color, glow, glow-strong, glow-intense — Tab existiert (noch) nicht aktiv

**Basis-Tokens ungenutzt:** `--surface-bed-a`, `--surface-bed-b`, `--status-warn`, `--shadow-card`, `--size-icon-btn`, `--line-ghost`

> Beim Greenfield-Set: `*-glow-intense` nur generieren, wenn tatsächlich gebraucht. `*-accent`-Aliase waren Übergangskrücken einzelner Tabs → entfallen, Tab nutzt direkt `--<tab>-color`.

---

## C) Hardcoded-Werte — Tokenisierungs-Schulden (nach Datei, hex)

683 Hex- und 3166 rgba-Treffer gesamt. Priorisierte Brennpunkte:

| Hex | Datei |
|---|---|
| 82 | `Tabs/Guides/GuideSection.css` |
| 57 | `Tabs/Skybox/SkyboxGenerator/SkyboxGenerator.css` |
| 51 | `Core/ForgeMapToolkit.css` |
| 46 | `Tabs/Tools/AdaptiveMapHelper/AdaptiveMapHelper.css` |
| 39 | `Tabs/Community/Contributions/Contributions.css` |
| 36 | `Shared/trace.css` |
| 36 | `Shared/Libraries/PropsLibrary/PropsLibrary.css` |
| 32 | `Tabs/Tools/History/History.css` |
| 31 | `Shared/DesignSystem/tokens.css` *(erwartet — hier werden Hex deklariert)* |
| 23 | `Shared/Libraries/EmitterLibrary/EmitterLibrary.css` |
| 19 | `Tabs/Config/Settings/Settings.css` · `Shared/Ui/HelpPanel/Sections/sections.css` |
| … | (vollständige Liste über Skript) |

**Sauber (Referenz-Niveau):** `Core/Footer/Footer.css` (0 hex), `Core/Navbar/Navbar.css` (0 hex), `Core/Banner/Banner.css` (1 hex). Footer/Navbar sind das Gold-Standard-Vorbild für die Migration.

---

## D) Reproduzierbares Audit-Skript

```bash
cd /d/ForgeMapToolKit
AUD=/tmp/aud; mkdir -p $AUD
# Definitionen (CSS + inline JSX) vs. Verwendungen
grep -rhoE -- '--[a-z0-9-]+\s*:' src/components --include=*.css | sed -E 's/\s*:.*//' | sort -u > $AUD/def_css.txt
grep -rhoE -- "['\"]--[a-z0-9-]+['\"]\s*:" src/components --include=*.jsx | sed -E "s/['\"]//g; s/\s*:.*//" | sort -u > $AUD/def_jsx.txt
cat $AUD/def_css.txt $AUD/def_jsx.txt | sort -u > $AUD/def_all.txt
grep -rhoE -- 'var\(--[a-z0-9-]+' src/components --include=*.css --include=*.jsx | sed 's/var(//' | sort -u > $AUD/used.txt
# Echte Lücken:
comm -23 $AUD/used.txt $AUD/def_all.txt
# Tote Tokens in tokens.css:
grep -oE '^\s*--[a-z0-9-]+\s*:' src/components/Shared/DesignSystem/tokens.css | sed -E 's/\s//g; s/:$//' | sort -u \
  | comm -23 - $AUD/used.txt
# Hardcoded hex pro Datei:
for f in $(find src/components -name '*.css'); do n=$(grep -oiE '#[0-9a-f]{3,8}\b' "$f"|wc -l); [ $n -gt 0 ] && echo "$n ${f#src/components/}"; done | sort -rn
```

---

## Konsequenzen fürs Greenfield-Set (Phase 1b)

1. **Neue Achsen offiziell aufnehmen**, die heute nur ad-hoc existieren und sinnvoll sind: `--radius-*`, `--shadow-*` (Skala statt nur `--shadow-card`), `--duration-*`-Aliase, ggf. `--surface-control/overlay`.
2. **Ink/Line/Surface konsolidieren:** statt `--ink-100/92/86/84/80/72/60/55/50/45/40/38/35/30/28/25/22/16` + Stars' `--ink-14/18/65/85` → eine bewusste, kleinere, lückenlose Skala.
3. **Per-Tab-Registry behalten**, aber ohne `*-glow-intense`/`*-accent`-Ballast (nur generieren was genutzt wird); fehlende Tabs ergänzen (`--coop-versioner-*`).
4. **Alias-Layer (Phase 1c)** deckt die 28 Lücken + Legacy-Kurznamen (`--tc`, `--bg`, `--ac`, `--accent-primary`, …) ab, bis die Konsumenten migriert sind.
