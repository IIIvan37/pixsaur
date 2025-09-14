# Guide d'Extension : Ajouter WebGL

## Vue d'ensemble

Ce guide explique comment étendre l'architecture adaptateur pour ajouter le support WebGL, en s'appuyant sur l'infrastructure existante.

## Prérequis

- ✅ Architecture adaptateur fonctionnelle (CPU)
- ✅ Factory pattern avec cache
- ✅ Système de logging intégré
- ✅ Interface `ImageProcessor` définie

## Étapes d'implémentation

### 1. Créer WebGLImageProcessor

```typescript
// src/libs/pixsaur-adapter/adapters/webgl-processor.ts
import { webglLogger } from '@/utils/logger'
import type { ImageProcessor, AdjustmentConfig } from '../interfaces'

export class WebGLImageProcessor implements ImageProcessor {
  readonly type = 'webgl' as const
  readonly isAvailable: boolean
  
  private gl: WebGL2RenderingContext | null = null
  private programs: Map<string, WebGLProgram> = new Map()

  constructor() {
    webglLogger.info('🏗️ [WEBGL] WebGL Processor instance created')
    this.isAvailable = this.initializeWebGL()
  }

  private initializeWebGL(): boolean {
    try {
      const canvas = document.createElement('canvas')
      this.gl = canvas.getContext('webgl2')
      
      if (!this.gl) {
        webglLogger.warn('⚠️ [WEBGL] WebGL2 not available')
        return false
      }
      
      webglLogger.info('✅ [WEBGL] WebGL2 context initialized')
      return true
      
    } catch (error) {
      webglLogger.error('❌ [WEBGL] Failed to initialize WebGL:', error)
      return false
    }
  }

  async applyAdjustments(
    imageData: ImageData, 
    adjustments: AdjustmentConfig
  ): Promise<ImageData> {
    if (!this.isAvailable) {
      throw new Error('WebGL not available')
    }

    return webglLogger.timeAsync('🎮 [WEBGL] GPU Image Adjustments', async () => {
      webglLogger.info(`🎨 [WEBGL] Applying adjustments via GPU: brightness=${adjustments.brightness}, contrast=${adjustments.contrast}`)
      
      // 1. Créer texture depuis ImageData
      const texture = this.createTextureFromImageData(imageData)
      
      // 2. Appliquer shaders d'ajustement
      const result = this.applyAdjustmentShaders(texture, adjustments)
      
      // 3. Lire résultat vers ImageData
      const resultImageData = this.readPixelsToImageData(result, imageData.width, imageData.height)
      
      webglLogger.debug(`✅ [WEBGL] GPU adjustments completed: ${imageData.width}x${imageData.height}`)
      return resultImageData
    })
  }

  applyAdjustmentsSync(imageData: ImageData, adjustments: AdjustmentConfig): ImageData {
    // WebGL est naturellement async, mais on peut simuler le sync pour compatibilité
    webglLogger.warn('⚠️ [WEBGL] Sync method called on async WebGL processor')
    throw new Error('WebGL processor is inherently async - use applyAdjustments()')
  }

  async quantizePalette(
    buffer: Uint8ClampedArray,
    imageData: ImageData,
    targetColors: number,
    basePalette?: Vector[],
    preselected?: Vector[],
    colorSpace: string = 'RGB'
  ): Promise<Vector[]> {
    // Option 1: Fallback vers CPU pour quantization
    webglLogger.info('🔄 [WEBGL] Falling back to CPU for quantization')
    const cpuProcessor = new CpuImageProcessor()
    return cpuProcessor.quantizePalette(buffer, imageData, targetColors, basePalette, preselected, colorSpace)
    
    // Option 2: Implémentation GPU (plus complexe)
    // return this.gpuQuantizePalette(buffer, imageData, targetColors, ...)
  }

  dispose(): void {
    webglLogger.info('🗑️ [WEBGL] WebGL Processor disposed')
    
    // Nettoyer les ressources WebGL
    if (this.gl) {
      for (const program of this.programs.values()) {
        this.gl.deleteProgram(program)
      }
      this.programs.clear()
    }
    
    this.gl = null
  }

  // Méthodes privées WebGL
  private createTextureFromImageData(imageData: ImageData): WebGLTexture {
    // Implémentation création texture
  }

  private applyAdjustmentShaders(texture: WebGLTexture, adjustments: AdjustmentConfig): WebGLTexture {
    // Implémentation shaders d'ajustement
  }

  private readPixelsToImageData(texture: WebGLTexture, width: number, height: number): ImageData {
    // Implémentation lecture pixels
  }
}
```

