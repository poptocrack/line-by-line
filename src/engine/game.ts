// @ts-nocheck
// Moteur du jeu : état, économie, rendu canvas, son et boucle. Aucune dépendance à React :
// l'interface s'abonne au store (subscribe/getVersion) et appelle les actions exportées.
import { L, A, units, ptAt, TAU, PATTERN_GEN, MACHINE_GEN, FLIP_FRAME, RULE_GEN, filNails } from './geometry';
import { DETAIL_GEO_CAP, FINISH_FX_CAP, BALANCE, FLIP_GEO_CAP, FLIP_MASTERY_MAX, ENABLE_ATELIER, MASTERY, TECHS, ENABLE_MACHINES, PATTERNS, MACHINES, MACHINE_IDS, FLIPS, FLIP_IDS, FOLIO_N, FOLIO_NEED_PATTERN, RULES, MAX_CUSTOM, ATELIER_COST, UPGRADES, TECHS, FX_IDS, INKS, PAPERS } from './data';
import { detectLang, makeT, makeFmt } from '../i18n';
import Decimal from 'break_eternity.js';

/** Les quantités de graphite sont des Decimal (break_eternity.js) : aucune limite pratique de taille. */
export const D = (x) => (x instanceof Decimal ? x : new Decimal(x ?? 0));
export { Decimal };

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = (a, b) => a + Math.random() * (b - a);
export const DPR = () => Math.min(2, window.devicePixelRatio || 1);

/* ======================= Store (abonnement React) ======================= */
let version = 0;
const subs = new Set();
export const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const getVersion = () => version;
export function bump() { version++; subs.forEach(f => f()); }

/** Points d'accroche remplis par l'interface. */
export const hooks = { toast: (msg) => {}, float: (text, color) => {}, bigBump: () => {}, fly: (snap) => {} };

/* ======================= État et sauvegarde ======================= */
export const KEY = 'trait-pour-trait-v1';
// Une entrée par amélioration, générée depuis UPGRADES : une nouvelle amélioration ne peut plus arriver « undefined » dans une vieille sauvegarde.
const UPDEF = Object.fromEntries(UPGRADES.map(u => [u.id, 0]));
const defaults = () => ({
  g: 0, total: 0, life: 0, strokes: 0, drawings: 0, galleryValue: 0, sel: 0,
  unl: PATTERNS.map((_, i) => i ? 0 : 1), up: { ...UPDEF }, gal: [], sheet: null, t: Date.now(),
  pages: 0, pagesSpent: 0, carnets: 0, tech: {}, atelier: 0, custom: [], draft: { rule: 'fils', a: 6, b: 1, n: 10 },
  fx: {}, ink: 'graphite', fxOff: false, muted: false, vol: { draw: .6, fx: .8 },
  stage: 1, s2: null, fascForce: 0, fascIgnored: 0, cycles: 0, trophies: 0, playTime: 0, tracked: {}, noStats: false,
  mcfg: {}, medit: 'fil', folio: {}, folioVal: {}, flipUnl: { table: 1 }, films: 0, seenMach: 0, seenFolio: 0, lang: null,
});
export const S: any = defaults();
try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o) Object.assign(S, o); } catch (e) { }
function normalize() {
  S.up = { ...UPDEF, ...(S.up || {}) };
  for (const k of Object.keys(S.up)) if (!Number.isFinite(S.up[k]) || S.up[k] < 0) S.up[k] = 0;
  while (S.unl.length < PATTERNS.length) S.unl.push(0);
  S.vol = { draw: .6, fx: .8, ...(S.vol || {}) };
  S.tech = S.tech || {};
  // Anciennes sauvegardes : « Motifs retenus » gardait déjà deux motifs.
  if (!S.techV) { if (S.tech.retenus) S.tech.retenus = 2; S.techV = 2; }
  S.fx = S.fx || {}; S.mcfg = S.mcfg || {}; S.folio = S.folio || {}; S.folioVal = S.folioVal || {};
  for (const k of ['g', 'total', 'life', 'galleryValue']) S[k] = D(S[k]);
  // Réparation : un ancien bug (coût du Projecteur non défini) a pu mettre le graphite à NaN.
  for (const k of ['total', 'life', 'galleryValue']) if (S[k].isNan()) S[k] = D(0);
  if (S.g.isNan()) S.g = S.total;
  if (S.life.eq(0)) S.life = S.total;
  S.custom = (S.custom || []).filter(c => c && RULES[c.rule] && c.id);
  for (const k of MACHINE_IDS) { const d = { machine: k }; for (const p of MACHINES[k].params) d[p[0]] = p[4]; if (k === 'harmo') d.seed = 7; S.mcfg[k] = { ...d, ...(S.mcfg[k] || {}), machine: k }; }
  S.mastery = S.mastery || {}; for (const P of PATTERNS) S.mastery[P.id] = { l: 0, p: 0, ...(S.mastery[P.id] || {}) };
  S.flipUnl = { table: 1, ...(S.flipUnl || {}) };
  S.flipLvl = S.flipLvl || {}; for (const k of FLIP_IDS) S.flipLvl[k] = S.flipLvl[k] || 0;
  // Anciennes sauvegardes : on garde le folioscope si le joueur l'avait déjà utilisé.
  if (S.folioOpen == null) S.folioOpen = (S.films > 0 || FLIP_IDS.some(k => S.folio?.[k] > 0) || !!S.unl[FOLIO_NEED_PATTERN]) ? 1 : 0;
  for (const k of FLIP_IDS) { S.folio[k] = S.folio[k] || 0; S.folioVal[k] = D(S.folioVal[k]); if (S.folioVal[k].isNan()) S.folioVal[k] = D(0); if (S.folio[k] > 0) S.flipUnl[k] = 1; }
  if (!MACHINES[S.medit]) S.medit = 'fil';
  // Couche « mise en abyme » retirée : on ignore ses champs dans les anciennes sauvegardes.
  delete S.depth; delete S.brush; delete S.carnetsHere;
}
normalize();
export function save() {
  S.sheet = swapT > 0 || !sheet ? null : { p: sheet.p, d: sheet.d, f: sheet.f, c: sheet.c, m: sheet.m, idx: sheet.idx, value: sheet.value };
  S.t = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { }
}

/* ======================= Langue ======================= */
export let lang, t, fmt;
function applyLang() {
  lang = S.lang || detectLang(); t = makeT(lang); fmt = makeFmt(lang);
  document.documentElement.lang = lang; document.title = t('app.title');
}
applyLang();
export function setLang(l) { S.lang = l; applyLang(); save(); bump(); }

