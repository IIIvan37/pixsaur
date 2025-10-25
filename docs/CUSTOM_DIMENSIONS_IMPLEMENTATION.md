# Custom Target Dimensions - Implementation Guide

**Feature** : Permettre aux utilisateurs de définir des dimensions personnalisées pour l'image CPC de sortie  
**Status** : 🚧 En cours d'implémentation  
**Date** : Octobre 2025  
**Branch** : `feature/custom-target-dimensions`

## 🎯 Objectif

Permettre de spécifier n'importe quelle dimension CPC valide au-delà des modes standards (0, 1, 2) et overscan, avec validation en temps réel et respect strict des contraintes matérielles CPC.

## 1. Contraintes CPC pour Dimensions Custom

### 1.1 Contraintes Matérielles

L'Amstrad CPC impose des contraintes strictes sur les dimensions d'image en raison de son encodage pixel et de sa mémoire limitée.

#### Largeur (Width)

La contrainte sur la largeur dépend du mode CPC et de l'encodage des pixels :

```typescript
// Mode 0: 2 pixels par byte
widthInBytes = width / 2
// widthInBytes doit être pair → width % 4 === 0

// Mode 1: 4 pixels par byte
widthInBytes = width / 4
// widthInBytes doit être pair → width % 8 === 0

// Mode 2: 8 pixels par byte
widthInBytes = width / 8
// widthInBytes doit être pair → width % 16 === 0
```

**Raison** : L'architecture mémoire du CPC nécessite que la largeur en octets (bytes) soit paire pour l'entrelacement mémoire.

#### Hauteur (Height)

```typescript
height % 8 === 0  // Hauteur doit être multiple de 8
```

**Raison** : Entrelacement mémoire CPC par blocs de 8 lignes (structure caractère 8×1).

## 📊 Exemples de dimensions valides

### 1.2 Exemples de Dimensions Valides

#### Mode 0 (2 pixels/byte, width % 4 === 0, height % 8 === 0)

```typescript
✅ Valides:
- 160×200 (Standard)      → 80 bytes/line × 200 = 16 000 bytes
- 128×256 (Custom)        → 64 bytes/line × 256 = 16 384 bytes  
- 164×248 (Custom)        → 82 bytes/line × 248 = 20 336 bytes
- 200×192 (Custom)        → 100 bytes/line × 192 = 19 200 bytes

❌ Invalides:
- 160×201 → height % 8 !== 0 (201 % 8 = 1)
- 162×200 → width % 4 !== 0 (162 % 4 = 2)
- 161×199 → Les deux contraintes violées
```

#### Mode 1 (4 pixels/byte, width % 8 === 0, height % 8 === 0)

```typescript
✅ Valides:
- 320×200 (Standard)      → 80 bytes/line × 200 = 16 000 bytes
- 256×256 (Custom)        → 64 bytes/line × 256 = 16 384 bytes
- 328×248 (Custom)        → 82 bytes/line × 248 = 20 336 bytes
- 384×192 (Custom)        → 96 bytes/line × 192 = 18 432 bytes

❌ Invalides:
- 320×201 → height % 8 !== 0
- 324×200 → width % 8 !== 0 (324 % 8 = 4)
- 322×199 → Les deux contraintes violées
```

#### Mode 2 (8 pixels/byte, width % 16 === 0, height % 8 === 0)

```typescript
✅ Valides:
- 640×200 (Standard)      → 80 bytes/line × 200 = 16 000 bytes
- 512×256 (Custom)        → 64 bytes/line × 256 = 16 384 bytes
- 656×248 (Custom)        → 82 bytes/line × 248 = 20 336 bytes
- 768×192 (Custom)        → 96 bytes/line × 192 = 18 432 bytes

❌ Invalides:
- 640×201 → height % 8 !== 0
- 648×200 → width % 16 !== 0 (648 % 16 = 8)
- 644×199 → Les deux contraintes violées
```

### Mode 0 (2 pixels/byte, width % 4, height % 8)
```typescript
// ✅ Valides  
{ width: 160, height: 200 }  // Standard - 16 000 bytes
{ width: 164, height: 248 }  // Custom  - 20 336 bytes
{ width: 128, height: 256 }  // Custom  - 16 384 bytes
{ width: 200, height: 192 }  // Custom  - 19 200 bytes

// ❌ Invalides
{ width: 162, height: 200 }  // width % 4 !== 0
{ width: 160, height: 201 }  // height % 8 !== 0
{ width: 512, height: 512 }  // 65 536 bytes > 64 Ko
```

