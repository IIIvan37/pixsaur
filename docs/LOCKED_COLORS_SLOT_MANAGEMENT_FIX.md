# Correction - Gestion des couleurs verrouillées dans la palette

## Problème identifié ✅ RÉSOLU

**Problème** : Avec des couleurs verrouillées (locked), le système :
1. Continuait d'ajouter des couleurs au-delà du nombre maximum autorisé
2. N'incluait pas toujours les couleurs verrouillées dans la palette finale
3. Ne respectait pas la priorité des couleurs verrouillées

## Solution implémentée

### 1. Gestion intelligente des slots de couleurs

**Avant** :
```typescript
// Ajout aveugle jusqu'à maxColors, sans tenir compte des couleurs verrouillées
if (projected.length > maxColors) {
  projected.splice(maxColors)
}
```

**Après** :
```typescript
// Garantit l'inclusion de toutes les couleurs verrouillées
// puis remplit les slots restants avec les couleurs quantifiées
```

### 2. Logique de priorisation

1. **Ajout des couleurs verrouillées manquantes** : Vérification et ajout automatique
2. **Séparation locked/unlocked** : Distinction claire entre les deux types
3. **Calcul des slots disponibles** : `maxColors - lockedColors.length`
4. **Recomposition optimale** : Locked d'abord, puis unlocked jusqu'à la limite

### 3. Préservation du mode Classic

- ✅ Tests d'intégration passent
- ✅ Quantification CPC Classic préservée
- ✅ Aucune régression introduite
- ✅ Fallback darkest color maintenu

## Code implémenté

```typescript
export const reducedPaletteRgbAtom = atom(async (get) => {
  // ... récupération des données ...

  // 1. Garantir l'inclusion des couleurs verrouillées
  for (const lockedColor of lockedVecs) {
    const colorKey = `${lockedColor[0]},${lockedColor[1]},${lockedColor[2]}`
    const existsInProjected = projected.some(
      (color) => `${color[0]},${color[1]},${color[2]}` === colorKey
    )

    if (!existsInProjected) {
      projected.push([lockedColor[0], lockedColor[1], lockedColor[2]])
    }
  }

  // 2. Séparer couleurs verrouillées et non-verrouillées
  const lockedColors = projected.filter((color) =>
    lockedColorKeys.has(`${color[0]},${color[1]},${color[2]}`)
  )
  const unlockedColors = projected.filter(
    (color) => !lockedColorKeys.has(`${color[0]},${color[1]},${color[2]}`)
  )

  // 3. Respecter la limite en priorisant les couleurs verrouillées
  const availableSlots = maxColors - lockedColors.length
  const finalUnlocked = unlockedColors.slice(0, Math.max(0, availableSlots))

  // 4. Recomposer la palette finale
  projected.splice(0, projected.length, ...lockedColors, ...finalUnlocked)
})
```

## Avantages

1. **Respect total des choix utilisateur** : Couleurs verrouillées toujours présentes
2. **Limite stricte respectée** : Jamais plus de `maxColors` couleurs
3. **Quantification préservée** : Couleurs verrouillées gardent leurs valeurs exactes
4. **Rétrocompatibilité** : Mode Classic et Plus fonctionnent correctement

## Validation

- ✅ Tests d'intégration export réussis
- ✅ Code conforme aux standards Biome
- ✅ Pas de régression sur le mode Classic
- ✅ Logique de padding avec darkest color maintenue

Cette correction garantit que les couleurs verrouillées par l'utilisateur sont toujours incluses dans la palette finale tout en respectant les limites du mode CPC sélectionné.