# PLAN — Atelier Tileset (conversion de tilesets vers CPC)

**Date**: 2026-08-28 · **Statut**: décisions arrêtées, aucun code écrit · **Branche**: —

> Relevé de conception d'une **nouvelle feature** : un atelier convertissant une
> planche de tuiles d'une autre machine (NES, Master System, SNES…) vers les
> contraintes de l'Amstrad CPC. 35 décisions arrêtées au terme d'une session de
> cadrage ; ce fichier en est la source de vérité versionnée.
>
> Version lisible et partageable (mise en page, schémas) :
> <https://claude.ai/code/artifact/4f29d1a2-8276-42f3-a073-8f5f92bd0801>
>
> Construire outside-in via le skill `new-feature-hexa`, cœur pur en `tdd-cycle`,
> chaque tranche close par `quality-gate` et `/session-report`.

## Où on en est

> Point de reprise canonique de cette feature. `docs/refactor/STATUS.md` est
> archivé et concerne un autre effort — ne pas l'utiliser ici.

- **Branche** : `docs/tileset-workshop-plan` — non poussée, pas de PR. Le nom dit
  `docs/` alors qu'elle porte du code : à renommer si elle devient la PR de T1.
- **T2 TERMINÉE** — géométrie, un commit :
  `SOURCE_PIXEL_ASPECT` (table des PAR sources, Q8), `aspectDistortion`,
  `idealTileHeight` / `idealTileWidth` et `candidateTileSizes` dans
  `pixsaur-tileset` (CPC-libre, le pixel destination arrive en paramètre) ; le
  use-case `suggestTileGeometry` résout le mode CPC via `CPC_MODE_CONFIG`
  (`scaleX`/`scaleY`, pas les PAR physiques) et assemble le tout pour le panneau
  de T7. Départages des candidats : |déformation| puis proximité à la demande —
  une taille déjà parfaite n'est jamais dissuadée d'elle-même.
- **T1 TERMINÉE** — 4 cycles rouge-vert, un commit chacun :
  1. `sliceSheet` + le use-case `convertTileset` (pur, sync, total, **sans
     port**) + `src/tileset` enregistré dans le garde de layering.
  2. `resizeTileNearest` — échantillonnage **local à la tuile**.
  3. Quantification contre une palette partagée, via
     `quantizeColorForHardware` ; erreur `palette-overflow` au-delà du budget.
  4. `pixsaur-png` — encodeur PNG indexé, plus l'assemblage sur la grille source
     (Q10) et le pré-étirement (Q9).
- **Prochaine action** : T3 (dédup et grille — hash de tuile, lien d'instances,
  suggestion de grille classée par taux de doublons).
- **Dette assumée dans T1** : la palette est construite en ordre de première
  apparition, pas par histogramme sur tuiles uniques — c'est T5. Le resize est
  plus-proche-voisin, pas la sélection exhaustive de colonnes — c'est T4.
- **Dette assumée dans T2** : `suggestTileGeometry` conseille, il ne contraint
  pas — `convertTileset` accepte toujours n'importe quelle taille cible sans
  signaler la déformation. Le rapprochement se fera quand T7 câblera le panneau.
  Le voisinage de recherche des candidats est fixé à ±2 par défaut ; c'est un
  paramètre, pas une constante gravée.
- Historique détaillé : `docs/features/sessions/` (local-only, non versionné).

## Raison d'être

La sortie est un **simple PNG** : ni binaire, ni `.asm`, ni table d'index, ni DSK.
La valeur de l'outil n'est donc pas l'export — c'est **l'isolation par tuile**.
Deux propriétés la justifient, qu'un traitement pleine image ne peut pas offrir.

**Le déterminisme.** Avec un facteur d'échelle non entier, un resize sur la planche
entière donne à chaque tuile une phase d'échantillonnage différente. Deux tuiles
source identiques sortent **différentes**, ce qui suffit à détruire la déduplication
et, avec elle, le lien d'édition.

