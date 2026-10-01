// Prozedurale Pixel-Sprites (Map + Palette, automatischer Outline) und geladene KI-Bilder.
// Alles lazy: beim Import wird kein DOM angefasst, damit die Simulation auch in Node testbar bleibt.
const BASE = {
  k: '#160d2e', w: '#ffffff', s: '#cdd7ee', S: '#7382a8', r: '#ff4b5c', y: '#ffe36a', o: '#ff9a3c', g: '#5dff8a',
  G: '#1f8a4a', t: '#36e0d6', p: '#ff6fd0', u: '#8a5cff', e: '#231036', L: '#c4f5a8', l: '#7fc06a', n: '#3a2a6a', d: '#0c0820',
};

const cache = new Map();
const flashCache = new Map();
export const images = {};
let loading = false;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Baut aus ASCII-Zeilen ein Sprite: Palette-Buchstaben, a/b/c = Haupt-/Schatten-/Lichtfarbe. */
function fromMap(rows, colors, scale = 3, { outline = '#160d2e' } = {}) {
  const width = Math.max(...rows.map((row) => row.length));
  const pal = { ...BASE, ...colors };
  const pad = outline ? 1 : 0;
  const small = canvas(width + pad * 2, rows.length + pad * 2);
  const c = small.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      c.fillStyle = pal[ch] || '#ff00ff';
      c.fillRect(x + pad, y + pad, 1, 1);
    }
  });
  if (outline) {
    const src = c.getImageData(0, 0, small.width, small.height);
    const out = c.createImageData(small.width, small.height);
    out.data.set(src.data);
    const solid = (x, y) => x >= 0 && y >= 0 && x < small.width && y < small.height && src.data[(y * small.width + x) * 4 + 3] > 10;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(outline.slice(i, i + 2), 16));
    for (let y = 0; y < small.height; y++) {
      for (let x = 0; x < small.width; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
          const i = (y * small.width + x) * 4;
          out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = 255;
        }
      }
    }
    c.putImageData(out, 0, 0);
  }
  const big = canvas(small.width * scale, small.height * scale);
  const bc = big.getContext('2d');
  bc.imageSmoothingEnabled = false;
  bc.drawImage(small, 0, 0, big.width, big.height);
  return big;
}

function flip(source) {
  const out = canvas(source.width, source.height);
  const c = out.getContext('2d');
  c.translate(0, source.height);
  c.scale(1, -1);
  c.drawImage(source, 0, 0);
  return out;
}

/** Reduziert ein KI-Bild auf grobe Pixel, damit es zum 16-Bit-Look passt. */
function pixelate(img, width, displayWidth) {
  const ratio = img.height / img.width;
  const small = canvas(width, Math.round(width * ratio));
  const sc = small.getContext('2d');
  sc.imageSmoothingEnabled = true;
  sc.imageSmoothingQuality = 'high';
  sc.drawImage(img, 0, 0, small.width, small.height);
  const big = canvas(Math.round(displayWidth), Math.round(displayWidth * ratio));
  const bc = big.getContext('2d');
  bc.imageSmoothingEnabled = false;
  bc.drawImage(small, 0, 0, big.width, big.height);
  return big;
}

