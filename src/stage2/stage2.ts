// @ts-nocheck
// Étape 2 : « Fascination ». Tout est dessiné sur une feuille noire qui occupe l'écran.
// Trois notions : les heures (monnaie), la présence (0 à 100) et le dessin final, qu'on dévoile morceau par morceau avec les heures.
// Rien ne se perd : à 100 de présence, « il » prend ta main un moment, dessine très vite et rapporte beaucoup, puis lâche.
import * as E from '../engine/game';
import { ptAt, slen, TAU } from '../engine/geometry';
import { ILLUSIONS, NECKER_FACES, HERMANN_POS, RUBIN_PROFILE, MOIRE_RINGS, finalDrawing } from './illusions';
const FINAL = finalDrawing();

const S = E.S;
const rnd = (a, b) => a + Math.random() * (b - a);

/* ======================= Nuits suivantes ======================= */
// Chaque nuit traversée rend la suivante plus courte : la Main étrangère commence plus haut et le dessin coûte deux fois moins.
export const nightsDone = () => S.cycles || 0;
export const startHand = () => Math.min(10, 2 * nightsDone());
export const pieceDiscount = () => Math.pow(2, nightsDone());

/* ======================= Le dessin final ======================= */
/** Le dessin se dévoile en PIECES morceaux, achetés avec les heures : PIECE_BASE × PIECE_GR^i (÷ la remise des nuits). */
export const PIECES = 10, PIECE_BASE = 200, PIECE_GR = 3.2;
export const pieceCost = () => Math.ceil(PIECE_BASE * Math.pow(PIECE_GR, st().pieces) / pieceDiscount());

/* ======================= État sauvegardé ======================= */
export const fresh = (notes = []) => ({
  F: 0, total: 0, presence: 0, pieces: 0, ended: false, up: { main: startHand(), oeil: 0, veille: 0, memoire: 0 },
  unl: { necker: 1 }, sel: 'necker', done: 0, takes: 0, notes, calm: false, lastSeen: Date.now(),
});
export const st = () => S.s2;
/** Anciennes sauvegardes (défaite, rituel, transe) : on garde la progression et on retire le reste. */
function normalizeS2() {
  const s = st();
  s.up = { main: 0, oeil: 0, veille: 0, memoire: 0, ...s.up };
  s.takes = s.takes || 0;
  // L'ancien dessin se dévoilait en 230 unités : on le convertit en morceaux, sans rien perdre de ce qui était acquis
  if (s.pieces == null) s.pieces = s.ended ? PIECES : Math.min(PIECES - 1, Math.floor((s.final || 0) / 230 * PIECES));
  delete s.final; delete s.visions; delete s.rituals; delete s.streak;
}

export const UP2 = [
  { id: 'main', base: 20, gr: 2.2 },    // la main étrangère dessine avec toi
  { id: 'oeil', base: 50, gr: 2.6 },    // chaque illusion rapporte plus, et le rapproche
  { id: 'veille', base: 15, gr: 2.0 },  // tu traces plus vite
  { id: 'memoire', base: 40, gr: 2.4 }, // quand il prend ta main, c'est plus long et plus fort
];
export const up2Cost = u => Math.ceil(u.base * Math.pow(u.gr, st().up[u.id]));
// Toutes les marques aident : la présence qui monte n'est plus une menace, elle rapproche la prochaine prise de main.
export const handRateAt = l => 2.5 * l;
export const handPresAt = l => .08 * l;
export const eyeMultAt = l => 1 + .5 * l;
export const vigilAt = l => 1 / Math.pow(.8, l);
export const takeDurAt = l => TAKE_DUR + 2 * Math.min(l, 9);
export const takeMultAt = l => 1.5 + .25 * l;
const autoRate = () => handRateAt(st().up.main);
/** Part des heures versée trait par trait (le reste tombe à la fin de l'illusion). */
export const STROKE_SHARE = .4;
const presencePerSec = () => handPresAt(st().up.main);
/** Plus il est proche, plus ça rapporte : ×1 à 0 de présence, ×3 à 90. */
export const proximity = () => 1 + 2 * Math.min(st().presence, 90) / 90;
/** Prise de main : TAKE_DUR s de base, il trace TAKE_RATE traits/s en plus. */
export const TAKE_DUR = 12, TAKE_RATE = 6;
export const taking = () => !!rt.take;
export const takeLeft = () => rt.take ? Math.max(0, rt.take.dur - rt.take.t) : 0;
/** Pendant la prise de main, le bonus de Mémoire s'ajoute à la proximité (qui retombe avec la présence). */
export const gainMult = () => eyeMultAt(st().up.oeil) * proximity() * (rt.take ? takeMultAt(st().up.memoire) : 1);
export const finalPct = () => Math.min(100, st().pieces / PIECES * 100);
/** Durée de la révélation jouée après chaque illusion (raccourcie pendant la prise de main). */
const REVEAL_DUR = 2.6, REVEAL_DUR_TAKE = .7;
/** Absence : la Main étrangère continue à moitié de son rythme, 8 h au plus. */
const AWAY_SHARE = .5, AWAY_MAX = 8 * 3600;