/* ======================= Formules ======================= */
let PAPER = PAPERS[S.carnets % PAPERS.length];
export const paper = () => PAPER;
export const gm = () => gmWith(0);
/** Multiplicateur de revenus avec `extra` pages de plus (aperçu avant de fermer le carnet). */
export const gmWith = extra => (1 + 0.1 * (S.pages + extra) + 0.15 * (S.films || 0)) * Math.pow(1.15, S.tech.reliure || 0) * cycleMult();
/** Nuits traversées : chaque dessin final terminé double tous les revenus de l'étape 1 (×2, ×4, ×8…). */
export const cycleMult = () => Math.pow(2, S.cycles || 0);
export const bestMult = () => Math.max(...PATTERNS.map((p, i) => S.unl[i] ? p.mult : 1));
export const customMult = () => bestMult() * 1.5;
export const perClick = () => 1 + S.up.hand;
const durMult = () => Math.pow(0.82, S.up.speed);
/** Porte-mine automatique : il clique tout seul (0,5 clic/s au niveau 1, +0,25 par niveau), chaque clic vaut Main sûre. */
export const autoClicksAt = l => l ? 0.5 + 0.25 * (l - 1) : 0;
export const autoClicks = () => autoClicksAt(S.up.auto);
export const autoRate = () => autoClicks() * perClick();
/** Chaque dessin final encadré (trophée) rapporte TROPHY_INCOME g/s de base, multiplié par les bonus de revenus, dès le début de la journée. */
export const TROPHY_INCOME = 10;
export const trophyIncome = () => D(TROPHY_INCOME * (S.trophies || 0)).mul(gm());
export const passive = () => S.galleryValue.mul(0.0025 * S.up.gallery).add(trophyIncome());
/** Le joueur a-t-il de quoi payer ce coût ? */
// Attention : break_eternity répond « vrai » à gte(NaN), d'où la vérification explicite du coût.
export const afford = c => { const d = D(c); return !d.isNan() && d.gte(0) && S.g.gte(d); };
const strokeDur = s => 0.5 * units(s) * durMult();
const strokeVal = (s, sh) => D(sh.mult * units(s) * BALANCE.strokeValue * (s.k ? BALANCE.hatchValue : 1) * (1 + 0.2 * sh.d) * (1 + 0.15 * Math.max(0, (sh.f || 0) - 1))).mul(gm());
const qcap = () => Math.max(10, perClick() * 4) + autoRate() * 2;
export const pagesFor = tot => Math.floor(D(tot).div(5e4).sqrt().toNumber());
export const nextPageAt = n => 5e4 * Math.pow(n + 1, 2);
export const pagesAvail = () => S.pages - (S.pagesSpent || 0);
/* Techniques à niveaux */
export const techLevel = id => S.tech[id] || 0;
export const techCost = tc => Math.ceil(tc.base * Math.pow(tc.gr, techLevel(tc.id)));
export const techCanBuy = tc => techLevel(tc.id) < tc.max && pagesAvail() >= techCost(tc);
const archivesShare = lvl => lvl ? Math.min(.9, .1 + .1 * lvl) : 0;
const fondsAmount = lvl => lvl ? D(5).pow(lvl - 1).mul(500) : D(0);
/** Valeur affichée de l'effet d'une technique au niveau donné. */
export function techValue(id, lvl) {
  switch (id) {
    case 'reliure': return fmt(Math.pow(1.15, lvl), 2);
    case 'fonds': return fmt(fondsAmount(lvl));
    case 'main': return String(Math.min(20, 2 * lvl));
    case 'reserve': return String(Math.min(60, 3 * lvl));
    case 'archives': return fmt(archivesShare(lvl) * 100);
    case 'retenus': return t('pat.' + PATTERNS[Math.min(4, lvl)].id);
    case 'chevalet': return String(1 + lvl);
  }
  return '';
}
/** Coût du niveau l d'une amélioration (Decimal : les coûts accélèrent et dépassent vite les nombres ordinaires). */
export const upCostAt = (u, l) => D(u.gr).pow(l).mul(D(u.acc || 1).pow(l * (l - 1) / 2)).mul(u.base).ceil();
export const upCost = u => upCostAt(u, S.up[u.id]);
export const machUnlocked = k => ENABLE_MACHINES && S.carnets >= MACHINES[k].need;
export const folioUnlocked = () => !!S.folioOpen;
export const flipUnlocked = k => folioUnlocked() && !!S.flipUnl[k];
const machineRate = () => 4 + autoRate() * .5;
export const flipP = (k, i) => FLIPS[k].pingpong ? i / (FOLIO_N - 1) : i / FOLIO_N;

/* Effets visuels et encres */
const FX_COND = {
  spark: () => S.strokes >= 150, trail: () => !!S.unl[1], inks: () => !!S.unl[2], burst: () => !!S.unl[3], gold: () => !!S.unl[4],
};
export const inkAvailable = id => id === 'graphite' || (id === 'or' ? !!S.fx.gold : id === 'neon' ? !!S.tech.neon : !!S.fx.inks);
export const fxOn = id => !!S.fx[id] && !S.fxOff;
const curInk = () => (S.fx.inks && inkAvailable(S.ink) ? INKS[S.ink] : INKS.graphite) || INKS.graphite;
const hatchCol = () => { const i = curInk(); return i.rgb ? (PAPER.dark ? i.dark : i.rgb) : PAPER.ink; };
const glowCol = () => curInk().glow;

/* ======================= Motifs ======================= */
/* Maîtrise */
export const masteryLevel = i => S.mastery[PATTERNS[i].id].l;
export const masteryProgress = i => S.mastery[PATTERNS[i].id].p;
export const masteryMult = m => 1 + MASTERY.bonus * m;
const geoM = m => Math.min(m, MASTERY.geoCap), flipGeoM = m => Math.min(m, FLIP_GEO_CAP);
export const customName = c => t('rulelabel.' + c.rule, { a: fmt(c.a, 1), b: fmt(c.b, 2) });
/** Description d'un motif à partir de { p, c } : p = index de motif, 'c' atelier, 'm' machine, 'f' folioscope. */
export function patOf(o) {
  if (typeof o.p === 'number') { const P = PATTERNS[o.p], m = o.m ?? masteryLevel(o.p); return { kind: 'pattern', mult: P.mult * masteryMult(m), gen: (d, f) => PATTERN_GEN[P.id](Math.min(d, DETAIL_GEO_CAP), Math.min(f || 0, FINISH_FX_CAP), geoM(m)), notes: P.notes }; }
  if (o.p === 'm') return { kind: 'machine', mult: bestMult() * MACHINES[o.c.machine].mult, gen: () => MACHINE_GEN[o.c.machine](o.c), notes: [392, 494, 587, 784] };
  if (o.p === 'f') { const m = o.c.m ?? S.flipLvl[o.c.flip]; return { kind: 'folio', mult: bestMult() * 1.2 * masteryMult(m), gen: () => FLIP_FRAME[o.c.flip](flipP(o.c.flip, o.c.i), flipGeoM(m)), notes: [659, 784] }; }
  return { kind: 'custom', mult: customMult(), gen: (d, f) => RULE_GEN[o.c.rule](o.c, d, f), notes: [494, 622, 740, 988] };
}
export function patName(o) {
  if (typeof o.p === 'number') return t('pat.' + PATTERNS[o.p].id);
  if (o.p === 'm') return t('mach.' + o.c.machine);
  if (o.p === 'f') return t('flip.' + o.c.flip);
  return customName(o.c);
}
/** Clé de sélection → { p, c } (sans vérifier le déblocage). */
export function keyToObj(key) {
  if (typeof key === 'number') return { p: key, c: null };
  if (key.startsWith('m:')) return { p: 'm', c: { ...S.mcfg[key.slice(2)] } };
  if (key.startsWith('f:')) { const k = key.slice(2); return { p: 'f', c: { flip: k, i: S.folio[k] } }; }
  const c = S.custom.find(x => 'c:' + x.id === key); return c ? { p: 'c', c: { ...c } } : null;
}

/* ======================= Feuille : canvas et rendu ======================= */
let sheetEl = null, sc = null;
const ink = document.createElement('canvas'), ic = ink.getContext('2d');
const glw = document.createElement('canvas'), gc = glw.getContext('2d');
const paperC = document.createElement('canvas');
const G = { W: 0, H: 0, S: 1, cx: 0, cy: 0, dpr: 1, lw: 1 };
let glowLife = 0, glowBudget = 0, onionT = 0, proj = null, onionCache = null, nailCache = null;
const easels = []; // chevalets supplémentaires (voir plus bas)
let sheet = null, queue = 0, lastHead = [0.4, 0.75], curK = 0, swapT = 0;
let autoAcc = 0, drawingNow = false, holding = false, holdT = 0, rateAcc = D(0), rate = D(0), rateT = 0, saveT = 0, uiT = 0;
export const getSheet = () => sheet;
export const getProj = () => proj;
export const getSwapT = () => swapT;
export const getRate = () => rate;
export const sheetKey = () => !sheet ? null : sheet.p === 'c' ? 'c:' + sheet.c.id : sheet.p === 'm' ? 'm:' + sheet.c.machine : sheet.p === 'f' ? 'f:' + sheet.c.flip : sheet.p;

