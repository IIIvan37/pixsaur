# Weighted RGB Distance - Feature Abandonnée

**Date** : 23 octobre 2025  
**Branche** : `feature/weighted-rgb-distance`  
**Statut** : ❌ Abandonnée - Complexité > Valeur utilisateur

## 🎯 Objectif Initial

Implémenter une distance RGB pondérée (ITU-R BT.601) pour améliorer la qualité perceptuelle de la quantification des couleurs :
- Rouge : 0.299 (29.9%)
- Vert : 0.587 (58.7%) - sensibilité maximale de l'œil humain
- Bleu : 0.114 (11.4%)

**Quick Win attendu** : Toggle UI simple avec amélioration visuelle immédiate.

## 🔬 Analyse Technique

### Implémentation Réalisée

1. ✅ **Core Function** (`src/libs/pixsaur-color/src/metric/distance.ts`)
   ```typescript
   export function weightedRGBDistance(a: Vector, b: Vector): number {
     const [r1, g1, b1] = a
     const [r2, g2, b2] = b
     const dr = (r1 - r2) ** 2 * 0.299
     const dg = (g1 - g2) ** 2 * 0.587
     const db = (b1 - b2) ** 2 * 0.114
     return dr + dg + db
   }
   ```

2. ✅ **Type System** : `'weighted-rgb'` ajouté à `DistanceMetric`

3. ✅ **Configuration** : `useWeightedRGBAtom = atom<boolean>(false)`

4. ✅ **UI Toggle** : Switch dans `preview-panel.tsx`

5. ✅ **i18n** : 4 langues (EN, FR, ES, DE)

6. ✅ **Integration** : `regl-processor.ts` passe `distanceMetric` conditionnellement

### 🚫 Blocages Découverts

#### Blocage #1 : Diversity Mode Bypass

**Constat** : Le quantizer CPC utilise un "diversity mode" pour 8-16 couleurs :

```typescript
// src/libs/pixsaur-color/src/quant/quantize.ts
const useDiversityMode = limit >= 8 && limit <= 16
```

**Impact** : Le diversity mode **ignore complètement** la `distanceMetric` et optimise pour :
- Maximiser la couverture de l'espace colorimétrique
- Diversité perceptuelle globale
- Pas de calcul de distance individuel

**Logs observés** :
```
🎨 [DIVERSITY-MEDIUM] Activating diversity mode for 16 colors from 10 candidates
🎨 [DIVERSITY] Selected 10 colors with diversity optimization
```

**Résultat** : Aucune différence visuelle entre `euclidean` et `weighted-rgb`.

#### Blocage #2 : Architecture GPU ReGL

**Constat** : Le système utilise WebGL (ReGL) pour la quantification :

```
🎮 [ReGL] GPU quantization completed: 10/16 colors in 22.60ms
```

**Impact** : Pour que la distance pondérée fonctionne, il faudrait :
1. Implémenter les poids dans les **shaders GLSL**
2. Modifier `regl-quantizer.ts` pour passer les poids au GPU
3. Réécrire la logique de sélection GPU

**Complexité** : ~2-3 jours de développement + tests de performance GPU.

#### Blocage #3 : Palette CPC Limitée

**Constat** : CPC Classic = 27 couleurs, CPC Plus = 4096 couleurs

**Impact** : Même avec des poids perceptuels :
- Les 10 couleurs optimales restent identiques (espace trop contraint)
- L'amélioration perceptuelle est négligeable sur 27 couleurs

**Test** : Même image, même 10 couleurs sélectionnées avec les 2 distances.

## 📊 Statistiques de Développement

- **Temps investi** : ~3h
- **Fichiers modifiés** : 7
  - `distance.ts` (core function)
  - `config.ts` (atom)
  - `preview.ts` (integration - inutilisée)
  - `preview-panel.tsx` (UI)
  - `regl-processor.ts` (ReGL integration)
  - 4× `messages.po` (i18n)
- **Lignes de code** : ~80
- **Tests** : 0 (feature non fonctionnelle)

## 💡 Leçons Apprises

### ❌ Erreurs Commises

1. **Sous-estimation de l'architecture** :
   - Analyse insuffisante du diversity mode
   - Ignoré l'impact du GPU ReGL
   - Pas vérifié si la distance metric était réellement utilisée

2. **Pas de POC rapide** :
   - Implémentation complète avant validation
   - Aurions dû tester avec un log dans le diversity selector d'abord

