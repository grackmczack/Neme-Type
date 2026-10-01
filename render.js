// Darstellung: Hintergründe, Welt, HUD im Twitch-Overlay-Stil, Boss-Karte, Banner, CRT-Filter.
import { W, H, TAU, clamp, SECTORS, WEAPONS, WEAPON_ORDER, POWERUPS } from './content.js';
import { FLOOR_Y, CEIL_Y, drawEnemy } from './enemies.js';
import { drawShot, orbitPositions } from './weapons.js';
import { BOSSES } from './bosses.js';
import { getSprite, getBackground, getBossSprite, getPixelImage, images } from './sprites.js';
import { drawNemesis, drawNemesisSprite } from './intro.js';

const PX = '"Press Start 2P", "Courier New", monospace';
const BUBBLE = '"Titan One", "Arial Black", sans-serif';
const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

const glowCache = new Map();
let scanCanvas = null;

function glowSprite(color, radius) {
  const key = `${color}|${radius}`;
  let sprite = glowCache.get(key);
  if (!sprite) {
    const size = Math.ceil(radius * 2 + 22);
    sprite = document.createElement('canvas');
    sprite.width = size;
    sprite.height = size;
    const c = sprite.getContext('2d');
    const g = c.createRadialGradient(size / 2, size / 2, radius * 0.4, size / 2, size / 2, size / 2);
    g.addColorStop(0, `${color}cc`);
    g.addColorStop(1, `${color}00`);
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    c.fillStyle = color;
    c.beginPath();
    c.arc(size / 2, size / 2, radius, 0, TAU);
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(size / 2, size / 2, Math.max(1.5, radius * 0.45), 0, TAU);
    c.fill();
    glowCache.set(key, sprite);
  }
  return sprite;
}

function text(c, str, x, y, { size = 10, color = '#fff', align = 'left', font = PX, stroke = '#160d2e', width = 0 } = {}) {
  c.font = `${size}px ${font}`;
  c.textAlign = align;
  c.textBaseline = 'alphabetic';
  if (stroke) {
    c.lineJoin = 'round';
    c.lineWidth = width || Math.max(3, size / 3);
    c.strokeStyle = stroke;
    c.strokeText(str, x, y);
  }
  c.fillStyle = color;
  c.fillText(str, x, y);
}

function bubbleText(c, str, x, y, size, top, bottom, outline = '#0a1a4a', lineWidth = 0) {
  c.save();
  c.font = `${size}px ${BUBBLE}`;
  c.textAlign = 'center';
  c.lineJoin = 'round';
  c.lineWidth = lineWidth || size / 4;
  c.strokeStyle = outline;
  c.strokeText(str, x, y);
  const g = c.createLinearGradient(0, y - size * 0.8, 0, y + size * 0.1);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  c.fillStyle = g;
  c.fillText(str, x, y);
  c.restore();
}

export function renderGame(g, c) {
  c.imageSmoothingEnabled = false;
  if (g._status === 'intro') {
    g.intro.render(c, g.reduceMotion);
    drawScanlines(c);
    return;
  }
  c.save();
  const shake = g.reduceMotion ? g._shake * 0.2 : g._shake;
  if (shake > 0) c.translate(Math.round((Math.random() - 0.5) * shake * 2), Math.round((Math.random() - 0.5) * shake));
  drawBackground(g, c);
  if (g._status === 'title') drawTitle(g, c);
  else drawWorld(g, c);
  c.restore();
  if (g._status !== 'title') {
    drawHud(g, c);
    drawBanners(g, c);
    if (g.transition) drawTransition(g, c);
    if (g.dialog) drawPortal(g, c);
    if (g.card) drawBossCard(g, c);
  }
  if (g._flash > 0) {
    c.fillStyle = `rgba(${g._flashColor},${g._flash * (g.reduceMotion ? 0.12 : 0.4)})`;
    c.fillRect(0, 0, W, H);
  }
  drawScanlines(c);
  if (g._status === 'paused') {
    c.fillStyle = 'rgba(8,4,24,0.6)';
    c.fillRect(0, 0, W, H);
  }
}

/* ---------------- Hintergrund ---------------- */

