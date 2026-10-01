import { createReadStream } from 'node:fs';
import { mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import { createServer as httpCreateServer } from 'node:http';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
const STATIC_FILES = new Set([
  'index.html', 'styles.css', 'app.js', 'game.js', 'favicon.svg',
  'content.js', 'analytics.js', 'sprites.js', 'enemies.js', 'weapons.js', 'bosses.js', 'intro.js', 'render.js', 'audio.js',
]);
const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function jsonResponse(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function safeHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), fullscreen=(self)');
  response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
}

function errorMessage(error) {
  return error instanceof Error ? error.message : 'Unbekannter Serverfehler';
}

function parseBasePath(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || trimmed === '/') return '';
  return `/${trimmed.split('/').filter(Boolean).join('/')}`;
}

async function readScores(dataFile) {
  try {
    const parsed = JSON.parse(await readFile(dataFile, 'utf8'));
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry === 'object') : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

const MAX_SCORE = 1_000_000;

function validateScore(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Erwarte ein JSON-Objekt.';
  if (typeof input.name !== 'string') return 'Name muss Text sein.';
  const normalizedName = input.name.normalize('NFC');
  if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(normalizedName)) return 'Name darf keine Steuerzeichen oder Zeilenumbrüche enthalten.';
  const name = normalizedName.trim();
  if (!name || [...name].length > 18) return 'Name muss 1 bis 18 Zeichen enthalten.';
  if (!Number.isInteger(input.score) || input.score < 0 || input.score > MAX_SCORE) return `Score muss eine ganze Zahl zwischen 0 und ${MAX_SCORE} sein.`;
  if (!Number.isInteger(input.stage) || input.stage < 1 || input.stage > 4) return 'Stage muss eine ganze Zahl zwischen 1 und 4 sein.';
  if (input.won !== undefined && typeof input.won !== 'boolean') return 'Won muss true oder false sein.';
  if (input.won === true && input.stage !== 4) return 'Ein gewonnenes Spiel muss in Sektor 4 enden.';
  return { name, score: input.score, stage: input.stage, won: input.won ?? false, date: new Date().toISOString() };
}

async function readRequestBody(request, limit = 4096) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Anfrage ist zu groß (maximal 4 KB).'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Ungültiges JSON.'), { status: 400 });
  }
}

function isInside(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

/** Einfaches Fenster-Limit pro Client-Adresse (nur für Schreibzugriffe). */
function createLimiter({ max, windowMs }) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    if (hits.size > 2000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) { entry = { count: 0, reset: now + windowMs }; hits.set(key, entry); }
    entry.count++;
    return entry.count > max ? Math.ceil((entry.reset - now) / 1000) : 0;
  };
}

