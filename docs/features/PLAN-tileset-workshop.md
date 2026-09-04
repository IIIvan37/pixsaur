# PLAN — Atelier Tileset (conversion de tilesets vers CPC)

**Date**: 2026-08-28 · **Statut**: T1→T9 livrées, la découpe est close · **Branche**: `feat/tileset-workshop`

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

- **Branche** : `feat/tileset-workshop` — poussée sur `origin`, pas encore de PR.
  Renommée depuis `docs/tileset-workshop-plan`, dont le nom disait `docs/` alors
  qu'elle portait 60 commits de code.
- **Q20 rouvert (04/09/2026) — le PNG sort en truecolor.** L'aval est `img2cpc`,
  qui découpe la planche en data CPC et **rapporte chaque couleur à la couleur CPC
  la plus proche** : l'indexé ne lui apporte rien. Le report est
  l'identité, puisque chaque pen sort déjà de `snapToHardware`. La prémisse de Q20
  n'était pas fausse, c'est l'exigence qui a changé. **Décision prise, code à
  écrire** — rien n'est encore supprimé dans `src/`.
  - `pixsaur-png` est à supprimer — 238 lignes, encodeur et spec. Le test de
    suppression est net : la complexité s'en va, elle ne se déplace pas.
  - Le déterminisme que l'encodeur revendiquait ne portait rien : la dédup tourne
    sur les index de tuiles, en amont de tout encodage, et **rien ne relit un PNG**
    (aucun décodeur dans le dépôt). Le lien d'édition de Q11 est intact.
  - `renderTilesetPng` devient un dessin canvas + `toBlob`, donc passe par le port
    `CanvasFactory` que `src/export` a déjà — un second adapter, la couture devient
    réelle.
  - L'aperçu cesse de passer par un blob PNG : il se dessine au canvas comme celui
    de l'atelier image. Chaque pixel peint encodait la planche deux fois.
  - Q9 (pré-étirement) et Q10 (grille source conservée) ne bougent pas.

- **Après T9, trois passes d'atelier** (28/08/2026) :
  1. **Agencement** — l'atelier reprend la grammaire de l'atelier image : une
     carte, une barre d'action, un dock de réglages à 408 px et deux colonnes
     qui poussent. Les huit panneaux tenaient dans un seul `flex-wrap` sans
     base, donc l'ordre à l'écran suivait la largeur du contenu. Le dock est
     désormais une coquille partagée (`ui/layout/settings-dock`), les deux
     ateliers la remplissent.
  2. **Champs** — un libellé est posé au-dessus de son contrôle, plus à côté ;
     variante `compact` de `Input` pour aligner le champ sur le `Select` ; les
     flèches natives des champs numériques sont retirées, le navigateur les
     dessinait hors du thème.
  3. **Palette éditable** — la grille de l'atelier image, un slot par pen du
     **mode** (16 en mode 0, pas seulement les pens choisis). Un pen épinglé
     porte son index : `lockedPens` est passé de `Pen[]` à
     `Record<number, Pen>`, et une position hors budget ou sur le pen de
     transparence est refusée (`locked-pen-out-of-range`). Le fichier projet
     passe en **version 2**. Ferme la dette T7 sur `lockedPens`.
