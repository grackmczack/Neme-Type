import { NemeGame } from './game.js';
import { track } from './analytics.js';

const $ = (id) => document.getElementById(id);
const SCORE_KEY = 'neme-type-scores-v1';
const SETTINGS_KEY = 'neme-type-settings-v1';
const scoresUrl = new URL('./api/scores', document.baseURI);
const number = (n) => Math.max(0, Math.floor(n || 0)).toLocaleString('de-DE');
const STAGES = 4;
const MAX_SCORE = 1_000_000;
let settings = { muted: true, difficulty: 'normal', name: '', intro: true };
try { settings = { ...settings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch {}
let difficulty = ['easy', 'normal', 'hard'].includes(settings.difficulty) ? settings.difficulty : 'normal';
let muted = settings.muted !== false;
let leaderboardMode = 'local';
let result = null;
let submitted = false;
let saving = false;
let runId = 0;
let toastTimer;
let continueTimer;

// Die Canvas-Texte brauchen die Pixel- und Bubble-Schrift sofort.
document.fonts?.load('12px "Press Start 2P"').catch(() => {});
document.fonts?.load('40px "Titan One"').catch(() => {});

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted, difficulty, name: $('player-name').value || settings.name, intro: $('intro-toggle').checked })); } catch {}
}
function toast(text) {
  $('toast').textContent = text;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
}
function localScores() {
  try {
    const entries = JSON.parse(localStorage.getItem(SCORE_KEY) || '[]');
    return sanitizeScores(entries);
  } catch { return []; }
}
function sanitizeScores(list) {
  return (Array.isArray(list) ? list : [])
    .filter((s) => s && typeof s.name === 'string' && Number.isFinite(s.score))
    .map((s) => ({ name: [...s.name.normalize('NFC')].slice(0, 18).join(''), score: Math.max(0, Math.min(MAX_SCORE, Math.floor(s.score))), won: s.won === true }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}
function renderLeaderboard(rawScores, mode = leaderboardMode) {
  const scores = sanitizeScores(rawScores);
  leaderboardMode = mode;
  $('leaderboard-mode').textContent = mode === 'server' ? 'SERVER' : 'LOKAL';
  $('leaderboard-note').textContent = mode === 'server' ? 'Top 10 · Gemeinsame Bestenliste auf diesem Server.' : 'Top 10 · Highscores werden in diesem Browser gespeichert.';
  $('leaderboard-list').replaceChildren();
  if (scores[0]) game.highScore = Math.max(game.highScore || 0, scores[0].score);
  if (!scores.length) {
    const empty = document.createElement('li');
    empty.className = 'leaderboard-empty';
    empty.textContent = 'Noch keine Helden. Die erste Runde gehört dir.';
    $('leaderboard-list').append(empty);
    return;
  }
  scores.slice(0, 10).forEach((entry, i) => {
    const row = document.createElement('li'); row.className = 'leaderboard-row';
    const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = String(i + 1).padStart(2, '0');
    const name = document.createElement('span'); name.className = 'leader-name'; name.textContent = entry.name;
    if (entry.won) { const medal = document.createElement('small'); medal.textContent = '✦'; medal.title = 'Flasche gerettet'; name.append(medal); }
    const score = document.createElement('span'); score.className = 'leader-score'; score.textContent = number(entry.score);
    row.append(rank, name, score); $('leaderboard-list').append(row);
  });
}
async function loadLeaderboard() {
  renderLeaderboard(localScores(), 'local');
  try {
    const response = await fetch(scoresUrl, { signal: AbortSignal.timeout(3500), cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data.scores) && data.mode === 'server') renderLeaderboard(data.scores, 'server');
  } catch {}
}

const STATUS_TEXT = {
  title: 'BEREIT ZUM ABFLUG', intro: 'INTRO LÄUFT', playing: 'MISSION LÄUFT', card: 'BOSS-VORSTELLUNG',
  dialog: 'DARTHRICK BEGRÜSST DEN CHAT', paused: 'MISSION PAUSIERT', won: 'FLASCHE WIEDER AN BORD', gameover: 'GAME OVER · SIGNAL VERLOREN',
};
function updateHud(state) {
  const live = ['playing', 'dialog', 'card', 'paused'].includes(state.status);
  $('pause-button').disabled = !live;
  $('pause-button').setAttribute('aria-label', state.status === 'paused' ? 'Spiel fortsetzen' : 'Spiel pausieren');
  $('pause-button').textContent = state.status === 'paused' ? '▶ WEITER' : 'Ⅱ PAUSE';
  $('pause-overlay').hidden = state.status !== 'paused';
  $('intro').hidden = state.status !== 'title';
  $('title-options').hidden = state.status !== 'title';
  if (state.status === 'paused') $('rick-dialog').hidden = true;
  $('flight-status').textContent = STATUS_TEXT[state.status] || 'MISSION LÄUFT';
}
function showDialog(dialog) {
  $('rick-dialog').hidden = !dialog;
  if (!dialog) return;
  const isRick = dialog.speaker === 'DarthRick' || dialog.speaker === 'rick';
  $('dialog-avatar').textContent = isRick ? 'R' : '✦';
  $('dialog-name').replaceChildren();
  $('dialog-name').append(document.createTextNode((dialog.name || (isRick ? 'DARTHRICK' : dialog.enemyName || 'GEGNER')).toUpperCase()));
  if (isRick) { const badge = document.createElement('b'); badge.textContent = 'MOD'; $('dialog-name').append(badge); }
  $('dialog-text').textContent = dialog.text;
}
function startContinueCountdown() {
  clearInterval(continueTimer);
  let n = 9;
  const paint = () => { $('continue-line').textContent = n > 0 ? `CONTINUE? ${n}` : 'INSERT COIN …'; };
  paint();
  continueTimer = setInterval(() => { n = Math.max(0, n - 1); paint(); if (n === 0) clearInterval(continueTimer); }, 1000);
}
function endGame(endResult) {
  result = endResult;
  submitted = false;
  saving = false;
  $('rick-dialog').hidden = true;
  $('pause-overlay').hidden = true;
  $('end-overlay').hidden = false;
  $('end-tag').textContent = result.won ? 'MISSION ERFÜLLT · FLASCHE ZURÜCK' : `GAME OVER · SEKTOR ${result.stage || 1}`;
  $('end-title').replaceChildren(document.createTextNode(result.won ? 'FLASCHE GERETTET!' : 'GAME OVER'));
  $('continue-line').hidden = Boolean(result.won);
  if (result.won) clearInterval(continueTimer); else startContinueCountdown();
  $('end-description').textContent = result.won
    ? 'Nemesis316 hat seine XXL-Flasche zurück. Die Killer Kiffer sitzen im Schmollwinkel. DarthRick: „Danke für den Raid!“'
    : (result.line || 'Die Killer Kiffer haben gewonnen. Fürs Erste.');
  $('end-score').textContent = number(result.score);
  $('end-kills').textContent = number(result.kills);
  $('end-stage').textContent = `${result.stage || 1} / ${STAGES}`;
  $('save-status').textContent = result.cheated ? 'Konami-Modus: Dieser Lauf kommt nicht in die Bestenliste.' : '';
  $('score-form').hidden = Boolean(result.cheated);
  $('save-score').disabled = false;
  $('save-score').textContent = 'EINTRAGEN ↗';
  $('player-name').disabled = false;
  $('player-name').value = settings.name || '';
  if (!result.cheated) setTimeout(() => $('player-name').focus({ preventScroll: true }), 50);
}

const game = new NemeGame($('game'), {
  onHud: updateHud,
  onDialog: showDialog,
  onEnd: endGame,
  onTrack: track,
  onEvent: (event) => {
    if (event?.type === 'konami') track('konami');
    if (event && ['konami', 'info'].includes(event.type) && event.text) toast(event.text);
  },
});
// Debug-Zugriff nur lokal oder mit ?debug, nicht auf einer öffentlichen Domain.
if (['localhost', '127.0.0.1'].includes(location.hostname) || new URLSearchParams(location.search).has('debug')) window.nemeGame = game;
game.setMuted(muted);

function start({ intro = false } = {}) {
  runId += 1;
  result = null;
  clearInterval(continueTimer);
  $('intro').hidden = true;
  $('end-overlay').hidden = true;
  $('pause-overlay').hidden = true;
  $('rick-dialog').hidden = true;
  $('pause-reason').textContent = 'Die Galaxie kann kurz warten.';
  saveSettings();
  game.start({ difficulty, intro });
  $('game').focus({ preventScroll: true });
}
function setDifficulty(value) {
  difficulty = value;
  document.querySelectorAll('[data-difficulty]').forEach((button) => { const active = button.dataset.difficulty === difficulty; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); });
}
setDifficulty(difficulty);
$('intro-toggle').checked = settings.intro !== false;
document.querySelectorAll('[data-difficulty]').forEach((button) => button.addEventListener('click', () => { setDifficulty(button.dataset.difficulty); saveSettings(); }));
$('intro-toggle').addEventListener('change', saveSettings);
$('start-button').addEventListener('click', () => start({ intro: $('intro-toggle').checked }));
$('play-again').addEventListener('click', () => start({ intro: false }));
$('restart-button').addEventListener('click', () => start({ intro: false }));
$('title-button').addEventListener('click', () => {
  runId += 1;
  clearInterval(continueTimer);
  $('pause-overlay').hidden = true;
  $('end-overlay').hidden = true;
  $('rick-dialog').hidden = true;
  game.backToTitle();
});
$('pause-button').addEventListener('click', () => game.togglePause());
$('resume-button').addEventListener('click', () => { game.resume(); $('game').focus({ preventScroll: true }); });
$('dialog-skip').addEventListener('click', () => game.skipDialog());
function updateSoundButton() {
  $('sound-button').setAttribute('aria-label', muted ? 'Ton einschalten' : 'Ton ausschalten');
  $('sound-button').title = muted ? 'Ton einschalten (M)' : 'Ton ausschalten (M)';
  $('sound-button').setAttribute('aria-pressed', String(!muted));
  $('sound-waves').setAttribute('d', muted ? 'm16 9 5 6m0-6-5 6' : 'M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14');
}
updateSoundButton();
function toggleSound() {
  muted = !muted;
  track(muted ? 'sound_off' : 'sound_on');
  game.setMuted(muted);
  if (!muted) game.chip.init();
  updateSoundButton();
  saveSettings();
}
$('sound-button').addEventListener('click', toggleSound);
$('twitch-link').addEventListener('click', () => track('twitch_click'));
$('fullscreen-button').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('arcade').requestFullscreen) { await $('arcade').requestFullscreen(); track('fullscreen'); }
    else toast('Vollbild wird in diesem Browser nicht unterstützt.');
  } catch { toast('Vollbild ist in diesem Browser gerade nicht verfügbar.'); }
});
document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (event.code === 'KeyM' && !event.repeat && !event.ctrlKey && !event.metaKey) { toggleSound(); return; }
  if (event.code === 'Enter' && !event.repeat && !$('intro').hidden && !(event.target instanceof HTMLButtonElement)) {
    event.preventDefault();
    start({ intro: $('intro-toggle').checked });
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && ['playing', 'dialog', 'card'].includes(game.status)) {
    $('pause-reason').textContent = 'Dein Flug wurde beim Tabwechsel automatisch pausiert.';
    game.pause();
  }
});
window.addEventListener('blur', () => {
  if (['playing', 'dialog', 'card'].includes(game.status)) game.pause();
});
document.querySelectorAll('[data-action]').forEach((button) => {
  const action = button.dataset.action;
  const release = (event) => { event.preventDefault(); game.setInput(action, false); };
  button.addEventListener('pointerdown', (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); game.setInput(action, true); });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', () => game.setInput(action, false));
});
$('score-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!result || result.cheated || submitted || saving) return;
  const name = $('player-name').value.trim().normalize('NFC');
  if (!name || [...name].length > 18 || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(name)) { $('save-status').textContent = 'Bitte gib einen Namen mit 1–18 Zeichen ein.'; return; }
  saving = true;
  const savingRun = runId;
  $('save-score').disabled = true;
  $('save-status').textContent = 'Highscore wird gespeichert …';
  const entry = { name, score: Math.max(0, Math.min(MAX_SCORE, Math.floor(result.score || 0))), stage: Math.max(1, Math.min(STAGES, result.stage || 1)), won: !!result.won, date: new Date().toISOString() };
  settings.name = name;
  saveSettings();
  let persisted = false;
  if (leaderboardMode === 'server') {
    try {
      const response = await fetch(scoresUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry), signal: AbortSignal.timeout(6000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Server nicht erreichbar.');
      renderLeaderboard(data.scores, 'server');
      persisted = true;
    } catch { if (savingRun === runId) $('save-status').textContent = 'Server gerade nicht erreichbar. Speichere lokal …'; }
  }
  if (!persisted) {
    try {
      const scores = [...localScores(), entry].sort((a, b) => b.score - a.score).slice(0, 10);
      localStorage.setItem(SCORE_KEY, JSON.stringify(scores));
      renderLeaderboard(scores, 'local');
      persisted = true;
    } catch {
      if (savingRun !== runId) return;
      $('save-status').textContent = 'Speicherung ist in diesem Browser blockiert.';
      $('save-score').disabled = false;
    }
  }
  if (savingRun !== runId) return;
  saving = false;
  if (persisted) {
    submitted = true;
    $('player-name').disabled = true;
    $('save-score').textContent = 'GESPEICHERT ✓';
    track('score_saved');
    $('save-status').textContent = leaderboardMode === 'server' ? 'Dein Score ist auf dem Server gespeichert. GG!' : 'Dein Score ist in diesem Browser gespeichert. GG!';
  }
});
loadLeaderboard();
track('pageview');
