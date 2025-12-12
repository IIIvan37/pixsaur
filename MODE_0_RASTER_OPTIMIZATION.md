# Optimisation des Rasters en Mode 0 - Contrainte des Encres Consécutives

## Problème

En mode 0, le CPC dispose de 16 encres disponibles. Cependant, une contrainte matérielle importante limite les changements de palette par ligne :

**Le Gate Array du CPC ne peut modifier que 4 encres CONSÉCUTIVES par ligne.**

Cela signifie que :
- En mode 1 et 2 : Pas de problème car il n'y a que 4 ou 2 encres au total
- En mode 0 : On ne peut pas changer n'importe quelles 4 encres parmi les 16
  - ✅ Possible : changer les encres 0, 1, 2, 3
  - ✅ Possible : changer les encres 4, 5, 6, 7  
  - ❌ Impossible : changer les encres 0, 3, 7, 12 (non consécutives)

## Solution Implémentée

L'algorithme a été modifié pour :

# Optimisation des Rasters en Mode 0 - Palette Fixe + Slots Dynamiques

## Problème

En mode 0, le CPC dispose de 16 encres disponibles. Cependant, une contrainte matérielle importante limite les changements de palette par ligne :

**Le Gate Array du CPC ne peut modifier que 4 encres CONSÉCUTIVES par ligne.**

Cela signifie que :
- En mode 1 et 2 : Pas de problème car il n'y a que 4 ou 2 encres au total
- En mode 0 : On ne peut pas changer n'importe quelles 4 encres parmi les 16
  - ✅ Possible : changer les encres 0, 1, 2, 3
  - ✅ Possible : changer les encres 4, 5, 6, 7  
  - ❌ Impossible : changer les encres 0, 3, 7, 12 (non consécutives)

## Solution Implémentée : Palette Fixe + Slots Rasters

Au lieu de réorganiser une palette de 16 couleurs existante, l'algorithme utilise une approche inspirée du hardware :

### Architecture de la Palette en Mode 0

```
Index 0-3  : SLOTS RASTERS (changent à chaque ligne selon les besoins)
Index 4-15 : PALETTE FIXE (12 couleurs les plus fréquentes de l'image, ne changent jamais)
```

### 1. Extraction d'une Palette de Base de 12 Couleurs

Au lieu d'extraire 16 couleurs, on extrait les **12 couleurs les plus fréquentes** de l'image globale :

```typescript
const fixedPaletteSize = isMode0 ? 12 : nColors

const extractedPalette = extractGlobalPaletteFromImage(
  preprocessedImage,
  fixedPaletteSize,
  cpcClassicPalette
)
```

Ces 12 couleurs sont placées aux indices 4-15 et **ne changent jamais**.

### 2. Réservation des Slots 0-3 pour les Rasters

Les 4 premiers slots (indices 0-3) sont initialisés à noir et servent de **slots dynamiques** :

```typescript
if (isMode0) {
  basePalette = [
    [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], // Slots rasters (indices 0-3)
    ...extractedPalette                          // Palette fixe (indices 4-15)
  ]
}
```

### 3. Attribution Intelligente Ligne par Ligne

Pour chaque ligne, l'algorithme :

1. **Identifie les couleurs présentes** sur la ligne
2. **Privilégie l'utilisation de la palette fixe** (indices 4-15) si les couleurs y sont présentes
3. **Utilise les slots rasters** (indices 0-3) uniquement pour les couleurs **non présentes dans la palette fixe**

```typescript
// Cherche d'abord dans la palette fixe (4-15)
for (const inkIndex of fixedSlots) {
  const paletteKey = colorKey(previousPalette[inkIndex])
  if (lineKey === paletteKey) {
    // Couleur trouvée dans palette fixe, pas besoin de slot raster
    assignedColors.add(lineKey)
    break
  }
}

// Puis assigne les couleurs restantes aux slots rasters (0-3)
for (const lineColor of lineColors) {
  if (!assignedColors.has(lineKey) && rasterSlotIndex < 4) {
    newPalette[rasterSlots[rasterSlotIndex]] = lineColor
    rasterSlotIndex++
  }
}
```

### 4. Limitation des Changements Rasters

Seuls les indices 0-3 peuvent générer des changements rasters :

```typescript
// MODE 0 CONSTRAINT: Only allow changes to inks 0-3 (consecutive inks)
if (isMode0 && inkIndex >= maxRasterInks) continue
```

## Résultat

Cette approche garantit que :

1. **Les couleurs les plus dynamiques** de l'image sont placées aux indices 0-3
2. **Seules ces 4 encres consécutives** peuvent changer par ligne
3. **La contrainte matérielle est respectée** tout en maximisant la qualité visuelle
4. **Les encres 4-15 restent fixes** tout au long de l'image, servant de "palette de base"

## Impact sur la Qualité

L'optimisation intelligente de la palette initiale permet de minimiser l'impact de cette contrainte :
- Les couleurs qui varient le plus dans l'image sont celles qui bénéficient des changements rasters
- Les couleurs stables occupent naturellement les slots fixes (4-15)
- La qualité visuelle est préservée tout en respectant les limitations matérielles