- **T9 TERMINÉE — la découpe T1→T9 est close.** Durabilité, quatre commits :
  1. `tileset-project.ts` (Q31) — le document de l'atelier en un objet : la
     planche, les deux grilles, les réglages et le calque d'édition. Deux
     porteurs, une seule forme — IndexedDB garde l'objet tel quel (le clone
     structuré emporte les octets), le fichier exporté porte les mêmes champs en
     JSON avec les octets en base64. La relecture **nomme** ce qui a échoué
     (JSON illisible, autre version, forme qui découperait faux) et un projet
     d'une autre version est jeté, jamais migré à l'aveugle. Le type des options
     du store vient désormais du projet : un fichier rechargé ne peut pas
     convertir autrement que celui qui fut enregistré.
  2. Port `TilesetProjectStore` + adapter IndexedDB — pas `localStorage` : une
     planche fait des centaines de kilo-octets de RGBA brut. La persistance est
     un confort, jamais une condition : un magasin absent, bloqué ou plein perd
     l'auto-sauvegarde et l'atelier s'ouvre quand même.
  3. Atomes `store/tileset/project.ts` + `useTilesetPersistence` — le document
     est lu depuis les atomes feuilles et réécrit **sur eux**, jamais par les
     setters, qui jettent le calque quand la géométrie bouge et la palette quand
     le mode change. Une planche que l'utilisateur a déposée avant que le
     magasin réponde gagne : c'est celle qu'il voit.
  4. Panneau projet — export/import d'un fichier JSON. Un import refusé dit
     **de quelle manière** il a échoué et laisse l'atelier en l'état.
- **T8 TERMINÉE** — édition, quatre commits :
  1. `paintTileset` (Q11 · Q19 · Q31) — le calque d'édition, pur : `paintPixels`
     est réutilisé tuile par tuile, le trait part sur **toutes les instances**
     que la dédup a trouvées, et un pen absent de la palette est refusé — un
     édit est un index, pas une couleur. Curseur d'annulation linéaire et
     global, plafonné comme celui de l'atelier image.
  2. `applyTilesetEdits` + `renderTilesetPng` — le calque est **rejoué** sur les
     tuiles converties, jamais écrit dedans : changer un réglage reconvertit
     depuis la source sans perdre la retouche. Le rendu PNG sort de
     `convertTileset` pour qu'une planche éditée puisse être encodée aussi.
  3. Atomes `store/tileset/edits.ts` et panneau de retouche — un bouton par
     pixel, les pens de la palette gelée, Ctrl+Z / Ctrl+Y. Cliquer une collision
     vise la tuile qu'elle nomme : le rapport de Q22 est ce qui dirige la
     retouche, il fallait qu'il arme le pinceau.
  4. **Dette de T6 fermée** : `ditherByTile` est exposé par tuile (Q18), écrit
     sur toutes les instances du groupe — deux copies tramées différemment
     casseraient la dédup sur laquelle le calque repose.

- **T7 TERMINÉE** — atelier, treize commits :
  1. `store/tileset/` (Q6 · Q32 · Q34) — planche, grille, cible, options et la
     conversion dérivée, dans un espace d'atomes distinct de `store/config/`.
     Les réglages tiennent dans **un seul objet** typé sur `ConvertTilesetInput`,
     pour que panneaux et use-case ne divergent pas. Changer de mode jette la
     palette gelée.
  2. Commutateur `Image | Tileset` — il **remplace** le contenu, il ne le double
     pas. La planche entre à sa taille propre : la réduire avant découpe ferait
     sortir deux tuiles identiques différentes.
  3. Cinq panneaux — source, grille, tuile de destination, palette, rendu,
     résultat. Le rapport de collision (Q22) filtre les tuiles qui n'ont rien
     perdu ; les quatre échecs du use-case s'affichent en clair.
  4. **Quatre dettes fermées** : classement des grilles au coût de tilemap (T3),
     gouttières rendues au PNG à l'échelle de la tuile (T3), palette gelée
     validée contre le budget du mode (T5), `ditherSize` contraint par le type
     `BayerSize` (T6). Et la recherche de resize dit maintenant si elle fut
     exhaustive ou approchée (T4).

