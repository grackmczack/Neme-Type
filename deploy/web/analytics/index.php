<?php
// Statistik-Dashboard: Seitenverkehr und Spielnutzung. Zugriff nur mit Anmeldung (Apache Basic Auth, siehe .htaccess).
declare(strict_types=1);
require dirname($_SERVER['DOCUMENT_ROOT']) . '/neme/lib.php';

// Verteidigung in der Tiefe: ohne angemeldeten Benutzer nie etwas anzeigen, auch wenn die .htaccess-Regel ausfiele.
if (empty($_SERVER['REMOTE_USER']) && empty($_SERVER['REDIRECT_REMOTE_USER']) && empty($_SERVER['PHP_AUTH_USER'])) {
    http_response_code(403);
    exit('Zugriff verweigert.');
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

$ranges = ['heute' => ['Heute', 0], '7' => ['7 Tage', 6], '30' => ['30 Tage', 29], '90' => ['90 Tage', 89], 'alle' => ['Alles', 3650]];
$range = isset($ranges[$_GET['r'] ?? '']) ? $_GET['r'] : '7';
$since = date('Y-m-d', strtotime('-' . $ranges[$range][1] . ' days'));
$db = db();

function rows(string $sql, array $params = []): array
{
    global $db;
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}
function one(string $sql, array $params = []): mixed
{
    $row = rows($sql, $params)[0] ?? null;
    return $row ? array_values($row)[0] : 0;
}
function h(mixed $v): string { return htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function n(mixed $v): string { return number_format((float) $v, 0, ',', '.'); }
function pct(float|int $a, float|int $b): string { return $b > 0 ? number_format($a / $b * 100, 0, ',', '.') . ' %' : '–'; }
function dur(mixed $secs): string { $s = (int) round((float) $secs); return $s > 0 ? intdiv($s, 60) . ':' . str_pad((string) ($s % 60), 2, '0', STR_PAD_LEFT) . ' min' : '–'; }

/** Liste mit Balken (SVG, ohne Inline-Styles wegen strikter CSP). */
function bars(array $items, string $empty = 'Noch keine Daten.'): string
{
    if (!$items) return '<p class="empty">' . h($empty) . '</p>';
    $max = max(array_map(static fn ($i) => (float) $i[1], $items)) ?: 1;
    $out = '<ul class="bars">';
    foreach ($items as [$label, $value]) {
        $w = max(1, (int) round($value / $max * 100));
        $out .= '<li><span class="l">' . h($label) . '</span><svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="8" class="track"/><rect width="' . $w . '" height="8" class="fill"/></svg><b>' . n($value) . '</b></li>';
    }
    return $out . '</ul>';
}

/** Tagesverlauf als Balkendiagramm. */
function daily(array $days, array $series, string $cls): string
{
    $w = 640; $hgt = 120; $count = max(1, count($days));
    $max = max(1, ...(array_values($series) ?: [1]));
    $bw = $w / $count;
    $out = '<svg class="chart ' . $cls . '" viewBox="0 0 ' . $w . ' ' . ($hgt + 18) . '" role="img" aria-label="Tagesverlauf">';
    foreach ($days as $i => $day) {
        $v = $series[$day] ?? 0;
        $bh = $v > 0 ? max(2, $v / $max * $hgt) : 0;
        $x = $i * $bw;
        $out .= '<rect x="' . round($x + 1, 1) . '" y="' . round($hgt - $bh, 1) . '" width="' . max(1, round($bw - 2, 1)) . '" height="' . round($bh, 1) . '" class="bar"><title>' . h($day) . ': ' . n($v) . '</title></rect>';
    }
    $out .= '<text x="0" y="' . ($hgt + 14) . '" class="axis">' . h(substr($days[0] ?? '', 5)) . '</text><text x="' . $w . '" y="' . ($hgt + 14) . '" text-anchor="end" class="axis">' . h(substr(end($days) ?: '', 5)) . '</text><text x="' . $w . '" y="10" text-anchor="end" class="axis">max ' . n($max) . '</text></svg>';
    return $out;
}

// ----- Kennzahlen
$pv = (int) one("SELECT COUNT(*) FROM events WHERE type='pv' AND day >= ?", [$since]);
$visitors = (int) one("SELECT COUNT(DISTINCT day || vid) FROM events WHERE type='pv' AND day >= ?", [$since]);
$starts = (int) one("SELECT COUNT(*) FROM events WHERE name='game_start' AND day >= ?", [$since]);
$ends = (int) one("SELECT COUNT(*) FROM events WHERE name='game_end' AND cheated=0 AND day >= ?", [$since]);
$wins = (int) one("SELECT COUNT(*) FROM events WHERE name='game_end' AND cheated=0 AND won=1 AND day >= ?", [$since]);
$avgSecs = one("SELECT AVG(secs) FROM events WHERE name='game_end' AND cheated=0 AND day >= ?", [$since]);
$avgScore = one("SELECT AVG(score) FROM events WHERE name='game_end' AND cheated=0 AND day >= ?", [$since]);
$bestScore = (int) one("SELECT MAX(score) FROM events WHERE name='game_end' AND cheated=0 AND day >= ?", [$since]);
$players = (int) one("SELECT COUNT(DISTINCT day || vid) FROM events WHERE name='game_start' AND day >= ?", [$since]);
$introDone = (int) one("SELECT COUNT(*) FROM events WHERE name='intro_done' AND day >= ?", [$since]);
$introSkip = (int) one("SELECT COUNT(*) FROM events WHERE name='intro_skipped' AND day >= ?", [$since]);

// ----- Zeitreihen
$days = [];
for ($d = strtotime($since); $d <= strtotime(date('Y-m-d')); $d = strtotime('+1 day', $d)) $days[] = date('Y-m-d', $d);
$days = array_slice($days, -90);
$series = static function (string $sql) use ($since): array {
    $out = [];
    foreach (rows($sql, [$since]) as $r) $out[$r['day']] = (int) $r['v'];
    return $out;
};
$pvSeries = $series("SELECT day, COUNT(*) v FROM events WHERE type='pv' AND day >= ? GROUP BY day");
$startSeries = $series("SELECT day, COUNT(*) v FROM events WHERE name='game_start' AND day >= ? GROUP BY day");

// ----- Verteilungen
$top = static function (string $col, string $where = "type='pv'", int $limit = 8) use ($since): array {
    $rows = rows("SELECT COALESCE(NULLIF($col, ''), '(unbekannt)') l, COUNT(*) v FROM events WHERE $where AND day >= ? GROUP BY l ORDER BY v DESC LIMIT $limit", [$since]);
    return array_map(static fn ($r) => [$r['l'], (int) $r['v']], $rows);
};
$refs = array_map(static fn ($r) => [$r[0] === '(unbekannt)' ? '(direkt)' : $r[0], $r[1]], $top('ref'));
$diff = array_map(static fn ($r) => [['easy' => 'Entspannt', 'normal' => 'Arcade', 'hard' => 'Nemesis'][$r[0]] ?? $r[0], $r[1]], $top('difficulty', "name='game_start'"));

$funnel = [['Spiele gestartet', $starts]];
foreach ([1, 2, 3, 4] as $s) {
    if ($s > 1) $funnel[] = ['Sektor ' . $s . ' erreicht', (int) one("SELECT COUNT(*) FROM events WHERE name='sector' AND stage=? AND day >= ?", [$s, $since])];
}
$funnel[] = ['Boss 4 besiegt', (int) one("SELECT COUNT(*) FROM events WHERE name='boss_down' AND stage=4 AND day >= ?", [$since])];
$funnel[] = ['Flasche gerettet (Sieg)', $wins];
$deaths = [];
foreach (rows("SELECT stage, COUNT(*) v FROM events WHERE name='game_end' AND won=0 AND cheated=0 AND day >= ? GROUP BY stage ORDER BY stage", [$since]) as $r) $deaths[] = ['Game Over in Sektor ' . $r['stage'], (int) $r['v']];
$bossFlawless = [];
foreach (rows("SELECT stage, COUNT(*) v, SUM(flawless) f FROM events WHERE name='boss_down' AND day >= ? GROUP BY stage ORDER BY stage", [$since]) as $r) $bossFlawless[] = ['Boss ' . $r['stage'] . ' besiegt (davon ohne Treffer: ' . (int) $r['f'] . ')', (int) $r['v']];
$features = [
    ['Klick auf Twitch-Link', (int) one("SELECT COUNT(*) FROM events WHERE name='twitch_click' AND day >= ?", [$since])],
    ['Konami-Code benutzt', (int) one("SELECT COUNT(*) FROM events WHERE name='konami' AND day >= ?", [$since])],
    ['Ton eingeschaltet', (int) one("SELECT COUNT(*) FROM events WHERE name='sound_on' AND day >= ?", [$since])],
    ['Vollbild genutzt', (int) one("SELECT COUNT(*) FROM events WHERE name='fullscreen' AND day >= ?", [$since])],
    ['Score eingetragen', (int) one("SELECT COUNT(*) FROM events WHERE name='score_saved' AND day >= ?", [$since])],
];
$recent = rows("SELECT ts, name, country, device, stage, score, won, difficulty FROM events ORDER BY id DESC LIMIT 25");
$best = rows('SELECT name, score, stage, won, date FROM scores ORDER BY score DESC, id ASC LIMIT 10');
$firstSeen = one('SELECT MIN(day) FROM events');
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="refresh" content="120">
<title>Statistik · Nemesis316 gegen die intergalaktischen Killer Kiffer</title>
<link rel="stylesheet" href="dashboard.css">
</head>
<body>
<header>
  <div><p class="eyebrow">NEMESIS316 ARCADE</p><h1>Statistik</h1></div>
  <nav aria-label="Zeitraum"><?php foreach ($ranges as $key => [$label]): ?><a href="?r=<?= h($key) ?>"<?= $key === $range ? ' class="on" aria-current="page"' : '' ?>><?= h($label) ?></a><?php endforeach; ?><a class="game" href="../">Zum Spiel</a></nav>
</header>
<main>
  <section class="kpis" aria-label="Kennzahlen">
    <div><span>Besucher</span><strong><?= n($visitors) ?></strong><small>pro Tag eindeutig, kein Cookie</small></div>
    <div><span>Seitenaufrufe</span><strong><?= n($pv) ?></strong><small><?= $visitors ? number_format($pv / $visitors, 1, ',', '.') . ' je Besucher' : '–' ?></small></div>
    <div><span>Spieler</span><strong><?= n($players) ?></strong><small><?= pct($players, $visitors) ?> der Besucher</small></div>
    <div><span>Spiele gestartet</span><strong><?= n($starts) ?></strong><small><?= $players ? number_format($starts / $players, 1, ',', '.') . ' je Spieler' : '–' ?></small></div>
    <div><span>Siege</span><strong><?= n($wins) ?></strong><small><?= pct($wins, $ends) ?> der beendeten Spiele</small></div>
    <div><span>Ø Spieldauer</span><strong><?= h(dur($avgSecs)) ?></strong><small>Ø Score <?= n($avgScore) ?> · Rekord <?= n($bestScore) ?></small></div>
  </section>

  <section class="card wide"><h2>Verlauf</h2>
    <div class="two"><div><h3>Seitenaufrufe pro Tag</h3><?= daily($days, $pvSeries, 'c1') ?></div><div><h3>Gestartete Spiele pro Tag</h3><?= daily($days, $startSeries, 'c2') ?></div></div>
  </section>

  <div class="grid">
    <section class="card"><h2>Spiel-Trichter</h2><?= bars($funnel) ?><p class="note">Zählt Ereignisse, keine Personen. Intro: <?= n($introDone) ?> durchgespielt, <?= n($introSkip) ?> übersprungen (<?= pct($introDone, $introDone + $introSkip) ?> bleiben dran).</p></section>
    <section class="card"><h2>Wo es endet</h2><?= bars($deaths, 'Noch kein Game Over.') ?><h3>Bosse</h3><?= bars($bossFlawless, 'Noch kein Boss besiegt.') ?></section>
    <section class="card"><h2>Schwierigkeit</h2><?= bars($diff) ?><h3>Funktionen</h3><?= bars($features) ?></section>
    <section class="card"><h2>Top-Seiten</h2><?= bars($top('path')) ?></section>
    <section class="card"><h2>Herkunft</h2><?= bars($refs) ?></section>
    <section class="card"><h2>Länder</h2><?= bars($top('country')) ?></section>
    <section class="card"><h2>Geräte</h2><?= bars($top('device')) ?></section>
    <section class="card"><h2>Browser</h2><?= bars($top('browser')) ?></section>
    <section class="card"><h2>Betriebssysteme</h2><?= bars($top('os')) ?></section>
  </div>

  <div class="grid two-col">
    <section class="card"><h2>Hall of Flame</h2>
      <table><thead><tr><th>#</th><th>Pilot</th><th>Score</th><th>Sektor</th></tr></thead><tbody>
      <?php foreach ($best as $i => $b): ?><tr><td><?= $i + 1 ?></td><td><?= h($b['name']) ?><?= $b['won'] ? ' ✦' : '' ?></td><td><?= n($b['score']) ?></td><td><?= (int) $b['stage'] ?></td></tr><?php endforeach; ?>
      <?php if (!$best): ?><tr><td colspan="4" class="empty">Noch keine Einträge.</td></tr><?php endif; ?>
      </tbody></table></section>
    <section class="card"><h2>Letzte Ereignisse</h2>
      <table><thead><tr><th>Zeit</th><th>Ereignis</th><th>Land</th><th>Gerät</th><th>Details</th></tr></thead><tbody>
      <?php foreach ($recent as $e):
        $detail = trim(implode(' ', array_filter([$e['stage'] ? 'Sektor ' . $e['stage'] : '', $e['score'] !== null ? n($e['score']) . ' P.' : '', $e['won'] === 1 ? 'Sieg' : '', $e['difficulty'] ?? '']))); ?>
        <tr><td><?= h(date('d.m. H:i', (int) $e['ts'])) ?></td><td><?= h($e['name']) ?></td><td><?= h($e['country'] ?? '') ?></td><td><?= h($e['device']) ?></td><td><?= h($detail) ?></td></tr>
      <?php endforeach; ?>
      <?php if (!$recent): ?><tr><td colspan="5" class="empty">Noch keine Ereignisse.</td></tr><?php endif; ?>
      </tbody></table></section>
  </div>
</main>
<footer><p>Datenschutz: keine Cookies, keine gespeicherten IP-Adressen, Besucher nur über einen täglich wechselnden Hash gezählt. Do-Not-Track wird respektiert. Daten seit <?= h($firstSeen ?: 'heute') ?>, Aufbewahrung gut ein Jahr. Aktualisiert sich alle 2 Minuten.</p></footer>
</body>
</html>
