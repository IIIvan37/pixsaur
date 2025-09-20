# Plan d'Implémentation ReGL Quantizer

## 🎯 Vue d'ensemble

Migration du quantizer CPU vers ReGL en réutilisant **tous les types existants** de `pixsaur-color` pour maintenir la cohérence architecturale et éviter la duplication de code.

## 📋 Types Existants Réutilisés

### De `pixsaur-color/src/type.ts`
```typescript
// ✅ Types de base - RÉUTILISER
import type { 
  ColorSpace,      // 'RGB' | 'Lab' | 'XYZ'
  Vector,          // ColorVectorMap[CS]
} from '@/libs/pixsaur-color/src/type'
```

### De `pixsaur-color/src/metric/distance.ts`  
```typescript
// ✅ Métriques de distance - RÉUTILISER
import type {
  DistanceMetric,  // 'euclidean' | 'cie76' | 'deltaE2000'
  DistanceFn,      // (a: Vector, b: Vector) => number
} from '@/libs/pixsaur-color/src/metric/distance'
```

### De `pixsaur-color/src/quant/quantize.ts`
```typescript
// ✅ Configuration quantization - RÉUTILISER
import type {
  QuantizeConfig,    // { colorSpace, distanceMetric }
  DitheringConfig,   // { mode, intensity }
  DitheringMode,     // 'floydSteinberg' | 'bayer2x2' | etc.
} from '@/libs/pixsaur-color/src/quant/quantize'
```

## 🔧 Architecture ReGL avec Types Existants

### Nouvelle Interface Unifiée

```typescript
// src/libs/pixsaur-adapter/adapters/regl-quantizer.ts
import type { 
  ColorSpace, 
  Vector, 
  DistanceMetric,
  QuantizeConfig 
} from '@/libs/pixsaur-color/src'

/**
 * Configuration ReGL qui étend QuantizeConfig existant
 * ✅ Réutilise les types pixsaur-color au lieu de redéfinir
 */
export interface ReGLQuantizeConfig extends QuantizeConfig {
  /** Nombre de couleurs cibles */
  readonly targetColors: number
  
  /** Couleurs pré-sélectionnées (verrouillées) en indices CPC */
  readonly preselectedIndices?: readonly number[]
  
  /** Seuil pour le filtrage adaptatif (défaut: 10) */
  readonly threshold?: number
  
  /** Options performance GPU */
  readonly gpuOptions?: {
    readonly batchSize?: number
    readonly useAsyncReadback?: boolean
  }
}

/**
 * Résultats GPU étendus mais compatibles
 */
export interface ReGLQuantizeResult {
  /** Palette quantifiée (compatible avec retour CPU) */
  readonly selectedColors: readonly Vector[]
  
  /** Indices des couleurs sélectionnées dans la palette CPC */
  readonly selectedIndices: readonly number[]
  
  /** Histogramme utilisé pour la sélection */
  readonly histogram: readonly number[]
  
  /** Métriques de performance */
  readonly performance: {
    readonly computeTime: number
    readonly histogramTime: number
    readonly selectionTime: number
    readonly transferTime: number
  }
}
```

### Implémentation ReGL Unifiée

```typescript
export class ReGLQuantizer {
  private readonly regl: REGL.Regl
  private distanceShader?: REGL.DrawCommand
  private histogramFBO?: REGL.Framebuffer
  
  constructor(regl: REGL.Regl) {
    this.regl = regl
    this.initializeShaders()
  }
  
  /**
   * Interface principale compatible avec createQuantizer()
   * ✅ Même signature que CPU, types identiques
   */
  async quantizePalette(
    buffer: Uint8ClampedArray,
    basePalette: readonly Vector[],
    preselected: readonly Vector[],
    config: ReGLQuantizeConfig
  ): Promise<readonly Vector[]> {
    
    try {
      // Phase 1: GPU - Distance calculation & histogram
      const histogramData = await this.buildHistogramGPU(
        buffer, 
        basePalette, 
        config
      )
      
      // Phase 2: CPU - Selection algorithms (utilise code existant)
      const selectedIndices = selectTopIndices(
        histogramData.histogram, 
        this.convertVectorsToIndices(preselected, basePalette),
        config.targetColors
      )
      
      const workingPalette = selectedIndices.map(i => basePalette[i])
      
      // Phase 3: CPU - Contrast subset (code existant inchangé)
      const finalPalette = selectContrastedSubset(
        workingPalette,
        preselected,
        config.targetColors,
        getDistanceFn(config.colorSpace, config.distanceMetric),
        getColorSpaceToRgbFn(config.colorSpace)
      )
      
      return finalPalette
      
    } catch (error) {
      // Fallback CPU automatique avec les mêmes types
      adapterLogger.warn('🔄 ReGL quantization failed, falling back to CPU', error)
      return this.fallbackCPU(buffer, basePalette, preselected, config)
    }
  }
}
```

