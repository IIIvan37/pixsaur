# PLAN — Refonte de l'atelier Tileset autour d'une scène

**Date** : 2026-10-09 · **Statut** : cadrage clos, S1 à S8 à livrer · **Branche** : `feat/tileset-stage`

> Relevé de conception de la refonte de l'onglet Tileset. L'atelier sait
> convertir une planche et lire une map ([`PLAN-tileset-workshop.md`](PLAN-tileset-workshop.md),
> [`PLAN-tileset-map.md`](PLAN-tileset-map.md)). Son interface reste celle des
> premières tranches : deux colonnes égales, des canvas qui ne font que
> rétrécir, des compteurs qui se contredisent. Cette refonte la remet sur la
> mockup du 10/09/2026.
>
> **Référence visuelle** : la mockup « Refonte de l'atelier tileset »,
> <https://claude.ai/artifact/7HrbGGeRTNKTQHECcPfK2p>. Ses cinq notes numérotées
> sont reprises ici. En cas de désaccord entre ce fichier et la mockup, ce
> fichier l'emporte : il note les écarts voulus.
>
> Les décisions portent le préfixe **S-Q** pour ne pas se confondre avec les Q
> et M-Q des deux autres plans. Construire outside-in via `new-feature-hexa`
> quand une tranche ajoute une capacité, cœur pur en `tdd-cycle`, composants
> sous `react-testing-patterns`, chaque tranche close par `quality-gate`.

## Où on en est

- **Cadrage clos le 09/10/2026.** Inventaire de l'écart, puis trois séries de
  questions : 29 décisions, S-Q1 à S-Q29. Aucun point ouvert.
- **Branche** : `feat/tileset-stage`, créée depuis `main` après le merge de la
  PR #349. Elle porte ce plan puis le code (S-Q29).
- **S1 livrée (09/10/2026).**
  - Le calque de retouche est la table de surcharges de S-Q6
    (`TilesetEditLayer`, `paintTileset`, `applyTilesetEdits`). Un test garde
    la première retouche après 150 traits.
  - Annuler / rétablir, le tramage par tuile, la liste des tuiles malmenées,
    `rankTileCollisions` et la table `PenTables.error` sont retirés, code
    compris.
  - Le projet passe en version 4. La migration enchaîne v2 → v3 → v4 ; le
    message de S-Q7 vit dans `tilesetProjectNoticeAtom` et s'affiche dans la
    barre d'actions (`<output>`, bouton « Compris »).
  - Les selects du Tileset prennent la largeur de leur champ
    (`.field [role='combobox']`).
  - Catalogues : les 4 messages retirés quittent les quatre langues ; les 69
    obsolètes plus anciens restent, hors périmètre.
  - Captures Playwright : rien ne dépasse à 1400 px. Sous 1024 px, voir le
    constat sur le dock ci-dessous.
