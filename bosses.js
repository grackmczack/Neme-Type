// Vier Bosse mit eigener Mechanik. Körper sind gepixelte KI-Porträts (sprites.js), die Logik liegt hier.
import { W, H, TAU, clamp, random } from './content.js';
import { getBossSprite } from './sprites.js';

const aimAt = (g, b, ox = 0, oy = 0) => Math.atan2(g.player.y - (b.y + oy), g.player.x - (b.x + ox));
const inRect = (px, py, cx, cy, rx, ry) => Math.abs(px - cx) <= rx && Math.abs(py - cy) <= ry;

function enter(b, dt, targetX = 790) {
  if (b.x > targetX) b.x = Math.max(targetX, b.x - 360 * dt);
}

export const BOSSES = [
  {
    // Admiral High: Rauchzone. Fächer, Rauchring, Rauchwolken und Drohnen-Nachschub.
    size: 250, hb: { w: 190, h: 232 }, weak: { x: -8, y: -28, rx: 66, ry: 78 }, hp: 200,
    init(g, b) { b.s = { pattern: 0, pAge: 0, shot: 1.1, drones: 8, spin: 0 }; },
    update(g, b, dt) {
      const s = b.s;
      if (b.x > 790) { enter(b, dt); return; }
      b.x = 790 + Math.sin(b.age * 0.43) * 22;
      b.y = 270 + Math.sin(b.age * 0.72) * 92;
      const fury = b.hp < b.maxHp * 0.4;
      s.pAge += dt; s.shot -= dt; s.drones -= dt;
      if (s.pAge > 6.2) { s.pattern = (s.pattern + 1) % 3; s.pAge = 0; s.shot = 0.7; }
      if (s.shot <= 0) {
        if (s.pattern === 0) {
          const a = aimAt(g, b, -70);
          const n = fury ? 3 : 2;
          for (let i = -n; i <= n; i++) g.enemyBullet(b.x - 70, b.y, a + i * 0.14, fury ? 210 : 178, '#ff8e9c');
          s.shot = (fury ? 0.78 : 1.1) / g.settings.speed;
        } else if (s.pattern === 1) {
          s.spin += 0.27;
          const n = fury ? 18 : 13;
          for (let i = 0; i < n; i++) g.enemyBullet(b.x - 40, b.y - 20, i / n * TAU + s.spin, fury ? 150 : 122, '#b98bff', 9, 'smoke');
          s.shot = (fury ? 0.85 : 1.1) / g.settings.speed;
        } else {
          for (let i = 0; i < (fury ? 3 : 2); i++) g.enemyBullet(b.x - 60, b.y + random(-90, 90), Math.PI + random(-0.3, 0.3), random(55, 95), '#a57cf0', 21, 'smoke');
          s.shot = 0.9 / g.settings.speed;
        }
        g.sound('enemy');
      }
      if (s.drones <= 0) {
        s.drones = fury ? 9 : 13;
        for (let i = -1; i <= 1; i++) g.spawn('drone', b.x - 120, b.y + i * 86, { baseY: b.y + i * 86 });
      }
    },
    factor(g, b, shot) { return inRect(shot.x, shot.y, b.x + this.weak.x, b.y + this.weak.y, this.weak.rx, this.weak.ry) ? 1 : 0.22; },
    draw(g, c, b) { drawBody(g, c, b, this); },
  },

  {
    // Bongzilla: Bongwasser-Kaiju. Nur bei offenem Maul verwundbar; Flammenstrahl, Blubberbomben, Wasserglas-Beben.
    size: 282, hb: { w: 215, h: 250 }, weak: { x: -78, y: -26, rx: 58, ry: 50 }, hp: 260,
    init(g, b) { b.s = { bubble: 2.6, flame: 0, rain: 5 }; },
    update(g, b, dt) {
      const s = b.s;
      if (b.x > 800) { enter(b, dt, 800); return; }
      b.x = 800 + Math.sin(b.age * 0.4) * 24;
      b.y = 270 + Math.sin(b.age * 0.62) * 98;
      const cyc = b.age % 4.6;
      const open = cyc > 2.3;
      if (open !== b.open && open) g.sound('big');
      b.open = open;
      s.flame -= dt; s.bubble -= dt; s.rain -= dt;
      if (open && cyc < 3.8 && s.flame <= 0) {
        s.flame = 0.07 / Math.sqrt(g.settings.speed);
        const a = aimAt(g, b, -110, -26) + Math.sin(b.age * 11) * 0.13;
        g.enemyBullet(b.x - 112, b.y - 26, a, 300, '#ff9a3c', 6);
      }
      if (s.bubble <= 0) {
        s.bubble = (b.hp < b.maxHp * 0.4 ? 2.6 : 3.7) / g.settings.speed;
        const a = aimAt(g, b, -100, -10);
        for (const d of [-0.35, 0, 0.35]) g.addBullet({ kind: 'bubble', x: b.x - 100, y: b.y - 10, vx: Math.cos(a + d) * 112, vy: Math.sin(a + d) * 112, radius: 14, color: '#8fe3ff', age: 0, fuse: 1.7 });
      }
      if (b.hp < b.maxHp * 0.45 && s.rain <= 0) {
        s.rain = 0.32;
        g.addBullet({ kind: 'plain', x: random(120, 660), y: -10, vx: 0, vy: 230, radius: 5, color: '#7cd7ff' });
      }
    },
    factor(g, b, shot) {
      if (!b.open) return 0.14;
      return inRect(shot.x, shot.y, b.x + this.weak.x, b.y + this.weak.y, this.weak.rx, this.weak.ry) ? 1 : 0.3;
    },
    draw(g, c, b) {
      drawBody(g, c, b, this);
      if (b.open) {
        c.save();
        c.translate(Math.round(b.x + this.weak.x - 40), Math.round(b.y + this.weak.y));
        c.globalAlpha = 0.65 + Math.sin(g._time * 18) * 0.25;
        c.fillStyle = '#ffd27a';
        c.shadowColor = '#ff9a3c';
        c.shadowBlur = 18;
        c.beginPath();
        c.arc(0, 0, 13 + Math.sin(g._time * 25) * 3, 0, TAU);
        c.fill();
        c.restore();
      }
    },
  },

  {
    // Klammer-Koloss: teleportiert, wirft Fehlerfenster als Hindernisse, nur mit sichtbaren Augen verwundbar.
    size: 262, hb: { w: 130, h: 244 }, weak: { x: 0, y: -80, rx: 62, ry: 38 }, hp: 290,
    init(g, b) { b.s = { mode: 'visible', t: 0, next: 4.5, fan: 1.6, say: null, sayT: 0, tick: 0 }; },
    update(g, b, dt) {
      const s = b.s;
      if (b.x > 800) { enter(b, dt, 800); return; }
      const fury = b.hp < b.maxHp * 0.4;
      s.sayT -= dt;
      if (s.mode === 'visible') {
        b.y += (270 + Math.sin(b.age * 0.8) * 70 - b.y) * Math.min(1, dt * 1.5);
        s.fan -= dt;
        if (s.fan <= 0) {
          s.fan = (fury ? 1.1 : 1.6) / g.settings.speed;
          const a = aimAt(g, b, -40, -60);
          for (const d of [-0.2, 0, 0.2]) g.enemyBullet(b.x - 40, b.y - 60, a + d, 185, '#62c8ff');
          g.sound('enemy');
        }
        if (b.age > s.next) { s.mode = 'vanish'; s.t = 0; s.say = pickSay(); s.sayT = 2.6; g.sound('warn'); }
      } else if (s.mode === 'vanish') {
        s.t += dt;
        if (s.t > 0.65) {
          b.x = random(690, 850); b.y = random(150, 390);
          s.mode = 'appear'; s.t = 0;
          const n = fury ? 4 : 3;
          for (let i = 0; i < n; i++) g.addHazard({ kind: 'window', x: random(120, 620), y: random(90, 420), w: 128, h: 80, tele: 1.0, dur: 1.5, t: 0 });
          for (let i = 0; i < 10; i++) g.enemyBullet(b.x - 30, b.y, i * TAU / 10, 130, '#ff7fe6');
          g.burst(b.x, b.y, '#9ad8ff', 24);
          g.sound('portal');
        }
      } else if (s.mode === 'appear') {
        s.t += dt;
        if (s.t > 0.4) { s.mode = 'visible'; s.next = b.age + (fury ? 4.2 : 6); }
      }
    },
    factor(g, b, shot) {
      if (b.s.mode !== 'visible') return 0;
      return inRect(shot.x, shot.y, b.x + this.weak.x, b.y + this.weak.y, this.weak.rx, this.weak.ry) ? 1 : 0.28;
    },
    invulnerable(b) { return b.s.mode !== 'visible'; },
    draw(g, c, b) {
      const m = b.s.mode;
      const alpha = m === 'vanish' ? clamp(1 - b.s.t / 0.6, 0.06, 1) : m === 'appear' ? clamp(b.s.t / 0.35, 0.06, 1) : 1;
      drawBody(g, c, b, this, alpha);
      if (b.s.say && b.s.sayT > 0) {
        const text = b.s.say;
        c.save();
        c.font = '10px "Press Start 2P", monospace';
        const w = c.measureText(text).width + 22;
        const x = Math.round(Math.max(w / 2 + 10, b.x - 190));
        const y = Math.round(Math.max(70, b.y - 170));
        c.fillStyle = '#fffbe0';
        c.strokeStyle = '#160d2e';
        c.lineWidth = 3;
        c.fillRect(x - w / 2, y - 18, w, 30);
        c.strokeRect(x - w / 2, y - 18, w, 30);
        c.fillStyle = '#160d2e';
        c.textAlign = 'center';
        c.fillText(text, x, y + 2);
        c.restore();
      }
    },
  },

  {
    // Lord Dübel: drei Phasen, Laserreihen, vertikale Strahlen, FINISH HIM!
    size: 268, hb: { w: 200, h: 256 }, weak: { x: -10, y: -68, rx: 58, ry: 52 }, hp: 340,
    init(g, b) { b.s = { pattern: 0, pAge: 0, shot: 1.2, knights: 9, vbeam: 4, spiral: 0, finish: false, finishT: 0, resumed: false, ang: 0 }; },
    update(g, b, dt) {
      const s = b.s;
      if (b.x > 790) { enter(b, dt); return; }
      if (s.finish) {
        b.x = 790 + Math.sin(b.age * 40) * 3;
        s.finishT -= dt;
        if (s.finishT <= 0) { s.finish = false; s.resumed = true; b.hp = b.maxHp * 0.22; g.banner('ZU LANGSAM!', '#ff6a3d'); g.sound('warn'); }
        return;
      }
      b.x = 790 + Math.sin(b.age * 0.43) * 20;
      b.y = 270 + Math.sin(b.age * 0.7) * 96;
      const ratio = b.hp / b.maxHp;
      const phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
      if (ratio <= 0.12 && !s.resumed) {
        s.finish = true; s.finishT = 7.5;
        g.clearBullets();
        g.banner('FINISH HIM!', '#ff2f4f');
        g.sound('fatality');
        g.chat('boss', 'FINISH HIM! Ladeschuss!');
        return;
      }
      s.pAge += dt; s.shot -= dt; s.knights -= dt; s.vbeam -= dt;
      const hard = phase === 3;
      if (s.pAge > 6) { s.pattern = (s.pattern + 1) % 2; s.pAge = 0; s.shot = 0.6; }
      if (s.shot <= 0) {
        if (phase === 1 || (hard && s.pattern === 0)) {
          const a = aimAt(g, b, -70);
          const n = hard ? 4 : 3;
          for (let i = -n; i <= n; i++) g.enemyBullet(b.x - 70, b.y - 20, a + i * 0.13, hard ? 215 : 185, '#ff8e5a');
          s.shot = (hard ? 0.78 : 1.05) / g.settings.speed;
        } else if (phase === 2 || hard) {
          const off = Math.sin(b.age * 1.4) * 95;
          for (let row = 0; row < 7; row++) {
            const y = 60 + row * 70;
            if (Math.abs(y - (270 + off)) < 80) continue;
            g.enemyBullet(b.x - 50, y, Math.PI, hard ? 205 : 168, '#ffbc68', 7);
          }
          s.shot = (hard ? 0.72 : 1) / g.settings.speed;
        }
        g.sound('enemy');
      }
      if (phase >= 2) {
        s.spiral -= dt;
        if (s.spiral <= 0) {
          s.spiral = 0.16 / g.settings.speed;
          s.ang += 0.5;
          g.enemyBullet(b.x - 30, b.y, s.ang, 125, '#ff6a3d', 5);
        }
      }
      if (s.knights <= 0) {
        s.knights = hard ? 16 : 12;
        g.spawn('shield', b.x - 130, b.y - 120, { baseY: b.y - 120 });
        g.spawn('shield', b.x - 130, b.y + 120, { baseY: b.y + 120 });
      }
      if (hard && s.vbeam <= 0) {
        s.vbeam = 3.2;
        g.addHazard({ kind: 'vbeam', x: clamp(g.player.x + random(-60, 60), 100, 640), tele: 1.0, dur: 0.5, w: 30, t: 0 });
        g.sound('warn');
      }
    },
    factor(g, b, shot) {
      if (b.s.finish) return shot.charged ? 1 : 0.0;
      return inRect(shot.x, shot.y, b.x + this.weak.x, b.y + this.weak.y, this.weak.rx, this.weak.ry) ? 1 : 0.22;
    },
    protect(b, shot) { return b.s.finish && !shot.charged; },
    draw(g, c, b) {
      drawBody(g, c, b, this);
      if (b.s.finish) {
        const t = g._time;
        for (let i = 0; i < 5; i++) {
          const a = t * 4 + i * TAU / 5;
          c.fillStyle = '#ffe36a';
          c.fillRect(Math.round(b.x + Math.cos(a) * 46 - 3), Math.round(b.y - 120 + Math.sin(a) * 14 - 3), 6, 6);
        }
      }
    },
  },
];

