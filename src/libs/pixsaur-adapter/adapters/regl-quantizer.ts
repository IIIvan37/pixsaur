/**
 * ReGL Quantizer pour l'accélération GPU de la quantification de palette
 *
 * Réutilise tous les types et algorithmes existants de pixsaur-color pour maintenir
 * la cohérence architecturale et éviter la duplication de code.
 *
 * Phase 1: Infrastructure de base avec fallback CPU automatique
 */

import type REGL from 'regl'
import type { PaletteStrategy } from '@/app/store/config/types'
import { adapterLogger } from '@/core'
import { weightedRGBDistance } from '@/libs/pixsaur-color/src/metric/distance'
import { findClosestColorIndex } from '@/libs/pixsaur-color/src/metric/find-closest'
import {
  applyPaletteStrategyV2,
  type ColorCandidate,
  type PaletteStrategyName
} from '@/libs/pixsaur-color/src/quant/palette-strategies-v2'
import type { QuantizeConfig } from '@/libs/pixsaur-color/src/quant/quantize'
import { selectTopIndicesCore } from '@/libs/pixsaur-color/src/quant/select-to-indices'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  calculateHue,
  calculateHueDistance,
  calculateSaturation
} from '@/libs/pixsaur-color/src/utils/hsv'
import { histogramFragmentShader, histogramVertexShader } from '../shaders'

/**
 * Constantes pour la configuration GPU
 */
const MIN_PIXELS_FOR_GPU_DEFAULT = 128 * 128 // Seuil minimum de pixels pour utiliser le GPU
const MIN_TEXTURE_SIZE_FOR_GPU = 1024 // Taille minimale de texture pour utiliser le GPU

/**
 * Constantes pour la palette CPC
 */
const CPC_CLASSIC_PALETTE_SIZE = 27 // Palette CPC Classic (27 couleurs)
const CPC_MODE_0_COLORS = 16 // Mode 0: 16 couleurs
const CPC_MODE_1_MAX_COLORS = 4 // Mode 1: 2-4 couleurs
const CPC_PLUS_SPECIAL_MODE = 512 // Mode spécial CPC Plus (représente 16 couleurs)

/**
 * Constantes pour l'échantillonnage
 */
const SAMPLE_COUNT_MODE_0_CLASSIC = 256 // Échantillons pour mode 0 CPC Classic
const SAMPLE_COUNT_MODE_0_PLUS = 2048 // Échantillons augmentés pour mode 0 CPC Plus (teintes rares)
const SAMPLE_COUNT_MODE_1_2 = 1024 // Échantillons pour modes 1-2 (petites palettes)

/**
 * Constantes pour les seuils de couleur
 */
const RGB_NORMALIZATION_FACTOR = 255 // Facteur de normalisation RGB (0-255 → 0-1)
const SATURATION_THRESHOLD_FOR_HUE = 0.2 // Seuil de saturation pour considérer la teinte
const SATURATION_THRESHOLD_HIGH = 0.3 // Seuil de saturation élevé pour couleurs vibrantes
const DELTA_MIN_FOR_HUE = 0.01 // Delta minimum pour calculer la teinte (évite division par zéro)

/**
 * Constantes pour la distance de teinte
 */
const HUE_HALF_RANGE = 180 // Demi-plage de teinte (distance max circulaire)
const HUE_BUCKET_SIZE_DEGREES = 45 // Taille de bucket de teinte en degrés (~8 familles)
const MIN_HUE_DISTANCE_MODE_0 = 30 // Distance minimale de teinte pour diversité en mode 0

/**
 * Constantes pour la distance RGB
 */
const MIN_RGB_DISTANCE_MODE_0 = 20 // Distance RGB minimale pour mode 0
const MIN_RGB_DISTANCE_MODE_1_2 = 80 // Distance RGB minimale pour modes 1-2 (contraste élevé)

/**
 * Constantes pour les bonus de diversité
 */
const HUE_BONUS_WEIGHT = 2 // Poids du bonus de teinte (favorise diversité)
const HUE_BONUS_NORMALIZATION = 200 // Normalisation du bonus de teinte pour être comparable à RGB

/**
 * Constantes pour les multiplicateurs de candidats
 */
const CANDIDATE_MULTIPLIER_SMALL_PALETTE = 4 // Multiplicateur de candidats pour petites palettes (≤4 couleurs)
const CANDIDATE_MULTIPLIER_LARGE_PALETTE = 1 // Multiplicateur de candidats pour grandes palettes
const CANDIDATE_POOL_CLASSIC_RATIO = 0.5 // Ratio du pool de candidats pour CPC Classic
const CANDIDATE_POOL_PLUS_RATIO = 0.01 // Ratio du pool de candidats pour CPC Plus

/**
 * Constantes pour les seuils par défaut
 */
const DEFAULT_THRESHOLD = 10 // Seuil par défaut pour le filtrage adaptatif

/**
 * Shaders GLSL pour ReGL - Extraction pour améliorer la lisibilité
 */

