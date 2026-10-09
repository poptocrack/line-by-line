// @ts-nocheck
// Étape 2 : les illusions d'optique, tracées trait par trait dans le repère [-1, 1] (y vers le bas).
// Chaque illusion a une valeur de base, un coût de déblocage et une « révélation » jouée quand elle est terminée.
import { L, A, PL, TAU } from '../engine/geometry';

export type IllusionId = 'necker' | 'kanizsa' | 'hermann' | 'fraser' | 'rubin' | 'moire';

function necker() {
  const F = [[-.65, -.35], [.35, -.35], [.35, .65], [-.65, .65]], B = F.map(([x, y]) => [x + .3, y - .3]), out = [];
  const quad = Q => { for (let i = 0; i < 4; i++) { const a = Q[i], b = Q[(i + 1) % 4]; out.push(L(a[0], a[1], b[0], b[1])); } };
  quad(F); for (let i = 0; i < 4; i++) out.push(L(F[i][0], F[i][1], B[i][0], B[i][1])); quad(B);
  return out;
}
export const NECKER_FACES = {
  front: [[-.65, -.35], [.35, -.35], [.35, .65], [-.65, .65]],
  back: [[-.35, -.65], [.65, -.65], [.65, .35], [-.35, .35]],
};

function kanizsa() {
  const out = [], R = .62, r = .22;
  const up = [0, 1, 2].map(i => -Math.PI / 2 + i * TAU / 3), down = [0, 1, 2].map(i => Math.PI / 2 + i * TAU / 3);
  for (const th of up) {
    const cx = Math.cos(th) * R, cy = Math.sin(th) * R, inward = th + Math.PI, w = Math.PI / 6;
    out.push(A(cx, cy, r, inward + w, inward - w + TAU));
    for (const s of [-w, w]) out.push(L(cx, cy, cx + Math.cos(inward + s) * r, cy + Math.sin(inward + s) * r));
  }
  // Le second triangle, pointe en bas, seulement suggéré par ses coins
  const V = down.map(th => [Math.cos(th) * R * .95, Math.sin(th) * R * .95]);
  for (let i = 0; i < 3; i++) {
    const a = V[i];
    for (const j of [(i + 1) % 3, (i + 2) % 3]) { const b = V[j]; out.push(L(a[0], a[1], a[0] + (b[0] - a[0]) * .28, a[1] + (b[1] - a[1]) * .28)); }
  }
  return out;
}

export const HERMANN_POS = Array.from({ length: 6 }, (_, i) => -.9 + i * .36);
function hermann() {
  const out = [];
  for (const p of HERMANN_POS) { const s = L(-.9, p, .9, p); s.w = 7; out.push(s); }
  for (const p of HERMANN_POS) { const s = L(p, -.9, p, .9); s.w = 7; out.push(s); }
  return out;
}

function fraser() {
  const out = [];
  for (let k = 1; k <= 6; k++) {
    const r = .15 * k, n = 16 + 6 * k, len = TAU * r / n * .9, tilt = .35;
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n, cx = Math.cos(a) * r, cy = Math.sin(a) * r, d = a + Math.PI / 2 + tilt;
      out.push(L(cx - Math.cos(d) * len / 2, cy - Math.sin(d) * len / 2, cx + Math.cos(d) * len / 2, cy + Math.sin(d) * len / 2));
    }
  }
  return out;
}

// Profil du vase : demi-largeur selon la hauteur. Le vide autour dessine deux visages qui se font face.
const RUBIN_KEYS = [[-.9, .55], [-.72, .44], [-.52, .39], [-.34, .15], [-.22, .3], [-.12, .21], [-.03, .3], [.06, .2], [.22, .31], [.46, .45], [.74, .4], [.9, .55]];
function catmull(P, steps) {
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(P[P.length - 1]); return out;
}
export const RUBIN_PROFILE = catmull(RUBIN_KEYS.map(([y, x]) => [y, x]), 10).map(([y, x]) => [x, y]); // [demi-largeur, y]
function rubin() {
  const out = [], right = RUBIN_PROFILE.map(([x, y]) => [x, y]), left = RUBIN_PROFILE.map(([x, y]) => [-x, y]);
  for (const side of [left, right]) for (let i = 0; i < side.length - 1; i += 7) out.push(PL(side.slice(i, i + 8)));
  out.push(L(-.55, -.9, .55, -.9)); out.push(L(-.55, .9, .55, .9));
  return out;
}

export const MOIRE_RINGS = Array.from({ length: 10 }, (_, i) => .08 * (i + 1));
function moire() {
  const out = [];
  for (const r of MOIRE_RINGS) out.push(A(-.12, 0, r, 0, TAU));
  for (const r of MOIRE_RINGS) out.push(A(.12, 0, r, Math.PI, Math.PI + TAU));
  return out;
}

/** base : heures rapportées par une illusion terminée ; presence : ce qu'elle ajoute à la jauge. */
export const ILLUSIONS: { id: IllusionId; base: number; cost: number; gen: () => any[]; presence: number }[] = [
  { id: 'necker', base: 10, cost: 0, gen: necker, presence: 5 },
  { id: 'kanizsa', base: 30, cost: 60, gen: kanizsa, presence: 7 },
  { id: 'hermann', base: 80, cost: 250, gen: hermann, presence: 9 },
  { id: 'fraser', base: 200, cost: 900, gen: fraser, presence: 10 },
  { id: 'rubin', base: 500, cost: 3000, gen: rubin, presence: 12 },
  { id: 'moire', base: 1200, cost: 9000, gen: moire, presence: 14 },
];

/* ---------------- Le dessin final : le visage de ce qui regarde ---------------- */
// Révélé morceau par morceau derrière les illusions, des contours extérieurs vers l'œil central.
function ellipsePts(cx, cy, rx, ry, n = 48, a0 = 0, a1 = TAU) { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return o; }
function eye(out, cx, cy, w, rays) {
  const lid = (s) => { const o = []; for (let i = 0; i <= 24; i++) { const x = -1 + i / 12; o.push([cx + x * w, cy + s * (1 - x * x) * w * .55]); } return o; };
  out.push(PL(lid(-1)), PL(lid(1)));
  out.push(PL(ellipsePts(cx, cy, w * .42, w * .42)));
  for (let i = 0; i < rays; i++) { const a = i * TAU / rays; out.push(L(cx + Math.cos(a) * w * .16, cy + Math.sin(a) * w * .16, cx + Math.cos(a) * w * .42, cy + Math.sin(a) * w * .42)); }
  out.push(PL(ellipsePts(cx, cy, w * .16, w * .16, 24)));
}
export function finalDrawing() {
  const out = [];
  for (let k = 6; k >= 1; k--) out.push(PL(ellipsePts(0, .05, .62 + k * .07, .86 + k * .07, 64)));   // contours en onde
  out.push(PL(ellipsePts(0, .05, .62, .86, 64)));                                                      // le visage
  for (let i = 0; i < 17; i++) { const x = -.42 + i * .0525; out.push(L(x, .5, x, .6 + (i % 2) * .05)); } // la bouche, des dents
  out.push(L(-.44, .52, .44, .52));
  eye(out, -.36, -.52, .13, 12); eye(out, .36, -.52, .13, 12);                                         // les petits yeux du front
  eye(out, 0, -.08, .38, 48);                                                                          // l'œil
  return out;
}
