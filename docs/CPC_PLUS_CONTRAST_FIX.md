# CPC Plus - Correction du Contraste pour Modes 1 et 2

## Problème Identifié

En modes 1 et 2 (4 et 2 couleurs), la palette CPC Plus produisait des résultats avec moins de contraste que la palette CPC Classic.

### Problèmes Spécifiques

1. **Bypass des fonctions de contraste**: Le quantizer retournait directement les couleurs sans optimisation
2. **Couleurs trop proches**: Sélection de couleurs très similaires comme:
   - `rgb(17, 17, 0)` et `rgb(0, 0, 0)` - distance ≈ 24
   - Distance minimale de 20 insuffisante pour 2-4 couleurs

### Cause du Problème

Le quantizer ReGL pour CPC Plus **bypassait** les fonctions de sélection de contraste (`selectContrastedSubset` et `selectBalancedSubset`) qui sont utilisées pour le CPC Classic:

```typescript
// ❌ AVANT: Retour direct sans contraste
if (isCPCPlus && useOptimizedSelection) {
  const selectedColors = topIndices.map(idx => [...basePalette[idx]] as Vector)
  return selectedColors  // Pas d'optimisation de contraste!
}
```

La fonction `selectDiverseColorsFast` utilisée pour CPC Plus privilégie:
- ✅ **Fréquence** des couleurs dans l'image
- ✅ **Diversité chromatique** (teinte et luminance)
- ❌ Mais PAS le **contraste visuel maximum**

Pour les petites palettes (modes 1-2), le contraste visuel est **critique** car avec seulement 2-4 couleurs, il faut maximiser la distinction entre elles.

## Solution Implémentée

### 1. Application des fonctions de contraste (Premier correctif)

Au lieu de retourner directement les couleurs pour CPC Plus en modes 1-2, nous appliquons maintenant les **mêmes fonctions de contraste** que pour CPC Classic.

### 2. Distance minimale adaptative (Second correctif)

Ajout d'une **distance minimale adaptative** dans `selectFrequentColorsWithDiversity` pour CPC Plus (dans `regl-quantizer.ts`):

```typescript
// Distance minimale adaptative selon le nombre de couleurs cibles
const minDistance = targetColors <= 4 ? 100 : 20
```

### 3. Pool de candidats élargi pour petites palettes (Troisième correctif - PRINCIPAL)

**Problème**: Même avec les fonctions de contraste, si on ne donne que 2 candidats à `selectContrastedSubset` pour mode 2, elle ne peut pas choisir de meilleures couleurs!

**Solution**: Pour CPC Plus modes 1-2, sélectionner **4x plus de candidats** avant d'appliquer les fonctions de contraste:

```typescript
// 🎯 Pour petites palettes: sélectionner plus de candidats
const candidateMultiplier = config.targetColors <= 4 ? 4 : 1
const candidatesCount = Math.min(
  actualTargetColors * candidateMultiplier,
  Math.floor(basePalette.length * 0.01) // Max 1% de la palette
)

// Mode 2: demander 8 candidats au lieu de 2
// Puis selectContrastedSubset choisira les 2 plus contrastés parmi ces 8
topIndices = this.selectCPCPlusOptimized(imageData, basePalette, candidatesCount, config)
```

**Exemple mode 2**:
- Avant: 2 candidats → `selectContrastedSubset` choisit entre seulement 2 couleurs
- Après: 8 candidats → `selectContrastedSubset` choisit les 2 plus contrastés parmi 8 couleurs diverses

### 4. Diversité chromatique renforcée (Quatrième correctif)

Dans `select-to-indices.ts`, augmentation des distances minimales pour petites palettes:

```typescript
// Distance adaptative selon le nombre de candidats
const minColorDistance = targetCount <= 4 ? 60 : 30      // Degrés de teinte (doublé)
const minLuminanceDistance = targetCount <= 4 ? 0.3 : 0.15  // Luminance (doublé)
```

Et activation du diversity mode pour **toutes** les palettes <= 16 couleurs:

```typescript
// Avant: diversityMode activé seulement pour topN >= 8 && topN <= 16
// Après: diversityMode activé pour topN <= 16 (inclut modes 1-2)
if (diversityMode && topN <= 16 && options?.basePalette) {
  const modeLabel = topN <= 4 ? 'SMALL' : 'MEDIUM'
  // Sélection avec diversité chromatique
}
```

### Stratégies de Contraste Disponibles

#### `max` (par défaut)
- Algorithme: `selectContrastedSubset`
- Maximise la distance minimale entre toutes les paires de couleurs
- Garantit un contraste fort même dans les pires cas
- **Idéal pour**: Images détaillées, textures

#### `balanced` 
- Algorithme: `selectBalancedSubset`
- Équilibre entre fréquence d'usage et contraste
- Sélection gloutonne avec score pondéré
- Encourage la diversité sombre/claire (luminance)
- **Idéal pour**: Images avec dominantes colorées

## Impact

### CPC Plus Mode 1 (4 couleurs)
- ✅ Applique `selectByStrategy` (contraste ou équilibré)
- ✅ Distance minimale de **100** entre couleurs candidates
- ✅ Résultats comparables au CPC Classic
- ✅ Plus de couleurs trop similaires

