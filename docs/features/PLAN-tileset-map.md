# PLAN — Map et export Tiled dans l'atelier Tileset

**Date** : 2026-09-10 · **Statut** : cadrage clos, M1 à M6 à livrer · **Branche** : `feat/tileset-map`

> Relevé de conception de la suite de l'atelier Tileset. L'atelier sait convertir
> une planche de tuiles. Cette suite lui apprend deux choses :
>
> 1. lire l'image d'une map et en extraire le tileset ;
> 2. exporter la map et le tileset au format [Tiled](https://www.mapeditor.org/).
>
> Le pipeline commun (découpe, resize, palette, rendu, édition) reste décrit dans
> [`PLAN-tileset-workshop.md`](PLAN-tileset-workshop.md). Ce fichier ne décrit que
> ce qui change. Les décisions portent le préfixe **M-Q** pour ne pas se confondre
> avec les Q du premier plan.
>
> Construire outside-in via le skill `new-feature-hexa`, cœur pur en `tdd-cycle`,
> chaque tranche close par `quality-gate`.

## Où on en est

- **Branche** : `feat/tileset-map`, créée depuis `main` après le merge de la
  PR #348. Une seule PR vers `main` à la fin (M-Q24).
- **Prochaine action** : M1.

## Constat de départ

- Le pipeline découpe déjà une grille régulière (`sliceSheet`) et déduplique les
  tuiles **après** la conversion (`dedupeTiles`).
- `ConvertedTileset.instanceOf` associe déjà chaque case à sa tuile unique. Une
  map, c'est donc une planche dont l'atelier garde `instanceOf`.
- Le calque d'édition identifie une tuile par sa **position** dans la grille. Un
  trait retient les positions de toutes les copies au moment du dessin
  (`paint-tileset.ts`). Un changement de grille, de taille, d'image ou de mode
  remet le calque à zéro.
- Le port `FileSink` enregistre un seul blob par appel. `jszip` existe dans
  `src/export/exports/`.

## Décisions

### Périmètre

- **M-Q1 — Un seul atelier.** Un sélecteur « planche » ou « map » choisit la
  disposition de la source. Le mode map change les réglages par défaut (pas de
  margin, pas de spacing), ajoute la vue map et l'export TMX.
- **M-Q2 — Tiled est le format pivot.** L'utilisateur retouche la map dans Tiled,
  puis sa propre chaîne la mène au CPC.
- **M-Q5 — Une image, une map, un tileset.** Le modèle reste ouvert à plusieurs
  maps qui partagent un tileset. Ce cas va au backlog.
- **M-Q6 — Pas de flip.** Le CPC ne sait pas afficher une tuile retournée sans
  coût CPU. La déduplication reste exacte, sans symétrie.

### Import et calage

- **M-Q3 — Sources visées.** Des captures d'émulateur à la résolution native, et
  de grandes maps de niveau issues de sites de rip.
- **M-Q4 — Calage de l'offset.** L'atelier cherche l'offset qui minimise la part
  de tuiles uniques, puis le propose. La saisie manuelle reste possible.
- **M-Q19 — Échelle entière.** L'atelier cherche le plus grand facteur k (×2, ×3,
  ×4) tel que chaque bloc k×k est uniforme, puis propose la réduction. La
  détection vaut dans les deux dispositions et n'a aucune tolérance. Une image
  qui porte trop de couleurs distinctes reçoit un message : elle semble filtrée
  ou compressée, et l'extraction exacte peut échouer.

### Conversion

- **M-Q7 — Budget de tuiles.** Un compteur affiche le nombre de tuiles exportées.
  Un avertissement apparaît au-delà d'un budget réglable, 256 par défaut (un
  index sur un octet).
- **M-Q8 — Une tuile unique, un vote.** L'histogramme de la palette ne change pas
  de règle en mode map.
- **M-Q13 — Tuile vide.** L'utilisateur désigne la tuile qui devient le GID 0 de
  Tiled. Par défaut, c'est la tuile entièrement transparente, si elle existe.
  La tuile vide n'entre ni dans le PNG ni dans le budget.
- **M-Q14 — Écart entre deux tuiles.** La somme des distances perceptuelles entre
  les couleurs des pixels qui diffèrent.
- **M-Q15 — Fusion des quasi-doublons.** Un seuil présélectionne les fusions, et
  l'utilisateur peut en exclure une. La tuile la plus fréquente reste.
- **M-Q18 — Fusion et édition.**
  1. Le pipeline convertit, rejoue les éditions, puis déduplique à l'identique.
  2. La fusion vient en dernier. Elle ne touche aucun pixel. Elle redirige les
     cases de la tuile absorbée vers la tuile qui reste.
  3. Un trait posé sur une case fusionnée modifie la tuile qui reste.
  4. Une fusion exclue est identifiée par la position de première apparition de
     chaque tuile.

