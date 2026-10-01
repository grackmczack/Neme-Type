import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import { createServer } from '../server.mjs';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
let root;
let dataDir;
let server;
let origin;

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'neme-type-root-'));
  dataDir = join(root, 'private-data');
  await mkdir(join(root, 'assets'), { recursive: true });
  await writeFile(join(root, 'index.html'), '<h1>Game</h1>');
  await writeFile(join(root, 'styles.css'), 'body { color: red; }');
  await writeFile(join(root, 'secret.txt'), 'private');
  await writeFile(join(root, 'assets', 'ship.png'), Buffer.from([137, 80, 78, 71]));
  await writeFile(join(root, 'assets', 'font.ttf'), Buffer.from([0, 1, 0, 0]));
  server = createServer({ root, dataDir, basePath: '/neme-type', postLimit: 1000 });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}/neme-type`;
});

beforeEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
  await mkdir(dataDir, { recursive: true });
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await rm(root, { recursive: true, force: true });
});

test('serves allowlisted static files with MIME types and blocks private files', async () => {
  const page = await fetch(`${origin}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /^text\/html/);
  assert.equal(page.headers.get('cache-control'), 'no-cache');
  assert.equal(await page.text(), '<h1>Game</h1>');

  const image = await fetch(`${origin}/assets/ship.png`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');

  const font = await fetch(`${origin}/assets/font.ttf`);
  assert.equal(font.headers.get('content-type'), 'font/ttf');

  assert.equal((await fetch(`${origin}/secret.txt`)).status, 404);
  assert.equal((await fetch(`${origin}/assets/`)).status, 404);
});

test('redirects the bare base path so relative page assets resolve correctly', async () => {
  const response = await fetch(origin, { redirect: 'manual' });
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), '/neme-type/');
});

test('accepts and persists a normalized score', async () => {
  const response = await fetch(`${origin}/api/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '  Cafe\u0301 🛸  ', score: 2500, stage: 4, won: true }),
  });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.mode, 'server');
  assert.deepEqual(Object.keys(result.scores[0]), ['name', 'score', 'stage', 'won', 'date']);
  assert.equal(result.scores[0].name, 'Café 🛸');
  assert.equal(result.scores[0].won, true);
  assert.ok(Number.isFinite(Date.parse(result.scores[0].date)));

  const saved = JSON.parse(await readFile(join(dataDir, 'scores.json'), 'utf8'));
  assert.deepEqual(saved, result.scores);
  const fetched = await (await fetch(`${origin}/api/scores`)).json();
  assert.deepEqual(fetched, { scores: saved, mode: 'server' });
});

test('rejects invalid scores, malformed JSON, and oversized bodies', async () => {
  for (const score of [
    { name: '', score: 1, stage: 1 },
    { name: 'x'.repeat(19), score: 1, stage: 1 },
    { name: '🚀'.repeat(19), score: 1, stage: 1 },
    { name: 'line\nbreak', score: 1, stage: 1 },
    { name: 'ok', score: 1.5, stage: 1 },
    { name: 'ok', score: 1_000_001, stage: 1 },
    { name: 'ok', score: 1, stage: 2, won: true },
    { name: 'zero\u200Bwidth', score: 1, stage: 1 },
    { name: 'ok', score: 1, stage: 5 },
    { name: 'ok', score: 1, stage: 1, won: 'yes' },
  ]) {
    const response = await fetch(`${origin}/api/scores`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(score) });
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, 'string');
  }

  const malformed = await fetch(`${origin}/api/scores`, { method: 'POST', headers: JSON_HEADERS, body: '{' });
  assert.equal(malformed.status, 400);
  const oversized = await fetch(`${origin}/api/scores`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name: 'a'.repeat(5000) }) });
  assert.equal(oversized.status, 413);
});

test('rejects traversal and serves the API only beneath the configured base path', async () => {
  for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/assets/%2e%2e/secret.txt']) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 404);
  }
  assert.equal((await fetch(new URL('/api/scores', origin))).status, 404);
});

test('serializes concurrent submissions and retains the stable top ten', async () => {
  const requests = Array.from({ length: 14 }, (_, index) => fetch(`${origin}/api/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `P${index}`, score: index < 3 ? 200 : 100 - index, stage: 1 }),
  }));
  const responses = await Promise.all(requests);
  assert.ok(responses.every((response) => response.status === 201));
  const { scores } = await (await fetch(`${origin}/api/scores`)).json();
  assert.equal(scores.length, 10);
  assert.deepEqual(scores.map(({ score }) => score), [...scores.map(({ score }) => score)].sort((a, b) => b - a));
  const ties = scores.filter(({ score }) => score === 200).map(({ name }) => name);
  assert.deepEqual(ties, ['P0', 'P1', 'P2']);
  assert.equal(new Set(scores.map(({ name }) => name)).size, 10);
  const persisted = JSON.parse(await readFile(join(dataDir, 'scores.json'), 'utf8'));
  assert.deepEqual(persisted, scores);
});

test('sends strict security headers and a CSP without inline code', async () => {
  const response = await fetch(`${origin}/`);
  const csp = response.headers.get('content-security-policy');
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.match(response.headers.get('permissions-policy'), /camera=\(\)/);
});

test('refuses score posts without a JSON content type', async () => {
  for (const type of [undefined, 'text/plain']) {
    const response = await fetch(`${origin}/api/scores`, { method: 'POST', headers: type ? { 'Content-Type': type } : {}, body: JSON.stringify({ name: 'ok', score: 1, stage: 1 }) });
    assert.equal(response.status, 415);
  }
});

test('serves only known asset types, no dotfiles and no raw generator output', async () => {
  await mkdir(join(root, 'assets', 'gen', 'raw'), { recursive: true });
  await writeFile(join(root, 'assets', 'gen', 'raw', 'logo.png'), Buffer.from([137, 80, 78, 71]));
  await writeFile(join(root, 'assets', 'notes.md'), 'x');
  await writeFile(join(root, 'assets', '.env'), 'SECRET=1');
  await writeFile(join(root, 'assets', 'gen', 'ok.webp'), Buffer.from([82, 73, 70, 70]));
  for (const path of ['/assets/gen/raw/logo.png', '/assets/notes.md', '/assets/.env']) assert.equal((await fetch(`${origin}${path}`)).status, 404, path);
  assert.equal((await fetch(`${origin}/assets/gen/ok.webp`)).status, 200);
});

test('rate-limits score submissions per client', async () => {
  const limited = createServer({ root, dataDir, postLimit: 3 });
  await new Promise((resolve) => limited.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${limited.address().port}`;
  try {
    const statuses = [];
    for (let i = 0; i < 5; i++) {
      const response = await fetch(`${base}/api/scores`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name: `R${i}`, score: 10 + i, stage: 1 }) });
      statuses.push(response.status);
      if (response.status === 429) assert.ok(Number(response.headers.get('retry-after')) > 0);
    }
    assert.deepEqual(statuses, [201, 201, 201, 429, 429]);
    assert.equal((await fetch(`${base}/api/scores`)).status, 200, 'reading stays open');
  } finally {
    await new Promise((resolve) => limited.close(resolve));
  }
});