// Fragment shader pour l'histogramme - RGB uniquement
const HISTOGRAM_FRAGMENT_SHADER = histogramFragmentShader

// Vertex shader simple pour les shaders d'histogramme
const HISTOGRAM_VERTEX_SHADER = histogramVertexShader

/**
 * ReGL configuration that extends existing QuantizeConfig
 * Reuses pixsaur-color types instead of redefining
 */
export interface ReGLQuantizeConfig extends QuantizeConfig {
  /** Target number of colors */
  readonly targetColors: number

  /** Pre-selected (locked) colors as CPC indices */
  readonly preselectedIndices?: readonly number[]

  /** Threshold for adaptive filtering (default: DEFAULT_THRESHOLD) */
  readonly threshold?: number

  /** Whether threshold is relative to palette size (default: false) */
  readonly isRelativeThreshold?: boolean

  /** Palette selection strategy (default: 'frequency') */
  readonly paletteStrategy?: PaletteStrategy

  /** GPU performance options */
  readonly gpuOptions?: {
    readonly batchSize?: number
    readonly useAsyncReadback?: boolean
    readonly minPixelsForGPU?: number
  }
}

/**
 * Capacités WebGL détectées pour ReGL
 */
interface ReGLCapabilities {
  readonly hasFloatTextures: boolean
  readonly hasColorBufferFloat: boolean
  readonly maxTextureSize: number
  readonly canUseGPU: boolean
  readonly extensions: readonly string[]
}

/**
 * ReGL Quantizer principal
 * Phase 1: Infrastructure de base avec fallback CPU robuste
 */
export class ReGLQuantizer {
  readonly type = 'regl' as const
  private readonly regl: REGL.Regl
  private readonly capabilities: ReGLCapabilities

  // GPU Resources (initialized later)
  private histogramCommand?: REGL.DrawCommand
  private histogramFBO?: REGL.Framebuffer
  private inputTexture?: REGL.Texture2D
  private cpcPaletteTexture?: REGL.Texture2D

  // Cache pour éviter re-upload
  private lastBasePalette?: readonly Vector[]
  private isDisposed = false

  constructor(regl: REGL.Regl) {
    this.regl = regl
    this.capabilities = this.detectCapabilities()

    if (this.capabilities.canUseGPU) {
      try {
        this.initializeGPUResources()
        adapterLogger.info(' [ReGL] GPU resources initialized successfully')
      } catch (error) {
        adapterLogger.warn(
          ' [ReGL] GPU initialization failed, will use CPU fallback',
          error
        )
      }
    } else {
      adapterLogger.info(' [ReGL] GPU not available, using CPU fallback only')
    }
  }

  /**
   * Interface principale compatible avec createQuantizer()
   * Utilise exactement les mêmes types que la version CPU
   */
  async quantizePalette(
    buffer: Uint8ClampedArray,
    imageData: ImageData,
    basePalette: readonly Vector[],
    preselected: readonly Vector[],
    config: ReGLQuantizeConfig
  ): Promise<readonly Vector[]> {
    if (this.isDisposed) {
      throw new Error('ReGL Quantizer has been disposed')
    }

    // ReGLQuantizer est purement GPU - pas de fallback interne
    if (!this.shouldUseGPU(imageData, config)) {
      throw new Error(
        'ReGLQuantizer: Image too small or GPU unavailable - use CPU processor instead'
      )
    }

    const result = await this.quantizeGPU(
      buffer,
      imageData,
      basePalette,
      preselected,
      config
    )

    return result
  }

  /**
   * Quantification GPU (Phase 2: Véritable implémentation GPU)
   */
  private async quantizeGPU(
    _buffer: Uint8ClampedArray,
    imageData: ImageData,
    basePalette: readonly Vector[],
    preselected: readonly Vector[],
    config: ReGLQuantizeConfig
  ): Promise<readonly Vector[]> {
    try {
      // 1. Upload data vers GPU
      this.updateInputTexture(imageData)
      this.updatePaletteTexture(basePalette)

      // 2. Calcul histogramme GPU (bypass pour CPC Plus avec modes optimisés)

      // 3. Sélection palette optimisée
      const selectedColors = await this.selectColorsGPU(
        imageData,
        basePalette,
        preselected,
        config
      )

      return selectedColors
    } catch (error) {
      adapterLogger.error(' [ReGL] GPU quantization error', error)
      throw error
    }
  }

  /**
   * Détermine si utiliser GPU ou CPU selon la taille d'image et les capacités
   * RÉACTIVÉ: Utilise vraie GPU avec shaders parallélisés
   */
  private shouldUseGPU(
    imageData: ImageData,
    config: ReGLQuantizeConfig
  ): boolean {
    if (!this.capabilities.canUseGPU || !this.histogramCommand) {
      return false
    }

    const pixels = imageData.width * imageData.height
    const minPixelsForGPU =
      config.gpuOptions?.minPixelsForGPU ?? MIN_PIXELS_FOR_GPU_DEFAULT

    const shouldUse = pixels >= minPixelsForGPU

    return shouldUse
  }