export function strokePath(g, s, u, m) {
  g.beginPath();
  if (s.t === 'l') { const p = ptAt(s, u); g.moveTo(m.cx + s.x1 * m.S / 2, m.cy + s.y1 * m.S / 2); g.lineTo(m.cx + p[0] * m.S / 2, m.cy + p[1] * m.S / 2); }
  else if (s.t === 'p') {
    const d = u * s.len, P0 = s.pts[0]; g.moveTo(m.cx + P0[0] * m.S / 2, m.cy + P0[1] * m.S / 2);
    for (let i = 1; i < s.pts.length; i++) { if (s.cum[i] <= d) { const q = s.pts[i]; g.lineTo(m.cx + q[0] * m.S / 2, m.cy + q[1] * m.S / 2); } else { const q = ptAt(s, u); g.lineTo(m.cx + q[0] * m.S / 2, m.cy + q[1] * m.S / 2); break; } }
  }
  else g.arc(m.cx + s.cx * m.S / 2, m.cy + s.cy * m.S / 2, s.r * m.S / 2, s.a0, s.a0 + (s.a1 - s.a0) * u, s.a1 < s.a0);
}
/** Dessine un trait (u = avancement 0..1). bake ajoute le halo graphite. col force la couleur. */
export function inkStroke(g, s, u, m, bake = false, col = null) {
  if (!col) col = s.col || (s.k ? hatchCol() : PAPER.ink);
  g.lineCap = 'round'; strokePath(g, s, u, m);
  if (s.col || s.thin) { g.strokeStyle = `rgba(${col},${s.thin ? .5 : .78})`; g.lineWidth = m.lw * (s.thin ? .6 : .85); g.stroke(); return; }
  const fin = m.fin || 0;
  if (bake && !s.k) { g.strokeStyle = `rgba(${col},.12)`; g.lineWidth = m.lw * 2.6; g.stroke(); }
  // Niveau 3, estompe : les hachures s'accompagnent d'un voile de graphite estompé
  if (fin >= 3 && s.k && bake) { g.strokeStyle = `rgba(${col},.05)`; g.lineWidth = m.lw * 7; g.stroke(); }
  // Niveau 5, encrage : le contour principal devient plus net et plus sombre
  const ink5 = fin >= 5 && !s.k, inkCol = ink5 && col === PAPER.ink && !PAPER.dark ? '14,14,22' : col;
  g.strokeStyle = `rgba(${inkCol},${s.k ? .52 : ink5 ? 1 : .88})`; g.lineWidth = m.lw * (s.k ? 0.75 : ink5 ? 1.75 : 1.15); g.stroke();
  // Niveau 4, grain : des grains de graphite le long des traits principaux (positions fixes pour chaque trait)
  if (fin >= 4 && !s.k && bake && u >= 1) grain(g, s, m, col);
}
function grain(g, s, m, col) {
  const len = slenPx(s, m), n = Math.min(120, Math.floor(len / 2.5)); if (!n) return;
  let h = Math.abs(Math.floor((s.x1 ?? s.cx ?? 0) * 7919 + (s.y1 ?? s.cy ?? 0) * 104729)) % 2147483647 || 1;
  const rnd01 = () => (h = h * 16807 % 2147483647) / 2147483647;
  g.fillStyle = `rgba(${col},.42)`;
  for (let i = 0; i < n; i++) {
    const p = ptAt(s, rnd01()), X = m.cx + p[0] * m.S / 2 + (rnd01() - .5) * m.lw * 4.5, Y = m.cy + p[1] * m.S / 2 + (rnd01() - .5) * m.lw * 4.5, z = m.lw * (.6 + rnd01() * .9);
    g.fillRect(X, Y, z, z);
  }
}
const slenPx = (s, m) => (s.t === 'l' ? Math.hypot(s.x2 - s.x1, s.y2 - s.y1) : s.t === 'p' ? s.len : s.r * Math.abs(s.a1 - s.a0)) * m.S / 2;
export function drawNails(g, nails, m, r) {
  for (const [x, y] of nails) {
    const X = m.cx + x * m.S / 2, Y = m.cy + y * m.S / 2;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(X + r * .5, Y + r * .7, r * 1.1, 0, TAU); g.fill();
    const gr = g.createRadialGradient(X - r * .4, Y - r * .4, r * .1, X, Y, r * 1.1); gr.addColorStop(0, '#f1f3f5'); gr.addColorStop(.5, '#a3a8af'); gr.addColorStop(1, '#5b6067');
    g.fillStyle = gr; g.beginPath(); g.arc(X, Y, r, 0, TAU); g.fill();
  }
}
/** Rendu d'une vignette (icône de motif, aperçu, galerie) dans un canvas. */
export function renderMini(cv, strokes, opts: any = {}) {
  const { w, h = w, bg = '#fbfbf9', col = null, fill = .84, cy = .5, nails = null } = opts;
  const d = DPR(), W = Math.round(w * d), H = Math.round(h * d);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const Sz = Math.min(W * fill, h === w ? W * fill : H * .64), m = { cx: W / 2, cy: H * cy, S: Sz, lw: Math.max(.5, Sz / 280), fin: opts.fin || 0 };
  for (const s of strokes) inkStroke(g, s, 1, m, false, s.col || col);
  if (nails) drawNails(g, nails, m, Math.max(1, W / 260));
}
export const thumbStrokes = e => { try { return patOf(e).gen(e.d, !!e.f); } catch (_) { return []; } };

