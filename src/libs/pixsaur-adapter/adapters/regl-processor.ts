/**
 * Adaptateur ReGL pour le traitement d'images
 * Phase 1: Infrastructure ReGL avec ReGLQuantizer intégré et fallback CPU
 * ReGL simplifiera la gestion WebGL quand l'implémentation GPU sera prête
 */

import { getDefaultStore } from 'jotai'
import type REGL from 'regl'
// Import pour accéder à l'atome de stratégie de palette
import { paletteStrategyAtom } from '@/app/store/config/config'
import { adapterLogger, paletteLogger } from '@/core'
import type { DistanceMetric } from '@/libs/pixsaur-color/src/metric/distance'
import { createQuantizer } from '@/libs/pixsaur-color/src/quant/quantize'
import { applyAdjustmentsInOnePass } from '@/libs/pixsaur-color/src/transform/color-transform/adjust'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { createRasterPreviewImageData } from '@/libs/pixsaur-raster/render-with-raster'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import type {
  AdjustmentConfig,
  ImageProcessor,
  PaletteStrategy
} from '../interfaces'
import {
  imageAdjustmentFragmentShader,
  rasterFragmentShader,
  simpleVertexShader
} from '../shaders'
import { ReGLQuantizer } from './regl-quantizer'

/**
 * Adaptateur ReGL pour le traitement d'images
 * Phase 1: Infrastructure ReGL prête avec fallback CPU
 */
export class ReGLProcessor implements ImageProcessor {
  readonly type = 'regl' as const
  readonly isAvailable: boolean

  // ReGL et quantizer (Phase 1: préparation pour GPU)
  private readonly quantizer?: ReGLQuantizer
  private readonly regl?: REGL.Regl

  // GPU Image Adjustments
  private imageAdjustmentCommand?: any
  private inputTexture?: any

  // GPU Raster preview
  private rasterPreviewCommand?: any

  // Capacités détectées
  private readonly reglCapabilities: {
    canUseReGL: boolean
    webglVersion: string | null
    maxTextureSize: number
  }

  constructor(regl?: REGL.Regl) {
    // Évaluer si ReGL pourrait être utilisé
    this.reglCapabilities = this.evaluateReGLCapabilities()

    // Phase 1: Setup optionnel de ReGL
    if (regl && this.reglCapabilities.canUseReGL) {
      try {
        this.quantizer = new ReGLQuantizer(regl)
        this.regl = regl // Store ReGL instance
        this.initializeGPUAdjustments(regl)
        this.initializeRasterPreview(regl)
        adapterLogger.info(
          '[ADAPTER] ReGL quantizer and GPU adjustments initialized successfully'
        )
      } catch (error) {
        adapterLogger.warn(
          '[ADAPTER] ReGL initialization failed, using CPU fallback',
          error
        )
        this.quantizer = undefined
        this.regl = undefined
      }
    }

    // Toujours disponible avec fallback CPU
    this.isAvailable = true

    adapterLogger.info(
      `[ADAPTER] ReGL processor initialized: GPU=${!!this.quantizer}, capabilities=${this.reglCapabilities.canUseReGL}`
    )
  }

