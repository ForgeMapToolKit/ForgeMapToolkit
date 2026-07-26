# _backup — inerte Referenzkopien

Dieser Ordner ist **kein Teil der Anwendung**. Nichts hier wird gebaut, gebündelt,
gelintet oder ausgeliefert. Er existiert nur, damit Code, der aus `src/` entfernt
wird, nachschlagbar bleibt, ohne dafür in der Git-Historie graben zu müssen.

**Regel: aus `_backup/` wird nie importiert.** Wer etwas davon wieder braucht,
kopiert es bewusst nach `src/` zurück und schließt es dort an. Ein `import` aus
diesem Ordner heraus wäre exakt der Zustand, den das Aufräumen beseitigen soll.

Warum der Ordner von der Toolchain nicht gesehen wird:

| Werkzeug | Warum es hier nicht hinschaut |
|---|---|
| Vite | bündelt nur, was von `index.html` aus erreichbar ist — nichts importiert `_backup/` |
| ESLint | `_backup/**` steht in den `ignores` von `eslint.config.js` |
| electron-builder | `build.files` in `package.json` listet nur `dist`, `electron`, `public`, `data`, `utils` |
| design-lint | läuft ausschließlich über `src/` |

---

## Libraries — abgelegt 2026-07-26

Die vier Library-Komponenten, unverändert und byte-identisch zum Stand von
`src/components/shared/Libraries/` an diesem Tag. Anlass: die Libraries werden
von Grund auf neu gebaut, ihre Klassen fallen dabei komplett weg. Die Kopie
sichert das Klassen-Vokabular und — wichtiger — die Markup-Struktur, in der die
Klassen überhaupt eine Bedeutung haben. Eine Klassenliste ohne das zugehörige
JSX wäre nicht rekonstruierbar, deshalb liegen beide Dateien nebeneinander.

| Library | Klassen | CSS | JSX |
|---|---:|---:|---:|
| EmitterLibrary | 78 | 467 | 483 |
| PropsLibrary | 126 | 741 | 725 |
| SkyboxLibrary | 63 | 363 | 315 |
| UnitLibrary | 48 | 595 | 714 |

Die `import`-Pfade in den `.jsx`-Dateien zeigen weiterhin auf `src/` und lösen
von hier aus nicht auf. Das ist Absicht: sie dokumentieren, woran die Library
hing, und verhindern zugleich, dass die Datei versehentlich lauffähig wirkt.

Die Originale liegen zum Zeitpunkt dieser Ablage **noch** unter
`src/components/shared/Libraries/` und funktionieren. Diese Kopie ist die
Absicherung dafür, dass sie später ohne Rückfrage gelöscht werden können.