function buildPaper() {
  paperC.width = G.W; paperC.height = G.H; const g = paperC.getContext('2d');
  g.fillStyle = PAPER.bg; g.fillRect(0, 0, G.W, G.H);
  const img = g.getImageData(0, 0, G.W, G.H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 8; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  const gr = g.createRadialGradient(G.W / 2, G.H / 2, G.H * .3, G.W / 2, G.H / 2, G.H * .78);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(30,40,35,.08)');
  g.fillStyle = gr; g.fillRect(0, 0, G.W, G.H);
}
export function rebake() { ic.clearRect(0, 0, G.W, G.H); if (!sheet) return; G.fin = sheet.f || 0; for (let i = 0; i < sheet.idx; i++) inkStroke(ic, sheet.strokes[i], 1, G, true); }
function resize() {
  if (!sheetEl) return;
  const r = sheetEl.getBoundingClientRect(), dpr = DPR();
  const W = Math.max(2, Math.round(r.width * dpr)), H = Math.max(2, Math.round(r.height * dpr));
  if (W === G.W && H === G.H) return;
  Object.assign(G, { W, H, dpr, S: Math.min(W * .86, H * .64), cx: W / 2, cy: H * .45 });
  G.lw = Math.max(1, G.S / 380);
  sheetEl.width = W; sheetEl.height = H; ink.width = W; ink.height = H; glw.width = W; glw.height = H;
  buildPaper(); rebake();
}
function applyPaper() { PAPER = PAPERS[S.carnets % PAPERS.length]; if (sheetEl) sheetEl.style.background = PAPER.bg; if (G.W) { buildPaper(); rebake(); gc.clearRect(0, 0, G.W, G.H); } }
function glowStroke(s) {
  if (!fxOn('trail') || !G.W) return; if (glowBudget-- <= 0) return;
  const c = glowCol(); gc.save(); gc.lineCap = 'round'; strokePath(gc, s, 1, G);
  gc.strokeStyle = `rgba(${c},.95)`; gc.lineWidth = G.lw * (s.k ? 1.5 : 2.2); gc.shadowColor = `rgba(${c},1)`; gc.shadowBlur = 9 * G.dpr;
  gc.stroke(); gc.restore(); glowLife = 3;
}
// La lueur s'estompe par paliers d'environ 0,12 s : avec un effacement trop fin à chaque image, l'arrondi
// sur 8 bits bloque l'alpha vers 5 % et laisse une ombre persistante, très visible sur le papier noir.
let fadeAcc = 0;
function fadeGlow(dt) {
  if (glowLife <= 0 || !G.W) return; glowLife -= dt; fadeAcc += dt;
  if (fadeAcc >= .12) {
    gc.save(); gc.globalCompositeOperation = 'destination-out'; gc.fillStyle = `rgba(0,0,0,${1 - Math.exp(-fadeAcc * 2.4)})`; gc.fillRect(0, 0, G.W, G.H); gc.restore();
    fadeAcc = 0;
  }
  if (glowLife <= 0) gc.clearRect(0, 0, G.W, G.H);
}
function clearGlow() { if (G.W) gc.clearRect(0, 0, G.W, G.H); glowLife = 0; fadeAcc = 0; }

function makeSheet(p, d, f, idx = 0, value = 0, c = null, m = undefined) {
  const o = { p, d, f: f || 0, c, m: typeof p === 'number' ? (m ?? masteryLevel(p)) : undefined, idx: 0, u: 0, value: D(value) }, pt = patOf(o);
  o.strokes = pt.gen(d, f || 0); o.mult = pt.mult; o.notes = pt.notes; o.kind = pt.kind; o.idx = Math.min(idx, o.strokes.length - 1);
  if (p === 'f') { if (c.m == null) c.m = S.flipLvl[c.flip]; if (c.i > 0) o.onion = FLIP_FRAME[c.flip](flipP(c.flip, c.i - 1), flipGeoM(c.m)); }
  if (p === 'm' && c.machine === 'fil') o.nails = filNails(c);
  return o;
}
function resolveSel() {
  if (typeof S.sel === 'number') return { p: S.sel, c: null };
  if (typeof S.sel === 'string' && S.sel.startsWith('m:')) { const k = S.sel.slice(2); if (MACHINES[k] && machUnlocked(k)) return { p: 'm', c: { ...S.mcfg[k] } }; }
  if (typeof S.sel === 'string' && S.sel.startsWith('f:')) { const k = S.sel.slice(2); if (FLIPS[k] && flipUnlocked(k)) return { p: 'f', c: { flip: k, i: S.folio[k] } }; }
  const c = ENABLE_ATELIER && S.custom.find(x => 'c:' + x.id === S.sel); if (c) return { p: 'c', c: { ...c } };
  S.sel = 0; return { p: 0, c: null };
}
function newSheet() {
  const r = resolveSel();
  sheet = makeSheet(r.p, S.up.detail, S.up.finish, 0, 0, r.c);
  ic.clearRect(0, 0, G.W, G.H); onionT = 0; G.fin = sheet.f || 0;
  clearGlow(); // pas de reste lumineux du dessin précédent sur la nouvelle feuille
  const k = sheetKey(); for (const e of easels) if (e.sheet && e.key === k) easelNewSheet(e);
  if (sheetEl && !reduceMotion && sheet.p !== 'f') { sheetEl.classList.remove('fresh'); void sheetEl.offsetWidth; sheetEl.classList.add('fresh'); }
}
const sheetFresh = () => sheet.idx === 0 && sheet.u === 0 && swapT <= 0;
try {
  const o = S.sheet;
  if (o && (typeof o.p === 'number' ? PATTERNS[o.p] : o.p === 'm' ? ENABLE_MACHINES && o.c && MACHINES[o.c.machine] : o.p === 'f' ? o.c && FLIPS[o.c.flip] : o.c && RULES[o.c.rule])) sheet = makeSheet(o.p, o.d, o.f, o.idx, o.value, o.c, o.m);
} catch (e) { sheet = null; }
if (!sheet) newSheet();

function renderProjection() {
  const fr = proj.frames, i = proj.i, prev = proj.prev;
  sc.drawImage(paperC, 0, 0);
  if (prev != null) { sc.globalAlpha = .16; for (const st of fr[prev]) inkStroke(sc, st, 1, G); sc.globalAlpha = 1; }
  for (const st of fr[i]) inkStroke(sc, st, 1, G);
  sc.font = `${Math.round(G.W * .035)}px 'Architects Daughter', cursive`; sc.fillStyle = `rgba(${PAPER.ink},.45)`; sc.textAlign = 'right'; sc.fillText(String(i + 1), G.W * .95, G.H * .965);
}
function renderSheet() {
  if (!G.W || !sc) return;
  if (proj) { renderProjection(); return; }
  sc.drawImage(paperC, 0, 0);
  if (sheet.onion) {
    // Folioscope : l'image précédente reste visible en transparence (table lumineuse), sans page blanche entre deux images.
    if (!onionCache || onionCache.w !== G.W || onionCache.s !== sheet) { const c = document.createElement('canvas'); c.width = G.W; c.height = G.H; const g = c.getContext('2d'); for (const st of sheet.onion) inkStroke(g, st, 1, G, true); onionCache = { c, w: G.W, s: sheet }; }
    const a = reduceMotion ? .22 : Math.max(.22, 1 - (onionT / .5) * .78); sc.globalAlpha = a; sc.drawImage(onionCache.c, 0, 0); sc.globalAlpha = 1;
  }
  sc.drawImage(ink, 0, 0);
  if (glowLife > 0) { sc.save(); sc.globalCompositeOperation = PAPER.dark ? 'lighter' : 'source-over'; sc.globalAlpha = PAPER.dark ? .9 : .6; sc.drawImage(glw, 0, 0); sc.restore(); }
  if (sheet.nails && (!nailCache || nailCache.w !== G.W || nailCache.s !== sheet)) {
    const c = document.createElement('canvas'); c.width = G.W; c.height = G.H; drawNails(c.getContext('2d'), sheet.nails, G, Math.max(1.8, G.S / 300)); nailCache = { c, w: G.W, s: sheet };
  }
  if (sheet.u > 0 && swapT <= 0) {
    const s = sheet.strokes[sheet.idx];
    if (!sheet.nails && fxOn('trail')) { const c = glowCol(); sc.save(); sc.lineCap = 'round'; strokePath(sc, s, sheet.u, G); sc.strokeStyle = `rgba(${c},.85)`; sc.lineWidth = G.lw * 2.4; sc.shadowColor = `rgba(${c},1)`; sc.shadowBlur = 10 * G.dpr; sc.stroke(); sc.restore(); }
    inkStroke(sc, s, sheet.u, G);
    if (sheet.nails) {
      // Le fil libre qui pend vers la bobine
      const h = ptAt(s, sheet.u);
      sc.beginPath(); sc.moveTo(G.cx + h[0] * G.S / 2, G.cy + h[1] * G.S / 2); sc.quadraticCurveTo(G.cx + (h[0] * .6 + .5) * G.S / 2, G.cy + 1.02 * G.S / 2, G.cx + .97 * G.S / 2, G.cy + 1.08 * G.S / 2);
      sc.strokeStyle = `rgba(${s.col},.35)`; sc.lineWidth = G.lw * .7; sc.stroke();
    }
  }
  if (sheet.nails) sc.drawImage(nailCache.c, 0, 0);
  if (S.life.lt(3) && sheet.idx === 0 && sheet.u === 0) {
    sc.font = `${Math.round(G.W * .04)}px 'Architects Daughter', cursive`; sc.fillStyle = `rgba(${PAPER.ink},.42)`; sc.textAlign = 'center';
    sc.fillText(t('app.hint'), G.W / 2, G.H * .91);
  }
}

/* ======================= Porte-mine, poussière, étincelles ======================= */
let pc = null, pg = null;
const pen = { x: -999, y: -999, lift: 1, init: false }, dust = [], sparks = [];
function sizePencil() { if (!pc) return; const dpr = DPR(); pc.width = innerWidth * dpr; pc.height = innerHeight * dpr; pg.setTransform(dpr, 0, 0, dpr, 0, 0); }
function pencilShape(g, k) {
  let gr;
  g.fillStyle = '#3a3c40'; g.beginPath(); g.moveTo(0, 0); g.lineTo(7 * k, -1.5 * k); g.lineTo(7 * k, 1.5 * k); g.closePath(); g.fill();
  gr = g.createLinearGradient(0, -5 * k, 0, 5 * k); gr.addColorStop(0, '#e1e4e8'); gr.addColorStop(.45, '#aeb2b8'); gr.addColorStop(1, '#6c7077');
  g.fillStyle = gr; g.beginPath(); g.moveTo(7 * k, -1.7 * k); g.lineTo(22 * k, -4.6 * k); g.lineTo(38 * k, -4.6 * k); g.lineTo(38 * k, 4.6 * k); g.lineTo(22 * k, 4.6 * k); g.lineTo(7 * k, 1.7 * k); g.closePath(); g.fill();
  gr = g.createLinearGradient(0, -8 * k, 0, 8 * k); gr.addColorStop(0, '#70747b'); gr.addColorStop(.5, '#52555b'); gr.addColorStop(1, '#34363a');
  g.fillStyle = gr; g.fillRect(38 * k, -8 * k, 92 * k, 16 * k);
  g.fillStyle = 'rgba(22,24,27,.6)';
  for (let x = 44, c = 0; x < 126; x += 7, c++) for (const y of (c % 2 ? [-5, 0, 5] : [-2.5, 2.5])) { g.beginPath(); g.arc(x * k, y * k, 1.25 * k, 0, TAU); g.fill(); }
  gr = g.createLinearGradient(0, -7.5 * k, 0, 7.5 * k); gr.addColorStop(0, '#cfd3d8'); gr.addColorStop(.5, '#9da1a8'); gr.addColorStop(1, '#6a6e75');
  g.fillStyle = gr; g.fillRect(130 * k, -7.5 * k, 172 * k, 15 * k);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(40 * k, -5.6 * k, 262 * k, 1.5 * k);
  g.fillStyle = '#3b3e43'; g.fillRect(302 * k, -6 * k, 14 * k, 12 * k);
}
function renderPencil(dt) {
  if (!pg) return;
  pg.clearRect(0, 0, innerWidth, innerHeight);
  if (proj || !G.W || !sheetEl) return;
  const r = sheetEl.getBoundingClientRect();
  const tx = r.left + (G.cx + lastHead[0] * G.S / 2) / G.dpr, ty = r.top + (G.cy + lastHead[1] * G.S / 2) / G.dpr;
  if (!pen.init || drawingNow) { pen.x = tx + (frenzy ? rnd(-6, 6) : 0); pen.y = ty + (frenzy ? rnd(-6, 6) : 0); pen.init = true; }
  else { const a = 1 - Math.exp(-dt * 9); pen.x += (tx - pen.x) * a; pen.y += (ty - pen.y) * a; }
  pen.lift += ((drawingNow ? 0 : 1) - pen.lift) * (1 - Math.exp(-dt * 16));
  if (drawingNow && Math.random() < .3) dust.push({ x: pen.x, y: pen.y, vx: rnd(-18, 18), vy: rnd(-6, 14), l: 1 });
  pg.fillStyle = `rgba(${PAPER.ink},.5)`;
  for (let i = dust.length - 1; i >= 0; i--) { const p = dust[i]; p.l -= dt * 2.4; if (p.l <= 0) { dust.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; pg.globalAlpha = p.l * .6; pg.fillRect(p.x, p.y, 1.4, 1.4); }
  pg.globalAlpha = 1;
  const k = Math.max(.62, Math.min(.95, r.width / 560)), ang = 0.62, Lf = pen.lift;
  const x = pen.x + Lf * 5, y = pen.y - Lf * 12;
  pg.save(); pg.translate(x + 4 + Lf * 10, y + 6 + Lf * 16); pg.rotate(ang);
  pg.globalAlpha = .2 - .06 * Lf; pg.filter = 'blur(3px)'; pg.fillStyle = '#000'; pg.fillRect(4 * k, -7 * k, 312 * k, 14 * k);
  pg.restore();
  pg.save(); pg.translate(x, y); pg.rotate(ang); pencilShape(pg, k); pg.restore();
  const c = glowCol();
  if (fxOn('spark') && Lf < .6) {
    const I = .35 + .65 * Math.min(1, sRate / 10), R = (5 + 16 * I) * (1 - Lf);
    const gr = pg.createRadialGradient(pen.x, pen.y, 0, pen.x, pen.y, R); gr.addColorStop(0, `rgba(255,255,245,${.9 * I})`); gr.addColorStop(.35, `rgba(${c},${.6 * I})`); gr.addColorStop(1, `rgba(${c},0)`);
    pg.fillStyle = gr; pg.beginPath(); pg.arc(pen.x, pen.y, R, 0, TAU); pg.fill();
    if (!reduceMotion && drawingNow && Math.random() < .25 + .6 * I) sparks.push({ x: pen.x, y: pen.y, vx: rnd(-70, 70) * I, vy: rnd(-110, 10) * I, l: rnd(.3, .6), g: 260 });
  }
  if (sparks.length) {
    pg.save(); pg.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]; p.l -= dt; if (p.l <= 0) { sparks.splice(i, 1); continue; }
      p.vy += p.g * dt; p.vx *= 1 - dt * 1.5; p.vy *= 1 - dt * 1.5; p.x += p.vx * dt; p.y += p.vy * dt;
      pg.globalAlpha = Math.min(1, p.l * 2.2); pg.fillStyle = `rgb(${c})`; pg.fillRect(p.x - 1, p.y - 1, p.s || 2, p.s || 2);
    }
    pg.restore();
  }
}
/** Lueur de tout le dessin terminé, dessinée dans le contexte donné (repère de la feuille). */
function burstGlow(g) {
  const st = sheet.strokes, c = glowCol();
  g.save(); g.lineCap = 'round'; g.strokeStyle = `rgba(${c},.8)`;
  if (st.length < 320) { g.shadowColor = `rgba(${c},1)`; g.shadowBlur = 7 * G.dpr; }
  if (PAPER.dark) g.globalCompositeOperation = 'lighter'; else g.globalAlpha = .6;
  for (const s of st) { strokePath(g, s, 1, G); g.lineWidth = G.lw * (s.k ? 1.2 : 2); g.stroke(); }
  g.restore();
}
/** Illumination de fin de dessin. Si la feuille est déjà partie vers la galerie (torn), seules les étincelles restent. */
function illuminate(torn = false) {
  if (!fxOn('burst') || !sheetEl) return;
  if (!torn) { burstGlow(gc); glowLife = 3; }
  if (reduceMotion) return;
  const r = sheetEl.getBoundingClientRect(), cx = r.left + G.cx / G.dpr, cy = r.top + G.cy / G.dpr, rad = G.S / G.dpr / 2;
  for (let i = 0; i < 90; i++) { const a = rnd(0, TAU), d = rnd(0, rad), sp = rnd(60, 260); sparks.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, l: rnd(.5, 1.1), g: 60, s: rnd(1.5, 3) }); }
}

