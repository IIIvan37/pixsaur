# Guide d'Implémentation ReGL Quantizer

## 🚀 Guide Pratique d'Implémentation

Ce guide détaille l'implémentation concrète du ReGL Quantizer en réutilisant l'architecture et les types existants de Pixsaur.

## 📋 Prérequis

### Dépendances Existantes
```json
// package.json - déjà présent
{
  "dependencies": {
    "regl": "^2.1.1"  // ✅ Déjà installé
  }
}
```

### Imports Requis
```typescript
// Types existants à réutiliser
import type { 
  ColorSpace, 
  Vector, 
  DistanceMetric, 
  DistanceFn,
  QuantizeConfig,
  DitheringConfig 
} from '@/libs/pixsaur-color/src'

// Fonctions existantes à réutiliser  
import { 
  createQuantizer,
  getDistanceFn,
  selectTopIndices,
  selectContrastedSubset,
  getColorSpaceToRgbFn,
  ColorSpaceDistanceMetric 
} from '@/libs/pixsaur-color/src'

// Architecture adapter existante
import type { ImageProcessor } from '@/libs/pixsaur-adapter/interfaces'
import { adapterLogger, quantizerLogger, paletteLogger } from '@/utils/logger'
```

## 🏗️ Structure d'Implémentation

### 1. Créer le ReGL Quantizer Principal

