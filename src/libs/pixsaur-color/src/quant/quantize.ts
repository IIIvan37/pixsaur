import { buildWeightedHistogram } from '../histogram'
import { mapAndDither } from '../map'
import {
  type DistanceFn,
  type DistanceMetric,
  getDistanceFn
} from '../metric/distance'
import type { Vector } from '../type'
import {
  applyPaletteStrategyV2,
  type ColorCandidate,
  convertPreselectedToIndices,
  type PaletteStrategyName
} from './palette-strategies-v2'
import { selectTopIndices, selectTopIndicesCore } from './select-to-indices'

export type DitheringMode =
  | 'floydSteinberg'
  | 'bayer2x2'
  | 'bayer4x4'
  | 'bayer8x8'
  | 'atkinson'
  | 'halftone4x4'
  | 'ylioluma1'
  | 'ylioluma2'

export type DitheringConfig = {
  mode: DitheringMode | 'none'
  intensity: number // de 0 (off) à 1 (plein)
}

// Re-export PaletteStrategy type from palette-strategies-v2 for external use
export type PaletteStrategy = PaletteStrategyName

export type QuantizeConfig = {
  distanceMetric: DistanceMetric
  paletteStrategy?: PaletteStrategy
}

/**
 * Transforms an ImageData object into a cloned Uint8ClampedArray buffer.
 */
export function extractBuffer(imageData: ImageData): Uint8ClampedArray {
  return new Uint8ClampedArray(imageData.data)
}

export function bufferToVectors(data: Uint8ClampedArray): Vector<'RGB'>[] {
  const vectors: Vector<'RGB'>[] = []
  for (let i = 0; i < data.length; i += 4) {
    // Ignorer les pixels partiels (moins de 4 octets)
    if (i + 3 < data.length) {
      vectors.push([data[i], data[i + 1], data[i + 2]])
    }
  }
  return vectors
}

type CreateQuantizerInput = {
  buf: Uint8ClampedArray

  basePalette: Vector<'RGB'>[]
  preselected: Vector<'RGB'>[]
  quantConfig: QuantizeConfig
}

export function createQuantizer({
  buf,
  basePalette,
  preselected,
  quantConfig
}: CreateQuantizerInput) {
  const { distanceMetric, paletteStrategy } = quantConfig
  const distFn: DistanceFn = getDistanceFn('RGB', distanceMetric)

  const vecs = bufferToVectors(buf)
  const workingPal = basePalette.map((c) => [...c] as Vector)

  const preIdx = convertPreselectedToIndices(preselected, basePalette)

  const reducePalette = (limit: number): Vector[] => {
    const counts = new Uint32Array(
      buildWeightedHistogram(vecs, workingPal, distFn)
    )

    // Calculate relative threshold based on image size (0.1% of pixels, minimum 1)
    const totalPixels = vecs.length
    const relativeThreshold = Math.max(1, Math.floor(totalPixels * 0.001))

    // OPTIMISATION: Utiliser mode diversité pour les palettes moyennes (mode 0 = 16 couleurs)
    const useDiversityMode = limit >= 8 && limit <= 16

    const idxs = useDiversityMode
      ? selectTopIndicesCore(counts, preIdx, 16, {
          threshold: relativeThreshold,
          diversityMode: true,
          basePalette: workingPal
        })
      : selectTopIndices(counts, preIdx, 16, {
          threshold: relativeThreshold
        })

    const out = idxs.map((i: number) => workingPal[i])

    // Alignement CPU/GPU : utiliser mode0-hue-diversity pour le mode 0 (>4 couleurs)
    // et la stratégie utilisateur pour les modes 1-2 (≤4 couleurs)
    const effectiveStrategy: PaletteStrategyName | undefined =
      limit > 4 ? 'mode0-hue-diversity' : paletteStrategy

    if (effectiveStrategy && limit <= 16) {
      // Construire les candidats avec fréquences à partir de l'histogramme
      const candidates: ColorCandidate[] = idxs.map((idx: number) => ({
        index: idx,
        frequency: counts[idx] / vecs.length,
        color: [...workingPal[idx]] as Vector,
        converted: [...workingPal[idx]] as Vector
      }))

      const strategyResult = applyPaletteStrategyV2(
        effectiveStrategy,
        candidates,
        limit,
        [...preIdx],
        { basePaletteSize: basePalette.length }
      )

      return strategyResult.selectedIndices.map(
        (idx) => [...workingPal[idx]] as Vector
      )
    }

    // Fallback: retourner les couleurs les plus fréquentes
    return out.slice(0, limit)
  }

  return {
    quantize: reducePalette,
    dither(
      data: ImageData,
      reducedPalette: Vector[],
      dithering: DitheringConfig
    ): Uint8ClampedArray {
      return mapAndDither(
        extractBuffer(data),
        data.width,
        data.height,
        reducedPalette,
        dithering,
        'RGB'
      )
    }
  }
}
