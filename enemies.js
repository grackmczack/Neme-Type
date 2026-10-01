// Gegner-KI, Formationen und Zeichnen. Jeder Typ hat ein eigenes Verhalten, nicht nur eine andere Optik.
import { W, H, TAU, clamp, random, pick, ENEMY_TYPES } from './content.js';
import { getSprite } from './sprites.js';

export const FLOOR_Y = H - 38;
export const CEIL_Y = 30;
export const TERRAIN_SPEED = 70;

const aim = (g, e, ox = 0) => Math.atan2(g.player.y - e.y, g.player.x - (e.x + ox));
const inView = (e) => e.x < W - 40 && e.x > 120;

export const AI = {
  drone: {
    update(g, e, dt) {
      e.x -= e.speed * dt;
      e.y = clamp(e.baseY + Math.sin(e.age * 1.7 + e.phase) * 52, 55, FLOOR_Y - 30);
      e.shotTimer -= dt;
      if (e.shotTimer <= 0 && inView(e)) {
        g.enemyBullet(e.x - 18, e.y, aim(g, e), 150 + g.stage * 12, e.color);
        e.shotTimer = random(2.1, 3.4) / g.settings.speed;
      }
    },
  },

  diver: {
    init(g, e) { e.s.mode = 'enter'; e.s.stop = random(560, 780); e.s.t = 0; },
    update(g, e, dt) {
      const s = e.s;
      if (s.mode === 'enter') {
        e.x -= 190 * dt;
        e.y += (e.baseY - e.y) * Math.min(1, dt * 3);
        if (e.x < s.stop) { s.mode = 'lock'; s.t = 0; g.sound('warn'); }
      } else if (s.mode === 'lock') {
        s.t += dt;
        e.y += (g.player.y - e.y) * Math.min(1, dt * 2.4);
        if (s.t > 0.8) {
          s.mode = 'dive';
          const ang = aim(g, e);
          s.vx = Math.cos(ang) * 430; s.vy = Math.sin(ang) * 430;
        }
      } else {
        e.x += s.vx * dt; e.y += s.vy * dt;
        if (e.x < -80 || e.y < -80 || e.y > H + 80) e.gone = true;
      }
    },
  },

  splitter: {
    update(g, e, dt) {
      e.x -= 62 * dt;
      e.y = clamp(e.baseY + Math.sin(e.age * 1.1 + e.phase) * 34, 70, FLOOR_Y - 50);
      e.shotTimer -= dt;
      if (e.shotTimer <= 0 && inView(e)) {
        const a = aim(g, e);
        for (const d of [-0.28, 0, 0.28]) g.enemyBullet(e.x - 22, e.y, a + d, 135, e.color);
        e.shotTimer = random(2.4, 3.4) / g.settings.speed;
      }
    },
    onDeath(g, e) {
      for (const vy of [-130, 0, 130]) g.spawn('mini', e.x, e.y, { vx: -90, vy });
      g.burst(e.x, e.y, '#d8caff', 14);
    },
  },

  mini: {
    update(g, e, dt) {
      e.s.vx = (e.s.vx ?? -90);
      e.s.vy = (e.s.vy ?? 0) + (g.player.y - e.y) * dt * 1.6;
      e.s.vy *= 1 - Math.min(1, dt * 1.3);
      e.x += Math.min(e.s.vx, -80) * dt;
      e.y = clamp(e.y + e.s.vy * dt, 45, FLOOR_Y - 10);
    },
  },

  turret: {
    init(g, e, o) {
      e.s.side = o.side || 'floor';
      e.y = e.s.side === 'floor' ? FLOOR_Y - 14 : CEIL_Y + 14;
      e.s.burst = 0;
    },
    update(g, e, dt) {
      e.x -= TERRAIN_SPEED * dt;
      e.shotTimer -= dt;
      if (e.s.burst > 0) {
        e.s.burstT = (e.s.burstT ?? 0) - dt;
        if (e.s.burstT <= 0) {
          e.s.burst--; e.s.burstT = 0.16;
          g.enemyBullet(e.x - 14, e.y, aim(g, e), 190 + g.stage * 10, e.color);
        }
      } else if (e.shotTimer <= 0 && e.x < 760 && e.x > 140) {
        e.s.burst = 3; e.s.burstT = 0;
        e.shotTimer = random(1.9, 2.8) / g.settings.speed;
      }
    },
  },

  kraken: {
    init(g, e) { e.s.trail = []; e.s.drift = random(0, TAU); },
    update(g, e, dt) {
      e.x -= 88 * dt;
      e.y = clamp(e.baseY + Math.sin(e.age * 1.3 + e.s.drift) * 92, 60, FLOOR_Y - 40);
      e.s.trail.unshift({ x: e.x, y: e.y });
      if (e.s.trail.length > 60) e.s.trail.pop();
      e.shotTimer -= dt;
      if (e.shotTimer <= 0 && inView(e)) {
        const a = aim(g, e);
        g.enemyBullet(e.x - 20, e.y, a - 0.14, 150, e.color);
        g.enemyBullet(e.x - 20, e.y, a + 0.14, 150, e.color);
        e.shotTimer = random(2.4, 3.3) / g.settings.speed;
      }
    },
    circles(e) {
      const tr = e.s.trail;
      const list = [{ x: e.x, y: e.y, r: 22 }];
      for (let i = 1; i <= 6; i++) {
        const p = tr[Math.min(tr.length - 1, i * 8)];
        if (p) list.push({ x: p.x + i * 2, y: p.y, r: 16 - i });
      }
      return list;
    },
  },

  phaser: {
    init(g, e) { e.s.t = random(0, 1); e.s.fired = false; },
    update(g, e, dt) {
      e.x -= 98 * dt;
      e.y = clamp(e.baseY + Math.sin(e.age * 1.5 + e.phase) * 44, 60, FLOOR_Y - 40);
      e.s.t += dt;
      const cycle = 2.7;
      const phase = e.s.t % cycle;
      e.ghost = phase > 1.6;
      if (phase < 0.2) e.s.fired = false;
      if (!e.ghost && phase > 0.8 && !e.s.fired && inView(e)) {
        e.s.fired = true;
        const a = aim(g, e);
        for (const d of [-0.22, 0, 0.22]) g.enemyBullet(e.x - 16, e.y, a + d, 170, '#9dff6a');
      }
    },
  },

  shield: {
    init(g, e) { e.s.spread = 0; },
    update(g, e, dt) {
      e.x -= 54 * dt;
      e.y += clamp(g.player.y - e.y, -1, 1) * 42 * dt;
      e.y = clamp(e.y, 70, FLOOR_Y - 50);
      e.shotTimer -= dt;
      if (e.shotTimer <= 0 && inView(e)) {
        const a = aim(g, e);
        for (const d of [-0.2, 0.2]) g.enemyBullet(e.x - 26, e.y, a + d, 150, e.color);
        e.shotTimer = random(2.4, 3.2) / g.settings.speed;
      }
    },
    /** Liefert den Schadensfaktor; Schüsse von vorn (links) prallen am Schild ab. */
    shotFactor(g, e, shot) {
      if (shot.charged || shot.ignoreShield) return 1;
      if (shot.x < e.x + 4) { e.blocked = 0.15; return 0; }
      return 1.25;
    },
  },

  swarm: {
    init(g, e, o) { e.s.dir = o.dir || -1; e.s.amp = random(22, 46); e.s.freq = random(4, 6.5); },
    update(g, e, dt) {
      e.x += e.s.dir * e.speed * dt;
      e.y = clamp(e.baseY + Math.sin(e.age * e.s.freq + e.phase) * e.s.amp, 45, FLOOR_Y - 10);
      if (e.s.dir > 0 && e.x > W + 60) e.gone = true;
    },
  },

  mine: {
    init(g, e) { e.s.drop = 0.8; },
    update(g, e, dt) {
      e.x -= (e.x > 680 ? 86 : 32) * dt;
      e.y = clamp(e.baseY + Math.sin(e.age * 1.2) * 54, 70, FLOOR_Y - 50);
      e.s.drop -= dt;
      if (e.s.drop <= 0 && e.x < 900) {
        e.s.drop = 1.5 / g.settings.speed;
        g.addBullet({ kind: 'mine', x: e.x - 6, y: e.y + 6, vx: -24, vy: random(-12, 12), radius: 11, color: '#ff8fe1', age: 0, fuse: 5.2 });
        g.sound('enemy');
      }
      if (e.x < -70) e.gone = true;
    },
  },

  sniper: {
    init(g, e) { e.s.mode = 'enter'; e.s.stop = random(690, 860); e.s.cycles = 0; e.s.t = 0; },
    update(g, e, dt) {
      const s = e.s;
      if (s.mode === 'enter') {
        e.x -= 210 * dt;
        if (e.x < s.stop) { s.mode = 'aim'; s.t = 0; g.addHazard({ kind: 'hbeam', owner: e, y: g.player.y, tele: 1.15, dur: 0.4, w: 15, t: 0 }); g.sound('warn'); }
      } else if (s.mode === 'aim') {
        s.t += dt;
        e.y += (g.player.y - e.y) * Math.min(1, dt * 3);
        if (s.t > 1.6) { s.mode = 'cool'; s.t = 0; }
      } else if (s.mode === 'cool') {
        s.t += dt;
        if (s.t > 0.8) {
          s.cycles++;
          if (s.cycles >= 2) s.mode = 'leave';
          else { s.mode = 'aim'; s.t = 0; g.addHazard({ kind: 'hbeam', owner: e, y: g.player.y, tele: 1.15, dur: 0.4, w: 15, t: 0 }); g.sound('warn'); }
        }
      } else {
        e.y -= 160 * dt; e.x += 30 * dt;
        if (e.y < -60) e.gone = true;
      }
    },
  },

  healer: {
    init(g, e) { e.carrier = true; e.s.heal = 0.6; e.s.beams = []; e.s.life = 0; },
    update(g, e, dt) {
      e.s.life += dt;
      const targetX = 740 + Math.sin(e.age * 0.6) * 70;
      e.x += clamp(targetX - e.x, -90, 90) * Math.min(1, dt * 1.5);
      const fleeing = Math.hypot(g.player.x - e.x, g.player.y - e.y) < 260;
      e.y += (fleeing ? Math.sign(e.y - g.player.y || 1) * 150 : Math.sin(e.age * 1.4) * 40) * dt;
      e.y = clamp(e.y, 70, FLOOR_Y - 60);
      if (e.s.life > 20) { e.x -= 160 * dt; }
      if (e.x < -60) e.gone = true;
      e.s.heal -= dt;
      if (e.s.heal <= 0) {
        e.s.heal = 0.55;
        e.s.beams = [];
        for (const o of g.enemies) {
          if (o === e || o.hp <= 0 || o.hp >= o.maxHp || Math.hypot(o.x - e.x, o.y - e.y) > 300) continue;
          o.hp = Math.min(o.maxHp, o.hp + 0.9);
          e.s.beams.push(o);
          g.burst(o.x, o.y, '#9dff9d', 2);
        }
      }
    },
  },

  orbiter: {
    init(g, e) { e.s.cx = random(640, 820); e.s.cy = e.baseY; e.s.ang = random(0, TAU); e.s.r = 0; e.s.life = 0; e.s.fire = 1.2; e.s.enter = true; },
    update(g, e, dt) {
      const s = e.s;
      s.life += dt;
      if (s.enter) { e.x -= 200 * dt; if (e.x <= s.cx + 50) s.enter = false; return; }
      s.r = Math.min(56, s.r + dt * 50);
      s.ang += 1.9 * dt;
      e.x = s.cx + Math.cos(s.ang) * s.r;
      e.y = s.cy + Math.sin(s.ang) * s.r;
      if (s.life > 11) s.cx -= 140 * dt;
      s.fire -= dt;
      if (s.fire <= 0) {
        s.fire = 1.7 / g.settings.speed;
        for (let i = 0; i < 6; i++) g.enemyBullet(e.x, e.y, s.ang + i * TAU / 6, 125, e.color);
      }
      if (e.x < -80) e.gone = true;
    },
  },

  nokia: {
    init(g, e) { e.s.ring = 3; },
    update(g, e, dt) {
      e.x -= 38 * dt;
      e.y = clamp(e.baseY + Math.sin(e.age * 0.7) * 38, 90, FLOOR_Y - 70);
      e.shotTimer -= dt;
      e.s.ring -= dt;
      if (e.shotTimer <= 0 && inView(e)) {
        const a = aim(g, e);
        for (const d of [-0.3, 0, 0.3]) g.enemyBullet(e.x - 30, e.y, a + d, 165, e.color);
        e.shotTimer = random(1.9, 2.6) / g.settings.speed;
      }
      if (e.s.ring <= 0 && inView(e)) {
        e.s.ring = 6;
        for (let i = 0; i < 12; i++) g.enemyBullet(e.x, e.y, i * TAU / 12, 105, '#c8ffe0', 6);
        g.sound('warn');
      }
    },
    shotFactor(g, e, shot) { return shot.charged ? 1 : 0.55; },
  },

  spiral: {
    init(g, e) { e.s.mode = 'enter'; e.s.stop = random(620, 820); e.s.t = 0; e.s.ang = 0; e.s.fire = 0; e.s.life = 0; },
    update(g, e, dt) {
      const s = e.s;
      s.life += dt;
      e.rot = (e.rot || 0) + dt * 2.4;
      if (s.mode === 'enter') {
        e.x -= 170 * dt;
        if (e.x < s.stop) { s.mode = 'fire'; s.t = 0; }
      } else if (s.mode === 'fire') {
        s.t += dt; s.fire -= dt;
        if (s.fire <= 0) {
          s.fire = 0.1 / Math.sqrt(g.settings.speed);
          s.ang += 0.52;
          g.enemyBullet(e.x, e.y, s.ang, 140, e.color);
          g.enemyBullet(e.x, e.y, s.ang + Math.PI, 140, '#ff9a5a');
        }
        if (s.t > 3.6) { s.mode = 'rest'; s.t = 0; }
      } else {
        s.t += dt;
        if (s.t > 1.5) { s.mode = 'fire'; s.t = 0; }
      }
      if (s.life > 15) e.x -= 200 * dt;
      if (e.x < -80) e.gone = true;
    },
  },
};

