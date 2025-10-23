# Color Disable Feature - Analysis & Abandonment Report

**Date**: 23 octobre 2025  
**Branch**: `feature/color-disable`  
**Status**: ❌ **ABANDONED** - Faible valeur ajoutée  
**Commits**: 14 commits (du 1b301c9 au 2f42855)

---

## 📋 Résumé Exécutif

La feature "color disable" permettait aux utilisateurs de désactiver des couleurs spécifiques de la palette CPC pour les exclure du processus de quantification. Après implémentation complète, la feature a été **abandonnée** car elle apportait **peu de valeur ajoutée** par rapport à sa complexité.

## 🎯 Objectif Initial

**Source**: Analyse de ConvImgCpc (`docs/analysis/CONVIMGCPC_UI_EXPORT_ANALYSIS.md`)

ConvImgCpc propose un système de désactivation de couleurs dans son éditeur de palette:
- Bouton "Désactiver" par couleur
- Couleurs désactivées exclues de la génération de palette
- Différent de "locked colors" (verrouillage = forcer présence)

**Use case théorique**:
- L'utilisateur veut éviter certaines couleurs (ex: jaune trop vif)
- Les couleurs désactivées ne sont jamais sélectionnées par le quantizer
- Libère des slots de palette pour d'autres couleurs

## 🏗️ Architecture Implémentée

### 1. State Management (Jotai)

```typescript
// src/app/store/palette/palette.ts

// Global disabled colors (par clé RGB)
export const disabledColorsAtom = atom<Set<string>>(new Set<string>())

// Atom pour basculer l'état disabled via slot index
export const onToggleDisableAtom = atom(null, async (get, set, idx: number) => {
  const slots = get(userPaletteAtom)
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

// Atom pour basculer directement par couleur (re-enable UX)
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

// Helper: vecteurs désactivés
export const disabledVectorsAtom = atom((get) => {
  const disabledKeys = get(disabledColorsAtom)
  return Array.from(disabledKeys).map(keyToVector)
})

// Helper: vérifier si une couleur est désactivée
export const isColorDisabledAtom = atom((get) => {
  const disabledKeys = get(disabledColorsAtom)
  return (color: Vector | null): boolean => {
    if (!color) return false
    return disabledKeys.has(vectorToKey(color))
  }
})
```

### 2. Filtrage dans setReducedPaletteAtom

```typescript
export const setReducedPaletteAtom = atom(null, (get, set, reduced: Vector[]) => {
  const slots = get(userPaletteAtom)
  const lockedVecs = get(lockedVectorsAtom)
  const disabledVecs = get(disabledVectorsAtom)
  
  // Filtrer les couleurs locked ET disabled
  const queue = reduced.filter((vec) => {
    const isLocked = lockedVecs.some((lv) =>
      Array.from(lv).every((c, i) => c === vec[i])
    )
    const isDisabled = disabledVecs.some((dv) =>
      Array.from(dv).every((c, i) => c === vec[i])
    )
    return !isLocked && !isDisabled // Exclure si locked OU disabled
  })
  
  // ... reste du code
})
```

### 3. UI Components

#### Classic Mode (ColorGridView)
```tsx
// src/components/color-palette/color-grid/color-grid-view.tsx

// Visual feedback
const isDisabled = isColorDisabled(pc.vector)

<div className={styles.colorOptionWrapper}>
  <ColorButton
    disabled={isUsed && !isDisabled}
    onClick={() => {
      if (isDisabled) {
        onToggleDisableColor(pc.vector) // Re-enable
      } else {
        onColorSelect(pc, slotIndex)
      }
    }}
  />
  {isDisabled && (
    <span className={styles.colorOptionDisabled}>
      <Icon name='EyeNoneIcon' className={styles.colorOptionDisabledIcon} />
    </span>
  )}
</div>
```

#### Plus Mode (ColorPickerPopup)
```tsx
// src/components/ui/color-picker-popup/color-picker-popup.tsx

const handleToggleDisable = () => {
  onToggleDisableColor(workingColor)
  onClose()
}

<Button onClick={handleToggleDisable}>
  {isDisabled ? <Trans>Activer</Trans> : <Trans>Désactiver</Trans>}
</Button>
```