### 2. Shaders d'ajustement

```typescript
// src/libs/pixsaur-adapter/shaders/image-adjustments.ts
export const vertexShaderSource = `#version 300 es
  in vec2 a_position;
  in vec2 a_texCoord;
  out vec2 v_texCoord;
  
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`

export const fragmentShaderSource = `#version 300 es
  precision mediump float;
  
  uniform sampler2D u_image;
  uniform float u_brightness;
  uniform float u_contrast;
  uniform float u_saturation;
  uniform vec3 u_rgb;
  
  in vec2 v_texCoord;
  out vec4 fragColor;
  
  void main() {
    vec4 color = texture(u_image, v_texCoord);
    
    // RGB adjustments
    color.rgb *= u_rgb;
    
    // Brightness
    color.rgb += u_brightness - 1.0;
    
    // Contrast
    color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;
    
    // Saturation
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, u_saturation);
    
    fragColor = color;
  }
`
```

### 3. Détection WebGL

```typescript
// src/libs/pixsaur-adapter/utils/webgl-detection.ts
import { webglLogger } from '@/utils/logger'

export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    
    if (!gl) {
      webglLogger.info('ℹ️ [WEBGL] WebGL not supported')
      return false
    }
    
    webglLogger.info('✅ [WEBGL] WebGL is available')
    return true
    
  } catch (e) {
    webglLogger.warn('⚠️ [WEBGL] WebGL detection failed:', e)
    return false
  }
}

export function getWebGLInfo(): object {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
  
  if (!gl) return { supported: false }
  
  return {
    supported: true,
    version: gl.getParameter(gl.VERSION),
    vendor: gl.getParameter(gl.VENDOR),
    renderer: gl.getParameter(gl.RENDERER),
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxVertexTextures: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)
  }
}
```

### 4. Mettre à jour la Factory

```typescript
// src/libs/pixsaur-adapter/factory.ts
import { WebGLImageProcessor } from './adapters/webgl-processor'
import { isWebGLAvailable } from './utils/webgl-detection'

export class ImageProcessorFactory implements ProcessorFactory {
  // ... propriétés existantes
  private webglProcessor: WebGLImageProcessor | null = null

  createBestProcessor(): ImageProcessor {
    // Stratégie : WebGL > CPU
    if (this.isWebGlAvailable()) {
      adapterLogger.info('🎮 [FACTORY] Creating WebGL processor (best performance)')
      return this.createWebGlProcessor()!
    }
    
    adapterLogger.info('🖥️ [FACTORY] Falling back to CPU processor')
    return this.createCpuProcessor()
  }

  createWebGlProcessor(): ImageProcessor | null {
    if (this.webglProcessor) {
      adapterLogger.info('♻️ [FACTORY] Reusing cached WebGL processor instance')
      return this.webglProcessor
    }
    
    if (!this.isWebGlAvailable()) {
      adapterLogger.warn('⚠️ [FACTORY] WebGL not available - cannot create WebGL processor')
      return null
    }
    
    return adapterLogger.timeSync('🎮 [FACTORY] WebGL Processor Creation', () => {
      adapterLogger.info('🎮 [FACTORY] Creating new WebGL processor instance')
      try {
        this.webglProcessor = new WebGLImageProcessor()
        
        if (!this.webglProcessor.isAvailable) {
          this.webglProcessor.dispose()
          this.webglProcessor = null
          adapterLogger.error('❌ [FACTORY] WebGL processor creation failed')
          return null
        }
        
        adapterLogger.info('✅ [FACTORY] WebGL processor instance created and cached')
        return this.webglProcessor
        
      } catch (error) {
        adapterLogger.error('❌ [FACTORY] WebGL processor creation error:', error)
        return null
      }
    })
  }

  isWebGlAvailable(): boolean {
    return isWebGLAvailable()
  }

  clearCache(): void {
    adapterLogger.info('🧹 [FACTORY] Clearing processor cache...')
    
    if (this.webglProcessor) {
      this.webglProcessor.dispose()
      this.webglProcessor = null
      adapterLogger.info('🗑️ [FACTORY] WebGL processor cache cleared')
    }
    
    if (this.cpuProcessor) {
      this.cpuProcessor.dispose()
      this.cpuProcessor = null
      adapterLogger.info('🗑️ [FACTORY] CPU processor cache cleared')
    }
  }
}
```

