<?php
// Sammelt anonyme Nutzungsereignisse. Speichert weder IP noch User-Agent im Klartext, setzt keine Cookies.
// Besucher werden nur über einen täglich wechselnden Hash gezählt (kein Wiedererkennen über Tage hinweg).
declare(strict_types=1);
require dirname($_SERVER['DOCUMENT_ROOT']) . '/neme/lib.php';

function done(): never
{
    http_response_code(204);
    header('Cache-Control: no-store');
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_out(405, ['error' => 'Nur POST.'], ['Allow' => 'POST']);
}
// Do-Not-Track und Global Privacy Control auch serverseitig respektieren.
if (($_SERVER['HTTP_DNT'] ?? '') === '1' || ($_SERVER['HTTP_SEC_GPC'] ?? '') === '1') done();
$ua = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300);
if ($ua === '' || preg_match('/bot|crawl|spider|slurp|headless|lighthouse|monitor|curl|wget|python|node-fetch|axios|preview/i', $ua)) done();

$ip = client_ip();
$vid = substr(hash('sha256', hash_hmac('sha256', date('Y-m-d'), secret()) . '|' . $ip . '|' . $ua), 0, 16);
if (rate_limit('collect:' . $vid, 120, 60) > 0) done();

$in = read_json_body(2048);
$name = $in['n'] ?? '';
$props = is_array($in['d'] ?? null) ? $in['d'] : [];
$int = static fn (mixed $v, int $min, int $max): ?int => (is_int($v) && $v >= $min && $v <= $max) ? $v : null;
$flag = static fn (mixed $v): ?int => ($v === 0 || $v === 1) ? $v : null;
$enum = static fn (mixed $v, array $allowed): ?string => (is_string($v) && in_array($v, $allowed, true)) ? $v : null;

// Erlaubte Ereignisse und ihre Felder (alles andere wird verworfen).
$row = ['stage' => null, 'difficulty' => null, 'won' => null, 'score' => null, 'secs' => null, 'kills' => null, 'intro' => null, 'cheated' => null, 'flawless' => null];
$diffs = ['easy', 'normal', 'hard'];
switch ($name) {
    case 'pageview': case 'intro_done': case 'intro_skipped': case 'sound_on': case 'sound_off': case 'konami': case 'fullscreen': case 'score_saved':
        break;
    case 'game_start':
        $row['difficulty'] = $enum($props['difficulty'] ?? null, $diffs);
        $row['intro'] = $flag($props['intro'] ?? null);
        break;
    case 'sector':
        $row['stage'] = $int($props['stage'] ?? null, 1, 4);
        break;
    case 'boss_down':
        $row['stage'] = $int($props['stage'] ?? null, 1, 4);
        $row['flawless'] = $flag($props['flawless'] ?? null);
        break;
    case 'game_end':
        $row['won'] = $flag($props['won'] ?? null);
        $row['stage'] = $int($props['stage'] ?? null, 1, 4);
        $row['score'] = $int($props['score'] ?? null, 0, 1_000_000);
        $row['kills'] = $int($props['kills'] ?? null, 0, 5000);
        $row['secs'] = $int($props['secs'] ?? null, 0, 7200);
        $row['difficulty'] = $enum($props['difficulty'] ?? null, $diffs);
        $row['cheated'] = $flag($props['cheated'] ?? null);
        break;
    default:
        done();
}

$sw = $int($in['sw'] ?? null, 0, 20000) ?? 0;
$touch = ($in['t'] ?? 0) === 1;
$device = ($touch && $sw > 0 && $sw < 700) ? 'Handy' : ($touch ? 'Tablet' : 'Desktop');
$browser = match (true) {
    (bool) preg_match('~Edg/~', $ua) => 'Edge', (bool) preg_match('~OPR/|Opera~', $ua) => 'Opera',
    (bool) preg_match('~Firefox/|FxiOS~', $ua) => 'Firefox', (bool) preg_match('~Chrome/|CriOS~', $ua) => 'Chrome',
    (bool) preg_match('~Safari/~', $ua) => 'Safari', default => 'Andere',
};
$os = match (true) {
    (bool) preg_match('~Windows~', $ua) => 'Windows', (bool) preg_match('~Android~', $ua) => 'Android',
    (bool) preg_match('~iPhone|iPad|iPod~', $ua) => 'iOS', (bool) preg_match('~Mac OS X|Macintosh~', $ua) => 'macOS',
    (bool) preg_match('~Linux|X11~', $ua) => 'Linux', default => 'Andere',
};
$country = null;
if (from_cloudflare() && preg_match('/^[A-Z]{2}$/', $_SERVER['HTTP_CF_IPCOUNTRY'] ?? '')) {
    $country = $_SERVER['HTTP_CF_IPCOUNTRY'];
}
$path = is_string($in['p'] ?? null) ? substr(preg_replace('/[^\x21-\x7E]/', '', $in['p']) ?? '', 0, 100) : '/';
$ref = ($name === 'pageview' && is_string($in['r'] ?? null) && preg_match('/^[a-z0-9.-]{1,80}$/i', $in['r'])) ? strtolower($in['r']) : null;

$db = db();
$db->prepare('INSERT INTO events (ts, day, vid, type, name, path, ref, country, device, browser, os, stage, difficulty, won, score, secs, kills, intro, cheated, flawless)
              VALUES (:ts, :day, :vid, :type, :name, :path, :ref, :country, :device, :browser, :os, :stage, :difficulty, :won, :score, :secs, :kills, :intro, :cheated, :flawless)')
    ->execute([
        ':ts' => time(), ':day' => date('Y-m-d'), ':vid' => $vid, ':type' => $name === 'pageview' ? 'pv' : 'ev', ':name' => $name,
        ':path' => $path, ':ref' => $ref, ':country' => $country, ':device' => $device, ':browser' => $browser, ':os' => $os,
        ':stage' => $row['stage'], ':difficulty' => $row['difficulty'], ':won' => $row['won'], ':score' => $row['score'],
        ':secs' => $row['secs'], ':kills' => $row['kills'], ':intro' => $row['intro'], ':cheated' => $row['cheated'], ':flawless' => $row['flawless'],
    ]);
if (random_int(1, 200) === 1) {
    $db->prepare('DELETE FROM events WHERE ts < ?')->execute([time() - 400 * 86400]); // Aufbewahrung: gut ein Jahr
}
done();