### UI

- **M-Q16 — Vue map.** Un onglet « Map » affiche la map reconstruite avec les
  tuiles converties. Le survol d'une case met en évidence toutes les cases qui
  affichent la même tuile. Une bascule compare la source et le résultat.

### Export

- **M-Q10 — Fichiers.** `map.tmx` (XML, layer en encodage `csv`),
  `tileset.tsx` (tileset externe) et `tileset.png`.
- **M-Q17 — Emballage.** Un ZIP qui contient les fichiers, enregistré en un
  seul appel à `FileSink`. Les références relatives restent justes après
  l'extraction.
- **M-Q11 — Géométrie du PNG.** Pixels CPC pré-étirés, comme l'export PNG
  existant. Le TSX porte ces propriétés :

  | Propriété | Type | Contenu |
  |---|---|---|
  | `cpcMode` | int | 0, 1 ou 2 |
  | `hardware` | string | `classic` ou `plus` |
  | `scaleX`, `scaleY` | int | l'étirement d'un pixel CPC dans le PNG |
  | `palette` | string | un mot par pen, séparés par des virgules. Classique : numéro d'encre firmware (0 à 26). Plus : mot ASIC `GRB` en hexadécimal sur 3 chiffres |
  | `paletteRgb` | string | `#RRGGBB` par pen, séparés par des virgules |

- **M-Q12 — Rangement.** Les tuiles suivent l'ordre de première apparition, sur
  16 colonnes, sans gouttière.
- **M-Q20 — Export Tiled en mode planche.** Il produit le TSX et le PNG, sans
  TMX. Les tuiles gardent l'ordre et le nombre de colonnes de la planche source,
  pour que le GID d'une tuile corresponde à sa position.
- **M-Q21 — Projet v3.** `TilesetProject` passe en version 3. La lecture migre
  un fichier v2 : disposition « planche », pas de fusion, pas de tuile vide.
- **Conventions Tiled** : orientation `orthogonal`, `renderorder="right-down"`,
  `firstgid="1"`, format de Tiled 1.10.

### Livraison

- **M-Q22 — Tranches** : voir la découpe ci-dessous.
- **M-Q23 — Ce fichier.** Il reçoit les décisions de cette suite.
- **M-Q24 — Branche** `feat/tileset-map`, une PR finale.
- **M-Q25 — Images de test.** Des maps synthétiques construites dans le code. Le
  test connaît la réponse. Aucun asset sous droits n'entre dans le dépôt.

## Écarts à la conception

- **Le TSX ne décrit pas la planche avec ses gouttières.** Le cadrage prévoyait
  de décrire la grille du PNG existant avec sa `margin` et son `spacing`. Tiled
  n'a qu'une seule `margin` pour les deux axes. Une planche dont l'offset X
  diffère de l'offset Y n'a donc pas de description juste. L'export Tiled rend
  sa propre image, sans gouttière, dans les deux dispositions. Le PNG
  « Enregistrer le PNG » garde la grille source (Q10 du premier plan).

## Reporté (backlog)

- Export CPC natif : tuiles en octets CPC, map en table d'index, binaire ou ASM.
- Métatiles (blocs 2×2).
- Réimport d'un TMX modifié dans Tiled.
- Plusieurs maps qui partagent un tileset et une palette.
- Tri des tuiles par fréquence ou à la main.
- Pondération de la palette par occurrence.

## Découpe en tranches

| # | Tranche | Contenu | Décisions |
|---|---|---|---|
| M1 | Export Tiled de la planche | Writer TSX pur, helper ZIP, image sans gouttière, bouton d'export | M-Q10, M-Q11, M-Q17, M-Q20 |
| M2 | Disposition map | Sélecteur, réglages par défaut, map tirée de la déduplication, PNG rangé, writer TMX, compteur de budget, projet v3 | M-Q1, M-Q7, M-Q12, M-Q21 |
| M3 | Vue map | Onglet « Map », survol lié, comparaison avec la source | M-Q16 |
| M4 | Calage automatique | Détection de l'offset, détection de l'échelle entière, message d'image filtrée | M-Q4, M-Q19 |
| M5 | Tuile vide | Désignation, GID 0, exclusion du PNG et du budget | M-Q13 |
| M6 | Fusion | Écart perceptuel, seuil, liste des fusions, exclusions, redirection | M-Q14, M-Q15, M-Q18 |

M4 vient avant M5 et M6 : un mauvais calage fausse la déduplication, et donc
tout ce qui suit. M3 vient tôt : la vue map sert à juger M4 à M6 à l'œil. La v3
du projet naît dans M2, et chaque tranche suivante y ajoute son champ.

Le cœur pur (`src/libs/**`) passe par `tdd-cycle`. L'app passe par
`react-testing-patterns`.
