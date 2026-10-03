import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as E from '../engine/game';

/** Re-rend le composant à chaque mise à jour du moteur (environ 10 fois par seconde). */
export function useGame() {
  return useSyncExternalStore(E.subscribe, E.getVersion);
}

/** Petit canvas redessiné seulement quand `sig` change (les traits sont calculés à la demande). */
export function MiniCanvas(props: {
  sig: string; make: () => any[]; w: number; h?: number; bg?: string; ink?: string | null;
  fill?: number; cy?: number; nails?: () => any; className?: string; label?: string; fin?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { sig, make, w, h = w, bg = '#fbfbf9', ink = '42,44,48', fill = .84, cy = .5, nails, className, label, fin = 0 } = props;
  useEffect(() => {
    if (ref.current) E.renderMini(ref.current, make(), { w, h, bg, col: ink, fill, cy, nails: nails ? nails() : null, fin });
  }, [sig, w, h, bg, ink, fin]);
  return <canvas ref={ref} className={className} style={{ width: w, height: h }} aria-label={label} aria-hidden={label ? undefined : true} />;
}

export function Slider(props: { id: string; label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void; onCommit?: () => void }) {
  const { id, label, value, min, max, step, display, onChange, onCommit } = props;
  return (
    <label className="slider" htmlFor={id}>
      <span className="row"><span>{label}</span><output>{display}</output></span>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        onPointerUp={onCommit} onKeyUp={onCommit} onBlur={onCommit} />
    </label>
  );
}

export function Chips<K extends string>(props: { items: { id: K; label: string }[]; value: K; onPick: (k: K) => void; label: string }) {
  return (
    <div className="chips" role="group" aria-label={props.label}>
      {props.items.map(it => (
        <button key={it.id} type="button" className="chip" aria-pressed={it.id === props.value} onClick={() => props.onPick(it.id)}>{it.label}</button>
      ))}
    </div>
  );
}

/** Bouton à double clic de confirmation (le second clic doit arriver dans les 3,5 s). */
export function ConfirmButton(props: { label: string; confirmLabel: string; onConfirm: () => void; disabled?: boolean; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const id = setTimeout(() => setArmed(false), 3500); return () => clearTimeout(id); }, [armed]);
  return (
    <button type="button" className={props.className} disabled={props.disabled}
      onClick={() => { if (!armed) { setArmed(true); return; } setArmed(false); props.onConfirm(); }}>
      {armed ? props.confirmLabel : props.label}
    </button>
  );
}
