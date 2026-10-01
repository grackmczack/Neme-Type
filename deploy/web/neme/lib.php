<?php
// Gemeinsame Bibliothek für Highscore-API und Statistik. Liegt bewusst AUSSERHALB des Webroots (~/neme/lib.php).
declare(strict_types=1);

const NEME_DIR = __DIR__;
const NEME_DATA = NEME_DIR . '/data';
date_default_timezone_set('Europe/Berlin');

/** Cloudflare-Adressbereiche: nur von dort wird CF-Connecting-IP / CF-IPCountry geglaubt. */
const CF_RANGES = [
    '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18',
    '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
    '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
    '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
];

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    if (!is_dir(NEME_DATA)) {
        mkdir(NEME_DATA, 0700, true);
    }
    $pdo = new PDO('sqlite:' . NEME_DATA . '/neme.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=4000; PRAGMA synchronous=NORMAL;');
    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, score INTEGER NOT NULL, stage INTEGER NOT NULL,
  won INTEGER NOT NULL DEFAULT 0, date TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS scores_rank ON scores (score DESC, id ASC);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, day TEXT NOT NULL, vid TEXT NOT NULL,
  type TEXT NOT NULL, name TEXT NOT NULL, path TEXT, ref TEXT, country TEXT, device TEXT, browser TEXT, os TEXT,
  stage INTEGER, difficulty TEXT, won INTEGER, score INTEGER, secs INTEGER, kills INTEGER, intro INTEGER, cheated INTEGER, flawless INTEGER
);
CREATE INDEX IF NOT EXISTS events_day ON events (day, type, name);
CREATE TABLE IF NOT EXISTS ratelimit (k TEXT NOT NULL, w INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (k, w));
SQL);
    return $pdo;
}

/** Geheimes Salz für die täglich wechselnden Besucher-Hashes (wird beim ersten Aufruf erzeugt). */
function secret(): string
{
    $file = NEME_DIR . '/secret.key';
    if (!is_file($file)) {
        file_put_contents($file, bin2hex(random_bytes(32)), LOCK_EX);
        chmod($file, 0600);
    }
    return trim((string) file_get_contents($file));
}

function ip_in_cidr(string $ip, string $cidr): bool
{
    [$net, $bits] = explode('/', $cidr);
    $a = @inet_pton($ip);
    $b = @inet_pton($net);
    if ($a === false || $b === false || strlen($a) !== strlen($b)) {
        return false;
    }
    $bits = (int) $bits;
    $bytes = intdiv($bits, 8);
    $rest = $bits % 8;
    if ($bytes > 0 && substr($a, 0, $bytes) !== substr($b, 0, $bytes)) {
        return false;
    }
    if ($rest > 0) {
        $mask = (0xFF << (8 - $rest)) & 0xFF;
        if ((ord($a[$bytes]) & $mask) !== (ord($b[$bytes]) & $mask)) {
            return false;
        }
    }
    return true;
}

function from_cloudflare(): bool
{
    $remote = $_SERVER['REMOTE_ADDR'] ?? '';
    foreach (CF_RANGES as $range) {
        if (ip_in_cidr($remote, $range)) {
            return true;
        }
    }
    return false;
}

function client_ip(): string
{
    $remote = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $cf = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '';
    if ($cf !== '' && filter_var($cf, FILTER_VALIDATE_IP) && from_cloudflare()) {
        return $cf;
    }
    return $remote;
}

function json_out(int $status, array $payload, array $headers = []): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    foreach ($headers as $name => $value) {
        header("$name: $value");
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Fenster-Limit. Gibt 0 zurück, wenn erlaubt, sonst die Wartezeit in Sekunden. */
function rate_limit(string $key, int $max, int $window): int
{
    $db = db();
    $now = time();
    $w = intdiv($now, $window);
    $db->prepare('INSERT INTO ratelimit (k, w, n) VALUES (?, ?, 1) ON CONFLICT (k, w) DO UPDATE SET n = n + 1')->execute([$key, $w]);
    $stmt = $db->prepare('SELECT n FROM ratelimit WHERE k = ? AND w = ?');
    $stmt->execute([$key, $w]);
    $count = (int) $stmt->fetchColumn();
    if (random_int(1, 60) === 1) {
        $db->prepare('DELETE FROM ratelimit WHERE w < ?')->execute([$w - 3]);
    }
    return $count > $max ? ($w + 1) * $window - $now : 0;
}

function read_json_body(int $limit = 4096): array
{
    $raw = file_get_contents('php://input', false, null, 0, $limit + 1);
    if ($raw === false || strlen($raw) > $limit) {
        json_out(413, ['error' => 'Anfrage ist zu groß (maximal 4 KB).']);
    }
    $data = json_decode($raw, true);
    if (!is_array($data) || array_is_list($data)) {
        json_out(400, ['error' => 'Ungültiges JSON.']);
    }
    return $data;
}
