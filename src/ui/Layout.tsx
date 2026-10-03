import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as E from '../engine/game';
import { FLIP_MASTERY_MAX, ENABLE_ATELIER, MASTERY, ENABLE_MACHINES, PATTERNS, MACHINES, MACHINE_IDS, FLIPS, FLIP_IDS, FOLIO_N, UPGRADES, TECHS, ATELIER_COST } from '../engine/data';
import { MiniCanvas } from './common';
import { finalDrawing } from '../stage2/illusions';

export type Panel = 'atelier' | 'machines' | 'folio' | 'carnet' | 'settings';
const PANELS: Panel[] = (['atelier', 'machines', 'folio', 'carnet', 'settings'] as Panel[]).filter(p => p !== 'folio' && (p !== 'machines' || ENABLE_MACHINES) && (p !== 'atelier' || ENABLE_ATELIER));

/* ---------------- Barre du haut ---------------- */
export function TopBar(props: { open: Panel | null; onOpen: (p: Panel) => void; bump: boolean }) {
  const { S, t, fmt } = E;
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current!; const sync = () => document.documentElement.style.setProperty('--tb', el.offsetHeight + 'px');
    const ro = new ResizeObserver(sync); ro.observe(el); sync(); return () => ro.disconnect();
  }, []);
  const mu = MACHINE_IDS.filter(E.machUnlocked).length;
  const dots: Partial<Record<Panel, boolean>> = {
    atelier: ENABLE_ATELIER && !S.atelier && E.afford(ATELIER_COST),
    machines: mu > (S.seenMach || 0),
    folio: E.folioUnlocked() && !S.seenFolio,
    carnet: E.pagesFor(S.total) >= 1 || TECHS.some(E.techCanBuy),
  };
  const dim: Partial<Record<Panel, boolean>> = { machines: !mu, folio: !E.folioUnlocked() };
  const label = (p: Panel) => t(p === 'settings' ? 'menu.settings' : 'menu.' + p);
  return (
    <header className="topbar" ref={ref}>
      <h1>{t('app.title')}</h1>
      <div className="counter">
        <span className={'big' + (props.bump ? ' bump' : '')}>{fmt(S.g)}</span>
        <span className="unit">{t('app.unit')}</span>
        <span className="rate">{S.life.gt(0) ? t('app.rate', { v: fmt(E.getRate(), 1) }) : t('app.first')}</span>
      </div>
      <nav className="tools" aria-label={t('menu.aria')}>
        {PANELS.map(p => (
          <button key={p} type="button" className={'tool' + (dim[p] ? ' dim' : '') + (p === 'settings' ? ' tool-set' : '')}
            aria-expanded={props.open === p} aria-label={p === 'settings' ? label(p) : undefined} onClick={() => props.onOpen(p)}>
            {p === 'settings' ? <span className="lbl">{label(p)}</span> : label(p)}
            {dots[p] && <i className="dot" />}
          </button>
        ))}
      </nav>
    </header>
  );
}