function drawBackground(g, c) {
  const index = g._status === 'title' ? 0 : g.stage;
  const sector = SECTORS[index];
  const t = g._time;
  const plate = getBackground(index);
  if (plate) {
    const dw = Math.round(plate.width * H / plate.height);
    const x = -Math.round((dw - W) * (0.5 + 0.5 * Math.sin(t * 0.035)));
    c.drawImage(plate, x, 0, dw, H);
    c.fillStyle = 'rgba(6,3,20,0.3)';
    c.fillRect(0, 0, W, H);
  } else {
    const grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, sector.palette[0]);
    grad.addColorStop(0.6, sector.palette[1]);
    grad.addColorStop(1, sector.palette[2]);
    c.fillStyle = grad;
    c.fillRect(-25, -25, W + 50, H + 50);
    for (let i = 0; i < 5; i++) {
      const x = (810 + i * 233 - t * (8 + i * 1.5)) % 1270 - 100;
      const y = 90 + Math.sin(i * 2.1) * 120;
      const neb = c.createRadialGradient(x, y, 0, x, y, 230);
      neb.addColorStop(0, `${sector.color}33`);
      neb.addColorStop(1, `${sector.color}00`);
      c.fillStyle = neb;
      c.fillRect(x - 230, y - 230, 460, 460);
    }
  }
  for (const star of g.stars) {
    const x = ((star.x - t * (10 + star.z * 60)) % W + W) % W;
    c.globalAlpha = (0.25 + star.z * 0.6) * (0.85 + Math.sin(t * 1.4 + star.flicker) * 0.15);
    c.fillStyle = star.z > 0.75 ? '#dff6ff' : '#b8b0e0';
    c.fillRect(Math.round(x), Math.round(star.y), star.z > 0.8 ? 2 : 1, star.z > 0.8 ? 2 : 1);
  }
  c.globalAlpha = 1;

  if (index === 0) {
    // Rauchschwaden
    for (let i = 0; i < 7; i++) {
      const x = ((i * 190 - t * (22 + i * 4)) % (W + 300) + W + 300) % (W + 300) - 150;
      const y = 80 + (i * 67) % 380 + Math.sin(t * 0.5 + i) * 18;
      c.fillStyle = 'rgba(200,170,255,0.05)';
      for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(Math.round(x + k * 26 - 40), Math.round(y - k % 2 * 14), 30 + (k % 3) * 8, 0, TAU); c.fill(); }
    }
  } else if (index === 1) {
    // Matrix-Regen
    for (let i = 0; i < 30; i++) {
      const x = i * 33 + 6;
      const speed = 70 + (i * 37) % 90;
      const head = ((t * speed + i * 91) % (H + 280)) - 140;
      for (let k = 0; k < 9; k++) {
        c.fillStyle = k === 0 ? 'rgba(220,255,230,0.85)' : `rgba(60,255,140,${0.5 - k * 0.055})`;
        c.fillRect(x, Math.round(head - k * 14), 5, 10);
      }
    }
  } else if (index === 2) {
    // Schwebende Fehlerfenster
    for (let i = 0; i < 6; i++) {
      const x = ((i * 210 - t * (16 + i * 5)) % (W + 360) + W + 360) % (W + 360) - 180;
      const y = 60 + (i * 131) % 330;
      c.globalAlpha = 0.28;
      c.fillStyle = '#c0c0c0';
      c.fillRect(Math.round(x), y, 120, 76);
      c.fillStyle = '#1a2a9a';
      c.fillRect(Math.round(x) + 3, y + 3, 114, 14);
      c.fillStyle = '#ffffff';
      c.fillRect(Math.round(x) + 104, y + 6, 8, 8);
      c.globalAlpha = 1;
    }
  } else {
    // Glut
    for (let i = 0; i < 46; i++) {
      const x = (i * 97 + 13) % W;
      const y = H - (((t * (24 + (i * 13) % 40)) + i * 57) % (H + 40));
      c.fillStyle = `rgba(255,${140 + (i * 11) % 90},60,${0.25 + ((i * 7) % 5) * 0.1})`;
      c.fillRect(Math.round(x + Math.sin(t + i) * 6), Math.round(y), 2, 2);
    }
  }
}

function drawTerrain(g, c) {
  const sector = SECTORS[g.stage];
  const pal = [['#241049', '#4a2a8a'], ['#06281c', '#0f6a48'], ['#0a1c4a', '#2060c0'], ['#2a0a10', '#8a2a1a']][g.stage];
  const scroll = g.terrainX;
  const step = 48;
  const first = Math.floor(scroll / step);
  for (let i = -1; i < W / step + 2; i++) {
    const idx = first + i;
    const x = i * step - (scroll % step);
    const bump = ((idx * 2654435761) >>> 7) % 4;
    const fh = 34 + bump * 3;
    c.fillStyle = pal[0];
    c.fillRect(Math.round(x), H - fh, step + 1, fh + 4);
    c.fillStyle = pal[1];
    c.fillRect(Math.round(x), H - fh, step + 1, 4);
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.fillRect(Math.round(x) + 6, H - fh + 10, 10, 4);
    const ch = 22 + (((idx * 40503) >>> 5) % 4) * 4;
    c.fillStyle = pal[0];
    c.fillRect(Math.round(x), -2, step + 1, ch + 2);
    c.fillStyle = pal[1];
    c.fillRect(Math.round(x), ch - 3, step + 1, 3);
    if (bump === 0) {
      c.fillStyle = pal[0];
      c.fillRect(Math.round(x) + 14, ch, 14, 10);
      c.fillRect(Math.round(x) + 19, ch + 10, 5, 6);
    }
  }
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fillRect(0, H - 8, W, 8);
  c.fillStyle = sector.color + '55';
  c.fillRect(0, FLOOR_Y + 1, W, 1);
}

/* ---------------- Welt ---------------- */