```
SOURCE (px)    0    2    4    6    8   10   12   14   16
               |----|----|----|----|----|----|----|----|
               [===== tuile A =====][===== tuile A =====]
               ^ frontière          ^ frontière

DEST (×0,571)  |------|------|------|------|------|------|
               0     1,75   3,50   5,25   7,00   8,75      (repères en px source)

               tuile 0 démarre à 0,00 px dest  ->  phase 0,00
               tuile 1 démarre à 4,57 px dest  ->  phase 0,57
```

Un resize **par tuile** supprime le problème par construction.

**La petitesse.** Passer de 8 à 4,57 pixels de large demande de supprimer ou fusionner
des colonnes. Sur une tuile de 8 px, choisir lesquelles est un espace de `C(8,3) = 56`
possibilités : exhaustivement optimisable. Sur une image de 320 px c'est intraitable, et
l'approximation produit des ondulations. Sur du pixel art, supprimer une colonne
dupliquée est sans perte, là où moyenner deux colonnes est toujours destructeur.

## Décisions

### Géométrie et ratio

Le pixel source n'est pas carré. Le pixel CPC non plus.

- **Q1 · Q7 — La taille destination se saisit, le ratio se déduit.** L'utilisateur
  déclare la taille de tuile destination **en pixels CPC entiers**. Le ratio idéal est
  calculé, la déformation résiduelle affichée en pourcentage, les tailles entières les
  plus proches proposées. Le ratio n'est jamais une saisie. Convention de calcul :
  `CPC_MODE_CONFIG` (`scaleX`/`scaleY`), **pas** les PAR physiques 4:3 — cohérence avec
  le reste de l'application.
- **Q8 — Presets de ratio pixel par plateforme source.** NES NTSC 8:7, NES PAL 11:8,
  Master System et SNES 8:7, Game Boy 1:1, PC 1:1, plus saisie libre. Sans cette table,
  tout le monde suppose des pixels carrés et se trompe de 14 % dès la première conversion.
- **Q4 · Q25 — Modes 0, 1 et 2 standard ; CPC classique et Plus.** L'overscan n'a pas de
  sens pour une tuile, qui n'a pas de notion d'écran. EGX et Mode R sont exclus : ils
  fonctionnent par scanline, incompatible avec une tuile réutilisable. Le matériel Plus
  (4096 couleurs contre 27) est dans le périmètre dès la v1, il est déjà porté par le
  domaine.

### Entrée

- **Q5 — Une planche, plus une grille complète** : taille de tuile, marge, espacement,
  offset, dès la v1. Sans marges ni espacements, la moitié des tilesets existants sont
  illisibles. L'import de fichiers individuels viendra plus tard.
- **Q29 — Grille manuelle, candidats classés par taux de doublons.** La bonne taille de
  tuile est celle qui **maximise le nombre de doublons exacts** : une grille décalée d'un
  seul pixel fait tomber le taux de déduplication à zéro. On teste les diviseurs
  plausibles (8, 16, 24, 32…) et on les classe sur ce critère, objectif et déjà calculé
  par ailleurs.

### Palette

Une seule palette pour tout le tileset — le CPC n'en a qu'une à un instant donné.

- **Q3 · Q15 — Histogramme sur les tuiles uniques, pas sur les pixels.** Chaque tuile
  unique pèse 1, quel que soit son nombre d'instances. Compter les pixels ferait qu'un
  ciel uni répété quarante fois écraserait l'histogramme et effacerait les couleurs des
  personnages. Verrouillage manuel de pens possible. Les 12 stratégies de
  `strategy-names.ts` se branchent telles quelles.
- **Q26 · Q28 — Calculée après resize, puis gelée au premier édit.** *Après resize*,
  parce qu'un resize par filtre crée des couleurs intermédiaires absentes de la source :
  calculer sur la source reviendrait à optimiser pour des couleurs jamais affichées.
  *Gelée*, parce que les édits sont stockés en **index de pen** : si la palette dérive,
  le pen 5 qui était bleu foncé devient vert et deux cents tuiles changent de couleur en
  silence. Gel automatique au premier édit ; recalcul possible, explicite et averti.
