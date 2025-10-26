/**
 * Adaptateur ReGL pour le traitement d'images
 * Phase 1: Infrastructure ReGL avec ReGLQuantizer intégré et fallback CPU
 * ReGL simplifiera la gestion WebGL quand l'implémentation GPU sera prête
 */

// Import pour accéder à l'atome de stratégie de contraste
import { getDefaultStore } from 'jotai'
import type REGL from 'regl'
import { contrastStrategyAtom } from '@/app/store/config/config'
import type { DistanceMetric } from '@/libs/pixsaur-color/src/metric/distance'
import { createQuantizer } from '@/libs/pixsaur-color/src/quant/quantize'
import { applyAdjustmentsInOnePass } from '@/libs/pixsaur-color/src/transform/color-transform/adjust'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { adapterLogger, paletteLogger, quantizerLogger } from '@/utils/logger'
import type { AdjustmentConfig, ImageProcessor } from '../interfaces'
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

  // Capacités détectées
  private readonly reglCapabilities: {
    canUseReGL: boolean
    webglVersion: string | null
    maxTextureSize: number
  }

  constructor(regl?: REGL.Regl) {
    // Évaluer si ReGL pourrait être utilisé
    this.reglCapabilities = this.evaluateReGLCapabilities()

    adapterLogger.debug(
      `[ADAPTER] ReGL constructor - regl instance: ${!!regl}, canUseReGL: ${this.reglCapabilities.canUseReGL}`
    )

    // Phase 1: Setup optionnel de ReGL
    if (regl && this.reglCapabilities.canUseReGL) {
      try {
        adapterLogger.debug('[ADAPTER] Initializing ReGL quantizer...')
        this.quantizer = new ReGLQuantizer(regl)
        this.regl = regl // Store ReGL instance
        this.initializeGPUAdjustments(regl)
        adapterLogger.info(
          '✅ [ADAPTER] ReGL quantizer and GPU adjustments initialized successfully'
        )
      } catch (error) {
        adapterLogger.warn(
          '⚠️ [ADAPTER] ReGL initialization failed, using CPU fallback',
          error
        )
        this.quantizer = undefined
        this.regl = undefined
      }
    } else {
      adapterLogger.debug(
        `[ADAPTER] Skipping ReGL initialization - regl: ${!!regl}, canUseReGL: ${this.reglCapabilities.canUseReGL}`
      )
    }

    // Toujours disponible avec fallback CPU
    this.isAvailable = true

    adapterLogger.info(
      `🎮 [ADAPTER] ReGL processor initialized: GPU=${!!this.quantizer}, capabilities=${this.reglCapabilities.canUseReGL}`
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
      frag: `
        precision mediump float;
        
        uniform sampler2D u_image;
        uniform vec3 u_rgbFactors;    // RGB multiplicatifs
        uniform float u_brightness;   // Facteur brightness
        uniform float u_contrast;     // Facteur contrast
        uniform float u_saturation;   // Facteur saturation
        uniform float u_posterization; // Niveaux posterization
        
        varying vec2 v_texCoord;
        
        // Conversion RGB vers HSL
        vec3 rgb2hsl(vec3 c) {
          float max_val = max(max(c.r, c.g), c.b);
          float min_val = min(min(c.r, c.g), c.b);
          float delta = max_val - min_val;
          
          float h = 0.0;
          float s = 0.0;
          float l = (max_val + min_val) * 0.5;
          
          if (delta > 0.0001) {
            s = l > 0.5 ? delta / (2.0 - max_val - min_val) : delta / (max_val + min_val);
            
            if (max_val == c.r) {
              h = (c.g - c.b) / delta + (c.g < c.b ? 6.0 : 0.0);
            } else if (max_val == c.g) {
              h = (c.b - c.r) / delta + 2.0;
            } else {
              h = (c.r - c.g) / delta + 4.0;
            }
            h /= 6.0;
          }
          
          return vec3(h, s, l);
        }
        
        // Conversion HSL vers RGB
        vec3 hsl2rgb(vec3 hsl) {
          float h = hsl.x;
          float s = hsl.y;
          float l = hsl.z;
          
          if (s == 0.0) {
            return vec3(l, l, l);
          }
          
          float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
          float p = 2.0 * l - q;
          
          // Fonction hue2rgb inline
          float r, g, b;
          
          // Pour r
          float t_r = h + 1.0/3.0;
          if (t_r < 0.0) t_r += 1.0;
          if (t_r > 1.0) t_r -= 1.0;
          if (t_r < 1.0/6.0) r = p + (q - p) * 6.0 * t_r;
          else if (t_r < 1.0/2.0) r = q;
          else if (t_r < 2.0/3.0) r = p + (q - p) * (2.0/3.0 - t_r) * 6.0;
          else r = p;
          
          // Pour g
          float t_g = h;
          if (t_g < 0.0) t_g += 1.0;
          if (t_g > 1.0) t_g -= 1.0;
          if (t_g < 1.0/6.0) g = p + (q - p) * 6.0 * t_g;
          else if (t_g < 1.0/2.0) g = q;
          else if (t_g < 2.0/3.0) g = p + (q - p) * (2.0/3.0 - t_g) * 6.0;
          else g = p;
          
          // Pour b
          float t_b = h - 1.0/3.0;
          if (t_b < 0.0) t_b += 1.0;
          if (t_b > 1.0) t_b -= 1.0;
          if (t_b < 1.0/6.0) b = p + (q - p) * 6.0 * t_b;
          else if (t_b < 1.0/2.0) b = q;
          else if (t_b < 2.0/3.0) b = p + (q - p) * (2.0/3.0 - t_b) * 6.0;
          else b = p;
          
          return vec3(r, g, b);
        }
        
        void main() {
          vec4 pixel = texture2D(u_image, v_texCoord);
          vec3 color = pixel.rgb;
          
          // Étape 1: RGB multiplicatif
          color *= u_rgbFactors;
          
          // Étape 2: Brightness
          color *= u_brightness;
          
          // Étape 3: Contrast (pivot autour de 0.5)
          color = (color - 0.5) * u_contrast + 0.5;
          
          // Étape 4: Saturation via HSL
          vec3 hsl = rgb2hsl(color);
          hsl.y = clamp(hsl.y * u_saturation, 0.0, 1.0);
          color = hsl2rgb(hsl);
          
            // Étape 5: Posterization
            if (u_posterization < 255.0) {
              float step = 255.0 / (u_posterization - 1.0);
              color = floor(color * 255.0 / step + 0.5) * step / 255.0;
            }          // Clamp final
          color = clamp(color, 0.0, 1.0);
          
          gl_FragColor = vec4(color, pixel.a);
        }
      `,
      vert: `
        attribute vec2 a_position;
        varying vec2 v_texCoord;
        
        void main() {
          v_texCoord = (a_position + 1.0) * 0.5;
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `,
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
        u_posterization: (_context, props: any) => props.posterization
      },
      primitive: 'triangle strip',
      count: 4
    })
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

        adapterLogger.debug(
          `🔍 [ADAPTER] WebGL capabilities detected: ${version}, max texture: ${maxTextureSize}px`
        )

        return {
          canUseReGL: true,
          webglVersion: version,
          maxTextureSize
        }
      } else {
        adapterLogger.debug('🔍 [ADAPTER] No WebGL support detected')
        return {
          canUseReGL: false,
          webglVersion: null,
          maxTextureSize: 0
        }
      }
    } catch (error) {
      adapterLogger.warn(
        '⚠️ [ADAPTER] Error evaluating WebGL capabilities:',
        error
      )
      return {
        canUseReGL: false,
        webglVersion: null,
        maxTextureSize: 0
      }
    }
  }

  /**
   * Applique les ajustements d'image avec CPU fallback
   * FUTURE ENHANCEMENT: Remplacer par vraie accélération ReGL dans le futur
   */
  async applyAdjustments(
    imageData: ImageData,
    adjustments: AdjustmentConfig
  ): Promise<ImageData> {
    // Essayer d'abord le GPU si disponible
    if (this.imageAdjustmentCommand && this.quantizer) {
      return adapterLogger.timeAsync(
        '🎮 ReGL GPU Image Adjustments',
        async () => {
          adapterLogger.debug(
            `� [ADAPTER] Applying adjustments via GPU: brightness=${adjustments.brightness}, contrast=${adjustments.contrast}, saturation=${adjustments.saturation}`
          )

          return this.applyAdjustmentsGPU(imageData, adjustments)
        }
      )
    }

    // Fallback CPU
    return adapterLogger.timeAsync(
      'ReGL Image Adjustments (CPU fallback)',
      async () => {
        adapterLogger.debug(
          `💻 [ADAPTER] Applying adjustments via CPU fallback: brightness=${adjustments.brightness}, contrast=${adjustments.contrast}, saturation=${adjustments.saturation}, posterization=${adjustments.posterization}, pixels=${imageData.width}x${imageData.height}`
        )

        const config = {
          rgb: adjustments.rgb,
          brightness: adjustments.brightness,
          contrast: adjustments.contrast,
          saturation: adjustments.saturation,
          posterization: adjustments.posterization
        }

        return applyAdjustmentsInOnePass(imageData, config)
      }
    )
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
      `🎮 [ReGL] GPU adjustments completed: ${totalPixels} pixels in ${totalTime.toFixed(1)}ms (${(totalPixels / totalTime / 1000).toFixed(1)}M pixels/sec)`
    )

    return new ImageData(resultData, width, height)
  }

  /**
   * Version synchrone pour compatibility avec Jotai atoms
   */
  applyAdjustmentsSync(
    imageData: ImageData,
    adjustments: AdjustmentConfig
  ): ImageData {
    const timerId = `ReGL Image Adjustments (Sync) ${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    return adapterLogger.timeSync(timerId, () => {
      // Essayer d'abord le GPU si disponible
      if (this.imageAdjustmentCommand && this.quantizer) {
        adapterLogger.debug(
          `🎮 [ADAPTER] Applying sync adjustments via GPU: brightness=${adjustments.brightness}, contrast=${adjustments.contrast}, saturation=${adjustments.saturation}`
        )

        return this.applyAdjustmentsGPU(imageData, adjustments)
      }

      // Fallback CPU
      adapterLogger.debug(
        `💻 [ADAPTER] Applying sync adjustments via CPU fallback: brightness=${adjustments.brightness}, contrast=${adjustments.contrast}, saturation=${adjustments.saturation}`
      )

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
    contrastStrategy?: 'max' | 'balanced'
  ): Promise<Vector[]> {
    const timerId = `ReGL Palette Quantization ${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    return adapterLogger.timeAsync(timerId, async () => {
      adapterLogger.debug(
        `[ADAPTER] Received contrastStrategy: ${contrastStrategy}, targetColors: ${targetColors}`
      )
      adapterLogger.debug(
        `[ADAPTER] Starting ReGL quantization: colorSpace=RGB, targetColors=${targetColors}, bufferSize=${buffer.length}`
      )

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
          adapterLogger.debug('🎮 [ADAPTER] Using ReGL quantizer')

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
              contrastStrategy:
                contrastStrategy || getDefaultStore().get(contrastStrategyAtom),
              gpuOptions: {
                minPixelsForGPU: 128 * 128 // GPU avantageux pour images moyennes+
              }
            }
          )

          adapterLogger.debug(
            `[ADAPTER] Final contrastStrategy passed: ${contrastStrategy || getDefaultStore().get(contrastStrategyAtom)}`
          )

          return [...result] // Conversion readonly -> mutable pour compatibilité
        } catch (error) {
          adapterLogger.warn(
            '⚠️ [ADAPTER] ReGL quantization failed, falling back to CPU',
            error
          )
          // Continue vers fallback CPU
        }
      }

      // Fallback CPU (existant)
      adapterLogger.debug('🖥️ [ADAPTER] Using CPU quantization fallback')

      return this.quantizePaletteOptimized(
        buffer,
        dimensions,
        targetColors,
        basePalette,
        preselected,
        distanceMetric,
        contrastStrategy || getDefaultStore().get(contrastStrategyAtom)
      )
    })
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
    contrastStrategy?: 'max' | 'balanced'
  ): Promise<Vector[]> {
    quantizerLogger.debug(
      `📊 [ADAPTER] Creating ReGL-ready quantizer with metric: ${distanceMetric}, basePalette=${basePalette.length} colors, preselected=${preselected.length} colors`
    )

    const startTime = performance.now()

    // Utiliser la signature correcte de createQuantizer
    const quantizer = createQuantizer({
      buf: buffer,
      basePalette,
      preselected,
      quantConfig: {
        distanceMetric,
        contrastStrategy:
          contrastStrategy || getDefaultStore().get(contrastStrategyAtom)
      }
    })

    const creationTime = performance.now()
    quantizerLogger.debug(
      `🔧 [ADAPTER] Quantizer Creation: ${(creationTime - startTime).toFixed(2)}ms`
    )

    const quantStart = performance.now()

    // Utiliser la signature correcte de quantize
    const palette = quantizer.quantize(targetColors)

    const quantEnd = performance.now()
    quantizerLogger.debug(
      `⚡ [ADAPTER] Quantization Process: ${(quantEnd - quantStart).toFixed(2)}ms`
    )

    paletteLogger.debug(
      `🎨 [ADAPTER] Quantization completed via ReGL adapter (CPU): ${palette.length}/${targetColors} colors for RGB`
    )

    if (palette.length !== targetColors) {
      paletteLogger.warn(
        `⚠️ [ADAPTER] Expected ${targetColors} colors but got ${palette.length} for RGB`
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
      adapterLogger.debug(
        '🗑️ [ADAPTER] ReGL Processor disposed (GPU resources cleaned)'
      )
    } catch (error) {
      adapterLogger.error(
        '❌ [ADAPTER] Error during ReGL processor disposal',
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
