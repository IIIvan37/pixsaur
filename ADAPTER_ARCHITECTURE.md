# Architecture Adaptateur Pixsaur

## Vue d'ensemble

L'architecture adaptateur de Pixsaur offre une abstraction unifiée pour traiter les images, permettant de basculer entre différentes implémentations (CPU, WebGL, etc.) de manière transparente.

## Structure

```
src/libs/pixsaur-adapter/
├── adapters/
│   └── cpu-processor.ts          # Implémentation CPU
├── interfaces.ts                 # Définitions TypeScript
├── factory.ts                    # Factory pattern + cache
└── index.ts                      # Exports publics
```

## Composants principaux

### 1. Interface `ImageProcessor`

```typescript
interface ImageProcessor {
  readonly type: 'cpu' | 'webgl'
  readonly isAvailable: boolean
  
  // Méthodes principales
  applyAdjustments(imageData: ImageData, adjustments: AdjustmentConfig): Promise<ImageData>
  applyAdjustmentsSync(imageData: ImageData, adjustments: AdjustmentConfig): ImageData
  quantizePalette(buffer: Uint8ClampedArray, ...): Promise<Vector[]>
  dispose(): void
}
```

### 2. Factory Pattern avec Cache

```typescript
// Usage
const processor = processorFactory.createBestProcessor()
const result = await processor.applyAdjustments(imageData, adjustments)
```

**Avantages :**
- ✅ Cache automatique des instances
- ✅ Sélection automatique du meilleur processor
- ✅ Gestion propre du cycle de vie

### 3. Système de Logging Intégré

```typescript
import { adapterLogger, quantizerLogger, paletteLogger } from '@/utils/logger'

// Logs avec préfixes automatiques
adapterLogger.info('🏭 [FACTORY] Creating processor...')
quantizerLogger.timeSync('Quantization Process', () => { ... })
```

## État actuel vs Futur

### ✅ Implémenté

| Composant | Statut | Description |
|-----------|--------|-------------|
| `CpuImageProcessor` | ✅ Complet | Wraps fonctions existantes avec logging |
| `ImageProcessorFactory` | ✅ Complet | Factory + cache + sélection automatique |
| Logging System | ✅ Complet | Logs différenciés par domaine |
| Interface TypeScript | ✅ Complet | Contrat clair pour toutes implémentations |

### 🚧 À implémenter

| Composant | Priorité | Description |
|-----------|----------|-------------|
| `WebGLImageProcessor` | Haute | Optimisations GPU pour adjustments |
| `HybridProcessor` | Moyenne | Combine avantages CPU + WebGL |
| Tests unitaires | Haute | Coverage des adaptateurs |
| Métriques performance | Basse | Benchmarks automatisés |

## Usage dans l'application

### Image Adjustments (Migré ✅)

```typescript
// ❌ Ancien (direct)
import { applyAdjustmentsInOnePass } from '@/libs/pixsaur-color/src/...'
const result = applyAdjustmentsInOnePass(imageData, adjustments)

// ✅ Nouveau (adaptateur)
import { processorFactory } from '@/libs/pixsaur-adapter'
const processor = processorFactory.createBestProcessor()
const result = processor.applyAdjustmentsSync(imageData, adjustments)
```

### Quantization Palette

```typescript
// ⚡ Actuel (direct) - fonctionne bien
export const quantizerAtom = atom((get) => {
  // ... logique existante avec createQuantizer direct
})

// 🔮 Futur (adaptateur) - pour migration progressive
export const adapterPaletteAtom = atom(async (get) => {
  const processor = processorFactory.createBestProcessor()
  return processor.quantizePalette(buffer, imageData, targetColors, ...)
})
```

## Logs dans la console

L'architecture produit des logs clairs pour debugging :

```
🏭 [FACTORY] Creating best processor (CPU only for now)
🖥️ [FACTORY] Creating new CPU processor instance
🏗️ CPU Processor instance created
✅ [FACTORY] CPU processor instance created and cached
🎨 [ADAPTER] Applying adjustments via CPU processor: brightness=1, contrast=1, saturation=1
🖥️ [ADAPTER] CPU Image Adjustments: 30.10ms

📊 [DIRECT] Creating quantizer directly (legacy system)
🎨 [DIRECT] Palette Quantization: 450.82ms
```

## Extension : Ajouter WebGL

### 1. Créer `WebGLImageProcessor`

```typescript
export class WebGLImageProcessor implements ImageProcessor {
  readonly type = 'webgl' as const
  readonly isAvailable: boolean

  constructor() {
    this.isAvailable = this.checkWebGLSupport()
  }

  async applyAdjustments(imageData: ImageData, adjustments: AdjustmentConfig): Promise<ImageData> {
    // Implémentation WebGL avec shaders
  }

  // ... autres méthodes
}
```

### 2. Mettre à jour la Factory

```typescript
createBestProcessor(): ImageProcessor {
  // Priorité : WebGL > CPU
  if (this.isWebGlAvailable()) {
    return this.createWebGlProcessor()!
  }
  return this.createCpuProcessor()
}
```

### 3. Logging WebGL

```typescript
import { webglLogger } from '@/utils/logger'

webglLogger.info('🎮 [WEBGL] Initializing WebGL context...')
webglLogger.timeSync('🎮 [WEBGL] Shader Compilation', () => { ... })
```

## Performance Comparaison

Basé sur les logs actuels :

| Opération | CPU Adaptateur | Direct Legacy | Amélioration |
|-----------|----------------|---------------|--------------|
| Image Adjustments | ~30-43ms | N/A | Baseline |
| Quantizer Creation | N/A | ~50ms | Prêt pour optim |
| Palette Quantization | N/A | ~400-640ms | Prêt pour optim |

## Avantages de l'architecture

1. **🔄 Flexibilité** : Bascule CPU/WebGL transparente
2. **📊 Observabilité** : Logs détaillés pour debugging
3. **⚡ Performance** : Cache des instances + optimisations futures
4. **🧪 Testabilité** : Interface claire pour mocking
5. **🔧 Maintenabilité** : Séparation des responsabilités
6. **🚀 Extensibilité** : Ajout facile de nouveaux processeurs

## Migration Progressive

L'architecture permet une migration en douceur :

- ✅ **Image adjustments** : Déjà migré vers adaptateur
- 🔄 **Quantization** : Système dual (direct + adaptateur prêt)
- 🚀 **Futures features** : Directement sur adaptateur

Cette approche garantit la stabilité tout en préparant les optimisations futures.