import React, { useEffect, useReducer, useRef } from 'react';
import * as E from '../engine/game';
import * as S2 from '../stage2/stage2';
import { ILLUSIONS } from '../stage2/illusions';

/** Étape 2 : l'écran entier est la feuille. Toute l'interface est écrite à la main dans les marges. */
export default function Stage2(props: { dev: boolean; onCloseBook: () => void }) {
  const { t, fmt } = E;
  const ref = useRef<HTMLCanvasElement>(null);
  const [, force] = useReducer(x => x + 1, 0);
  useEffect(() => {
    S2.attach(ref.current!);
    const id = setInterval(force, 150);
    const mv = (e: PointerEvent) => { S2.rt.mouse = [e.clientX, e.clientY]; };
    addEventListener('pointermove', mv);
    return () => { clearInterval(id); removeEventListener('pointermove', mv); S2.detach(); };
  }, []);
  const s = S2.st(), rt = S2.rt, p = s.presence;
  const cur = rt.sheet, curDef = cur && ILLUSIONS.find(x => x.id === cur.id);
  // Chaque marque : nom, phrase d'ambiance, effet chiffré (actuel et niveau suivant)
  const effMain = (l: number) => t('up2.main.eff', { r: fmt(S2.handRateAt(l), 1), p: fmt(S2.handPresAt(l), 2) });
  const effOeil = (l: number) => t('up2.oeil.eff', { m: fmt(S2.eyeMultAt(l), 1), p: S2.eyePresAt(l) });
  const effVeille = (l: number) => t('up2.veille.eff', { x: fmt(S2.vigilAt(l), 2) });
  const effOf: Record<string, (l: number) => string> = { main: effMain, oeil: effOeil, veille: effVeille };
  const marks = [
    ...S2.UP2.map(u => {
      const l = s.up[u.id], f = effOf[u.id];
      return { key: u.id, name: t(`up2.${u.id}.name`), desc: t(`up2.${u.id}.desc`), eff: l ? `${f(l)} ${t('up2.next', { v: f(l + 1) })}` : f(1), lvl: l, cost: S2.up2Cost(u), buy: () => S2.buyUp(u.id) };
    }),
    { key: 'ritual', name: t('s2.ritual.name'), desc: t('s2.ritual.desc'), eff: rt.ritualCd > 0 ? t('s2.ritual.cd', { s: Math.ceil(rt.ritualCd) }) : t('s2.ritual.eff', { n: S2.RITUAL_CALM, s: S2.ritualSeconds(), c: S2.RITUAL_COOLDOWN }), lvl: 0, cost: S2.ritualCost(), buy: S2.ritual, cd: rt.ritualCd > 0 },
  ];
  const cp = cur ? S2.illusionProfile(cur.id) : null;
  const hold = useRef<any>(null);
  const startHold = () => { S2.click(); clearInterval(hold.current); hold.current = setInterval(S2.click, 150); };
  const stopHold = () => clearInterval(hold.current);
  // L'horreur déforme l'apparence, jamais les chiffres : prix et monnaie restent exacts
  const warp = s.calm ? '' : p >= 75 ? ' warp2' : p >= 50 ? ' warp1' : '';
  const notes = s.notes.slice(-9);
  return (
    <div className={'s2' + (s.calm ? ' calm' : '')}>
      <canvas ref={ref} className="s2-canvas" onPointerDown={e => { e.preventDefault(); startHold(); }} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} aria-label={t('s2.hint')} />
      <div className="s2-count">
        <span className="n">{fmt(s.F)}</span> {t('s2.unit')}
        <div className="s2-prox">{t('s2.prox', { m: fmt(S2.proximity(), 2) })}</div>
        <div className="s2-final">{t('s2.final', { p: fmt(S2.finalPct(), 1) })}</div>
        {rt.resting && <div className="s2-rest">{t('s2.rest')}</div>}
        {s.visions > 0 && <div className="s2-visions">{t('s2.visions', { n: s.visions })}</div>}
        {(E.S.cycles || 0) > 0 && <div className="s2-visions">{t('s2.night', { n: E.S.cycles + 1 })}</div>}
      </div>
      <ol className="s2-notes" aria-label={t('s2.notesAria')}>
        {notes.map((k, i) => {
          const idx = s.notes.length - notes.length + i;
          return <li key={k} className={'n' + Math.min(idx, 12) + (idx >= 8 ? ' red' : '')} style={{ transform: `rotate(${((idx * 37) % 7) - 3}deg)` }}>{t('s2note.' + k)}</li>;
        })}
      </ol>
      <div className={'s2-marks' + warp}>
        <h2>{t('s2.marks')}</h2>
        {marks.map(m => (
          <button key={m.key} type="button" className={'s2-mark' + (s.F >= m.cost && !(m as any).cd ? ' can' : '')} onClick={m.buy} disabled={!!(m as any).cd}>
            <b>{m.name}{m.lvl > 0 && <em> {t('up.level', { n: m.lvl })}</em>}</b>
            <span>{m.desc}</span>
            <span className="eff">{m.eff}</span>
            <i>{fmt(m.cost)}</i>
          </button>
        ))}
        <h2>{t('s2.illusions')}</h2>
        {ILLUSIONS.map(d => {
          const un = !!s.unl[d.id], sel = s.sel === d.id;
          return (
            <button key={d.id} type="button" className={'s2-mark ill' + (sel ? ' sel' : '') + (!un && s.F >= d.cost ? ' can' : '')} onClick={() => S2.pickIllusion(d.id)} disabled={!un && s.F < d.cost}>
              <b>{t('ill.' + d.id)}</b>
              {(() => { const pr = S2.illusionProfile(d.id); return <span className="eff">{t('s2.illProfile', { h: fmt(pr.hours), p: Math.round(pr.pres), r: fmt(pr.reveal, 1) })}</span>; })()}
              {!un && <i>{fmt(d.cost)}</i>}
            </button>
          );
        })}
      </div>
      <p className="s2-progress">
        {cur && curDef && cp ? t('s2.preview', { name: t('ill.' + cur.id), i: Math.min(cur.idx + (cur.u > 0 ? 1 : 0), cur.strokes.length), n: cur.strokes.length, h: fmt(cp.end), m: fmt(S2.proximity(), 2), p: Math.round(cp.pres), r: fmt(cp.reveal, 1) }) : ''}
        <span>{t('s2.hint')}</span>
      </p>
      <div className="s2-settings">
        {s.ended && <button type="button" onClick={props.onCloseBook}>{t('s2.endClose')}</button>}
        <button type="button" onClick={S2.toggleCalm} aria-pressed={s.calm}>{s.calm ? t('s2.calmOn') : t('s2.calm')}</button>
        <button type="button" onClick={E.toggleMute}>{E.S.muted ? t('sound.unmute') : t('sound.muteAll')}</button>
        {props.dev && <>
          <button type="button" onClick={S2.devPresence}>{t('s2.dev.presence')}</button>
          <button type="button" onClick={S2.devFascination}>{t('s2.dev.F')}</button>
          <button type="button" onClick={S2.leaveStage2Dev}>{t('s2.dev.back')}</button>
        </>}
      </div>
      {rt.lossT > 0 && <div className="s2-big loss">{t('s2.loss')}</div>}
      {s.ended && !rt.endShown && rt.endT > 2.5 && (
        <div className="s2-end">
          <p>{t('s2.end1')}</p><p className="red">{t('s2.end2')}</p>
          <p className="bonus">{t('s2.endBonus', { m: fmt(E.cycleMult() * 2) })}</p>
          <div className="end-actions"><button type="button" onClick={props.onCloseBook}>{t('s2.endClose')}</button>
          <button type="button" className="quiet" onClick={S2.stayAfterEnd}>{t('s2.endStay')}</button></div>
        </div>
      )}
      {rt.absence > 0 && rt.lossT <= 0 && <div className="s2-big">{t('s2.absence')}</div>}
    </div>
  );
}
