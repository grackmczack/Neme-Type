// Spielerwaffen: fünf Typen mit je drei Stufen.
import { W, H, TAU } from './content.js';

const shot = (x, y, vx, vy, damage, radius, extra = {}) => ({
  x, y, vx, vy, damage, radius, charged: false, pierce: 1, hits: new Set(), life: 3, kind: 'bolt', color: '#81eefa', ...extra,
});

export function orbitCount(player) { return player.weapon === 'orbit' ? player.levels.orbit + 1 : 0; }

export function orbitPositions(player) {
  const n = orbitCount(player);
  return Array.from({ length: n }, (_, i) => {
    const a = player.orbitAngle + i * TAU / n;
    return { x: player.x + Math.cos(a) * 56, y: player.y + Math.sin(a) * 40, r: 11 };
  });
}

/** Feuert die aktuelle Waffe. Setzt den Cooldown und pusht Schüsse in g.shots. */
export function fire(g) {
  const p = g.player;
  const lv = p.levels[p.weapon];
  const out = g.shots;
  if (out.length > 260) return;
  const { x, y } = p;
  let sound = p.weapon;

  switch (p.weapon) {
    case 'aqua':
      p.cooldown = 0.17;
      if (lv === 1) out.push(shot(x + 30, y, 620, 0, 1, 5));
      else {
        out.push(shot(x + 30, y - 7, 620, 0, 0.95, 5), shot(x + 30, y + 7, 620, 0, 0.95, 5));
        if (lv >= 3) out.push(shot(x + 20, y - 12, 580, -90, 0.7, 4), shot(x + 20, y + 12, 580, 90, 0.7, 4));
      }
      break;
    case 'spread': {
      p.cooldown = 0.33;
      const n = 1 + lv * 2;
      const span = 0.16 + lv * 0.06;
      for (let i = 0; i < n; i++) {
        const a = (i - (n - 1) / 2) * span;
        out.push(shot(x + 26, y, Math.cos(a) * 560, Math.sin(a) * 560, 0.85, 4, { kind: 'pellet', color: '#ffb14a', life: 0.42 + lv * 0.1 }));
      }
      break;
    }
    case 'beam':
      p.cooldown = 0.065;
      out.push(shot(x + 34, y, 900, 0, 0.42, 4, { kind: 'jet', color: '#e8fffb', pierce: lv === 1 ? 2 : lv === 2 ? 4 : 99, life: 0.9 }));
      if (lv >= 3) out.push(shot(x + 30, y + (Math.random() < 0.5 ? -8 : 8), 900, 0, 0.3, 3, { kind: 'jet', color: '#9ffcff', pierce: 99, life: 0.9 }));
      break;
    case 'homing': {
      p.cooldown = 0.4;
      const n = lv + 1;
      for (let i = 0; i < n; i++) {
        const a = (i - (n - 1) / 2) * 0.5;
        out.push(shot(x + 18, y, Math.cos(a) * 330, Math.sin(a) * 330, 1.35, 7, { kind: 'bubble', color: '#ff8af0', homing: 4.6, life: 2.6, splash: lv >= 3 ? 46 : 0, ignoreShield: false }));
      }
      out.push(shot(x + 30, y, 600, 0, 0.5, 4));
      break;
    }
    case 'orbit':
      p.cooldown = 0.19;
      if (lv === 1) out.push(shot(x + 30, y, 620, 0, 1, 5));
      else out.push(shot(x + 30, y - 6, 620, 0, 0.9, 5), shot(x + 30, y + 6, 620, 0, 0.9, 5));
      break;
    default:
      sound = 'aqua';
  }
  if (!p.forceAttached) out.push(shot(p.forceX + 15, p.forceY, 640, 0, 0.75, 4));
  g.sound(sound);
}

