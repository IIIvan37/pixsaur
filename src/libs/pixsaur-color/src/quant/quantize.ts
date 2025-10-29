import { quantizerLogger } from '../../../../utils/logger'
import { buildWeightedHistogram } from '../histogram'
import { mapAndDither } from '../map'
import {
  type DistanceFn,
  type DistanceMetric,
  getDistanceFn
} from '../metric/distance'
import type { Vector } from '../type'
import { selectTopIndices, selectTopIndicesCore } from './select-to-indices'
import { selectByStrategy } from './strategy-selector'

// Helper functions for debugging CPC colors
function getCPCColorName(color: Vector): string {
  const [r, g, b] = color
  // Simple mapping based on known CPC colors
  if (r === 0 && g === 0 && b === 128) return 'Blue'
  if (r === 0 && g === 0 && b === 255) return 'Bright Blue'
  if (r === 0 && g === 128 && b === 255) return 'Sky Blue'
  if (r === 128 && g === 128 && b === 255) return 'Pastel Blue'
  if (r === 0 && g === 255 && b === 255) return 'Bright Cyan'
  if (r === 128 && g === 255 && b === 255) return 'Pastel Cyan'
  if (r === 255 && g === 0 && b === 0) return 'Bright Red'
  if (r === 128 && g === 0 && b === 0) return 'Red'
  if (r === 255 && g === 0 && b === 128) return 'Purple'
  if (r === 128 && g === 0 && b === 128) return 'Magenta'
  if (r === 255 && g === 0 && b === 255) return 'Bright Magenta'
  if (r === 128 && g === 0 && b === 255) return 'Mauve'
  if (r === 0 && g === 128 && b === 0) return 'Green'
  if (r === 0 && g === 255 && b === 0) return 'Bright Green'
  if (r === 128 && g === 255 && b === 0) return 'Lime'
  if (r === 128 && g === 128 && b === 0) return 'Yellow'
  if (r === 255 && g === 255 && b === 0) return 'Bright Yellow'
  if (r === 255 && g === 128 && b === 0) return 'Orange'
  if (r === 0 && g === 0 && b === 0) return 'Black'
  if (r === 255 && g === 255 && b === 255) return 'Bright White'
  if (r === 128 && g === 128 && b === 128) return 'White'
  return `RGB(${r},${g},${b})`
}

function isBlueColor(color: Vector): boolean {
  const [r, g, b] = color
  // Consider a color blue if blue component is dominant and > 100
  return b > 100 && b >= r && b >= g
}

export type DitheringMode =
  | 'floydSteinberg'
  | 'bayer2x2'
  | 'bayer4x4'
  | 'bayer8x8'
  | 'ylioluma1'
  | 'ylioluma2'

export type DitheringConfig = {
  mode: DitheringMode | 'none'
  intensity: number // de 0 (off) à 1 (plein)
}

export type QuantizeConfig = {
  distanceMetric: DistanceMetric
  contrastStrategy?: 'max' | 'balanced' // Stratégie de contraste pour petites palettes
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
    vectors.push([data[i], data[i + 1], data[i + 2]])
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
  const { distanceMetric } = quantConfig

  // Pour RGB seulement, pas de conversion nécessaire
  const toW = (rgb: Vector) => rgb
  const fromW = (rgb: Vector) => rgb
  const distFn: DistanceFn = getDistanceFn('RGB', distanceMetric)

  const vecs = bufferToVectors(buf)
  const workingPal = basePalette.map((c) => toW([...c] as Vector))

  const preIdx = preselected
    .map((c) =>
      basePalette.findIndex(
        (p) => p[0] === c[0] && p[1] === c[1] && p[2] === c[2]
      )
    )
    .filter((i) => i >= 0)

  const reducePalette = (limit: number): Vector[] => {
    const counts = new Uint32Array(
      buildWeightedHistogram(vecs.map(toW), workingPal, distFn)
    )

    // DEBUG: Log histogram for analysis
    quantizerLogger.info('🎨 Histogram analysis:')
    const histogramEntries = workingPal
      .map((color, idx) => ({
        index: idx,
        color,
        count: counts[idx],
        name: getCPCColorName(color) // Helper to identify CPC colors
      }))
      .sort((a, b) => b.count - a.count)

    quantizerLogger.info(
      'Top 10 colors by weight:',
      histogramEntries.slice(0, 10)
    )
    quantizerLogger.info(
      'Blue colors in histogram:',
      histogramEntries.filter((entry) => isBlueColor(entry.color))
    )

    // Calculate relative threshold based on image size (0.1% of pixels, minimum 1)
    const totalPixels = vecs.length
    const relativeThreshold = Math.max(1, Math.floor(totalPixels * 0.001))

    // ✅ OPTIMISATION: Utiliser mode diversité pour les palettes moyennes (mode 0 = 16 couleurs)
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

    quantizerLogger.info('Selected indices:', idxs)
    quantizerLogger.info(
      'Selected colors:',
      idxs.map((i) => ({
        index: i,
        color: workingPal[i],
        name: getCPCColorName(workingPal[i])
      }))
    )

    const out = idxs.map((i: number) => workingPal[i])

    // Utiliser le sélecteur de stratégie commun
    const selectedW = selectByStrategy(
      { contrastStrategy: quantConfig.contrastStrategy, targetColors: limit },
      {
        candidates: out,
        preselected: preIdx.map((i) => [...workingPal[i]] as Vector),
        targetColors: limit,
        distanceFn: distFn,
        toRGB: fromW
      }
    )

    return selectedW
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
