// Données du jeu. Les textes affichés sont dans src/i18n : ici, uniquement des identifiants et des chiffres.

export type PatternId = 'star' | 'whirl' | 'cubes' | 'flower' | 'penrose';
export type MachineId = 'fil' | 'spiro' | 'harmo';
export type FlipId = 'table' | 'whirl' | 'rosace';
export type RuleId = 'fils' | 'spirale' | 'table' | 'rosace';
export type UpgradeId = 'hand' | 'speed' | 'auto' | 'detail' | 'finish' | 'gallery' | 'screen';
export type TechId = 'chevalet' | 'geste' | 'main' | 'neon' | 'reserve' | 'retenus' | 'archives' | 'reliure' | 'fonds';
export type FxId = 'spark' | 'trail' | 'inks' | 'burst' | 'gold';
export type InkId = 'graphite' | 'sanguine' | 'prusse' | 'or' | 'neon';

/** Équilibrage des gains d'un dessin.
 *  Valeur d'un trait = valeur du motif × longueur × strokeValue (× hatchValue pour l'ombrage) × multiplicateurs.
 *  Un dessin terminé ajoute completionBonus × la somme de ses traits. */
export const BALANCE = { strokeValue: 1, hatchValue: 1.6, completionBonus: 0.5 };

/** Motifs de base, dans l'ordre de déblocage (l'index sert de clé dans la sauvegarde). */
export const PATTERNS: { id: PatternId; mult: number; cost: number; notes: number[] }[] = [
  { id: 'star', mult: 1, cost: 0, notes: [523, 659, 784] },
  { id: 'whirl', mult: 5, cost: 500, notes: [587, 740, 880] },
  { id: 'cubes', mult: 25, cost: 6000, notes: [659, 831, 988] },
  { id: 'flower', mult: 125, cost: 80000, notes: [523, 698, 880, 1047] },
  { id: 'penrose', mult: 650, cost: 1.2e6, notes: [440, 554, 659, 880, 1109] },
];

/** Maîtrise des motifs de base : chaque dessin terminé fait progresser le motif.
 *  Niveau l → l+1 après need(l) dessins ; chaque niveau rend le motif plus complexe et ajoute bonus à sa valeur. */
// Niveaux sans limite ; la complexité visuelle, elle, s'arrête à geoCap pour que le nombre de traits reste raisonnable.
export const MASTERY = { max: Infinity, need: (l: number) => 3 + 2 * l, bonus: .01, levelUpReward: 4, geoCap: 10 };
/** Maîtrise des animations : un niveau par film terminé, sans limite (complexité visuelle plafonnée à FLIP_GEO_CAP). */
export const FLIP_MASTERY_MAX = Infinity;
export const FLIP_GEO_CAP = 6;

/** Paramètre réglable : [clé, min, max, pas, défaut]. */
export type Param = [string, number, number, number, number];

/** Machines à dessiner : mises de côté pour l'instant (le code reste, il suffit de repasser à true). */
export const ENABLE_MACHINES = false;
/** Atelier (motifs personnalisés) : mis de côté aussi. */
export const ENABLE_ATELIER = false;
/** Serveur Discord du jeu (Réglages > Communauté). Invitation permanente. */
export const DISCORD_URL = 'https://discord.gg/47MtAeYax3';

export const MACHINES: Record<MachineId, { need: number; mult: number; params: Param[] }> = {
  fil: { need: 1, mult: 1.3, params: [['N', 60, 240, 6, 150], ['k', 2, 119, 1, 61], ['k2', 0, 119, 1, 37]] },
  spiro: { need: 3, mult: 1.6, params: [['r', 20, 90, 1, 56], ['d', .25, 1, .01, .8], ['n', 1, 3, 1, 2]] },
  harmo: { need: 4, mult: 2, params: [['q', 0, 4, 1, 1], ['det', 0, .03, .001, .006], ['damp', .003, .012, .0005, .005]] },
};
export const MACHINE_IDS = Object.keys(MACHINES) as MachineId[];

/** Animations du folioscope : la première est offerte, les suivantes s'achètent (et restent acquises d'un carnet à l'autre). */
export const FLIPS: Record<FlipId, { pingpong?: boolean; cost: number }> = { table: { pingpong: true, cost: 0 }, whirl: { cost: 1e5 }, rosace: { cost: 1e6 } };
export const FLIP_IDS = Object.keys(FLIPS) as FlipId[];
export const FOLIO_N = 24;
/** Le folioscope se débloque la première fois que le joueur débloque ce motif (index dans PATTERNS), puis reste acquis. */
export const FOLIO_NEED_PATTERN = 4; // Triangle impossible

