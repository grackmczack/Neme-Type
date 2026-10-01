// 8-Bit-Intro: Nemesis am Stream, die Flasche verschwindet, die Killer Kiffer schalten sich zu, „Halodris!", Titel-Slam.
import { W, H, TAU, clamp, INTRO_LINES } from './content.js';
import { getPixelImage, images } from './sprites.js';

const SPEAKERS = {
  narr: { name: 'ERZÄHLER', color: '#ffe36a', pitch: 330 },
  nem: { name: 'NEMESIS316', color: '#62e8ff', pitch: 170 },
  k1: { name: 'KIFFER KEV', color: '#7dff9a', pitch: 560 },
  k2: { name: 'KIFFER KALLE', color: '#ff9aa8', pitch: 480 },
  k3: { name: 'KIFFER KAI', color: '#c9a2ff', pitch: 620 },
};

const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const FONT_PX = '"Press Start 2P", "Courier New", monospace';
const FONT_BUBBLE = '"Titan One", "Arial Black", sans-serif';

/** Gemeinsamer Rechteck-Helper: Einheiten (x,y,w,h) mal Pixelgröße u. */
function rect(c, cx, cy, u) {
  return (x, y, w, h, color) => {
    c.fillStyle = color;
    const x0 = Math.round(cx + x * u);
    const y0 = Math.round(cy + y * u);
    c.fillRect(x0, y0, Math.max(1, Math.round(cx + (x + w) * u) - x0), Math.max(1, Math.round(cy + (y + h) * u) - y0));
  };
}

/** Pixel-Karikatur von Nemesis (Headset, Mikro, Ziegenbart, graues Shirt). top = Oberkante der Haare. */
export function drawNemesis(c, cx, top, u, mood = 'talk', t = 0, look = 0) {
  const R = rect(c, cx, top, u);
  const angry = mood === 'angry';
  const skin = angry ? '#f0775a' : '#e3b48e';
  const skinShade = angry ? '#c9523f' : '#c99a78';
  // Gaming-Stuhl und Oberkörper
  R(-19, 12, 6, 50, '#191425'); R(13, 12, 6, 50, '#191425');
  R(-17, 28, 34, 40, '#6d6d78'); R(-17, 28, 34, 3, '#8b8b97'); R(-17, 31, 4, 37, '#5a5a66'); R(13, 31, 4, 37, '#5a5a66');
  R(-6, 27, 12, 3, '#ffffff'); R(-5, 30, 10, 2, '#44444e');
  R(-4, 23, 8, 5, skinShade);
  // Kopf
  R(-9, 5, 18, 20, skin); R(-10, 8, 1, 13, skin); R(9, 8, 1, 13, skin);
  R(-8, 23, 16, 2, skinShade);
  // Haare
  R(-11, 3, 22, 6, '#2b1d17'); R(-9, 1, 18, 3, '#2b1d17'); R(-6, 0, 12, 2, '#3a271e'); R(-11, 8, 3, 7, '#2b1d17'); R(8, 8, 3, 7, '#2b1d17');
  R(-8, 8, 16, 2, '#2b1d17'); R(-7, 10, 4, 1, '#2b1d17'); R(3, 10, 4, 1, '#2b1d17');
  // Headset
  R(-12, 2, 24, 2, '#8a8a99'); R(-13, 4, 2, 5, '#8a8a99'); R(11, 4, 2, 5, '#8a8a99');
  R(-14, 9, 4, 8, '#3b3b47'); R(-13, 10, 2, 6, '#5d5d6c'); R(10, 9, 4, 8, '#3b3b47'); R(11, 10, 2, 6, '#5d5d6c');
  // Augen
  const surprised = mood === 'surprised';
  const ey = 12;
  if (surprised) {
    R(-7, ey - 1, 5, 5, '#ffffff'); R(2, ey - 1, 5, 5, '#ffffff');
    R(-5 + look, ey + 1, 2, 2, '#221016'); R(4 + look, ey + 1, 2, 2, '#221016');
    R(-8, ey - 4, 6, 1, '#2b1d17'); R(2, ey - 4, 6, 1, '#2b1d17');
  } else if (angry) {
    R(-7, ey, 5, 3, '#ffffff'); R(2, ey, 5, 3, '#ffffff');
    R(-5, ey + 1, 2, 2, '#ff2a2a'); R(4, ey + 1, 2, 2, '#ff2a2a');
    R(-8, ey - 3, 3, 1, '#1b1210'); R(-6, ey - 2, 3, 1, '#1b1210'); R(-4, ey - 1, 2, 1, '#1b1210');
    R(5, ey - 3, 3, 1, '#1b1210'); R(3, ey - 2, 3, 1, '#1b1210'); R(2, ey - 1, 2, 1, '#1b1210');
    R(-1, 7, 1, 2, '#b3261e'); R(1, 7, 1, 3, '#b3261e'); R(-2, 8, 4, 1, '#b3261e');
  } else {
    R(-7, ey, 5, 3, '#ffffff'); R(2, ey, 5, 3, '#ffffff');
    R(-5 + look, ey + 1, 2, 2, '#221016'); R(4 + look, ey + 1, 2, 2, '#221016');
    R(-7, ey - 2, 5, 1, '#2b1d17'); R(2, ey - 2, 5, 1, '#2b1d17');
  }
  R(-1, 14, 2, 4, skinShade);
  // Bart und Mund
  R(-7, 18, 14, 2, '#3a271e'); R(-5, 22, 10, 3, '#3a271e'); R(-3, 25, 6, 1, '#3a271e');
  const open = angry ? 4 : surprised ? 3 : (Math.sin(t * 14) > 0.15 ? 2 : 1);
  if (mood !== 'silent') {
    R(-3, 20, 6, open, '#4d1720');
    if (angry) R(-3, 20, 6, 1, '#ffffff');
  }
  // Mikro (Galgen + Kapsel)
  R(10, 12, 1, 15, '#15131c'); R(3, 27, 8, 1, '#15131c'); R(-2, 26, 6, 6, '#15131c'); R(-1, 27, 4, 4, '#2b2936'); R(0, 28, 1, 1, '#6d6b7c');
}