## 🎮 Shaders ReGL avec Types Cohérents

### Shader Configuration

```typescript
interface ShaderUniforms {
  // Mapping direct des types ColorSpace
  readonly u_colorSpace: 0 | 1 | 2  // RGB=0, Lab=1, XYZ=2
  
  // Mapping direct des types DistanceMetric 
  readonly u_distanceMetric: 0 | 1 | 2  // euclidean=0, cie76=1, deltaE2000=2
  
  // Palette CPC - utilise Vector[] existant
  readonly u_cpcPalette: readonly [number, number, number][]
  
  // Configuration image
  readonly u_imageSize: readonly [number, number]
}

// Mapping automatique des types vers uniforms
const createShaderConfig = (config: ReGLQuantizeConfig): ShaderUniforms => ({
  u_colorSpace: COLOR_SPACE_MAP[config.colorSpace],
  u_distanceMetric: DISTANCE_METRIC_MAP[config.distanceMetric],
  u_cpcPalette: basePalette.map(v => [v[0], v[1], v[2]] as const),
  u_imageSize: [width, height] as const
})

// ✅ Mappings statiques pour type safety
const COLOR_SPACE_MAP = {
  RGB: 0,
  Lab: 1, 
  XYZ: 2
} as const satisfies Record<ColorSpace, number>

const DISTANCE_METRIC_MAP = {
  euclidean: 0,
  cie76: 1,
  deltaE2000: 2
} as const satisfies Record<DistanceMetric, number>
```

## 🏗️ Intégration dans l'Architecture Adapter

### Factory Pattern avec Types Unifiés

```typescript
// src/libs/pixsaur-adapter/factory.ts
export class ProcessorFactory {
  
  createBestProcessor(): ImageProcessor {
    const capabilities = this.detectCapabilities()
    
    if (capabilities.canUseReGL && capabilities.gpuOptimal) {
      // ✅ ReGL avec même interface que CPU
      return new ReGLProcessor(this.regl)
    }
    
    // ✅ Fallback CPU avec interface identique
    return new CpuImageProcessor()
  }
  
  // ✅ Interface unifiée pour quantization
  async quantizePalette(
    buffer: Uint8ClampedArray,
    imageData: ImageData,
    targetColors: number,
    basePalette: readonly Vector[] = generateAmstradCPCPalette(),
    lockedVecs: readonly Vector[] = [],
    colorSpace: ColorSpace = 'RGB'
  ): Promise<readonly Vector[]> {
    
    const processor = this.createBestProcessor()
    
    // ✅ Même interface pour CPU et ReGL
    return processor.quantizePalette(
      buffer,
      imageData,
      targetColors,
      basePalette,
      lockedVecs,
      colorSpace
    )
  }
}
```

### Processor ReGL avec Fallback

