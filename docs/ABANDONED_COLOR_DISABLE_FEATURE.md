# Feature "Color Disable" - ABANDONNÉE

**Date d'analyse**: Octobre 23, 2025  
**Branche**: `feature/color-disable`  
**Status**: ❌ **ABANDONNÉE** - Peu de plus-value utilisateur  
**Raison**: La complexité d'implémentation ne justifie pas le gain UX limité

---

## 📋 Contexte

Cette feature visait à permettre aux utilisateurs de **désactiver des couleurs spécifiques** de la palette CPC pour les exclure de la quantification, tout en libérant les slots de palette.

### Problème identifié lors de l'analyse

**Inspiré de**: [ConvImgCpc UI Analysis](./analysis/CONVIMGCPC_UI_EXPORT_ANALYSIS.md) - Section "Palette Management Features" (priorité HIGH)

**Use case supposé**:
- Utilisateur veut exclure certaines couleurs de la quantification
- Exemple: désactiver les bleus pour forcer une palette chaleude (rouges/jaunes)

**Problème de design découvert**:
> "j'ai du mal à comprendre le use case de cette feature"  
> "on bloque un index de palette qui pourrait servir pour une autre couleur"

---

## 🏗️ Architecture Implémentée

### État Global (Jotai Atoms)

```typescript
// src/app/store/palette/palette.ts

// 1. État global des couleurs désactivées (Set de clés RGB)
export const disabledColorsAtom = atom<Set<string>>(new Set<string>())

// 2. Toggle disable via slot index
export const onToggleDisableAtom = atom(null, async (get, set, idx: number) => {
  const color = slots[idx]?.color
  if (!color) return
  
  const colorKey = vectorToKey(color)
  const disabledColors = new Set(get(disabledColorsAtom))
  
  if (disabledColors.has(colorKey)) {
    disabledColors.delete(colorKey) // Réactiver
  } else {
    disabledColors.add(colorKey) // Désactiver
  }
  
  set(disabledColorsAtom, disabledColors)
})

// 3. Toggle disable via couleur directe (pour re-enable UX)
export const onToggleDisableColorAtom = atom(
  null,
  (get, set, color: Vector<'RGB'>) => {
    const colorKey = vectorToKey(color)
    const disabledColors = new Set(get(disabledColorsAtom))
    
    if (disabledColors.has(colorKey)) {
      disabledColors.delete(colorKey)
    } else {
      disabledColors.add(colorKey)
    }
    
    set(disabledColorsAtom, disabledColors)
  }
)

// 4. Filtrage dans setReducedPaletteAtom
const queue = reduced.filter((vec) => {
  const isLocked = lockedVecs.some(...)
  const isDisabled = disabledVecs.some(...)
  
  return !isLocked && !isDisabled // ✅ Exclusion des désactivées
})
```

### UI Implémentée

#### Classic Mode (ColorGridView)
```tsx
// Visual feedback: overlay + icon
{isDisabled && (
  <span className={styles.colorOptionDisabled}>
    <Icon name='EyeNoneIcon' />
  </span>
)}

// Re-enable: click sur couleur désactivée
onClick={() => {
  if (isDisabled) {
    onToggleDisableColor(pc.vector) // Réactive
  } else {
    onColorSelect(pc, slotIndex)
  }
}}
```

#### Plus Mode (ColorPickerPopup)
```tsx
// Bouton toggle
<Button onClick={handleToggleDisable}>
  {isDisabled ? <Trans>Activer</Trans> : <Trans>Désactiver</Trans>}
</Button>
```

### CSS Module Styles

```css
/* color-grid.module.css */
.colorOptionWrapper {
  position: relative;
}

.colorOptionDisabled {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.colorOptionDisabledIcon {
  width: 16px;
  height: 16px;
  color: white;
}
```

### i18n (4 langues)

```po
# EN
msgid "r8aFBg"
msgstr "Disable"

msgid "AvH+5H"
msgstr "Enable"

# FR
msgstr "Désactiver"
msgstr "Activer"

# ES
msgstr "Desactivar"
msgstr "Activar"

# DE
msgstr "Deaktivieren"
msgstr "Aktivieren"
```

---

## 🐛 Bugs Découverts et Résolus

### Bug #1: Couleurs désactivées toujours utilisées dans quantization

**Symptôme**: Les couleurs désactivées apparaissaient quand même dans la preview

**Cause**: `quantizerAtom` ne filtrait pas `disabledVectorsAtom` de la `basePalette`

**Fix identifié** (non appliqué car feature abandonnée):
```typescript
export const quantizerAtom = atom(async (get) => {
  const disabledVecs = get(disabledVectorsAtom)
  const basePalette = getPaletteForHardware(cpcHardware)
  
  // Filtrer les couleurs désactivées
  const filteredPalette = basePalette.filter(color => 
    !disabledVecs.some(dv => 
      Array.from(dv).every((c, i) => c === color[i])
    )
  )
  
  const quantizer = createQuantizer({
    buf,
    basePalette: filteredPalette, // ✅ Palette filtrée
    preselected: lockedVecs,
    // ...
  })
})
```