const MAPS = {
  ship: {
    scale: 3, colors: { a: '#eef2ff', b: '#8aa0d8', c: '#ffffff' },
    rows: [
      '.....c..........................',
      '....cb..........................',
      '...cbb..........cccc............',
      '...cbbb........cwwwtc...........',
      '..cbbbbbb.....cwwwttbb..........',
      '..cbbbbbbbbbccaaaaaaabbb........',
      'oo.sbaaaaaaaaaaaaaaaaaaaabbb....',
      'yyosbaaaaaaaaaaaaaaaaaaaaaaabbbr',
      'oo.sbbbbaaaaaaaaaaaaaaaaaabbbb..',
      '...SSbbbbbbbbbbaaaaabbbbbbb.....',
      '....SSbbbbbbbbbbbbbbb...........',
      '.....SSbb...bbbSSSS.............',
      '......SS........................',
    ],
  },
  drone: {
    scale: 3, colors: { a: '#8cf5b0', b: '#3fae78', c: '#d6ffe4' },
    rows: [
      '.....yy.....yy.....',
      '....y..y...y..y....',
      '.....ccccccccc.....',
      '...ccaaaaaaaaabb...',
      '..caaaaaaaaaaaabb..',
      '.caaaLLLLLLLLaaabb.',
      '.caaaLeLLLLeLaaabb.',
      '.caaaLLLLLLLLaaabb.',
      '.caaaLLeeeeLLaaabb.',
      '..caaaLLLLLLaaabb..',
      '..caaaaaaaaaaaabb..',
      '..caaayaaraaayabb..',
      '...cbbbbbbbbbbbb...',
      '..SS..cbbbbbb..SS..',
      '.SSSS.........SSSS.',
    ],
  },
  diver: {
    scale: 3, colors: { a: '#ffbc68', b: '#c06a2c', c: '#ffe4b5' },
    rows: [
      '.........cc.....rr.',
      '........cbb...orrr.',
      '.......caab..orryr.',
      '......caaab.orryyr.',
      '...ccaaaaaabborryr.',
      '.ccaaaaaaaaabbbbrr.',
      'caaaaaweeaaaaaabbb.',
      'caaaaaweeaaaaaabbb.',
      '.ccaaaaaaaaabbbbrr.',
      '...ccaaaaaabborryr.',
      '......caaab.orryyr.',
      '.......caab..orryr.',
      '........cbb...orrr.',
      '.........cc.....rr.',
    ],
  },
  splitter: {
    scale: 3, colors: { a: '#b9a2ff', b: '#6b4bc4', c: '#e5daff' },
    rows: [
      '.......ccccccc.......',
      '.....ccaaaaaaabb.....',
      '...ccaaaaaaaaaaabb...',
      '..caaaaauuuaaaaaaabb.',
      '.caaaaauuuuuaaaaaaabb',
      '.caaaaaauuuaaaaaaaabb',
      'caaaweeaaaaaaweeaaabb',
      'caaaweeaaaaaaweeaaabb',
      'caaaaaaaaaaaaaaaaaabb',
      'caaaaaaeeeeeeaaaaaabb',
      '.caaaaaaeyyyeaaaaabb.',
      '.ccaaaaaaeeeaaaaabbb.',
      '..cbbaaaaaaaaaabbbb..',
      '...cbbbbbbbbbbbbb....',
      '.....SS.SS.SS.SS.....',
    ],
  },
  mini: {
    scale: 3, colors: { a: '#d8caff', b: '#8f74e0', c: '#ffffff' },
    rows: [
      '..cccc..',
      '.caaaab.',
      'caweaweb',
      'caweaweb',
      'caaaaaab',
      '.cbbbbb.',
      '..S..S..',
    ],
  },
  turret: {
    scale: 3, colors: { a: '#ff9f6b', b: '#b4542c', c: '#ffd0a8' },
    rows: [
      '.......cccc.......',
      '.....ccaaaabb.....',
      '....caaaaaaabb....',
      'SSSScaaaweeaabbSSS',
      'SSSSSaaaweeaabbSSS',
      '....caaaaaaabb....',
      '...cbbbbbbbbbb....',
      '..SSSSSSSSSSSSS...',
      '.SSnnnnnnnnnnnSS..',
      'SSSSSSSSSSSSSSSSS.',
    ],
  },
  kraken: {
    scale: 3, colors: { a: '#64f7ce', b: '#1fa784', c: '#c4ffee' },
    rows: [
      '....ccccccc.....',
      '..ccaaaaaaabb...',
      '.caaaaaaaaaaabb.',
      'caaaweeaaweeaabb',
      'caaaweeaaweeaabb',
      'caaaaaaaaaaaaabb',
      '.caaaeeeeeeaabb.',
      '..cbbbbbbbbbbb..',
      '...yy.yy.yy.yy..',
    ],
  },
  krakenseg: {
    scale: 3, colors: { a: '#64f7ce', b: '#1fa784', c: '#c4ffee' },
    rows: [
      '..cccc..',
      '.caaaab.',
      'caaaaaab',
      'caaaaaab',
      '.cbbbbb.',
      '..bbbb..',
    ],
  },
  phaser: {
    scale: 3, colors: { a: '#7dff9a', b: '#1f9a54', c: '#d6ffe0' },
    rows: [
      '.....ccccccc.....',
      '....caaaaaaabb...',
      '...caaaaaaaaabb..',
      '..caaGGGGGGGaabb.',
      '..caGGwwGGwwGabb.',
      '..caGGwwGGwwGabb.',
      '..caaGGGGGGGaabb.',
      '..caaaaGGGGaaabb.',
      '...caaaaaaaaabb..',
      '...cbaaabaaabb...',
      '....bbb.bb.bbb...',
      '....b...b....b...',
    ],
  },
  shield: {
    scale: 3, colors: { a: '#d394ff', b: '#7a42c4', c: '#eed6ff' },
    rows: [
      '......ccccccc......',
      '....ccaaaaaaabb....',
      '...caaaaaaaaaaabb..',
      '..caaaaaaaaaaaaabb.',
      '..caaaweeaaaaaaaabb',
      '..caaaweeaaaaaaaabb',
      '..caaaaaaaaaaaaabb.',
      '...caaaaaaaaaaabb..',
      '....cbbbbbbbbbb....',
      '.....SS.....SS.....',
    ],
  },
  swarm: {
    scale: 2, colors: { a: '#e6ff70', b: '#95b82a', c: '#ffffc8' },
    rows: [
      '.ww.....ww.',
      'wwwww.wwwww',
      '.wwwcccww..',
      '..caweaab..',
      '..caweaab..',
      '...cbbbb...',
      '....b..b...',
    ],
  },
  minelayer: {
    scale: 3, colors: { a: '#ff8fe1', b: '#b53f9a', c: '#ffd0f4' },
    rows: [
      '.....ccccccccc....',
      '...ccaaaaaaaaabb..',
      '..caaaaaaaaaaaabb.',
      '.caaaweeaaaaaaaabb',
      '.caaaweeaaaaaaaabb',
      '..caaaaaaaaaaaabb.',
      '..cbbyyyyyyyybbb..',
      '...cbbbbbbbbbb....',
      '....SS..SS..SS....',
      '....rr..rr..rr....',
    ],
  },
  sniper: {
    scale: 3, colors: { a: '#ffe866', b: '#b89a1c', c: '#fffab0' },
    rows: [
      '....ccccc.........',
      '...caaaaabb.......',
      '..caaaaaaabb......',
      'SSSSSSSSSSSSSSSSSS',
      'SSSSSSSSSSSSSSSSSS',
      '..caaweeaaaabb....',
      '..caaweeaaaabb....',
      '...cbaaaaabb......',
      '....cbbbbb........',
      '....SS..SS........',
    ],
  },
  clip: {
    scale: 3, colors: { a: '#b8e6ff', b: '#5a9ad0', c: '#ffffff' },
    rows: [
      '...cccccc...',
      '..caaaaaab..',
      '.caabbbbaab.',
      '.cab....cab.',
      '.cab.ww.cab.',
      '.cab.we.cab.',
      '.cab.ww.cab.',
      '.cab.we.cab.',
      '.cab....cab.',
      '.caabbbbaab.',
      '..caaaaaab..',
      '...bbbbbb...',
    ],
  },
  orbiter: {
    scale: 3, colors: { a: '#6fe0ff', b: '#2a8ab8', c: '#d8f6ff' },
    rows: [
      '...cccccccc...',
      '.ccaaaaaaaabb.',
      '.caaaaaaaaaabb',
      'caaaaweeaaaaab',
      'caaaaweeaaaaab',
      'caaaaaaaaaaaab',
      '.caaaaaaaaaabb',
      '..cbbbbbbbbb..',
      '..yy......yy..',
    ],
  },
  nokia: {
    scale: 3, colors: { a: '#9fc4b0', b: '#56806e', c: '#d8ede2' },
    rows: [
      '...cccccccccccc...',
      '..caaaaaaaaaaaabb.',
      '.caaaaaaaaaaaaaabb',
      '.caaLLLLLLLLLLaabb',
      '.caaLeeLeeLeeLaabb',
      '.caaLLLLLLLLLLaabb',
      '.caaLLeeeeeeLLaabb',
      '.caaaaaaaaaaaaaabb',
      '.caaaSSaaaaSSaaabb',
      '.caaaaaaaaaaaaaabb',
      '.caaSSaaSSaaSSaabb',
      '.caaaaaaaaaaaaaabb',
      '.caaSSaaSSaaSSaabb',
      '..cbbbbbbbbbbbbbb.',
    ],
  },
  spiral: {
    scale: 3, colors: { a: '#ffd27a', b: '#c18a1c', c: '#fff0c4' },
    rows: [
      '.....rr.....',
      '....rooo....',
      '...cccccc...',
      '.ccaaaaaabb.',
      'caaaaaaaaaab',
      'caaaweeaaaab',
      'caaaweeaaaab',
      'caaaaaaaaaab',
      '.cbbbbbbbbb.',
      '...SS..SS...',
    ],
  },
  bottle: {
    scale: 3, colors: { a: '#8fe8ee', b: '#3a9aa8', c: '#e8ffff' },
    rows: [
      '..ttt..',
      '..SSS..',
      '.cccbb.',
      'caaaabb',
      'caaaabb',
      'cwnnnbb',
      'cn316nb',
      'cwnnnbb',
      'caaaabb',
      'caaaabb',
      '.cbbbb.',
    ],
  },
  heart: {
    scale: 2, colors: { a: '#ff4b7a', b: '#b01e4a', c: '#ffc0d0' },
    rows: [
      '.cc..cc.',
      'caaccaab',
      'caaaaaab',
      '.caaaab.',
      '..cabb..',
      '...bb...',
    ],
  },
  cork: {
    scale: 2, colors: { a: '#ffd84a', b: '#c08a10', c: '#fff6b0' },
    rows: [
      '.cccc.',
      'caaaab',
      'cabbab',
      'caaaab',
      '.bbbb.',
    ],
  },
  force: {
    scale: 3, colors: { a: '#7ac8ff', b: '#3a70c4', c: '#e8f8ff' },
    rows: [
      '..cccc..',
      '.caaaab.',
      'caawwaab',
      'caawyaab',
      'caaaaaab',
      '.cbbbb..',
    ],
  },
};

