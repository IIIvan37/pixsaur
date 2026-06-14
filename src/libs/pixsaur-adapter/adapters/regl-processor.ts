/**
 * Adaptateur ReGL pour le traitement d'images
 * Phase 1: Infrastructure ReGL avec ReGLQuantizer intégré et fallback CPU
 * ReGL simplifiera la gestion WebGL quand l'implémentation GPU sera prête
 */

import type REGL from 'regl'
import { adapterLogger, paletteLogger } from '@/core'
import type { DistanceMetric } from '@/libs/pixsaur-color/src/metric/distance'
import { createQuantizer } from '@/libs/pixsaur-color/src/quant/quantize'
import { applyAdjustmentsInOnePass } from '@/libs/pixsaur-color/src/transform/color-transform/adjust'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { createRasterPreviewImageData } from '@/libs/pixsaur-raster/render-with-raster'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import {
  createBlurKernel,
  createSharpenKernel,
  getBlurPassCount,
  kernelToMat3
} from '../convolution-kernels'
import {
  applyChromaKey,
  applyConvolutionFilters,
  applyMedianFilter,
  applySobelEdgeDetection
} from '../cpu-convolution'
import type {
  AdjustmentConfig,
  ImageProcessor,
  PaletteStrategy,
  QuantizationOptions
} from '../interfaces'
import {
  convolutionFragmentShader,
  imageAdjustmentFragmentShader,
  rasterFragmentShader,
  simpleVertexShader,
  sobelFragmentShader
} from '../shaders'
import { ReGLQuantizer } from './regl-quantizer'

/**
 * Adaptateur ReGL pour le traitement d'images
 * Phase 1: Infrastructure ReGL prête avec fallback CPU
 */
export class ReGLProcessor implements ImageProcessor {
  readonly type: 'regl' | 'cpu-fallback' = 'cpu-fallback'
  readonly isAvailable: boolean

  // ReGL et quantizer (Phase 1: préparation pour GPU)
  private quantizer?: ReGLQuantizer
  private regl?: REGL.Regl

  // GPU Image Adjustments
  private imageAdjustmentCommand?: any
  private inputTexture?: any

  // GPU Convolution (sharpen, blur)
  private convolutionCommand?: any

