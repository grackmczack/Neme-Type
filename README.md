# NEMESIS316 gegen die intergalaktischen KILLER KIFFER

Ein 90er-Arcade-Shooter im Browser für die Nemesis316-Community. Ein Fan-Game mit 8-Bit-Intro, vier Sektoren, vier Bossen, fünf Waffen, vierzehn Sorten Gegner mit eigenem Verhalten und einem Fake-Stream-Chat, der alles kommentiert.

**Die Story:** Donnerstagvormittag, der Stream läuft. Nemesis streamt immer von 9:30 bis 14 Uhr, Montag bis Samstag. Nemesis316 greift nach seiner XXL-Sportwasserflasche, aber da ist nichts mehr. Dann schalten sich per Dial-up-Modem die intergalaktischen Killer Kiffer zu: „Wir haben deine Flasche.“ Nemesis nennt sie Halodris. Das Spiel beginnt.

## Lokal starten

Voraussetzung: **Node.js 22 oder neuer**. Es gibt keine zu installierenden Abhängigkeiten und keinen Build-Schritt.

```bash
npm start
```

Dann **http://localhost:3000** öffnen. Den Server mit `Strg+C` beenden.

Alternative für rein statisches Hosting (Highscores nur im jeweiligen Browser):

```bash
python3 -m http.server 8080
```

Dann http://localhost:8080 öffnen. Wegen der JavaScript-Module bitte einen HTTP-Server verwenden und nicht `index.html` über `file://` öffnen.

## Spielen

| Taste | Funktion |
| --- | --- |
| WASD / Pfeiltasten | Schiff bewegen |
| Leertaste halten | Feuern |
| X halten und loslassen | Ladeschuss („Hadouken“) |
| Q | Waffe wechseln (zwischen gefundenen Waffen) |
| E | Force-Satellit abkoppeln / andocken |
| B | Begrenzte Wasserbombe |
| P / Escape | Pause / fortsetzen |
| M | Ton an / aus |
| Enter | Start, Intro und Dialoge weiterschalten |

Auf Smartphones und Tablets erscheinen Touch-Tasten. Beim Wechseln des Tabs pausiert die Mission automatisch. Die Schwierigkeit (**Entspannt**, **Arcade**, **Nemesis**) und das 8-Bit-Intro stellst du unter dem Bildschirm ein. Im Intro überspringt `Esc` alles, `Enter` schaltet weiter.

### Waffen und Power-Ups

Kapseln fallen von Gegnern mit blinkender Kapsel und manchmal von normalen. Dieselbe Kapsel noch einmal gesammelt erhöht die Stufe (bis 3). Wer ein Leben verliert, verliert eine Waffenstufe.

| Waffe | Verhalten |
| --- | --- |
| **Aqua-Laser** | Standard. Ab Stufe 2 doppelt, ab Stufe 3 mit Diagonalschüssen. |
| **Sprudel-Streuer** | Fächerschuss mit begrenzter Reichweite, stark auf kurze Distanz. |
| **Wasserwerfer** | Durchschlägt mehrere Gegner, sehr hohe Feuerrate. |
| **Seifenblasen** | Suchen sich ihr Ziel selbst. Stufe 3 mit Flächenschaden. |
| **Kronkorken-Orbit** | Kreisende Korken rupfen Gegner und fangen Kugeln ab. |

Zusätzlich: **Schild-Blase** (3 Treffer frei), **Speed-Sprudel**, **Zeitlupe** (Matrix-Bullet-Time), **Magnet**, **Carlton-Dance** (kurz unverwundbar), **Wasserbombe**, **Sportwasser** (Schild auffüllen) und die seltene **1-UP-Flasche**.

### Gegner

Jeder Typ verhält sich anders, zum Beispiel: Drohnen fliegen Wellen, Stürzer markieren dich und rammen, Bong-Mütter zerfallen in drei Bonglinge, Dübel-Türme sitzen auf Boden oder Decke, Kush-Kraken sind lange Schlangen, Neo-Schleicher verschwinden in der Matrix, Rauch-Ritter tragen einen Frontschild (Ladeschuss oder von hinten treffen, den Force-Satelliten vorausschicken hilft), Modem-Minenleger legen Minen, Geocities-Sniper zeigen einen Laser an und schießen, Büroklammer-Bots heilen andere, Pipes-Orbiter kreisen, Nokia-Panzer sind fast unkaputtbar und Spliff-Spinner verschießen Spiralen.

Bei jedem erstmals auftretenden Gegnertyp und jedem Boss öffnet sich DarthRicks Portal: Er begrüßt den Neuankömmling, der freundlich zurückgrüßt. Der Kampf pausiert währenddessen. Die Bosse stellen sich mit einer Street-Fighter-Karte vor und haben je eine eigene Mechanik (nur bei offenem Maul verwundbar, teleportierende Fehlerfenster, Finish-Him-Phase mit Ladeschuss-Fatality …). Wer einen Boss ohne Treffer besiegt, bekommt einen Flawless-Bonus.