- **T6 TERMINÉE** — rendu, cinq commits :
  1. `tileEdgeMask` (Q17 · Q27) — la partition elle-même : tout pixel adossé à
     une couleur différente part à l'anti-aliasing, les aplats au tramage, aucun
     pixel ne subit les deux. Un trou ne prend aucun parti, sinon la silhouette
     d'un sprite se teinterait d'un fond sur lequel elle ne sera pas posée.
  2. `antiAliasTile` (Q17) — seuls les pixels où la frontière **tourne** bougent.
     Une frontière droite est un trait dessiné ; l'adoucir floute la tuile au
     lieu de la lisser. Le côté opposé est la couleur que la majorité des voisins
     différents portent.
  3. `orderedDitherTile` (Q11 · Q18) — choix entre les deux pens qui encadrent la
     couleur, selon un seuil de Bayer construit par récurrence. Le module ne
     reçoit **aucune position de planche** : la phase locale de Q11 est
     structurelle, pas promise.
  4. `diffuseTile` (Q12 · Q27) — Floyd-Steinberg, accumulateur alloué par appel
     donc jamais traversant une tuile. L'erreur qu'un pixel de contour aurait
     poussée est abandonnée plutôt qu'étalée sur le territoire de l'AA.
  5. Branchement dans `convertTileset` — `dither` (`none` par défaut),
     `ditherSize`, `ditherByTile` (la surcharge de Q18) et `antiAlias` (vrai par
     défaut).

- **T5 TERMINÉE** — palette, quatre commits :
  1. `tilePaletteHistogram` (Q3 · Q15) — chaque tuile **unique** pèse 1, réparti
     sur ses propres pixels ; le nombre d'instances disparaît, les proportions
     internes à la tuile survivent. Les 12 stratégies se branchent dessus via
     `applyPaletteStrategyV2`. La palette « premier vu » de T1 et l'erreur
     `palette-overflow` disparaissent — une planche plus riche que le mode se
     quantifie désormais au lieu d'échouer.
  2. Réservation et transparence (Q16 · Q23 · Q24) — `reservedPens` sort du
     budget de quantification ; la transparence partage ce même budget, en
     dépensant le pen 0 en mode 0 et en aplatissant sur `background` en modes 1
     et 2. Un pixel opaque ne peut **jamais** atteindre le pen de transparence :
     un trou et une tuile noire opaque restent deux tuiles distinctes.
     `pixsaur-png` apprend le chunk `tRNS`. Erreur `no-pens-left` si la
     réservation ne laisse plus rien.
  3. `rankTileCollisions` (Q22) — les tuiles classées par distance moyenne entre
     la couleur demandée et le pen obtenu. Dédupliquées sur les tuiles
     **source**, pas sur les converties : deux tuiles que la palette a fait
     fusionner sont précisément la collision à montrer, et le jeu converti en a
     déjà perdu une.
  4. Gel et verrouillage (Q15 · Q26 · Q28) — une palette fournie est utilisée
     telle quelle ; les pens verrouillés partent en présélection de la stratégie
     et reviennent que la planche les demande ou non.

- **T4 TERMINÉE** — resize, un commit :
  `detectTileEdges` (Q13 — la couture entre dernière et première ligne est
  comparée au pas moyen que la tuile fait déjà à l'intérieur d'elle-même, pas à
  un seuil absolu), `chooseResizeScheme` / `resizeTileByScheme` (Q12 · Q14 — la
  sélection exhaustive des colonnes et lignes survivantes, notée **contre toutes
  les tuiles à la fois** pour que le schéma soit commun au tileset), et le
  branchement dans `convertTileset` avec `resize: 'columns' | 'nearest'` —
  `columns` par défaut, `nearest` gardé comme référence de comparaison.
  Modèle de coût : chaque ligne source est représentée par la ligne survivante
  la plus proche, et le candidat paie la distance entre les deux. Une ligne
  dupliquée ne coûte donc rien à supprimer — c'est la propriété sur laquelle
  toute l'approche repose.

