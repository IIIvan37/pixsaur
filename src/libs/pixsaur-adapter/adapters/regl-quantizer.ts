/**
 * ReGL Quantizer pour l'accélération GPU de la quantification de palette
 *
 * Réutilise tous les types et algorithmes existants de pixsaur-color pour maintenir
 * la cohérence architecturale et éviter la duplication de code.
 *
 * Phase 1: Infrastructure de base avec fallback CPU automatique
 */

import type REGL from 'regl'
import { adapterLogger } from '@/core'
import { weightedRGBDistance } from '@/libs/pixsaur-color/src/metric/distance'
import { findClosestColorIndex } from '@/libs/pixsaur-color/src/metric/find-closest'
import {
  clearColorMapping,
  setColorMapping
} from '@/libs/pixsaur-color/src/quant/color-mapping-cache'
import {
  addBucketRepresentativesWithDistanceCheck,
  type ColorDiversityParams,
  type ColorFrequencyItem,
  createHueBuckets,
  getColorDiversityParams,
  selectBucketRepresentativesWithLightness,
  selectFrequentColorsWithDiversity,
  selectMaxMinDistanceColors,
  sortBucketsByFrequency
} from '@/libs/pixsaur-color/src/quant/mode0-hue-diversity'
import {
  applyPaletteStrategyV2,
  type ColorCandidate,
  convertPreselectedToIndices,
  type PaletteStrategyName
} from '@/libs/pixsaur-color/src/quant/palette-strategies-v2'
import type { QuantizeConfig } from '@/libs/pixsaur-color/src/quant/quantize'
import { selectTopIndicesCore } from '@/libs/pixsaur-color/src/quant/select-to-indices'
import type { PaletteStrategy } from '@/libs/pixsaur-color/src/quant/strategy-names'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  countUniqueColors,
  extractUniqueColors
} from '@/libs/pixsaur-color/src/utils/count-unique-colors'
import { getCPCPlusPaletteIndex } from '@/libs/pixsaur-color/src/utils/cpc-plus'
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
const SAMPLE_COUNT_MODE_0_PLUS = 4096 // Échantillons augmentés pour mode 0 CPC Plus (teintes rares)
const SAMPLE_COUNT_MODE_1_2 = 1024 // Échantillons pour modes 1-2 (petites palettes)

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

  /** Auto distinct-mapping for low-color retro images (default: true) */
  readonly autoDistinctMapping?: boolean

  /** Color diversity level for CPC Plus Mode 0 (0-100, default: 50) */
  readonly colorDiversity?: number

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
      // Effacer le mapping précédent avant de commencer
      clearColorMapping()

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
    const preselectedIndices = convertPreselectedToIndices(
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
    // Récupérer les indices présélectionnés (couleurs lockées)
    const preselectedIndices = config.preselectedIndices || []

    // Use actual targetColors from config, not the candidatesCount passed as parameter
    const actualTargetColors =
      config.targetColors === CPC_PLUS_SPECIAL_MODE
        ? CPC_MODE_0_COLORS
        : config.targetColors

    // Détection image "low-color" (ex: C64, ZX Spectrum) pour CPC Classic Mode 0 uniquement
    // Si l'image source a ≤16 couleurs uniques ET autoDistinctMapping est activé,
    // utiliser distinct-mapping pour préserver le maximum de couleurs distinctes
    // Note: Cette logique ne s'applique qu'en mode 0 (16 couleurs), pas en modes 1-2
    const isMode0 = actualTargetColors > CPC_MODE_1_MAX_COLORS
    const autoDistinctMapping = isMode0 && config.autoDistinctMapping === true // Doit être explicitement activé
    const uniqueColorCount = autoDistinctMapping
      ? countUniqueColors(imageData.data, 16)
      : 17 // Skip detection if disabled or not mode 0
    const isLowColorImage = uniqueColorCount <= 16

    // Choisir la stratégie appropriée
    let effectiveStrategy: PaletteStrategyName = (config.paletteStrategy ||
      'frequency-balanced') as PaletteStrategyName

    // Pour les images low-color, extraire TOUTES les couleurs uniques au lieu d'utiliser le sampling
    // Ceci garantit que toutes les couleurs source sont passées à la stratégie distinct-mapping
    let sampledColors: Vector[]
    if (
      isLowColorImage &&
      actualTargetColors > CPC_MODE_1_MAX_COLORS &&
      autoDistinctMapping
    ) {
      // Image retro avec peu de couleurs: maximiser les couleurs distinctes
      effectiveStrategy = 'distinct-mapping'
      // Extraire TOUTES les couleurs uniques (pas de sampling)
      sampledColors = extractUniqueColors(imageData.data, 32) as Vector[]
      adapterLogger.info(
        `[ReGL] Low-color image detected (${uniqueColorCount} colors), extracted ${sampledColors.length} unique colors, using distinct-mapping strategy`
      )
    } else {
      // Pour les petites palettes (modes 1-2), utiliser plus d'échantillons pour une meilleure précision
      // Mode 0 (16 couleurs): échantillons suffisent pour CPC Classic
      // Modes 1-2 (2-4 couleurs): plus d'échantillons pour capturer les nuances importantes
      const sampleCount =
        config.targetColors <= CPC_MODE_1_MAX_COLORS
          ? SAMPLE_COUNT_MODE_1_2
          : SAMPLE_COUNT_MODE_0_CLASSIC
      sampledColors = this.sampleImageColors(imageData, sampleCount)
    }

    // CPU: Calcul rapide des couleurs dominantes avec diversité (incluant les présélectionnées)
    const selected = this.selectDiverseColorsFast(
      sampledColors,
      basePalette,
      actualTargetColors,
      preselectedIndices,
      effectiveStrategy,
      config.colorDiversity ?? 50
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
      config.paletteStrategy || 'frequency-balanced', // Passer la stratégie de palette
      config.colorDiversity ?? 50
    )

    return selected
  }

  /**
   * Échantillonnage intelligent de l'image
   * Combine échantillonnage régulier + capture des couleurs vivides (saturées et claires)
   */
  private sampleImageColors(
    imageData: ImageData,
    maxSamples: number
  ): Vector[] {
    const { width, height, data } = imageData
    const totalPixels = width * height

    // Réserver 10% des échantillons pour les couleurs vivides
    const vividSampleBudget = Math.floor(maxSamples * 0.1)
    const regularSampleBudget = maxSamples - vividSampleBudget

    // Phase 1: Échantillonnage régulier
    const step = Math.max(
      1,
      Math.floor(Math.sqrt(totalPixels / regularSampleBudget))
    )
    const samples: Vector[] = []
    const vividCandidates: Array<{ color: Vector; score: number }> = []

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]
        const color: Vector = [r, g, b]

        samples.push(color)

        // Calculer un score de "vividité" (saturation * luminosité)
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const delta = max - min
        const saturation = max === 0 ? 0 : delta / max
        const value = max / 255

        // Score élevé = couleur vive (saturée ET claire)
        const vividScore = saturation * value

        if (vividScore > 0.4) {
          vividCandidates.push({ color, score: vividScore })
        }

        if (samples.length >= regularSampleBudget) break
      }
      if (samples.length >= regularSampleBudget) break
    }

    // Phase 2: Ajouter les couleurs les plus vivides (si pas déjà dans samples)
    // Trier par score décroissant et prendre les meilleures
    vividCandidates.sort((a, b) => b.score - a.score)

    const addedVivid = new Set<string>()
    for (const { color } of vividCandidates) {
      if (addedVivid.size >= vividSampleBudget) break

      const key = `${color[0]},${color[1]},${color[2]}`
      if (!addedVivid.has(key)) {
        samples.push(color)
        addedVivid.add(key)
      }
    }

    adapterLogger.info(
      `[Sampling] ${samples.length} samples (${regularSampleBudget} regular + ${addedVivid.size} vivid)`
    )

    return samples
  }

  /**
   * Helper: Analyse fréquence des couleurs dans les échantillons
   */
  /**
   * Analyse les fréquences des couleurs dans l'échantillon
   * Optimisé pour CPC Plus avec lookup O(1) au lieu de O(4096)
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

    // CPC Plus: utiliser la lookup table O(1) au lieu de findClosestColorIndex O(4096)
    const isCPCPlus = basePalette.length === 4096

    for (const sample of sampledColors) {
      const sampleArray = Array.isArray(sample) ? sample : Array.from(sample)
      const closestIndex = isCPCPlus
        ? getCPCPlusPaletteIndex(sampleArray)
        : findClosestColorIndex(sample, basePalette, this.calculateDistance)

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

  // NOTE: selectFrequentColorsWithDiversity et selectMaxMinDistanceColors
  // sont dans @/libs/pixsaur-color/src/quant/mode0-hue-diversity

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
    paletteStrategy: PaletteStrategyName = 'frequency-balanced',
    colorDiversity = 50
  ): number[] {
    const startTime = performance.now()
    // Get diversity params from slider value (only affects CPC Plus Mode 0)
    const diversityParams: ColorDiversityParams | undefined =
      basePalette.length > 27 && targetColors > 4
        ? getColorDiversityParams(colorDiversity)
        : undefined

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

    // Pour les images low-color (distinct-mapping), utiliser la stratégie v2 même en mode 0
    // Cela garantit que les couleurs distinctes sont préservées
    const useStrategyForMode0 = paletteStrategy === 'distinct-mapping'

    // Utiliser la nouvelle stratégie de sélection de palette pour les petites palettes
    // OU pour distinct-mapping en mode 0
    // IMPORTANT: Doit être fait AVANT tout return early
    if (targetColors <= CPC_MODE_1_MAX_COLORS || useStrategyForMode0) {
      // Pour distinct-mapping: créer un candidat par couleur SOURCE unique
      // (pas par couleur CPC mappée) pour éviter la fusion prématurée
      let candidates: ColorCandidate[]

      if (useStrategyForMode0) {
        // Créer un candidat pour chaque couleur source unique
        // Chaque candidat garde sa couleur originale + son mapping CPC
        candidates = sampledColors.map((sourceColor) => {
          const closestCPCIndex = findClosestColorIndex(
            sourceColor,
            basePalette,
            this.calculateDistance
          )
          return {
            index: closestCPCIndex,
            frequency: 1 / sampledColors.length, // Fréquence uniforme pour low-color
            color: [...sourceColor] as Vector, // Couleur SOURCE originale
            converted: [...basePalette[closestCPCIndex]] as Vector // Mapping CPC
          }
        })

        adapterLogger.info('[ReGLQuantizer] Using palette strategy', {
          strategy: paletteStrategy,
          targetColors,
          candidatesCount: candidates.length,
          basePaletteSize: basePalette.length,
          note: 'Using source colors (not merged CPC)'
        })
      } else {
        candidates = colorFrequency.map((c) => ({
          index: c.index,
          frequency: c.frequency,
          color: c.color,
          converted: c.converted
        }))

        adapterLogger.info('[ReGLQuantizer] Using palette strategy', {
          strategy: paletteStrategy,
          targetColors,
          candidatesCount: candidates.length,
          basePaletteSize: basePalette.length
        })
      }

      // Récupérer les couleurs présélectionnées depuis basePalette (car elles ne sont pas dans candidates)
      const preselectedColors = preselectedIndices.map(
        (idx) => [...basePalette[idx]] as Vector
      )

      // Utiliser le helper centralisé pour appliquer la stratégie
      // Passer la taille de la palette de base pour distinguer CPC Classic (27) de CPC Plus (4096)
      // Pour distinct-mapping, passer aussi la palette complète pour trouver des alternatives
      const strategyResult = applyPaletteStrategyV2(
        paletteStrategy,
        candidates,
        targetColors,
        [...preselectedIndices],
        {
          basePaletteSize: basePalette.length,
          preselectedColors,
          basePalette:
            paletteStrategy === 'distinct-mapping' ? basePalette : undefined
        }
      )

      // Stocker le mapping couleur source → index palette pour le dithering
      if (
        paletteStrategy === 'distinct-mapping' &&
        strategyResult.colorMapping
      ) {
        setColorMapping(strategyResult.colorMapping)
        adapterLogger.info('[ReGLQuantizer] Color mapping stored', {
          mappingSize: strategyResult.colorMapping.size
        })
      } else {
        // Effacer le mapping si on n'utilise pas distinct-mapping
        clearColorMapping()
      }

      adapterLogger.info('[ReGLQuantizer] Strategy selected colors', {
        strategy: paletteStrategy,
        selectedIndices: strategyResult.selectedIndices,
        isCPCPlus: basePalette.length > 27
      })

      return strategyResult.selectedIndices
    }

    // Si on n'utilise pas de stratégie spéciale, effacer le mapping
    clearColorMapping()

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

    // Utiliser les helpers pour créer et trier les buckets de teinte
    const hueBuckets = createHueBuckets(
      colorFrequency as ColorFrequencyItem[],
      diversityParams
    )

    // Trier les buckets par fréquence
    const sortedBuckets = sortBucketsByFrequency(hueBuckets)

    // Stratégie: prendre le meilleur représentant de chaque bucket
    // AVEC diversité de luminosité (éviter que tous les représentants soient sombres)
    const bucketRepresentatives = selectBucketRepresentativesWithLightness(
      sortedBuckets,
      targetColors
    )

    // Compléter avec les couleurs les plus fréquentes globalement
    // mais en évitant les doublons de bucket dominant
    const usedIndicesForBalance = new Set(
      bucketRepresentatives.map((c) => c.index)
    )
    const remainingCandidates = colorFrequency.filter(
      (c) => !usedIndicesForBalance.has(c.index)
    ) as ColorFrequencyItem[]

    // Ajouter les représentants de bucket au résultat AVEC vérification de distance RGB et teinte
    addBucketRepresentativesWithDistanceCheck(
      bucketRepresentatives,
      sortedBuckets,
      result,
      selectedConverted,
      this.calculateDistance
    )

    // Si on a déjà assez de couleurs avec les représentants, on s'arrête là
    if (result.length >= targetColors) {
      return result.slice(0, targetColors)
    }

    // Sinon, compléter avec les couleurs les plus fréquentes (en évitant les doublons)
    const frequencyBudget = targetColors - result.length

    // Utiliser les helpers extraits
    selectFrequentColorsWithDiversity(
      remainingCandidates,
      selectedConverted,
      result,
      frequencyBudget,
      targetColors,
      this.calculateDistance,
      diversityParams
    )

    // Si encore besoin, compléter avec MaxMin Distance
    if (result.length < targetColors) {
      selectMaxMinDistanceColors(
        remainingCandidates,
        selectedConverted,
        result,
        targetColors,
        this.calculateDistance,
        diversityParams
      )
    }

    const duration = performance.now() - startTime
    adapterLogger.info(
      `[ReGL] Color selection completed in ${duration.toFixed(1)}ms`,
      {
        targetColors,
        selectedCount: result.length,
        strategy: paletteStrategy
      }
    )

    return result
  }

  /**
   * Calcule la distance perceptuelle entre deux couleurs (au carré pour performance)
   * Utilise weightedRGBDistance (ITU-R BT.601) directement sans racine carrée
   * Note: Utilisé uniquement pour comparaisons, donc √ inutile (ordre préservé)
   */
  private readonly calculateDistance = (
    color1: Vector,
    color2: Vector
  ): number => {
    return weightedRGBDistance(color1, color2)
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
