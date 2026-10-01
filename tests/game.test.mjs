import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { NemeGame, SECTORS } from '../game.js';
import { ENEMY_TYPES, WEAPON_ORDER, KONAMI } from '../content.js';
import { fire } from '../weapons.js';
import { BOSSES } from '../bosses.js';
import { Intro } from '../intro.js';

before(() => {
  globalThis.window = new EventTarget();
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
});

function makeGame(options = {}, startOptions = {}) {
  const canvas = new EventTarget();
  canvas.getContext = () => ({ imageSmoothingEnabled: false });
  const game = new NemeGame(canvas, options);
  // Rendering wird im echten Browser geprüft; diese Tests prüfen die Simulation.
  game._render = () => {};
  game.start(startOptions);
  return game;
}

function finishGreeting(game) {
  for (let i = 0; i < 6 && ['dialog', 'card'].includes(game.status); i++) game.skipDialog();
  assert.equal(game.status, 'playing');
}

function step(game, seconds, dt = 1 / 30) {
  for (let t = 0; t < seconds && game.status === 'playing'; t += dt) game._update(dt);
}

test('portal conversations freeze enemies, shots, damage, and mission time; pause resumes the same message', () => {
  const messages = [];
  const game = makeGame({ onDialog: (message) => messages.push(message) });
  game.player.invincible = 0;
  game._spawnWave();
  assert.equal(game.status, 'dialog');
  game.enemyBullet(game.player.x, game.player.y, 0, 100, '#fff');
  fire(game);
  const before = game.snapshot();
  game._frame(100);
  game._frame(140);
  const after = game.snapshot();
  assert.equal(after.stageTime, before.stageTime);
  assert.equal(after.elapsed, before.elapsed);
  assert.equal(after.shield, before.shield);
  assert.deepEqual(after.enemies, before.enemies);
  assert.deepEqual(after.enemyBullets, before.enemyBullets);
  assert.deepEqual(after.playerBullets, before.playerBullets);
  game.skipDialog();
  assert.match(messages.at(-1).text, /Tamagotchi-Drohne/);
  const greeting = messages.at(-1);
  game.pause();
  game._frame(50_000);
  assert.equal(game.status, 'paused');
  game.resume();
  assert.deepEqual(messages.at(-1), greeting);
  game.skipDialog();
  assert.equal(messages.at(-1).speaker, 'enemy');
  assert.match(messages.at(-1).text, /Piep piep/);
  finishGreeting(game);
  game._frame(100_000);
  assert.ok(game.elapsed - before.elapsed < 0.05, 'resuming cannot jump the mission timer');
  game.destroy();
});

test('four sectors: every new enemy and boss gets a greeting, then the bottle can be rescued', () => {
  const reports = [];
  const game = makeGame({ onEnd: (result) => reports.push(result) });
  game.player.invincible = 9999;
  assert.equal(SECTORS.length, 4);
  for (let stage = 0; stage < SECTORS.length; stage++) {
    assert.equal(game.state.stage, stage + 1);
    const roster = SECTORS[stage].enemies;
    for (const [i, enemy] of roster.entries()) {
      game.stageTime = [1, 12, 24, 36][i];
      game.enemies = [];
      const had = game.introduced.has(enemy.name);
      game._spawnWave();
      if (!had) {
        assert.equal(game.status, 'dialog', `${enemy.name} gets greeted`);
        assert.equal(game.snapshot().dialog.name, enemy.name);
        finishGreeting(game);
      } else assert.equal(game.status, 'playing', 'already welcomed types do not interrupt again');
    }
    game.enemies = [];
    game.stageTime = SECTORS[stage].duration;
    game._update(0);
    assert.equal(game.status, 'card', 'boss introduction card');
    assert.ok(game.boss);
    game.skipDialog();
    assert.equal(game.status, 'dialog');
    assert.equal(game.snapshot().dialog.name, SECTORS[stage].boss);
    finishGreeting(game);
    const boss = game.boss;
    boss.x = 790;
    boss.s.mode = 'visible';
    game.shots.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, damage: boss.hp * 40, radius: 10, charged: true, pierce: Infinity, hits: new Set(), life: 1 });
    game._updateShots(0, 0);
    assert.equal(game.boss, null, `${SECTORS[stage].boss} defeated`);
    if (stage < SECTORS.length - 1) {
      game.transition.age = 0;
      game._update(0);
    }
  }
  assert.equal(game.introduced.size, 14 + 4);
  assert.ok(game.bottle);
  assert.equal(reports.length, 0, 'beating the final boss alone does not rescue the bottle');
  game.bottle.x = game.player.x;
  game.bottle.y = game.player.y;
  game._update(0);
  assert.equal(game.status, 'won');
  assert.equal(reports.length, 1);
  assert.equal(reports[0].won, true);
  assert.equal(reports[0].stage, 4);
  assert.equal(reports[0].score, game.score);
  assert.equal(reports[0].kills, 4);
  game.destroy();
});