function clientKey(request, trustProxy) {
  if (trustProxy) {
    const forwarded = String(request.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
    if (forwarded) return forwarded.slice(0, 64);
  }
  return request.socket.remoteAddress ?? 'unknown';
}

export function createServer({
  root = PROJECT_ROOT, dataDir = join(root, 'data'), basePath = process.env.BASE_PATH ?? '',
  trustProxy = process.env.TRUST_PROXY === '1', postLimit = Number.parseInt(process.env.SCORE_POSTS_PER_MINUTE ?? '8', 10),
} = {}) {
  const limitPost = createLimiter({ max: postLimit, windowMs: 60_000 });
  const resolvedRoot = resolve(root);
  const resolvedDataDir = resolve(dataDir);
  const dataFile = join(resolvedDataDir, 'scores.json');
  const prefix = parseBasePath(basePath);
  let writeQueue = Promise.resolve();

  const server = httpCreateServer(async (request, response) => {
    safeHeaders(response);
    try {
      const url = new URL(request.url, 'http://localhost');
      let pathname = url.pathname;
      if (prefix) {
        if (pathname === prefix) {
          response.writeHead(308, { Location: `${prefix}/${url.search}`, 'Cache-Control': 'no-cache' });
          return response.end();
        }
        if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return jsonResponse(response, 404, { error: 'Nicht gefunden.' });
        pathname = pathname.slice(prefix.length) || '/';
      }
      let decoded;
      try { decoded = decodeURIComponent(pathname); } catch { return jsonResponse(response, 400, { error: 'Ungültiger Pfad.' }); }
      if (decoded.includes('\0') || decoded.includes('\\')) return jsonResponse(response, 404, { error: 'Nicht gefunden.' });

      if (decoded === '/api/scores') {
        if (request.method === 'GET') {
          const scores = (await readScores(dataFile)).slice(0, 10);
          return jsonResponse(response, 200, { scores, mode: 'server' });
        }
        if (request.method === 'POST') {
          const retryAfter = limitPost(clientKey(request, trustProxy));
          if (retryAfter) {
            response.setHeader('Retry-After', String(retryAfter));
            return jsonResponse(response, 429, { error: 'Zu viele Einträge. Bitte kurz warten.' });
          }
          if (!/^application\/json\b/i.test(request.headers['content-type'] ?? '')) return jsonResponse(response, 415, { error: 'Content-Type muss application/json sein.' });
          const input = await readRequestBody(request);
          const result = validateScore(input);
          if (typeof result === 'string') return jsonResponse(response, 400, { error: result });
          const save = async () => {
            const scores = await readScores(dataFile);
            scores.push(result);
            scores.sort((a, b) => b.score - a.score);
            const topScores = scores.slice(0, 10);
            await mkdir(resolvedDataDir, { recursive: true });
            const temporary = `${dataFile}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
            await writeFile(temporary, `${JSON.stringify(topScores, null, 2)}\n`, { mode: 0o600 });
            await rename(temporary, dataFile);
            return topScores;
          };
          const pending = writeQueue.then(save);
          writeQueue = pending.catch(() => {});
          const scores = await pending;
          return jsonResponse(response, 201, { scores, mode: 'server' });
        }
        response.setHeader('Allow', 'GET, POST');
        return jsonResponse(response, 405, { error: 'Methode nicht erlaubt.' });
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.setHeader('Allow', 'GET, HEAD');
        return jsonResponse(response, 405, { error: 'Methode nicht erlaubt.' });
      }
      let relativePath;
      if (decoded === '/' || decoded === '/index.html') relativePath = 'index.html';
      else {
        const normalized = decoded.replace(/^\/+/, '');
        const segments = normalized.split('/');
        if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return jsonResponse(response, 404, { error: 'Nicht gefunden.' });
        if (segments.length === 1 && STATIC_FILES.has(segments[0])) relativePath = segments[0];
        else if (segments[0] === 'assets' && segments.length >= 2) {
          const allowed = MIME_TYPES.has(extname(normalized).toLowerCase());
          if (!allowed || segments.some((segment) => segment.startsWith('.')) || segments[2] === 'raw') return jsonResponse(response, 404, { error: 'Nicht gefunden.' });
          relativePath = normalized;
        }
        else return jsonResponse(response, 404, { error: 'Nicht gefunden.' });
      }

      const filePath = resolve(resolvedRoot, relativePath);
      if (!isInside(resolvedRoot, filePath)) return jsonResponse(response, 404, { error: 'Nicht gefunden.' });
      let actualPath;
      try { actualPath = await realpath(filePath); } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return jsonResponse(response, 404, { error: 'Nicht gefunden.' });
        throw error;
      }
      if (!isInside(resolvedRoot, actualPath)) return jsonResponse(response, 404, { error: 'Nicht gefunden.' });
      if (relativePath.startsWith(`assets${sep}`) && !isInside(join(resolvedRoot, 'assets'), actualPath)) return jsonResponse(response, 404, { error: 'Nicht gefunden.' });
      const fileInfo = await stat(actualPath);
      if (!fileInfo.isFile()) return jsonResponse(response, 404, { error: 'Nicht gefunden.' });
      response.writeHead(200, {
        'Content-Type': MIME_TYPES.get(extname(actualPath).toLowerCase()) ?? 'application/octet-stream',
        'Content-Length': fileInfo.size,
        'Cache-Control': relativePath.startsWith(`assets${sep}`) ? 'public, max-age=3600' : 'no-cache',
      });
      if (request.method === 'HEAD') return response.end();
      createReadStream(actualPath).pipe(response);
    } catch (error) {
      if (response.headersSent) return response.destroy(error);
      const status = error.status ?? 500;
      jsonResponse(response, status, { error: status >= 500 ? 'Serverfehler beim Verarbeiten der Anfrage.' : errorMessage(error) });
    }
  });
  server.headersTimeout = 15_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 50;
  return server;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && pathToFileURL(invokedPath).href === import.meta.url) {
  const host = process.env.HOST || '0.0.0.0';
  const port = Number.parseInt(process.env.PORT || '3000', 10);
  const server = createServer();
  server.listen(port, host, () => console.log(`Neme-Type läuft unter http://${host}:${port}${parseBasePath(process.env.BASE_PATH)}`));
}
