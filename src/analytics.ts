// Statistiques anonymes, sans cookies, envoyées à GoatCounter (https://www.goatcounter.com).
// Rien n'est envoyé si aucun code GoatCounter n'est configuré au build (variable GOATCOUNTER_CODE),
// si le navigateur demande « Do Not Track », ou si le joueur a coupé les statistiques dans les réglages.
// On n'envoie que des étapes de jeu et une tranche de temps de jeu : aucune donnée personnelle.
import * as E from './engine/game';
import { PATTERNS } from './engine/data';

declare const process: { env: Record<string, string> };
const CODE: string = process.env.GOATCOUNTER || '';

export const analyticsConfigured = () => !!CODE;
const allowed = () => !!CODE && !E.S.noStats && (navigator as any).doNotTrack !== '1';

function send(path: string, title: string, event = true) {
  if (!allowed()) return;
  const q = new URLSearchParams({ p: path, t: title, e: event ? 'true' : 'false', rnd: Math.random().toString(36).slice(2) });
  try { fetch(`https://${CODE}.goatcounter.com/count?${q}`, { mode: 'no-cors', keepalive: true, credentials: 'omit' }); } catch (_) { }
}

/** Tranche de temps de jeu total, pour voir à quel moment les joueurs atteignent chaque étape. */
function bucket(sec: number) {
  const m = sec / 60;
  return m < 5 ? '0-5min' : m < 15 ? '5-15min' : m < 30 ? '15-30min' : m < 60 ? '30-60min' : m < 120 ? '1-2h' : m < 240 ? '2-4h' : m < 480 ? '4-8h' : '8h+';
}

/** Étapes suivies : chacune n'est envoyée qu'une fois par nuit (la nuit fait partie du nom). */
const MILESTONES: [string, () => boolean][] = [
  ['premier-dessin', () => E.S.drawings >= 1 || E.S.carnets >= 1],
  ...PATTERNS.slice(1).map((p, i) => [`motif-${p.id}`, () => !!E.S.unl[i + 1]] as [string, () => boolean]),
  ['carnet-1', () => E.S.carnets >= 1],
  ['carnet-5', () => E.S.carnets >= 5],
  ['folioscope', () => !!E.S.folioOpen],
  ['premier-film', () => (E.S.films || 0) >= 1],
  ['fascination', () => E.S.stage === 2],
  ['etape2-defaite', () => !!E.S.s2 && E.S.s2.visions >= 1],
  ['etape2-dessin-fini', () => !!E.S.s2 && E.S.s2.ended],
];

function check() {
  const S = E.S, night = (S.cycles || 0) + 1;
  S.tracked = S.tracked || {};
  for (const [name, cond] of MILESTONES) {
    const key = `n${night}/${name}`;
    if (S.tracked[key] || !cond()) continue;
    S.tracked[key] = 1;
    send(`etape/nuit-${night}/${name}/${bucket(S.playTime || 0)}`, `${name} (nuit ${night})`);
  }
}

export function initAnalytics() {
  if (!CODE) return;
  // Visite : nouvelle partie ou retour
  send(location.pathname || '/', document.title, false);
  send(`session/${(E.S.playTime || 0) < 5 ? 'nouvelle' : 'retour'}/${bucket(E.S.playTime || 0)}`, 'session');
  setInterval(check, 2000);
}