### Mode 1 (4 pixels/byte, width % 8, height % 8)
```typescript
// ✅ Valides
{ width: 320, height: 200 }  // Standard - 16 000 bytes
{ width: 328, height: 248 }  // Custom  - 20 336 bytes
{ width: 256, height: 256 }  // Custom  - 16 384 bytes
{ width: 400, height: 160 }  // Custom  - 16 000 bytes

// ❌ Invalides
{ width: 324, height: 200 }  // width % 8 !== 0
{ width: 320, height: 201 }  // height % 8 !== 0
{ width: 512, height: 512 }  // 65 536 bytes > 64 Ko
```

### Mode 2 (8 pixels/byte, width % 16, height % 8)
```typescript
// ✅ Valides
{ width: 640, height: 200 }  // Standard - 16 000 bytes
{ width: 656, height: 248 }  // Custom  - 20 336 bytes
{ width: 512, height: 256 }  // Custom  - 16 384 bytes
{ width: 800, height: 160 }  // Custom  - 16 000 bytes

// ❌ Invalides
{ width: 648, height: 200 }  // width % 16 !== 0
{ width: 640, height: 201 }  // height % 8 !== 0
{ width: 1024, height: 512 } // 65 536 bytes > 64 Ko
```

## 🔧 Architecture technique

### 1. Types et configuration

**Fichier** : `src/app/store/config/types.ts`

```typescript
// Étendre CpcModeKey
export type CpcModeKey =
  | '0'
  | '1'
  | '2'
  | '0-overscan'
  | '1-overscan'
  | '2-overscan'
  | 'custom'  // NOUVEAU

// Configuration pour mode custom
export type CustomModeConfig = {
  mode: 0 | 1 | 2  // Mode CPC de base
  width: number     // Largeur personnalisée
  height: number    // Hauteur personnalisée
  nColors: number   // Calculé depuis mode (16, 4, ou 2)
  scaleX: number    // Aspect ratio pixel (2, 1, 1)
  scaleY: number    // Aspect ratio pixel (1, 1, 2)
}
```

### 2. Validation

**Fichier** : `src/utils/validate-custom-dimensions.ts`

```typescript
export interface ValidationResult {
  valid: boolean
  widthInBytes: number
  bytes: number
  kb: number
  errors: string[]
}

export function validateCustomDimensions(
  width: number,
  height: number,
  mode: 0 | 1 | 2
): ValidationResult {
  const errors: string[] = []
  const pixelsPerByte = [2, 4, 8][mode]
  const widthInBytes = width / pixelsPerByte
  
  // Vérification largeur multiple selon mode
  const widthMultiple = [4, 8, 16][mode]
  if (width % widthMultiple !== 0) {
    errors.push(`Width must be multiple of ${widthMultiple} for Mode ${mode}`)
  }
  
  // Vérification largeur en octets paire
  if (widthInBytes % 2 !== 0) {
    errors.push(`Width in bytes (${widthInBytes}) must be even`)
  }
  
  // Vérification hauteur multiple de 8 (entrelacement CPC)
  if (height % 8 !== 0) {
    errors.push('Height must be multiple of 8 (CPC interlacing)')
  }
  
  // Calcul mémoire
  const bytes = height * widthInBytes
  const kb = bytes / 1024
  
  if (bytes > 65536) {
    errors.push(`Memory ${kb.toFixed(2)} Ko exceeds 64 Ko limit`)
  }
  
  return {
    valid: errors.length === 0,
    widthInBytes,
    bytes,
    kb,
    errors
  }
}
```

### 3. State management (Jotai)

**Fichier** : `src/app/store/config/config.ts`

```typescript
// Atom pour dimensions custom
export const customDimensionsAtom = atom<{ width: number; height: number }>({
  width: 160,
  height: 200
})

// Setter avec validation
export const setCustomDimensionsAtom = atom(
  null,
  (get, set, payload: { width: number; height: number }) => {
    const mode = get(modeAtom)
    const modeConfig = CPC_MODE_CONFIG[mode]
    
    // Validation
    const validation = validateCustomDimensions(
      payload.width,
      payload.height,
      modeConfig.mode
    )
    
    if (validation.valid) {
      set(customDimensionsAtom, payload)
    }
    
    return validation
  }
)

// Atom dérivé pour obtenir la config effective
export const effectiveModeConfigAtom = atom((get) => {
  const mode = get(modeAtom)
  
  if (mode === 'custom') {
    const customDims = get(customDimensionsAtom)
    const baseMode = get(customBaseModeAtom) // 0, 1, ou 2
    
    return {
      mode: baseMode,
      width: customDims.width,
      height: customDims.height,
      nColors: [16, 4, 2][baseMode],
      scaleX: [2, 1, 1][baseMode],
      scaleY: [1, 1, 2][baseMode],
      overscan: false
    }
  }
  
  return CPC_MODE_CONFIG[mode]
})
```

### 4. Composant UI

**Fichier** : `src/components/custom-dimensions-panel/custom-dimensions-panel.tsx`