function drawWorld(g, c) {
  drawTerrain(g, c);
  g.drops.forEach((drop) => drawDrop(g, c, drop));
  g.hazards.forEach((h) => drawHazard(g, c, h));
  g.enemies.forEach((enemy) => drawEnemy(g, c, enemy));
  if (g.boss) BOSSES[g.boss.kind].draw(g, c, g.boss);
  g.shots.forEach((shot) => drawShot(c, shot, g._time));
  g.bullets.forEach((bullet) => drawBullet(g, c, bullet));
  if (g.bottle) drawBottleGoal(g, c);
  if (g._status !== 'title') {
    drawShip(g, c);
    drawForce(g, c);
    orbitPositions(g.player).forEach((cap) => {
      const s = getSprite('cork');
      if (s) c.drawImage(s, Math.round(cap.x - s.width / 2), Math.round(cap.y - s.height / 2));
    });
    if (g.player.charge > 0) drawCharge(g, c);
  }
  for (const p of g.particles) {
    c.globalAlpha = Math.min(1, p.life / p.maxLife * 1.5);
    c.fillStyle = p.color;
    c.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  c.globalAlpha = 1;
  for (const pop of g.popups) {
    const a = 1 - pop.t / 1.2;
    c.globalAlpha = clamp(a * 2, 0, 1);
    text(c, pop.text, Math.round(pop.x), Math.round(pop.y - pop.t * 34), { size: 9, color: pop.color, align: 'center' });
  }
  c.globalAlpha = 1;
}

function drawShip(g, c) {
  const p = g.player;
  const t = g._time;
  if (p.invincible > 0 && p.carlton <= 0 && Math.floor(t * 12) % 2 === 0) return;
  const ship = getSprite('ship');
  c.save();
  c.translate(Math.round(p.x), Math.round(p.y));
  if (p.shield > 0) {
    c.strokeStyle = `rgba(143,180,255,${0.55 + Math.sin(t * 8) * 0.2})`;
    c.fillStyle = 'rgba(143,180,255,0.14)';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(4, 0, 38, 0, TAU);
    c.fill();
    c.stroke();
    for (let i = 0; i < p.shield; i++) { c.fillStyle = '#b8d0ff'; c.fillRect(-14 + i * 12, -50, 8, 5); }
  }
  c.rotate(p.tilt);
  // Triebwerk
  const jet = 12 + Math.sin(t * 40) * 5 + (g._input.right ? 6 : 0);
  c.fillStyle = '#ff9a3c';
  c.fillRect(-40 - jet, -4, jet, 8);
  c.fillStyle = '#ffe36a';
  c.fillRect(-36 - jet * 0.7, -2, jet * 0.7, 4);
  c.fillStyle = '#ffffff';
  c.fillRect(-34 - jet * 0.3, -1, jet * 0.3, 2);
  if (ship) {
    if (p.carlton > 0) {
      const hue = (t * 300) % 360;
      c.filter = `hue-rotate(${hue}deg) saturate(2)`;
      c.translate(0, Math.sin(t * 16) * 4);
    }
    c.drawImage(ship, -Math.round(ship.width / 2), -Math.round(ship.height / 2));
    c.filter = 'none';
  }
  c.restore();
  if (p.carlton > 0) {
    text(c, '♪', Math.round(p.x + 10 + Math.sin(t * 5) * 14), Math.round(p.y - 34 - (t * 30) % 20), { size: 14, color: '#ff5fd2', align: 'center' });
  }
}

function drawForce(g, c) {
  const p = g.player;
  const s = getSprite('force');
  c.save();
  c.translate(Math.round(p.forceX), Math.round(p.forceY));
  c.shadowColor = '#7aefff';
  c.shadowBlur = p.forceAttached ? 8 : 16;
  if (s) c.drawImage(s, -Math.round(s.width / 2), -Math.round(s.height / 2));
  c.shadowBlur = 0;
  c.strokeStyle = '#75eefa';
  c.globalAlpha = 0.35 + Math.sin(g._time * 3) * 0.1;
  c.beginPath();
  c.arc(1, 0, 22, -g._time, -g._time + Math.PI * 1.2);
  c.stroke();
  c.restore();
}

function drawCharge(g, c) {
  const p = g.player;
  const r = 8 + p.charge * 16;
  c.save();
  c.translate(p.x + 40, p.y);
  c.shadowBlur = 16;
  c.shadowColor = '#75f2ff';
  c.fillStyle = p.charge >= 1 ? '#f0ffff' : '#6ff2ff';
  c.beginPath();
  c.arc(0, 0, r * (0.68 + Math.sin(g._time * 23) * 0.06), 0, TAU);
  c.fill();
  c.shadowBlur = 0;
  c.strokeStyle = '#73f4ff';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(0, 0, r + 5, g._time * 4, g._time * 4 + Math.PI * 1.4);
  c.stroke();
  c.restore();
}

function drawBullet(g, c, b) {
  const t = g._time;
  if (b.kind === 'smoke') {
    c.fillStyle = 'rgba(180,130,255,0.55)';
    c.beginPath();
    c.arc(Math.round(b.x), Math.round(b.y), b.radius, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(235,215,255,0.5)';
    c.beginPath();
    c.arc(Math.round(b.x - b.radius * 0.25), Math.round(b.y - b.radius * 0.25), b.radius * 0.55, 0, TAU);
    c.fill();
    c.fillStyle = '#fff';
    c.fillRect(Math.round(b.x - 1), Math.round(b.y - 1), 3, 3);
    return;
  }
  if (b.kind === 'mine') {
    const warn = b.age > b.fuse - 1.2 && Math.floor(t * 10) % 2 === 0;
    const r = b.radius + Math.sin(t * 6) * 1.5;
    c.save();
    c.translate(Math.round(b.x), Math.round(b.y));
    c.fillStyle = warn ? '#ffffff' : '#ff8fe1';
    c.beginPath();
    c.arc(0, 0, r, 0, TAU);
    c.fill();
    c.fillStyle = '#160d2e';
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + t; c.fillRect(Math.round(Math.cos(a) * (r + 3)) - 2, Math.round(Math.sin(a) * (r + 3)) - 2, 4, 4); }
    c.fillStyle = '#ff2fa6';
    c.fillRect(-3, -3, 6, 6);
    c.restore();
    return;
  }
  if (b.kind === 'bubble') {
    c.strokeStyle = '#bff2ff';
    c.lineWidth = 2;
    c.fillStyle = 'rgba(140,220,255,0.3)';
    c.beginPath();
    c.arc(Math.round(b.x), Math.round(b.y), b.radius + Math.sin(t * 9) * 1.4, 0, TAU);
    c.fill();
    c.stroke();
    c.fillStyle = '#fff';
    c.fillRect(Math.round(b.x - 5), Math.round(b.y - 6), 3, 3);
    return;
  }
  const s = glowSprite(b.color, b.radius);
  c.drawImage(s, Math.round(b.x - s.width / 2), Math.round(b.y - s.height / 2));
}

function drawHazard(g, c, h) {
  const active = h.t >= h.tele && h.t <= h.tele + h.dur;
  const blink = Math.floor(g._time * 14) % 2 === 0;
  if (h.kind === 'hbeam') {
    c.save();
    if (!active && h.t < h.tele) {
      c.strokeStyle = blink ? 'rgba(255,60,80,0.9)' : 'rgba(255,60,80,0.35)';
      c.lineWidth = 2;
      c.setLineDash([10, 8]);
      c.beginPath(); c.moveTo(h.x, h.y); c.lineTo(0, h.y); c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#ff3c50';
      c.fillRect(Math.round(g.player.x - 26), Math.round(h.y - 1), 8, 3);
      text(c, '!', Math.round(g.player.x - 34), Math.round(h.y + 5), { size: 14, color: '#ff3c50', align: 'center' });
    } else if (active) {
      c.shadowColor = '#ff3c50';
      c.shadowBlur = 20;
      c.fillStyle = '#ff6a7a';
      c.fillRect(0, Math.round(h.y - h.w / 2), Math.round(h.x), h.w);
      c.fillStyle = '#ffffff';
      c.fillRect(0, Math.round(h.y - h.w / 5), Math.round(h.x), Math.round(h.w * 0.4));
    }
    c.restore();
  } else if (h.kind === 'vbeam') {
    c.save();
    if (!active && h.t < h.tele) {
      c.strokeStyle = blink ? 'rgba(255,200,80,0.9)' : 'rgba(255,200,80,0.35)';
      c.lineWidth = 2;
      c.setLineDash([10, 8]);
      c.beginPath(); c.moveTo(h.x, 0); c.lineTo(h.x, H); c.stroke();
    } else if (active) {
      c.shadowColor = '#ffb24a';
      c.shadowBlur = 20;
      c.fillStyle = '#ffb24a';
      c.fillRect(Math.round(h.x - h.w / 2), 0, h.w, H);
      c.fillStyle = '#fff6d0';
      c.fillRect(Math.round(h.x - h.w / 5), 0, Math.round(h.w * 0.4), H);
    }
    c.restore();
  } else if (h.kind === 'window') {
    const solid = h.t >= h.tele;
    c.save();
    c.globalAlpha = solid ? 1 : (blink ? 0.6 : 0.25);
    c.fillStyle = '#c0c0c0';
    c.fillRect(Math.round(h.x), Math.round(h.y), h.w, h.h);
    c.fillStyle = '#fff';
    c.fillRect(Math.round(h.x), Math.round(h.y), h.w, 2);
    c.fillRect(Math.round(h.x), Math.round(h.y), 2, h.h);
    c.fillStyle = '#6a6a6a';
    c.fillRect(Math.round(h.x), Math.round(h.y + h.h - 2), h.w, 2);
    c.fillRect(Math.round(h.x + h.w - 2), Math.round(h.y), 2, h.h);
    c.fillStyle = '#0a0a8a';
    c.fillRect(Math.round(h.x + 4), Math.round(h.y + 4), h.w - 8, 14);
    c.fillStyle = '#c0c0c0';
    c.fillRect(Math.round(h.x + h.w - 18), Math.round(h.y + 6), 11, 10);
    c.fillStyle = '#000';
    c.fillRect(Math.round(h.x + h.w - 15), Math.round(h.y + 9), 5, 4);
    text(c, 'Fehler', Math.round(h.x + 10), Math.round(h.y + 14), { size: 7, color: '#fff', stroke: null });
    c.fillStyle = '#ff2f4f';
    c.beginPath();
    c.arc(Math.round(h.x + 22), Math.round(h.y + 46), 12, 0, TAU);
    c.fill();
    c.fillStyle = '#fff';
    c.fillRect(Math.round(h.x + 20), Math.round(h.y + 38), 4, 11);
    c.fillRect(Math.round(h.x + 20), Math.round(h.y + 52), 4, 4);
    text(c, 'Fataler', Math.round(h.x + 42), Math.round(h.y + 44), { size: 7, color: '#000', stroke: null });
    text(c, 'Fehler 316', Math.round(h.x + 42), Math.round(h.y + 58), { size: 7, color: '#000', stroke: null });
    if (solid) {
      c.strokeStyle = '#ff2f4f';
      c.lineWidth = 3;
      c.strokeRect(Math.round(h.x), Math.round(h.y), h.w, h.h);
    }
    c.restore();
  }
}

function drawDrop(g, c, drop) {
  const y = drop.y + Math.sin(drop.age * 4) * 5;
  let color;
  let label;
  if (drop.type === 'weapon') {
    color = WEAPONS[drop.weapon].color;
    label = WEAPONS[drop.weapon].short[0];
  } else {
    color = POWERUPS[drop.type].color;
    label = POWERUPS[drop.type].label;
  }
  c.save();
  c.translate(Math.round(drop.x), Math.round(y));
  c.shadowColor = color;
  c.shadowBlur = 14;
  c.fillStyle = '#160d2e';
  c.fillRect(-19, -13, 38, 26);
  c.shadowBlur = 0;
  c.fillStyle = color;
  c.fillRect(-17, -11, 34, 22);
  c.fillStyle = 'rgba(255,255,255,0.45)';
  c.fillRect(-17, -11, 34, 5);
  c.fillStyle = '#160d2e';
  c.fillRect(-17, -11, 3, 3); c.fillRect(14, -11, 3, 3); c.fillRect(-17, 8, 3, 3); c.fillRect(14, 8, 3, 3);
  c.fillRect(-12, -8, 24, 16);
  text(c, label, 0, 5, { size: 12, color, align: 'center', stroke: null });
  if (drop.type === 'weapon') {
    c.fillStyle = color;
    c.fillRect(-12, 13, 24, 3);
  }
  c.restore();
}

function drawBottleGoal(g, c) {
  const b = g.bottle;
  const img = images.bottle;
  c.save();
  c.translate(Math.round(b.x), Math.round(b.y));
  c.shadowColor = '#7cffe8';
  c.shadowBlur = 30;
  if (img) {
    const s = getPixelImage('bottle', 78, 170);
    c.drawImage(s, -s.width / 2, -s.height / 2 + Math.sin(g._time * 3) * 4);
  } else {
    const s = getSprite('bottle');
    if (s) c.drawImage(s, -s.width, -s.height, s.width * 2, s.height * 2);
  }
  c.restore();
  text(c, 'FLASCHE SICHERN!', Math.round(b.x), Math.round(b.y - 100), { size: 11, color: '#8ffff1', align: 'center' });
}

/* ---------------- HUD (Twitch-Overlay-Stil) ---------------- */

function drawHud(g, c) {
  const p = g.player;
  const t = g._time;
  // Kopfleiste
  const bar = c.createLinearGradient(0, 0, 0, 44);
  bar.addColorStop(0, 'rgba(10,6,48,0.92)');
  bar.addColorStop(1, 'rgba(10,6,48,0.6)');
  c.fillStyle = bar;
  c.fillRect(0, 0, W, 44);
  c.fillStyle = '#27d3da';
  c.fillRect(0, 43, W, 2);
  text(c, '1UP', 14, 16, { size: 8, color: '#ff7bd5', stroke: null });
  text(c, String(Math.floor(g.score)).padStart(6, '0'), 14, 35, { size: 16, color: '#ffe36a' });
  text(c, `HI ${String(Math.floor(Math.max(g.highScore, g.score))).padStart(6, '0')}`, 140, 16, { size: 7, color: '#9fb4ff', stroke: null });
  text(c, `${SECTORS[g.stage].name}`, 140, 35, { size: 8, color: SECTORS[g.stage].color, stroke: null });

  // Abo-Ziel = Sektorfortschritt, beim Boss die Boss-Leiste
  const bx = 330;
  const bw = 330;
  if (g.boss) {
    const ratio = clamp(g.boss.hp / g.boss.maxHp, 0, 1);
    c.fillStyle = '#160d2e';
    c.fillRect(bx - 3, 8, bw + 6, 28);
    c.fillStyle = '#ffffff';
    c.fillRect(bx, 11, bw, 22);
    c.fillStyle = ratio < 0.4 ? '#ff4b3c' : '#ff9a3c';
    c.fillRect(bx, 11, Math.round(bw * ratio), 22);
    for (let i = 1; i < 10; i++) { c.fillStyle = 'rgba(22,13,46,0.35)'; c.fillRect(bx + i * bw / 10, 11, 1, 22); }
    text(c, g.boss.name.toUpperCase(), bx + bw / 2, 27, { size: 9, color: '#160d2e', align: 'center', stroke: 'rgba(255,255,255,0.7)', width: 3 });
  } else {
    const prog = clamp(g.stageTime / SECTORS[g.stage].duration, 0, 1);
    c.fillStyle = '#160d2e';
    c.fillRect(bx - 3, 8, bw + 6, 28);
    c.fillStyle = '#ffffff';
    c.fillRect(bx, 11, bw, 22);
    c.fillStyle = '#21bfc9';
    c.fillRect(bx, 11, Math.round(bw * prog), 22);
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.fillRect(bx, 11, Math.round(bw * prog), 6);
    const subs = Math.floor(prog * 120);
    text(c, `ABO-ZIEL  ${subs}/120`, bx + 12, 27, { size: 9, color: '#0a1a2a', stroke: null });
    text(c, 'ABOS GESAMT', bx + bw - 10, 27, { size: 7, color: '#0a1a2a', align: 'right', stroke: null });
  }

  // Leben (Flaschen) und Bomben
  const bottle = getSprite('bottle');
  const lives = Math.min(p.lives, 6);
  for (let i = 0; i < lives; i++) if (bottle) c.drawImage(bottle, 690 + i * 24, 8, Math.round(bottle.width * 0.5), Math.round(bottle.height * 0.5));
  if (p.lives > 6) text(c, `+${p.lives - 6}`, 690 + 6 * 24, 32, { size: 8, color: '#fff', stroke: null });
  text(c, 'LEBEN', 690, 41, { size: 6, color: '#9fb4ff', stroke: null });
  for (let i = 0; i < p.bombs; i++) {
    c.fillStyle = '#7ceeff';
    c.beginPath();
    c.arc(858 + i * 17, 26, 6, 0, TAU);
    c.fill();
    c.fillStyle = '#160d2e';
    c.fillRect(856 + i * 17, 16, 4, 4);
  }
  text(c, 'BOMBEN', 858, 41, { size: 6, color: '#9fb4ff', stroke: null });

  // Latest Cheer / Last Donation
  if (g.cheer) {
    c.globalAlpha = clamp(3 - g.cheer.t * 0.5, 0.2, 1);
    text(c, `Latest Kill: ${g.cheer.text}`, 14, 66, { size: 9, color: '#ff6a7a', stroke: '#2a0a14' });
    c.globalAlpha = 1;
  }
  if (g.donation) {
    c.globalAlpha = clamp(4 - g.donation.t * 0.45, 0.2, 1);
    text(c, `Last Donation: ${g.donation.text}`, W - 14, 66, { size: 9, color: '#4dff9a', align: 'right', stroke: '#06281c' });
    c.globalAlpha = 1;
  }

  // Chat unten links
  g.chatLog.forEach((line, i) => {
    const y = H - 120 + i * 18 - (g.chatLog.length - 5) * 0;
    c.globalAlpha = clamp(1 - Math.max(0, line.t - 6) / 3, 0.15, 0.92);
    let x = 14;
    if (line.mod) { c.fillStyle = '#3dff9a'; c.fillRect(x, y - 8, 10, 10); text(c, 'M', x + 5, y, { size: 6, color: '#06281c', align: 'center', stroke: null }); x += 14; }
    text(c, `${line.name}:`, x, y, { size: 8, color: line.color, stroke: '#0a0630' });
    c.font = `8px ${PX}`;
    const w = c.measureText(`${line.name}: `).width;
    text(c, line.text, x + w, y, { size: 8, color: '#f4f0ff', stroke: '#0a0630' });
    c.globalAlpha = 1;
  });

  // Waffen-Slots
  const slotX = W - 14 - WEAPON_ORDER.length * 40;
  WEAPON_ORDER.forEach((id, i) => {
    const lv = p.levels[id];
    const x = slotX + i * 40;
    const y = H - 52;
    const cur = p.weapon === id;
    c.fillStyle = cur ? 'rgba(10,6,48,0.92)' : 'rgba(10,6,48,0.6)';
    c.fillRect(x, y, 34, 34);
    c.strokeStyle = cur ? WEAPONS[id].color : lv ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)';
    c.lineWidth = cur ? 3 : 1;
    c.strokeRect(x + 0.5, y + 0.5, 33, 33);
    c.globalAlpha = lv ? 1 : 0.3;
    text(c, WEAPONS[id].short[0], x + 17, y + 22, { size: 14, color: WEAPONS[id].color, align: 'center', stroke: null });
    for (let k = 0; k < 3; k++) { c.fillStyle = k < lv ? WEAPONS[id].color : 'rgba(255,255,255,0.15)'; c.fillRect(x + 6 + k * 8, y + 28, 6, 3); }
    c.globalAlpha = 1;
  });
  text(c, `${WEAPONS[p.weapon].name.toUpperCase()}  LV${p.levels[p.weapon]}`, W - 14, H - 58, { size: 8, color: WEAPONS[p.weapon].color, align: 'right' });
  // Schild / Speed / Zeitlupe / Magnet
  const icons = [];
  if (p.speedLvl) icons.push(['»'.repeat(p.speedLvl), '#ffe36a', 1]);
  if (p.slowmo > 0) icons.push(['ZEITLUPE', '#6dff6d', p.slowmo / 7]);
  if (p.magnet > 0) icons.push(['MAGNET', '#ff7b7b', p.magnet / 14]);
  if (p.carlton > 0) icons.push(['CARLTON', '#ff5fd2', p.carlton / 6]);
  icons.forEach(([label, color, frac], i) => {
    const y = H - 96 - i * 14;
    text(c, label, W - 14, y, { size: 7, color, align: 'right', stroke: '#0a0630' });
    c.fillStyle = color;
    c.fillRect(W - 14 - 60, y + 3, Math.round(60 * clamp(frac, 0, 1)), 2);
  });
  // Schild-Energie
  c.fillStyle = 'rgba(10,6,48,0.7)';
  c.fillRect(W / 2 - 100, H - 22, 200, 12);
  c.fillStyle = p.hp < 35 ? '#ff4b3c' : '#4dffb0';
  c.fillRect(W / 2 - 98, H - 20, Math.round(196 * p.hp / 100), 8);
  text(c, 'SCHILD', W / 2 - 106, H - 12, { size: 6, color: '#9fb4ff', align: 'right', stroke: null });
  if (p.charge > 0) {
    c.fillStyle = 'rgba(10,6,48,0.7)';
    c.fillRect(W / 2 - 100, H - 38, 200, 10);
    c.fillStyle = p.charge >= 1 ? (Math.floor(t * 10) % 2 ? '#ffffff' : '#62e8ff') : '#27d3da';
    c.fillRect(W / 2 - 98, H - 36, Math.round(196 * p.charge), 6);
    if (p.charge >= 1) text(c, 'HADOUKEN!', W / 2, H - 44, { size: 8, color: '#9ffcff', align: 'center' });
  }
  if (g.combo.n >= 3) text(c, `${g.combo.n}x KOMBO`, 14, 88, { size: 9, color: '#ffe36a' });
  if (g.cheat) text(c, 'KONAMI-MODUS', W / 2, 62, { size: 8, color: '#ff5fd2', align: 'center' });
}