test('fatal contact produces a final score identical to the HUD and cannot change after game over', () => {
  let report;
  const game = makeGame({ onEnd: (result) => { report = result; } });
  game._spawnWave();
  finishGreeting(game);
  const enemy = game.enemies[0];
  Object.assign(enemy, { x: game.player.x, y: game.player.y, baseY: game.player.y, phase: 0, speed: 0 });
  Object.assign(game.player, { hp: 1, lives: 1, invincible: 0 });
  game._update(0);
  assert.equal(game.status, 'gameover');
  assert.equal(report.score, game.score);
  assert.equal(report.kills, game.kills);
  game._frame(100);
  game._frame(140);
  assert.equal(report.score, game.score);
  assert.equal(report.kills, game.kills);
  game.destroy();
});

test('invulnerability prevents repeated damage and restarting clears the previous campaign', () => {
  const game = makeGame();
  game.player.invincible = 0;
  game._damagePlayer(25);
  game._damagePlayer(25);
  assert.equal(game.player.hp, 75);
  game._spawnWave();
  finishGreeting(game);
  game.score = 500;
  game.player.charge = 1;
  game.setInput('fire', true);
  game.setInput('right', true);
  game.start({ difficulty: 'easy' });
  assert.equal(game.player.lives, 5);
  assert.equal(game.score, 0);
  assert.equal(game.introduced.size, 0);
  assert.equal(game.player.charge, 0);
  assert.equal(game.enemies.length, 0);
  assert.equal(game.bullets.length, 0);
  assert.equal(game.stage, 0);
  const x = game.player.x;
  game._update(0.02);
  assert.equal(game.player.x, x);
  assert.equal(game.shots.length, 0);
  game.destroy();
});

test('releasing one of two equivalent movement keys keeps the other key active', () => {
  const game = makeGame();
  const key = (code, pressed) => game._handleKey({ code, repeat: false, target: { tagName: 'CANVAS' }, preventDefault() {} }, pressed);
  key('KeyW', true);
  key('ArrowUp', true);
  key('KeyW', false);
  const y = game.player.y;
  game._update(0.1);
  assert.ok(game.player.y < y);
  key('ArrowUp', false);
  const stopped = game.player.y;
  game._update(0.1);
  assert.equal(game.player.y, stopped);
  game.destroy();
});

test('focused menu buttons retain native Enter and Space activation', () => {
  const game = makeGame();
  game.pause();
  for (const code of ['Enter', 'Space']) {
    let prevented = false;
    game._handleKey({ code, repeat: false, target: { tagName: 'BUTTON' }, preventDefault() { prevented = true; } }, true);
    assert.equal(prevented, false);
  }
  game.destroy();
});

test('weapon capsules level up, switch and cycle weapons; dying costs a level', () => {
  const game = makeGame();
  const p = game.player;
  p.invincible = 0;
  assert.equal(p.weapon, 'aqua');
  game.drops.push({ type: 'weapon', weapon: 'spread', x: p.x, y: p.y, age: 0 });
  game._updateDrops(0);
  assert.equal(p.weapon, 'spread');
  assert.equal(p.levels.spread, 1);
  game.drops.push({ type: 'weapon', weapon: 'spread', x: p.x, y: p.y, age: 0 });
  game._updateDrops(0);
  assert.equal(p.levels.spread, 2);
  for (const weapon of WEAPON_ORDER) {
    p.weapon = weapon;
    p.levels[weapon] = Math.max(1, p.levels[weapon]);
    game.shots = [];
    p.cooldown = 0;
    fire(game);
    assert.ok(game.shots.length > 0, `${weapon} fires`);
  }
  p.weapon = 'spread';
  game.setInput('cycle', true);
  assert.notEqual(p.weapon, 'spread');
  p.weapon = 'spread';
  p.hp = 1;
  game._damagePlayer(50);
  assert.equal(p.levels.spread, 1, 'lost one level');
  p.hp = 1;
  p.invincible = 0;
  game._damagePlayer(50);
  assert.equal(p.weapon, 'aqua', 'falls back to the aqua laser');
  game.destroy();
});

