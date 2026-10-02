import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

// Prüft die PHP-Variante von API und Statistik (deploy/web) mit dem eingebauten PHP-Server.
const hasPhp = spawnSync('php', ['-v']).status === 0 && spawnSync('php', ['-r', 'exit(extension_loaded("pdo_sqlite") ? 0 : 1);']).status === 0;
const skip = hasPhp ? false : 'php mit pdo_sqlite nicht installiert';
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const servers = [];
const post = (origin, path, body, headers = JSON_HEADERS) => fetch(`${origin}${path}`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });

/** Startet eine frische Kopie der Server-Dateien (eigene Datenbank) mit dem eingebauten PHP-Server. */
async function startPhp(scoreLimit) {
  const root = await mkdtemp(join(tmpdir(), 'neme-php-'));
  await mkdir(join(root, 'httpdocs'), { recursive: true });
  await cp('deploy/web/api', join(root, 'httpdocs', 'api'), { recursive: true });
  await cp('deploy/web/analytics', join(root, 'httpdocs', 'analytics'), { recursive: true });
  await cp('deploy/web/neme', join(root, 'neme'), { recursive: true });
  // Router ersetzt die Apache-Regeln (Rewrite und Basic Auth).
  await writeFile(join(root, 'httpdocs', 'router.php'), `<?php
$p = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($p === '/api/scores') { require __DIR__ . '/api/scores.php'; return true; }
if ($p === '/api/collect') { require __DIR__ . '/api/collect.php'; return true; }
if (str_starts_with($p, '/analytics/') && isset($_SERVER['HTTP_X_TEST_AUTH'])) { $_SERVER['REMOTE_USER'] = 'admin'; }
return false;
`);
  const port = 20000 + Math.floor(Math.random() * 20000);
  const proc = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', join(root, 'httpdocs'), join(root, 'httpdocs', 'router.php')], {
    stdio: 'ignore', env: { ...process.env, NEME_SCORE_LIMIT: String(scoreLimit) },
  });
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    try { await fetch(`${origin}/api/scores`); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  servers.push({ proc, root });
  return origin;
}

let origin;
before(async () => { if (!skip) origin = await startPhp(1000); });
after(async () => {
  for (const { proc, root } of servers) { proc.kill(); await rm(root, { recursive: true, force: true }); }
});

test('php scores api: same contract as the node server', { skip }, async () => {
  assert.deepEqual(await (await fetch(`${origin}/api/scores`)).json(), { scores: [], mode: 'server' });
  const ok = await post(origin, '/api/scores', { name: '  Café 🛸  ', score: 2500, stage: 4, won: true });
  assert.equal(ok.status, 201);
  const { scores, mode } = await ok.json();
  assert.equal(mode, 'server');
  assert.deepEqual(Object.keys(scores[0]), ['name', 'score', 'stage', 'won', 'date']);
  assert.equal(scores[0].name, 'Café 🛸');
  assert.equal(scores[0].won, true);
  for (const bad of [
    { name: '', score: 1, stage: 1 }, { name: 'x'.repeat(19), score: 1, stage: 1 }, { name: 'line\nbreak', score: 1, stage: 1 },
    { name: 'zero​width', score: 1, stage: 1 }, { name: 'ok', score: 1.5, stage: 1 }, { name: 'ok', score: 1_000_001, stage: 1 },
    { name: 'ok', score: 1, stage: 5 }, { name: 'ok', score: 1, stage: 1, won: 'yes' }, { name: 'ok', score: 1, stage: 2, won: true },
  ]) assert.equal((await post(origin, '/api/scores', bad)).status, 400, JSON.stringify(bad));
  assert.equal((await post(origin, '/api/scores', '{')).status, 400);
  assert.equal((await post(origin, '/api/scores', { name: 'a'.repeat(5000) })).status, 413);
  assert.equal((await post(origin, '/api/scores', { name: 'ok', score: 1, stage: 1 }, {})).status, 415);
  assert.equal((await fetch(`${origin}/api/scores`, { method: 'DELETE' })).status, 405);
});

test('php scores api: stable ranking and per-client rate limit', { skip }, async () => {
  const limited = await startPhp(3);
  const statuses = [];
  for (let i = 0; i < 5; i++) statuses.push((await post(limited, '/api/scores', { name: `P${i}`, score: 100 - i, stage: 1 })).status);
  assert.deepEqual(statuses, [201, 201, 201, 429, 429]);
  const blocked = await post(limited, '/api/scores', { name: 'x', score: 1, stage: 1 });
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  const { scores } = await (await fetch(`${limited}/api/scores`)).json();
  assert.deepEqual(scores.map((s) => s.name), ['P0', 'P1', 'P2']);
  assert.equal((await fetch(`${limited}/api/scores`)).status, 200, 'reading stays open');
});

test('php collect: stores whitelisted events, drops junk, respects Do-Not-Track and bots', { skip }, async () => {
  const ua = { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0' };
  assert.equal((await post(origin, '/api/collect', { n: 'pageview', p: '/', r: 'example.org', sw: 1280, t: 0 }, ua)).status, 204);
  assert.equal((await post(origin, '/api/collect', { n: 'game_start', d: { difficulty: 'normal', intro: 1 }, p: '/', sw: 1280 }, ua)).status, 204);
  assert.equal((await post(origin, '/api/collect', { n: 'game_end', d: { won: 1, stage: 4, score: 53030, kills: 103, secs: 534, difficulty: 'hard', cheated: 0 }, p: '/' }, ua)).status, 204);
  assert.equal((await post(origin, '/api/collect', { n: 'twitch_click', p: '/' }, ua)).status, 204);
  assert.equal((await post(origin, '/api/collect', { n: 'evil<script>', d: { x: 1 } }, ua)).status, 204, 'unknown events are ignored');
  assert.equal((await post(origin, '/api/collect', { n: 'pageview' }, { ...ua, DNT: '1' })).status, 204);
  assert.equal((await post(origin, '/api/collect', { n: 'pageview' }, { ...ua, 'User-Agent': 'Googlebot/2.1' })).status, 204);
  assert.equal((await fetch(`${origin}/api/collect`)).status, 405);
  // Dashboard: ohne Anmeldung gesperrt, mit Anmeldung sichtbar; es zählt genau, was gespeichert wurde.
  assert.equal((await fetch(`${origin}/analytics/index.php`)).status, 403);
  const page = await fetch(`${origin}/analytics/index.php?r=30`, { headers: { 'X-Test-Auth': '1' } });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<h1>Statistik<\/h1>/);
  assert.match(html, /<span>Besucher<\/span><strong>1<\/strong>/);
  assert.match(html, /<span>Spiele gestartet<\/span><strong>1<\/strong>/);
  assert.match(html, /<span>Siege<\/span><strong>1<\/strong>/);
  assert.match(html, /53\.030/);
  assert.match(html, /example\.org/);
  assert.doesNotMatch(html, /evil|<script/i);
  assert.doesNotMatch(html, /style="/, 'no inline styles (strict CSP)');
});
