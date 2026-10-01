// Inhalte: Sektoren, Gegner, Waffen, Power-Ups, Story- und Chat-Texte.
export const W = 960;
export const H = 540;
export const TAU = Math.PI * 2;
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const random = (low, high) => low + Math.random() * (high - low);
export const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** Gegnertypen. `ai` verweist auf enemies.js; Kürzel: sprite = Schlüssel in sprites.js. */
export const ENEMY_TYPES = {
  drone: {
    id: 'drone', name: 'Tamagotchi-Drohne', hp: 3, radius: 22, score: 100, color: '#9dffb4', sprite: 'drone',
    formations: ['line', 'vee', 'sinepair'],
    reply: 'Piep piep! Bitte füttere mich. Oder schieß. Egal, Hauptsache Aufmerksamkeit.',
    tip: 'Fliegt Wellen. Harmlos, aber frech.',
  },
  diver: {
    id: 'diver', name: 'Blunt-Stürzer', hp: 3, radius: 20, score: 140, color: '#ffbc68', sprite: 'diver',
    formations: ['column', 'pincer', 'single'],
    reply: 'Moin Rick! Bin nur kurz am Sturzflug üben. Kein Stress, ich schwör.',
    tip: 'Visiert dich an und stürzt sich dann drauf.',
  },
  splitter: {
    id: 'splitter', name: 'Bong-Mutter', hp: 7, radius: 28, score: 200, color: '#b9a2ff', sprite: 'splitter',
    formations: ['single', 'single', 'column'],
    reply: 'Hallo Rick! Ja, die Kinder kommen gleich nach. Sie sind etwas… aufgeweckt.',
    tip: 'Zerfällt in drei kleine Bonglinge.',
  },
  mini: {
    id: 'mini', name: 'Bongling', hp: 1, radius: 13, score: 40, color: '#d8caff', sprite: 'mini',
    formations: [], reply: '', tip: '',
  },
  turret: {
    id: 'turret', name: 'Dübel-Turm', hp: 6, radius: 24, score: 180, color: '#ff9f6b', sprite: 'turret',
    formations: ['floor', 'ceiling', 'floor'],
    reply: 'Servus Rick. Ich steh hier nur rum. Wie im echten Leben, ne?',
    tip: 'Sitzt auf Boden oder Decke und zielt auf dich.',
  },
  kraken: {
    id: 'kraken', name: 'Kush-Krake', hp: 9, radius: 20, score: 260, color: '#64f7ce', sprite: 'kraken',
    formations: ['single', 'single'],
    reply: 'Moin Rick! Acht Arme, aber nur ein Follow für dich.',
    tip: 'Lange Schlange: Jedes Segment ist verwundbar.',
  },
  phaser: {
    id: 'phaser', name: 'Neo-Schleicher', hp: 4, radius: 20, score: 220, color: '#7dff9a', sprite: 'phaser',
    formations: ['line', 'single', 'sinepair'],
    reply: 'Hallo Rick. Es gibt keinen Löffel. Und keine Flasche. Oder doch?',
    tip: 'Verschwindet in der Matrix. Nur sichtbar verwundbar.',
  },
  shield: {
    id: 'shield', name: 'Rauch-Ritter', hp: 9, radius: 26, score: 300, color: '#d394ff', sprite: 'shield',
    formations: ['single', 'column'],
    reply: 'Sei gegrüßt, DarthRick! Dein Chat ist wirklich allerliebst.',
    tip: 'Frontschild! Ladeschüsse oder von hinten treffen.',
  },
  swarm: {
    id: 'swarm', name: 'Kiffer-Käfer', hp: 1, radius: 14, score: 60, color: '#e6ff70', sprite: 'swarm',
    formations: ['behind', 'behind', 'swarmfront'],
    reply: 'Bzzzt! Hi Rick! Wir sind ein Schwarm, ey. Alle gleichzeitig.',
    tip: 'Kommt in Schwärmen, auch von hinten.',
  },
  mine: {
    id: 'mine', name: 'Modem-Minenleger', hp: 6, radius: 24, score: 240, color: '#ff8fe1', sprite: 'minelayer',
    formations: ['single', 'single'],
    reply: 'Hallo Rick! Kschhh-pöpöpöp-kschhh. Das heißt Hallo.',
    tip: 'Lässt schwebende Minen zurück.',
  },
  sniper: {
    id: 'sniper', name: 'Geocities-Sniper', hp: 5, radius: 22, score: 280, color: '#ffe866', sprite: 'sniper',
    formations: ['single', 'single'],
    reply: 'Hey Rick! Meine Seite ist im Aufbau. Ich auch.',
    tip: 'Bleibt stehen, markiert dich und schießt einen Strahl.',
  },
  healer: {
    id: 'healer', name: 'Büroklammer-Bot', hp: 6, radius: 22, score: 320, color: '#b8e6ff', sprite: 'clip',
    formations: ['single'],
    reply: 'Es sieht aus, als würdest du Rick begrüßen. Brauchst du dabei Hilfe?',
    tip: 'Heilt Gegner. Zuerst ausschalten!',
  },
  orbiter: {
    id: 'orbiter', name: 'Pipes-Orbiter', hp: 7, radius: 22, score: 280, color: '#6fe0ff', sprite: 'orbiter',
    formations: ['single', 'single'],
    reply: 'Hi Rick! Ich drehe mich seit 1995. Mir ist schwindelig.',
    tip: 'Kreist auf der Stelle und verteilt Kugeln.',
  },
  nokia: {
    id: 'nokia', name: 'Nokia-Panzer', hp: 16, radius: 30, score: 420, color: '#9fc4b0', sprite: 'nokia',
    formations: ['single'],
    reply: 'Hallo Rick! Mich kriegt man nicht klein. Auch nicht mit einem Hammer.',
    tip: 'Unkaputtbar, aber irgendwann doch.',
  },
  spiral: {
    id: 'spiral', name: 'Spliff-Spinner', hp: 8, radius: 24, score: 340, color: '#ffd27a', sprite: 'spiral',
    formations: ['single', 'single'],
    reply: 'Moin Rick! Puff, puff, pass… Ich hab vergessen, wohin.',
    tip: 'Dreht sich und schießt Spiralen.',
  },
};