/* ---------------- Overlays ---------------- */

function drawBanners(g, c) {
  g.banners.forEach((b, i) => {
    const k = b.t < 0.3 ? ease(b.t / 0.3) : b.t > b.dur - 0.4 ? ease((b.dur - b.t) / 0.4) : 1;
    const y = 150 + i * 92;
    c.save();
    c.globalAlpha = k;
    c.translate(W / 2 + (1 - k) * 160, y);
    bubbleText(c, b.text, 0, 0, 52, '#ffffff', b.color, '#160d2e', 14);
    if (b.sub) text(c, b.sub, 0, 34, { size: 12, color: '#fff', align: 'center' });
    c.restore();
  });
}

function drawTransition(g, c) {
  const t = g._time;
  c.strokeStyle = 'rgba(178,160,250,0.45)';
  c.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const x = ((i * 79 - t * 680) % W + W) % W;
    c.beginPath(); c.moveTo(x, i * 21); c.lineTo(x + 110, i * 21); c.stroke();
  }
  const sector = SECTORS[g.stage];
  bubbleText(c, 'SEKTOR GESICHERT', W / 2, 200, 44, '#ffffff', '#62ffd8', '#0a1a4a', 12);
  const box = { x: 150, y: 232, w: W - 300, h: 74 };
  c.fillStyle = 'rgba(10,6,48,0.92)';
  c.fillRect(box.x, box.y, box.w, box.h);
  c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(box.x + 1.5, box.y + 1.5, box.w - 3, box.h - 3);
  c.strokeStyle = sector.color; c.strokeRect(box.x + 8, box.y + 8, box.w - 16, box.h - 16);
  wrapText(c, sector.clear, box.x + 26, box.y + 36, box.w - 52, 20, { size: 10, color: '#ffffff' });
  text(c, 'HYPERRAUM-SPRUNG …', W / 2, 340, { size: 11, color: '#ada6cc', align: 'center' });
}