/* ---------------- Liste des motifs ---------------- */
export function MotifList() {
  const { S, t, fmt } = E;
  const cur = E.sheetKey();
  const item = (key: any, name: string, sub: string, icon: React.ReactNode, opts: { locked?: boolean; can?: boolean; mine?: boolean; mastery?: number; flip?: string } = {}) => {
    const sel = S.sel === key, fk = opts.flip;
    const mi = opts.mastery ?? (fk ? -1 : undefined);
    const ml = fk ? S.flipLvl[fk] : mi != null ? E.masteryLevel(mi) : 0, mmax = ml >= (fk ? FLIP_MASTERY_MAX : MASTERY.max);
    const need = fk ? FOLIO_N : MASTERY.need(ml), mp = fk ? S.folio[fk] : mi != null ? E.masteryProgress(mi) : 0;
    const mtitle = mi != null ? (mmax ? t('motif.masteryMax', { l: ml }) : fk ? t('motif.flipMasteryAria', { p: mp, n: need, l: ml + 1 }) : t('motif.masteryAria', { p: mp, n: need, l: ml + 1 })) : undefined;
    const card = (
      <button key={String(key)} type="button"
        className={'motif' + (sel ? ' sel' : '') + (opts.locked ? ' locked' : '') + (opts.can ? ' can' : '') + (opts.mine ? ' mach' : '')}
        disabled={opts.locked && !opts.can} onClick={() => E.selectMotif(key)} title={mtitle}>
        {icon}
        <div className="mtext"><b>{name}{ml > 0 && <em className="mlvl">{t('up.level', { n: ml })}</em>}</b><span>{sel ? (cur === key ? t('motif.now') : t('motif.next')) : sub}</span>
          {mi != null && !opts.locked && <i className="mbar" aria-label={mtitle}><i style={{ width: (mmax ? 100 : 100 * mp / need) + '%' }} /></i>}</div>
      </button>
    );
    // Animations : petit bouton pour feuilleter les images déjà tracées du film en cours
    if (!fk || opts.locked || S.folio[fk] < 2) return card;
    const playLabel = t('folio.play', { name, n: S.folio[fk] });
    return (
      <div className="motif-wrap" key={String(key)}>
        {card}
        <button type="button" className="motif-play" aria-label={playLabel} title={playLabel} disabled={!!E.getProj()} onClick={() => E.playFolio(fk)}>▶</button>
      </div>
    );
  };
  const icon = (sig: string, make: () => any[]) => <MiniCanvas sig={sig} make={make} w={44} className="mini" />;
  const anyMach = MACHINE_IDS.some(E.machUnlocked);
  return (
    <div className="motifs">
      {PATTERNS.map((p, i) => {
        const un = !!S.unl[i], can = !un && E.afford(p.cost), l = E.masteryLevel(i);
        return item(i, t('pat.' + p.id), un ? t('motif.value', { m: fmt(p.mult * E.masteryMult(l), 2) }) : t('motif.unlock', { c: fmt(p.cost) }),
          icon('p' + i + ':' + l, () => E.patOf({ p: i }).gen(0, false)), { locked: !un, can, mastery: i });
      })}
      {ENABLE_ATELIER && S.custom.length > 0 && <p className="motif-group">{t('motifs.mine')}</p>}
      {ENABLE_ATELIER && S.custom.map((c: any) => item('c:' + c.id, E.customName(c), t('motif.value', { m: fmt(E.customMult(), 1) }),
        icon('c' + JSON.stringify(c), () => E.patOf({ p: 'c', c }).gen(0, false)), { mine: true }))}
      {anyMach && <p className="motif-group">{t('motifs.machines')}</p>}
      {MACHINE_IDS.filter(E.machUnlocked).map(k => item('m:' + k, t('mach.' + k), t('motif.value', { m: fmt(E.bestMult() * MACHINES[k].mult, 1) }),
        icon('m' + JSON.stringify(S.mcfg[k]), () => E.machineStrokes(k)), { mine: true }))}
      {E.folioUnlocked() && <p className="motif-group">{t('motifs.anims')}</p>}
      {E.folioUnlocked() && <p className="motif-note">{t('motifs.animsNote', { n: FOLIO_N })}</p>}
      {E.folioUnlocked() && FLIP_IDS.map(k => {
        const un = !!S.flipUnl[k], can = !un && E.afford(FLIPS[k].cost);
        return item('f:' + k, t('flip.' + k), un ? t('motif.frame', { i: S.folio[k] + 1, n: FOLIO_N }) : t('motif.unlock', { c: fmt(FLIPS[k].cost) }),
          icon('f' + k + ':' + S.flipLvl[k], () => E.patOf({ p: 'f', c: { flip: k, i: 7 } }).gen(0, false)), { mine: un, locked: !un, can, flip: k });
      })}
    </div>
  );
}