const E = ENEMY_TYPES;

export const SECTORS = [
  {
    name: 'DIE RAUCHZONE', subtitle: 'Orbit von Planet Hotbox · Game-Boy-Grün', duration: 52,
    color: '#ff5fd2', accent: '#ffb24a', bg: 'bg1', boss: 'Admiral High', bossKind: 0,
    enemies: [E.drone, E.diver, E.splitter, E.turret],
    bossReply: 'Servus Rick! Das ist keine Falle. …Okay, vielleicht ein bisschen.',
    clear: 'Danke, Nemesis! Aber deine Flasche ist in einem anderen Sektor!',
    palette: ['#0a0620', '#2a0f4a', '#6a1f6e'],
  },
  {
    name: 'BONG-NEBEL', subtitle: 'Durch das Matrix-Gewächshaus', duration: 56,
    color: '#3dffb8', accent: '#9dff6a', bg: 'bg2', boss: 'Bongzilla', bossKind: 1,
    enemies: [E.kraken, E.phaser, E.shield, E.swarm],
    bossReply: 'Guten Morgen, Rick! RAAAWR. …Das war die Begrüßung.',
    clear: 'Bongzilla ist platt. Aber dieser Sektor war nur Level 2 von 4!',
    palette: ['#00120e', '#06301f', '#0f5a3a'],
  },
  {
    name: 'DIAL-UP-DIMENSION', subtitle: 'Bitte warten Sie. Sie werden verbunden …', duration: 58,
    color: '#62c8ff', accent: '#ff7fe6', bg: 'bg3', boss: 'Klammer-Koloss', bossKind: 2,
    enemies: [E.mine, E.sniper, E.healer, E.orbiter],
    bossReply: 'Es sieht aus, als wollten Sie Ihre Flasche retten. Möchten Sie Hilfe dabei? Nein? Schade.',
    clear: 'Verbindung getrennt. Sie haben Post! Kaum noch eine Festung bis zur Flasche.',
    palette: ['#05102a', '#0b2b5a', '#14509a'],
  },
  {
    name: 'FESTUNG DÜBEL', subtitle: 'Die Sportwasserflasche ist zum Greifen nah', duration: 62,
    color: '#ff6a3d', accent: '#ffd05a', bg: 'bg4', boss: 'Lord Dübel', bossKind: 3,
    enemies: [E.nokia, E.spiral, E.shield, E.sniper],
    bossReply: 'Guten Morgen, Rick! Natürlich grüße ich zurück. Ich bin doch kein Unmensch.',
    clear: 'FLAWLESS? Egal. Die Flasche gehört dir!',
    palette: ['#14050a', '#3a0f14', '#7a2214'],
  },
];

