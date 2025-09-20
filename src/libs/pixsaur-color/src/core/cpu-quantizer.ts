/**
 * 🖥️ CPU Quantizer - Implémentation CPU basée sur QuantizerBase
 * 
 * Utilise la logique commune factorisée pour éliminer la duplication
 * et garantir la cohérence avec les autres quantizers.
 */

import { QuantizerBase, type QuantizeParams, type QuantizeResult } from './quantizer-base'
import { createQuantizer, extractBuffer, type QuantizeConfig } from '../quant/quantize'

/**
 * Implémentation CPU du quantizer utilisant l'algorithme existant
 * mais avec la nouvelle architecture DRY
 */
export class CPUQuantizer extends QuantizerBase {
  protected getQuantizerType(): string {
    return 'CPU'
  }

  async quantize(
    imageData: ImageData,
    params: QuantizeParams
  ): Promise<QuantizeResult> {
    const perf = this.logPerformanceStart('CPU quantization')
    
    try {
      // Validation commune
      this.validateParams(params)

      // Configuration pour l'ancien API
      const quantConfig: QuantizeConfig = {
        colorSpace: params.colorSpace,
        distanceMetric: 'euclidean',
        contrastStrategy: params.contrastStrategy
      }

      // Préparer les couleurs présélectionnées
      const preselectedColors = params.preselectedIndices.map(idx => 
        [...params.basePalette[idx]] as const
      )

      // Créer le quantizer avec l'API existante
      const quantizer = createQuantizer({
        buf: extractBuffer(imageData),
        basePalette: params.basePalette.map(color => [...color] as const),
        preselected: preselectedColors,
        quantConfig
      })

      // Quantification
      const selectedColors = quantizer.quantize(params.targetColors)

      // Créer des indices factices (l'ancien API ne les retourne pas)
      const indices = selectedColors.map(color => {
        return params.basePalette.findIndex(baseColor =>
          baseColor[0] === color[0] &&
          baseColor[1] === color[1] &&
          baseColor[2] === color[2]
        )
      }).filter(idx => idx >= 0)

      // Conversion au format unifié
      const quantizeResult: QuantizeResult = {
        selectedColors: selectedColors.map(color => [...color]),
        indices,
        histogram: undefined // L'ancien API ne retourne pas l'histogramme
      }

      // Validation du résultat
      this.validateResult(quantizeResult, params)

      perf.end()
      return quantizeResult

    } catch (error) {
      perf.end()
      console.error(`❌ [CPU] Quantization failed:`, error)
      throw error
    }
  }

  /**
   * Version synchrone pour compatibilité
   */
  quantizeSync(
    imageData: ImageData,
    params: QuantizeParams
  ): QuantizeResult {
    this.validateParams(params)

    const quantConfig: QuantizeConfig = {
      colorSpace: params.colorSpace,
      distanceMetric: 'euclidean',
      contrastStrategy: params.contrastStrategy
    }

    const preselectedColors = params.preselectedIndices.map(idx => 
      [...params.basePalette[idx]] as const
    )

    const quantizer = createQuantizer({
      buf: extractBuffer(imageData),
      basePalette: params.basePalette.map(color => [...color] as const),
      preselected: preselectedColors,
      quantConfig
    })

    const selectedColors = quantizer.quantize(params.targetColors)

    const indices = selectedColors.map(color => {
      return params.basePalette.findIndex(baseColor =>
        baseColor[0] === color[0] &&
        baseColor[1] === color[1] &&
        baseColor[2] === color[2]
      )
    }).filter(idx => idx >= 0)

    const quantizeResult: QuantizeResult = {
      selectedColors: selectedColors.map(color => [...color]),
      indices,
      histogram: undefined
    }

    this.validateResult(quantizeResult, params)
    return quantizeResult
  }
}

/**
 * 🏭 Factory function pour créer un CPUQuantizer
 */
export function createCPUQuantizer(): CPUQuantizer {
  return new CPUQuantizer({
    enableGPUAcceleration: false,
    fallbackToCPU: true,
    cacheResults: true,
    logPerformance: true
  })
}