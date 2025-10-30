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
import { adapterLogger, paletteLogger } from '@/utils/logger'
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

    // Phase 1: Setup optionnel de ReGL
    if (regl && this.reglCapabilities.canUseReGL) {
      try {
        this.quantizer = new ReGLQuantizer(regl)
        this.regl = regl // Store ReGL instance
        this.initializeGPUAdjustments(regl)
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
      frag: `
        precision mediump float;
        
        uniform sampler2D u_image;
        uniform vec3 u_rgbFactors;      // RGB multiplicatifs
        uniform float u_brightness;     // Facteur brightness
        uniform float u_contrast;       // Facteur contrast
        uniform float u_saturation;     // Facteur saturation
        uniform float u_hue;            // Rotation de teinte (normalized)
        uniform float u_vibrance;       // Saturation intelligente
        uniform float u_temperature;    // Balance bleu/orange
        uniform float u_tint;           // Balance vert/magenta
        uniform float u_gamma;          // Correction gamma
        uniform float u_exposure;       // Exposition (stops)
        uniform float u_highlights;     // Ajustement hautes lumières
        uniform float u_shadows;        // Ajustement ombres
        uniform float u_posterization;  // Niveaux posterization
        
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
        
        // Luminance (ITU-R BT.601)
        float luminance(vec3 color) {
          return dot(color, vec3(0.299, 0.587, 0.114));
        }
        
        void main() {
          vec4 pixel = texture2D(u_image, v_texCoord);
          vec3 color = pixel.rgb;
          
          // Étape 1: RGB multiplicatif
          color *= u_rgbFactors;
          
          // Étape 2: Temperature (-100/+100 → bleu/orange)
          if (u_temperature != 0.0) {
            float temp = u_temperature / 100.0;
            color.r *= 1.0 + temp * 0.3;
            color.b *= 1.0 - temp * 0.3;
          }
          
          // Étape 3: Tint (-100/+100 → vert/magenta)
          if (u_tint != 0.0) {
            float tintVal = u_tint / 100.0;
            color.g *= 1.0 + tintVal * 0.3;
            color.r *= 1.0 - tintVal * 0.15;
            color.b *= 1.0 - tintVal * 0.15;
          }
          
          // Étape 4: Exposure (stops: -3 à +3)
          if (u_exposure != 0.0) {
            color *= pow(2.0, u_exposure);
          }
          
          // Étape 5: Highlights/Shadows
          if (u_highlights != 0.0 || u_shadows != 0.0) {
            float lum = luminance(color);
            
            // Highlights: affecte les zones claires (lum > 0.5)
            if (u_highlights != 0.0 && lum > 0.5) {
              float highlightMask = (lum - 0.5) * 2.0; // 0 à 1
              float highlightFactor = 1.0 + (u_highlights / 100.0) * highlightMask;
              color *= highlightFactor;
            }
            
            // Shadows: affecte les zones sombres (lum < 0.5)
            if (u_shadows != 0.0 && lum < 0.5) {
              float shadowMask = (0.5 - lum) * 2.0; // 0 à 1
              float shadowFactor = 1.0 + (u_shadows / 100.0) * shadowMask;
              color *= shadowFactor;
            }
          }
          
          // Étape 6: Brightness
          color *= u_brightness;
          
          // Étape 7: Gamma correction
          if (u_gamma != 1.0) {
            color = pow(color, vec3(1.0 / u_gamma));
          }
          
          // Étape 8: Contrast (pivot autour de 0.5)
          color = (color - 0.5) * u_contrast + 0.5;
          
          // Étape 9: Saturation + Hue + Vibrance via HSL
          vec3 hsl = rgb2hsl(color);
          
          // Hue rotation
          if (u_hue != 0.0) {
            hsl.x = mod(hsl.x + u_hue, 1.0);
          }
          
          // Saturation
          hsl.y = clamp(hsl.y * u_saturation, 0.0, 1.0);
          
          // Vibrance (saturation intelligente: booste couleurs ternes, préserve saturées)
          if (u_vibrance != 0.0) {
            float vibranceFactor = u_vibrance / 100.0;
            // Plus la saturation actuelle est faible, plus vibrance a d'effet
            float vibranceBoost = vibranceFactor * (1.0 - hsl.y);
            hsl.y = clamp(hsl.y + vibranceBoost, 0.0, 1.0);
          }
          
          color = hsl2rgb(hsl);
          
          // Étape 10: Posterization
          if (u_posterization < 255.0) {
            float step = 255.0 / (u_posterization - 1.0);
            color = floor(color * 255.0 / step + 0.5) * step / 255.0;
          }
          
          // Clamp final
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
      return this.applyAdjustmentsGPU(imageData, adjustments)
    }

    // Fallback CPU
    const config = {
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

    return applyAdjustmentsInOnePass(imageData, config)
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
   * Version synchrone pour compatibility avec Jotai atoms
   */
  applyAdjustmentsSync(
    imageData: ImageData,
    adjustments: AdjustmentConfig
  ): ImageData {
    // Essayer d'abord le GPU si disponible
    if (this.imageAdjustmentCommand && this.quantizer) {
      return this.applyAdjustmentsGPU(imageData, adjustments)
    }

    // Fallback CPU
    const config = {
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

    return applyAdjustmentsInOnePass(imageData, config)
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
            contrastStrategy:
              contrastStrategy || getDefaultStore().get(contrastStrategyAtom),
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
      contrastStrategy || getDefaultStore().get(contrastStrategyAtom)
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
    contrastStrategy?: 'max' | 'balanced'
  ): Promise<Vector[]> {
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
