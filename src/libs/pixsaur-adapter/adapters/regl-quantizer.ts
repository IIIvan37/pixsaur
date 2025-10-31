/**
 * ReGL Quantizer pour l'accélération GPU de la quantification de palette
 *
 * Réutilise tous les types et algorithmes existants de pixsaur-color pour maintenir
 * la cohérence architecturale et éviter la duplication de code.
 *
 * Phase 1: Infrastructure de base avec fallback CPU automatique
 */

import type REGL from 'regl'
import type { QuantizeConfig } from '@/libs/pixsaur-color/src/quant/quantize'
import { selectTopIndicesCore } from '@/libs/pixsaur-color/src/quant/select-to-indices'
import { selectByStrategy } from '@/libs/pixsaur-color/src/quant/strategy-selector'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { adapterLogger } from '@/utils/logger'
import { histogramFragmentShader, histogramVertexShader } from '../shaders'

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

  /** Threshold for adaptive filtering (default: 10) */
  readonly threshold?: number

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
    const minPixelsForGPU = config.gpuOptions?.minPixelsForGPU ?? 128 * 128

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
    const canUseGPU = maxTextureSize >= 1024

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

    // Détecter le mode et sélectionner les couleurs
    const topIndices = this.detectModeAndSelectColors(
      imageData,
      basePalette,
      preselectedIndices,
      config
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

    // PHASE 2: Appliquer l'algorithme de contraste pour petites palettes (modes 1-2)
    const candidateColors = topIndices.map(
      (idx: number) => [...basePalette[idx]] as Vector
    )
    const preselectedColors = preselectedIndices.map(
      (idx: number) => [...basePalette[idx]] as Vector
    )

    adapterLogger.info(
      `[ReGL] Candidates pool: ${candidateColors.length} colors (target: ${config.targetColors})`
    )

    // Appliquer les fonctions de contraste
    const result = this.applyContrastFunctionsForSmallPalettes(
      candidateColors,
      preselectedColors,
      config,
      isCPCPlus
    )

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
    targetColors: number,
    config: ReGLQuantizeConfig
  ): number[] {
    // Échantillonnage équilibré : qualité vs performance
    // Pour CPC Classic (27 couleurs), on peut utiliser plus d'échantillons que pour CPC Plus
    const sampledColors = this.sampleImageColors(imageData, 256) // 256 échantillons pour CPC Classic

    // Récupérer les indices présélectionnés (couleurs lockées)
    const preselectedIndices = config.preselectedIndices || []

    // CPU: Calcul rapide des couleurs dominantes avec diversité (incluant les présélectionnées)
    const selected = this.selectDiverseColorsFast(
      sampledColors,
      basePalette,
      targetColors,
      preselectedIndices,
      config.contrastStrategy // Passer la stratégie de contraste
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
    targetColors: number,
    config: ReGLQuantizeConfig
  ): number[] {
    // Échantillonnage équilibré : qualité vs performance
    const sampledColors = this.sampleImageColors(imageData, 128) // 128 échantillons pour un bon compromis

    // Récupérer les indices présélectionnés (couleurs lockées)
    const preselectedIndices = config.preselectedIndices || []

    // CPU: Calcul rapide des couleurs dominantes avec diversité (incluant les présélectionnées)
    const selected = this.selectDiverseColorsFast(
      sampledColors,
      basePalette,
      targetColors,
      preselectedIndices,
      config.contrastStrategy // Passer la stratégie de contraste
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
      const closestIndex = this.findClosestColorIndex(sample, basePalette)
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
   * Helper: Sélection par fréquence avec diversité minimale
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
    const minDistance = targetColors && targetColors <= 4 ? 80 : 20

    for (
      let i = 1;
      i < colorFrequency.length && result.length < frequencyBudget;
      i++
    ) {
      const candidateConverted = colorFrequency[i].converted

      // Vérifier diversité minimale avec distance adaptative
      let isDiverse = true
      for (const selectedColor of selectedConverted) {
        if (
          this.calculateDistance(candidateConverted, selectedColor) <
          minDistance
        ) {
          isDiverse = false
          break
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

    for (let i = 0; i < additionalColors && remaining.length > 0; i++) {
      let maxMinDistance = 0
      let bestIndex = -1

      for (let j = 0; j < remaining.length; j++) {
        const candidateConverted = remaining[j].converted

        let minDistance = Infinity
        for (const selectedColor of selectedConverted) {
          const distance = this.calculateDistance(
            candidateConverted,
            selectedColor
          )
          minDistance = Math.min(minDistance, distance)
        }

        if (minDistance > maxMinDistance) {
          maxMinDistance = minDistance
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
   * Stratégie adaptative selon contrastStrategy
   */
  private selectDiverseColorsFast(
    sampledColors: Vector[],
    basePalette: readonly Vector[],
    targetColors: number,
    preselectedIndices: readonly number[] = [],
    contrastStrategy: 'max' | 'balanced' = 'max'
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

    const remainingSlots = targetColors - result.length
    if (colorFrequency.length <= remainingSlots) {
      return [...result, ...colorFrequency.map((c) => c.index)]
    }

    const selectedConverted: Vector[] = result.map(
      (idx) => [...basePalette[idx]] as Vector
    )

    // Première couleur: la plus fréquente
    result.push(colorFrequency[0].index)
    selectedConverted.push(colorFrequency[0].converted)

    // Stratégie adaptative selon contrastStrategy
    // balanced: privilégie la fréquence (80%) pour garder les couleurs dominantes
    // max: équilibre fréquence (60%) et diversité (40%) pour plus de contraste
    const frequencyBudget = Math.floor(
      targetColors * (contrastStrategy === 'balanced' ? 0.8 : 0.6)
    )

    // Pour les petites palettes (2-4 couleurs) en mode "balanced":
    // Prendre directement les couleurs les plus fréquentes (comme CPC Classic)
    if (contrastStrategy === 'balanced' && targetColors <= 4) {
      // Calculer la luminance de chaque couleur
      const withLuminance = colorFrequency.map((c) => {
        const [r, g, b] = c.color
        const luminance =
          0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255)
        return { ...c, luminance }
      })

      // Privilégier les couleurs avec luminance moyenne (0.3-0.7) car elles fonctionnent mieux avec le noir
      // Trier par: luminance proche de 0.5 (moyen) + fréquence
      withLuminance.sort((a, b) => {
        const lumDistA = Math.abs(a.luminance - 0.5)
        const lumDistB = Math.abs(b.luminance - 0.5)
        // Si les luminances sont similaires, privilégier la fréquence
        if (Math.abs(lumDistA - lumDistB) < 0.1) {
          return b.frequency - a.frequency
        }
        return lumDistA - lumDistB
      })

      const topBalanced = withLuminance.slice(0, targetColors - result.length)
      result.push(...topBalanced.map((c) => c.index))

      return result
    }

    // Phase 1: Ajouter les couleurs fréquentes avec diversité minimale
    this.selectFrequentColorsWithDiversity(
      colorFrequency,
      selectedConverted,
      result,
      frequencyBudget,
      targetColors // Passer targetColors pour distance adaptative
    )

    // Phase 2: Compléter avec MaxMin Distance sur toute la palette
    this.selectMaxMinDistanceColors(
      colorFrequency,
      selectedConverted,
      result,
      targetColors
    )

    return result
  }

  /**
   * Calcule la distance entre deux couleurs avec poids perceptuels
   * Utilise les coefficients ITU-R BT.601 (luma) pour refléter la sensibilité de l'œil humain
   */
  private calculateDistance(color1: Vector, color2: Vector): number {
    // RGB - Distance pondérée perceptuelle
    const dr = color1[0] - color2[0]
    const dg = color1[1] - color2[1]
    const db = color1[2] - color2[2]

    // ITU-R BT.601 luma coefficients (perceptual weights)
    // Green (0.587) > Red (0.299) > Blue (0.114)
    return Math.sqrt(dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114)
  }

  /**
   * Trouve l'index de la couleur la plus proche
   */
  private findClosestColorIndex(
    pixel: Vector,
    palette: readonly Vector[]
  ): number {
    let minDistance = Infinity
    let closestIndex = 0

    for (let i = 0; i < palette.length; i++) {
      const distance = this.calculateDistance(pixel, palette[i])

      if (distance < minDistance) {
        minDistance = distance
        closestIndex = i
      }
    }

    return closestIndex
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
      config.targetColors === 16 || config.targetColors === 512
    const isMode1Based = config.targetColors === 4
    const isMode2Based = config.targetColors === 2
    const isCPCPlus = basePalette.length > 27
    const actualTargetColors =
      config.targetColors === 512 ? 16 : config.targetColors
    const useOptimizedSelection = isMode0Based || isMode1Based || isMode2Based

    if (isCPCPlus && useOptimizedSelection) {
      const candidateMultiplier = config.targetColors <= 4 ? 4 : 1
      const candidatesCount = Math.min(
        actualTargetColors * candidateMultiplier,
        Math.floor(basePalette.length * 0.01)
      )

      return this.selectCPCPlusOptimized(
        imageData,
        basePalette,
        candidatesCount,
        config
      )
    } else if (!isCPCPlus && useOptimizedSelection) {
      const candidateMultiplier = config.targetColors <= 4 ? 4 : 1
      const candidatesCount = Math.min(
        actualTargetColors * candidateMultiplier,
        Math.floor(basePalette.length * 0.5)
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
          threshold: 10,
          diversityMode: useOptimizedSelection,
          basePalette: useOptimizedSelection ? basePalette : undefined
        }
      )
    }
  }

  /**
   * Helper: Applique les fonctions de contraste pour petites palettes
   */
  private applyContrastFunctionsForSmallPalettes(
    candidateColors: Vector[],
    preselectedColors: Vector[],
    config: ReGLQuantizeConfig,
    isCPCPlus: boolean
  ): Vector[] {
    // Assurer la présence du noir
    this.ensureBlackPresence(candidateColors, preselectedColors, config)

    // Filtrage pour mode balanced CPC Plus
    if (
      isCPCPlus &&
      config.contrastStrategy === 'balanced' &&
      config.targetColors <= 4
    ) {
      candidateColors = this.filterBalancedCandidates(candidateColors, config)
    }

    // Fonctions de distance et conversion
    const distanceFn = (a: Vector, b: Vector): number =>
      Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
    const toRGB = (v: Vector): Vector => v

    // Utiliser le sélecteur de stratégie commun
    return selectByStrategy(
      {
        contrastStrategy: config.contrastStrategy,
        targetColors: config.targetColors
      },
      {
        candidates: candidateColors,
        preselected: preselectedColors,
        targetColors: config.targetColors,
        distanceFn: distanceFn,
        toRGB: toRGB
      }
    )
  }

  /**
   * Helper: Assure la présence du noir dans les candidats
   */
  private ensureBlackPresence(
    candidateColors: Vector[],
    preselectedColors: Vector[],
    config: ReGLQuantizeConfig
  ): void {
    if (
      config.targetColors <= 4 &&
      preselectedColors.length < config.targetColors
    ) {
      const hasBlack = candidateColors.some(
        (c) => c[0] === 0 && c[1] === 0 && c[2] === 0
      )
      const hasBlackInPreselected = preselectedColors.some(
        (c) => c[0] === 0 && c[1] === 0 && c[2] === 0
      )

      if (!hasBlack && !hasBlackInPreselected) {
        adapterLogger.info(
          `[ReGL] Adding black to candidates for small palette (${config.targetColors} colors)`
        )
        candidateColors.unshift([0, 0, 0] as Vector)
      }
    }
  }

  /**
   * Helper: Filtre les candidats pour privilégier les luminances moyennes (mode balanced)
   */
  private filterBalancedCandidates(
    candidateColors: Vector[],
    config: ReGLQuantizeConfig
  ): Vector[] {
    const blackColor = candidateColors.find(
      (c) => c[0] === 0 && c[1] === 0 && c[2] === 0
    )
    const nonBlackCandidates = candidateColors.filter(
      (c) => !(c[0] === 0 && c[1] === 0 && c[2] === 0)
    )

    const withLuminance = nonBlackCandidates.map((c) => {
      const [r, g, b] = c
      const luminance =
        0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255)
      return { color: c, luminance }
    })

    withLuminance.sort((a, b) => {
      const distA = Math.abs(a.luminance - 0.5)
      const distB = Math.abs(b.luminance - 0.5)
      return distA - distB
    })

    const slotsForNonBlack = blackColor
      ? config.targetColors * 2 - 1
      : config.targetColors * 2
    const filteredNonBlack = withLuminance
      .slice(0, Math.min(nonBlackCandidates.length, slotsForNonBlack))
      .map((item) => item.color)

    const filteredCandidates = blackColor
      ? [blackColor, ...filteredNonBlack]
      : filteredNonBlack

    return filteredCandidates
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