### Geheimnisse

Der **Konami-Code** (↑↑↓↓←→←→BA) auf dem Titelbild, im Intro, in der Pause oder im Spiel gibt 30 Leben und volle Bewaffnung. Solche Läufe kommen nicht in die Bestenliste.

## Server und eigene Domain

Die Node-Version liefert die Website und die gemeinsame Highscore-API aus. Einstellungen über Umgebungsvariablen:

```bash
HOST=127.0.0.1 PORT=3000 npm start
```

Für eine Domain beispielsweise Nginx oder Caddy als HTTPS-Reverse-Proxy davor setzen. Minimales Caddy-Beispiel:

```caddyfile
spiele.example.de {
    reverse_proxy 127.0.0.1:3000
}
```

Die Domain muss auf den Server zeigen. Für einen dauerhaften Betrieb den Node-Prozess über einen Prozessmanager oder systemd starten.

Auch ein Unterverzeichnis wird unterstützt:

```bash
HOST=127.0.0.1 BASE_PATH=/neme-type PORT=3000 npm start
```

Der Proxy muss in diesem Fall den Pfad `/neme-type/` unverändert weitergeben. Im Browser dann `https://spiele.example.de/neme-type/` öffnen.

Optional per Docker:

```bash
docker build -t neme-type .
docker run --rm -p 3000:3000 -v neme-scores:/app/data neme-type
```

Die gemeinsame Bestenliste liegt in `data/scores.json`. Diesen Ordner bei Updates erhalten bzw. sichern. Der Server erstellt ihn beim ersten Eintrag und speichert atomar die besten zehn Scores. Ein fehlender Score-Server führt zum lokalen Browser-Speicher. Das Leaderboard ist eine einfache Community-Bestenliste: Scores kommen vom Browser, es gibt keine serverseitige Spielsimulation oder Cheat-Prüfung.

**Wichtig bei neuen Dateien:** `server.mjs` liefert nur eine feste Liste von Dateien im Projektstamm (`STATIC_FILES`) sowie alles unter `assets/` aus. Neue JavaScript-Module müssen dort und im `Dockerfile` eingetragen werden.

## Projekt

- `index.html`, `styles.css`, `app.js`: Arcade-Gehäuse, Overlays, Steuerung, Highscores.
- `game.js`: Engine-Kern (Zustandsautomat, Simulation, Eingaben). Importiert die Module unten.
- `content.js`: Sektoren, Gegner, Waffen, Power-Ups, Story-, Chat- und Intro-Texte.
- `enemies.js`: Gegner-KI, Formationen und Zeichnen der Gegner. `bosses.js`: die vier Bosse. `weapons.js`: die fünf Waffen.
- `sprites.js`: Pixel-Sprites (ASCII-Maps mit automatischem Outline) und Laden der KI-Grafiken.
- `render.js`: Hintergründe, HUD im Stream-Overlay-Stil, Boss-Karte, Banner, CRT-Filter.
- `intro.js`: 8-Bit-Intro (Nemesis am Stream, UFO-Flaschenklau, Killer-Kiffer-Anruf, „Halodris!“, Titel-Slam).
- `audio.js`: Chiptune-Synthesizer (Sektor-Songs, Boss-Track, Modem, Effekte), komplett per WebAudio.
- `server.mjs`: statischer HTTP-Server und persistente Highscore-API ohne Dependencies.
- `assets/Nemesis316.png`: bereitgestelltes Porträt, `assets/nemesis_aesthetik.png` (nur lokal, nicht im Repository): Stream-Referenz für Farbwelt und Gestaltung.
- `assets/gen/`: Logo, vier Sektor-Hintergründe, vier Boss-Porträts, Panda und Sportkanister (KI-generiert, der Kanister nach einem Referenzfoto) sowie die 8-Bit-Figur von Nemesis (`nemesis8.webp`, mit separatem Arm `nemesis8-arm.webp` für das Intro).
- `assets/fonts/`: lokale Schriften mit SIL-OFL-Lizenzen (Press Start 2P, Titan One, Barlow Condensed, Space Grotesk).

### Grafiken neu erzeugen

Die Bilder in `assets/gen/` stammen von `alibaba/qwen-image-3` auf Replicate. Wer sie ändern möchte:

```bash
export REPLICATE_API_TOKEN=…          # nur im Environment, wird nirgends gespeichert
node scripts/generate-assets.mjs              # alle, oder z. B.: … logo boss2
./scripts/process-assets.sh                   # Freistellen (Chroma-Key) und Verkleinern, braucht ImageMagick
```