/* ======================= Son ======================= */
let AC = null, master, drawBus, fxBus, scr, bp, lp, noiseBuf, lastTick = 0, sRate = 0, act = 0, drift = 0, doneFrame = 0;
export function audio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  AC = new C();
  master = AC.createGain(); master.gain.value = S.muted ? 0 : .9; master.connect(AC.destination);
  drawBus = AC.createGain(); drawBus.gain.value = S.vol.draw; drawBus.connect(master);
  fxBus = AC.createGain(); fxBus.gain.value = S.vol.fx; fxBus.connect(master);
  noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = noiseBuf.getChannelData(0); let b = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = .6 * b + .4 * w; d[i] = w * .7 + b * .3; }
  const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = .7;
  const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
  lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
  scr = AC.createGain(); scr.gain.value = 0;
  src.connect(bp); bp.connect(hp); hp.connect(lp); lp.connect(scr); scr.connect(drawBus); src.start();
}
function applyVolumes() {
  if (!AC) return; const tt = AC.currentTime;
  master.gain.setTargetAtTime(S.muted ? 0 : .9, tt, .02); drawBus.gain.setTargetAtTime(S.vol.draw, tt, .02); fxBus.gain.setTargetAtTime(S.vol.fx, tt, .02);
}
// Grattement détaillé quand on trace lentement, souffle continu et doux quand ça va vite.
function drawSound(dt) {
  const inst = doneFrame / Math.max(dt, 1e-3); doneFrame = 0;
  sRate += (inst - sRate) * (1 - Math.exp(-dt / .5));
  act += ((drawingNow ? 1 : 0) - act) * (1 - Math.exp(-dt / (drawingNow ? .03 : .15)));
  if (!AC) return;
  const tt = AC.currentTime, fast = Math.min(1, Math.max(0, (sRate - 3) / 9));
  const base = (.1 - .06 * fast) * (curK && fast < .5 ? .6 : 1), grain = 1 + (1 - fast) * (Math.random() - .5) * .9;
  scr.gain.setTargetAtTime(act > .02 ? base * act * grain : 0, tt, fast > .5 ? .1 : .02);
  if (fast > .3) { drift += dt; bp.frequency.setTargetAtTime(2300 + 350 * Math.sin(drift * 1.1) + 200 * Math.sin(drift * 2.7), tt, .25); lp.frequency.setTargetAtTime(4200, tt, .3); }
  else lp.frequency.setTargetAtTime(5200, tt, .3);
}
function silenceDraw() { if (AC) scr.gain.setTargetAtTime(0, AC.currentTime, .02); }
function strokeStart(s) { if (AC && sRate < 4) bp.frequency.setTargetAtTime(s.k ? rnd(4000, 5200) : rnd(2300, 3700), AC.currentTime, .015); }
function tick() {
  doneFrame++;
  if (!AC || sRate > 5) return; const tt = AC.currentTime; if (tt - lastTick < .08) return; lastTick = tt;
  const s = AC.createBufferSource(); s.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2600;
  const g = AC.createGain(); g.gain.setValueAtTime(.06 * (1 - sRate / 6), tt); g.gain.exponentialRampToValueAtTime(.001, tt + .03);
  s.connect(f); f.connect(g); g.connect(drawBus); s.start(tt, Math.random() * 1.5, .05);
}
export function tone(freqs, step = .09, vol = .11, len = .7) {
  if (!AC) return; const tt = AC.currentTime;
  freqs.forEach((fq, i) => {
    const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = fq; const g = AC.createGain(), st = tt + i * step;
    g.gain.setValueAtTime(.0001, st); g.gain.exponentialRampToValueAtTime(vol, st + .01); g.gain.exponentialRampToValueAtTime(.0001, st + len);
    o.connect(g); g.connect(fxBus); o.start(st); o.stop(st + len + .05);
  });
}