### CPC Plus Mode 2 (2 couleurs)
- ✅ Applique `selectByStrategy` 
- ✅ Distance minimale de **100** garantit un contraste fort
- ✅ Garantit une couleur sombre + une couleur claire
- ✅ Contraste optimal pour le noir et blanc
- ❌ Plus de sélection comme `rgb(17,17,0)` + `rgb(0,0,0)` (distance 24)

### CPC Plus Mode 0 (16 couleurs)
- ⚡ Pas de changement: retour direct (diversité suffisante)
- ⚡ Distance minimale de 20 (inchangé)
- ⚡ Performance optimale maintenue

## Fichiers Modifiés

- `src/libs/pixsaur-adapter/adapters/regl-quantizer.ts`
  - **Ligne ~955-967**: Logique conditionnelle pour appliquer les fonctions de contraste
  - **Ligne ~969-973**: Log de debug pour confirmer l'application
  - **Ligne ~1123-1134**: Distance minimale adaptative dans `selectFrequentColorsWithDiversity`
  - **Ligne ~1252**: Passage du paramètre `targetColors` à la fonction

### Détails des Changements

#### 1. Fonction `selectFrequentColorsWithDiversity`
```typescript
// AVANT: Distance fixe de 20
if (this.calculateDistance(candidateConverted, selectedColor) < 20) {
  isDiverse = false
}

// APRÈS: Distance adaptative selon targetColors
const minDistance = targetColors <= 4 ? 100 : 20
if (this.calculateDistance(candidateConverted, selectedColor) < minDistance) {
  isDiverse = false
}
```

#### 2. Appel de la fonction
```typescript
// AVANT: Sans targetColors
this.selectFrequentColorsWithDiversity(
  colorFrequency,
  selectedConverted,
  result,
  frequencyBudget
)

// APRÈS: Avec targetColors
this.selectFrequentColorsWithDiversity(
  colorFrequency,
  selectedConverted,
  result,
  frequencyBudget,
  targetColors  // 🎯 NOUVEAU
)
```

## Fonctions de Contraste Existantes

Ces fonctions étaient déjà utilisées pour CPC Classic mais pas pour CPC Plus:

### `selectContrastedSubset` (strategy='max')
```typescript
// src/libs/pixsaur-color/src/quant/select-contrast-subset.ts
export function selectContrastedSubset(
  candidates: readonly Vector[],
  preselected: Vector[],
  size: number,
  distance: (a: Vector, b: Vector) => number,
  toRGB: (v: Vector) => Vector<'RGB'>
): Vector[]
```

- Teste toutes les combinaisons possibles
- Maximise la distance minimale entre couleurs
- Garantit présence de couleurs sombres ET claires

### `selectBalancedSubset` (strategy='balanced')
```typescript
// src/libs/pixsaur-color/src/quant/select-contrast-subset.ts
export function selectBalancedSubset(
  candidates: readonly Vector[],
  preselected: Vector[],
  size: number,
  distance: (a: Vector, b: Vector) => number,
  toRGB: (v: Vector) => Vector<'RGB'>
): Vector[]
```

- Sélection gloutonne avec score équilibré
- Score = distance moyenne + distance minimum + bonus luminance
- Plus rapide que `selectContrastedSubset`
- Meilleur équilibre fréquence/contraste

### `selectByStrategy` (commun)
```typescript
// src/libs/pixsaur-color/src/quant/strategy-selector.ts
export function selectByStrategy(
  config: StrategyConfig,
  params: SelectionParams
): Vector[]
```

- Sélectionne automatiquement entre `max` et `balanced`
- Applique `balanced` seulement si `targetColors <= 4` ET `strategy === 'balanced'`
- Sinon utilise `max` (contraste maximum)

## Tests Recommandés

Pour valider la correction:

1. **Image avec détails fins**:
   - Mode CPC Classic 1 → noter les couleurs
   - Mode CPC Plus 1 → comparer le contraste
   - Devrait être similaire maintenant

2. **Image avec dominante colorée**:
   - Tester strategy='balanced' en mode 1
   - Vérifier que les couleurs fréquentes sont préservées
   - Tout en maintenant un bon contraste

3. **Noir et blanc (mode 2)**:
   - Vérifier présence d'une couleur sombre + claire
   - Contraste maximal entre les deux

## Notes Techniques

### Pourquoi bypass mode 0?
En mode 0 (16 couleurs), la diversité chromatique de `selectDiverseColorsFast` est suffisante:
- Assez de couleurs pour couvrir le spectre
- Les fonctions de contraste sont coûteuses en calcul
- La performance est prioritaire pour 16 couleurs

### Complexité algorithmique
- `selectContrastedSubset`: O(C(n,k) × k²) où C(n,k) = combinaisons
  - Mode 1 (4 couleurs): acceptable
  - Mode 2 (2 couleurs): très rapide
  
- `selectBalancedSubset`: O(n × k²)
  - Plus rapide que `max`
  - Bon compromis qualité/performance

## Conclusion

Cette correction unifie le comportement entre CPC Classic et CPC Plus pour les petites palettes, en appliquant les mêmes algorithmes de contraste éprouvés. Le CPC Plus bénéficie maintenant de la même qualité de sélection de couleurs tout en conservant ses optimisations pour le mode 0.
