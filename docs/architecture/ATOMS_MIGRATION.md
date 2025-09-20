# Migration Atoms : Direct vs Adaptateur

## Vue d'ensemble

Cette documentation explique la coexistence et la migration progressive entre le système d'atoms direct (legacy) et le nouveau système adaptateur dans Pixsaur.

## État actuel : Dual System

### ✅ Système Legacy (Direct) - Stable

```typescript
// preview.ts - Système existant qui fonctionne
export const quantizerAtom = atom((get) => {
  const buf = get(croppedBufferAtom)
  // ... 
  console.log('📊 [DIRECT] Creating quantizer directly (legacy system)')
  const quantizer = createQuantizer({ buf, basePalette, preselected, quantConfig })
  return quantizer
})

export const reducedPaletteRawAtom = atom<Vector[]>((get) => {
  const quantizer = get(quantizerAtom)
  // ...
  console.log('🎨 [DIRECT] Quantizing palette directly (legacy system)')
  const raw = quantizer.quantize(targetColors)
  return raw.map(v => [...v] as Vector)
})
```

### 🔮 Système Adaptateur - Nouveau

```typescript
// preview.ts - Alternative pour migration future
export const adapterPaletteAtom = atom(async (get) => {
  const buf = get(croppedBufferAtom)
  const cropped = get(croppedImageAtom)
  // ...
  
  const processor = processorFactory.createBestProcessor()
  
  const palette = await processor.quantizePalette(
    buf, cropped, targetColors, basePalette, lockedVecs, colorSpace
  )
  
  return palette
})
```

## Comparaison des approches

| Aspect | Direct (Legacy) | Adaptateur (Nouveau) |
|--------|-----------------|----------------------|
| **Performance** | Optimisé, éprouvé | Même perf + logs + cache |
| **Flexibilité** | CPU uniquement | CPU/WebGL/Hybrid |
| **Debugging** | Console.time basique | Logs structurés |
| **Cache** | Aucun | Factory cache |
| **Évolutivité** | Limitée | Haute |
| **Stabilité** | ✅ Prouvée | 🔄 En cours |

## Stratégie de migration

### Phase 1 : Coexistence ✅ (Actuel)

- ✅ Système legacy actif pour quantization
- ✅ Adaptateur actif pour image adjustments
- ✅ Documentation des deux approches

### Phase 2 : Migration graduelle 🔄

```typescript
// Option A : Switch progressif par feature
const USE_ADAPTER_QUANTIZATION = import.meta.env.VITE_USE_ADAPTER_QUANT === 'true'

export const paletteAtom = atom((get) => {
  if (USE_ADAPTER_QUANTIZATION) {
    return get(adapterPaletteAtom)
  }
  return get(reducedPaletteRawAtom)
})
```

```typescript
// Option B : A/B testing
const shouldUseAdapter = (colorSpace: string) => {
  // Utiliser adaptateur pour certains colorspaces
  return ['XYZ', 'LAB'].includes(colorSpace)
}
```

### Phase 3 : Migration complète 🚀

- Remplacement progressif des atoms legacy
- Tests de régression complets
- Monitoring des performances

## Patterns d'usage

### 1. Image Adjustments (Migré ✅)

```typescript
// ❌ Ancien - use-image-adjustement.tsx
import { applyAdjustmentsInOnePass } from '@/libs/pixsaur-color/src/...'
const result = applyAdjustmentsInOnePass(imageData, adjustments)

// ✅ Nouveau - use-image-adjustement.tsx
import { processorFactory } from '@/libs/pixsaur-adapter'
const processor = processorFactory.createBestProcessor()
const result = processor.applyAdjustmentsSync(imageData, adjustments)
```

### 2. Quantization (Dual System)

```typescript
// 🔄 Actuel - preview.ts (fonctionne bien)
export const quantizerAtom = atom((get) => {
  // Système direct éprouvé
})

// 🔮 Futur - preview.ts (prêt pour migration)
export const adapterPaletteAtom = atom(async (get) => {
  // Système adaptateur extensible
})
```

## Avantages de chaque approche

### Système Direct (Legacy)

**✅ Avantages :**
- Performance prouvée
- Code stable et testé
- Pas de couche d'abstraction
- Contrôle direct des optimisations