/* ---------------- Stats et améliorations ---------------- */
export function upEffect(id: string, l: number) {
  const { t, fmt } = E;
  switch (id) {
    case 'hand': return t('upEff.hand', { n: 1 + l });
    case 'speed': return t('upEff.speed', { v: fmt(1 / Math.pow(.82, l), 1) });
    case 'auto': return l ? t('upEff.auto', { v: fmt(E.autoClicksAt(l), 2) }) : t('upEff.auto0');
    case 'detail': return t(l >= 8 ? 'upEff.detailMax' : 'upEff.detail', { v: fmt(1 + .2 * l, 1) });
    case 'finish': return !l ? t('upEff.finish0') : l >= 5 ? t('upEff.finishMax', { fx: t('finish.5'), v: fmt(1 + .15 * (l - 1), 2) }) : t('upEff.finishNext', { cur: t('finish.' + l), next: t('finish.' + (l + 1)) });
    case 'gallery': return l ? t('upEff.gallery', { v: fmt(.25 * l, 2) }) : t('upEff.gallery0');
    case 'screen': return l ? t(l >= 4 ? 'upEff.screenOnce' : 'upEff.screen', { v: fmt(E.projFpsAt(l), 1) }) : t('upEff.screen0');
  }
  return '';
}
export function Stats() {
  const { S, t, fmt } = E;
  return (
    <dl className="stats">
      <dt>{t('stats.perClick')}</dt><dd>{E.perClick()}</dd>
      <dt>{t('stats.auto')}</dt><dd>{t('stats.autoClicks', { c: fmt(E.autoClicks(), 2) })}</dd>
      <dt>{t('stats.autoLines')}</dt><dd>{t('stats.autoLinesVal', { v: fmt(E.autoRate(), 1) })}</dd>
      <dt>{t('stats.gallery')}</dt><dd>{t('stats.galleryVal', { v: fmt(E.passive(), 1) })}</dd>
      <dt>{t('stats.drawings')}</dt><dd>{fmt(S.drawings)}</dd>
      {S.films > 0 && <><dt>{t('stats.films')}</dt><dd>{t('stats.filmsVal', { n: S.films, p: S.films * 15 })}</dd></>}
      {(S.cycles || 0) > 0 && <><dt>{t('stats.cycles')}</dt><dd>{t('stats.cyclesVal', { n: S.cycles, m: fmt(E.cycleMult()) })}</dd></>}
      {S.pages > 0 && <><dt>{t('stats.pages')}</dt><dd>{t('stats.pagesVal', { n: fmt(S.pages), m: fmt(E.gm(), 1) })}</dd></>}
    </dl>
  );
}
export function Upgrades() {
  const { S, t, fmt } = E;
  return (
    <div className="ups">
      {UPGRADES.filter(u => u.id !== 'screen' || E.folioUnlocked()).map(u => {
        const l = S.up[u.id], max = l >= u.max, c = E.upCost(u), name = t('up.' + u.id);
        const mb = S.buyMax && !max ? E.maxBuy(u) : null, bulk = mb && mb.n > 1;
        const can = !max && (mb ? mb.n >= 1 : E.afford(c));
        return (
          <div className="up" key={u.id}>
            <div><span className="name">{name}</span><span className="lvl">{u.max > 1 && l ? t('up.level', { n: l }) : u.max === 1 && l ? t('up.owned') : ''}</span></div>
            <p className="eff">{upEffect(u.id, l)}</p>
            <button type="button" className={'buy' + (can ? ' can' : '') + (bulk ? ' bulk' : '')} disabled={!can} onClick={() => E.buyUpgrade(u.id, S.buyMax ? 'max' : 1)}
              aria-label={max ? t('up.ariaMax', { name }) : bulk ? t('up.ariaBulk', { name, n: mb.n, c: fmt(mb.cost) }) : t('up.aria', { name, c: fmt(c) })}>
              {max ? (u.max === 1 ? t('up.ownedBtn') : t('up.max')) : bulk
                ? <><span className="bn">{t('up.bulkN', { n: mb.n })}</span><span>{t('up.cost', { c: fmt(mb.cost) })}</span></>
                : t('up.cost', { c: fmt(c) })}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Feuille ---------------- */
export function Stage(props: { floats: { id: number; text: string; color: string }[]; mtab: string; setMtab: (m: 'motifs' | 'ups') => void }) {
  const { t } = E;
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { E.attachSheet(ref.current!); }, []);
  const sh = E.getSheet(), pr = E.getProj(), sw = E.getSwapT();
  let prog = '';
  if (pr) prog = t('progress.proj', { name: t('flip.' + pr.k), i: pr.i + 1 });
  else if (sw > 0) prog = sh.p === 'f' ? t('progress.nextFrame') : t('progress.done');
  else if (sh) {
    let name = E.patName(sh);
    if (typeof sh.p === 'number' && sh.m > 0) name += ' ' + t('up.level', { n: sh.m });
    if (sh.p === 'f') name = t('sheet.frameName', { name: sh.c.m > 0 ? name + ' ' + t('up.level', { n: sh.c.m }) : name, i: sh.c.i + 1, n: FOLIO_N });
    prog = t('progress.stroke', { name, i: Math.min(sh.idx + (sh.u > 0 ? 1 : 0), sh.strokes.length), n: sh.strokes.length });
  }
  return (
    <section className={'stage' + (E.easelCount() ? ' has-easels' : '')}>
      <div className="sheet-wrap">
        <canvas id="sheet" ref={ref} tabIndex={0} role="button" aria-label={t('app.sheetAria')} />
        <div id="floats">{props.floats.map(f => <div key={f.id} className="float" style={{ color: f.color }}>{f.text}</div>)}</div>
      </div>
      <p className="progress">{prog}</p>
      <Easels />
      <div className="mtabs" role="group" aria-label={t('tabs.aria')}>
        <button type="button" aria-pressed={props.mtab !== 'ups'} onClick={() => props.setMtab('motifs')}>{t('tabs.motifs')}</button>
        <button type="button" aria-pressed={props.mtab === 'ups'} onClick={() => props.setMtab('ups')}>{t('tabs.ups')}</button>
      </div>
    </section>
  );
}

/* ---------------- Galerie (avec l'envol du dessin terminé) ---------------- */
export const flyQueue: { canvas: HTMLCanvasElement; rect: DOMRect }[] = [];
const D10mul = () => E.trophyIncome().div(Math.max(1, E.S.trophies || 1));
export function Gallery() {
  const { S, t, fmt } = E;
  const box = useRef<HTMLDivElement>(null);
  const pap = E.paper();
  useLayoutEffect(() => {
    const f = flyQueue.shift(); flyQueue.length = 0;
    const target = box.current?.firstElementChild as HTMLElement | null;
    if (!f || !target) return;
    const r = f.rect, tr = target.getBoundingClientRect(), c = f.canvas;
    Object.assign(c.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', transformOrigin: '0 0', zIndex: '6', pointerEvents: 'none', boxShadow: '0 20px 40px -12px rgba(0,0,0,.5)' });
    document.body.appendChild(c); target.style.opacity = '0';
    const a = c.animate([{ transform: 'none' }, { transform: `translate(${tr.left - r.left}px,${tr.top - r.top}px) scale(${tr.width / r.width}) rotate(-2deg)` }], { duration: 700, easing: 'cubic-bezier(.55,0,.25,1)' });
    a.onfinish = () => { c.remove(); target.style.opacity = '1'; };
  }, [S.galSeq, S.drawings]);
  const trophyLine = (S.trophies || 0) > 0 ? ' ' + t('gallery.trophyIncome', { n: S.trophies, v: fmt(E.trophyIncome(), 1) }) : '';
  const info0 = !S.drawings && !S.gal.length ? t('gallery.empty')
    : S.up.gallery ? t('gallery.earning', { n: S.drawings, v: fmt(E.passive(), 1) })
      : t('gallery.idle', { n: S.drawings });
  const info = info0 + trophyLine;
  return (
    <section className="gallery gal-area" aria-labelledby="galh">
      <h2 id="galh">{t('gallery.title')}</h2>
      <p id="galinfo">{info}</p>
      {(S.trophies || 0) > 0 && (
        <div className="thumbs trophies">
          {Array.from({ length: Math.min(6, S.trophies) }, (_, i) => (
            <div className="thumb trophy" key={'t' + i} title={t('gallery.trophy', { n: i + 1 }) + ', ' + t('gallery.trophyEach', { v: fmt(D10mul(), 1) })}>
              <MiniCanvas sig={'trophy'} make={finalDrawing} w={78} h={104} bg="#0b0b0d" ink="200,25,40" fill={.95} cy={.5} label={t('gallery.trophy', { n: i + 1 })} />
            </div>
          ))}
        </div>
      )}
      <div className="thumbs" ref={box}>
        {S.gal.map((e: any, i: number) => e.film
          ? <FilmThumb key={e.id} k={e.film} m={e.m || 0} bg={pap.bg} sig={pap.id + S.ink + S.fx.inks} />
          : (
            <div className="thumb" key={e.id ?? 'o' + i}>
              <MiniCanvas sig={JSON.stringify(e) + pap.id + S.ink + S.fx.inks} make={() => E.thumbStrokes(e)} w={78} h={104} bg={pap.bg} ink={null} fill={.86} cy={.45} fin={e.f || 0} />
            </div>
          ))}
      </div>
    </section>
  );
}

/** Vignette de film : l'animation tourne en boucle dans la galerie, un clic la rejoue en grand. */
function FilmThumb(props: { k: string; m: number; bg: string; sig: string }) {
  const { t } = E;
  const ref = useRef<HTMLCanvasElement>(null);
  const frames = useMemo(() => E.filmFrames(props.k, props.m), [props.k, props.m]);
  useEffect(() => {
    const cv = ref.current!, ping = props.k === 'table';
    let i = 7, dir = 1;
    const draw = () => E.renderMini(cv, frames[i], { w: 78, h: 104, bg: props.bg, col: null, fill: .86, cy: .45 });
    draw();
    if (E.reduceMotion) return;
    const id = setInterval(() => {
      if (ping) { i += dir; if (i >= frames.length - 1 || i <= 0) dir = -dir; } else i = (i + 1) % frames.length;
      draw();
    }, 1000 / 8);
    return () => clearInterval(id);
  }, [frames, props.sig]);
  const name = t('flip.' + props.k);
  return (
    <button type="button" className="thumb film" onClick={() => E.playFilm(props.k, props.m)} aria-label={t('gallery.replay', { name })} title={t('gallery.replay', { name })}>
      <canvas ref={ref} style={{ width: 78, height: 104 }} aria-hidden="true" />
    </button>
  );
}

/* ---------------- Chevalets : les autres motifs dessinés en même temps ---------------- */
function EaselCard({ i }: { i: number }) {
  const { t } = E;
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { E.attachEasel(i, ref.current!); return () => E.detachEasel(i); }, [i]);
  const e = E.getEasels()[i], sh = e?.sheet;
  let label = t('easel.waiting');
  if (sh) {
    let name = E.patName(sh);
    if (sh.p === 'f') name = t('sheet.frameName', { name, i: sh.c.i + 1, n: FOLIO_N });
    else if (sh.m > 0) name += ' ' + t('up.level', { n: sh.m });
    label = t('progress.stroke', { name, i: Math.min(sh.idx + (sh.u > 0 ? 1 : 0), sh.strokes.length), n: sh.strokes.length });
  }
  return (
    <figure className="easel">
      <canvas ref={ref} aria-label={label} />
      <figcaption>{label}</figcaption>
    </figure>
  );
}
export function Easels() {
  const { t } = E;
  const n = E.easelCount();
  if (!n) return null;
  return (
    <section className="easels" aria-label={t('easel.title')}>
      {Array.from({ length: n }, (_, i) => <EaselCard key={i} i={i} />)}
    </section>
  );
}