export function hitCircles(e) {
  return AI[e.type]?.circles ? AI[e.type].circles(e) : [{ x: e.x, y: e.y, r: e.radius }];
}

/** Liegt der Gegner gerade unverwundbar / ohne Kollision (Phaser im Geistmodus)? */
export const isGhost = (e) => Boolean(e.ghost);

const FORMATIONS = {
  single(g, t) { g.spawn(t.id, 990, random(95, FLOOR_Y - 90)); },
  line(g, t) {
    const n = 4 + (g.stage > 1 ? 1 : 0);
    const by = random(115, FLOOR_Y - 120);
    for (let i = 0; i < n; i++) g.spawn(t.id, 990 + i * 62, by, { phase: i * 0.6, baseY: by });
  },
  vee(g, t) {
    const by = random(165, FLOOR_Y - 165);
    for (let i = 0; i < 5; i++) {
      const k = Math.abs(i - 2);
      g.spawn(t.id, 990 + k * 54, by + (i - 2) * 46, { phase: 0, baseY: by + (i - 2) * 46 });
    }
  },
  column(g, t) {
    const n = 3 + (g.stage > 1 ? 1 : 0);
    const gap = 92;
    const top = random(95, FLOOR_Y - 95 - gap * (n - 1));
    for (let i = 0; i < n; i++) g.spawn(t.id, 990 + i * 26, top + i * gap, { phase: i, baseY: top + i * gap });
  },
  sinepair(g, t) {
    const by = random(150, FLOOR_Y - 150);
    g.spawn(t.id, 990, by, { phase: 0, baseY: by });
    g.spawn(t.id, 990, by, { phase: Math.PI, baseY: by });
  },
  pincer(g, t) {
    g.spawn(t.id, 880, 42, { baseY: 60 });
    g.spawn(t.id, 880, FLOOR_Y - 12, { baseY: FLOOR_Y - 60 });
  },
  floor(g, t) {
    const n = g.stage > 0 ? 2 : 1;
    for (let i = 0; i < n; i++) g.spawn(t.id, 990 + i * 230, 0, { side: 'floor' });
  },
  ceiling(g, t) {
    g.spawn(t.id, 990, 0, { side: 'ceiling' });
    if (g.stage > 0) g.spawn(t.id, 1160, 0, { side: 'floor' });
  },
  behind(g, t) {
    const by = random(110, FLOOR_Y - 110);
    const n = 6 + g.stage;
    for (let i = 0; i < n; i++) g.spawn(t.id, -30 - i * 34, by + random(-16, 16), { dir: 1, baseY: by + (i % 2 ? 26 : -26), phase: i * 0.7 });
  },
  swarmfront(g, t) {
    const by = random(120, FLOOR_Y - 120);
    for (let i = 0; i < 8; i++) g.spawn(t.id, 990 + random(0, 130), by + random(-80, 80), { dir: -1, phase: random(0, TAU) });
  },
};