3. **Quick Win mal évaluée** :
   - "Ajouter un toggle" ≠ Quick Win
   - Vraie complexité cachée dans l'architecture GPU + diversity mode

### ✅ Bonnes Pratiques Identifiées

1. **Logs détaillés** : Les console.log ont permis de comprendre le problème
2. **Architecture modulaire** : Facile d'ajouter une distance function
3. **Type safety** : TypeScript a forcé la cohérence

### 🎓 Insights Techniques

**Diversity Mode vs Distance Metrics** :
- Le diversity mode est une **optimisation de haut niveau**
- Il bypass intentionnellement les distances pour privilégier la couverture
- Conçu pour palettes ≤16 couleurs (cas CPC)
- Modifications nécessaires :
  ```typescript
  // Au lieu de maxmin diversity, il faudrait :
  selectWithWeightedDistance(candidates, distanceMetric)
  ```

**GPU Quantization** :
- ReGL fait tout en WebGL (histogramme + sélection)
- Les distances doivent être en GLSL, pas JavaScript
- Performance critique : 71289 pixels en 20ms

## 🔄 Solutions Alternatives Envisagées

### Option A : Désactiver Diversity Mode ❌
**Approche** : `useDiversityMode = false` quand weighted-rgb activé

**Inconvénients** :
- Régression qualité visuelle (diversity mode améliore rendu)
- Incohérence UX (pourquoi désactiver une optimisation ?)
- Pas de réel bénéfice perceptuel constaté

### Option B : Implémenter dans Shaders GPU ⚠️
**Approche** : Poids dans GLSL, modification ReGL quantizer

**Inconvénients** :
- ~2-3 jours de dev
- Risques de bugs GPU
- Complexité vs bénéfice marginal
- **Pas un Quick Win**

### Option C : Forcer CPU Fallback ❌
**Approche** : `shouldUseGPU() = false` si weighted-rgb

**Inconvénients** :
- Performance 10x plus lente (20ms → 200ms)
- Diversity mode reste actif (même problème)
- UX dégradée

## 🎯 Recommandations

### Court Terme
1. **Abandonner la feature**
2. **Garder `weightedRGBDistance()`** dans le code (future-proofing)
3. **Supprimer UI toggle + atom + i18n**
4. **Documenter cette analyse** (✅ fait)

### Long Terme (si vraiment nécessaire)
1. **Réécrire diversity selector** pour accepter custom distance
2. **Implémenter GPU shader** avec poids paramétrables
3. **Faire A/B testing** pour valider amélioration perceptuelle réelle
4. **Estimer temps** : 5-7 jours de dev + tests

### Vraies Quick Wins à Prioriser
1. ✅ **Tri de palette** : Sorting UI (purement UI, 0 impact algo)
2. ✅ **Export settings** : Format options (déjà implémenté)
3. ✅ **Locked colors count indicator** : Affichage nombre de couleurs lockées
4. ✅ **Palette copy/paste** : Export/import palette JSON

## 📁 Fichiers à Supprimer

```bash
# UI
src/app/components/preview-panel.tsx (revert Switch toggle)

# Configuration
src/app/store/config/config.ts (remove useWeightedRGBAtom)

# Integration
src/app/store/preview/preview.ts (remove useWeightedRGBAtom import + log)
src/libs/pixsaur-adapter/adapters/regl-processor.ts (revert distanceMetric logic)

# i18n
src/locales/*/messages.po (remove "Weighted distance" entries)
```

## 📌 Fichiers à Conserver

```bash
# Core function (peut servir dans le futur)
src/libs/pixsaur-color/src/metric/distance.ts (keep weightedRGBDistance)

# Type registry (cohérence type system)
DISTANCE_METRICS_BY_COLORSPACE['RGB'] (keep 'weighted-rgb' entry)
```

## 🏁 Conclusion

**ROI Final** : ❌ Négatif
- **Investissement** : 3h dev + 1h analyse
- **Valeur** : 0 (aucun effet visible)
- **Complexité réelle** : 3-7 jours (GPU + diversity mode)

**Catégorie** : ~~Quick Win~~ → **Complex Feature**

**Statut** : Feature abandonnée, analyse préservée pour référence future.

---

*Cette analyse sert de référence pour éviter des chemins similaires et mieux évaluer la complexité réelle des "Quick Wins" apparents.*