  // GPU Sobel edge detection
  private sobelCommand?: any

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
        this.initializeConvolution(regl)
        this.initializeSobel(regl)
        this.initializeRasterPreview(regl)
        this.type = 'regl'
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
   * Initialise la commande GPU pour les filtres de convolution (sharpen, blur)
   */
  private initializeConvolution(regl: REGL.Regl): void {
    this.convolutionCommand = regl({
      frag: convolutionFragmentShader,
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
        u_image: (_ctx, props: any) => props.inputTexture,
        u_texelSize: (_ctx, props: any) => props.texelSize,
        u_kernel: (_ctx, props: any) => props.kernel,
        u_strength: (_ctx, props: any) => props.strength
      },
      primitive: 'triangle strip',
      count: 4
    })
  }

  /**
   * Initialise la commande GPU pour la détection de contours Sobel
   */
  private initializeSobel(regl: REGL.Regl): void {
    this.sobelCommand = regl({
      frag: sobelFragmentShader,
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
        u_image: (_ctx, props: any) => props.inputTexture,
        u_texelSize: (_ctx, props: any) => props.texelSize,
        u_strength: (_ctx, props: any) => props.strength
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
      const webgl2Context = canvas.getContext('webgl2')
      const gl = webgl2Context || canvas.getContext('webgl')

      if (gl) {
        const version = webgl2Context ? 'WebGL 2.0' : 'WebGL 1.0'
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
    let inputData = imageData

    // Chroma key en premier (suppression de fond -> remplacé par noir = ink 0)
    const chromaKeyEnabled = adjustments.chromaKeyEnabled ?? 0
    const chromaKeyColor = adjustments.chromaKeyColor
    const chromaKeyTolerance = adjustments.chromaKeyTolerance ?? 30
    if (chromaKeyEnabled && chromaKeyColor) {
      inputData = applyChromaKey(inputData, chromaKeyColor, chromaKeyTolerance)
    }

    // Le filtre médian est toujours appliqué en CPU (tri des pixels impossible en shader simple)
    const median = adjustments.median ?? 0
    if (median !== 0) {
      inputData = applyMedianFilter(inputData, median)
    }

    // Essayer d'abord le GPU si disponible
    if (this.imageAdjustmentCommand && this.quantizer) {
      return this.applyAdjustmentsGPU(inputData, adjustments)
    }

    // Fallback CPU: ajustements colorimétriques
    let result = applyAdjustmentsInOnePass(
      inputData,
      this.createAdjustmentConfig(adjustments)
    )

    // Fallback CPU: convolution (sharpen, blur)
    const sharpen = adjustments.sharpen ?? 0
    const blur = adjustments.blur ?? 0
    if (sharpen !== 0 || blur !== 0) {
      result = applyConvolutionFilters(result, sharpen, blur)
    }

    // Fallback CPU: edge detection
    const edges = adjustments.edges ?? 0
    if (edges !== 0) {
      result = applySobelEdgeDetection(result, edges)
    }

    return result
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
   * Pipeline: Input → Adjustments → Convolution (si actif) → Output
   */
  private applyAdjustmentsGPU(
    imageData: ImageData,
    adjustments: AdjustmentConfig
  ): ImageData {
    const { width, height } = imageData
    const totalPixels = width * height
    const hasConvolution =
      (adjustments.sharpen ?? 0) !== 0 || (adjustments.blur ?? 0) !== 0
    const hasEdges = (adjustments.edges ?? 0) !== 0

    const startTime = performance.now()

    // Mise à jour de la texture d'entrée (réutilise l'allocation existante si possible)
    if (!this.inputTexture) {
      this.inputTexture = this.regl!.texture({
        width,
        height,
        format: 'rgba',
        type: 'uint8'
      })
    }
    if (typeof this.inputTexture === 'function') {
      this.inputTexture({
        width,
        height,
        data: imageData.data,
        format: 'rgba',
        type: 'uint8'
      })
    } else {
      this.inputTexture.destroy?.()
      this.inputTexture = this.regl!.texture({
        width,
        height,
        data: imageData.data,
        format: 'rgba',
        type: 'uint8'
      })
    }

    // Configuration du framebuffer de sortie pour ajustements
    const adjustmentOutputTexture = this.regl!.texture({
      width,
      height,
      format: 'rgba',
      type: 'uint8'
    })

    const adjustmentFramebuffer = this.regl!.framebuffer({
      color: adjustmentOutputTexture
    })

    // Pass 1: Rendu avec les ajustements colorimétriques
    adjustmentFramebuffer.use(() => {
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

    // Texture finale (après convolution ou directement depuis ajustements)
    let finalTexture = adjustmentOutputTexture
    let convolutionFramebuffer: any = null
    let convolutionPasses = 0

    // Pass 2+: Convolution (blur puis sharpen) si nécessaire
    if (hasConvolution && this.convolutionCommand) {
      const sharpen = adjustments.sharpen ?? 0
      const blur = adjustments.blur ?? 0
      const blurPasses = getBlurPassCount(blur)
      const sharpenPasses = sharpen === 0 ? 0 : 1
      convolutionPasses = blurPasses + sharpenPasses

      // Texture de sortie finale
      const convolutionOutputTexture = this.regl!.texture({
        width,
        height,
        format: 'rgba',
        type: 'uint8'
      })

      convolutionFramebuffer = this.regl!.framebuffer({
        color: convolutionOutputTexture
      })

      // Textures pour ping-pong
      let currentInput = adjustmentOutputTexture
      let tempTexture1: any = null
      let tempTexture2: any = null
      let passIndex = 0

      // Helper pour obtenir la texture de sortie
      const getOutputTexture = (isLastPass: boolean) => {
        if (isLastPass) return convolutionOutputTexture
        // Alterner entre temp textures
        if (!tempTexture1) {
          tempTexture1 = this.regl!.texture({
            width,
            height,
            format: 'rgba',
            type: 'uint8'
          })
        }
        if (passIndex % 2 === 0) {
          return tempTexture1
        }
        if (!tempTexture2) {
          tempTexture2 = this.regl!.texture({
            width,
            height,
            format: 'rgba',
            type: 'uint8'
          })
        }
        return tempTexture2
      }

      // Appliquer blur d'abord (multi-pass)
      if (blurPasses > 0) {
        for (let i = 0; i < blurPasses; i++) {
          // Première passe: kernel interpolé, passes suivantes: full Gaussian
          const blurKernel = kernelToMat3(createBlurKernel(blur, i))
          const isLastPass = i === blurPasses - 1 && sharpenPasses === 0
          const outputTexture = getOutputTexture(isLastPass)

          const fb = this.regl!.framebuffer({ color: outputTexture })
          fb.use(() => {
            this.convolutionCommand!({
              inputTexture: currentInput,
              texelSize: [1 / width, 1 / height],
              kernel: blurKernel,
              strength: 1
            })
          })
          fb.destroy()

          currentInput = outputTexture
          passIndex++
        }
      }

      // Puis appliquer sharpen
      if (sharpenPasses > 0) {
        const sharpenKernel = kernelToMat3(createSharpenKernel(sharpen))

        const fb = this.regl!.framebuffer({ color: convolutionOutputTexture })
        fb.use(() => {
          this.convolutionCommand!({
            inputTexture: currentInput,
            texelSize: [1 / width, 1 / height],
            kernel: sharpenKernel,
            strength: 1
          })
        })
        fb.destroy()
      }

      // Nettoyage textures temporaires
      if (tempTexture1) tempTexture1.destroy()
      if (tempTexture2) tempTexture2.destroy()

      finalTexture = convolutionOutputTexture
    }

    // Pass 3: Sobel edge detection (si actif)
    let edgesFramebuffer: any = null
    let edgesPasses = 0
    if (hasEdges && this.sobelCommand) {
      edgesPasses = 1
      const edgesOutputTexture = this.regl!.texture({
        width,
        height,
        format: 'rgba',
        type: 'uint8'
      })

      edgesFramebuffer = this.regl!.framebuffer({
        color: edgesOutputTexture
      })

      // Input: soit la texture de convolution, soit la texture d'ajustements
      const inputForEdges = hasConvolution
        ? finalTexture
        : adjustmentOutputTexture

      edgesFramebuffer.use(() => {
        this.sobelCommand!({
          inputTexture: inputForEdges,
          texelSize: [1 / width, 1 / height],
          strength: adjustments.edges
        })
      })

      // Si on avait une convolution, on peut nettoyer sa texture maintenant
      if (hasConvolution && convolutionFramebuffer) {
        convolutionFramebuffer.destroy()
        finalTexture.destroy()
      }

      finalTexture = edgesOutputTexture
    }

    // Lecture du résultat final
    const resultData = new Uint8ClampedArray(width * height * 4)
    const nonEdgeFramebuffer = hasConvolution
      ? convolutionFramebuffer
      : adjustmentFramebuffer
    const finalFramebuffer = hasEdges ? edgesFramebuffer : nonEdgeFramebuffer
    this.regl!.read({
      framebuffer: finalFramebuffer,
      data: new Uint8Array(resultData.buffer)
    })

    // Nettoyage
    adjustmentFramebuffer.destroy()
    adjustmentOutputTexture.destroy()
    if (hasConvolution && !hasEdges && convolutionFramebuffer) {
      convolutionFramebuffer.destroy()
      finalTexture.destroy()
    }
    if (hasEdges && edgesFramebuffer) {
      edgesFramebuffer.destroy()
      finalTexture.destroy()
    }

    const totalTime = performance.now() - startTime
    const totalPasses = 1 + convolutionPasses + edgesPasses // adjustments + convolution + edges
    adapterLogger.info(
      `[ReGL] GPU adjustments completed: ${totalPixels} pixels in ${totalTime.toFixed(1)}ms (${totalPasses} pass${totalPasses > 1 ? 'es' : ''}, ${(totalPixels / totalTime / 1000).toFixed(1)}M pixels/sec)`
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
    paletteStrategy?: PaletteStrategy,
    options?: QuantizationOptions
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
            paletteStrategy: paletteStrategy ?? 'exhaustive-contrast',
            autoDistinctMapping: options?.autoDistinctMapping ?? false,
            colorDiversity: options?.colorDiversity ?? 50,
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
      paletteStrategy ?? 'exhaustive-contrast'
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
      this.inputTexture?.destroy?.()
      this.regl?.destroy?.()
      this.quantizer = undefined
      this.inputTexture = undefined
      this.imageAdjustmentCommand = undefined
      this.convolutionCommand = undefined
      this.sobelCommand = undefined
      this.rasterPreviewCommand = undefined
      this.regl = undefined
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
    currentMode: 'regl' | 'cpu-fallback'
    futureReGLCapable: boolean
    webglVersion: string | null
    maxTextureSize: number
  } {
    return {
      currentMode: this.type,
      futureReGLCapable: this.reglCapabilities.canUseReGL,
      webglVersion: this.reglCapabilities.webglVersion,
      maxTextureSize: this.reglCapabilities.maxTextureSize
    }
  }
}