export function wrapText(c, str, x, y, maxW, lineH, style) {
  c.font = `${style.size}px ${PX}`;
  const words = str.split(' ');
  let row = '';
  let yy = y;
  const flush = () => { text(c, row, x, yy, { ...style, stroke: null }); };
  for (const word of words) {
    const test = row ? `${row} ${word}` : word;
    if (c.measureText(test).width > maxW && row) { flush(); row = word; yy += lineH; } else row = test;
  }
  if (row) flush();
}

function drawPortal(g, c) {
  const dialog = g.dialog;
  const phase = dialog.phase;
  const opening = phase === 0 ? clamp(dialog.age / 0.55, 0.02, 1) : phase === 3 ? clamp(1 - dialog.age / 0.7, 0.02, 1) : 1;
  const x = 563;
  const y = 255;
  const t = g._time;
  c.save();
  c.translate(x, y);
  c.scale(opening, opening);
  const glow = c.createRadialGradient(0, 0, 10, 0, 0, 105);
  glow.addColorStop(0, 'rgba(138,79,255,0.3)');
  glow.addColorStop(1, 'rgba(95,44,196,0)');
  c.fillStyle = glow;
  c.fillRect(-105, -105, 210, 210);
  c.fillStyle = '#08071b';
  c.beginPath(); c.ellipse(0, 0, 45, 72, 0, 0, TAU); c.fill();
  c.shadowColor = '#a281ff'; c.shadowBlur = 16;
  c.strokeStyle = '#9875ff'; c.lineWidth = 5;
  c.beginPath(); c.ellipse(0, 0, 45, 72, 0, 0, TAU); c.stroke();
  c.strokeStyle = '#83faff'; c.lineWidth = 2;
  c.beginPath(); c.ellipse(0, 0, 40, 68, 0, t * 1.5, t * 1.5 + 4); c.stroke();
  c.shadowBlur = 0;
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12 + t * 1.6;
    c.fillStyle = i % 2 ? '#ad82ff' : '#97ffeb';
    c.fillRect(Math.cos(a) * 48 - 2, Math.sin(a) * 76 - 2, 4, 4);
  }
  c.restore();
  if (phase === 1 || phase === 2 || (phase === 0 && opening > 0.7)) {
    c.save();
    c.translate(x + 3, y + 6);
    c.globalAlpha = phase === 0 ? (opening - 0.7) / 0.3 : 1;
    poly(c, [[-17, -38], [0, -52], [18, -36], [23, -15], [16, -7], [24, 43], [-23, 43], [-16, -7], [-23, -15]], '#272538');
    poly(c, [[-17, -32], [0, -44], [17, -31], [12, -12], [-12, -12]], '#080a16');
    c.fillStyle = '#fb7d88'; c.fillRect(-10, -28, 20, 4);
    c.fillStyle = '#393650'; c.fillRect(-8, -10, 15, 41);
    c.fillStyle = '#69efd4'; c.fillRect(-4, 0, 7, 8);
    c.fillStyle = '#49405c'; c.fillRect(-15, 35, 9, 10); c.fillRect(6, 35, 9, 10);
    const wave = Math.sin(t * 7) * 3;
    poly(c, [[15, -3], [25, -16 + wave], [29, -32 + wave], [36, -30 + wave], [34, -10 + wave], [22, 10]], '#343046');
    c.fillStyle = '#c7a19c'; c.fillRect(28, -38 + wave, 8, 9);
    c.restore();
    text(c, 'DARTHRICK', x, y + 100, { size: 10, color: '#bca4ff', align: 'center' });
    text(c, 'MODERATOR // o7', x, y + 117, { size: 7, color: '#9fb0d4', align: 'center' });
  }
  const target = dialog.target;
  text(c, target.name.toUpperCase(), target.x, target.y - (g.boss === target ? 140 : 54), { size: 10, color: '#f6ddb2', align: 'center' });
  text(c, 'CHAT-PORTAL AKTIV · KAMPF PAUSIERT', W / 2, 66, { size: 8, color: '#9f9ebb', align: 'center' });
}