// Gesichtspunkte im 8-Bit-Sprite (assets/gen/nemesis8.webp, 335x667) und Armgelenk für die Greif-Geste.
const FACE = { eyeL: [135, 121], eyeR: [193, 121], mouth: [163, 176], elbow: [38, 300] };
const spriteCache = new Map();

function layer(key, build) {
  let item = spriteCache.get(key);
  if (!item) { item = build(); spriteCache.set(key, item); }
  return item;
}

/** Körper ohne linken Unterarm (der Arm wird für die Greif-Geste separat gedreht). */
function bodyWithoutArm() {
  const body = images.nemesis8;
  const arm = images['nemesis8-arm'];
  if (!body || !arm) return body;
  return layer('noarm', () => {
    const cv = document.createElement('canvas');
    cv.width = body.width; cv.height = body.height;
    const g = cv.getContext('2d');
    g.drawImage(body, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    g.drawImage(arm, 0, 0);
    return cv;
  });
}

function tinted(img, key, color) {
  return layer(key, () => {
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = color;
    g.fillRect(0, 0, cv.width, cv.height);
    return cv;
  });
}

/**
 * Zeichnet die 8-Bit-Version von Nemesis. height = Höhe des ganzen Sprites, crop = sichtbarer Anteil von oben,
 * armAngle (Radiant, optional) dreht den linken Unterarm um den Ellbogen. Gibt false zurück, wenn das Bild fehlt.
 */
export function drawNemesisSprite(c, cx, top, height, { mood = 'silent', t = 0, crop = 1, armAngle = null, look = 0 } = {}) {
  const img = images.nemesis8;
  if (!img) return false;
  const k = height / img.height;
  const w = img.width * k;
  const x0 = cx - w / 2;
  const P = ([sx, sy]) => [x0 + sx * k, top + sy * k];
  const split = armAngle !== null && images['nemesis8-arm'];
  let body = split ? bodyWithoutArm() : img;
  if (mood === 'angry') body = tinted(body, split ? 'angry-noarm' : 'angry', 'rgba(255,40,30,0.38)');
  const visible = img.height * crop;
  c.drawImage(body, 0, 0, img.width, visible, x0, top, w, visible * k);
  if (split) {
    const [ex, ey] = P(FACE.elbow);
    c.save();
    c.translate(ex, ey);
    c.rotate(armAngle);
    c.drawImage(images['nemesis8-arm'], -FACE.elbow[0] * k, -FACE.elbow[1] * k, w, height);
    c.restore();
  }
  // Gesichtsausdruck als Overlay
  const R = (sx, sy, sw, sh, color) => { const [x, y] = P([sx, sy]); c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(sw * k)), Math.max(1, Math.round(sh * k))); };
  const [lx, ly] = FACE.eyeL;
  const [rx, ry] = FACE.eyeR;
  const [mx, my] = FACE.mouth;
  if (mood === 'surprised') {
    R(lx - 14, ly - 10, 28, 20, '#ffffff'); R(rx - 14, ry - 10, 28, 20, '#ffffff');
    R(lx - 4 + look * 3, ly - 4, 9, 9, '#1b1210'); R(rx - 4 + look * 3, ry - 4, 9, 9, '#1b1210');
    R(lx - 16, ly - 24, 30, 6, '#3a271e'); R(rx - 14, ry - 24, 30, 6, '#3a271e');
    R(mx - 11, my - 3, 22, 20, '#4d1720');
  } else if (mood === 'angry') {
    R(lx - 13, ly - 5, 26, 12, '#ffffff'); R(rx - 13, ry - 5, 26, 12, '#ffffff');
    R(lx - 6, ly - 4, 12, 10, '#ff2a2a'); R(rx - 6, ry - 4, 12, 10, '#ff2a2a');
    c.strokeStyle = '#1b1210'; c.lineWidth = Math.max(3, 10 * k); c.lineCap = 'butt';
    const brow = (a, b) => { const [x1, y1] = P(a); const [x2, y2] = P(b); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
    brow([lx - 22, ly - 20], [lx + 16, ly - 5]); brow([rx + 22, ry - 20], [rx - 16, ry - 5]);
    R(mx - 20, my - 4, 40, 24, '#4d1720'); R(mx - 20, my - 4, 40, 6, '#ffffff');
  } else if (mood === 'talk') {
    const open = Math.sin(t * 14) > 0.15;
    R(mx - 12, my - 1, 24, open ? 11 : 3, '#4d1720');
  }
  return true;
}