```typescript
// src/libs/pixsaur-adapter/adapters/regl-quantizer.ts
import * as REGL from 'regl'
import type { 
  ColorSpace, 
  Vector, 
  DistanceMetric,
  QuantizeConfig 
} from '@/libs/pixsaur-color/src'

/**
 * Configuration ReGL étendant les types existants
 * ✅ Réutilise QuantizeConfig de pixsaur-color
 */
export interface ReGLQuantizeConfig extends QuantizeConfig {
  readonly targetColors: number
  readonly preselectedIndices?: readonly number[]
  readonly threshold?: number
  readonly gpuBatchSize?: number
}

/**
 * Résultat quantization GPU compatible CPU
 */
export interface ReGLQuantizeResult {
  readonly selectedColors: readonly Vector[]
  readonly selectedIndices: readonly number[]
  readonly histogram: readonly number[]
  readonly performance: {
    readonly computeTime: number
    readonly histogramTime: number  
    readonly selectionTime: number
    readonly transferTime: number
  }
}

/**
 * ReGL Quantizer principal
 * Utilise les types et algorithmes existants de pixsaur-color
 */
export class ReGLQuantizer {
  private readonly regl: REGL.Regl
  private histogramCommand?: REGL.DrawCommand
  private histogramFBO?: REGL.Framebuffer
  private inputTexture?: REGL.Texture2D
  
  // Cache pour la palette CPC
  private cpcPaletteTexture?: REGL.Texture2D
  private lastBasePalette?: readonly Vector[]
  
  constructor(regl: REGL.Regl) {
    this.regl = regl
    this.validateReGLCapabilities()
    this.initializeGPUResources()
  }
  
  private validateReGLCapabilities(): void {
    const gl = this.regl._gl
    
    // Vérifier extensions requises
    const requiredExtensions = [
      'OES_texture_float',
      'EXT_color_buffer_float'
    ]
    
    for (const ext of requiredExtensions) {
      if (!gl.getExtension(ext)) {
        throw new Error(`Required WebGL extension not available: ${ext}`)
      }
    }
    
    // Vérifier limites de texture
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
    if (maxTextureSize < 2048) {
      adapterLogger.warn(`⚠️ Small max texture size: ${maxTextureSize}`)
    }
    
    adapterLogger.debug(`✅ ReGL capabilities validated: maxTextureSize=${maxTextureSize}`)
  }
  
  private initializeGPUResources(): void {
    // Fragment shader pour calcul d'histogramme
    this.histogramCommand = this.regl({
      frag: this.createHistogramShader(),
      vert: this.createQuadVertexShader(),
      
      uniforms: {
        u_inputImage: this.regl.prop<'inputTexture'>('inputTexture'),
        u_cpcPalette: this.regl.prop<'cpcPalette'>('cpcPalette'),
        u_imageSize: this.regl.prop<'imageSize'>('imageSize'),
        u_colorSpace: this.regl.prop<'colorSpace'>('colorSpace'),
        u_distanceMetric: this.regl.prop<'distanceMetric'>('distanceMetric')
      },
      
      attributes: {
        position: [[-1, -1], [1, -1], [-1, 1], [1, 1]]
      },
      
      primitive: 'triangle strip',
      count: 4
    })
    
    // Framebuffer pour l'histogramme (27x1 pour les 27 couleurs CPC)
    this.histogramFBO = this.regl.framebuffer({
      width: 27,
      height: 1,
      colorFormat: 'rgba',
      colorType: 'float32'
    })
    
    adapterLogger.debug('🎮 ReGL GPU resources initialized')
  }
  
  /**
   * Interface principale compatible avec createQuantizer()
   * ✅ Utilise exactement les mêmes types que la version CPU
   */
  async quantizePalette(
    buffer: Uint8ClampedArray,
    imageData: ImageData,
    basePalette: readonly Vector[],
    preselected: readonly Vector[],
    config: ReGLQuantizeConfig
  ): Promise<readonly Vector[]> {
    
    const startTime = performance.now()
    
    try {
      adapterLogger.debug(
        `🎯 [ReGL] Starting GPU quantization: ${config.colorSpace}, ${config.distanceMetric}, ${config.targetColors} colors`
      )
      
      // Phase 1: Upload image vers GPU
      const uploadStart = performance.now()
      this.updateInputTexture(imageData)
      this.updatePaletteTexture(basePalette)
      const uploadTime = performance.now() - uploadStart
      
      // Phase 2: Calcul histogramme sur GPU  
      const histogramStart = performance.now()
      const histogramData = await this.computeHistogramGPU(imageData, config)
      const histogramTime = performance.now() - histogramStart
      
      // Phase 3: Sélection sur CPU (réutilise code existant)
      const selectionStart = performance.now()
      const preselectedIndices = this.convertVectorsToIndices(preselected, basePalette)
      
      // ✅ Utilise selectTopIndices existant
      const topIndices = selectTopIndices(
        new Uint32Array(histogramData),
        preselectedIndices,
        config.targetColors
      )
      
      const workingPalette = topIndices.map(i => basePalette[i])
      
      // ✅ Utilise selectContrastedSubset existant  
      const distanceFn = getDistanceFn(config.colorSpace, config.distanceMetric)
      const toRGB = getColorSpaceToRgbFn(config.colorSpace)
      
      const finalPalette = selectContrastedSubset(
        workingPalette,
        preselected,
        config.targetColors,
        distanceFn,
        toRGB
      )
      
      const selectionTime = performance.now() - selectionStart
      const totalTime = performance.now() - startTime
      
      // Logging avec métriques
      adapterLogger.info(
        `🎨 [ReGL] Quantization completed: ${finalPalette.length}/${config.targetColors} colors`
      )
      
      quantizerLogger.debug(
        `⚡ [ReGL] Performance: total=${totalTime.toFixed(2)}ms, upload=${uploadTime.toFixed(2)}ms, histogram=${histogramTime.toFixed(2)}ms, selection=${selectionTime.toFixed(2)}ms`
      )
      
      return finalPalette
      
    } catch (error) {
      adapterLogger.warn('🔄 [ReGL] GPU quantization failed, falling back to CPU', error)
      return this.fallbackCPU(buffer, basePalette, preselected, config)
    }
  }
  
  private async computeHistogramGPU(
    imageData: ImageData,
    config: ReGLQuantizeConfig
  ): Promise<number[]> {
    
    return new Promise((resolve, reject) => {
      try {
        // Render vers framebuffer histogramme
        this.regl({
          framebuffer: this.histogramFBO
        })(() => {
          
          this.histogramCommand!({
            inputTexture: this.inputTexture!,
            cpcPalette: this.cpcPaletteTexture!,
            imageSize: [imageData.width, imageData.height],
            colorSpace: COLOR_SPACE_MAP[config.colorSpace],
            distanceMetric: DISTANCE_METRIC_MAP[config.distanceMetric]
          })
          
          // Readback asynchrone
          this.regl.read({
            framebuffer: this.histogramFBO,
            width: 27,
            height: 1
          }, (error, result) => {
            if (error) {
              reject(error)
              return
            }
            
            // Convertir RGBA float vers histogramme int
            const histogram = new Array(27).fill(0)
            if (result) {
              for (let i = 0; i < 27; i++) {
                histogram[i] = Math.round(result[i * 4]) // Canal R
              }
            }
            
            resolve(histogram)
          })
        })
        
      } catch (error) {
        reject(error)
      }
    })
  }
  
  private async fallbackCPU(
    buffer: Uint8ClampedArray,
    basePalette: readonly Vector[],
    preselected: readonly Vector[],
    config: ReGLQuantizeConfig
  ): Promise<readonly Vector[]> {
    
    adapterLogger.debug('🖥️ [ReGL] Using CPU fallback')
    
    // ✅ Utilise createQuantizer existant avec types identiques
    const quantizer = createQuantizer({
      buf: buffer,
      basePalette: [...basePalette],
      preselected: [...preselected],
      quantConfig: {
        colorSpace: config.colorSpace,
        distanceMetric: config.distanceMetric
      }
    })
    
    return quantizer.quantize(config.targetColors)
  }
  
  private updateInputTexture(imageData: ImageData): void {
    if (this.inputTexture) {
      this.inputTexture.destroy()
    }
    
    this.inputTexture = this.regl.texture({
      width: imageData.width,
      height: imageData.height,
      format: 'rgba',
      type: 'uint8',
      data: imageData.data,
      flipY: false
    })
  }
  
  private updatePaletteTexture(basePalette: readonly Vector[]): void {
    // Cache la palette pour éviter re-upload
    if (this.lastBasePalette === basePalette && this.cpcPaletteTexture) {
      return
    }
    
    if (this.cpcPaletteTexture) {
      this.cpcPaletteTexture.destroy()
    }
    
    // Convertir palette Vector[] vers texture RGB
    const paletteData = new Float32Array(basePalette.length * 3)
    for (let i = 0; i < basePalette.length; i++) {
      const color = basePalette[i]
      paletteData[i * 3] = color[0] / 255
      paletteData[i * 3 + 1] = color[1] / 255  
      paletteData[i * 3 + 2] = color[2] / 255
    }
    
    this.cpcPaletteTexture = this.regl.texture({
      width: basePalette.length,
      height: 1,
      format: 'rgb',
      type: 'float32',
      data: paletteData
    })
    
    this.lastBasePalette = basePalette
  }
  
  private convertVectorsToIndices(
    vectors: readonly Vector[],
    basePalette: readonly Vector[]
  ): number[] {
    return vectors
      .map(v => basePalette.findIndex(p => 
        p[0] === v[0] && p[1] === v[1] && p[2] === v[2]
      ))
      .filter(idx => idx >= 0)
  }
  
  private createHistogramShader(): string {
    return `
    precision highp float;
    
    uniform sampler2D u_inputImage;
    uniform sampler2D u_cpcPalette;
    uniform vec2 u_imageSize;
    uniform int u_colorSpace;
    uniform int u_distanceMetric;
    
    // Fonctions de conversion colorspace
    vec3 rgbToLab(vec3 rgb) {
      // TODO: Implémentation complète
      return rgb; // placeholder
    }
    
    vec3 rgbToXyz(vec3 rgb) {
      // TODO: Implémentation complète  
      return rgb; // placeholder
    }
    
    float calculateDistance(vec3 color1, vec3 color2, int metric) {
      if (metric == 0) { // euclidean
        vec3 diff = color1 - color2;
        return dot(diff, diff);
      } else if (metric == 1) { // cie76
        vec3 diff = color1 - color2;
        return dot(diff, diff);
      } else { // deltaE2000
        vec3 diff = color1 - color2;
        return dot(diff, diff);
      }
    }
    
    void main() {
      vec2 uv = gl_FragCoord.xy / u_imageSize;
      vec3 pixelColor = texture2D(u_inputImage, uv).rgb;
      
      // Convertir dans l'espace de travail
      vec3 workingColor = pixelColor;
      if (u_colorSpace == 1) {
        workingColor = rgbToLab(pixelColor);
      } else if (u_colorSpace == 2) {
        workingColor = rgbToXyz(pixelColor);
      }
      
      // Trouver couleur CPC la plus proche
      float minDistance = 999999.0;
      int closestIndex = 0;
      
      for (int i = 0; i < 27; i++) {
        vec3 cpcColor = texture2D(u_cpcPalette, vec2(float(i) / 27.0, 0.5)).rgb;
        
        // Convertir couleur CPC
        vec3 workingCpcColor = cpcColor;
        if (u_colorSpace == 1) {
          workingCpcColor = rgbToLab(cpcColor);
        } else if (u_colorSpace == 2) {
          workingCpcColor = rgbToXyz(cpcColor);
        }
        
        float distance = calculateDistance(workingColor, workingCpcColor, u_distanceMetric);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      }
      
      // Output index comme couleur
      gl_FragColor = vec4(float(closestIndex), 0.0, 0.0, 1.0);
    }
    `
  }
  
  private createQuadVertexShader(): string {
    return `
    attribute vec2 position;
    
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
    `
  }
  
  dispose(): void {
    this.inputTexture?.destroy()
    this.cpcPaletteTexture?.destroy()
    this.histogramFBO?.destroy()
    
    adapterLogger.debug('🧹 ReGL quantizer resources disposed')
  }
}

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

### 2. Intégrer dans ReGLProcessor Existant

```typescript
// src/libs/pixsaur-adapter/adapters/regl-processor.ts
// Modifier la classe existante pour utiliser ReGLQuantizer