## Modes Concernés

- ✅ **Mode 0** : Optimisation active (16 encres → rasters sur 0-3 uniquement)
- ⚪ **Mode 1** : Pas d'impact (4 encres seulement, toutes consécutives)
- ⚪ **Mode 2** : Pas d'impact (2 encres seulement, toutes consécutives)

## Code Modifié

Fichiers concernés :
- `src/libs/pixsaur-raster/optimize-line-palettes.ts`
  - Nouvelle fonction `analyzeInkChangeFrequency()`
  - Nouvelle fonction `reorganizePaletteForRaster()`
  - Modification de `assignColorsToInks()` avec paramètres de priorité
  - Modification de `optimizeLinePalettesWithIndexBuffer()` pour utiliser ces fonctions




# 🎨 Raster CPC+ — Sélection des 12 couleurs globales + 4 couleurs par ligne

Ce document résume la méthode pour respecter la contrainte matérielle du CPC Plus :
**on ne peut changer que 4 registres consécutifs par ligne**.
On fixe donc **12 couleurs globales** (identiques sur toute l’image) et **4 couleurs raster par ligne** (indices 0–3).

---

## 🧩 Objectif

Pour chaque image :

1. **Trouver les 12 couleurs “globales”** (fixes toute l’image).
2. **Déterminer 4 couleurs “raster” par ligne**, optimisant localement le rendu.
3. Produire une image quantifiée avec :

   * Palette globale = 12 couleurs fixes
   * Palette locale par ligne = 4 couleurs raster + 12 couleurs fixes
4. Garantir que seuls les registres **0–3** changent → respect strict du timing matériel.

---

# 1. Sélection des 12 couleurs globales

## 1.1. Quantization globale initiale

1. Exécuter une quantization globale de l’image en **K couleurs**
   (par ex. K = 24 ou 32).
2. On obtient une palette intermédiaire `P = {c₁, ..., cₖ}`.

---

## 1.2. Analyse statistique par couleur

Pour chaque couleur `cᵢ` :

* `count` : nombre total de pixels assignés à `cᵢ`
* `lineCount` : nombre de lignes où `cᵢ` apparaît

Définir un **score de globalité** :

```
globalScore(c) = w1 * count + w2 * lineCount
```

> Plus le score est élevé, plus la couleur est “globale”.
> Poids suggérés : `w1 = 1`, `w2 = 2`.

---

## 1.3. Choix des 12 couleurs fixes

1. Trier les couleurs par `globalScore` décroissant.
2. Garder les **12 premières** → `BASE12`
3. Le reste devient **candidates raster**.

---

# 2. Sélection des 4 couleurs raster par ligne

Objectif : améliorer la ligne `y` localement, en complétant les 12 globales.

---

## 2.1. Détection des pixels mal rendus

Pour chaque pixel de la ligne :

1. Trouver la meilleure couleur parmi `BASE12`.
2. Calculer l’erreur (Lab recommandé).
3. Conserver les pixels **ayant la plus forte erreur**
   (ex. les 30–40% pires, ou ceux dépassant un seuil).

On obtient un ensemble `WorstPixels(y)`.

---

## 2.2. Clustering local (k-means)

* Lancer un **k-means** sur `WorstPixels(y)`
* Avec `k ≤ 4` selon la richesse de la ligne
* Les centres → **couleurs raster locales**

Option : initialiser les centres avec des couleurs candidates issues de la quantization globale.

Résultat :
`R_y = {r₀, r₁, r₂, r₃}` (moins si ligne pauvre).

---

# 3. Quantization finale ligne par ligne

Pour chaque ligne `y`, construire :

```
PaletteLine(y) =
  [ r0, r1, r2, r3 ]    // indices 0–3 : rasters modifiables
  + BASE12              // indices 4–15 : fixes
```

Puis :

* Quantifier la ligne avec **PaletteLine(y)**
* Appliquer le dithering (optionnel)
* Accumuler le résultat final.

---

# 4. Export CPC+ (timing matériel garanti)

Pour chaque ligne :

1. Les indices **0–3** changent → au plus 4 OUT par ligne
2. Les 12 autres encres sont fixes → aucun OUT

Processus :

* Ligne 0 : initialisation complète (16 OUT)
* Pour chaque ligne suivante :
  comparer les rasters avec la ligne précédente →
  **OUT uniquement pour les registres 0–3 modifiés**

Respect 100% du budget temps par ligne.

---

# 5. Variante simple (V1 rapide)

1. Quantifier globalement en 16 couleurs.
2. Garder les 12 plus globales.
3. Par ligne, prendre les couleurs restantes qui apparaissent + compléter par une petite quantization locale.
4. Requantifier ligne par ligne.

Moins optimal mais très facile à intégrer.

---

# ✔️ Résultat attendu

* Une base stable **de 12 couleurs fixes** couvrant l’image.
* Par ligne, **4 couleurs raster** optimales, respectant le hardware.
* Un rendu bien supérieur aux 16 couleurs fixes classiques.
* Une structure simple pour l’export et les timings.
