import React, { useRef } from 'react';
import * as E from '../engine/game';
import { RULES, RULE_IDS, MACHINES, MACHINE_IDS, FLIPS, FLIP_IDS, FOLIO_N, MAX_CUSTOM, ATELIER_COST, TECHS, FX_IDS, INKS, InkId } from '../engine/data';
import { HARMO_RATIOS, filNails } from '../engine/geometry';
import { LANGS, Lang } from '../i18n';
import { analyticsConfigured } from '../analytics';
import { Chips, ConfirmButton, MiniCanvas, Slider } from './common';
import type { Panel } from './Layout';

export function Drawer(props: { open: Panel; onClose: () => void }) {
  const { t } = E;
  const title = t(props.open === 'settings' ? 'menu.settings' : 'menu.' + props.open);
  return (
    <aside className="drawer panel" aria-labelledby="drawer-title">
      <div className="drawer-head"><h2 id="drawer-title">{title}</h2><button type="button" className="link" onClick={props.onClose}>{t('common.close')}</button></div>
      <div className="drawer-body">
        <section>
          {props.open === 'atelier' && <AtelierPanel />}
          {props.open === 'machines' && <MachinesPanel />}
          {props.open === 'folio' && <FolioPanel />}
          {props.open === 'carnet' && <CarnetPanel />}
          {props.open === 'settings' && <SettingsPanel />}
        </section>
      </div>
    </aside>
  );
}

const num = (v: number) => E.fmt(v, Number.isInteger(v) ? 0 : 3);

/* ---------------- Atelier ---------------- */
function AtelierPanel() {
  const { S, t, fmt } = E;
  if (!S.atelier) {
    const can = E.afford(ATELIER_COST);
    return <>
      <p className="note">{t('atelier.info')}</p>
      <button type="button" className={'buy wide' + (can ? ' can' : '')} disabled={!can} onClick={E.buyAtelier}>{t('atelier.buy', { c: fmt(ATELIER_COST) })}</button>
    </>;
  }
  const d = S.draft, rule = d.rule as keyof typeof RULES, full = S.custom.length >= MAX_CUSTOM;
  const strokesCount = E.draftStrokes().length;
  return <>
    <p className="note">{t('atelier.info')}</p>
    <Chips label={t('atelier.rulesAria')} value={rule} onPick={E.setDraftRule} items={RULE_IDS.map(id => ({ id, label: t('rule.' + id) }))} />
    {RULES[rule].params.map(([k, min, max, step]) => (
      <Slider key={rule + k} id={'sl-' + k} label={t(`param.${rule}.${k}`)} value={d[k]} min={min} max={max} step={step} display={num(d[k])} onChange={v => E.setDraftParam(k, v)} onCommit={E.save} />
    ))}
    <MiniCanvas sig={JSON.stringify(d) + S.up.detail + S.up.finish} make={E.draftStrokes} w={230} fill={.9} className="preview-canvas" label={t('atelier.previewAria')} />
    <p id="previewinfo">{t('atelier.previewInfo', { n: fmt(strokesCount), m: fmt(E.customMult(), 1) })}</p>
    <button type="button" className={'buy wide' + (full ? '' : ' can')} disabled={full} onClick={E.addCustom}>{full ? t('atelier.full', { n: MAX_CUSTOM }) : t('atelier.add')}</button>
    <ul className="minelist">
      {S.custom.map((c: any) => {
        const name = E.customName(c);
        return <li key={c.id}><span>{name}</span><button type="button" className="link" aria-label={t('atelier.removeAria', { name })} onClick={() => E.removeCustom(c.id)}>{t('atelier.remove')}</button></li>;
      })}
    </ul>
  </>;
}