export const WEAPONS = {
  aqua: { id: 'aqua', name: 'Aqua-Laser', short: 'AQUA', color: '#6ff2ff', desc: 'Sauberer Strahl. Stufe 2+: Doppelschuss.' },
  spread: { id: 'spread', name: 'Sprudel-Streuer', short: 'FÄCHER', color: '#ffb14a', desc: 'Breiter Fächer. Stark im Nahbereich.' },
  beam: { id: 'beam', name: 'Wasserwerfer', short: 'WERFER', color: '#e8fffb', desc: 'Durchschlagender Dauerstrahl.' },
  homing: { id: 'homing', name: 'Seifenblasen', short: 'BLASEN', color: '#ff8af0', desc: 'Sucht sich sein Ziel selbst.' },
  orbit: { id: 'orbit', name: 'Kronkorken-Orbit', short: 'KORKEN', color: '#ffd84a', desc: 'Kreisende Schutzschilde, die Gegner rupfen.' },
};
export const WEAPON_ORDER = ['aqua', 'spread', 'beam', 'homing', 'orbit'];

export const POWERUPS = {
  weapon: { name: 'Waffe' },
  repair: { id: 'repair', name: 'Sportwasser', label: '+', color: '#79ffe0', cheer: 'Frisches Sportwasser +35 Schild' },
  bomb: { id: 'bomb', name: 'Wasserbombe', label: 'B', color: '#ffcd8b', cheer: 'Wasserbombe eingesackt' },
  shield: { id: 'shield', name: 'Schild-Blase', label: 'S', color: '#8fb4ff', cheer: 'Schild-Blase: 3 Treffer frei' },
  speed: { id: 'speed', name: 'Speed-Sprudel', label: '»', color: '#ffe36a', cheer: 'Speed-Sprudel: schneller fliegen' },
  slowmo: { id: 'slowmo', name: 'Zeitlupe', label: 'Z', color: '#6dff6d', cheer: 'BULLET TIME! Kein Löffel, nur Zeitlupe' },
  magnet: { id: 'magnet', name: 'Magnet', label: 'M', color: '#ff7b7b', cheer: 'Magnet: Beute kommt zu dir' },
  carlton: { id: 'carlton', name: 'Carlton-Dance', label: '♪', color: '#ff5fd2', cheer: 'CARLTON-DANCE! Unverwundbar und stilvoll' },
  life: { id: 'life', name: '1-UP-Flasche', label: '1', color: '#ffffff', cheer: '1-UP! Eine frische Flasche' },
};
export const DROP_TABLE = [
  ['weapon', 42], ['repair', 15], ['bomb', 10], ['shield', 10], ['speed', 7], ['slowmo', 6], ['magnet', 4], ['carlton', 4], ['life', 2],
];

export const DIFFICULTIES = {
  easy: { lives: 5, damage: 17, speed: 0.78, interval: 1.7, bossHp: 0.78, bombs: 3 },
  normal: { lives: 3, damage: 25, speed: 1, interval: 1.35, bossHp: 1, bombs: 2 },
  hard: { lives: 3, damage: 34, speed: 1.24, interval: 1.1, bossHp: 1.22, bombs: 2 },
};

export const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