/* ======================= Exécution (non sauvegardée) ======================= */
export const rt = {
  cv: null, g: null, W: 0, H: 0, dpr: 1, m: null, t: 0, mouse: [0, 0],
  sheet: null, queue: 0, hq: 0, reveal: null, take: null, shown: null, eyes: [], foreign: [], foreignT: 4,
  absence: 0, away: null, saveT: 0, running: false, floats: [], endT: 0, endShown: false,
  ghostFade: 0, ghostAcc: 0, ghostClearT: 0, pendF: 0, pendT: 0, pendXY: [0, 0],
};
const ink = document.createElement('canvas'), ic = ink.getContext('2d');
const ghost = document.createElement('canvas'), gc = ghost.getContext('2d');
const def = id => ILLUSIONS.find(x => x.id === id);

/* ======================= Notes dans la marge ======================= */
function note(key) { const s = st(); if (s.notes.includes(key)) return; s.notes.push(key); whisper(); }
function checkNotes() {
  const s = st();
  note('tuto1');
  if (s.done >= 1 && s.presence > 0) note('tuto2');
  if (s.F >= up2Cost(UP2[0])) note('tuto3');
  if (s.presence >= 30) note('tuto4');
  if (s.presence >= 75) note('hand');
  if (s.takes >= 1) note('take');
  if (s.done >= 1) note('cube');
  if (s.done >= 3) note('points');
  if (s.done >= 20) note('copy');
  if (s.presence >= 25) note('finish');
  if (s.presence >= 50) note('numbers');
  if (s.presence >= 75) note('watch');
  if (s.unl.hermann) note('crossings');
  if (s.unl.rubin) note('faces');
}