/* ======================= Boucle ======================= */
function gain(v) { v = D(v); if (v.isNan()) { console.warn('gain NaN ignoré'); return; } S.g = S.g.add(v); S.total = S.total.add(v); S.life = S.life.add(v); rateAcc = rateAcc.add(v); }
export function addClicks() { audio(); queue = Math.min(queue + perClick(), qcap()); }

function step(dt) {
  const pr = passive(); if (pr.gt(0)) gain(pr.mul(dt));
  if (proj) { drawingNow = false; stepProjection(dt); return; }
  onionT += dt;
  if (frenzy) queue = qcap() + 40; // la bascule : le crayon ne s'arrête plus
  const isM = sheet.p === 'm';
  // Clics automatiques : de vrais clics, chacun ajoute Main sûre traits d'un coup
  autoAcc += autoClicks() * dt;
  while (autoAcc >= 1) { autoAcc -= 1; queue = Math.min(qcap(), queue + perClick()); }
  if (isM) queue = Math.min(qcap() + 8, queue + machineRate() * dt);
  if (holding) { holdT += dt; if (holdT >= .3) { holdT -= .14; addClicks(); } }
  drawingNow = false;
  if (swapT > 0) { swapT -= dt; if (swapT <= 0) { swapT = 0; newSheet(); } return; }
  let budget = dt, guard = 0; glowBudget = 14;
  while (budget > 0 && guard++ < 600) {
    const s = sheet.strokes[sheet.idx];
    if (sheet.u === 0) { if (queue < 1) break; queue -= 1; sheet.u = 1e-6; curK = s.k; strokeStart(s); }
    const dur = strokeDur(s) / (1 + Math.min(queue, 8) * .12) * (frenzy ? .04 : 1), need = (1 - sheet.u) * dur;
    drawingNow = true;
    if (budget >= need) {
      budget -= need; inkStroke(ic, s, 1, G, true); glowStroke(s);
      const v = strokeVal(s, sheet); gain(v); sheet.value = sheet.value.add(v); S.strokes++;
      sheet.idx++; sheet.u = 0; lastHead = ptAt(s, 1); tick();
      if (sheet.idx >= sheet.strokes.length) { finishSheet(); break; }
    } else { sheet.u += budget / dur; budget = 0; lastHead = ptAt(s, sheet.u); }
  }
}
/** Ajoute une entrée en tête de galerie (16 au plus). Un film est une entrée { film: k }. */
function pushGallery(e) { S.galSeq = (S.galSeq || 0) + 1; e.id = S.galSeq; S.gal.unshift(e); if (S.gal.length > 16) S.gal.length = 16; }
/** Un dessin terminé fait progresser la maîtrise du motif ; au niveau suivant, bonus et motif plus complexe. */
function masteryGain(i, drawingValue) {
  const ms = S.mastery[PATTERNS[i].id]; if (ms.l >= MASTERY.max) return;
  ms.p++;
  if (ms.p < MASTERY.need(ms.l)) return;
  ms.l++; ms.p = 0;
  const reward = D(drawingValue).mul(MASTERY.levelUpReward); gain(reward);
  setTimeout(() => tone([392, 523, 659, 784, 1047], .07, .1, .8), 350);
  hooks.toast(t('toast.mastery', { name: t('pat.' + PATTERNS[i].id), l: ms.l, v: fmt(masteryMult(ms.l), 2), b: fmt(reward) }));
}
function finishSheet() {
  if (sheet.p === 'f') { finishFrame(); return; }
  const bonus = sheet.value.mul(BALANCE.completionBonus); gain(bonus);
  S.galleryValue = S.galleryValue.add(sheet.value.add(bonus)); S.drawings++;
  pushGallery({ p: sheet.p, d: sheet.d, f: sheet.f, c: sheet.c, m: sheet.m });
  if (typeof sheet.p === 'number') masteryGain(sheet.p, sheet.value.add(bonus));
  // Copie de la feuille pour l'animation vers la galerie
  // La feuille terminée s'envole vers la galerie : on en fait une copie (illuminée) et la feuille repart vierge aussitôt,
  // comme une page arrachée du bloc, pour ne pas voir le dessin en double pendant l'animation.
  let torn = false;
  if (sheetEl && !reduceMotion && G.W && !frenzy) {
    const snap = document.createElement('canvas'); snap.width = G.W; snap.height = G.H; const sg = snap.getContext('2d');
    sg.drawImage(paperC, 0, 0); sg.drawImage(ink, 0, 0); if (fxOn('burst')) burstGlow(sg);
    hooks.fly({ canvas: snap, rect: sheetEl.getBoundingClientRect() });
    ic.clearRect(0, 0, G.W, G.H); clearGlow(); torn = true;
  }
  tone(sheet.notes); illuminate(torn);
  hooks.float(`+${fmt(bonus)} g`, `rgb(${PAPER.ink})`); hooks.bigBump();
  sheet.idx = sheet.strokes.length; sheet.u = 0;
  swapT = frenzy ? .08 : reduceMotion ? .2 : .8;
  save(); bump();
}
/** Une image de folioscope terminée (feuille principale ou chevalet). Au bout de FOLIO_N images, le film est terminé. */
function completeFrame(sh, isMain) {
  const k = sh.c.flip, bonus = sh.value.mul(BALANCE.completionBonus); gain(bonus);
  const v = sh.value.add(bonus); S.galleryValue = S.galleryValue.add(v); S.folioVal[k] = S.folioVal[k].add(v); S.folio[k]++;
  if (isMain) tone([sh.notes[S.folio[k] % 2] * 2], .05, .05, .25);
  sh.idx = sh.strokes.length; sh.u = 0;
  if (S.folio[k] >= FOLIO_N) {
    const big = S.folioVal[k].mul(3), m = sh.c.m ?? S.flipLvl[k]; gain(big); S.films++; S.folio[k] = 0; S.folioVal[k] = D(0);
    pushGallery({ film: k, m });
    if (S.flipLvl[k] < FLIP_MASTERY_MAX) S.flipLvl[k]++;
    tone([523, 659, 784, 1047, 1319, 1568], .08, .1, 1.2);
    hooks.toast(t('toast.film', { name: t('flip.' + k), v: fmt(big), l: S.flipLvl[k], x: fmt(masteryMult(S.flipLvl[k]), 2) }));
    if (isMain) startProjection(k, FOLIO_N, 2, m);
  }
}
function finishFrame() { completeFrame(sheet, true); swapT = .12; save(); bump(); }

