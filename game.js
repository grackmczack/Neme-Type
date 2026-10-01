// Engine-Kern: Zustandsautomat, Simulation, Eingaben. Darstellung: render.js, Inhalte: content.js.
import {
  W, H, TAU, clamp, random, pick, SECTORS, ENEMY_TYPES, WEAPONS, WEAPON_ORDER, POWERUPS, DROP_TABLE, DIFFICULTIES,
  KONAMI, CHAT_USERS, CHAT_LINES, GAMEOVER_LINES,
} from './content.js';
import { AI, FLOOR_Y, CEIL_Y, TERRAIN_SPEED, hitCircles, spawnFormation } from './enemies.js';
import { fire as fireWeapon, steer, chargedShot, orbitPositions } from './weapons.js';
import { BOSSES, bossHit } from './bosses.js';
import { Chip } from './audio.js';
import { Intro } from './intro.js';
import { loadImages } from './sprites.js';
import { renderGame } from './render.js';

export { SECTORS };

const KEY_ACTIONS = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'fire', KeyX: 'charge', ShiftLeft: 'charge', ShiftRight: 'charge',
  KeyE: 'force', KeyB: 'bomb', KeyQ: 'cycle', KeyP: 'pause', Escape: 'pause',
};

const MAX_BULLETS = 900;
const MAX_ENEMIES = 40;

const newLevels = () => ({ aqua: 1, spread: 0, beam: 0, homing: 0, orbit: 0 });

