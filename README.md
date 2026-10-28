# MoneyPilot

MoneyPilot ist ein moderner, deutschsprachiger Finanzplaner für den Browser (erster Prototyp).

## Funktionen

- **Übersicht (Dashboard):** Einnahmen, Ausgaben, Saldo und verfügbares Monatsbudget
- **Buchungen:** Einnahmen und Ausgaben hinzufügen, filtern und löschen
- **Kategorien:** Wohnen, Lebensmittel, Mobilität, Freizeit, Gesundheit, Sonstiges (Ausgaben) sowie Gehalt, Nebenjob, Sonstiges (Einnahmen)
- **Monatsbudget:** festlegen und verbleibendes Budget mit Fortschrittsbalken sehen
- **Sparziele:** Zielbetrag, optionales Zieldatum, Einzahlen/Entnehmen und Fortschrittsanzeige
- **Diagramme:** Ausgaben nach Kategorie (Ring) und Einnahmen/Ausgaben der letzten 6 Monate (Balken)
- **Statistik:** Sparquote, Durchschnitt, größte Kategorie und Ausgabe, Vergleich mit dem Vormonat
- **Spartipps:** allgemeine Tipps und ein persönlicher Hinweis

Beim ersten Start werden **Beispieldaten** geladen. Sie sind überall mit „Beispiel“ markiert und lassen sich mit einem Klick entfernen.

## App starten

Es ist keine Installation nötig.

1. Repository herunterladen (auf GitHub: „Code“ → „Download ZIP“) und entpacken.
2. Die Datei `index.html` doppelklicken – sie öffnet sich im Browser.

Funktioniert in aktuellen Versionen von Chrome, Edge, Firefox und Safari, auch ohne Internet.

## Daten

Alle Daten werden nur **lokal im Browser** gespeichert (`localStorage`). Nichts wird an einen Server geschickt.
Es gibt keine Bankverbindung, keine KI-Dienste und keine kostenpflichtigen Dienste.
Hinweis: Wenn du die Browserdaten löschst oder einen anderen Browser nutzt, sind die Daten dort nicht vorhanden.

## Tests

Die Rechenfunktionen (Beträge, Budget, Sparziele, Statistik) haben automatische Tests.
Dafür wird [Node.js](https://nodejs.org) benötigt:

```bash
npm test
```

## Aufbau

```
index.html            Seitenstruktur
css/style.css         Gestaltung (Farben, Layout, Handy-Ansicht)
js/calculations.js    alle Berechnungen (Beträge werden in Cent gespeichert)
js/storage.js         Speichern im Browser und Beispieldaten
js/charts.js          selbst gezeichnete SVG-Diagramme
js/app.js             Seitenwechsel, Formulare und Anzeige
tests/                automatische Tests
```
