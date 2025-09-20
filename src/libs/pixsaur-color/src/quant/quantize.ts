import { buildHistogram } from '../histogram'
import { mapAndDither } from '../map'
import {
  type DistanceFn,
  type DistanceMetric,
  getDistanceFn
} from '../metric/distance'
import { getColorSpaceToRgbFn, getRgbToColorSpaceFn } from '../space'
import type { ColorSpace, Vector } from '../type'
import { selectTopIndices } from './select-to-indices'
import { paletteLogger } from '@/utils/logger'
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
  colorSpace: ColorSpace
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
  const { colorSpace, distanceMetric } = quantConfig

  const toW = getRgbToColorSpaceFn(colorSpace)
  const fromW = getColorSpaceToRgbFn(colorSpace)
  const distFn: DistanceFn = getDistanceFn(colorSpace, distanceMetric)

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
    paletteLogger.time('📊 [Histogram] Building color histogram')
    const histogram = buildHistogram(vecs.map(toW), workingPal, distFn)
    paletteLogger.timeEnd('📊 [Histogram] Building color histogram')
    
    const counts = new Uint32Array(histogram)
    const totalPixels = counts.reduce((sum, count) => sum + count, 0)
    
    paletteLogger.debug(
      `📊 [Histogram] Processed ${totalPixels} pixels across ${workingPal.length} palette colors`
    )

    const idxs = selectTopIndices(counts, preIdx, 16)
    const out = idxs.map((i) => workingPal[i])

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
        colorSpace
      )
    }
  }
}