- **T3 TERMINÉE** — dédup et grille, trois commits :
  1. `sliceSheet` apprend marge, espacement et offset (Q5) ; il découpe
     désormais **les tuiles entières qui tiennent** et ne rend `null` que
     lorsqu'aucune n'entre — le balayage de Q29 compare des grilles qui, par
     construction, ne divisent presque jamais leur planche exactement.
  2. `dedupeTiles` — hash FNV-1a pour grouper, égalité octet à octet pour
     trancher ; `instanceOf` (le lien d'édition de Q11) et `unique` remontent
     dans `ConvertedTileset`. La dédup porte sur les tuiles **converties**, pas
     sur les sources : deux tuiles qui ne différaient qu'en deçà de la
     résolution de la palette CPC sont devenues la même tuile.
  3. `rankTileGrids` + le use-case `suggestTileGrid` — classement des tailles
     plausibles (8, 16, 24, 32) au taux de doublons, marges de l'utilisateur
     reportées sur chaque candidat.
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
- **Prochaine action** : T9 (durabilité — persistance IndexedDB du projet
  (planche, réglages, édits, palette gelée), export/import d'un fichier projet
  JSON. Le mécanisme de session existant ne convient pas : son repli anti-quota
  jette l'image, donc il jetterait la planche).
- **~~Dette de T6 (réglage par position)~~ — fermée en T8** : le panneau de
  retouche expose `ditherByTile` pour la tuile visée et écrit le réglage sur
  toutes ses instances.
- **Dette assumée dans T8 (pas de tracé glissé)** : on peint pixel par pixel,
  un clic = un trait annulable. Peindre en glissant demanderait de fusionner les
  pixels d'un même geste en un seul trait — `paintTileset` accepte déjà une
  liste de pixels, c'est le panneau qui ne les accumule pas. À rouvrir dès que
  la retouche portera sur autre chose que quelques pixels d'une collision.
- **Dette assumée dans T8 (calque et géométrie)** : le calque **tombe** quand la
  planche, la grille de découpe, la taille de destination ou le mode changent —
  un trait nomme un pixel d'une tuile à une position, et chacun de ces
  changements fait pointer les trois ailleurs. Le gel de palette de Q28 protège
  le calque de tout le reste. Garder les édits en les replaçant supposerait de
  savoir ce qu'une position devient, ce que rien ne dit.
- **Dette assumée dans T8 (`instanceOf` figé)** : le lien d'édition reste celui
  que la conversion a trouvé, il n'est pas recalculé sur les tuiles éditées.
  Deux tuiles qu'une retouche rend identiques ne fusionnent donc pas. C'est
  volontaire — un groupe qui bouge sous le pinceau serait illisible — mais le
  compte de tuiles uniques affiché ne tient pas compte des édits.
- **Gotcha de T8 (PNG réencodé à chaque trait)** : `editedTilesetAtom` réencode
  toute la planche à chaque pixel peint. Même ordre de grandeur que la
  conversion, qui tourne déjà à chaque frappe (Q30).
- **Piège Lingui (interpolation perdue)** : un message interpolé — `msg` passé
  au `_` de `useLingui`, ou un `Trans` avec une valeur — rend le texte **sans la
  valeur** quand le runtime vient de `@lingui/react` : le macro vide `values`.
  Les libellés numérotés de l'atelier composent donc le nombre hors du
  message. Le rapport de collision de T7 en souffrait (« Tuile  — 163.9 ») ;
  c'est corrigé. Les panneaux raster et DSK ont le même motif, hors périmètre.
- **~~Dette ouverte par T7 (`lockedPens` non exposé)~~ — fermée le 28/08/2026** :
  le panneau palette porte la grille de l'atelier image, et une épingle porte
  désormais son index de pen (voir « trois passes d'atelier » plus haut).
- **Gotcha de T7 (recalcul total)** : la conversion tourne dans un atome dérivé
  **synchrone**. Chaque frappe dans un champ relance `convertTileset` sur toute
  la planche, et `tilesetGridSuggestionsAtom` reclasse toutes les tailles. Tenu
  sur une planche 256×256 (Q30), non mesuré au-delà.
- **Dette assumée dans T5 (sous-palettes)** : Q21 — retrouver les sous-palettes
  de la source par groupement des tuiles selon leur jeu de couleurs — n'est pas
  faite. Elle ne figurait pas au contenu de la tranche, et le rapport de
  collision de Q22, lui, est là : c'est lui qui dirige la retouche. À rouvrir si
  l'atelier a besoin d'expliquer *pourquoi* une tuile collisionne, et pas
  seulement *laquelle*.
- **Dette assumée dans T5 (pen dépensé à vide)** : en mode 0, le pen de
  transparence est réservé **même sur une planche entièrement opaque**. C'est
  volontaire : le réserver au vu du contenu ferait qu'ajouter un trou plus tard
  décalerait toute la palette, ce que le gel de Q28 rend inacceptable — les
  édits sont des index de pen. Le prix est un pen perdu sur une planche de
  décor. `transparency: 'flatten'` le récupère explicitement, et **le panneau
  palette de T7 expose ce choix** — fermé hors mode 0, où l'arithmétique de Q16
  ne laisse rien à dépenser.
- **Dette assumée dans T5 (alpha partiel)** : un pixel est un trou sous 128
  d'alpha, une couleur au-dessus — pas d'entre-deux. Un contour semi-transparent
  de sprite est donc aplati sur le fond, ce qui est correct sur un fond uni et
  faux dès que la tuile sera posée sur autre chose. Inhérent à une palette
  indexée sans canal alpha.
- **~~Dette de T5 (palette gelée non validée)~~ — fermée en T7** :
  `convertTileset` refuse désormais une palette plus large que le budget du mode
  (`palette-too-wide`) ou dont la tête n'est pas le pen de transparence
  (`palette-missing-hole`). Refusée plutôt que rognée : rogner déplacerait les
  index de pen, donc repeindrait les édits que le gel existe pour protéger.
- **~~Dette de T3 (rendu)~~ — fermée en T7** : le PNG restitue marges et
  espacements **à l'échelle de la tuile**, arrondis au demi-pixel supérieur pour
  qu'une gouttière de 1 px survive à une réduction de moitié. Pas de case à
  cocher : une planche sans gouttière source sort tassée comme avant.
- **Dette assumée dans T4 (bord)** : Q13 détecte la condition de bord **par
  tuile**, mais Q14 impose un schéma commun, qui ne peut être noté que sous une
  seule condition par axe. On tranche donc à la **majorité** des tuiles : une
  planche majoritairement terrain est traitée en terrain. Le compromis exact
  serait d'attribuer le coût tuile par tuile — le jeu de lignes gardées reste
  global, seule la ligne représentante change — ce qui coûte une matrice de
  distances par tuile. À rouvrir si les coutures se voient sur les sprites d'une
  planche mixte.
- **Dette assumée dans T4 (budget)** : au-delà de `EXHAUSTIVE_BUDGET`
  (200 000 candidats — une tuile de 8 en fait 56, une de 16 quelques milliers,
  une de 32 réduite de moitié en fait 600 millions), la recherche bascule sur
  une **suppression gloutonne** ligne à ligne. Le glouton garde la propriété
  clé (une ligne dupliquée est gratuite, donc partie la première) mais n'est
  plus optimal. **Signalé depuis T7** : `ConvertedTileset.resizeSearch` dit
  `exhaustive`, `greedy` ou `grown` par axe, et le panneau de rendu l'affiche —
  un résultat approché ne se lit plus comme un résultat exhaustif.
- **Dette assumée dans T4 (fusion)** : le schéma **supprime** des lignes, il
  n'en fusionne aucune, alors que Q12 dit « supprimer ou fusionner ». C'est
  volontaire — sur du pixel art, moyenner est toujours destructeur — mais un
  dégradé source lisse y perdra. À rouvrir si les tests sur planche réelle le
  demandent.
- **Dette assumée dans T3** : le taux de doublons, lu **d'une taille de tuile à
  l'autre**, favorise mécaniquement la plus petite — plus une tuile est petite,
  plus deux d'entre elles ont de chances d'être identiques. Le critère reste
  juste à taille fixe (c'est ce que Q29 démontre : une grille décalée d'un pixel
  tombe à zéro), et le classement des tailles est donc une présélection que
  l'utilisateur arbitre, pas un verdict. Le départage neutre serait un coût de
  tilemap — `tuiles uniques x aire + un index par position`, rapporté à l'aire
  de la planche — qui fait payer aux petites tuiles la table d'index qu'elles
  imposent. **Tranché en T7** : c'est ce coût qui classe désormais, rapporté à
  l'aire que la grille couvre — sinon une grille qui déborde paraîtrait bon
  marché pour avoir laissé tomber une partie de la planche.
- **Dette assumée dans T3 (rendu)** : le PNG reste tassé — marges et
  espacements de la source ne sont pas restitués, alors que Q10 les demande
  pour le diff visuel. Les restituer suppose de savoir quoi peindre dans les
  gouttières ; la réponse est la transparence de Q16, qui arrive en T5.
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

- **Q20 · Q9 · Q10 — PNG truecolor, pré-étiré, grille conservée.** *Truecolor* depuis
  le 04/09/2026 : ~~indexé, palette CPC embarquée~~ — voir « Q20 rouvert » dans *Où on
  en est*. *Pré-étiré* par défaut (un pixel mode 0 devient deux pixels
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
- **~~Compression réelle du PNG.~~ Sans objet depuis Q20 rouvert (04/09/2026)** :
  le canvas produira le PNG et le navigateur le déflatera ; la dette part avec
  l'encodeur maison. Ce qui suit est le raisonnement d'origine, gardé pour mémoire.
  ~~`pixsaur-png` émet des blocs zlib *stored*
  (non compressés) plutôt que d'ajouter une dépendance deflate : le PNG est
  valide, l'encodeur reste pur et trivialement déterministe — la garantie sur
  laquelle repose toute la tranche (Q30). Une planche 256×256 sort à ~70 ko pour
  un fichier téléchargé une fois. `fflate` restera ajoutable **sans changer
  l'interface** du module. C'est un choix, pas un oubli.~~

## Découpe en tranches

Outside-in : on part du besoin du consommateur, le domaine naît sous la traction des
tests. Une tranche = une PR.

| # | Tranche | Contenu | Dépend de |
|---|---|---|---|
| T1 ✅ | Squelette marchant | Test d'acceptation `convertTileset` sur le cas trivial (planche 16×16, deux tuiles 8×8, mode 0, plus-proche-voisin, pas de tramage, PNG indexé). Fait naître les types de tuile, la découpe et le port d'encodage. Rien d'optimal, tout de bout en bout | — |
| T2 ✅ | Géométrie | Table des PAR sources, ratio dérivé, tailles entières candidates, déformation résiduelle | T1 |
| T3 ✅ | Dédup et grille | Hash de tuile, lien d'instances, suggestion de grille classée par taux de doublons | T1 |
| T4 ✅ | Resize | Sélection exhaustive de colonnes, schéma global, condition de bord auto-détectée | T2, T3 |
| T5 ✅ | Palette | Histogramme sur tuiles uniques, branchement des 12 stratégies, réservation, transparence, gel, rapport de collision | T4 |
| T6 ✅ | Rendu | Masque de bord, partition AA / tramage, phase locale, reset de diffusion | T5 |
| T7 ✅ | Atelier | `store/tileset/`, panneaux, commutateur dans `app.tsx`, i18n | T6 |
| T8 ✅ | Édition | `paintPixels` réutilisé, calque non destructif, propagation par dédup, undo global | T7 |
| T9 ✅ | Durabilité | IndexedDB, export/import projet JSON | T8 |

T1 à T6 sont du cœur pur (`src/libs/**`, `src/domain/**`) : `tdd-cycle` s'applique, un
test rouge avant chaque ligne. T7 à T9 touchent l'app et passent par
`react-testing-patterns`. Chaque tranche se ferme par `quality-gate` puis
`/session-report`.