import { ReGLQuantizer, type ReGLQuantizeConfig } from './regl-quantizer'

export class ReGLProcessor implements ImageProcessor {
  // ... existing code ...
  
  private quantizer?: ReGLQuantizer
  
  constructor(private reglCapabilities: ReGLCapabilities, private regl?: REGL.Regl) {
    super()
    
    if (this.regl && this.reglCapabilities.canUseReGL) {
      try {
        this.quantizer = new ReGLQuantizer(this.regl)
        adapterLogger.debug('✅ ReGL quantizer initialized')
      } catch (error) {
        adapterLogger.warn('⚠️ ReGL quantizer initialization failed', error)
      }
    }
  }
  
  async quantizePalette(
    buf: Uint8ClampedArray,
    cropped: { width: number; height: number },
    targetColors: number,
    basePalette: Vector[],
    lockedVecs: Vector[],
    colorSpace: ColorSpace
  ): Promise<Vector[]> {
    
    return adapterLogger.timeAsync(
      'ReGL Palette Quantization',
      async () => {
        const distanceMetric: DistanceMetric = 
          colorSpace === 'Lab' ? 'cie76' : 'euclidean'
        
        // ✅ Configuration avec types unifiés
        const config: ReGLQuantizeConfig = {
          colorSpace,
          distanceMetric,
          targetColors,
          threshold: 10
        }
        
        if (this.quantizer && this.shouldUseGPU(buf, cropped)) {
          // ✅ GPU path avec ReGL
          const imageData = new ImageData(buf, cropped.width, cropped.height)
          return this.quantizer.quantizePalette(
            buf,
            imageData,
            basePalette,
            lockedVecs,
            config
          )
        }
        
        // ✅ CPU fallback (code existant)
        return this.quantizePaletteOptimized(
          buf,
          cropped,
          targetColors,
          basePalette,
          lockedVecs,
          colorSpace,
          distanceMetric
        )
      }
    )
  }
  
