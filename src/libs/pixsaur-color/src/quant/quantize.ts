import { buildHistogram } from '../histogram'
import { mapAndDither } from '../map'
import {
  type DistanceFn,
  type DistanceMetric,
  getDistanceFn
} from '../metric/distance'
import type { Vector } from '../type'
import { selectTopIndicesCore, selectTopIndices } from './select-to-indices'
import { selectByStrategy } from './strategy-selector'

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
      buildHistogram(vecs.map(toW), workingPal, distFn)
    )

    // ✅ OPTIMISATION: Utiliser mode diversité pour les palettes moyennes (mode 0 = 16 couleurs)
    const useDiversityMode = limit >= 8 && limit <= 16

    const idxs = useDiversityMode
      ? selectTopIndicesCore(counts, preIdx, 16, {
          threshold: 10,
          diversityMode: true,
          basePalette: workingPal
        })
      : selectTopIndices(counts, preIdx, 16)

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
