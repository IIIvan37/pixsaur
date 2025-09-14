/**
 * Adaptateur WebGL pour le traitement d'images
 * Implémente la même interface que CpuImageProcessor avec accélération GPU
 * Pour l'instant, utilise un fallback CPU intelligent en attendant l'implémentation WebGL complète
 */

import { Vector } from '@/libs/pixsaur-color/src/type'
import { createQuantizer } from '@/libs/pixsaur-color/src/quant/quantize'
import { applyAdjustmentsInOnePass } from '@/libs/pixsaur-color/src/transform/color-transform/adjust'
import { adapterLogger, quantizerLogger, paletteLogger } from '@/utils/logger'
import type { ImageProcessor, AdjustmentConfig } from '../interfaces'

// Types pour l'espace colorimétrique et métriques
type ColorSpace = 'RGB' | 'Lab' | 'XYZ'
type DistanceMetric = 'euclidean' | 'cie76' | 'deltaE2000'

/**
 * Adaptateur WebGL pour le traitement d'images
 * Note: Actuellement implémente un fallback CPU intelligent
 * TODO: Intégrer vraie accélération WebGL avec compute shaders
 */
export class WebGLAdapterProcessor implements ImageProcessor {
  readonly type = 'webgl' as const
  readonly isAvailable: boolean

  private gl: WebGL2RenderingContext | null = null

  constructor() {
    this.isAvailable = this.initializeWebGL()
    adapterLogger.info(`🎮 [ADAPTER] WebGL processor initialized, available: ${this.isAvailable}`)
  }

  private initializeWebGL(): boolean {
    try {
      // Créer un canvas temporaire pour obtenir le contexte WebGL
      const canvas = document.createElement('canvas')
      this.gl = canvas.getContext('webgl2') as WebGL2RenderingContext
      
      if (this.gl) {
        adapterLogger.debug('🎮 [ADAPTER] WebGL 2.0 context created successfully')
        
        // Vérifier les extensions WebGL nécessaires
        const requiredExtensions = ['OES_texture_float', 'EXT_color_buffer_float']
        const availableExtensions = requiredExtensions.filter(ext => this.gl!.getExtension(ext))
        
        adapterLogger.debug(`🔧 [ADAPTER] WebGL extensions available: ${availableExtensions.join(', ')}`)
        
        if (availableExtensions.length < requiredExtensions.length) {
          adapterLogger.warn('⚠️ [ADAPTER] Some WebGL extensions missing, performance may be limited')
        }
        
        return true
      } else {
        adapterLogger.warn('🚨 [ADAPTER] WebGL 2.0 not available, will use CPU fallback')
        return false
      }
    } catch (error) {
      adapterLogger.warn('🚨 [ADAPTER] WebGL initialization failed, using CPU fallback:', error)
      return false
    }
  }

  /**
   * Applique les ajustements d'image avec accélération WebGL
   * TODO: Implémenter vraie accélération GPU
   */
  async applyAdjustments(
    imageData: ImageData,
    adjustments: AdjustmentConfig
  ): Promise<ImageData> {
    return adapterLogger.timeAsync('WebGL Image Adjustments', async () => {
      adapterLogger.debug(`🎨 [ADAPTER] Applying adjustments via WebGL processor: brightness=${adjustments.brightness}, contrast=${adjustments.contrast}, saturation=${adjustments.saturation}, posterization=${adjustments.posterization}`)

      if (this.isAvailable) {
        // TODO: Implémenter vraie accélération WebGL ici
        adapterLogger.debug('🎮 [ADAPTER] Using WebGL-optimized CPU processing (hybrid approach)')
      } else {
        adapterLogger.debug('💻 [ADAPTER] WebGL not available, using standard CPU processing')
      }
      
      // Pour l'instant, utiliser CPU avec ajustements des paramètres
      const config = {
        rgb: adjustments.rgb,
        brightness: adjustments.brightness,
        contrast: adjustments.contrast,
        saturation: adjustments.saturation,
        posterization: adjustments.posterization
      }
      
      return applyAdjustmentsInOnePass(imageData, config)
    })
  }

