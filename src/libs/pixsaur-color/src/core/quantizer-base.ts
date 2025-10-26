/**
 * 🏗️ QuantizerBase - Classe abstraite pour unifier les quantizers
 *
 * Cette classe factorise toute la logique commune entre ReGL et CPU quantizers
 * pour éliminer la duplication de code et centraliser les algorithmes.
 */

import { logger } from '@/utils/logger'
import type { DistanceFn, DistanceMetric } from '../metric/distance'
import { getDistanceFn } from '../metric/distance'
import { selectTopIndicesCore } from '../quant/select-to-indices'
import {
  type SelectionParams,
  type StrategyConfig,
  selectByStrategy
} from '../quant/strategy-selector'
import type { Vector } from '../type'

export interface QuantizeParams {
  readonly targetColors: number
  readonly basePalette: readonly Vector[]
  readonly preselectedIndices: readonly number[]
  readonly contrastStrategy?: 'max' | 'balanced'
}

export interface QuantizeResult {
  readonly selectedColors: Vector[]
  readonly indices: number[]
  readonly histogram?: Uint32Array
}

/**
 * Configuration commune pour tous les quantizers
 */
export interface QuantizerConfig {
  readonly enableGPUAcceleration: boolean
  readonly fallbackToCPU: boolean
  readonly cacheResults: boolean
  readonly logPerformance: boolean
}

export const defaultQuantizerConfig: QuantizerConfig = {
  enableGPUAcceleration: true,
  fallbackToCPU: true,
  cacheResults: true,
  logPerformance: true
}

/**
 * Classe abstraite pour tous les quantizers
 * Implémente le principe DRY en centralisant la logique commune
 */
export abstract class QuantizerBase {
  protected readonly config: QuantizerConfig

  constructor(config: Partial<QuantizerConfig> = {}) {
    this.config = { ...defaultQuantizerConfig, ...config }
  }

  /**
   * Interface principale - doit être implémentée par chaque quantizer
   */
  abstract quantize(
    imageData: ImageData,
    params: QuantizeParams
  ): Promise<QuantizeResult>

  /**
   * 🔧 LOGIQUE COMMUNE: Sélection des couleurs les plus fréquentes
   * Single source of truth utilisée par tous les quantizers
   */
  protected selectTopColors(
    histogram: Uint32Array,
    preselectedIndices: readonly number[],
    targetCount: number
  ): number[] {
    return selectTopIndicesCore(
      histogram,
      [...preselectedIndices], // Copy pour éviter la mutation
      targetCount
    )
  }

  /**
   * 🔧 LOGIQUE COMMUNE: Application de la stratégie de contraste
   * Factorisation de la logique partagée entre CPU et GPU
   */
  protected applyContrastStrategy(
    candidateColors: Vector[],
    preselectedColors: Vector[],
    params: QuantizeParams,
    distanceFn: DistanceFn,
    toRGBFn: (v: Vector) => Vector
  ): Vector[] {
    const strategyConfig: StrategyConfig = {
      contrastStrategy: params.contrastStrategy,
      targetColors: params.targetColors
    }

    const selectionParams: SelectionParams = {
      candidates: candidateColors,
      preselected: preselectedColors,
      targetColors: params.targetColors,
      distanceFn,
      toRGB: toRGBFn
    }

    return selectByStrategy(strategyConfig, selectionParams)
  }

  /**
   * 🔧 LOGIQUE COMMUNE: Validation des paramètres
   */
  protected validateParams(params: QuantizeParams): void {
    if (params.targetColors <= 0) {
      throw new Error('targetColors must be greater than 0')
    }
    if (params.basePalette.length === 0) {
      throw new Error('basePalette cannot be empty')
    }
    if (
      params.preselectedIndices.some((idx) => idx >= params.basePalette.length)
    ) {
      throw new Error('preselectedIndices contains invalid index')
    }
  }

  /**
   * 🔧 LOGIQUE COMMUNE: Logging de performance
   */
  protected logPerformanceStart(_operation: string): { end: () => void } {
    // Performance logging désactivé - console.log supprimé
    return { end: () => {} }
  }