export function getSprite(key, flash = false) {
  if (typeof document === 'undefined') return null;
  if (key === 'turret-ceiling') getSprite('turret');
  let sprite = cache.get(key);
  if (!sprite) {
    const map = MAPS[key];
    if (!map) return null;
    sprite = fromMap(map.rows, map.colors, map.scale);
    cache.set(key, sprite);
    if (key === 'turret') cache.set('turret-ceiling', flip(sprite));
  }
  if (!flash) return sprite;
  let white = flashCache.get(key);
  if (!white) {
    white = canvas(sprite.width, sprite.height);
    const c = white.getContext('2d');
    c.drawImage(sprite, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = 'rgba(255,255,255,0.78)';
    c.fillRect(0, 0, white.width, white.height);
    flashCache.set(key, white);
  }
  return white;
}

export function spriteSize(key) {
  const map = MAPS[key];
  if (!map) return { w: 48, h: 48 };
  const w = Math.max(...map.rows.map((row) => row.length));
  return { w: (w + 2) * map.scale, h: (map.rows.length + 2) * map.scale };
}

/** Gepixeltes Boss-Porträt (aus den KI-Bildern), gecacht. */
export function getBossSprite(index, flash = false) {
  const img = images[`boss${index + 1}`];
  if (!img || typeof document === 'undefined') return null;
  const key = `boss${index}${flash ? '-f' : ''}`;
  let sprite = cache.get(key);
  if (!sprite) {
    const base = cache.get(`boss${index}`) || pixelate(img, 92, 276);
    cache.set(`boss${index}`, base);
    if (flash) {
      sprite = canvas(base.width, base.height);
      const c = sprite.getContext('2d');
      c.drawImage(base, 0, 0);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.fillRect(0, 0, sprite.width, sprite.height);
    } else sprite = base;
    cache.set(key, sprite);
  }
  return sprite;
}

/** Sektor-Hintergrund als Vollbild-Kachel, leicht gepixelt. */
export function getBackground(index) {
  const img = images[`bg${index + 1}`];
  if (!img) return null;
  const key = `bgp${index}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = pixelate(img, 640, 1280);
    cache.set(key, sprite);
  }
  return sprite;
}

/** Lädt die KI-Grafiken; fehlen sie, läuft das Spiel mit dem Code-Hintergrund weiter. */
export function loadImages(names = ['bg1', 'bg2', 'bg3', 'bg4', 'boss1', 'boss2', 'boss3', 'boss4', 'logo', 'panda', 'bottle']) {
  if (loading || typeof Image === 'undefined') return;
  loading = true;
  for (const name of names) {
    const img = new Image();
    img.onload = () => { images[name] = img; };
    img.onerror = () => {};
    img.src = new URL(`./assets/gen/${name}.webp`, import.meta.url).href;
  }
}

/** Beliebiges geladenes KI-Bild, grob gepixelt (res = Pixelbreite vor dem Hochskalieren). */
export function getPixelImage(name, res, displayWidth) {
  const img = images[name];
  if (!img || typeof document === 'undefined') return null;
  const key = `px:${name}:${res}:${displayWidth}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = pixelate(img, res, displayWidth);
    cache.set(key, sprite);
  }
  return sprite;
}