- **Q16 · Q23 · Q24 — Transparence et réservation partagent le même budget.** La
  transparence occupe un pen réservé (défaut en mode 0) ou l'alpha est aplati sur un fond
  (défaut en modes 1 et 2). La réservation sprites se fait **par compte** : « garde-moi N
  pens libres », retirés de la quantification, du tramage et de l'anti-aliasing. Ils
  restent posables à la main dans l'éditeur, mais **signalés visuellement** — les poser
  par accident ruinerait silencieusement la garantie demandée.

| Mode | Pens | − transparence | − 4 sprites | Verdict |
|---|---:|---:|---:|---|
| Mode 0 | 16 | 15 | 11 | Confortable |
| Mode 1 | 4 | 3 | −1 | Réservation inutilisable |
| Mode 2 | 2 | 1 | −3 | Transparence impossible |

La réservation est donc, en pratique, une fonctionnalité de **mode 0**.

- **Q21 · Q22 — Sous-palettes détectées, enrichissement assumé, collisions rapportées.**
  Les sous-palettes de la source sont retrouvées par groupement des tuiles selon leur jeu
  de couleurs. Une tuile destination a le droit d'utiliser **plus de pens que la tuile
  source n'en avait** : c'est le point fort du CPC, qui n'impose aucune contrainte par
  tuile, et c'est ce qui rend l'anti-aliasing manuel rentable. En regard, un **rapport de
  collision** classe les tuiles par erreur de quantification pour diriger la retouche
  manuelle. L'erreur est déjà calculée ; le classement est presque gratuit.

### Algorithmes

- **Q12 · Q14 — Sélection exhaustive de colonnes, selon un schéma global.** L'algorithme
  phare choisit exactement quelles colonnes et lignes supprimer ou fusionner pour
  minimiser l'erreur ; filtres classiques et plus-proche-voisin verrouillé en phase
  restent disponibles pour comparaison. Le schéma de suppression est **commun à tout le
  tileset** : supprimer la colonne 3 dans une tuile et la colonne 5 dans sa voisine
  désaligne un mur qui était continu. L'alignement prime sur la qualité individuelle.
- **Q13 — Condition de bord détectée automatiquement.** Une tuile de terrain se raccorde
  à elle-même et veut du *wrap* ; un sprite veut du *clamp*. On teste la continuité entre
  première et dernière colonne, avec surcharge manuelle. Se tromper produit soit des
  coutures visibles, soit des halos — l'erreur la plus voyante du lot.
- **Q17 · Q27 — Anti-aliasing et tramage se partagent la tuile, ils ne se succèdent
  pas.** L'AA est une passe dédiée *après* quantification : on détecte les contours en
  escalier et on y place le pen le plus proche de la moyenne des deux côtés. Les deux
  ordres possibles sont mauvais : tramer puis anti-aliaser lisse le bruit de tramage et
  le détruit ; anti-aliaser puis tramer fait disperser par la diffusion d'erreur les
  pixels qu'on venait de placer. La réponse est donc une **partition** : un masque de
  bord attribue les contours à l'AA et les aplats au tramage. Aucun pixel ne subit les deux.
- **Q18 — Tramage global par défaut, surchargeable par tuile.** Un ciel dégradé veut du
  tramage, un sprite net n'en veut pas. Régler deux cents tuiles à la main n'est pas un
  produit.

### Édition et durabilité

- **Q19 · Q11 — On peint des pens, en calque non destructif, propagé par déduplication.**
  Réutilisation de `paintPixels` et `PixelEdit`. On peint un **index de palette, jamais
  un RGB**. Les édits forment un calque rejoué après chaque requantification : la palette
  étant globale, une édition destructive perdrait le travail fait sur toutes les autres
  tuiles. Les tuiles identiques sont liées par hash de contenu — éditer l'une propage à
  ses N instances, soit couramment 40 % d'édition manuelle en moins.