test('power-ups: shield absorbs hits, extra life, bomb, bullet time, carlton dance', () => {
  const game = makeGame();
  const p = game.player;
  p.invincible = 0;
  const take = (type) => { game.drops.push({ type, x: p.x, y: p.y, age: 0 }); game._updateDrops(0); };
  take('shield');
  assert.equal(p.shield, 3);
  game._damagePlayer(50);
  assert.equal(p.hp, 100);
  assert.equal(p.shield, 2);
  const lives = p.lives;
  take('life');
  assert.equal(p.lives, lives + 1);
  const bombs = p.bombs;
  take('bomb');
  assert.equal(p.bombs, bombs + 1);
  take('slowmo');
  assert.ok(p.slowmo > 0);
  take('carlton');
  p.invincible = 0;
  game._damagePlayer(50);
  assert.equal(p.hp, 100, 'carlton dance makes the ship untouchable');
  game.destroy();
});

test('every enemy type runs its AI, can be killed, and every boss pattern runs without errors', () => {
  const game = makeGame();
  game.player.invincible = 9999;
  for (const id of Object.keys(ENEMY_TYPES)) {
    game.enemies = [];
    game.bullets = [];
    game.hazards = [];
    const enemy = game.spawn(id, 760, 270, { baseY: 270 });
    for (let i = 0; i < 360 && game.status === 'playing'; i++) game._update(1 / 30);
    game.enemies.forEach((e) => { e.hp = 0; });
    game.enemies = [];
    const again = game.spawn(id, 600, 270, { baseY: 270 });
    game._killEnemy(again);
    assert.equal(again.hp, 0, `${id} dies`);
    if (id === 'splitter') assert.equal(game.enemies.filter((e) => e.type === 'mini').length, 3, 'splitter spawns three minis');
    assert.ok(enemy);
  }
  for (let kind = 0; kind < BOSSES.length; kind++) {
    const g2 = makeGame();
    g2.player.invincible = 9999;
    g2.stage = kind;
    g2.stageTime = SECTORS[kind].duration;
    g2._update(0);
    g2.skipDialog();
    finishGreeting(g2);
    for (let i = 0; i < 30 * 40 && g2.boss; i++) {
      g2.player.y = g2.boss.y;
      g2._update(1 / 30);
      if (g2.status !== 'playing') break;
    }
    assert.ok(g2.boss, `boss ${kind} survives 40 s without a hit`);
    g2.boss.hp = g2.boss.maxHp * 0.3;
    for (let i = 0; i < 30 * 15 && g2.boss; i++) g2._update(1 / 30);
    g2.destroy();
  }
  game.destroy();
});

test('shield knights block frontal shots but not charged shots or shots from behind; phasers ignore shots while ghosting', () => {
  const game = makeGame();
  game.player.invincible = 9999;
  const knight = game.spawn('shield', 600, 270, { baseY: 270 });
  const hp = knight.hp;
  const mk = (x, charged = false) => ({ x, y: 270, vx: 0, vy: 0, damage: 1, radius: 4, charged, pierce: charged ? Infinity : 1, hits: new Set(), life: 1 });
  game.shots = [mk(knight.x - 20)];
  game._updateShots(0, 0);
  assert.equal(knight.hp, hp, 'front shot is blocked');
  game.shots = [mk(knight.x + 10)];
  game._updateShots(0, 0);
  assert.ok(knight.hp < hp, 'shot from behind hurts');
  const before = knight.hp;
  game.shots = [mk(knight.x - 20, true)];
  game._updateShots(0, 0);
  assert.ok(knight.hp < before, 'charged shots break through');
  game.enemies = [];
  const phaser = game.spawn('phaser', 600, 270, { baseY: 270 });
  phaser.ghost = true;
  const phaserHp = phaser.hp;
  game.shots = [mk(phaser.x)];
  game._updateShots(0, 0);
  assert.equal(phaser.hp, phaserHp);
  game.destroy();
});