function poly(c, points, color) {
  c.fillStyle = color;
  c.beginPath();
  points.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
  c.closePath();
  c.fill();
}

/** Street-Fighter-/Mortal-Kombat-Vorstellung vor jedem Boss. */
function drawBossCard(g, c) {
  const card = g.card;
  const t = card.t;
  const sector = SECTORS[g.stage];
  const slide = ease(t / 0.4);
  c.save();
  c.fillStyle = 'rgba(6,2,20,0.88)';
  c.fillRect(0, 0, W, H);
  // Diagonale Farbflächen
  c.fillStyle = '#16305a';
  c.beginPath(); c.moveTo(0, 0); c.lineTo(W * 0.56, 0); c.lineTo(W * 0.44, H); c.lineTo(0, H); c.closePath(); c.fill();
  c.fillStyle = sector.color + '55';
  c.beginPath(); c.moveTo(W * 0.56, 0); c.lineTo(W, 0); c.lineTo(W, H); c.lineTo(W * 0.44, H); c.closePath(); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 5;
  c.beginPath(); c.moveTo(W * 0.56, 0); c.lineTo(W * 0.44, H); c.stroke();
  // Warnstreifen
  const off = (g._time * 140) % 60;
  for (const yy of [0, H - 26]) {
    c.fillStyle = '#ffd200'; c.fillRect(0, yy, W, 26);
    c.fillStyle = '#160d2e';
    for (let x = -60; x < W + 60; x += 60) { c.beginPath(); c.moveTo(x + off, yy); c.lineTo(x + off + 22, yy); c.lineTo(x + off + 2, yy + 26); c.lineTo(x + off - 20, yy + 26); c.closePath(); c.fill(); }
  }
  text(c, 'WARNING!  WARNING!  WARNING!', W / 2, 19, { size: 8, color: '#160d2e', align: 'center', stroke: null });
  // Nemesis links
  c.save();
  c.translate(-(1 - slide) * 400, 0);
  if (!drawNemesisSprite(c, 210, 56, 350, { mood: 'silent', t: g._time })) drawNemesis(c, 210, 110, 7, 'talk', g._time);
  text(c, 'PLAYER 1', 210, 440, { size: 12, color: '#62e8ff', align: 'center' });
  text(c, 'NEMESIS316', 210, 462, { size: 14, color: '#fff', align: 'center' });
  c.restore();
  // Boss rechts
  c.save();
  c.translate((1 - slide) * 520, 0);
  const sprite = getBossSprite(g.boss.kind);
  if (sprite) {
    const h = 380;
    const w = sprite.width * h / sprite.height;
    c.shadowColor = sector.color;
    c.shadowBlur = 30;
    c.drawImage(sprite, W - 250 - w / 2 + Math.sin(g._time * 2) * 3, 56, w, h);
    c.shadowBlur = 0;
  }
  text(c, `SEKTOR 0${g.stage + 1}`, W - 250, 462, { size: 10, color: sector.color, align: 'center' });
  c.restore();
  // VS
  const vs = 1 + Math.max(0, 0.6 - (t - 0.35) * 2) * (t > 0.3 ? 1 : 0) * 1.4;
  c.save();
  c.translate(W / 2 + Math.sin(t * 40) * 2, 240);
  c.scale(vs, vs);
  bubbleText(c, 'VS', 0, 40, 130, '#fff6a0', '#ff6a1c', '#160d2e', 26);
  c.restore();
  // Namensplatte
  const plate = ease((t - 0.25) / 0.3);
  c.fillStyle = 'rgba(10,6,48,0.92)';
  c.fillRect(0, 474 - 14, W, 54);
  bubbleText(c, g.boss.name.toUpperCase(), W / 2, 508, 38, '#ffffff', sector.color, '#160d2e', 9);
  c.globalAlpha = plate;
  text(c, 'ENTER: WEITER', W - 14, 40, { size: 7, color: '#fff', align: 'right', stroke: null });
  c.restore();
}