- **Q31 — Annulation linéaire globale, persistance en IndexedDB.** Une pile par tuile
  casserait l'attente sur Ctrl+Z. Le projet (planche, paramètres, édits, palette gelée)
  est persisté en IndexedDB, avec export/import d'un fichier projet JSON. Le mécanisme de
  session existant ne convient pas : son repli anti-quota *jette l'image*, donc il
  jetterait la planche source.

### Sortie

- **Q20 · Q9 · Q10 — PNG indexé, pré-étiré, grille conservée.** *Indexé*, palette CPC
  embarquée : c'est ce qui atteste que le fichier est un asset CPC valide et pas une
  image qui y ressemble. *Pré-étiré* par défaut (un pixel mode 0 devient deux pixels
  PNG), parce qu'un PNG qui a l'air faux quand on l'ouvre est un PNG qu'on croit cassé ;
  agrandissement entier optionnel, export en géométrie native en case à cocher. *Grille
  source conservée*, marges et espacements compris, pour permettre le diff visuel
  avant/après — le principal retour dont dispose l'utilisateur pour juger sa conversion.

### Intégration dans pixsaur

- **Q6 · Q32 · Q34 — Un second atelier, avec ses propres atomes.** Commutateur en tête
  d'application (`Image | Tileset`) qui remplace tout le contenu : `app.tsx` n'a
  aujourd'hui ni routeur ni onglets et rend un unique `ImageConverter`. Griser les
  contrôles sans objet serait plus déroutant que ne pas les montrer. Tranche
  `src/tileset/`, espace d'atomes `store/tileset/` distinct — ce sont deux documents
  ouverts en même temps, pas deux vues du même document ; partager `cpcMode` ferait que
  les deux ateliers se marchent dessus et rendrait intenable le gel de palette.
- **Q30 — CPU pur, sans passer par l'adapter.** Une planche 256×256 fait 65 000 pixels,
  moins qu'une frame d'aperçu. La recherche exhaustive de colonnes est branchue, donc
  hostile au GPU. Et surtout, **le GPU n'est pas déterministe entre pilotes** : le
  déterminisme n'est pas un confort ici, c'est la garantie sur laquelle repose la
  déduplication, et donc le lien d'édition.
- **Q35 — Ajustements ponctuels globaux, lissage exclu.** Luminosité, contraste et
  saturation sont ponctuels : les appliquer globalement avant découpe est *exactement*
  équivalent à les appliquer tuile par tuile. Le `smooth` est une convolution, il bave
  d'une tuile sur sa voisine et sur les marges. Borné à une tuile de 8 px, il ne ferait
  presque rien d'utile tout en compliquant le modèle de bord. Exclu.

- **Q33 — Périmètre.**

| Hors périmètre | Partagé avec l'existant |
|---|---|
| Rasters (par scanline) | Sélection matérielle CPC / Plus |
| Mode R | Les 12 stratégies de palette |
| EGX | Tramages blue-noise, Ostromoukhov |
| Dimensions d'écran, overscan | Métriques de distance couleur |
| Crop et positionnement | Machinerie de `paintPixels` |
| Exports SCR, linéaire, DSK, SNA, ZIP | |
| Templates ASM | |
| Le `smooth` du pipeline actuel | |

L'export PNG existant n'est **pas** réutilisable : son encodage est truecolor, la sortie
exigée est indexée.

## Conséquences forcées

Découlent des décisions ci-dessus. Non négociables sans rouvrir l'une d'elles.

| Point | Contrainte | Origine |
|---|---|---|
| Phase du tramage ordonné | Locale à la tuile — sinon deux tuiles dédupliquées tramen&#8203;t différemment | Q11 |
| Diffusion d'erreur | Accumulateur remis à zéro à chaque frontière de tuile | Q12 |
| Motif de tramage | Redémarre à chaque tuile : la grille peut se voir sur des tuiles adjacentes. Inhérent, non corrigeable | Q18 |
| GPU | Exclu — non déterministe entre pilotes | Q30 |
| Pens réservés | Hors quantification, hors tramage, hors anti-aliasing | Q23 |
| Réservation en mode 1 | Inutilisable : 4 − 1 − N ne laisse rien | Q16 |
| Transparence en mode 2 | Arithmétiquement impossible : 2 pens | Q16 |