**❌ Inconvénients :**
- Difficile à étendre (pas de WebGL)
- Debugging limité
- Pas de cache des instances
- Code dupliqué pour différents processeurs

### Système Adaptateur

**✅ Avantages :**
- Architecture extensible (CPU → WebGL)
- Logs structurés pour debugging
- Cache automatique des instances
- Interface unifiée
- Préparé pour optimisations futures

**❌ Inconvénients :**
- Couche d'abstraction supplémentaire
- Plus complexe pour cas simples
- Besoin de tests supplémentaires

## Logs de comparaison

### Legacy System
```
📊 [DIRECT] Creating quantizer directly (legacy system)
🔍 [DIRECT] Quantizer Creation: 51.56ms
🎨 [DIRECT] Quantizing palette directly (legacy system)
🎨 [DIRECT] Palette Quantization: 450.82ms
```

### Adapter System  
```
🏭 [FACTORY] Creating best processor (CPU only for now)
🖥️ [FACTORY] Creating new CPU processor instance
🎯 [ADAPTER] Starting CPU quantization via adapter: colorSpace=RGB, targetColors=16
🔧 [ADAPTER] Quantizer Creation: 51.23ms
🎨 [ADAPTER] Quantization completed via adapter: 16/16 colors for RGB
```

## Guide de migration d'un atom

### Avant (Direct)
```typescript
export const myQuantizationAtom = atom((get) => {
  const buffer = get(bufferAtom)
  const colorSpace = get(colorSpaceAtom)
  
  // Création directe du quantizer
  const quantizer = createQuantizer({
    buf: buffer,
    basePalette: generateAmstradCPCPalette(),
    quantConfig: { colorSpace, distanceMetric: 'euclidean' }
  })
  
  return quantizer.quantize(16)
})
```

### Après (Adaptateur)
```typescript
export const myQuantizationAtom = atom(async (get) => {
  const buffer = get(bufferAtom)
  const imageData = get(imageDataAtom)
  const colorSpace = get(colorSpaceAtom)
  
  // Utilisation de l'adaptateur
  const processor = processorFactory.createBestProcessor()
  
  const palette = await processor.quantizePalette(
    buffer,
    imageData,
    16, // targetColors
    generateAmstradCPCPalette(), // basePalette
    [], // preselected
    colorSpace
  )
  
  return palette
})
```

### Changements requis

1. **Async atom** : `atom()` → `atom(async ())`
2. **Interface unifiée** : Utilisation de `processor.quantizePalette()`
3. **Paramètres explicites** : Tous les paramètres passés à la méthode
4. **Gestion d'erreur** : L'adaptateur gère les erreurs
5. **Logging automatique** : Pas besoin d'ajouter des logs

## Testing strategy

### Tests de régression
```typescript
describe('Quantization: Direct vs Adapter', () => {
  it('should produce identical results', async () => {
    const directResult = directQuantizer.quantize(16)
    const adapterResult = await adapterProcessor.quantizePalette(buffer, imageData, 16)
    
    expect(adapterResult).toEqual(directResult)
  })
})
```

### Performance benchmarks
```typescript
describe('Performance comparison', () => {
  it('adapter should not be slower than direct', async () => {
    const directTime = measureTime(() => directQuantizer.quantize(16))
    const adapterTime = measureTime(() => adapterProcessor.quantizePalette(...))
    
    expect(adapterTime).toBeLessThan(directTime * 1.1) // Max 10% overhead
  })
})
```

## Recommandations

### ✅ Utiliser l'adaptateur pour :
- **Nouvelles features** : Toujours utiliser l'adaptateur
- **Image adjustments** : Déjà migré avec succès
- **Features nécessitant WebGL** : Quand WebGL sera implémenté

### 🔄 Garder le direct pour :
- **Code existant stable** : Si pas de problème
- **Performance critique** : Où chaque ms compte
- **Migration progressive** : Pendant la transition

### 🚀 Migration recommandée :
- **Tests complets** avant migration
- **Feature flags** pour rollback facile
- **Monitoring** des performances
- **Documentation** des changements

L'objectif est une migration progressive sans régression, en tirant parti des avantages de l'architecture adaptateur.