/* ---------------- Machines ---------------- */
function MachinesPanel() {
  const { S, t } = E;
  const timer = useRef<any>(null);
  const un = MACHINE_IDS.filter(E.machUnlocked);
  const ladder = MACHINE_IDS.map(k => S.carnets >= MACHINES[k].need ? t('machines.unlocked', { name: t('mach.' + k) }) : t('machines.at', { name: t('mach.' + k), n: MACHINES[k].need })).join(', ');
  const k = (un.includes(S.medit) ? S.medit : un[0]) as keyof typeof MACHINES;
  const cfg = k ? S.mcfg[k] : null;
  const commitSoon = () => { clearTimeout(timer.current); timer.current = setTimeout(() => E.commitMachine(k), 350); };
  const disp = (p: string, v: number) => p === 'q' ? `${HARMO_RATIOS[v][0]} : ${HARMO_RATIOS[v][1]}` : num(v);
  return <>
    <p className="note">{un.length ? t('machines.infoOn') : t('machines.infoOff')}</p>
    <p className="note">{ladder}</p>
    {k && <>
      <Chips label={t('machines.chipsAria')} value={k} onPick={E.setMachineEdit} items={un.map(id => ({ id, label: t('mach.' + id) }))} />
      {MACHINES[k].params.map(([p, min, max, step]) => (
        <Slider key={k + p} id={'ms-' + p} label={t(`param.${k}.${p}`)} value={cfg[p]} min={min} max={max} step={step} display={disp(p, cfg[p])}
          onChange={v => { E.setMachineParam(k, p, v); commitSoon(); }} />
      ))}
      <MiniCanvas sig={JSON.stringify(cfg)} make={() => E.machineStrokes(k)} w={200} fill={.9} className="preview-canvas" label={t('machines.previewAria')}
        nails={k === 'fil' ? () => filNails(cfg) : undefined} />
      {k === 'harmo' && <button type="button" className="buy wide can" onClick={E.reseedHarmo}>{t('machines.reseed')}</button>}
    </>}
  </>;
}

/* ---------------- Folioscope ---------------- */
function FolioPanel() {
  const { S, t, fmt } = E;
  if (!E.folioUnlocked()) return <p className="note">{t('folio.locked', { n: FOLIO_N })}</p>;
  const owned = FLIP_IDS.filter(E.flipUnlocked), nextAnim = FLIP_IDS.find(k => !S.flipUnl[k]);
  const list = owned.map(k => t('folio.progressItem', { name: t('flip.' + k), i: S.folio[k], n: FOLIO_N })).join(', ');
  const k = typeof S.sel === 'string' && S.sel.startsWith('f:') && S.flipUnl[S.sel.slice(2)] ? S.sel.slice(2) : [...owned].sort((a, b) => S.folio[b] - S.folio[a])[0];
  const n = S.folio[k], pr = E.getProj(), ok = n >= 2 && !pr;
  return <>
    <p className="note">{t('folio.info', { n: FOLIO_N })}</p>
    <p className="note">{t('folio.films', { n: S.films })} {t('folio.progress', { list })}</p>
    {nextAnim && <p className="note">{t('folio.nextAnim', { name: t('flip.' + nextAnim), c: fmt(FLIPS[nextAnim].cost) })}</p>}
    <button type="button" className={'buy wide' + (ok ? ' can' : '')} disabled={!ok} onClick={() => E.playFolio(k)}>
      {pr ? t('folio.playing') : n >= 2 ? t('folio.play', { name: t('flip.' + k), n }) : t('folio.need2')}
    </button>
  </>;
}

/* ---------------- Carnet ---------------- */
function CarnetPanel() {
  const { S, t, fmt } = E;
  const add = E.pagesFor(S.total), av = E.pagesAvail(), pap = E.paper();
  const gainPct = add >= 1 ? (E.gmWith(add) / E.gm() - 1) * 100 : 0;
  return <>
    <p className="note">{t('carnet.info', { n: S.carnets + 1, paper: t('paper.' + pap.id) })}</p>
    <dl className="stats tight">
      <dt>{t('carnet.pagesTotal')}</dt><dd>{fmt(S.pages)}</dd>
      <dt>{t('carnet.bonus')}</dt><dd>{t('carnet.bonusVal', { p: fmt(S.pages * 10), m: fmt(E.gm(), 1) })}</dd>
      <dt>{t('carnet.avail')}</dt><dd>{fmt(av)}</dd>
    </dl>
    {/* Aperçu de la fermeture : des lignes fixes, pour que le panneau ne saute pas quand les chiffres changent */}
    <dl className="stats tight">
      {add >= 1 && <><dt>{t('carnet.ifClose')}</dt><dd>{t('carnet.ifCloseVal', { n: add })}</dd>
        <dt>{t('carnet.incomeGain')}</dt><dd>{t('carnet.incomeGainVal', { p: fmt(gainPct, gainPct < 1 ? 2 : 1) })}</dd></>}
      <dt>{t(add >= 1 ? 'carnet.nextPage' : 'carnet.firstPage')}</dt><dd>{fmt(E.nextPageAt(add))} g</dd>
      <dt>{t('carnet.earned')}</dt><dd>{fmt(S.total)} g</dd>
    </dl>
    <ConfirmButton className={'buy wide' + (add >= 1 ? ' can' : '')} disabled={add < 1}
      label={add >= 1 ? t('carnet.close', { n: add }) : t('carnet.none')} confirmLabel={t('carnet.confirm')} onConfirm={E.closeCarnet} />
    <h3 className="sub">{t('carnet.techs')}</h3>
    <p className="note">{t('carnet.techNote')}</p>
    <div className="ups">
      {TECHS.map(x => {
        const lvl = E.techLevel(x.id), max = lvl >= x.max, can = E.techCanBuy(x), cost = E.techCost(x);
        const eff = (l: number) => t(`tech.${x.id}.eff`, { v: E.techValue(x.id, l) });
        const text = x.max === 1 ? t(`tech.${x.id}.eff`) : !lvl ? eff(1) : max ? eff(lvl) : `${eff(lvl)} ${t('tech.next', { v: E.techValue(x.id, lvl + 1) })}`;
        return (
          <div className="up" key={x.id}>
            <div><span className="name">{t(`tech.${x.id}.name`)}</span><span className="lvl">{x.max > 1 && lvl ? t('up.level', { n: lvl }) : ''}</span></div>
            <p className="eff">{text}</p>
            <button type="button" className={'buy' + (can ? ' can' : '')} disabled={!can} onClick={() => E.buyTech(x.id)}>
              {max ? (x.max === 1 ? t('tech.owned') : t('up.max')) : t('tech.cost', { n: cost })}
            </button>
          </div>
        );
      })}
    </div>
  </>;
}