### 4. i18n (4 langues)

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

### 5. CSS Styling

```css
/* color-grid.module.css */
.colorOptionWrapper {
  position: relative;
}

.colorOptionDisabled {
  position: absolute;
  inset: 0;
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

## 🐛 Problème Critique Découvert

**Bug**: Les couleurs désactivées étaient quand même utilisées pour la génération de la preview.

**Root Cause**: Dans `quantizerAtom`, on filtrait `lockedVectorsAtom` mais **pas** `disabledVectorsAtom`:

```typescript
// ❌ BUGGY CODE (avant fix)
export const quantizerAtom = atom(async (get) => {
  const lockedVecs = get(lockedVectorsAtom)
  // ⚠️ disabledVectorsAtom n'est pas utilisé ici!
  
  const quantizer = createQuantizer({
    buf,
    basePalette: getPaletteForHardware(cpcHardware), // Palette complète!
    preselected: lockedVecs,
    quantConfig: { distanceMetric, contrastStrategy }
  })
  return quantizer
})
```

**Fix nécessaire** (non implémenté):
```typescript
export const quantizerAtom = atom(async (get) => {
  const lockedVecs = get(lockedVectorsAtom)
  const disabledVecs = get(disabledVectorsAtom)
  
  // Filtrer basePalette pour exclure les couleurs disabled
  const fullPalette = getPaletteForHardware(cpcHardware)
  const filteredPalette = fullPalette.filter((color) =>
    !disabledVecs.some((dv) =>
      Array.from(dv).every((c, i) => c === color[i])
    )
  )
  
  const quantizer = createQuantizer({
    buf,
    basePalette: filteredPalette, // ✅ Palette filtrée
    preselected: lockedVecs,
    quantConfig: { distanceMetric, contrastStrategy }
  })
  return quantizer
})
```

## 📊 Analyse de Valeur

### Complexité Technique
| Aspect | Effort | Impact |
|--------|--------|--------|
| State management | ⭐⭐⭐ Moyen | Global state + derived atoms |
| UI Classic mode | ⭐⭐ Faible | Overlay + icon |
| UI Plus mode | ⭐ Trivial | Button text toggle |
| Quantizer integration | ⭐⭐⭐⭐ Élevé | Filtrage basePalette + ReGL |
| i18n | ⭐ Trivial | 4 langues |
| Tests | ⭐⭐ Faible | Props updates |
| **TOTAL** | **⭐⭐⭐ Moyen** | 14 commits |

### Valeur Utilisateur
| Critère | Évaluation | Justification |
|---------|------------|---------------|
| **Use case fréquent?** | ❌ Non | Cas rare: l'utilisateur veut éviter une couleur spécifique |
| **Différence vs Locked?** | ⚠️ Faible | Locked colors = forcer présence. Disable = exclure. Mais overlap fonctionnel |
| **Impact visuel?** | ⚠️ Minime | L'utilisateur peut simplement ne pas verrouiller les couleurs indésirables |
| **Complexité UX?** | ❌ Élevée | Confusion avec "locked colors" |
| **Workflow improvement?** | ❌ Marginal | Alternative: ne pas verrouiller = même résultat |

### Comparaison avec ConvImgCpc

**ConvImgCpc** propose cette feature **mais**:
- Contexte desktop (Windows Forms) = UI plus complexe tolérée
- Éditeur de palette avancé avec multiples modes
- Utilisateurs experts (démo-scène CPC)

**Pixsaur**:
- Web app = UX simple prioritaire
- Utilisateurs grand public
- Feature "locked colors" déjà bien comprise

## 💭 Raisons de l'Abandon

### 1. **Faible Valeur Ajoutée**
- Use case très rare en pratique
- Alternative simple: ne pas verrouiller les couleurs indésirables
- Workflow existant suffisant (locked colors + quantizer)

### 2. **Confusion UX**
- Risque de confusion avec "locked colors"
- "Disable" vs "Lock" pas assez différenciés pour l'utilisateur
- Complexité mentale élevée pour bénéfice faible

### 3. **Bug Critique**
- Nécessite refonte de `quantizerAtom` pour filtrer `basePalette`
- Impact sur ReGL quantizer (GPU) complexe
- Risque de régression sur fonctionnalité stable

### 4. **ROI Faible**
- 14 commits pour feature marginale
- Temps dev > valeur utilisateur
- Maintenance future coûteuse

### 5. **Alternative Simple**
```
Scénario: "Je ne veux pas de jaune"
❌ Feature disable: Désactiver le jaune
✅ Alternative existante: Ne pas verrouiller le jaune, laisser quantizer décider
```

## 📈 Leçons Apprises

### 1. **Validation Use Case Avant Implémentation**
- ⚠️ On a implémenté sans valider le besoin utilisateur réel
- ✅ Prochaine fois: créer un prototype minimal avant full feature

### 2. **Différenciation Fonctionnelle**
- ⚠️ "Disable" trop similaire à "Lock" (inverse)
- ✅ Features doivent avoir valeur distincte claire

### 3. **Analyse ROI**
| Phase | Temps | Valeur |
|-------|-------|--------|
| Architecture | 3h | ⭐⭐ |
| UI Classic | 2h | ⭐⭐ |
| UI Plus | 1h | ⭐ |
| i18n | 1h | ⭐ |
| Bug fixing | 2h | - |
| **TOTAL** | **9h** | **⭐⭐ Faible** |

### 4. **Keep It Simple**
- Feature "locked colors" existante = suffisante
- Ajouter complexité ≠ ajouter valeur
- Simplicité UX > exhaustivité fonctionnelle

## 🔗 Références

### Code Implémenté
- `src/app/store/palette/palette.ts` - State atoms
- `src/components/color-palette/color-grid/color-grid-view.tsx` - Classic mode UI
- `src/components/ui/color-picker-popup/color-picker-popup.tsx` - Plus mode UI
- `src/locales/{en,fr,es,de}/messages.po` - i18n

### Documentation Source
- `docs/analysis/CONVIMGCPC_UI_EXPORT_ANALYSIS.md` - Section 4.3.1 "Désactivation de couleurs"
- `docs/IMPLEMENTATION_STARTER_KIT.md` - Guide implémentation

### Commits (14 total)
```
1b301c9 feat(palette): add disabled state to PaletteSlot
61bc63b feat(ui): add disable UI to color palette
3c735f9 fix(ui): add missing onToggleDisableAtom import
19790d4 fix(ui): add Activer/Désactiver button to ColorPickerPopup
02f196f feat(quantizer): exclude disabled colors from palette selection
3de8807 feat(i18n): add translations for color disable feature
ac65727 fix: use correct EyeNoneIcon for disabled state overlay
9e959b8 fix: remove infinite loop caused by useEffect
2575009 fix: proper palette sync with write-only atom
e8d9fee refactor: change disabled from per-slot to per-color (global)
f66a20d fix: filter disabled colors in setReducedPaletteAtom
c096eca fix: make palette sync reactive to all changes
dfd7aca fix: make palette sync reactive with useEffect
2f42855 feat: wire onToggleDisableColorAtom for re-enable UX
```

## ✅ Recommandation Finale

**NE PAS implémenter** cette feature dans Pixsaur.

**Alternative recommandée**:
- Conserver uniquement "locked colors" (forcer présence)
- Documenter workflow: "Pour exclure une couleur, ne pas la verrouiller"
- Focus sur features à plus forte valeur ajoutée (voir `CONVIMGCPC_UI_EXPORT_ANALYSIS.md`)

**Priorités supérieures identifiées**:
1. ⭐⭐⭐⭐ Export ASM avancé (labels configurables, compression)
2. ⭐⭐⭐ Générateur de palette intelligent
3. ⭐⭐⭐ Distance RGB pondérée (perception visuelle)
4. ⭐⭐ Lissage horizontal (anti-aliasing Mode 0)

---

**Statut**: ❌ **ABANDONED**  
**Branche**: `feature/color-disable` (à supprimer après merge de cette doc sur main)  
**Date d'abandon**: 23 octobre 2025  
**Décision**: Faible valeur ajoutée, complexité injustifiée, alternatives simples existantes