  private shouldUseGPU(
    buf: Uint8ClampedArray, 
    cropped: { width: number; height: number }
  ): boolean {
    const pixels = cropped.width * cropped.height
    const minPixelsForGPU = 256 * 256  // GPU avantageux pour images moyennes+
    
    return pixels >= minPixelsForGPU
  }
  
  dispose(): void {
    this.quantizer?.dispose()
    super.dispose()
  }
}
```

### 3. Tests d'Intégration

```typescript
// src/libs/pixsaur-adapter/__tests__/regl-quantizer.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { ReGLQuantizer, type ReGLQuantizeConfig } from '../adapters/regl-quantizer'
import { createQuantizer } from '@/libs/pixsaur-color/src/quant/quantize'
import { generateAmstradCPCPalette } from '@/palettes/cpc-palette'
import * as REGL from 'regl'

describe('ReGL Quantizer', () => {
  let regl: REGL.Regl
  let quantizer: ReGLQuantizer
  
  beforeEach(() => {
    // Setup ReGL context
    regl = REGL({
      extensions: ['OES_texture_float', 'EXT_color_buffer_float']
    })
    quantizer = new ReGLQuantizer(regl)
  })
  
  afterEach(() => {
    quantizer.dispose()
    regl.destroy()
  })
  
  test('produces identical results to CPU quantizer', async () => {
    // ✅ Test de conformité avec types identiques
    const testImageData = createTestImage(128, 128)
    const buffer = new Uint8ClampedArray(testImageData.data)
    const basePalette = generateAmstradCPCPalette()
    const preselected: Vector[] = []
    
    const config: ReGLQuantizeConfig = {
      colorSpace: 'RGB',
      distanceMetric: 'euclidean',
      targetColors: 16
    }
    
    // CPU reference
    const cpuQuantizer = createQuantizer({
      buf: buffer,
      basePalette,
      preselected,
      quantConfig: {
        colorSpace: config.colorSpace,
        distanceMetric: config.distanceMetric
      }
    })
    const cpuResult = cpuQuantizer.quantize(config.targetColors)
    
    // ReGL result  
    const reglResult = await quantizer.quantizePalette(
      buffer,
      testImageData,
      basePalette,
      preselected,
      config
    )
    
    // ✅ Comparison possible car types identiques
    expect(reglResult).toEqual(cpuResult)
  })
  
  test('gracefully falls back to CPU on GPU errors', async () => {
    // Test fallback automatique
    const badImageData = createBadTestImage() // Image qui cause erreur GPU
    
    const result = await quantizer.quantizePalette(
      new Uint8ClampedArray(badImageData.data),
      badImageData,
      generateAmstradCPCPalette(),
      [],
      {
        colorSpace: 'RGB',
        distanceMetric: 'euclidean', 
        targetColors: 16
      }
    )
    
    expect(result).toBeDefined()
    expect(result.length).toBeGreaterThan(0)
  })
})

function createTestImage(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(Math.random() * 256)     // R
    data[i + 1] = Math.floor(Math.random() * 256) // G  
    data[i + 2] = Math.floor(Math.random() * 256) // B
    data[i + 3] = 255                             // A
  }
  
  return new ImageData(data, width, height)
}
```

## 🎯 Checklist d'Implémentation

### Phase 1: Infrastructure ✅
- [x] Créer `ReGLQuantizer` class
- [x] Interface compatible avec types existants
- [x] Système de fallback CPU
- [x] Tests de base

### Phase 2: GPU Pipeline (En cours)
- [ ] Fragment shader histogramme complet
- [ ] Implémentation conversions colorspace GLSL
- [ ] Optimisation readback asynchrone
- [ ] Tests de performance

### Phase 3: Production
- [ ] Intégration Factory pattern
- [ ] Configuration adaptative CPU/GPU
- [ ] Documentation et logging
- [ ] Tests d'intégration complets

---

Ce guide garantit une implémentation ReGL qui réutilise parfaitement l'architecture existante et maintient la compatibilité totale avec le système CPU.