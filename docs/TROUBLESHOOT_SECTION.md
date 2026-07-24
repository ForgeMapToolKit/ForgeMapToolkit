# TROUBLESHOOT SECTION — Konzept & Ablaufplan

*Stand 2026-07-14. Ergebnis der Design-Diskussion zur Neukonzeption der
Troubleshooting-Section im HelpModal (`Shared/Ui/HelpPanel/Sections/TroubleshootSection.jsx`).
Dieses Dokument ist die verbindliche Beschreibung des beschlossenen Konzepts —
Grundlage für die Implementierung. Gestaltung folgt `TAB_DESIGN_LAW.md` und
`UI_PHILOSOPHY.md`; Abweichungen davon sind hier explizit begründet.*

---

## 1. Prämisse — warum die Section so klein ist

Fast jedes Nutzerproblem in FMT fällt in genau zwei Eimer:

- **(a) Echter Bug.** Kann nicht durch Troubleshooting-Content gelöst werden —
  nur dadurch, dass der Dev davon erfährt (GitHub Issue oder Mapping-Channel).
- **(b) Bedienungs-/Verständnisproblem.** Dafür existiert bereits das gesamte
  HelpModal; eine zweite Erklärschicht wäre Redundanz.

Die Section ist deshalb **kein Lösungskatalog, sondern eine Triage**: Sie hilft
dem Nutzer herauszufinden, in welchen Eimer sein Problem gehört, und produziert
am Ende eine **gute Übergabe** — entweder einen Verweis auf die richtige Stelle
im HelpModal oder einen Report, mit dem der Dev tatsächlich arbeiten kann.
Das eigentliche Designziel ist die **Qualität der Reports**, nicht die Menge an
Hilfe-Content.

---

## 2. Ablauf im Überblick

```
Einstieg (Weiche)
├── "Etwas ist kaputt"          → Bug-Pfad
│     1. Quick Checks (leise, eingeklappt, überspringbar)
│     2. Report-Formular (4 Felder + Häufigkeits-Wahl)
│     3. Ziel wählen (GitHub Issue / Mapping-Channel)
│     4. TraceLine "Report erstellen" → Versand/Export je nach Ziel & Auth
│
└── "Ich weiß nicht, wie…"      → Verweis-Pfad
      Kurze Liste der HelpModal-Sections mit Ein-Satz-Beschreibung,
      Klick springt direkt in die jeweilige Section.
```

Es gibt **kein paralleles Nebeneinander** der beiden Pfade (keine zwei Spalten).
Der Nutzer entscheidet sich am Einstieg und geht dann genau einen Pfad.

---

## 3. Einstiegsansicht — die Weiche

- Neutraler großer Titel als Orientierung (Treppe, LAW §2), darunter genau
  **eine Entscheidung**: zwei große, gleichgewichtige Wahlflächen.
- Labels aus Nutzerperspektive: **"Etwas ist kaputt"** und
  **"Ich weiß nicht, wie…"**, jeweils mit einer leisen Ein-Zeilen-Erklärung.
- **Keine gefüllten Hero-Kacheln** (wären zwei konkurrierende generische Boxen,
  LAW §5). Stattdessen: zwei große, vollflächig klickbare Textblöcke; der Akzent
  (z. B. einfahrende linke `--tab-color`-Kante) erscheint **erst beim Hover**.
  Groß dürfen sie sein — laut werden sie nur unter dem Cursor.
- Trennung der beiden Wahlflächen ausschließlich durch Leerraum (LAW §3).

### Zurück-Navigation im Pfad

Nach der Wahl wechselt die Section vollständig in den gewählten Pfad. Oben
steht eine **leise Zurück-Zeile dicht über dem Titel** (Proximity, PHILOSOPHY §4).
**Referenz-Implementierung:** das `fcv-back-row` / `fcv-back-btn`-Muster aus
`core/Footer/ContentViewer/FooterContentViewer.jsx` (der `‹ Back`-Button der
Footer-Artikelansicht) — gleiches Verhalten, gleiche Tonalität.

---

## 4. Pfad "Ich weiß nicht, wie…" (Verweis-Pfad)

- Kein eigener Erklär-Content. Der Pfad ist eine kurze, ruhige Liste der
  vorhandenen HelpModal-Sections (Workflow, Shortcuts, Code, Media, …), je mit
  einem Satz, was dort beantwortet wird.
- Klick auf einen Eintrag springt direkt in die jeweilige Section des HelpModals.
- Einträge als Text auf Baseline, Leise/Normal-Ebene — keine Karten, keine Boxen.

---

## 5. Pfad "Etwas ist kaputt" (Bug-Pfad)

### 5.1 Quick Checks (Vorfilter, optional)

- Vor dem Formular ein **leiser, eingeklappter Block** "Kurz prüfen, bevor du
  meldest" mit **2–4 kuratierten Common Issues** (nicht mehr — sobald die Liste
  wächst, ist sie wieder der Katalog, den die Prämisse ausschließt).