/** Steuert suchende Blasen zum nächsten Ziel. */
export function steer(g, s, dt) {
  if (!s.homing) return;
  let best = null;
  let bestD = 1e9;
  const targets = g.boss ? [g.boss, ...g.enemies] : g.enemies;
  for (const t of targets) {
    if (t.hp <= 0 || t.ghost || t.x < s.x - 30 || t.x > W + 20) continue;
    const d = Math.hypot(t.x - s.x, t.y - s.y);
    if (d < bestD) { best = t; bestD = d; }
  }
  const speed = Math.hypot(s.vx, s.vy);
  let angle = Math.atan2(s.vy, s.vx);
  if (best) {
    let diff = Math.atan2(best.y - s.y, best.x - s.x) - angle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    angle += Math.max(-s.homing * dt, Math.min(s.homing * dt, diff));
  }
  s.vx = Math.cos(angle) * Math.max(speed, 330);
  s.vy = Math.sin(angle) * Math.max(speed, 330);
}

export function chargedShot(player, charge) {
  return shot(player.x + 34, player.y, 520 + charge * 180, 0, 2.5 + charge * 11, 8 + charge * 15, {
    charged: true, pierce: Infinity, kind: 'charge', energy: charge, life: 4, color: '#72defa',
  });
}

export function drawShot(c, s, t) {
  c.save();
  if (s.kind === 'charge') {
    const r = s.radius;
    c.shadowColor = '#75efff';
    c.shadowBlur = 20;
    c.fillStyle = '#72defa';
    c.beginPath();
    c.moveTo(s.x - r * 2.6, s.y);
    c.lineTo(s.x - r * 0.4, s.y - r);
    c.lineTo(s.x + r * 1.2, s.y);
    c.lineTo(s.x - r * 0.4, s.y + r);
    c.closePath();
    c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#f1ffff';
    c.fillRect(Math.round(s.x - r * 1.3), Math.round(s.y - r * 0.38), Math.round(r * 1.8), Math.round(r * 0.76));
    for (let i = 0; i < 4; i++) {
      c.fillStyle = `rgba(150,240,255,${0.5 - i * 0.1})`;
      c.fillRect(Math.round(s.x - r * 2.6 - i * 14), Math.round(s.y - 2 + Math.sin(t * 30 + i) * r * 0.3), 10, 4);
    }
  } else if (s.kind === 'bubble') {
    c.shadowColor = '#ff8af0';
    c.shadowBlur = 10;
    c.strokeStyle = '#ffb6f6';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(Math.round(s.x), Math.round(s.y), s.radius, 0, TAU);
    c.stroke();
    c.fillStyle = 'rgba(255,200,250,0.35)';
    c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#fff';
    c.fillRect(Math.round(s.x - 3), Math.round(s.y - 4), 3, 3);
  } else if (s.kind === 'pellet') {
    c.shadowColor = '#ffb14a';
    c.shadowBlur = 8;
    c.fillStyle = '#ffd08a';
    c.fillRect(Math.round(s.x - 4), Math.round(s.y - 4), 8, 8);
    c.fillStyle = '#fff';
    c.fillRect(Math.round(s.x - 2), Math.round(s.y - 2), 4, 4);
  } else if (s.kind === 'jet') {
    c.shadowColor = s.color;
    c.shadowBlur = 8;
    c.fillStyle = s.color;
    c.fillRect(Math.round(s.x - 26), Math.round(s.y - 2), 34, 4);
    c.fillStyle = '#ffffff';
    c.fillRect(Math.round(s.x - 10), Math.round(s.y - 1), 18, 2);
  } else {
    c.shadowColor = '#75efff';
    c.shadowBlur = 9;
    c.fillStyle = '#81eefa';
    c.fillRect(Math.round(s.x - 12), Math.round(s.y - 2), 19, 4);
    c.fillStyle = '#e4ffff';
    c.fillRect(Math.round(s.x - 3), Math.round(s.y - 1), 10, 2);
  }
  c.restore();
}
