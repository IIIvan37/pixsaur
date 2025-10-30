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
// CPC color name mapping for debugging
const CPC_COLOR_NAMES = new Map<string, string>([
  ['0,0,128', 'Blue'],
  ['0,0,255', 'Bright Blue'],
  ['0,128,255', 'Sky Blue'],
  ['128,128,255', 'Pastel Blue'],
  ['0,255,255', 'Bright Cyan'],
  ['128,255,255', 'Pastel Cyan'],
  ['255,0,0', 'Bright Red'],
  ['128,0,0', 'Red'],
  ['255,0,128', 'Purple'],
  ['128,0,128', 'Magenta'],
  ['255,0,255', 'Bright Magenta'],
  ['128,0,255', 'Mauve'],
  ['0,128,0', 'Green'],
  ['0,255,0', 'Bright Green'],
  ['128,255,0', 'Lime'],
  ['128,128,0', 'Yellow'],
  ['255,255,0', 'Bright Yellow'],
  ['255,128,0', 'Orange'],
  ['0,0,0', 'Black'],
  ['255,255,255', 'Bright White'],
  ['128,128,128', 'White']
])

function getCPCColorName(color: Vector): string {
  const [r, g, b] = color
  const key = `${r},${g},${b}`
  return CPC_COLOR_NAMES.get(key) ?? `RGB(${r},${g},${b})`
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