/** Das Spiel: eigenständiger Side-Scrolling-Shooter. Die Oberfläche (app.js) kümmert sich um Menüs und Scores. */
export class NemeGame {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.options = options;
    canvas.width = W;
    canvas.height = H;
    this.ctx.imageSmoothingEnabled = false;
    this._status = 'title';
    this._beforePause = 'playing';
    this._muted = true;
    this._destroyed = false;
    this._time = 0;
    this._lastFrame = 0;
    this._hudAt = 0;
    this._input = {};
    this._keyboard = new Map();
    this._pointer = null;
    this._uid = 0;
    this._konami = [];
    this.chip = new Chip();
    this.intro = new Intro(this.chip);
    this.stars = Array.from({ length: 130 }, () => ({ x: random(0, W), y: random(0, H), z: random(0.2, 1), flicker: random(0, TAU) }));
    this.highScore = 0;
    this.reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._reset('normal');
    this._keydown = (event) => this._handleKey(event, true);
    this._keyup = (event) => this._handleKey(event, false);
    this._blur = () => {
      this._input = {};
      this._keyboard.clear();
      this._pointer = null;
      this.pause();
    };
    this._pointerdown = (event) => {
      if (this._status === 'intro') { this.intro.advance(); return; }
      if (this._status !== 'playing') return;
      this.canvas.setPointerCapture?.(event.pointerId);
      this._setPointer(event);
    };
    this._pointermove = (event) => {
      if (this._pointer && this._pointer.id === event.pointerId) this._setPointer(event);
    };
    this._pointerup = (event) => {
      if (this._pointer?.id === event.pointerId) this._pointer = null;
    };
    window.addEventListener('keydown', this._keydown);
    window.addEventListener('keyup', this._keyup);
    window.addEventListener('blur', this._blur);
    canvas.addEventListener('pointerdown', this._pointerdown);
    canvas.addEventListener('pointermove', this._pointermove);
    canvas.addEventListener('pointerup', this._pointerup);
    canvas.addEventListener('pointercancel', this._pointerup);
    this._frame = this._frame.bind(this);
    this._raf = requestAnimationFrame(this._frame);
    this._emitHud(true);
  }

  get status() { return this._status; }
  get stageColor() { return SECTORS[this.stage].color; }
  get state() {
    const p = this.player;
    return {
      score: this.score, lives: p.lives, shield: Math.ceil(p.hp), charge: p.charge,
      weapon: WEAPONS[p.weapon].name, weaponId: p.weapon, levels: { ...p.levels }, shieldHits: p.shield,
      stage: this.stage + 1, stageName: SECTORS[this.stage].name,
      progress: this.boss ? 1 : clamp(this.stageTime / SECTORS[this.stage].duration, 0, 1),
      status: this._status, bombs: p.bombs, forceAttached: p.forceAttached,
      bossName: this.boss?.name ?? null, bossHp: this.boss ? this.boss.hp / this.boss.maxHp : null,
      time: this.elapsed, cheat: this.cheat,
    };
  }

  /** Startet eine Runde. intro:true spielt vorher die 8-Bit-Cutscene. */
  start({ difficulty = 'normal', intro = false } = {}) {
    const cheat = this._konamiArmed;
    this._reset(DIFFICULTIES[difficulty] ? difficulty : 'normal');
    this._input = {};
    this._keyboard.clear();
    this._pointer = null;
    this._initAudio();
    this.options.onDialog?.(null);
    if (cheat) this._applyCheat();
    if (intro) {
      this._status = 'intro';
      this.intro.start();
    } else {
      this._beginCampaign();
    }
    this._emitHud(true);
  }

  _beginCampaign() {
    this._status = 'playing';
    this.chip.stopMusic();
    this.chip.sfx('start');
    this._announceStage();
    this._banner('SEKTOR 01', SECTORS[0].name, SECTORS[0].color);
    this.chat('start');
    this._emitHud(true);
  }

  showIntro() {
    this._initAudio();
    this._status = 'intro';
    this.intro.start();
    this._emitHud(true);
  }

  backToTitle() {
    this._reset('normal');
    this._status = 'title';
    this.chip.setTrack('title');
    this._emitHud(true);
  }

  pause() {
    if (!['playing', 'dialog', 'card'].includes(this._status)) return;
    this._beforePause = this._status;
    this._status = 'paused';
    this._input = {};
    this._keyboard.clear();
    this._pointer = null;
    this.player.charge = 0;
    this.player.wasCharging = false;
    this._emitHud(true);
  }

  resume() {
    if (this._status !== 'paused') return;
    this._status = this._beforePause;
    this._lastFrame = 0;
    this.chip.ctx?.resume().catch(() => {});
    if (this.dialog) this._emitDialog();
    this._emitHud(true);
  }

  togglePause() { this._status === 'paused' ? this.resume() : this.pause(); }

  setMuted(value) {
    this._muted = Boolean(value);
    this.chip.setMuted(this._muted);
  }

  setInput(action, pressed) {
    const old = Boolean(this._input[action]);
    this._input[action] = Boolean(pressed);
    if (!old && pressed && this._status === 'playing') {
      if (action === 'force') this._toggleForce();
      if (action === 'bomb') this._useBomb();
      if (action === 'cycle') this._cycleWeapon();
    }
    if (!old && pressed && action === 'pause') this.togglePause();
  }

  skipDialog() {
    if (this._status === 'card') { this._endCard(); return; }
    if (this._status === 'dialog' && this.dialog) this._advanceDialog();
  }

  snapshot() {
    const entity = ({ id, name, kind, type, x, y, hp, maxHp, vx, vy, damage }) => ({ id, name, kind: kind ?? type, x, y, hp, maxHp, vx, vy, damage });
    return {
      ...this.state, difficulty: this.difficulty, elapsed: this.elapsed, stageTime: this.stageTime,
      player: { ...this.player, levels: { ...this.player.levels } }, enemies: this.enemies.map(entity),
      playerBullets: this.shots.map(entity), enemyBullets: this.bullets.map(entity),
      drops: this.drops.map(entity), boss: this.boss ? entity(this.boss) : null,
      dialog: this.dialog ? { name: this.dialog.target.name, phase: this.dialog.phase, age: this.dialog.age } : null,
      kills: this.kills, bottle: this.bottle ? { ...this.bottle } : null,
      introduced: [...this.introduced],
    };
  }

  destroy() {
    this._destroyed = true;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown', this._keydown);
    window.removeEventListener('keyup', this._keyup);
    window.removeEventListener('blur', this._blur);
    this.canvas.removeEventListener('pointerdown', this._pointerdown);
    this.canvas.removeEventListener('pointermove', this._pointermove);
    this.canvas.removeEventListener('pointerup', this._pointerup);
    this.canvas.removeEventListener('pointercancel', this._pointerup);
    this.chip.close();
  }

  /* ---------------- Zustand ---------------- */

  _reset(difficulty) {
    this.difficulty = difficulty;
    this.settings = DIFFICULTIES[difficulty];
    this.score = 0;
    this.kills = 0;
    this.elapsed = 0;
    this.stage = 0;
    this.stageTime = 0;
    this.spawnTimer = 1.6;
    this.cheat = false;
    this._konamiArmed = false;
    this.player = {
      x: 160, y: 270, hp: 100, lives: this.settings.lives, weapon: 'aqua', levels: newLevels(),
      bombs: this.settings.bombs, charge: 0, wasCharging: false, cooldown: 0,
      invincible: 2, forceAttached: true, forceX: 205, forceY: 270,
      shield: 0, speedLvl: 0, slowmo: 0, magnet: 0, carlton: 0, orbitAngle: 0, tilt: 0,
    };
    this.enemies = [];
    this.shots = [];
    this.bullets = [];
    this.hazards = [];
    this.drops = [];
    this.particles = [];
    this.popups = [];
    this.boss = null;
    this.bottle = null;
    this.dialog = null;
    this.card = null;
    this.transition = null;
    this.introduced = new Set();
    this.banners = [];
    this.chatLog = [];
    this.cheer = null;
    this.donation = null;
    this.combo = { n: 0, t: 0 };
    this.terrainX = 0;
    this.idleChat = random(5, 9);
    this.bossDamaged = false;
    this.fatality = false;
    this.lastKill = null;
    this._shake = 0;
    this._flash = 0;
    this._flashColor = '129,236,255';
    this.gameOverLine = pick(GAMEOVER_LINES);
  }

  _initAudio() {
    this.chip.setMuted(this._muted);
    this.chip.init();
  }

  sound(name) { this.chip.sfx(name); }

  /* ---------------- Eingaben ---------------- */

  _handleKey(event, pressed) {
    const tag = event.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return;
    // Konami-Code: gilt auf Titel, Intro, Pause und im Spiel.
    if (pressed && !event.repeat) this._trackKonami(event.code);
    // Natives Aktivieren von Menü-Buttons erhalten.
    if (['Space', 'Enter'].includes(event.code) &&
      (tag === 'BUTTON' || tag === 'A' || event.target?.closest?.('button, a, [role="button"]'))) return;
    if (this._status === 'intro') {
      if (!pressed) return;
      if (['Enter', 'Space'].includes(event.code)) { event.preventDefault(); if (!event.repeat) this.intro.advance(); }
      else if (event.code === 'Escape') { event.preventDefault(); this.intro.skip(); }
      return;
    }
    const action = KEY_ACTIONS[event.code];
    if (!action && event.code !== 'Enter') return;
    if (this._status === 'title' || this._status === 'won' || this._status === 'gameover') return;
    event.preventDefault();
    if (pressed && (this._status === 'dialog' || this._status === 'card') && ['Space', 'Enter'].includes(event.code)) {
      if (!event.repeat) this.skipDialog();
      return;
    }
    if (!action) return;
    this._keyboard.set(event.code, pressed);
    const active = Object.entries(KEY_ACTIONS).some(([code, mapped]) => mapped === action && this._keyboard.get(code));
    if (pressed && event.repeat && ['force', 'bomb', 'pause', 'cycle'].includes(action)) return;
    this.setInput(action, active);
  }

  _trackKonami(code) {
    this._konami.push(code);
    if (this._konami.length > KONAMI.length) this._konami.shift();
    if (this._konami.length === KONAMI.length && this._konami.every((c, i) => c === KONAMI[i])) {
      this._konami = [];
      this.chip.sfx('konami');
      if (['playing', 'dialog', 'paused', 'card'].includes(this._status)) this._applyCheat();
      else this._konamiArmed = true;
      this.options.onEvent?.({ type: 'konami', text: 'KONAMI-CODE! 30 Leben und volle Bewaffnung. Kein Highscore.' });
    }
  }

  _applyCheat() {
    this.cheat = true;
    const p = this.player;
    p.lives = 30;
    p.bombs = 5;
    for (const id of WEAPON_ORDER) p.levels[id] = 3;
    p.shield = 3;
    this.chat('life', 'KONAMI! Der Klassiker. Keine Highscores für dich.');
    this._emitHud(true);
  }

  _setPointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / W, rect.height / H);
    const insetX = (rect.width - W * scale) / 2;
    const insetY = (rect.height - H * scale) / 2;
    this._pointer = {
      id: event.pointerId,
      x: clamp((event.clientX - rect.left - insetX) / scale, 0, W),
      y: clamp((event.clientY - rect.top - insetY) / scale, 0, H),
    };
  }

  /* ---------------- Hauptschleife ---------------- */

  _frame(now) {
    if (this._destroyed) return;
    try {
      this._step(now);
    } catch (error) {
      // Ein Fehler in einer einzelnen Entität darf die Schleife nie anhalten.
      this._errors = (this._errors ?? 0) + 1;
      if (this._errors <= 3) console.error('Neme-Type: Fehler im Frame', error);
      if (this._errors > 30 && this._status === 'playing') { this._errors = 0; this.pause(); }
    }
    this._raf = requestAnimationFrame(this._frame);
  }

  _step(now) {
    const dt = this._lastFrame ? clamp((now - this._lastFrame) / 1000, 0, 0.04) : 1 / 60;
    this._lastFrame = now;
    if (this._status !== 'paused') this._time += dt;
    if (this._status === 'playing') this._update(dt);
    else if (this._status === 'dialog') this._updateDialog(dt);
    else if (this._status === 'card') this._updateCard(dt);
    else if (this._status === 'intro') {
      this.intro.update(dt);
      if (this.intro.done) { this.intro.done = false; this._beginCampaign(); }
    }
    if (!['paused', 'intro'].includes(this._status)) {
      this._updateParticles(dt);
      this._shake = Math.max(0, this._shake - dt * 25);
      this._flash = Math.max(0, this._flash - dt * 3);
      this._updateBanners(dt);
    }
    this._music();
    this._render();
    this._emitHud();
  }

  _render() { renderGame(this, this.ctx); }

  _music() {
    if (this._status === 'paused') return;
    let track = '';
    if (this._status === 'title' || this._status === 'intro') track = 'title';
    else if (['playing', 'dialog', 'card'].includes(this._status)) track = this.boss ? 'boss' : `s${this.stage}`;
    this.chip.setTrack(track);
    this.chip.duck = this._status === 'dialog' ? 0.45 : 1;
    this.chip.tick();
  }

  _update(dt) {
    this.elapsed += dt;
    const p = this.player;
    p.invincible = Math.max(0, p.invincible - dt);
    p.cooldown -= dt;
    p.slowmo = Math.max(0, p.slowmo - dt);
    p.magnet = Math.max(0, p.magnet - dt);
    p.carlton = Math.max(0, p.carlton - dt);
    p.orbitAngle += dt * 4.2;
    const edt = dt * (p.slowmo > 0 ? 0.42 : 1);
    this.terrainX += TERRAIN_SPEED * edt;

    let dx = (this._input.right ? 1 : 0) - (this._input.left ? 1 : 0);
    let dy = (this._input.down ? 1 : 0) - (this._input.up ? 1 : 0);
    if (this._pointer) {
      dx = clamp((this._pointer.x - 30 - p.x) / 28, -1, 1);
      dy = clamp((this._pointer.y - p.y) / 28, -1, 1);
    }
    const length = Math.max(1, Math.hypot(dx, dy));
    const speed = 290 * (1 + p.speedLvl * 0.13);
    p.x = clamp(p.x + dx / length * speed * dt, 38, this.boss ? 560 : 875);
    p.y = clamp(p.y + dy / length * speed * dt, 47, 492);
    p.tilt += (dy / length * 0.2 - p.tilt) * Math.min(1, dt * 10);
    const forceTargetX = p.x + (p.forceAttached ? 43 : 153);
    p.forceX += (forceTargetX - p.forceX) * Math.min(1, dt * 9);
    p.forceY += (p.y - p.forceY) * Math.min(1, dt * 10);

    if (this._input.charge) {
      if (p.charge === 0) this.chip.sfx('charge');
      p.charge = Math.min(1, p.charge + dt / 1.1);
      p.wasCharging = true;
    } else if (p.wasCharging) {
      this._releaseCharge();
    }
    if ((this._input.fire || this._pointer) && p.cooldown <= 0 && !this._input.charge) fireWeapon(this);
    if (Math.random() < dt * 40) this._particle(p.x - 38, p.y + random(-4, 4), p.carlton > 0 ? pick(['#ff5fd2', '#ffe36a', '#62c8ff']) : '#ff9a3c', -random(110, 200), random(-16, 16), 0.3, 3);

    // Kombo-Timer, Chat-Leerlauf
    this.combo.t = Math.max(0, this.combo.t - dt);
    if (this.combo.t === 0) this.combo.n = 0;
    this.idleChat -= dt;
    if (this.idleChat <= 0) { this.idleChat = random(8, 14); this.chat('idle'); }
    this._updateChat(dt);

    if (this.transition) {
      this.transition.age -= dt;
      if (this.transition.age <= 0) this._nextStage();
    } else if (!this.boss && !this.bottle) {
      this.stageTime += dt;
      this.spawnTimer -= edt;
      if (this.spawnTimer <= 0 && this.stageTime < SECTORS[this.stage].duration) {
        this._spawnWave();
        this.spawnTimer = this.settings.interval * 1.45 * random(0.85, 1.3);
        if (this._status !== 'playing') return;
      }
      if (this.stageTime >= SECTORS[this.stage].duration) {
        this._spawnBoss();
        return;
      }
    }

    this._updateEnemies(edt);
    if (this._status !== 'playing') return;
    if (this.boss) this._updateBoss(edt);
    if (this._status !== 'playing') return;
    this._updateHazards(edt);
    this._updateShots(dt, edt);
    if (this._status !== 'playing') return;
    this._updateDrops(dt);
    if (this.bottle) {
      this.bottle.x -= dt * 58;
      this.bottle.y = 270 + Math.sin(this._time * 2) * 20;
      if (Math.hypot(p.x - this.bottle.x, p.y - this.bottle.y) < 58 || this.bottle.x < 55) {
        this.score += 5000;
        this._end(true);
      }
    }
  }

  /* ---------------- Spieleraktionen ---------------- */

  _releaseCharge() {
    const p = this.player;
    if (p.charge > 0.12) {
      this.shots.push(chargedShot(p, p.charge));
      this.chip.sfx(p.charge > 0.85 ? 'chargeshot' : p.weapon);
      this._burst(p.x + 38, p.y, '#93faff', 10);
      if (p.charge > 0.95) { this._popup('HADOUKEN!', p.x + 40, p.y - 34, '#9ffcff'); this._shake = Math.max(this._shake, 3); }
    }
    p.charge = 0;
    p.wasCharging = false;
  }

  _toggleForce() {
    this.player.forceAttached = !this.player.forceAttached;
    this.chip.sfx('pickup');
    this.options.onEvent?.({ type: 'force', text: this.player.forceAttached ? 'Force-Satellit angedockt' : 'Force-Satellit vorausgeschickt' });
    this._emitHud(true);
  }

  _cycleWeapon() {
    const p = this.player;
    const owned = WEAPON_ORDER.filter((id) => p.levels[id] > 0);
    if (owned.length < 2) return;
    p.weapon = owned[(owned.indexOf(p.weapon) + 1) % owned.length];
    this.chip.sfx('pickup');
    this._popup(WEAPONS[p.weapon].name.toUpperCase(), p.x, p.y - 40, WEAPONS[p.weapon].color);
    this._emitHud(true);
  }

  _useBomb() {
    const p = this.player;
    if (p.bombs <= 0) {
      this.options.onEvent?.({ type: 'info', text: 'Keine Wasserbomben mehr an Bord.' });
      return;
    }
    p.bombs--;
    this.bullets = [];
    this.hazards = this.hazards.filter((h) => h.kind === 'hbeam' && h.t > h.tele);
    for (const enemy of this.enemies.slice()) {
      enemy.hp -= 18;
      enemy.hit = 0.2;
      if (enemy.hp <= 0) this._killEnemy(enemy);
    }
    if (this.boss && !BOSSES[this.boss.kind].invulnerable?.(this.boss) && !this.boss.s?.finish) {
      this.boss.hp -= 34;
      this.boss.hit = 0.4;
      if (this.boss.hp <= 0) this._killBoss();
    }
    this._flash = 0.85;
    this._flashColor = '129,236,255';
    this._shake = 12;
    p.invincible = Math.max(p.invincible, 1);
    this._burst(p.x, p.y, '#7ceeff', 70, 2.8);
    this.chip.sfx('bomb');
    this.chat('bomb');
    this._popup('WASSERBOMBE!', p.x, p.y - 40, '#7ceeff');
    this._emitHud(true);
  }

  _damagePlayer(damage) {
    const p = this.player;
    if (p.invincible > 0 || p.carlton > 0 || this._status !== 'playing') return false;
    if (p.shield > 0) {
      p.shield--;
      p.invincible = 0.7;
      this._flash = 0.15;
      this._flashColor = '143,180,255';
      this._burst(p.x, p.y, '#8fb4ff', 16);
      this.chip.sfx('block');
      this._emitHud(true);
      return true;
    }
    if (this.boss) this.bossDamaged = true;
    p.hp = Math.max(0, p.hp - damage);
    p.invincible = 1.5;
    this._shake = 9;
    this._flash = 0.18;
    this._flashColor = '255,80,60';
    this._burst(p.x, p.y, '#ff9b65', 22);
    this.chip.sfx('hit');
    this.chat('hit');
    if (p.hp <= 0) {
      p.lives--;
      if (p.lives <= 0) {
        this._end(false);
      } else {
        p.hp = 100;
        p.invincible = 3;
        const lv = p.levels[p.weapon];
        if (lv > 1) p.levels[p.weapon] = lv - 1;
        else if (p.weapon !== 'aqua') { p.levels[p.weapon] = 0; p.weapon = 'aqua'; }
        p.speedLvl = Math.max(0, p.speedLvl - 1);
        p.x = 125;
        p.y = 270;
        p.charge = 0;
        p.wasCharging = false;
        this.bullets = [];
        this.chat('life');
        this.options.onEvent?.({ type: 'life', text: `Schiff verloren! Noch ${p.lives} Leben.` });
      }
    }
    this._emitHud(true);
    return true;
  }

  /* ---------------- Gegner und Wellen ---------------- */

  spawn(typeId, x, y, opts = {}) {
    const type = ENEMY_TYPES[typeId];
    if (!type || this.enemies.length >= MAX_ENEMIES) return { x, y, hp: 0, maxHp: 0, gone: true, killed: true, s: {} };
    const hp = Math.max(1, Math.ceil(type.hp * (1 + this.stage * 0.1)));
    const enemy = {
      id: ++this._uid, type: typeId, name: type.name, kind: typeId, x, y, baseY: opts.baseY ?? y,
      age: 0, phase: opts.phase ?? random(0, TAU), hp, maxHp: hp, radius: type.radius, score: type.score,
      color: type.color, hit: 0, speed: random(95, 135), shotTimer: random(0.9, 2.1), carrier: false, ghost: false,
      blocked: 0, s: {},
    };
    if (typeId === 'mini') { enemy.s.vx = opts.vx ?? -90; enemy.s.vy = opts.vy ?? 0; }
    AI[typeId].init?.(this, enemy, opts);
    this.enemies.push(enemy);
    return enemy;
  }

  _spawnWave() {
    const sector = SECTORS[this.stage];
    if (this.enemies.length > 16) return;
    const unlocked = this.stageTime < 10 ? 1 : this.stageTime < 22 ? 2 : this.stageTime < 34 ? 3 : 4;
    const types = sector.enemies.slice(0, Math.min(unlocked, sector.enemies.length));
    const unseen = types.find((type) => !this.introduced.has(type.name));
    if (unseen) {
      const enemy = this.spawn(unseen.id, 780, 270, { baseY: 270, side: 'floor' });
      enemy.x = 780;
      this._beginDialog(enemy, unseen.reply);
      return;
    }
    const type = pick(types);
    const wave = spawnFormation(this, type);
    if (wave.length && !wave[0].carrier && Math.random() < 0.2 && type.id !== 'swarm') pick(wave).carrier = true;
  }

  // Alte Bezeichnung bleibt als Alias erhalten (Tests, Fehlersuche).
  _spawnEnemy() { this._spawnWave(); }

  _updateEnemies(dt) {
    const p = this.player;
    for (const enemy of this.enemies) {
      enemy.age += dt;
      enemy.hit = Math.max(0, enemy.hit - dt);
      enemy.blocked = Math.max(0, enemy.blocked - dt);
      AI[enemy.type].update(this, enemy, dt);
      if (enemy.ghost || enemy.hp <= 0) continue;
      for (const circle of hitCircles(enemy)) {
        if (Math.hypot(p.x - circle.x, p.y - circle.y) < circle.r + 16) {
          // Kleine Gegner sterben beim Rammen: zuerst werten, damit der Endstand den Abschuss enthält.
          const small = enemy.maxHp <= 9;
          if (small) {
            enemy.hp = 0;
            this._killEnemy(enemy);
          }
          const damaged = this._damagePlayer(this.settings.damage * 1.3);
          if (!small && damaged) {
            enemy.hp -= 5;
            enemy.hit = 0.2;
            if (enemy.hp <= 0) this._killEnemy(enemy);
          }
          break;
        }
      }
      if (this._status !== 'playing') {
        this.enemies = this.enemies.filter((item) => item.hp > 0);
        return;
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0 && !e.gone && e.x > -95 - (e.s.dir > 0 ? 400 : 0) && e.x < W + 420);
  }

  _spawnBoss() {
    const sector = SECTORS[this.stage];
    const def = BOSSES[sector.bossKind];
    const maxHp = Math.round((def.hp + this.stage * 10) * this.settings.bossHp);
    this.enemies = [];
    this.bullets = [];
    this.hazards = [];
    this.shots = [];
    this.bossDamaged = false;
    this.fatality = false;
    this.boss = {
      id: ++this._uid, name: sector.boss, kind: sector.bossKind, x: 1120, y: 270, age: 0, hp: maxHp, maxHp,
      radius: 74, hit: 0, color: sector.color, s: {},
    };
    def.init(this, this.boss);
    this.card = { t: 0, dur: 2.7 };
    this._status = 'card';
    this.player.charge = 0;
    this.player.wasCharging = false;
    this.chip.sfx('warn');
    this.options.onEvent?.({ type: 'boss', text: `${sector.boss} betritt den Chat.` });
    this.chat('boss');
    this._emitHud(true);
  }

  _updateCard(dt) {
    if (!this.card) return;
    this.card.t += dt;
    if (this.card.t >= this.card.dur) this._endCard();
  }

  _endCard() {
    const boss = this.boss;
    this.card = null;
    if (boss) this._beginDialog(boss, SECTORS[this.stage].bossReply);
    else this._status = 'playing';
  }

  _updateBoss(dt) {
    const boss = this.boss;
    const def = BOSSES[boss.kind];
    boss.age += dt;
    boss.hit = Math.max(0, boss.hit - dt);
    def.update(this, boss, dt);
    if (this.boss && boss.x <= 830 && bossHit(def, boss, this.player.x, this.player.y, 12) && !(def.invulnerable?.(boss))) this._damagePlayer(this.settings.damage * 1.4);
  }

  enemyBullet(x, y, angle, speed, color, radius = 5, kind = 'orb') {
    if (this.bullets.length >= MAX_BULLETS) return;
    const mult = this.settings.speed;
    this.bullets.push({ kind, x, y, vx: Math.cos(angle) * speed * mult, vy: Math.sin(angle) * speed * mult, color, radius, age: 0 });
  }

  addBullet(bullet) {
    if (this.bullets.length >= MAX_BULLETS) return;
    this.bullets.push({ age: 0, radius: 5, color: '#fff', ...bullet });
  }

  addHazard(hazard) { this.hazards.push({ t: 0, fired: false, ...hazard }); }

  clearBullets() { this.bullets = []; this.hazards = []; }

  _updateHazards(dt) {
    const p = this.player;
    for (const h of this.hazards) {
      h.t += dt;
      if (h.kind === 'hbeam') {
        if (!h.owner || h.owner.hp <= 0 || h.owner.gone) { h.dead = true; continue; }
        if (h.t < h.tele - 0.3) h.y += (p.y - h.y) * Math.min(1, dt * 6);
        h.x = h.owner.x - 20;
      }
      const active = h.t >= h.tele && h.t <= h.tele + h.dur;
      if (active && !h.fired) { h.fired = true; if (h.kind !== 'window') this.chip.sfx('beamfire'); else this.chip.sfx('block'); this._shake = Math.max(this._shake, 3); }
      if (active) {
        let hit = false;
        if (h.kind === 'hbeam') hit = p.x < h.x && Math.abs(p.y - h.y) < h.w / 2 + 9;
        else if (h.kind === 'vbeam') hit = Math.abs(p.x - h.x) < h.w / 2 + 9;
        else if (h.kind === 'window') hit = p.x > h.x - 8 && p.x < h.x + h.w + 8 && p.y > h.y - 8 && p.y < h.y + h.h + 8;
        if (hit) this._damagePlayer(this.settings.damage);
      }
      if (h.t > h.tele + h.dur + 0.25) h.dead = true;
    }
    this.hazards = this.hazards.filter((h) => !h.dead);
  }

  /* ---------------- Schüsse und Kollisionen ---------------- */

  _hurtEnemy(enemy, shot, damage) {
    enemy.hp -= damage;
    enemy.hit = 0.1;
    this._burst(shot.x, shot.y, enemy.color, 3);
    if (enemy.hp <= 0) this._killEnemy(enemy);
  }

  _updateShots(dt, edt) {
    const p = this.player;
    for (const shot of this.shots) {
      steer(this, shot, dt);
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      if (shot.life <= 0) shot.dead = true;
      if (shot.dead) continue;
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0 || enemy.ghost || shot.dead || shot.hits.has(enemy.id)) continue;
        const hit = hitCircles(enemy).some((c) => Math.hypot(shot.x - c.x, shot.y - c.y) < c.r + shot.radius);
        if (!hit) continue;
        shot.hits.add(enemy.id);
        const factor = AI[enemy.type].shotFactor ? AI[enemy.type].shotFactor(this, enemy, shot) : 1;
        if (factor <= 0) {
          shot.dead = true;
          this._burst(shot.x, shot.y, '#ffffff', 4);
          this.chip.sfx('block');
          continue;
        }
        this._hurtEnemy(enemy, shot, shot.damage * factor);
        if (shot.splash) {
          for (const other of this.enemies) if (other !== enemy && other.hp > 0 && Math.hypot(other.x - shot.x, other.y - shot.y) < shot.splash) this._hurtEnemy(other, shot, shot.damage * 0.5);
          this._burst(shot.x, shot.y, '#ff8af0', 10, 1.2);
        }
        if (--shot.pierce <= 0) shot.dead = true;
      }
      const boss = this.boss;
      if (boss && !shot.dead && !shot.hits.has(boss.id)) {
        const def = BOSSES[boss.kind];
        if (bossHit(def, boss, shot.x, shot.y, shot.radius)) {
          shot.hits.add(boss.id);
          const factor = def.factor(this, boss, shot);
          if (factor <= 0) {
            this._burst(shot.x, shot.y, '#ffffff', 3);
            this.chip.sfx('block');
          } else {
            if (shot.charged && boss.s?.finish) { boss.hp = 0; this.fatality = true; }
            else boss.hp -= shot.damage * factor;
            if (def.protect?.(boss, shot)) boss.hp = Math.max(1, boss.hp);
            boss.hit = 0.09;
            this._burst(shot.x, shot.y, factor >= 1 ? '#9affff' : '#ffb55f', 4);
            if (boss.hp <= 0) this._killBoss();
          }
          if (--shot.pierce <= 0) shot.dead = true;
        }
      }
    }
    this.shots = this.shots.filter((s) => !s.dead && s.x < W + 65 && s.y > -35 && s.y < H + 35);

    // Kronkorken-Orbit rupft Gegner und fängt Kugeln ab.
    const caps = orbitPositions(p);
    const now = this._time;
    for (const cap of caps) {
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0 || enemy.ghost || (enemy.capHit ?? 0) > now - 0.14) continue;
        if (hitCircles(enemy).some((c) => Math.hypot(cap.x - c.x, cap.y - c.y) < c.r + cap.r)) {
          enemy.capHit = now;
          this._hurtEnemy(enemy, cap, 0.8);
        }
      }
      const boss = this.boss;
      if (boss && (boss.capHit ?? 0) < now - 0.25 && bossHit(BOSSES[boss.kind], boss, cap.x, cap.y, cap.r) && !BOSSES[boss.kind].invulnerable?.(boss)) {
        boss.capHit = now;
        boss.hp -= 0.6 * (BOSSES[boss.kind].factor(this, boss, { x: cap.x, y: cap.y, charged: false }) || 0);
        boss.hit = 0.06;
        if (boss.hp <= 0) this._killBoss();
      }
    }

    for (const bullet of this.bullets) {
      const slow = edt;
      bullet.age += slow;
      bullet.x += bullet.vx * slow;
      bullet.y += bullet.vy * slow;
      if (bullet.kind === 'mine') {
        bullet.vx *= 1 - slow * 0.3;
        const near = Math.hypot(bullet.x - p.x, bullet.y - p.y) < 46;
        if (near || bullet.age > bullet.fuse) this._detonate(bullet);
      } else if (bullet.kind === 'bubble' && bullet.age > bullet.fuse) {
        this._detonate(bullet, 8, '#8fe3ff', 130);
      }
      if (bullet.dead) continue;
      // Spielerschüsse zerstören Minen und Blasen
      if (bullet.kind === 'mine' || bullet.kind === 'bubble') {
        for (const shot of this.shots) {
          if (!shot.dead && Math.hypot(shot.x - bullet.x, shot.y - bullet.y) < bullet.radius + shot.radius + 2) {
            if (!shot.charged) shot.dead = true;
            this.score += 20;
            this._detonate(bullet, bullet.kind === 'bubble' ? 8 : 6, bullet.color, 150);
            break;
          }
        }
        if (bullet.dead) continue;
      }
      if (caps.some((cap) => bullet.kind !== 'mine' && bullet.radius <= 9 && Math.hypot(bullet.x - cap.x, bullet.y - cap.y) < cap.r + bullet.radius)) {
        bullet.dead = true;
        this._burst(bullet.x, bullet.y, '#ffd84a', 3);
        continue;
      }
      const hitR = bullet.kind === 'smoke' ? bullet.radius * 0.7 : bullet.radius;
      if (Math.hypot(bullet.x - p.forceX, bullet.y - p.forceY) < 18 + bullet.radius && bullet.kind !== 'mine') {
        bullet.dead = true;
        this._burst(bullet.x, bullet.y, '#a1f7ff', 4);
      } else if (Math.hypot(bullet.x - p.x, bullet.y - p.y) < 12 + hitR) {
        bullet.dead = true;
        this._damagePlayer(this.settings.damage);
        if (this._status !== 'playing') return;
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead && b.x > -50 && b.x < W + 60 && b.y > -50 && b.y < H + 50 && b.age < 30);
  }

  _detonate(bullet, count = 8, color = '#ff8fe1', speed = 170) {
    if (bullet.dead) return;
    bullet.dead = true;
    for (let i = 0; i < count; i++) this.enemyBullet(bullet.x, bullet.y, i * TAU / count + random(0, 0.3), speed, color, 5);
    this._burst(bullet.x, bullet.y, color, 12, 1.3);
    this.chip.sfx('explode');
  }

  _killEnemy(enemy) {
    if (enemy.killed) return;
    enemy.killed = true;
    enemy.hp = 0;
    const points = enemy.score + (this.combo.n >= 2 ? this.combo.n * 10 : 0);
    this.score += points;
    this.kills++;
    this.combo.n++;
    this.combo.t = 1.6;
    if (this.combo.n === 4 || this.combo.n === 8) {
      this.score += this.combo.n * 50;
      this._popup(`${this.combo.n}er KOMBO!`, enemy.x, enemy.y - 30, '#ffe36a');
      this.chat('multi');
    } else if (Math.random() < 0.1) this.chat('kill');
    this.lastKill = { name: enemy.name, points };
    this.cheer = { text: `${enemy.name} – ${points}`, t: 0 };
    const big = enemy.radius >= 26;
    this._burst(enemy.x, enemy.y, enemy.color, big ? 30 : 16);
    this._burst(enemy.x, enemy.y, '#fff6d0', 6, 0.6);
    this.chip.sfx(big ? 'big' : 'explode');
    if (big) this._shake = Math.max(this._shake, 4);
    AI[enemy.type].onDeath?.(this, enemy);
    if (enemy.carrier) this._drop(enemy.x, enemy.y);
    else if (enemy.type !== 'mini' && enemy.type !== 'swarm' && Math.random() < 0.09) this._drop(enemy.x, enemy.y);
  }

  _drop(x, y, forced) {
    if (this.drops.length > 12) return;
    let type = forced;
    if (!type) {
      const total = DROP_TABLE.reduce((sum, [, weight]) => sum + weight, 0);
      let roll = Math.random() * total;
      type = DROP_TABLE.find(([, weight]) => (roll -= weight) < 0)?.[0] ?? 'repair';
    }
    const drop = { type, x, y, age: 0 };
    if (type === 'weapon') drop.weapon = pick(WEAPON_ORDER);
    this.drops.push(drop);
  }

  _killBoss() {
    const boss = this.boss;
    if (!boss) return;
    const flawless = !this.bossDamaged;
    this.score += 2500 + this.stage * 1000;
    if (flawless) this.score += 1500;
    if (this.fatality) this.score += 2000;
    this.kills++;
    this._burst(boss.x, boss.y, '#ff995e', 90, 2.2);
    this._burst(boss.x, boss.y, '#ae88ff', 50, 2);
    this._burst(boss.x, boss.y, '#ffffff', 30, 1.4);
    this._shake = 17;
    this._flash = 0.65;
    this._flashColor = '255,255,255';
    this.boss = null;
    this.bullets = [];
    this.hazards = [];
    this.enemies = [];
    const p = this.player;
    p.hp = Math.min(100, p.hp + 30);
    p.bombs = Math.min(5, p.bombs + 1);
    this.chip.sfx(this.fatality ? 'fatality' : 'bomb');
    if (this.fatality) this._banner('FATALITY!', 'Hadouken-Finish +2000', '#ff2f4f');
    else if (flawless) this._banner('FLAWLESS VICTORY', 'Kein Treffer kassiert +1500', '#62e8ff');
    this.chat('clear');
    if (this.stage < SECTORS.length - 1) {
      this.transition = { age: 4 };
      this.options.onEvent?.({ type: 'sector', text: `${boss.name} besiegt! Hyperraum-Sprung in den nächsten Sektor …` });
    } else {
      this.bottle = { x: 805, y: 270 };
      this.options.onEvent?.({ type: 'bottle', text: 'DA IST SIE! Schnapp dir die überdimensionale Sportwasserflasche!' });
      this._banner('DIE FLASCHE!', 'Schnapp sie dir!', '#62e8ff');
    }
    this._emitHud(true);
  }

  _updateDrops(dt) {
    const p = this.player;
    for (const drop of this.drops) {
      drop.age += dt;
      if (p.magnet > 0 && Math.hypot(drop.x - p.x, drop.y - p.y) < 300) {
        const a = Math.atan2(p.y - drop.y, p.x - drop.x);
        drop.x += Math.cos(a) * 340 * dt;
        drop.y += Math.sin(a) * 340 * dt;
      } else drop.x -= 87 * dt;
      if (Math.hypot(drop.x - p.x, drop.y - p.y) < 34) {
        drop.dead = true;
        this._collect(drop);
      }
    }
    this.drops = this.drops.filter((drop) => !drop.dead && drop.x > -30);
  }

  _collect(drop) {
    const p = this.player;
    this.score += 100;
    let text;
    let color;
    if (drop.type === 'weapon') {
      const id = drop.weapon;
      const w = WEAPONS[id];
      const before = p.levels[id];
      p.levels[id] = Math.min(3, before + 1);
      p.weapon = id;
      text = `${w.name} LV${p.levels[id]}${before >= 3 ? ' MAX' : ''}`;
      color = w.color;
      this.chip.sfx('weapon');
      this.chat('weapon');
    } else {
      const def = POWERUPS[drop.type];
      text = def.name;
      color = def.color;
      if (drop.type === 'repair') p.hp = Math.min(100, p.hp + 35);
      else if (drop.type === 'bomb') p.bombs = Math.min(5, p.bombs + 1);
      else if (drop.type === 'shield') p.shield = Math.min(3, p.shield + 3);
      else if (drop.type === 'speed') p.speedLvl = Math.min(3, p.speedLvl + 1);
      else if (drop.type === 'slowmo') p.slowmo = 7;
      else if (drop.type === 'magnet') p.magnet = 14;
      else if (drop.type === 'carlton') p.carlton = 6;
      else if (drop.type === 'life') p.lives = Math.min(9, p.lives + 1);
      this.chip.sfx(drop.type === 'life' ? 'life' : 'pickup');
      if (drop.type !== 'repair') this.chat('pickup');
      this.options.onEvent?.({ type: 'pickup', text: def.cheer });
    }
    const euro = pick([0.25, 0.5, 1, 2.5, 5]).toFixed(2).replace('.', ',');
    this.donation = { text: `${text} – €${euro}`, t: 0 };
    this._popup(text.toUpperCase(), drop.x, drop.y - 24, color);
    this._burst(drop.x, drop.y, color, 14);
    this._emitHud(true);
  }

  /* ---------------- Sektoren ---------------- */

  _nextStage() {
    this.stage++;
    this.stageTime = 0;
    this.spawnTimer = 2;
    this.transition = null;
    this.drops = [];
    this.shots = [];
    this.player.invincible = 2;
    this._announceStage();
    this._banner(`SEKTOR 0${this.stage + 1}`, SECTORS[this.stage].name, SECTORS[this.stage].color);
  }

  _announceStage() {
    const sector = SECTORS[this.stage];
    this.options.onStage?.({ number: this.stage + 1, name: sector.name, subtitle: sector.subtitle, bossName: sector.boss });
    this.options.onEvent?.({ type: 'sector', text: `Sektor ${this.stage + 1}: ${sector.name}` });
  }

  /* ---------------- DarthRick-Portal ---------------- */

  _beginDialog(target, reply) {
    this.introduced.add(target.name);
    this.dialog = { target, reply, phase: 0, age: 0, total: 0 };
    this._status = 'dialog';
    this.player.wasCharging = false;
    this.player.charge = 0;
    this.chip.sfx('portal');
    this._emitDialog();
    this._emitHud(true);
  }

  _updateDialog(dt) {
    if (!this.dialog) return;
    this.dialog.age += dt;
    this.dialog.total += dt;
    const durations = [0.7, 2.9, 3.1, 0.7];
    if (this.dialog.age >= durations[this.dialog.phase]) this._advanceDialog();
  }

  _advanceDialog() {
    if (!this.dialog) return;
    this.dialog.phase++;
    this.dialog.age = 0;
    if (this.dialog.phase >= 4) {
      this.dialog = null;
      this._status = 'playing';
      this.options.onDialog?.(null);
      this.player.invincible = Math.max(this.player.invincible, 0.9);
      this._emitHud(true);
      return;
    }
    if (this.dialog.phase === 3) this.chip.sfx('portal');
    this._emitDialog();
  }

  _emitDialog() {
    const dialog = this.dialog;
    const phase = dialog.phase;
    const speaker = phase === 2 ? 'enemy' : 'DarthRick';
    this.options.onDialog?.({
      speaker, name: speaker === 'enemy' ? dialog.target.name : 'DarthRick',
      enemyName: dialog.target.name, phase,
      text: phase === 0 ? 'Moment! Da kommt jemand in den Chat …' :
        phase === 1 ? `Moin ${dialog.target.name}! Herzlich willkommen im Stream von Nemesis316!` :
        phase === 2 ? dialog.reply : 'So, weitermachen. Ich bin wieder im Chat. o7',
    });
  }

  _end(won) {
    if (this._status === 'gameover' || this._status === 'won') return;
    this._status = won ? 'won' : 'gameover';
    this.player.charge = 0;
    this.dialog = null;
    this.card = null;
    this.options.onDialog?.(null);
    if (won) this._burst(this.player.x, this.player.y, '#8effed', 80, 2);
    this.chip.sfx(won ? 'win' : 'lose');
    this.highScore = Math.max(this.highScore, this.score);
    this._emitHud(true);
    this.options.onEnd?.({
      score: this.score, won, stage: this.stage + 1, kills: this.kills, duration: Math.round(this.elapsed),
      difficulty: this.difficulty, cheated: this.cheat, line: this.gameOverLine,
    });
  }

  /* ---------------- Chat, Banner, Partikel ---------------- */

  chat(kind, text) {
    const line = text ?? pick(CHAT_LINES[kind] ?? CHAT_LINES.idle);
    const [name, color, mod] = kind === 'boss' || kind === 'clear' ? CHAT_USERS[0] : pick(CHAT_USERS);
    this.chatLog.push({ name, color, mod: Boolean(mod), text: line, t: 0 });
    if (this.chatLog.length > 5) this.chatLog.shift();
  }

  _updateChat(dt) {
    for (const line of this.chatLog) line.t += dt;
    this.chatLog = this.chatLog.filter((line) => line.t < 9);
    if (this.cheer) { this.cheer.t += dt; if (this.cheer.t > 6) this.cheer = null; }
    if (this.donation) { this.donation.t += dt; if (this.donation.t > 8) this.donation = null; }
    for (const pop of this.popups) pop.t += dt;
    this.popups = this.popups.filter((pop) => pop.t < 1.2);
  }

  banner(text, color = '#ffe36a', sub = '') { this._banner(text, sub, color); }

  _banner(text, sub, color) {
    this.banners.push({ text, sub, color, t: 0, dur: 2.6 });
    if (this.banners.length > 3) this.banners.shift();
  }

  _updateBanners(dt) {
    for (const banner of this.banners) banner.t += dt;
    this.banners = this.banners.filter((banner) => banner.t < banner.dur);
  }

  _popup(text, x, y, color) {
    this.popups.push({ text, x, y, color, t: 0 });
    if (this.popups.length > 6) this.popups.shift();
  }

  _particle(x, y, color, vx, vy, life = 0.55, size = 3) {
    if (this.particles.length >= 520) return;
    this.particles.push({ x, y, vx, vy, color, life, maxLife: life, size });
  }

  burst(x, y, color, count, power = 1) { this._burst(x, y, color, count, power); }

  _burst(x, y, color, count, power = 1) {
    for (let i = 0; i < count; i++) {
      const angle = random(0, TAU);
      const speed = random(25, 165) * power;
      this._particle(x, y, color, Math.cos(angle) * speed, Math.sin(angle) * speed, random(0.22, 0.85) * power, random(2, 6));
    }
  }

  _updateParticles(dt) {
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  _emitHud(force = false) {
    if (force || this._time - this._hudAt > 0.085) {
      this._hudAt = this._time;
      this.options.onHud?.(this.state);
    }
  }
}

loadImages();