/* ======================= Canvas ======================= */
export function attach(cv) {
  normalizeS2();
  rt.cv = cv; rt.g = cv.getContext('2d'); resize();
  addEventListener('resize', resize);
  const s = st();
  const away = (Date.now() - (s.lastSeen || Date.now())) / 1000;
  if (away > 45) absence(away);
  if (!rt.sheet) newSheet();
  if (!rt.running) { rt.running = true; let last = performance.now(); const loop = now => { if (!rt.running) return; const dt = Math.max(0, Math.min(.1, (now - last) / 1000)); last = now; try { tick(dt); render(); } catch (e) { console.error(e); } requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  document.addEventListener('visibilitychange', onVis);
}
let hiddenAt = 0;
function onVis() { if (document.hidden) { hiddenAt = Date.now(); st().lastSeen = Date.now(); E.save(); } else if (hiddenAt) { const sec = (Date.now() - hiddenAt) / 1000; hiddenAt = 0; if (sec > 45) absence(sec); } }
export function detach() { rt.running = false; removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis); stopAudio(); }
function resize() {
  if (!rt.cv) return;
  const d = Math.min(2, devicePixelRatio || 1), W = Math.round(innerWidth * d), H = Math.round(innerHeight * d);
  const oldG = ghost.width ? (() => { const c = document.createElement('canvas'); c.width = ghost.width; c.height = ghost.height; c.getContext('2d').drawImage(ghost, 0, 0); return c; })() : null;
  Object.assign(rt, { W, H, dpr: d }); rt.cv.width = W; rt.cv.height = H;
  const Sz = Math.min(W * .62, H * .66);
  rt.m = { cx: W / 2, cy: H * .5, S: Sz, lw: Math.max(1.2, Sz / 420) };
  ink.width = W; ink.height = H; ghost.width = W; ghost.height = H;
  if (oldG) gc.drawImage(oldG, 0, 0, W, H);
  rebake();
}
const X = x => rt.m.cx + x * rt.m.S / 2, Y = y => rt.m.cy + y * rt.m.S / 2;
const hue = () => (200 + rt.t * 9) % 360;
function lineStyle(g, s, a = .92) {
  const h = hue();
  g.strokeStyle = `hsla(${h},85%,76%,${a})`; g.lineWidth = rt.m.lw * (s.w || 1.2); g.lineCap = 'round';
  g.shadowColor = `hsla(${h},90%,60%,.9)`; g.shadowBlur = 8 * rt.dpr;
}
function drawStroke(g, s, u, a) { g.save(); lineStyle(g, s, a); E.strokePath(g, s, u, rt.m); g.stroke(); g.restore(); }
function rebake() { ic.clearRect(0, 0, rt.W, rt.H); const sh = rt.sheet; if (!sh) return; for (let i = 0; i < sh.idx; i++) drawStroke(ic, sh.strokes[i], 1); }

function newSheet() {
  const s = st(); if (!s.unl[s.sel]) s.sel = 'necker';
  rt.sheet = { id: s.sel, strokes: def(s.sel).gen(), idx: 0, u: 0 };
  ic.clearRect(0, 0, rt.W, rt.H);
}

/* ======================= Boucle ======================= */
function tick(dt) {
  const s = st(); rt.t += dt; s.lastSeen = Date.now();
  rt.saveT += dt; if (rt.saveT > 4) { rt.saveT = 0; E.save(); }
  updateAudio(dt);
  if (rt.absence > 0) rt.absence -= dt;
  // Le morceau acheté se dessine en 1,5 s (au chargement, ce qui est déjà acquis apparaît d'un coup)
  const target = finalPct() / 100 * FINAL.length;
  rt.shown = rt.shown == null ? target : Math.min(target, rt.shown + dt * FINAL.length / PIECES / 1.5);
  // Présence : elle monte avec les illusions et la Main étrangère. Pendant la prise de main, elle redescend jusqu'à zéro.
  if (rt.take) {
    rt.take.t += dt; s.presence = Math.max(0, 100 * (1 - rt.take.t / rt.take.dur));
    if (rt.take.t >= rt.take.dur) endTake();
  } else {
    s.presence = Math.min(100, s.presence + presencePerSec() * dt);
    if (s.presence >= 100) startTake();
  }
  for (const f of rt.floats) f.t += dt; rt.floats = rt.floats.filter(f => f.t < 1.6);
  // Les petits gains des traits s'affichent regroupés, près du dernier trait
  rt.pendT -= dt; if (rt.pendT <= 0 && rt.pendF > 0) { rt.pendT = .25; if (rt.floats.length < 30) rt.floats.push({ text: '+' + E.fmt(rt.pendF, rt.pendF < 10 ? 1 : 0), x: rt.pendXY[0], y: rt.pendXY[1], t: 0, col: '236,226,214', small: true }); rt.pendF = 0; }
  fadeGhosts(dt);
  if (rt.endT > 0) rt.endT += dt;
  checkNotes();
  // Intrusions : de simples traits rouges, plus fréquents quand il est proche
  const p = intensity();
  if (p >= .25) { rt.foreignT -= dt * (1 + p * 2.5) * (rt.take ? 3 : 1); if (rt.foreignT <= 0) { rt.foreignT = rnd(4, 9); spawnForeign(); } }
  for (const f of rt.foreign) f.t += dt;
  for (const f of rt.foreign.filter(f => f.t >= f.dur)) { gc.save(); gc.strokeStyle = 'rgba(210,25,35,.75)'; gc.lineWidth = rt.m.lw; gc.beginPath(); gc.moveTo(X(f.x1), Y(f.y1)); gc.lineTo(X(f.x2), Y(f.y2)); gc.stroke(); gc.restore(); }
  rt.foreign = rt.foreign.filter(f => f.t < f.dur);
  for (const e of rt.eyes) { e.blink -= dt; if (e.blink < -.18) e.blink = rnd(2.5, 7); }
  if (rt.reveal) { rt.reveal.t += dt; if (rt.reveal.t >= rt.reveal.dur) endReveal(); return; }
  // Tracé : tes clics d'abord, puis la Main étrangère (et lui, quand il tient ta main)
  rt.hq = Math.min(30, rt.hq + (autoRate() + (rt.take ? TAKE_RATE : 0)) * dt);
  const sh = rt.sheet; let budget = dt, guard = 0;
  while (budget > 0 && guard++ < 200) {
    const sk = sh.strokes[sh.idx];
    if (sh.u === 0) { if (rt.queue >= 1) rt.queue -= 1; else if (rt.hq >= 1) rt.hq -= 1; else break; sh.u = 1e-6; }
    const dur = .22 * (.4 + .6 * Math.min(slen(sk), 2) / 2) / vigilAt(s.up.veille), need = (1 - sh.u) * dur;
    if (budget >= need) {
      budget -= need; drawStroke(ic, sk, 1); sh.idx++; sh.u = 0; strokeSound();
      // Chaque trait rapporte un peu, tout de suite
      const d = def(sh.id), v = d.base * gainMult() * STROKE_SHARE / sh.strokes.length;
      s.F += v; s.total += v; rt.pendF += v; const e = ptAt(sk, 1); rt.pendXY = [X(e[0]), Y(e[1])];
      if (sh.idx >= sh.strokes.length) { complete(); break; }
    }
    else { sh.u += budget / dur; budget = 0; }
  }
}
/** Intensité visuelle (0 à 1) : la présence, ou le maximum pendant la prise de main. */
export const intensity = () => rt.take ? 1 : st().presence / 100;
/** Présence, heures et part du dessin rapportées par une illusion terminée. */
const presOf = d => d.presence;
function complete() {
  const s = st(), d = def(rt.sheet.id), gain = d.base * gainMult(), pres = rt.take ? 0 : presOf(d);
  s.F += gain; s.total += gain; s.done++;
  s.presence = Math.min(100, s.presence + pres);
  rt.floats.push({ text: '+' + E.fmt(gain), x: rt.m.cx, y: rt.m.cy - rt.m.S * .55, t: 0, col: '236,226,214' });
  if (pres) rt.floats.push({ text: '+' + Math.round(pres), x: rt.W - 70 * rt.dpr, y: 150 * rt.dpr, t: 0, col: '255,70,80' });
  chord();
  rt.reveal = { id: d.id, t: 0, dur: rt.take ? REVEAL_DUR_TAKE : REVEAL_DUR };
  if (d.id === 'kanizsa') spawnEyes(1);
  if (d.id === 'hermann' || d.id === 'rubin') spawnEyes(2);
}
/** À 100 de présence, il prend ta main : il dessine très vite, rapporte plus et dévoile plus, puis il lâche. */
function startTake() {
  const s = st(); rt.take = { t: 0, dur: takeDurAt(s.up.memoire) };
  s.presence = 100; boom(); spawnEyes(3); for (let i = 0; i < 3; i++) spawnForeign();
}
function endTake() {
  const s = st(); rt.take = null; s.presence = 0; s.takes = (s.takes || 0) + 1;
  rt.eyes = rt.eyes.slice(0, Math.max(0, rt.eyes.length - 4)); E.save();
}
// Les fantômes s'effacent : lentement en temps normal (demi-vie d'environ 20 s), en 2 à 3 s après un changement
// d'illusion. L'effacement se fait par paliers pour éviter que l'arrondi 8 bits ne laisse une trace figée.
function fadeGhosts(dt) {
  const fast = rt.ghostClearT > 0; if (fast) { rt.ghostClearT -= dt; if (rt.ghostClearT <= 0) { gc.clearRect(0, 0, rt.W, rt.H); return; } }
  const k = fast ? 1.6 : .035; rt.ghostAcc += dt;
  const a = 1 - Math.exp(-rt.ghostAcc * k); if (a < .08) return;
  gc.save(); gc.globalCompositeOperation = 'destination-out'; gc.fillStyle = `rgba(0,0,0,${a})`; gc.fillRect(0, 0, rt.W, rt.H); gc.restore();
  rt.ghostAcc = 0;
}
function endReveal() {
  // L'illusion terminée reste en fantôme, légèrement décalée : la feuille se charge au fil du temps
  gc.save(); gc.globalAlpha = .13; gc.translate(rt.m.cx, rt.m.cy); gc.rotate(rnd(-.08, .08)); gc.translate(-rt.m.cx + rnd(-8, 8) * rt.dpr, -rt.m.cy + rnd(-8, 8) * rt.dpr); gc.drawImage(ink, 0, 0); gc.restore();
  rt.reveal = null; newSheet();
}
function spawnEyes(n) {
  for (let i = 0; i < n && rt.eyes.length < 40; i++) {
    let x, y, tries = 0;
    do { x = rnd(.05, .95) * rt.W; y = rnd(.08, .95) * rt.H; tries++; } while (Math.hypot(x - rt.m.cx, y - rt.m.cy) < rt.m.S * .55 && tries < 20);
    rt.eyes.push({ x, y, r: rnd(9, 20) * rt.dpr, blink: rnd(1, 6), born: rt.t });
  }
}
function spawnForeign() {
  const a = rnd(0, TAU), r = rnd(.1, .9), b = a + rnd(-1.5, 1.5), r2 = rnd(.1, .9);
  rt.foreign.push({ x1: Math.cos(a) * r, y1: Math.sin(a) * r, x2: Math.cos(b) * r2, y2: Math.sin(b) * r2, t: 0, dur: .6 });
  whisper();
}
/** Absence : la Main étrangère a continué sans toi, à moitié de son rythme (rien sans elle). La présence s'arrête juste avant 100. */
function absence(sec) {
  const s = st(), r = autoRate(); if (r <= 0) return;
  const d = def(s.sel), n = d.gen().length, k = r * Math.min(sec, AWAY_MAX) * AWAY_SHARE / n;
  const h = k * d.base * eyeMultAt(s.up.oeil) * (1 + STROKE_SHARE);
  s.F += h; s.total += h; s.done += Math.floor(k);
  s.presence = Math.max(s.presence, Math.min(99, s.presence + k * presOf(d)));
  for (let i = 0; i < 5; i++) spawnForeign();
  spawnEyes(2); note('absence');
  rt.away = { h }; rt.absence = 5;
}

/* ======================= Actions ======================= */
export function click() {
  audioInit();
  rt.queue = Math.min(30, rt.queue + 1);
}
export function buyUp(id) {
  const s = st(), u = UP2.find(x => x.id === id), c = up2Cost(u); if (s.F < c) return;
  s.F -= c; s.up[id]++; chord(true); E.save();
}
/** Dévoiler le morceau suivant du dessin. Le dernier termine la nuit. */
export function buyPiece() {
  const s = st(), c = pieceCost(); if (s.pieces >= PIECES || s.F < c) return;
  s.F -= c; s.pieces++; chord();
  if (s.pieces >= PIECES && !s.ended) { s.ended = true; rt.endT = .001; boom(); }
  E.save();
}
export function pickIllusion(id) {
  const s = st(), d = def(id);
  if (!s.unl[id]) { if (s.F < d.cost) return; s.F -= d.cost; s.unl[id] = 1; chord(true); }
  if (s.sel !== id) rt.ghostClearT = 2.5; // les formes précédentes s'effacent petit à petit
  s.sel = id; if (rt.sheet && rt.sheet.idx === 0 && !rt.reveal) newSheet(); E.save();
}
export function stayAfterEnd() { rt.endShown = true; rt.endT = 0; }
export function toggleCalm() { st().calm = !st().calm; E.save(); }
export function devPresence() { st().presence = Math.min(99, st().presence + 20); }
export function devFascination() { st().F += 1000; }

/* ======================= Rendu ======================= */
function render() {
  const g = rt.g, s = st(), W = rt.W, H = rt.H, m = rt.m; if (!g) return;
  const calm = s.calm, p = intensity();
  g.setTransform(1, 0, 0, 1, 0, 0);
  const bg = g.createRadialGradient(m.cx, m.cy, 0, m.cx, m.cy, Math.max(W, H) * .7);
  bg.addColorStop(0, `hsl(${(hue() + 140) % 360},60%,${6 + p * 4}%)`); bg.addColorStop(1, '#030305');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // Fond hypnotique : des anneaux qui s'éloignent lentement du centre et des rayons qui tournent, plus présents avec la présence
  {
    const R = Math.hypot(W, H) * .6, step = 70 * rt.dpr, sp = calm ? 4 : 14 + 30 * p, off = (((rt.t * sp * rt.dpr) % step) + step) % step;
    g.save(); g.lineWidth = 1.5 * rt.dpr;
    for (let r = off, i = 0; r < R; r += step, i++) { g.strokeStyle = `hsla(${(hue() + i * 24) % 360},75%,45%,${.05 + .12 * p})`; g.beginPath(); g.arc(m.cx, m.cy, r, 0, TAU); g.stroke(); }
    const n = 24, rot = rt.t * (calm ? .01 : .04 + .08 * p);
    for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; g.strokeStyle = `hsla(${(hue() + 180 + i * 15) % 360},70%,40%,${.03 + .07 * p})`; g.beginPath(); g.moveTo(m.cx, m.cy); g.lineTo(m.cx + Math.cos(a) * R, m.cy + Math.sin(a) * R); g.stroke(); }
    g.restore();
  }
  g.save();
  if (!calm && p > .6) { const k = 1 + .007 * Math.sin(rt.t * 1.3) * (p - .6) / .4; g.translate(m.cx, m.cy); g.scale(k, k); g.translate(-m.cx, -m.cy); }
  // Le dessin final, révélé derrière tout le reste
  {
    const n = Math.floor(rt.shown || 0), fm = { cx: rt.m.cx, cy: rt.m.cy, S: Math.min(W, H) * 1.05, lw: rt.m.lw * 1.4 }, done = s.ended;
    g.save(); g.strokeStyle = done ? 'rgba(200,25,40,.55)' : 'rgba(150,20,30,.32)'; g.lineWidth = fm.lw; g.lineCap = 'round';
    for (let i = 0; i < n; i++) { E.strokePath(g, FINAL[i], 1, fm); g.stroke(); }
    if (done) { const [px, py] = lookAt(fm.cx, fm.cy - .04 * fm.S, fm.S * .2); g.fillStyle = 'rgba(0,0,0,.9)'; g.beginPath(); g.arc(px, py, fm.S * .06, 0, TAU); g.fill(); }
    g.restore();
  }
  g.drawImage(ghost, 0, 0);
  if (rt.reveal) renderReveal(g); else {
    if (!calm && p >= .75) { g.save(); g.globalAlpha = .35; g.globalCompositeOperation = 'lighter'; g.filter = 'hue-rotate(120deg)'; g.drawImage(ink, 2.5 * rt.dpr, 0); g.restore(); }
    g.drawImage(ink, 0, 0);
    const sh = rt.sheet; if (sh && sh.u > 0) drawStroke(g, sh.strokes[sh.idx], sh.u);
  }
  for (const f of rt.foreign) { const u = Math.min(1, f.t / f.dur); g.save(); g.strokeStyle = 'rgba(230,30,40,.85)'; g.lineWidth = m.lw * 1.1; g.shadowColor = 'rgba(255,0,0,.8)'; g.shadowBlur = 6 * rt.dpr; g.beginPath(); g.moveTo(X(f.x1), Y(f.y1)); g.lineTo(X(f.x1 + (f.x2 - f.x1) * u), Y(f.y1 + (f.y2 - f.y1) * u)); g.stroke(); g.restore(); }
  g.restore();
  for (const e of rt.eyes) drawEye(g, e.x, e.y, e.r, calm ? 1 : (e.blink < 0 ? 0 : Math.min(1, (rt.t - e.born) * 1.5)), 'rgba(170,20,30,.95)');
  // Vignette qui rougit avec la présence
  const vg = g.createRadialGradient(m.cx, m.cy, Math.min(W, H) * (.45 - p * .15), m.cx, m.cy, Math.max(W, H) * .75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(${Math.round(60 + 120 * p)},0,${Math.round(10 * (1 - p))},${.55 + .4 * p})`);
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  // L'œil qui mesure la présence
  drawEye(g, W - 70 * rt.dpr, 60 * rt.dpr, 34 * rt.dpr, Math.max(.08, p), `rgb(${Math.round(120 + 135 * p)},20,30)`, true);
  // Présence écrite sous l'œil, et petits chiffres flottants
  g.save(); g.font = `${Math.round(24 * rt.dpr)}px 'Caveat', 'Architects Daughter', cursive`; g.textAlign = 'center';
  g.fillStyle = `rgba(${Math.round(200 + 55 * p)},${Math.round(200 - 150 * p)},${Math.round(190 - 150 * p)},.9)`; g.fillText(`${Math.round(s.presence)} / 100`, W - 70 * rt.dpr, 118 * rt.dpr);
  for (const f of rt.floats) { g.font = `${Math.round((f.small ? 20 : 26) * rt.dpr)}px 'Caveat', 'Architects Daughter', cursive`; g.fillStyle = `rgba(${f.col},${Math.max(0, 1 - f.t / 1.6)})`; g.fillText(f.text, f.x, f.y - f.t * 30 * rt.dpr); }
  g.restore();
}
function lookAt(x, y, r) { const dx = rt.mouse[0] * rt.dpr - x, dy = rt.mouse[1] * rt.dpr - y, d = Math.hypot(dx, dy) || 1, k = Math.min(r * .35, d * .05); return [x + dx / d * k, y + dy / d * k]; }
function drawEye(g, x, y, r, open, iris, meter = false) {
  g.save();
  const h = r * .95 * open;
  g.beginPath(); g.moveTo(x - r, y); g.quadraticCurveTo(x, y - h * 1.4, x + r, y); g.quadraticCurveTo(x, y + h * 1.4, x - r, y); g.closePath();
  g.fillStyle = 'rgba(235,225,215,.92)'; g.fill();
  g.clip();
  const [ix, iy] = lookAt(x, y, r);
  g.fillStyle = iris; g.beginPath(); g.arc(ix, iy, r * .45, 0, TAU); g.fill();
  g.fillStyle = '#050505'; g.beginPath(); g.arc(ix, iy, r * (meter ? .18 + .12 * (1 - open) : .22), 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(ix - r * .1, iy - r * .1, r * .06, 0, TAU); g.fill();
  g.restore();
  g.save(); g.strokeStyle = meter ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.45)'; g.lineWidth = Math.max(1, r / 14);
  g.beginPath(); g.moveTo(x - r, y); g.quadraticCurveTo(x, y - h * 1.4, x + r, y); g.quadraticCurveTo(x, y + h * 1.4, x - r, y); g.stroke(); g.restore();
}
function renderReveal(g) {
  const R = rt.reveal, t = R.t, k = t / R.dur, m = rt.m, calm = st().calm;
  const face = pts => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.closePath(); };
  if (R.id === 'fraser') {
    // Aspiration : la spirale tourne et avale le centre
    g.save(); g.globalAlpha = 1 - k * .85; g.translate(m.cx, m.cy); g.rotate((calm ? .3 : 1.2) * t * t * .4); const sc = 1 + (calm ? .1 : .35) * k; g.scale(sc, sc); g.translate(-m.cx, -m.cy); g.drawImage(ink, 0, 0); g.restore();
    return;
  }
  if (R.id === 'moire') {
    // Les deux réseaux de cercles glissent l'un sur l'autre
    const a = t * (calm ? .4 : 1.2), ox = .12 + Math.cos(a) * .1, oy = Math.sin(a) * .1;
    g.save(); lineStyle(g, {}, .85);
    for (const r of MOIRE_RINGS) { g.beginPath(); g.arc(X(-.12), Y(0), r * m.S / 2, 0, TAU); g.stroke(); }
    for (const r of MOIRE_RINGS) { g.beginPath(); g.arc(X(ox), Y(oy), r * m.S / 2, 0, TAU); g.stroke(); }
    g.restore(); return;
  }
  g.drawImage(ink, 0, 0);
  if (R.id === 'necker') {
    // Le cube bascule entre ses deux lectures, de plus en plus vite (2 fois par seconde au plus)
    const f = calm ? .5 : .6 + 1.4 * k, ph = Math.floor(t * f * 2) % 2;
    g.save(); g.fillStyle = `hsla(${hue()},80%,50%,.28)`; face(ph ? NECKER_FACES.front : NECKER_FACES.back); g.fill(); g.restore();
  } else if (R.id === 'kanizsa') {
    // Le triangle invisible apparaît, puis un œil s'ouvre dedans
    g.save(); g.fillStyle = `rgba(255,255,255,${.12 * Math.min(1, k * 2)})`;
    face([0, 1, 2].map(i => { const th = -Math.PI / 2 + i * TAU / 3; return [Math.cos(th) * .62, Math.sin(th) * .62]; })); g.fill(); g.restore();
    drawEye(g, m.cx, m.cy + m.S * .03, m.S * .14, Math.max(0, Math.min(1, (t - 1) / 1.2)), 'rgba(170,20,30,.95)');
  } else if (R.id === 'hermann') {
    // Les taches grises des croisements sont des pupilles
    const a = Math.min(1, k * 1.6);
    for (const x of HERMANN_POS) for (const y of HERMANN_POS) {
      const px = X(x), py = Y(y), r = m.S * .022, [ix, iy] = lookAt(px, py, r * 2);
      g.fillStyle = `rgba(20,20,24,${a})`; g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill();
      g.fillStyle = `rgba(255,255,255,${a * .8})`; g.beginPath(); g.arc(ix - (px - ix) * .2, iy - (py - iy) * .2, r * .25, 0, TAU); g.fill();
    }
  } else if (R.id === 'rubin') {
    // Le vide devient deux visages, qui ouvrent les yeux
    g.save(); g.beginPath(); g.rect(X(-.95), Y(-.9), m.S * .95, m.S * .9);
    const right = RUBIN_PROFILE, left = [...RUBIN_PROFILE].reverse().map(([x, y]) => [-x, y]);
    [...right, ...left].forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.closePath();
    g.fillStyle = `rgba(235,225,215,${.55 * Math.min(1, k * 1.5)})`; g.fill('evenodd'); g.restore();
    const o = Math.max(0, Math.min(1, (t - 1.3) / 1));
    drawEye(g, X(-.66), Y(-.47), m.S * .045, o, 'rgba(40,40,45,.95)'); drawEye(g, X(.66), Y(-.47), m.S * .045, o, 'rgba(40,40,45,.95)');
  }
}

/* ======================= Son ======================= */
let AC = null, master, droneG, breathG, noiseBuf;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  AC = new C(); master = AC.createGain(); master.gain.value = S.muted ? 0 : .9 * S.vol.fx; master.connect(AC.destination);
  noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // Nappe grave qui bat lentement entre deux fréquences proches
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; droneG = AC.createGain(); droneG.gain.value = 0; lp.connect(droneG); droneG.connect(master);
  for (const [f, type, v] of [[55, 'sine', .5], [55.7, 'sine', .5], [110.4, 'triangle', .18], [164.9, 'sine', .08]]) { const o = AC.createOscillator(); o.type = type; o.frequency.value = f; const gg = AC.createGain(); gg.gain.value = v; o.connect(gg); gg.connect(lp); o.start(); }
  // Respiration : bruit filtré, modulé lentement
  const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 1.2;
  breathG = AC.createGain(); breathG.gain.value = 0; src.connect(bp); bp.connect(breathG); breathG.connect(master); src.start();
}
function stopAudio() { if (AC) { AC.close(); AC = null; } }
function updateAudio() {
  if (!AC) return; const p = intensity(), tt = AC.currentTime;
  master.gain.setTargetAtTime(S.muted ? 0 : .9 * S.vol.fx, tt, .1);
  droneG.gain.setTargetAtTime(.05 + .16 * p, tt, .3);
  const b = Math.pow(.5 + .5 * Math.sin(rt.t * TAU * .22), 2);
  breathG.gain.setTargetAtTime((.015 + .09 * p) * b, tt, .08);
}
function burst(freq, q, dur, vol, attackLast = false) {
  if (!AC) return; const tt = AC.currentTime;
  const s = AC.createBufferSource(); s.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = AC.createGain(), pan = AC.createStereoPanner ? AC.createStereoPanner() : null;
  if (attackLast) { g.gain.setValueAtTime(.0001, tt); g.gain.exponentialRampToValueAtTime(vol, tt + dur * .9); g.gain.linearRampToValueAtTime(0, tt + dur); }
  else { g.gain.setValueAtTime(.0001, tt); g.gain.exponentialRampToValueAtTime(vol, tt + dur * .3); g.gain.exponentialRampToValueAtTime(.0001, tt + dur); }
  s.connect(f); f.connect(g); if (pan) { pan.pan.value = rnd(-1, 1); g.connect(pan); pan.connect(master); } else g.connect(master);
  s.start(tt, Math.random(), dur + .05);
}
let lastTick = 0;
function strokeSound() { if (!AC) return; if (AC.currentTime - lastTick < .07) return; lastTick = AC.currentTime; burst(rnd(1500, 2400), 2, .07, .05, true); } // trait « à l'envers »
function whisper() { burst(rnd(1200, 3200), 7, rnd(.35, .7), .09); }
function chord(soft = false) {
  if (!AC) return; const tt = AC.currentTime;
  for (const f of soft ? [311, 330] : [220, 233.1, 311.1]) { const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = AC.createGain(); g.gain.setValueAtTime(.0001, tt); g.gain.exponentialRampToValueAtTime(soft ? .03 : .06, tt + .05); g.gain.exponentialRampToValueAtTime(.0001, tt + 1.6); o.connect(g); g.connect(master); o.start(tt); o.stop(tt + 1.7); }
}
function boom() {
  if (!AC) return; const tt = AC.currentTime, o = AC.createOscillator(); o.frequency.setValueAtTime(70, tt); o.frequency.exponentialRampToValueAtTime(24, tt + 2.5);
  const g = AC.createGain(); g.gain.setValueAtTime(.5, tt); g.gain.exponentialRampToValueAtTime(.0001, tt + 3); o.connect(g); g.connect(master); o.start(tt); o.stop(tt + 3.1);
  burst(300, .7, 2.5, .2);
}

/* ======================= Entrée et sortie ======================= */
export function enterStage2() {
  E.payFascination(); S.stage = 2; S.s2 = fresh(['enter']);
  E.setFrenzy(false); E.save();
}
/** Outil de test : revenir à l'étape 1 (recharge la page). */
export function leaveStage2Dev() { S.stage = 1; S.s2 = null; S.fascForce = 0; E.save(); location.reload(); }

/** Ce qu'une illusion rapporte en tout (traits + fin) et la présence qu'elle ajoute. */
export function illusionProfile(id) {
  const d = def(id);
  return { hours: d.base * gainMult() * (1 + STROKE_SHARE), end: d.base * gainMult(), pres: rt.take ? 0 : presOf(d) };
}

/* ======================= Outil de test : simulation accélérée ======================= */
/** Avance la simulation sans dessiner à l'écran (playtests automatiques). */
export function devStep(dt) { if (!rt.m) { normalizeS2(); rt.W = 1440; rt.H = 900; rt.dpr = 1; rt.m = { cx: 720, cy: 450, S: 594, lw: 1.4 }; ink.width = 1440; ink.height = 900; ghost.width = 1440; ghost.height = 900; } if (!rt.sheet) newSheet(); tick(dt); }
