# 🔬 Analyse de l'Algorithme de Quantization CPU Original

## 📋 **Vue d'ensemble**
L'algorithme de quantization CPU qui produit une excellente qualité visuelle suit un pipeline sophistiqué en plusieurs étapes.

## 🔍 **Pipeline détaillé**

### 1. **Initialisation** (`createQuantizer`)
```typescript
// Configuration
colorSpace: 'RGB' | 'Lab' | 'XYZ'
distanceMetric: 'euclidean' | 'cie76' | 'deltaE2000'
basePalette: Vector<'RGB'>[] // Palette CPC (27 couleurs)
preselected: Vector<'RGB'>[] // Couleurs verrouillées
```

### 2. **Conversion d'espace colorimétrique**
```typescript
const toW = getRgbToColorSpaceFn(colorSpace)    // RGB → Working space
const fromW = getColorSpaceToRgbFn(colorSpace)  // Working space → RGB
const vecs = bufferToVectors(buf)               // Buffer → RGB vectors
const workingPal = basePalette.map(toW)         // Palette → Working space
```

### 3. **Construction d'histogramme** (`buildHistogram`)
```typescript
// Pour chaque pixel de l'image :
for (const color of input) {
  const nearestColor = mapToNearest(color, palette, distFn)
  const nearestIndex = palette.indexOf(nearestColor)
  histogram[nearestIndex]++
}
```
**Sortie** : `histogram[i]` = nombre de pixels mappés vers `palette[i]`

### 4. **Sélection des couleurs principales** (`selectTopIndices`)
```typescript
// Algorithme :
1. Inclure les couleurs pré-sélectionnées
2. Appliquer un seuil (THRESHOLD = 10) si certaines couleurs sont très fréquentes
3. Trier les couleurs restantes par fréquence décroissante
4. Prendre les top N couleurs
```
**Particularité** : Le seuillage élimine les couleurs rares si d'autres sont très fréquentes

### 5. **Optimisation de contraste** (`selectContrastedSubset`)
```typescript
// Objectif : Maximiser la distance minimale entre couleurs
// Contrainte : Conserver des couleurs sombres ET claires

Algorithm:
1. Générer toutes les combinaisons possibles de N couleurs
2. Filtrer pour garder sombres + claires (luminance < 0.2 et > 0.8)
3. Pour chaque combinaison, calculer la distance minimale entre paires
4. Choisir la combinaison avec la plus grande distance minimale
```

## 🎯 **Points clés pour la qualité**

### **Histogramme sophistiqué**
- Utilise la **fonction de distance exacte** dans l'espace de travail
- Chaque pixel trouve sa couleur la plus proche dans la palette CPC complète
- Accumule les statistiques d'utilisation précises

### **Sélection intelligente par fréquence**
- **Seuillage adaptatif** : élimine le bruit si des couleurs sont dominantes
- **Pré-sélection respectée** : les couleurs verrouillées sont toujours incluses
- **Tri par popularité** : les couleurs les plus utilisées sont privilégiées

### **Optimisation de contraste avancée**
- **Recherche exhaustive** : teste toutes les combinaisons possibles
- **Contrainte luminance** : garantit un bon contraste visuel
- **Distance minimale maximisée** : évite les couleurs trop similaires

### **Conversion d'espace colorimétrique précise**
- Utilise l'espace **LAB** ou **XYZ** pour une perception humaine fidèle
- **Distance deltaE2000** pour LAB (standard industrie)
- Projections RGB ↔ Working space exactes

## ⚡ **Défis pour la GPU-isation**

### **Facile à paralléliser :**
- ✅ Construction d'histogramme (map-reduce)
- ✅ Calculs de distance (parallèles)
- ✅ Conversions colorspace (vectorisables)

### **Difficile à paralléliser :**
- ❌ Génération de combinaisons (`kCombinations`)
- ❌ Tri et sélection avec conditions complexes
- ❌ Recherche de minimum global dans l'optimisation

### **Solutions hybrides possibles :**
1. **GPU** : Histogramme + distances
2. **CPU** : Sélection + optimisation combinatoire
3. **GPU** : Projection finale + dithering

## 🎨 **Pourquoi cet algorithme donne une bonne qualité**

1. **Analyse complète** : chaque pixel vote pour sa couleur préférée
2. **Seuillage intelligent** : élimine le bruit tout en gardant la diversité
3. **Optimisation de contraste** : garantit une palette visuellement équilibrée
4. **Espace perceptuel** : travaille dans LAB pour une fidélité humaine
5. **Distance précise** : utilise deltaE2000, standard de l'industrie

## 🚀 **Stratégie de reproduction GPU**

### **Phase 1 : GPU Histogramme**
- Paralléliser le calcul d'histogramme sur GPU
- Utiliser compute shaders pour map-reduce efficace

### **Phase 2 : CPU Sélection**
- Garder la logique complexe de sélection sur CPU
- Optimiser avec SIMD et multithreading

### **Phase 3 : Validation**
- Comparer pixel par pixel GPU vs CPU
- Mesurer métriques de qualité (SSIM, deltaE)

Cette approche devrait reproduire **exactement** la qualité originale avec les performances GPU.