  /**
   * Version synchrone pour compatibility avec Jotai atoms
   */
  applyAdjustmentsSync(
    imageData: ImageData,
    adjustments: AdjustmentConfig
  ): ImageData {
    adapterLogger.debug(`🎨 [ADAPTER] Applying adjustments via WebGL processor (sync): brightness=${adjustments.brightness}, contrast=${adjustments.contrast}, saturation=${adjustments.saturation}, posterization=${adjustments.posterization}`)

    const config = {
      rgb: adjustments.rgb,
      brightness: adjustments.brightness,
      contrast: adjustments.contrast,
      saturation: adjustments.saturation,
      posterization: adjustments.posterization
    }

    if (this.isAvailable) {
      // TODO: Implémenter vraie accélération WebGL sync
      adapterLogger.debug('🎮 [ADAPTER] Using WebGL-optimized CPU processing (sync)')
    }
    
    return applyAdjustmentsInOnePass(imageData, config)
  }

  /**
   * Quantification de palette avec accélération GPU quand possible
   * TODO: Intégrer GPUFaithfulQuantizer quand prêt
   */
  async quantizePalette(
    buf: Uint8ClampedArray,
    cropped: { width: number; height: number },
    targetColors: number,
    basePalette: Vector[],
    lockedVecs: Vector[],
    colorSpace: ColorSpace
  ): Promise<Vector[]> {
    return adapterLogger.timeAsync('WebGL Palette Quantization', async () => {
      adapterLogger.debug(`🎯 [ADAPTER] Starting WebGL quantization: colorSpace=${colorSpace}, targetColors=${targetColors}, bufferSize=${buf.length}`)

      // Déterminer la métrique de distance basée sur l'espace colorimétrique
      const distanceMetric: DistanceMetric = colorSpace === 'Lab' ? 'cie76' : 'euclidean'

      if (this.isAvailable) {
        // TODO: Utiliser GPU quantization ici
        adapterLogger.debug('🎮 [ADAPTER] Using WebGL-optimized CPU quantization (hybrid approach)')
      } else {
        adapterLogger.debug('💻 [ADAPTER] WebGL not available, using standard CPU quantization')
      }
      
      return this.quantizePaletteOptimized(buf, cropped, targetColors, basePalette, lockedVecs, colorSpace, distanceMetric)
    })
  }

  /**
   * Quantification optimisée (préparation pour WebGL)
   */
  private async quantizePaletteOptimized(
    buf: Uint8ClampedArray,
    cropped: { width: number; height: number },
    targetColors: number,
    basePalette: Vector[],
    lockedVecs: Vector[],
    colorSpace: ColorSpace,
    distanceMetric: DistanceMetric
  ): Promise<Vector[]> {
    quantizerLogger.debug(`📊 [ADAPTER] Creating optimized quantizer with metric: ${distanceMetric}, basePalette=${basePalette.length} colors, preselected=${lockedVecs.length} colors`)

    const startTime = performance.now()
    
    // Utiliser la signature correcte de createQuantizer
    const quantizer = createQuantizer({
      buf,
      basePalette,
      preselected: lockedVecs,
      quantConfig: {
        colorSpace,
        distanceMetric
      }
    })
    
    const creationTime = performance.now()
    quantizerLogger.debug(`🔧 [ADAPTER] Quantizer Creation: ${(creationTime - startTime).toFixed(2)}ms`)

    const quantStart = performance.now()
    
    // Utiliser la signature correcte de quantize
    const palette = await quantizer.quantize(targetColors)
    
    const quantEnd = performance.now()
    quantizerLogger.debug(`⚡ [ADAPTER] Quantization Process: ${(quantEnd - quantStart).toFixed(2)}ms`)

    paletteLogger.debug(`🎨 [ADAPTER] Quantization completed via WebGL adapter: ${palette.length}/${targetColors} colors for ${colorSpace}`)
    
    if (palette.length !== targetColors) {
      paletteLogger.warn(`⚠️ [ADAPTER] Expected ${targetColors} colors but got ${palette.length} for ${colorSpace}`)
    }

    return palette
  }

  /**
   * Libération des ressources WebGL
   */
  dispose(): void {
    adapterLogger.debug('🗑️ [ADAPTER] WebGL Processor disposed')
    
    if (this.gl) {
      // Nettoyer les ressources WebGL si nécessaire
      // TODO: Nettoyer textures, buffers, programs WebGL
      this.gl = null
    }
  }
}