/** Spawnt eine Formation des gegebenen Typs. Gibt die erzeugten Gegner zurück. */
export function spawnFormation(g, type) {
  const before = g.enemies.length;
  const name = pick(type.formations.length ? type.formations : ['single']);
  FORMATIONS[name](g, type);
  return g.enemies.slice(before);
}

/* ---------- Zeichnen ---------- */

export function drawEnemy(g, c, e) {
  const t = g._time;
  const type = ENEMY_TYPES[e.type];
  const flash = e.hit > 0;
  let key = type.sprite;
  c.save();
  c.translate(Math.round(e.x), Math.round(e.y));
  if (e.ghost) c.globalAlpha = 0.22 + Math.sin(t * 20) * 0.05;

  if (e.type === 'kraken') {
    const tr = e.s.trail;
    for (let i = 6; i >= 1; i--) {
      const p = tr[Math.min(tr.length - 1, i * 8)];
      if (!p) continue;
      const seg = getSprite('krakenseg', flash);
      if (seg) c.drawImage(seg, Math.round(p.x + i * 2 - e.x - seg.width / 2), Math.round(p.y - e.y - seg.height / 2));
    }
  }

  if (e.type === 'healer') {
    c.restore();
    c.save();
    c.strokeStyle = '#9dff9d';
    c.lineWidth = 2;
    c.globalAlpha = 0.7;
    for (const o of e.s.beams || []) {
      c.setLineDash([4, 5]);
      c.lineDashOffset = -t * 40;
      c.beginPath();
      c.moveTo(e.x, e.y);
      c.lineTo(o.x, o.y);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#d8ffd8';
      c.fillRect(Math.round(o.x - 2), Math.round(o.y - 12), 4, 10);
      c.fillRect(Math.round(o.x - 5), Math.round(o.y - 9), 10, 4);
    }
    c.restore();
    c.save();
    c.translate(Math.round(e.x), Math.round(e.y));
  }

  if (e.type === 'orbiter') {
    c.strokeStyle = 'rgba(111,224,255,0.25)';
    c.setLineDash([3, 6]);
    c.beginPath();
    c.arc(e.s.cx - e.x, e.s.cy - e.y, e.s.r || 0, 0, TAU);
    c.stroke();
    c.setLineDash([]);
  }

  if (e.type === 'diver') {
    if (e.s.mode === 'dive') c.rotate(Math.atan2(e.s.vy, e.s.vx) + Math.PI);
    else if (e.s.mode === 'lock') {
      c.translate(Math.round(Math.sin(t * 60) * 1.5), 0);
      if (Math.floor(t * 12) % 2 === 0) { c.fillStyle = '#ff4b5c'; c.fillRect(-3, -40, 6, 14); c.fillRect(-3, -22, 6, 5); }
    }
  }
  if (e.type === 'spiral') c.rotate(e.rot || 0);
  if (e.type === 'nokia') c.scale(1.3, 1.3);

  if (e.type === 'turret' && e.s.side === 'ceiling') key = 'turret-ceiling';
  const sprite = getSprite(key, flash);
  if (sprite) c.drawImage(sprite, -Math.round(sprite.width / 2), -Math.round(sprite.height / 2));

  if (e.type === 'turret') {
    // Drehender Lauf, der auf den Spieler zeigt.
    const ang = Math.atan2(g.player.y - e.y, g.player.x - e.x);
    c.save();
    c.translate(0, e.s.side === 'ceiling' ? 6 : -6);
    c.rotate(ang);
    c.fillStyle = '#160d2e';
    c.fillRect(-2, -5, 28, 10);
    c.fillStyle = '#ffd0a8';
    c.fillRect(0, -3, 25, 6);
    c.fillStyle = '#b4542c';
    c.fillRect(0, 1, 25, 2);
    c.restore();
  }

  if (e.type === 'shield') {
    const pulse = 0.65 + Math.sin(t * 6) * 0.1 + (e.blocked || 0) * 3;
    c.strokeStyle = `rgba(200,150,255,${Math.min(1, pulse)})`;
    c.lineWidth = 5;
    c.shadowColor = '#c890ff';
    c.shadowBlur = 12;
    c.beginPath();
    c.arc(8, 0, 40, Math.PI * 0.62, Math.PI * 1.38);
    c.stroke();
    c.shadowBlur = 0;
  }
  c.restore();

  if (e.carrier) {
    c.save();
    c.translate(Math.round(e.x), Math.round(e.y - e.radius - 14));
    const glow = 0.6 + Math.sin(t * 9) * 0.4;
    c.fillStyle = `rgba(255,120,220,${glow})`;
    c.fillRect(-9, -7, 18, 14);
    c.fillStyle = '#fff';
    c.fillRect(-7, -5, 14, 10);
    c.fillStyle = '#ff2fa6';
    c.fillRect(-3, -3, 6, 6);
    c.restore();
  }
  if (e.hp < e.maxHp && e.maxHp >= 7 && !e.ghost) {
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(Math.round(e.x - 20), Math.round(e.y + e.radius + 8), 40, 4);
    c.fillStyle = e.hp / e.maxHp < 0.35 ? '#ff6b5c' : '#7dffb0';
    c.fillRect(Math.round(e.x - 20), Math.round(e.y + e.radius + 8), Math.max(0, 40 * e.hp / e.maxHp), 4);
  }
}