export const RULES: Record<RuleId, { params: Param[] }> = {
  fils: { params: [['a', 3, 12, 1, 6], ['b', 1, 5, 1, 1], ['n', 5, 28, 1, 10]] },
  spirale: { params: [['a', 3, 8, 1, 5], ['b', .04, .3, .01, .1], ['n', 8, 60, 1, 24]] },
  table: { params: [['a', 2, 20, .5, 3], ['b', 0, 20, 1, 0], ['n', 40, 240, 10, 120]] },
  rosace: { params: [['a', 3, 24, 1, 8], ['b', .15, .55, .01, .35], ['n', 1, 4, 1, 2]] },
};
export const RULE_IDS = Object.keys(RULES) as RuleId[];
export const MAX_CUSTOM = 6;
export const ATELIER_COST = 20000;

/** Améliorations. Coût du niveau l : base × gr^l × acc^(l(l-1)/2). acc > 1 fait accélérer la hausse des coûts :
 *  plus on monte, plus chaque niveau coûte proportionnellement cher (murs progressifs). */
export const DETAIL_GEO_CAP = 8, FINISH_FX_CAP = 5;

export const UPGRADES: { id: UpgradeId; base: number; gr: number; acc: number; max: number }[] = [
  { id: 'hand', base: 25, gr: 2.4, acc: 1.02, max: Infinity },
  { id: 'speed', base: 15, gr: 1.9, acc: 1.02, max: Infinity },
  { id: 'auto', base: 90, gr: 1.75, acc: 1.02, max: Infinity },
  { id: 'detail', base: 300, gr: 3.5, acc: 1.05, max: Infinity },   // densité visuelle plafonnée à DETAIL_GEO_CAP
  // Hachures : 1 hachures, 2 hachures croisées, 3 estompe, 4 grain de graphite, 5 encrage
  { id: 'finish', base: 400, gr: 8, acc: 1.1, max: Infinity },     // effets visuels jusqu'au niveau 5, puis valeur seule
  { id: 'gallery', base: 150, gr: 2.6, acc: 1.03, max: Infinity },
  // Projecteur : visible une fois le folioscope débloqué, accélère la projection des films
  { id: 'screen', base: 2e4, gr: 2.2, acc: 1, max: 20 },          // 120 images/s au niveau 20, rien à gagner au-delà
];

/** Techniques achetées avec les pages. Coût du niveau n (0 = premier achat) : ceil(base × gr^n).
 *  max = Infinity : améliorable sans fin. */
export const TECHS: { id: TechId; base: number; gr: number; max: number }[] = [
  { id: 'chevalet', base: 12, gr: 2.2, max: 7 },        // un chevalet de plus : un autre motif dessiné en même temps
  { id: 'reliure', base: 2, gr: 1.5, max: Infinity },   // revenus ×1,15 par niveau
  { id: 'fonds', base: 1, gr: 1.6, max: Infinity },     // graphite de départ à chaque carnet
  { id: 'main', base: 1, gr: 1.4, max: 10 },            // Main sûre de départ : +2 niveaux par niveau
  { id: 'reserve', base: 2, gr: 1.35, max: 20 },        // Porte-mine de départ : +3 niveaux par niveau
  { id: 'archives', base: 3, gr: 1.5, max: 8 },         // galerie conservée : 20 % puis +10 % par niveau
  { id: 'retenus', base: 3, gr: 1.8, max: 4 },          // motifs qui restent débloqués, un de plus par niveau
  { id: 'geste', base: 1, gr: 1, max: 1 },              // Hachures dès le départ
  { id: 'neon', base: 2, gr: 1, max: 1 },               // encre néon
];

export const FX_IDS: FxId[] = ['spark', 'trail', 'inks', 'burst', 'gold'];

export const INKS: Record<InkId, { rgb?: string; dark?: string; glow: string }> = {
  graphite: { glow: '255,188,86' },
  sanguine: { rgb: '176,62,40', dark: '236,124,98', glow: '255,112,76' },
  prusse: { rgb: '22,60,140', dark: '124,172,255', glow: '96,172,255' },
  or: { rgb: '166,122,30', dark: '242,202,112', glow: '255,212,110' },
  neon: { rgb: '212,24,148', dark: '255,86,204', glow: '64,255,222' },
};

export const PAPERS = [
  { id: 'white', bg: '#fbfbf9', ink: '42,44,48' },
  { id: 'kraft', bg: '#d7c29d', ink: '48,36,24' },
  { id: 'blue', bg: '#dde6ef', ink: '26,38,74' },
  { id: 'black', bg: '#25262a', ink: '238,238,232', dark: true },
];

/** Prix de « Fascination » (passage à l'étape 2), en pages à dépenser. */
export const FASC_PAGES = 1000;