- Jedes Common Issue (z. B. "Generate-Button lässt sich nicht anklicken") fährt
  beim Klick eine **Checkliste** auf: "Alle Pflichtfelder befüllt?",
  "Emitter angewählt?", etc.
- Häkchen sind **echte klickbare Kontrollen** — funktionale Boxen, die der
  Mechanismus sind, sind erlaubtes Signal (LAW §5). Erfüllte Punkte quittieren
  **grün** (Feedback-Farbe Rolle 3, LAW §7 — kollidiert nicht mit `--tab-color`).
- Am Ende jeder Checkliste eine leise Brücken-Zeile:
  **"Alles erfüllt und es geht trotzdem nicht? → Report"** — springt ins
  Formular und **befüllt den Report-Titel vor** (z. B. "Generate-Button bleibt
  deaktiviert obwohl …").
- Der Block ist vollständig überspringbar; wer direkt melden will, geht sofort
  ins Formular.

### 5.2 Report-Formular

**Prinzip (aus LAW §6 abgeleitet): Frag den Nutzer nur, was das Tool nicht
selbst wissen kann.** Alles andere wird automatisch angehängt und taucht in
keinem Feld auf.

**Automatisch erfasst (unsichtbar für den Nutzer):**

- FMT-Version, OS
- Tab, der beim Öffnen des HelpModals aktiv war
- Geladene Map (Name + Version)
- Der aktuelle Log — **immer als Datei, niemals als Text im Report-Body**
  (siehe 5.4)

**Vom Nutzer abgefragt (genau 4 Felder + 1 Wahl):**

1. **"Wo ist es passiert?"** — Select, vorbefüllt mit dem zuletzt aktiven Tab,
   änderbar. Kostet meist null Aufwand.
2. **"Was wolltest du erreichen?"** — eine Zeile. Deckt Ziel *und* Erwartung ab
   (kein separates "Was hast du erwartet"-Feld — bei Tool-Bugs redundant, würde
   nur die Abbruchquote erhöhen).
3. **"Welche Schritte hast du gemacht?"** — einziges mehrzeiliges Feld.
   Placeholder macht nummerierte Schritte vor ("1. Map geladen 2. Emitter
   ausgewählt 3. …") — der Placeholder erzieht die Antwortform ohne Anleitung.
4. **"Was ist stattdessen passiert?"** — Placeholder weist darauf hin, eine
   eventuelle Fehlermeldung wörtlich zu nennen.
5. **"Passiert das jedes Mal?"** — Dreifach-Wahl: *jedes Mal / manchmal /
   bisher einmal*. Wichtigste Priorisierungsinfo für den Dev, ein Klick für
   den Nutzer.

Mehr wird nicht abgefragt. Alle Felder sind Text auf **immer sichtbarer
ruhender Baseline** (LAW §5, Affordanz-Regel für leere Felder); Placeholder
bleiben klar als solche erkennbar (PHILOSOPHY §6).

Die Antworten werden **wörtlich** in die Templates eingesetzt (Issue-Body /
Channel-Nachricht) — kein Feld ist verlorene Mühe.

### 5.3 Ziel & Versand

- Zielwahl **GitHub Issue / Mapping-Channel** als leise Auswahl (zwei
  Textoptionen auf Baseline) — **nicht** zwei gleichlaute Buttons (Dosierung,
  LAW §5: max. eine Secondary-CTA-Box pro Block).
- Darunter terminiert **genau eine TraceLine "Report erstellen"** das Formular —
  der einzige kinetische Akzent (T3) der gesamten Section (LAW §4). Der Sweep
  markiert den echten Zustandswechsel (erstellt/kopiert/exportiert).

**GitHub Issue:**

- Auth existiert bereits: GitHub OAuth Device Flow in
  `electron/modules/community.js` (Community-Tab, safeStorage-verschlüsselt).
  Issue-Erstellung ist derselbe Mechanismus (`POST /repos/…/issues`).
  *Zu prüfen: ob der Device-Flow-Scope (`public_repo`) gesetzt ist — der deckt
  Issues auf öffentlichen Repos ab.*
- **Angemeldet:** Issue wird direkt per API erstellt (Titel + Body aus dem
  Template). Erfolgsbestätigung mit Link zum Issue.
- **Nicht angemeldet:** wahlweise Anmeldung via Device Flow **oder**
  Browser-Weg: FMT öffnet die "New Issue"-URL mit vorbefülltem Titel/Body als
  URL-Parameter; der Nutzer sieht das fertige Issue und klickt selbst Submit.
  (URL-Längengrenze ~8k Zeichen ist für die reinen Antworten unkritisch, da der
  Log nicht im Text steckt.)

**Mapping-Channel (Discord):**

- FMT kopiert eine **vorgefertigte Nachricht** ins Clipboard: `@seraphimnoob` +
  die Antworten wörtlich ins Template eingesetzt + Schlusszeile "Log im Anhang".
  (Discord-Limit 2.000 Zeichen/Nachricht — die reinen Antworten passen, der Log
  nie; siehe 5.4.)
- Bestätigung: "Kopiert — füge die Nachricht im Mapping-Channel ein."

### 5.4 Log-Anhang — immer Datei, nie Text

Der Log wird **niemals als Text** in Issue-Body oder Nachricht eingebettet,
sondern immer als **Datei** angehängt. Mechanik je Kanal:

- **Discord:** FMT exportiert den Log als Datei (z. B. `fmt-report-log.txt`)
  und öffnet den Ablageordner; der Nutzer zieht die Datei als Anhang in den
  Channel. Die kopierte Nachricht verweist darauf ("Log im Anhang").
- **GitHub (Browser-Weg):** GitHubs Issue-Formular akzeptiert Drag-&-Drop-
  Anhänge. FMT exportiert die Log-Datei und öffnet den Ablageordner parallel
  zum vorbefüllten Issue — der Nutzer zieht die Datei ins Formular, GitHub
  wandelt sie in einen Attachment-Link.
- **GitHub (API-Weg, angemeldet):** *Bekannte Einschränkung — die GitHub-API
  kann keine Dateien an Issues anhängen.* Ablauf daher: Issue wird per API
  erstellt (Body endet mit "Log wird als Anhang nachgereicht"), FMT öffnet das
  erstellte Issue im Browser **und** den Ordner mit der exportierten Log-Datei;
  der Nutzer zieht sie in einen Kommentar. Ein Handgriff mehr, aber der einzige
  Weg, wie ein Log als Datei in ein API-erstelltes Issue kommt.

---

## 6. TRACE-Konformität (Kurzabgleich)

- **Loudness (LAW §1):** Nie mehr als drei Ebenen simultan. Einstieg: Titel
  (Orientierung) / zwei Wahlflächen (Normal, Hover-laut) / Erklärzeilen (leise).
  Bug-Pfad: Formular (Normal) / TraceLine (laut) / Quick Checks & Zurück-Zeile
  (leise).
- **Eine TraceLine pro Section (LAW §4 T3):** "Report erstellen". Sonst keine
  T3-Akzente; Checklisten-Links und Verweise bleiben leise.
- **Keine generischen Boxen (LAW §5):** Wahlflächen sind klickbare Textblöcke
  mit Hover-Kante; Felder sind Baselines; Checklisten-Häkchen sind funktionale
  Boxen (erlaubt); Report-Vorschau/Container höchstens eine Akzentkante.
- **Disclosure (LAW §6):** Quick Checks eingeklappt; Pfade sequenziell statt
  simultan; Auto-Metadaten unsichtbar. Nichts Sicherheitsrelevantes wird
  versteckt (der Nutzer sieht beim Browser-Weg das fertige Issue vor Submit).
- **Farbrollen (LAW §7):** `--tab-color` nur für Subtitle-Ebene, Hover-Kanten
  und TraceLine; Grün für erfüllte Checkpunkte ist Feedback-Farbe Rolle 3.
- **Motion (PHILOSOPHY §5):** Hover-Kante, Checklisten-Auffahren, TraceLine-
  Sweep — jede Bewegung markiert einen echten Zustandswechsel.

---

## 7. Technische Andockpunkte

| Baustein | Ort / Name |
|---|---|
| Section | `Shared/Ui/HelpPanel/Sections/TroubleshootSection.jsx` (bestehender Slot, Inhalt komplett neu) |
| Weiche + Pfad-Zustand | lokaler State in der Section (`useTriagePath` o. ä.) |
| Zurück-Zeile | Muster von `fcv-back-row`/`fcv-back-btn` (`FooterContentViewer.jsx`) |
| Quick Checks | `QuickCheckList` — deklarative Issue-Definition (Titel, Checkpunkte, vorbefüllter Report-Titel) |
| Formular | `BugReportForm` + `useReportDraft` (Template-Befüllung GitHub/Discord) |
| Log-Export | neuer IPC-Handler auf Basis `electron/modules/logger.js` (Log als Datei exportieren + Ordner öffnen) |
| Issue-Erstellung | Erweiterung `electron/modules/community.js` (`POST /repos/…/issues`, bestehende Token-Ablage; Scope prüfen) |
| Browser-Fallback | vorbefüllte New-Issue-URL via `shell.openExternal` |
| Clipboard | Electron `clipboard` für die Discord-Nachricht |

Namenskonventionen: PascalCase-Komponenten, camelCase-Hooks, bestehendes
`HelpPanel/Sections`-Schema.

---

## 8. Offene Punkte

- [ ] Endgültige Wortlaute der 4 Formularfelder + Placeholder (Vorschlag in 5.2
      steht, noch nicht final abgenickt)
- [ ] Kuratierung der 2–4 Quick-Check-Issues (Inhalte + Checkpunkte)
- [ ] Scope-Prüfung des bestehenden OAuth Device Flow (`public_repo` für
      Issue-Erstellung ausreichend?)
- [ ] Ziel-Repo für Issues festlegen (dasselbe wie Contribution-PRs?)
- [ ] Exakter Wortlaut des Discord-Templates (inkl. `@seraphimnoob`-Mention)
