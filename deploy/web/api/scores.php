<?php
// Highscore-API. Gleicher Vertrag wie der Node-Server (server.mjs): GET liefert die Top 10, POST trägt einen Score ein.
declare(strict_types=1);
require dirname($_SERVER['DOCUMENT_ROOT']) . '/neme/lib.php';

const MAX_SCORE = 1_000_000;

/** Unicode-Normalisierung (NFC). Ohne die intl-Erweiterung werden die gängigen kombinierten Akzente von Hand zusammengesetzt. */
function nfc(string $s): string
{
    if (class_exists('Normalizer')) {
        return Normalizer::normalize($s, Normalizer::FORM_C) ?: $s;
    }
    $marks = [
        "\u{0300}" => 'ÀÈÌÒÙàèìòù', "\u{0301}" => 'ÁÉÍÓÚÝáéíóúý', "\u{0302}" => 'ÂÊÎÔÛâêîôû', "\u{0303}" => 'ÃÑÕãñõ',
        "\u{0308}" => 'ÄËÏÖÜäëïöüÿ', "\u{030A}" => 'Åå', "\u{0327}" => 'Çç',
    ];
    $bases = [
        "\u{0300}" => 'AEIOUaeiou', "\u{0301}" => 'AEIOUYaeiouy', "\u{0302}" => 'AEIOUaeiou', "\u{0303}" => 'ANOano',
        "\u{0308}" => 'AEIOUaeiouy', "\u{030A}" => 'Aa', "\u{0327}" => 'Cc',
    ];
    foreach ($marks as $mark => $composed) {
        $from = preg_split('//u', $bases[$mark], -1, PREG_SPLIT_NO_EMPTY);
        $to = preg_split('//u', $composed, -1, PREG_SPLIT_NO_EMPTY);
        foreach ($from as $i => $base) {
            $s = str_replace($base . $mark, $to[$i], $s);
        }
    }
    return $s;
}

function top_scores(): array
{
    $rows = db()->query('SELECT name, score, stage, won, date FROM scores ORDER BY score DESC, id ASC LIMIT 10')->fetchAll();
    return array_map(static fn (array $r): array => [
        'name' => $r['name'], 'score' => (int) $r['score'], 'stage' => (int) $r['stage'], 'won' => (bool) $r['won'], 'date' => $r['date'],
    ], $rows);
}

function validate(array $in): array|string
{
    if (!isset($in['name']) || !is_string($in['name'])) return 'Name muss Text sein.';
    $name = $in['name'];
    $name = nfc($name);
    if (!mb_check_encoding($name, 'UTF-8') || preg_match('/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u', $name)) return 'Name darf keine Steuerzeichen oder Zeilenumbrüche enthalten.';
    $name = preg_replace('/^\s+|\s+$/u', '', $name) ?? '';
    $length = mb_strlen($name, 'UTF-8');
    if ($length < 1 || $length > 18) return 'Name muss 1 bis 18 Zeichen enthalten.';
    if (!isset($in['score']) || !is_int($in['score']) || $in['score'] < 0 || $in['score'] > MAX_SCORE) return 'Score muss eine ganze Zahl zwischen 0 und ' . MAX_SCORE . ' sein.';
    if (!isset($in['stage']) || !is_int($in['stage']) || $in['stage'] < 1 || $in['stage'] > 4) return 'Stage muss eine ganze Zahl zwischen 1 und 4 sein.';
    if (array_key_exists('won', $in) && !is_bool($in['won'])) return 'Won muss true oder false sein.';
    $won = $in['won'] ?? false;
    if ($won === true && $in['stage'] !== 4) return 'Ein gewonnenes Spiel muss in Sektor 4 enden.';
    return ['name' => $name, 'score' => $in['score'], 'stage' => $in['stage'], 'won' => $won ? 1 : 0];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
    json_out(200, ['scores' => top_scores(), 'mode' => 'server']);
}
if ($method !== 'POST') {
    json_out(405, ['error' => 'Methode nicht erlaubt.'], ['Allow' => 'GET, POST']);
}
$retry = rate_limit('score:' . client_ip(), (int) (getenv('NEME_SCORE_LIMIT') ?: 8), 60);
if ($retry > 0) {
    json_out(429, ['error' => 'Zu viele Einträge. Bitte kurz warten.'], ['Retry-After' => (string) $retry]);
}
if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
    json_out(415, ['error' => 'Content-Type muss application/json sein.']);
}
$result = validate(read_json_body());
if (is_string($result)) {
    json_out(400, ['error' => $result]);
}
$db = db();
$db->prepare('INSERT INTO scores (name, score, stage, won, date) VALUES (?, ?, ?, ?, ?)')
    ->execute([$result['name'], $result['score'], $result['stage'], $result['won'], gmdate('Y-m-d\TH:i:s') . '.000Z']);
// Tabelle klein halten: nur die besten 200 behalten.
$db->exec('DELETE FROM scores WHERE id NOT IN (SELECT id FROM scores ORDER BY score DESC, id ASC LIMIT 200)');
json_out(201, ['scores' => top_scores(), 'mode' => 'server']);