```tsx
import { useAtom, useAtomValue } from 'jotai'
import { customDimensionsAtom, setCustomDimensionsAtom, modeAtom } from '@/app/store/config/config'
import { validateCustomDimensions } from '@/utils/validate-custom-dimensions'
import { CPC_MODE_CONFIG } from '@/app/store/config/types'
import styles from './custom-dimensions-panel.module.css'

export const CustomDimensionsPanel = () => {
  const [dimensions, setDimensions] = useAtom(customDimensionsAtom)
  const mode = useAtomValue(modeAtom)
  const modeConfig = CPC_MODE_CONFIG[mode]
  
  const validation = validateCustomDimensions(
    dimensions.width,
    dimensions.height,
    modeConfig.mode
  )
  
  // Step selon mode (4, 8, ou 16 pour width, 8 pour height)
  const widthStep = [4, 8, 16][modeConfig.mode]
  const heightStep = 8
  
  const presets = [
    { name: 'Mode 0 Standard', width: 160, height: 200, mode: 0 },
    { name: 'Mode 1 Standard', width: 320, height: 200, mode: 1 },
    { name: 'Mode 2 Standard', width: 640, height: 200, mode: 2 },
    { name: 'Mode 0 Overscan', width: 192, height: 272, mode: 0 },
    { name: 'Mode 1 Overscan', width: 384, height: 272, mode: 1 },
    { name: 'Mode 2 Overscan', width: 768, height: 272, mode: 2 },
  ]
  
  return (
    <div className={styles.panel}>
      {/* Presets */}
      <div className={styles.presets}>
        <label>Presets:</label>
        <div className={styles.presetButtons}>
          {presets.map(preset => (
            <button
              key={preset.name}
              onClick={() => setDimensions({ width: preset.width, height: preset.height })}
              className={styles.presetButton}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>
      
      {/* Custom dimensions */}
      <div className={styles.inputs}>
        <div className={styles.inputGroup}>
          <label>Width (multiple of {widthStep}):</label>
          <input
            type="number"
            min={widthStep}
            max={1024}
            step={widthStep}
            value={dimensions.width}
            onChange={(e) => setDimensions({ ...dimensions, width: Number(e.target.value) })}
            className={validation.errors.some(e => e.includes('Width')) ? styles.error : ''}
          />
        </div>
        
        <div className={styles.inputGroup}>
          <label>Height (multiple of 8):</label>
          <input
            type="number"
            min={8}
            max={544}
            step={heightStep}
            value={dimensions.height}
            onChange={(e) => setDimensions({ ...dimensions, height: Number(e.target.value) })}
            className={validation.errors.some(e => e.includes('Height')) ? styles.error : ''}
          />
        </div>
      </div>
      
      {/* Validation feedback */}
      <div className={validation.valid ? styles.memoryOk : styles.memoryError}>
        {validation.valid ? (
          <>
            ✅ {validation.kb.toFixed(2)} Ko / 64 Ko
            ({validation.widthInBytes} bytes/line × {dimensions.height} lines)
            {validation.bytes <= 16384 && ' (Standard 16Ko)'}
          </>
        ) : (
          <>
            ❌ {validation.errors.join(', ')}
          </>
        )}
      </div>
    </div>
  )
}
```

## 🔄 Pipeline d'intégration

### Preview

**Fichier** : `src/app/store/preview/preview.ts`

```typescript
// Utiliser effectiveModeConfigAtom au lieu de CPC_MODE_CONFIG[mode]
export const previewCanvasSizeAtom = atom((get) => {
  const containerWidth = get(previewCanvasWidthAtom)
  const effectiveConfig = get(effectiveModeConfigAtom)  // CHANGÉ
  
  if (!containerWidth) return { width: 0, height: 0 }
  
  const canvasWidth = effectiveConfig.width   // Peut être custom
  const canvasHeight = effectiveConfig.height // Peut être custom
  
  // ... reste du calcul
})
```

### Export

Les exports SCR/ASM utilisent déjà `pixelsPerByte` donc sont compatibles :

```typescript
// export-scr.ts
const pixelsPerByte = [2, 4, 8][modeConfig.mode]
for (let y = 0; y < modeConfig.height; y += 2) {
  for (let x = 0; x < modeConfig.width / pixelsPerByte; x++) {
    // Fonctionne avec dimensions custom !
  }
}
```

## ✅ Tests

### Tests unitaires

**Fichier** : `src/utils/validate-custom-dimensions.spec.ts`