function drawBottlePx(c, x, y, u, tilt = 0) {
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  const R = rect(c, 0, 0, u);
  // Deckel, Haltebändchen
  R(-3, 0, 6, 3, '#cfd5df'); R(-3, 0, 6, 1, '#f2f5fa'); R(-2, 3, 4, 1, '#7f8aa0');
  R(3, 1, 4, 1, '#1b1b24'); R(6, 1, 1, 4, '#1b1b24'); R(3, 4, 4, 1, '#1b1b24');
  // Körper mit Rippen
  R(-6, 4, 12, 21, '#bfeff4'); R(-6, 4, 2, 21, '#f0ffff'); R(4, 4, 2, 21, '#6fb6c4');
  R(-7, 6, 1, 17, '#27425e'); R(6, 6, 1, 17, '#27425e'); R(-5, 4, 10, 1, '#27425e'); R(-5, 25, 10, 1, '#27425e');
  R(-6, 8, 12, 1, '#8fcad6'); R(-6, 21, 12, 1, '#8fcad6');
  // Griff-Fenster rechts
  R(2, 11, 3, 9, '#27425e');
  // 316-Etikett
  R(-5, 12, 7, 6, '#1fc6c8'); R(-4, 13, 1, 4, '#ffffff'); R(-2, 13, 1, 4, '#ffffff'); R(0, 13, 1, 4, '#ffffff');
  c.restore();
}

function drawKiffer(c, cx, cy, u, kind, t, talking, drink = 0) {
  const R = rect(c, cx, cy, u);
  const mouth = talking && Math.sin(t * 16) > 0 ? 3 : 1;
  if (kind === 0) { // Kev: grüner Alien, rote Augen, Bandana, Joint
    R(-12, 18, 24, 12, '#2b5d8a'); R(-12, 18, 24, 2, '#3c7cb0');
    R(-9, 2, 18, 18, '#6fe06f'); R(-9, 2, 18, 2, '#9bff9b'); R(6, 4, 3, 16, '#4ab04a');
    R(-10, 0, 20, 4, '#ff3a8a'); R(-10, 4, 20, 1, '#b3205f'); R(9, 3, 4, 3, '#ff3a8a'); R(11, 6, 3, 2, '#ff3a8a');
    R(-7, 8, 5, 3, '#ffffff'); R(2, 8, 5, 3, '#ffffff'); R(-7, 8, 5, 1, '#3a8a3a'); R(2, 8, 5, 1, '#3a8a3a');
    R(-5, 9, 2, 2, '#e02020'); R(4, 9, 2, 2, '#e02020');
    R(-4, 15, 8, mouth, '#2a1020'); R(-2, 14, 1, 1, '#2a1020');
    R(-1, 16, 11, 1, '#f6ecd0'); R(9, 15, 2, 2, '#ff8a2a'); // Joint
    for (let i = 0; i < 4; i++) { c.fillStyle = `rgba(230,230,240,${0.6 - i * 0.14})`; c.fillRect(Math.round(cx + (11 + Math.sin(t * 2 + i) * 2) * u), Math.round(cy + (12 - i * 5 - (t * 6) % 5) * u), u * 3, u * 3); }
  } else if (kind === 1) { // Kalle: blau-grau, dicke Sonnenbrille, Buckethat, Handy
    R(-12, 18, 24, 12, '#8a3a2a'); R(-12, 18, 24, 2, '#b0583c');
    R(-9, 3, 18, 17, '#8fb0d8'); R(-9, 3, 18, 2, '#b8d0f0'); R(6, 5, 3, 15, '#6a8ab8');
    R(-13, 2, 26, 3, '#ffb24a'); R(-9, -4, 18, 7, '#ffc866'); R(-9, -1, 18, 1, '#c07a1c');
    R(-9, 8, 8, 6, '#111118'); R(1, 8, 8, 6, '#111118'); R(-1, 9, 2, 1, '#111118'); R(-8, 9, 2, 1, '#6a6a88'); R(2, 9, 2, 1, '#6a6a88');
    R(-4, 16, 8, mouth, '#2a1020'); R(-7, 15, 14, 1, '#3a2a4a');
    R(10, 22, 5, 8, '#2a3a2a'); R(11, 23, 3, 3, '#9ae09a'); // Nokia-Handy
  } else { // Kai: lila Alien, Krone aus Kronkorken, hält die Flasche
    R(-12, 18, 24, 12, '#3a8a4a'); R(-12, 18, 24, 2, '#58b868');
    R(-9, 3, 18, 17, '#b08aff'); R(-9, 3, 18, 2, '#d0b8ff'); R(6, 5, 3, 15, '#8a62d8');
    R(-8, -2, 3, 5, '#ffd84a'); R(-3, -4, 3, 7, '#ffd84a'); R(2, -2, 3, 5, '#ffd84a'); R(-8, 2, 13, 2, '#c08a10');
    R(-7, 8, 5, 4, '#ffffff'); R(2, 8, 5, 4, '#ffffff'); R(-5, 9, 2, 2, '#231036'); R(4, 9, 2, 2, '#231036');
    R(-4, 15, 8, drink ? 1 : mouth, '#2a1020');
    R(-6, 13, 3, 2, '#ff8ac0'); R(3, 13, 3, 2, '#ff8ac0');
  }
}

