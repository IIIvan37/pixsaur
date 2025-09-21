# Implémentation - Mapping automatique vers couleur la plus sombre

## Résumé des changements

### Problème initial
- Le système forçait l'ajout de la couleur noire (0,0,0) dans la palette lors du padding
- Cela réduisait la diversité des couleurs disponibles pour l'image
- Le padding était toujours affiché en noir

### Solution implémentée

#### 1. Nouvelle fonction utilitaire (`src/utils/exports/color-utils.ts`)
- `findDarkestColor(palette: Vector[]): Vector` : Trouve la couleur la plus sombre dans une palette
- Utilise le calcul de luminance ITU-R BT.709 pour déterminer la "noirceur" d'une couleur
- Tests complets pour validation

#### 2. Modification de `rgbToIndexBufferExact` (`src/utils/exports/rgb-to-indexes/rgb-to-indexes.ts`)
- Nouveau paramètre `fallbackToDarkest = false` 
- Quand activé, mappe automatiquement les couleurs non trouvées vers la couleur la plus sombre de la palette
- Préserve les correspondances exactes
- Fonction helper `findDarkestColorIndex()` pour optimiser les performances

#### 3. Suppression de l'ajout forcé de noir (`src/app/store/preview/preview.ts`)
- `addBlackForBorders()` devient une fonction vide avec message de log
- Plus d'ajout automatique de la couleur noire dans la palette
- Permet une meilleure diversité de couleurs

#### 4. Modification de l'export (`src/components/export-panel/export-panel.tsx`)
- CPC Plus export utilise maintenant `fallbackToDarkest = true`
- Les couleurs de padding sont automatiquement mappées vers la couleur la plus sombre disponible

## Avantages

1. **Diversité des couleurs améliorée** : Plus de couleur noire forcée dans la palette
2. **Padding intelligent** : Utilise la couleur la plus appropriée visuellement (la plus sombre)
3. **Rétrocompatibilité** : Le comportement par défaut reste inchangé (`fallbackToDarkest = false`)
4. **Robustesse** : Gestion gracieuse des couleurs manquantes pendant l'export

## Tests

- 5 nouveaux tests pour `findDarkestColor()`
- 2 nouveaux tests pour le fallback dans `rgbToIndexBufferExact()`
- Tous les tests existants continuent de passer
- Build réussi sans erreurs

## Impact sur les performances

- Impact minimal : calcul de luminance fait une seule fois par palette
- Cache interne pour optimiser les lookups répétés
- Complexité cognitive réduite grâce à l'extraction de fonctions helpers

## Configuration

Pour activer le nouveau comportement :
```typescript
// Nouveau comportement recommandé pour CPC Plus
const indexBuf = rgbToIndexBufferExact(
  imageData,
  palette,
  shouldQuantize,
  true // fallbackToDarkest = true
)
```

Le comportement legacy reste disponible en gardant `fallbackToDarkest = false` (défaut).