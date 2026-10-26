# MathGraf

Webapp zum Erstellen von **Koordinatensystemen**, **Karopapier** und **Funktionsgraphen** als PNG-Bild,
das sich **maßstabsgetreu** in Word einfügen lässt (1 cm im Programm = 1 cm auf dem Ausdruck).

## Starten

Keine Installation nötig: `index.html` im Browser öffnen. Alles läuft lokal im Browser, es werden keine Daten übertragen.

Online lässt sich die App z. B. über GitHub Pages bereitstellen
(*Settings → Pages → Deploy from a branch*, Ordner `/ (root)`).

## Funktionen

- **Koordinatensystem:** Achsenbereich, Einheit in cm (getrennt für x und y), Beschriftungsabstand,
  Achsennamen, Pfeile, Skalenstriche, Dezimalkomma, Schriftgröße in pt
- **Karopapier:** freie Blattgröße, Kästchengröße, Hauptlinien (z. B. Millimeterpapier), Rahmen, Vorlagen
- **Funktionsgraphen:** beliebig viele Funktionen mit Farbe, Linienstärke, Linienart, Definitionsbereich und Namen.
  Polstellen (z. B. `tan(x)`, `1/x`) und Definitionslücken (z. B. `sqrt(x)`) werden korrekt dargestellt.
- **Punkte:** z. B. `A(1|2) B(-3|0,5)`
- **Export:** PNG mit 150, 300 oder 600 dpi, weißer oder transparenter Hintergrund

### Schreibweise für Funktionen

`0,5x^2 - 2`, `f(x) = 2sin(x)`, `sqrt(x+4)`, `|x| - 1`, `e^(-x)`, `root(x; 3)`

Implizite Multiplikation (`2x`, `3(x+1)`) und Dezimalkomma werden unterstützt.
Funktionen: `sin cos tan cot arcsin arccos arctan sinh cosh tanh sqrt cbrt abs ln lg log exp floor ceil round sgn min max pow root logb`,
Konstanten: `pi` (`π`), `e`.

## Warum das Bild in Word die richtige Größe hat

Beim Export wird die Auflösung als `pHYs`-Chunk in die PNG-Datei geschrieben. Word liest diesen Wert und
berechnet daraus die Größe in cm. Wichtig:

1. Bild über **Einfügen → Bilder → Dieses Gerät…** einfügen, nicht über die Zwischenablage (dabei geht die Auflösung verloren).
2. Unter **Größe und Position** muss die Skalierung 100 % betragen.
3. Beim Drucken „Tatsächliche Größe“ wählen.

## Entwicklung

```
node test/parser.test.js
```

Aufbau:

- `js/parser.js` – sicherer Parser für Funktionsterme (ohne `eval`)
- `js/render.js` – Zeichnen auf ein Canvas, alle Maße in cm
- `js/png.js` – schreibt die Auflösung in die PNG-Datei
- `js/app.js` – Bedienoberfläche, Vorschau, Export

Einzeldatei mit allem CSS/JS erzeugen (z. B. zum Weitergeben oder für Tablets):

```
node tools/bundle.js mathgraf.html
```