Die Rohbilder landen in `assets/gen/raw/` (nicht im Repository), die Prompts stehen in `scripts/generate-assets.mjs`. Der Kanister wird anhand des lokalen Referenzfotos `assets/Sportwasserflasche.jpg` erzeugt, die 8-Bit-Figur stammt aus `assets/Nemesis-8bit.png`; beide Quellen liegen nur lokal. Für die Figur braucht `process-assets.sh` Python mit Pillow, numpy und scipy (`scripts/key-sprite.py`, `scripts/split-arm.py`). Fehlen die Bilder, läuft das Spiel mit Code-Figuren und Code-Hintergründen weiter.

## Deployment (Strato-Webspace, Apache + PHP)

Live läuft das Spiel auf einem Plesk-Webspace mit Apache und PHP-FPM, ohne Node-Prozess. `deploy/deploy.sh` lädt per rsync die Spieldateien (`index.html`, JS-Module, `assets/`), die Apache-Konfiguration (`deploy/web/.htaccess`), die PHP-API und das Dashboard hoch:

```bash
export DEPLOY_USER=<ssh-benutzer> DEPLOY_KEY=~/.ssh/<privater-schluessel>
ANALYTICS_PASSWORD=<passwort> ./deploy/deploy.sh   # Passwort nur beim ersten Mal oder zum Ändern nötig
```

- **Highscores:** `deploy/web/api/scores.php` ist die PHP-Version der Node-API (gleicher Vertrag, gleiche Validierung, Limit 8 Einträge pro Minute und Adresse). Die Daten liegen in SQLite außerhalb des Webroots (`~/neme/data/`).
- **Statistik unter `/analytics/`:** ein kleines, eigenes Tool (PHP + SQLite, kein JavaScript im Dashboard). Anmeldung per Apache Basic Auth, Benutzer `admin`. Gezählt werden Seitenaufrufe, Besucher, Herkunft, Land (über Cloudflare), Gerät und Browser sowie Spielereignisse: Starts, erreichte Sektoren, besiegte Bosse, Game Over und Siege, Spieldauer, Score, Schwierigkeit, Intro übersprungen oder nicht, Ton, Vollbild, Konami-Code. Es gibt keine Cookies, IP-Adressen werden nicht gespeichert (Besucher nur über einen täglich wechselnden Hash gezählt), Do-Not-Track und Global Privacy Control werden respektiert, lokal (`localhost`) wird nichts gesendet. Die Ereignisse sind in `deploy/web/api/collect.php` auf eine feste Liste beschränkt.
- **Hinter Cloudflare:** Land und echte Client-Adresse werden nur geglaubt, wenn die Anfrage aus einem Cloudflare-Netz kommt.
- **Datenschutz und Impressum:** Auch eine anonyme Statistik gehört in die Datenschutzerklärung, und eine öffentliche Website braucht ein Impressum. Beides muss der Betreiber selbst ergänzen.
- **Vor dem Deploy in Plesk prüfen:** Ist als bevorzugte Domain `www` eingestellt, braucht `www` einen DNS-Eintrag (CNAME auf die Hauptdomain), sonst führt die Weiterleitung ins Leere.

## Sicherheit

- Strikte Content-Security-Policy (`default-src 'none'`, kein Inline-Code), `nosniff`, `X-Frame-Options`, COOP/CORP und Permissions-Policy auf jeder Antwort.
- Ausgeliefert wird nur eine feste Dateiliste plus bekannte Dateitypen unter `assets/` (keine Dotfiles, kein `assets/gen/raw`).
- Highscore-API: JSON-Pflicht (415), 4-KB-Limit, Namens- und Score-Validierung (max. 1.000.000, Sieg nur in Sektor 4), Limit von 8 Einträgen pro Minute und Adresse (`SCORE_POSTS_PER_MINUTE`, hinter einem Proxy `TRUST_PROXY=1` setzen), Zeitlimits für Anfragen.
- Das Leaderboard bleibt vertrauensbasiert: Scores kommen vom Browser und lassen sich fälschen. Es gibt keine Accounts und keine Secrets im Projekt; das Replicate-Token wird nur aus der Umgebung gelesen.

## Prüfen

```bash
npm test
```

Die Tests prüfen die Kampagne über vier Sektoren bis zur Flaschenrettung (auch mit einem unverwundbaren Autopiloten durch alle Bosse), eingefrorene Kämpfe während der Portal-Szenen, Waffen und Power-Ups, die KI jedes Gegnertyps und jedes Bosses, Frontschild und Geistmodus, den Konami-Code, das Intro, konsistente Endscores sowie Score-Validierung, Speicherung, gleichzeitige Zugriffe und Auslieferung unter einem Unterpfad. Das Rendern wird in den Tests ausgespart und wurde zusätzlich in Chromium geprüft (Desktop und Touch-Viewport, Intro, alle Sektoren, Boss-Karten, Überlagerungen). Die Anwendung benötigt keine externen CDN-Dateien, Konten oder Dienste.

Alle Namen, Figuren und Anspielungen sind Parodie und Hommage. Die Killer Kiffer, ihre Bosse und DarthRick stammen aus dem Nemesis-Universum dieses Fan-Games.