/* ======================= Chevalets : d'autres motifs dessinés en même temps ======================= */
// Chaque chevalet dessine tout seul un motif différent de la feuille principale et des autres chevalets :
// d'abord le plus petit motif débloqué, puis les animations quand tous les motifs sont déjà pris.
export const easelCount = () => techLevel('chevalet');
const easelRate = () => 2 + autoRate();
export const getEasels = () => easels;
export function attachEasel(i, cv) {
  const e = easels[i] || (easels[i] = { sheet: null, key: null, queue: 0, swapT: 0, idle: 1, ink: document.createElement('canvas') });
  e.cv = cv; e.ctx = cv.getContext('2d'); e.ic = e.ink.getContext('2d'); e.G = { W: 0, H: 0 };
  easelResize(e); if (!e.sheet) easelNewSheet(e);
}
export function detachEasel(i) { const e = easels[i]; if (e) { e.cv = null; e.ctx = null; } }
function easelResize(e) {
  if (!e.cv) return;
  const r = e.cv.getBoundingClientRect(), d = DPR(), W = Math.max(2, Math.round(r.width * d)), H = Math.max(2, Math.round(r.height * d));
  if (W === e.G.W && H === e.G.H) return;
  const Sz = Math.min(W * .86, H * .64);
  e.G = { W, H, S: Sz, cx: W / 2, cy: H * .45, lw: Math.max(.6, Sz / 380), fin: e.sheet ? e.sheet.f || 0 : 0 };
  e.cv.width = W; e.cv.height = H; e.ink.width = W; e.ink.height = H;
  if (e.sheet) for (let i = 0; i < e.sheet.idx; i++) inkStroke(e.ic, e.sheet.strokes[i], 1, e.G, true);
}
function pickEaselKey(e) {
  const used = new Set([sheetKey(), S.sel]);
  for (const o of easels) if (o !== e && o.sheet) used.add(o.key);
  for (let i = 0; i < PATTERNS.length; i++) if (S.unl[i] && !used.has(i)) return i;
  if (folioUnlocked()) for (const k of FLIP_IDS) if (S.flipUnl[k] && !used.has('f:' + k)) return 'f:' + k;
  return null;
}
function easelNewSheet(e) {
  e.key = pickEaselKey(e); e.queue = 0; e.swapT = 0;
  if (e.ic) e.ic.clearRect(0, 0, e.G.W, e.G.H);
  if (e.key == null) { e.sheet = null; return; }
  e.sheet = typeof e.key === 'number' ? makeSheet(e.key, S.up.detail, S.up.finish)
    : makeSheet('f', 0, 0, 0, 0, { flip: e.key.slice(2), i: S.folio[e.key.slice(2)], m: S.flipLvl[e.key.slice(2)] });
  e.G.fin = e.sheet.f || 0;
}
function stepEasel(e, dt) {
  if (!e.sheet) { e.idle += dt; if (e.idle > 1) { e.idle = 0; easelNewSheet(e); } return; }
  if (e.swapT > 0) { e.swapT -= dt; if (e.swapT <= 0) easelNewSheet(e); return; }
  e.queue = Math.min(20, e.queue + easelRate() * dt);
  const sh = e.sheet; let budget = dt, guard = 0;
  while (budget > 0 && guard++ < 400) {
    const s = sh.strokes[sh.idx];
    if (sh.u === 0) { if (e.queue < 1) break; e.queue -= 1; sh.u = 1e-6; }
    const dur = strokeDur(s), need = (1 - sh.u) * dur;
    if (budget >= need) {
      budget -= need; if (e.ic) inkStroke(e.ic, s, 1, e.G, true);
      const v = strokeVal(s, sh); gain(v); sh.value = sh.value.add(v); S.strokes++; sh.idx++; sh.u = 0;
      if (sh.idx >= sh.strokes.length) { easelFinish(e); break; }
    } else { sh.u += budget / dur; budget = 0; }
  }
}
function easelFinish(e) {
  const sh = e.sheet;
  if (sh.p === 'f') completeFrame(sh, false);
  else {
    const bonus = sh.value.mul(BALANCE.completionBonus); gain(bonus);
    S.galleryValue = S.galleryValue.add(sh.value.add(bonus)); S.drawings++;
    pushGallery({ p: sh.p, d: sh.d, f: sh.f, c: sh.c, m: sh.m });
    masteryGain(sh.p, sh.value.add(bonus));
  }
  sh.idx = sh.strokes.length; sh.u = 0; e.swapT = .6; bump();
}
function renderEasel(e) {
  if (!e.ctx || !e.G.W) return;
  easelResize(e);
  const g = e.ctx; g.fillStyle = PAPER.bg; g.fillRect(0, 0, e.G.W, e.G.H);
  const sh = e.sheet; if (!sh) return;
  if (sh.onion && e.swapT <= 0) { g.globalAlpha = .22; for (const st of sh.onion) inkStroke(g, st, 1, e.G); g.globalAlpha = 1; }
  if (e.swapT <= 0) { g.drawImage(e.ink, 0, 0); if (sh.u > 0) inkStroke(g, sh.strokes[sh.idx], sh.u, e.G); }
}
function resetEasels() { for (const e of easels) { e.sheet = null; e.key = null; e.idle = 1; } }
/** Projecteur : 12 images/s, +5,4 images/s par niveau (120 au niveau 20) ; une seule boucle à partir du niveau 4. */
export const projFpsAt = l => 12 * (1 + .45 * l);
const projLoops = () => S.up.screen >= 4 ? 1 : 2;
function startProjection(k, n, loops, m = S.flipLvl[k]) {
  loops = Math.min(loops, projLoops());
  if (n < 2) return;
  const frames = []; for (let i = 0; i < n; i++) frames.push(FLIP_FRAME[k](flipP(k, i), flipGeoM(m)));
  proj = { k, frames, i: 0, prev: null, t: 0, dir: 1, steps: 0, max: loops * (FLIPS[k].pingpong ? 2 * (n - 1) : n), ping: !!FLIPS[k].pingpong };
  bump();
}
function stepProjection(dt) {
  proj.t += dt; const st = 1 / projFpsAt(S.up.screen);
  while (proj && proj.t >= st) {
    proj.t -= st; proj.prev = proj.i;
    if (proj.ping) { proj.i += proj.dir; if (proj.i >= proj.frames.length - 1) { proj.i = proj.frames.length - 1; proj.dir = -1; } if (proj.i <= 0) { proj.i = 0; proj.dir = 1; } }
    else proj.i = (proj.i + 1) % proj.frames.length;
    if (++proj.steps >= proj.max) { proj = null; bump(); }
  }
}
function checkFx() {
  if (!S.folioOpen && S.unl[FOLIO_NEED_PATTERN]) { S.folioOpen = 1; S.seenFolio = 0; S.fx.gold = 1; hooks.toast(t('toast.folio')); save(); return; }
  const fresh = FX_IDS.filter(id => !S.fx[id] && FX_COND[id]());
  if (!fresh.length) return;
  fresh.forEach(id => S.fx[id] = 1);
  const id = fresh[fresh.length - 1];
  hooks.toast(t('toast.fx', { name: t(`fx.${id}.name`), desc: t(`fx.${id}.desc`) })); save();
}
let last = performance.now(), running = false;
function frame(now) {
  // La boucle se reprogramme d'abord : une erreur dans une image ne doit jamais figer tout le jeu.
  requestAnimationFrame(frame);
  try { tickFrame(now); } catch (err) { console.error(err); }
}
function tickFrame(now) {
  const dt = Math.max(0, Math.min(.1, (now - last) / 1000)); last = now;
  if (!document.hidden) S.playTime = (S.playTime || 0) + dt; // temps de jeu réel (statistiques)
  // Étape 2 : l'étape 1 est figée (l'étape 2 a sa propre boucle)
  if (S.stage === 2) { if (pg) pg.clearRect(0, 0, innerWidth, innerHeight); silenceDraw(); return; }
  step(dt); fadeGlow(dt); renderSheet(); renderPencil(dt); drawSound(dt);
  const ne = easelCount(); for (let i = 0; i < ne; i++) if (easels[i]) { stepEasel(easels[i], dt); renderEasel(easels[i]); }
  uiT += dt; if (uiT > .1) { uiT = 0; checkFx(); bump(); }
  rateT += dt; if (rateT >= 1) { const r = rateAcc.div(rateT); rate = rate.gt(0) ? rate.mul(.6).add(r.mul(.4)) : r; rateAcc = D(0); rateT = 0; }
  saveT += dt; if (saveT > 4) { saveT = 0; save(); }
}

/* ======================= Branchement à l'interface ======================= */
export function attachSheet(el) {
  sheetEl = el; sc = el.getContext('2d'); el.style.background = PAPER.bg;
  new ResizeObserver(resize).observe(el); resize();
  el.addEventListener('pointerdown', e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) { } addClicks(); holding = true; holdT = 0; });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => el.addEventListener(ev, () => { holding = false; }));
  el.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); addClicks(); } });
  el.addEventListener('contextmenu', e => e.preventDefault());
}
export function attachPencil(el) { pc = el; pg = el.getContext('2d'); sizePencil(); addEventListener('resize', sizePencil); }

function applyAway(sec) {
  sec = Math.min(8 * 3600, sec); const pr = passive(); if (sec < 2 || pr.lte(0)) return;
  const v = pr.mul(sec); S.g = S.g.add(v); S.total = S.total.add(v); S.life = S.life.add(v);
  if (sec > 30) hooks.toast(t('toast.away', { v: fmt(v) }));
}
export function start() {
  if (running) return; running = true;
  applyAway((Date.now() - (S.t || Date.now())) / 1000);
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); save(); silenceDraw(); }
    else if (hiddenAt) { applyAway((Date.now() - hiddenAt) / 1000); hiddenAt = 0; last = performance.now(); }
  });
  addEventListener('pagehide', save);
  requestAnimationFrame(tn => { last = tn; requestAnimationFrame(frame); });
}

/* ======================= Actions ======================= */
const afterChange = () => { save(); bump(); };