const SAYINGS = [
  'Es sieht aus, als würden Sie verlieren.',
  'Möchten Sie Hilfe beim Sterben?',
  'Ihre Flasche wurde komprimiert.',
  'Drucken Sie Ihre Niederlage?',
];
let sayIndex = 0;
function pickSay() { return SAYINGS[sayIndex++ % SAYINGS.length]; }

function drawBody(g, c, b, def, alpha = 1) {
  const sprite = getBossSprite(b.kind, b.hit > 0);
  c.save();
  c.translate(Math.round(b.x), Math.round(b.y + Math.sin(g._time * 2.2) * 4));
  c.globalAlpha = alpha;
  if (!sprite) {
    // Fallback ohne KI-Bild: einfache Silhouette.
    c.fillStyle = b.hit > 0 ? '#fff' : '#3a2a6a';
    c.fillRect(-def.hb.w / 2, -def.hb.h / 2, def.hb.w, def.hb.h);
  } else {
    const k = def.size / sprite.width;
    const w = Math.round(sprite.width * k);
    const h = Math.round(sprite.height * k);
    c.shadowColor = g.stageColor;
    c.shadowBlur = 18;
    c.drawImage(sprite, -w / 2, -h / 2, w, h);
  }
  c.restore();
}

export function bossHit(def, b, x, y, r) {
  return Math.abs(x - b.x) < def.hb.w / 2 + r && Math.abs(y - b.y) < def.hb.h / 2 + r;
}
