import React, { useEffect, useRef, useState } from 'react';
import * as E from '../engine/game';
import { useGame } from './common';
import { TopBar, MotifList, Stats, Upgrades, Stage, Gallery, flyQueue, Panel } from './Layout';
import { Drawer } from './Panels';
import Stage2 from './Stage2';
import * as S2 from '../stage2/stage2';
import { FASC_PAGES } from '../engine/data';

export default function App() {
  useGame();
  const { t } = E;
  const [open, setOpen] = useState<Panel | null>(null);
  const [mtab, setMtab] = useState<'motifs' | 'ups'>('motifs');
  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null);
  const [floats, setFloats] = useState<{ id: number; text: string; color: string }[]>([]);
  const [bumpBig, setBumpBig] = useState(false);
  const [dev, setDev] = useState(() => /dev/.test(location.hash));
  const pencil = useRef<HTMLCanvasElement>(null);
  // Le canvas du porte-mine change d'élément quand on passe d'une étape à l'autre : on le rebranche à chaque fois
  const pencilRef = (el: HTMLCanvasElement | null) => { if (el && el !== pencil.current) { (pencil as any).current = el; E.attachPencil(el); } };
  const [phase, setPhase] = useState<'stage1' | 'bascule' | 'stage2' | 'dawn'>(() => E.S.stage === 2 ? 'stage2' : 'stage1');
  // Fermer le carnet : nouvelle nuit, l'étape 1 recommence au petit matin
  const closeBook = () => { E.newCycle(); setPhase('dawn'); setTimeout(() => setPhase('stage1'), 5200); };
  // La bascule : le crayon s'emballe, l'interface tombe, le tapis se tord, puis le noir.
  const bascule = () => { E.audio(); setOpen(null); setPhase('bascule'); E.setFrenzy(true); setTimeout(() => { S2.enterStage2(); setPhase('stage2'); }, 6000); };

  // Branchement des événements du moteur vers l'interface
  useEffect(() => {
    let tid: any;
    E.hooks.toast = msg => { setToast({ msg, id: Date.now() }); clearTimeout(tid); tid = setTimeout(() => setToast(null), 4200); };
    E.hooks.float = (text, color) => { const id = Date.now() + Math.random(); setFloats(f => [...f, { id, text, color }]); setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 1300); };
    E.hooks.bigBump = () => { setBumpBig(true); setTimeout(() => setBumpBig(false), 160); };
    E.hooks.fly = snap => { flyQueue.push(snap); };
    E.start();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.shiftKey && e.altKey && e.code === 'KeyD') setDev(d => !d);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const openPanel = (p: Panel) => {
    E.audio();
    setOpen(o => o === p ? null : p);
    if (p === 'machines' || p === 'folio') E.markSeen(p);
  };

  if (phase === 'stage2') return (
    <>
      <Stage2 dev={dev} onCloseBook={closeBook} />
      <canvas id="pencil" ref={pencilRef} aria-hidden="true" />
      <div id="toast" role="status" className={toast ? 'on' : ''}>{toast?.msg}</div>
    </>
  );
  return (
    <div className={phase === 'bascule' ? 'bascule' : undefined}>
      <TopBar open={open} onOpen={openPanel} bump={bumpBig} />
      <main className="app" data-mtab={mtab}>
        <aside className="col col-motifs panel" aria-labelledby="motifs-h">
          <h2 id="motifs-h">{t('motifs.title')}</h2>
          <MotifList />
        </aside>
        <Stage floats={floats} mtab={mtab} setMtab={setMtab} />
        <Gallery />
        <aside className="col col-ups panel" aria-labelledby="ups-h">
          <Stats />
          <div className="ups-head">
            <h2 id="ups-h">{t('ups.title')}</h2>
            <button type="button" className="chip" aria-pressed={!!E.S.buyMax} onClick={E.toggleBuyMax} title={t('up.maxModeHint')}>{t('up.maxMode')}</button>
          </div>
          {E.fascVisible() && <FascinationRow onGo={bascule} />}
          <Upgrades />
        </aside>
      </main>
      {open && <Drawer open={open} onClose={() => setOpen(null)} />}
      <canvas id="pencil" ref={pencilRef} aria-hidden="true" />
      <div id="toast" role="status" className={toast ? 'on' : ''}>{toast?.msg}</div>
      {dev && (
        <div id="dev">
          <b>{t('dev.title')}</b>
          <button type="button" onClick={E.devGraphite}>{t('dev.g')}</button>
          <button type="button" onClick={E.devCarnet}>{t('dev.c')}</button>
          <button type="button" onClick={E.devFascination}>{t('dev.fasc')}</button>
          <button type="button" onClick={() => setDev(false)}>{t('common.close')}</button>
        </div>
      )}
      {phase === 'bascule' && <><div className="warp" aria-hidden="true" /><div className="blackout" aria-hidden="true" /></>}
      {phase === 'dawn' && <div className="dawn" role="status"><p>{t('dawn.title', { n: (E.S.cycles || 0) + 1 })}</p><p className="sub">{t('dawn.sub', { m: E.fmt(E.cycleMult()) })}</p></div>}
    </div>
  );
}

/** « Fascination » : coûte des pages, dit ce qu'elle fait et prévient avant de basculer. */
function FascinationRow(props: { onGo: () => void }) {
  const { S, t, fmt } = E;
  const [armed, setArmed] = useState(false);
  const d = Math.min(3, S.fascIgnored || 0);
  const can = E.fascCanPay();
  return (
    <div className="up fasc">
      <div><span className="name">{t('fasc.name')}</span></div>
      <p className="eff">{t('fasc.d' + d)}</p>
      <p className="fasc-what">{t('fasc.what')}{!can && ' ' + t('fasc.avail', { av: fmt(E.pagesAvail()), n: fmt(FASC_PAGES) })}</p>
      <button type="button" className={'buy' + (can ? ' can' : '')} disabled={!can} onClick={() => { if (!armed) { setArmed(true); return; } props.onGo(); }}>
        {armed ? t('fasc.confirm') : t('fasc.cost', { n: fmt(FASC_PAGES) })}
      </button>
      {armed && <p className="fasc-warn" role="alert">{t('fasc.warn', { n: fmt(FASC_PAGES) })}</p>}
    </div>
  );
}