- **S2 livrée (09/10/2026, `1e60b6c`).**
  - L'atelier tient en une barre et trois colonnes (256 px, scène, 304 px ;
    272 px sous 1180 px ; une colonne sous 860 px). Il descend jusqu'au bas
    de la fenêtre : `useFillWindow` mesure son haut.
  - `SettingsDock` gagne l'option facultative `stayDocked` : le dock reste
    dans sa colonne à toute largeur. L'atelier Image ne la passe pas (S-Q1).
  - La barre montre le nom du fichier, la taille et la disposition, puis
    « Projet ▾ » (exporter, importer, changer d'image), « Enregistrer le
    PNG » et « Exporter pour Tiled ». `ImageUpload` passe le `File` en
    second argument ; `tilesetSheetNameAtom` garde le nom, et le projet le
    porte dans un champ facultatif `sheetName`.
  - Le panneau source disparaît : la scène vide est la zone de dépôt, la
    réduction ×N et l'alerte « image filtrée » vont dans Grille source
    (`TilesetSourceChecks`). Le relevé de la barre d'action part.
  - L'inspecteur reçoit les compteurs, la retouche et la liste des fusions.
    `selectedTileAtom` vaut `null` tant qu'aucune tuile n'est choisie : la
    retouche invite à cliquer une case (Map) ou à donner un numéro (Planche,
    qui ne prend pas encore de clic).
  - Restent sous la map jusqu'à S6 et S8 : « Vider la tuile », la tuile vide
    et le seuil de fusion.
  - Captures Playwright aux trois largeurs, dock ouvert et fermé : rien ne
    déborde.
- **Après S2** : une tuile de destination à 0 pixel plantait l'atelier ;
  `convertTileset` la refuse (`empty-target`, `c998a65`). Le plantage signalé
  avec une grille source vide n'a pas été reproduit.
- **PR draft S1-S2 ouverte (09/10/2026)** : #351.
- **S3 livrée (09/10/2026).**
  - `ZoomStage` (`zoom-stage.tsx`) sert la planche, la map et l'atlas. Il
    garde le canvas natif en mémoire et le recopie par `drawImage`, lissage
    coupé. La page fait défiler la copie : barres de défilement, gestes
    tactiles et bornes restent ceux du navigateur.
  - Les calculs sont purs et testés dans `stage-zoom.ts` : `fitZoom`,
    `zoomIn`, `zoomOut`, `anchorScroll`. `zoomIn` refuse un canvas de plus
    de 8192 px de côté.
  - Le zoom vit dans `tilesetStageZoomAtom`, commun à toutes les vues et
    jamais enregistré. `setTilesetSheetAtom` le remet à « Ajuster ».
  - Ctrl + molette passe par un écouteur natif non passif : celui de React
    ne peut pas empêcher le zoom de la page. Le glisser ne vaut que pour la
    souris, au-delà de 3 px, et avale le clic qui le termine. Clavier : `+`,
    `=`, `−`, `0` et les flèches.
  - Captures aux trois largeurs, dock ouvert et fermé : rien ne déborde. Le
    point sous le curseur tient en X ; en Y, l'image reste centrée tant
    qu'elle est moins haute que la scène.
  - Constats laissés aux tranches suivantes : la comparaison avec la source
    saute encore (S4) ; les réglages restés sous la map prennent de la
    hauteur à la scène (S6, S8). À 1400 px, la map de test s'ajuste à 1× :
    512 px n'entrent pas deux fois dans 718 px.
- **Prochaine action** : S4.

## Constat de départ

Les données de la mockup existent presque toutes dans les atomes. Ce qui manque,
c'est la mise en page.

- **Pas de scène.** `tileset-workshop.tsx` pose le dock puis deux colonnes
  `flex: 1` qui passent l'une sous l'autre sous 1200 px. Le résultat partage la
  largeur avec un panneau source qui ne dessine jamais la source.
- **Pas de zoom.** `useSheetCanvas` (`use-sheet-canvas.ts:18-22`) pose un pixel
  CSS par pixel de canvas, et `.preview { max-width: 100% }` ne fait que
  réduire. Une map de 40 × 14 cases reste minuscule.
- **Une comparaison qui saute.** `TilesetMapView` dessine
  `useSheetCanvas(comparing ? source : result)` (`tileset-map-view.tsx:98`).
  La source rognée et la map rendue n'ont pas la même taille : l'image change
  d'échelle quand on bascule. En disposition Planche, la source n'est jamais
  dessinée.
- **Deux compteurs, deux choses.** La barre d'infos et le panneau de résultat
  lisent `tileset.unique.length`, compté à la conversion, avant les retouches
  (`convert-tileset.ts:273`). Le compteur de map lit `map.tiles.length`, compté
  après (`tileset-map.ts:198-200`). Les deux portent des noms voisins.
- **Une retouche carrée.** La grille de retouche dessine des boutons carrés de
  1 rem (`tileset-workshop.module.css:282-285`). En mode 0, un pixel CPC est
  deux fois plus large que haut. La map et l'atlas sont déjà étirés dans les
  données (`render-tileset-sheet.ts:67,115`, `stretchOf(mode)`) : la scène ne
  doit pas les étirer une seconde fois.
- **Une retouche qui s'efface.** Le calque de retouche est une liste de traits
  rejouée jusqu'au curseur d'annulation. `push` jette le plus ancien au-delà de
  `MAX_HISTORY_SIZE`, soit 100 (`paint-tileset.ts:106-108`). Le 101ᵉ trait
  efface donc en silence la première retouche, dans l'atelier comme dans le
  projet enregistré.
- **Des réglages éparpillés.** Le budget est dans l'onglet Grille. Le seuil de
  fusion et la tuile vide sont sous la map. Le dock est fait d'onglets et
  disparaît une fois fermé.
- **Des contrôles qui débordent.** Le déclencheur partagé `Select` impose
  `min-width: 160px` (`src/components/ui/select/select.module.css:13`). Les
  colonnes de champs du Tileset descendent à `minmax(8rem, 1fr)`, soit 128 px.
  Le select du tramage par tuile en est l'exemple visible, mais tout select du
  Tileset peut déborder.
- **Un dock transparent sous 1024 px** (trouvé pendant S1, dans les deux
  ateliers ; corrigé par `b89e9ab` : fond `--color-background`,
  `align-self: stretch`, barre d'onglets à `z-index: 1`). Sous 1024 px,
  `SettingsDock` devient un tiroir fixe, mais :
  - son fond lit `--color-panel-background`, que le thème ne définit pas : le
    contenu de la page transparaît dessous. `--color-text-primary`,
    `--color-text-secondary` et `--color-panel-hover` manquent aussi ;
  - il reste enfermé dans le contexte d'empilement de la carte de l'atelier
    (`z-index: 10`) : les onglets Image | Tileset passent devant lui et
    captent les clics ;
  - il ne prend pas toute la hauteur de la fenêtre (346 px mesurés).

## Décisions

### Périmètre

- **S-Q1 — Le Tileset seul.** L'atelier Image ne change pas. Ce que la refonte
  demande à un composant partagé (`SettingsDock`, `Select`, `ImageUploadView`)
  passe par une option facultative ou par une règle CSS propre au Tileset,
  jamais par un changement du comportement par défaut. Le chrome mis en commun
  par la vague 7 de la revue d'architecture reste commun.
- **S-Q2 — La mockup est la cible.** Disposition, libellés et ordre des
  sections viennent d'elle, sauf écart noté ici.
- **S-Q3 — Ce qui part, code compris.**
  - La liste « Tuiles les plus malmenées ». Son calcul ne sert qu'à elle : le
    champ `collisions` de `convertTileset`, `rankTileCollisions` et le module
    `pixsaur-tileset/src/tile-collisions.ts` partent avec elle.
  - Le tramage par tuile : l'UI, `setTileDitherAtom`, `ditherByTile` et son
    traitement dans la conversion.
  - Annuler et rétablir sur la retouche : boutons, Ctrl + Z / Ctrl + Y,
    `undoTilesetEdits`, `redoTilesetEdits` et le curseur `at`.
- **S-Q4 — Ce qui reste, hors mockup.** Les réglages que la mockup ne montre
  pas restent dans leur section : stratégie de palette, transparence, vue de
  la palette, « Geler la palette », matrice de Bayer, « Adoucir les
  escaliers », suggestions de taille de grille et de tuile, « Déformation % ».
  La mockup simplifiait, elle ne retirait pas.
- **S-Q5 — Marge et espacement restent.** Une planche dont les tuiles sont
  séparées par une gouttière ne se découpe pas sans eux. Ils passent sous un
  « Avancé » replié dans la section Grille source.

### Retouche et format de projet

- **S-Q6 — Une table de surcharges remplace les traits.** Pour chaque position
  de tuile, la table garde les pixels peints ; le dernier trait l'emporte. Sa
  taille est bornée par la planche, plus par le nombre de gestes : la perte au
  101ᵉ trait disparaît. Un trait garde son sens actuel : il s'écrit sur toutes
  les positions de la même tuile au moment du dessin. Le rejeu devient une
  superposition.
- **S-Q7 — Le projet passe en version 4.**
  - `edits` devient la table de surcharges ; `ditherByTile` disparaît.
  - Un projet v3 se migre : ses traits sont rejoués jusqu'au curseur, les
    traits annulés sont jetés, puis `ditherByTile` est retiré. Un projet v2
    passe par la v3, comme aujourd'hui.
  - La sauvegarde automatique (IndexedDB) et le fichier de projet partagent le
    format `TilesetProject` : la même migration couvre les deux.
  - Si le projet migré réglait un tramage par tuile, son rendu change. Un
    message le dit une fois, dans la barre de l'atelier : « Ce projet réglait
    le tramage tuile par tuile. Ce réglage n'existe plus : toute la planche
    suit le tramage de la section Rendu. » Sinon, la migration est
    silencieuse.

### Mise en page

- **S-Q8 — Trois colonnes sous une barre.**
  - **Barre de l'atelier** : nom du fichier, taille en pixels, disposition
    (Planche ou Map). Pas de marque : l'en-tête de l'app la porte, et les
    onglets Image | Tileset nomment l'atelier. À droite : « Projet ▾ » (un
    `Popover` : exporter le projet, importer un projet, changer d'image),
    « Enregistrer le PNG » en bouton secondaire, « Exporter pour Tiled » en
    bouton principal. Le nom du fichier n'existe pas aujourd'hui :
    `sheetFromImage` doit le garder.
  - **Réglages** à gauche : 256 px ouverts, un rail de 40 px fermé.
  - **Scène** au centre : toute la place restante.
  - **Inspecteur** à droite : 304 px, 272 px sous 1180 px.
  - L'atelier occupe la hauteur de la fenêtre sous les onglets ; réglages,
    scène et inspecteur défilent chacun de leur côté.
  - Sous 860 px : une seule colonne qui défile normalement. Réglages repliés
    en tête (240 px de haut au plus), scène de 560 px, inspecteur en dessous.
- **S-Q9 — Rien ne déborde.** Dans tout l'atelier, un contrôle prend la largeur
  de sa cellule (`width: 100%`, `min-width: 0`), un libellé passe à la ligne,
  une valeur trop longue se coupe avec une ellipse. La correction du `Select`
  se fait dans le CSS du Tileset (S-Q1). Les couleurs viennent des jetons du
  thème (`src/components/theme/theme.ts`) ; la mockup s'y tient déjà.
- **S-Q10 — Le panneau source se répartit.** Il disparaît en tant que panneau.
  La scène vide devient la zone de dépôt (glisser ou cliquer), avec
  `ImageUploadView`. « Changer d'image » va dans « Projet ▾ ». Les dimensions
  vont dans la barre de l'atelier. La proposition de réduction ×N et l'alerte
  « image filtrée » vont dans la section Grille source, sous forme d'indice,
  comme le décalage suggéré.
- **S-Q11 — Les états vides.** Avant le chargement d'une image, les réglages
  restent visibles pour préparer la grille, et l'inspecteur affiche une ligne :
  « Chargez une planche ou une map. » Image chargée et aucune tuile choisie,
  il montre le bilan et invite à cliquer une case.

### Scène

- **S-Q12 — Un seul composant de scène.** Il sert la map, la planche et l'atlas.
  Il garde le canvas natif en mémoire et le recopie avec `drawImage`, lissage
  coupé, au facteur de zoom.
- **S-Q13 — Le zoom.** Ajuster, puis 1×, 2×, 3×, 4×, 6×, 8×, avec des boutons
  − et +. Ctrl + molette zoome en gardant fixe le point sous le curseur. Le
  glisser déplace la vue. « Ajuster » prend le plus grand facteur entier qui
  fait tenir l'image, ou un facteur fractionnaire si l'image est plus grande
  que la scène. Le zoom revient à « Ajuster » à chaque nouvelle image.
- **S-Q14 — Le clavier.** Quand la scène a le focus : `+` et `−` zooment, `0`
  revient à Ajuster, les flèches déplacent la vue.
- **S-Q15 — Un repère commun.** Une case source et une case destination
  occupent la même place à l'écran. La destination, déjà étirée dans les
  données, est dessinée telle quelle. La source est mise à l'échelle de la case
  destination. Changer de vue ne fait donc plus sauter l'image (note 1 de la
  mockup).
- **S-Q16 — Quatre vues.** Destination, Source, Les deux (l'une sous l'autre,
  défilement lié), Rideau (un volet à glisser). Elles valent en Planche comme
  en Map. La poignée du rideau se déplace aussi au clavier, avec les flèches.
  Destination est la vue de départ.
- **S-Q17 — Les calques et la barre d'état.**
  - Cases à cocher sous la barre de scène : grille de tuiles, grille de pixels
    (à partir de 4×), marquer les cases vides (hachures, en Map).
  - La grille de pixels de la destination suit la forme du pixel CPC : des
    cellules deux fois plus larges que hautes en mode 0.
  - Une pastille rappelle le mode et la forme du pixel, par exemple
    « Mode 0 · pixel 2:1 ».
  - La barre d'état donne la case survolée (tuile, nombre de cases) et la
    taille d'un pixel CPC à l'écran.
- **S-Q18 — Deux onglets dans les deux dispositions.** « Planche | Tileset » ou
  « Map | Tileset », ce dernier suivi du nombre de tuiles distinctes.
  - En Map, l'onglet Tileset a deux dispositions : Ajustée (tuiles espacées,
    avec numéro et nombre de cases) et Atlas Tiled (16 colonnes jointives,
    l'image exportée).
  - En Planche, il n'a que la disposition Ajustée : l'export Tiled garde
    l'ordre de la planche, donc l'atlas *est* la planche, déjà dans le premier
    onglet.
  - Le survol d'une tuile éclaire ses cases dans la map ou la planche. Un clic
    sur une case ou une tuile la choisit pour l'inspecteur.
- **S-Q19 — Ce qui est retenu.** La vue, l'onglet, les sections ouvertes et
  l'état du dock sont retenus dans le navigateur (`atomWithStorage`, comme
  `tilesetSettingsOpenAtom` aujourd'hui). Rien de tout cela n'entre dans le
  fichier de projet : c'est une préférence d'affichage, pas du travail.

### Inspecteur

- **S-Q20 — Un seul bilan.** Il remplace « Tuiles uniques » et « Tuiles de la
  map », et lit **un seul** résultat, après les retouches. Le décompte est une
  fonction pure, testée seule.
  - En Map, il lit `tilesetMapAtom` et suit les cases jusqu'aux tuiles
    gardées : vides, répétées, fusionnées, gardées, avec la somme écrite en
    toutes lettres. Une jauge compare ensuite les tuiles gardées au budget.
  - En Planche, la tuile vide (`EMPTY_CELL`), la fusion et le budget
    n'existent pas : il montre cases, répétées et distinctes, sans jauge.
- **S-Q21 — La tuile choisie.**
  - Le titre porte le numéro de la tuile et son nombre de cases. Le champ
    numéro part : on choisit au clic dans la scène ou la mini-grille, et aux
    flèches dans la mini-grille.
  - La source et le rendu CPC côte à côte, puis la grille de retouche et les
    pens. Chaque cellule de la retouche a la forme du pixel CPC, tirée de
    `stretchOf(mode)` : 2:1 en mode 0.
  - « Vider la tuile de la case sélectionnée » vient ici, depuis la vue map :
    c'est une action sur la tuile, pas un réglage.
- **S-Q22 — Le tileset compact et les fusions.** Sous la tuile : un tileset
  compact, puis la liste des fusions avec « Garder à part ». L'écart d'une
  fusion reste la distance perceptuelle de `mergeNearTiles`, et son libellé le
  dit. La mockup l'écrit en pixels, à tort.

### Réglages

- **S-Q23 — Des sections repliables, et un rail.** Les quatre onglets du dock
  deviennent cinq sections repliables (`CollapsibleSection`) : Grille source,
  Tuile de destination, Palette, Rendu, Map. Fermé, le dock laisse un rail de
  40 px qui le rouvre. `SettingsDock` gagne une option facultative pour le
  rail ; l'atelier Image ne la passe pas (S-Q1).
- **S-Q24 — Une section Map.** Elle regroupe le budget de tuiles, le seuil de
  fusion et la tuile vide, pris dans l'onglet Grille et sous la map. Elle
  n'apparaît qu'en disposition Map.
- **S-Q25 — La forme du pixel source.** Le sélecteur de machine source reste, à
  la place des boutons 1:1 / 8:7 / 11:8 de la mockup : il nomme ce que
  l'utilisateur connaît, et chaque machine porte déjà son rapport
  (`pixel-aspect.ts:24-31`). La section Tuile de destination gagne la
  comparaison visuelle de la mockup : la forme d'une tuile source à l'écran, à
  côté de la forme de la tuile CPC.

### Livraison

- **S-Q26 — La vérification à l'œil.** À chaque tranche, des captures
  Playwright aux trois largeurs (au-delà de 1180 px, entre 860 et 1180 px,
  sous 860 px), dock ouvert et dock fermé, regardées avant de rendre la main.
  Elles portent sur une planche et une map synthétiques, générées dans le
  *scratchpad* et jamais versionnées. Playwright reste hors des dépendances du
  projet. La vérification finale se fait sur de vraies images, par
  l'utilisateur.
- **S-Q27 — Les traductions.** Chaque tranche extrait les messages, remplit les
  quatre catalogues (de, en, es, fr) et compile. Aucune tranche ne laisse de
  texte non traduit ; les messages retirés quittent les catalogues. Un nombre
  se compose hors du message (piège d'interpolation de Lingui).
- **S-Q28 — Trois PR en *draft*.** Aux points stables : S1-S2 (retraits et
  squelette), S3-S5 (scène), S6-S8 (inspecteur et réglages). Chaque PR laisse
  l'atelier utilisable.
- **S-Q29 — Une branche.** `feat/tileset-stage` porte le plan puis le code.
  Chaque tranche se clôt par un commit de code puis un commit qui met ce
  fichier à jour.

## Reporté (backlog)

- Un rapport de pixel source « Libre », saisi à la main (S-Q25) :
  `sourcePlatformAtom` est un ensemble fermé.
- Le même traitement pour l'atelier Image : dock en rail, sections repliables
  (S-Q1).

## Découpe en tranches

Chaque tranche laisse l'atelier utilisable et se vérifie à l'œil selon S-Q26.

| Tranche | Contenu | Décisions |
|---|---|---|
| **S1** | Retraits, table de surcharges, projet v4 et sa migration, débordements. | S-Q3, S-Q6, S-Q7, S-Q9 |
| **S2** | Squelette : barre de l'atelier et « Projet ▾ », trois colonnes, hauteur de fenêtre, points de rupture. La scène accueille la vue actuelle telle quelle, l'inspecteur reçoit la retouche et les listes. Le panneau source se répartit ; nom du fichier gardé par `sheetFromImage`. États vides. | S-Q8, S-Q10, S-Q11 |
| **S3** | Scène et zoom pour la map, la planche et l'atlas : zoom, Ctrl + molette ancrée, glisser, clavier. Les calculs de zoom et d'ancrage sont des fonctions pures testées. | S-Q12, S-Q13, S-Q14 |
| **S4** | Les quatre vues dans un repère commun, en Planche comme en Map. | S-Q15, S-Q16, S-Q19 |
| **S5** | Calques et barre d'état : grilles, cases vides, pastille, case survolée, taille d'un pixel CPC à l'écran. | S-Q17 |
| **S6** | Inspecteur : bilan et jauge, tuile choisie en source et CPC, retouche en 2:1, « Vider la tuile ». Les deux anciens compteurs disparaissent. | S-Q20, S-Q21 |
| **S7** | Onglets Planche ou Map \| Tileset, dispositions Ajustée et Atlas, survol vers la scène, clic vers l'inspecteur, tileset compact et fusions. | S-Q18, S-Q22 |
| **S8** | Réglages : sections repliables, rail, « Avancé » pour marge et espacement, section Map, comparaison des formes de tuile. | S-Q5, S-Q23, S-Q24, S-Q25 |

S1 et S2 forment la première PR, S3 à S5 la deuxième, S6 à S8 la troisième
(S-Q28).
