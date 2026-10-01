// Anonyme Nutzungsstatistik (selbst gehostet, ohne Cookies, ohne Speicherung von IP-Adressen).
// Do-Not-Track und Global Privacy Control werden respektiert. Lokal (localhost) wird nichts gesendet.
const endpoint = new URL('./api/collect', document.baseURI);
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && !new URLSearchParams(location.search).has('track');
const optOut = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
const enabled = !local && !optOut;

function referrerHost() {
  try {
    if (!document.referrer) return '';
    const host = new URL(document.referrer).hostname;
    return host === location.hostname ? '' : host.slice(0, 80);
  } catch { return ''; }
}

/** Sendet ein Ereignis. Scheitert still: Statistik darf das Spiel nie stören. */
export function track(name, props = {}) {
  if (!enabled) return;
  const body = JSON.stringify({
    n: name, d: props, p: location.pathname.slice(0, 100), r: name === 'pageview' ? referrerHost() : '',
    sw: Math.round(window.innerWidth || 0), t: matchMedia('(pointer: coarse)').matches ? 1 : 0,
  });
  try {
    if (navigator.sendBeacon?.(endpoint, new Blob([body], { type: 'application/json' }))) return;
    fetch(endpoint, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
  } catch { /* ignorieren */ }
}