/* ---------------- Réglages ---------------- */
function SettingsPanel() {
  const { S, t } = E;
  const got = FX_IDS.filter(id => S.fx[id]), next = FX_IDS.find(id => !S.fx[id]);
  const fxText = (got.length ? t('fx.got', { list: got.map(id => t(`fx.${id}.name`)).join(', ') }) : t('fx.none')) + ' ' +
    (next ? t('fx.next', { name: t(`fx.${next}.name`), hint: t(`fx.${next}.hint`) }) : t('fx.all'));
  const inks = (Object.keys(INKS) as InkId[]).filter(E.inkAvailable);
  const vol = (k: 'draw' | 'fx') => S.vol[k] > 0 ? `${Math.round(S.vol[k] * 100)} %` : t('sound.off');
  return <>
    <h3 className="sub">{t('settings.look')}</h3>
    <p className="note">{fxText}</p>
    {S.fx.inks && inks.length > 1 && <Chips label={t('fx.inksAria')} value={S.ink} onPick={E.setInk} items={inks.map(id => ({ id, label: t('ink.' + id) }))} />}
    {got.length > 0 && <button type="button" className="link" onClick={E.toggleFx}>{S.fxOff ? t('fx.on') : t('fx.off')}</button>}

    <h3 className="sub">{t('settings.sound')}</h3>
    <Slider id="vol-draw" label={t('sound.draw')} value={Math.round(S.vol.draw * 100)} min={0} max={100} step={5} display={vol('draw')} onChange={v => E.setVolume('draw', v / 100)} onCommit={E.save} />
    <Slider id="vol-fx" label={t('sound.fx')} value={Math.round(S.vol.fx * 100)} min={0} max={100} step={5} display={vol('fx')} onChange={v => E.setVolume('fx', v / 100)} onCommit={() => { E.tone([784, 988], .07, .09, .35); E.save(); }} />
    <button type="button" className="link" onClick={E.toggleMute}>{S.muted ? t('sound.unmute') : t('sound.muteAll')}</button>

    <h3 className="sub">{t('settings.language')}</h3>
    <select className="lang" value={S.lang || 'auto'} aria-label={t('settings.language')} onChange={e => E.setLang(e.target.value === 'auto' ? null : e.target.value as Lang)}>
      <option value="auto">{t('lang.auto')}</option>
      {LANGS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
    </select>

    {analyticsConfigured() && <>
      <h3 className="sub">{t('stats.title')}</h3>
      <p className="note">{t('stats.note')}</p>
      <button type="button" className="link" onClick={E.toggleStats}>{S.noStats ? t('stats.on') : t('stats.off')}</button>
    </>}

    <div className="foot"><span /><ConfirmButton className="link" label={t('reset.btn')} confirmLabel={t('reset.confirm')} onConfirm={E.resetAll} /></div>
  </>;
}