```typescript
// src/libs/pixsaur-adapter/adapters/regl-processor.ts
export class ReGLProcessor implements ImageProcessor {
  private quantizer?: ReGLQuantizer
  
  constructor(private regl: REGL.Regl) {
    try {
      this.quantizer = new ReGLQuantizer(regl)
    } catch (error) {
      adapterLogger.warn('ReGL quantizer initialization failed, will use CPU fallback')
    }
  }
  
  async quantizePalette(
    buf: Uint8ClampedArray,
    imageData: ImageData, 
    targetColors: number,
    basePalette: readonly Vector[],
    lockedVecs: readonly Vector[],
    colorSpace: ColorSpace
  ): Promise<readonly Vector[]> {
    
    // ✅ Configuration avec types existants
    const config: ReGLQuantizeConfig = {
      colorSpace,
      distanceMetric: ColorSpaceDistanceMetric[colorSpace][0],
      targetColors,
      preselectedIndices: this.convertToIndices(lockedVecs, basePalette)
    }
    
    if (this.quantizer) {
      return this.quantizer.quantizePalette(buf, basePalette, lockedVecs, config)
    }
    
    // ✅ Fallback CPU utilise exactement les mêmes types
    return this.fallbackCPU(buf, basePalette, lockedVecs, config)
  }
  
  private async fallbackCPU(
    buf: Uint8ClampedArray,
    basePalette: readonly Vector[],
    lockedVecs: readonly Vector[],
    config: ReGLQuantizeConfig
  ): Promise<readonly Vector[]> {
    
    // ✅ Réutilise createQuantizer existant avec types identiques
    const quantizer = createQuantizer({
      buf,
      basePalette: [...basePalette],
      preselected: [...lockedVecs],
      quantConfig: {
        colorSpace: config.colorSpace,
        distanceMetric: config.distanceMetric
      }
    })
    
    return quantizer.quantize(config.targetColors)
  }
}
```

## 📊 Plan de Migration par Étapes

### Étape 1: Types et Interface (DONE ✅)
- [x] Analyse des types existants dans `pixsaur-color`
- [x] Création de `ReGLQuantizeConfig` qui étend `QuantizeConfig`
- [x] Interface `ReGLQuantizer` compatible avec `createQuantizer()`
- [x] Mappings statiques pour type safety

### Étape 2: Infrastructure ReGL (1-2 jours)
- [ ] Implémentation classe `ReGLQuantizer` 
- [ ] Shaders de base (distance euclidienne RGB)
- [ ] Système de fallback CPU automatique
- [ ] Tests unitaires avec types cohérents

### Étape 3: GPU Pipeline (2-3 jours)
- [ ] Fragment shader pour histogramme
- [ ] Readback optimisé vers CPU
- [ ] Support Lab/XYZ color spaces
- [ ] Métriques de distance avancées

### Étape 4: Optimisations (2-3 jours)
- [ ] Batch processing pour grandes images
- [ ] Readback asynchrone
- [ ] Memory management et cleanup
- [ ] Tests de performance vs CPU

### Étape 5: Production (1-2 jours)
- [ ] Intégration dans Factory pattern
- [ ] Configuration adaptative
- [ ] Documentation complète
- [ ] Tests d'intégration

## 🔍 Avantages de la Réutilisation de Types

### ✅ Cohérence Architecturale
- Même types pour CPU et GPU → pas de conversion
- Interface unifiée → swap transparent 
- Fallback automatique → zéro breaking change

### ✅ Maintenance Simplifiée
- Un seul endroit pour les types → DRY principle
- Évolution centralisée des types
- Tests partagés entre implémentations

### ✅ Type Safety Renforcée
- Compilation vérifie compatibilité CPU/GPU
- Pas de risque de dérive entre interfaces
- Refactoring sûr avec TypeScript

### ✅ Performance
- Pas de mapping/conversion de types
- Structures mémoire identiques
- Optimisations partagées

## 🎯 Validation du Plan

### Tests de Conformité
```typescript
// Test que ReGL produit exactement les mêmes résultats que CPU
test('ReGL quantizer produces identical results to CPU', async () => {
  const buffer = generateTestImageData()
  const config: ReGLQuantizeConfig = {
    colorSpace: 'RGB',
    distanceMetric: 'euclidean',
    targetColors: 16
  }
  
  const cpuResult = await quantizeCPU(buffer, config)
  const reglResult = await quantizeReGL(buffer, config)
  
  // ✅ Même types → comparaison directe possible
  expect(reglResult).toEqual(cpuResult)
})
```

### Métriques de Performance
- **Fidélité**: Résultats identiques CPU vs ReGL
- **Performance**: Gain >5x sur images moyennes/grandes
- **Stabilité**: Zéro régression, fallback gracieux
- **Memory**: Pas de fuite, cleanup automatique

---

Ce plan garantit une migration ReGL qui préserve parfaitement l'architecture existante tout en apportant les gains de performance GPU souhaités.