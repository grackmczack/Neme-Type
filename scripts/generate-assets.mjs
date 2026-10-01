// Erzeugt die KI-Grafiken (Logo, Sektor-Hintergründe, Boss-Porträts, Maskottchen) über Replicate.
// Nutzung: REPLICATE_API_TOKEN=... node scripts/generate-assets.mjs [name ...]
// Die Rohbilder landen in RAW_DIR; scripts/process-assets.sh erzeugt daraus die Spiel-Assets.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const TOKEN = process.env.REPLICATE_API_TOKEN;
if (!TOKEN) { console.error('REPLICATE_API_TOKEN fehlt im Environment.'); process.exit(1); }
const RAW_DIR = process.env.RAW_DIR || './assets/gen/raw';
const MODEL = 'alibaba/qwen-image-3';

const STYLE = '90s arcade video game art, vivid saturated colors, bold clean shapes';
const GREEN = 'on a perfectly flat solid pure green #00FF00 background, no shadows on the background, centered';

export const JOBS = {
  logo: {
    ratio: '16:9',
    prompt: `Video game title logo in huge glossy bubbly 3D chunky letters like a 90s arcade title screen. Top line: the word "NEMESIS316" in enormous cyan-to-electric-blue glossy letters with thick dark navy outline and white shine highlights. Middle line, small, in orange with dark outline: "GEGEN DIE INTERGALAKTISCHEN". Bottom line: "KILLER KIFFER" in big hot-pink to magenta glossy bubble letters with thick dark navy outline and white highlights. Exact spelling is important. Small sparkles and stars around the letters. ${GREEN}.`,
  },
  bg1: {
    ratio: '2:1',
    prompt: `Wide horizontal space background painting, colorful cosmic nebula like the Orion nebula in magenta, purple, pink and orange with swirling smoke clouds and tiny bright stars, dreamy, dark edges so game sprites stay readable, no text, no planets, no characters, ${STYLE}`,
  },
  bg2: {
    ratio: '2:1',
    prompt: `Wide horizontal space background painting, toxic green and teal nebula with glowing swirling green smoke, faint vertical digital rain code streams like the Matrix, deep dark teal shadows, stars, no text, no characters, ${STYLE}`,
  },
  bg3: {
    ratio: '2:1',
    prompt: `Wide horizontal retro cyberspace background, 1996 computer desktop in outer space: teal Windows 95 style gradient void, floating empty retro operating-system window frames with blue title bars, perspective wireframe grid floor, vaporwave magenta and cyan glow, tiny stars, no readable text, no characters, ${STYLE}`,
  },
  bg4: {
    ratio: '2:1',
    prompt: `Wide horizontal space background painting, dark menacing alien fortress silhouettes with towers on the horizon, lava-red and orange glowing nebula sky, embers floating, deep purple shadows, stars, no text, no characters, ${STYLE}`,
  },
  boss1: {
    ratio: '1:1',
    prompt: `Fighting game boss portrait: a stoned space admiral alien in a white and gold admiral uniform with droopy red eyes, huge smug grin and a cloud of purple smoke around his head, peaking cap, cartoon illustration with thick outlines, ${STYLE}, ${GREEN}`,
  },
  boss2: {
    ratio: '1:1',
    prompt: `Fighting game boss portrait: a giant green kaiju monster lizard like a Godzilla parody with a glass water bong bubbling on its back, roaring, sleepy red eyes, cartoon illustration with thick outlines, ${STYLE}, ${GREEN}`,
  },
  boss3: {
    ratio: '1:1',
    prompt: `Fighting game boss portrait: an evil giant paperclip robot with menacing googly eyes and angry eyebrows, glossy chrome metal wire body, floating with small retro computer window icons around it, cartoon illustration with thick outlines, ${STYLE}, ${GREEN}`,
  },
  boss4: {
    ratio: '1:1',
    prompt: `Fighting game boss portrait: dark lord villain in a huge black shiny space helmet and cape like a parody of a sci-fi dark helmet villain, glowing orange visor, smoking giant rolled joint-shaped scepter, cartoon illustration with thick outlines, ${STYLE}, ${GREEN}`,
  },
  panda: {
    ratio: '1:1',
    prompt: `Cute chibi panda mascot with big green glowing eyes hugging a big red glossy heart, sticker style with thick dark outline and white sticker border, ${GREEN}`,
  },
  bottle: {
    ratio: '1:1',
    prompt: `Game item icon: a huge shiny transparent sports water bottle with a teal cap and a big bold label reading "316", sparkling water drops, glowing aura and sparkles, slight heroic tilt, thick dark outline cartoon style, ${GREEN}`,
  },
};

async function api(path, init = {}) {
  const res = await fetch(`https://api.replicate.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

async function generate(name, { prompt, ratio }) {
  let prediction = await api(`/models/${MODEL}/predictions`, {
    method: 'POST',
    headers: { Prefer: 'wait=60' },
    body: JSON.stringify({ input: { prompt, aspect_ratio: ratio, negative_prompt: 'blurry, low quality, watermark, signature, photo, realistic human face' } }),
  });
  while (!['succeeded', 'failed', 'canceled'].includes(prediction.status)) {
    await new Promise((r) => setTimeout(r, 2500));
    prediction = await api(`/predictions/${prediction.id}`);
  }
  if (prediction.status !== 'succeeded') throw new Error(`${name}: ${prediction.status} ${prediction.error ?? ''}`);
  const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  const image = Buffer.from(await (await fetch(url)).arrayBuffer());
  const ext = /\.(png|jpe?g|webp)/i.exec(new URL(url).pathname)?.[1]?.toLowerCase() ?? 'png';
  await writeFile(join(RAW_DIR, `${name}.${ext}`), image);
  console.log(`✓ ${name} (${Math.round(image.length / 1024)} KB, ${ratio})`);
}

await mkdir(RAW_DIR, { recursive: true });
const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(JOBS);
const queue = [...names];
const failures = [];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const name = queue.shift();
    if (!JOBS[name]) { console.error(`Unbekannter Job: ${name}`); continue; }
    try { await generate(name, JOBS[name]); } catch (error) { failures.push(name); console.error(`✗ ${name}: ${error.message}`); }
  }
}));
if (failures.length) process.exitCode = 1;