/* ---------------- Titelbild ---------------- */

/** Titelbild: Fahndungsfotos der vier Bosse rund um die geklaute Flasche. Das Logo liegt im Marquee der Seite. */
function drawTitle(g, c) {
  const t = g._time;
  text(c, '★  HIGH SCORE  ★', W / 2, 30, { size: 9, color: '#ffe36a', align: 'center' });
  text(c, String(Math.floor(g.highScore || 0)).padStart(6, '0'), W / 2, 54, { size: 14, color: '#ffffff', align: 'center' });
  // Strahlenkranz hinter der Flasche
  c.save();
  c.translate(W / 2, 190);
  for (let i = 0; i < 16; i++) {
    c.rotate(TAU / 16);
    c.fillStyle = i % 2 ? 'rgba(255,95,210,0.10)' : 'rgba(39,211,218,0.10)';
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(520, -28 - Math.sin(t + i) * 8);
    c.lineTo(520, 28 + Math.sin(t + i) * 8);
    c.closePath();
    c.fill();
  }
  c.restore();
  const bottle = getPixelImage('bottle', 60, 168);
  if (bottle) {
    c.save();
    c.shadowColor = '#7cffe8';
    c.shadowBlur = 30;
    c.drawImage(bottle, W / 2 - bottle.width / 2, 192 - bottle.height / 2 + Math.sin(t * 2) * 7);
    c.restore();
  }
  const xs = [105, 290, 670, 855];
  xs.forEach((x, i) => {
    const s = getBossSprite(i);
    const sector = SECTORS[i];
    const h = 150;
    const w = s ? s.width * h / s.height : 150;
    const y = 82 + Math.sin(t * 1.6 + i * 1.3) * 6;
    if (s) {
      c.save();
      c.shadowColor = sector.color;
      c.shadowBlur = 16;
      c.drawImage(s, Math.round(x - w / 2), Math.round(y), Math.round(w), h);
      c.restore();
    }
    text(c, 'GESUCHT', x, 76 + Math.sin(t * 1.6 + i * 1.3) * 6, { size: 7, color: '#ff4b5c', align: 'center' });
    text(c, sector.boss.toUpperCase(), x, y + h + 18, { size: 8, color: sector.color, align: 'center' });
  });
  bubbleText(c, 'OPERATION FLASCHENPOST', W / 2, 334, 36, '#ffffff', '#ffb24a', '#160d2e', 9);
  text(c, '4 SEKTOREN · 4 BOSSE · 5 WAFFEN · 1 SEHR GROSSE FLASCHE', W / 2, 360, { size: 8, color: '#d6cff0', align: 'center' });
  const ship = getSprite('ship');
  if (ship) {
    c.save();
    c.translate(Math.round(120 + Math.sin(t * 0.8) * 26), Math.round(440 + Math.sin(t * 1.3) * 10));
    const jet = 18 + Math.sin(t * 40) * 6;
    c.fillStyle = '#ff9a3c'; c.fillRect(-50 - jet, -5, jet, 10);
    c.fillStyle = '#ffe36a'; c.fillRect(-46 - jet * 0.7, -3, jet * 0.7, 6);
    c.scale(1.3, 1.3);
    c.drawImage(ship, -ship.width / 2, -ship.height / 2);
    c.restore();
  }
  ['drone', 'splitter', 'kraken'].forEach((key, i) => {
    const sp = getSprite(key);
    if (sp) c.drawImage(sp, Math.round(740 + i * 80 - sp.width / 2 + Math.sin(t * 1.5 + i) * 6), Math.round(440 + Math.sin(t * 2 + i) * 10 - sp.height / 2));
  });
  const panda = getPixelImage('panda', 52, 110);
  if (panda) c.drawImage(panda, W - 130, H - 120 + Math.sin(t * 2.2) * 3);
}

function drawScanlines(c) {
  if (!scanCanvas) {
    scanCanvas = document.createElement('canvas');
    scanCanvas.width = W;
    scanCanvas.height = H;
    const s = scanCanvas.getContext('2d');
    s.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < H; y += 3) s.fillRect(0, y, W, 1);
    const v = s.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.66);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,12,0.5)');
    s.fillStyle = v;
    s.fillRect(0, 0, W, H);
  }
  c.drawImage(scanCanvas, 0, 0);
}
