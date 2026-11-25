# Magic the Foxering 🦊

Magic-the-Gathering-Sammler-App für Android (und als Web-App fürs iPhone): freihändig Karten scannen
(Deutsch & Englisch), Sammlung mit Cardmarket-Preisen, Sets, Decks, Fertigdecks und ein Deck-Assistent
mit aktueller Meta.

## Einrichten (einmalig)

1. Auf GitHub ein **öffentliches** Repository mit genau dem Namen **`magic-the-foxering`** anlegen
   und den Inhalt dieses Ordners hochladen (Branch `main`).
2. Es starten automatisch zwei Abläufe (Reiter **Actions**):
   - **Daten aktualisieren** – lädt alle Karten, Preise, Fertigdecks und die Meta und legt sie im
     Branch `gh-pages` ab. Läuft danach jeden Morgen automatisch.
   - **APK bauen** – baut die App mit allen Kartendaten. Die APK liegt danach unter
     **Releases → neueste Version → Foxering.apk**.
3. Optional fürs iPhone: **Settings → Pages → Branch `gh-pages` / root** einschalten. Dann läuft
   die App unter `https://hubbinghubberhubsterlobster.github.io/magic-the-foxering/` im Browser
   (Safari → Teilen → „Zum Home-Bildschirm“).

Neue Versionen installieren sich als Update, die Sammlung bleibt erhalten.

## So funktioniert's

- **Scanner:** Handy in den Ständer legen, Scan-Knopf drücken, Karte drunter schieben. Die App liest
  den Namen oben und unten links Sammlernummer, Set und Sprache (z. B. `0123 R` + `MH3 • DE`),
  erkennt so den genauen Druck, piept und wartet auf die nächste Karte. Kein Tippen nötig.
- **Preise:** Cardmarket-Trendpreise (normal & Foil) über Scryfall, täglich aktualisiert, in Euro
  oder umgerechnet in andere Währungen (EZB-Kurse).
- **Sammlung & Sets:** alle Drucke, Filter nach Farbe, Typ, Seltenheit, Format; Set-Fortschritt.
- **Decks:** Commander, Standard, Pioneer, Modern, Pauper, Legacy … Karten sind fest einem Deck
  zugeordnet: holst du eine Karte in ein anderes Deck, fehlt sie im alten.
- **Fertigdecks:** „Decks → Fertigdeck gekauft“ fügt alle Karten eines Commander-, Starter- oder
  Planeswalker-Decks auf einmal hinzu (Daten: MTGJSON).
- **Deckbuilder:** Empfehlungen aus deinen Karten (Filter: Beste, Stufe, sofort spielbar, Aggro/Midrange/Kontrolle,
  Schalter „Turnierspielbar“), selbst bauen oder nach Wünschen bauen lassen; Meta-Decks (MTGGoldfish) und
  beliebte Commander (EDHREC) unter „Mehr“; Bewertung S–D inklusive Spielanleitung.
- **Bundle-Events:** gekauftes Bundle anlegen, Karten getrennt hineinscannen oder als Datei importieren,
  Decks nur aus dem Bundle bauen, später in die Sammlung übernehmen oder als normales Deck kopieren.
- **Zusammensuchen:** Abhak-Liste für ein Deck, sortiert nach Farbe und Manawert, mit Druck und Fundort.
- **Koop:** Sammlung eines Mitspielers laden (Backup/CSV) und ausgeglichene Duell-Decks für euch beide finden.
- **iPhone:** schlanke Texterkennung im Browser, alternativ Foto-Erkennung (📸).
- **Import/Export:** CSV (Moxfield, Manabox, Deckbox …), Decklisten als Text (Moxfield/Arena),
  automatisches Backup als JSON in `Download/Foxering`.

## Aufbau

- `app/src/main/java/de/foxering/app/MainActivity.java` – WebView-Hülle, Texterkennung (ML Kit),
  Netz-Proxy, Kamera, Dateien
- `app/src/main/assets/www/` – Oberfläche (`app.js`), Daten (`data.js`), Kartenerkennung
  (`engine.js`), Deck-Assistent (`assistant.js`)
- `tools/build-data.mjs` – bereitet die Daten vor (läuft in GitHub Actions)

Datenquellen: [Scryfall](https://scryfall.com) (Karten, Bilder, Cardmarket-Preise),
[MTGJSON](https://mtgjson.com) (Fertigdecks), [MTGGoldfish](https://www.mtggoldfish.com) und
[EDHREC](https://edhrec.com) (Meta), EZB (Kurse).
Inoffizielle Fan-App. Magic: The Gathering ist eine Marke von Wizards of the Coast.
