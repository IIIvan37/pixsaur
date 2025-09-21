# Corrections - Couleur 0 forcée et couleurs verrouillées

## Problèmes identifiés et résolus

### 1. Couleur 0 encore forcée dans la palette ✅ RÉSOLU

**Problème** : Malgré la désactivation de `addBlackForBorders()`, l'appel à cette fonction était toujours présent dans `reducedPaletteRgbAtom`.

**Solution** :
- Suppression complète de l'appel à `addBlackForBorders()` dans `reducedPaletteRgbAtom`
- Suppression des fonctions inutiles `needsCenteringCheck()` et `addBlackForBorders()`
- Le padding utilise maintenant automatiquement le fallback vers la couleur la plus sombre

### 2. Quantification CPC Plus ignore les couleurs verrouillées ✅ RÉSOLU

**Problème** : Les fonctions `quantifyCPCClassic()` et `quantifyCPCPlus()` modifiaient toutes les couleurs de la palette, y compris les couleurs verrouillées par l'utilisateur.

**Solution** :
- Création de nouvelles fonctions `quantifyCPCClassicWithLocked()` et `quantifyCPCPlusWithLocked()`
- Ces fonctions créent un `Set` des clés de couleurs verrouillées pour un accès O(1)
- Seules les couleurs non-verrouillées sont quantifiées
- Les couleurs verrouillées conservent leurs valeurs RGB exactes

## Implémentation technique

### Nouvelles fonctions de quantification

```typescript
function quantifyCPCClassicWithLocked(
  projected: any[],
  lockedColorKeys: Set<string>
): void {
  // Quantifie seulement les couleurs non-verrouillées vers [0,128,255]
}

function quantifyCPCPlusWithLocked(
  projected: any[],
  lockedColorKeys: Set<string>
): void {
  // Quantifie seulement les couleurs non-verrouillées vers 4-bit par composante
}
```

### Système de clés de couleurs

- Format de clé : `"r,g,b"` (ex: `"255,0,0"` pour rouge)
- Utilisation d'un `Set<string>` pour une vérification rapide
- Préservation exacte des couleurs verrouillées

## Avantages

1. **Respect des choix utilisateur** : Les couleurs verrouillées restent exactement comme choisies
2. **Palette diversifiée** : Plus de couleur noire forcée, meilleure utilisation de l'espace colorimétrique
3. **Compatibilité CPC** : Quantification appropriée selon le matériel (Classic vs Plus)
4. **Performance** : Accès O(1) pour vérifier les couleurs verrouillées

## Test

- ✅ Build réussi sans erreurs
- ✅ Code conforme aux standards Biome
- ✅ Fonctions inutiles supprimées
- ✅ Pas de régressions introduites

## Impact utilisateur

- Les couleurs verrouillées dans l'interface palette conservent leurs valeurs exactes
- Le padding d'image utilise intelligemment la couleur la plus sombre disponible
- Meilleure diversité de couleurs dans les palettes générées