export class Intro {
  constructor(chip) {
    this.chip = chip;
    this.reset();
  }

  reset() {
    this.i = 0;
    this.t = 0;
    this.typed = 0;
    this.hold = 0;
    this.lineT = 0;
    this.sceneT = 0;
    this.phase = 'lines';
    this.outroT = 0;
    this.done = false;
    this.abductAt = -1;
    this.flash = 0;
    this.shake = 0;
    this.slam = -1;
    this._lastBlip = 0;
    this._seed = Array.from({ length: 70 }, () => [Math.random(), Math.random(), Math.random()]);
  }

  get line() { return INTRO_LINES[this.i]; }
  get scene() { return this.phase === 'outro' ? 3 : this.line.scene; }

  start() {
    this.reset();
    this.chip?.setTrack('title');
  }

  skip() {
    if (this.done) return;
    this.done = true;
  }

  advance() {
    if (this.done) return;
    if (this.phase === 'outro') { if (this.outroT > 1.2) this.done = true; return; }
    if (this.typed < this.line.text.length) this.typed = this.line.text.length;
    else this._next();
  }

  _next() {
    const prevScene = this.line.scene;
    this.i++;
    this.typed = 0;
    this.hold = 0;
    this.lineT = 0;
    if (this.i >= INTRO_LINES.length) {
      this.phase = 'outro';
      this.outroT = 0;
      this.chip?.sfx('slam');
      return;
    }
    if (this.line.scene !== prevScene) {
      this.sceneT = 0;
      this.flash = 0.6;
      if (this.line.scene === 1) this.chip?.modem();
    }
    if (this.line.scene === 2 && this.line.who === 'nem' && this.i === INTRO_LINES.findIndex((l) => l.scene === 2)) {
      this.slam = 0;
      this.shake = 1;
      this.chip?.sfx('slam');
    }
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 2.4);
    this.shake = Math.max(0, this.shake - dt * 1.4);
    if (this.slam >= 0) this.slam += dt;
    if (this.phase === 'outro') {
      this.outroT += dt;
      if (this.outroT > 3.4) this.done = true;
      return;
    }
    this.sceneT += dt;
    this.lineT += dt;
    const line = this.line;
    const len = line.text.length;
    if (this.typed < len) {
      const before = Math.floor(this.typed);
      this.typed = Math.min(len, this.typed + (line.who === 'narr' ? 36 : 28) * dt);
      const after = Math.floor(this.typed);
      if (after > before && after % 2 === 0 && line.text[after - 1] !== ' ') this.chip?.tone(SPEAKERS[line.who].pitch * (1 + (after % 3) * 0.06), 0.05, 'square', 0.05);
    } else {
      this.hold += dt;
      if (this.hold > 1.45) this._next();
    }
    // Szenen-Ereignisse
    if (line.scene === 0 && this.i === 1 && this.lineT > 1.3 && this.abductAt < 0) {
      this.abductAt = this.t;
      this.chip?.tone(300, 1.1, 'sine', 0.12, 900);
      this.chip?.tone(900, 0.9, 'triangle', 0.06, -500, 0.3);
    }
    if (line.scene === 0 && this.i === 2 && this.lineT < 0.05) { this.shake = 0.5; this.chip?.sfx('warn'); }
  }

  /* ---------------- Rendering ---------------- */

  render(c, reduceMotion = false) {
    c.save();
    c.imageSmoothingEnabled = false;
    if (this.shake > 0 && !reduceMotion) c.translate(Math.round((Math.random() - 0.5) * 14 * this.shake), Math.round((Math.random() - 0.5) * 10 * this.shake));
    if (this.phase === 'outro') this._outro(c);
    else if (this.line.scene === 0) this._scene0(c);
    else if (this.line.scene === 1) this._scene1(c);
    else this._scene2(c);
    c.restore();
    if (this.phase !== 'outro') {
      this._textbox(c);
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.font = `8px ${FONT_PX}`;
      c.textAlign = 'right';
      c.fillText('ENTER: WEITER   ESC: ÜBERSPRINGEN', W - 16, 24);
      c.textAlign = 'left';
    }
    if (this.flash > 0) {
      c.fillStyle = `rgba(255,255,255,${this.flash * 0.9})`;
      c.fillRect(0, 0, W, H);
    }
  }

  _nebula(c, dim = 0.55) {
    const bg = getPixelImage('bg1', 150, 960);
    if (bg) {
      c.drawImage(bg, -Math.round(((this.t * 6) % 40)), 0, bg.width * 1.05, H);
    } else {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#180a33'); g.addColorStop(1, '#4a1c62');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    c.fillStyle = `rgba(8,4,24,${dim})`;
    c.fillRect(0, 0, W, H);
    this._seed.forEach(([x, y, s]) => {
      c.fillStyle = `rgba(255,255,255,${0.35 + Math.sin(this.t * 2 + s * 9) * 0.3})`;
      c.fillRect(Math.round(x * W / 4) * 4, Math.round(y * 340 / 4) * 4, 4, 4);
    });
  }

  _scene0(c) {
    const t = this.t;
    this._nebula(c, 0.5);
    c.save();
    c.translate(0, -40);
    // Schreibtisch
    c.fillStyle = '#4a2d22'; c.fillRect(0, 404, W, H);
    c.fillStyle = '#7a4d38'; c.fillRect(0, 396, W, 10);
    c.fillStyle = '#2f1c16'; c.fillRect(0, 406, W, 6);
    // Stream-Monitor rechts mit Chat
    c.fillStyle = '#0e0a1e'; c.fillRect(552, 70, 352, 300);
    c.strokeStyle = '#29d6e0'; c.lineWidth = 6; c.strokeRect(555, 73, 346, 294);
    c.fillStyle = '#0a2a3a'; c.fillRect(562, 82, 332, 58);
    c.font = `34px ${FONT_BUBBLE}`; c.textAlign = 'center';
    c.lineJoin = 'round'; c.lineWidth = 8; c.strokeStyle = '#0a1a4a'; c.strokeText('Just Chatting', 728, 124);
    const grad = c.createLinearGradient(0, 92, 0, 128); grad.addColorStop(0, '#6af0ff'); grad.addColorStop(1, '#1a7bff');
    c.fillStyle = grad; c.fillText('Just Chatting', 728, 124);
    c.textAlign = 'left';
    // Abo-Ziel
    c.fillStyle = '#ffffff'; c.fillRect(562, 148, 332, 24);
    c.fillStyle = '#21bfc9'; c.fillRect(562, 148, 200 + Math.sin(t) * 6, 24);
    c.fillStyle = '#0a1a2a'; c.font = `8px ${FONT_PX}`; c.fillText('ABO-ZIEL  72/120', 570, 165);
    // Chat
    const names = ['#3dff9a', '#ffb24a', '#ff7bd5', '#62c8ff', '#b9a2ff'];
    for (let k = 0; k < 9; k++) {
      const row = k + (t * 0.9) % 1;
      const y = 352 - row * 22;
      if (y < 184 || y > 354) continue;
      const seed = (Math.floor(t * 0.9) - k + 100) % 13;
      c.fillStyle = names[(seed + 40) % 5]; c.fillRect(568, Math.round(y), 40 + (seed % 4) * 8, 8);
      c.fillStyle = '#d8d6e8'; c.fillRect(620 + (seed % 4) * 8, Math.round(y), 60 + (seed * 17) % 140, 8);
    }
    const panda = getPixelImage('panda', 44, 132);
    if (panda) c.drawImage(panda, 782, 252 + Math.sin(t * 2) * 3);
    // Flasche + Entführung
    const lift = this.abductAt < 0 ? 0 : ease((t - this.abductAt) / 1.3);
    const bx = 160;
    const by = 298 - lift * 262;
    const ufoX = this.abductAt < 0 ? -200 : bx;
    if (this.abductAt >= 0) {
      const a = (t - this.abductAt);
      const ufoY = 84;
      const ux = a > 2.3 ? bx + (a - 2.3) * (a - 2.3) * 900 : bx;
      if (a < 1.6) {
        c.fillStyle = `rgba(180,255,190,${0.22 + Math.sin(t * 40) * 0.06})`;
        c.beginPath(); c.moveTo(ux - 16, ufoY + 18); c.lineTo(ux + 16, ufoY + 18); c.lineTo(ux + 70, 402); c.lineTo(ux - 70, 402); c.closePath(); c.fill();
      }
      const R = rect(c, ux, ufoY, 4);
      R(-6, -4, 12, 4, '#8fe8ff'); R(-5, -6, 10, 2, '#c8f6ff'); R(-14, 0, 28, 4, '#9aa6c0'); R(-10, 4, 20, 2, '#5a6688');
      for (let i = -3; i <= 3; i++) R(i * 4 - 1, 1, 2, 2, (Math.floor(t * 8) + i) % 2 ? '#ffe36a' : '#ff4b5c');
    }
    if (lift < 0.97) drawBottlePx(c, bx, by, 4, Math.sin(t * 9) * lift * 0.18);
    // Nemesis
    const cx = 330;
    const surprised = this.i >= 2 && this.line.scene === 0;
    const talking = this.line.who === 'nem' && this.typed < this.line.text.length;
    const mood = surprised ? 'surprised' : talking ? 'talk' : 'silent';
    const reach = this.i >= 1 ? ease((this.i === 1 ? this.lineT - 0.4 : 9) / 1.3) : 0;
    const hop = surprised ? Math.max(0, 1 - this.lineT * 5) * 14 : 0;
    c.save();
    c.beginPath();
    c.rect(0, 0, W, 402); // der Schreibtisch verdeckt den Rest
    c.clip();
    // Unterarm: von hängend (Hand in der Tasche) bis waagerecht zur Flasche; danach greift er zitternd ins Leere
    const armAngle = 0.1 + reach * 1.9 + (this.i >= 2 ? Math.sin(t * 38) * 0.04 : 0);
    const drawn = drawNemesisSprite(c, cx, 150 - hop, 440, { mood, t, armAngle: reach > 0 ? armAngle : null, look: this.i === 1 ? -1 : 0 });
    c.restore();
    if (!drawn) {
      // Ausweichlösung ohne Bild: Code-Figur wie bisher
      drawNemesis(c, cx, 168, 4, talking || surprised ? mood : 'silent', t, this.i === 1 ? -1 : 0);
      if (this.i >= 1) {
        const sx = cx - 15 * 4;
        const sy = 168 + 34 * 4;
        const hx = sx + (bx - sx) * reach;
        const hy = sy + (372 - sy) * reach;
        c.strokeStyle = '#6d6d78'; c.lineCap = 'round'; c.lineWidth = 26;
        c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx + 18, hy - 12); c.stroke();
        c.fillStyle = '#e3b48e'; c.fillRect(Math.round(hx - 14), Math.round(hy - 16), 28, 32);
      }
    }
    // Fragezeichen-Blase
    if (this.i >= 2) {
      const pop = ease(this.lineT / 0.25);
      c.save();
      c.translate(440, 172);
      c.scale(pop, pop);
      c.fillStyle = '#ffffff'; c.fillRect(-46, -32, 92, 60); c.fillRect(-30, 28, 12, 12);
      c.strokeStyle = '#160d2e'; c.lineWidth = 4; c.strokeRect(-46, -32, 92, 60);
      c.fillStyle = '#ff2f4f'; c.font = `34px ${FONT_PX}`; c.textAlign = 'center'; c.fillText('?!', 0, 14);
      c.restore();
    }
    c.textAlign = 'left';
    c.restore();
    this._clock(c);
    this._titleTag(c, 'LIVE · JUST CHATTING · MO-SA 9:30-14:00');
  }

  /** Digitaluhr an der Wand: Vormittag, der Stream läuft. */
  _clock(c) {
    const colon = Math.floor(this.t * 2) % 2 === 0 ? ':' : ' ';
    c.fillStyle = '#0a0630'; c.fillRect(392, 44, 140, 52);
    c.strokeStyle = '#27d3da'; c.lineWidth = 3; c.strokeRect(393.5, 45.5, 137, 49);
    c.fillStyle = '#ff4b5c'; c.font = `24px ${FONT_PX}`; c.textAlign = 'left';
    c.fillText(`10${colon}47`, 404, 86);
    c.fillStyle = '#9fb4ff'; c.font = `6px ${FONT_PX}`;
    c.fillText('DONNERSTAG', 404, 57);
  }

  _titleTag(c, text) {
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(16, 12, text.length * 9 + 30, 24);
    c.fillStyle = '#ff2f4f'; c.fillRect(24, 20, 8, 8);
    c.fillStyle = '#fff'; c.font = `8px ${FONT_PX}`; c.fillText(text, 40, 28);
  }

  _window(c, x, y, w, h, title, active, inner) {
    c.fillStyle = '#c0c0c0'; c.fillRect(x, y, w, h);
    c.fillStyle = '#ffffff'; c.fillRect(x, y, w, 3); c.fillRect(x, y, 3, h);
    c.fillStyle = '#6a6a6a'; c.fillRect(x, y + h - 3, w, 3); c.fillRect(x + w - 3, y, 3, h);
    c.fillStyle = '#000'; c.fillRect(x + w - 1, y, 1, h); c.fillRect(x, y + h - 1, w, 1);
    const g = c.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, active ? '#0a0a8a' : '#6a6a78'); g.addColorStop(1, active ? '#1a8ad8' : '#9a9aa8');
    c.fillStyle = g; c.fillRect(x + 5, y + 5, w - 10, 20);
    c.fillStyle = '#fff'; c.font = `8px ${FONT_PX}`; c.fillText(title, x + 12, y + 19);
    c.fillStyle = '#c0c0c0'; c.fillRect(x + w - 26, y + 8, 16, 14); c.fillStyle = '#000'; c.fillRect(x + w - 22, y + 11, 8, 8);
    c.fillStyle = '#ffffff'; c.fillRect(x + w - 20, y + 13, 4, 4);
    c.save();
    c.beginPath(); c.rect(x + 6, y + 28, w - 12, h - 34); c.clip();
    inner(x + 6, y + 28, w - 12, h - 34);
    c.restore();
  }

  _scene1(c) {
    const t = this.t;
    c.fillStyle = '#05041a'; c.fillRect(0, 0, W, H);
    // Teal Win95-Desktop mit Rauschen
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b3d48'); g.addColorStop(1, '#14206a');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let k = 0; k < 80; k++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; c.fillRect(Math.random() * W, Math.random() * H, 40 + Math.random() * 80, 2); }
    const firstK = INTRO_LINES.findIndex((l) => l.who === 'k1');
    // Verbindungsdialog (nur solange der Erzähler spricht)
    if (this.i < firstK) {
      this._window(c, 250, 130, 460, 210, 'Verbindung wird hergestellt …', true, (x, y, w, h) => {
        c.fillStyle = '#c0c0c0'; c.fillRect(x, y, w, h);
        c.fillStyle = '#000'; c.font = `9px ${FONT_PX}`;
        c.fillText('Killer_Kiffer.exe ruft an …', x + 16, y + 34);
        c.fillText('56000 bps · V.90 · Handshake', x + 16, y + 62);
        c.fillStyle = '#fff'; c.fillRect(x + 16, y + 84, w - 32, 24);
        c.fillStyle = '#6a6a6a'; c.fillRect(x + 16, y + 84, w - 32, 2);
        const prog = clamp(this.sceneT / 3.2, 0, 1);
        for (let k = 0; k < Math.floor((w - 40) * prog / 14); k++) { c.fillStyle = '#000080'; c.fillRect(x + 20 + k * 14, y + 88, 10, 16); }
        c.fillStyle = '#000'; c.fillText(`${Math.floor(prog * 100)} %`, x + w / 2 - 16, y + 132);
        c.fillStyle = Math.floor(t * 4) % 2 ? '#ff2f4f' : '#801818'; c.fillRect(x + w - 40, y + 14, 14, 14);
      });
    }
    const who = this.line.who;
    const wins = [
      { kind: 0, key: 'k1', title: 'Kiffer_Kev - Webcam', x: 28, bg: '#3a1466' },
      { kind: 1, key: 'k2', title: 'Kiffer_Kalle - Webcam', x: 338, bg: '#1b5a2a' },
      { kind: 2, key: 'k3', title: 'Kiffer_Kai - Webcam', x: 648, bg: '#10204a' },
    ];
    wins.forEach((win, n) => {
      const appearIdx = INTRO_LINES.findIndex((l) => l.who === win.key);
      if (this.i < appearIdx) return;
      const born = appearIdx === this.i ? this.lineT : 9;
      const pop = ease(born / 0.22);
      const w = 284; const h = 268; const y = 76;
      c.save();
      c.translate(win.x + w / 2, y + h / 2);
      c.scale(pop, pop);
      c.translate(-(win.x + w / 2), -(y + h / 2));
      this._window(c, win.x, y, w, h, win.title, who === win.key, (x, yy, ww, hh) => {
        c.fillStyle = win.bg; c.fillRect(x, yy, ww, hh);
        for (let k = 0; k < 14; k++) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(x + ((k * 97 + 13) % ww), yy + ((k * 53 + 7) % (hh - 60)), 4, 4); }
        const talking = who === win.key && this.typed < this.line.text.length;
        const sway = Math.sin(t * 2 + n) * 3;
        const drinking = win.key === 'k3' && this.i === INTRO_LINES.findIndex((l) => l.who === 'k3') && this.lineT > 0.6;
        drawKiffer(c, x + ww / 2, yy + 62 + sway, 6, win.kind, t, talking, drinking);
        if (win.key === 'k3') {
          const bot = images.bottle ? getPixelImage('bottle', 40, 96) : null;
          const tilt = drinking ? -0.9 + Math.sin(t * 6) * 0.05 : -0.1;
          c.save();
          c.translate(x + ww - 42, yy + hh - 50 + (drinking ? -62 : 0));
          c.rotate(tilt);
          if (bot) c.drawImage(bot, -48, -48); else drawBottlePx(c, 0, -30, 4);
          c.restore();
          if (drinking) for (let k = 0; k < 3; k++) { c.fillStyle = '#c8faff'; c.fillRect(x + ww / 2 + 30 + k * 12, yy + 80 - ((t * 40 + k * 18) % 60), 6, 6); }
        }
        c.fillStyle = Math.floor(t * 2) % 2 ? '#ff2f4f' : '#8a1a2a'; c.fillRect(x + ww - 48, yy + 8, 8, 8);
        c.fillStyle = '#fff'; c.font = `7px ${FONT_PX}`; c.fillText('LIVE', x + ww - 36, yy + 16);
      });
      c.restore();
    });
    this._titleTag(c, 'EINGEHENDER ANRUF');
  }

  _scene2(c) {
    const t = this.t;
    // Wut-Sunburst
    c.fillStyle = '#3a0712'; c.fillRect(0, 0, W, H);
    const rays = 18;
    for (let k = 0; k < rays; k += 2) {
      const a0 = t * 0.6 + k * TAU / rays;
      c.fillStyle = Math.floor(t * 6) % 2 ? '#b3122f' : '#8a0f2a';
      c.beginPath(); c.moveTo(W / 2, 270); c.arc(W / 2, 270, 700, a0, a0 + TAU / rays); c.closePath(); c.fill();
    }
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 0, W, H);
    const idx0 = INTRO_LINES.findIndex((l) => l.scene === 2);
    if (!drawNemesisSprite(c, W / 2, 24 + Math.sin(t * 30) * 2, 1060, { mood: 'angry', t, crop: 0.44 })) drawNemesis(c, W / 2, 70, 10, 'angry', t);
    // Dampf aus den Ohren
    for (let s = 0; s < 6; s++) {
      const p = ((t * 0.8 + s / 6) % 1);
      c.fillStyle = `rgba(255,255,255,${0.7 * (1 - p)})`;
      const size = 14 + p * 34;
      c.fillRect(W / 2 - 160 - Math.sin(s + t) * 10 - size / 2, 250 - p * 200, size, size);
      c.fillRect(W / 2 + 160 + Math.sin(s + t) * 10 - size / 2, 250 - p * 200, size, size);
    }
    if (this.i === idx0 && this.slam >= 0) {
      const sc = 1 + Math.max(0, 1 - this.slam * 4) * 1.6;
      c.save();
      c.translate(W / 2 + (Math.random() - 0.5) * 6, 150 + (Math.random() - 0.5) * 6);
      c.scale(sc, sc);
      c.font = `104px ${FONT_BUBBLE}`; c.textAlign = 'center'; c.lineJoin = 'round';
      c.lineWidth = 18; c.strokeStyle = '#160d2e'; c.strokeText('HALODRIS!', 0, 0);
      const g = c.createLinearGradient(0, -80, 0, 10); g.addColorStop(0, '#fff6a0'); g.addColorStop(1, '#ff9a1c');
      c.fillStyle = g; c.fillText('HALODRIS!', 0, 0);
      c.restore();
      c.textAlign = 'left';
    }
    if (this.line.who === 'k1') {
      this._window(c, W - 250, 96, 226, 210, 'Kiffer_Kev - Webcam', true, (x, y, w, h) => {
        c.fillStyle = '#3a1466'; c.fillRect(x, y, w, h);
        drawKiffer(c, x + w / 2, y + 66 + Math.sin(t * 25) * 4, 5, 0, t, true);
      });
      c.fillStyle = '#ffe36a'; c.font = `16px ${FONT_PX}`; c.fillText('HAHAHA', W - 232, 340 + Math.sin(t * 14) * 4);
    }
    this._titleTag(c, 'NEMESIS316: ENTSPANNUNGSGRAD 0 %');
  }

  _outro(c) {
    const t = this.outroT;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    if (t < 0.55) {
      // CRT-Ausschalter
      const p = t / 0.55;
      const h = Math.max(3, H * (1 - ease(p)));
      c.fillStyle = '#fff';
      c.fillRect(0, H / 2 - h / 2, W, h);
      return;
    }
    const tt = t - 0.55;
    this._nebula(c, 0.25);
    const logo = images.logo;
    const pop = tt < 0.6 ? 3 - 2 * ease(tt / 0.6) + Math.sin(tt * 18) * Math.max(0, 0.22 - tt * 0.3) : 1;
    if (logo) {
      const w = 760 * pop;
      const h = w * logo.height / logo.width;
      c.drawImage(logo, W / 2 - w / 2, 250 - h / 2, w, h);
    } else {
      c.save();
      c.translate(W / 2, 240); c.scale(pop, pop);
      c.textAlign = 'center'; c.font = `70px ${FONT_BUBBLE}`; c.lineJoin = 'round'; c.lineWidth = 14;
      c.strokeStyle = '#0a1a4a'; c.strokeText('NEMESIS316', 0, -20); c.fillStyle = '#35d0ff'; c.fillText('NEMESIS316', 0, -20);
      c.font = `46px ${FONT_BUBBLE}`; c.strokeText('KILLER KIFFER', 0, 60); c.fillStyle = '#ff4fd0'; c.fillText('KILLER KIFFER', 0, 60);
      c.restore();
    }
    if (tt < 0.5) {
      c.strokeStyle = `rgba(255,255,255,${0.8 - tt * 1.6})`; c.lineWidth = 6;
      c.beginPath(); c.arc(W / 2, 250, tt * 900, 0, TAU); c.stroke();
    }
    if (tt > 1.0 && Math.floor(tt * 2.5) % 2 === 0) {
      c.fillStyle = '#ffe36a'; c.font = `18px ${FONT_PX}`; c.textAlign = 'center';
      c.fillText('PRESS START', W / 2, 470); c.textAlign = 'left';
    }
  }

  _textbox(c) {
    const line = this.line;
    const sp = SPEAKERS[line.who];
    const x = 40; const y = 392; const w = W - 80; const h = 122;
    c.fillStyle = 'rgba(10,6,48,0.94)'; c.fillRect(x, y, w, h);
    c.strokeStyle = '#ffffff'; c.lineWidth = 4; c.strokeRect(x + 2, y + 2, w - 4, h - 4);
    c.strokeStyle = sp.color; c.lineWidth = 3; c.strokeRect(x + 10, y + 10, w - 20, h - 20);
    c.fillStyle = sp.color; c.fillRect(x + 22, y - 14, sp.name.length * 13 + 22, 26);
    c.fillStyle = '#0a0630'; c.font = `11px ${FONT_PX}`; c.fillText(sp.name, x + 32, y + 4);
    c.fillStyle = line.who === 'narr' ? '#ffe9a0' : '#ffffff';
    c.font = `15px ${FONT_PX}`;
    // Zeilenumbruch auf dem vollen Text berechnen, damit Wörter beim Tippen nicht springen.
    let remaining = Math.floor(this.typed);
    let yy = y + 52;
    for (const row of wrapLines(c, line.text, w - 60)) {
      if (remaining <= 0) break;
      c.fillText(row.slice(0, remaining), x + 30, yy);
      remaining -= row.length + 1;
      yy += 26;
    }
    if (this.typed >= line.text.length && Math.floor(this.t * 3) % 2 === 0) {
      c.fillStyle = sp.color; c.fillText('▼', x + w - 44, y + h - 22);
    }
  }
}

function wrapLines(c, text, maxW) {
  const rows = [];
  let row = '';
  for (const word of text.split(' ')) {
    const test = row ? `${row} ${word}` : word;
    if (c.measureText(test).width > maxW && row) { rows.push(row); row = word; } else row = test;
  }
  if (row) rows.push(row);
  return rows;
}