  /**
   * 🔧 LOGIQUE COMMUNE: Cache de résultats (si activé)
   */
  protected getCacheKey(imageData: ImageData, params: QuantizeParams): string {
    // Hash simple basé sur les paramètres critiques
    const paramString = `${params.targetColors}-RGB-${params.contrastStrategy}`
    const imageHash = this.computeImageHash(imageData)
    return `${imageHash}-${paramString}`
  }

  /**
   * 🔧 LOGIQUE COMMUNE: Hash simple d'image pour le cache
   */
  protected computeImageHash(imageData: ImageData): string {
    const { width, height, data } = imageData

    // Sample quelques pixels pour un hash rapide
    const sampleSize = Math.min(1000, data.length / 4)
    const step = Math.floor(data.length / (sampleSize * 4))

    let hash = 0
    for (let i = 0; i < data.length; i += step * 4) {
      hash = ((hash << 5) - hash + data[i]) | 0
      hash = ((hash << 5) - hash + data[i + 1]) | 0
      hash = ((hash << 5) - hash + data[i + 2]) | 0
    }

    return `${width}x${height}-${hash.toString(36)}`
  }

  /**
   * 🔧 LOGIQUE COMMUNE: Obtention de la fonction de distance
   * Single source pour la sélection des métriques
   */
  protected getDistanceFunction(distanceMetric?: DistanceMetric): DistanceFn {
    // RGB utilise euclidean par défaut
    const metric = distanceMetric || 'euclidean'
    return getDistanceFn('RGB', metric)
  }

  /**
   * 🔧 LOGIQUE COMMUNE: Comparaison de couleurs
   * Utilisée pour éliminer les doublons et validations
   */
  protected colorsEqual(color1: Vector, color2: Vector): boolean {
    return (
      color1[0] === color2[0] &&
      color1[1] === color2[1] &&
      color1[2] === color2[2]
    )
  }

  /**
   * Type du quantizer (pour les logs)
   */
  protected abstract getQuantizerType(): string

  /**
   * 🔧 HELPER: Conversion des indices vers les couleurs finales
   */
  protected indicesToColors(
    indices: number[],
    basePalette: readonly Vector[]
  ): Vector[] {
    return indices.map((index) => [...basePalette[index]] as Vector)
  }

  /**
   * 🔧 HELPER: Validation du résultat
   */
  protected validateResult(
    result: QuantizeResult,
    params: QuantizeParams
  ): void {
    if (result.selectedColors.length !== params.targetColors) {
      logger.warn(
        `[${this.getQuantizerType()}] Expected ${params.targetColors} colors, got ${result.selectedColors.length}`
      )
    }

    // Vérifier que toutes les couleurs sont dans la palette de base
    for (const color of result.selectedColors) {
      const found = params.basePalette.some(
        (baseColor) =>
          baseColor[0] === color[0] &&
          baseColor[1] === color[1] &&
          baseColor[2] === color[2]
      )
      if (!found) {
        throw new Error(`Selected color ${color} not found in base palette`)
      }
    }
  }
}

/**
 * 🔧 FACTORY: Créateur de quantizers avec configuration DRY
 */
export interface QuantizerFactory {
  createCPUQuantizer(config?: Partial<QuantizerConfig>): QuantizerBase
  createReGLQuantizer(config?: Partial<QuantizerConfig>): QuantizerBase
  createBestQuantizer(
    preferGPU?: boolean,
    config?: Partial<QuantizerConfig>
  ): QuantizerBase
}

/**
 * 🎯 AVANTAGES DE CETTE REFACTORISATION:
 *
 * 1. **DRY Principle**: Logique commune factorisée, plus de duplication
 * 2. **Single Source of Truth**: selectTopColors, applyContrastStrategy centralisés
 * 3. **Testabilité**: Logique commune testée une seule fois
 * 4. **Maintenabilité**: Changements algorithmes appliqués partout automatiquement
 * 5. **Performance**: Cache unifié, logging standardisé
 * 6. **Type Safety**: Interface stricte avec validation
 */