test('Konami code arms the cheat mode: 30 lives, full loadout, flagged result', () => {
  let report;
  const game = makeGame({ onEnd: (result) => { report = result; } });
  game.backToTitle();
  for (const code of KONAMI) game._handleKey({ code, repeat: false, target: { tagName: 'BODY' }, preventDefault() {} }, true);
  game.start({});
  assert.equal(game.player.lives, 30);
  assert.equal(game.player.levels.beam, 3);
  assert.equal(game.cheat, true);
  game.player.lives = 1;
  game.player.hp = 1;
  game.player.invincible = 0;
  game.player.shield = 0;
  game._damagePlayer(10);
  assert.equal(report.cheated, true);
  game.destroy();
});

test('intro: plays through all lines into the campaign and can be skipped', () => {
  const game = makeGame({}, { intro: true });
  assert.equal(game.status, 'intro');
  for (let i = 0; i < 4000 && game.status === 'intro'; i++) {
    game.intro.advance();
    game._frame(i * 16);
  }
  assert.equal(game.status, 'playing');
  game.start({ intro: true });
  assert.equal(game.status, 'intro');
  game._handleKey({ code: 'Escape', repeat: false, target: { tagName: 'CANVAS' }, preventDefault() {} }, true);
  game._frame(99_000);
  assert.equal(game.status, 'playing');
  const intro = new Intro(null);
  assert.ok(intro.line.text.length > 0);
  game.destroy();
});

test('an invincible autopilot can play the whole campaign to the rescued bottle', () => {
  let report;
  const tracked = [];
  const game = makeGame({ onEnd: (result) => { report = result; }, onTrack: (name, props) => tracked.push([name, props]) });
  game.player.lives = 99;
  let frames = 0;
  while (!report && frames < 30 * 900) {
    frames++;
    if (['dialog', 'card'].includes(game.status)) { game.skipDialog(); continue; }
    if (game.status !== 'playing') break;
    const p = game.player;
    p.invincible = 9999;
    p.hp = 100;
    if (frames % 600 === 0) game.setInput('cycle', true), game.setInput('cycle', false);
    const aimY = game.boss ? game.boss.y + BOSSES[game.boss.kind].weak.y : null;
    const target = game.bottle || game.boss || game.enemies.filter((e) => e.x > p.x).sort((a, b) => a.x - b.x)[0];
    if (target) p.y += Math.max(-9, Math.min(9, (aimY ?? target.y) - p.y));
    if (game.bottle) p.x += Math.max(-9, Math.min(9, game.bottle.x - p.x));
    game.setInput('fire', true);
    game.setInput('charge', game.boss ? frames % 90 < 40 : false);
    game._update(1 / 30);
  }
  assert.ok(report, `campaign finished within the time limit (frames=${frames}, stage=${game.stage + 1}, status=${game.status})`);
  assert.equal(report.won, true);
  assert.equal(report.stage, 4);
  const names = tracked.map(([name]) => name);
  assert.equal(names.filter((n) => n === 'game_start').length, 1);
  assert.deepEqual(tracked.filter(([n]) => n === 'sector').map(([, p]) => p.stage), [1, 2, 3, 4]);
  assert.deepEqual(tracked.filter(([n]) => n === 'boss_down').map(([, p]) => p.stage), [1, 2, 3, 4]);
  const end = tracked.find(([n]) => n === 'game_end')[1];
  assert.deepEqual([end.won, end.stage, end.cheated, end.difficulty], [1, 4, 0, 'normal']);
  assert.equal(end.score, report.score);
  game.destroy();
});

test('a throwing frame never stops the loop, and bullets/enemies stay capped', () => {
  let frames = 0;
  globalThis.requestAnimationFrame = () => { frames++; return 1; };
  const game = makeGame();
  const original = console.error;
  console.error = () => {};
  game._step = () => { throw new Error('boom'); };
  game._frame(16);
  console.error = original;
  assert.equal(frames >= 1, true, 'next frame is still scheduled');
  game.start();
  for (let i = 0; i < 2000; i++) game.enemyBullet(500, 270, 0, 10, '#fff');
  assert.ok(game.bullets.length <= 900);
  for (let i = 0; i < 100; i++) game.spawn('drone', 800, 200);
  assert.ok(game.enemies.length <= 40);
  game.destroy();
  globalThis.requestAnimationFrame = () => 1;
});