### Bug #2: Tests TypeScript cassés

**Fichiers impactés**:
- `color-grid.tsx`: Props manquantes
- `empty.slot.tsx`: Props manquantes
- `color-palette-view.spec.tsx`: Props manquantes
- `color-picker-popup.spec.tsx`: Props manquantes

**Tous résolus** en ajoutant les props requises.

---

## 📊 Implémentation Complète (11 commits)

```bash
git log --oneline feature/color-disable ^main

# Commits réalisés:
1. feat: add disabled colors global state and UI toggle
2. feat: add disabled color visual feedback (overlay + icon)
3. feat: wire onToggleDisableColorAtom for re-enable UX
4. fix: add missing props to tests and components
5. ... (7 autres commits de refactoring)
```

**Fichiers modifiés**: 15+
- `src/app/store/palette/palette.ts`
- `src/app/store/palette/types.ts`
- `src/app/components/preview-panel.tsx`
- `src/components/color-palette/color-palette.tsx`
- `src/components/color-palette/color-palette-view.tsx`
- `src/components/color-palette/color-grid/color-grid-view.tsx`
- `src/components/color-palette/color-grid/color-grid.module.css`
- `src/components/ui/color-picker-popup/color-picker-popup.tsx`
- `src/components/ui/icon.tsx`
- `src/locales/{en,fr,es,de}/messages.po`
- Tests specs (4 fichiers)

---

## 💡 Réflexions Post-Mortem

### Pourquoi cette feature a peu de valeur

1. **Use case limité**: 
   - Les utilisateurs veulent généralement **ajouter/modifier** des couleurs, pas les désactiver
   - Si une couleur n'est pas désirée, il suffit de ne pas la verrouiller → elle disparaîtra naturellement

2. **Complexité vs bénéfice**:
   - Architecture complexe (global state, filtrage quantizer, UI dual mode)
   - Bug subtil avec `quantizerAtom` qui nécessite filtrage additionnel
   - UX confuse: "désactiver" vs "ne pas verrouiller" → différence peu claire

3. **Alternative existante**:
   - **Locked colors** couvre déjà le besoin principal: "forcer certaines couleurs"
   - L'utilisateur peut simplement ne pas verrouiller les couleurs indésirables

### Ce qui aurait pu être fait différemment

Si cette feature devait être réimplémentée:

1. **Filtrage précoce**: Filtrer `basePalette` dès `quantizerAtom` au lieu de `setReducedPaletteAtom`
2. **UI simplifiée**: Un simple bouton "Exclure de la quantification" dans le color picker
3. **Meilleure documentation**: Expliquer clairement la différence avec "locked colors"

---

## 📚 Leçons Apprises

### Pour les futures features

1. **Valider le use case AVANT l'implémentation**:
   - Poser la question: "Quelle est la vraie douleur utilisateur?"
   - Vérifier qu'il n'existe pas déjà une solution (locked colors)

2. **Architecture réactive avec Jotai**:
   - ✅ La séparation `disabledColorsAtom` + derived atoms fonctionne bien
   - ✅ Le pattern `onToggleDisableColorAtom` pour actions directes est propre

3. **Tests sont indispensables**:
   - Les erreurs TypeScript ont révélé tous les endroits nécessitant mise à jour
   - Sans tests, bugs silencieux garantis

4. **i18n dès le début**:
   - 4 langues ajoutées facilement grâce à Lingui
   - Pattern `<Trans>` fonctionne parfaitement

---

## 🗑️ Décision Finale

**FEATURE ABANDONNÉE** - Octobre 23, 2025

**Raison**: Peu de plus-value utilisateur. La fonctionnalité "locked colors" existante couvre déjà 90% du besoin.

**Branche**: `feature/color-disable` - À supprimer après merge de cette documentation

**Travail conservé**:
- ✅ Analyse complète documentée (ce fichier)
- ✅ Architecture Jotai validée (réutilisable pour autres features)
- ✅ Pattern de filtrage quantizer identifié

**Prochaines priorités** (ConvImgCpc Analysis):
1. **Export ASM avancé** (labels, compression) - HIGH priority
2. **Générateur de palettes** (weighted RGB distance) - HIGH priority
3. **Lissage horizontal** (anti-aliasing Mode 0) - HIGH priority

---

## 📖 Références

- [CONVIMGCPC_UI_EXPORT_ANALYSIS.md](./analysis/CONVIMGCPC_UI_EXPORT_ANALYSIS.md) - Section "Palette Management"
- [IMPLEMENTATION_STARTER_KIT.md](./IMPLEMENTATION_STARTER_KIT.md) - Guide de démarrage
- [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) - Architecture Pixsaur

---

**Note**: Ce document sert de référence pour comprendre pourquoi certaines features inspirées de ConvImgCpc ne sont **pas** implémentées dans Pixsaur, malgré une analyse approfondie.