export function selectMotif(key) {
  audio();
  if (typeof key === 'number' && !S.unl[key]) {
    const cost = PATTERNS[key].cost; if (!afford(cost)) return;
    S.g = S.g.sub(cost); S.unl[key] = 1; tone([784, 1047], .07, .09, .4);
  }
  if (typeof key === 'string' && key.startsWith('f:')) {
    const k = key.slice(2); if (!folioUnlocked()) return;
    if (!S.flipUnl[k]) { const cost = FLIPS[k].cost; if (!afford(cost)) return; S.g = S.g.sub(cost); S.flipUnl[k] = 1; tone([784, 1047], .07, .09, .4); }
  }
  S.sel = key; if (sheetFresh()) newSheet(); afterChange();
}
/** Nombre de niveaux achetables d'un coup avec le graphite actuel, et leur coût total. */
export function maxBuy(u) {
  let n = 0, total = D(0), l = S.up[u.id];
  while (l + n < u.max && n < 1000) {
    const next = total.add(upCostAt(u, l + n));
    if (!S.g.gte(next)) break;
    total = next; n++;
  }
  return { n, cost: total };
}
/** Achète `count` niveaux (1 par défaut, 'max' pour tout ce qui est abordable). */
export function buyUpgrade(id, count: any = 1) {
  audio(); const u = UPGRADES.find(x => x.id === id);
  const n = count === 'max' ? maxBuy(u).n : count;
  let bought = 0;
  for (let i = 0; i < n; i++) {
    const c = upCost(u);
    if (S.up[id] >= u.max || !afford(c)) break;
    S.g = S.g.sub(c); S.up[id]++; bought++;
  }
  if (!bought) return;
  tone(bought > 1 ? [988, 1319] : [988], .05, .07, .25);
  if ((id === 'detail' || id === 'finish') && sheetFresh()) newSheet();
  afterChange();
}
export function toggleBuyMax() { S.buyMax = !S.buyMax; afterChange(); }

/* Atelier */
export function buyAtelier() { if (S.atelier || !afford(ATELIER_COST)) return; audio(); S.g = S.g.sub(ATELIER_COST); S.atelier = 1; tone([659, 784, 988], .08, .09, .5); afterChange(); }
export function setDraftRule(rule) {
  if (S.draft.rule === rule) return;
  S.draft = { rule }; for (const p of RULES[rule].params) S.draft[p[0]] = p[4]; afterChange();
}
export function setDraftParam(k, v) { S.draft[k] = v; bump(); }
export function draftStrokes() { return RULE_GEN[S.draft.rule](S.draft, S.up.detail, !!S.up.finish); }
export function addCustom() {
  if (S.custom.length >= MAX_CUSTOM) return; audio();
  const c = { ...S.draft, id: Date.now().toString(36) };
  S.custom.push(c); S.sel = 'c:' + c.id; tone([659, 988], .07, .09, .4);
  if (sheetFresh()) newSheet();
  hooks.toast(t('toast.customAdded', { name: customName(c) })); afterChange();
}
export function removeCustom(id) { S.custom = S.custom.filter(x => x.id !== id); if (S.sel === 'c:' + id) S.sel = 0; afterChange(); }

/* Machines */
export function setMachineEdit(k) { S.medit = k; afterChange(); }
export function setMachineParam(k, p, v) { S.mcfg[k][p] = v; bump(); }
export function commitMachine(k) { if (sheet.p === 'm' && sheet.c.machine === k && sheetFresh()) newSheet(); afterChange(); }
export function reseedHarmo() { S.mcfg.harmo.seed = (S.mcfg.harmo.seed || 1) + 1; commitMachine('harmo'); }
export function machineStrokes(k) { return MACHINE_GEN[k](S.mcfg[k]); }

/* Folioscope */
/** Rejoue un film terminé depuis la galerie. */
export function playFilm(k, m = 0) { if (proj || !FLIPS[k]) return; audio(); startProjection(k, FOLIO_N, 2, m); }
/** Images FOLIO_N d'un film (pour les vignettes animées). */
export const filmFrames = (k, m = 0) => Array.from({ length: FOLIO_N }, (_, i) => FLIP_FRAME[k](flipP(k, i), flipGeoM(m)));
export function playFolio(k) { if (proj || S.folio[k] < 2) return; audio(); startProjection(k, S.folio[k], 2); }

/* Carnet */
export function closeCarnet() {
  const add = pagesFor(S.total); if (add < 1) return; audio();
  if (fascVisible()) S.fascIgnored = (S.fascIgnored || 0) + 1;
  const before = gm(), keptGal = S.galleryValue.mul(archivesShare(techLevel('archives')));
  S.pages += add; S.carnets++;
  Object.assign(S, { g: D(0), total: D(0), drawings: 0, galleryValue: keptGal, unl: PATTERNS.map((_, i) => i ? 0 : 1), up: { ...UPDEF }, gal: [], sheet: null });
  applyTech(); if (typeof S.sel === 'number') S.sel = 0;
  S.g = fondsAmount(techLevel('fonds'));
  queue = 0; rate = D(0); swapT = 0;
  applyPaper(); resetEasels(); newSheet();
  tone([523, 659, 784, 1047, 1319], .1, .1, .9);
  hooks.toast(t('toast.prestige', { n: add, paper: t('paper.' + PAPER.id), a: fmt(before, 1), b: fmt(gm(), 1) }));
  afterChange();
}
function applyTech() {
  const tc = S.tech;
  if (tc.geste && !S.up.finish) S.up.finish = 1;
  if (tc.main) S.up.hand = Math.max(S.up.hand, Math.min(20, 2 * tc.main));
  if (tc.reserve) S.up.auto = Math.max(S.up.auto, Math.min(60, 3 * tc.reserve));
  for (let i = 1; i <= Math.min(4, tc.retenus || 0); i++) S.unl[i] = 1;
}
export function buyTech(id) {
  const tc = TECHS.find(x => x.id === id); if (!techCanBuy(tc)) return; audio();
  S.pagesSpent = (S.pagesSpent || 0) + techCost(tc); S.tech[id] = techLevel(id) + 1; applyTech(); tone([659, 880, 1175], .07, .09, .45);
  if (id === 'geste' && sheetFresh()) newSheet();
  if (id === 'neon') S.ink = 'neon';
  if (id === 'fonds' && S.total.lt(1)) { S.g = S.g.add(fondsAmount(techLevel('fonds')).sub(fondsAmount(techLevel('fonds') - 1))); }
  rebake(); afterChange();
}

/* Apparence et son */
export function setInk(id) { S.ink = id; rebake(); afterChange(); }
export function toggleFx() { S.fxOff = !S.fxOff; gc.clearRect(0, 0, G.W, G.H); afterChange(); }
export function setVolume(k, v) { S.vol[k] = v; audio(); applyVolumes(); bump(); }
export function toggleStats() { S.noStats = !S.noStats; afterChange(); }
export function toggleMute() { S.muted = !S.muted; audio(); applyVolumes(); afterChange(); }
export function markSeen(panel) { if (panel === 'machines') S.seenMach = MACHINE_IDS.filter(machUnlocked).length; if (panel === 'folio' && folioUnlocked()) S.seenFolio = 1; afterChange(); }
/** Fin de l'étape 2 : on ferme le carnet. L'étape 1 recommence de zéro, avec le bonus de nuit doublé.
 *  Conservés : réglages, langue, effets visuels débloqués, nuits traversées et trophées. */
export function newCycle() {
  const keep = { vol: S.vol, muted: S.muted, lang: S.lang, fx: S.fx, ink: S.ink, fxOff: S.fxOff, buyMax: S.buyMax, cycles: (S.cycles || 0) + 1, trophies: (S.trophies || 0) + 1, playTime: S.playTime, tracked: S.tracked, noStats: S.noStats };
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, defaults(), keep); normalize();
  queue = 0; rate = D(0); swapT = 0; proj = null; frenzy = false;
  applyPaper(); resetEasels(); newSheet(); afterChange();
}
export function resetAll() {
  try { localStorage.removeItem(KEY); } catch (_) { }
  const keep = { vol: S.vol, muted: S.muted, lang: S.lang, noStats: S.noStats };
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, defaults(), keep); normalize();
  queue = 0; rate = D(0); swapT = 0; proj = null;
  applyPaper(); resetEasels(); newSheet(); afterChange();
}

/* Outils de test */
export function devGraphite() { gain(Decimal.max(1e4, S.g.mul(99))); rateAcc = D(0); afterChange(); }
export function devCarnet() { S.carnets++; applyPaper(); afterChange(); }
export function devFascination() { S.fascForce = 1; afterChange(); }

/* ======================= Vers l'étape 2 ======================= */
/** « Fascination » apparaît tard (10 films terminés), et coûte toujours tout le graphite. */
export const fascVisible = () => S.stage !== 2 && ((S.films || 0) >= 10 || !!S.fascForce);
let frenzy = false;
export function setFrenzy(on) { frenzy = on; }

export const sheetIsFresh = sheetFresh;