```typescript
describe('validateCustomDimensions', () => {
  describe('Mode 0 (width % 4)', () => {
    it('should accept 160×200 (standard)', () => {
      const result = validateCustomDimensions(160, 200, 0)
      expect(result.valid).toBe(true)
      expect(result.bytes).toBe(16000)
    })
    
    it('should accept 164×100 (custom valid)', () => {
      const result = validateCustomDimensions(164, 100, 0)
      expect(result.valid).toBe(true)
      expect(result.widthInBytes).toBe(82) // pair ✓
    })
    
    it('should reject 162×200 (width not multiple of 4)', () => {
      const result = validateCustomDimensions(162, 200, 0)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(expect.stringContaining('multiple of 4'))
    })
    
    it('should reject 160×201 (height odd)', () => {
      const result = validateCustomDimensions(160, 201, 0)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(expect.stringContaining('Height must be even'))
    })
    
    it('should reject 400×400 (> 64Ko)', () => {
      const result = validateCustomDimensions(400, 400, 0)
      expect(result.valid).toBe(false)
      expect(result.bytes).toBeGreaterThan(65536)
    })
  })
  
  // Tests similaires pour Mode 1 et 2
})
```

### Tests d'intégration

```typescript
describe('Custom dimensions workflow', () => {
  it('should preview and export with custom Mode 0 dimensions', async () => {
    // Setup custom 164×100
    setCustomDimensions({ width: 164, height: 100 })
    setMode('custom')
    
    // Load image
    await loadImage(testImage)
    
    // Verify preview uses custom dimensions
    const preview = getPreview()
    expect(preview.width).toBe(164)
    expect(preview.height).toBe(100)
    
    // Export SCR
    const scr = exportSCR()
    expect(scr.byteLength).toBe(8200) // 164/2 * 100
  })
})
```

## 🌍 Internationalisation

**Fichiers** : `src/locales/{en,fr,es,de}/messages.po`

```po
# EN
msgid "custom.dimensions.width.label"
msgstr "Width (must be multiple of {multiple})"

msgid "custom.dimensions.height.label"
msgstr "Height (must be even)"

msgid "custom.dimensions.memory.ok"
msgstr "{kb} Ko / 64 Ko"

msgid "custom.dimensions.error.width"
msgstr "Width must be multiple of {multiple} for Mode {mode}"

msgid "custom.dimensions.error.height"
msgstr "Height must be even"

msgid "custom.dimensions.error.memory"
msgstr "Memory {kb} Ko exceeds 64 Ko limit"

# FR
msgid "custom.dimensions.width.label"
msgstr "Largeur (doit être multiple de {multiple})"

msgid "custom.dimensions.height.label"
msgstr "Hauteur (doit être paire)"

msgid "custom.dimensions.memory.ok"
msgstr "{kb} Ko / 64 Ko"

msgid "custom.dimensions.error.width"
msgstr "La largeur doit être multiple de {multiple} pour le Mode {mode}"

msgid "custom.dimensions.error.height"
msgstr "La hauteur doit être paire"

msgid "custom.dimensions.error.memory"
msgstr "Mémoire {kb} Ko dépasse la limite de 64 Ko"
```

## 📝 Checklist d'implémentation

- [ ] Documentation (ce fichier)
- [ ] Types : Ajouter `'custom'` à `CpcModeKey` et `CustomModeConfig`
- [ ] Validation : `validateCustomDimensions()` avec tous les checks
- [ ] Atoms : `customDimensionsAtom`, `setCustomDimensionsAtom`, `effectiveModeConfigAtom`
- [ ] UI : `CustomDimensionsPanel` avec inputs, presets, validation live
- [ ] Intégration : Ajouter toggle 'Custom' dans image-controls
- [ ] Preview : Utiliser `effectiveModeConfigAtom` dans `preview.ts`
- [ ] Export : Vérifier compatibilité SCR/ASM avec custom dimensions
- [ ] Tests unitaires : Validation pour chaque mode
- [ ] Tests intégration : Workflow complet preview → export
- [ ] I18N : Traductions FR/EN/ES/DE

## 🎯 Bénéfices

- ✅ **Flexibilité maximale** : Toute dimension CPC valide
- ✅ **Validation temps réel** : Feedback instantané sur contraintes
- ✅ **Presets intégrés** : Accès rapide aux tailles standards
- ✅ **Éducatif** : Utilisateur comprend les contraintes CPC
- ✅ **Robuste** : Impossible de générer des exports invalides
- ✅ **Compatible** : Pipeline export existant fonctionne déjà

## 🔗 Références

- [CPC_PIXEL_ENCODING.md](./CPC_PIXEL_ENCODING.md) - Encodage pixels par mode
- [CONVIMGCPC_UI_EXPORT_ANALYSIS.md](./analysis/CONVIMGCPC_UI_EXPORT_ANALYSIS.md) - Section 8 : Dimensionnement
- Code existant : `export-scr.ts`, `asm-generator.ts` (déjà compatible via `pixelsPerByte`)

---

**Note** : Cette feature respecte strictement l'architecture Pixsaur (Jotai atoms, validation stricte, contraintes CPC) et réutilise le pipeline d'export existant.