### 5. Tests WebGL

```typescript
// src/libs/pixsaur-adapter/adapters/webgl-processor.test.ts
describe('WebGLImageProcessor', () => {
  let processor: WebGLImageProcessor

  beforeEach(() => {
    // Setup WebGL mock si nécessaire
    processor = new WebGLImageProcessor()
  })

  afterEach(() => {
    processor.dispose()
  })

  test('should initialize WebGL context', () => {
    expect(processor.isAvailable).toBeDefined()
  })

  test('should apply adjustments via GPU', async () => {
    if (!processor.isAvailable) {
      console.log('Skipping WebGL test - not available')
      return
    }

    const imageData = new ImageData(100, 100)
    const adjustments = { brightness: 1.2, contrast: 1.1, saturation: 1.0, rgb: { r: 1, g: 1, b: 1 }, posterization: 256 }
    
    const result = await processor.applyAdjustments(imageData, adjustments)
    
    expect(result).toBeInstanceOf(ImageData)
    expect(result.width).toBe(100)
    expect(result.height).toBe(100)
  })

  test('should fallback to CPU for quantization', async () => {
    if (!processor.isAvailable) return

    const buffer = new Uint8ClampedArray(400) // 100x100 RGBA
    const imageData = new ImageData(100, 100)
    
    const palette = await processor.quantizePalette(buffer, imageData, 16)
    
    expect(palette).toHaveLength(16)
  })
})
```

## Stratégie de déploiement

### Phase 1 : Infrastructure de base ✅
- Interface `ImageProcessor` définie
- Factory pattern avec cache
- Système de logging WebGL

### Phase 2 : Implémentation WebGL 🔄
- `WebGLImageProcessor` avec adjustments GPU
- Shaders d'ajustement d'image
- Détection et fallback automatiques

### Phase 3 : Optimisations avancées 🚀
- Quantization GPU (optionnel)
- Batch processing
- Pipeline optimisé

## Logging attendu

Avec WebGL implémenté, vous verrez :

```
🏭 [FACTORY] Creating best processor
🔍 [WEBGL] WebGL availability check
✅ [WEBGL] WebGL is available
🎮 [FACTORY] Creating WebGL processor (best performance)
🎮 [FACTORY] Creating new WebGL processor instance
🏗️ [WEBGL] WebGL Processor instance created
✅ [WEBGL] WebGL2 context initialized
✅ [FACTORY] WebGL processor instance created and cached
🎨 [WEBGL] Applying adjustments via GPU: brightness=1.2, contrast=1.1
🎮 [WEBGL] GPU Image Adjustments: 8.50ms  ⚡ (vs 30ms CPU)
```

## Avantages attendus

| Métrique | CPU | WebGL | Gain |
|----------|-----|-------|------|
| Image Adjustments | ~30-40ms | ~8-15ms | 2-3x |
| Batch Processing | Linéaire | Parallèle | 5-10x |
| Memory Usage | CPU RAM | GPU VRAM | Libère CPU |

## Considérations

### ✅ Avantages WebGL
- **Performance** : Parallélisation GPU
- **Offloading** : Libère le CPU
- **Scalabilité** : Mieux pour gros volumes

### ⚠️ Limitations WebGL
- **Complexité** : Plus difficile à déboguer
- **Compatibilité** : Tous les devices ne supportent pas
- **Precision** : Limitations float32 vs CPU double
- **Quantization** : Mieux sur CPU (algorithmes complexes)

### 🔧 Stratégie hybride recommandée
- **Image adjustments** : WebGL (simple, parallélisable)
- **Quantization** : CPU (algorithmes complexes)
- **Fallback automatique** : Transparence pour l'utilisateur

Cette approche offre le meilleur des deux mondes avec une migration transparente.