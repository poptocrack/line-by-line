# Trait pour trait

Jeu incrémental de dessins géométriques au porte-mine. React 18 + TypeScript, construit avec esbuild en un seul fichier HTML autonome.

## Mettre le jeu en ligne (GitHub Pages + GoatCounter)

1. **Créer le dépôt** sur GitHub, puis depuis ce dossier :
   ```bash
   git init && git add . && git commit -m "Trait pour trait"
   git branch -M main
   git remote add origin git@github.com:poptocrack/line-by-line.git
   git push -u origin main
   ```
2. **Activer Pages** : Settings > Pages > Source : « GitHub Actions ». Le workflow `.github/workflows/deploy.yml`
   construit et publie le jeu à chaque push sur `main` (onglet Actions pour suivre). Adresse :
   `https://poptocrack.github.io/line-by-line/`.
3. **Statistiques** : site GoatCounter `poptocrack` (https://poptocrack.goatcounter.com), code renseigné dans le
   dépôt : Settings > Secrets and variables > Actions > Variables > `GOATCOUNTER_CODE`. Après un changement, relancer le workflow
   (Actions > Publier sur GitHub Pages > Run workflow).
4. **Nom de domaine** (facultatif) : Settings > Pages > Custom domain. À choisir dès le début : la sauvegarde des
   joueurs est liée à l'adresse du site.

Statistiques envoyées (sans cookies, aucune donnée personnelle) : une visite, nouvelle partie ou retour, puis chaque
étape atteinte une fois par nuit (premier dessin, motifs débloqués, carnets 1 et 5, folioscope, premier film,
Fascination, première prise de main et dessin final en étape 2), avec une tranche de temps de jeu (`etape/nuit-1/carnet-1/5-15min`).
Rien n'est envoyé sans `GOATCOUNTER_CODE`, si le navigateur demande « Do Not Track », ou si le joueur coupe les
statistiques dans les Réglages. Code : `src/analytics.ts`.

Les polices sont intégrées au fichier (paquets @fontsource, `src/fonts.css`) : aucune requête vers Google Fonts.

Le dossier `public/` est copié tel quel dans `dist/` au build (ex. `incrementaldb.txt`, preuve de propriété pour incrementaldb).
Lien Discord des Réglages (section Communauté) : `DISCORD_URL` dans `src/engine/data.ts`.

## Commandes

```bash
npm install
npm run build      # produit dist/index.html (CSS et JS inclus en ligne)
npm run watch      # reconstruit à chaque modification, ouvrir dist/index.html
npm run typecheck  # vérification TypeScript (le moteur est encore en @ts-nocheck)
```

## Organisation

```
src/
  engine/           Moteur, sans aucune dépendance à React
    geometry.ts     Traits (segment, arc, polyligne), hachures, générateurs de motifs,
                    machines, images du folioscope, règles de l'atelier
    data.ts         Tables du jeu : identifiants et chiffres uniquement (coûts, multiplicateurs…)
    game.ts         État + sauvegarde, formules d'économie, rendu canvas (feuille, porte-mine,
                    lueur, étincelles), son (Web Audio), boucle, actions appelées par l'interface
  i18n/
    fr.ts, en.ts    Tous les textes affichés (pluriels via { one, other })
    index.ts        Détection de langue, t(clé, variables), formatage des grands nombres
  ui/
    App.tsx         Mise en page, tiroir, toasts, outils de test
    Layout.tsx      Barre du haut, liste des motifs, stats, améliorations, feuille, galerie
    Panels.tsx      Tiroir : atelier, machines, folioscope, carnet, réglages
    common.tsx      useGame (abonnement au moteur), MiniCanvas, Slider, Chips, ConfirmButton
  styles.css
```

Le moteur tourne dans sa propre boucle `requestAnimationFrame` et dessine directement dans les canvas.
L'interface React s'abonne au moteur via `useSyncExternalStore` (`subscribe` / `getVersion`) : le moteur
notifie environ 10 fois par seconde et après chaque action. Les événements ponctuels (toast, chiffre
flottant, envol vers la galerie) passent par `hooks` dans `game.ts`.

## Grands nombres

Toutes les quantités de graphite (graphite, total, galerie, valeur des dessins, films) sont des `Decimal` de
[break_eternity.js](https://github.com/Patashu/break_eternity.js) : pas de plafond pratique. Dans le moteur, `D(x)` convertit
un nombre en `Decimal`, `afford(coût)` teste si le joueur peut payer. Les coûts et multiplicateurs restent des `number`.
La sauvegarde écrit les `Decimal` en chaînes et les relit au chargement (les anciennes sauvegardes en nombres sont converties).
L'affichage (`makeFmt` dans `src/i18n/index.ts`) passe des suffixes (k, M, Md…) à la notation scientifique au-delà.

## Équilibrage

`BALANCE` dans `src/engine/data.ts` : valeur d'un trait (`strokeValue`), bonus des traits d'ombrage (`hatchValue`) et bonus de fin de dessin (`completionBonus`, en part de la somme des traits).

Améliorations (`UPGRADES`) : sans niveau max (sauf le Projecteur), coût du niveau l = `base × gr^l × acc^(l(l-1)/2)`. `acc` > 1 fait accélérer la hausse des coûts. La densité des motifs (Précision) et les effets de Hachures s'arrêtent à `DETAIL_GEO_CAP` et `FINISH_FX_CAP`, la valeur continue de monter.

## Interrupteurs

- `ENABLE_ATELIER` dans `src/engine/data.ts` : l'atelier (motifs personnalisés) est désactivé pour l'instant, code conservé.
- Chevalets : technique `chevalet` dans `TECHS` ; logique dans la section « Chevalets » de `game.ts`.
- `ENABLE_MACHINES` dans `src/engine/data.ts` : les machines à dessiner (fil tendu, spirographe, harmonographe) sont désactivées pour l'instant. Le code est conservé ; repasser à `true` les réactive.
- Folioscope : se débloque au premier achat du motif `FOLIO_NEED_PATTERN` (Triangle impossible) ; coûts des animations dans `FLIPS` (`src/engine/data.ts`).

- Maîtrise des animations : un niveau par film terminé, sans limite ; la complexité visuelle s'arrête à `FLIP_GEO_CAP` (voir `FLIP_FRAME`, paramètre `m`).
- Maîtrise des motifs : `MASTERY` dans `src/engine/data.ts` (niveaux sans limite, +1 % par niveau, dessins requis, récompense, plafond de complexité `geoCap`). La complexité par niveau est dans les générateurs de `geometry.ts` (paramètre `m`).

## Étape 2 : Fascination (prototype)

- Déclencheur : l'amélioration « Fascination » apparaît après 10 films et au moins un carnet fermé (`fascVisible` dans `game.ts`). Elle coûte `FASC_PAGES` pages (1000, `src/engine/data.ts`), payées à l'entrée de l'étape 2, explique qu'on ne revient pas en arrière et prévient avant de basculer.
- La bascule (`App.tsx` + styles `.bascule`) : le crayon s'emballe (`setFrenzy`), l'interface tombe, le tapis se tord, puis le noir.
- `src/stage2/illusions.ts` : les illusions (Necker, Kanizsa, Hermann, Fraser, Rubin, moiré), valeurs et coûts.
- `src/stage2/stage2.ts` : heures, présence, prise de main, intrusions, absence, révélations, yeux, son et rendu. État sauvegardé dans `S.s2`.
- `src/ui/Stage2.tsx` : l'interface écrite dans les marges.
- Pas de défaite : la présence monte avec les illusions finies et la Main étrangère, et sert de multiplicateur (proximité ×1 à ×3). À 100, « il prend ta main » (`startTake`) : pendant `TAKE_DUR` s (+2 s par niveau de Mémoire, 30 s au plus), il trace `TAKE_RATE` traits/s en plus et les heures sont multipliées (`takeMultAt`, en plus de la proximité). Puis la présence retombe à zéro.
- Le dessin final : 10 morceaux (`PIECES`) achetés avec les heures, chacun `PIECE_GR` fois plus cher que le précédent (`pieceCost`). Le dernier termine la nuit. Environ 12 min en jouant, 16 min en laissant la Main étrangère jouer seule (mesuré avec `tools-sim-etape2.py`).
- Marques : Main étrangère (automatisation, continue pendant l'absence à 50 % de son rythme), Œil ouvert (heures), Veille (vitesse), Mémoire (prise de main plus longue et plus forte). Toutes aident, aucune n'a de contrepartie.
- La boucle : terminer le dessin final propose « Fermer le carnet » (`newCycle` dans `game.ts`). Le carnet se ferme comme à l'étape 1 (ses pages sont gagnées, voir `nextSketchbook`), avec en plus revenus ×3 par nuit traversée (`NIGHT_MULT`, ×3, ×9, ×27…) et un trophée. Pages, techniques, folioscope et films sont conservés. Pendant la nuit, la galerie et les trophées continuent de rapporter (ce graphite compte pour les pages du carnet).
- Nuits suivantes plus courtes : la Main étrangère commence au niveau 2 × nuits traversées (`startHand`, 10 au plus) et le dessin coûte deux fois moins par nuit traversée (`pieceDiscount`).
- Outils de test : « Montrer Fascination (+ pages) » dans le panneau de test (donne les pages manquantes) ; en étape 2 avec `#dev` : +20 présence, +1000 heures, retour à l'étape 1.

## Ajouter une langue

1. Copier `src/i18n/en.ts` en `src/i18n/xx.ts` et traduire les valeurs.
2. L'ajouter dans `DICTS`, `LANGS` et `SUFFIX` de `src/i18n/index.ts`.

## Outils de test

Maj+Alt+D (ou `#dev` dans l'adresse) : graphite ×100 et +1 carnet fermé.

La sauvegarde est dans `localStorage` (clé `trait-pour-trait-v1`), compatible avec les versions précédentes du prototype.