## Risque principal, assumé

**Une planche NES porte ~25 couleurs distinctes. Une SNES jusqu'à 128. Le mode 0 en
offre 16.**

La contrainte par tuile que le CPC n'a pas est précisément ce qui autorisait la source à
dépasser son propre budget : chaque tuile NES était limitée à 4 couleurs, mais le tileset
entier en cumule 25 sur ses sous-palettes. La palette globale du CPC doit toutes les
absorber.

Toute la valeur de l'outil repose donc sur le **rapport de collision** (Q22) et sur la
retouche manuelle qu'il dirige. Si ce rapport est mauvais, l'outil produit de la bouillie
— et le débordement sera la règle, pas l'exception.

## Reporté en v2

- **Recherche jointe resize + quantification.** Choisir les pixels destination pour
  minimiser l'erreur *après* passage dans la palette, et non avant. C'est le vrai
  optimum ; il faut une palette provisoire issue d'un resize bon marché, puis une
  seconde passe.
- **Double import fond + sprites.** Allocation conjointe des 16 pens entre les deux
  planches — seul moyen de savoir *quelles* couleurs réserver plutôt que combien.
  Rouvrira Q5 (entrée à deux planches).
- **Groupes de palettes.** Une palette par groupe de tuiles, pour des écrans distincts
  dans un même jeu.
- **Ajustements par tuile.** Artistique, pas correctif — les ajustements ponctuels
  globaux sont déjà exacts.
- **Compression réelle du PNG.** `pixsaur-png` émet des blocs zlib *stored*
  (non compressés) plutôt que d'ajouter une dépendance deflate : le PNG est
  valide, l'encodeur reste pur et trivialement déterministe — la garantie sur
  laquelle repose toute la tranche (Q30). Une planche 256×256 sort à ~70 ko pour
  un fichier téléchargé une fois. `fflate` restera ajoutable **sans changer
  l'interface** du module. C'est un choix, pas un oubli.

## Découpe en tranches

Outside-in : on part du besoin du consommateur, le domaine naît sous la traction des
tests. Une tranche = une PR.

| # | Tranche | Contenu | Dépend de |
|---|---|---|---|
| T1 | Squelette marchant | Test d'acceptation `convertTileset` sur le cas trivial (planche 16×16, deux tuiles 8×8, mode 0, plus-proche-voisin, pas de tramage, PNG indexé). Fait naître les types de tuile, la découpe et le port d'encodage. Rien d'optimal, tout de bout en bout | — |
| T2 | Géométrie | Table des PAR sources, ratio dérivé, tailles entières candidates, déformation résiduelle | T1 |
| T3 | Dédup et grille | Hash de tuile, lien d'instances, suggestion de grille classée par taux de doublons | T1 |
| T4 | Resize | Sélection exhaustive de colonnes, schéma global, condition de bord auto-détectée | T2, T3 |
| T5 | Palette | Histogramme sur tuiles uniques, branchement des 12 stratégies, réservation, transparence, gel, rapport de collision | T4 |
| T6 | Rendu | Masque de bord, partition AA / tramage, phase locale, reset de diffusion | T5 |
| T7 | Atelier | `store/tileset/`, panneaux, commutateur dans `app.tsx`, i18n | T6 |
| T8 | Édition | `paintPixels` réutilisé, calque non destructif, propagation par dédup, undo global | T7 |
| T9 | Durabilité | IndexedDB, export/import projet JSON | T8 |

T1 à T6 sont du cœur pur (`src/libs/**`, `src/domain/**`) : `tdd-cycle` s'applique, un
test rouge avant chaque ligne. T7 à T9 touchent l'app et passent par
`react-testing-patterns`. Chaque tranche se ferme par `quality-gate` puis
`/session-report`.