  /**
   * Initialise les shaders GPU pour les ajustements d'image
   */
  private initializeGPUAdjustments(regl: REGL.Regl): void {
    // Create input texture
    this.inputTexture = regl.texture({
      width: 1,
      height: 1,
      format: 'rgba',
      type: 'uint8'
    })

    // Define the adjustment command with proper typing
    this.imageAdjustmentCommand = regl({
      frag: imageAdjustmentFragmentShader,
      vert: simpleVertexShader,
      attributes: {
        a_position: [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1]
        ]
      },
      uniforms: {
        u_image: () => this.inputTexture!,
        u_rgbFactors: (_context, props: any) => props.rgbFactors,
        u_brightness: (_context, props: any) => props.brightness,
        u_contrast: (_context, props: any) => props.contrast,
        u_saturation: (_context, props: any) => props.saturation,
        u_hue: (_context, props: any) => (props.hue || 0) / 360, // -180/+180 → -0.5/+0.5
        u_vibrance: (_context, props: any) => props.vibrance || 0,
        u_temperature: (_context, props: any) => props.temperature || 0,
        u_tint: (_context, props: any) => props.tint || 0,
        u_gamma: (_context, props: any) => props.gamma || 1,
        u_exposure: (_context, props: any) => props.exposure || 0,
        u_highlights: (_context, props: any) => props.highlights || 0,
        u_shadows: (_context, props: any) => props.shadows || 0,
        u_posterization: (_context, props: any) => props.posterization
      },
      primitive: 'triangle strip',
      count: 4
    })
  }

  /**
   * Initialise la commande GPU pour l'aperçu raster (palettes par ligne)
   */
  private initializeRasterPreview(regl: REGL.Regl): void {
    // Définir la commande de rendu raster
    this.rasterPreviewCommand = regl({
      frag: rasterFragmentShader,
      vert: simpleVertexShader,
      attributes: {
        a_position: [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1]
        ]
      },
      uniforms: {
        u_indexTex: (_ctx, props: any) => props.indexTex,
        u_paletteTex: (_ctx, props: any) => props.paletteTex,
        u_height: (_ctx, props: any) => props.height
      },
      primitive: 'triangle strip',
      count: 4
    })
  }

  /**
   * Construit une LUT palette 2D (16 x H) RGBA8 à partir de la palette globale et des changements raster
   */
  private buildPaletteLUT(
    globalPalette: Vector[],
    rasterChanges: RasterChange[],
    height: number
  ): Uint8Array {
    const lut = new Uint8Array(16 * height * 4)

    // regrouper par ligne
    const changesByLine = new Map<number, RasterChange[]>()
    for (const change of rasterChanges) {
      const list = changesByLine.get(change.line)
      if (list) list.push(change)
      else changesByLine.set(change.line, [change])
    }

    // palette courante mutable
    const cur: Vector[] = globalPalette.map((c) => [c[0], c[1], c[2]] as Vector)

    for (let y = 0; y < height; y++) {
      const onLine = changesByLine.get(y)
      if (onLine) {
        for (const ch of onLine) {
          cur[ch.inkIndex] = [ch.color[0], ch.color[1], ch.color[2]] as Vector
        }
      }

      for (let i = 0; i < 16; i++) {
        const off = (y * 16 + i) * 4
        const c = cur[i] || ([0, 0, 0] as Vector)
        lut[off] = c[0]
        lut[off + 1] = c[1]
        lut[off + 2] = c[2]
        lut[off + 3] = 255
      }
    }

    return lut
  }

  /**
   * Rendu d'un aperçu raster via GPU (fallback CPU si indisponible)
   */
  renderRasterPreview(
    indexBuffer: Uint8Array,
    width: number,
    height: number,
    globalPalette: Vector[],
    rasterChanges: RasterChange[]
  ): ImageData {
    // GPU disponible ?
    if (this.regl && this.rasterPreviewCommand) {
      adapterLogger.info(
        `[RASTER] Rendering raster preview via GPU (${width}x${height}, ${rasterChanges.length} changes)`
      )
      const regl = this.regl

      // Construire textures d'entrée
      // Texture d'indices: empaqueter indice dans canal A d'une RGBA8
      const indexRgba = new Uint8Array(width * height * 4)
      for (let i = 0, j = 3; i < indexBuffer.length; i++, j += 4) {
        indexRgba[j] = indexBuffer[i]
      }

      const indexTex = regl.texture({
        width,
        height,
        format: 'rgba',
        type: 'uint8',
        data: indexRgba
      })

      const paletteLUT = this.buildPaletteLUT(
        globalPalette,
        rasterChanges,
        height
      )
      const paletteTex = regl.texture({
        width: 16,
        height,
        format: 'rgba',
        type: 'uint8',
        data: paletteLUT
      })

      // Framebuffer de sortie
      const outTex = regl.texture({
        width,
        height,
        format: 'rgba',
        type: 'uint8'
      })
      const fbo = regl.framebuffer({ color: outTex })

      // Rendu
      fbo.use(() => {
        this.rasterPreviewCommand!({
          indexTex,
          paletteTex,
          height
        })
      })

      // Lecture
      const result = new Uint8Array(width * height * 4)
      regl.read({ framebuffer: fbo, data: result })

      // Nettoyage
      fbo.destroy()
      outTex.destroy()
      indexTex.destroy()
      paletteTex.destroy()

      return new ImageData(new Uint8ClampedArray(result.buffer), width, height)
    }

    // Fallback CPU
    adapterLogger.info(
      `[RASTER] Rendering raster preview via CPU fallback (${width}x${height}, ${rasterChanges.length} changes)`
    )
    return createRasterPreviewImageData(
      indexBuffer,
      width,
      height,
      globalPalette,
      rasterChanges
    )
  }

  /**
   * Évalue les capacités WebGL pour future utilisation ReGL
   */
  private evaluateReGLCapabilities(): {
    canUseReGL: boolean
    webglVersion: string | null
    maxTextureSize: number
  } {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')

      if (gl) {
        const version =
          gl instanceof WebGL2RenderingContext ? 'WebGL 2.0' : 'WebGL 1.0'
        const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)

        return {
          canUseReGL: true,
          webglVersion: version,
          maxTextureSize
        }
      } else {
        return {
          canUseReGL: false,
          webglVersion: null,
          maxTextureSize: 0
        }
      }
    } catch (error) {
      adapterLogger.warn(
        '[ADAPTER] Error evaluating WebGL capabilities:',
        error
      )
      return {
        canUseReGL: false,
        webglVersion: null,
        maxTextureSize: 0
      }
    }
  }

  async applyAdjustments(
    imageData: ImageData,
    adjustments: AdjustmentConfig
  ): Promise<ImageData> {
    return this.applyAdjustmentsInternal(imageData, adjustments)
  }

  /**
   * Version synchrone pour compatibility avec Jotai atoms
   */
  applyAdjustmentsSync(
    imageData: ImageData,
    adjustments: AdjustmentConfig
  ): ImageData {
    return this.applyAdjustmentsInternal(imageData, adjustments)
  }

  /**
   * Logique interne commune pour les ajustements (synchrone)
   */
  private applyAdjustmentsInternal(
    imageData: ImageData,
    adjustments: AdjustmentConfig
  ): ImageData {
    // Essayer d'abord le GPU si disponible
    if (this.imageAdjustmentCommand && this.quantizer) {
      return this.applyAdjustmentsGPU(imageData, adjustments)
    }

    // Fallback CPU
    return applyAdjustmentsInOnePass(
      imageData,
      this.createAdjustmentConfig(adjustments)
    )
  }

  /**
   * Crée la configuration d'ajustements pour applyAdjustmentsInOnePass
   */
  private createAdjustmentConfig(adjustments: AdjustmentConfig) {
    return {
      rgb: adjustments.rgb,
      brightness: adjustments.brightness,
      contrast: adjustments.contrast,
      saturation: adjustments.saturation,
      hue: adjustments.hue,
      vibrance: adjustments.vibrance,
      temperature: adjustments.temperature,
      tint: adjustments.tint,
      gamma: adjustments.gamma,
      exposure: adjustments.exposure,
      highlights: adjustments.highlights,
      shadows: adjustments.shadows,
      posterization: adjustments.posterization
    }
  }

  /**
   * Applique les ajustements via GPU ReGL
   */
  private applyAdjustmentsGPU(
    imageData: ImageData,
    adjustments: AdjustmentConfig
  ): ImageData {
    const { width, height } = imageData
    const totalPixels = width * height

    const startTime = performance.now()

    // Mise à jour de la texture d'entrée
    this.inputTexture = this.regl!.texture({
      width,
      height,
      data: imageData.data,
      format: 'rgba',
      type: 'uint8'
    })

    // Configuration du framebuffer de sortie
    const outputTexture = this.regl!.texture({
      width: imageData.width,
      height: imageData.height,
      format: 'rgba',
      type: 'uint8'
    })

    const framebuffer = this.regl!.framebuffer({
      color: outputTexture
    })

    // Rendu avec les ajustements
    framebuffer.use(() => {
      this.imageAdjustmentCommand!({
        rgbFactors: [adjustments.rgb.r, adjustments.rgb.g, adjustments.rgb.b],
        brightness: adjustments.brightness,
        contrast: adjustments.contrast,
        saturation: adjustments.saturation,
        hue: adjustments.hue,
        vibrance: adjustments.vibrance,
        temperature: adjustments.temperature,
        tint: adjustments.tint,
        gamma: adjustments.gamma,
        exposure: adjustments.exposure,
        highlights: adjustments.highlights,
        shadows: adjustments.shadows,
        posterization: adjustments.posterization
      })
    })

    // Lecture du résultat
    const resultData = new Uint8ClampedArray(width * height * 4)
    this.regl!.read({
      framebuffer: framebuffer,
      data: new Uint8Array(resultData.buffer)
    })

    // Nettoyage
    framebuffer.destroy()
    outputTexture.destroy()

    const totalTime = performance.now() - startTime
    adapterLogger.info(
      `[ReGL] GPU adjustments completed: ${totalPixels} pixels in ${totalTime.toFixed(1)}ms (${(totalPixels / totalTime / 1000).toFixed(1)}M pixels/sec)`
    )

    return new ImageData(resultData, width, height)
  }

  /**
   * Quantification de palette avec ReGL ou CPU fallback
   * Phase 1: Utilise ReGLQuantizer si disponible, sinon fallback CPU
   * Colorspace fixé sur RGB pour optimisation GPU
   */
  async quantizePalette(
    buffer: Uint8ClampedArray,
    imageData: ImageData | { width: number; height: number },
    targetColors: number,
    basePalette: Vector[],
    preselected: Vector[],
    paletteStrategy?: PaletteStrategy
  ): Promise<Vector[]> {
    // RGB utilise euclidean distance
    const distanceMetric: DistanceMetric = 'euclidean'

    // Extraire dimensions depuis imageData
    const dimensions =
      'data' in imageData
        ? { width: imageData.width, height: imageData.height }
        : imageData

    // Phase 1: Utiliser ReGLQuantizer si disponible
    if (this.quantizer) {
      try {
        const fullImageData =
          'data' in imageData
            ? imageData
            : new ImageData(
                new Uint8ClampedArray(buffer),
                imageData.width,
                imageData.height
              )

        const result = await this.quantizer.quantizePalette(
          buffer,
          fullImageData,
          basePalette,
          preselected,
          {
            distanceMetric,
            targetColors,
            paletteStrategy:
              paletteStrategy || getDefaultStore().get(paletteStrategyAtom),
            gpuOptions: {
              minPixelsForGPU: 128 * 128 // GPU avantageux pour images moyennes+
            }
          }
        )

        return [...result] // Conversion readonly -> mutable pour compatibilité
      } catch (error) {
        adapterLogger.warn(
          '[ADAPTER] ReGL quantization failed, falling back to CPU',
          error
        )
        // Continue vers fallback CPU
      }
    }

    // Fallback CPU (existant)
    return this.quantizePaletteOptimized(
      buffer,
      dimensions,
      targetColors,
      basePalette,
      preselected,
      distanceMetric,
      paletteStrategy || getDefaultStore().get(paletteStrategyAtom)
    )
  }

  /**
   * Quantification optimisée (préparation pour future ReGL)
   */
  private async quantizePaletteOptimized(
    buffer: Uint8ClampedArray,
    _dimensions: { width: number; height: number },
    targetColors: number,
    basePalette: Vector[],
    preselected: Vector[],
    distanceMetric: DistanceMetric,
    paletteStrategy?: PaletteStrategy
  ): Promise<Vector[]> {
    // Utiliser la signature correcte de createQuantizer
    const quantizer = createQuantizer({
      buf: buffer,
      basePalette,
      preselected,
      quantConfig: {
        distanceMetric,
        paletteStrategy // Passer la stratégie v2 au quantizer CPU
      }
    })

    // Utiliser la signature correcte de quantize
    const palette = quantizer.quantize(targetColors)

    if (palette.length !== targetColors) {
      paletteLogger.warn(
        `[ADAPTER] Expected ${targetColors} colors but got ${palette.length} for RGB`
      )
    }

    return palette
  }

  /**
   * Libération des ressources (CPU et ReGL)
   */
  dispose(): void {
    try {
      this.quantizer?.dispose()
    } catch (error) {
      adapterLogger.error(
        '[ADAPTER] Error during ReGL processor disposal',
        error
      )
    }
  }

  /**
   * Obtient des informations sur les capacités ReGL actuelles et futures
   */
  getCapabilities(): {
    currentMode: 'cpu-fallback'
    futureReGLCapable: boolean
    webglVersion: string | null
    maxTextureSize: number
  } {
    return {
      currentMode: 'cpu-fallback',
      futureReGLCapable: this.reglCapabilities.canUseReGL,
      webglVersion: this.reglCapabilities.webglVersion,
      maxTextureSize: this.reglCapabilities.maxTextureSize
    }
  }
}