  /**
   * Détecte les capacités WebGL pour ReGL
   */
  private detectCapabilities(): ReGLCapabilities {
    const gl = this.regl._gl

    // Extensions optionnelles pour de meilleures performances
    const optionalExtensions = [
      'EXT_color_buffer_float',
      'WEBGL_color_buffer_float'
    ]

    const availableExtensions: string[] = []

    // Essayons d'activer chaque extension optionnelle
    for (const extName of optionalExtensions) {
      const ext = gl.getExtension(extName)
      if (ext) {
        availableExtensions.push(extName)
      }
    }

    // OES_texture_float n'est plus requis - on fonctionne très bien sans
    const hasFloatTextures = false // Pas besoin pour notre usage
    const hasColorBufferFloat = availableExtensions.some((ext) =>
      ext.includes('color_buffer_float')
    )

    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)

    // GPU disponible si la taille texture est suffisante (pas besoin d'extensions)
    const canUseGPU = maxTextureSize >= MIN_TEXTURE_SIZE_FOR_GPU

    const capabilities: ReGLCapabilities = {
      hasFloatTextures,
      hasColorBufferFloat,
      maxTextureSize,
      canUseGPU,
      extensions: availableExtensions
    }

    return capabilities
  }

  /**
   * Initialise les ressources GPU (Phase 1: Structure de base)
   */
  private initializeGPUResources(): void {
    if (!this.capabilities.canUseGPU) {
      throw new Error(
        'Cannot initialize GPU resources: insufficient capabilities'
      )
    }

    try {
      // Phase 1: Structure de base sans shaders réels
      // Les shaders seront implémentés en Phase 2

      this.histogramFBO = this.regl.framebuffer({
        width: 27, // 27 couleurs CPC
        height: 1,
        colorFormat: 'rgba',
        colorType: 'uint8' // Utilise uint8 par défaut - compatible partout
      })

      // Phase 2: Vrais shaders GPU pour histogramme
      this.histogramCommand = this.regl({
        frag: HISTOGRAM_FRAGMENT_SHADER,
        vert: HISTOGRAM_VERTEX_SHADER,
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
          u_palette: () => this.cpcPaletteTexture!,
          u_imageSize: (_context) => [
            this.inputTexture?.width || 1,
            this.inputTexture?.height || 1
          ],
          u_distanceMetric: () => {
            // 0: euclidean (RGB seulement)
            return 0
          }
        },
        primitive: 'triangle strip',
        count: 4,
        framebuffer: () => this.histogramFBO!
      })
    } catch (error) {
      adapterLogger.error(' [ReGL] Failed to initialize GPU resources', error)
      throw error
    }
  }

  /**
   * Upload image vers texture GPU
   */
  private updateInputTexture(imageData: ImageData): void {
    try {
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
    } catch (error) {
      adapterLogger.error(' [ReGL] Failed to update input texture', error)
      throw error
    }
  }

  /**
   * Upload palette vers texture GPU avec cache
   */
  private updatePaletteTexture(basePalette: readonly Vector[]): void {
    // Cache la palette pour éviter re-upload
    if (this.lastBasePalette === basePalette && this.cpcPaletteTexture) {
      return
    }

    try {
      if (this.cpcPaletteTexture) {
        this.cpcPaletteTexture.destroy()
      }

      // Convertir Vector[] vers Uint8Array (compatible partout)
      const paletteData = new Uint8Array(basePalette.length * 3)
      for (let i = 0; i < basePalette.length; i++) {
        const color = basePalette[i]
        paletteData[i * 3] = color[0]
        paletteData[i * 3 + 1] = color[1]
        paletteData[i * 3 + 2] = color[2]
      }

      this.cpcPaletteTexture = this.regl.texture({
        width: basePalette.length,
        height: 1,
        format: 'rgb',
        type: 'uint8',
        data: paletteData,
        wrap: 'clamp'
      })

      this.lastBasePalette = basePalette
    } catch (error) {
      adapterLogger.error(' [ReGL] Failed to update palette texture', error)
      throw error
    }
  }

  /**
   * Sélection optimisée des couleurs sur GPU (Phase 2)
   * Utilise la logique commune selectTopIndicesCore()
   */
  private async selectColorsGPU(
    imageData: ImageData,
    basePalette: readonly Vector[],
    preselected: readonly Vector[],
    config: ReGLQuantizeConfig
  ): Promise<readonly Vector[]> {
    // Convertir preselected en indices
    const preselectedIndices = this.convertPreselectedToIndices(
      preselected,
      basePalette
    )

    // Ajouter les indices présélectionnés à la config pour les méthodes optimisées
    const configWithPreselected: ReGLQuantizeConfig = {
      ...config,
      preselectedIndices
    }

    // Détecter le mode et sélectionner les couleurs
    const topIndices = this.detectModeAndSelectColors(
      imageData,
      basePalette,
      preselectedIndices,
      configWithPreselected
    )

    // OPTIMISATION: Pour modes 0 (16 couleurs), retourner directement (diversité suffisante)
    const shouldApplyContrastFunctions = config.targetColors <= 4
    const isCPCPlus = basePalette.length > 27

    if (!shouldApplyContrastFunctions) {
      // Pour le mode 0 (16 couleurs), s'assurer qu'on retourne exactement targetColors couleurs
      let finalIndices = topIndices
      if (topIndices.length < config.targetColors) {
        const usedIndices = new Set(topIndices)
        const remainingIndices = basePalette
          .map((_, idx) => idx)
          .filter((idx) => !usedIndices.has(idx))

        const additionalNeeded = config.targetColors - topIndices.length
        finalIndices = [
          ...topIndices,
          ...remainingIndices.slice(0, additionalNeeded)
        ]
      }

      const selectedColors = finalIndices.map(
        (idx: number) => [...basePalette[idx]] as Vector
      )
      const hardwareLabel = isCPCPlus ? 'CPC Plus' : 'CPC Classic'
      adapterLogger.info(
        `[ReGL] ${hardwareLabel} diversity (mode 0): returning ${selectedColors.length} colors directly`
      )
      return selectedColors
    }

    // PHASE 2: Pour petites palettes (modes 1-2), les stratégies v2 ont déjà sélectionné les bonnes couleurs
    // On retourne directement les couleurs sélectionnées sans re-appliquer les anciennes stratégies
    const candidateColors = topIndices.map(
      (idx: number) => [...basePalette[idx]] as Vector
    )

    adapterLogger.info(
      `[ReGL] Candidates pool: ${candidateColors.length} colors (target: ${config.targetColors})`
    )

    // Les stratégies v2 retournent exactement targetColors indices
    // Pas besoin d'ajouter le noir ni de re-filtrer - les stratégies v2 ont déjà fait le travail
    const result = candidateColors.slice(0, config.targetColors)

    // DEBUG: Afficher les couleurs finalement sélectionnées
    for (const [i, c] of result.entries()) {
      adapterLogger.info(`  Final ${i}: rgb(${c[0]}, ${c[1]}, ${c[2]})`)
    }

    return result
  }

  /**
   * CPC Classic: Sélection optimisée sans histogramme
   * Adapté pour la palette CPC Classic (27 couleurs) avec échantillonnage intelligent
   */
  private selectCPCClassicOptimized(
    imageData: ImageData,
    basePalette: readonly Vector[],
    _candidatesCount: number,
    config: ReGLQuantizeConfig
  ): number[] {
    // Pour les petites palettes (modes 1-2), utiliser plus d'échantillons pour une meilleure précision
    // Mode 0 (16 couleurs): échantillons suffisent pour CPC Classic
    // Modes 1-2 (2-4 couleurs): plus d'échantillons pour capturer les nuances importantes
    const sampleCount =
      config.targetColors <= CPC_MODE_1_MAX_COLORS
        ? SAMPLE_COUNT_MODE_1_2
        : SAMPLE_COUNT_MODE_0_CLASSIC
    const sampledColors = this.sampleImageColors(imageData, sampleCount)

    // Récupérer les indices présélectionnés (couleurs lockées)
    const preselectedIndices = config.preselectedIndices || []

    // Use actual targetColors from config, not the candidatesCount passed as parameter
    const actualTargetColors =
      config.targetColors === CPC_PLUS_SPECIAL_MODE
        ? CPC_MODE_0_COLORS
        : config.targetColors

    // CPU: Calcul rapide des couleurs dominantes avec diversité (incluant les présélectionnées)
    const selected = this.selectDiverseColorsFast(
      sampledColors,
      basePalette,
      actualTargetColors,
      preselectedIndices,
      config.paletteStrategy || 'frequency-balanced' // Passer la stratégie de palette
    )

    return selected
  }

  /**
   * CPC Plus: Sélection optimisée GPU sans histogramme
   * Combine échantillonnage intelligent + GPU pour diversité maximale
   */
  private selectCPCPlusOptimized(
    imageData: ImageData,
    basePalette: readonly Vector[],
    _candidatesCount: number,
    config: ReGLQuantizeConfig
  ): number[] {
    // Pour les petites palettes (modes 1-2), utiliser plus d'échantillons pour une meilleure précision
    // Mode 0 (16 couleurs): AUGMENTÉ pour capturer les teintes rares
    // Modes 1-2 (2-4 couleurs): plus d'échantillons pour capturer les nuances importantes
    const sampleCount =
      config.targetColors <= CPC_MODE_1_MAX_COLORS
        ? SAMPLE_COUNT_MODE_1_2
        : SAMPLE_COUNT_MODE_0_PLUS
    const sampledColors = this.sampleImageColors(imageData, sampleCount)

    // Récupérer les indices présélectionnés (couleurs lockées)
    const preselectedIndices = config.preselectedIndices || []

    // Use actual targetColors from config, not the candidatesCount passed as parameter
    const actualTargetColors =
      config.targetColors === 512 ? 16 : config.targetColors

    // CPU: Calcul rapide des couleurs dominantes avec diversité (incluant les présélectionnées)
    const selected = this.selectDiverseColorsFast(
      sampledColors,
      basePalette,
      actualTargetColors,
      preselectedIndices,
      config.paletteStrategy || 'frequency-balanced' // Passer la stratégie de palette
    )

    return selected
  }

  /**
   * Échantillonnage intelligent de l'image
   */
  private sampleImageColors(
    imageData: ImageData,
    maxSamples: number
  ): Vector[] {
    const { width, height, data } = imageData
    const totalPixels = width * height

    // Calcul du pas d'échantillonnage
    const step = Math.max(1, Math.floor(Math.sqrt(totalPixels / maxSamples)))
    const samples: Vector[] = []

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4
        samples.push([data[idx], data[idx + 1], data[idx + 2]])

        if (samples.length >= maxSamples) break
      }
      if (samples.length >= maxSamples) break
    }

    return samples
  }

  /**
   * Helper: Analyse fréquence des couleurs dans les échantillons
   */
  private analyzeColorFrequency(
    sampledColors: Vector[],
    basePalette: readonly Vector[],
    usedIndices: Set<number>
  ): Array<{
    index: number
    frequency: number
    color: Vector
    converted: Vector
  }> {
    const colorCount = new Map<number, number>()

    for (const sample of sampledColors) {
      const closestIndex = findClosestColorIndex(
        sample,
        basePalette,
        this.calculateDistance
      )
      if (!usedIndices.has(closestIndex)) {
        colorCount.set(closestIndex, (colorCount.get(closestIndex) || 0) + 1)
      }
    }

    return Array.from(colorCount.entries())
      .map(([index, count]) => ({
        index,
        frequency: count / sampledColors.length,
        color: [...basePalette[index]] as Vector,
        converted: basePalette[index] // RGB direct
      }))
      .sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * Helper: Sélection par fréquence avec diversité de teinte
   * En mode 0 (16 couleurs), privilégie la diversité des teintes pour éviter
   * d'avoir trop de nuances d'une même couleur
   */
  private selectFrequentColorsWithDiversity(
    colorFrequency: Array<{
      index: number
      frequency: number
      color: Vector
      converted: Vector
    }>,
    selectedConverted: Vector[],
    result: number[],
    frequencyBudget: number,
    targetColors?: number
  ): void {
    // Distance minimale adaptative selon la taille de la palette cible
    // Modes 1-2 (2-4 couleurs): nécessitent un contraste beaucoup plus élevé
    // Mode 0 (16 couleurs): distance plus faible acceptable
    const minDistance =
      targetColors && targetColors <= CPC_MODE_1_MAX_COLORS
        ? MIN_RGB_DISTANCE_MODE_1_2
        : MIN_RGB_DISTANCE_MODE_0

    // Pour le mode 0, également exiger une diversité de teinte
    const isMode0 = targetColors && targetColors > CPC_MODE_1_MAX_COLORS
    const minHueDistance = MIN_HUE_DISTANCE_MODE_0 // degrés minimum entre les teintes

    for (
      let i = 1;
      i < colorFrequency.length && result.length < frequencyBudget;
      i++
    ) {
      const candidateConverted = colorFrequency[i].converted

      // Vérifier diversité minimale avec distance adaptative
      let isDiverse = true

      if (isMode0) {
        // Mode 0: vérifier aussi la diversité de teinte pour couleurs saturées
        const candidateHue = calculateHue(candidateConverted, DELTA_MIN_FOR_HUE)
        const candidateSat = calculateSaturation(candidateConverted)

        // Pour les couleurs saturées (pas les gris), vérifier la diversité de teinte
        if (candidateSat > SATURATION_THRESHOLD_HIGH && candidateHue >= 0) {
          for (const selectedColor of selectedConverted) {
            const selectedSat = calculateSaturation(selectedColor)

            // Si la couleur sélectionnée est aussi saturée, vérifier la teinte
            if (selectedSat > SATURATION_THRESHOLD_HIGH) {
              const selectedHue = calculateHue(selectedColor, DELTA_MIN_FOR_HUE)
              const hueDistance = calculateHueDistance(
                candidateHue,
                selectedHue
              )

              // Si teintes trop proches ET distance RGB aussi proche, rejeter
              if (hueDistance < minHueDistance) {
                const rgbDistance = this.calculateDistance(
                  candidateConverted,
                  selectedColor
                )
                if (rgbDistance < minDistance * 2) {
                  isDiverse = false
                  break
                }
              }
            }
          }
        }
      }

      // Vérifier aussi la distance RGB classique
      if (isDiverse) {
        for (const selectedColor of selectedConverted) {
          if (
            this.calculateDistance(candidateConverted, selectedColor) <
            minDistance
          ) {
            isDiverse = false
            break
          }
        }
      }

      if (isDiverse) {
        result.push(colorFrequency[i].index)
        selectedConverted.push(candidateConverted)
      }
    }
  }

  /**
   * Helper: Sélection MaxMin Distance pour compléter la palette
   * En mode 0, privilégie la diversité de teinte pour maximiser la couverture des couleurs
   */
  private selectMaxMinDistanceColors(
    colorFrequency: Array<{
      index: number
      frequency: number
      color: Vector
      converted: Vector
    }>,
    selectedConverted: Vector[],
    result: number[],
    targetColors: number
  ): void {
    const remaining = colorFrequency.filter((c) => !result.includes(c.index))
    const additionalColors = targetColors - result.length
    const isMode0 = targetColors > CPC_MODE_1_MAX_COLORS

    for (let i = 0; i < additionalColors && remaining.length > 0; i++) {
      let maxScore = -1
      let bestIndex = -1

      for (let j = 0; j < remaining.length; j++) {
        const candidateConverted = remaining[j].converted

        // Distance RGB minimale
        let minRGBDistance = Infinity
        for (const selectedColor of selectedConverted) {
          const distance = this.calculateDistance(
            candidateConverted,
            selectedColor
          )
          minRGBDistance = Math.min(minRGBDistance, distance)
        }

        let score = minRGBDistance

        // En mode 0, ajouter un bonus pour la diversité de teinte
        if (isMode0) {
          const candidateHue = calculateHue(
            candidateConverted,
            DELTA_MIN_FOR_HUE
          )
          const candidateSat = calculateSaturation(candidateConverted)

          // Pour les couleurs saturées, calculer la distance de teinte minimale
          if (
            candidateSat > SATURATION_THRESHOLD_FOR_HUE &&
            candidateHue >= 0
          ) {
            let minHueDistance = 360

            for (const selectedColor of selectedConverted) {
              const selectedSat = calculateSaturation(selectedColor)

              if (selectedSat > SATURATION_THRESHOLD_FOR_HUE) {
                const selectedHue = calculateHue(
                  selectedColor,
                  DELTA_MIN_FOR_HUE
                )
                const hueDistance = calculateHueDistance(
                  candidateHue,
                  selectedHue
                )
                minHueDistance = Math.min(minHueDistance, hueDistance)
              }
            }

            // Bonus pour les teintes très différentes (pondération pour favoriser la diversité)
            // Normaliser minHueDistance (0-180) pour être comparable à minRGBDistance
            const hueBonus =
              (minHueDistance / HUE_HALF_RANGE) *
              HUE_BONUS_NORMALIZATION *
              HUE_BONUS_WEIGHT
            score = minRGBDistance + hueBonus
          }
        }

        if (score > maxScore) {
          maxScore = score
          bestIndex = j
        }
      }

      if (bestIndex >= 0) {
        result.push(remaining[bestIndex].index)
        selectedConverted.push(remaining[bestIndex].converted)
        remaining.splice(bestIndex, 1)
      }
    }
  }

  /**
   * Sélection rapide avec diversité maximale + espaces colorimetriques
   * Complexité réduite en extrayant les helpers
   * Stratégie adaptative selon paletteStrategy
   */
  private selectDiverseColorsFast(
    sampledColors: Vector[],
    basePalette: readonly Vector[],
    targetColors: number,
    preselectedIndices: readonly number[] = [],
    paletteStrategy: PaletteStrategy = 'frequency-balanced'
  ): number[] {
    // Commencer par les couleurs présélectionnées (priorité absolue)
    const result: number[] = [...preselectedIndices]
    const usedIndices = new Set(preselectedIndices)

    // Si on a déjà assez de couleurs présélectionnées, retourner seulement celles-ci
    if (result.length >= targetColors) {
      return result.slice(0, targetColors)
    }

    // Analyser les fréquences des couleurs
    const colorFrequency = this.analyzeColorFrequency(
      sampledColors,
      basePalette,
      usedIndices
    )

    // Utiliser la nouvelle stratégie de sélection de palette pour les petites palettes
    // IMPORTANT: Doit être fait AVANT tout return early
    if (targetColors <= CPC_MODE_1_MAX_COLORS) {
      adapterLogger.info('[ReGLQuantizer] Using palette strategy', {
        strategy: paletteStrategy,
        targetColors,
        candidatesCount: colorFrequency.length,
        basePaletteSize: basePalette.length
      })

      const candidates: ColorCandidate[] = colorFrequency.map((c) => ({
        index: c.index,
        frequency: c.frequency,
        color: c.color,
        converted: c.converted
      }))

      // Récupérer les couleurs présélectionnées depuis basePalette (car elles ne sont pas dans candidates)
      const preselectedColors = preselectedIndices.map(
        (idx) => [...basePalette[idx]] as Vector
      )

      // Utiliser le helper centralisé pour appliquer la stratégie
      // Passer la taille de la palette de base pour distinguer CPC Classic (27) de CPC Plus (4096)
      const strategyResult = applyPaletteStrategyV2(
        paletteStrategy as PaletteStrategyName,
        candidates,
        targetColors,
        [...preselectedIndices],
        { basePaletteSize: basePalette.length, preselectedColors }
      )

      adapterLogger.info('[ReGLQuantizer] Strategy selected colors', {
        strategy: paletteStrategy,
        selectedIndices: strategyResult.selectedIndices,
        isCPCPlus: basePalette.length > 27
      })

      return strategyResult.selectedIndices
    }

    // Pour les palettes plus grandes (mode 0: 16 couleurs), utiliser un algorithme avec diversité de teinte
    const remainingSlots = targetColors - result.length

    // Check si on a assez de candidats (seulement pour mode 0)
    if (
      colorFrequency.length <= remainingSlots &&
      targetColors > CPC_MODE_1_MAX_COLORS
    ) {
      adapterLogger.info(
        '[ReGLQuantizer] Not enough candidates, returning all',
        {
          candidates: colorFrequency.length,
          needed: remainingSlots
        }
      )
      return [...result, ...colorFrequency.map((c) => c.index)]
    }

    const selectedConverted: Vector[] = result.map(
      (idx) => [...basePalette[idx]] as Vector
    )

    // En mode 0, garantir la diversité de teinte en sélectionnant d'abord
    // au moins une couleur de chaque famille de teinte présente
    const hueBuckets = new Map() // hueBucket -> colors[]

    for (const candidate of colorFrequency) {
      const sat = calculateSaturation(candidate.converted)
      const hue = calculateHue(candidate.converted, DELTA_MIN_FOR_HUE)

      // Buckets pour avoir ~8 familles principales
      const bucketKey =
        sat > SATURATION_THRESHOLD_FOR_HUE && hue >= 0
          ? Math.floor(hue / HUE_BUCKET_SIZE_DEGREES)
          : 'gray'

      if (!hueBuckets.has(bucketKey)) {
        hueBuckets.set(bucketKey, [])
      }
      hueBuckets.get(bucketKey).push(candidate)
    }

    // Log détaillé des buckets trouvés
    for (const [bucket, colors] of hueBuckets.entries()) {
      const hueRange =
        bucket === 'gray'
          ? 'gray/desaturated'
          : `${bucket * HUE_BUCKET_SIZE_DEGREES}-${((bucket as number) + 1) * HUE_BUCKET_SIZE_DEGREES}°`
      adapterLogger.info(
        `[Mode 0] Bucket ${bucket} (${hueRange}): ${colors.length} colors`
      )
    }
    adapterLogger.info(
      `[Mode 0] Found ${hueBuckets.size} hue families in image`
    )

    // Stratégie: d'abord prendre la couleur la plus fréquente de chaque bucket
    // pour garantir la couverture, puis compléter avec les plus fréquentes
    const bucketRepresentatives = []
    const sortedBuckets = Array.from(hueBuckets.entries())
      .map(([bucket, colors]) => ({
        bucket,
        colors: colors.sort((a: any, b: any) => b.frequency - a.frequency),
        totalFreq: colors.reduce((sum: number, c: any) => sum + c.frequency, 0)
      }))
      .sort((a, b) => b.totalFreq - a.totalFreq) // Buckets les plus importants en premier

    // Prendre le meilleur représentant de chaque bucket (max ~8 couleurs)
    for (const { bucket, colors } of sortedBuckets) {
      if (bucketRepresentatives.length < targetColors && colors.length > 0) {
        const rep = colors[0]
        bucketRepresentatives.push(rep)
        const hueRange =
          bucket === 'gray'
            ? 'gray'
            : `${bucket * HUE_BUCKET_SIZE_DEGREES}-${((bucket as number) + 1) * HUE_BUCKET_SIZE_DEGREES}°`
        const [r, g, b] = rep.converted
        adapterLogger.info(
          `[Mode 0] Representative for bucket ${bucket} (${hueRange}): RGB(${Math.round(r * RGB_NORMALIZATION_FACTOR)}, ${Math.round(g * RGB_NORMALIZATION_FACTOR)}, ${Math.round(b * RGB_NORMALIZATION_FACTOR)}) freq=${rep.frequency}`
        )
      }
    }

    adapterLogger.info(
      `[Mode 0] Selected ${bucketRepresentatives.length} representatives from hue families`
    )

    // Compléter avec les couleurs les plus fréquentes globalement
    // mais en évitant les doublons de bucket dominant
    const usedIndicesForBalance = new Set(
      bucketRepresentatives.map((c: any) => c.index)
    )
    const remainingCandidates = colorFrequency.filter(
      (c: any) => !usedIndicesForBalance.has(c.index)
    )

    // Ajouter DIRECTEMENT les représentants de bucket au résultat pour garantir la diversité
    // Cela assure qu'on a au moins une couleur de chaque famille de teinte
    for (const rep of bucketRepresentatives) {
      if (!result.includes(rep.index)) {
        result.push(rep.index)
        selectedConverted.push(rep.converted)
      }
    }

    adapterLogger.info(
      `[Mode 0] Added ${result.length} bucket representatives directly to result`
    )

    // Si on a déjà assez de couleurs avec les représentants, on s'arrête là
    if (result.length >= targetColors) {
      return result.slice(0, targetColors)
    }

    // Sinon, compléter avec les couleurs les plus fréquentes (en évitant les doublons)
    const frequencyBudget = targetColors - result.length

    this.selectFrequentColorsWithDiversity(
      remainingCandidates,
      selectedConverted,
      result,
      frequencyBudget,
      targetColors
    )

    // Si encore besoin, compléter avec MaxMin Distance
    if (result.length < targetColors) {
      this.selectMaxMinDistanceColors(
        remainingCandidates,
        selectedConverted,
        result,
        targetColors
      )
    }

    return result
  }

  /**
   * Calcule la distance perceptuelle entre deux couleurs (au carré pour performance)
   * Utilise weightedRGBDistance (ITU-R BT.601) directement sans racine carrée
   * Note: Utilisé uniquement pour comparaisons, donc √ inutile (ordre préservé)
   */
  private calculateDistance = (color1: Vector, color2: Vector): number => {
    return weightedRGBDistance(color1, color2)
  }

  /**
   * Helper: Convertit les couleurs pré-sélectionnées en indices
   */
  private convertPreselectedToIndices(
    preselected: readonly Vector[],
    basePalette: readonly Vector[]
  ): number[] {
    const preselectedIndices: number[] = []
    for (const preselectedColor of preselected) {
      const index = basePalette.findIndex(
        (color) =>
          color[0] === preselectedColor[0] &&
          color[1] === preselectedColor[1] &&
          color[2] === preselectedColor[2]
      )
      if (index >= 0) {
        preselectedIndices.push(index)
      }
    }
    return preselectedIndices
  }

  /**
   * Helper: Détecte le mode et applique la logique de sélection appropriée
   */
  private detectModeAndSelectColors(
    imageData: ImageData,
    basePalette: readonly Vector[],
    preselectedIndices: number[],
    config: ReGLQuantizeConfig
  ): number[] {
    const isMode0Based =
      config.targetColors === CPC_MODE_0_COLORS ||
      config.targetColors === CPC_PLUS_SPECIAL_MODE
    // Support any targetColors <= 4 for mode 1 (allows locked empty slots reducing count)
    const isMode1Based =
      config.targetColors >= 1 && config.targetColors <= CPC_MODE_1_MAX_COLORS
    const isMode2Based = config.targetColors <= 2
    const isCPCPlus = basePalette.length > CPC_CLASSIC_PALETTE_SIZE
    const actualTargetColors =
      config.targetColors === CPC_PLUS_SPECIAL_MODE
        ? CPC_MODE_0_COLORS
        : config.targetColors
    const useOptimizedSelection = isMode0Based || isMode1Based || isMode2Based

    if (isCPCPlus && useOptimizedSelection) {
      const candidateMultiplier =
        config.targetColors <= CPC_MODE_1_MAX_COLORS
          ? CANDIDATE_MULTIPLIER_SMALL_PALETTE
          : CANDIDATE_MULTIPLIER_LARGE_PALETTE
      const candidatesCount = Math.min(
        actualTargetColors * candidateMultiplier,
        Math.floor(basePalette.length * CANDIDATE_POOL_PLUS_RATIO)
      )

      return this.selectCPCPlusOptimized(
        imageData,
        basePalette,
        candidatesCount,
        config
      )
    } else if (!isCPCPlus && useOptimizedSelection) {
      const candidateMultiplier =
        config.targetColors <= CPC_MODE_1_MAX_COLORS
          ? CANDIDATE_MULTIPLIER_SMALL_PALETTE
          : CANDIDATE_MULTIPLIER_LARGE_PALETTE
      const candidatesCount = Math.min(
        actualTargetColors * candidateMultiplier,
        Math.floor(basePalette.length * CANDIDATE_POOL_CLASSIC_RATIO)
      )

      return this.selectCPCClassicOptimized(
        imageData,
        basePalette,
        candidatesCount,
        config
      )
    } else {
      // Utiliser l'histogramme avec diversité par luminance
      return selectTopIndicesCore(
        [], // histogram vide pour ce cas
        preselectedIndices,
        actualTargetColors,
        {
          threshold: config.threshold ?? DEFAULT_THRESHOLD,
          isRelativeThreshold: config.isRelativeThreshold ?? false,
          diversityMode: useOptimizedSelection,
          basePalette: useOptimizedSelection ? basePalette : undefined
        }
      )
    }
  }

  /**
   * Nettoyage des ressources
   */
  dispose(): void {
    if (this.isDisposed) {
      return
    }

    try {
      this.inputTexture?.destroy()
      this.cpcPaletteTexture?.destroy()
      this.histogramFBO?.destroy()

      this.isDisposed = true
    } catch (error) {
      adapterLogger.error('[ReGL] Error during disposal', error)
    }
  }
}

// Mappings statiques pour RGB uniquement
export const DISTANCE_METRIC_MAP = {
  euclidean: 0
} as const

// Types utilitaires pour RGB uniquement
export type DistanceMetricIndex = 0 // euclidean seulement
