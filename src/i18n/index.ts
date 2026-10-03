import Decimal from 'break_eternity.js';
import fr from './fr';
import en from './en';

export type Lang = 'fr' | 'en';
export const LANGS: { id: Lang; name: string }[] = [{ id: 'fr', name: 'Français' }, { id: 'en', name: 'English' }];
const DICTS: Record<Lang, Record<string, any>> = { fr, en };

export type Vars = Record<string, string | number>;
export type T = (key: string, vars?: Vars) => string;

export function detectLang(): Lang {
  const n = (navigator.languages && navigator.languages[0]) || navigator.language || 'fr';
  return n.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

/** Fonction de traduction : interpolation {clé} et pluriel selon vars.n. */
export function makeT(lang: Lang): T {
  const dict = DICTS[lang], plural = new Intl.PluralRules(lang);
  return (key, vars = {}) => {
    let v = dict[key] ?? DICTS.fr[key] ?? key;
    if (typeof v === 'object') v = v[plural.select(Number(vars.n ?? 0))] ?? v.other;
    return String(v).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '') as string);
  };
}

const SUFFIX: Record<Lang, string[]> = {
  fr: ['k', 'M', 'Md', 'Bn', 'Bd', 'Tn', 'Td', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'],
  en: ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'],
};

/** Formatage des grands nombres, avec suffixes adaptés à la langue. */
export function makeFmt(lang: Lang) {
  const loc = lang === 'fr' ? 'fr-FR' : 'en-US', sep = lang === 'fr' ? '\u202f' : '';
  const nf = new Map<number, Intl.NumberFormat>();
  const fmtExp = (e: number): string => { const t = Math.floor(Math.log10(e) / 3), u = SUFFIX[lang]; return t <= u.length ? f(1).format(e / Math.pow(10, t * 3)) + '\u202f' + u[t - 1] : f(2).format(e / Math.pow(10, Math.floor(Math.log10(e)))) + 'e' + Math.floor(Math.log10(e)); };
  const f = (d: number) => { if (!nf.has(d)) nf.set(d, new Intl.NumberFormat(loc, { maximumFractionDigits: d })); return nf.get(d)!; };
  return (x: number | Decimal, dec = 0) => {
    const d = x instanceof Decimal ? x : new Decimal(x);
    if (d.isNan()) return '?';
    if (!d.isFinite()) return '∞';
    if (d.abs().lt(1e4)) { const n = d.toNumber(); return f(dec).format(dec ? n : Math.floor(n)); }
    const u = SUFFIX[lang], l = d.abs().log10(), e = l.floor().toNumber(), tier = Math.floor(e / 3);
    if (tier <= u.length) {
      const n = d.div(Decimal.pow(10, tier * 3)).toNumber(), suf = u[tier - 1];
      return f(n < 10 ? 2 : n < 100 ? 1 : 0).format(n) + (sep || (suf.length > 1 ? '\u202f' : '')) + suf;
    }
    // Au-delà des suffixes : mantisse et exposant (l'exposant est lui-même formaté s'il devient énorme)
    if (isFinite(e) && e < 9e15) {
      const mant = Math.pow(10, l.sub(e).toNumber());
      return f(2).format(mant) + 'e' + (e < 1e6 ? f(0).format(e) : fmtExp(e));
    }
    return d.toStringWithDecimalPlaces(2);
  };
}
export type Fmt = ReturnType<typeof makeFmt>;