// Fake-Stream-Chat, der das Geschehen kommentiert. Namen sind frei erfunden.
export const CHAT_USERS = [
  ['darth_rick', '#3dff9a', true], ['Turbo_Toni', '#ffb24a'], ['xX_Lara_Xx', '#ff7bd5'], ['BravoHits42', '#62c8ff'],
  ['Tamago_Tina', '#b9a2ff'], ['C64_Kalle', '#ffe36a'], ['Wetten_Wolf', '#7dffb4'], ['ICQ_Ingrid', '#ff9a8a'],
];
export const CHAT_LINES = {
  start: ['Es geht los, Leute!', 'Kamera läuft, Flasche fehlt.', 'Boah ey, Nemesis rastet aus!', 'Holt Popcorn, der Stream brennt'],
  kill: ['Hammer!', 'Geil, der fliegt wie Schumi', 'Alarm für Cobra 11!', 'Treffer versenkt!', 'Ey, das war Pixelkunst', 'Nice.'],
  multi: ['COMBO! Wie bei Mortal Kombat', 'Rumms, gleich mehrere!', 'Gamer-Gott!'],
  hit: ['Autsch!', 'Der Bildschirm wackelt ja!', 'Tamagotchi tot, Nemesis fast auch', 'Schild halten, nicht zielen!'],
  pickup: ['Loot!', 'Item-Drop! Ohne Flaschenpfand.', 'Das Upgrade war überfällig', 'Endlich mal was Nützliches'],
  weapon: ['Neue Wumme, neues Glück', 'Stufe hoch! Level up!', 'Sprudel ohne Kohlensäure, aber tödlich'],
  bomb: ['Wasserbombe! Alle nass!', 'Kaboom, Hubschrauber-Rettungsdienst', 'Mach die Bude sauber'],
  boss: ['BOSS! Jetzt wird\'s ernst', 'Schaut euch den Kerl an!', 'Finish him! …bald', 'Da kommt der Hauptgegner'],
  life: ['Noch ein Leben, Continue verdient', 'Nicht aufgeben! Das Game ist fair', 'Sterben gehört zum Bravo-Hits-Format'],
  clear: ['GG!', 'Sektor durch! Wie Wetten, dass..? nur ohne Couch', 'Level geschafft, Flasche noch nicht'],
  idle: ['Mach den Nokia leiser', 'Dial-up ist heute wieder schnell', 'Wer hat die Flasche gesehen?', 'Boah ey, Flasche wech', 'Early Adopter hier!', 'Pogge mal jemand den Mod'],
};

// Intro-Dialog (8-Bit-Cutscene). Jede Zeile: Sprecher, Text. `who`: nem, k1, k2, k3, narr
export const INTRO_LINES = [
  { scene: 0, who: 'narr', text: 'DONNERSTAGVORMITTAG, 10:47 UHR. STREAM-ZEIT IST MO BIS SA VON 9:30 BIS 14:00. 8 VIEWER SIND DA. ALLE MIT ANSPRUCH.' },
  { scene: 0, who: 'nem', text: 'So Leute, kurzer Schluck, dann geht es weiter …' },
  { scene: 0, who: 'nem', text: 'Hä? …Wo ist meine FLASCHE?!' },
  { scene: 1, who: 'narr', text: 'PIEEEP … KSCHHHH … DING-DONG! VERBINDUNG HERGESTELLT.' },
  { scene: 1, who: 'k1', text: 'Jo, Nemesis! Schön, dass du so früh live bist. Wir schalten uns kurz zu.' },
  { scene: 1, who: 'k2', text: 'Wir sind die intergalaktischen Killer Kiffer. Und wir haben deine Flasche.' },
  { scene: 1, who: 'k3', text: '*gluck gluck* Die ist… sehr erfrischend. Danke dafür!' },
  { scene: 2, who: 'nem', text: 'Ihr … ihr HALODRIS!' },
  { scene: 2, who: 'nem', text: 'Ich hol mir die Flasche zurück. Und zwar mit ZINSEN!' },
  { scene: 2, who: 'k1', text: 'Hihi. Viel Glück, Kleiner. Ciao Kakao!' },
];

export const GAMEOVER_LINES = [
  'Nicht ohne Flaschenpfand.',
  'Die Killer Kiffer lachen. Wieder mal.',
  'Dein Tamagotchi ist gestorben. Und du auch.',
  'Bitte Münze nachwerfen. Oder Flasche.',
];
